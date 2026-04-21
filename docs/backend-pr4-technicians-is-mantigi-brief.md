# PR 4 — `/technicians/me/*` İş Mantığı Brief'i

> **PO kaynak:** PRODUCT-OWNER · 2026-04-22
> **Hedef:** BACKEND-DEV (PR 4 öncesi okuma — zorunlu)
> **Kapsam:** 14 endpoint + 1 migration + 12-satırlık cert matrisi + shell config cache
> **Süre tahmini:** 3 gün
> **Önem derecesi:** 🔴 **Faz A'daki en yoğun invariant PR'ı** — migration geri alınamaz, 8 cascade ilişkisi var, 6 race noktası, multi-role semantiği birçok başka endpoint'i etkiler

---

## 1. Neden bu PR diğerlerinden farklı

PR 2 (`/offers`) + PR 3 (`/appointments`) — tek-yönlü CRUD + state transition. İçlerinde izole mantık.

**PR 4 öyle değil.** Üç özel tehlike:

### 1.1 Geri alınamaz migration
`ALTER TYPE technician_certificate_kind ADD VALUE 'tow_operator'` — Postgres enum value **drop edilemez**. Bir kez merge edilir, prod'a gider, geri alma YOK. Rollback strategy: yeni kolon + data migration + eski enum deprecated — 3 PR ve haftalar.

**Sonuç:** migration dosyası merge öncesi PO tarafından ek review. Adım bakım/hasar/bakım değil; "bu ismi `tow_operator` yapıyoruz, kesin mi?" sorusu son defa.

### 1.2 Cascade zincirleri
Bu 14 endpoint'ten **9'u başka state'i değiştirir**. Yanlış sırada çalıştırırsan sistem "görünürde çalışıyor ama havuzda hayalet teknisyenler" durumu yaratır.

Örnek cascade: müşteri cert approve'ladı (admin endpoint) → `recompute_verified_level` çağrılır → `recompute_admission` çağrılır → admission gate değişti → `role_config_version` bump → Redis cache invalidate → mobil `/me/shell-config` next call'da yeni config.

Bu cascade'i **her mutation endpoint'te** doğru tetiklemek zorundasın. Unutursan **stale state** — kullanıcı eski UI görür, havuzda yanlış filtreleme, capability-gated aksiyonlar yanlış çalışır.

### 1.3 Multi-role semantik
`active_provider_type` **sadece UI için değil** — havuz filter'ında, çekici dispatch'te, shell config'te kullanılır. Yanlış değer → bir usta çekici havuzunda görünür (capability'si var ama cert'i yok) veya hibrit kişi iki havuzu aynı anda görür (yanlış — explicit switch gerekli).

---

## 2. İş mantığı hiyerarşisi — cascade haritası

