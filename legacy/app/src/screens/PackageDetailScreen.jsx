import { PrimaryActionBar, SectionBlock, StatusPill, SummaryPanel } from '../components/DecisionPrimitives';
import SubHeader from '../components/SubHeader';
import { useApp } from '../context/AppContext';
import { findPackageById } from '../data/purchaseData';
import { getNavParams, setNavParams } from '../hooks/useQuoteState';

export default function PackageDetailScreen() {
    const { navigate, goBack } = useApp();
    const params = getNavParams();
    const pkg = findPackageById(params.packageId);

    if (!pkg) {
        return (
            <div className="screen-scroll screen-scroll--sub">
                <SubHeader title="Paket Detayi" />
                <div className="p-16">
                    <div className="empty-state">
                        <div className="empty-state__icon">📦</div>
                        <div className="empty-state__text">Paket bulunamadi</div>
                    </div>
                </div>
            </div>
        );
    }

    const handleBuy = () => {
        setNavParams({ packageId: pkg.id });
        navigate('screen-checkout');
    };

    const summaryRows = [
        { label: 'Sure', value: pkg.estimatedDuration },
        { label: 'Garanti', value: pkg.guarantee },
        { label: 'Servis', value: pkg.provider.name },
    ];

    return (
        <div className="screen-scroll screen-scroll--sub">
            <SubHeader title="Paket Detayi" />
            <div className="p-16">
                {/* Hero Card */}
                <div className="package-hero">
                    <div className="package-hero__icon">{pkg.icon}</div>
                    <h1 className="package-hero__title">{pkg.title}</h1>
                    <p className="package-hero__desc">{pkg.longDescription || pkg.description}</p>

                    <div className="package-price">
                        {pkg.originalPrice && (
                            <span className="package-price__old">₺{pkg.originalPrice.toLocaleString('tr-TR')}</span>
                        )}
                        <span className="package-price__current">₺{pkg.price.toLocaleString('tr-TR')}</span>
                    </div>

                    {pkg.tags.length > 0 && (
                        <div className="package-tags">
                            {pkg.tags.map(tag => (
                                <StatusPill key={tag} label={tag} tone={tag === 'Kampanya' ? 'success' : tag === 'Populer' ? 'info' : 'neutral'} />
                            ))}
                        </div>
                    )}
                </div>

                {/* Dahil Olan Hizmetler */}
                <SectionBlock title="Dahil Olan Hizmetler" className="mt-24">
                    <div className="package-included">
                        {pkg.includedItems.map((item, i) => (
                            <div key={i} className="package-included__item">
                                <span className="package-included__icon">{item.icon}</span>
                                <span className="package-included__label">{item.label}</span>
                                <span className="package-included__check">✓</span>
                            </div>
                        ))}
                    </div>
                </SectionBlock>

                {/* Servis Bilgisi */}
                <SectionBlock title="Servis Bilgisi" className="mt-24">
                    <button
                        className="package-provider package-provider--clickable"
                        onClick={() => {
                            setNavParams({ providerId: pkg.provider.id, providerName: pkg.provider.name });
                            navigate('screen-usta-profil');
                        }}
                    >
                        <div className="package-provider__avatar">{pkg.provider.initials}</div>
                        <div className="package-provider__info">
                            <div className="package-provider__name">{pkg.provider.name}</div>
                            <div className="package-provider__meta">
                                ⭐ {pkg.provider.rating.toFixed(1)} · {pkg.provider.reviews} yorum · {pkg.provider.distance}
                            </div>
                        </div>
                        <span className="package-provider__arrow">→</span>
                    </button>
                </SectionBlock>

                {/* Ozet */}
                <SummaryPanel rows={summaryRows} className="mt-24" />

                {/* Action */}
                <div className="mt-32 mb-32">
                    <PrimaryActionBar
                        stacked
                        primaryAction={{
                            label: `Satin Al — ₺${pkg.price.toLocaleString('tr-TR')}`,
                            onClick: handleBuy,
                        }}
                        secondaryAction={{
                            label: 'Geri Don',
                            onClick: goBack,
                        }}
                    />
                </div>
            </div>
        </div>
    );
}
