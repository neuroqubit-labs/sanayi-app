import { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import SubHeader from '../components/SubHeader';
import { ChevronRight, XIcon, StarIcon, MapPin, Phone, MessageSquare, Share2, Heart, Tool, CheckCircle, ShieldCheck, Clock6 } from '../components/Icons';
import { SectionBlock, SummaryPanel, PrimaryActionBar, ReasonBadge, StatusPill } from '../components/DecisionPrimitives';
import { useCaseState } from '../hooks/useCaseState';
import {
    STEP_TEMPLATES,
    getOwnerLabel,
    getProgress,
    getPaidAmount,
    classifyStepInteraction,
} from '../data/lifecycleEngine';

const EVIDENCE_ICONS = {
    photo: '📷',
    video: '🎥',
    document: '📄',
    invoice: '🧾',
    fault_codes: '🛠️',
    note: '📝',
    itemized_list: '📋',
};

const PAYMENT_METHOD_LABELS = {
    platform: { icon: '🛡️', label: 'Platform' },
    cash: { icon: '💵', label: 'Nakit' },
    bank_transfer: { icon: '🏦', label: 'Havale' },
    credit_card: { icon: '💳', label: 'Kredi Kartı' },
};
import { MATCH_CANDIDATES } from '../data/matchingData';
import { SERVICE_PACKAGES } from '../data/purchaseData';
import { getNavParams, setNavParams } from '../hooks/useQuoteState';

// ─── Step Row: Progressive Disclosure ───
function StepRow({ step, index, onClick, payments, isLast, onRetractProposal }) {
    const paidPayment = payments?.schedule?.find(p => p.stepIndex === index && p.paid);
    const pendingPayment = payments?.schedule?.find(p => p.stepIndex === index && !p.paid);
    const ownerLabel = getOwnerLabel(step.owner);

    const template = STEP_TEMPLATES[step.templateId] || {};
    const evidenceCount = step.evidence?.length || 0;
    const isDisputed = step.dispute && step.dispute.status === 'open';
    const isConfirming = step.status === 'confirming'
        || (step.status === 'active' && step.confirmation?.shopConfirmed && !step.confirmation?.customerConfirmed);
    const needsCustomerAction = isConfirming && step.confirmation?.shopConfirmed;
    const isProposed = step.status === 'proposed';
    const isRejected = step.status === 'rejected';
    const awaitingFrom = step.proposal?.awaitingFrom;
    const proposedBy = step.proposal?.proposedBy;
    const customerAwaitingShop = isProposed && awaitingFrom === 'shop' && proposedBy === 'customer';
    const needsCustomerApproval = isProposed && awaitingFrom === 'customer';
    const hasCost = step.cost && step.cost.amount > 0;
    const counterCost = step.counterProposal?.cost;

    // Smart preview text
    const getPreview = () => {
        if (paidPayment) return `✓ ${paidPayment.label} tamamlandı (₺${paidPayment.amount.toLocaleString('tr-TR')})`;
        if (step.data?.liveUpdate) return step.data.liveUpdate;
        if (step.data?.description) return step.data.description;
        if (step.data?.notes) return step.data.notes;
        if (step.data?.faultCodes) return `Arıza kodu: ${step.data.faultCodes.join(', ')}`;
        if (step.data?.items) return `₺${step.data.items.reduce((s, i) => s + i.price, 0).toLocaleString('tr-TR')} tutarında teklif`;
        if (step.data?.approved) return 'Onay verildi';
        if (step.data?.invoiceUploaded) return `${step.data.partName} — Fatura yüklendi`;
        if (step.status === 'pending') return null;
        return STEP_TEMPLATES[step.templateId]?.description || '';
    };

    const preview = getPreview();

    // Substep progress for process-type steps
    const renderSubsteps = () => {
        if (!step.substeps || step.status !== 'active') return null;
        return (
            <div className="substep-list">
                {step.substeps.map(sub => (
                    <div key={sub.id} className={`substep-item substep-item--${sub.status}`}>
                        <span className="substep-dot">{sub.status === 'done' ? '✓' : sub.status === 'active' ? '●' : '○'}</span>
                        <span>{sub.title}</span>
                    </div>
                ))}
            </div>
        );
    };

    const mode = classifyStepInteraction(step);
    const clickable = mode !== 'archive';
    const rowClass = `step-row step-row--${step.status}${isConfirming ? ' step-row--confirming' : ''}${isDisputed ? ' step-row--disputed' : ''}${mode === 'archive' ? ' step-row--archive' : ''}`;

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
                        <div className={`collab-tag collab-tag--${step.owner}`}>{ownerLabel}</div>
                        <div className="step-row__title">
                            {step.title}
                            {step.isCustom && !isProposed && !isRejected && <span className="step-custom-badge">Eklendi</span>}
                            {isProposed && <span className="proposal-pill">Önerildi{hasCost ? ` · ₺${step.cost.amount.toLocaleString('tr-TR')}` : ''}</span>}
                            {isRejected && <span className="proposal-pill proposal-pill--rejected">Reddedildi</span>}
                            {paidPayment && <span className="pay-status">Ödendi</span>}
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
                        {proposedBy === 'shop' ? 'Usta bu ara adımı öneriyor.' : 'Öneriniz ustaya iletildi.'}
                        {step.proposal?.reason ? ` — "${step.proposal.reason}"` : ''}
                        {counterCost ? ` · Karşı teklif: ₺${counterCost.amount.toLocaleString('tr-TR')}` : ''}
                    </div>
                )}
                {isRejected && step.rejection?.reason && (
                    <div className="step-row__preview">Gerekçe: {step.rejection.reason}</div>
                )}
                {needsCustomerApproval && (
                    <div className="step-row__badges">
                        <span className="step-row__badge step-row__badge--confirm">✨ Detay için dokunun — Kabul / Reddet</span>
                    </div>
                )}
                {customerAwaitingShop && (
                    <div className="proposal-inline-actions" onClick={e => e.stopPropagation()}>
                        <span className="proposal-waiting">⏳ Ustadan yanıt bekleniyor</span>
                        <button className="proposal-btn proposal-btn--reject" onClick={stopAnd(() => onRetractProposal?.(index))}>Geri Çek</button>
                    </div>
                )}
                {step.status !== 'pending' && !isProposed && !isRejected && (
                    <div className="step-row__badges">
                        {evidenceCount > 0 && (
                            <span className="step-row__badge step-row__badge--evidence">📎 {evidenceCount} kanıt</span>
                        )}
                        {needsCustomerAction && (
                            <span className="step-row__badge step-row__badge--confirm">⏳ Onayınız bekleniyor</span>
                        )}
                        {template.paymentGate && pendingPayment && step.status !== 'done' && (
                            <span className="step-row__badge step-row__badge--gate">🔒 Ödeme gerekli</span>
                        )}
                        {isDisputed && (
                            <span className="step-row__badge step-row__badge--dispute">! İtiraz açık</span>
                        )}
                    </div>
                )}
                {renderSubsteps()}
            </div>
        </div>
    );
}

