/**
 * Quote & Request Data — Mock veri yapilari ve demo verileri
 */

// ─── Demo Case (Havuzdaki vaka) ───
export const DEMO_POOL_CASE = {
    id: 'case_pool_001',
    blueprintId: 'mekanik_standart',
    label: 'Mekanik Ariza',
    category: 'mekanik',
    color: 'orange',
    status: 'pool',
    vehicle: { plate: '34 ABC 42', model: 'BMW 3 Serisi' },
    shop: null,
    intakeData: {
        description: 'Soguk calistirmada motordan metalik ses geliyor, 30 saniye sonra azaliyor.',
        hasarType: 'ses',
        urgency: 'medium',
        mediaCount: 2,
    },
    aiInsights: {
        category: 'Motor',
        estimatedCost: { min: 2000, max: 3500 },
        urgency: 'Orta oncelik',
        summary: 'Zamanlama zinciri ve ust kapak tarafinda inceleme oneriliyor.',
    },
    createdAt: '2026-04-16T10:00:00Z',
};

// ──��� Demo Quote Requests ───
export const DEMO_QUOTE_REQUESTS = [
    {
        id: 'qr_001',
        caseId: 'case_pool_001',
        providerId: 'autopro',
        providerName: 'AutoPro Servis',
        status: 'quoted',
        sentAt: '2026-04-16T10:30:00Z',
        message: 'Zaman: Bu hafta\nTeslimat: Aracimi goturebilirim',
        customerSlots: [
            { day: '2026-04-17', ranges: ['morning', 'afternoon'] },
            { day: '2026-04-18', ranges: ['morning'] },
        ],
        availability: 'Aracimi goturebilirim',
    },
    {
        id: 'qr_002',
        caseId: 'case_pool_001',
        providerId: 'sariyer-motor',
        providerName: 'Sariyer Motor',
        status: 'pending',
        sentAt: '2026-04-16T11:00:00Z',
        message: '',
        customerSlots: [
            { day: '2026-04-19', ranges: ['flexible'] },
        ],
        availability: 'Pickup / cikarsa getirilsin',
    },
];

// ─── Demo Quotes ───
export const DEMO_QUOTES = [
    {
        id: 'q_001',
        requestId: 'qr_001',
        caseId: 'case_pool_001',
        providerId: 'autopro',
        providerName: 'AutoPro Servis',
        providerInitials: 'AP',
        providerRating: 4.8,
        providerReviews: 127,
        items: [
            { name: 'Teshis & OBD Tarama', price: 0 },
            { name: 'Zamanlama Zincir Kiti', price: 1600 },
            { name: 'Zincir Gergisi', price: 350 },
            { name: 'Iscilik', price: 1200 },
        ],
        total: 3150,
        timeline: '1-2 gun',
        guarantee: '6 ay / 10.000 km',
        validUntil: '2026-04-20',
        terms: 'On teshis ucretsiz. Parca faturasi paylasılır. Ek is cikarsa onceden onay alinir.',
        providerNote: 'BMW zincir islerinde 8 yillik tecrube. Gereksiz buyutmeden ilerleriz.',
        aiCompatibilityScore: 92,
        trustBadges: [
            { label: 'Garanti belgeli', tone: 'success' },
            { label: 'Fatura disiplini guclu', tone: 'info' },
        ],
        providerSlot: {
            day: '2026-04-17',
            range: 'morning',
            time: 'Persembe, 17 Nis — Sabah (09:00 – 12:00)',
            dayLabel: 'Persembe, 17 Nis',
        },
        status: 'pending',
        sentAt: '2026-04-16T12:00:00Z',
    },
    {
        id: 'q_002',
        requestId: null,
        caseId: 'case_pool_001',
        providerId: 'engin-electric',
        providerName: 'Engin Oto Elektrik',
        providerInitials: 'EO',
        providerRating: 4.5,
        providerReviews: 89,
        items: [
            { name: 'Detayli Ariza Teshisi', price: 250 },
            { name: 'Sensor Kontrol Seti', price: 400 },
            { name: 'Olasi Zincir Kiti', price: 1400 },
            { name: 'Iscilik', price: 900 },
        ],
        total: 2950,
        timeline: 'Ayni gun teshis, 2-3 gun onarim',
        guarantee: '3 ay iscilik',
        validUntil: '2026-04-19',
        terms: 'Once teshis yapilir. Teshis sonrasi kesin fiyat bildirilir. Fark cikarsa onay istenir.',
        providerNote: 'Elektronik tarafli ihtimalleri de eliyoruz. Kesin sonuc teshis sonrasi netlesir.',
        aiCompatibilityScore: 78,
        trustBadges: [
            { label: 'Hizli teklif', tone: 'warning' },
            { label: 'Belgeli teshis', tone: 'neutral' },
        ],
        providerSlot: {
            day: '2026-04-19',
            range: 'afternoon',
            time: 'Cumartesi, 19 Nis — Ogle (12:00 – 15:00)',
            dayLabel: 'Cumartesi, 19 Nis',
        },
        status: 'pending',
        sentAt: '2026-04-16T14:00:00Z',
    },
];

// ─── Cancellation Policy ───
export const CANCELLATION_POLICY = `Iptal Politikasi

1. Onay sonrasi 24 saat icinde ucretsiz iptal hakkina sahipsiniz.
2. 24 saat sonrasi iptal durumunda, teshis masrafi (varsa) tahsil edilir.
3. Parca siparisi verildikten sonra iptal halinde, siparis edilen parca bedeli iade edilmez.
4. Usta randevusuna gitmemek (no-show) durumunda 200 TL cezai bedel uygulanir.
5. Usta tarafindan iptal durumunda, herhangi bir ucret talep edilmez.`;
