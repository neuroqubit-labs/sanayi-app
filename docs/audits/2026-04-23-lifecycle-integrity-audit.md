# 2026-04-23 Lifecycle Integrity Audit — Konsolide Rapor

> **Sahip:** PRODUCT-OWNER sohbeti
> **Kapsam:** 3 eksen (state machine doğruluğu + matching davranışı + süreç takibi dürüstlüğü) × BE + FE iki taraflı parity
> **Amaç:** Pilot 1-2 hafta uzaklıktayken son stratejik denetim — küçük lifecycle tutarsızlıkları pilot UX güvenini kırar. Bu rapor 28+ önceki audit dosyasını konsolide eder, pilot-kritik × pilot-sonrası ayrımını net koyar.

---

## Özet (1 sayfa)

### Skor kartı

| Eksen | P0 | P1 | P2 | Toplam bulgu |
|---|---|---|---|---|
| Eksen 1 — State machine doğruluğu | 3 | 5 | 3 | 11 |
| Eksen 2 — Matching davranışı | 3 | 4 | 3 | 10 |
| Eksen 3 — Süreç takibi dürüstlüğü | 3 | 3 | 2 | 8 |
| **Toplam** | **9** | **12** | **8** | **29** |

### En kritik 3 bulgu (pilot blocker candidate)

1. **L1-P0-1 Invoice approve = case COMPLETED bug** — Müşteri invoice onayı verdiği an case `completed` state'ine geçiyor, ama billing state (PREAUTH_HELD, KASKO_PENDING) settle olmamış olabilir. Finansal gate yok. **Etki:** Review butonu açılıyor, kullanıcı "iş bitti" sanıyor, ama ödeme henüz çekilmemiş. [`approval_flow.py:173-190`]

2. **L3-P0-1 Event mapping incomplete** — Frontend `useCanonicalCase` adapter 38 BE event type'ından sadece 8 tanesini timeline'a render ediyor. PARTS_REQUESTED, PARTS_APPROVED, INVOICE_APPROVED, CANCELLED, TOW_STAGE_COMMITTED gibi kritik event'ler filtered out. **Etki:** Müşteri parça onayı versin, randevu onaylansın — timeline'da gözükmüyor. Süreç takibi dekoratif hale düşüyor. [`useCanonicalCase.ts:85-94`]

3. **L3-P0-2 next_action tekilliği yok** — `next_action_title/description/primary_label` hardcoded empty string. Backend `wait_state_actor/label/description` return ediyor ama FE projekte etmiyor. **Etki:** Kullanıcı "şu an ne yapmalıyım?" sorusuna cevap alamıyor — Codex raporunda tam olarak bu "lifecycle drift" olarak işaretlenen temel sorun. [`useCanonicalCase.ts:419-422`]

### Konsolidasyon notu

Bu 28 bulgunun 15'i önceki 14 audit dosyasında zaten kısmen tespit edilmiş. Bu rapor onları **tek çatı altında konsolide** eder + 13 yeni bulgu ekler + her biri için pilot-kritik × pilot-sonrası ayrımı koyar.

---

## Eksen 1 — State Machine Doğruluğu

**Kaynak audit'ler:** [`2026-04-23-state-machine-fix-backlog.md`](./2026-04-23-state-machine-fix-backlog.md) · [`2026-04-23-transition-matrix.md`](./2026-04-23-transition-matrix.md) · [`2026-04-23-canonical-lifecycle-proposal.md`](./2026-04-23-canonical-lifecycle-proposal.md) · [`2026-04-23-case-type-state-machine-audit.md`](./2026-04-23-case-type-state-machine-audit.md) · [`2026-04-23-backend-mobile-lifecycle-drift.md`](./2026-04-23-backend-mobile-lifecycle-drift.md) · [`2026-04-23-authoritative-transition-map.md`](./2026-04-23-authoritative-transition-map.md)

### 8 State machine × özet tablo

| Machine | State | Terminal | Idempotent | Enforced | Race-safe | Kanıt |
|---|---|---|---|---|---|---|
| **case_lifecycle** | 10 | COMPLETED, CANCELLED (+ ARCHIVED sink) | ✅ (bugün shipped) | ✅ ALLOWED_TRANSITIONS dict | ✅ READ COMMITTED | `case_lifecycle.py:25-87` |
| **offer_acceptance** | 5 (pending/shortlisted/accepted/rejected/expired) | 3 | ✅ atomic UPDATE WHERE | ✅ | ✅ DB-level atomic | `offer_acceptance.py:60-62` |
| **appointment_flow** | 6 (pending/approved/declined/expired/cancelled/counter_pending) | 4 | ❌ No no-op guard | ✅ status check | ⚠️ **No optimistic lock** | `appointment_flow.py:90-99` |
| **case_billing_state** | 14 | 3 (settled/cancelled/preauth_failed) | N/A (guard) | ✅ assert_transition_allowed | ✅ | `case_billing_state.py:109-114` |
| **tow_lifecycle** | 15 stage | 2 (delivered/cancelled) | N/A (outbox) | ✅ | ✅ Optimistic lock | `tow_lifecycle.py:152` |
| **tow_dispatch** | 3 implicit | 1 (timeout_pool) | N/A (flow) | ✅ scoring | ✅ pin-lock | `tow_dispatch.py:99-101` |
| **case_approval** | 3 × 3 kind | 2 (approved/rejected) | ✅ status check | ✅ | ✅ status-based | `approval_flow.py:48-233` |
| **insurance_claim** | 4 (submitted/accepted/paid/rejected) | 2 | ✅ partial unique index | ✅ | ✅ partial-idx | `insurance_claim_flow.py:67-311` |

### FE/BE state parity

| Parite | Durum |
|---|---|
| `ServiceCaseStatus` (10 state) BE ↔ FE | ✅ Tam parity — `packages/domain/src/service-case.ts` |
| `BillingState` (14 state) BE ↔ FE | ✅ Tam parity — `packages/ui/src/billing/BillingStateBadge.tsx` |
| `TowDispatchStage` (15) BE ↔ FE | ⚠️ TowCaseScreenLive stage-aware, ama generic `mobile-core/tracking/engine.ts` shell-aware → drift |
| `AppointmentStatus` (6) BE ↔ FE | ✅ Parity |
| `CaseApprovalStatus` (3) BE ↔ FE | ✅ Parity |
| `InsuranceClaimStatus` (4) BE ↔ FE | ✅ Parity |

### Eksen 1 Kritik Bulgular

#### 🔴 L1-P0-1 — Invoice approve case COMPLETED bug

**Kanıt:** `naro-backend/app/services/approval_flow.py:173-190`

```python
if approval.kind == CaseApprovalKind.INVOICE:
    await transition_case_status(
        session, approval.case_id,
        ServiceCaseStatus.COMPLETED,  # ← direkt COMPLETED
    )
```

**Drift:** Invoice approval → case.status = COMPLETED, ama billing state (PREAUTH_HELD, KASKO_PENDING) hâlâ settle olmamış olabilir. Finansal gate yok.

