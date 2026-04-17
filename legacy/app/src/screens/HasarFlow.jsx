import { useState } from 'react';
import { FlowStepShell } from '../components/DecisionPrimitives';
import SubHeader from '../components/SubHeader';
import { useApp } from '../context/AppContext';
import { ARIZA_ALT_TYPES } from '../data/requestFlowData';
import { usePersistedFlowState, useRequestFlowModel } from '../hooks/useRequestFlowModel';

const FLOW_STATE_KEY = 'hasar_flow_state';

const INITIAL_STATE = {
    hasarType: null,
    isSurulebilir: null, // null = henüz sorulmadı
    cekiciCalled: false,
    description: '',
    media: [],
    dynamicAnswers: {},
    servicePref: 'Fark etmez',
};

/* ──────────────── Shared Primitives ──────────────── */

function TypeCard({ option, selected, onSelect }) {
    return (
        <button className={`decision-option-card ${selected ? 'selected' : ''}`} onClick={() => onSelect(option.id)}>
            <span className="decision-option-card__icon">{option.icon}</span>
            <span>{option.label}</span>
        </button>
    );
}

function ToggleButton({ label, active, onClick }) {
    return (
        <button className={`toggle-btn ${active ? 'active' : ''}`} onClick={onClick}>
            {label}
        </button>
    );
}

function MediaAction({ icon, label, onClick, highlight }) {
    return (
        <button className={`media-upload-box ${highlight ? 'media-upload-box--highlight' : ''}`} onClick={onClick}>
            <span className="media-upload-icon">{icon}</span>
            <span>{label}</span>
        </button>
    );
}

function StepIndicator({ current, total = 3 }) {
    return <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>{current} / {total}</span>;
}

const MEDIA_BUTTONS = {
    photo: { icon: '📷', label: 'Fotograf Cek', ext: '.jpg' },
    video: { icon: '🎥', label: 'Video Cek', ext: '.mp4' },
    audio: { icon: '🎙️', label: 'Ses Kaydi', ext: '.aac' },
    gallery: { icon: '📁', label: 'Galeriden Ekle', ext: '.jpg' },
};

/* ──────────────── Step 1: Track → Çekici → Kategori ──────────────── */

