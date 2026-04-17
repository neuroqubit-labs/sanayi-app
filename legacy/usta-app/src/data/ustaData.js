/**
 * Usta App Data — Demo veriler ve sabitler
 *
 * USTA_PROFILE tip tanımı (JSDoc):
 *
 * @typedef {Object} UstaProfile
 * @property {string} id                     — Benzersiz usta/işletme kimliği
 * @property {string} name                   — İşletme adı
 * @property {string} initials               — Avatar kısaltması
 * @property {string} ownerName              — İşletme sahibi ad soyad
 * @property {'bireysel'|'servis'} type      — İşletme tipi (algoritmada kapasite farkı)
 * @property {boolean} verified              — Platform tarafından doğrulanmış mı
 *
 * @property {ContactInfo} contact           — İletişim bilgileri
 * @property {Location} location             — Konum & hizmet alanı
 * @property {TaxInfo} taxInfo               — Vergi bilgileri
 * @property {BankInfo} bankInfo             — Banka bilgileri
 *
 * @property {Specialty[]} specialties       — Uzmanlık alanları (algoritma eşleşme puanı)
 * @property {Certification[]} certifications — Belgeler & sertifikalar
 * @property {string[]} brands               — Uzman olduğu markalar
 * @property {WorkingHours} workingHours     — Çalışma saatleri
 * @property {string[]} gallery              — İş fotoğrafları
 *
 * @property {PerformanceStats} stats         — Performans metrikleri (algoritma ranking)
 */

/** @type {string[]} — Algoritma eşleşmede kullanılan kategori anahtarları */
export const SPECIALTY_CATEGORIES = [
    'motor', 'sanziman', 'elektrik', 'turbo', 'fren',
    'suspansiyon', 'klima', 'egzoz', 'kaporta', 'boya',
    'mekatronik', 'diagnostik', 'periyodik_bakim',
];

/** @type {string[]} — Marka uzmanlığı (algoritma eşleşme) */
export const BRAND_TAGS = [
    'BMW', 'Mercedes', 'Audi', 'VW', 'Toyota', 'Honda',
    'Hyundai', 'Ford', 'Renault', 'Fiat', 'Peugeot', 'Opel',
];

// ─── Usta İşletme Profili ───
export const USTA_PROFILE = {
    id: 'autopro',
    name: 'AutoPro Servis',
    initials: 'AP',
    ownerName: 'Mehmet Yılmaz',
    type: 'servis', // 'bireysel' | 'servis'
    verified: true,

    // ─ Tagline (müşteri vitrininde öne çıkar)
    tagline: 'Alman araçlarda zincir-turbo-mekatronik. Her işte video teşhis.',

    // ─ İletişim
    contact: {
        phone: '+90 532 111 22 33',
        email: 'info@autoproservis.com',
        whatsapp: '+90 532 111 22 33',
    },

    // ─ Konum & Hizmet Alanı
    location: {
        address: 'Güngören Sanayi Sitesi, B Blok No:14, İstanbul',
        district: 'Güngören',
        city: 'İstanbul',
        lat: 41.0082,
        lng: 28.8628,
        radiusKm: 15,
    },

    // ─ Vergi & Banka
    taxInfo: { vkn: '123****890', unvan: 'AutoPro Otomotiv Ltd. Şti.' },
    bankInfo: { iban: 'TR** **** **** **** **** **42', bankName: 'Ziraat Bankası' },

    // ─ Uzmanlık (algoritma eşleşme skoru için ağırlıklı)
    specialties: [
        { key: 'motor',      label: 'Motor',      level: 'expert' },
        { key: 'sanziman',   label: 'Şanzıman',   level: 'expert' },
        { key: 'elektrik',   label: 'Elektrik',    level: 'proficient' },
        { key: 'turbo',      label: 'Turbo',       level: 'expert' },
        { key: 'diagnostik', label: 'Diagnostik',  level: 'proficient' },
    ],

    // ─ Marka Uzmanlığı
    brands: ['BMW', 'Audi', 'Mercedes'],

    // ─ Belgeler & Sertifikalar
    certifications: [
        { name: 'TSE Onaylı Servis', issuer: 'TSE', year: 2024, verified: true },
        { name: 'BMW Eğitim Sertifikası', issuer: 'BMW Türkiye', year: 2023, verified: true },
        { name: 'Bosch Car Service', issuer: 'Bosch', year: 2022, verified: true },
    ],

    // ─ Çalışma Saatleri
    workingHours: {
        weekdays: '08:30 – 18:30',
        saturday: '09:00 – 15:00',
        sunday: 'Kapalı',
    },

    // ─ Galeri (her kart: başlık + öne çıkarıldı mı)
    gallery: [
        { id: 'g1', icon: '🔧', caption: 'Motor revizyonu', featured: true },
        { id: 'g2', icon: '🏭', caption: 'Atölye', featured: false },
        { id: 'g3', icon: '⚙️', caption: 'Zincir kiti', featured: false },
        { id: 'g4', icon: '🚗', caption: 'BMW M240i', featured: false },
    ],

    // ─ Performans Metrikleri (algoritma ranking)
    stats: {
        rating: 4.8,
        reviewCount: 127,
        completedJobs: 342,
        responseTimeMinutes: 18,  // ortalama teklif yanıt süresi
        completionRate: 0.96,     // tamamlanan iş / kabul edilen iş
        repeatCustomerRate: 0.34, // tekrar gelen müşteri oranı
        memberSince: '2023-03-01',
        avgJobDurationDays: 2.4,  // ortalama iş tamamlama süresi
    },

    // ─ Kapasite
    capacity: {
        maxConcurrentJobs: 4,
        currentActiveJobs: 2,
        liftsCount: 2,
        teamSize: 3,
    },
};

