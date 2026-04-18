import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { resolveCaptureBootstrap } from '@shared/capture/bootstrap';
import { USTA_CAPTURE_PRESETS, USTA_CAPTURE_STORAGE_KEYS } from './capture/ustaCapturePresets';
import '@shared/styles/global.css';
import '@shared/styles/tokens.css';
import '@shared/styles/layout.css';
import '@shared/styles/primitives.css';
import '@shared/styles/core-flows.css';
import './styles/usta.css';

if (typeof window !== 'undefined') {
    window.__LEGACY_CAPTURE_MANIFEST__ = USTA_CAPTURE_PRESETS;
}

const bootstrap = resolveCaptureBootstrap({
    presets: USTA_CAPTURE_PRESETS,
    clearKeys: USTA_CAPTURE_STORAGE_KEYS,
    navParamsKey: 'usta_nav_params',
});

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <App initialState={bootstrap.initialState} capturePreset={bootstrap.capturePreset} />
    </React.StrictMode>
);
