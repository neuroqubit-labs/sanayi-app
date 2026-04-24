# 2026-04-21 — Servis Ziyaret Frekansı (Revize Varsayım)

**Bağlam:** BD kick-off sırasında "yılda 1-2 ziyaret" varsayımı üzerine LTV ve pilot hedefleri kuruldu. PO araştırma sonuçlarıyla dönüş yaptı — 3+ yaş araç segmentine odaklanıldığında frekans çok daha yüksek çıkıyor. Bu not varsayımı revize eder, etkilenen kararları listeler.

**Sonuç:** Naro hedef segmentinde (3+ yaş araç) platforma anlamlı girecek ziyaret sayısı **4-5/yıl**. Pratik çalışma varsayımı: **5 ziyaret/yıl**.

---

## 1. Kategori-bazı frekans (3+ yaş araç, ortalama 12-15K km/yıl)

| Kategori | Yıllık ziyaret | Kaynak / gerekçe |
|---|---|---|
| **Bakım** (yağ + filtre) | **1.0** | OEM standardı 15.000 km veya yılda 1 kez |
| **Lastik** (mevsim + rot-balans + aşınma) | **1.5** | Kış/yaz geçişi + aşınma; kış lastiği zorunluluğu (bölgesel) |
| **Arıza tamiri** (plansız) | **1.0-2.0** | 3-5 yaş: ~1; 5-10 yaş: ~1.5; 10+ yaş: ~2 |
| **Muayene + öncesi kontrol** | **0.5-0.7** | 4+ yaş: 2 yılda 1 muayene; öncesi kontrol ek ~0.3 |
| **Mevsimsel** (klima, antifriz, akü) | **0.3** | Bakımla birleşir; bağımsız ~0.3 |
| **Kaporta/boya** (park çiziği, küçük hasar) | **0.3-0.5** | Platform-dışı eğilim; Naro kapsamı kısmi |
| **Kaza hasar dosyası** | **0.1-0.15** | TSB ~2-3M dosya/yıl / ~20M araç = ~0.12 |
| **Çekici çağrısı** | **0.15-0.2** | TR ~2-3M çekici çağrısı/yıl; 3+ yaş biraz yüksek |
| **Küçük iş** (akü, far, silecek, aksesuar) | **0.5-0.7** | Platform için kısmi kapsam |

**Toplam (tüm ziyaret):**
- Konservatif: 4.0-4.5
- Orta (3+ yaş ortalama): 5.0-5.5
- Eski araç ağır kullanım (10+ yaş): 7-8

**Naro'nun kapsadığı (kaporta/boya + küçük iş hariç):** **3.5-4.5/yıl**, pratik varsayım 4.

## 2. Sanity check (makro doğrulama)

- Türkiye araç parkı: TÜİK ~28-30M trafiğe kayıtlı / ~20-22M aktif kullanılan (2024)
- Ortalama araç yaşı: ~15 yıl (TESK + OSD verileri)
- Yıllık toplam servis hacmi tahmini: 20M aktif × 5 ziyaret = 100M ziyaret/yıl
- Arz tarafı: ~60K bağımsız usta × yılda ~1.000-1.500 vaka + ~500 OEM yetkili servis × 10.000 vaka + zincir/hızlı bakım = ~80-100M
- **Arz-talep dengesi tutuyor.** Varsayım makul.

## 3. Eski varsayım vs revize — rakam karşılaştırması

| Metrik | Eski (kick-off) | Revize | Değişim |
|---|---|---|---|
| Yıllık ziyaret (Naro kapsamı) | 2 | **4** | ×2 |
| Ortalama ticket | 2.000 TL | 1.800 TL | ↓ (bakım/lastik düşük ticket) |
| Yıllık komisyon/kullanıcı (%10) | 400 TL | **720 TL** | ×1.8 |
| CAC geri ödeme | 12-18 ay | **6-9 ay** | ×0.5 |
| 1 usta : kullanıcı oranı (BD önceki) | 1:200-400 | **1:80-120** | ×0.3 (daha az kullanıcı yeter) |
| Oran (PO kick-off) | 1:80-100 | **1:80-120** | doğrulandı |

## 4. Etki — karar/plan revizyonu gerekenler

### 4.1 Risk R002 (düşük frekans → retention) — skor düşer
- Önceki: L3 × I3 = **9**
- Revize: L2 × I3 = **6**
- Gerekçe: 5 ziyaret/yıl = her 2.4 ayda 1 aktivasyon; "yılda 1-2 kez açılan app" kategorisinden çıkıyor. Sanal garaj + hatırlatma hâlâ gerekli (ziyaretler arası 2-3 ay sessizlik var) ama catastrophic değil.

