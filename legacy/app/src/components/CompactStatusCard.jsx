import { StatusPill } from './DecisionPrimitives';

/**
 * Compact Status Card - Above the fold hero replacement
 * Vaka var ise: Durum özeti + tek primary action
 * Vaka yok ise: Tebrik mesajı + keşfe teşvik
 */
export default function CompactStatusCard({ state, onAction }) {
    const { hasActiveCase, tone, title, subtitle, metrics, actionLabel, actionRoute, icon } = state;

    return (
        <div className={`compact-status compact-status--${tone}`}>
            <div className="compact-status__header">
                <div className="compact-status__icon">{icon}</div>
                <StatusPill label={subtitle} tone={tone} />
            </div>

            <h2 className="compact-status__title">{title}</h2>

            {metrics && metrics.length > 0 && (
                <div className="compact-status__metrics">
                    {metrics.map(metric => (
                        <div className="compact-metric" key={metric.label}>
                            <span className="compact-metric__value">{metric.value}</span>
                            <span className="compact-metric__label">{metric.label}</span>
                        </div>
                    ))}
                </div>
            )}

            {actionLabel && (
                <button className="compact-status__action" onClick={() => onAction(actionRoute)}>
                    {actionLabel} →
                </button>
            )}

            {!hasActiveCase && (
                <p className="compact-status__hint">
                    Aşağı kaydırarak önerilen ustalar ve kampanyaları keşfet
                </p>
            )}
        </div>
    );
}
