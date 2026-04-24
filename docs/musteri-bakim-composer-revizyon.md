# Bakım Composer — Revizyon Brief

> **PO kaynak:** PRODUCT-OWNER · 2026-04-22
> **Hedef sohbetler:** UI-UX-FRONTEND-DEV (primary) · BACKEND-DEV (§8 validasyon notları için)
> **Kapsam:** Müşteri app `MaintenanceFlow` composer — 5 adım + submit sonrası case profile (hafif değinme)
> **Out of scope (sonraki iterasyonlar):** Hasar (AccidentFlow), Arıza (BreakdownFlow), Çekici (TowingFlow), Taslak kaydetme pattern'i (ayrı brief)

---

## 1. Context

Kullanıcı bakım composer'ını geçti ve **"çok fazla saçmalık var gibi"** dedi. Problem yaklaşımı:
- Üst 3 satır gürültü (eyebrow + uzun başlık + açıklama + araç seçici + "Bakim" chip) — **operasyonel odağı bozuyor**
- Her adımın üstü aynı — **kopyala-yapıştır hissi**
- "Bakim" chip'i 5 ekranda 5 kez → **saçma**
- Adım 1'de **araç seçici gereksiz** (aktif araç zaten profilden)
- Adım 4'te **konum metin input'u** 2026'da kabul edilemez — modern map picker lazım
- Adım 5'te **"Seçimlerin %35"** copy yanlış — bu seçimin adı değil, değeri
- Submit sonrası **case profile ekranı bilinçsiz** — kullanıcı "hiçbir şey anlamadım" dedi; bu ekran **bu iterasyonda kapsam dışı** ama not var (§9)

Bu brief **bakım composer'ını yeniden kalibre eder**. Aynı shell sonra hasar/arıza/çekici'ye yayılacak (ayrı brief). Şimdi bakım.

---

## 2. Composer Shell Revizyonu (tüm 5 adımda ortak)

### 2.1 Üst çerçeve

**Mevcut:**
```
[← Geri]  BAKIM TALEBİ
          Bakımı sakin bir akışta tamamla
          Kategoriye özel sorular, kanıt ve servis tercihi...
          
          ADIM 3/5                        Kanıt
          ━━━━━━━━━━━━━━━━━━━━━━━━
          
          [Bakim] chip
```

**Yeni:**
```
[×]           Bakım talebi                   [Taslak kaydet]
              ━━━━━━━━━━━━━━━━━━━━━━━
              Adım 3 / 5 · Kanıt
```

