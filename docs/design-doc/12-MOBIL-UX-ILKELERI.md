# 12 — Mobil UX Ilkeleri

> Ilgili dokumanlar: 11-MOBIL-DENEYIM-VIZYONU, 06-FRONTEND-MIMARISI, 04-ODEME-SISTEMI

---

## Bu dokumanin amaci

Bu dokuman, `client/mobile` urununde alinacak UX kararlarinin ortak cercevesini tanimlar. Amac, tek tek ekranlari guzellestirmek degil; tum urunde ayni karar kalitesini ureten ilkeleri sabitlemektir.

Buradaki ilkeler, "daha az tik" hedefiyle degil; "daha dogru anda, daha dogru aksiyon" hedefiyle yazilmistir.

---

## Ilke 1 — Ekran bilgi degil niyet gostermeli

Her ekran kullaniciya once "burada ne yapabilirim?" sorusunun cevabini vermelidir.

Yanlis yaklasim:

- Cok sayida kart
- Karma liste
- Belirsiz durum etiketleri
- Birbiriyle yarisan CTA'lar

Dogru yaklasim:

- Tek baskin mesaj
- Tek ana aksiyon
- Ikinci seviye bilgiler sonradan acilan katmanlarda

Ornek:

- Dashboard: `Toplam bekleyen borcun 3.240 TL` + `Simdi Ode`
- Tickets: `1 acik talebin islemde` + `Detayi Gor`

---

## Ilke 2 — Bir ekranda tek baskin aksiyon olmali

Kullaniciya secim vermek ile kullaniciyi kararsiz birakmak ayni sey degildir.

Her ekranda:

- 1 ana aksiyon
- Gerekirse 1 yardimci aksiyon
- Kalanlar daha dusuk vurgulu alanlarda

Bu, gorsel sadeligi degil; karar netligini uretir.

Ornek:

- Odeme kartinda `Simdi Ode`
- Basarili odemede `Makbuzu Paylas`
- Hata durumunda `Tekrar Dene`

---

## Ilke 3 — Sistem dogru sonraki adimi tahmin etmeli

Kullanici her seferinde ne yapacagini planlamak zorunda kalmamali. Sistem, baglama gore bir sonraki en mantikli adimi yuzeye cikarmalidir.

Ornek sinyaller:

- Gecikmis borc varsa ana kartta odeme CTA'si
- Aktif ticket varsa dashboard'ta durum ozeti
- Yeni duyuru varsa "okunmamis" etiketiyle one cikarma
- Odeme basarisizsa tekrar deneme ya da destek aksiyonu

Bu ilke, AI-cagi urun mantigina en yakin yerdir: arayuz kullanicidan komut beklemez, niyeti tahmin edip yonlendirir.

---

## Ilke 4 — Yuksek frekansli akislarda surtunme acik gerekce olmadan artirilmaz

Login, borc gorme, odeme baslatma, talep olusturma gibi yuksek frekansli ya da kritik akislarda her ek adim bir bedeldir.

Bu nedenle:

- Tekrarlayan veri isteme azaltilmali
- Varsayilanlar akilli secilmeli
- Onceki secim hatirlanmali
- Giris noktasi ile aksiyon noktasi arasi gereksiz kopmalar kaldirilmali

Azaltma kör bir hedef degildir. Bazen ek bir adim, guven duygusunu guclendirir. Dogru soru sunlardir:

- Bu adim kullanici icin netlik uretiyor mu?
- Bu adim hata riskini dusuruyor mu?
- Bu adim guven hissini arttiriyor mu?

Ucluye de hayirsa bu adim fazladir.

---

## Ilke 5 — Finansal akislarda duygu da tasarlanir

Odeme yalnizca teknik bir islem degildir. Kullanici burada para, gecikme, sorumluluk ve rahatlama duygulari tasir.

Bu nedenle odeme UX'i:

- Ciddi ama soguk olmamali
- Guvenli ama burokratik olmamali
- Hizli ama aceleci olmamali

Dogru ton:

- "Toplam borcun hazir"
- "Bu odemeyle gecikmis tutari kapatirsin"
- "Islem tamamlandi, makbuz kaydedildi"

Yanlis ton:

- Asiri resmi ve uzak kurumsal metinler
- Teknik hata odakli kirmizi yogun ekranlar
- Basariyi duygusuz gecen durum ekranlari

---

## Ilke 6 — Bilgi yogunlugu degil, hiyerarsi onemlidir

Az bilgi gostermek tek basina iyi UX degildir. Onemli olan kullanicinin neyi once, neyi sonra gorecegidir.

Bu nedenle her ekranda su katmanlar net olmali:

1. Durum
2. Ana aksiyon
3. Gerekce / destekleyici bilgi
4. Gecmis / detay / alternatif aksiyonlar

