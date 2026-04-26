# Naro Case Refactor — Uçtan Uca Mimari Sağlamlaştırma Planı

**Tarih:** 2026-04-26  
**Mod:** Ürün geliştirme; kalite öncelikli, sabit lansman tarihi yok  
**Statü:** Uygulama öncesi canonical refactor planı  
**Çalışma şekli:** Backend ve frontend paralel ilerleyebilir; ancak contract ve karar kilidi olmadan kod yazılmaz.

---

## 0. Amaç

Bu planın amacı, Naro'nun `case` merkezli ürün omurgasını kodda netleştirmektir. Hedef yalnız isim değiştirmek değildir; kullanıcı akışı, backend state, frontend ekranları ve ödeme/eşleşme davranışı aynı sözleşmeye bağlanmalıdır.

Ana kural:

> Müşteri vaka oluşturur. Vaka ya havuza düşer ya da müşteri uygun gördüğü ustaya vakayı bildirir. Usta vakayı görür, teklif yollar. Müşteri teklifi kabul ederse randevu ve ödeme yöntemi netleşir. Randevu onaylandığında gerçek assignment başlar. Çekici immediate/scheduled ayrı dispatch operasyonudur; bakım/arıza/hasar gibi teklif havuzu değildir.

Bu refactor kapsamı büyük ve temel sarsıcıdır. Bu yüzden sırayla ilerlenir:

1. Karar ve contract kilidi
2. Davranış guard'ları
3. Veri modeli/read-model
4. Backend endpoint'leri
5. Frontend adapter ve ekranlar
6. Naming cleanup
7. Smoke, audit ve grep gate

---

## 1. Canonical Referanslar

Refactor sırasında karar kaynağı aşağıdaki dokümanlardır:

| Doküman | Rol |
| --- | --- |
| [naro-vaka-omurgasi.md](naro-vaka-omurgasi.md) | PO sesi, ürün niyeti, temel vaka anlatısı |
| [naro-vaka-omurgasi-genisletilmis.md](naro-vaka-omurgasi-genisletilmis.md) | Sistem dili, vaka kurallarının koda yansıması |
| [naro-domain-glossary.md](naro-domain-glossary.md) | Naming sözlüğü, tek kavram tek isim |
| [audits/2026-04-26-vaka-omurgasi-fix-haritasi-revize.md](audits/2026-04-26-vaka-omurgasi-fix-haritasi-revize.md) | Revize fix haritası, uygulanabilir kritik path |

Eski fix haritası yalnız tarihsel nottur:

- [audits/2026-04-26-vaka-omurgasi-fix-haritasi.md](audits/2026-04-26-vaka-omurgasi-fix-haritasi.md)

Uygulama sırasında eski harita yeni haritaya tercih edilmez.

---

## 2. Karar Kilidi

Bu plan aşağıdaki karar setiyle uygulanır. Bunlar refactor başlamadan önce kod ve dokümanlarda aynı biçimde kullanılmalıdır.

| Kod | Karar | Uygulama kararı |
| --- | --- | --- |
| Q1 | `assigned_technician_id` semantiği | Katı: yalnız gerçek assignment. Randevu `APPROVED` olmadan set edilmez. Yeni `selected_technician_id` hemen eklenmez; önce mevcut `preferred_technician_id` "müşteri niyeti / hedef usta" olarak sıkılaştırılır. |
| Q2 | `case_links` graph | V1: mevcut `parent_case_id` çizgisi. Genel `case_links` graph V1.1. |
| Q3 | Workflow source-of-truth | Backend `workflow_blueprint` canonical; frontend yalnız presentation/config layer. |
| Q4 | `CaseTechnicianMatch` read-model | V1'e dahil. Matching ürün değerinin bel kemiği. |
| Q5 | `case_dossier` vs `case_profile` | API/system dili `case_dossier`; UI ekran adı `case_profile`. |
| C1 | Planlı çekici ödeme penceresi | Pencere sonu = otomatik iptal. Ek grace timeout yok. |
| C2 | Çekici cancel fee matrisi | `PAYMENT_REQUIRED`, `SCHEDULED_WAITING`, `SEARCHING`: %0. `ACCEPTED`, `EN_ROUTE`: %50. `NEARBY`, `ARRIVED`, `LOADING`, `IN_TRANSIT`: %100. |

Önemli not:

> Yeni kolon, enum veya alias üretmeden önce sözlüğe bakılır. Mevcut kavram yeterliyse yeni isim açılmaz.

---

## 3. Ürün İnvariantları

Bu refactor sonunda aşağıdaki kurallar kodla enforce edilmelidir.

### 3.1 Vaka

- Araçsız vaka olmaz.
- `request_draft` audit snapshot'tır; source-of-truth değildir.
- `ServiceCase.status` genel case lifecycle'dır.
- Tür özel state'ler kendi katmanında yaşar: örnek `TowCase.tow_stage`, approval `payment_state`, payment `PaymentOrder.state`.

### 3.2 Bakım / Arıza / Hasar

- Teklif olmadan randevu yoktur.
- Customer app'te "Randevu al" CTA'sı teklif yokken görünmez.
- Keşif/profil üzerinden doğru aksiyon "vakayı bildir"dir.
- Usta teklif yollar; müşteri teklif kabul ederse randevu ve ödeme yöntemi netleşir.

### 3.3 Çekici

- Her çekici isteği `case`tir.
- Immediate towing: ödeme/preauth başarılı olmadan dispatch başlamaz.
- Scheduled towing: V1'de havuz/teklif değil; scheduled payment-window + dispatch modelidir.
- Immediate/scheduled towing pool feed'e bakım/arıza/hasar gibi düşmez.
- Tow stage ve case status birbirine karıştırılmaz.

### 3.4 Ödeme ve Approval

- Çekici online ödeme zorunlu.
- Kampanya/paket online ödeme zorunlu.
- Servis teklif/fatura/kapsam onayında online ödeme önerilir; serviste kart/nakit izinlidir.
- "Ek ödeme" ürün dili yasaktır.
- Doğru dil:
  - `parts_request` -> kapsam/parça onayı
  - `invoice` -> final fatura/ödeme yöntemi
  - `completion` -> kapanış/teslim/puan
- Backend `additional_amount` gibi legacy alanlar davranış güvenceye alınmadan rename edilmez.

### 3.5 Eşleşme

- `CaseTechnicianMatch` teklif değildir.
- `CaseTechnicianMatch` bildirim değildir.
- `CaseTechnicianMatch` assignment değildir.
- Uygun usta kartları, havuz sıralaması ve "bu vakaya uygun" rozeti bu read-model'den beslenir.

---

## 4. Contract Önceliği

Kodlamadan önce dört contract netleşmelidir.

### 4.1 `case_dossier` API Contract

`case_dossier` role-safe, okunabilir, tek vaka dosyası response'udur.

İçermesi gerekenler:

- case shell: `id`, `kind`, `status`, `urgency`, `wait_state`, `origin`
- vehicle snapshot
- kind-specific subtype detail
- attachments/evidence/documents
- matches
- notifications
- offers
- appointment
- assignment
- approvals
- payment snapshot
- tow snapshot, yalnız towing ise
- timeline summary

UI adı `case_profile` olabilir; API/system adı `case_dossier` kalır.

### 4.2 `CaseTechnicianMatch` Contract

Önerilen read-model alanları:

- `case_id`
- `technician_user_id` veya `technician_profile_id`
- `score`
- `reason_codes`
- `reason_label`
- `visibility_state`
- `source`
- `computed_at`
- `invalidated_at`

V1 scoring sade olmalıdır:

- provider type / service domain uyumu
- procedure/tag uyumu
- city/district/radius uyumu
- availability
- verified level
- basic performance snapshot

V1'de opak Instagram tarzı ranking yoktur. Kullanıcıya anlaşılır rozet verilir: "Bu vakaya uygun".

### 4.3 `notify_case_to_technician` Contract

Bu akış doğrudan randevunun yerine geçer.

Önerilen kayıt:

- `case_id`
- `technician_user_id` veya `technician_profile_id`
- `customer_user_id`
- `status`: `sent`, `seen`, `dismissed`, `offer_created`, `expired`
- `match_id`
- `created_at`
- `seen_at`
- `responded_at`

Davranış:

- Vaka havuzda kalabilir.
- Usta servis app'te "size bildirildi" rozetiyle görür.
- Usta teklif yollar veya reddeder.
- Bildirim, match veya offer yerine geçmez.

### 4.4 Appointment Contract

Bakım/arıza/hasar için:

