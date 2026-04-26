# `case_dossier` API Contract — Vaka Servisi Tek Sözleşmesi

**Tarih:** 2026-04-26
**Faz:** Plan §4 Faz 3 — `case_dossier` API contract
**Bağlam:** [naro-vaka-omurgasi.md §2.1](naro-vaka-omurgasi.md) (vaka servisi tek sözleşmesi) + [naro-domain-glossary.md §1](naro-domain-glossary.md) (`case_dossier` API/system, `case_profile` UI ekran adı) + [case-refactor-plan-2026-04-26.md §4.1](case-refactor-plan-2026-04-26.md)
**Statü:** Spec — uygulama öncesi PO onayı bekliyor

---

## 1. Amaç

Vaka detayını **müşteri app, servis app ve backend** aynı sözleşmeden okumalı. Şu an FE/BE drift var: customer detail response, pool detail, jobs api ayrı şekiller döndürüyor. Bu contract:

- **Tek canonical response:** `CaseDossierResponse`
- **Tek endpoint:** `GET /cases/{case_id}/dossier`
- **Role-safe redaction:** Aynı response, üç farklı redaction profili (customer / pool-technician / assigned-technician)
- **Vaka profil sayfası FE'sinin tek besin kaynağı** — anlatı §2.1'in koddaki gerçekleşmesi

`case_profile` (UI ekran adı) `case_dossier` response'unu render eder. İkisi farklı katman (sözlük §1).

---

## 2. Endpoint

```
GET /cases/{case_id}/dossier
```

**Auth:** `CurrentUserDep` (customer veya technician)

**Yetki matrisi:**
| Rol koşulu | Görür | Redaction profili |
|---|---|---|
| `case.customer_user_id == user.id` | full | `customer` |
| `user.role == TECHNICIAN` ve havuzda görebilir (pool_matching kuralları) | restricted | `pool_technician` (PII redacted) |
| `user.role == TECHNICIAN` ve `case.assigned_technician_id == user.id` | extended | `assigned_technician` (genişletilmiş, PII saklı) |
| Diğer | 404 | — |

**Hata kodları:**
- 404 `case_not_found` — case yok veya `deleted_at` set
- 403 değil 404 (yetkisiz user için): bilgi sızdırma yok

---

## 3. Response Schema

`naro-backend/app/schemas/case_dossier.py` (yeni):

### 3.1 Üst seviye

```python
class CaseDossierResponse(BaseModel):
    shell: CaseShellSection
    vehicle: VehicleSnapshotSection
    kind_detail: KindDetailSection  # union typed by kind
    attachments: list[CaseAttachmentSummary]
    evidence: list[CaseEvidenceSummary]
    documents: list[CaseDocumentSummary]
    matches: list[MatchSummary]
    notifications: list[NotificationSummary]
    offers: list[OfferSummary]
    appointment: AppointmentSummary | None
    assignment: AssignmentSummary | None
    approvals: list[ApprovalSummary]
    payment_snapshot: PaymentSnapshot
    tow_snapshot: TowSnapshot | None  # yalnız kind=TOWING
    timeline_summary: list[TimelineEventSummary]  # son N event (default 20)
    viewer: ViewerContext  # current user perspective
```

### 3.2 Bölüm tanımları

**`CaseShellSection`** (sözlük §1 + ServiceCase modeli):
```python
id: UUID
kind: ServiceRequestKind
status: ServiceCaseStatus
urgency: ServiceRequestUrgency
origin: CaseOrigin
title: str
subtitle: str | None
summary: str | None
location_label: str | None  # redacted by profile
wait_state: CaseWaitState  # actor + label + description (mevcut alanlar)
created_at: datetime
updated_at: datetime
closed_at: datetime | None
```

