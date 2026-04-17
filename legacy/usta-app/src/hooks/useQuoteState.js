import { useState, useCallback } from 'react';
import { POOL_JOBS, SENT_QUOTES } from '../data/ustaData';

const NAV_PARAMS_KEY = 'usta_nav_params';
const POOL_KEY = 'usta_pool_jobs';
const SENT_KEY = 'usta_sent_quotes';

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

// ─── Navigation Params ───
export function setNavParams(params) {
    saveToStorage(NAV_PARAMS_KEY, params);
}

export function getNavParams() {
    return loadFromStorage(NAV_PARAMS_KEY, {});
}

// ─── Usta Quote State (Pool-based) ───
export function useUstaQuoteState() {
    const [poolJobs, setPoolJobs] = useState(() => loadFromStorage(POOL_KEY, POOL_JOBS));
    const [sentQuotes, setSentQuotes] = useState(() => loadFromStorage(SENT_KEY, SENT_QUOTES));

    const openJobs = poolJobs.filter(j => j.status === 'open');
    const quotedJobs = poolJobs.filter(j => j.status === 'quoted');

    const sendQuote = useCallback((jobId, quoteData) => {
        // Mark pool job as quoted
        const updatedPool = poolJobs.map(j =>
            j.id === jobId ? { ...j, status: 'quoted', quoteCount: (j.quoteCount || 0) + 1 } : j
        );
        setPoolJobs(updatedPool);
        saveToStorage(POOL_KEY, updatedPool);

        // Add to sent quotes
        const job = poolJobs.find(j => j.id === jobId);
        const newQuote = {
            id: `sq_${Date.now()}`,
            poolJobId: jobId,
            caseId: job?.caseId || '',
            customerName: 'Müşteri',
            vehicleInfo: job ? `${job.vehicle.plate} · ${job.vehicle.model}` : '',
            description: job?.description || '',
            total: quoteData.total,
            timeline: quoteData.timeline,
            status: 'pending',
            sentAt: new Date().toISOString(),
            ...quoteData,
        };
        const updatedSent = [...sentQuotes, newQuote];
        setSentQuotes(updatedSent);
        saveToStorage(SENT_KEY, updatedSent);

        return newQuote;
    }, [poolJobs, sentQuotes]);

    return {
        poolJobs,
        openJobs,
        quotedJobs,
        sentQuotes,
        sendQuote,
    };
}
