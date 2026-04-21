# Vaka Kavramı — İki Katmanlı Model

> 2026-04-20 · Vaka ↔ Vaka Süreci ayrımı; UX + Domain + Backend referansı.

## 1. Amaç

Naro'nun bel kemiği tek bir **Vaka** nesnesidir: müşterinin "aracımla bir sorun var" dediği andan teslim/kapanışa kadar olan her şey bu nesneye bağlıdır. Uygulama boyutunda iki zihinsel katman var — **aynı nesnenin iki farklı projeksiyonu**:

1. **Vaka (Case)** — *statik profil*. Problem tanımı: ne, hangi araç, kimin, neresi, hangi kanıtlar.
2. **Vaka Süreci (Case Process)** — *dinamik iş akışı*. Bir usta ile eşleşme gerçekleştiğinde **yaratılır**: adımlar, mikro görevler, ödemeler, onaylar, thread, yorumlar.

Bu belge bu ayrımı netleştirir, UX ekranlarıyla bağını kurar, backend şemasının bu mantıkla nasıl okunacağını gösterir.

---

## 2. Temel tanımlar

### 2.1 Vaka (Case)

**Tanım**: Araç sahibinin oluşturduğu problem birimi. Kaza, bakım, arıza veya çekici ihtiyacı (+ bunların alt kategorileri — lastik patlaması, yan darbe, motor stop, periyodik bakım vs.).

**Nitelikleri**:
- Bir **araca** aittir (`vehicle_id`)
- Araç bir **kullanıcıya** aittir (`user_id` dolaylı)
- **Hiyerarşik odak**: `kind` (kaza/bakım/arıza/çekici) > alt kategori (damage_area / breakdown_category / maintenance_category) > detay alanları
- **Yaratıldığı anda havuza düşer** (`status: matching`)
- **Profili hep yaşar**. Eşleşme sonrası da, kapanıştan sonra da profil erişilebilir kalır
- **Aynı anda en fazla 1 aktif vaka** per araç (domain kuralı)

**Vaka profil içeriği (UX)**:
- **Hiyerarşik odak kartı** (kind + urgency + özet)
- **Araç kartı** (plaka, model, km, müşteri maskelenmiş)
- **Kind-specific detay panel**: kaza detayı (hasar bölgesi, kasko, tutanak) / arıza detayı (kategori, belirtiler, fiyat tercihi) / bakım detayı / çekici detayı
- **Konum** (servis noktası + teslim)
- **Müşteri paylaşımları** (attachment grid — foto/video/ses)
- **Teklifler bölümü** (ayrıştırılmış — rakip + kendi teklifin)
- **Meta**: açılış / güncelleme

### 2.2 Vaka Süreci (Case Process)

**Tanım**: Bir vaka ile bir ustanın karşılıklı eşleşmesi sonucu yaratılan iş akışı konteyneri.

**Nitelikleri**:
- **Eşleşme tetikleyicisi**:
  - Müşteri bir ustanın teklifini kabul eder (`offer.status: accepted`)
  - veya müşteri randevu talebi gönderir, usta onaylar (`appointment.status: approved`)
- **Bir vakaya 1-1**: eşleşme sonrası süreç vaka ile kilitlenir (yeni teklifler gelmez)
- **Alt ürünleri var**:
  - **Adımlar (stages)** — kabul → teşhis → parça onayı → servis → fatura onayı → teslim
  - **Mikro görevler (tasks)** — "görsel yükle", "parça onayı iste", "durum paylaş"
  - **Ödemeler** — fatura, ek kalem, tahsilat
  - **Onaylar (approvals)** — parça, fatura, tamamlama
  - **Thread** — müşteri-usta mesajlaşması
  - **Yorumlar (reviews)** — süreç sonunda
  - **Deneme / test** — bakım sonrası kontrol opsiyonu (V2)
- **Durum makinesi**: `scheduled → service_in_progress → parts_approval → invoice_approval → completed`

**Vaka süreci içeriği (UX — Hasar Takip)**:
- **Aşama hattı** (timeline + aktif stage öne çıkar)
- **Sıradaki görev** — primary action vurgusu
- **Görsel ve durum akışı** — eklenen medya + durum güncellemeleri
- **Thread** — mesajlar
- **Ödeme özet** — fatura + ara ödemeler
- **Onay bekleyenler** — parça / fatura

### 2.3 Ayrımın önemi

| Vaka | Vaka Süreci |
|---|---|
| Statik / tanımlayıcı | Dinamik / operasyonel |
| Yaratıldığında (talep) var olur | Eşleşmede yaratılır |
| Hep yaşar (dossier) | Vaka kapanınca tamamlanır |
| Havuzda ve randevuda erişilir | Aktif işte erişilir |
| "Ne var?" sorusunu yanıtlar | "Ne yapılıyor?" sorusunu yanıtlar |
| Sahip: vaka + araç + müşteri | Sahip: usta + müşteri (eşleşmiş) |

