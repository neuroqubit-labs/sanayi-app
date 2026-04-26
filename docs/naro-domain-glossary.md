# Naro Domain Glossary / Terim Sözlüğü

**Tarih:** 2026-04-26  
**Statü:** Canonical naming sözlüğü  
**Amaç:** Naro ürününde, backend modelinde, mobil uygulamalarda ve AI refactor prompt'larında aynı kavramların aynı isimlerle kullanılmasını sağlamak.  
**Referans:** [naro-vaka-omurgasi.md](naro-vaka-omurgasi.md), [naro-vaka-omurgasi-genisletilmis.md](naro-vaka-omurgasi-genisletilmis.md)

Bu dokümanda İngilizce terim kod ve API dilini, Türkçe karşılık ürün/UX dilini ifade eder. Kodda mümkün olduğunca İngilizce canonical isimler kullanılır; kullanıcıya görünen metinlerde Türkçe ürün dili kullanılır.

---

## 0. Naming İlkeleri

### 0.1 Genel Kural

| Alan | Dil | Örnek |
| --- | --- | --- |
| Backend model/class | English | `ServiceCase`, `CaseOffer`, `PaymentOrder` |
| DB table/column | English snake_case | `service_cases`, `case_technician_matches`, `tow_stage` |
| API enum value | English snake_case | `maintenance`, `payment_required`, `direct_capture` |
| Frontend type/hook | English | `CanonicalCase`, `useHomeSummary` |
| UI copy | Turkish | `Vakanız alındı`, `Bu vakaya uygun` |
| Product docs | Turkish + English term | `vaka (case)`, `teklif (offer)` |

### 0.2 Yasaklı / Riskli Alışkanlıklar

- Aynı kavrama üç isim vermek: `request`, `case`, `job` karışmamalı.
- UI draft alanını source-of-truth gibi adlandırmak.
- `assigned` kelimesini hem "seçili usta" hem "iş başlamış usta" için belirsiz kullanmak.
- `extra payment` / `additional payment` dilini normal ürün akışı gibi kullanmak.
- `direct appointment` ile "vakayı bildir" akışını karıştırmak.
- `notification`ı matching kaydı yerine kullanmak.
- `case.status` ile `tow_stage`i aynı şey sanmak.

### 0.3 Canonical Cümle

> Naro'da ana nesne `case`tir. `request`, `job`, `task`, `appointment`, `offer`, `payment`, `thread`, `showcase` ve `claim` case'in alt ilişkileri veya belirli aşama görünümleridir.

---

## 1. Ana Kavramlar

| English term | Türkçe karşılık | Açıklama | Kullanım notu |
| --- | --- | --- | --- |
| `case` | vaka | Bir aracın etrafında açılan ve yönetilen platform içi süreç. | Ürün dilinin merkezi. Yeni kodda "request" yerine tercih edilir. |
| `service_case` | servis/vaka kaydı | Backend'deki ortak case shell modeli. | DB/model seviyesinde `ServiceCase`. |
| `case_kind` | vaka türü | `maintenance`, `breakdown`, `accident`, `towing`. | UI'da bakım/arıza/hasar/çekici. |
| `case_subtype` | vaka alt türü / tür detayı | Vaka türüne özgü detay tablosu veya domain alanı. | `MaintenanceCase`, `BreakdownCase`, `AccidentCase`, `TowCase`. |
| `case_shell` | vaka üst kaydı | Ortak alanları taşıyan case üst sınıfı: kullanıcı, araç, kind, status, assignment. | Subtype detayın yerine geçmez. |
| `case_detail` | vaka detayı | API'nin role-safe case detay response'u. | Customer/service app aynı anlamla okumalı. |
| `case_profile` | vaka profili | Vakanın okunabilir dosya ekranı. | Tracking veya offer listesi değildir; onları bağlar. |
| `case_dossier` | vaka dosyası | Case profile'ın daha net product adı: oluşturma detayları, kanıtlar, araç snapshot, linked süreçler. | Refactor'da `profile/dossier` ayrımı net tutulmalı. |
| `case_service_contract` | vaka servisi sözleşmesi | Backend, customer app, service app ve testlerin uyması gereken tek case contract. | Yeni case feature'ı önce bu sözleşmeye bağlanır. |
| `request_draft` | talep taslağı / audit snapshot | Kullanıcının submit anındaki ham/yardımcı snapshot'ı. | Kritik kararların source-of-truth'u değildir. |
| `canonical_case` | canonical vaka | Mobil uygulamaların canlı backend'den okuduğu normalize vaka modeli. | Mock/job store yerine kullanılmalı. |
| `active_case` | aktif vaka | Kullanıcının henüz kapanmamış ve aksiyon bekleyebilen vakası. | Home/usta profili CTA'ları bununla bağlamlanır. |
| `linked_case` | bağlı vaka | Bir vakanın alt/yan süreci olarak açılan başka vaka. | Örnek: arıza parent case'inden açılan çekici case'i. |

---

## 2. Vaka Türleri

| English term | Türkçe karşılık | Açıklama | Kullanım notu |
| --- | --- | --- | --- |
| `maintenance` | bakım | Planlı hizmet, periyodik bakım veya isteğe bağlı iyileştirme vakası. | Acil değildir; teklif/kampanya üzerinden netleşir. |
| `breakdown` | arıza | Araç semptomu, çalışmama, uyarı, mekanik/elektrik sorun vakası. | Kullanıcı teknik teşhis bilmek zorunda değildir. |
| `accident` | hasar / kaza | Dış etken, çarpma, tek/karşı taraflı olay, sigorta/kasko ilişkili vaka. | Güvenlik, kanıt ve evrak akışı ağırdır. |
| `towing` | çekici | Aracın taşınması/yol yardım süreci. | Her çekici isteği case'tir; operasyon `tow_stage` ile yürür. |
| `tow_immediate` | acil çekici | Şimdi çağrılan canlı dispatch çekici. | Ödeme/preauth sonrası dispatch. Havuz/teklif yok. |
| `tow_scheduled` | planlı çekici | Randevu zamanlı çekici. | V1: payment-window + dispatch; havuz/teklif yok. |

---

## 3. Kullanıcı Rolleri

| English term | Türkçe karşılık | Açıklama | Kullanım notu |
| --- | --- | --- | --- |
| `user` | kullanıcı | Sistemde oturum açan genel kişi. | Tek başına rol belirtmez. |
| `customer` | müşteri / araç sahibi | Müşteri app kullanan, vaka açan kişi. | UI'da "araç sahibi" bağlama göre iyi olabilir. |
| `technician` | usta / servis kullanıcısı | Service app kullanan hizmet sağlayıcı aktör. | Kodda `technician`; UI'da "usta" veya "servis". |
| `service_provider` | servis sağlayıcı | Usta/servis işletmesi geniş kavramı. | Kurumsal/operasyon dokümanında kullanılabilir. |
| `shop` | işletme / dükkan | Fiziksel servis noktası. | `technician` yerine kullanılmamalı; işletme profili gerekiyorsa ayrı. |
| `tow_operator` | çekici operatörü | Çekici hizmeti veren technician alt rolü. | Kodda ayrı role gerekiyorsa capability/provider type ile ifade edilir. |
| `admin` | yönetici | Operasyon veya iç panel kullanıcısı. | Customer/technician akışına karıştırılmaz. |

