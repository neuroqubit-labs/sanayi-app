import { useState } from 'react';
import { PrimaryActionBar, ReasonBadge, SectionBlock, StatusPill } from '../components/DecisionPrimitives';
import { SearchIcon } from '../components/Icons';
import { SlotPicker } from '../components/SlotPicker';
import { useApp } from '../context/AppContext';
import { useMatchingViewModel } from '../hooks/useMatchingViewModel';
import { useQuoteState, setNavParams } from '../hooks/useQuoteState';

const AVAILABILITY_OPTIONS = ['Aracimi goturebilirim', 'Pickup / cikarsa getirilsin', 'Mobil servis tercihim'];

function FilterChip({ filter, active, onSelect }) {
    return (
        <button className={`chip ${active ? 'active' : ''}`} onClick={() => onSelect(filter.id)}>
            {filter.label}
        </button>
    );
}

function MatchListCard({ candidate, onOpen, onRequestQuote, requested }) {
    const openTone = candidate.openState === 'acik' ? 'success' : 'neutral';

    return (
        <div className="decision-match-card" onClick={onOpen} role="button" tabIndex={0}>
            <div className="decision-match-card__top">
                <div className="decision-match-card__identity">
                    <div className="decision-match-card__avatar">{candidate.initials}</div>
                    <div className="decision-match-card__copy">
                        <div className="decision-match-card__name-row">
                            <div className="decision-match-card__name">{candidate.name}</div>
                            {candidate.verified && <StatusPill label="Dogrulandi" tone="success" />}
                        </div>
                        <div className="decision-match-card__tags">{candidate.tags.join(' · ')}</div>
                    </div>
                </div>
                {candidate.featuredBadge && (
                    <ReasonBadge label={candidate.featuredBadge.label} tone={candidate.featuredBadge.tone} />
                )}
            </div>

            <div className="decision-match-card__reason">
                <ReasonBadge label={candidate.reason.label} tone={candidate.reason.tone} />
                <p>{candidate.reasonText}</p>
            </div>

            <div className="decision-match-card__trust">
                {candidate.trustBadges.map(badge => (
                    <ReasonBadge key={badge.label} label={badge.label} tone={badge.tone} />
                ))}
            </div>

            <div className="decision-match-card__meta">
                <div className="decision-match-card__metric">
                    <span className="decision-match-card__metric-value">{candidate.ratingLabel}</span>
                    <span className="decision-match-card__metric-label">Puan</span>
                </div>
                <div className="decision-match-card__metric">
                    <span className="decision-match-card__metric-value">{candidate.distanceLabel}</span>
                    <span className="decision-match-card__metric-label">Mesafe</span>
                </div>
                <div className="decision-match-card__metric">
                    <span className="decision-match-card__metric-value">{candidate.responseLabel}</span>
                    <span className="decision-match-card__metric-label">Yanit</span>
                </div>
            </div>

            <div className="decision-match-card__footer">
                <div>
                    <div className="decision-match-card__price">{candidate.priceLabel}</div>
                    <div className="decision-match-card__meta-line">{candidate.metaLine}</div>
                </div>
                <StatusPill label={candidate.openState === 'acik' ? 'Acik' : 'Kapali'} tone={openTone} />
            </div>

            {requested ? (
                <div className="decision-match-card__request-btn decision-match-card__request-btn--sent">
                    ✓ Teklif istegi gonderildi
                </div>
            ) : (
                <button
                    className="cta-btn cta-btn--outline decision-match-card__request-btn"
                    onClick={(e) => { e.stopPropagation(); onRequestQuote(candidate); }}
                >
                    Teklif Iste
                </button>
            )}
        </div>
    );
}

