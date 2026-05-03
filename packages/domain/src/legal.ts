/**
 * Hukuki metin sabitleri — Naro müşteri ve servis app'lerinde paylaşılır.
 *
 * **Bu metinler taslaktır**: yasal denetimden geçmemiş bir KVKK aydınlatma
 * metni ve Kullanım Koşulları taslağıdır. Yayın öncesi avukat onayı şart.
 * Güncelleme bu dosyadan yapılır; UI metni doğrudan tüketir, başka kopya yok.
 *
 * Versiyonlama: kapsam değiştiğinde `KVKK_VERSION` ve `TERMS_VERSION` artırın
 * — bu sayede `users.kvkk_consented_at` timestamp'i ile birlikte hangi
 * versiyonun kabul edildiği audit'ten çıkarılabilir (V1.1: ayrı `user_consents`
 * tablosu version alanı ile).
 */

export const KVKK_VERSION = "2026-05-03";

export const TERMS_VERSION = "2026-05-03";

export const LEGAL_CONTACT_EMAIL = "kvkk@naro.com.tr";

export const KVKK_NOTICE_TR = `# KVKK Aydınlatma Metni

Versiyon: ${KVKK_VERSION}

Naro olarak ("Şirket", "biz") 6698 sayılı Kişisel Verilerin Korunması Kanunu
("KVKK") kapsamında veri sorumlusu sıfatıyla aşağıdaki bilgileri sizinle
paylaşırız.

## 1. İşlenen Kişisel Veriler

Naro mobil uygulamasını kullanırken aşağıdaki kategorilerde kişisel
verileriniz işlenir:

- Kimlik: ad, soyad
- İletişim: telefon numarası (zorunlu), e-posta (opsiyonel)
- Araç: plaka, marka, model, yıl, kilometre, hasar/bakım fotoğrafları
- Konum: acil çekici çağrısında ve hizmet sağlayıcı eşleştirmesinde anlık
  konum verisi (yalnızca işlem süresince işlenir, geçmiş seyahat kaydı tutulmaz)
- Ödeme: kart bilgileri Naro tarafından saklanmaz; ödeme altyapısı sağlayıcısı
  Iyzico'da PCI-DSS uyumlu olarak işlenir, Naro yalnızca işlem referansını alır
- İşlem: vaka kayıtları, hizmet sağlayıcı ile yazışmalar, faturalar, onaylar

## 2. Kişisel Verilerin İşlenme Amaçları

- Vaka açma, hizmet sağlayıcı eşleştirme ve takip
- Ödeme süreçlerinin yürütülmesi (escrow + komisyon)
- Müşteri ve servis sağlayıcı arasında iletişim sağlanması
- Yasal yükümlülüklerin yerine getirilmesi (vergi, ticari sicil)
- Hizmet kalitesinin iyileştirilmesi (anonim toplu analiz)
- Dolandırıcılık ve kötüye kullanımın önlenmesi

## 3. Kişisel Verilerin Aktarıldığı Taraflar

- SMS sağlayıcısı (OTP doğrulama için telefon numaranız)
- Ödeme altyapısı sağlayıcısı: Iyzico Ödeme Hizmetleri A.Ş. (PCI-DSS)
- Hata izleme: Sentry (anonim hata izleri, PII maskelenir)
- Bulut altyapı sağlayıcısı (veriler Türkiye veya AB sınırları içinde tutulur)
- İlgili hizmet sağlayıcı (yalnızca eşleşmiş vakanız için, sadece gerekli alanlar)
- Yetkili kamu kurumları (yasal talep halinde)

## 4. Verilerin Saklama Süresi

- Hesap aktif olduğu sürece veriler işlenir
- Hesap silme talebinde 30 gün geri alma süresi tanınır
- 30 gün sonunda kişisel veriler kalıcı olarak silinir veya anonim hale getirilir
- Yasal saklama yükümlülüğü gerektiren ticari/vergi kayıtları (ör. fatura)
  yasal süre boyunca (genel olarak 10 yıl) saklanır

## 5. Haklarınız (KVKK Madde 11)

Veri sorumlusuna başvurarak aşağıdaki haklarınızı kullanabilirsiniz:

- Verilerinizin işlenip işlenmediğini öğrenme
- İşlendiyse, ne amaçla işlendiğini öğrenme
- Verilerin yurt içi/yurt dışı aktarıldığı kişileri öğrenme
- Eksik veya yanlış işlenmiş verilerin düzeltilmesini isteme
- Silinme veya yok edilme talebinde bulunma (uygulama içi 'Hesabımı sil')
- Düzeltme veya silme işleminin aktarıldığı taraflara bildirilmesini isteme
- İşleme sonucu aleyhinize bir karar oluşmuşsa itiraz etme
- Zararın giderilmesini talep etme

## 6. Başvuru ve İletişim

KVKK kapsamında haklarınızı kullanmak için: **${LEGAL_CONTACT_EMAIL}**

Başvurunuz mevzuatta öngörülen süre içinde (en geç 30 gün) yanıtlanır.
Talebiniz reddedilirse veya yetersiz bulursanız, Kişisel Verileri Koruma
Kuruluna şikayet hakkınız saklıdır.

---

Devam ederek bu aydınlatma metnini okuduğunuzu ve bilgilendirildiğinizi
beyan etmiş olursunuz.
`;

