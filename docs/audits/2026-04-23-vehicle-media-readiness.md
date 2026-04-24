# 2026-04-23 Vehicle & Media Readiness

## Özet

Vehicle CRUD bugün daha çok "araç kartı" seviyesinde. Matching, triage ve tow
uyumluluğu için kritik alanlar tanımlı değil. Media altyapısı araç görseli ve
ruhsat görselini destekleyebilecek noktada, fakat vehicle contract ve customer
UI buna bağlanmamış.

## Vehicle Durumu

### Persist edilen alanlar

- `plate`, `make`, `model`, `year`
- `color`, `fuel_type`, `vin`, `current_km`, `note`
- lifecycle/reminder alanları
- history consent

Kaynak:

- `naro-backend/app/models/vehicle.py:44-87`
- `naro-backend/app/schemas/vehicle.py:13-84`

### UI'da toplanıp payload'da düşen alanlar

| Alan | UI | API payload | DB | Not |
| --- | --- | --- | --- | --- |
| `transmission` | Var | Yok | Yok | `VehicleAddScreen.tsx:73-75`, `vehicles/api.ts:34-45` |
| `engine` | Var | Yok | Yok | `VehicleAddScreen.tsx:78`, `:138` |
| `chronicNotes` | Var | Yok | Yok | `VehicleAddScreen.tsx:77`, `:140-143` |
| `tabThumbnailUri` | UI beklentisi var | Yok | Yok | `vehicles/api.ts:77` her zaman `undefined` |

### Hiç tanımlı olmayan matchability alanları

- `body_type`
- `vehicle_segment`
- `gross_weight_class`
- `height_or_clearance_class`
- `tow_points_known`
- `drivetrain` source-of-truth
- `plate_photo_asset_id`
- `vehicle_photo_asset_ids`

Bu alanların hiçbiri vehicle modelinde, schema'da veya route sözleşmesinde yok.

## Media Durumu

### Backend'te hazır olanlar

- `vehicle_photo`
- `vehicle_license_photo`
- generic upload intent/complete akışı

Kaynak:

- `naro-backend/app/services/media_policy.py:105-126`
- `naro-backend/app/api/v1/routes/media.py:22-70`

### Vehicle yüzeyine bağlanmamış olanlar

- Vehicle response içinde asset id veya URL alanı yok.
- Vehicle add/edit ekranında attachment picker yok.
- Customer app'te `useAttachmentPicker` sadece case flow'larında kullanılıyor.

Kaynak:

- `naro-backend/app/schemas/vehicle.py:57-84`
- `naro-app/src/features/vehicles/screens/VehicleAddScreen.tsx:63-340`
- `naro-app/src/shared/attachments/useAttachmentPicker.ts`
- `rg` sonucu: vehicle screens altında `useAttachmentPicker` kullanımı yok

## Matching Etkisi

### Doğrudan etkiler

- Heavy-duty / standart çekici ayrımı yapılamaz.
- Flatbed gerekip gerekmediği güvenilir biçimde türetilemez.
- Görsel doğrulama veya hasar ön-triajı araç profile bağlı ilerleyemez.
- Aynı araç için geçmiş sorun kalıpları veya kronik notlar algoritmaya girmez.

### Dolaylı etkiler

- Customer, daha zengin veri girdiğini sanır ama persistence bunu taşımaz.
- Gelecekteki ranking modeli, araç uyumluluğu için ayrı event veya manuel not
  bağımlılığına mahkum kalır.

## Hazırlık Sonucu

| Alan grubu | Hazırlık seviyesi | Değerlendirme |
| --- | --- | --- |
| Temel araç kimliği | Hazır | CRUD yeterli |
| Lifecycle/reminder | Hazır | Matching için ikincil |
| Matchability | Hazır değil | Şema boşluğu |
| Vehicle media | Altyapı hazır, ürün hazır değil | Wire-up eksik |
| UI -> API veri bütünlüğü | Zayıf | Birden fazla alan sessizce düşüyor |

## Karar

Vehicle alanı algoritma v2 için bugünün haliyle yeterli değil. Önce "hangi
araç sinyallerini gerçekten product-level source-of-truth yapacağız?" kararı
verilmeli; sonra vehicle contract ve media wire-up buna göre genişletilmeli.
