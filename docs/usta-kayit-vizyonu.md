# Usta Kayıt Vizyonu — KYC, Sağlayıcı Tipi, Sertifika ve Güven Matrisi

> 2026-04-20 · naro-service-app onboarding yapısı + backend KYC zemin vizyonu

## 1. Amaç

Sanayide müşteri–usta arasındaki güvensizlik (kimlik belirsizliği, fatura disiplinsizliği, fiyat tahmini yapılamaması) Naro'nun çözmesi gereken ana ağrı. Kayıt sürecinin temel görevi:

- Platformdaki ustaları **kimliği ve yetkinliği doğrulanmış** bir havuza dönüştürmek
- Sigorta şirketlerine, filo/kurumsal müşterilere **B2B olarak pazarlayabileceğimiz** sertifikalı usta ağı inşa etmek
- Müşteri tarafında "Doğrulandı" rozetinin arkasında **gerçek bir KYC** olmasını garanti etmek
- İleride **anti-fraud** katmanı (aynı vergi no çifte hesap, sahte belge) için veri zeminini kurmak

## 2. Neden provider_type (şemsiye değil)

"Usta" sanayide aslında en az altı farklı meslek grubu için kullanılıyor — hepsinin iş modeli, yetkinliği ve müşteri beklentisi farklı. Aynı kabuğa sokmak UX'i bozar:

| provider_type | Tipik iş modeli | Kampanya relevansı | Dosya açma |
|---|---|---|---|
| `usta` | Atölye + mekanik/elektrik | ✅ Yüksek | ✅ Sigorta |
| `cekici` | Sahada 7/24 transfer | ❌ Kampanya değil | ✅ Transfer/sigorta |
| `oto_aksesuar` | Atölye + aksesuar montaj | ⏳ V2 "paket" | ❌ |
| `kaporta_boya` | Atölye + kaza onarım | ✅ Yüksek | ✅ Sigorta |
| `lastik` | Atölye + mevsim/rot | ✅ Orta (mevsim) | ❌ |
| `oto_elektrik` | Atölye + ECU/elektronik | ✅ Orta | ❌ |

**V1 tek tip** (`provider_type: ProviderType`) — basit ve net. **V2 multi-type** (`secondary_provider_types: ProviderType[]`) — örn. kaporta+boya+çekici birlikte yapan işletmeler için. Şema şimdiden hazır, UI sonra açılır.

## 3. Sertifika matrisi

Her provider_type için zorunlu/önerilen sertifika kombinasyonu aşağıdaki gibi. Kayıt sihirbazında zorunlu olanlar atlanamaz, önerilenler skip edilebilir ama `verified_level` `basic` kalır.

| kind \ provider_type | usta | cekici | oto_aksesuar | kaporta_boya | lastik | oto_elektrik |
|---|---|---|---|---|---|---|
| `identity` (kimlik/ehliyet) | 🔴 zorunlu | 🔴 zorunlu | 🔴 zorunlu | 🔴 zorunlu | 🔴 zorunlu | 🔴 zorunlu |
| `tax_registration` (vergi levhası) | 🟡 önerilen | 🟡 önerilen | 🟡 önerilen | 🟡 önerilen | 🟡 önerilen | 🟡 önerilen |
| `trade_registry` (oda/sicil) | 🟡 önerilen | ⚪ opsiyonel | 🟡 önerilen | 🟡 önerilen | 🟡 önerilen | 🟡 önerilen |
| `insurance` (mesleki sigorta) | 🟢 premium | 🔴 zorunlu | ⚪ opsiyonel | 🟢 premium | ⚪ opsiyonel | ⚪ opsiyonel |
| `technical` (MYK/TSE/marka) | 🟢 premium | ⚪ opsiyonel | 🟢 premium | 🟢 premium | ⚪ opsiyonel | 🟢 premium |
| `vehicle_license` (çekici ruhsat) | — | 🔴 zorunlu | — | — | — | — |

Legend: 🔴 zorunlu · 🟡 önerilen (verified için) · 🟢 premium · ⚪ opsiyonel

## 4. Status makinesi

```
kayıt başvurusu gönderilir
          ↓
  [user.status = pending]      ← admin review bekliyor
          ↓ admin onayı
  [user.status = active]
  [verified_level hesaplanır]
          ↓ dinamik
  basic      ← yalnızca identity (+ opsiyonel)
  verified   ← 3+ approved sertifika (identity + tax + trade veya benzeri)
  premium    ← 5+ approved (insurance + technical dahil)
```

