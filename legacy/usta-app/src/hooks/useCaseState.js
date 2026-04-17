import { useState, useCallback } from 'react';
import {
    createCase,
    completeStep as engineComplete,
    proposeStep as engineProposeStep,
    approveStepProposal as engineApproveStepProposal,
    rejectStepProposal as engineRejectStepProposal,
    retractStepProposal as engineRetractStepProposal,
    counterProposeStep as engineCounterProposeStep,
    payStep as enginePay,
    updateStepData as engineUpdate,
    advanceCaseStatus,
    activateCase as engineActivate,
    addEvidence as engineAddEvidence,
    verifyEvidence as engineVerifyEvidence,
    confirmStep as engineConfirmStep,
    raiseDispute as engineRaiseDispute,
    resolveDispute as engineResolveDispute,
    makePayment as engineMakePayment,
    confirmPayment as engineConfirmPayment,
    addAdditionalCost as engineAddAdditionalCost,
    approveAdditionalCost as engineApproveAdditionalCost,
    rejectAdditionalCost as engineRejectAdditionalCost,
    CASE_STATUSES,
} from '@shared/data/lifecycleEngine';

const STORAGE_PREFIX = 'usta_case_';

// Usta demo cases — same cases as customer app but from usta (AutoPro Servis) perspective
const DEMO_CASES = {
    usta_demo_mekanik: () => {
        const c = createCase('mekanik_standart',
            { plate: '34 ABC 42', model: 'BMW 3 Serisi' },
            { name: 'AutoPro Servis' },
            { intakeDate: '5 Nisan, 10:32', totalCost: 2400, intakeData: { description: 'Soğuk çalıştırmada metalik vuruntu sesi', media: ['hasar_1.jpg'] } }
        );
        c.status = CASE_STATUSES.ACTIVE;
        // intake — done
        c.steps[0] = { ...c.steps[0], status: 'done', date: '5 Nis, 10:32', data: { description: 'Soğuk çalıştırmada metalik vuruntu sesi', media: ['hasar_1.jpg', 'video_1.mp4'] },
            evidence: [
                { id: 'ev_m01', type: 'photo', url: 'hasar_1.jpg', uploadedBy: 'customer', uploadedAt: '2026-04-05T10:32:00Z', description: 'Motor bölmesi genel görünüm', verified: true },
                { id: 'ev_m02', type: 'video', url: 'video_1.mp4', uploadedBy: 'customer', uploadedAt: '2026-04-05T10:33:00Z', description: 'Soğuk çalıştırma ses kaydı', verified: true },
            ],
            confirmation: { shopConfirmed: true, shopConfirmedAt: '2026-04-05T11:00:00Z', customerConfirmed: true, customerConfirmedAt: '2026-04-05T10:32:00Z' },
        };
        // diagnosis — done with evidence
        c.steps[1] = { ...c.steps[1], status: 'done', date: '6 Nis, 09:15', data: { faultCodes: ['P0012'], notes: 'Camshaft Position Timing Over-Retarded. Zamanlama gergisi basınç kaçırıyor.' },
            evidence: [
                { id: 'ev_m03', type: 'fault_codes', url: '', uploadedBy: 'shop', uploadedAt: '2026-04-06T09:15:00Z', description: 'P0012 — Camshaft Position Timing', verified: true },
                { id: 'ev_m04', type: 'photo', url: 'diag_1.jpg', uploadedBy: 'shop', uploadedAt: '2026-04-06T09:20:00Z', description: 'OBD tarama ekranı', verified: true },
            ],
            confirmation: { shopConfirmed: true, shopConfirmedAt: '2026-04-06T09:15:00Z', customerConfirmed: true, customerConfirmedAt: '2026-04-06T10:00:00Z' },
        };
        // quote — done with evidence
        c.steps[2] = { ...c.steps[2], status: 'done', date: '6 Nis, 14:00', data: { items: [{ name: 'Zincir Kiti (Orijinal)', price: 1600 }, { name: 'İşçilik', price: 800 }] },
            evidence: [
                { id: 'ev_m05', type: 'itemized_list', url: '', uploadedBy: 'shop', uploadedAt: '2026-04-06T14:00:00Z', description: 'Detaylı teklif kalemi', verified: true },
            ],
            confirmation: { shopConfirmed: true, shopConfirmedAt: '2026-04-06T14:00:00Z', customerConfirmed: true, customerConfirmedAt: '2026-04-07T14:10:00Z' },
        };
        // approval — done
        c.steps[3] = { ...c.steps[3], status: 'done', date: '7 Nis, 14:10', data: { approved: true },
            confirmation: { shopConfirmed: true, shopConfirmedAt: '2026-04-07T14:10:00Z', customerConfirmed: true, customerConfirmedAt: '2026-04-07T14:10:00Z' },
        };
        // parts — done with invoice evidence
        c.steps[4] = { ...c.steps[4], status: 'done', date: '8 Nis, 10:00', data: { invoiceUploaded: true, partName: 'Zincir Kiti (Orijinal BMW)', invoiceAmount: 1600 },
            evidence: [
                { id: 'ev_m06', type: 'invoice', url: 'invoice_parts.pdf', uploadedBy: 'shop', uploadedAt: '2026-04-08T10:00:00Z', description: 'Zincir Kiti faturası — ₺1.600', verified: true },
                { id: 'ev_m07', type: 'photo', url: 'parts_box.jpg', uploadedBy: 'shop', uploadedAt: '2026-04-08T10:05:00Z', description: 'Orijinal parça kutusu', verified: false },
            ],
            confirmation: { shopConfirmed: true, shopConfirmedAt: '2026-04-08T10:00:00Z', customerConfirmed: true, customerConfirmedAt: '2026-04-08T10:30:00Z' },
        };
        // repair — active, partial evidence, no confirmation yet
        c.steps[5] = { ...c.steps[5], status: 'active', date: 'Bugün, 09:00', data: { liveUpdate: 'Motor üst kapağı açıldı. Yeni kit montajlanıyor.', photos: 2, videos: 1 },
            evidence: [
                { id: 'ev_m08', type: 'photo', url: 'repair_1.jpg', uploadedBy: 'shop', uploadedAt: '2026-04-16T09:30:00Z', description: 'Motor üst kapağı açıldı', verified: false },
                { id: 'ev_m09', type: 'photo', url: 'repair_2.jpg', uploadedBy: 'shop', uploadedAt: '2026-04-16T10:15:00Z', description: 'Eski zincir çıkarıldı', verified: false },
            ],
            confirmation: { shopConfirmed: false, shopConfirmedAt: null, customerConfirmed: false, customerConfirmedAt: null },
        };
        c.payments = {
            total: 2400,
            schedule: [
                { id: 'pay_001', type: 'deposit', label: 'Ön Ödeme', amount: 800, stepIndex: 3, method: 'platform', paidByCustomer: true, confirmedByShop: true, paidAt: '2026-04-07T14:10:00Z', confirmedAt: '2026-04-07T14:10:00Z', paid: true },
                { id: 'pay_002', type: 'interim', label: 'Ara Ödeme', amount: 1000, stepIndex: 5, method: null, paidByCustomer: false, confirmedByShop: false, paidAt: null, confirmedAt: null, paid: false },
                { id: 'pay_003', type: 'final', label: 'Kalan Bakiye', amount: 600, stepIndex: 7, method: null, paidByCustomer: false, confirmedByShop: false, paidAt: null, confirmedAt: null, paid: false },
            ],
            additionalCosts: [],
            history: [
                { action: 'payment_made', paymentId: 'pay_001', amount: 800, method: 'platform', actor: 'customer', timestamp: '2026-04-07T14:10:00Z', note: '' },
            ],
        };
        return c;
    },

    usta_demo_bakim: () => {
        const c = createCase('bakim_basit',
            { plate: '06 XYZ 77', model: 'Toyota Corolla' },
            { name: 'AutoPro Servis' },
            { intakeDate: '8 Nisan, 08:00', totalCost: 850, intakeData: { description: 'Periyodik yağ + filtre değişimi', km: '42.100' } }
        );
        c.status = CASE_STATUSES.ACTIVE;
        c.steps[0] = { ...c.steps[0], status: 'done', date: '8 Nis, 08:00', data: { description: 'Periyodik yağ + filtre değişimi', km: '42.100' },
            evidence: [{ id: 'ev_b01', type: 'note', url: '', uploadedBy: 'customer', uploadedAt: '2026-04-08T08:00:00Z', description: '42.100 km bakım talebi', verified: true }],
            confirmation: { shopConfirmed: true, shopConfirmedAt: '2026-04-08T08:00:00Z', customerConfirmed: true, customerConfirmedAt: '2026-04-08T08:00:00Z' },
        };
        c.steps[1] = { ...c.steps[1], status: 'active', date: '9 Nis, 10:00', data: { confirmed: true } };
        c.payments = {
            total: 850,
            schedule: [
                { id: 'pay_b01', type: 'full', label: 'Toplam', amount: 850, stepIndex: 3, method: null, paidByCustomer: false, confirmedByShop: false, paidAt: null, confirmedAt: null, paid: false },
            ],
            additionalCosts: [],
            history: [],
        };
        return c;
    },

    usta_demo_pool: () => {
        const c = createCase('mekanik_standart',
            { plate: '34 ABC 42', model: 'BMW 3 Serisi' },
            null,
            { intakeDate: '16 Nis, 10:00', totalCost: 0, intakeData: { description: 'Soğuk çalıştırmada motordan metalik ses geliyor', media: ['hasar_1.jpg'] } }
        );
        c.status = CASE_STATUSES.POOL;
        c.shop = null;
        c.steps[0] = { ...c.steps[0], status: 'done', date: '16 Nis, 10:00' };
        c.steps[1] = { ...c.steps[1], status: 'pending' };
        return c;
    },

    usta_demo_completed_1: () => {
        const c = createCase('bakim_basit',
            { plate: '34 ABC 42', model: 'BMW 3 Serisi' },
            { name: 'AutoPro Servis' },
            { intakeDate: '14 Mar, 09:00', totalCost: 2850, intakeData: { description: 'Periyodik Bakım — Yağ filtresi, hava filtresi, buji değişimi', km: '87.400' } }
        );
        c.status = CASE_STATUSES.COMPLETED;
        c.createdAt = '2026-03-14T09:00:00.000Z';
        c.completedAt = '2026-03-14T17:00:00.000Z';
        c.steps.forEach((step, i) => {
            c.steps[i] = { ...step, status: 'done', date: '14 Mar',
                evidence: step.owner === 'shop' ? [
                    { id: `ev_c1_${i}`, type: 'photo', url: `completed1_${i}.jpg`, uploadedBy: 'shop', uploadedAt: '2026-03-14T12:00:00Z', description: 'İşlem fotoğrafı', verified: true },
                ] : [],
                confirmation: { shopConfirmed: true, shopConfirmedAt: '2026-03-14T12:00:00Z', customerConfirmed: true, customerConfirmedAt: '2026-03-14T12:30:00Z' },
            };
        });
        c.steps[c.steps.length - 1] = {
            ...c.steps[c.steps.length - 1],
            status: 'done',
            date: '14 Mar, 17:00',
            data: { description: 'Araç teslim edildi' },
            evidence: [{ id: 'ev_c1_del', type: 'photo', url: 'teslim_1.jpg', uploadedBy: 'shop', uploadedAt: '2026-03-14T17:00:00Z', description: 'Araç teslim anı', verified: true }],
            confirmation: { shopConfirmed: true, shopConfirmedAt: '2026-03-14T17:00:00Z', customerConfirmed: true, customerConfirmedAt: '2026-03-14T17:05:00Z' },
        };
        c.payments = {
            total: 2850,
            schedule: [{ id: 'pay_c101', type: 'full', label: 'Toplam', amount: 2850, stepIndex: 3, method: 'cash', paidByCustomer: true, confirmedByShop: true, paidAt: '2026-03-14T17:00:00Z', confirmedAt: '2026-03-14T17:00:00Z', paid: true }],
            additionalCosts: [],
            history: [
                { action: 'payment_made', paymentId: 'pay_c101', amount: 2850, method: 'cash', actor: 'customer', timestamp: '2026-03-14T17:00:00Z', note: '' },
                { action: 'payment_confirmed', paymentId: 'pay_c101', amount: 2850, method: 'cash', actor: 'shop', timestamp: '2026-03-14T17:00:00Z', note: '' },
            ],
        };
        c.review = {
            rating: 5,
            comment: 'Harika iş çıkardılar. Zamanında teslim, temiz servis. Kesinlikle tekrar gelirim.',
            customerName: 'Alfonso R.',
            date: '2026-03-15',
        };
        return c;
    },

    usta_demo_completed_2: () => {
        const c = createCase('kaza_sigortasiz',
            { plate: '34 DEF 88', model: 'Mercedes C180' },
            { name: 'AutoPro Servis' },
            { intakeDate: '15 Kas, 14:30', totalCost: 3200, intakeData: { description: 'Arka Sol Kapı Çizik — Kaporta boya' } }
        );
        c.status = CASE_STATUSES.COMPLETED;
        c.createdAt = '2025-11-15T14:30:00.000Z';
        c.completedAt = '2025-11-18T16:00:00.000Z';
        c.steps.forEach((step, i) => {
            c.steps[i] = { ...step, status: 'done', date: 'Kas 2025',
                evidence: step.owner === 'shop' ? [
                    { id: `ev_c2_${i}`, type: 'photo', url: `completed2_${i}.jpg`, uploadedBy: 'shop', uploadedAt: '2025-11-16T12:00:00Z', description: 'İşlem fotoğrafı', verified: true },
                ] : [],
                confirmation: { shopConfirmed: true, shopConfirmedAt: '2025-11-16T12:00:00Z', customerConfirmed: true, customerConfirmedAt: '2025-11-16T12:30:00Z' },
            };
        });
        const ratingIdx = c.steps.findIndex(s => s.templateId === 'rating');
        if (ratingIdx !== -1) {
            c.steps[ratingIdx] = {
                ...c.steps[ratingIdx],
                status: 'done',
                date: '18 Kas, 16:00',
                data: { rating: 4, comment: 'Boya rengi tam tutmuş, güzel iş.' },
                evidence: [{ id: 'ev_c2_rating', type: 'note', url: '', uploadedBy: 'customer', uploadedAt: '2025-11-18T16:00:00Z', description: 'Müşteri değerlendirmesi', verified: true }],
                confirmation: { shopConfirmed: true, shopConfirmedAt: '2025-11-18T16:00:00Z', customerConfirmed: true, customerConfirmedAt: '2025-11-18T16:00:00Z' },
            };
        }
        c.payments = {
            total: 3200,
            schedule: [{ id: 'pay_c201', type: 'full', label: 'Toplam', amount: 3200, stepIndex: 7, method: 'bank_transfer', paidByCustomer: true, confirmedByShop: true, paidAt: '2025-11-18T15:00:00Z', confirmedAt: '2025-11-18T15:30:00Z', paid: true }],
            additionalCosts: [],
            history: [
                { action: 'payment_made', paymentId: 'pay_c201', amount: 3200, method: 'bank_transfer', actor: 'customer', timestamp: '2025-11-18T15:00:00Z', note: '' },
                { action: 'payment_confirmed', paymentId: 'pay_c201', amount: 3200, method: 'bank_transfer', actor: 'shop', timestamp: '2025-11-18T15:30:00Z', note: '' },
            ],
        };
        c.review = {
            rating: 4,
            comment: 'Boya rengi tam tutmuş, güzel iş. Teslim biraz gecikti ama sonuç kaliteli.',
            customerName: 'Hakan T.',
            date: '2025-11-18',
        };
        return c;
    },
};

