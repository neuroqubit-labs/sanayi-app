import { useState, useMemo } from 'react';
import { getProgress, getActiveStepIndex, CASE_STATUSES } from '../data/lifecycleEngine';
import { getOrders } from './useCheckoutState';
import { useCaseState } from './useCaseState';

const DEMO_CASE_IDS = [
    'demo_mekanik',
    'demo_kaza',
    'demo_bakim',
    'demo_pool',
    'demo_completed_bakim',
    'demo_completed_hasar',
];

const ACTIVE_STATUSES = new Set([
    CASE_STATUSES.DRAFT,
    CASE_STATUSES.POOL,
    CASE_STATUSES.QUOTED,
    CASE_STATUSES.ACCEPTED,
    CASE_STATUSES.ACTIVE,
]);

const STATUS_MAP = {
    [CASE_STATUSES.ACTIVE]: { label: 'İşlem Sürüyor', tone: 'warning', badge: 'badge-orange' },
    [CASE_STATUSES.POOL]: { label: 'Havuzda', tone: 'info', badge: 'badge-blue' },
    [CASE_STATUSES.QUOTED]: { label: 'Teklif Geldi', tone: 'success', badge: 'badge-green' },
    [CASE_STATUSES.DRAFT]: { label: 'Taslak', tone: 'neutral', badge: 'badge-purple' },
    [CASE_STATUSES.ACCEPTED]: { label: 'Kabul Edildi', tone: 'info', badge: 'badge-blue' },
    [CASE_STATUSES.COMPLETED]: { label: 'Tamamlandı', tone: 'success', badge: 'badge-green' },
    [CASE_STATUSES.EXPIRED]: { label: 'Süresi Doldu', tone: 'neutral', badge: 'badge-purple' },
};

const COMPLETED_TABS = [
    { id: 'tab-tumu', label: 'Tümü' },
    { id: 'tab-bakim', label: 'Bakım' },
    { id: 'tab-hasar', label: 'Hasar' },
    { id: 'tab-siparis', label: 'Sipariş' },
];

function caseToTabKey(category) {
    if (category === 'mekanik' || category === 'kaza') return 'hasar';
    return 'bakim';
}

function caseToRecord(caseData, sourceId) {
    const status = caseData.status || CASE_STATUSES.ACTIVE;
    const statusInfo = STATUS_MAP[status] || STATUS_MAP[CASE_STATUSES.ACTIVE];
    const progress = getProgress(caseData);
    const activeIdx = getActiveStepIndex(caseData);
    const activeStep = activeIdx !== -1 ? caseData.steps[activeIdx] : null;

    const intakeDesc = caseData.steps?.[0]?.data?.description || '';
    const title = intakeDesc || caseData.label;

    let description = caseData.shop?.name || '';
    if (activeStep && ACTIVE_STATUSES.has(status)) {
        description += description ? ' · ' : '';
        description += activeStep.title;
    }

    const isPoolLike = status === CASE_STATUSES.POOL || status === CASE_STATUSES.QUOTED;
    const route = isPoolLike ? 'screen-vaka-havuz' : 'screen-hasar-takip';
    const navParams = { caseId: sourceId };

    const categoryColors = { mekanik: 'orange', kaza: 'red', bakim: 'green' };

    return {
        id: caseData.id || sourceId,
        type: 'case',
        sourceId,
        category: caseData.category,
        tabKey: caseToTabKey(caseData.category),
        categoryColor: categoryColors[caseData.category] || 'blue',
        title,
        description,
        provider: caseData.shop ? { name: caseData.shop.name, initials: caseData.shop.name?.slice(0, 2)?.toUpperCase() } : null,
        status,
        statusLabel: statusInfo.label,
        statusTone: statusInfo.tone,
        badgeClass: statusInfo.badge,
        progress: ACTIVE_STATUSES.has(status) ? progress : null,
        amount: caseData.payments?.total || null,
        amountLabel: caseData.payments?.total ? `₺${caseData.payments.total.toLocaleString('tr-TR')}` : null,
        date: caseData.steps?.[0]?.date || '',
        sortDate: caseData.createdAt ? new Date(caseData.createdAt) : new Date(),
        route,
        navParams,
    };
}

function orderToRecord(order) {
    const slotLabel = order.slot
        ? `Randevu: ${order.slot.day}`
        : '';
    const description = [order.provider?.name, slotLabel].filter(Boolean).join(' · ');

    return {
        id: order.id,
        type: 'order',
        sourceId: order.id,
        category: 'siparis',
        tabKey: 'siparis',
        categoryColor: 'blue',
        title: order.packageTitle,
        description,
        provider: order.provider ? { name: order.provider.name, initials: order.provider.initials } : null,
        status: order.status || 'confirmed',
        statusLabel: 'Onaylandı',
        statusTone: 'info',
        badgeClass: 'badge-blue',
        progress: null,
        amount: order.price,
        amountLabel: `₺${order.price?.toLocaleString('tr-TR')}`,
        date: order.createdAt ? new Date(order.createdAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' }) : '',
        sortDate: order.createdAt ? new Date(order.createdAt) : new Date(),
        route: 'screen-siparis-onay',
        navParams: { orderId: order.id },
    };
}

export function useKayitlarViewModel() {
    const { caseData: mekanik } = useCaseState('demo_mekanik');
    const { caseData: kaza } = useCaseState('demo_kaza');
    const { caseData: bakim } = useCaseState('demo_bakim');
    const { caseData: pool } = useCaseState('demo_pool');
    const { caseData: completedBakim } = useCaseState('demo_completed_bakim');
    const { caseData: completedHasar } = useCaseState('demo_completed_hasar');

    const [activeTab, setActiveTab] = useState('tab-tumu');

    return useMemo(() => {
        const caseEntries = [
            { data: mekanik, id: 'demo_mekanik' },
            { data: kaza, id: 'demo_kaza' },
            { data: bakim, id: 'demo_bakim' },
            { data: pool, id: 'demo_pool' },
            { data: completedBakim, id: 'demo_completed_bakim' },
            { data: completedHasar, id: 'demo_completed_hasar' },
        ];

        const caseRecords = caseEntries.map(e => caseToRecord(e.data, e.id));
        const orderRecords = getOrders().map(orderToRecord);
        const allRecords = [...caseRecords, ...orderRecords];

        const activeRecords = allRecords
            .filter(r => r.type === 'case' && ACTIVE_STATUSES.has(r.status))
            .sort((a, b) => b.sortDate - a.sortDate);

        const completedRecords = allRecords
            .filter(r =>
                (r.type === 'case' && r.status === CASE_STATUSES.COMPLETED) ||
                r.type === 'order'
            )
            .sort((a, b) => b.sortDate - a.sortDate);

        const filteredCompleted = activeTab === 'tab-tumu'
            ? completedRecords
            : completedRecords.filter(r => r.tabKey === activeTab.replace('tab-', ''));

        return {
            activeRecords,
            activeCount: activeRecords.length,
            completedRecords,
            completedTabs: COMPLETED_TABS,
            activeTab,
            setActiveTab,
            filteredCompleted,
        };
    }, [mekanik, kaza, bakim, pool, completedBakim, completedHasar, activeTab]);
}
