# Sanayi App: UX Uyarlama Cercevesi

## 1. Amaç

Bu dokumanin amaci, `design-doc` icindeki yuksek kalite mobil urun prensiplerini mevcut Sanayi App yapisina uyarlamaktir.

Buradaki hedef sifirdan baska bir urun tasarlamak degildir. Hedef:

- mevcut sayfa yapisini korumak
- mevcut ana bilgi mimarisini bozmamak
- ama her ekrani daha dogru aksiyon ureten, daha guven veren ve daha premium hissettiren bir hale getirmek

Bu nedenle bu dokuman bir "yeniden tasarla" plani degil; bir "aynı iskeleti guclendir" planidir.

## 2. Referanslardan Alinacak Cekirdek Prensipler

`design-doc` icindeki en guclu prensipler Sanayi App icin de birebir degerlidir:

- dashboard degil karar merkezi
- her ekranda tek baskin aksiyon
- sistemin sonraki mantikli adimi tahmin etmesi
- yarim kalan isin yeniden yuzeye cikmasi
- etik ikna ile kararsizligi azaltma
- bilgi yiginindan cok hiyerarsi kurma
- premium his icin ritim, tutarlilik ve kontrollu hareket

Bu prensipleri dogrudan koruyoruz.

## 3. Domain Farki: Neyi Oldugu Gibi Alamayiz

Referans urunde odeme ve bina operasyonu merkeziydi. Bizde ise cekirdek gerilim farkli:

- arac yolda kalabilir
- tamir gereksiz yere buyutulebilir
- kullanici ustaya guvenemeyebilir
- cekici ve teslim anlari kritik olabilir
- tekrar kullanim ancak rahatlik ve kayit hafizasi ile saglanir

Bu nedenle ayni prensipleri korurken dili ve oncelikleri su sekilde kaydiriyoruz:

- finansal netlik -> servis guveni + is netligi
- borc karti -> aktif vaka / bakim ihtiyaci karti
- odeme rahatlamasi -> "isim halloluyor" rahatlamasi
- ticket takibi -> tamir sureci ve kanit takibi
- bildirimden eyleme gecis -> vaka ve tekliften eyleme gecis

## 4. Korunacak Mevcut Yapi

Asagidaki ana yapi korunmalidir:

- Ana tablar:
  - Home
  - Kayitlar
  - Ustalar
  - Profil
- Alt akışlar:
  - Hasar bildirimi
  - Bakim talebi
  - Usta swipe / listeleme
  - Teklif
  - Hasar / servis takip
  - Bildirimler
  - Destek

Bu secim dogrudur. Sorun bilgi mimarisinin varligi degil; bu ekranlarin henuz tam olarak "karar yuzeyi" gibi davranmamasidir.

## 5. Yeni UX Tezi

Sanayi App kullaniciya su hissi vermelidir:

- Aracimla ilgili ne oldugunu anliyorum
- Su an yapmam gereken tek seyi goruyorum
- Usta secimi rastgele degil, aciklanmis bir karar gibi geliyor
- Tamir sureci beni disarida birakmiyor
- Bu uygulama sadece baglanti kurmuyor, beni koruyor

Kisa urun cumlesi:

`Sanayi App, usta bulan degil; aracin isini guvenle bitiren mobil operasyon yuzeyi olmalidir.`

## 6. Sayfa Bazli Uyarlama

## 6.1 Home

Bugunku rol:

- hizli erisim
- son aktiviteler
- aktif durumlar

Gelistirilmis rol:

- kullanicinin bugun neyi halletmesi gerektigini gosteren karar merkezi

Home'da yeni hiyerarsi:

1. Hero durum karti
2. Tek baskin aksiyon
3. Devam eden surec ozeti
4. Ikincil operasyonlar

Ornek hero durumlari:

- `Motor sesi vakanda 3 teklif hazir`
- `Aracin serviste: bugun parca onayi gerekiyor`
- `Bakim zamani geldi: 1 dakikada talep acabilirsin`
- `Cekici yolda: 11 dk sonra ulasiyor`

Home icin ana kural:

Ana ekranda en fazla 1 birincil, 2 ikincil konu yuksek gorunurluk almali. Kalan her sey asagi katmanlarda kalmali.

## 6.2 Kayitlar

Bugunku rol:

- bakim, hasar, fatura, belge gecmisi

Gelistirilmis rol:

- aracin hafiza merkezi

Burada referans dokumandaki "bos durumun bile premium hissettirmesi" prensibi kritik.

Kayitlar ekraninda ana fark su olmali:

- gecmis sadece liste degil, guven birikimi olarak sunulmali
- aktif is kaybolmamalı
- kullanici "bu arac icin her sey burada birikiyor" hissini almali