// ─── Evidence Gallery (Customer view) ───
function EvidenceGallery({ step, stepIndex, onVerify }) {
    const evidence = step.evidence || [];
    if (evidence.length === 0) return null;

    return (
        <div>
            <div className="detail-block__title" style={{ fontSize: 12, marginTop: 16 }}>📎 Kanıtlar ({evidence.length})</div>
            <div className="evidence-gallery">
                {evidence.map(ev => {
                    const cls = ev.verified
                        ? 'evidence-item evidence-item--verified'
                        : 'evidence-item';
                    return (
                        <div key={ev.id} className={cls} onClick={() => !ev.verified && ev.uploadedBy === 'shop' && onVerify && onVerify(stepIndex, ev.id)}>
                            <div className="evidence-item__thumb">{EVIDENCE_ICONS[ev.type] || '📄'}</div>
                            <div className="evidence-item__label">{ev.description || ev.type}</div>
                            <div className="evidence-item__meta">{ev.uploadedBy === 'shop' ? 'Usta' : ev.uploadedBy === 'customer' ? 'Siz' : 'Sistem'}</div>
                            {ev.verified && <span className="evidence-badge evidence-badge--verified">✓ Onaylı</span>}
                            {!ev.verified && ev.uploadedBy === 'shop' && <span className="evidence-badge evidence-badge--pending">Doğrula</span>}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// ─── Two-Party Confirmation Panel (Customer) ───
function TwoPartyConfirmPanel({ step, stepIndex, onConfirm, onDispute }) {
    const template = STEP_TEMPLATES[step.templateId] || {};
    if (template.completionMode !== 'two_party') return null;
    if (!step.confirmation?.shopConfirmed) return null;
    if (step.confirmation?.customerConfirmed) return null;
    if (step.status === 'done') return null;

    return (
        <div className="confirm-panel">
            <div className="confirm-panel__prompt">
                Usta bu adımı tamamladı. Onayınız bekleniyor.
            </div>
            <div className="confirm-panel__status">
                <span>✓ Usta onayladı</span>
                <span>⏳ Sizin onayınız</span>
            </div>
            <div className="confirm-panel__actions">
                <button className="is-primary" onClick={() => onConfirm(stepIndex, 'customer')}>
                    Onaylıyorum
                </button>
                <button className="is-danger" onClick={() => onDispute(stepIndex)}>
                    İtiraz Et
                </button>
            </div>
        </div>
    );
}

// ─── Dispute Banner ───
function DisputeBanner({ step }) {
    if (!step.dispute) return null;
    return (
        <div className={`dispute-banner dispute-banner--${step.dispute.status}`}>
            <div className="dispute-banner__title">
                {step.dispute.status === 'open' ? '⚠ Açık İtirazınız' : '✓ İtiraz Çözüldü'}
            </div>
            <div className="dispute-banner__body">
                {step.dispute.reason || 'İtiraz kaydınız bulunuyor.'}
                {step.dispute.resolution && <><br/><strong>Çözüm:</strong> {step.dispute.resolution}</>}
            </div>
        </div>
    );
}

// ─── Additional Cost Banner (adımsız ek ücret — çekici, depolama, nakliye vb.) ───
function AdditionalCostBanner({ payments, onApprove, onReject }) {
    const pending = (payments?.additionalCosts || []).filter(c =>
        !c.approvedByCustomer && !c.rejectedByCustomer && c.linkedStepIndex == null
    );
    if (pending.length === 0) return null;
    return (
        <>
            {pending.map(cost => (
                <div key={cost.id} className="additional-cost-banner">
                    <div className="additional-cost-banner__title">🧾 Adımsız Ek Ücret</div>
                    <div className="additional-cost-banner__row">
                        <span>{cost.label}</span>
                        <strong>₺{cost.amount.toLocaleString('tr-TR')}</strong>
                    </div>
                    {cost.reason && (
                        <div className="additional-cost-banner__row" style={{ fontSize: 11 }}>
                            <em>{cost.reason}</em>
                        </div>
                    )}
                    <div className="additional-cost-banner__actions">
                        <button onClick={() => {
                            const reason = window.prompt('Ret gerekçesi (opsiyonel):') || '';
                            onReject && onReject(cost.id, reason);
                        }}>Reddet</button>
                        <button className="is-primary" onClick={() => onApprove(cost.id)}>Onayla</button>
                    </div>
                </div>
            ))}
        </>
    );
}

// ─── Payment Panel (Customer pays) ───
function PaymentPanel({ caseData, stepIndex, onMakePayment }) {
    const payment = caseData.payments.schedule.find(p => p.stepIndex === stepIndex && !p.paid);
    const [method, setMethod] = useState(null);

    if (!payment) return null;
    if (payment.paidByCustomer) {
        return (
            <div className="payment-status-dual">
                <span><strong>Ödeme Yapıldı</strong>{payment.method && ` (${PAYMENT_METHOD_LABELS[payment.method]?.label})`}</span>
                <span>
                    <strong>{payment.confirmedByShop ? '✓ Usta onayladı' : payment.method === 'platform' ? '✓ Otomatik' : '⏳ Usta onayı'}</strong>
                </span>
            </div>
        );
    }

    const methods = ['platform', 'cash', 'bank_transfer', 'credit_card'];

    return (
        <div style={{ marginTop: 16 }}>
            <div className="detail-block__title" style={{ fontSize: 12, marginBottom: 6 }}>
                💳 {payment.label} — ₺{payment.amount.toLocaleString('tr-TR')}
            </div>
            <div className="payment-method-selector">
                {methods.map(m => (
                    <button
                        key={m}
                        className={`payment-method-chip ${method === m ? 'payment-method-chip--active' : ''}`}
                        onClick={() => setMethod(m)}
                    >
                        <span className="payment-method-chip__icon">{PAYMENT_METHOD_LABELS[m].icon}</span>
                        {PAYMENT_METHOD_LABELS[m].label}
                    </button>
                ))}
            </div>
            <button
                className="cta-btn mt-12"
                disabled={!method}
                onClick={() => method && onMakePayment(payment.id, method)}
                style={{ width: '100%' }}
            >
                Ödeme Yap
            </button>
        </div>
    );
}

// ─── Proposal Panel (customer — kabul/ret + method seçici) ───
function ProposalActionPanel({ step, stepIndex, onApproveProposal, onRejectProposal, onRetractProposal, onClose }) {
    const [method, setMethod] = useState(null);
    const isProposed = step.status === 'proposed';
    if (!isProposed) return null;

    const awaitingFrom = step.proposal?.awaitingFrom;
    const proposedBy = step.proposal?.proposedBy;
    const customerAction = awaitingFrom === 'customer';
    const customerWaiting = awaitingFrom === 'shop' && proposedBy === 'customer';
    const hasCost = !!(step.cost && step.cost.amount > 0);
    const counterCost = step.counterProposal?.cost;
    const effectiveCost = counterCost || step.cost;
    const hasEffectiveCost = effectiveCost && effectiveCost.amount > 0;

    const methods = ['platform', 'cash', 'bank_transfer', 'credit_card'];

    if (customerWaiting) {
        return (
            <div className="proposal-modal-actions">
                <span className="proposal-waiting">⏳ Ustadan yanıt bekleniyor</span>
                <button className="is-danger" onClick={() => { onRetractProposal(stepIndex); onClose(); }}>
                    Öneriyi Geri Çek
                </button>
            </div>
        );
    }

    if (!customerAction) return null;

    const handleApprove = () => {
        if (hasEffectiveCost && !method) return;
        onApproveProposal(stepIndex, { actor: 'customer', paymentMethod: hasEffectiveCost ? method : null });
        onClose();
    };

    const handleReject = () => {
        const reason = window.prompt('Ret gerekçesi (opsiyonel):') || '';
        onRejectProposal(stepIndex, { actor: 'customer', reason });
        onClose();
    };

    return (
        <div className="proposal-accept-box">
            <div className="proposal-accept-box__title">
                {proposedBy === 'shop' ? 'Usta ara adım öneriyor' : 'Karşı teklifi incelediniz'}
            </div>
            {step.proposal?.reason && (
                <div className="proposal-accept-box__reason">"{step.proposal.reason}"</div>
            )}
            {hasEffectiveCost && (
                <div className="proposal-accept-box__cost">
                    Ücret: <strong>₺{effectiveCost.amount.toLocaleString('tr-TR')}</strong>
                    {counterCost && <span className="proposal-accept-box__tag">Karşı teklif</span>}
                </div>
            )}
            {counterCost && step.counterProposal?.reason && (
                <div className="proposal-accept-box__reason">Usta gerekçesi: "{step.counterProposal.reason}"</div>
            )}
            {hasEffectiveCost && (
                <>
                    <div className="detail-block__title" style={{ fontSize: 12, marginTop: 10, marginBottom: 6 }}>
                        Ödeme Yöntemi Seçin
                    </div>
                    <div className="payment-method-selector">
                        {methods.map(m => (
                            <button
                                key={m}
                                className={`payment-method-chip ${method === m ? 'payment-method-chip--active' : ''}`}
                                onClick={() => setMethod(m)}
                            >
                                <span className="payment-method-chip__icon">{PAYMENT_METHOD_LABELS[m].icon}</span>
                                {PAYMENT_METHOD_LABELS[m].label}
                            </button>
                        ))}
                    </div>
                </>
            )}
            <div className="proposal-accept-box__actions">
                <button className="is-danger" onClick={handleReject}>✕ Reddet</button>
                <button
                    className="is-primary"
                    disabled={hasEffectiveCost && !method}
                    onClick={handleApprove}
                >
                    ✓ Kabul Et{hasEffectiveCost && method === 'platform' ? ' ve Öde' : ''}
                </button>
            </div>
        </div>
    );
}

// ─── Step Modal: Customer-only ───
function StepModal({
    step, stepIndex, onClose, caseData,
    onMakePayment, onConfirmStep, onRaiseDispute, onVerifyEvidence,
    onApproveAdditionalCost, onApproveProposal, onRejectProposal, onRetractProposal,
}) {
    if (!step) return null;

    const template = STEP_TEMPLATES[step.templateId] || {};
    const pendingPayment = caseData.payments.schedule.find(p => p.stepIndex === stepIndex && !p.paid);
    const paidPayment = caseData.payments.schedule.find(p => p.stepIndex === stepIndex && p.paid);
    const isProposed = step.status === 'proposed';
    const isRejected = step.status === 'rejected';
    const mode = classifyStepInteraction(step);
    const isReview = mode === 'review';

    const handleDispute = (idx) => {
        const reason = typeof window !== 'undefined' ? window.prompt('İtiraz sebebinizi belirtin:') : '';
        if (reason && reason.trim()) {
            onRaiseDispute(idx, { reason: reason.trim(), raisedBy: 'customer' });
        }
    };

    const renderContent = () => {
        const d = step.data || {};

        // Info / Intake
        if (step.templateId === 'intake') return (
            <div>
                <div className="detail-block__text"><strong>{step.owner === 'customer' ? 'Sizin Talebiniz:' : 'Bildirim:'}</strong> "{d.description || 'Açıklama eklenmemiş'}"</div>
                {d.media && d.media.length > 0 && (
                    <div className="media-row mt-12">{d.media.map((m, i) => <div key={i} className="media-thumb">{m.includes('video') ? '🎥' : m.includes('audio') ? '🔊' : '📷'}</div>)}</div>
                )}
                {d.km && <div className="detail-block__text mt-8">Kilometre: {d.km} km</div>}
            </div>
        );

        // Upload / Tutanak
        if (step.templateId === 'tutanak') return (
            <div>
                <div className="detail-block__text">Kaza tutanağı {d.source === 'edevlet' ? 'E-Devlet üzerinden' : 'fotoğraf olarak'} yüklendi.</div>
                {d.verified && <div className="check-item check-item--done mt-8"><span>✓</span> Doğrulanmış</div>}
            </div>
        );

        // Process / Insurance file
        if (step.templateId === 'insurance_file') return (
            <div>
                <div className="detail-block__text">Sigorta dosya süreciniz devam ediyor.</div>
                {step.substeps && (
                    <div className="check-list mt-12">
                        {step.substeps.map(sub => (
                            <div key={sub.id} className={`check-item ${sub.status === 'done' ? 'check-item--done' : ''}`}>
                                <span>{sub.status === 'done' ? '✓' : '○'}</span> {sub.title}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );

        // Wait / Expert
        if (step.templateId === 'expert_report') return (
            <div>
                <div className="detail-block__text">Eksper incelemesi {step.status === 'done' ? 'tamamlandı' : 'bekleniyor'}.</div>
                {d.expertName && <div className="detail-block__text mt-8">Eksper: {d.expertName}</div>}
                {d.reportDate && <div className="detail-block__text">Rapor Tarihi: {d.reportDate}</div>}
            </div>
        );

        // Inspect / Diagnosis
        if (step.templateId === 'diagnosis') return (
            <div>
                {d.faultCodes && d.faultCodes.length > 0 && (
                    <div className="fault-code-list">
                        {d.faultCodes.map((code, i) => <div key={i} className="fault-code-item"><div className="fault-code-id">{code}</div></div>)}
                    </div>
                )}
                {d.notes && <div className="detail-block__text mt-12"><strong>Usta Tespit:</strong> {d.notes}</div>}
            </div>
        );

        // Proposal / Quote
        if (step.templateId === 'quote') return (
            <div>
                {d.items && (
                    <div className="itemized-list">
                        {d.items.map((item, i) => <div key={i} className="itemized-row"><span>{item.name}</span><span>₺{item.price.toLocaleString('tr-TR')}</span></div>)}
                        <div className="itemized-row" style={{ borderTop: '2px solid var(--border)', paddingTop: '8px', marginTop: '8px' }}>
                            <strong>Toplam</strong><strong>₺{d.items.reduce((s, i) => s + i.price, 0).toLocaleString('tr-TR')}</strong>
                        </div>
                    </div>
                )}
            </div>
        );

        // Approve
        if (step.templateId === 'approval') return (
            <div className="detail-block__text">
                {d.approved ? 'Onayınız alındı.' : 'Teklifi onaylayarak işleme başlatabilirsiniz.'}
                {pendingPayment && (
                    <div className="summary-card mt-12">
                        <div className="summary-row"><span>{pendingPayment.label}</span><strong>₺{pendingPayment.amount.toLocaleString('tr-TR')}</strong></div>
                        <div className="summary-row"><span>Durum</span><span>Bekleniyor</span></div>
                    </div>
                )}
                {paidPayment && (
                    <div className="summary-card mt-12">
                        <div className="summary-row"><span>{paidPayment.label}</span><strong>₺{paidPayment.amount.toLocaleString('tr-TR')}</strong></div>
                        <div className="summary-row"><span>Durum</span><span className="status-text--done">✓ Ödendi</span></div>
                    </div>
                )}
            </div>
        );

        // Procure / Parts
        if (step.templateId === 'parts') return (
            <div>
                {d.partName && <div className="check-list"><div className="check-item check-item--done"><span>✓</span> {d.partName} — Fatura Mevcut</div></div>}
                {d.invoiceUploaded && (
                    <div className="detail-block mt-16">
                        <div className="detail-block__title" style={{ fontSize: '12px' }}>Parça Faturaları & Kanıtlar</div>
                        <div className="proof-grid mt-8">
                            <div className="proof-card"><span className="proof-card__icon">📄</span><span className="proof-card__label">RESMI_FATURA</span></div>
                            <div className="proof-card"><span className="proof-card__icon">📦</span><span className="proof-card__label">PARÇA_KUTUSU</span></div>
                        </div>
                        {d.invoiceAmount && <button className="cta-btn cta-btn--outline mt-12" style={{ height: '40px', fontSize: '12px', borderStyle: 'dashed' }}>Resmi Faturayı Görüntüle (₺{d.invoiceAmount.toLocaleString('tr-TR')})</button>}
                    </div>
                )}
            </div>
        );

        // Work / Repair / Service
        if (['repair', 'service', 'custom_repair'].includes(step.templateId)) return (
            <div>
                {d.photos > 0 && <div className="gallery-grid mb-16">{Array.from({ length: Math.min(d.photos || 0, 4) }).map((_, i) => <div key={i} className="gallery-item">📷</div>)}{d.videos > 0 && <div className="gallery-item">🎥</div>}</div>}
                {d.liveUpdate && <div className="detail-block__text"><strong>Canlı Güncelleme:</strong> {d.liveUpdate}</div>}
                {pendingPayment && (
                    <div className="summary-card mt-12">
                        <div className="summary-row"><span>{pendingPayment.label}</span><strong>₺{pendingPayment.amount.toLocaleString('tr-TR')}</strong></div>
                        <div className="summary-row"><span>Durum</span><span>{paidPayment ? <span className="status-text--done">✓ Ödendi</span> : 'Bekleniyor'}</span></div>
                    </div>
                )}
            </div>
        );

        // Verify / Test
        if (['test', 'checkup'].includes(step.templateId)) return (
            <div>
                {step.templateId === 'test' && <div className="map-placeholder" style={{ height: '100px' }}>📍 Test Sürüşü Rotası</div>}
                <div className="check-list mt-16">
                    <div className="check-item check-item--done"><span>✓</span> Arıza kontrolü yapıldı</div>
                    <div className="check-item"><span>○</span> OBD hata silme</div>
                </div>
            </div>
        );

        // Handoff / Delivery
        if (step.templateId === 'delivery') return (
            <div>
                <div className="detail-block__text">Aracınız hazır. Teslim almadan önce kalan bakiyeyi kapatabilirsiniz.</div>
                {pendingPayment && (
                    <div className="summary-card mt-12">
                        <div className="summary-row"><span>{pendingPayment.label}</span><strong>₺{pendingPayment.amount.toLocaleString('tr-TR')}</strong></div>
                        <div className="summary-row"><span>Durum</span><span>{paidPayment ? <span className="status-text--done">✓ Ödendi</span> : 'Bekleniyor'}</span></div>
                    </div>
                )}
            </div>
        );

        // Rate
        if (step.templateId === 'rating') return (
            <div>
                <div className="detail-block__text">İşlem tamamlandı. Değerlendirme yapabilirsiniz.</div>
                <div className="rating-system mt-16">
                    <div className="rating-stars" style={{ justifyContent: 'center' }}>⭐⭐⭐⭐⭐</div>
                    <button className="cta-btn mt-12">Puanla</button>
                </div>
            </div>
        );

        // Schedule / Appointment
        if (step.templateId === 'appointment') return (
            <div className="detail-block__text">
                {d.confirmed ? 'Randevunuz onaylandı.' : 'Servis randevu için sizinle iletişime geçecek.'}
            </div>
        );

        // Insurance close
        if (step.templateId === 'insurance_close') return (
            <div className="detail-block__text">Sigorta dosyası kapanış işlemleri devam ediyor. Ödeme mutabakatı sağlanacak.</div>
        );

        // Fallback
        return <div className="detail-block__text">{template.description || step.title}</div>;
    };

    return (
        <div className="step-modal-overlay" onClick={onClose} style={{ zIndex: 10000 }}>
            <div className="step-modal-card" onClick={e => e.stopPropagation()}>
                <div className="step-modal-header">
                    <div className="step-modal-title">
                        {step.title}
                        {isProposed && <span className="proposal-pill" style={{ marginLeft: 8 }}>Önerildi</span>}
                        {isRejected && <span className="proposal-pill proposal-pill--rejected" style={{ marginLeft: 8 }}>Reddedildi</span>}
                    </div>
                    <button className="sub-header__action" onClick={onClose}><XIcon /></button>
                </div>
                <div className="step-modal-scroll">
                    <div className={`collab-tag collab-tag--${step.owner} mb-12`} style={{ display: 'inline-block' }}>
                        {step.owner === 'shop' ? 'Ustadan Bilgi' : step.owner === 'customer' ? 'Sizin İşleminiz' : step.owner === 'system' ? 'Sistem İşlemi' : 'Harici İşlem'}
                    </div>

                    {/* Proposal detail */}
                    {(isProposed || isRejected) && (
                        <div className="proposal-detail">
                            <div className="proposal-detail__row">
                                <span>Öneren</span>
                                <strong>{step.proposal?.proposedBy === 'shop' ? 'Usta' : 'Siz'}</strong>
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
                                    <strong>₺{step.cost.amount.toLocaleString('tr-TR')}</strong>
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
                                            <span>Usta Gerekçesi</span>
                                            <strong>{step.counterProposal.reason}</strong>
                                        </div>
                                    )}
                                </>
                            )}
                            {isRejected && step.rejection && (
                                <div className="proposal-detail__row">
                                    <span>Reddeden</span>
                                    <strong>{step.rejection.actor === 'shop' ? 'Usta' : 'Siz'} — {step.rejection.reason || '—'}</strong>
                                </div>
                            )}
                        </div>
                    )}

                    {isReview && (
                        <div className="review-hint">📖 Bu adım tamamlandı — geçmiş kaydı inceliyorsunuz.</div>
                    )}

                    {!isProposed && !isRejected && renderContent()}

                    {/* Proposal action */}
                    {isProposed && (
                        <ProposalActionPanel
                            step={step}
                            stepIndex={stepIndex}
                            onApproveProposal={onApproveProposal}
                            onRejectProposal={onRejectProposal}
                            onRetractProposal={onRetractProposal}
                            onClose={onClose}
                        />
                    )}

                    {/* Dispute banner */}
                    {!isProposed && !isRejected && <DisputeBanner step={step} />}

                    {/* Evidence gallery */}
                    {!isProposed && !isRejected && <EvidenceGallery step={step} stepIndex={stepIndex} onVerify={onVerifyEvidence} />}

                    {/* Two-party confirmation */}
                    {!isProposed && !isRejected && (
                        <TwoPartyConfirmPanel
                            step={step}
                            stepIndex={stepIndex}
                            onConfirm={onConfirmStep}
                            onDispute={handleDispute}
                        />
                    )}

                    {/* Payment panel */}
                    {!isProposed && !isRejected && step.status === 'active' && pendingPayment && !pendingPayment.paidByCustomer && (
                        <PaymentPanel
                            caseData={caseData}
                            stepIndex={stepIndex}
                            onMakePayment={onMakePayment}
                        />
                    )}
                    {!isProposed && !isRejected && (paidPayment || (pendingPayment && pendingPayment.paidByCustomer)) && (
                        <div style={{ marginTop: 12 }}>
                            <PaymentPanel
                                caseData={caseData}
                                stepIndex={stepIndex}
                                onMakePayment={onMakePayment}
                            />
                        </div>
                    )}

                    {/* Raise dispute (for done steps without existing dispute) */}
                    {step.status === 'done' && !step.dispute && step.owner === 'shop' && (
                        <button
                            className="cta-btn cta-btn--outline mt-12"
                            style={{ width: '100%', height: 38, fontSize: 12, color: '#ffcccc', borderColor: 'rgba(255,79,79,0.3)' }}
                            onClick={() => handleDispute(stepIndex)}
                        >
                            ⚠ Bu Adıma İtiraz Et
                        </button>
                    )}
                </div>
                <div className="step-modal-footer">
                    <button className="cta-btn cta-btn--outline" onClick={onClose}>Kapat</button>
                </div>
            </div>
        </div>
    );
}

// ─── Case Header (Customer-only, no mode toggle) ───
function CaseHeader({ caseData }) {
    const progress = getProgress(caseData);
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
                        {caseData.shop?.name && `${caseData.shop.name} · `}{caseData.vehicle.plate}
                    </div>
                </div>
            </div>
            <div className="case-header__progress">
                <div className="case-header__progress-track">
                    <div className="case-header__progress-fill" style={{ width: `${progress.percent}%`, background: color }} />
                </div>
                <span className="case-header__progress-label">{progress.done}/{progress.total}</span>
            </div>
        </div>
    );
}

// ─── Payment Summary Bar ───
function PaymentBar({ payments }) {
    if (!payments.total || payments.schedule.length === 0) return null;
    const paid = getPaidAmount({ payments });
    const pct = Math.round((paid / payments.total) * 100);

    const pendingExtras = (payments.additionalCosts || []).filter(c => !c.approvedByCustomer && !c.rejectedByCustomer && c.linkedStepIndex == null);
    const pendingExtrasTotal = pendingExtras.reduce((s, c) => s + (c.amount || 0), 0);
    const unconfirmedByShop = payments.schedule.filter(p => p.paidByCustomer && !p.confirmedByShop && p.method !== 'platform').length;

    return (
        <div className="payment-bar">
            <div className="payment-bar__info">
                <span className="payment-bar__label">💳 Ödeme</span>
                <span className="payment-bar__amount">₺{paid.toLocaleString('tr-TR')} / ₺{payments.total.toLocaleString('tr-TR')}</span>
            </div>
            <div className="payment-bar__track">
                <div className="payment-bar__fill" style={{ width: `${pct}%` }} />
            </div>
            {(pendingExtrasTotal > 0 || unconfirmedByShop > 0) && (
                <div className="payment-bar__extras" style={{ marginTop: 6, fontSize: 11, color: '#ffd1a8', fontWeight: 600 }}>
                    {pendingExtrasTotal > 0 && <>Ek ücret onayı bekliyor: ₺{pendingExtrasTotal.toLocaleString('tr-TR')}</>}
                    {pendingExtrasTotal > 0 && unconfirmedByShop > 0 && ' · '}
                    {unconfirmedByShop > 0 && <>{unconfirmedByShop} ödeme usta onayında</>}
                </div>
            )}
        </div>
    );
}

// ─── Önerim Var Modal (müşteri ücretsiz ara adım önerir) ───
function CustomerProposeModal({ onSubmit, onClose }) {
    const [title, setTitle] = useState('');
    const [reason, setReason] = useState('');

    return (
        <div className="step-modal-overlay" onClick={onClose} style={{ zIndex: 10000 }}>
            <div className="step-modal-card" onClick={e => e.stopPropagation()} style={{ maxHeight: '80vh' }}>
                <div className="step-modal-header">
                    <div className="step-modal-title">Ara Adım Öner</div>
                    <button className="sub-header__action" onClick={onClose}><XIcon /></button>
                </div>
                <div className="step-modal-scroll">
                    <div className="detail-block__text mb-12">
                        Ustadan ek bir işlem istemek ister misiniz? Ücret usta tarafından değerlendirilecek, gerekirse karşı teklif alabilirsiniz.
                    </div>
                    <input className="form-input" placeholder="Ne istiyorsunuz? (ör: Frenleri de kontrol et)" value={title} onChange={e => setTitle(e.target.value)} style={{ marginBottom: 8 }} />
                    <textarea className="form-input" placeholder="Gerekçe (opsiyonel)" value={reason} onChange={e => setReason(e.target.value)} style={{ marginBottom: 8, minHeight: 60 }} />
                </div>
                <div className="step-modal-footer">
                    <button className="cta-btn cta-btn--outline" onClick={onClose}>İptal</button>
                    <button
                        className="cta-btn"
                        disabled={!title.trim()}
                        onClick={() => {
                            onSubmit(title.trim(), reason.trim());
                            onClose();
                        }}
                    >Ustaya Gönder</button>
                </div>
            </div>
        </div>
    );
}

// ─── Main Screen (Customer view) ───
export function HasarTakipScreen() {
    const params = getNavParams();
    const caseId = params.caseId || 'demo_mekanik';
    const { navigate } = useApp();
    const {
        caseData,
        makePayment,
        confirmStep,
        raiseDispute,
        verifyEvidence,
        approveAdditionalCost,
        rejectAdditionalCost,
        proposeStep,
        approveStepProposal,
        rejectStepProposal,
        retractStepProposal,
    } = useCaseState(caseId);
    const [selectedStepIndex, setSelectedStepIndex] = useState(null);
    const [showProposeModal, setShowProposeModal] = useState(false);

    const caseStatus = caseData.status || 'active';
    const isPreProcess = caseStatus === 'pool' || caseStatus === 'quoted' || caseStatus === 'draft';

    const handleCustomerPropose = (title, reason) => {
        const steps = caseData.steps;
        const activeIdx = steps.findIndex(s => s.status === 'active');
        const lastDoneIdx = (() => {
            for (let i = steps.length - 1; i >= 0; i--) if (steps[i].status === 'done') return i;
            return 0;
        })();
        const afterIndex = activeIdx >= 0 ? activeIdx : lastDoneIdx;
        proposeStep(afterIndex, {
            title,
            proposedBy: 'customer',
            owner: 'shop',
            icon: '🔧',
            reason,
            cost: null,
            data: { description: title },
        });
    };

    return (<>
        <SubHeader title="Vaka Takibi" />
        <div className="screen-scroll screen-scroll--sub">
            {isPreProcess && (
                <div className="pool-status-banner" onClick={() => navigate('screen-vaka-havuz')}>
                    <span>⏳</span>
                    <span className="pool-status-banner__text">
                        {caseStatus === 'quoted' ? 'Teklifler geldi! Incele ve sureci baslat.' : 'Vakan havuzda. Teklifler bekleniyor...'}
                    </span>
                    <span className="pool-status-banner__action">Gor →</span>
                </div>
            )}
            <CaseHeader caseData={caseData} />

            <AdditionalCostBanner
                payments={caseData.payments}
                onApprove={approveAdditionalCost}
                onReject={rejectAdditionalCost}
            />

            <div className="timeline-v3">
                {caseData.steps.map((step, idx) => (
                    <StepRow
                        key={`${step.templateId}-${idx}`}
                        step={step}
                        index={idx}
                        payments={caseData.payments}
                        onClick={setSelectedStepIndex}
                        isLast={idx === caseData.steps.length - 1}
                        onRetractProposal={retractStepProposal}
                    />
                ))}
            </div>

            {!isPreProcess && caseStatus !== 'completed' && (
                <button
                    className="cta-btn cta-btn--outline"
                    style={{ width: '100%', height: 40, fontSize: 12, marginTop: 12, borderStyle: 'dashed' }}
                    onClick={() => setShowProposeModal(true)}
                >
                    + Önerim Var (Ara Adım Öner)
                </button>
            )}

            <PaymentBar payments={caseData.payments} />

            {selectedStepIndex !== null && (
                <StepModal
                    step={caseData.steps[selectedStepIndex]}
                    stepIndex={selectedStepIndex}
                    caseData={caseData}
                    onMakePayment={makePayment}
                    onConfirmStep={confirmStep}
                    onRaiseDispute={raiseDispute}
                    onVerifyEvidence={verifyEvidence}
                    onApproveAdditionalCost={approveAdditionalCost}
                    onApproveProposal={approveStepProposal}
                    onRejectProposal={rejectStepProposal}
                    onRetractProposal={retractStepProposal}
                    onClose={() => setSelectedStepIndex(null)}
                />
            )}
            {showProposeModal && (
                <CustomerProposeModal
                    onSubmit={handleCustomerPropose}
                    onClose={() => setShowProposeModal(false)}
                />
            )}
            <div className="bottom-spacer"></div>
        </div>
    </>);
}

// --- ORIGINAL SUB-SCREENS RESTORED ---

export function ServisDetayScreen() {
    const { navigate } = useApp();
    return (
        <div className="screen-scroll screen-scroll--sub">
            <div className="workshop-hero">
                <div className="workshop-gallery">
                    <div className="workshop-gallery__main">📸</div>
                    <div className="workshop-gallery__side">
                        <div>📸</div>
                        <div className="workshop-gallery__more">+8</div>
                    </div>
                </div>
                <div className="workshop-info-overlay">
                    <h1 className="workshop-title">AutoPro Premium Servis</h1>
                    <div className="workshop-tags">
                        <span className="workshop-tag">BMW Uzmanı</span>
                        <span className="workshop-tag">Garantili İşçilik</span>
                    </div>
                </div>
            </div>

            <div className="detail-section">
                <div className="detail-header-row">
                    <div className="rating-badge">
                        <span className="rating-score">4.9</span>
                        <div className="rating-stars">⭐⭐⭐⭐⭐</div>
                        <span className="rating-count">(128 Değerlendirme)</span>
                    </div>
                    <div className="action-buttons-row">
                        <button className="icon-action-btn"><Heart /></button>
                        <button className="icon-action-btn"><Share2 /></button>
                    </div>
                </div>

                <div className="quick-stats mt-20">
                    <div className="stat-item">
                        <div className="stat-icon"><CheckCircle /></div>
                        <div className="stat-label">Onaylı Servis</div>
                    </div>
                    <div className="stat-item">
                        <div className="stat-icon"><ShieldCheck /></div>
                        <div className="stat-label">%100 Şeffaflık</div>
                    </div>
                    <div className="stat-item">
                        <div className="stat-icon"><Clock6 /></div>
                        <div className="stat-label">Hızlı Teslim</div>
                    </div>
                </div>

                <div className="tab-container mt-24">
                    <div className="tab-headers">
                        <div className="tab-header tab-header--active">Hizmetler</div>
                        <div className="tab-header">Yorumlar</div>
                        <div className="tab-header">Hakkımızda</div>
                    </div>
                    <div className="tab-content mt-16">
                        <div className="service-row">
                            <div className="service-info">
                                <div className="service-name">Periyodik Bakım</div>
                                <div className="service-desc">Yağ, filtre ve 32 nokta kontrolü</div>
                            </div>
                            <div className="service-price">₺1.200'den başlayan</div>
                        </div>
                        <div className="service-row">
                            <div className="service-info">
                                <div className="service-name">Fren Sistemi Revizyonu</div>
                                <div className="service-desc">Disk ve balata değişimi</div>
                            </div>
                            <div className="service-price">Ücretsiz Ekspertiz</div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="floating-footer">
                <button className="btn-contact btn-contact--chat"><MessageSquare /> Mesaj Gönder</button>
                <button className="btn-contact btn-contact--primary" onClick={() => navigate('screen-hasar-flow')}>
                    <Tool /> Teklif Al
                </button>
            </div>
        </div>
    );
}

export function HasarDetailScreen() {
    return (
        <div className="screen-scroll screen-scroll--sub">
            <SubHeader title="Hasar Detayı" />
            <div className="detail-block">
                <div className="detail-label">Vaka Numarası</div>
                <div className="detail-value">#HK-82412</div>
            </div>
            <div className="detail-block">
                <div className="detail-label">Açıklama</div>
                <p>Park halindeyken sol kapıya sürtme sonucu oluşmuş yüzeysel hasar ve çizikler.</p>
            </div>
        </div>
    );
}

export function UstaProfilScreen() {
    const { navigate } = useApp();
    const params = getNavParams();

    // Provider eslestirme: ID → isim → fallback
    const provider = MATCH_CANDIDATES.find(c => c.id === params.providerId)
        || MATCH_CANDIDATES.find(c => c.name === params.providerName)
        || null;

    // Bu provider'in satin alinabilir paketleri
    const packages = provider
        ? SERVICE_PACKAGES.filter(p => p.provider.id === provider.id)
        : [];

    const isServis = provider?.isServis || false;
    const screenTitle = isServis ? 'Servis Profili' : 'Usta Profili';

    // Fallback: provider yoksa minimal profil
    if (!provider) {
        return (
            <div className="screen-scroll screen-scroll--sub">
                <SubHeader title={screenTitle} />
                <div className="p-16">
                    <div className="usta-profil-hero">
                        <div className="usta-profil-hero__avatar">👨‍🔧</div>
                        <h1 className="usta-profil-hero__name">{params.providerName || 'Usta'}</h1>
                        {params.providerRating && (
                            <div className="usta-profil-hero__stats">
                                ⭐ {params.providerRating}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    const handlePackageClick = (pkg) => {
        setNavParams({ packageId: pkg.id });
        navigate('screen-paket-detay');
    };

    const summaryRows = [
        { label: 'Fiyat Bandi', value: `₺${provider.priceMin.toLocaleString('tr-TR')} – ${provider.priceMax.toLocaleString('tr-TR')}` },
        { label: 'Hizmet Modu', value: provider.serviceMode },
        { label: 'Tahmini Sure', value: provider.detail.timeline },
        { label: 'Garanti', value: provider.detail.guarantee },
        { label: 'Pickup', value: provider.detail.pickup },
    ];

    return (
        <div className="screen-scroll screen-scroll--sub">
            <SubHeader title={screenTitle} />
            <div className="p-16">
                {/* Hero Section */}
                <div className="usta-profil-hero">
                    <div className="usta-profil-hero__avatar">{provider.initials}</div>
                    <div className="usta-profil-hero__name-row">
                        <h1 className="usta-profil-hero__name">{provider.name}</h1>
                        {provider.verified && <span className="usta-profil-hero__verified">✓</span>}
                        {isServis && <StatusPill label="Servis" tone="info" />}
                    </div>
                    <div className="usta-profil-hero__stats">
                        <span>⭐ {provider.rating.toFixed(1)}</span>
                        <span>·</span>
                        <span>{provider.reviews} yorum</span>
                        <span>·</span>
                        <span>📍 {provider.distanceKm} km</span>
                    </div>
                    <div className="usta-profil-hero__tags">
                        {provider.tags.map(tag => (
                            <span key={tag} className="tag">{tag}</span>
                        ))}
                    </div>
                    <div className={`usta-profil-hero__status usta-profil-hero__status--${provider.openState === 'acik' ? 'open' : 'closed'}`}>
                        <span>{provider.openState === 'acik' ? '🟢 Acik' : '🔴 Kapali'}</span>
                        <span>· {provider.eta}</span>
                    </div>
                </div>

                {/* Trust Badges */}
                {provider.trustBadges && (
                    <div className="trust-strip mt-16">
                        {provider.trustBadges.map(b => (
                            <ReasonBadge key={b.label} label={b.label} tone={b.tone} />
                        ))}
                    </div>
                )}

                {/* Hakkinda */}
                <SectionBlock title="Hakkinda" className="mt-24">
                    <p className="usta-profil-about">{provider.note}</p>
                </SectionBlock>

                {/* Kampanya & Paketler */}
                {packages.length > 0 && (
                    <SectionBlock title="Kampanya & Paketler" className="mt-24">
                        <div className="usta-profil-packages">
                            {packages.map(pkg => (
                                <button
                                    key={pkg.id}
                                    className="usta-profil-package"
                                    onClick={() => handlePackageClick(pkg)}
                                >
                                    <span className="usta-profil-package__icon">{pkg.icon}</span>
                                    <div className="usta-profil-package__body">
                                        <span className="usta-profil-package__title">{pkg.title}</span>
                                        <span className="usta-profil-package__desc">{pkg.description}</span>
                                    </div>
                                    <div className="usta-profil-package__price-col">
                                        {pkg.originalPrice && (
                                            <span className="usta-profil-package__old-price">₺{pkg.originalPrice.toLocaleString('tr-TR')}</span>
                                        )}
                                        <span className="usta-profil-package__price">₺{pkg.price.toLocaleString('tr-TR')}</span>
                                    </div>
                                    <span className="usta-profil-package__arrow">→</span>
                                </button>
                            ))}
                        </div>
                    </SectionBlock>
                )}

                {/* Hizmet Detaylari */}
                <SectionBlock title="Hizmet Detaylari" className="mt-24">
                    <SummaryPanel rows={summaryRows} note={provider.priceNote} />
                </SectionBlock>

                {/* Uzmanlik Alanlari */}
                <SectionBlock title="Uzmanlik Alanlari" className="mt-24">
                    <div className="tag-cloud">
                        {provider.detail.expertiseTags.map(tag => (
                            <span key={tag} className="tag">{tag}</span>
                        ))}
                    </div>
                </SectionBlock>

                {/* Yorumlar */}
                {provider.detail.recentReviews && provider.detail.recentReviews.length > 0 && (
                    <SectionBlock title="Yorumlar" className="mt-24">
                        <div className="usta-profil-reviews">
                            {provider.detail.recentReviews.map((review, i) => (
                                <div key={i} className="usta-profil-review">
                                    <div className="usta-profil-review__stars">⭐⭐⭐⭐⭐</div>
                                    <p className="usta-profil-review__text">"{review}"</p>
                                </div>
                            ))}
                        </div>
                    </SectionBlock>
                )}

                {/* Actions */}
                <div className="mt-32 mb-32">
                    <PrimaryActionBar
                        stacked
                        primaryAction={{
                            label: 'Teklif Iste',
                            onClick: () => navigate('screen-eslestir'),
                        }}
                        secondaryAction={{
                            label: 'Mesaj Gonder',
                            onClick: () => {},
                        }}
                    />
                </div>
            </div>
        </div>
    );
}

export function TeklifScreen() {
    const { navigate } = useApp();
    // Dynamic import not ideal but keeps SubScreens simple
    const [quotes, setQuotes] = useState([]);

    useEffect(() => {
        try {
            const raw = localStorage.getItem('sanayi_quotes');
            if (raw) {
                const all = JSON.parse(raw);
                setQuotes(all.filter(q => q.status === 'pending'));
            }
        } catch { /* ignore */ }
    }, []);

    return (
        <div className="screen-scroll screen-scroll--sub">
            <SubHeader title="Teklifler" />
            <div className="p-16">
                {quotes.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-state__icon">📭</div>
                        <div className="empty-state__text">Henuz aktif teklif yok</div>
                    </div>
                ) : (
                    quotes.map(q => (
                        <div key={q.id} className="record-card" style={{ marginBottom: 12 }}>
                            <div className="record-card__title">{q.providerName}</div>
                            <div className="record-card__desc">{q.timeline} · {q.guarantee}</div>
                            <div className="record-card__footer mt-12">
                                <strong className="text-accent" style={{ fontSize: '18px' }}>₺{q.total?.toLocaleString('tr-TR')}</strong>
                                <button
                                    className="cta-btn"
                                    style={{ width: 'auto', padding: '8px 24px' }}
                                    onClick={() => {
                                        localStorage.setItem('sanayi_nav_params', JSON.stringify({ quoteId: q.id, caseId: q.caseId }));
                                        navigate('screen-teklif-detay');
                                    }}
                                >
                                    Incele
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}

export function ServisTakipScreen() {
    const { navigate } = useApp();
    return (
        <div className="screen-scroll screen-scroll--sub">
            <SubHeader title="Onarım Takibi" />
            <div className="p-16">
                <div className="status-banner status-banner--active">Onarım Devam Ediyor</div>
                <div className="timeline-v2 mt-24">
                    <div className="timeline-item timeline-item--done">
                        <div className="timeline-label">Araç Teslim Alındı</div>
                        <div className="timeline-time">Dün 14:20</div>
                    </div>
                    <div className="timeline-item timeline-item--active">
                        <div className="timeline-label">Parça Bekleniyor</div>
                        <div className="timeline-time">Tahmini: Bugün 17:00</div>
                    </div>
                </div>
                <button className="cta-btn mt-32" onClick={() => navigate('screen-hasar-takip')}>Detaylı Akışı Görüntüle</button>
            </div>
        </div>
    );
}

// CekiciScreen removed — now in CekiciFlow.jsx