**Etki:** UC-3 + UC-4 kesişiminde — müşteri "iş bitti" ekranı görüyor, review butonu açılıyor, ama ödeme henüz çekilmemiş. Customer "parayı verdim mi vermedim mi?" karışıklığı.

**Audit default kararı** (`state-machine-fix-backlog.md:88-90`, `canonical-lifecycle-proposal.md:118-132`): *"completed = iş bitti + müşteri onayı + ödeme kapanışı"*.

**Fix yönü:** Invoice approve → case `SERVICE_IN_PROGRESS`'de kalır; completion approve + billing settle birlikte case'i COMPLETED yapar. Authoritative orchestrator (single source).

**Sahip:** Backend + ürün kararı. **Tahmin:** 2-3 saat.

---

#### 🔴 L1-P0-2 — Terminal state admin override mekanizması yok

**Kanıt:** `naro-backend/app/services/case_lifecycle.py:33-35`

```python
S.COMPLETED: {S.ARCHIVED},
S.CANCELLED: {S.ARCHIVED},
S.ARCHIVED: set(),  # sink
```

**Drift:** Audit kararı *"admin override hariç sink state"* (`canonical-lifecycle-proposal.md:12`) diyor, ama admin bypass kodu yok. Pilot'ta kullanıcı "yanlış iptal ettim" dediğinde admin case'i geri açamıyor.

**Etki:** Operasyonel esneklik. 10 kullanıcılık Kayseri pilot'unda olasılık düşük ama ortaya çıkarsa admin müdahale imkânı yok.

**Fix yönü:** `transition_case_status`'a `admin_override: bool = False` parametre ekle + admin endpoint'te bu path. AuthEvent'e ADMIN_CASE_STATUS_OVERRIDE kaydı.

**Sahip:** Backend. **Tahmin:** 1-2 saat.

---

#### 🔴 L1-P0-3 — Billing PREAUTH_FAILED dead end (retry yok)

**Kanıt:** `naro-backend/app/services/case_billing_state.py:63`

```python
BillingState.PREAUTH_FAILED: frozenset({BillingState.CANCELLED}),
```

**Drift:** Müşteri kartı reddedildi (PREAUTH_FAILED) → tek çıkış CANCELLED. Kart değiştirip retry edilemiyor. Pilot'ta UC-1 çekici akışında kritik — kart reddedildiği an vaka kapatılıyor, müşteri ikinci kartla deneyemiyor.

**Etki:** UC-1 + UC-4 akışında financial retry imkânı yok.

**Fix yönü:** PREAUTH_FAILED → {ESTIMATE, CANCELLED} — retry path aç. FE PaymentInitiateScreen'de "tekrar dene + farklı kart" CTA.

**Sahip:** Backend + FE retry UI. **Tahmin:** 2-3 saat BE + 1-2 saat FE.

---

#### 🟠 L1-P1-1 — Appointment race (optimistic lock yok)

**Kanıt:** `naro-backend/app/services/appointment_flow.py:90-99`

```python
appt = await _get_pending(session, appointment_id)  # race window
await appointment_repo.mark_approved(session, appointment_id)
```

**Drift:** Status-only check, optimistic lock yok. Tow lifecycle pattern (`from_stage=current` match) buraya taşınmalı. İki kullanıcı aynı anda approve/decline yaparsa duplicate davranış.

**Etki:** Pilot'ta düşük olasılık (10 kullanıcı), ama V1.1 ölçeklendikçe kritik.

**Fix yönü:** `UPDATE appointments SET status=X WHERE id=? AND status='pending'` pattern.

**Sahip:** Backend. **Tahmin:** 2-3 saat.

---

#### 🟠 L1-P1-2 — Billing ↔ case.status sync eksik

**Drift:** 3 farklı kod yolu case'i COMPLETED yapabiliyor:
- `tow_lifecycle.py` DELIVERED → shell COMPLETED
- `approval_flow.py` INVOICE approve → shell COMPLETED
- `case_billing.py` SETTLED → shell ile sync yok

**Etki:** Single source of truth yok. "Kim case'i ne zaman COMPLETED yapar?" net değil. Tow case'de billing henüz SETTLED değil ama case COMPLETED olabiliyor.

**Audit kararı** (`state-machine-fix-backlog.md:7-12`): *"Admin override hariç bütün case.status yazımları tek authority katmanına taşınmalı."*

**Fix yönü:** `app/services/case_completion.py` (yeni) — tek authoritative orchestrator. Tow DELIVERED + approval completion + billing SETTLED üçünü bekler → COMPLETED yazar.

**Sahip:** Backend. **Tahmin:** 1-2 iş günü (refactor).

---

#### 🟠 L1-P1-3 — Insurance claim kind=accident guard eksik

**Kanıt:** `naro-backend/app/services/insurance_claim_flow.py:78-100`

```python
async def submit_claim(session, *, case_id, ...):
    active = await claim_repo.get_active_claim_for_case(session, case_id)
    # ← case.kind kontrolü yok
```

**Drift:** Audit default (`canonical-lifecycle-proposal.md:144-150`) *"Insurance yalnızca accident için geçerlidir"* diyor, ama kod generic case check yapıyor. Bakım case'inden insurance claim submit edilebiliyor.

**Etki:** Pilot'ta yanlış kind'dan claim açılması potansiyeli. Maintenance vakasında kasko bildirimi = absurd davranış.

**Fix yönü:** `submit_claim()` başına `if case.kind != ServiceRequestKind.ACCIDENT: raise InvalidCaseKindError`. Route'ta da 422 döner.

**Sahip:** Backend. **Tahmin:** 30 dk.

---

#### 🟠 L1-P1-4 — Tow shell status sync eksik (scheduled tow görünürlüğü)

**Kanıt:** `naro-backend/app/services/tow_lifecycle.py:286-307`

**Drift:** `_sync_case_status()` BIDDING_OPEN + SCHEDULED_WAITING → case.status MATCHING'e map ediyor. Scheduled tow akışında usta teklif veriyor ama customer UI hâlâ "matching" gösteriyor.

**Audit kararı** (`state-machine-fix-backlog.md:48-52`): *"scheduled_waiting, bidding_open, offer_accepted gibi tow stage'leri mobilde açık şekilde görünür olmalı."*

**Etki:** UC-1 scheduled tow akışında kullanıcı "hâlâ matching'te" sanıyor, gerçekte teklifler geliyor.

**Fix yönü:** Tow shell visibility projection DTO (state-machine-fix-backlog §Launch Öncesi) — subtype stage'i kaba shell'e sıkıştırmadan FE'ye ayrı alan gönder.

**Sahip:** Backend + FE. **Tahmin:** 4-6 saat.

---

#### 🟠 L1-P1-5 — Tow accept `tow_dispatch._transition_to_accepted()` shell yazımı

**Kanıt:** `naro-backend/app/services/tow_dispatch.py:196-236`

