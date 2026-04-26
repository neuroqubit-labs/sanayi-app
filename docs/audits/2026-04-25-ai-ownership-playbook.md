# AI ile Geliştirilen Naro İçin Sistem Hakimiyeti Playbook

**Tarih:** 2026-04-25  
**Amaç:** Çok hızlı AI destekli geliştirme sonrası projeyi ürün, iş mantığı, backend enforcement, frontend davranış ve test açısından denetlenebilir hale getirmek.  
**Kural:** Yeni feature yazmadan önce sistemin omurgasını anlayacağız; kodu ezberlemeyeceğiz, kuralları ve akışları sahipleneceğiz.

## 1. Ana Prensip

Her kritik ürün kararı şu zinciri geçmelidir:

```text
Ürün kuralı
→ backend enforcement
→ DB/state karşılığı
→ frontend davranışı
→ test/edge-case kanıtı
```

Bir karar sadece UI metninde kalıyorsa kural değildir. Kural backend'de zorunlu olmalı, DB/state ile izlenebilmeli ve testte kırılmaya çalışılmalıdır.

## 2. Proje İçin En Kritik Sorular

### A. Vaka Omurgası

- `ServiceCase` tam olarak neyi temsil ediyor?
- Hangi vaka türleri var: bakım, arıza, hasar, çekici?
- Her vaka türünün subtype tablosu veya typed detay modeli nerede?
- Ortak vaka alanları ile türe özgü alanlar nerede ayrılıyor?
- Bir vaka ne zaman “müşteri talebi”, ne zaman “ustanın işi”, ne zaman “tamamlanmış kayıt” oluyor?
- Vaka durumları hangi enum/state machine ile yönetiliyor?
- Aynı state farklı ekranlarda farklı yorumlanıyor mu?
- Eski `request_draft` alanı kaynak mı, sadece audit snapshot mı?
- Vaka kapatma, iptal, arşiv ve public showcase aynı lifecycle içinde mi duruyor?

### B. Çekici Akışı

- Çekici de canonical `ServiceCase(kind=towing)` olarak mı başlıyor?
- Immediate ve scheduled çekici aynı kuralları mı kullanıyor?
- Dispatch ne zaman başlar?
- Online ödeme alınmadan dispatch başlatabilecek herhangi bir yol kaldı mı?
- Planlı çekicide ödeme penceresi nasıl açılıyor?
- Teknik olarak çekici adayı nasıl bulunuyor: DB, Redis presence, radius ladder?
- Çekici bulunamazsa vaka hangi state'e geçiyor?
- Kullanıcı aynı anda birden fazla aktif çekici talebi açabiliyor mu?
- Çekici konum, OTP, evidence ve teslim aşamaları aynı lifecycle tarafından mı korunuyor?

### C. Ödeme Mantığı

- Para akışı kimden kime gidiyor?
- Naro hangi modelde duruyor: marketplace/submerchant mi, standard merchant mı?
- Çekici, kampanya, servis approval ödemeleri aynı `PaymentCore` modelinden mi geçiyor?
- Online ödeme zorunlu akışlar hangileri?
- Offline ödeme izinli akışlar hangileri?
- UI amount gönderse bile backend amount'u yeniden hesaplıyor mu?
- Webhook duplicate/replay halinde ikinci capture/dispatch oluşabilir mi?
- 3DS terk edilirse attempt ne oluyor?
- Geç gelen PSP success callback abandoned attempt için dispatch başlatabilir mi?
- Prod/staging'de mock PSP veya standard sandbox açılabilir mi?
- PAN/CVV hiçbir DTO/log/model alanına girmiş mi?

### D. Servis / Usta İş Mantığı

- Servis hangi durumda teklif verebilir?
- Servis ödeme hesabı yoksa hangi aksiyonlar backend'de bloklanıyor?
- App bu blokları anlaşılır CTA ile gösteriyor mu?
- Randevu kabulü, teklif, çekici online olma ve kampanya yayınlama aynı payment-account gate'e bağlı mı?
- Servis offline ödeme seçimini kendi mi yapıyor, müşteri mi seçiyor?
- Usta final raporu, customer approval ve review akışı tek canonical closure hattında mı?

### E. Yetki ve Güvenlik

- Customer yalnız kendi vakalarını görebiliyor mu?
- Technician yalnız atandığı, teklif verdiği veya havuzda izinli olduğu vakaları görebiliyor mu?
- Public profile endpoint PII sızdırıyor mu?
- Media/evidence private asset public showcase'a doğrudan sızıyor mu?
- Payment webhook signature doğrulaması prod'da zorunlu mu?
- WebSocket/live tracking auth modeli güvenli mi?
- High-risk ayarlar için step-up auth planlandı mı?

### F. Mock / Canlı Veri Ayrımı

