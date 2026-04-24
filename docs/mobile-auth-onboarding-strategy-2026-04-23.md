# Mobile Auth ve Onboarding Stratejisi

Tarih: 2026-04-23
Durum: analiz notu
Amaç: bir sonraki uygulama turunda customer ve service app için sade, güven veren, native-uyumlu auth + kayıt akışını tasarlarken referans almak.

## 1. Yönetici Özeti

Bu repo şu anda iki farklı doğrulama mantığını aynı OTP omurgasında taşıyor:

- Customer app: telefon + OTP doğrulama sonrası doğrudan içeri giriyor.
- Service app: telefon + OTP doğrulama sonrası aktif kullanıcı tabs'e, diğerleri pending/onboarding tarafına gidiyor.

Ana karar önerisi:

1. Customer tarafında `tek giriş ekranı` korunmalı.
   Yeni kullanıcı için OTP sonrası kısa bir profil tamamlama adımı açılmalı.
2. Service tarafında `giriş` ve `başvuru` niyeti görsel olarak ayrılmalı ama teknik olarak aynı telefon + OTP tabanı kullanılabilir.
3. Her iki uygulamada da `çıkış yapana kadar oturum açık` mantığı korunmalı.
   Bu repo zaten buna yakın.
4. SMS OTP başlangıç için kabul edilebilir, ama orta vadede passkey / device-bound auth yol haritası eklenmeli.

## 2. Koddan Çıkan Mevcut Durum

Detaylı repo içi durum analizi ayrı dokümana taşındı:

- [mobile-auth-current-state-2026-04-23.md](/home/alfonso/sanayi-app/docs/mobile-auth-current-state-2026-04-23.md)

Kısa özet:

- Customer app bugün tek telefon + OTP mantığında çalışıyor.
- Customer profil bilgisi hâlâ local/mock yüzeyde; gerçek profil persist katmanı eksik.
- Araç ekleme tarafı canlı ve yeni kullanıcı sonrası onboarding değeri için güçlü aday.
- Session kalıcılığı native tarafta mevcut; her açılışta tekrar login istemek gerekmiyor.
- Service app'te `new` ile `pending` ayrımı bugün net değil.
- Service onboarding işlevsel ama parçalı; service profil yüzeyi ise onboarding'den daha zengin.

## 3. Önerilen Customer Akışı

Hedef karakter:

- sosyal medya kadar kısa
- bankacılık kadar güvenli hissettiren
- mümkün olduğunca tek karar veren ekranlar

### 3.1 Önerilen akış

#### A. Giriş ekranı

Tek ekran:

- başlık: `Telefon numaran ile devam et`
- input: telefon
- CTA: `Devam et`
- alt not:
  - SMS ile doğrulama yapılacağı
  - KVKK / kullanım koşulları linki

Burada ayrı `Giriş yap` ve `Kayıt ol` butonu açmaya gerek yok.
Customer için en iyi deneyim `tek giriş kapısı`.

#### B. OTP ekranı

- 6 haneli kutucuklu tasarım
- otomatik fokus
- `Numarayı değiştir`
- `Tekrar kod gönder`
- iOS/Android auto-fill desteği

#### C. OTP sonrası karar

1. Returning user:
   - doğrudan home
2. Yeni user:
   - `Kişisel bilgilerini tamamla` ekranı

#### D. Yeni customer kısa profil ekranı

Zorunlu:

- ad soyad

İsteğe bağlı ama önerilen:

- e-posta

Bu ekranda istenmemesi gerekenler:

- adres
- doğum tarihi
- şehir
- uzun formlar

Gerekçe:

- Bu uygulamanın ilk değeri araç + vaka tarafında.
- Profili ağırlaştırmak ilk oturum terk oranını artırır.

#### E. Hemen sonrası: ilk araç nudge

En iyi desen:

- tam ekran değil, güçlü onboarding state
- başlık:
  `İlk aracını ekle`
- açıklama:
  `Teklif, bakım ve vaka akışı için önce aracını tanımlayalım.`
- CTA:
  `Araç ekle`
- secondary:
  `Şimdilik geç`

Ürün önerisi:

- `Şimdilik geç` olmalı.
- Ama araç eklenene kadar ana ekranda persistent kart/banner kalmalı.
- vaka açma ve bakım talebi başlatma zaten araç gerektirdiği için doğal gate orada kurulabilir.

Bu, kullanıcıyı kaotik biçimde bloklamadan güçlü yönlendirme sağlar.

### 3.2 Customer için zorunlu alan seti

İlk kayıt:

- telefon doğrulaması
- ad soyad

İlk değer üretimi:

- en az 1 araç

Sonraya bırakılabilir:

- e-posta
- bildirim tercihleri
- ödeme araçları
- detaylı profil

### 3.3 Customer teknik gereksinim

Bunu doğru yapmak için backend'de aşağıdakilerden biri gerekecek:

1. `POST /auth/otp/verify` response'una `is_new_user`, `profile_completed` gibi alanlar eklemek
2. veya verify sonrası çağrılan ayrı bir bootstrap endpoint'i üretmek
   örnek:
   - `GET /users/me/bootstrap`
   - response:
     - `is_new_user`
     - `profile_completed`
     - `vehicle_count`

Ek olarak customer profil endpoint'i gerekir:

- `GET /users/me/profile`
- `PATCH /users/me/profile`

Bugünkü repo durumunda customer personal info store'u local/mock olduğu için bu halka eksik.

## 4. Önerilen Service Akışı

Hedef karakter:

- resmi ve güven veren
- Yemeksepeti / marketplace merchant onboarding gibi
- kısa ama ciddiyetli
- “başvuru” ile “profil zenginleştirme” ayrı

### 4.1 Giriş ekranı

Tek yüzeyde iki niyet:

- tab 1: `Giriş Yap`
- tab 2: `Başvuru Oluştur`

Her iki tab da aynı telefon doğrulama altyapısını kullanabilir.

Fark verify sonrasında açılır.

### 4.2 Verify sonrası net durum makinesi

Service için önerilen state ayrımı:

1. `active_member`
   - doğrudan tabs
2. `pending_review`
   - pending status ekranı
3. `rejected_or_revision_needed`
   - eksik belge / düzeltme ekranı
4. `new_uninitialized`
   - ilk kayıt wizard'ı

Bugünkü sorun:

- `technician_profile` yok durumu `pending` ile karışıyor.

Öneri:

- verify sonrası backend bu state'i açık döndürmeli.
- UI fallback yorumla değil, açık state consume etmeli.

### 4.3 Service kayıt akışı önerisi

Bugünkü 8 adım mantıklı ama sadeleştirilmeli.

Önerilen kayıt v1:

1. Hizmet tipi
2. İşletme modeli ve temel kimlik
3. Hizmet alanı ve temel kapsam
4. Belgeler
5. Özet ve başvuru gönder

#### Adım 1: Hizmet tipi

Zorunlu:

- provider type
  - usta
  - çekici
  - lastik
  - kaporta_boya
  - oto_elektrik
  - vb.

Not:

- Bu adım korunmalı.
- Çünkü sonraki belge ve alan zorunluluklarını belirliyor.

#### Adım 2: İşletme modeli ve temel kimlik

Bugünkü `provider-mode` + `business` mantığı birleşebilir.

Zorunlu alan önerisi:

- işletme / bireysel seçim
- görünen işletme adı veya usta adı
- ticari ünvan
  - business modda zorunlu
- vergi no / TCKN-VKN mantığı
  - provider mode'a göre
- telefon
  - OTP'den gelir, read-only gösterilebilir
- e-posta
  - başvuru iletişimi için önerilir

Bu adımda istenmemesi gerekenler:

- uzun biyografi
- slogan
- galeri
- kampanya
- uzmanlık tag yağmuru

#### Adım 3: Hizmet alanı ve temel kapsam

Bugünkü `capabilities + service-area + coverage` üçlemesi sadeleştirilmeli.

Önerilen minimal set:

- atölye / operasyon lokasyonu
- hizmet yarıçapı
- ana hizmet alanı
- 3-8 arası temel işlem seçimi
- mobil servis / vale / çekici gibi ek capability toggle'ları

Öneri:

- `capabilities` ile `coverage` tek akışta toplanmalı.
- Accordion olabilir ama tek ekran hissi vermeli.

Bu adımda zorunlu:

- en az 1 service domain
- en az birkaç procedure
- en az 1 hizmet bölgesi

Sonraya kalabilecekler:

- tüm marka kapsamı detayları
- drivetrain kapsamının ince ayarı
- gelişmiş prosedür etiketleri

#### Adım 4: Belgeler

Bu adım service akışının güven omurgası.
Kesinlikle korunmalı.

Ama UX net olmalı:

- zorunlu belgeler üstte
- opsiyonel / seviye artıran belgeler altta
- her belge için:
  - neden istiyoruz
  - hangi format kabul
  - onay süresi
  - durum: yüklenmedi / bekliyor / onaylandı / düzeltme gerekli

