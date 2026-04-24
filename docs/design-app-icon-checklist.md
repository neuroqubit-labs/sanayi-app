# Naro — App Icon Design + Teknik Çeklisti

**Amaç:** Logo her güncellendiğinde **tek referans doküman**; design ekibi bu çeklisti takip eder, dev ekibi dosyaları yerine koyar — app.json + prebuild otomatik çalışır. Hiçbir teknik iz araştırması gerekmez.

**Statü:** v1 · 2026-04-24 · Expo SDK 52 + iOS 18 + Android 13/14/15 uyumlu

---

## 1. Genel kurallar (kritik — gözden kaçırılırsa App Store/Play Store reject)

| Kural | Gerekçe |
|---|---|
| **1024×1024 PNG, kare** | Store baz boyutu; tüm küçük boyutlar buradan otomatik üretilir |
| **Hiçbir piksel translucent olmamalı** (iOS icon özel) | Apple 2020+ rejection rule; RGBA konteyner OK ama alpha değerleri 255 olmalı. Pre-flight: `-alpha off` ile strip |
| **Pre-baked rounded corner YOK** | iOS squircle + Android adaptive mask **otomatik** uygulanıyor. Source kendi corner rendering'i olursa "çift mask" = görsel hata |
| **Hiçbir boyut etiketi, trademark simgesi, "©" YOK** | App ikonu reklam alanı değil; sade mark |
| **Arka plan: opaque renk veya motif** (iOS) / **tam full-bleed square** (pre-flatten edilmiş) | Alpha content ≈ reject |
| **Safe zone (Android):** logo merkezdeki **66% alan** içinde kalsın (outer %17 oranında kesilebilir) | Launcher mask tipine göre (circle/squircle/teardrop) kenarlar kırpılır |

---

## 2. Dosya matrisi (ne hazırlanmalı)

Her Naro app için ayrı set (**customer (naro-app)** + **service (naro-service-app)**).