**`VehicleSnapshotSection`** (subtype `_VehicleSnapshotMixin`'den):
```python
plate: str         # PROFILE: pool_technician → mask "34*** AB12"; diğerlerinde clear
make: str | None
model: str | None
year: int | None
fuel_type: str | None
vin: str | None    # PROFILE: pool_technician → None; diğerlerinde clear
current_km: int | None
```

**`KindDetailSection`** — discriminated union (`kind` field'a göre):
- `kind=ACCIDENT` → `AccidentDetail` (damage_area, severity, accident_report_method, ...)
- `kind=BREAKDOWN` → `BreakdownDetail` (breakdown_category, runnability, semptom, ...)
- `kind=MAINTENANCE` → `MaintenanceDetail` (maintenance_category, intent, ...)
- `kind=TOWING` → `TowingDetail` (tow_mode, scheduled_at, pickup/dropoff label) — `tow_snapshot`'tan ayrı

**`MatchSummary`** (case_matching service'tan):
```python
id: UUID
technician_user_id: UUID  # PROFILE: pool_technician → kendi user_id ise dolu, yoksa anonim
score: Decimal
reason_label: str  # "Bu vaka türüne ve ilçeye uygun"
match_badge: str   # "Bu vakaya uygun"
visibility_state: CaseTechnicianMatchVisibility
```

**`NotificationSummary`** (case_matching notification):
```python
id: UUID
technician_user_id: UUID  # PROFILE: pool/assigned → kendi notification ise dolu
status: CaseTechnicianNotificationStatus
created_at: datetime
seen_at: datetime | None
responded_at: datetime | None
```

**`OfferSummary`** (mevcut CaseOffer):
```python
id: UUID
technician_user_id: UUID  # PROFILE: pool_technician → kendi offer'ı dolu, diğerleri anonim_initials
amount: Decimal | None    # PROFILE: pool_technician → yalnız kendi offer'ında dolu; rakipler için None
currency: str
status: CaseOfferStatus
slot_proposal: dict | None
created_at: datetime
```

> **Rakip offer amount masking:** Pool-technician rakip teklif tutarlarını **doğrudan görmez** ama **ortalamayı** görür (`viewer.competitor_offer_average`). Rekabetçi ortam korunur, dipping (lowballing) zorlaşır.

**`AppointmentSummary`**:
```python
id: UUID | None
status: AppointmentStatus
slot: dict
slot_kind: AppointmentSlotKind
source: AppointmentSource  # offer_accept canonical
counter_proposal: dict | None
expires_at: datetime | None
```

**`AssignmentSummary`** (case.assigned_technician_id varsa):
```python
technician_user_id: UUID
technician_display_name: str  # PROFILE: pool → masked initials
accepted_offer_id: UUID | None  # eşleşme kaynağı
assigned_at: datetime
```

**`ApprovalSummary`**:
```python
id: UUID
kind: CaseApprovalKind  # parts_request | invoice | completion
title: str
description: str | None
amount: Decimal | None
currency: str
status: CaseApprovalStatus
payment_state: CaseApprovalPaymentState
created_at: datetime
```

**`PaymentSnapshot`** (`case.billing_state` + payment_orders aggregate):
```python
billing_state: BillingState | None
estimate_amount: Decimal | None
total_amount: Decimal | None
preauth_held: Decimal | None
captured: Decimal | None
refunded: Decimal | None
last_event_at: datetime | None
```

**`TowSnapshot`** (yalnız kind=TOWING — TowCase'den):
```python
tow_mode: TowMode
tow_stage: TowDispatchStage
scheduled_at: datetime | None
pickup_label: str | None    # PROFILE: pool → mask "İstanbul, Beşiktaş" → "Beşiktaş"
dropoff_label: str | None   # PROFILE: pool → mask
quote: dict | None          # tow_fare_quote
preauth_amount: Decimal | None
captured_amount: Decimal | None
```

**`TimelineEventSummary`** (case_audit'tan):
```python
id: UUID
event_type: CaseEventType
title: str
tone: CaseTone
actor_user_id: UUID | None  # PROFILE: pool → masked
context_summary: str | None
occurred_at: datetime
```

**`ViewerContext`** (current user perspective):
```python
role: ViewerRole  # customer | pool_technician | assigned_technician
is_matched_to_me: bool
match_reason_label: str | None
match_badge: str | None
is_notified_to_me: bool
has_offer_from_me: bool
can_send_offer: bool                       # pool_technician + havuz açık + terminal değil
can_notify_to_me: bool                     # customer perspective: keşif → bildir
other_match_count: int                     # pool: kendi match'i hariç görünmeyen match sayısı
competitor_offer_average: Decimal | None   # pool: kendi offer hariç PENDING/SHORTLISTED/ACCEPTED offer'ların ortalaması
competitor_offer_count: int                # pool: kaç rakip aktif teklif var
```

---

## 4. Redaction Matrisi

| Alan | customer | pool_technician | assigned_technician |
|---|---|---|---|
| `vehicle.plate` | clear | mask `34*** AB12` | clear |
| `vehicle.vin` | clear | None | clear |
| `shell.location_label` | clear | district-level (sokak adı yok) | clear |
| `tow_snapshot.pickup_address` | clear | None (yalnız label) | clear |
| `customer iletişim` (telefon/email) | dossier'da yok | yok | yok (mesajlaşma threadinde) |
| `matches[*].technician_user_id` | tüm — düşük skorlular HIDDEN olabilir | yalnız kendi match'i (diğerleri filtered out) | tüm |
| `offers[*].technician_user_id` | tüm | yalnız kendi offer'ı (diğerleri masked initials) | tüm |
| `offers[*].amount` | clear (tüm offer'lar) | yalnız kendi offer'ı clear; rakipler `None` | clear (tüm offer'lar) |
| `viewer.competitor_offer_average` | `None` (gereksiz) | clear (Decimal — rakip ortalaması) | `None` |
| `viewer.competitor_offer_count` | `0` | rakip sayısı | `0` |
| `assignment.technician_display_name` | full name | initials | full name |

**Redaction servisi:** `naro-backend/app/services/case_dossier_redact.py` — tek dosya, role-bazlı transform. Helper olarak `mask_reviewer_name` (review.py:56) reuse edilir.

---

## 5. Servis Akışı

`naro-backend/app/services/case_dossier.py` (yeni):

```python
async def assemble_dossier(
    session: AsyncSession,
    *,
    case_id: UUID,
    viewer_user_id: UUID,
    viewer_role: UserRole,
) -> CaseDossierResponse:
    # 1) Case + subtype yükle (case_repo.get_case_with_subtype)
    # 2) Yetki tespiti: customer / assigned / pool / 404
    # 3) Paralel yüklemeler (asyncio.gather):
    #    - matches (case_technician_matches WHERE case_id)
    #    - notifications (case_technician_notifications WHERE case_id)
    #    - offers (case_offers WHERE case_id)
    #    - appointment (active appointment WHERE case_id)
    #    - approvals (case_approvals WHERE case_id)
    #    - payment_snapshot (payment_orders aggregate + case.billing_state)
    #    - timeline (case_events son 20)
    #    - tow_case (kind=TOWING ise)
    # 4) viewer perspective: case_matching.context_for_cases([case_id], viewer_user_id)
    # 5) Redaction: profile_for(role, viewer_user_id, case) → transform sections
    # 6) CaseDossierResponse.model_validate(...)
```

**Reuse edilen mevcut servisler:**
- `case_repo.get_case_with_subtype` — case + subtype tek query
- `case_matching.context_for_cases` — match/notification/offer flag'leri (technician perspective)
- `mask_reviewer_name` (review.py:56) — initials masking
- payment_core / case_billing'den payment aggregate (yeni helper)

---

## 6. Endpoint dosyası

`naro-backend/app/api/v1/routes/case_dossier.py` (yeni):

```python
router = APIRouter(prefix="/cases", tags=["case-dossier"])

@router.get(
    "/{case_id}/dossier",
    response_model=CaseDossierResponse,
    summary="Vaka dosyası — role-safe canonical contract",
)
async def get_case_dossier(
    case_id: UUID,
    user: CurrentUserDep,
    db: DbDep,
) -> CaseDossierResponse:
    try:
        return await case_dossier.assemble_dossier(
            db, case_id=case_id, viewer_user_id=user.id, viewer_role=user.role
        )
    except case_dossier.CaseNotFoundError:
        raise HTTPException(404, {"type": "case_not_found"})
    except case_dossier.NotPermittedError:
        raise HTTPException(404, {"type": "case_not_found"})  # 403 değil
```

`app/api/v1/__init__.py`'a router register edilir.

---

## 7. Pure Test Plan

`naro-backend/tests/test_case_dossier_pure.py` (yeni):

```
test_customer_sees_full_dossier_for_own_case
test_other_customer_gets_404
test_pool_technician_sees_pii_redacted
test_pool_technician_sees_only_own_match_in_matches_list
test_assigned_technician_sees_extended_with_pii_safe_customer_info
test_kind_towing_includes_tow_snapshot
test_kind_maintenance_excludes_tow_snapshot
test_match_visibility_hidden_filtered_for_pool_technician
test_offer_amount_visible_to_customer_masked_to_pool_competitors
test_terminal_case_dossier_returns_with_closed_at_set
test_soft_deleted_case_returns_404
test_viewer_context_can_send_offer_false_when_terminal
test_viewer_context_can_send_offer_true_for_pool_technician_open_case
```

13 test. Hepsi pure (factories + AsyncSession fixture).

---

## 8. Migration / Schema değişikliği

**Yok.** Bu faz veri modeli değiştirmez — yalnız okuma katmanı (read assembly + redaction).

Mevcut tablolar yeterli: `service_cases`, `case_technician_matches`, `case_technician_notifications`, `case_offers`, `appointments`, `case_approvals`, `payment_orders`, `case_events`, `tow_cases`, subtype tables.

---

## 9. FE Bağlama (Codex sonraki dilim)

### Customer app
- `naro-app/src/features/cases/screens/CaseProfileScreen.tsx` — mevcut, refactor
- `useCanonicalCase` hook → `useCaseDossier(caseId)` ile değiştir veya genişlet
- Zod: `CaseDossierResponseSchema` `packages/domain/src/case_dossier.ts` (yeni)

### Service app
- `naro-service-app/src/features/cases/screens/CaseProfileScreen.tsx` — mevcut, refactor
- Aynı Zod (paylaşılan domain)

### Vaka profil sayfası UI bölümleri (anlatı §2.1):
- Üst: vaka özeti + araç snapshot (header card)
- Orta: gelen teklifler + matches (customer için "Bu vakaya uygun ustalar")
- Alt: süreç/timeline (eşleşme sonrası); appointment + approvals
- Sağ aksiyon: customer için "Bu ustaya bildir" CTA (notify); technician için "Teklif gönder" CTA

---

## 10. Critical Files

**Yeni dosyalar:**
- `naro-backend/app/schemas/case_dossier.py` — Pydantic response model
- `naro-backend/app/services/case_dossier.py` — assembly logic
- `naro-backend/app/services/case_dossier_redact.py` — role-bazlı transform
- `naro-backend/app/api/v1/routes/case_dossier.py` — endpoint
- `naro-backend/tests/test_case_dossier_pure.py` — 13 pure test
- `packages/domain/src/case_dossier.ts` — FE Zod schema (Codex Faz 3 FE)

**Değişen mevcut dosyalar:**
- `naro-backend/app/api/v1/__init__.py` — router register

**Reuse edilen (dokunulmayan):**
- `naro-backend/app/repositories/case.py:get_case_with_subtype`
- `naro-backend/app/services/case_matching.py:context_for_cases`
- `naro-backend/app/schemas/review.py:mask_reviewer_name`

---

## 11. Doğrulama

```bash
# Pure test
cd naro-backend && uv run pytest tests/test_case_dossier_pure.py -v

# Lint
uv run ruff check app/schemas/case_dossier.py app/services/case_dossier.py app/api/v1/routes/case_dossier.py

# Smoke (TestClient ile)
# 3 ayrı user ile aynı case_id'ye GET /dossier:
#   customer → full
#   pool_technician → PII redacted
#   assigned_technician → extended
```

**Kabul kriterleri:**
- 20 pure test PASS (13 ana + 7 offer amount/competitor average)
- 3 rolde aynı case → 3 farklı redacted response
- Pool-technician ekranında: kendi offer amount clear, rakipler `None`, `competitor_offer_average` Decimal döner
- Naming: response field'ları sözlük §1 + §11 uyumlu
- Mevcut endpoint'ler (PoolCaseDetail, customer case_detail) bozulmadan koşulur (yeni dossier paralel; eski'leri Faz 6'da deprecate)

---

## 12. Süre + Sıralama

| Adım | Süre |
|---|---|
| Schema dosyası (`case_dossier.py`) | 30dk |
| Redaction service | 20dk |
| Assemble service | 40dk |
| Endpoint + router | 10dk |
| 13 pure test | 30dk |
| **Toplam BE** | **~2-2.5 saat** |

Codex Faz 1 artıkları (~1sa) bittikten sonra → bu spec onaylanmışsa → Codex direkt impl'e başlayabilir.

FE bağlama (Codex Faz 3 FE dilimi) ayrı: `CaseProfileScreen` refactor + Zod + hook, ~2sa daha.

---

## 13. Ürün Kararları (Onaylı — 2026-04-26)

1. ✅ **Match visibility filter:** Pool-technician yalnız kendi match'ini görür; diğerleri filtered out. `viewer.other_match_count` rakip sayısını taşır.
2. ✅ **Offer amount masking — rekabetçi ortam + dipping önleme:** Pool-technician rakip teklif tutarlarını **doğrudan görmez** ama **ortalamayı görür** (`viewer.competitor_offer_average`). Plus `viewer.competitor_offer_count` rakip aktif teklif sayısını taşır. Customer + assigned_technician tüm tutarları clear görür.
3. ✅ **Timeline event detail:** Pool-technician için yalnız `STATUS_UPDATE` + kendi `CASE_NOTIFICATION_SENT` event'leri + son N (default 20) görünür. Customer + assigned_technician tüm event'leri görür.

### Implementasyon notu — `compute_competitor_offer_average`

`assemble_dossier` içinde pool-technician profili için:

```python
def compute_competitor_offer_average(
    offers: list[CaseOffer],
    viewer_user_id: UUID,
) -> tuple[Decimal | None, int]:
    competitors = [
        o for o in offers
        if o.technician_id != viewer_user_id
        and o.status in (CaseOfferStatus.PENDING, CaseOfferStatus.SHORTLISTED, CaseOfferStatus.ACCEPTED)
    ]
    if not competitors:
        return None, 0
    total = sum((o.amount for o in competitors), Decimal("0"))
    avg = (total / len(competitors)).quantize(Decimal("0.01"))
    return avg, len(competitors)
```

- WITHDRAWN, REJECTED, EXPIRED offer'lar ortalamaya dahil değil
- Tek competitor varsa average == o offer (tek değerden ortalama)
- Customer + assigned: `None, 0` (gereksiz)

### Pure test eklemeleri

```
test_pool_technician_sees_only_own_offer_amount
test_pool_technician_competitor_average_excludes_self
test_pool_technician_competitor_average_excludes_withdrawn_rejected
test_competitor_average_none_when_no_other_offers
test_competitor_average_equals_single_competitor_amount
test_customer_sees_all_offer_amounts_clear
test_assigned_technician_sees_all_offer_amounts_clear
```

Toplam pure test: 13 → **20** (7 yeni).