---

## 4. Araç ve Snapshot

| English term | Türkçe karşılık | Açıklama | Kullanım notu |
| --- | --- | --- | --- |
| `vehicle` | araç | Kullanıcının garajındaki canlı araç kaydı. | Case açmak için zorunlu. |
| `vehicle_id` | araç id | Case'in bağlı olduğu araç. | Araçsız vaka olmaz. |
| `vehicle_snapshot` | araç snapshot'ı | Vaka açıldığı andaki araç bilgisi. | Vaka geçmişi için immutable kabul edilir. |
| `plate` | plaka | Araç plakası. | Public/showcase/pool'da PII gibi korunur. |
| `vin` | şasi no / VIN | Araç tanımlayıcı numarası. | Public ve pool response'larında sızmamalı. |
| `odometer` | kilometre | Araç km bilgisi. | Bakım ve değerleme için önemli sinyal. |
| `selected_vehicle` | seçili araç | UI'da aktif araç. | `DEFAULT_VEHICLE_ID` gibi fallback kullanılmamalı. |

---

## 5. Vaka Oluşturma / Composer

| English term | Türkçe karşılık | Açıklama | Kullanım notu |
| --- | --- | --- | --- |
| `composer` | vaka oluşturma akışı | Hızlı menüden açılan typed case creation flow. | Form değil, rehberli sorgulama akışı. |
| `flow` | akış | Composer içindeki tür özel adım düzeni. | `MaintenanceFlow`, `BreakdownFlow`, `AccidentFlow`. |
| `step` | adım | Akıştaki tek ekran/karar bölümü. | Bir adım tek ana karar taşımalı. |
| `view_model` | ekran modeli | UI'ın typed geçici state'i. | Submit anında canonical payload'a map edilir. |
| `submit_payload` | gönderim payload'u | Backend `/cases` veya ilgili endpoint'e giden DTO. | UI view-model ile aynı şey değildir. |
| `review_step` | özet/onay adımı | Toplanan bilgilerin son kontrolü. | Yeni karar sormaz. |
| `attachment_requirement` | zorunlu kanıt koşulu | Belirli kategori için foto/video/evrak şartı. | Submit'te sürpriz olmamalı; adım içinde gösterilmeli. |
| `tow_handoff` | çekiciye yönlendirme | Parent case içinden ayrı towing case composer'a geçiş. | Bakım/arıza için son karar; kaza için erken güvenlik kararı olabilir. |

---

## 6. Matching, Havuz ve Bildirim

| English term | Türkçe karşılık | Açıklama | Kullanım notu |
| --- | --- | --- | --- |
| `matching` | eşleştirme | Vakanın uygun servis/usta adaylarıyla ilişkilendirilmesi. | Offer veya appointment değildir. |
| `pool` | havuz | Eşleşme bekleyen vakaların servis tarafına gösterildiği yüzey. | Immediate/scheduled dispatch towing burada görünmez. |
| `case_pool` | vaka havuzu | Service app'in görebildiği canlı case listesi. | Match read-model ile filtre/sıralama almalı. |
| `case_technician_match` | vaka-usta uyum kaydı | Sistem tarafından hesaplanan uygun usta read-model'i. | Teklif değildir, assignment değildir, notification değildir. |
| `match_score` | uyum puanı | Uygunluk skorunun sayısal karşılığı. | V1'de sade/deterministik; opak ranking yok. |
| `match_reason` | uyum nedeni | Müşteriye/ustaya gösterilebilen kısa açıklama. | Örnek: "Bu hizmeti veriyor", "Yakın bölgede". |
| `match_badge` | uyum rozeti | UI'da "Bu vakaya uygun" gibi görünür sinyal. | Reklam/boost gibi davranmaz. |
| `visibility_state` | görünürlük durumu | Match'in customer/service tarafında gösterim state'i. | Örnek: `candidate`, `shown_to_customer`, `hidden`. |
| `notification_intent` | bildirim niyeti | Match veya case aksiyonunun delivery kuyruğu. | Match kaydının kendisi değildir. |
| `notify_case_to_technician` | ustaya vakayı bildir | Customer'ın seçili ustaya vaka sinyali göndermesi. | Direct appointment yerine kullanılır. |
| `service_inbox` | servis gelen kutusu | Service app'te bildirilen/match edilen vakaların görüldüğü yüzey. | Teklif ver/reddet aksiyonu sunar. |

---

## 7. Teklif, Randevu ve Eşleşme

| English term | Türkçe karşılık | Açıklama | Kullanım notu |
| --- | --- | --- | --- |
| `offer` | teklif | Servisin case'e verdiği fiyat/kapsam/zaman cevabı. | Bakım/arıza/hasar appointment ön şartı. |
| `case_offer` | vaka teklifi | Backend offer entity'si. | `CaseOffer`. |
| `offer_acceptance` | teklif kabulü | Customer'ın teklifi seçmesi. | Appointment/payment zincirini başlatır. |
| `appointment` | randevu | Teklif sonrası zaman ve servis onay adımı. | Offer olmadan bakım/arıza/hasar için oluşmamalı. |
| `appointment_request` | randevu talebi | Customer tarafından teklif kabulünden sonra oluşan randevu isteği. | `direct_request` aktif ürün akışından çıkarılmalı. |
| `direct_appointment` | doğrudan randevu | Offer olmadan randevu açma yolu. | Bakım/arıza/hasar için yasak/legacy. |
| `assignment` | atama / eşleşmiş servis | Case'in gerçek servis sürecine bağlanması. | Randevu/onay netleşmeden gerçek assignment sayılmamalı. |
| `assigned_technician_id` | atanmış usta id | Case'in atanmış technician alanı. | "Seçili usta" anlamına kaymaması için dikkat. |
| `selected_technician` | seçili usta | Customer'ın niyet olarak seçtiği usta. | Assignment ile karıştırılmamalı. |
| `accepted_offer_id` | kabul edilen teklif id | Eşleşmenin offer kaynağı. | Appointment/assignment zinciri için açık relation. |

---

## 8. Çekici Operasyonu

