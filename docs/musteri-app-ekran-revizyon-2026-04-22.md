# Müşteri App Ekran Revizyonu — 2026-04-22

> **PO kaynak:** PRODUCT-OWNER · **Hedef sohbet:** UI-UX-FRONTEND-DEV
> **Kapsam:** naro-app görsel UX cila iterasyonu — küçük düzeltmeler + orta hafiflik ek.
> **Yöntem:** Kullanıcı gözünden geçti; kodsuz yorumlandı.
> **Kardeş doc:** [usta-app-ekran-revizyon-2026-04-22.md](usta-app-ekran-revizyon-2026-04-22.md) — paralel usta app iterasyonu

---

## 1. Context

Müşteri app'in genel çizgisi **onaylı**. Çarşı mükemmel, Anasayfa + Profil net, Kayıtlar temelde iyi ama karmaşa var. Bu iterasyon **cila seviyesinde** düzeltme + 1 yeni pattern (+ buton modal contextual overlay) + 1 empty-state yönlendirme.

Büyük refactor yok. Shell + tab + data contract dokunulmaz.

---

## 2. Çarşı — "Sana özel" duplicate temizliği

### 2.1 Tespit
Kartın üstünde iki kere "Sana özel" görünüyor:
1. Eyebrow başlık: **"SANA ÖZEL" / Sana özel — Puan, mesafe...**
2. Kartın içindeki chip: **"Sana özel"** badge

### 2.2 Karar
**Her ikisini de kaldır.** Kullanıcı gözüyle: kart feed'inde olduğu zaten anlaşılıyor; "Sana özel" etiketi kartı görmeden ekrana girenler için işaret ama kartta yazıyorsa **gereksiz stack**.

**Alternatif** (dev tercih): sadece **eyebrow** tut (üstteki açıklayıcı başlık); kart içi "Sana özel" chip kalksın. Yine benim önerim **ikisi de kaldır** — kart içindeki diğer badge'ler (Doğrulandı, Pickup, BMW) kategorilemeyi zaten taşıyor.

### 2.3 Etki
- Vertical space tasarrufu (~30-40 px)
- Gürültü azalır, kart'taki gerçek bilgi (rating + mesafe + yanıt + chips) öne çıkar

---

## 3. Kayıtlar — karmaşa hafifletme + empty-state yönlendirme

### 3.1 Mevcut tespit

Üç blok art arda:
1. Araç seçici + açıklama cümlesi
2. **Devam eden işlemler** (2 aktif kart)
3. **Geçmiş kayıtlar** + `[Tümü / Bakım / Hasar / Çekici]` filtre chip'leri + tek kart

**Problem:** Geçmiş kayıtlar kategori filtresi **aşağıda**, blok başlığının altında. İlk girişte göze çarpmıyor, aşağı scroll edince "aha, filtre varmış" hissi. Kullanıcının ifadesi: *"ilginç duruyor"*.

Ayrıca yeni kullanıcı / boş durumda buras **bomboş** kalabilir — yönlendirici CTA yok.

### 3.2 Çözüm A — empty state yönlendirme kartı (öncelikli)

"Geçmiş kayıtlar" bloğunda kayıt yok veya 1 kayıt var ise, **yönlendirme kartı** gösterilir:

```
┌────────────────────────────────────────┐
│  ✨ Daha fazla geçmiş için              │
│                                         │
│  Bakım takvimini başlat  →              │
│  Hasar mı oldu? Bildir   →              │
│  Çekici gerekiyor mu?    →              │
│                                         │
│  [ince outline, soft gradient bg]      │
└────────────────────────────────────────┘
```

