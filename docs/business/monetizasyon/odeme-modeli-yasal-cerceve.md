# Naro — Ödeme Modeli + Yasal Çerçeve

**Statü:** Canonical karar dokümanı · v1 · 2026-04-24
**İlgili:** [gelir-modeli.md](gelir-modeli.md) · [../KARAR-LOG.md](../KARAR-LOG.md) · [../risk/risk-kayit-defteri.md](../risk/risk-kayit-defteri.md) (R005, R007)

---

## 0. Tek cümlede karar

**Naro tüm ödemeleri lisanslı PSP'nin marketplace ürünü (iyzico Marketplace / Param Pazar / Sipay Pazar) altında "alt-üye işyeri" (sub-merchant) modeliyle alır.** Müşteri parası Naro'nun banka hesabından **geçmez**; PSP tahsilat sonrası komisyonu Naro'nun alt-merchant hesabına, anaparayı çekicinin alt-merchant hesabına otomatik split eder. Bu yapıyla **TCMB ödeme kuruluşu lisansı gerekmez** — PSP'nin lisansı seni kapsar.

---

## 1. Üç olası model — neden A ve B reddedildi, C seçildi

### Model A — Marketplace + komisyon (Naro hesabı orta yer)
- Para Naro hesabına gelir → komisyon kesilir → çekiciye transfer.
- **Yasal:** "Müşteri parasını geçici tutmak" = ödeme aracılık hizmeti → 6493 sayılı Kanun → **TCMB ödeme kuruluşu lisansı zorunlu**.
- **Maliyet:** Başvuru + sermaye yeterliliği + iç denetim → **6-12 ay süreç + 8-15M TL özsermaye gereksinimi**.
- **Karar:** Pilot ile uyumsuz. Lansmanı erteler. **Ret.**

### Model B — Hizmet al-sat (tüccar)
- Çekici → Naro: hizmet faturası (B2B). Naro → müşteri: hizmet faturası (B2C).
- **Yasal:** Aracılık değil, iki ayrı satış. Lisans yok.
- **Vergi:** Çift KDV katmanı (çekici→Naro %20 + Naro→müşteri %20). Fiyat 2.400 TL artar.
- **Sorumluluk:** Naro doğrudan hizmet sağlayıcı sayılır → tüketici talebinde Naro muhatap, çekiciden bağımsız.
- **Karar:** Hem ekonomi (çift KDV) hem hukuki risk pilot için ağır. **Ret.**

### Model C — PSP Marketplace (sub-merchant) ⭐ Seçilen
- Naro **anapara tutmaz**. PSP tahsilat alır + split + payout yapar.
- **Yasal:** PSP'nin TCMB lisansı altındayız. **Lisans yok.**
- **Vergi:** Tek kat KDV (çekici müşteriye, Naro sadece çekiciye komisyon faturası).
- **Sorumluluk:** Çekici asıl satıcı; Naro platform aracı. Tüketici şikayetinde **Naro çekicinin temsilcisidir, doğrudan muhatap değil**.

---

## 2. Akış (kritik dikeyler için)

### Çekici (Tow Dispatch V1) örnek

```
Müşteri ödemesi: 2.000 TL (kart, app içi)
        │
        ▼
   PSP TAHSİLAT
   (iyzico Marketplace tek hesap — escrow benzeri,
    PSP'nin lisansı altında)
        │
        ├── %95 anapara → Çekicinin alt-merchant hesabı (1.900 TL)
        └── %5  komisyon → Naro'nun alt-merchant hesabı (100 TL)
        │
        ▼
   T+1 / T+2'de PSP her alt-merchant'a banka hesabına payout yapar
   (PSP'nin lisanslı operasyonu)
```

Naro hiçbir noktada anaparayı **tutmuyor** veya **transfer etmiyor**. Komisyon dışında para Naro hesabına düşmüyor.

---

## 3. Çekici tarafının operasyonel gereksinimi

PSP marketplace alt-merchant olabilmek için çekici **vergi mükellefi** olmak zorunda:
- Şahıs işletmesi (gerçek kişi tacir)
- Limited / anonim şirket
- E-arşiv fatura kesebilen mükellef

**Naro Partner Usta seçim kriterlerinde "fatura/e-Arşiv" zaten şart** ([gtm/lansman-plani.md Hat 1](../gtm/lansman-plani.md)) — yapı uyumlu.

Pilot dışında **vergi mükellefi olmayan usta** Naro'da çalışamaz. Bu, geri planda **disinter sızıntısı engelleyici** olarak da iyi: kayıt-dışı ekonomi platformda yer almıyor → kullanıcı için güven artıyor.

---

## 4. PSP karşılaştırma + Naro önceliği

