# Naro — Sigorta Yan Gelir Stratejisi

**Statü:** Canonical strateji v1 · 2026-04-24
**İlgili:** [gelir-modeli.md](gelir-modeli.md) · [odeme-modeli-yasal-cerceve.md](odeme-modeli-yasal-cerceve.md) · [../KARAR-LOG.md](../KARAR-LOG.md) · [../ortakliklar/pipeline.md](../ortakliklar/pipeline.md) · [../risk/risk-kayit-defteri.md](../risk/risk-kayit-defteri.md) (R005)

---

## 0. Tek paragraflık tez

Türkiye'de yıllık 250+ milyar TL trafik+kasko premium hacmi var. Naro'nun aktif kullanıcısı ortalama yılda ₺10-15K sigorta primi ödüyor. **Naro'ya sigorta dağıtım kanalı eklemek LTV'yi 2-3× sıçratır.** Ancak doğrudan acentelik (SEGEM lisansı + sigorta şirketi sözleşmesi) **9-18 ay + 500K-1M TL yatırım**. Pilot bunun altında. **İki yollu strateji:** (1) lansmanla birlikte aggregator affiliate partnership başlat (1-2 haftada canlı, küçük ama anında gelir); (2) pilot başarısı kanıtlandıktan sonra V1.1 yatırım kararı olarak kendi Naro Acente Ltd. yapısını kur.

---

## 1. Türkiye sigorta acentelik regülasyonu (gerçek)

- **SEGEM (Sigortacılık ve Bireysel Emeklilik Düzenleme ve Denetleme Kurumu) lisansı zorunlu.** Bypass yok.
- **TSB Levha** kaydı (Türkiye Sigorta Birliği)
- **Mesleki Sorumluluk Sigortası** — yıllık ₺50-200K premium
- **Kıdemli sigortacı işe alma zorunlu** (SEGEM sınavı geçmiş kişi)
- **Sigorta şirketleri ile B2B sözleşme + API erişimi** — Anadolu, Allianz, AXA, Türkiye Sigorta vb. her biri ayrı sözleşme + onay süreci
- **TRAMER/SBM erişimi** sadece lisanslı acentelere açık (yaygın yanılgı: "ben veri sahibiyim, direkt sorgularım" → hayır, regülasyon).

**Toplam lisans + ekosistem entegrasyon süresi: 9-18 ay.** Pilot ile uyumsuz.

---

## 2. İki yol — karşılaştırma

