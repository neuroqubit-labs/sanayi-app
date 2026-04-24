# Çekici Modu — Ürün, Mimari ve Uygulama Spec'i

> **Sahibi:** PRODUCT-OWNER sohbeti  
> **Durum:** Kararlar baked-in (2026-04-21) — spec yürürlüktedir.  
> **Hedef sohbetler:** BACKEND-DEV, UI-UX-FRONTEND-DEV. BD referans alabilir (GTM + kasko ortaklıkları), CLEANER-CONTROLLER legacy çekici kodunu denetler.

---

## 1. Amaç ve ürün tezi

Çekici hizmeti Naro'da diğer üç akıştan (accident / breakdown / maintenance) yapısal olarak ayrışır:

- **Tek adımlı hizmet** — parça onayı, ara teslim, fatura onayı yok. Al → taşı → teslim et.
- **Yüksek aciliyet varyansı** — aynı müşteri bazen "yolda kaldım, 15 dk'da çekici lazım" bazen "yarın aracı servise götürsünler" der. İki farklı ürün.
- **Düşük bilişsel kapasite** — panik/stres anında kullanıcı form doldurmaz.
- **Yüksek kanıt yoğunluğu** — araç hasarı tartışmaları + sigorta dosyaları ek disiplin ister.
- **Araç hareketi** — çekici kendisi araç; canlı GPS stream gerekli (diğer usta türlerinde atölye sabittir).

**Tez:** Çekici, Naro içinde **iki ayrı ürün** olarak yaşar ama tek veri modelinde birleşir:

1. **Hemen çağır (auto-dispatch)** — Uber Ride Now pattern. Pre-auth + otomatik atama + canlı track.
2. **Randevulu çağır (bidding)** — Uber Reserve + Thumbtack bidding karışımı. Teklif havuzu + fiyat sabitlenmesi.

Bu iki mod [memory: matching_regime](~/.claude/projects/-home-alfonso-sanayi-app/memory/matching_regime.md) kararını somutlaştırır: *acil çekici Uber-tarzı auto-dispatch, kaza dahil diğer hepsi bidding havuz*.

### Başarı kriteri

- Panik anındaki kullanıcı 3 ekranda (harita + durum + onay) çekici çağırmış olur.
- Çekici **vardığı dakika** müşteri "kime güveneyim?" sorusuyla boğulmaz — rating + plaka + truck tipi önceden biliniyor.
- Fiyat sürprizi yok — "maksimum X ₺" vaadi cap gibi çalışır.
- Kasko avantajı hiçbir ekranda kaybolmaz — kullanıcı "kaskom var" dediği andan itibaren platform yükü üstlenir.

---

## 2. İki mod — karar matrisi

| Boyut | Hemen (auto-dispatch) | Randevulu (bidding) |
|---|---|---|
| Tetikleyici | `urgency="urgent"` + `kind="towing"` | `urgency="planned"` veya `today` + `kind="towing"` |
| Matching rejimi | Platform tek-aday seçer, 15 sn accept penceresi | Havuza düşer, N çekici teklif verir |
| Fiyat oluşumu | Formül: base + distance + surcharge (platform set) | Her çekici kendi teklifini verir |
| Fiyat garantisi | **Maksimum X ₺ vaadi** — cap. Aşılırsa platform yer | Seçilen teklif booking anında **kilitlenir** |
| Pre-auth zamanı | "Çekici çağır" tap anında | Teklif seçim anında |
| Aday seçim | Platform (en yakın, uygun, puanlı) | Müşteri (listeden seçer) |
| Timeout | 3 dk içinde match yoksa fallback | N/A (bidding 30 dk açık) |
| Min lead time | 0 (anlık) | 2 saat ileri |
| Max lead time | — | 90 gün |
| Canlı GPS track | Zorunlu | Dispatch anından itibaren |
| İptal | Ücret aşamalı (dispatch öncesi 0 → vardı 300) | Zamana bağlı (4sa+ öncesi 0 → 1sa içi tam) |
| Use case | Yolda kalma, kaza sonrası acil çekme, akü biten yabancı şehir | Aracı servise götürme, 4x4 yurt dışı çıkışı, araç satış transferi |

### Karar: ürün kararları baked-in

**[K-1] Maksimum fiyat vaadi (Hemen):** Kullanıcıya gösterilen fiyat **MAKSİMUM cap**, tahmini değil. Formül:

```
cap = base(950₺) + mesafe_km × 70₺ + aciliyet_prim(80₺) + %10 buffer
```

Cap aşılırsa **platform yer**. Müşteri hiçbir durumda cap'ten fazla ödemez. Gerçek çekim gerçek mesafeye göre ama cap altı.

*Gerekçe:* HONK research'ü açık — "maksimum X ₺" vaadi güven motoru. Naro'nun sektörel güvensizlik problemi (başarısız startup geçmişi) için bu vaad pazarlamaya yansır.

**[K-2] Randevulu fiyat kilitleme:** Müşteri teklifi seçince **o fiyat sabittir**. Çekici "yakıt arttı, yol kötüydü" diyemez. Fatura = teklif fiyatı.

*Gerekçe:* Uber Reserve'ün çalıştığı model. Bidding'in "tuzak teklif" problemine karşı savunma.

**[K-3] Vehicle type (flatbed/hook/wheel-lift/heavy-duty):** **Sistem çıkarır**. Kullanıcı seçmez (default). "Gelişmiş" switch ile override edebilir ama varsayılan otomatik.