Başvuru için zorunlu örnekler:

- kimlik
- vergi levhası veya uygun bireysel belge
- rol bazlı ruhsat / oda / operatör belgesi

Sonraya bırakılabilir:

- promo video
- galeri
- ek uzmanlık sertifikaları

#### Adım 5: Özet ve başvuru

Olması gereken:

- seçilen hizmet tipi
- işletme kimliği
- kapsama özeti
- belge durumu
- beklenen inceleme süresi
- tek CTA:
  `Başvuruyu gönder`

Başvuru sonrası:

- güçlü bir pending ekranı
- check-list görünümü
- gerekiyorsa `eksik belge yükle`
- `profili zenginleştir` secondary action

### 4.4 Service için zorunlu / opsiyonel ayrımı

#### Başvuru için zorunlu

- telefon doğrulama
- provider type
- provider mode
- görünen servis adı veya usta adı
- ticari kimlik alanları
- operasyon konumu
- temel hizmet kapsamı
- minimum belge seti
- sözleşme / KVKK / ticari onay kutuları

#### Onay sonrası ama ilk işler öncesi önerilen

- çalışma saatleri
- kapasite
- IBAN / ödeme bilgisi
- daha ayrıntılı marka kapsamı

#### Profil zenginleştirme için sonradan tamamlanabilir

- tagline
- biography
- galeri
- promo video
- ek uzmanlık etiketleri
- kampanyalar

Bu ayrım kritik:

- Başvuruyu ciddi tutar.
- Ama atölye onboarding'ini kaotik ve uzun hale getirmez.

## 5. UX İlkeleri

Her iki uygulama için ortak ilkeler:

1. Telefon doğrulama ana kimlik kapısı olabilir.
2. OTP sonrası gereksiz tekrar login istenmemeli.
3. Yeni kullanıcı ve geri dönen kullanıcı ayrımı server truth ile yapılmalı.
4. Formlar kısa tutulmalı.
5. Her adım tek karar vermeli.
6. Boş ekran yerine next-best-action gösterilmeli.

Customer için:

- hızlı
- akıcı
- neredeyse frictionless

Service için:

- resmi
- kontrollü
- belge ve onay sürecini görünür kılan
- ama yine de az adımlı

## 6. Platform ve Web Araştırması

Bu bölüm 2026-04-23 itibarıyla resmi Apple / Google / NIST kaynaklarına göre hazırlanmıştır.

### 6.1 Apple tarafı

#### 6.1.1 Sign in with Apple zorunluluğu ne zaman gelir

Apple App Review Guideline 4.8'e göre, uygulama üçüncü taraf veya sosyal login kullanıyorsa eşdeğer bir login seçeneği sunmalıdır.
Ancak uygulama yalnızca kendi hesabını ve kendi giriş sistemini kullanıyorsa bu zorunluluk yoktur.

Kaynak:

- Apple App Review Guidelines 4.8
  https://developer.apple.com/app-store/review/guidelines/

Pratik sonuç:

- Naro yalnızca telefon OTP / kendi hesap sistemiyle giderse bugün Sign in with Apple zorunlu değil.
- İleride Google login veya başka sosyal login eklenirse bu karar yeniden değerlendirilmelidir.

#### 6.1.2 Account deletion zorunluluğu

Apple, hesap oluşturmayı destekleyen uygulamalarda uygulama içinden hesap silme başlatılabilmesini istiyor.

Kaynak:

- Apple Support:
  https://developer.apple.com/support/offering-account-deletion-in-your-app/

Önemli çıkarım:

- Naro OTP verify sırasında kullanıcıyı otomatik oluşturduğu için, customer ve
  service uygulamalarını bugünden `account creation supported` kapsamındaymış
  gibi ele almak daha güvenli.
- Bu yüzden hesap silme akışı ileri tarihli bir nice-to-have değil, auth
  mimarisinin planlı bir parçası olmalı.

#### 6.1.3 OTP UX ve SMS AutoFill

Apple, tek kullanımlık kod alanlarında `oneTimeCode` içerik tipini ve domain-bound SMS formatını öneriyor.

Kaynaklar:

- One-time codes:
  https://developer.apple.com/documentation/security/one-time-codes
- Domain-bound SMS codes:
  https://developer.apple.com/documentation/security/enabling-autofill-for-domain-bound-sms-codes

Pratik sonuç:

- iOS OTP ekranında auto-fill desteklenmeli.
- SMS formatı domain-bound hale getirilirse phishing direnci ve UX iyileşir.
- Bunun için associated domains kurulumuna ihtiyaç var.