export function useCaseState(caseId = 'usta_demo_mekanik') {
    const storageKey = STORAGE_PREFIX + caseId;

    const [caseData, setCaseData] = useState(() => {
        const saved = localStorage.getItem(storageKey);
        if (saved) {
            try { return JSON.parse(saved); } catch { /* fall through */ }
        }
        const demoFactory = DEMO_CASES[caseId];
        if (demoFactory) return demoFactory();
        return DEMO_CASES.usta_demo_mekanik();
    });

    const persist = useCallback((newData) => {
        setCaseData(newData);
        localStorage.setItem(storageKey, JSON.stringify(newData));
    }, [storageKey]);

    const doCompleteStep = useCallback((stepIndex, stepData) => {
        persist(engineComplete(caseData, stepIndex, stepData));
    }, [caseData, persist]);

    const doProposeStep = useCallback((afterIndex, def) => {
        persist(engineProposeStep(caseData, afterIndex, def));
    }, [caseData, persist]);

    const doApproveStepProposal = useCallback((stepIndex, opts) => {
        persist(engineApproveStepProposal(caseData, stepIndex, opts));
    }, [caseData, persist]);

    const doRejectStepProposal = useCallback((stepIndex, opts) => {
        persist(engineRejectStepProposal(caseData, stepIndex, opts));
    }, [caseData, persist]);

    const doRetractStepProposal = useCallback((stepIndex, actor) => {
        persist(engineRetractStepProposal(caseData, stepIndex, actor));
    }, [caseData, persist]);

    const doCounterProposeStep = useCallback((stepIndex, payload) => {
        persist(engineCounterProposeStep(caseData, stepIndex, payload));
    }, [caseData, persist]);

    const doPayStep = useCallback((paymentType) => {
        persist(enginePay(caseData, paymentType));
    }, [caseData, persist]);

    const doUpdateStep = useCallback((stepIndex, newData) => {
        persist(engineUpdate(caseData, stepIndex, newData));
    }, [caseData, persist]);

    const doAddEvidence = useCallback((stepIndex, evidenceItem) => {
        persist(engineAddEvidence(caseData, stepIndex, evidenceItem));
    }, [caseData, persist]);

    const doVerifyEvidence = useCallback((stepIndex, evidenceId) => {
        persist(engineVerifyEvidence(caseData, stepIndex, evidenceId));
    }, [caseData, persist]);

    const doConfirmStep = useCallback((stepIndex, actor) => {
        persist(engineConfirmStep(caseData, stepIndex, actor));
    }, [caseData, persist]);

    const doRaiseDispute = useCallback((stepIndex, disputeData) => {
        persist(engineRaiseDispute(caseData, stepIndex, disputeData));
    }, [caseData, persist]);

    const doResolveDispute = useCallback((stepIndex, resolution) => {
        persist(engineResolveDispute(caseData, stepIndex, resolution));
    }, [caseData, persist]);

    const doMakePayment = useCallback((paymentId, method) => {
        persist(engineMakePayment(caseData, paymentId, method));
    }, [caseData, persist]);

    const doConfirmPayment = useCallback((paymentId) => {
        persist(engineConfirmPayment(caseData, paymentId));
    }, [caseData, persist]);

    const doAddAdditionalCost = useCallback((costData) => {
        persist(engineAddAdditionalCost(caseData, costData));
    }, [caseData, persist]);

    const doApproveAdditionalCost = useCallback((costId) => {
        persist(engineApproveAdditionalCost(caseData, costId));
    }, [caseData, persist]);

    const doRejectAdditionalCost = useCallback((costId, reason) => {
        persist(engineRejectAdditionalCost(caseData, costId, reason));
    }, [caseData, persist]);

    const resetCase = useCallback(() => {
        localStorage.removeItem(storageKey);
        const demoFactory = DEMO_CASES[caseId];
        const fresh = demoFactory ? demoFactory() : DEMO_CASES.usta_demo_mekanik();
        setCaseData(fresh);
    }, [storageKey, caseId]);

    const submitToPool = useCallback(() => {
        persist(advanceCaseStatus(caseData, CASE_STATUSES.POOL));
    }, [caseData, persist]);

    const markQuoted = useCallback(() => {
        const current = caseData.status || CASE_STATUSES.ACTIVE;
        if (current === CASE_STATUSES.POOL) {
            persist(advanceCaseStatus(caseData, CASE_STATUSES.QUOTED));
        }
    }, [caseData, persist]);

    const confirmCase = useCallback((shopInfo) => {
        let updated = { ...caseData };
        if (shopInfo) updated.shop = shopInfo;
        updated = { ...updated, status: CASE_STATUSES.ACCEPTED };
        updated = engineActivate(updated);
        persist(updated);
    }, [caseData, persist]);

    return {
        caseData,
        completeStep: doCompleteStep,
        proposeStep: doProposeStep,
        approveStepProposal: doApproveStepProposal,
        rejectStepProposal: doRejectStepProposal,
        retractStepProposal: doRetractStepProposal,
        counterProposeStep: doCounterProposeStep,
        payStep: doPayStep,
        updateStep: doUpdateStep,
        addEvidence: doAddEvidence,
        verifyEvidence: doVerifyEvidence,
        confirmStep: doConfirmStep,
        raiseDispute: doRaiseDispute,
        resolveDispute: doResolveDispute,
        makePayment: doMakePayment,
        confirmPayment: doConfirmPayment,
        addAdditionalCost: doAddAdditionalCost,
        approveAdditionalCost: doApproveAdditionalCost,
        rejectAdditionalCost: doRejectAdditionalCost,
        resetCase,
        submitToPool,
        markQuoted,
        confirmCase,
    };
}
