# Naro — Ürün Use Case Spec (North Star)

> **Sahibi:** PRODUCT-OWNER — kullanıcı (kurucu) dikte etti, PO yorumladı
> **Güncellik:** 2026-04-22 · v1.0
> **Durum:** **Canonical referans.** Her brief, her PR, her review buna referans verir. Tutarsızlık → PO'ya götür.
> **Tarzı:** Navigatör, reklam panosu değil. Use case odaklı. Spec-heavy jargon değil, senaryo dili.

---

## 0. Bu doküman nedir

Naro'nun neden var olduğunu, kimin için çalıştığını, hangi 4 hikayeyi çözdüğünü tek yerde toplar. Bugüne kadar yazdığımız 25+ brief'in **üstünde duran umbrella** — kod yazarken kafa karışıklığı olduğunda ilk okunan, brief yazarken son bakılan doc.

**Kural:** Bir yeni feature / brief / PR **bu 4 use case'e hizmet etmiyorsa** — pilot sonrasına atılır.

---

## 1. Ürün tezi

Türkiye'de otosanayi **kaotik** bir sektördür. Araç sahibi paniklediğinde (kaza), aracı anlamadığında (arıza), rutin bir iş yaptıracağı zaman (bakım), ya da aracını taşıtacağı zaman (çekici) — güvenebileceği bir ustayı bulmak zordur. "Eş-dost-tanıdık" ağının dışında rastlantısal seçim yapar. Sonuç: fiyat + kalite + güven belirsiz.

**Naro bu kaotik süreci çözen bir navigatördür — reklam panosu değil, öneri motoru değil.** Sistem ustayı zorla öne çıkarmaz. Sistem **iki tarafın da onayıyla** en uygun eşleşmeyi kolaylaştırır. Kullanıcı:
- Geçmiş iş + yorum + foto + sertifika dolu bir **usta profili** görür
- İstediği ustadan (teklif yollamış yollamamış farketmez) **randevu talep eder**
- Aynı zamanda algoritmik olarak **eşleşen ustaların tekliflerini** alabilir
- Süreç boyunca her adımda **şeffaf takip** eder

Sistem aynı zamanda usta için de navigatör:
- Hangi işe teklif verebileceğini (kapsamına göre) gösterir
- Kabul ettiği işleri organize eder (randevu, mesajlaşma, adım adım süreç)
- Ödeme akışını platform üzerinden güvence altına alır

**Pilot:** Kayseri, 10 gerçek usta + 10 "profesyonel görünen, kullanıcıya şeffaf belirtilen" mock servis. Amaç: altyapının milyonlara ölçeklenebildiğini doğrulamak.

---

## 2. Dört ana use case

Bu 4 use case Naro'nun **kalbi**. Her biri kullanıcı tarafının bir ihtiyacına denk gelir. Kod bunları destekler, geri kalan her şey bunların türevidir.

---

### UC-1 — Çekici Çağır (Uber-vari, direkt)

> **Tek cümle:** Kullanıcı "şimdi çekici lazım" dediğinde tek ekranda konumdan eşleşmeye + ödemeye + canlı takibe kadar hiç düşünmeden akar.

#### Senaryo
Alfonso BMW 320i'siyle otoyolda yolda kaldı. Akşam 9. Aracı çalışmıyor. Telefonunda Naro açık.
- Açılış ekranında "Çekici çağır" büyük buton görür → tap
- Konum otomatik bulunur (GPS), harita açılır, pin kendiliğinden üstünde
- "Nereye götürelim?" — Alfonso "servise" der ya da dropoff'u sonra anlaşır
- Sistem **fiyatı önden söyler**: "950₺ + km başı 70₺, tahmini toplam 1.280₺"
- "Çekici çağır" butonuna bastığında **kartından pre-auth alınır** (hold, tahsil değil)
- Yakın çekiciler aranır, 15-30 sn içinde eşleşme olur
- Çekici bilgisi (isim, plaka, rating, ETA) ekranda görünür
- Alfonso canlı haritada çekicinin geldiğini izler
- Çekici varır → araç yüklenir → servise gider → teslim
- **İş bittiğinde tahsilat otomatik** — Alfonso hiç "ödeme ne zaman, nasıl?" diye düşünmedi

