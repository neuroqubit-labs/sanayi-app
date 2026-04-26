# Naro Vaka Omurgası — Canonical Anlatı

**Tarih:** 2026-04-25
**Statü:** Ürün sahibinin (PO) sesinden kayda geçirilmiş canonical anlatı
**Amaç:** "Vaka" kavramını ve onun çevresinde dönen tüm akışları tek bir yerden, ürün dilinde sabitlemek. Backend, frontend, test ve audit kararları bu anlatıya referansla yapılır.
**İlgili:** [naro-domain-glossary.md](naro-domain-glossary.md), [naro-urun-use-case-spec.md](naro-urun-use-case-spec.md), [backend-is-mantigi-hiyerarsi.md](backend-is-mantigi-hiyerarsi.md)

---

## 1. Vaka Nedir?

Naro için **vaka, yönetilmesi gereken bir süreçtir.**

4 farklı türü vardır:

1. **Çekici çağırmak**
2. **Bakım planı oluşturmak**
3. **Arıza bildirmek**
4. **Hasar bildirmek**

Bu dört türü kavramsal olarak birbirinin altına/üstüne kapsamak mümkündü; ama biz sanayici gibi düşünüp bu şekilde odakladık. Neden:

- **Bakım planlama** araç için sorun değil, zamanla gelen, istekle gelen, acil olmayan bir süreçtir. Bu süreçte temiz bir teklif veya bir kampanya üzerinden ilerlemek temiz bir akış için mecburi.
- **Hasar bildirimi**, yönetilmesi gereken — ustaların karşısına düşmesi gereken — diğer tüm vakalar gibi bir vakadır. Farkı: istemsiz, karşı taraflı veya tek taraflı, beklenmeden gelen bir süreçtir.
- **Arıza** ile hasar aslında benzer görünür; ama arızada süreç tamir gerektirebilecek bir kavramdır. Araçta ses olur, sürmeye devam edilip teklif beklenebilir; rektifiye süreci vardır, usta aranır. **Hasar** daha çok sigorta/kasko süreciyle iç içe, ayrışık durumlarda ilerler.
- **Çekici** süreci de bir vakadır; çünkü tamamlanması gereken, içinde hem servis hem araç sahibi uygulamasının müdahil olduğu, iki tarafı da ilgilendiren bir süreçtir.

### Çekici özelinde önemli ayrım

Çekicide iki ayrı yol vardır:

- **Acil çekici:** Anlık yönetilmesi gereken bir süreç. Konum seçme, gideceği yer gibi adımlar anlık ilerler. Bu sebeple ardışık birkaç adıma ihtiyacı vardır.
- **Planlı çekici:** Randevu zamanlı çekici vakasıdır; teklif/havuz akışına girmez. Ücret sistem tarafından hesaplanır, ödeme penceresi randevuya yakın açılır ve ödeme sonrası canlı dispatch çalışır.

Bu farklardan dolayı çekici ile acil çekici arasında bir ayrışma vardır. Ama:

> **Her çekici isteği bir vakadır. Acil çekici de eşleşmenin canlı yapılabildiği bir çekici vakasıdır.**

Bu cümle çok önemli — kafamızdaki tek omurgayı bozmaz, sadece eşleşme moduna canlı bir yol ekler.

---

## 2. Vakanın Genel Yapısı

- Vakalar **hem servis hem araç sahibi** uygulamasını kullanan kullanıcıları ilgilendirir; veri üzerinden state yönettiğimiz durumdur.
- **Her vakanın doğrudan ilişkilendirildiği bir aracı vardır. Araçsız vaka olamaz.**
- **Tüm vakalar kullanıcı tarafından oluşturulur.** (Sigorta dosyası istisnadır; ama o da tam olarak vakayı karşılamaz; vakanın bir sigorta dosyası olabilir veya usta sigorta dosyası oluşturabilir gibi ayrıksı bir tablo meselesidir. Sigorta dosyasının da kasko–sigorta gibi kendi tarafları, kendi ilişkisel altyapısı vardır.)

### Genel akış (her vaka için ortak)

