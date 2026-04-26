# Faz 7.5 — Case Refactor Omurga Drift Audit

**Tarih:** 2026-04-26  
**Amaç:** Faz 8 koduna başlamadan önce Faz 1-7 refactor sonucunun `naro-vaka-omurgasi.md`, `naro-vaka-omurgasi-genisletilmis.md` ve `naro-domain-glossary.md` kararlarından sapıp sapmadığını kanıtla denetlemek.  
**Kapsam:** Kod değişikliği yoktur; bu doküman Faz 8 planını onaylar ve küçük revizyonlar ekler.

## Executive Summary

Faz 1-7 doğru eksene oturdu: offer'sız randevu backend'de kapalı, `direct_request` aktif ürün akışından çıkarılmış, match/notification kavramları ayrıştırılmaya başlanmış, `case_dossier` backend contract'ı oluşmuş ve backend baseline Faz 7 sonunda yeşile dönmüş durumda.

Yine de vaka omurgasını bozabilecek birkaç kritik drift kaldı:

1. `request_draft` hâlâ matching lokasyon kararında okunuyor.
2. "Vakayı bildir" notification akışı match yokken `match.id` bekliyor; bildirim match değildir kuralını teknik olarak kırıyor.
3. Çekici tarafında normal pool feed kapalı olsa da `timeout_converted_to_pool`, `bidding_open`, `offer_accepted` ve offer endpoint'teki `TOWING` cap'i V1 dispatch kararını bulanıklaştırıyor.
4. Backend `case_dossier` var ama milestones/tasks yok; FE tracking engine ve service app adapter hâlâ workflow kararını kendisi üretiyor.
5. Customer showcase revoke endpoint'i eksik; service tarafı revoke ve backend service desteği var.
6. Customer ve service case profile ekranları henüz `case_dossier` okumuyor.
7. Composer akışları, PO'nun "basitten zora, karardan açıklamaya" ilkesinden bazı noktalarda kopuyor.

**Sonuç:** Faz 8 planı genel olarak doğru. Fakat Faz 8'e iki ek P0/P1 madde eklenmeli:

- `notify_case_to_technician` match yokken patlamamalı; notification tek başına geçerli olmalı.
- Towing için `CaseOffer` submit endpoint'inde explicit guard eklenmeli veya tow offer mode ayrı feature flag'e alınmalı.

## Canonical Referans

- Tek vaka sözleşmesi: [docs/naro-vaka-omurgasi.md](../naro-vaka-omurgasi.md) `§2.1`, özellikle `request_draft`, offer'sız randevu, çekici havuz/teklif drift örnekleri.
- Composer ilkesi: [docs/naro-vaka-omurgasi.md](../naro-vaka-omurgasi.md) `§2.2`.
- `request_draft` source-of-truth kuralı: [docs/naro-vaka-omurgasi-genisletilmis.md](../naro-vaka-omurgasi-genisletilmis.md) `§2.1`.
- Appointment/offer kuralı: [docs/naro-vaka-omurgasi-genisletilmis.md](../naro-vaka-omurgasi-genisletilmis.md) `§6`.
- Planlı çekici kararı: [docs/naro-vaka-omurgasi-genisletilmis.md](../naro-vaka-omurgasi-genisletilmis.md) `§4.1`.
- Güncel naming kararları: [docs/naro-domain-glossary.md](../naro-domain-glossary.md) `§22`.

## Bulgular

### OM-01 — Matching lokasyonu `request_draft` okuyor

**Kural:** `request_draft` immutable audit snapshot'tır; matching/payment/dispatch/appointment karar kaynağı değildir.  
**Kod kanıtı:** [case_matching.py](/home/alfonso/sanayi-app/naro-backend/app/services/case_matching.py:402) `case.location_label` sonrası `case.request_draft` içinden `_LOCATION_HINT_KEYS` tarıyor.  
**Durum:** `DRIFT`  
**Öncelik:** `P0`  
**Risk:** Uygun usta skoru typed subtype alanları yerine ham draft alanlarından etkilenebilir. Bu, ileride form alanı değişince matching'in sessiz bozulmasına yol açar.  
**Faz 8 aksiyonu:** F15 doğru. `_case_location_text` yalnız typed alanlardan oluşmalı: `ServiceCase.location_label`, `TowCase.pickup/dropoff address`, varsa `AccidentCase` typed lokasyon alanı. Typed alan yoksa migration açmadan sadece mevcut typed alanlarla sınırlı kalınmalı.  
**Faz 9/10 aksiyonu:** Lokasyon taxonomy alanları netleşirse match skoru city/district id üzerinden yapılmalı.

