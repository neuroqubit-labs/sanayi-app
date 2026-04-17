/**
 * Purchase Data — Dogrudan satin alinabilir servis paketleri
 */

export const SERVICE_PACKAGES = [
    // ── Kampanya paketleri ──
    {
        id: 'pkg-yaz-bakim',
        title: 'Yaz Bakimi Paketi',
        icon: '🔧',
        description: 'Yag + Filtre + Klima Kontrolu',
        longDescription: 'Aracinizi yaz aylarina hazirlayan kapsamli bakim paketi. Motor yagi, yag filtresi, hava filtresi degisimi ve klima sistemi kontrolu dahildir.',
        price: 699,
        originalPrice: 899,
        campaignId: 'campaign-1',
        bakimItemId: null,
        category: 'bakim',
        includedItems: [
            { label: 'Motor Yagi Degisimi', icon: '🛢️' },
            { label: 'Yag Filtresi', icon: '⚙️' },
            { label: 'Hava Filtresi', icon: '🌬️' },
            { label: 'Klima Kontrolu', icon: '❄️' },
        ],
        estimatedDuration: '1-2 saat',
        guarantee: '3 ay / 5.000 km',
        provider: {
            id: 'autopro', name: 'AutoPro Servis', initials: 'AP',
            rating: 4.8, reviews: 127, distance: '2.1 km',
        },
        tags: ['Kampanya', 'Populer'],
    },
    {
        id: 'pkg-lastik-degisim',
        title: 'Lastik Degisim Kampanyasi',
        icon: '🛞',
        description: '4 Lastik Montaj + Balans',
        longDescription: '4 adet lastik montaj, balans ayari ve lastik durum raporu dahildir. Mevsimsel gecisler icin idealdir.',
        price: 999,
        originalPrice: 1200,
        campaignId: 'campaign-2',
        bakimItemId: null,
        category: 'bakim',
        includedItems: [
            { label: '4 Lastik Sokum & Takim', icon: '🛞' },
            { label: 'Balans Ayari', icon: '⚖️' },
            { label: 'Lastik Basinc Kontrolu', icon: '🔍' },
            { label: 'Lastik Durum Raporu', icon: '📋' },
        ],
        estimatedDuration: '45 dk - 1 saat',
        guarantee: '1 ay',
        provider: {
            id: 'autopro', name: 'AutoPro Servis', initials: 'AP',
            rating: 4.8, reviews: 127, distance: '2.1 km',
        },
        tags: ['Kampanya'],
    },

    // ── Bakim paketleri (standart fiyatli) ──
    {
        id: 'pkg-periyodik-bakim',
        title: 'Periyodik Bakim',
        icon: '🔧',
        description: 'Yag, filtre, genel kontrol',
        longDescription: 'Motor yagi, yag filtresi, hava filtresi degisimi ve aracin genel mekanik kontrolunu icerir.',
        price: 1200,
        originalPrice: null,
        campaignId: null,
        bakimItemId: 'bk-1',
        category: 'bakim',
        includedItems: [
            { label: 'Motor Yagi Degisimi', icon: '🛢️' },
            { label: 'Yag Filtresi', icon: '⚙️' },
            { label: 'Hava Filtresi', icon: '🌬️' },
            { label: 'Genel Kontrol', icon: '🔍' },
        ],
        estimatedDuration: '1-2 saat',
        guarantee: '3 ay / 5.000 km',
        provider: {
            id: 'sariyer-motor', name: 'Sariyer Motor', initials: 'SM',
            rating: 4.7, reviews: 214, distance: '6.1 km',
        },
        tags: ['Standart'],
    },
    {
        id: 'pkg-fren-sistemi',
        title: 'Fren Sistemi Kontrolu',
        icon: '🛑',
        description: 'Balata, disk, hidrolik',
        longDescription: 'Fren balatalari, disk kontrolu, hidrolik sivi seviyesi ve fren sistemi genel performans testi.',
        price: 800,
        originalPrice: null,
        campaignId: null,
        bakimItemId: 'bk-2',
        category: 'bakim',
        includedItems: [
            { label: 'Balata Kontrolu', icon: '🔍' },
            { label: 'Disk Olcumu', icon: '📏' },
            { label: 'Hidrolik Sivi', icon: '💧' },
            { label: 'Performans Testi', icon: '✅' },
        ],
        estimatedDuration: '1 saat',
        guarantee: '3 ay',
        provider: {
            id: 'autopro', name: 'AutoPro Servis', initials: 'AP',
            rating: 4.8, reviews: 127, distance: '2.1 km',
        },
        tags: ['Standart'],
    },
    {
        id: 'pkg-klima-bakim',
        title: 'Klima Bakimi',
        icon: '❄️',
        description: 'Gaz dolumu, filtre, dezenfeksiyon',
        longDescription: 'Klima gazi dolumu, polen filtresi degisimi ve evaporator dezenfeksiyonu.',
        price: 650,
        originalPrice: null,
        campaignId: null,
        bakimItemId: 'bk-3',
        category: 'bakim',
        includedItems: [
            { label: 'Klima Gazi Dolumu', icon: '🧊' },
            { label: 'Polen Filtresi', icon: '🌿' },
            { label: 'Dezenfeksiyon', icon: '🧹' },
        ],
        estimatedDuration: '45 dk',
        guarantee: '3 ay',
        provider: {
            id: 'engin-electric', name: 'Engin Oto Elektrik', initials: 'EO',
            rating: 4.5, reviews: 89, distance: '3.4 km',
        },
        tags: ['Standart'],
    },
    {
        id: 'pkg-yag-degisimi',
        title: 'Motor Yag Degisimi',
        icon: '🛢️',
        description: 'Yag + filtre degisimi',
        longDescription: 'Arac modeline uygun motor yagi ve yag filtresi degisimi.',
        price: 750,
        originalPrice: null,
        campaignId: null,
        bakimItemId: 'bk-4',
        category: 'bakim',
        includedItems: [
            { label: 'Motor Yagi', icon: '🛢️' },
            { label: 'Yag Filtresi', icon: '⚙️' },
        ],
        estimatedDuration: '30-45 dk',
        guarantee: '3 ay / 5.000 km',
        provider: {
            id: 'sariyer-motor', name: 'Sariyer Motor', initials: 'SM',
            rating: 4.7, reviews: 214, distance: '6.1 km',
        },
        tags: ['Standart'],
    },
    {
        id: 'pkg-lastik',
        title: 'Lastik Degisimi',
        icon: '🛞',
        description: '4 lastik montaj + balans',
        longDescription: 'Dort lastik montaj, balans ve basinc ayari.',
        price: 400,
        originalPrice: null,
        campaignId: null,
        bakimItemId: 'bk-5',
        category: 'bakim',
        includedItems: [
            { label: 'Lastik Montaj (4 adet)', icon: '🛞' },
            { label: 'Balans Ayari', icon: '⚖️' },
        ],
        estimatedDuration: '45 dk',
        guarantee: '1 ay',
        provider: {
            id: 'autopro', name: 'AutoPro Servis', initials: 'AP',
            rating: 4.8, reviews: 127, distance: '2.1 km',
        },
        tags: ['Standart'],
    },
    {
        id: 'pkg-aku',
        title: 'Aku Kontrolu',
        icon: '🔋',
        description: 'Sarj testi, terminal temizligi',
        longDescription: 'Aku sarj kapasitesi testi, terminal temizligi ve elektrik sistemi genel kontrolu.',
        price: 200,
        originalPrice: null,
        campaignId: null,
        bakimItemId: 'bk-6',
        category: 'bakim',
        includedItems: [
            { label: 'Sarj Testi', icon: '🔌' },
            { label: 'Terminal Temizligi', icon: '🧹' },
            { label: 'Elektrik Kontrolu', icon: '⚡' },
        ],
        estimatedDuration: '20-30 dk',
        guarantee: '1 ay',
        provider: {
            id: 'engin-electric', name: 'Engin Oto Elektrik', initials: 'EO',
            rating: 4.5, reviews: 89, distance: '3.4 km',
        },
        tags: ['Standart'],
    },
];

