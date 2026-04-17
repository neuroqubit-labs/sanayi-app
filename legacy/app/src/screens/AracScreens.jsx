import { useState } from 'react';
import { useApp } from '../context/AppContext';
import SubHeader from '../components/SubHeader';
import { SectionBlock, SummaryPanel, PrimaryActionBar, StatusPill } from '../components/DecisionPrimitives';
import { ChevronRight } from '../components/Icons';
import { getNavParams, setNavParams } from '../hooks/useQuoteState';

const VEHICLE_DB = {
    v1: {
        plate: '34 ABC 42', model: 'BMW 3 Serisi', year: 2019, icon: '🚙',
        km: '87.400', fuel: 'Benzin', transmission: 'Otomatik', engine: '2.0L Turbo',
        color: 'Koyu Gri', lastService: '14 Mar 2026', regularShop: 'Mobilservis Gungoren',
        nextService: '~92.000 km', insuranceExpiry: 'Agu 2026',
        chronicNotes: ['Sogukta calistirmada vuruntu sesi', 'Arka sol kapida kucuk cizik'],
        history: [
            { icon: '🔧', label: 'Son Bakim: Periyodik', detail: 'Mar 2026', route: 'screen-kayitlar' },
            { icon: '⚠️', label: 'Son Hasar: Motor Sesi', detail: 'Acik', route: 'screen-hasar-takip' },
            { icon: '🧾', label: 'Son Fatura: ₺2.850', detail: 'Mar 2026', route: 'screen-kayitlar' },
        ],
    },
    v2: {
        plate: '06 XYZ 77', model: 'Toyota Corolla', year: 2021, icon: '🚗',
        km: '42.100', fuel: 'Dizel', transmission: 'Otomatik', engine: '1.6L',
        color: 'Beyaz', lastService: '20 Oca 2026', regularShop: 'Express Servis',
        nextService: '~47.000 km', insuranceExpiry: 'Kas 2026',
        chronicNotes: [],
        history: [
            { icon: '🔧', label: 'Son Bakim: Yag Degisimi', detail: 'Oca 2026', route: 'screen-kayitlar' },
        ],
    },
};

const FUEL_OPTIONS = ['Benzin', 'Dizel', 'LPG', 'Elektrik', 'Hibrit'];
const TRANSMISSION_OPTIONS = ['Otomatik', 'Manuel'];

/* ══════════════════════════════════════════════════════════
   CollapsibleSection — acilir/kapanir form bolumu
   ══════════════════════════════════════════════════════════ */
function CollapsibleSection({ title, subtitle, defaultOpen = false, children }) {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <div className="collapsible-section">
            <button className="collapsible-section__header" onClick={() => setOpen(!open)}>
                <div>
                    <div className="collapsible-section__title">{title}</div>
                    {subtitle && <div className="collapsible-section__subtitle">{subtitle}</div>}
                </div>
                <span className={`collapsible-section__arrow ${open ? 'collapsible-section__arrow--open' : ''}`}>›</span>
            </button>
            {open && <div className="collapsible-section__body">{children}</div>}
        </div>
    );
}

/* ══════════════════════════════════════════════════════════
   AracEkleScreen — tek sayfa, asagi uzayan form
   ══════════════════════════════════════════════════════════ */