### OM-02 — Tow misc route `request_draft` mutasyonunu storage gibi kullanıyor

**Kural:** `request_draft` submit anı snapshot'ıdır; sonradan yaşayan state veya user action store'u olmamalı.  
**Kod kanıtı:** [tow/misc.py](/home/alfonso/sanayi-app/naro-backend/app/api/v1/routes/tow/misc.py:89) kasko bilgisi, [tow/misc.py](/home/alfonso/sanayi-app/naro-backend/app/api/v1/routes/tow/misc.py:112) rating bilgisi `case.request_draft` içine yazılıyor.  
**Durum:** `PARTIAL`  
**Öncelik:** `P2`  
**Risk:** Şu an matching/payment kararında kullanılmıyor gibi duruyor; ancak snapshot semantiğini kirletiyor ve ileride audit/debug değerini düşürür.  
**Faz 8 aksiyonu:** Faz 8'in ana hedefini şişirmemek için kod değişikliği şart değil. Ancak yeni kod bu pattern'i çoğaltmamalı.  
**Faz 9/10 aksiyonu:** Kasko seçimi typed tow/insurance ilişkisine, rating ise review/showcase veya tow completion tablosuna taşınmalı.

### OM-03 — Offer'sız appointment backend'de kapalı

**Kural:** Bakım/arıza/hasar için teklif olmadan randevu yok; "vakayı bildir" var.  
**Kod kanıtı:** [appointments.py](/home/alfonso/sanayi-app/naro-backend/app/api/v1/routes/appointments.py:55) `_OFFER_REQUIRED_KINDS`, [appointments.py](/home/alfonso/sanayi-app/naro-backend/app/api/v1/routes/appointments.py:216) `offer_required_for_appointment`, [appointments.py](/home/alfonso/sanayi-app/naro-backend/app/api/v1/routes/appointments.py:224) `direct_appointment_disabled`.  
**Durum:** `ALIGNED`  
**Öncelik:** `P0 korunacak`  
**Risk:** Düşük. Bu guard omurganın en kritik düzeltmelerinden biri ve yerinde.  
**Faz 8 aksiyonu:** Geri gevşetilmemeli.  
**Faz 9/10 aksiyonu:** Customer app smoke'ta offer'sız appointment 422 senaryosu doğrulanmalı.

### OM-04 — `direct_request` yalnız compat/legacy olarak kalmış görünüyor

**Kural:** `direct_request` aktif ürün akışında kullanılmamalı; enum/schema compat kalabilir.  
**Kod kanıtı:** Naming grep aktif yüzeyde yalnız [appointments/schemas.ts](/home/alfonso/sanayi-app/naro-app/src/features/appointments/schemas.ts:28) ve [appointment.py](/home/alfonso/sanayi-app/naro-backend/app/models/appointment.py:41) compat değerlerini buluyor. Backend route `direct_request` payload'unu 422 ile reddediyor.  
**Durum:** `LEGACY_OK`  
**Öncelik:** `P3`  
**Risk:** Düşük. Schema'da enum kalması test/dev uyumluluğu için kabul edilebilir.  
**Faz 8 aksiyonu:** Yok.  
**Faz 9/10 aksiyonu:** Kullanıcı-facing hiçbir CTA'nın `direct_request` göndermediği cihaz smoke ile doğrulanmalı.

### OM-05 — Pool feed çekiciyi dışlıyor

**Kural:** V1 immediate/scheduled tow havuz/teklif modeline düşmez.  
**Kod kanıtı:** [repositories/case.py](/home/alfonso/sanayi-app/naro-backend/app/repositories/case.py:155) pool koşullarında `ServiceCase.kind != ServiceRequestKind.TOWING` var. [case_matching.py](/home/alfonso/sanayi-app/naro-backend/app/services/case_matching.py:114) towing için initial match üretmiyor.  
**Durum:** `ALIGNED`  
**Öncelik:** `P0 korunacak`  
**Risk:** Ana pool feed açısından düşük.  
**Faz 8 aksiyonu:** Regression test önerilir: immediate ve scheduled towing pool feed'de görünmez.  
**Faz 9/10 aksiyonu:** Service app pool UI'da tow kartı bekleyen eski mock/fixture kalıntıları temizlenmeli.

