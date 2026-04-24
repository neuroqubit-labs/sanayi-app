# Naro — Gelir Modeli (Canonical Unit Economics)

**Yazım:** 2026-04-21 BD · Servis frekans revizyonu sonrası
**Statü:** Canonical gelir modeli — v1
**Temel veri kaynağı:** [../analiz/2026-04-21-servis-ziyaret-frekansi.md](../analiz/2026-04-21-servis-ziyaret-frekansi.md) (revize frekans varsayımları)

**Önemli:** Bu doküman **ekonomi çerçevesi**dir; kesin rakam değil. Pilot T+30 verisi ile revize edilir.

---

## 1. Gelir kalemleri — dört dikey + yan gelirler

Naro'nun gelir yapısı tek-eksenli değil. Her dikey farklı ticket + frekans + marj profili.

### 1.1 Çekirdek — komisyon tabanlı (pilot)

| Dikey | Yıllık frekans/kullanıcı | Ort. ticket | Naro komisyon (%) | Yıllık Naro payı/kullanıcı |
|---|---|---|---|---|
| Bakım | 1.0 | 1.500-2.500 TL (ort. 1.800) | %5 pilot | **90 TL** |
| Lastik (mevsim + değişim) | 1.5 | 800-4.000 TL (ort. 1.500) | %5 | **113 TL** |
| Arıza tamiri | 1.0-1.5 | 1.500-4.000 TL (ort. 2.200) | %5 | **138 TL** (1.25 ort) |
| Muayene öncesi kontrol | 0.5-0.7 | 300-600 TL (ort. 400) | %5 | **12 TL** (0.6 ort) |
| Mevsimsel + küçük iş | 0.3-0.5 | 500-1.200 TL (ort. 800) | %5 | **16 TL** (0.4 ort) |
| Kaza hasar (onarım) | 0.1-0.15 | 10.000-25.000 TL (ort. 15.000) | %3 (sigortalı), %5 (sigorta-dışı) | **45 TL** (0.12 × 12.500 × 3%) |
| Çekici | 0.15-0.2 | 500-1.500 TL (ort. 1.000) | %5 | **9 TL** (0.18 ort) |

**Toplam yıllık komisyon/kullanıcı:**
- **~420 TL** (yalnız bakım + arıza + muayene + mevsimsel — konservatif)
- **~500 TL** (+ lastik eklendi)
- **~550 TL** (+ kaza pragmatik + çekici)

**Pratik çalışma rakamı: ~500 TL/yıl/kullanıcı** (Naro payı, %5 komisyon pilot rejimi).

> **Kick-off analizinde 720 TL vardı — neden düştü?**
> Kick-off'ta ticket'ı blanket olarak 1.800 TL × 4 vaka = 7.200 TL GMV × %10 = 720 TL çekmiştik.
> Bu doküman dikey-dikey hesapla daha doğrusunu yapıyor: ağırlıklı ticket ortalaması ~1.600 TL × 4 vaka = 6.400 TL GMV × ağırlıklı komisyon ~%5-7 = ~400-500 TL.
> Pilot komisyon %5'le 500 TL doğru; post-pilot %10'a çekilirse **~1.000 TL/yıl/kullanıcı**.

### 1.2 Post-pilot komisyon rejimi (T+90+ hedef)

- Bakım + lastik + küçük iş: **%7-10** (usta-düşük-ticket, platform-değer-yüksek)
- Arıza: **%7**
- Muayene kontrol: **%5**
- Kaza onarım: **%3** (düşük komisyon çünkü volume düşük + sigorta karmaşası)
- Çekici: **%10-15** (platformun asıl değeri burada — auto-dispatch, SLA)

Post-pilot ağırlıklı ortalama: **~%7-8 komisyon**.
Yıllık Naro payı/kullanıcı (post-pilot): **700-900 TL**.

### 1.3 Yan gelirler (V1.1-V2, lansmanda yok)

| Kaynak | Mekanik | Tahmini katkı |
|---|---|---|
| **Reklam** (usta öne-çıkma, pazarlama) | Kullanıcı havuz kartında "öncelikli göster"; partner ustaya aylık abonelik | 50-200 TL/usta/ay (V2) |
| **Garanti paketi** | Müşteri iş başına +%5 ek ödeme → Naro garantisi | +50-150 TL/vaka (V1.1) |
| **Kupon + kampanya** (marka sponsorluk) | Yedek parça üretici / yağ markası kupon sponsoru | Değişken, pilot-dışı |
| **Filo (B2B)** | Kurumsal filo aylık abone paket | 2.000-10.000 TL/filo/ay (V2) |
| **Sigorta co-branded** | Sigortalı kullanıcıdan poliçe geliri payı | Pilot-dışı |
| **Araç satış-öncesi inceleme** | 2. el alım öncesi 500-800 TL paket | Niş, orta-vadeli |
| **Ödeme işlem ücreti** | Kartla ödemede %0.5-1 | Düşük ama ölçek |

