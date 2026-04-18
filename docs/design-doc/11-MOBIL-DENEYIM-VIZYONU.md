# 11 — Mobil Deneyim Vizyonu

> Ilgili dokumanlar: 06-FRONTEND-MIMARISI, 04-ODEME-SISTEMI, customer-expectations/EXPECTATION-BRIEF.md

---

## Bu dokumanin amaci

Sakin mobil uygulamasi bugun temel islevleri yerine getiriyor: borc gosteriyor, odeme baslatiyor, duyuru ve talep akislarini aciyor. Ancak islevsel olmak ile kaliteli hissettirmek ayni sey degil.

Bu dokumanin amaci, `client/mobile` icin yalnizca "daha guzel gorunen" bir arayuz degil; kullanicinin daha ilk 10 saniyede kalite, guven, duzen ve yonlendirilmislik hissettigi bir mobil deneyim vizyonu tanimlamaktir.

Hedef, klasik bir "tap tap tap" uygulamasi degil. Hedef, kullanicinin dusunmeden ilerledigi ama her adimda urunun onu anladigini hissettigi bir deneyimdir.

---

## Urun vaadi

Sakin, sakin icin "bina uygulamasi" gibi gorunen bir arac degil; evle ilgili kritik isleri sessizce duzenleyen bir guven katmani gibi hissettirmelidir.

Kullanici uygulamaya girdiginde su hissi almali:

- Nerede oldugumu biliyorum
- Simdi ne yapmam gerektigini anliyorum
- En dogru aksiyon bana zaten gosteriliyor
- Odeme, takip, talep gibi isler yorucu degil; net ve kontrollu
- Bu uygulama aceleyle yapilmamis, dusunulmus

Bu his, sadece renk veya tipografiyle degil; ekran akisi, odak hiyerarsisi, aksiyon siralamasi, mikro metinler ve gecis davranisiyla olusur.

---

## Tasarim pozisyonu

Sakin mobil uygulamasi iki uc noktaya dusmemelidir:

- "Kurumsal panel kucultulmus mobil versiyon" hissi
- "Asiri dekoratif ama islevi dagitan startup demosu" hissi

Gitmek istedigimiz cizgi sunlardir:

- Dogrudan sadelik
- Premium sakinlik
- Guven veren finansal netlik
- Yumusak ama karar aldiran yonlendirme
- Tek tek ekranlar yerine butunsel urun dili

Apple kalitesinden alinacak ders minimal gorunum degil; yapidan kopmayan tutarliliktir. Her ekran farkli bir tasarim denemesi gibi degil, ayni sistemin farkli yansimalari gibi gorunmelidir.

---

## AI cagi icin yorum

Yeni nesil urunlerde buton ile islev artik birbirinden ayri dusunulmuyor. Kullanici butona basip sonra ne yapacagini dusunmek istemiyor. Arayuz, sonraki en mantikli aksiyonu dogrudan yuzeye cikararak karar yukunu azaltmali.

Bu nedenle Sakin'de:

- CTA'lar sabit dekoratif butonlar degil, baglamsal karar motorlari gibi calismali
- Kartlar sadece bilgi gostermemeli, eylem baslatmali
- Durum alanlari "okunacak metin" degil, "ne yapman gerektigini anlatan sinyal" olmali
- Ana ekran pasif bir dashboard degil, yonlendiren bir operasyon yüzeyi olmali

Kisaca: kullanici bilgi gormek icin degil, isin bitmesi icin uygulamaya giriyor. Arayuzun gorevi bu bitisi hizlandirmak.

---

## Deneyim hedefleri

### 1. Ilk bakista netlik

Ana ekranda 3 saniye icinde anlasilmayan hicbir kritik durum kalmamali.

Kullanici aninda gormeli:

- Toplam borcum var mi?
- Acil odemem var mi?
- Bekleyen talebim var mi?
- Yeni duyuru ya da beni ilgilendiren bir durum var mi?

### 2. Karar yorgunlugunu azaltma

Her ekranda tek baskin aksiyon olmali. Ikinci ve ucuncu aksiyonlar gorunur olabilir ama karar dagitmamali.

Ornek:

- "2 gecikmis borc" kartinda ana aksiyon `Simdi Ode`
- "Talep olustur" ekraninda ana aksiyon `Hemen Gonder`
- "Odeme basarili" ekraninda ana aksiyon `Makbuzu Gor`

### 3. Guven ve kontrol

Finansal urun hissi yalnizca guvenlikten degil, odenen tutarin, kalan bakiyenin, odeme durumunun ve bir sonraki adimin net gosterilmesinden gelir.

Kullanici su sorularin cevabini her zaman bulabilmeli:

- Ne odeyecegim?
- Neyi odedim?
- Neden odedim?
- Odeme basarisizsa ne olacak?
- Bu islem kayda gecti mi?

### 4. Sessiz yonlendirme

Urun, kullaniciyi bagirarak degil; isigi dogru yere tutarak yonlendirmeli.

Bu, etik ama guclu bir ikna tasarimidir:

- Oncelikli odemeyi yuzeye cikarma
- Geciken isi belirsiz liste icinde kaybetmeme
- Kullaniciya "hemen halledilebilirlik" hissi verme
- Basarili tamamlamayi odullendirme

### 5. Akis butunlugu

Login, dashboard, odeme, bildirim ve talep ekranlari farkli ekipler tarafindan ayri ayri tasarlanmis gibi hissettirmemeli.

Su alanlarda tek dil olmalidir:

- Bosluk ve ritim
- Kart davranisi
- Ana / ikincil aksiyon renkleri
- Durum etiketleri
- Gezis mantigi
- Basari, hata, bekleme tonlari

---

## Anti-hedefler

Sakin mobil urunu asagidaki desenlerden bilerek uzak durmalidir:

- Her ekrana farkli "hero" ve farkli kart dili koymak
- Kritik odeme aksiyonunu kalabalik ekranin icine gommek
- Kullaniciya cok secenek verip dogru secenegi aratmak
- Listeyi bilgiyle doldurup aksiyonu saklamak
- Hata anlarinda yonlendirme yerine yalnizca teknik mesaj gostermek
- Basarili tamamlanmis isi duygusuz bir "tamam" ile gecistirmek
- Her sorunu daha fazla tap ile cozmek

Bu urunun problemi ozellik eksikliginden cok, oncelik yuzeye cikarma eksikligi olacaktir. Bu nedenle tasarim dili kadar akis koreografisi de birincil konudur.

---

## Hedef deneyim cumlesi

Sakin, kullanicinin evle ilgili kritik islerini en az zihinsel yukle, en yuksek guven hissiyle ve dogru anda sunulan aksiyonlarla tamamladigi bir premium mobil deneyim sunmalidir.

---

## Uygulanabilir sonuc

Bu vizyon, pratikte su anlama gelir:

- Dashboard bilgi yiginindan cikacak, karar ekrani olacak
- Odeme akisinda en dogru aksiyon her zaman tek bakista anlasilacak
- Talep ve bildirim ekranlari ikincil gorunen ama kuvvetli bir operasyon dili kazanacak
- Her ekran ayni tasarim sisteminin parcasi gibi davranacak
- Kullanici "uygulamayi kullandim" demeyecek; "isim halloldu" hissiyle cikacak
