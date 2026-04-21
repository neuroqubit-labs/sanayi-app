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
| R002 | PAZAR | Düşük kullanım frekansı (yılda 1-2 kez) — retention düşük, CAC amorti olmuyor | L3 | I3 | **9** | Pasif değer (sanal garaj, servis hatırlatma, muayene/sigorta takvim), sigorta dağıtım ortaklığı ile pasif edinim | 2026-04-21 |
| R003 | PAZAR | Sektörde birçok başarısız startup — yatırımcı + kullanıcı güveni düşük | L2 | I2 | 4 | Farklı değer önerisi belgele (vaka merkezli akış + hasar puanlama); pilot KPI'ları erken konsolide et | 2026-04-21 |
| R004 | OPERASYON | Okuma-yazması zayıf usta segmenti uygulamayı adopt edemiyor | L3 | I2 | **6** | Sesli + ikonik UX, saha temsilcisi onboarding, telefon fallback, sanayi birlikleri ortaklığı | 2026-04-21 |
| R005 | REGÜLASYON | Sigorta iş akışları SEGEM / acentelik gerektirebilir | L2 | I3 | **6** | Erken dönem sadece "sigorta bildirim / dosya asistanı" rolü; acentelik yerine partner sigorta ile co-branded | 2026-04-21 |
| R006 | İTİBAR | Kritik dakikada (kaza) kötü eşleştirme → basına yansıyan şikayet | L2 | I3 | **6** | Acil çekici için auto-dispatch + SLA takip, ilk 100 vakada manuel moderasyon, şikayet eskalasyon kanalı | 2026-04-21 |
| R007 | FİNANS | Disintermediation yüzünden GMV'nin %X'i komisyon olarak düşüyor (sızıntı) | L2 | I2 | 4 | Ödemeyi platform-içinde tutan fayda: kampanya / puan / taksit / garanti; anomali tespiti | 2026-04-21 |

## Kapatılan riskler

| ID | Risk | Kapanış tarihi | Gerekçe |
|---|---|---|---|

_(Boş)_