| English term | Türkçe karşılık | Açıklama | Kullanım notu |
| --- | --- | --- | --- |
| `tow_case` | çekici vakası | Towing subtype entity'si. | `TowCase`. |
| `tow_mode` | çekici modu | `immediate` veya `scheduled`. | Dispatch ailesi içinde kalır. |
| `tow_stage` | çekici aşaması | Çekici operasyon lifecycle state'i. | `ServiceCase.status` ile karıştırılmaz. |
| `dispatch` | canlı atama / çağrı dağıtımı | Ödeme sonrası çekici bulma süreci. | Havuz/teklif değildir. |
| `dispatch_attempt` | dispatch denemesi | Belirli bir çekiciye gönderilen çağrı denemesi. | Accept/decline/timeout üretebilir. |
| `radius_ladder` | çember genişletme | Yakındaki çekicilerden başlayıp alanı genişleten aday arama. | Kullanıcı isteğine göre sade ana mantık. |
| `tow_presence` | çekici canlı varlık/konum durumu | Redis/DB üzerinde online çekici konum ve uygunluk bilgisi. | Canonical DB + Redis hot cache. |
| `pickup_location` | alım noktası | Aracın alınacağı konum. | Towing quote/payment için zorunlu. |
| `dropoff_location` | teslim noktası | Aracın bırakılacağı konum. | Dispatch öncesi zorunlu. |
| `quote` | fiyat teklifi / tavan ücret hesabı | Backend'in route/mesafe üzerinden hesapladığı tutar. | UI amount authoritative değildir. |
| `cap_amount` | tavan tutar | Çekicide ön provizyon için üst sınır. | UI'da "En fazla ₺X". |
| `preauth` | ön provizyon | Çekici için ödeme garantisi. | Başarılı olmadan dispatch yok. |
| `capture` | tahsilat | İş bitince gerçek tutarın çekilmesi. | Preauth sonrası olur. |
| `void` | provizyon iptali | Kullanılmayan preauth'un serbest bırakılması. | 3DS abandon/cancel için önemli. |
| `settlement` | ödeme kapatma/uzlaşma | Çekici finansal lifecycle kaydı. | Preauth/capture/refund durumunu taşır. |
| `tow_tracking` | çekici takip ekranı | Customer'ın çağrı/konum/stage gördüğü ekran. | Map + stage + payment snapshot. |
| `tow_evidence` | çekici kanıtı | Varış/yükleme/teslim fotoğrafı veya OTP kanıtı. | Stage gate için kullanılabilir. |

---

## 9. Ödeme

| English term | Türkçe karşılık | Açıklama | Kullanım notu |
| --- | --- | --- | --- |
| `payment_core` | ödeme çekirdeği | Ürün bağımsız ödeme orkestrasyonu. | Tow, approval, campaign aynı ledger mantığı. |
| `payment_order` | ödeme emri | Ödenecek subject için ana ledger kaydı. | Amount backend kaynaklıdır. |
| `payment_attempt` | ödeme denemesi | PSP checkout/3DS denemesi. | Replay/idempotency korunmalı. |
| `payment_subject` | ödeme konusu | Ödemenin bağlandığı domain entity. | `tow_case`, `case_approval`, `campaign_purchase`. |
| `payment_mode` | ödeme modu | `preauth_capture` veya `direct_capture`. | Tow değişken tutar; campaign sabit tutar. |
| `payment_state` | ödeme durumu | Payment lifecycle state'i. | Case status yerine kullanılmaz. |
| `online_payment` | online ödeme | Naro/PSP üzerinden ödeme. | Çekici/kampanya zorunlu; servis tekliflerinde önerilen. |
| `offline_payment` | serviste ödeme | Serviste kart veya nakit. | Bakım/arıza/hasar teklif/fatura için izinli. |
| `service_card` | serviste kart | Offline ödeme yöntemi. | Naro komisyonu doğurmaz; kayıt tutulur. |
| `cash` | nakit | Offline ödeme yöntemi. | Naro sadece vaka geçmişine iz düşer. |
| `direct_capture` | doğrudan tahsilat | Sabit tutarlı ödeme. | Kampanya veya servis approval için. |
| `preauth_capture` | ön provizyon + tahsilat | Değişken/sonradan kesinleşen tutar. | Tow için. |
| `checkout_url` | ödeme sayfası URL'i | PSP hosted 3DS/checkout URL. | Kart bilgisi app/backend'e girmez. |
| `psp` | ödeme sağlayıcı | Iyzico/mock gibi ödeme entegrasyonu. | Route içine değil provider factory'ye bağlı. |
| `marketplace` | pazaryeri ödeme modeli | Platform + submerchant modeli. | Prod hedefi. |
| `submerchant` | alt üye işyeri | Servis/çekici adına ödeme alabilen provider hesabı. | Payment account ile ilişkilidir. |
| `payment_account` | ödeme hesabı | Technician'ın online ödeme alabilme kaydı. | Aktif iş alma gate'i olabilir. |
| `payout` | hak ediş aktarımı | Servise/çekiciye ödeme aktarımı. | Prod güvenlik/step-up ister. |

---

## 10. Approval ve Süreç İçi Kararlar

| English term | Türkçe karşılık | Açıklama | Kullanım notu |
| --- | --- | --- | --- |
| `case_approval` | vaka onayı | Müşterinin süreç içinde karar verdiği approval kaydı. | Payment subject olabilir. |
| `parts_request` | parça/kapsam onayı | Servisin parça veya kapsam netleştirme talebi. | "Ek ödeme" diye sunulmaz. |
| `invoice` | final fatura | Kabul edilen teklif/kapsam üzerinden kapanış faturası. | Online/offline ödeme seçilebilir. |
| `completion` | kapanış / teslim onayı | İş bitince müşteri onayı, puan ve final rapor. | Ödeme değil, kapanış akışıdır. |
| `scope_approval` | kapsam onayı | Sürpriz ek ücret yerine kullanılan doğru kavram. | Gerekçe zorunlu. |
| `final_invoice` | final fatura | İşin kapanış fatura onayı. | `invoice` approval copy'si. |
| `delivery_report` | teslim raporu | Ustanın işi teslim ederken sunduğu rapor. | Completion approval içinde görülebilir. |
| `rating` | puan | Completion sırasında müşteri puanı. | Zorunlu olabilir. |
| `review` | yorum/değerlendirme | Rating'e eşlik eden yazılı değerlendirme. | Showcase için izinli snapshot'a girebilir. |

---

## 11. Süreç, Timeline ve İletişim

| English term | Türkçe karşılık | Açıklama | Kullanım notu |
| --- | --- | --- | --- |
| `case_process` | vaka süreci | Eşleşme sonrası iki taraflı takip süreci. | Case create/matching öncesi başlamaz. |
| `process_pattern` | süreç pattern'i | Vaka türüne göre default takip akışı. | Backend seed veya tracking engine source-of-truth net olmalı. |
| `task` | görev | Süreçte yapılacak/izlenecek aksiyon. | UI task listesi canonical pattern'den türemeli. |
| `milestone` | kilometre taşı | Süreçte önemli aşama. | Task ile karıştırılmamalı. |
| `timeline_event` | zaman çizelgesi olayı | Case history/event kaydı. | Status değiştirmek zorunda değildir. |
| `status_update` | süreç notu / durum güncellemesi | Technician'ın case'e yazdığı süreç notu. | Timeline event üretir. |
| `thread` | vaka konuşması | Case tarafları arasındaki mesaj kanalı. | Case'in yerine geçmez. |
| `message` | mesaj | Thread içi tek ileti. | PII ve yetki guard gerekir. |
| `evidence` | kanıt | Vaka veya tow stage için foto/video/evrak. | `media_asset` ile bağlanır. |
| `media_asset` | medya varlığı | Upload edilmiş dosya kaydı. | Private/public ayrımı önemlidir. |
| `document` | evrak | Sigorta/tutanak/fatura gibi doküman. | Media'dan semantic olarak ayrılabilir. |

---

## 12. Sigorta ve Hasar Alt Alanı

