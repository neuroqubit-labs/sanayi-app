# Naro Backend (`naro-backend`)

FastAPI mono — iki mobil app için ortak servis. Async SQLAlchemy 2.x + Alembic + Pydantic v2 + ARQ worker.

## Stack
- Python 3.12, FastAPI, async SQLAlchemy
- PostgreSQL 16 + Redis 7
- Alembic migration, ARQ background job
- JWT + OTP auth
- pytest + ruff (lint)

## Yapı
- [app/models/](app/models/) — SQLAlchemy ORM.
- [app/schemas/](app/schemas/) — Pydantic input/output.
- [app/repositories/](app/repositories/) — query/write katmanı.
- [app/services/](app/services/) — iş mantığı.
- [app/api/](app/api/) — FastAPI router.
- [app/integrations/](app/integrations/) — PSP, SMS, push, vb.
- [alembic/versions/](alembic/versions/) — migration history.
- [tests/](tests/) — pytest.

## Test Gate
```bash
cd naro-backend
uv run ruff check
uv run pytest tests/
uv run alembic upgrade head   # sadece migration değiştiyse
```

Üçü yeşil olmadan PR/refactor kapanmaz. Komut: `/be-test`.

## Schema-First Sıra
Model → schema → repository → service → router. Yeni endpoint için: önce şema, sonra repository (PII mask, state guard), sonra service (audit event append), sonra router (admission_gate_passed check, role guard).

## Invariant Disiplini (zorunlu)
Her PR/refactor için [docs/backend-is-mantigi-hiyerarsi.md](../docs/backend-is-mantigi-hiyerarsi.md) §16 (15 invariant) + §17 (10 red flag kategori) self-check. Lokal doğru ama global yanlış kararları (PII mask unutulması, state transition race, audit event eksik append, terminal state mutation) mekanik yakala.

Subagent: `backend-invariant`. Slash: `/audit` (BE değişiklik varsa otomatik tetikler).

## Migration Disiplini
- Tek alembic head; paralel branch için `merge` revision şart.
- Destructive migration (DROP, NOT NULL): önce nullable + deploy + backfill + sonra NOT NULL ayrı migration.
- Migration dosyasında `# why:` tek satır not.

## Yasaklı Terimler (backend)
- `direct_request` (appointment source) — sözlüğe bak.