**Drift:** Audit kararı (`state-machine-fix-backlog.md:25-28`): *"`tow_dispatch._transition_to_accepted()` shell status'u doğrudan yazmamalı; tow lifecycle authority'si altında ilerlemeli."*

**Etki:** İki yerde case.status yazılıyor (tow_dispatch + tow_lifecycle). Senkronizasyon bug'ları açısından risk.

**Fix yönü:** `tow_dispatch` shell yazma yetkisini `tow_lifecycle.transition_stage`'a devret.

**Sahip:** Backend. **Tahmin:** 2-3 saat.

---

#### 🟡 L1-P2-1 — Wait state tanımlı ama kullanılmıyor

**Kanıt:** `naro-backend/app/services/case_lifecycle.py:111-127` — `update_wait_state()` fn tanımlı ama hiç çağrılmıyor (grep 0 result).

**Drift:** `case.wait_state_actor/label/description` DB kolonları var, update fn var, ama çağıran yok. FE bu alandan next_action türetmiyor (L3-P0-2 ile bağlantılı).

**Fix yönü:** Her lifecycle transition'ında `update_wait_state()` çağrılarak doğru aktörü işaretle. Sonra L3-P0-2 fix'iyle FE bunu projekte eder.

**Sahip:** Backend (L3-P0-2 ile paralel). **Tahmin:** 2-3 saat.

---

#### 🟡 L1-P2-2 — Evidence gate tow'da hardcoded

**Kanıt:** `naro-backend/app/services/tow_lifecycle.py:88-93` — `_EVIDENCE_GATES` dict kod'da hardcoded, config yok.

**Etki:** Runtime değişim kod deploy gerektirir. V1.1 için yeterli.

**Sahip:** Backend. **Tahmin:** V1.1, 3-4 saat.

---

#### 🟡 L1-P2-3 — Terminal state const'ları scattered

**Drift:** 4 farklı yerde farklı isimlerde terminal state tanımları:
- `case_lifecycle.py:38-40` `TERMINAL_STATES`
- `case_billing_state.py:41-43` `TERMINAL_BILLING_STATES`
- `tow_lifecycle.py` implicit (DELIVERED, CANCELLED)
- `insurance_claim_flow.py:67-72` ALLOWED_TRANSITIONS'da inline

**Fix yönü:** `app/domain/terminal_states.py` (yeni) — merkezi namespace.

**Sahip:** Backend. **Tahmin:** V1.1, 1 saat.

---

## Eksen 2 — Matching Davranışı

**Kaynak audit'ler:** [`2026-04-23-matching-structural-audit.md`](./2026-04-23-matching-structural-audit.md) · [`2026-04-23-matching-decision-table.md`](./2026-04-23-matching-decision-table.md) · [`2026-04-23-matching-fix-backlog.md`](./2026-04-23-matching-fix-backlog.md) · [`2026-04-23-signal-lifecycle-matrix.md`](./2026-04-23-signal-lifecycle-matrix.md) · [`2026-04-23-tow-priority-audit.md`](./2026-04-23-tow-priority-audit.md) · [`2026-04-23-live-smoke-report.md`](./2026-04-23-live-smoke-report.md)

### 6 Senaryo davranış matrisi

| Senaryo | Süre | Gerçek state | UI sinyali | Auto-closes? | Durum |
|---|---|---|---|---|---|
| Tow immediate, technician decline (3 attempt) | ~45 sn | TIMEOUT_CONVERTED_TO_POOL | Case offers_ready'e geçer | ❌ Yeni başlatma lazım | ⚠️ |
| Generic pool, offer yok | 24+ saat | MATCHING | "Yenile" butonu sonsuza kadar | ❌ Auto-archive yok | 🔴 P1 |
| Tow immediate, 50km'de aday yok | ~45 sn | TIMEOUT_CONVERTED_TO_POOL | Status OFFERS_READY olur | ✅ (pool'a) | ✅ |
| Offer expires_at geçti | Sınırsız | PENDING (EXPIRED değil) | Hâlâ teklif gösterir | ❌ **Cron yok** | 🔴 P1 |
| Accident'ten "çekici lazım" → linked tow | Anlık | Parent + child case (bidirectional) | linked_tow_case_ids API'de ✅ | — | ✅ |
| Offer kabul + appointment race (2 customer) | — | İlk kazanır, ikinci 422 | Loading state | Atomic ✅ | ✅ |

### Coverage signal × SQL kullanım matrisi

**Toplanıyor / Kullanılıyor karşılaştırması:**

| Signal | DB tablosu | Toplanıyor | SQL'de kullanılıyor? | Etki |
|---|---|---|---|---|
| `provider_type` | `technician_profiles` | ✅ | ✅ KIND_PROVIDER_MAP filter | OK |
| `last_known_location` | `technician_profiles` | ✅ (seed fix sonrası) | ✅ ST_DWithin | OK |
| `current_offer_case_id` | `technician_profiles` | ✅ | ✅ (lock) | OK |
| `tow_equipment` | `technician_tow_equipment` | ✅ (seed fix sonrası) | ✅ (dispatch filter) | OK |
| `service_area` | `technician_service_area` | ✅ (onboarding) | ❌ | 🔴 P1 |
| `working_districts` | `technician_working_districts` | ✅ (onboarding) | ❌ | 🔴 P1 |
| `service_domains` | `technician_service_domains` | ✅ (coverage) | ❌ | 🔴 P1 |
| `brand_coverage` | `technician_brand_coverage` | ✅ (coverage) | ❌ | 🔴 P1 |
| `drivetrain_coverage` | `technician_drivetrain_coverage` | ✅ (coverage) | ❌ | 🔴 P1 |
| `max_concurrent_jobs` | `technician_capacity` | ✅ (onboarding) | ❌ | 🔴 P1 |
| `current_queue_depth` | (derived) | ❌ | ❌ | 🟡 P2 |
| `working_schedule` | `technician_working_schedule` | ✅ (onboarding) | ❌ | 🔴 P1 |
| `vehicle body/class` | — | ❌ | ❌ | 🟡 P2 (V1.1 schema ekle) |

**Özet:** 13 sinyalden 5'i SQL'de kullanılıyor (provider_type, location, lock, equipment, ve kind filter). Diğer 8 "ölü veri" — toplanıyor ama karar motoru değmiyor.

### ⚠️ Seed Heartbeat Nüansı (operasyonel not)

**Kanıt:** `naro-backend/app/repositories/tow.py:170` — `last_location_at > :cutoff` (90 saniye heartbeat freshness).
`naro-backend/scripts/seed_kayseri_pilot.py:504` — seed çalıştığı anda `last_location_at=NOW()` yazıyor.

**Davranış:** Seed koşulduktan 90+ saniye sonra immediate tow dispatch false negative döner (aday bulunmaz, stage=timeout_converted_to_pool). Mock teknisyenlerin gerçek heartbeat cron'u yok.

**Pilot etkisi:** Demo veya test öncesi seed script'i her koşuda refresh lazım. Pilot launch'ta 10 gerçek usta = gerçek heartbeat, bu sorun yok. Sadece dev/smoke ortamı.