1. Kullanıcı vakayı oluşturur — zaten farkında bile olmadan **türünü seçer**: çekici, bakım, arıza, hasar.
2. Sonraki adımda vakayı **detaylandırır**. Her vaka alt sınıfı kendince özelleştirilir.
3. Bir **servis kullanıcısıyla eşleşir.**
4. Süreç özelleştirilmiş şekilde yürütülür.
5. Vaka **tamamlanır.**

Bazı süreçlerde **iptal/cayma** durumları söz konusu olabilir; ama bu yalnızca vaka içi özelleştirilmiş durumlarda mümkündür.

---

### 2.1 Vaka Servisi Tek Sözleşmesi

Naro'da vaka, backend'de ayrı ayrı endpointlerin veya frontend'de ayrı ayrı ekranların kendi kafasına göre yorumladığı bir nesne değildir.

> **Vaka için tek bir servis sözleşmesi vardır.** Müşteri app, servis app ve backend aynı vaka sözleşmesini okur; aynı ilişki kurallarına göre yazar.

Bu sözleşme şunları kapsar:

- Vaka shell'i: tür, araç, müşteri, genel durum, güvenli özet.
- Tür detayı: bakım, arıza, hasar veya çekiciye özgü alanlar.
- **Vaka profili sayfası:** somutlaştırılmış vakanın iki taraf için (hemen hemen) ortak detay sayfası. İçerik: vaka geneli + araç bilgileri + gelen teklifler + medya/evrak özeti + vaka aktifleştiğinde sürece erişim adımları. Vaka detay/tracking ekranlarından ayrı, tek canonical sayfa. (Şu an taslak hâlinde eksik var; ileride somutlaşacak.)
- Uyumlu ustalar: sistemin bu vakaya uygun bulduğu servis/usta kayıtları.
- Havuz/bildirim: vakanın doğru servislerin önüne düşmesi veya seçili ustaya bildirilmesi.
- Teklif: servis tarafının fiyat/zaman/kapsam cevabı.
- Randevu/eşleşme: yalnız teklif ve ödeme yöntemi netleşince gerçek servis sürecine dönüşen adım.
- Çekici lifecycle: ödeme/preauth sonrası canlı dispatch veya planlı ödeme penceresi.
- Süreç takibi: yalnız eşleşme sonrası başlayan pattern bazlı takip.
- Approval/payment: kapsam onayı, final fatura, completion ve çekici ödeme kararları.

Bu sözleşmenin dışına çıkan her kısa yol ürün drift'idir. Örnek:

- `request_draft`tan kritik karar vermek,
- uyumlu usta yerine mock/default araç önerisi göstermek,
- teklif olmadan bakım/arıza/hasar randevusu açmak,
- çekiciyi havuz/teklif modeline yanlışlıkla geri sokmak,
- vaka profilini süreç ekranı veya teklif listesiyle karıştırmak.

Ürün kuralı basit: **Vaka servisinin sözleşmesi değişirse backend schema/service, müşteri app adapter'ı, servis app adapter'ı ve testleri birlikte değişir.**

---

### 2.2 Vaka Altı Akış İlkesi

Vaka oluşturma ekranları kullanıcının zihnindeki olayı boşaltmasına yardım etmelidir. Bu yüzden bakım, arıza, hasar ve çekici akışları yalnız form alanları değildir; her biri kendi olay mantığına göre tasarlanmış sorgulama akışıdır.

Kural:

> **Basitten zora, somuttan soyuta, karardan açıklamaya gidilir.**

Kullanıcıya en başta uzun açıklama yazdırmak genellikle yanlıştır. Önce olayı hatırlatan, karar vermesi kolay sorular gelir; açıklama, kanıt ve detay adım adım açılır.

Örnek:

- Hasarda önce güvenlik, olay tipi, zaman/yer ve hasar bölgesi sorulur; uzun açıklama en başta değil, kullanıcı olayı hatırladıktan sonra istenir.
- Arızada önce semptom ve aracın yürür olup olmadığı sorulur; kullanıcıdan arızayı teknik isimle anlatması beklenmez.
- Bakımda önce niyet/kategori sorulur; özel talep ve açıklama sonradan gelir.
- Çekici kaza için ilk adımda kritik olabilir; bakım/arıza için ara adım değil, son kararda ayrı çekici çağırma yönlendirmesidir.