Kural:
```
eğer durum="kaza" + drivable=false → flatbed
eğer brand_tier="luxury" veya "premium" → flatbed
eğer brand_tier="commercial" veya weight>3.5t → heavy-duty
eğer motosiklet → motosiklet ekipman
yoksa → hook (veya wheel-lift, uzaklık < 3km ise)
```

*Gerekçe:* Panik altındaki kullanıcı flatbed-hook farkını bilmez. Sistem çıkarımı + çekici karşı-teklifi (yanlış ekipman geldi → çekici yeniden gönderir) yeterli.

**[K-4] İptal ücretleri:**

| Durum | Hemen | Randevulu |
|---|---|---|
| Dispatch öncesi | 0 ₺ | 4+sa öncesi: 0 ₺ |
| Çekici dispatch olmuş, yola çıkmış | 75 ₺ | 4sa içi: 150 ₺ |
| Çekici vardı (arrival photo alındı) | 300 ₺ + gerçek yol ücreti | 1sa içi: teklif fiyatı tam |
| Yükleme başladı | Tam ücret | Tam ücret |

*Gerekçe:* Uber Ride cancel 5₺, Uber Reserve cancel 10-20$ bant seviyesi. TR piyasasına + çekici'nin real-cost'una uyarlanmış.

**[K-5] Kasko V1 davranışı:** Kullanıcı "kaskom var" işaretler → ücret **normal şekilde kart'a pre-auth** + teslim sonrası fatura PDF olarak kullanıcıya + platforma SMS: *"Kasko şirketinize ibraz edin; Naro'ya gönderirseniz X iş günü içinde platforma iadesi yapılır."* Platform kasko'dan tahsilat yapar, kullanıcıya geri öder.

*Gerekçe:* V1'de sigorta API'si yok. Manuel süreç. Kullanıcı deneyimi: ön ödeme + sonradan iade. Platform yükü: kasko takibi operations ekibine düşer. V2'de Axa/Anadolu/Allianz API entegrasyonu.

**[K-6] Min advance booking:** Randevulu için **2 saat**. Max 90 gün.

*Gerekçe:* Çekicinin rota planlama süresi; kullanıcının "bugün değil ama yakında" niyetine uyum.

**[K-7] Mevcut `cekici-cagir.tsx`** ([naro-app/app/(modal)/cekici-cagir.tsx](../naro-app/app/(modal)/cekici-cagir.tsx)) ve `TowingFlow.tsx` ([naro-app/src/features/cases/composer/TowingFlow.tsx](../naro-app/src/features/cases/composer/TowingFlow.tsx)): Bu spec'in Hemen/Randevulu iki-tab yapısına göre **yeniden yazılır**. Mevcut estimator formülü ([TowingFlow.tsx:30](../naro-app/src/features/cases/composer/TowingFlow.tsx#L30)) doğru; ama akış 4 ComposerSection'dan 2 tab'lı Uber-tarzı map-first ekrana geçer. UI-UX-FRONTEND-DEV brief'inde detay.

---

## 3. Müşteri UX — Hemen modu

### 3.1 Ekran 1: Map-first hub

**Layout:** Full-screen map (70% dikey); bottom sheet (30%).

**Map:**
- GPS default pin (draggable, pickup point)
- Çekici ikonlarla yakındaki aktif çekiciler (anonim, sadece yoğunluk sinyali — Uber pattern)
- Radius dairesi (şeffaf, 5 km default)

**Bottom sheet içeriği:**

```
┌──────────────────────────────────┐
│  [ Hemen ]   [ Randevulu ]       │ ← Tab
│                                   │
│  📍 Alım: Maslak / Kemer Caddesi │ ← tap → map
│  🏁 Teslim: +Ekle (opsiyonel)    │
│  🚗 Araç: 34 ABC 42 BMW 320i     │ ← tap → değiştir
│  ⚠️ Durum: ○ Çalışıyor           │
│              ● Çalışmıyor          │
│              ○ Kaza                │
│              ○ Lastik              │
│              ○ Akü                 │
│              ○ Yakıt               │
│              ○ Anahtar içerde      │
│                                   │
│  ┌─────────────────────────┐     │
│  │ 💰 En fazla 1.790 ₺     │     │ ← cap (K-1)
│  │ Gerçek ücret mesafeye    │     │
│  │ göre; cap aşılmaz.       │     │
│  └─────────────────────────┘     │
│                                   │
│  [ ⚡ Çekici Çağır ]              │ ← primary CTA
└──────────────────────────────────┘
```

**Alan kuralları:**
- Alım zorunlu (GPS + manuel pin); Teslim opsiyonel (sonra eklenebilir; default "servise götür" veya boş).
- Araç: Kullanıcının araçları otomatik; bir araç yoksa plaka inline ekleme.
- Durum: 7 HONK-pattern seçenek. `Kaza` seçilirse → kaza akışına yumuşak yönlendirme ("bu kaza sonrası bir çekici mi, kaza dosyası mı açıyorsun?") — çift akış yaratmamak için kritik.

### 3.2 Ekran 2: Dispatch arama

Tap → pre-auth başlatılır → radar ekranı:

```
┌──────────────────────────────────┐
│                                   │
│     🔍  Yakında çekici            │
│         arıyoruz...               │
│                                   │
│     ●────●────●                   │ ← animated
│                                   │
│     3 çekici deneniyor.           │
│     Genelde 15-30 sn.             │
│                                   │
│     [ İptal et · 0 ₺ ]            │ ← K-4
└──────────────────────────────────┘
```

Platform en yakın çekiciye 15 sn accept penceresi verir. Red → sonraki en yakın. Toplam 3 dk timeout.

### 3.3 Ekran 3: Match bulundu

```
┌──────────────────────────────────┐
│  ┌──────────────────────────┐   │
│  │ 🚚  Mustafa U.            │   │
│  │  ⭐ 4.8 · 128 iş          │   │
│  │  Plaka: 34 AB 1234         │   │
│  │  Flatbed · 12 dk           │   │
│  │  [Ara] [Mesaj]             │   │
│  └──────────────────────────┘   │
│                                   │
│     HARİTA (canlı çekici + rota) │
│                                   │
│  ●──────●──────●──────●──────●    │
│  Yolda  Yaklşyr Vardı Yüklyr Yolda│
│                                   │
│  ETA: 12 dk · cap 1.790 ₺        │
│                                   │
│  [ İptal · 75 ₺ ]                 │ ← K-4
└──────────────────────────────────┘
```

Stage progression bar + push bildirim + SMS her geçişte.

### 3.4 Ekran 4: Vardı — kanıt

Çekici "Vardım" butonuna basar → kullanıcıya push + ekranda:

- Çekicinin çektiği "geldim" fotosu
- Kullanıcıya: **"Aracınızın mevcut durumunu kanıtlamak için 4 foto"** (4 açı; opsiyonel ama puan boost — trust ledger)
- 6 haneli OTP: çekici kullanıcıya sorar → kullanıcı söyler → yükleme onaylandı

### 3.5 Ekran 5: Teslim

Hedefe varınca:
- Çekici teslim fotosu
- Teslim alan OTP'si (kullanıcı veya atölye)
- Otomatik charge + fatura PDF
- "Hizmeti değerlendir" 5 yıldız + opsiyonel yorum

---

## 4. Müşteri UX — Randevulu modu

### 4.1 Ekran 1: Aynı hub, Randevulu tab

Alım / Teslim / Araç / Durum aynı. Ek olarak:

```
│  📅 Tarih ve saat                  │
│      [26 Nisan 2026, 14:00]      │ ← tap → picker
│                                   │
│  [ Teklif Topla ]                 │ ← Hemen yerine bu
```

Min 2 saat ileri, max 90 gün (K-6).

### 4.2 Ekran 2: Bidding havuzu

Case oluşturulur, `status="matching"` → uygun çekicilere push bildirim. N çekici teklif verir (30 dk açık).

Müşteriye kart-liste:

```
┌────────────────────────────────┐
│  💡 3 teklif geldi              │
├────────────────────────────────┤
│ Usta A · ⭐4.9 · 1.450 ₺       │
│ Flatbed · 14:00 garanti         │
│ ──────────────                  │
│ Usta B · ⭐4.6 · 1.280 ₺       │
│ Hook · 14:15 civarı             │
│ ──────────────                  │
│ Usta C · ⭐4.7 · 1.590 ₺       │
│ Flatbed · %100 on-time          │
└────────────────────────────────┘
  [Seç]
```

### 4.3 Ekran 3: Seçim + kilitleme

Seç → pre-auth teklif fiyatı (K-2; sabit). Takvime event. 1 saat öncesi çekiciye, 15 dk öncesi kullanıcıya reminder.

### 4.4 Ekran 4-5: Dispatch, kanıt, teslim

Hemen modundaki gibi. Fark: dispatch saati zamanlayıcı ile tetiklenir.

---

## 5. Çekici (tower) tarafı UX

### 5.1 Hemen modu — atama

Panel'de **accept sheet** fırlar:

```
┌──────────────────────────────┐
│  ⚡ ACİL ÇEKİCİ İSTEĞİ        │
│                               │
│  Maslak / Kemer Cd.           │
│  BMW 320i · Çalışmıyor        │
│  ~ 4.2 km · ETA 12 dk         │
│  Flatbed gerekli               │
│                               │
│  Kazanç: 1.610 ₺ (platform     │
│  kesintisi sonrası 1.449 ₺)   │
│                               │
│  15 sn içinde yanıtla          │
│  [ KABUL ]    [ RED ]         │
└──────────────────────────────┘
```

Accept → dispatch başlar. Red veya timeout → bir sonraki en yakın çekiciye.

### 5.2 Randevulu modu — havuz

Pool feed'de normal iş kartı (bkz. mevcut [naro-service-app/src/features/pool/components/PoolReelsCard.tsx](../naro-service-app/src/features/pool/components/PoolReelsCard.tsx)). Tek fark: çekici teklif sheet'i **fiyat + ETA garantisi + truck tipi** alanları zorunlu.

### 5.3 Canlı iş ekranı

```
Stage: Yola çıktı → Yaklaşıyor → Vardı → Yüklüyor → Yolda → Teslim
```

