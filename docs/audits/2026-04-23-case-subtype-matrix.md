# 2026-04-23 Case Subtype Matrix

Bu tablo, mevcut alanların ve sinyallerin subtype-first mimaride nereye ait
olması gerektiğini karar verilebilir biçimde sınıflandırır.

`Recommended home` kolonundaki karar seti:

- `shared`
- `tow`
- `accident`
- `breakdown`
- `maintenance`
- `shared + snapshot`
- `subtype + snapshot`
- `snapshot-only`
- `remove`

## Shared Shell

| Field / Concern | Current home | Recommended home | Not |
| --- | --- | --- | --- |
| `id` | `service_cases` | `shared` | Ortak kimlik. |
| `vehicle_id` | `service_cases` | `shared` | Master vehicle bağı shared shell'de kalır. |
| `customer_user_id` | `service_cases` | `shared` | Sahiplik / görünürlük için ortak. |
| `kind` | `service_cases` | `shared` | Subtype discriminator. |
| `origin` | `service_cases` | `shared` | Customer/technician/system create kaynağı. |
| `status` | `service_cases` | `shared` | Yüksek seviye ticari/operasyonel shell durumları. |
| `preferred_technician_id` | `service_cases` | `shared` | Matching / başlangıç tercihi için ortak. |
| `assigned_technician_id` | `service_cases` | `shared` | Aktif sahiplik için ortak. |
| `title`, `subtitle`, `summary` | `service_cases` | `shared` | Liste ve üst seviye özet için kalabilir. |
| `location_label` | `service_cases` | `shared` | Tüm case türlerinde birincil lokasyon etiketi gerekiyor. |
| `created_at`, `updated_at`, `closed_at`, `deleted_at` | `service_cases` | `shared` | Audit ve görünürlük için ortak. |
| `wait_state_*` | `service_cases` | `shared` | Shell seviyesinde kullanıcı beklentisi anlatımı. |
| `billing_state` | `service_cases` | `shared` | Shell billing anchor'ı; subtype-specific settlement ayrılabilir. |
| `workflow_blueprint` | `service_cases` | `shared` | Ama subtype workflow family kararına bağlı değer setiyle. |
| `request_draft` | `service_cases` | `snapshot-only` | Immutable request trace olarak kalmalı; canonical source olmamalı. |

## Tow

| Field / Concern | Current home | Recommended home | Not |
| --- | --- | --- | --- |
| `TowCreateCaseRequest` | Ayrı route (`/tow/cases`) | `tow` | Tow zaten subtype-first create yüzeyine daha yakın. |
| `tow_mode` | `service_cases` | `tow` | Immediate / scheduled subtype alanı. |
| `tow_stage` | `service_cases` | `tow` | Shared status değil, tow lifecycle. |
| `tow_required_equipment` | `service_cases` | `tow` | Matching hard filter. |
| `incident_reason` | `service_cases` | `tow` | Tow subtype semantics. |
| `scheduled_at` | `service_cases` | `tow` | Tow booking alanı. |
| `pickup_*`, `dropoff_*` | `service_cases` | `tow` | Tow subtype routing verisi. |
| `tow_fare_quote` | `service_cases` | `tow + snapshot` | Immutable fare snapshot; settlement source'u ayrı olabilir. |
| `vehicle_drivable` | `request_draft` / tow draft | `tow + snapshot` | Dispatch ve cancellation kararında gerekli. |
| `immediate tow persisted case` | Var | `tow` | Audit kararı: ayrı dispatch session değil, persisted tow case. |

## Accident

| Field / Concern | Current home | Recommended home | Not |
| --- | --- | --- | --- |
| `counterparty_vehicle_count` | `request_draft` | `accident` | Kaza subtype alanı. |
| `counterparty_note` | `request_draft` | `accident` | Kaza taraf bilgisi. |
| `damage_area` | `request_draft` | `accident` | Matching / repair prep için subtype verisi. |
| `damage_severity` | Backend request var, FE null'luyor | `accident` | Kaza subtype alanı, JSON'da kalmamalı. |
| `report_method` | `request_draft` | `accident` | Tutanak süreci. |
| `ambulance_contacted` | `request_draft` | `accident + snapshot` | Olay bağlamı. |
| `emergency_acknowledged` | `request_draft` | `snapshot-only` | UX safety ack; operasyonel subtype truth değil. |
| `kasko_selected`, `sigorta_selected` | `request_draft` | `accident` | Insurance intent sinyali. |
| `kasko_brand`, `sigorta_brand` | `request_draft` | `accident + snapshot` | Claim başlatırken freeze edilmeli. |
| `towing_required` | `request_draft` | `remove` | Yerine linked tow case relation gelmeli. |