### OM-06 — Tow fallback hâlâ "pool conversion" olarak aktif

**Kural:** Güncel glossary kararı: V1 çekici immediate/scheduled dispatch modelidir; havuz/teklif yok.  
**Kod kanıtı:** [tow_dispatch.py](/home/alfonso/sanayi-app/naro-backend/app/services/tow_dispatch.py:6) "pool conversion opsiyonu", [tow_dispatch.py](/home/alfonso/sanayi-app/naro-backend/app/services/tow_dispatch.py:116) deneme tükenince `_transition_to_pool_offered`, [tow_dispatch.py](/home/alfonso/sanayi-app/naro-backend/app/services/tow_dispatch.py:303) event title "havuza dönüştürme teklifi". Enum tarafında [case.py](/home/alfonso/sanayi-app/naro-backend/app/models/case.py:67) `TIMEOUT_CONVERTED_TO_POOL`, [case.py](/home/alfonso/sanayi-app/naro-backend/app/models/case.py:69) `BIDDING_OPEN`, [case.py](/home/alfonso/sanayi-app/naro-backend/app/models/case.py:70) `OFFER_ACCEPTED` yaşıyor.  
**Durum:** `NEEDS_DECISION`  
**Öncelik:** `P0/P1`  
**Risk:** Yüksek. Orijinal anlatıda acil çekicide 3 deneme sonrası fallback cümlesi var; ancak genişletilmiş doküman ve sözlükte güncel V1 kararı "dispatch, havuz/teklif yok". Bu çelişki çözülmeden Faz 10 smoke "doğru davranışı" ölçemez.  
**Faz 8 aksiyonu:** Ürün odaklı öneri: V1'de fallback kullanıcıya "aday bulunamadı / tekrar dene / destek bekleniyor" olarak sunulmalı; normal pool/offer sistemine bağlanmamalı. En azından event/copy ve stage adı "pool teklif" anlamı üretmemeli.  
**Faz 9/10 aksiyonu:** Eğer tow offer market ayrı future mode olacaksa `tow_offer_request` gibi ayrı mode/feature flag ile tasarlanmalı; mevcut dispatch state içine karıştırılmamalı.

### OM-07 — Offer endpoint towing için explicit kapalı değil

**Kural:** Towing V1'de offer almaz.  
**Kod kanıtı:** Pool feed towing'i dışlasa da [offers.py](/home/alfonso/sanayi-app/naro-backend/app/api/v1/routes/offers.py:126) `_KIND_OFFER_CAP` içinde `ServiceRequestKind.TOWING: 5` var. [offers.py](/home/alfonso/sanayi-app/naro-backend/app/api/v1/routes/offers.py:189) provider uyumu `KIND_PROVIDER_MAP` üzerinden bakıyor; [pool_matching.py](/home/alfonso/sanayi-app/naro-backend/app/services/pool_matching.py:21) towing için `CEKICI` provider tanımlı.  
**Durum:** `PARTIAL`  
**Öncelik:** `P0`  
**Risk:** Tow case status'ü [tow_lifecycle.py](/home/alfonso/sanayi-app/naro-backend/app/services/tow_lifecycle.py:303) ile `PAYMENT_REQUIRED/SEARCHING/SCHEDULED_WAITING` aşamalarında `MATCHING` olarak map ediliyor. Bu nedenle doğrudan API çağrısıyla towing offer oluşturulabilme riski var. Pool feed göstermese bile route explicit kapalı olmalı.  
**Faz 8 aksiyonu:** `submit_offer_endpoint` başında `case.kind == TOWING` ise `422 tow_offer_disabled` dönsün. `_KIND_OFFER_CAP` içindeki towing cap kaldırılmalı veya future mode arkasına alınmalı.  
**Faz 9/10 aksiyonu:** Tow offer future mode ayrı endpoint/model olarak yeniden tasarlanırsa buradan değil, ayrı contract'tan ilerlemeli.

### OM-08 — Backend workflow seed var; mobile tracking engine hâlâ karar üretiyor

