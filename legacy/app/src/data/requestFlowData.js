// Üst seviye hasar izleri — ilk ekranda gösterilen 2 büyük kart
export const HASAR_TRACKS = [
    { id: 'ariza', label: 'Ariza Bildirimi', icon: '🔧', description: 'Ses, titresim, sizinti, elektrik ve diger arizalar' },
    { id: 'kaza', label: 'Kaza Bildirimi', icon: '💥', description: 'Kaza, carpma ve hasar olaylari' },
];

// Arıza alt tipleri — kategori seçim grid'i
export const ARIZA_ALT_TYPES = [
    {
        id: 'ses', label: 'Ses / Titresim', icon: '🔊',
        tone: 'diagnostic', // tanısal, sabırlı
        mediaPriority: ['audio', 'video', 'photo'],
        mediaHint: 'Ses kaydı, ustanın sorunu daha kolay teşhis etmesini sağlar.',
    },
    {
        id: 'elektrik', label: 'Elektrik Arizasi', icon: '⚡',
        tone: 'technical', // teknik, sistematik
        mediaPriority: ['photo', 'video'],
        mediaHint: 'Kadran uyarılarının veya arızalı sistemin fotoğrafını çekin.',
    },
    {
        id: 'sivi', label: 'Sivi Kacagi', icon: '💧',
        tone: 'urgent', // acil, doğrudan
        mediaPriority: ['photo'],
        mediaHint: 'Sızıntı bölgesinin fotoğrafı zorunludur — konum ve renk tespiti için.',
        photoRequired: true,
    },
    {
        id: 'isinma', label: 'Isinma Sorunu', icon: '🌡️',
        tone: 'warning', // uyarıcı
        mediaPriority: ['photo', 'video'],
        mediaHint: 'Gösterge panelinin fotoğrafı teşhise yardımcı olur.',
    },
    {
        id: 'diger', label: 'Diger', icon: '❓',
        tone: 'relaxed', // gevşek, serbest
        mediaPriority: ['photo', 'video', 'audio'],
        mediaHint: 'İstersen görsel veya ses ekleyebilirsin — opsiyonel.',
    },
];

// Geriye uyumluluk — eski referanslar için
export const HASAR_TYPES = ARIZA_ALT_TYPES;

// Kategori-spesifik sorular
export const HASAR_QUESTIONS = {
    ses: [
        { id: 'source', label: 'Ses nereden geliyor?', options: ['Motor', 'Tekerlekler', 'Alt Takim', 'Ic Kabin'] },
        { id: 'soundType', label: 'Nasıl bir ses?', options: ['Vuruntu', 'Islik', 'Surtunme', 'Gicirti'] },
        { id: 'worsens', label: 'Ne zaman belirgin?', options: ['Hizlanirken', 'Fren yaparken', 'Donuslerde', 'Rolantide'] },
    ],
    elektrik: [
        { id: 'system', label: 'Etkilenen sistem?', options: ['Aydinlatma', 'Aku / Start', 'Kadran / Ekran', 'Sensorler'] },
        { id: 'behavior', label: 'Ne sıklıkla oluyor?', options: ['Surekli', 'Ara sira', 'Sarsintida'] },
    ],
    sivi: [
        { id: 'color', label: 'Sıvı rengi?', options: ['Siyah / Koyu', 'Renkli', 'Kirmizi', 'Seffaf'] },
        { id: 'intensity', label: 'Kaçak şiddeti?', options: ['Nemlenme', 'Damlama', 'Gol olusturma'] },
    ],
    isinma: [
        { id: 'gauge', label: 'Hararet göstergesi?', options: ['Kirmizida', 'Dalgalaniyor', 'Normal'] },
        { id: 'symptoms', label: 'Eşlik eden belirti?', options: ['Buhar', 'Fan calismiyor', 'Su eksiltme'] },
    ],
    diger: [
        { id: 'urgency', label: 'Aciliyeti nasıl tarif edersin?', options: ['Hemen bakilmali', '1 hafta icinde', 'Kontrol amacli'] },
    ],
};

