import SubHeader from '../components/SubHeader';
import { StatusPill, SectionBlock } from '@shared/components/DecisionPrimitives';
import { useRevenueState } from '../hooks/useRevenueState';

function StatCard({ label, value, accent }) {
    return (
        <div className="usta-revenue-stat">
            <div className="usta-revenue-stat__label">{label}</div>
            <div className="usta-revenue-stat__value" style={accent ? { color: accent } : {}}>{value}</div>
        </div>
    );
}

function RevenueRecordCard({ record }) {
    const statusLabels = { received: 'Tahsil Edildi', partial: 'Kısmi Tahsilat', pending: 'Bekliyor', overdue: 'Gecikmiş' };
    const statusTones = { received: 'success', partial: 'warning', pending: 'neutral', overdue: 'warning' };

    return (
        <div className="usta-revenue-record">
            <div className="usta-revenue-record__body">
                <div className="usta-revenue-record__title">{record.jobTitle}</div>
                <div className="usta-revenue-record__meta">
                    {record.customerName} · {record.vehiclePlate} · {record.invoiceId}
                </div>
                <div className="usta-revenue-record__amounts">
                    <span>Brüt: ₺{record.gross.toLocaleString('tr-TR')}</span>
                    <span>Komisyon: ₺{record.commission.toLocaleString('tr-TR')}</span>
                    <span className="usta-revenue-record__net">Net: ₺{record.net.toLocaleString('tr-TR')}</span>
                </div>
            </div>
            <div className="usta-revenue-record__right">
                <StatusPill label={statusLabels[record.paymentStatus] || record.paymentStatus} tone={statusTones[record.paymentStatus] || 'neutral'} />
                {record.paymentStatus !== 'received' && (
                    <div className="usta-revenue-record__pending">
                        ₺{(record.gross - record.receivedAmount).toLocaleString('tr-TR')} kalan
                    </div>
                )}
            </div>
        </div>
    );
}

function TabBar({ tabs, activeTab, onTabChange }) {
    return (
        <div className="kayitlar-tabs">
            {tabs.map(tab => (
                <button
                    key={tab.id}
                    className={`kayitlar-tab ${activeTab === tab.id ? 'kayitlar-tab--active' : ''}`}
                    onClick={() => onTabChange(tab.id)}
                >
                    {tab.label}
                </button>
            ))}
        </div>
    );
}

export default function RevenueScreen() {
    const vm = useRevenueState();

    return (<>
        <SubHeader title="Gelir Özeti" />
        <div className="screen-scroll screen-scroll--sub">
            {/* Summary Stats */}
            <div className="usta-revenue-summary">
                <StatCard label="Brüt Gelir" value={`₺${vm.totalGross.toLocaleString('tr-TR')}`} />
                <StatCard label="Komisyon" value={`₺${vm.totalCommission.toLocaleString('tr-TR')}`} accent="var(--red)" />
                <StatCard label="Net Gelir" value={`₺${vm.totalNet.toLocaleString('tr-TR')}`} accent="var(--green)" />
                <StatCard label="Bekleyen" value={`₺${vm.pendingAmount.toLocaleString('tr-TR')}`} accent="var(--orange)" />
            </div>

            {/* Period Filter */}
            <TabBar tabs={vm.periodTabs} activeTab={vm.periodTab} onTabChange={vm.setPeriodTab} />

            {/* Pending */}
            {vm.pendingRecords.length > 0 && (
                <SectionBlock title="Bekleyen Tahsilatlar" className="mt-16">
                    {vm.pendingRecords.map(r => (
                        <RevenueRecordCard key={r.id} record={r} />
                    ))}
                </SectionBlock>
            )}

            {/* Received */}
            <SectionBlock title="Tamamlanan Ödemeler" className="mt-16">
                {vm.receivedRecords.length > 0 ? (
                    vm.receivedRecords.map(r => (
                        <RevenueRecordCard key={r.id} record={r} />
                    ))
                ) : (
                    <div className="usta-empty" style={{ padding: '24px 0' }}>
                        <div className="usta-empty__text">Bu dönemde tamamlanan ödeme yok</div>
                    </div>
                )}
            </SectionBlock>

            {/* Job count */}
            <div className="usta-revenue-footer">
                Toplam {vm.jobCount} iş · {vm.records.length} kayıt
            </div>

            <div className="bottom-spacer" />
        </div>
    </>);
}