#### 6.1.4 Passkeys

Apple passkeys tarafını güçlü biçimde öne çıkarıyor.
Passkeys phishing-resistant ve app/site domain'i ile bağlı çalışıyor.

Kaynaklar:

- Passkeys overview:
  https://developer.apple.com/passkeys/
- Supporting passkeys:
  https://developer.apple.com/documentation/authenticationservices/supporting-passkeys
- Associated domains:
  https://developer.apple.com/documentation/xcode/supporting-associated-domains

Pratik sonuç:

- Kısa vadede SMS OTP korunabilir.
- Orta vadede customer için passkey eklemek mantıklı yol haritasıdır.
- Özellikle yüksek frekanslı returning login veya yeni cihaz aktivasyonunda değerli olabilir.

### 6.2 Android tarafı

#### 6.2.1 Credential Manager güncel yön

Android Developers, Credential Manager'ı Android uygulamalarında credential exchange için önerilen Jetpack API olarak tanımlıyor.

Kaynak:

- Credential Manager:
  https://developer.android.com/identity/credential-manager

Önemli özellikler:

- passkeys
- passwords
- federated sign-in
- WebView compatibility
- autofill integration
- new-device restore

Pratik sonuç:

- Android tarafında geleceğe dönük auth mimarisi Credential Manager uyumlu düşünülmeli.
- OTP ile başlasak bile ileride passkey eklemek için mimariyi kapatmamalıyız.

#### 6.2.2 Android 15 single-tap passkey iyileştirmesi

Android 15 ile Credential Manager tek dokunuş passkey create/sign-in akışı ve biometric prompt entegrasyonunu destekliyor.

Kaynak:

- Single-tap passkey with biometric prompts:
  https://developer.android.com/identity/sign-in/single-tap-biometric?hl=en

Pratik sonuç:

- Bu bugün zorunlu değil.
- Ama orta vadede Android login'i ciddi biçimde sadeleştirme potansiyeli taşıyor.

#### 6.2.3 SMS Retriever

Android resmi dökümanı, telefon doğrulama için SMS Retriever API kullanımını anlatıyor.

Kaynak:

- SMS Retriever:
  https://developer.android.com/identity/sms-retriever?hl=en

Pratik sonuç:

- Android OTP deneyimi için auto-read / auto-fill kalitesi artırılabilir.
- Özellikle customer app'te first-run friction azaltır.

#### 6.2.4 Account deletion politikası

Google Play, uygulama içinde hesap oluşturuluyorsa:

- uygulama içinde hesap silme yolu
- ayrıca web üzerinden hesap silme talep linki

istiyor.

Kaynak:

- Google Play account deletion requirements:
  https://support.google.com/googleplay/android-developer/answer/13327111?hl=en-EN

Pratik sonuç:

- Gerçek register akışı devreye girerse bu politikayı baştan tasarlamak gerekir.

#### 6.2.5 Restore Credentials

Android Credential Manager son dönemde yeni cihaza geçişte hesap restore / otomatik tekrar sign-in akışını da öne çıkarıyor.

Kaynak:

- About Restore Credentials:
  https://developer.android.com/identity/sign-in/restore-credentials?hl=en

Pratik sonuç:

- Özellikle service kullanıcılarında cihaz değiştirme sonrası tekrar onboarding yaşatmamak için ileride değerlidir.

### 6.3 Güvenlik notu: SMS OTP'nin sınırı

NIST SP 800-63B, PSTN tabanlı out-of-band doğrulamayı kısıtlı bir authenticator sınıfı olarak ele alıyor ve phishing-resistant saymıyor.

Kaynak:

- NIST SP 800-63B:
  https://pages.nist.gov/800-63-4/sp800-63b.html

Pratik sonuç:

- SMS OTP kullanılabilir.
- Ama kalıcı hedef yalnızca SMS OTP olmamalı.
- Yol haritası:
  - kısa vade: OTP + secure session
  - orta vade: passkey / stronger device-bound auth

## 7. Ürün Kararları

### 7.1 Customer

Karar önerisi:

- ayrı register ekranı açma
- tek telefon giriş kapısı kullan
- yeni user ise kısa profil step'i aç
- ardından araç eklemeye güçlü yönlendir
- returning user'ı doğrudan içeri al

### 7.2 Service

Karar önerisi:

- login ve başvuru niyetini görsel olarak ayır
- ama teknik olarak ortak OTP kullan
- `new / pending / active / revision-needed` durumlarını backend truth olarak ayır
- başvuru akışını 5 civarı adımda sadeleştir
- biyografi, galeri, promo gibi alanları başvuru öncesi değil profil tamamlama aşamasına bırak