// Arıza akışı adım yapılandırmaları (yeni: çekici paneli → kategori → detay+medya → önizleme)
export const HASAR_FLOW_STEPS = {
    1: {
        title: 'Aracın durumunu belirleyelim',
        helper: 'Çekici ihtiyacını bildirmek, süreci doğru başlatır. Aracın sürülebilir olsa bile arıza bildirimini eksiksiz yapabilirsin.',
        primaryLabel: 'Devam Et',
    },
    2: {
        title: 'Arıza detayını ve kanıtları ekle',
        helper: 'Kategorine özel sorular ve medya; ustanın sorunu anlayıp daha net teklif vermesini sağlar.',
        primaryLabel: 'Ozeti Hazirla',
    },
    3: {
        title: 'Son tercihler ve özet',
        helper: 'Servis tercihini belirle, her şeyi gözden geçir ve havuza gönder.',
        primaryLabel: 'VakayI Gonder',
    },
};

export const BAKIM_TYPE_OPTIONS = [
    { id: 'periyodik', label: 'Periyodik Bakım', description: 'Yağ, filtreler ve genel kontrol', icon: '🔧' },
    { id: 'yag', label: 'Yağ Değişimi', description: 'Motor yağı ve filtre değişimi', icon: '🛢️' },
    { id: 'lastik', label: 'Lastik', description: 'Değişim, rot-balans ve kontrol', icon: '🛞' },
    { id: 'fren', label: 'Fren Sistemi', description: 'Balata, disk ve hidrolik', icon: '🔴' },
    { id: 'kislik', label: 'Kışlık / Genel', description: 'Antifriz, akü, silecek, mevsimsel hazırlık', icon: '❄️' },
    { id: 'klima', label: 'Klima Bakımı', description: 'Gaz, kabin filtresi ve kompresör', icon: '🌬️' },
];

// Alt kalemler — her bakım tipi için seçilebilir iş kalemleri
// brand: null = kullanıcı seçmedi, ileride marka seçimi + sponsorlu marka öne çıkarma için hazır
export const BAKIM_SUB_ITEMS = {
    periyodik: [
        { id: 'motor_yagi', label: 'Motor Yağı', icon: '🛢️', defaultPart: 'Fark etmez', brand: null },
        { id: 'yag_filtresi', label: 'Yağ Filtresi', icon: '⚙️', defaultPart: 'Fark etmez', brand: null },
        { id: 'hava_filtresi', label: 'Hava Filtresi', icon: '🌬️', defaultPart: 'Fark etmez', brand: null },
        { id: 'polen_filtresi', label: 'Polen Filtresi', icon: '🌸', defaultPart: 'Fark etmez', brand: null },
        { id: 'yakit_filtresi', label: 'Yakıt Filtresi', icon: '⛽', defaultPart: 'Fark etmez', brand: null },
        { id: 'buji', label: 'Buji', icon: '⚡', defaultPart: 'Orijinal', brand: null },
        { id: 'antifriz', label: 'Antifriz', icon: '💧', defaultPart: 'Fark etmez', brand: null },
        { id: 'fren_hidroligi', label: 'Fren Hidroliği', icon: '🔴', defaultPart: 'Orijinal', brand: null },
        { id: 'silecek_suyu', label: 'Silecek Suyu', icon: '💦', defaultPart: 'Fark etmez', brand: null },
    ],
    yag: [
        { id: 'motor_yagi', label: 'Motor Yağı', icon: '🛢️', defaultPart: 'Fark etmez', brand: null },
        { id: 'yag_filtresi', label: 'Yağ Filtresi', icon: '⚙️', defaultPart: 'Fark etmez', brand: null },
    ],
    lastik: [
        { id: 'lastik_degisim', label: 'Lastik Değişimi', icon: '🛞', defaultPart: 'Fark etmez', brand: null },
        { id: 'rot_balans', label: 'Rot-Balans', icon: '⚖️', defaultPart: null, brand: null },
        { id: 'lastik_basinc', label: 'Lastik Basıncı Kontrolü', icon: '🔍', defaultPart: null, brand: null },
        { id: 'yedek_lastik', label: 'Yedek Lastik Kontrolü', icon: '🔄', defaultPart: null, brand: null },
    ],
    fren: [
        { id: 'on_balata', label: 'Ön Balata', icon: '🔴', defaultPart: 'Orijinal', brand: null },
        { id: 'arka_balata', label: 'Arka Balata', icon: '🔴', defaultPart: 'Orijinal', brand: null },
        { id: 'on_disk', label: 'Ön Disk', icon: '💿', defaultPart: 'Orijinal', brand: null },
        { id: 'arka_disk', label: 'Arka Disk', icon: '💿', defaultPart: 'Orijinal', brand: null },
        { id: 'fren_hidroligi', label: 'Fren Hidroliği', icon: '💧', defaultPart: 'Orijinal', brand: null },
    ],
    kislik: [
        { id: 'antifriz', label: 'Antifriz Kontrolü', icon: '💧', defaultPart: 'Fark etmez', brand: null },
        { id: 'aku_testi', label: 'Akü Testi', icon: '🔋', defaultPart: null, brand: null },
        { id: 'silecek', label: 'Silecek Değişimi', icon: '🧹', defaultPart: 'Fark etmez', brand: null },
        { id: 'kislik_lastik', label: 'Kışlık Lastik', icon: '❄️', defaultPart: 'Fark etmez', brand: null },
        { id: 'isitma_kontrol', label: 'Isıtma Sistemi Kontrolü', icon: '🌡️', defaultPart: null, brand: null },
    ],
    klima: [
        { id: 'klima_gazi', label: 'Klima Gazı Dolumu', icon: '🌬️', defaultPart: null, brand: null },
        { id: 'kabin_filtresi', label: 'Kabin Filtresi', icon: '🌸', defaultPart: 'Fark etmez', brand: null },
        { id: 'kompresor', label: 'Kompresör Kontrolü', icon: '⚙️', defaultPart: null, brand: null },
    ],
};

