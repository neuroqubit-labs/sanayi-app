# Mobile Auth ve Onboarding Mevcut Durum

Tarih: 2026-04-23
Durum: repo içi durum analizi
Amaç: customer ve service uygulamalarında auth, kayıt, session ve onboarding
yüzeylerinin bugünkü teknik durumunu ayrı bir referans dokümanda toplamak.

Not:

- Bu doküman, [mobile-auth-onboarding-strategy-2026-04-23.md](/home/alfonso/sanayi-app/docs/mobile-auth-onboarding-strategy-2026-04-23.md)
  içindeki eski `2. Koddan Çıkan Mevcut Durum` bölümünün ayrılmış halidir.

## 2. Koddan Çıkan Mevcut Durum

### 2.1 Customer app

Mevcut auth akışı:

- Login ekranı:
  [naro-app/app/(auth)/login.tsx](/home/alfonso/sanayi-app/naro-app/app/(auth)/login.tsx)
- OTP doğrulama:
  [naro-app/app/(auth)/verify.tsx](/home/alfonso/sanayi-app/naro-app/app/(auth)/verify.tsx)

Davranış:

- Kullanıcı telefonunu giriyor.
- `POST /auth/otp/request` çağrılıyor.
- OTP doğrulanınca token set edilip kullanıcı doğrudan `/(tabs)` içine alınıyor.

Backend davranışı:

- OTP verify sırasında kullanıcı yoksa backend otomatik kullanıcı oluşturuyor.
- Kaynak:
  [naro-backend/app/api/v1/routes/auth.py](/home/alfonso/sanayi-app/naro-backend/app/api/v1/routes/auth.py)

Önemli sonuç:

- Customer için bugün ayrı bir `register` endpoint'i şart değil.
- Ama `yeni kullanıcı mı / geri dönen kullanıcı mı` ayrımı UI'da yok.

Customer profil durumu:

- Profil bilgileri şu an local store üzerinde:
  [naro-app/src/features/profile/user-store.ts](/home/alfonso/sanayi-app/naro-app/src/features/profile/user-store.ts)
- `name`, `phone`, `email` mock/default değerlerle geliyor.
- Repo taramasında customer için `GET/PUT /customers/me/profile` benzeri bir
  canlı profil endpoint'i görünmüyor.
  Bu, repo scan'inden çıkarılmış bir sonuçtur.

Araç ekleme durumu:

- Araç ekleme akışı canlı:
  [VehicleAddScreen.tsx](/home/alfonso/sanayi-app/naro-app/src/features/vehicles/screens/VehicleAddScreen.tsx)
- Araç API'leri canlı:
  [vehicles/api.ts](/home/alfonso/sanayi-app/naro-app/src/features/vehicles/api.ts)

Mevcut fırsat:

- Yeni customer sonrası kısa profil bilgisi alınıp hemen ardından güçlü bir
  `ilk aracını ekle` yönlendirmesi yapılabilir.
- Bunun UI zemini ve araç tarafı hazır; eksik halka customer profil persist
  katmanı.

### 2.2 Session kalıcılığı

Repo'da session kalıcılığı zaten var:

- Session repository:
  [packages/mobile-core/src/session.ts](/home/alfonso/sanayi-app/packages/mobile-core/src/session.ts)
- Native storage adapter:
  [packages/mobile-core/src/platform-storage.ts](/home/alfonso/sanayi-app/packages/mobile-core/src/platform-storage.ts)

Önemli detay:

- Native tarafta tokenlar `expo-secure-store` ile saklanıyor.
- Auth store hydrate edilerek uygulama açılışında session geri okunuyor.
- Yani ürün kararı olarak `çıkış yapana kadar açık kal` modeli teknik olarak
  doğru yönde zaten mevcut.

Sonuç:

- Her açılışta yeniden login istemek doğru değil.
- İstisna durumlar:
  - refresh token fail
  - explicit logout
  - güvenlik sebebiyle session revoke

### 2.3 Service app

Mevcut auth akışı:

- Login:
  [naro-service-app/app/(auth)/login.tsx](/home/alfonso/sanayi-app/naro-service-app/app/(auth)/login.tsx)
- Verify:
  [naro-service-app/app/(auth)/verify.tsx](/home/alfonso/sanayi-app/naro-service-app/app/(auth)/verify.tsx)

Verify sonrası davranış:

- Token set ediliyor.
- Ardından `/technicians/me/shell-config` benzeri bootstrap bilgisi çekiliyor.
- `active` ise tabs.
- Aksi halde onboarding/pending.

Bugünkü kritik sorun:

- `technician_profile` yoksa kod `pending` fallback'ine düşüyor.
- Bu, `ilk kez gelen servis` ile `mevcut ama incelemede olan servis`
  ayrımını UI'da bulanıklaştırıyor.

Kaynak:

- [verify.tsx](/home/alfonso/sanayi-app/naro-service-app/app/(auth)/verify.tsx)

### 2.4 Service onboarding bugün

Mevcut onboarding dosyaları:

- [provider-type.tsx](/home/alfonso/sanayi-app/naro-service-app/app/(onboarding)/provider-type.tsx)
- [provider-mode.tsx](/home/alfonso/sanayi-app/naro-service-app/app/(onboarding)/provider-mode.tsx)
- [business.tsx](/home/alfonso/sanayi-app/naro-service-app/app/(onboarding)/business.tsx)
- [capabilities.tsx](/home/alfonso/sanayi-app/naro-service-app/app/(onboarding)/capabilities.tsx)
- [certificates.tsx](/home/alfonso/sanayi-app/naro-service-app/app/(onboarding)/certificates.tsx)
- [service-area.tsx](/home/alfonso/sanayi-app/naro-service-app/app/(onboarding)/service-area.tsx)
- [coverage.tsx](/home/alfonso/sanayi-app/naro-service-app/app/(onboarding)/coverage.tsx)
- [review.tsx](/home/alfonso/sanayi-app/naro-service-app/app/(onboarding)/review.tsx)

