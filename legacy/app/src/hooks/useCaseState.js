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
    BLUEPRINTS,
    STEP_TEMPLATES,
} from '../data/lifecycleEngine';

const STORAGE_PREFIX = 'sanayi_case_';

// Demo cases for prototype — one per category
const DEMO_CASES = {
    demo_mekanik: () => {
        const c = createCase('mekanik_standart',
            { plate: '34 ABC 42', model: 'BMW 3 Serisi' },
            { name: 'AutoPro Servis' },
            { intakeDate: '5 Nisan, 10:32', totalCost: 2400, intakeData: { description: 'Soğuk çalıştırmada metalik vuruntu sesi', media: ['hasar_1.jpg'] } }
        );
        c.status = CASE_STATUSES.ACTIVE;
        c.steps[0] = { ...c.steps[0], status: 'done', date: '5 Nis, 10:32', data: { description: 'Soğuk çalıştırmada metalik vuruntu sesi', media: ['hasar_1.jpg', 'video_1.mp4'] },
            evidence: [
                { id: 'ev_cm01', type: 'photo', url: 'hasar_1.jpg', uploadedBy: 'customer', uploadedAt: '2026-04-05T10:32:00Z', description: 'Motor bölmesi', verified: true },
                { id: 'ev_cm02', type: 'video', url: 'video_1.mp4', uploadedBy: 'customer', uploadedAt: '2026-04-05T10:33:00Z', description: 'Ses kaydı', verified: true },
            ],
            confirmation: { shopConfirmed: true, shopConfirmedAt: '2026-04-05T11:00:00Z', customerConfirmed: true, customerConfirmedAt: '2026-04-05T10:32:00Z' },
        };
        c.steps[1] = { ...c.steps[1], status: 'done', date: '6 Nis, 09:15', data: { faultCodes: ['P0012'], notes: 'Camshaft Position Timing Over-Retarded. Zamanlama gergisi basınç kaçırıyor.' },
            evidence: [
                { id: 'ev_cm03', type: 'fault_codes', url: '', uploadedBy: 'shop', uploadedAt: '2026-04-06T09:15:00Z', description: 'P0012 — Camshaft Timing', verified: true },
                { id: 'ev_cm04', type: 'photo', url: 'diag_1.jpg', uploadedBy: 'shop', uploadedAt: '2026-04-06T09:20:00Z', description: 'OBD ekranı', verified: true },
            ],
            confirmation: { shopConfirmed: true, shopConfirmedAt: '2026-04-06T09:15:00Z', customerConfirmed: true, customerConfirmedAt: '2026-04-06T10:00:00Z' },
        };
        c.steps[2] = { ...c.steps[2], status: 'done', date: '6 Nis, 14:00', data: { items: [{ name: 'Zincir Kiti (Orijinal)', price: 1600 }, { name: 'İşçilik', price: 800 }] },
            evidence: [{ id: 'ev_cm05', type: 'itemized_list', url: '', uploadedBy: 'shop', uploadedAt: '2026-04-06T14:00:00Z', description: 'Detaylı teklif', verified: true }],
            confirmation: { shopConfirmed: true, shopConfirmedAt: '2026-04-06T14:00:00Z', customerConfirmed: true, customerConfirmedAt: '2026-04-07T14:10:00Z' },
        };
        c.steps[3] = { ...c.steps[3], status: 'done', date: '7 Nis, 14:10', data: { approved: true },
            confirmation: { shopConfirmed: true, shopConfirmedAt: '2026-04-07T14:10:00Z', customerConfirmed: true, customerConfirmedAt: '2026-04-07T14:10:00Z' },
        };
        c.steps[4] = { ...c.steps[4], status: 'done', date: '8 Nis, 10:00', data: { invoiceUploaded: true, partName: 'Zincir Kiti (Orijinal BMW)', invoiceAmount: 1600 },
            evidence: [
                { id: 'ev_cm06', type: 'invoice', url: 'invoice_parts.pdf', uploadedBy: 'shop', uploadedAt: '2026-04-08T10:00:00Z', description: 'Zincir Kiti faturası', verified: true },
            ],
            confirmation: { shopConfirmed: true, shopConfirmedAt: '2026-04-08T10:00:00Z', customerConfirmed: true, customerConfirmedAt: '2026-04-08T10:30:00Z' },
        };
        c.steps[5] = { ...c.steps[5], status: 'active', date: 'Bugün, 09:00', data: { liveUpdate: 'Motor üst kapağı açıldı. Yeni kit montajlanıyor.', photos: 2, videos: 1 },
            evidence: [
                { id: 'ev_cm08', type: 'photo', url: 'repair_1.jpg', uploadedBy: 'shop', uploadedAt: '2026-04-16T09:30:00Z', description: 'Motor üst kapağı açıldı', verified: false },
                { id: 'ev_cm09', type: 'photo', url: 'repair_2.jpg', uploadedBy: 'shop', uploadedAt: '2026-04-16T10:15:00Z', description: 'Eski zincir çıkarıldı', verified: false },
            ],
            confirmation: { shopConfirmed: false, shopConfirmedAt: null, customerConfirmed: false, customerConfirmedAt: null },
        };
        c.payments = {
            total: 2400,
            schedule: [
                { id: 'pay_cm01', type: 'deposit', label: 'Ön Ödeme', amount: 800, stepIndex: 3, method: 'platform', paidByCustomer: true, confirmedByShop: true, paidAt: '2026-04-07T14:10:00Z', confirmedAt: '2026-04-07T14:10:00Z', paid: true },
                { id: 'pay_cm02', type: 'interim', label: 'Ara Ödeme', amount: 1000, stepIndex: 5, method: null, paidByCustomer: false, confirmedByShop: false, paidAt: null, confirmedAt: null, paid: false },
                { id: 'pay_cm03', type: 'final', label: 'Kalan Bakiye', amount: 600, stepIndex: 7, method: null, paidByCustomer: false, confirmedByShop: false, paidAt: null, confirmedAt: null, paid: false },
            ],
            additionalCosts: [],
            history: [
                { action: 'payment_made', paymentId: 'pay_cm01', amount: 800, method: 'platform', actor: 'customer', timestamp: '2026-04-07T14:10:00Z', note: '' },
            ],
        };
        return c;
    },

    demo_kaza: () => {
        const c = createCase('kaza_sigortali',
            { plate: '34 ABC 42', model: 'BMW 3 Serisi' },
            { name: 'Serbestoğlu Kaporta' },
            { intakeDate: '3 Nisan, 16:45', totalCost: 8500, intakeData: { description: 'Kavşakta sağdan çarpma, ön tampon ve far hasarı' } }
        );
        c.status = CASE_STATUSES.ACTIVE;
        c.steps[0] = { ...c.steps[0], status: 'done', date: '3 Nis, 16:45', data: { description: 'Kavşakta sağdan çarpma', media: ['kaza_1.jpg', 'kaza_2.jpg'] } };
        c.steps[1] = { ...c.steps[1], status: 'done', date: '3 Nis, 17:00', data: { source: 'edevlet', verified: true } };
        c.steps[2] = {
            ...c.steps[2], status: 'active', date: '4 Nis, 09:00',
            data: {},
            substeps: [
                { id: 'policy_verify', title: 'Poliçe Doğrulama', status: 'done' },
                { id: 'file_open', title: 'Dosya Açma', status: 'done' },
                { id: 'expert_assign', title: 'Eksper Atama', status: 'active' },
            ]
        };
        // rest pending
        c.payments = {
            total: 8500,
            schedule: [
                { type: 'deductible', label: 'Muafiyet / Fark', amount: 1200, stepIndex: 6, paid: false },
            ],
        };
        return c;
    },

    demo_bakim: () => {
        const c = createCase('bakim_basit',
            { plate: '34 ABC 42', model: 'BMW 3 Serisi' },
            { name: 'Mobilservis Güngören' },
            { intakeDate: '8 Nisan, 08:00', totalCost: 850, intakeData: { description: 'Periyodik yağ + filtre değişimi', km: '87.400' } }
        );
        c.status = CASE_STATUSES.ACTIVE;
        c.steps[0] = { ...c.steps[0], status: 'done', date: '8 Nis, 08:00', data: { description: 'Periyodik yağ + filtre değişimi', km: '87.400' } };
        c.steps[1] = { ...c.steps[1], status: 'active', date: '9 Nis, 10:00', data: { confirmed: true } };
        c.payments = {
            total: 850,
            schedule: [
                { type: 'full', label: 'Toplam', amount: 850, stepIndex: 3, paid: false },
            ],
        };
        return c;
    },
    demo_pool: () => {
        const c = createCase('mekanik_standart',
            { plate: '34 ABC 42', model: 'BMW 3 Serisi' },
            null,
            { intakeDate: '16 Nis, 10:00', totalCost: 0, intakeData: { description: 'Soguk calistirmada motordan metalik ses geliyor', media: ['hasar_1.jpg'] } }
        );
        c.status = CASE_STATUSES.POOL;
        c.id = 'case_pool_001';
        c.shop = null;
        c.steps[0] = { ...c.steps[0], status: 'done', date: '16 Nis, 10:00' };
        // All other steps remain pending (no active step yet — process hasn't started)
        c.steps[1] = { ...c.steps[1], status: 'pending' };
        return c;
    },

    demo_completed_bakim: () => {
        const c = createCase('bakim_basit',
            { plate: '34 ABC 42', model: 'BMW 3 Serisi' },
            { name: 'Mobilservis Güngören' },
            { intakeDate: '14 Mar, 09:00', totalCost: 2850, intakeData: { description: 'Periyodik Bakım — Yağ filtresi, hava filtresi, buji değişimi', km: '87.400' } }
        );
        c.status = CASE_STATUSES.COMPLETED;
        c.createdAt = '2026-03-14T09:00:00.000Z';
        c.steps.forEach((step, i) => {
            c.steps[i] = { ...step, status: 'done', date: '14 Mar' };
        });
        c.payments = {
            total: 2850,
            schedule: [{ type: 'full', label: 'Toplam', amount: 2850, stepIndex: 3, paid: true }],
        };
        return c;
    },

    demo_completed_hasar: () => {
        const c = createCase('kaza_sigortasiz',
            { plate: '34 ABC 42', model: 'BMW 3 Serisi' },
            { name: 'Serbestoğlu Kaporta' },
            { intakeDate: '15 Kas, 14:30', totalCost: 3200, intakeData: { description: 'Arka Sol Kapı Çizik — Kaporta boya' } }
        );
        c.status = CASE_STATUSES.COMPLETED;
        c.createdAt = '2025-11-15T14:30:00.000Z';
        c.steps.forEach((step, i) => {
            c.steps[i] = { ...step, status: 'done', date: 'Kas 2025' };
        });
        c.payments = {
            total: 3200,
            schedule: [{ type: 'full', label: 'Toplam', amount: 3200, stepIndex: 7, paid: true }],
        };
        return c;
    },
};