```
TechnicianProfile (1 user → 1 profile)
│
├─ mutation paths:
│
├── PATCH /me/profile          (name, bio, avatar)
│   └─ side-effect: shell_config.tagline değişmez ama cache bump (user gördüğü presentation güncel olsun)
│
├── PATCH /me/business         (legal_name, tax, phone, email, iban, address)
│   └─ side-effect: admission_gate_passed kontrolü (legal_name + phone zorunlu)
│   └─ shell_config cache invalidate
│
├── PATCH /me/availability     (available | busy | offline)
│   └─ side-effect: havuz feed görünürlüğü ANLIK (cache'leme yok, her sorguda okunur)
│   └─ admission_gate_passed=false iken 'available' set edilirse → 409
│
├── PUT /me/coverage           (service_domains + procedures + brand + drivetrain)
│   ⚠️  ATOMIK REPLACE — transaction ister
│   └─ side-effect:
│       ├─ admission_recompute (service_domains ≥ 1 zorunlu)
│       ├─ shell_config version bump (home_layout değişebilir)
│       └─ cache invalidate
│
├── PUT /me/service-area       (workshop_lat_lng + radius + city + districts)
│   └─ side-effect:
│       ├─ admission_recompute (lat_lng + radius + city zorunlu)
│       ├─ geospatial index (PostGIS) otomatik günceller
│       └─ shell_config cache invalidate (tab_set değişmez ama match havuzu değişir)
│
├── PUT /me/schedule           (weekly grid)
│   └─ side-effect:
│       ├─ admission_recompute (≥1 açık slot zorunlu)
│       └─ shell_config cache invalidate (availability UX'i etkilenir)
│
├── PATCH /me/capacity         (staff_count, max_concurrent, night/weekend/emergency)
│   └─ side-effect:
│       ├─ havuz kapasitesi etkilenir (current_queue_depth < max_concurrent kuralı)
│       └─ shell_config cache invalidate
│
├── PATCH /me/capabilities     (4 boolean)
│   └─ side-effect:
│       ├─ quick_actions değişir (insurance_case_handler kalktıysa "Hasar oluştur" button gizlenir)
│       ├─ shell_config version bump
│       └─ capability-gated endpoints'e etki (ör. `claim_source_sheet` artık render olmaz)
│
├── PATCH /me/provider-mode    (business ↔ individual)
│   ⚠️  MAJOR EVENT — required_cert_kinds değişir
│   └─ side-effect:
│       ├─ admission_recompute (cert matrix farklı cert set ister)
│       ├─ eksik cert varsa users.status → pending + availability='offline' FORCE
│       ├─ shell_config version bump (home_layout + quick_actions değişir)
│       ├─ onboarding re-triggered (eksik step'ler gösterilir)
│       └─ mobil user'a notify intent: "İş modunuz değişti, yeni gereksinimler"
│
├── POST /me/switch-active-role     (multi-role kişi primary ↔ secondary)
│   └─ side-effect:
│       ├─ target `provider_type` veya `secondary_provider_types[]` içinden olmalı → 422
│       ├─ shell_config version bump
│       ├─ havuz filter (active_provider_type) değişir — anlık
│       └─ cache invalidate
│
├── POST /me/certificates       (cert upload)
│   └─ side-effect:
│       ├─ status='pending' insert
│       ├─ admin review endpoint'inden approve beklenir (PR 9)
│       ├─ approve edildiğinde (PR 9'dan çağrı):
│       │   ├─ recompute_verified_level (basic → verified → premium)
│       │   ├─ recompute_admission (required_cert_kinds ⊆ approved → admission pass)
│       │   ├─ shell_config version bump
│       │   └─ cache invalidate
│
├── PATCH /me/certificates/{id}  (resubmit — rejected sonrası yeni media_asset)
│   └─ side-effect:
│       ├─ status='pending' geri döner
│       ├─ reviewer_note clear edilir
│       └─ admission değişmez (approve bekler)
│
├── GET /me/certificates         (read; side-effect yok)
│
└── GET /me/shell-config         (read + cache)
    └─ Redis key: shell_config:{user_id}:{role_config_version}
    └─ Cache miss → build_shell_config(profile) çağrılır (matrisleri evaluate)
    └─ Response header: X-Role-Config-Version
```

**9 mutation endpoint × 3-5 cascade side-effect = 30+ side-effect noktası.** Hiçbiri kaçmamalı.

---

## 3. Migration (0020 veya sırada — enum ADD VALUE + kolon)

### 3.1 SQL
```sql
-- Enum value add (rollback yok)
ALTER TYPE technician_certificate_kind ADD VALUE 'tow_operator';

-- Yeni enum
CREATE TYPE provider_mode AS ENUM ('business', 'individual');
-- NOT: side_gig V2'de — brief K-R1

-- Kolonlar
ALTER TABLE technician_profiles
    ADD COLUMN provider_mode provider_mode NOT NULL DEFAULT 'business',
    ADD COLUMN active_provider_type provider_type,
    ADD COLUMN role_config_version SMALLINT NOT NULL DEFAULT 1;

-- Consistency constraint
ALTER TABLE technician_profiles
    ADD CONSTRAINT ck_active_provider_in_roles
    CHECK (
      active_provider_type IS NULL
      OR active_provider_type = provider_type
      OR active_provider_type = ANY(secondary_provider_types)
    );

-- Index
CREATE INDEX ix_tech_profiles_active_role
    ON technician_profiles (active_provider_type, provider_mode)
    WHERE deleted_at IS NULL;
```

