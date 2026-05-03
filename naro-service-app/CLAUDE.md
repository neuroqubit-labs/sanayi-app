# Naro Servis Uygulaması (`naro-service-app`)

Servis sağlayıcı (atölye usta, çekici operatör, oto parçacı, bakımcı, motorcu, sanayi ustası) için RN/Expo app. Tek app, role'a göre odak.

## Stack
- React Native 0.76 + Expo 52
- TypeScript (strict)
- NativeWind, Expo Router, Zustand, TanStack Query, Zod
- expo-document-picker, expo-image-picker (belge/foto upload)

## Yapı
- [app/](app/) — Expo Router routing.
- [src/features/](src/features/) — feature-bazlı (jobs, tow, profile, onboarding, ...).
- [src/shared/](src/shared/) — cross-feature paylaşılanlar.

## Test Gate
```bash
pnpm --filter naro-service-app exec tsc --noEmit
pnpm --filter naro-service-app exec eslint .
```

Kapanış öncesi `/fe-check` + `/smoke`.

## Personalar
- Okuma-yazması zayıf usta — minimum metin, ikon + ses + büyük dokunma alanları.
- Çekici operatörü saha şartlarında — eldiven/güneş, hızlı dispatch onayı.

## Role Çeşitliliği
Tek app, çoklu rol. Role bazlı feature gating `src/features/profile/role/` altında. Rol özel ekranlar `src/features/<role>/screens/` veya `app/<role>/`.

## Naming
Sözlük ([docs/naro-domain-glossary.md](../docs/naro-domain-glossary.md)) tek kaynak. Yasak terimler aynı (UI/domain): `extra_payment`, `additional_payment`, `additional_amount`, `bid`.