Bu ilke de vaka sözleşmesinin parçasıdır. Bir composer akışı kullanıcının bir adım ileri bir adım geri gitmesine sebep oluyorsa, doğru veri toplasa bile ürün omurgasına zarar verir.

---

## 3. Tür Özelinde Detaylar

### 3.1 Hasar Bildirimi

Kullanıcı hasar bildir butonuna bastığında:

- App'te zaten seçili bir araç vardır veya kullanıcı araç seçer.
- Hasarla ilgili detayları doldurur: video, evrak, görseller, açıklama vb.
- Adım adım süreci bitirir; tamamladığında vaka **havuza** düşer.

### 3.2 Havuz Nedir?

> **Havuz: Naro içerisindeki her vakanın etiketleri ve durumlarına göre yönlendirildiği, doğrudan hedef servisler ile eşleştirmek için kullandığımız yapıdır.**

Servis, havuzda kendi yapabileceği işlerle karşılaşır ve teklif vb. yollayabilir. (Detaylar aşağıda.)

### 3.3 Arıza Bildirimi

Arıza bildirimi birçok alt dalı olan bir akıştır:

- Arızanın durumu, konusu, videosu, açıklaması — bu bilgi genişletilebilir, detaylandırılabilir veya isteğe bağlı sade tutulabilir.
- Hasar vakasına benzer şekilde yürür.
- Konsept farklıdır; adımlar çok bağımsızdır. Mantıksal akışlar her biri için özelleştirilir. Daha detaylı ayrıca konuşulacak; temel burada.

### 3.4 Bakım Talebi

- Bakım talebi nispeten gevşektir.
- Yağ bakımı da olabilir, cam filmi de.
- Araç seçilir, süreç az çok bellidir.

### 3.5 Acil Çekici

Diğer vakalardan farklı olarak ödeme **eşleşmeden önce** alınır. Teklif/itiraz mekanizması yoktur — fiyatı sistem belirler.

Akış:

1. Kullanıcı acil çekici talebi oluşturur.
2. Sistem **ücreti server-side hesaplar.**
3. Kullanıcı ödeme yapar (preauth tutulur).
4. Ödeme tamamlanınca **eşleşme algoritması canlı çalışır.**
5. Vaka **havuza atılmaz**; doğrudan çekici dispatch servisine düşer.
6. Dispatch yakındaki uygun çekiciyi sırayla arar:
   - **Yarıçap merdiveni:** önce 10 km, sonra 25 km, en son 50 km.
   - Her turda en uygun aday bulunur, çekici kabul/red için kısa süre tutulur.
   - Bir aday reddederse veya cevap vermezse bir sonraki adaya geçilir.
   - 3 deneme sonunda hiçbir çekici kabul etmezse vaka **havuza fallback** olur (`TIMEOUT_CONVERTED_TO_POOL`); kullanıcıya bilgilendirme yapılır, çekiciler havuzdan teklif yollayabilir hâle gelir.
7. Çekici kabul edince süreç başlar; iş teslim edilince final tutar çekilir (capture).

### 3.6 Planlı Çekici

Planlı çekici de ödeme zorunlu bir çekici vakasıdır. Teklif/itiraz mekanizması yoktur (acil çekicide olduğu gibi). Acil çekiciden iki temel farkı vardır:

1. **Vaka oluşturulduğunda ödeme hemen alınmaz.** Ödeme penceresi randevu saatine yakın açılır (varsayılan: randevudan 60 dk önce).
2. **Dispatch zamanlanmıştır.** Ücreti yine sistem hesaplar; ödeme alındıktan sonra acil çekicideki aynı yarıçap merdiveni dispatch'i çalışır.

Akış:

1. Kullanıcı planlı çekici talebi oluşturur (araç + nereden + nereye + randevu zamanı).
2. Sistem ücreti hesaplar. Vaka `SCHEDULED_WAITING` durumuna geçer; ödeme penceresi açılana kadar bekler.
3. Worker, randevudan ~60 dk önce vakayı `PAYMENT_REQUIRED` durumuna alır; kullanıcıya ödeme bildirimi düşer.
4. Kullanıcı öder → preauth tutulur → dispatch başlar (acil çekiciyle aynı yarıçap merdiveni) → çekici kabul edince eşleşir.
5. İş teslim edilince final tutar çekilir (capture).

