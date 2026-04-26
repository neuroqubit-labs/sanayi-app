# Naro Vaka Omurgası — Genişletilmiş Ürün ve Sistem Dokümanı

**Tarih:** 2026-04-26  
**Statü:** Genişletilmiş ürün/sistem taslağı  
**Orijinal anlatı:** [naro-vaka-omurgasi.md](naro-vaka-omurgasi.md)  
**Sözlük:** [naro-domain-glossary.md](naro-domain-glossary.md)  
**Amaç:** "Vaka" kavramını ürün dili, iş mantığı, veri modeli, ödeme/eşleşme kuralı ve audit soruları ile daha eksiksiz hale getirmek. Bu doküman orijinali değiştirmez; orijinal PO anlatısını sistem kararlarına çeviren ikinci katmandır.

## 0. Kısa Özet

Naro'da **vaka**, bir aracın etrafında açılan ve yönetilmesi gereken platform içi süreçtir.

Canonical vaka türleri:

1. `maintenance` — bakım / planlı hizmet / isteğe bağlı iyileştirme
2. `breakdown` — arıza / semptom / mekanik-elektrik sorun
3. `accident` — hasar / kaza / sigorta-kasko ilişkili olay
4. `towing` — çekici / yol yardım / taşıma süreci

Temel ilke:

> Araçsız vaka olmaz. Müşteri tarafından başlatılan her süreç, bir araçla ilişkilendirilir; vaka havuz, teklif, randevu, ödeme, servis süreci, teslim ve puanlama boyunca tek omurgada yaşar.

Çekici özel cümle:

> Her çekici isteği bir vakadır. Acil çekici de eşleşmenin canlı yapılabildiği bir çekici vakasıdır.

## 1. Vaka Nedir?

Vaka, sadece "form kaydı" değildir. Vaka:

- kullanıcının bir araç için başlattığı gerçek ihtiyacı,
- bu ihtiyacın servisler/çekiciler tarafından değerlendirilebilir halini,
- eşleşme öncesi bilgi toplama sürecini,
- eşleşme sonrası iki taraflı takip sürecini,
- ödeme/approval kararlarını,
- kapanış, puanlama ve geçmiş kaydı üretimini,
- gerektiğinde public usta profiline yansıyabilecek doğrulanmış iş çıktısını

taşıyan ana iş nesnesidir.

Vaka şu değildir:

- yalnızca frontend wizard state'i,
- yalnızca servis havuz kartı,
- yalnızca ödeme kaydı,
- yalnızca chat/thread,
- yalnızca sigorta dosyası,
- yalnızca randevu.

Bunların bazıları vakanın alt ilişkileri olabilir.

## 2. Canonical Veri Omurgası

Mevcut backend modeline göre merkez entity:

- `ServiceCase`

Türe özgü extension tabloları:

- `MaintenanceCase`
- `BreakdownCase`
- `AccidentCase`
- `TowCase`

Bu modelin anlamı:

| Katman | Görev |
| --- | --- |
| `ServiceCase` | Ortak vaka shell'i: müşteri, araç, tür, status, assigned technician, workflow, request snapshot |
| subtype tablo | Türe özgü alanlar: hasar detayı, arıza semptomu, bakım kategorisi, çekici konum/rota |
| `Vehicle` + snapshot | Vaka açıldığı andaki araç bilgisi; sonradan araç güncellense bile vaka geçmişi bozulmaz |
| approvals/tasks/events/thread/media | Vaka sürecini ve kararlarını taşır |
| payment orders/attempts | Ödeme ledger'ı; vaka veya approval ile ilişkilidir |

### 2.1 Source of Truth Kuralı

`request_draft` sadece immutable audit/snapshot olarak düşünülmelidir.

Source-of-truth:

- ortak alanlar için `service_cases`
- türe özgü alanlar için subtype tablolar
- ödeme için `payment_orders` / `payment_attempts`
- çekici canlı operasyon için `tow_case`, dispatch, settlement, live location kayıtları
- approval kararları için `case_approvals`

Audit sorusu:

> Herhangi bir ekran veya backend service hâlâ `request_draft` içinden kritik karar veriyor mu?

Eğer evet ise, bu bir teknik borç veya geçici compatibility olabilir; canonical modele taşınmalıdır.

### 2.2 Vaka Servisi Tek Sözleşmesi

Vaka servisinin bütün uygulamalar için tek bir sözleşmesi olmalıdır. Bu sözleşme yalnız backend DTO'su değildir; ürün, veri modeli, iki mobil uygulama ve testlerin birlikte uyması gereken contract'tır.

> `case service contract`: Bir vakanın oluşturulmasından kapanışına kadar hangi alanların source-of-truth olduğu, hangi state'in ne anlama geldiği, hangi aktörün hangi aşamada ne yapabileceği ve hangi ekranın hangi domain ilişkisini göstereceği tek yerde tanımlanır.

