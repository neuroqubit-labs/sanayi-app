import { useState } from 'react';

/**
 * SlotPicker — Gun + saat araligi secici
 *
 * Kullanici birden fazla gun/saat araligi onerebilir.
 * Usta da kendi uygun slotlarini gonderir.
 * Eslestirme gorsel olarak gosterilir.
 */

// Onumuzdeki 7 gunun listesi
function getUpcomingDays(count = 7) {
    const days = [];
    const dayNames = ['Paz', 'Pzt', 'Sal', 'Car', 'Per', 'Cum', 'Cmt'];
    const monthNames = ['Oca', 'Sub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Agu', 'Eyl', 'Eki', 'Kas', 'Ara'];
    const now = new Date();

    for (let i = 0; i < count; i++) {
        const d = new Date(now);
        d.setDate(now.getDate() + i);
        days.push({
            key: d.toISOString().slice(0, 10),
            dayName: i === 0 ? 'Bugun' : i === 1 ? 'Yarin' : dayNames[d.getDay()],
            date: `${d.getDate()} ${monthNames[d.getMonth()]}`,
            dayOfWeek: d.getDay(),
        });
    }
    return days;
}

const TIME_RANGES = [
    { id: 'morning', label: 'Sabah', desc: '09:00 – 12:00', icon: '🌅' },
    { id: 'afternoon', label: 'Ogle', desc: '12:00 ��� 15:00', icon: '☀️' },
    { id: 'evening', label: 'Aksam', desc: '15:00 – 18:00', icon: '🌆' },
    { id: 'flexible', label: 'Tum gun', desc: '09:00 – 18:00', icon: '📅' },
];

/**
 * SlotPicker — Musteri tarafinda slot secimi
 *
 * @param {Array} selectedSlots - [{ day: '2026-04-17', ranges: ['morning', 'afternoon'] }]
 * @param {Function} onSlotsChange - callback
 * @param {number} maxSlots - max gun secimi (default 3)
 */
