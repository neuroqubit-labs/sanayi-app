# 00 — İlkeler ve Konvansiyonlar

Bu dosya, tüm veri modeli dosyalarında geçerli **cross-cutting** kuralları tanımlar. Her domain dosyası bu ilkeleri varsayar.

## Veritabanı

- **PostgreSQL 16** (CLAUDE.md)
- Migration: **Alembic** (domain başına 1 migration — büyük dump değil)
- Async erişim: **SQLAlchemy 2.0** (`[asyncio]`) + `asyncpg`
- DTO: **Pydantic v2** (in/out ayrı Model)

## Naming

| Öğe | Konvansiyon | Örnek |
|---|---|---|
| Tablo | `snake_case`, **çoğul** | `service_cases`, `technician_certificates` |
| Kolon | `snake_case` | `created_at`, `assigned_technician_id` |
| Birincil anahtar | `id`, **UUID** (gen_random_uuid veya Python uuid4) | — |
| Foreign key | `<hedef_entity_tekil>_id` | `vehicle_id` → `vehicles.id` |
| Unique index | `uq_<tablo>_<kolon>[_<kolon>]` | `uq_users_phone` |
| Normal index | `ix_<tablo>_<kolon>` | `ix_service_cases_status` |
| Check constraint | `ck_<tablo>_<açıklama>` | `ck_case_offers_amount_positive` |
| Enum tipi (PG) | `snake_case` tekil | `user_role`, `case_status` |

## Zaman damgaları

Tüm tablolarda standart:

```python
created_at: Mapped[datetime] = mapped_column(
    DateTime(timezone=True), server_default=func.now(), nullable=False
)
updated_at: Mapped[datetime] = mapped_column(
    DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
)
```

`TimestampMixin` kullanılır (`naro-backend/app/db/base.py`).

- **Timezone-aware** (UTC stored). Mobil tarafta TR'ye çevrilir.
- `updated_at` her UPDATE'te otomatik yenilenir (`onupdate=func.now()`).

## Primary key

```python
class UUIDPkMixin:
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
```

Tüm entity UUID PK. Mobil tarafı "id: string" olarak görür.

## Soft delete

Varsayılan: **hard delete yok**. Silme gereken tablolarda:

```python
deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
```

Query katmanında: `where(Model.deleted_at.is_(None))` (repository helper ile).

Soft delete gereken tablolar: `users`, `vehicles`, `service_cases`, `technician_profiles`, `media_assets`, `case_messages` (KVKK silme).

Hard delete (append-only): `case_events`, `otp_codes` (TTL ile).

## Foreign key cascade

| İlişki | OnDelete |
|---|---|
| `vehicles.primary_owner_id` → `users.id` | `RESTRICT` (silinemeyen) |
| `service_cases.vehicle_id` → `vehicles.id` | `RESTRICT` |
| `service_cases.assigned_technician_id` → `users.id` | `SET NULL` |
| `case_offers.case_id` → `service_cases.id` | `CASCADE` |
| `case_messages.thread_id` → `case_threads.id` | `CASCADE` |
| `media_assets.uploaded_by_user_id` → `users.id` | `CASCADE` (mevcut) |
| `technician_certificates.media_asset_id` → `media_assets.id` | `SET NULL` |

Prensip: **alt kayıtlar cascade**, **ana entity'lere referans RESTRICT** (yanlışlıkla silmeyi engeller).

## Enum tipleri

Mobilde `z.enum([...])` olanlar backend'de **PG ENUM** + Python `StrEnum`:

```python
class UserRole(StrEnum):
    CUSTOMER = "customer"
    TECHNICIAN = "technician"
    ADMIN = "admin"

role: Mapped[UserRole] = mapped_column(
    SAEnum(UserRole, name="user_role"), nullable=False
)
```

