# Frontend Durum Raporu — 2026-04-22

**Kapsam:** Naro customer + service mobil uygulamalarında bugün yapılan iş,
açık sorunlar, backend'den beklentiler ve pilot hazırlığı.

**Yazar:** FE dev. Kaynak: son 16 commit + parity audit + user test seansı.

---

## 1. Bugünkü commit haritası (16 commit, 6 grup)

### Grup A — Billing launch (sabah)
Faz B-3 son adımı + launch blocker handler.

| Commit | Özet |
|---|---|
| `6779120` | 401 handler — refresh token fallback + auth guard logout redirect (launch blocker fix) |
| `0def82d` | Billing B3 — Technician payout screen live (`/technicians/me/payouts`, brief §9) |
| `8783c9d` | (BE) Faz B-3 hotfix: 3DS checkout + webhook concrete — end-to-end canlı Iyzico |
| `f9dc951` | Service auth — verify ekranı canlı `admission_status` fetch + env default MOCK_AUTH=false |

### Grup B — Pilot polish + mock chain temizliği
Home/feed/search + composer UX + 3 parity hotfix.

| Commit | Özet |
|---|---|
| `ee364c9` | Composer UX — araçsız kullanıcı için "Aracımı ekle" CTA + loading/error state |
| `b18a4ea` | Mock chain — home/feed/search canlı `/cases/me`; -1560 satır fake content (community yorumları, fake insight, fake campaigns) |
| `d856f4b` | Vehicles — fuel_type enum BE canonical (`gasoline`→`petrol`, `cng` kaldırıldı) |
| `fb5e1c8` | Vehicles — history_consent path dash (`history-consent`, FE underscore yazmıştı → 404) |
| `5c6e58d` | Records — mock useCasesStore koptu, canlı GET /cases/me |
| `8dbff73` | Ustalar — ProviderType enum BE canonical (13 İngilizce → 6 Türkçe `usta/cekici/…`) |
| `1f793b3` | (BE) Hotfix /vehicles/me 500 — DISTINCT + ORDER BY Postgres hatası |

### Grup C — Çarşı UX yenileme
Reels tarzı tam-sayfa kart deneyimi.

| Commit | Özet |
|---|---|
| `40d5ac4` | TechnicianFeedCard zenginleştirildi (hero gradient + avatar overflow + 3 metric grid + quick bar + specialty chips) |
| `c62a6da` | Çarşı — reels tarzı tam-sayfa feed (`pagingEnabled` + snap `viewport - header - tab`) |
| `e978626` | Çarşı kart flex-1 içerik tam viewport'a yayıldı (justify-between) |

### Grup D — Parity audit deliverable
Pilot-öncesi FE ↔ BE drift raporu.

| Commit | Özet |
|---|---|
| `bf5bd43` | Parity audit — FE Zod ↔ BE Pydantic drift tablosu (Aşama 1). ~80 endpoint 5 paralel Explore agent ile tarandı. `docs/audits/2026-04-22-parity-audit.md` |

### Grup E — Usta preview + profile canlı
Çarşıdan usta seçince "bulunamadı" gidiyordu.

| Commit | Özet |
|---|---|
| `7f30618` | TechnicianProfileScreen + UstaPreviewSheet `useTechnicianPublicView` canlıya çevrildi; mock `mockTechnicianProfiles` bağı koptu. TechnicianFeedCard iki-zone: kart body → preview, avatar → direct profile |
| `ba93da6` | CTA akışı — "Bu servise vaka aç" (yanlışlıkla eklemiştim) kaldırıldı. `resolveTechnicianCta` helper: **Randevu al** (aktif + uyumlu vaka var) / **Önce vaka aç** (aktif vaka yok) / **Vakanla uyumlu değil** (kind ↔ provider_type match) / **Servis yeni iş almıyor** |
| `44096b8` | UstaPreviewSheet nested `<button>` DOM warning fix (backdrop + content absolute layout, stopPropagation kaldırıldı) |

### Grup F — Media
| Commit | Özet |
|---|---|
| `7ca6daa` | Media picker — `MediaTypeOptions` deprecation warning temizlendi (expo-image-picker 16+ yeni API: `mediaTypes: ["images"]`) |

---

## 2. Kapanan sorunlar (bugün fix edildi)

