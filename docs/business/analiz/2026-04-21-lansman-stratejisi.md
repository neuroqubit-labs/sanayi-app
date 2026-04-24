# 2026-04-21 — Lansman Stratejisi (T-6)

**Bağlam:** PO ile BD kick-off sohbeti. Lansman hedefi **2026-04-27** (6 gün). UI büyük ölçüde hazır; 4 agent paralel backend/frontend kod yazıyor; usta tarafı arz erişimi güçlü, müşteri tarafı darboğaz.

PO tezi: "Araç sahibi edinmek asıl zorluk; 1 usta : 80-100 araç sahibi oranı hedef." Değer önerisi hiyerarşisi: **kolaylık > güven > hız > fiyat**.

Bu analiz notu tartışmayı sabitler, kararları [../KARAR-LOG.md](../KARAR-LOG.md)'a devreder, ileri görevleri [../gtm/lansman-plani.md](../gtm/) ve [../DURUM.md](../DURUM.md) altında somutlar.

---

## 1. Değer önerisi: Kolaylık omurgası

**Karar:** Tek-kelime konumlandırma "kolaylık".

**Gerekçe:** Kullanıcı ya streste (kaza/arıza) ya isteksiz (bakım — mecburi iş). İki halde de **kognitif yükü düşürmek** en büyük hediye. Uber/Yemeksepeti modeli de "ucuz" değil — "bir tıkla iş". "Ucuz" pozisyonu komisyon baskısı yaratır + iyi usta kaçar. "Güvenilir" zamanla hak edilen, lansmanda vaat edilemeyen şey. "Hızlı" commodity.

**Kolaylık'ın somut bileşenleri (ürün & pazarlama iskeleti):**
1. **Tek akış** — telefon açma, usta arama, adres tarifleme yok; 3 tıkta vaka açılır.
2. **Tek yer** — araç belgesi, geçmiş, fatura, garanti, hasar dosyası app'te.
3. **Hatırlatma** — muayene/sigorta/vize takvimi push; kullanıcı düşünme.
4. **Sihirbaz** — sorun tarif edemeyen kullanıcıya (kadın + aracını tanımayan persona) görsel + ikonik rehber.

**Messaging:** "İlk tıkta doğru ustaya" / "Arabanı düşünme, biz düşünelim."

## 2. 1 usta : araç sahibi oranı — kalibrasyon

**PO tahmini:** 1:80-100.
**BD kalibrasyonu:** 1:200-400 kayıtlı kullanıcı.

**Hesap:**
- Oto servisinde kullanıcı ~yılda 2 işlem (muayene + bakım + arıza + kaza ortalaması).
- Usta haftada 5-10 iş almalı = aylık 20-40 vaka.
- 100 kayıtlı kullanıcı × 2 işlem/yıl = yıllık 200 vaka = aylık 16 vaka → sınırda yetmiyor.
- Gerçekçi çekirdek: aylık 20 vaka/usta için **aylık ~250 aktif kayıtlı** lazım. Kayıtlıların aktif oranı (yıl içinde 1 işlem) %60-80 varsayımıyla **kayıtlı havuz = 300-400/usta**.

**Sonuç:** PO'nun yönü doğru, sayı düşük. Hedef pilot için: **10 usta × 300 kayıtlı = 3.000 Kayseri kullanıcısı (ilk 90 gün)**. Lansman haftası KPI'ı buna göre türetilmeli (bkz. bölüm 6).

## 3. Pilot şehir: Kayseri ✅

**Neden iyi:**
- 1.5M nüfus, güçlü araç yoğunluğu, köklü sanayi (Mimarsinan + Yeni Sanayi).
- Muhafazakar + lokal → ağızdan-ağıza hızı yüksek (başarı viral, başarısızlık aynı hızda).
- Istanbul gürültüsü yok → iterate etmek kolay.
- Yerel medya + esnaf odaları erişimi görece ulaşılabilir.

**Risk:** Dijital-yerli profil Istanbul'un altında; onboarding UX'i telefon-destekli olmalı.

## 4. Usta tarafı: 10 seçili, random değil

**PO planı:** 10 random sanayi servisi ekleme.
**BD önerisi:** **10 seçili partner usta** (red card).