| Amaç | Dosya adı | Boyut | Format | Arka plan | İçerik |
|---|---|---|---|---|---|
| **iOS dark** | `appstore.png` | 1024×1024 | PNG, RGB (no alpha) | Opaque koyu (örn. `#0D1A33`) | Tam renkli N amblem |
| **iOS light** | `light/appstore.png` | 1024×1024 | PNG, RGB (no alpha) | Opaque beyaz (örn. `#FFFFFF`) | Tam renkli N amblem (gradient korunur) |
| **iOS tinted** *(opsiyonel, V1.1)* | `tinted/appstore.png` | 1024×1024 | PNG, RGB (no alpha) | Siyah | Tek renk (beyaz / mid-gray) monochrome N — sistem tint uygular |
| **Android foreground (light primary)** | `light/playstore.png` | 1024×1024 | PNG, transparent OK | Şeffaf veya beyaz | N amblem — merkez 66% safe zone içinde |
| **Android dark variant** *(referans)* | `playstore.png` | 1024×1024 | PNG | Koyu | Android'de şu an primary değil; V1.1'de monochrome kaynağı olabilir |
| **Android monochrome** *(opsiyonel, Android 13+ themed icon)* | `light/monochrome.png` | 1024×1024 | PNG alpha-silhouette | Şeffaf | N şeklinde silhouette (renk önemsiz, alfa mask olarak kullanılır; sistem wallpaper'dan tint atar) |

**Asgari paket** (pilot için yeter):
- `appstore.png` (iOS dark)
- `light/appstore.png` (iOS light)
- `light/playstore.png` (Android primary)

**Tam paket** (V1.1+):
- Yukarıdakiler + `tinted/appstore.png` + `light/monochrome.png`

---

## 3. Dosya konumları (repo)

```
naro-app/assets/app-icons/
├── appstore.png                   # iOS dark
├── playstore.png                  # referans (şu an Android'de primary değil)
├── light/
│   ├── appstore.png               # iOS light
│   └── playstore.png              # Android foreground (primary)
├── tinted/                        # V1.1 — iOS tinted mode
│   └── appstore.png
└── light/monochrome.png           # V1.1 — Android 13+ themed icon

naro-service-app/assets/app-icons/
├── (same structure — usta renkleri ile)
```

**Mevcut `app.json` config'leri bu yolları zaten referans alıyor.** Dosya adları aynı olduğu sürece `app.json` dokunulmaz — sadece yeni PNG'ler kopyalanır, prebuild + install yeterli.

---

## 4. Validation çeklisti (logo güncellendikten sonra)

```bash
# 1) Dosya boyutları doğru mu (1024x1024)
for f in naro-app/assets/app-icons/*.png naro-app/assets/app-icons/light/*.png; do
  identify -format "%f %wx%h %[channels] alpha=%A\n" "$f"
done
# Beklenen: hepsi 1024x1024; iOS appstore.png alpha=False; Android playstore alpha serbest

# 2) iOS icon'larda piksel translucency var mı (opaque olmalı)
for f in naro-app/assets/app-icons/appstore.png naro-app/assets/app-icons/light/appstore.png; do
  convert "$f" -format "%f opaque=%[opaque]\n" info:
done
# Beklenen: opaque=true

# 3) Eğer gelmiş RGBA ise strip
convert input.png -alpha off output.png   # RGB

# 4) 512x512 geldiyse upscale
convert input.png -filter Lanczos -resize 1024x1024 output.png
```

---

## 5. Build + install komutları (logo değişikliğinden sonra)

```bash
# Her iki app için tekrarla (naro-app + naro-service-app)
cd naro-app
npx expo prebuild --platform android            # native res'i yeni iconlardan regenerate
cd android && ./gradlew installDebug             # APK'yı cihaza yükle
cd ../..
```

**iOS için** (macOS gereken):
```bash
cd naro-app
npx expo prebuild --platform ios
cd ios && pod install
# Xcode'dan run veya: xcodebuild -workspace naro.xcworkspace -scheme naro -configuration Debug build
```

Store deploy için **EAS Build**:
```bash
eas build --platform android --profile preview --clear-cache
eas build --platform ios --profile preview --clear-cache
```
`--clear-cache` önemli: icon değişiklikleri asset katalog cache'inde takılı kalabilir.

---

## 6. app.json'da canlı config (referans)

### iOS + Android birlikte (canonical şema):

```json
{
  "expo": {
    "icon": "./assets/app-icons/light/appstore.png",
    "ios": {
      "icon": {
        "light": "./assets/app-icons/light/appstore.png",
        "dark":  "./assets/app-icons/appstore.png"
      }
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/app-icons/light/playstore.png",
        "backgroundColor": "#ffffff"
      }
    }
  }
}
```

### V1.1 tam variant (tinted + monochrome):

```json
{
  "expo": {
    "ios": {
      "icon": {
        "light":  "./assets/app-icons/light/appstore.png",
        "dark":   "./assets/app-icons/appstore.png",
        "tinted": "./assets/app-icons/tinted/appstore.png"
      }
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage":   "./assets/app-icons/light/playstore.png",
        "monochromeImage":   "./assets/app-icons/light/monochrome.png",
        "backgroundColor":   "#ffffff"
      }
    }
  }
}
```

---

## 7. Platform kısıtları (bilgi olarak)

- **iOS 18:** Sistem temasına göre otomatik light/dark/tinted switch yapar. Expo SDK 52 native destekliyor.
- **Android (tüm versiyonlar):** Otomatik light/dark switch **YOK**. `adaptiveIcon.foregroundImage` ne ise o gözükür. Android 13+ "themed icons" (monochrome) vardır ama opt-in (kullanıcı cihaz ayarından aktif eder) — sistem temasıyla direkt bağlantılı değil, launcher wallpaper'dan renk türetir.
- **Çözüm kararı (2026-04):** Android'de **light variant primary** — her iki wallpaper tonunda okunur. `-night` resource qualifier otomasyonu için pilot sonrası community config plugin araştırılabilir (ör. `expo-dynamic-app-icon`, `expo-alternate-app-icons`).

---

## 8. Yaygın hatalar (2026)

| Sorun | Sebep | Çözüm |
|---|---|---|
| App Store reject "non-opaque icon" | Alpha kanalında translucent piksel var | `convert input.png -alpha off output.png` |
| Android icon "çift corner" görünüyor | Source pre-baked rounded corner var | Orijinal artwork'i full square olarak export et |
| Icon yarı keskin yarı blur (xxxhdpi cihazda) | Source <1024 (örn. 512) | 1024 kaynaktan export veya `-filter Lanczos` ile upscale |
| Light mode telefonda dark icon görünüyor | Android'de otomatik theme switch yok | Light primary + gotcha notu olarak kabul (V1.1 themed icon aktivate) |
| Splash + icon farklı köşe radius'u | Splash ve icon aynı design dilde değil | Designer her iki asset'i paralel güncellesin |
| "Expo install → icon değişmedi" | Gradle / asset catalog cache | `--clear-cache` (EAS) veya `--clean` (prebuild) |

---

## 9. Bitti kriteri (logo update son kontrol)

- [ ] 8 PNG (her iki app × 4 variant) doğru boyut + doğru format
- [ ] iOS appstore.png + light/appstore.png → `alpha=False`, opaque
- [ ] Android playstore.png + light/playstore.png → 1024×1024
- [ ] `npx expo prebuild --platform android` her iki app'te temiz bitti
- [ ] `./gradlew installDebug` her iki app'te Success
- [ ] Cihazda ana ekranda yeni icon görünür
- [ ] App icon koyu/açık telefon arka planında okunuyor (Android manuel; iOS otomatik)
- [ ] Splash ekran rengi + app icon teması uyumlu

---

## Referanslar

- [Apple HIG — App icons](https://developer.apple.com/design/human-interface-guidelines/app-icons)
- [Android — Adaptive icon design](https://developer.android.com/develop/ui/views/launch/icon_design_adaptive)
- [Expo SDK 52 docs — splash-screen-and-app-icon](https://docs.expo.dev/develop/user-interface/splash-screen-and-app-icon/)
- [Expo Discussion #31501 — iOS 18 Icon Variations](https://github.com/expo/expo/discussions/31501)
- BD marka sesi → [docs/business/strateji/marka-sesi.md](business/strateji/marka-sesi.md)
- Marka logo tartışması → [docs/business/analiz/2026-04-21-marka-ve-sektor-okumasi.md](business/analiz/2026-04-21-marka-ve-sektor-okumasi.md)