Bu contract şu katmanları kapsar:

| Katman | Source-of-truth | Sözleşme kuralı |
| --- | --- | --- |
| Case shell | `service_cases` | `kind`, `vehicle_id`, customer, general status, assignment ve güvenli özet ortak üst sınıftır |
| Type detail | subtype tabloları | Maintenance/breakdown/accident/towing kendi typed alanlarını taşır; UI draft bu alanların yerine geçmez |
| Vehicle snapshot | case create snapshot | Vaka açıldığı andaki araç bilgisi dosyanın parçasıdır; canlı vehicle değişince eski vaka bozulmaz |
| Case profile/dossier | canonical case detail response | Vaka profili oluşturma sırasında girilen tüm detayları, kanıtları, linked tow/insurance ve teklif/süreç özetini gösterir |
| Matching candidates | `case_technician_matches` read-model | Uyumlu usta kaydı offer, assignment veya notification değildir; bunların öncesindeki açıklanabilir uygunluk katmanıdır |
| Pool/notification | match + visibility/intent | Havuz ve "vakayı bildir" aynı matching contract'tan beslenir; paralel mini bildirim sistemi kurulmaz |
| Offer | `case_offers` | Bakım/arıza/hasar için randevunun ön şartıdır |
| Appointment | appointment + accepted offer | Teklif olmadan bakım/arıza/hasar appointment oluşturulmaz; appointment eşleşme öncesi son adımdır |
| Assignment | service case assignment / accepted offer decision | Gerçek servis süreci ancak eşleşme kesinleşince başlar; erken seçili usta gerçek assignment gibi okunmaz |
| Tow lifecycle | `tow_cases` + dispatch/settlement/location | Çekici operasyon kararları `tow_stage` üzerinden yürür; `ServiceCase.status` sadece shell state'tir |
| Payment | `payment_orders` / `payment_attempts` | UI amount authoritative değildir; çekici/kampanya online zorunlu, servis ödemeleri online önerilen/offline izinlidir |
| Process tracking | canonical process pattern | Eşleşme sonrası ortak minimal adımlar + tür özel opsiyonel adımlar tek pattern kaynağından türemelidir |
| Approval | `case_approvals` | Parts/invoice kapsam/fatura onayıdır; sürpriz "ek ödeme" gibi sunulmaz |
| Completion/showcase | completion approval + showcase snapshot | Kapanış, puanlama ve public vitrin izinleri ayrı ama vaka sonucuna bağlı güven sinyalidir |

Contract'ın beslediği ana yüzeyler:

- **Hızlı menü/composer:** bakım, arıza, hasar ve çekici typed view-model ile başlar, submit anında canonical case payload'a map edilir.
- **Ana sayfa:** aktif vaka varsa "Bu vakan için uygun ustalar" bandı canlı match read-model'den gelir; mock/default vehicle önerisi kullanılmaz.
- **Keşif/usta profili:** aktif vaka varsa CTA "Vakayı bildir / Teklif iste" olur; offer'sız randevuya gitmez.
- **Vaka profili:** karmaşık aksiyon ekranı değil, vaka dosyasıdır. Aksiyonlar profilin altından doğru flow'a açılır.
- **Servis havuzu:** kaba provider map'i tek başına yeterli değildir; match record filtre/sıralama için temel olur.
- **Servis inbox:** "vakayı bildir" intent'i gerçek teklif/reddet aksiyonuna bağlanır.
- **Süreç ekranları:** yalnız eşleşme sonrası pattern/tow lifecycle üzerinden çalışır.

Contract drift örnekleri:

- Frontend `offer_id` göndermeden appointment submit ediyorsa contract kırılmıştır.
- Backend `request_draft` içinden payment, matching, dispatch veya appointment kararı veriyorsa contract kırılmıştır.
- Customer app home `suggestions: []` veya mock `DEFAULT_VEHICLE_ID` ile uygun usta gösteriyorsa contract kırılmıştır.
- Service app pool yalnız `provider_type` ile vaka gösteriyor ve match kaydı kullanmıyorsa contract eksiktir.
- Vaka profili subtype detaylarını değil request/draft kartlarını gösteriyorsa contract gevşemiştir.
- Çekici stage'i `case.status` üzerinden tahmin ediliyorsa contract yanlış okunmuştur.

Uygulama kuralı:

> Vaka servis sözleşmesi değiştiğinde backend schema/service, customer app canonical case adapter, service app live jobs/pool adapter, test fixture'ları ve smoke senaryoları aynı değişiklikte güncellenmelidir.

Bu yüzden "vaka" ile ilgili yeni feature'larda önce şu soru sorulur:

1. Bu veri contract'ın hangi katmanına ait?
2. Source-of-truth hangi tablo/response?
3. Customer app bunu aynı anlamla mı gösteriyor?
4. Service app bunu aynı anlamla mı gösteriyor?
5. Backend bunu enforce ediyor mu?
6. Test bu contract'ı kırmaya çalışıyor mu?

### 2.3 Vaka Altı Akış / Composer UX Contract

Vaka altı yönetimler, yani maintenance/breakdown/accident/towing composer akışları, tek vaka sözleşmesinin kullanıcıyla konuşan tarafıdır. Bu yüzden sadece "hangi alanları topluyoruz?" sorusuyla tasarlanamaz; "kullanıcı bu olayı zihninde nasıl hatırlıyor ve hangi sırayla rahat anlatır?" sorusuyla tasarlanmalıdır.

Ana ilke:

> Kullanıcının zihnini boşaltmasına yardım et. Basitten zora, somuttan soyuta, seçimden açıklamaya, güvenlikten detaya ilerle.

Composer anti-pattern'leri:

- İlk adımda uzun açıklama istemek.
- Kullanıcının bilmediği teknik terimleri ilk karar haline getirmek.
- Aynı konuyu iki farklı adımda tekrar sormak.
- Bir adım ileri gidip sonra önceki kararı boşa çıkaran geri dönüşler yaratmak.
- Bakım/arıza içinde çekiciyi ara promise veya gizli otomasyon gibi göstermek.
- Hasar gibi stresli akışlarda güvenlik/olay hatırlatma yapmadan evrak veya detay istemek.
- Review ekranında kullanıcının ilk kez gördüğü yeni kararlar çıkarmak.

Önerilen sorgulama düzeni:

| Vaka türü | İlk sorular | Orta adımlar | Son kararlar |
| --- | --- | --- | --- |
| Bakım | Araç, km/son bakım, bakım niyeti/kategorisi | Kapsam, tercih, medya gerekiyorsa kanıt | Zaman/teslim tercihi, çekici/taşıma gerekiyor mu, review |
| Arıza | Semptom, araç çalışıyor mu/yürür mü, aciliyet | Ses/video/fotoğraf, konum/zaman, servis beklentisi | Çekici istiyor musun, review |
| Hasar | Güvenlik, kaza/olay tipi, zaman/yer | Hasar bölgesi/şiddeti, fotoğraf/evrak, sigorta/tutanak | Ek açıklama, çekici gerekiyorsa yönlendirme, review |
| Çekici | Pickup, dropoff, şimdi/planlı, araç durumu | Tavan ücret/ödeme, ekipman sadece gerekirse | Çağır/planla, tracking |

Bu akışlarda açıklama alanı değerli ama erken sorulduğunda yük haline gelir. Açıklama genellikle kullanıcının önce kategoriyi, yeri, zamanı, durumu ve kanıtları düşündükten sonra daha iyi yazdığı bir adımdır.

Backend etkisi:

- Composer view-model'leri typed olmalı; düz `request_draft` UI state'i source-of-truth olmamalı.
- Submit mapper'ları kullanıcının adım sırasını değil, canonical subtype alanlarını üretmeli.
- Required field/attachment matrix kullanıcıya son submit'te sürpriz çıkarmaz; eksik bilgi adım içinde anlaşılır.
- Review ekranı yeni soru sormaz; yalnız toplanan kararları doğrulatır.

UX kabul kriteri:

> Kullanıcı her adımda "neden bunu soruyor?" sorusunun cevabını hisseder. Akış, kullanıcının olayı hatırlamasını kolaylaştırır; form doldurma hissini azaltır.

## 3. Vaka Türleri ve Ürün Farkları

### 3.1 Bakım (`maintenance`)

Bakım, aracın sorun çıkarmadan devam etmesi veya kullanıcının isteğe bağlı hizmet alması için açılır.

Örnekler:

- periyodik bakım
- yağ / filtre
- lastik değişimi
- akü
- klima
- fren
- detay temizlik
- cam filmi
- kampanya/paket hizmetleri

Bakımın karakteri:

- acil değildir,
- planlıdır,
- teklif veya kampanya ile net fiyatlanması beklenir,
- açıklama ve görsel gerekebilir ama hasar kadar zorunlu/kanıt odaklı değildir,
- kullanıcı fiyat, zaman, vale/pickup, servis güveni üzerinden karar verir.

Canonical eşleşme:

1. kullanıcı bakım vakası oluşturur,
2. vaka havuza düşer veya belirli servise bildirilir,
3. servis teklif verir,
4. müşteri teklifi kabul eder ve ödeme yöntemini seçer,
5. randevu/appointment netleşir,
6. servis onayladığında vaka servis sürecine bağlanır.

### 3.2 Arıza (`breakdown`)

Arıza, aracın davranışında, performansında veya güvenilirliğinde sorun olduğunda açılır.

Örnekler:

- motor sesi
- elektrik arızası
- uyarı lambası
- yürür ama riskli araç
- çalışmayan araç
- yolda kalmaya yakın durum
- rektifiye gibi ağır tamir ihtimali

Arızanın karakteri:

- bilgi belirsizliği yüksektir,
- kullanıcı çoğu zaman problemi adlandıramaz,
- semptom, video/ses, yürürlük durumu ve çekici ihtiyacı önemlidir,
- teklif kapsamı tahmine dayanabilir,
- servis teşhis sonrası kapsamı netleştirir.

Canonical eşleşme:

- Hasar ve bakım gibi havuz/teklif modelinden ilerler.
- Doğrudan belirsiz fiyatla randevu istenmez.
- Eğer kullanıcı belirli bir ustayı beğenirse, "vakayı bildir" ile ustaya sinyal gönderir; usta teklif/yanıt üretir.

### 3.3 Hasar (`accident`)

Hasar, beklenmedik dış etken, kaza, çarpma, tek taraflı veya karşı taraflı olay sonucu açılır.

Hasarın karakteri:

- olay zamanı/şekli önemlidir,
- görsel kanıt ve evrak önemlidir,
- sigorta/kasko/dosya ilişkisi olabilir,
- hukuki ve güvenlik uyarıları gerekebilir,
- kullanıcı stres altındadır; akış net ve güven verici olmalıdır.

Hasar, arızadan şu yönde ayrılır:

- arıza genellikle aracın iç mekanik/elektrik davranışıdır,
- hasar genellikle dış olay, kaporta, kaza, sigorta/kasko süreci ile ilişkilidir,
- hasar kanıt ve dosya yönetimi tarafında daha ağırdır.

Canonical eşleşme:

1. kullanıcı araç ve hasar detayını girer,
2. varsa fotoğraf/video/evrak ekler,
3. vaka havuza düşer,
4. hasar/kaporta/sigorta uyumlu servisler görür,
5. servisler teklif verir,
6. müşteri teklif seçer, ödeme yöntemini belirler,
7. servis randevuyu onaylar,
8. vaka servis sürecine bağlanır.

### 3.4 Çekici (`towing`)

Çekici, aracın bir noktadan başka bir noktaya taşınması veya yol yardım müdahalesi ihtiyacı için açılır.

Çekici de vakadır çünkü:

- araçla ilişkilidir,
- müşteriyi ve servis/çekici tarafını aynı süreçte buluşturur,
- state yönetir,
- ödeme/teslim/kanıt/puanlama üretir,
- tamamlandığında kayıt haline gelir.

Çekicide iki temel mod vardır:

- `immediate` — canlı/acil çekici
- `scheduled` — planlı çekici

## 4. Kritik Karar Noktası: Planlı Çekici Modeli

Bu dokümandaki en önemli açık ürün kararı budur.

PO anlatısında planlı çekici için iki fikir yan yana duruyor:

1. **Planlı çekici diğer vakalar gibi havuz/teklif/randevu modelinden yürüyebilir.**
2. **Planlı çekici de sistem fiyatlı, ödeme pencereli ve dispatch tabanlı olabilir.**

Mevcut kod yönelimi ikinci modele daha yakın:

- planlı çekici `scheduled_waiting` ile bekler,
- ödeme penceresi randevuya yakın açılır,
- ödeme sonrası dispatch başlar,
- havuz/teklif akışına girmez.

Bu yüzden ürün kararı netleşmeden "scheduled tow" kavramı büyütülmemelidir.

### 4.1 Önerilen Ayrım

Kavram karmaşasını azaltmak için iki farklı ürün niyeti ayırmak gerekir:

| Ürün niyeti | Önerilen model | Açıklama |
| --- | --- | --- |
| Planlı çekici çağır | `towing + scheduled_dispatch` | Rota ve zaman bellidir, sistem fiyat hesaplar, ödeme penceresi açılır, dispatch çalışır |
| Çekici teklifi iste | `towing + offer_request` veya ayrı future mode | Kullanıcı fiyat/servis karşılaştırmak ister, havuz/teklif mantığı çalışır |

Mevcut V1 için önerilen canonical karar:

> V1'de `scheduled` çekici, acil çekiciyle aynı dispatch ailesindedir; sadece zamanı ve ödeme penceresi farklıdır. Çekici teklif pazarı V1.1 veya ayrı mod olarak ele alınır.

Bu karar kabul edilirse:

- `scheduled` çekici havuza düşmez,
- çekici teklif vermez,
- fiyat backend tarafından hesaplanır,
- ödeme penceresi randevuya yakın açılır,
- dispatch randevuya yakın tetiklenir.

Bu karar reddedilirse:

- `TowMode` veya workflow blueprint genişletilmeli,
- pool kartları çekici için özelleştirilmeli,
- teklif/randevu/payment akışı çekici için ayrı kurallarla yeniden tasarlanmalı.

