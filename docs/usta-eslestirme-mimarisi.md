# Sanayi Platformu: Usta Eslestirme ve Guven Mimarisi

## 1. Urun Tezi

Bu urun bir "usta listesi" ya da "yerel rehber" olmamalidir. Asil hedef, arac sahibinin bakim ve onarim surecini platform uzerinden yonettigi, guven duydugu ve tekrar tekrar kullandigi bir servis isletim sistemi kurmaktir.

Platform ayni anda 4 problemi cozmelidir:

1. Dogru ustayi dogru vaka ile eslestirmek
2. Musteri ile ustanin platformu atlamasini ekonomik olarak anlamsiz hale getirmek
3. Onarim surecini seffaf ve guvenilir kilmak
4. Komisyon baskisina dayanmadan platformu gelir uretebilir hale getirmek

Bu nedenle mimari, sadece arama ve kaydirma algoritmasi degil; eslestirme, guven, kanit, odeme, sadakat ve AI destekli karar sisteminin birlesimi olarak tasarlanmalidir.

## 2. Stratejik Hedef

Urunun uzun vadeli iddiasi su olmalidir:

- Kullanici "usta bulmak" icin degil, "araciyla ilgili isin guvenli sonucunu almak" icin uygulamaya gelsin
- Usta "reklam gormek" icin degil, "daha kaliteli ve daha hazir musteri almak" icin platformda kalsin
- Cekici, servis, parca ve odeme adimlari tek bir vaka omurgasina baglansin
- AI, tekliflerin ve surecin uzerinde rehberlik etsin ama tek tarafli otorite gibi davranmasin

## 3. Tasarim Ilkeleri

- Admission before distribution: Kalitesiz servis sisteme girmeden elenmeli
- Trust before growth: Buyume, guven katmaninin uzerine kurulmalı
- Evidence over promises: Soz yerine kanit toplanmali
- AI as referee, not dictator: AI yonlendirsin, dayatmasin
- Convenience beats lock-in: Kullaniciyi zorla degil, rahatlikla platformda tut
- Memory compounds value: Aracin gecmisi platformda biriktikce sistem daha degerli hale gelsin

## 4. Ust Duzey Sistem Katmanlari

Platform 6 katmandan olusur:

1. Talep ve niyet toplama katmani
2. Servis kabul ve kalite gecidi
3. Eslestirme ve siralama motoru
4. Vaka orkestrasyonu
5. Guven, kanit, garanti ve odeme katmani
6. Tekrar kullanim ve gelir motoru

Bu katmanlar bagimsiz moduller gibi dusunulmeli ama tek bir olay zinciri uzerinden calismalidir.

## 5. Ana Varliklar

Asagidaki varliklar sistemin cekirdegini olusturur:

- Customer
- Vehicle
- Case
- Provider
- TowProvider
- Quote
- RepairPlan
- EvidenceEvent
- PaymentPlan
- WarrantyRecord
- TrustLedger
- LoyaltyProfile

Buradaki en kritik fark, klasik marketplace yapisindan farkli olarak `Case`, `TrustLedger` ve `Vehicle` merkezli bir mimari kurmaktir. Kullanici degil, aracin gecmisi sistemin buyuyen hafizasi olur.

## 6. Eslestirme Motoru

### 6.1 Iki Katmanli Mantik

Eslestirme motoru iki ayri karar verir:

1. Bu servis bu vakayi gormeye uygun mu
2. Uygunsa diger adaylar arasinda kacınci sirada gosterilmeli

Bu ayrim cok onemlidir. Kalitesiz bir servisin sadece sponsorlu diye listeye girmesi engellenmelidir.

### 6.2 Admission Gate

Bir servis veya cekici platforma alinmadan once asgari sartlari saglamalidir.

Servis admission sinyalleri:

- Vergi ve isletme dogrulamasi
- Fiziksel lokasyon ve atelye kaniti
- Uzmanlik alanlari ve ekipman beyanı
- Marka/model yetkinlik beyanı
- Asgari belge ve fatura disiplini
- Garanti taahhudu
- SLA taahhudu
- Dispute orani
- Platform icinde is tamamlama skoru

Cekici admission sinyalleri:

- Ruhsat ve tasit dogrulamasi
- Operator kimlik dogrulamasi
- Canli konum paylasimi
- Teslim alma ve teslim etme fotograf zorunlulugu
- Zaman damgali log kaydi

Admission mantigi `hard filter` gibi calisir. Esigi gecmeyen adayin puani hesaplanmaz.

