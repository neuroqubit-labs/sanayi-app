# @naro/ui

NativeWind tabanlı design system primitifleri. İki app (müşteri + servis) bu paketi paylaşır. Renk token'ları (brand) app-seviye kalır — UI paketi renk bilmez, `bg-brand-600` gibi semantic class'lar kullanır, app'ın `tailwind.config.js`'i değeri çözer.

## Primitifler

- `Button` — variant: `primary | secondary | ghost | danger`, size: `sm | md | lg | xl`
- `Text` — variant: `h1 | h2 | h3 | body | caption`, tone: `panic | calm | neutral | muted`
- `Input` — label / error / helper prop'ları, RHF uyumlu
- `FormField` — RHF `Controller` + `Input` wrapper
- `Screen` — SafeArea + padding + opsiyonel scroll wrapper
- `Icon` — lucide-react-native wrapper
- `Avatar` — initial fallback

## Persona notları

- **Panik anındaki sürücü:** `Button.size="xl"` + `Text.tone="panic"`.
- **Okuma-yazması zayıf usta:** İkonik butonlar, `Button.size="xl"` (min 56dp), sesli bildirim (Faz 8).
- **Sanayi bilmeyen kullanıcı:** `Screen` scroll + görsel + caption tone calm.

## Kullanım

App'ın `tailwind.config.js`'inde content path'e UI paketi eklenmeli:

```js
content: [
  "./app/**/*.{js,jsx,ts,tsx}",
  "./src/**/*.{js,jsx,ts,tsx}",
  "../packages/ui/src/**/*.{js,jsx,ts,tsx}",
]
```

Unutulursa className'ler JIT'e girmez, stil sessizce çalışmaz.
