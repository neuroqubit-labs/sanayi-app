# Vaka Merkezli Çarşı ve Bildirilebilir Usta Sözleşmesi

**Tarih:** 2026-04-26
**Statü:** Ürün beklentisi + mevcut durum dökümü
**Referans:** `docs/naro-vaka-omurgasi.md`, `docs/naro-domain-glossary.md`, `docs/case-dossier-contract-2026-04-26.md`

## 1. Ana Fikir

Naro'da kullanıcının işi soyut bir "usta arama" işi değildir. Kullanıcının işi **vaka**dır.

Kullanıcı önce aracını ekler, sonra o araç için bir veya daha fazla vaka açar: bakım, arıza, hasar veya çekici. Vaka açıldıktan sonra kullanıcının ürün içindeki ana bağlamı artık o vakadır. Çarşı, profil önizleme, vaka profili ve "vakayı bildir" butonu bu bağlamdan bağımsız davranamaz.

Bu yüzden çarşı genel bir usta kataloğu gibi çalışmamalıdır. Aktif vaka varsa çarşı o vakaya göre sıralanır. Aktif vaka yoksa çarşı aktif araca göre öneri verir. Uygunluk kararını frontend tahmin etmez; backend her servis kartı için bağlamsal karar üretir.

Beklenen temel cümle:

> Kullanıcının aktif vakası varsa, keşfette gördüğü servisler o vakanın araç tipi, marka/model, hizmet konusu ve konum sinyallerine göre sıralanır. "Vakayı bildir" yalnız backend'in bildirilebilir dediği servislerde görünür.

Örnek:

- Kullanıcının Kayseri'de Volkswagen Passat aracı var.
- Kullanıcı "arka kapı kolu / kaporta / aksesuar" konulu bir arıza veya hasar vakası açtı.
- Çarşıda üstte Kayseri'de hizmet veren, otomobil bakan, Volkswagen coverage'ı olan, kaporta/aksesuar/tamir alanına uyan servisler görünür.
- Oto elektrikçi, motosiklet-only servis veya şehir/araç/hizmet konusu zayıf servisler ana akışı bozmaz; gerekiyorsa altta "Diğer seçenekler" bölümünde görünür.
- Uyumsuz serviste "Vakayı bildir" butonu görünmez.

## 2. Vaka Nasıl Başlar ve Nasıl Yürür?

Vaka, bir aracın etrafında açılan ve platform içinde yönetilen süreçtir. Araçsız vaka olmaz.

Ortak akış:

1. Kullanıcı aktif aracını seçer veya araç ekler.
2. Kullanıcı vaka türünü seçer: bakım, arıza, hasar veya çekici.
3. Composer, türün kendi mantığına göre olayı toplar. Kullanıcıdan önce teknik açıklama değil, somut kararlar istenir.
4. Backend typed case ve subtype alanlarını oluşturur.
5. Backend vaka hizmet etiketlerini üretir. Örnek: `electric`, `climate`, `glass_film`, `kaporta`, `aksesuar`.
6. Backend uygun servisleri hesaplar ve gerekirse `case_technician_matches` read-model'ini üretir.
7. Kullanıcı çarşıya veya vaka profiline girdiğinde servisler artık bu vaka bağlamıyla görünür.
8. Kullanıcı yalnız bildirilebilir servislerde "Vakayı bildir" aksiyonu alır.
9. Servis bildirimi veya havuz görünümü üzerinden vakayı görür, teklif gönderir.
10. Müşteri teklifi kabul eder; ödeme/randevu/eşleşme süreci vaka omurgasına göre devam eder.

Çekici bu kuralın özel koludur. Acil ve planlı çekicide sistem fiyat/dispatch modeli çalışır; normal servis havuzu ve teklif akışına karışmaz.

## 3. Çarşı Davranışı

Çarşı ekranının bağlam önceliği:

1. Aktif açık vaka varsa: `/technicians/public/feed?case_id=<case_id>`
2. Aktif açık vaka yoksa ama aktif araç varsa: `/technicians/public/feed?vehicle_id=<vehicle_id>`
3. Araç da yoksa: genel keşif, fakat bu durumda "Vakayı bildir" gösterilmez.

Birden fazla açık vaka varsa varsayılan seçim en güncel açık vakadır. İleride kullanıcıya aktif vaka değiştirme kontrolü eklenebilir; ama V1'de çarşı kendi kendine bağlamsız kalmamalıdır.

