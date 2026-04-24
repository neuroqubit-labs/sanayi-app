# Backend Uçtan Uca Denetim — 2026-04-21

> **Denetçi:** PRODUCT-OWNER sohbeti (PO audit, Hat A iş mantığı)
> **Kapsam:** `naro-backend/` kod + migrations + `docs/veri-modeli/` + `docs/` + 7 memory kararı
> **Yöntem:** Kod-seviyesi spot-check + 3 paralel Explore ajanı keşfi + docs karşılaştırması
> **Plan referansı:** `~/.claude/plans/5-boyutlu-yap-g-zel-bright-umbrella.md`

---

## 0. Yönetici özeti

**Tema:** Backend yapı-sağlam, domain-logic-dolu, ama **ürün kararları yansıma kalitesi orta**.

| Metrik | Skor |
|---|---|
| V1 tablo varlığı (doc ↔ kod) | ✅ 15/15 |
| Faz 6 karar execution | ✅ 5/5 |
| Faz 7a-d karar execution | ✅ 14 tablo |
| Ürün kararları yansıması (7 memory) | ⚠️ 2 ✅ · 3 ⚠️ · 2 ❌ |
| REST API kapsamı | ❌ 10 endpoint (sadece auth+media+health) |
| State machine enforcement | ✅ case+offer+appointment+claim solid |
| Concurrency disiplini | ⚠️ OFFER accept'te SELECT FOR UPDATE yok |
| Dış entegrasyonlar | ✅ SMS+S3 · ❌ PSP+Maps+Push |
| Test kapsamı | ❌ 2 dosya (%~2) |
| Observability | ⚠️ structlog ✅, metric export ❌ |

**Bulgu dağılımı:** **6 P0** · **8 P1** · **4 P2**

**Ana sonuç:**
- Backend core (case lifecycle + offer/appointment + insurance claim + auth + KYC + case_process + artifacts + communication + audit) **production-ready**.
- Ama **müşteri-görünür ürün semantiği** (acil çekici dispatch, servis tercihi enforcement, damage scoring, trust ledger) **henüz yazılmamış** — docs iddia ediyor, kod boş.
- Mobil app **mock fazında** olduğu için şu an bloke değil. Ama backend-mobile bağlantısı başlayınca P0 bulgular **gerçek müşteri davranışını kıracak**.

---

## 1. Eksen A — Şema / Doküman Tutarlılığı

[docs/veri-modeli/README.md](../veri-modeli/README.md) 16 domain sayıyor. Her birinin kod karşılığı:

| # | Domain | Doc | Migration | Model | Sonuç |
|---|---|---|---|---|---|
| 01 | Identity (User + Auth) | ✅ | 0002, 0015 | [user.py](../../naro-backend/app/models/user.py), [auth.py](../../naro-backend/app/models/auth.py), [auth_event.py](../../naro-backend/app/models/auth_event.py), [auth_identity.py](../../naro-backend/app/models/auth_identity.py) | ✅ Tam |
| 02 | Technician | ✅ | 0003 | [technician.py](../../naro-backend/app/models/technician.py) | ✅ V1 tam · V2 sinyal 0% (beklenen) |
| 03 | Vehicle | ✅ | 0004 | [vehicle.py](../../naro-backend/app/models/vehicle.py) | ✅ (fakat `history_consent_granted` alanı yok — bkz. §3.4) |
| 04 | Case | ✅ | 0005 | [case.py](../../naro-backend/app/models/case.py) | ✅ |
| 05 | Offer | ✅ | 0006, 0008 | [offer.py](../../naro-backend/app/models/offer.py) | ✅ slot_proposal + slot_is_firm |
| 06 | Appointment | ✅ | 0006, 0009 | [appointment.py](../../naro-backend/app/models/appointment.py) | ✅ source + counter_proposal + counter_pending |
| 07 | Case Process | ✅ | 0010 | [case_process.py](../../naro-backend/app/models/case_process.py) | ✅ milestones, tasks, approvals, line_items |
| 07b | Case Artifacts | ✅ | 0011 | [case_artifact.py](../../naro-backend/app/models/case_artifact.py) | ✅ evidence, documents, M:N links |
| 07c | Case Communication | ✅ | 0012 | [case_communication.py](../../naro-backend/app/models/case_communication.py) | ✅ threads, messages, attachments |
| 07d | Case Audit | ✅ | 0013 | [case_audit.py](../../naro-backend/app/models/case_audit.py) | ✅ events (27 type) + notification_intents |
| 08 | InsuranceClaim | ✅ | 0014 | [insurance_claim.py](../../naro-backend/app/models/insurance_claim.py) | ✅ state machine + partial unique active |
| 09 | MediaAsset | ✅ | 0001 | [media.py](../../naro-backend/app/models/media.py) | ✅ upload intent + presigned URL |
| 10 | Review + Campaign | doc skeletal | — | — | ⚠️ V2 planlı |
| 11 | Notification | doc skeletal | 0013 içinde intent | — | ⚠️ delivery katmanı V2 |
| 12 | EventLog | ✅ | 0013 | [case_audit.py](../../naro-backend/app/models/case_audit.py) | ✅ |
| 13 | Search | doc skeletal | pg_trgm index var | — | ⚠️ V2 |
| 14 | Anti-disinter | doc skeletal | — | — | ❌ boş (P0 — bkz. §3.7) |
| 15 | KVKK/Retention | doc skeletal | — | — | ⚠️ soft delete ✅, cron ❌ |
| 16 | Technician Sinyal Modeli (V2) | ✅ (yeni) | — | — | 🟡 kod 0% (Faz 8 beklenen) |

