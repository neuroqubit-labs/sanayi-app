# Vaka Omurgası — Düzeltme Haritası (2026-04-26)

**Mod:** Ürün geliştirme — sabit lansman tarihi yok, mimarinin kusursuz oturması öncelik.
**Canonical referanslar:**
- [docs/naro-vaka-omurgasi.md](../naro-vaka-omurgasi.md) — PO sesinden anlatı
- [docs/naro-vaka-omurgasi-genisletilmis.md](../naro-vaka-omurgasi-genisletilmis.md) — Codex'in sistem dili genişletmesi
- [docs/audits/2026-04-25-ai-ownership-playbook.md](2026-04-25-ai-ownership-playbook.md) — Audit metodolojisi

**Statü:** 21 atomik düzeltme. Sınıflandırma "saat baskısı" değil, **mimari etki + bağımlılık zinciri** üzerinden.

---

## Sınıflandırma

- **A. Mimari taban düzeltmeleri** — vakanın temel sözleşmesini ihlal eden kod gerçekleri; ürün omurgasında kararlar verildi, kod uyumlu olmalı.
- **B. Yüzey iyileştirmeleri** — UX dili, ek guard'lar, soft-delete tutarlılığı; iş mantığını bozmuyor ama doğru yapı için lazım.
- **C. Smoke / doğrulama** — A+B sonrası uçtan uca davranışın canlı test edilmesi.
- **D. Roadmap (sonraki audit'lerden gelecek)** — playbook §6 sonraki adımlardan (security/privacy, public showcase, vb.) çıkacak işler; şimdi sırada değil.

**Doğrulama notları (2026-04-26):**
- F3 yanlış pozitif çıktı — capture hook zaten var; regression test öner.
- F1'in özü `source` field'ı değil, `offer_id` zorunluluğu (`create_direct_request` endpoint offer'sız çalışıyor).
- F2'de `description` field zaten var (optional); `kind in (PARTS_REQUEST, INVOICE)` durumunda zorunlu yapılması gerekiyor.
- **F21 (Adım 2/10 case state machine audit):** `POST /approvals` terminal state guard eksik — COMPLETED/CANCELLED vakada approval açılabiliyor.

---

## A. Mimari Taban Düzeltmeleri (~9-10 sa)

### F1 — Doğrudan Randevu Yolu Kapatılması (~45 dk, BE+FE)

**Kural:** Müşteri teklif olmadan bakım/arıza/hasar için doğrudan randevu talep edemez. Yalnızca usta teklifi kabul ederek randevu tetiklenir; veya §4 "ustaya vaka bildir" ile bildirim atılır.

**Kod gerçekliği:**
- [naro-backend/app/api/v1/routes/appointments.py:87-157 `create_direct_request`](../../naro-backend/app/api/v1/routes/appointments.py#L87) — endpoint docstring "Direct randevu talebi (müşteri → teknisyen, offer'sız)" diyor.
- [AppointmentRequest schema](../../naro-backend/app/schemas/appointment.py) — `offer_id: UUID | None` (optional). Bu yüzden offer'sız randevu mümkün → ürün kuralına aykırı.

**Fix (BE, ~20dk):**
- [appointments.py:93 create_direct_request](../../naro-backend/app/api/v1/routes/appointments.py#L93) — `if payload.offer_id is None` kontrolü ekle → 422 `{"type": "appointment_requires_offer"}`
- Pure test: `test_appointment_requires_offer_pure.py`
  - Case A: `offer_id=None` → 422 `appointment_requires_offer`
  - Case B: geçerli `offer_id` → 201
- (Opsiyonel) Endpoint docstring'i güncelle: "Offer-based randevu talebi (offer_accept yolu)"

**Fix (FE, ~25dk):**
- [naro-app/src/features/cases/screens/](../../naro-app/src/features/cases/screens/) — `direct_request` source ile `POST /appointments` çağıran kullanım yeri var mı, grep et:
  ```bash
  grep -rn "source.*direct_request\|/appointments" naro-app/src/features/
  ```
- Varsa: "ustadan randevu iste" CTA kaldır; yerine §4 "ustaya vaka bildir" akışı (F5).
- [naro-service-app/src/features/jobs/](../../naro-service-app/src/features/jobs/) — sadece offer-based appointment approve/decline akışı (zaten muhtemelen böyle, doğrula).

**Kabul:** Pure test PASS; FE'de `direct_request` çağrısı yok.

**Sahibi:** BE-dev (gate + test) + FE-dev (CTA audit)

---

### F2 — Ek Ödeme → "Kapsam Onayı" Yeniden Adlandırma (~1.5 sa, FE-heavy + BE light)

**Kural:** "Ek ödeme" dili kaldırılır. Parts/invoice approval modeli kalır; copy ve UX yeniden konumlandırılır:
- "Ek ödeme" → "Kapsam onayı" (parts approval) ve "Final fatura" (invoice approval)
- Gerekçe alanı zorunlu (usta neyi neden eklediğini yazar)
- Müşteri tarafında bilinçli kabul UX'i — sürpriz hissi yok

**Kod gerçekliği:**
- [approvals.py:188 ApprovalRequestPayload](../../naro-backend/app/api/v1/routes/approvals.py#L188) — `description: str | None` (optional)
- [case_billing.py:333 handle_parts_approval](../../naro-backend/app/services/case_billing.py#L333) signature: `additional_amount: Decimal` var, `reason` yok
- BillingState `ADDITIONAL_HOLD_REQUESTED → ADDITIONAL_HELD` transition aktif (line 351-380)

**Backend (~30 dk):**
- [approvals.py request_approval_endpoint](../../naro-backend/app/api/v1/routes/approvals.py) — `ApprovalRequestPayload` Pydantic schema'sında `kind in (PARTS_REQUEST, INVOICE)` ise `description` field'ı zorunlu (`min_length=10` öner). Pydantic `model_validator(mode="after")` ile.
- [case_billing.py handle_parts_approval](../../naro-backend/app/services/case_billing.py) — signature'a `reason: str` ekle; `request_payload`a kayıt
- approval_flow.request_approval — `description` parametresi yine geçirilsin (zaten geçiyor); kind validation eklensin
- Pure test: `test_parts_approval_requires_description_pure.py` → kind=PARTS_REQUEST, description=None → 422

**Frontend (~1 sa):**
- [CaseApprovalScreen.tsx](../../naro-app/src/features/cases/screens/CaseApprovalScreen.tsx) — başlık "Ek Ödeme" → "Kapsam Onayı"; gerekçe (description) prominent görünür
- naro-service-app `JobApprovalComposer` (veya benzeri) — "ek tutar" + "neden" textarea; required gate (FE side)
- Domain Zod schema: `ApprovalRequestPayloadSchema`'da kind=PARTS_REQUEST/INVOICE → description min 10 char refinement
- Customer-app + service-app copy: "ek ödeme", "ek ücret", "ekstra tutar" stringleri grep et → "Kapsam onayı / Final fatura" ile değiştir

**Kabul:**
- Pure test PASS (description boş → 422)
- Code grep: customer/service app klasörlerinde "ek ödeme" / "ek ücret" stringi sadece dokümantasyonda; UI'da yok
- Manual smoke (F13): kapsam onayı ekranında gerekçe görünür

**Sahibi:** BE-dev (validator + test) + FE-dev (copy + Zod)

---

### F3 — Tow Capture Hook ✅ DOĞRULANDI (no fix, regression test öner)

**Önceki agent iddiası (yanlış pozitif):** "DELIVERED stage'inde `capture_final()` tetiklenmiyor."

**Gerçek durum (2026-04-26 verification):** Capture hook **zaten var.**
- [tow/dispatch.py:152-166](../../naro-backend/app/api/v1/routes/tow/dispatch.py#L152) — `if target == TowDispatchStage.DELIVERED: ... await payment_svc.capture_final(...)`
- [tow_payment.py:137 capture_final](../../naro-backend/app/services/tow_payment.py#L137) — idempotency_key var (`f"capture:{settlement.id}"`), state guard var (`PREAUTH_HELD` → ...)

**Önerilen aksiyon (~15 dk):**
Regression koruma için pure test ekle:
- `test_tow_delivered_triggers_capture_pure.py`
  - Stage `DELIVERED`'a transition → `capture_final` çağrılır → `PaymentState.CAPTURED`
  - Çift transition → idempotent, ikinci kez capture çağrılmaz
  - `preauth_id` yoksa (settlement zayıf) → capture skip, log

**Kabul:** Pure test PASS; F9 smoke senaryosu (acil çekici uçtan uca) zaten bu davranışı doğruluyor.

**Sahibi:** BE-dev (regression test) — opsiyonel, F9 smoke yeterli sayılabilir.

---

### F4 — 3 Eksik Blueprint Template Seed (~1.5 sa, BE)

**Sorun:** [workflow_seed.py](../../naro-backend/app/services/workflow_seed.py)'da 4 template var (DAMAGE_INSURED/UNINSURED, MAINTENANCE_STANDARD/MAJOR); 3 enum eksik:
- BREAKDOWN_STANDARD
- TOWING_IMMEDIATE
- TOWING_SCHEDULED

→ `resolve_blueprint` `UnknownBlueprintError` raise → BREAKDOWN/TOWING case create crash riski.

**Fix:** 3 template seed (genişletilmiş §8.1 pattern'ları):
- BREAKDOWN_STANDARD: 5 milestone (kabul → ön teşhis → kapsam → onarım → teslim) + 1 completion approval
- TOWING_IMMEDIATE: tow_stage zaten zengin, 1 milestone (teslim_edildi) + 1 completion approval
- TOWING_SCHEDULED: aynı (planlı için ek not)

**Kabul:** 4 türden 1 vaka oluştur → blueprint seed çalışıyor; case_milestones+case_tasks tabloları doluyor.

**Sahibi:** BE-dev

---

### F5 — "Ustaya Vaka Bildir" Mini Implementasyon (~6-7 sa, BE+FE+FE)

**Kural (anlatı §4 + genişletilmiş §6):** Müşteri teklif olmayan vakada keşif/profile sayfasından usta seçip vaka bildirir. **Bildirim ile havuz paralel çalışır** — "ya/ya da" değil, ikisi aynı anda:
- Ustanın bildirim listesine düşer.
- Aynı vaka havuza eklenir; ustanın havuz feed'inde **etiketli/öne çıkarılmış** kart olarak görünür ("size bildirildi" rozeti).
- Müşteri tarafında vaka feed'inde **"teklif gelenler" en üstte ayrıştırılmış** sıralama.

**5A — Backend (~2 sa):**
- Model: ayrı `CaseTechnicianNotification` tablosu (case_id, technician_id, customer_user_id, status: PENDING/SEEN/DISMISSED/OFFERED, timestamps). **Karar:** ayrı tablo gerekli; `case_events` immutable event log, bildirim status'u mutable.
- Migration: tablo create + (case_id, technician_id) UNIQUE
- Endpoint: `POST /cases/{case_id}/notify-technicians` body `{technician_ids: [UUID]}` — case ownership + technician active validation. **Havuza ekleme aynı transaction'da yapılır** (separate flag yok; her zaman ikisi).
- Endpoint: `GET /technicians/me/notifications` — usta tarafı bildirim listesi
- Pool feed query'si: notification varsa `is_notified_to_me` flag'i ile dön (havuz UI'da etiket için)
- Customer cases query'si: pool offers count > 0 ise `has_offers=true` flag'i (sıralama için)
- case_events: `CASE_NOTIFICATION_SENT` event type
- Push notification entegrasyonu (existing infra)
- Pure test: notify endpoint + duplicate guard + ownership + havuz join

**5B — FE Customer (~2 sa):**
- Search/Profile screen — mevcut "Randevu al" CTA'sı **"Servise bildir"** olarak değişir (canonical §4: usta süreçten habersizken randevu olamaz).
- CTA tıklanınca: açık vakalar list → seç → bildir; veya "Vaka oluştur + bildir" mini-flow.
- Onay: "Vakanız ustaya bildirildi; ustanın teklifi gelince burada görüntülenir."
- Vaka feed'inde **"teklif gelenler" sıralama**: `has_offers=true` olanlar en üstte, ayrı section.

**5C — FE Service (~2 sa):**
- **Memory kuralına uygun:** 4 sabit tab (`havuz / islerim / index / profil`) korunur. Yeni tab eklenmez.
- Bildirimler **havuz tab'ı içinde alt sekme** veya **home (`index`) widget kartı** olarak gösterilir. (UX detayı: havuz listesinde "Size bildirilen" filter chip + en üstte ayrı section daha temiz olur.)
- Havuz kartında **"size bildirildi" rozeti** + standart havuz akışı.
- Notification kartı: vaka özeti + "Vakaya teklif ver" CTA → existing offer composer.
- Teklif composer'ında randevu önerisi: **takvim değil, etiket bazlı geniş müsaitlik** ("bugün", "yarın", "önümüzdeki hafta"). Backend `Appointment.slot` JSONB içine `kind: "label"` + `label: string` taşınır.
- Push handler: notification arrival → tab badge.

**5D — Smoke (~30 dk):**
- Customer keşif → 1 usta seç → "Servise bildir" → service-app havuzunda etiketli görün → teklif yolla (etiket bazlı randevu) → customer feed'de "teklif gelenler"de görün → kabul → ödeme → eşleş.

**Kabul:**
- Uçtan uca cihaz çiftinde çalışıyor.
- Servis-app'te havuzda "size bildirildi" rozeti görünüyor; yeni tab eklenmedi (memory uyumu).
- Müşteri-app'te "teklif gelenler" en üstte ayrı section.
- Teklif randevu önerisi etiket bazlı (sabit gün/saat değil).

**Sahibi:** BE-dev (5A) + FE-dev (5B + 5C) + Integration-QA (5D).

**Risk:** Yüzey alan büyük. Tasarım minimal: list + chip + rozet, no fancy modal.

---

### F6 — Pool Feed IMMEDIATE Tow Filter Doğrulama (~30 dk, BE)

**Sorun:** Agent çelişmesi — IMMEDIATE tow case `status=MATCHING` kalıyorsa pool feed'de görünebilir.

**Doğrulama:**
- [repositories/case.py:130-190](../../naro-backend/app/repositories/case.py#L130) `list_pool_cases` filter'ları
- [services/pool_matching.py:16-24](../../naro-backend/app/services/pool_matching.py#L16) `KIND_PROVIDER_MAP[CEKICI]`
- TestClient: IMMEDIATE tow oluştur → `GET /pool/feed` (CEKICI rolü) → görünüyor mu?

**Fix (gerekirse):** `list_pool_cases` query'sine LEFT JOIN `tow_cases` + `WHERE tow_cases.tow_mode != 'immediate' OR tow_cases IS NULL`. Test: `test_pool_feed_excludes_immediate_tow_pure.py`.

**Kabul:** USTA login → 3 non-tow vaka görünüyor; CEKICI login → sadece scheduled tow görünüyor (immediate görünmemeli).

**Sahibi:** BE-dev

---

### F7 — Anlatı §6 + Genişletilmiş §9 Senkronu (DONE)

Anlatı §6 "tam kaldır" → "kapsam onayı kavram revizyonu"na uyumlandırıldı (2026-04-26). Düzenleme tamamlandı; F2 ile devam edilecek.

**Sahibi:** PO/me ✅

---

### F8 — Anlatı §3.6 + Genişletilmiş §4 Senkronu (DONE)

Anlatı §3.6 "havuz+teklif" → "scheduled dispatch direct V1"e revize edildi (2026-04-26). Genişletilmiş §4'teki "V1.1 çekici teklif iste" backlog'a alınacak.

**Sahibi:** PO/me ✅

---

### F21 — Approval Terminal State Guard (~35 dk, BE) — Adım 2 audit bulgusu

**Kural (anlatı §15 + genişletilmiş §11):** COMPLETED/CANCELLED/ARCHIVED vakada usta yeni approval (parts/invoice/completion) açamaz.

**Kod gerçekliği:**
- [approvals.py:183-233 request_approval_endpoint](../../naro-backend/app/api/v1/routes/approvals.py#L183) — `case.status` terminal kontrolü **YOK**
- Mevcut akışta: vaka COMPLETED → usta POST /approvals → 201 dönüyor (olmamalı)
- [terminal_states.py:20-28 CASE_TERMINAL](../../naro-backend/app/domain/terminal_states.py#L20) — `frozenset({COMPLETED, CANCELLED})` zaten mevcut, kullanılabilir

**Fix (~15 dk):**
- `request_approval_endpoint` line ~191 sonrası, ownership check'in hemen ardından:
  ```python
  if case.status in (ServiceCaseStatus.COMPLETED, ServiceCaseStatus.CANCELLED, ServiceCaseStatus.ARCHIVED):
      raise HTTPException(
          status_code=422,
          detail={"type": "case_terminal", "status": case.status.value},
      )
  ```
- (Mevcut `CASE_TERMINAL + CASE_SINK` constant'ları kullanmak daha temiz olur — duplicate enum literal yerine.)

**Pure test (~20 dk):** `test_approval_terminal_guard_pure.py`
- COMPLETED case → POST /approvals → 422 `case_terminal`
- CANCELLED case → 422
- ARCHIVED case → 422
- ACTIVE case (örn. SERVICE_IN_PROGRESS) → 201

**Kabul:** Pure test PASS. Smoke F11'de bir vakayı bitirdikten sonra approval denemesi 422 dönüyor.

**Sahibi:** BE-dev (Codex)

**Kaynak:** Adım 2/10 (Case State Machine) audit — [docs/audits/2026-04-26-vaka-omurgasi-fix-haritasi.md F14 ile yakından ilişkili].

---

## C. Smoke / Doğrulama Senaryoları (~3 sa)

A grubu (mimari taban) bittikten sonra cihaz çiftinde uçtan uca testler.

### F9 — Smoke 1: Acil Çekici Uçtan Uca (~30 dk)

İstanbul'dan tow başlat → ödeme → preauth → dispatch → çekici ACCEPTED → en_route → arrived → loading → in_transit → DELIVERED → DB'de `payment.state=CAPTURED` doğrula.

**Sahibi:** Integration-QA

---

### F10 — Smoke 2: Hasar Vaka Uçtan Uca (~45 dk)

Hasar vakası oluştur → havuza düş → usta teklif → müşteri kabul → ödeme yöntemi (online) → randevu → usta APPROVED → ödeme çekildi → vaka süreç ekranı 2 tarafta görünüyor → (varsa kapsam onayı) → completion → puanlama.

**Sahibi:** Integration-QA

---

### F11 — Smoke 3: Bakım + Arıza Vaka (~30 dk)

Aynı zincir bakım+arıza için. F4'ün blueprint seed'leri çalışıyor mu — case_milestones+case_tasks tabloları doluyor.

**Sahibi:** Integration-QA

---

### F12 — Smoke 4: Pool Feed Filtreleme (~15 dk)

USTA rolü login → 3 non-tow vaka görünüyor; CEKICI rolü login → sadece scheduled tow görünüyor (immediate görünmemeli). F6'nın doğrulaması.

**Sahibi:** Integration-QA

---

### F13 — Smoke 5: Ek Ödeme Yokluğu / Kapsam Onayı Dili (~30 dk)

Parts approval flow'da "ek ödeme" stringi UI'da yok; "Kapsam Onayı" başlığı + gerekçe alanı zorunlu görünüyor; sürpriz hissi yok. F2'nin doğrulaması.

**Sahibi:** Integration-QA

---

## B. Yüzey İyileştirmeleri + D. Roadmap (sonraki audit'lerden gelecek)

**B grubu (yüzey iyileştirmeleri):** F14 (terminal state guard kalıntıları), F15 (request_draft misuse), F16 (sigorta ownership), F17 (public showcase), F18 (pattern source-of-truth). A bittikten sonra ele alınır; mimari etkisi yok ama doğru yapı için lazım.

**D grubu (roadmap):** F19 (step-up auth, Adım 10 audit'inden gelecek), F20 (notification kanal genişletme, F5'in V2'si).

### F14 — Terminal State Guard Düzeltmeleri (Adım 2 audit kalıntıları)

**Adım 2/10 (2026-04-26) bulguları — case.status vs tow_stage drift incelendi: PASS ✅** (UI tow_stage doğrudan consume ediyor, sync_case_status mekanizması mevcut). Ama 2 sekonder gap kaldı:

**F14.1 — Offer Creation Terminal Guard (🟠 ~30 dk):**
- Offer creation endpoint/repository'de `case.status` terminal check yok
- COMPLETED/CANCELLED case'ye teklif gelmesi mümkün
- Fix: offer create path'inde CASE_TERMINAL guard

**F14.2 — `list_cases_for_vehicle` Soft-Delete Eksiği (🟡 ~20 dk):**
- [repositories/case.py:228-236 list_cases_for_vehicle](../../naro-backend/app/repositories/case.py#L228) — `deleted_at.is_(None)` filter eksik
- Diğer `list_*` fonksiyonlar filter ediyor (drift)
- Fix: filter ekle + test

**Sahibi:** BE-dev (post-pilot — F21 zaten kritik olanı kapsıyor)

---

### F15 — Audit: request_draft Source-of-Truth Misuse (Genişletilmiş §2.1)

**Kural:** `request_draft` sadece immutable audit/snapshot; kritik karar için kullanılmamalı.

**Audit:** Backend service+route layer'da `request_draft` üzerinden karar alan kod var mı? Varsa typed alanlar/subtype tablolarına taşı.

**Sahibi:** BE-dev

---

### F16 — Audit: Sigorta Dosyası Ownership (Genişletilmiş §12)

**Kural:** Sigorta dosyası `ServiceCase(kind=accident)` alt relation'ı; ayrı vaka türü değil.

**Audit:** Insurance claim oluşturma akışı case ownership ve accident/towing ayrımını doğru kontrol ediyor mu?

**Sahibi:** BE-dev

---

### F17 — Audit: Public Showcase İki Taraf Onay (Genişletilmiş §13)

**Kural:** Tamamlanan vaka usta public profilinde gösterilebilmesi için: varsayılan kapalı + teknisyen onayı + müşteri onayı + PII yok + plaka/VIN/açık adres yok + private media public copy.

**Audit:** Mevcut `case_public_showcase` modeli ve endpoint'leri — onay matrisi enforce ediyor mu? PII redaction var mı? Revoke düşürme çalışıyor mu?

**Sahibi:** BE-dev + FE-dev

---

### F18 — Pattern Source-of-Truth Standardize (Genişletilmiş §16.5)

**Kural:** Backend `workflow_blueprint` canonical; FE presentation config; BE approval/task/event validasyonları.

**İş:**
- workflow_blueprint canonical hâle getir (FE'de magic string elimine)
- FE config: presentation only (ikon, renk, başlık)
- BE: task/approval/event validasyonu
- Müşteri+usta ek adım eklenebilirliği (anlatı §5 son kısmı)

**Sahibi:** BE-dev + FE-dev

---

### F19 — Step-Up Auth (Roadmap — Adım 10 audit'inden gelecek)

Yer tutucu. Playbook §6 Audit Görev #10 (Security/Privacy) sırasında detaylandırılacak. IBAN, email change, payout settings vb. high-risk operasyonlar için re-auth OTP. Şimdi kapsam dışı.

---

### F20 — Notification Kanal Genişletme (Roadmap)

Yer tutucu. F5 ile bildirim altyapısı kurulduktan sonra kanal hiyerarşisi (push + in-app + email), user preferences, rate-limit, redaction ele alınacak. F5'in V2'si.

---

## Bağımlılık Zinciri (Sıra)

Saat baskısı yok; sıra bağımlılıkla belirlenir.

```
Bağımsız (önce başlanır):
  F6  pool feed IMMEDIATE doğrula
  F7  ✅ anlatı §6 senkron
  F8  ✅ anlatı §3.6 senkron
  F3  capture regression test (opsiyonel)
  F4  3 blueprint template seed
  F21 approval terminal guard

Tek bağlı (F2 BE → F2 FE):
  F2 BE: description validator + handle_parts_approval reason
  F2 FE: copy + Zod (BE bittiğinde start)

İçsel bağlı (F5 alt parçaları sıralı):
  F5A  backend (model + migration + endpoints)
  F5B  customer FE (CTA değişikliği + bildir akışı)
  F5C  service FE (havuz rozet + etiket bazlı randevu)
  F1 FE bunlardan sonra (CTA değişikliği F5B ile uyumlu)

Smoke (her şey bittiğinde):
  F9-F13  uçtan uca cihaz testi
```

**Toplam dev:** ~9-10 saat. Smoke ~3 saat ek. Paralel ile duvar saati 5-7 saat (yeterli sayıda dev varsa).

---

## Olası Dağılım (paralel çalışma için)

Sohbet ayrımı zihin haritasına göre yapılıyor; aşağıdaki dağılım sabit rol değil, "doğal kümeleme":

| Küme | Maddeler | Toplam |
|---|---|---|
| **Backend ağırlıklı** | F1 BE, F3 regression, F4, F5A, F6, F21, F2 BE | ~6 sa |
| **Frontend ağırlıklı** | F1 FE (CTA cleanup), F2 FE (copy + Zod), F5B (customer), F5C (service) | ~5 sa |
| **Doküman + senkron** | F7 ✅, F8 ✅, anlatı/genişletilmiş senkron, smoke runbook | ~30 dk |
| **Smoke** | F9-F13 (5 senaryo) | ~3 sa |

Paralel ile duvar saati 5-7 saat.

---

## Dosya İndeksi (Ortak Çalışılan Yerler — Çakışma Riski)

**Yüksek riskli (paralel düzenleme dikkat):**
- [naro-backend/app/services/case_billing.py](../../naro-backend/app/services/case_billing.py) (F2A)
- [naro-backend/app/api/v1/routes/approvals.py](../../naro-backend/app/api/v1/routes/approvals.py) (F2A)
- [naro-backend/app/services/tow_lifecycle.py](../../naro-backend/app/services/tow_lifecycle.py) (F3)
- [naro-app/src/features/cases/screens/CaseApprovalScreen.tsx](../../naro-app/src/features/cases/screens/CaseApprovalScreen.tsx) (F2B)
- [naro-backend/app/services/workflow_seed.py](../../naro-backend/app/services/workflow_seed.py) (F4)

**Yeni dosyalar (çakışmasız):**
- `naro-backend/app/models/case_technician_notification.py` (F5A)
- `naro-backend/alembic/versions/20260426_*_case_notify.py` (F5A)
- `naro-app/src/features/notifications/` veya `naro-app/src/features/cases/notify-mini-flow.tsx` (F5B)
- `naro-service-app/src/features/notifications/` (F5C)
- `naro-backend/tests/test_pool_feed_excludes_immediate_tow_pure.py` (F6)
- `naro-backend/tests/test_tow_delivered_triggers_capture_pure.py` (F3)

---

## Kabul Kriterleri Özeti

A grubunu kapatabilmek için her madde **PASS** olmalı:

| # | Madde | Kabul |
|---|---|---|
| F1 | Offer-zorunlu randevu | Pure test: `offer_id=None` → 422; FE'de `direct_request` çağrısı yok |
| F2 | Kapsam onayı dili + zorunlu gerekçe | Pure test: PARTS_REQUEST + description=None → 422; UI'da "ek ödeme" yok |
| F3 | Tow capture (verified) | F9 smoke + opsiyonel regression test PASS |
| F4 | Blueprint seed | 4 türden case create blueprint çalışıyor (BREAKDOWN, TOWING_IMMEDIATE, TOWING_SCHEDULED) |
| F5 | Ustaya vaka bildir | Uçtan uca cihaz çiftinde çalışıyor |
| F6 | Pool filter | CEKICI feed'de IMMEDIATE yok (verify or fix) |
| F7 | Anlatı §6 senkron | ✅ |
| F8 | Anlatı §3.6 senkron | ✅ |
| F21 | Approval terminal guard | Pure test: COMPLETED/CANCELLED case → POST /approvals → 422 |
| F9-F13 | 5 smoke senaryo | Hepsi PASS |

B grubu (F14-F18) ayrı sprint; D grubu (F19-F20) ileride sırası geldiğinde audit'lerden açılacak.

---

## Codex'e Brief Notu (Bu Dosyayı Okurken)

Bu doküman doğrulanmış kod gerçekliğine dayanıyor (2026-04-26 itibarıyla):

✅ **Doğrulandı:**
- [appointments.py:87-157 create_direct_request](../../naro-backend/app/api/v1/routes/appointments.py#L87) — endpoint var, `offer_id` optional
- [case_billing.py:333 handle_parts_approval](../../naro-backend/app/services/case_billing.py#L333) — signature: `additional_amount` var, `reason` yok
- [approvals.py:188 ApprovalRequestPayload](../../naro-backend/app/api/v1/routes/approvals.py#L188) — `description: str | None`
- [tow/dispatch.py:152-166](../../naro-backend/app/api/v1/routes/tow/dispatch.py#L152) — DELIVERED → capture_final ZATEN ÇAĞRILIYOR
- [tow_payment.py:137 capture_final](../../naro-backend/app/services/tow_payment.py#L137) — idempotency var
- [workflow_seed.py:62 BLUEPRINT_TEMPLATES](../../naro-backend/app/services/workflow_seed.py#L62) — 4 entry: DAMAGE_INSURED, DAMAGE_UNINSURED, MAINTENANCE_STANDARD, MAINTENANCE_MAJOR
- [repositories/case.py:130 list_pool_cases](../../naro-backend/app/repositories/case.py#L130) + [pool_matching.py:16 KIND_PROVIDER_MAP](../../naro-backend/app/services/pool_matching.py#L16)
- `CaseTechnicianNotification` modeli **YOK** — F5'te yeni eklenecek
- `CASE_NOTIFICATION_SENT` event type **YOK** — F5'te eklenecek

❓ **Senin doğrulaman istenen (eğer alakasız bir şey görürsen söyle):**
- F1 fix yaklaşımı: `offer_id` zorunluluğu mu, yoksa endpoint'i tamamen kaldırma mı daha temiz? (Mevcut akışta `direct_request` source string'i hâlâ valid; tek gate offer_id.)
- F4 blueprint pattern detayları: BREAKDOWN_STANDARD için 5 milestone optimal mi, yoksa 3 (kabul/onarım/teslim) yeterli mi?
- F2 BE: Pydantic `model_validator(mode="after")` mı, kind-based ayrı schema mı daha temiz?
- F5C bildirim yerleşimi: havuz tab'ında alt sekme + "size bildirildi" rozeti mi, yoksa home widget kart mı? Memory kuralı: 4 tab sabit; yeni tab ekleme yasak.
- F5 randevu önerisi `Appointment.slot` JSONB içine `kind: "label"` taşımak doğru mu, yoksa ayrı kolon mu daha sağlam?

**Çekici tarafında PO onayı bekleyen 2 karar (anlatı §8 madde 6 + 7):**
- C1 — Planlı çekici ödeme penceresi açıldı, ödenmediyse timeout? (Önerim: pencerenin sonu = otomatik iptal. PO doğrula.)
- C2 — Çekici iptal fee matrisi: SEARCHING=0%, ACCEPTED/EN_ROUTE=50%, NEARBY/ARRIVED+sonrası=100% öneri. Kod tarafında `compute_cancellation_fee` fonksiyonu var; oran tablosu PO onayı bekliyor.

F5 model kararı (CaseTechnicianNotification ayrı tablo) zaten F5A gövdesinde verildi.
