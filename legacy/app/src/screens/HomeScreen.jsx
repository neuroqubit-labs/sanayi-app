import CompactStatusCard from '../components/CompactStatusCard';
import {
    FeaturedMasterCard,
    CampaignCard,
    NearbyServiceCard,
    DiscoverySection,
    PromoBanner,
} from '../components/DiscoveryFeed';
import HomeSearchCard from '../components/HomeSearchCard';
import { useApp } from '../context/AppContext';
import { useHomeViewModel } from '../hooks/useHomeViewModel';
import { findPackageByCampaignId } from '../data/purchaseData';
import { setNavParams } from '../hooks/useQuoteState';

/**
 * Activity Item - Son Aktivite Kartı
 */
function ActivityItem({ item, onOpen }) {
    return (
        <button className="activity-compact" onClick={() => onOpen(item.route)}>
            <div className={`activity-compact__icon activity-compact__icon--${item.tone}`}>{item.icon}</div>
            <div className="activity-compact__body">
                <div className="activity-compact__title">{item.title}</div>
                <div className="activity-compact__description">{item.description}</div>
            </div>
            <div className="activity-compact__time">{item.time}</div>
        </button>
    );
}

/**
 * HomeScreen - Yeni İki Katmanlı Yapı
 *
 * ABOVE THE FOLD (İşlevsel Katman):
 * - Topbar (araç seçici + bildirim)
 * - CompactStatusCard (vaka özeti + tek aksiyon)
 * - Son Aktivite (max 3)
 * - PromoBanner (tek satır - vaka yoksa)
 *
 * BELOW THE FOLD (Keşif Katmanı):
 * - Öne çıkan ustalar
 * - Kampanyalar
 * - Yakındaki servisler
 */
export default function HomeScreen() {
    const { navigate } = useApp();
    const { compactState, recentActivity, promoBanner, discoveryFeed } = useHomeViewModel();

    return (
        <div className="screen-scroll home-screen">
            {/* ========== ABOVE THE FOLD ========== */}

            {/* Home Search Card - Kesfif Giris Noktasi (en ustte) */}
            <HomeSearchCard onNavigate={navigate} />

            {/* Compact Status Card - Hero Replacement */}
            <CompactStatusCard state={compactState} onAction={navigate} />

            {/* Son Aktivite - Max 3 Item */}
            {recentActivity.length > 0 && (
                <section className="home-activity-section">
                    <div className="home-activity-section__header">
                        <h3 className="home-activity-section__title">Son Aktivite</h3>
                        <button
                            className="home-activity-section__view-all"
                            onClick={() => navigate('screen-kayitlar')}
                        >
                            Tümü →
                        </button>
                    </div>
                    <div className="activity-compact-list">
                        {recentActivity.map(item => (
                            <ActivityItem key={item.id} item={item} onOpen={navigate} />
                        ))}
                    </div>
                </section>
            )}

            {/* Promo Banner - Tek satır (vaka yoksa göster) */}
            {!compactState.hasActiveCase && (
                <PromoBanner promo={promoBanner} onOpen={navigate} />
            )}

            {/* Divider - Above/Below fold geçişi */}
            <div className="home-fold-divider" />

            {/* ========== BELOW THE FOLD - KEŞİF KATMANI ========== */}

            {/* Öne Çıkan Ustalar */}
            <DiscoverySection title="Sana Özel Ustalar" subtitle="Aracına uygun, güvenilir servisler">
                <div className="featured-masters-grid">
                    {discoveryFeed.featuredMasters.map(master => (
                        <FeaturedMasterCard key={master.id} master={master} onOpen={() => {
                            setNavParams({ providerName: master.name });
                            navigate('screen-usta-profil');
                        }} />
                    ))}
                </div>
            </DiscoverySection>

            {/* Kampanyalar */}
            <DiscoverySection title="Bakım Kampanyaları" subtitle="Bu ay özel fırsatlar">
                <div className="campaigns-list">
                    {discoveryFeed.campaigns.map(campaign => (
                        <CampaignCard key={campaign.id} campaign={campaign} onOpen={(route) => {
                            const pkg = findPackageByCampaignId(campaign.id);
                            if (pkg) {
                                setNavParams({ packageId: pkg.id });
                                navigate('screen-paket-detay');
                            } else {
                                navigate(route);
                            }
                        }} />
                    ))}
                </div>
            </DiscoverySection>

            {/* Yakındaki Servisler */}
            <DiscoverySection title="Yakınındaki Servisler" subtitle="Konumuna en yakın ustalar">
                <div className="nearby-services-grid">
                    {discoveryFeed.nearbyServices.map(service => (
                        <NearbyServiceCard key={service.id} service={service} onOpen={() => {
                            setNavParams({ providerName: service.name, providerRating: service.rating });
                            navigate('screen-usta-profil');
                        }} />
                    ))}
                </div>
            </DiscoverySection>

            <div className="bottom-spacer" />
        </div>
    );
}