### 7.3 Session

Karar önerisi:

- çıkış yapana kadar oturum açık
- ilk açılışta silent restore
- token fail olursa temiz auth fallback
- istenirse daha sonra `uygulama kilidi` olarak biyometrik quick unlock eklenebilir

Bu, yeniden login ile aynı şey değildir.
Quick unlock bir local privacy katmanıdır; auth katmanını gereksiz yere yormaz.

## 8. Uygulama Öncesi Teknik Backlog

### 8.1 Customer için

- `is_new_user` veya bootstrap state alanı
- customer profile API
- profile completed alanı
- vehicle count bootstrap alanı
- OTP ekranında auto-fill iyileştirmesi

### 8.2 Service için

- `technician_profile_missing` ile `pending_review` ayrımı
- yeni servis için bootstrap/create endpoint
- onboarding adımlarının sadeleştirilmiş bilgi mimarisi
- belge checklist durum modeli
- revision needed state

### 8.3 Platform iyileştirmeleri

- iOS domain-bound SMS
- Android SMS Retriever
- passkey yol haritası
- in-app account deletion backlog

## 9. Sonuç

En doğru yön:

- Customer için ultra sade auth + kısa profil + araça yönlendirme
- Service için kısa ama resmi başvuru akışı + belge omurgası
- Her iki uygulamada da kalıcı session
- SMS OTP'yi başlangıç çözümü olarak kullanıp passkey-ready mimari kurmak

Bir sonraki üretim turunda bu nottan doğrudan şu işler çıkarılabilir:

1. Customer auth shell redesign
2. Customer new-user profile completion flow
3. Customer first-vehicle prompt
4. Service auth state machine redesign
5. Service onboarding information architecture simplification
6. Auth/bootstrap backend contract revizyonu

## Ek A. Kritik Notlar ve Unutulmaması Gerekenler

Bu bölüm ürün tasarımından ayrı düşünülmeli.
Amaç, auth ve onboarding tarafında sonradan "bunu atlamışız" denecek
store-policy, güvenlik ve operasyon maddelerini tek yerde tutmak.

### A.1 En kritik yorum: "Ayrı register yok" sizi kurtarmayabilir

Naro backend bugün OTP verify sırasında kullanıcı yoksa otomatik kullanıcı
oluşturuyor:

- [naro-backend/app/api/v1/routes/auth.py](/home/alfonso/sanayi-app/naro-backend/app/api/v1/routes/auth.py)

Bu nedenle şu yorumu çalışma varsayımı olarak almak daha güvenli:

- Customer app hesap oluşturuyor.
- Service app hesap oluşturuyor.
- Yani iki uygulama da `account creation supported` kapsamına giriyormuş gibi
  tasarlanmalı.

Bu bir çıkarımdır; store ekiplerinin bakış açısından en güvenli yorum budur.
Özellikle:

- Apple account deletion kuralı
- Google Play account deletion + web deletion resource kuralı

bunlara bugünden hazır olmak gerekir.

### A.2 Store policy blokajları

#### 1. Hesap oluşturuyorsan hesap silme zorunluluğu düşün

Apple:

- App içinde hesap silme başlatılabilmeli.
- Sadece `deactivate`, `freeze`, `disable` yeterli sayılmaz.
- Hesapla ilişkili kişisel veri de silinmeli.
- Hesap silme zor bulunmamalı; ideal yer hesap ayarları.

Google Play:

- App içinde silme akışı veya silme başlatma yolu gerekli.
- Ayrıca web üzerinde çalışan bir deletion resource da gerekli.
- Play Console Data safety / Data deletion cevapları da buna göre doldurulmalı.

Naro için sonuç:

- Customer ve service app içinde `Hesabı Sil` akışı backlog değil, temel auth
  mimarisinin parçası olarak düşünülmeli.

#### 2. Social login eklersen Apple kuralı değişir

Bugün yalnızca şirketin kendi OTP / kendi auth sistemi varsa, Sign in with
Apple zorunlu değil.

Ama ileride şunlardan biri eklenirse:

- Google login
- Facebook login
- LinkedIn login
- benzeri bir third-party primary login

o zaman Apple'ın 4.8 kuralı devreye girer ve eşdeğer, privacy-preserving bir
alternatif login gerekir.

Naro için sonuç:

- "Şimdilik OTP ile gidiyoruz" kararı doğru.
- Ama gelecekte sosyal login eklenirse auth mimarisi yeniden gözden geçirilmeli.

