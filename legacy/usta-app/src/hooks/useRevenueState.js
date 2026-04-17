import { useState, useMemo } from 'react';
import { REVENUE_RECORDS } from '../data/ustaData';

const PERIOD_TABS = [
    { id: 'all', label: 'Tümü' },
    { id: 'month', label: 'Bu Ay' },
    { id: 'week', label: 'Bu Hafta' },
];

export function useRevenueState() {
    const [periodTab, setPeriodTab] = useState('all');

    return useMemo(() => {
        const now = new Date();
        const weekAgo = new Date(now.getTime() - 7 * 86400000);
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

        const filtered = REVENUE_RECORDS.filter(r => {
            if (periodTab === 'all') return true;
            const d = new Date(r.date);
            if (periodTab === 'week') return d >= weekAgo;
            if (periodTab === 'month') return d >= monthStart;
            return true;
        });

        const totalGross = filtered.reduce((sum, r) => sum + r.gross, 0);
        const totalCommission = filtered.reduce((sum, r) => sum + r.commission, 0);
        const totalNet = filtered.reduce((sum, r) => sum + r.net, 0);
        const totalReceived = filtered.reduce((sum, r) => sum + r.receivedAmount, 0);
        const pendingAmount = totalGross - totalReceived;

        const receivedRecords = filtered.filter(r => r.paymentStatus === 'received');
        const pendingRecords = filtered.filter(r => r.paymentStatus !== 'received');

        return {
            records: filtered,
            receivedRecords,
            pendingRecords,
            periodTabs: PERIOD_TABS,
            periodTab,
            setPeriodTab,
            totalGross,
            totalCommission,
            totalNet,
            totalReceived,
            pendingAmount,
            jobCount: filtered.length,
        };
    }, [periodTab]);
}
