# Naro Veri Modeli

Bu klasör, Naro platformunun backend veritabanı modelinin **canonical** referansıdır. Mobil tarafta (`naro-app` + `naro-service-app`) kurulan zihinsel model (vaka, süreç, havuz, randevu, hasar dosyası, provider_type vs.) burada PostgreSQL tablolarına ve state makinelerine eşleştirilir.

Her domain dosyası bağımsız okunabilir; bu README genel haritadır.

## Kavramsal özet

Naro iki taraflı bir marketplace:
- **Araç sahibi (customer)** vaka yaratır (kaza / bakım / arıza / çekici).
- Vaka **havuza** düşer → uygun **ustalar (technician)** görür → **teklif** gönderir.
- Müşteri ya teklifi seçer ya da doğrudan bir ustaya **randevu talebi** gönderir.
- Usta randevuyu **onaylar** → karşılıklı eşleşme → **süreç** başlar.
- Süreç: milestone + task + mesaj + belge + onay (parça/fatura) + ödeme.
- Tamamlanınca müşteri **yorum/puan** bırakır.

Bu akışın her düğümü bir tablo / ilişki ile temsil edilir. **Vaka** (ServiceCase) merkezdeki entity'dir; yaşam boyu tek bir kayıt — havuzdan tamamlamaya kadar.

## Domain haritası

