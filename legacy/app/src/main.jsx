import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
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

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
);