### 3.2 Uyarılar

**⚠️ `ADD VALUE` transaction-safe değil** — Postgres sürüm >= 12 için transaction içinde OK ama eski pattern farklı. Alembic migration için:
```python
# UP:
op.execute("ALTER TYPE technician_certificate_kind ADD VALUE IF NOT EXISTS 'tow_operator'")
```
`IF NOT EXISTS` zorunlu — yeniden çalıştırırsa (partial fail scenario) hata vermesin.

**⚠️ Down migration:**
```python
# DOWN: not fully reversible. Best effort:
op.drop_column("technician_profiles", "role_config_version")
op.drop_column("technician_profiles", "active_provider_type")
op.drop_column("technician_profiles", "provider_mode")
op.execute("DROP TYPE IF EXISTS provider_mode")
# tow_operator enum value REMOVE edilmez (Postgres kısıtı).
# Downgrade sonrası mevcut 'tow_operator' row'lar kırılmaz çünkü kolon hala varlığa izin verir.
```

Down comment: "tow_operator enum value kaldırılamaz; bu migration tek yönlüdür."

### 3.3 Back-fill kararı
Mevcut tüm `technician_profiles` satırları default `provider_mode='business'` alır. Individual'a geçmek isteyen kullanıcılar `PATCH /me/provider-mode` ile kendileri switchler. Admin toplu back-fill endpoint'i ihtiyaç halinde ayrı PR.

---

## 4. Cert rule matrisi — `app/services/technician_admission.py`

Brief §3 çağrısı ama burada **invariant olarak kilitleyeyim**:

```python
REQUIRED_CERTS: dict[tuple[ProviderType, ProviderMode], frozenset[TechnicianCertificateKind]] = {
    (CEKICI, BUSINESS):         frozenset({IDENTITY, VEHICLE_LICENSE, TOW_OPERATOR, INSURANCE, TAX_REGISTRATION, TRADE_REGISTRY}),
    (CEKICI, INDIVIDUAL):       frozenset({IDENTITY, VEHICLE_LICENSE, TOW_OPERATOR, INSURANCE, TAX_REGISTRATION}),
    (USTA, BUSINESS):           frozenset({IDENTITY, TAX_REGISTRATION, TRADE_REGISTRY}),
    (USTA, INDIVIDUAL):         frozenset({IDENTITY, TAX_REGISTRATION}),
    (KAPORTA_BOYA, BUSINESS):   frozenset({IDENTITY, TAX_REGISTRATION, TRADE_REGISTRY, INSURANCE}),
    (KAPORTA_BOYA, INDIVIDUAL): frozenset({IDENTITY, TAX_REGISTRATION, INSURANCE}),
    (LASTIK, BUSINESS):         frozenset({IDENTITY, TAX_REGISTRATION, TRADE_REGISTRY}),
    (LASTIK, INDIVIDUAL):       frozenset({IDENTITY, TAX_REGISTRATION}),
    (OTO_ELEKTRIK, BUSINESS):   frozenset({IDENTITY, TAX_REGISTRATION, TRADE_REGISTRY, TECHNICAL}),
    (OTO_ELEKTRIK, INDIVIDUAL): frozenset({IDENTITY, TAX_REGISTRATION, TECHNICAL}),
    (OTO_AKSESUAR, BUSINESS):   frozenset({IDENTITY, TAX_REGISTRATION, TRADE_REGISTRY}),
    (OTO_AKSESUAR, INDIVIDUAL): frozenset({IDENTITY, TAX_REGISTRATION}),
}
```

