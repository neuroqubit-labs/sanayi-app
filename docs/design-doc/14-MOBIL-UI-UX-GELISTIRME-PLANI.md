# 14 — Mobil UI/UX Gelistirme Plani

> Ilgili dokumanlar: 11-MOBIL-DENEYIM-VIZYONU, 12-MOBIL-UX-ILKELERI, 13-MOBIL-AKIS-VE-IKNA-PATTERNLERI, 06-FRONTEND-MIMARISI

---

## Bu planin amaci

Bu plan, `client/mobile` icin yalnizca ekran makyaji degil; urunun tamaminda hissedilen kaliteyi ve kullanicinin akisa giris kolayligini artiran bir UI/UX donusum yol haritasi tanimlar.

Plan mevcut altyapiyi ve eldeki bulgulari girdi olarak kullanir, ancak dogrudan mevcut dosya yapisi ya da bugunku ekran sinirlarina bagli kalmaz. Yani hedef "mevcut ekranlari biraz parlatmak" degil; Sakin mobilin karar yapisini, bilgi hiyerarsisini, aksiyon yuzeylerini ve kalite hissini yeniden kurmaktir.

---

## Planin cikis noktasi

Bugunku mobil urun is goruyor, ancak su alanlarda kalite acigi var:

- Ana ekran bilgi veriyor ama yon vermiyor
- Odeme akisi teknik olarak calisiyor ama premium hissettirmiyor
- Bildirim, duyuru ve talep akislarinin karar hiyerarsisi zayif
- Ekranlar tek sistemin parcasi gibi degil, birbirinden ayri isler gibi hissedebiliyor
- Kullanici bazi anlarda "neye basmaliyim?" sorusunu kendi cevaplamak zorunda kaliyor

Bu planin hedefi, uygulamayi "fonksiyon gosteren mobil app" seviyesinden "dusunulmus karar yuzeyi" seviyesine tasimaktir.

---

## North star

Sakin mobil, kullanicinin evle ilgili kritik islerini en az zihinsel yukle, en net aksiyon hiyerarsisiyle ve en yuksek guven hissiyle tamamladigi premium bir operasyon yuzeyi olmalidir.

Kisa urun cumlesi:

`Sakin, bilgi gosteren degil; isi bitiren bir mobil deneyim olmalidir.`

---

## Planin tasarim prensipleri

Bu yol haritasi su prensiplere baglidir:

- Her ekranda tek baskin aksiyon
- Ana ekranin dashboard degil karar merkezi olarak calismasi
- Odeme akislarinda guven, rahatlama ve netlik duygusunun birlikte tasarlanmasi
- Aksiyonlarin baglama gore yuzeye cikmasi
- Kullanici davranisini yonlendiren ama guveni zedelemeyen etik ikna pattern'leri
- Tasarim sistemi, hareket dili ve mikro metinlerde tam tutarlilik

---

## Altyapidan alinacak girdiler

Bu plan teknik yapidan kopuk degildir; ama teknik backlog gibi yazilmamistir.

Planin beslendigi mevcut urun yetenekleri:

- Auth + session omurgasi
- Aidat / borc listeleme
- Odeme baslatma ve odeme gecmisi
- Duyuru ve bildirim akislarinin temeli
- Ticket / talep olusturma ve listeleme
- Theme token, ortak component ve query altyapisi

Bu girdiler plani hizlandirir. Ancak plan, bugunku ekranlarin birebir korunmasini varsaymaz. Gerekirse bilgi mimarisi, tab mantigi ve akis sirasi yeniden duzenlenebilir.

---

## Temel hedefler

### Hedef 1 — Ilk 30 saniyede kalite hissi

Kullanici uygulamaya girdiginde ilk yari dakikada sunlari hissetmeli:

- Uygulama sakin ve kontrollu
- Ne yapmam gerektigi net
- Odeme ve takip gibi kritik isler kolaylasmis
- Her sey ayni tasarim dilinden cikmis

### Hedef 2 — Karar yorgunlugunu azaltma

Sakin, kullanicidan daha az dusunmesini istemelidir:

- hangi borcu once odeyecegini sistem onermeli
- hangi duyurunun onemli oldugunu sistem gosterme
- yarim kalan surecler yuzeye cikmali

### Hedef 3 — Finansal guveni yukselme

Odeme akisinda netlik ve kontrol duygusu kesintisiz olmalidir:

- tutar
- neden
- sonuc
- kayit
- sonraki adim

### Hedef 4 — Yardimci akislarin ikincil ama zayif olmamasi

Tickets, duyurular, bildirimler ve profil ekranlari ana odeme deneyiminin yan urunleri gibi degil; ayni urun kalitesini tasiyan destek akislari gibi davranmalidir.

---

## Kapsam

Bu plan su mobil alanlari kapsar:

- Login ve ilk giris hissi
- Dashboard / ana ekran
- Borclar ve odeme kesfi
- Checkout'a gecis ve odeme sonucu
- Odeme gecmisi ve makbuz odakli akislar
- Duyurular ve bildirimler
- Talep olusturma ve talep takibi
- Profil / hesap / baglam alanlari
- Bos durumlar, hata durumlari, loading, motion ve mikro metinler

Bu plan bu asamada su alanlari kapsamaz:

- Tamamen yeni backend modulleri
- Pazarlama / onboarding kampanya sayfalari
- Admin paneli ile ortak UI paketlestirme calismasi

---

## Urun mimarisi onerisi

Mevcut mobil urun islevlerini koruyarak ama deneyimi sadeleştirerek su bilgi mimarisi hedeflenmelidir:

### 1. Home

Amac:

- kritik durumu gostermek
- bir sonraki dogru aksiyonu vermek
- yarim kalan sureci hatirlatmak

Icerik:

- hero durum karti
- toplu odeme veya tek ana aksiyon
- acik ticket / yeni duyuru / son islem ozeti

### 2. Borclar ve Odemeler

Amac:

- odeme kararini hizlandirmak
- listeyi degil onceligi gostermek

Icerik:

- toplam acik tutar
- gecikmis / yaklasan / odenmis ayrimi
- toplu odeme dili
- odeme gecmisi ve makbuz gecisi

### 3. Talepler

Amac:

- sorun bildirmeyi kolaylastirmak
- kullaniciya surecin takip edildigini hissettirmek

Icerik:

- acik ticket ozeti
- hizli kategori secimi
- guncel durum cizgisi

### 4. Bildirimler

Amac:

- pasif liste yerine eylem yuzeyi olmak

Icerik:

- duyuru / sistem / talep geri donusu ayrimi
- her kartin bir sonraki aksiyonu
- okundu / kritik / beni etkiliyor hiyerarsisi

### 5. Profil

Amac:

- hesap, daire baglami, guven ve cikis kontrolunu sade bir alanda toplamak

---

## Ana is akislari

UI/UX donusumu su 5 ana akis uzerinden yurutulmelidir:

### A. Ilk giris ve geri donus

Hedef:

- kullanicinin uygulamaya dondugunde kaldigi zihinsel noktadan devam etmesi

Plan:

- login ekranini sade ve premium hale getirme
- cold start'ta ana durum karti ile acilis
- yarim kalan odeme / okunmamis duyuru / acik talep sinyallerini yuzeye cikarma

### B. Odeme karari

Hedef:

- "Hangisini odeyeyim?" yerine "Bunu odersen en dogru isi yapmis olursun" hissi

Plan:

- toplu odeme CTA'si
- kritik borcu one cikar
- borc bilgisini finansal guven diline cevir

### C. Odeme tamamlama

Hedef:

- checkout oncesi, sirasinda ve sonrasinda belirsizlik birakmamak

Plan:

- checkout gecisini netlestirme
- bekleme anlarinda guven veren durum dili
- basarili odeme sonucunu premium tamamlama ekranina cevirme

### D. Sorun bildirme ve takip

Hedef:

- form dolduruyormus gibi degil, yardim aliyormus gibi hissettirmek

Plan:

- kategori tabanli hizli giris
- acik ticket'in ana ekranda ozeti
- talep sonucunu kullanicinin takip edebilecegi sekilde gosterme

