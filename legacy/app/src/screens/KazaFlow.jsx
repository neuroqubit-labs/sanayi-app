import { useState } from 'react';
import { FlowStepShell } from '../components/DecisionPrimitives';
import SubHeader from '../components/SubHeader';
import { useApp } from '../context/AppContext';
import { usePersistedFlowState } from '../hooks/useRequestFlowModel';
import {
    KAZA_INITIAL_STATE,
    KAZA_FLOW_STEPS,
    KAZA_FOTO_STEPS,
    KAZA_TUTANAK_OPTIONS,
    KAZA_EVRAK_TYPES,
} from '../data/kazaFlowData';

const FLOW_STATE_KEY = 'kaza_flow_state';
const TOTAL_STEPS = 7;

function StepIndicator({ current }) {
    return <span>{current} / {TOTAL_STEPS - 1}</span>;
}

/* ─────────────────────────────────────────────
   Adım 0 — Acil Durum Paneli
   ───────────────────────────────────────────── */
export function KazaFlow0() {
    const { navigate } = useApp();
    const { state, updateState } = usePersistedFlowState(FLOW_STATE_KEY, KAZA_INITIAL_STATE);
    const step = KAZA_FLOW_STEPS[0];

    return (
        <>
            <SubHeader title="Kaza Bildirimi" step={<StepIndicator current={0} />} />
            <div className="screen-scroll screen-scroll--sub">
                <div className="emergency-panel">
                    <div className="emergency-panel__icon">🚨</div>
                    <h2 className="emergency-panel__title">{step.title}</h2>
                    <p className="emergency-panel__helper">{step.helper}</p>

                    <div className="emergency-panel__actions">
                        <button
                            className={`emergency-btn emergency-btn--ambulance ${state.ambulansCagirildi ? 'emergency-btn--activated' : ''}`}
                            onClick={() => {
                                updateState({ ambulansCagirildi: true });
                                window.location.href = 'tel:112';
                            }}
                        >
                            <span className="emergency-btn__icon">🚑</span>
                            <span className="emergency-btn__label">Ambulans Cagir</span>
                            <span className="emergency-btn__sub">112'yi arar</span>
                        </button>

                        <button
                            className={`emergency-btn emergency-btn--tow ${state.cekiciCagirildi ? 'emergency-btn--activated' : ''}`}
                            onClick={() => {
                                updateState({ cekiciCagirildi: true });
                                navigate('screen-cekici');
                            }}
                        >
                            <span className="emergency-btn__icon">🚜</span>
                            <span className="emergency-btn__label">Cekici Cagir</span>
                            <span className="emergency-btn__sub">Cekici talebi olustur</span>
                        </button>
                    </div>

                    <button
                        className="emergency-btn emergency-btn--continue"
                        onClick={() => navigate('screen-kaza-flow-1')}
                    >
                        {step.primaryLabel}
                    </button>
                </div>
                <div className="bottom-spacer" />
            </div>
        </>
    );
}

/* ─────────────────────────────────────────────
   Adım 1 — Kaza Türü
   ───────────────────────────────────────────── */
