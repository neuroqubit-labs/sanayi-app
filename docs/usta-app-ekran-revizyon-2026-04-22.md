# Usta App Ekran Revizyonu — 2026-04-22

> **PO kaynak:** PRODUCT-OWNER · **Hedef sohbet:** UI-UX-FRONTEND-DEV
> **Kapsam:** naro-service-app görsel UX iterasyonu (Shell 2). Backend/data değişmez; sadece layout + component kompozisyon + 1 yeni feed.
> **Yöntem:** Kullanıcı gözünden geçti; kodsuz yorumlandı. Bu brief ona göre.

---

## 1. Context

İlk shell (Faz 10 FE) yapısı **operasyonel** olarak doğru ama **göz yorucu + keşif yok**. Usta ekranı sadece "sen ve işlerin" eksenine oturtulmuş; rekabet unsuru + benzerlerini görme hissi yok. PO tezi: **ustalar diğer atölyelerin dolu-dolu ekranını görünce motive olur, platforma daha çok bağlanır**. Aynı zamanda mevcut yoğunluk göz yoruyor — kelime seçimleri ve kompozisyon hafifletilmeli.

**Prensip:** *Keşif + operasyon dengesi*. Üst yarı operasyonel (randevu, aksiyon bekleyenler). Alt yarı keşif (başka ustalar). Ama "göze sokmadan" — görsel rekabet doğal biçimde akar, agresif CTA yok.

---

## 2. Anasayfa — yeni akış (büyük revizyon)

Mevcut sıra: Header → Gelen randevu talebi → Özet kartı → 4 router (Kampanya/Mobil/Gelir/Yorum) → Bugün Senden Beklenenler → Müşteri Bekleyenler → Havuzdan sana özel → Son Aşamalar.

**Yeni sıra (yukarıdan aşağıya):**

### 2.1 Header (değişmez)
- Arama çubuğu + bildirim + rol switcher chip (multi-role kişide)

### 2.2 AutoPro Servis özet kartı (YUKARI ÇEKİLİR — şu anki ortadan hemen header altına)
- İşletme adı + tagline + durum rozeti (Açık/Yoğun)
- 4 metrik (Aktif / Bekleyen / Bu Hafta / Bugün)
- Router'lar (Kampanyalarım, Mobil servis hattı, Gelir özeti, Müşteri yorumları) **BURADAN KALDIRILIR** → Profil'e taşınır (§5)

### 2.3 Gelen randevu talebi
- Başlık metni **"Gelen randevu talebi"** kaldırılır (başlıksız, sadece kart)
- Alt bilgi kartın içinde (ör. "1 talep yanıt bekliyor" kartın üst kenarına chip olarak)
- AutoPro özet kartının hemen ALTINDA

### 2.4 Aksiyon blokları — iki kare yan yana (YENİ KOMPAKT)

| Sol kare | Sağ kare |
|---|---|
| **"Sıradaki adımın"** (eski "Bugün Senden Beklenenler" — daha odaklı kelime) | **"Müşteride bekliyor"** (eski "Müşteri Bekleyenler" — öz kelime) |
| İçinde aktif süreçteki urgent item'lar (foto yükleme, teslim vb.) | İçinde müşteriden onay bekleyen item'lar |
| Sayaç + en üstteki item mini preview | Sayaç + en üstteki item mini preview |
| Tap → "Tüm işler" ekranına git (filtreli) | Tap → "Tüm işler" (filtreli) |

**Kelime önerilerim** (dev seçsin):
- "Sıradaki adımın" / "Şimdi senin sıran" / "Aksiyon — sen"
- "Müşteride bekliyor" / "Müşteri sırasında" / "Yanıt bekleniyor"

### 2.5 Havuzdan sana özel (DEĞİŞMEZ — korunur)
- Mevcut horizontal scroll pool card'ları. PO onaylı, sorun yok.

### 2.6 Son Aşamalar (DEĞİŞMEZ — korunur)
- Mevcut kanıt akışı listesi.

### 2.7 Keşfet — diğer ustalar (YENİ feed, sayfanın ana gövdesi)

**Başlık önerim:** "Çevrendeki atölyeler" veya "Keşfet" (kısa + davetkâr)