#### Kritik davranışlar (olmamalı / olmalı)
- ❌ "Ödemeyi ne zaman yapacağım?" belirsizliği
- ❌ Fiyat sonradan süpriz artışı
- ❌ "Çekici nerede?" diye telefonla arama ihtiyacı
- ✓ Fiyat önden şeffaf (maksimum cap garantili)
- ✓ Canlı takip haritası
- ✓ Ödeme iş bittiğinde otomatik kapanır
- ✓ Aksilik durumunda iptal net (iptal öncesi = 0₺, dispatch sonrası = cüzi fee, yolda iken = cüzi fee, vardıktan sonra = tam ücret)

#### Reverse / edge flows
- **Araç yok** → "Çekici çağır" butonuna bastığında *"Hangi araç için?"* sorusu + araç seç veya ekle CTA
- **Konum izni reddedildi** → *"Konumunu manuel gir"* fallback + map picker
- **Yakın çekici yok** → *"Yakınımızda uygun çekici bulamadık, 5 dk sonra tekrar dene veya planlı talep oluştur"*
- **Network kopuk** → pre-auth başarısız → *"Bağlantı sorunu, tekrar dene"*

#### Backend + mobile dokunuş
- Backend: `tow_dispatch` servisi + PostGIS matching + Iyzico pre-auth + WebSocket canlı GPS
- Mobile: `/cekici-cagir` modal (müşteri app) + `/ws/tow/{case_id}` subscription + map primitives

