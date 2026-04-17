import { useApp } from '../context/AppContext';
import { StatusPill } from '@shared/components/DecisionPrimitives';
import { ChevronRight } from '@shared/components/Icons';
import { useUstaHomeViewModel } from '../hooks/useUstaHomeViewModel';
import { setNavParams } from '../hooks/useQuoteState';

function StatCard({ value, label, accent }) {
    return (
        <div className="usta-stat-card">
            <div className="usta-stat-card__value" style={accent ? { color: accent } : {}}>{value}</div>
            <div className="usta-stat-card__label">{label}</div>
        </div>
    );
}

const AVAIL_MAP = {
    open: { label: 'Açık', icon: '🟢', className: 'usta-avail-badge--open' },
    busy: { label: 'Meşgul', icon: '🟡', className: 'usta-avail-badge--busy' },
    closed: { label: 'Kapalı', icon: '🔴', className: 'usta-avail-badge--closed' },
};

function AvailabilityBadge({ value }) {
    const info = AVAIL_MAP[value] || AVAIL_MAP.open;
    return (
        <span className={`usta-avail-badge ${info.className}`}>
            <span className="usta-avail-badge__dot">{info.icon}</span>
            {info.label}
        </span>
    );
}

function ActiveJobCard({ job, onTap }) {
    const categoryColors = { mekanik: 'var(--orange)', kaza: 'var(--red)', bakim: 'var(--green)' };
    const color = categoryColors[job.category] || 'var(--accent)';

    return (
        <button className="usta-job-card" onClick={() => onTap(job)}>
            <div className="usta-job-card__accent" style={{ background: color }} />
            <div className="usta-job-card__body">
                <div className="usta-job-card__title">{job.title}</div>
                <div className="usta-job-card__meta">
                    {job.vehiclePlate} · {job.vehicleModel}
                </div>

                {/* Progress */}
                <div className="usta-job-card__progress">
                    <div className="usta-job-card__progress-track">
                        <div className="usta-job-card__progress-fill" style={{ width: `${job.progress.percent}%`, background: color }} />
                    </div>
                    <span className="usta-job-card__progress-label">%{job.progress.percent}</span>
                </div>

                {/* Appointment — embedded */}
                {job.appointment && (
                    <div className={`usta-job-card__apt ${job.appointment.isToday ? 'usta-job-card__apt--today' : ''}`}>
                        <span className="usta-job-card__apt-icon">{job.appointment.isToday ? '🔴' : '📅'}</span>
                        <span>
                            {job.appointment.isToday ? `Bugün ${job.appointment.time}` : `${job.appointment.date} ${job.appointment.time}`}
                            {' — '}{job.appointment.label}
                        </span>
                    </div>
                )}

                {/* Usta action needed */}
                {job.ustaActionNeeded && (
                    <div className="usta-job-card__action">
                        Senin adımın: {job.activeStepTitle}
                    </div>
                )}

                {/* Waiting on others */}
                {!job.ustaActionNeeded && job.activeStepTitle && (
                    <div className="usta-job-card__waiting">
                        Bekleniyor: {job.activeStepTitle}
                    </div>
                )}
            </div>
            <ChevronRight />
        </button>
    );
}

function PendingQuoteRow({ quote }) {
    return (
        <div className="usta-pending-quote">
            <div className="usta-pending-quote__body">
                <div className="usta-pending-quote__title">{quote.description}</div>
                <div className="usta-pending-quote__meta">{quote.customerName} · ₺{quote.total.toLocaleString('tr-TR')}</div>
            </div>
            <StatusPill label="İnceleniyor" tone="warning" />
        </div>
    );
}

function AppointmentRow({ apt }) {
    return (
        <div className="usta-appointment-row">
            <div className="usta-appointment-row__time">{apt.date} {apt.time}</div>
            <div className="usta-appointment-row__body">
                <div className="usta-appointment-row__label">{apt.label}</div>
                <div className="usta-appointment-row__meta">{apt.vehiclePlate} · {apt.customerName}</div>
            </div>
            <StatusPill
                label={apt.status === 'confirmed' ? 'Onaylı' : 'Bekliyor'}
                tone={apt.status === 'confirmed' ? 'success' : 'warning'}
            />
        </div>
    );
}

export default function UstaHomeScreen() {
    const { navigate, availability } = useApp();
    const vm = useUstaHomeViewModel();

    const handleJobTap = (job) => {
        setNavParams({ caseId: job.id });
        navigate('screen-job-detail');
    };

    return (
        <div className="screen-scroll">
            {/* Hero */}
            <div className="usta-home-hero">
                <div className="usta-home-hero__greeting">
                    <div className="usta-home-hero__avatar">{vm.profile.initials}</div>
                    <div>
                        <div className="usta-home-hero__name">Merhaba, {vm.profile.ownerName.split(' ')[0]}</div>
                        <div className="usta-home-hero__subtitle">{vm.profile.name}</div>
                        <AvailabilityBadge value={availability} />
                    </div>
                </div>
                <div className="usta-home-hero__stats">
                    <StatCard value={vm.activeJobCount} label="Aktif İş" accent="var(--orange)" />
                    <StatCard value={vm.poolJobCount} label="Havuz İşi" accent="var(--accent)" />
                    <StatCard value={`₺${vm.weeklyGross.toLocaleString('tr-TR')}`} label="Bu Hafta" accent="var(--green)" />
                </div>
            </div>

            {/* Pool Banner */}
            {vm.poolJobCount > 0 && (
                <button className="usta-request-banner" onClick={() => navigate('screen-pool')}>
                    <span className="usta-request-banner__icon">🏊</span>
                    <span className="usta-request-banner__text">
                        {vm.poolJobCount} açık iş havuzda bekliyor
                    </span>
                    <span className="usta-request-banner__action">Keşfet →</span>
                </button>
            )}

            {/* Aktif İşler — enhanced with embedded appointments & action indicators */}
            {vm.activeJobs.length > 0 && (
                <div className="usta-section">
                    <div className="usta-section__header">
                        <h3 className="usta-section__title">Aktif İşler</h3>
                        <button className="usta-section__link" onClick={() => navigate('screen-my-jobs')}>Tümü →</button>
                    </div>
                    {vm.activeJobs.map(job => (
                        <ActiveJobCard key={job.id} job={job} onTap={handleJobTap} />
                    ))}
                </div>
            )}

            {/* Standalone Appointments — not linked to any active case */}
            {vm.standaloneAppointments.length > 0 && (
                <div className="usta-section">
                    <div className="usta-section__header">
                        <h3 className="usta-section__title">Diğer Randevular</h3>
                    </div>
                    {vm.standaloneAppointments.map(apt => (
                        <AppointmentRow key={apt.id} apt={apt} />
                    ))}
                </div>
            )}

            {/* Pending Quotes — awaiting customer response */}
            {vm.pendingQuotes.length > 0 && (
                <div className="usta-section">
                    <div className="usta-section__header">
                        <h3 className="usta-section__title">Yanıt Bekleyen Teklifler</h3>
                    </div>
                    {vm.pendingQuotes.map(q => (
                        <PendingQuoteRow key={q.id} quote={q} />
                    ))}
                </div>
            )}

            {/* Tahsilat Banner */}
            {vm.pendingCollection > 0 && (
                <button className="usta-collection-banner" onClick={() => navigate('screen-revenue')}>
                    <span>💰</span>
                    <span className="usta-collection-banner__text">
                        ₺{vm.pendingCollection.toLocaleString('tr-TR')} bekleyen tahsilat
                    </span>
                    <ChevronRight />
                </button>
            )}

            <div className="bottom-spacer" />
        </div>
    );
}
