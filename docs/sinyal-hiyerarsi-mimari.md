# Sinyal Hiyerarşisi Mimarisi

## 1. Amaç ve bağlam

[docs/usta-eslestirme-mimarisi.md](usta-eslestirme-mimarisi.md) matching motorunun iskeletini tanımlar: admission-gate + dinamik skor + AI referee + güven katmanı. Bu döküman onun **sinyal tarafını** formalize eder — yani:

- Usta tarafında hangi sinyaller toplanır, nasıl yapılandırılır, nereye yerleşir.
- Vaka tarafında hangi sinyaller kullanıcıdan istenir, hangileri türetilir.
- Skor ve filtre hangi seviyede hangi sinyali tüketir.
- UX'i bozmadan sinyal zenginliği nasıl artar.

Problem: bugün usta profilinde `specialties: string[]` + `expertise: string[]` serbest metin kovaları; marka, kategori, işlem, hizmet türü aynı dizide karışmış. Coğrafya `area_label` tek string; lat/lng, `service_radius_km`, `working_districts` yok. `working_hours` serbest metin — structured schedule olmadan "Cuma gecesi açık mı" sorgusu imkansız. Marka/model/motor coverage yok, kapasite alanları yok.

Sonuç: matching motoru katman katman filtre + skor çalıştıramaz; string match'e mahkum.

**Outcome:** sinyaller 7 dikey boyut × 2-4 seviye hiyerarşide düzenlenir. Taksonomi tek kaynaktan (`packages/domain/src/taxonomy/`) tüketilir. Mevcut UX ince dokunuşlarla korunur; kullanıcıdan minimum bilgi alınır, gerisi türetilir.

## 2. Tasarım ilkeleri

- **Yapısal > serbest metin.** Her sinyal önce enum veya şema ile yapılandırılır; serbest metin sadece türetme kaynağı olarak kalır.
- **Hiyerarşi = matching tekniği.** Bir sinyalin derinliği, matching'in ona nasıl davranacağını belirler. L0-L1 hard filter, L2 soft score, L3 AI/embedding.
- **Minimum-info ekstraksiyon.** Kullanıcıdan alınan her alan kullanıcı zamanı demektir. Plaka → araç lookup, map pin → lat/lng+city+district, foto → AI intake. Direkt sorma, türetilebilen türetilmelidir.
- **Tek kaynak taksonomi.** Naro müşteri app'i, usta app'i ve backend aynı enum'ları paylaşır. Sürümleme `packages/domain` versiyonuyla yürür.
- **Geriye uyumluluk.** Serbest metin alanları hemen silinmez; V1 deprecated olarak tutulur, V2'de kaldırılır. Matching okumaz.
- **Persona-adaptif akış.** Panik, bilgisiz ve deneyimli kullanıcılar aynı sinyali farklı yollarla üretir; UX akışı buna göre şekillenir.
- **Gaming savunması.** Self-beyan sinyalleri düşük ağırlıkla başlar; AI evidence ve tamamlanmış iş geçmişi geri-doğrulama yapar.

## 3. 7 Boyut

Her boyutta usta tarafı (arz) ve vaka tarafı (talep) paralel yapıdadır. Matching = boyut-eşlenik eşleştirme.

### 3.1 Boyut 1 — Ne yapıyorum / Ne oldu (hizmet-vaka taksonomisi)

**Usta:**

```
L0  provider_type           enum(6)          HARD FILTER
L1  service_domains[]       enum(~12)        HARD FILTER
L2  procedures[]            taksonomi(~60)   SOFT SCORE
L3  procedure_tags[]        serbest + AI     EMBEDDING / AI
```