Enum uzaması migration gerektirir (`ALTER TYPE ... ADD VALUE`). Alembic'te **add-only**; rollback mümkün değildir, domain-başına enum `create_type=False` + explicit `.create(bind)` pattern'i kullanılır (mevcut migration bu pattern'de).

## JSONB kullanımı

**Kullan**:
- **Snapshot**: `service_cases.request_draft` — vaka açılışındaki tam ServiceRequestDraft (60+ alan) — geleceği değiştirmez
- **Değişken kapsamlı liste**: `case_offers.badges`, `case_approvals.line_items`, `appointments.slot`
- **Audit context**: `case_events.context` — ek metadata

**Kullanma**:
- Düzenli sorgulanacak alan (where clause) → normalize et
- FK ilişkisi gerektiren → normalize et

**Index**: `GIN` index JSONB üzerinde sık sorgulanan path için:
```sql
CREATE INDEX ix_cases_request_draft_breakdown_category
ON service_cases USING gin ((request_draft->'breakdown_category'));
```

## Validation

### İki katman
1. **DB constraint** (NOT NULL, UNIQUE, CHECK, FK) — her zaman
2. **Pydantic** (mobilde `zod` karşılığı) — API sınırında

Örnek: Telefon formatı Pydantic'te regex; DB'de sadece `UNIQUE` + `VARCHAR(32)`.

### Check constraint örnekleri
```sql
CHECK (amount > 0)
CHECK (status IN ('pending','active','suspended'))  -- enum varsa gereksiz
CHECK (expires_at > requested_at)
```

## Indexes — genel prensipler

- FK'lere otomatik index (çoğu çerçeve yapar; SQLAlchemy varsayılan PK/UQ; FK için manuel `index=True`)
- Foreign key + filtre kombinasyonu → composite: `(status, kind, created_at DESC)` gibi
- Case-insensitive arama → `lower(plate)` functional index veya `citext`
- Türkçe tam-metin arama → `tsvector` generated column + `GIN`
- Kısmi index: `WHERE deleted_at IS NULL` (active-only queries)

## Migration prensipleri

1. **Her domain ayrı migration** — aynı anda 20 tablo yaratma
2. **Idempotent** — `inspector.has_table(...)` check (mevcut pattern)
3. **Rollback güvenli** — her `upgrade()` için `downgrade()` tersini yapar
4. **Enum `create_type=False`** + explicit `.create(bind, checkfirst=True)` (mevcut pattern)
5. **Data migration ayrı** — şema + veri aynı migration'da olmaz (ayrı dosya)

## i18n / lokasyon

- DB'de **dil bağımlılığı yok** — string ID veya enum key saklanır; çeviri UI tarafında
- Tarih: UTC; TR formatlama mobilde `toLocaleDateString("tr-TR")`
- Telefon: E.164 (`+905XXXXXXXXX`)
- Plaka: büyük harf + boşluksuz normalize ayrı kolonda (`plate_normalized`)

## PII (Kişisel Veri)

- Telefon, email, ad-soyad → `users` tablosunda
- Vaka içinde müşteri-usta arası iletişim → **maskelenmiş** — direkt telefon görünmez
- Thread-only mesajlaşma; gerçek iletişim bilgisi view / masking layer ile
- KVKK silme isteği → soft delete + 30 gün sonra hard delete job (ARQ)

Detay: [14-anti-disinter.md](14-anti-disinter.md), [15-kvkk-retention.md](15-kvkk-retention.md).

## Audit log

Vaka üzerinde yapılan her anlamlı işlem `case_events` tablosuna düşer:
- Teklif gönderildi / kabul edildi / reddedildi
- Randevu oluşturuldu / onaylandı
- Parça onayı istendi / verildi
- Belge eklendi
- Status değişti

Append-only; `actor_user_id`, `type`, `tone`, `body`, `context JSONB`, `created_at`.

Detay: [12-event-log.md](12-event-log.md).

## Yeni domain eklerken checklist

- [ ] `docs/veri-modeli/NN-<domain>.md` dosyası yaz
- [ ] DDL iskelet + Mermaid ERD ekle
- [ ] State makinesi varsa diyagram
- [ ] `app/models/<domain>.py` — SQLAlchemy
- [ ] `app/schemas/<domain>.py` — Pydantic in/out
- [ ] `app/repositories/<domain>.py` — query helpers
- [ ] `alembic/versions/NNNN_<domain>.py` — upgrade + downgrade
- [ ] `tests/test_<domain>.py` — happy + edge
- [ ] `alembic upgrade head && alembic downgrade -1 && alembic upgrade head` yeşil
- [ ] README'de domain haritasına ekle