export const PAYMENT_METHODS = [
    { id: 'kredi-karti', label: 'Kredi Karti', icon: '💳', description: 'Visa, Mastercard, Troy' },
    { id: 'kapida', label: 'Kapida Odeme', icon: '🏪', description: 'Serviste nakit veya kart' },
    { id: 'havale', label: 'Havale / EFT', icon: '🏦', description: 'Banka havalesi' },
];

// ── Helper fonksiyonlar ──

export function findPackageByCampaignId(campaignId) {
    return SERVICE_PACKAGES.find(p => p.campaignId === campaignId) || null;
}

export function findPackageByBakimItemId(bakimItemId) {
    return SERVICE_PACKAGES.find(p => p.bakimItemId === bakimItemId) || null;
}

export function findPackageById(packageId) {
    return SERVICE_PACKAGES.find(p => p.id === packageId) || null;
}

export function createOrder(pkg, vehicle, slot, paymentMethodId) {
    const method = PAYMENT_METHODS.find(m => m.id === paymentMethodId);
    return {
        id: `ORD-${Date.now()}`,
        packageId: pkg.id,
        packageTitle: pkg.title,
        packageIcon: pkg.icon,
        price: pkg.price,
        originalPrice: pkg.originalPrice,
        provider: pkg.provider,
        vehicle: { plate: vehicle.plate, model: vehicle.model },
        slot: slot ? { day: slot.day, ranges: slot.ranges } : null,
        paymentMethod: paymentMethodId,
        paymentLabel: method?.label || paymentMethodId,
        status: 'confirmed',
        createdAt: new Date().toISOString(),
    };
}