Oncelikli pattern'ler:

- aktif vaka her zaman en ustte sabit bir operasyon karti
- tamamlanmis islerde sonuc + garanti + fatura baglantisi
- fatura ve belge sekmeleri yalniz arsiv degil, "koruma katmani" gibi hissedilmeli

## 6.3 Ustalar Listeleme

Bugunku rol:

- servis kartlari, filtreler, arama

Gelistirilmis rol:

- neden oneri aldigini anlatan karar listesi

Bu ekran sadece su bilgileri gostermemeli:

- puan
- mesafe
- fiyat bandi

Su sorulari da cevaplamali:

- bu usta neden bana gosteriliyor
- bu vaka icin neden uygun
- platform beni burada nasil koruyor

Kart ustu sinyaller:

- `Bu ariza tipinde guclu`
- `BMW motor vakalarinda yuksek basari`
- `Tahmini plan ile uyumlu teklif veriyor`
- `Pickup mevcut`
- `Garanti belgeli`

Liste UX'i icin ana kural:

Kart bilgi karti degil, karar karti olmali.

## 6.4 Swipe

Bugunku rol:

- usta kesfi
- rozetli kartlarla secim

Gelistirilmis rol:

- hizli ama guvenli eslestirme arayuzu

Bu ekran referans dokumandaki "tek baskin aksiyon" ilkesine cok uygun. Ama karar daha aciklanmis olmalidir.

Kartta bulunmasi gereken katmanlar:

1. Neden onerildi
2. Guven sinyali
3. Hiz / uygunluk
4. Tahmini is plani ozeti
5. Ana karar

Onerilen metin tonlari:

- `Bu vaka icin guclu eslesme`
- `Son 30 benzer isin 27'sini zamaninda tamamladi`
- `AI tahminiyle uyumlu fiyat bandinda`
- `Istersen once detaylari ac, sonra karar ver`

Bu ekranin amaci "eglenceli swipe" degil; dusuk zihinsel yukle karar verdirmek olmalidir.

## 6.5 Hasar Flow

Bugunku rol:

- hasar tipi
- medya
- detay
- ozet

Gelistirilmis rol:

- niyet toplama ve guvenli vaka acma akisi

Burada referans dokumandaki "talep ekranlari form gibi degil, yardim aliyormus gibi hissettirmeli" ilkesi birebir uygulanmali.

Akis dili:

- `Sorun ne?`
- `Bize gostermen yeterli`
- `Birkaç detay daha ekleyelim, ustalar daha net teklif versin`
- `Hazir, simdi en uygun ustalari bulabiliriz`

Bu akista her adim kullaniciya su hissi vermeli:

- zor form doldurmuyorum
- yardim sistemini besliyorum
- biraz sonra daha iyi bir sonuc alacagim

## 6.6 Bakim Flow

Bugunku rol:

- bakim tipi
- tercihler
- ozet

Gelistirilmis rol:

- tekrar eden bakim ihtiyacini hizla talebe ceviren akilli kisayol

Bakim akisi, hasar akisina gore daha sessiz ama daha hizli calismalidir.

Ana prensipler:

- onceki bakim bilgisi hatirlanmali
- varsayilan secimler akilli olmali
- tekrar eden kararlar azaltilmali
- sonucu tek cumlede anlatilmali

Ornek:

- `Son bakimina gore periyodik bakim zamani geldi`
- `Bu hafta icin teklif toplayabiliriz`

## 6.7 Bildirimler

Bugunku rol:

- gelen olaylari listeleme

Gelistirilmis rol:

- eylem merkezi

Referans dokumandaki en dogrudan alinacak pattern bu.

Her bildirimin net bir sonraki aksiyonu olmali:

- teklif geldiyse `Teklifi Gor`
- servis guncellendiyse `Durumu Ac`
- fatura yuklendiyse `Belgeleri Incele`
- bakim zamani geldiyse `Talep Ac`

Bildirimler okunup gecilen bir inbox olmamali; kullaniciyi tekrar ilgili akisina sokan bir operasyon listesi olmalidir.

## 6.8 Profil

Bugunku rol:

- araclarim
- hesap
- destek

Gelistirilmis rol:

- guven ve sahiplik merkezi

Profil ekrani asagidaki seyleri hissettirmeli:

- araclarim burada guvende
- odeme ve iletisim bilgilerim kontrol altinda
- destek ve gecmis kayitlar kaybolmaz

Profil bir ayarlar coplugu olmamali. Daha sakin, daha premium ve daha "sahiplik" hissi veren bir alan olmali.

