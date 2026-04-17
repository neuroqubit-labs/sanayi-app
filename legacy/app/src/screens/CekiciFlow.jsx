import { useState, useEffect } from 'react';
import SubHeader from '../components/SubHeader';
import { useApp } from '../context/AppContext';

/* ──────────────── Mock Data ──────────────── */

const MOCK_LOCATION = {
    address: 'Kadıköy, Caferağa Mah. Moda Cad. No:12',
    lat: 40.9884,
    lng: 29.0294,
};

const PRICE_PER_KM = 85; // ₺
const BASE_FEE = 250;    // ₺
const MOCK_DISTANCE_KM = 12;

function estimatePrice(distance) {
    return BASE_FEE + Math.round(distance * PRICE_PER_KM);
}

/* ──────────────── Component ──────────────── */

export default function CekiciFlow() {
    const { goBack, navTo } = useApp();

    // Context from other flows (kaza, arıza)
    const [context] = useState(() => {
        try {
            const raw = localStorage.getItem('cekici_context');
            if (raw) {
                localStorage.removeItem('cekici_context');
                return JSON.parse(raw);
            }
        } catch { /* noop */ }
        return null;
    });

    // State
    const [pickupAddress, setPickupAddress] = useState(MOCK_LOCATION.address);
    const [destination, setDestination] = useState('');
    const [timing, setTiming] = useState(context?.source === 'kaza' ? 'hemen' : 'hemen');
    const [scheduledTime, setScheduledTime] = useState('');
    const [note, setNote] = useState('');
    const [phase, setPhase] = useState('form'); // 'form' | 'confirm' | 'searching' | 'matched'

    // Simulated distance
    const distance = destination ? MOCK_DISTANCE_KM : 8;
    const price = estimatePrice(distance);

    // Mock driver search animation
    useEffect(() => {
        if (phase === 'searching') {
            const timer = setTimeout(() => setPhase('matched'), 2800);
            return () => clearTimeout(timer);
        }
    }, [phase]);

    const handleConfirm = () => {
        setPhase('confirm');
    };

    const handleRequest = () => {
        setPhase('searching');
    };

    // Context label
    const contextLabel = context?.source === 'kaza'
        ? '🚨 Kaza kaynaklı acil çekici'
        : context?.source === 'ariza'
            ? `🔧 Arıza kaynaklı çekici${context.arizaType ? ` — ${context.arizaType}` : ''}`
            : null;

    return (
        <>
            <SubHeader title="Çekici Çağır" />
            <div className="screen-scroll screen-scroll--sub cekici-screen">

                {/* ── Map Area ── */}
                <div className="cekici-map">
                    <div className="cekici-map__grid">
                        {/* Road lines */}
                        <div className="cekici-map__road cekici-map__road--h" style={{ top: '35%' }} />
                        <div className="cekici-map__road cekici-map__road--h" style={{ top: '65%' }} />
                        <div className="cekici-map__road cekici-map__road--v" style={{ left: '30%' }} />
                        <div className="cekici-map__road cekici-map__road--v" style={{ left: '70%' }} />
                    </div>

                    {/* Pickup marker */}
                    <div className="cekici-map__marker cekici-map__marker--pickup" style={{ top: '35%', left: '30%' }}>
                        <span className="cekici-map__pin">📍</span>
                        <span className="cekici-map__pulse" />
                    </div>

                    {/* Destination marker */}
                    {destination && (
                        <div className="cekici-map__marker cekici-map__marker--dest" style={{ top: '65%', left: '70%' }}>
                            <span className="cekici-map__pin">🏁</span>
                        </div>
                    )}

                    {/* Route line */}
                    {destination && <div className="cekici-map__route" />}

                    {/* Searching overlay */}
                    {phase === 'searching' && (
                        <div className="cekici-map__searching">
                            <div className="cekici-map__radar" />
                            <span className="cekici-map__searching-text">Çekici aranıyor...</span>
                        </div>
                    )}

                    {/* Matched overlay */}
                    {phase === 'matched' && (
                        <div className="cekici-map__matched">
                            <span className="cekici-map__tow-icon">🚛</span>
                        </div>
                    )}
                </div>

                {/* ── Content ── */}
                <div className="cekici-body">

                    {/* Context hint */}
                    {contextLabel && phase === 'form' && (
                        <div className="cekici-context-badge">
                            {contextLabel}
                        </div>
                    )}

                    {/* ── FORM PHASE ── */}
                    {phase === 'form' && (
                        <>
                            {/* Location inputs */}
                            <div className="cekici-location-card">
                                <div className="cekici-location-row">
                                    <span className="cekici-location-dot cekici-location-dot--green" />
                                    <input
                                        className="cekici-location-input"
                                        type="text"
                                        placeholder="Alınacak konum"
                                        value={pickupAddress}
                                        onChange={e => setPickupAddress(e.target.value)}
                                    />
                                </div>
                                <div className="cekici-location-divider" />
                                <div className="cekici-location-row">
                                    <span className="cekici-location-dot cekici-location-dot--red" />
                                    <input
                                        className="cekici-location-input"
                                        type="text"
                                        placeholder="Varış noktası (opsiyonel)"
                                        value={destination}
                                        onChange={e => setDestination(e.target.value)}
                                    />
                                </div>
                            </div>

                            {/* Timing toggle */}
                            <div className="cekici-timing">
                                <button
                                    className={`cekici-timing__btn ${timing === 'hemen' ? 'cekici-timing__btn--active' : ''}`}
                                    onClick={() => setTiming('hemen')}
                                >
                                    <span className="cekici-timing__icon">⚡</span>
                                    Hemen
                                </button>
                                <button
                                    className={`cekici-timing__btn ${timing === 'randevulu' ? 'cekici-timing__btn--active' : ''}`}
                                    onClick={() => setTiming('randevulu')}
                                >
                                    <span className="cekici-timing__icon">📅</span>
                                    Randevulu
                                </button>
                            </div>

                            {/* Scheduled time input */}
                            {timing === 'randevulu' && (
                                <div className="form-group">
                                    <label className="form-label">Çekici ne zaman gelsin?</label>
                                    <div className="toggle-group toggle-group--wrap">
                                        {['Bu akşam', 'Yarın sabah', 'Yarın öğlen', 'Tarih seç'].map(opt => (
                                            <button
                                                key={opt}
                                                className={`toggle-btn ${scheduledTime === opt ? 'active' : ''}`}
                                                onClick={() => setScheduledTime(opt)}
                                            >
                                                {opt}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Price estimate */}
                            <div className="cekici-estimate">
                                <div className="cekici-estimate__row">
                                    <span className="cekici-estimate__label">📏 Tahmini mesafe</span>
                                    <span className="cekici-estimate__value">~{distance} km</span>
                                </div>
                                <div className="cekici-estimate__row cekici-estimate__row--total">
                                    <span className="cekici-estimate__label">💰 Tahmini ücret</span>
                                    <span className="cekici-estimate__value cekici-estimate__value--price">
                                        ₺{price.toLocaleString('tr-TR')}
                                    </span>
                                </div>
                                <p className="cekici-estimate__note">
                                    Mesafe ve ödeme sistemi uygulama üzerinden yönetilir. Kesin ücret rota tamamlandığında belirlenir.
                                </p>
                            </div>

                            {/* Note */}
                            <div className="form-group">
                                <label className="form-label">Not (opsiyonel)</label>
                                <textarea
                                    className="form-textarea"
                                    placeholder="Ör: Araç otopark 2. katta, çift çeker gerekebilir..."
                                    value={note}
                                    onChange={e => setNote(e.target.value)}
                                    rows={2}
                                />
                            </div>

                            {/* CTA */}
                            <button className="cekici-cta" onClick={handleConfirm}>
                                {timing === 'hemen' ? '⚡ Hemen Çekici Çağır' : '📅 Randevu Oluştur'}
                            </button>
                        </>
                    )}

                    {/* ── CONFIRM PHASE ── */}
                    {phase === 'confirm' && (
                        <div className="cekici-confirm">
                            <div className="cekici-confirm__title">Talebi onaylıyor musun?</div>

                            <div className="cekici-confirm__summary">
                                <div className="cekici-confirm__row">
                                    <span>📍</span> <span>{pickupAddress}</span>
                                </div>
                                {destination && (
                                    <div className="cekici-confirm__row">
                                        <span>🏁</span> <span>{destination}</span>
                                    </div>
                                )}
                                <div className="cekici-confirm__row">
                                    <span>{timing === 'hemen' ? '⚡' : '📅'}</span>
                                    <span>{timing === 'hemen' ? 'Hemen' : scheduledTime || 'Randevulu'}</span>
                                </div>
                                <div className="cekici-confirm__row cekici-confirm__row--price">
                                    <span>💰</span>
                                    <span>₺{price.toLocaleString('tr-TR')} (tahmini)</span>
                                </div>
                            </div>

                            <button className="cekici-cta" onClick={handleRequest}>
                                Onayla ve Talep Et
                            </button>
                            <button className="cekici-back-link" onClick={() => setPhase('form')}>
                                ← Düzenle
                            </button>
                        </div>
                    )}

                    {/* ── SEARCHING / MATCHED ── */}
                    {(phase === 'searching' || phase === 'matched') && (
                        <div className="cekici-status">
                            {phase === 'searching' && (
                                <>
                                    <div className="cekici-status__spinner" />
                                    <div className="cekici-status__title">Çekici aranıyor</div>
                                    <div className="cekici-status__text">Yakındaki uygun çekicilere talep gönderildi. Genellikle 2-5 dakika içinde eşleşme sağlanır.</div>
                                </>
                            )}
                            {phase === 'matched' && (
                                <>
                                    <div className="cekici-status__icon">✅</div>
                                    <div className="cekici-status__title">Çekici eşleşti!</div>
                                    <div className="cekici-status__text">Tahmini varış süresi: ~18 dakika</div>

                                    <div className="cekici-driver-card">
                                        <div className="cekici-driver-card__avatar">🚛</div>
                                        <div className="cekici-driver-card__info">
                                            <div className="cekici-driver-card__name">Mehmet Y.</div>
                                            <div className="cekici-driver-card__vehicle">Ford Cargo · 34 TK 789</div>
                                            <div className="cekici-driver-card__rating">⭐ 4.8 · 342 taşıma</div>
                                        </div>
                                        <button className="cekici-driver-card__call">📞</button>
                                    </div>

                                    <button className="cekici-cta cekici-cta--secondary" onClick={() => navTo('screen-home')}>
                                        Ana Sayfaya Dön
                                    </button>
                                </>
                            )}
                        </div>
                    )}
                </div>

                <div className="bottom-spacer" />
            </div>
        </>
    );
}