## 5. Havuz Nedir?

Havuz, eşleşme bekleyen vakaların servis tarafına işlenmiş halde sunulduğu matching yüzeyidir.

Havuzun görevi:

- vakayı doğru servis tiplerine göstermek,
- ilgisiz servisleri filtrelemek,
- PII/gizlilik riskini azaltmak,
- servislerin teklif vermesini sağlamak,
- müşteri için karşılaştırılabilir teklif üretmek.

Havuz değildir:

- müşteriyle servis arasında açık chat,
- doğrudan randevu alma ekranı,
- tüm servislerin tüm vakaları gördüğü ham liste,
- ödeme veya anlaşma oluşmuş servis süreci.

### 5.1 Havuzda Görünmesi Gerekenler

Servisin karar vermesi için yeterli ama gizlilik açısından güvenli bilgiler:

- vaka türü,
- araç marka/model/yıl gibi karar sinyalleri,
- genel lokasyon,
- ihtiyaç özeti,
- medya/evidence varsa kontrollü preview,
- aciliyet/zaman tercihi,
- müşteri beklentisi,
- sigorta/kasko sinyali,
- çekici/vale ihtiyacı.

Görünmemesi veya kontrollü görünmesi gerekenler:

- açık adres,
- telefon/e-posta,
- plaka/VIN gibi doğrudan tanımlayıcılar,
- gereksiz kişisel veri,
- ödeme yöntemi/kart bilgisi,
- private media asset URL.

## 6. Keşif Üzerinden "Vakayı Servise Bildir" Modeli

Kullanıcı keşif/usta profili gezerken bir servisi beğenebilir. Ancak fiyat belirsizken doğrudan randevu istemek platform mantığını bozar.

Bu yüzden canonical karar:

> Teklif olmayan bakım/arıza/hasar vakalarında müşteri doğrudan randevu talep etmez; servise vakasını bildirir. Servis bu bildirimi değerlendirir ve teklif/yanıt üretir.

Akış:

1. Kullanıcı servis profilindedir.
2. "Vakayı bildir" veya daha kullanıcı dostu bir CTA görür.
3. Kullanıcının uygun vakası varsa seçer; yoksa vaka oluşturma akışına gider.
4. Vaka oluşturulduğunda kullanıcıya şu seçenek sunulur:
   - sadece bu servise bildir,
   - aynı zamanda havuza aç.
5. Servis bildirim alır.
6. Servis teklif verir veya reddeder.
7. Müşteri teklifi kabul ederse randevu/ödeme yöntemi aşamasına geçer.

Bu modelin çözdüğü problem:

- belirsiz fiyatla randevu yok,
- ödeme/platform dışına kayma azalır,
- müşteri yine sevdiği ustaya ulaşabilir,
- servis son kararı ve fiyatı kendisi verir.

Audit sorusu:

> Mevcut app'te müşteri teklif olmadan bakım/arıza/hasar için doğrudan randevu talep edebiliyor mu?

Evet ise, bu akış ürün kararına göre kapatılmalı veya "vaka bildir"e çevrilmelidir.

## 7. Teklif, Randevu ve Eşleşme

Bakım, arıza ve hasar için canonical eşleşme:

```text
vaka oluşturuldu
→ havuz / servise bildirim
→ servis teklif verdi
→ müşteri teklif seçti
→ ödeme yöntemi seçildi
→ randevu talebi oluştu
→ servis onayladı
→ vaka eşleşti / servise atandı
→ süreç başladı
```

Kritik kural:

> Eşleşme, teklif/randevu ve ödeme yöntemi netleşmeden tamamlanmış sayılmaz.

Ödeme davranışı:

- online ödeme önerilir,
- serviste kart ve nakit seçenekleri bakım/arıza/hasar için izinlidir,
- çekici ve kampanya/paket online ödeme zorunludur,
- online ödeme varsa backend Payment Core üzerinden ilerler,
- offline ödeme varsa vaka geçmişine "offline_recorded" gibi iz düşer.

## 8. Vaka Süreci: Eşleşme Sonrası

Vaka süreci, servis atandıktan sonra başlar.

Öncesi:

- kullanıcı bilgi toplar,
- havuza çıkar,
- teklif alır,
- servis seçer.

Sonrası:

- servis işi üstlenir,
- iki taraf aynı süreç ekranını görür,
- adımlar/timeline/eventler oluşur,
- gerekirse parça/fatura/teslim approval'ları çalışır,
- final rapor ve puanlama ile kapanır.

### 8.1 Pattern Tabanlı Takip

Her tür için bir default workflow pattern olmalıdır.

Basit bakım:

```text
Teslim/randevu onaylandı
→ İşleme alındı
→ Bakım tamamlandı
→ Teslim raporu
→ Müşteri onayı + puanlama
→ Completed
```

