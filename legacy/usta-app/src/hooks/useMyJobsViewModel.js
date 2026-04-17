import { useState, useMemo } from 'react';
import { getProgress, getActiveStepIndex, CASE_STATUSES } from '@shared/data/lifecycleEngine';
import { useCaseState } from './useCaseState';
import { REVENUE_RECORDS } from '../data/ustaData';

const ACTIVE_STATUSES = new Set([
    CASE_STATUSES.ACTIVE,
    CASE_STATUSES.ACCEPTED,
]);

const COMPLETED_TABS = [
    { id: 'tab-tumu', label: 'Tümü' },
    { id: 'tab-mekanik', label: 'Mekanik' },
    { id: 'tab-bakim', label: 'Bakım' },
    { id: 'tab-kaza', label: 'Kaza' },
];

function caseToJobRecord(caseData, sourceId) {
    const status = caseData.status || CASE_STATUSES.ACTIVE;
    const progress = getProgress(caseData);
    const activeIdx = getActiveStepIndex(caseData);
    const activeStep = activeIdx !== -1 ? caseData.steps[activeIdx] : null;

    const intakeDesc = caseData.steps?.[0]?.data?.description || '';
    const title = intakeDesc || caseData.label;

    let description = caseData.vehicle?.plate || '';
    if (caseData.vehicle?.model) {
        description += ` · ${caseData.vehicle.model}`;
    }
    if (activeStep && ACTIVE_STATUSES.has(status)) {
        description += ` · ${activeStep.title}`;
    }

    const categoryColors = { mekanik: 'orange', kaza: 'red', bakim: 'green' };

    // Revenue for completed jobs
    const revenue = REVENUE_RECORDS.find(r => r.caseId === sourceId);

    // Step summary for completed jobs (what was done)
    const completedSteps = caseData.steps
        ?.filter(s => s.status === 'done' && s.owner === 'shop')
        .map(s => s.title) || [];

    // Duration (createdAt → completedAt)
    let durationDays = null;
    if (caseData.createdAt && caseData.completedAt) {
        const start = new Date(caseData.createdAt);
        const end = new Date(caseData.completedAt);
        durationDays = Math.ceil((end - start) / 86400000);
    }

    return {
        id: sourceId,
        category: caseData.category,
        categoryColor: categoryColors[caseData.category] || 'blue',
        title,
        description,
        status,
        progress: ACTIVE_STATUSES.has(status) ? progress : null,
        activeStepTitle: activeStep?.title || '',
        amount: caseData.payments?.total || null,
        amountLabel: caseData.payments?.total ? `₺${caseData.payments.total.toLocaleString('tr-TR')}` : null,
        revenue: revenue ? {
            gross: revenue.gross,
            net: revenue.net,
            paymentStatus: revenue.paymentStatus,
        } : null,
        review: caseData.review || null,
        completedSteps,
        completedAt: caseData.completedAt || null,
        durationDays,
        stepCount: caseData.steps?.length || 0,
        sortDate: caseData.createdAt ? new Date(caseData.createdAt) : new Date(),
    };
}

export function useMyJobsViewModel() {
    const { caseData: mekanik } = useCaseState('usta_demo_mekanik');
    const { caseData: bakim } = useCaseState('usta_demo_bakim');
    const { caseData: completed1 } = useCaseState('usta_demo_completed_1');
    const { caseData: completed2 } = useCaseState('usta_demo_completed_2');

    const [activeTab, setActiveTab] = useState('tab-tumu');

    return useMemo(() => {
        const caseEntries = [
            { data: mekanik, id: 'usta_demo_mekanik' },
            { data: bakim, id: 'usta_demo_bakim' },
            { data: completed1, id: 'usta_demo_completed_1' },
            { data: completed2, id: 'usta_demo_completed_2' },
        ];

        const allRecords = caseEntries.map(e => caseToJobRecord(e.data, e.id));

        const activeRecords = allRecords
            .filter(r => ACTIVE_STATUSES.has(r.status))
            .sort((a, b) => b.sortDate - a.sortDate);

        const completedRecords = allRecords
            .filter(r => r.status === CASE_STATUSES.COMPLETED)
            .sort((a, b) => b.sortDate - a.sortDate);

        const filteredCompleted = activeTab === 'tab-tumu'
            ? completedRecords
            : completedRecords.filter(r => r.category === activeTab.replace('tab-', ''));

        // Revenue summary
        const totalRevenue = REVENUE_RECORDS.reduce((sum, r) => sum + r.net, 0);
        const pendingRevenue = REVENUE_RECORDS
            .filter(r => r.paymentStatus !== 'received')
            .reduce((sum, r) => sum + (r.gross - r.receivedAmount), 0);

        // Review summary
        const reviewedJobs = completedRecords.filter(r => r.review);
        const avgRating = reviewedJobs.length > 0
            ? (reviewedJobs.reduce((sum, r) => sum + r.review.rating, 0) / reviewedJobs.length).toFixed(1)
            : null;

        return {
            activeRecords,
            activeCount: activeRecords.length,
            completedRecords,
            completedTabs: COMPLETED_TABS,
            activeTab,
            setActiveTab,
            filteredCompleted,
            totalRevenue,
            pendingRevenue,
            avgRating,
            totalCompleted: completedRecords.length,
        };
    }, [mekanik, bakim, completed1, completed2, activeTab]);
}
