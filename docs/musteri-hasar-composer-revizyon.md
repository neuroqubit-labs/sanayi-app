# Hasar (Kaza) Composer — Revizyon Brief

> **PO kaynak:** PRODUCT-OWNER · 2026-04-22
> **Hedef sohbetler:** UI-UX-FRONTEND-DEV (primary) · BACKEND-DEV (§10 notları için)
> **Kapsam:** Müşteri app `AccidentFlow` composer — 7 adım, shell revizyon + adım sıralaması + acil durum gateway redesign
> **Kardeş brief:** [musteri-bakim-composer-revizyon.md](musteri-bakim-composer-revizyon.md) — **shell revizyonu aynı** (§2'ye referans). Sadece kaza-özel eklemeler bu brief'te.

---

## 1. Context

Kullanıcı kaza composer'ını geçti. Başlıca tespitler:
- Adım 1 (Acil durum) ekranında **çok fazla yazı + buton karmaşası** — Ambulans + Çekici + Devam hepsi aynı görsel ağırlıkta, panik anında kafa karıştırıcı
- **Plaka seçimi yok** — uzun akış, yanlış araç seçilirse en sonda fark edilir → başa taşınmalı (bakım brief'inde de aynı karar)
- Adım sıralaması **mantıksal değil** — kaza anında kullanıcı ilk foto çekmek ister; şu an adım 2 "kaza türü/detay", adım 3 "foto". Sıra ters
- Araç durumu adımında **"çekici gerekiyor mu?"** tekrarı — acil durum gateway'de zaten sorduk, Araç durumu "sürülebilir mi" dan türetilebilir
- "Kaza" chip + uzun eyebrow + uzun başlık + açıklama paragrafı = **4 satır gürültü** her adımda (shell revize bakım ile aynı)
- Kullanıcı adım 3 sonrası **state kaybı** yaşıyor ("sonrasına geçemiyorum") — navigation/state bug veya incomplete schema

Bu brief bunları toplu revize eder. Akışın omurgası korunur (7 adım), sadece 2↔3 sıra değişimi + acil durum ekranı büyük redesign + shell revize.

---

## 2. Shell revizyonu — bakım brief'inin aynısı (reuse)

Tüm 7 adımda **[musteri-bakim-composer-revizyon.md §2](musteri-bakim-composer-revizyon.md#2-composer-shell-revizyonu-tüm-5-adımda-ortak)**'de tanımlanan shell uygulanır:

- Üst sol: **[×]** (kapat) — "geri" değil; geri adımlar arası
- Üst merkez: kısa başlık **"Kaza bildirimi"** (uzun "Kaza bildirimini sakin bir akışta t..." gitti; eyebrow + açıklama paragrafı da gitti)
- Üst sağ: **[Taslak kaydet]** chip-button
- İnce 2 px progress bar + **"Adım N / 7 · {step name}"** tek satır
- **"Kaza" chip her adımdan kaldırıldı**
- Opsiyonel tek-satır bağlam metni adıma özel (aşağıda her adım için tanımlı)
- Alt bar: Geri / Devam et (mevcut pattern)

Bu shell **aynı pattern bakım ile paralel yürütülür** — tek shell component, `category` prop'una göre başlık + adım adı değişir. FE dev bakım brief'ini bitirdiyse bu brief için shell reuse.

---

## 3. Adım sıralaması değişikliği

### 3.1 Mevcut (eski)
1. Acil durum gateway
2. Temel bilgi (kaza türü + açıklama + konum + araç durumu)
3. Fotoğraf (7 kategorili)
4. Tutanak metodu
5. Sigorta
6. Belgeler + onay
7. Önizleme

### 3.2 Yeni
1. **Acil durum gateway** (büyük redesign — §4)
2. **Fotoğraf** (önceden adım 3 — önce gelir; kaza anında kullanıcı refleksi)
3. **Temel bilgi** (önceden adım 2 — araç durumu, çekici sorusu temizlenir — §6)
4. Tutanak metodu
5. Sigorta
6. Belgeler + onay
7. Önizleme

**Gerekçe:** Kaza anında kullanıcı elindeki telefonla **önce foto çeker, sonra detay yazar**. Mevcut akış bu içgüdüyü ters yaşatıyor.

### 3.3 Taşıma riski
- Adım 3 (yeni: temel bilgi) artık foto sonrası — kullanıcı "ne oldu" sorusunu foto çektikten sonra yazması **daha doğal**
- Önceden foto'yu skip etme opsiyonu varsa (vardı — en az 1 kanıt gerekli ama bazı kategoriler opsiyonel), önce skipleyebilen kullanıcı foto'suz devam edemez olduğu için akış bloke olmaz; kullanıcı en az 1 fotoğraf çekmeden adım 3'e geçemez (mevcut validation kuralı korunur)

---

## 4. Adım 1 — Acil Durum Gateway (BÜYÜK REDESIGN)

### 4.1 Mevcut problem
- Büyük "Kaza Bildirimi" başlık kartı + açıklama paragrafı (gereksiz — başlık zaten eyebrow'da)
- **3 buton aynı ağırlıkta:** Ambulans Çağır (kırmızı) + Çekici Çağır (turuncu) + "Acil durumum yok — devam et" (koyu outline)
- Asıl CTA (Devam et) 3. sırada, altta
- Ek olarak alt bar'da **tekrar "Geri" ve "Devam et"** butonları ✗
- **Plaka seçimi yok** — kullanıcı hangi aracı bildirdiğini bilmiyor, uzun akış sonunda yanlış araç fark edilirse 7 adım çöp

### 4.2 Yeni yapı

```
┌──────────────────────────────────────┐
│ [×]      Kaza bildirimi  [Taslak kaydet] │
│          ━━━━━━━━━━━━━━━━━          │
│          Adım 1 / 7 · Acil durum    │
│                                      │
│          🚗 34 ABC 42 ▾              │  ← plaka seçici chip (yeni)
│                                      │
├──────────────────────────────────────┤
│                                      │
│          ⚠️                          │
│     Önce güvende misin?              │
│                                      │
│  Nefes al, acele yok. Güvendeysen    │
│  aşağıda devam et. Ambulans lazımsa  │  ← açıklama içinde
│  şuradan ara: [📞 112 - Ambulans]    │  ← ince inline link-button
│                                      │
│                                      │
│  ┌────────────────────────────────┐  │
│  │ 🚚  Aracı çekici çekmesi lazım  │  │  ← primary tap area
│  │     (çekici hizmetine yönlendir) │  │
│  └────────────────────────────────┘  │
│                                      │
│  ┌────────────────────────────────┐  │
│  │     Güvendeyim — devam et      │  │  ← main CTA
│  └────────────────────────────────┘  │
│                                      │
└──────────────────────────────────────┘
```

### 4.3 Yeni davranışlar

**a) Plaka seçici chip (üstte, narin):**
- `🚗 34 ABC 42 ▾` — tap → araç switcher bottom sheet
- Default: aktif araç (profil'den otomatik)
- Araç tekilse chip disabled (sadece görünür, tap yok)
- **Her composer'da (bakım dahil) paylaşılan component** — reusable `ActiveVehicleChip`

**b) Ambulans düğmesi → inline link (KALDIRILDI BUTON):**
- Büyük kırmızı Ambulans Çağır düğmesi **YOK**
- Onun yerine açıklama paragrafının **içinde ince `[📞 112 - Ambulans]` pill-link**
- Tap → `tel:112` (native phone app)
- Görsel ağırlık düşürülür ama **hayat kurtarıcı eylem gizlenmez** — kullanıcı gözü metin içinde doğal akışla görür

**c) "Aracı çekici çekmesi lazım" kartı → doğrudan çekici akışına:**
- Tap → mevcut **çekici modal/sayfa** açılır (`/cekici` — PO notuyla: "mükemmel yaptığımız sayfamıza")
- Kaza composer **duraklatılır** (taslak kaydet otomatik) — çekici işi bittikten sonra kaza talebi devam eder
- Alternatif UX: çekici akışı kapatılınca "Kaza bildirimine devam et" toast'ı

**d) Ana CTA "Güvendeyim — devam et":**
- Tam genişlik primary buton
- Tap → Adım 2'ye (yeni sırayla: Fotoğraf)

**e) Alt bar kaldırıldı bu adımda:**
- Adım 1'de alt bar'da "Geri / Devam et" gösterme — üstte [×] zaten çıkış, ana CTA ekrandaki buton
- Adım 2+ için alt bar geri döner (normal pattern)