Arıza:

```text
Araç kabul edildi
→ Ön teşhis
→ İş kapsamı netleşti
→ Onarım başladı
→ Test edildi
→ Teslim raporu
→ Müşteri onayı + puanlama
→ Completed
```

Hasar:

```text
Araç kabul edildi
→ Hasar tespiti
→ Sigorta/kasko dosya durumu
→ Onarım başladı
→ Boya/kaporta/teslim hazırlığı
→ Teslim raporu
→ Müşteri onayı + puanlama
→ Completed
```

Çekici:

```text
Ödeme/preauth
→ Çekici aranıyor
→ Çekici kabul etti
→ Yola çıktı
→ Varış
→ Yükleme
→ Yolda
→ Teslim
→ Puanlama
→ Completed
```

### 8.2 Ek Adım Ekleme

Usta süreç içinde bilgi amaçlı ek adım ekleyebilir.

Bu ek adım:

- timeline/event olarak kaydedilmeli,
- müşteri tarafından görülebilmeli,
- ücret değiştirmemeli,
- süreci açıklamalı,
- puanlamada güven sinyali olabilir.

## 9. Ek Ödeme Kararı

PO anlatısında güçlü ürün kararı:

> Ek ödeme platformun standart sağlayacağı bir özellik olmamalı. Usta teklifini en üstten ve doğru vermelidir.

Bu karar, mevcut approval/payment altyapısıyla dikkatli uzlaştırılmalıdır.

Mevcut sistemde `parts_request` ve `invoice` approval'ları var. Bunlar tamamen kaldırılacaksa etkisi büyüktür. Daha güvenli ürün ayrımı:

| Kavram | İzin | Açıklama |
| --- | --- | --- |
| Sürpriz ek ücret | Hayır | "İş başladı, ekstra para çıktı" varsayılan platform davranışı olmamalı |
| Kapsam netleştirme | Sınırlı | Teşhis sonrası parça/kapsam müşteriye şeffaf approval olarak sunulabilir |
| Final fatura | Evet | Başta kabul edilen teklif veya onaylanmış kapsamı kapatır |
| Platform dışı ekstra | Platform yönetmez | İstisnai durumlarda taraflar dışarıda çözebilir; Naro sadece takip notunu tutabilir |

Önerilen canonical karar:

> Ek ücret akışı normal kullanıcı deneyiminden kaldırılmalı. Ancak servis sürecinde gerçek kapsam değişikliği varsa bu "ek ödeme" değil, "kapsam revizyonu / yeni onay" olarak tasarlanmalıdır. Bu approval açık, gerekçeli, müşteri tarafından bilinçli kabul edilen ve audit edilebilir olmalıdır.

Audit sorusu:

> Mevcut uygulamada "ek ödeme" kullanıcıya normal ve beklenen bir süreç gibi gösteriliyor mu?

Evet ise:

- metinler değişmeli,
- CTA'lar "kapsam onayı" gibi yeniden adlandırılmalı,
- sürpriz ödeme hissi azaltılmalı,
- usta teklif eğitimi eklenmeli.

## 10. Ödeme Modeli

Ürün kararı:

| Akış | Online ödeme | Offline ödeme | Not |
| --- | --- | --- | --- |
| Acil çekici | Zorunlu | Hayır | Ödeme/preauth olmadan dispatch yok |
| Planlı çekici V1 | Zorunlu | Hayır | Ödeme penceresi randevuya yakın açılır |
| Kampanya/paket | Zorunlu | Hayır | Fiyat backend campaign kaydından gelir |
| Bakım/arıza/hasar teklifi | Önerilen | Serviste kart/nakit izinli | Müşteri seçer |
| Parts/invoice approval | Önerilen | Serviste kart/nakit izinli | Sürpriz ek ücret gibi sunulmamalı |
| Completion | Ödeme değil | Ödeme değil | Kapanış + puanlama + final rapor |

Backend kuralı:

- UI amount authoritative değildir.
- Backend amount/quote yeniden hesaplar veya DB'deki onaylanmış amount'u okur.
- PSP callback doğrulanmadan state ilerlemez.
- Duplicate/replay callback ikinci işlem doğurmaz.
- Marketplace/submerchant prod hedefidir.

## 11. Status ve State Ayrımı

`ServiceCase.status` genel vaka durumudur.

Mevcut ana status'ler:

- `matching`
- `offers_ready`
- `appointment_pending`
- `scheduled`
- `service_in_progress`
- `parts_approval`
- `invoice_approval`
- `completed`
- `archived`
- `cancelled`

Çekici için ayrıca `TowDispatchStage` vardır:

- `payment_required`
- `searching`
- `accepted`
- `en_route`
- `nearby`
- `arrived`
- `loading`
- `in_transit`
- `delivered`
- `cancelled`
- `timeout_converted_to_pool`
- `scheduled_waiting`
- `bidding_open`
- `offer_accepted`
- `preauth_failed`
- `preauth_stale`