1. **401 sonsuz retry (launch blocker)** — refresh token fail → session clear → `/(auth)/login` (6779120)
2. **Customer home mock case** — `useCasesStore` mock zinciri → `useMyCasesLive` canlı (b18a4ea)
3. **Records mock case** — aynı düzeltme (5c6e58d)
4. **`/vehicles` POST 422 fuel_type** — `gasoline` → `petrol` (d856f4b)
5. **`/vehicles/{id}/history-consent` 404** — underscore → dash (fb5e1c8)
6. **Çarşı "yüklenemedi"** — ProviderType enum uyumsuzluğu (Zod parse patladı) (8dbff73)
7. **`/vehicles/me` 500** — BE DISTINCT + ORDER BY hatası (1f793b3, BE sohbeti)
8. **Çarşı usta "bulunamadı"** — `/usta/[id]` mock'tan canlıya (7f30618)
9. **Yanlış "Bu servise vaka aç" CTA** — doğru akış: Randevu al / Önce vaka aç / Uyumsuz (ba93da6)
10. **DOM warning nested button** — UstaPreviewSheet backdrop layout (44096b8)
11. **Deprecated MediaTypeOptions warning** — yeni API (7ca6daa)
12. **Servis app verify "pending" hardcoded** — canlı `/technicians/me/shell-config` fetch (f9dc951)
13. **Servis app MOCK_AUTH default** — pilot default `false` (.env.example, f9dc951)

---

## 3. Açık sorunlar (canlı user test'inde yaşananlar)

### P0 — Launch blocker

**(P0-1) PaymentInitiateResponse shape mismatch**
- BE: `{ checkout_url, idempotency_key, preauth_amount, case_id }` (flat)
- FE: `{ case_id, payment: { required, status, redirect_url, payment_id } }` (nested)
- Etki: billing initiate + 3DS WebView flow çalışmaz
- Karar bekleniyor: **BE nested'e mi döner, FE flat'e mi adapt olur?** PR ayrı bir sohbette açıldı.

**(P0-2) BillingSummary field drift**
- FE: `preauth_total, captured_amount, refunded_amount, payment_status` (11 enum)
- BE: `preauth_amount, final_amount, billing_state` (15 enum state machine)
- Etki: billing summary card canlı BE'ye bağlanamaz
- Yön: **BE canonical'e FE hizala** (kolay). FE P0-1 kararı beklemiyor, bekliyor (PaymentInitiate shape'i bağlı).

**(P0-3) UserVehicleRole enum drift**
- BE: `owner | driver | family` (3 değer)
- FE: `owner | driver | partner | observer` (4 değer)
- Etki: ownership transfer + vehicle link response parse bozuk
- **PO kararı bekleniyor** (BE 3'ünde kalsın mı, FE 4'e genişletsin mi).

**(P0-4) Media upload silent fail**
- User test'inde picker açılıyor, dosya seçilince HİÇBİR ŞEY olmuyor (Alert yok, ekrana attachment eklenmiyor)
- Console: aria-hidden a11y + MediaTypeOptions deprecation (bu ikisi sebep değil, kozmetik)
- Olası kök neden **ikisinden biri**:
  - (a) `POST /media/uploads/intents` BE 422 — audit'te polymorphic `owner_kind/owner_id` gap not edildi (parity P2 idi ama burada bloker olabilir)
  - (b) **MinIO/S3 CORS** — presigned PUT URL'ye browser'dan doğrudan istek → localhost:8082 origin'e CORS policy yok
- **Debug için gereken:** Network tab'te intents status + PUT status + response body
- Fix path: ya BE owner_kind parse esnetme, ya MinIO bucket CORS policy update

### P1 — Launch sırasında açık ama pilot scope dışı

**(P1-1)** `CaseOfferStatus.WITHDRAWN` ve `AppointmentStatus.COUNTER_PENDING` FE domain'de eksik (BE var) — FE live wire-up yapılana kadar etkilenmez
**(P1-2)** `/cases/{id}/cancel-billing` BE body ignore ediyor (V1 %0 fee hardcoded); reason store edilmiyor
**(P1-3)** `/media/uploads/intents` polymorphic owner_kind — opsiyonel, owner_ref hâlâ geçerli

### P2 — Mock-on-mock zinciri (FE kendi scope'u, Cleaner Controller Hat B)

