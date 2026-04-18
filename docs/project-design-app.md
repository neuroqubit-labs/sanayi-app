Aşağıdaki çerçeve, uygulamayı iki ayrı problemi tek sistem içinde çözen bir yapı olarak kurar: birinci katman araç sahibinin kendi aracını, bakım geçmişini, hasar kayıtlarını, faturalarını ve kişisel notlarını yönettiği araç işletim katmanıdır; ikinci katman ise ihtiyaç anında hasar veya bakım talebinin oluşturulup uygun ustalarla eşleştirildiği eşleşme katmanıdır. Uygulamanın tamamı Tinder vari değildir; Tinder benzeri mantık yalnızca seçim ve eşleşme ekranında çalışır. Geri kalan alanlar klasik, güven veren, kayıt tutan, temiz ve görev odaklı bir mobil ürün mantığıyla ilerler. Alt navigasyonda beş buton bulunur: solda Ana Sayfa, onun yanında Kayıtlar, ortada oval ve açılır bir hızlı eylem butonu, onun sağında Ustalar, en sağda Profil/Ayarlar. Araç bağımlı tüm sayfalarda en üstte aktif araç barı bulunur; burada plaka büyük, marka-model daha küçük yazılır ve çoklu araç kullanılıyorsa bu alan aynı zamanda bağlam seçicidir. Profil ve ayarlar ekranı araç bağımsızdır; bu yüzden üst araç barı burada görünmez.

Global bileşen: Aktif Araç Üst Barı

Bu alan araçla çalışan tüm sayfalarda sabit bir bağlam taşıyıcısıdır. Sol tarafta aktif aracın plakası, hemen altında küçük puntoda marka-model bilgisi yer alır. Sağ tarafta aşağı ok veya yatay geçiş işareti bulunur. Kullanıcı bu alana dokunduğunda araç değiştirici alt panel açılır. Panel içinde kayıtlı araçlar kart yapısında listelenir; plaka, marka-model, kısa durum etiketi ve varsa açık talep göstergesi görünür. Kullanıcı başka bir araca geçtiğinde uygulamanın ilgili tüm içerikleri o araç bağlamına göre yeniden yüklenir. Bu alan yalnızca araç bağımlı ekranlarda görünür; profil, ayarlar, destek ve hesap ekranlarında yer almaz.

1. Açılış, kayıt ve giriş akışı

İlk açılış ekranı sade bir karşılama ekranıdır. Uygulamanın vaadi çok net verilir: aracını kaydet, hasar veya bakım talebi oluştur, uygun ustalarla eşleş, tüm süreci kayıtta tut. Devamında kullanıcı telefon numarası, e-posta ya da sosyal giriş ile kayıt olabilir. Kayıt sonrası kısa bir profil tamamlama ekranı gelir; ad-soyad, şehir, iletişim tercihi ve konum izinleri istenir. Ardından kullanıcıyı iki seçenek karşılar: şimdi araç ekle ya da uygulamayı keşfet. Bu noktada sistem kullanıcının ilk değer anını mümkün olduğunca hızlı göstermelidir; bu nedenle araç eklemeyi güçlü biçimde teşvik etmeli, ama zorlamamalıdır.

1. Ana Sayfa

Ana sayfa uygulamanın araç sahibi için operasyon merkezi olmalıdır. Üstte aktif araç barı yer alır. Hemen altında aracın güncel durumu bulunur; örneğin açık hasar talebi, bekleyen teklif, yaklaşan bakım, çekici geçmişi ya da aktif servis süreci gibi kritik bilgiler burada özet kartlar halinde görünür. Ana sayfanın ilk blokları hızlı okunur, uzun liste hissi vermez. Kullanıcı burada “şu an bu araç için ne açık, ne bekliyor, ne yaklaşmakta” sorularının cevabını alır. Orta bölümde son aktiviteler akışı bulunur; son bakım kaydı, son fatura, en son yüklenen not ya da açık bir talebe gelen yeni teklif gibi olaylar kronolojik listelenir. Ana sayfanın alt kısmında kısa yollar yer alır; hasar oluştur, bakım kaydı aç, ustaları gör, çekici çağır, faturaları görüntüle gibi. Ana sayfa bir keşif alanı değil, bağlama duyarlı bir özet ve yönlendirme alanıdır.

