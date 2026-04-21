# PostGIS Migration Runbook

## Bağlam

Faz 10a, `naro-backend` postgres imajını `postgres:16-alpine` → `postgis/postgis:16-3.4-alpine` değiştirdi.
Dev ortamında volume reset ile ilerlendi (sentetik veri). Staging/prod'da **volume reset yapılamaz**;
aşağıdaki prosedür mevcut veriyi koruyarak PostGIS extension'ı ekler.

## Dev (sıfırlanabilir)

```bash
docker compose down postgres
docker volume rm naro-backend_postgres-data
docker compose up -d postgres
# alembic upgrade head → 0017 CREATE EXTENSION postgis otomatik çalışır
```

## Staging / Prod (zero-downtime upgrade)

### 1. Backup (PITR + pg_dump)

```bash
pg_dump \
  --host=$POSTGRES_HOST \
  --username=$POSTGRES_USER \
  --dbname=$POSTGRES_DB \
  --format=custom \
  --file=naro-$(date -u +%Y%m%d-%H%M).dump \
  --jobs=4
```

PITR WAL archive aktif (standby replica ile). Dump sağ salim değilse rollback aktif.

### 2. PostGIS image'a switch + extension

Seçenek A — aynı Postgres sürümü + PostGIS extension yükle:

```sql
-- Superuser (postgres) ile
CREATE EXTENSION IF NOT EXISTS postgis;
SELECT extversion FROM pg_extension WHERE extname='postgis';
```

Seçenek B — imajı değiştir:

1. Staging replica'yı yeni image ile kaldır (`postgis/postgis:16-3.4`).
2. Replica initdb yaparken `POSTGIS_VERSION=3.4` + CREATE EXTENSION template1'de otomatik.
3. Primary'de manuel `CREATE EXTENSION postgis` → replication lag sıfıra inince failover.
4. Eski primary'yi yeni image'a güncelle → başka replica yap.

**Öneri**: Seçenek A (mevcut cluster'a extension yükle) risk düşük. Binary'ler container'da hazır olduğu sürece bir kez `CREATE EXTENSION` yeter.

### 3. Migration uygula

```bash
cd naro-backend
alembic upgrade head  # 0017 + 0018 + 0019 apply
```

0017 `CREATE EXTENSION IF NOT EXISTS postgis` idempotent.

### 4. Smoke test

```sql
-- Version & functions
SELECT postgis_full_version();

-- Generated column populate
SELECT count(*) FROM service_cases WHERE pickup_location IS NOT NULL;

-- Partial GIST index exist
SELECT indexname FROM pg_indexes
WHERE tablename='technician_profiles' AND indexname='ix_tech_profiles_tow_hot_pool';

-- Partitioning alive
SELECT inhrelid::regclass FROM pg_inherits
WHERE inhparent = 'tow_live_locations'::regclass;
```

### 5. Rollback

PostGIS extension bilinen bir bağımlılık oluşturduysa (generated columns `geography` döndürür), extension'ı drop etmeden önce:

```sql
ALTER TABLE service_cases DROP COLUMN pickup_location, DROP COLUMN dropoff_location;
ALTER TABLE technician_profiles DROP COLUMN last_known_location;
DROP TABLE tow_live_locations CASCADE;
DROP EXTENSION postgis;
```

veya `alembic downgrade 20260422_0016` → tüm Faz 10 objeleri reversible şekilde kalkar.

### 6. Monitoring

- `pg_stat_user_tables` — `tow_live_locations_YYYYMMDD` leaf'lerinde autovac freq.
- `/metrics` → `naro_tow_partition_count` gauge (Faz 10f, Prometheus scrape).
- GIST index scan ratio: `SELECT idx_scan FROM pg_stat_user_indexes WHERE indexname='ix_tech_profiles_tow_hot_pool';`

## Replikasyon

PostGIS extension replica'ya WAL ile kendiliğinden ulaşır — binary on standby olmak şartıyla. Replica'da ayrıca `CREATE EXTENSION` çağırmayın.

## Uyarılar

- `postgis` 3.4 → 3.5 upgrade için `ALTER EXTENSION postgis UPDATE`; minor versiyonlar transparent.
- Generated column (`pickup_location`) `STORED` — disk kullanımı artar (~32 byte/row). Planlı.
- `geography(Point, 4326)` = 4326 SRID WGS84; TR enlem-boylamı metre-bazlı ST_Distance doğru çalışır.