Onboarding store:

- [naro-service-app/src/features/onboarding/store.ts](/home/alfonso/sanayi-app/naro-service-app/src/features/onboarding/store.ts)

Bugünkü yapı kötü değil ama bazı alanlarda fazla parçalı:

- `capabilities` ve `coverage` kısmen aynı “ne iş yaparsın” problemini
  çözüyor.
- `service area` kayıt için değerli, ama ilk başvuruda detay seviyesi yüksek.
- `review` ekranı yerinde.
- Sertifika zorunluluğu güven tonu açısından güçlü.

### 2.5 Service profil yüzeyi bugün

Profil ekranı:

- [naro-service-app/src/features/profile/screens/ProfileScreen.tsx](/home/alfonso/sanayi-app/naro-service-app/src/features/profile/screens/ProfileScreen.tsx)

Profil state alanları:

- [naro-service-app/src/features/technicians/types.ts](/home/alfonso/sanayi-app/naro-service-app/src/features/technicians/types.ts)
- [naro-service-app/src/features/technicians/profile-store.ts](/home/alfonso/sanayi-app/naro-service-app/src/features/technicians/profile-store.ts)

Bugünkü service profilinde yer alan alanlar:

- işletme adı ve business info
- tagline
- biography
- gallery
- certificates
- service domains / procedures / brand coverage / drivetrain
- service area
- working schedule
- capacity
- verified level
- availability

Bu bize şunu söylüyor:

- Her şeyi kayıt aşamasında istemek gerekmiyor.
- Bir kısmı `başvuru için zorunlu`, bir kısmı `onay sonrası profil
  zenginleştirme` olmalı.

## Kaynakça

Bu doküman repo içi kod ve doküman taramasına dayanır.

Ana kaynaklar:

- [mobile-auth-onboarding-strategy-2026-04-23.md](/home/alfonso/sanayi-app/docs/mobile-auth-onboarding-strategy-2026-04-23.md)
- [naro-backend/app/api/v1/routes/auth.py](/home/alfonso/sanayi-app/naro-backend/app/api/v1/routes/auth.py)
- [naro-app/app/(auth)/login.tsx](/home/alfonso/sanayi-app/naro-app/app/(auth)/login.tsx)
- [naro-app/app/(auth)/verify.tsx](/home/alfonso/sanayi-app/naro-app/app/(auth)/verify.tsx)
- [naro-app/src/features/profile/user-store.ts](/home/alfonso/sanayi-app/naro-app/src/features/profile/user-store.ts)
- [naro-app/src/features/vehicles/screens/VehicleAddScreen.tsx](/home/alfonso/sanayi-app/naro-app/src/features/vehicles/screens/VehicleAddScreen.tsx)
- [naro-app/src/features/vehicles/api.ts](/home/alfonso/sanayi-app/naro-app/src/features/vehicles/api.ts)
- [naro-service-app/app/(auth)/login.tsx](/home/alfonso/sanayi-app/naro-service-app/app/(auth)/login.tsx)
- [naro-service-app/app/(auth)/verify.tsx](/home/alfonso/sanayi-app/naro-service-app/app/(auth)/verify.tsx)
- [naro-service-app/app/(onboarding)/provider-type.tsx](/home/alfonso/sanayi-app/naro-service-app/app/(onboarding)/provider-type.tsx)
- [naro-service-app/app/(onboarding)/provider-mode.tsx](/home/alfonso/sanayi-app/naro-service-app/app/(onboarding)/provider-mode.tsx)
- [naro-service-app/app/(onboarding)/business.tsx](/home/alfonso/sanayi-app/naro-service-app/app/(onboarding)/business.tsx)
- [naro-service-app/app/(onboarding)/capabilities.tsx](/home/alfonso/sanayi-app/naro-service-app/app/(onboarding)/capabilities.tsx)
- [naro-service-app/app/(onboarding)/certificates.tsx](/home/alfonso/sanayi-app/naro-service-app/app/(onboarding)/certificates.tsx)
- [naro-service-app/app/(onboarding)/service-area.tsx](/home/alfonso/sanayi-app/naro-service-app/app/(onboarding)/service-area.tsx)
- [naro-service-app/app/(onboarding)/coverage.tsx](/home/alfonso/sanayi-app/naro-service-app/app/(onboarding)/coverage.tsx)
- [naro-service-app/app/(onboarding)/review.tsx](/home/alfonso/sanayi-app/naro-service-app/app/(onboarding)/review.tsx)
- [naro-service-app/src/features/onboarding/store.ts](/home/alfonso/sanayi-app/naro-service-app/src/features/onboarding/store.ts)
- [naro-service-app/src/features/profile/screens/ProfileScreen.tsx](/home/alfonso/sanayi-app/naro-service-app/src/features/profile/screens/ProfileScreen.tsx)
- [naro-service-app/src/features/technicians/types.ts](/home/alfonso/sanayi-app/naro-service-app/src/features/technicians/types.ts)
- [naro-service-app/src/features/technicians/profile-store.ts](/home/alfonso/sanayi-app/naro-service-app/src/features/technicians/profile-store.ts)
- [packages/mobile-core/src/session.ts](/home/alfonso/sanayi-app/packages/mobile-core/src/session.ts)
- [packages/mobile-core/src/platform-storage.ts](/home/alfonso/sanayi-app/packages/mobile-core/src/platform-storage.ts)