- Aktif müşteri/servis ekranlarında mock store import'u kaldı mı?
- `api.mock.ts`, `store.mock.ts`, fixture dosyaları public barrel'dan çıkmış mı?
- Demo fixture gerçek akışa yanlışlıkla bağlanıyor mu?
- `PRIMARY_TECHNICIAN_ID`, `DEFAULT_VEHICLE_ID`, sample dispatch id gibi kaçışlar aktif route'ta var mı?

### G. Frontend Sözleşmesi

- Frontend enumları backend enumlarıyla birebir mi?
- Ekran bir backend state'i “yaklaşık” tahmin ediyor mu?
- Aynı hata farklı ekranlarda ham `API error` olarak mı gösteriliyor?
- Payment/tow/case query invalidation doğru mu?
- App restart sonrası aktif akış doğru ekrana dönebiliyor mu?
- Bir CTA gerçekten backend state'ine göre mi aktif/pasif?

## 3. AI'ye Verilecek Standart Audit Prompt'ları

Bu prompt'ları tek tek Claude/Codex'e verebilirsin. Her prompt'un çıktısı kısa bulgu listesi + risk seviyesi + önerilen patch planı olmalı.

### Prompt 1 — Akış Haritası Çıkar

```text
Bu repo içinde [AKIŞ ADI] akışını uçtan uca incele.

Şunları çıkar:
1. Kullanıcı hangi ekrandan başlıyor?
2. Hangi frontend component/hook/API çağrıları kullanılıyor?
3. Hangi backend endpoint'leri çağrılıyor?
4. Hangi service/domain modülleri iş kuralını yürütüyor?
5. Hangi DB modelleri/state enumları değişiyor?
6. Başarılı akışın state geçişleri neler?
7. Başarısızlık/iptal/retry edge case'leri neler?
8. Testlerde bu akışın hangi kısmı garanti ediliyor?

Çıktıyı şu formatta ver:
- Dosya haritası
- State haritası
- Ürün kuralı → backend enforcement tablosu
- Açık riskler
- İlk 5 düzeltme önerisi
```

### Prompt 2 — Ürün Kuralı Kodda Enforce Ediliyor mu?

```text
Şu ürün kuralını denetle: "[KURAL]"

Örnek: "Çekici online ödeme olmadan dispatch başlatamaz."

Şunları kontrol et:
1. Bu kural backend'de nerede enforce ediliyor?
2. UI bu kuralı sadece gösteriyor mu, yoksa backend gerçekten blokluyor mu?
3. Bu kuralı bypass edebilecek endpoint, worker, legacy route veya mock flow var mı?
4. Race condition veya duplicate request halinde kural bozulur mu?
5. Bu kuralı kırmaya çalışan test var mı?

Sonuç:
- PASS / PARTIAL / FAIL
- Kanıt dosyaları
- Risk seviyesi
- Gerekirse patch planı
```

### Prompt 3 — State Machine Drift Audit

```text
[STATE MACHINE ADI] için enumları, backend transition logic'i, frontend schema'ları ve UI presentation mapping'i karşılaştır.

Kontrol et:
1. Backend enum değerleri ve frontend enum değerleri aynı mı?
2. Backend transition graph ile UI varsayımları aynı mı?
3. DB migration enum değerleri güncel mi?
4. Eski state adları veya unreachable state var mı?
5. Her terminal state açık mı?
6. Yeni eklenen state için snapshot, schema, UI ve test güncellenmiş mi?

Çıktı:
- Drift tablosu
- Kırılabilecek ekranlar
- Test eksiği
- Minimal düzeltme planı
```

### Prompt 4 — Mock Sızıntısı Audit

```text
Aktif production akışlarında mock/fixture sızıntısı ara.

Kapsam:
- naro-app
- naro-service-app
- packages/*
- backend route/service worker path'leri

Aranacaklar:
- mock store import
- api.mock/store.mock public export
- DEFAULT_* fallback
- PRIMARY_TECHNICIAN_ID
- hardcoded user/vehicle/case id
- mockDelay
- sample dispatch
- UI'da gerçekmiş gibi görünen fixture

Çıktı:
- Aktif route'ta riskli kullanım
- Sadece dev fixture olanlar
- Gate/script önerisi
```

### Prompt 5 — Ödeme Güvenliği Audit

```text
Payment Core ve ilgili tow/service approval ödeme akışlarını güvenlik açısından incele.

Kontrol et:
1. UI amount authoritative kabul ediliyor mu?
2. Backend server-side amount/quote yeniden hesaplıyor mu?
3. PSP callback signature zorunlu mu?
4. Duplicate/replay callback ikinci işlem doğurur mu?
5. Abandoned/cancelled 3DS attempt geç success alırsa ne olur?
6. PAN/CVV/token/log sızıntısı var mı?
7. Prod/staging mock veya standard sandbox ile açılabilir mi?
8. Marketplace/submerchant key prod gate'i var mı?
9. Offline ödeme ile online komisyon ayrımı doğru mu?

Çıktı:
- Kritik bulgular
- Orta riskler
- Test eksiği
- Finansal/hukuki karar gerektiren açık noktalar
```

