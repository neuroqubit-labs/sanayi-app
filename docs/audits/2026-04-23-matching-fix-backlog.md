# 2026-04-23 Matching Fix Backlog

Bu backlog audit bulgularını doğrudan uygulanabilir iş listesine çevirir.

## Hemen Düzelt

### 1. Customer tow compose'u canlı backend create path'ine bağla

- Tür: `mock kaldır`, `frontend collect et`
- Sahip: Customer app
- Neden: Mevcut tow giriş noktası gerçek matching verisi üretmiyor.
- Acceptance:
  `POST /tow/cases` gerçekten çağrılıyor.
  Pickup/dropoff, incident reason, required equipment ve attachments canlı
  payload'ta görünüyor.

### 2. Tow equipment için canlı write path tanımla

- Tür: `schema ekle`, `contract adapt`
- Sahip: Backend + Service app
- Neden: Dispatch SQL yazılamayan tabloya güveniyor.
- Acceptance:
  Teknisten tarafında equipment CRUD var.
  `technician_tow_equipment` populate ediliyor.
  Immediate dispatch filter gerçek veriyle çalışıyor.

### 3. Pool ve dispatch query'lerine capacity ve schedule guard ekle

- Tür: `dispatch query değiştir`
- Sahip: Backend
- Neden: Aynı teknisyen yanlış zamanda veya fazla iş yüküyle seçilebilir.
- Acceptance:
  `max_concurrent_jobs/current_queue_depth` ve mesai uygunluğu selection'da
  filter veya reject nedeni olarak işliyor.

### 4. Service app service-area/schedule/capacity write path'lerini canlıya bağla

- Tür: `frontend collect et`, `contract adapt`
- Sahip: Service app
- Neden: Mevcut veri store'da kalıyor.
- Acceptance:
  `/technicians/me/service-area`, `/schedule`, `/capacity` çağrıları canlı.

## Launch Öncesi

### 5. Vehicle contract'a matchability alanları ekle

- Tür: `schema ekle`
- Sahip: Backend + Customer app
- İlk aday alanlar:
  `body_type`, `vehicle_segment`, `gross_weight_class`,
  `height_or_clearance_class`, `tow_points_known`
- Acceptance:
  Create/update/read contract'larında alanlar mevcut ve kalıcı.

### 6. Vehicle add/edit UI'da toplanan ama düşen alanları hizala

- Tür: `contract adapt`
- Sahip: Customer app + Backend
- Neden: `transmission`, `engine`, `chronicNotes` bugün sessizce kayboluyor.
- Acceptance:
  UI -> API -> DB zinciri kayıpsız.

### 7. Vehicle media wire-up

- Tür: `media wire-up yap`
- Sahip: Customer app + Backend
- Neden: Vehicle photo altyapısı hazır ama ürün yüzeyinde yok.
- Acceptance:
  Vehicle foto ve ruhsat foto upload edilebiliyor.
  Vehicle response thumbnail/asset alanı dönüyor.

### 8. Request normalization katmanını genişlet

- Tür: `normalizasyon yap`
- Sahip: Backend
- İlk adaylar:
  `vehicle_drivable`, `damage_severity`, `garage_or_basement`,
  `pickup_constraints`, `counterparty_vehicle_count`
- Acceptance:
  Matching-critical alanlar JSONB'de kilitli kalmıyor.

## Algoritma V2

### 9. Multi-signal ranking tasarla

- Tür: `dispatch query değiştir`
- Sahip: Backend + Data/Product
- İçerik:
  proximity + workload + schedule fit + service fit + evidence score +
  fairness + vehicle compatibility

### 10. Generic pool feed'i provider type ötesine taşı

- Tür: `dispatch query değiştir`
- Sahip: Backend
- Neden: Bugünkü pool feed şehir/kapsama/uzmanlık farkını görmüyor.
- Acceptance:
  Feed eligibility en azından city/district + coverage + capacity içeriyor.

### 11. Shared domain kontratlarını zenginleştir

- Tür: `schema ekle`
- Sahip: Packages + mobile clients
- Neden: `TowRequest.required_equipment` tekil enum; ortak `Vehicle` tipi çok dar.

## Ürün Kararı Gerekli

### 12. `required_equipment` kullanıcı seçimi mi, sistem türetimi mi olacak?

- Tür: `ürün kararı gerekli`
- Sahip: Product + Backend + Customer app
- Karar sonucu:
  Tekil seçim mi, çoklu gereksinim mi, yoksa inferred recommendation mı?

### 13. Service area mı live location mı öncelikli?

- Tür: `ürün kararı gerekli`
- Sahip: Product + Backend
- Karar sonucu:
  Tow immediate dispatch'te canlı GPS mi baskın, yoksa declared service area
  dışındaki adaylar tamamen dışlanacak mı?

### 14. Vehicle photo matching'de zorunlu mu, opsiyonel mi?

- Tür: `ürün kararı gerekli`
- Sahip: Product + Customer app
- Karar sonucu:
  Tow triage ve accident/breakdown compose'da görsel zorunluluk seviyeleri netleşecek.

## Önerilen Uygulama Sırası

1. Tow customer create path'i canlıya al.
2. Service app service-area/capacity/schedule write path'lerini bağla.
3. Tow equipment source-of-truth ve CRUD kararını tamamla.
4. Dispatch ve pool query'lerini mevcut sinyallerle hizala.
5. Vehicle matchability + media contract genişlemesini başlat.
