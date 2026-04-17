import { useMemo } from 'react';
import { getProgress, getActiveStepIndex, CASE_STATUSES } from '@shared/data/lifecycleEngine';
import { useCaseState } from './useCaseState';
import { POOL_JOBS, APPOINTMENTS, REVENUE_RECORDS, USTA_PROFILE, SENT_QUOTES } from '../data/ustaData';

export function useUstaHomeViewModel() {
    const { caseData: mekanik } = useCaseState('usta_demo_mekanik');
    const { caseData: bakim } = useCaseState('usta_demo_bakim');

    return useMemo(() => {
        const activeCases = [
            { data: mekanik, id: 'usta_demo_mekanik' },
            { data: bakim, id: 'usta_demo_bakim' },
        ].filter(e => e.data.status === CASE_STATUSES.ACTIVE);

        const activeJobs = activeCases.map(({ data, id }) => {
            const progress = getProgress(data);
            const activeIdx = getActiveStepIndex(data);
            const activeStep = activeIdx !== -1 ? data.steps[activeIdx] : null;
            const ustaActionNeeded = activeStep?.owner === 'shop';

            // Link appointment to this job
            const appointment = APPOINTMENTS.find(a => a.caseId === id);

            return {
                id,
                title: data.steps?.[0]?.data?.description || data.label,
                vehiclePlate: data.vehicle?.plate || '',
                vehicleModel: data.vehicle?.model || '',
                progress,
                activeStepTitle: activeStep?.title || '',
                activeStepOwner: activeStep?.owner || '',
                ustaActionNeeded,
                category: data.category,
                payments: data.payments,
                appointment: appointment ? {
                    date: appointment.date,
                    time: appointment.time,
                    label: appointment.label,
                    status: appointment.status,
                    isToday: appointment.date === 'Bugün',
                } : null,
            };
        });

        // Priority sort: today's appointment → usta action needed → rest
        activeJobs.sort((a, b) => {
            if (a.appointment?.isToday && !b.appointment?.isToday) return -1;
            if (!a.appointment?.isToday && b.appointment?.isToday) return 1;
            if (a.ustaActionNeeded && !b.ustaActionNeeded) return -1;
            if (!a.ustaActionNeeded && b.ustaActionNeeded) return 1;
            return 0;
        });

        // Standalone appointments (no caseId or not linked to active cases)
        const activeCaseIds = activeCases.map(c => c.id);
        const standaloneAppointments = APPOINTMENTS.filter(
            a => !a.caseId || !activeCaseIds.includes(a.caseId)
        );

        // Pending quotes awaiting customer response
        const pendingQuotes = SENT_QUOTES.filter(q => q.status === 'pending');

        const poolJobCount = POOL_JOBS.filter(j => j.status === 'open').length;

        // Weekly revenue summary
        const weeklyGross = REVENUE_RECORDS
            .filter(r => {
                const d = new Date(r.date);
                const now = new Date();
                const weekAgo = new Date(now.getTime() - 7 * 86400000);
                return d >= weekAgo;
            })
            .reduce((sum, r) => sum + r.gross, 0);

        const pendingCollection = REVENUE_RECORDS
            .filter(r => r.paymentStatus === 'partial' || r.paymentStatus === 'pending')
            .reduce((sum, r) => sum + (r.gross - r.receivedAmount), 0);

        return {
            profile: USTA_PROFILE,
            activeJobs,
            activeJobCount: activeJobs.length,
            poolJobCount,
            pendingQuotes,
            standaloneAppointments,
            weeklyGross,
            pendingCollection,
        };
    }, [mekanik, bakim]);
}