| English term | Türkçe karşılık | Açıklama | Kullanım notu |
| --- | --- | --- | --- |
| `insurance_claim` | sigorta dosyası | Hasar vakasına bağlı sigorta/kasko süreci. | Case'in yerine geçmez. |
| `insurer` | sigorta şirketi | Poliçe sağlayıcı kurum. | Claim detayında. |
| `policy` | poliçe | Sigorta poliçe bilgisi. | Hassas veri olabilir. |
| `coverage` | teminat | Poliçenin kapsadığı alan. | Claim kararında. |
| `accident_report` | kaza tutanağı | Kaza/hasar evrakı. | Accident evidence/document. |
| `damage_area` | hasar bölgesi | Araçtaki hasarlı bölge. | Accident subtype field. |
| `damage_severity` | hasar şiddeti | Hasarın büyüklük derecesi. | Kullanıcı dostu seçeneklerle sorulmalı. |

---

## 13. Public Profil ve Güven Sinyali

| English term | Türkçe karşılık | Açıklama | Kullanım notu |
| --- | --- | --- | --- |
| `public_profile` | public usta profili | Müşteri app/keşif tarafında görünen servis profili. | PII-safe olmalı. |
| `showcase` | vitrin / doğrulanmış iş | Tamamlanan case'in izinli public çıktısı. | İki taraf onayı gerekir. |
| `public_showcase` | public vitrin kaydı | Backend public-safe showcase snapshot. | Raw case data döndürmez. |
| `public_safe_snapshot` | public-safe snapshot | PII redacted public veri. | UI filtrelemesine güvenilmez; backend üretir. |
| `consent` | onay / rıza | Showcase veya KVKK-benzeri izin. | Varsayılan kapalı. |
| `revoke` | izni geri çekme | Public showcase'i gizleme. | Response public'ten düşmeli. |
| `pii` | kişisel veri | Telefon, e-posta, açık adres, plaka, VIN gibi veri. | Public/pool response'larında korunur. |

---

## 14. App ve Adapter Terimleri

| English term | Türkçe karşılık | Açıklama | Kullanım notu |
| --- | --- | --- | --- |
| `customer_app` | müşteri uygulaması | Araç sahibi app'i. | `naro-app`. |
| `service_app` | servis uygulaması | Usta/çekici app'i. | `naro-service-app`. |
| `backend` | backend | API, domain services, DB. | `naro-backend`. |
| `adapter` | adapter / uyarlayıcı | Backend response'u UI modeline çeviren katman. | Mock store yerine live adapter. |
| `facade` | facade / tek giriş | Bir feature'ın public API/hook yüzeyi. | Mock/live sızıntısını engeller. |
| `store` | local store | UI state tutan client store. | Backend source-of-truth yerine geçmez. |
| `mock` | mock veri | Test/dev için sahte veri. | Aktif canlı akışta kullanılmaz. |
| `fixture` | fixture | Test/dev örnek veri. | Product flow source'u değildir. |
| `smoke` | smoke test | Uçtan uca hızlı doğrulama. | Ürün omurgası için manuel/otomatik yapılır. |
| `gate` | gate / kontrol kapısı | Canlıya veya akışa geçmeden önce bloklayan kural. | Backend enforce etmeli. |

---

## 15. Status ve State Terimleri

| English term | Türkçe karşılık | Açıklama | Kullanım notu |
| --- | --- | --- | --- |
| `status` | genel durum | Ana entity lifecycle state'i. | Hangi entity'nin status'ü olduğu her zaman açık yazılmalı. |
| `state` | iç durum / ödeme durumu | Daha dar lifecycle veya finansal state. | `payment_state`, `billing_state`, `settlement_state` gibi prefix'li kullan. |
| `stage` | operasyon aşaması | Özellikle çekici gibi adımlı operasyon lifecycle'ı. | `tow_stage` canonical. |
| `wait_state` | bekleyen taraf durumu | Case listesinde "kimden aksiyon bekleniyor?" cache'i. | Karar source'u değil, gösterim/cache alanıdır. |
| `lifecycle` | yaşam döngüsü | Entity'nin izinli geçiş kuralları. | Kodda lifecycle service ile enforce edilir. |
| `transition` | durum geçişi | Bir status/state/stage'den diğerine izinli geçiş. | Route yan etkisi değil domain event olmalı. |
| `terminal_state` | terminal durum | Artık normal akışa dönmeyen son durum. | `completed`, `cancelled`, `archived` gibi. |
| `active_state` | aktif durum | Kullanıcının aksiyon alabileceği veya süreç yaşayan durum. | Status enum'una göre açık liste gerekir. |
| `pending` | beklemede | Karar/yanıt bekleyen ara durum. | Hangi actor'den beklediğini `wait_actor` anlatmalı. |
| `approved` | onaylandı | Approval/appointment/certificate gibi entity onayı. | "Eşleşti" anlamına otomatik gelmez. |
| `rejected` | reddedildi | Approval/certificate/claim gibi entity reddi. | `declined` ile ayrımı entity bağlamında yapılır. |
| `declined` | geri çevrildi | Appointment/dispatch attempt gibi davet/çağrı reddi. | Approval reject ile karıştırılmasın. |
| `cancelled` | iptal edildi | Kullanıcı/sistem/admin iptali. | İptal ücreti veya refund ayrı domain state'tir. |
| `expired` | süresi doldu | TTL bitmiş teklif/randevu/OTP. | Kullanıcı reddi değildir. |
| `archived` | arşivlendi | Kapanmış/cancelled kayıtların pasif arşiv durumu. | Silme değildir. |

### 15.1 Case Status Değerleri

| Enum value | Türkçe karşılık | Açıklama | Dikkat |
| --- | --- | --- | --- |
| `matching` | eşleşme bekliyor | Vaka havuz/match aşamasında. | Tow immediate bu status'te olsa bile pool'a düşmemeli. |
| `offers_ready` | teklifler var | En az bir teklif veya teklif görülebilir durum. | Appointment değildir. |
| `appointment_pending` | randevu onayı bekliyor | Teklif kabulü sonrası randevu bekliyor. | Offer olmadan bakım/arıza/hasar için oluşmamalı. |
| `scheduled` | randevulu / planlandı | Servis zamanı netleşmiş. | Gerçek assignment burada başlar kabul edilebilir. |
| `service_in_progress` | servis süreci devam ediyor | Usta/servis işi yürütüyor. | Process pattern burada görünür. |
| `parts_approval` | kapsam/parça onayı bekliyor | Müşteri kapsam/parça onayı verecek. | "Ek ödeme" diye sunulmaz. |
| `invoice_approval` | final fatura onayı bekliyor | Final fatura/ödeme yöntemi kararı. | Completion değildir. |
| `completed` | tamamlandı | Vaka kapanış onayı tamamlanmış. | Showcase için aday olabilir. |
| `archived` | arşivlendi | Geçmiş kayda alınmış. | Silinmiş anlamına gelmez. |
| `cancelled` | iptal edildi | Vaka iptal edilmiş. | Ödeme/settlement ayrıca kapanmalı. |

### 15.2 Tow Stage Değerleri

