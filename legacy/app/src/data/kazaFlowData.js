// Kaza Bildirimi — Akış Sabitleri
// 7 adımlı kaza yönetim akışı veri tanımları

export const KAZA_INITIAL_STATE = {
    ambulansCagirildi: false,
    cekiciCagirildi: false,
    kazaTipi: null,          // 'tek_tarafli' | 'karsi_tarafli'
    karsiTarafSayisi: 1,
    aciklama: '',
    fotograflar: {},          // { adimId: [{ name, url }] }
    tutanakKaynak: null,      // 'edevlet' | 'kagit' | 'polis'
    tutanakYuklendi: false,
    evraklar: {
        kendi: { ehliyet: null, ruhsat: null, police: null },
        karsiTaraf: { ehliyet: null, ruhsat: null, police: null },
    },
    kaskoBasvuru: false,
    kaskoSirket: '',
    sigortaBasvuru: false,
    sigortaSirket: '',
};

export const KAZA_FLOW_STEPS = {
    0: {
        title: 'Kaza Bildirimi',
        helper: 'Önce güvenliğinizi sağlayın. Acil bir durumunuz varsa aşağıdaki butonları kullanabilirsiniz.',
        primaryLabel: 'Acil Durumum Yok, Devam Et',
    },
    1: {
        title: 'Kaza hakkında temel bilgiler',
        helper: 'Kazanın türünü ve kısa bir açıklamasını paylaşın. Bu bilgiler hasar dosyanızın temelini oluşturur.',
        primaryLabel: 'Fotoğraflara Geç',
    },
    2: {
        title: 'Kaza fotoğraflarını çekelim',
        helper: 'Adım adım yönlendirmelerle doğru açılardan fotoğraf çekmenizi sağlıyoruz. Teklif kalitesini doğrudan etkiler.',
        primaryLabel: 'Devam Et',
    },
    3: {
        title: 'Kaza tutanağı',
        helper: 'Tutanak, kazanın resmi belgesidir. Şimdi ekleyebilir veya daha sonra tamamlayabilirsiniz.',
        primaryLabel: 'Evraklara Geç',
    },
    4: {
        title: 'Evrak ve belgeler',
        helper: 'Ehliyet, ruhsat ve sigorta poliçesi bilgileriniz süreci hızlandırır. Eksik evrakları daha sonra da ekleyebilirsiniz.',
        primaryLabel: 'Sigorta Tercihine Geç',
    },
    5: {
        title: 'Sigorta ve kasko tercihleri',
        helper: 'Başvuru yapmak istediğiniz kurumları seçin. Bildiriminiz otomatik olarak dosyalanır.',
        primaryLabel: 'Önizlemeye Geç',
    },
    6: {
        title: 'Bildirim özeti',
        helper: 'Tüm bilgilerinizi kontrol edin. Onayladığınız anda hasar havuzuna düşecek ve ustalar tekliflerini gönderebilecek.',
        primaryLabel: 'Bildirimi Gönder',
    },
};

export const KAZA_FOTO_STEPS = [
    {
        id: 'genel',
        title: 'Genel Görünüm',
        instruction: 'Kazayı 3–4 metre mesafeden, araç/araçlar tam görünecek şekilde çekin.',
        minPhotos: 1,
        maxPhotos: 3,
        required: true,
        icon: '📸',
    },
    {
        id: 'plaka',
        title: 'Plaka Çekimi',
        instruction: 'Kaza yapan araçların plakalarını okunacak şekilde çekin.',
        minPhotos: 1,
        maxPhotos: 2,
        required: false,           // tek taraflıda gerekmeyebilir
        onlyKarsiTarafli: true,
        icon: '🔍',
    },
    {
        id: 'hasar_detay',
        title: 'Hasar Detayı',
        instruction: 'Hasarlı bölgelerin yakın çekimini yapın. Çizik, ezik, kırık parçaları net gösterin.',
        minPhotos: 1,
        maxPhotos: 5,
        required: true,
        icon: '🔎',
    },
    {
        id: 'cevre',
        title: 'Çevre ve Konum',
        instruction: 'Kaza yerinin genel görünümünü, yol işaretlerini ve çevreyi çekin.',
        minPhotos: 0,
        maxPhotos: 2,
        required: false,
        icon: '🗺️',
    },
    {
        id: 'ek',
        title: 'Ek Fotoğraflar',
        instruction: 'Eklemek istediğiniz başka görseller varsa buradan yükleyebilirsiniz.',
        minPhotos: 0,
        maxPhotos: 3,
        required: false,
        icon: '➕',
    },
];

export const KAZA_TUTANAK_OPTIONS = [
    {
        id: 'edevlet',
        icon: '📱',
        label: 'E-Devlet ile Yükle',
        description: 'E-Devlet uygulamasından kaza tutanağınızı PDF olarak indirip buradan yükleyebilirsiniz.',
    },
    {
        id: 'kagit',
        icon: '📄',
        label: 'Kağıt Tutanak Yükle',
        description: 'Islak imzalı tutanağınızın fotoğrafını çekin. Orijinalini mutlaka saklayın.',
    },
    {
        id: 'polis',
        icon: '👮',
        label: 'Polis Tutanağı',
        description: 'Polis tarafından tutulan tutanağı 1–2 gün içinde emniyetten alabilirsiniz. Daha sonra yükleyebilirsiniz.',
    },
];

export const KAZA_EVRAK_TYPES = [
    { id: 'ehliyet', label: 'Ehliyet', icon: '🪪' },
    { id: 'ruhsat', label: 'Ruhsat', icon: '📋' },
    { id: 'police', label: 'Sigorta Poliçesi', icon: '📑' },
];
