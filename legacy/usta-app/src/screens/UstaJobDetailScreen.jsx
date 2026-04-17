import { useState } from 'react';
import { useApp } from '../context/AppContext';
import SubHeader from '../components/SubHeader';
import { ChevronRight } from '@shared/components/Icons';
import { useCaseState } from '../hooks/useCaseState';
import { getNavParams } from '../hooks/useQuoteState';
import {
    STEP_TEMPLATES,
    getOwnerLabel,
    getProgress,
    getPaidAmount,
    getRequiredEvidenceStatus,
    getOptionalEvidenceStatus,
    computeStepScore,
    computeCaseTrustScore,
    isPaymentFullyConfirmed,
    classifyStepInteraction,
} from '@shared/data/lifecycleEngine';

const EVIDENCE_LABELS = {
    photo: 'Fotoğraf',
    video: 'Video',
    document: 'Belge',
    invoice: 'Fatura',
    fault_codes: 'Arıza Kodu',
    note: 'Not',
    itemized_list: 'Kalem Listesi',
};

const EVIDENCE_ICONS = {
    photo: '📷',
    video: '🎥',
    document: '📄',
    invoice: '🧾',
    fault_codes: '🛠️',
    note: '📝',
    itemized_list: '📋',
};

const COMPLETION_MODE_LABELS = {
    single: 'Tek taraflı (usta tamamlar)',
    two_party: 'Çift taraflı (müşteri onayı gerekli)',
    customer_approve: 'Müşteri onayı ile tamamlanır',
};