- `offer_id` zorunlu.
- `source=offer_accept` canonical.
- `source=direct_request` compat/legacy olarak kalabilir, ama aktif ürün akışında backend 422 döner.
- `Appointment.slot.kind="label"` gibi yeni enum açılmaz. Geniş zaman etiketi gerekiyorsa mevcut `FLEXIBLE` + `slot.label` kullanılır.

---

## 5. Refactor Fazları

### Faz 0 — Plan ve Doküman Sabitleme

Amaç: Uygulama başlamadan bütün agent'ların aynı kararı okuması.

İşler:

- Bu plan canonical referans olarak revize fix haritasını kullanır.
- Q1-Q5/C1-C2 kararları `naro-vaka-omurgasi-genisletilmis.md` ve `naro-domain-glossary.md` ile uyumlu hale getirilir.
- Memory'deki canonical docs notu revize fix haritasını işaret eder.
- `selected_technician_id` yeni kolon önerisi "önce `preferred_technician_id` semantiği sıkılaştır" olarak düzeltilir.

Çıkış kriteri:

- Plan, sözlük ve genişletilmiş omurga aynı kararları söyler.

### Faz 1 — Davranış Guard'ları

Amaç: Ürünü bozan davranışları rename beklemeden kapatmak.

Backend:

- Offer olmadan bakım/arıza/hasar appointment create -> 422.
- `source=direct_request` gelen aktif bakım/arıza/hasar request'leri bloklanır.
- Terminal case'e offer creation bloklanır.
- Terminal case'e approval creation bloklanır.
- `list_cases_for_vehicle` soft-deleted/cancelled filtreleri doğrulanır.
- Immediate/scheduled towing pool feed'e düşmez.

Frontend:

- Teklif olmayan public technician/profile ekranlarında "Randevu al" CTA kaldırılır.
- Yerine "Vakayı bildir" veya "Önce vaka oluştur" yönlendirmesi gelir.
- Ham API error gösterilmez.

Test:

- Offer'sız appointment -> 422.
- Offer'lı appointment -> success.
- Frontend no-offer CTA görünmez.
- Immediate tow pool feed'de yok.

### Faz 2 — Read-Model ve Bildirim Altyapısı

Amaç: Eşleşme ürün değerini gerçek kayıt haline getirmek.

Backend:

- `CaseTechnicianMatch` migration/model/service.
- `CaseTechnicianNotification` migration/model/service.
- Match compute service sade V1 kurallarıyla yazılır.
- Case create sonrası veya manuel refresh ile match üretimi.
- `GET /pool/feed` match ve notification context'i döner:
  - `is_matched_to_me`
  - `match_reason_label`
  - `match_badge`
  - `is_notified_to_me`
  - `has_offer_from_me`
- `POST /cases/{case_id}/notify-technicians`.
- `GET /technicians/me/notifications`.

Frontend:

- Customer home'da aktif vaka ile uyumlu usta bandı.
- Public technician kartında "Bu vakaya uygun" rozeti.
- Service app pool kartında "Size bildirildi" rozeti.
- Pool'da "teklif gelenler" üst sıralama.

Test:

- Match kaydı offer/assignment üretmez.
- Notification offer/assignment üretmez.
- Usta bildirilen vakayı servis app'te görür.
- Usta teklif yollayınca notification status güncellenir.

### Faz 3 — `case_dossier` / `case_profile`

Amaç: Vaka detayını karışık tracking/job ekranından ayırmak.

Backend:

- `GET /cases/{case_id}/dossier` veya mevcut detail response içinde `dossier` contract.
- Role-safe alanlar:
  - customer view
  - technician view
  - public/pool redaction
- Vehicle snapshot ve subtype detail açık taşınır.
- Offers, matches, notifications, appointment, assignment, approvals, documents aynı response'ta veya açık subresource linkleriyle döner.

Customer app:

- Vaka profil ekranı:
  - üstte vaka özeti
  - araç snapshot
  - oluştururken girilen detaylar
  - medya/evrak
  - uygun ustalar
  - teklifler
  - süreç/timeline

Service app:

- Case profile:
  - servis için gerekli public-safe vaka detayları
  - teklif verme
  - bildirildi/match bilgisi
  - assignment sonrası süreç linkleri

Test:

- Customer kendi vakasının tüm güvenli detaylarını görür.
- Technician pool'da PII-safe detay görür.
- Assigned technician assignment sonrası genişletilmiş detay görür.

