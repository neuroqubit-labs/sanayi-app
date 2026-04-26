# Vaka Omurgası — Revize Fix Haritası Audit'i

**Tarih:** 2026-04-26  
**Amaç:** Mevcut fix haritasını vaka omurgası anlatısına ve kod gerçekliğine göre düzeltmek.  
**Orijinal harita:** [2026-04-26-vaka-omurgasi-fix-haritasi.md](2026-04-26-vaka-omurgasi-fix-haritasi.md)  
**Canonical referanslar:**
- [docs/naro-domain-glossary.md](../naro-domain-glossary.md)
- [docs/naro-vaka-omurgasi.md](../naro-vaka-omurgasi.md)
- [docs/naro-vaka-omurgasi-genisletilmis.md](../naro-vaka-omurgasi-genisletilmis.md)

Bu doküman kod düzeltmesi değildir. Mevcut fix haritasını silmeden, sonraki implementation turu için daha doğru ve uygulanabilir bir harita çıkarır.

---

## Executive Summary

Mevcut fix haritası doğru problem alanlarına bakıyor; fakat bazı maddelerde kısa vadeli uygulama kolaylığı ürün omurgasını gevşetiyor. Bu dokümanın nihai amacı Naro'da vakanın yanlış iş mantığına kaymasını engelleyen ürün bel kemiğini netleştirmektir.

En kritik 6 düzeltme:

1. **F1 sadece backend `offer_id` zorunluluğu değil; FE contract da bozuk.** Customer app appointment payload'u `offer_id` göndermiyor ve randevu ekranı offer yokken de submit edebiliyor.
2. **F5 "Ustaya Vaka Bildir" ertelenebilir kozmetik feature değil, direct appointment yasağının ürün karşılığıdır.** No-offer randevuyu kapatıp yerine gerçek vaka bildirim/teklif isteme akışı koymazsak müşteri keşif deneyimi eksik kalır.
3. **F6 immediate tow pool sızıntısı gerçek risk.** `list_pool_cases` tow subtype/tow_mode filtrelemiyor; `CEKICI` provider towing kind görebiliyor; immediate tow `MATCHING` ise pool'a düşebilir.
4. **Backend ilişki semantiği netleşmeden frontend fix'i kalıcı olmaz.** Appointment/offer/assignment/tow-stage ilişkileri route seviyesinde değil, domain guard + test seviyesinde kapanmalı.
5. **Vaka oluşturma akışlarında çekici yanlış yerde duruyor.** Kaza dışında çekici ara adım olmamalı; bakım/arıza akışında son karar olarak "Çekici de istiyor musun?" sorulmalı ve evet ise doğrudan çekici çağırma ekranına gidilmeli.
6. **Vaka profili ayrı bir ürün yüzeyi olarak netleşmeli.** Profil karmaşık süreç ekranı değil; vaka oluşturulurken girilen tüm detayların, araç snapshot'ının, kanıtların ve bağlı alt süreçlerin okunabilir dosyası olmalı. Teklifler/randevu/süreç aksiyonları bunun altında optimize edilmelidir.

Müşteri ve servis uygulamaları bu fix haritasının dışında değildir. Müşteri app yanlış akışı başlatan yüzeydir; servis app ise havuz, teklif, randevu onayı, çekici online olma ve parça/fatura onayı yüzeyidir. Bu dokümanın ilk versiyonunda iki app etkisi yeterince görünür değildi; bu revizyon bunu açıkça kapsar.

Backend tarafında da sadece endpoint davranışı değil, model ilişkileri ve enum dili düzeltilmelidir. `AppointmentSource.DIRECT_REQUEST`, nullable `offer_id`, `CaseOfferKind.TOW_SCHEDULED`, `TowDispatchStage.BIDDING_OPEN/OFFER_ACCEPTED/TIMEOUT_CONVERTED_TO_POOL` ve erken `assigned_technician_id` set edilmesi, yeni vaka omurgasına göre yeniden sınıflandırılması gereken kalıntılardır.

Ürün omurgası için minimum set:

- P0: Offer'sız appointment kapısı kapansın; FE no-offer randevu CTA'sı kapansın.
- P0: Immediate tow pool feed'den kesin dışlansın.
- P0: Towing case'lere backend offer submit kapansın; planlı çekici V1 dispatch/payment-window çizgisinden sapmasın.
- P1: "Ustaya Vaka Bildir" gerçek matching/offer sinyali olarak kurulup direct appointment'ın yerine geçsin.
- P1: Sistem tarafından hesaplanan "bu vakaya uyumlu ustalar" kalıcı read-model olarak oluşsun; müşteri ve servis app aynı uyum listesini kullansın.
- P1: Ana sayfada aktif vaka varsa "Bu vakan için uygun ustalar" bandı canlı match read-model'den beslensin; home şu an boş/mock kalmamalı.
- P1: Bakım/arıza composer akışları cesurca sadeleşsin; çekici ara state değil son karar ve ayrı tow case yönlendirmesi olsun.
- P1: Kapsam/fatura onayı dili ve zorunlu gerekçe netleşsin.
- P1: Assignment ve subtype integrity testleri yazılsın; ileride state drift'i üretmesin.
- P1: Vaka profili iki app'te canonical dossier olarak çalışsın; oluşturma detayları eksiksiz ve teklifler/süreç aksiyonları ayrışmış olsun.
- P1: Vaka süreç tracking source-of-truth'u netleşsin; backend seed pasifse doküman ve tüketiciler buna göre düzeltilsin, aktifse eksik blueprint'ler tamamlansın.
- P1: Vaka servisi için tek contract yazılsın ve backend/customer app/service app aynı sözleşmeden yürüsün; paralel mock, draft veya ekran bazlı yorumlar temizlensin.

---

## Canonical Kurallar

Bu audit'te her madde şu kurallara göre değerlendirildi:

- Araçsız vaka olmaz.
- `ServiceCase` ortak vaka shell'idir; her yeni vaka kendi `kind` değerine uygun tam bir subtype satırıyla birlikte yaşar.
- Bakım, arıza ve hasar teklif olmadan doğrudan randevuya dönmez.
- "Ustaya vaka bildir" doğrudan randevunun yerine geçer; usta bildirimden sonra teklif üretir.
- "Uyumlu usta" ile "teklif veren usta" ayrı kavramdır; sistem case açılınca uyumlu adayları hesaplar, teklif ise bu aday/usta aksiyonunun sonucudur.
- Acil çekici ödeme/preauth sonrası canlı dispatch'e girer.
- Planlı çekici V1'de scheduled payment-window + dispatch modelidir; havuz/teklif modeli değildir.
- Vaka profili, vaka dosyasıdır: shell + subtype + araç snapshot + kanıtlar + bağlı çekici/sigorta + teklif/randevu/süreç özetini gösterir.
- Vaka altı composer akışları basitten zora ve somuttan soyuta ilerler; açıklama ilk adım değil, bağlam oluştuktan sonraki detay adımıdır.
- Vaka süreci eşleşme sonrası başlar.
- Kaza dışında çekici sorusu composer'ın ara adımı değildir; bakım/arıza sonunda ayrı çekici çağırma kararına dönüşür.
- Arıza/bakım içinde `towing_required=true` gibi otomatik promise verilmez; çekici istenirse ayrı `towing` case açılır ve gerekiyorsa parent case'e bağlanır.
- "Ek ödeme" normal akış değildir; gerçek kapsam değişikliği varsa bunun adı kapsam/fatura onayıdır.
- `ServiceCase.status` genel vaka state'idir; `tow_stage` çekici operasyon state'idir.
- `request_draft` audit snapshot'tır; kritik kararların source-of-truth'u olmamalıdır.
- Offer, appointment, assignment, approval ve payment birbirinin yerine geçmez; her biri kendi domain tablosunda gerçek ilişkiyle temsil edilir.
- Vaka servisi tek sözleşmeyle çalışır: case shell, subtype detail, matching, offer, appointment, tow lifecycle, payment, process, approval ve profile/dossier aynı contract'ın parçalarıdır.
- Public showcase iki taraf onayı ve PII redaction ister.

---

## Revize Öncelik Tanımları

| Öncelik | Anlam |
| --- | --- |
| P0 Ürün İnvariantı | Bu kırılırsa vaka omurgası yanlış çalışır; workaround kabul edilmez. |
| P1 Ürün Omurgası | Eksiksiz vaka akışı için gerekir; P0'dan sonra aynı ana refactor hattında ele alınır. |
| P2 Release/Security Gate | Ürün mantığını tamamlar ama daha çok prod güvenliği, operasyon veya regülasyon kapısıdır. |
| P3 Ayrı Ürün Modülü | Vaka omurgasına bağlıdır ama ayrı sprint/epic olarak tasarlanmalıdır. |

---

## F Maddesi Revizyon Tablosu

