# Risk Kayıt Defteri

Naro için tanımlı iş riskleri. Her risk izlenir, mitigasyon planı tutulur, gözden geçirme tarihine göre revize edilir.

## Skorlama

- **Olasılık:** L1 (düşük) / L2 (orta) / L3 (yüksek)
- **Etki:** I1 (küçük) / I2 (orta) / I3 (şirket-çapı)
- **Skor = Olasılık × Etki** (1-9). **Skor ≥ 6 = P0 mitigasyon gerekir, aylık inceleme**.

## Kategoriler

- **PAZAR** — talep, rakip, makro
- **OPERASYON** — arz, kalite, dağıtım, saha
- **REGÜLASYON** — KVKK, sigorta lisansı, vergi, ticaret
- **İTİBAR** — marka, basın, kullanıcı deneyimi, viral şikayet
- **FİNANS** — runway, CAC, unit economics, ödeme riski
- **ÜRÜN** — disintermediation, güven, yanlış eşleştirme, hatalı hasar raporu

---

## Aktif riskler

| ID | Kat. | Risk | Olas. | Etki | Skor | Mitigasyon | Son inceleme |
|---|---|---|---|---|---|---|---|
| R001 | ÜRÜN | Kullanıcı + usta platformu atlayıp doğrudan iletişim kuruyor (disintermediation) | L3 | I3 | **9** | Maskelenmiş iletişim (proxy telefon), escrow ödeme, platform-içi puan + ceza; işin faturası platformdan çıkar | 2026-04-21 |
| R002 | PAZAR | Düşük kullanım frekansı → retention düşük, CAC amorti olmuyor | L2 | I3 | **6** (↓) | **2026-04-21 REVİZE:** 3+ yaş segment araştırması sonucu frekans ~5 ziyaret/yıl (önceki 1-2 varsayımı yanlıştı — bkz [analiz/2026-04-21-servis-ziyaret-frekansi.md](../analiz/2026-04-21-servis-ziyaret-frekansi.md)). Skor 9 → 6. Pasif değer (sanal garaj + hatırlatma) hâlâ kritik (R013) ama risk catastrophic değil. | 2026-04-21 |
| R003 | PAZAR | Sektörde birçok başarısız startup — yatırımcı + kullanıcı güveni düşük | L2 | I2 | 4 | Farklı değer önerisi belgele (vaka merkezli akış + hasar puanlama); pilot KPI'ları erken konsolide et | 2026-04-21 |
| R004 | OPERASYON | Okuma-yazması zayıf usta segmenti uygulamayı adopt edemiyor | L3 | I2 | **6** | Sesli + ikonik UX, saha temsilcisi onboarding, telefon fallback, sanayi birlikleri ortaklığı | 2026-04-21 |
| R005 | REGÜLASYON | Sigorta iş akışları SEGEM / acentelik gerektirebilir | L2 | I3 | **6** | Erken dönem sadece "sigorta bildirim / dosya asistanı" rolü; acentelik yerine partner sigorta ile co-branded. **Ödeme modeli ayrı çözüldü:** PSP marketplace altında TCMB ödeme kuruluşu lisansı gerekmez (bkz. [monetizasyon/odeme-modeli-yasal-cerceve.md](../monetizasyon/odeme-modeli-yasal-cerceve.md)). | 2026-04-24 |
| R006 | İTİBAR | Kritik dakikada (kaza) kötü eşleştirme → basına yansıyan şikayet | L2 | I3 | **6** | Acil çekici için auto-dispatch + SLA takip, ilk 100 vakada manuel moderasyon, şikayet eskalasyon kanalı | 2026-04-21 |
| R007 | FİNANS | Disintermediation yüzünden GMV'nin %X'i komisyon olarak düşüyor (sızıntı) | L2 | I2 | 4 | Ödemeyi platform-içinde tutan fayda: kampanya / puan / taksit / garanti; anomali tespiti | 2026-04-21 |
| R008 | ÜRÜN | AI ön değerlendirme yanlış teşhis → viral-negatif (Faz B açılışta risk) | L1 | I3 | 3 | **AI pilot'tan çıkarıldı (2026-04-21 revize)**; Faz B T+30-45 kalibrasyon + disclaimer + belirsizlik skoru + "ustaya göster" + kaza'da asla + "ön değerlendirme" kelimesi | 2026-04-21 |
| R009 | OPERASYON | Pilot ustaların AI'ya direnç göstermesi (Faz B açılışta risk) | L1 | I2 | 2 | **AI pilot'tan çıkarıldı (2026-04-21 revize)**; Faz B'de "vaka brief özeti" framing + ustalar önden bilgilendirme | 2026-04-21 |
| R010 | İTİBAR | Kayseri pilotunda ilk 14 gün başarısız vaka sayısı eşik-altı → kamusal yayılma sürerse viral-negatif kalıcılaşır | L2 | I3 | **6** | Stop-loss eşiği: T+14'te <10 başarılı vaka veya <3.5 puan → yeni kullanıcı kazanma durdur + sebep analizi + pilot revize | 2026-04-21 |
| R011 | REGÜLASYON | AI çıktısı "eksper raporu" ile karıştırılır → sigorta/hukuki yükümlülük | L1 | I3 | 3 | **AI pilot'tan çıkarıldı (2026-04-21 revize)**; Faz B açılışta kelime disiplini ("ön değerlendirme" / "brief özet") + disclaimer + kaza dikeyinde hiç açılmaz + KVKK rıza + sorumluluk feragati | 2026-04-21 |
| R012 | ÜRÜN | Partner ustanın eski müşteri listesi kanalı → usta "platforma gerek yok, beni ara" şeklinde bypass yapar | L2 | I3 | **6** | Partner sözleşme anti-disinter maddesi; mesaj şablonu Naro adına; kupon sadece app-içi; ilk 6 ay %5 komisyon teşviki; anomali tespiti | 2026-04-21 |
| R013 | ÜRÜN | Retention mekanizması (sanal garaj + hatırlatma) lansmanda yok → 23 ay app-kapalı = kullanıcı silinir; brand moat yarım kalır | L3 | I3 | **9** | T+60 son tarihli spec + ekip ataması; pilot sonrası ilk iş; sezonluk içerik + TÜVTÜRK takvim + sigorta hatırlatma + sanal garaj | 2026-04-21 |
| R014 | FİNANS | Disinter matematiği (%5 komisyon + platform bundle = usta pozitif) varsayım; pilotta test edilmemiş — yanlışsa ya usta kaçar ya platform geliri yetmez | L2 | I3 | **6** | Pilot döneminde "usta'ya yönlendirilen iş / app-içi tamamlanan iş" oranı takip (%80 altı = kırmızı sinyal); gerekirse komisyon + avantaj paketi revize | 2026-04-21 |
| R015 | REGÜLASYON | Backend PSP entegrasyonu yanlış kurguda (Marketplace API yerine düz Ödeme API) → Naro anapara tutar → TCMB ödeme kuruluşu lisansı tetikler → tow + ödemeli dikey lansmandan düşer | L2 | I3 | **6** | T-3 BACKEND-DEV sohbetinde [naro-backend/app/integrations/psp/iyzico.py](../../naro-backend/app/integrations/psp/iyzico.py) doğrulaması: sub-merchant + split + payout şart. Yanlışsa pilot ertelenir veya tow dikeyi pilotdan çıkarılır. | 2026-04-24 |

## Kapatılan riskler

| ID | Risk | Kapanış tarihi | Gerekçe |
|---|---|---|---|

_(Boş)_
