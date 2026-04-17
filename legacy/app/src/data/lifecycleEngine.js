/**
 * Lifecycle Engine — Dynamic Step Management for Vaka Takibi
 *
 * Architecture:
 *   CASE_STATUSES (pre-process state machine)
 *   → STEP_TEMPLATES (reusable building blocks)
 *   → BLUEPRINTS (starting recipes)
 *   → createCase() (runtime instances)
 *   → mutators (proposeStep, approveStepProposal, completeStep, payStep, advanceCaseStatus, activateCase)
 */

// ─── Case Status State Machine ───
export const CASE_STATUSES = {
    DRAFT: 'draft',
    POOL: 'pool',
    QUOTED: 'quoted',
    ACCEPTED: 'accepted',
    ACTIVE: 'active',
    COMPLETED: 'completed',
    EXPIRED: 'expired',
};

// ─── Step Status State Machine ───
// pending → active → confirming → done
//                  → disputed → active (geri)
export const STEP_STATUSES = {
    PROPOSED: 'proposed',
    PENDING: 'pending',
    ACTIVE: 'active',
    CONFIRMING: 'confirming',
    DONE: 'done',
    DISPUTED: 'disputed',
    REJECTED: 'rejected',
};

// ─── Evidence Types ───
export const EVIDENCE_TYPES = {
    PHOTO: 'photo',
    VIDEO: 'video',
    DOCUMENT: 'document',
    INVOICE: 'invoice',
    FAULT_CODES: 'fault_codes',
    NOTE: 'note',
    ITEMIZED_LIST: 'itemized_list',
};

// ─── Payment Methods ───
export const PAYMENT_METHODS = {
    PLATFORM: 'platform',
    CASH: 'cash',
    BANK_TRANSFER: 'bank_transfer',
    CREDIT_CARD: 'credit_card',
};

const VALID_TRANSITIONS = {
    draft: ['pool'],
    pool: ['quoted', 'expired'],
    quoted: ['accepted', 'expired'],
    accepted: ['active'],
    active: ['completed'],
    completed: [],
    expired: [],
};