| Boyut | **Yol 1: Aggregator Affiliate** | **Yol 2: Naro Acente Ltd. (kendi)** |
|---|---|---|
| Başlangıç süresi | 1-2 hafta (sözleşme + entegrasyon) | 9-18 ay (lisans + sözleşme + API) |
| Lisans | Yok (aggregator'ın lisansı altında) | SEGEM acente belgesi |
| Yatırım | ~₺0 (sözleşme + integration) | ₺500K-1M + yıllık ₺200-500K işletme |
| Naro komisyonu | %2-5 prim üzeri (poliçe başı ₺50-150) | %10-15 prim üzeri |
| Naro tahmini gelir (1.000 aktif müşteri) | ₺200-500K/yıl | ₺1-2.25M/yıl |
| Naro tahmini gelir (10.000 aktif müşteri) | ₺2-5M/yıl | ₺10-22M/yıl |
| Müşteri verisi kontrol | Düşük (aggregator'a transfer) | Tam (Naro içinde) |
| UX akışı | App-dışı (deeplink/webview aggregator'a) | App-içi native karşılaştırma + satın alma |
| Risk | Düşük | Lisans + denetim + kıdemli istihdam yükü |
| Kayseri yerel acente kanalına etki | Yok | "Rakip" haline gelir → mitigasyon gerek |

**Karar:** Yol 1 hemen, Yol 2 V1.1 yatırım kararı.

---

## 3. Yol 1 — Aggregator partnership planı (T-0 başlatılabilir)

### 3.1 Aday aggregator'lar (Türkiye)

| Aggregator | Notlar | Affiliate açık mı | Komisyon |
|---|---|---|---|
| **Sigortam.net** | Sektör lideri, partnership açık | ✓ | %2-4 prim veya ₺50-100/poliçe |
| **Hangisigortam** | Yapı Kredi/Fintur kökenli, kurumsal yaklaşım | ✓ (B2B partnership) | Pazarlık konusu |
| **Koalay** | Allianz grubu, sınırlı affiliate | ? | Düşük |
| **GoSigorta** | Yeni oyuncu, agresif fiyat | ✓ | Yüksek başlangıç ücreti |
| **Akıllı Sigortam** | Yeni, partnership açık | ✓ | Pazarlık |

### 3.2 Pilot için öneri

**Sigortam.net** birincil hedef. Sebepleri:
- Türkiye marketplace deneyimi en derin
- API + tracking altyapısı stabil
- Türk pazarındaki marka tanınırlığı yüksek (kullanıcı geçişte güven kaybı düşük)
- B2B partnership ekibi aktif

**Yedek:** Hangisigortam (kurumsal kanaldan ulaşılır)
**Plan B:** GoSigorta / Akıllı Sigortam (eğer ana oyuncularla anlaşamazsak)

### 3.3 Akış — In-App Webview (kullanıcı Naro'dan çıkmaz)

```
Naro app → Vehicle Detail / Profile sayfası
                    ↓
        "Sigortayı app'ten yenile" CTA
                    ↓
        [Naro markası ile branded webview açılır]
                    ↓
        Webview içinde Sigortam.net co-branded checkout
        (Naro renkleri, Naro header — sözleşmesel madde)
                    ↓
        Kullanıcı kart bilgisi girer → ÖDEME aggregator PSP'sine
                    ↓
        Aggregator poliçeyi sigorta şirketine iletir + müşteriye e-mail
                    ↓
        Webview kapanır, Naro app'te "Poliçeniz onaylandı" toast
                    ↓
        Sigortam.net Naro'ya tracking üzerinden komisyon yatırır (aylık batch)
```

**Kritik:** Para Naro hesabından **geçmiyor** — aggregator'ın PSP'si tahsilat alıyor. SEGEM lisans riski yok. Yasal olarak temiz.

**B2B sözleşme zorunlu maddeleri:**
- **Branded webview / co-branded checkout** — Naro renkleri + header. Yoksa marka kopukluğu.
- **Tracking + attribution** — Naro affiliate ID poliçe başına geri okunabilir.
- **Komisyon ödeme periyodu** — aylık batch, IBAN'a transfer.
- **Veri paylaşımı** — Naro müşteriye aggregator'a hangi data paylaşıldığını gösterme yetkisine sahip (KVKK).

**Conversion etkisi:** Webview pattern (in-app) vs deeplink (app dışı) için sektör verisi: webview %5-7 dönüşüm, deeplink %2-3. Webview pazarlanmalı.

### 3.4 Aksiyon takvimi

- **T+0 → T+7:** Sigortam.net B2B sales temas + sözleşme şartları görüşmesi
- **T+7 → T+14:** Sözleşme imza + API/affiliate ID alma + entegrasyon
- **T+14 → T+30:** Pilot kullanıcılarda canlı, dönüşüm metriği takip
- **T+30:** Performans değerlendirmesi → komisyon pazarlığı veya alternatif aggregator değerlendirmesi

### 3.5 Pilot tahmini gelir (in-app webview pattern ile revize)

Webview dönüşüm oranı (%5-7) deeplink'ten (%2-3) yüksek. Revize tahmin:

- Pilot 1.000 kullanıcı × %10 sigorta CTA tıklama × **%6 dönüşüm** = **6 poliçe/ay**
- 6 × ₺100 ortalama komisyon = **₺600-1.000/ay** ilk 3 ay
- T+180 (5.000 kullanıcı) → ₺3.500-5.000/ay
- T+365 (15.000 kullanıcı) → ₺11K-15K/ay (yıllık ₺130-180K)

**Pilotta sembolik ama anlamlı gelir.** Webview pattern ile UX kopukluğu sıfır → kullanıcı "sigorta da Naro'da" hissi → marka derinliği. Asıl ölçek geliri yine Yol 2'de.

---

## 4. Yol 2 — JV / Ortak Acente (V1.1 öncelikli) ⭐

**Reframe (2026-04-24 PO sorgulaması):** "Tek başına Naro Acente kurma" tek seçenek değil. Aslında **JV ile ortak acente** süresi 3× kısa, yatırımı %50 düşük.

### 4.0 Dört yapısal alternatif

| Yapı | Süre | Yatırım | Lisans | Komisyon | Tercih |
|---|---|---|---|---|---|
| A. Affiliate (Yol 1) | 1-2 hafta | ~₺0 | Yok | %2-5 | ✓ T+0 başlatılır |
| B. Tek acente exclusive partnership | 1-2 ay | ₺50-100K | Yok (acentenin) | %5-10 | İhtiyaç olursa |
| **C. JV / ortak acente** | **3-6 ay** | **₺200-500K** | Yok (ortağın) | %10-15 | **Tercih edilen Yol 2** ⭐ |
| D. Tek başına Naro Acente | 9-18 ay | ₺500K-1M+ | SEGEM süreç | %12-15 | Sadece JV başarısızsa |

### 4.1 JV — Yapısal model (Yol C öncelik)

Türkiye'de **lisanslı ama dijitale geçemeyen** orta-büyük acenteler var (5-15 sigorta şirketi sözleşmeli, 1.000-10.000 müşteri portföyü). Naro onlara:
- **Biz:** dijital + müşteri tabanı + UX + ürün
- **Onlar:** SEGEM lisansı + sigorta şirketi sözleşmeleri + sigortacı kadro + müşteri portföyü
- **Birlikte:** JV ortaklık → "Naro Sigorta Acentelik" markası

#### Ortaklık çerçevesi (iki olası şekil)

1. **Naro %51 hakim ortak** — kontrol Naro'da, exit kolay (ortak %49 hisse hakkı, ama stratejik karar Naro'da)
2. **50/50 + yönetim hakları özel madde** — Naro onaysız stratejik karar yok (kilit pozisyon)

### 4.2 Doğru ortak profili (aday avı kriterleri)

- 5+ sigorta şirketi ile aktif sözleşmesi olan
- Yıllık ₺50-200M poliçe primi yazan (orta ölçek; çok büyük olursa Naro'yu yutmaya çalışır)
- 2-5 personelli ofis (büyük olunca yönetim ağır)
- Sahibi 50+ yaş ve **dijital geçişe açık** (yaşlı ortak veto eder, dijitale uyum şart)
- Türkiye'de coğrafi olarak nötr (sadece Kayseri'de değil; ülke geneli ölçeklensin)

### 4.3 JV avantajları

- **Süre 3× kısa:** Lisans bekleme yok (3-6 ay vs solo 9-18 ay)
- **Yatırım %50 düşük:** ₺200-500K (Naro %51 hisse) vs solo ₺500K-1M
- **Hazır insan kaynağı:** Ortağın kıdemli sigortacı kadrosu + portföy yöneticisi
- **Mevcut portföy:** Ortağın 1.000-10.000 müşterisi cross-sell potansiyeli
- **Sigorta şirketi entegrasyonları:** API + sözleşmeler hazır

### 4.4 JV riskleri

- **Ortak seçimi kritik** — yanlış ortak = stratejik çatışma + exit zorluğu (bu yüzden due diligence şart)
- **Karar paylaşımı** — geleneksel acente bakışı vs Naro ürün odağı çatışabilir (sözleşmesel onay yapısı önceden net yazılmalı)
- **Marka çelişkisi** — JV markası "Naro Sigorta Acentelik" mi yoksa hibrit mi (pazarlık)
- **Çıkış maliyeti** — ortağın hissesini gelecekte satın alma maliyeti (ön anlaşma "shotgun clause")

### 4.5 Çoklu acente partnership — neden yapısal sorun

PO öneri: "Birden fazla acente ile anlaşalım."

Yapısal sınır: Naro 3-5 ayrı acenteye müşteri yönlendirip her birinden komisyon alırsa → **Naro aracı pozisyonu** → SEGEM kendi acentesi olarak lisans gerektirir (TSB yorumu). Yapısal yan etki:

- **Affiliate model (tek aggregator):** Sorun yok — aggregator zaten lisanslı, Naro pazarlama-içi.
- **Çoklu acente Naro yönlendirme:** Sorun var — Naro çoklu kanal aracı olur.
- **JV (tek ortak):** Sorun yok — Naro JV ortaklığında ortağın lisansı altında.
- **Tek başına Naro Acente:** Sorun yok — kendi lisansı.

**Sonuç:** Çoklu acente "kanal" olarak değil, **JV bir ortakla** veya **tek acente exclusive** olmalı.

### 4.6 Acente aday avı (T+30+)

JV ortağı bulma kanalları:
1. **TSB Levha** — kayıtlı tüm acentelerin listesi, kriter filtreleyelim
2. **Sigorta dergileri/etkinlikleri** — "Sigorta Gündem", TSB sempozyumları, TASKEM, Sigorta Aracıları Derneği etkinlikleri
3. **Hukuk + mali danışman ağı** — kurumsal hukuk firmaları sigorta acente exit isteyenleri biliyor
4. **Yatırımcı ağı** — Naro'nun yatırımcı ekosistemi, sigorta sektöründen referans

İdeal akış: 5-10 acente temas → 2-3 derin görüşme → due diligence → 1 JV imzası. Toplam 2-3 ay.

### 4.7 Süreç (T+30 başlatma → T+360 canlı, JV ile)

| Faz | Süre | İçerik |
|---|---|---|
| Aday avı | T+30 → T+60 | TSB filtre + temas + 5-10 görüşme |
| Due diligence | T+60 → T+90 | 2-3 ortakla derin DD (mali, hukuki, kültürel uyum) |
| JV sözleşme + kuruluş | T+90 → T+150 | Hisse pazarlığı + yönetim hakları + sermaye + tescil |
| Sigorta şirketi onaylar | T+90 → T+180 | JV yapısının sigorta şirketleri tarafından kabulü (paralel) |
| Native UX geliştirme | T+150 → T+270 | Naro app içinde sigorta karşılaştırma + native ödeme |
| Soft launch | T+270 → T+360 | JV markası altında pilot kullanıcılarda |

**Solo (Yol D) plan B olarak korunur:** JV görüşmeleri başarısız olursa T+90'da Naro Acente Ltd. tek başına yola devam edebilir. Ama ekstra 6-12 ay süre + ekstra ₺500K-1M yatırım maliyeti.

### 4.8 JV native ödeme akışı

Yol C (JV) ile Yol D (solo) ödeme akışı aynı — PSP marketplace + sub-merchant + split:

```
Naro app → Native sigorta karşılaştırma + satın alma
              ↓
       Müşteri kart bilgisi Naro app'te girer
              ↓
       PSP (iyzico Marketplace) tahsilat alır
              ↓
       Otomatik split:
         - Sigorta şirketi alt-merchant: %85-88 (prim)
         - JV (Naro Sigorta Acentelik) alt-merchant: %12-15 (komisyon)
              ↓
       JV sigorta şirketine poliçe veri push (API)
              ↓
       Müşteri app'te "Poliçeniz aktif" + dijital sigorta belgesi
              ↓
       JV gelirinin %51'i Naro'ya, %49'u ortak acenteye (kar payı dağıtımı)
```

### 4.9 Yatırım + ROI (JV)

- JV kuruluş + sermaye payı (Naro %51): ₺200-300K
- Native UX geliştirme: ₺200-400K
- Hukuk + mali müşavir DD süreci: ₺50-100K
- İlk yıl JV operasyonel pay (Naro %51 maliyetin): ₺200-400K (ortağın mevcut kadrosu olduğu için düşük)

**Toplam 1. yıl yatırım: ~₺600-900K** (solo Yol D'den ₺500K-1M tasarruf)

**ROI:** 10K aktif kullanıcı × yıllık ₺12K prim × %12 komisyon × Naro %51 payı = **yıllık ₺7.3M Naro net geliri**. T+540'a kadar 10K kullanıcıya ulaşılırsa pozitif ROI.

## 5. Yol E — Trojan Horse / Dual-Play Marketplace (2026-04-24 yeni stratejik katman) ⭐⭐

**PO sezgisi:** Acenteleri Naro'nun dijital tedarikçisi olarak çek; müşterileri de gel; sonra kendi acentelik kurarak rekabete gir.

Sektörel adı: **"Dual-Play Marketplace Strategy"** — önce supplier ol, sonra rekabete gir. Trendyol/HepsiBurada/Hangisigortam pattern'i.

### 5.1 Faz akışı

```
Faz 1: Acente için iş kolaylaştırıcı araç sun (lead havuzu, CRM, hasar asistan, hatırlatma)
       → Acente Naro'yu günlük operasyonda kullanır
       → Müşteri verisi Naro'da birikir
       → Acentenin müşterileri Naro app'i indirir (co-branded pitch)
Faz 2: Naro kullanıcı tabanı sigorta tarafında ısınır
Faz 3: Naro JV / kendi acentelik kurar (Yol C veya D)
Faz 4: "Marketplace içi rekabet" — mevcut acente + Naro acente paralel teklif
       → Müşteri en iyi fiyatı seçer
       → Eski müşteri için acente komisyonu kayıp YOK (zaten onun müşterisi)
       → Yeni müşteri için Naro acente rekabette
```

### 5.2 Acenteyi Naro'ya çeken 6 somut araç

| # | Araç | Pilot başlangıç | Acente için fayda | Naro için fayda |
|---|---|---|---|---|
| 1 | **Acente Lead Havuzu** ⭐ | T+14 | Müşteri kazanma maliyeti düşer | Lead komisyonu (₺50-100/lead), lisanssız |
| 2 | **Acente CRM (ücretsiz)** | T+60 | Excel/WhatsApp dağınıklığı çözülür | Müşteri verisi Naro'da birikir |
| 3 | **Co-Branded Naro App** | T+60 | "Müşterilerimle modern" imajı | Müşteri tabanı eklenmesi (acentenin 1K-5K müşterisi) |
| 4 | **Hasar Dosyası Asistan** | T+120 | Operasyonel yük azalır | Hasar verisi zenginleşir |
| 5 | **Müşteri Hatırlatma Otomasyon** | T+120 | Müşteri takibi düşük effort | Acente Naro'ya bağımlı |
| 6 | **Ortak Komisyon Paylaşımı (Faz 4)** | T+360 | Müşterisinden gelir kaybetmiyor | Acentenin müşterisi de Naro kanalında poliçe yenileyebilir |

### 5.3 Kademeli zaman çizelgesi (entegre)

```
T+0  → T+14  : Sigortam.net affiliate (Yol A) canlı — pilot küçük gelir
T+14 → T+60  : Acente Lead Havuzu pilot — Kayseri 3-5 acente ile
                Naro app "sigorta teklif al" → acentelere yönlendirme
T+60 → T+120 : Acente CRM v1 + Co-Branded App pitch hazır
                Acentenin müşterileri Naro app'i indirmeye başlar
T+120 → T+180: Hasar Dosyası Asistan + Hatırlatma Otomasyon
T+180 → T+360: JV görüşmesi (Yol C) — pazarlık gücü zirvede
                (acente zaten Naro araçlarını kullanıyor + müşterileri Naro'da)
T+360 → T+540: JV / Naro Acente Ltd. canlı
                Marketplace içi rekabet (Faz 4)
                Mevcut acente + Naro acente paralel teklif
                Toplam sigorta pastası BÜYÜR (rekabet pazarı genişletir)
```

### 5.4 Etik + hukuki nüans

User'ın endişesi haklı: "acenteyi kullanıp atmak" itibarsızlık riski. Mitigasyon:

1. **Açık sözleşme** — Naro acente kurma hakkını saklı tutar maddesi sözleşmenin başında
2. **Kazandır-kazandır pozisyon** — acente Naro araçlarını kullanırken kendi müşterisinden gelir kaybetmiyor; Naro sadece **yeni müşteriler** için rekabette
3. **Segment ayrıştırması** — acentenin geleneksel kanalı (telefon, ofis, kapıda satış) Naro'nun rakip değil; Naro dijital genç segment
4. **"Marketplace içi rekabet" çerçeveleme** — acente düşman değil, partner; toplam pasta büyüyor
5. **Açık iletişim** — Naro her acenteye "biz uzun vadede kendi acentelik yapacağız, ama şu anda araç sunuyoruz" der. Saklamadan.

### 5.5 Türkiye sektör örnekleri (validation)

- **Hangisigortam.com** — önce sigorta şirketleri için ürün satış kanalı, sonra kendi pazarlama ürünüyle paralel rekabet → bugün hem aggregator hem distribütör
- **Trendyol** — Trendyol Market kendi ürünleriyle platform satıcılarıyla rekabet (sözleşmede açık)
- **HepsiBurada** — HepsiExpress kendi servisleriyle platform restoranlarıyla paralel
- **Yemeksepeti** — Joker'in kendi içinde ürün satışı (V2)
- **Amazon** — kendi marka ürünleri (Amazon Basics) platform satıcılarıyla rekabet (en eski örnek)

Sektör reaksiyonu: ilk direniş, sonra adapt → "ben de orada olayım" → sonuç olarak 2 yıl önde başlamak avantaj.

### 5.6 JV görüşmesinde pazarlık gücü etkisi

Bu strateji **Yol C (JV)** kararını da güçlendirir:

| Faktör | JV-önce (eski plan) | Trojan Horse-sonra (yeni plan) |
|---|---|---|
| Naro pazarlık gücü | Sıfır kullanıcı tabanı, lisansa bağımlı | 5K+ kullanıcı + acente Naro araçlarını kullanıyor |
| Acente seçim havuzu | Az (kim ortak olur ki) | Çok (zaten araçlarımızı kullanan acentelerden seç) |
| JV hisse pazarlığı | Naro %51 zorunlu hak iddiası | Naro %60-70 talep edebilir (zaten platform sahip) |
| Sigorta şirketi onayları | Belirsiz (Naro tanınmıyor) | Daha hızlı (Naro yıllık X bin lead getiriyor) |

### 5.7 Pilot için bugün başlatılabilir mi

Kısa cevap: **EVET**, en azından Araç 1 (Lead Havuzu).

Yapılması gerekenler (T+0 → T+14):
1. Kayseri'deki **3-5 sigorta acentesiyle B2B temas** ([gtm/lansman-plani.md Kanal C](../gtm/lansman-plani.md) zaten bu acenteleri "kullanıcı edinme partneri" olarak listeliyor — şimdi onlara **iki yönlü kanal** olarak çıkarız)
2. Naro app'te **"Sigorta yenile" CTA** ekle → acentelere yönlendirme akışı
3. Acentelere lead başına **₺50-100 komisyon** ödeme (Naro PSP üzerinden veya basit IBAN)
4. Tracking: Naro affiliate ID + telefon eşleştirme

Süreç + dokümantasyon: 2 hafta. **Pilot lansmanından önce başlamak gerek değil** — T+14'te Lead Havuzu canlıya girer, ondan önce affiliate (Yol A) çalışıyor olur.

## 6. Yol D — Tek başına Naro Acente (yedek plan)

### 4.1 Yapı

Naro Teknoloji Ltd. + Naro Acente Ltd. (ayrı tüzel kişilikler, sahibi aynı holding/ortaklar):
- Acente Ltd. SEGEM lisansı + sigorta şirketi sözleşmeleri
- Teknoloji Ltd. app'i geliştirir + acente Ltd.'nin müşterilerine kullanıcı tabanını sunar
- İki şirket arası B2B sözleşme (Naro app, Acente'nin pazarlama kanalı)

### 4.2 Native ödeme akışı (PSP Marketplace + sub-merchant)

Çekici ödeme ile aynı pattern, sigorta şirketleri sub-merchant olarak:

```
Naro app → Native sigorta karşılaştırma + satın alma
              ↓
       Müşteri kart bilgisi Naro app'te girer
              ↓
       PSP (iyzico Marketplace) tahsilat alır
              ↓
       Otomatik split:
         - Sigorta şirketi alt-merchant: %85-88 (prim)
         - Naro Acente Ltd. alt-merchant: %12-15 (komisyon)
              ↓
       Naro Acente sigorta şirketine poliçe veri push (API)
              ↓
       Müşteri app'te "Poliçeniz aktif" + dijital sigorta belgesi
```

Tam app içi, tam Naro markası, para Naro Acente Ltd. üzerinden lisanslı yapı. Lisans + PSP marketplace + tek katmanda KDV.

### 4.3 Süreç (T+90 başlatma → T+540 canlı)

| Faz | Süre | İçerik |
|---|---|---|
| Hazırlık | T+90 → T+120 | Naro Acente Ltd. kuruluşu + ortaklık yapısı |
| SEGEM eğitim | T+120 → T+210 | Kurucu ortak veya istihdam ettiği sigortacı SEGEM eğitimi + sınav (3 ay) |
| Lisans başvuru | T+210 → T+330 | Acente belgesi başvuru + denetim (3-4 ay) |
| Sigorta şirketi sözleşmeleri | T+150 → T+360 | Paralel: 3-5 sigorta şirketi B2B + API entegrasyon (6-12 ay) |
| Native UX geliştirme | T+330 → T+450 | App içi teklif karşılaştırma + satın alma akışı |
| Soft launch | T+450 → T+540 | Sınırlı kullanıcı, kalibrasyon |

### 4.4 Yatırım + maliyet

- Acente Ltd. kuruluş + sermaye: ₺50-100K
- SEGEM eğitim + sınav: ₺25-50K (kurucu için) veya istihdam edilenin maaş + sınav
- Mesleki Sorumluluk Sigortası: ₺50-200K/yıl
- Kıdemli sigortacı maaşı: ₺40-80K/ay (yıllık ₺500K-1M)
- Native UX geliştirme: ₺200-400K (3 ay × ₺70-130K/ay frontend+backend)
- Sigorta şirketi entegrasyon başlangıç ücretleri: değişken

**Toplam yıllık 1. yıl: ~₺1-1.5M** (insan kaynağı dominant). 2. yıl operasyonel: ~₺700K-1.2M.

### 4.5 ROI

10.000 aktif kullanıcı × ortalama yıllık prim ₺12K × **%12 ortalama komisyon** = **yıllık ₺14.4M** gelir potansiyeli.

10K aktif kullanıcı seviyesinde ROI pozitif. T+540'a kadar bu sayıya ulaşmak Yol 1'i (affiliate) paralel sürdürerek olası.

---

## 5. Kayseri yerel sigorta acentesi kanalı — uyum

Pilot lansmanında [Kanal C](../gtm/lansman-plani.md): yerel sigorta acenteleri Naro'ya kullanıcı yönlendiriyor (poliçe satış sırasında "kaza/arıza tek tıkta" pitch'i). **Yol 2'ye geçilirse bu kanal "rakip" hale gelir.**

**Mitigasyon:**
- Pilot (T+0 → T+180): Yerel acentelerle Kanal C kullanıcı edinme aktif tut
- Yol 2 lansmanı (T+540): Naro Acente, yerel acentelerle "iki taraflı pazarlama" anlaşması yapar — Naro Acente onları "yan satış kanalı" olarak konumlar (komisyon paylaşımı + müşteri yönlendirme)
- Düşman değil, ortak

---

## 6. Risk + uyumluluk

- **Yol 1 risk:** Aggregator partnership tek-taraflı sonlandırılabilir → çoklu partner stratejisi (en az 2 aggregator backup)
- **Yol 2 risk (R005 Sigorta SEGEM):** Lisans gecikme + denetim + kıdemli istihdam zorluğu → V1.1 yatırım onayı sırasında detay yapılır
- **Kayseri kanal kaybı (yeni risk R016):** Yol 2 ilan edilince yerel acenteler "rakipsiniz" diye Kanal C'yi keserse pilot+ölçek kaybı → "iki taraflı" yapılanma şart
- **Müşteri güvenlik:** Naro acente olunca **doğrudan müşteri sorumluluğu** yüklenir (yanlış teklif, yanlış kapsam) → kıdemli sigortacı + iyi kontrol mekanizmaları

---

## 7. Açık sorular (PO kararı bekleyen)

1. **Yol 1 hemen başlat onay mı?** (Sigortam.net B2B sales temas — saat bazlı iş, BD yapabilir)
2. **Yol 2 V1.1 yatırım onayı T+90'da mı yapılacak?** (Sermaye + insan kaynağı planlama tetiği)
3. **Naro Acente Ltd. yapısı kim koordine edecek?** (PO + dış mali müşavir + dış hukuk; pilot başarısı sonrası)
4. **Kayseri Kanal C uyum stratejisi:** Yol 2 ilan edildiğinde yerel acentelerle "iki-taraflı" sözleşme örneği şimdiden taslaklanmalı mı?

---

## 8. Yaşam döngüsü

- **T+30 revizyon:** Sigortam.net entegrasyon kalibrasyonu + ilk performans
- **T+90 revizyon:** Yol 2 yatırım kararı netleşmesi (pilot başarısına bağlı)
- **T+180 revizyon:** Yol 2 başlatılırsa hazırlık fazı başlar; Yol 1 paralel devam
- **T+540 revizyon:** Naro Acente Ltd. soft launch + Yol 1 phase-out planlaması (veya hibrit kalmaya karar)