### Prompt 6 — Yetki / Ownership Audit

```text
[AKIŞ veya ENDPOINT GRUBU] için yetki ve ownership kontrolü yap.

Kontrol et:
1. Customer kendi kaynağı dışında veriye erişebilir mi?
2. Technician sadece ilgili/atanmış/izinli case'e erişiyor mu?
3. Public endpoint PII döndürüyor mu?
4. Admin veya worker path kullanıcı kontrolünü bypass ediyor mu?
5. Query filtreleri deleted/archived/private kayıtları dışlıyor mu?
6. Testler 403/404 edge case'lerini kapsıyor mu?

Çıktı:
- Endpoint tablosu
- Kullanıcı rolü
- Ownership kontrol noktası
- Eksik test/düzeltme
```

### Prompt 7 — Test Yeterliliği Audit

```text
[MODÜL] için testlerin gerçekten iş kuralını garanti edip etmediğini incele.

Ayır:
- Sadece type/shape testi
- Happy path testi
- Edge case testi
- Race/idempotency testi
- Security/permission testi

Eksik kalan ürün kurallarını listele.
Her eksik için 1 test öner:
- test adı
- fixture setup
- beklenen sonuç
```

## 4. Akış İnceleme Şablonu

Her kritik akış için aşağıdaki kartı doldur.

```md
## Akış: [Ad]

### Ürün Amacı
- Kullanıcı ne yapmak istiyor?
- İş açısından başarı ne?

### Aktörler
- Customer:
- Technician:
- Backend worker:
- PSP/harici servis:

### Başlangıç State
- Case:
- Payment:
- Approval:
- Tow:

### Bitiş State
- Başarılı:
- İptal:
- Hata:
- Retry:

### Dosya Haritası
- Customer UI:
- Service UI:
- Backend route:
- Backend service:
- Model/schema:
- Worker:
- Test:

### Ürün Kuralları
| Kural | Backend enforcement | UI davranışı | Test var mı? | Risk |
| --- | --- | --- | --- | --- |

### Edge Case'ler
| Edge case | Beklenen davranış | Kodda nerede? | Test var mı? |
| --- | --- | --- | --- |

### Açık Sorular
- 

### Karar
- PASS / PARTIAL / FAIL
- Sonraki patch:
```

## 5. Ürün Kuralı Matrisi

Bunu projenin canlı karar defteri gibi kullan.

| Kural | Zorunlu mu? | Backend source | Frontend source | Test | Durum |
| --- | --- | --- | --- | --- | --- |
| Çekici online ödeme olmadan dispatch başlamaz | Evet | `payment_core`, tow routes | Tow payment/tracking | payment/tow tests | Kontrol edildi |
| Kampanya online ödeme zorunlu | Evet | Payment Core + campaign gate | Kampanya UI | Eksik | Açık |
| Servis teklif/fatura online önerilen, kart/nakit izinli | Evet | approval payment flow | approval sheets | Kısmi | Kısmi |
| Servis aktif iş için ödeme hesabı gerekli | Evet | offers/appointments/tow availability gate | service app CTA | Kısmi | Kontrol edildi |
| Customer başkasının vakasını göremez | Evet | case/tow route ownership | route guards | Eksik kontrol | Açık |
| Public profil PII göstermez | Evet | public profile helpers | profile UI | Eksik kontrol | Açık |

## 6. İlk 10 Audit Görevi

Öncelik sırası bu olmalı.

### 1. Canonical Case Architecture Audit

Amaç: `ServiceCase + subtype` modelinin gerçekten tek omurga olup olmadığını anlamak.

Sor:
- Case create hangi endpointlerden yapılabiliyor?
- Eski modal/mock route hâlâ case yaratıyor mu?
- `request_draft` source-of-truth gibi kullanılıyor mu?
- Subtype tablosu olmayan tür var mı?

### 2. Case State Machine Audit

Amaç: Case status ile approval/tow/payment state'leri çakışıyor mu?

Sor:
- `ServiceCase.status` hangi modüllerde set ediliyor?
- Aynı status iki farklı anlamda kullanılmış mı?
- Terminal state sonrası aksiyon yapılabiliyor mu?

### 3. Tow Lifecycle Audit

Amaç: Immediate/scheduled çekici ödeme, dispatch, OTP, evidence ve teslim akışı tutarlı mı?

