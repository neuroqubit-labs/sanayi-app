# 2026-04-23 Live Smoke Report

Bu rapor, `2026-04-23` tarihinde temiz restart sonrası canlı smoke testlerinden
çıkan bulguları özetler.

## Ortam

- Backend:
  `uv run uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload`
- Customer app:
  `npx expo start --port 8082 --clear`
- Service app:
  `npx expo start --port 8083 --clear`

Başlangıç doğrulaması:

- `GET /api/v1/health` → `200`
- `http://localhost:8082` → `200`
- `http://localhost:8083` → `200`

## P0 Bulgular

### P0-1 Service app web surface Expo placeholder'da kalıyor

- Etki:
  Service app web üzerinden hiç smoke edilemiyor; bütün route yüzeyi gerçek
  app yerine Expo Router placeholder gösteriyor.
- Repro:
  `http://localhost:8083/`,
  `http://localhost:8083/login`,
  `http://localhost:8083/havuz`,
  `http://localhost:8083/islerim`,
  `http://localhost:8083/profil`
  hepsi aynı placeholder'ı render ediyor.
- Gözlenen çıktı:
  `Welcome to Expo / Start by creating a file in the app directory`
- Not:
  Customer app aynı stack ile gerçek ekranlarını açabiliyor; problem service
  app web surface'ine özgü görünüyor.

### P0-2 Tow immediate create `required_equipment` dolu geldiğinde `500` veriyor

- Etki:
  Ekipman bazlı eşleşme açıldığı anda tow create zinciri patlıyor.
- Repro:
  `POST /api/v1/tow/cases` içinde
  `"required_equipment":["flatbed"]`
  ile immediate tow create.
- Gözlenen hata:
  `500 Internal Server Error`
- Backend kanıtı:
  `sqlalchemy.exc.DBAPIError`
  `invalid input for query argument $5: ['flatbed'] (expected str, got list)`
- Kök neden yönü:
  `tow` candidate SQL bind tarafı `ARRAY[$5]::tow_equipment[]` ile listeyi tek
  string parametre gibi işliyor.

## P1 Bulgular

### P1-1 Customer web auth persistence / bootstrap akışı kararsız

- Etki:
  OTP verify sonrası kullanıcı bazen ana ekrana düşse bile web session kalıcı
  hale gelmiyor; login'e geri atılabiliyor.
- Repro:
  1. `POST /auth/otp/request` ile code al
  2. Customer verify ekranında kodu gir
  3. Kısa süre sonra reload veya soğuk açılış davranışını izle
- Gözlem:
  - Bir smoke turunda home ekranı açıldı.
  - Başka turda verify sonrası yine login ekranına dönüldü.
  - Browser storage kontrolünde `localStorage` boş geldi.
  - Console'da tekrar eden `401` ve
    `refreshAuthToken failed; logging out Error: refresh failed 401`
    görüldü.
- Sonuç:
  Web auth zincirinde persistence veya bootstrap race ihtimali yüksek.

### P1-2 Customer login sayfası unauth durumda hemen `401` üreten query'ler başlatıyor

- Etki:
  Login ekranında bile arka planda gereksiz yetkili query'ler atılıyor; auth
  akışını kirletiyor ve console noise üretiyor.
- Gözlem:
  Login yüklenirken backend logunda:
  `GET /api/v1/vehicles/me` → `401`
  `GET /api/v1/cases/me` → `401`
- Not:
  Bu tek başına blocker değil ama auth bootstrap sorununu ağırlaştırıyor.

## P2 Bulgular

### P2-1 Vehicle CRUD canlıda çalışıyor

- `POST /api/v1/vehicles` başarıyla araç oluşturdu.
- `GET /api/v1/vehicles/me` ve `GET /vehicles/{id}/dossier` başarıyla döndü.

Örnek oluşturulan araç:

- `vehicle_id = 556092ee-4ad9-47a1-b75c-da5b889446e7`
- `plate = 34SMOKE426`

### P2-2 Vehicle fuel enum backend'te strict

- Gözlem:
  `fuel_type="gasoline"` → `422`
  `fuel_type="petrol"` → `201`
- Not:
  Customer app mapping'i zaten `petrol` kullanıyor; bu daha çok canonical
  contract notu.

### P2-3 Breakdown create + duplicate guard canlıda çalışıyor

- `POST /api/v1/cases` ile `breakdown` vakası oluşturuldu:
  `case_id = a2a3d809-2e31-40a2-b2a8-cb4c3bde9b7c`
- Aynı araç için ikinci açık `breakdown` create denemesi:
  `409 duplicate_open_case`

### P2-4 Linked tow child relation çalışıyor

- `POST /api/v1/tow/cases` çağrısında
  `parent_case_id = breakdown case`
  ile child tow açılabildi.
- Parent breakdown detail içinde
  `linked_tow_case_ids = ["19405206-930d-4e5d-b100-3c42d4c4bb93"]`
  döndü.

### P2-5 Tow fallback ve cancel akışı temel seviyede çalışıyor

- `required_equipment=[]` ile immediate tow create:
  `201`, stage `timeout_converted_to_pool`
- Ardından `POST /tow/cases/{id}/cancel`:
  `200`, `cancellation_fee = 0`
- Sonraki `GET /tow/cases/{id}`:
  `stage = cancelled`, `status = cancelled`

## Validation Notları

Bu maddeler doğrudan bug olmak zorunda değil; canlı contract davranışını
kanıtlar:

- `maintenance_detail.filters` için backend bool değil liste bekliyor.
- `maintenance` + `periodic` için `mileage_photo` attachment category zorunlu.

## Bu Turun Net Sonucu

- `customer app`: kısmen test edilebilir, auth zinciri kararsız
- `service app web`: şu an test edilemez, placeholder kırığı var
- `backend core CRUD`: vehicle ve generic breakdown create çalışıyor
- `tow backend`: equipment filtresi açılınca kritik `500` veriyor

## Sonraki En Mantıklı Patch Sırası

1. Service app web route/entry kırığını düzelt
2. Customer web auth persistence ve login ekranındaki unauthorized query'leri düzelt
3. Tow dispatch SQL array bind bug'ını düzelt
4. Sonra aynı smoke setini tekrar koş