**12 kombinasyon = 12 test case** (§9).

**İş mantığı kuralları:**
- `required_cert_kinds(type, mode)` — her çağrıda aynı kümeyi dönmeli (frozenset immutable)
- `has_valid_cert(cert)` = `status='approved' AND (expires_at IS NULL OR expires_at > NOW())` — expiry kritik
- `admission_gate_passed = required_certs ⊆ {c.kind for c in approved_non_expired_certs}`
- **Expiry cron** (Faz 12'de yazılır; bu PR'da scope dışı): günde 1x cert expires_at kontrol, geçmişlerde status='expired' + admission recompute

**Tünel görüş uyarısı:** Dev `required_cert_kinds` map'ini set yerine list kullanırsa order-sensitive hatalar olabilir. `frozenset` zorunlu.

---

## 5. Shell config cache + version invariant

### 5.1 Cache key pattern
```
shell_config:{user_id}:{role_config_version}
```

`role_config_version` artar → eski key otomatik stale (yeni key miss → build edilir).

### 5.2 Version bump zorunlu mutation'lar
| Endpoint | Bump? | Neden |
|---|---|---|
| PATCH /me/profile | ✓ | avatar/tagline shell'de görünür |
| PATCH /me/business | ✓ | admission değişebilir |
| PATCH /me/availability | ✗ | cache YOK — her sorguda fresh read |
| PUT /me/coverage | ✓ | home_layout değişebilir |
| PUT /me/service-area | ✓ | (cache) |
| PUT /me/schedule | ✓ | (cache) |
| PATCH /me/capacity | ✓ | quick_actions'da etkili |
| PATCH /me/capabilities | ✓ | quick_actions + home widgets |
| PATCH /me/provider-mode | ✓✓ | **büyük bump** — home_layout + cert matrix + admission |
| POST /me/switch-active-role | ✓ | home_layout + pool filter |
| POST /me/certificates (upload) | ✗ | pending, admission değişmez |
| PATCH /me/certificates/{id} (resubmit) | ✗ | aynı |
| (Admin approve cert — PR 9) | ✓ | admission değişir |
| (Expiry cron) | ✓ | admission değişir |

### 5.3 Version bump atomicity
```python
async def bump_role_config_version(session, profile_id):
    await session.execute(
        update(TechnicianProfile)
        .where(TechnicianProfile.id == profile_id)
        .values(role_config_version=TechnicianProfile.role_config_version + 1)
    )
    await session.commit()
    # Redis invalidate eski key'lerden birini bilmiyoruz; TTL'e bırak (300s)
```

**Tünel görüş uyarısı:** Service layer `bump_role_config_version` bir utility fonksiyon olarak — her mutation endpoint'te MANUEL çağrılacak. Forget etmek **en yaygın hata**. Önerim: service layer'da `@with_role_bump` decorator pattern VEYA her mutation'ı `update_and_bump(profile_id, updates)` ortak helper'a çek.

---

## 6. Switch active role — hibrit semantik

### 6.1 Legal transition
```python
async def switch_active_role(session, profile_id, new_type: ProviderType):
    profile = await technician_repo.get(session, profile_id)
    legal = {profile.provider_type} | set(profile.secondary_provider_types)
    if new_type not in legal:
        raise InvalidActiveRoleError(f"{new_type} not in {legal}")
    # constraint DB'de de var ama service'te friendly error
    await session.execute(
        update(TechnicianProfile)
        .where(TechnicianProfile.id == profile_id)
        .values(active_provider_type=new_type)
    )
    await bump_role_config_version(session, profile_id)
```

### 6.2 Cross-endpoint etkisi
- **Havuz feed** (`/pool/feed` — PR 8): `WHERE active_provider_type = :tech_active_type` filter'ı kullanır. Multi-role kişi "şu an usta'yım" dediğinde çekici havuzu görmez.
- **Acil çekici dispatch** (tow): teknisyenin `active_provider_type='cekici'` olmalı (capability var + cert var + aktif cekici modunda).
- **Shell config**: home_layout + tab_set + quick_actions hepsi `active_provider_type`'dan türer.