Çarşı kartı backend'den gelen şu alanları doğrudan göstermelidir:

- `context_group`: `primary` veya `other`
- `compatibility_state`: `notifyable`, `compatible`, `vehicle_only`, `weak`, `incompatible`
- `context_score`
- `match_badge`: örn. "Bu vakaya uygun", "Aracına uygun"
- `notify_badge`: örn. "Bildirilebilir"
- `match_reason_label`: örn. "Elektrik ve Volkswagen için uygun"
- `fit_badges`: örn. "Araç tipi uygun", "Volkswagen uyumlu", "Şehir uyumlu"
- `can_notify`
- `notify_state`: `available`, `already_notified`, `has_offer`, `limit_reached`, `not_compatible`
- `notify_disabled_reason`

Frontend'in görevi bu alanları render etmektir. Frontend araç tipi, marka veya hizmet alanı üzerinden kendi uyumluluk tahminini üretmemelidir.

## 4. Bildirilebilir Usta Ne Demek?

`Bildirilebilir` etiketi sıradan bir pazarlama rozeti değildir. Ürün anlamı şudur:

> Bu servis, aktif vaka için backend tarafından yeterince uyumlu bulunmuştur ve kullanıcı bu vakayı bu servise bildirebilir.

V1 bildirilebilirlik sıkı tutulur. Genel kural:

- Araç tipi uymalıdır. Otomobil vakası motosiklet-only servise bildirilemez.
- Hizmet konusu uymalıdır. Cam filmi vakası elektrikçiye bildirilemez; klima/akü/elektrik vakası elektrikçiye bildirilebilir.
- Şehir sinyali güçlü olmalıdır. V1'de il bazlı uyum yeterlidir; mesafe varsa sıralama sinyali olabilir.
- Araç markası varsa marka coverage bildirilebilirliği güçlendirir ve V1'de beklenen sert sinyaldir.
- Towing normal servis çarşı/havuz/offer akışına düşmez.

`can_notify=true` yalnız bu koşullar sağlandığında gelir. UI'da "Vakayı bildir" butonu yalnız `can_notify=true` ise görünür veya aktif olur.

Uyumsuz durumlar:

- Aktif vaka var ama servis uyumsuzsa: "Bu vaka için uygun değil"
- Aktif vaka yoksa: "Vaka oluştur"
- Bildirim gönderilmişse: "Bildirildi"
- Servisten teklif gelmişse: "Teklif geldi"
- Üç servis bildirim limiti dolmuşsa: "Limit doldu"

## 5. Ekranların Rolü

### Çarşı

Çarşı aktif vaka/araç bağlamını gösteren bir context pill taşır:

- "Elektrik vakası için"
- "Cam filmi vakası için"
- "Volkswagen Passat için"

Kartlar önce `primary`, sonra `other` olarak ayrılır. `other` bölümü "Diğer seçenekler" adıyla görünür ve bu bölümde bildirim CTA'sı olmaz.

### Servis Kartı

Kart, servis vitrini olmaktan çok karar kartıdır. En azından şu sinyalleri göstermelidir:

- servis adı ve ana hizmet tipi
- konum özeti
- "Bildirilebilir" veya "Bu vakaya uygun" rozeti
- backend'in verdiği uyum nedeni
- 2-4 kısa fit rozeti
- bildirim/teklif durumu

### Profil Önizleme

Preview sheet, çarşı kartındaki backend context snapshot'ını taşımalıdır. Dossier yüklenirse bu bilgi doğrulanır; yüklenmezse frontend kendi tahminiyle "Vakayı bildir" açmaz. Aktif vaka + backend uyum yoksa CTA kapalı kalır.

### Vaka Profili

Vaka profili bu hikayenin en net yüzeyi olmalıdır. Kullanıcı vakasına girdiğinde:

- vaka shell ve araç snapshot görünür,
- vaka tür detayı görünür,
- uygun servisler backend match sırasıyla görünür,
- bildirilebilir servislerde net CTA bulunur,
- bildirim sonrası kart state'i "Bildirildi" olur,
- gelen teklifler ayrı bölümde görünür.

## 6. Mevcut Durum

Backend tarafında önemli parçalar büyük ölçüde mevcut:

- `/technicians/public/feed` `case_id` ve `vehicle_id` kabul ediyor.
- Backend her feed item için context alanları üretebiliyor: `context_score`, `context_group`, `compatibility_state`, `can_notify`, `notify_state`, `fit_badges`.
- `evaluate_profile_fit` canonical karar motoru olarak araç tipi, hizmet domain'i, marka/model ve şehir sinyallerini birlikte değerlendiriyor.
- `notify_case_to_technician` artık uyumsuz servisleri reddediyor; match kaydı yoksa bile notification ayrı kayıt olarak çalışabiliyor.
- `case_service_tags` typed composer çıktılarından üretiliyor; `request_draft` kritik karar kaynağı olmamalı.

Frontend tarafında son düzeltmelerle bazı kopukluklar kapatıldı:

- Çarşı feed schema'sı backend context alanlarını parse edecek şekilde genişletildi.
- `UstalarScreen` aktif vaka varsa `case_id`, yoksa aktif araç varsa `vehicle_id` gönderecek şekilde bağlandı.
- Kartlar `Bildirilebilir`, `Bu vakaya uygun`, `Diğer seçenekler` gibi backend rozetlerini göstermeye başladı.
- Preview ve tam profil CTA'ları dossier/feed context olmadan bildirim kararı üretmemeye yöneltildi.

Fakat ürün davranışı hâlâ cihazda beklenen gibi hissedilmiyorsa bakılacak ana riskler şunlardır:

1. Aktif vaka seçimi yanlış olabilir. Çarşı son açık vakayı seçiyor olabilir; kullanıcının test ettiği vaka başka bir vaka olabilir.
2. Backend feed response'u doğru alanları dönse bile cihaz cache'i veya query invalidation eski listeyi gösterebilir.
3. Seed/coverage verisi eksik olabilir. Eski servislerde `technician_vehicle_kind_coverage`, marka coverage veya service domain yoksa doğru biçimde `other/weak` görünmelidir.
4. Vaka composer doğru typed tag üretmiyor olabilir. Örneğin "kapı kolu" semptomu backend tag'e düşmüyorsa kaporta/aksesuar eşleşmesi zayıflar.
5. Vaka location label şehir içermiyorsa şehir uyumu kurulamayabilir. Kayseri beklenirken İstanbul gibi yanlış label gelirse bildirilebilirlik bozulur.
6. Mock/legacy hook kullanan eski yüzeyler hâlâ gerçek feed/dossier yerine fixture gösterebilir.

## 7. Claude İçin Kabul Kriterleri

Bu dökümandan çalışacak kişi/agent aşağıdaki durumu sağlamalıdır:

- Çarşı isteğinde aktif vaka varken network request içinde `case_id` görülür.
- Aktif vaka yokken aktif araç varsa request içinde `vehicle_id` görülür.
- Feed response'unda `can_notify=true` gelen kartta "Bildirilebilir" görünür.
- `context_group=other` kartı "Diğer seçenekler" altında görünür ve "Vakayı bildir" CTA'sı içermez.
- Preview sheet, çarşı kartıyla aynı CTA kararını verir.
- Vaka profili, dossier `matches` üzerinden aynı uygun servis hikayesini gösterir.
- VW/Kayseri/kapı kolu senaryosunda kaporta veya aksesuar domain'li VW coverage servisleri üstte çıkar.
- Aynı senaryoda oto elektrikçi bildirilebilir değildir.
- Cam filmi vakasında elektrikçi bildirilebilir değildir.
- Klima/akü/elektrik vakasında oto elektrikçi bildirilebilir olabilir.
- Motosiklet aracı, otomobil-only servisi primary/bildirilebilir olarak görmez.
- `request_draft` üzerinde oynama matching sonucunu değiştirmez.

## 8. Kısa Sonuç

Naro'da çarşı bağımsız bir dükkan vitrini değildir. Çarşı, aktif araç ve aktif vaka üzerinden anlam kazanan bir keşif yüzeyidir.

Kullanıcının bir vakası varsa ürünün sorusu şudur:

> "Bu vakayı hangi servis gerçekten çözebilir ve hangisine güvenle bildirebiliriz?"

Bu sorunun cevabı backend matching contract'ıdır. Frontend bu cevabı görünür, anlaşılır ve güven veren bir şekilde taşır. Ürün bu çizgiden çıktığında kullanıcı alakasız servis görür, yanlış yere vaka bildirir ve vaka omurgası zayıflar.
