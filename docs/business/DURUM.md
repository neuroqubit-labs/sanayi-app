# Business Development — Durum Panosu

**Son güncelleme:** 2026-04-21 (BD kick-off + kanal analizi)

> **Lansman:** 2026-04-27 Pazartesi · **Pilot:** Kayseri · **T-6**

## Yeni oturum başlangıç sırası

1. Bu dosyayı oku (top-3 öncelik + açık sorular).
2. [KARAR-LOG.md](KARAR-LOG.md) — son 5 P0 karar.
3. [analiz/2026-04-21-lansman-stratejisi.md](analiz/2026-04-21-lansman-stratejisi.md) — kick-off analizi (kolaylık omurgası, oran kalibrasyonu, Kayseri, seçili usta, AI iki-faz).
4. [analiz/2026-04-21-kullanici-edinme-kanallari.md](analiz/2026-04-21-kullanici-edinme-kanallari.md) — Kayseri kanal stratejisi (9 kanal, 6-gün takvimi, PO onay bekleyen 4 soru).
5. [analiz/2026-04-21-marka-ve-sektor-okumasi.md](analiz/2026-04-21-marka-ve-sektor-okumasi.md) — logo/app icon insani değerlendirme + sektör neden yaygınlaşmadı (7 yapısal neden + 5 ortak hata + Naro'nun tutumu).
6. [strateji/marka-sesi.md](strateji/marka-sesi.md) — marka sesi çerçevesi (canonical, her iletişim yüzeyi için).
7. [gtm/lansman-plani.md](gtm/lansman-plani.md) — 5 hatlı T-6 → T+14 plan.

## Top-3 öncelik (T-6)

| # | Öncelik | Seviye | Hedef çıktı | Termin |
|---|---|---|---|---|
| 1 | 10 seçili partner usta tedariği (Kayseri) | P0 | Sözleşmeli + onboarded + rozet teslim | T-1 (26 Nis) |
| 2 | Kullanıcı edinme kanalları aktivasyonu (Kanal A+C öncelikli) | P0 | 500-1.000 kayıt + **10-50 başarılı vaka** / 2 hafta | T+14 (11 May) |
| 3 | Retention mekanizması (sanal garaj + hatırlatma) planlaması | P1 | T+60 son tarihli spec + kritik-path'e alma | T+60 (en geç) |

## Aktif workstream'ler

| Hat | Konu | Durum | Sonraki adım |
|---|---|---|---|
| 1 | Usta tedariği | PO + saha sorumluluğu | T-5 aday liste (15-20) |
| 2 | Kanal aktivasyonu | PO onay bekleniyor | PO cevapları → `lansman-plani.md`'ye entegrasyon |
| 3 | Ürün canlı checklist | Dev sohbetlerinde yürüyor | T-2 stop-go |
| 4 | AI — pilot dışı | Sprint back-log | T+15-30 ayrı sprint; pilot haftasında kod yok |
| 5 | Ölçüm + stop-loss | Kurulmadı | Günlük KPI dashboard (T+1 itibaren) |

## Açık sorular (PO kararı bekliyor)

**Usta/operasyon:**
1. 10 usta seçim saha temsilcisi — PO mu, dış kaynak mı?
2. Partner usta aylık vaka garantisi — 10 vaka? Teşvik bütçesi?
3. Pilot komisyon oranı — %5 onay mı?

**Kanal (bkz [analiz/2026-04-21-kullanici-edinme-kanallari.md](analiz/2026-04-21-kullanici-edinme-kanallari.md)):**
4. Kanal A (usta müşteri listesi) anti-disinter mekaniği yeterli mi?
5. Kanal D (IG paid) — 5-10K TL deneme bütçesi onay mı, yoksa %100 organik mi?
6. Kanal teşvik paketi (kullanıcı 50 TL, usta 10 TL, yan esnaf 10 TL, acente 20-50 TL, referral 2×50 TL) onay mı?
7. Sigorta acentesi temas — PO erişimi var mı, saha mı araştıracak?
8. "Naro Kayseri'de" açılış etkinliği — T-1 akşam / T-0 öğlen / T+3 hafta sonu?

**Ölçüm + karar:**
9. AI Faz B açılış eşiği (20 vakada ≥ %70 doğruluk) onay mı? Geçmezse plan B (30 gün ek kalibrasyon vs V2'ye ertele)?
10. Stop-loss T+14 kararı — PO + BD müşterek mi?
11. **Retention mekanizması** (sanal garaj + hatırlatma) T+60 son tarihli spec ne zaman başlar? Hangi ekip?

## Son kararlar (KARAR-LOG özet)

- 2026-04-21 — **Servis frekans varsayımı revize:** 3+ yaş segmentte yılda ~5 ziyaret (Naro kapsamı ~4). LTV 400→720 TL; oran 1:80-120; R002 skor 9→6; pazarlama önceliği bakım+lastik.
- 2026-04-21 — Değer önerisi omurgası: **"kolaylık"**
- 2026-04-21 — Pilot: **Kayseri**, tüm dikey canlı
- 2026-04-21 — Arz: **10 seçili** partner usta (random değil)
- 2026-04-21 — **AI pilot'tan tamamen çıkarıldı** (önceki iki-faz kararı REVİZE): T+15-30 ayrı sprint, T+30-45 Faz B kararı
- 2026-04-21 — Stop-loss: T+14'te <10 başarılı vaka veya <3.5 puan = dur

## Canonical strateji

- [strateji/ayristirici-tez-ve-moat.md](strateji/ayristirici-tez-ve-moat.md) — sektör haritası + 5 başarısızlık hatası + 7 stratejik "hayır" + 3 moat (data + network + brand) + 18-ay moat inşa yol haritası. **Zayıf nokta: retention** — T+60'a sanal garaj + hatırlatma olmalı.
- [strateji/marka-sesi.md](strateji/marka-sesi.md) — "25 yıl sanayi + MBA abi" çekirdek kişilik, 6 ses ekseni, do/don't, bağlam varyantları (app/push/email/kurumsal/AI), AI üretken dil özel çerçevesi, tagline A/B.

## Paralel başlatılabilir (PO cevabı beklemeden)

- Kayseri sigorta acentesi aday taraması ([ortakliklar/pipeline.md](ortakliklar/pipeline.md))
- Kayseri yerel oto Instagram/YouTube kanal taraması
- Usta mesaj şablonu taslağı + deeplink + kupon kodu
- Yerel rakip/WhatsApp servis grubu taraması
- Basın bülteni taslağı