| PSP | TCMB lisansı | Sub-merchant onboarding | Komisyon (PSP'nin Naro'dan kestiği) | TR pazar konumu |
|---|---|---|---|---|
| **iyzico Marketplace** | ✓ | Hızlı, dökümantasyon en iyi | %2.45 + 0.25 TL/işlem (taban) | TR'de en yaygın marketplace altyapısı; Trendyol, HepsiBurada, Getir kullanıyor |
| **Param Pazar** | ✓ | Hızlı, KOBİ odaklı | %1.99 + 0.20 TL (rekabetçi) | Yerli, agresif fiyatlandırma |
| **Sipay Pazar** | ✓ | Esnek, custom split | %2.20 + 0.25 TL | Daha yeni, fintech yaklaşımı |
| **PayTR Marketplace** | ✓ | Eski, daha az esnek | %2.49 + 0.25 TL | Yaygın ama dökümantasyon eski |

**Pilot için öneri:** **iyzico Marketplace** — en geniş kullanıcı kitlesi, en stabil docs, en hızlı entegrasyon. PSP komisyonu (~%2.5) bizim Naro komisyonumuzun (%5) içinden yerine geçiyor — yani Naro'nun **net komisyonu ~%2.5**. Bu pilot için kabul edilebilir; post-pilot yüksek hacimde Param ya da Sipay ile pazarlık edip %1.5'e indirmek mümkün.

---

## 5. Naro tarafında ne yapılmış / yapılmalı

**Mevcut backend implementasyonu:** [naro-backend/app/integrations/psp/iyzico.py](../../naro-backend/app/integrations/psp/iyzico.py) commit'lerde var (Faz 10 tow dispatch).

**Kritik kontrol (BACKEND-DEV sohbetine):** Mevcut iyzico entegrasyonu hangi modu kullanıyor?
- (a) **iyzico Marketplace API** — sub-merchant + split + payout → ✅ Bu doğru, Model C
- (b) **iyzico düz Ödeme API** — tek merchant (Naro), anapara Naro hesabına → ❌ Model A, **lisans riski**

Doğrulanmadan tow dikeyi prod'a çıkmamalı. Yanlış kurguysa pilot ertelenir.

---

## 6. Müşteri ve usta deneyimi

- **Müşteri tarafı UX:** Naro markası altında ödeme (kart girer), arka planda iyzico pencereler. Marka hissiyatı bizim, altyapı PSP'nin.
- **Usta tarafı:** Onboarding sürecinde **iyzico sub-merchant başvuru formu** doldurulur (Naro saha temsilcisi yardımcı olur). Vergi numarası + IBAN + tabela fotoğrafı gibi standart bilgiler. Ortalama 24-72 saat onay süresi.

**Pilot çatlak:** 10 seçili usta T-3'e kadar PSP onboarding'i tamamlamalı. Bu **saha operasyonunun parçasıdır** — usta tedariği ile PSP onboarding paralel yürür. Kayseri saha temsilcisi koordinasyon eder.

---

## 7. Risk + uyumluluk

- **R005 (regülasyon):** PSP marketplace altında çalışırsak BDDK/TCMB lisans riski **yok**. Skor 6 → 3 (REVİZE 2026-04-24).
- **R007 (komisyon sızıntısı):** PSP altyapısı disinter savunmasını **arttırıyor** (kart bilgi platform-içi, dışarı ödeme adresi yok). Mitigasyon güçlendi.
- **Yeni risk R015:** **Yanlış PSP entegrasyonu (Model A/Model B)** → lisans riski + lansman ertelemesi. BACKEND-DEV sohbeti tarafından doğrulanması zorunlu T-3'e kadar.
- **Sigorta dikeyi (R005 ekstra):** Sigorta hasar onarım hizmetinde acentecilik / SEGEM lisansı sorunu **ayrı** konu — PSP marketplace bunu çözmez. Pilotta sigorta dikeyi "bildirim/dosya asistanı" rolünde kalır, doğrudan tahsilat yok ([analiz/2026-04-21-lansman-stratejisi.md](../analiz/2026-04-21-lansman-stratejisi.md) §risk).

---

## 8. Açık sorular (PO / Backend onayı bekleyen)

1. **iyzico Marketplace doğrulaması** — backend'deki entegrasyon Model C mi? (BACKEND-DEV sohbetinde teyit)
2. **PSP komisyon pazarlığı** — pilot dönemi başlangıç oranı kabul mü, yoksa Param ile karşı teklif alınsın mı? (sahada hacim bekleniyor)
3. **Usta onboarding süreci** — saha temsilcisi PSP başvuruyu üstlenir mi yoksa usta tek başına mı? (UX + zaman maliyeti)
4. **B2B filo + sigorta dikeyi (V1.1)** — bunlar marketplace dışı kanal olabilir, ayrı sözleşme + bireysel fatura akışı planlanır mı?

---

## 9. Pilot ödeme akış senaryosu — sabit fiyat (preauth karmaşası yok)

**Karar:** Pilot 90 gün **Senaryo C — sabit (önceden anlaşılan) fiyat → tek capture + split**.

