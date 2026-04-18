import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { resolveCaptureBootstrap } from './capture/bootstrap';
import { OWNER_CAPTURE_PRESETS, OWNER_CAPTURE_STORAGE_KEYS } from './capture/ownerCapturePresets';
import './styles/global.css';
import './styles/tokens.css';
import './styles/layout.css';
import './styles/primitives.css';
import './styles/core-flows.css';
import './styles/kaza-flow.css';
import './styles/home-screen.css';
import './styles/search-screen.css';
import './styles/checkout-flow.css';
import './styles/usta-profil.css';

if (typeof window !== 'undefined') {
    window.__LEGACY_CAPTURE_MANIFEST__ = OWNER_CAPTURE_PRESETS;
}

const bootstrap = resolveCaptureBootstrap({
    presets: OWNER_CAPTURE_PRESETS,
    clearKeys: OWNER_CAPTURE_STORAGE_KEYS,
    navParamsKey: 'sanayi_nav_params',
});

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <App initialState={bootstrap.initialState} capturePreset={bootstrap.capturePreset} />
    </React.StrictMode>
);