**(P2-1) `useCasesStore` (customer cases/store.ts)**
- Case detail (offers, thread, tasks, attachments, messages) mock'tan okuyor
- 15+ mutation Zustand'a yazıyor: selectOffer, requestAppointment, approveAppointment, declineAppointment, refreshMatching, attachTechnician, prefillDraft, sendMessage, markSeen, addAttachment, updateNotes, approvePartsRequest, approveInvoice, confirmCompletion, cancelAppointment, cancelCase
- BE'de `/offers/*`, `/appointments/*` endpoint'leri hazır (parity audit P2 satırları) — wire-up bekliyor
- Tüketiciler: `CaseManagementScreen`, `CaseOfferCard`, `RandevuRequestScreen`, `ProfileScreen`
- Etki: kullanıcı vaka açar, listeye girer, teklif/randevu akışı mock davranıyor. Canlı BE state sync yok.
- Pilot durumu: **Kırık** — 10 gerçek kullanıcı vaka açtıktan sonra teklif/randevu/onay akışları canlı değil
- Fix: `useCasesFeed` kaldırılıp `useMyCasesLive` canonical, tüm mutation'lar BE PATCH/POST'a çevrilir, detail queries ayrı endpoint'lere bağlanır. 2-3 gün iş (ayrı brief).

**(P2-2) `mockTechnicianProfiles`**
- Halen 5 yerde: `cases/api.ts` (mock scheduleMockAppointmentResponse), `CaseManagementScreen`, `CaseOfferCard`, `RandevuRequestScreen`, `ProfileScreen`
- Preview + detail profile bugün canlıya çekildi (7f30618) ama case-related UI'lar hâlâ mock profile çekiyor
- Fix: bu 5 tüketici `useTechnicianPublicView(id)` kullanmalı

**(P2-3) Notifications**
- `features/notifications/api.ts` tamamen mock (`pushNotification` fn Zustand'a yazıyor)
- BE'de dedicated notifications endpoint'i yok — case_event + case_audit tablosundan türetilebilir
- Pilot launch'ta boş liste + açıklama yeter (brief bekliyor)

**(P2-4) Service app onboarding self-signup**
- Provider-type, business, capabilities, certificates screens Zustand only
- BE `POST /technicians/me/profile` **yok** (sadece GET/PATCH var) — admin manual create ederse kapatılabilir
- Pilot karar: admin 10 usta manuel yaratacak (f9dc951 commit mesajı). Self-signup V1.1'de.

---

## 4. Backend'den net beklentiler

### Karar bekleyen (PO + BE sohbeti)

1. **PaymentInitiateResponse shape** — nested `payment` object'a dön mü, yoksa FE flat adapt mi? **Blocking billing flow**.
2. **UserVehicleRole** — BE 3-değer kalsın, FE 4'ünü 3'e sıkıştır mı? Ya da BE 4'e genişle?
3. **Media intent polymorphic owner** — FE `owner_ref` kalsın mı, yoksa FE `owner_kind`/`owner_id` göndermek zorunda mı?
4. **Cancellation reason** — BE cancel-billing body'yi store edecek mi (fee computation V1.1'de) yoksa şimdilik FE sessiz body OK mi?

### Eksik BE endpoint'leri

