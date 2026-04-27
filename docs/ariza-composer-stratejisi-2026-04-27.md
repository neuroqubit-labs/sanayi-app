# Arıza Composer Stratejisi

**Tarih:** 2026-04-27
**Statü:** Tasarım ve uygulama prensibi
**Referans:** `docs/naro-vaka-omurgasi.md` §2.2, `docs/vaka-merkezli-carsi-bildirilebilir-usta-2026-04-26.md`

## 1. Temel İlke

Arıza bildirimi teknik form değildir; kullanıcının yaşadığı belirsizliği düzenli bir **vaka dosyasına** çeviren kısa bir rehberdir.

Kullanıcı "aracımda ne oluyor?" sorusuna cevap verir. Sistem bunu typed kategori, semptom, medya, konum ve zaman sinyallerine çevirir. Bu sinyaller daha sonra backend matching için servis etiketlerine dönüşür.

Kural:

> Somut gözlem önce gelir; teknik açıklama ve uzun not sonra gelir. Çekici veya sürülebilirlik gibi ikinci kararlar arıza composer'ın ana yükü değildir.

## 2. Tasarım Prensipleri

- **Kısa sahneler:** Kullanıcı aynı anda hem uzun scroll hem ayrı footer ritmiyle uğraşmaz. Her sahne tek karar kümesi taşır.
- **iOS vari sakinlik:** Koyu yüzey, grouped kartlar, az ama net seçenekler, kısa microcopy, gereksiz dekor yok.
- **Doğal CTA:** İleri/geri aksiyonları sahnenin sonunda yer alır; sticky footer hissi azaltılır.
- **Teknik dil yok:** "OBD, rektefiye, elektronik arıza" gibi jargon ancak seçenek bağlamı gerektiriyorsa görünür.
- **Seçili durum net:** Seçili kartlarda ring/badge/tik açık olmalı; kullanıcı nerede olduğunu kaybetmemeli.
- **Açıklama doğru anda:** Kullanıcı fotoğraf/ses eklerken olayı tekrar hatırlar; kısa açıklama bu sahnede alınır.
- **Harita ortak primitif:** Arıza, bakım ve hasar konum seçimi aynı sade map/location primitive'ini kullanmalı; çekici haritası kadar ağır dispatch UI'ı olmamalı.
- **Backend'e uygun veri:** Seçimler `breakdown_category`, `symptoms[]`, `attachments`, `notes`, `location_label`, `location_lat_lng`, `preferred_window`, `price_preference`, `on_site_repair`, `valet_requested` alanlarına temiz map edilir.

## 3. Sahne Yapısı

### 1. Ne Oluyor?

Amaç: Arızanın ana alanını ve gözlemlenen belirtileri toplamak.

İçerik:

- Kompakt kategori kartları: motor, elektrik, mekanik, klima, şanzıman, lastik, sıvı, diğer.
- Kategori seçilince kategori header'ı görünür ve "Değiştir" aksiyonu kalır.
- Kategoriye bağlı semptom soruları açılır.
- Devam koşulu: kategori seçili + en az bir belirti.

Tasarım notu:

- İlk ekranda kullanıcının zihnini rahatlatan kısa bir cümle yeterlidir.
- Kategori kartları çok büyük olmamalı; ilk sahnede fazla scroll hissi yaratmamalı.

### 2. Fotoğraf ve Ses

Amaç: Ustanın daha iyi teklif vermesi için ipucu toplamak.

İçerik:

- Kategoriye göre önerilen medya kartları.
- Fotoğraf, video veya ses opsiyoneldir.
- Medya sayısı görünür.
- Kısa not alanı burada yer alır.

Tasarım notu:

- "Kanıt" dili serttir; kullanıcıya sorgu hissi verir. UI copy'si "Usta için ipucu", "Fotoğraf veya ses ekle" gibi yumuşak olmalı.
- Not alanı fotoğraf/ses kartlarından sonra gelir; kullanıcı görseli ekleyip hatırladıktan sonra yazar.