**Tünel görüş uyarısı:** PR 8 `/pool/feed` yazılırken `active_provider_type` filter'ı unutulursa, multi-role usta + cekici hibrit kişi hep çift havuz görür. Invariant test §9'da zorunlu.

---

## 7. Atomic operations — 6 race noktası

### 7.1 PUT /me/coverage — atomic replace
```python
async with session.begin():
    await delete_all_domains(session, profile_id)
    await delete_all_procedures(session, profile_id)
    await delete_all_brand_coverage(session, profile_id)
    await delete_all_drivetrain_coverage(session, profile_id)
    await delete_all_procedure_tags(session, profile_id)
    await insert_bulk(session, profile_id, payload)
    await recompute_admission(session, profile_id)
    await bump_role_config_version(session, profile_id)
```

**Race:** İki paralel `PUT /me/coverage` (kullanıcı hızlı tap). Isolation: `SERIALIZABLE` veya `SELECT FOR UPDATE` on profile_id. Alternatif: idempotency key header.

### 7.2 PUT /me/service-area — upsert + replace districts
Aynı transaction pattern.

### 7.3 PUT /me/schedule — replace weekly slots
```sql
DELETE FROM technician_working_schedule WHERE profile_id = :id;
INSERT ... VALUES ... (yeni slots);
```
CHECK constraint: `close_time > open_time OR is_closed=true`.

### 7.4 POST /me/switch-active-role — optimistic UPDATE
```python
result = await session.execute(
    update(TechnicianProfile)
    .where(and_(
        TechnicianProfile.id == profile_id,
        or_(
            TechnicianProfile.provider_type == new_type,
            TechnicianProfile.secondary_provider_types.contains([new_type]),
        ),
    ))
    .values(active_provider_type=new_type)
    .returning(TechnicianProfile.id)
)
if result.scalar_one_or_none() is None:
    raise InvalidActiveRoleError(...)
```

### 7.5 PATCH /me/provider-mode — büyük transition
```python
async with session.begin():
    old_mode = profile.provider_mode
    await update_mode(session, profile_id, new_mode)
    admission_result = await recompute_admission(session, profile_id)
    if not admission_result.passed:
        await force_availability_offline(session, profile_id)
        # mobile notif intent publish: "Eksik cert var"
    await bump_role_config_version(session, profile_id)
```

### 7.6 Cert upload + admin approve cascade
Upload: status='pending' insert (race yok çünkü yeni row).
Approve (PR 9): transaction içinde recompute_verified_level + recompute_admission + bump + cache invalidate.

**Tünel görüş uyarısı:** Admin approve PR 9'da yazılacak ama invariant **burada** kilitlenir. PR 9 dev'i bu brief'e referans verecek.

---

## 8. Invariants — PR 4'e özel 12 kural

Backend invariants doc §16'ya ek, PR 4 spesifik:

**I-PR4-1.** `active_provider_type IS NULL` veya `active_provider_type ∈ ({provider_type} ∪ secondary_provider_types)` — constraint DB'de + service layer friendly error  
**I-PR4-2.** `provider_mode` mutate edilirken atomic transaction; eksik cert → `users.status='pending' + availability='offline'` FORCE  
**I-PR4-3.** Her mutation endpoint `bump_role_config_version` çağırır (tablo §5.2)  
**I-PR4-4.** `recompute_admission` her coverage/service-area/schedule/cert/provider-mode mutation sonrası çağrılır  
**I-PR4-5.** `required_cert_kinds` matrisi 12 kombinasyon değeri için frozenset döner — mutate edilemez  
**I-PR4-6.** Cert expiry: `has_valid_cert` = status='approved' AND (expires_at IS NULL OR expires_at > NOW())  
**I-PR4-7.** `PUT /me/coverage` atomic: 5 alt-tabloya delete+insert tek transaction  
**I-PR4-8.** `availability='available'` set edilebilmesi için `admission_gate_passed=true` — 409 aksi halde  
**I-PR4-9.** `role_config_version` monotonic — decrement yok, sadece increment  
**I-PR4-10.** Shell config cache key `{user_id}:{version}` — stale cache'e geri dönüş yok, sadece TTL fill  
**I-PR4-11.** `side_gig` provider_mode değeri **kabul edilmez** — 422 (V1 scope)  
**I-PR4-12.** `tow_operator` cert kind enum değeri migration'dan sonra **silinemez** — forward-only

