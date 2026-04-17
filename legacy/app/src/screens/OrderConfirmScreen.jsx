import { PrimaryActionBar, SectionBlock, SummaryPanel } from '../components/DecisionPrimitives';
import SubHeader from '../components/SubHeader';
import { useApp } from '../context/AppContext';
import { PAYMENT_METHODS } from '../data/purchaseData';
import { getOrder } from '../hooks/useCheckoutState';
import { getNavParams } from '../hooks/useQuoteState';

const NEXT_STEPS = [
    { icon: '📞', text: 'Servis sizinle iletisime gececek' },
    { icon: '🚗', text: 'Randevu saatinde aracinizi teslim edin' },
    { icon: '🔔', text: 'Islem sonrasi bildirim alacaksiniz' },
];

export default function OrderConfirmScreen() {
    const { navigate } = useApp();
    const params = getNavParams();
    const order = getOrder(params.orderId);

    if (!order) {
        return (
            <div className="screen-scroll screen-scroll--sub">
                <SubHeader title="Siparis" />
                <div className="p-16">
                    <div className="empty-state">
                        <div className="empty-state__icon">📦</div>
                        <div className="empty-state__text">Siparis bulunamadi</div>
                    </div>
                </div>
            </div>
        );
    }

    const slotLabel = order.slot ? formatSlotLabel(order.slot) : '—';
    const paymentLabel = PAYMENT_METHODS.find(m => m.id === order.paymentMethod)?.label || order.paymentLabel;

    const summaryRows = [
        { label: 'Paket', value: order.packageTitle },
        { label: 'Servis', value: order.provider.name },
        { label: 'Randevu', value: slotLabel },
        { label: 'Odeme', value: paymentLabel },
        { label: 'Tutar', value: `₺${order.price.toLocaleString('tr-TR')}` },
    ];

    return (
        <div className="screen-scroll screen-scroll--sub">
            <SubHeader title="Siparis Onaylandi" />
            <div className="p-16">
                {/* Success Hero */}
                <div className="order-success">
                    <div className="order-success__icon">✅</div>
                    <h1 className="order-success__title">Siparisin Onaylandi!</h1>
                    <div className="order-success__order-id">{order.id}</div>
                </div>

                {/* Ozet */}
                <SummaryPanel rows={summaryRows} emphasize className="mt-24" />

                {/* Sonraki Adimlar */}
                <SectionBlock title="Sonraki Adimlar" className="mt-24">
                    <div className="next-steps">
                        {NEXT_STEPS.map((step, i) => (
                            <div key={i} className="next-steps__item">
                                <span className="next-steps__icon">{step.icon}</span>
                                <span className="next-steps__text">{step.text}</span>
                            </div>
                        ))}
                    </div>
                </SectionBlock>

                {/* Actions */}
                <div className="mt-32 mb-32">
                    <PrimaryActionBar
                        stacked
                        primaryAction={{
                            label: 'Ana Sayfa',
                            onClick: () => navigate('screen-home'),
                        }}
                        secondaryAction={{
                            label: 'Siparislerim',
                            onClick: () => navigate('screen-kayitlar'),
                        }}
                    />
                </div>
            </div>
        </div>
    );
}

function formatSlotLabel(slot) {
    if (!slot) return '';
    const d = new Date(slot.day);
    const dayNames = ['Paz', 'Pzt', 'Sal', 'Car', 'Per', 'Cum', 'Cmt'];
    const monthNames = ['Oca', 'Sub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Agu', 'Eyl', 'Eki', 'Kas', 'Ara'];
    const rangeLabels = { morning: 'Sabah', afternoon: 'Ogle', evening: 'Aksam', flexible: 'Tum gun' };
    const dayStr = `${dayNames[d.getDay()]}, ${d.getDate()} ${monthNames[d.getMonth()]}`;
    const timeStr = slot.ranges.map(r => rangeLabels[r] || r).join(', ');
    return `${dayStr} · ${timeStr}`;
}
