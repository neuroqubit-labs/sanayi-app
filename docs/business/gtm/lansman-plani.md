# Lansman Planı — Kayseri Pilot

**Hedef lansman tarihi:** 2026-04-27 (Pazartesi)
**Pilot coğrafya:** Kayseri ili
**Pilot dikey:** Tümü canlı (arıza + bakım + kaza + çekici). **AI ön değerlendirme pilot dışı** (2026-04-21 revize; T+15-30 ayrı sprint).
**Pilot arz:** 10 seçili partner usta (5 minimum acceptable).
**İlk 2 hafta hedefi:** 500-1.000 kayıt, **10-50 başarılı vaka** (frekans revizyonu sonrası üst-band yukarı alındı), ortalama puan ≥ 4.2.

**Pazarlama mesaj önceliği (2026-04-21 revize):** Pilot döneminde "her türlü servis" yerine **bakım + lastik + hatırlatma** omurgası öne çıkar. Gerekçe: bu iki dikey en sık (1 + 1.5 = 2.5 ziyaret/yıl/kullanıcı — toplamın yarıdan fazlası) ve **planlanabilir** (hatırlatma-tabanlı retention mekaniği burada kurulur). Kaza + çekici + arıza canlı ama pazarlamada arka plan. Detay: [../analiz/2026-04-21-servis-ziyaret-frekansi.md](../analiz/2026-04-21-servis-ziyaret-frekansi.md). Tagline eşleşmesi: "Arabanı düşünme." → bakım/lastik hatırlatma değer önerisiyle doğal örtüşür.

Bu plan [../analiz/2026-04-21-lansman-stratejisi.md](../analiz/2026-04-21-lansman-stratejisi.md) analizinden türetildi. Kararlar: [../KARAR-LOG.md](../KARAR-LOG.md).

---

## Zaman çizelgesi

```
Nisan        21  22  23  24  25  26  27  28  29  30
             Pzt Sal Çrş Prş Cum Cmt [PAZ] Sal Çrş Prş
Hat 1 — Usta  ●───●───●───●───●───●───X                     seçim + onboarding
Hat 2 — Kanal     ●───●───●───●───●───●───X                 materyal + temaslar
Hat 3 — Ürün  ●───●───●───●───●───●───X                     canlı hazırlık
Hat 4 — AI    ✗───✗───✗───✗───✗───✗───✗                     PİLOT DIŞI (T+15-30 ayrı sprint)
                                          LANSMAN
Mayıs        04  05  06  07  08  09  10  11
Hat 5 — Ölç.                                  Stop-loss inceleme
```

## Hat 1 — Usta tedariği (T-6 → T-0)

**Hedef:** 10 seçili partner usta, kurulum + eğitim + rozet, 27 Nisan hazır.

| Gün | Aksiyon | Sahip | Çıktı |
|---|---|---|---|
| 21-22 Nis | 15-20 aday liste (BD ağı + Kayseri sanayi siteleri Mimarsinan/Yeni Sanayi referans) | PO + saha | Aday tablosu |
| 22-23 Nis | Hızlı saha ziyareti + mülakat (atölye fiziksel doğrulama, fatura kesimi, referans) | Saha temsilcisi | Mülakat notu, eleme |
| 23-24 Nis | 10 usta seçim kararı + partner sözleşmesi (SLA + komisyon + disinter sözlü) | PO | İmzalı sözleşme |
| 24-25 Nis | App kurulum + onboarding eğitimi (1 saat / usta) | Saha | Usta canlı account |
| 25-26 Nis | Test vaka akışı (mock vaka → teklif → randevu → tamamlanma) | Ürün | Akış doğrulama |
| 26 Nis | Partner rozet + kartvizit + broşür teslim | Saha | Materyal ustada |

**Seçim kriterleri:** fatura/e-Arşiv, fiziksel atölye, 3+ eski müşteri referansı, temel dijital okur-yazarlık, disinter sözlü taahhüt.

**Komisyon (pilot):** %5 (ilk 3 ay), sonra pazara göre kalibrasyon.

**Garanti (pilot):** İlk ay partner ustaya minimum 10 vaka yönlendirme garantisi; gelmezse fark Naro'dan nakit teşvik (düşük volume, maliyet karşılanabilir).