| Enum value | Türkçe karşılık | Açıklama | Dikkat |
| --- | --- | --- | --- |
| `payment_required` | ödeme gerekiyor | Dispatch başlamadan ödeme/preauth beklenir. | Çekicide online ödeme zorunlu. |
| `scheduled_waiting` | planlı bekleme | Planlı çekici ödeme penceresi veya zamanı bekler. | Havuz/teklif değildir. |
| `searching` | çekici aranıyor | Dispatch candidate arama başladı. | Payment success sonrası. |
| `accepted` | çekici kabul etti | Technician dispatch'i kabul etti. | Henüz yola çıkmış olmak zorunda değil. |
| `en_route` | yolda | Çekici pickup'a gidiyor. | Live location önemlidir. |
| `nearby` | yakında | Çekici pickup'a yaklaştı. | Opsiyonel stage. |
| `arrived` | vardı | Çekici pickup noktasına vardı. | OTP/evidence gate olabilir. |
| `loading` | yükleniyor | Araç çekiciye yükleniyor. | Arrival doğrulaması sonrası. |
| `in_transit` | teslim yolunda | Araç dropoff'a taşınıyor. | Map/tracking devam eder. |
| `delivered` | teslim edildi | Araç teslim noktasına bırakıldı. | Capture/completion tetiklenir. |
| `preauth_failed` | ön provizyon başarısız | Ödeme başarısız. | Retry mümkün. |
| `preauth_stale` | ön provizyon eskidi | Ödeme yenilenmeli. | Dispatch başlamamalı. |
| `cancelled` | iptal edildi | Tow case iptal. | Settlement/fee ayrıca kapanır. |
| `bidding_open` | teklif açık | Eski/ayrı çekici teklif modu. | V1 dispatch çizgisinde kullanılmamalı. |
| `offer_accepted` | teklif kabul edildi | Eski/ayrı çekici teklif modu. | Dispatch V1 ile karıştırılmamalı. |
| `timeout_converted_to_pool` | timeout sonrası havuza döndü | Legacy/hybrid state. | V1 immediate/scheduled dispatch'te aktif ürün davranışı olmamalı. |

---

## 16. Usta, Capability ve Matching Sinyalleri

| English term | Türkçe karşılık | Açıklama | Kullanım notu |
| --- | --- | --- | --- |
| `technician_profile` | usta profili | Technician'ın public/operasyon profili. | User ile 1:1 olabilir. |
| `provider_type` | servis tipi | Ustanın ana hizmet tipi. | `usta`, `cekici`, `lastik`, `kaporta_boya` vb. |
| `secondary_provider_types` | ikincil servis tipleri | Ustanın yan hizmet alanları. | Pool/matching sinyali olabilir. |
| `provider_mode` | sağlayıcı modu | `business` veya `individual`. | KYC/payment account kararını etkiler. |
| `verified_level` | doğrulama seviyesi | `basic`, `verified`, `premium`. | Public sıralama/güven sinyali. |
| `availability` | müsaitlik | `available`, `busy`, `offline`. | Tow dispatch ve match görünürlüğünü etkiler. |
| `capability` | yetkinlik / imkan | Ustanın hizmet verebilme flag'leri. | `on_site_repair`, `valet_service`, `towing_coordination`. |
| `service_domain` | hizmet alanı | Taxonomy'de geniş servis domain'i. | Matching için güçlü sinyal. |
| `procedure` | işlem / prosedür | Belirli yapılabilir iş. | Örnek: fren değişimi, boya, elektrik arıza. |
| `procedure_tag` | işlem etiketi | Serbest ama normalize edilmiş usta etiketi. | Search/matching destek sinyali. |
| `brand_coverage` | marka kapsamı | Ustanın hizmet verdiği marka. | `is_authorized`, `is_premium_authorized` ile güçlenir. |
| `drivetrain_coverage` | motor/aktarma kapsamı | Benzin/dizel/EV vb. teknik kapsam. | Özellikle arıza/bakım eşleşmesinde. |
| `service_area` | servis alanı | Ustanın şehir/radius/atölye konumu. | Pool ve match için şart. |
| `working_district` | çalışılan ilçe | Ustanın hizmet verdiği ilçe. | Auto-suggested olabilir. |
| `working_schedule` | çalışma saatleri | Gün/saat bazlı müsaitlik planı. | Randevu ve match için. |
| `capacity` | kapasite | Personel, eşzamanlı iş, sıra derinliği. | Match skorunu etkiler. |
| `performance_snapshot` | performans snapshot'ı | Rating, tamamlama, iptal, yanıt süresi gibi ölçüler. | Sıralama/güven sinyali; opak ranking değil açıklanabilir olmalı. |
| `evidence_discipline_score` | kanıt disiplini puanı | Ustanın süreç kanıtlarını düzenli paylaşma sinyali. | Profil/matching güven sinyali. |
| `hidden_cost_rate` | gizli maliyet oranı | Sonradan maliyet çıkarma riski sinyali. | "Ek ödeme yok" ürün kararını destekler. |

### 16.1 Provider Type Değerleri

| Enum value | Türkçe karşılık | Açıklama |
| --- | --- | --- |
| `usta` | genel usta/servis | Genel servis sağlayıcı tipi. |
| `cekici` | çekici | Tow operator/capability sahibi servis. |
| `oto_aksesuar` | oto aksesuar | Aksesuar/cam filmi vb. |
| `kaporta_boya` | kaporta boya | Hasar/kaporta/boya ağırlıklı servis. |
| `lastik` | lastik | Lastik/jant ilişkili servis. |
| `oto_elektrik` | oto elektrik | Elektrik/akü/diagnostic ağırlıklı servis. |

---

## 17. Lokasyon, Harita ve Mesafe

| English term | Türkçe karşılık | Açıklama | Kullanım notu |
| --- | --- | --- | --- |
| `location` | konum | Genel coğrafi nokta veya adres. | Açık adres PII olabilir. |
| `geo_point` | koordinat | Lat/lng nokta. | Backend mesafe hesabında canonical. |
| `lat` / `lng` | enlem / boylam | Koordinat parçaları. | Sıra karıştırılmamalı. |
| `city_code` | şehir kodu | Şehir bazlı matching/presence key. | Redis geo index için. |
| `district_id` | ilçe id | Taxonomy district kaydı. | Working district/service area. |
| `service_radius_km` | hizmet yarıçapı | Ustanın hizmet verdiği km alanı. | Match/pool için. |
| `route_distance` | rota mesafesi | Harita provider'dan gelen yol mesafesi. | Haversine'dan daha doğru. |
| `haversine_distance` | kuş uçuşu mesafe | Provider yoksa fallback mesafe. | Quote'da source belirtilmeli. |
| `eta_minutes` | tahmini süre | Varış veya iş için dakika. | Offer ve tow dispatch'te farklı bağlam. |
| `maps_provider` | harita sağlayıcı | Google/offline gibi route provider. | UI public key, backend server key ayrılmalı. |

---

## 18. Medya, Evrak ve Kanıt

