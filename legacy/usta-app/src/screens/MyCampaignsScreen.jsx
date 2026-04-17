import { useApp } from '../context/AppContext';
import SubHeader from '../components/SubHeader';

const CAT_LABELS = {
    bakim: 'Bakım',
    mekanik: 'Mekanik',
    kaza: 'Kaza / Hasar',
    lastik: 'Lastik',
    elektrik: 'Elektrik',
    genel: 'Tüm Hizmetler',
};

function computeStatus(c) {
    const today = new Date().toISOString().slice(0, 10);
    if (today < c.startDate) return 'upcoming';
    if (today > c.endDate) return 'ended';
    return 'active';
}

const STATUS_LABEL = { upcoming: 'Yaklaşan', ended: 'Sona Erdi', active: 'Aktif' };

function CampaignCard({ c }) {
    const status = computeStatus(c);
    const hasDiscount = c.originalPrice && c.originalPrice > c.price;
    const discountPercent = hasDiscount
        ? Math.round((1 - c.price / c.originalPrice) * 100)
        : 0;
    const itemsCount = (c.includedItems || []).length;
    const previewItems = (c.includedItems || []).slice(0, 3);

    return (
        <div className="usta-campaign-card">
            <div className={`usta-campaign-card__status usta-campaign-card__status--${status}`}>
                {STATUS_LABEL[status]}
            </div>

            <div className="usta-campaign-card__head">
                <div className="usta-campaign-card__icon">{c.icon || '🔧'}</div>
                <div className="usta-campaign-card__heading">
                    <div className="usta-campaign-card__title">{c.title}</div>
                    <div className="usta-campaign-card__category">{CAT_LABELS[c.category] || c.category}</div>
                </div>
            </div>

            <div className="usta-campaign-card__desc">{c.description}</div>

            <div className="usta-campaign-card__price-row">
                {hasDiscount && (
                    <span className="usta-campaign-card__price-old">
                        ₺{c.originalPrice.toLocaleString('tr-TR')}
                    </span>
                )}
                <span className="usta-campaign-card__price-new">
                    ₺{(c.price || 0).toLocaleString('tr-TR')}
                </span>
                {discountPercent > 0 && (
                    <span className="usta-campaign-card__price-badge">%{discountPercent}</span>
                )}
            </div>

            {itemsCount > 0 && (
                <div className="usta-campaign-card__items">
                    {previewItems.map((it, i) => (
                        <span key={i} className="usta-campaign-card__item-chip">
                            <span>{it.icon}</span>
                            <span>{it.label}</span>
                        </span>
                    ))}
                    {itemsCount > 3 && (
                        <span className="usta-campaign-card__item-chip usta-campaign-card__item-chip--more">
                            +{itemsCount - 3}
                        </span>
                    )}
                </div>
            )}

            {(c.tags && c.tags.length > 0) && (
                <div className="usta-campaign-card__tags">
                    {c.tags.map(t => (
                        <span key={t} className="usta-campaign-card__tag">{t}</span>
                    ))}
                </div>
            )}

            <div className="usta-campaign-card__footer">
                <span className="usta-campaign-card__meta-item">
                    {c.estimatedDuration ? `⏱ ${c.estimatedDuration}` : ''}
                </span>
                <span className="usta-campaign-card__dates">
                    {c.startDate} → {c.endDate}
                </span>
            </div>
        </div>
    );
}

export default function MyCampaignsScreen() {
    const { campaigns, navigate } = useApp();

    return (<>
        <SubHeader title="Kampanyalarım" />
        <div className="screen-scroll screen-scroll--sub">
            <div className="p-16">
                <button
                    className="usta-campaign-cta"
                    onClick={() => navigate('screen-campaign-create')}
                >
                    <span>📣</span>
                    <span>Yeni Kampanya Oluştur</span>
                </button>

                {campaigns.length === 0 ? (
                    <div className="usta-campaign-empty">
                        <div className="usta-campaign-empty__icon">📣</div>
                        <div className="usta-campaign-empty__title">Henüz kampanyan yok</div>
                        <div className="usta-campaign-empty__sub">
                            İlk kampanyanı oluşturarak müşterilere özel fırsatlar sun.
                        </div>
                    </div>
                ) : (
                    <div style={{ marginTop: 16 }}>
                        {campaigns.map(c => <CampaignCard key={c.id} c={c} />)}
                    </div>
                )}

                <div className="bottom-spacer" />
            </div>
        </div>
    </>);
}
