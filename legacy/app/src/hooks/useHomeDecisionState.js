import { useMemo } from 'react';
import { getActiveStepIndex } from '../data/lifecycleEngine';
import { MATCH_CANDIDATES } from '../data/matchingData';
import { HOME_ACTIVITY_FIXTURES, HOME_HERO_FIXTURES, HOME_SECONDARY_ACTIONS } from '../data/homeFixtures';
import { useCaseState } from './useCaseState';

function getActiveStep(caseData) {
    const activeIndex = getActiveStepIndex(caseData);
    return activeIndex === -1 ? null : caseData.steps[activeIndex];
}

function buildSupportingCards({ mechanicalCase, maintenanceCase, pendingOffers }) {
    const cards = [];

    if (mechanicalCase) {
        cards.push({
            id: 'service-progress',
            tone: 'info',
            eyebrow: 'Devam Eden Is',
            title: `${mechanicalCase.shop.name} sureci ilerletiyor`,
            description: 'Canli guncellemeler, odeme ve kanit zinciri tek yerde.',
            route: 'screen-hasar-takip',
            actionLabel: 'Sureci Ac',
        });
    }

    if (pendingOffers > 0) {
        cards.push({
            id: 'offers',
            tone: 'success',
            eyebrow: 'Karar Hazir',
            title: `${pendingOffers} usta bu vaka icin uygun gorunuyor`,
            description: 'Neden onerildiklerini ve fiyat bandini karsilastir.',
            route: 'screen-ustalar',
            actionLabel: 'Ustalari Gor',
        });
    }

    if (maintenanceCase) {
        cards.push({
            id: 'maintenance',
            tone: 'neutral',
            eyebrow: 'Siradaki Is',
            title: 'Yaklasan bakim penceresi var',
            description: 'Kayitlara gore yag ve filtre tarafinda yeni bir dongu aciliyor.',
            route: 'screen-bakim-flow',
            actionLabel: 'Talep Baslat',
        });
    }

    return cards.slice(0, 2);
}

export function useHomeDecisionState() {
    const { caseData: mechanicalCase } = useCaseState('demo_mekanik');
    const { caseData: maintenanceCase } = useCaseState('demo_bakim');
    const { caseData: collisionCase } = useCaseState('demo_kaza');

    return useMemo(() => {
        const mechanicalActive = getActiveStep(mechanicalCase);
        const maintenanceActive = getActiveStep(maintenanceCase);
        const collisionActive = getActiveStep(collisionCase);

        const activeTow = false;
        const pendingOffers = MATCH_CANDIDATES.filter(candidate => candidate.reason.label === 'Sana teklif gonderdi').length;
        const hasServiceApproval = [mechanicalActive, collisionActive].some(step => step?.templateId === 'approval');
        const hasServiceProgress = [mechanicalActive, collisionActive].some(step =>
            ['repair', 'service', 'parts', 'diagnosis', 'insurance_file', 'test'].includes(step?.templateId)
        );
        const hasUpcomingMaintenance = Boolean(maintenanceActive);

        let hero = HOME_HERO_FIXTURES.calm;
        let metrics = [];

        if (activeTow) {
            hero = HOME_HERO_FIXTURES.tow;
            metrics = [
                { label: 'Tahmini varis', value: '11 dk' },
                { label: 'Dogrulama', value: 'Surucu onayli' },
            ];
        } else if (hasServiceApproval) {
            hero = HOME_HERO_FIXTURES.approval;
            metrics = [
                { label: 'Onay bekleyen', value: '1 adim' },
                { label: 'Tahmini fark', value: '800 TL' },
            ];
        } else if (hasServiceProgress) {
            hero = HOME_HERO_FIXTURES.process;
            metrics = [
                { label: 'Aktif is', value: mechanicalCase.shop.name },
                { label: 'Son durum', value: mechanicalActive?.title || 'Surec isliyor' },
            ];
        } else if (pendingOffers > 0) {
            hero = HOME_HERO_FIXTURES.offer;
            metrics = [
                { label: 'Hazir teklif', value: `${pendingOffers}` },
                { label: 'En hizli yanit', value: '2 dk' },
            ];
        } else if (hasUpcomingMaintenance) {
            hero = HOME_HERO_FIXTURES.maintenance;
            metrics = [
                { label: 'Kilometre', value: '87.400 km' },
                { label: 'Siradaki is', value: maintenanceActive?.title || 'Bakim plani' },
            ];
        }

        const supportingCards = buildSupportingCards({
            mechanicalCase,
            maintenanceCase,
            pendingOffers,
        });

        return {
            hero: {
                ...hero,
                metrics,
                statusLabel: hero.eyebrow,
                slot: { key: 'home-match-swipe', enabled: false },
            },
            recentItems: HOME_ACTIVITY_FIXTURES,
            secondaryActions: HOME_SECONDARY_ACTIONS,
            supportingCards,
            caseSnapshot: {
                vehicleLabel: '34 ABC 42 · BMW 3 Serisi',
                issueLabel: 'Motor sesi vakasi',
                maintenanceLabel: hasUpcomingMaintenance ? 'Bakim hazir' : 'Kayitlar guncel',
            },
        };
    }, [collisionCase, maintenanceCase, mechanicalCase]);
}
