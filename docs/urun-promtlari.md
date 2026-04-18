Bu uygulama nezinde hatalardan bahsedeceğim. Detaylı refactoring planı uygulayacağız.
Öncelikle 1.sinden bahsedeceğim, Hasar bildir üzerindeki Kaza çarpma gibi görselde eklediğim ekran görüntüsü kısmı. Burada kaza durumundaki panik halindeki bir insanın normal bir arızası olan insan göre biraz daha farklı olduğunu biliyoruz.
Şimdi buradaki hiyerarşi yanlış. sıvı kaçağı titreşim ısınma sorunu veya diğer gibi alt kategoriler aslında arıza bildirimi.
Ama bir de kaza durumu var.
Burada 2 kategori ve çekici ihtiyacı daha yeterli bir içerik.

Tamam kazadan devam edelim.
KAza çarpmaya tyıklandığı anda böyle bir alt başlık açılıyor kaza tutanacağı bildirimi.
Bu da saçma. Doğrudan insanın kaza durumunda kaza bildirimi yaptığı ortamda bulunmalı. Nasit bir uyarı paneli ile şu anda kaza bildirimi yapmak istediğini yansıtmalı.

Şimdi buradaki vizyondan da kısaca bahsedeyim: amacımız kaza anında bildirilen hasarı doğrudan havuza aktarıp kişinin çekici süreci ya da arabaasını sürebiliyor ise eve git arabayı yaptırmak düşündüğü süre boyunca usta seçimini tamamlamasını sağlamak.
Nasıl?
Açıklayayım: eksiksiz doldurduğu kaza bilgileri ile (aşağıda adımları anlatacağım) havuza düşecek kaza bildirimini tek taraflı mı, sigorta veya kasko devreye girmeli mi, fotoğraflar gibi tam paket bir hasar bildirimi şeklinde sistem havuzuna atar.
Usta seçicide isterse doğrudan ustaya talep yollar ya da bundan bağımsız doğrudan havuza attığı gibi bırakır ve ustaların teklif yollamasını bekler.
USta hasar havuzundan görür teklif yollayabilir. Ya da sigorta kaskoya doğrudan doldurulan bilgiler temiz bir mail şeklinde iletilir. Ve onlardan süreç başlatması beklenir gerekirse uygun sigortayı aramaya yönlendirilebilir.

sistem o kadar temiz olmalı ki, türkiyede oto servislerin yönettiği sigorta ve dosya sürecini sigorta şirketleri bile bizim panelimizden yönetilmesini istemeli. Tam kitaına uygun şekilde. HAtta belki daha rahatlatıcı ve kolaylaştırıcı bir şekilde, vizyon bu.

Akışa dönecek olursak, illa ki es geçtiklerim olabilir sen tamamlarsın bir kaza sürecinde neler olabilir.

Kaza Anında ambulans çaırıldı mı sağlık tehlikesi var mı?
o zaman tutanak polis hazırlayacağı için bir iki günde emniyetten alınması gerekir ve dosyaya da o şekilde eklenir.
Yani en öndeki ekranda kaza bildirimi ambulansa bildir gibi ya da ambulans çağır şeklinde doğrudan buton bulunmalı. Altında şu andaki gibi çekici durumu eklenmeli.
Ana kategorileri seçtik zaten hasar mı arıza mı.
Devam edelim toparlayıp. Kaza çarpma bildirimine tıklayan kişi aşağıda ambulans kırmızı büyük beliren butonuna doğrudan tıklayabilir. Ya da çekici butonuna basabilir halihazırda turuncu şekilde bulunan. Yani kaza çarpmada ambulans butonu ama normal tıklanmamış durumda turuncu hafif saydam çekici butonu.

