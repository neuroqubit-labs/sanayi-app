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