| English term | Türkçe karşılık | Açıklama | Kullanım notu |
| --- | --- | --- | --- |
| `media_asset` | medya varlığı | Upload edilmiş dosyanın canonical kaydı. | Owner/link ayrımı önemli. |
| `media_purpose` | medya amacı | Dosyanın kullanım amacı. | `case_evidence_photo`, `tow_delivery_photo` vb. |
| `media_visibility` | medya görünürlüğü | `private` veya `public`. | Case evidence default private. |
| `media_status` | medya durumu | Upload/processing/ready/failed/deleted. | UI hazır olmayan medyayı doğru göstermeli. |
| `owner_kind` | sahip türü | Media'nın semantic owner'ı. | Polymorphic, service layer validate eder. |
| `linked_case_id` | bağlı vaka id | Media'nın case ile bağlandığı reuse guard. | Owner ile aynı şey olmayabilir. |
| `case_document` | vaka evrakı | Case UI'da gruplanan belge/kanıt. | Media purpose'tan sınıflandırılabilir. |
| `case_evidence_item` | vaka kanıt kaydı | Kanıtın case/process ile semantik ilişkisi. | Sadece media asset yeterli olmayabilir. |
| `damage_photo` | hasar fotoğrafı | Hasar alanı görseli. | Accident case evidence. |
| `insurance_doc` | sigorta evrakı | Poliçe/tutanak/dosya belgesi. | Hassas olabilir. |
| `tow_arrival_photo` | çekici varış fotoğrafı | Pickup varış kanıtı. | Stage gate olabilir. |
| `tow_loading_photo` | yükleme fotoğrafı | Aracın yüklendiği an kanıtı. | Loading gate olabilir. |
| `tow_delivery_photo` | teslim fotoğrafı | Dropoff teslim kanıtı. | Delivered gate için. |
| `public_copy` | public kopya | Private medyanın public-safe kopyası. | Showcase raw private URL kullanmaz. |
| `signed_url` | imzalı URL | Geçici medya erişim URL'i. | Log/telemetry'ye düşmemeli. |

---

## 19. Auth, Onboarding ve Hesap

| English term | Türkçe karşılık | Açıklama | Kullanım notu |
| --- | --- | --- | --- |
| `auth_session` | oturum | Kullanıcının authenticated state'i. | Approval status ile karıştırılmaz. |
| `otp` | tek kullanımlık kod | Telefon/e-posta doğrulama kodu. | Normalize edilmiş hedef gerekir. |
| `otp_channel` | OTP kanalı | SMS, WhatsApp, console vb. | Prod/test ayrımı net olmalı. |
| `approval_status` | kullanıcı onay durumu | Technician admin/KYC approval state'i. | `user.status` ile farklı. |
| `user_status` | kullanıcı hesap durumu | Pending/active/suspended. | Role-specific approval değildir. |
| `technician_admission` | usta kabul/giriş uygunluğu | Sertifika, ödeme hesabı, role config toplam gate'i. | Service app bloklarında görünür. |
| `certificate` | sertifika / belge | Technician doğrulama evrakı. | Certificate status ile yönetilir. |
| `certificate_kind` | sertifika türü | Kimlik, vergi, sigorta, çekici operatörü vb. | Provider mode/capability gate. |
| `certificate_status` | sertifika durumu | Pending/approved/rejected/expired. | Verified level hesaplanır. |
| `payment_account_status` | ödeme hesabı durumu | Online ödeme alabilme onboarding state'i. | Aktif iş gate'i. |
| `legal_type` | yasal işletme tipi | Şahıs/şirket ayrımı. | Submerchant başvurusunda. |
| `step_up_auth` | ek güvenlik doğrulaması | IBAN/payout/submerchant gibi riskli değişikliklerde ek OTP. | Prod release gate. |

---

## 20. Kampanya, Paket ve Keşif

| English term | Türkçe karşılık | Açıklama | Kullanım notu |
| --- | --- | --- | --- |
| `campaign` | kampanya | Servisin yayınladığı fiyatı belli teklif/paket duyurusu. | Online ödeme zorunlu olabilir. |
| `package` | paket | Belirli kapsam ve fiyatlı hizmet paketi. | Campaign ile ilişkili olabilir. |
| `campaign_purchase` | kampanya satın alımı | Müşterinin kampanya/paket için online ödeme subject'i. | `direct_capture`. |
| `discover_feed` | keşif akışı | Müşteri app'te servis/kampanya içerik yüzeyi. | Vaka match bandı ile karıştırılmamalı. |
| `home_summary` | ana sayfa özeti | Customer home için aktif vaka, öneriler, feed özeti. | `suggestions` canlı match read-model'den gelmeli. |
| `technician_feed_item` | usta feed kartı | Public/discover usta kartı. | Match badge varsa case context gerekir. |
| `suggestion` | öneri | UI presentation terimi. | Domain kaydı `case_technician_match` olmalı. |
| `quick_action` | hızlı menü aksiyonu | Bakım/arıza/hasar/çekici entrypoint'i. | Her biri case creation'a çıkar. |

---

## 21. Legacy / Compat / Açık Karar Terimleri

Bu bölümdeki terimler sistemde yaşayabilir ama yeni ürün akışında dikkatle izole edilmelidir.

| English term | Türkçe karşılık | Durum | Karar |
| --- | --- | --- | --- |
| `request` | talep | Legacy/generic | Yeni ana domain kavramı `case`. UI'da "talep" copy olabilir ama kodda belirsiz kullanılmamalı. |
| `job` | iş | Service app görünümü | Atanmış/aktif case'in service app projection'ı olabilir; ana backend entity değildir. |
| `direct_request` | doğrudan randevu talebi | Legacy/riskli | Bakım/arıza/hasar için aktif ürün akışından çıkarılmalı. |
| `bid` | teklif / açık artırma teklifi | Riskli | `offer` kullan. Çekici teklif pazarı ayrı mod olursa yeniden tanımlanır. |
| `tow_bid` | çekici teklifi | Compat/future | V1 immediate/scheduled dispatch modelinde aktif olmamalı. |
| `bidding_open` | teklif açık | Compat/future | Planlı çekici dispatch kararına göre izole edilmeli. |
| `additional_amount` | ek tutar | Legacy/riskli | UI/ürün dili `scope_approval` veya `final_invoice` olmalı. |
| `extra_payment` | ek ödeme | Yasaklı ürün dili | Sürpriz ek ödeme hissi doğurur. |
| `case_links` | vaka bağlantıları | Açık karar | General graph modeli ayrı tasarlanmalı; V1 tow parent_case_id ile ilerleyebilir. |
| `workflow_seed` | workflow seed | Açık karar | Backend process source-of-truth olacak mı netleşmeli. |
| `tracking_engine` | tracking engine | Açık karar | UI task/milestone source-of-truth ise backend seed yorumları düzeltilmeli. |

---

## 22. Naming Kararları (Güncel)

Bu bölüm refactor sırasında kararlanmış noktaları taşır. Tarih: 2026-04-26.