**Davranış:**
- Kullanıcının 0 veya 1 geçmiş kaydı varsa görünür
- 2+ varsa gizlenir (doğal yön: kullanıcı deneyim kazandıkça CTA'ya ihtiyacı kalkar)
- Her satır tap → ilgili yeni case composer'a gider (maintenance / accident / towing)

**Visual tonu:**
- **Reklam gibi değil, davet gibi.** Ana feed kartlarıyla farklı background (ör. `bg-app-surface-2` + ince `border-brand-500/20` + soft gradient)
- Corner radius cardların aynı
- "Oraya ait olmadığını" gösteren nüans: kart içeriğinde ✨ ikonu + "SIKAYET VE TALEP" gibi küçük eyebrow label

### 3.3 Çözüm B — kategori filtresi pozisyonu

**Mevcut:** filter chip'leri "Geçmiş kayıtlar" başlığının altında.

**Öneri:** chip'ler **ilk kart listesinin üstüne**, başlık ve liste arasında yakın ilişki kursun:

```
## Geçmiş kayıtlar          1 kayıt
[Tümü·][Bakım][Hasar][Çekici]   ← hemen altında
┌────────────────────────────┐
│ Geçen ay tamamlanan bakım  │
│ ...                         │
└────────────────────────────┘
```

Gösterim değişikliği ufak ama "chip bu liste içindir" mesajı netleşir.

### 3.4 Bonus — "Devam eden işlemler" üst seksiyonu

Mevcut iyi; sadece **"2 aktif" chip'inin konumu** bir yorum sebebi olabilir. Şu an sağ üst köşede, kart'ın başlığı "Devam eden işlemler" ile dengelemiş. Sorun yok — kalsın.

### 3.5 Acceptance (Kayıtlar)
- [ ] Empty-state kartı 0-1 geçmiş kayıtta görünür
- [ ] Kategori filter chip'leri kart listesinin hemen üstünde
- [ ] Yönlendirme kartı ton olarak "davet", "reklam" değil

---

## 4. + Butonu modal — kalite ve overlay

### 4.1 Mevcut tespit

Full-screen sheet olarak açılıyor:
- Arka plan düz koyu
- "Sana özel ustalar" büyük kart grid
- "Yaz Bakımı Paketi" kampanya kart
- "Sezon ipucu" blog kart
- "Yakınındaki servisler" horizontal scroll

**Problem (kullanıcı):**
1. Renkler düz, tasarım kaba
2. Eski ekrandan **kopuyor** (full screen cover = önceki context kayıp)
3. Daha küçük tasarlanabilir — tam ekran gerek yok, contextual olmalı
4. İçerik yazıları güncellenecek

### 4.2 Hedef davranış

**Overlay modal pattern (iOS action sheet genişletilmiş):**
- Arka plan **blur + shaded** (önceki ekranın %40 görünür, bulanık)
- Modal **tam ekran değil** — ekranın %70-80'ini kaplar, üst kısım önceki ekran görünür
- **Yukardan slide down** veya **alttan slide up** (tercihen alttan; tab bar hizasından açılır)
- Köşeler **daha yuvarlak** (28-32 px)
- Gradient + ince cam efekti (backdrop-filter veya native `BlurView`)
- Kapatma: arkaya tap VEYA slide down gesture (bottom sheet pattern)

### 4.3 İçerik revizyonu

Şu an 4 bölüm: Sana özel ustalar + Yaz Bakımı + Sezon ipucu + Yakınındaki servisler.

**Öneri:** Bu 4 bölüm aslında **Çarşı sekmesinin işi**. + butonuna basan kullanıcı genellikle **eylem** bekler (yeni vaka aç, hızlı talep). Modal'ı **eylem öncelikli** yap:

```
┌─────────────────────────────────┐
│   ——                             │  ← sheet handle
│                                  │
│  Ne yapmak istiyorsun?           │
│                                  │
│  ┌──────────┐  ┌──────────┐    │
│  │ 🔧        │  │ 💥       │    │
│  │ Bakım     │  │ Hasar    │    │
│  │ planla    │  │ bildir   │    │
│  └──────────┘  └──────────┘    │
│                                  │
│  ┌──────────┐  ┌──────────┐    │
│  │ 🛠       │  │ 🚚       │    │
│  │ Arıza    │  │ Çekici   │    │
│  │ bildir   │  │ çağır    │    │
│  └──────────┘  └──────────┘    │
│                                  │
│  ─────────────────────────       │
│  Keşfet                          │
│  Yaz Bakımı Paketi · ₺699       │
│  Ustaları bul  →                 │
│                                  │
└─────────────────────────────────┘
```

**Üst kısım (primary):** 4 vaka tipi — 2×2 ızgara büyük CTA.  
**Alt kısım (secondary):** 1-2 kampanya/keşif rehberi — küçük, "bonus" niteliğinde.

**Kopya örnekleri (dev finalize):**
- "Bakım planla" (eski: Yaz Bakımı... ✗)
- "Hasar bildir"
- "Arıza bildir"
- "Çekici çağır"
- (Bonus) "Keşfet — Yaz Bakımı Paketi"

### 4.4 Acceptance (+ modal)
- [ ] Bottom sheet pattern; arka plan blur + önceki ekran %40 görünür
- [ ] Modal ekranın %70-80'ini kaplar; tam ekran DEĞİL
- [ ] Köşeler 28+ px yuvarlak; slide-up animasyonu; swipe-down ile kapanır
- [ ] İçerik: 4 vaka-tipi CTA üstte (2×2 ızgara) + altında mini keşif section
- [ ] Eski "Sana özel ustalar / Kampanyalar" büyük blokları **BU modal'dan Çarşı'ya** taşındı (Çarşı zaten mevcut data ile bunu gösteriyor; duplicate gider)

---

## 5. Anasayfa + Profil — copy incelikleri

Kullanıcı: *"Belki bu ekranlarda inceden yazılara destek verilebilir."*

### 5.1 Anasayfa copy önerilerim
Şu an bazı başlıklar fonksiyonel ama "duygusuz":

| Mevcut | Öneri (dev seçsin) |
|---|---|
| "ODAK PENCERESİ" eyebrow | "Şu an odağında" veya "Aktif takip" |
| "GÜNCEL TUTAR" eyebrow | "Şu ana kadar" |
| "SIRADAKI EŞIK" eyebrow | "Sıradaki adım" |
| "Sana özel ustalar" başlık | "Sana önerilen" veya "Sizin için" (zaten samimi Türkçe; ton cila) |
| "Aracına ve açık vakana göre güvenli adaylar" açıklama | "Aracına uygun ve vaka profilini anlamış ustalar" |

### 5.2 Profil copy önerilerim
Şu an çok net; küçük bir cilaya gerek var:

| Mevcut | Öneri |
|---|---|
| "Araç hafıza stack'i" (teknik terim) | "Araçlarının geçmişi" veya "Garaj" |
| "Her araç kendi kayıt ritmini..." | "Her aracın ayrı bir hikayesi var" |
| "Korunmuş ödemeler" | "Naro güvencesinde" (daha anlaşılır) |
| "Aktif araç" | "Şu anki aracın" (doğrudan seslenme) |

Genel ton: **araba-dili teknik jargondan daha samimi, hikaye dilli** — panik/bilgisiz kullanıcı persona'ları için.

### 5.3 Acceptance (copy)
- [ ] En az §5.1 önerilerinden 3 kabul + uygulandı
- [ ] En az §5.2 önerilerinden 3 kabul + uygulandı
- [ ] Dev kendi copy önerileri getirirse PO review (bu doc güncellenir)

---

## 6. Out of scope (sonra)

- **Taslak kaydetme** — uzun composer akışlarında (kaza 7-step, bakım çok-seçimli) kullanıcı yarım bıraktığında kaldığı yerden devam. Ayrı brief olacak, bu iterasyonda YOK.
- Çarşı iç yapı — dokunulmaz
- Shell + tab iskelet — değişmez
- Backend contract — dokunulmaz
- Yeni data source — mevcut mock/API ile yürür

---

## 7. Referanslar

- Kullanıcının PO session'ında paylaştığı ekran görüntüleri
- [usta-app-ekran-revizyon-2026-04-22.md](usta-app-ekran-revizyon-2026-04-22.md) — usta app kardeş iterasyonu
- [CLAUDE.md](../CLAUDE.md) — persona'lar (panik/bilgisiz/deneyimli kullanıcı)
- Naro UX framework: [sanayi-ux-uyarlama-cercevesi.md](sanayi-ux-uyarlama-cercevesi.md)

---

**Son güncellenme:** 2026-04-22 · Müşteri app görsel cila iterasyonu · UI-UX-FRONTEND-DEV brief
