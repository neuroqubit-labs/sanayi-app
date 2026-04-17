import { useMemo } from 'react';
import { getActiveStepIndex } from '../data/lifecycleEngine';
import { MATCH_CANDIDATES } from '../data/matchingData';
import { HOME_ACTIVITY_FIXTURES } from '../data/homeFixtures';
import { FEATURED_MASTERS, CAMPAIGNS, NEARBY_SERVICES, PROMO_BANNER_IDLE, PROMO_BANNER_ACTIVE } from '../data/discoveryData';
import { useCaseState } from './useCaseState';

function getActiveStep(caseData) {
    const activeIndex = getActiveStepIndex(caseData);
    return activeIndex === -1 ? null : caseData.steps[activeIndex];
}

/**
 * Home View Model
 * Üst katman: CompactStatus (işlevsel)
 * Alt katman: Discovery (keşif)
 */
export function useHomeViewModel() {
    const { caseData: mechanicalCase } = useCaseState('demo_mekanik');
    const { caseData: maintenanceCase } = useCaseState('demo_bakim');
    const { caseData: collisionCase } = useCaseState('demo_kaza');

    return useMemo(() => {
        const mechanicalActive = getActiveStep(mechanicalCase);
        const maintenanceActive = getActiveStep(maintenanceCase);
        const collisionActive = getActiveStep(collisionCase);

        const activeTow = false;
        const pendingOffers = MATCH_CANDIDATES.filter(c => c.reason.label === 'Sana teklif gonderdi').length;
        const hasServiceApproval = [mechanicalActive, collisionActive].some(step => step?.templateId === 'approval');
        const hasServiceProgress = [mechanicalActive, collisionActive].some(step =>
            ['repair', 'service', 'parts', 'diagnosis', 'insurance_file', 'test'].includes(step?.templateId)
        );

        // Vaka var mı?
        const hasActiveCase = Boolean(mechanicalActive || collisionActive || activeTow || hasServiceProgress);

        // --- COMPACT STATUS STATE ---
        let compactState = {
            hasActiveCase: false,
            tone: 'neutral',
            icon: '✅',
            title: 'Her şey yolunda',
            subtitle: 'Aktif vaka yok',
            metrics: [
                { label: 'Son bakım', value: '12 gün önce' },
                { label: 'Sonraki', value: '1.200 km' },
            ],
            actionLabel: null,
            actionRoute: null,
        };

        if (activeTow) {
            compactState = {
                hasActiveCase: true,
                tone: 'urgent',
                icon: '🚛',
                title: 'Çekici yolda',
                subtitle: 'Acil Durum',
                metrics: [
                    { label: 'Tahmini varış', value: '11 dk' },
                    { label: 'Doğrulama', value: 'Onaylı' },
                ],
                actionLabel: 'Çekiciyi Takip Et',
                actionRoute: 'screen-cekici',
            };
        } else if (hasServiceApproval) {
            compactState = {
                hasActiveCase: true,
                tone: 'warning',
                icon: '⚠️',
                title: 'Onay bekleyen adım var',
                subtitle: 'Servisten Onay Gerekli',
                metrics: [
                    { label: 'Bekleyen adım', value: '1 onay' },
                    { label: 'Fark', value: '800 TL' },
                ],
                actionLabel: 'Onayi İncele',
                actionRoute: 'screen-hasar-takip',
            };
        } else if (hasServiceProgress) {
            compactState = {
                hasActiveCase: true,
                tone: 'info',
                icon: '🔄',
                title: 'Servis süreci ilerliyor',
                subtitle: 'İşlem Devam Ediyor',
                metrics: [
                    { label: 'Aktif servis', value: mechanicalCase.shop.name },
                    { label: 'Son durum', value: mechanicalActive?.title || 'İşleniyor' },
                ],
                actionLabel: 'Süreci Aç',
                actionRoute: 'screen-hasar-takip',
            };
        } else if (pendingOffers > 0) {
            compactState = {
                hasActiveCase: true,
                tone: 'success',
                icon: '💬',
                title: 'Yeni teklifler hazır',
                subtitle: 'Teklif Geldi',
                metrics: [
                    { label: 'Hazır teklif', value: `${pendingOffers}` },
                    { label: 'En hızlı', value: '2 dk' },
                ],
                actionLabel: 'Teklifleri İncele',
                actionRoute: 'screen-teklif',
            };
        } else if (maintenanceActive) {
            compactState = {
                hasActiveCase: false,
                tone: 'neutral',
                icon: '🔧',
                title: 'Bakım zamanı yaklaşıyor',
                subtitle: 'Bakım Önerisi',
                metrics: [
                    { label: 'Kilometre', value: '87.400 km' },
                    { label: 'Önerilen', value: 'Yağ değişimi' },
                ],
                actionLabel: 'Bakım Planla',
                actionRoute: 'screen-bakim-flow',
            };
        }

        // --- PROMO BANNER (Above fold'un altında) ---
        const promoBanner = hasActiveCase ? PROMO_BANNER_ACTIVE : PROMO_BANNER_IDLE;

        // --- DISCOVERY FEED (Below fold) ---
        const discoveryFeed = {
            featuredMasters: FEATURED_MASTERS,
            campaigns: CAMPAIGNS.slice(0, 2), // İlk 2 kampanya
            nearbyServices: NEARBY_SERVICES.slice(0, 2), // En yakın 2 servis
        };

        return {
            // Above fold
            compactState,
            recentActivity: HOME_ACTIVITY_FIXTURES.slice(0, 3), // Max 3 item
            promoBanner,
            // Below fold
            discoveryFeed,
            // Meta
            caseSnapshot: {
                vehicleLabel: '34 ABC 42 · BMW 3 Serisi',
                issueLabel: mechanicalActive ? 'Motor sesi vakası' : null,
            },
        };
    }, [collisionCase, maintenanceCase, mechanicalCase]);
}