1. Araç ekleme akışı

Bu akış detaylıdır ama kullanıcıyı boğmamalıdır. Çok adımlı ilerler ve her adım tek konuya odaklanır. İlk adım temel araç bilgileri içindir; plaka, marka, model, yıl, yakıt tipi, vites tipi, motor hacmi gibi bilgiler alınır. İkinci adım kullanım ve geçmiş bilgileri içindir; kilometre, son bakım tarihi, bilinen kronik sorunlar, daha önce değişen büyük parçalar, düzenli gidilen servis alışkanlıkları gibi alanlar bulunur. Üçüncü adım medya ve belge alanıdır; araç fotoğrafları, ruhsat görselleri, ekspertiz raporu, varsa önceki hasar fotoğrafları yüklenebilir. Dördüncü adım kişisel notlar alanıdır; kullanıcı “soğukta ilk çalıştırmada ses yapıyor” ya da “arka sol kapıda küçük çizik var” gibi yalnızca kendisinin görmek istediği notlar ekleyebilir. Son adım özet ve onay ekranıdır. Her adımda kaydet ve sonra tamamla mantığı bulunmalıdır. Araç ekleme akışı bir kez kullanılıp kapanan bir form değil, ileride güncellenen yaşayan bir profil üretir.

1. Araç yönetim sayfası

Bu sayfa aktif aracın tam profiline açılan ana sayfadır. Kullanıcı burada aracın tüm sabit bilgilerini, güncellenebilir alanlarını ve geçmiş özetlerini görür. Üst bölümde araç kimliği görünür; plaka, marka-model, yıl, kilometre ve varsa kısa durum etiketi bulunur. Altında düzenlenebilir bilgi kartları yer alır: teknik bilgiler, bakım alışkanlıkları, kronik notlar, medya ve belgeler. Sayfanın ikinci yarısı araç geçmişine açılır; son bakım, son hasar kaydı, son fatura, son servis notu gibi kısa özet modülleri bulunur. Bu sayfa yönetim sayfasıdır; eşleşme veya teklif ekranı değildir. Kullanıcı aracını burada düzeltir, eksiklerini tamamlar, yeni belge ekler ve tüm geçmişe üst düzeyden bakar.

1. Kayıtlar ekranı

Alt menüdeki ikinci sekme olan Kayıtlar, seçili aracın geçmiş odaklı kayıt merkezidir. Bu ekran bir liste ekranıdır ve aşağı doğru klasik uygulama akışıyla ilerler. Üstte aktif araç barı vardır. Altında sekmeli ya da filtreli bir yapı bulunur: bakım kayıtları, hasar kayıtları, faturalar, belgeler, kullanıcı notları. Kullanıcı burada geçmişe kronolojik olarak bakar. Her kayıt kartında tarih, kayıt türü, kısa özet, durum ve varsa tutar bilgisi görünür. Kayıtlar ekranı eşleşme değil hafıza ekranıdır; bu yüzden güven veren, saklayan ve geri çağıran bir yapı olmalıdır. Bir kayda dokunulduğunda detay sayfası açılır. Boş durumda “henüz bakım kaydı yok” gibi sade açıklamalar ve ilgili hızlı aksiyon butonları görünmelidir.

1. Hızlı eylem merkezi

Alt navigasyonun ortasındaki buton standart sekme değildir; oval ve baskın bir aksiyon tetikleyicisidir. Kullanıcı bastığında tam ekran olmayan ama güçlü bir açılır eylem paneli görünür. Burada en sık başlatılan iş akışları yer alır: hasar bildir, bakım talebi aç, usta bul, çekici çağır, belge/fatura yükle, not ekle. Bu menü uygulamanın operasyon başlatma noktasıdır. Kullanıcı burada gezinmek için değil, karar verip işlem başlatmak için bulunur. Bu nedenle her aksiyon büyük, açık, ikon destekli ve tek cümleyle anlatılmış olmalıdır. Menü kapandığında kullanıcı ilgili akışa doğrudan geçmelidir.