// ─── Step Row (Usta perspective) ───
function StepRow({ step, index, onClick, payments, isLast, onApproveProposal, onRejectProposal, onRetractProposal, onStartCounter }) {
    const paidPayment = payments?.schedule?.find(p => p.stepIndex === index && p.paid);
    const pendingPayment = payments?.schedule?.find(p => p.stepIndex === index && !p.paid);

    const template = STEP_TEMPLATES[step.templateId] || {};
    const evidenceCount = step.evidence?.length || 0;
    const requiredStatus = getRequiredEvidenceStatus(step);
    const missingRequired = requiredStatus.filter(r => !r.fulfilled).length;
    const isDisputed = step.dispute && step.dispute.status === 'open';
    const isConfirming = step.status === 'confirming' || (step.status === 'active' && step.confirmation?.shopConfirmed && !step.confirmation?.customerConfirmed);
    const score = computeStepScore(step);
    const isProposed = step.status === 'proposed';
    const isRejected = step.status === 'rejected';

    const getPreview = () => {
        if (paidPayment) return `✓ ${paidPayment.label} — ₺${paidPayment.amount.toLocaleString('tr-TR')} tahsil edildi`;
        if (step.data?.liveUpdate) return step.data.liveUpdate;
        if (step.data?.description) return step.data.description;
        if (step.data?.notes) return step.data.notes;
        if (step.data?.faultCodes) return `Arıza kodu: ${step.data.faultCodes.join(', ')}`;
        if (step.data?.items) return `₺${step.data.items.reduce((s, i) => s + i.price, 0).toLocaleString('tr-TR')} tutarında teklif`;
        if (step.data?.invoiceUploaded) return `${step.data.partName} — Fatura yüklendi`;
        if (step.status === 'pending') return null;
        return template.description || '';
    };

    const preview = getPreview();
    const interactionMode = classifyStepInteraction(step);
    const clickable = interactionMode !== 'archive';
    const rowClass = `step-row step-row--${step.status}${isConfirming ? ' step-row--confirming' : ''}${isDisputed ? ' step-row--disputed' : ''}${interactionMode === 'archive' ? ' step-row--archive' : ''}`;

    const awaitingFrom = step.proposal?.awaitingFrom;
    const proposedBy = step.proposal?.proposedBy;
    const needsShopAction = isProposed && awaitingFrom === 'shop';
    const shopAwaitingCustomer = isProposed && awaitingFrom === 'customer';
    const hasCost = step.cost && step.cost.amount > 0;
    const counterCost = step.counterProposal?.cost;

    const stopAnd = (fn) => (e) => { e.stopPropagation(); fn(); };

    return (
        <div className={rowClass} onClick={clickable ? () => onClick(index) : undefined} style={!clickable ? { cursor: 'default' } : undefined}>
            <div className="step-row__track">
                <div className="step-row__dot">
                    {step.status === 'done' ? '✓' : isRejected ? '✕' : isProposed ? '?' : isDisputed ? '!' : step.status === 'active' ? step.icon : ''}
                </div>
                {!isLast && <div className="step-row__line" />}
            </div>
            <div className="step-row__content">
                <div className="step-row__header">
                    <div className="step-row__left">
                        <div className={`collab-tag collab-tag--${step.owner}`}>{getOwnerLabel(step.owner)}</div>
                        <div className="step-row__title">
                            {step.title}
                            {step.isCustom && !isProposed && !isRejected && <span className="step-custom-badge">Eklendi</span>}
                            {isProposed && <span className="proposal-pill">Önerildi{hasCost ? ` · ₺${step.cost.amount.toLocaleString('tr-TR')}` : ''}</span>}
                            {isRejected && <span className="proposal-pill proposal-pill--rejected">Reddedildi</span>}
                            {pendingPayment && step.status === 'active' && <span className="pay-status pay-status--pending">₺{pendingPayment.amount.toLocaleString('tr-TR')}</span>}
                        </div>
                        {step.date && <div className="step-row__date">{step.date}</div>}
                    </div>
                    {clickable && step.status !== 'pending' && !isProposed && !isRejected && <div className="step-row__chevron"><ChevronRight /></div>}
                </div>
                {preview && step.status !== 'pending' && !isProposed && !isRejected && (
                    <div className="step-row__preview">{preview}</div>
                )}
                {isProposed && (
                    <div className="step-row__preview">
                        {proposedBy === 'customer' ? 'Müşteri bu ara adımı istedi.' : 'Müşteri onayı bekleniyor.'}
                        {step.proposal?.reason ? ` — "${step.proposal.reason}"` : ''}
                        {counterCost ? ` · Karşı teklif: ₺${counterCost.amount.toLocaleString('tr-TR')}` : ''}
                    </div>
                )}
                {isRejected && step.rejection?.reason && (
                    <div className="step-row__preview">Gerekçe: {step.rejection.reason}</div>
                )}
                {needsShopAction && (
                    <div className="proposal-inline-actions" onClick={e => e.stopPropagation()}>
                        <button className="proposal-btn proposal-btn--approve" onClick={stopAnd(() => onApproveProposal?.(index))}>✓ Kabul</button>
                        <button className="proposal-btn proposal-btn--counter" onClick={stopAnd(() => onStartCounter?.(index))}>₺ Ücretli Kabul</button>
                        <button className="proposal-btn proposal-btn--reject" onClick={stopAnd(() => onRejectProposal?.(index))}>✕ Reddet</button>
                    </div>
                )}
                {shopAwaitingCustomer && (
                    <div className="proposal-inline-actions" onClick={e => e.stopPropagation()}>
                        <span className="proposal-waiting">⏳ Müşteri yanıtı bekleniyor</span>
                        <button className="proposal-btn proposal-btn--reject" onClick={stopAnd(() => onRetractProposal?.(index))}>Geri Çek</button>
                    </div>
                )}
                {step.status !== 'pending' && !isProposed && !isRejected && (
                    <div className="step-row__badges">
                        {evidenceCount > 0 && (
                            <span className="step-row__badge step-row__badge--evidence">📎 {evidenceCount} kanıt</span>
                        )}
                        {missingRequired > 0 && step.status !== 'done' && (
                            <span className="step-row__badge step-row__badge--nudge">💡 {missingRequired} önerilen kanıt</span>
                        )}
                        {step.status === 'done' && step.completionQuality === 'partial' && (
                            <span className="step-row__badge step-row__badge--nudge">📎 Eksik kanıtla tamamlandı</span>
                        )}
                        {isConfirming && (
                            <span className="step-row__badge step-row__badge--confirm">⏳ Müşteri onayı</span>
                        )}
                        {template.paymentGate && pendingPayment && (
                            <span className="step-row__badge step-row__badge--gate">🔒 Ödeme bekliyor</span>
                        )}
                        {paidPayment && (
                            <span className="step-row__badge step-row__badge--payment">✓ Tahsilat</span>
                        )}
                        {isDisputed && (
                            <span className="step-row__badge step-row__badge--dispute">! İtiraz</span>
                        )}
                        {step.status === 'done' && score.percentage > 0 && (
                            <span className="step-row__badge">⭐ {score.percentage}%</span>
                        )}
                    </div>
                )}
                {step.substeps && step.status === 'active' && (
                    <div className="substep-list">
                        {step.substeps.map(sub => (
                            <div key={sub.id} className={`substep-item substep-item--${sub.status}`}>
                                <span className="substep-dot">{sub.status === 'done' ? '✓' : sub.status === 'active' ? '●' : '○'}</span>
                                <span>{sub.title}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── Evidence Upload Panel ───
function EvidenceUploadPanel({ step, stepIndex, onAddEvidence }) {
    const template = STEP_TEMPLATES[step.templateId] || {};
    const required = template.evidenceRequired || [];
    const optional = template.evidenceOptional || [];
    const evidence = step.evidence || [];

    if (required.length === 0 && optional.length === 0) return null;

    const isFulfilled = (type) => evidence.some(ev => ev.type === type);

    const handleAdd = (type) => {
        const id = `ev_usta_${Date.now()}`;
        onAddEvidence(stepIndex, {
            id,
            type,
            url: `${type}_${Date.now()}.jpg`,
            uploadedBy: 'shop',
            uploadedAt: new Date().toISOString(),
            description: `${EVIDENCE_LABELS[type]} eklendi`,
            verified: false,
        });
    };

    const totalRequired = required.length;
    const fulfilledRequired = required.filter(isFulfilled).length;

    return (
        <div className="evidence-upload-panel">
            <div className="evidence-upload-panel__title">
                <span>📎 Kanıtlar</span>
                <span className="evidence-upload-panel__count">
                    {fulfilledRequired}/{totalRequired} önerilen · {evidence.length} toplam
                </span>
            </div>
            <div className="evidence-checklist">
                {required.map(type => {
                    const done = isFulfilled(type);
                    return (
                        <div key={`req-${type}`} className={`evidence-checklist__item ${done ? 'evidence-checklist__item--done' : 'evidence-checklist__item--missing'}`}>
                            <span className="evidence-checklist__dot">{done ? '✓' : ''}</span>
                            <span className="evidence-checklist__label">
                                {EVIDENCE_ICONS[type]} {EVIDENCE_LABELS[type]} <span style={{ color: '#ffd89a', fontSize: 10 }}>· önerilen</span>
                            </span>
                            {!done && <button className="evidence-checklist__action" onClick={() => handleAdd(type)}>Ekle</button>}
                        </div>
                    );
                })}
                {optional.map(type => {
                    const done = isFulfilled(type);
                    return (
                        <div key={`opt-${type}`} className={`evidence-checklist__item ${done ? 'evidence-checklist__item--done' : ''}`}>
                            <span className="evidence-checklist__dot">{done ? '✓' : ''}</span>
                            <span className="evidence-checklist__label">
                                {EVIDENCE_ICONS[type]} {EVIDENCE_LABELS[type]}
                            </span>
                            <button className="evidence-checklist__action" onClick={() => handleAdd(type)}>+ Ekle</button>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// ─── Step Completion Panel ───
function StepCompletionPanel({ step, stepIndex, onComplete, onConfirm }) {
    const template = STEP_TEMPLATES[step.templateId] || {};
    const mode = template.completionMode || 'single';
    const required = template.evidenceRequired || [];
    const evidence = step.evidence || [];
    const missingRequired = required.filter(t => !evidence.some(ev => ev.type === t));
    const canComplete = missingRequired.length === 0;

    if (step.status === 'done') return null;
    if (step.owner !== 'shop' && mode !== 'two_party') {
        return (
            <div className="usta-confirm-hint">
                Bu adım <strong>{getOwnerLabel(step.owner)}</strong> tarafından tamamlanacak. Bekleniyor.
            </div>
        );
    }

    const shopConfirmed = step.confirmation?.shopConfirmed;

    const completeLabel = mode === 'two_party'
        ? (canComplete ? 'Onayla ve Müşteriye Gönder' : 'Yine de Onayla ve Gönder')
        : (canComplete ? 'Adımı Tamamlandı İşaretle' : 'Yine de Tamamlandı İşaretle');

    return (
        <div className="confirm-panel" style={{ marginTop: 14 }}>
            <div className="confirm-panel__prompt">
                <strong>Tamamlama modu:</strong> {COMPLETION_MODE_LABELS[mode]}
            </div>
            {!canComplete && (
                <div className="evidence-nudge">
                    <div className="evidence-nudge__title">
                        💡 <strong>{missingRequired.length}</strong> önerilen kanıt eksik
                    </div>
                    <div className="evidence-nudge__body">
                        Yüklerseniz güven puanınız artar ve müşteriyle şeffaflık güçlenir. Yine de yüklemeden tamamlayabilirsiniz — sadece skora düşük yansır.
                    </div>
                </div>
            )}
            {mode === 'two_party' && shopConfirmed && (
                <div className="confirm-panel__status">
                    <span>✓ Siz onayladınız</span>
                    <span>⏳ Müşteri onayı bekleniyor</span>
                </div>
            )}
            <div className="confirm-panel__actions">
                {mode === 'two_party' ? (
                    !shopConfirmed ? (
                        <button className={canComplete ? 'is-primary' : 'is-warn'} onClick={() => onConfirm(stepIndex, 'shop')}>
                            {completeLabel}
                        </button>
                    ) : (
                        <button disabled>Müşteri Onayı Bekleniyor</button>
                    )
                ) : (
                    <button className={canComplete ? 'is-primary' : 'is-warn'} onClick={() => onComplete(stepIndex, {})}>
                        {completeLabel}
                    </button>
                )}
            </div>
        </div>
    );
}

// ─── Collection Panel ───
function CollectionPanel({ caseData, stepIndex, onConfirmPayment }) {
    const payment = caseData.payments.schedule.find(p => p.stepIndex === stepIndex);
    if (!payment) return null;

    const fullyConfirmed = isPaymentFullyConfirmed(payment);

    return (
        <div className="collection-panel">
            <div className="collection-panel__title">💰 {payment.label}</div>
            <div className="collection-panel__row">
                <span>Tutar</span>
                <strong>₺{payment.amount.toLocaleString('tr-TR')}</strong>
            </div>
            <div className="collection-panel__row">
                <span>Yöntem</span>
                <strong>{payment.method ? ({ platform: 'Platform', cash: 'Nakit', bank_transfer: 'Havale', credit_card: 'Kredi Kartı' }[payment.method]) : 'Seçilmedi'}</strong>
            </div>
            <div className="collection-panel__row">
                <span>Müşteri ödemesi</span>
                <strong>{payment.paidByCustomer ? '✓ Alındı' : '⏳ Bekliyor'}</strong>
            </div>
            <div className="collection-panel__row">
                <span>Sizin onayınız</span>
                <strong>{payment.confirmedByShop ? '✓ Onaylandı' : payment.method === 'platform' ? 'Otomatik' : '⏳ Bekliyor'}</strong>
            </div>
            {!fullyConfirmed && payment.paidByCustomer && !payment.confirmedByShop && payment.method !== 'platform' && (
                <div className="collection-panel__actions">
                    <button className="is-primary" onClick={() => onConfirmPayment(payment.id)}>
                        Ödemeyi Aldığımı Onayla
                    </button>
                </div>
            )}
            {fullyConfirmed && (
                <div className="usta-confirm-hint" style={{ borderColor: 'rgba(52, 208, 122, 0.35)', color: '#bff5d6' }}>
                    Ödeme tamamen onaylandı.
                </div>
            )}
        </div>
    );
}

// ─── Adımsız Ek Ücret Formu (çekici, depolama, nakliye vb.) ───
function AddCostForm({ onSubmit }) {
    const [label, setLabel] = useState('');
    const [amount, setAmount] = useState('');
    const [reason, setReason] = useState('');
    const [open, setOpen] = useState(false);

    if (!open) {
        return (
            <button
                className="cta-btn cta-btn--outline"
                style={{ width: '100%', marginTop: 12, fontSize: 12, height: 40 }}
                onClick={() => setOpen(true)}
            >
                + Adımsız Ek Ücret Ekle
            </button>
        );
    }

    const handleSubmit = () => {
        const amt = parseInt(amount, 10);
        if (!label.trim() || !amt) return;
        onSubmit({
            id: `cost_${Date.now()}`,
            label: label.trim(),
            amount: amt,
            reason: reason.trim(),
            proposedBy: 'shop',
            proposedAt: new Date().toISOString(),
            status: 'pending',
        });
        setLabel(''); setAmount(''); setReason(''); setOpen(false);
    };

    return (
        <div className="add-cost-form">
            <div className="add-cost-form__title">🧾 Adımsız Ek Ücret</div>
            <div className="usta-confirm-hint" style={{ marginTop: 0, marginBottom: 10 }}>
                Çekici, depolama, nakliye gibi <strong>adımdan bağımsız</strong> bir ücret ekleyin. Süreç adımına bağlı ücretler için adımı öneriyle ekleyin.
            </div>
            <div className="add-cost-form__fields">
                <input placeholder="Kalem (ör: Çekici hizmeti)" value={label} onChange={e => setLabel(e.target.value)} />
                <input placeholder="Tutar (₺)" value={amount} onChange={e => setAmount(e.target.value)} inputMode="numeric" />
                <textarea placeholder="Gerekçe (müşteriye gösterilir)" value={reason} onChange={e => setReason(e.target.value)} />
            </div>
            <div className="add-cost-form__actions">
                <button onClick={() => setOpen(false)}>İptal</button>
                <button className="is-primary" onClick={handleSubmit}>Müşteriye Gönder</button>
            </div>
        </div>
    );
}

// ─── Counter-Propose Form (Ücretli Kabul) ───
function CounterProposeForm({ stepIndex, step, onSubmit, onCancel }) {
    const [amount, setAmount] = useState('');
    const [reason, setReason] = useState('');

    const handleSubmit = () => {
        const amt = parseInt(amount, 10);
        if (!amt || !reason.trim()) return;
        onSubmit(stepIndex, {
            cost: { amount: amt, description: step.title },
            reason: reason.trim(),
        });
    };

    return (
        <div className="counter-propose-form">
            <div className="counter-propose-form__title">₺ Ücretli Kabul — {step.title}</div>
            <div className="usta-confirm-hint" style={{ marginTop: 0, marginBottom: 10 }}>
                Müşterinin isteğini kabul ediyorsunuz ancak bu adım ücret gerektiriyor. Tutarı ve gerekçeyi girin; müşteri onaylarsa ücret sürece eklenir.
            </div>
            <div className="add-cost-form__fields">
                <input placeholder="Tutar (₺)" value={amount} onChange={e => setAmount(e.target.value)} inputMode="numeric" />
                <textarea placeholder="Gerekçe (ör: Arka balatalar da bitmiş)" value={reason} onChange={e => setReason(e.target.value)} />
            </div>
            <div className="add-cost-form__actions">
                <button onClick={onCancel}>İptal</button>
                <button className="is-primary" onClick={handleSubmit}>Müşteriye Gönder</button>
            </div>
        </div>
    );
}

// ─── Step Score Preview ───
function StepScorePreview({ step }) {
    const score = computeStepScore(step);
    if (score.maxPossible === 0) return null;

    const pct = score.percentage;
    const hint = pct >= 80
        ? 'Harika! Bu adım güven puanınıza güçlü katkı sağlıyor.'
        : pct >= 50
            ? 'Daha fazla kanıt ekleyerek puanı yükseltin.'
            : 'Zorunlu kanıtları yüklemeden puan düşük kalır.';

    return (
        <div className="step-score-preview">
            <div className="step-score-ring" style={{ '--score': pct }}>
                <span>{pct}%</span>
            </div>
            <div className="step-score-preview__copy">
                <div className="step-score-preview__label">Adım Puanı</div>
                <div className="step-score-preview__hint">{hint}</div>
            </div>
        </div>
    );
}

// ─── Step Modal ───
function StepModal({
    step, stepIndex, onClose, caseData, onCompleteStep, onProposeStep,
    onApproveProposal, onRejectProposal, onRetractProposal, onCounterPropose,
    onAddEvidence, onConfirmStep, onConfirmPayment, onAddAdditionalCost,
}) {
    if (!step) return null;
    const [addStepTitle, setAddStepTitle] = useState('');
    const [addStepCost, setAddStepCost] = useState('');
    const [addStepReason, setAddStepReason] = useState('');
    const [showAddStep, setShowAddStep] = useState(false);
    const [showCounter, setShowCounter] = useState(false);

    const template = STEP_TEMPLATES[step.templateId] || {};
    const pendingPayment = caseData.payments.schedule.find(p => p.stepIndex === stepIndex && !p.paid);
    const paidPayment = caseData.payments.schedule.find(p => p.stepIndex === stepIndex && p.paid);
    const anyPayment = pendingPayment || paidPayment;

    const isProposed = step.status === 'proposed';
    const isRejected = step.status === 'rejected';
    const interactionMode = classifyStepInteraction(step);
    const isReview = interactionMode === 'review';
    const awaitingFrom = step.proposal?.awaitingFrom;
    const proposedBy = step.proposal?.proposedBy;
    const needsShopAction = isProposed && awaitingFrom === 'shop';
    const shopAwaitingCustomer = isProposed && awaitingFrom === 'customer';

    return (
        <div className="step-modal-overlay" onClick={onClose} style={{ zIndex: 10000 }}>
            <div className="step-modal-card" onClick={e => e.stopPropagation()}>
                <div className="step-modal-header">
                    <div className="step-modal-title">
                        {step.title}
                        {isProposed && <span className="proposal-pill" style={{ marginLeft: 8 }}>Önerildi</span>}
                        {isRejected && <span className="proposal-pill proposal-pill--rejected" style={{ marginLeft: 8 }}>Reddedildi</span>}
                    </div>
                    <button className="sub-header__action" onClick={onClose}>✕</button>
                </div>
                <div className="step-modal-scroll">
                    <div className={`collab-tag collab-tag--${step.owner} mb-12`} style={{ display: 'inline-block' }}>
                        {getOwnerLabel(step.owner)}
                    </div>

                    <div className="detail-block__text">
                        {step.data?.description || step.data?.liveUpdate || step.data?.notes || template.description || step.title}
                    </div>

                    {/* Proposal detail panel */}
                    {(isProposed || isRejected) && (
                        <div className="proposal-detail">
                            <div className="proposal-detail__row">
                                <span>Öneren</span>
                                <strong>{proposedBy === 'shop' ? 'Usta' : 'Müşteri'}</strong>
                            </div>
                            {step.proposal?.reason && (
                                <div className="proposal-detail__row">
                                    <span>Gerekçe</span>
                                    <strong>{step.proposal.reason}</strong>
                                </div>
                            )}
                            {step.cost && (
                                <div className="proposal-detail__row">
                                    <span>Ücret</span>
                                    <strong>₺{step.cost.amount.toLocaleString('tr-TR')} — {step.cost.description}</strong>
                                </div>
                            )}
                            {step.counterProposal && (
                                <>
                                    <div className="proposal-detail__row">
                                        <span>Karşı Teklif</span>
                                        <strong>₺{step.counterProposal.cost.amount.toLocaleString('tr-TR')}</strong>
                                    </div>
                                    {step.counterProposal.reason && (
                                        <div className="proposal-detail__row">
                                            <span>Karşı Gerekçe</span>
                                            <strong>{step.counterProposal.reason}</strong>
                                        </div>
                                    )}
                                </>
                            )}
                            {isRejected && step.rejection && (
                                <div className="proposal-detail__row">
                                    <span>Reddeden</span>
                                    <strong>{step.rejection.actor === 'shop' ? 'Usta' : 'Müşteri'} — {step.rejection.reason}</strong>
                                </div>
                            )}
                        </div>
                    )}

                    {step.data?.faultCodes && (
                        <div className="fault-code-list mt-12">
                            {step.data.faultCodes.map((code, i) => <div key={i} className="fault-code-item"><div className="fault-code-id">{code}</div></div>)}
                        </div>
                    )}

                    {step.data?.items && (
                        <div className="itemized-list mt-12">
                            {step.data.items.map((item, i) => <div key={i} className="itemized-row"><span>{item.name}</span><span>₺{item.price.toLocaleString('tr-TR')}</span></div>)}
                        </div>
                    )}

                    {step.data?.photos > 0 && (
                        <div className="gallery-grid mt-12">
                            {Array.from({ length: Math.min(step.data.photos, 4) }).map((_, i) => <div key={i} className="gallery-item">📷</div>)}
                            {step.data.videos > 0 && <div className="gallery-item">🎥</div>}
                        </div>
                    )}

                    {/* Dispute banner */}
                    {step.dispute && (
                        <div className={`dispute-banner dispute-banner--${step.dispute.status}`}>
                            <div className="dispute-banner__title">
                                {step.dispute.status === 'open' ? '⚠ Açık İtiraz' : '✓ İtiraz Çözüldü'}
                            </div>
                            <div className="dispute-banner__body">
                                {step.dispute.reason || 'Müşteri bu adıma itiraz etti.'}
                            </div>
                        </div>
                    )}

                    {/* Proposal actions — usta tarafı */}
                    {needsShopAction && !showCounter && (
                        <div className="proposal-modal-actions">
                            <button className="is-primary" onClick={() => { onApproveProposal(stepIndex); onClose(); }}>
                                ✓ Kabul Et
                            </button>
                            <button onClick={() => setShowCounter(true)}>₺ Ücretli Kabul</button>
                            <button className="is-danger" onClick={() => {
                                const reason = window.prompt('Ret gerekçesi (opsiyonel):') || '';
                                onRejectProposal(stepIndex, reason);
                                onClose();
                            }}>✕ Reddet</button>
                        </div>
                    )}
                    {needsShopAction && showCounter && (
                        <CounterProposeForm
                            stepIndex={stepIndex}
                            step={step}
                            onSubmit={(idx, payload) => { onCounterPropose(idx, payload); setShowCounter(false); onClose(); }}
                            onCancel={() => setShowCounter(false)}
                        />
                    )}
                    {shopAwaitingCustomer && (
                        <div className="proposal-modal-actions">
                            <span className="proposal-waiting">⏳ Müşteri yanıtı bekleniyor</span>
                            <button className="is-danger" onClick={() => { onRetractProposal(stepIndex); onClose(); }}>
                                Öneriyi Geri Çek
                            </button>
                        </div>
                    )}

                    {/* Review mode hint */}
                    {isReview && (
                        <div className="review-hint">📖 Bu adım tamamlandı — geçmiş kaydı inceliyorsunuz. İtiraz gelirse burada görünür.</div>
                    )}

                    {/* Evidence Upload — not for proposed/rejected */}
                    {!isProposed && !isRejected && (
                        <EvidenceUploadPanel step={step} stepIndex={stepIndex} onAddEvidence={onAddEvidence} />
                    )}

                    {/* Score Preview */}
                    {step.status !== 'pending' && !isProposed && !isRejected && <StepScorePreview step={step} />}

                    {/* Step Completion — sadece aktif adımlar için */}
                    {!isProposed && !isRejected && !isReview && (
                        <StepCompletionPanel
                            step={step}
                            stepIndex={stepIndex}
                            onComplete={onCompleteStep}
                            onConfirm={onConfirmStep}
                        />
                    )}

                    {/* Collection */}
                    {anyPayment && !isProposed && !isRejected && (
                        <CollectionPanel
                            caseData={caseData}
                            stepIndex={stepIndex}
                            onConfirmPayment={onConfirmPayment}
                        />
                    )}

                    {/* Adımsız Ek Ücret */}
                    {step.status === 'active' && step.owner === 'shop' && (
                        <AddCostForm onSubmit={onAddAdditionalCost} />
                    )}

                    {/* Ara Adım Öner — sadece aktif adımdan sonra önerilir */}
                    {!isProposed && !isRejected && !isReview && step.status === 'active' && (
                        <>
                            <button className="cta-btn cta-btn--outline mt-12" style={{ height: 36, fontSize: 12, width: '100%' }}
                                onClick={() => setShowAddStep(!showAddStep)}>
                                ➕ Bu Adımdan Sonra Ara Adım Öner
                            </button>
                            {showAddStep && (
                                <div className="add-step-form mt-12" style={{ padding: 12, background: 'var(--surface)', borderRadius: 'var(--r-md)', border: '1px solid var(--border)' }}>
                                    <div className="usta-confirm-hint" style={{ marginTop: 0, marginBottom: 10 }}>
                                        Müşteri onayı sonrası adım sürece eklenir. Ücret girerseniz müşteri onaylayıp ödeme yöntemi seçer.
                                    </div>
                                    <input className="form-input" placeholder="Adım adı (ör: Turbo Hortumu Değişimi)" value={addStepTitle} onChange={e => setAddStepTitle(e.target.value)} style={{ marginBottom: 8 }} />
                                    <input className="form-input" placeholder="Ek ücret ₺ (opsiyonel)" value={addStepCost} onChange={e => setAddStepCost(e.target.value)} style={{ marginBottom: 8 }} inputMode="numeric" />
                                    <textarea className="form-input" placeholder="Gerekçe (müşteriye gösterilir)" value={addStepReason} onChange={e => setAddStepReason(e.target.value)} style={{ marginBottom: 8, minHeight: 60 }} />
                                    <button className="cta-btn" style={{ height: 36, fontSize: 12 }}
                                        onClick={() => {
                                            const title = addStepTitle.trim();
                                            if (!title) return;
                                            const amt = parseInt(addStepCost, 10);
                                            onProposeStep(stepIndex, {
                                                title,
                                                proposedBy: 'shop',
                                                owner: 'shop',
                                                icon: '🔧',
                                                reason: addStepReason.trim(),
                                                cost: amt > 0 ? { amount: amt, description: title } : null,
                                                data: { description: title },
                                            });
                                            setAddStepTitle(''); setAddStepCost(''); setAddStepReason(''); setShowAddStep(false); onClose();
                                        }}>Müşteriye Öner</button>
                                </div>
                            )}
                        </>
                    )}
                </div>
                <div className="step-modal-footer">
                    <button className="cta-btn cta-btn--outline" onClick={onClose}>Kapat</button>
                </div>
            </div>
        </div>
    );
}

// ─── Case Header (with TrustScoreBar) ───
function CaseHeader({ caseData }) {
    const progress = getProgress(caseData);
    const trust = computeCaseTrustScore(caseData);
    const colorMap = { green: 'var(--green)', orange: 'var(--orange)', red: 'var(--red)' };
    const color = colorMap[caseData.color] || 'var(--accent)';

    return (
        <div className="case-header">
            <div className="case-header__top">
                <div className="case-header__info">
                    <div className="case-header__pill" style={{ background: `${color}22`, color, borderColor: `${color}44` }}>
                        {caseData.label}
                    </div>
                    <h2 className="case-header__title">
                        {caseData.steps[0]?.data?.description?.slice(0, 30) || caseData.label} — {caseData.vehicle.model}
                    </h2>
                    <div className="case-header__meta">
                        {caseData.vehicle.plate}
                        {caseData.shop?.name && ` · ${caseData.shop.name}`}
                    </div>
                </div>
                <div className="usta-mode-badge">USTA 🔧</div>
            </div>
            <div className="case-header__progress">
                <div className="case-header__progress-track">
                    <div className="case-header__progress-fill" style={{ width: `${progress.percent}%`, background: color }} />
                </div>
                <span className="case-header__progress-label">{progress.done}/{progress.total}</span>
            </div>
            {trust.percentage > 0 && (
                <div className="trust-score-bar" style={{ '--score': trust.percentage }}>
                    <div className="trust-score-bar__ring">
                        <span>{trust.percentage}</span>
                    </div>
                    <div className="trust-score-bar__copy">
                        <div className="trust-score-bar__label">Güven Puanı</div>
                        <div className="trust-score-bar__title">
                            {trust.percentage >= 80 ? 'Mükemmel — müşteriye güven veriyor' : trust.percentage >= 50 ? 'İyi gidiyor, daha fazla kanıt ekleyin' : 'Puan düşük — zorunlu kanıtlar eksik'}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Payment Bar ───
function PaymentBar({ payments }) {
    if (!payments.total || payments.schedule.length === 0) return null;
    const paid = getPaidAmount({ payments });
    const pct = Math.round((paid / payments.total) * 100);

    const pendingExtras = (payments.additionalCosts || []).filter(c => !c.approvedByCustomer && !c.rejectedByCustomer && c.linkedStepIndex == null);
    const pendingExtrasTotal = pendingExtras.reduce((s, c) => s + (c.amount || 0), 0);
    const pendingPaymentConfirm = payments.schedule.filter(p => p.paidByCustomer && !p.confirmedByShop && p.method !== 'platform').length;

    return (
        <div className="payment-bar">
            <div className="payment-bar__info">
                <span className="payment-bar__label">💰 Tahsilat</span>
                <span className="payment-bar__amount">₺{paid.toLocaleString('tr-TR')} / ₺{payments.total.toLocaleString('tr-TR')}</span>
            </div>
            <div className="payment-bar__track">
                <div className="payment-bar__fill" style={{ width: `${pct}%` }} />
            </div>
            {(pendingExtrasTotal > 0 || pendingPaymentConfirm > 0) && (
                <div className="payment-bar__extras">
                    {pendingExtrasTotal > 0 && <>Ek ücret bekliyor: ₺{pendingExtrasTotal.toLocaleString('tr-TR')}</>}
                    {pendingExtrasTotal > 0 && pendingPaymentConfirm > 0 && ' · '}
                    {pendingPaymentConfirm > 0 && <>{pendingPaymentConfirm} ödeme onayınızı bekliyor</>}
                </div>
            )}
        </div>
    );
}

// ─── Main Screen ───
export default function UstaJobDetailScreen() {
    const params = getNavParams();
    const caseId = params.caseId || 'usta_demo_mekanik';
    const {
        caseData,
        completeStep,
        proposeStep,
        approveStepProposal,
        rejectStepProposal,
        retractStepProposal,
        counterProposeStep,
        addEvidence,
        confirmStep,
        confirmPayment,
        addAdditionalCost,
    } = useCaseState(caseId);
    const [selectedStepIndex, setSelectedStepIndex] = useState(null);

    const handleApproveProposal = (idx) => approveStepProposal(idx, { actor: 'shop' });
    const handleRejectProposal = (idx, reason) => {
        const r = reason ?? window.prompt('Ret gerekçesi (opsiyonel):') ?? '';
        rejectStepProposal(idx, { actor: 'shop', reason: r });
    };
    const handleRetractProposal = (idx) => retractStepProposal(idx, 'shop');
    const handleStartCounter = (idx) => setSelectedStepIndex(idx);

    return (<>
        <SubHeader title="İş Detayı" />
        <div className="screen-scroll screen-scroll--sub">
            <CaseHeader caseData={caseData} />

            <div className="timeline-v3">
                {caseData.steps.map((step, idx) => (
                    <StepRow
                        key={`${step.templateId}-${idx}`}
                        step={step}
                        index={idx}
                        payments={caseData.payments}
                        onClick={setSelectedStepIndex}
                        isLast={idx === caseData.steps.length - 1}
                        onApproveProposal={handleApproveProposal}
                        onRejectProposal={handleRejectProposal}
                        onRetractProposal={handleRetractProposal}
                        onStartCounter={handleStartCounter}
                    />
                ))}
            </div>

            <PaymentBar payments={caseData.payments} />

            <div className="usta-customer-info">
                <div className="usta-customer-info__title">Müşteri Bilgisi</div>
                <div className="usta-customer-info__row">
                    <span>Araç</span>
                    <span>{caseData.vehicle.plate} · {caseData.vehicle.model}</span>
                </div>
            </div>

            {selectedStepIndex !== null && (
                <StepModal
                    step={caseData.steps[selectedStepIndex]}
                    stepIndex={selectedStepIndex}
                    caseData={caseData}
                    onCompleteStep={completeStep}
                    onProposeStep={proposeStep}
                    onApproveProposal={handleApproveProposal}
                    onRejectProposal={(idx, reason) => rejectStepProposal(idx, { actor: 'shop', reason })}
                    onRetractProposal={handleRetractProposal}
                    onCounterPropose={counterProposeStep}
                    onAddEvidence={addEvidence}
                    onConfirmStep={confirmStep}
                    onConfirmPayment={confirmPayment}
                    onAddAdditionalCost={addAdditionalCost}
                    onClose={() => setSelectedStepIndex(null)}
                />
            )}
            <div className="bottom-spacer" />
        </div>
    </>);
}
