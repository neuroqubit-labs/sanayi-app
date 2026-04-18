# 13 — Mobil Akis ve Ikna Patternleri

> Ilgili dokumanlar: 11-MOBIL-DENEYIM-VIZYONU, 12-MOBIL-UX-ILKELERI, 04-ODEME-SISTEMI

---

## Bu dokumanin amaci

Bu dokuman, Sakin mobil urununde yuksek kalite hissi ve daha guclu tamamlanma oranlari uretmek icin kullanilabilecek somut akis ve UX pattern'lerini listeler.

Buradaki yaklasim "dark pattern" degildir. Amac, kullanicinin lehine olan aksiyonlari daha gorunur, daha kolay ve daha tatmin edici hale getirmektir.

Ozellikle odeme, duyuru ve talep akislarinda "nereye bassam" hissini ortadan kaldiracak; yerine "tamam, yapmam gereken belli" hissini koyacak pattern'ler hedeflenmistir.

---

## 1. Tek Bakista Durum Karti

Ana ekranda kullaniciya tek cümlede en kritik durumu gosteren buyuk bir hero kart kullanilir.

Ornek:

- `Bu ay 2 odemen bekliyor`
- `1 talebin islemde`
- `Yeni duyuru seni etkiliyor`

Ana aksiyon:

- `Simdi Ode`
- `Talebi Gor`
- `Duyuruyu Ac`

Neden etkili:

- Dashboard'i bilgi panosundan cikarir
- Kullaniciya ilk 3 saniyede yon verir
- Kararsizligi azaltir

---

## 2. Odeme Icın Dogrudan Eylem Kartı

Borclar listesi icinde her satira minik aksiyon koymak yerine, odenmesi en anlamli tutari one cikar.

Ornek:

- `Toplam gecikmis borcun 1.620 TL`
- Alt metin: `Bu odemeyle tum gecikmis kalemleri kapatirsin`
- CTA: `Tek Islemde Ode`

Neden etkili:

- Kullanici hesap yapmak zorunda kalmaz
- "Hangisini odeyeyim?" sorusunu sistem cevaplar
- Odeme baslatma anini hizlandirir

---

## 3. Toplu Kapatma Pattern'i

Birden fazla acik borc varsa, listeleme yerine "toplu rahatlama" cümlesiyle sunulur.

Ornek:

- `2 borc, 1 islem`
- `Bugun kapat, ayi temiz bitir`
- `Tumunu Ode`

Neden etkili:

- Isin zorlugunu degil bitis hissini satar
- Kullanicinin kucuk kararlara bolunmesini engeller
- Ozellikle mobilde odeme donusumunu artirir

---

## 4. Ilerleme ve Rahatlama Dili

Odeme ekraninda yalnizca tutar gostermek yerine, eylemin sonucunu anlatan rahatlatici bir dil kullanilir.

Ornek mikro metinler:

- `Bu odemeden sonra gecikmis borcun kalmayacak`
- `Toplam borcunun yarisini kapatmis olacaksin`
- `Makbuz otomatik kaydedilecek`

Neden etkili:

- Sayi odakli kuru deneyimi anlam odakli deneyime cevirir
- Kullaniciya odemenin hayattaki etkisini anlatir
- Guven ve tatmin duygusunu guclendirir

---

## 5. Odeme Sonrasi Kutlama Ama Kontrollu

Odeme basarili ekranlari sadece "basarili" yazmamalidir. Yumusak bir kutlama, net sonuc ve sonraki adim ayni yerde verilmelidir.

Ornek:

- Baslik: `Tamamlandi`
- Alt metin: `Odemen alindi, borc durumun guncellendi`
- Ikincil satir: `Makbuzun hazir`
- Aksiyonlar:
  - `Makbuzu Gor`
  - `Ana Ekrana Don`

Neden etkili:

- Islem sonrasinda kullaniciyi boslukta birakmaz
- Basarinin sisteme kaydedildigini hissettirir
- Premium urun hissini ciddi sekilde yukseltebilir

---

## 6. Askida Kalan Isi Yuzeye Cikarma

Kullanici yarim biraktigi isi uygulama tekrar acildiginda gormelidir.

Ornek:

- `Dun baslattigin odeme tamamlanmadi`
- `Talebine yonetimden henuz donus gelmedi`
- `Son duyuruyu okumadin`

Ana aksiyon:

- `Devam Et`
- `Durumu Kontrol Et`
- `Simdi Oku`

Neden etkili:

- Uygulama kullaniciyi hatirliyor hissi yaratir
- Kopan akislar daha az kaybolur
- Tekrar girislerin anlami olur

---

## 7. Akilli Sabit CTA

Alt tab ya da ana ekran altinda sabit duran buton, statik olmamali; baglama gore degismelidir.

Ornek senaryolar:

- Borc varsa: `Simdi Ode`
- Borc yoksa, acik ticket varsa: `Talebimi Gor`
- Hic kritik durum yoksa: `Yeni Talep Olustur`

Neden etkili:

- Kullaniciya her an "en mantikli hareket" gosterilir
- Sabit buton dekor olmaktan cikar
- AI-cagi urun hissi burada guclenir

---

