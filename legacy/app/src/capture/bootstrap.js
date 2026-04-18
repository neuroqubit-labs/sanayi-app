function setCaptureDatasets(preset) {
    document.documentElement.dataset.captureActive = 'true';
    document.documentElement.dataset.captureMode = preset.captureMode;
    document.documentElement.dataset.capturePreset = preset.id;
    window.__LEGACY_CAPTURE_PRESET__ = preset;
}

function seedStorage({ clearKeys, storageSeed, navParamsKey, navParams }) {
    for (const key of clearKeys) {
        localStorage.removeItem(key);
    }

    for (const [key, value] of Object.entries(storageSeed || {})) {
        if (value === null) {
            localStorage.removeItem(key);
            continue;
        }

        localStorage.setItem(key, JSON.stringify(value));
    }

    if (!navParamsKey) return;

    if (navParams && Object.keys(navParams).length > 0) {
        localStorage.setItem(navParamsKey, JSON.stringify(navParams));
        return;
    }

    localStorage.removeItem(navParamsKey);
}

export function resolveCaptureBootstrap({ presets, clearKeys = [], navParamsKey }) {
    if (typeof window === 'undefined') {
        return { capturePreset: null, initialState: null };
    }

    const captureId = new URLSearchParams(window.location.search).get('capture');
    if (!captureId) {
        return { capturePreset: null, initialState: null };
    }

    const preset = presets.find((item) => item.id === captureId) || null;
    if (!preset) {
        console.warn(`[capture] preset not found: ${captureId}`);
        return { capturePreset: null, initialState: null };
    }

    seedStorage({
        clearKeys,
        storageSeed: preset.storageSeed,
        navParamsKey,
        navParams: preset.navParams,
    });
    setCaptureDatasets(preset);

    return {
        capturePreset: preset,
        initialState: preset.contextState || null,
    };
}
