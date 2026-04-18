# naro-backend

Naro platformunun API'si ve iş mantığı. FastAPI + PostgreSQL + Redis.

## Hızlı başlangıç (Docker)

```bash
cp .env.example .env
docker compose up --build
```

- API:        http://localhost:8000
- Dokümanlar: http://localhost:8000/api/v1/docs
- OpenAPI:    http://localhost:8000/api/v1/openapi.json

Sağlık kontrolü:

```bash
curl http://localhost:8000/api/v1/health
```

## Migration

İlk migration'u oluşturmak:

```bash
docker compose exec api alembic revision --autogenerate -m "initial"
docker compose exec api alembic upgrade head
```

## Yerel geliştirme (Docker'sız, opsiyonel)

```bash
uv venv
source .venv/bin/activate
uv pip install -e ".[dev]"
# .env içinde POSTGRES_HOST=localhost, REDIS_HOST=localhost yap
uvicorn app.main:app --reload
```

## Dizin yapısı

```
app/
├── main.py              FastAPI app factory
├── core/                config, security (JWT), logging
├── db/                  SQLAlchemy async engine + Base
├── models/              ORM modelleri
├── schemas/             Pydantic DTO'lar
├── api/v1/              versiyonlu HTTP katmanı
│   ├── router.py        ana router
│   ├── deps.py          FastAPI dependency'leri
│   └── routes/          endpoint grupları
├── services/            iş mantığı (OTP, matching, vb.)
├── repositories/        veri erişim katmanı
├── integrations/
│   └── sms/             SmsProvider interface + Twilio/Console
└── workers/             ARQ background jobs
alembic/                 migration'lar
tests/                   pytest
```

## OTP akışı

1. `POST /api/v1/auth/otp/request` — telefon/email + rol (customer/technician)
2. SMS sağlayıcı kodu iletir. Dev'de (`SMS_PROVIDER=console`) kod backend log'unda görünür.
3. `POST /api/v1/auth/otp/verify` — kullanıcı pin'i girer, access + refresh token döner.

Usta (technician) kullanıcıları `pending` statüsünde oluşturulur; KYC/onay akışı sonra eklenecek.

## Lint & test

```bash
docker compose exec api ruff check .
docker compose exec api mypy app
docker compose exec api pytest
```
