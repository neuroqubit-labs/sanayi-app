# BD — Stratejik Karar Günlüğü

Naro iş geliştirme tarafında alınan stratejik kararlar burada birikir.
Teknik (backend) karar günlüğü: [../veri-modeli/KARAR-LOG.md](../veri-modeli/KARAR-LOG.md).

## Format

```
### YYYY-MM-DD — [konu]

**Karar:** <tek cümle>
**Gerekçe:** <bağlam — hangi veri/sinyal/tartışma üzerine>
**Kapsam:** strateji | pazar | gtm | ortaklık | monetizasyon | risk
**Etki:** P0 | P1 | P2
**Aksiyon:** <kim ne yapıyor, hangi dokümana düştü>
**Validate edildi:** PM | data | pilot | henüz hayır
```

**Etki seviyeleri:**
- **P0** — şirket yönünü değiştirir (yeni dikey, coğrafya, pivot)
- **P1** — bu çeyrek planına etki eder (kanal, fiyat, ortaklık, lansman)
- **P2** — ergonomik / iç süreç kararı

**Yaşam döngüsü:**
- Yeni kararlar **en üste** eklenir (reverse chronological).
- Karar sonradan revize edilirse: eski girişi bozmayın, altına `**REVİZE YYYY-MM-DD:** ...` satırı düşün.
- Karar iptal olursa: `**İPTAL YYYY-MM-DD:** <gerekçe>` ile işaretle.

---

## Kararlar

<!-- En yeni üstte -->

### 2026-04-24 — Sigorta stratejisi GENİŞLEME: Trojan Horse / Dual-Play Marketplace (Yol E ekleme)

**PO sezgisi (gerçekten güçlü, sektörde validation var):** Önce acenteleri Naro'nun dijital aracı olarak çek (lead havuzu + CRM + co-branded app + hasar asistan), müşterileri de gel; sonra JV / kendi acentelik kurarak "marketplace içi rekabet" yapısı kur.

**Stratejik adı:** Dual-Play Marketplace / Supplier-then-Compete. Trendyol Market, HepsiExpress, Hangisigortam, Amazon Basics aynı pattern.

**Faz akışı:**
- **Faz 1 (T+0 → T+180):** Acenteleri **6 somut araçla** Naro'ya bağla — Lead Havuzu (T+14, en hızlı), CRM (T+60), Co-Branded App (T+60), Hasar Asistan (T+120), Hatırlatma Otomasyonu (T+120), Ortak Komisyon Paylaşımı (Faz 4'te)
- **Faz 2 (T+180 → T+360):** JV görüşmeleri (Yol C) — bu noktada Naro **pazarlık gücü zirvede** (acente Naro araçlarını kullanıyor, müşterileri Naro'da, sigorta şirketleri Naro'yu tanıyor)
- **Faz 3 (T+360 → T+540):** JV canlı + marketplace içi rekabet (Faz 4) — mevcut acente + Naro acente paralel teklif → toplam pasta büyür

**Pilot katkısı:**
- Lead Havuzu T+14'te canlı — Sigortam.net affiliate ile birlikte iki gelir kanalı
- Kayseri'deki [Kanal C acenteleri](../gtm/lansman-plani.md) bu kez "iki taraflı kanal" — onlara müşteri yönlendirir (lead komisyon), onlardan müşteri alır (Kanal C)