## Hat 2 — Kullanıcı edinme kanalları (T-5 → T+14)

**Hedef:** 500-1.000 kayıt, 2 hafta içinde.

### Kanal A: Partner usta eski müşteri listesi (en yüksek verim)

- **Mekanizma:** Usta kendi WhatsApp/telefon müşteri listesine standart mesaj + davet linki gönderir. Naro mesaj şablonu + deeplink sağlar.
- **Teşvik (müşteriye):** İlk vakada 50 TL indirim kuponu / ilk bakımda %10.
- **Teşvik (ustaya):** Kayıt başı 10 TL platform-içi kredi.
- **Anti-disinter guard:** Mesaj Naro adına; ustanın platform-dışı iletişime yönlendirme yapması sözleşmeye aykırı.
- **Hedef:** 10 usta × 30-40 cevap dönüşü = **300-400 kayıt**.
- **T-5 aksiyon:** Mesaj şablonu + deeplink + kupon kodu hazır.

### Kanal B: Yerel sigorta acentesi

- **Hedef:** Kayseri'de 3-5 bağımsız acente + broker.
- **Mekanizma:** Kartvizit + QR ("kaza/arıza anında tek tık — sigorta dosyası app'te"). Acente poliçe satarken müşteriye elden verir.
- **Teşvik:** Acenteye dönüşüm başına X TL (ilk 3 ay).
- **T-4 aksiyon:** Acente şortlist + temas (PO).
- **T-2 aksiyon:** Kartvizit + QR basılmış, acentelere teslim.
- **Hedef:** **100-200 kayıt**.

### Kanal C: Sanayi sitesi + esnaf çevresi

- **Mekanizma:** Partner ustanın bulunduğu sanayi sitesinde yan esnafa broşür + QR. Sanayi sitesi yönetimiyle duyuru.
- **Teşvik:** Yerel esnafa "referans kodu" — kodla kayıt olan başına kahve/yemek benzeri gündelik ödül.
- **T-3 aksiyon:** Broşür baskı + dağıtım planı.
- **Hedef:** **50-150 kayıt**.

### Kanal D: Yerel medya + sosyal

- **Mekanizma:** 2-3 Kayseri Instagram/YouTube oto kanalı + yerel gazete (Kayseri Gündem, vb.) + Kayseri'ye özel basın duyurusu.
- **Mesaj:** "Kayseri'de aracınızın servisi artık tek tıkta — Naro açıldı."
- **T-2 aksiyon:** Basın bülteni + influencer temas.
- **T-0 aksiyon:** Yayın koordinasyon.
- **Hedef:** **50-200 kayıt** (kalite değişken).

### Kanal E: Noter + ruhsat yenileme noktaları