### 4.4 Context copy önerileri
- Başlık: "Önce güvende misin?" (insancıl, samimi)
- Açıklama: "Nefes al, acele yok. Güvendeysen aşağıda devam et. Ambulans lazımsa **112 - Ambulans** pill-link'ine dokun."
- Hiçbir teknik jargon yok

### 4.5 Acceptance — Adım 1
- [ ] Üstte plaka seçici chip
- [ ] Ambulans büyük buton **KALDIRILDI**; inline pill-link `[📞 112 - Ambulans]`
- [ ] Çekici kartı → `/cekici` sayfasına yönlendirir (composer duraklatır)
- [ ] Ana CTA tek: "Güvendeyim — devam et"
- [ ] Alt bar (Geri/Devam et) **bu adımda gizli**
- [ ] Shell revize uygulandı (×, taslak kaydet, kısa başlık, ince bar, chip yok)

---

## 5. Adım 2 — Fotoğraf (önceden adım 3)

### 5.1 Davranış
Mevcut 7-kategorili foto ekranı **aynen korunur**, sadece:
- Shell revize (§2)
- Adım sayısı `Adım 2 / 7 · Fotoğraf`
- Üstteki "GÖRSEL REHBER · Adım adım fotoğraf" eyebrow + başlık ikilisi **tekilleştirilir**: tek satır `"Adım adım fotoğraf · 0 / en az 1 zorunlu"` gibi

