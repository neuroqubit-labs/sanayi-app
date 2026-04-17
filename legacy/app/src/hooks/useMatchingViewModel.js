import { useMemo, useState } from 'react';
import { MATCH_CASE_CONTEXT, MATCH_CANDIDATES, MATCH_FILTERS } from '../data/matchingData';

function formatPriceRange(min, max) {
    return `₺${min.toLocaleString('tr-TR')} - ₺${max.toLocaleString('tr-TR')}`;
}

function formatResponse(minutes) {
    return minutes <= 2 ? '~2 dk' : `~${minutes} dk`;
}

function mapCandidate(candidate) {
    return {
        ...candidate,
        distanceLabel: `${candidate.distanceKm.toFixed(1)} km`,
        responseLabel: formatResponse(candidate.responseMinutes),
        priceLabel: formatPriceRange(candidate.priceMin, candidate.priceMax),
        ratingLabel: `${candidate.rating.toFixed(1)} (${candidate.reviews})`,
        metaLine: `${candidate.serviceMode} · ${candidate.eta}`,
    };
}

export function useMatchingViewModel(options = {}) {
    const { enableFilters = true } = options;
    const [searchQuery, setSearchQuery] = useState('');
    const [activeFilter, setActiveFilter] = useState('all');

    const allCandidates = useMemo(
        () => MATCH_CANDIDATES.map(mapCandidate),
        []
    );

    const candidates = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();

        return allCandidates.filter(candidate => {
            const matchesFilter = activeFilter === 'all' || candidate.filterTags.includes(activeFilter);
            const matchesQuery =
                !query ||
                candidate.name.toLowerCase().includes(query) ||
                candidate.tags.join(' ').toLowerCase().includes(query) ||
                candidate.reasonText.toLowerCase().includes(query);

            return matchesFilter && matchesQuery;
        });
    }, [activeFilter, allCandidates, searchQuery]);

    return {
        caseContext: MATCH_CASE_CONTEXT,
        filters: enableFilters ? MATCH_FILTERS : [],
        activeFilter,
        setActiveFilter,
        searchQuery,
        setSearchQuery,
        candidates,
        allCandidates,
        totalCandidates: allCandidates.length,
    };
}
