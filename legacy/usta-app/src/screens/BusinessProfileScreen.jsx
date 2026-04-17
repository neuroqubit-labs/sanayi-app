import { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { StatusPill, SectionBlock, SummaryPanel } from '@shared/components/DecisionPrimitives';
import { ChevronRight } from '@shared/components/Icons';
import { USTA_PROFILE, REVENUE_RECORDS } from '../data/ustaData';

const LEVEL_LABELS = { expert: 'Uzman', proficient: 'İyi', beginner: 'Başlangıç' };
const LEVEL_TONES = { expert: 'success', proficient: 'info', beginner: 'neutral' };

const AVAILABILITY_OPTIONS = [
    { key: 'open', label: 'Açık', dot: 'open' },
    { key: 'busy', label: 'Yoğun', dot: 'busy' },
    { key: 'closed', label: 'Kapalı', dot: 'closed' },
];

/* ── Sub-bileşenler ──────────────────────────────────── */

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

function SpecialtyTag({ specialty }) {
    return (
        <div className="profil-specialty">
            <span className="profil-specialty__label">{specialty.label}</span>
            <StatusPill
                label={LEVEL_LABELS[specialty.level] || specialty.level}
                tone={LEVEL_TONES[specialty.level] || 'neutral'}
            />
        </div>
    );
}

function PerformanceMetric({ label, value, hint }) {
    return (
        <div className="profil-metric">
            <div className="profil-metric__value">{value}</div>
            <div className="profil-metric__label">{label}</div>
            {hint && <div className="profil-metric__hint">{hint}</div>}
        </div>
    );
}

function SectionHead({ title, onEdit, editLabel = 'Düzenle' }) {
    return (
        <div className="profil-section-head">
            <div className="profil-section-head__title">{title}</div>
            {onEdit && (
                <button className="profil-section-head__edit" onClick={onEdit}>
                    ✎ {editLabel}
                </button>
            )}
        </div>
    );
}

function AvailabilityToggle({ value, onChange }) {
    return (
        <div className="availability-toggle" role="tablist" aria-label="Müsaitlik durumu">
            {AVAILABILITY_OPTIONS.map(opt => (
                <button
                    key={opt.key}
                    role="tab"
                    aria-selected={value === opt.key}
                    className={`availability-toggle__btn ${value === opt.key ? 'availability-toggle__btn--active' : ''}`}
                    onClick={() => onChange(opt.key)}
                >
                    <span className={`availability-toggle__dot availability-toggle__dot--${opt.dot}`} />
                    {opt.label}
                </button>
            ))}
        </div>
    );
}

function CompletionBar({ percent, missing }) {
    return (
        <div className="profil-completion">
            <div className="profil-completion__top">
                <span className="profil-completion__label">Profil tamamlanma</span>
                <span className="profil-completion__value">%{percent}</span>
            </div>
            <div className="profil-completion__bar">
                <div className="profil-completion__bar-fill" style={{ width: `${percent}%` }} />
            </div>
            {missing.length > 0 && (
                <div className="profil-completion__hints">
                    {missing.map(m => (
                        <span key={m} className="profil-completion__hint">{m}</span>
                    ))}
                </div>
            )}
        </div>
    );
}

function GalleryItem({ item }) {
    return (
        <div className={`usta-gallery-item ${item.featured ? 'usta-gallery-item--featured' : ''}`}>
            <div className="usta-gallery-item__cover">{item.icon || '📸'}</div>
            {item.caption && <div className="usta-gallery-item__caption">{item.caption}</div>}
        </div>
    );
}

/* ── Müşteri önizlemesi overlay (vitrin görünümü) ─── */
function CustomerPreviewOverlay({ profile, onClose }) {
    const s = profile.stats;
    return (
        <div className="preview-overlay" onClick={onClose} role="dialog" aria-modal="true">
            <div className="preview-overlay__panel" onClick={e => e.stopPropagation()}>
                <div className="preview-overlay__head">
                    <div>
                        <div className="preview-overlay__eyebrow">Vitrin önizlemesi</div>
                        <div className="preview-overlay__title">Müşteri seni böyle görüyor</div>
                    </div>
                    <button className="preview-overlay__close" onClick={onClose} aria-label="Kapat">×</button>
                </div>

                <div className="profil-hero">
                    <div className="profil-hero__top">
                        <div className="profil-hero__avatar">{profile.initials}</div>
                        <div className="profil-hero__identity">
                            <div className="profil-hero__name">{profile.name}</div>
                            <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                                {profile.verified && <StatusPill label="Doğrulanmış" tone="success" />}
                                <StatusPill label={profile.type === 'servis' ? 'Servis' : 'Bireysel'} tone="info" />
                            </div>
                            <div className="profil-hero__location">
                                📍 {profile.location.district}, {profile.location.city}
                            </div>
                        </div>
                    </div>
                    {profile.tagline && (
                        <div className="profil-hero__tagline">
                            <span>“</span>
                            <div className="profil-hero__tagline-text">{profile.tagline}</div>
                        </div>
                    )}
                    <div className="profil-hero__stats">
                        <StatBlock value={`⭐ ${s.rating}`} label={`${s.reviewCount} yorum`} />
                        <StatBlock value={s.completedJobs} label="İş" />
                        <StatBlock value={`${s.responseTimeMinutes}dk`} label="Yanıt" />
                    </div>
                </div>

                <SectionBlock title="Uzmanlık">
                    <div className="profil-specialties">
                        {profile.specialties.slice(0, 5).map(sp => (
                            <SpecialtyTag key={sp.key} specialty={sp} />
                        ))}
                    </div>
                </SectionBlock>

                <SectionBlock title="Marka Uzmanlığı" className="mt-0">
                    <div className="tag-cloud" style={{ padding: '0 16px 12px' }}>
                        {profile.brands.map(b => <span key={b} className="tag">{b}</span>)}
                    </div>
                </SectionBlock>

                <div className="bottom-spacer" />
            </div>
        </div>
    );
}

/* ── Tamamlanma skoru hesabı ──────────────────────── */
function useCompletionScore(p) {
    return useMemo(() => {
        const checks = [
            { ok: !!p.tagline, hint: 'Tagline ekle' },
            { ok: p.specialties.length >= 3, hint: 'Uzmanlık ekle' },
            { ok: p.brands.length >= 2, hint: 'Marka ekle' },
            { ok: p.certifications.length >= 1, hint: 'Sertifika yükle' },
            { ok: p.gallery.length >= 4, hint: 'Galeri zayıf' },
            { ok: !!p.contact.whatsapp, hint: 'WhatsApp ekle' },
            { ok: !!p.location.address, hint: 'Adres ekle' },
            { ok: p.verified, hint: 'Doğrulama tamamla' },
        ];
        const okCount = checks.filter(c => c.ok).length;
        const percent = Math.round((okCount / checks.length) * 100);
        const missing = checks.filter(c => !c.ok).map(c => c.hint);
        return { percent, missing };
    }, [p]);
}

/* ── Ana Ekran ─────────────────────────────────────── */
export default function BusinessProfileScreen() {
    const { navigate, availability, setAvailability } = useApp();
    const p = USTA_PROFILE;
    const s = p.stats;

    const [preview, setPreview] = useState(false);
    const { percent, missing } = useCompletionScore(p);

    const totalRevenue = REVENUE_RECORDS.reduce((sum, r) => sum + r.net, 0);
    const memberYear = new Date(s.memberSince).getFullYear();

    const hoursRows = [
        { label: 'Hafta İçi', value: p.workingHours.weekdays },
        { label: 'Cumartesi', value: p.workingHours.saturday },
        { label: 'Pazar', value: p.workingHours.sunday },
    ];

    const capacityRows = [
        { label: 'Eş Zamanlı İş', value: `${p.capacity.currentActiveJobs} / ${p.capacity.maxConcurrentJobs}` },
        { label: 'Lift Sayısı', value: p.capacity.liftsCount },
        { label: 'Ekip', value: `${p.capacity.teamSize} kişi` },
    ];

    return (
        <div className="screen-scroll">
            {/* ── Hero: kimlik + konum + tagline ── */}
            <div className="profil-hero">
                <div className="profil-hero__top">
                    <div className="profil-hero__avatar">{p.initials}</div>
                    <div className="profil-hero__identity">
                        <div className="profil-hero__name">{p.name}</div>
                        <div className="profil-hero__owner">{p.ownerName}</div>
                        <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                            {p.verified && <StatusPill label="Doğrulanmış" tone="success" />}
                            <StatusPill label={p.type === 'servis' ? 'Servis' : 'Bireysel'} tone="info" />
                        </div>
                        <div className="profil-hero__location">
                            📍 {p.location.district}, {p.location.city}
                        </div>
                    </div>
                </div>

                {p.tagline ? (
                    <div className="profil-hero__tagline">
                        <span>“</span>
                        <div className="profil-hero__tagline-text">{p.tagline}</div>
                        <button className="profil-hero__tagline-edit">Düzenle</button>
                    </div>
                ) : (
                    <div className="profil-hero__tagline profil-hero__tagline--empty">
                        <div className="profil-hero__tagline-text">
                            Kendini tek cümleyle anlat. Müşteri seni böyle hatırlar.
                        </div>
                        <button className="profil-hero__tagline-edit">+ Ekle</button>
                    </div>
                )}

                <div className="profil-hero__stats">
                    <StatBlock value={`⭐ ${s.rating}`} label={`${s.reviewCount} yorum`} />
                    <StatBlock value={s.completedJobs} label="Tamamlanan İş" />
                    <StatBlock value={memberYear} label="Üyelik" />
                </div>
            </div>

            {/* ── Müsaitlik durumu ── */}
            <div style={{ marginTop: 16 }}>
                <AvailabilityToggle value={availability} onChange={setAvailability} />
            </div>

            {/* ── Profil tamamlanma + eksik alan rozetleri ── */}
            <CompletionBar percent={percent} missing={missing} />

            {/* ── Müşteri önizleme aksiyon barı ── */}
            <div className="profil-preview-bar">
                <div className="profil-preview-bar__text">
                    <strong>Vitrin önizlemesi</strong>
                    Müşteri listesinde nasıl göründüğünü kontrol et.
                </div>
                <button className="profil-preview-bar__btn" onClick={() => setPreview(true)}>
                    Önizle
                </button>
            </div>

            {/* ══════ VİTRİN ══════ */}
            <div style={{ marginTop: 24 }}>
                <div className="profil-section-head">
                    <div className="profil-section-head__title">Vitrin</div>
                </div>
            </div>

            {/* Performans */}
            <SectionBlock title="Performans">
                <div className="profil-metrics-grid">
                    <PerformanceMetric label="Yanıt Süresi" value={`${s.responseTimeMinutes} dk`} hint="Ortalama" />
                    <PerformanceMetric label="Tamamlama" value={`%${Math.round(s.completionRate * 100)}`} hint="Oran" />
                    <PerformanceMetric label="Tekrar Müşteri" value={`%${Math.round(s.repeatCustomerRate * 100)}`} />
                    <PerformanceMetric label="Ort. Süre" value={`${s.avgJobDurationDays} gün`} hint="İş başına" />
                </div>
            </SectionBlock>

            {/* Uzmanlık */}
            <SectionHead title="Uzmanlık Alanları" onEdit={() => {}} editLabel="Düzenle" />
            <div className="profil-specialties">
                {p.specialties.map(sp => <SpecialtyTag key={sp.key} specialty={sp} />)}
            </div>
            {p.specialties.length < 3 && (
                <div className="profil-empty-note">En az 3 uzmanlık eklediğinde eşleşme skorun yükselir.</div>
            )}

            {/* Markalar */}
            <SectionHead title="Marka Uzmanlığı" onEdit={() => {}} />
            <div className="tag-cloud" style={{ padding: '0 16px 12px' }}>
                {p.brands.map(b => <span key={b} className="tag">{b}</span>)}
                <span className="tag" style={{ opacity: 0.6, borderStyle: 'dashed', cursor: 'pointer' }}>+ Ekle</span>
            </div>

            {/* Sertifikalar */}
            <SectionHead title="Sertifikalar & Belgeler" onEdit={() => {}} editLabel="Yeni Yükle" />
            <div className="settings-group" style={{ marginTop: 0 }}>
                {p.certifications.map((cert, i) => (
                    <div key={i} className="settings-item" style={{ cursor: 'default' }}>
                        <span className="settings-item__icon">{cert.verified ? '✅' : '📜'}</span>
                        <div className="settings-item__body">
                            <span className="settings-item__label">{cert.name}</span>
                            <span className="settings-item__desc">{cert.issuer} · {cert.year}</span>
                        </div>
                        {cert.verified && <span className="settings-item__badge">Doğrulandı</span>}
                    </div>
                ))}
            </div>

            {/* Galeri */}
            <SectionHead title="İş Galerisi" onEdit={() => {}} editLabel="Yönet" />
            <div className="usta-gallery-grid">
                {p.gallery.map(item => <GalleryItem key={item.id} item={item} />)}
                <div className="usta-gallery-item usta-gallery-item--add">+</div>
            </div>
            {p.gallery.length < 4 && (
                <div className="profil-empty-note">
                    En az 4 iş görseli yükleyen servislerin teklif kabul oranı %30 daha yüksek.
                </div>
            )}

            {/* ══════ İŞLETME YÖNETİMİ ══════ */}
            <div style={{ marginTop: 24 }}>
                <div className="profil-section-head">
                    <div className="profil-section-head__title">İşletme Yönetimi</div>
                </div>
            </div>

            {/* Çalışma Saatleri */}
            <SectionHead title="Çalışma Saatleri" onEdit={() => {}} />
            <div style={{ padding: '0 16px 12px' }}>
                <SummaryPanel rows={hoursRows} />
            </div>

            {/* Kapasite */}
            <SectionHead title="Kapasite" onEdit={() => {}} />
            <div style={{ padding: '0 16px 12px' }}>
                <SummaryPanel rows={capacityRows} />
            </div>

            {/* Gelir & Fatura */}
            <div className="settings-group">
                <div className="settings-group__title">İş & Gelir</div>
                <SettingsItem
                    icon="💰"
                    label="Gelir Özeti"
                    desc={`Toplam: ₺${totalRevenue.toLocaleString('tr-TR')}`}
                    onClick={() => navigate('screen-revenue')}
                />
                <SettingsItem icon="🧾" label="Faturalarım" desc="Kesilen faturalar ve makbuzlar" />
            </div>

            {/* İşletme Bilgileri */}
            <div className="settings-group">
                <div className="settings-group__title">İşletme Bilgileri</div>
                <SettingsItem icon="🏢" label="İşletme Unvanı" desc={p.taxInfo.unvan} />
                <SettingsItem icon="📍" label="Adres" desc={p.location.address} />
                <SettingsItem icon="🏦" label="Banka Bilgileri" desc={p.bankInfo.bankName} />
                <SettingsItem icon="📧" label="E-posta" desc={p.contact.email} />
                <SettingsItem icon="📞" label="Telefon" desc={p.contact.phone} />
                <SettingsItem
                    icon="📍"
                    label="Hizmet Alanı"
                    desc={`${p.location.radiusKm} km yarıçap · ${p.location.district}`}
                />
            </div>

            {/* ══════ AYARLAR & DESTEK ══════ */}
            <div className="settings-group">
                <div className="settings-group__title">Ayarlar</div>
                <SettingsItem icon="🔔" label="Bildirim Tercihleri" desc="Push, SMS, e-posta" />
                <SettingsItem
                    icon="🌙"
                    label="Görünüm"
                    desc="Koyu tema"
                    trailing={<span className="settings-item__badge">Aktif</span>}
                />
            </div>

            <div className="settings-group">
                <div className="settings-group__title">Destek</div>
                <SettingsItem icon="💬" label="Yardım Merkezi" desc="SSS ve canlı destek" />
                <SettingsItem icon="📄" label="Kullanım Koşulları" />
                <SettingsItem icon="🔒" label="Gizlilik Politikası" />
            </div>

            <div className="profil-version">Usta Panel v1.0.0</div>
            <div className="bottom-spacer" />

            {preview && <CustomerPreviewOverlay profile={p} onClose={() => setPreview(false)} />}
        </div>
    );
}