export const TERMS_NOTICE_TR = `# Kullanım Koşulları

Versiyon: ${TERMS_VERSION}

Naro mobil uygulamasını ("Uygulama") kullanmaya başladığınızda, aşağıdaki
şartları kabul etmiş sayılırsınız.

## 1. Hizmet Tanımı

Naro, araç sahibi kullanıcıları (müşteri) ile hizmet sağlayıcıları (atölye
ustası, çekici operatörü, oto parçacı, bakım servisi) eşleştiren bir
platformdur. Naro doğrudan onarım/bakım hizmeti sunmaz; tarafları bir araya
getirir, ödeme escrow'u ile güveni sağlar.

## 2. Hesap

- Naro hesabı için 18 yaş ve üzeri olmanız gerekir
- Hesap bilgilerinizin doğruluğundan ve gizliliğinden siz sorumlusunuz
- Hesabınızı başkasına devredemez, başkası adına oluşturamazsınız
- OTP kodlarını üçüncü kişilerle paylaşmayın

## 3. Ödemeler

- Müşteri tarafından yapılan ödemeler Naro escrow'unda tutulur
- İş tamamlandığında müşteri onayıyla hizmet sağlayıcıya aktarılır
- Naro işlem başına yüzde bazlı komisyon alır (her vaka oluşturma sırasında
  açıkça gösterilir)
- İade durumları KVKK ve TKHK kapsamında yasal süreler içinde değerlendirilir

## 4. Sorumluluk Sınırları

- Hizmetin fiziksel kalitesinden hizmet sağlayıcı sorumludur
- Naro platform aracısı sıfatıyla taraflar arası uyuşmazlıkları çözmek için
  iyi niyetli arabulucu rolü üstlenir
- Force majeure (deprem, savaş, hukuki zorunluluk) durumlarında Naro
  sorumlu tutulamaz

## 5. Yasaklı Davranışlar

Aşağıdakiler yasaktır ve hesap askıya alınması ile sonuçlanır:

- Sahte hesap oluşturma, kimlik bilgilerini gizleme
- Platform dışında ödeme talebi/teklifi (disintermediation)
- Diğer kullanıcılara taciz, hakaret, tehdit
- Sahte fatura/tahsilat denemesi
- Fikri mülkiyet ihlali, telif hakkı kopyalama
- Otomatik araç/bot kullanımı (özel API izni dışında)

## 6. Fesih

- Hesabınızı istediğiniz zaman 'Hesabımı sil' aksiyonuyla kapatabilirsiniz
- Naro, kullanım koşullarını ihlal eden hesapları askıya alma veya kapatma
  hakkını saklı tutar
- Açık vakalar mevcut ödeme/iş yükümlülükleri tamamlanana kadar süreçte kalır

## 7. Değişiklikler

Bu koşullar zaman zaman güncellenebilir. Önemli değişiklikler uygulama
içinde bildirilir; bildirim sonrası kullanmaya devam etmek güncel koşulları
kabul anlamına gelir.

## 8. Uygulanacak Hukuk

Bu koşullara Türkiye Cumhuriyeti hukuku uygulanır. Uyuşmazlıklarda İstanbul
Mahkemeleri ve İcra Daireleri yetkilidir.

## 9. İletişim

Sorular ve bildirimler için: **${LEGAL_CONTACT_EMAIL}**

---

Devam ederek bu kullanım koşullarını okuduğunuzu ve kabul ettiğinizi
beyan etmiş olursunuz.
`;

export type LegalDocumentKind = "kvkk" | "terms";

export const LEGAL_DOCUMENT_TITLES: Record<LegalDocumentKind, string> = {
  kvkk: "KVKK Aydınlatma Metni",
  terms: "Kullanım Koşulları",
};

export const LEGAL_DOCUMENT_BODIES: Record<LegalDocumentKind, string> = {
  kvkk: KVKK_NOTICE_TR,
  terms: TERMS_NOTICE_TR,
};

export const LEGAL_DOCUMENT_VERSIONS: Record<LegalDocumentKind, string> = {
  kvkk: KVKK_VERSION,
  terms: TERMS_VERSION,
};