**Gerekçe:**
- Naro'nun ilk gün vaadı kolaylık + güvenilir eşleştirme. Random usta = ortalama-altı kaliteli + motive değil.
- İlk 50-100 vakada kötü deneyim viral olur (güven açığı sektörde zaten ağır).
- "Naro Partner Usta" rozetli seçili grup = statü + SLA disiplini.

**Seçim kriteri (hızlı tarama, 3 gün):**
- Fatura/e-Arşiv kesiyor (vergi mükellefi).
- Fiziksel atölye + asgari ekipman (uğrama ile doğrulanır).
- 3+ eski müşteri referansı (telefonla teyit).
- Okuma-yazar / temel dijital okur-yazarlık (app-kullanım eğitimi kabul).
- Disintermediation anti-sözlü sözleşme imzalar ("müşteriyi dışarı çıkarmayacağım").

**Garanti:** İlk ay partner ustaya **X vaka minimum garantisi** (az olduğundan karşılanabilir). Karşılığında SLA + platform-içi iletişim + şeffaf fiyat.

**Kapsam dengesi:** 10 usta zor gelirse **5 kaliteli > 10 random**. Pilot aşamasında kalite = KPI.

## 5. AI ön değerlendirme — stratejik değer + faz planı

PO fikri: LLM agent tüm bağlamı (araç bilgisi, kullanıcı hasar tarifi, görsel, ses) toplar, web araması yapar, **ön teşhis/tahmin** çıkarır. Kullanıcı + usta tarafı ayda 1 hak.

### Stratejik değer (yüksek)

- **Kolaylık omurgasının kanıtı** — "arabama ne oldu bilmiyorum" stresini çözer.
- **Eşsiz diferansiyatör** — lokal/global rakipte yok.
- **Pazarlama silahı** — manşet olma potansiyeli.
- **Data flywheel** — her teşhis + gerçek sonuç = kalibrasyon; 6 ayda rakip yakalayamaz.
- **Usta için "brief özet"** — gelen vakaya ön-hazırlık = zaman kazancı.

### Riskler (6 başlık)

1. **Yanlış teşhis → itibar çökmesi.** "App söyledi" → yanlış çıktı → sosyal medya. Sektörün güven açığı tolerans düşürür.
2. **LLM hallucinate.** Oto mekaniği marka-özel derin alan. Web arama yardımcı ama kalibrasyonsuz tehlikeli.
3. **Usta direnç.** "AI benim işimi mi yapıyor?" Pilot ustaları soğutmak = arz krizi.
4. **Hukuki çağrışım.** "Teşhis" kelimesi yükümlülük + sigorta yanlış-anlamaya yol açar.
5. **Maliyet.** Multimodal (vision + audio) + web search = ~5-15¢/istek. Aylık 1 limit bu riski dizginliyor ✓.
6. **Kaza senaryosunda = hayati sorumluluk.** Eksper raporuyla karıştırılamaz.

### BD kararı: iki fazlı rollout

**Faz A — Lansman haftası (27 Nisan):**
- AI modülü kodlu, **user-visible değil**.
- Iç araç: usta tarafında "vaka özeti brief" olarak (teşhis değil), kullanıcı tarafında gizli.
- İlk 10-20 gerçek vaka → kalibrasyon veri seti (AI tahmini vs gerçek usta teşhisi).
- UX bileşenleri (disclaimer, belirsizlik skalası, confidence interval) önden hazırlı ama saklı.

**Faz B — 2-4 hafta sonra (kalibrasyon OK ise):**
- Sadece **arıza dikeyinde** aç (bakım + kaza HAYIR).
- "Hızlı ön değerlendirme" etiketli (teşhis kelimesi kullanılmaz).
- Beta rozeti + belirsizlik skoru + disclaimer ("kesin teşhis ustanızdan") + "ustaya göster" butonu.
- Stabil ise 1 ay sonra bakım dikeyine genişlet. Kaza'ya **asla**.

### Kelime kararı

- ❌ "Teşhis" / "Diyagnoz"
- ✅ **"Hızlı ön değerlendirme"** (user-facing)
- ✅ **"Vaka brief özeti"** (usta-facing)

### Kullanım limiti