export function HasarFlow1() {
    const { navigate } = useApp();
    const { state, updateState } = usePersistedFlowState(FLOW_STATE_KEY, INITIAL_STATE);
    // Track selection phase removed - FAB now has direct "Arıza" and "Kaza" buttons
    const [phase, setPhase] = useState('cekici'); // 'cekici' | 'kategori'
    const { stepConfig, typeOptions } = useRequestFlowModel({ flowType: 'hasar', step: 1, state });

    const handleCekiciDecision = (surulebilir) => {
        updateState({ isSurulebilir: surulebilir });
        if (!surulebilir) {
            updateState({ cekiciCalled: true });
        }
        setPhase('kategori');
    };

    const handleCategoryAndContinue = () => {
        if (!state.hasarType) return;
        navigate('screen-hasar-flow-2');
    };

    // ── Phase titles
    const phaseTitle = {
        cekici: 'Aracınız sürülebilir mi?',
        kategori: stepConfig?.title || 'Arıza tipini seçin',
    };

    const phaseHelper = {
        cekici: 'Çekici ihtiyacını önceden bildirmek süreci hızlandırır. Aracınız sürülebilir olsa bile bildirimi eksiksiz yapabilirsiniz.',
        kategori: stepConfig?.helper || 'Kategorine göre sorular ve medya seçenekleri belirlenecek.',
    };

    return (
        <>
            <SubHeader title="Arıza Bildir" step={<StepIndicator current={1} />} />
            <div className="screen-scroll screen-scroll--sub">
                <FlowStepShell
                    progress={33}
                    title={phaseTitle[phase]}
                    helper={phaseHelper[phase]}
                    primaryAction={phase === 'kategori' ? { label: 'Devam Et', onClick: handleCategoryAndContinue } : null}
                >
                    {/* ── Phase: Çekici Panel ── */}
                    {phase === 'cekici' && (
                        <div className="cekici-panel">
                            <div className="cekici-panel__icon">🚗</div>

                            <div className="cekici-panel__actions">
                                <button
                                    className="emergency-btn emergency-btn--tow"
                                    onClick={() => handleCekiciDecision(false)}
                                >
                                    <span className="emergency-btn__icon">🚜</span>
                                    <span className="emergency-btn__label">
                                        Çekici Çağır
                                        <span className="emergency-btn__sub">Aracım sürülemez durumda</span>
                                    </span>
                                </button>

                                <button
                                    className="emergency-btn emergency-btn--continue"
                                    onClick={() => handleCekiciDecision(true)}
                                >
                                    <span className="emergency-btn__icon">✅</span>
                                    <span className="emergency-btn__label">
                                        Sürülebilir, devam et
                                    </span>
                                </button>
                            </div>

                            {state.cekiciCalled && (
                                <div className="traffic-alert">
                                    <span className="traffic-alert__icon">✓</span>
                                    <p className="traffic-alert__text">Çekici talebi kaydedildi. Arıza bildirimini eksiksiz tamamlaman süreci hızlandırır.</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── Phase: Kategori Grid ── */}
                    {phase === 'kategori' && (
                        <>
                            <button className="track-back-link" onClick={() => setPhase('cekici')}>
                                ← Geri dön
                            </button>

                            <div className="option-grid">
                                {typeOptions.map(type => (
                                    <TypeCard
                                        key={type.id}
                                        option={type}
                                        selected={state.hasarType === type.id}
                                        onSelect={nextType => updateState({ hasarType: nextType, dynamicAnswers: {} })}
                                    />
                                ))}
                            </div>

                            <div className="form-group">
                                <label className="form-label">Kısa açıklama</label>
                                <textarea
                                    className="form-textarea"
                                    placeholder="Orn: Soğuk çalıştırmada motor tarafından metalik vuruntu geliyor..."
                                    value={state.description}
                                    onChange={event => updateState({ description: event.target.value })}
                                />
                            </div>
                        </>
                    )}
                </FlowStepShell>
                <div className="bottom-spacer" />
            </div>
        </>
    );
}

/* ──────────────── Step 2: Kategori-Spesifik Detay + Medya ──────────────── */

export function HasarFlow2() {
    const { navigate } = useApp();
    const { state, updateState } = usePersistedFlowState(FLOW_STATE_KEY, INITIAL_STATE);
    const { stepConfig, questions, categoryMeta } = useRequestFlowModel({ flowType: 'hasar', step: 2, state });

    const meta = categoryMeta || { mediaPriority: ['photo', 'video', 'audio'], mediaHint: '', tone: 'neutral' };

    // Build ordered media buttons from category priority
    const orderedMediaButtons = [
        ...meta.mediaPriority.map(key => MEDIA_BUTTONS[key]).filter(Boolean),
        MEDIA_BUTTONS.gallery, // galeriden ekle always last
    ];

    const addMedia = (ext) => {
        updateState({ media: [...state.media, `dosya_${state.media.length + 1}${ext}`] });
    };

    const removeMedia = (index) => {
        updateState({ media: state.media.filter((_, i) => i !== index) });
    };

    // Tone-specific hint colors
    const toneClass = meta.tone === 'urgent' ? 'ariza-hint--urgent'
        : meta.tone === 'warning' ? 'ariza-hint--warning'
            : meta.tone === 'diagnostic' ? 'ariza-hint--diagnostic'
                : '';

    return (
        <>
            <SubHeader title="Arıza Bildir" step={<StepIndicator current={2} />} />
            <div className="screen-scroll screen-scroll--sub">
                <FlowStepShell
                    progress={66}
                    title={stepConfig?.title || 'Detay ekle'}
                    helper={stepConfig?.helper || ''}
                    summaryRows={[
                        { label: 'Arıza tipi', value: ARIZA_ALT_TYPES.find(t => t.id === state.hasarType)?.label || '—' },
                        { label: 'Çekici', value: state.isSurulebilir ? 'Gerekmiyor' : 'Çağırıldı' },
                    ]}
                    primaryAction={{ label: stepConfig?.primaryLabel || 'Devam', onClick: () => navigate('screen-hasar-flow-3') }}
                    secondaryAction={{ label: 'Geri Dön', onClick: () => navigate('screen-hasar-flow') }}
                >
                    {/* ── Category-specific questions ── */}
                    {questions.length > 0 && (
                        <div className="settings-group">
                            {questions.map(question => (
                                <div className="form-group" key={question.id}>
                                    <label className="form-label">{question.label}</label>
                                    <div className="toggle-group toggle-group--wrap">
                                        {question.options.map(option => (
                                            <ToggleButton
                                                key={option}
                                                label={option}
                                                active={state.dynamicAnswers[question.id] === option}
                                                onClick={() => updateState({
                                                    dynamicAnswers: {
                                                        ...state.dynamicAnswers,
                                                        [question.id]: option,
                                                    },
                                                })}
                                            />
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* ── Media hint ── */}
                    {meta.mediaHint && (
                        <div className={`ariza-media-hint ${toneClass}`}>
                            <span className="ariza-media-hint__icon">
                                {meta.tone === 'urgent' ? '⚠️' : meta.tone === 'diagnostic' ? '🎯' : '💡'}
                            </span>
                            <p className="ariza-media-hint__text">{meta.mediaHint}</p>
                        </div>
                    )}

                    {/* ── Media upload — ordered by category priority ── */}
                    <div className="media-upload-grid">
                        {orderedMediaButtons.map((btn, idx) => (
                            <MediaAction
                                key={btn.label}
                                icon={btn.icon}
                                label={btn.label}
                                highlight={idx === 0} // first = highest priority
                                onClick={() => addMedia(btn.ext)}
                            />
                        ))}
                    </div>

                    {/* ── Uploaded preview ── */}
                    {state.media.length > 0 && (
                        <div className="uploaded-preview">
                            {state.media.map((item, index) => (
                                <div key={item + index} className="uploaded-item">
                                    <span>{item.endsWith('.mp4') ? '🎥' : item.endsWith('.aac') ? '🎙️' : '📷'} {item}</span>
                                    <button className="remove-x" onClick={() => removeMedia(index)}>✕</button>
                                </div>
                            ))}
                        </div>
                    )}
                </FlowStepShell>
                <div className="bottom-spacer" />
            </div>
        </>
    );
}

/* ──────────────── Step 3: Servis Tercihi + Önizleme + Gönder ──────────────── */

export function HasarFlow3() {
    const { navigate, navTo } = useApp();
    const { state, updateState, resetState } = usePersistedFlowState(FLOW_STATE_KEY, INITIAL_STATE);
    const [submitted, setSubmitted] = useState(false);
    const { stepConfig, summaryRows } = useRequestFlowModel({ flowType: 'hasar', step: 3, state });

    return (
        <>
            <SubHeader title="Arıza Bildir" step={<StepIndicator current={3} />} />
            <div className="screen-scroll screen-scroll--sub">
                <FlowStepShell
                    progress={100}
                    title={submitted ? 'Vakan havuza dustu' : stepConfig?.title || 'Özet'}
                    helper={submitted ? 'Ustalar vakani gorup teklif gonderebilir. Sen de usta arayabilirsin.' : stepConfig?.helper || ''}
                    summaryRows={summaryRows}
                    summaryNote="Paylaştığın medya, tercihlerin ve açıklaman teklif kalitesini iyileştirmek için kullanılır."
                    primaryAction={{
                        label: submitted ? 'Vakama Git' : stepConfig?.primaryLabel || 'Gönder',
                        onClick: () => {
                            if (submitted) {
                                resetState();
                                navigate('screen-vaka-havuz');
                                return;
                            }
                            setSubmitted(true);
                        },
                    }}
                    secondaryAction={{
                        label: submitted ? 'Ana Sayfa' : 'Geri Dön',
                        onClick: () => {
                            if (submitted) {
                                resetState();
                                navTo('screen-home');
                                return;
                            }
                            navigate('screen-hasar-flow-2');
                        },
                    }}
                >
                    {/* ── Servis tercihi (pre-submit) ── */}
                    {!submitted && (
                        <div className="form-group">
                            <label className="form-label">Servis tercihi</label>
                            <div className="toggle-group">
                                {['Fark etmez', 'Yakin olsun', 'Ucuz olsun'].map(option => (
                                    <ToggleButton
                                        key={option}
                                        label={option}
                                        active={state.servicePref === option}
                                        onClick={() => updateState({ servicePref: option })}
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ── Success state ── */}
                    {submitted && (
                        <div className="success-message">
                            <div className="success-icon">✅</div>
                            <div className="success-title">Arıza vakası oluşturuldu</div>
                            <div className="success-text">Şimdi uygun ustaları listeleyebilir, sonra süreci uygulama içinden takip edebilirsin.</div>
                        </div>
                    )}
                </FlowStepShell>
                <div className="bottom-spacer" />
            </div>
        </>
    );
}

/* ──────────────── HasarFlow4 — preserved for route compatibility ──────────────── */
// Redirects to HasarFlow3 since step 4 was merged into step 3
export function HasarFlow4() {
    const { navigate } = useApp();
    // Use effect to redirect without causing re-render loops
    useState(() => { navigate('screen-hasar-flow-3'); });
    return null;
}
