import { useMemo, useState } from 'react';
import {
    BAKIM_DATE_OPTIONS,
    BAKIM_FLOW_STEPS,
    BAKIM_PART_OPTIONS,
    BAKIM_TYPE_OPTIONS,
    BAKIM_SUB_ITEMS,
    HASAR_FLOW_STEPS,
    HASAR_QUESTIONS,
    HASAR_TYPES,
    ARIZA_ALT_TYPES,
} from '../data/requestFlowData';

export function usePersistedFlowState(storageKey, initialState) {
    const [state, setState] = useState(() => {
        const saved = localStorage.getItem(storageKey);
        if (!saved) return initialState;

        try {
            return JSON.parse(saved);
        } catch {
            return initialState;
        }
    });

    const updateState = (updates) => {
        setState(prev => {
            const next = { ...prev, ...updates };
            localStorage.setItem(storageKey, JSON.stringify(next));
            return next;
        });
    };

    const resetState = () => {
        localStorage.removeItem(storageKey);
        setState(initialState);
    };

    return { state, updateState, resetState };
}

function getHasarSummary(state) {
    const questions = HASAR_QUESTIONS[state.hasarType] || [];
    const questionRows = questions.map(question => ({
        label: question.label,
        value: state.dynamicAnswers[question.id] || 'Belirtilmedi',
    }));

    return [
        { label: 'Arac', value: '34 ABC 42 · BMW 3 Serisi' },
        { label: 'Hasar Tipi', value: HASAR_TYPES.find(type => type.id === state.hasarType)?.label || 'Belirtilmedi' },
        ...questionRows,
        { label: 'Surulebilirlik', value: state.isSurulebilir ? 'Evet' : 'Cekici gerekli' },
        { label: 'Medya', value: state.media.length > 0 ? `${state.media.length} oge` : 'Eklenmedi' },
        { label: 'Servis Tercihi', value: state.servicePref },
    ];
}

function getBakimSummary(state) {
    const selectedType = BAKIM_TYPE_OPTIONS.find(option => option.id === state.maintenanceType);
    const selectedItems = state.selectedItems || {};
    const checkedCount = Object.values(selectedItems).filter(Boolean).length;
    const subItems = BAKIM_SUB_ITEMS[state.maintenanceType] || [];
    const checkedLabels = subItems
        .filter(item => selectedItems[item.id])
        .map(item => item.label);

    return [
        { label: 'Araç', value: '34 ABC 42 · BMW 3 Serisi' },
        { label: 'Bakım Tipi', value: selectedType?.label || 'Belirtilmedi' },
        { label: 'Kilometre', value: `${state.currentKm} km` },
        { label: 'Son Bakım', value: state.lastMaintenance },
        { label: 'Kalemler', value: checkedCount > 0 ? `${checkedCount} kalem: ${checkedLabels.join(', ')}` : 'Seçilmedi' },
        { label: 'Tarih', value: state.datePreference },
    ];
}

export function useRequestFlowModel({ flowType, step, state }) {
    return useMemo(() => {
        if (flowType === 'hasar') {
            const categoryMeta = ARIZA_ALT_TYPES.find(t => t.id === state.hasarType);
            return {
                stepConfig: HASAR_FLOW_STEPS[step],
                typeOptions: HASAR_TYPES,
                questions: HASAR_QUESTIONS[state.hasarType] || [],
                summaryRows: getHasarSummary(state),
                categoryMeta,
            };
        }

        const subItems = BAKIM_SUB_ITEMS[state.maintenanceType] || [];
        return {
            stepConfig: BAKIM_FLOW_STEPS[step],
            typeOptions: BAKIM_TYPE_OPTIONS,
            dateOptions: BAKIM_DATE_OPTIONS,
            partOptions: BAKIM_PART_OPTIONS,
            summaryRows: getBakimSummary(state),
            subItems,
        };
    }, [flowType, state, step]);
}
