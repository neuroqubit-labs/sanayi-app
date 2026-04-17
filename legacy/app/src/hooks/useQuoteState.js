import { useCallback, useEffect, useRef, useState } from 'react';
import { DEMO_QUOTES, DEMO_QUOTE_REQUESTS } from '../data/quoteData';

const QUOTES_KEY = 'sanayi_quotes';
const REQUESTS_KEY = 'sanayi_quote_requests';
const NAV_PARAMS_KEY = 'sanayi_nav_params';

function loadFromStorage(key, fallback) {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
    } catch {
        return fallback;
    }
}

function saveToStorage(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
}

// ─── Navigation Params (ekranlar arasi caseId/quoteId gecisi) ───
export function setNavParams(params) {
    saveToStorage(NAV_PARAMS_KEY, params);
}

export function getNavParams() {
    return loadFromStorage(NAV_PARAMS_KEY, {});
}

// ─── Quote State Hook ───
export function useQuoteState(caseId) {
    const [quotes, setQuotes] = useState(() => loadFromStorage(QUOTES_KEY, DEMO_QUOTES));
    const [quoteRequests, setQuoteRequests] = useState(() => loadFromStorage(REQUESTS_KEY, DEMO_QUOTE_REQUESTS));
    const mockTimerRef = useRef(null);

    // Persist on change
    useEffect(() => { saveToStorage(QUOTES_KEY, quotes); }, [quotes]);
    useEffect(() => { saveToStorage(REQUESTS_KEY, quoteRequests); }, [quoteRequests]);

    // Filter by caseId
    const caseQuotes = caseId ? quotes.filter(q => q.caseId === caseId) : quotes;
    const caseRequests = caseId ? quoteRequests.filter(r => r.caseId === caseId) : quoteRequests;

    const sendQuoteRequest = useCallback((targetCaseId, providerId, providerName, message = '', customerSlots = [], availability = '') => {
        const newRequest = {
            id: `qr_${Date.now()}`,
            caseId: targetCaseId,
            providerId,
            providerName,
            status: 'pending',
            sentAt: new Date().toISOString(),
            message,
            customerSlots,
            availability,
        };
        setQuoteRequests(prev => [...prev, newRequest]);
        return newRequest;
    }, []);

    const acceptQuote = useCallback((quoteId) => {
        setQuotes(prev => prev.map(q =>
            q.id === quoteId ? { ...q, status: 'accepted' } : q
        ));
    }, []);

    const rejectQuote = useCallback((quoteId) => {
        setQuotes(prev => prev.map(q =>
            q.id === quoteId ? { ...q, status: 'rejected' } : q
        ));
    }, []);

    // Mock: simulate receiving a quote after sending a request
    const mockReceiveQuote = useCallback((targetCaseId, providerId, providerName) => {
        if (mockTimerRef.current) clearTimeout(mockTimerRef.current);
        mockTimerRef.current = setTimeout(() => {
            const mockQuote = {
                id: `q_${Date.now()}`,
                requestId: null,
                caseId: targetCaseId,
                providerId,
                providerName,
                providerInitials: providerName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase(),
                providerRating: 4.5 + Math.random() * 0.4,
                providerReviews: 50 + Math.floor(Math.random() * 150),
                items: [
                    { name: 'Teshis', price: 200 },
                    { name: 'Parca', price: 1200 + Math.floor(Math.random() * 800) },
                    { name: 'Iscilik', price: 800 + Math.floor(Math.random() * 600) },
                ],
                total: 2200 + Math.floor(Math.random() * 1200),
                timeline: '2-3 gun',
                guarantee: '6 ay',
                validUntil: new Date(Date.now() + 4 * 86400000).toISOString().slice(0, 10),
                terms: 'Ek is cikarsa onceden onay alinir.',
                providerNote: 'Vaka detayini inceledik, uygun goruyoruz.',
                aiCompatibilityScore: 70 + Math.floor(Math.random() * 25),
                trustBadges: [{ label: 'Teklif hazir', tone: 'warning' }],
                providerSlot: (() => {
                    const d = new Date(Date.now() + (2 + Math.floor(Math.random() * 3)) * 86400000);
                    const dayNames = ['Paz', 'Pzt', 'Sal', 'Car', 'Per', 'Cum', 'Cmt'];
                    const monthNames = ['Oca', 'Sub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Agu', 'Eyl', 'Eki', 'Kas', 'Ara'];
                    const ranges = ['morning', 'afternoon', 'evening'];
                    const rangeLabels = { morning: 'Sabah (09:00 – 12:00)', afternoon: 'Ogle (12:00 – 15:00)', evening: 'Aksam (15:00 – 18:00)' };
                    const range = ranges[Math.floor(Math.random() * ranges.length)];
                    const dayLabel = `${dayNames[d.getDay()]}, ${d.getDate()} ${monthNames[d.getMonth()]}`;
                    return {
                        day: d.toISOString().slice(0, 10),
                        range,
                        time: `${dayLabel} — ${rangeLabels[range]}`,
                        dayLabel,
                    };
                })(),
                status: 'pending',
                sentAt: new Date().toISOString(),
            };
            setQuotes(prev => [...prev, mockQuote]);
            // Update the request status
            setQuoteRequests(prev => prev.map(r =>
                r.providerId === providerId && r.caseId === targetCaseId && r.status === 'pending'
                    ? { ...r, status: 'quoted' }
                    : r
            ));
        }, 2500);
    }, []);

    // Cleanup timer
    useEffect(() => () => { if (mockTimerRef.current) clearTimeout(mockTimerRef.current); }, []);

    return {
        quotes: caseQuotes,
        quoteRequests: caseRequests,
        allQuotes: quotes,
        allRequests: quoteRequests,
        sendQuoteRequest,
        acceptQuote,
        rejectQuote,
        mockReceiveQuote,
    };
}