Yan gelirler V1.1-V2 konusu, bu doküman v1'de sadece çekirdek komisyon modelini kapsıyor.

---

## 2. Unit Economics — LTV / CAC / Payback

### 2.1 Kullanıcı (demand) unit economics

**Yıllık Naro payı (pilot %5):** 500 TL/kullanıcı
**Yıllık Naro payı (post-pilot %7-8):** 700-900 TL/kullanıcı

**Retention varsayımları (pilot öncesi, tahmini):**
- Yıl 1 → Yıl 2: %60 (pasif değer mekanizmaları T+60 canlıysa)
- Yıl 2 → Yıl 3: %70
- Yıl 3+: %80

**3 yıllık LTV (pilot komisyon %5):**
- Yıl 1: 500 TL × %100 = 500
- Yıl 2: 500 TL × %60 = 300
- Yıl 3: 500 TL × %42 = 210
- **Toplam: 1.010 TL**

**3 yıllık LTV (post-pilot %7-8):**
- Yıl 1: 800 × %100 = 800
- Yıl 2: 800 × %60 = 480
- Yıl 3: 800 × %42 = 336
- **Toplam: 1.616 TL**

**CAC hedefleri (LTV/CAC ≥ 3 disiplini):**
- Pilot dönemi: ≤ 335 TL/kayıt
- Post-pilot: ≤ 540 TL/kayıt

Pilot kanal bazı CAC tahmini:
| Kanal | Tahmini CAC | LTV/CAC |
|---|---|---|
| A — Usta müşteri listesi | 10-30 TL | 33-100 |
| B — Yan esnaf | 20-50 TL | 20-50 |
| C — Sigorta acente | 40-80 TL | 12-25 |
| D — IG paid | 15-50 TL | 20-66 |
| E — Yerel IG/YT kanal | 30-100 TL | 10-33 |
| F — Referral | 5-20 TL | 50-200 |
| G — Fiziksel nokta | 50-150 TL | 7-20 |

Tüm kanallar LTV/CAC ≥ 7 rahat geçiyor — **paid marketing dahi yapabiliriz**. Ama güven-transferi kanalları **10× daha iyi** → önce onlar.

### 2.2 Usta (supply) unit economics — partner ustanın net kazancı

Partner usta için Naro ile çalışmanın **neden avantajlı** olduğunun matematiği:

**Varsayım:** Partner usta Naro öncesi aylık 40 vaka, ortalama 2.000 TL ticket, toplam 80.000 TL/ay GMV. Naro ile:
- +%20 iş yönlendirmesi (8 ek vaka/ay) — platform kanalı sayesinde
- %5 komisyon pilot (ilk 3 ay)
- Rozet + SLA + kampanya görünürlüğü

Naro **sonrası** hesap:
- 48 vaka × 2.000 TL = 96.000 TL GMV
- Naro komisyonu: 96.000 × %5 = 4.800 TL
- Usta net: 91.200 TL/ay
- Eski durumda 80.000 TL → **net +11.200 TL** (%14 gelir artışı)

Bu hesap disinter'a karşı direncin kaynağı: usta platformda kalmayı matematiksel olarak tercih eder. Ama **yalnız %20 yönlendirme getirirsek**. Getiremezsek matematik bozulur.

**Kritik kontrol (pilot KPI):** "Partner usta başına aylık Naro-kaynaklı yönlendirme" **≥ 8** olmalı. Altına düşerse usta sızma başlar.

### 2.3 Senaryolar (1.000 kullanıcılı Kayseri pilot sonu — T+90)

| Senaryo | Aktif kullanıcı | Yıllık GMV | Yıllık Naro payı |
|---|---|---|---|
| Kötü | 300 (retention %60) | 300 × 4 × 1.600 = 1.92M TL | %5 = 96.000 TL |
| Baz | 600 (retention %80) | 600 × 4 × 1.800 = 4.32M TL | %5 = 216.000 TL |
| İyi | 900 (retention %90) | 900 × 4.5 × 2.000 = 8.1M TL | %7 (post-pilot) = 567.000 TL |

### 2.4 10 şehir ölçeği (T+540 / 18 ay hedef)

10 şehir × 5.000 aktif kullanıcı = 50.000 aktif kullanıcı
- Baz LTV 500 TL/yıl × 50K = **25M TL/yıl Naro payı**
- Post-pilot komisyon + yan gelirler devreye: **35-50M TL/yıl potansiyel**

---

## 3. Gelir modeli ilkeleri

### 3.1 Komisyon piramidi — "kolay baştan, sert yukarı"