**Kural:** Backend `workflow_blueprint` canonical; FE yalnız presentation/config layer.  
**Kod kanıtı:** [engine.ts](/home/alfonso/sanayi-app/packages/mobile-core/src/tracking/engine.ts:408) `determineBlueprint`, [engine.ts](/home/alfonso/sanayi-app/packages/mobile-core/src/tracking/engine.ts:454) `buildMilestones`, [engine.ts](/home/alfonso/sanayi-app/packages/mobile-core/src/tracking/engine.ts:630) `buildTasks`, [engine.ts](/home/alfonso/sanayi-app/packages/mobile-core/src/tracking/engine.ts:1299) sync sırasında bunları yeniden üretiyor. Backend tarafında [case_process.py](/home/alfonso/sanayi-app/naro-backend/app/models/case_process.py:7) workflow seed'in case create'de insert edildiğini söylüyor.  
**Durum:** `DRIFT`  
**Öncelik:** `P0`  
**Risk:** Aynı vaka farklı app'lerde farklı milestone/task ile görünebilir. Bu, süreç ekranının ürün sözleşmesini bozar.  
**Faz 8 aksiyonu:** F18 FE doğru: mobile engine BE `case_dossier.milestones/tasks` veya canonical response üzerinden presentation üretmeli; workflow kararı üretmemeli.  
**Faz 9/10 aksiyonu:** Mock data ile live data ayrımı netlenmeli; mock sadece demo fixture olarak kalmalı.

### OM-09 — Service app `workflowBlueprintFor` da workflow kararı üretiyor

**Kural:** FE canonical workflow kararı üretmez.  
**Kod kanıtı:** [api.case-live.ts](/home/alfonso/sanayi-app/naro-service-app/src/features/jobs/api.case-live.ts:618) `workflowBlueprintFor(detail)` subtype'a bakıp blueprint seçiyor; [api.case-live.ts](/home/alfonso/sanayi-app/naro-service-app/src/features/jobs/api.case-live.ts:804) domain case'e bu değer yazılıyor; [api.case-live.ts](/home/alfonso/sanayi-app/naro-service-app/src/features/jobs/api.case-live.ts:805) milestones/tasks boş dönüyor.  
**Durum:** `DRIFT`  
**Öncelik:** `P1`  
**Risk:** Service app, customer app'ten farklı süreç yorumu üretebilir.  
**Faz 8 aksiyonu:** Eğer F18 FE içinde service app'e dokunulacaksa aynı commit'e alınabilir; aksi halde Faz 9'a net scope olarak yazılmalı.  
**Faz 9/10 aksiyonu:** Service app job/detail adapter `case_dossier` veya backend workflow fields üzerinden çalışmalı.

### OM-10 — `case_dossier` role-safe temel var, ama milestones/tasks eksik

**Kural:** Case profile/dossier, oluşturma detayları + kanıtlar + teklifler + süreç özetini tek contract'ta taşımalı.  
**Kod kanıtı:** [case_dossier.py](/home/alfonso/sanayi-app/naro-backend/app/schemas/case_dossier.py:268) `CaseDossierResponse` 16 alan içeriyor; [case_dossier.py](/home/alfonso/sanayi-app/naro-backend/app/schemas/case_dossier.py:271) shell'den [case_dossier.py](/home/alfonso/sanayi-app/naro-backend/app/schemas/case_dossier.py:286) viewer'a kadar alanlar var, ama milestone/task alanı yok. DB modelleri var: [case_process.py](/home/alfonso/sanayi-app/naro-backend/app/models/case_process.py:137) `CaseMilestone`, [case_process.py](/home/alfonso/sanayi-app/naro-backend/app/models/case_process.py:161) `CaseTask`.  
**Durum:** `PARTIAL`  
**Öncelik:** `P0`  
**Risk:** FE'yi BE source-of-truth'a bağlamak için gereken süreç verisi API'de yok. Bu eksik kalırsa FE hardcoded engine'i kaldıramaz.  
**Faz 8 aksiyonu:** F18 BE doğru: `CaseDossierResponse` içine `milestones` ve `tasks` eklenmeli. `task_key` için migration açılmadan V1'de `task_key = kind.value` computed olabilir.  
**Faz 9/10 aksiyonu:** FE `case_profile` ekranları bu alanlarla bağlanmalı.

### OM-11 — Customer/service profile ekranları henüz dossier okumuyor

