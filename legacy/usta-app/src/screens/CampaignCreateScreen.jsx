import { useState } from 'react';
import { useApp } from '../context/AppContext';
import SubHeader from '../components/SubHeader';
import { SectionBlock, PrimaryActionBar } from '@shared/components/DecisionPrimitives';

const CATEGORIES = [
    { id: 'bakim', label: 'Bakım' },
    { id: 'mekanik', label: 'Mekanik' },
    { id: 'kaza', label: 'Kaza / Hasar' },
    { id: 'lastik', label: 'Lastik' },
    { id: 'elektrik', label: 'Elektrik' },
    { id: 'genel', label: 'Tüm Hizmetler' },
];

const ICON_PRESETS = ['🔧', '🛞', '🔋', '❄️', '🛢️', '⚙️', '🚗', '🔩', '🛠️', '💧', '🌬️', '🏁'];

const TAG_PRESETS = [
    { id: 'Kampanya', label: 'Kampanya' },
    { id: 'Populer', label: 'Popüler' },
    { id: 'Yeni', label: 'Yeni' },
    { id: 'Sınırlı Süre', label: 'Sınırlı Süre' },
];

const DEFAULT_ITEM_ICON = '🛠️';

export default function CampaignCreateScreen() {
    const { goBack, addCampaign } = useApp();

    const [icon, setIcon] = useState('🔧');
    const [title, setTitle] = useState('');
    const [category, setCategory] = useState('bakim');
    const [description, setDescription] = useState('');
    const [longDescription, setLongDescription] = useState('');

    const [originalPrice, setOriginalPrice] = useState('');
    const [newPrice, setNewPrice] = useState('');

    const [includedItems, setIncludedItems] = useState([
        { label: '', icon: DEFAULT_ITEM_ICON },
    ]);

    const [estimatedDuration, setEstimatedDuration] = useState('');
    const [guarantee, setGuarantee] = useState('');

    const [tags, setTags] = useState(['Kampanya']);

    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    const updateItem = (idx, field, value) => {
        setIncludedItems(prev => prev.map((it, i) =>
            i === idx ? { ...it, [field]: value } : it
        ));
    };

    const addItem = () => {
        setIncludedItems(prev => [...prev, { label: '', icon: DEFAULT_ITEM_ICON }]);
    };

    const removeItem = (idx) => {
        if (includedItems.length <= 1) return;
        setIncludedItems(prev => prev.filter((_, i) => i !== idx));
    };

    const toggleTag = (tagId) => {
        setTags(prev => prev.includes(tagId)
            ? prev.filter(t => t !== tagId)
            : [...prev, tagId]
        );
    };

    const validItems = includedItems.filter(it => it.label.trim());
    const priceNum = parseInt(newPrice) || 0;
    const originalNum = parseInt(originalPrice) || 0;
    const discountPercent = originalNum > 0 && priceNum < originalNum
        ? Math.round((1 - priceNum / originalNum) * 100)
        : 0;

    const isValid =
        title.trim() &&
        description.trim() &&
        newPrice !== '' &&
        priceNum >= 0 &&
        startDate && endDate &&
        startDate <= endDate;

    const handleSubmit = () => {
        if (!isValid) return;
        addCampaign({
            icon,
            title: title.trim(),
            category,
            description: description.trim(),
            longDescription: longDescription.trim(),
            price: priceNum,
            originalPrice: originalNum > 0 ? originalNum : null,
            includedItems: validItems.map(it => ({ label: it.label.trim(), icon: it.icon || DEFAULT_ITEM_ICON })),
            estimatedDuration: estimatedDuration.trim(),
            guarantee: guarantee.trim(),
            tags,
            startDate,
            endDate,
        });
        goBack();
    };

    return (<>
        <SubHeader title="Yeni Kampanya" />
        <div className="screen-scroll screen-scroll--sub">
            <div className="p-16">
                <SectionBlock title="Kampanya Kartı">
                    <div className="usta-campaign-icon-picker">
                        <div className="usta-campaign-icon-picker__current">{icon}</div>
                        <div className="usta-campaign-icon-picker__grid">
                            {ICON_PRESETS.map(ic => (
                                <button
                                    key={ic}
                                    className={`usta-campaign-icon-picker__btn ${icon === ic ? 'is-active' : ''}`}
                                    onClick={() => setIcon(ic)}
                                >
                                    {ic}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="form-group" style={{ marginTop: 12 }}>
                        <label className="form-label">Başlık *</label>
                        <input
                            className="form-input"
                            placeholder="Ör: Yaz Bakımı Paketi"
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">Kategori</label>
                        <div className="usta-campaign-cat-grid">
                            {CATEGORIES.map(c => (
                                <button
                                    key={c.id}
                                    className={`usta-campaign-cat-chip ${category === c.id ? 'is-active' : ''}`}
                                    onClick={() => setCategory(c.id)}
                                >
                                    {c.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="form-label">Kısa Açıklama *</label>
                        <input
                            className="form-input"
                            placeholder="Ör: Yağ + Filtre + Klima Kontrolü"
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">Detaylı Açıklama</label>
                        <textarea
                            className="form-textarea"
                            rows={3}
                            placeholder="Kampanyanın detaylarını yaz..."
                            value={longDescription}
                            onChange={e => setLongDescription(e.target.value)}
                        />
                    </div>
                </SectionBlock>

                <SectionBlock title="Fiyatlandırma" className="mt-16">
                    <div className="usta-campaign-price-row">
                        <div className="form-group usta-campaign-price-row__field">
                            <label className="form-label">Orijinal Fiyat (₺)</label>
                            <input
                                className="form-input"
                                type="number"
                                placeholder="899"
                                value={originalPrice}
                                onChange={e => setOriginalPrice(e.target.value)}
                            />
                        </div>
                        <div className="form-group usta-campaign-price-row__field">
                            <label className="form-label">Kampanya Fiyatı (₺) *</label>
                            <input
                                className="form-input"
                                type="number"
                                placeholder="699"
                                value={newPrice}
                                onChange={e => setNewPrice(e.target.value)}
                            />
                        </div>
                    </div>
                    {discountPercent > 0 && (
                        <div className="usta-campaign-discount-preview">
                            <span>%{discountPercent} indirim</span>
                            <span>·</span>
                            <span>₺{(originalNum - priceNum).toLocaleString('tr-TR')} tasarruf</span>
                        </div>
                    )}
                </SectionBlock>

                <SectionBlock title="Dahil Olan Hizmetler" className="mt-16">
                    {includedItems.map((item, idx) => (
                        <div key={idx} className="usta-campaign-item-row">
                            <input
                                className="form-input usta-campaign-item-row__icon"
                                value={item.icon}
                                onChange={e => updateItem(idx, 'icon', e.target.value)}
                                maxLength={4}
                            />
                            <input
                                className="form-input usta-campaign-item-row__label"
                                placeholder="Ör: Motor Yağı Değişimi"
                                value={item.label}
                                onChange={e => updateItem(idx, 'label', e.target.value)}
                            />
                            {includedItems.length > 1 && (
                                <button
                                    className="usta-campaign-item-row__remove"
                                    onClick={() => removeItem(idx)}
                                    aria-label="Kaldır"
                                >
                                    ✕
                                </button>
                            )}
                        </div>
                    ))}
                    <button className="usta-campaign-item-add" onClick={addItem}>
                        + Hizmet Ekle
                    </button>
                </SectionBlock>

                <SectionBlock title="Süre & Garanti" className="mt-16">
                    <div className="form-group">
                        <label className="form-label">Tahmini Süre</label>
                        <input
                            className="form-input"
                            placeholder="Ör: 1-2 saat"
                            value={estimatedDuration}
                            onChange={e => setEstimatedDuration(e.target.value)}
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Garanti</label>
                        <input
                            className="form-input"
                            placeholder="Ör: 3 ay / 5.000 km"
                            value={guarantee}
                            onChange={e => setGuarantee(e.target.value)}
                        />
                    </div>
                </SectionBlock>

                <SectionBlock title="Etiketler" className="mt-16">
                    <div className="usta-campaign-tag-row">
                        {TAG_PRESETS.map(t => (
                            <button
                                key={t.id}
                                className={`usta-campaign-tag-chip ${tags.includes(t.id) ? 'is-active' : ''}`}
                                onClick={() => toggleTag(t.id)}
                            >
                                {t.label}
                            </button>
                        ))}
                    </div>
                </SectionBlock>

                <SectionBlock title="Yayın Süresi" className="mt-16">
                    <div className="form-group">
                        <label className="form-label">Başlangıç *</label>
                        <input
                            className="form-input"
                            type="date"
                            value={startDate}
                            onChange={e => setStartDate(e.target.value)}
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Bitiş *</label>
                        <input
                            className="form-input"
                            type="date"
                            value={endDate}
                            onChange={e => setEndDate(e.target.value)}
                        />
                    </div>
                </SectionBlock>

                <div className="mt-24 mb-32">
                    <PrimaryActionBar
                        stacked
                        primaryAction={{
                            label: 'Kampanyayı Yayınla',
                            onClick: handleSubmit,
                            disabled: !isValid,
                        }}
                        secondaryAction={{
                            label: 'Vazgeç',
                            onClick: goBack,
                        }}
                    />
                </div>
            </div>
        </div>
    </>);
}
