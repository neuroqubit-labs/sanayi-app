import { useEffect, useState } from 'react';
import { FlowStepShell, PrimaryActionBar, ReasonBadge, SectionBlock, StatusPill, SummaryPanel } from '../components/DecisionPrimitives';
import { SlotComparison, AppointmentConfirm } from '../components/SlotPicker';
import SubHeader from '../components/SubHeader';
import { useApp } from '../context/AppContext';
import { DEMO_POOL_CASE, DEMO_QUOTES, DEMO_QUOTE_REQUESTS, CANCELLATION_POLICY } from '../data/quoteData';
import { useCaseState } from '../hooks/useCaseState';
import { useQuoteState, getNavParams, setNavParams } from '../hooks/useQuoteState';

/* ══════════════════════════════════════════════════════════
   VakaHavuzScreen — Case pool / waiting room
   ══════════════════════════════════════════════════════════ */

export function VakaHavuzScreen() {
    const { navigate } = useApp();
    const params = getNavParams();
    const caseId = params.caseId || 'demo_pool';
    const { caseData, markQuoted } = useCaseState(caseId);
    const { quotes, quoteRequests, mockReceiveQuote } = useQuoteState(caseData.id || 'case_pool_001');

    const poolCase = caseData.status === 'pool' || caseData.status === 'quoted' || caseData.status === 'draft'
        ? caseData
        : { ...DEMO_POOL_CASE };

    // Mock: simulate receiving quotes after mount
    const [mockTriggered, setMockTriggered] = useState(false);
    useEffect(() => {
        if (!mockTriggered && quotes.length === 0) {
            setMockTriggered(true);
            mockReceiveQuote(poolCase.id, 'autopro', 'AutoPro Servis');
        }
    }, [mockTriggered, quotes.length, mockReceiveQuote, poolCase.id]);

    // When quotes arrive, mark case as quoted
    useEffect(() => {
        if (quotes.length > 0 && poolCase.status === 'pool') {
            markQuoted();
        }
    }, [quotes.length, poolCase.status, markQuoted]);

    const pendingQuotes = quotes.filter(q => q.status === 'pending');
    const statusLabel = pendingQuotes.length > 0
        ? `${pendingQuotes.length} Teklif Geldi`
        : 'Havuzda';
    const statusTone = pendingQuotes.length > 0 ? 'success' : 'info';

    const intakeDesc = poolCase.intakeData?.description || poolCase.steps?.[0]?.data?.description || '';
    const aiSummary = poolCase.aiInsights?.summary || '';
    const costRange = poolCase.aiInsights?.estimatedCost;

    return (
        <div className="screen-scroll screen-scroll--sub">
            <SubHeader title="Vaka Durumu" />
            <div className="p-16">
                {/* Case Summary */}
                <div className="quote-case-summary">
                    <div className="quote-case-summary__header">
                        <div>
                            <div className="quote-case-summary__title">{poolCase.label || 'Mekanik Ariza'}</div>
                            <div className="quote-case-summary__vehicle">{poolCase.vehicle?.plate} · {poolCase.vehicle?.model}</div>
                        </div>
                        <StatusPill label={statusLabel} tone={statusTone} />
                    </div>
                    {intakeDesc && <p className="quote-case-summary__desc">{intakeDesc}</p>}
                    {aiSummary && (
                        <div className="quote-case-summary__ai">
                            <span className="quote-case-summary__ai-icon">🤖</span>
                            <span>{aiSummary}</span>
                        </div>
                    )}
                    {costRange && (
                        <div className="quote-case-summary__cost">
                            Tahmini: <strong>{costRange.min?.toLocaleString('tr-TR')} - {costRange.max?.toLocaleString('tr-TR')} TL</strong>
                        </div>
                    )}
                </div>

                {/* Incoming Quotes */}
                <SectionBlock title="Gelen Teklifler" className="mt-24">
                    {pendingQuotes.length === 0 ? (
                        <div className="empty-state">
                            <div className="empty-state__icon">⏳</div>
                            <div className="empty-state__text">Henuz teklif yok. Ustalar vakani inceliyor...</div>
                        </div>
                    ) : (
                        <div className="quote-list">
                            {pendingQuotes.map(quote => (
                                <button
                                    key={quote.id}
                                    className="quote-card"
                                    onClick={() => {
                                        setNavParams({ ...params, quoteId: quote.id, caseId });
                                        navigate('screen-teklif-detay');
                                    }}
                                >
                                    <div
                                        className="quote-card__header quote-card__header--link"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setNavParams({ ...params, providerId: quote.providerId, providerName: quote.providerName });
                                            navigate('screen-usta-profil');
                                        }}
                                    >
                                        <div className="quote-card__avatar">{quote.providerInitials}</div>
                                        <div className="quote-card__info">
                                            <div className="quote-card__name">{quote.providerName}</div>
                                            <div className="quote-card__meta">
                                                ⭐ {quote.providerRating?.toFixed(1)} · {quote.providerReviews} yorum
                                            </div>
                                        </div>
                                        <span className="quote-card__profile-hint">Profil →</span>
                                    </div>
                                    <div className="quote-card__body">
                                        <div className="quote-card__price">₺{quote.total?.toLocaleString('tr-TR')}</div>
                                        <div className="quote-card__details">
                                            <span>{quote.timeline}</span>
                                            <span>·</span>
                                            <span>{quote.guarantee}</span>
                                        </div>
                                    </div>
                                    <div className="quote-card__footer">
                                        <ReasonBadge label={`AI Uyum: %${quote.aiCompatibilityScore}`} tone={quote.aiCompatibilityScore >= 85 ? 'success' : 'neutral'} />
                                        <span className="quote-card__arrow">→</span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </SectionBlock>

                {/* Sent Requests */}
                {quoteRequests.length > 0 && (
                    <SectionBlock title="Gonderilen Istekler" className="mt-24">
                        {quoteRequests.map(req => (
                            <button
                                key={req.id}
                                className="quote-request-row quote-request-row--link"
                                onClick={() => {
                                    setNavParams({ ...params, providerId: req.providerId, providerName: req.providerName });
                                    navigate('screen-usta-profil');
                                }}
                            >
                                <span className="quote-request-row__name">{req.providerName}</span>
                                <StatusPill
                                    label={req.status === 'quoted' ? 'Teklif geldi' : req.status === 'declined' ? 'Reddetti' : 'Bekliyor'}
                                    tone={req.status === 'quoted' ? 'success' : req.status === 'declined' ? 'urgent' : 'neutral'}
                                />
                            </button>
                        ))}
                    </SectionBlock>
                )}

                {/* Action */}
                <div className="mt-32">
                    <PrimaryActionBar
                        primaryAction={{ label: 'Usta Ara', onClick: () => navigate('screen-eslestir') }}
                        secondaryAction={{ label: 'Ana Sayfa', onClick: () => navigate('screen-home') }}
                    />
                </div>
            </div>
        </div>
    );
}

/* ══════════════════════════════════════════════════════════
   TeklifDetayScreen — Single quote detail view
   ══════════════════════════════════════════════════════════ */

export function TeklifDetayScreen() {
    const { navigate, goBack } = useApp();
    const params = getNavParams();
    const { quotes, quoteRequests } = useQuoteState(params.caseId ? undefined : 'case_pool_001');

    const quote = quotes.find(q => q.id === params.quoteId) || DEMO_QUOTES[0];

    // Find matching request to get customer slots
    const matchingRequest = quoteRequests.find(r => r.providerId === quote.providerId && r.caseId === quote.caseId)
        || DEMO_QUOTE_REQUESTS.find(r => r.providerId === quote.providerId);
    const customerSlots = matchingRequest?.customerSlots || [];
    const providerSlot = quote.providerSlot || null;
    const slotMatched = providerSlot && customerSlots.some(s =>
        s.day === providerSlot.day && (s.ranges.includes(providerSlot.range) || s.ranges.includes('flexible'))
    );

    const summaryRows = [
        { label: 'Usta', value: quote.providerName },
        { label: 'Toplam', value: `₺${quote.total?.toLocaleString('tr-TR')}` },
        { label: 'Sure', value: quote.timeline },
        { label: 'Garanti', value: quote.guarantee },
        { label: 'Gecerlilik', value: quote.validUntil },
    ];

    return (
        <div className="screen-scroll screen-scroll--sub">
            <SubHeader title="Teklif Detayi" />
            <div className="p-16">
                {/* Provider Header */}
                <button
                    className="teklif-provider-header teklif-provider-header--clickable"
                    onClick={() => {
                        setNavParams({ ...params, providerId: quote.providerId, providerName: quote.providerName });
                        navigate('screen-usta-profil');
                    }}
                >
                    <div className="teklif-provider-header__avatar">{quote.providerInitials}</div>
                    <div>
                        <div className="teklif-provider-header__name">{quote.providerName}</div>
                        <div className="teklif-provider-header__meta">⭐ {quote.providerRating?.toFixed(1)} · {quote.providerReviews} yorum</div>
                    </div>
                    <span className="teklif-provider-header__arrow">→</span>
                </button>

                {/* Trust Badges */}
                {quote.trustBadges && (
                    <div className="trust-strip mt-12">
                        {quote.trustBadges.map(b => <ReasonBadge key={b.label} label={b.label} tone={b.tone} />)}
                    </div>
                )}

                {/* AI Compatibility */}
                <div className="teklif-ai-score mt-16">
                    <span className="teklif-ai-score__label">🤖 AI Uyum Skoru</span>
                    <div className="teklif-ai-score__bar">
                        <div className="teklif-ai-score__fill" style={{ width: `${quote.aiCompatibilityScore}%` }} />
                    </div>
                    <span className="teklif-ai-score__value">%{quote.aiCompatibilityScore}</span>
                </div>

                {/* Itemized Breakdown */}
                <SectionBlock title="Maliyet Detayi" className="mt-24">
                    <div className="quote-breakdown">
                        {quote.items?.map((item, i) => (
                            <div key={i} className="quote-breakdown__row">
                                <span>{item.name}</span>
                                <span>{item.price === 0 ? 'Ucretsiz' : `₺${item.price.toLocaleString('tr-TR')}`}</span>
                            </div>
                        ))}
                        <div className="quote-breakdown__total">
                            <span>Toplam</span>
                            <span>₺{quote.total?.toLocaleString('tr-TR')}</span>
                        </div>
                    </div>
                </SectionBlock>

                {/* Terms & Conditions */}
                <SectionBlock title="Sartlar" className="mt-24">
                    <p className="teklif-terms">{quote.terms}</p>
                </SectionBlock>

                {/* Provider Note */}
                {quote.providerNote && (
                    <SectionBlock title="Usta Notu" className="mt-24">
                        <div className="teklif-note">
                            <span className="teklif-note__icon">💬</span>
                            <p>{quote.providerNote}</p>
                        </div>
                    </SectionBlock>
                )}

                {/* Slot Comparison — Randevu Eslestirme */}
                {(customerSlots.length > 0 || providerSlot) && (
                    <SectionBlock title="Randevu Zamani" className="mt-24">
                        <SlotComparison
                            customerSlots={customerSlots}
                            providerSlot={providerSlot}
                            matched={slotMatched}
                        />
                    </SectionBlock>
                )}

                {/* Summary */}
                <SummaryPanel rows={summaryRows} className="mt-24" />

                {/* Actions */}
                <div className="mt-32 mb-32">
                    <PrimaryActionBar
                        stacked
                        primaryAction={{
                            label: 'Bu Teklifi Kabul Et',
                            onClick: () => {
                                setNavParams({ ...params, quoteId: quote.id });
                                navigate('screen-kesin-kabul');
                            },
                        }}
                        secondaryAction={{
                            label: 'Geri Don',
                            onClick: goBack,
                        }}
                    />
                </div>
            </div>
        </div>
    );
}

/* ══════════════════════════════════════════════════════════
   KesinKabulScreen — Firm commitment / intent confirmation
   ══════════════════════════════════════════════════════════ */

export function KesinKabulScreen() {
    const { navigate } = useApp();
    const params = getNavParams();
    const caseId = params.caseId || 'demo_pool';
    const { confirmCase } = useCaseState(caseId);
    const { quotes, acceptQuote } = useQuoteState(undefined);

    const quote = quotes.find(q => q.id === params.quoteId) || DEMO_QUOTES[0];
    const providerSlot = quote.providerSlot || null;

    const [firmAcceptance, setFirmAcceptance] = useState(false);
    const [cancellationPolicy, setCancellationPolicy] = useState(false);
    const [contactPermission, setContactPermission] = useState(false);
    const [appointmentAccepted, setAppointmentAccepted] = useState(false);
    const [policyExpanded, setPolicyExpanded] = useState(false);

    const allChecked = firmAcceptance && cancellationPolicy && contactPermission && (!providerSlot || appointmentAccepted);

    const handleConfirm = () => {
        acceptQuote(quote.id);
        confirmCase({ name: quote.providerName }, { providerSlot });
        navigate('screen-hasar-takip');
    };

    const summaryRows = [
        { label: 'Usta', value: quote.providerName },
        { label: 'Tutar', value: `₺${quote.total?.toLocaleString('tr-TR')}` },
        { label: 'Sure', value: quote.timeline },
        { label: 'Garanti', value: quote.guarantee },
    ];

    return (
        <div className="screen-scroll screen-scroll--sub">
            <SubHeader title="Kesin Kabul" />
            <div className="p-16">
                <FlowStepShell
                    progress={100}
                    title="Kesin Kabul Beyani"
                    helper="Bu adim, hem senin hem ustanin zamanini korur. Onaylayarak sureci baslatmis olursun."
                    summaryRows={summaryRows}
                    primaryAction={{
                        label: 'Onayla & Sureci Baslat',
                        onClick: handleConfirm,
                        disabled: !allChecked,
                    }}
                    secondaryAction={{
                        label: 'Geri Don',
                        onClick: () => navigate('screen-teklif-detay'),
                    }}
                >
                    {/* Appointment Confirmation */}
                    {providerSlot && (
                        <AppointmentConfirm
                            providerSlot={providerSlot}
                            accepted={appointmentAccepted}
                            onAccept={() => setAppointmentAccepted(true)}
                            onRequestChange={() => navigate('screen-teklif-detay')}
                        />
                    )}

                    {/* Commitment Checkboxes */}
                    <div className="commitment-section">
                        <label className="commitment-checkbox">
                            <input
                                type="checkbox"
                                checked={firmAcceptance}
                                onChange={e => setFirmAcceptance(e.target.checked)}
                            />
                            <span className="commitment-checkbox__label">
                                Bu teklifi kabul ediyorum ve surecin baslamasini onayliyorum
                            </span>
                        </label>

                        <label className="commitment-checkbox">
                            <input
                                type="checkbox"
                                checked={cancellationPolicy}
                                onChange={e => setCancellationPolicy(e.target.checked)}
                            />
                            <span className="commitment-checkbox__label">
                                Iptal politikasini okudum ve kabul ediyorum
                            </span>
                        </label>

                        <label className="commitment-checkbox">
                            <input
                                type="checkbox"
                                checked={contactPermission}
                                onChange={e => setContactPermission(e.target.checked)}
                            />
                            <span className="commitment-checkbox__label">
                                Usta ile iletisim bilgilerimin paylasilmasina izin veriyorum
                            </span>
                        </label>
                    </div>

                    {/* Cancellation Policy */}
                    <button
                        className="cancel-policy-toggle"
                        onClick={() => setPolicyExpanded(!policyExpanded)}
                    >
                        <span>📋 Iptal Politikasi</span>
                        <span>{policyExpanded ? '▲' : '▼'}</span>
                    </button>
                    {policyExpanded && (
                        <div className="cancel-policy-block">
                            {CANCELLATION_POLICY.split('\n').map((line, i) => (
                                <p key={i}>{line}</p>
                            ))}
                        </div>
                    )}

                    {/* Disabled state hint */}
                    {!allChecked && (
                        <div className="commitment-hint">
                            Devam etmek icin tum maddeleri onaylayin
                        </div>
                    )}
                </FlowStepShell>
            </div>
        </div>
    );
}
