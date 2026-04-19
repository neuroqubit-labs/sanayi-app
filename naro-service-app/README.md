# naro-service-app

Servis sağlayıcı mobil uygulaması. Customer app ile aynı shared runtime omurgasını kullanır; approval/onboarding akışları app'e özeldir.

## Kurulum

```bash
pnpm install
cp .env.example .env
pnpm start
```

Monorepo kökünden:

```bash
pnpm dev:service
```

Backend erişimi için `EXPO_PUBLIC_API_URL` değerini cihazın görebileceği hosta ayarla.

## Çalışma modeli

- `app/`: auth, onboarding ve tabs route shell'leri
- `src/features/`: servis sağlayıcıya özel ekranlar
- `src/runtime.ts`: env, auth/session, telemetry ve query wiring
- `bootstrapState`: `anonymous | authenticated | blocked | hydrating`

## Onboarding akışı

1. Login
2. OTP verify
3. Pending approval ekranı
4. Admin onayı sonrası tabs erişimi

Mock modda bu akış `EXPO_PUBLIC_MOCK_APPROVAL=pending|active|suspended` ile taklit edilir.

## Env değişkenleri

```bash
EXPO_PUBLIC_API_URL=
EXPO_PUBLIC_APP_ENV=development
EXPO_PUBLIC_MOCK_AUTH=true
EXPO_PUBLIC_MOCK_APPROVAL=active
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

`eas.json` içinde `development`, `preview`, `production` profilleri hazırdır:

```bash
pnpm exec eas build --platform android --profile preview
```

Gerçek EAS Update/submit kullanımı için Expo hesabında proje eşlemesi ve environment secrets tanımlanmalıdır.

## Paket kimliği

`com.naro.service`