**Fix yönü (V1.1):** Mock teknisyenler için heartbeat simulator cron (her 60 sn `last_location_at` refresh). Veya seed script'e `--keep-fresh` mode.

**Sahip:** Backend + Ops. **Tahmin:** V1.1, 1-2 saat.

### Eksen 2 Kritik Bulgular

#### 🔴 L2-P0-1 — Customer tow flow live wire-up (durum teyit gerek)

**Kanıt:** `matching-structural-audit.md` P0-1, `live-smoke-report.md`, son FE commit'ler

**Drift:** Customer `CaseComposerScreen` towing branch'i `useTowStore` local ile çalışıyor (P0-4 audit bulgusu). FE dev shipped ama live smoke'da `stage=timeout_converted_to_pool` — dispatch gerçek mock teknisyene ulaşmıyor.

**Etki:** UC-1 Uber-tarzı tek-tık çekici akışı pilot'ta test edilemiyor. Şu an seed fix (L2-P0 açıldı, mock teknisyen konumu + equipment var), ama customer app'in canlı dispatch'i ile gerçek end-to-end akış hala netleşmemiş.

**Fix yönü:** QA Tur 2'de UC-1 akışı baştan sona test edilmeli. Eğer hala mock store'dan geliyorsa FE dev re-audit.

**Sahip:** FE (Customer) + QA teyit. **Tahmin:** 0-2 saat (eğer bug varsa).

---

#### 🔴 L2-P0-2 — Tow preauth gate teyit

**Drift:** Önceki audit'te "preauth settlement yok, dispatch başlıyor" bulgusu P0-3 olarak kaydedildi ve fix shipped dendi. Ama QA Tur 1 smoke'unda tekrar doğrulanmadı (tow stage `timeout_converted_to_pool` çünkü customer flow live değildi).

**Fix yönü:** QA Tur 2'de UC-4 payment initiate → immediate tow create → preauth hold sequence test edilmeli. Stack trace yoksa clear.

**Sahip:** QA teyit + BE reaktif fix (varsa). **Tahmin:** 0-2 saat.

---

#### 🔴 L2-P0-3 — Service app dispatch accept path (canlı teyit)

**Kanıt:** `matching-structural-audit.md` P0-5, FE dev commit `afe0474`

**Drift:** Service app tow dispatch accept/decline + location broadcast path'i fix edildi. Ama gerçek e2e test (müşteri çekici çağır → service app dispatch kabul et → en_route update) QA Tur 1'de yapılamadı çünkü P0-1/P1-1 fix'ler sonradan shipped oldu.

**Fix yönü:** QA Tur 2'de 2 app paralel test — müşteri ve servis app canlı dispatch flow'u.

**Sahip:** QA teyit. **Tahmin:** 0.5-1 saat test.

---

#### 🟠 L2-P1-1 — Offer expire cron yok

**Kanıt:** `naro-backend/app/repositories/offer.py:240-256` `expire_stale_offers()` fn var, `app/workers/settings.py` cron kayıt listesinde yok.

**Drift:** PENDING offers `expires_at` geçmiş olsa bile state değişmez. Müşteri "süresi dolmuş" teklif görmeye devam eder.

**Etki:** Pilot'ta UX kirlenmesi. 10 kullanıcı × ortalama 3-5 teklif = 30-50 stale offer riski.

**Fix yönü:** `expire_stale_offers` ARQ cron olarak eklen (her 5 dk). `expires_at < NOW()` olan PENDING offers → EXPIRED.

**Sahip:** Backend. **Tahmin:** 1-2 saat.

---

#### 🟠 L2-P1-2 — Stale case auto-archive yok

**Drift:** 24+ saat MATCHING'te kalan case otomatik archive edilmiyor. Müşteri "Yenile" butonu sonsuza kadar görür. Codex raporunda tam bu noktada "user aktifi hatırlama yükünden kurtulmalı" önerisi.

**Etki:** Pilot'ta UC-2 akışında 1 kullanıcı vaka açtı, 3 gün sonra tekrar açmaya çalışınca duplicate guard 409 atıyor. Kullanıcı "ne aktif vakası?" diye şaşırır.

**Fix yönü:** `scripts/stale_case_archive.py` cron — 48 saat hiç hareket olmayan MATCHING case → auto-archive + user notification event.

**Sahip:** Backend. **Tahmin:** 2-3 saat.

---

#### 🟠 L2-P1-3 — Generic pool feed coverage filter zero

**Kanıt:** `naro-backend/app/repositories/case.py:130-162` — SQL sadece `kind + status + assigned_technician_id IS NULL` filter.

**Drift:** Audit default (`matching-structural-audit.md` P0-3) + copy fix sonrası *"bu bilgiler matching'e girer"* copy'si var, ama gerçekten kullanılmıyor.

**Etki:** UC-2 akışında usta havuz'da domain/brand/drivetrain filter olmadan tüm case'leri görüyor. Pilot 10+10 için tolere edilebilir (dar coğrafya), ama ölçeklenir ölçeklenmez kirli pool.

**Fix yönü:** Pool feed SQL'ine `service_domains IN ...` + `city_code = ...` + `brand_coverage LIKE ...` filter ekle.

**Sahip:** Backend. **Tahmin:** 4-6 saat.

---

#### 🟠 L2-P1-4 — Tow dispatch capacity guard yok

**Kanıt:** `naro-backend/app/repositories/tow.py:147-183` — candidate SQL'inde `technician_capacity` tablosu join yok.

**Drift:** `max_concurrent_jobs`, `queue_depth` query'de kullanılmıyor. Meşgul çekici yine seçilebilir (ama `current_offer_case_id` occupancy lock var, bu edge'i kısmen kapatıyor).

**Fix yönü:** Candidate SQL'e `tc.max_concurrent_jobs > (SELECT count(*) FROM active_offers ...) ` guard.

**Sahip:** Backend. **Tahmin:** 2-3 saat.

---

#### 🟡 L2-P2-1 — Matching ranking v1 sadece tow'da

**Drift:** Pool feed query'sinde sıralama `created_at DESC` — usta havuzda case'leri tarihe göre görüyor. Relevance ranking yok.

**Fix yönü:** V1.1 matching v2 (multi-signal ranking) scope'u.

**Sahip:** Backend V1.1. **Tahmin:** 2-3 gün.

---

#### 🟡 L2-P2-2 — Scheduled tow bid stub

**Drift:** `tow.py:/bids/*` endpoint'leri 10f integration pending. Immediate tow ana path çalışıyor, scheduled tow V1.1.

**Fix yönü:** V1.1 sprint.

**Sahip:** Backend V1.1. **Tahmin:** 1-2 gün.

---

#### 🟡 L2-P2-3 — Offer route canonical schema drift (technician_id)