**Kritik**: süreç yaratıldıktan sonra **vaka profil erişilebilir kalır**. Usta hasarı tekrar incelemek, müşteri ilk talebini hatırlamak istediğinde süreç içindeki "vaka profili" bağlantısından geri döner.

---

## 3. Yaşam döngüsü (state machine)

### 3.1 Vaka lifecycle

```
 draft                            (müşteri composer'da hazırlıyor)
   │
   ▼
 matching                        [1] ← VAKA HAVUZDA
   │  ustalar teklif yollar
   ▼
 offers_ready                    [1] ← karşılaştırma aşaması
   │  müşteri teklif seçer veya randevu talep eder
   ▼
 appointment_pending             [2] ← RANDEVU TALEBİ
   │  usta onaylar
   ▼ ═══ EŞLEŞME ═══ → Vaka Süreci yaratılır
 scheduled                       [3] ← AKTİF İŞ / HASAR TAKİP
   │
   ▼
 service_in_progress
   ↕ parts_approval (onay döngüsü)
   ↕ invoice_approval
   ▼
 completed                       [4] ← tamamlandı, vaka hala erişilebilir (arşiv)
 archived                        
 cancelled                       (iptal — istediğin aşamada)
```

**Katmanlar**:
- `[1] matching, offers_ready` → **yalnızca vaka profili** aktif
- `[2] appointment_pending` → **vaka profili + randevu context**
- `[3] scheduled, service_in_progress, parts_approval, invoice_approval` → **vaka profili + vaka süreci** (paralel)
- `[4] completed, archived` → **vaka profili (arşiv), süreç donmuş kayıt**

### 3.2 Vaka Süreci lifecycle

Süreç `scheduled` ile başlar ve `completed` ile biter. Detay state machine backend tasarımındaki `service_case_status` ile örtüşür (şu an tek tablo); ancak **mantıksal olarak bu state'ler sürecin state'leridir**, profilinki değil.

---

## 4. Alt kategoriler (hasar tipolojisi)

### Kaza
- `damage_area`: front_left/right, rear_left/right, side, bumper_front/rear, roof, hood, trunk
- `report_method`: e_devlet / paper / police
- Sigorta flag: `kasko_selected`, `sigorta_selected`
- `counterparty_*` (karşı taraf bilgisi)
- `emergency_acknowledged`, `ambulance_contacted`

### Arıza
- `breakdown_category`: engine / electric / mechanic / climate / transmission / tire / fluid / other
- `vehicle_drivable`
- `on_site_repair`, `towing_required`
- `price_preference`: any / nearby / cheap / fast

### Bakım
- `maintenance_category`: periodic / tire / glass_film / coating / battery / climate / brake / detail_wash / ...
- `maintenance_tier` (paket)
- `maintenance_items[]`
- `mileage_km`

### Çekici
- `location_label` (alış), `dropoff_label` (bırakış)
- `emergency_acknowledged`
- `towing_required` (hep true)

Bu kategoriler **vaka profili**'nde hiyerarşik odakla gösterilir. Usta "ne var?"ı saniyeler içinde çözmeli.

---

## 5. Sahiplik ve erişim

```
User (customer)     User (technician)      System
     │                      │                  │
     │ owns                 │ matches          │
     ▼                      ▼                  │
  Vehicle                   │                  │
     │ has                  │                  │
     ▼                      │                  │
   Vaka ────────────────────┘                  │
     │ 1-1 (eşleşmede)                         │
     ▼                                         │
  Vaka Süreci                                  │
     │                                         │
     ├─ adımlar (engine-derive)                │
     ├─ görevler                               │
     ├─ ödemeler                               │
     ├─ onaylar                                │
     ├─ thread                                 │
     └─ yorum                                  │
```

- **Vaka erişimi**: müşteri (kendi aracı) ve aday ustalar (havuz görünürlüğü)
- **Süreç erişimi**: müşteri + atanmış usta

---

## 6. UX ekran haritası