### 6.3 Candidate Generation

Siralama oncesi aday havuzu olusturulur. Aday havuzu su sinyallerle daraltilir:

- Lokasyon ve servis kapsama alani
- Ariza veya hasar tipi
- Aracin marka/model uyumu
- Mobil servis veya atelye gereksinimi
- Cekici ihtiyaci
- Anlik kapasite ve is yuku
- Calisma saatleri
- Fiyat segmenti

Bu adim, alakasiz servisleri en basta sistem disina iter.

### 6.4 Ana Skor Fonksiyonu

Uzun vadeli tavsiye edilen puanlama mantigi:

```ts
finalScore =
  0.30 * problemFit +
  0.25 * trustScore +
  0.15 * speedScore +
  0.10 * priceFit +
  0.10 * convenienceScore +
  0.10 * retentionScore +
  sponsoredBoost +
  explorationBoost
```

Buradaki mantik sabit olmamali; vaka tipine gore agirliklar dinamiklesmelidir.

Ornek agirlik kaydirma:

- Cekici ve acil vaka: trust + speed + ETA daha yuksek agirlik alir
- Planli bakim: trust + price + convenience agirligi artar
- Kaza: trust + evidence discipline + insurance compatibility artar
- Premium arac: brand expertise + trust + warranty daha onemli hale gelir

### 6.5 Alt Skorlar

#### problemFit

Bu vaka ile bu servisin gercek uyumunu olcer.

Alt sinyaller:

- Marka/model deneyimi
- Ariza tipi tecrubesi
- Benzer vakalarda basari
- Gerekli ekipman varligi
- Mobil servis uygunlugu
- Kasko/sigorta uyumu

#### trustScore

Ham yildiz puani yerine duzeltilmis guven skoru kullanilmalidir.

Alt sinyaller:

- Bayesian rating
- Yorum sayisi ve kalitesi
- Dispute orani
- Garanti yerine getirme orani
- Kanit yukleme disiplin skoru
- Sonradan fiyat sapmasi orani
- Gec teslim riski

Ana ilke: 5 yorumlu 5.0, 500 yorumlu 4.7'yi kolayca gecmemelidir.

#### speedScore

- Ilk yanit suresi
- Teklif gonderme hizi
- Randevu uygunlugu
- Tahmini tamamlama suresi
- Cekici erisim suresi

#### priceFit

En ucuz servisi degil, kullanicinin niyetine en uygun servisi bulur.

Alt sinyaller:

- Piyasa bandina gore fiyat konumu
- Kullanici tercihi: yakin olsun / ucuz olsun / fark etmez
- Fiyatin AI tahmini ile uyumu
- Sonradan fiyat sisme riski

#### convenienceScore

Platform disina cikmayi azaltan rahatlik sinyalleridir.

- Pickup/drop
- Mobil servis
- Taksit veya odeme esnekligi
- Parca tedariği organizasyonu
- Dijital onay akisi
- Hizli tekrar randevu

#### retentionScore

Bu servis ile bu kullanici arasindaki iliskiyi platform icinde buyutme potansiyelini olcer.

- Platform ici tekrar is gecmisi
- Arac gecmisi devamlılığı
- Favori servis iliskisi
- Garanti kaydinin platformda tutulmasi
- Odeme ve belge akisinin platformda kalma olasiligi

### 6.6 Sponsorlu ve Ozel Urun Mantigi

Sponsorlu urunler siralamaya etki edebilir ama 3 kural vardir:

1. Sadece admission esigini gecen adaylarda calisir
2. `trustScore` belirli bir seviyenin altindaysa boost sifirlanir
3. Boost ust sinirlidir ve etiketli gosterilir

Boylece sponsorlu alan, kotu adayi yukari iten bir manipülasyon degil; iyi adaylar arasinda kontrollu bir gorunurluk araci olur.

Ozel urunler:

- Ayni gun hizmet
- Mobil servis
- Ucretsiz cekici
- Uzatilmis garanti
- Orijinal parca guvencesi
- Hizli teklif
- Premium musteri hattı

Bu urunler arama ve swipe deneyiminde hem filtre hem boost sinyali olarak calisabilir.

### 6.7 Exploration Katmani

Sistem yalnizca mevcut buyuk servisleri buyuturse zamanla korlesir. Bu nedenle kucuk bir exploration katmani gerekir.

Kurallar:

- Yeni servisler sinirli hacimde trafik alir
- Sadece admission esigini gecenler exploration havuzuna girer
- Ilk performans sinyalleri hizla olculur
- Kotu performans gosterirse geri cekilir

Bu, kaliteli yeni atolyelerin sisteme girmesini saglar.

## 7. AI Katmani

AI bu urunde bir chat ozelligi degil; guven arttiran bir karar destek katmani olmalidir.

### 7.1 AI Intake Analyzer

Girdi:

- Fotograf
- Video
- Ses kaydi
- Serbest metin aciklama
- Arac bilgisi
- Gecmis vaka ve bakim kayitlari

Cikti:

- Vaka ozeti
- Muhtemel ariza kategorileri
- Aciliyet skoru
- Cekici ihtiyaci tahmini
- Gerekli uzmanlik etiketleri
- Ilk fiyat ve sure bandi

### 7.2 AI Repair Plan Generator

AI, kullanicinin girdisinden olasi bir tamir plani uretir.

Plan asla zorlayici olmamalidir. Sozlesmesel otorite degil, referans katmandir.

Ornek ciktilar:

- Muhtemel degisecek parcalar
- Muhtemel kontrol adimlari
- Olası iscilik kalemleri
- Tahmini sure
- Riskli belirsizlikler

### 7.3 AI Quote Comparator

Ustanin teklifi ile AI tahminini karsilastirir.

Sonuc kategorileri:

- Uyumlu
- Aciklama gerekli
- Belirgin sapma var

Bu mekanizma hem kullaniciya guven verir hem de ustanin kendisini daha iyi anlatmasini zorunlu kilar.

### 7.4 AI Evidence Auditor

Tamir surecinde yuklenen kanitlari kontrol eder:

- Once / sonra fotograf uyumu
- Parca faturasi ve is kalemi uyumu
- Test ve teslim kanitlari
- Eksik adimlar

### 7.5 AI Service Copilot

Uzun vadeli bagimliligin merkezine burasi oturur.

Platformun asil degeri su olur:

- Aracin dijital hafizasi
- Ne zaman ne degisti bilgisi
- Hangi servis hangi isi nasil yapti bilgisi
- Hangi bakim yaklasiyor tahmini
- Tekrar islerde cok hizli karar destegi

Boylece kullanici tek bir araci degil, tum arac gecmisini platformda tasir.

## 8. Guven ve Kanit Mimarisi

Bu urunde guven, puanlama kadar surec tasarimindan gelir.

### 8.1 Trust Ledger

Her vaka boyunca kanit tabanli olaylar tutulur:

- Teklif gonderildi
- Teklif revize edildi
- Arac teslim alindi
- Cekici varis yapti
- On inceleme tamamlandi
- Parca talebi acildi
- Fatura yüklendi
- Eski parca teslim edildi
- Test tamamlandi
- Arac teslim edildi
- Kullanici onayi alindi

Bu olaylar, sadece gecmis kayit degil; provider trust skorunu besleyen veri kaynagi olur.

### 8.2 Cekici Guven Akisi

Ilk kritik an cekici asamasidir.

Zorunlu adimlar:

- Canli konum takibi
- Aracin alinma aninda fotograf
- Surucu kimlik dogrulamasi
- Teslim aninda fotograf
- Zaman damgasi

Bu akisin eksiksizligi cekici guven skoruna dogrudan etki etmelidir.

### 8.3 Tamir Guven Akisi

Zorunlu kanit adimlari:

- On inceleme ozeti
- Gerekli ise OBD veya test kaydi
- Degisen parca kaniti
- Fatura / belge
- Son kontrol ve teslim kaniti

Tum servisler ayni standarda mecbur tutulursa, kullanici "bu usta dogru mu" yerine "bu sistem beni koruyor mu" sorusuna olumlu cevap verir.

## 9. Platform Disina Cikisi Azaltan Yapilar

Musteri ile ustanin ikinci isten sonra dogrudan bag kurma riski dogaldir. Bunu yasaklarla degil, daha iyi rahatlikla yonetmek gerekir.

Platformda kalmayi degerli yapan unsurlar:

- Arac hafizasi ve servis gecmisi
- Tek tik tekrar randevu
- Favori servis
- Platform icinde garanti takibi
- Korumali odeme ve ihtilaf yonetimi
- Taksit / odeme erteleme
- Pickup/drop lojistigi
- Acil cekici
- Bakim hatirlatma
- Teklif karsilastirma kolayligi

Bu mekanik, "müdavim" davranisini soyut rozetten gercek faydaya cevirir.

