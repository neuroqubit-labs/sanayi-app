# 2026-04-21 — Marka, Görsel Kimlik ve Sektör Okuması

**Bağlam:** BD kick-off oturumunun kapanışında PO iki soruyu açık bıraktı:
1. Logo + app icon + insan/reklam tarafı nasıl duruyor?
2. Bu sektörde app'ler neden hâlâ yaygınlaşmadı — tutmuyor mu, problem mi var?

Bu not iki soruya BD bakışıyla cevap. Lansmanda mühendislik değil, **insan algısı + pazar yapısı** tarafı.

---

## 1. Görsel kimlik incelemesi

### Mevcut varlıklar

- `logo.png` — koyu lacivert zemin, stilize "N" (turuncu/sarı→mavi gradient + beyaz hız çizgisi)
- `logo-name.png` — amblem + "Naro" wordmark
- `app-icon-app/appstore.png` (müşteri) — N amblem, **mavi-dominant** (turkuaz)
- `app-icon-service-app/appstore.png` (usta) — N amblem, **turuncu/sarı-dominant**
- Play/AppStore için Android + iOS asset klasörleri hazır

### Güçlü yönler

- İki app ikon renk ayrımı **kavramsal olarak doğru** — müşteri=mavi (güven/sakin), usta=turuncu (enerji/iş)
- Gradient + hareket çizgisi modern ton, 2026 estetiği
- "Naro" ismi kısa + telaffuz kolay + trademark görünürlüğü temiz
- Dağıtım teknik olarak hazır

### Zayıf yönler (pazar + persona gözüyle)

1. **Kategori belirsiz.** Logo bir fintech, kargo veya oyun app'i de olabilir. Oto/araç görsel kodu (direksiyon, lastik, anahtar, yol) yok. Uber/Yemeksepeti soyut amblem lüksünü **büyük marka olduktan sonra** kazandılar — lansman fazında değil.
2. **Ton SaaS/fintech-premium, hedef persona taşra/sanayi.** 40+ araç sahibi ve sanayi ustası koyu-lacivert + gradient'i "kendine değil" olarak okuyabilir. Sıcaklık eksik (maskot, yerel dokunuş, insan yüzü yok).
3. **"N" küçük boyutta belirsiz okunabilir** — hız çizgisi amblemi böler, 60×60 piksel Play Store listing'te marka-tanıma riski (test edilmeli).
4. **İki app ikonu yalnız renk şiddetiyle ayrışıyor** — geometri aynı. Kullanıcı iki Naro app'ini telefonda hızlı ayırt etmekte zorlanabilir. Usta app'ine ikonografik eleman (anahtar/somun/zincir) eklense daha iyi olurdu.
5. **"Naro" boş sembol.** Uber/Airbnb de anlamsızdı, zamanla doldu — ama düşük frekans + güven açığı + küçük pazar kombinasyonunda "boş isim" lansmanda risk. **Tagline mecburi.**
6. **Marka deposu eksik:** tagline yok, partner usta rozet tasarımı yok, broşür şablonu yok, sosyal medya post kit yok, maskot yok.

### Tagline önerisi (A/B test)

- **A: "Arabanı düşünme."** — kısa, kolaylık omurgasından türedi, Kayseri-lehçesine yakın
- **B: "Tek tıkla doğru ustaya."** — somut, Kayseri sanayi-adam diline yakın

### Pilot için somut tavsiye

- Logoyu **şimdi değiştirme** — 6 gün, prematüre optimizasyon.
- **Tagline ekle** — broşür, QR, Play Store listing'e.
- **Partner usta rozeti** (dijital + fiziksel sticker) T-1'e tasarla.
- **Light/beyaz-zemin logo varyantı** hazır olsun (basılı materyal + gazete + medya kit).
- **Splash (ilk 2 saniye)** Kayseri-özel mesaj: "Kayseri'de ilk — araban için rahat bir yer." → %2-5 hiperlokal retention farkı.
- **Pilot sonrası A/B:** 60 günlük veri + persona anketi ("bu logo ne app'i?") — %50+ "oto servis" diyorsa tut; diyemiyorsa sektörel eleman ekle.

---

## 2. Sektör neden yaygınlaşmadı? ("Tutmuyor" değil, **yapısal zor**.)

### Başarısız denemelerin özeti

- **Türkiye:** Şiftoto, Sanal Usta, Otopuan, Servisim, yerel çekici app'leri, Koç iç girişimleri.
- **Uluslararası:** YourMechanic (ABD, B2B pivot), OpenBay, iCarsClub (UK kapandı), RepairPal (fiyat karşılaştırma koridoruna sıkıştı).