### 3. Konum ve Zaman

Amaç: Servisin göreceği çalışma konumunu ve teklif tercihini toplamak.

İçerik:

- Tek LocationPicker.
- Yaklaşık konum, tam konum ve haritadan seçme seçenekleri.
- Küçük harita önizlemesi veya seçili konum özeti.
- Servis tercihleri LocationPicker içinde/yanında kompakt checkbox olarak görünür:
  - Yerinde tamir
  - Vale
- "Ben götürürüm" ayrı seçenek olarak gösterilmez; hiçbir tercih seçilmezse varsayılan budur.
- Zaman chip'leri: şimdi, bugün, yarın, hafta içi, esnek.
- Teklif önceliği chip'leri: fark etmez, yakın olsun, ucuz olsun, hızlı olsun.

Tasarım notu:

- Yerinde tamir ve vale aynı anda seçilebilir.
- İkisi de kısa açıklamalı, küçük tikli tercih olarak görünür.
- Konum bloğu ekranda küçücük kalmamalı; harita/konum önizlemesi ana içerik gibi hissedilmeli.

### 4. Önizleme

Amaç: Kullanıcıya oluşacak vaka profilinin kısa, temiz bir ön gösterimini vermek.

İçerik:

- Vaka türü ve kategori.
- Seçilen semptom özeti.
- Konum, zaman, servis tercihi, teklif önceliği.
- Eklenen medya sayısı.
- Kısa not.
- Submit CTA: "Vakayı oluştur".

Tasarım notu:

- Önizleme yeni karar sormaz.
- "Çekici istiyorum", "Araç sürülebiliyor mu?" gibi kararlar burada panel olarak görünmez.
- Çekici, bakım/arıza içinde ayrı bir adım değil; gerekiyorsa vaka oluşumu sonrası veya son onay bağlamında ayrı yönlendirme olur.
- Önizleme vaka profiline benzemelidir: düzenli, okunur, kartlı ve sakin.

## 4. İçerik ve Copy Tonu

Kullanılacak ton:

- "Ne oluyor?"
- "Usta için ipucu"
- "Nerede ve ne zaman?"
- "Son kontrol"
- "Vakayı oluştur"

Kaçınılacak ton:

- "Kanıt yükle"
- "Teknik arıza raporu"
- "Sürülebilirlik beyanı"
- "Çekici gerekiyor mu?" ana arıza adımı içinde
- Uzun açıklama paragrafları

## 5. Aynı Problemleri Tekrar Yaşamamak İçin Kontrol Listesi

- Her sahne tek ana karar kümesi taşıyor mu?
- İlk sahne kategori + semptom dışında başka yük bindiriyor mu?
- Açıklama medya/ipucu sahnesinde mi?
- Konum sahnesinde harita/konum yeterince görünür mü?
- Yerinde tamir ve vale birlikte seçilebilir mi?
- "Ben götürürüm" UI'da ayrı seçenek değil, boş tercih default'u mu?
- Önizleme yeni karar sormadan yalnız özet mi gösteriyor?
- Çekici/sürülebiliyor mu kararları arıza composer içinde göz kanatan paneller olarak çıkmıyor mu?
- Kartlar dokunma alanı ve seçili state açısından net mi?
- Type payload backend sözleşmesine temiz gidiyor mu?

## 6. Kabul Kriterleri

- Android cihazda aşağı kaydırma sonrası tüm kart/input tıklamaları çalışır.
- Arıza akışı 4 sahnede tamamlanır: kategori+belirti, fotoğraf/ses+not, konum+zaman, önizleme.
- Kullanıcı ilk sahnede arızayı kolayca kategorize eder.
- Kısa not ikinci sahnede görünür.
- Konum sahnesi harita/konum önizlemesiyle anlaşılırdır.
- Önizleme sade vaka profili ön görünümü gibi durur.
- Submit sonrası backend typed alanlardan `case_service_tags` üretebilir.
