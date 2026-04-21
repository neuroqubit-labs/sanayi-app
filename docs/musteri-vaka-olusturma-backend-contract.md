# Müşteri Vaka Oluşturma — Backend Kontratı

> **PO kaynak:** PRODUCT-OWNER · 2026-04-22
> **Hedef sohbetler:** BACKEND-DEV (primary — implement) · UI-UX-FRONTEND-DEV (consumer — contract tüketir)
> **Kapsam:** Müşteri composer'larının (bakım/hasar/arıza/çekici) backend'e gönderdiği talep yapısı + validasyon + attachment + response + error kontratı
> **Durum:** Pydantic şema kısmen hazır; **endpoint YOK**, kind-bazlı validation YOK, kategori-spesifik alanlar YOK. Bu doc BE'nin kapatması gereken ciddi bir iş paketi.

---

## 1. Context

Dört composer (bakım / hasar / arıza / çekici — şu an hepsi mobil tarafta mock'ta çalışıyor) submit aşamasında backend'e tek POST atacak. Ama:

- **Endpoint yok** — `app/api/v1/router.py` sadece auth + media + health include ediyor. `/cases` router yazılmamış (audit P0-6).
- **Pydantic şema generic** — `ServiceRequestDraftCreate` tüm kind'ları tek şemada topluyor; kind-spesifik zorunluluk backend'de enforce edilmiyor. Kullanıcı `kind='accident'` ile `counterparty_note` boş gönderse geçer.
- **Kategori-spesifik alanlar (bakım için kapsam/geçirgenlik/kalite; kaza için hasar detayı) yok** — şema'da flat alanlar var ama her kategorinin farklı ek alanları yok.
- **Attachment bağlama belirsiz** — media_asset.id'ler nasıl draft'a bağlanıyor? Hangi attachment hangi `purpose`'a? Enforce yok.
- **Validation matrisi dokümante değil** — "kind=accident zorunlu alanlar listesi" hiçbir yerde yazmıyor; FE + BE drift riski.
- **Error contract yok** — 422 payload şekli tanımsız; mobil hata mesajlarını nasıl yorumlayacak belirsiz.

Sonuç: **mobil backend'e bağlandığı gün** submit çağrısı `404 Not Found` verir, çünkü endpoint yok. Sonra endpoint yazılsa bile kind-bazlı validation yokluğu kontrol dışı veri girişine izin verir. Bu doc bunu kapatır.

---

## 2. Endpoint kontratı

### 2.1 Ana endpoint

```
POST /api/v1/cases
Content-Type: application/json
Authorization: Bearer {jwt}

Body: ServiceRequestDraftCreate (şu an şemada tanımlı + §3-5 eklemeler)

Success 201:
{
  "id": "uuid",
  "status": "matching",
  "kind": "accident",
  "workflow_blueprint": "damage_insured",
  "created_at": "2026-04-22T10:33:00Z",
  "wait_state": { "actor": "system", "label": "...", "description": "..." },
  "next_action_title": "Teklifleri bekle",
  ...  (ServiceCaseSchema full payload)
}

Error 422:
{
  "detail": [
    { "loc": ["body", "counterparty_note"], "msg": "kind=accident + counterparty=true iken zorunlu", "type": "value_error.missing_conditional" }
  ]
}

Error 409:
  Plate+VIN üzerinden mükerrer açık case varsa (duplicate guard).
```

### 2.2 İlgili yardımcı endpoint'ler

| Method | Path | Amaç |
|---|---|---|
| `POST` | `/api/v1/cases` | Yeni vaka oluştur (ana) |
| `GET` | `/api/v1/cases/{id}` | Vaka detay |
| `GET` | `/api/v1/cases/me` | Müşterinin açık vakaları |
| `POST` | `/api/v1/cases/{id}/cancel` | İptal |
| `POST` | `/api/v1/cases/drafts` | Taslak kaydet (ayrı brief — §9) |
| `GET` | `/api/v1/cases/drafts/me` | Mevcut taslaklar |
| `DELETE` | `/api/v1/cases/drafts/{id}` | Taslak sil |

V1'de ana endpoint + draft endpoint'leri. Diğerleri mobil-backend bağlanma iterasyonunda.

---

## 3. ServiceRequestDraft — kind-bazlı alan matrisi

Mevcut [service_request.py:98-155](../naro-backend/app/schemas/service_request.py) 32 alan flat tanımlı. **Yeni eklemeler + kind-bazlı zorunluluk** aşağıdaki matriste.

### 3.1 Tüm kind'larda ortak

| Alan | Tip | Zorunlu | Kısıt |
|---|---|---|---|
| `schema_version` | `Literal["v1"]` | ✅ | sabit |
| `kind` | enum(4) | ✅ | `accident\|towing\|breakdown\|maintenance` |
| `vehicle_id` | UUID | ✅ | kullanıcının kendi aracı (ownership check) |
| `urgency` | enum(3) | ✅ | `planned\|today\|urgent` |
| `summary` | str (1-500) | ✅ | ≥1 karakter |
| `location_label` | str (1-255) | ✅ | reverse geocode metin |
| **`location_lat_lng`** | `LatLng` | ✅ (**YENİ**) | permission denied fallback varsa null kabul; warn flag |
| `attachments` | `CaseAttachmentDraft[]` | kind-bağlı | §5'te detay |
| `notes` | str | opsiyonel | ≤2000 |
| `preferred_window` | str | opsiyonel | ör. "Bu hafta" |
| `preferred_technician_id` | UUID | opsiyonel | fast-track için |
| `mileage_km` | int ≥ 0 | opsiyonel | araç km fotosundan okunabilir |

### 3.2 `kind='accident'`

| Alan | Zorunlu | Koşul |
|---|---|---|
| `counterparty_note` | **✅ koşullu** | `counterparty_vehicle_count ≥ 1` ise |
| `counterparty_vehicle_count` | ✅ | ≥0 |
| `vehicle_drivable` | ✅ | `true\|false` (null kabul etme) |
| `damage_area` | ✅ | enum benzeri serbest text (ör. "Ön sağ") |
| **`damage_severity`** | ✅ (**YENİ**) | enum: `minor\|moderate\|major\|total_loss` |
| `report_method` | ✅ | enum `e_devlet\|paper\|police` |
| `kasko_selected` | ✅ | bool |
| `kasko_brand` | **✅ koşullu** | `kasko_selected=true` ise |
| `sigorta_selected` | ✅ | bool (trafik sigortası) |
| `sigorta_brand` | **✅ koşullu** | `sigorta_selected=true` ise |
| `ambulance_contacted` | ✅ | bool |
| `emergency_acknowledged` | ✅ | bool `true` (onay kutusu) |
| `attachments` | **✅ zorunlu 2 kanıt** | "Kazanın genel görünümü" + "Hasar detayı" foto; diğerleri opsiyonel (§5.2) |
| `towing_required` | türetilmiş | `vehicle_drivable=false` → true (service layer) |
| `on_site_repair`, `valet_requested`, `pickup_preference` | kabul edilmez | kazada anlamsız — 422 |

### 3.3 `kind='breakdown'`

| Alan | Zorunlu | Koşul |
|---|---|---|
| `breakdown_category` | ✅ | enum(8) — engine/electric/mechanic/climate/transmission/tire/fluid/other |
| `symptoms` | ✅ | ≥1 eleman |
| `vehicle_drivable` | opsiyonel | bilgi amaçlı |
| `on_site_repair` | opsiyonel | bool |
| `towing_required` | opsiyonel | bool |
| `price_preference` | opsiyonel | enum(4) |
| `kasko_*`, `sigorta_*`, `report_method`, `damage_*`, `ambulance_*`, `emergency_*` | kabul edilmez | arıza'da anlamsız — 422 |

### 3.4 `kind='maintenance'`

| Alan | Zorunlu | Koşul |
|---|---|---|
| `maintenance_category` | ✅ | enum(14) — periodic/tire/glass_film/coating/... |
| `maintenance_items` | opsiyonel | string array (detay) |
| **`maintenance_detail`** | ✅ koşullu (**YENİ**) | `dict[str, Any]` — kategori-spesifik; §4'te detay |
| `maintenance_tier` | opsiyonel | string (free form — "Standart" / "Premium" vs) |
| `on_site_repair`, `valet_requested`, `pickup_preference` | opsiyonel | bool/enum |
| `price_preference` | opsiyonel | enum(4) |
| `kasko_*`, `sigorta_*`, `report_method`, `damage_*`, `counterparty_*`, `ambulance_*`, `emergency_*`, `breakdown_category` | kabul edilmez | 422 |

### 3.5 `kind='towing'`

| Alan | Zorunlu | Koşul |
|---|---|---|
| `dropoff_label` | ✅ | ev/servis/adres |
| `dropoff_lat_lng` | ✅ (**YENİ**) | map pin |
| `vehicle_drivable` | ✅ | `true\|false` |
| `urgency='urgent'` | → auto-dispatch path (Faz 10 tow) | ayrı endpoint veya aynı endpoint internal branching |
| `kasko_*` | opsiyonel | çekici sigortası kullanımı için |
| `on_site_repair`, `valet_requested`, `counterparty_*`, `damage_*`, `breakdown_*`, `maintenance_*` | kabul edilmez | 422 |

---

## 4. Kategori-spesifik JSON alanları

### 4.1 `maintenance_detail` (bakım için)

`maintenance_category` değerine göre payload şekli:

```python
MAINTENANCE_DETAIL_SCHEMAS: dict[MaintenanceCategory, BaseModel] = {
    PERIODIC: PeriodicDetail,        # {oil_type, filters[], target_km, inspections[]}
    GLASS_FILM: GlassFilmDetail,     # {scope: "yan"|"on_cam"|"tam", transmittance: "50"|"35"|"15"|"5", tier: "standard"|"premium"}
    TIRE: TireDetail,                # {season, brand_pref, count, rot_balans: bool}
    COATING: CoatingDetail,          # {layers: int, prep: bool, warranty_months}
    BATTERY: BatteryDetail,          # {crank_ok, last_change_date, brand_pref}
    BRAKE: BrakeDetail,              # {axle: "on"|"arka"|"both", pad_and_disc: bool, symptom}
    CLIMATE: ClimateDetail,          # {symptom, last_gas_date, gas_type_known: bool}
    DETAIL_WASH: DetailWashDetail,   # {interior: bool, engine_bay: bool, polish: bool}
    HEADLIGHT_POLISH: EmptyDetail,
    ENGINE_WASH: EmptyDetail,
    PACKAGE_SUMMER: PackageDetail,   # {items[]}
    PACKAGE_WINTER: PackageDetail,
    PACKAGE_NEW_CAR: PackageDetail,
    PACKAGE_SALE_PREP: PackageDetail,
}
```

**Backend:**
- `maintenance_detail: dict[str, Any]` — Pydantic'te `Any` kabul; **validate edildikten sonra** service layer içinde uygun model'e parse
- `app/services/maintenance_detail_validator.py` (yeni) — kategori × payload çapraz kontrol
- Invalid payload → 422 `{loc: ["body", "maintenance_detail"], msg: "Bakım kategorisi 'glass_film' için 'scope' alanı zorunlu"}`

### 4.2 `damage_severity` (kaza için)

```python
class DamageSeverity(StrEnum):
    MINOR = "minor"           # tampon çiziği, küçük ezik
    MODERATE = "moderate"     # panel hasarı, tek ünite
    MAJOR = "major"           # birden fazla panel, mekanik etkilenmiş
    TOTAL_LOSS = "total_loss" # sürülemez, büyük parçalar etkilenmiş
```

V1 kullanıcı manuel seçer (UI'da chip); V2 AI foto intake inferred. Matching motorunun `problemFit` skorunda kullanılır (kaza tier'ına göre kaporta-boya vs ekspertiz usta önceliği).

### 4.3 Yeni enum (BE tarafı)

```python
# app/schemas/service_request.py ek
class LatLng(BaseModel):
    lat: Decimal = Field(ge=-90, le=90)
    lng: Decimal = Field(ge=-180, le=180)
```

Zaten [packages/domain/src/technician.ts](../packages/domain/src/technician.ts) Zod'da tanımlı (Faz 7 signal model); backend Pydantic'e paralel eklenir.

---

## 5. Attachment bağlama akışı

Müşteri composer'da foto/video seçer → media upload intent → S3'e PUT → complete. Bu **media pipeline** zaten hazır (audit §Eksen F). Draft submit'te **sadece asset_id**'ler gönderilir.

### 5.1 `CaseAttachmentDraft` mevcut şema

```python
class CaseAttachmentDraft(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str                                  # client-generated
    kind: CaseAttachmentKind                 # photo | video | audio | invoice | report | document | location
    title: str                               # "Ön sağ hasar fotoğrafı"
    subtitle: str | None
    status_label: str | None
    asset_id: UUID | None                    # media_assets.id (pre-uploaded)
```

### 5.2 Kaza-spesifik foto kategorileri (YENİ alan gerekli)

Mevcut şemada her attachment `kind=photo` gelebilir — hangi foto "hasar detayı" hangi "karşı araç plakası" belirsiz. Eklenmesi gereken:

```python
class CaseAttachmentDraft(BaseModel):
    ...  # mevcut alanlar
    category: str | None = None  # YENİ — FE ile hizalı semantik etiket
```

Kaza için beklenen `category` değerleri:
- `scene_overview` (Kazanın genel görünümü — zorunlu)
- `damage_detail` (Hasar detayı — zorunlu)
- `counterparty_plate` (opsiyonel)
- `environment` (yol/çevre — opsiyonel)
- `extra_evidence` (tanık/kamera — opsiyonel)
- + 2 daha (mevcut 7'den)

Bakım için:
- `mileage_photo` (periyodik zorunlu)
- `old_service_form` (opsiyonel)
- `glass_current_view` (cam filmi opsiyonel)
- `reference_image` (opsiyonel)

### 5.3 Zorunluluk kontrolü (service layer)

Backend submit'te:
```python
def validate_required_attachments(draft: ServiceRequestDraft):
    required = REQUIRED_ATTACHMENT_MATRIX.get((draft.kind, draft.maintenance_category or draft.breakdown_category))
    present_categories = {a.category for a in draft.attachments if a.category}
    missing = set(required) - present_categories
    if missing:
        raise ValidationError(f"Zorunlu kanıt eksik: {missing}")
```

`REQUIRED_ATTACHMENT_MATRIX`:
```python
{
    ("accident", None): {"scene_overview", "damage_detail"},
    ("maintenance", "periodic"): {"mileage_photo"},
    ("maintenance", "glass_film"): set(),  # opsiyonel
    ("maintenance", "tire"): {"tire_photo"},
    ("breakdown", "engine"): set(),  # opsiyonel
    ("towing", None): set(),  # opsiyonel (kullanıcı isterse 4 açı)
}
```

UI zaten bu kuralları uyguluyor (her step'te validate); backend **defense in depth** — UI'ı atlayan client reject edilir.

### 5.4 Asset sahiplik kontrolü

Submit'te `asset_id`'ler backend'ce doğrulanır:
- `media_assets.owner_user_id = current_user.id` olmalı
- `status = 'complete'` olmalı (orphan intent değil)
- Asset zaten başka case'e bağlı değil (reuse engelleyici)
- Başkasının asset'ine bağlama → 403

---

## 6. Validation katmanları

### 6.1 Katman 1: Pydantic syntax (automatic)
- Type check, enum value, min/max, regex
- Şu an mevcut; sadece §3-5 yeni alanlarla genişler

### 6.2 Katman 2: Kind-bazlı conditional (YENİ)

`app/schemas/service_request.py` içinde `@model_validator(mode='after')`:

```python
@model_validator(mode='after')
def validate_kind_consistency(self):
    rules = KIND_FIELD_RULES[self.kind]
    for field, rule in rules.items():
        if rule == "required" and getattr(self, field) is None:
            raise ValueError(f"kind={self.kind} için {field} zorunlu")
        if rule == "forbidden" and getattr(self, field) is not None:
            raise ValueError(f"kind={self.kind} için {field} gönderilemez")
    # Conditional: kasko_brand required if kasko_selected
    if self.kasko_selected and not self.kasko_brand:
        raise ValueError("kasko_selected=true iken kasko_brand zorunlu")
    # + diğer conditional'lar
    return self
```

### 6.3 Katman 3: Business rule (service layer)

```python
# app/services/case_create.py
async def create_case(draft: ServiceRequestDraftCreate, user_id: UUID):
    # 1. Vehicle ownership
    vehicle = await vehicle_repo.get_owned_by(draft.vehicle_id, user_id)
    if not vehicle:
        raise ForbiddenError("Bu araç senin değil")

    # 2. Maintenance detail schema validation
    if draft.kind == "maintenance":
        validate_maintenance_detail(draft.maintenance_category, draft.maintenance_detail)

    # 3. Attachment ownership + completion + uniqueness
    for att in draft.attachments:
        if att.asset_id:
            asset = await media_repo.get(att.asset_id)
            assert asset.owner_user_id == user_id
            assert asset.status == "complete"
            assert asset.linked_case_id is None

    # 4. Required attachment matrix
    validate_required_attachments(draft)

    # 5. Duplicate open case guard
    existing = await case_repo.find_open_by_vehicle_and_kind(
        draft.vehicle_id, draft.kind
    )
    if existing and draft.kind in {"accident", "breakdown"}:
        # Aynı araç için açık kaza/arıza olması riskli
        raise ConflictError(f"Aynı araç için açık {draft.kind} vakası mevcut: {existing.id}")

    # 6. Insert case + workflow_blueprint + trigger pool match
    ...
```

---

## 7. Error contract

### 7.1 422 Unprocessable Entity
Pydantic default FastAPI 422 formatı korunur, sadece custom `type` değerleri:

```json
{
  "detail": [
    {
      "loc": ["body", "counterparty_note"],
      "msg": "kind=accident + counterparty=true iken zorunlu",
      "type": "value_error.conditional_required",
      "ctx": { "field": "counterparty_note", "when": "counterparty_vehicle_count>=1" }
    },
    {
      "loc": ["body", "attachments"],
      "msg": "Zorunlu kanıt eksik: scene_overview, damage_detail",
      "type": "value_error.missing_attachments",
      "ctx": { "missing": ["scene_overview", "damage_detail"] }
    }
  ]
}
```

### 7.2 409 Conflict
```json
{ "detail": "Aynı araç için açık accident vakası mevcut: {uuid}", "type": "duplicate_open_case" }
```

### 7.3 403 Forbidden
```json
{ "detail": "Bu araç sana ait değil", "type": "vehicle_not_owned" }
{ "detail": "Bu asset sana ait değil", "type": "asset_not_owned" }
```

### 7.4 Mobil tarafı
FE i18n key'leri `type` değerinden türetir; gösterilecek mesaj backend `msg` değil kendi i18n kataloğundan. BE mesajları developer-facing; user-facing değil.

---

## 8. Workflow blueprint seçimi

Submit sonrası `service_cases.workflow_blueprint` doldurulur. Service layer kural:

```python
def resolve_blueprint(draft: ServiceRequestDraft) -> CaseWorkflowBlueprint:
    if draft.kind == "accident":
        return "damage_insured" if (draft.kasko_selected or draft.sigorta_selected) else "damage_uninsured"
    if draft.kind == "maintenance":
        return "maintenance_major" if draft.maintenance_category in {"periodic", "coating", "package_summer"} else "maintenance_standard"
    # breakdown + towing için yeni blueprint'ler eklenebilir
    return "maintenance_standard"  # fallback
```

Blueprint `case_process.py` milestone + task seed işine bağlı (mevcut Faz 7a).

---

## 9. Şu anki eksikler — BE kapatması gereken

### 9.1 Şema seviyesi
- [ ] `ServiceRequestDraftCreate`'a `location_lat_lng: LatLng` ekle
- [ ] `dropoff_lat_lng` ekle (towing için)
- [ ] `damage_severity: DamageSeverity` enum ekle (kaza için)
- [ ] `maintenance_detail: dict[str, Any]` ekle (bakım için)
- [ ] `CaseAttachmentDraft.category: str` ekle (semantic etiket)
- [ ] `@model_validator` kind-bazlı conditional rules

### 9.2 Service layer
- [ ] `app/services/case_create.py` (yeni) — 6 adımlı validation + insert akışı
- [ ] `app/services/maintenance_detail_validator.py` (yeni) — kategori × payload schema map
- [ ] `REQUIRED_ATTACHMENT_MATRIX` constant + validator function
- [ ] `resolve_blueprint()` workflow mapper

### 9.3 Repository
- [ ] `case_repo.find_open_by_vehicle_and_kind()` (duplicate guard query)
- [ ] `media_repo.link_asset_to_case(asset_id, case_id)` — asset bağlandığında owner_kind/owner_id set
- [ ] `media_assets.linked_case_id` kolonu (yoksa ekle) + index

### 9.4 API router
- [ ] `app/api/v1/routes/cases.py` (yeni) — 7 endpoint (§2.2)
- [ ] Router.py'a include
- [ ] Rate limit (yeni case submit: 10/dk/user)

### 9.5 Test
- [ ] `test_case_create_accident_happy.py` (valid submit → 201)
- [ ] `test_case_create_kind_forbidden_field.py` (arıza'da kasko gönder → 422)
- [ ] `test_case_create_missing_attachment.py` (kaza'da foto yok → 422)
- [ ] `test_case_create_wrong_vehicle.py` (başkasının aracı → 403)
- [ ] `test_case_create_duplicate_open.py` (aynı araç açık kaza → 409)
- [ ] `test_maintenance_detail_validator.py` (cam filmi için scope yok → 422)

### 9.6 Observability
- [ ] Prometheus metric: `case_create_total{kind, status}` + `case_create_validation_fail_total{reason}`
- [ ] Structured log: her submit bir log satırı (user_id, kind, case_id, duration_ms)

### 9.7 Dokümantasyon
- [ ] [docs/veri-modeli/04-case.md](veri-modeli/04-case.md) — yeni alanlar + validation matrisi eklenir
- [ ] OpenAPI spec otomatik FastAPI'den çıkar; mobile ile paylaş

---

## 10. Taslak kaydetme (§9.1 değil, ayrı brief'te)

Composer half-state resume için backend kontratı: **ayrı brief — `docs/composer-taslak-kaydetme.md`** (yazılacak). Bu doc sadece **complete submit** odaklı.

Kısa özet (sonra detay):
- `POST /cases/drafts` — partial ServiceRequestDraft kabul (validation relaxed)
- `draft_id` döner; mobile local state + server cloud sync
- `GET /cases/drafts/me` liste
- `DELETE /cases/drafts/{id}` silme
- Retention: 30 gün sonra orphan draft purge

---

## 11. Mobil ↔ Backend senkron stratejisi

Zod (frontend) ↔ Pydantic (backend) parity kritik — drift = kullanıcı hatası.

### 11.1 Single source of truth
- [packages/domain/src/service-case.ts](../packages/domain/src/service-case.ts) — Zod şemalar canonical
- `app/schemas/service_request.py` — Pydantic paralel

### 11.2 Parity test
`naro-backend/tests/test_schema_parity.py` (yeni):
```python
def test_service_request_draft_parity():
    # Zod JSON schema export (packages/domain/scripts/export-schema.ts ile üretilir)
    zod_schema = json.load(open("packages/domain/dist/service-request-draft.schema.json"))
    # Pydantic JSON schema export
    py_schema = ServiceRequestDraftCreate.model_json_schema()
    # Alanlar + tipler + enum değerleri karşılaştır
    assert_schema_parity(zod_schema, py_schema)
```

### 11.3 Yeni alan eklerken
Her PR'da **hem Zod hem Pydantic** güncellenir; parity test CI'da zorunlu. PO her alan ekleme request'i approve eder.

---

## 12. Faz planı

### Faz A — Şema + validation (3 gün, BE primary)
1. Pydantic şema genişletme (§9.1)
2. Kind-bazlı validator (§6.2)
3. Maintenance detail schema map (§4.1)
4. Attachment matrix validator (§5.3)
5. Unit test `test_schema_parity` + `test_kind_validation`

### Faz B — Endpoint + service layer (2 gün, BE)
1. `app/services/case_create.py` 6-adım akışı
2. `app/api/v1/routes/cases.py` — 7 endpoint
3. Router include + rate limit
4. Workflow blueprint resolver

### Faz C — Test + observability (1 gün, BE)
1. Happy + sad path testleri (6 test)
2. Prometheus metric
3. Structured log

### Faz D — Mobil wire-up (FE paralel, 1 gün)
1. Mock engine → real API çağrısı
2. Error mapping (422/409/403 → i18n key)
3. Submit sonrası navigation → case profile ekranı
4. Taslak kaydetme brief'i FE tarafı (ayrı iterasyon)

**Toplam: ~6-7 iş günü** (BE 4-5 gün + FE 1-2 gün paralel)

---

## 13. Audit ile ilişki

Bu doc audit P0/P1 bulgularıyla doğrudan örtüşür:

| Audit bulgu | Bu doc'ta çözüm |
|---|---|
| P0-6 (REST endpoint eksik) | §2 + §9.4 — endpoint'ler tanımlandı |
| P0-5 (kullanıcı tercihi enforcement) | §3 kind-bazlı validation + §6.2 conditional rules — soft warning Faz 8 matching, hard reject bu doc'ta |
| P1-2 (damage scoring) | §4.2 `damage_severity` enum |
| P1-1 (vehicle history consent) | Bu doc'ta kapsam dışı — araç ekleme flow'unun ayrı iterasyonu |
| P1-5 (test coverage) | §9.5 + §12 Faz C — 6 test |

---

## 14. Referanslar

- [docs/audits/2026-04-21-backend-audit.md](audits/2026-04-21-backend-audit.md) — audit bulgular
- [docs/musteri-bakim-composer-revizyon.md](musteri-bakim-composer-revizyon.md) — bakım composer UI kardeş
- [docs/musteri-hasar-composer-revizyon.md](musteri-hasar-composer-revizyon.md) — hasar composer UI kardeş
- [naro-backend/app/schemas/service_request.py](../naro-backend/app/schemas/service_request.py) — mevcut Pydantic
- [packages/domain/src/service-case.ts](../packages/domain/src/service-case.ts) — Zod canonical
- [docs/veri-modeli/04-case.md](veri-modeli/04-case.md) — ServiceCase DB şema
- [docs/media-upload-brief.md](media-upload-brief.md) — attachment pipeline

---

**Son güncellenme:** 2026-04-22 · Müşteri vaka oluşturma backend kontratı · BACKEND-DEV implementation manifest