export function SlotPicker({ selectedSlots = [], onSlotsChange, maxSlots = 3 }) {
    const days = getUpcomingDays(7);
    const [expandedDay, setExpandedDay] = useState(null);

    const selectedDayKeys = selectedSlots.map(s => s.day);

    const toggleDay = (dayKey) => {
        if (selectedDayKeys.includes(dayKey)) {
            // Remove day
            onSlotsChange(selectedSlots.filter(s => s.day !== dayKey));
            if (expandedDay === dayKey) setExpandedDay(null);
        } else if (selectedSlots.length < maxSlots) {
            // Add day with empty ranges
            onSlotsChange([...selectedSlots, { day: dayKey, ranges: [] }]);
            setExpandedDay(dayKey);
        }
    };

    const toggleRange = (dayKey, rangeId) => {
        onSlotsChange(selectedSlots.map(s => {
            if (s.day !== dayKey) return s;
            const hasRange = s.ranges.includes(rangeId);
            if (rangeId === 'flexible') {
                return { ...s, ranges: hasRange ? [] : ['flexible'] };
            }
            const withoutFlexible = s.ranges.filter(r => r !== 'flexible');
            return {
                ...s,
                ranges: hasRange
                    ? withoutFlexible.filter(r => r !== rangeId)
                    : [...withoutFlexible, rangeId],
            };
        }));
    };

    const getSlotForDay = (dayKey) => selectedSlots.find(s => s.day === dayKey);

    return (
        <div className="slot-picker">
            <div className="slot-picker__label">Musait oldugum gunler ve saatler</div>
            <div className="slot-picker__hint">En fazla {maxSlots} gun secilebilir</div>

            {/* Day strip */}
            <div className="slot-day-strip">
                {days.map(day => {
                    const isWeekend = day.dayOfWeek === 0 || day.dayOfWeek === 6;
                    const isSelected = selectedDayKeys.includes(day.key);
                    const slot = getSlotForDay(day.key);
                    const hasRanges = slot && slot.ranges.length > 0;

                    return (
                        <button
                            key={day.key}
                            className={`slot-day ${isSelected ? 'slot-day--selected' : ''} ${isWeekend ? 'slot-day--weekend' : ''} ${hasRanges ? 'slot-day--complete' : ''}`}
                            onClick={() => toggleDay(day.key)}
                        >
                            <span className="slot-day__name">{day.dayName}</span>
                            <span className="slot-day__date">{day.date}</span>
                            {hasRanges && <span className="slot-day__check">✓</span>}
                        </button>
                    );
                })}
            </div>

            {/* Time ranges for selected days */}
            {selectedSlots.map(slot => {
                const dayInfo = days.find(d => d.key === slot.day);
                if (!dayInfo) return null;

                return (
                    <div key={slot.day} className="slot-time-block">
                        <div className="slot-time-block__header">
                            <span className="slot-time-block__day">{dayInfo.dayName}, {dayInfo.date}</span>
                            <button className="slot-time-block__remove" onClick={() => toggleDay(slot.day)}>✕</button>
                        </div>
                        <div className="slot-time-grid">
                            {TIME_RANGES.map(range => (
                                <button
                                    key={range.id}
                                    className={`slot-time-btn ${slot.ranges.includes(range.id) ? 'slot-time-btn--active' : ''}`}
                                    onClick={() => toggleRange(slot.day, range.id)}
                                >
                                    <span className="slot-time-btn__icon">{range.icon}</span>
                                    <span className="slot-time-btn__label">{range.label}</span>
                                    <span className="slot-time-btn__desc">{range.desc}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                );
            })}

            {selectedSlots.length === 0 && (
                <div className="slot-picker__empty">Yukaridaki gunlerden musait olduklarini sec</div>
            )}
        </div>
    );
}

/**
 * SlotComparison — Musteri vs Usta slotlarini karsilastir
 *
 * @param {Array} customerSlots - musteri onerileri
 * @param {Object} providerSlot - ustanin onerdigi slot { day, range, time }
 * @param {boolean} matched - slot eslesti mi
 */
export function SlotComparison({ customerSlots = [], providerSlot, matched }) {
    const dayNames = ['Paz', 'Pzt', 'Sal', 'Car', 'Per', 'Cum', 'Cmt'];
    const monthNames = ['Oca', 'Sub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Agu', 'Eyl', 'Eki', 'Kas', 'Ara'];

    const formatDay = (dateStr) => {
        const d = new Date(dateStr);
        return `${dayNames[d.getDay()]}, ${d.getDate()} ${monthNames[d.getMonth()]}`;
    };

    const rangeLabel = (id) => {
        const r = TIME_RANGES.find(t => t.id === id);
        return r ? `${r.label} (${r.desc})` : id;
    };

    return (
        <div className="slot-comparison">
            {/* Customer proposed */}
            <div className="slot-comparison__section">
                <div className="slot-comparison__label">🧑 Senin onerdigin</div>
                <div className="slot-comparison__slots">
                    {customerSlots.map(s => (
                        <div key={s.day} className="slot-comparison__chip">
                            <span className="slot-comparison__chip-day">{formatDay(s.day)}</span>
                            <span className="slot-comparison__chip-times">
                                {s.ranges.map(r => rangeLabel(r)).join(', ')}
                            </span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Provider response */}
            {providerSlot && (
                <div className={`slot-comparison__section ${matched ? 'slot-comparison__section--match' : 'slot-comparison__section--alt'}`}>
                    <div className="slot-comparison__label">
                        {matched ? '✅ Usta onayladi' : '🔧 Usta alternatif onerdi'}
                    </div>
                    <div className="slot-comparison__slots">
                        <div className={`slot-comparison__chip ${matched ? 'slot-comparison__chip--match' : 'slot-comparison__chip--alt'}`}>
                            <span className="slot-comparison__chip-day">{formatDay(providerSlot.day)}</span>
                            <span className="slot-comparison__chip-times">{providerSlot.time}</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

/**
 * AppointmentConfirm — Kesin kabul icinde randevu onayi
 *
 * @param {Object} providerSlot - ustanin onerdigi slot
 * @param {boolean} accepted - kabul edildi mi
 * @param {Function} onAccept
 * @param {Function} onRequestChange - saat degisikligi iste
 */
export function AppointmentConfirm({ providerSlot, accepted, onAccept, onRequestChange }) {
    if (!providerSlot) return null;

    return (
        <div className="appointment-confirm">
            <div className="appointment-confirm__header">
                <span className="appointment-confirm__icon">📅</span>
                <span className="appointment-confirm__title">Randevu Zamani</span>
            </div>

            <div className={`appointment-confirm__slot ${accepted ? 'appointment-confirm__slot--accepted' : ''}`}>
                <div className="appointment-confirm__day">{providerSlot.dayLabel}</div>
                <div className="appointment-confirm__time">{providerSlot.time}</div>
            </div>

            {!accepted && (
                <div className="appointment-confirm__actions">
                    <button className="appointment-confirm__btn appointment-confirm__btn--accept" onClick={onAccept}>
                        ✓ Bu saat uygun
                    </button>
                    <button className="appointment-confirm__btn appointment-confirm__btn--change" onClick={onRequestChange}>
                        Saat degisikligi iste
                    </button>
                </div>
            )}

            {accepted && (
                <div className="appointment-confirm__accepted">
                    ✅ Randevu saati onaylandi
                </div>
            )}
        </div>
    );
}

export { TIME_RANGES, getUpcomingDays };