### 4.2 Monetizasyon / unit economics (canonical hesap)
- Yıllık gelir/kullanıcı (Naro payı): **720 TL** ortalama (4 vaka × 1.800 TL × %10)
- 3 yıllık LTV (retention %60 varsayımı, konservatif): ~1.500-1.800 TL
- Kabul edilebilir CAC üst sınırı: ~400-500 TL (LTV/CAC ≥ 3 hedefi)
- Pilot kanal bazı CAC tahmini:
  - Kanal A (usta müşteri listesi): ~10-30 TL
  - Kanal C (sigorta acente): ~40-80 TL
  - Kanal D (IG paid): ~15-50 TL (hedef)

Bu LTV/CAC matematiği Naro'yu **paid marketing bile yapabilen** seviyeye çıkarıyor — ama yine de güven-transferi ilk tercih çünkü ucuz + kalite.

### 4.3 Pilot hedef revize (DURUM güncellenecek)
- Kayıt hedefi sabit: 500-1.000 / 2 hafta (kanal kapasitesi bu kadar)
- Başarılı vaka üst-band yukarı: **30-50** (önceki 40)
- Başarılı vaka alt-band sabit: **10** (stop-loss eşiği aynı)
- Stop-loss: sabit — T+14 < 10 başarılı vaka veya < 3.5 puan → dur

### 4.4 Dikey önceliği revize (pazarlama + retention)
Eskiden "hepsi eşit ağırlık". Revize:
- **Bakım** (1×/yıl, planlı) — retention omurgası, hatırlatma doğal tetik
- **Lastik** (1.5×/yıl, mevsimsel) — güçlü retention tetik
- **Muayene öncesi kontrol** (0.5-0.7) — pasif değer + ücretsiz tavsiye potansiyeli
- **Arıza** (1-2×/yıl, plansız) — AI değerli (Faz B), panik-anı kolaylık
- **Kaza + çekici** (0.15-0.2) — düşük frekans ama yüksek ticket + sigorta ortaklık kapısı

**Pazarlama mesajı revize:** Pilot döneminde "her türlü servis" yerine **bakım + lastik + hatırlatma** omurgası vurgulansın. "Arabanı düşünme." tagline'ı bu omurga ile doğal eşleşir. Kaza + çekici kapsamı yine canlı ama pazarlamada öncelik değil.

### 4.5 Retention mekanizması (R013) önceliği değişmez
Skor R013 = 9 sabit. 5 ziyaret/yıl olsa bile ziyaretler arası 2-3 ay sessizlik var; sanal garaj + hatırlatma T+60 son tarihli olmalı. Üstüne bakım takvimi + lastik mevsim hatırlatması + muayene hatırlatması otomatik tetikleri kurulsun.

## 5. Aksiyon maddeleri

- [ ] [KARAR-LOG](../KARAR-LOG.md) — monetizasyon canonical hesap + dikey öncelik revize kararları
- [ ] [risk/risk-kayit-defteri.md](../risk/risk-kayit-defteri.md) — R002 skor 9 → 6 revize
- [ ] [DURUM.md](../DURUM.md) — pilot hedef üst-bandı revize + dikey priority notu
- [ ] [monetizasyon/gelir-modeli.md](../monetizasyon/) — bu note'dan hareketle canonical gelir modeli yazılsın (yeni)
- [ ] [gtm/lansman-plani.md](../gtm/lansman-plani.md) — pazarlama mesaj önceliğini bakım+lastik omurgasına kaydır
- [ ] [strateji/ayristirici-tez-ve-moat.md](../strateji/ayristirici-tez-ve-moat.md) §1.1 — frekans + LTV rakamlarını bu note ile senkronize et

## 6. Güven seviyesi ve sınırlar

- **Orta-yüksek güven** (TÜİK araç parkı + TSB kaza istatistikleri + OEM bakım standartları + sektör gözlem)
- **Yüksek-güvensizlik:** ortalama ticket TL rakamları (bölgesel + marka + yaş dağılımına göre oynar; pilot verisi kalibre eder)
- **Kritik doğrulama:** Pilot T+30'da gerçek vaka dağılımı bu varsayımları sınar. Gerçek frekans/ticket farklı çıkarsa bu not revize edilir ve KARAR-LOG'a düşer.
- **Belirsiz bölge:** Naro retention (ilk yıl kullanıcı kaçı %60 retention'a ulaşır?) — ilk gerçek kohort verisi T+90'da.