| # | Domain | Kapsam | Faz |
|---|---|---|---|
| 00 | [İlkeler](00-ilkeler.md) | Naming, timestamps, soft delete, FK, JSONB, enum kuralları | — |
| 01 | [Identity](01-identity.md) | User, AuthSession, OtpCode, ApprovalStatus | V1 |
| 02 | [Technician](02-technician.md) | Profil, BusinessInfo, Capability, ProviderType, Certificate, Gallery | V1 |
| 03 | [Vehicle](03-vehicle.md) | Araç + müşteri-araç sahipliği | V1 |
| 04 | [Case (Vaka)](04-case.md) | ServiceCase + ServiceRequestDraft + status makinesi | V1 |
| 05 | [Offer](05-offer.md) | CaseOffer, rekabet politikası | V1 |
| 06 | [Appointment](06-appointment.md) | Randevu talepleri, slot, lifecycle | V1 |
| 07 | [Case Process](07-case-process.md) | Milestone, Task, Approval, Evidence, Thread, Message, Document | V1-V2 |
| 08 | [InsuranceClaim](08-insurance-claim.md) | Sigorta dosyası + CoverageKind + ReportMethod | V1 |
| 09 | [MediaAsset](09-media-asset.md) | Upload intent + signed URL + polymorphic owner | V2 |
| 10 | [Review + Campaign](10-review-campaign.md) | Müşteri yorum/puan, usta kampanyaları | V2 |
| 11 | [Notification](11-notification.md) | Intent + delivery (push/sms/email) | V2 |
| 12 | [Event Log](12-event-log.md) | CaseEvent — audit trail + timeline | V2 |
| 13 | [Search](13-search.md) | tsvector + pg_trgm indexler; global arama | V2 |
| 14 | [Anti-disintermediation](14-anti-disinter.md) | Maskelenmiş iletişim, thread-only policy | V2 |
| 15 | [KVKK / Retention](15-kvkk-retention.md) | Veri saklama, silme, export politikaları | V2 |
| 16 | [Technician Sinyal Modeli](16-technician-sinyal-modeli.md) | 02-technician V2 uzantısı: taxonomy master + coverage + service_area + schedule + capacity + performance snapshots | V2 |
| 17 | **Faz 10 — Tow Dispatch V1** (execution, 2026-04-22) — [KARAR-LOG §Faz 10](KARAR-LOG.md#faz-10--tow-dispatch-v1-execution-log-2026-04-22) | PostGIS + 7 tow tablo + partitioning + event-driven auto-dispatch + PSP/Mapbox + WebSocket + 4 ARQ cron. Reference: [cekici-modu-urun-spec](../cekici-modu-urun-spec.md), [cekici-backend-mimarisi](../cekici-backend-mimarisi.md), [ops/postgis-migration](../ops/postgis-migration.md) | **V1 (shipped)** |

## Genel ERD (high-level)

```mermaid
erDiagram
    USER ||--o{ USER_VEHICLE_LINK : sahiplik
    USER ||--o| TECHNICIAN_PROFILE : teknisyen
    USER ||--o{ AUTH_SESSION : oturum
    USER ||--o{ OTP_CODE : otp
    VEHICLE ||--o{ USER_VEHICLE_LINK : sahiplik
    VEHICLE ||--o{ SERVICE_CASE : ait
    SERVICE_CASE ||--o{ CASE_OFFER : teklifler
    SERVICE_CASE ||--o| APPOINTMENT : randevu
    SERVICE_CASE ||--o| INSURANCE_CLAIM : sigorta
    SERVICE_CASE ||--o{ CASE_MILESTONE : s\u00fcre\u00e7
    SERVICE_CASE ||--o{ CASE_TASK : g\u00f6revler
    SERVICE_CASE ||--o{ CASE_APPROVAL : onaylar
    SERVICE_CASE ||--o| CASE_THREAD : konu\u015fma
    CASE_THREAD ||--o{ CASE_MESSAGE : mesajlar
    SERVICE_CASE ||--o{ CASE_DOCUMENT : belgeler
    SERVICE_CASE ||--o{ CASE_EVENT : olaylar
    TECHNICIAN_PROFILE ||--o{ TECHNICIAN_CERTIFICATE : belgeler
    TECHNICIAN_PROFILE ||--o{ TECHNICIAN_GALLERY_ITEM : galeri
    TECHNICIAN_PROFILE ||--o{ CASE_OFFER : g\u00f6nderen
    TECHNICIAN_PROFILE ||--o{ TECHNICIAN_CAMPAIGN : kampanyalar
    CASE_OFFER ||--o| APPOINTMENT : ba\u011fl\u0131
    MEDIA_ASSET }o--|| USER : y\u00fckleyen
    MEDIA_ASSET ||--o{ TECHNICIAN_CERTIFICATE : belge_dosyas\u0131
    MEDIA_ASSET ||--o{ CASE_DOCUMENT : belge_dosyas\u0131
    NOTIFICATION_INTENT ||--o{ NOTIFICATION_DELIVERY : kanal
```

## Mobil ↔ Backend kaynak haritası

Mobil tarafta kurulan Zod şemaları:

- **[packages/domain/src/user.ts](../../packages/domain/src/user.ts)** → `01-identity.md` + `02-technician.md`
- **[packages/domain/src/vehicle.ts](../../packages/domain/src/vehicle.ts)** → `03-vehicle.md`
- **[packages/domain/src/service-case.ts](../../packages/domain/src/service-case.ts)** → `04-case.md`, `05-offer.md`, `06-appointment.md`, `07-case-process.md`, `08-insurance-claim.md`
- **[packages/domain/src/media.ts](../../packages/domain/src/media.ts)** → `09-media-asset.md`
- **[packages/domain/src/auth.ts](../../packages/domain/src/auth.ts)** → `01-identity.md`

Engine iş mantığı referansı: `packages/mobile-core/src/tracking/engine.ts` — `createTechnicianInsuranceCase`, `approveAppointmentForCase`, `submitOfferForCase` gibi fonksiyonlar backend `app/services/*.py` katmanına taşınır.

## Backend kod karşılıkları

| Domain dosyası | SQLAlchemy model | Pydantic schema | Alembic | Repository |
|---|---|---|---|---|
| 01-identity | `app/models/user.py` + `app/models/auth.py` | `app/schemas/auth.py` | `0002_identity.py` | `app/repositories/user.py` + `auth.py` |
| 02-technician | `app/models/technician.py` | `app/schemas/technician.py` | `0003_technician.py` | `app/repositories/technician.py` |
| 03-vehicle | `app/models/vehicle.py` | `app/schemas/vehicle.py` | `0004_vehicle.py` | `app/repositories/vehicle.py` |
| 04-case | `app/models/case.py` | `app/schemas/case.py` | `0005_case.py` | `app/repositories/case.py` |
| 05-offer + 06-appointment | `app/models/offer.py` + `app/models/appointment.py` | `app/schemas/offer.py` + `app/schemas/appointment.py` | `0006_offer_appointment.py` | `app/repositories/offer.py` + `appointment.py` |
| 07-case-process | `app/models/case_process.py` | `app/schemas/case_process.py` | `0007_case_process.py` | `app/repositories/case_process.py` |
| 08-insurance-claim | `app/models/insurance_claim.py` | `app/schemas/insurance_claim.py` | `0008_insurance_claim.py` | `app/repositories/insurance_claim.py` |
| 17-tow (Faz 10) | `app/models/tow.py` + `case.py`/`technician.py` extension | `app/schemas/tow.py` | `0017_tow_foundation.py` + `0018_tow_dispatch_tables.py` | `app/repositories/tow.py` |

Faz 10 servis katmanı: `tow_dispatch` (event-driven SQL scoring), `tow_lifecycle` (outbox pattern), `tow_payment` (PSP Protocol + dual-hold), `tow_location` (Redis Streams), `tow_evidence` (OTP). Routes: `app/api/v1/routes/tow.py` (14 REST) + `tow_ws.py` (WebSocket). ARQ workers: `app/workers/tow/`. Integrations: `app/integrations/psp/` (MockPsp V1 / Iyzico V1.1) + `app/integrations/maps/` (Mapbox / haversine).

## Okuma sırası (yeni katılan biri için)

1. **[00-ilkeler.md](00-ilkeler.md)** — kurallar ve konvansiyonlar
2. **[01-identity.md](01-identity.md)** — auth + user
3. **[04-case.md](04-case.md)** — merkez entity
4. **[05-offer.md](05-offer.md)** + **[06-appointment.md](06-appointment.md)** — eşleşme
5. **[07-case-process.md](07-case-process.md)** — iş yürütme
6. Diğerleri ihtiyaca göre
