# Mobil V1 RC QA Checklist

Bu dokuman, `client/mobile` icin RC oncesi son kalite turunun tek referansidir.
Hedef yalnizca bug bulmak degil; yeni shell, premium yuzey dili ve odeme akislarinin
gercek cihazda tutarli hissettirdigini dogrulamaktir.

## 1. Build Hazirligi

- `mobile-ci` workflow'u yesil olmali.
- `pnpm --filter=@sakin/mobile typecheck`
- `pnpm --filter=@sakin/mobile lint`
- `pnpm --filter=@sakin/mobile test -- --runInBand`
- `.github/workflows/mobile-preview.yml` uzerinden en az bir `preview` Android build alinmali.
- QA cihazi olarak en az:
  - kucuk Android ekran
  - buyuk Android ekran

## 2. Zorunlu Fonksiyonel Senaryolar

### Auth ve oturum

- Login ekrani aciliyor mu
- SMS/login veya dev bypass ile giris tamamlanabiliyor mu
- Basarili giris sonrasi `Bugun` aciliyor mu
- Uygulama kapat-ac sonrasi session korunuyor mu
- `Hesap -> Cikis Yap` sonrasi login ekranina donuluyor mu
- 401 benzeri oturum dusmesi sonrasi uygulama auth ekranina temiz donuyor mu

### Smart CTA ve shell

- `Bugun` ekraninda 3 saniye icinde tek baskin aksiyon gorunuyor mu
- `resume_payment` durumunda CTA `Durumu Kontrol Et` gosteriyor mu
- `pay_overdue` durumunda CTA `Simdi Ode` gosteriyor mu
- `pay_due` durumunda CTA `Odeme Yap` gosteriyor mu
- Borc yokken CTA `Son Odemeler` fallback'ine dusuyor mu
- Floating CTA safe area, tab bar ve alt gesture alanina carpismiyor mu

### Odeme akisi

- `Bugun -> Islerim` gecisi dogru hissettiriyor mu
- `Islerim` icinden odeme baslatilabiliyor mu
- WebView odeme yuzeyi aciliyor mu
- WebView manuel kapatilinca kullanici bosta kalmiyor mu
- `success` callback sonrasi durum ekrani aciliyor mu
- `failure` callback sonrasi tekrar deneme yolu net mi
- `unknown` callback sonrasi `Durumu Yenile` akisi calisiyor mu
- Basarili odeme sonrasi `Odeme Gecmisi` kaydi dogru gorunuyor mu

### Child flow parity

- `Bugun -> Talepler` akisi calisiyor mu
- Yeni talep modal'i aciliyor ve kapanabiliyor mu
- Bos talep durumu premium ve net gorunuyor mu
- `Bugun/Hesap -> Duyurular` akisi calisiyor mu
- Duyuru detay modal'i aciliyor ve kapanabiliyor mu
- `Hesap` ekranindan `Odeme Gecmisi`, `Talepler`, `Duyurular` gecisleri calisiyor mu

## 3. Gorsel QA Seti

Her cihaz icin asagidaki ekranlardan screenshot alin:

- Login
- Bugun
- Islerim
- Odeme WebView
- Odeme sonucu: success
- Odeme sonucu: failure veya unknown
- Odeme gecmisi
- Talepler liste
- Yeni talep modal'i
- Duyurular liste
- Duyuru detay modal'i
- Hesap

Her screenshot icin su noktalar kontrol edilir:

- Safe area dogru mu
- Tab bar yuksekligi dogal mi
- Floating CTA cakisma yaratiyor mu
- Tipografi ritmi tutarli mi
- Kartlar ayni tasarim ailesine mi ait
- Bosluklar ekranin ust ve altinda dengesiz mi
- Modal ve sheet acilislari eski uygulama hissi veriyor mu
- Empty / loading / error durumlari hala premium mu

## 4. Klavye ve Form Kontrolleri

- Login telefon input'u klavye ile kapanmiyor mu
- Login kod girisi klavye acikken rahat gorunuyor mu
- Yeni talep modal'inda `Baslik` ve `Aciklama` input'lari klavye altina kacmiyor mu
- Uzun aciklama yazarken scroll ve keyboard davranisi bozulmuyor mu

## 5. Triage Kurallari

### P0

- Login olunamamasi
- Odeme baslatilamamasi
- Success/failure/unknown sonuc ekraninin acilmamasi
- Sign out sonrasi auth'a donememe
- Uygulamayi bloklayan crash

### P1

- Smart CTA'nin yanlis state gostermesi
- Payment history'nin yanlis veya eksik guncellenmesi
- Child flow'lara erisimin kirik olmasi
- Safe area veya tab bar nedeniyle kritik butonun kullanilamamasi
- Premium shell ile child flow arasinda belirgin gorsel kopukluk

### P2

- Mikro spacing problemleri
- Ikinci seviye metin tonlari
- Shadow, radius, icon veya motion polish eksikleri
- Kucuk copy duzeltmeleri

P0 ve P1 bug'lar kapanmadan RC kabul verilmez.

## 6. Bug Kayit Formati

Her bug su formatla kaydedilir:

- `ID`: MOB-RC-001
- `Seviye`: P0 / P1 / P2
- `Ekran`: Bugun / Islerim / Login / vs
- `Cihaz`: ornek `Pixel 6`
- `Build`: preview build numarasi
- `Adimlar`: kisa tekrar adimlari
- `Beklenen`: ne olmaliydi
- `Gorulen`: ne oldu
- `Ek`: screenshot veya video linki

## 7. RC Kabul Kapilari

Asagidaki kosullar birlikte saglanmadan RC kabul edilmez:

- Tum otomatik kontroller yesil
- Android preview build alinmis
- Screenshot turu tamamlanmis
- Cekirdek odeme akislari blocker'siz gecmis
- Sign out ve cold start manuel dogrulanmis
- Shell ile child flow'lar arasinda belirgin gorsel kopukluk kalmamis
- Acik kalan maddeler yalnizca P2 seviyesinde

## 8. Cikis

QA turu bittiginde su iki cikti uretilir:

- `RC bug listesi`
- `post-RC polish backlog`

RC bug listesi yalniz P0/P1 maddeleri icerir.
post-RC polish backlog ise merge blocker olmayan P2 iyilestirmelerini toplar.
