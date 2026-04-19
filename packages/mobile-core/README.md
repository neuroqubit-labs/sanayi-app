# @naro/mobile-core

Naro mobil platformunun ortak runtime katmanı. `naro-app` ve `naro-service-app` içindeki tekrar eden bootstrap, auth, storage, query ve observability kodlarını burada toplar.

## Sorumluluklar

- `env`: Expo public env parse + Zod doğrulama
- `storage`: web fallback'li güvenli storage adapter'ları
- `session` ve `auth`: token saklama, hydrate, bootstrap state üretimi
- `api`: timeout, auth header, request id ve normalize `ApiError`
- `query`: ortak TanStack Query varsayılanları
- `network`: online/focus manager bootstrap
- `telemetry` ve `posthog`: Sentry + PostHog adapter yüzeyi
- `bootstrap`: app başlangıç provider wiring'i

## Ana kontratlar

- `StorageAdapter`
- `EnvSchema`
- `createApiClient(config)`
- `createAuthStore(config)`
- `TelemetryAdapter`
- `FeatureFlagAdapter`
- `resolveBootstrapHref(options)`

## Kullanım

```ts
import {
  createApiClient,
  createAuthStore,
  createPlatformStorageAdapter,
  createQueryClient,
  createSessionRepository,
} from "@naro/mobile-core";
```

App tarafında business-flow farkları burada tutulmaz. Rol, onboarding, route guard ve ekran kompozisyonu app içinde kalır; runtime altyapısı bu pakette yaşar.
