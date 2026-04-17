import { SearchIcon } from './Icons';
import { setNavParams } from '../hooks/useQuoteState';

const SEARCH_CATEGORIES = [
    { id: 'usta', label: 'Usta', icon: '🔧' },
    { id: 'servis', label: 'Servis', icon: '🏢' },
    { id: 'bakim', label: 'Bakim', icon: '🛠️' },
    { id: 'kampanya', label: 'Kampanya', icon: '🏷️' },
    { id: 'dukkan', label: 'Dukkan', icon: '🏪' },
];

export default function HomeSearchCard({ onNavigate }) {
    const handleCardClick = () => {
        setNavParams({ searchTab: 'tumu' });
        onNavigate('screen-search');
    };

    const handleChipClick = (e, tabId) => {
        e.stopPropagation();
        setNavParams({ searchTab: tabId });
        onNavigate('screen-search');
    };

    return (
        <div className="home-search-card" onClick={handleCardClick} role="button" tabIndex={0}>
            <div className="home-search-card__main">
                <div className="home-search-card__icon">
                    <SearchIcon />
                </div>
                <div className="home-search-card__content">
                    <div className="home-search-card__title">Ne arıyorsun? <span className="highlight">Hemen bul.</span></div>
                    <div className="home-search-card__subtitle">Usta, bakım, kampanya — 50+ hizmeti keşfet</div>
                </div>
                <div className="home-search-card__arrow">→</div>
            </div>
            <div className="home-search-card__chips">
                {SEARCH_CATEGORIES.map(cat => (
                    <button
                        key={cat.id}
                        className="home-search-chip"
                        onClick={(e) => handleChipClick(e, cat.id)}
                    >
                        <span>{cat.icon}</span>
                        <span>{cat.label}</span>
                    </button>
                ))}
            </div>
        </div>
    );
}
