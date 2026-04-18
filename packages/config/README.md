# @naro/config

Paylaşılan konfigürasyon preset'leri. App'lar bu paketi `workspace:*` olarak devDependency'e alır ve kendi config dosyalarından bağlar.

## TypeScript

```jsonc
// app/tsconfig.json
{
  "extends": "@naro/config/tsconfig.base.json",
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["**/*.ts", "**/*.tsx", ".expo/types/**/*.ts", "expo-env.d.ts", "nativewind-env.d.ts"]
}
```

`tsconfig.base.json` kendisi `expo/tsconfig.base` zincirini kurar; böylece Expo'nun JSX / module ayarları korunur, ortak katkılar (strict, noUncheckedIndexedAccess, moduleResolution bundler) üstüne eklenir.

## Tailwind

```js
// app/tailwind.config.js
module.exports = {
  presets: [require("@naro/config/tailwind.preset")],
  content: ["./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}", "../packages/ui/src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: { 50: "#...", 500: "#...", 600: "#...", 900: "#..." },
      },
    },
  },
};
```

Preset `nativewind/preset`'i kendi içinde barındırır — app'ta ayrıca listeleme.

Brand renkleri app-özel; preset'te sabit renk yok.

Content path'leri app'ın kendi config'inde; preset'te content tanımlamak yanlış dizinleri tarar.

## ESLint (flat config, v9)

```js
// app/eslint.config.js
module.exports = require("@naro/config/eslint-preset");
```

`eslint-config-expo` v8 hâlâ legacy formatta; preset `@eslint/compat` + `FlatCompat` ile flat formata çeviriyor. App tarafında ek kurala gerek yoktur.