// ─── Step Templates ───
// Each template defines WHAT a step IS, not its content (content lives in case state)
export const STEP_TEMPLATES = {
    intake: {
        id: 'intake',
        title: 'Vaka Bildirildi',
        owner: 'customer',    // customer | shop | system | external | mutual
        type: 'info',         // info | upload | inspect | proposal | approve | procure | work | verify | wait | process | schedule | handoff | rate
        icon: '📋',
        description: 'Müşteri hasarı/arızayı bildirdi',
        evidenceRequired: [],
        evidenceOptional: ['photo', 'video'],
        completionMode: 'single',
        paymentGate: false,
    },
    tutanak: {
        id: 'tutanak',
        title: 'Kaza Tutanağı',
        owner: 'customer',
        type: 'upload',
        icon: '📄',
        description: 'Kaza tutanağı yüklendi/doğrulandı',
        evidenceRequired: ['document'],
        evidenceOptional: ['photo'],
        completionMode: 'single',
        paymentGate: false,
    },
    insurance_file: {
        id: 'insurance_file',
        title: 'Sigorta Dosyası',
        owner: 'system',
        type: 'process',
        icon: '🏛️',
        description: 'Poliçe doğrulama, dosya açma, eksper atama',
        substeps: [
            { id: 'policy_verify', title: 'Poliçe Doğrulama', status: 'pending' },
            { id: 'file_open', title: 'Dosya Açma', status: 'pending' },
            { id: 'expert_assign', title: 'Eksper Atama', status: 'pending' },
        ],
        evidenceRequired: [],
        evidenceOptional: [],
        completionMode: 'single',
        paymentGate: false,
    },
    expert_report: {
        id: 'expert_report',
        title: 'Ekspertiz Raporu',
        owner: 'external',
        type: 'wait',
        icon: '🔍',
        description: 'Sigorta eksperi inceleme ve rapor',
        evidenceRequired: [],
        evidenceOptional: ['document'],
        completionMode: 'single',
        paymentGate: false,
    },
    diagnosis: {
        id: 'diagnosis',
        title: 'Araç Kabul & Teşhis',
        owner: 'shop',
        type: 'inspect',
        icon: '🔬',
        description: 'OBD tarama, arıza tespiti',
        evidenceRequired: ['fault_codes'],
        evidenceOptional: ['photo', 'video', 'note'],
        completionMode: 'two_party',
        paymentGate: false,
    },
    quote: {
        id: 'quote',
        title: 'Detaylı Teklif',
        owner: 'shop',
        type: 'proposal',
        icon: '📝',
        description: 'Kapsamlı maliyet teklifi',
        evidenceRequired: ['itemized_list'],
        evidenceOptional: ['document'],
        completionMode: 'customer_approve',
        paymentGate: false,
    },
    approval: {
        id: 'approval',
        title: 'Teklif Onayı',
        owner: 'customer',
        type: 'approve',
        icon: '✅',
        description: 'Müşteri onayı ve ön ödeme',
        paymentKey: 'deposit',
        evidenceRequired: [],
        evidenceOptional: [],
        completionMode: 'single',
        paymentGate: true,
    },
    parts: {
        id: 'parts',
        title: 'Parça Temini',
        owner: 'shop',
        type: 'procure',
        icon: '📦',
        description: 'Yedek parça sipariş ve fatura',
        evidenceRequired: ['invoice'],
        evidenceOptional: ['photo'],
        completionMode: 'single',
        paymentGate: false,
    },
    repair: {
        id: 'repair',
        title: 'Onarım Sürüyor',
        owner: 'shop',
        type: 'work',
        icon: '🔧',
        description: 'Aktif onarım süreci',
        paymentKey: 'interim',
        evidenceRequired: ['photo'],
        evidenceOptional: ['video', 'note'],
        completionMode: 'two_party',
        paymentGate: false,
    },
    test: {
        id: 'test',
        title: 'Test Sürüşü & Kontrol',
        owner: 'shop',
        type: 'verify',
        icon: '🛣️',
        description: 'Test sürüşü, OBD temizleme',
        evidenceRequired: [],
        evidenceOptional: ['video', 'note'],
        completionMode: 'customer_approve',
        paymentGate: false,
    },
    insurance_close: {
        id: 'insurance_close',
        title: 'Sigorta Kapanış',
        owner: 'system',
        type: 'process',
        icon: '📋',
        description: 'Dosya kapanış, ödeme mutabakatı',
        evidenceRequired: [],
        evidenceOptional: ['document'],
        completionMode: 'single',
        paymentGate: false,
    },
    delivery: {
        id: 'delivery',
        title: 'Teslimata Hazır',
        owner: 'shop',
        type: 'handoff',
        icon: '🤝',
        description: 'Araç teslime hazır',
        paymentKey: 'final',
        evidenceRequired: ['photo'],
        evidenceOptional: ['video'],
        completionMode: 'two_party',
        paymentGate: true,
    },
    rating: {
        id: 'rating',
        title: 'Teslimat & Puanlama',
        owner: 'customer',
        type: 'rate',
        icon: '⭐',
        description: 'Değerlendirme ve puanlama',
        evidenceRequired: [],
        evidenceOptional: ['note'],
        completionMode: 'single',
        paymentGate: false,
    },
    appointment: {
        id: 'appointment',
        title: 'Randevu & Kabul',
        owner: 'shop',
        type: 'schedule',
        icon: '📅',
        description: 'Tarih belirleme, araç teslim',
        evidenceRequired: [],
        evidenceOptional: [],
        completionMode: 'single',
        paymentGate: false,
    },
    service: {
        id: 'service',
        title: 'Bakım Yapılıyor',
        owner: 'shop',
        type: 'work',
        icon: '🛠️',
        description: 'Bakım işlemi sürüyor',
        evidenceRequired: ['photo'],
        evidenceOptional: ['note'],
        completionMode: 'two_party',
        paymentGate: false,
    },
    checkup: {
        id: 'checkup',
        title: 'Son Kontrol',
        owner: 'shop',
        type: 'verify',
        icon: '✔️',
        description: 'Final kontrol',
        evidenceRequired: [],
        evidenceOptional: ['note'],
        completionMode: 'single',
        paymentGate: false,
    },
};