### Faz 4 — Workflow Source-of-Truth

Amaç: Vaka sürecindeki adım boşluklarını backend canonical pattern ile çözmek.

Backend:

- Eksik blueprint seed'leri tamamlanır:
  - `BREAKDOWN_STANDARD`
  - `TOWING_IMMEDIATE`
  - `TOWING_SCHEDULED`
- `workflow_blueprint` resolver ve seed aynı blueprint setini destekler.
- Mobile tracking engine canonical karar vermez; backend task/milestone'u presentation'a çevirir.
- Ek adım yetkisi yalnız technician tarafında olur.

Frontend:

- Bakım/arıza/hasar process ekranlarında basitten zora akış.
- Müşteri süreç adımı eklemez; yorum/mesaj/kanıt verebilir.
- Technician ek adım ekleyebilir.
- Çekici ihtiyacı bakım/arıza akışında son karar olarak sorulur; kaza akışında güvenlik adımı nedeniyle erken sorulabilir.

Test:

- Her kind için workflow seed crash etmez.
- Resolver çıktısı template ile eşleşir.
- FE task listesi backend blueprint'e aykırı adım üretmez.

### Faz 5 — Ödeme ve Approval Dili

Amaç: "Ek ödeme" drift'ini ürün dilinden çıkarmak, mevcut ödeme altyapısını bozmamak.

Backend:

- `parts_request` ve `invoice` için description/gerekçe zorunlu.
- `completion` ödeme akışı gibi davranmaz.
- `CaseApprovalPaymentMethod` online/service_card/cash davranışı korunur.
- Online payment success approval'ı idempotent approve eder.
- Offline payment `offline_recorded` olur.
- Legacy `additional_amount` field varsa davranış tamamlanmadan rename edilmez; rename P2 migration olarak ayrılır.

Frontend:

- "Ek ödeme", "ek tutar", "additional payment" copy temizlenir.
- `parts_request`: "Kapsam/parça onayı".
- `invoice`: "Final fatura".
- Müşteri online/serviste kart/nakit seçimini net görür.

Test:

- "Ek ödeme / ek tutar" UI grep temiz veya yalnız legacy/internal notta kalır.
- Parts/invoice description olmadan create -> 422.
- Online/offline approval state'leri doğru.

### Faz 6 — Naming Cleanup

Amaç: Davranış sabitlendikten sonra sözlük uyumu.

Yapılacaklar:

- UI/API yüzeyinde yasak kelimeleri temizle.
- `bid` yerine `offer`.
- `direct_request` aktif customer/service app akışından çıkar.
- `request_*` yalnız `request_draft` snapshot bağlamında kalır.
- `additional_amount -> revision_amount` gibi DB rename'leri ancak test coverage sonrası yapılır.

Yapılmayacaklar:

- Eski enum değerlerini ilk turda DB'den silmek.
- Her `job` kelimesini kör rename etmek. Service app projection olarak `job` kabul edilebilir; backend ana entity `case`tir.

Test:

```bash
rg -n "extra_payment|additional_payment|direct_request|\\bbid\\b" naro-app/src naro-service-app/src packages
rg -n "additional_amount" naro-app/src naro-service-app/src packages
```

### Faz 7 — Smoke, Audit, Commit

Smoke:

- Customer: vaka oluştur -> uygun ustaları gör -> ustaya bildir -> teklif al -> teklif kabul -> randevu -> payment/offline seçim -> case profile.
- Service: notified/matched case gör -> teklif gönder -> randevu onayla -> süreç yürüt -> completion.
- Tow immediate: harita -> ödeme/preauth -> dispatch -> tracking -> delivered/capture.
- Tow scheduled: scheduled_waiting -> payment window -> payment -> due time dispatch.

Audit:

- Codex backend'i inceler.
- Claude frontend'i inceler.
- İkisi de sözlük uyumu, product invariant ve test coverage üstünden bakar.

Commit:

- Her faz ayrı commit veya küçük commit serisi.
- Big-bang tek commit yok.

---

## 6. Paralel Çalışma Sınırları

### Backend Sahipliği

- Migration/model/service/route/schema.
- Contract testleri.
- Payment/tow/approval lifecycle guard'ları.
- Pool/match/notification read-model.

### Frontend Sahipliği

- Customer CTA ve case profile ekranları.
- Service pool/notification/job kartları.
- Canonical adapter mapping.
- Copy/naming cleanup.