### 7 yapısal neden

1. **Düşük frekans × yüksek CAC = unit economics yetmiyor.** Yılda 1-2 işlem × %10 komisyon × 2000 TL ticket ≈ 400 TL/kayıt/yıl. 500 TL paid CAC geri gelmez.
2. **Disintermediation** — usta/müşteri tanışınca bypass; komisyon erozyonu kalıcı.
3. **İki taraflı simetrik güvensizlik** — müşteri "kazıklanırım", usta "ödeme alamam". Platformun ikisini aynı anda çözmesi gerekir.
4. **Türk ustası dijital-dışı** — fatura kesmeyen, WhatsApp'tan çıkamayan arz. Toptan alındığında kalite çöker.
5. **Kullanıcı problemini tarif edemiyor** — "ses var" ≠ "alternatör". Tarif hatası = yanlış eşleştirme.
6. **Şeffaf fiyat fiziken zor** — "açıp bakalım" kültürü. App vaadi ≠ gerçekleşme.
7. **Coğrafi fragmantasyon** — şehir başına farklı usta, fiyat, kültür. Tek-app-Türkiye imkânsız; şehir-şehir replike gerekir.

### Başarısızların ortak 5 hatası

1. **Toptan arz** (kurasyon yok) → ilk vakada güven çöker.
2. **Dijital-only edinme** (güven-transferi yok) → CAC yanar.
3. **Erken geniş kapsam** (tüm Türkiye + tüm dikey) → fragmantasyona yenilir.
4. **Disinter ignore** → komisyon ya yüksek (usta kaçar) ya düşük (şirket ölür).
5. **Retention çözümsüz** → pasif değer yok, boş app silinir.

### Naro'nun bu 5 hataya tutumu (KARAR-LOG'dan)

| Hata | Naro karşılığı | Durum |
|---|---|---|
| Toptan arz | 10 seçili partner usta | ✓ karar alındı |
| Dijital-only edinme | Güven-transferi kanalları (usta müşteri + sigorta + yan esnaf) | ✓ plan hazır |
| Erken geniş kapsam | Kayseri tek şehir pilot | ✓ karar alındı |
| Disinter ekonomi sıkıştırması | %5 düşük komisyon + platform avantaj paketi (escrow, garanti, kampanya) | ✓ karar alındı, mekanik doğrulama gerekli |
| Retention çözümsüz | Hatırlatma + sanal garaj + AI ön değerlendirme Faz B (pasif değer) | ⚠ kısmi — hatırlatma ve AI Faz B lansmanda yok, ilk 90 gün içinde gelmeli |

### 2026 tailwinds (pazar "şimdi" hazır)

- Dijital adapt kitle COVID sonrası genişledi (yaşlı kuşak dahil).
- Yemeksepeti/Getir "app'ten hizmet alırım" alışkanlığını kurdu.
- KYC + e-imza + mobil doğrulama altyapısı hazır (güven substrate'i).
- AI 2026'da gerçek katkı sunuyor (önceki denemeler LLM öncesi dönemde kaldı).
- Sigorta sektörü co-branded ortaklığa 2020'de kapalıydı, 2026'da açık.
- Çekici/yol yardımı fiyat infilakı → kullanıcı alternatif arıyor.

### Ana tez

Sektör **zor ama geçilebilir zor**. Rakiplerin başaramaması = pazar yok değil; **pazarı kilitleyen 5 hatayı tekrar tekrar yapmaları** anlamına geliyor.

Naro'nun 5 hatayı yapmama disiplini varsa **18-24 ay ilk-hamle avantajı** alabilir. Lansman döneminde disiplin bozulursa kilit bize de yapışır.

---

## Aksiyon çıktıları (yeni oturum için)

- [ ] **Tagline kararı** — "Arabanı düşünme." vs "Tek tıkla doğru ustaya." A/B test planı PO onayına.
- [ ] **Partner usta rozet tasarımı** — T-1'e dijital + fiziksel sticker.
- [ ] **Light zemin logo varyantı** — basılı materyal için.
- [ ] **Kayseri-özel splash mesajı** — ürün ekibiyle koordinasyon.
- [ ] **Retention mekaniği** (hatırlatma + sanal garaj) — pilot+30 gün yol haritasına al.
- [ ] **Pilot sonrası logo persona anketi** — 60 gün veri sonrası.

İlgili dokümanlar: [DURUM.md](../DURUM.md), [KARAR-LOG.md](../KARAR-LOG.md), [gtm/lansman-plani.md](../gtm/lansman-plani.md), [analiz/2026-04-21-lansman-stratejisi.md](2026-04-21-lansman-stratejisi.md).