**Etik + hukuki:**
- Sözleşmede Naro'nun gelecekte acente kurma hakkı saklıdır maddesi açık olur
- Acente kendi mevcut müşterisinden gelir kaybetmez (Faz 4'te ortak komisyon paylaşımı)
- Naro sadece "yeni müşteriler" için rekabete girer
- "Marketplace içi rekabet" çerçeveleme — pasta büyür

**Bu strateji önceki Yol C (JV) kararını GÜÇLENDİRİR:**
| Faktör | Eski plan | Trojan Horse'la |
|---|---|---|
| Naro pazarlık gücü | Sıfır taban | 5K+ kullanıcı + acente bağımlılık |
| JV hisse pazarlığı | Naro %51 hak iddiası | Naro %60-70 talep edebilir |
| Acente seçim havuzu | Az | Çok (Naro araçlarını kullanan acentelerden) |

**Kapsam:** strateji + monetizasyon + ortaklık + uzun vadeli yatırım
**Etki:** P0 (V1.0 pilot katkı + V1.1 stratejik kalkış)
**Aksiyon:**
- Canonical doküman: [monetizasyon/sigorta-yan-gelir-stratejisi.md §5](monetizasyon/sigorta-yan-gelir-stratejisi.md) yeni Yol E bölümü eklendi
- T+0 → T+14: Sigortam.net affiliate (önceki karar) + Kayseri 3-5 acente Lead Havuzu temas (yeni)
- T+14 → T+60: Lead Havuzu canlı + Acente CRM v1 spec
- T+60 → T+180: Co-Branded App + Hasar Asistan + Hatırlatma sırasıyla rollout
- T+180+: JV görüşmeleri + Yol C kararı

**Validate edildi:** PO (2026-04-24, "acenteyi sisteme çek + müşterilerini de getir + sonra rekabete gir" sezgisi)

---

### 2026-04-24 — Sigorta stratejisi REVİZE: JV/ortak acente birinci yol, solo lisans yedek

**Reframe:** Önceki "Yol 2 — kendi başına Naro Acente Ltd." kararı **JV/ortak acente** ile revize edildi. Tek başına SEGEM lisansı (9-18 ay + ₺500K-1M) yerine bir orta-büyük lisanslı acente ile **JV (3-6 ay + ₺200-500K)**.

**Üç adımlı kademe:**
- **T+0 → T+30 (Yol A — Affiliate):** Sigortam.net affiliate (önceki karar) — webview pattern, küçük ama anında gelir
- **T+30 → T+90 (Yol C — JV aday avı):** TSB Levha + sigorta etkinlikleri üzerinden 5-10 acente temas → 2-3 derin görüşme → due diligence
- **T+90 → T+360 (JV canlı):** Sözleşme + kuruluş + sigorta şirketi onayları + native UX → soft launch
- **T+90 plan B:** JV görüşmeleri başarısızsa Yol D (solo SEGEM lisansı) yatırım kararı

**Yapısal not — çoklu acente neden uygun değil:**
Naro 3-5 ayrı acenteye müşteri yönlendirip her birinden komisyon alırsa → SEGEM aracı tanımı → kendi acentelik gerektirir. Çoklu acente "kanal" yapısı yapısal sorun çıkarır. Ya tek aggregator (affiliate, lisanssız) ya tek JV ortak (lisanslı altında) ya solo (kendi lisansı).

**Gerekçe (revize):**
- JV süresi 3× kısa, yatırım %50 düşük
- Ortağın hazır SEGEM lisansı + sigorta şirketi sözleşmeleri + kıdemli sigortacı + müşteri portföyü
- Naro %51 hakim ortak modeli (kontrol bizde, exit kolay)
- ROI: 10K kullanıcı × yıllık ₺12K prim × %12 komisyon × Naro %51 payı = **yıllık ₺7.3M net Naro geliri**
- Solo (Yol D) plan B olarak korunur

**Kapsam:** strateji + monetizasyon + ortaklık + uzun vadeli yatırım
**Etki:** P0 (V1.1 stratejik karar)
**Aksiyon:**
- Canonical doküman: [monetizasyon/sigorta-yan-gelir-stratejisi.md §4](monetizasyon/sigorta-yan-gelir-stratejisi.md) revize edildi
- Yol A pilot dahil aktif (Sigortam.net B2B temas T+0 → T+7)
- Yol C aday avı T+30'da başlar (TSB filtre + temas listesi)
- [risk/risk-kayit-defteri.md](risk/risk-kayit-defteri.md) → R016 (Kayseri Kanal C uyum) JV markası altında "iki taraflı pazarlama" sözleşmesiyle hala yönetilebilir

**Doğru ortak profili:**
- 5+ sigorta şirketi ile aktif sözleşmesi
- Yıllık ₺50-200M poliçe primi (orta ölçek)
- 2-5 personelli ofis
- Sahibi dijital geçişe açık
- Türkiye geneli (sadece bölgesel değil)

**Validate edildi:** PO (2026-04-24, "ortak da olabiliriz / çoklu acente?" soruları üzerine BD revizyonu)

---

### 2026-04-24 — Sigorta yan gelir stratejisi: iki yollu (affiliate hemen + acente V1.1)

**Karar:** Sigorta dağıtımı **iki yollu** planlanır:
- **Yol 1 — Aggregator affiliate (T-0 başlatılabilir):** Sigortam.net (birincil) ile B2B affiliate sözleşmesi. App'te "sigorta yenile / poliçe al" CTA, deeplink ile aggregator'a, dönüşüm başına Naro'ya komisyon (%2-5 prim veya ₺50-150/poliçe). 1-2 haftada canlı, yatırım sıfıra yakın. Pilot dahil tüm faz boyunca aktif.
- **Yol 2 — Naro Acente Ltd. (V1.1 yatırım kararı, T+90 onay → T+540 canlı):** SEGEM lisanslı kendi acentelik. 9-18 ay süreç, ₺1-1.5M ilk yıl yatırım. 10K kullanıcı seviyesinde ROI pozitif (yıllık potansiyel ₺10-22M).

**Gerekçe:**
- Pilot için SEGEM lisans imkansız (lansmana 3 gün)
- Affiliate hemen kanal açar — sembolik ama anında gelir + ölçüm
- Kendi acentelik %10-15 komisyon (affiliate'ten 3-5×) → ölçek ekonomisi
- Türkiye sigorta pazarı 250B+ TL → tek bu kanal LTV'yi 2-3× sıçratır
- Kayseri yerel acente Kanal C ile uyum: Yol 2 lansmanında "iki-taraflı pazarlama" sözleşmesi (rakip değil, ortak)

**Kapsam:** strateji + monetizasyon + ortaklık
**Etki:** Yol 1 P1 (hemen aktive); Yol 2 P0 yatırım kararı (T+90'da)
**Aksiyon:**
- Canonical doküman: [monetizasyon/sigorta-yan-gelir-stratejisi.md](monetizasyon/sigorta-yan-gelir-stratejisi.md)
- T+0 → T+7: Sigortam.net B2B sales temas (BD)
- [ortakliklar/pipeline.md](ortakliklar/pipeline.md) → P008 Sigortam.net affiliate eklenecek
- [risk/risk-kayit-defteri.md](risk/risk-kayit-defteri.md) → R016 Yol 2 ilanında Kayseri Kanal C uyum riski yeni eklenecek
- [monetizasyon/gelir-modeli.md](monetizasyon/gelir-modeli.md) §1.3 yan gelirler → sigorta affiliate satırı eklenecek (revize sonra)

**Validate edildi:** PO (2026-04-24, sigorta acentelik gelir potansiyeli sorusu üzerine BD analizi)

---

### 2026-04-24 — Pilot çekici fiyat akışı: sabit şerit + tek capture (Senaryo C)

**Karar:** Pilot 90 gün boyunca çekici dikeyinde **sabit fiyat şeridi** (Kayseri merkez ₺800, ilçe ₺1.200, kötü hava +₺200, gece +₺200) → müşteri çağrıdan önce fiyatı görür → tek capture + split. Tavan preauth + gerçek capture (dinamik fiyat) **V1.1 işi**.

**Gerekçe:**
- iyzico Marketplace + preauth + 3DS + split kombinasyonu doğrulanmamış (sorulacak; cevap belirsiz olabilir).
- Sabit şerit → teknik karmaşa minimum (capture + split + 3DS standart akış)
- Müşteri için sürprizsiz fiyat → güven artışı, "kolaylık" omurgasıyla uyumlu
- 10 partner usta için sabit şerit kabulü kolay (T-3 onboarding'de anlaşılır)
- Dinamik fiyat (mesafe × saat × hava) → pilot verisiyle V1.1'de kalibre edilir

**Kapsam:** strateji + ürün + ödeme akışı
**Etki:** P0
**Aksiyon:**
- iyzico Marketplace teyit listesi T-3 öncesi gönderilir (8 soru, kombinasyon desteği kritik)
- Yanıta göre plan B: Param Pazar'a geçiş (provider abstraction sayesinde 2-3 gün migration)
- Detay: [monetizasyon/odeme-modeli-yasal-cerceve.md §9-11](monetizasyon/odeme-modeli-yasal-cerceve.md)
- Codex tow.py akışı bu pattern'a göre revize edilmeli (BACKEND-DEV sohbeti)

**Validate edildi:** PO + Codex (2026-04-24, teknik kombinasyon nüansı bulguları)

---

### 2026-04-24 — Ödeme modeli: PSP Marketplace (sub-merchant), Naro anapara tutmaz

**Karar:** Naro tüm ödemeleri **lisanslı PSP'nin marketplace ürünü altında** alır (iyzico Marketplace ya da Param Pazar). Müşteri ödemesi PSP'nin escrow akışı içinde tutulur, otomatik split ile %5 Naro alt-merchant hesabına (komisyon), %95 çekici/usta alt-merchant hesabına (anapara) ayrılır. **Naro'nun kendi banka hesabı para akışında yer almaz.**

**Üç model değerlendirildi, iki ret:**
- **Model A (Naro hesabı orta yer):** TCMB ödeme kuruluşu lisansı gerekirdi (6-12 ay + 8-15M TL sermaye). Pilot ile uyumsuz, ret.
- **Model B (hizmet al-sat tüccar):** Çift KDV (fiyat +%20×2) + Naro doğrudan hizmet sorumluluğu. Ekonomik + hukuki yük ağır, ret.
- **Model C (PSP marketplace):** ✓ Seçildi.

**Gerekçe:**
- Lisans **gerekmez** (PSP'nin TCMB lisansı kapsıyor)
- Tek kat KDV (çekici müşteriye, Naro sadece çekiciye komisyon faturası)
- Hukuki sorumluluk çekicide kalır (Naro aracı, asıl satıcı değil)
- Disinter savunması güçlenir (kart bilgi platform-içi, dışarı ödeme adresi yok)
- Türkiye'deki tüm 3. nesil marketplace pattern'i (Trendyol, HepsiBurada, Getir aynı yapı)

**Kapsam:** strateji + monetizasyon + regülasyon + ürün-mühendislik
**Etki:** P0
**Aksiyon:**
- Canonical doküman: [monetizasyon/odeme-modeli-yasal-cerceve.md](monetizasyon/odeme-modeli-yasal-cerceve.md)
- BACKEND-DEV sohbetine T-3 doğrulama: mevcut `naro-backend/app/integrations/psp/iyzico.py` Marketplace API mı yoksa düz Ödeme API mı? İkincisi ise lansman ertelenir.
- 10 partner usta T-3'e kadar PSP sub-merchant onboarding tamamlamalı (saha temsilcisi koordinasyonunda).
- R005 (regülasyon) skor 6 → revize ile **3** indirildi (PSP altında lisans riski yok).
- Yeni risk R015: yanlış PSP entegrasyonu lisans riski → BACKEND-DEV doğrulaması bekliyor.

**PSP tercih sırası (pilot):** 1. iyzico Marketplace (önerilen, en stabil), 2. Param Pazar (rekabetçi fiyat), 3. Sipay Pazar (yedek).

**Validate edildi:** PO (2026-04-24, ödeme modeli stratejik soru üzerine BD analizi)

---

### 2026-04-21 — Servis ziyaret frekansı varsayımı revize (5/yıl, Naro kapsamı 4/yıl)

**Karar:** Kullanıcı (araç sahibi) yıllık servis ziyareti varsayımı **2 → 4-5** revize edildi; pilot + LTV + oran hesapları bu varsayıma göre yenilendi.
- 3+ yaş araç segmenti, ortalama 12-15K km/yıl kullanım
- Kategori dökümü (bakım 1 + lastik 1.5 + arıza 1-2 + muayene 0.5-0.7 + mevsimsel 0.3 + kaza 0.1 + çekici 0.15) = toplam ~5/yıl
- Naro kapsamı (kaporta/oto yıkama/aksesuar dışı): **~4/yıl** pratik varsayım

**Sonuçlar:**
- Yıllık komisyon/kullanıcı (Naro payı): 400 TL → **~720 TL** (×1.8)
- 1 usta : kullanıcı oranı: 1:200-400 (BD eski) → **1:80-120** (PO kick-off tahmini doğrulandı)
- CAC geri ödeme: 12-18 ay → **6-9 ay**
- Risk R002 (düşük frekans): skor 9 → **6** (revize)
- Dikey pazarlama önceliği: bakım + lastik + hatırlatma omurgası öne; kaza/çekici arka plan
- Pilot başarılı vaka üst-band: 40 → **50** (alt-band sabit 10)

**Gerekçe:** PO araştırma verisi + TÜİK araç parkı + TSB hasar istatistikleri + OEM bakım standartları. BD kick-off varsayımı "yılda 1-2" tüm-segment genellemesi yapıyordu; 3+ yaş segmentine odaklanınca matematik çok daha sağlıklı. Detay: [analiz/2026-04-21-servis-ziyaret-frekansi.md](analiz/2026-04-21-servis-ziyaret-frekansi.md).

**Kapsam:** strateji + monetizasyon + risk + gtm
**Etki:** P0
**Aksiyon:**
- [analiz/2026-04-21-servis-ziyaret-frekansi.md](analiz/2026-04-21-servis-ziyaret-frekansi.md) — canonical hesap
- [risk/risk-kayit-defteri.md](risk/risk-kayit-defteri.md) — R002 skor revize
- [monetizasyon/gelir-modeli.md](monetizasyon/) yazılacak (yeni) — unit economics tam hesap
- [gtm/lansman-plani.md](gtm/lansman-plani.md) — pazarlama mesaj önceliği bakım+lastik omurgasına kaydır
- [strateji/ayristirici-tez-ve-moat.md](strateji/ayristirici-tez-ve-moat.md) §1.1 — hacim + LTV rakamları senkronize edilecek

**Doğrulama:** Pilot T+30'da gerçek vaka dağılımı bu varsayımları sınar; sapma varsa revize girdi eklenir.
**Validate edildi:** PO (2026-04-21, araştırma çıktısı paylaşımı)

---

### 2026-04-21 — AI ön değerlendirme pilot'tan çıkarıldı

**Karar:** Önceki "Faz A iç araç" planı iptal. Pilot haftasında (T-6 → T+14) AI kodu yazılmaz, hiçbir formda çalışmaz. Yeni çizelge:
- **T-6 → T+14 (pilot):** AI sıfır. Vaka akışında zaten toplanan veriler (görsel, ses, tarif, araç bilgisi) storage'a kaydedilir — AI modülü olmadan.
- **T+15 → T+30:** AI modülü ayrı sprint. Pilot verisiyle kalibrasyon.
- **T+30 → T+45:** Kalibrasyon testi (20 vaka × ≥%70 doğruluk). Geçerse Faz B arıza dikeyinde beta açılır; geçmezse 30 gün daha kalibrasyon veya V2'ye ertele.
- **T+45+:** Bakım dikeyi değerlendirmesi. Kaza'da asla açılmaz.

**Gerekçe:** (1) Opportunity cost — 4 agent kritik-path'te delice kod yazıyor; AI alt-sistemi (context-gather agent + multimodal LLM + web search + kalibrasyon log) yeni risk çarpanı. (2) Pilot başarı kriterleri AI'ya bağlı değil — 5 hatadan kaçınma AI olmadan çözülür. (3) Hallucinate riski pilot iç kullanımda bile tehlikeli; ustanın AI'ya ilk-izlenim güveni Faz B açılışında kritik. (4) Pilot darboğazı 10 usta tedariği + kanal aktivasyonu; dikkat oraya.

**Veri kaybı yok:** Vaka akışı UX parçası olarak görsel/ses/tarif/araç verisini zaten toplar. AI modülü sonradan eklendiğinde kayıtlı verilerle post-hoc kalibre edilir.
**Kapsam:** strateji + ürün + mühendislik önceliği
**Etki:** P0
**Aksiyon:** [gtm/lansman-plani.md](gtm/lansman-plani.md) Hat 4 revize edildi; AI kodu pilot sprint'ten çıkarıldı, back-log'a alındı. [strateji/ayristirici-tez-ve-moat.md](strateji/ayristirici-tez-ve-moat.md) §3 #5 bu karara göre güncel.
**Validate edildi:** PO (2026-04-21, "süreç uzatıyor" sezgisi)

---

### 2026-04-21 — Lansman stop-loss eşiği

**Karar:** T+14 (2026-05-11) itibariyle başarılı vaka < 10 **veya** ortalama puan < 3.5 ise lansman durdurulur; yeni kullanıcı kazanma kanalları kapatılır, sebep analizi + pilot revizyonu yapılır.
**Gerekçe:** Sektörde güven açığı ağır; kötü ilk deneyimin kamusallaşmasını hızlandırmak geri dönüşsüz itibar kaybı yaratır. Büyüme > retention hatasına düşmeme disiplini.
**Kapsam:** gtm
**Etki:** P0
**Aksiyon:** [gtm/lansman-plani.md — Hat 5](gtm/lansman-plani.md); günlük KPI dashboard T+1'den itibaren.
**Validate edildi:** PO (2026-04-21)

---

### 2026-04-21 — Pilot arz: 10 seçili partner usta (random değil)

**Karar:** Lansman arzı **10 seçili partner usta** (hedef 10, minimum kabul 5). Random/kütüksel servis eklemesi yapılmaz. Partner ustaya: SLA + platform-içi iletişim zorunluluğu + disinter anti-sözlü taahhüt + "Naro Partner Usta" rozeti + ilk ay minimum vaka garantisi + pilot dönem %5 komisyon.
**Gerekçe:** Naro'nun ilk gün vaadı kolaylık + güvenilir eşleştirme. Random usta = ortalama-altı kalite → viral negatif ilk vakalarda. Seçili grup kalite eşiğini garantiler; rozet statü yaratır; sözlü taahhüt disinter yavaşlatır.
**Kapsam:** gtm
**Etki:** P0
**Aksiyon:** [gtm/lansman-plani.md — Hat 1](gtm/lansman-plani.md); T-5 aday liste, T-3 mülakat, T-1 onboarding.
**Seçim kriterleri:** fatura/e-Arşiv, fiziksel atölye, 3+ eski müşteri referansı, temel dijital okur-yazarlık, disinter sözlü taahhüt.
**Validate edildi:** PO (2026-04-21)

---

### 2026-04-21 — Pilot şehir: Kayseri; tüm dikey canlı

**Karar:** Lansman pilotu **Kayseri ili**. Dikey kapsam: **tüm dikeyler canlı** (arıza + bakım + kaza + çekici). Istanbul/Ankara/İzmir pilot değil.
**Gerekçe:** Kayseri 1.5M nüfus + güçlü araç yoğunluğu + köklü sanayi (Mimarsinan, Yeni Sanayi) + muhafazakar-lokal profil (ağızdan-ağıza hızlı viral) + Istanbul gürültüsü yok. Dijital-yerli profil Istanbul altında olduğu için onboarding UX telefon-destekli olmalı. Dar şehir + tüm dikey: matching hacmi hızlı, veri toplama hızlı.
**Kapsam:** gtm
**Etki:** P0
**Aksiyon:** [gtm/lansman-plani.md](gtm/lansman-plani.md) bütününde Kayseri odaklı.
**Validate edildi:** PO (2026-04-21)

---

### 2026-04-21 — Değer önerisi omurgası: "kolaylık"

**Karar:** Naro'nun tek-kelime konumlandırması **"kolaylık"**. Ucuz değil, güvenilir (zamanla hak edilir), hızlı (commodity) — asıl iddia: kognitif yükü düşürmek. Tüm messaging bu omurgaya hizalanır.
**Gerekçe:** Kullanıcı ya streste (kaza/arıza) ya isteksiz (bakım); iki halde kognitif yük azaltmak en değerli hediye. "Ucuz" komisyon baskısı + iyi usta kaçar. "Güvenilir" vaat değil hak edilen. "Hızlı" commodity. Uber/Yemeksepeti de kolaylık üzerinden ölçeklendi.
**Kapsam:** strateji
**Etki:** P0
**Aksiyon:** [analiz/2026-04-21-lansman-stratejisi.md — Bölüm 1](analiz/2026-04-21-lansman-stratejisi.md). Tagline önerileri: "Arabanı düşünme." / "Tek tıkla doğru ustaya." — A/B test.
**Somut bileşenler:** (1) tek akış — 3 tıkta vaka, (2) tek yer — belge/geçmiş/fatura, (3) hatırlatma — muayene/sigorta push (T+60'a kadar canlı olmalı), (4) sihirbaz — görsel-ikonik sorun tarifi.
**Validate edildi:** PO (2026-04-21)