- **Kullanıcı tarafı:** ayda 1 ücretsiz ön değerlendirme (Faz B açılınca).
- **Usta tarafı:** limit YOK — "brief özet" her vakaya otomatik (ucuz prompt, maliyet düşük).

## 6. Lansman haftası KPI'ı

Lansman başarısı **kurulum sayısı değil** — başarılı vaka sayısı.

**İlk 2 hafta hedef (27 Nisan – 11 Mayıs):**

| Metrik | Hedef | Neden |
|---|---|---|
| Kayıtlı kullanıcı (Kayseri) | 500-1.000 | Kanal dağıtımı çalıştı mı testi |
| İlk vaka açılış | 30-80 | Kullanıcı niyeti → harekete dönüyor mu |
| **Başarılı vaka** (teklif → randevu → tamamlanma → puan) | **15-40** | Gerçek değer üretildi mi — primary KPI |
| Ortalama puan | ≥ 4.2 / 5 | Kalite eşiği |
| Usta app-açık oranı | ≥ %70 günlük | Arz sağlıklı mı |
| Şikayet oranı | < %5 | İtibar erken uyarısı |

**Stop-loss eşiği:** İlk 2 haftada başarılı vaka < 10 veya ortalama puan < 3.5 → lansmanı **durdur**, pilot revize et. Kamusal yayılmayı hızlandırma.

## 7. Kullanıcı edinme kanalları (Kayseri pilot, ilk 2 hafta)

Paid marketing yok (düşük LTV geri almaz). Öncelikli kanallar:

| Kanal | Mekanizma | 2-haftalık hedef |
|---|---|---|
| **Partner usta eski müşteri listesi** | Ustanın WhatsApp listesine davet + indirim kuponu. Anti-disinter disiplini şart. | 200-400 |
| **Yerel sigorta acentesi** | 3-5 Kayseri acentesiyle co-branded kartvizit / QR ("kaza anında tek tık"). | 100-200 |
| **Sanayi sitesi + yerel esnaf** | Partner ustanın yanındaki esnaf + sanayi sitesi yönetimi; broşür + QR. | 50-150 |
| **Yerel medya + sosyal** | Kayseri'de 2-3 Instagram/YouTube oto kanalı + yerel gazete duyuru. | 50-200 |
| **Noter + ruhsat yenileme** | Noter yakınındaki kağıt + QR dağıtımı. | 30-100 |
| **Kulaktan-kulağa** | Her başarılı vakada referral kuponu ("arkadaşına X kodu ver"). | organik × |

**Toplam erişim tahmini:** 430-1.050 kayıt / 2 hafta. Alt band bile pilot KPI'ı karşılar.

## 8. Açık konular (PO kararı bekleyen)

- [ ] **İlk 10 usta seçim süreci kim yürütüyor?** (PO + BD saha temsilcisi mi, PO tek mi?)
- [ ] **Partner ustaya aylık vaka garantisi** sayısı ne? (5 / 10 / 15?)
- [ ] **Komisyon oranı** pilot için düşük-başla mı, standart mı? (Öneri: ilk 3 ay **%5** — benimsenme önceliği, sonra pazara göre ayarla.)
- [ ] **Sigorta acentesi ilk temas** — hangi acenteler, kim arayacak, ne teklif?
- [ ] **AI Faz B açılış kararı** kimin? (Öneri: kalibrasyon eşiği tanımla — 20 vakada ≥ %70 doğru tahmin olursa açılır.)
- [ ] **Referral kupon ekonomisi** — kullanıcıya ne, ustaya ne?

## 9. Sonraki adımlar

1. [../KARAR-LOG.md](../KARAR-LOG.md) → 5 karar düşer (pilot, kolaylık, seçili usta, AI iki-faz, stop-loss).
2. [../gtm/lansman-plani.md](../gtm/lansman-plani.md) → hafta-hafta lansman takvimi + kanal aktivasyonu.
3. [../DURUM.md](../DURUM.md) → top-3 öncelik + açık soru listesi + workstream tablosu.
4. [../risk/risk-kayit-defteri.md](../risk/risk-kayit-defteri.md) → AI-ilişkili 2 risk eklenecek (yanlış teşhis itibar, usta direnci).
5. Açık konular PO'ya gönderilir → cevaplar KARAR-LOG'a girer.