**Kural:** UI ekran adı `case_profile`, API/system dili `case_dossier`; iki app aynı role-safe contract'ı okumalı.  
**Kod kanıtı:** Customer [CustomerCaseProfileScreen.tsx](/home/alfonso/sanayi-app/naro-app/src/features/cases/screens/CustomerCaseProfileScreen.tsx:95) `useCanonicalCase` kullanıyor. Service [CaseProfileScreen.tsx](/home/alfonso/sanayi-app/naro-service-app/src/features/cases/screens/CaseProfileScreen.tsx:163) `usePoolCaseDetail` kullanıyor. `useCaseDossier` bulunmuyor.  
**Durum:** `PARTIAL`  
**Öncelik:** `P1`  
**Risk:** Backend contract doğru olsa bile kullanıcı/usta profil ekranları eski adapter/mock mantığında kalır; vaka profili "tek canonical sayfa" olmaz.  
**Faz 8 aksiyonu:** Faz 8 kapsamında değilse sorun yok; Faz 9 kapsamı kesinleştirilmeli.  
**Faz 9/10 aksiyonu:** `useCaseDossier`, customer case profile, service case profile ve pool detail redaction mapping yapılmalı.

### OM-12 — Notification match yokken fake match yaratmıyor, ama patlıyor

**Kural:** `CaseTechnicianMatch` uygun usta read-model'idir; `CaseTechnicianNotification` müşteri bildirimi/intention'dır. Notification match değildir ve match üretmek zorunda değildir.  
**Kod kanıtı:** [case_matching.py](/home/alfonso/sanayi-app/naro-backend/app/services/case_matching.py:164) match aranıyor; [case_matching.py](/home/alfonso/sanayi-app/naro-backend/app/services/case_matching.py:176) insert'te `match_id=match.id`; [case_matching.py](/home/alfonso/sanayi-app/naro-backend/app/services/case_matching.py:185) upsert update'te yine `match.id`. Match yoksa `None.id` riski var.  
**Durum:** `DRIFT`  
**Öncelik:** `P0`  
**Risk:** "Ustaya vaka bildir" ana akışı, sistem önceden match üretmemişse 500'e düşebilir. Bu, PO anlatısındaki keşif → vakayı bildir değerini kırar.  
**Faz 8 aksiyonu:** Notification match_id nullable çalışmalı. Sistem match'i varsa ilişkilensin; yoksa yalnız notification yaratılsın. Match üretimi sadece sistem-hesaplı akışta yapılmalı.  
**Faz 9/10 aksiyonu:** Service inbox ve pool kartları `is_notified_to_me` ile `is_matched_to_me` rozetlerini ayrı göstermeli.

### OM-13 — Showcase customer revoke endpoint'i eksik

**Kural:** Public showcase iki taraf onayı ve iki taraf revoke hakkı ister.  
**Kod kanıtı:** Backend service [case_public_showcases.py](/home/alfonso/sanayi-app/naro-backend/app/services/case_public_showcases.py:464) `revoke_for_actor` içinde `actor="customer"` destekliyor. Technician endpoint [technicians.py](/home/alfonso/sanayi-app/naro-backend/app/api/v1/routes/technicians.py:481) var. Customer cases route'ta aynı endpoint yok.  
**Durum:** `DRIFT`  
**Öncelik:** `P0`  
**Risk:** Public vitrin güven sözleşmesi tek taraflı kalır. Müşteri, sonradan izni geri çekemezse ürün güvenini bozar.  
**Faz 8 aksiyonu:** F17 doğru: `POST /cases/{case_id}/showcase/revoke` eklenmeli; ownership guard ve cache invalidation korunmalı.  
**Faz 9/10 aksiyonu:** Customer app'te "public görünürlüğü geri çek" aksiyonu role-safe gösterilmeli.

### OM-14 — Composer UX, "basitten zora" ilkesinden kopuyor

