import { useEffect, useRef } from 'react';
import { SearchIcon, XIcon } from '../components/Icons';
import SubHeader from '../components/SubHeader';
import { useApp } from '../context/AppContext';
import { getNavParams, setNavParams } from '../hooks/useQuoteState';
import { useSearchViewModel } from '../hooks/useSearchViewModel';
import { findPackageByCampaignId, findPackageByBakimItemId } from '../data/purchaseData';

const TABS = [
    { id: 'tumu', label: 'Tumu' },
    { id: 'usta', label: 'Usta' },
    { id: 'servis', label: 'Servis' },
    { id: 'bakim', label: 'Bakim' },
    { id: 'kampanya', label: 'Kampanya' },
    { id: 'dukkan', label: 'Dukkan' },
];

// ─── Search Result Card ───
function SearchResultCard({ item, onNavigate }) {
    const handleClick = () => onNavigate();

    if (item.type === 'usta') {
        return (
            <button className="search-result-card search-result-card--usta" onClick={handleClick}>
                <div className={`search-result-card__icon ${item.iconType === 'initials' ? 'search-result-card__icon--initials' : ''}`}>
                    {item.icon}
                </div>
                <div className="search-result-card__body">
                    <div className="search-result-card__title">{item.title}</div>
                    <div className="search-result-card__subtitle">{item.subtitle}</div>
                    <div className="search-result-card__meta">
                        {item.meta.rating && <span>⭐ {item.meta.rating.toFixed(1)}</span>}
                        {item.meta.distance && <span>{item.meta.distance}</span>}
                        {item.meta.reviews && <span>{item.meta.reviews} yorum</span>}
                        {item.meta.discount && <span className="search-result-card__discount">{item.meta.discount}</span>}
                    </div>
                </div>
                <div className="search-result-card__arrow">→</div>
            </button>
        );
    }

    if (item.type === 'servis') {
        return (
            <button className="search-result-card search-result-card--servis" onClick={handleClick}>
                <div className={`search-result-card__icon ${item.iconType === 'initials' ? 'search-result-card__icon--initials' : ''}`}>
                    {item.icon}
                </div>
                <div className="search-result-card__body">
                    <div className="search-result-card__title">
                        {item.title}
                        <span className="search-result-card__servis-badge">Servis</span>
                    </div>
                    <div className="search-result-card__subtitle">{item.subtitle}</div>
                    <div className="search-result-card__meta">
                        {item.meta.rating && <span>⭐ {item.meta.rating.toFixed(1)}</span>}
                        {item.meta.distance && <span>{item.meta.distance}</span>}
                        {item.meta.reviews && <span>{item.meta.reviews} yorum</span>}
                        {item.meta.discount && <span className="search-result-card__discount">{item.meta.discount}</span>}
                    </div>
                </div>
                <div className="search-result-card__arrow">→</div>
            </button>
        );
    }

    if (item.type === 'bakim') {
        return (
            <button className="search-result-card search-result-card--bakim" onClick={handleClick}>
                <div className="search-result-card__icon">{item.icon}</div>
                <div className="search-result-card__body">
                    <div className="search-result-card__title">{item.title}</div>
                    <div className="search-result-card__subtitle">{item.subtitle}</div>
                    {item.meta.priceRange && (
                        <div className="search-result-card__price">{item.meta.priceRange}</div>
                    )}
                </div>
                <div className="search-result-card__arrow">→</div>
            </button>
        );
    }

    if (item.type === 'kampanya') {
        return (
            <button className="search-result-card search-result-card--kampanya" onClick={handleClick}>
                <div className="search-result-card__icon">{item.icon}</div>
                <div className="search-result-card__body">
                    <div className="search-result-card__title">{item.title}</div>
                    <div className="search-result-card__subtitle">{item.subtitle}</div>
                    <div className="search-result-card__pricing">
                        {item.meta.oldPrice && (
                            <span className="search-result-card__old-price">₺{item.meta.oldPrice.toLocaleString('tr-TR')}</span>
                        )}
                        {item.meta.newPrice > 0 && (
                            <span className="search-result-card__new-price">₺{item.meta.newPrice.toLocaleString('tr-TR')}</span>
                        )}
                        {item.meta.newPrice === 0 && (
                            <span className="search-result-card__new-price">Ucretsiz</span>
                        )}
                    </div>
                </div>
                <div className="search-result-card__arrow">→</div>
            </button>
        );
    }

    // dukkan (default)
    return (
        <button className="search-result-card search-result-card--dukkan" onClick={handleClick}>
            <div className="search-result-card__icon">{item.icon}</div>
            <div className="search-result-card__body">
                <div className="search-result-card__title">{item.title}</div>
                <div className="search-result-card__subtitle">{item.subtitle}</div>
                <div className="search-result-card__meta">
                    {item.meta.rating && <span>⭐ {item.meta.rating}</span>}
                    {item.meta.distance && <span>{item.meta.distance}</span>}
                </div>
            </div>
            <div className="search-result-card__arrow">→</div>
        </button>
    );
}