1. Hasar bildirme akışı

Hasar bildirme akışı katmanlı bir olay oluşturma ekranıdır. İlk ekran basit tutulur; hasarın türü, aracın sürülebilir olup olmadığı, aciliyet seviyesi ve kısa açıklama alınır. Sonraki adımda kullanıcıdan medya alınır; fotoğraf, video ve isterse ses kaydı ekleyebilir. Üçüncü adım detay derinleştirme ekranıdır; “daha fazla detay ekle” alanları burada açılır. Kullanıcı vuruntu sesi, titreşim, uyarı lambası, olayın ne zaman başladığı, hangi koşulda arttığı, daha önce benzer durum yaşanıp yaşanmadığı gibi ek alanları doldurabilir. Dördüncü adım tercih ekranıdır; servis yaklaşımı, bütçe hassasiyeti, konum kullanımı, çekici ihtiyacı, ikame araç beklentisi gibi tercihler alınabilir. Son ekran özet ve onay ekranıdır. Kullanıcı onay verdiğinde bu artık sistemde yaşayan bir hasar vakası olur ve eşleşme motoruna düşer. Bu akışta önemli olan, kullanıcının ne bildiğini rahatça söylemesi, bilmediği şeyi zorunlu alan yüzünden uydurmak zorunda kalmamasıdır.

1. Hasar detay sayfası

Hasar oluşturulduktan sonra kullanıcıya artık olay bazlı bir detay sayfası açılır. Bu sayfa o hasarın yaşam döngüsünü yönetir. Üst bölümde hasarın başlığı, mevcut durumu, oluşturulma tarihi ve araç bağlamı görünür. Orta bölümde kullanıcının eklediği açıklamalar, medya dosyaları ve tercihleri yer alır. Alt bölümde bu hasarla ilgili sistem hareketleri bulunur; hangi servisler gördü, kim teklif gönderdi, kim favoriye alındı, kullanıcı hangi teklifleri yıldızladı gibi. Bu sayfa eşleşmeye giden merkez düğümdür. Kullanıcı buradan talebi düzenleyebilir, ek medya yükleyebilir, talebi pasife alabilir ya da doğrudan eşleşme ekranına geçebilir.

1. Eşleşme / kaydırma ekranı

Uygulamanın Tinder benzeri kısmı burasıdır. Bu ekran yalnızca açık bir hasar ya da bakım talebi bağlamında çalışır. Üstte aktif araç barı ve hemen altında hangi talep için eşleşme yapıldığına dair kısa bir bağlam etiketi yer alır. Orta alanda tek tek servis kartları görünür. Kartın ana amacı hızlı ama güvenli karar verdirmektir. Servis adı, mesafe, puan, uzmanlık uyumu, tahmini fiyat bandı, cevap hızı, müsaitlik durumu, servis notu ve varsa teklif özeti kartta görünür. Kullanıcı sola kaydırarak geçer, sağa kaydırarak olumlu işaretler, yıldızlayarak kısa listeye alır, geri alarak son kararı iptal eder. Kartın içine girildiğinde daha detaylı servis profiline geçilir. Bu ekran eğlenceli değil akıcı olmalıdır; hareket mekaniği hızlı, görsel dil güven verici olmalıdır. Kullanıcının çok seçenek arasında boğulmadan birkaç güçlü adayla karşılaşması hedeflenir.

1. Ustalar ekranı

Alt navigasyonda ortanın sağındaki sekme klasik aşağı akan servis/usta listeleme ekranıdır. Bu ekran swipe alternatifi değil, klasik gözle tarama ve arama ekranıdır. Kullanıcı burada konuma, uzmanlık alanına, hizmet tipine, puana, fiyat aralığına ya da marka uyumuna göre servisleri listeleyebilir. Ekranın üstünde aktif araç barı bulunur; çünkü gösterilen sonuçların araç bağlamına göre anlamlı olması gerekir. Hemen altında arama alanı ve filtre çubuğu yer alır. Sonuçlar kart listesi şeklinde aşağı akar. Kullanıcı isterse servisleri harita görünümüne geçirebilir ama ana yapı liste olmalıdır. Bu ekran özellikle “ben kaydırmak istemiyorum, direkt bakıp seçmek istiyorum” diyen kullanıcı içindir.