### Ortak Kilit Dosyalar

Bu dosyalar iki taraf aynı anda değiştirmemeli:

- shared domain package schemas
- API type definitions
- case adapter/facade exports
- payment/tow shared hooks

Kural:

> Backend contract değişikliği önce küçük schema commit'iyle gelir. Frontend o contract commit'ine göre bağlanır.

---

## 7. Riskler

| Risk | Neden | Önlem |
| --- | --- | --- |
| Big-bang rename davranışı bozar | İsim değişir ama eski akış kalır | Önce guard/contract, sonra naming cleanup |
| `assigned_technician_id` yanlış kullanılmaya devam eder | Seçili usta ile atanmış usta karışır | `preferred_technician_id` niyet, `assigned_technician_id` assignment olarak enforce |
| Match, notification ve offer karışır | Üçü de "ustaya gösterme" gibi algılanır | Ayrı tablolar ve response alanları |
| `direct_request` DB enum'u compat diye akışta kalır | Frontend veya endpoint kullanmaya devam eder | Backend 422 + frontend CTA cleanup + grep gate |
| Planlı çekici yanlışlıkla havuza döner | Eski tow offer/bidding kalıntıları | Scheduled dispatch invariant testi |
| Approval "ek ödeme" gibi görünür | Copy ve legacy field drift'i | Scope/final invoice copy ve description zorunluluğu |
| FE/BE paralel branch conflict | Aynı shared type dosyaları | Contract commit önce, uygulama sonra |

---

## 8. Doğrulama Komutları

Backend:

```bash
cd naro-backend
uv run ruff check app tests
uv run pytest tests/test_case_create_schema.py tests/test_case_create_service.py
uv run pytest tests/test_tow_dispatch.py tests/test_payment_core_pure.py
```

Frontend:

```bash
pnpm --filter naro-app exec tsc --noEmit --pretty false
pnpm --filter naro-service-app exec tsc --noEmit --pretty false
pnpm ui:audit
pnpm service:live-gate
```

Naming:

```bash
rg -n "extra_payment|additional_payment|direct_request|\\bbid\\b" naro-app/src naro-service-app/src packages
rg -n "additional_amount" naro-app/src naro-service-app/src packages naro-backend/app
```

Smoke:

- Android customer app
- Android service app
- Backend canlı DB
- Redis varsa tow presence
- Google maps key varsa gerçek harita

---

## 9. Implementation Brief

Agent'a verilecek kısa brief:

> `docs/case-refactor-plan-2026-04-26.md`, `docs/naro-domain-glossary.md`, `docs/naro-vaka-omurgasi-genisletilmis.md` ve `docs/audits/2026-04-26-vaka-omurgasi-fix-haritasi-revize.md` canonical referanstır. Big-bang rename yapma. Önce davranış guard'ları ve contract'ları uygula. Bakım/arıza/hasar için offer olmadan appointment yok. `preferred_technician_id` müşteri niyeti, `assigned_technician_id` gerçek assignment. `CaseTechnicianMatch` match read-model, `CaseTechnicianNotification` bildirim read-model, `CaseOffer` teklif, `Appointment` teklif sonrası randevudur. Çekici immediate/scheduled dispatch çizgisinde kalır, pool/offer'a sızmaz. "Ek ödeme" dili yok; `scope_approval` ve `final_invoice` dili var. Her değişiklikten sonra ilgili test/gate çalıştırılır.

---

## 10. Başarı Tanımı

Bu refactor başarılı sayılırsa:

- Müşteri teklif olmadan bakım/arıza/hasar randevusu oluşturamaz.
- Müşteri uygun ustaları vaka bağlamında görebilir.
- Müşteri ustaya vakayı bildirebilir.
- Usta bildirilen ve kendisiyle eşleşen vakaları servis app'te ayrışmış görür.
- Usta teklif yollar; müşteri teklif kabul edince randevu/ödeme ilerler.
- Vaka profili, vakanın tüm oluşturma detaylarını ve ilgili teklif/süreç bilgilerini tek yerde gösterir.
- Çekici immediate/scheduled ödeme ve dispatch invariantlarını korur.
- Ek ödeme dili ürün yüzeyinden temizlenir.
- Sözlükte olmayan yeni alias üretilmez.
- Backend, customer app ve service app aynı case contract'ı kullanır.