Kritik kural:

> `ServiceCase.status` ile türe özgü stage aynı şey değildir. UI ve backend bu iki state katmanını karıştırmamalıdır.

Örnek:

- Çekici `payment_required` stage'indeyken `ServiceCase.status` matching olabilir.
- Hasar `invoice_approval` status'ündeyken ödeme approval state'i ayrıca `requested` olabilir.
- Completion approval ödeme değil kapanış state'idir.

Audit sorusu:

> Ekranlar `case.status` üzerinden çekici davranışını tahmin ediyor mu, yoksa `tow_stage` kullanıyor mu?

## 12. Sigorta Dosyası Konumu

Sigorta dosyası vaka değildir; vakanın ilişkili alt modülü olabilir.

Önerilen model:

- `ServiceCase(kind=accident)` ana hasar vakasıdır.
- Insurance claim/dosya bu vakanın relation'ıdır.
- Usta da müşteri de dosya oluşturabilir/güncelleyebilir ama ownership ve yetki case üzerinden kontrol edilir.
- Sigorta/kasko özel tarafları ayrı tablolar ve statülerle yönetilir.

Karar:

> Sigorta dosyası, hasar vakasını ikame etmez; hasar vakasının üstüne bağlanan ayrı süreçtir.

Audit sorusu:

> Backend'de sigorta claim oluşturma akışı case ownership ve accident/towing ayrımını doğru kontrol ediyor mu?

## 13. Public Profil ve Vaka Geçmişi

Tamamlanan vaka, iki taraf izin verirse usta public profilinde doğrulanmış iş olarak gösterilebilir.

Kurallar:

- varsayılan kapalı,
- teknisyen onayı gerekir,
- müşteri onayı gerekir,
- PII yok,
- plaka/VIN/açık adres yok,
- özel medya public copy olmadan gösterilmez,
- revoke edilirse public'ten düşer.

Bu, vaka omurgasının doğal sonucudur:

> Naro'da tamamlanan süreç, izinli ve güvenli şekilde servis güven sinyaline dönüşür.

## 14. Rollere Göre Vaka Anlamı

### Customer için

- aracım için bir ihtiyacım var,
- bilgiyi güvenli şekilde anlatıyorum,
- teklif/servis seçiyorum,
- süreci takip ediyorum,
- sonunda onaylayıp puanlıyorum.

### Technician için

- yapabileceğim işler havuzda önüme düşüyor,
- teklif veriyorum,
- randevu/işi kabul ediyorum,
- süreci güncelliyorum,
- teslim raporu yazıyorum,
- iyi iş geçmişi profilime güç katıyor.

### Naro için

- iki tarafı aynı state machine'de tutuyorum,
- ödeme ve güvenliği yönetiyorum,
- süreci ölçüyorum,
- iyi/kötü servis sinyali üretiyorum,
- araç geçmişi ve servis hafızası oluşturuyorum.

## 15. Backend Enforcement Gereken Ürün Kuralları

| Kural | Backend'de zorunlu olmalı mı? | Not |
| --- | --- | --- |
| Araçsız vaka olmaz | Evet | `vehicle_id` zorunlu |
| Customer başkasının vakasını göremez | Evet | route guard |
| Technician ilgisiz vakayı göremez | Evet | pool/assignment/participant guard |
| Çekici ödeme olmadan dispatch başlatamaz | Evet | Payment Core + Tow lifecycle |
| Planlı çekicide ödeme penceresi gelmeden ödeme CTA açılmaz | Evet | worker + snapshot |
| Bakım/arıza/hasar teklif olmadan randevuya dönmez | Evet | ürün kararı henüz audit edilmeli |
| Servis ödeme hesabı olmadan aktif iş alamaz | Evet | offer/appointment/tow/campaign gate |
| Completion ödeme değil kapanıştır | Evet | approval kind ayrımı |
| Public showcase iki taraf onayı olmadan yayınlanmaz | Evet | showcase status |
| Ek ödeme normal akış gibi sunulmaz | Evet/Ürün | approval copy ve flow audit edilmeli |

## 16. Geçmişte Açık, Şimdi Karara Bağlı Noktalar

(Bu bölüm tarihsel kayıt — doküman ilk yazıldığında açık olan kararların güncel statüsü.)

### 16.1 Planlı çekici havuz mu dispatch mi? — KARARLI ✅

