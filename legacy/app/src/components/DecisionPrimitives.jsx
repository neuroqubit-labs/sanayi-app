function ButtonContent({ action }) {
    if (!action) return null;

    return (
        <>
            {action.icon && <span className="primary-action-bar__icon">{action.icon}</span>}
            <span>{action.label}</span>
        </>
    );
}

export function StatusPill({ label, tone = 'neutral' }) {
    return <span className={`status-pill status-pill--${tone}`}>{label}</span>;
}

export function ReasonBadge({ label, tone = 'neutral', icon }) {
    return (
        <span className={`reason-badge reason-badge--${tone}`}>
            {icon && <span className="reason-badge__icon">{icon}</span>}
            <span>{label}</span>
        </span>
    );
}

export function SectionBlock({ eyebrow, title, description, actionLabel, onAction, children, className = '' }) {
    return (
        <section className={`section-block ${className}`.trim()}>
            {(eyebrow || title || actionLabel) && (
                <div className="section-block__header">
                    <div className="section-block__copy">
                        {eyebrow && <div className="section-block__eyebrow">{eyebrow}</div>}
                        {title && <h3 className="section-block__title">{title}</h3>}
                        {description && <p className="section-block__description">{description}</p>}
                    </div>
                    {actionLabel && (
                        <button className="section-block__action" onClick={onAction}>
                            {actionLabel}
                        </button>
                    )}
                </div>
            )}
            {children}
        </section>
    );
}

export function PrimaryActionBar({ primaryAction, secondaryAction, stacked = false }) {
    return (
        <div className={`primary-action-bar ${stacked ? 'primary-action-bar--stacked' : ''}`}>
            {primaryAction && (
                <button className="cta-btn cta-btn--hero" onClick={primaryAction.onClick}>
                    <ButtonContent action={primaryAction} />
                </button>
            )}
            {secondaryAction && (
                <button className="cta-btn cta-btn--outline" onClick={secondaryAction.onClick}>
                    <ButtonContent action={secondaryAction} />
                </button>
            )}
        </div>
    );
}

export function SummaryPanel({ rows, note, emphasize = false, className = '' }) {
    return (
        <div className={`summary-panel ${emphasize ? 'summary-panel--emphasize' : ''} ${className}`.trim()}>
            <div className="summary-card">
                {rows.map(row => (
                    <div className="summary-row" key={row.label}>
                        <span className="summary-label">{row.label}</span>
                        <span>{row.value}</span>
                    </div>
                ))}
            </div>
            {note && <p className="summary-panel__note">{note}</p>}
        </div>
    );
}

export function HeroDecisionCard({
    eyebrow,
    statusLabel,
    tone = 'neutral',
    title,
    description,
    metrics = [],
    primaryAction,
    secondaryAction,
    slot,
}) {
    return (
        <section className={`hero-decision hero-decision--${tone}`}>
            <div className="hero-decision__top">
                <div className="hero-decision__intro">
                    {eyebrow && <div className="hero-decision__eyebrow">{eyebrow}</div>}
                    <h1 className="hero-decision__title">{title}</h1>
                    <p className="hero-decision__description">{description}</p>
                </div>
                {statusLabel && <StatusPill label={statusLabel} tone={tone} />}
            </div>
            {metrics.length > 0 && (
                <div className="hero-decision__metrics">
                    {metrics.map(metric => (
                        <div className="hero-metric" key={metric.label}>
                            <span className="hero-metric__value">{metric.value}</span>
                            <span className="hero-metric__label">{metric.label}</span>
                        </div>
                    ))}
                </div>
            )}
            <PrimaryActionBar primaryAction={primaryAction} secondaryAction={secondaryAction} />
            {slot && (
                <div
                    className={`hero-decision__slot ${slot.enabled ? '' : 'hero-decision__slot--reserved'}`.trim()}
                    data-slot={slot.key}
                    aria-hidden={!slot.enabled}
                />
            )}
        </section>
    );
}

export function FlowStepShell({
    progress,
    title,
    helper,
    summaryRows,
    summaryNote,
    primaryAction,
    secondaryAction,
    children,
}) {
    const progressClassName = `flow-progress__bar flow-progress__bar--${progress}`;

    return (
        <div className="flow-step-shell">
            <div className="flow-progress">
                <div className={progressClassName} />
            </div>

            <div className="flow-step-shell__intro">
                <h3 className="flow-step-shell__title">{title}</h3>
                <p className="flow-step-shell__helper">{helper}</p>
            </div>

            {summaryRows && (
                <SummaryPanel rows={summaryRows} note={summaryNote} className="flow-step-shell__summary" />
            )}

            <div className="flow-step-shell__content">{children}</div>

            <div className="flow-step-shell__footer">
                <PrimaryActionBar primaryAction={primaryAction} secondaryAction={secondaryAction} stacked />
            </div>
        </div>
    );
}