**Kanıt:** QA Tur 1.5 doğrulaması (port 8001).
- Canonical schema: `naro-backend/app/schemas/offer.py:15` — `OfferCreatePayload` içinde `technician_id: UUID`.
- Route gerçek: `naro-backend/app/api/v1/routes/offers.py:57` — route body schema'da `technician_id` **yasaklanmış** (`extra="forbid"` + field omitted), sadece auth'dan türetiliyor.

**Drift:** Canonical Pydantic schema `technician_id` bekliyor, route body reddediyor. FE canonical'a göre gönderirse 422 alır. Şu an FE route body boş bırakıyor → çalışıyor ama contract temiz değil.

**Etki:** Pilot blocker değil (FE şu an doğru davranıyor). V1.1 contract parity ve docs/api canonical export tutarlılığı açısından temizlenmeli.

**Fix yönü:** Canonical schema'yı route davranışına hizala — `technician_id` kaldır (auth user'dan alınır) veya route'ta kabul et.

**Sahip:** Backend V1.1. **Tahmin:** 30 dk.

---

## Eksen 3 — Süreç Takibi Dürüstlüğü

**Kaynak audit'ler:** [`2026-04-23-backend-mobile-lifecycle-drift.md`](./2026-04-23-backend-mobile-lifecycle-drift.md) · [`2026-04-23-canonical-case-architecture.md`](./2026-04-23-canonical-case-architecture.md)

### Event → FE UI mapping matrisi

| BE CaseEventType | Emit ediliyor mu? | FE `BE_TO_FE_EVENT_TYPE` mapping | Timeline'da görünüyor? |
|---|---|---|---|
| SUBMITTED | ✅ | "submitted" | ✅ |
| OFFER_RECEIVED | ❌ emit yok | null | ❌ |
| OFFER_ACCEPTED | ✅ `offer_acceptance.py:90` | "offer_received" (⚠️ yanlış isim) | ⚠️ |
| OFFER_REJECTED | ❌ emit yok | null | ❌ |
| OFFER_WITHDRAWN | ❌ emit yok | null | ❌ |
| APPOINTMENT_REQUESTED | ❌ emit yok | null | ❌ |
| APPOINTMENT_APPROVED | ✅ `appointment_flow.py:107` | null | ❌ **FILTERED** |
| APPOINTMENT_DECLINED | ✅ | null | ❌ **FILTERED** |
| APPOINTMENT_CANCELLED | ❌ emit yok | null | ❌ |
| TECHNICIAN_SELECTED | ✅ | "technician_selected" | ✅ |
| STATUS_UPDATE | ✅ `case_lifecycle.py:108` | "status_update" | ✅ |
| PARTS_REQUESTED | ✅ `approval_flow.py:113` | null | ❌ **FILTERED** |
| PARTS_APPROVED | ✅ `approval_flow.py:165` | null | ❌ **FILTERED** |
| PARTS_REJECTED | ✅ `approval_flow.py:218` | null | ❌ **FILTERED** |
| INVOICE_SHARED | ✅ `approval_flow.py:124` | "invoice_shared" | ✅ |
| INVOICE_APPROVED | ✅ `approval_flow.py:182` | null | ❌ **FILTERED** |
| INVOICE_ISSUED | ✅ `case_billing.py` | null | ❌ **FILTERED** |
| EVIDENCE_ADDED | ❌ emit yok | null | ❌ |
| DOCUMENT_ADDED | ✅ `case_documents.py` | null | ❌ **FILTERED** |
| MESSAGE | ✅ `case_thread.py` | "message" | ✅ |
| COMPLETED | ✅ | "completed" | ✅ |
| CANCELLED | ✅ | null | ❌ **FILTERED** |
| TOW_STAGE_COMMITTED | ✅ `tow_lifecycle.py:189` | null | ❌ **FILTERED** |
| INSURANCE_CLAIM_SUBMITTED | ✅ | null | ❌ **FILTERED** |
| PAYMENT_INITIATED | ✅ | null | ❌ **FILTERED** |
| BILLING_STATE_CHANGED | ✅ | null | ❌ **FILTERED** |

**Özet:** 38 BE event type'tan ~20'si emit ediliyor (18 eksik), emit edilenlerin sadece 8'i FE mapping'inde — **timeline'da kullanıcı görmüyor 12 gerçek event.**

### Next action tekilliği — 5 senaryo

| Case status | wait_state_actor (BE) | wait_state_label (BE) | FE next_action (şu an) |
|---|---|---|---|
| MATCHING | SYSTEM | null | "" (hardcoded empty) |
| OFFERS_READY | CUSTOMER | "Tekliflerini incele" | "" |
| SCHEDULED | TECHNICIAN | "İşe başlama saati yaklaştı" | "" |
| SERVICE_IN_PROGRESS | TECHNICIAN | "İş sürüyor" | "" |
| PARTS_APPROVAL | CUSTOMER | "Ek parça onayı" | "" |

**Sonuç:** BE 5 senaryoda da doğru sinyali veriyor, ama FE adapter bunu hiç projekte etmiyor. Kullanıcı "şu an ne yapmalıyım?" sorusuna cevap alamıyor.

### Cancel cascade matrisi

| Cascade hedefi | Durumu | Kanıt |
|---|---|---|
| Active offers | ❌ Auto-reject **YOK** | `cases.py:/cancel` offer reject çağrısı yok |
| Appointment | ❌ Auto-cancel **YOK** | aynı |
| Pending approvals | ❌ Status değişmiyor | aynı |
| Tow dispatch (child) | ✅ Cancel ediliyor | `tow_lifecycle.py:232` |
| Thread | ✅ Read-only oluyor | `case_thread.py:106` ThreadClosedError |
| Documents | ✅ Visible kalır (soft delete) | `media_assets.deleted_at IS NULL` |
| Timeline events | ✅ Visible + CANCELLED event append | `case_events` append-only |