| Aşama | Rol | Ekran | Ana aksiyon |
|---|---|---|---|
| matching / offers_ready | Usta | `/havuz/[id]` — **Vaka Profili** (pool context) | "Teklif Gönder" |
| matching / offers_ready | Müşteri | `/vaka/[id]` — **Vaka Profili** (customer view) | Teklif seç / randevu talep |
| appointment_pending | Usta | `/randevu/[id]` — **Vaka Profili** (appointment context) | Reddet / Randevu ver |
| appointment_pending | Müşteri | `/vaka/[id]` (pending status) | Beklemede |
| scheduled ve sonrası | Usta | `/is/[id]` — **Vaka Süreci** (hasar takip) | Görev/adım aksiyonları |
| scheduled ve sonrası | Usta | `/is/[id]` içinden **Vaka Profili** linki | Hasar detayına geri dönüş |
| scheduled ve sonrası | Müşteri | `/vaka/[id]` (customer tracking) | Süreç takibi + vaka profili aynı ekran tab'larında |
| completed | Her iki taraf | `/vaka/[id]` (arşiv) | Read-only dossier |

**UX prensibi**: "Vaka profili" her zaman **tek tutarlı iskelet** (`CaseInspectionView`), çevresinde sadece **context banner + sticky action** değişir. Süreç için ayrı ekran.

### 6.1 Vaka süreci → vaka profili geçişi (önemli)

Aktif işte usta hasarı tekrar görmek isteyebilir. Bu yüzden `/is/[id]` (süreç ekranı) üstünde bir **"Vaka profili"** butonu veya kart olmalı — `/havuz/[id]` rotasını yeniden kullanabilir (havuz context'i şimdi yanlış ama case zaten orada) ya da sadeleştirilmiş canonical profil rotası açılabilir. Backend ayrımını burada yapmıyoruz; UX zemini bu.

---

## 7. Mevcut domain modeli eşleşmesi

Mevcut `service_cases` tablosu (domain-veri-modeli.md §5.4) **hem profili hem süreci barındıran tek merkezi nesne**. Alanları iki katmana ayrılır:

### Profil alanları (vaka-statik)
- `id`, `vehicle_id`, `kind`, `title`, `subtitle`, `summary`
- `request` (embedded draft — kind-specific alanlar: damage_area, breakdown_category, kasko, vs.)
- `attachments[]` (müşteri paylaşımları)
- `offers[]` (havuzdaki teklifler — profilde görünür)
- `created_at*`, `origin`
- `insurance_claim` (sigorta dosyası)

### Süreç alanları (vaka-dinamik, eşleşmeden sonra anlamlı)
- `status` (genel state machine — hem profili hem süreci kapsar)
- `assigned_technician_id` (eşleşmiş usta)
- `milestones[]`, `tasks[]`, `evidence_feed[]` (engine-derivative)
- `pending_approvals[]`
- `documents[]` (süreç boyunca eklenen belgeler)
- `thread`
- `total_label`, `estimate_label`
- `appointment` (randevu objesi)
- `events[]` (aktivite akışı)
- `next_action_*` (engine-derivative)

### Derivatif olan
- `milestones/tasks/evidence_feed/next_action_*` şu an `tracking/engine.ts` ile hesaplanıyor (domain-veri-modeli.md §1 not).

**Kritik not**: şu an tek tablo, iki projeksiyon. Frontend'te iki ekran (profil vs süreç) bu projeksiyonları farklı UX'le sunar; backend'de fiziksel ayrım şart değil.

---

## 8. Backend implications (ileriye dönük)

### 8.1 Tek tablo yeterli mi, yoksa ayırmalı mı?

**V1-V2 için yeterli**: tek `service_cases` tablosu. Status makinesi hem profil hem süreç state'lerini kapsar.

**V3 ölçekte düşünülmeli**: `case_processes` tablosu ayrılabilir — sadece eşleşme sonrası yaratılır, başka bir yaşam döngüsüne sahip (ödeme, rating, deneme). Avantaj:
- Kapanan vakalar profile-only olarak arşivlenir, süreç tablosu küçük kalır
- Yorum/rating gibi süreç-ötesi alanlar net ayrışır
- Raporlama kolaylaşır (örn. "toplam süreç geliri" vs "vaka havuzu analizi")

V1'de ayrılmasına gerek yok; ancak **frontend'te iki zihinsel model** birinci günden hayatta olmalı.

### 8.2 Eşleşme olayı (match event)

Süreç yaratıcı event iki yerde olur:
1. Müşteri teklif kabul eder → `offer.status: accepted` + `case.status: scheduled` + `assigned_technician_id` set
2. Usta randevu talebini onaylar → `appointment.status: approved` + aynı güncellemeler

İkisinde de **"Vaka Süreci yaratıldı"** logical event'i tetiklenmeli (şu an implicit; V2'de explicit event + workflow init step).

### 8.3 Alt ürünler (süreç bileşenleri)

V1'de süreç altında yaşayan bileşenler:
- Stages/tasks (engine-derive)
- Approvals
- Thread messages
- Events
- Attachments (süreç boyunca eklenenler — kabul foto, teşhis foto, fatura)

