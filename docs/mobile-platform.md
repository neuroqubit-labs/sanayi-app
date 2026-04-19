# Mobile Platform

Naro mobil altyapısı iki ayrı Expo uygulaması üzerine kurulu:

- `naro-app`: müşteri deneyimi
- `naro-service-app`: servis sağlayıcı deneyimi

İki uygulama mağaza kimliği, navigation ağacı ve ürün akışları açısından ayrı kalır. Ortak runtime katmanları ise workspace paketleri üzerinden paylaşılır.

## Paket sınırları

- `packages/mobile-core`: env, storage, auth/session, api client, query, telemetry, bootstrap
- `packages/ui`: ortak tasarım sistemi primitive'leri
- `packages/domain`: domain tipleri ve ortak şemalar
- `packages/config`: metro, babel, tailwind ve tsconfig üreticileri

## Bootstrap akışı

1. App `_layout` yalnızca provider wiring yapar.
2. `useInitializeApp` network manager, telemetry, feature flags ve auth hydrate adımlarını başlatır.
3. `resolveBootstrapHref` app başlangıç rotasını `hydrating | anonymous | authenticated | blocked` durumlarından üretir.

## Env ve observability

- Tüm public env değişkenleri Zod ile parse edilir.
- Sentry crash/error reporting için shared telemetry adapter üzerinden bağlanır.
- PostHog analytics ve feature flag runtime'ı shared adapter üzerinden bağlanır.
- Web yalnızca geliştirme smoke yüzeyi olarak desteklenir.

## Release hattı

- Her app kendi `eas.json` dosyasına sahiptir.
- Profiller: `development`, `preview`, `production`
- Kanallar: `development`, `preview`, `production`
- PR kalite kapısı: install, lint, typecheck, test, expo-doctor, web export smoke
- `main` branch: Android preview build tetiklenir

## Ekip kuralları

- Root komutları için tek doğrusu `pnpm`
- Route dosyaları thin shell kalır; business logic `src/features` veya shared runtime içinde yaşar
- Hiçbir feature doğrudan `expo-secure-store` import etmez
- Auth, api ve telemetry sözleşmeleri `packages/mobile-core` dışına kopyalanmaz
