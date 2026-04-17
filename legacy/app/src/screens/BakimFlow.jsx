import { useState, useMemo } from 'react';
import { FlowStepShell } from '../components/DecisionPrimitives';
import SubHeader from '../components/SubHeader';
import { useApp } from '../context/AppContext';
import { BAKIM_SUB_ITEMS, BAKIM_PART_OPTIONS, getSuggestedItems } from '../data/requestFlowData';
import { usePersistedFlowState, useRequestFlowModel } from '../hooks/useRequestFlowModel';

const BAKIM_FLOW_KEY = 'bakim_flow_state';

const INITIAL_STATE = {
    maintenanceType: 'periyodik',
    currentKm: '87.400',
    lastMaintenance: 'Mart 2026',
    datePreference: 'Bu hafta',
    selectedItems: {},      // { [itemId]: true/false }
    itemPartPrefs: {},      // { [itemId]: 'Orijinal' | 'Esdeger' | 'Fark etmez' }
    note: '',
};

/* ──────────────── Shared Primitives ──────────────── */

function ToggleButton({ label, active, onClick }) {
    return (
        <button className={`toggle-btn ${active ? 'active' : ''}`} onClick={onClick}>
            {label}
        </button>
    );
}

function StepIndicator({ current, total = 3 }) {
    return <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>{current} / {total}</span>;
}

/* ──────────────── Step 1: Bakım Tipi + Km + Akıllı İpucu ──────────────── */

export function BakimFlow1() {
    const { navigate } = useApp();
    const { state, updateState } = usePersistedFlowState(BAKIM_FLOW_KEY, INITIAL_STATE);
    const { stepConfig, typeOptions } = useRequestFlowModel({ flowType: 'bakim', step: 1, state });

    // Smart suggestion hint
    const kmNum = parseInt(String(state.currentKm).replace(/\D/g, ''), 10) || 0;
    const nextBand = [10000, 20000, 30000, 40000, 50000, 60000, 90000].find(b => b >= kmNum) || 90000;
    const suggestedIds = getSuggestedItems(state.currentKm);

    const handleContinue = () => {
        // Auto-select suggested items for periyodik type
        if (state.maintenanceType === 'periyodik') {
            const autoSelected = {};
            const autoPrefs = {};
            const items = BAKIM_SUB_ITEMS.periyodik || [];
            items.forEach(item => {
                const isSuggested = suggestedIds.includes(item.id);
                autoSelected[item.id] = isSuggested;
                if (item.defaultPart) {
                    autoPrefs[item.id] = item.defaultPart;
                }
            });
            updateState({ selectedItems: autoSelected, itemPartPrefs: autoPrefs });
        } else {
            // For other types, pre-fill with defaults
            const items = BAKIM_SUB_ITEMS[state.maintenanceType] || [];
            const autoSelected = {};
            const autoPrefs = {};
            items.forEach(item => {
                autoSelected[item.id] = true; // all selected by default for non-periyodik
                if (item.defaultPart) {
                    autoPrefs[item.id] = item.defaultPart;
                }
            });
            updateState({ selectedItems: autoSelected, itemPartPrefs: autoPrefs });
        }
        navigate('screen-bakim-flow-2');
    };

    return (
        <>
            <SubHeader title="Bakım Talebi" step={<StepIndicator current={1} />} />
            <div className="screen-scroll screen-scroll--sub">
                <FlowStepShell
                    progress={33}
                    title={stepConfig.title}
                    helper={stepConfig.helper}
                    summaryRows={[
                        { label: 'Son bakım', value: state.lastMaintenance },
                        { label: 'Kilometre', value: `${state.currentKm} km` },
                    ]}
                    primaryAction={{ label: stepConfig.primaryLabel, onClick: handleContinue }}
                >
                    {/* Bakım tipi seçimi */}
                    <div className="option-list">
                        {typeOptions.map(option => (
                            <button
                                key={option.id}
                                className={`option-row ${state.maintenanceType === option.id ? 'selected' : ''}`}
                                onClick={() => updateState({ maintenanceType: option.id })}
                            >
                                <span>{option.icon}</span>
                                <div>
                                    <div className="option-row__title">{option.label}</div>
                                    <div className="option-row__desc">{option.description}</div>
                                </div>
                                <span className="checkmark">{state.maintenanceType === option.id ? '✓' : ''}</span>
                            </button>
                        ))}
                    </div>

                    {/* Km girişi */}
                    <div className="form-group">
                        <label className="form-label">Güncel kilometre</label>
                        <input
                            className="form-input"
                            type="text"
                            inputMode="numeric"
                            value={state.currentKm}
                            onChange={event => updateState({ currentKm: event.target.value })}
                        />
                    </div>

                    {/* Son bakım */}
                    <div className="form-group">
                        <label className="form-label">Son bakım tarihi</label>
                        <input
                            className="form-input"
                            type="text"
                            value={state.lastMaintenance}
                            onChange={event => updateState({ lastMaintenance: event.target.value })}
                        />
                    </div>

                    {/* Akıllı öneri ipucu kartı */}
                    {state.maintenanceType === 'periyodik' && kmNum > 0 && (
                        <div className="km-suggestion-card">
                            <span className="km-suggestion-card__icon">💡</span>
                            <div className="km-suggestion-card__body">
                                <p className="km-suggestion-card__title">
                                    {nextBand.toLocaleString('tr-TR')} km bakımına yaklaşıyorsunuz
                                </p>
                                <p className="km-suggestion-card__desc">
                                    {suggestedIds.length} kalem otomatik seçilecek. Sonraki adımda düzenleyebilirsin.
                                </p>
                            </div>
                        </div>
                    )}
                </FlowStepShell>
                <div className="bottom-spacer" />
            </div>
        </>
    );
}