/**
 * React hook for managing case lifecycle state.
 * @param {string} caseId - Case identifier (use 'demo_mekanik', 'demo_kaza', 'demo_bakim', 'demo_pool' for prototyping)
 */
export function useCaseState(caseId = 'demo_mekanik') {
    const storageKey = STORAGE_PREFIX + caseId;

    const [caseData, setCaseData] = useState(() => {
        // Try localStorage first
        const saved = localStorage.getItem(storageKey);
        if (saved) {
            try { return JSON.parse(saved); } catch { /* fall through */ }
        }
        // Fall back to demo data
        const demoFactory = DEMO_CASES[caseId];
        if (demoFactory) return demoFactory();
        // Default
        return DEMO_CASES.demo_mekanik();
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
        const fresh = demoFactory ? demoFactory() : DEMO_CASES.demo_mekanik();
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

    const confirmCase = useCallback((shopInfo, confirmationData = {}) => {
        let updated = { ...caseData };
        if (shopInfo) updated.shop = shopInfo;

        const hasAppointment = updated.steps.some(s => s.templateId === 'appointment');
        if (!hasAppointment) {
            const apptTemplate = STEP_TEMPLATES.appointment;
            const intakeIdx = updated.steps.findIndex(s => s.templateId === 'intake');
            const insertAt = intakeIdx >= 0 ? intakeIdx + 1 : 0;
            const appointmentStep = {
                templateId: 'appointment',
                title: apptTemplate.title,
                owner: apptTemplate.owner,
                icon: apptTemplate.icon,
                status: 'pending',
                date: null,
                isCustom: false,
                data: {
                    providerSlot: confirmationData.providerSlot || null,
                    firmAcceptance: true,
                    policyAccepted: true,
                    contactPermission: true,
                },
                substeps: null,
                evidence: [],
                confirmation: {
                    shopConfirmed: false,
                    shopConfirmedAt: null,
                    customerConfirmed: true,
                    customerConfirmedAt: new Date().toISOString(),
                },
                dispute: null,
            };
            updated = { ...updated, steps: [...updated.steps] };
            updated.steps.splice(insertAt, 0, appointmentStep);
        }

        // Niyet onayi ile quote/approval adimlari zaten karsilandi — varsa done isaretle
        updated.steps = updated.steps.map(s => {
            if ((s.templateId === 'quote' || s.templateId === 'approval') && s.status !== 'done') {
                return {
                    ...s,
                    status: 'done',
                    date: s.date || new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' }),
                    confirmation: {
                        shopConfirmed: true,
                        shopConfirmedAt: new Date().toISOString(),
                        customerConfirmed: true,
                        customerConfirmedAt: new Date().toISOString(),
                    },
                };
            }
            return s;
        });

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