### E. Bildirimden eyleme gecis

Hedef:

- her bildirim, mantikli bir aksiyon kapisi olmali

Plan:

- duyurulari okuma listesi olmaktan cikar
- odeme / ticket / duyuru aksiyonlarini bildirim kartlarina bagla

---

## Is paketleri

Bu plan 6 ana is paketine ayrilmalidir.

### Paket 1 — UX audit ve karar mimarisi

Cikti:

- mevcut ekran envanteri
- her ekran icin ana niyet tanimi
- kaldirilacak, birlestirilecek, guclendirilecek alanlar
- yeni bilgi mimarisi ve tab mantigi

Odak:

- kullanici nereye bassam hissini nerede yasiyor
- hangi ekranlar bilgi yuku uretiyor
- hangi aksiyonlar yeterince guclu degil

### Paket 2 — Mobil design system 2.0

Cikti:

- tipografi hiyerarsisi
- spacing ve ritim sistemi
- kart grameri
- CTA sistemi
- durum rozetleri
- loading / error / success pattern seti
- hareket ve gecis dili

Odak:

- premium his
- tutarlilik
- ekranlar arasi ortak davranis

### Paket 3 — Home ve odeme deneyimi yeniden tasarimi

Cikti:

- yeni home bilgi hiyerarsisi
- hero durum karti
- akilli sabit CTA mantigi
- odeme listesi ve toplu odeme kurgusu
- odeme sonucu ekranlari

Odak:

- karar netligi
- odeme donusumu
- finansal guven

### Paket 4 — Talep, duyuru ve bildirim akislarinin birlestirilmesi

Cikti:

- ticket giris akis tasarimi
- duyuru / bildirim oncelik modeli
- bildirimi eyleme ceviren kart yapisi
- acik surec ve geri donus odakli ekranlar

Odak:

- yardimci akislarin da premium hissettirmesi
- kullaniciya surekli anlamli ilerleme hissi vermek

### Paket 5 — Mikro metin ve tone of voice sistemi

Cikti:

- button label seti
- bos durum metinleri
- hata ve bekleme metinleri
- odeme oncesi / sonrasi copy kit'i
- reminder / nudge dil rehberi

Odak:

- netlik
- guven
- yumusak ama karara goturen yonlendirme

### Paket 6 — Prototip, validasyon ve olcumleme

Cikti:

- prototip akislari
- 5-7 kullanicilik hizli test turu
- analytics event plan'i
- once / sonra kalite ve tamamlama metrikleri

Odak:

- ekip ici begeni yerine gercek davranis
- sezgisel kullanimi dogrulamak

---

## Fazlandirma onerisi

Bu donusum 4 fazda ilerlemelidir.

### Faz 0 — Tanim ve hizalama

Sure:

- 3-5 gun

Cikti:

- north star onayi
- ekran envanteri
- oncelikli 3 akis secimi
- tasarim dili referans seti

Tamamlanma olcutu:

- ekip, neyi neden degistirdigini ortak dilde anlatabiliyor olmali

### Faz 1 — Yapisal yeniden kurulum

Sure:

- 1 hafta

Cikti:

- yeni bilgi mimarisi
- tab ve nav yapisi
- home wireframe'leri
- odeme akisi wireframe'leri
- design system temel karar seti

Tamamlanma olcutu:

- kullanici ilk bakista ana aksiyonu anliyor mu sorusuna tasarim seviyesinde evet denebilmeli

### Faz 2 — Cekirdek deneyim tasarimi ve implementasyon

Sure:

- 2 hafta

Kapsam:

- home
- borclar / odeme
- checkout durumu
- odeme sonucu
- odeme gecmisi

Tamamlanma olcutu:

- odeme akisinda belirsiz veya fazladan gorunen her adim gerekcelendirilebilmeli

### Faz 3 — Destek akislarinin premium hale getirilmesi

Sure:

- 1-2 hafta

Kapsam:

- tickets
- bildirimler
- duyurular
- bos durumlar
- profil / baglam

Tamamlanma olcutu:

- ikincil akislar artik cekirdek deneyimin zayif halkasi gibi hissettirmemeli

### Faz 4 — Hareket, copy ve validasyon

Sure:

- 1 hafta

Kapsam:

- motion polish
- mikro metin son tur
- test cihaz dogrulamasi
- event takipleri

Tamamlanma olcutu:

- urun, tek tek ekranlarin toplamindan ziyade tek parca hissettirmeli

---

## Ekran bazli teslimatlar

### Home

Teslimatlar:

- kritik durum hero karti
- birincil CTA mantigi
- yarim kalan surec modulu
- ikincil kartlarin oncelik sirasi

### Borclar ve Odemeler

Teslimatlar:

- toplam borc ozeti
- gecikmis / yaklasan / odenmis segment yapisi
- toplu odeme karti
- checkout oncesi guven paneli

### Odeme Sonucu

Teslimatlar:

- success
- pending
- failure
- tekrar dene / makbuz / ana ekrana don aksiyon mantigi

### Duyurular ve Bildirimler

Teslimatlar:

- kategori mantigi
- oncelik seviyesi
- eylem bagli kart tasarimi

### Talepler

Teslimatlar:

- hizli kategori secimi
- ticket kart sistemi
- durum zaman cizgisi
- bos durum ve acik surec ekranlari

### Profil

Teslimatlar:

- hesap ozeti
- daire baglami
- guven / cikis / destek alanlari

---

## Basari metrikleri

Plan yalnizca estetik ciktiyla degil, davranisla olculmelidir.

Birinci seviye metrikler:

- home'dan odeme akisina gecis orani
- odeme baslatma -> odeme tamamlama orani
- yarim kalan odemelerin geri kazanimi
- bildirimden ilgili aksiyona gecis orani
- ticket olusturma tamamlama orani

Ikinci seviye metrikler:

- kullanicinin ana aksiyonu bulma suresi
- destek ihtiyaci doguran hata anlari
- tekrar girislerde devam eden surece donus orani
- premium his / netlik / guven uzerine kisa nitel test notlari

---

## Tasarim review kapilari

Her ana akis su 6 soruyla review edilmelidir:

1. Bu ekranda tek baskin aksiyon var mi?
2. Kullanici ne yapacagini 3 saniyede anliyor mu?
3. Burada gereksiz karar yuku var mi?
4. Finansal ya da operasyonel guven hissi yeterince guclu mu?
5. Bu ekran onceki ve sonraki ekranla ayni sistemden cikmis gibi mi?
6. Bu akis kullaniciyi yoruyor mu, yoksa ileri itiyor mu?

Bu sorulardan ikisine zayif cevap veriliyorsa ekran revizyona donmelidir.

---

## Uygulama disiplini

Bu plan uygulanirken su sira korunmalidir:

1. Karar mimarisi
2. Wireframe
3. Yuzey tasarimi
4. Mikro metin
5. Motion
6. Implementasyon
7. Kullanim testi

Dogrudan koda girip sonra UX duzeltmeye calismak bu planin ruhuna terstir. Once davranis, sonra gorunum, sonra implementasyon gelmelidir.

---

## Onerilen ilk sprint

Ilk sprintte en yuksek etki icin su 5 parca hedeflenmelidir:

1. Home karar merkezi wireframe'i
2. Borclar / toplu odeme bilgi hiyerarsisi
3. Odeme sonucu durum ekranlari
4. Ticket hizli giris akisinin sade prototipi
5. Mikro metin ve CTA dili icin ilk copy kit

Bu paket dogru cikarsa urunun kalitesi daha ilk iterasyonda gozle gorulur bicimde degisir.

---

## Ozet

Bu planin ana fikri basittir:

Sakin mobil daha fazla ekranla degil, daha iyi yonlendiren ekranlarla buyumelidir.

Odak, kullanicidan tik eksiltmek degil; her tiki anlamli, dogal ve dogru anda gelen bir aksiyona donusturmektir. Eger bunu basarirsak uygulama sadece daha guzel gorunmeyecek, daha olgun, daha guvenilir ve daha premium hissedecektir.
