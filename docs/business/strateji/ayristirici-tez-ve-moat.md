# Naro — Ayrıştırıcı Tez ve Moat Stratejisi

**Yazım:** 2026-04-21 BD kick-off derinleştirmesi
**Statü:** Canonical strateji dokümanı (analiz değil — kalıcı tez)
**İlgili:** [../analiz/2026-04-21-marka-ve-sektor-okumasi.md](../analiz/2026-04-21-marka-ve-sektor-okumasi.md), [../KARAR-LOG.md](../KARAR-LOG.md)

---

## 0. Tezin özü

**Naro'yu lansman günü ayrıştıran şey:** yedi stratejik "hayır" (ne yapmadığımız). Başarısız rakipler bu yediyi aşamadı.

**Naro'yu 18 ay sonra ayrıştıracak olan şey:** üç moat — data flywheel + network effect + brand/trust kapitali.

**Uzun vadeli varoluş hakkı:** Use case mimarisi, AI, mobil app kalitesi — hiçbiri kalıcı ayrıştırıcı değil. Rakip hepsini 18 ayda kopyalar. Kalıcı olan şey **moat'ı inşa etmiş olmak**, o moat'ı inşa ettirecek **pilot disiplinini gösterebilmek**, o disiplinle **zaman avantajını kullanabilmek**.

Tez üç halka şeklinde: dış halka (sektör yapısı), orta halka (ayrıştırıcı stratejik seçimler), iç halka (moat).

---

## 1. Türkiye oto servis sektörü — derin harita

### 1.1 Hacimler

- **~27 milyon trafiğe kayıtlı araç** (TÜİK 2024); aktif kullanılan ~20 milyon.
- **Yıllık pazar:** 150-200 milyar TL (bakım + tamir + parça; çekici + sigorta eksperliği dahil değil).
- **Vaka hacmi/yıl:** bakım 15-20 milyon, arıza ~10 milyon, kaza ~2 milyon (TSB hasar verisi), çekici çağrısı ~2-3 milyon.
- **Ortalama vaka ticket'ı (tahmin):** bakım 1.500-3.000 TL, arıza 2.500-5.000 TL, kaza onarımı 15.000-40.000 TL, çekici 500-1.500 TL.
- **3+ yaş araç/kullanıcı başına yıllık ziyaret (Naro kapsamı):** ~4-5 — detay + dökümü [../analiz/2026-04-21-servis-ziyaret-frekansi.md](../analiz/2026-04-21-servis-ziyaret-frekansi.md); canonical gelir modeli [../monetizasyon/gelir-modeli.md](../monetizasyon/gelir-modeli.md).

### 1.2 Arz tarafı — altı ayrı kale

| Kale | İşletme sayısı | Güç | Kırılgan nokta |
|---|---|---|---|
| **Yetkili servis (OEM)** | 500-800 | Marka güveni, ürün-garanti bundle, finansman | Pahalı; garantisi biten araç kaybediliyor; özel sanayi rekabetinde zayıf |
| **Bağımsız usta / sanayi sitesi** | ~60-70 bin işletme (TESK) | Fiyat avantajı, lokal ağ, müşteri yakınlığı, özel bilgi | Dijital-dışı, fatura-dışı, kalite oynak, marka yok, gri ekonomi |
| **Sigorta asistans ağları** | 50-100 büyük, 10-15 bin alt sözleşmeli | Poliçe müşterisine doğrudan erişim, çağrı merkezi | Sadece sigortalı + sadece kaza/yol yardımı; bakım/arıza yok; tek-sigortalıya tek-app sorunu |
| **Çekici kooperatifleri + bağımsız** | ~10-15 bin | Hiperlokal, 7/24 hazır, geleneksel müşteri ağı | Dijital zayıf, fiyat şeffafsız, yerel tekel |
| **Sigorta eksperi** | ~3-5 bin | Hasar değerlemesi tekel lisans | Darboğaz, bekleme 3-14 gün |
| **Yedek parça e-ticaret** | 5-10 büyük oyuncu | Fiyat şeffaf + lojistik | Sadece parça, hizmet yok |

### 1.3 Rakip app'ler — neden boşluğu kapatamadılar