- `provider_type`: `usta | cekici | oto_aksesuar | kaporta_boya | lastik | oto_elektrik` — mevcut ([packages/domain/src/user.ts](../packages/domain/src/user.ts)).
- `service_domains[]`: Motor / Şanzıman / Fren / Süspansiyon / Elektrik / Klima / Lastik / Kaporta / Cam / Akü / Aksesuar / Çekici. Provider type'a göre preset önerilir, kullanıcı revize eder.
- `procedures[]`: Domain başına ~5-10 somut işlem. Örn. Motor domain → zamanlama_kiti, turbo_rebuild, kafa_contasi, valf_ayari, yag_bakimi, oem_izleme_teshisi.
- `procedure_tags[]`: "BMW N47 zincir", "DSG mekatronik" gibi serbest nüans. AI embedding ile vaka metniyle eşleşir.

**Vaka:**

```
L0  kind                    enum(4)          HARD FILTER
L1  category                enum             HARD FILTER
L2  symptoms[] + sub        taksonomi        SOFT SCORE
L3  free_text + attachments AI parse         EMBEDDING
```

- `kind`: `accident | towing | breakdown | maintenance` — mevcut ([packages/domain/src/service-case.ts:5](../packages/domain/src/service-case.ts#L5)).
- `category`: breakdown için `engine | electric | mechanic | climate | transmission | tire | fluid | other`; maintenance için 14 kategori — mevcut ([packages/domain/src/service-case.ts:155-191](../packages/domain/src/service-case.ts#L155)).
- `symptoms[]`: mevcut `symptoms: z.array(z.string())` — taksonomiye bağlanacak (fren_titreme, akü_tükeniyor, motor_sesi_metalik).
- `free_text + attachments`: `summary + notes + attachments` — AI intake → inferred_procedures vektörü.

**Eşleme:** `provider_type ↔ kind` (hard map: accident → usta/kaporta/cekici; towing → cekici/usta; breakdown → usta/oto_elektrik/lastik; maintenance → usta/lastik/oto_elektrik/oto_aksesuar). `service_domains ⊇ category` (hard). `procedures ≈ symptoms` (soft cosine). `procedure_tags vs free_text` (embedding).

### 3.2 Boyut 2 — Hangi araca yapıyorum (uygunluk taksonomisi)

**Usta:**

```
L0  brand_tier[]            enum(5)          HARD PENALTY
L1  brand_coverage[]        enum(~40)        HARD MATCH
L2  model_coverage[]        string[]         SOFT BOOST (boş = tümü)
L3  drivetrain_coverage[]   enum(9)          HARD FILTER
```

- `brand_tier[]`: `mass | premium | luxury | commercial | motorcycle`. Her tier farklı iş disiplini + parça maliyeti gerektirir.
- `brand_coverage[]`: BMW, Mercedes, TOFAŞ, Renault, Volkswagen, Hyundai, Toyota, ... — ~40 marka. "Tümü" tek-tıkla kabul destekli.
- `model_coverage[]`: Opsiyonel. Boşsa tüm modellerle çalışır, dolu ise dar pencere.
- `drivetrain_coverage[]`: benzin_otomatik | benzin_manuel | dizel_otomatik | dizel_manuel | hibrit | ev | lpg_ek | cng_ek | motosiklet. Motor türü uzmanlaşması.

**Vaka (Vehicle):**

```
L0  vehicle.brand_tier      türetilmiş       make'ten lookup
L1  vehicle.make            string           enum'a map
L2  vehicle.model + year    string + int     
L3  vehicle.engine_type + transmission
```

Mevcut Vehicle ([packages/domain/src/vehicle.ts](../packages/domain/src/vehicle.ts)) sadece `plate + make + model + year + created_at`. Bu boyut için `engine_type`, `transmission`, `drivetrain`, `trim` alanları eklenir — **türetim öncelikli:** plaka lookup'tan make+model+year → static tablodan drivetrain/engine.

**Eşleme:** brand_tier ⊇ (mass'tan premium'a geçiş yasak, aksine serbest). brand_coverage == (hard; boş/"tümü" wildcard). model soft penalty. drivetrain hard.

### 3.3 Boyut 3 — Nerede (coğrafya)

**Usta:**

```
L0  city                    enum             HARD FILTER
L1  workshop_lat_lng        coord            DISTANCE INPUT
L2  service_radius_km       int              HARD FILTER (>= distance)
L3  working_districts[]     enum             SOFT BOOST
    mobile_unit_lat_lng     coord canlı      (çekici için)
```

- `city`: İl. Shehir/ilçe seed TR idari yapısından.
- `workshop_lat_lng`: Map pin ile alınır. Zorunlu (admission).
- `service_radius_km`: Default 15. Slider preset 5/10/15/25/50.
- `working_districts[]`: Radius geometrisinden auto-suggest; kullanıcı ekler/çıkarır.
- `mobile_unit_lat_lng`: Çekici için canlı stream; usta için N/A.

**Vaka:**

```
L0  city                    enum             HARD FILTER
L1  location_lat_lng        coord            ETA INPUT
L2  location_type           enum             CONTEXT
L3  accessibility           türetilmiş       
```

- `location_lat_lng`: Map pin veya GPS. Bugün yok — eklenmeli.
- `location_type`: `home | work | roadside | parking | highway`.
- `accessibility`: türetilmiş (otoyol + tünel → tow erişimi riski).

**Eşleme:** `city ==` (hard). `distance = haversine(workshop, case) ≤ service_radius` (hard). `travel_time_api` (rank). `district ∈ working_districts` (boost).

### 3.4 Boyut 4 — Nasıl yapıyorum (hizmet şekli + kapasite)

**Usta:**

```
L0  capabilities            4 boolean        HARD FILTER (eğer vaka bunu talep ediyorsa)
L1  working_schedule        structured       HARD FILTER (urgency=now ise)
L2  staff_count + max_concurrent_jobs
L3  night / weekend / emergency flags
```

- `capabilities`: mevcut ([packages/domain/src/user.ts:23-29](../packages/domain/src/user.ts#L23)) — `insurance_case_handler | on_site_repair | valet_service | towing_coordination`.
- `working_schedule`: 7 gün × open_time + close_time + is_closed. Çoklu aralık destekli (öğle molası için).
- `staff_count`: Kaç usta/elektrikçi aynı anda iş alıyor.
- `max_concurrent_jobs`: Atölyenin kapasitesi.
- Flags: `night_service`, `weekend_service`, `emergency_service`.

**Vaka:**

```
L0  service_mode_pref       enum             SOFT FILTER (talep, kesin değil)
L1  preferred_window        structured slot  HARD FILTER (belirtilmişse)
L2  urgency                 enum(3)          WEIGHT SHIFT
L3  drivability             bool             CAPABILITY DERIVATION
```

`service_mode_pref`: mevcut 4 boolean (`on_site_repair`, `valet_requested`, `towing_required`, `pickup_preference`). Not: memory kuralı — bunlar **talep**, ustanın kabul etmesi şart değil ([memory: user_preferences_are_requests.md]).

**Eşleme:** usta.capabilities ⊇ vaka talep'i (hard if preference=required). preferred_window ∩ working_schedule (hard if urgency=urgent). urgency=urgent → emergency_service flag boost.

### 3.5 Boyut 5 — Kimim / Ne kadar güvenilirim (admission + trust)

**Usta:**

```
L0  admission_gate          bool             HARD GATE (geçmezse skorlanmaz)
L1  verified_level          enum(3)          BOOST
L2  certificates            6 tür × 4 durum
L3  performance_snapshot    rolling metrics  SCORE INPUT
```

- `admission_gate`: KYC onaylı + tax_registration onaylı + business.legal_name + phone + service_area tanımlı + en az 1 service_domain + en az 1 working_schedule slot dolu. Aksi halde `status=pending`.
- `verified_level`: basic / verified / premium — sertifika adediyle hesaplanır ([naro-service-app/src/features/technicians/profile-store.ts:94-102](../naro-service-app/src/features/technicians/profile-store.ts#L94)).
- `certificates`: mevcut 6 tür (identity, tax_registration, trade_registry, insurance, technical, vehicle_license) × 4 durum.
- `performance_snapshot`: Bayesian rating (prior ile düzeltilmiş), response_time_p50, on_time_rate, dispute_rate, warranty_honor_rate, evidence_discipline_score. 7/30/90/365g pencerelerle.

**Vaka:**

```
L0  user_trust              bool             — fraud/cancellation değerlendirmesi
L1  payment_reliability     score
L2  case_evidence_quality   attachment count + AI quality
L3  history_patterns        tekrar eden, kronik, önceki ustalar
```

**Eşleme:** admission geçmeyen usta sonuca girmez. trust_score = Bayesian_rating ⊕ evidence_discipline ⊕ warranty_honor. Vaka evidence zayıfsa AI intake ağırlığı artar (Trust Ledger boyutuna yansır).

### 3.6 Boyut 6 — Ekonomi ve fiyat (Pro 1)

Bugünkü dokümanda açıkça yok; matching kalitesini doğrudan etkiler.

**Usta:**

```
L0  market_band_percentile  rolling P25/P50/P75/P90 per procedure
L1  price_variance          std dev
L2  overprice_frequency     AI estimate'e göre > P75 oranı
L3  hidden_cost_rate        teklif vs fatura sapması
```

**Vaka:**

```
L0  budget_range            opsiyonel user input
L1  price_preference        enum(4): any/nearby/cheap/fast
L2  willingness_to_pay_derived  persona + segment + geçmiş kabul
```

- `market_band_percentile`: Her procedure_key için usta'nın son 90 gün tekliflerinin pazar medyanına göre konumu. Overpricing caydırıcı.
- `price_variance`: Ustanın tekliflerinde istikrar. Yüksek variance → güven düşük.
- `hidden_cost_rate`: Son 90 gün tamamlanmış işlerde teklif-fatura farkı > %10 olanların oranı. Şeffaflık sinyali.

**Eşleme:** `priceFit = 1 - |usta_market_band - vaka_willingness_to_pay| / normalizer`. AI quote comparator ustanın teklifini "Uyumlu / Açıklama gerekli / Sapma" olarak etiketler ([docs/usta-eslestirme-mimarisi.md §7 madde 3](usta-eslestirme-mimarisi.md)).

### 3.7 Boyut 7 — Trust Ledger (Pro 2)

Evidence disiplininin aşama-bazlı kaydı. Bu boyut matching skoruna doğrudan, ama gelecekteki eşleştirmelerde usta trust'ını üretir.

```
Aşama                Kanıt
─────────────────────────────────────────────────────────
intake               müşteri foto/video + lat/lng damga
pickup               usta foto + GPS + timestamp + müşteri OTP
diagnosis            teşhis notu + foto/video
quote_presented      teklif kaydı (snapshot)
parts                parça faturası PDF
labor                iş kalemi log
before               foto + panel maskeleme
after                foto (aynı açı)
test_drive           video/log
delivery             foto + müşteri OTP/imza
post_service_check   7 gün sonra follow-up
```

Eksik aşama → `evidence_discipline_score` düşer. Bu skor Boyut 5 performance_snapshot içine feed edilir.

## 4. Matching tekniği — katman katman

Her boyutta katman derinliği matching tekniğini belirler:

```
L0, L1      → HARD FILTER     (geçmezse aday havuzdan elenir)
L2          → SOFT SCORE      (0-1 katsayı; per-procedure ağırlıklı)
L3          → BONUS / AI      (embedding cosine, pattern match, keyword)

finalScore  = Σ_dim w_dim × dim_soft_score 
            + admission_boost 
            + exploration_boost 
            + sponsored_boost
            - penalty_hidden_cost
            - penalty_dispute_rate

allowed     = all(hard_filters pass)
```

[docs/usta-eslestirme-mimarisi.md §6.2](usta-eslestirme-mimarisi.md)'deki formülle uyumlu:

```
finalScore = 0.30·problemFit + 0.25·trustScore + 0.15·speedScore 
           + 0.10·priceFit + 0.10·convenienceScore + 0.10·retentionScore 
           + sponsoredBoost + explorationBoost
```

Bu dokümandaki 7-boyutlu hiyerarşi bu ağırlıkların input'larını üretir:

- `problemFit` ← Boyut 1 (procedure match) + Boyut 2 (brand/drivetrain match)
- `trustScore` ← Boyut 5 (performance_snapshot + verified_level)
- `speedScore` ← Boyut 3 (distance/ETA) + Boyut 4 (availability)
- `priceFit` ← Boyut 6 (market_band vs willingness_to_pay)
- `convenienceScore` ← Boyut 3 (service_radius) + Boyut 4 (capabilities match)
- `retentionScore` ← Boyut 5 history_patterns + Boyut 7 trust_ledger

Vaka rejimine göre ağırlıklar kayar (bkz. [memory: matching_regime.md]):

- **Acil çekici** (kind=towing + urgency=urgent): Boyut 3 + Boyut 4 ezici ağırlıkta; auto-dispatch, diğerleri minimum.
- **Kaza havuzu**: Boyut 2 (brand_tier × premium_brand_authorized) + Boyut 5 (evidence discipline) + Boyut 6 (hidden_cost) ağır.
- **Bakım havuzu**: Boyut 6 (priceFit) + Boyut 4 (convenience) + Boyut 5 (retention) ağır.
- **Arıza havuzu**: Boyut 1 (procedure match) + Boyut 2 + Boyut 5 ağır.

## 5. Müşteri tarafı — minimum-info ekstrakt stratejisi

Kullanıcıdan alınan her alan zaman, friction ve abandonment riski. Strateji: **doğrudan sorma, türetilebilen türet**.

### 5.1 Araç (Boyut 2 input)

| Kullanıcı yapar | Türetilen sinyal |
|---|---|
| Plaka girer (35 ABC 42) | Araç DB lookup → make, model, year, trim |
| Onaylar/düzeltir | engine_type, transmission, drivetrain — static lookup (make+model+year → spec table) |
| Aktif araç seçer | brand_tier — static brand → tier map |
| — | vehicle_age_years — year'dan türevsel |

Kullanıcı 3-5 saniyede aracı seçer, 15 sinyal üretilir. Plaka DB bugün mock; V2'de Tramer/resmî kaynak entegrasyonu.

### 5.2 Konum (Boyut 3 input)

| Kullanıcı yapar | Türetilen sinyal |
|---|---|
| Map pin (GPS default + drag) | lat/lng |
| — | city, district (reverse geocode) |
| Location type seç (ev/iş/yol_kenarı/otopark) | location_type |
| — | accessibility — lat/lng × road network analysis |
| — | frequent_places memoize — ikinci kullanımda tek tap |

"Adres yaz" ekranı **yok**. Map pin bir adım, reverse geocode başka hiçbir soru gerektirmez.

### 5.3 Vaka (Boyut 1 input)

Persona-adaptif wizard:

**Panik kullanıcı (kaza, yolda kalma):** 3 soru sınırı.
- Ne oldu? (kaza / yolda kaldım)
- Neredesin? (map pin default: GPS)
- Foto var mı? (opsiyonel)

`kind`, `urgency=urgent`, `location_lat_lng` anında. AI intake fotoğraftan `damage_score`, `inferred_procedures`, `tow_required_inferred` çıkarır.

**Bilgisiz kullanıcı (bakım, genel arıza):** Rehberli sihirbaz, terminoloji yok.
- Araç nasıl davranıyor? (titriyor / ses çıkarıyor / çalışmıyor / ışık yanıyor)
- Nerede hissediyorsun? (önden / arkadan / direksiyonda / motorda)
- Foto + video + sesli not opsiyonları

Symptom checklist → AI → `category`, `inferred_procedures`.

**Deneyimli kullanıcı:** Express mode — doğrudan category seç + kısa metin.

### 5.4 Fiyat tercihi (Boyut 6 input)

| Kullanıcı yapar | Türetilen sinyal |
|---|---|
| price_preference seçer (any/nearby/cheap/fast) | intent vektörü |
| Opsiyonel budget_range | explicit budget |
| — | willingness_to_pay_derived — persona + category + geçmiş kabul |

## 6. Usta tarafı — minimum-friction beyan stratejisi

Usta onboarding'de benzer prensip: doğrudan seçimi kolaylaştır, preset öner, türetilebilir olanı türet.

### 6.1 Provider type → preset'ler

Provider type seçimi mevcut ([naro-service-app/src/features/technicians/provider-type.ts](../naro-service-app/src/features/technicians/provider-type.ts)) `recommendedCapabilities` preset'i ile iş yapar. Aynı pattern `recommendedServiceDomains`, `recommendedBrandTiers` için de uygulanır:

- `usta` → motor, şanzıman, fren, elektrik, klima + mass/premium tier
- `cekici` → çekici + her tier
- `kaporta_boya` → kaporta, cam + mass/premium/luxury tier
- `lastik` → lastik, akü, aksesuar + mass/premium tier
- `oto_elektrik` → elektrik, akü + her tier
- `oto_aksesuar` → aksesuar, cam + mass tier

Kullanıcı preset'i kabul eder veya ince ayar yapar.

### 6.2 Procedure taksonomi picker

Domain seçilir → o domain'e ait ~8-12 procedure multi-select ile açılır. En popüler 5-6 başa pinlenir. "Tümünü seç" opsiyonu var. Procedure_tag'ler serbest ekleme — AI embedding için.

### 6.3 Brand multi-select

40 brand tek liste + arama. "Tümü" tek-tıkla (brand_coverage=[] = wildcard kabul). Tier filtresi üstte (premium/luxury göster). Her brand için `is_authorized` + `is_premium_authorized` boolean'ları — OEM yetkili servis olması özel.

### 6.4 Map pin + radius + schedule

- Map pin workshop_lat_lng; GPS varsa default, drag ile düzeltilebilir.
- Radius slider preset: 5/10/15/25/50 km. Slider değişince harita üstünde yarıçap dairesi animate edilir.
- District auto-suggest: radius dairesine giren ilçeler chip olarak gelir; kullanıcı tek-tıkla çıkarır.
- Weekly schedule template: "Hafta içi 09-18, Cumartesi 10-15" preset → ince ayar grid.

### 6.5 Certificate → auto-fill

Yüklenen vergi levhası / kimlik → OCR → `legal_name`, `tax_number`, `address` alanları otomatik dolar. Kullanıcı review eder. (V2; şimdilik manuel.)

## 7. Taksonomi sahipliği

Tek kaynak: `packages/domain/src/taxonomy/`.

```
packages/domain/src/taxonomy/
├── service-domain.ts       enum + metadata map
├── procedure.ts            tree: {procedure_key, domain_key, label, typical_*}
├── brand.ts                enum + tier/country map
├── district.ts             TR il/ilçe (seed)
├── drivetrain.ts           enum
└── index.ts                barrel export
```

Her iki app + backend Pydantic şemaları buraya referans verir. Sürüm: `packages/domain` versiyonu. Breaking taksonomi değişikliği → major bump + backend migration.

Frontend cold-start: enum'lar statik + bundle'a gömülü. Backend hot cache: taxonomy endpoint'leri 1-saat cache.

## 8. UX compromise listesi

Her yeni alan için etki değerlendirmesi:

| Alan | Nerede istenir | +Süre | +Tap | Abandonment riski | Zorunlu/Opsiyonel |
|---|---|---|---|---|---|
| service_domains (usta) | Onboarding coverage | +20 sn | +5 | Orta | Zorunlu (min 1) |
| procedures (usta) | Onboarding coverage | +40 sn | +8 | Orta | Zorunlu (min 1) |
| brand_coverage (usta) | Onboarding coverage | +15 sn | +3 | Düşük ("tümü" default) | Opsiyonel |
| drivetrain_coverage (usta) | Onboarding coverage | +10 sn | +3 | Düşük | Opsiyonel |
| workshop_lat_lng (usta) | Onboarding service-area | +15 sn (GPS) | +2 | Düşük | Zorunlu |
| service_radius_km (usta) | Onboarding service-area | +5 sn | +1 slider | Çok düşük | Zorunlu (default 15) |
| working_districts (usta) | Onboarding service-area | +15 sn | +3 | Düşük (auto-suggest) | Opsiyonel |
| working_schedule (usta) | Onboarding service-area | +30 sn | +7 (template sonrası) | Orta | Zorunlu |
| staff/capacity (usta) | Onboarding/profile | +15 sn | +4 | Düşük | Opsiyonel |
| location_lat_lng (müşteri) | Vaka akışı | +10 sn (GPS) | +1 | Çok düşük | Zorunlu |
| plaka → araç lookup (müşteri) | Araç ekleme | -30 sn (form yerine 1 alan) | -5 | Düşük | Zorunlu |
| foto + symptom wizard (müşteri) | Vaka akışı | +15 sn | +3 | Düşük (opsiyonel skip) | Opsiyonel ama AI için kritik |

**Net:** usta onboarding 5→7 adım = +~2 dk. Müşteri vaka akışı net nötr (plaka lookup kazandığı süreyi konum pin harcar).

## 9. Sinyal olgunluk takvimi

| V | Zaman | Kapsam |
|---|---|---|
| V1 | Bugün | Yapısal beyan: provider_type, service_domains, procedures, brand_coverage, drivetrain_coverage, workshop_lat_lng, service_radius_km, working_districts, working_schedule, staff_count, capacity flags, capabilities, certificates, verified_level. Vaka: kind, category, symptoms, location_lat_lng, vehicle (plaka lookup), service_mode_pref, price_preference, urgency. |
| V2 | AI entegrasyonu + 3 ay birikim | AI intake, damage_score, inferred_procedures, NLP emotion/fraud, voice note parse, plate OCR, performance_snapshots (Bayesian rating, response_time, evidence_discipline, dispute_rate, warranty_honor), market_band_percentile, hidden_cost_rate, persona_class. |
| V3 | Partner entegrasyon | Tramer/resmî araç DB, kasko API, insurance partner network, parts supplier reliability, OEM authorized programs, road network accessibility API, live traffic API. |

## 10. Next steps

1. [docs/veri-modeli/06-usta.md](veri-modeli/06-usta.md) — bu hiyerarşinin backend veri modeli.
2. `packages/domain/src/taxonomy/` + `packages/domain/src/technician.ts` — shared schema layer.
3. naro-service-app onboarding 5→7 adım + profile screen yeni seksiyonlar.
4. naro-app tarafı vaka sinyalleri (location_lat_lng, plate lookup, AI intake) — ayrı iterasyon.
5. Matching motoru skor fonksiyonu implementasyonu — V2.

## 11. Referanslar

- [docs/usta-eslestirme-mimarisi.md](usta-eslestirme-mimarisi.md) — matching motoru iskeleti
- [docs/sanayi-ux-uyarlama-cercevesi.md](sanayi-ux-uyarlama-cercevesi.md) — persona bazlı UX
- [docs/vaka-kavrami.md](vaka-kavrami.md) — vaka state machine
- [docs/veri-modeli/04-case.md](veri-modeli/04-case.md) — vaka DB tablosu
- [docs/veri-modeli/05-offer.md](veri-modeli/05-offer.md) — teklif tablosu
- [packages/domain/src/user.ts](../packages/domain/src/user.ts) — TechnicianCapability, ProviderType, TechnicianCertificate
- [packages/domain/src/service-case.ts](../packages/domain/src/service-case.ts) — ServiceRequestKind, Urgency, BreakdownCategory, MaintenanceCategory
