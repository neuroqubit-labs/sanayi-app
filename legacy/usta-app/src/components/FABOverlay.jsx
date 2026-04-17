import { useApp } from '../context/AppContext';

const AVAILABILITY_OPTIONS = [
    { id: 'open', label: 'Açık', icon: '🟢' },
    { id: 'busy', label: 'Meşgul', icon: '🟡' },
    { id: 'closed', label: 'Kapalı', icon: '🔴' },
];

export default function FABOverlay() {
    const { fabOpen, setFabOpen, fabGo, availability, setAvailability } = useApp();
    return (
        <div className={`fab-overlay ${fabOpen ? 'open' : ''}`} onClick={() => setFabOpen(false)}>
            <div className="fab-menu glass" onClick={e => e.stopPropagation()}>
                <div className="fab-menu__title">Hızlı İşlemler</div>

                <div className="fab-availability">
                    <div className="fab-availability__label">Müsaitlik Durumu</div>
                    <div className="fab-availability__pills">
                        {AVAILABILITY_OPTIONS.map(opt => (
                            <button
                                key={opt.id}
                                className={`fab-availability__pill ${availability === opt.id ? 'fab-availability__pill--active' : ''}`}
                                onClick={() => setAvailability(opt.id)}
                            >
                                <span>{opt.icon}</span>
                                <span>{opt.label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                <button className="fab-action fab-action--hero" onClick={() => fabGo('screen-campaign-create')}>
                    <span className="fab-action__icon">📣</span>
                    <div>
                        <div className="fab-action__title">Yeni Kampanya Oluştur</div>
                        <div className="fab-action__desc">Müşterilere özel teklif yayınla</div>
                    </div>
                </button>

                <button className="fab-action" onClick={() => fabGo('screen-my-campaigns')}>
                    <span className="fab-action__icon">📋</span>
                    <div>
                        <div className="fab-action__title">Kampanyalarım</div>
                        <div className="fab-action__desc">Yayında ve geçmiş kampanyalar</div>
                    </div>
                </button>

                <button className="fab-action" onClick={() => fabGo('screen-revenue')}>
                    <span className="fab-action__icon">💰</span>
                    <div>
                        <div className="fab-action__title">Gelir Özeti</div>
                        <div className="fab-action__desc">Haftalık gelir ve tahsilatlar</div>
                    </div>
                </button>
            </div>
        </div>
    );
}