| Oyuncu | Model | Sınır nedeni |
|---|---|---|
| **Sigorta-bundle** (AXA Asistans, Allianz, Türkiye Sigorta, Anadolu) | Yol yardım + çekici + hasar dosyası, poliçe sahibine ücretsiz | Sigortasız kitleye kapalı; bakım/arıza kapsam dışı; markaya bağımlı; tek-sigortalıya tek-app problemi |
| **OEM app** (Ford MyRoute, Volvo, BMW Connected) | Yetkili servis randevu + marka iletişim | Sadece kendi marka araç; garantisi biten kullanıcı kaybı; özel sanayiyi kapsamıyor |
| **Sanal Usta, Otopuan, Şiftoto** (kapandı/niche) | Marketplace-genel | Toptan arz + dijital-only edinme + geniş kapsam → klasik 5 hata |
| **Yol yardım app** (TTK, bağımsız çekici) | Acil çekici | Tek dikey; bakım/arıza yok; UI zayıf |
| **İkinci el + servis birleşik** (Garenta Market) | Alım-satım ana iş | Servis periferik, öncelik yok |

### 1.4 Pazar boşluk haritası — beş açık koridor

1. **Özel sanayi dijitalleşmedi.** %95 pazar hisseli sektör dijital-dışı. Bu tek başına trilyon-TL koridoru.
2. **Tüm dikey birleşik app yok.** Herkes tek dikeye gömülü (sigorta sadece kaza, OEM sadece bakım, çekici sadece acil).
3. **Marka-bağımsız + sigorta-bağımsız bir yer yok.** Araç modeli ne olursa olsun, poliçe olsun-olmasın çalışan tek platform = yok.
4. **Usta + müşteri arası ekonomi kurulmamış.** Escrow + garanti + rating + itibar mekanizması yok.
5. **AI teşhisi 2026'da ilk defa faydalı** — önceki denemeler LLM öncesi dönem.

Naro'nun bu beş boşluğu birlikte kapsama iddiası = **büyüklük argümanımız**.

---

## 2. Başarısızların 5 hatası — her birinin ekonomik anatomisi

### Hata 1 — Toptan arz kabul

**Mekanik:** Platform açılır, "herkes usta olabilir" diye tüm oto tamircilerini davet eder. Hızlı büyüme baskısı altında kalite filtresi zayıf uygulanır.

**Neden öldürür:** Yılda 2 kullanan müşteri **ilk vakada** kötü deneyim yaşarsa geri gelmez. Düşük frekans + simetrik güvensizlik = ilk izlenim tek izlenim. Ortalama-altı usta platformu zehirler; iyi usta işini yapar ama platform-dışı kalır; bad-apple effect'i hızlı.

**Ekonomik analiz:** 100 usta × %30 ortalama-altı = 30 kötü deneyim yayılır. Her kötü deneyim 5-10 kişiye anlatılır (özellikle sosyal medya çağında). 30 × 7 = ~200 potansiyel kullanıcı kaybı, ilk 90 günde. Platform bunu çeviremez.

**Çıkış yolu:** Seçili kurasyon. Kalite > hız. Naro = 10 seçili partner.

### Hata 2 — Dijital-only edinme (paid marketing bağımlı)

**Mekanik:** Meta/Google reklamlarına CAC harcanır. Düşük frekansta LTV geri gelmez.

**Neden öldürür (rakiplerin hesabı — toptan segment):**
- Kullanıcı yılda ~2 vaka (tüm segment ortalaması)
- Komisyon %10 × 2.000 TL = 200 TL/vaka
- Yıllık brüt gelir/kullanıcı = 400 TL
- Paid CAC = 300-500 TL (sektör ortalaması)
- Break-even 12-18 ay — ama retention %40-60 ise LTV geri gelmez

**Naro revize (2026-04-21, 3+ yaş segment):**
- Kullanıcı yılda **4 vaka** (Naro kapsamı; bkz [analiz/2026-04-21-servis-ziyaret-frekansi.md](../analiz/2026-04-21-servis-ziyaret-frekansi.md))
- Pilot %5 komisyon × 1.600 TL ağırlıklı ticket = **~500 TL/yıl** Naro payı
- CAC hedefi LTV/CAC ≥ 3 → ≤ 335 TL; post-pilot %7-8 komisyon ile **≤ 540 TL**
- Güven-transferi kanallarımızda CAC 10-80 TL → paid marketing zaten açık kalabilir
- **Stratejik fark:** Segment daraltması (3+ yaş) + kanal tercihi (güven-transferi) bu hatayı Naro'da geçersiz kılar.

