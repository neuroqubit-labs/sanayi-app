# Arıza + Çekici Composer Revizyonu — Küçük İterasyon

> **PO kaynak:** PRODUCT-OWNER · 2026-04-22
> **Hedef sohbet:** UI-UX-FRONTEND-DEV
> **Süre tahmini:** 1-2 iş günü (shell + primitives zaten hazır, reuse)
> **Kardeş doc:** [musteri-bakim-composer-revizyon.md](musteri-bakim-composer-revizyon.md), [musteri-hasar-composer-revizyon.md](musteri-hasar-composer-revizyon.md)
> **Öncelik:** 🔴 Launch blocker — müşteri app'te 4/4 composer UX tutarlılığı şart

---

## 1. Context

Bakım + hasar composer'ları yeni shell'de (FlowScreen + FlowProgress bar-thin + VehiclePlateChip + LocationPicker + taslak kaydet chip) ve modern copy'yle shipped. **Arıza (BreakdownFlow) + Çekici (TowingFlow)** composer'ları eski shell'de kalmış — grep teyit: `VehiclePlateChip` / `LocationPicker` / `progressVariant: "bar-thin"` referansları **sıfır**.

Launch'a giderken **2/4 composer modern, 2/4 eski** tutarsızlık kabul edilemez. Kullanıcı aynı akıştan (yeni vaka aç → kind seç → adımlar) 4 farklı deneyim görür.

Bu brief **cila + migrate**; yeni özellik yok. Shell + map picker + plaka chip hepsi `packages/ui` + `packages/mobile-core`'da hazır — sadece wire-up + kind-spesifik alan mapping.

---

## 2. Scope — kapsam

### 2.1 Arıza (BreakdownFlow)

Mevcut şema ([packages/domain/src/service-case.ts:149-155](../packages/domain/src/service-case.ts)): `breakdown_category` (engine/electric/mechanic/climate/transmission/tire/fluid/other) + `symptoms[]` + `on_site_repair` + `price_preference` + `vehicle_drivable` + `towing_required`.

**Önerilen 5 adım:**
1. **Kategori + belirti** — `breakdown_category` radio (8 seçenek, grid) + semptom checkboxları (kategoriye göre dinamik)
2. **Araç durumu** — `vehicle_drivable` (Sürülebiliyor / Sürülemiyor) + servis şekli preference (`on_site_repair` / `valet_requested` / atölye)
3. **Kanıt** — foto/video/ses zorunlu değil ama güçlü öneri; semptom sesi kayıtları için audio kanıt kartı
4. **Konum + zaman** — map picker + preferred_window + öncelik (any/nearby/cheap/fast)
5. **Önizleme** — yapısal özet + fiyat aralığı tahmini

### 2.2 Çekici (TowingFlow — case-create akışı)