Sor:
- `payment_required → searching` sadece ödeme sonrası mı?
- `scheduled_waiting` için payment window doğru mu?
- `loading/delivered` evidence/OTP gate ile korunuyor mu?
- Cancel stage matrix finansal davranışı doğru mu?

### 4. Payment Core Audit

Amaç: Çekici, approval ve future campaign ödeme çekirdeği ortak mı?

Sor:
- `tow_case` ve `case_approval` callback path ayrımı doğru mu?
- Duplicate callback idempotent mi?
- UI amount hiçbir yerde authoritative değil mi?
- Marketplace/submerchant gate prod'da zorunlu mu?

### 5. Service Payment Account Gate Audit

Amaç: Servis aktif iş yapmadan önce ödeme hesabı kuralı tutarlı mı?

Sor:
- Offer, appointment approve, tow online, campaign publish aynı gate'i kullanıyor mu?
- Service app her gate hatasını anlaşılır CTA ile gösteriyor mu?
- Profil düzenleme gereksiz yere bloklanıyor mu?

### 6. Approval Flow Audit

Amaç: Parts/invoice/completion approval kavramları karışmış mı?

Sor:
- Parts ve invoice ödeme gerektirebilir mi?
- Completion ödeme değil kapanış mı?
- Offline payment `offline_recorded`, online payment callback sonrası `paid` oluyor mu?
- Approval amount pending olduktan sonra değiştirilebiliyor mu?

### 7. Public Profile / Showcase Audit

Amaç: Usta profilinde gösterilen işler güvenli ve izinli mi?

Sor:
- İki taraf onayı olmadan showcase publish oluyor mu?
- PII snapshot'a giriyor mu?
- Revocation public endpointten anında düşüyor mu?
- Media public copy mi, private asset mi?

### 8. Mock Exit Audit

Amaç: Aktif müşteri/servis akışlarında mock kalmadığını doğrulamak.

Sor:
- `api.mock.ts`, `store.mock.ts` aktif barrel'dan export ediliyor mu?
- Active route'larda fixture import var mı?
- service/live gate kapsamı yeterli mi?

### 9. Mobile Resume / Active Flow Audit

Amaç: Kullanıcı app'ten çıkıp dönünce aktif süreç kayboluyor mu?

Sor:
- Aktif çekici varsa tüm entrypoint'ler aynı case'e yönleniyor mu?
- Payment required/preauth failed/searching/accepted state'leri doğru resume oluyor mu?
- Customer ve service app cache invalidation yeterli mi?

### 10. Security / Privacy Audit

Amaç: Üretim öncesi ödeme, PII ve token sızıntısı risklerini kapatmak.

Sor:
- Logs içinde token, auth header, PSP token, phone/email, IBAN sızıntısı var mı?
- Public endpointler private alan döndürüyor mu?
- Webhook signature zorunlu mu?
- Step-up auth gerektiren alanlar listelendi mi?

## 7. Günlük Çalışma Ritmi

Her gün bir akış seç. Yeni feature yazmadan önce 30-60 dakika bu kartı doldur.

```text
Bugünün akışı:
Ürün kuralı:
Backend enforcement:
DB/state:
Frontend ekran:
Test:
Kırılabilecek edge case:
Karar:
```

Gün sonunda sadece üç sonuçtan biri olmalı:

- `PASS`: kural tutarlı, test var.
- `PARTIAL`: çalışıyor ama test/gate/edge eksik.
- `FAIL`: ürün kararı kodda garanti değil.

## 8. Kırmızı Bayraklar

Bu işaretleri görürsen yeni feature yazma; önce temizlik yap.

- Aynı kavrama iki farklı isim verilmiş.
- Aynı kural frontend ve backend'de farklı yazılmış.
- Worker bir state'i route'tan farklı şekilde değiştiriyor.
- UI “ödeme alındı” diyor ama backend payment state farklı.
- Mock data canlı ekranı besliyor.
- Endpoint ownership kontrolünü route başında yapmıyor.
- Test sadece schema parse ediyor, iş kuralını kırmayı denemiyor.
- Bir migration enum eklemiş ama frontend schema güncellenmemiş.
- `TODO prod` ödeme/auth/PII dosyasında duruyor.
- “Şimdilik” diye yazılan kod aktif path'te kalmış.

## 9. Senin Kişisel Odak Alanın

Kodun her dosyasını ezberleme. Şunları bil:

1. Vaka ne demek?
2. Vaka state'leri nasıl ilerliyor?
3. Para nereden çıkıp nereye gidiyor?
4. Dispatch ne zaman başlar?
5. Servis ne zaman iş alabilir?
6. Public'e ne gösterilir, ne gösterilmez?
7. Mock nerede biter, canlı veri nerede başlar?
8. Test hangi iş kuralını garanti ediyor?

Bu sekiz soruya rahat cevap veriyorsan projenin sahibisin.