V2'de eklenebilecekler:
- **Payments** (ödeme tablosu — iterasyonlar + escrow)
- **Reviews** (tamamlanma sonrası yorum + rating)
- **Trials** (test sürüşü, bakım sonrası deneme kontrol)

### 8.4 Vaka profil arşivi

Tamamlanmış vakalar **silinmez**; profil erişilebilir kalır:
- Müşteri için: araç geçmişi ("bu aracın başından geçenler")
- Usta için: iş geçmişi ("geçmiş işlerim")
- Platform için: pattern extraction (AI öneri motoru beslemesi)

---

## 9. Terminoloji disiplini

**UI'da kullanılacak**:
- **Vaka** — problem birimi (kaza bildirimi, arıza kaydı, bakım talebi)
- **Vaka profili** — hasarı hiyerarşik gösteren profil ekranı
- **Vaka süreci** veya **Hasar takip** — eşleşme sonrası iş akışı ekranı
- **Görsel / belge / aşama** — süreç içindeki yüklemeler (kanıt dili kaldırıldı; bkz. eski kararlar)

**UI'da kullanılmayacak**:
- "Dosya" tek başına belirsiz — "Sigorta dosyası" gibi niteleyerek kullan
- "Talep" ve "vaka" birbirinin yerine kullanılmaz: talep oluşturma = composer; oluşturulmuş nesne = vaka
- "Hasar" sadece kaza/arıza için; bakım için "bakım kapsamı"
- "Kanıt" hiçbir bağlamda kullanılmaz (süreç takip adımlarıdır)

---

## 10. Anti-patterns

1. ❌ Vaka profili ekranından sürecin iş akışını yönetmek (adımları ilerletmek, parça onayı vermek)
   - Profil = ne, Süreç = ne yapılıyor. Karıştırma.
2. ❌ Süreç ekranından vakayı değiştirmek (hasar bölgesini düzenlemek, müşteri notunu değiştirmek)
   - Profil read-only'dir süreç başladıktan sonra
3. ❌ Eşleşmeden önce süreç UI'ını açmak
   - `matching`/`offers_ready`/`appointment_pending` statelerinde süreç henüz yok. Aşama/görev sunulmaz
4. ❌ Vakayı silmek (tamamlansa bile)
   - Arşivlenir; araç geçmişi / platform beslemesi için kalır
5. ❌ İki farklı ekranda aynı vaka detayını duplicate göstermek
   - Profil tek kaynaktır. Süreç ekranında sadece linkle referans

---

## 11. Backend mental model özeti

```
Vehicle  has_many  Vaka (Case)
Vaka     has_many  CaseOffer
Vaka     has_one   Appointment (en son aktif, geçmiş silinmez)
Vaka     has_many  CaseAttachment (müşteri paylaşımları)
Vaka     has_one   VakaSüreci (eşleşme sonrası — logical projection)

VakaSüreci (logical = service_cases.status >= "scheduled")
  has_many   CaseMilestone (engine-derive)
  has_many   CaseTask      (engine-derive)
  has_many   CaseEvidence  (process-side attachments)
  has_many   CaseApproval  (parça, fatura, tamamlama)
  has_one    CaseThread    (mesajlaşma)
  has_many   CaseEvent     (durum kayıtları)
  has_one    InsurancePayment (V2)
  has_one    CustomerReview   (V2)
```

Backend tasarımında **tek `service_cases` tablosu V1-V2 için yeterli**; frontend'te **iki zihinsel katman** — vaka profili ekranı vs vaka süreci ekranı — net ayrılmış olmalı.

---

## 12. UX ile bir sonraki adım

Bu belge oturduktan sonra yapılacak UX çalışması:

1. **`/is/[id]` (vaka süreci ekranı) üstüne "Vaka profili" erişim noktası ekle**
   - Büyük ihtimalle üst header'ın sağında ikon veya "Vaka detayı" chip
   - Tap → `/vaka/[id]` veya `/havuz/[id]` (canonical profil)

2. **Canonical `/vaka/[id]` canlandırılması** (V2)
   - Şu an silinmiş durumda (havuz ve randevu context'li varyantları var)
   - Kullanım: aktif iş içinden, arşiv, müşteri tarafı
   - Context-less version: sticky action yok, sadece tam inceleme

3. **Müşteri tarafı `/vaka/[id]` parity**
   - Zaten `CaseDetailScreen` var; aynı iki-katman felsefesiyle yeniden hizalanabilir (profil + süreç tab'ları)

4. **Arşiv/dossier görünümü**
   - `completed`/`archived` vakaların read-only profili — müşteri araç geçmişi + usta iş geçmişi

Bu dört maddeyi UX planına dönüştürmek ayrı bir sprint.