## 10. Gelir Modeli

Yuksek komisyonla baslamak, kaliteli servis kazaniminin onune gecirir. Daha saglikli model asamalidir.

### Faz 1

- Dusuk sabit uyelik
- Sponsorlu gorunurluk
- Premium rozetli urunler
- Platform odemesinde kucuk islem ucreti

### Faz 2

- Korumali odeme paketi
- Uzatilmis garanti
- Mobil servis veya pickup/drop komisyonu
- Finansman ve taksit geliri

### Faz 3

- Platformun yarattigi ek talep uzerinden basari primi
- Sigorta, filo, premium arac dikeyleri
- Parca ve garanti paketleri

Asil ilke su: gelir, sadece "usta uzerinden kesinti" degil; sistemin yarattigi guven ve kolayliktan gelmelidir.

## 11. Teknik Uygulama Mimarisi

Bu urun bugunden mikroservis olarak baslamamalidir. En dogru kurulum:

- Ilk asamada modular monolith
- Net domain sinirlari
- Event-first veri modeli
- Daha sonra ihtiyac olursa servis ayrisma

Yani tek bir backend kod tabani icinde su moduller ayrilmalidir:

- Identity and Access
- Vehicle and Customer Profile
- Provider Admission
- Case Management
- Matching and Ranking
- Quote and Negotiation
- Evidence and Trust Ledger
- Payments and Warranty
- AI Orchestrator
- Notifications

### 11.1 Tavsiye Edilen Sistem Akisi

1. Kullanici talep olusturur
2. Case Management vakayi kaydeder
3. AI Orchestrator intake analizi uretir
4. Matching Engine aday havuzu cikarir
5. Ranking Engine adaylari sira ve vitrin mantigiyla dizebilir
6. Quote modulu secili adaylardan teklif toplar
7. Evidence modulu sureci kanitlarla besler
8. Payments modulu odeme ve koruma akislarini yonetir
9. Trust Ledger tum olaylari provider ve case skorlarina geri yazar

### 11.2 Backend Modulleri

#### Case Management

Sorumluluklari:

- Vaka olusturma
- Vaka durumu
- Adim orkestrasyonu
- Servis veya cekici baglama
- Duruma gore workflow secimi

Bu modulu mevcut `lifecycleEngine` mantiginin backend karsiligi gibi dusunebilirsiniz.

#### Matching and Ranking

Sorumluluklari:

- Candidate generation
- Admission checks
- Skorlama
- Sponsorlu ve exploration kurallari
- Ranking snapshot kaydi

Onemli not: Siralama sonucu mutlak veri degil, zaman damgali bir `ranking snapshot` olarak tutulmalidir. Boylece neden kimin one ciktigini geriye donuk okuyabilirsiniz.

#### Provider Admission

Sorumluluklari:

- Evrak ve isletme dogrulamasi
- Uzmanlik ve ekipman profili
- Hizmet kapsama alani
- SLA tanimlari
- Tier ve rozet atamalari

#### Evidence and Trust Ledger

Sorumluluklari:

- Zaman damgali olay kaydi
- Kanit yukleme
- Vaka bazli uyum kontrolu
- Provider trust skoruna veri saglama

#### Quote and Negotiation

Sorumluluklari:

- Teklif toplama
- Teklif revizyonlari
- AI ile karsilastirma
- Onay ve red akisi

#### Payments and Warranty

Sorumluluklari:

- On odeme
- Escrow benzeri korumali odeme
- Asamali tahsilat
- Garanti kaydi
- Ihtilaf durumunda odeme bekletme kurallari

#### AI Orchestrator

Sorumluluklari:

- Intake analyzer
- Repair plan
- Quote comparator
- Evidence auditor
- Risk flag uretimi

AI katmani dogrudan tum modullere dagitilmamali; tek bir orkestrasyon katmani uzerinden cagirilmalidir. Bu, model degisimi ve maliyet yonetimini kolaylastirir.

### 11.3 Veri Katmanlari

Tavsiye edilen veri ayirimi:

- Postgres: operasyonel veri
- Object storage: foto, video, belge, fatura, kanit
- Search index: servis kesfi, filtreleme, metinsel arama
- Queue or event bus: teklif, bildirim, AI gorevleri, trust hesaplama
- Analytics store: KPI, cohort, funnel, retention, dispute analizi

### 11.4 Temel Tablolar

Ilk asamada yeterli cekirdek tablolar:

- customers
- vehicles
- providers
- provider_specialties
- provider_admission_checks
- cases
- case_events
- case_media
- case_ai_insights
- ranking_snapshots
- quotes
- quote_line_items
- evidence_events
- payments
- warranty_records
- disputes
- loyalty_profiles

### 11.5 Temel Event Tipleri

Sistemin event-first dusunulmesi icin cekirdek olaylar tanimlanmalidir:

- case.created
- case.media.added
- case.ai_insight.generated
- provider.matched
- quote.submitted
- quote.revised
- quote.accepted
- tow.assigned
- tow.arrived
- vehicle.delivered_to_shop
- evidence.uploaded
- part.replaced
- payment.authorized
- payment.released
- case.completed
- rating.submitted
- dispute.opened

Bu olaylar hem workflow'lari tetikler hem de trust ve analytics hesaplarina girdi verir.

### 11.6 Mimari Karar

Uzun vadede servis ayrisma potansiyeli korunmali; ama erken donemde en saglikli secim asagidaki yaklasimdir:

- Tek repo
- Tek backend deployment
- Domain bazli moduller
- Ortak Postgres
- Asenkron gorevler icin queue

Bu sayede ekip hizli urun cikarir, ama gelecekte `matching`, `payments`, `ai` gibi alanlari ayirmak isterse duvara toslamadan ilerler.

## 12. Mevcut Prototipe Yerlestirme

Bugunku arayuz yapisi aslinda dogru cekirdegi veriyor. Gelistirme mantigi su olabilir:

### Hasar Akisi

Hasar akisi, basit formdan cikarilip `intent capture` motoruna donusturulmeli.

Burada toplanan veri:

- Vaka tipi
- Aciliyet
- Surulebilirlik
- Medya
- Dinamik sorular
- Servis tercihi

Bu veriler dogrudan AI intake analyzer ve candidate generation katmanini besler.

### Usta Listeleme

Liste ekraninda sadece puan ve fiyat degil, "neden onerildi" katmani da olmali:

- Bu marka/modelde guclu
- Bu tip vakalarda dusuk dispute
- 18 dakikada teklif veriyor
- Pickup mevcut
- AI tahmini ile uyumlu teklif bandinda

### Swipe Akisi

Swipe, eglenceli bir arayuz olmaktan cikarak karar destek katmanina donusebilir.

Kartta gosterilebilecek sinyaller:

- Match reason
- Trust badge
- AI uyum seviyesi
- Hiz ve ETA
- Ozel urun rozetleri

### Vaka Takibi

Vaka motoru, sadece durum gosteren degil; evidence ve payment aware hale gelmeli.

Her adim:

- owner
- status
- evidence requirements
- approval rule
- payment hook
- trust impact

alanlariyla zenginlestirilmelidir.

## 13. Temel KPI'lar

Sadece indirme ve MAU izlemek yeterli olmaz. Dogru KPI seti:

- Uygun teklif alma oranı
- Tekliften ise donusum
- Platform ici odeme oranı
- 90 gun icinde tekrar is oranı
- Vaka basina dispute oranı
- Tamir sonrasi puanlama kalitesi
- Ortalama ilk yanit suresi
- Ortalama teslim suresi
- AI tahmini ile final teklif uyum orani
- Sponsorlu trafik ile organik kalite farki

Uzun vadeli north star onerisi:

`Platform icinde tamamlanan ve 90 gun icinde tekrar kullanima donen arac orani`

## 14. Urun Yol Haritasi

### Asama 1: Guvenli Marketplace

- Admission gate
- Temel ranking engine
- Trust ledger
- Platform ici teklif akisi
- Basit korumali odeme

### Asama 2: AI Assisted Service

- AI intake analyzer
- AI repair plan
- AI quote comparator
- Evidence auditor

### Asama 3: Vehicle Operating System

- Arac hafizasi
- Bakim tahminleme
- Favori servis ve tekrar is motoru
- Filo / premium / sigorta dikeyleri

## 15. Sonuc

Bu platformun farki, kullaniciyi ustaya goturmesi degil; aracin ihtiyacini guvenli ve yonetilebilir bir sisteme baglamasidir.

Dogru urun iddiasi sunlarin birlesimidir:

- guvenilir admission
- baglama gore dinamik ranking
- AI destekli ama kanit odakli surec
- platform ici rahatlik ve tekrar kullanim
- dusuk bariyerli ama guclu gelir mimarisi

Kisaca:

Bu urun "usta bul" uygulamasi degil, aracin servis ve onarim isletim sistemi olmalidir.