## 8. Bildirimi Icerikten Eyleme Donusturme

Bildirim ekrani pasif liste olmamali. Her bildirimin anlamli bir sonucu olmalidir.

Ornek:

- `Aidat odemen yaklasiyor` -> `Odeme Ekranini Ac`
- `Talebine cevap geldi` -> `Detayi Gor`
- `Yeni duyuru var` -> `Oku`

Neden etkili:

- Bildirimler okunup unutulan icerik olmaktan cikar
- Kullanici her bildirimi bir sonraki aksiyonla bagdastirir
- Gereksiz sayfa gecisleri azalir

---

## 9. Talep Olusturma Akisinda Yuku Azaltma

Talep ekranlari genelde form agirlidir. Bizde bu alan hizli rahatlama hissi vermelidir.

Pattern:

- Ilk ekranda tam form degil, 3 hizli kategori
- Sonra akilli alt secimler
- En son serbest metin

Ornek:

- `Sorun neyle ilgili?`
  - `Asansor`
  - `Temizlik`
  - `Guvenlik`
  - `Diger`

Neden etkili:

- Form korkusunu azaltir
- Kullaniciya ilerliyor hissi verir
- Gonderim oranini arttirir

---

## 10. Kritik Olaylara Kademeli Oncelik

Her sey ayni siddette gosterilmemelidir. Odeme, duyuru ve talep durumlari kademeli oncelik sistemine sahip olmalidir.

Seviye onerisi:

- Seviye 1: Bugun aksiyon gerektiriyor
- Seviye 2: Yakinda ilgilenmen gerekecek
- Seviye 3: Bilgilendirme

UI karsiliklari:

- Seviye 1: buyuk kart + dolu CTA
- Seviye 2: orta kart + net ikincil aksiyon
- Seviye 3: liste satiri ya da hafif rozet

Neden etkili:

- Her sey bagirmaz
- Gercek oncelik anlasilir
- Kullanici yorulmaz

---

## 11. Guven Veren Bekleme Durumlari

Ozellikle odeme ve callback anlarinda "bekleniyor" durumlari guven tasimalidir.

Ornek:

- `Odeme sonucu kontrol ediliyor`
- `Bu islem birkac saniye surebilir`
- `Lutfen ekranı kapatma, sonuc birazdan netlesecek`

Neden etkili:

- Kullanici belirsizlikte kalmaz
- Geri donup tekrar tekrar deneme davranisi azalir
- Teknik surec, insani dile cevrilir

---

## 12. Sifir Borc Anini Degerlendirme

Kullanici borcsuz kaldiginda bos bir ekran gormemeli. Bu an, urunun pozitif duygusunu kurmak icin firsattir.

Ornek:

- `Su an acik borcun yok`
- `Her sey duzende gorunuyor`
- Aksiyon:
  - `Son Odemelerimi Gor`
  - `Duyurulara Gec`
  - `Yeni Talep Olustur`

Neden etkili:

- Bos durumlari premium alana cevirir
- Uygulamayi "borc uygulamasi" olmaktan cikarir
- Daha dengeli bir urun duygusu verir

---

## 13. Geri Donusumlu Hatirlatma Desenleri

Hatirlatmalar tek tip push mantigiyla calismamali. Kullanici davranisina gore geri donusumlu olmalidir.

Ornekler:

- `Odemen hazir, 1 dakikada tamamlanir`
- `Gecikmis borcun var, tek islemde kapatabilirsin`
- `Yarim kalan odemen icin kaldigin yer hazir`

Neden etkili:

- Hatirlatma yalnizca uyari degil, eylem daveti olur
- Kuru finans dili yerine tamamlanabilirlik hissi yaratir
- Mobil geri donusunu guclendirir

---

## 14. Etik ikna icin uygulanabilir ornek metinler

Asagidaki metinler yonlendiricidir ama kullaniciyi kandirmaz:

- `Bugun kapat, gecikmeyi buyutme`
- `Tek odemeyle tum acik kalemleri temizle`
- `Makbuzun aninda hazir olacak`
- `Talebin acildi, takibini buradan yapabilirsin`
- `Yeni duyuru seni ilgilendiriyor olabilir`
- `Islem tamamlaninca borc listesi otomatik guncellenecek`
- `Son adim: odemeyi onayla`
- `Devam eden surecin burada seni bekliyor`
- `Halletmen gereken tek sey bu`
- `Bir dakikada tamamlanir`

Bu metinlerin amaci baski yaratmak degil, karar esigini dusurmektir.

---

## Oncelikli uygulama sirasi

Bu pattern'ler ayni anda uygulanmak zorunda degildir. En yuksek etki sirasi soyle onerilir:

1. Dashboard'i karar merkezine cevirme
2. Odeme ana karti ve toplu odeme dili
3. Odeme sonuclarinin premium hale getirilmesi
4. Askida kalan islerin yeniden yuzeye cikarilmasi
5. Bildirimlerin eylem odakli hale getirilmesi
6. Talep olusturma akisinin sade ve hizli hale getirilmesi

Bu siralama, hem kullanici algisini hizli iyilestirir hem de odeme ve takip gibi cekirdek deger akislarina once dokunur.
