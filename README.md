# Naro

Araç servis eşleştirme platformu. Üç bağımsız proje tek repoda tutulur; her birinin kendi toolchain'i, kendi build/test akışı vardır. İleride ayrı GitHub repolarına bölmek isterseniz `git subtree split` ile mümkündür.

## Yapı

```
.
├── naro-app/              Müşteri mobil uygulaması  (React Native + Expo + TS)
├── naro-service-app/      Usta mobil uygulaması     (React Native + Expo + TS)
├── naro-backend/          API + iş mantığı          (FastAPI + Postgres + Redis)
├── docs/                  Ürün tasarımı, mimari notlar, feature dokümanları
└── legacy/                Eski web prototipi (referans — yeni kodda kullanılmaz)
```

## Başlangıç

Her alt projenin kendi README'si kurulumu ve komutları açıklar:

- [naro-backend/README.md](naro-backend/README.md) — Docker Compose ile ayağa kalkar
- [naro-app/README.md](naro-app/README.md) — Expo ile başlar
- [naro-service-app/README.md](naro-service-app/README.md) — Expo ile başlar

## Teknoloji

| Alan | Seçim |
|---|---|
| Mobil | React Native + Expo (SDK 52+), TypeScript, NativeWind, expo-router, TanStack Query, Zustand, Zod |
| Backend | FastAPI, Python 3.12, SQLAlchemy 2.x (async), Alembic, Pydantic v2, ARQ (Redis job queue) |
| DB | PostgreSQL 16 |
| Cache / Queue | Redis 7 |
| SMS | Twilio (abstract `SmsProvider` interface — dev'de console'a basar) |
| Auth | JWT, OTP tabanlı (email/SMS) |
| Paket | npm (mobil), uv (backend) |
| Lint / Format | ESLint + Prettier (mobil), Ruff + mypy (backend) |

## Legacy

`legacy/` eski web prototipini barındırır. Yeni mobil app'ler geliştirilirken ekran tasarımları buradan referans alınır. Zamanla küçültülüp kaldırılacaktır.