1. Usta / servis profil sayfası

Bir servis kartına girildiğinde açılan detay sayfasıdır. Bu sayfa güven inşa eder. Üst bölümde servis adı, doğrulama rozetleri, puan, adres, hizmet bölgesi ve açık-kapalı durumu görünür. Altında uzmanlık alanları, çözdüğü tipik işler, marka/araç tipi deneyimi, fotoğraflar, çalışma saatleri, kullanıcı yorumları ve teklif yaklaşımı bulunur. Servis bu hasar ya da bakım talebine teklif göndermişse teklif özeti burada görünür. Sayfanın alt aksiyon alanında “teklifleri gör”, “kısa listeye ekle”, “eşleşme ekranına dön” gibi bağlama uygun butonlar yer alır. Bu sayfa bir işletme profili gibi davranmalı; fazla sosyal değil, güven ve karar odaklı olmalıdır.

1. Teklifler ekranı

Servislerin gönderdiği tekliflerin toplandığı ekran ayrı bir sayfa olarak bulunmalıdır. Kullanıcı burada tüm gelen teklifleri kart yapısında karşılaştırır. Bu ekran iki moda sahip olabilir: hızlı kart modu ve detay liste modu. Hızlı kart modunda teklifler yine swipe benzeri davranışla hızlı değerlendirilebilir. Detay modunda fiyat, tahmini süre, kapsam, kullanıcı puanı, garanti notu, çekici dahil olup olmadığı gibi alanlar yan yana okunur. Bu ekranın amacı “servis seçmek” değil, “gelen somut teklifleri karar seviyesinde karşılaştırmak”tır. Kullanıcı teklif kabul ettiğinde ilgili hasar ya da bakım vakası seçilen servis üzerinden yeni bir servis sürecine bağlanır.

1. Bakım talebi oluşturma akışı

Bakım akışı, hasar akışına göre daha planlı ve daha az belirsizdir. İlk adımda kullanıcı bakım türünü seçer; periyodik bakım, yağ değişimi, fren kontrolü, lastik değişimi, genel kontrol gibi. İkinci adımda aracın güncel kilometresi, mümkünse son bakım tarihi ve varsa ek not alınır. Üçüncü adım tercih ekranıdır; tarih aralığı, konum tercihi, servis tipi, fiyat hassasiyeti, orijinal parça beklentisi gibi alanlar girilir. Dördüncü adım özet ve gönder ekranıdır. Bu akış daha kısa olabilir ama yine de derinleşebilir olmalıdır. Talep açıldıktan sonra süreç hasar akışına benzer biçimde eşleşme motoruna düşer ve kullanıcı dilerse swipe ekranı, dilerse klasik usta listesi üzerinden servis seçer.

1. Çekici çağırma akışı

Bu akış ayrı bir operasyon akışıdır ve merkez eylem menüsünden erişilir. İlk ekranda aracın sürülebilir olup olmadığı, mevcut konum, varış hedefi ve aciliyet alınır. Sonraki adımda kullanıcı isterse fotoğraf ya da kısa not ekler. Son ekranda çekici talebi onaylanır. Talep oluşturulduktan sonra çekici hizmeti sağlayan işletmeler ya da iş ortakları listelenir. Burada swipe zorunlu değildir; çünkü çekici ihtiyacı çok daha zaman kritiktir. Bu akış daha çok en hızlı uygun çözümü göstermelidir. Yine de kullanıcıya birkaç seçeneği güvenli biçimde sunan sade kartlar bulunabilir.

1. Bildirimler ve gelen kutusu

Ana sayfadaki zil ikonundan ya da profil altından açılan bildirim merkezi, teklif güncellemeleri, servis yanıtları, durum değişiklikleri, yaklaşan bakım hatırlatmaları, ödeme/fatura bildirimleri ve sistem mesajlarını tek yerde toplar. Bildirimler yalnızca bilgi taşımaz; kullanıcıyı ilgili akışa geri götürür. Örneğin yeni teklif geldiyse ilgili teklif ekranına, servis fiyat güncellediyse teklif detayına, çekici yoldaysa canlı duruma taşır. Bu ekran araç bağımlı olaylar içerse de kendisi merkezi bildirim kutusudur; filtrelenebilir ve okunma durumları izlenebilir olmalıdır.