Tamam akış devam etsin kaza yaptı tıkladı ambulansı aramadı veya aradı çekici çağırdı veya çağırmadı. HAsar bildirimine temiz bir akıştan devam edebilmeli. KAza tek taraflı mı yoksa karşı taraf var mı. Var ise kaç adet. Anında kaza anına uygun fotoğraf çekme ekranı adım adım yönlendirir kullanıcıyı. KAzayı şu mesafeden iki araç görünecek şekilde çekin, kazayı iki aracın plakası görünecek şekilde çekin bu adımlarda ihtiyaç kadar opsiyonel 2-3 fotoğraf hakkı sunulabilir. Adım sayısı da bu kadar sınırlı değildir bu arada örneğin hasarın doğrudan fotoğrafını çekin gibi,
Fotoğraflar çekildikten sonra bir bildirim ile, "yaralı veya hasarı ağır bir araç yok ise araç/araçları trafiği bozmayacak şekilde kenara çekebilirsiniz, bu adımdan sonrası evrak işlemleridir" gibi bir uyarı ile tarfiği bilinçsiz meşgul eden durumu da yönetmiş olacağız.
Bİr sonraki adımda kaza tutanağı hakkında kısa açıklayıcı bilgimizi verip kaza tutanağının e devlet üzerinden, normal kağıtta mı yoksa polisin mi tuttuğunu netleştirip seçim yaptırırız ve gerektiğinde o şekilde yükleme yapar. POlisse daha sonra yükler mesela ya da kendileri tutmuşsa görseli yükler ve orijinali saklaması hakkında bilgilendirilir. E devlet ise nasıl dışa aktarıp sisteme yükleyeceği kısaca açıklanır.
Tamam bu adımı da geçtik;
Daha sonra bu yeşil uyarıdan sonra evrak adımına başlanır. karşı tarafın bilgileri görsel pdf vs (ruhsat ehliyet sigorta poliçesi) hepsi zorunlu adım ama her zaman geçilebilir zorunlu adımlar "daha sonra eklenebilir eksik evrak" motivasyonunda ilerleyebilir. Karşı taraf için de benzer şekilde. HAvuza düşse bile servisler veya sigorta şirketleri eksik evrak durumu görüp adım atma konusunda kendileri insiyatif almış olurlar, örneğin teklif yollarken içerisinde kaza tutanacağını sorabilirler.

Tamam kaza görselleri ve kazaya dair tüm bilgiler elimizde.
En son adımda kaskoya başvurmak istiyorum, sigortaya başvurmak istiyorum. İki bilgi, o bilgiler işaretlenirse şirket isimlerini gireceği bar açılır ve son adımda detaylı bir önizleme, görsellerin tek kutu önizlemesi, evrakların keza tek kutu tıklandığında açılan tabi ki önizlemesi şeklinde. Sonra onayladığı anda sistem yeterli veri içeriyor ise onu son kontrollerden sonra havuza atıp atmayacağına karar verir. gerekirse sigorta firmalarına hasar bildidri maillerini dosyalayıp yollar otomatik olarak.

Artık ustalar hasarla alakalı bilgileri ekranlarında havuz sistemi içerisinde görebilirsler. DOğrudan hasara yorumlu teklifte bulunabilirler.

Fakat orada teklif veren usta mı yoksa bizim seçtiğimiz usta mı olması gerektiğinin kararını kaydırma kveya listeleme tarafındaki yapacağımız algoritmik manupuılasyon ile yapacağız. Burada amaç sistemin kailitesini kendisinin koruyabilmesi için kurulmuş algoritmaya sadık kalınması olacak.
Sistemin güvenliği için ucuz teklif veren müşteriyi rezil edecek kişiyi doğrudan müşterinin önüne çıkaramayız keza tam terisni de çıkarmalıyız. Sektörü iyileştirecek kalitete bir sisttem arzuluyoruz.

Bunu dökümanlı detaylı plan haline getir.
Ben metni olduğu gibi bir mdye atıyorum sen bunu temiz anlaşılır ürün diliyle temize çekrsin aynı zamanda