**Ek docs (yeni, implementation beklemede):**
- [docs/sinyal-hiyerarsi-mimari.md](../sinyal-hiyerarsi-mimari.md) — kod 0%, beklenen
- [docs/cekici-modu-urun-spec.md](../cekici-modu-urun-spec.md) — kod 0%, beklenen
- [docs/cekici-backend-mimarisi.md](../cekici-backend-mimarisi.md) — kod 0%, beklenen

**Sapma yok** V1 kapsamında. Doc ↔ kod senkron (Faz 6 KARAR-LOG execution teyitli).

---

## 2. Eksen B — REST API Kapsamı

[app/api/v1/router.py:1-8](../../naro-backend/app/api/v1/router.py) 3 router include ediyor: `auth`, `health`, `media`. **Toplam 10 endpoint:**

| Router | Endpoint sayısı |
|---|---|
| [auth.py](../../naro-backend/app/api/v1/routes/auth.py) | 5 (otp/request, otp/verify, refresh, logout, logout_all) |
| [media.py](../../naro-backend/app/api/v1/routes/media.py) | 4 (uploads/intents, uploads/{id}/complete, GET asset, DELETE asset) |
| [health.py](../../naro-backend/app/api/v1/routes/health.py) | 1 (/health) |

**Eksik router'lar:**

| Eksik | Var olan alt servis | Ne bloke |
|---|---|---|
| `/cases` | [case.py repo](../../naro-backend/app/repositories/case.py), [case_lifecycle](../../naro-backend/app/services/case_lifecycle.py) | Müşteri vaka aç/liste/detay/iptal, teknisyen havuz feed (list_pool_cases) |
| `/offers` | [offer repo](../../naro-backend/app/repositories/offer.py), [offer_acceptance](../../naro-backend/app/services/offer_acceptance.py) | Teklif gönder/kabul/red/withdraw |
| `/appointments` | [appointment_flow](../../naro-backend/app/services/appointment_flow.py) | Randevu onay/counter/confirm/decline |
| `/technicians` | [technician.py repo](../../naro-backend/app/repositories/technician.py), [technician_kyc](../../naro-backend/app/services/technician_kyc.py) | Profil CRUD, cert upload, verified_level |
| `/vehicles` | vehicles + user_vehicle_links | Araç ekle/liste/transfer |
| `/insurance-claims` | [insurance_claim_flow](../../naro-backend/app/services/insurance_claim_flow.py) | Sigorta dosyası submit/accept/reject/mark_paid |
| `/admin/*` | — | Teknisyen onay, cert review, case override |

**Mobil durumu:** Mobil şu an mock fazında ([CLAUDE.md](../../CLAUDE.md) "mock veriyle uçtan uca"). Backend çağrısı henüz yok. Bu yüzden eksik endpoint'ler **şimdiki müşteri deneyimini kırmıyor** ama mobil-backend bağlantısı başladığı anda bloker olacak.

**Sonuç:** P1 — Faz 8+ önce 5 router (case, offer, appointment, technician, vehicle) minimum, `/admin/*` ertelenir.

---

## 3. Eksen C — Ürün Kararları Yansıması

7 memory kararı kod kontrolü:

