import { useApp } from '../context/AppContext';
import SubHeader from '../components/SubHeader';
import { StatusPill, SectionBlock, SummaryPanel } from '@shared/components/DecisionPrimitives';
import { getNavParams, setNavParams } from '../hooks/useQuoteState';
import { POOL_JOBS } from '../data/ustaData';

const URGENCY = { high: { label: 'Acil', tone: 'warning' }, medium: { label: 'Orta', tone: 'neutral' }, low: { label: 'Düşük', tone: 'neutral' } };
const CATEGORY_ICONS = { mekanik: '🔧', bakim: '🛠️', kaza: '💥' };
const SLOT_LABELS = { morning: 'Sabah', afternoon: 'Öğleden Sonra', evening: 'Akşam', flexible: 'Esnek' };

function MatchScoreRing({ score }) {
    const color = score >= 90 ? 'var(--green)' : score >= 80 ? 'var(--accent)' : score >= 70 ? 'var(--orange)' : 'var(--text-3)';
    const circumference = 2 * Math.PI * 38;
    const offset = circumference - (score / 100) * circumference;

    return (
        <div className="pool-detail-ring">
            <svg width="88" height="88" viewBox="0 0 88 88">
                <circle cx="44" cy="44" r="38" fill="none" stroke="var(--surface)" strokeWidth="6" />
                <circle cx="44" cy="44" r="38" fill="none" stroke={color} strokeWidth="6"
                    strokeDasharray={circumference} strokeDashoffset={offset}
                    strokeLinecap="round" transform="rotate(-90 44 44)" />
            </svg>
            <div className="pool-detail-ring__value" style={{ color }}>%{score}</div>
        </div>
    );
}

export default function PoolJobDetailScreen() {
    const { navigate, goBack } = useApp();
    const params = getNavParams();
    const job = POOL_JOBS.find(j => j.id === params.poolJobId) || POOL_JOBS[0];
    const ai = job.aiInsights;
    const urg = URGENCY[job.urgency] || { label: 'Normal', tone: 'neutral' };

    const handleQuote = () => {
        setNavParams({ poolJobId: job.id });
        navigate('screen-quote-form');
    };

    const vehicleRows = [
        { label: 'Model', value: job.vehicle.model },
        { label: 'Yıl', value: job.vehicle.year },
        { label: 'Plaka', value: job.vehicle.plate },
        { label: 'Kilometre', value: `${job.vehicle.km} km` },
    ];

    return (<>
        <SubHeader title="İş Detayı" />
        <div className="screen-scroll screen-scroll--sub">

            {/* Hero: Category + Urgency + Distance */}
            <div className="pool-detail-hero">
                <div className="pool-detail-hero__left">
                    <span className="pool-detail-hero__icon">{CATEGORY_ICONS[job.category] || '📋'}</span>
                    <div>
                        <div className="pool-detail-hero__category">{ai.category}</div>
                        <div className="pool-detail-hero__meta">
                            <StatusPill label={urg.label} tone={urg.tone} />
                            <span className="pool-detail-hero__chip">{job.distanceKm} km</span>
                            <span className="pool-detail-hero__chip">{job.postedAgo}</span>
                        </div>
                    </div>
                </div>
                {job.quoteCount > 0 && (
                    <span className="pool-detail-hero__quotes">{job.quoteCount} teklif</span>
                )}
            </div>

            {/* Description */}
            <SectionBlock title="Arıza / Talep Açıklaması">
                <div className="pool-detail-desc">{job.description}</div>
            </SectionBlock>

            {/* Media */}
            {job.mediaCount > 0 && (
                <SectionBlock title={`Medya (${job.mediaCount})`} className="mt-12">
                    <div className="pool-detail-media">
                        {Array.from({ length: job.mediaCount }).map((_, i) => (
                            <div key={i} className="pool-detail-media__item">📷</div>
                        ))}
                    </div>
                </SectionBlock>
            )}

            {/* Vehicle Info */}
            <SectionBlock title="Araç Bilgisi" className="mt-12">
                <SummaryPanel rows={vehicleRows} />
            </SectionBlock>

            {/* AI Analysis */}
            <SectionBlock title="AI Analizi" className="mt-12">
                <div className="pool-detail-ai">
                    <MatchScoreRing score={ai.matchScore} />
                    <div className="pool-detail-ai__body">
                        <div className="pool-detail-ai__label">Uzmanlık Uyumu</div>
                        <div className="pool-detail-ai__text">{ai.summary}</div>
                        <div className="pool-detail-ai__cost">
                            Tahmini Maliyet: ₺{ai.estimatedCost.min.toLocaleString('tr-TR')} – ₺{ai.estimatedCost.max.toLocaleString('tr-TR')}
                        </div>
                    </div>
                </div>
            </SectionBlock>

            {/* Customer Availability */}
            {job.customerSlots && job.customerSlots.length > 0 && (
                <SectionBlock title="Müşteri Müsaitliği" className="mt-12">
                    <div className="pool-detail-slots">
                        {job.customerSlots.map((s, i) => (
                            <div key={i} className="pool-detail-slot">
                                <span className="pool-detail-slot__day">{s.day}</span>
                                <span className="pool-detail-slot__ranges">
                                    {s.ranges.map(r => SLOT_LABELS[r] || r).join(', ')}
                                </span>
                            </div>
                        ))}
                    </div>
                </SectionBlock>
            )}

            {/* Customer Note */}
            {job.customerNote && (
                <SectionBlock title="Müşteri Notu" className="mt-12">
                    <div className="pool-detail-note">"{job.customerNote}"</div>
                </SectionBlock>
            )}

            {/* CTA */}
            <div className="pool-detail-cta">
                <button className="cta-btn" onClick={handleQuote}>Teklif Oluştur</button>
            </div>

            <div className="bottom-spacer" />
        </div>
    </>);
}