// ─── Process Blueprints ───
// Starting recipes — can be mutated at runtime
export const BLUEPRINTS = {
    bakim_basit: {
        id: 'bakim_basit',
        label: 'Basit Bakım',
        category: 'bakim',
        color: 'green',
        steps: ['intake', 'appointment', 'service', 'delivery'],
    },
    bakim_kapsamli: {
        id: 'bakim_kapsamli',
        label: 'Kapsamlı Bakım',
        category: 'bakim',
        color: 'green',
        steps: ['intake', 'diagnosis', 'quote', 'approval', 'parts', 'service', 'checkup', 'delivery', 'rating'],
    },
    mekanik_standart: {
        id: 'mekanik_standart',
        label: 'Mekanik Arıza',
        category: 'mekanik',
        color: 'orange',
        steps: ['intake', 'diagnosis', 'quote', 'approval', 'parts', 'repair', 'test', 'delivery', 'rating'],
    },
    kaza_sigortasiz: {
        id: 'kaza_sigortasiz',
        label: 'Kaza (Sigortasız)',
        category: 'kaza',
        color: 'red',
        steps: ['intake', 'diagnosis', 'quote', 'approval', 'parts', 'repair', 'test', 'delivery', 'rating'],
    },
    kaza_sigortali: {
        id: 'kaza_sigortali',
        label: 'Kaza (Sigortalı)',
        category: 'kaza',
        color: 'red',
        steps: ['intake', 'tutanak', 'insurance_file', 'expert_report', 'diagnosis', 'quote', 'approval', 'repair', 'test', 'insurance_close', 'delivery', 'rating'],
    },
};

// ─── Blueprint Selection Logic ───
export function selectBlueprint(hasarType, insuranceStatus, bakimType) {
    if (bakimType === 'basit') return 'bakim_basit';
    if (bakimType === 'kapsamli') return 'bakim_kapsamli';
    if (hasarType === 'kaza' && insuranceStatus === 'kasko') return 'kaza_sigortali';
    if (hasarType === 'kaza') return 'kaza_sigortasiz';
    return 'mekanik_standart';
}

// ─── Case Factory ───
export function createCase(blueprintId, vehicle, shop, initialData = {}) {
    const blueprint = BLUEPRINTS[blueprintId];
    if (!blueprint) throw new Error(`Unknown blueprint: ${blueprintId}`);

    const steps = blueprint.steps.map((templateId, idx) => {
        const template = STEP_TEMPLATES[templateId];
        return {
            templateId,
            title: template.title,
            owner: template.owner,
            icon: template.icon,
            status: idx === 0 ? 'done' : (idx === 1 ? 'active' : 'pending'),
            date: idx === 0 ? initialData.intakeDate || 'Bugün' : null,
            isCustom: false,
            data: idx === 0 ? (initialData.intakeData || {}) : {},
            substeps: template.substeps ? template.substeps.map(s => ({ ...s })) : null,
            evidence: [],
            confirmation: {
                shopConfirmed: false,
                shopConfirmedAt: null,
                customerConfirmed: false,
                customerConfirmedAt: null,
            },
            dispute: null,
        };
    });

    return {
        id: `case_${Date.now()}`,
        blueprintId,
        label: blueprint.label,
        category: blueprint.category,
        color: blueprint.color,
        status: CASE_STATUSES.DRAFT,
        vehicle: vehicle || { plate: '34 ABC 42', model: 'BMW 3 Serisi' },
        shop: shop || { name: 'AutoPro Servis' },
        steps,
        payments: {
            total: initialData.totalCost || 0,
            schedule: [],
            additionalCosts: [],
            history: [],
        },
        createdAt: new Date().toISOString(),
    };
}

// ─── Step Mutators ───