| Akış | UX | Teknik | Pilot durumu |
|---|---|---|---|
| **A. Tavan preauth → gerçek capture** | En şeffaf | Yüksek karmaşa (preauth+capture+iade+split) | Riskli — iyzico Marketplace + preauth + 3DS + split kombinasyonu doğrulanmamış |
| **B. Tahmini fiyat capture, fark iade/ek tahsilat** | Karmaşık | Orta | İade UX'i pilot için negatif |
| **C. Sabit fiyat şeridi → tek capture + split** | Şeffaf, sürprizsiz | Düşük (capture + split + 3DS) | **Pilot için seçildi** ⭐ |

**Pilot fiyat şeridi (Kayseri çekici örneği):**
- A bölge (merkez) — ₺800 (sabit)
- B bölge (ilçe) — ₺1.200 (sabit)
- Kötü hava ek — ₺200
- Gece (00:00-06:00) ek — ₺200

10 partner usta T-3 onboarding'de bu şerit üzerinde anlaşır. Müşteri çağrıdan önce fiyatı görür → sürpriz yok, güven artar.

**Dinamik fiyat (mesafe × saat × hava algoritmik):** V1.1 işi (pilot verisiyle kalibrasyon).

## 10. iyzico Marketplace teyit gündemi (T-3 öncesi)

iyzico kurumsal satış'a sorulacak liste:

1. Sandbox hesabı Pazaryeri/Marketplace mı, Standart Ödeme mi?
2. Sub-merchant oluşturma + subMerchantKey akışı sandbox'ta çalışıyor mu?
3. **Kombinasyon desteği** (kritik):
   - Marketplace + 3DS + hosted checkout
   - Marketplace + preauth + capture + iade
   - Marketplace + subMerchantPrice (split) + payout
   - **Yukarıdaki üçünün TEK AKIŞTA birlikte çalışması**
4. Pazaryeri ana üye işyeri olarak Naro'nun komisyon dilimini API'den geri okuyabiliyor muyuz?
5. Sub-merchant payout süresi (T+kaç gün) ve günlük/haftalık seçenek?
6. KDV faturalama: subMerchant (çekici → müşteri) + pazaryeri komisyon (Naro → çekici) e-arşiv API formatı?
7. Pilot dönem PSP komisyon oranı (%2.45 + 0.25 TL standart) üzerinde özel tarife pazarlanabilir mi?
8. Sub-merchant onboarding KYC süresi (ortalama kaç saat onay)?

**Soru 3 kritik** — yanıt "Hayır, preauth+marketplace+3DS birlikte yok" derse plan B aktive edilir.

## 11. PSP plan B (vendor lock-in koruması)

Codex'in **provider abstraction** pattern'i kod tarafında uygulandı. Backup sıralaması:

| PSP | Marketplace | Preauth+Split | Onboarding | Plan |
|---|---|---|---|---|
| **iyzico Marketplace** | ✓ | ? (sorulacak) | Orta | Birincil |
| **Param Pazar** | ✓ | ✓ (doküman var) | Hızlı | **Plan B** |
| **Odero** (eski PayU TR) | ✓ | ✓ (kurumsal) | Yavaş | Plan C |
| **Sipay Pazar** | ✓ | ✓ | Hızlı | Yedek |

**Stripe Connect** Türkiye'de TR kart + TR hesap için **çalışmıyor** — listeden çıkarıldı.

Eğer iyzico preauth+marketplace+3DS desteklemiyorsa Senaryo C ile devam (preauth gerekmiyor) **veya** Param Pazar'a 2-3 günlük migration (abstraction sayesinde kolay).

## 12. Mali müşavir + hukuk gündemi (T-3 öncesi 1-2 saat)

1. Sub-merchant payout'un muhasebe tarafı (Naro hesabına direkt para gelmiyor — gelir tahakkuku nasıl)?
2. Aylık konsolide komisyon faturası KDV indirim mantığı?
3. PSP payout T+1/T+2 timing — Naro gelir tahakkuk takvimi?
4. Çekici sub-merchant sözleşmesel çerçeve — Naro Partner Usta sözleşmesi + iyzico alt üye işyeri başvurusu tek belge mi iki ayrı mı?
5. Pilot 90 gün %0 komisyon politikası vergi muamelesi (gelir yok, fatura yok)?

## 13. Yaşam döngüsü

Bu doküman pilot sonrası şu noktalarda revize edilir:
- T+30: gerçek transaction hacmi + PSP commission + payout süreleri
- T+90: hacim üzerinden PSP fiyat pazarlığı
- T+180: B2B (filo) + sigorta dikeylerinde modelin extension'ı
- V2: Naro **kendi ödeme kuruluşu lisansı** alma yapısal kararı (yıllık 50M+ TL hacim sonrası ekonomik fizibil hale gelir)
