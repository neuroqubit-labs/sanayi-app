import { useApp } from '../context/AppContext';
import { StatusPill } from '../components/DecisionPrimitives';
import { useKayitlarViewModel } from '../hooks/useKayitlarViewModel';
import { setNavParams } from '../hooks/useQuoteState';

function TabBar({ tabs, active, onSwitch }) {
    return (
        <div className="tab-bar">
            {tabs.map(t => (
                <button key={t.id} className={`tab-btn ${active === t.id ? 'active' : ''}`} onClick={() => onSwitch(t.id)}>
                    {t.label}
                </button>
            ))}
        </div>
    );
}

function ActiveRecordCard({ record, onTap }) {
    const colorClass = `record-card--active-${record.categoryColor}`;

    return (
        <div className={`record-card record-card--active ${colorClass}`} onClick={() => onTap(record)}>
            <div className="record-card__header">
                <StatusPill label={record.statusLabel} tone={record.statusTone} />
                <span className="record-date">{record.date}</span>
            </div>
            <div className="record-card__title">{record.title}</div>
            <div className="record-card__desc">{record.description}</div>
            {record.progress && (
                <div className="record-card__progress">
                    <div
                        className="record-card__progress-fill"
                        style={{
                            width: `${record.progress.percent}%`,
                            background: `var(--${record.categoryColor === 'orange' ? 'orange' : record.categoryColor === 'red' ? 'red, #ef4444' : 'accent'})`,
                        }}
                    />
                </div>
            )}
            <div className="record-card__footer">
                {record.amountLabel && <span className="record-amount">{record.amountLabel}</span>}
                {record.progress && (
                    <span className="record-km">%{record.progress.percent} tamamlandı</span>
                )}
            </div>
            <div className="record-card__action-hint" style={{ marginTop: 6 }}>
                {record.status === 'pool' || record.status === 'quoted' ? 'Teklifleri Gör →' : 'Akışı Görüntüle →'}
            </div>
        </div>
    );
}

function CompletedRecordCard({ record, onTap, onProviderTap }) {
    return (
        <div className="record-card" onClick={() => onTap(record)}>
            <div className="record-card__header">
                <span className={`record-badge ${record.badgeClass}`}>{record.statusLabel}</span>
                <span className="record-date">{record.date}</span>
            </div>
            <div className="record-card__title">{record.title}</div>
            <div className="record-card__desc">{record.description}</div>
            <div className="record-card__footer">
                {record.amountLabel && <span className="record-amount">{record.amountLabel}</span>}
                {record.provider && (
                    <button
                        className="record-card__provider-link"
                        onClick={(e) => {
                            e.stopPropagation();
                            onProviderTap(record.provider.name);
                        }}
                    >
                        {record.provider.name} →
                    </button>
                )}
            </div>
        </div>
    );
}

export default function KayitlarScreen() {
    const { navigate } = useApp();
    const vm = useKayitlarViewModel();

    const handleTap = (record) => {
        setNavParams(record.navParams);
        navigate(record.route);
    };

    const handleProviderTap = (providerName) => {
        setNavParams({ providerName });
        navigate('screen-usta-profil');
    };

    return (
        <div className="screen-scroll">
            {/* Devam Eden Islemler */}
            <div className="kayitlar-section-header">
                <h3 className="kayitlar-section-header__title">Devam Eden İşlemler</h3>
                {vm.activeCount > 0 && <span className="badge-blue-sm">{vm.activeCount} Aktif</span>}
            </div>
            <div style={{ padding: '0 16px' }}>
                {vm.activeRecords.length > 0 ? (
                    vm.activeRecords.map(record => (
                        <ActiveRecordCard key={record.id} record={record} onTap={handleTap} />
                    ))
                ) : (
                    <div className="kayitlar-empty">Aktif işlem yok</div>
                )}
            </div>

            {/* Gecmis Kayitlar */}
            <div className="kayitlar-section-header" style={{ marginTop: 24 }}>
                <h3 className="kayitlar-section-header__title">Geçmiş Kayıtlar</h3>
            </div>

            <TabBar tabs={vm.completedTabs} active={vm.activeTab} onSwitch={vm.setActiveTab} />

            <div className="tab-content active">
                {vm.filteredCompleted.length > 0 ? (
                    vm.filteredCompleted.map(record => (
                        <CompletedRecordCard
                            key={record.id}
                            record={record}
                            onTap={handleTap}
                            onProviderTap={handleProviderTap}
                        />
                    ))
                ) : (
                    <div className="kayitlar-empty">Bu kategoride kayıt yok</div>
                )}
            </div>

            <div className="bottom-spacer" />
        </div>
    );
}