| Konu | Karar | Not |
| --- | --- | --- |
| `assigned_technician_id` anlamı | **Katı:** yalnız randevu `APPROVED` sonrası set edilir. Müşteri niyeti / hedef usta için mevcut `preferred_technician_id` sıkılaştırılır; **yeni `selected_technician_id` kolonu açılmaz.** | Refactor planı Q1; canonical_docs memory ile uyumlu. |
| Vaka bağlantıları | **V1:** mevcut `TowCase.parent_case_id` çizgisi. Genel typed `case_links` graph **V1.1**. | Refactor planı Q2. |
| Süreç source-of-truth | **Backend `workflow_blueprint` canonical**; frontend yalnız presentation/config layer; mobile tracking engine canonical karar vermez. | Refactor planı Q3. |
| `CaseTechnicianMatch` read-model | **V1'e dahil.** Teklif değildir, bildirim değildir, assignment değildir. Uygun usta kartları ve havuz sıralaması bu read-model'den beslenir. | Refactor planı Q4. |
| `case_dossier` vs `case_profile` | **API/system dili `case_dossier`; UI ekran adı `case_profile`.** İkisi farklı katmanda yaşar. | Refactor planı Q5. |
| Planlı çekici ödeme penceresi | Pencere sonu = otomatik iptal. Ek grace timeout yok. | Refactor planı C1. |
| Çekici cancel fee matrisi | `PAYMENT_REQUIRED`/`SCHEDULED_WAITING`/`SEARCHING`: %0; `ACCEPTED`/`EN_ROUTE`: %50; `NEARBY`/`ARRIVED`/`LOADING`/`IN_TRANSIT`: %100. | Refactor planı C2. |
| Çekici teklif modu | **V1:** immediate/scheduled dispatch (havuz/teklif yok). Offer market ayrı future mode. | Genişletilmiş §4.1. |
| Kampanya domain adı | Kodda `campaign` + `package` ayrımı; `deal` kullanma. | — |
| Usta mı servis mi? | Kodda `technician`; UI bağlama göre "usta" veya "servis". | — |

---

## 23. Naming Karar Tablosu

| Durum | Canonical isim | Kaçınılacak isim | Not |
| --- | --- | --- | --- |
| Ana iş nesnesi | `case` | `request`, `job` | `request` sadece legacy/draft; `job` servis app görünümü olabilir. |
| Müşteri formu | `composer` | `form`, `wizard` | "Form" hissini ürün dilinde azaltır. |
| Case oluşturma snapshot'ı | `request_draft` | `case_data`, `raw_case` | Audit snapshot; karar kaynağı değil. |
| Uygun usta | `case_technician_match` | `suggestion`, `recommendation` | Suggestion UI alanı olabilir ama domain kaydı match'tir. |
| Ustaya gönderme | `notify_case_to_technician` | `direct_appointment`, `message_shop` | Bu aksiyon teklif istemeye bağlanır. |
| Servis cevabı | `offer` | `bid` | `bid` çekici teklif pazarı gibi ayrı future mod çağrıştırır. |
| Randevu | `appointment` | `booking` | Booking generic; appointment domain daha net. |
| Gerçek eşleşme | `assignment` | `selection` | Selection niyet olabilir; assignment süreç başlatır. |
| Çekici aşaması | `tow_stage` | `case_status` | Tow operasyon state'i ayrı. |
| Kapsam revizyonu | `scope_approval` | `extra_payment`, `additional_fee` | Sürpriz ek ödeme dili yasak. |
| Final ödeme | `invoice` / `final_invoice` | `extra_invoice` | Completion ödeme değildir. |
| Public iş vitrini | `showcase` | `gallery`, `portfolio_item` | Showcase iki taraf onaylı case sonucudur. |

---

## 24. Refactor Sırasında Kullanılacak Kısa Checklist

Yeni bir dosya, model, endpoint, hook veya ekran yazarken:

1. Bu kavram sözlükte var mı?
2. Yoksa gerçekten yeni domain kavramı mı, yoksa mevcut kavramın alias'ı mı?
3. Kod ismi English canonical mı?
4. UI karşılığı Türkçe ürün diline uygun mu?
5. Source-of-truth tablo/response belli mi?
6. Customer app ve service app aynı anlamla mı kullanıyor?
7. Bu isim `case`, `offer`, `appointment`, `assignment`, `payment`, `approval`, `tow_stage` sınırlarından birini bulanıklaştırıyor mu?
8. Testte bu terim yanlış kullanılırsa yakalanıyor mu?

Kural:

> Yeni alias üretme. Önce sözlükteki kavramı kullan. Yetmiyorsa sözlüğe yeni terimi ekle, sonra kodu yaz.

---

## 25. Kodda Yaşayan Enum / Facet Ekleri

Bu bölüm son kontrol ekidir. Ana ürün kavramları yukarıdaki bölümlerde
tanımlıdır; buradaki terimler kodda yaşayan enum, facet veya yardımcı state
adlarıdır. Refactor sırasında bunlar yeni domain kavramı gibi çoğaltılmamalı,
ait oldukları ana kavrama bağlanmalıdır.

### 25.1 Case Shell Facet'leri

| English term | Türkçe karşılık | Bağlı ana kavram | Kullanım notu |
| --- | --- | --- | --- |
| `service_request_urgency` | vaka aciliyeti | `case` | `planned`, `today`, `urgent`; kullanıcı dili ve dispatch aciliyetiyle karıştırılmamalı. |
| `case_origin` | vaka kaynağı | `case` | `customer` veya `technician`; çoğu vaka customer kaynaklıdır. |
| `case_wait_actor` | beklenen aktör | `wait_state` | `customer`, `technician`, `system`, `none`; gösterim/cache alanı, lifecycle source-of-truth değil. |
| `workflow_blueprint` | süreç blueprint'i | `process_pattern` | Case create sonrası milestone/task seed için template anahtarı. |

### 25.2 Composer ve Kind-Specific Facet'ler

| English term | Türkçe karşılık | Bağlı ana kavram | Kullanım notu |
| --- | --- | --- | --- |
| `service_pickup_preference` | teslim/alım tercihi | `composer` | Bakım/arıza/hasar servis lojistiği; çekici `pickup_location` değildir. |
| `price_preference` | fiyat tercihi | `composer` | `cheap`, `fast`, `nearby` gibi kullanıcı sinyali; bağlayıcı fiyat kararı değildir. |
| `breakdown_category` | arıza kategorisi | `breakdown` | Kullanıcı teşhisi değil, semptom yönlendirme sinyalidir. |
| `maintenance_category` | bakım kategorisi | `maintenance` | Periyodik, lastik, akü, klima vb. flow kararını belirler. |
| `accident_report_method` | hasar bildirim yöntemi | `accident` | E-devlet, polis, kağıt tutanak gibi evrak bağlamı. |
| `case_attachment_kind` | vaka eki türü | `attachment_requirement` | Photo/video/document gibi submit-time attachment türü. |
| `damage_severity` | hasar şiddeti | `accident` | Hasar matching ve UX risk sinyali. |

### 25.3 Offer ve Appointment Facet'leri

| English term | Türkçe karşılık | Bağlı ana kavram | Kullanım notu |
| --- | --- | --- | --- |
| `case_offer_status` | teklif durumu | `offer` | `pending`, `shortlisted`, `accepted`, `rejected`, `expired`, `withdrawn`. |
| `case_offer_kind` | teklif türü | `offer` | `standard` canonical; `tow_scheduled` compat/future olarak izole edilmeli. |
| `appointment_status` | randevu durumu | `appointment` | Pending/approved/declined/expired/cancelled/counter_pending. |
| `appointment_source` | randevu kaynağı | `appointment` | `offer_accept` canonical; `direct_request` legacy/riskli; `counter` counter-flow. |
| `appointment_slot_kind` | randevu zaman türü | `appointment` | Today/tomorrow/custom/flexible; fiyat/teklif kararının yerine geçmez. |
| `counter_proposal` | karşı zaman önerisi | `appointment` | Ustanın randevu zamanı karşı önerisi; yeni teklif entity'si değildir. |