**Not:** `naro-app/app/(modal)/cekici-cagir.tsx` ayrı bir modal (acil çekici Uber-style dispatch — Faz 10'da shipped). Bu brief **case-create composer** içindeki TowingFlow — planlı çekici / randevulu çekici / kaza sonrası çekici zinciri için.

Mevcut şema: `dropoff_label` + `towing_required` + `preferred_window` + `valet_requested`.

**Önerilen 4 adım** (çekici en yalın composer):
1. **Pickup + dropoff** — iki map picker (pickup zorunlu, dropoff opsiyonel/"anlaşırız")
2. **Araç durumu** — çalışıyor mu + çekme tipi tercihi (flatbed / hook — opsiyonel, usta karar verir) + özel not
3. **Zaman** — `preferred_window` + aciliyet (planned/today/urgent — urgent ise Uber-dispatch modal'ına yönlendir + uyarı "acil çekici için havuza değil direkt atanır")
4. **Önizleme** — yapısal özet + fiyat tahmini (950₺ + 70₺/km pattern)

### 2.3 Acil çekici branching

Urgent + towing seçilirse composer'dan çıkış → mevcut `/cekici` modal (Faz 10 UX'i) — **kullanıcı aynı akışta iki farklı yere gidiyor hissi vermemeli**. Önerim: urgent chip'ine tap olduğunda inline uyarı:
> "Acil çekici için daha hızlı bir akışımız var. Anasayfadan '+ → Çekici' ile tek tıkla çağırabilirsin. Devam edersen bu bir randevu talebi olur."
> [ Anasayfa hızlı akışa git ] [ Planlı devam et ]

---

## 3. Shell + primitive reuse

**Sıfırdan yazılacak hiçbir komponent yok.** Hazırlar:

| Kullanılacak | Kaynak |
|---|---|
| `<FlowScreen compact trailingAction>` | packages/ui (bakım/hasar ile aynı) |
| `<FlowProgress variant="bar-thin">` | packages/ui |
| `<VehiclePlateChip>` | naro-app composer shared |
| `<LocationPicker useMapPicker>` | Faz 2 PR-4 shipped |
| `<FlowSummaryRow>` | packages/ui (bakım adım 5'te shipped) |
| `<[Taslak kaydet]>` trailingAction | CaseComposerScreen'de mevcut (V1 no-op) |

Tüketim pattern'i bakım/hasar'daki aynı — yeni abstraction icat etme.

---

## 4. Composer dosya yapısı

### 4.1 BreakdownFlow.tsx revize

```tsx
export const BREAKDOWN_FLOW: ComposerFlow = {
  kind: "breakdown",
  title: "Arıza bildirimi",           // eyebrow + uzun başlık kaldırıldı
  progressVariant: "bar-thin",         // yeni shell
  steps: [
    { id: "category", title: "Kategori + belirti", render: CategoryStep },
    { id: "vehicle_state", title: "Araç durumu", render: VehicleStateStep },
    { id: "evidence", title: "Kanıt", render: EvidenceStep },
    { id: "logistics", title: "Konum + zaman", render: LogisticsStep },
    { id: "review", title: "Önizleme", render: ReviewStep },
  ],
};
```

**Adım 1 (CategoryStep):**
- Kategori grid (4×2 icon + label)
- Seçim sonrası kategoriye-özel semptom checkbox grid (engine için "motor sesi / güç kaybı / ısınma / yağ kaçağı"; electric için "akü bitti / marş dönmüyor / ışıklar"; vs)
- Semptom + kategori birlikte ilerletir (`canContinue = category != null && symptoms.length >= 1`)
- Semptom şemaları `data/breakdownSymptomSchema.ts` (yeni) — bakım'daki `maintenanceSchema.ts` pattern'i reuse

**Adım 2 (VehicleStateStep):**
- `vehicle_drivable` radio (sürülebiliyor / sürülemiyor)
- Eğer `vehicle_drivable=false` → otomatik bilgi kartı: "Aracın sürülemiyor — randevu onaylanınca çekici talebi otomatik açılır" (no buton — service layer türetir)
- Servis şekli tercihi (yerinde / vale / atölye) — kullanıcı tercihi kuralı (memory)
- Özel not textarea

**Adım 3 (EvidenceStep):**
- Foto / video / ses (semptom kayıt için audio kritik)
- Zorunluluk: en az 1 foto ÖNERİLİR (zorunlu değil — arızada bazen "çalışmıyor" dışı görsel kanıt yok)
- Footer: "Kanıt tekliflerin kalitesini etkiler"

**Adım 4 (LogisticsStep):**
- LocationPicker (map + GPS + reverse geocode + frequent places)
- `preferred_window` chips (bu hafta / hafta sonu / esnek / vs)
- `price_preference` chips (any / nearby / cheap / fast)

**Adım 5 (ReviewStep):**
- `<FlowSummaryRow>` label:value listesi
- Fiyat tahmin bandı (kategori × symptom'a göre; mock OK V1)
- Submit CTA "Arıza bildirimimi gönder"

### 4.2 TowingFlow.tsx revize

```tsx
export const TOWING_FLOW: ComposerFlow = {
  kind: "towing",
  title: "Çekici talebi",
  progressVariant: "bar-thin",
  steps: [
    { id: "locations", title: "Alım + teslim", render: LocationsStep },
    { id: "vehicle_state", title: "Araç durumu", render: VehicleStateStep },
    { id: "schedule", title: "Zaman", render: ScheduleStep },
    { id: "review", title: "Önizleme", render: ReviewStep },
  ],
};
```

**Adım 1 (LocationsStep):**
- İki LocationPicker stacked — "Alım noktası" (zorunlu) + "Teslim noktası" (opsiyonel)
- Teslim yok ise "anlaşırız" not'u gösterilir

**Adım 2 (VehicleStateStep):**
- `vehicle_drivable` radio
- Çekme tipi ipucu (opsiyonel chip — flatbed/hook/wheel-lift — "usta karar verir" alt notu)
- Özel not

**Adım 3 (ScheduleStep):**
- `preferred_window` chips
- **Urgency special handling:** "Şimdi (acil)" seçimi → inline modal "Acil çekici için hızlı akış var — anasayfadan tek tıkla çağırabilirsin" (§2.3)
- Planlanmış / bugün / acil radio

**Adım 4 (ReviewStep):**
- Özet + fiyat aralığı (950₺ + 70₺/km × tahmini mesafe)
- Submit CTA "Çekici talebimi gönder"

---

## 5. Common revizyonlar (her iki composer için)

### 5.1 Shell disiplini (bakım/hasar brief §2 aynı pattern)
- [×] sol üst, kısa title merkez, [Taslak kaydet] sağ üst
- İnce 2px progress bar + "Adım N / M · {step name}" tek satır
- Eski eyebrow + uzun başlık + açıklama paragrafı + "Breakdown"/"Towing" chip **kaldırıldı**

### 5.2 VehiclePlateChip üstte
Üstte küçük `🚗 Plaka ▾` chip — aktif araç, tap → switcher. Bakım/hasar'daki aynı component reuse.

### 5.3 Copy — insancıl + kısa
- "Arıza bildirimi — sakin bir akışta tamamla" gibi uzun başlıklar **kaldırıldı**
- Her adımın **opsiyonel** tek-satır bağlam metni (grey):
  - Breakdown Adım 1: "Ne oluyor?"
  - Breakdown Adım 2: "Aracın ne durumda?"
  - Breakdown Adım 3: "Usta için ipucu ekle"
  - Breakdown Adım 4: "Nerede ve ne zaman?"
  - Towing Adım 1: "Nereden nereye?"
  - Towing Adım 2: "Aracın durumu?"

### 5.4 Invariant'lar (bakım/hasar brief ile aynı)
- `vehicle_id` zorunlu (chip'ten gelir)
- `location_lat_lng` opsiyonel ama **map picker çalışmazsa fallback** text input
- Urgent + towing → Uber dispatch uyarısı (§2.3)

---

## 6. Backend kontrat kontrolü

[musteri-vaka-olusturma-backend-contract.md](musteri-vaka-olusturma-backend-contract.md) §3.3 (breakdown) + §3.5 (towing) alan matrisi zaten mevcut. Yeni backend alanı gerekmez.

**Uyarılar:**
- `on_site_repair` / `valet_requested` breakdown + towing için opsiyonel; bakım + hasar'daki kullanım pattern'i aynı
- `price_preference` breakdown'da opsiyonel (bakım'daki gibi); towing'de **yok** (çekici fiyat pazar-bandı net; kullanıcı preference'ı farklı)
- `emergency_acknowledged` / `kasko_*` / `ambulance_contacted` — sadece accident'te; breakdown/towing composer'larda **alan yok** (submit payload bunları içermez)

---

## 7. Kaldırılan / temizlenen

| Element | Neden |
|---|---|
| Eski eyebrow + uzun title (her adım) | Shell revize |
| "Breakdown" / "Towing" chip | Shell revize (context başlıktan belli) |
| Araç bilgisi info kartı (step içi) | VehiclePlateChip üstte zaten |
| Uzun açıklama paragrafları | Tek satır opsiyonel bağlam metnine indi |
| Mock araç seçici step (eğer varsa) | VehiclePlateChip switcher ile karşılandı |

---

## 8. Acceptance criteria

- [ ] `BreakdownFlow.tsx` yeni shell pattern (FlowScreen compact + FlowProgress bar-thin + VehiclePlateChip)
- [ ] `TowingFlow.tsx` aynı
- [ ] Her 2 composer'da 4-5 adım yeni akış (§4.1 + §4.2)
- [ ] LocationPicker composer içinde wire-up (bakım/hasar pattern'i)
- [ ] Breakdown semptom şeması `breakdownSymptomSchema.ts` (kategoriye göre dinamik)
- [ ] Towing urgency=urgent seçince `/cekici` modal yönlendirmesi uyarısı
- [ ] Review ekranı `FlowSummaryRow` yapısal label:value
- [ ] `Taslak kaydet` chip slot'u her iki composer'da (V1 no-op, sonraki brief'te persist)
- [ ] typecheck + lint clean
- [ ] Expo dev smoke: 4/4 composer (bakım + hasar + arıza + çekici) tutarlı deneyim, aynı shell davranışı
- [ ] PO tarafında screenshot review (4 composer side-by-side)

---

## 9. Kapsam dışı

- **Taslak kaydetme backend persist** — ayrı brief (composer half-state resume)
- **AI intake foto analiz** — V2
- **Backend `maintenance_detail` benzeri breakdown_detail JSONB** — V2 (kategori-özel detay modeli; V1'de `symptoms[]` yeter)
- **Çekici modal (/cekici) refactor** — Faz 10'da shipped, dokunulmaz

---

## 10. Süre + sıra

**Adım 1** — BreakdownFlow revize (0.5-1g):
- Config + 5 step component revize
- Semptom şeması data dosyası
- Smoke

**Adım 2** — TowingFlow revize (0.3-0.5g):
- Config + 4 step
- Urgent branching uyarı
- Smoke

**Adım 3** — Tutarlılık testi + PO review (0.2g):
- 4 composer side-by-side snapshot
- Lint/typecheck clean
- Commit + push

**Toplam:** 1-2 iş günü. Faz 3 (tech app map) bu iş bittikten sonra.

---

## 11. Referanslar

- [musteri-bakim-composer-revizyon.md](musteri-bakim-composer-revizyon.md) — primary pattern kaynağı
- [musteri-hasar-composer-revizyon.md](musteri-hasar-composer-revizyon.md) — shell reuse + step sıra değişimi örneği
- [musteri-vaka-olusturma-backend-contract.md](musteri-vaka-olusturma-backend-contract.md) §3.3 + §3.5 — kind-bazlı alan matrisi
- [packages/domain/src/service-case.ts](../packages/domain/src/service-case.ts) — enum'lar + ServiceRequestDraft
- [naro-app/src/features/cases/composer/BreakdownFlow.tsx](../naro-app/src/features/cases/composer/BreakdownFlow.tsx) — mevcut (eski)
- [naro-app/src/features/cases/composer/TowingFlow.tsx](../naro-app/src/features/cases/composer/TowingFlow.tsx) — mevcut (eski)
- [naro-app/src/features/cases/composer/MaintenanceFlow.tsx](../naro-app/src/features/cases/composer/MaintenanceFlow.tsx) — yeni shell model
- [naro-app/src/features/cases/composer/AccidentFlow.tsx](../naro-app/src/features/cases/composer/AccidentFlow.tsx) — yeni shell model

---

**v1.0 — 2026-04-22** · Arıza + çekici composer yeni shell migrasyon · Faz 3 öncesi son müşteri app cilası