| # | Karar | Beklenen yansıma | Gerçek | Durum |
|---|---|---|---|---|
| 1 | **Matching rejimi** — acil çekici auto-dispatch, diğerleri bidding | `pool_matching.py`'da special path (kind=TOWING AND urgency=URGENT → dispatcher); case.py'de `tow_stage`, `tow_mode` kolonları | [pool_matching.py:16-21](../../naro-backend/app/services/pool_matching.py#L16) sadece `KIND_PROVIDER_MAP`; urgent towing da normal havuza düşer. Özel dispatch servis yok, tow-özel kolon yok, ARQ worker yok. | ❌ **P0** |
| 2 | **Servis şekli 3'lüsü** (yerinde/bırak/çekici) | `ServicePickupPreference` enum + `on_site_repair`/`valet_requested`/`towing_required` + matching input | Enum tanımlı [service_request.py:22-26](../../naro-backend/app/schemas/service_request.py#L22), boolean'lar `ServiceRequestDraftCreate`'te var. Ama `list_pool_cases` bu alanları filtreye almıyor; offer validation de `delivery_mode`'u müşteri tercihine karşı kontrol etmiyor. | ⚠️ Storage OK · Matching + validation yok (**P0**) |
| 3 | **Kullanıcı tercihi = talep (dayatma değil)** | Offer accept / submit'te tercih mismatch'i için business rule veya soft-warning | Offer submit [offer repo L25](../../naro-backend/app/repositories/offer.py#L25) `delivery_mode: str` serbest string; `ServiceRequestDraft.pickup_preference` ile karşılaştırma yok. | ❌ **P0** |
| 4 | **Araç geçmişi izin akışı** | `vehicles.history_consent_granted BOOL` + timestamp + audit event | [vehicle.py:39-60](../../naro-backend/app/models/vehicle.py#L39) `Vehicle` modelinde consent alanı **yok**; `plate, plate_normalized, make, model, year, color, fuel_type, vin, current_km, note, deleted_at`. | ❌ **P1** |
| 5 | **Hasar puanlama paleti** (% bazlı 10-ton yeşil→turuncu) | `service_cases.damage_score_pct SMALLINT` veya `ServiceRequestDraft.damage_score_pct` + UI palette lookup | [case.py:63-133](../../naro-backend/app/models/case.py#L63) + [service_request.py:138](../../naro-backend/app/schemas/service_request.py#L138) sadece `damage_area: str` serbest metin. Sayısal skor yok. | ❌ **P1** |
| 6 | **Bakım kapsamı** (14 kategori) | `MaintenanceCategory` enum + periodic/tire/glass_film/coating/... | [service_request.py:52-66](../../naro-backend/app/schemas/service_request.py#L52) enum tam — 14 değer. | ✅ |
| 7 | **Bakım paket mimarisi** (MaintenanceTemplate cross-app) | `maintenance_templates` tablosu + `maintenance_template_id` FK veya embed | `service_request.py:155` `maintenance_tier: str \| None` freeform; MaintenanceTemplate tablosu veya master liste **yok**. | ⚠️ **P1** |

### 3.1 Ek docs kararları (CLAUDE.md + docs/*.md)

| Karar | Kod |
|---|---|
| **Admission before distribution** (pending teknisyen havuzda görünmesin) | ✅ `UserRepository.create` [user.py:32-33](../../naro-backend/app/repositories/user.py#L32) teknisyen default=PENDING. **AMA** `list_pool_cases` havuz sorgusu ([case.py repo:75-96](../../naro-backend/app/repositories/case.py#L75)) teknisyen `users.status` veya `verified_level` filtresi uygulamıyor → endpoint eklendiğinde deps katmanında enforcement gerekli. |
| **Evidence-first** (söz yerine kanıt) | ✅ [case_artifact.py](../../naro-backend/app/models/case_artifact.py) + [evidence.py service](../../naro-backend/app/services/evidence.py) + evidence_requirements per-task. |
| **Trust ledger** (vaka boyunca kanıt birikimi + Bayesian rating) | ⚠️ Evidence collection ✅; ama performance snapshot / Bayesian rating aggregation **yok**. `verified_level` sertifika-bazlı statik. |
| **Anti-disintermediation** (PII maskeleme, thread-only) | ⚠️ Thread-only ✅ ([case_communication.py](../../naro-backend/app/models/case_communication.py)). Fakat phone/email masking, off-platform iletişim caydırma mekanizması **yok**. |

---

## 4. Eksen D — State Machine Enforcement

### 4.1 ServiceCase status
[case_lifecycle.py:25-36](../../naro-backend/app/services/case_lifecycle.py#L25) — 10 status × ALLOWED_TRANSITIONS dict. [L67-68] ihlal → `InvalidTransitionError`. [L72-73] terminal'de `closed_at=NOW()`. [L83-91] her transition `append_event`. ✅ **Solid.**

### 4.2 CaseOffer status
[offer_acceptance.py:63-66](../../naro-backend/app/services/offer_acceptance.py#L63) status PENDING/SHORTLISTED kontrolü → [L68] mark_accepted → [L70-74] siblings reject → [L86-96] dallanma (firm → appointment auto-create, non-firm → case.status='appointment_pending'). ✅

### 4.3 Appointment status
[appointment_flow.py](../../naro-backend/app/services/appointment_flow.py) — 6 transition fonksiyonu: approve, decline, cancel, counter_propose (Kural 5), confirm_counter, decline_counter. Her biri `_get_pending` veya status eşitlik kontrolü ile başlar (L96, L130, L159, L180, L213-217, L260-264). ✅

### 4.4 InsuranceClaim status
[insurance_claim_flow.py:67-72](../../naro-backend/app/services/insurance_claim_flow.py#L67) ALLOWED_TRANSITIONS dict + [L151-161] `_transition` guard + [L118-121] IntegrityError → `ClaimAlreadyActiveError` (race savunması partial unique ile). ✅

### 4.5 Eksik: ServiceCase.service_in_progress → completed geçişi için kanıt gate

[case_lifecycle.py](../../naro-backend/app/services/case_lifecycle.py) enum transition'a izin veriyor ama **"completion öncesi delivery_proof + invoice + customer_confirm kanıt zorunlu mu?"** kontrolü yok. Bu **evidence-first** prensibinin ihlali riski — kanıt katmanı var ama transition hook'u yok. **P1.**

---

## 5. Eksen E — Transaction + Concurrency

### 5.1 Commit disiplini
[user.py repo:25-38](../../naro-backend/app/repositories/user.py#L25) — `session.add + flush + refresh` (no commit). ✅ Faz 6 [8a] kararı uygulandı. Commit'ler route katmanında ([auth.py L85, L163, L247, L277](../../naro-backend/app/api/v1/routes/auth.py)).

### 5.2 Atomik transition
`transition_case_status` [case_lifecycle.py:56-94] tek await chain; session.execute + append_event tek transaction içinde (caller commit eder). ✅

### 5.3 Offer accept race
[offer_acceptance.py:60-96](../../naro-backend/app/services/offer_acceptance.py#L60) — `get_offer` + status check + `mark_accepted` arasında **SELECT FOR UPDATE yok**. İki paralel accept çağrısı aynı offer için:
- Her ikisi de PENDING gördüğü için check'i geçer
- İkisi de `mark_accepted` UPDATE'ı çalıştırır
- Race: aynı satır iki kez UPDATE (idempotent); ama **sibling reject loop ikisi de çalışır** → çift event + çift state confusion
- Kritik risk düşük (tek customer, tek tap), ama **teorik veri tutarlılık bozulması var**

Öneri: `offer_repo.mark_accepted` WHERE `status IN ('pending','shortlisted')` clause ile atomic UPDATE + `RETURNING` → etkilenen 0 satır → `OfferAlreadyAcceptedError`. **P0** (şimdi kırık değil ama veri integrity yarısı savunmasız).

### 5.4 Appointment counter_pending race
`confirm_counter` / `decline_counter` benzer pattern — `_get_appointment` sonrası status check ama FOR UPDATE yok. **Teorik P1.**

### 5.5 InsuranceClaim race
✅ Partial unique index + try/except IntegrityError → `ClaimAlreadyActiveError` — savunma tam.

### 5.6 OTP verify race
[otp.py](../../naro-backend/app/services/otp.py) — Redis-based; attemtp count + TTL. Detay okunmadı ama yapı sağlam izlenimi. **P2 follow-up** (spot-check önerilir).

---

## 6. Eksen F — Integration Layer

| Entegrasyon | Yer | Durum |
|---|---|---|
| SMS (Twilio + Console stub) | [app/integrations/sms/](../../naro-backend/app/integrations/sms/) | ✅ base + real + stub |
| S3 storage (presigned URL) | [app/integrations/storage/](../../naro-backend/app/integrations/storage/) | ✅ |
| **PSP (Iyzico)** | — | ❌ [docs/cekici-backend-mimarisi.md §14](../cekici-backend-mimarisi.md) K-P1 karar; kod 0% — **Faz 8 çekici bloker** (P1) |
| **Maps (Mapbox)** | — | ❌ K-P2 karar; kod 0% — **Faz 8 çekici bloker** (P1) |
| **Push notification (FCM/APNS)** | — | ❌ Notif intent tablo var ama delivery katmanı yok (P1) |
| Email | [messaging.py](../../naro-backend/app/services/messaging.py) | ⚠️ SMS yönlendirmesi; email router'ı yok |
| OAuth (Google/Apple) | auth_identity schema | ⚠️ Model hazır, provider-spesifik kod yok (V2) |

---

## 7. Eksen G — KVKK + Retention + Soft Delete

| Konu | Durum |
|---|---|
| `users.deleted_at` | ✅ |
| `vehicles.deleted_at` | ✅ |
| `service_cases.deleted_at` | ✅ |
| Partial unique phone/email (deleted_at IS NULL) | ✅ migration 0007 |
| `user_lifecycle.soft_delete_user` | ✅ Faz 6 [7b] |
| `revoke_all_sessions_for_user` | ✅ Faz 6 [11b] |
| Cascade FK disiplini (case_artifacts, case_messages) | ✅ Migration 0011-0012'de CASCADE on case |
| **Retention cron** (KVKK hard delete, GPS purge vb.) | ❌ (Faz 15 planlı — bkz. docs/veri-modeli/README.md §15) |
| PII log masking | ⚠️ [logging.py](../../naro-backend/app/core/logging.py) structlog + JSONRenderer; explicit PII scrubber processor **yok** — access token veya phone/email log'a düşerse maskelenmez (**P1**) |

---

## 8. Eksen H — Test + Observability

### 8.1 Test
| Dosya | Kapsam |
|---|---|
| [tests/test_health.py](../../naro-backend/tests/test_health.py) | GET /health |
| [tests/test_media_smoke.py](../../naro-backend/tests/test_media_smoke.py) | Upload intent + complete + asset CRUD |

**Eksik (kritik):**
- `tests/test_auth_otp.py` — OTP request/verify/refresh reuse attack
- `tests/test_case_lifecycle.py` — transition + forbidden transition
- `tests/test_offer_acceptance.py` — atomic accept + race (bkz. §5.3)
- `tests/test_appointment_flow.py` — 6 transition path
- `tests/test_insurance_claim_flow.py` — state machine + ClaimAlreadyActive
- `tests/test_technician_kyc.py` — verified_level recomputation
- `tests/test_user_lifecycle.py` — soft_delete + session revoke
- `tests/test_pool_matching.py` — KIND_PROVIDER_MAP

**Coverage tahmini:** ~%2-5. **P1 kritik** — regression sigortası yok.

### 8.2 Logging
[logging.py](../../naro-backend/app/core/logging.py) structlog + contextvars + iso timestamp + JSON (prod) / Console (dev). ✅ iyi temel. PII scrubber eksik (bkz. §7).

### 8.3 Observability
- Prometheus metric export: ❌ yok
- OpenTelemetry tracing: ❌ yok
- Health endpoint: var ama DB/Redis ping detayı bilinmiyor (spot-check önerilir)

Faz 8 çekici observability'si için zorunlu ([docs/cekici-backend-mimarisi.md §16](../cekici-backend-mimarisi.md)) — metric'ler olmadan dispatch sağlığı görülemez.

---

## 9. P0 Bulgu Listesi (ürün davranışı / güvenlik / data integrity)

### P0-1 — Acil çekici auto-dispatch YOK
- **Durum:** [memory/matching_regime.md] "acil çekici Uber-tarzı auto-dispatch" der. Ama [pool_matching.py:16-21](../../naro-backend/app/services/pool_matching.py#L16) sadece kind→provider map; özel `tow_dispatch` servisi, `tow_dispatch_attempts` tablosu, accept-window ARQ worker'ı yok.
- **Etki:** Yolda kalmış müşteri, kaza anında — çekici bulma süresi panik. Teklif havuzuna düşmesi "Uber vari" değil "Yemeksepeti vari". Ürün vaadi ([docs/cekici-modu-urun-spec.md](../cekici-modu-urun-spec.md)) kırık.
- **Önerilen aksiyon:** Faz 8 backend (BACKEND-DEV) — 4 yeni tablo + `tow_dispatch_service` + ARQ `tow_dispatch_loop` worker. Referans: [docs/cekici-backend-mimarisi.md §3,7,11](../cekici-backend-mimarisi.md).
- **Sorumlu sohbet:** BACKEND-DEV

### P0-2 — Offer accept'te race savunması zayıf
- **Durum:** [offer_acceptance.py:60-96](../../naro-backend/app/services/offer_acceptance.py#L60) SELECT FOR UPDATE yok; check-then-update pattern iki eşzamanlı çağrıda siblings iki kez reject edebilir + çift event.
- **Etki:** Müşteri iki tab'da aynı offer'a bastığında veya retry mekanizması çift çalıştığında — data integrity bozulur (teorik; müşteri davranışında nadir ama var).
- **Önerilen aksiyon:** `offer_repo.mark_accepted` içinde WHERE `status IN ('pending','shortlisted')` clause + RETURNING; etkilenen 0 satır → `OfferAlreadyAcceptedError`. Service'te bu exception'ı yakala.
- **Sorumlu sohbet:** BACKEND-DEV

### P0-3 — Pool admission gate enforcement yok
- **Durum:** [case.py repo:75-96](../../naro-backend/app/repositories/case.py#L75) `list_pool_cases` — teknisyen `users.status=PENDING` ise bile havuzu çeker (deps katmanında guard olmadığı sürece). Şu an endpoint yok, ama endpoint eklendiğinde gate unutulursa silent PENDING leak.
- **Etki:** **Admission before distribution** prensibi kırılır — kalite sıfır teknisyenler havuzu görür.
- **Önerilen aksiyon:** Endpoint eklenirken deps'de `require_active_technician` dependency yazılsın + `list_pool_cases` fonksiyonu technician.status + verified_level filtresi alsın.
- **Sorumlu sohbet:** BACKEND-DEV (endpoint yazımıyla)

### P0-4 — Anti-disintermediation (PII maskeleme) yok
- **Durum:** Thread-only messaging var ama phone/email masking, off-platform attempt detection yok. `users.phone` + `users.email` serbest alanlar.
- **Etki:** Platform ↔ usta ↔ müşteri zincirinde iletişim kaçışı kolay. Ürün tezi (anti-disintermediation) sistem-seviyesi korumadan yoksun.
- **Önerilen aksiyon:** V2 — ayrı faz. Şimdilik: (a) API response'da PII maskeleme middleware, (b) message pattern detection, (c) maskelenmiş telefon proxy (Twilio Proxy veya benzeri). [docs/veri-modeli/14-anti-disinter.md] spec'ini önce dok-doldur, sonra implement.
- **Sorumlu sohbet:** PRODUCT-OWNER (spec dok) → sonra BACKEND-DEV

### P0-5 — Kullanıcı tercihi = talep enforcement yok
- **Durum:** Offer submit'te `delivery_mode: str` serbest; `ServiceRequestDraft.pickup_preference` / `on_site_repair` / `valet_requested` ile karşılaştırma yok.
- **Etki:** Müşteri "yerinde onarım istiyorum" seçer; usta "dükkana getir" offer'ı atar; sistem uyarmaz. Müşteri confused → dispute riski.
- **Önerilen aksiyon:** Offer submit'te **soft-warning**: tercih mismatch → `badges`'a "tercih dışı" flag + frontend'de gri gösterme. Hard-reject değil — memory'e uygun olarak tercih dayatma değil. BACKEND-DEV + PO spec netleştirme.
- **Sorumlu sohbet:** PO → BACKEND-DEV

### P0-6 — REST API endpoint kapsamı (mobile-backend ciddi bağlantıda bloke olacak)
- **Durum:** Sadece 10 endpoint. Case/Offer/Appointment/Technician/Vehicle/Insurance router'ları yok. Mobil şu an mock ama prod'a çıkarken bloker.
- **Etki:** P0 olarak işaretleniyor çünkü "mobil-backend bağlantısı" stratejik milestone; endpoint olmadan hiçbir şey canlıya çıkamaz.
- **Önerilen aksiyon:** Faz 8 backend öncelikli — 5 router (case, offer, appointment, technician, vehicle). Schema'ları Zod ↔ Pydantic parity test zorunlu.
- **Sorumlu sohbet:** BACKEND-DEV

---

## 10. P1 Bulgu Listesi (faz planları bloke / performans / test)

### P1-1 — Vehicle history consent alanı yok
- [memory/vehicle_history_consent.md] → [vehicle.py](../../naro-backend/app/models/vehicle.py) alan yok. Araç ekleme akışında izin alınmıyor.
- **Aksiyon:** Migration: `ALTER TABLE vehicles ADD COLUMN history_consent_granted BOOL NOT NULL DEFAULT FALSE`, `history_consent_granted_at TIMESTAMPTZ`, `history_consent_revoked_at TIMESTAMPTZ`. Endpoint'te explicit onay. **Sorumlu:** BACKEND-DEV.

### P1-2 — Damage score palette veri altyapısı yok
- [memory/damage_score_palette.md] → % sayısal alan yok; sadece `damage_area: str`. Havuz kartında görsel palet gösterimi için sayısal veriye ihtiyaç var.
- **Aksiyon:** `service_cases.damage_score_pct SMALLINT CHECK (0-100)` veya `service_request_draft.damage_score`; AI intake ileride dolduracak, V1 manuel değer. **Sorumlu:** BACKEND-DEV + UI-UX-FRONTEND-DEV.

### P1-3 — Trust ledger / performance snapshots yok
- [verified_level](../../naro-backend/app/services/technician_kyc.py) sertifika-bazlı statik. Bayesian rating, response_time_p50, dispute_rate, warranty_honor, evidence_discipline score tabloları yok.
- **Aksiyon:** Faz 7 ([docs/veri-modeli/16-technician-sinyal-modeli.md](../veri-modeli/16-technician-sinyal-modeli.md)) `technician_performance_snapshots` tablosu + ARQ cron. **Sorumlu:** BACKEND-DEV.

### P1-4 — MaintenanceTemplate cross-app yok
- [memory/bakim_paket_mimarisi.md] MaintenanceTemplate şeması cross-app der. Backend'de `maintenance_templates` tablosu ve FK yok; sadece `maintenance_tier: str` freeform.
- **Aksiyon:** Template master tablo + `service_request_draft.maintenance_template_id` FK. **Sorumlu:** PO spec → BACKEND-DEV.

### P1-5 — Test coverage %2
- Sadece health + media smoke. Case/offer/appointment/auth/insurance test YOK.
- **Aksiyon:** Minimum 7 test dosyası Faz 8 öncesi. PR merge kontrolü için coverage threshold %60.
- **Sorumlu:** BACKEND-DEV.

### P1-6 — ARQ workers neredeyse boş
- [app/workers/](../../naro-backend/app/workers/) sadece `media.py` + `settings.py`. [docs/cekici-backend-mimarisi.md §10](../cekici-backend-mimarisi.md) 5 tow cron tasarlı; Faz 7 sinyal snapshot cron yok; offer expire cron yok ama `expire_stale_offers` [offer repo L166-182](../../naro-backend/app/repositories/offer.py#L166) fonksiyonu var — schedule yok.
- **Aksiyon:** Faz 8 worker expansion — `expire_stale_offers` scheduled, tow_dispatch_loop, tow_location_retention_purge, performance_snapshot_recompute. **Sorumlu:** BACKEND-DEV.

### P1-7 — PSP (Iyzico) entegrasyon yok
- Faz 8 çekici bloker. [docs/cekici-backend-mimarisi.md §14](../cekici-backend-mimarisi.md) K-P1 karar.
- **Aksiyon:** `PaymentProvider` Protocol + `IyzicoClient` concrete + fake harness. **Sorumlu:** BACKEND-DEV.

### P1-8 — Maps (Mapbox) entegrasyon yok
- Faz 8 çekici bloker. Reverse geocode + distance matrix + directions + caching.
- **Aksiyon:** `MapboxClient` + Redis cache + fallback (haversine). **Sorumlu:** BACKEND-DEV.

---

## 11. P2 Bulgu Listesi (ergonomi / doc drift)

### P2-1 — `domain-veri-modeli.md` kökte artakalan
- [docs/domain-veri-modeli.md](../domain-veri-modeli.md) — eski top-level dosya. `docs/veri-modeli/` dizini canonical. **CLEANER-CONTROLLER** denetlenir.

### P2-2 — PII scrub processor yok (logging)
- [logging.py](../../naro-backend/app/core/logging.py) structlog processors listesinde PII scrubber processor yok.
- **Aksiyon:** Custom processor `structlog.processors.format_exc_info` yanına `_scrub_pii` — phone/email/token pattern'leri `***` ile maskele. **Sorumlu:** BACKEND-DEV.

### P2-3 — Evidence gate completion öncesi yok
- `transition_case_status` SCHEDULED→SERVICE_IN_PROGRESS ve SERVICE_IN_PROGRESS→INVOICE_APPROVAL→COMPLETED geçişlerinde zorunlu kanıt kontrolü yok.
- **Aksiyon:** `transition_case_status` içinde pre-check: yeni status'a geçişte blueprint'in zorunlu task'ları completed mi? Evidence requirement'lar dolu mu? **Sorumlu:** BACKEND-DEV.

### P2-4 — `domain/veri-modeli` legacy path references
- Bazı doc'larda `../../sanayi-app/docs/veri-modeli/...` path'i var (cekici-backend-mimarisi içinde). Sembolic mi? **CLEANER-CONTROLLER** kontrol.

---

## 12. Faz Haritası (Yol Önerisi)

PO seçimi bekleyen önceliklendirme:

### Faz 7-backend (usta sinyal) — [plan mevcut](~/.claude/plans/faz-7-usta-sinyal-backend.md)
- P1-3 (performance snapshots) → sinyal şeması içeriyor
- Çözülen memory: V2 sinyal hiyerarşisi

### Faz 8-backend (çekici + REST endpoints)
- P0-1 (acil çekici auto-dispatch)
- P0-2 (offer accept race savunması) — küçük ama aynı PR'da
- P0-6 (REST endpoint'ler — case/offer/appointment/technician/vehicle)
- P1-7, P1-8 (PSP + Maps)
- P1-6 (ARQ genişleme)
- P0-3 (admission gate — endpoint yazımıyla)

### Faz 9-backend (ürün-veri eksikleri + PII)
- P1-1 (vehicle history consent)
- P1-2 (damage score)
- P1-4 (MaintenanceTemplate)
- P0-5 (kullanıcı tercihi soft-warning)
- P2-2 (PII scrub)
- P2-3 (evidence gate on transition)

### Faz 10-backend (trust + anti-disinter + KVKK retention)
- P0-4 (PII maskeleme tam)
- KVKK retention cron'ları
- Trust ledger aggregation genişletme

### Faz 11-backend (test + observability)
- P1-5 (test suite)
- Prometheus metric + OpenTelemetry trace

Faz 10-11 paralel sürebilir.

---

## 13. PO Aksiyon İstekleri

1. **Faz önceliği seç:** Aşağıdaki sıralama doğru mu? Faz 7 → 8 → 9 → 10 → 11. Değiştirmek ister misin? Örnek: P1-1/P1-2 (consent + damage) Faz 8'e önceler misin (UI-UX-FRONTEND-DEV çekici iterasyonu için blocker değil ama mobile-backend bağlantı zamanı kritik).
2. **P0-4 anti-disinter spec:** [docs/veri-modeli/14-anti-disinter.md] şu an skeletal. Önce doc derinlem (PO — ben), sonra implementation (BACKEND-DEV)? Yoksa Faz 10'a bırakalım mı?
3. **P0-5 tercih enforcement:** Soft-warning mi hard-reject mi? Memory "tercih, dayatma değil" der → soft-warning önerim. Onay mı?
4. **CLEANER-CONTROLLER devreye girsin mi?** P2-1 + P2-4 doc drift'i Cleaner'ın alanı.

---

## 14. Referanslar

- [~/.claude/plans/5-boyutlu-yap-g-zel-bright-umbrella.md](/home/alfonso/.claude/plans/5-boyutlu-yap-g-zel-bright-umbrella.md) — denetim planı
- [docs/veri-modeli/KARAR-LOG.md](../veri-modeli/KARAR-LOG.md) — execution teyit kaynağı
- [docs/veri-modeli/README.md](../veri-modeli/README.md) — 16 domain haritası
- [docs/sinyal-hiyerarsi-mimari.md](../sinyal-hiyerarsi-mimari.md) — Faz 7 kapsamı
- [docs/cekici-backend-mimarisi.md](../cekici-backend-mimarisi.md) — Faz 8 kapsamı
- Memory: matching_regime, user_preferences_are_requests, on_site_repair_capability, vehicle_history_consent, damage_score_palette, bakim_kapsami, bakim_paket_mimarisi

---

**Son güncellenme:** 2026-04-21 · PO denetim raporu · Aksiyon listesi PO seçiminden sonra faz planlarına dönüşür.