Ornek odeme karti:

1. `1.620 TL gecikmis borc`
2. `Simdi Ode`
3. `Son odeme tarihi geceli 4 gun oldu`
4. `Detayi Gor`

---

## Ilke 7 — Mikro metinler rehber gibi davranmali

Button label, bos durum metni, yukleniyor durumu, hata metni ve basari ekrani; UX'in ana parcasi kabul edilmelidir.

Metinler sunlari yapmali:

- Kullaniciya ne oldugunu anlatmali
- Sonraki adimi gostermeli
- Kaygiyi azaltmali
- Belirsizligi kapatmali

Ornek:

- `Islem suruyor` yerine `Odeme sonucu kontrol ediliyor`
- `Basarili` yerine `Odemen alindi, borc listesi guncelleniyor`
- `Error` yerine `Baglanti kurulamadigi icin odeme sonucu alinamadi`

---

## Ilke 8 — Hareket ve gecisler sadece estetik icin kullanilmaz

Animasyonun gorevi:

- Hangi katmanin aktif oldugunu anlatmak
- Bir aksiyonun sonucunu hissettirmek
- Odağı dagitmadan gecisi yumusatmak

Sakin'de hareket:

- Hafif
- Kisa
- Sessiz
- Duruma hizmet eden

Odeme, tab degisimi, modal acilisi ve basari durumlari bu sistemle birlestirilmelidir. Rasgele spring efektleri ya da farkli ekranlarda farkli hareket dili kullanilmamalidir.

---

## Ilke 9 — Guven duygusu ekranin her katmaninda korunur

Mobil urunde kullanici su iki alanda en hassastir:

- Para
- Evle ilgili operasyonlar

Bu nedenle guven duygusu su sinyallerle uretilir:

- Acik tutar gosterimi
- Beklenir sonuc
- Asla kaybolmayan durum bilgisi
- Geri donus yolu
- Teknik degil insani hata metni
- Basarili tamamlanmis islemin kayda gectigini hissettirme

Guven, sadece SSL ve auth ile degil; arayuzun belirsizlik yaratmamasiyla kazanilir.

---

## Ilke 10 — Etik ikna, kararsizligi azaltmak icin kullanilir

Sakin kullaniciyi kandiran dark pattern'lere basvurmamalidir. Ancak kullanicinin erteledigi ama aslinda onun lehine olan aksiyonlari guclu sekilde yuzeye cikarmak gerekir.

Bu etik ikna cizgisi sunlardir:

- Gecikmis borcu onceliklendirmek
- Toplu odeme imkani sunmak
- Tamamlanmamis talebi tekrar gorunur kilmak
- Duyuruya "beni etkiliyor" seviyesinde oncelik vermek
- Aciliyeti metin ve hiyerarsiyle hissettirmek

Ama sunlar yapilmaz:

- Sahte zaman baskisi
- Gizli masraf
- Belirsiz kapatma aksiyonlari
- Kullaniciyi yaniltan renk veya metinler

Hedef, manipule etmek degil; momentum yaratmaktir.

---

## Ilke 11 — Ana ekran dashboard degil karar merkezi olmali

Ana ekran statik kartlarin dizildigi bir yer degil; kullanicinin bugun neyi halletmesi gerektigini gosteren operasyon merkezi olmalidir.

Ana ekran sirasiyla sunlari cevaplamalidir:

1. Bugun kritik bir sey var mi?
2. Simdi yapmam gereken tek sey ne?
3. Son yaptigim sey neydi?
4. Devam eden bir surecim var mi?

Bu nedenle dashboard kartlari "icerik bloklari" degil, "eylem bloklari" olarak yeniden dusunulmelidir.

---

## Ilke 12 — Premium his, sadelik + ritim + tutarlilikla gelir

Premium his asagidaki unsurlarin toplamidir:

- Dengeli bosluklar
- Net tipografi hiyerarsisi
- Kontrollu renk kullanimi
- Yuksek kontrastli aksiyonlar
- Durumlara gore tutarli ton
- Her ekranda ayni dokunsal mantik

Bir ekranin guzel olmasi yetmez. Kullanici uc ekran sonra "bu urun tek elden cikmis" hissini almiyorsa kalite duygusu oturmaz.

---

## Karar filtresi

Mobilde alinacak her UI/UX karari su 5 sorudan gecmelidir:

1. Kullanici ne yapacagini ilk bakista anliyor mu?
2. Bu ekranda tek baskin aksiyon var mi?
3. Bir sonraki mantikli adim yuzeye cikiyor mu?
4. Bu akista belirsizlik veya gereksiz tik var mi?
5. Bu karar urunun butun diliyle tutarli mi?

Bu sorulardan ikisine bile guclu "hayir" cikiyorsa ekran tekrar dusunulmelidir.
