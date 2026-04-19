# @naro/config

Paylaşılan konfigürasyon preset ve factory'leri. Expo default davranışını bozmadan monorepo uyumlu ortak config üretmek için kullanılır.

## Kullanım

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

## Babel

```js
// app/babel.config.js
const createExpoBabelConfig = require("@naro/config/create-babel-config");

module.exports = createExpoBabelConfig();
```

## Metro

```js
// app/metro.config.js
const createExpoMetroConfig = require("@naro/config/create-metro-config");

module.exports = createExpoMetroConfig(__dirname);
```

Factory Expo'nun default Metro config'ini baz alır ve `unstable_enablePackageExports` ile monorepo paket çözümünü açar. NativeWind entegrasyonu da burada standartlaştırılır.

## Tailwind

```js
// app/tailwind.config.js
const createTailwindConfig = require("@naro/config/create-tailwind-config");

module.exports = createTailwindConfig({
  brandColors: { 50: "#...", 500: "#...", 600: "#...", 900: "#..." },
});
```

Factory `nativewind/preset` ve ortak content path'lerini içerir. App tarafında yalnızca brand paleti verilir.

## ESLint (flat config, v9)

```js
// app/eslint.config.js
module.exports = require("@naro/config/eslint-preset");
```

`eslint-config-expo` v8 hâlâ legacy formatta; preset `@eslint/compat` + `FlatCompat` ile flat formata çeviriyor. App tarafında ek kurala gerek yoktur.