export function AracEkleScreen() {
    const { goBack } = useApp();

    const [plate, setPlate] = useState('');
    const [brand, setBrand] = useState('');
    const [model, setModel] = useState('');
    const [year, setYear] = useState('');
    const [fuel, setFuel] = useState('Benzin');
    const [transmission, setTransmission] = useState('Otomatik');

    const [km, setKm] = useState('');
    const [lastService, setLastService] = useState('');
    const [chronicIssues, setChronicIssues] = useState('');
    const [replacedParts, setReplacedParts] = useState('');

    const [color, setColor] = useState('');
    const [engine, setEngine] = useState('');
    const [notes, setNotes] = useState('');

    const isValid = plate.trim() && brand.trim() && model.trim();

    const filledOptionalCount = [km, lastService, chronicIssues, replacedParts, color, engine, notes].filter(v => v.trim()).length;

    return (<>
        <SubHeader title="Yeni Arac Ekle" />
        <div className="screen-scroll screen-scroll--sub">
            <div className="p-16">
                {/* Zorunlu: Temel Bilgiler — her zaman acik */}
                <div className="arac-form-section">
                    <h3 className="arac-form-section__title">Temel Bilgiler</h3>
                    <p className="arac-form-section__hint">* ile isaretli alanlar zorunludur</p>

                    <div className="form-group">
                        <label className="form-label">Plaka *</label>
                        <input className="form-input" type="text" placeholder="Or: 34 XYZ 123" value={plate} onChange={e => setPlate(e.target.value)} />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Marka *</label>
                        <input className="form-input" type="text" placeholder="Or: BMW" value={brand} onChange={e => setBrand(e.target.value)} />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Model *</label>
                        <input className="form-input" type="text" placeholder="Or: 3 Serisi" value={model} onChange={e => setModel(e.target.value)} />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Yil</label>
                        <input className="form-input" type="text" placeholder="Or: 2019" value={year} onChange={e => setYear(e.target.value)} />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Yakit Tipi</label>
                        <div className="toggle-group">
                            {FUEL_OPTIONS.map(opt => (
                                <button key={opt} className={`toggle-btn ${fuel === opt ? 'active' : ''}`} onClick={() => setFuel(opt)}>{opt}</button>
                            ))}
                        </div>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Vites</label>
                        <div className="toggle-group">
                            {TRANSMISSION_OPTIONS.map(opt => (
                                <button key={opt} className={`toggle-btn ${transmission === opt ? 'active' : ''}`} onClick={() => setTransmission(opt)}>{opt}</button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Opsiyonel: Kullanim Bilgileri */}
                <CollapsibleSection title="Kullanim Bilgileri" subtitle="Kilometre, bakim gecmisi, kronik sorunlar">
                    <div className="form-group">
                        <label className="form-label">Guncel Kilometre</label>
                        <input className="form-input" type="text" placeholder="Or: 87500" value={km} onChange={e => setKm(e.target.value)} />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Son Bakim Tarihi</label>
                        <input className="form-input" type="text" placeholder="Or: Mart 2026" value={lastService} onChange={e => setLastService(e.target.value)} />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Bilinen Kronik Sorunlar</label>
                        <textarea className="form-textarea" placeholder="Or: Sogukta calistirmada ses yapiyor" value={chronicIssues} onChange={e => setChronicIssues(e.target.value)} rows={2} />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Degisen Buyuk Parcalar</label>
                        <textarea className="form-textarea" placeholder="Or: 2023'te turbo degistirildi" value={replacedParts} onChange={e => setReplacedParts(e.target.value)} rows={2} />
                    </div>
                </CollapsibleSection>

                {/* Opsiyonel: Teknik Detaylar */}
                <CollapsibleSection title="Teknik Detaylar" subtitle="Motor, renk, ek bilgiler">
                    <div className="form-group">
                        <label className="form-label">Motor</label>
                        <input className="form-input" type="text" placeholder="Or: 2.0L Turbo" value={engine} onChange={e => setEngine(e.target.value)} />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Renk</label>
                        <input className="form-input" type="text" placeholder="Or: Koyu Gri" value={color} onChange={e => setColor(e.target.value)} />
                    </div>
                </CollapsibleSection>

                {/* Opsiyonel: Fotograf & Belgeler */}
                <CollapsibleSection title="Fotograf & Belgeler" subtitle="Ruhsat, ekspertiz, arac fotograflari">
                    <div className="media-upload-grid">
                        <div className="media-upload-box"><span className="media-upload-icon">📷</span><span>Arac Fotografi</span></div>
                        <div className="media-upload-box"><span className="media-upload-icon">📄</span><span>Ruhsat</span></div>
                        <div className="media-upload-box"><span className="media-upload-icon">📋</span><span>Ekspertiz</span></div>
                        <div className="media-upload-box"><span className="media-upload-icon">📁</span><span>Diger Belge</span></div>
                    </div>
                </CollapsibleSection>

                {/* Opsiyonel: Kisisel Notlar */}
                <CollapsibleSection title="Kisisel Notlar" subtitle="Sadece sizin gorebileceginiz notlar">
                    <div className="form-group">
                        <textarea className="form-textarea" placeholder="Arka sol kapida kucuk cizik var..." value={notes} onChange={e => setNotes(e.target.value)} rows={3} />
                    </div>
                </CollapsibleSection>

                {/* Gizlilik notu */}
                <div className="arac-form-privacy">
                    🔒 Bilgileriniz izniniz olmadan paylasilmaz
                </div>

                {/* Kaydet */}
                <div className="mt-16 mb-32">
                    <PrimaryActionBar
                        stacked
                        primaryAction={{
                            label: 'Araci Kaydet',
                            onClick: goBack,
                            disabled: !isValid,
                        }}
                        secondaryAction={{
                            label: 'Vazgec',
                            onClick: goBack,
                        }}
                    />
                    {!isValid && (
                        <div className="arac-form-hint">Plaka, marka ve model zorunludur</div>
                    )}
                </div>
            </div>
        </div>
    </>);
}

/* ══════════════════════════════════════════════════════════
   AracYonetimScreen — arac profil detay
   ══════════════════════════════════════════════════════════ */
export function AracYonetimScreen() {
    const { navigate } = useApp();
    const params = getNavParams();
    const vehicleId = params.vehicleId || 'v1';
    const v = VEHICLE_DB[vehicleId] || VEHICLE_DB.v1;

    const techRows = [
        { label: 'Yakit', value: v.fuel },
        { label: 'Vites', value: v.transmission },
        { label: 'Motor', value: v.engine },
        { label: 'Renk', value: v.color },
    ];

    const serviceRows = [
        { label: 'Son Bakim', value: v.lastService },
        { label: 'Sonraki Bakim', value: v.nextService },
        { label: 'Duzenli Servis', value: v.regularShop },
        { label: 'Sigorta Bitis', value: v.insuranceExpiry },
    ];

    return (<>
        <SubHeader title="Arac Profili" />
        <div className="screen-scroll screen-scroll--sub">
            {/* Hero */}
            <div className="arac-hero">
                <div className="arac-hero__icon">{v.icon}</div>
                <div className="arac-hero__plate">{v.plate}</div>
                <div className="arac-hero__model">{v.model} · {v.year}</div>
                <div className="arac-hero__km">{v.km} km</div>
                <div className="arac-hero__badges">
                    <StatusPill label="Aktif" tone="success" />
                    {v.chronicNotes.length > 0 && (
                        <StatusPill label={`${v.chronicNotes.length} not`} tone="warning" />
                    )}
                </div>
            </div>

            {/* Teknik */}
            <SectionBlock title="Teknik Bilgiler" className="mt-16">
                <SummaryPanel rows={techRows} />
            </SectionBlock>

            {/* Bakim */}
            <SectionBlock title="Bakim & Sigorta" className="mt-16">
                <SummaryPanel rows={serviceRows} />
            </SectionBlock>

            {/* Kronik Notlar */}
            {v.chronicNotes.length > 0 && (
                <SectionBlock title="Kronik Notlar" className="mt-16">
                    <div className="arac-notes">
                        {v.chronicNotes.map((note, i) => (
                            <div key={i} className="arac-note">
                                <span className="arac-note__dot">●</span>
                                <span className="arac-note__text">{note}</span>
                            </div>
                        ))}
                    </div>
                </SectionBlock>
            )}

            {/* Gecmis */}
            <SectionBlock title="Arac Gecmisi" className="mt-16">
                {v.history.map((item, i) => (
                    <button key={i} className="settings-item" onClick={() => navigate(item.route)}>
                        <span className="settings-item__icon">{item.icon}</span>
                        <div className="settings-item__body">
                            <span className="settings-item__label">{item.label}</span>
                            <span className="settings-item__desc">{item.detail}</span>
                        </div>
                        <ChevronRight />
                    </button>
                ))}
            </SectionBlock>

            <div className="bottom-spacer" />
        </div>
    </>);
}

/* ══════════════════════════════════════════════════════════
   AracListScreen — kayitli araclar listesi
   ══════════════════════════════════════════════════════════ */
export function AracListScreen() {
    const { navigate } = useApp();
    return (<>
        <SubHeader title="Kayitli Araclar" />
        <div className="screen-scroll screen-scroll--sub">
            <button className="vehicle-list-card" onClick={() => {
                setNavParams({ vehicleId: 'v1' });
                navigate('screen-arac-yonetim');
            }}>
                <div className="vehicle-list-avatar">🚙</div>
                <div className="vehicle-list-body">
                    <div className="vehicle-list-plate">34 ABC 42</div>
                    <div className="vehicle-list-model">BMW 3 Serisi · 2019</div>
                    <div className="vehicle-list-meta">
                        <StatusPill label="Aktif" tone="success" />
                        <span style={{ fontSize: '11px', color: 'var(--text-3)' }}>87.400 km</span>
                    </div>
                </div>
                <ChevronRight />
            </button>
            <button className="vehicle-list-card" onClick={() => {
                setNavParams({ vehicleId: 'v2' });
                navigate('screen-arac-yonetim');
            }}>
                <div className="vehicle-list-avatar">🚗</div>
                <div className="vehicle-list-body">
                    <div className="vehicle-list-plate">06 XYZ 77</div>
                    <div className="vehicle-list-model">Toyota Corolla · 2021</div>
                    <div className="vehicle-list-meta">
                        <span style={{ fontSize: '11px', color: 'var(--text-3)' }}>42.100 km</span>
                    </div>
                </div>
                <ChevronRight />
            </button>
            <button className="profil-add-vehicle" onClick={() => navigate('screen-arac-ekle')} style={{ marginTop: 12 }}>
                <span className="profil-add-vehicle__icon">+</span>
                <span className="profil-add-vehicle__label">Yeni Arac Ekle</span>
            </button>
            <div className="bottom-spacer" />
        </div>
    </>);
}
