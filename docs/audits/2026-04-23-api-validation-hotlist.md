# 2026-04-23 API Validation Hotlist

Bu liste, doğrudan `422`, parse error veya kesin contract drift üreten
yüksek öncelikli kırıkları toplar.

## P0-1 Appointments create payload drift

- Tür: `request validation`
- Kanıt:
  `naro-app/src/features/appointments/schemas.ts`
  `naro-backend/app/api/v1/routes/appointments.py`
- Sorun:
  Frontend body:
  `case_id`, `technician_id`, `offer_id`, `slot`, `note`, `expires_at`, `source`
  Backend body:
  `case_id`, `technician_id`, `slot`, `note`
  ve `extra="forbid"`.
- Etki:
  `offer_id`, `expires_at`, `source` gönderildiğinde backend 422 dönebilir.
- Düzeltme:
  Customer schema canonical backend request'e indirgenmeli veya backend bu
  alanları bilinçli biçimde kabul etmeli.

## P0-2 Offers response parse drift

- Tür: `response validation`
- Kanıt:
  `naro-app/src/features/offers/schemas.ts`
  `naro-backend/app/api/v1/routes/offers.py`
- Sorun:
  Frontend response zorunlu alanlar bekliyor:
  `submitted_at`, `accepted_at`, `rejected_at`, `expires_at`,
  `created_at`, `updated_at`.
  Backend response modeli bunları dönmüyor.
- Etki:
  `OfferResponseSchema.parse` runtime'da kırılabilir.
- Düzeltme:
  Ya frontend schema backend'e indirgenmeli ya da backend response genişletilmeli.

## P0-3 Billing refund schema drift

- Tür: `response validation`
- Kanıt:
  `naro-app/src/features/billing/schemas.ts`
  `naro-backend/app/schemas/billing.py`
- Sorun:
  Frontend `RefundOutSchema` `case_id` bekliyor.
  Backend `RefundOut` `case_id` döndürmüyor.
- Etki:
  Billing summary parse'ı refund listesi geldiğinde kırılabilir.
- Düzeltme:
  Frontend schema canonical backend response'a hizalanmalı.

## P0-4 Approvals create request drift

- Tür: `request validation`
- Kanıt:
  `naro-app/src/features/approvals/schemas.ts`
  `naro-backend/app/api/v1/routes/approvals.py`
- Sorun:
  Backend `ApprovalRequestPayload` için `title` zorunlu.
  Frontend create schema'da `title` yok.
- Etki:
  Service app approval-create wire-up bu schema ile yapılırsa 422 üretir.
- Düzeltme:
  Create payload canonical backend alanlarına hizalanmalı.

## P1-1 Cases class live/mock split

- Tür: `parity drift`
- Kanıt:
  `naro-app/src/features/cases/api.ts`
- Sorun:
  Aynı feature içinde bazı hook'lar live backend, bazıları store/mock.
- Etki:
  UI bir ekranda canonical response, diğer ekranda fixture/store response okur.
- Düzeltme:
  Sınıf bazında tek data source seçilmeli.

## P1-2 Service app jobs/appointments/offers mock-only

- Tür: `class drift`
- Kanıt:
  `naro-service-app/src/features/jobs/api.ts`
- Sorun:
  Backend route'lar var ama client aksiyonları store üstünde çalışıyor.
- Etki:
  Service app ekibi gerçek API davranışını görmeden geliştirme yapıyor.
- Düzeltme:
  Jobs class için live API katmanı açılmalı.

## P1-3 Onboarding service-area/schedule/capacity missing clients

- Tür: `endpoint reachability`
- Kanıt:
  `naro-backend/app/api/v1/routes/technicians.py`
  `naro-service-app/src/features/onboarding/`
- Sorun:
  Backend endpoint var, service app mutation yok.
- Etki:
  Feature tamamlanmış görünse de veri backend'e hiç gitmiyor.
- Düzeltme:
  Service app'te üç mutation sınıfı eklenmeli.
