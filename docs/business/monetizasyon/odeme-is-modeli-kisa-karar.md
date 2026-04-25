# Naro Ödeme İş Modeli — Kısa Karar Notu

**Tarih:** 2026-04-25
**Statü:** Ürün + backend + servis app için karar özeti
**İlgili:** [odeme-modeli-yasal-cerceve.md](odeme-modeli-yasal-cerceve.md), [gelir-modeli.md](gelir-modeli.md)

## 1. Temel Karar

Naro ödeme almak isteyen servisleri **pazaryeri alt üye işyeri** modeliyle onboard eder. Müşteri Naro içinde ödeme yapar; ödeme sağlayıcı parayı ilgili servis/çekici alt hesabına aktarır. Naro isterse komisyon alır, istemezse komisyonu `0` tutar.

Başlangıç politikası:

- **Naro komisyonu:** `0`
- **PSP işlem maliyeti:** ayrı maliyet; kimin üstleneceği ürün/fiyat politikasında net gösterilir.
- **Hedef:** Önce güvenli ödeme altyapısını kurmak, sonra komisyon oranını açmak.

## 2. Kim Ödeme Hesabı Açmak Zorunda?

Ödeme hesabı herkese kayıt anında zorunlu değildir. Ancak servis aktif iş almak istiyorsa standart gerekliliktir; müşteri platformdan ödeme seçebilmeli.

Zorunlu olduğu durumlar:

- Çekici çağrısı kabul edip uygulama içi ödeme almak.
- Kampanya/paket oluşturup online satmak.
- Bakım/tamir/hasar sürecinde teklif vermek, randevu kabul etmek veya uygulama içinden tahsilat almak.

Zorunlu olmadığı durumlar:

- Sadece profil oluşturmak.
- Sadece public profilde görünmek.
- Profil, galeri, sertifika ve kapsam bilgisi düzenlemek.
- Şirketsiz/bireysel usta olarak portföy göstermek; bu kullanıcı aktif iş/online ödeme kapılarına geçmek isterse ödeme hesabı gerekir.

## 3. Servis Tipleri

### Şirketli / Vergi Mükellefi Servis

Online ödeme alabilir. Ödeme hesabı tamamlandığında:

- `subMerchantKey` alınır.
- Çekici/kampanya/online tahsilat açılır.
- Hakediş ödeme sağlayıcı üzerinden servise aktarılır.

### Şirketsiz Bireysel Usta

Online ödeme alamaz. Platformda şu şekilde kalabilir:

- Profil ve portföy gösterebilir.
- Uygunsa teklif/randevu alabilir.
- Ödeme iş yerinde veya platform dışı gerçekleşir.

Bu tip kullanıcı çekici veya kampanya gibi online ödeme gerektiren ürünü açmak isterse ödeme hesabı ve gerekli ticari bilgiler istenir.

### Çekici

Çekici işi doğası gereği uygulama içi ödeme/ön provizyon ister. Bu yüzden çekici online olmak istiyorsa ödeme hesabı zorunludur.

## 4. Akış Bazında Ödeme Modeli

### Çekici

Varsayılan: **online ödeme zorunlu**

Akış:

1. Müşteri çekici talebi oluşturur.
2. Backend fiyat/tavan tutarı hesaplar.
3. Ödeme veya ön provizyon alınır.
4. Ödeme başarılıysa dispatch başlar.
5. İş teslim edilince final tutar kesilir veya sabit tutar kapatılır.

Not: Preauth + capture uzun vadede ideal. Eğer PSP marketplace ile preauth/split kısıtlıysa ilk fazda sabit fiyat/direct capture düşünülebilir.

### Kampanya / Paket

Varsayılan: **online ödeme zorunlu**

Akış:

1. Servis kampanya/paket açar.
2. Fiyat backend kampanya kaydından gelir.
3. Müşteri satın alır.
4. Ödeme `direct_capture` ile alınır.
5. Kampanya satın alma/randevu/vaka kaydı oluşturulur.

Burada fiyat UI’dan gönderilmez; sadece `campaign_id` gönderilir.

### Bakım / Tamir / Hasar

Varsayılan: **online ödeme opsiyonel**

İki model desteklenir:

- **Online ödeme:** Usta teklif/fatura/onarım bedeli gönderir, müşteri uygulamada öder.
- **İş yerinde ödeme:** Usta ve müşteri süreç takibini Naro’da yürütür, ödeme dükkanda yapılır.

Bu akışta müşteri üç seçenek görür:

- **Naro ile online ödeme:** önerilen yol; Naro komisyonu uygulanabilir.
- **Serviste kart:** ödeme servis POS'u ile alınır; Naro komisyonu doğmaz, vaka geçmişine “serviste kart” olarak işlenir.
- **Nakit:** ödeme servis dışında gerçekleşir; Naro komisyonu doğmaz, vaka geçmişine “nakit” olarak işlenir.

Servis aktif iş almak için ödeme hesabını tamamlar; offline ödeme müşterinin seçimidir, ödeme hesabı gerekliliğini kaldırmaz.

## 5. Komisyon Modeli

Başlangıçta üç ayrı kavramı ayırıyoruz:

- **Müşteri bedeli:** Müşterinin ödediği toplam tutar.
- **Servis hakedişi:** Servise aktarılacak tutar.
- **Naro komisyonu:** Platform geliri.

Başlangıç örneği:

```text
Müşteri öder: 1.000 TL
Servis hakedişi: 1.000 TL
Naro komisyonu: 0 TL
PSP işlem maliyeti: sözleşmeye göre servis, müşteri fiyatı veya Naro üstlenir
```

İleride:

```text
Müşteri öder: 1.000 TL
Servis hakedişi: 900 TL
Naro komisyonu: 100 TL
PSP işlem maliyeti: sözleşmeye göre netleştirilir
```

## 6. Servis App Ayarlar Ekranı

Servis app içinde “Ödeme hesabı” bölümü olmalı.

Durumlar:

- `not_started`: Başlamadı
- `draft`: Bilgi giriliyor
- `submitted`: Başvuru gönderildi
- `pending_review`: Ödeme sağlayıcı onayı bekleniyor
- `approved`: Ödeme almaya hazır
- `rejected`: Reddedildi / düzeltme gerekli
- `disabled`: Devre dışı

UI davranışı:

- Çekici online olmak isterse ve ödeme hesabı yoksa “Ödeme hesabını tamamla” engeli çıkar.
- Kampanya oluşturmak isterse ve ödeme hesabı yoksa kampanya ödeme alacak şekilde yayınlanamaz.
- Bakım/tamir için online ödeme açmak isterse ödeme hesabı zorunlu olur.
- Offline ödeme/randevu/profil akışları ödeme hesabı olmadan devam edebilir.

## 7. Ürün İlkesi

Kullanıcıyı baştan bürokrasiye boğma. Para alacağı anda gerekliliği anlat.

Doğru cümle:

> Uygulama içinden ödeme alabilmek için ödeme hesabını tamamlaman gerekiyor.

Yanlış cümle:

> Naro’ya kayıt olmak için şirket hesabı şart.

## 8. Açık Kararlar

1. PSP işlem maliyeti ilk fazda kimden düşecek?
2. Şirketsiz ustalar hangi vaka türlerinde teklif verebilecek?
3. Çekici için V1 fiyat modeli preauth/tavan mı, sabit bölge fiyatı mı olacak?
4. Kampanya satın alma ilk fazda doğrudan randevu mu, yoksa kupon/paket hakkı mı üretecek?
5. Komisyon açıldığında oran sabit mi, kategori bazlı mı olacak?