#### 3. Gereksiz login gate Apple review riski yaratabilir

Apple, uygulamanın önemli account-based özellikleri yoksa login zorunlu
yapılmamasını bekliyor.

Naro için yorum:

- Case, araç, teklif, ödeme, servis başvurusu gibi çekirdek akışlar için login
  mantıklı.
- Ama public içerikler varsa, örneğin müşteri tarafında çarşı, servis önizleme,
  yorumların bir kısmı, ileride login'siz erişim düşünülebilir.

Bu zorunlu değil; ama iOS review açısından iyi bir ürün kararı olabilir.

#### 4. Review hesabı ve test erişimi unutulursa build reddedilebilir

Apple:

- Login varsa demo account veya tam işlevli demo mode beklenir.
- Review notlarında gerekli hesaplar ve açıklamalar verilmelidir.

Google Play:

- App access instructions zorunlu olabilir.
- OTP / 2FA akışı varsa reviewer için tekrar kullanılabilir, süre aşımı
  olmayan erişim sağlanmalı.
- Gerekiyorsa OTP bypass veya review-only demo hesabı sunulmalı.

Naro için sonuç:

- İki ayrı app için ayrı review planı şart.
- Customer review hesabı
- Service review hesabı
- Gerekirse farklı service stateleri için ek hesaplar:
  - `new_uninitialized`
  - `pending_review`
  - `active_member`
  - `revision_needed`

#### 5. Privacy policy ve store disclosure auth akışının parçasıdır

Apple:

- Privacy policy hem App Store Connect metadata alanında hem app içinde
  erişilebilir olmalı.
- App Privacy Details doğru doldurulmalı.

Google Play:

- Privacy policy Play Console'da ve app içinde olmalı.
- Data Safety form doğru doldurulmalı.
- Data deletion / retention pratiği de policy'de görünmeli.

Naro için sonuç:

- Telefon numarası
- ad soyad
- e-posta
- auth bilgisi
- device/session bilgisi
- location
- media
- payment-related data

hangi app hangi veriyi topluyorsa, customer ve service ayrı ayrı doğru
declare edilmeli.

#### 6. Third-party SDK auth/policy yükünü sizden almaz

Apple ve Google Play ikisi de kabaca aynı şeyi söylüyor:

- Uygulamaya eklediğiniz üçüncü taraf SDK'lar da sizin sorumluluğunuzda.

Naro için sonuç:

- auth SDK
- analytics SDK
- crash SDK
- session / attribution SDK

eklenirse privacy disclosure, data safety ve consent tarafı yeniden
değerlendirilmeli.

### A.3 OTP ve permission tuzakları

#### 1. SMS okumak için izin istemeyin

Google Play SMS / Call Log izinlerini ciddi biçimde kısıtlıyor.
OTP için doğru yol:

- Android: SMS Retriever API
- iOS: one-time-code AutoFill ve domain-bound SMS

Naro için sonuç:

- `READ_SMS`, `RECEIVE_SMS` gibi izinlere girmemek en doğru yol.
- OTP UX'i iyileştirirken permission değil auto-fill altyapısı kullanılmalı.

#### 2. OTP doğrulamasını client'ta finalize etmeyin

Android resmi dokümanı OTP'nin sunucuda doğrulanmasını öneriyor.

Naro için sonuç:

- Kod doğrulama server truth olmalı.
- Client sadece challenge yönetmeli.

Bu repo zaten bu yöne yakın.

#### 3. OTP ekranı native olarak işaretlenmeli

iOS tarafında ilgili alanın `oneTimeCode` içerik tipiyle işaretlenmesi,
Android tarafında da auto-fill / SMS Retriever akışının desteklenmesi gerekir.

Naro için sonuç:

- OTP UX tasarımı yalnız görsel iş değildir.
- Alan özellikleri ve SMS formatı da tasarımın parçasıdır.

#### 4. Permission prompt'ları login ekranına yığmayın

Apple ve Google Play tarafında ortak iyi pratik:

- hassas izinleri iş bağlamında iste
- gereksiz erişimi başta isteme

Naro için özel not:

- location
- camera / photo
- notifications

login veya ilk açılış ekranında istemek yerine:

- location: adres/servis alanı seçerken
- camera/photo: belge veya medya yüklerken
- push: vaka ve teklif bildirim değerini anlattıktan sonra

istenmeli.

#### 5. Kullanıcı reddederse alternatif ver

Apple bunu özellikle vurguluyor.

Naro örnekleri:

- konum izni yoksa manuel adres girişi
- fotoğraf yoksa belge yükleme başka picker ile
- push kapalıysa bildirim merkezini in-app göstermek

### A.4 Session ve güvenlik checklist'i

Bu maddeler store policy değil; ama auth kalitesini belirleyen teknik
zorunluluklardır.

#### 1. Session restore sessiz çalışmalı

Repo bugün native tarafta `expo-secure-store` ile buna uygun.
Bu karar korunmalı:

- app açıldı
- session hydrate oldu
- token geçerliyse kullanıcı içeride

Her açılışta login istemek UX ve retention zararıdır.

#### 2. Access token ve refresh token davranışı ayrılmalı

Gerekenler:

- access token kısa ömürlü
- refresh token rotate edilmeli
- refresh fail ise temiz logout fallback
- concurrent refresh race engellenmeli

Bu repo bunun bir kısmını zaten uyguluyor.

#### 3. Logout ile account deletion ayrılmalı

İki farklı eylem:

- `Çıkış Yap`: local session temizliği + gerekiyorsa current session revoke
- `Hesabı Sil`: kalıcı kullanıcı silme süreci + session revoke + retention policy

Tek butonda çözülmemeli.

#### 4. Account deletion anında session revoke unutulmasın

Hesap silme tasarlanırken şu maddeler de kapanmalı:

- aktif refresh tokenlar revoke
- tüm cihaz oturumları sonlandır
- service app'te pending/onboarding state temizle
- customer app'te araç/vaka/media retention kararı net olsun

#### 5. Subscription / ödeme varsa deletion copy dikkat ister

Apple açıkça söylüyor:

- kullanıcıya faturalama ve iptal etkisi anlatılmalı

Naro için sonuç:

- ileride abonelik veya üyelik benzeri bir model gelirse hesap silme ekranında
  bunun copy'si ve akış bağlantısı net olmalı.

#### 6. Guest / yarım hesaplar için de silme ve cleanup kuralı belirleyin

Bu Naro için özel olarak önemli.

Çünkü bugün:

- OTP verify ile user oluşabilir
- ama onboarding / profil / araç tamamlanmayabilir

Bu durumda şu kararlar net olmalı:

- `uninitialized` hesap kaç gün tutulur?
- hiç tamamlanmamış hesaplar otomatik silinir mi?
- kullanıcı dönerse kaldığı yerden mi devam eder?

Bu bir veri yaşam döngüsü kararıdır; auth tasarımından ayrı düşünülmemeli.

### A.5 Customer app için unutulmaması gerekenler

#### 1. "Yeni kullanıcı" tespiti backend truth olmalı

Frontend yalnızca tahmin etmemeli.

Gereken alanlardan biri:

- `is_new_user`
- `profile_completed`
- `vehicle_count`

#### 2. Kısa profil adımı customer tarafında data persist ister

Bugün customer profile store'u local/mock.

Bu yüzden OTP sonrası:

- ad soyad
- e-posta

toplanacaksa canlı profile endpoint'i gerekir.

#### 3. İlk araç nudge kalıcı olmalı

Araç eklemeyi sert blok yapmadan:

- home banner
- empty state
- vaka açarken doğal gate

kombinasyonu daha sağlıklı.

#### 4. Hesap silmede müşteri verisi kapsamı açık yazılmalı

Silme kapsamı için şimdiden karar verilmeli:

- profil
- session
- araçlar
- araç geçmiş onayı
- açık vakalar
- tamamlanmış vaka kayıtları
- belgeler / medya

Hangisi silinir, hangisi retention nedeniyle kalır açıkça yazılmalı.

### A.6 Service app için unutulmaması gerekenler

#### 1. `pending` ile `new` aynı şey değil

Service tarafında bugünkü en önemli mimari ayrım:

- `technician_profile_missing`
- `pending_review`

aynı UX'e düşmemeli.

Önerilen state'ler:

- `new_uninitialized`
- `draft_in_progress`
- `pending_review`
- `revision_needed`
- `active_member`
- `suspended`

#### 2. Başvuruda sadece zorunlu veri istenmeli

İlk başvuruda istenmesi gerekenler:

- hizmet tipi
- işletme / bireysel modu
- temel kimlik ve ticari bilgi
- operasyon konumu
- temel kapsam
- zorunlu belgeler

İlk başvuruda istenmemesi gerekenler:

- uzun biyografi
- galeri
- promo video
- pazarlama içeriği
- çok ayrıntılı tag yapıları

#### 3. Revision-needed state şart

Gerçek onboarding'de en sık unutulan şeylerden biri budur.

Sadece:

- active
- pending

yeterli değildir.

Belge reddi, eksik alan, vergi uyuşmazlığı gibi durumlar için:

- gerekçeli durum ekranı
- hangi adım eksik
- hangi belge yeniden isteniyor
- tek CTA ile düzeltme

olmalı.

#### 4. Service hesabı mutlaka legal-operational owner ile ilişkilendirilmeli

Özellikle service uygulaması zamanla şu alanlara değebilir:

- payout
- invoice
- sigorta dosyası
- çekici operasyonu

Apple'ın highly regulated / sensitive service yaklaşımı burada önemlidir.

Ürün kararı:

- Service app store sahibi ve tüzel kimlik yapısı baştan temiz olmalı.
- Özellikle gerçek payout veya sigorta modülü büyürse bireysel geliştirici
  hesabı yaklaşımı risklidir.

#### 5. Başvuru silme ve account silme ayrımı gerekli olabilir

Service için iki ayrı davranış olabilir:

- başvuru henüz onaylanmadıysa `başvurumu geri çek`
- aktif üyeyse `hesabımı sil`

Bu ayrım UI'da net olmalı.

### A.7 Release ve review operasyon checklist'i

Her release öncesi auth özelinde bu maddeler kontrol edilmeli:

1. Review hesapları güncel mi?
2. Customer ve service için ayrı test hesapları hazır mı?
3. OTP review bypass veya reusable access planı var mı?
4. Backend review sırasında açık mı?
5. Privacy policy store'da ve app içinde güncel mi?
6. Account deletion yolu çalışıyor mu?
7. Data Safety / App Privacy cevapları son SDK değişikliklerine göre güncel mi?
8. Login gerektiren tüm roller için reviewer notu yazıldı mı?
9. Push/location/camera gibi izinler login ekranında erken patlamıyor mu?
10. Logout ve deletion akışları birbirine karışmıyor mu?
11. Session restore cold start'ta çalışıyor mu?
12. Token refresh fail olduğunda kullanıcı temiz auth ekranına dönüyor mu?
13. Service app yeni kullanıcıyı pending yerine onboarding draft'a götürüyor mu?
14. Service app belge reddi state'ini gösterebiliyor mu?

### A.8 Passkey ve geleceğe hazırlık

Bugün OTP ile başlamak mantıklı.
Ama tasarım passkey'ye kapanmamalı.

Hazırlık maddeleri:

- iOS için associated domains
- Android için Digital Asset Links
- sign-in domain standardizasyonu
- server tarafında passkey-ready relying party mimarisi

Bu adımlar hemen uygulanmak zorunda değil.
Ama auth contract'ı tasarlanırken bunları imkansız hale getirmemek gerekir.

## 10. Kaynakça

Apple:

- App Review Guidelines
  https://developer.apple.com/app-store/review/guidelines/
- Offering account deletion in your app
  https://developer.apple.com/support/offering-account-deletion-in-your-app/
- App Store review information / demo account
  https://developer.apple.com/help/app-store-connect/reference/app-review-information
- App privacy details
  https://developer.apple.com/app-store/app-privacy-details/
- Supporting passkeys
  https://developer.apple.com/documentation/authenticationservices/supporting-passkeys
- Supporting associated domains
  https://developer.apple.com/documentation/Xcode/supporting-associated-domains
- Domain-bound SMS codes
  https://developer.apple.com/documentation/security/enabling-autofill-for-domain-bound-sms-codes
- Password / one-time-code AutoFill
  https://developer.apple.com/documentation/security/enabling-password-autofill-on-a-text-input-view

Google / Android:

- Credential Manager
  https://developer.android.com/identity/credential-manager
- Credential Manager prerequisites / Digital Asset Links
  https://developer.android.com/identity/credential-manager/prerequisites
- SMS Retriever API
  https://developer.android.com/identity/sms-retriever
- Google Play app account deletion requirements
  https://support.google.com/googleplay/android-developer/answer/13327111
- Google Play login credentials for app access
  https://support.google.com/googleplay/android-developer/answer/15748846
- Google Play user data policy
  https://support.google.com/googleplay/android-developer/answer/10144311
- Google Play sensitive permissions policy
  https://support.google.com/googleplay/android-developer/answer/16558241
- Google Play SMS / Call Log permissions
  https://support.google.com/googleplay/android-developer/answer/10208820
- Google Play Data Safety
  https://support.google.com/googleplay/android-developer/answer/10787469

Güvenlik standardı:

- NIST SP 800-63B
  https://pages.nist.gov/800-63-4/sp800-63b.html