// Km bandına göre akıllı öneriler — periyodik bakım için otomatik tik
// Aracın mevcut km'si en yakın üst banda yuvarlanır
export const KM_SUGGESTIONS = {
    10000: ['motor_yagi', 'yag_filtresi'],
    20000: ['motor_yagi', 'yag_filtresi', 'hava_filtresi'],
    30000: ['motor_yagi', 'yag_filtresi', 'hava_filtresi', 'polen_filtresi'],
    40000: ['motor_yagi', 'yag_filtresi', 'hava_filtresi', 'polen_filtresi', 'fren_hidroligi'],
    50000: ['motor_yagi', 'yag_filtresi', 'hava_filtresi', 'polen_filtresi', 'yakit_filtresi', 'buji'],
    60000: ['motor_yagi', 'yag_filtresi', 'hava_filtresi', 'polen_filtresi', 'yakit_filtresi', 'buji', 'antifriz'],
    90000: ['motor_yagi', 'yag_filtresi', 'hava_filtresi', 'polen_filtresi', 'yakit_filtresi', 'buji', 'antifriz', 'fren_hidroligi', 'silecek_suyu'],
};

// Km'yi en yakın üst banda yuvarla ve önerileri al
export function getSuggestedItems(kmString) {
    const km = parseInt(String(kmString).replace(/\D/g, ''), 10) || 0;
    const bands = Object.keys(KM_SUGGESTIONS).map(Number).sort((a, b) => a - b);
    // En yakın üst bandı bul
    const band = bands.find(b => b >= km) || bands[bands.length - 1];
    return KM_SUGGESTIONS[band] || KM_SUGGESTIONS[10000];
}

export const BAKIM_PART_OPTIONS = ['Orijinal', 'Esdeger', 'Fark etmez'];
export const BAKIM_DATE_OPTIONS = ['Bu hafta', 'Onumuzdeki hafta', 'Esnek'];

export const BAKIM_FLOW_STEPS = {
    1: {
        title: 'Bakım ihtiyacını tanımla',
        helper: 'Kilometre bilgini girdiğinde, sana uygun bakım kalemlerini otomatik önerelim.',
        primaryLabel: 'Kalemlere Geç',
    },
    2: {
        title: 'İş kalemlerini seç',
        helper: 'İhtiyacın olan kalemleri işaretle, her birine parça tercihini belirle. Ustalar bu listeye göre teklif verecek.',
        primaryLabel: 'Özeti Hazırla',
    },
    3: {
        title: 'Hazır. Bakım talebin tek adım kaldı',
        helper: 'Gönderdikten sonra uygun servisler tekliflerini iletecek. İstersen ardından ustaları kaydırarak görebilirsin.',
        primaryLabel: 'Talebi Gönder',
    },
};

