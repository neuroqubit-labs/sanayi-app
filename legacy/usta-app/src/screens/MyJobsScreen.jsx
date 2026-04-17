import { useApp } from '../context/AppContext';
import { StatusPill } from '@shared/components/DecisionPrimitives';
import { ChevronRight } from '@shared/components/Icons';
import { useMyJobsViewModel } from '../hooks/useMyJobsViewModel';
import { setNavParams } from '../hooks/useQuoteState';

function ActiveJobCard({ record, onTap }) {
    return (
        <button className="record-card record-card--active" style={{ borderLeftColor: `var(--${record.categoryColor === 'orange' ? 'orange' : record.categoryColor === 'red' ? 'red' : 'green'})` }} onClick={() => onTap(record)}>
            <div className="record-card__body">
                <div className="record-card__title">{record.title}</div>
                <div className="record-card__desc">{record.description}</div>
                {record.progress && (
                    <div className="record-card__progress">
                        <div className="record-card__progress-track">
                            <div className="record-card__progress-fill" style={{ width: `${record.progress.percent}%` }} />
                        </div>
                        <span className="record-card__progress-label">{record.progress.done}/{record.progress.total}</span>
                    </div>
                )}
                <div className="record-card__action-hint">
                    Aktif adım: {record.activeStepTitle} →
                </div>
            </div>
            {record.amountLabel && (
                <div className="record-card__amount">{record.amountLabel}</div>
            )}
        </button>
    );
}

function Stars({ rating }) {
    return (
        <span className="usta-stars">
            {[1, 2, 3, 4, 5].map(i => (
                <span key={i} className={i <= rating ? 'usta-stars__filled' : 'usta-stars__empty'}>★</span>
            ))}
        </span>
    );
}

function CompletedJobCard({ record, onTap }) {
    const color = `var(--${record.categoryColor === 'orange' ? 'orange' : record.categoryColor === 'red' ? 'red' : 'green'})`;

    return (
        <button className="completed-card" onClick={() => onTap(record)}>
            <div className="completed-card__accent" style={{ background: color }} />
            <div className="completed-card__body">
                {/* Header: category + status */}
                <div className="completed-card__header">
                    <span className={`record-badge badge-${record.categoryColor}`}>{record.category}</span>
                    <StatusPill label="Tamamlandı" tone="success" />
                </div>

                {/* Title + vehicle */}
                <div className="completed-card__title">{record.title}</div>
                <div className="completed-card__vehicle">{record.description}</div>

                {/* Steps summary */}
                {record.completedSteps.length > 0 && (
                    <div className="completed-card__steps">
                        {record.completedSteps.map((step, i) => (
                            <span key={i} className="completed-card__step-chip">✓ {step}</span>
                        ))}
                    </div>
                )}

                {/* Revenue + Duration row */}
                <div className="completed-card__summary">
                    {record.revenue && (
                        <span className="completed-card__net">
                            Net: ₺{record.revenue.net.toLocaleString('tr-TR')}
                        </span>
                    )}
                    {record.durationDays !== null && (
                        <span className="completed-card__duration">{record.durationDays} gün</span>
                    )}
                    <span className="completed-card__step-count">{record.stepCount} adım</span>
                </div>

                {/* Review */}
                {record.review && (
                    <div className="completed-card__review">
                        <div className="completed-card__review-top">
                            <Stars rating={record.review.rating} />
                            <span className="completed-card__reviewer">{record.review.customerName}</span>
                        </div>
                        <div className="completed-card__review-text">"{record.review.comment}"</div>
                    </div>
                )}

                {/* Payment status */}
                {record.revenue && record.revenue.paymentStatus !== 'received' && (
                    <div className="completed-card__payment-warning">
                        Tahsilat bekliyor
                    </div>
                )}
            </div>
            <div className="completed-card__chevron"><ChevronRight /></div>
        </button>
    );
}

function TabBar({ tabs, activeTab, onTabChange }) {
    return (
        <div className="kayitlar-tabs">
            {tabs.map(tab => (
                <button
                    key={tab.id}
                    className={`kayitlar-tab ${activeTab === tab.id ? 'kayitlar-tab--active' : ''}`}
                    onClick={() => onTabChange(tab.id)}
                >
                    {tab.label}
                </button>
            ))}
        </div>
    );
}

export default function MyJobsScreen() {
    const { navigate } = useApp();
    const vm = useMyJobsViewModel();

    const handleJobTap = (record) => {
        setNavParams({ caseId: record.id });
        navigate('screen-job-detail');
    };

    return (
        <div className="screen-scroll">
            {/* Header */}
            <div className="usta-screen-header">
                <h2 className="usta-screen-header__title">İşlerim</h2>
            </div>

            {/* Revenue Summary */}
            <div className="usta-revenue-strip">
                <div className="usta-revenue-strip__item">
                    <span className="usta-revenue-strip__label">Toplam Gelir</span>
                    <span className="usta-revenue-strip__value">₺{vm.totalRevenue.toLocaleString('tr-TR')}</span>
                </div>
                <div className="usta-revenue-strip__divider" />
                <div className="usta-revenue-strip__item">
                    <span className="usta-revenue-strip__label">Bekleyen</span>
                    <span className="usta-revenue-strip__value" style={{ color: 'var(--orange)' }}>₺{vm.pendingRevenue.toLocaleString('tr-TR')}</span>
                </div>
                {vm.avgRating && (
                    <>
                        <div className="usta-revenue-strip__divider" />
                        <div className="usta-revenue-strip__item">
                            <span className="usta-revenue-strip__label">Puan</span>
                            <span className="usta-revenue-strip__value">⭐ {vm.avgRating}</span>
                        </div>
                    </>
                )}
            </div>

            {/* Active Jobs */}
            {vm.activeRecords.length > 0 && (
                <div className="usta-section">
                    <div className="kayitlar-section-header">
                        <h3>Aktif İşler</h3>
                        <span className="record-badge badge-orange">{vm.activeCount}</span>
                    </div>
                    {vm.activeRecords.map(r => (
                        <ActiveJobCard key={r.id} record={r} onTap={handleJobTap} />
                    ))}
                </div>
            )}

            {/* Completed Jobs */}
            <div className="usta-section">
                <div className="kayitlar-section-header">
                    <h3>Tamamlanan İşler</h3>
                    <span className="completed-total">{vm.totalCompleted} iş</span>
                </div>
                <TabBar tabs={vm.completedTabs} activeTab={vm.activeTab} onTabChange={vm.setActiveTab} />
                {vm.filteredCompleted.length > 0 ? (
                    vm.filteredCompleted.map(r => (
                        <CompletedJobCard key={r.id} record={r} onTap={handleJobTap} />
                    ))
                ) : (
                    <div className="usta-empty" style={{ padding: '24px 0' }}>
                        <div className="usta-empty__text">Bu kategoride tamamlanan iş yok</div>
                    </div>
                )}
            </div>

            <div className="bottom-spacer" />
        </div>
    );
}
