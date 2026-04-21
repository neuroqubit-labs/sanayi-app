# 02 — Technician

## Purpose

Teknisyen (usta/servis sağlayıcı) profilinin tam tanımı — marka, uzmanlık, belge, galeri, müsaitlik ve havuz görünürlüğü. Müşteri tarafındaki arama/filtreleme, usta tarafındaki onboarding + KYC ve havuz eşleştirmesi bu modele dayanır.

Zihin modeli: `users` satırı (role='technician') **kimliktir**; `technician_profiles` satırı o kimliğin **marka ve operasyon profili**dir. 1:1 ilişki. Profil yoksa kullanıcı teknisyen olarak görünmez.

**Anti-disinter**: profil alanları (biography, galeri, tagline) pazarlama içeriğidir; telefon/email gibi PII `users` tablosunda kalır, profil üzerinden dışa açılmaz.

## Entity tablolar

### `technician_profiles` (1:1 `users`)

```sql
CREATE TABLE technician_profiles (
    id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                   UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    display_name              VARCHAR(255) NOT NULL,
    tagline                   VARCHAR(255),
    biography                 TEXT,
    availability              technician_availability NOT NULL DEFAULT 'offline',
    verified_level            technician_verified_level NOT NULL DEFAULT 'basic',
    provider_type             provider_type NOT NULL,
    secondary_provider_types  provider_type[] NOT NULL DEFAULT '{}',
    working_hours             VARCHAR(255),
    area_label                VARCHAR(255),
    business_info             JSONB NOT NULL DEFAULT '{}'::jsonb,
    -- {legal_name, tax_number, address, city_district, iban, phone, email}
    avatar_asset_id           UUID REFERENCES media_assets(id) ON DELETE SET NULL,
    promo_video_asset_id      UUID REFERENCES media_assets(id) ON DELETE SET NULL,
    deleted_at                TIMESTAMPTZ,
    created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX ix_tech_profiles_pool ON technician_profiles
  (provider_type, availability)
  WHERE deleted_at IS NULL AND availability = 'available';
CREATE INDEX ix_tech_profiles_secondary_gin
  ON technician_profiles USING GIN (secondary_provider_types);
```

**Enum'lar**:
- `provider_type` — `usta | cekici | oto_aksesuar | kaporta_boya | lastik | oto_elektrik`
- `technician_verified_level` — `basic | verified | premium`
- `technician_availability` — `available | busy | offline`

**Kurallar**:
- `provider_type` birincil rol; havuz eşleştirmesinin ana filtresidir (Faz 4 `KIND_PROVIDER_MAP`)
- `secondary_provider_types` ikinci roller (opsiyonel); GIN index ile "çekici de olan usta" gibi sorgular
- `business_info` JSONB — adres/tax metadata. Sorgulanmaz, UI için taşınır. KYC onay sırasında kontrol edilir
- Avatar/promo görsel `media_assets` içine SET NULL FK; medya silinse profil kalır

### `technician_capabilities` (1:1 `technician_profiles`)

4 boolean flag. Ayrı tablo çünkü (a) sık güncellenir, (b) gelecekte kapasitenin tarihi/denormalize flag'leri büyüyebilir.

```sql
CREATE TABLE technician_capabilities (
    profile_id              UUID PRIMARY KEY REFERENCES technician_profiles(id) ON DELETE CASCADE,
    insurance_case_handler  BOOLEAN NOT NULL DEFAULT FALSE,
    on_site_repair          BOOLEAN NOT NULL DEFAULT FALSE,
    valet_service           BOOLEAN NOT NULL DEFAULT FALSE,
    towing_coordination     BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Kurallar**:
- Profile create → capability satırı otomatik init (tümü false)
- `on_site_repair=true` → arıza/bakım vakalarında "yerinde tamir" seçeneği aktif
- `insurance_case_handler=true` → sigorta dosyası açma izni (hasar akışı)

### `technician_specialties` (specialty + expertise birleşik)

Mobil'de iki ayrı array (`specialties`, `expertise`). Backend'de `kind` ayırt eder; tek tablo daha normalize.

```sql
CREATE TABLE technician_specialties (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id       UUID NOT NULL REFERENCES technician_profiles(id) ON DELETE CASCADE,
    kind             VARCHAR(16) NOT NULL CHECK (kind IN ('specialty','expertise')),
    label            VARCHAR(120) NOT NULL,
    label_normalized VARCHAR(120) NOT NULL,  -- lower/trim, trgm search
    display_order    SMALLINT NOT NULL DEFAULT 0,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (profile_id, kind, label_normalized)
);
CREATE INDEX ix_tech_specialties_search
  ON technician_specialties USING GIN (label_normalized gin_trgm_ops);