export function completeStep(caseData, stepIndex, stepData = {}) {
    const updated = { ...caseData, steps: [...caseData.steps] };
    const step = { ...updated.steps[stepIndex] };
    const template = STEP_TEMPLATES[step.templateId] || {};
    const mode = template.completionMode || 'single';

    step.data = { ...step.data, ...stepData };
    step.date = step.date || new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

    // Evidence quality stamp — zorunlu kanıtlar blok değil, teşvik edilen durum.
    // Eksik olanlar 'partial' olarak işaretlenir; skor hesabı cezalandırır.
    const required = template.evidenceRequired || [];
    const evidence = step.evidence || [];
    const missingRequired = required.filter(t => !evidence.some(ev => ev.type === t));
    step.completionQuality = missingRequired.length === 0 ? 'complete' : 'partial';
    step.missingRequiredAtComplete = missingRequired;

    // Payment gate check — if this step has a linked payment that's not confirmed, block
    if (template.paymentGate) {
        const linkedPayment = updated.payments.schedule.find(p => p.stepIndex === stepIndex);
        if (linkedPayment && !linkedPayment.paidByCustomer && !linkedPayment.paid) {
            // Cannot complete — payment required first
            updated.steps[stepIndex] = step;
            return updated;
        }
    }

    if (mode === 'single') {
        // Direct completion — current behavior
        step.status = 'done';
    } else {
        // two_party or customer_approve → move to confirming, set owner's confirmation
        step.status = 'confirming';
        step.confirmation = {
            ...step.confirmation,
            shopConfirmed: step.owner === 'shop',
            shopConfirmedAt: step.owner === 'shop' ? new Date().toISOString() : step.confirmation?.shopConfirmedAt || null,
            customerConfirmed: step.owner === 'customer',
            customerConfirmedAt: step.owner === 'customer' ? new Date().toISOString() : step.confirmation?.customerConfirmedAt || null,
        };
    }

    updated.steps[stepIndex] = step;

    // Activate next pending step (only if done)
    if (step.status === 'done') {
        const nextIdx = updated.steps.findIndex((s, i) => i > stepIndex && s.status === 'pending');
        if (nextIdx !== -1) {
            updated.steps[nextIdx] = { ...updated.steps[nextIdx], status: 'active' };
        }
    }

    return updated;
}

// ─── Step Proposal Lifecycle ───
// A party proposes a mid-flow step → other party approves (with optional payment method
// if cost attached) or rejects. Rejected steps stay in timeline as audit trail.

export function proposeStep(caseData, afterIndex, def) {
    const updated = { ...caseData, steps: [...caseData.steps] };
    const now = new Date().toISOString();
    const proposedBy = def.proposedBy || 'shop';
    const awaitingFrom = proposedBy === 'shop' ? 'customer' : 'shop';

    const newStep = {
        templateId: def.templateId || 'custom_repair',
        title: def.title,
        owner: def.owner || proposedBy,
        icon: def.icon || '🔧',
        status: STEP_STATUSES.PROPOSED,
        date: null,
        isCustom: true,
        data: def.data || {},
        substeps: null,
        evidence: [],
        confirmation: {
            shopConfirmed: false,
            shopConfirmedAt: null,
            customerConfirmed: false,
            customerConfirmedAt: null,
        },
        dispute: null,
        proposal: { proposedBy, proposedAt: now, awaitingFrom, reason: def.reason || '' },
        cost: def.cost ? { amount: def.cost.amount, description: def.cost.description || def.title } : null,
    };

    updated.steps.splice(afterIndex + 1, 0, newStep);
    return updated;
}

export function approveStepProposal(caseData, stepIndex, { actor, paymentMethod } = {}) {
    const updated = { ...caseData, steps: [...caseData.steps] };
    const step = { ...updated.steps[stepIndex] };
    if (step.status !== STEP_STATUSES.PROPOSED) return caseData;
    if (step.proposal && step.proposal.awaitingFrom && actor && step.proposal.awaitingFrom !== actor) return caseData;

    // Counter-proposal cost gets promoted to step.cost on customer approval
    if (step.counterProposal && actor === 'customer') {
        step.cost = { amount: step.counterProposal.cost.amount, description: step.counterProposal.cost.description || step.title };
    }

    step.status = STEP_STATUSES.PENDING;
    step.proposal = { ...(step.proposal || {}), awaitingFrom: null, approvedAt: new Date().toISOString(), approvedBy: actor };

    // Auto-activate if previous step is done (or this is first)
    const prev = updated.steps[stepIndex - 1];
    if (!prev || prev.status === STEP_STATUSES.DONE) {
        step.status = STEP_STATUSES.ACTIVE;
    }
    updated.steps[stepIndex] = step;

    // Create schedule entry for step.cost
    if (step.cost && step.cost.amount > 0) {
        const payId = `pay_step_${stepIndex}_${Date.now()}`;
        const scheduleEntry = {
            id: payId,
            type: 'step_cost',
            label: step.cost.description || step.title,
            amount: step.cost.amount,
            stepIndex,
            method: null,
            paidByCustomer: false,
            confirmedByShop: false,
            paidAt: null,
            confirmedAt: null,
            paid: false,
        };
        updated.payments = {
            ...updated.payments,
            total: updated.payments.total + step.cost.amount,
            schedule: [...updated.payments.schedule, scheduleEntry],
            history: [...(updated.payments.history || []), {
                action: 'step_cost_approved',
                paymentId: payId,
                amount: step.cost.amount,
                method: null,
                actor: actor || 'customer',
                timestamp: new Date().toISOString(),
                note: step.cost.description || step.title,
            }],
        };

        // Platform payment → chain makePayment for auto-confirm
        if (paymentMethod === 'platform') {
            return makePayment(updated, payId, 'platform');
        }
        if (paymentMethod && paymentMethod !== 'platform') {
            // Persist chosen method on schedule entry without marking paid
            updated.payments = {
                ...updated.payments,
                schedule: updated.payments.schedule.map(p => p.id === payId ? { ...p, method: paymentMethod } : p),
            };
        }
    }

    return updated;
}