> **Planlı çekici "havuz + teklif" akışından geçmez.** Acil çekiciyle aynı dispatch mekanizmasını kullanır; tek fark ödeme penceresinin geç açılması ve dispatch'in randevu saatine yakın tetiklenmesidir.

**Ödeme penceresi açıldı ama ödenmediyse:** Varsayılan davranış olarak vaka penceresinin sonunda otomatik iptal edilir; kullanıcıya bildirim düşer. (Tam timeout süresi ürün kararı ile netleşecek — bkz. §8 açık karar.)

### 3.7 Diğer Vaka Türlerinin Akışı

Hasar, arıza, bakım için süreç hemen hemen aynıdır:

1. Vaka tüm detaylarıyla bildirilir (tipi, türü, varsa taraflar vb.).
2. Vaka **havuza atılır.**
3. Havuzdaki vakaya **bir veya birden fazla usta teklif yollayabilir.** Müşterinin havuzdan doğrudan ustaya randevu talep etme yolu yoktur — usta seçicidir, müşteri talep eden değil. (Müşteri, keşfettiği bir ustaya §4'teki "vaka bildir" akışıyla ulaşabilir; orada da usta görür ve teklif yollar.)
4. Kullanıcı, gelen tekliflerden birini — örneğin cazip teklif yollayan, güvenilir bulduğu vb. — **kabul eder.** Kabul, randevu talebini de tetikler (slot teklifin içinde gelir; kullanıcı düzenleyebilir).
5. Bu adım eşleşmenin son adımıdır → **ödeme yöntemi seçilir.** Online ödeme seçildiyse: bakım/arıza/hasar için **direct_capture** akışı (eşleşme anında tek seferde çekilir; sonradan kapsam onayı çıkarsa ek hold ayrı approval olur). Çekici akışlarında **preauth_capture** kullanılır (preauth tutulur, teslimat sonunda capture). Offline (serviste kart/nakit) seçildiyse ödeme platformda yapılmaz, vaka geçmişine `offline_recorded` olarak işlenir.
6. **Usta randevuyu onayladığı an = eşleşme anı.** Online ödeme yapılmışsa direct_capture burada tetiklenir.
7. Vaka **atölyeye bağlanmıştır.** Sonrasında pattern bazlı vaka süreci (parts/invoice/completion approval'ları dahil) yürür; ek ödeme yoktur (§6).

---

## 4. Açık Nokta — Belirsiz Fiyatla Randevu Sorunu

Arıza, hasar, bakım gibi teklif bazlı vakalarda servis–usta teklif atmadığında, **belirsiz bir fiyattan ustadan randevu istemek** problemli. Çünkü ödemeyi nasıl alacağız?

Çekici bu kuralın dışındadır: acil ve planlı çekicide ücret sistem tarafından hesaplanır; kullanıcı usta/çekici ile teklif pazarlığı yapmaz.

> **Karar: Bu durumda kullanıcı asla doğrudan randevu talebinde bulunmamalı.**

Bunun yerine: **"Servise vakayı bildir"** butonu olacak.

### Ne demek, neyi çözüyor?

Vaka oluştu, hiç teklif yok. Bu noktada vakayı doğrudan bir ustaya randevu talebi olarak yollarsak, platform dışı bir eşleşme gibi ilerler — ödemeyi nerede alacağız, nasıl yöneteceğiz? Bu saçmalık.

Çözüm: Kullanıcı kendi vakasını seçtiği bir servise/ustaya **bildirir**. Servis bunu görür; kendi sürecine alır, teklif yollar. Akış böylece **platform içinde** kalır — ödeme, randevu, eşleşme hepsi sistemin kontrolünde.

### Tipik akış

- Kullanıcı uygulamaya girdi: Passat'ının lastikleri değişecek.
- Keşfette gezerken bir lastikçi gördü.
- Servisin profiline girdi, beğendi. Profil ekranındaki birincil CTA **"Ustaya vaka bildir"** (eski "Randevu al" butonunun yerine geçer — usta süreçten habersizken randevu olamaz).
- Halihazırda ilgili bir vakası varsa onu bildirir. Yoksa **"Vaka oluşturmak ister misiniz?"** ekranı çıkar; ustanın temel konseptine yönlendirilir (lastikçi → bakım/lastik değişimi composer'ı), vaka oluşturulur.
- **Bildirim hem ustanın bildirim listesine düşer, hem de vaka aynı anda havuza eklenir.** Bunlar "ya/ya da" değildir — paralel çalışır.
  - Usta tarafında: doğrudan bildirim + havuzda **etiketli/öne çıkarılmış** kart (örn. "size bildirildi" rozeti).
  - Müşteri tarafında: vaka feed'inde **"teklif gelenler" en üstte ayrıştırılmış** olarak listelenir.
- Sonraki süreç bilinen akıştır: usta vakaya teklif yollar. Teklifte randevu önerisi de gelir (etiket bazlı: "bugün", "yarın", "önümüzdeki hafta" gibi geniş müsaitlik etiketleri — sabit gün/saat değil; takvim dozu yok).
- Müşteri teklifi kabul ederse → ödeme yöntemi → ödeme → usta randevuyu onaylayınca eşleşme.
- Diyelim başka bir lastikçi daha ucuz teklif yolladı. Müşteri onu kabul ederse: **"kabul et"** → ödeme yöntemi → ödeme → eşleşme. Müşteri istek üretmez, kabul seçer.

---

## 5. Vaka Süreci (Eşleşme Sonrası)

> **Vaka süreci, oluşturulmuş bir vakaya servis–usta atandığında başlayan süreçtir.**

- Ödeme miktarı bellidir (eşleşme öncesi netleşmiştir).
- Süreç yönetimi platform tarafındadır.
- Vaka sürecinin yönetimi, platformun **ileride puanlamaya dahil edeceği** önemli bir adımdır.

Vaka türüne göre süreç farklıdır:

- **Çekici:** Vaka süreci aracın doğru yere bırakılmasıyla biter.
- **Araç arızası / rektifiye:** Daha uzun, çok adımlı bir süreç. Tek seferde bitmez.

### Pattern Tabanlı Süreç Takibi

Burada da pattern'ler üzerinden ilerleyeceğiz:

- Hasara göre uygulama bir pattern oluşturacak.
- Bu pattern **iki tarafın da görebileceği** şekilde tasarlanmış olmalı.
- Vaka eşleşmesinden sonlanmasına kadarki süreci takip eder. Vaka öncesiyle ilgilenmez.
- Bu ekranda **iki taraf** vardır. İki taraf vaka sürecini birlikte yönetir.

### Örnek — Rektifiye Pattern'i

Rektifiye gibi uzun süreçler için zengin pattern:

1. Araç teslim alındı.
2. Araç söküldü.
3. Hasar tespiti yapıldı.
4. Parça listesi çıkarıldı.
5. İhtiyaçlar netleşti.
6. ... (devamı)

Adım adım süreç takip edilir.

### Adım Ekleme Yetkisi

Süreç adımlarının **sahibi ustadır.** Sadece usta süreç içinde bilgi amaçlı ek adım ekleyebilir; çünkü işin teknik akışını bilen usta. Müşteri ek adım eklemez — eklenmiş adımlara yorum/sözel geri bildirim yapabilir, ama akışa müdahale etmez. (Müşterinin de adım eklemesi pratik değer üretmez, çakışma riski getirir.)

Eklenen adım:
- timeline/event olarak kaydedilir
- müşteri tarafından görülebilir
- ücreti değiştirmez (kapsam revizyonu ayrı kanaldır — bkz. §6)
- süreci açıklar; puanlamada güven sinyali olabilir.

### Sade Pattern Örneği

Çoğu vaka için pattern sadedir:

1. Teslim alındı
2. Tamir yapıldı
3. Teslim edildi

Usta araya ek adım eklemek isterse ekleyebilir.

### Süreç Sonu

- Vaka puanlanır.
- Onaylanmış kapsamı kapatan **final fatura** ödemesi yapılır (eğer eşleşme anında tahsil edilmediyse). Vaka completed olur.
- "Ek ödeme" diye ayrı bir adım yoktur — kapsam genişlemesi yaşanmışsa o ayrı bir kapsam onayıdır (bkz. §6), kapanış adımı değildir.

---

## 6. Ek Ödeme — Kavram Revizyonu (Önemli Karar)

Vaka süreci içerisinde başlangıç teklifinden bağımsız "ek ücret" çıkabilir. Ürün kararı:

> **Naro normal kullanıcı deneyiminde "ek ödeme" diye bir akış sunmaz.** Usta teklifini en üstten ve net vermek zorundadır. Eğer süreçte gerçek kapsam değişikliği olursa, bu **"ek ödeme" değil, "kapsam revizyonu / yeni onay"** olarak konumlandırılır.

Pratik kural seti:

| Kavram | İzin | Açıklama |
|---|---|---|
| Sürpriz ek ücret | ❌ Hayır | Platform "iş başladı, ekstra para çıktı" varsayılan davranışı sunmaz |
| Kapsam netleştirme | ⚠️ Sınırlı | Teşhis sonrası parça/işçilik genişlemesi → açık, gerekçeli, audit-edilebilir bir approval olarak sunulur |
| Final fatura | ✅ Evet | Başta kabul edilen teklif veya onaylanmış kapsamı kapatan ödeme |
| Platform dışı ekstra | ⚪ Naro yönetmez | İstisnai durumlarda taraflar dışarıda çözer; Naro sadece takip notunu tutabilir |

UX/dil kuralları:

- **"Ek ödeme" dili kaldırılır.** Yerine: "Kapsam onayı / Yeni onay / Final fatura" başlıkları.
- Kapsam revizyonu approval'ında **gerekçe alanı zorunlu** olmalı (usta neyi neden eklediğini açıkça yazar).
- Müşteri tarafında "sürpriz ek ücret" hissi yaratan modal/CTA yok; bunun yerine "İşin kapsamı genişledi: [gerekçe]" şeklinde bilinçli kabul.
- Backend tarafında parts/invoice approval altyapısı **kalır** (model + state + PSP authorize); ama copy + UI flow + zorunlu gerekçe alanı yeniden tasarlanır.
- Usta onboarding ve eğitiminde: "Teklifin en üstten ve net olsun; kapsam revizyonu istisnaidir, gerekçesizse uygulanmaz."

Sonuç: Müşteri açısından sürpriz ek ücret hissi yok; sistem açısından gerçek kapsam revizyonları audit-edilebilir kalır.

---

## 7. Özet — Vaka Omurgası Tek Cümlede

> **Vaka, kullanıcının aracıyla başlattığı; havuz veya canlı dispatch yoluyla bir servisle eşleşen; ödeme eşleşmenin son adımı olan; iki tarafın birlikte yürüttüğü ve puanladığı, platform içi bir süreçtir. Ek ödeme yoktur; usta teklifi en üstten yapar.**

---

## 8. Açık Kararlar

(Önceki bazı sorular cevaplandı — kapatıldı işaretlendi.)

1. ~~Sigorta dosyası ayrı modül mü, vaka altı relation mı?~~ **Karar:** hasar vakası alt relation'ıdır; ayrı vaka türü değil. (Bkz. genişletilmiş §12.)
2. **Açık:** Pattern tanımlarının kanonik kaynağı — backend `workflow_blueprint` (canonical) + FE presentation config + BE validation öneriliyor; nihai karar V1.1.
3. **Açık:** Puanlama kriterleri ve ağırlıkları (süreç adımları + sonuç + zaman). Önce çekirdek 5 yıldız + yorum, ağırlıklı sinyaller V1.1.
4. **Açık:** "Ustaya vaka bildir" butonu — vaka olmasa da girilebilen mini-flow olacak (akış §4'te tarif edildi); UX detay tasarım turunda netleşecek.
5. ~~Planlı çekici havuz/teklif modeli mi, dispatch mi?~~ **Karar:** V1'de dispatch modeli (havuza düşmez, teklif yok). Çekici teklif pazarı V1.1 backlog.
6. **Açık:** Planlı çekici ödeme penceresi açıldı ama ödenmediyse timeout süresi — varsayılan 30 dk öneriliyor (sonra otomatik iptal); PO onayı bekliyor.
7. **Açık:** Çekici iptal fee matrisi — stage'e göre oranlar (SEARCHING'de 0%, EN_ROUTE'da %50, ARRIVED+sonrası %100 öneri); kod tarafında `compute_cancellation_fee` fonksiyonu var, oran tablosu PO onayı bekliyor.