**Değişiklikler:**
- **[× kapat]** sol üstte (geri değil). Composer'da "geri" sadece adımlar arası — step-level (alt bar). "Çıkış" üst-level aksiyon.
- **[Taslak kaydet]** sağ üstte chip-button. Tap → local persist + çıkış confirm sheet. (Taslak kaydet pattern'i ayrı brief'te detay; burada sadece UI slot'u açılıyor — logic sonra.)
- Başlık tek kelime: **"Bakım talebi"** (eyebrow + uzun başlık + açıklama kaldırıldı)
- Progress bar **ince** (2 px) — mevcut 4 px kalın
- Adım metni: **"Adım 3 / 5 · Kanıt"** (progress bar'ın altında, sola dayalı, küçük punto)
- Sağda görülen "Kanıt" tek kelime çıkarıldı (adım metnine entegre edildi)
- **"Bakim" chip'i 5 adımda da KALDIRILDI** — gereksiz kategori işareti; context zaten başlıktan belli

### 2.2 Üst açıklama paragrafı

Her adımda farklı bir açıklama metin var ("Kategoriye özel sorular..."). **Kaldırıldı.** Her adımın **başlık + bar + adım adı** üçlüsü yeterli context veriyor.

Eğer açıklama gerçekten gerek ise → **adıma özel, tek satır, grise**:
- Adım 1: "Aracına ne yapılsın?"
- Adım 2: "Tercihlerini işaretle"
- Adım 3: "Usta için bağlam ekle"
- Adım 4: "Zaman ve yer tercihi"
- Adım 5: "Kontrol et, gönder"

Bu tek satırlar ekrana "soluk alma" verir, gürültü yaratmaz.

### 2.3 Alt bar

**Mevcut:**
```
Zorunlu kanıt eksik.                 ← bu iyi, hata durumunda
[Geri]  [Devam et]
```

Alt bar zaten iyi. Mevcut pattern korunur. **Tek revizyon:**
- Son adımda `[Bakım talebimi gönder]` CTA **primary renge** (mevcut zaten öyle görünüyor — teyit)
- Hata mesajı "Zorunlu kanıt eksik" tonu yumuşatılabilir: "Bir foto eksik gözüküyor" gibi

---

## 3. Adım 1 — Kategori seçim

### 3.1 Revizyonlar
- ✂️ **Araç seçici kartı KALDIRILIR** (`34 ABC 42 · BMW 3 Serisi · 2019 · 1 açık hasar...`)
  - Aktif araç zaten profilden biliniyor; composer'da tekrar göstermeye gerek yok
  - Araç değiştirmek istiyorsa → üst başlığın yanında küçük chip `🚗 34 ABC 42 ▾` (tap → araç switcher bottom sheet)
  - Çoklu araçlı kullanıcı azınlık → default araç varsayılır, gerekirse chip tap

- ✅ **"Aracına ne yapılsın?"** başlığı kalır (samimi)
- ✅ "Paketler birden fazla işi bir seferde alır. Tek işler için alttaki listeden birini seç." → **kısaltılır**: "Paketler tek seferde birden çok iş alır. Tekli işler listeden."
- ✅ **PAKETLER** grid 4 karet ✓
- ✅ **TEK IŞLER** grid ✓
  - Seçili kart'ta aktif tick ikonu ✓ doğru
  - Grid item'lar `min-height` eşitlenmeli (Cam filmi / Seramik+PPF kartları farklı yükseklikte görünüyor)

### 3.2 Acceptance
- [ ] Araç seçici kartı kaldırıldı
- [ ] Üstte küçük `🚗 Plaka ▾` chip (araç değiştirme için)
- [ ] Shell revizyonu uygulandı (çıkış + taslak kaydet + kısa başlık + ince bar)

---

## 4. Adım 2 — Detay (kategori-spesifik)

### 4.1 Dinamik içerik yaklaşımı
Her bakım kategorisi için Adım 2'de farklı alanlar gösterilir. **Yeni tablo gerekmez — config JSON**. Frontend `maintenanceCategorySchema[category]` map'iyle render eder.

Örnekler:

| Kategori | Adım 2 alanları |
|---|---|
| `glass_film` (Cam filmi) | Kapsam (yan/ön/tam) · Geçirgenlik (%50/%35/%15/%5) · Kalite (Standart/Premium) |
| `periodic` (Periyodik bakım) | Yağ tipi · Filtre listesi · Son km · İstenen ek kontroller (fren, akü vs.) |
| `tire` (Lastik değişimi) | Mevsim · Marka tercihi · Adet · Rot/balans dahil mi |
| `coating` (Seramik) | Katman sayısı · Ön hazırlık (detay yıkama gerekli mi) · Garanti süresi tercihi |
| `battery` (Akü) | Aracın marşı dönüyor mu · Son akü değişim tarihi · Tercih edilen marka |
| `brake` (Fren) | Hangi aks · Balata + disk mi sadece balata mı · Belirti var mı |
| `climate` (Klima) | Belirti (soğutmuyor/ısıtmıyor/ses var) · Son dolum tarihi · Gaz tipi biliniyor mu |
| (diğer 7 kategori) | Benzer dinamik |

**Frontend config:** `naro-app/src/features/cases/composer/data/maintenanceSchema.ts` — her kategori için alan tipleri + label + zorunluluk + enum values. Bu dosya backend'teki `MaintenanceCategory` enum'ıyla 1:1 hizalı.

### 4.2 Revizyonlar

- ✂️ **Üst "CAM FILMI · Cam filmi" duplikasyonu** → tek başlık: kategori adı başlık olarak (eyebrow + başlık ikilisi çift yazıyor)
- ✂️ **"Araç Bilgisi" info satırı KALDIRILIR** (mevcut: `34 ABC 42 · BMW 3 Serisi · 87.400 km · Son bakım: 14 Mart 2026`)
  - Zaten adım 1'de (ya da şimdi chip'te) görüldü; tekrar göstermek gürültü
  - Eğer "son bakım" bilgisi faydalıysa → detay alanlarının içine bağlamsal çekilir (ör. "Son bakımın 14 Mart — 6 ay oldu, periyodik zamanı yaklaşıyor" gibi **akıllı context ipucu**, opsiyonel)
- ✂️ **"Bakim" chip** (2. satırdaki) → kaldır (shell revizyonu)
- ✅ **"Kapsam / Geçirgenlik / Kalite"** chip grupları ✓ doğru pattern
- 🔄 **"Ana seçimi yap (tier / kapsam / mevsim vb.)"** footer hata mesajı → duruma özel: "Kapsam seçimi bekleniyor" gibi

### 4.3 Acceptance
- [ ] Kategori-spesifik schema dosyası oluşturuldu (min 4 kategori için dolu: cam filmi, periyodik, lastik, seramik)
- [ ] Araç bilgisi info kartı kaldırıldı
- [ ] Üst başlık çift yazımı tekilleştirildi

---

## 5. Adım 3 — Kanıt / Medya

### 5.1 Revizyonlar
- ✂️ **"CAM FILMI · KANIT" eyebrow** → kaldırıldı (shell revize)
- ✅ **"Usta için bağlam"** başlık ✓ samimi
- ✅ **Zorunlu / Opsiyonel chip**'leri — bunlar doğru pattern ✓
- ✅ **Kanıt kart'ları** (Kilometre fotoğrafı / Camların genel görünümü / Referans / Kısa not) ✓

### 5.2 Kanıt tipleri kategori-spesifik
Şema (§4.1) içinde her kategorinin kanıt alanları da tanımlı:

| Kategori | Zorunlu | Opsiyonel |
|---|---|---|
| `periodic` | Kilometre fotoğrafı | Eski servis formu · Kısa not |
| `glass_film` | — | Camların görünümü · Referans/istek · Kısa not |
| `tire` | Mevcut lastik görüntüsü (yanak DOT kodu) | Jant detay · Kısa not |
| `coating` | Araç genel fotoğrafı (4 açı) | Referans · Kısa not |
| (diğer) | — | dinamik |

**Tip:** "Kısa not" her kategori için opsiyonel — tekrarlamaya gerek yok, default dahil edilir.

### 5.3 Acceptance
- [ ] Kanıt schema kategori-spesifik
- [ ] Zorunluluk sinyali (footer hata) kanıt eksikse spesifik alan adını söyler

---

## 6. Adım 4 — Konum + Zaman + Tercihler

### 6.1 Konum — **MODERN map picker'a geçiş**

**Mevcut:** metin input'u "Örn: Maslak / Sarıyer"  
**Problem:** 2026'da manuel yazdırmak — kullanıcı yorgunluğu + hata riski

**Yeni:** map-first seçim
```
┌─────────────────────────────────────┐
│  KONUM                               │
│  Bulunduğun semt / ilçe             │
│                                      │
│  ┌─────────────────────────────┐   │
│  │                              │   │
│  │    [ MAP PREVIEW ]           │   │
│  │      📍 (pin, GPS default)   │   │
│  │                              │   │
│  └─────────────────────────────┘   │
│    Maslak Mah, Sarıyer / İstanbul   │
│    [ Konumumu kullan ]              │
│    [ Haritada değiştir ]            │
│    [ Sık kullanılan ]  ▾            │  ← ev / iş / önceki
└─────────────────────────────────────┘
```

**Davranış:**
- İlk açılışta GPS permission iste; izin verilirse auto-fill + reverse geocode etiket
- "Haritada değiştir" → tam ekran map picker modal (pin drag)
- "Sık kullanılan" → kullanıcının önceki vakalarından konum listesi (localStorage/Zustand cache)
- Backend'e gider: `location_lat_lng: {lat, lng}` + `location_label: string` (reverse geocode sonucu)
- **Permission denied fallback:** metin input + şehir/ilçe picker (mevcut davranışa düşer)

**Not (§8):** Backend `service_cases.pickup_lat/lng` kolonu zaten Faz 10 tow ile geldi; `service_request_draft`'a `location_lat_lng` eklenmesi gerek — audit P1-2'ye bağlı (damage score + location_lat_lng).

### 6.2 Zaman tercihi
Mevcut chip'ler ✓ korunur:
- Bu hafta · Önümüzdeki hafta · Hafta içi · Cumartesi · Esnek

### 6.3 Servis tercihleri
Mevcut 2 toggle ✓ korunur:
- Yerinde onarım istiyorum / Vale servis istiyorum
- Açıklayıcı tek satır "Bunlar bir talep — usta uygun bulursa gelir" ✓ kalır (dayatma değil kuralı)

### 6.4 Öncelik tercihi
Mevcut chip grubu ✓ korunur:
- Fark etmez · Yakın olsun · Ucuz olsun · Hızlı olsun

**PO cevabı** kullanıcı sorusuna: Backend `service_request_draft.price_preference` enum field zaten mevcut ([docs/veri-modeli/04-case.md](veri-modeli/04-case.md) + [packages/domain/src/service-case.ts](../packages/domain/src/service-case.ts) `PricePreferenceSchema`). Ama **matching motoruna feed edilmiyor** — şu an sadece storage. Audit P0-5 kullanıcı tercihi = talep enforcement'ı (soft-warning) çözümünde devreye girer. Yani **unutulmamış, sadece implement edilmemiş**. Faz 8 matching motorunda skor fonksiyonuna `priceFit` katsayısı olarak girecek ([docs/sinyal-hiyerarsi-mimari.md §4](sinyal-hiyerarsi-mimari.md#4-matching-tekniği)).

### 6.5 Acceptance
- [ ] Konum map picker aktif (GPS + reverse geocode + frequent places)
- [ ] Permission denied fallback metin input
- [ ] Diğer alanlar (zaman / servis / öncelik) korundu
- [ ] Shell revize uygulandı

---

## 7. Adım 5 — Önizleme

### 7.1 Revizyonlar
- ✂️ **"Bakim" chip** kaldır
- ✂️ **Üst duplikasyon** (eyebrow + uzun başlık) kaldır
- 🔄 **"Seçimlerin %35" copy yanlış** — bu cam filmi için geçirgenlik değeri, genel bir etiket değil
  - Yeni layout: her alan için label + değer satırı
  ```
  Kategori        : Cam filmi
  Kapsam          : Tam (panorama dahil)
  Geçirgenlik     : %35
  Kalite          : Premium (seramik)
  Medya           : 0 dosya
  Servis tercihi  : Yerinde onarım
  Konum           : Maslak / Sarıyer · 📍
  Zaman           : Bu hafta
  Öncelik         : Fark etmez
  ```
  - Kategori-spesifik alanlar şemadan geliyor (§4.1 config); bu satırlar otomatik render
- ✅ **Tahmini fiyat aralığı** kartı ✓ iyi
  - Copy: "Seçimlerine göre hesaplandı. Kesin ücret teklif aşamasında netleşir." ✓
- ✅ **Submit CTA** "Bakım talebimi gönder" ✓

### 7.2 "Fiyat aralığı nasıl hesaplanıyor?" şeffaflığı
Fiyat aralığı kartının yanında küçük `ⓘ` — tap → sheet:
> "Naro platformundaki benzer seçimli taleplerin ortalama teklif aralığına göre hesaplandı. Ustaların gerçek teklifi bunun dışında olabilir."

**Güven sinyali** — kullanıcı "bu sayı nereden?" sormasın.

### 7.3 Acceptance
- [ ] Özet alan-değer listesi yapısal
- [ ] "Seçimlerin %35" gibi genelleyici yanlış copy kaldırıldı
- [ ] Fiyat aralığı açıklama tooltip eklendi

---

## 8. Backend notları (BACKEND-DEV için)

Bu kısım **kısa** — BACKEND-DEV composer akışına hakim değil, PO olarak bağlamı aktarıyorum.

### 8.1 Akış semantiği
Müşteri composer 5 adımda vaka bilgisi toplar → submit'te backend'e **tek POST** gider:
```
POST /api/v1/cases
body: ServiceRequestDraft (tüm 5 adımın output'u)
→ ServiceCase (id, status='matching', ...)
```

Veri tek transaction'da case'e yazılır, havuza düşer, uygun ustalar push bildirimi alır.

### 8.2 Kategori-spesifik alanlar — JSON, yeni tablo YOK
Her bakım kategorisi için Adım 2'de farklı alanlar (kapsam/geçirgenlik/kalite VS periyodik için yağ/filtre/km) toplanır. Bu **flat tablo değil, JSONB**.

Mevcut [service_request_draft](../naro-backend/app/schemas/service_request.py) içinde `maintenance_items: list[str]` + `maintenance_category: MaintenanceCategory` + `maintenance_tier: str` zaten var. **Genişletme:**
- Yeni alan: `maintenance_detail: dict[str, Any]` (JSONB) — kategori-spesifik payload
  - Örn. cam filmi: `{kapsam: "tam", gecirgenlik: "35", kalite: "premium"}`
  - Periyodik: `{yag_tipi: "5w30", filtreler: ["hava", "yag", "polen"], son_km: 87400}`
- Backend şu an bunu reddetmez (Pydantic `extra='forbid'` değilse geçer) ama **tipli validation için** `MaintenanceCategoryDetail` union modeli yazılabilir — opsiyonel, V1'de `dict` kabul yeterli

### 8.3 Konum lat/lng
`service_request_draft.location_lat_lng: LatLng` eklenmeli. Audit P1'de flag'li ama bu iterasyonda devreye girer. `LatLng` zaten [packages/domain/src/technician.ts](../packages/domain/src/technician.ts) içinde tanımlı (Faz 7 signal model); reuse edilir.

Backend `service_cases.pickup_lat/lng` kolonları zaten **var** (Faz 10 tow'dan). Bakım için de aynı kolonlar reuse edilir (tow-özel değil, genel konum).

### 8.4 price_preference enforcement
Zaten field mevcut, sadece **matching motoruna input** değil. Faz 8 matching motoru skor fonksiyonunda `priceFit` katsayısına bağlanacak. Bu brief kapsamında kod değişikliği yok — ama PO olarak not: **unutulmadı, implement edilmedi**.

### 8.5 Audit etkisi
Bu iterasyonun tamamlanması:
- P0-5 (kullanıcı tercihi enforcement) → **UI-side talep**, backend soft-warning flag'i Faz 8'e bağlı
- P1-2 (damage_score) → bakım ekranında yok (hasar'da gelecek)
- Yeni eklenen: `maintenance_detail JSONB` kolonu (ya da schema extension — migration isteğe bağlı)

---

## 9. Case profile ekranı (submit sonrası) — kapsam dışı

Kullanıcı: *"Sonunda açılan sayfa da hiçbir şey anlamadım."*

**Ekran:** "Vakam > Planlı bakim talebi · 3 teklif hazır · Teklifleri aç · 34 ABC 42 · Özet · Dosyalar · Mesajlar · Teklifler · Tehlikeli Bölge > Vakayı iptal et"

**Problemler (not alındı, ayrı iterasyon):**
- Header **çok bilgi tek blokta** → mental load yüksek
- "Tehlikeli Bölge" copy ürkütücü — `Vakayı iptal et` zaten var; şimşek kırmızı warning ton gereksiz
- "Teklifleri aç" CTA — iyi, ama kart'ın içinde konumu karışık
- "#case-04e" referans id kullanıcı için gereksiz
- "Az once" tekrarı (x3)

**Karar:** Bu iterasyonda DOKUNULMAZ. Sonraki brief: `docs/musteri-case-profile-revizyon.md` (hasar composer bittikten sonra).

---

## 10. Sıralama & Acceptance

### 10.1 Faz sırası (bu brief)
1. Composer shell revizyonu (§2) — tüm 5 adımda
2. Adım 1 (§3) — araç seçici kaldırma + chip refactor
3. Adım 2 (§4) — kategori-spesifik schema + duplikasyon temizliği
4. Adım 3 (§5) — kanıt schema dinamik
5. Adım 4 (§6) — **map picker** (en büyük iş)
6. Adım 5 (§7) — özet yapısal + tooltip

### 10.2 Tahmini süre
- Shell + 4 adım cila (1, 2, 3, 5): **1-1.5 iş günü**
- Adım 4 map picker: **1.5-2 iş günü** (Mapbox entegrasyonu + permission flow + fallback)
- Toplam: **~3 iş günü** 1 FE dev

### 10.3 Global acceptance
- [ ] 5 adımda shell revizyonu tutarlı
- [ ] Composer shell yeni pattern (× / taslak kaydet / ince bar / kısa başlık) **hasar + arıza + çekici için reuse'a hazır** (ayrı brief'lerde onlara da uygulanacak)
- [ ] Kategori-spesifik schema dosyası (`maintenanceSchema.ts`) açık + en az 4 kategori için dolu
- [ ] Map picker çalışıyor (GPS + reverse geocode + frequent places + denied fallback)
- [ ] typecheck + lint temiz
- [ ] Expo dev smoke: yeni bakım talebi 5 adım → submit → case profile ekranı açılıyor (profile düzeltmesi sonraki iterasyon)

---

## 11. Sonraki iterasyon sırası (PO roadmap)

1. **Bu brief** — bakım composer (aktif)
2. **Hasar composer brief** — `musteri-hasar-composer-revizyon.md` (benzer shell + kaza-özel alanlar: 7 foto kategorisi + tutanak + kasko)
3. **Arıza + çekici composer brief** — küçük iterasyon, shell + minor copy
4. **Case profile revizyon brief** — submit sonrası ekran (§9'daki problemler)
5. **Taslak kaydetme brief** — tüm composer'larda half-state resume pattern (paralel)

Hasar brief'i sen yazacağın + gönderecek bir sonraki turda.

---

## 12. Referanslar

- [naro-app/src/features/cases/composer/MaintenanceFlow.tsx](../naro-app/src/features/cases/composer/MaintenanceFlow.tsx) — mevcut akış
- [naro-app/src/features/cases/composer/types.ts](../naro-app/src/features/cases/composer/types.ts) — ComposerFlow/ComposerStep tipleri
- [naro-app/src/features/cases/composer/data/](../naro-app/src/features/cases/composer/data/) — schema dosyaları konumlanacak
- [packages/domain/src/service-case.ts](../packages/domain/src/service-case.ts) — `MaintenanceCategory` enum (14 değer)
- [docs/audits/2026-04-21-backend-audit.md](audits/2026-04-21-backend-audit.md) §10 P0-5, §11 P1-2 — kullanıcı tercihi + damage + location
- Kullanıcının paylaştığı PO session ekran görüntüleri (2026-04-22)

---

**Son güncellenme:** 2026-04-22 · Bakım composer görsel + akış revizyonu · UI-UX-FRONTEND-DEV brief
