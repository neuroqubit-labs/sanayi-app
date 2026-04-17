import { useState } from 'react';
import { useApp } from '../context/AppContext';
import SubHeader from '../components/SubHeader';
import { SectionBlock, PrimaryActionBar } from '@shared/components/DecisionPrimitives';
import { SlotPicker } from '@shared/components/SlotPicker';
import { useUstaQuoteState, getNavParams } from '../hooks/useQuoteState';
import { POOL_JOBS } from '../data/ustaData';

export default function UstaQuoteFormScreen() {
    const { goBack } = useApp();
    const params = getNavParams();
    const { sendQuote } = useUstaQuoteState();

    const job = POOL_JOBS.find(j => j.id === params.poolJobId) || POOL_JOBS[0];

    // Form state
    const [items, setItems] = useState([
        { name: 'Teşhis & OBD Tarama', price: '' },
        { name: '', price: '' },
    ]);
    const [timeline, setTimeline] = useState('');
    const [guarantee, setGuarantee] = useState('');
    const [terms, setTerms] = useState('');
    const [note, setNote] = useState('');
    const [slots, setSlots] = useState([]);

    const updateItem = (idx, field, value) => {
        setItems(prev => prev.map((item, i) =>
            i === idx ? { ...item, [field]: value } : item
        ));
    };

    const addItem = () => {
        setItems(prev => [...prev, { name: '', price: '' }]);
    };

    const removeItem = (idx) => {
        if (items.length <= 1) return;
        setItems(prev => prev.filter((_, i) => i !== idx));
    };

    const total = items.reduce((sum, item) => sum + (parseInt(item.price) || 0), 0);
    const isValid = items.some(i => i.name.trim() && i.price) && timeline.trim();

    const handleSubmit = () => {
        const quoteData = {
            items: items.filter(i => i.name.trim()).map(i => ({ name: i.name, price: parseInt(i.price) || 0 })),
            total,
            timeline,
            guarantee,
            terms,
            note,
            slots,
        };
        sendQuote(job.id, quoteData);
        goBack();
    };

    return (<>
        <SubHeader title="Teklif Oluştur" />
        <div className="screen-scroll screen-scroll--sub">
            <div className="p-16">
                {/* Vaka Özeti */}
                <div className="usta-quote-summary">
                    <div className="usta-quote-summary__title">{job.description.slice(0, 80)}</div>
                    <div className="usta-quote-summary__meta">
                        {job.vehicle.model} · {job.vehicle.plate} · {job.vehicle.km} km
                    </div>
                    {job.aiInsights && (
                        <div className="usta-quote-summary__ai">
                            AI: {job.aiInsights.summary}
                        </div>
                    )}
                </div>

                {/* Fiyat Kalemleri */}
                <SectionBlock title="Fiyat Kalemleri" className="mt-16">
                    {items.map((item, idx) => (
                        <div key={idx} className="usta-quote-item-row">
                            <input
                                className="form-input usta-quote-item-row__name"
                                placeholder="Kalem adı (ör: İşçilik)"
                                value={item.name}
                                onChange={e => updateItem(idx, 'name', e.target.value)}
                            />
                            <input
                                className="form-input usta-quote-item-row__price"
                                placeholder="₺"
                                type="number"
                                value={item.price}
                                onChange={e => updateItem(idx, 'price', e.target.value)}
                            />
                            {items.length > 1 && (
                                <button className="usta-quote-item-row__remove" onClick={() => removeItem(idx)}>✕</button>
                            )}
                        </div>
                    ))}
                    <button className="usta-quote-add-item" onClick={addItem}>+ Kalem Ekle</button>
                    {total > 0 && (
                        <div className="usta-quote-total">
                            <span>Toplam</span>
                            <strong>₺{total.toLocaleString('tr-TR')}</strong>
                        </div>
                    )}
                </SectionBlock>

                {/* Süre & Garanti */}
                <SectionBlock title="Süre & Koşullar" className="mt-16">
                    <div className="form-group">
                        <label className="form-label">Tahmini Süre *</label>
                        <input className="form-input" placeholder="Ör: 1-2 gün" value={timeline} onChange={e => setTimeline(e.target.value)} />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Garanti</label>
                        <input className="form-input" placeholder="Ör: 6 ay / 10.000 km" value={guarantee} onChange={e => setGuarantee(e.target.value)} />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Şartlar & Koşullar</label>
                        <textarea className="form-textarea" placeholder="Ör: Ek iş çıkarsa önceden onay alınır." value={terms} onChange={e => setTerms(e.target.value)} rows={2} />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Müşteriye Not</label>
                        <textarea className="form-textarea" placeholder="Opsiyonel not..." value={note} onChange={e => setNote(e.target.value)} rows={2} />
                    </div>
                </SectionBlock>

                {/* Müsait Günler */}
                <SectionBlock title="Müsait Günlerim" className="mt-16">
                    <SlotPicker selectedSlots={slots} onSlotsChange={setSlots} maxSlots={3} />
                </SectionBlock>

                {/* Müşteri Tercihi */}
                {job.customerSlots && job.customerSlots.length > 0 && (
                    <SectionBlock title="Müşteri Tercihi" className="mt-16">
                        <div className="usta-customer-slots">
                            {job.customerSlots.map((s, i) => (
                                <div key={i} className="usta-customer-slot-chip">
                                    <span>{s.day}</span>
                                    <span>{s.ranges.join(', ')}</span>
                                </div>
                            ))}
                        </div>
                        {job.customerNote && (
                            <div className="usta-customer-note">"{job.customerNote}"</div>
                        )}
                    </SectionBlock>
                )}

                {/* Submit */}
                <div className="mt-24 mb-32">
                    <PrimaryActionBar
                        stacked
                        primaryAction={{
                            label: `Teklif Gönder${total > 0 ? ` (₺${total.toLocaleString('tr-TR')})` : ''}`,
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