#### Şu anki olgunluk: **%80**
| Parça | Durum |
|---|---|
| Konum bul + map pin | ✓ (Harita Faz 2) |
| Eşleşme + ETA + fiyat | ✓ (tow_dispatch Faz 10) |
| Canlı takip | ✓ (WS kanalı Faz 2 PR-5) |
| Pre-auth + capture | ⚠️ **Iyzico stub** — gerçek entegrasyon billing brief'te |
| İptal policy | ✓ (K-4 tablosu) |
| Araç yoksa yönlendirme | ❌ (geri dönüşler brief'inde) |

#### Acceptance (pilot için)
- [ ] Pilot kullanıcı "çekici çağır" → 3 tap içinde "aranıyor" ekranına geçer
- [ ] Fiyat önden net gösterilir (cap)
- [ ] Iyzico gerçek pre-auth çalışır (stub değil)
- [ ] Canlı harita truck pin moving
- [ ] İş bitince otomatik tahsilat + fatura email/SMS

---

### UC-2 — Vaka Aç (Kaza / Arıza / Bakım)

> **Tek cümle:** Kullanıcı aracını bile iyi tanımıyor olabilir; sistem onu adım adım yönlendirerek arızayı bir ustaya anlatır gibi girmesini sağlar, doğrulanmış veriyle havuza düşürür, eşleşen ustaları gösterir, kullanıcı **istediğinden** randevu talep eder.

#### Senaryo (arıza)
Leyla aracını sabah çalıştırırken motor "tak tak" sesi çıkardı. Ne olduğunu bilmiyor. Naro açar.
- "Yeni vaka aç" → Arıza seçer
- **İlk soru: Hangi araç?** → Leyla'nın garajında 2 araç var, aktif olanı seçer. (Garajda araç yoksa → araç ekleme ekranına yönlendirilir. Araç eklemek için plaka + marka + model + yıl + km + opsiyonel VIN + yakıt tipi girilir — bir usta neyi bilmek isterse, sistem onu ister. İleride AI hasar tespiti için bu valide veri şart.)
- Adım adım arıza girişi:
  - "Ne oluyor?" kategorisi seçimi (motor / elektrik / fren / klima / şanzıman / lastik / akışkan / diğer)
  - Semptom checkbox'ları ("tak tak ses, ilk çalışırken")
  - İsteğe bağlı foto / video / ses kaydı (motor sesi kritik — AI intake V2'de değerli)
  - Konum (yakın usta bulmak için)
  - Zaman tercihi (ne zaman yaptırmak istiyor)
  - Servis şekli tercihi (yerinde onarım / atölyede / vale — bu **talep**, usta kabul etmek zorunda değil)
- Submit → vaka **havuza düşer**
- Backend algoritması (bugün kind → provider_type map + pilot sonrası 7-boyutlu puan) — eşleşen ustalar iş görür
- Leyla'nın vakası eşleşen ustaların havuz feed'inde görünür
- Ustalar teklif gönderebilir; bazı ustalar gönderir, bazı göndermez
- Leyla'ya **teklifler** gelir (çoğu zaman birden çok)
- Leyla **Çarşı / Keşfet** ekranında da eşleşen ustaları görür:
  - Teklif gönderenler
  - Öne çıkanlar (bize sponsor olanlar — V2, pilot'ta yok)
  - Yüksek puanlı / verified olanlar
  - Geçmiş iş + yorum + foto profilli ustalar
- Leyla bir usta seçer (teklif yollamış veya yollamamış, farketmez) → **randevu talep eder**

#### Kritik davranışlar
- ❌ Teknik jargon zorla girdirme ("kompresör kodu girin")
- ❌ Tek-yönlü öneri ("en uygun usta şudur, seç")
- ❌ Araç bilgisi eksik submit kabul etme
- ✓ Adım adım konuşma dili ("Ne oluyor?" / "Ne zaman?" / "Nerede?")
- ✓ Araç zorunlu + doğrulanmış (AI + usta bu verilere ihtiyaç duyar)
- ✓ Teklifler **öneri** değil, usta insiyatifi
- ✓ Kullanıcı hangi ustayı isterse ondan randevu alabilir — teklif önkoşul değil

#### Reverse / edge flows
- **Aktif araç yok** → araç ekleme ekranına yönlendir + ekledikten sonra vaka composer'a geri dön (context korunur)
- **Araç var ama eksik bilgi** (ör. yıl yok) → minimum alanlar zorunlu (make/model/plaka); opsiyoneller atılabilir
- **Konum izni yok** → metin giriş fallback
- **Foto yüklenemiyor** (network) → offline queue, bağlantı gelince otomatik upload
- **Havuzda eşleşen usta yok** → *"Bölgende bu kategoride aktif usta az. Şu an bekleyeceksiniz, gelecek tekliflerden haber vereceğiz"*
- **Kullanıcı hiçbir teklifi / keşfet ustasını seçmedi** → vaka `matching` state'te kalır; 7 gün sonra otomatik arşiv (usta'ya baskı yok, kullanıcıya soft reminder)

#### Backend + mobile dokunuş
- Backend: `/cases` endpoint (POST) + `case_lifecycle` + `list_pool_cases` + `/technicians/public/feed` (keşfet) + `/offers` (teklif atomic)
- Mobile: 4 composer (AccidentFlow, BreakdownFlow, MaintenanceFlow, TowingFlow) + Çarşı ekranı + usta detay ekranı + randevu CTA

#### Şu anki olgunluk: **%75**
| Parça | Durum |
|---|---|
| Araç ekle + yönetimi | ✓ backend, ⚠️ mobile wire-up eksik (araç ekleme akışı detayı) |
| Composer (4 kind) | ⚠️ 2/4 modern (bakım + hasar), 2/4 eski (arıza + çekici — küçük iterasyon brief yazıldı) |
| Aktif araç yoksa yönlendirme | ❌ (geri dönüşler brief'inde) |
| Havuz + eşleşme | ✓ kind filter çalışıyor; 7-boyutlu puan V2 |
| Teklif gönder/kabul | ✓ |
| Keşfet / Çarşı ekranı | ✓ mobile, ⚠️ backend `/public/feed` endpoint PR 5'te (1g) |
| Randevu talep (teklif yollamamış usta'dan) | ✓ `direct_request` path PR 3'te |

#### Acceptance (pilot için)
- [ ] Aktif araç yoksa composer açıldığında araç ekleme yönlendirmesi
- [ ] 4/4 composer modern shell
- [ ] Composer submit → backend gerçek endpoint (mock değil)
- [ ] Çarşı'da eşleşen ustalar listesi (teklif yollayanlar + yüksek puanlılar)
- [ ] Kullanıcı istediği ustadan randevu talep edebilir

---

### UC-3 — Randevu + Süreç Takibi (Match → İş → Teslim)

> **Tek cümle:** Kullanıcı ustaya randevu gönderdi, usta kabul etti → iki tarafın da ortak gördüğü süreç ekranı açılır, karşılıklı mesajlaşma + opsiyonel adım kayıtları + foto / parça durumu ile süreç best-practice şekilde izlenir, teslim ile kapanır.

#### Senaryo
Leyla arıza için AutoPro Servis'e randevu talebi gönderdi. "Yarın saat 10-13 arası gelebilirim, aracım şu, hasar bu" dedi.
- AutoPro Servis'e **push** gelir — usta randevu talebini görür
- Usta **aracı + hasarı + gün-saati** değerlendirir
- Usta kabul veya red (counter teklif de gönderebilir — "10-13 değil de 14-16 olabilir mi?")
- Leyla onayı geldi → **süreç başladı**
- Ortak ekran: Leyla + AutoPro Servis aynı case detail'i görür
- Süreç adımları otomatik: "Kabul → Teşhis → Parça → Onarım → Test → Teslim" gibi
- Adımlar **zorunlu değil** — iki tarafın insiyatifi; usta isterse "teşhis bitti" bilgilendirmesi yazar, foto yükler, parça listesi girer
- Mesajlaşma açık — usta müşteriye bir şey sormak istediğinde yazar, müşteri cevap verir
- Ekstra iş çıktığında usta "parça onayı" talebi açabilir → müşteri onay/red
- Tamamlama → teslim → kapama → müşteri puan + yorum

#### Kritik davranışlar
- ❌ Usta müşteriye telefon numarası vermesi (platform içi iletişim)
- ❌ Süreç adımlarını zorunlu kılıp iki tarafı yıldırmak
- ❌ Müşterinin süreci dışarıdan takip edememesi
- ✓ İki taraf aynı ekranı görür (bilgi asimetrisi yok)
- ✓ Her adımda foto / parça / not eklenebilir (insiyatif bazlı)
- ✓ Ekstra arıza/parça çıkarsa formal onay akışı
- ✓ Tamamlanma sonrası puan + yorum sistemi açılır (reputation birikimi)

#### Reverse / edge flows
- **Usta randevuyu reddetti** → case `offers_ready` durumuna geri döner, Leyla başka usta seçer
- **Usta counter verdi** → Leyla onay/red ekranı
- **Müşteri randevuyu iptal ediyor** → iptal ücreti matrisi (V1'de tow dışı fee yok)
- **Süreçte network kopuk** → mesajlar offline queue, bağlantı gelince sync
- **Ustanın iş beklenenden fazla** → parts_approval akışı + ek pre-auth (billing)
- **Müşteri teslim sonrası itiraz ediyor** → dispute → admin arabulucu (V1 manuel)
- **Güvenlik: müşteri ↔ usta telefon değiş-tokuşu deneme** → V1'de log + soft warning; V2'de Twilio Proxy masking

#### Backend + mobile dokunuş
- Backend: `appointment_flow` + `case_process` (milestone + task + evidence + message + approval) + `case_lifecycle`
- Mobile: Case detail screen (müşteri + usta aynı component, rol-bazlı aksiyonlar) + thread/mesaj + evidence upload + parça onay modal + teslim onay

#### Şu anki olgunluk: **%70**
| Parça | Durum |
|---|---|
| Randevu onay/red/counter | ✓ PR 3 |
| Mesajlaşma (thread) | ✓ backend, ⚠️ mobile yazma UI eksik olabilir |
| Süreç adımları (milestone + task) | ✓ backend (Faz 7a-d), ⚠️ mobile wire-up yarım |
| Foto / parça evidence | ✓ backend, ⚠️ mobile upload akışı detayı |
| Parts approval modal | ❌ billing FE brief'inde |
| Puan + yorum | ⚠️ tablo PR 8'de (reviews migration) |

#### Acceptance (pilot için)
- [ ] Randevu onay akışı uçtan uca çalışır
- [ ] Case detail iki taraf için görünür (rol-bazlı buton farkı)
- [ ] Thread mesajlaşma iki yönlü
- [ ] Evidence foto upload akışı çalışır
- [ ] Parça onayı (ek iş) modal çalışır (billing ile)
- [ ] Teslim sonrası puan akışı aktif

---

### UC-4 — Ödeme (şeffaflık — belirsizlik yok)

> **Tek cümle:** Kullanıcı "ödeme ne zaman?" diye sormaz; sistem otomatik yapar. Usta "param geldi mi?" diye kontrol etmez; platform escrow'da tutar, iş bitince ustaya akar.

#### Senaryo
Leyla'nın arıza vakası bitti. Fatura 1.450 ₺.
- İş onaylandı (invoice_approval)
- Leyla tek tap "onayla + öde"
- Kart'tan tutulan pre-auth → gerçek tahsilat otomatik
- Fatura PDF email/SMS
- AutoPro Servis'e net tutar (%10 komisyon sonrası) haftalık payout kuyruğuna girer
- Leyla uygulamada hiç ödeme ekranı açmadı, "kart gir" yapmadı (daha önce girdi, saklanmadı ama 3DS akışı otomatik açıldı)

#### Kritik davranışlar
- ❌ Kullanıcıya "ödeme ne zaman yapacağım?" sorusu bırakmak
- ❌ Usta'nın "param geldi mi?" belirsizliği
- ❌ Ödeme dışarıda (elden, havale) — platform atlanması
- ✓ Pre-auth iş başında (hold)
- ✓ İş bitince otomatik capture
- ✓ Cap garanti (cap üstü platform yutar — Uber-like)
- ✓ İade gerekirse otomatik (partial refund / full refund)
- ✓ Kasko varsa: Leyla normal öder, platform sigortaya ibraz + iade yönlendirir — Leyla beklemez

#### Reverse / edge flows
- **Kart reddedildi** → "Farklı kart dene" veya "bankanla görüş"
- **Parça onayı sonrası pre-auth yetmiyor** → ek hold; müşteri onayı
- **Müşteri iş reddediyor / dispute** → admin arabulucu, kısmi capture + refund
- **Kasko flagli** → otomatik ibraz yönlendirmesi (operations manuel V1)
- **3DS timeout** → retry / farklı kart

#### Backend + mobile dokunuş
- Backend: `case_billing` servisi + Iyzico concrete + webhook handler + idempotency + `case_commission_settlements` + `case_refunds`
- Mobile: Payment initiation + 3DS WebView + parts/invoice approval modal + billing summary card + refund tracking

#### Şu anki olgunluk: **%30** 🔴
| Parça | Durum |
|---|---|
| Tow için Iyzico pre-auth | ⚠️ MockPsp stub |
| Bakım/hasar/arıza ödeme | ❌ Hiç yok |
| Escrow + komisyon | ❌ Spec var, kod yok |
| Parts approval ek hold | ❌ |
| Invoice approval + capture | ❌ |
| Fatura PDF + e-arşiv | ❌ V1 3rd party stub planlandı |
| Kasko akışı | ❌ V1 manuel flow spec var |
| 3DS WebView | ❌ FE brief yazılı, kod yok |

**Pilot için en büyük blocker.** Backend 7-8 gün + FE 6-7 gün = ~13-15 iş günü iş.

#### Acceptance (pilot için)
- [ ] Iyzico sandbox ile E2E happy path
- [ ] Pre-auth → capture → komisyon kes → payout kuyruğu
- [ ] Parts approval ek pre-auth çalışır
- [ ] 3DS WebView + deep link callback
- [ ] Kasko flag → manuel admin reimburse flow
- [ ] Cap invariant: final ≤ pre-auth hold

---

## 3. Cross-cutting kurallar (her UC için geçerli)

Bu kurallar 4 UC'nin hepsini kapsar. Bir feature bunlara aykırıysa → sorgulanır.

### 3.1 Navigatör, reklam değil
Sistem ustaları "öne çıkar" etmez. Sadece:
- Algoritmik eşleşmeye göre havuza düşürür
- Kullanıcı ararsa **her** doğrulanmış ustayı gösterir (teklif yollamış/yollamamış farketmez)
- Puan + yorum + geçmiş iş = public profil
- Ödeme yapan (sponsorlu) ustalar **kaliteli olmadan yukarı çıkmaz** — V2'de tier boost kontrollü

### 3.2 İki tarafın onayı
- Hiçbir eşleşme tek yönlü olmaz
- Kullanıcı randevu talep eder → usta onaylar/reddeder
- Teklif gönderen usta → kullanıcı seçer (zorla atama yok)
- Acil çekici tek istisna (UC-1: platform hızlı atar, usta 15 sn accept penceresi)

### 3.3 Valide araç bilgisi zorunlu
- Her vaka bir araca bağlı (vehicle_id zorunlu)
- Araç bilgisi (make/model/year minimum; ideal VIN + motor no) doldurulmadan vaka açılmaz
- AI intake V2 için bu veriler kritik — aksi halde yanlış hasar tespiti
- Araç yoksa → ekle akışına yönlendir (UC-1, UC-2 reverse flow)

### 3.4 Süreç şeffaflığı
- Kullanıcı her aşamada ne olduğunu görür (status + wait state)
- Usta ne bekliyorsa müşteri onu görür, tersi de (iki taraf aynı ekran)
- Foto / parça / mesaj opsiyonel ama **görünür** (reputation birikimi)

### 3.5 Ödeme tek kanal — platform
- Elden ödeme, havale, off-platform transfer → **caydırılır**
- V1: eğitim (UI copy), V2: tespit + warning
- Escrow pattern (platform tutar, iş bitince ustaya) → anti-disinter ekonomik kaldıraç

### 3.6 Kimlik (PII) maskelemesi
- Havuzdaki teknisyenler müşteri PII'ını (tam telefon, email, tam isim) görmez
- Sadece assigned_technician görür, randevu onayı sonrası
- V1: thread-only messaging + email/phone maskeleme (backend)
- V2: Twilio Proxy real masked numbers

### 3.7 KVKK
- Kullanıcı silme talebinde 30 gün içinde soft → hard delete
- Her veri purpose'e göre retention (media: 18 purpose × ayrı TTL; GPS: 30g post-tow; finansal: 10yıl VUK)
- Açık rıza (consent) her kritik eşikte (araç geçmişi, konum kullanımı, bildirim)

### 3.8 Pilot kapsam bilinci
- Kayseri pilot için 10 usta + 10 mock yeterli — bu sayıya göre feature prioritize edilir
- Matching skoru basit (kind filter) — 7-boyutlu puan V2
- Admin onay manuel (10 usta için)
- Payout manuel haftalık banka transferi (10 usta)
- Mock servisler UI'da şeffaf işaretli (badge: "Demo")

---

## 4. Personalar + UX dokunuşu

Sen (kurucu) bu personaları 1 yıl önce işaret ettin. Her UC'de küçük nüanslar:

### Panik / kaza anındaki genç kullanıcı
- UC-1, UC-2 (kaza)
- Adım sayısı minimum, "Ambulans çağır" + "Çekici çağır" üst CTA
- Tek tık + otomatik hissi (detay sonra)
- Emergency gateway (hasar composer Adım 1)

### Sanayi / arabasından anlamayan kullanıcı (kadın, üniversite öğrencisi, ev hanımı, her kim olursa)
- UC-2 (arıza)
- Teknik terim yok — "titriyor", "ses çıkıyor", "durdu" seçenekleri
- Persona-adaptif rehberli sihirbaz (composer adım adım)
- Görsel ikon + kısa açıklama bol

### Okuma-yazması zayıf usta (sanayi, nasırlı el, 50+ yaş)
- UC-3 (süreç)
- Büyük dokunma alanları, minimum metin
- Sesli bildirim + foto-odaklı (parça listesi fotodan, metin opsiyonel)
- "Havuz" = büyük kartlar (reels)
- Teklif yazma asistanı ("şu tutarlar sık kullanılıyor")

### Sanayi çalışan genç (yeni ustalık almış)
- UC-3 (süreç)
- Normal app deneyimi, full feature set
- Rating + yorum sistemi motive eder

---

## 5. Şu anki olgunluk — tek tablo

| UC | Yüzde | Eksik ana nokta | Pilot için şart mı |
|---|---|---|---|
| **UC-1 Çekici** | %80 | Iyzico production entegrasyon | ✓ evet |
| **UC-2 Vaka aç** | %75 | Arıza+çekici composer modern shell + araç ekleme yönlendirme + Çarşı backend feed | ✓ evet |
| **UC-3 Süreç takibi** | %70 | Mobile UI wire-up (case detail derinliği, mesajlaşma, evidence upload) + puan sistemi | ✓ evet |
| **UC-4 Ödeme** | %30 | Billing service + Iyzico concrete + FE wire-up | ✓ **evet, en büyük blocker** |

---

## 6. Non-goals — pilot sonrası

Aşağıdaki hiçbir şey pilot'a dahil **değil**. Şu an tartışma açılırsa: *"pilot sonrası"* deriz.

- 7-boyutlu matching skoru
- Trust ledger + Bayesian rating aggregation
- Anti-disinter V2 real masked phone (Twilio Proxy)
- AI hasar tespiti modülü
- Çoklu rol hibrit auto-switch (business/individual/side_gig)
- Provider_mode tier'lı komisyon
- Taslak kaydetme (composer half-state)
- Discovery feed "çevrendeki atölyeler" usta anasayfada
- Turn-by-turn nav
- Offline tile download
- Sigorta API entegrasyonu (kasko otomatik)
- Iyzico Subaccount (otomatik usta payout)
- Apple Pay / Google Pay
- E-fatura direkt GIB API
- Chargeback otomasyonu
- Performance snapshots cron
- Çoklu-stop çekici
- Kurumsal (fleet) müşteri

---

## 7. Pilot MVP kilidi (Kayseri, 10+10)

Launch için **tek listeden şaşmayız**:

### Backend (BE dev sohbeti)
- Faz A PR 5-9 (pool + reviews + admin endpoint'leri + vehicles + insurance-claims) — ~10g
- Billing service + Iyzico concrete + FE wire-up endpoint'leri — 7-8g

### Frontend (FE dev sohbeti)
- Arıza + çekici composer modern shell (1-2g)
- Müşteri app geri dönüş akışları (empty state + redirect) — 1-1.5g
- Billing wire-up (FE brief mevcut) — 6-7g
- Mobil ↔ backend gerçek API wire-up (mock → real) — 3-5g
- Faz 3 tow tech app map — **pilot sonrası** (pilot'ta usta Yandex/Google ile halleder)

### PO (bu sohbet)
- Brief freeze — yeni feature brief açmıyor, sadece kontrol listesi
- Haftalık 1 sayfa özet (ne shipped + ne kaldı + ETA)
- Use case walkthrough (haftada 1, 30 dk — senin app'te tıklayıp görmen)

### BD (başka sohbet)
- Kasko ortaklığı (Axa, Anadolu) ön görüşme
- Hukuki metin (KVKK + kullanıcı sözleşmesi + gizlilik) — avukat
- VERBIS kaydı
- Pilot 10 usta + 10 mock onboarding planı (Kayseri)

### Cleaner
- Docs/ taksonomi
- .env.example Supabase flag'i temizle
- `.gitignore` alt-proje bölme

### Launch prep
- EAS build (iOS + Android)
- TestFlight + Google Internal Testing
- App Store listing (icon, screenshot, açıklama, privacy URL)
- Apple Developer + Google Play hesap

**Gerçekçi pilot ETA: 5-7 hafta.**

---

## 8. Değişim yönetimi

Bu doc **canlı**. Sen (kurucu) use case'lerde değişiklik istersen:
1. PO (ben) bu doc'u güncellerim
2. İlgili brief'lere diff yazılır
3. Dev sohbetlerine sinyal
4. KARAR-LOG'a kayıt

Yeni UC eklenmesi — pilot sonrası.

---

## 9. Referanslar

- [docs/backend-is-mantigi-hiyerarsi.md](backend-is-mantigi-hiyerarsi.md) — canonical invariant umbrella (teknik)
- [docs/audits/2026-04-21-backend-audit.md](audits/2026-04-21-backend-audit.md) — mevcut boşluk haritası
- [docs/cekici-modu-urun-spec.md](cekici-modu-urun-spec.md) — UC-1 detay (tow)
- [docs/backend-billing-servisi-brief.md](backend-billing-servisi-brief.md) — UC-4 BE tarafı
- [docs/frontend-billing-wire-up-brief.md](frontend-billing-wire-up-brief.md) — UC-4 FE tarafı
- [docs/musteri-bakim-composer-revizyon.md](musteri-bakim-composer-revizyon.md), [hasar](musteri-hasar-composer-revizyon.md), [arıza+çekici](musteri-ariza-cekici-composer-revizyon.md) — UC-2 composer revizyonları
- [docs/cekici-harita-mimarisi.md](cekici-harita-mimarisi.md) — UC-1 + UC-3 çekici harita
- [docs/rol-ui-mimarisi-backend.md](rol-ui-mimarisi-backend.md), [frontend](rol-ui-mimarisi-frontend.md) — shell mimarisi
- [docs/sinyal-hiyerarsi-mimari.md](sinyal-hiyerarsi-mimari.md) — matching V2 (pilot sonrası)

---

**v1.0 — 2026-04-22** · Naro ürün use case spec · North star referans doc
