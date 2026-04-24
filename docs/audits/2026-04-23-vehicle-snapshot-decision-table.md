# 2026-04-23 Vehicle Snapshot Decision Table

Bu tablo, araç verisinin hangi bölümünün master kayıtta kalacağı, hangi
bölümünün case açılışında immutable snapshot olarak kopyalanacağı ve bugün
nerede eksik olduğu kararını verir.

## Karar Kuralları

- `Master only`: uzun ömürlü profil verisi, case açıldığında freeze edilmesi
  gerekmeyen alan.
- `Master + snapshot`: matching, pricing, insurance veya operasyonu etkileyen;
  case açıldığında immutable kopyası tutulması gereken alan.
- `Subtype snapshot`: sadece belirli subtype için gereken freeze veri.
- `Missing`: bugün modeledilmemiş ama gerekecek alan.

| Signal | Current state | Decision | Not |
| --- | --- | --- | --- |
| `plate` | Vehicle modelde var | `Master + snapshot` | Operasyon ve doküman doğrulamasında değişmez bağlam gerekir. |
| `make`, `model`, `year` | Vehicle modelde var | `Master + snapshot` | Matching ve teklif bağlamı için freeze edilmeli. |
| `fuel_type` | Vehicle modelde var | `Master + snapshot` | Breakdown / maintenance uzmanlığı için kullanılabilir. |
| `vin` | Vehicle modelde var | `Master + snapshot` | Sigorta ve ownership bağlamında önemlidir. |
| `current_km` | Vehicle modelde var | `Master + snapshot` | Bakım fiyatı ve kategori kararlarını etkileyebilir. |
| `color` | Vehicle modelde var | `Master only` | Operasyonel matching için zayıf; support için master'da kalabilir. |
| `note` | Vehicle modelde var | `Master only` | Freeform profil notu; canonical matching sinyali olmamalı. |
| `body_type` | Yok | `Master + snapshot` | Araç uyumluluğu için eklenmeli. |
| `vehicle_segment` | Yok | `Master + snapshot` | Eşleşme ve fiyat tahminleri için aday alan. |
| `drivetrain` | Yok | `Master + snapshot` | Usta uzmanlığı ve bakım eşleşmesinde kullanılabilir. |
| `gross_weight_class` | Yok | `Master + snapshot` | Tow ve ağır araç ayrımında kritik. |
| `height_or_clearance_class` | Yok | `Subtype snapshot (tow)` | Kapalı otopark / erişim senaryoları için. |
| `tow_points_known` | Yok | `Subtype snapshot (tow)` | Tow operasyon uyumluluğu için. |
| `vehicle_condition_snapshot` | Yok | `Subtype snapshot` | Accident / breakdown / tow create anı bağlamı için. |
| `vehicle_drivable` | Draft/request'te var | `Subtype snapshot` | Accident, breakdown ve tow için freeze edilmeli. |
| `plate_photo_asset_id` | Media policy var, vehicle schema yok | `Master + snapshot` | Belge/kimlik doğrulama için. |
| `vehicle_photo_asset_ids` | Media policy var, vehicle schema yok | `Master + snapshot` | Hasar ve fiziksel sınıf bağlamı için. |
| `inspection_valid_until` | Vehicle modelde var | `Master only` | Reminder alanı; matching kaynağı sayılmamalı. |
| `kasko_valid_until`, `kasko_insurer` | Vehicle modelde var | `Master + snapshot (accident)` | Claim başlatılırken case bağlamına freeze edilmeli. |
| `trafik_valid_until`, `trafik_insurer` | Vehicle modelde var | `Master + snapshot (accident)` | Aynı şekilde claim bağlamı için. |

## Bugünkü Yapısal Riskler

- Case tarafında `vehicle_id` dışında immutable vehicle snapshot yapısı yok:
  `naro-backend/app/models/case.py:109-151`
- Tow create path araç sahipliğini değil sadece varlığını kontrol ediyor:
  `naro-backend/app/api/v1/routes/tow.py:144-146`
- Customer vehicle adaptörü typed media ve gelişmiş araç alanlarını taşıyamıyor:
  `naro-app/src/features/vehicles/api.ts:70-100`
- Vehicle public schema, matching-ready alanlar için çok dar:
  `naro-backend/app/schemas/vehicle.py:13-84`

## Audit Kararı

Araç ana kaydı silinmeyecek veya küçültülmeyecek.
Ama subtype-first case mimarisi için şu kural esas alınacak:

- Case açılış anında karar motorunu, fiyatı veya operasyonu etkileyen her araç
  sinyali immutable snapshot'a kopyalanmalı.
- Snapshot olmayan hiçbir araç alanı gelecekte authoritative matching input'u
  sayılmamalı.