## 7. Uyarlanacak Pattern'ler

Referans dokumanlardan alinip Sanayi App'e cevrilecek pattern'ler:

### Tek Bakista Durum Karti

Home'un en ustunde tek bir baskin vaka veya is karti.

Sanayi uyarlamasi:

- `Aracin serviste: bugun onay gerekiyor`
- `3 teklif hazir`
- `Cekici 11 dk uzakta`

### Askida Kalan Isi Yuzeye Cikarma

Uygulamaya donen kullanici yarim kalan isini gorur.

Sanayi uyarlamasi:

- `Dun gelen teklifi henuz incelemedin`
- `Bakim talebin hazir, gondermen kaldi`
- `Servis son guncellemeyi paylasti`

### Akilli Sabit CTA

Sabit CTA varsa statik kalmamalidir.

Sanayi uyarlamasi:

- aktif teklif varsa `Teklifleri Gor`
- serviste is varsa `Sureci Ac`
- kritik bir sey yoksa `Yeni Talep Baslat`

### Kademeli Oncelik

Her olay ayni siddette gosterilmez.

Sanayi uyarlamasi:

- Seviye 1: cekici, aktif onay, kritik guncelleme
- Seviye 2: teklif geldi, bakim zamani yaklasti
- Seviye 3: bilgilendirme, arsiv, genel hatirlatma

### Guven Veren Bekleme Durumlari

Ozellikle teklif, odeme, servis guncellemesi beklerken.

Sanayi uyarlamasi:

- `Ustalar bilgilerini inceliyor`
- `Teklifler birazdan netlesecek`
- `Servis guncellemesi kontrol ediliyor`

## 8. Yeni Mikro Metin Tonu

Bu urunde copy dili:

- net
- guven veren
- aceleci olmayan
- yonlendiren
- gerektiginde rahatlatan

Kacinilacak ton:

- asiri kurumsal
- teknik ve soguk
- baskici
- fazla parlak reklam dili

Dogru ornekler:

- `Su an halletmen gereken tek sey bu`
- `Uygun ustalar tekliflerini hazirliyor`
- `Bu adimdan sonra sureci buradan takip edebilirsin`
- `Islem kayda gecti`
- `Fatura ve garanti bilgileri burada saklanacak`

## 9. Gorsel Davranis Kurallari

Mevcut sayfa yapisi korunurken su ortak dil olusturulmalidir:

- Hero bloklari ile standart kartlar ayrik gorunmeli
- Birincil CTA'lar sayfa basina en yakin karar noktasinda olmali
- Durum rozetleri anlamsal olarak sabitlenmeli
- Kart icindeki bilgi yogunlugu azaltılmali, gerekce ve aksiyon one cikarilmali
- Hareketler hafif ve tutarli kalmali

Kisa kural:

Her sayfa ilk bakista "durum -> ana aksiyon -> neden" sirasi ile okunmali.

## 10. Uygulama Sirasi

Yapinin bozulmamasi icin ekranlar su sirayla ele alinmalidir:

1. Home
2. Bildirimler
3. Ustalar liste + swipe
4. Hasar flow
5. Bakim flow
6. Kayitlar
7. Profil

Bu siralama dogrudur cunku:

- once karar merkezi guclenir
- sonra geri donus ve aksiyon kapilari netlesir
- daha sonra secim ve talep akislarina inilerek cekirdek urun davranisi guclenir

## 11. Ekran Degerlendirme Filtresi

Her ekran revizyonu su 6 sorudan gecmelidir:

1. Kullanici ilk 3 saniyede burada ne yapacagini anliyor mu?
2. Ekranda tek baskin aksiyon var mi?
3. Bir sonraki mantikli adim yuzeye cikiyor mu?
4. Guven duygusu bilgiyle degil deneyimle kuruluyor mu?
5. Bu ekran mevcut bilgi mimarisini bozmadan gucleniyor mu?
6. Bu ekran "uygulama kullandim" yerine "isim ilerledi" hissi veriyor mu?

Ikiden fazla hayir varsa ekran yeniden ele alinmalidir.

## 12. Sonuc

Bu uyarlama cercevesinin ana karari sudur:

Biz referans dokumanlardaki premium mobil urun dilini alip onu Sanayi App'in guven, teklif, tamir ve arac hafizasi odakli gercegine uyarlayacagiz.

Yani:

- ayni kalite prensipleri korunacak
- ama odak odeme degil servis guveni olacak
- ayni karar mimarisi korunacak
- ama karar nesnesi borc degil vaka, teklif ve surec olacak
- ayni premium sadelik korunacak
- ama bunu sayfa yapisini bozmadan uygulayacagiz