| Madde | Revizyon | Kod kanıtı | Yeni öncelik | Aksiyon |
| --- | --- | --- | --- | --- |
| F1 Direct appointment kapat | **REWRITE + SPLIT** | `appointments.py:create_direct_request` offer'sız endpoint. `AppointmentRequestPayloadSchema` sadece `case_id/technician_id/slot/note` gönderiyor. `RandevuRequestScreen` offer yokken de "Usta belirleyecek" ile submit edebiliyor. `technician-cta.ts` aktif vaka için doğrudan `/randevu/{technicianId}?caseId=...` route'u üretiyor. `CaseComposerScreen` preferred technician varsa vaka sonrası randevuya geçebiliyor. | P0 | Backend offer'sız appointment'ı 422 yap. Customer app no-offer randevu CTA/route'larını kapat. Offer kabul akışında payload'a `offer_id` ekle veya ayrı endpoint kullan. |
| F2 Ek ödeme dili | **REWRITE** | `ApprovalRequestPayload.description` optional. Service app `JobTaskScreen` parts/invoice notlarını opsiyonel tutuyor. `case_billing.py` hâlâ `additional_amount`, `ADDITIONAL_*` state dili taşıyor. UI billing badge "Ek tutar" gösteriyor. | P1 | "Ek ödeme" değil "Kapsam Onayı / Final Fatura". Description parts/invoice için zorunlu. Service app parts/fatura formlarında gerekçe zorunlu ve görünür olacak. Legacy billing copy/state drift'i ayrıca temizlenecek. |
| F3 Tow capture hook | **KEEP / VERIFY** | Mevcut harita capture hook'un doğrulandığını söylüyor; ayrıca regression test yeterli. | P1 | Çekici online ödeme zorunluysa capture/void/refund davranışı ürün akışının parçasıdır. Uçtan uca tow payment smoke zorunlu. |
| F4 Eksik blueprint seed | **REWRITE** | `resolve_blueprint` `BREAKDOWN_STANDARD`, `TOWING_IMMEDIATE`, `TOWING_SCHEDULED` üretiyor. `workflow_seed.py` sadece damage/maintenance template içeriyor. Ancak `seed_blueprint` çağrısı kodda bulunamadı. | P1 | "Kesin create crash" deme. Ama süreç tracking source-of-truth'u ürün kararıdır: seed pasifse tracking engine canonical yazılmalı; seed aktifse tüm blueprint template'leri tamamlanmalı. |
| F5 Ustaya vaka bildir | **PROMOTE + SPLIT** | Model/event/endpoint yok. Full-stack yeni feature. | P1 | No-offer randevuyu kapatmak tek başına yeterli değil. "Ustaya vaka bildir" gerçek matching/offer sinyali olarak kurulmalı: müşteri CTA, backend intent, servis inbox/notification, teklif verme dönüşü. |
| F6 Immediate tow pool filter | **KEEP + PROMOTE** | `list_pool_cases` sadece `ServiceCase.status/kind/assigned` filtreliyor. `KIND_PROVIDER_MAP` towing'i `CEKICI`ye açıyor. Immediate tow `MATCHING`/pool-visible olabilir. | P0 | Pool query tow subtype join ile `tow_mode=immediate` dışlasın. Detail endpoint de aynı guard'ı uygulasın. |
| F7 Anlatı §6 sync | **KEEP as PRODUCT REFERENCE** | Doküman işi; code fix değil. | P1 | Ürün dili canonical referans olarak kalmalı; implementation bu dilden sapmamalı. |
| F8 Planlı çekici sync | **KEEP as PRODUCT REFERENCE** | Canonical anlatı planlı çekiciyi payment-window dispatch olarak netleştirmiş. Worker da bu yönde var. | P0/P1 | Planlı çekici ürün kararı net: havuz/teklif yok. Scheduled tow smoke ve backend guard ile doğrulanmalı. |
| F9 Acil çekici smoke | **KEEP** | Uçtan uca kritik. | P1 | Payment/preauth/dispatch/capture smoke. |
| F10 Hasar smoke | **KEEP but tighten** | Hasar havuz/teklif/randevu zinciri omurga için kritik. | P1 | "Offer olmadan randevu yok" assert'i ekle. |
| F11 Bakım + arıza smoke | **KEEP** | F4 ile bağlantılı. | P1 | Case create + pool + offer + appointment smoke. |
| F12 Pool feed smoke | **KEEP + attach F6** | F6'nın kabul testi. | P0/P1 | CEKICI feed immediate tow görmemeli. |
| F13 Kapsam onayı smoke | **KEEP** | F2'nin UX doğrulaması. | P1 | UI'da "ek ödeme" yok, gerekçe görünür. |
| F14 Case status vs tow stage drift | **PROMOTE TO PRODUCT GUARD** | `ServiceCase.status` genel state, `tow_stage` operasyon state'i. Bunlar karışırsa çekici pool/matching davranışı bozulur. | P1 | Tüm customer/service tow ekranlarında `tow_stage` authoritative kabul edilmeli; `case.status` sadece genel shell state olmalı. |
| F15 request_draft source-of-truth | **PROMOTE TO PRODUCT GUARD** | `request_draft` audit snapshot olarak yazılmış. Kritik kararlar subtype/payment/appointment/offer tablolarından okunmalı. | P1 | Karar alanları için source-of-truth listesi çıkar; payment, dispatch, appointment ve matching `request_draft`tan karar vermemeli. |
| F16 Insurance ownership | **KEEP AS DOMAIN LINK** | Sigorta dosyası hasar vakasının yerine geçmez; hasar vakasına bağlı alt süreçtir. | P2 | Hasar omurgasında `insurance_claim` ilişki ve ownership kuralları açık tutulmalı; ikincil değil, hasar domain'inin parçası. |
| F17 Public showcase consent | **KEEP AS SEPARATE TRUST MODULE** | Completion sonrası güven sinyali üretir; case creation/matching omurgasını bozmaz. | P3 | Showcase ayrı güven/profil modülü olarak kalır; vaka omurgası fix'inin P0/P1'ini şişirmez. |
| F18 Pattern source-of-truth | **PROMOTE TO PRODUCT BACKBONE** | Vaka süreci eşleşme sonrası başlar; süreç adımları iki app'te aynı mantığı göstermeli. | P1 | Backend task tabloları mı tracking engine mi authoritative karar ver. Birini canonical seç, diğerini türet/compat yap. |
| F19 Step-up auth | **MOVE TO RELEASE GATE** | Payment account, IBAN, payout, submerchant gibi alanlar gerçek paraya dokunur. | P2 | Vaka omurgası değil ama prod ödeme release gate'i; ayrı security checklist'te kalmalı. |
| F20 Notification channels | **PROMOTE FOR F5** | "Ustaya vaka bildir" notification/inbox olmadan ürün olarak çalışmaz. | P1 | En az service app inbox + push/poll fallback gerekir; genel notification altyapısı ayrı genişletilebilir. |
| M13 Composer akış refactor'u | **ADD TO PRODUCT BACKBONE** | `BreakdownFlow` araç durumunda çekiciyi ara adımda işaretliyor; review'da "randevu onayında otomatik açılır" diyor. `MaintenanceFlow` çekici ihtiyacını hiç karar noktası yapmıyor. | P1 | Kaza istisna kalır. Arıza/bakımda çekici son karar olur; evet ise doğrudan çekici çağırma ekranına yönlenir. |
| M14 Süreç yönetimi pattern refactor'u | **ADD TO PRODUCT BACKBONE** | Backend `case_milestones/case_tasks`, mobil tracking engine ve örnek akışlar aynı source-of-truth'ta birleşmemiş. Bazı süreç adımları örnek/fixture gibi kalabilir. | P1 | Eşleşme sonrası süreç pattern'ları net tasarlanır: minimal standard adımlar + tür özel opsiyonel adımlar + approval gate'leri. |
| M15 Backend aggregate/ilişki invariant'ları | **ADD TO PRODUCT BACKBONE** | `service_cases` shell + subtype tabloları var; exact-one subtype DB seviyesinde garanti değil. `appointments.offer_id` nullable ve `DIRECT_REQUEST` hâlâ modelde. `PaymentOrder.subject_id` polymorphic ve `CaseApproval.payment_order_id` optional; ilişki guard'ları service/test seviyesinde netleşmeli. | P1 | ServiceCase aggregate sınırı, exact-one subtype, offer→appointment→assignment, approval→payment ve tow parent-child invariant'ları yazılıp testlenir. |
| M16 Vaka profili canonical dossier | **ADD TO PRODUCT BACKBONE** | Customer `CustomerCaseProfileScreen` canlı `vehicle_snapshot/subtype` kartlarını ekliyor ama `CaseInspectionView` hâlâ request/draft kompozisyonuyla karışık. Service `CaseProfileScreen` pool detail üstünden aynı inspection yüzeyini kullanıyor. | P1 | Vaka profili iki app'te aynı dossier standardına döner: oluşturma detayları eksiksiz, teklif/süreç aksiyonları ayrı ve aşağıda, source-of-truth subtype/detail response. |
| M17 Case-technician match read-model | **ADD TO PRODUCT BACKBONE** | Mevcut `KIND_PROVIDER_MAP` yalnız provider_type filtresi. `technician_service_domains`, `technician_procedures`, `brand_coverage`, `service_area` var; ama vaka bazlı uyumlu usta kaydı yok. `CaseOffer` sadece teklif verenleri tutuyor; `CaseNotificationIntent` delivery intent, match kaydı değil. | P1 | `case_technician_matches` benzeri tablo/read-model eklenir: case açılınca uyumlu adaylar, score, reason, visibility ve notify/offer state kaydedilir. Customer ve service pool bu kaydı kullanır. |
| M18 Home matched technicians bandı | **ADD TO PRODUCT BACKBONE** | `HomeSummary.suggestions` tipi var ama `useHomeSummary` şu an `suggestions: []` dönüyor. `TechnicianSuggestionCard` ve mock `useTechnicianMatches` var; canlı home yüzeyinden kopmuş. | P1 | Ana sayfa aktif vaka varsa match read-model'den gelen 3-5 uygun ustayı üstte gösterir. Bu band keşif serpiştirmesi değil, vaka aksiyonunun ana kapısıdır. |
| M19 Vaka servisi tek contract | **ADD TO PRODUCT BACKBONE** | Backend canonical case, customer app canonical case adapter, service app live jobs/pool adapter ve home suggestions farklı katmanlarda aynı vakayı yorumluyor. `request_draft`, mock suggestions, direct appointment route'u ve pool filter drift'i contract eksikliğinin semptomları. | P1 | `case service contract` dokümante edilir ve uygulanır: shell, subtype, match, offer, appointment, tow stage, payment, process, approval ve dossier alanları tek sözleşmeden türetilir; backend/customer/service app testleri bunu kırmaya çalışır. |
| M20 Vaka altı composer UX contract | **ADD TO PRODUCT BACKBONE** | Hızlı menü akışları sadece payload üretmiyor; kullanıcının olayı hatırlayıp anlatmasını sağlıyor. Mevcut gözlem: bazı adımlar açıklamayı erken isteyebilir, çekici kararını yanlış ara adım yapabilir veya review'da yeni karar/promise çıkarabilir. | P1 | Maintenance/breakdown/accident/towing composer'ları basitten zora, somuttan soyuta, seçimden açıklamaya ilerleyen typed UX contract'a bağlanır. Hasar olayı hatırlatarak ilerler; arıza teknik terim dayatmaz; bakım niyet/kategoriyle başlar; çekici bakım/arıza için son karar ve ayrı handoff olur. |

---

## Kritik Kod Kanıtları

### Direct appointment drift

- [appointments.py](../../naro-backend/app/api/v1/routes/appointments.py) `create_direct_request` endpoint'i "offer'sız" randevu olarak tanımlı ve `payload.offer_id` opsiyonel şekilde repo'ya geçiyor.
- [appointments/schemas.ts](../../naro-app/src/features/appointments/schemas.ts) yorumunda FE'nin `offer_id`, `expires_at`, `source` göndermediği açıkça yazıyor.
- [RandevuRequestScreen.tsx](../../naro-app/src/features/cases/screens/RandevuRequestScreen.tsx) `offerId` route parametresini okuyor ama submit payload'una koymuyor; offer yoksa fiyat/süre/garanti "Usta belirleyecek" oluyor.
- [technician-cta.ts](../../naro-app/src/features/ustalar/technician-cta.ts) aktif uyumlu vaka varsa doğrudan `/randevu/{technicianId}?caseId={activeCase.id}` route'u üretiyor; offer yok.
- [CaseComposerScreen.tsx](../../naro-app/src/features/cases/screens/CaseComposerScreen.tsx) preferred technician + fast track durumunda yeni oluşturulan vakayı doğrudan randevu ekranına taşıyabiliyor.
- [CaseOffersScreen.tsx](../../naro-app/src/features/cases/screens/CaseOffersScreen.tsx) offer kartından doğru şekilde `offerId` ile randevu ekranına gidiyor; ancak randevu submit'i bu `offerId`yi payload'a taşımadığı için bağ kopuyor.