V1: dispatch/payment-window modeli (anlatı §3.6'da kanonik). V1.1: "çekici teklifi iste" ayrı mod olarak değerlendirilebilir.

### 16.2 Belirsiz fiyatla seçili ustaya randevu — KARARLI ✅

Doğrudan randevu yok; "vakayı bildir" akışı (anlatı §4 + bu doküman §6). Backend tarafında `POST /appointments` endpoint'i offer-zorunlu olacak şekilde gate'lenecek (fix haritası F1).

### 16.3 Ek ödeme — KARARLI ✅

"Ek ödeme" dili kaldırılır; "kapsam onayı / final fatura" dili kalır. Backend altyapısı (parts/invoice approval) korunur, copy + UX yeniden konumlandırılır, gerekçe alanı zorunlu olur. (Anlatı §6, fix haritası F2.)

### 16.4 Sigorta dosyası — KARARLI ✅

Hasar vakasının alt relation'ı; ayrı vaka türü değil (bu doküman §12).

### 16.5 Pattern tanımlarının kaynağı — KARARLI (V1 önerisi) ✅

Backend `workflow_blueprint` canonical; FE presentation config; BE approval/task/event validasyonları. Müşteri+usta ek adım eklenebilirliği konusu net: **ek adım yetkisi yalnız ustada** (anlatı §5). DB-driven dynamic workflow değerlendirmesi V1.1+.

## 17. Hemen Yapılacak Auditler

### Audit 1 — Direct Appointment Without Offer

Soru:

> Bakım/arıza/hasar için müşteri teklif olmadan randevu talebi yaratabiliyor mu?

Kontrol:

- customer technician profile CTA'ları
- appointment endpoints
- offer acceptance flow
- service app appointment approve

Beklenen karar:

- teklif yoksa direkt randevu yok,
- "vakayı bildir" var.

### Audit 2 — Extra Payment / Approval Copy

Soru:

> App içinde "ek ödeme" normal ve beklenen bir süreç gibi mi sunuluyor?

Kontrol:

- customer approval sheets
- service job task screens
- backend approval kinds
- docs/payment copy

Beklenen karar:

- sürpriz ek ödeme dili yok,
- kapsam/fatura onayı dili var.

### Audit 3 — Scheduled Tow Product Parity

Soru:

> Planlı çekici kodu, ürün kararını net ve tek şekilde uyguluyor mu?

Kontrol:

- `TowMode.SCHEDULED`
- `scheduled_payment_window`
- UI payment window card
- pool/offer/tow intersection

Beklenen karar:

- V1 dispatch/payment-window ise havuz yok.
- Eğer havuz istenirse ayrı mod açılır.

### Audit 4 — Case Status vs Tow Stage

Soru:

> UI veya backend `ServiceCase.status` ile çekici stage'ini karıştırıyor mu?

Kontrol:

- customer records/cards
- tow tracking screen
- service jobs feed
- case profile screen

### Audit 5 — Request Draft Source-of-Truth

Soru:

> `request_draft` kritik karar kaynağı olarak kullanılıyor mu?

Beklenen:

- Hayır. Sadece snapshot/audit.

## 18. AI'ye Verilecek Kısa Prompt

Bu dokümandan sonra ilk audit için kullan:

```text
Bu repo içinde bakım/arıza/hasar vakalarında "teklif olmadan doğrudan randevu talebi" mümkün mü diye audit yap.

Ürün kararı:
- Müşteri teklif olmayan bir bakım/arıza/hasar vakasında doğrudan randevu isteyemez.
- Bunun yerine servise "vakayı bildir" akışı olmalı.
- Servis bildirimi görür ve teklif/yanıt üretir.

Kontrol et:
1. Customer app technician profile/preview CTA'ları
2. Appointment endpointleri
3. Offer acceptance flow
4. Service app appointment approve flow
5. Backend ownership ve payment state etkisi

Çıktı:
- PASS/PARTIAL/FAIL
- Bypass yolları
- Dosya haritası
- Minimal düzeltme planı
```

## 19. Son Canonical Tanım

> Naro'da vaka, müşterinin bir aracı için başlattığı; bakım, arıza, hasar veya çekici ihtiyacını platform içinde yönetilebilir hale getiren; doğru servislerle havuz/bildirim/dispatch yoluyla eşleşen; ödeme ve randevu kararları netleştikten sonra iki taraflı servis sürecine dönüşen; teslim, kapanış, puanlama ve güven sinyali üreten ana iş nesnesidir.

## 20. Bu Dokümanın Kullanım Kuralı

Yeni feature yazmadan önce sor:

1. Bu feature hangi vaka türüne bağlı?
2. Vaka öncesi mi, eşleşme anı mı, eşleşme sonrası mı?
3. Ödeme kararı var mı?
4. Servis atanmış mı?
5. Bu işlem case status mu, subtype stage mi, approval state mi değiştiriyor?
6. Backend bu kuralı enforce ediyor mu?
7. Frontend sadece gösteriyor mu, yoksa doğru endpoint'e mi bağlı?
8. Test bu kuralı kırmaya çalışıyor mu?

Bu sorulara cevap yoksa feature değil, önce ürün/sistem kararı gerekir.