Investor sabrı bitmeden ölçek yakalanmaz. Yatırım kapanır, şirket kapanır.

**Çıkış yolu:** Güven-transferi kanalları (CAC sıfıra yakın). Naro = partner usta eski müşteri listesi + sigorta acente + yerel esnaf.

### Hata 3 — Erken geniş kapsam

**Mekanik:** Launch'ta Türkiye çapı + tüm dikey açılır. "Big bang" yaklaşımı.

**Neden öldürür:** Coğrafi fragmantasyon — şehir başına farklı usta + fiyat + kültür. Tek marketing mesajı tüm Türkiye'ye uymaz. Tek arz stratejisi tüm şehirlere uymaz. Kaynağı dağıtır, hiçbir yerde masa kurmuş gibi olmaz. Ayrıca **ilk vakalarda gözetim imkânsız** — 500 vakanın kalitesini elle takip edemezsin.

**Çıkış yolu:** Dar pilot, derin git. Kayseri tek şehir + tüm dikey (ama AI gizli, odak bakım + arıza). Başarılı olursa replike et. Kopyalanabilecek bir kalıp çıkar.

### Hata 4 — Disintermediation ekonomisi ignore

**Mekanik:** Komisyon %15-25 konur (marketplace standardı). Usta "çok" diye bypass eder. Komisyon %5 konur, platform geliri yetmez.

**Neden öldürür:** Bu ikilem çözülmeden marketplace işlemez. Çoğu platform yüksek komisyon koyar, usta platformdan iş almaya başlayınca "bu müşteriyi platform-dışı ara" mekanizması kurar. Müşteri ikna olursa platform bypass edilir; komisyon GMV sızar. Platform büyümez.