## Breakdown

| Field / Concern | Current home | Recommended home | Not |
| --- | --- | --- | --- |
| `breakdown_category` | `request_draft` | `breakdown` | Arıza subtype alanı. |
| `symptoms` | `request_draft` | `breakdown + snapshot` | Matching ve diagnosis için typed kalmalı. |
| `vehicle_drivable` | `request_draft` | `breakdown + snapshot` | Dispatch / on-site / valet kararında gerekli. |
| `on_site_repair` | `request_draft` | `breakdown` | Service modality sinyali. |
| `price_preference` | `request_draft` | `breakdown + snapshot` | Ranking sinyali olabilir. |
| `valet_requested` | `request_draft` | `breakdown` | Breakdown service logistics. |
| `pickup_preference` | `request_draft` | `breakdown` | On-site vs pickup iş kuralı için subtype alanı. |
| `towing_required` | `request_draft` | `remove` | Yerine linked tow case relation gelmeli. |

## Maintenance

| Field / Concern | Current home | Recommended home | Not |
| --- | --- | --- | --- |
| `maintenance_category` | `request_draft` | `maintenance` | Ana subtype discriminator. |
| `maintenance_detail` | Backend request'te var, FE toplamaz | `maintenance` | Typed subtype payload. |
| `maintenance_tier` | `request_draft` | `maintenance + snapshot` | Fiyat ve teklif bağlamı. |
| `maintenance_items` | `request_draft` | `maintenance + snapshot` | UI checklist / teklif özeti; canonical detail yerine geçmemeli. |
| `mileage_km` | `request_draft` | `shared + snapshot` | Bakım ve matching için önem taşıyabilir. |
| `preferred_window` | `request_draft` | `shared + snapshot` | Randevu/availability için ortak request sinyali. |
| `pickup_preference` | `request_draft` | `maintenance` | Dropoff/pickup/valet kararı subtype lojistiği. |
| `valet_requested` | `request_draft` | `maintenance` | Bakım lojistiği. |

## Shared Attachments ve Evidence

| Field / Concern | Current home | Recommended home | Not |
| --- | --- | --- | --- |
| `attachments[]` request snapshot | `request_draft` | `snapshot-only` | Talep anı iz bırakmalı. |
| `attachments[].asset_id` | `request_draft` + media FK | `shared + snapshot` | Canonical asset bağı korunmalı. |
| `attachments[].category` | Backend required, FE null | `subtype + snapshot` | Accident / maintenance evidence gating için kritik. |
| `media_assets.linked_case_id` | `media_assets` | `shared` | Asset-case ilişkisi için doğru; case-case relation yerine geçmez. |

## Vehicle Master ve Snapshot

| Field / Concern | Current home | Recommended home | Not |
| --- | --- | --- | --- |
| `plate`, `make`, `model`, `year`, `fuel_type` | `vehicles` | `shared + snapshot` | Case açılışında immutable kopya gerektirir. |
| `vin` | `vehicles` | `shared + snapshot` | Sahiplik / insurance bağlamında kullanılabilir. |
| `current_km` | `vehicles` | `shared + snapshot` | Bakım ve fiyat için freeze edilmesi gerekebilir. |
| `body_type`, `segment`, `drivetrain`, `gross_weight_class` | Yok | `shared + snapshot` | Matching-ready alanlar. |
| `vehicle_photo_asset_ids`, `plate_photo_asset_id` | Media policy var, vehicle schema yok | `shared + snapshot` | Doğrulama ve richer matching için. |
| `tow_points_known`, `height_or_clearance_class` | Yok | `tow + snapshot` | Tow uyumluluğu için. |

## Remove / Replace

| Current field / pattern | Replace with | Not |
| --- | --- | --- |
| `towing_required` boolean | `linked tow case relation` | UI niyet işareti olarak kalabilir ama canonical relation olmamalı. |
| `breakdown/towing -> maintenance_standard` workflow fallback | subtype workflow family | Yanlış operasyonel anlam taşıyor. |
| `request_draft` as matching source | normalized shared/subtype fields | JSON yalnızca snapshot olmalı. |
| Shared `ServiceCase.request` as tek gerçeklik | shared shell + subtype detail union | Public contract katmanı ayrılmalı. |
