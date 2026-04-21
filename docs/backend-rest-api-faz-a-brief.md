# Backend REST API Kapatma — Faz A Manifest

> **PO kaynak:** PRODUCT-OWNER · 2026-04-22
> **Hedef sohbet:** BACKEND-DEV (primary)
> **Kapsam:** Mobil-backend bağlantı günü için gereken **tüm domain endpoint'leri**. Service/repo katmanları büyük ölçüde hazır; bu brief **REST yüzeyini** kapatır.
> **Süre:** ~3 iş haftası (13-14 BE adam-günü, 8-9 atomik PR)
> **Durum öncesi:** audit P0-6 (REST endpoint eksik) + müşteri vaka contract brief + rol UI brief birlikte yürür; bu manifest onları **tek roadmap'te birleştirir**.

---

## 1. Context

Backend **mimari + veri modeli + service layer + state machines** production-ready seviyede. Ama `app/api/v1/router.py` şu an sadece 3 router include ediyor (auth + media + health — 10 endpoint). Müşteri ve usta app'leri mock'tan backend'e bağlanacağı gün **404 fırtınası** olur çünkü:

- Case submit endpoint'i ✓ yeni geldi (uncommitted, bu brief'le birlikte committed sayılır)
- **/offers, /appointments, /technicians, /vehicles, /insurance-claims, /pool, /reviews, /admin, /shell-config** — hepsi **boş**
- Service/repo hazır; sadece router katmanı yazılacak

Bu brief **router paketini atomik olarak kapatır**. Her PR 1-2 router + test'leri içerir, review kolay; büyük monolit PR yok.

---

## 2. Router kapsam matrisi

| # | Router | Endpoint sayısı | Service reuse | Yeni tablo | Süre |
|---|---|---|---|---|---|
| 1 | `/offers` | 5 | [offer_acceptance.py](../naro-backend/app/services/offer_acceptance.py) + [offer repo](../naro-backend/app/repositories/offer.py) | — | 1 gün |
| 2 | `/appointments` | 7 | [appointment_flow.py](../naro-backend/app/services/appointment_flow.py) | — | 1.5 gün |
| 3 | `/technicians/me/*` | 14 | [technician_kyc.py](../naro-backend/app/services/technician_kyc.py) + technician repo | **3 yeni kolon** (rol UI) + 1 migration | 3 gün |
| 4 | `/technicians/public/*` + `/taxonomy/*` | 7 | read-only queries + Redis cache | — | 1 gün |
| 5 | `/vehicles` | 7 | Vehicle + UserVehicleLink | **1 yeni kolon** (history_consent) + 1 migration | 1.5 gün |
| 6 | `/insurance-claims` | 6 | [insurance_claim_flow.py](../naro-backend/app/services/insurance_claim_flow.py) | — | 1 gün |
| 7 | `/pool` | 2 | [pool_matching.py](../naro-backend/app/services/pool_matching.py) + case repo | — | 0.5 gün |
| 8 | `/reviews` | 4 | yeni service | **1 yeni tablo** (reviews) + 1 migration | 1 gün |
| 9 | `/admin/*` | 15 | mevcut servisler + audit log | — | 2.5 gün |
| 10 | Ortak patterns (deps, error, pagination, rate limit) | — | — | — | 1 gün |

**Toplam:** 67 endpoint + 3 migration + ~13.5 gün. PR başı ~2 router → 8-9 PR.

---

## 3. `/offers` router (1 gün)

**Dosya:** `app/api/v1/routes/offers.py` (yeni) + include router.py'a

### 3.1 Endpoint tablosu

| Method | Path | Role | Body | Response |
|---|---|---|---|---|
| POST | `/offers` | technician | `OfferSubmitPayload` | `CaseOffer` 201 |
| GET | `/offers/case/{case_id}` | customer (case owner) or admin | — | `CaseOffer[]` |
| GET | `/offers/me` | technician | `?status_in=&cursor=&limit=20` | `CaseOffer[]` + cursor |
| POST | `/offers/{id}/accept` | customer (case owner) | — | `CaseOffer` + case updated |
| POST | `/offers/{id}/withdraw` | technician (offer owner) | `{reason?}` | 200 |