**Kural:** Kullanıcı önce kolay kararlarla zihnini boşaltır; açıklama/kanıt sonra gelir. Çekici kaza için ilk adım olabilir, bakım/arıza için son kararda yönlendirme olmalıdır.  
**Kod kanıtı:** Accident flow step sırası [AccidentFlow.tsx](/home/alfonso/sanayi-app/naro-app/src/features/cases/composer/AccidentFlow.tsx:908) sonrası `accident_photos` [AccidentFlow.tsx](/home/alfonso/sanayi-app/naro-app/src/features/cases/composer/AccidentFlow.tsx:919) ile `accident_kind`den [AccidentFlow.tsx](/home/alfonso/sanayi-app/naro-app/src/features/cases/composer/AccidentFlow.tsx:935) önce geliyor. Breakdown description [BreakdownFlow.tsx](/home/alfonso/sanayi-app/naro-app/src/features/cases/composer/BreakdownFlow.tsx:206) `VehicleStateStep` içinde erken isteniyor. Maintenance category [MaintenanceFlow.tsx](/home/alfonso/sanayi-app/naro-app/src/features/cases/composer/MaintenanceFlow.tsx:66) `goNext()` ile auto-next yapıyor ve [MaintenanceFlow.tsx](/home/alfonso/sanayi-app/naro-app/src/features/cases/composer/MaintenanceFlow.tsx:718) footer gizli.  
**Durum:** `DRIFT`  
**Öncelik:** `P0`  
**Risk:** Veri toplansa bile akış kullanıcıyı geriye/ileri iterek güveni düşürür; PO'nun vaka altı yönetim beklentisini karşılamaz.  
**Faz 8 aksiyonu:** Claude planındaki 3 FE düzeltmesi doğru: accident reorder, breakdown description deferral, maintenance manual navigation.  
**Faz 9/10 aksiyonu:** Cihaz smoke'ta dört composer akışı geri dönme/düzeltme dahil test edilmeli.

### OM-15 — Naming gate şu an temiz; legacy izolasyon korunmalı

**Kural:** `additional_amount`, `extra_payment`, `additional_payment`, `bid` aktif yüzeyde geri gelmemeli.  
**Kod kanıtı:** Grep sonucu aktif app/backend kullanımında yalnız `direct_request` compat değerleri kaldı: [appointments/schemas.ts](/home/alfonso/sanayi-app/naro-app/src/features/appointments/schemas.ts:28), [appointment.py](/home/alfonso/sanayi-app/naro-backend/app/models/appointment.py:41).  
**Durum:** `ALIGNED`  
**Öncelik:** `P0 korunacak`  
**Risk:** Orta; Faz 8 FE refactor sırasında eski copy geri gelebilir.  
**Faz 8 aksiyonu:** Naming gate commit kabulünde çalışmalı.  
**Faz 9/10 aksiyonu:** UI copy smoke: "ek ödeme" yerine "kapsam/parça onayı" ve "final fatura" dili doğrulanmalı.

### OM-16 — Assignment semantiği genel olarak doğru yönde

**Kural:** `preferred_technician_id` müşteri niyeti/hedef usta; `assigned_technician_id` gerçek assignment.  
**Kod kanıtı:** [repositories/case.py](/home/alfonso/sanayi-app/naro-backend/app/repositories/case.py:201) assigned technician worklist yalnız `assigned_technician_id` okuyor. [engine.ts](/home/alfonso/sanayi-app/packages/mobile-core/src/tracking/engine.ts:1305) FE hâlâ `preferred_technician_id` ile `assigned_technician_id` birlikte "hasAssignedService" gibi yorumluyor.  
**Durum:** `PARTIAL`  
**Öncelik:** `P1`  
**Risk:** Backend tarafı iyi; FE tracking tarafında preferred service "shortlist" gibi gösterilebilir ama gerçek assignment hissi verirse kullanıcı yanıltılır.  
**Faz 8 aksiyonu:** Tracking engine BE response'a indirildiğinde bu yorum da temizlenmeli.  
**Faz 9/10 aksiyonu:** Case profile'da `preferred` ve `assigned` ayrı etiketlenmeli.

### OM-17 — Pool/match altyapısı temel olarak doğru, ama coverage kalitesi henüz sınırlı

**Kural:** Uyumlu ustalar açıklanabilir read-model ile öne çıkmalı; match offer/notification/assignment değildir.  
**Kod kanıtı:** [case_matching.py](/home/alfonso/sanayi-app/naro-backend/app/services/case_matching.py:338) score cap var; [case_matching.py](/home/alfonso/sanayi-app/naro-backend/app/services/case_matching.py:322) city/district reason scoring başlıyor. Pool repository [repositories/case.py](/home/alfonso/sanayi-app/naro-backend/app/repositories/case.py:145) service_domain/city coverage'i V1.1 yorumunda bırakmış.  
**Durum:** `PARTIAL`  
**Öncelik:** `P1`  
**Risk:** Ürün omurgasını kırmıyor, ama "vaka ile uyumlu usta" değerini zayıflatır.  
**Faz 8 aksiyonu:** F15 typed location düzeltmesiyle match nedeni daha sağlamlaşır.  
**Faz 9/10 aksiyonu:** Customer home ve usta kartlarında "Bu vakaya uygun" rozetinin canlı match verisiyle görünmesi gerekir.