---

## 9. Test senaryoları (zorunlu)

### 9.1 Cert matrix (12 kombinasyon)
`test_required_cert_kinds.py` — 12 test case, her biri:
- Given: `(provider_type, provider_mode)` tuple
- When: `required_cert_kinds(...)` çağrılır
- Then: beklenen frozenset döner

### 9.2 Admission recompute
- `test_admission_cekici_business_missing_tow_operator.py` — tow_operator yok → pending
- `test_admission_cekici_individual_missing_insurance.py` — insurance yok → pending
- `test_admission_usta_business_passes.py` — 3 cert approved → passed
- `test_admission_expired_cert_downgrades.py` — cert expires_at geçmiş → passed=false
- `test_admission_fails_forces_availability_offline.py` — fail sonrası availability='offline'

### 9.3 Shell config
- `test_shell_config_cekici_individual_returns_tow_focused.py`
- `test_shell_config_usta_business_returns_full.py`
- `test_shell_config_version_bump_invalidates_cache.py`
- `test_shell_config_cache_hit_on_same_version.py`

### 9.4 Switch active role
- `test_switch_to_secondary_role_succeeds.py`
- `test_switch_to_unlisted_role_rejects_422.py`
- `test_switch_bumps_version.py`

### 9.5 Coverage atomic
- `test_coverage_put_atomic_replace.py` — 5 alt-tablo tek transaction
- `test_coverage_put_partial_fail_rolls_back.py`
- `test_coverage_put_race_two_paralel.py` — serializable or idempotency

### 9.6 Provider mode transition
- `test_provider_mode_business_to_individual_cert_loss_pending.py`
- `test_provider_mode_individual_to_business_requires_more_certs.py`
- `test_provider_mode_side_gig_422.py`

**Toplam:** ~20 test dosyası. `pytest -v tests/` green zorunlu.

---

## 10. Red flag checklist (merge öncesi — §17 backend invariants doc'tan)

Dev commit öncesi kendi kendine geçer, PO merge öncesi aynı listeyi tekrar kontrol eder:

### 10.1 Ownership + PII
- [ ] Tüm `/me/*` endpoint'leri `CurrentTechnicianDep` kullanır
- [ ] Response'ta başka kullanıcının cert / coverage / profile'ı dönmüyor
- [ ] `GET /me/shell-config` response'u `user_id` leak etmiyor

### 10.2 State machine
- [ ] `provider_mode` transition için valid değerler (business/individual); side_gig 422
- [ ] `active_provider_type` constraint DB + service'te
- [ ] Cert status transition (pending→approved→rejected→expired) doğru enforce

### 10.3 Validation
- [ ] `@model_validator` gerekli — ör. coverage payload'da procedure_key taxonomy'de var mı
- [ ] 422 mesajları aksiyona yönlendirir ("scope alanı eksik" değil "Kapsam seçimi bekleniyor")

### 10.4 Audit + observability
- [ ] Her mutation → `append_event` (CaseEvent değil, AuthEvent veya yeni `TechnicianEvent`)
- [ ] Prometheus metric `technician_mutation_total{endpoint, status}`
- [ ] Switch active role → log