/* ──────────────── Step 2: Kalem Seçimi + Parça Tercihi + Tarih ──────────────── */

export function BakimFlow2() {
    const { navigate } = useApp();
    const { state, updateState } = usePersistedFlowState(BAKIM_FLOW_KEY, INITIAL_STATE);
    const { stepConfig, subItems, dateOptions } = useRequestFlowModel({ flowType: 'bakim', step: 2, state });

    const selectedItems = state.selectedItems || {};
    const itemPartPrefs = state.itemPartPrefs || {};

    const toggleItem = (itemId) => {
        updateState({
            selectedItems: { ...selectedItems, [itemId]: !selectedItems[itemId] },
        });
    };

    const setItemPart = (itemId, partPref) => {
        updateState({
            itemPartPrefs: { ...itemPartPrefs, [itemId]: partPref },
        });
    };

    const checkedCount = Object.values(selectedItems).filter(Boolean).length;

    return (
        <>
            <SubHeader title="Bakım Talebi" step={<StepIndicator current={2} />} />
            <div className="screen-scroll screen-scroll--sub">
                <FlowStepShell
                    progress={66}
                    title={stepConfig.title}
                    helper={stepConfig.helper}
                    summaryRows={[
                        { label: 'Seçili kalem', value: `${checkedCount} / ${subItems.length}` },
                    ]}
                    primaryAction={{ label: stepConfig.primaryLabel, onClick: () => navigate('screen-bakim-flow-3') }}
                    secondaryAction={{ label: 'Geri Dön', onClick: () => navigate('screen-bakim-flow') }}
                >
                    {/* Kalem listesi */}
                    <div className="bakim-item-list">
                        {subItems.map(item => {
                            const isChecked = !!selectedItems[item.id];
                            const partPref = itemPartPrefs[item.id] || item.defaultPart;

                            return (
                                <div key={item.id} className={`bakim-item-row ${isChecked ? 'bakim-item-row--active' : ''}`}>
                                    <button
                                        className="bakim-item-row__check"
                                        onClick={() => toggleItem(item.id)}
                                    >
                                        <span className={`bakim-check ${isChecked ? 'bakim-check--on' : ''}`}>
                                            {isChecked ? '✓' : ''}
                                        </span>
                                    </button>

                                    <span className="bakim-item-row__icon">{item.icon}</span>
                                    <span className="bakim-item-row__label">{item.label}</span>

                                    {/* Parça tercihi — sadece parça gerektiren kalemler için */}
                                    {isChecked && item.defaultPart !== null && (
                                        <select
                                            className="bakim-item-row__part-select"
                                            value={partPref || 'Fark etmez'}
                                            onChange={e => setItemPart(item.id, e.target.value)}
                                        >
                                            {BAKIM_PART_OPTIONS.map(opt => (
                                                <option key={opt} value={opt}>{opt}</option>
                                            ))}
                                        </select>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {/* Tarih tercihi */}
                    <div className="form-group">
                        <label className="form-label">Tercih edilen tarih</label>
                        <div className="toggle-group">
                            {dateOptions.map(option => (
                                <ToggleButton
                                    key={option}
                                    label={option}
                                    active={state.datePreference === option}
                                    onClick={() => updateState({ datePreference: option })}
                                />
                            ))}
                        </div>
                    </div>

                    {/* Ek not */}
                    <div className="form-group">
                        <label className="form-label">Ek not</label>
                        <textarea
                            className="form-textarea"
                            placeholder="Ör: Klima bakımı da eklenebilir, aracı sabah teslim edebilirim..."
                            value={state.note}
                            onChange={event => updateState({ note: event.target.value })}
                        />
                    </div>
                </FlowStepShell>
                <div className="bottom-spacer" />
            </div>
        </>
    );
}

/* ──────────────── Step 3: Zenginleştirilmiş Özet + Gönder ──────────────── */

export function BakimFlow3() {
    const { navigate, navTo } = useApp();
    const { state, resetState } = usePersistedFlowState(BAKIM_FLOW_KEY, INITIAL_STATE);
    const [submitted, setSubmitted] = useState(false);
    const { stepConfig, summaryRows, subItems } = useRequestFlowModel({ flowType: 'bakim', step: 3, state });

    const selectedItems = state.selectedItems || {};
    const itemPartPrefs = state.itemPartPrefs || {};
    const checkedItems = subItems.filter(item => selectedItems[item.id]);

    return (
        <>
            <SubHeader title="Bakım Talebi" step={<StepIndicator current={3} />} />
            <div className="screen-scroll screen-scroll--sub">
                <FlowStepShell
                    progress={100}
                    title={submitted ? 'Bakim talebin havuza dustu' : stepConfig.title}
                    helper={submitted ? 'Ustalar vakani gorup teklif gonderebilir. Sen de usta arayabilirsin.' : stepConfig.helper}
                    summaryRows={summaryRows}
                    summaryNote="Kayıtlarını referans alıp kalem ve tarih tercihini koruduk."
                    primaryAction={{
                        label: submitted ? 'Vakama Git' : stepConfig.primaryLabel,
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
                            navigate('screen-bakim-flow-2');
                        },
                    }}
                >
                    {/* Seçili kalem detayları */}
                    {!submitted && checkedItems.length > 0 && (
                        <div className="bakim-preview-list">
                            <div className="bakim-preview-list__title">Seçili Kalemler</div>
                            {checkedItems.map(item => (
                                <div key={item.id} className="bakim-preview-item">
                                    <span className="bakim-preview-item__icon">{item.icon}</span>
                                    <span className="bakim-preview-item__label">{item.label}</span>
                                    {item.defaultPart !== null && (
                                        <span className="bakim-preview-item__part">
                                            {itemPartPrefs[item.id] || item.defaultPart}
                                        </span>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Success */}
                    {submitted && (
                        <div className="success-message">
                            <div className="success-icon">✅</div>
                            <div className="success-title">Bakım talebi gönderildi</div>
                            <div className="success-text">Uygun servisler tekliflerini iletecek. Ardından kaydırarak seçim yapabilir veya ana ekrandan süreci izleyebilirsin.</div>
                        </div>
                    )}
                </FlowStepShell>
                <div className="bottom-spacer" />
            </div>
        </>
    );
}