**Layout:**
- **Sonsuz aşağı scroll**, müşteri app'teki usta kartlarına benzer büyük kartlar
- Her kart: avatar + işletme adı + tagline + 3 metrik (rating, tamamlanan, yanıt süresi) + 2-3 specialty chip + hero foto/galeri thumb
- "Göze sokmadan" — abartılı CTA yok; "detay gör" ikincil; doğal akış
- Full-screen kart DEĞİL; feed içinde 1-2 kart ekrana sığsın (tam ekran değil, mid-height)
- Sıralama sinyali: **yoğun + aktif + iyi değerlendirilmiş atölyeler** önce (backend katsayı — §6)

**Etki:** Usta kaydırırken "Ahmet usta 47 iş bu hafta, benim 17" görür → motivasyon ve platform bağlılığı. İyi atölyelerin dolu-dolu ekranları davet eder.

**Uyarı:** Bu keşif katmanı anasayfayı uzatır — mevcut scroll derinliği 2-3 kat artar. Ama kullanıcı aşağı doğru "operasyonel → keşif" akışı mantıklı buluyor (üstte işlerim, altta rakipler).

### 2.8 Kaldırılan/taşınan elementler

| Element | Şimdiki yer | Yeni yer |
|---|---|---|
| "Gelen randevu talebi" başlığı | Anasayfa başlık olarak | Kart içi chip |
| "Kampanyalarım / Mobil servis hattı / Gelir özeti / Müşteri yorumları" 4 router | Anasayfa orta blok | Profil'e (küçük açıklayıcı navigator — §5) |

---

## 3. Havuz (DEĞİŞMEZ)

Kullanıcı onaylı. Bu iterasyonda dokunulmaz.

---

## 4. Kayıtlar — kart görselleştirme

Şu an kart yoğunluğu (badge + başlık + progress + alt action) **göz yoruyor**. "Bakınca anlaşılmalı" prensibine uyarak her kart için **sol tarafa görsel yerleştirme**:

### 4.1 Görsel yerleşim
- Kartın sol tarafında **96×96 veya 80×100 dikey görsel slot**
- Görsel içeriği öncelik sırasıyla:
  1. Hasar kolajı (kaza için — 2-3 small thumbnail grid)
  2. Araç ana fotoğrafı (müşterinin yüklediği)
  3. Aracın marka/model illüstrasyonu (fallback — araç yok/foto yok)
  4. Service kind rengi + ikon (en son fallback)

### 4.2 Yeni kart layout'u

```
┌──────────────────────────────────────────┐
│ [ Görsel ]  Kaza bildirimi · Yan darbe   │
│ [  96×96  ]  Serkan P · 34 SPR 909        │
│ [ kolaj   ]  Audi A4 · 2019               │
│ [       ]   ━━━━━━━━━━━━━━━━━━━━━━━ 68%  │
│            Servis sürüyor · Usta sahnede │
│            İlerleme kanıtı yükle →       │
└──────────────────────────────────────────┘
```

### 4.3 Mevcut element'lerin davranışı
- Badge'lar (ARIZA/KAZA renk + Acil/Müşteri flag) **kalır** ama görsel slot'un altında veya göresel üstünde küçük etikete indirgenebilir
- Progress bar **kalır** (görsel hemen anlaşılır metric)
- Alt action satırı (Sıradaki: Görsel yükle →) **kalır** ama tap area tüm karta genişler

### 4.4 Sigorta dosyaları bloğu
Mevcut duruş iyi ama görsel hasar thumbnail'i eklenebilir (hasar foto'larından 1 tane). Ana revizyon değil; §4.1-4.3 bittiğinde doğal olarak oturur.

---

## 5. Profil — router inheritance