// ─── İş Havuzu (Pool'daki tüm işler — usta browse eder) ───
export const POOL_JOBS = [
    {
        id: 'pool_001',
        category: 'mekanik',
        vehicle: { plate: '34 ABC 42', model: 'BMW 3 Serisi', year: 2019, km: '87.400' },
        description: 'Soğuk çalıştırmada motordan metalik ses geliyor, 30 saniye sonra azalıyor.',
        urgency: 'medium',
        mediaCount: 2,
        distanceKm: 3,
        postedAgo: '2 saat',
        aiInsights: {
            category: 'Motor',
            estimatedCost: { min: 2000, max: 3500 },
            summary: 'Zamanlama zinciri ve üst kapak tarafında inceleme öneriliyor.',
            matchScore: 94,
        },
        customerSlots: [
            { day: '2026-04-17', ranges: ['morning', 'afternoon'] },
            { day: '2026-04-18', ranges: ['morning'] },
        ],
        customerNote: 'Aracımı getirebilirim. Bu hafta içi uygunum.',
        quoteCount: 1,
        status: 'open',
    },
    {
        id: 'pool_002',
        category: 'bakim',
        vehicle: { plate: '06 XYZ 77', model: 'Toyota Corolla', year: 2021, km: '42.100' },
        description: 'Periyodik bakım: Yağ, filtre, buji değişimi. Fren kontrolü de yapılsın.',
        urgency: 'low',
        mediaCount: 0,
        distanceKm: 7,
        postedAgo: '5 saat',
        aiInsights: {
            category: 'Bakım',
            estimatedCost: { min: 800, max: 1500 },
            summary: 'Standart periyodik bakım. Toyota Corolla 1.6D için uyumlu filtre seti.',
            matchScore: 88,
        },
        customerSlots: [
            { day: '2026-04-19', ranges: ['flexible'] },
        ],
        customerNote: 'Pickup servisi varsa tercih ederim.',
        quoteCount: 0,
        status: 'open',
    },
    {
        id: 'pool_003',
        category: 'kaza',
        vehicle: { plate: '34 GHI 99', model: 'VW Golf', year: 2020, km: '55.200' },
        description: 'Arka tampon ve bagaj kapağında çarpma hasarı. Boya ve düzeltme gerekiyor.',
        urgency: 'medium',
        mediaCount: 4,
        distanceKm: 5,
        postedAgo: '1 saat',
        aiInsights: {
            category: 'Kaporta',
            estimatedCost: { min: 3500, max: 6000 },
            summary: 'Arka tampon değişimi + bagaj kapağı boyası. Parça tedariği gerekebilir.',
            matchScore: 72,
        },
        customerSlots: [],
        customerNote: 'Sigorta dosyası açılacak, kasko mevcut.',
        quoteCount: 2,
        status: 'open',
    },
    {
        id: 'pool_004',
        category: 'mekanik',
        vehicle: { plate: '34 JKL 55', model: 'Audi A4', year: 2018, km: '112.000' },
        description: 'Turbo basınç kaybı, güç düşüşü ve siyah duman. Turbo karteli sesi var.',
        urgency: 'high',
        mediaCount: 1,
        distanceKm: 2,
        postedAgo: '30 dk',
        aiInsights: {
            category: 'Motor / Turbo',
            estimatedCost: { min: 4000, max: 8000 },
            summary: 'Turbo revizyonu veya değişimi olası. Intercooler ve basınç hortumları kontrol edilmeli.',
            matchScore: 91,
        },
        customerSlots: [
            { day: '2026-04-17', ranges: ['morning'] },
        ],
        customerNote: 'Acil, araç zor kullanılıyor. Çekici gerekebilir.',
        quoteCount: 0,
        status: 'open',
    },
    {
        id: 'pool_005',
        category: 'bakim',
        vehicle: { plate: '06 MNO 33', model: 'Hyundai i20', year: 2022, km: '28.000' },
        description: 'Fren balataları aşınmış, ön diskler kontrol edilsin. Fren hidroliği de değişsin.',
        urgency: 'medium',
        mediaCount: 0,
        distanceKm: 12,
        postedAgo: '8 saat',
        aiInsights: {
            category: 'Fren',
            estimatedCost: { min: 600, max: 1200 },
            summary: 'Ön balata + disk seti + fren hidroliği. Standart işlem.',
            matchScore: 85,
        },
        customerSlots: [
            { day: '2026-04-20', ranges: ['afternoon', 'evening'] },
        ],
        customerNote: '',
        quoteCount: 1,
        status: 'open',
    },
    {
        id: 'pool_006',
        category: 'mekanik',
        vehicle: { plate: '34 PQR 11', model: 'Mercedes C200', year: 2017, km: '145.000' },
        description: 'Şanzıman sert geçiş yapıyor, 3→4 vites arası takılma hissediliyor.',
        urgency: 'medium',
        mediaCount: 1,
        distanceKm: 9,
        postedAgo: '1 gün',
        aiInsights: {
            category: 'Şanzıman',
            estimatedCost: { min: 1500, max: 4500 },
            summary: 'Şanzıman yağ ve filtre değişimi öncelikli. Mekatronik ünite kontrol edilmeli.',
            matchScore: 78,
        },
        customerSlots: [],
        customerNote: 'Yerinde teşhis yapılabilirse iyi olur.',
        quoteCount: 3,
        status: 'open',
    },
];