### 25.4 Tow Operasyon Facet'leri

| English term | Türkçe karşılık | Bağlı ana kavram | Kullanım notu |
| --- | --- | --- | --- |
| `tow_equipment` | çekici ekipmanı | `tow_case` | Flatbed/hook/wheel_lift/heavy_duty/motorcycle; kullanıcı ana kararı gibi sunulmamalı. |
| `tow_incident_reason` | çekici sebebi | `tow_case` | Not running, accident, tire, battery vb. quote/dispatch sinyali. |
| `tow_dispatch_response` | dispatch cevabı | `dispatch_attempt` | Pending/accepted/declined/timeout; `tow_stage` değildir. |
| `tow_settlement_status` | çekici ödeme kapama durumu | `settlement` | Pre-auth/capture/refund/cancel finansal state'i. |
| `tow_refund_reason` | çekici iade nedeni | `settlement` | Capture delta, cancellation, kasko reimbursement, manual. |
| `tow_cancellation_actor` | çekici iptal eden aktör | `tow_cancellation` | Customer/technician/system/admin. |
| `tow_otp_purpose` | çekici OTP amacı | `tow_evidence` | Arrival veya delivery doğrulaması. |
| `tow_otp_recipient` | OTP alıcısı | `tow_evidence` | Customer veya teslim alan kişi. |
| `tow_otp_delivery` | OTP teslim kanalı | `tow_evidence` | SMS veya in-app. |
| `tow_otp_verify_result` | OTP doğrulama sonucu | `tow_evidence` | Pending/success/failed/expired. |

### 25.5 Süreç ve Timeline Facet'leri

| English term | Türkçe karşılık | Bağlı ana kavram | Kullanım notu |
| --- | --- | --- | --- |
| `case_actor` | vaka aktörü | `case_process` | Customer/technician/system; task ownership için. |
| `case_milestone_status` | milestone durumu | `milestone` | Completed/active/upcoming/blocked. |
| `case_task_status` | task durumu | `task` | Pending/active/completed/blocked. |
| `case_task_urgency` | task aciliyeti | `task` | Background/soon/now; vaka aciliyeti ile karıştırılmasın. |
| `case_task_kind` | task türü | `task` | UI aksiyon tipi; lifecycle kararının yerine geçmez. |
| `case_event_type` | timeline event türü | `timeline_event` | Append-only audit olayı. Status/state yerine kullanılmaz. |
| `case_tone` | event tonu | `timeline_event` | UI rengi/önemi; domain kararı değildir. |
| `case_notification_intent_type` | bildirim intent türü | `notification_intent` | Push/SMS delivery kuyruğu; matching kaydı değildir. |

### 25.6 Araç Facet'leri

| English term | Türkçe karşılık | Bağlı ana kavram | Kullanım notu |
| --- | --- | --- | --- |
| `vehicle_kind` | araç türü | `vehicle` | Otomobil, SUV, motosiklet vb.; matching için kritik sinyal. |
| `vehicle_fuel_type` | yakıt türü | `vehicle` | Petrol/dizel/LPG/electric/hybrid/other. |
| `vehicle_transmission` | şanzıman | `vehicle` | Manuel/otomatik/yarı otomatik. |
| `vehicle_drivetrain` | aktarma | `vehicle` | FWD/RWD/AWD/4WD; arıza/bakım matching sinyali. |
| `user_vehicle_link` | kullanıcı-araç bağlantısı | `vehicle` | Araç sahipliği/erişim ilişkisi. |
| `user_vehicle_role` | araçtaki kullanıcı rolü | `vehicle` | Owner/driver/family. |
| `history_consent` | araç geçmişi izni | `vehicle` | Vaka geçmişi/servis geçmişi paylaşımı için consent. |

### 25.7 Medya Güvenlik Facet'leri

| English term | Türkçe karşılık | Bağlı ana kavram | Kullanım notu |
| --- | --- | --- | --- |
| `upload_id` | yükleme id'si | `media_asset` | Upload lifecycle için idempotent anahtar. |
| `bucket_name` | bucket adı | `media_asset` | Storage alanı; public response'ta gereksiz. |
| `object_key` | obje anahtarı | `media_asset` | Storage path'i; log/public response'ta dikkatli kullanılmalı. |
| `preview_object_key` | önizleme obje anahtarı | `media_asset` | Görsel/video önizleme. |
| `thumb_object_key` | küçük görsel anahtarı | `media_asset` | Kart/listelerde kullanılabilir. |
| `antivirus_verdict` | antivirüs sonucu | `media_asset` | Clean/infected/skipped; public/private erişim gate'i. |
| `exif_stripped_at` | EXIF temizlenme zamanı | `media_asset` | PII/location sızıntısı kontrolü. |

### 25.8 Auth ve Hesap Facet'leri

| English term | Türkçe karşılık | Bağlı ana kavram | Kullanım notu |
| --- | --- | --- | --- |
| `user_role` | kullanıcı rolü | `user` | Customer/technician/admin. |
| `auth_identity_provider` | kimlik sağlayıcı | `auth_session` | OTP phone/email veya ileride sosyal provider. |
| `auth_event_type` | auth olay türü | `auth_session` | Güvenlik/audit event'i. |
| `otp_channel` | OTP kanalı | `otp` | SMS, WhatsApp, console vb. |
| `user_approval_status` | kullanıcı onay durumu | `technician_admission` | Technician KYC/admin approval; `user_status` ile karışmamalı. |

### 25.9 Sigorta, Billing ve Refund Facet'leri

| English term | Türkçe karşılık | Bağlı ana kavram | Kullanım notu |
| --- | --- | --- | --- |
| `insurance_coverage_kind` | sigorta teminat türü | `insurance_claim` | Kasko/trafik/other gibi claim kapsamı. |
| `insurance_claim_status` | sigorta dosyası durumu | `insurance_claim` | Submitted/accepted/paid/rejected. |
| `billing_state` | servis ödeme/billing durumu | `payment_core` | Legacy/generic billing state ise Payment Core ile çakışması audit edilmeli. |
| `case_refund_reason` | servis iade nedeni | `payment_core` | Cancellation/dispute/excess_preauth/kasko/admin. |
| `case_refund_state` | servis iade durumu | `payment_core` | Pending/success/failed. |
| `case_kasko_state` | kasko geri ödeme durumu | `insurance_claim` | Kasko reimbursement lifecycle. |
| `payment_idempotency_state` | ödeme idempotency durumu | `payment_core` | PSP replay ve duplicate callback koruması. |
| `payment_operation` | ödeme operasyonu | `payment_core` | Authorize/capture/refund/void. Tow tarafındaki `tow_payment_operation` ile semantic aynı, scope farklı. |

Son kontrol kuralı:

> Bu ek bölümdeki terimler yeni ürün akışı icat etmek için değil, mevcut canonical kavramların kod karşılıklarını kaybetmemek için tutulur.