### 3.2 Business rules
- **submit:** case.status ∈ {matching, offers_ready}; technician.provider_type ∈ KIND_PROVIDER_MAP[case.kind]; technician.admission_gate_passed = true; ve **kind-bazlı cap** kontrolü (accident: 5, breakdown: 7, maintenance: 10, towing: 5). Cap dolu ise status='pending' ama shortlist dışı (PO kararı — [docs/bidding-cap-policy.md] ayrı; V1'de inline dokumente)
- **accept:** mevcut `accept_offer` service reuse (atomic firm/non-firm branching); sibling offers reject + case status → scheduled/appointment_pending
- **withdraw:** sadece pending/shortlisted offer withdrawable; accepted olanlar cancel appointment path'inden geçer

### 3.3 Validation + error
- submit: 422 if case.status invalid / admission fail / cap dolu (ama cap'te 200 + status='pending' shortlist dışı)
- accept: 409 `OfferAlreadyAcceptedError` (race); 403 if caller != case.customer
- withdraw: 403 if caller != offer.technician; 409 if offer not withdrawable

### 3.4 Test
- `test_offers_submit_happy.py`
- `test_offers_submit_provider_mismatch_rejects.py`
- `test_offers_accept_atomic_race.py` (iki paralel accept — §13.1 race pattern)
- `test_offers_cap_policy.py` (6. teklif cap dolu ise shortlist dışı)
- `test_offers_withdraw.py`

---

## 4. `/appointments` router (1.5 gün)

**Dosya:** `app/api/v1/routes/appointments.py`

### 4.1 Endpoint tablosu

| Method | Path | Role | Body | Response |
|---|---|---|---|---|
| POST | `/appointments` | customer | `AppointmentRequest` (direct request path — offer_accept'siz) | `Appointment` 201 |
| GET | `/appointments/case/{case_id}` | customer or assigned technician | — | `Appointment[]` |
| POST | `/appointments/{id}/approve` | technician (appointment.technician_id) | — | `Appointment` + case → scheduled |
| POST | `/appointments/{id}/decline` | technician | `{reason}` | `Appointment` + case → offers_ready |
| POST | `/appointments/{id}/cancel` | customer or admin | `{reason?}` | `Appointment` + case reverted |
| POST | `/appointments/{id}/counter-propose` | technician | `{new_slot}` | `Appointment` (status=counter_pending) |
| POST | `/appointments/{id}/confirm-counter` | customer | — | `Appointment` (approved) + case scheduled |
| POST | `/appointments/{id}/decline-counter` | customer | `{reason}` | `Appointment` (declined) + case offers_ready |

### 4.2 Business rules
- Source validation: `offer_accept` path `POST /offers/{id}/accept` içinden; `direct_request` yeni endpoint (POST /appointments); `counter` path counter_propose sonrası
- Race: appointment status guard `_get_pending` + `_get_counter_pending` mevcut ✓

### 4.3 Test
- `test_appointment_direct_request.py`
- `test_appointment_approve_flow.py`
- `test_appointment_decline_reverts_case.py`
- `test_appointment_counter_propose_confirm.py`
- `test_appointment_counter_decline.py`
- `test_appointment_cancel_by_customer.py`

---

## 5. `/technicians/me/*` router (3 gün)

**Dosya:** `app/api/v1/routes/technicians.py`

### 5.1 Profile endpoint'leri

| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/technicians/me/profile` | — | `TechnicianFullProfile` aggregate |
| PATCH | `/technicians/me/profile` | `{name?, tagline?, biography?, avatar_asset_id?, promo_video_asset_id?}` | updated |
| PATCH | `/technicians/me/business` | `{legal_name, tax_number, iban, phone, email, address, city, district}` | updated |
| PATCH | `/technicians/me/availability` | `{availability: available\|busy\|offline}` | updated |

### 5.2 Coverage + area + schedule + capacity (Faz 7 signal model)

| Method | Path | Body | Response |
|---|---|---|---|
| PUT | `/technicians/me/coverage` | `TechnicianCoverage` atomic replace | 200 + admission |
| PUT | `/technicians/me/service-area` | `{workshop_lat_lng, radius_km, city, primary_district, working_districts[]}` | 200 + admission |
| PUT | `/technicians/me/schedule` | `WeeklySchedule` | 200 + admission |
| PATCH | `/technicians/me/capacity` | Partial `StaffCapacity` | 200 |
| PATCH | `/technicians/me/capabilities` | Partial 4-boolean | 200 |

### 5.3 Certificate endpoint'leri

| Method | Path | Body | Response |
|---|---|---|---|
| POST | `/technicians/me/certificates` | `{kind, media_asset_id, title, expires_at?}` | `Certificate` 201 |
| GET | `/technicians/me/certificates` | — | `Certificate[]` |
| PATCH | `/technicians/me/certificates/{id}` | `{media_asset_id}` (resubmit after reject) | updated |

### 5.4 Rol UI endpoint'leri (rol-ui-mimarisi brief §4.5 entegrasyonu)

| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/technicians/me/shell-config` | — | `ShellConfig` (cache 300s, `X-Role-Config-Version` header) |
| POST | `/technicians/me/switch-active-role` | `{target_provider_type}` | `ShellConfig` (yeni version) |
| PATCH | `/technicians/me/provider-mode` | `{mode: business\|individual}` | `{role_config_version}` + onboarding triggered |

### 5.5 Yeni kolonlar (rol UI brief'e paralel — audit ile senkron)

Migration `20260423_00XX_technician_role_mode.py`:
```sql
CREATE TYPE provider_mode AS ENUM ('business', 'individual');
ALTER TABLE technician_profiles
  ADD COLUMN provider_mode provider_mode NOT NULL DEFAULT 'business',
  ADD COLUMN active_provider_type provider_type,
  ADD COLUMN role_config_version SMALLINT NOT NULL DEFAULT 1;
ALTER TYPE technician_certificate_kind ADD VALUE 'tow_operator';
```

### 5.6 Validation + business rules
- Her endpoint `current_user.role == technician` check
- `PUT /coverage` sonrası `recompute_admission` otomatik; migration ekler cert matrix (bkz. [docs/rol-ui-mimarisi-backend.md §4.3](rol-ui-mimarisi-backend.md#43-service-layer))
- `switch-active-role`: `target` primary veya secondary'den biri olmalı (constraint mevcut)
- Shell config cache key: `shell_config:{user_id}:{role_config_version}`

### 5.7 Test
- `test_technician_profile_crud.py`
- `test_technician_coverage_atomic_replace.py`
- `test_technician_admission_recompute.py`
- `test_technician_shell_config.py` (+ version bump)
- `test_technician_switch_active_role.py`
- `test_technician_certificate_upload_resubmit.py`

---

## 6. `/technicians/public/*` + `/taxonomy/*` router (1 gün)

**Dosya:** `app/api/v1/routes/technicians_public.py` + `app/api/v1/routes/taxonomy.py`

### 6.1 Public technician endpoint'leri

| Method | Path | Role | Response |
|---|---|---|---|
| GET | `/technicians/public/{id}` | any auth | `TechnicianPublicView` (phone/email yok, sadece vitrin) |
| GET | `/technicians/public/feed` | customer or technician | `?cursor=&limit=20` paginated feed |

**Feed sıralama:** aktif + admission_gate_passed + verified_level tier + bayesian_rating + location proximity (query'de `lat/lng` varsa). Sonra `completed_jobs_30d` ağırlıklı.

**Kullanım:** naro-app Çarşı ekranı + naro-service-app Anasayfa "Çevrendeki atölyeler".

### 6.2 Taxonomy endpoint'leri (Faz 7 signal model)

| Method | Path | Cache | Response |
|---|---|---|---|
| GET | `/taxonomy/service-domains` | 1h | list |
| GET | `/taxonomy/procedures?domain={key}` | 1h | list |
| GET | `/taxonomy/brands` | 1h | list |
| GET | `/taxonomy/districts?city={code}` | 1h | list |
| GET | `/taxonomy/drivetrains` | 1h | list |

**Cache:** Redis `taxonomy:{resource}:{filter}`, TTL 3600s.

### 6.3 Test
- `test_public_technician_masks_pii.py` (phone/email asla dönmez)
- `test_public_feed_pagination.py`
- `test_public_feed_filter_admission_gate.py` (pending teknisyen görünmez)
- `test_taxonomy_cache.py`

---

## 7. `/vehicles` router (1.5 gün)

**Dosya:** `app/api/v1/routes/vehicles.py`

### 7.1 Endpoint tablosu

| Method | Path | Role | Body | Response |
|---|---|---|---|---|
| POST | `/vehicles` | customer | `VehicleCreate` | `Vehicle` 201 + link |
| GET | `/vehicles/me` | customer | — | `Vehicle[]` with active links |
| GET | `/vehicles/{id}` | owner or admin | — | `Vehicle` + dossier summary |
| GET | `/vehicles/{id}/dossier` | owner or admin | — | `VehicleDossier` (case history + warranty) |
| PATCH | `/vehicles/{id}` | owner | `{current_km?, color?, note?, make?, model?, year?, fuel_type?}` | updated |
| DELETE | `/vehicles/{id}` | owner | — | soft delete 204 |
| POST | `/vehicles/{id}/history-consent` | owner | `{granted: bool}` | updated |

### 7.2 Yeni kolon (audit P1-1)

Migration `20260423_00XX_vehicle_history_consent.py`:
```sql
ALTER TABLE vehicles
  ADD COLUMN history_consent_granted BOOL NOT NULL DEFAULT FALSE,
  ADD COLUMN history_consent_granted_at TIMESTAMPTZ,
  ADD COLUMN history_consent_revoked_at TIMESTAMPTZ;
```

Dossier endpoint history consent kontrolü yapar; grant yoksa anonymized data döner.

### 7.3 Business rules
- Plate uniqueness + normalization (mevcut)
- UserVehicleLink zamansal (ownership_from/to); soft delete → active link ownership_to = now()
- Transfer V2'ye (bu brief kapsam dışı)

### 7.4 Test
- `test_vehicle_create_with_link.py`
- `test_vehicle_plate_uniqueness.py`
- `test_vehicle_dossier_respects_consent.py`
- `test_vehicle_soft_delete_closes_link.py`
- `test_vehicle_history_consent_grant_revoke.py`

---

## 8. `/insurance-claims` router (1 gün)

**Dosya:** `app/api/v1/routes/insurance_claims.py`

### 8.1 Endpoint tablosu

| Method | Path | Role | Body | Response |
|---|---|---|---|---|
| POST | `/insurance-claims` | customer (case owner) | `ClaimSubmitPayload` | `Claim` 201 |
| GET | `/insurance-claims/case/{case_id}` | case owner or assigned tech or admin | — | `Claim[]` |
| GET | `/insurance-claims/{id}` | claim owner or admin | — | `Claim` |

### 8.2 Admin endpoint'leri (`/admin/` router §10'da)
- `PATCH /admin/insurance-claims/{id}/accept` — accepted_amount
- `PATCH /admin/insurance-claims/{id}/reject` — reason
- `PATCH /admin/insurance-claims/{id}/mark-paid` — paid_amount

### 8.3 Business rules
- Submit: case.kind='accident' olmalı; case'de zaten aktif claim var mı (partial unique mevcut — `ClaimAlreadyActiveError` → 409)
- Admin transitions: mevcut `_transition` guard reuse

### 8.4 Test
- `test_insurance_claim_submit_happy.py`
- `test_insurance_claim_duplicate_active_409.py`
- `test_insurance_claim_admin_flow.py` (accept → mark-paid)
- `test_insurance_claim_wrong_kind_422.py`

---

## 9. `/pool` router (0.5 gün)

**Dosya:** `app/api/v1/routes/pool.py`

### 9.1 Endpoint tablosu

| Method | Path | Role | Response |
|---|---|---|---|
| GET | `/pool/feed` | technician (admission_gate_passed) | `?cursor=&limit=20` paginated PoolCase feed |
| GET | `/pool/case/{id}` | technician | `PoolCaseDetail` (müşteri PII maskelenmiş) |

### 9.2 Business rules
- `list_pool_cases` service çağrısı güncelle: `active_provider_type` + `admission_gate_passed=true` filter
- Havuz detay: kind='accident' VE status='matching' ise dosya detayı + sigorta beyan kartı (claim yoksa anonim)

### 9.3 Test
- `test_pool_feed_only_active_technicians.py`
- `test_pool_feed_respects_active_role.py`
- `test_pool_case_detail_masks_customer_pii.py`

---

## 10. `/reviews` router (1 gün)

**Dosya:** `app/api/v1/routes/reviews.py` + yeni model + migration

### 10.1 Yeni tablo

Migration `20260423_00XX_reviews.py`:
```sql
CREATE TABLE reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL REFERENCES service_cases(id) ON DELETE RESTRICT,
    reviewer_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    reviewee_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    body TEXT,
    response_body TEXT,
    responded_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (case_id, reviewer_user_id)
);
CREATE INDEX ix_reviews_reviewee ON reviews (reviewee_user_id, created_at DESC);
```

### 10.2 Endpoint tablosu

| Method | Path | Role | Body | Response |
|---|---|---|---|---|
| POST | `/reviews` | customer (case owner) | `{case_id, rating, body?}` | `Review` 201 |
| GET | `/reviews/technician/{id}` | any auth | `?cursor=&limit=20` | `Review[]` with reviewer masked |
| GET | `/reviews/me` | any | — | own reviews |
| POST | `/reviews/{id}/response` | technician (reviewee) | `{response_body}` | updated (V2 — opsiyonel) |

### 10.3 Business rules
- Case.status = 'completed' olmalı
- 1 review per case per reviewer (UNIQUE)
- Reviewee = case.assigned_technician_id
- Public liste: reviewer_name anonim ("M.K.") + avatar'sız

### 10.4 Test
- `test_review_create_only_completed.py`
- `test_review_duplicate_per_case.py`
- `test_review_technician_listing_masks_pii.py`

---

## 11. `/admin/*` router (2.5 gün)

**Dosya:** `app/api/v1/routes/admin.py`

### 11.1 Technician approval

| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/admin/technicians?status=pending&cursor=&limit=20` | — | `Technician[]` waiting |
| POST | `/admin/technicians/{id}/approve` | `{note?}` | updated (status='active') |
| POST | `/admin/technicians/{id}/reject` | `{reason}` | updated (status='rejected') |
| POST | `/admin/technicians/{id}/suspend` | `{reason, until?}` | updated |

### 11.2 Certificate review

| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/admin/certificates?status=pending` | — | list |
| PATCH | `/admin/certificates/{id}/approve` | — | updated + recompute_verified_level |
| PATCH | `/admin/certificates/{id}/reject` | `{reviewer_note}` | updated |

### 11.3 Insurance claims admin

| Method | Path | Body |
|---|---|---|
| GET | `/admin/insurance-claims?status=submitted` | — |
| PATCH | `/admin/insurance-claims/{id}/accept` | `{accepted_amount}` |
| PATCH | `/admin/insurance-claims/{id}/reject` | `{reason}` |
| PATCH | `/admin/insurance-claims/{id}/mark-paid` | `{paid_amount?}` |

### 11.4 Case + user override

| Method | Path | Body |
|---|---|---|
| POST | `/admin/cases/{id}/override` | `{new_status, reason}` (son çare) |
| POST | `/admin/users/{id}/suspend` | `{reason, until?}` |
| POST | `/admin/users/{id}/unsuspend` | — |
| GET | `/admin/audit-log?from=&to=&action=` | admin aksiyon audit log |

### 11.5 Business rules
- Role = admin (new dep `CurrentAdminDep`)
- Her admin aksiyon **audit event log** + Prometheus metric `admin_action_total{action}`
- Case override: mevcut `ALLOWED_TRANSITIONS` dışına çıkabilir; audit zorunlu, reason zorunlu

### 11.6 Test
- `test_admin_technician_approval_transitions_pending_to_active.py`
- `test_admin_certificate_approve_recomputes_verified_level.py`
- `test_admin_insurance_claim_full_flow.py`
- `test_admin_case_override_audit_trail.py`
- `test_admin_requires_admin_role.py` (non-admin 403)

---

## 12. Ortak pattern'ler (1 gün)

Tüm router'larda tutarlı olacak ortak altyapı:

### 12.1 Role dependencies

`app/api/v1/deps.py` genişletme:
```python
CurrentCustomerDep = Annotated[User, Depends(require_customer)]
CurrentTechnicianDep = Annotated[User, Depends(require_technician_active)]
CurrentAdminDep = Annotated[User, Depends(require_admin)]
CaseOwnerDep = Annotated[ServiceCase, Depends(require_case_owner)]
```

### 12.2 Error contract (reuse)

[docs/musteri-vaka-olusturma-backend-contract.md §7](musteri-vaka-olusturma-backend-contract.md#7-error-contract)'de tanımlı; genişlet:
- 422 ValidationError (kind/constraint/conditional)
- 409 ConflictError (duplicate, state race)
- 403 ForbiddenError (ownership fail)
- 410 Gone (already accepted / resource state change)

### 12.3 Pagination (cursor-based)

```python
class PaginatedResponse(BaseModel, Generic[T]):
    items: list[T]
    next_cursor: str | None
```

Query: `?cursor=<opaque>&limit=<1-50>`. Tüm liste endpoint'leri aynı pattern.

### 12.4 Rate limiting

Redis token bucket; endpoint başı limit:
- POST mutate endpoint'leri: 30/dk/user
- GET read endpoint'leri: 300/dk/user
- Admin endpoint'leri: 60/dk/admin
- Taxonomy: 1000/dk/ip (read-only, cache-heavy)

### 12.5 Observability

Her endpoint için:
- `http_request_duration_seconds{route, status, method}`
- `http_request_total{route, status, method}`
- Structured log: request_id + user_id + route + status + duration + payload_size

### 12.6 Zod ↔ Pydantic parity

Schema değişen her endpoint için parity test (bkz. [müşteri contract §11.2](musteri-vaka-olusturma-backend-contract.md#111-single-source-of-truth)). CI'da zorunlu.

---

## 13. Concurrency + race edge case'leri (yeni her endpoint için düşünülmeli)

Audit §5.3'te Offer accept race bahsi var. Her router aynı disiplin:

| Endpoint | Race senaryosu | Koruma |
|---|---|---|
| POST /offers/{id}/accept | İki paralel accept aynı offer için | `UPDATE ... WHERE status IN ('pending','shortlisted') RETURNING` — etkilenen 0 → 410 |
| POST /appointments/{id}/approve | İki paralel approve | `_get_pending` guard + optimistic UPDATE |
| POST /vehicles | Plate race (aynı anda iki kullanıcı aynı plaka) | partial unique index + IntegrityError → 409 |
| PUT /coverage | İki paralel replace | transaction isolation `REPEATABLE READ` veya `SELECT FOR UPDATE` profile_id |
| POST /reviews | İki paralel review aynı case | partial unique + IntegrityError |
| POST /admin/technicians/{id}/approve | İki admin paralel approve | idempotent — zaten active ise 200 no-op |

---

## 14. Pipelines / sıralama

### 14.1 PR stratejisi — 9 atomik PR

1. **PR 1:** Ortak deps + error contract + pagination pattern (§12) — 1 gün
2. **PR 2:** `/offers` + testler — 1 gün
3. **PR 3:** `/appointments` + testler — 1.5 gün
4. **PR 4:** `/technicians/me/*` + migration (provider_mode + tow_operator) + testler — 3 gün
5. **PR 5:** `/technicians/public/*` + `/taxonomy/*` + cache — 1 gün
6. **PR 6:** `/vehicles` + migration (history_consent) + testler — 1.5 gün
7. **PR 7:** `/insurance-claims` + admin claim endpoint'leri — 1 gün
8. **PR 8:** `/pool` + `/reviews` + reviews migration — 1.5 gün
9. **PR 9:** `/admin/*` (technician + cert + case + user) + audit log + testler — 2.5 gün

**Her PR:** kendi migration'ı + test suite + typecheck + lint + mypy temiz; merge sonrası deploy otomatik (CI hazırsa).

### 14.2 Paralel FE iş (başka sohbet)
FE dev Faz D (wire-up) bu brief'teki endpoint'leri **PR merge edildikçe** tüketir:
- `/shell-config` → rol UI shell (PR 4 sonrası)
- `/offers/*` + `/appointments/*` → teklif & randevu flow (PR 2-3 sonrası)
- `/vehicles/*` → araç ekleme (PR 6 sonrası)
- `/pool/feed` → usta havuz (PR 8 sonrası)
- `/reviews/technician/{id}` → Çarşı profil detay (PR 8)

---

## 15. Acceptance criteria

### 15.1 Endpoint kapsamı
- [ ] 67 endpoint router.py'da include edilmiş (auth + media + health + **9 yeni router**)
- [ ] Her endpoint OpenAPI doc otomatik (FastAPI default)
- [ ] 3 migration up/down idempotent

### 15.2 Test kapsamı
- [ ] Her router için **min 3 happy + 2 sad path** test (~55 test toplam)
- [ ] Race senaryoları (§13): ofer accept, vehicle plate, review duplicate test edilmiş
- [ ] Schema parity test (Zod ↔ Pydantic) CI green

### 15.3 Non-functional
- [ ] `ruff check . && mypy app/ && pytest` **hepsi yeşil** (iddia değil gerçekten)
- [ ] Prometheus metric tüm endpoint'ler için export ediliyor
- [ ] Rate limit aktif (§12.4)
- [ ] Pagination cursor-based her liste endpoint'te

### 15.4 Audit bağları
- [ ] P0-6 (REST endpoint eksik) → kapandı ✓
- [ ] P0-3 (pool admission gate) → `/pool/feed` filter'da uygulandı
- [ ] P0-2 (offer accept race) → `mark_accepted WHERE status IN...` pattern
- [ ] P1-1 (vehicle history consent) → migration + endpoint
- [ ] P1-5 (test coverage) → ~55 yeni test, toplam %50+ hedefi

---

## 16. Out of scope (V2 / sonraki iterasyonlar)

- **`/cases/drafts/*`** (taslak kaydetme) — ayrı brief gelecek
- **FCM/APNs delivery** — notification_intents tablosu var, worker Faz 12'ye
- **WebSocket'ler** (tow dışında) — genel case live update V2
- **Financial ledger / komisyon hesaplama servisi** — ayrı brief (Iyzico production + billing)
- **Vehicle transfer** endpoint'i — V2
- **Review response** endpoint'i (teknisyen cevap) — V2 (schema hazır ama endpoint opsiyonel)
- **Matching motoru skor fonksiyonu** — Faz 8 (signal matrix tamamlandıktan sonra)

---

## 17. Referanslar

- [docs/audits/2026-04-21-backend-audit.md](audits/2026-04-21-backend-audit.md) — P0-P1 kaynak
- [docs/musteri-vaka-olusturma-backend-contract.md](musteri-vaka-olusturma-backend-contract.md) — cases endpoint (PR'ı önceden geldi; bu brief'in zaten bir parçası)
- [docs/rol-ui-mimarisi-backend.md](rol-ui-mimarisi-backend.md) — shell-config + provider_mode + cert matrix detay
- [docs/cekici-backend-mimarisi.md](cekici-backend-mimarisi.md) — tow endpoint'leri (Faz 10 committed; bu brief'e dahil değil ama reference)
- [docs/media-upload-brief.md](media-upload-brief.md) — media endpoint'leri mevcut
- [naro-backend/app/services/](../naro-backend/app/services/) — service layer reuse kaynak
- [naro-backend/app/repositories/](../naro-backend/app/repositories/) — repository layer reuse kaynak

---

## 18. PO takip

Bu brief yürürken:
- **Ben (PO):** Her PR için review — schema parity + kind validation + admission gate + rate limit disiplini + test senaryosu kapsamı kontrol. BE'ye geri bildirim.
- **Faz yürütme** ~3 hafta (13.5 gün BE) — buffer: hastalık/bug/unexpected ~+3 gün. Gerçekçi ETA: **3.5 hafta**.
- **PR merge sonrası mobil wire-up** FE sohbetinde başlar; taslak kaydetme brief'i Faz A bitmeden FE'ye gitmez (dependency).

Bu manifest bittikten sonra backend canlıya **%80 hazır** olur; geriye Iyzico production + hukuki + infra + beta kalır.

---

**Son güncellenme:** 2026-04-22 · Backend REST API Kapatma Faz A · BACKEND-DEV implementation manifest
