# naro-app

Müşteri mobil uygulaması. React Native + Expo + TypeScript + NativeWind.

## Kurulum

```bash
npm install
cp .env.example .env
npx expo start
```

Önce `naro-backend` ayakta olmalı (`docker compose up` — 8000 portu). Fiziksel cihazdan test için `EXPO_PUBLIC_API_URL`'deki `localhost`'u makinenizin LAN IP'si ile değiştirin.

## Dizin yapısı

```
app/                        expo-router (dosya tabanlı routing)
├── _layout.tsx             provider'lar, splash logic
├── index.tsx               auth state'e göre yönlendirme
├── (auth)/
│   ├── login.tsx           telefon girişi, OTP iste
│   └── verify.tsx          kodu doğrula, token al
└── (tabs)/
    ├── _layout.tsx         bottom tab bar
    ├── index.tsx           anasayfa
    └── profile.tsx         profil + çıkış
src/
├── features/               feature-based modüller (vehicle, matching, quote)
├── shared/
│   ├── ui/                 Button gibi UI primitive'leri
│   ├── lib/                api, storage, query client
│   ├── hooks/
│   └── theme/
├── services/               auth, notifications, deep-linking
└── types/
```

## Komutlar

```bash
npm start          # Expo dev server
npm run android    # Android cihaz/emulatör
npm run ios        # iOS simulator (macOS)
npm run typecheck  # TS
npm run lint       # ESLint
```

## Play Store build

EAS Build ile:

```bash
npm i -g eas-cli
eas login
eas build --platform android --profile preview
```

`eas.json` sonra eklenecek.

## Paket ID

`com.naro.app` — değiştirmeyin, Play Store'da kalıcıdır.
