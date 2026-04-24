# 2026-04-23 Matching Decision Table

Bu tablo, mevcut sistemde hangi sinyalin gerçekten karar verdiğini ve hangisinin
yalnızca toplanıp kullanılmadığını özetler.

## Tow Immediate Dispatch

| Sinyal | Mevcut rol | Kaynak | Not |
| --- | --- | --- | --- |
| `provider_type=cekici` | Hard filter | Backend | `repositories/tow.py:166` |
| `availability=available` | Hard filter | Backend | `repositories/tow.py:167` |
| `deleted_at is null` | Hard filter | Backend | `repositories/tow.py:168` |
| `last_known_location` + freshness | Hard filter | Backend | `repositories/tow.py:169-171` |
| `current_offer_case_id is null` | Hard filter | Backend | `repositories/tow.py:172` |
| Radius / `ST_DWithin` | Hard filter | Backend | `repositories/tow.py:173-177` |
| `required_equipment` | Hard filter, opsiyonel | Backend | Table write path eksik |
| Proximity | Soft score | Backend | `repositories/tow.py:153-161` |
| `evidence_discipline_score` | Soft score | Backend | `repositories/tow.py:162` |
| Fairness | Placeholder | Backend | Sabit `0.15 * 1.0` |
| `service_area`, `district` | Kullanılmıyor | Veri modeli var | Dispatch'e bağlı değil |
| `capacity`, `queue_depth` | Kullanılmıyor | Veri modeli var | Over-assignment riski |
| `schedule`, `night/weekend/emergency` | Kullanılmıyor | Veri modeli var | Wrong-time dispatch riski |
| `active_provider_type` | Kullanılmıyor | Veri modeli var | Rol geçişi dikkate alınmıyor |
| Vehicle class / weight | Kullanılamıyor | Şema yok | Ağır araç ayrımı yok |

## Generic Pool Feed / Offer Discovery

| Sinyal | Mevcut rol | Kaynak | Not |
| --- | --- | --- | --- |
| `kind -> provider_type` | Hard filter | Backend | `case.py:83-89` |
| `status in matching/offers_ready` | Hard filter | Backend | `case.py:87` |
| `assigned_technician_id is null` | Hard filter | Backend | `case.py:90` |
| `coverage domains/procedures` | Kullanılmıyor | Service app + backend | Copy var, query yok |
| `brand_coverage` | Kullanılmıyor | Service app + backend | Query yok |
| `drivetrain_coverage` | Kullanılmıyor | Service app + backend | Query yok |
| `service_area/city/district` | Kullanılmıyor | Service app + backend | Şehir bazlı matching gerçekte yok |
| `schedule/capacity` | Kullanılmıyor | Service app + backend | Havuz görünürlüğünü etkilemiyor |
| Ranking | Yok | Backend | Tarihe göre sıralama var |

## Customer Tow Compose

| Sinyal | Mevcut rol | Kaynak | Not |
| --- | --- | --- | --- |
| Pickup koordinatı | Demo/local | Customer app | Varsayılan sabit |
| Dropoff koordinatı | Boş | Customer app | `null` geçiliyor |
| `incident_reason` | Hardcoded | Customer app | Her zaman `not_running` |
| `required_equipment` | Hardcoded | Customer app | Her zaman `flatbed` |
| `attachments` | Boş | Customer app | Görsel kanıt taşınmıyor |
| Fare quote | Local | Customer app | Store içinde hesaplanıyor |
| Dispatch | Local | Customer app | `useTowStore` |

## Request Normalization

| Sinyal | Mevcut rol | Storage | Not |
| --- | --- | --- | --- |
| `vehicle_drivable` | Sadece JSONB | `request_draft` | SQL selection'a çıkmıyor |
| `damage_severity` | Sadece JSONB | `request_draft` | Hasar bazlı routing yok |
| `symptoms` | Sadece JSONB | `request_draft` | Breakdown triage yok |
| `price_preference` | Sadece JSONB | `request_draft` | Ranking'e bağlı değil |
| Attachment category | Sadece event/snapshot | Media + draft | Matching'e bağlı değil |
| Pickup/dropoff lat/lng | Normalize | Top-level | Tow için kullanılabiliyor |
| `preferred_technician_id` | Normalize | Top-level | Fast-track için hazır |

## Karar Özeti

- Bugün gerçek hard filter'lar çok az: provider type, live location, radius,
  availability ve bazı durumlarda equipment.
- Ranking neredeyse yok; proximity ağırlıklı tek boyutlu.
- Üründe toplanan veya backend'te tanımlanan çok sayıda sinyal selection motoru
  açısından "ölü veri" konumunda.