export function rejectStepProposal(caseData, stepIndex, { actor, reason } = {}) {
    const updated = { ...caseData, steps: [...caseData.steps] };
    const step = { ...updated.steps[stepIndex] };
    if (step.status !== STEP_STATUSES.PROPOSED) return caseData;
    step.status = STEP_STATUSES.REJECTED;
    step.rejection = { actor: actor || 'unknown', reason: reason || '', rejectedAt: new Date().toISOString() };
    if (step.proposal) step.proposal = { ...step.proposal, awaitingFrom: null };
    updated.steps[stepIndex] = step;
    return updated;
}

export function retractStepProposal(caseData, stepIndex, actor) {
    return rejectStepProposal(caseData, stepIndex, { actor, reason: 'Geri çekildi' });
}

export function counterProposeStep(caseData, stepIndex, { cost, reason } = {}) {
    const updated = { ...caseData, steps: [...caseData.steps] };
    const step = { ...updated.steps[stepIndex] };
    if (step.status !== STEP_STATUSES.PROPOSED) return caseData;
    if (!step.proposal || step.proposal.proposedBy !== 'customer') return caseData;

    step.counterProposal = {
        cost: { amount: cost.amount, description: cost.description || step.title },
        reason: reason || '',
        proposedAt: new Date().toISOString(),
        proposedBy: 'shop',
    };
    step.proposal = { ...step.proposal, awaitingFrom: 'customer' };
    updated.steps[stepIndex] = step;
    return updated;
}

export function payStep(caseData, paymentType) {
    const updated = { ...caseData };
    updated.payments = {
        ...updated.payments,
        schedule: updated.payments.schedule.map(p =>
            p.type === paymentType ? { ...p, paid: true } : p
        ),
    };
    return updated;
}

export function updateStepData(caseData, stepIndex, newData) {
    const updated = { ...caseData, steps: [...caseData.steps] };
    updated.steps[stepIndex] = {
        ...updated.steps[stepIndex],
        data: { ...updated.steps[stepIndex].data, ...newData },
    };
    return updated;
}

// ─── Computed Helpers ───

export function getActiveStepIndex(caseData) {
    return caseData.steps.findIndex(s => s.status === 'active');
}

export function getProgress(caseData) {
    const active = caseData.steps.filter(s => s.status !== STEP_STATUSES.REJECTED && s.status !== STEP_STATUSES.PROPOSED);
    const total = active.length || 1;
    const done = active.filter(s => s.status === STEP_STATUSES.DONE).length;
    return {
        done,
        total,
        percent: Math.round((done / total) * 100),
    };
}

export function getPaidAmount(caseData) {
    return caseData.payments.schedule
        .filter(p => p.paid)
        .reduce((sum, p) => sum + p.amount, 0);
}

export function getOwnerLabel(owner) {
    switch (owner) {
        case 'customer': return 'Siz';
        case 'shop': return 'Usta';
        case 'system': return 'Sistem';
        case 'external': return 'Harici';
        case 'mutual': return 'Karşılıklı';
        default: return owner;
    }
}

// ─── Evidence Mutators ───

