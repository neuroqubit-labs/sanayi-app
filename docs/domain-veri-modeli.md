# Naro — Domain Veri Modeli & İlişkisel Mimari

> **Bu doküman Naro müşteri-app'inde mock-first kurduğumuz domain'in tek referans çıktısıdır.**
> Usta uygulamasına ve backend'e geçmeden önce (1) kavramsal modeli sabitlemek, (2) ilişkisel veritabanı şemasını türetmek, (3) iki taraflı senaryolarda bozulmayacak domain invariantlarını listelemek için.
>
> Müşteri-app tüm entity'leri Zod ile tipledi; bu doküman o Zod şemalarını aktör, durum makinesi ve PostgreSQL DDL düzeyine taşır.

---

## İçindekiler

1. [Tasarım İlkeleri](#1-tasarım-i̇lkeleri)
2. [Aktörler](#2-aktörler)
3. [Kavramsal Model](#3-kavramsal-model)
4. [Enum Kataloğu](#4-enum-kataloğu)
5. [Entity Kataloğu](#5-entity-kataloğu)
6. [Durum Makineleri](#6-durum-makineleri)
7. [Kritik İş Akışları](#7-kritik-i̇ş-akışları)
8. [Domain Invariantları](#8-domain-invariantları)
9. [Anti-abuse Kuralları](#9-anti-abuse-kuralları)
10. [İlişkisel Veritabanı Taslağı](#10-i̇lişkisel-veritabanı-taslağı-postgresql)
11. [İndeks ve Kısıt Önerileri](#11-i̇ndeks-ve-kısıt-önerileri)
12. [Kapsam Dışı / Açık Sorular](#12-kapsam-dışı--açık-sorular)
13. [Sonraki Adımlar](#13-sonraki-adımlar)

---

## 1. Tasarım İlkeleri

- **Tek merkezi entity: `service_cases`.** Bir aracın bir talebinin tüm yaşamı (teklifler, randevu, mesajlar, onaylar, dosyalar, olay kaydı) bu case'e bağlıdır. Case yoksa teklif de randevu da olamaz.
- **İki taraflı onay zorunlu.** Müşteri randevu talep eder → usta onaylar → süreç başlar. Tek taraflı `selectOffer → scheduled` commit kaldırıldı. Fiyat `CaseOffer`'dan, zaman `Appointment`'tan gelir.
- **Ekonomik commit için iki entity.** `CaseOffer` = **bağlayıcı fiyat** (usta verdikten sonra kilitli). `Appointment` = **onay kapısı** (müsaitlik, slot, TTL). İki entity birbirine FK ile bağlı.
- **Append-only audit.** `case_events` zaman çizgisidir — hiçbir zaman silinmez, düzeltilmez. `case_messages` de aynı mantıkla.
- **Workflow derivatif.** `case_milestones`, `case_tasks`, `case_evidence_feed` şu an `tracking/engine.ts` üzerinden hesaplanıyor. Bunlar ileride persist edilebilir (cache + snapshot) ama primary truth değil — `service_cases.status` + `case_offers.status` + `appointments.status` üçlüsünden türetilir.
- **Müşteri-özel state'ler persist.** Favoriler, cooldown sayacı, bildirim tercihleri şu an client Zustand'da; backend'de her biri kullanıcıya bağlı tablolara düşecek.
- **Mock-first uyum.** Şu anki TS tipleri (`packages/domain/src/service-case.ts`) ve store metodları (`naro-app/src/features/cases/store.ts`) bu dokümandaki modelin mock yansımasıdır — şema farklılığı çıkmamalı.

---

## 2. Aktörler

| Aktör | Açıklama | Domain karşılığı |
|---|---|---|
| **customer** | Araç sahibi. Talep açar, teklif seçer, randevu ister, onay verir, iptal eder. | `users.role = 'customer'` |
| **technician** | Usta / servis sağlayıcı. Teklif verir, randevu onaylar, ilerleme paylaşır, parça/fatura onayı talep eder. | `users.role = 'technician'` |
| **system** | Platform otomasyonları (matching, TTL expire, notification intent build, wait_state hesabı). | Event'lerin `actor = 'system'` olarak düşmesi |
| **admin** | KYC, ihtilaf, destek. v1'de ayrı model yok, sadece `users.role = 'admin'`. | İleri faz |

`CaseActor` enum = `{customer, technician, system}`. Event sahipleri, task sorumluları, wait_state'i kimin bloke ettiği bu enum'la işaretlenir.

`CaseWaitActor` = `CaseActor ∪ {none}` — vaka kapandığında kimse beklemiyor demek.

---

## 3. Kavramsal Model

```
              ┌─────────┐
              │  User   │───────────┐
              └────┬────┘           │
                   │ 1              │ 1
                   │                │
         N (owns)  │                │ N (favorites, cooldown, prefs)
                   ▼                │
            ┌──────────┐            │
            │ Vehicle  │────N──┐    │
            └────┬─────┘       │    │
                 │ 1           │    │
           N (reminders,        │    │
              warranties,       │    │
              memory events)    │    │
                 │              │    │
                 │              ▼    ▼
                 │      ┌────────────────────┐
                 └──N──▶│    ServiceCase     │◀──── N (offers)  ─┐
                        │                    │                    │
                        │ 1:1 embedded draft │                    │
                        │ 0..1 appointment   │◀── N (offers) ────┤
                        │ 1:1 thread         │                    ▼
                        │ N attachments      │             ┌──────────────┐
                        │ N documents        │             │ Technician   │
                        │ N events           │◀─── N ──────│              │
                        │ N approvals        │  (assigned, │  availability│
                        │ N milestones/tasks │   preferred)│  categories  │
                        └────────────────────┘             │  profile     │
                                 │                          └──────────────┘
                                 │ 1
                                 │
                                 │ N
                                 ▼
                        ┌────────────────┐
                        │   Case Thread  │───N──▶ case_messages
                        └────────────────┘               │
                                                         │ N
                                                         ▼
                                                   case_message_attachments
```

Anahtar ilişkiler:

- **User 1-N Vehicle** — bir kullanıcının birden çok aracı olabilir; aktif araç client'ta tutulur.
- **Vehicle 1-N ServiceCase** — bir araca birden fazla vaka düşebilir (zamanla); ancak aynı anda **en fazla 1 aktif vaka** önerilir (domain kuralı, aşağıda).
- **ServiceCase 0..1 Appointment** — bir vakada **aynı anda 1 aktif randevu talebi** olabilir; geçmiş randevular kalır ama status final'dir (`approved`/`declined`/`expired`/`cancelled`).
- **ServiceCase N CaseOffer** — matching tarafında birden çok teklif gelir; en fazla 1 tanesi `accepted` olabilir.
- **CaseOffer 1-N Technician** — her offer bir usta tarafından verilir.
- **ServiceCase N assigned/preferred Technician** — `assigned_technician_id` (usta onayladıktan sonra kilitlenen), `preferred_technician_id` (shortlist/seçim öncesi).
- **ServiceCase 1-1 CaseThread** — her case'in tek bir mesajlaşma thread'i var; müşteri-usta-sistem üç aktör aynı thread'de.
- **ServiceCase N CaseApproval** — parça, fatura, tamamlama onayları döngüsel olarak açılıp kapanır.

---

## 4. Enum Kataloğu

Tüm enum'lar tek tablo (DB'de PostgreSQL ENUM type veya `VARCHAR + CHECK`):

| Enum | Değerler | Kullanım |
|---|---|---|
| `user_role` | `customer`, `technician`, `admin` | `users.role` |
| `user_status` | `pending`, `active`, `suspended` | `users.status` (technician için KYC) |
| `service_request_kind` | `accident`, `towing`, `breakdown`, `maintenance` | `service_cases.kind` + composer |
| `service_request_urgency` | `planned`, `today`, `urgent` | `service_request_drafts.urgency` |
| `service_pickup_preference` | `dropoff`, `pickup`, `valet` | Draft |
| `service_case_status` | `matching`, `offers_ready`, `appointment_pending`, `scheduled`, `service_in_progress`, `parts_approval`, `invoice_approval`, `completed`, `archived`, `cancelled` | `service_cases.status` (state machine — bkz §6.1) |
| `case_action_type` | `refresh_matching`, `change_service_preference`, `open_offers`, `message_service`, `request_appointment`, `cancel_appointment`, `cancel_case`, `confirm_appointment`, `approve_parts`, `approve_invoice`, `confirm_completion`, `open_documents`, `start_similar_request` | UI aksiyonu, derivatif |
| `case_actor` | `customer`, `technician`, `system` | Event, task, milestone sahibi |
| `case_wait_actor` | `customer`, `technician`, `system`, `none` | Hangi tarafın aksiyonu bekleniyor |
| `case_attachment_kind` | `photo`, `video`, `audio`, `invoice`, `report`, `document`, `location` | `case_attachments.kind`, `case_documents.kind` |
| `case_offer_status` | `pending`, `shortlisted`, `accepted`, `rejected`, `expired` | `case_offers.status` (bkz §6.3) |
| `case_event_type` | `submitted`, `offer_received`, `technician_selected`, `status_update`, `parts_requested`, `invoice_shared`, `message`, `completed` | Audit log |
| `case_message_author_role` | `customer`, `technician`, `system` | Thread içinde |
| `accident_report_method` | `e_devlet`, `paper`, `police` | Kaza composer |
| `breakdown_category` | `engine`, `electric`, `mechanic`, `climate`, `transmission`, `tire`, `fluid`, `other` | Arıza kategorisi |
| `price_preference` | `any`, `nearby`, `cheap`, `fast` | Müşteri tercihi |
| `maintenance_category` | `periodic`, `tire`, `glass_film`, `coating`, `battery`, `climate`, `brake`, `detail_wash`, `headlight_polish`, `engine_wash`, `package_summer`, `package_winter`, `package_new_car`, `package_sale_prep` | Bakım kategorisi (10 tek iş + 4 paket) |
| `case_approval_kind` | `parts_request`, `invoice`, `completion` | Onay tipi |
| `case_approval_status` | `pending`, `approved`, `rejected` | Onay durumu |
| `case_workflow_blueprint` | `damage_insured`, `damage_uninsured`, `maintenance_standard`, `maintenance_major` | Akış şablonu |
| `case_milestone_status` | `completed`, `active`, `upcoming`, `blocked` | Timeline |
| `case_task_kind` | (17 değer, bkz. `CaseTaskKindSchema`) | Görev tipi |
| `case_task_status` | `pending`, `active`, `completed`, `blocked` | Görev durumu |
| `case_task_urgency` | `background`, `soon`, `now` | Aciliyet |
| `case_notification_intent_type` | `customer_approval_needed`, `quote_ready`, `appointment_confirmation`, `evidence_missing`, `status_update_required`, `delivery_ready`, `payment_review` | Bildirim niyeti |
| `case_delta_kind` | `evidence`, `status`, `approval`, `message` | Delta feed |
| `appointment_status` | `pending`, `approved`, `declined`, `expired`, `cancelled` | `appointments.status` (bkz §6.2) |
| `appointment_slot_kind` | `today`, `tomorrow`, `custom`, `flexible` | Randevu saat seçimi |
| `case_tone` | `accent`, `neutral`, `success`, `warning`, `critical`, `info` | UI toning (presentation concern — DB'de opsiyonel) |
| `technician_availability` | `available`, `busy`, `offline` | `technicians.availability` |
| `technician_category` | `usta`, `servis`, `lastik`, `sanayi`, `hasar` | Usta tip kategorileri |
| `notification_kind` | `offer`, `case_status`, `case_message`, `case_document`, `maintenance_reminder`, `invoice`, `system` | `notifications.kind` |
| `notification_preference_key` | `push_case`, `push_offer`, `push_maintenance`, `sms_critical`, `email_invoice` | `notification_preferences.key` |

---

## 5. Entity Kataloğu

### 5.1 `User`

Mock (domain) şeması: `packages/domain/src/user.ts` → `UserSchema`.

| Alan | Zod tipi | DB tipi | Not |
|---|---|---|---|
| `id` | `z.string().uuid()` | `UUID PK` | Backend tarafında üretilir |
| `phone` | `z.string().nullable()` | `VARCHAR(20) UNIQUE NULL` | Müşteri için asıl login; E.164 formatı |
| `email` | `z.string().email().nullable()` | `VARCHAR(255) NULL` | İkincil; opsiyonel |
| `full_name` | `z.string().nullable()` | `VARCHAR(255) NULL` | Profil adı |
| `role` | `z.enum([customer, technician, admin])` | `user_role ENUM NOT NULL` | |
| `status` | `z.enum([pending, active, suspended])` | `user_status ENUM NOT NULL DEFAULT 'active'` | Technician için KYC |
| `created_at` | `z.string()` | `TIMESTAMPTZ NOT NULL DEFAULT now()` | |
| `updated_at` | `z.string()` | `TIMESTAMPTZ NOT NULL DEFAULT now()` | |

**Client-side profil alanları** (şu an `user-store.ts`): `name`, `phone`, `email`. Bunlar `users` tablosundan türer; client state bir cache.

---

### 5.2 `Vehicle`

Mock: `naro-app/src/features/vehicles/types.ts` → `VehicleSchema`. Domain paketi tarafı (`packages/domain/src/vehicle.ts`) daha minimal; **naro-app tarafındaki genişletilmiş şemayı kaynak alıyoruz** (müşteri-app bunu kullanıyor).

| Alan | Zod tipi | DB tipi | Not |
|---|---|---|---|
| `id` | `z.string()` | `UUID PK` | |
| `user_id` | `-` (domain'de yok ama backend'de zorunlu) | `UUID NOT NULL REFERENCES users(id)` | Sahiplik |
| `plate` | `z.string()` | `VARCHAR(15) UNIQUE NOT NULL` | Plaka formatı (TR) |
| `make` | `z.string()` | `VARCHAR(64) NOT NULL` | |
| `model` | `z.string()` | `VARCHAR(64) NOT NULL` | |
| `year` | `z.number().int()` | `SMALLINT NOT NULL` | |
| `color` | `z.string().optional()` | `VARCHAR(32) NULL` | |
| `fuel` | `z.string().optional()` | `VARCHAR(32) NULL` | |
| `transmission` | `z.string().optional()` | `VARCHAR(32) NULL` | |
| `engine` | `z.string().optional()` | `VARCHAR(64) NULL` | |
| `mileage_km` | `z.number().int()` | `INTEGER NOT NULL DEFAULT 0` | |
| `note` | `z.string().optional()` | `TEXT NULL` | Kullanıcı notu |
| `health_label` | `z.string().optional()` | `VARCHAR(255) NULL` | Derivatif/client |
| `last_service_label` | `z.string().optional()` | `VARCHAR(255) NULL` | |
| `next_service_label` | `z.string().optional()` | `VARCHAR(255) NULL` | |
| `regular_shop` | `z.string().optional()` | `VARCHAR(255) NULL` | |
| `insurance_expiry_label` | `z.string().optional()` | `VARCHAR(64) NULL` | |
| `chronic_notes` | `z.array(z.string())` | `TEXT[] NOT NULL DEFAULT '{}'` | Sürekli notlar |
| `history_access_granted` | `z.boolean()` | `BOOLEAN NOT NULL DEFAULT false` | Memory izni (bkz. user_preferences memory) |
| `created_at` | — | `TIMESTAMPTZ NOT NULL DEFAULT now()` | |

**Alt ilişkiler (ayrı tablolar):**
- `vehicle_warranties` — 1-N, garanti kayıtları.
- `vehicle_maintenance_reminders` — 1-N, bakım hatırlatmaları.
- `vehicle_memory_events` — 1-N, zaman çizgisi (`kind ∈ {maintenance, repair, damage, warranty, document}`).

### 5.3 `Technician`

Mock: `naro-app/src/features/ustalar/types.ts` → `TechnicianMatchSchema` + `TechnicianProfileSchema`. Bir usta hem match listesi hem profil detayı verir; biri özet, diğeri zengin. Backend'de **tek tablo** yeterli, view'lar açılarak match/profile projeksiyonu çıkar.

| Alan | Zod tipi | DB tipi | Not |
|---|---|---|---|
| `id` | `z.string()` | `UUID PK` | |
| `user_id` | — (domain'de usta kendisi user) | `UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE` | 1-1 user ↔ technician |
| `name` | `z.string()` | `VARCHAR(255) NOT NULL` | |
| `tagline` | `z.string()` | `VARCHAR(255) NOT NULL` | |
| `biography` | `z.string()` | `TEXT NOT NULL` | |
| `service_mode` | `z.string()` | `VARCHAR(128) NOT NULL` | |
| `estimated_duration` | `z.string()` | `VARCHAR(64) NOT NULL` | |
| `guarantee` | `z.string()` | `VARCHAR(128) NOT NULL` | |
| `pickup` | `z.string()` | `VARCHAR(64) NOT NULL` | |
| `price_range_min` | — (mock'ta label) | `NUMERIC(10,2) NULL` | Alt bant |
| `price_range_max` | — | `NUMERIC(10,2) NULL` | Üst bant |
| `price_label` | `z.string()` | `VARCHAR(64) GENERATED / CACHE` | Derivatif |
| `rating_avg` | `z.number()` | `NUMERIC(3,2) NOT NULL DEFAULT 0` | 0-5 |
| `review_count` | `z.number().int()` | `INTEGER NOT NULL DEFAULT 0` | |
| `response_minutes` | `z.number().int()` | `INTEGER NOT NULL DEFAULT 0` | |
| `availability` | `z.enum([available, busy, offline])` | `technician_availability ENUM NOT NULL DEFAULT 'available'` | |
| `availability_label` | `z.string()` | `VARCHAR(64) NOT NULL` | İnsan-okunur |
| `working_hours` | `z.string().optional()` | `VARCHAR(255) NULL` | |
| `area_label` | `z.string().optional()` | `VARCHAR(255) NULL` | "İstanbul / Kağıthane" gibi |
| `area_geo` | — | `GEOGRAPHY(POINT, 4326) NULL` | Lat/lng; PostGIS varsa (matching için) |
| `completed_jobs` | `z.number().int().optional()` | `INTEGER NOT NULL DEFAULT 0` | |
| `verified_since` | — | `TIMESTAMPTZ NULL` | |
| `verified_since_label` | `z.string().optional()` | `VARCHAR(64) NULL` | Derivatif |
| `created_at` | — | `TIMESTAMPTZ NOT NULL DEFAULT now()` | |

**Alt ilişkiler:**
- `technician_specialties (technician_id, specialty)` — N, string[].
- `technician_expertise (technician_id, expertise)` — N.
- `technician_categories (technician_id, category)` — N, enum `technician_category`.
- `technician_badges (id, technician_id, label, tone, kind)` — N, doğrulama rozetleri.
- `technician_campaigns (id, technician_id, title, subtitle, price_label, price_amount, ...)` — N.
- `technician_service_details (id, technician_id, label, value)` — N, key/value kart.
- `technician_reviews (id, technician_id, author_name, body, created_at)` — N.

**Önemli**: `distance_km` **per-user hesaplanır**, DB'de değil. Client veya backend-runtime (PostGIS ile).

---

### 5.4 `ServiceCase` (merkez)

Mock: `ServiceCaseSchema`. Çok alanlı; bir kısmı ham ("`request` embedded draft"), bir kısmı derivatif (`next_action_*`, `allowed_actions`, `milestones`, `tasks`).

| Alan | DB tipi | Not |
|---|---|---|
| `id` | `UUID PK` | |
| `vehicle_id` | `UUID NOT NULL REFERENCES vehicles(id)` | |
| `customer_user_id` | `UUID NOT NULL REFERENCES users(id)` | Vakayı açan — vehicle.user_id ile tutarlı |
| `kind` | `service_request_kind NOT NULL` | |
| `status` | `service_case_status NOT NULL DEFAULT 'matching'` | Bkz §6.1 |
| `title` | `VARCHAR(255) NOT NULL` | |
| `subtitle` | `VARCHAR(255) NOT NULL DEFAULT ''` | |
| `summary` | `TEXT NOT NULL DEFAULT ''` | Müşteri editable (bkz. updateCaseNotes) |
| `assigned_technician_id` | `UUID NULL REFERENCES technicians(id)` | Randevu onaylandıktan sonra set |
| `preferred_technician_id` | `UUID NULL REFERENCES technicians(id)` | Shortlist veya randevu talebi |
| `workflow_blueprint` | `case_workflow_blueprint NOT NULL` | Akış şablonu |
| `total_label` | `VARCHAR(64) NULL` | Derivatif — accepted offer fiyatı |
| `total_amount` | `NUMERIC(12,2) NULL` | Sayısal karşılık |
| `estimate_label` | `VARCHAR(64) NULL` | |
| `created_at` | `TIMESTAMPTZ NOT NULL DEFAULT now()` | |
| `updated_at` | `TIMESTAMPTZ NOT NULL DEFAULT now()` | |
| `customer_last_seen_at` | `TIMESTAMPTZ NULL` | `last_seen_by_actor.customer` |
| `technician_last_seen_at` | `TIMESTAMPTZ NULL` | `last_seen_by_actor.technician` |

**Derivatif alanlar (mock'ta tutulan, backend'de HESAPLANAN, cache edilebilir):**
- `next_action_title/description/primary_label/secondary_label` → `tracking/engine.ts :: nextActionForStatus()` çıktısı.
- `allowed_actions` → `tracking/engine.ts :: allowedActionsForStatus()` çıktısı.
- `wait_state` → `buildWaitState(caseItem)` çıktısı.
- `milestones`, `tasks`, `evidence_feed`, `notification_intents` → `syncTrackingCase()` çıktısı.
- `assigned_service` (snapshot) → `technicians` join'inden türetilebilir.

**Karar**: Bu alanları **view'lar + stored procedure** üzerinden üret, DB'ye yazma. Client tarafında `buildCustomerTrackingView(caseItem)` bir HTTP endpoint'ten gelir.

---

### 5.5 `ServiceRequestDraft` (embedded içerik — ayrı tablo)

Mock'ta `ServiceCase.request` altında embedded; DB'de **ayrı tablo** (1-1) yapmak ilişkisel temizlik için iyi — draft alanlarının çoğu composer'a özel ve case core'undan farklı yaşam döngüsü var.

Tablo: `service_request_details`

| Alan | Zod tipi | DB tipi |
|---|---|---|
| `case_id` | `z.string()` | `UUID PK REFERENCES service_cases(id) ON DELETE CASCADE` |
| `urgency` | `z.enum(planned/today/urgent)` | `service_request_urgency NOT NULL` |
| `location_label` | `z.string()` | `VARCHAR(255)` |
| `location_geo` | — | `GEOGRAPHY(POINT, 4326) NULL` |
| `dropoff_label` | `z.string().optional()` | `VARCHAR(255) NULL` |
| `notes` | `z.string().optional()` | `TEXT NULL` — müşteri editable |
| `preferred_window` | `z.string().optional()` | `VARCHAR(64) NULL` |
| `vehicle_drivable` | `z.boolean().nullable()` | `BOOLEAN NULL` |
| `towing_required` | `z.boolean()` | `BOOLEAN NOT NULL DEFAULT false` |
| `pickup_preference` | `z.enum().nullable()` | `service_pickup_preference NULL` |
| `mileage_km` | `z.number().int().nullable()` | `INTEGER NULL` |
| `counterparty_note` | `z.string().optional()` | `TEXT NULL` |
| `counterparty_vehicle_count` | `z.number().int().nullable()` | `SMALLINT NULL` |
| `damage_area` | `z.string().optional()` | `VARCHAR(128) NULL` |
| `valet_requested` | `z.boolean()` | `BOOLEAN NOT NULL DEFAULT false` |
| `report_method` | `z.enum().nullable()` | `accident_report_method NULL` |
| `kasko_selected` | `z.boolean()` | `BOOLEAN NOT NULL DEFAULT false` |
| `kasko_brand` | `z.string().optional()` | `VARCHAR(64) NULL` |
| `sigorta_selected` | `z.boolean()` | `BOOLEAN NOT NULL DEFAULT false` |
| `sigorta_brand` | `z.string().optional()` | `VARCHAR(64) NULL` |
| `ambulance_contacted` | `z.boolean()` | `BOOLEAN NOT NULL DEFAULT false` |
| `emergency_acknowledged` | `z.boolean()` | `BOOLEAN NOT NULL DEFAULT false` |
| `breakdown_category` | `z.enum().nullable()` | `breakdown_category NULL` |
| `on_site_repair` | `z.boolean()` | `BOOLEAN NOT NULL DEFAULT false` |
| `price_preference` | `z.enum().nullable()` | `price_preference NULL` |
| `maintenance_category` | `z.enum().nullable()` | `maintenance_category NULL` |
| `maintenance_tier` | `z.string().optional()` | `VARCHAR(64) NULL` |

**Alt koleksiyonlar:**
- `case_symptoms (case_id, symptom)` — arıza belirtileri (string[] olarak draft'ta).
- `case_maintenance_items (case_id, item)` — bakım iç kalemleri (string[]).

### 5.6 `CaseOffer`

Mock: `CaseOfferSchema`.

Tablo: `case_offers`

| Alan | Zod | DB |
|---|---|---|
| `id` | `z.string()` | `UUID PK` |
| `case_id` | — | `UUID NOT NULL REFERENCES service_cases(id) ON DELETE CASCADE` |
| `technician_id` | `z.string()` | `UUID NOT NULL REFERENCES technicians(id)` |
| `headline` | `z.string()` | `VARCHAR(255) NOT NULL` |
| `description` | `z.string()` | `TEXT NOT NULL` |
| `amount` | `z.number().nonnegative()` | `NUMERIC(12,2) NOT NULL CHECK (amount >= 0)` |
| `currency` | `z.string().default("TRY")` | `CHAR(3) NOT NULL DEFAULT 'TRY'` |
| `price_label` | `z.string()` | `VARCHAR(64) NOT NULL` (derivatif) |
| `eta_minutes` | `z.number().int().nonneg()` | `INTEGER NOT NULL CHECK (eta_minutes >= 0)` |
| `eta_label` | `z.string()` | `VARCHAR(64) NOT NULL` |
| `available_at_label` | `z.string()` | `VARCHAR(64) NOT NULL` |
| `delivery_mode` | `z.string()` | `VARCHAR(64) NOT NULL` |
| `warranty_label` | `z.string()` | `VARCHAR(128) NOT NULL` |
| `status` | `z.enum(...)` | `case_offer_status NOT NULL DEFAULT 'pending'` |
| `created_at` | — | `TIMESTAMPTZ NOT NULL DEFAULT now()` |
| `updated_at` | — | `TIMESTAMPTZ NOT NULL DEFAULT now()` |
| `expires_at` | — | `TIMESTAMPTZ NULL` (ileri faz TTL) |

**Alt ilişki:**
- `case_offer_badges (offer_id, label)` — N, string[].

### 5.7 `Appointment`

Mock: `AppointmentSchema`.

Tablo: `appointments`

| Alan | DB |
|---|---|
| `id` | `UUID PK` |
| `case_id` | `UUID NOT NULL REFERENCES service_cases(id) ON DELETE CASCADE` |
| `technician_id` | `UUID NOT NULL REFERENCES technicians(id)` |
| `offer_id` | `UUID NULL REFERENCES case_offers(id) ON DELETE SET NULL` — Path B'de dolu |
| `slot_kind` | `appointment_slot_kind NOT NULL` |
| `slot_date` | `DATE NULL` — slot_kind='custom' için |
| `slot_time_window` | `VARCHAR(32) NULL` |
| `note` | `TEXT NOT NULL DEFAULT ''` |
| `status` | `appointment_status NOT NULL DEFAULT 'pending'` |
| `requested_at` | `TIMESTAMPTZ NOT NULL DEFAULT now()` |
| `expires_at` | `TIMESTAMPTZ NOT NULL` — requested_at + 24h |
| `responded_at` | `TIMESTAMPTZ NULL` |
| `decline_reason` | `TEXT NULL` |

### 5.8 `CaseAttachment` + `CaseDocument`

Mock: `CaseAttachmentSchema`, `CaseDocumentSchema`.

İki ayrı kavram:
- **attachment** = composer/runtime'da yüklenen ham medya. ShemA sade: id, kind, title, subtitle, statusLabel.
- **document** = case'in resmi evrak kaydı. Source label (kim yükledi), created_at kesin, approval'lara evidence olarak referanslanır.

Tablolar:

`case_attachments`
| Alan | DB |
|---|---|
| `id` | `UUID PK` |
| `case_id` | `UUID NOT NULL REFERENCES service_cases(id) ON DELETE CASCADE` |
| `kind` | `case_attachment_kind NOT NULL` |
| `title` | `VARCHAR(255) NOT NULL` |
| `subtitle` | `VARCHAR(255) NULL` |
| `status_label` | `VARCHAR(64) NULL` |
| `storage_url` | `TEXT NOT NULL` — **backend**: S3/CDN URL |
| `uploaded_by_user_id` | `UUID NOT NULL REFERENCES users(id)` |
| `uploaded_at` | `TIMESTAMPTZ NOT NULL DEFAULT now()` |

`case_documents` (farklı tablo; aynı dosyaya document olarak promosyon edilebilir)
| Alan | DB |
|---|---|
| `id` | `UUID PK` |
| `case_id` | `UUID NOT NULL REFERENCES service_cases(id) ON DELETE CASCADE` |
| `attachment_id` | `UUID NULL REFERENCES case_attachments(id) ON DELETE SET NULL` — origin |
| `kind` | `case_attachment_kind NOT NULL` |
| `title` | `VARCHAR(255) NOT NULL` |
| `subtitle` | `VARCHAR(255) NULL` |
| `source_label` | `VARCHAR(64) NOT NULL` — "Müşteri yükledi", "Servis paylaştı" |
| `status_label` | `VARCHAR(64) NOT NULL DEFAULT 'Yeni'` |
| `created_at` | `TIMESTAMPTZ NOT NULL DEFAULT now()` |

### 5.9 `CaseEvent` (audit log)

Mock: `CaseEventSchema`. **Append-only**.

`case_events`
| Alan | DB |
|---|---|
| `id` | `UUID PK` |
| `case_id` | `UUID NOT NULL REFERENCES service_cases(id) ON DELETE CASCADE` |
| `type` | `case_event_type NOT NULL` |
| `title` | `VARCHAR(255) NOT NULL` |
| `body` | `TEXT NOT NULL` |
| `tone` | `case_tone NOT NULL DEFAULT 'info'` |
| `actor` | `case_actor NULL` — kim tetikledi |
| `created_at` | `TIMESTAMPTZ NOT NULL DEFAULT now()` |

### 5.10 `CaseThread` + `CaseMessage`

Tek thread per case. Mock: `CaseThreadSchema` + `CaseMessageSchema`.

`case_threads`
| Alan | DB |
|---|---|
| `id` | `UUID PK` |
| `case_id` | `UUID UNIQUE NOT NULL REFERENCES service_cases(id) ON DELETE CASCADE` |
| `preview` | `VARCHAR(255) NOT NULL DEFAULT ''` — son mesaj özeti |
| `unread_count_customer` | `INTEGER NOT NULL DEFAULT 0` |
| `unread_count_technician` | `INTEGER NOT NULL DEFAULT 0` |

`case_messages`
| Alan | DB |
|---|---|
| `id` | `UUID PK` |
| `thread_id` | `UUID NOT NULL REFERENCES case_threads(id) ON DELETE CASCADE` |
| `author_user_id` | `UUID NULL REFERENCES users(id)` — system mesajları NULL |
| `author_role` | `case_message_author_role NOT NULL` |
| `author_name` | `VARCHAR(128) NOT NULL` (denormalize — tarihsel kayıt) |
| `body` | `TEXT NOT NULL` |
| `created_at` | `TIMESTAMPTZ NOT NULL DEFAULT now()` |

`case_message_attachments` (M2M mesaj ↔ attachment)
| Alan | DB |
|---|---|
| `message_id` | `UUID NOT NULL REFERENCES case_messages(id) ON DELETE CASCADE` |
| `attachment_id` | `UUID NOT NULL REFERENCES case_attachments(id) ON DELETE CASCADE` |
| PK | `(message_id, attachment_id)` |

### 5.11 `CaseApproval` (+ line items)

Mock: `CaseApprovalSchema` + `CaseApprovalLineItemSchema`.

`case_approvals`
| Alan | DB |
|---|---|
| `id` | `UUID PK` |
| `case_id` | `UUID NOT NULL REFERENCES service_cases(id) ON DELETE CASCADE` |
| `kind` | `case_approval_kind NOT NULL` |
| `status` | `case_approval_status NOT NULL DEFAULT 'pending'` |
| `title` | `VARCHAR(255) NOT NULL` |
| `description` | `TEXT NOT NULL` |
| `requested_by_user_id` | `UUID NOT NULL REFERENCES users(id)` |
| `requested_at` | `TIMESTAMPTZ NOT NULL DEFAULT now()` |
| `responded_at` | `TIMESTAMPTZ NULL` |
| `amount_label` | `VARCHAR(64) NULL` |
| `amount_numeric` | `NUMERIC(12,2) NULL` |
| `action_label` | `VARCHAR(64) NULL` |
| `service_comment` | `TEXT NULL` |

`case_approval_line_items`
| Alan | DB |
|---|---|
| `id` | `UUID PK` |
| `approval_id` | `UUID NOT NULL REFERENCES case_approvals(id) ON DELETE CASCADE` |
| `label` | `VARCHAR(255) NOT NULL` |
| `value` | `VARCHAR(64) NOT NULL` |
| `note` | `VARCHAR(255) NULL` |
| `sort_order` | `INTEGER NOT NULL DEFAULT 0` |

`case_approval_evidence` (M2M approval ↔ document)
| Alan | DB |
|---|---|
| `approval_id` | `UUID NOT NULL REFERENCES case_approvals(id) ON DELETE CASCADE` |
| `document_id` | `UUID NOT NULL REFERENCES case_documents(id) ON DELETE CASCADE` |
| PK | `(approval_id, document_id)` |

### 5.12 Workflow: `CaseMilestone`, `CaseTask`, `CaseEvidenceItem`

Şu an **derivatif** (engine.ts). Persist mi edilecek?

**Öneri**: milestones/tasks her `syncTrackingCase` çağrısında yeniden üretiliyor — **persist etmeye gerek yok**. İzolasyon için bir view veya stored function (`build_tracking_view(case_id)`) DB'den beslenebilir, sonuç JSON olarak dönebilir. Eğer persist isteniyorsa:

`case_milestones` / `case_tasks` / `case_evidence_items` — alan alan Zod şemalarına birebir — ama bu tabloları kullanmak istiyorsanız **append-only değil, full refresh** (yani silip yeniden yazma) mantığıyla yönetilmeli çünkü engine deterministiktir.

**V1 için karar**: bu 3 tabloyu yazmayın. Runtime'da hesapla.

### 5.13 `Notification`

Mock: `NotificationSchema` (müşteri-app).

`notifications`
| Alan | DB |
|---|---|
| `id` | `UUID PK` |
| `user_id` | `UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE` |
| `kind` | `notification_kind NOT NULL` |
| `title` | `VARCHAR(255) NOT NULL` |
| `body` | `TEXT NOT NULL` |
| `route` | `VARCHAR(255) NULL` — deep link |
| `related_case_id` | `UUID NULL REFERENCES service_cases(id) ON DELETE SET NULL` |
| `related_offer_id` | `UUID NULL REFERENCES case_offers(id) ON DELETE SET NULL` |
| `created_at` | `TIMESTAMPTZ NOT NULL DEFAULT now()` |
| `read_at` | `TIMESTAMPTZ NULL` — NULL ise unread |

`notification_preferences`
| Alan | DB |
|---|---|
| `user_id` | `UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE` |
| `key` | `notification_preference_key NOT NULL` |
| `enabled` | `BOOLEAN NOT NULL DEFAULT true` |
| PK | `(user_id, key)` |

### 5.14 Müşteri-özel state tabloları

`favorite_technicians`
| Alan | DB |
|---|---|
| `user_id` | `UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE` |
| `technician_id` | `UUID NOT NULL REFERENCES technicians(id) ON DELETE CASCADE` |
| `created_at` | `TIMESTAMPTZ NOT NULL DEFAULT now()` |
| PK | `(user_id, technician_id)` |

`technician_cooldowns` (decline sayacı, anti-abuse)
| Alan | DB |
|---|---|
| `user_id` | `UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE` |
| `technician_id` | `UUID NOT NULL REFERENCES technicians(id) ON DELETE CASCADE` |
| `decline_count` | `INTEGER NOT NULL DEFAULT 0` |
| `last_decline_at` | `TIMESTAMPTZ NOT NULL` |
| PK | `(user_id, technician_id)` |

`search_recent_queries` (isteğe bağlı persist)
| Alan | DB |
|---|---|
| `user_id` | `UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE` |
| `query` | `VARCHAR(128) NOT NULL` |
| `created_at` | `TIMESTAMPTZ NOT NULL DEFAULT now()` |

---

## 6. Durum Makineleri

### 6.1 `service_case_status`

```
              ┌──────────┐
              │ matching │◀─────── (decline/expire appointment; Path A)
              └────┬─────┘
     offers ready  │
                   ▼
             ┌─────────────┐
             │offers_ready │◀──── (decline/expire appointment; Path B)
             └────┬────────┘
   müşteri randevu│ talebi
                  ▼
         ┌────────────────────┐
         │appointment_pending │◀── (cancel_appointment müşteri)
         └────┬────┬──────────┘
       usta  │    │ expire (24h) → offers_ready / matching
       onay  │    │ cancel_appointment → offers_ready / matching
             ▼    │
         ┌─────────────┐
         │  scheduled  │───── confirm_appointment → service_in_progress
         └────┬────────┘
              ▼
      ┌──────────────────────┐
      │ service_in_progress  │
      └────┬────────┬─────┬──┘
           │        │     │
           ▼        ▼     ▼
      parts_approval  invoice_approval ──→ completed
           │
           ▼ (approve) → service_in_progress (geri döner)
           │ (reject)  → service_in_progress (reddedildi, iş değişir)

  * herhangi bir aktif durumdan: cancel_case → cancelled
  * completed → (admin/opsiyonel) archived
```

**İzin verilen geçişler**:
| Durum | Sonraki olası durumlar |
|---|---|
| `matching` | `offers_ready`, `appointment_pending` (direct), `cancelled` |
| `offers_ready` | `appointment_pending`, `matching` (geri; offers expired), `cancelled` |
| `appointment_pending` | `scheduled` (approve), `offers_ready` (decline/expire Path B), `matching` (decline/expire Path A), `cancelled` |
| `scheduled` | `service_in_progress`, `cancelled` |
| `service_in_progress` | `parts_approval`, `invoice_approval`, `cancelled` |
| `parts_approval` | `service_in_progress` (approve/reject), `cancelled` |
| `invoice_approval` | `completed`, `cancelled` |
| `completed` | `archived` (opsiyonel, admin) |
| `cancelled`, `archived` | (terminal) |

### 6.2 `appointment_status`

```
  (create) → pending (expires_at = now + 24h)
                │
       ┌────────┼────────┬───────────┬──────────┐
       ▼        ▼        ▼           ▼          │
   approved  declined  expired   cancelled      │
   (usta)   (usta)    (TTL)     (müşteri)       │
                                                 (terminal - tüm yollar)
```

Sadece `pending` durumundan final durumlara geçilir. Terminal durumlardan geri dönüş yok; yeni randevu talep etmek için **yeni `appointments` satırı** açılır.

### 6.3 `case_offer_status`

```
  (create) → pending
       │
       ├─── shortlisted (müşteri shortlist'e aldı)
       │        │
       │        └── back to pending (downgrade)
       │        └── accepted (randevu talebi başladı)
       │        └── rejected (ele)
       ├─── accepted (randevu talebi başladı — path B)
       ├─── rejected (müşteri ele VEYA başka offer accepted oldu VEYA randevu decline/expire Path B'de)
       └─── expired (offer TTL — v2)
```

**Kural**: Bir vakada **max 1 accepted offer** aynı anda. Yeni appointment pending bu offer'ı accepted yapar; appointment decline/expire olursa offer'ı rejected'a düşür (otomatik, engine).

### 6.4 `case_approval_status`

```
  pending → approved (müşteri kabul) → service_in_progress (devam)
  pending → rejected (müşteri red) → service_in_progress (iş değişimi)
```

Terminal: `approved`, `rejected`. Yeni bir parça/fatura kararı için yeni `case_approvals` satırı açılır.

---

## 7. Kritik İş Akışları

### 7.1 Vaka oluşturma

```
Composer (draft: kind, vehicle_id, ...) → submit
  ├─ INSERT service_cases (status='matching', kind, vehicle_id)
  ├─ INSERT service_request_details (case_id, ...)
  ├─ INSERT case_symptoms (case_id, symptom) × N
  ├─ INSERT case_maintenance_items (case_id, item) × N
  ├─ INSERT case_attachments × N (composer'daki ham attachmentlar)
  ├─ INSERT case_documents × N (composer'daki evrak promosyonları)
  ├─ INSERT case_threads (case_id, preview='Talep açıldı')
  ├─ INSERT case_messages (thread_id, author_role='system', body='Talebin alındı...')
  └─ INSERT case_events (type='submitted', ...)

→ Matching motoru asenkron: offers oluşturur
   ├─ status='matching' → 'offers_ready' (ilk teklif geldiğinde)
```

### 7.2 Path A — Randevu-first (usta seç, direkt randevu)

```
Müşteri: Çarşı/Ana Sayfa → usta kartı → preview → Randevu Al
  → /(modal)/talep/{kind}?technicianId={id}
  → Composer (preferred_technician_id = id)
  → submit → INSERT service_cases + details + events
  → /randevu/{technicianId}?caseId={id}

Müşteri: onaylar + slot seçer + Randevu Talep Et
  → INSERT appointments (case_id, technician_id, slot, status='pending', expires_at=+24h)
  → UPDATE service_cases SET status='appointment_pending', preferred_technician_id=id
  → INSERT case_events (type='status_update', 'Randevu talebi gönderildi')
  → INSERT case_messages (author='Naro', body='...')

Usta (backend notification): onayla/red
  approve:
    → UPDATE appointments SET status='approved', responded_at=now()
    → UPDATE service_cases SET status='scheduled', assigned_technician_id=id, total_label=offer.price_label (varsa)
    → INSERT case_events (type='technician_selected')
    → INSERT notifications (user_id=customer, kind='case_status', title='Randevu onaylandı')
  decline:
    → UPDATE appointments SET status='declined', decline_reason
    → UPDATE service_cases SET status='matching' (Path A) veya 'offers_ready' (Path B)
    → INSERT case_events
    → UPSERT technician_cooldowns (user_id=customer, technician_id, decline_count += 1, last_decline_at=now())
    → INSERT notifications (kind='case_status', title='Randevu reddedildi')
```

### 7.3 Path B — Teklif-first (offer accept + randevu)

```
Müşteri: Teklifler sayfası → teklif kartı → Bu teklifle Randevu Al
  → /randevu/{technicianId}?caseId={id}&offerId={offerId}
  → Composer'dan geçmedi (vaka zaten var)

Müşteri: onay + slot + Randevu Talep Et
  → UPDATE case_offers SET status='accepted' WHERE id=offerId
  → UPDATE case_offers SET status='rejected' WHERE case_id=id AND id != offerId
  → INSERT appointments (case_id, technician_id, offer_id, slot, status='pending')
  → UPDATE service_cases SET status='appointment_pending', preferred_technician_id
  → events + messages

Usta onay: aynı Path A'daki gibi → status='scheduled'
  → UPDATE service_cases SET total_label = offer.price_label (offer'dan)
```

### 7.4 Parça/fatura onay döngüleri

```
Usta: servis sırasında extra parça gerekti
  → INSERT case_approvals (kind='parts_request', status='pending', amount_numeric)
  → INSERT case_approval_line_items × N
  → UPDATE service_cases SET status='parts_approval'
  → events + notification (customer_approval_needed)

Müşteri: onayla
  → UPDATE case_approvals SET status='approved', responded_at=now()
  → UPDATE service_cases SET status='service_in_progress' (geri döner)
  → events + messages
```

Fatura ve teslim onayı aynı pattern.

### 7.5 İptal akışları

**Randevu iptali** (pending durumunda):
```
Müşteri veya Usta:
  → UPDATE appointments SET status='cancelled'/'declined'
  → UPDATE service_cases SET status='offers_ready' (Path B) / 'matching' (Path A)
  → events
```

**Vaka iptali** (tüm aktif durumlarda):
```
Müşteri:
  → UPDATE service_cases SET status='cancelled', assigned_technician_id=NULL, preferred_technician_id=NULL
  → UPDATE appointments SET status='cancelled' WHERE case_id=id AND status='pending'
  → events (type='status_update', tone='critical', 'Vaka iptal edildi')
  → messages (system)
```

### 7.6 Notasyon tetikleyicileri

`notifications` tablosuna hangi olaylarda satır düşer:
- Yeni offer geldi → kind='offer'
- Randevu onaylandı/reddedildi/süresi doldu → kind='case_status'
- Yeni mesaj → kind='case_message'
- Yeni belge/evidence → kind='case_document'
- Bakım hatırlatıcı → kind='maintenance_reminder'
- Fatura eklendi → kind='invoice'
- Sistem duyurusu → kind='system'

---

## 8. Domain Invariantları

Database'e constraint veya domain layer'da enforce edilmesi gereken **sabit doğrular**:

1. **I1 — Case ↔ vehicle ↔ user tutarlılığı**: `service_cases.customer_user_id = vehicles.user_id` (vehicle sahibiyle eşleşmeli). DB'de trigger veya CHECK.
2. **I2 — Max 1 aktif randevu per vaka**: `appointments` üzerinde partial unique index:
   ```sql
   CREATE UNIQUE INDEX appointments_active_per_case
   ON appointments(case_id) WHERE status = 'pending';
   ```
3. **I3 — Max 1 accepted offer per vaka**:
   ```sql
   CREATE UNIQUE INDEX offers_accepted_per_case
   ON case_offers(case_id) WHERE status = 'accepted';
   ```
4. **I4 — Scheduled ⇒ assigned_technician**: `service_cases.status IN ('scheduled', 'service_in_progress', 'parts_approval', 'invoice_approval') ⇒ assigned_technician_id IS NOT NULL`. DB CHECK.
5. **I5 — appointment.offer_id tutarlılığı**: Varsa, `offer.case_id = appointment.case_id` ve `offer.technician_id = appointment.technician_id`.
6. **I6 — appointment.technician_id = service_cases.preferred_technician_id** (pending iken) — randevu üzerinde teklif yoksa bile preferred olmalı.
7. **I7 — Terminal durumdan geri dönüş yok**: `cancelled`, `completed`, `archived` durumundan başka duruma geçilemez. State machine guard.
8. **I8 — Thread 1-1**: Her case'te tam 1 thread. `CREATE UNIQUE INDEX thread_per_case ON case_threads(case_id);`
9. **I9 — Event append-only**: `UPDATE case_events` yasak (trigger ile reddet).
10. **I10 — Cancel cleanup**: `service_cases.status='cancelled'` olduğunda pending appointment otomatik `cancelled`, pending approvals otomatik `rejected` (CASCADE trigger).
11. **I11 — Offer accepted ⇒ case.status ≥ appointment_pending**: Offer `accepted` ise case status'u `matching`/`offers_ready` OLAMAZ.
12. **I12 — Draft fields by kind**: `accident` kind'da `damage_area` önerilir; `breakdown` kind'da `breakdown_category` önerilir; `maintenance` kind'da `maintenance_category` önerilir; `towing` kind'da `pickup_preference` önerilir. Soft validation (composer tarafında).

---

## 9. Anti-abuse Kuralları

Müşteri tarafı (v1 yumuşak kurallar, hepsi `technician_cooldowns` + `appointments` üzerinden hesaplanır):

1. **R1 — Aktif 3 randevu limiti** per user. `COUNT(appointments WHERE status='pending' AND case.customer_user_id=?) ≤ 3`. Aşılırsa yeni `/randevu` submit engellenir.
2. **R2 — 24h TTL**: `appointments.expires_at = requested_at + 24h`. Expired olunca engine otomatik `expired` yazar; müşteri yeni randevu talep edebilir.
3. **R3 — Usta bazlı cooldown**: 24h pencerede usta ≥2 kez decline ederse aynı müşteri o ustaya 24h boyunca yeni randevu açamaz. `technician_cooldowns.decline_count ≥ 2 AND last_decline_at > now() - 24h` kontrolü. UI'de chip "kısa süre sonra tekrar dene".
4. **R4 — 30gün 3+ iptal** (v2 flag): Müşteri 30 gün içinde `service_cases.status='cancelled'` yaptığı vaka sayısı 3+'ysa warning banner + admin review. v1 sadece metric.

Usta tarafı (v2 için hazır alan):
- Decline pattern'i: usta çok red ediyorsa reputation düşer.
- Pickup nokta suistimali: pickup seçip gelmemek → ters puan.

---

## 10. İlişkisel Veritabanı Taslağı (PostgreSQL)

Tam DDL. Tipler yukarıdaki entity kataloglarından.

```sql
-- =============================================================
-- ENUM types
-- =============================================================
CREATE TYPE user_role                AS ENUM ('customer','technician','admin');
CREATE TYPE user_status              AS ENUM ('pending','active','suspended');
CREATE TYPE service_request_kind     AS ENUM ('accident','towing','breakdown','maintenance');
CREATE TYPE service_request_urgency  AS ENUM ('planned','today','urgent');
CREATE TYPE service_pickup_preference AS ENUM ('dropoff','pickup','valet');
CREATE TYPE service_case_status      AS ENUM (
  'matching','offers_ready','appointment_pending','scheduled',
  'service_in_progress','parts_approval','invoice_approval',
  'completed','archived','cancelled'
);
CREATE TYPE case_action_type         AS ENUM (
  'refresh_matching','change_service_preference','open_offers','message_service',
  'request_appointment','cancel_appointment','cancel_case','confirm_appointment',
  'approve_parts','approve_invoice','confirm_completion','open_documents',
  'start_similar_request'
);
CREATE TYPE case_actor               AS ENUM ('customer','technician','system');
CREATE TYPE case_wait_actor          AS ENUM ('customer','technician','system','none');
CREATE TYPE case_attachment_kind     AS ENUM ('photo','video','audio','invoice','report','document','location');
CREATE TYPE case_offer_status        AS ENUM ('pending','shortlisted','accepted','rejected','expired');
CREATE TYPE case_event_type          AS ENUM ('submitted','offer_received','technician_selected','status_update','parts_requested','invoice_shared','message','completed');
CREATE TYPE case_message_author_role AS ENUM ('customer','technician','system');
CREATE TYPE accident_report_method   AS ENUM ('e_devlet','paper','police');
CREATE TYPE breakdown_category       AS ENUM ('engine','electric','mechanic','climate','transmission','tire','fluid','other');
CREATE TYPE price_preference         AS ENUM ('any','nearby','cheap','fast');
CREATE TYPE maintenance_category     AS ENUM (
  'periodic','tire','glass_film','coating','battery','climate','brake',
  'detail_wash','headlight_polish','engine_wash',
  'package_summer','package_winter','package_new_car','package_sale_prep'
);
CREATE TYPE case_approval_kind       AS ENUM ('parts_request','invoice','completion');
CREATE TYPE case_approval_status     AS ENUM ('pending','approved','rejected');
CREATE TYPE case_workflow_blueprint  AS ENUM ('damage_insured','damage_uninsured','maintenance_standard','maintenance_major');
CREATE TYPE appointment_status       AS ENUM ('pending','approved','declined','expired','cancelled');
CREATE TYPE appointment_slot_kind    AS ENUM ('today','tomorrow','custom','flexible');
CREATE TYPE case_tone                AS ENUM ('accent','neutral','success','warning','critical','info');
CREATE TYPE technician_availability  AS ENUM ('available','busy','offline');
CREATE TYPE technician_category      AS ENUM ('usta','servis','lastik','sanayi','hasar');
CREATE TYPE notification_kind        AS ENUM ('offer','case_status','case_message','case_document','maintenance_reminder','invoice','system');
CREATE TYPE notification_preference_key AS ENUM ('push_case','push_offer','push_maintenance','sms_critical','email_invoice');

-- =============================================================
-- Core: users + auth
-- =============================================================
CREATE TABLE users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone           VARCHAR(20) UNIQUE,
  email           VARCHAR(255),
  full_name       VARCHAR(255),
  role            user_role   NOT NULL,
  status          user_status NOT NULL DEFAULT 'active',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (phone IS NOT NULL OR email IS NOT NULL)
);

-- =============================================================
-- Vehicles (customer domain)
-- =============================================================
CREATE TABLE vehicles (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plate                      VARCHAR(15) UNIQUE NOT NULL,
  make                       VARCHAR(64)  NOT NULL,
  model                      VARCHAR(64)  NOT NULL,
  year                       SMALLINT     NOT NULL CHECK (year BETWEEN 1950 AND 2100),
  color                      VARCHAR(32),
  fuel                       VARCHAR(32),
  transmission               VARCHAR(32),
  engine                     VARCHAR(64),
  mileage_km                 INTEGER      NOT NULL DEFAULT 0 CHECK (mileage_km >= 0),
  note                       TEXT,
  health_label               VARCHAR(255),
  last_service_label         VARCHAR(255),
  next_service_label         VARCHAR(255),
  regular_shop               VARCHAR(255),
  insurance_expiry_label     VARCHAR(64),
  chronic_notes              TEXT[] NOT NULL DEFAULT '{}',
  history_access_granted     BOOLEAN NOT NULL DEFAULT false,
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX vehicles_user_idx ON vehicles(user_id);

CREATE TABLE vehicle_warranties (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id   UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  title        VARCHAR(255) NOT NULL,
  description  TEXT,
  expires_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE vehicle_maintenance_reminders (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id   UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  title        VARCHAR(255) NOT NULL,
  subtitle     VARCHAR(255),
  due_label    VARCHAR(64),
  tone         case_tone NOT NULL DEFAULT 'info',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE vehicle_memory_events (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id   UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  kind         VARCHAR(32) NOT NULL CHECK (kind IN ('maintenance','repair','damage','warranty','document')),
  title        VARCHAR(255) NOT NULL,
  body         TEXT,
  occurred_at  TIMESTAMPTZ NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================
-- Technicians (usta domain)
-- =============================================================
CREATE TABLE technicians (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name                     VARCHAR(255) NOT NULL,
  tagline                  VARCHAR(255) NOT NULL,
  biography                TEXT         NOT NULL,
  service_mode             VARCHAR(128) NOT NULL,
  estimated_duration       VARCHAR(64)  NOT NULL,
  guarantee                VARCHAR(128) NOT NULL,
  pickup                   VARCHAR(64)  NOT NULL,
  price_range_min          NUMERIC(10,2),
  price_range_max          NUMERIC(10,2),
  rating_avg               NUMERIC(3,2) NOT NULL DEFAULT 0 CHECK (rating_avg BETWEEN 0 AND 5),
  review_count             INTEGER      NOT NULL DEFAULT 0,
  response_minutes         INTEGER      NOT NULL DEFAULT 0,
  availability             technician_availability NOT NULL DEFAULT 'available',
  availability_label       VARCHAR(64)  NOT NULL DEFAULT 'Açık',
  working_hours            VARCHAR(255),
  area_label               VARCHAR(255),
  -- area_geo GEOGRAPHY(POINT, 4326),  -- PostGIS enabled ise
  completed_jobs           INTEGER      NOT NULL DEFAULT 0,
  verified_since           TIMESTAMPTZ,
  created_at               TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE technician_specialties (
  technician_id UUID NOT NULL REFERENCES technicians(id) ON DELETE CASCADE,
  specialty     VARCHAR(64) NOT NULL,
  PRIMARY KEY (technician_id, specialty)
);

CREATE TABLE technician_expertise (
  technician_id UUID NOT NULL REFERENCES technicians(id) ON DELETE CASCADE,
  expertise     VARCHAR(64) NOT NULL,
  PRIMARY KEY (technician_id, expertise)
);

CREATE TABLE technician_categories (
  technician_id UUID NOT NULL REFERENCES technicians(id) ON DELETE CASCADE,
  category      technician_category NOT NULL,
  PRIMARY KEY (technician_id, category)
);

CREATE TABLE technician_badges (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  technician_id UUID NOT NULL REFERENCES technicians(id) ON DELETE CASCADE,
  label         VARCHAR(64)   NOT NULL,
  tone          VARCHAR(32)   NOT NULL,
  kind          VARCHAR(32)   NOT NULL
);

CREATE TABLE technician_campaigns (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  technician_id  UUID NOT NULL REFERENCES technicians(id) ON DELETE CASCADE,
  title          VARCHAR(128) NOT NULL,
  subtitle       VARCHAR(255),
  price_label    VARCHAR(64)  NOT NULL,
  price_amount   NUMERIC(10,2),
  currency       CHAR(3) NOT NULL DEFAULT 'TRY',
  valid_from     TIMESTAMPTZ,
  valid_to       TIMESTAMPTZ
);

CREATE TABLE technician_service_details (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  technician_id UUID NOT NULL REFERENCES technicians(id) ON DELETE CASCADE,
  label         VARCHAR(64)  NOT NULL,
  value         VARCHAR(255) NOT NULL,
  sort_order    INTEGER      NOT NULL DEFAULT 0
);

CREATE TABLE technician_reviews (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  technician_id UUID NOT NULL REFERENCES technicians(id) ON DELETE CASCADE,
  author_name   VARCHAR(128) NOT NULL,
  body          TEXT NOT NULL,
  rating        NUMERIC(3,2) NOT NULL CHECK (rating BETWEEN 0 AND 5),
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- =============================================================
-- Service Cases (merkez)
-- =============================================================
CREATE TABLE service_cases (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id                 UUID NOT NULL REFERENCES vehicles(id),
  customer_user_id           UUID NOT NULL REFERENCES users(id),
  kind                       service_request_kind NOT NULL,
  status                     service_case_status  NOT NULL DEFAULT 'matching',
  title                      VARCHAR(255) NOT NULL,
  subtitle                   VARCHAR(255) NOT NULL DEFAULT '',
  summary                    TEXT NOT NULL DEFAULT '',
  assigned_technician_id     UUID REFERENCES technicians(id),
  preferred_technician_id    UUID REFERENCES technicians(id),
  workflow_blueprint         case_workflow_blueprint NOT NULL,
  total_label                VARCHAR(64),
  total_amount               NUMERIC(12,2),
  estimate_label             VARCHAR(64),
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  customer_last_seen_at      TIMESTAMPTZ,
  technician_last_seen_at    TIMESTAMPTZ,
  -- I4: scheduled+ durumda assigned_technician zorunlu
  CONSTRAINT scheduled_requires_assigned CHECK (
    status NOT IN ('scheduled','service_in_progress','parts_approval','invoice_approval','completed')
    OR assigned_technician_id IS NOT NULL
  )
);
CREATE INDEX service_cases_vehicle_idx  ON service_cases(vehicle_id);
CREATE INDEX service_cases_customer_idx ON service_cases(customer_user_id);
CREATE INDEX service_cases_status_idx   ON service_cases(status);
CREATE INDEX service_cases_active_customer
  ON service_cases(customer_user_id)
  WHERE status NOT IN ('completed','archived','cancelled');

-- Embedded draft detayları
CREATE TABLE service_request_details (
  case_id                    UUID PRIMARY KEY REFERENCES service_cases(id) ON DELETE CASCADE,
  urgency                    service_request_urgency NOT NULL,
  location_label             VARCHAR(255) NOT NULL DEFAULT '',
  -- location_geo            GEOGRAPHY(POINT, 4326),
  dropoff_label              VARCHAR(255),
  notes                      TEXT,
  preferred_window           VARCHAR(64),
  vehicle_drivable           BOOLEAN,
  towing_required            BOOLEAN NOT NULL DEFAULT false,
  pickup_preference          service_pickup_preference,
  mileage_km                 INTEGER,
  counterparty_note          TEXT,
  counterparty_vehicle_count SMALLINT,
  damage_area                VARCHAR(128),
  valet_requested            BOOLEAN NOT NULL DEFAULT false,
  report_method              accident_report_method,
  kasko_selected             BOOLEAN NOT NULL DEFAULT false,
  kasko_brand                VARCHAR(64),
  sigorta_selected           BOOLEAN NOT NULL DEFAULT false,
  sigorta_brand              VARCHAR(64),
  ambulance_contacted        BOOLEAN NOT NULL DEFAULT false,
  emergency_acknowledged     BOOLEAN NOT NULL DEFAULT false,
  breakdown_category         breakdown_category,
  on_site_repair             BOOLEAN NOT NULL DEFAULT false,
  price_preference           price_preference,
  maintenance_category       maintenance_category,
  maintenance_tier           VARCHAR(64)
);

CREATE TABLE case_symptoms (
  case_id UUID NOT NULL REFERENCES service_cases(id) ON DELETE CASCADE,
  symptom VARCHAR(128) NOT NULL,
  PRIMARY KEY (case_id, symptom)
);

CREATE TABLE case_maintenance_items (
  case_id UUID NOT NULL REFERENCES service_cases(id) ON DELETE CASCADE,
  item    VARCHAR(128) NOT NULL,
  PRIMARY KEY (case_id, item)
);

-- =============================================================
-- Offers
-- =============================================================
CREATE TABLE case_offers (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id             UUID NOT NULL REFERENCES service_cases(id) ON DELETE CASCADE,
  technician_id       UUID NOT NULL REFERENCES technicians(id),
  headline            VARCHAR(255) NOT NULL,
  description         TEXT NOT NULL,
  amount              NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  currency            CHAR(3) NOT NULL DEFAULT 'TRY',
  price_label         VARCHAR(64) NOT NULL,
  eta_minutes         INTEGER NOT NULL CHECK (eta_minutes >= 0),
  eta_label           VARCHAR(64) NOT NULL,
  available_at_label  VARCHAR(64) NOT NULL,
  delivery_mode       VARCHAR(64) NOT NULL,
  warranty_label      VARCHAR(128) NOT NULL,
  status              case_offer_status NOT NULL DEFAULT 'pending',
  expires_at          TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX case_offers_case_idx       ON case_offers(case_id);
CREATE INDEX case_offers_technician_idx ON case_offers(technician_id);
-- I3: en fazla 1 accepted
CREATE UNIQUE INDEX case_offers_accepted_per_case
  ON case_offers(case_id) WHERE status = 'accepted';

CREATE TABLE case_offer_badges (
  offer_id UUID NOT NULL REFERENCES case_offers(id) ON DELETE CASCADE,
  label    VARCHAR(64) NOT NULL,
  PRIMARY KEY (offer_id, label)
);

-- =============================================================
-- Appointments
-- =============================================================
CREATE TABLE appointments (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id          UUID NOT NULL REFERENCES service_cases(id) ON DELETE CASCADE,
  technician_id    UUID NOT NULL REFERENCES technicians(id),
  offer_id         UUID REFERENCES case_offers(id) ON DELETE SET NULL,
  slot_kind        appointment_slot_kind NOT NULL,
  slot_date        DATE,
  slot_time_window VARCHAR(32),
  note             TEXT NOT NULL DEFAULT '',
  status           appointment_status NOT NULL DEFAULT 'pending',
  requested_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at       TIMESTAMPTZ NOT NULL,
  responded_at     TIMESTAMPTZ,
  decline_reason   TEXT,
  CHECK (expires_at > requested_at)
);
CREATE INDEX appointments_case_idx       ON appointments(case_id);
CREATE INDEX appointments_technician_idx ON appointments(technician_id);
-- I2: max 1 pending per case
CREATE UNIQUE INDEX appointments_pending_per_case
  ON appointments(case_id) WHERE status = 'pending';

-- =============================================================
-- Attachments + Documents
-- =============================================================
CREATE TABLE case_attachments (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id             UUID NOT NULL REFERENCES service_cases(id) ON DELETE CASCADE,
  kind                case_attachment_kind NOT NULL,
  title               VARCHAR(255) NOT NULL,
  subtitle            VARCHAR(255),
  status_label        VARCHAR(64),
  storage_url         TEXT NOT NULL,
  uploaded_by_user_id UUID NOT NULL REFERENCES users(id),
  uploaded_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX case_attachments_case_idx ON case_attachments(case_id);

CREATE TABLE case_documents (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id        UUID NOT NULL REFERENCES service_cases(id) ON DELETE CASCADE,
  attachment_id  UUID REFERENCES case_attachments(id) ON DELETE SET NULL,
  kind           case_attachment_kind NOT NULL,
  title          VARCHAR(255) NOT NULL,
  subtitle       VARCHAR(255),
  source_label   VARCHAR(64) NOT NULL,
  status_label   VARCHAR(64) NOT NULL DEFAULT 'Yeni',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX case_documents_case_idx ON case_documents(case_id);

-- =============================================================
-- Events (audit log, append-only)
-- =============================================================
CREATE TABLE case_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id     UUID NOT NULL REFERENCES service_cases(id) ON DELETE CASCADE,
  type        case_event_type NOT NULL,
  title       VARCHAR(255) NOT NULL,
  body        TEXT NOT NULL,
  tone        case_tone NOT NULL DEFAULT 'info',
  actor       case_actor,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX case_events_case_time_idx ON case_events(case_id, created_at DESC);

-- =============================================================
-- Threads + Messages
-- =============================================================
CREATE TABLE case_threads (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id                  UUID UNIQUE NOT NULL REFERENCES service_cases(id) ON DELETE CASCADE,
  preview                  VARCHAR(255) NOT NULL DEFAULT '',
  unread_count_customer    INTEGER NOT NULL DEFAULT 0,
  unread_count_technician  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE case_messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id       UUID NOT NULL REFERENCES case_threads(id) ON DELETE CASCADE,
  author_user_id  UUID REFERENCES users(id),
  author_role     case_message_author_role NOT NULL,
  author_name     VARCHAR(128) NOT NULL,
  body            TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX case_messages_thread_time_idx ON case_messages(thread_id, created_at DESC);

CREATE TABLE case_message_attachments (
  message_id     UUID NOT NULL REFERENCES case_messages(id) ON DELETE CASCADE,
  attachment_id  UUID NOT NULL REFERENCES case_attachments(id) ON DELETE CASCADE,
  PRIMARY KEY (message_id, attachment_id)
);

-- =============================================================
-- Approvals
-- =============================================================
CREATE TABLE case_approvals (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id               UUID NOT NULL REFERENCES service_cases(id) ON DELETE CASCADE,
  kind                  case_approval_kind NOT NULL,
  status                case_approval_status NOT NULL DEFAULT 'pending',
  title                 VARCHAR(255) NOT NULL,
  description           TEXT NOT NULL,
  requested_by_user_id  UUID NOT NULL REFERENCES users(id),
  requested_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at          TIMESTAMPTZ,
  amount_label          VARCHAR(64),
  amount_numeric        NUMERIC(12,2),
  action_label          VARCHAR(64),
  service_comment       TEXT
);
CREATE INDEX case_approvals_case_idx ON case_approvals(case_id);

CREATE TABLE case_approval_line_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  approval_id UUID NOT NULL REFERENCES case_approvals(id) ON DELETE CASCADE,
  label       VARCHAR(255) NOT NULL,
  value       VARCHAR(64) NOT NULL,
  note        VARCHAR(255),
  sort_order  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE case_approval_evidence (
  approval_id UUID NOT NULL REFERENCES case_approvals(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES case_documents(id) ON DELETE CASCADE,
  PRIMARY KEY (approval_id, document_id)
);

-- =============================================================
-- Notifications + preferences
-- =============================================================
CREATE TABLE notifications (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind              notification_kind NOT NULL,
  title             VARCHAR(255) NOT NULL,
  body              TEXT NOT NULL,
  route             VARCHAR(255),
  related_case_id   UUID REFERENCES service_cases(id) ON DELETE SET NULL,
  related_offer_id  UUID REFERENCES case_offers(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at           TIMESTAMPTZ
);
CREATE INDEX notifications_user_unread_idx
  ON notifications(user_id) WHERE read_at IS NULL;
CREATE INDEX notifications_user_time_idx
  ON notifications(user_id, created_at DESC);

CREATE TABLE notification_preferences (
  user_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key      notification_preference_key NOT NULL,
  enabled  BOOLEAN NOT NULL DEFAULT true,
  PRIMARY KEY (user_id, key)
);

-- =============================================================
-- Customer-specific state
-- =============================================================
CREATE TABLE favorite_technicians (
  user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  technician_id  UUID NOT NULL REFERENCES technicians(id) ON DELETE CASCADE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, technician_id)
);

CREATE TABLE technician_cooldowns (
  user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  technician_id    UUID NOT NULL REFERENCES technicians(id) ON DELETE CASCADE,
  decline_count    INTEGER NOT NULL DEFAULT 0,
  last_decline_at  TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (user_id, technician_id)
);
```

---

## 11. İndeks ve Kısıt Önerileri

- `service_cases_active_customer` — aktif vaka sorgularını hızlandırır (partial index).
- `notifications_user_unread_idx` — bildirim sayaç rozeti için partial index.
- `case_offers_accepted_per_case` (UNIQUE partial) — I3 invariant'ı.
- `appointments_pending_per_case` (UNIQUE partial) — I2 invariant'ı.
- `case_events_case_time_idx (case_id, created_at DESC)` — event feed pagination.
- `case_messages_thread_time_idx` — mesaj pagination.
- `vehicles_user_idx` — kullanıcının araç listesi.
- Event append-only trigger: `BEFORE UPDATE ON case_events` → `RAISE EXCEPTION`.
- Case updated_at trigger: ilgili tüm mutasyonlarda `UPDATE service_cases SET updated_at = now()` tetikle.
- Cancel cleanup trigger: `AFTER UPDATE ON service_cases WHEN status BECOMES 'cancelled'` → pending appointments + pending approvals cascade update.

---

## 12. Kapsam Dışı / Açık Sorular

### Teknik
- **Dosya storage**: `case_attachments.storage_url` nereye (S3 / Cloudflare R2 / local)? Upload akışı direct-to-bucket (presigned) mi, API-via (multipart) mı?
- **Realtime**: appointment onay, yeni teklif, yeni mesaj — client'a nasıl yansır? FCM push + polling (v1) yoksa WebSocket/SSE (v2)?
- **Matching motoru**: `matching → offers_ready` geçişi hangi servis tarafından tetikleniyor? Arka plan job (cron?), usta app'ten manuel başvuru, admin-assigned?
- **Appointment TTL expire**: şu an client-side setTimeout (mock). Backend cron job (1dk tick) veya event-scheduled tabanlı? Teknoloji tercihi?
- **Technician geo / radius matching**: PostGIS entegrasyonu mi? Basit bounding box mi? v1 için mesafe label client'ta random; v2 gerçek hesap.
- **Draft persistence**: Composer draft şu an client-only. Kullanıcı cihaz değiştirse kaybolur. Backend'de `ServiceRequestDraft` tablosu (henüz submit edilmeden) tutulsun mu? v1 için client-only yeterli.

### Domain
- **Multi-case limit**: Bir aracın aynı anda kaç aktif vakası olabilir? Şu anki model teknik olarak sınırsız; ama UX için 1 öneriyoruz. Enforce edilsin mi (unique partial index)?
- **Offer TTL**: Teklif süresiz mi yoksa TTL'e bağlı mı? v1 süresiz; v2'de ~72h öneri.
- **İptal maliyeti**: "30 gün 3+ iptal" uyarısı ötesinde deposit/credit (escrow) ne zaman?
- **Kind/vehicle değişimi**: Şu an scope dışı (yeni vaka açılıyor). İleride "vaka aynı ama araç değişti" senaryosu var mı?
- **Admin actions**: İhtilaf çözümünde admin hangi alanları override edebilir? `service_cases.status = 'archived'` sadece admin? Refund akışı?

### KVKK / güvenlik
- **PII silme**: User delete → cases CASCADE — ama events/messages'te author_name denormalize, bunlar da anonimleştirilmeli (`"Silinmiş kullanıcı"`).
- **Telefon/email maskeleme**: Usta ↔ müşteri arasında doğrudan paylaşma politikası — `case_threads` şu an tek kanal, DB'de telefon paylaşılmaz.
- **Audit log retention**: Events ve messages ne kadar saklanır? Legal yükümlülük.

---

## 13. Sonraki Adımlar

### 13.1 Müşteri-app finalize (bu sprint)
- [x] Domain tipleri + engine + store + API hooks — mock tamamlandı.
- [x] UI: anasayfa + çarşı + usta profilleri + composer (4 kind) + randevu + vaka yönetim + vaka süreç + bildirimler.
- [ ] (Nice-to-have) Gerçek dosya picker (expo-image-picker).
- [ ] (Nice-to-have) Draft persistence (cihazlar arası).

### 13.2 Usta-app (naro-service-app)
Domain aynı — tipler `packages/domain/src/service-case.ts`'ten paylaşılır. Usta tarafına özel eklemeler:
- **Vaka havuzu** (matching durumundaki case'leri listele, teklif gönder).
- **Teklif oluşturma ekranı** (amount, eta, delivery_mode, warranty, ...).
- **Randevu inbox** (appointments WHERE technician_id=me AND status=pending; approve/decline aksiyonları).
- **Aktif işler** (service_cases WHERE assigned_technician_id=me AND status IN (scheduled, service_in_progress, ...)).
- **Parça/fatura onay talepleri** — `case_approvals` oluşturma UI.
- **Evidence upload** — `case_attachments` + `case_documents` ekleme.
- **Mesajlaşma** — aynı thread.
- **Müsaitlik yönetimi** — `technicians.availability` toggle.
- **Kampanya yönetimi** — `technician_campaigns` CRUD.

Müşteri-app'te olan engine fonksiyonlarının usta yansımaları zaten var (`addTechnicianEvidenceToCase`, `shareTechnicianStatusUpdate`, `requestTechnicianPartsApproval`, `shareTechnicianInvoice`, `markCaseReadyForDelivery`). Bu fonksiyonlar usta-app'te UI'a bağlanır.

### 13.3 Backend migration
Önerilen sıra:
1. **Auth** — users + OTP flow (phone/email → token pair).
2. **Vehicles + technicians** — read-only API (müşteri + usta profile).
3. **Service cases** — create (composer submit), read (detay + liste).
4. **Offers** — technician creates, customer reads.
5. **Appointments** — lifecycle endpoints (request, approve, decline, cancel, expire cron).
6. **Messages + threads** — REST + WebSocket/SSE.
7. **Approvals** — parça/fatura/tamamlama.
8. **Notifications** — push + in-app feed.
9. **Attachments** — upload + storage.
10. **Admin panel** — KYC, ihtilaf, manual matching.

Her adımda Zod şemalarını API DTO olarak direkt kullan (react-query `queryFn`'lerini mock'tan HTTP fetch'e çevir).

### 13.4 Open design documents
Bu doküman üzerine eklenecekler:
- **Matching algoritması spec** — skorlama (distance, rating, specialty match, availability, fiyat tercihi).
- **Bildirim içerik şablonları** — kind bazlı title/body template'leri.
- **Reputation / rating modeli** — review → rating_avg nasıl güncellenir (sliding average? Bayesian?).
- **Payment / escrow** — PlatformTrustCard'daki "koruma altında ödeme" domain karşılığı.

---

> **Son söz**: Bu doküman canlı bir referans. Yeni feature eklerken önce burayı güncelle, sonra kodu. `packages/domain/src/*` ile doküman arasında uyuşmazlık çıkarsa doküman source-of-truth; kod o güne kadarki state.
