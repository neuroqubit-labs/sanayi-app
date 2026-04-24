# 2026-04-23 API Fix Backlog

## Hemen Düzelt

### 1. `appointments` request contract'ını tekilleştir

- Sahip: Customer app + Backend
- Düzeltme yönü:
  `AppointmentRequestPayloadSchema` backend `AppointmentRequest` ile birebir
  hizalanmalı.
- Beklenen çıktı:
  `POST /appointments` 422 üretmeden çalışmalı.

### 2. `offers` response contract'ını hizala

- Sahip: Customer app + Backend
- Düzeltme yönü:
  Ya frontend schema backend response'a daraltılmalı ya da backend response
  genişletilmeli.
- Beklenen çıktı:
  `GET /offers/case/{id}` ve action response'ları parse edilmeli.

### 3. `billing` refund schema'sını düzelt

- Sahip: Customer app
- Düzeltme yönü:
  `RefundOutSchema` içinden canonical olmayan `case_id` kaldırılmalı veya
  backend'e eklenmeli.

### 4. `approvals` create payload'ını canonical hale getir

- Sahip: Service app + Customer/shared schemas + Backend
- Düzeltme yönü:
  `title`, `description`, `amount`, `currency`, `service_comment`, `line_items`
  şeklinde tek create payload kararı alınmalı.

## Launch Öncesi

### 5. Cases sınıfında live/store çiftliğini bitir

- Sahip: Customer app
- Öncelik:
  `detail`, `thread`, `offers`, `appointments`, `messages`, `mark seen`

### 6. Service app jobs sınıfını canonical route'lara taşı

- Sahip: Service app + Backend
- Öncelik:
  pool feed, offer submit, appointment approve/decline, job detail

### 7. Onboarding write sınıflarını tamamla

- Sahip: Service app
- Eksikler:
  `service-area`, `schedule`, `capacity`

### 8. Tow sınıfını gerçek API giriş noktası yap

- Sahip: Customer app + Service app + Backend
- Neden:
  Route parity tek başına yetmiyor; ürün akışı hâlâ store tabanlı.

## Sonraki Sprint

### 9. Sınıf bazlı canonical ownership tanımla

- Backend route/schema
- Shared domain schema
- Feature-local zod

Her sınıf için hangisinin source-of-truth olduğu yazılı hale getirilmeli.

### 10. Contract parity testleri ekle

- Route existence smoke
- Request schema parity
- Response schema parity
- `apiClient + zod parse` golden tests

## Çalışma Kuralı Önerisi

Yeni endpoint veya schema değişikliğinde şu sıra zorunlu olmalı:

1. Backend route + Pydantic
2. Shared/domain schema
3. Customer/service wrapper
4. Parse smoke testi
5. Mock/store kaldırma kararı
