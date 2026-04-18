# naro-service-app

Usta (servis sağlayıcı) mobil uygulaması. React Native + Expo + TypeScript + NativeWind.

## Kurulum

```bash
npm install
cp .env.example .env
npx expo start
```

Önce `naro-backend` ayakta olmalı (`docker compose up` — 8000 portu). Fiziksel cihazdan test için `EXPO_PUBLIC_API_URL`'deki `localhost`'u makinenizin LAN IP'si ile değiştirin.

## Dizin yapısı

```
app/
├── _layout.tsx                provider'lar, splash logic
├── index.tsx                  auth + onay durumuna göre yönlendirme
├── (auth)/
│   ├── login.tsx              telefon girişi
│   └── verify.tsx             OTP doğrulama (technician rolüyle)
├── (onboarding)/
│   └── pending.tsx            onay bekliyor ekranı (KYC sonra)
└── (tabs)/
    ├── _layout.tsx
    ├── index.tsx              iş teklifleri
    ├── earnings.tsx           kazançlar
    └── profile.tsx
src/
├── features/                  iş mantığına özel modüller (jobs, kyc, earnings)
├── shared/ui/                 Button vs.
├── shared/lib/                api, storage, query
└── services/auth/             tokens + approval status store
```

## Akış

1. Login → telefon ile OTP iste (rol: `technician`)
2. Verify → kod doğrula, backend `pending` statüsünde user oluşturur
3. Onboarding → belge yükleme + KYC (sonra eklenecek)
4. Admin onayı sonrası → iş teklifleri ekranı açılır

## Paket ID

`com.naro.service` — değiştirmeyin.

## Komutlar

```bash
npm start          # Expo dev server
npm run android
npm run ios
npm run typecheck
npm run lint
```