Sonuç: F1'in backend tarafı doğru ama eksik; customer app route/CTA/contract düzelmeden omurga düzelmez.

### Kapsam/fatura onayı drift

- [approvals.py](../../naro-backend/app/api/v1/routes/approvals.py) `description` alanını optional tutuyor.
- Aynı route parts/invoice için online, serviste kart ve nakit yöntemlerini döndürüyor; bu model kalmalı.
- [case_billing.py](../../naro-backend/app/services/case_billing.py) legacy `additional_amount` ve `ADDITIONAL_*` state dili taşıyor.
- [BillingStateBadge.tsx](../../packages/ui/src/billing/BillingStateBadge.tsx) "Ek tutar isteniyor/tutuldu" copy'si taşıyor.
- [PartsApprovalSheet.tsx](../../naro-app/src/features/billing/components/PartsApprovalSheet.tsx) başlığı hâlâ "Ek parça onayı"; müşteri tarafı da kapsam diline taşınmalı.

Sonuç: F2 "ek ödeme kaldır" diye değil, "sürpriz ek ödeme dilini kaldır; approval'ı kapsam/fatura onayına çevir" diye uygulanmalı.

### Blueprint seed drift

- [case_create.py](../../naro-backend/app/services/case_create.py) breakdown ve towing için ayrı blueprint enum'u çözüyor.
- [workflow_seed.py](../../naro-backend/app/services/workflow_seed.py) template sözlüğü damage/maintenance ile sınırlı.
- `seed_blueprint` çağrısı app/test grep'inde bulunmadı; dosya yorumu çağrı var diyor ama uygulama kodu bunu doğrulamıyor.

Sonuç: F4 gerçek drift; ama "case create kesin crash" iddiası güncel kod okumasıyla kanıtlanmadı.

### Immediate tow pool leak riski

- [case_create.py](../../naro-backend/app/services/case_create.py) yeni case'i `ServiceCaseStatus.MATCHING` ile yaratıyor.
- [repositories/case.py](../../naro-backend/app/repositories/case.py) pool görünür statüleri `MATCHING` ve `OFFERS_READY`.
- Aynı repository `list_pool_cases` içinde tow subtype veya `tow_mode` filtresi yok.
- [pool_matching.py](../../naro-backend/app/services/pool_matching.py) `TOWING` kind'ını `CEKICI` provider'a açıyor.

Sonuç: Immediate tow pool sızıntısı ciddi bir ürün omurgası ihlalidir; test/fix gerektirir.

### Scheduled tow payment-window mevcut yön

- [workers/tow/scheduled_payments.py](../../naro-backend/app/workers/tow/scheduled_payments.py) scheduled tow için payment window açıyor ve zamanı gelince dispatch başlatıyor.
- [payment_core.py](../../naro-backend/app/services/payment_core.py) scheduled tow preauth success olduğunda zamanı gelmediyse `SCHEDULED_WAITING`, zamanı geldiyse `SEARCHING` hedefliyor.

Sonuç: Planlı çekici artık havuz/teklif modeline geri çekilmemeli. Revize fix haritası bu kararı korumalı.

### Customer app etki alanı

- [CaseOffersScreen.tsx](../../naro-app/src/features/cases/screens/CaseOffersScreen.tsx) teklif seçimini doğru başlatıyor: route `offerId` içeriyor. Eksik, randevu submit'inde `offerId`nin korunması.
- [RandevuRequestScreen.tsx](../../naro-app/src/features/cases/screens/RandevuRequestScreen.tsx) offer yokken "Usta belirleyecek" gösterip submit açabiliyor; bu canonical omurgaya aykırı.
- [technician-cta.ts](../../naro-app/src/features/ustalar/technician-cta.ts) "Randevu al" CTA'sını offer'sız active case için üretiyor; bu "Ustaya vaka bildir" kararını by-pass ediyor.
- [TechnicianCaseEntryScreen.tsx](../../naro-app/src/features/ustalar/screens/TechnicianCaseEntryScreen.tsx) "vaka bu servis önceliğiyle açılır" diyor, fakat gerçek notification/offer akışı yoksa kullanıcıyı direct appointment drift'ine taşıyabilir.
- [CaseComposerScreen.tsx](../../naro-app/src/features/cases/screens/CaseComposerScreen.tsx) preferred technician fast-track copy'si "sonraki adımda randevuya geçersin" diyor; bu "vaka bildir/teklif bekle" kararına göre revize edilmeli.
- [BreakdownFlow.tsx](../../naro-app/src/features/cases/composer/BreakdownFlow.tsx) araç durumu adımında `vehicle_drivable=false` seçilince `towing_required=true` yazıyor ve review'da "randevu onayında çekici otomatik açılır" dili kullanıyor. Ürün kararı bu değil: çekici istenirse son kararda ayrı çekici çağırma ekranına geçilir.
- [MaintenanceFlow.tsx](../../naro-app/src/features/cases/composer/MaintenanceFlow.tsx) bakım için çekici kararını hiç sormuyor; bakımda nadir ama mümkün olan taşıma ihtiyacı son karar olarak sorulmalı, ara adımları boğmamalı.
- [AccidentFlow.tsx](../../naro-app/src/features/cases/composer/AccidentFlow.tsx) güvenlik panelinde çekici CTA'sını ilk adımda sunuyor; kaza için bu istisna doğru. Diğer akışlara kopyalanmamalı.
- [PartsApprovalSheet.tsx](../../naro-app/src/features/billing/components/PartsApprovalSheet.tsx) müşteri tarafında ödeme seçimi iyi yönde; ancak başlık/copy "Ek parça" yerine "Kapsam Onayı" olmalı ve açıklama/gerekçe görünürlüğü zorunlu kabul edilmeli.
- [tow/entry.ts](../../naro-app/src/features/tow/entry.ts) aktif çekici vakası varsa entrypoint'i mevcut vakaya yönlendiriyor; bu iyi. Tow payment/tracking smoke yine P1'de tutulmalı.

Sonuç: Customer app P0/P1 yüzeyi yalnız randevu ekranı değil; usta kartı/profile CTA, composer fast-track, offer accept, composer soru sırası, tow handoff ve approval sheet birlikte düzeltilmeli.

### Service app etki alanı

- [PoolScreen.tsx](../../naro-service-app/src/features/pool/screens/PoolScreen.tsx) canlı `useCasePoolLive` feed'ini kullanıyor; bu yüzden F6 backend fix'i doğrudan servis app havuz yüzeyini temizler.
- [OfferSubmissionSheet.tsx](../../naro-service-app/src/features/pool/components/OfferSubmissionSheet.tsx) canlı `useSubmitOfferLive` ile teklif gönderiyor ve ödeme hesabı zorunluluğu hatasını kullanıcıya çeviriyor. Bu iyi; fakat çekici teklifi UI'ı V1 scheduled dispatch kararına aykırı kalmamalı.
- [AppointmentRequestDetailScreen.tsx](../../naro-service-app/src/features/appointments/screens/AppointmentRequestDetailScreen.tsx) randevu talebindeki linked offer'ı gösteriyor; fakat offer'sız randevu geldiyse servis tarafında özel uyarı/blok yok. Backend P0 gate sonrası yeni offer'sız randevu oluşmamalı, ama legacy/pending kayıt için servis app güvenli davranmalı.
- [JobTaskScreen.tsx](../../naro-service-app/src/features/jobs/screens/JobTaskScreen.tsx) parça/fatura talebinde "müşteri online, serviste kart veya nakit seçebilir" dilini taşıyor; bu doğru. Eksik olan şey `partsNote` / `invoiceNote` alanlarının ürün kararı gereği "gerekçe/kapsam açıklaması" olarak zorunlu hale gelmesi.

Sonuç: Service app bu fixin merkezi parçasıdır; sadece backend/customer app fix'iyle omurga tam kapanmaz.

### Backend model/relationship etki alanı

- [case.py](../../naro-backend/app/models/case.py) `ServiceCase` shell modeli omurgaya uygun bir üst sınıf gibi çalışıyor: araç, kullanıcı, tür, genel status ve assignment burada. Ancak subtype eşleşmesi DB tarafından garanti edilmiyor; `service_cases.kind=towing` ise tam bir `tow_case` satırı var mı, başka subtype satırı yok mu gibi invariantlar yalnız create servislerine kalmış.
- [case_subtypes.py](../../naro-backend/app/models/case_subtypes.py) dört subtype tablo iyi bir yön; fakat `TowCase.parent_case_id` dışında bakım/arıza/hasar/çekici arasında üst-alt vaka ilişkisini açık modelleyen bir `case_links` benzeri tablo yok. Arıza/hasar içinden çekici doğarsa ilişki sadece tow tarafında tek yönde okunuyor.
- [appointment.py](../../naro-backend/app/models/appointment.py) `AppointmentSource.DIRECT_REQUEST` ve nullable `offer_id` hâlâ modelin doğal parçası. Bu, "bakım/arıza/hasar teklif olmadan randevuya dönmez" kuralıyla çelişiyor.
- [appointment_flow.py](../../naro-backend/app/services/appointment_flow.py) randevu onayında `offer_id` guard'ı yoksa offer'sız appointment `scheduled + assigned` hale gelebilir. Backend gate yalnız create endpoint'te kalırsa legacy/pending kayıtlar hâlâ omurgayı delebilir.
- [case_lifecycle.py](../../naro-backend/app/services/case_lifecycle.py) `MATCHING/OFFERS_READY -> APPOINTMENT_PENDING` geçişini genel olarak açıyor. Bu geçiş offer acceptance gibi kontrollü bir domain event'e bağlanmadığı sürece direct appointment drift'ini model düzeyinde meşrulaştırıyor.
- [offer.py](../../naro-backend/app/models/offer.py) `CaseOfferKind.TOW_SCHEDULED` içeriyor; [offers.py](../../naro-backend/app/api/v1/routes/offers.py) `ServiceRequestKind.TOWING` için offer cap tanımlıyor. Bu, planlı çekici için eski havuz/teklif modelinin backend'de hâlâ canlı kalabileceğini gösteriyor.
- [tow_lifecycle.py](../../naro-backend/app/services/tow_lifecycle.py) `BIDDING_OPEN`, `OFFER_ACCEPTED`, `TIMEOUT_CONVERTED_TO_POOL` state'leri taşıyor. Ürün kararı scheduled payment-window + dispatch ise bu state'ler ya kapatılmalı ya açıkça `ayrı_mod / compat` olarak izole edilmeli.
- [offer_acceptance.py](../../naro-backend/app/services/offer_acceptance.py) non-firm teklif kabulünde de `ServiceCase.assigned_technician_id` set ediyor. Ürün omurgasında eşleşme/atama randevu onayıyla kesinleşiyorsa burada ayrı bir `accepted_offer_id` / `selected_technician_id` gerekir; yoksa `assigned_technician_id` "seçili ama henüz kesinleşmemiş usta" anlamına kayıyor.
- [case_process.py](../../naro-backend/app/models/case_process.py) yorumları workflow seed'i create sırasında authoritative gibi anlatıyor; [workflow_seed.py](../../naro-backend/app/services/workflow_seed.py) ise breakdown/towing template'i taşımıyor ve `seed_blueprint` çağrısı uygulama kodunda görünmüyor. Backend süreç tabloları ile mobil tracking engine source-of-truth'u net ayrılmalı.
- [payment.py](../../naro-backend/app/models/payment.py) `PaymentOrder.subject_id` polymorphic UUID olarak doğru esnekliği sağlıyor; fakat FK ile garanti edilemediği için `tow_case`, `case_approval`, `campaign_purchase` integrity servis/test seviyesinde zorunlu hale getirilmeli.