/* ── Teklif Istegi Formu (Overlay) ── */
function RequestFormOverlay({ candidate, onSend, onClose }) {
    const [note, setNote] = useState('');
    const [slots, setSlots] = useState([]);
    const [availability, setAvailability] = useState('');

    const hasValidSlots = slots.length > 0 && slots.some(s => s.ranges.length > 0);

    return (
        <div className="request-form-overlay" onClick={onClose}>
            <div className="request-form-overlay__panel" onClick={e => e.stopPropagation()}>
                <div className="request-form-header">
                    <div className="request-form-header__icon">📝</div>
                    <div className="request-form-header__title">Teklif Istegi</div>
                    <div className="request-form-header__subtitle">
                        <strong>{candidate.name}</strong>'e talebin detaylarini ilet
                    </div>
                </div>

                <div className="request-form">
                    <div className="request-form__group">
                        <SlotPicker
                            selectedSlots={slots}
                            onSlotsChange={setSlots}
                            maxSlots={3}
                        />
                    </div>

                    <div className="request-form__group">
                        <label className="request-form__label">Aracini nasil teslim edebilirsin?</label>
                        <div className="toggle-group">
                            {AVAILABILITY_OPTIONS.map(opt => (
                                <button
                                    key={opt}
                                    className={`toggle-btn ${availability === opt ? 'active' : ''}`}
                                    onClick={() => setAvailability(opt)}
                                >
                                    {opt}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="request-form__group">
                        <label className="request-form__label">Ustaya not birak</label>
                        <textarea
                            className="request-form__textarea"
                            placeholder="Orn: Soguk calistirmada ses daha belirgin. Hafta ici aksam musaitim..."
                            value={note}
                            onChange={e => setNote(e.target.value)}
                            rows={3}
                        />
                    </div>
                </div>

                <PrimaryActionBar
                    primaryAction={{
                        label: 'Teklif Istegi Gonder',
                        onClick: () => onSend({ note, slots, availability }),
                        disabled: !hasValidSlots,
                    }}
                    secondaryAction={{
                        label: 'Vazgec',
                        onClick: onClose,
                    }}
                    stacked
                />
                {!hasValidSlots && (
                    <div className="request-form__hint">Musait gun ve saat araligi sec</div>
                )}
            </div>
        </div>
    );
}

export default function UstalarScreen() {
    const { navigate } = useApp();
    const { caseContext, filters, activeFilter, setActiveFilter, searchQuery, setSearchQuery, candidates, totalCandidates } =
        useMatchingViewModel();
    const { sendQuoteRequest, mockReceiveQuote } = useQuoteState('case_pool_001');
    const [requestedIds, setRequestedIds] = useState(new Set());
    const [toast, setToast] = useState(null);
    const [formTarget, setFormTarget] = useState(null); // candidate to show form for

    const handleOpenForm = (candidate) => {
        if (requestedIds.has(candidate.id)) return;
        setFormTarget(candidate);
    };

    const handleSendRequest = ({ note, slots, availability }) => {
        if (!formTarget) return;
        const message = [
            availability && `Teslimat: ${availability}`,
            note,
        ].filter(Boolean).join('\n');

        sendQuoteRequest('case_pool_001', formTarget.id, formTarget.name, message, slots, availability);
        mockReceiveQuote('case_pool_001', formTarget.id, formTarget.name);
        setRequestedIds(prev => new Set([...prev, formTarget.id]));
        setFormTarget(null);
        setToast(`${formTarget.name}'e teklif istegi gonderildi`);
        setTimeout(() => setToast(null), 2500);
    };

    return (
        <div className="screen-scroll">
            <SectionBlock
                eyebrow="Karar Listesi"
                title="Bu vaka icin uygun ustalar"
                description={`${caseContext.vehicleLabel} · ${caseContext.subtitle}`}
            >
                <div className="search-bar search-bar--decision">
                    <SearchIcon />
                    <input
                        type="text"
                        placeholder="Servis adi veya uzmanlik ara…"
                        value={searchQuery}
                        onChange={event => setSearchQuery(event.target.value)}
                    />
                </div>

                <div className="filter-chips">
                    {filters.map(filter => (
                        <FilterChip
                            key={filter.id}
                            filter={filter}
                            active={activeFilter === filter.id}
                            onSelect={setActiveFilter}
                        />
                    ))}
                </div>
            </SectionBlock>

            <SectionBlock
                eyebrow="Neden Bunlar"
                title={`${candidates.length} aday gosteriliyor`}
                description={`${totalCandidates} servis icinden vaka uyumu, guven ve hizmet modu birlikte degerlendirildi.`}
                actionLabel="Kaydirarak Gor"
                onAction={() => navigate('screen-eslestir')}
            >
                <div className="decision-match-list">
                    {candidates.map(candidate => (
                        <MatchListCard
                            key={candidate.id}
                            candidate={candidate}
                            onOpen={() => {
                                setNavParams({ providerId: candidate.id });
                                navigate('screen-usta-profil');
                            }}
                            onRequestQuote={handleOpenForm}
                            requested={requestedIds.has(candidate.id)}
                        />
                    ))}
                </div>
            </SectionBlock>

            <div className="bottom-spacer" />

            {formTarget && (
                <RequestFormOverlay
                    candidate={formTarget}
                    onSend={handleSendRequest}
                    onClose={() => setFormTarget(null)}
                />
            )}

            {toast && (
                <div className="toast-notification">
                    <span>✓ {toast}</span>
                </div>
            )}
        </div>
    );
}
