# naro-app

Müşteri mobil uygulaması. Expo Router yüzeyi app içinde kalır; auth, storage, api, query ve telemetry bootstrap'ı `@naro/mobile-core` üzerinden gelir.

## Kurulum

```bash
pnpm install
cp .env.example .env
pnpm start
```

Monorepo kökünden çalıştırmak istersen:

```bash
pnpm dev:app
```

Önce `naro-backend` ayakta olmalı. Fiziksel cihazdan testte `EXPO_PUBLIC_API_URL` değerindeki `localhost` yerine makinenin erişilebilir IP'sini ver.

## Çalışma modeli

- `app/`: ince route shell dosyaları
- `src/features/`: müşteriye özel ekranlar ve akışlar
- `src/runtime.ts`: env, storage, auth, api, telemetry wiring
- `src/shared/lib/*`: geriye dönük import yüzeyleri; gerçek implementasyon shared core'dan gelir

## Önemli env değişkenleri

```bash
EXPO_PUBLIC_API_URL=
EXPO_PUBLIC_APP_ENV=development
EXPO_PUBLIC_MOCK_AUTH=true
EXPO_PUBLIC_SENTRY_DSN=
EXPO_PUBLIC_POSTHOG_KEY=
EXPO_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
```

## Komutlar

```bash
pnpm start
pnpm android
pnpm ios
pnpm web
pnpm export:web
pnpm typecheck
pnpm lint
pnpm doctor
```

## EAS

`eas.json` içinde `development`, `preview`, `production` profilleri tanımlıdır. Preview build örneği:

```bash
pnpm exec eas build --platform android --profile preview
```

EAS Update ve production build için Expo projesinin `projectId` ve ilgili environment/secrets değerleri hesapta tanımlanmalıdır.

## Paket kimliği

`com.naro.app`
