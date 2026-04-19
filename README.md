# Naro

Araç servis eşleştirme platformunun monorepo'su. Mobil tarafta iki ayrı Expo uygulaması aynı tasarım sistemi ve aynı runtime omurgasını paylaşır; backend ise ayrı servis olarak yaşar.

## Monorepo yapısı

```text
.
├── naro-app/              Müşteri mobil uygulaması
├── naro-service-app/      Servis sağlayıcı mobil uygulaması
├── naro-backend/          FastAPI tabanlı API
├── packages/
│   ├── config/            Paylaşılan Expo / TS / Tailwind konfigürasyonu
│   ├── domain/            Ortak domain tipleri ve şemaları
│   ├── mobile-core/       Auth, storage, api, query, telemetry, bootstrap
│   └── ui/                Ortak NativeWind UI primitive'leri
└── docs/                  Mimari ve ürün dokümantasyonu
```

## Hızlı başlangıç

```bash
pnpm install
cp naro-app/.env.example naro-app/.env
cp naro-service-app/.env.example naro-service-app/.env
pnpm dev:app
```

Backend ile birlikte çalışmak için ayrıca [naro-backend/README.md](naro-backend/README.md) içindeki kurulumun tamamlanmış olması gerekir. Fiziksel cihazdan testte `EXPO_PUBLIC_API_URL` için `localhost` yerine makinenin erişilebilir IP'sini kullanın.

## Mobil platform prensipleri

- İki ayrı app korunur: müşteri ve servis sağlayıcı farklı store kimliği ve navigation ile yaşar.
- Ortak runtime kodu `packages/mobile-core` içinde tutulur.
- Route dosyaları thin shell kalır; business logic `src/features` altında yaşar.
- Web yalnızca geliştirme smoke yüzeyi olarak desteklenir.
- Observability için Sentry ve PostHog shared adapter katmanından bağlanır.

Detaylı mimari notlar için [docs/mobile-platform.md](docs/mobile-platform.md) dosyasına bakın.

## Komutlar

```bash
pnpm dev:app          # müşteri uygulaması
pnpm dev:service      # servis sağlayıcı uygulaması
pnpm lint
pnpm typecheck
pnpm test
pnpm doctor
pnpm ci:mobile
```

## CI ve release hattı

- Pull request kalite kapısı: install, lint, typecheck, test, expo-doctor, web export smoke
- `main` branch: iki app için Android preview build tetiklenir
- EAS profilleri her app içinde `development`, `preview`, `production` olarak tanımlıdır

## Alt proje dokümanları

- [naro-app/README.md](naro-app/README.md)
- [naro-service-app/README.md](naro-service-app/README.md)
- [naro-backend/README.md](naro-backend/README.md)
- [packages/config/README.md](packages/config/README.md)
- [packages/mobile-core/README.md](packages/mobile-core/README.md)