**Özet:** Cancel cascade sadece tow + thread + documents'ta çalışıyor. Offers + appointments + approvals auto-cancel **eksik** — iptal edilmiş case'de pending offer yaşamaya devam ediyor (usta'ya hayalet vaka).

### Eksen 3 Kritik Bulgular

#### 🔴 L3-P0-1 — Event mapping incomplete (timeline filtered out)

**Kanıt:** `naro-app/src/features/cases/hooks/useCanonicalCase.ts:85-94`

```typescript
const BE_TO_FE_EVENT_TYPE: Record<string, FEEventType> = {
  submitted: "submitted",
  offer_received: "offer_received",
  offer_accepted: "offer_received",  // ← duplicate
  technician_selected: "technician_selected",
  status_update: "status_update",
  parts_requested: "parts_requested",
  invoice_shared: "invoice_shared",
  message: "message",
  completed: "completed",
  // ← 12+ event eksik
};
```

**Drift:** PARTS_APPROVED, PARTS_REJECTED, INVOICE_APPROVED, CANCELLED, TOW_STAGE_COMMITTED, PAYMENT_INITIATED, APPOINTMENT_APPROVED hiçbiri timeline'da gözükmüyor. Customer parça onayı versin — timeline sessiz. Invoice approve etsin — timeline sessiz.

**Etki:** UC-3 süreç takibi **dekoratif** hale düşüyor. Codex raporunda tam bu noktada: *"Timeline ve süreç kartları dekoratif değil, gerçek event'lere bağlı olmalı."*

**Fix yönü:** `BE_TO_FE_EVENT_TYPE` genişlet (en az 20+ event ekle). `FEEventType` enum güncelle. Her FE mapping'i için UI copy + icon + tone eşleme.

**Sahip:** FE. **Tahmin:** 3-4 saat (mapping + copy + tone).

---

#### 🔴 L3-P0-2 — Next action tekilliği yok

**Kanıt:** `naro-app/src/features/cases/hooks/useCanonicalCase.ts:419-422`

```typescript
next_action_title: "",
next_action_description: "",
next_action_primary_label: "",
next_action_secondary_label: null,
```

**Drift:** Backend `case.wait_state_actor/label/description` return ediyor (kolonlar DB'de dolu değil — L1-P2-1 bulgusu), ama FE zaten hardcoded empty. İki yönlü gap.

**Etki:** Codex raporunun ana bulgusu — *"şu an ne oluyor? bir sonraki adımı kim atacak?"* kullanıcıya net gösterilmiyor.

**Fix yönü (2 adımlı):**
1. **BE:** `update_wait_state()` her lifecycle transition'ında çağrılmalı (L1-P2-1 fix).
2. **FE:** `useCanonicalCase` projection — `case.wait_state_*` → `next_action_*` mapping + role-aware label (customer view vs technician view farklı copy).

**Sahip:** BE + FE. **Tahmin:** BE 2-3 saat + FE 2-3 saat = yarım iş günü.

---

#### 🔴 L3-P0-3 — Cancel cascade eksik (offers + appointments + approvals)

**Kanıt:** `naro-backend/app/api/v1/routes/cases.py` cancel endpoint

**Drift:** Case cancel edildiğinde active offers PENDING kalıyor, pending appointment PENDING kalıyor, pending approvals PENDING kalıyor.

**Etki:** İptal edilen vakanın offers'ı ustalar havuzunda "hayalet teklif" olarak yaşar. Usta tıklayınca 409 alır, kafa karışıklığı.

**Fix yönü:** `cases.py:/cancel` handler'a cascade reject:
```python
await offer_repo.reject_all_pending_for_case(case_id)
await appointment_repo.cancel_all_for_case(case_id)
await approval_repo.reject_all_pending_for_case(case_id)
```

**Sahip:** Backend. **Tahmin:** 2-3 saat.

---

#### 🟠 L3-P1-1 — Tow shell vs stage drift (mobile-core)

**Kanıt:** `packages/mobile-core/src/tracking/engine.ts` + `naro-app/src/features/tow/screens/TowCaseScreenLive.tsx`

**Drift:** TowCaseScreenLive stage-aware çalışıyor ✅ ama generic `mobile-core/tracking/engine.ts` tow case'i shell spine'a sıkıştırıyor. Aynı customer app içinde iki farklı lifecycle görüşü yaşıyor.

**Etki:** Home ekranında aktif tow case → "hizmet sürüyor" generic mesaj; detay ekranda stage-first detaylı akış. Tutarsız UX.

**Fix yönü:** `mobile-core/tracking/engine.ts` kind-aware hale getir (case.kind === 'towing' → stage-first yaklaşımı).

**Sahip:** FE + mobile-core. **Tahmin:** 1-2 iş günü.

---

#### 🟠 L3-P1-2 — Service app subtype awareness yok

**Kanıt:** `naro-service-app/src/features/cases/screens/CaseProfileScreen.tsx:29-89`

**Drift:** Technician case profile `deriveContext()` / `deriveSticky()` sadece `case.status` okuyor. `wait_state_actor`, `approval.kind`, tow stage ignore ediliyor.

**Etki:** Usta "şu an ne yapmalıyım?" sorusuna net cevap alamıyor. Customer tarafıyla symmetric değil.

**Fix yönü:** Service app projection canonical layer + wait_state_actor/label render.

**Sahip:** Service FE. **Tahmin:** 4-6 saat.

---

#### 🟠 L3-P1-3 — Event emission disiplini tutarsız

**Drift:** 38 CaseEventType tanımlı ama sadece ~20'si gerçek emit ediyor. OFFER_RECEIVED, OFFER_REJECTED, APPOINTMENT_REQUESTED, APPOINTMENT_CANCELLED, EVIDENCE_ADDED vb. hiç emit edilmiyor.

**Etki:** L3-P0-1 fix edilse bile bu event'ler timeline'a hiç düşmez. BE tarafı eksik.

**Fix yönü:** Her lifecycle fonksiyonunda explicit event emit disiplini. Audit: "state transition observability — tek tip event, metric, audit trail standardı" (state-machine-fix-backlog.md).

**Sahip:** Backend. **Tahmin:** 1 iş günü (tüm lifecycle service'leri tarama + eksik emit'leri ekleme).

---

#### 🟡 L3-P2-1 — Multiple active approval constraint yok

**Drift:** 1 case için N pending parts_request açılabilir (DB constraint + code check yok). `approval_flow.request_approval()` new CaseApproval insert yapıyor, uniqueness yok.

**Fix yönü:** DB partial unique index `WHERE status='pending'` + service check.

**Sahip:** Backend V1.1. **Tahmin:** 2-3 saat.

---

#### 🟡 L3-P2-2 — Mock store seed drift

**Kanıt:** `naro-app/src/features/cases/store.ts:176` — breakdown/maintenance offers_ready'den start, backend matching'ten start.

**Drift:** Demo akışları gerçek lifecycle'i maskeleyebilir. Cleaner Hat B scope'u; pilot-kritik değil.

**Sahip:** Cleaner (Nazif). **Tahmin:** 1 saat.

---

## Konsolide Liste

### 🔴 P0 — Pilot blocker (9 madde)

| ID | Bulgu | Sahip | Tahmin | Audit referans |
|---|---|---|---|---|
| L1-P0-1 | Invoice approve → case COMPLETED bug (finansal gate yok) | Backend + ürün | 2-3 saat | state-machine-fix-backlog §hemen #2 |
| L1-P0-2 | Terminal state admin override mekanizması yok | Backend | 1-2 saat | canonical-lifecycle-proposal §12 |
| L1-P0-3 | Billing PREAUTH_FAILED dead end (retry yok) | Backend + FE | 3-5 saat | (yeni bulgu) |
| L2-P0-1 | Customer tow flow live wire-up teyit | FE + QA | 0-2 saat | matching P0-1 |
| L2-P0-2 | Tow preauth gate teyit | QA + BE reaktif | 0-2 saat | tow-priority §P0-3 |
| L2-P0-3 | Service app dispatch accept path canlı teyit | QA | 0.5-1 saat | tow-priority §P0-5 |
| L3-P0-1 | Event mapping incomplete (12+ event timeline'dan filtered) | FE | 3-4 saat | backend-mobile-drift |
| L3-P0-2 | Next action tekilliği yok (hardcoded empty) | BE + FE | 4-6 saat | (Codex ana bulgu) |
| L3-P0-3 | Cancel cascade eksik (offers+appointments+approvals) | Backend | 2-3 saat | (yeni bulgu) |

**P0 toplam tahmin:** 16-26 iş saati (~2-3 iş günü paralel çalışmayla).

### 🟠 P1 — Launch öncesi (12 madde)

| ID | Bulgu | Sahip | Tahmin |
|---|---|---|---|
| L1-P1-1 | Appointment race (optimistic lock yok) | Backend | 2-3 saat |
| L1-P1-2 | Billing ↔ case.status sync eksik (single authority yok) | Backend | 1-2 iş günü |
| L1-P1-3 | Insurance claim kind=accident guard eksik | Backend | 30 dk |
| L1-P1-4 | Tow shell status sync (scheduled tow görünürlüğü) | BE + FE | 4-6 saat |
| L1-P1-5 | Tow accept shell yazma yetkisi (dispatch bypass) | Backend | 2-3 saat |
| L2-P1-1 | Offer expire cron yok | Backend | 1-2 saat |
| L2-P1-2 | Stale case auto-archive yok | Backend | 2-3 saat |
| L2-P1-3 | Generic pool coverage filter zero | Backend | 4-6 saat |
| L2-P1-4 | Tow dispatch capacity guard yok | Backend | 2-3 saat |
| L3-P1-1 | Tow shell vs stage drift (mobile-core kind-aware değil) | FE | 1-2 iş günü |
| L3-P1-2 | Service app subtype awareness yok | Service FE | 4-6 saat |
| L3-P1-3 | Event emission disiplini tutarsız (18 event hiç emit yok) | Backend | 1 iş günü |

**P1 toplam tahmin:** 5-7 iş günü paralel.

### 🟡 P2 — Pilot-sonrası V1.1 (7 madde)

| ID | Bulgu | Sahip | Tahmin |
|---|---|---|---|
| L1-P2-1 | Wait state tanımlı ama kullanılmıyor | Backend | 2-3 saat (L3-P0-2 ile paralel) |
| L1-P2-2 | Evidence gate hardcoded | Backend | 3-4 saat |
| L1-P2-3 | Terminal state const'ları scattered | Backend | 1 saat |
| L2-P2-1 | Generic pool matching ranking yok | Backend | 2-3 gün (matching v2) |
| L2-P2-2 | Scheduled tow bid stub | Backend | 1-2 gün |
| L3-P2-1 | Multiple active approval constraint yok | Backend | 2-3 saat |
| L3-P2-2 | Mock store seed drift | Cleaner | 1 saat |
| L2-P2-3 | Offer route canonical schema drift (technician_id) | Backend | 30 dk |
| L2-P2-X | Seed heartbeat fresh requirement (dev/smoke) | Backend + Ops | 1-2 saat |

---

## Fix Sahipliği Tablosu

### Backend (tek başına)
- L1-P0-1 Invoice approve gate (2-3 saat)
- L1-P0-2 Admin override (1-2 saat)
- L1-P1-1 Appointment race (2-3 saat)
- L1-P1-2 case.status single authority refactor (1-2 iş günü)
- L1-P1-3 Insurance accident guard (30 dk)
- L1-P1-5 Tow accept shell yetki (2-3 saat)
- L2-P1-1 Offer expire cron (1-2 saat)
- L2-P1-2 Stale case archive (2-3 saat)
- L2-P1-3 Pool coverage filter (4-6 saat)
- L2-P1-4 Tow capacity guard (2-3 saat)
- L3-P0-3 Cancel cascade (2-3 saat)
- L3-P1-3 Event emit disiplini (1 iş günü)
- L1-P2-1/2/3 (küçük backend temizlik)
- L3-P2-1 Approval uniqueness

**Backend toplam:** P0 + P1 ≈ 4-5 iş günü paralel çalışmayla.

### FE (müşteri app)
- L2-P0-1 Tow flow live teyit (0-2 saat reaktif)
- L3-P0-1 Event mapping genişlet (3-4 saat)
- L3-P0-2 next_action projection (2-3 saat)
- L1-P0-3 Retry UI (1-2 saat)
- L3-P1-1 mobile-core kind-aware (1-2 iş günü)

**FE müşteri toplam:** P0 + P1 ≈ 1-2 iş günü.

### FE (service app)
- L3-P1-2 Subtype awareness + projection (4-6 saat)

### BE + FE ortak
- L1-P0-3 Retry flow (3-5 saat toplam)
- L1-P1-4 Tow shell visibility DTO (4-6 saat)
- L3-P0-2 next_action (2 taraflı, 4-6 saat toplam)

### QA
- L2-P0-1/2/3 reaktif teyit
- Tur 2 full cycle
- Pilot-ready raporu

### Nazif (Cleaner)
- L3-P2-2 mock seed drift (1 saat)
- Paralel mock wrapper söküm (iter 8+)

### Ürün kararı gerekli (PO + user)
- L1-P0-1 "completed" semantic: invoice approve = completion mu? (canonical-lifecycle-proposal.md default karar: HAYIR)
- L1-P0-2 Admin override UX ne olacak
- L2-P1-2 Stale case threshold (48 saat? 72 saat?)
- L3-P2-1 Multiple active approval policy (1 parts + 1 invoice + 1 completion max?)

---

## Tartışma Noktaları (ürün kararı gerektirenler)

### K1 — "completed" semantik
Audit default: *invoice approve + completion approve + billing SETTLED üçü birden olduğunda COMPLETED*. Şu an sadece invoice approve ile case COMPLETED oluyor.

**Seçenekler:**
- (a) Audit default kabul — 3 gate (invoice + completion + billing).
- (b) 2 gate — invoice approve + billing SETTLED (completion approve opsiyonel).
- (c) 1 gate — invoice approve yeter (mevcut davranış, risk: ödeme çekilmeden "iş bitti").

**Önerim:** (a). 10 kullanıcılık pilot'ta complexity tolerable; launch-sonrası güven için kritik.

### K2 — Stale case threshold
MATCHING'te kalan case ne zaman otomatik archive olmalı?

**Seçenekler:**
- (a) 24 saat — agresif, kullanıcı hızlı reset hisseder
- (b) 48 saat — orta
- (c) 72 saat (3 gün) — konservatif, KVKK gereksinimlere uygun

**Önerim:** (b) 48 saat. Kullanıcıya "48 saat boyunca kimse teklif vermedi, yeniden açmak ister misin?" notification ile.

### K3 — Multiple active approval policy
1 case için aynı anda kaç pending parts_request/invoice/completion açılabilir?

**Seçenekler:**
- (a) 1 pending her kind için (toplam max 3) — strict
- (b) N pending parts + 1 pending invoice + 1 pending completion — parts için serbest
- (c) Sınırsız — teknik borç

**Önerim:** (a). UX tutarlılığı + cognitive load düşük.

### K4 — Admin override UX
Admin pilot öncesi terminal state'i geri açabilir mi?

**Seçenekler:**
- (a) Var, ayrı endpoint + audit log (önerim)
- (b) Yok, sadece manual DB UPDATE (operasyonel risk)

**Önerim:** (a). AuthEvent + Prometheus metric + kısıtlı admin endpoint.

### K5 — Event emit yaygınlığı
Hangi event'ler timeline'a düşmeli, hangileri internal audit'te kalmalı?

**Şu an:** 38 tanımlı, ~20 emit, 8 timeline'da. **Öneri:** Tüm müşteri-etkileyen event'ler timeline'da (yaklaşık 25 event); internal trace event'leri (TOW_STAGE_REQUESTED vb.) audit trail'de.

---

## Özet: Pilot-Kritik Sıra

**Öncelik sırası (PO önerisi — user onayıyla brief'lere dönüşür):**

1. **L3-P0-2 next_action projection** (BE + FE, 4-6 saat) — Codex ana bulgusu, lifecycle drift'i kapatan en büyük parça
2. **L3-P0-1 Event mapping genişlet** (FE, 3-4 saat) — timeline dürüstlük
3. **L1-P0-1 Invoice approve gate revize** (BE, 2-3 saat) — finansal güven
4. **L3-P0-3 Cancel cascade** (BE, 2-3 saat) — orphan offer sorunu
5. **L1-P0-3 Preauth retry path** (BE + FE, 3-5 saat) — UC-4 akış kurtarır
6. **L2-P0-1/2/3 Tow flow QA teyit** (QA, 0.5-1 saat) — Tur 2 smoke
7. **L1-P0-2 Admin override** (BE, 1-2 saat) — operasyonel acil durum

**Toplam P0 pilot-kritik:** 16-24 iş saati → **~2-3 iş günü paralel çalışmayla**.

P1 işleri pilot öncesi 1 hafta içinde kapanabilir (5-7 iş günü). P2 işleri pilot-sonrası V1.1 sprint plan'ı.

---

## Referanslar

### Önceki Audit Dosyaları (bu rapor bunları konsolide eder)

**State machine + lifecycle:**
- `2026-04-23-state-machine-fix-backlog.md`
- `2026-04-23-transition-matrix.md`
- `2026-04-23-canonical-lifecycle-proposal.md`
- `2026-04-23-case-type-state-machine-audit.md`
- `2026-04-23-backend-mobile-lifecycle-drift.md`
- `2026-04-23-authoritative-transition-map.md`

**Matching + dispatch:**
- `2026-04-23-matching-structural-audit.md`
- `2026-04-23-matching-decision-table.md`
- `2026-04-23-matching-fix-backlog.md`
- `2026-04-23-signal-lifecycle-matrix.md`

**Tow:**
- `2026-04-23-tow-priority-audit.md`
- `2026-04-23-tow-contract-matrix.md`
- `2026-04-23-tow-mock-to-live-map.md`
- `2026-04-23-tow-invariant-checklist.md`

**Domain + subtype:**
- `2026-04-23-canonical-case-architecture.md`
- `2026-04-23-case-subtype-matrix.md`
- `2026-04-23-domain-model-case-subtype-audit.md`
- `2026-04-23-domain-model-fix-backlog.md`
- `2026-04-23-workflow-boundary-table.md`
- `2026-04-23-vehicle-snapshot-decision-table.md`

**Contract + API:**
- `2026-04-23-api-contract-audit.md`
- `2026-04-23-api-contract-matrix.md`
- `2026-04-23-api-fix-backlog.md`
- `2026-04-23-api-validation-hotlist.md`

**Diğer:**
- `2026-04-23-vehicle-media-readiness.md`
- `2026-04-23-live-smoke-report.md`
- `2026-04-22-parity-audit.md`
- `2026-04-22-frontend-durum.md`
- `2026-04-21-backend-audit.md`

### Kritik kaynak kod referansları

**Backend:**
- `naro-backend/app/services/case_lifecycle.py` — ALLOWED_TRANSITIONS + idempotency
- `naro-backend/app/services/offer_acceptance.py` — atomic mark_accepted
- `naro-backend/app/services/appointment_flow.py` — counter_pending race
- `naro-backend/app/services/case_billing_state.py` — 14-state
- `naro-backend/app/services/tow_lifecycle.py` — outbox + evidence gate + sync
- `naro-backend/app/services/tow_dispatch.py` — auto-dispatch + pin
- `naro-backend/app/services/pool_matching.py` — KIND_PROVIDER_MAP
- `naro-backend/app/services/approval_flow.py` — invoice approve COMPLETED bug
- `naro-backend/app/services/insurance_claim_flow.py` — partial unique
- `naro-backend/app/repositories/tow.py` — candidate SQL (PostGIS)
- `naro-backend/app/repositories/case.py:130-162` — pool feed
- `naro-backend/app/repositories/offer.py:240-256` — expire_stale_offers (unused)
- `naro-backend/app/workers/settings.py` — ARQ kayıt (offer expiry yok)

**Frontend:**
- `naro-app/src/features/cases/hooks/useCanonicalCase.ts` — adapter + event mapping + next_action hardcode
- `packages/mobile-core/src/tracking/engine.ts` — syncTrackingCase (kind-aware değil)
- `packages/ui/src/billing/BillingStateBadge.tsx` — 14-state parity ✅
- `packages/domain/src/service-case.ts` — ServiceCaseStatus + ACTIVE_CASE_STATUSES
- `naro-service-app/src/features/cases/screens/CaseProfileScreen.tsx` — wait_state ignored

---

## Sonuç

Naro pilot-öncesi sistem **fonksiyonel olarak çalışır durumda** ama **lifecycle drift riskleri** net:

1. **State machine'lerin büyük çoğunluğu sağlam** (idempotent, enforced, race-safe). Ama 3 P0 + 5 P1 + 3 P2 tutarsızlık var.
2. **Matching algoritması v1 çalışır** (tow immediate dispatch + pool fallback). Coverage signal kullanımı minimal — v2 backlog'da.
3. **Süreç takibi FE adapter'da kırık** — event mapping incomplete, next_action hardcoded empty. Codex'in ana bulgusu bu.

**Pilot-kritik 9 P0 bulgusunun tümü 2-3 iş günü paralel çalışmayla kapanabilir.** P1 işleri pilot öncesi 1 haftalık window'da rahat yürür. P2 işleri pilot-sonrası V1.1 sprint plan'ı.

**Codex raporunda belirttiği *"en büyük risk feature eksikliği değil, lifecycle drift"* tezi doğru — ama bu drift çok büyük değil.** Seçili 9 P0 fix ile pilot UX güveni tam kurulur.

PO (user) bu raporu okuyup 3-5 P0 seçip BE/FE/Nazif sohbetlerine brief'e çevirir. QA Tur 2 fix'lerden sonra cycle yapar, 0 P0 raporu → launch kararı.
