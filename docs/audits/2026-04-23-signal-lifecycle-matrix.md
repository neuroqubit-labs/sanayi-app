# 2026-04-23 Signal Lifecycle Matrix

Bu matris, matching kararını etkileyebilecek ana sinyallerin müşteri girişi,
servis girişi, backend schema, storage ve algoritma kullanımı boyunca nerede
kırıldığını gösterir.

| Sinyal | Ürün niyeti | Customer input | Service input | Backend schema / DB | Queryable | Filter use | Ranking use | Live parity | Risk |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `provider_type` | Ana eligibility | Yok | Var | `technician_profiles.provider_type` | Evet | Evet | Hayır | Canlı | Düşük |
| `active_provider_type` | O anki aktif rol | Yok | Kısmen var | `technician_profiles.active_provider_type` | Evet | Hayır | Hayır | BE only | Yüksek |
| `service_domains` | Non-tow uzmanlık filtresi | Yok | Var, canlı | Coverage API + signal tables | Evet | Hayır | Hayır | Yarım canlı | Yüksek |
| `procedures` | İşlem bazlı uygunluk | Yok | Var, canlı | Coverage API + signal tables | Evet | Hayır | Hayır | Yarım canlı | Yüksek |
| `brand_coverage` | Marka eşleşmesi | Dolaylı | Var, canlı | Coverage API + signal tables | Evet | Hayır | Hayır | Yarım canlı | Orta |
| `drivetrain_coverage` | Motor tipi uyumluluğu | Kısmen | Var, canlı | Coverage API + signal tables | Evet | Hayır | Hayır | Yarım canlı | Orta |
| `service_area.city_code` | Şehir bazlı havuz | Yok | Store + BE endpoint var | `technician_service_area.city_code` | Evet | Hayır | Hayır | Store ağırlıklı | Yüksek |
| `working_districts` | İlçe kapsama | Yok | Store + BE endpoint var | `technician_working_districts` | Evet | Hayır | Hayır | Store ağırlıklı | Yüksek |
| `last_known_location` | Canlı tow dispatch | Yok | Canlı-ish | `technician_profiles.last_known_location` | Evet | Evet | Evet | Route parity sorunlu | Orta |
| `tow_equipment` | Çekici uyumluluğu | Customer tarafı hardcoded | Demo store | `technician_tow_equipment` | Evet | Evet | Hayır | Write path eksik | Çok yüksek |
| `max_concurrent_jobs` | Aşırı atamayı önleme | Yok | Store + BE endpoint var | `technician_capacity.max_concurrent_jobs` | Evet | Hayır | Hayır | Store ağırlıklı | Çok yüksek |
| `current_queue_depth` | Anlık workload | Yok | Yok | `technician_capacity.current_queue_depth` | Evet | Hayır | Hayır | BE only | Çok yüksek |
| `night/weekend/emergency_service` | Zaman uygunluğu | Urgency var | Store + BE endpoint var | `technician_capacity.*` | Evet | Hayır | Hayır | Store ağırlıklı | Yüksek |
| `working_schedule` | Slot/mesai uygunluğu | Preferred window var | Store + BE endpoint var | `technician_working_schedule` | Evet | Hayır | Hayır | Store ağırlıklı | Yüksek |
| `vehicle body/class` | Araç uyumluluğu | Yok | Yok | Yok | Hayır | Hayır | Hayır | Hiç yok | Çok yüksek |
| `gross_weight_class` | Heavy-duty ayrımı | Yok | Yok | Yok | Hayır | Hayır | Hayır | Hiç yok | Çok yüksek |
| `drivetrain` | Teknik uygunluk | UI'da dolaylı | Coverage tarafında dolaylı | Vehicle tarafında yok | Hayır | Hayır | Hayır | Parçalı | Yüksek |
| `vehicle_drivable` | Tow tipi / yol yardım ayrımı | Var | Yok | `request_draft` içinde | JSONB only | Hayır | Hayır | Customer non-tow canlı, tow local | Yüksek |
| `incident_reason` | Tow triage | Tow UI'da hardcoded | Demo store | Top-level tow kolonu + JSONB | Evet | Kısmen | Hayır | Customer live değil | Yüksek |
| `damage_severity` | Hasar/çekici ihtiyacı | Var | Yok | `request_draft` içinde | JSONB only | Hayır | Hayır | Kısmen canlı | Orta |
| `attachments / media_asset_ids` | Kanıt ve triage | Case flow'da var, tow'da boş | Kısmen demo | `media_assets` + link | Evet | Hayır | Dolaylı | Tow canlı değil | Orta |
| `vehicle_photo` | Araç görseli | Yok | Yok | Media policy var | Kısmen | Hayır | Hayır | Wire-up yok | Yüksek |
| `vehicle_license_photo` | Ruhsat doğrulama | Yok | Yok | Media policy var | Kısmen | Hayır | Hayır | Wire-up yok | Orta |
| `preferred_technician_id` | Fast-track / tercih | Var | Yok | Top-level kolon | Evet | Kısmen | Hayır | Canlı | Düşük |

## Okuma Notları

- `Canlı` = UI -> backend contract -> DB hattı çalışıyor.
- `Yarım canlı` = veri backend'e yazılıyor ama karar motoru kullanmıyor.
- `Store ağırlıklı` = UI topluyor ama service app/customer app local state'te
  kalma riski yüksek.
- `JSONB only` = veri persistence var ama query-first matching için normalize
  edilmemiş.

## En Kritik Kırıklar

- `tow_equipment` canlıda güvenilir source-of-truth değil.
- `service_area`, `working_districts`, `capacity`, `schedule` toplanıyor ama
  selection'a girmiyor.
- `vehicle body/class` ve benzeri matchability alanları hiç tanımlı değil.
- Tow customer girişinde gerçek payload yerine hardcoded/store verisi kullanılıyor.
