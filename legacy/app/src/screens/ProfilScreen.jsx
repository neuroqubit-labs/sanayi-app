import { useApp } from '../context/AppContext';
import { StatusPill } from '../components/DecisionPrimitives';
import { ChevronRight } from '../components/Icons';
import { getOrders } from '../hooks/useCheckoutState';
import { setNavParams } from '../hooks/useQuoteState';

const USER_VEHICLES = [
    {
        id: 'v1',
        plate: '34 ABC 42',
        model: 'BMW 3 Serisi',
        year: 2019,
        icon: '🚙',
        km: '87.400',
        fuel: 'Benzin',
        active: true,
        openIssues: 1,
        lastService: 'Mar 2026',
    },
    {
        id: 'v2',
        plate: '06 XYZ 77',
        model: 'Toyota Corolla',
        year: 2021,
        icon: '🚗',
        km: '42.100',
        fuel: 'Dizel',
        active: false,
        openIssues: 0,
        lastService: 'Oca 2026',
    },
];

function SettingsItem({ icon, label, desc, onClick, trailing }) {
    return (
        <button className="settings-item" onClick={onClick}>
            <span className="settings-item__icon">{icon}</span>
            <div className="settings-item__body">
                <span className="settings-item__label">{label}</span>
                {desc && <span className="settings-item__desc">{desc}</span>}
            </div>
            {trailing || <ChevronRight />}
        </button>
    );
}

function StatBlock({ value, label }) {
    return (
        <div className="profil-stat">
            <div className="profil-stat__value">{value}</div>
            <div className="profil-stat__label">{label}</div>
        </div>
    );
}

function VehicleCard({ v, onTap }) {
    return (
        <button className="vehicle-list-card" onClick={() => onTap(v)}>
            <div className="vehicle-list-avatar">{v.icon}</div>
            <div className="vehicle-list-body">
                <div className="vehicle-list-plate">{v.plate}</div>
                <div className="vehicle-list-model">{v.model} · {v.year}</div>
                <div className="vehicle-list-meta">
                    {v.active && <StatusPill label="Aktif" tone="success" />}
                    {v.openIssues > 0 && <span className="record-badge badge-orange" style={{ fontSize: '10px' }}>{v.openIssues} acik hasar</span>}
                    <span style={{ fontSize: '11px', color: 'var(--text-3)' }}>{v.km} km</span>
                </div>
            </div>
            <ChevronRight />
        </button>
    );
}

export default function ProfilScreen() {
    const { navigate } = useApp();
    const orders = getOrders();

    const memberSince = 'Ocak 2025';
    const totalServices = 4 + orders.length;

    const handleVehicleTap = (v) => {
        setNavParams({ vehicleId: v.id, vehiclePlate: v.plate, vehicleModel: `${v.model} · ${v.year}` });
        navigate('screen-arac-yonetim');
    };

    return (
        <div className="screen-scroll">
            {/* User Hero */}
            <div className="profil-hero">
                <div className="profil-hero__top">
                    <div className="profil-hero__avatar">AF</div>
                    <div className="profil-hero__info">
                        <div className="profil-hero__name">Alfonso Rivera</div>
                        <div className="profil-hero__phone">+90 532 000 00 00</div>
                        <StatusPill label="Premium Uye" tone="info" />
                    </div>
                </div>
                <div className="profil-hero__stats">
                    <StatBlock value={totalServices} label="Toplam Islem" />
                    <StatBlock value={USER_VEHICLES.length} label="Arac" />
                    <StatBlock value={memberSince} label="Uye" />
                </div>
            </div>

            {/* Araclarim — dogrudan kart listesi */}
            <div className="settings-group">
                <div className="settings-group__title">Araclarim</div>
                {USER_VEHICLES.map(v => (
                    <VehicleCard key={v.id} v={v} onTap={handleVehicleTap} />
                ))}
                <button className="profil-add-vehicle" onClick={() => navigate('screen-arac-ekle')}>
                    <span className="profil-add-vehicle__icon">+</span>
                    <span className="profil-add-vehicle__label">Yeni Arac Ekle</span>
                </button>
            </div>

            {/* Hesap & Odeme */}
            <div className="settings-group">
                <div className="settings-group__title">Hesap & Odeme</div>
                <SettingsItem icon="👤" label="Kisisel Bilgiler" desc="Ad, telefon, e-posta" />
                <SettingsItem icon="💳" label="Odeme Yontemleri" desc="Kart ve havale bilgileri" />
                <SettingsItem icon="🧾" label="Faturalarim" desc="Gecmis fatura ve makbuzlar" onClick={() => navigate('screen-kayitlar')} />
            </div>

            {/* Tercihler */}
            <div className="settings-group">
                <div className="settings-group__title">Tercihler</div>
                <SettingsItem icon="🔔" label="Bildirim Tercihleri" desc="Push, SMS, e-posta" />
                <SettingsItem icon="📍" label="Konum Ayarlari" desc="Yakin servis aramasi icin" />
                <SettingsItem icon="🌙" label="Gorunum" desc="Koyu tema" trailing={<span className="settings-item__badge">Aktif</span>} />
            </div>

            {/* Destek */}
            <div className="settings-group">
                <div className="settings-group__title">Destek & Hakkinda</div>
                <SettingsItem icon="💬" label="Yardim Merkezi" desc="SSS ve canli destek" onClick={() => navigate('screen-destek')} />
                <SettingsItem icon="⭐" label="Uygulamayi Degerlendir" desc="App Store / Play Store" />
                <SettingsItem icon="📄" label="Kullanim Kosullari" />
                <SettingsItem icon="🔒" label="Gizlilik Politikasi" />
            </div>

            {/* Version */}
            <div className="profil-version">
                Sanayi App v1.0.0
            </div>

            <div className="bottom-spacer" />
        </div>
    );
}
