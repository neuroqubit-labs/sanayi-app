/**
 * Discovery Feed - Below the fold exploration area
 * Sponsorlu ustalar, kampanyalar, yakındaki servisler
 */

// Featured Master Card (Öne çıkan usta)
export function FeaturedMasterCard({ master, onOpen }) {
    return (
        <button className="featured-master" onClick={() => onOpen(master.route)}>
            <div className="featured-master__badge">
                {master.badge && <span className="badge">{master.badge}</span>}
            </div>
            <div className="featured-master__avatar">{master.avatar || '🔧'}</div>
            <div className="featured-master__name">{master.name}</div>
            <div className="featured-master__rating">
                <span className="star">⭐</span>
                <span>{master.rating}</span>
            </div>
            <div className="featured-master__specialty">{master.specialty}</div>
            {master.discount && (
                <div className="featured-master__discount">{master.discount}</div>
            )}
        </button>
    );
}

// Campaign Card (Bakım kampanyası)
export function CampaignCard({ campaign, onOpen }) {
    return (
        <button className="campaign-card" onClick={() => onOpen(campaign.route)}>
            <div className="campaign-card__icon">{campaign.icon}</div>
            <div className="campaign-card__body">
                <div className="campaign-card__title">{campaign.title}</div>
                <div className="campaign-card__description">{campaign.description}</div>
                <div className="campaign-card__pricing">
                    {campaign.originalPrice && (
                        <span className="campaign-card__old-price">{campaign.originalPrice} TL</span>
                    )}
                    <span className="campaign-card__new-price">{campaign.newPrice} TL</span>
                </div>
            </div>
            <div className="campaign-card__arrow">→</div>
        </button>
    );
}

// Nearby Service Card (Yakındaki servis)
export function NearbyServiceCard({ service, onOpen }) {
    return (
        <button className="nearby-service" onClick={() => onOpen(service.route)}>
            <div className="nearby-service__distance">
                <span className="nearby-service__distance-icon">📍</span>
                <span className="nearby-service__distance-value">{service.distance}</span>
            </div>
            <div className="nearby-service__name">{service.name}</div>
            <div className="nearby-service__rating">
                <span>⭐</span>
                <span>{service.rating}</span>
            </div>
            {service.tags && service.tags.length > 0 && (
                <div className="nearby-service__tags">
                    {service.tags.slice(0, 2).map(tag => (
                        <span key={tag} className="service-tag">{tag}</span>
                    ))}
                </div>
            )}
        </button>
    );
}

// Discovery Section Wrapper
export function DiscoverySection({ title, subtitle, children, className = '' }) {
    return (
        <section className={`discovery-section ${className}`.trim()}>
            <div className="discovery-section__header">
                <h3 className="discovery-section__title">{title}</h3>
                {subtitle && <p className="discovery-section__subtitle">{subtitle}</p>}
            </div>
            <div className="discovery-section__content">
                {children}
            </div>
        </section>
    );
}

// Single Promotional Banner (vaka yoksa gösterilecek)
export function PromoBanner({ promo, onOpen }) {
    return (
        <button className="promo-banner" onClick={() => onOpen(promo.route)}>
            <div className="promo-banner__icon">{promo.icon}</div>
            <div className="promo-banner__text">
                <div className="promo-banner__title">{promo.title}</div>
                <div className="promo-banner__subtitle">{promo.subtitle}</div>
            </div>
            <div className="promo-banner__cta">Keşfet →</div>
        </button>
    );
}