### OM-18 — Backend baseline Faz 7 sonunda iyi durumda

**Kural:** Büyük refactor'da güvenli ilerlemek için backend test/lint baseline yeşil kalmalı.  
**Kod kanıtı:** Faz 7 commitinde full backend suite `468 passed, 18 skipped`; `ruff check app tests` temiz; naming gate temiz olarak kapandı.  
**Durum:** `ALIGNED`  
**Öncelik:** `P0 korunacak`  
**Risk:** Faz 8 iki app ve backend'e dokunacağı için baseline kolay bozulabilir.  
**Faz 8 aksiyonu:** BE commit sonrası `uv run pytest tests/ -v --tb=short` ve `uv run ruff check app tests`; FE commit sonrası ilgili `tsc` gate'leri koşmalı.  
**Faz 9/10 aksiyonu:** Cihaz smoke runbook Faz 10A'da uygulanmalı.

## Faz 8 Plan Revizyonu

Faz 8 mevcut haliyle doğru ama şu iki madde kesin eklenmeli:

1. **Notification no-match fix:** `notify_case_to_technician` match yokken 500 üretmemeli; `match_id` nullable kalmalı. Bu, "vakayı bildir" ana ürün akışı için P0.
2. **Towing offer explicit guard:** Pool feed towing'i dışlıyor ama offer endpoint explicit kapalı değil. `case.kind == TOWING` için `422 tow_offer_disabled` guard eklenmeli. Tow offer market future mode ise ayrı contract/feature flag olmalı.

Faz 8'de kalması gerekenler:

- F15 `request_draft` matching kullanımını kaldır.
- F17 customer showcase revoke endpoint'i ekle.
- F18 BE `case_dossier.milestones/tasks` ekle.
- F18 FE mobile tracking engine'i BE workflow response presentation layer'a indir.
- Composer §2.2 düzeltmeleri yap.

Faz 8'de karar gerektiren tek sert nokta:

- `TIMEOUT_CONVERTED_TO_POOL` aktif davranış mı, legacy/future state mi? Ürün odaklı öneri: V1 dispatch modelinde normal pool/offer'a dönmemeli; "aday bulunamadı / tekrar dene / destek" davranışına çevrilmeli veya en azından kullanıcı-facing "havuza düştü/teklif" dili kaldırılmalı.

## Faz 9 Scope Kesinleşti

Faz 9 artık sadece "dossier bağlayalım" değil, iki app'in vaka sözleşmesine bağlanmasıdır:

- `useCaseDossier` hook ve shared/domain schema.
- Customer `case_profile` ekranı: vaka oluşturma detayları, araç snapshot, evidence/documents, matches, notifications, offers, appointment, assignment, approvals, tow/payment snapshot, timeline.
- Service `case_profile` ekranı: pool technician için PII-safe, assigned technician için genişletilmiş detail.
- Service app `workflowBlueprintFor` kaldırma veya backend field fallback'e indirme.
- Customer home/usta kartlarında canlı `CaseTechnicianMatch` rozetleri.
- Tow fallback copy/state cleanup, Faz 8'de çözülmediyse.

## Faz 10A Scope Kesinleşti

Faz 10A tersine audit + cihaz smoke olmalı:

- Offer'sız appointment 422.
- "Vakayı bildir" match olmadan çalışır, assignment üretmez.
- Immediate tow pool/feed/offer'a düşmez.
- Scheduled tow payment-window dispatch modelinde kalır.
- Case dossier customer/service redaction doğru.
- Composer dört akışta geri dönme, düzeltme ve review çalışır.
- "Ek ödeme / bid / direct request" aktif UI'da görünmez.

## Son Karar

Faz 8'e geçilebilir; fakat Faz 8 brief'i bu audit'e göre güncellenmeden kod başlanmamalı. En önemli fark şu:

> Faz 8 yalnız "planlanan üç BE + üç FE düzeltmesi" değildir; `notify_case_to_technician` no-match bug'ı ve towing offer explicit guard da aynı omurga paketinin parçasıdır.