`verified_level` computed: sertifika sayısı/kombinasyonundan türer. Client tarafta gösterim amaçlı cache'lenir; authoritative değer backend'den gelir (V2).

**Rejected sertifika**: admin `reviewer_note` ile neden yazar; usta panelinde banner + yeniden yükle CTA.

**Expired sertifika**: `expires_at` geçtiğinde status otomatik `expired`; verified_level geriye düşebilir. Müşteri tarafında rozet gri olur. Push hatırlatma `expires_at - 30d` (V2).

## 5. Admin review (backend + panel)

V1 kapsamında usta panelinden yükleme akışı tamam; admin panel **V2 scope** — şimdilik DB manuel flip (`UPDATE technician_certificates SET status = 'approved', verified_at = NOW() WHERE id = ...`).

V2 gereken:
- Ayrı admin-panel (Next.js olabilir) — pending sertifika kuyruğu
- Tek ekranda: belge görseli + başvuran teknisyen özeti (provider_type, geçmiş onaylar, lokasyon) + onay/ret + not
- SLA: 48 saat içinde review
- Ret durumunda otomatik push (V2.5)

## 6. Anti-fraud zemini (yazılı, uygulama V2)

- **Vergi no tekilliği**: aynı `tax_number` iki farklı hesapta → flag
- **Telefon tekilliği**: aynı phone iki hesapta → flag
- **Belge parmak izi**: hash(file_bytes) aynıysa tekrar kullanım → flag
- **IP/cihaz anomalisi**: kısa sürede çok başvuru → rate limit
- **Admin rejected → yeni yükleme**: ilk rejected neden tekrar etmemeli (reviewer_note diff kontrol)
- **Sahte MYK belgesi**: MYK API bağlantısı (V3 scope) — canlı doğrulama

## 7. Dağıtım stratejisi bağlantısı

CLAUDE.md'deki "ihtiyaç anında bulunabilir + güven" aksı için KYC kritik:

- **Sigorta ortaklığı**: Sigortanın onayladığı servis ağı = sertifikalı havuzumuz. B2B satış argumanı (müşteri-kazancı değil, sigorta-kazancı öncelikli).
- **Filo**: Şirket araç filoları için "tüm servis ağı KYC'li" vaadi.
- **SEO + güven rozetleri**: "Vergi levhası doğrulandı · Oda kayıt doğrulandı" müşteri-tarafı micro-conversion.
- **Reputation birleşimi**: sertifika × puan × tamamlanan iş sayısı — tek bir "güven skoru" (V2).

## 8. Kayıt akışı UX özet (V1 iskelet)

```
(auth)/login → (auth)/verify → 
  account yoksa:
    (onboarding)/provider-type       [6 kart]
    (onboarding)/business            [legal_name + tax + adres]
    (onboarding)/capabilities        [provider_type presetine göre öneri]
    (onboarding)/certificates        [identity zorunlu, diğerleri skip edilebilir]
    (onboarding)/review              [özet + başvuru gönder]
                  ↓
  (onboarding)/pending               [admin review bekliyor + ek sertifika CTA]
                  ↓ admin approve
  (tabs)/                            [usta aktif, profil doldur + havuza bak]
```

V1'de hepsi mock — state `useOnboardingStore`'da biriktirilir, review submit'te `useTechnicianProfileStore`'a commit, `runtime` approval status `pending` kalır.

V2'de backend endpoint:
- `POST /api/technicians/application` — wizard submit
- `POST /api/technicians/certificates` — ek yükleme
- `GET /api/technicians/me/status` — verified_level + rejected listesi
- `POST /api/admin/certificates/:id/review` — admin onay/ret

## 9. Açık sorular

- **Kimlik doğrulama derinliği**: Sadece belge yükleme yeter mi, yoksa KVKK/e-Devlet entegrasyonu mı? (V2 karar)
- **Çekici ruhsat**: Araç ruhsatı ustanın mı şirketin mi üstüne? Çoklu araç durumu? (V2 model detay)
- **Marka yetkili servisi**: "BMW yetkili" gibi premium etiket nasıl verilir — sertifika üzerinden mi ayrı `brand_authorization` tablosu mu? (V2 scope)
- **Usta kaydı self-service vs invitation-only**: V1 self-service; ama büyüme aşamasında invitation + referans sistemi gerekebilir.