export function addEvidence(caseData, stepIndex, evidenceItem) {
    const updated = { ...caseData, steps: [...caseData.steps] };
    const step = { ...updated.steps[stepIndex] };
    step.evidence = [...(step.evidence || []), {
        id: `ev_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        type: evidenceItem.type,
        url: evidenceItem.url || '',
        uploadedBy: evidenceItem.uploadedBy || 'shop',
        uploadedAt: new Date().toISOString(),
        description: evidenceItem.description || '',
        verified: false,
    }];
    updated.steps[stepIndex] = step;
    return updated;
}

export function verifyEvidence(caseData, stepIndex, evidenceId) {
    const updated = { ...caseData, steps: [...caseData.steps] };
    const step = { ...updated.steps[stepIndex] };
    step.evidence = (step.evidence || []).map(ev =>
        ev.id === evidenceId ? { ...ev, verified: true } : ev
    );
    updated.steps[stepIndex] = step;
    return updated;
}

// ─── Two-Party Confirmation ───

export function confirmStep(caseData, stepIndex, actor) {
    const updated = { ...caseData, steps: [...caseData.steps] };
    const step = { ...updated.steps[stepIndex] };
    const template = STEP_TEMPLATES[step.templateId] || {};
    const mode = template.completionMode || 'single';

    step.confirmation = { ...(step.confirmation || {}) };

    if (actor === 'shop') {
        step.confirmation.shopConfirmed = true;
        step.confirmation.shopConfirmedAt = new Date().toISOString();
    } else if (actor === 'customer') {
        step.confirmation.customerConfirmed = true;
        step.confirmation.customerConfirmedAt = new Date().toISOString();
    }

    // Check if completion criteria are met
    const bothConfirmed = step.confirmation.shopConfirmed && step.confirmation.customerConfirmed;
    const customerApproved = mode === 'customer_approve' && step.confirmation.customerConfirmed;

    if (mode === 'two_party' && bothConfirmed) {
        step.status = 'done';
    } else if (customerApproved) {
        step.status = 'done';
    }

    updated.steps[stepIndex] = step;

    // Activate next pending step if done
    if (step.status === 'done') {
        const nextIdx = updated.steps.findIndex((s, i) => i > stepIndex && s.status === 'pending');
        if (nextIdx !== -1) {
            updated.steps[nextIdx] = { ...updated.steps[nextIdx], status: 'active' };
        }
    }

    return updated;
}

// ─── Dispute ───

export function raiseDispute(caseData, stepIndex, disputeData) {
    const updated = { ...caseData, steps: [...caseData.steps] };
    const step = { ...updated.steps[stepIndex] };
    step.status = 'disputed';
    step.dispute = {
        raisedBy: disputeData.raisedBy || 'customer',
        reason: disputeData.reason || '',
        raisedAt: new Date().toISOString(),
        status: 'open',
        resolution: null,
    };
    updated.steps[stepIndex] = step;
    return updated;
}

export function resolveDispute(caseData, stepIndex, resolution) {
    const updated = { ...caseData, steps: [...caseData.steps] };
    const step = { ...updated.steps[stepIndex] };
    if (step.dispute) {
        step.dispute = {
            ...step.dispute,
            status: 'resolved',
            resolution: resolution || '',
        };
    }
    // Return step to active so work can continue
    step.status = 'active';
    // Reset confirmations
    step.confirmation = {
        shopConfirmed: false,
        shopConfirmedAt: null,
        customerConfirmed: false,
        customerConfirmedAt: null,
    };
    updated.steps[stepIndex] = step;
    return updated;
}

// ─── Enhanced Payment Mutators ───

export function makePayment(caseData, paymentId, method) {
    const updated = { ...caseData };
    const now = new Date().toISOString();
    const isAutoConfirm = method === 'platform';

    updated.payments = {
        ...updated.payments,
        schedule: updated.payments.schedule.map(p => {
            if (p.id !== paymentId && p.type !== paymentId) return p;
            return {
                ...p,
                method,
                paidByCustomer: true,
                paidAt: now,
                // Platform payments are auto-confirmed
                confirmedByShop: isAutoConfirm ? true : (p.confirmedByShop || false),
                confirmedAt: isAutoConfirm ? now : p.confirmedAt,
                // Backward compat
                paid: isAutoConfirm,
            };
        }),
        history: [...(updated.payments.history || []), {
            action: 'payment_made',
            paymentId,
            amount: updated.payments.schedule.find(p => p.id === paymentId || p.type === paymentId)?.amount || 0,
            method,
            actor: 'customer',
            timestamp: now,
            note: '',
        }],
    };

    return updated;
}

export function confirmPayment(caseData, paymentId) {
    const updated = { ...caseData };
    const now = new Date().toISOString();

    updated.payments = {
        ...updated.payments,
        schedule: updated.payments.schedule.map(p => {
            if (p.id !== paymentId && p.type !== paymentId) return p;
            return {
                ...p,
                confirmedByShop: true,
                confirmedAt: now,
                paid: true,
            };
        }),
        history: [...(updated.payments.history || []), {
            action: 'payment_confirmed',
            paymentId,
            amount: updated.payments.schedule.find(p => p.id === paymentId || p.type === paymentId)?.amount || 0,
            method: updated.payments.schedule.find(p => p.id === paymentId || p.type === paymentId)?.method || 'cash',
            actor: 'shop',
            timestamp: now,
            note: '',
        }],
    };

    return updated;
}

export function addAdditionalCost(caseData, costData) {
    const updated = { ...caseData };
    const now = new Date().toISOString();
    const costId = `ac_${Date.now()}`;

    updated.payments = {
        ...updated.payments,
        additionalCosts: [...(updated.payments.additionalCosts || []), {
            id: costId,
            description: costData.description || '',
            amount: costData.amount || 0,
            addedBy: costData.addedBy || 'shop',
            addedAt: now,
            status: 'pending',
            approvedByCustomer: false,
            approvedAt: null,
            rejectedByCustomer: false,
            rejectedAt: null,
            linkedStepIndex: costData.linkedStepIndex ?? null,
        }],
        history: [...(updated.payments.history || []), {
            action: 'cost_added',
            paymentId: costId,
            amount: costData.amount || 0,
            method: null,
            actor: costData.addedBy || 'shop',
            timestamp: now,
            note: costData.description || '',
        }],
    };

    return updated;
}

export function approveAdditionalCost(caseData, costId) {
    const updated = { ...caseData };
    const now = new Date().toISOString();
    const cost = (updated.payments.additionalCosts || []).find(c => c.id === costId);
    if (!cost) return updated;

    updated.payments = {
        ...updated.payments,
        additionalCosts: updated.payments.additionalCosts.map(c =>
            c.id === costId ? { ...c, approvedByCustomer: true, approvedAt: now, status: 'approved' } : c
        ),
        total: updated.payments.total + cost.amount,
        schedule: [...updated.payments.schedule, {
            id: `pay_ac_${costId}`,
            type: 'additional',
            label: `Ek: ${cost.description}`,
            amount: cost.amount,
            stepIndex: cost.linkedStepIndex,
            method: null,
            paidByCustomer: false,
            confirmedByShop: false,
            paidAt: null,
            confirmedAt: null,
            paid: false,
        }],
        history: [...(updated.payments.history || []), {
            action: 'cost_approved',
            paymentId: costId,
            amount: cost.amount,
            method: null,
            actor: 'customer',
            timestamp: now,
            note: '',
        }],
    };

    return updated;
}

export function rejectAdditionalCost(caseData, costId, reason = '') {
    const updated = { ...caseData };
    const now = new Date().toISOString();
    const cost = (updated.payments.additionalCosts || []).find(c => c.id === costId);
    if (!cost) return updated;

    updated.payments = {
        ...updated.payments,
        additionalCosts: updated.payments.additionalCosts.map(c =>
            c.id === costId ? { ...c, rejectedByCustomer: true, rejectedAt: now, status: 'rejected', rejectionReason: reason } : c
        ),
        history: [...(updated.payments.history || []), {
            action: 'cost_rejected',
            paymentId: costId,
            amount: cost.amount,
            method: null,
            actor: 'customer',
            timestamp: now,
            note: reason,
        }],
    };

    return updated;
}

// ─── Cancellation Guard ───

export function canCancelCase(caseData) {
    // If any payment has been received, case cannot be cancelled
    const hasPayment = caseData.payments.schedule.some(p => p.paid || p.paidByCustomer);
    return !hasPayment;
}

// ─── Trust Score / Gamification ───

export function computeStepScore(step) {
    const template = STEP_TEMPLATES[step.templateId] || {};
    const required = template.evidenceRequired || [];
    const optional = template.evidenceOptional || [];
    const evidence = step.evidence || [];

    let score = 0;
    let maxPossible = 0;

    // Required evidence: 10 pts each
    required.forEach(type => {
        maxPossible += 10;
        if (evidence.some(ev => ev.type === type)) score += 10;
    });

    // Optional evidence: 5 pts each
    optional.forEach(type => {
        maxPossible += 5;
        if (evidence.some(ev => ev.type === type)) score += 5;
    });

    // Visual proof bonus (photo/video): +5
    if (evidence.some(ev => ev.type === 'photo' || ev.type === 'video')) {
        score += 5;
        maxPossible += 5;
    } else {
        maxPossible += 5;
    }

    // Timeliness bonus: +10 (if step is done)
    maxPossible += 10;
    if (step.status === 'done') score += 10;

    // Dispute penalty: -20
    if (step.dispute && step.dispute.status === 'open') score -= 20;

    // Partial completion penalty: adım eksik kanıtla tamamlandıysa -5 per eksik zorunlu tip
    if (step.status === 'done' && step.completionQuality === 'partial') {
        const missingCount = (step.missingRequiredAtComplete || []).length;
        score -= missingCount * 5;
    }

    const percentage = maxPossible > 0 ? Math.max(0, Math.round((score / maxPossible) * 100)) : 0;

    return { score, maxPossible, percentage };
}

export function computeCaseTrustScore(caseData) {
    const shopSteps = caseData.steps.filter(s => s.owner === 'shop' && s.status !== STEP_STATUSES.REJECTED && s.status !== STEP_STATUSES.PROPOSED);
    if (shopSteps.length === 0) return { score: 0, percentage: 0 };

    const scores = shopSteps.map(s => computeStepScore(s));
    const avgPercentage = Math.round(scores.reduce((sum, s) => sum + s.percentage, 0) / scores.length);
    const totalScore = scores.reduce((sum, s) => sum + s.score, 0);

    return { score: totalScore, percentage: avgPercentage };
}

// ─── Evidence Helpers ───

export function getRequiredEvidenceStatus(step) {
    const template = STEP_TEMPLATES[step.templateId] || {};
    const required = template.evidenceRequired || [];
    const evidence = step.evidence || [];

    return required.map(type => ({
        type,
        fulfilled: evidence.some(ev => ev.type === type),
    }));
}

export function getOptionalEvidenceStatus(step) {
    const template = STEP_TEMPLATES[step.templateId] || {};
    const optional = template.evidenceOptional || [];
    const evidence = step.evidence || [];

    return optional.map(type => ({
        type,
        fulfilled: evidence.some(ev => ev.type === type),
    }));
}

export function isPaymentFullyConfirmed(payment) {
    if (payment.method === 'platform') return payment.paidByCustomer;
    return payment.paidByCustomer && payment.confirmedByShop;
}

// ─── Step Interaction Classification ───
// Gerçek hayat akışında her adım farklı bir etkileşim düzeyi hak eder:
//  - 'archive' → ön süreç adımları done olduğunda (intake/diagnosis/quote/approval/parts).
//                Detay modaline gerek yok, satırdaki özet yeterli.
//  - 'review'  → done olmuş ama canlı iz bırakan adımlar (repair/test/delivery/service/checkup).
//                Müşteri itiraz edebilir, kanıtları görebilir → hafif modal.
//  - 'active'  → aktif / teyit bekleyen / önerilmiş / reddedilmiş adımlar → tam modal.
const ARCHIVE_TEMPLATE_IDS = new Set([
    'intake', 'tutanak', 'insurance_file', 'expert_report',
    'diagnosis', 'quote', 'approval', 'parts', 'appointment', 'insurance_close',
]);

export function classifyStepInteraction(step) {
    if (!step) return 'archive';
    const status = step.status;
    if (status === STEP_STATUSES.PROPOSED || status === STEP_STATUSES.REJECTED) return 'active';
    if (status === 'active' || status === 'confirming') return 'active';
    if (status === 'pending') return 'archive';
    // status === 'done'
    if (step.dispute) return 'review';
    if (ARCHIVE_TEMPLATE_IDS.has(step.templateId)) return 'archive';
    return 'review';
}

// ─── Case Status Mutators ───

export function advanceCaseStatus(caseData, newStatus) {
    const current = caseData.status || CASE_STATUSES.ACTIVE;
    const allowed = VALID_TRANSITIONS[current] || [];
    if (!allowed.includes(newStatus)) return caseData;
    return { ...caseData, status: newStatus };
}

export function activateCase(caseData) {
    const updated = { ...caseData, status: CASE_STATUSES.ACTIVE, steps: [...caseData.steps] };
    // Set intake to done (if not already) and activate the first pending step
    if (updated.steps[0] && updated.steps[0].status !== 'done') {
        updated.steps[0] = { ...updated.steps[0], status: 'done', date: new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' }) };
    }
    const firstPending = updated.steps.findIndex(s => s.status === 'pending');
    if (firstPending !== -1) {
        updated.steps[firstPending] = { ...updated.steps[firstPending], status: 'active' };
    }
    return updated;
}