Sonuç: Backend düzeltmesi sadece "route şu hatayı dönsün" seviyesinde kalmamalı. Appointment-offer-case ilişkisi, çekici offer kalıntıları ve assignment semantiği model düzeyinde netleştirilmezse frontend düzeltmeleri tekrar drift üretebilir.

---

## Eksik Maddeler

### M1 — Appointment FE contract drift

Mevcut harita F1'de backend endpoint'e odaklanıyor; ama FE schema bizzat `offer_id` göndermemeyi canonical kabul etmiş. Bu ayrı bir fix maddesi olmalı.

**Aksiyon:** `AppointmentRequestPayloadSchema` offer-based akışla uyumlu hale getirilecek veya offer kabulü için farklı endpoint kullanılacak.

### M2 — Legacy billing vs Payment Core ayrımı

Yeni Payment Core approval ödeme akışı ile eski `case_billing.ADDITIONAL_*` dili aynı anda yaşıyor. Bu hem kavram hem teknik borç.

**Aksiyon:** UI copy temizliği ve aktif billing source-of-truth kararı aynı ürün omurgası işidir. Legacy `case_billing.ADDITIONAL_*` dili ya compat olarak izole edilmeli ya Payment Core approval diline taşınmalı.

### M3 — Workflow seed comment/code mismatch

`workflow_seed.py` yorumunda create sonrası seed çağrısı yazıyor, ama çağrı bulunmuyor.

**Aksiyon:** Ya comment düzeltilir ya seed gerçekten create flow'a bağlanır. Bağlanacaksa eksik blueprint template'leri önce tamamlanır.

### M4 — Smoke veri önkoşulları

Fix haritasında smoke senaryoları var ama seed data/precondition yok.

**Aksiyon:** Ürün omurgası smoke'u için en az:

- 1 customer + 1 araç
- 1 usta provider + approved payment account
- 1 çekici provider + approved payment account + online availability
- maintenance/breakdown/accident için teklif atabilen servis
- tow pickup/dropoff test koordinatları
- sandbox PSP success/fail kartları veya mock provider netliği

### M5 — "Ustaya vaka bildir" notification drift riski

Bu feature doğrudan matching sistemi olmalı; paralel mini-chat/bildirim sistemi olmamalı.

**Aksiyon:** "Ustaya vaka bildir" ürün akışında bildirim, servis tarafında "teklif ver / reddet" CTA'sına bağlanır; randevu veya chat açmaz. Minimal ürün karşılığı backend intent + service inbox/poll + customer state olmalıdır.

### M6 — Service app offer/appointment/kapsam yüzeyleri

Mevcut revize harita servis uygulamasını ayrı bir uygulama yüzeyi olarak yeterince açık yazmıyordu.

**Aksiyon:** P0/P1 implementation brief'inde şu servis app alanları açıkça yer almalı:

- Havuz feed'de immediate/scheduled dispatch çekici sızıntısı yok.
- Offer sheet yalnız havuz/teklif modelindeki vakalarda açılır.
- Appointment detail offer'sız legacy/pending randevuyu onaylatmaz; net hata veya "teklif gerekli" mesajı verir.
- Parts/invoice task formlarında gerekçe zorunlu ve "kapsam/fatura onayı" diliyle gösterilir.
- Ödeme hesabı eksikse teklif/randevu/çekici online blokları kullanıcıyı ayarlardaki ödeme hesabı kartına yönlendirir.

### M7 — Customer app CTA/route drift

Customer app'te offer'sız randevuya götüren birden fazla yol var. Bunlar F1'in alt işi olarak açıkça yazılmalı.

**Aksiyon:** P0/P1 implementation brief'inde şu müşteri app alanları açıkça yer almalı:

- Offer listesi randevuya geçerken `offerId` korunur ve appointment payload'una taşınır.
- Usta profil/preview CTA'sı offer'sız "Randevu al" üretmez; aktif vaka varsa "Vakayı bildir / Teklif iste" modeline döner.
- Preferred technician ile case create sonrası doğrudan randevuya geçme kaldırılır.
- Randevu ekranı offer yoksa submit açmaz; açıklayıcı fallback gösterir.
- Parts/invoice approval sheet "Ek parça" değil "Kapsam Onayı" dilini kullanır.
- Aktif çekici entrypoint koruması tüm hızlı menü/home/search yollarında smoke edilir.

### M8 — Backend appointment ilişki drift'i

`Appointment.offer_id` nullable, `AppointmentSource.DIRECT_REQUEST` geçerli ve lifecycle `APPOINTMENT_PENDING` state'ini offer kanıtı olmadan taşıyabiliyor.

**Aksiyon:** `direct_request` aktif ürün akışından çıkarılır. Randevu approve akışında offer'sız bakım/arıza/hasar appointment onaylanamaz. DB migration ile hemen `offer_id NOT NULL` yapmak legacy data yüzünden riskliyse önce service-level guard + typed error, sonra DB constraint/migration planlanır.

### M9 — Backend çekici offer/pool kalıntısı

`CaseOfferKind.TOW_SCHEDULED`, `ServiceRequestKind.TOWING` offer cap'i ve tow lifecycle `BIDDING_OPEN/OFFER_ACCEPTED/TIMEOUT_CONVERTED_TO_POOL` state'leri planlı çekiciyi eski havuz/teklif modeline geri çekebilir.

**Aksiyon:** Dispatch ailesindeki tüm towing case'ler offer submit/list/detail yüzeylerinden dışlanır. Bu state/enumlar silinmeyecekse `deprecated/ayrı_mod` olarak izole edilir ve aktif endpoint guard'larıyla erişilemez hale getirilir.

### M10 — Assignment semantiği belirsiz

`assigned_technician_id` non-firm offer kabulünde randevu onayından önce set ediliyor. Bu, "vaka süreci eşleşme sonrası başlar" kuralında belirsizlik yaratır.

**Aksiyon:** İki seçenekten biri seçilmeli:

- Sıkı omurga: `assigned_technician_id` yalnız randevu onayında set edilir; offer kabulü `accepted_offer_id` / `selected_technician_id` gibi ayrı alanla temsil edilir.
- Pragmatik geçiş: `assigned_technician_id` "seçili usta" anlamına da gelir diye dokümante edilir; tracking/process ekranları `case.status >= scheduled` olmadan bunu gerçek assignment saymaz.

### M11 — Subtype integrity ve üst-alt vaka ilişkileri

ServiceCase shell + dört subtype iyi model; fakat DB exact-one subtype invariant'ını garanti etmiyor. Ayrıca parent/child ilişki sadece tow tarafında `parent_case_id` ile tek yönlü.

**Aksiyon:** İlk ürün omurgası için create-service integrity testleri zorunlu: her kind kendi subtype'ını oluşturur, yanlış subtype oluşmaz, araç snapshot'ı doludur. `case_links` veya typed related-case tablosu ayrıca tasarlanmalıdır; özellikle hasar/arıza içinden çekici çağırma ve sigorta dosyası ilişkileri için.

### M12 — Process source-of-truth belirsizliği

Backend `case_milestones/case_tasks` tabloları var ama seed çağrısı aktif görünmüyor; service app aktif iş UI'ı ise canonical case + event/approval/document verisinden task türetiyor.

**Aksiyon:** Ürün kararı verilmelidir: "tracking engine türetilmiş görevler source-of-truth" ise backend task tabloları pasif/opsiyonel kalır ve yorumlar düzeltilir. Backend seed canonical olacaksa breakdown/towing template'leri eklenmeden aktive edilmez.

### M13 — Composer soru sırası ve çekici handoff drift'i

Kaza için çekici ilk adımda sorulabilir; çünkü güvenlik ve aracın yerinden kaldırılması olayın ilk kararıdır. Bakım ve arıza için çekici ara adım olmamalıdır. Bu iki akışta kullanıcı önce vaka ihtiyacını anlatmalı, sonra son kararda "Çekici de istiyor musun?" sorusuyla ayrı çekici çağırma ekranına yönlenmelidir.

**Aksiyon:** `BreakdownFlow` içindeki ara `towing_required` davranışı ve "randevu onayında otomatik çekici açılır" dili kaldırılır. `MaintenanceFlow` son karar ekranına çekici isteği eklenir. Evet seçilirse:

- Önce bakım/arıza parent case oluşturulur veya mevcut case id alınır.
- Sonra `/(modal)/talep/towing?parentCaseId={caseId}` rotasına gidilir.
- Çekici çağrı ekranı kendi ödeme/dispatch akışını yürütür.
- Parent case detail/management ekranı linked tow case'i gösterir.

### M14 — Süreç yönetimi pattern refactor ihtiyacı

Halihazırdaki örnek süreç akışları, backend task tabloları ve mobile tracking engine birlikte büyümüş görünüyor. Bu alanda küçük patch değil, nispeten cesur ama kontrollü bir ürün refactor'u gerekir.

**Aksiyon:** Vaka süreci için canonical pattern katmanı tanımlanmalı:

- Süreç yalnız eşleşme kesinleşince başlar.
- Her süreçte minimal ortak omurga vardır: teslim/başlangıç, iş sürüyor, kapsam/fatura onayı gerekiyorsa approval, teslim/kapanış.
- Bakım/arıza/hasar kendi opsiyonel adımlarını ekler.
- Çekici bu pattern'e değil, `tow_stage` lifecycle'a bağlıdır.
- UI task listesi ile backend process tabloları aynı canonical pattern'den türemelidir; biri örnek/fixture olarak kalmamalıdır.

### M15 — Backend aggregate ve ilişki invariant'ları

Mevcut backend "canonical case" yönüne gitmiş; `service_cases` ortak shell, `tow_case/accident_case/breakdown_case/maintenance_case` subtype tabloları ise doğru ana hat. Fakat bu model ürün omurgasını tek başına garanti etmiyor. Kritik ilişki kuralları hâlâ route/service guard ve test seviyesinde netleşmeli.

**Aksiyon:** Backend için ayrı bir aggregate invariant listesi uygulanmalıdır:

- Her `ServiceCase.kind` için tam olarak bir ilgili subtype satırı vardır; yanlış subtype yoktur.
- `vehicle_id` ve immutable vehicle snapshot her subtype için doludur; araç değişince eski vaka snapshot'ı değişmez.
- `preferred_technician_id` müşteri niyetidir; eşleşmiş süreç anlamına gelmez.
- `accepted_offer_id` / `selected_offer_id` benzeri alan yoksa `assigned_technician_id` erken set edildiğinde UI bunu "iş başladı" diye okuyamaz.
- Bakım/arıza/hasar için appointment ancak kabul edilmiş offer üzerinden oluşur; `DIRECT_REQUEST` aktif ürün akışında kullanılmaz.
- `CaseApproval` yalnız eşleşmiş/atanmış süreç içinde açılır; parts/invoice approval ödeme veya offline kayıtla kapanır.
- `PaymentOrder.subject_type/subject_id` polymorphic olduğu için subject-specific service guard ve test olmadan DB tek başına bütünlüğü garanti etmez.
- Tow parent-child ilişkisi `TowCase.parent_case_id` ile çalışır; arıza/bakım/hasar içinden çağrılan çekici parent case'e bağlanır ve parent iptali/case detail bunu tutarlı gösterir.
- Sigorta dosyası hasar vakasının yerine geçmez; hasar vakasına bağlı alt domain olarak yaşar.

### M16 — Vaka profili canonical dossier standardı

Vaka profili, kullanıcının veya servisin "bu vaka nedir?" sorusuna tek bakışta cevap verdiği dosyadır. Süreç takip ekranı, teklif listesi veya randevu ekranı değildir; onları bağlayan okunabilir ana yüzeydir.

**Kod gerçekliği:** Customer app `CustomerCaseProfileScreen` canlı `vehicle_snapshot` ve `subtype` kartlarını üstte göstermeye başlamış; bu doğru yön. Ancak aynı ekranda `CaseInspectionView` hâlâ `caseItem.request` / draft-derived alanlar ve genel kart registry'siyle devam ediyor. Service app `CaseProfileScreen` ise pool detail üzerinden aynı inspection yüzeyini kullanıyor; servis için teklif CTA'sı doğru ama profil/dosya standardı net değil.

**Aksiyon:** Vaka profili için iki app'te ortak dossier standardı kurulmalı:

- Üstte yalnız vaka kimliği: tür, durum, araç, lokasyon/zaman ve kısa özet.
- Ardından oluştururken girilen tüm kind-specific detaylar eksiksiz: bakım kategorisi/detayları, arıza semptomları ve sürülebilirlik, hasar alanı/şiddeti/tutanak/sigorta, çekici pickup/dropoff/mode.
- Araç bilgisi canlı vehicle lookup değil, case create anındaki immutable `vehicle_snapshot` üzerinden okunur.
- Kanıtlar/medya/evraklar vaka dosyasının parçasıdır; teklif kartlarının arasında kaybolmaz.
- Bağlı alt süreçler görünür: linked tow case, insurance claim, public showcase adaylığı gibi.
- Teklifler profilin altında ayrı optimize bir bölüm olur: teklif yoksa "teklif bekleniyor / vakayı bildir"; teklif varsa karşılaştırma; kabul edilmiş teklif varsa kilitli özet.
- Eşleşme sonrası profil read-only dosya gibi kalır; süreç aksiyonu ayrı "Süreç takibi" yüzeyine gider.
- Service app aynı dosyayı PII-safe ve teknisyen rolüne uygun görür; müşteri özel notu gibi owner-private alanlar sızmaz.

### M17 — Case-technician match read-model ihtiyacı

Sistem "bu vaka şu ustalara uygun" bilgisini şu anda kalıcı bir domain nesnesi olarak tutmuyor. Mevcut yapı üç ayrı parçaya dağılmış durumda:

- `CaseOffer`: sadece teklif gönderen ustayı kaydeder.
- `/pool/feed`: dinamik ve kaba bir filtreyle `KIND_PROVIDER_MAP + status + assigned` üzerinden vaka gösterir.
- `technician_service_domains`, `technician_procedures`, `technician_brand_coverage`, `technician_service_area`: usta sinyallerini tutar ama bunların belirli bir vaka için hesaplanmış sonucunu kaydetmez.
- `CaseNotificationIntent`: haber verme kuyruğudur; "bu usta bu vakaya uyumlu bulundu" kaydı değildir.

**Ürün kararı:** Vaka açıldığında veya güncellendiğinde sistem uygun ustaları hesaplamalı ve bunu `case_technician_matches` benzeri kalıcı bir read-model'e yazmalıdır. Bu kayıt teklif değildir; teklif öncesi uygunluk ve görünürlük katmanıdır.

Bu katman ileride Naro'nun ana değer üretim noktalarından biri olacak: binlerce dükkan ve on binlerce müşteri içinde "hangi vaka hangi ustaya daha uygun?" sorusunu yönetir. V1'de Instagram benzeri karmaşık ranking ya da opak algoritma hedeflenmez; sade, açıklanabilir ve iyi soyutlanmış bir matching modeli hedeflenir.

Önerilen alanlar:

- `case_id`
- `technician_profile_id` / `technician_user_id`
- `match_score`
- `match_reasons`: provider, domain, procedure, brand, city/radius, availability, verified level, previous performance gibi kısa açıklanabilir sinyaller
- `match_label`: müşteri ve servis app'te gösterilecek kısa etiket; örn. `Bu vakaya uygun`, `Yakın ve uygun`, `Marka deneyimi var`
- `match_badge_tone`: UI rozeti/çerçevesi için `recommended | strong | neutral` gibi sade ton
- `visibility_state`: `candidate | shown_to_customer | notified_technician | hidden | expired`
- `offer_id`: usta teklif verdiyse bağlanır, yoksa null
- `customer_notified_at`, `technician_notified_at`, `viewed_by_technician_at`
- `source_version` / `match_version`: algoritma değişince hangi versiyonla hesaplandığı bilinir

Bu katmanın beslediği yüzeyler:

- Customer app vaka profilinde ve usta keşfinde "bu vakan için uygun ustalar" üst sırada görünür.
- Customer app usta kartında bu kayıt varsa görünür bir sinyal çıkar: rozet, vurgu çerçevesi veya "Bu vakaya uygun" etiketi. Bu sinyal reklama/boost'a değil, match kaydına dayanır.
- Müşteri, uyumlu ustaya "Vakayı bildir / Teklif iste" gönderebilir.
- Service app havuz feed'i artık yalnız `provider_type` filtresiyle değil, bu vaka-usta match kaydıyla sıralanır/gösterilir.
- Offer submit edildiğinde `case_technician_matches.offer_id` bağlanır; offer yokken bile uygunluk kaydı yaşamaya devam eder.

**Kabul:** Uyumlu usta kaydı teklif değildir, assignment değildir, notification değildir. Bunların üstünde duran matching read-model'dir.

**V1 algoritma sınırı:** İlk sürüm deterministic ve açıklanabilir kalır. Minimum sinyaller: case kind ↔ provider/domain uyumu, şehir/servis alanı, bakım/arıza/hasar alt kategori uyumu, marka/procedure coverage, availability. Puan kusursuz olmak zorunda değildir; ancak neden gösterilebilir olmalıdır. Müşteri "neden bu usta üstte?" sorusuna kısa bir cevap görmelidir.

### M18 — Home matched technicians bandı

Müşteri için en değerli yüzeylerden biri ana sayfadır. Uyumlu usta bilgisini yalnız keşif feed'ine serpiştirmek yeterli değildir; aktif vaka varsa kullanıcı uygulamayı açtığında doğrudan "Bu vakan için uygun ustalar" bandını görmelidir.

**Kod gerçekliği:** `HomeSummary` tipinde `suggestions: TechnicianMatch[]` alanı var; `TechnicianSuggestionCard` component'i var; `useTechnicianMatches` mock veriyle geçmişte bu hissi veriyordu. Ancak `useHomeSummary` şu an `suggestions: []` döndürüyor ve HomeScreen sadece header + feed gösteriyor. Yani ürün yüzeyi var ama canlı vaka/match read-model'e bağlı değil.

**Aksiyon:**

- Ana sayfada aktif bakım/arıza/hasar vakası varsa üst bölgede 3-5 "Bu vakan için uygun ustalar" kartı gösterilir.
- Kartlar `case_technician_matches` read-model'den beslenir; mock `DEFAULT_VEHICLE_ID` veya fixture kullanılmaz.
- Kartta match rozeti/çerçevesi ve kısa reason görünür.
- CTA "Vakayı bildir / Teklif iste" olur; offer'sız randevuya götürmez.
- Teklif gelirse aynı band "Teklif verenler / uygun ustalar" ayrımını korur.
- Aktif vaka yoksa bu band görünmez; keşif/çarsi genel feed'i ayrı kalır.

**Kabul:** Home bandı kozmetik öneri alanı değildir. Aktif vaka ile uyumlu ustayı müşteriye en kısa yoldan gösteren ana ürün kapısıdır.

### M19 — Vaka servisi tek contract

Bu prompt dizisinin omurgaya eklediği ana karar şudur: Vaka servisi için tek bir sözleşme olacak. Bu sözleşme yalnız backend response tipi değil; müşteri app, servis app, backend domain servisleri, ödeme, matching, süreç ve testlerin aynı anlamla kullandığı ürün contract'ıdır.

**Sorun:** Bugünkü drift'lerin çoğu tek tek bug gibi görünüyor ama ortak kökü aynı:

- Customer app appointment payload'u offer ilişkisinden kopabiliyor.
- Home önerileri mock/default vehicle üzerinden yaşamış ve canonical case match verisine bağlanmamış.
- Servis havuzu kaba provider map'iyle çalışabiliyor.
- Vaka profili subtype/detail yerine request/draft kaynaklı kartlarla karışabiliyor.
- Çekici operasyonu `case.status` ve `tow_stage` arasında yanlış okunabiliyor.
- Process/task ekranları backend seed mi, tracking engine mi source-of-truth belirsizliği taşıyor.

