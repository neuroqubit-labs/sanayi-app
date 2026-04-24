# Register / Login Schema Alignment — 2026-04-24

> **Durum:** Register/Login UI'ı pilot'ta yok; mevcut OTP-first login akışı çalışıyor.
> Bu not, Kişisel bilgiler ekranındaki alanlar ↔ backend User modeli arasındaki uyumsuzlukları listeler ki register eklediğimizde hazır olalım.

## Mevcut Backend User Modeli

Dosya: [naro-backend/app/models/user.py](../../naro-backend/app/models/user.py)

| Alan | Tip | Notlar |
|------|-----|--------|
| `id` | UUID PK | — |
| `phone` | `str \| None` (32) | Unique (partial where phone IS NOT NULL). E.164 format beklenir. |
| `email` | `str \| None` (255) | Unique (partial). Customer için opsiyonel. |
| `full_name` | `str \| None` (255) | — |
| `role` | UserRole enum | `customer` / `technician` / `admin`. Customer default. |
| `status` | UserStatus enum | `pending` / `active` / `suspended`. Customer `active` başlar. |
| `approval_status` | UserApprovalStatus \| None | Yalnızca technician KYC için. Customer'da `None`. |
| `locale` | `str` (10) | Default `tr-TR`. |
| `last_login_at` | datetime \| None | — |
| `deleted_at` | datetime \| None | Soft delete. |

## Mevcut Mobile UI State

Dosya: [naro-app/src/features/profile/user-store.ts](../../naro-app/src/features/profile/user-store.ts)

```ts
{
  name: string;
  phone: string;
  email: string;
}
```

Ekran: [naro-app/src/features/profile/screens/ProfileDetailScreen.tsx](../../naro-app/src/features/profile/screens/ProfileDetailScreen.tsx) → `KisiselBilgilerSection`
- Ad soyad
- Telefon (helperText: "Giriş yaparken bu numaraya OTP gönderilir.")
- E-posta (helperText: "Fatura ve raporlar buraya iletilir.")
- Güvenlik blok: parola/OTP davranışı + bağlı cihazlar (read-only)

## Uyumsuzluklar + Aksiyon Listesi

### A. İsim farkı: `name` ↔ `full_name`
- **Yer:** user-store `name` / ProfileDetailScreen `EDIT_TARGETS.name`
- **Sonuç:** Backend'e PATCH gönderirken `full_name` olarak map'lenmeli
- **Öneri:** Store alanını `fullName` olarak yeniden adlandır; send adapter'ı `{ full_name: fullName }` yapsın. Küçük refactor, pilot blok değil.

### B. Eksik endpoint: `GET /users/me` + `PATCH /users/me`
- **Yer:** Backend routes (sadece `/technicians/me/*` var, customer için karşılığı yok)
- **Sonuç:** Customer profil okuma/güncelleme için gerekli. OTP verify bugün `TokenPair` döndürüyor ama kullanıcının `full_name`'ini hiçbir endpoint dönmüyor.
- **Öneri (register blok):**
  - `GET /users/me` → `UserResponse` (id, phone, email, full_name, role, status, locale)
  - `PATCH /users/me` → full_name + email update (phone için OTP reverify akışı ayrı)

### C. Telefon format: E.164 ↔ UI formatted
- **Backend:** `+905551112233` (boşluksuz, E.164)
- **UI mevcut:** `+90 532 000 00 00` (boşluklu, okunabilir)
- **Öneri:** packages/domain'e `normalizePhoneE164(input: string): string` + `formatPhoneTR(e164: string): string` helpers. UI input'unda display formatlı, send öncesi normalize.

### D. Email opsiyonellik
- **Backend:** nullable
- **UI:** her zaman string olarak tutuluyor (empty string fallback)
- **Öneri:** Register ekranında email opsiyonel işaretlenmeli ("Fatura için istersen ekle"); `PATCH /users/me` body'de `email: null` ile temizleme desteklenmeli.

### E. role/status/locale — UI'da gösterilmiyor
- role: customer default, register seçim yapmaz
- status: pending/active — backend kendisi yönetir; UI "doğrulama bekleniyor" rozeti olabilir
- locale: `tr-TR` sabit, şimdilik değiştirmeye gerek yok

## Register Flow (hazır olunca)

Minimum field seti:
1. **Telefon** (zorunlu, E.164) — OTP gönder → verify
2. **Ad soyad** (zorunlu) — OTP verify sonrası bu adımda sorulur
3. **E-posta** (opsiyonel) — fatura için istiyorsa

Backend akışı:
1. `POST /auth/otp/request { channel: "sms", phone, role: "customer" }`
2. `POST /auth/otp/verify { delivery_id, code }` → `TokenPair` (user create edilir eğer yoksa)
3. `PATCH /users/me { full_name, email? }` → profile tamamlama

**Not:** OTP verify şu an otomatik olarak user yaratıyor (phone-based lookup, create if missing). Register ayrı bir endpoint olmak zorunda değil — OTP verify + follow-up PATCH yeterli. "Register" UX sadece adım ayrımı.

## Kapsam Dışı (bu not için)

- Password auth — platform phone-first OTP; password yok
- Social login (Google/Apple) — auth_identity tablosu hazır ama UI yok
- Avatar upload — V1.1
- KVKK onay kayıt — register akışına `consent_at` timestamp eklenebilir (backend tarafında ayrı tablo)

## Özet

Kısa: Backend User modeli register için yeterli. Eksik olan tek şey **`GET /users/me` + `PATCH /users/me` endpoint'leri**. Bir de mobil tarafında `name → full_name` isim normalize + E.164 phone helper lazım. Register UI yazılmadan bu iki backend endpoint eklenirse, sonrası düz bir form işi olur.
