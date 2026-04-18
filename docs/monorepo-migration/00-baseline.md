# Faz 0 — Baseline

Migration öncesi repo durumunun snapshot'ı. Faz 1+ uygulandıkça bu dosyadaki davranışın korunduğu bir referans olarak kullanılır. Sapma olursa bu dosya + [00-baseline-file-hashes.txt](00-baseline-file-hashes.txt) karşılaştırılır.

## Snapshot tarihi
2026-04-17

## Git durumu (snapshot anı)
- Branch: `main`
- Son commit: `54ba8e5 — İlk commit: Sanayi App - Bina yönetim platformu`
- `naro-app/`, `naro-service-app/`, `naro-backend/`, `docs/` **untracked** (git'e henüz eklenmemiş). [.gitignore](../../.gitignore) değişmiş, [legacy/](../../legacy/) altındaki eski prototipler deleted/renamed durumda.

## Paket yöneticisi
- Şu an her app klasörü **bağımsız** (`npm install` ya da elle). Kök `package.json` yok, lockfile yok.

## App kimlikleri
| Alan | naro-app | naro-service-app |
|---|---|---|
| Expo `name` | Naro | Naro Service |
| `slug` | naro-app | naro-service-app |
| `scheme` | naro | naroservice |
| iOS bundle | com.naro.app | com.naro.service |
| Android package | com.naro.app | com.naro.service |
| Brand rengi | mavi (`#0ea5e9` ailesi) | turuncu (`#ef6c4a` ailesi) |
| Plugins | expo-router, expo-secure-store | expo-router, expo-secure-store, expo-image-picker, expo-document-picker |
| `newArchEnabled` | true | true |

## Stack (iki app ortak)
Expo SDK 52 (`~52.0.0`) + React 18.3.1 + React Native 0.76.0 + Expo Router 4.0 + TypeScript + NativeWind 4.1 + TailwindCSS 3.4 + TanStack Query 5.59 + Zustand 5.0 + Zod 3.23 + React Hook Form 7.53 + `@hookform/resolvers` 3.9 + `expo-secure-store` 14.0.

**Sadece naro-service-app:** `expo-document-picker` ~13.0, `expo-image-picker` ~16.0.

## Dev script'leri (her iki app'ta özdeş)
- `start` → `expo start`
- `android` / `ios` / `web`
- `lint` → `eslint .` (ama **ESLint config dosyası yok** — şu an `lint` çalıştırılırsa hata verir ya da hiçbir şey yapmaz)
- `typecheck` → `tsc --noEmit`
- `format` → prettier

## Config notları
- `metro.config.js` her iki app'ta **özdeş** (hash `50bf1818503fa307`): Expo default + `withNativeWind({ input: "./global.css" })`. Monorepo-aware değil (watchFolders/nodeModulesPaths yok).
- `babel.config.js` özdeş (hash `bfab7dc5cc4cde21`): `babel-preset-expo` + `nativewind/babel`.
- `tsconfig.json` özdeş (hash `91176c221f08399a`): strict, `noUncheckedIndexedAccess`, path alias `@/* → ./src/*`, `@/app/* → ./app/*`.
- `tailwind.config.js` iki app'ta farklı (mavi vs turuncu brand), content path'leri `./app/**` + `./src/**`.
- `global.css` özdeş (hash `cc1a7ad0d019ddb1`).

## Duplicate dosyalar (birebir aynı hash)
- [naro-app/src/shared/lib/api.ts](../../naro-app/src/shared/lib/api.ts) ↔ [naro-service-app/src/shared/lib/api.ts](../../naro-service-app/src/shared/lib/api.ts) → `068fcb985d06e342`
- [naro-app/src/shared/lib/query.ts](../../naro-app/src/shared/lib/query.ts) ↔ [naro-service-app/src/shared/lib/query.ts](../../naro-service-app/src/shared/lib/query.ts) → `7280d42af057edbb`
- [naro-app/src/shared/lib/storage.ts](../../naro-app/src/shared/lib/storage.ts) ↔ [naro-service-app/src/shared/lib/storage.ts](../../naro-service-app/src/shared/lib/storage.ts) → `ed571e004f31fc58`
- `app/(auth)/_layout.tsx` (`ec03cd29223ad026`), `app/_layout.tsx` (`8118e78351890536`), `app/(tabs)/profile.tsx` (`2e0d146436cf151d`) — tamamı iki app'ta aynı

## Benzer ama farklı
- `src/services/auth/api.ts` — role değeri hardcode (customer vs technician), bu yüzden farklı hash. Faz 3'te `@naro/domain` içindeki ortak tip + role parametresine çıkarılacak.
- `src/services/auth/store.ts` — benzer, ama servis app ekstra `pending` status mantığı içerir.
- `src/shared/ui/Button.tsx` — brand renk farkı nedeniyle farklı hash. Faz 4'te `@naro/ui` içine alınır.

## Akış (elle doğrulanacak referans davranış)
Baseline'ın kurulmuş sayılması için aşağıdaki akış her iki app'ta çalışır durumda olmalı:

1. `expo start` → dev server açılır.
2. Müşteri app:
   - ilk açılışta `app/(auth)/login.tsx` (telefon girişi)
   - OTP gönderilir → `app/(auth)/verify.tsx`
   - doğrulama sonrası → `app/(tabs)/index.tsx` (placeholder)
3. Servis app:
   - aynı auth akışı
   - ek olarak teknisyen `pending` ise → `app/(onboarding)/pending.tsx`
   - onaylandıktan sonra → `app/(tabs)` (index / profile / earnings)

**Not:** Bu akışın fiziksel testi (simülatör/gerçek cihaz) Faz 1 sonrasında yapılacak. Faz 0 sadece kod referansını donduruyor.

## Migration sonrası regresyon kontrolü
Faz 1+ uygulandıkça:
- [00-baseline-file-hashes.txt](00-baseline-file-hashes.txt) içindeki DOSYA SİLİNDİYSE beklenen bir silme olduğu her fazın "Dosyalar (silinecek)" listesinden doğrulanır.
- DOKUNULMAMASI gereken dosyalar (örn. Faz 1'de `app/(auth)/login.tsx` değişmemeli) için hash eşitliği kontrol edilir.
- Bundle id, scheme, brand rengi, `newArchEnabled` Faz 1–5 boyunca **sabit kalmalı**.