**Ürün kararı:** `case service contract` şu katmanları tek yerde tanımlar:

- `case_shell`: id, kind, customer, vehicle snapshot, general status, assignment summary.
- `typed_detail`: maintenance/breakdown/accident/towing subtype alanları.
- `profile_dossier`: oluşturma detayları, medya/kanıt, linked tow/insurance, offer/process summary.
- `matching`: `case_technician_matches` candidate/score/reason/visibility.
- `notification_intent`: match kaydının servis inbox/push/poll delivery katmanı.
- `offer`: servis fiyat, zaman, kapsam yanıtı.
- `appointment`: yalnız geçerli offer üzerinden oluşan eşleşme öncesi son adım.
- `tow_operation`: `tow_stage`, dispatch, settlement, location, OTP/evidence.
- `payment`: tow/campaign zorunlu online; service offer/approval online önerilen/offline izinli.
- `process_pattern`: eşleşme sonrası ortak ve tür özel süreç adımları.
- `approval`: kapsam/fatura/completion kararları.
- `public_trust`: completion sonrası showcase, rating ve PII-safe snapshot.

**Contract kuralı:** Yeni veya değişen her vaka davranışı şu dört yüzeyde aynı anda karşılanır:

1. Backend model/service/route guard.
2. Customer app canonical case adapter ve ekran CTA'ları.
3. Service app live jobs/pool/inbox adapter ve aksiyonları.
4. Regression test/smoke.

**Aksiyon:** Implementation turunda bu contract ayrı bir doküman veya schema dosyası olarak yazılmalı; fakat sadece dokümanda kalmamalı. Özellikle şu drift'ler contract testine dönmelidir:

- `request_draft` kritik karar kaynağı olamaz.
- `HomeSummary.suggestions` mock/empty kalamaz; aktif vaka için match read-model'den gelir.
- `RandevuRequestScreen` offer'sız submit açamaz.
- Service pool yalnız provider type'a dayanamaz; match read-model ve dispatch/tow guard kullanır.
- Vaka profili iki app'te aynı canonical detail alanlarını gösterir.
- Tow UI/backend operasyon kararını `tow_stage` üzerinden verir.

**Kabul:** Vaka servis contract'ı olmadan yazılan yeni ekran veya endpoint kabul edilmez. Bir alan customer app'te varsa ama service app/backend karşılığı yoksa, ya contract'a eklenir ya da ekran feature'ı kaldırılır.

### M20 — Vaka altı composer UX contract

Vaka altı akışlar, hızlı menüden açılan bakım/arıza/hasar/çekici ekranlarının iç sorgulama düzenidir. Bu alan yalnız UI güzelliği değildir; yanlış soru sırası yanlış veri, eksik vaka, kullanıcı yorgunluğu ve kötü teklif kalitesi üretir.

**Ürün problemi:** Kullanıcı çoğu zaman vakayı teknik bir dille anlatmaya hazır değildir. Özellikle hasar ve arızada zihnindeki olay dağınıktır. Akışın görevi kullanıcıya form doldurtmak değil, olayı hatırlatıp parça parça anlatmasını sağlamaktır.

**Ana ilke:**

> Basitten zora, somuttan soyuta, seçimden açıklamaya, güvenlikten detaya ilerle.

Bu yüzden:

- İlk adımda uzun açıklama istenmez.
- Kullanıcıdan bilmediği teknik adı seçmesi beklenmez.
- Önce kolay seçim/pill/konum/olay tipi gelir; sonra medya/evrak; en sonda açıklama ve review gelir.
- Review ekranında yeni karar çıkmaz; sadece toplanan kararlar doğrulanır.
- Bir adım ileri bir adım geri hissi veren tekrarlar kaldırılır.

Tür bazlı contract:

- **Bakım:** araç + km/son bakım + bakım niyeti/kategorisi ile başlar. Özel talep, medya ve açıklama sonra gelir. Çekici/taşıma ana akışta ara adım değildir; son kararda opsiyonel handoff'tur.
- **Arıza:** semptom, araç çalışıyor mu/yürür mü, aciliyet ve kanıt sırasıyla ilerler. Kullanıcı teknik arıza ismi bilmek zorunda değildir. Çekici "otomatik açılır" promise'i değil, son kararda ayrı çekici çağırma kararına dönüşür.
- **Hasar:** güvenlik ve olay hatırlatma önce gelir; olay tipi, zaman/yer, hasar bölgesi/şiddeti, fotoğraf/evrak ve sigorta/tutanak sonra gelir. Açıklama, kullanıcı olayı hatırladıktan sonra istenir.
- **Çekici:** pickup/dropoff, şimdi/planlı, araç durumu, ödeme/tavan ücret ve çağırma odaklı kısa akıştır; bakım/arıza form mantığına sokulmaz.

**Aksiyon:** Customer app composer'ları için ayrı UX audit/refactor yapılır:

- `MaintenanceFlow`, `BreakdownFlow`, `AccidentFlow`, `TowCallComposer` adım sırası çıkarılır.
- Her flow için "kullanıcı neden bu soruyu şimdi görüyor?" kontrolü yapılır.
- Açıklama alanları ilk adımdan alınır; olay/kategori/kanıt sonrası bağlama oturtulur.
- Required attachment/field matrix adım içinde gösterilir, submit'te sürpriz yapılmaz.
- Typed view-model korunur; submit mapper canonical case payload üretir.

**Kabul:** Kullanıcı akışı tamamladığında hem kendisi "olayı iyi anlattım" hisseder hem de servis tarafı teklif vermeye yeterli, düzenli ve context'li vaka görür.

---

## Revize Critical Path

### P0 Ürün İnvariantları

1. **F1A Backend appointment gate**
   - Offer'sız bakım/arıza/hasar appointment create `422 appointment_requires_offer`.
   - Çekici scheduled/immediate bu appointment endpoint'inden yürümemeli.
   - `appointment_flow.approve` offer'sız bakım/arıza/hasar appointment'ı onaylamamalı.
   - `case_lifecycle` `APPOINTMENT_PENDING` geçişi doğrudan route tarafından değil, offer acceptance / valid appointment domain event tarafından tetiklenmeli.

2. **F1B Frontend no-offer appointment kapatma**
   - `RandevuRequestScreen` offer yokken submit açmaz.
   - Usta profilinden/vaka ekranından no-offer randevu CTA'sı gizlenir veya "Teklif bekleniyor" açıklamasına döner.
   - `technician-cta.ts` offer'sız active case için "Randevu al" üretmez.
   - `CaseComposerScreen` preferred technician fast-track'i randevuya değil vaka detayına/teklif beklemeye yönlenir.

3. **F1C Customer app offer accept contract**
   - `CaseOffersScreen` -> `RandevuRequestScreen` route'undaki `offerId` submit payload'una girer.
   - Offer kaybolursa appointment oluşturulmaz.

4. **F1D Service app legacy appointment guard**
   - Offer'sız pending appointment varsa servis app "Randevu ver" ile ilerletmez.
   - Kullanıcıya "Bu randevu teklif gerektiriyor; müşteriye teklif gönder" yönlendirmesi gösterir.

5. **F6 Immediate tow pool leak**
   - Pool feed ve pool detail immediate tow'u dışlar.
   - CEKICI feed'de yalnız gerçekten teklif/havuz modeline açık towing görünür. V1 kararına göre immediate ve scheduled dispatch ailesindeki çekiciler pool'dan dışlanır.
   - Service app offer sheet dispatch ailesindeki çekici için açılmaz.
   - `offers.py` towing case için submit'i reddeder veya sadece açıkça desteklenen ayrı offer-mode towing alt tipine izin verir.

### P1 Ürün Omurgası Tamamlama

6. **F2 Kapsam/fatura onayı**
   - Parts/invoice description zorunlu.
   - UI copy "Ek ödeme" değil "Kapsam Onayı / Final Fatura".
   - Offline ödeme seçenekleri kalır.
   - Customer app approval sheet başlığı ve açıklaması kapsam diline döner.
   - Service app parts/invoice formlarında gerekçe opsiyonel not değil, zorunlu kapsam açıklaması olur.

7. **F5 Ustaya vaka bildir gerçek feature**
   - No-offer randevu kapandıktan sonra müşteri boşluğa düşmemeli.
   - Customer app "Vakayı bildir / Teklif iste" CTA'sı üretir.
   - Backend önce `case_technician_matches` kaydına dayanır; notification/intent bunun delivery katmanıdır.
   - Service app inbox/poll bu match/intent'i gösterir.
   - Servis bu intent'ten teklif verir veya reddeder.

8. **M17 Case-technician match read-model**
   - Case create/update sonrası uygun ustalar hesaplanır.
   - Match kaydı offer'dan ayrıdır; teklif gelirse offer_id ile bağlanır.
   - Customer app uygun ustaları vaka bağlamında öne çıkarır; kartta "Bu vakaya uygun" rozeti/çerçevesi gibi açık sinyal gösterir.
   - Service app havuz feed'i match kaydıyla filtrelenir/sıralanır; yalnız kaba provider_type map'i yeterli değildir.
   - V1 matching deterministik ve açıklanabilir olur; opak/karmaşık ranking bu fazda hedeflenmez.

9. **M18 Home matched technicians bandı**
   - Aktif vaka varsa ana sayfada "Bu vakan için uygun ustalar" bandı görünür.
   - Band `case_technician_matches` read-model'den beslenir; mock/fixture kullanılmaz.
   - Kart CTA'sı "Vakayı bildir / Teklif iste" olur; randevuya direkt götürmez.
   - Keşif feed'i ayrı kalabilir ama ana sayfa bu kritik vaka aksiyonunu saklamaz.

10. **M19 Vaka servisi tek contract**
   - Case shell, subtype detail, match, intent, offer, appointment, tow, payment, process, approval ve dossier alanları tek sözleşmede tanımlanır.
   - Backend/customer app/service app adapter'ları bu sözleşmeden sapamaz.
   - Contract değişirse üç katman ve testler aynı implementation turunda güncellenir.
   - Mock/default araç, request_draft kararları ve ekran bazlı alternatif yorumlar contract drift'i kabul edilir.

11. **M20 Vaka altı composer UX contract**
   - Dört hızlı menü akışı için adım sırası kullanıcı zihnini boşaltacak şekilde yeniden tasarlanır.
   - Açıklama ilk adım olmaz; önce somut seçimler, olay/kategori, konum/zaman, kanıt ve sonra açıklama/review gelir.
   - Hasar olayı hatırlatan güvenlik/olay/hasar bölgesi akışıyla ilerler.
   - Arıza teknik terim dayatmaz; semptom, yürürlük ve kanıtla ilerler.
   - Bakım niyet/kategori ve planlı hizmet mantığıyla sade kalır.
   - Çekici ayrı kısa çağırma akışıdır; bakım/arıza içinde ara promise olmaz.