```

**Kurallar**:
- `kind='specialty'` — "BMW, Mercedes" (marka uzmanlığı)
- `kind='expertise'` — "Motor, Şanzıman" (alan uzmanlığı)
- `label_normalized` uygulama tarafında `lower(trim(label))` ile doldurulur
- Duplicate `(profile_id, kind, label_normalized)` engellenir
- trgm index → "BM" araması "BMW" eşleştirir

### `technician_certificates`

KYC zincirinin veri katmanı. Her sertifika media asset ile bağlı; status makinesi admin onayı boyunca ilerler.

```sql
CREATE TABLE technician_certificates (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id        UUID NOT NULL REFERENCES technician_profiles(id) ON DELETE CASCADE,
    kind              technician_certificate_kind NOT NULL,
    title             VARCHAR(255) NOT NULL,
    file_url          TEXT,
    mime_type         VARCHAR(128),
    media_asset_id    UUID REFERENCES media_assets(id) ON DELETE SET NULL,
    uploaded_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    verified_at       TIMESTAMPTZ,
    expires_at        TIMESTAMPTZ,
    status            technician_certificate_status NOT NULL DEFAULT 'pending',
    reviewer_note     TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX ix_tech_certificates_profile_status
  ON technician_certificates (profile_id, status);
CREATE INDEX ix_tech_certificates_expiring
  ON technician_certificates (expires_at)
  WHERE status = 'approved' AND expires_at IS NOT NULL;
```

**Enum'lar**:
- `technician_certificate_kind` — `identity | tax_registration | trade_registry | insurance | technical | vehicle_license`
- `technician_certificate_status` — `pending | approved | rejected | expired`

**Kurallar**:
- Upload → `status='pending'` + `verified_at=NULL`
- Admin approve → `status='approved'` + `verified_at=NOW()`
- Admin reject → `status='rejected'` + `reviewer_note` zorunlu
- `expires_at` geldiğinde cron → `status='expired'`
- Status değişince `technician_profiles.verified_level` recompute (service layer)

### `technician_gallery_items`

Usta'nın öne çıkan işleri (fotoğraf / video). Display order ile sıralanır.

```sql
CREATE TABLE technician_gallery_items (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id      UUID NOT NULL REFERENCES technician_profiles(id) ON DELETE CASCADE,
    kind            gallery_item_kind NOT NULL,
    title           VARCHAR(255),
    caption         VARCHAR(255),
    media_asset_id  UUID NOT NULL REFERENCES media_assets(id) ON DELETE CASCADE,
    display_order   SMALLINT NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX ix_tech_gallery_order
  ON technician_gallery_items (profile_id, display_order);
```

**Enum**:
- `gallery_item_kind` — `photo | video`

**Kurallar**:
- Media CASCADE — medya silinirse gallery item düşer (sertifikanın tersine, galeride tuzak bırakmayız)
- `display_order` manuel sürükle-bırak; reorder repository helper ile tek transaction

## İlişkiler

```mermaid
erDiagram
    USER ||--o| TECHNICIAN_PROFILE : 1_1
    TECHNICIAN_PROFILE ||--|| TECHNICIAN_CAPABILITY : has
    TECHNICIAN_PROFILE ||--o{ TECHNICIAN_SPECIALTY : tags
    TECHNICIAN_PROFILE ||--o{ TECHNICIAN_CERTIFICATE : kyc
    TECHNICIAN_PROFILE ||--o{ TECHNICIAN_GALLERY_ITEM : gallery
    TECHNICIAN_CERTIFICATE }o--o| MEDIA_ASSET : file
    TECHNICIAN_GALLERY_ITEM }o--|| MEDIA_ASSET : asset
    TECHNICIAN_PROFILE }o--o| MEDIA_ASSET : avatar
    TECHNICIAN_PROFILE }o--o| MEDIA_ASSET : promo
    TECHNICIAN_PROFILE {
        uuid id PK
        uuid user_id FK_UK
        string display_name
        provider_type provider_type
        provider_type_arr secondary_provider_types
        tech_availability availability
        tech_verified_level verified_level
        jsonb business_info
    }
    TECHNICIAN_CAPABILITY {
        uuid profile_id PK_FK
        bool insurance_case_handler
        bool on_site_repair
        bool valet_service
        bool towing_coordination
    }
    TECHNICIAN_SPECIALTY {
        uuid id PK
        uuid profile_id FK
        string kind "specialty|expertise"
        string label
        string label_normalized
    }
    TECHNICIAN_CERTIFICATE {
        uuid id PK
        uuid profile_id FK
        cert_kind kind
        cert_status status
        timestamp uploaded_at
        timestamp verified_at
        timestamp expires_at
    }
    TECHNICIAN_GALLERY_ITEM {
        uuid id PK
        uuid profile_id FK
        gallery_kind kind
        uuid media_asset_id FK
        smallint display_order
    }
```

## State makinesi

### `technician_certificates.status`

```
pending ─┬─→ approved ─┬─→ expired (cron: expires_at ≤ NOW)
         │             └─→ rejected (admin update + note)
         └─→ rejected (admin reject at upload review)

rejected ─→ pending (yeni dosya upload + resubmit)
expired  ─→ pending (yeni dosya upload)
```

### `technician_profiles.availability`

```
offline ─→ available ─→ busy ─→ available
                  ↑──────────────┘
busy     ─→ offline
available─→ offline
```

- `available` → havuz feed'inde görünür
- `busy` → aktif iş var; yeni teklif/randevu için soft-gate
- `offline` → hiç görünmez

### `technician_profiles.verified_level` (derived)

Service layer `technician_kyc.recompute_verified_level()` hesaplar — sertifika status değişikliğinde tetiklenir:

```python
approved = count(certificates where status='approved' and (expires_at is null or expires_at > now))
has_identity = 'identity' in approved_kinds
has_tax = 'tax_registration' in approved_kinds
has_trade = 'trade_registry' in approved_kinds
has_insurance = 'insurance' in approved_kinds
has_technical = 'technical' in approved_kinds

if has_identity and has_tax and has_trade and has_insurance and approved ≥ 5:
    level = 'premium'
elif has_identity and has_tax and has_trade and approved ≥ 3:
    level = 'verified'
else:
    level = 'basic'
```

## Pool visibility (Faz 4 ile köprü)

Bir vakayı hangi usta görür?

```python
# Faz 4 — KIND_PROVIDER_MAP
ACCIDENT    → {usta, kaporta_boya, cekici}
TOWING      → {cekici, usta}
BREAKDOWN   → {usta, oto_elektrik, lastik, cekici}
MAINTENANCE → {usta, lastik, oto_elektrik, oto_aksesuar}
```

Havuz feed sorgusu:
```sql
SELECT sc.*
FROM service_cases sc
WHERE sc.status IN ('matching','offers_ready')
  AND sc.kind IN (kinds_that_match_provider_type(:tech_provider_type))
  AND sc.deleted_at IS NULL
ORDER BY sc.created_at DESC
LIMIT 50;
```

Usta görünürlüğü **birincil + ikincil** birleşimiyle değerlendirilir; `ANY(secondary_provider_types)` ekstra kind'leri açar.

## Lifecycle kuralları

- **Profil oluşturma**: KYC onboarding sonu — `users.approval_status='pending'` + `technician_profiles.availability='offline'` + `technician_capabilities` auto-init
- **Soft delete**: `technician_profiles.deleted_at` → pool feed'den düşer, sertifika query'leri hala çalışır (audit için)
- **Cascade**: user silinirse profil CASCADE; profil silinirse capability/specialty/certificate/gallery CASCADE
- **Media asset delete**:
  - Avatar/promo → SET NULL (profil kalır)
  - Certificate → SET NULL (sertifika kaydı kalır, dosya gitmiş olarak işaretlenir)
  - Gallery → CASCADE (dosyasız galeride yer yok)

## Mobil ↔ Backend mapping

| Mobil (`TechnicianProfileState`) | Backend tablo/kolon |
|---|---|
| `name` | `technician_profiles.display_name` |
| `tagline`, `biography` | top-level |
| `availability`, `verified_level` | top-level enum |
| `provider_type`, `secondary_provider_types` | top-level enum + enum[] |
| `business` (BusinessInfo) | `business_info` JSONB |
| `working_hours`, `area_label` | top-level |
| `specialties[]` | `technician_specialties` (kind='specialty') |
| `expertise[]` | `technician_specialties` (kind='expertise') |
| `capabilities` (4 bool) | `technician_capabilities` |
| `certificates[]` (`TechnicianCertificate`) | `technician_certificates` |
| `gallery[]` (`GalleryItem`) | `technician_gallery_items` |
| `avatar_asset`, `promo_video_asset` | `avatar_asset_id`, `promo_video_asset_id` FK |
| `users.full_name / phone / email` | Profile üzerinden **expose edilmez** (anti-disinter) |

## İndeksler & sorgu pattern'leri

| Sorgu | Index |
|---|---|
| "Müsait ustalar, provider=usta" | `ix_tech_profiles_pool` (partial) |
| "Çekici kapasiteli ustalar" | `ix_tech_profiles_secondary_gin` (GIN contains 'cekici') |
| "Belgesi onay bekleyenler" (admin) | `ix_tech_certificates_profile_status` |
| "Bu hafta expire eden sertifikalar" (cron) | `ix_tech_certificates_expiring` |
| "BM araması marka bul" | `ix_tech_specialties_search` (trgm) |
| "Galeri display sırası" | `ix_tech_gallery_order` |

## Test senaryoları

**Happy path**:
1. `create_profile(user_id, provider_type='usta', ...)` → profil + capability auto-init (all false)
2. `update_availability(profile_id, 'available')` → havuz feed'ine girer
3. Sertifika upload → `status='pending'`, admin approve → `verified_at` + `verified_level` recompute
4. `set_specialties(profile_id, 'specialty', ['BMW','Mercedes'])` → 2 satır, 2. kez çağrı → replace
5. `search_technicians('BM')` → 'BMW' uzmanlıklı teknisyenler döner (trgm)

**Edge**:
1. Aynı profile'a aynı label ile duplicate specialty → unique violation
2. `availability='busy'` + havuz sorgusu → partial index'e düşmez, görünmez
3. `secondary_provider_types` '{cekici}' → GIN contains ile bulunur
4. Certificate expire → `status='expired'` cron; `verified_level` düşer
5. Profile soft delete → pool feed'den düşer, sertifikalar hala sorgulanır
6. User CASCADE delete → profil + alt tablolar tümü silinir
7. Media asset (avatar) delete → `avatar_asset_id=NULL`; profil kalır
8. Media asset (gallery) delete → gallery item da CASCADE silinir

## V2 scope (bu fazda yok)

- **Kampanyalar** → Faz 10 (`technician_campaigns`)
- **Müşteri yorumları** → Faz 10 (`technician_reviews`, ratings)
- **Lokasyon (lat/lng) geofence** → V2; şu an `area_label` metin
- **Çalışma saatleri structured** → `opening_hours JSONB` V2; şu an serbest metin
- **Ekip/çalışan yönetimi** → V2 (`technician_team_members`)
- **Park & garaj kapasitesi** → V2

## Kod dosyaları (Faz 2 sonu)

- `naro-backend/app/models/technician.py` — 5 model + 6 enum
- `naro-backend/app/schemas/technician.py` — Pydantic in/out DTO
- `naro-backend/app/repositories/technician.py` — 12+ helper
- `naro-backend/app/services/technician_kyc.py` — `recompute_verified_level`
- `naro-backend/alembic/versions/20260420_0003_technician.py` — 6 enum + 5 tablo + trgm index
- `naro-backend/tests/test_technician.py` — 8 senaryo
