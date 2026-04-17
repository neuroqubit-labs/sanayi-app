import { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { StatusPill, SectionBlock } from '@shared/components/DecisionPrimitives';
import { useUstaQuoteState, setNavParams } from '../hooks/useQuoteState';

const CATEGORY_TABS = [
    { id: 'all', label: 'Tümü' },
    { id: 'mekanik', label: 'Mekanik' },
    { id: 'bakim', label: 'Bakım' },
    { id: 'kaza', label: 'Kaza' },
];

const SORT_OPTIONS = [
    { id: 'match', label: 'Uyum' },
    { id: 'distance', label: 'Yakınlık' },
    { id: 'recent', label: 'Yeni' },
];

const URGENCY = { high: { label: 'Acil', tone: 'warning' }, medium: { label: 'Orta', tone: 'neutral' }, low: { label: 'Düşük', tone: 'neutral' } };
const CATEGORY_ICONS = { mekanik: '🔧', bakim: '🛠️', kaza: '💥' };

function MatchBar({ score }) {
    const color = score >= 90 ? 'var(--green)' : score >= 80 ? 'var(--accent)' : score >= 70 ? 'var(--orange)' : 'var(--text-3)';
    return (
        <div className="pool-match">
            <div className="pool-match__track">
                <div className="pool-match__fill" style={{ width: `${score}%`, background: color }} />
            </div>
            <span className="pool-match__label" style={{ color }}>%{score}</span>
        </div>
    );
}

function PoolJobCard({ job, onQuote, onDetail }) {
    return (
        <div className="pool-card" onClick={() => onDetail(job)}>
            <div className="pool-card__top">
                <div className="pool-card__icon">{CATEGORY_ICONS[job.category] || '📋'}</div>
                <div className="pool-card__info">
                    <div className="pool-card__title">{job.description.slice(0, 70)}{job.description.length > 70 ? '...' : ''}</div>
                    <div className="pool-card__vehicle">
                        {job.vehicle.model} · {job.vehicle.plate} · {job.vehicle.year}
                    </div>
                </div>
            </div>

            {/* AI Match + Meta row */}
            <div className="pool-card__meta-row">
                <div className="pool-card__match-col">
                    <span className="pool-card__meta-label">AI Uyum</span>
                    <MatchBar score={job.aiInsights.matchScore} />
                </div>
                <div className="pool-card__meta-chips">
                    <StatusPill label={URGENCY[job.urgency]?.label || 'Normal'} tone={URGENCY[job.urgency]?.tone || 'neutral'} />
                    <span className="pool-card__chip">{job.distanceKm} km</span>
                    <span className="pool-card__chip">{job.postedAgo}</span>
                </div>
            </div>

            {/* AI Insight — compact */}
            <div className="pool-card__insight">
                <div className="pool-card__insight-text">
                    <span className="pool-card__insight-category">{job.aiInsights.category}</span> — {job.aiInsights.summary}
                </div>
                <div className="pool-card__insight-cost">
                    ₺{job.aiInsights.estimatedCost.min.toLocaleString('tr-TR')} – ₺{job.aiInsights.estimatedCost.max.toLocaleString('tr-TR')}
                </div>
            </div>

            {/* Footer */}
            <div className="pool-card__footer">
                <span className="pool-card__quotes">
                    {job.quoteCount > 0 ? `${job.quoteCount} teklif` : 'Henüz teklif yok'}
                    {job.mediaCount > 0 && ` · 📷 ${job.mediaCount}`}
                </span>
                <button className="cta-btn cta-btn--sm" onClick={e => { e.stopPropagation(); onQuote(job); }}>Teklif Ver</button>
            </div>
        </div>
    );
}

function SentQuoteCard({ quote }) {
    const statusLabels = { pending: 'İnceleniyor', accepted: 'Kabul Edildi', rejected: 'Reddedildi' };
    const statusTones = { pending: 'warning', accepted: 'success', rejected: 'neutral' };

    return (
        <div className="usta-sent-quote-card">
            <div className="usta-sent-quote-card__body">
                <div className="usta-sent-quote-card__title">{quote.description || quote.vehicleInfo}</div>
                <div className="usta-sent-quote-card__meta">{quote.customerName} · {quote.vehicleInfo}</div>
            </div>
            <div className="usta-sent-quote-card__right">
                <div className="usta-sent-quote-card__amount">₺{quote.total.toLocaleString('tr-TR')}</div>
                <StatusPill label={statusLabels[quote.status] || quote.status} tone={statusTones[quote.status] || 'neutral'} />
            </div>
        </div>
    );
}

export default function PoolScreen() {
    const { navigate } = useApp();
    const { openJobs, sentQuotes } = useUstaQuoteState();
    const [categoryTab, setCategoryTab] = useState('all');
    const [sortBy, setSortBy] = useState('match');

    const filteredJobs = useMemo(() => {
        let jobs = categoryTab === 'all' ? openJobs : openJobs.filter(j => j.category === categoryTab);

        jobs = [...jobs].sort((a, b) => {
            if (sortBy === 'match') return b.aiInsights.matchScore - a.aiInsights.matchScore;
            if (sortBy === 'distance') return a.distanceKm - b.distanceKm;
            return 0; // 'recent' — keep original order (already sorted by postedAgo in data)
        });

        return jobs;
    }, [openJobs, categoryTab, sortBy]);

    const handleQuote = (job) => {
        setNavParams({ poolJobId: job.id });
        navigate('screen-quote-form');
    };

    const handleDetail = (job) => {
        setNavParams({ poolJobId: job.id });
        navigate('screen-pool-detail');
    };

    return (
        <div className="screen-scroll">
            {/* Header */}
            <div className="pool-header">
                <h2 className="pool-header__title">İş Havuzu</h2>
                <span className="pool-header__count">{openJobs.length} açık iş</span>
            </div>

            {/* Category Filter */}
            <div className="pool-filters">
                <div className="pool-category-tabs">
                    {CATEGORY_TABS.map(tab => (
                        <button
                            key={tab.id}
                            className={`pool-cat-btn ${categoryTab === tab.id ? 'pool-cat-btn--active' : ''}`}
                            onClick={() => setCategoryTab(tab.id)}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
                <div className="pool-sort">
                    {SORT_OPTIONS.map(opt => (
                        <button
                            key={opt.id}
                            className={`pool-sort-btn ${sortBy === opt.id ? 'pool-sort-btn--active' : ''}`}
                            onClick={() => setSortBy(opt.id)}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Pool Jobs */}
            {filteredJobs.length > 0 ? (
                <div className="pool-list">
                    {filteredJobs.map(job => (
                        <PoolJobCard
                            key={job.id}
                            job={job}
                            onQuote={handleQuote}
                            onDetail={handleDetail}
                        />
                    ))}
                </div>
            ) : (
                <div className="usta-empty">
                    <div className="usta-empty__icon">🔍</div>
                    <div className="usta-empty__text">Bu kategoride açık iş yok</div>
                    <div className="usta-empty__hint">Farklı bir kategori deneyin veya daha sonra tekrar bakın</div>
                </div>
            )}

            {/* Sent Quotes */}
            {sentQuotes.length > 0 && (
                <SectionBlock title="Gönderilen Teklifler" className="mt-16">
                    {sentQuotes.map(q => (
                        <SentQuoteCard key={q.id} quote={q} />
                    ))}
                </SectionBlock>
            )}

            <div className="bottom-spacer" />
        </div>
    );
}