// ─── Gönderilen Teklifler (Geçmiş) ───
export const SENT_QUOTES = [
    {
        id: 'sq_001',
        requestId: 'ir_prev_001',
        caseId: 'usta_demo_mekanik',
        customerName: 'Alfonso R.',
        vehicleInfo: '34 ABC 42 · BMW 3 Serisi',
        description: 'Motor zincir kiti değişimi',
        total: 2400,
        timeline: '1-2 gün',
        status: 'accepted',
        sentAt: '2026-04-05T09:00:00Z',
    },
];

// ─── Gelir Kayıtları ───
export const REVENUE_RECORDS = [
    {
        id: 'rev_001',
        caseId: 'usta_demo_mekanik',
        jobTitle: 'Motor Zincir Kiti Değişimi',
        customerName: 'Alfonso R.',
        vehiclePlate: '34 ABC 42',
        gross: 2400,
        commission: 240,
        net: 2160,
        invoiceId: 'FT-2026-0042',
        invoiceDate: '2026-04-10',
        paymentStatus: 'partial',
        receivedAmount: 800,
        date: '2026-04-05',
    },
    {
        id: 'rev_002',
        caseId: 'usta_demo_completed_1',
        jobTitle: 'Periyodik Bakım — Yağ, hava filtresi, buji',
        customerName: 'Alfonso R.',
        vehiclePlate: '34 ABC 42',
        gross: 2850,
        commission: 285,
        net: 2565,
        invoiceId: 'FT-2026-0038',
        invoiceDate: '2026-03-14',
        paymentStatus: 'received',
        receivedAmount: 2850,
        date: '2026-03-14',
    },
    {
        id: 'rev_003',
        caseId: 'usta_demo_completed_2',
        jobTitle: 'Arka Sol Kapı Kaporta Boya',
        customerName: 'Hakan T.',
        vehiclePlate: '34 DEF 88',
        gross: 3200,
        commission: 320,
        net: 2880,
        invoiceId: 'FT-2025-0127',
        invoiceDate: '2025-11-15',
        paymentStatus: 'received',
        receivedAmount: 3200,
        date: '2025-11-15',
    },
];

// ─── Bugünün ve Yaklaşan Randevular ───
export const APPOINTMENTS = [
    {
        id: 'apt_001',
        caseId: 'usta_demo_bakim',
        date: 'Bugün',
        time: '10:00',
        label: 'Yağ Değişimi',
        vehiclePlate: '06 XYZ 77',
        vehicleModel: 'Toyota Corolla',
        customerName: 'Elif K.',
        status: 'confirmed',
    },
    {
        id: 'apt_002',
        caseId: 'usta_demo_mekanik',
        date: '17 Nis',
        time: '09:00',
        label: 'Zincir Kiti Montajı — Devam',
        vehiclePlate: '34 ABC 42',
        vehicleModel: 'BMW 3 Serisi',
        customerName: 'Alfonso R.',
        status: 'confirmed',
    },
    {
        id: 'apt_003',
        date: '18 Nis',
        time: '14:00',
        label: 'Fren Kontrolü',
        vehiclePlate: '34 DEF 88',
        vehicleModel: 'Mercedes C180',
        customerName: 'Hakan T.',
        status: 'pending',
    },
];
