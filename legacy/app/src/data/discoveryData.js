/**
 * Discovery Feed Data - Sponsorlu içerik, kampanyalar, öne çıkan ustalar
 */

export const FEATURED_MASTERS = [
    {
        id: 'master-1',
        name: 'AutoPro Servis',
        avatar: '🔧',
        rating: 4.9,
        specialty: 'BMW Uzmanı',
        discount: '%15 İndirim',
        badge: 'Sponsorlu',
        isServis: true,
        route: 'screen-usta-profil',
    },
    {
        id: 'master-2',
        name: 'Mekanik Mehmet',
        avatar: '⚙️',
        rating: 4.8,
        specialty: 'Motor Uzmanı',
        discount: null,
        badge: 'Öne Çıkan',
        route: 'screen-usta-profil',
    },
    {
        id: 'master-3',
        name: 'Hızlı Tamir',
        avatar: '🚗',
        rating: 4.7,
        specialty: 'Hızlı Servis',
        discount: 'İlk Müşteri %20',
        badge: null,
        isServis: true,
        route: 'screen-usta-profil',
    },
];

export const CAMPAIGNS = [
    {
        id: 'campaign-1',
        icon: '🔧',
        title: 'Yaz Bakımı Paketi',
        description: 'Yağ + Filtre + Klima Kontrolü',
        originalPrice: 899,
        newPrice: 699,
        route: 'screen-ustalar',
    },
    {
        id: 'campaign-2',
        icon: '🛞',
        title: 'Lastik Değişim Kampanyası',
        description: '4 Lastik Montaj + Balans',
        originalPrice: 1200,
        newPrice: 999,
        route: 'screen-ustalar',
    },
    {
        id: 'campaign-3',
        icon: '🔋',
        title: 'Akü + Elektrik Kontrolü',
        description: 'Ücretsiz test + %10 indirim',
        originalPrice: null,
        newPrice: 0,
        route: 'screen-ustalar',
    },
];

export const NEARBY_SERVICES = [
    {
        id: 'nearby-1',
        name: 'Oto Tamir',
        distance: '500m',
        rating: 4.9,
        tags: ['Hızlı', 'BMW'],
        route: 'screen-usta-profil',
    },
    {
        id: 'nearby-2',
        name: 'Express Servis',
        distance: '1.2km',
        rating: 4.8,
        tags: ['24 Saat', 'Çekici'],
        route: 'screen-usta-profil',
    },
    {
        id: 'nearby-3',
        name: 'Pro Mekanik',
        distance: '2.1km',
        rating: 4.7,
        tags: ['Garantili', 'Uzman'],
        route: 'screen-usta-profil',
    },
];

export const PROMO_BANNER_IDLE = {
    id: 'promo-idle',
    icon: '📌',
    title: 'Bakımda İndirim Fırsatları',
    subtitle: 'Bu ay 50+ usta özel kampanya sunuyor',
    route: 'screen-ustalar',
};

export const PROMO_BANNER_ACTIVE = {
    id: 'promo-active',
    icon: '⚡',
    title: 'Vakanı çözen ustalara bak',
    subtitle: 'Motor sesi için 12 usta hazır',
    route: 'screen-eslestir',
};
