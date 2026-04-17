import { FlowStepShell, SectionBlock, SummaryPanel } from '../components/DecisionPrimitives';
import { SlotPicker } from '../components/SlotPicker';
import SubHeader from '../components/SubHeader';
import { useApp } from '../context/AppContext';
import { findPackageById, PAYMENT_METHODS } from '../data/purchaseData';
import { useCheckoutState } from '../hooks/useCheckoutState';
import { getNavParams, setNavParams } from '../hooks/useQuoteState';

export default function CheckoutScreen() {
    const { navigate, goBack, vehicle, setVehicleSwitcherOpen } = useApp();
    const params = getNavParams();
    const pkg = findPackageById(params.packageId);

    const {
        selectedSlots, setSelectedSlots,
        paymentMethod, setPaymentMethod,
        termsAccepted, setTermsAccepted,
        isComplete, confirmOrder,
    } = useCheckoutState();

    if (!pkg) {
        return (
            <div className="screen-scroll screen-scroll--sub">
                <SubHeader title="Satin Al" />
                <div className="p-16">
                    <div className="empty-state">
                        <div className="empty-state__icon">📦</div>
                        <div className="empty-state__text">Paket bulunamadi</div>
                    </div>
                </div>
            </div>
        );
    }

    // Progress calculation
    const hasSlot = selectedSlots.length > 0 && selectedSlots[0]?.ranges?.length > 0;
    const progress = hasSlot && paymentMethod && termsAccepted ? 100
        : hasSlot && paymentMethod ? 75
        : hasSlot ? 50
        : 25;

    const handleConfirm = () => {
        const order = confirmOrder(pkg, vehicle);
        setNavParams({ orderId: order.id });
        navigate('screen-siparis-onay');
    };

    // Format slot for summary
    const slotLabel = hasSlot ? formatSlotLabel(selectedSlots[0]) : 'Secilmedi';
    const paymentLabel = paymentMethod
        ? PAYMENT_METHODS.find(m => m.id === paymentMethod)?.label || paymentMethod
        : 'Secilmedi';

    const summaryRows = [
        { label: 'Paket', value: pkg.title },
        { label: 'Arac', value: `${vehicle.plate}` },
        { label: 'Servis', value: pkg.provider.name },
        { label: 'Tutar', value: `₺${pkg.price.toLocaleString('tr-TR')}` },
    ];

    return (
        <div className="screen-scroll screen-scroll--sub">
            <SubHeader title="Satin Al" />
            <div className="p-16">
                <FlowStepShell
                    progress={progress}
                    title="Siparis Onayi"
                    helper="Bilgileri kontrol et ve satin almayi onayla"
                    primaryAction={{
                        label: `Onayla ve Satin Al — ₺${pkg.price.toLocaleString('tr-TR')}`,
                        onClick: handleConfirm,
                        disabled: !isComplete,
                    }}
                    secondaryAction={{
                        label: 'Geri Don',
                        onClick: goBack,
                    }}
                >
                    {/* Arac Bilgisi */}
                    <SectionBlock title="Arac" className="mb-16">
                        <div className="checkout-vehicle">
                            <div className="checkout-vehicle__info">
                                <span className="checkout-vehicle__plate">{vehicle.plate}</span>
                                <span className="checkout-vehicle__model">{vehicle.model}</span>
                            </div>
                            <button className="checkout-vehicle__change" onClick={() => setVehicleSwitcherOpen(true)}>
                                Degistir
                            </button>
                        </div>
                    </SectionBlock>

                    {/* Randevu Zamani */}
                    <SectionBlock title="Randevu Zamani" className="mb-16">
                        <SlotPicker
                            selectedSlots={selectedSlots}
                            onSlotsChange={setSelectedSlots}
                            maxSlots={1}
                        />
                    </SectionBlock>

                    {/* Odeme Yontemi */}
                    <SectionBlock title="Odeme Yontemi" className="mb-16">
                        <div className="payment-methods">
                            {PAYMENT_METHODS.map(method => (
                                <button
                                    key={method.id}
                                    className={`payment-method ${paymentMethod === method.id ? 'payment-method--selected' : ''}`}
                                    onClick={() => setPaymentMethod(method.id)}
                                >
                                    <span className="payment-method__icon">{method.icon}</span>
                                    <div className="payment-method__body">
                                        <span className="payment-method__label">{method.label}</span>
                                        <span className="payment-method__desc">{method.description}</span>
                                    </div>
                                    <span className="payment-method__radio">
                                        {paymentMethod === method.id ? '●' : '○'}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </SectionBlock>

                    {/* Siparis Ozeti */}
                    <SummaryPanel rows={summaryRows} emphasize className="mb-16" />

                    {/* Kosullar */}
                    <div className="commitment-section">
                        <label className="commitment-checkbox">
                            <input
                                type="checkbox"
                                checked={termsAccepted}
                                onChange={e => setTermsAccepted(e.target.checked)}
                            />
                            <span className="commitment-checkbox__label">
                                Siparis kosullarini okudum ve kabul ediyorum
                            </span>
                        </label>
                    </div>

                    {!isComplete && (
                        <div className="commitment-hint">
                            {!hasSlot ? 'Randevu zamani secin' : !paymentMethod ? 'Odeme yontemi secin' : 'Kosullari kabul edin'}
                        </div>
                    )}
                </FlowStepShell>
            </div>
        </div>
    );
}

// ── Helpers ──

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