1. Profil ve ayarlar

Bu ekran araç bağımsız çalışır ve üstte aktif araç barı bulunmaz. Kullanıcı burada kişisel bilgilerini, iletişim tercihlerini, güvenlik ayarlarını, konum izinlerini, bildirim tercihlerini, ödeme yöntemlerini ve destek alanlarını yönetir. Ayrıca kayıtlı araçlar listesi bu ekranda ayrı bir bölüm olarak yer alabilir ama profil ekranının ana amacı hesap yönetimidir, araç operasyonu değildir. Kullanıcı burada uygulama dili, gizlilik, veri paylaşımı, teklif alma tercihleri ve destek taleplerini de yönetir. Bu ekran piyasa uygulamalarına benzer bir sadelikte olmalı; burada deneysel bir arayüz gereksizdir.

1. Destek ve yardım merkezi

Profil içinde açılan destek alanı, uygulama kullanım sorunları, talep/teklif anlaşmazlıkları, ödeme sorunları, servisle ilgili şikayetler ve genel yardım dokümanları için kullanılır. Sık sorulan sorular, canlı destek ya da talep oluşturma formları burada yer alır. Bu ekran ürünün güven katmanlarından biridir; çünkü araç tamiri ve servis seçimi gibi konularda kullanıcı yalnız kalmak istemez.

1. Servis süreci takip ekranı

Kullanıcı bir teklifi kabul ettikten sonra iş artık eşleşmeden operasyona geçer. Bu noktada ayrı bir servis takip ekranı açılmalıdır. Bu ekran Uber mantığında değil ama aşama odaklı çalışır. “Talep oluşturuldu”, “servis onayladı”, “araç kabul edildi”, “işlem sürüyor”, “ek onay istendi”, “tamamlandı” gibi durumlar zaman akışında gösterilir. Kullanıcı burada yeni fotoğraf, servis notu, fiyat güncellemesi ve onay bekleyen değişiklikleri görür. Uygulamanın uzun vadeli değerlerinden biri burada oluşur; çünkü sistem yalnızca usta buldurmaz, iş sürecini de kayıt altına alır.

1. Fatura ve belge detay sayfası

Kayıtlar ekranından açılan bu sayfa, belirli bir fatura ya da belgeyi detaylı gösterir. Fatura tarihi, servis adı, iş kalemleri, tutar, PDF ya da görsel görünümü, kullanıcı notu ve araca bağlanmış ilgili bakım/hasar kaydı görünür. Bu sayfa belgeyi pasif şekilde saklamakla kalmaz; gelecekte aynı parça değişimi ya da aynı servis geçmişi üzerinden güven sağlar.

1. Çoklu araç yönetimi

Kullanıcının birden fazla aracı olduğunda uygulama bağlamı karışmamalıdır. Bu yüzden çoklu araç yönetimi ayrı düşünülmelidir. Profil içinden açılan araç listesi ekranında tüm araçlar kart yapısında gösterilir. Her kartta plaka, marka-model, açık talep var mı, son bakım ne zaman yapıldı gibi kısa bilgiler bulunur. Kullanıcı yeni araç ekleyebilir, mevcut aracı düzenleyebilir ya da varsayılan araç belirleyebilir. Araçlar arası geçiş burada yapılabilir ama günlük kullanımda esas geçiş üst araç barı üzerinden olur.

Bu yapıda alt navigasyonun son hali nettir: solda Ana Sayfa, yanında Kayıtlar, ortada açılır Eylem Menüsü, ortanın sağında Ustalar, en sağda Profil/Ayarlar. Ana Sayfa ve Kayıtlar araç bağlamlıdır. Ustalar ekranı da araç ve talep bağlamına göre daha doğru sonuç verdiği için üst araç barıyla çalışır. Profil/Ayarlar ise araç bağımsızdır ve daha klasik bir hesap yönetim ekranı olarak kalır.
