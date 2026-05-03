# Naro Müşteri Uygulaması (`naro-app`)

Araç sahibi bireysel kullanıcı için RN/Expo app. Vaka açan, takip eden, ödeyen taraf.

## Stack
- React Native 0.76 + Expo 52
- TypeScript (strict)
- NativeWind (Tailwind utility)
- Expo Router (`app/` file-based routing)
- Zustand (client state) + TanStack Query (server state) + Zod (domain validation)

## Yapı
- [app/](app/) — Expo Router routing.
  - `(auth)/`, `(onboarding)/`, `(tabs)/`, `(modal)/`, `vaka/[id]/`, `cekici/[id]/` …
- [src/features/](src/features/) — feature-bazlı kod (cases, tow, billing, ustalar, …).
- [src/shared/](src/shared/) — cross-feature paylaşılanlar (api, hooks, components, store).

## Test Gate
```bash
pnpm --filter naro-app exec tsc --noEmit
pnpm --filter naro-app exec eslint .
```

Kapanış öncesi `/fe-check` + `/smoke` (cihaz davranış kanıtı).

## Personalar (UI tasarım kararı verirken)
- Panik/kaza anındaki sürücü — tek-buton, stressiz akış, büyük dokunma alanı.
- Aracını tanımayan kullanıcı — terminoloji yerine görsel + rehberli sihirbaz.

## Mock-First Disiplini
Yeni feature: önce mock/fixture ile uçtan uca akış oturur → akış stabilize olunca `@naro/domain` şemaları ekrandan türetilir → backend domain şemalardan türetilir. Mock dosyaları `*.mock.ts` veya `src/features/*/fixtures/`.

## Ekran State'i
Her ekran üç path: **loading + empty + error**. Eksik path = P1 audit bulgusu. Network failure UX (offline + 5xx) anlamlı mesajla bildirilir.

## Naming
Sözlük ([docs/naro-domain-glossary.md](../docs/naro-domain-glossary.md)) tek kaynak. Yasak terimler (UI/domain): `extra_payment`, `additional_payment`, `additional_amount`, `bid`.
