import { useMemo, useState, useCallback } from 'react';
import { MATCH_CANDIDATES } from '../data/matchingData';
import { FEATURED_MASTERS, CAMPAIGNS, NEARBY_SERVICES } from '../data/discoveryData';
import { BAKIM_ITEMS, POPULAR_SEARCHES } from '../data/searchData';

const RECENT_KEY = 'sanayi_recent_searches';
const MAX_RECENT = 5;

// ─── Normalize all data sources into searchable items ───

function buildSearchIndex() {
    const items = [];
    const seenNames = new Set();

    // Ustalar / Servisler from matching data
    for (const c of MATCH_CANDIDATES) {
        const type = c.isServis ? 'servis' : 'usta';
        seenNames.add(c.name.toLowerCase());
        items.push({
            id: `${type}-${c.id}`,
            type,
            title: c.name,
            subtitle: c.tags.join(' · '),
            icon: c.initials,
            iconType: 'initials',
            meta: { rating: c.rating, distance: `${c.distanceKm} km`, reviews: c.reviews, isServis: !!c.isServis },
            route: 'screen-usta-profil',
            searchText: [c.name, ...c.tags, ...(c.detail?.expertiseTags || [])].join(' ').toLowerCase(),
        });
    }

    // Featured masters / servisler (deduplicate)
    for (const m of FEATURED_MASTERS) {
        if (seenNames.has(m.name.toLowerCase())) continue;
        const type = m.isServis ? 'servis' : 'usta';
        seenNames.add(m.name.toLowerCase());
        items.push({
            id: `${type}-fm-${m.id}`,
            type,
            title: m.name,
            subtitle: m.specialty,
            icon: m.avatar,
            iconType: 'emoji',
            meta: { rating: m.rating, discount: m.discount, isServis: !!m.isServis },
            route: m.route,
            searchText: [m.name, m.specialty].join(' ').toLowerCase(),
        });
    }

    // Bakim items
    for (const b of BAKIM_ITEMS) {
        items.push({
            id: `bakim-${b.id}`,
            type: 'bakim',
            title: b.title,
            subtitle: b.description,
            icon: b.icon,
            iconType: 'emoji',
            meta: { priceRange: b.priceRange },
            route: b.route,
            searchText: [b.title, b.description].join(' ').toLowerCase(),
        });
    }

    // Campaigns
    for (const c of CAMPAIGNS) {
        items.push({
            id: `kampanya-${c.id}`,
            type: 'kampanya',
            title: c.title,
            subtitle: c.description,
            icon: c.icon,
            iconType: 'emoji',
            meta: { oldPrice: c.originalPrice, newPrice: c.newPrice },
            route: c.route,
            searchText: [c.title, c.description].join(' ').toLowerCase(),
        });
    }

    // Nearby services as dukkan
    for (const s of NEARBY_SERVICES) {
        if (seenNames.has(s.name.toLowerCase())) continue;
        items.push({
            id: `dukkan-${s.id}`,
            type: 'dukkan',
            title: s.name,
            subtitle: s.tags.join(' · '),
            icon: '🏪',
            iconType: 'emoji',
            meta: { rating: s.rating, distance: s.distance, tags: s.tags },
            route: s.route,
            searchText: [s.name, ...s.tags].join(' ').toLowerCase(),
        });
    }

    return items;
}

// ─── Recent Searches (localStorage) ───

function getRecentSearches() {
    try {
        const raw = localStorage.getItem(RECENT_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

function saveRecentSearch(query) {
    const trimmed = query.trim();
    if (!trimmed || trimmed.length < 2) return;
    const recent = getRecentSearches().filter(s => s !== trimmed);
    recent.unshift(trimmed);
    localStorage.setItem(RECENT_KEY, JSON.stringify(recent.slice(0, MAX_RECENT)));
}

function clearRecentSearches() {
    localStorage.removeItem(RECENT_KEY);
}

// ─── Hook ───

export function useSearchViewModel(initialTab = 'tumu') {
    const [query, setQuery] = useState('');
    const [activeTab, setActiveTab] = useState(initialTab);
    const [recentSearches, setRecentSearches] = useState(getRecentSearches);

    const allItems = useMemo(() => buildSearchIndex(), []);

    const normalizedQuery = query.trim().toLowerCase();

    // Filter by query
    const queryFiltered = useMemo(() => {
        if (!normalizedQuery) return [];
        return allItems.filter(item => item.searchText.includes(normalizedQuery));
    }, [allItems, normalizedQuery]);

    // Count by tab
    const resultsByTab = useMemo(() => {
        const counts = { tumu: queryFiltered.length, usta: 0, servis: 0, bakim: 0, kampanya: 0, dukkan: 0 };
        for (const item of queryFiltered) {
            if (counts[item.type] !== undefined) counts[item.type]++;
        }
        return counts;
    }, [queryFiltered]);

    // Filter by active tab
    const results = useMemo(() => {
        if (activeTab === 'tumu') return queryFiltered;
        return queryFiltered.filter(item => item.type === activeTab);
    }, [queryFiltered, activeTab]);

    const commitSearch = useCallback((q) => {
        const val = q || query;
        if (val.trim().length >= 2) {
            saveRecentSearch(val.trim());
            setRecentSearches(getRecentSearches());
        }
    }, [query]);

    const clearRecent = useCallback(() => {
        clearRecentSearches();
        setRecentSearches([]);
    }, []);

    return {
        query,
        setQuery,
        activeTab,
        setActiveTab,
        results,
        resultsByTab,
        hasQuery: normalizedQuery.length > 0,
        recentSearches,
        popularSearches: POPULAR_SEARCHES,
        commitSearch,
        clearRecent,
    };
}