- **Mekanizma:** Kayseri'deki 2-3 noter çevresi + TÜVTÜRK muayene noktası — QR/broşür dağıtımı.
- **Mesaj:** "Yeni aldığın araca ücretsiz ön-değerlendirme" (AI açılınca değerli; Faz A'da standart mesaj).
- **T-3 aksiyon:** Temas + stand.
- **Hedef:** **30-100 kayıt**.

### Kanal F: Organik referral (canlı sonrası sürekli)

- **Mekanizma:** Her başarılı vakada "arkadaşına X kodu ver — ilk vakada 50 TL indirim, sen de 50 TL kredi kazan".
- **Aktivasyon:** T+1'den itibaren her tamamlanan vaka sonrası.

**Kanal toplamı (2-hafta):** 430-1.050 kayıt. Alt band bile KPI eşiğini karşılar.

## Hat 3 — Ürün canlı hazırlık (T-6 → T-0)

Sorumluluk PO + dev sohbetleri; BD tarafı **checklist takipçisi**:

- [ ] Production ortam (DB + Redis + backend + 2 mobil app) canlı
- [ ] OTP SMS sağlayıcı (Twilio) Türkiye gönderim doğrulandı
- [ ] Kayseri plaka + adres validasyonu çalışıyor
- [ ] Partner ustalar account'ları aktif + profil dolu
- [ ] Vaka akışı uçtan uca test edildi (müşteri → havuz → teklif → randevu → tamamlanma → puan)
- [ ] Ödeme akışı (canlı POS / escrow) — eğer v1'de varsa
- [ ] Şikayet/destek kanalı (telefon + WhatsApp hattı) kurulu
- [ ] Push bildirim sağlayıcı doğrulandı
- [ ] Observability (Sentry/logging) aktif — lansman haftası izleme kritik
- [ ] KVKK rıza akışı + hesap silme + veri indirme canlı

**T-2 stop-go kararı:** Checklist'in %90'ı yeşilse GO. Kritik kırıklarda (ödeme veya OTP veya vaka akışı) pilot 48 saat ertelenir.

## Hat 4 — AI ön değerlendirme (pilot dışı — 2026-04-21 revize)

**Pilot haftasında AI kodu YAZILMAZ, hiçbir formda çalışmaz.** Önceki "Faz A iç araç" kararı iptal ([KARAR-LOG](../KARAR-LOG.md)).

**Pilot dönemi (T-6 → T+14):**
- AI sıfır. Ürün ekibi kritik-path'e (usta onboarding, kanal deeplink/kupon, observability, stop-loss dashboard) odaklanır.
- Vaka akışı UX parçası olarak **görsel + ses + metin tarif + araç bilgisi**ni zaten topluyor (kolaylık omurgası gereği). Bu veriler storage'a kayıt kalır — AI modülü olmadan.
- Mühendislik: KVKK + retention compliant bir şekilde bu ham veriyi ileri kullanım için saklayacak data layer.

**AI sprint (T+15 → T+30):**
- AI modülü ayrı sprintte yazılır (context-gather agent + multimodal LLM + web search + kalibrasyon log).
- Pilot'ta toplanan vaka verileri ile post-hoc kalibre edilir.

**Kalibrasyon testi (T+30 → T+45):**
- 20 gerçek vaka × AI tahmini ≥ %70 doğruluk (usta teşhisi ile uyumlu).
- Geçerse Faz B açılır; geçmezse 30 gün daha kalibrasyon veya V2'ye ertele.
- Karar: PO + BD müşterek.

**Faz B (kalibrasyon OK ise, T+45+):**
- Sadece **arıza dikeyi**; "Hızlı ön değerlendirme" etiketli (teşhis değil).
- Beta rozeti + belirsizlik skoru + disclaimer + "ustaya göster" butonu.
- Kullanıcı tarafı ayda 1 hak; usta tarafı "vaka brief özeti" (teşhis değil) — her vakaya ücretsiz.

**Kaza dikeyinde AI ASLA açılmaz** (sigorta + hukuki risk).

## Hat 5 — Ölçüm + stop-loss (T+1 → T+14)

Günlük dashboard:

| Gün | İzlenen | Eşik | Aksiyon |
|---|---|---|---|
| T+1-3 | Kayıt hızı | > 30/gün | Yavaşsa kanal düzelt |
| T+3-7 | İlk vaka açılımı | ≥ 10 kümülatif | Düşükse UX düzelt |
| T+7 | Başarılı vaka | ≥ 5 kümülatif | Düşükse partner usta ile toplantı |
| T+14 | Başarılı vaka + puan | ≥ 15 başarı, ≥ 4.0 puan | Eşik altında **STOP-LOSS** |

**Stop-loss aksiyonu:** Yeni kullanıcı kazanma kanalları durdurulur, mevcut havuzla sebep analizi, pilot revize edilir. Kamusal yayılma hızlandırılmaz.

## Kritik açık sorular (PO yanıtı bekliyor)

Bu plan aşağıdaki sorulara PO cevabı olmadan tamamlanmış sayılmaz. Cevap geldikçe bu dosya güncellenir, karar [../KARAR-LOG.md](../KARAR-LOG.md)'a düşer.

1. 10 usta seçimi — saha temsilcisi kim? (PO mu, dış kaynak mı?)
2. Partner usta vaka garantisi — aylık 10 vakaya GO mu? Teşvik bütçesi?
3. Komisyon %5 pilot kararı onay mı?
4. Sigorta acentesi ilk temas listesi — PO'nun erişimi var mı, yoksa saha mı araştırıyor?
5. Referral kupon ekonomisi — kullanıcı 50 TL / usta 10 TL önerisi uygun mu?
6. AI Faz B eşiği — 20 vakada ≥ %70 doğruluk kabul mü, ya da farklı KPI?