### 10.5 Race + concurrency
- [ ] `PUT /me/coverage` isolation (serializable veya SELECT FOR UPDATE)
- [ ] Optimistic UPDATE pattern'i switch-active-role'de
- [ ] Paralel cert upload race koruması (aynı `kind` için 2 pending kabul edilir mi?)

### 10.6 Capability + admission gates
- [ ] `admission_gate_passed=false` iken `availability='available'` → 409
- [ ] `provider-mode` değişince admission recompute cascade
- [ ] Force offline mekanizması çalışıyor

### 10.7 Schema parity
- [ ] Zod ↔ Pydantic `ShellConfig`, `TechnicianCoverage`, `ProviderMode` hepsi paralel
- [ ] `packages/domain/src/shell-config.ts` ↔ backend `app/schemas/shell_config.py` parity test

### 10.8 Cache
- [ ] Her mutation sonrası `bump_role_config_version` çağrısı var mı?
- [ ] Cache key `{user_id}:{version}` — wrong version'a fill yok

---

## 11. Sıralama — PR 4 içi adımlar

### Gün 1
1. Migration 0020 yaz (alembic revision + up/down + test up/down round-trip)
2. Cert matrix service yaz (`app/services/technician_admission.py`)
3. `bump_role_config_version` utility + cache helper
4. Unit test: cert matrix 12 kombinasyon

### Gün 2
5. Read endpoint'leri (`GET /me/profile`, `GET /me/certificates`, `GET /me/shell-config`)
6. Simple mutation endpoint'leri (PATCH /me/profile, /me/business, /me/availability, /me/capacity, /me/capabilities)
7. Integration test: shell_config build + cache hit/miss

### Gün 3
8. Complex mutation'lar: PUT /me/coverage, /me/service-area, /me/schedule (atomic replace)
9. Provider mode + switch active role (cascade mantığı)
10. Cert upload + resubmit
11. Test suite tam yeşil + ruff + mypy + schema parity
12. PR açık + self-review + merge için PO'ya ping

---

## 12. Referanslar

- [docs/backend-is-mantigi-hiyerarsi.md](backend-is-mantigi-hiyerarsi.md) — canonical umbrella, §17 red flags
- [docs/backend-rest-api-faz-a-brief.md §5](backend-rest-api-faz-a-brief.md#5-technicianscome--router-3-gün) — endpoint matris
- [docs/rol-ui-mimarisi-backend.md](rol-ui-mimarisi-backend.md) — cert matrix + shell config detay
- [docs/sinyal-hiyerarsi-mimari.md](sinyal-hiyerarsi-mimari.md) — admission gate 9 maddesi (§9)
- [packages/domain/src/shell-config.ts](../packages/domain/src/shell-config.ts) — Zod canonical
- [memory/role_ui_separation.md](/home/alfonso/.claude/projects/-home-alfonso-sanayi-app/memory/role_ui_separation.md) — PO locked kararlar
- [memory/backend_invariants.md](/home/alfonso/.claude/projects/-home-alfonso-sanayi-app/memory/backend_invariants.md) — invariant disiplin

---

## 13. PO merge kriterleri

Bu PR **merge edilmez** eğer:

1. Migration up/down round-trip test edilmemişse
2. Cert matrix 12 kombinasyon test green değilse
3. Shell config cache hit/miss test yoksa
4. `role_config_version` bump her mutation'da doğrulanmamışsa (§5.2 tablosu)
5. `active_provider_type` constraint testi yoksa (§9.4 `test_switch_to_unlisted_role_rejects_422`)
6. Schema parity (Zod↔Pydantic) test green değilse
7. Mypy + ruff temiz değilse (iddia değil, gerçekten)
8. Her cascade side-effect (§2'deki 30+ nokta) uygulamada test edilmemişse

PO spot-check: rastgele 3 mutation endpoint seçer, cascade zincirinin eksiksiz olduğunu grep eder.

---

**v1.0 — 2026-04-22** · PR 4 iş mantığı + invariant paketi · BACKEND-DEV zorunlu okuma