Anasayfadan kalkan 4 router burada toplanır. **Yeni "Yönetim Merkezi" bloğu** ekleniyor (isimlendirme dev'e):

### 5.1 Yerleşim
- Profil hero kartının (avatar + stats + müsaitlik butonu) HEMEN altında
- Mevcut "Sağlayıcı profili" seksiyonunun ÖNÜNDE

### 5.2 Layout — küçük açıklayıcı navigator
2×2 ızgara VEYA dikey 4 satır (dev seçer, az dikey alan kaplayan daha iyi):

```
┌──────────────┬──────────────┐
│ 🏷 Kampanya  │ 🚐 Mobil servis │
│  3 aktif      │  Yerinde onarım  │
├──────────────┼──────────────┤
│ 📊 Gelir      │ 💬 Yorumlar     │
│  Bu ay        │  4.8 · 127      │
└──────────────┴──────────────┘
```

Her kutucuk:
- Ikon + ana başlık + tek satır açıklayıcı alt metin (ne görürsün tap'te)
- Tap → ilgili modal/screen açılır (mevcut route'lar korunur)

### 5.3 Capability gate
`Mobil servis hattı` kutucuğu sadece `capabilities.on_site_repair=true` ise görünür (mevcut kural). `Kampanyalarım` `enabled_capabilities.includes('campaigns')` ile gate'li (mevcut).

### 5.4 Kalan profil yapısı
DEĞİŞMEZ. Sağlayıcı profili / Sertifikalar / Medya vitrini / Hakkımda / Kampanyalarım (vitrin) / Hizmet kapsamı / Uzmanlık / Çalışma saatleri / İşletme / Yorumlar / Ayarlar — hepsi mevcut sırasında kalır.

---

## 6. Yeni feed data source — "Çevrendeki atölyeler"

Bu UI iterasyonunda yeni bir data akışı gerekiyor: diğer ustaların public profil listesi.

**V1 (bu iterasyon):**
- Mock'tan beslen (naro-app tarafındaki usta fixture'ını reuse et veya yeni bir mock oluştur)
- 15-30 usta profili; çeşit + tier dağılımı (business/individual + farklı provider_type)

**V2 (BACKEND-DEV koordinasyon):**
- Yeni endpoint `GET /technicians/public/feed?cursor=&limit=20`
- Sıralama: active + high-volume + high-rating + geografik yakınlık (istiyorsak)
- Pagination cursor-based
- Her kart için public güvenli alan dönsün (phone/email yok, sadece işletme vitrini)

**UX not:** Kart üstüne tap → mevcut "teknisyen detayı" modal'ını aç (naro-app pattern'ini reuse edebilir); customer app'ten kopya bir teknisyen detay modal'ı usta app'te de mantıklı.

---

## 7. Kelime/copy değişiklikleri (özet)

| Eski | Yeni öneri |
|---|---|
| "Gelen randevu talebi" (başlık) | (kaldırıldı — kart içi chip: "1 talep bekliyor") |
| "Bugün Senden Beklenenler" | "Sıradaki adımın" veya "Aksiyon — sen" |
| "Müşteri Bekleyenler" | "Müşteride bekliyor" veya "Müşteri yanıtında" |
| (YENİ) diğer ustalar | "Çevrendeki atölyeler" veya "Keşfet" |
| (YENİ) profil router bloğu | "Yönetim Merkezi" veya "Kısayollar" |

Final kelime seçimi dev'de (UI copy expertise) — önerilerim yönerge niteliğinde.

---

## 8. Out of scope

- **Havuz** ekranı — beğenildi, sabit
- Tab iskeleti + shell mimarisi — değişmez (4 sabit tab: home/havuz/kayitlar/profil)
- Shell config endpoint, quick actions, active role switcher — değişmez
- Backend contract (data şekli) — değişmez
- Çekici takeover (CanliIsModal, AcceptBanner) — değişmez
- Onboarding akışı — değişmez

---

## 9. Acceptance criteria

- [ ] Anasayfada "AutoPro Servis" özet kartı YUKARIDA; sonra randevu kartı; sonra 2×2 aksiyon kareleri
- [ ] Anasayfadan 4 router (Kampanya/Mobil/Gelir/Yorum) **kaldırıldı**; Profil'e 2×2 navigator olarak eklendi
- [ ] Kelime değişiklikleri uygulandı (en az §7 önerilerinden 2 kabul edildi)
- [ ] "Çevrendeki atölyeler" feed mevcut (mock data yeter V1 için); sonsuz scroll; büyük kart; full-screen DEĞİL
- [ ] Kayıtlar kartında sol tarafta 96×96 görsel slot; hasar kolajı/araç foto/ikon fallback sıralamasıyla
- [ ] Tüm değişiklikler 4 sabit tab iskeletini bozmadan yapıldı
- [ ] typecheck + lint temiz
- [ ] Her shell layout variant'ta (5 adet) bu yeni composition çalışır veya en azından `full`/`business_lite` için — sonra genişler
- [ ] Expo dev smoke: fixture'da farklı rollere geçiş → anasayfa kompozisyonu değişir, keşif feed kalır

---

## 10. Ekran görselleri referansı

Kullanıcının PO session'ında paylaştığı ekran görüntüleri bu brief'in görsel kaynağı. Revizyon sonrası "before/after" ekran görüntüleri bu doc'un V2 güncellemesine eklenir.

---

**Son güncellenme:** 2026-04-22 · Kullanıcı gözünden görsel UX iterasyonu · UI-UX-FRONTEND-DEV brief'i
