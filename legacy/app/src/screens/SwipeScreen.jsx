import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PrimaryActionBar, ReasonBadge, StatusPill, SummaryPanel } from '../components/DecisionPrimitives';
import { SlotPicker } from '../components/SlotPicker';
import SubHeader from '../components/SubHeader';
import { useApp } from '../context/AppContext';
import { useMatchingViewModel } from '../hooks/useMatchingViewModel';
import { useQuoteState } from '../hooks/useQuoteState';

const SWIPE_THRESHOLD = 80;
const MAX_ROTATION = 15;

function TrustStrip({ badges }) {
    return (
        <div className="trust-strip">
            {badges.map(badge => (
                <ReasonBadge key={badge.label} label={badge.label} tone={badge.tone} />
            ))}
        </div>
    );
}

function DetailBlock({ title, children }) {
    return (
        <div className="detail-block">
            <div className="detail-block__title">{title}</div>
            {children}
        </div>
    );
}

const AVAILABILITY_OPTIONS = ['Aracimi goturebilirim', 'Pickup / cikarsa getirilsin', 'Mobil servis tercihim'];

export default function SwipeScreen() {
    const { navigate } = useApp();
    const { caseContext, allCandidates } = useMatchingViewModel({ enableFilters: false });
    const { sendQuoteRequest, mockReceiveQuote } = useQuoteState('case_pool_001');
    const [cardIdx, setCardIdx] = useState(0);
    const [matchPhase, setMatchPhase] = useState(null); // null | 'form' | 'sent'
    const [matchedShop, setMatchedShop] = useState(null);
    const [history, setHistory] = useState([]);
    const [expanded, setExpanded] = useState(false);

    // Quote request form state
    const [reqNote, setReqNote] = useState('');
    const [reqSlots, setReqSlots] = useState([]);
    const [reqAvailability, setReqAvailability] = useState('');

    const resetFormState = () => { setReqNote(''); setReqSlots([]); setReqAvailability(''); };

    const cardRef = useRef(null);
    const scrollRef = useRef(null);
    const labelNoRef = useRef(null);
    const labelYesRef = useRef(null);
    const dragState = useRef({ active: false, startX: 0, startY: 0, dx: 0, dy: 0, dir: null });

    const candidateCount = allCandidates.length;
    const data = useMemo(() => allCandidates[cardIdx % candidateCount], [allCandidates, candidateCount, cardIdx]);
    const shopForOverlay = matchedShop || data;

    const resetCard = useCallback(() => {
        const element = cardRef.current;
        if (!element) return;

        element.style.transition = 'transform 0.4s cubic-bezier(.17, .84, .44, 1), opacity 0.3s ease';
        element.style.transform = '';
        element.style.opacity = '';
    }, []);

    const advanceCard = useCallback((direction) => {
        const element = cardRef.current;
        if (!element) return;

        const currentData = allCandidates[cardIdx % candidateCount];
        const translateX = direction === 'no' ? '-120%' : '120%';
        const rotation = direction === 'no' ? '-25deg' : '25deg';

        element.style.transition = 'transform 0.5s cubic-bezier(.4, 0, .2, 1), opacity 0.4s ease';
        element.style.transform = `translateX(${translateX}) rotate(${rotation})`;
        element.style.opacity = '0';

        setHistory(prev => [...prev, { idx: cardIdx, action: direction }]);

        setTimeout(() => {
            if (direction === 'yes') {
                setMatchedShop(currentData);
                resetFormState();
                setMatchPhase('form');
            }

            setCardIdx(prev => (prev + 1) % candidateCount);
            setExpanded(false);
            if (scrollRef.current) scrollRef.current.scrollTop = 0;

            element.style.transition = 'none';
            element.style.transform = 'translateY(20px) scale(0.95)';
            element.style.opacity = '0';

            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    element.style.transition = 'transform 0.4s cubic-bezier(.17, .84, .44, 1), opacity 0.35s ease';
                    element.style.transform = '';
                    element.style.opacity = '';
                });
            });
        }, 450);
    }, [allCandidates, candidateCount, cardIdx]);

    const onPointerDown = (event) => {
        if (matchPhase || expanded) return;
        const point = event.touches ? event.touches[0] : event;
        dragState.current = { active: true, startX: point.clientX, startY: point.clientY, dx: 0, dy: 0, dir: null };
        if (cardRef.current) cardRef.current.style.transition = 'none';
    };

    const onPointerMove = useCallback((event) => {
        const state = dragState.current;
        if (!state.active) return;

        const point = event.touches ? event.touches[0] : event;
        const dx = point.clientX - state.startX;
        const dy = point.clientY - state.startY;

        if (!state.dir) {
            if (Math.abs(dx) > 8 || Math.abs(dy) > 12) {
                state.dir = Math.abs(dy) > Math.abs(dx) && dy < 0 ? 'vertical' : 'horizontal';
            } else {
                return;
            }
        }

        if (state.dir === 'vertical') {
            if (dy < 0) {
                event.preventDefault();
                state.dy = dy;
            }
            return;
        }

        event.preventDefault();
        const element = cardRef.current;
        if (!element) return;

        state.dx = dx;
        const rotation = (dx / window.innerWidth) * MAX_ROTATION * 2;
        element.style.transform = `translateX(${dx}px) rotate(${rotation}deg)`;

        const progress = Math.min(Math.abs(dx) / SWIPE_THRESHOLD, 1);
        if (labelNoRef.current) labelNoRef.current.style.opacity = dx < -20 ? progress : 0;
        if (labelYesRef.current) labelYesRef.current.style.opacity = dx > 20 ? progress : 0;
    }, []);

    const onPointerUp = useCallback(() => {
        const state = dragState.current;
        if (!state.active) return;

        state.active = false;

        if (labelNoRef.current) labelNoRef.current.style.opacity = 0;
        if (labelYesRef.current) labelYesRef.current.style.opacity = 0;

        if (state.dir === 'vertical' && state.dy < -60) {
            resetCard();
            setExpanded(true);
            return;
        }

        if (state.dx > SWIPE_THRESHOLD) advanceCard('yes');
        else if (state.dx < -SWIPE_THRESHOLD) advanceCard('no');
        else resetCard();
    }, [advanceCard, resetCard]);

    useEffect(() => {
        const handleMove = event => onPointerMove(event);
        const handleUp = () => onPointerUp();

        window.addEventListener('mousemove', handleMove);
        window.addEventListener('mouseup', handleUp);

        return () => {
            window.removeEventListener('mousemove', handleMove);
            window.removeEventListener('mouseup', handleUp);
        };
    }, [onPointerMove, onPointerUp]);

    const undoSwipe = () => {
        if (!history.length) return;
        const last = history[history.length - 1];
        const element = cardRef.current;

        setHistory(prev => prev.slice(0, -1));
        setCardIdx(last.idx);
        setExpanded(false);

        if (!element) return;
        element.style.transition = 'none';
        element.style.transform = last.action === 'no' ? 'translateX(-120%) rotate(-25deg)' : 'translateX(120%) rotate(25deg)';
        element.style.opacity = '0';

        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                element.style.transition = 'transform 0.45s cubic-bezier(.2,.8,.3,1), opacity 0.35s ease';
                element.style.transform = '';
                element.style.opacity = '';
            });
        });
    };

    const overlayRows = [
        { label: 'Vaka', value: caseContext.title },
        { label: 'Usta', value: shopForOverlay.name },
        { label: 'Fiyat Bandi', value: shopForOverlay.priceLabel },
        { label: 'Yanit', value: shopForOverlay.responseLabel },
    ];

    return (
        <div className="swipe-screen-wrapper">
            <SubHeader title="Usta Bul" actionLabel="☰ Liste" onAction={() => navigate('screen-ustalar')} />
            <div className="swipe-context">
                <span className="swipe-context__label">{caseContext.title} icin usta kesfet ve teklif iste</span>
            </div>

            <div className="swipe-area">
                <div className="swipe-label swipe-label--no" ref={labelNoRef}>GEÇ ✕</div>
                <div className="swipe-label swipe-label--yes" ref={labelYesRef}>TEKLIF ISTE ✓</div>

                <div
                    className={`swipe-card decision-swipe-card ${expanded ? 'swipe-card--expanded' : ''}`}
                    ref={cardRef}
                    onTouchStart={onPointerDown}
                    onTouchMove={onPointerMove}
                    onTouchEnd={onPointerUp}
                    onMouseDown={onPointerDown}
                >
                    <div className="swipe-card__scroll" ref={scrollRef}>
                        <div className="decision-swipe-card__badge-row">
                            {data.featuredBadge && <ReasonBadge label={data.featuredBadge.label} tone={data.featuredBadge.tone} />}
                            <ReasonBadge label={data.reason.label} tone={data.reason.tone} />
                        </div>

                        <div className="decision-swipe-card__top">
                            <div className="decision-swipe-card__identity">
                                <div className="swipe-card__avatar-lg">{data.initials}</div>
                                <div>
                                    <div className="decision-swipe-card__name">{data.name}</div>
                                    <div className="decision-swipe-card__subtitle">{data.tags.join(' · ')}</div>
                                </div>
                            </div>
                            <StatusPill label={data.openState === 'acik' ? 'Acik' : 'Kapali'} tone={data.openState === 'acik' ? 'success' : 'neutral'} />
                        </div>

                        <div className="decision-swipe-card__body">
                            <p className="decision-swipe-card__reason-text">{data.reasonText}</p>

                            <TrustStrip badges={data.trustBadges} />

                            <div className="decision-swipe-card__stats">
                                <div className="swipe-stat">
                                    <span className="swipe-stat__val">{data.rating.toFixed(1)}</span>
                                    <span className="swipe-stat__lbl">Puan</span>
                                </div>
                                <div className="swipe-stat">
                                    <span className="swipe-stat__val">{data.distanceLabel}</span>
                                    <span className="swipe-stat__lbl">Mesafe</span>
                                </div>
                                <div className="swipe-stat">
                                    <span className="swipe-stat__val">{data.responseLabel}</span>
                                    <span className="swipe-stat__lbl">Yanit</span>
                                </div>
                            </div>

                            <SummaryPanel
                                rows={[
                                    { label: 'Fiyat Bandı', value: data.priceLabel },
                                    { label: 'Hizmet Modu', value: data.serviceMode },
                                    { label: 'Plan Uyumu', value: data.planFit },
                                ]}
                                note={data.summary}
                                emphasize
                                className="decision-swipe-card__summary"
                            />
                        </div>

                        {!expanded && (
                            <div className="swipe-up-hint" onClick={() => setExpanded(true)}>
                                <div className="swipe-up-chevron">‹</div>
                                <span>Yukari kaydir — detaylari ac</span>
                            </div>
                        )}

                        {expanded && (
                            <div className="swipe-card__detail">
                                <DetailBlock title="Bu vakada neden guclu">
                                    <p className="detail-block__text">{data.note}</p>
                                </DetailBlock>

                                <DetailBlock title="Uzmanlik alani">
                                    <div className="tag-cloud">
                                        {data.detail.expertiseTags.map(tag => (
                                            <span className="tag" key={tag}>{tag}</span>
                                        ))}
                                    </div>
                                </DetailBlock>

                                <DetailBlock title="Tahmini is plani">
                                    <SummaryPanel
                                        rows={[
                                            { label: 'AI ozeti', value: data.detail.aiSummary },
                                            { label: 'Tahmini sure', value: data.detail.timeline },
                                            { label: 'Garanti', value: data.detail.guarantee },
                                            { label: 'Pickup', value: data.detail.pickup },
                                        ]}
                                    />
                                </DetailBlock>

                                <DetailBlock title="Son yorumlar">
                                    <div className="yorum-list">
                                        {data.detail.recentReviews.map(review => (
                                            <div className="yorum-card" key={review}>
                                                <div className="yorum-star">⭐⭐⭐⭐⭐</div>
                                                <div className="yorum-text">"{review}"</div>
                                            </div>
                                        ))}
                                    </div>
                                </DetailBlock>

                                <PrimaryActionBar
                                    primaryAction={{ label: 'Teklif Iste', onClick: () => { setExpanded(false); advanceCard('yes'); } }}
                                    secondaryAction={{ label: 'Karti Daralt', onClick: () => { setExpanded(false); if (scrollRef.current) scrollRef.current.scrollTop = 0; } }}
                                    stacked
                                />
                                <div className="swipe-card__detail-spacer" />
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {!expanded && (
                <div className="swipe-actions--floating">
                    <button
                        className={`swipe-btn swipe-btn--undo ${history.length ? '' : 'swipe-btn--disabled'}`.trim()}
                        onClick={undoSwipe}
                    >
                        ↺
                    </button>
                    <button className="swipe-btn swipe-btn--no" onClick={() => advanceCard('no')}>✕</button>
                    <button className="swipe-btn swipe-btn--star">★</button>
                    <button className="swipe-btn swipe-btn--yes" onClick={() => advanceCard('yes')}>✓</button>
                </div>
            )}

            <div className={`match-overlay ${matchPhase ? 'open' : ''}`}>
                <div className="match-content">
                    {/* ── Phase 1: Teklif Istegi Formu ── */}
                    {matchPhase === 'form' && (
                        <div className="match-phase">
                            <div className="request-form-header">
                                <div className="request-form-header__icon">📝</div>
                                <div className="request-form-header__title">Teklif Istegi</div>
                                <div className="request-form-header__subtitle">
                                    <strong>{shopForOverlay.name}</strong>'e talebin detaylarini ilet
                                </div>
                            </div>

                            <div className="request-form">
                                {/* Slot Picker - Gun & Saat Secimi */}
                                <div className="request-form__group">
                                    <SlotPicker
                                        selectedSlots={reqSlots}
                                        onSlotsChange={setReqSlots}
                                        maxSlots={3}
                                    />
                                </div>

                                {/* Musaitlik / Arac Teslimat */}
                                <div className="request-form__group">
                                    <label className="request-form__label">Aracini nasil teslim edebilirsin?</label>
                                    <div className="toggle-group">
                                        {AVAILABILITY_OPTIONS.map(opt => (
                                            <button
                                                key={opt}
                                                className={`toggle-btn ${reqAvailability === opt ? 'active' : ''}`}
                                                onClick={() => setReqAvailability(opt)}
                                            >
                                                {opt}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Not */}
                                <div className="request-form__group">
                                    <label className="request-form__label">Ustaya not birak</label>
                                    <textarea
                                        className="request-form__textarea"
                                        placeholder="Orn: Soguk calistirmada ses daha belirgin, sabah ilk calistirisinda duyuluyor..."
                                        value={reqNote}
                                        onChange={e => setReqNote(e.target.value)}
                                        rows={3}
                                    />
                                </div>
                            </div>

                            <PrimaryActionBar
                                primaryAction={{
                                    label: 'Teklif Istegi Gonder',
                                    onClick: () => {
                                        const message = [
                                            reqAvailability && `Teslimat: ${reqAvailability}`,
                                            reqNote,
                                        ].filter(Boolean).join('\n');
                                        sendQuoteRequest('case_pool_001', shopForOverlay.id, shopForOverlay.name, message, reqSlots, reqAvailability);
                                        mockReceiveQuote('case_pool_001', shopForOverlay.id, shopForOverlay.name);
                                        setMatchPhase('sent');
                                    },
                                    disabled: reqSlots.length === 0 || reqSlots.every(s => s.ranges.length === 0),
                                }}
                                secondaryAction={{
                                    label: 'Vazgec',
                                    onClick: () => { resetFormState(); setMatchPhase(null); },
                                }}
                                stacked
                            />
                            {(reqSlots.length === 0 || reqSlots.every(s => s.ranges.length === 0)) && (
                                <div className="request-form__hint">Musait gun ve saat araligi sec</div>
                            )}
                        </div>
                    )}

                    {/* ── Phase 2: Gonderildi Onay ── */}
                    {matchPhase === 'sent' && (
                        <div className="match-phase">
                            <div className="request-sent-overlay">
                                <div className="request-sent-overlay__icon">✅</div>
                                <div className="request-sent-overlay__title">Teklif istegi gonderildi</div>
                                <div className="request-sent-overlay__desc">
                                    <strong>{shopForOverlay.name}</strong>'e detayli teklif istegi iletildi.
                                </div>
                                <div className="request-sent-overlay__desc">
                                    Teklif geldiginde bildirim alacaksin.
                                </div>
                            </div>
                            <SummaryPanel rows={[
                                ...overlayRows,
                                { label: 'Musait Gunler', value: `${reqSlots.length} gun secildi` },
                                { label: 'Teslimat', value: reqAvailability || '—' },
                                ...(reqNote ? [{ label: 'Not', value: reqNote.length > 60 ? reqNote.slice(0, 60) + '…' : reqNote }] : []),
                            ]} />
                            <PrimaryActionBar
                                primaryAction={{ label: 'Daha Fazla Usta Gor', onClick: () => { resetFormState(); setMatchPhase(null); } }}
                                secondaryAction={{ label: 'Vakama Don', onClick: () => navigate('screen-vaka-havuz') }}
                                stacked
                            />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
