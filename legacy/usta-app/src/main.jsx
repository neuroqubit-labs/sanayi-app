import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import '@shared/styles/global.css';
import '@shared/styles/tokens.css';
import '@shared/styles/layout.css';
import '@shared/styles/primitives.css';
import '@shared/styles/core-flows.css';
import './styles/usta.css';

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
);