Her stage'de:
- Stage tap → kanıt yükleme (foto)
- "Vardım" → OTP sor (müşteri'den)
- "Yükledim" → foto zorunlu
- "Teslim ettim" → OTP sor (teslim alan'dan) + foto zorunlu

**Canlı GPS:** Dispatch anından teslim anına kadar çekicinin konum stream'i backend'e gider (5 sn interval). Müşteri live track ekranında görür.

---

## 6. Mimari sorumluluk dağılımı

| Katman | Sorumlu sohbet | Ana dosyalar / modüller |
|---|---|---|
| **Shared contract** (@naro/domain) | PRODUCT-OWNER spec + BACKEND-DEV + UI-UX-FRONTEND-DEV | [packages/domain/src/service-case.ts](../packages/domain/src/service-case.ts), yeni `tow.ts` |
| **Backend dispatch + state + payment** | BACKEND-DEV | `app/services/tow_dispatch.py`, `app/services/tow_payment.py`, `app/models/tow.py` (yeni), migrations |
| **Backend realtime** (GPS stream) | BACKEND-DEV | FastAPI WebSocket endpoint `/ws/tow/{case_id}` + Redis pub/sub |
| **Müşteri frontend** | UI-UX-FRONTEND-DEV | [naro-app/app/(modal)/cekici-cagir.tsx](../naro-app/app/(modal)/cekici-cagir.tsx) (rewrite), yeni `TowHubScreen.tsx`, `TowLiveTrackScreen.tsx`, `TowMatchFoundScreen.tsx` |
| **Çekici (usta) frontend** | UI-UX-FRONTEND-DEV | `naro-service-app` yeni `TowAcceptSheet.tsx`, `TowActiveJobScreen.tsx`, GPS broadcaster hook |
| **Harita + geocoding** | UI-UX-FRONTEND-DEV | Map provider seçimi (Mapbox/Google/Apple) — PO kararı gerekli |
| **Kasko operasyonu** | BD + operations (manuel V1) | Dokümantasyon `docs/business/ortakliklar/` |

---

## 7. Shared contract — packages/domain değişimi

Yeni dosya: `packages/domain/src/tow.ts`.

```typescript
export const TowServiceModeSchema = z.enum(["immediate", "scheduled"]);
export type TowServiceMode = z.infer<typeof TowServiceModeSchema>;

export const TowVehicleEquipmentSchema = z.enum([
  "flatbed",
  "hook",
  "wheel_lift",
  "heavy_duty",
  "motorcycle",
]);
export type TowVehicleEquipment = z.infer<typeof TowVehicleEquipmentSchema>;

export const TowIncidentReasonSchema = z.enum([
  "not_running",
  "accident",
  "flat_tire",
  "battery",
  "fuel",
  "locked_keys",
  "stuck",
  "other",
]);
export type TowIncidentReason = z.infer<typeof TowIncidentReasonSchema>;

export const TowDispatchStageSchema = z.enum([
  "searching",
  "accepted",
  "en_route",
  "nearby",
  "arrived",
  "loading",
  "in_transit",
  "delivered",
  "cancelled",
  "timeout_converted_to_pool",
]);
export type TowDispatchStage = z.infer<typeof TowDispatchStageSchema>;

export const TowFareQuoteSchema = z.object({
  mode: TowServiceModeSchema,
  base_amount: z.number(),       // 950 default
  distance_km: z.number(),
  per_km_rate: z.number(),       // 70 default
  urgency_surcharge: z.number(), // 80 if urgent
  buffer_pct: z.number(),        // 0.10 (cap için)
  cap_amount: z.number(),        // hesap: (base + dist*rate + surcharge) * (1 + buffer)
  locked_price: z.number().nullable().default(null), // scheduled mode → teklif seçiminde kilitlenir
  currency: z.string().default("TRY"),
});
export type TowFareQuote = z.infer<typeof TowFareQuoteSchema>;

export const TowLiveLocationSchema = z.object({
  case_id: z.string(),
  technician_id: z.string(),
  lat: z.number(),
  lng: z.number(),
  heading: z.number().nullable().default(null),
  speed_kmh: z.number().nullable().default(null),
  captured_at: z.string(),
});
export type TowLiveLocation = z.infer<typeof TowLiveLocationSchema>;

export const TowKaskoDeclarationSchema = z.object({
  has_kasko: z.boolean().default(false),
  insurer_name: z.string().optional(),
  policy_number: z.string().optional(),
  pre_auth_on_customer_card: z.boolean().default(true), // V1 davranışı
});
export type TowKaskoDeclaration = z.infer<typeof TowKaskoDeclarationSchema>;

export const TowRequestSchema = z.object({
  mode: TowServiceModeSchema,
  pickup_lat_lng: z.object({ lat: z.number(), lng: z.number() }),
  pickup_label: z.string(),
  dropoff_lat_lng: z.object({ lat: z.number(), lng: z.number() }).nullable().default(null),
  dropoff_label: z.string().nullable().default(null),
  vehicle_id: z.string(),
  incident_reason: TowIncidentReasonSchema,
  required_equipment: TowVehicleEquipmentSchema,
  scheduled_at: z.string().nullable().default(null), // scheduled mode için
  fare_quote: TowFareQuoteSchema,
  kasko: TowKaskoDeclarationSchema.default({ has_kasko: false, pre_auth_on_customer_card: true }),
  attachments: z.array(z.string()).default([]), // CaseAttachment ID'leri (4 açı foto)
});
export type TowRequest = z.infer<typeof TowRequestSchema>;
```

`ServiceRequestDraft`'a eklenecek: `tow_request: TowRequestSchema.nullable().default(null)` — `kind="towing"` ise dolu olur.

---

## 8. Backend — veri modeli

### 8.1 Yeni tablolar

**`tow_dispatch_attempts`** — Hemen modunda denenen çekici + sonuç log'u.

```sql
CREATE TABLE tow_dispatch_attempts (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id             UUID NOT NULL REFERENCES service_cases(id) ON DELETE CASCADE,
    technician_id       UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    attempt_order       SMALLINT NOT NULL,
    sent_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    response_at         TIMESTAMPTZ,
    response            VARCHAR(16), -- 'accepted' | 'declined' | 'timeout'
    distance_km         NUMERIC(6,2),
    eta_minutes         INT,
    UNIQUE (case_id, attempt_order)
);
CREATE INDEX ix_tow_dispatch_case ON tow_dispatch_attempts (case_id, sent_at DESC);
```

**`tow_live_locations`** — GPS stream (append-only, rolling TTL).

```sql
CREATE TABLE tow_live_locations (
    id             BIGSERIAL PRIMARY KEY,
    case_id        UUID NOT NULL REFERENCES service_cases(id) ON DELETE CASCADE,
    technician_id  UUID NOT NULL,
    lat            NUMERIC(9,6) NOT NULL,
    lng            NUMERIC(9,6) NOT NULL,
    heading        SMALLINT,
    speed_kmh      SMALLINT,
    captured_at    TIMESTAMPTZ NOT NULL,
    received_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX ix_tow_locations_case ON tow_live_locations (case_id, captured_at DESC);
-- Retention: case completed/cancelled → 30g sonra purge (KVKK)
```

**`tow_fare_settlements`** — Pre-auth + final charge + refund takibi.

```sql
CREATE TABLE tow_fare_settlements (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id                UUID UNIQUE NOT NULL REFERENCES service_cases(id) ON DELETE RESTRICT,
    mode                   VARCHAR(16) NOT NULL, -- 'immediate' | 'scheduled'
    quote                  JSONB NOT NULL,       -- TowFareQuote snapshot
    preauth_amount         NUMERIC(10,2) NOT NULL,
    preauth_psp_ref        VARCHAR(120),
    preauth_at             TIMESTAMPTZ,
    final_amount           NUMERIC(10,2),
    final_charged_at       TIMESTAMPTZ,
    refund_amount          NUMERIC(10,2) DEFAULT 0,
    refund_reason          VARCHAR(60),           -- 'cap_buffer', 'cancellation', 'kasko_reimbursement', ...
    platform_commission    NUMERIC(10,2),         -- 10% V1 pilot (bkz. billing brief)
    kasko_declared         BOOLEAN NOT NULL DEFAULT FALSE,
    kasko_reimbursed_at    TIMESTAMPTZ,
    cancellation_fee       NUMERIC(10,2) DEFAULT 0,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**`tow_cancellations`** — İptal nedeni + ücreti.

```sql
CREATE TABLE tow_cancellations (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id          UUID UNIQUE NOT NULL REFERENCES service_cases(id) ON DELETE CASCADE,
    cancelled_by     VARCHAR(16) NOT NULL, -- 'customer' | 'technician' | 'system'
    stage_at_cancel  VARCHAR(32) NOT NULL, -- TowDispatchStage
    fee_amount       NUMERIC(10,2) NOT NULL DEFAULT 0,
    reason           VARCHAR(120),
    cancelled_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 8.2 `service_cases` kolon eklemeleri

```sql
ALTER TABLE service_cases ADD COLUMN tow_mode VARCHAR(16);   -- 'immediate' | 'scheduled' (NULL if kind != 'towing')
ALTER TABLE service_cases ADD COLUMN tow_stage VARCHAR(32);  -- TowDispatchStage
ALTER TABLE service_cases ADD COLUMN pickup_lat NUMERIC(9,6);
ALTER TABLE service_cases ADD COLUMN pickup_lng NUMERIC(9,6);
ALTER TABLE service_cases ADD COLUMN dropoff_lat NUMERIC(9,6);
ALTER TABLE service_cases ADD COLUMN dropoff_lng NUMERIC(9,6);
ALTER TABLE service_cases ADD COLUMN scheduled_at TIMESTAMPTZ;

CREATE INDEX ix_cases_tow_active ON service_cases (tow_stage, created_at DESC)
    WHERE kind = 'towing' AND tow_stage NOT IN ('delivered', 'cancelled', 'timeout_converted_to_pool');
```

### 8.3 Servis katmanı

Yeni dosya: `naro-backend/app/services/tow_dispatch.py`.

```python
async def create_tow_case(request: TowRequest, customer_id: UUID) -> ServiceCase:
    # 1. Validate (radius içinde uygun çekici var mı quick check)
    # 2. Pre-auth kartı (tow_fare_settlements insert + PSP çağrısı)
    # 3. ServiceCase yarat (kind='towing', tow_mode=mode, tow_stage='searching' if immediate else 'pool')
    # 4. Eğer immediate → dispatch_loop başlat (ARQ background)
    # 5. Eğer scheduled → havuza düşer, pool feed gösterir
    ...

async def dispatch_loop(case_id: UUID) -> None:
    """3 dk timeout, her adayla 15 sn accept window."""
    # - Candidate seç (en yakın, equipment uygun, rating + response_time skorlu)
    # - Push notif gönder → tow_dispatch_attempts insert
    # - 15 sn bekle veya cevap gelsin
    # - accept → tow_stage='accepted', assigned_technician_id set
    # - decline/timeout → bir sonraki
    # - 3 dk sonunda match yok → tow_stage='timeout_converted_to_pool', kullanıcıya "havuza aç" seçeneği
    ...

async def record_live_location(case_id, technician_id, lat, lng, heading, speed) -> None:
    # tow_live_locations insert + Redis pub/sub publish
    ...

async def transition_stage(case_id: UUID, new_stage: TowDispatchStage, actor: CaseActor) -> None:
    # State machine transition, kanıt zorunluluk kontrolü, event log
    # arrived → customer OTP required
    # loading → pickup photo required
    # delivered → dropoff photo + recipient OTP required
    ...

async def finalize_fare(case_id: UUID) -> None:
    # Actual distance hesapla (tow_live_locations integral veya start-end haversine)
    # cap kontrolü: final > cap → platform absorbe eder, customer cap öder
    # charge (pre-auth capture or refund diff)
    # platform commission (10%)
    # kasko flag varsa customer'a "kasko'na ibraz et" SMS + operations'a ticket
    ...

async def compute_cancellation_fee(case_id: UUID, at_stage: TowDispatchStage) -> Decimal:
    # K-4 tablosu
    ...
```

### 8.4 API uç noktaları

```
POST   /api/v1/tow/estimate            — quote al, pre-auth yok
POST   /api/v1/tow/request              — Hemen modu: pre-auth + dispatch
POST   /api/v1/tow/schedule             — Randevulu modu: havuza düşür
GET    /api/v1/tow/{case_id}/status     — current stage + match + ETA
POST   /api/v1/tow/{case_id}/cancel     — iptal (fee otomatik hesaplanır)
POST   /api/v1/tow/{case_id}/stage/arrived  — (technician)
POST   /api/v1/tow/{case_id}/stage/loading  — (technician, photo + OTP)
POST   /api/v1/tow/{case_id}/stage/delivered — (technician, photo + OTP)
POST   /api/v1/tow/{case_id}/customer-arrival-otp — (customer, OTP verify)
WS     /ws/tow/{case_id}                — live location stream (customer + technician subscribe)
POST   /api/v1/tow/{case_id}/location   — (technician broadcast)
```

### 8.5 ARQ cron / worker

- `tow_dispatch_worker` — her yeni Hemen case için dispatch_loop
- `tow_scheduled_reminder` — 1 saat öncesi çekici + 15 dk öncesi kullanıcı push
- `tow_location_retention_purge` — günlük; 30g+ delivered case'lerin tow_live_locations satırlarını sil (KVKK)
- `tow_fare_settlement_reconcile` — saatlik; pending pre-auth'lar için PSP durumu kontrol

---

## 9. Dispatch algoritması (Hemen modu için özel)

Acil çekici için matching motoru normal 7-boyutlu skor ÇALIŞTIRMAZ; dar sinyal setiyle **saniyeler içinde** karar verir (bkz. [docs/sinyal-hiyerarsi-mimari.md §4](sinyal-hiyerarsi-mimari.md)).

### Aday filtreleme (hard):

```
WHERE technician.provider_type = 'cekici'
  AND technician.availability = 'available'
  AND technician.admission_gate = true
  AND technician.equipment ⊇ required_equipment
  AND ST_DWithin(technician.current_lat_lng, pickup_lat_lng, initial_radius_km=10)
  AND technician.current_queue_depth < max_concurrent_jobs
```

### Ranking (sıralı sinyaller, 7 faktör):

1. `distance_km` (haversine → ETA proxy) — ağırlık 0.35
2. `bayesian_rating` — 0.15
3. `response_time_p50` (geçmiş 30g) — 0.15
4. `accept_rate` (geçmiş 30g) — 0.15
5. `equipment_premium_authorized` (luxury araç için) — 0.10
6. `fairness_rotation` (son 24h iş dağılımı, starvation boost) — 0.05
7. `evidence_discipline_score` — 0.05

### Fallback (kullanıcı-şeffaf):

- T=0-60sn: radius 10 km içinde denemeler, 15 sn accept window her biri için
- T=60-120sn: radius 25 km'ye genişlet
- T=120-180sn: radius 50 km
- T=180sn: kullanıcıya push — *"Yakınımızda uygun çekici bulamadık. Havuza açalım mı? Fiyatlar değişebilir."*
- User onay → `tow_stage='timeout_converted_to_pool'`, randevulu akışa döner ama urgency tag'li

---

## 10. Ödeme mimarisi (Uber pattern + kasko)

### 10.1 Pre-auth

**Hemen:** Tap "Çekici çağır" → PSP (Iyzico/Stripe) pre-auth hold = **cap_amount** (K-1).

**Randevulu:** Teklif "Seç" → pre-auth hold = **locked_price** (K-2).

Hold 7 gün geçerli (tüm PSP standardı). İptal/timeout → hold release.

### 10.2 Final charge

**Hemen:**
- Gerçek mesafe = haversine(pickup, dropoff) veya tow_live_locations integral
- Gerçek amount = base + gerçek_mesafe × per_km + surcharge
- `final_amount = min(gerçek_amount, cap_amount)` — cap aşılmaz (K-1)
- Charge = pre-auth capture, fazlası refund

**Randevulu:**
- `final_amount = locked_price` (K-2), değişmez
- Charge tamamı

### 10.3 Platform komisyonu

`platform_commission = final_amount × 0.10` — V1 pilot (bkz. [billing brief](backend-billing-servisi-brief.md)).

Çekiciye net: `net = final_amount - commission`.

### 10.4 Kasko (V1)

`kasko_declared = true` ise:
1. Pre-auth + charge normal (müşteri kartından) — K-5
2. Fatura PDF müşteriye gönderilir
3. SMS: *"Faturayı kaskoya ibraz edin ve Naro'ya yönlendirin. X iş gününde hesabınıza iade."*
4. Operations ekibi (BD) sigorta şirketinden tahsilat yapar
5. Tahsilat sonrası: `refund_amount = final_amount`, `kasko_reimbursed_at = NOW()`, müşteri kartına iade

V2: insurance API entegrasyonu + pre-auth direkt kasko'ya yönlendirilir (müşteri kartına dokunmaz).

### 10.5 İptal ücretleri (K-4)

`tow_cancellations` tablosundan, `stage_at_cancel` baz alınarak hesaplanır. Servis katmanı `compute_cancellation_fee()` fonksiyonunda.

---

## 11. Trust ledger — çekici özel aşamaları

| Aşama | Actor | Kanıt | Zorunlu mu |
|---|---|---|---|
| `request` | müşteri | 4 açı foto (aracın mevcut durumu) | Opsiyonel, trust boost |
| `accepted` | çekici | — | Sistem log |
| `en_route` | sistem | GPS stream başlangıç | Otomatik |
| `arrived` | çekici | "Geldim" foto + GPS + timestamp | ZORUNLU |
| `loading` | çekici | Araç-yüklenmiş foto (min 2 açı) | ZORUNLU |
| `loading` | müşteri | OTP onayı | ZORUNLU |
| `in_transit` | sistem | GPS stream | Otomatik |
| `delivered` | çekici | Teslim foto (araç + teslim yeri) | ZORUNLU |
| `delivered` | teslim alan | OTP onayı | ZORUNLU |

Eksik zorunlu kanıt → `evidence_discipline_score` düşer → sonraki iş atamalarında ranking penalty (Boyut 5 performance).

OTP mekanizması: sistem 6 haneli kod üretir → müşteriye SMS + ekran → çekici kullanıcıdan sorar → kendi ekranına girer → backend doğrular.

---

## 12. Durum makinesi (çekici özel)

```
[Hemen]
  searching ──┬─→ accepted ──→ en_route ──→ nearby ──→ arrived ──→
              │                                                    │
              └─→ timeout_converted_to_pool (→ scheduled flow)     │
                                                                    ↓
[Her yerden] cancelled (fee hesaplanır)              loading ──→ in_transit ──→ delivered

[Randevulu]
  pool_open ──→ offers_ready ──→ scheduled ──(scheduled_at geldi)──→ en_route ──→ ...
```

`case_lifecycle.py` mevcut transition enforcement'a eklenir:

```python
TOW_ALLOWED = {
    SEARCHING:       {ACCEPTED, TIMEOUT_CONVERTED, CANCELLED},
    ACCEPTED:        {EN_ROUTE, CANCELLED},
    EN_ROUTE:        {NEARBY, CANCELLED},
    NEARBY:          {ARRIVED, CANCELLED},
    ARRIVED:         {LOADING, CANCELLED},
    LOADING:         {IN_TRANSIT},  # cancel kapalı — araç yüklendi
    IN_TRANSIT:      {DELIVERED},   # cancel kapalı
    DELIVERED:       set(),         # terminal
    CANCELLED:       set(),
    TIMEOUT_CONVERTED: {...scheduled flow...},
}
```

---

## 13. Edge case'ler

| Durum | Davranış |
|---|---|
| Müşteri dispatch sırasında iptal | 0 ₺, hold release |
| Çekici vardı, kullanıcı OTP vermiyor (çekildi/uyudu) | 10 dk bekle → çekici "waited" butonu → otomatik bekleme ücreti 50 ₺/15dk → max 45 dk → çekici ayrılır, cancelled by technician, fee 300 ₺ platform'a (çekiciye yol tazmini) |
| Çekici yolda iptal ediyor (ariza/kaza) | Case geri dispatch_loop'a, yeni aday; müşteri bilgilendirme push; ek ücret yok |
| GPS kaybı (tünel vb.) | Son lokasyon 90 sn tutulur; 90 sn sonra "sinyal kayıp" UI; çekiciden manuel "geldim" tap beklenir |
| Müşteri hedef değiştirmek istiyor | Dispatch öncesi: serbest. Yolda: çekici onayı gerekli, fare yeniden hesap (cap güncellenir, delta pre-auth) |
| Teslim alan kim? | Default müşteri kendisi; bir servise bırakma durumunda servis OTP'si alınır (ön kayıtlı usta ise otomatik, değilse telefon doğrulama) |
| Kaza sonrası çekici + ekspertiz birleşik akış | Müşteri "Kaza" seçince → çift akış önerisi: "sadece çekici / kaza dosyası + çekici". İkincide kaza composer (`AccidentFlow`) + otomatik çekici request bir vakada zincirlenir — aynı `service_case.id`, kind=`accident`, yan-tow_request dolu |
| Fleet / kurumsal müşteri | V2 kapsamı — mevcut davranış: kişisel hesap gibi |
| Kasko limit aşımı | Fatura kasko'ya ibraz sonrası sigorta "kısmi öder" dönerse operations elle delta fatura çıkarır |

---

## 14. Başarı metrikleri (KPI)

**Müşteri tarafı:**
- Hemen modu → "Çekici çağır" tap → accepted match süresi (p50 target: 45 sn, p95: 120 sn)
- Match → arrived süresi (ETA gerçeklik oranı; target: promised_eta ± %15 içinde)
- İptal oranı (target: dispatch sonrası iptal < %8)
- NPS (5 yıldız) dağılımı — tow için ayrı çünkü hizmet tek seferlik

**Çekici tarafı:**
- Accept rate (target: > %75)
- Response time p50 (target: < 8 sn)
- Evidence discipline score (target: > 0.85)
- Utilization (günlük iş sayısı / available saat)

**Platform:**
- Kasko deklarasyon oranı (V1 pazar bilgisi için)
- Cap aşım oranı (platform'un yüklendiği para; < %5)
- Timeout_converted_to_pool oranı (düşük = dispatch sağlıklı; target: < %10)
- Revenue per tow (10% komisyon ortalaması)

---

## 15. Faz planı

**Faz 8 — Tow backend V1:**
- `tow_dispatch_attempts`, `tow_live_locations`, `tow_fare_settlements`, `tow_cancellations` migration
- `service_cases` kolon eklemeleri
- `tow_dispatch_service.py` core logic + dispatch_loop ARQ worker
- API endpoints (WebSocket hariç ilk iteration)
- Payment PSP entegrasyon stub (Iyzico placeholder)
- Unit + integration test

**Faz 9 — Tow backend V2:**
- WebSocket live location stream
- Kasko operations workflow (BD ile koordine)
- Retention cron (KVKK)
- Stage enforcement sıkılaştırma

**Faz 10 — Tow frontend V1 (müşteri):**
- Map-first hub (Hemen + Randevulu tablar)
- Match found + live track ekranları
- Fare summary + OTP + evidence upload
- Mevcut cekici-cagir.tsx rewrite

**Faz 11 — Tow frontend V1 (çekici):**
- Accept sheet
- Active job screen + GPS broadcaster
- Stage progression evidence upload

**Faz 12 — Tow observability + optimization:**
- KPI dashboard (Grafana veya admin panel)
- Dispatch parametre tuning (radius, timeout, accept window)

---

## 16. Kaynaklar ve referanslar

**İç (Naro):**
- [memory: matching_regime](~/.claude/projects/-home-alfonso-sanayi-app/memory/matching_regime.md) — acil çekici auto-dispatch kararı
- [docs/naro-urun-use-case-spec.md](naro-urun-use-case-spec.md) — UC-1 Çekici north star
- [docs/backend-billing-servisi-brief.md](backend-billing-servisi-brief.md) — %10 komisyon V1, ön/ara/son ödeme (çekici tek aşamalı)
- [docs/musteri-hasar-composer-revizyon.md](musteri-hasar-composer-revizyon.md) — kaza akışı (çekici + kaza zincirli flow için)
- [docs/sinyal-hiyerarsi-mimari.md](sinyal-hiyerarsi-mimari.md) — 7-boyutlu sinyal; çekici için dar setin §4'te
- [docs/usta-eslestirme-mimarisi.md](usta-eslestirme-mimarisi.md) — admission + dinamik skor
- [docs/veri-modeli/04-case.md](veri-modeli/04-case.md) — ServiceCase schema (çekici için tow_* kolonları eklenir)
- [docs/veri-modeli/16-technician-sinyal-modeli.md](veri-modeli/16-technician-sinyal-modeli.md) — çekici admission: provider_type=cekici + equipment beyan

**Dış (benchmark):**
- Uber Reserve — scheduled ride pattern (fiyat kilitleme, pre-auth, cancellation)
- HONK — on-demand tow max-price vaadi, 7-reason list
- Swoop/Agero — B2B tow dispatch evidence discipline + photo + signature
- Urgent.ly — on-demand roadside assistance

**Shared contract:**
- Yeni: `packages/domain/src/tow.ts` (bu doc §7)
- `packages/domain/src/service-case.ts` → `ServiceRequestDraft.tow_request` alanı

---

## 17. Açık kalan konular (V2 veya PO sonra karar)

- **Map provider:** Mapbox / Google Maps / Apple Maps — fiyat + TR kapsamı + pattern library → ayrı karar dokümanı (PO önümüzdeki hafta)
- **PSP:** Iyzico vs Stripe TR vs Param → BACKEND-DEV + BD ortak karar
- **WebSocket vs Firebase Realtime:** canlı GPS stream altyapısı — BACKEND-DEV teknik karar
- **Kasko ortaklıkları:** Hangi sigorta şirketleriyle V2 API entegrasyonu → BD sohbetine gönderildi
- **Multi-stop tow:** A noktasından alıp B'ye, sonra C'ye — V2 kapsamı
- **Fleet / kurumsal müşteri tow:** Filo ödemeli hesap tipi — V3 kapsamı
- **Motosiklet özel ekipmanı:** Ayrı `motorcycle` equipment enum değeri tanımlı; V1'de düşük öncelik

---

**Son güncellenme:** 2026-04-21 · PO kararları baked-in · BACKEND-DEV ve UI-UX-FRONTEND-DEV brief'leri bu doc'a referans verir.