5. **`POST /offers/{id}/shortlist`** ve **`POST /offers/{id}/reject`** — parity audit'te ❌ broken işaretli, BE'de yok (scope'ta mevcut). Mevcut shortlist/reject UI mock davranıyor.
6. **`POST /technicians/me/profile`** — self-signup için. Pilot scope için opsiyonel (admin manuel create).

### Stack trace ya da debug destek

7. **Media upload silent fail** — user test'inde fotoğraf eklenmiyor. BE access log'unda `POST /media/uploads/intents` çağrısı var mı, status ne? (FE tarafından curl tekrar denenebilir ama oturum token + payload gerekli — BE log çoğu zaman daha hızlı.)

### Küçük contract clean-up

8. **`antivirus_verdict`** — BE MediaAssetResponse'ta var; FE schema whitelist'inde yok. İstek: BE response'ta döner mi? FE ekler (trivial).
9. **`TechnicianProfileResponse.provider_mode`** — response'ta var, FE service-app parse şeması tam tanımlanmamış. İstek: BE response tipini tam `ProviderMode` enum olarak expose.

---

## 5. Pilot readiness değerlendirmesi

### Çalışan (canlı, test edildi)

- ✅ Auth OTP (customer + service-app)
- ✅ 401 refresh + logout redirect
- ✅ Vehicles CRUD (add, list, update, delete, history-consent)
- ✅ Cases create (`/cases` POST)
- ✅ Cases list (`/cases/me`)
- ✅ Home active case card
- ✅ Records aktif + tamamlanmış liste
- ✅ Çarşı feed paginated (tam-sayfa reels kart)
- ✅ Teknisyen preview sheet + tam profile
- ✅ Teknisyen CTA (Randevu al / Önce vaka aç / Uyumsuz)
- ✅ Service-app login + shell-config live admission
- ✅ Service-app payout ekranı (`/technicians/me/payouts`)
- ✅ Taxonomy (domains, brands) — çarşı filter chip

### Yarı çalışan (mock katman açık)

- ⚠️ Vaka detay sayfası (offers/thread/tasks/messages) — mock `useCasesStore` arkasında
- ⚠️ Teklif seçimi / randevu akışı — mock Zustand mutation'ları, BE'ye gitmiyor
- ⚠️ Notification merkezi — mock push + boş liste
- ⚠️ Service-app onboarding — Zustand only (admin manuel açılış varsayımı)

### Kırık (debug/fix gerekli)

- ❌ Billing initiate + summary — P0 drift, fix bekliyor
- ❌ Media upload (fotoğraf ekleme) — debug bekliyor (Network tab screenshot)
- ❌ Vehicle ownership transfer — UserVehicleRole enum drift

### Dokunulmamış (V1.1+)

- Service-app onboarding self-signup BE wire-up
- Admin billing UI
- Insurance claims customer read-only
- Media `antivirus_verdict` FE schema
- Taxonomy FE consumer'ları (procedures, districts, drivetrains)
- openapi-zod-client ile schema regen pipeline (Parity Aşama 2)

---

## 6. Sonraki adımlar (FE bekleyen iş sırası)

1. **[BE karar sonrası]** P0-1 PaymentInitiateResponse shape hizala (FE flat veya BE nested)
2. **[BE karar sonrası]** P0-3 UserVehicleRole enum hizala
3. **[BE karar sonrası]** P0-2 BillingSummary field drift FE tarafı
4. **[User test + Network tab]** P0-4 Media upload root cause → fix (422 veya CORS yönü netleşince)
5. **[Brief bekliyor]** Notifications + Records FE live (records kısmen yapıldı; notifications boş state brief)
6. **[Brief bekliyor]** P2-1 + P2-2 — Cleaner Controller Hat B: `useCasesStore` + `mockTechnicianProfiles` canlıya geçiş. 2-3 gün iş.
7. **[V1.1]** Service-app onboarding self-signup wire-up (BE `POST /technicians/me/profile` eklenir)
8. **[V1.1 pilot-sonrası]** Parity Aşama 2 — `openapi-zod-client` kurulumu + CI check

---

## 7. Pilot 10+10 scope ile durum özeti

**Kayseri pilot, 10 gerçek usta + 10 mock seed profil** hedefine göre:

- **Customer flow uçtan uca:** Login → araç ekle → composer → vaka aç → (teklif bekle) → (teklif kabul) → (randevu) → (parça onay) → (fatura onay) → (3DS ödeme) → tamamlandı
  - İlk 3 adım (login → vaka aç) canlı ✓
  - Teklif bekleme sonrası **tüm adımlar mock** (P2-1 useCasesStore + P2-2 mockTechnicianProfiles)
  - Billing flow P0 drift'leri açık

- **Technician flow:** Login → onboarding → admin onay bekle → aktif → havuz → teklif ver → randevu → iş → payout
  - Login + shell-config live ✓
  - Onboarding mock (admin manuel yarar) — pilot scope dışı
  - Havuz + teklif submit wire-up **yok** (BE `/offers/*` hazır, FE client eksik)
  - Payout ekranı canlı ✓

**Sonuç:** Pilot scope'unda en az **2 launch-blocker** (P0-1 billing shape, P0-4 media upload) ve **2 ana gap** (P2-1 cases state live, teklif/randevu FE wire-up). FE tahmini iş: P0 4 düzeltme ~1 gün + P2-1/P2-2 Cleaner Controller Hat B ~2-3 gün + teklif/randevu wire-up ~1-2 gün = **4-6 iş günü** pilot readiness'e. BE karar verimiyle paralel akabilir.