export function KazaFlow1() {
    const { navigate } = useApp();
    const { state, updateState } = usePersistedFlowState(FLOW_STATE_KEY, KAZA_INITIAL_STATE);
    const step = KAZA_FLOW_STEPS[1];

    return (
        <>
            <SubHeader title="Kaza Bildirimi" step={<StepIndicator current={1} />} />
            <div className="screen-scroll screen-scroll--sub">
                <FlowStepShell
                    progress={17}
                    title={step.title}
                    helper={step.helper}
                    primaryAction={{ label: step.primaryLabel, onClick: () => navigate('screen-kaza-flow-2') }}
                    secondaryAction={{ label: 'Geri Don', onClick: () => navigate('screen-kaza-flow-0') }}
                >
                    <div className="form-group">
                        <label className="form-label">Kaza turu</label>
                        <div className="toggle-group">
                            <button
                                className={`toggle-btn ${state.kazaTipi === 'tek_tarafli' ? 'active' : ''}`}
                                onClick={() => updateState({ kazaTipi: 'tek_tarafli' })}
                            >
                                Tek Tarafli
                            </button>
                            <button
                                className={`toggle-btn ${state.kazaTipi === 'karsi_tarafli' ? 'active' : ''}`}
                                onClick={() => updateState({ kazaTipi: 'karsi_tarafli' })}
                            >
                                Karsi Tarafli
                            </button>
                        </div>
                    </div>

                    {state.kazaTipi === 'karsi_tarafli' && (
                        <div className="form-group">
                            <label className="form-label">Kac arac var?</label>
                            <div className="toggle-group">
                                {[1, 2, 3].map(count => (
                                    <button
                                        key={count}
                                        className={`toggle-btn ${state.karsiTarafSayisi === count ? 'active' : ''}`}
                                        onClick={() => updateState({ karsiTarafSayisi: count })}
                                    >
                                        {count === 3 ? '3+' : count}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="form-group">
                        <label className="form-label">Kisa aciklama</label>
                        <textarea
                            className="form-textarea"
                            placeholder="Orn: Kavsakta sag seride donmeye calisirken arka tampondan vuruldum..."
                            value={state.aciklama}
                            onChange={e => updateState({ aciklama: e.target.value })}
                        />
                    </div>
                </FlowStepShell>
                <div className="bottom-spacer" />
            </div>
        </>
    );
}

/* ─────────────────────────────────────────────
   Adım 2 — Rehberli Fotoğraf Çekimi
   ───────────────────────────────────────────── */
function PhotoStep({ fotoStep, photos, onAdd, onRemove }) {
    const items = photos || [];
    const isFull = items.length >= fotoStep.maxPhotos;

    return (
        <div className="photo-guide-step">
            <div className="photo-guide-step__header">
                <span className="photo-guide-step__icon">{fotoStep.icon}</span>
                <div>
                    <div className="photo-guide-step__title">
                        {fotoStep.title}
                        {fotoStep.required && <span className="required-dot">*</span>}
                    </div>
                    <div className="photo-guide-step__instruction">{fotoStep.instruction}</div>
                </div>
            </div>

            <div className="photo-guide-step__grid">
                {items.map((photo, idx) => (
                    <div key={photo + idx} className="photo-guide-step__thumb">
                        <span>📷</span>
                        <button className="remove-x" onClick={() => onRemove(idx)}>✕</button>
                    </div>
                ))}
                {!isFull && (
                    <button className="photo-guide-step__add" onClick={onAdd}>
                        <span>+</span>
                        <span className="photo-guide-step__counter">{items.length}/{fotoStep.maxPhotos}</span>
                    </button>
                )}
            </div>
        </div>
    );
}

export function KazaFlow2() {
    const { navigate } = useApp();
    const { state, updateState } = usePersistedFlowState(FLOW_STATE_KEY, KAZA_INITIAL_STATE);
    const step = KAZA_FLOW_STEPS[2];
    const [showTrafficAlert, setShowTrafficAlert] = useState(false);

    // Karşı taraflı değilse plaka adımını filtrele
    const visibleSteps = KAZA_FOTO_STEPS.filter(
        s => !s.onlyKarsiTarafli || state.kazaTipi === 'karsi_tarafli'
    );

    const totalPhotos = Object.values(state.fotograflar).reduce((sum, arr) => sum + (arr?.length || 0), 0);

    const handleContinue = () => {
        setShowTrafficAlert(true);
    };

    return (
        <>
            <SubHeader title="Kaza Bildirimi" step={<StepIndicator current={2} />} />
            <div className="screen-scroll screen-scroll--sub">
                <FlowStepShell
                    progress={34}
                    title={step.title}
                    helper={step.helper}
                    summaryRows={[{ label: 'Toplam fotograf', value: `${totalPhotos} adet` }]}
                    primaryAction={{
                        label: showTrafficAlert ? 'Tutanaga Gec' : step.primaryLabel,
                        onClick: showTrafficAlert ? () => navigate('screen-kaza-flow-3') : handleContinue,
                    }}
                    secondaryAction={{ label: 'Geri Don', onClick: () => navigate('screen-kaza-flow-1') }}
                >
                    {showTrafficAlert && (
                        <div className="traffic-alert">
                            <span className="traffic-alert__icon">✅</span>
                            <p className="traffic-alert__text">
                                Yarali veya hasari agir bir arac yoksa, arac/araclari trafigi bozmayacak sekilde kenara cekebilirsiniz. Bu adimdan sonrasi evrak islemleridir.
                            </p>
                        </div>
                    )}

                    {visibleSteps.map(fotoStep => (
                        <PhotoStep
                            key={fotoStep.id}
                            fotoStep={fotoStep}
                            photos={state.fotograflar[fotoStep.id]}
                            onAdd={() => {
                                const current = state.fotograflar[fotoStep.id] || [];
                                updateState({
                                    fotograflar: {
                                        ...state.fotograflar,
                                        [fotoStep.id]: [...current, `${fotoStep.id}_${current.length + 1}.jpg`],
                                    },
                                });
                            }}
                            onRemove={idx => {
                                const current = [...(state.fotograflar[fotoStep.id] || [])];
                                current.splice(idx, 1);
                                updateState({
                                    fotograflar: { ...state.fotograflar, [fotoStep.id]: current },
                                });
                            }}
                        />
                    ))}
                </FlowStepShell>
                <div className="bottom-spacer" />
            </div>
        </>
    );
}

/* ─────────────────────────────────────────────
   Adım 3 — Kaza Tutanağı
   ───────────────────────────────────────────── */
export function KazaFlow3() {
    const { navigate } = useApp();
    const { state, updateState } = usePersistedFlowState(FLOW_STATE_KEY, KAZA_INITIAL_STATE);
    const step = KAZA_FLOW_STEPS[3];

    return (
        <>
            <SubHeader title="Kaza Bildirimi" step={<StepIndicator current={3} />} />
            <div className="screen-scroll screen-scroll--sub">
                <FlowStepShell
                    progress={50}
                    title={step.title}
                    helper={step.helper}
                    primaryAction={{ label: step.primaryLabel, onClick: () => navigate('screen-kaza-flow-4') }}
                    secondaryAction={{ label: 'Geri Don', onClick: () => navigate('screen-kaza-flow-2') }}
                >
                    <div className="flow-info-panel flow-info-panel--open">
                        <p className="flow-info-panel__body">
                            Kaza tutanagi, kazayi her iki tarafin da karsilikli onayiyla anlattigi resmi belgedir. Kirtasiyelerden ulasilabilir, islak imzali doldurulmalidir. E-Devlet uzerinden dijital olarak da olusturulabilir.
                        </p>
                    </div>

                    <div className="tutanak-options">
                        {KAZA_TUTANAK_OPTIONS.map(option => (
                            <button
                                key={option.id}
                                className={`tutanak-option-card ${state.tutanakKaynak === option.id ? 'tutanak-option-card--selected' : ''}`}
                                onClick={() => updateState({ tutanakKaynak: option.id, tutanakYuklendi: false })}
                            >
                                <span className="tutanak-option-card__icon">{option.icon}</span>
                                <div className="tutanak-option-card__content">
                                    <div className="tutanak-option-card__label">{option.label}</div>
                                    <div className="tutanak-option-card__desc">{option.description}</div>
                                </div>
                                {state.tutanakKaynak === option.id && (
                                    <span className="badge-green-sm">Secildi</span>
                                )}
                            </button>
                        ))}
                    </div>

                    {state.tutanakKaynak && state.tutanakKaynak !== 'polis' && (
                        <button
                            className={`media-upload-box ${state.tutanakYuklendi ? 'media-upload-box--done' : ''}`}
                            onClick={() => updateState({ tutanakYuklendi: true })}
                        >
                            <span className="media-upload-icon">
                                {state.tutanakYuklendi ? '✅' : '📎'}
                            </span>
                            <span>{state.tutanakYuklendi ? 'Yuklendi' : 'Dosya Yukle'}</span>
                        </button>
                    )}

                    {state.tutanakKaynak === 'polis' && (
                        <div className="flow-info-panel">
                            <p className="flow-info-panel__body flow-info-panel__body--dim">
                                Polis tutanagini 1-2 gun icinde emniyetten alabilirsiniz. Bu adimi simdilik gecip daha sonra ekleyebilirsiniz.
                            </p>
                        </div>
                    )}

                    <button
                        className="skip-link"
                        onClick={() => navigate('screen-kaza-flow-4')}
                    >
                        Simdilik gecip daha sonra ekle →
                    </button>
                </FlowStepShell>
                <div className="bottom-spacer" />
            </div>
        </>
    );
}

/* ─────────────────────────────────────────────
   Adım 4 — Evrak ve Belgeler
   ───────────────────────────────────────────── */
function EvrakSection({ title, taraf, evraklar, onUpload }) {
    return (
        <div className="evrak-section">
            <h4 className="evrak-section__title">{title}</h4>
            {KAZA_EVRAK_TYPES.map(evrakType => {
                const uploaded = evraklar[evrakType.id];
                return (
                    <button
                        key={evrakType.id}
                        className={`document-upload-card ${uploaded ? 'document-upload-card--done' : ''}`}
                        onClick={() => onUpload(taraf, evrakType.id)}
                    >
                        <span className="document-upload-card__icon">{evrakType.icon}</span>
                        <span className="document-upload-card__label">{evrakType.label}</span>
                        <span className={`document-upload-card__status ${uploaded ? 'status--done' : 'status--missing'}`}>
                            {uploaded ? '✅ Eklendi' : '⏳ Eksik'}
                        </span>
                    </button>
                );
            })}
        </div>
    );
}

export function KazaFlow4() {
    const { navigate } = useApp();
    const { state, updateState } = usePersistedFlowState(FLOW_STATE_KEY, KAZA_INITIAL_STATE);
    const step = KAZA_FLOW_STEPS[4];

    const handleUpload = (taraf, evrakId) => {
        updateState({
            evraklar: {
                ...state.evraklar,
                [taraf]: {
                    ...state.evraklar[taraf],
                    [evrakId]: `${taraf}_${evrakId}.jpg`,
                },
            },
        });
    };

    return (
        <>
            <SubHeader title="Kaza Bildirimi" step={<StepIndicator current={4} />} />
            <div className="screen-scroll screen-scroll--sub">
                <FlowStepShell
                    progress={67}
                    title={step.title}
                    helper={step.helper}
                    primaryAction={{ label: step.primaryLabel, onClick: () => navigate('screen-kaza-flow-5') }}
                    secondaryAction={{ label: 'Geri Don', onClick: () => navigate('screen-kaza-flow-3') }}
                >
                    <EvrakSection
                        title="Kendi Belgeleriniz"
                        taraf="kendi"
                        evraklar={state.evraklar.kendi}
                        onUpload={handleUpload}
                    />

                    {state.kazaTipi === 'karsi_tarafli' && (
                        <EvrakSection
                            title="Karsi Taraf Belgeleri"
                            taraf="karsiTaraf"
                            evraklar={state.evraklar.karsiTaraf}
                            onUpload={handleUpload}
                        />
                    )}

                    <div className="flow-info-panel">
                        <p className="flow-info-panel__body flow-info-panel__body--dim">
                            Eksik evraklari daha sonra da ekleyebilirsiniz. Havuza dusen bildirimde eksik evrak durumu ustalar ve sigorta sirketleri tarafindan gorulebilir.
                        </p>
                    </div>
                </FlowStepShell>
                <div className="bottom-spacer" />
            </div>
        </>
    );
}

/* ─────────────────────────────────────────────
   Adım 5 — Sigorta / Kasko Tercihleri
   ───────────────────────────────────────────── */
export function KazaFlow5() {
    const { navigate } = useApp();
    const { state, updateState } = usePersistedFlowState(FLOW_STATE_KEY, KAZA_INITIAL_STATE);
    const step = KAZA_FLOW_STEPS[5];

    return (
        <>
            <SubHeader title="Kaza Bildirimi" step={<StepIndicator current={5} />} />
            <div className="screen-scroll screen-scroll--sub">
                <FlowStepShell
                    progress={83}
                    title={step.title}
                    helper={step.helper}
                    primaryAction={{ label: step.primaryLabel, onClick: () => navigate('screen-kaza-flow-6') }}
                    secondaryAction={{ label: 'Geri Don', onClick: () => navigate('screen-kaza-flow-4') }}
                >
                    <div className="insurance-options">
                        <label className="insurance-toggle">
                            <input
                                type="checkbox"
                                checked={state.kaskoBasvuru}
                                onChange={e => updateState({ kaskoBasvuru: e.target.checked })}
                            />
                            <span className="insurance-toggle__label">Kaskoya basvurmak istiyorum</span>
                        </label>
                        {state.kaskoBasvuru && (
                            <input
                                className="form-input"
                                placeholder="Kasko sirket adi"
                                value={state.kaskoSirket}
                                onChange={e => updateState({ kaskoSirket: e.target.value })}
                            />
                        )}

                        <label className="insurance-toggle">
                            <input
                                type="checkbox"
                                checked={state.sigortaBasvuru}
                                onChange={e => updateState({ sigortaBasvuru: e.target.checked })}
                            />
                            <span className="insurance-toggle__label">Sigortaya basvurmak istiyorum</span>
                        </label>
                        {state.sigortaBasvuru && (
                            <input
                                className="form-input"
                                placeholder="Sigorta sirket adi"
                                value={state.sigortaSirket}
                                onChange={e => updateState({ sigortaSirket: e.target.value })}
                            />
                        )}
                    </div>
                </FlowStepShell>
                <div className="bottom-spacer" />
            </div>
        </>
    );
}

/* ─────────────────────────────────────────────
   Adım 6 — Önizleme ve Onay
   ───────────────────────────────────────────── */
function PreviewSection({ title, children, defaultOpen }) {
    const [open, setOpen] = useState(defaultOpen || false);
    return (
        <div className="preview-section">
            <button className="preview-section__header" onClick={() => setOpen(prev => !prev)}>
                <span>{title}</span>
                <span>{open ? '▾' : '▸'}</span>
            </button>
            {open && <div className="preview-section__body">{children}</div>}
        </div>
    );
}

export function KazaFlow6() {
    const { navigate, navTo } = useApp();
    const { state, resetState } = usePersistedFlowState(FLOW_STATE_KEY, KAZA_INITIAL_STATE);
    const step = KAZA_FLOW_STEPS[6];
    const [submitted, setSubmitted] = useState(false);

    const totalPhotos = Object.values(state.fotograflar).reduce((sum, arr) => sum + (arr?.length || 0), 0);

    // Eksik evrak hesaplama
    const eksikEvraklar = [];
    KAZA_EVRAK_TYPES.forEach(e => {
        if (!state.evraklar.kendi[e.id]) eksikEvraklar.push(`Kendi - ${e.label}`);
    });
    if (state.kazaTipi === 'karsi_tarafli') {
        KAZA_EVRAK_TYPES.forEach(e => {
            if (!state.evraklar.karsiTaraf[e.id]) eksikEvraklar.push(`Karsi Taraf - ${e.label}`);
        });
    }

    const summaryRows = [
        { label: 'Arac', value: '34 ABC 42 · BMW 3 Serisi' },
        { label: 'Kaza Turu', value: state.kazaTipi === 'tek_tarafli' ? 'Tek tarafli' : `Karsi tarafli (${state.karsiTarafSayisi} arac)` },
        { label: 'Ambulans', value: state.ambulansCagirildi ? 'Cagirildi' : 'Cagirilmadi' },
        { label: 'Cekici', value: state.cekiciCagirildi ? 'Cagirildi' : 'Cagirilmadi' },
        { label: 'Fotograflar', value: `${totalPhotos} adet` },
        { label: 'Tutanak', value: state.tutanakKaynak ? (state.tutanakYuklendi ? 'Yuklendi' : 'Secildi, bekleniyor') : 'Henuz eklenmedi' },
        { label: 'Eksik Evrak', value: eksikEvraklar.length > 0 ? `${eksikEvraklar.length} adet` : 'Tamamlandi' },
    ];

    if (state.kaskoBasvuru) summaryRows.push({ label: 'Kasko', value: state.kaskoSirket || 'Sirket belirtilmedi' });
    if (state.sigortaBasvuru) summaryRows.push({ label: 'Sigorta', value: state.sigortaSirket || 'Sirket belirtilmedi' });

    return (
        <>
            <SubHeader title="Kaza Bildirimi" step={<StepIndicator current={6} />} />
            <div className="screen-scroll screen-scroll--sub">
                <FlowStepShell
                    progress={100}
                    title={submitted ? 'Kaza bildirimin havuza dustu' : step.title}
                    helper={submitted ? 'Ustalar vakani gorup teklif gonderebilir. Sen de usta arayabilirsin.' : step.helper}
                    summaryRows={summaryRows}
                    primaryAction={{
                        label: submitted ? 'Vakama Git' : step.primaryLabel,
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
                        label: submitted ? 'Ana Sayfa' : 'Geri Don',
                        onClick: () => {
                            if (submitted) {
                                resetState();
                                navTo('screen-home');
                                return;
                            }
                            navigate('screen-kaza-flow-5');
                        },
                    }}
                >
                    {submitted && (
                        <div className="success-message">
                            <div className="success-icon">✅</div>
                            <div className="success-title">Kaza bildirimi olusturuldu</div>
                            <div className="success-text">
                                Hasar havuzuna dusuruldu. Ustalar teklif gonderebilir.
                                {(state.kaskoBasvuru || state.sigortaBasvuru) && ' Sigorta/kasko basvurulariniz otomatik olarak dosyalandi.'}
                            </div>
                        </div>
                    )}

                    {!submitted && (
                        <>
                            <PreviewSection title={`Fotograflar (${totalPhotos})`}>
                                <div className="preview-photo-grid">
                                    {Object.entries(state.fotograflar).map(([stepId, photos]) =>
                                        (photos || []).map((photo, idx) => (
                                            <div key={`${stepId}-${idx}`} className="photo-guide-step__thumb">
                                                <span>📷</span>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </PreviewSection>

                            <PreviewSection title={`Evraklar${eksikEvraklar.length > 0 ? ` (${eksikEvraklar.length} eksik)` : ''}`}>
                                {eksikEvraklar.length > 0 ? (
                                    <div className="missing-list">
                                        {eksikEvraklar.map(evrak => (
                                            <div key={evrak} className="missing-badge">⏳ {evrak}</div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="preview-complete">Tum evraklar tamamlandi ✅</p>
                                )}
                            </PreviewSection>

                            {state.aciklama && (
                                <PreviewSection title="Aciklama" defaultOpen>
                                    <p className="preview-text">{state.aciklama}</p>
                                </PreviewSection>
                            )}
                        </>
                    )}
                </FlowStepShell>
                <div className="bottom-spacer" />
            </div>
        </>
    );
}