// ─── Main SearchScreen ───
export default function SearchScreen() {
    const { navigate } = useApp();
    const params = getNavParams();
    const initialTab = params.searchTab || 'tumu';

    const {
        query, setQuery,
        activeTab, setActiveTab,
        results, resultsByTab, hasQuery,
        recentSearches, popularSearches,
        commitSearch, clearRecent,
    } = useSearchViewModel(initialTab);

    const inputRef = useRef(null);
    const scrollRef = useRef(null);

    // Auto-focus on mount
    useEffect(() => {
        const timer = setTimeout(() => inputRef.current?.focus(), 100);
        return () => clearTimeout(timer);
    }, []);

    // Reset scroll on tab change
    useEffect(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = 0;
    }, [activeTab]);

    const handleQuerySubmit = () => {
        commitSearch();
    };

    const handlePopularClick = (term) => {
        setQuery(term);
        commitSearch(term);
    };

    const handleResultNavigate = (item) => {
        // Usta veya servis → profil ekranina providerId ile yonlendir
        if (item.type === 'usta' || item.type === 'servis') {
            // ID formatı: "usta-autopro" veya "servis-autopro" veya "usta-fm-master-2"
            const rawId = item.id.replace(/^(usta|servis)-(fm-)?/, '');
            setNavParams({ providerId: rawId, providerName: item.title });
            navigate('screen-usta-profil');
            return;
        }
        // Kampanya veya bakim → paket detay ekranina yonlendir
        if (item.type === 'kampanya') {
            const pkg = findPackageByCampaignId(item.id.replace('kampanya-', ''));
            if (pkg) {
                setNavParams({ packageId: pkg.id });
                navigate('screen-paket-detay');
                return;
            }
        }
        if (item.type === 'bakim') {
            const pkg = findPackageByBakimItemId(item.id.replace('bakim-', ''));
            if (pkg) {
                setNavParams({ packageId: pkg.id });
                navigate('screen-paket-detay');
                return;
            }
        }
        navigate(item.route);
    };

    return (
        <div className="search-screen">
            <SubHeader title="Ara" />

            {/* Sticky Search Bar */}
            <div className="search-sticky-bar">
                <div className="search-input">
                    <SearchIcon />
                    <input
                        ref={inputRef}
                        type="text"
                        placeholder="Usta, bakim, kampanya ara..."
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleQuerySubmit()}
                    />
                    {query && (
                        <button className="search-input__clear" onClick={() => setQuery('')}>
                            <XIcon />
                        </button>
                    )}
                </div>

                {/* Category Tabs */}
                <div className="search-tabs">
                    {TABS.map(tab => (
                        <button
                            key={tab.id}
                            className={`search-tab ${activeTab === tab.id ? 'search-tab--active' : ''}`}
                            onClick={() => setActiveTab(tab.id)}
                        >
                            {tab.label}
                            {hasQuery && resultsByTab[tab.id] > 0 && (
                                <span className="search-tab__count">{resultsByTab[tab.id]}</span>
                            )}
                        </button>
                    ))}
                </div>
            </div>

            {/* Content */}
            <div className="search-content" ref={scrollRef}>
                {!hasQuery ? (
                    /* ── Empty State: Popular + Recent ── */
                    <div className="search-discovery">
                        {/* Recent Searches */}
                        {recentSearches.length > 0 && (
                            <div className="search-section">
                                <div className="search-section__header">
                                    <h3 className="search-section__title">Son Aramalar</h3>
                                    <button className="search-section__clear" onClick={clearRecent}>Temizle</button>
                                </div>
                                <div className="search-chips">
                                    {recentSearches.map(term => (
                                        <button
                                            key={term}
                                            className="search-chip search-chip--recent"
                                            onClick={() => handlePopularClick(term)}
                                        >
                                            🕐 {term}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Popular Searches */}
                        <div className="search-section">
                            <h3 className="search-section__title">Populer Aramalar</h3>
                            <div className="search-chips">
                                {popularSearches.map(term => (
                                    <button
                                        key={term}
                                        className="search-chip"
                                        onClick={() => handlePopularClick(term)}
                                    >
                                        {term}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                ) : results.length > 0 ? (
                    /* ── Results ── */
                    <div className="search-results">
                        <div className="search-results__count">
                            {results.length} sonuc bulundu
                        </div>
                        {results.map(item => (
                            <SearchResultCard key={item.id} item={item} onNavigate={() => handleResultNavigate(item)} />
                        ))}
                    </div>
                ) : (
                    /* ── No Results ── */
                    <div className="search-empty">
                        <div className="search-empty__icon">🔍</div>
                        <div className="search-empty__title">Aradigin bulunamadi</div>
                        <div className="search-empty__desc">Farkli anahtar kelime dene veya kategori degistir</div>
                    </div>
                )}
            </div>
        </div>
    );
}