12. **M13 Composer soru sırası ve çekici handoff**
   - Kaza: çekici ilk adımda güvenlik panelinde kalır.
   - Arıza: araç durumu sorulur ama çekici ara state/promise olarak yazılmaz; son kararda "Çekici de istiyor musun?" sorulur.
   - Bakım: çekici ana karar değildir; son kararda opsiyonel "Araç servise taşınsın mı?" sorulur.
   - Evet cevabı ayrı tow composer'a yönlendirir; parent case bağlantısı korunur.

13. **F4/F18 Process source-of-truth**
   - Seed çağrısı gerçekten aktif mi kontrol edilir.
   - Tracking engine canonical ise backend seed yorumları ve tüketiciler buna göre düzeltilir.
   - Backend task/milestone canonical olacaksa missing templates P0 olur.

14. **M14 Süreç yönetimi pattern refactor'u**
   - Eşleşme sonrası süreç için canonical pattern katmanı tasarlanır.
   - Ortak minimal adımlar ve tür özel opsiyonel adımlar ayrılır.
   - UI task listesi/backend task seed aynı pattern kaynağından türetilir.
   - Çekici süreç tracking'i bu pattern'e zorla sokulmaz; `tow_stage` ayrı lifecycle olarak kalır.

15. **F14/F15 State ve source-of-truth guard**
   - Tow ekranları ve servis havuzu `case.status`tan çekici operasyon kararı çıkarmamalı; `tow_stage` kullanılmalı.
   - Matching, payment, dispatch, appointment ve approval kararları `request_draft`tan değil subtype/domain tablolardan okunmalı.
   - `request_draft` yalnız audit snapshot olarak kalmalı.

16. **M10 Assignment semantiği**
   - Ürün kararı verilir: `assigned_technician_id` gerçek assignment mı, seçili usta mı?
   - Sıkı model seçilirse offer kabulü için `accepted_offer_id` / `selected_technician_id` alanı planlanır.
   - Pragmatik model seçilirse UI ve backend snapshot "assigned ama scheduled değil" durumunu gerçek iş başlangıcı gibi göstermemeli.

17. **M15 Backend aggregate/ilişki invariant'ları**
   - ServiceCase shell + subtype exact-one invariant'ı testlenir.
   - Offer, appointment, assignment, approval, payment ve linked tow ilişkileri domain guard olarak yazılır.
   - DB constraint hemen mümkün değilse service-level invariant + regression test zorunlu olur.

18. **M16 Vaka profili dossier standardı**
   - Customer app ve service app vaka profilinde aynı canonical detail yapısı okunur.
   - Profil oluşturma detaylarını eksiksiz gösterir; teklif/randevu/süreç aksiyonları profilin alt bölümüdür.
   - Profil ekranı süreç tracking veya teklif listesiyle karışmaz; onları doğru CTA ile açar.

19. **Subtype/process integrity testleri**
   - Dört kind için subtype satırı ve vehicle snapshot test edilir.
   - Workflow seed pasifse doküman/comment güncellenir; aktifleşecekse eksik template'ler tamamlanır.

20. **F9-F13 smoke**
   - Acil çekici, hasar, bakım, arıza, pool filter, kapsam onayı.
   - Customer app tarafında hızlı menü, usta profili, teklif kabulü, randevu, çekici entrypoint smoke edilir.
   - Service app tarafında havuz, teklif, randevu onayı, parts/invoice task smoke edilir.

### P2 Release/Security Gate

17. **F16-F17 domain/trust audit**
   - insurance claim ownership
   - public showcase consent/PII
   - Hasar/sigorta ve profil güven sinyali ayrı ürün alanıdır; vaka omurgasına bağlandığı noktalar ayrıca test edilir.

18. **F19 Step-up auth ve ödeme güvenliği**
   - Payment account, payout, IBAN, submerchant ve vergi değişiklikleri gerçek para ve hukuk riskidir.
   - Vaka omurgası değil ama prod ödeme release gate'idir.

### P3 Ayrı Ürün Modülleri

19. **Ayrı tasarlanacak modüller**
   - Public showcase / profil güven sinyali.
   - Geniş notification channel yönetimi.
   - `case_links` genel graph modeli.
   - Çekici teklif pazarı / offer-request ayrı modu.

---

## Uçtan Uca Final Karar

Bu fix haritasının son hali tek bir ana problemi kapatmalıdır: **vaka, fiyat/eşleşme netleşmeden servis sürecine dönüşmemeli; çekici ise havuza düşmeden ödeme + dispatch hattında kalmalı.**

Bu yüzden implementation sırası teknik dosya sırasına göre değil, iş omurgasına göre olmalı:

1. **Vaka oluşturma sağlam kalır**
   - Araç zorunluluğu, kind/subtype satırı, vehicle snapshot ve `request_draft` audit snapshot olarak korunur.
   - Bu katmanda yeni büyük refactor yok; sadece subtype integrity testleri eklenir.

2. **Vaka servisi sözleşmesi tekleşir**
   - Backend canonical case response, customer app adapter ve service app adapter aynı contract'ı uygular.
   - Case shell, subtype detail, matching, offer, appointment, tow stage, payment, process, approval ve dossier ayrı ekran yorumlarına bölünmez.
   - Contract dışı mock/default araç ve draft kaynaklı kararlar temizlenir.

3. **Matching sınırı çizilir**
   - Bakım/arıza/hasar: havuz + teklif/bildirim.
   - Uyumlu usta listesi `case_technician_matches` read-model'inden gelir.
   - Acil/planlı çekici: payment-window/preauth + dispatch.
   - Towing case offer/pool endpointlerine düşmez.

4. **Teklif olmadan randevu kapatılır**
   - Backend create + approve guard.
   - Customer app CTA/route/payload guard.
   - Service app legacy pending guard.
   - Bu, ürünün en kritik omurga düzeltmesidir.

5. **Eşleşme anı netleşir**
   - Teklif kabulü, randevu ve ödeme yöntemi aynı zincirde kalır.
   - `assigned_technician_id` gerçek assignment mı yoksa seçili usta mı açıkça belirlenir.
   - Vaka süreci ancak eşleşme kesinleşince başlar.

6. **Süreç içi approval dili temizlenir**
   - "Ek ödeme" normal bir ürün akışı değildir.
   - Parts/invoice akışı "Kapsam Onayı / Final Fatura" olarak kalır.
   - Gerekçe zorunlu olur; offline ödeme seçenekleri korunur.

7. **Composer soru sırası ürün mantığına döner**
   - Hasar/kaza: güvenlik ve çekici ilk adımdadır.
   - Arıza: semptom + araç durumu + kanıt + konum/zaman + review; çekici son karardır.
   - Bakım: kategori + kapsam + medya/not + konum/zaman + review; çekici son karardır.
   - Arıza/bakım içindeki çekici kararı ayrı `towing` case'e yönlendirir; parent case bağlantısı korunur.

8. **Vaka profili dosya standardına döner**
   - Profil ekranı oluşturma detaylarının arşivlenmiş ama okunabilir halidir.
   - Araç snapshot, subtype detayları, kanıtlar, linked tow/sigorta ve teklifler net bloklara ayrılır.
   - Süreç yönetimi profilin içinde boğulmaz; profil süreç takibine doğru kapıyı açar.

9. **Çekici hattı ayrı tutulur**
   - Immediate: ödeme/preauth → searching → dispatch.
   - Scheduled: scheduled_waiting → payment window → preauth → dispatch.
   - Pool/offer/bidding state'leri V1 aktif akışta kullanılmaz.

10. **Smoke bu zinciri doğrular**
   - Dört case kind create.
   - Bakım/arıza/hasar pool + offer + appointment.
   - Arıza/bakım son kararından linked tow handoff.
   - Immediate/scheduled tow payment + dispatch.
   - Customer/service app CTA yüzeyleri.
   - Parts/invoice kapsam onayı.

### Final P0 Set

P0 artık sadece şu dört kapıdır:

1. Offer'sız bakım/arıza/hasar appointment create ve approve kapalı.
2. Customer app offer'sız randevuya götürmüyor; offer kabulünde `offer_id` kaybolmuyor.
3. Service app offer'sız legacy appointment onaylatmıyor.
4. Immediate/scheduled dispatch ailesindeki towing case pool/detail/offer submit yüzeylerinden dışlanıyor.

Bu dördü yapılmadan uygulama "çalışıyor" görünse bile ürün omurgası yanlış çalışır.

### Final P1 Set

P1, eksiksiz vaka deneyimini kuran ürün omurgası katmanıdır:

1. Kapsam/fatura onayı dili ve zorunlu gerekçe.
2. "Ustaya Vaka Bildir / Teklif İste" intent + service inbox/poll akışı.
3. Case-technician match read-model.
4. Home matched technicians bandı.
5. Vaka servisi tek contract: backend/customer app/service app aynı sözleşmeden yürür.
6. Vaka altı composer UX contract: basitten zora, somuttan soyuta, açıklama en sona.
7. Composer akış refactor'u: bakım/arıza optimizasyonu ve çekici son karar handoff'u.
8. Süreç yönetimi pattern refactor'u.
9. State/source-of-truth guard: `tow_stage` ve subtype/domain tabloları authoritative.
10. Assignment semantiği kararı ve testleri.
11. Vaka profili canonical dossier standardı.
12. Subtype integrity testleri.
13. Workflow/process source-of-truth kararının netleşmesi.
14. Dört ana smoke akışı.

### Ayrı Modül Olarak Tutulacaklar

Şu maddeler ürün için değerlidir ama bu vaka omurgası fix'inin ana zinciri değildir:

- Public showcase yeniden audit'i.
- Step-up auth ve payout/security ayrıntıları.
- Geniş notification channel yönetimi.
- `case_links` genel graph modeli.
- Çekici teklif pazarı / offer-request ayrı modu.

Ancak bu liste "önemsiz" anlamına gelmez. `case_links`, step-up auth veya notification genişletmesi ilgili ürün modülüne girildiğinde tekrar P0/P1 olarak ele alınmalıdır.

---

## Revize Kabul Kriterleri