**Ekonomik çözüm — Naro'nun yaklaşımı:**
- Komisyon %5 (düşük, usta kaçmaz).
- Ama platform kullanıcıya **ek katma değer** sunar ki kullanıcı platform-içi kalmayı tercih etsin:
  - Escrow (usta platform dışında ödeme istediğinde kullanıcıya koruma yok)
  - Garanti (app'ten kayıtlı işler için Naro garantisi)
  - Kampanya/kupon (app-içi düşük fiyat)
  - Geçmiş kayıt (araç servis tarihçesi — satışta araç değer artışı)
  - Şikayet kanalı (platform-dışı işte şikayet yeri yok)
- Usta %5 ödeyerek şunları kazanır: SLA + iş yönlendirme + rozet + kampanya görünürlüğü. Net hesap pozitif.
- Matematik: Usta'nın eski %100'lük iş akışı × %2 fire (ulaşamadığı müşteri) = %98. Naro'nun bulduğu yeni %20 iş × %95 net (komisyon sonrası) = %19 extra. Toplam 117 vs 100 → usta net %17 kazançlı. Platform bırakma motivasyonu düşer.

**Risk kalır:** Usta eski müşteri listesini kanal olarak kullanırken "beni direkt ara" demeye başlarsa çökme olur. Anti-disinter mekanikleri (kupon app-içi, anomali tespiti, sözleşme) bunu yavaşlatır ama sıfırlayamaz.

### Hata 5 — Retention çözümsüz

**Mekanik:** Düşük frekans = kullanıcı app'i açmaz. Bildirimler gelmez. Telefonda boş yer tutar. Silinir.

**Neden öldürür:** Yılda 2 işlem yapan kullanıcı app'i **23 ay** kullanmaz. Bu sürede:
- Telefon değişir — app yeniden kurulmaz.
- Depolama dolar — kullanılmayan app silinir.
- Rakip çıkar — akılda kalan o olur.
- Kullanıcı problemi yaşadığında WhatsApp'a / arkadaşına döner (zaten güven oradadır).

**Çıkış yolu — pasif değer mekanizması (Naro için en zayıf moat unsuru şu an):**
- **Sanal garaj** — araç belgeleri, geçmiş, fatura, garanti app'te tutulur. Araç satışında değeri artırır → kullanıcı silmez.
- **Hatırlatma takvimi** — muayene 1 ay kala, sigorta 15 gün kala, lastik değişim mevsim öncesi. App'i kullanıcıya söylettirme, **app kullanıcıyı haber etsin**.
- **Sezonluk içerik** — kış öncesi antifriz, yaz öncesi klima bakımı. Pasif push.
- **Araç kıyaslama verisi** — "senin modeldeki ortalama aylık yakıt, servis maliyeti" — pasif değer.
- **Topluluk layer** (V2) — aynı modeldeki sahiplerden deneyim, ipucu.

**Durumumuz:** Lansmanda bu mekanizmalar **YOK**. Bu kabul ettiğimiz risk. Lansman sonrası T+60 gün içinde **sanal garaj + hatırlatma** zorunlu; yoksa retention %20 altında kalır.

---

## 3. Ayrıştırıcı = seçim stratejisi (Porter çerçevesi)

**Strateji = neyi yapmayacağını seçmektir** (Michael Porter). Rakipten farklı olabilmek için rakibin yaptığını yapmamak gerekir.

Naro'nun yedi stratejik "hayır"ı:

| # | Hayır | Evet | Rakip ne yapıyor | Neden bizi ayrıştırıyor |
|---|---|---|---|---|
| 1 | Geniş coğrafi kapsam | Kayseri tek şehir pilot | Türkiye çapı launch | Derin öğren + kalıp çıkar |
| 2 | Toptan usta | 10 seçili partner | Kime başvuran kabul | Kalite filtresi |
| 3 | Paid marketing | Güven-transferi kanalları | Meta/Google bağımlı | CAC sıfıra yakın |
| 4 | Yüksek komisyon (%15-25) | %5 pilot + platform bundle | Marketplace standart %20 | Usta'da platform-dostu ekonomi |
| 5 | Riskli AI canlı | İki-fazlı, **REVİZE:** pilot-dışı | "AI özellik ekleyelim" hype | Kalibrasyon + beta disiplini |
| 6 | Tüm dikey eşit | Kolaylık odağında öncelik | Feature-rich kafa karışıklığı | UX odaklı tercih |
| 7 | Büyüme > retention | Stop-loss disiplini | Büyüme-her-şey kültürü | Kötü ürünü viral yapmama |

**Porter'ın ikinci kuralı:** Stratejik seçim **zor** olmalı, yoksa rakip kopyalar.

Naro'nun seçimlerinden hangileri **zor**?
- #1 (dar pilot) — **zor**; girişimci psikolojisi "büyük düşün"e yatkın.
- #2 (seçili usta) — **orta zor**; saha emeği + sabır gerekir.
- #3 (güven-transferi) — **zor**; network/PO'nun saha bağlantısı gerekir.
- #4 (düşük komisyon + bundle) — **zor**; matematiği kurmak karmaşık; kısa vadede gelir düşük görünür.
- #5 (AI disiplini) — **orta kolay**; karar basit ama istek karşısında disiplin gerekir.
- #6 (kolaylık odağı) — **orta zor**; feature pressure'a karşı.
- #7 (stop-loss) — **zor**; "lansman durdurma" psikolojik olarak kabul etmesi zor.

Toplam puan: 5 "zor" + 2 "orta zor" = yüksek rakip-kopyalama maliyeti. Bu iyi haber.

---

## 4. Moat — 18 ay sonra bizi ayrıştıracak olan

### Moat 1 — Data flywheel

**Nedir:** Her vakada, her usta performansında, her kullanıcı davranışında biriken veri. Rakibin sıfır veriyle başlayamayacağı birikim.

**Bileşenleri:**

| Veri seti | Kullanım | Rakibin elde etme maliyeti |
|---|---|---|
| AI ön değerlendirme tahmini × gerçek usta teşhisi | AI kalibrasyonu | En az 6 ay canlı vaka |
| Usta performans (süre, puan, şikayet, retention) | Akıllı eşleştirme | 12 ay × 100+ usta |
| Kullanıcı davranış (vaka türü → kanal → dönüşüm) | CAC optimizasyonu | 12 ay × 1000+ kullanıcı |
| Marka × model × yaş × arıza olasılık modeli | Öngörülü bakım | 2 yıl × çeşitli araç |
| Lokasyon × saat × dikey × fiyat verisi | Dinamik fiyat/SLA | 18 ay |
| Şikayet + çözüm + memnuniyet sonuç | Moderasyon + iyileştirme | Canlı iş deneyimi |

**Rakibin kopyalama süresi:** 18-36 ay + ciddi yatırım. Çoğu rakibin finansmanı 24 ay içinde biter.

**Naro'nun hamleleri:**
- İlk günden veri modelini doğru tasarla (KVKK uyumlu + event-log zengin).
- Pilot döneminde bile veri topla (AI olmasa da vaka tarif + görsel saklanır).
- 6. aydan itibaren veriyi ürüne geri bes (akıllı eşleştirme, öngörülü hatırlatma).

### Moat 2 — Network effect

**Nedir:** Partner + aktör ağı büyüdükçe platform değerinin çarpan artışı.

**Naro'da network effect kaynakları:**

| Ağ | Büyüdükçe kime fayda | Rakip para ile alamaz mı |
|---|---|---|
| Partner usta ağı | Kullanıcıya (seçenek) + ustaya (görünürlük) | Rozet + ekonomik entegrasyon + itibar — taklit edilir ama geçiş maliyeti yüksek |
| Sigorta acente ortaklığı | Kullanıcıya (poliçe-bundle) + acentede (ek gelir) | Co-branded sözleşmeler exclusive → rakibe kapanır |
| Yerel esnaf ağı (sanayi sitesi) | Lokal kapsamda güven | Kişisel ilişki — para ile devralınamaz |
| Kullanıcı referral ağı | Yeni kullanıcıya güven | Düşük-CAC = rakip paid CAC ile yarışamaz |
| Yerel medya + influencer kontakt | Bedava/düşük erişim | İlişki + geçmiş iş birliği — yeni oyuncu ya yüksek öder ya reddedilir |

**Güçlü nokta:** Anti-disinter mekanizmaları kurulu ağa karşı rakibin girişim maliyetini yükseltir. Usta Naro partner'iyse rakip app'ini yüklemez (zaten işi var, karmaşa).

### Moat 3 — Brand + trust kapitali

**Nedir:** Düşük frekanslı sektörde **ihtiyaç anında akılda kalan ilk marka** büyük avantaj.

**Nasıl birikir:**
- İlk başarılı deneyim yaşatan marka → kullanıcı 6 ay sonra ihtiyacı olduğunda onu arar.
- Ağızdan-ağıza yayılan yerel hikayeler → arkadaş tavsiyesi.
- "Arabanı düşünme." sloganı → unutulmaz ibare.
- Yerel medya + basın → kurumsal güven sinyali.
- Partner usta rozeti sokakta görülür → sürekli pasif reklamcı.

**Rakibin kopyalama zorluğu:** Reklam bütçesiyle *dikkat* alınabilir ama **güven** alınamaz. Sektörün güven açığı 10 yıllık başarısız startup hafızası taşıyor; yeni rakip bu şüphecilikle karşılaşır. Naro erken alırsa, kullanıcı "Naro'da iyi deneyim yaşadım" diye rakibi denemez.

**Naro'nun hamleleri:**
- Erken basın: Kayseri'de ilk.
- Kullanıcı hikayelerini ayda 1 case-study olarak yayınla.
- Partner usta rozet + sticker — fiziksel güven sinyali.
- Tagline disiplini (tek mesaj, tutarlı).
- Şikayet yönetimi halka-açık (Trendyol benzeri — şikayet kanalının varlığı güven inşa eder).

### Üç moat'ın ortak noktası

**Zamanın fonksiyonu.** Üçü de **günde inşa edilmez**. 6-18 ay lazım. Rakip bizi kopyalamak için 18-24 aya ihtiyaç duyar. Biz 18 ay önde başlarsak → **permanent lead**.

Bunun kritik sonucu: **Pilot'un başarısı zaman kazanmaktır.** Kayseri pilot başarılı olursa, İstanbul/Ankara/İzmir açılımı rakibe duyurulmadan yapılır. Rakibin reaksiyonu 6-12 ay gecikmeyle gelir.

---

## 5. Lansman sonrası 18-ay moat inşa yol haritası

### T+0 → T+30 (pilot + ilk revize)
- Kayseri pilot stop-loss ile yönetilir.
- Veri toplama ve etiketleme protokolü kurulur.
- Partner usta rozet + sözleşme fiziksel.

### T+30 → T+90 (pilot+2 şehir kararı)
- Kalıp doğrulanmış ise 2. şehir (Ankara bir semti veya Konya ili?) planı.
- **Retention mekanizması** (sanal garaj + hatırlatma) — ZORUNLU. Bu 60 güne yetişmezse moat #3 inşası yarıda kalır.
- AI Faz B kalibrasyon sonucu (T+30-45 ayrı sprint sonrası).
- İlk sigorta acentesi MoU.

### T+90 → T+180 (ölçek başlangıcı)
- 3-5 şehir.
- AI Faz B açık (arıza + sınırlı bakım).
- Data flywheel ürüne geri beslemeye başlar (akıllı eşleştirme, öngörülü hatırlatma).
- Anti-disinter mekanikler v1 yayın.

### T+180 → T+365 (moat katmanları)
- Sigorta co-branded ortaklık en az bir büyük sigorta ile (Anadolu veya Türkiye Sigorta önde).
- 10+ şehir.
- Kullanıcı topluluk katmanı v1 (yorum + topluluk ipuçları).
- Markaya yatırım (TV reklam fizibilite, influencer kit).

### T+365 → T+540 (kilitleme)
- Pazar payı lider segment (özel sanayi bağımsız usta) %2-5.
- 20+ şehir.
- V2 feature set: öngörülü bakım + B2B filo + yedek parça mini-marketplace.
- Rakip girmeye çalıştığında üç moat ayakta.

---

## 6. Kritik açık sorular ve zayıf nokta

### 6.1 Retention / pasif değer — en zayıf halka

**Sorun:** Lansmanda retention mekanizması yok. Sanal garaj, hatırlatma, sezonluk içerik — hiçbiri T+0'da mevcut değil.

**Risk:** Kullanıcı 23 ay boyunca app'e dönmezse silinir. Moat #3 (brand) yarıda kalır.

**Öneri:** T+60 gün son tarihi ile sanal garaj + hatırlatma takvimi canlıya alınmalı. Bu, pilot başarılı olsun olmasın, yapılmalı (başarısızsa da veri topluyoruz).

### 6.2 Sigorta ortaklığı — stratejik ama geç

**Sorun:** Lansmanda yerel acente ile çalışıyoruz. Ulusal sigorta ortaklığı (AXA, Allianz, Türkiye Sigorta) yok.

**Risk:** Onların asistans app'i boşluğumuzu kapatmaya başlayabilir.

**Öneri:** T+30 itibariyle ulusal sigorta ile MoU konusu açılsın. Kayseri pilotun başarı verisi ile pitch gelir.

### 6.3 Disinter mekanizmaları — matematik kanıt gerekir

**Sorun:** "Usta %5'le kalır" hesabı varsayım. Pilot'ta test edilmeli.

**Risk:** İlk 30 günde bir iki usta platformu bypass etmeyi deneyebilir. Matematiği yanlış kurmuşsak hızlı düşer.

**Öneri:** Pilot'ta "usta başına yönlendirilen iş / gerçekten app-içi tamamlanan iş" oranı takip edilmeli. Oran %80 altına düşerse disinter mekaniği güçlendirilmeli.

### 6.4 AI Faz B zaman çizelgesi

**Yeni karar:** Pilot dışı. T+30-45 arası kalibrasyon. Ama kalibrasyon başarılı değilse nasıl revize edeceğiz? Şu an plan B yok.

**Öneri:** T+45'te karar noktası — ya açılır, ya 30 gün daha kalibrasyon sürer, ya tamamen iptal (V2'ye ertelenir). Kriter: 20 vaka × ≥%70 doğruluk.

---

## 7. Tez özeti (yeni oturumda okunur)

Naro:

- **Ölümlü sektörde değil, zor sektörde çalışıyor.** Başarısız rakipler yapısal zorluğa değil, kendi stratejik hatalarına yenildi.
- **Lansman günü ayrıştırıcı = 7 stratejik "hayır".** Kopya maliyeti yüksek ama mutlak değil.
- **18 ay sonra ayrıştırıcı = 3 moat (data + network + brand).** Zamanın fonksiyonu; pilot başarısı tohum.
- **Kritik zayıf nokta: retention.** T+60 sanal garaj + hatırlatma olmadan moat yarım kalır.
- **Pilot başarısı = 18 ay zaman kazanmak.** Rakibin reaksiyonu 6-12 ay gecikmeli gelir; moat o arada inşa edilir.

Bu tez **canonical**. Değişirse revize girdi ile buraya + KARAR-LOG'a düşer.