Naro komisyonu pilot dönemde düşük (%5), partner ustanın bağlanmasını sağlar. Platform değerini kanıtladıktan sonra piramit şekillendirilir:
- Bakım + lastik: %5 → %8 (artış kademeli)
- Arıza: %5 → %8
- Kaza: %3 sabit (sigorta pazarlığı)
- Çekici: %10 → %15 (acil hizmet, platformun SLA değeri yüksek)

**Sıra:** Kullanıcı güveni → usta bağlılığı → komisyon optimizasyonu. Terk sırası: önce komisyon optimizasyonu → usta kaçar.

### 3.2 Platform değer paketi — komisyonu haklı kılmak

Usta %5 ödeyerek ne alıyor?
- Naro-kaynaklı yeni iş akışı (%20+ yönlendirme)
- Naro Partner rozeti (statü + güven)
- Otomatik fatura + e-Arşiv (bazı ustalar bunu zaten yapmıyor, Naro yardımı büyük)
- Müşteri eşleştirme + pre-screening (boş iş kaybı)
- Escrow (ödeme alamama riski sıfır)
- Puan + yorum + tekrar müşteri (kendi marka inşası)
- Kampanya görünürlüğü (reklam değeri)

Eğer bu paket "platform-dışı WhatsApp" alternatifinin üzerinde değer yaratırsa, komisyon makul. Pilot'ta bunu test edeceğiz.

### 3.3 Müşteri tarafında fiyatlandırma — şeffaf

Naro **müşteriye ek ücret almaz** (komisyonu ustadan çeker). Bu önemli — kullanıcı "app ekstra fiyat biniyor mu?" paranoyasına kapılmamalı.

İstisna: V1.1 Garanti paketi — iş başına opsiyonel +%5 (Naro garantisi). Müşteri net tercihi.

### 3.4 Fiyat kontrolü — disiplin

- Usta fiyatı **açıkça** göstermeli (vaka açılışta ticket aralığı)
- Naro "tavsiye edilen fiyat aralığı" yayınlar (post-pilot veri ile)
- Aşırı uç fiyat → moderasyon (3× ortalama üzeri otomatik flag)
- Altı da: zarar satış tespiti → dumping anti-disiplini

### 3.5 Ödeme akışı

- Vaka tamamlanması → preauth tutar düşer (müşteri kartından)
- 48 saat müşteri itiraz hakkı (tutar escrow'da)
- İtiraz yoksa → ustaya ödeme (komisyon düşülmüş)
- İtiraz varsa → Naro moderasyonu (3 gün)

Escrow Naro'nun ek-finansman maliyeti: Toplam GMV'nin ~1/12'si (ortalama 2-4 hafta beklet). 10M TL GMV için ~800K TL çalışma sermayesi.

---

## 4. Senaryo stres testi

### 4.1 Kötü senaryo: retention %40

- LTV 750 TL'ye düşer (1.010'dan)
- CAC eşiği ~250 TL'ye iner
- Paid marketing marjinal
- **Aksiyon:** Retention mekaniği T+30'a alınır, T+60 geç olabilir

### 4.2 Orta: usta bağlılığı kırılıyor

- %20 usta ilk 6 ayda bırakır
- Arz krizi → vaka kapatılamıyor → kullanıcı gider
- **Aksiyon:** Usta economic check %8 yönlendirme altına düşünce alarm + kampanya + ek teşvik

### 4.3 İyi: sigorta ortaklığı kapısı açılır

- Ulusal sigorta ile co-branded dağıtım
- Sıfır-CAC kullanıcı akışı
- Sigorta-side komisyon geliri + kaza dikeyi volume × 5
- **Aksiyon:** T+60 MoU planı hazır olsun

---

## 5. Bu dokümanın yaşam döngüsü

- **T+30 revizyon:** Pilot gerçek GMV + retention + usta yönlendirme verisiyle ilk revize
- **T+90 revizyon:** Pilot sonu — post-pilot komisyon piramidine geçiş kararı
- **T+180 revizyon:** Şehir genişlemesi sonrası ölçek ekonomisi etkisi
- **T+365 revizyon:** Yan gelir kalemleri (reklam + garanti + B2B) aktive olduğunda

Her revizyon KARAR-LOG'a düşer, bu dokümanda **revize tarihi + gerekçe** saklanır.

---

## 6. Referanslar

- [../analiz/2026-04-21-servis-ziyaret-frekansi.md](../analiz/2026-04-21-servis-ziyaret-frekansi.md) — frekans varsayımları
- [../strateji/ayristirici-tez-ve-moat.md](../strateji/ayristirici-tez-ve-moat.md) — stratejik çerçeve
- [../risk/risk-kayit-defteri.md](../risk/risk-kayit-defteri.md) — R002, R012, R014 (disinter + retention + matematik)
- [../gtm/lansman-plani.md](../gtm/lansman-plani.md) — komisyon + teşvik pilot uygulaması
- [../KARAR-LOG.md](../KARAR-LOG.md) — 2026-04-21 frekans revize + pilot %5 komisyon kararları