| Alan | Kabul |
| --- | --- |
| Appointment | Offer'sız bakım/arıza/hasar randevusu backend'de 422; FE'de no-offer submit yok. |
| Appointment model | Offer'sız legacy appointment approve edilemiyor; `direct_request` aktif akışta kullanılmıyor. |
| Customer app CTA | Usta profil/preview ve composer fast-track offer'sız randevuya götürmez. |
| Composer flow | Kaza dışında çekici ara adım değildir. Arıza/bakım son kararda çekici isteyip istemediğini sorar ve evet ise linked tow composer'a yönlendirir. |
| Vaka altı UX | Bakım/arıza/hasar/çekici composer'ları basitten zora ilerler; uzun açıklama ilk adım değildir; review yeni karar üretmez. |
| Vakayı bildir | Offer yokken müşteri seçili servise vaka bildirebilir; servis app bu intent'i görüp teklif/reddet aksiyonu alabilir. |
| Uyumlu usta read-model | Case açılınca sistem uygun ustaları `case_technician_matches` benzeri tabloda kaydeder; customer app uygun ustaları öne çıkarır, service pool kendi match kayıtlarını görür. |
| Uyumlu usta UX | Usta kartlarında match kaydına dayalı "Bu vakaya uygun" rozeti/çerçevesi görünür; etiket reklam/boost gibi davranmaz ve kısa match reason gösterir. |
| Home uygun ustalar | Aktif vaka varsa ana sayfada canlı match read-model'den gelen "Bu vakan için uygun ustalar" bandı görünür; `HomeSummary.suggestions` boş/mock kalmaz. |
| Vaka servis contract | Case shell, subtype detail, matching, offer, appointment, tow, payment, process, approval ve dossier alanları tek sözleşmede tanımlıdır; backend/customer app/service app bu sözleşmeyi aynı anlamla uygular. |
| Offer kabulü | Offer'lı akış randevuya gidebiliyor ve `offer_id` kaybolmuyor. |
| Service app appointment | Offer'sız legacy/pending randevu servis app'te onaylanamaz; teklif yönlendirmesi gösterilir. |
| Tow pool/offer | Immediate tow pool feed/detail'da görünmüyor. V1 kararı gereği scheduled tow da dispatch ailesindeyse pool'da görünmüyor; service app offer sheet ve backend offer submit açılmaz. |
| Assignment | `assigned_technician_id` semantiği net: ya yalnız randevu onayı sonrası set edilir ya da "seçili usta" anlamı açıkça dokümante/test edilir. |
| Backend aggregate | Her vaka tam bir shell + doğru subtype satırıyla oluşur. Offer, appointment, assignment, approval, payment ve linked tow ilişkileri route yan etkisi değil domain invariant'ıdır. |
| Vaka profili | Customer ve service app vaka profili oluşturma sırasında girilen tüm canonical detayları, vehicle snapshot'ı, kanıtları, linked tow/sigorta bilgisini ve teklif/süreç özetini okunabilir dossier olarak gösterir. |
| State/source guard | Çekici operasyon kararları `tow_stage`tan; matching/payment/appointment/approval kararları domain tablolardan okunur. `request_draft` karar kaynağı değildir. |
| Process pattern | Eşleşme sonrası vaka süreci canonical pattern'den türetilir; UI task listesi ve backend process tabloları ayrı örnek akışlar olarak yaşamaz. |
| Subtype integrity | Her yeni vaka kendi subtype satırını ve vehicle snapshot'ını oluşturur; yanlış subtype oluşmaz. |
| Kapsam/fatura | Parts/invoice approval description olmadan açılamıyor. Customer ve service app'te "Ek ödeme" dili yok. |
| Blueprint | Resolver'ın ürettiği her blueprint için template veya bilinçli no-seed davranışı var. |
| Smoke | Çekici, hasar, bakım, arıza uçtan uca manuel smoke'dan geçiyor. |

---

## Sonraki Implementation Prompt'u

```text
Referans:
- docs/naro-vaka-omurgasi.md
- docs/naro-vaka-omurgasi-genisletilmis.md
- docs/audits/2026-04-26-vaka-omurgasi-fix-haritasi-revize.md

Görev:
Ürün omurgası P0/P1 düzeltmelerini uygula.

Öncelik:
1. Offer'sız bakım/arıza/hasar appointment create backend'de 422 dönsün; offer'sız legacy appointment approve da bloklansın.
2. Customer app offer yokken randevu submit etmesin; usta profil/preview CTA ve composer fast-track offer'sız randevuya götürmesin.
3. Offer kabul akışında offer_id korunarak appointment oluşturulsun.
4. Service app offer'sız legacy appointment'ı onaylatmasın; "teklif gerekli" yönlendirmesi göstersin.
5. Pool feed/detail immediate towing'i dışlasın. V1 kararına göre scheduled towing de pool/teklif modeli değilse onu da dışla; service app offer sheet ve backend offer submit dispatch çekiciler için açılmasın.
6. Parts/invoice approval description zorunlu olsun; customer ve service app copy "Kapsam Onayı / Final Fatura" diline taşınsın.
7. "Ustaya Vaka Bildir / Teklif İste" gerçek matching intent'i olarak kurulsun: customer CTA, match kaydına bağlı backend intent, service inbox/poll, teklif verme dönüşü.
8. Case-technician match read-model kur: case açılınca uygun ustalar score/reason ile kaydedilsin; customer app ve service pool bu kaydı kullansın.
9. Customer app usta kartlarında match kaydına bağlı "Bu vakaya uygun" rozeti/çerçevesi göster; match reason kısa ve açıklanabilir olsun.
10. Ana sayfaya aktif vaka için "Bu vakan için uygun ustalar" bandı ekle; `HomeSummary.suggestions` canlı match read-model'den dolsun ve `TechnicianSuggestionCard` mock/fallback davranışı temizlensin.
11. Vaka servisi tek contract'ını yaz ve uygula: case shell, subtype, match, intent, offer, appointment, tow, payment, process, approval ve dossier aynı sözleşmeden yürüsün.
12. Vaka altı composer UX contract'ını uygula: bakım/arıza/hasar/çekici akışları basitten zora ilerlesin; açıklama ilk adım olmasın; review yeni karar üretmesin.
13. Composer akışlarını refactor et: kaza çekici ilk adım istisnası kalsın; arıza/bakım çekici sorusunu son karar olarak sorsun ve evet ise linked tow composer'a yönlendirsin.
14. Arıza akışındaki ara `towing_required` state/promise dili kaldır; "randevu onayında otomatik çekici açılır" kopyası silinsin.
15. Süreç yönetimi pattern katmanını netleştir: eşleşme sonrası ortak minimal adımlar + tür özel opsiyonel adımlar + approval gate'leri.
16. Tow UI/backend kararları `tow_stage` üzerinden yürüsün; `case.status` yalnız shell state olarak kalsın.
17. Matching/payment/dispatch/appointment/approval kararları `request_draft`tan değil subtype/domain tablolardan okunsun.
18. Service app JobTask parts/invoice formlarında gerekçe/kapsam açıklaması zorunlu olsun.
19. `assigned_technician_id` semantiğini netleştir; gerekiyorsa offer kabulü için selected/accepted offer alanını ayrı planla.
20. Backend aggregate invariant'larını uygula/testle: exact-one subtype, offer→appointment→assignment, approval→payment, linked tow parent-child ve insurance child-domain ilişkileri.
21. Vaka profilini iki app'te canonical dossier standardına taşı: shell + subtype + vehicle snapshot + kanıtlar + linked tow/sigorta + teklifler/süreç özeti.
22. Dört case subtype için integrity testi yaz: subtype row + vehicle snapshot + yanlış subtype yok.
23. Process source-of-truth kararını uygula: tracking engine canonical ise backend seed yorum/consumer drift'i temizle; backend seed canonical ise BREAKDOWN_STANDARD, TOWING_IMMEDIATE, TOWING_SCHEDULED template'lerini ekle.

Test:
- Offer'sız appointment -> 422.
- Offer'lı appointment -> success.
- FE no-offer randevu CTA/submit yok.
- Customer app usta profil CTA offer'sız randevuya gitmiyor.
- Customer app preferred technician case create sonrası randevuya direkt gitmiyor.
- Breakdown flow çekici ara adım/promise üretmiyor; çekici son karardan linked tow composer'a gider.
- Maintenance flow son kararda opsiyonel çekici handoff sunuyor.
- Accident flow güvenlik panelindeki çekici ilk adım istisnası korunuyor.
- Composer UX smoke: uzun açıklama ilk adımda istenmiyor; hasar güvenlik/olay hatırlatma ile, arıza semptom/yürürlük ile, bakım kategori/niyet ile başlıyor; review ekranı yeni karar çıkarmıyor.
- Customer app aktif vakayı seçili servise "bildir / teklif iste" olarak gönderebiliyor.
- Case create/update sonrası uyumlu ustalar match tablosuna yazılıyor; score/reason görünür ve offer gelince aynı kayıt offer'a bağlanıyor.
- Customer app usta kartında uyumlu aday için "Bu vakaya uygun" benzeri rozet/çerçeve görünüyor ve kısa match reason okunuyor.
- Home aktif vaka varken "Bu vakan için uygun ustalar" bandı gösteriyor; suggestions canlı match read-model'den geliyor, boş/mock kalmıyor.
- Vaka servis contract testi: customer app adapter, service app adapter ve backend canonical response aynı shell/subtype/match/offer/tow/payment/process alanlarını aynı anlamla kullanıyor.
- Service app pool feed yalnız kaba provider_type map'iyle değil match kaydıyla filtreleniyor/sıralanıyor.
- Service app bildirilen vakayı inbox/poll yüzeyinde görüyor ve teklif/reddet aksiyonu sunuyor.
- Service app offer'sız randevu approve edemiyor.
- Immediate/scheduled dispatch towing pool feed/detail'da yok.
- Dispatch ailesindeki towing case'e backend offer submit reddediliyor.
- Scheduled tow payment-window smoke: ödeme zamanı gelmeden dispatch başlamıyor.
- Tow UI/backend `case.status`tan operasyon kararı çıkarmıyor; `tow_stage` kullanıyor.
- Kritik kararlar `request_draft`tan okunmuyor.
- UI task listesi/backend process seed tek canonical process pattern kararına uyuyor.
- Parts/invoice description boş -> 422.
- Service app parts/invoice gerekçesiz submit edemiyor.
- Backend aggregate invariant testleri: exact-one subtype, offer-linked appointment, assignment semantiği, approval-payment link ve linked tow parent-child.
- Customer/service vaka profili her kind için canonical oluşturma detaylarını eksiksiz gösteriyor; profile CTA'ları teklif/süreç ekranına doğru ayrılıyor.
- Dört vaka türü subtype integrity testinden geçiyor.
- Dört vaka türü smoke.

Ayrı ürün modülleri:
- Step-up auth.
- Geniş notification channel yönetimi.
- Public showcase refactor.
- Genel `case_links` graph modeli.
```