### 5.2 Kategori zorunlulukları (mevcut — teyit)
- Kazanın genel görünümü — **Zorunlu**
- Karşı araç plakası — Opsiyonel
- Hasar detayı — **Zorunlu**
- Çevre ve yol koşulları — Opsiyonel
- Ek kanıt — Opsiyonel
- + 2 daha (mevcut toplam 7)

### 5.3 UX ince ayar
- Foto rehberi tooltip: her kategori kartında `ⓘ` → "Örnek açı" sheet (mock görselle)
- "En az 1 kanıt gerekli" hata metni **kart altında inline, kırmızı tek satır** — footer global hata yerine (ya da hem ikisi)

### 5.4 Acceptance
- [ ] Shell revize
- [ ] Üst eyebrow+başlık tekilleştirildi
- [ ] Opsiyonel `ⓘ` örnek-açı tooltip (sonraki sprint'e kalabilir)

---

## 6. Adım 3 — Temel Bilgi (önceden adım 2, **çekici sorusu temizlendi**)

### 6.1 Mevcut bloklar (karar)
- **Kaza türü** (Tek taraflı / Karşı taraflı) — ✅ korunur
- **Kısa açıklama** (textarea) — ✅ korunur
- **Konum** (metin input) — 🔄 map picker'a geçer (bakım brief §6.1 ile aynı pattern)
- **Araç durumu** (Evet sürülebiliyor / Hayır çekici gerek) — 🔄 revize

### 6.2 Araç durumu bloğu — çekici sorusu **kaldırıldı**

**Mevcut:**
```
Araç durumu
Aracın şu an hareket edebiliyor mu?
[ Evet, sürülebiliyor ]  [ Hayır, çekici gerek ]
```

**Problem:** Adım 1'de "Aracı çekici çekmesi lazım" zaten sorduk. Burada tekrar "çekici gerek" seçeneği → kullanıcı: *"tekrar çekici istiyor anlamsız"*.

**Yeni:**
```
Aracın durumu
[ Sürülebiliyor ]  [ Sürülemiyor — yerinde ]
```

- Seçenekler **sadece hareket durumuna odaklı** — çekici isteği buradan **türetilir**, sorulmaz
- Backend mantığı: `vehicle_drivable=false` ise `towing_required` implicit olarak true olur (service layer); kullanıcı tekrar tıklamaz
- Eğer kullanıcı Adım 1'de çekici akışına girdiyse buraya gelmeden çekici talebi başlamış olur zaten

### 6.3 Konum — map picker
Bakım brief §6.1 ile **aynı component**: map preview + GPS default + reverse geocode + frequent places + denied fallback.

Kaza için özel not: GPS izni istenirken **kaza bölgesini doğru sinyallemek için konumum açılmalı** copy'si — kullanıcı izin vermeye yatkın olur.

### 6.4 Acceptance — Adım 3
- [ ] "Hayır, çekici gerek" → "Sürülemiyor — yerinde" (copy + backend mantığı türevsel)
- [ ] Konum map picker
- [ ] Shell revize + doğru adım numarası (3/7 · Temel bilgi)

---

## 7. Adım 4-7 (Tutanak / Sigorta / Belgeler / Önizleme)

Bu 4 adım şu an **ekran görüntüsünde yok** — kullanıcı "state yapısını tamamlamadık herhalde" diye belirtti (§9'a). Büyük yapısal değişiklik talebi yok; sadece:

### 7.1 Hepsinde shell revize uygulanır
- `Adım 4 / 7 · Tutanak`
- `Adım 5 / 7 · Sigorta`
- `Adım 6 / 7 · Belgeler`
- `Adım 7 / 7 · Önizleme`

### 7.2 Küçük notlar (iterasyon detayı)
- **Tutanak metodu** (E-Devlet / Kağıt / Polis) — chip grup; mevcut pattern ✓
- **Sigorta** (Kasko + poliçe bilgisi) — eğer `kasko_selected=true` kasko şirketi seçici; poliçe numarası input (opsiyonel)
- **Belgeler** — ruhsat, ehliyet, kimlik opsiyonel upload (foto 7'de yoksa buraya düşer)
- **Önizleme** — bakım brief §7'deki yapısal label:value listesi pattern'i aynı

### 7.3 "Önceki state sorunu" çözüldüyse buraları inceleyip gerek varsa ayrı mikro-brief açarız

---

## 8. State + navigation durumu (§9 notu)

Kullanıcı: *"SOnrasına geçemiyorum çünkü yüklediğim görselleri kabul etmiyor. State yapısını tamamlamadık heralde."*

**Tespit:**
- Adım 3'te (yeni: Fotoğraf) medya upload sonrası `canContinue` validation'ı takılıyor olabilir
- Ya da composer step validate fonksiyonu yanlış alanı kontrol ediyor
- Ya da image picker permission denied session'ı reddediyor

**FE dev'e görev:** Composer state machine + validation chain'i debugla; her adımın `canContinue` logic'i doğru çalıştığını teyit et. Test senaryosu:
1. Mock foto yükle → 4-5 kanıt ekle → devam et → Adım 3 → kaza türü seç → devam et → ... → önizleme → gönder
2. Her adımda geri git → state korunuyor mu?
3. Composer kapat (×) → yeniden aç → taslak kaydedildi mi? (bu **taslak kaydetme brief'inde** daha detay; buraya bağlıdır)

---

## 9. Backend notları (BACKEND-DEV için)

### 9.1 Adım sıralaması değişimi
Tek POST submit; adım sırası client'ta. Backend etkisiz. Ama backend `ServiceRequestDraftCreate` Pydantic validator'ı **any order** ile payload kabul etmeli (şu an öyle; teyit).

### 9.2 Plaka seçimi başta (composer entry)
`vehicle_id` zaten `ServiceRequestDraft` zorunlu alan. Değişiklik yok; sadece FE başta chip ile seçiyor.

### 9.3 Araç durumu + towing türetme
- `vehicle_drivable: bool` — UI'dan doğrudan gelir
- `towing_required: bool` — service layer'da türetilebilir: `towing_required = not vehicle_drivable` (default)
- UI kullanıcı Adım 1'de "çekici çekmesi lazım" kart'ına tıkladıysa composer paused → ayrı çekici case zaten açılır; o tamamlanınca kaza composer `towing_required=false` ile devam eder (çünkü araç artık başka bir yere taşındı)
- Detay edge case backend service `case_create_service.py` içinde belirtilsin

### 9.4 Ambulans durumu
`ambulance_contacted: bool` mevcut. Ama **inline link tap** ile `tel:112` çağrıldıysa bunu backend'e kaydetmiyoruz otomatik (user'ın teyit etmesi lazım — privacy + accuracy). Önizleme adımında checkbox: "Ambulans çağrıldı ✓" — opsiyonel user confirm.

### 9.5 Damage score (audit P1-2, opsiyonel)
Bu brief'in kapsamında **eklenmedi**. Eğer opsiyonel olarak gelecekse:
- Adım 3 (Temel bilgi) sonunda veya ayrı mikro-step
- Chip seçim: `Hafif / Orta / Ağır / Total-loss`
- Backend: `damage_severity: enum` yeni alan veya `damage_score_pct: int` numeric
- V1 manuel; V2 AI foto intake'ten inferred
- PO karar bekliyor (şu an dahil edilmedi, hasar V1 launch'a gerek yok)

### 9.6 Kullanıcı tercihi = talep (audit P0-5)
Kaza için `price_preference` seçeneği yok (kaza'da priority düşünülmez — sigorta dosyası ödeyecek). Bu doğru, kaza'da chip olmayacak.

---

## 10. Sıralama & Acceptance

### 10.1 Global acceptance
- [ ] Shell revize 7 adımda tutarlı (bakım brief §2 pattern)
- [ ] Adım sırası: Gateway → Foto → Bilgi → Tutanak → Sigorta → Belge → Önizleme
- [ ] Adım 1 plaka chip + inline ambulans link + çekici-kart-yönlendirmesi + tek CTA + alt bar gizli
- [ ] Adım 3'te "çekici gerek" seçeneği "sürülemiyor — yerinde" olarak değişti
- [ ] Konum map picker (bakım brief component reuse)
- [ ] State/navigation bug'ı fix edildi; 7 adım smooth akıyor
- [ ] typecheck + lint temiz
- [ ] Smoke: kaza talebi 7 adım → submit → case ekranı açılıyor

### 10.2 Süre
- Adım 1 redesign + plaka chip reuse: **1 gün**
- Adım sıra değişimi + adım 3 "çekici sorusu" temizlik: **0.5 gün**
- Shell reuse (zaten bakım brief'inde yazıldıysa): **0.3 gün**
- State/navigation bug fix: **0.5-1 gün** (unknown scope — bug derinliğine bağlı)
- Adım 4-7 shell revize: **0.5 gün**
- Map picker — **bakım brief'te zaten var, reuse**; çalıştığı varsayıldı

**Toplam: ~3 iş günü** 1 FE dev (bakım brief'i bitmişse).

---

## 11. PO roadmap hatırlatması

1. ✓ Bakım composer brief
2. **→ Bu brief (hasar)**
3. Arıza + Çekici composer (küçük iterasyon, shell + minor)
4. Case profile revizyon (§9 bakım brief'inden — submit sonrası "anlaşılmıyor" problemini çözer)
5. Taslak kaydetme brief (tüm composer'lara paralel — half-state resume pattern)

Bu brief'in en kritik iki çıktısı:
- **Acil durum gateway** redesign (kullanıcı acısı en yüksek)
- **Plaka chip + shell reuse** — hasar + bakım aynı pattern'e oturur, arıza + çekici de sonra kolay yapışır

---

## 12. Referanslar

- [naro-app/src/features/cases/composer/AccidentFlow.tsx](../naro-app/src/features/cases/composer/AccidentFlow.tsx) — mevcut akış
- [packages/domain/src/service-case.ts](../packages/domain/src/service-case.ts) — `AccidentReportMethod` enum, kaza alanları (counterparty_note, damage_area, report_method, kasko_*, sigorta_*, ambulance_contacted, emergency_acknowledged)
- [docs/naro-urun-use-case-spec.md](naro-urun-use-case-spec.md) — UC-2 Vaka Aç (kaza dahil) north star
- [docs/musteri-bakim-composer-revizyon.md](musteri-bakim-composer-revizyon.md) — **kardeş brief, shell pattern kaynak**
- [docs/cekici-modu-urun-spec.md](cekici-modu-urun-spec.md) — çekici akışı (Adım 1'deki yönlendirme hedefi)
- Kullanıcının paylaştığı PO session ekran görüntüleri (2026-04-22)

---

**Son güncellenme:** 2026-04-22 · Hasar composer + acil durum gateway + adım sıra revizyonu · UI-UX-FRONTEND-DEV brief
