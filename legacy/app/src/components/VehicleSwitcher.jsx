import { useApp } from '../context/AppContext';

export default function VehicleSwitcher() {
    const { vehicleSwitcherOpen, setVehicleSwitcherOpen, switchVehicle, vehicle } = useApp();
    return (
        <div className={`bottom-sheet ${vehicleSwitcherOpen ? 'open' : ''}`} onClick={() => setVehicleSwitcherOpen(false)}>
            <div className="bottom-sheet__panel glass" onClick={e => e.stopPropagation()}>
                <div className="bottom-sheet__handle"></div>
                <div className="bottom-sheet__title">Araç Seç</div>
                <div className={`vehicle-item ${vehicle.plate === '34 ABC 42' ? 'vehicle-item--active' : ''}`}
                    onClick={() => switchVehicle('34 ABC 42', 'BMW 3 Serisi · 2019')}>
                    <div className="vehicle-item__plate">34 ABC 42</div>
                    <div className="vehicle-item__model">BMW 3 Serisi · 2019</div>
                    {vehicle.plate === '34 ABC 42' && <div className="vehicle-item__badge">Aktif ✓</div>}
                </div>
                <div className={`vehicle-item ${vehicle.plate === '06 XYZ 77' ? 'vehicle-item--active' : ''}`}
                    onClick={() => switchVehicle('06 XYZ 77', 'Toyota Corolla · 2021')}>
                    <div className="vehicle-item__plate">06 XYZ 77</div>
                    <div className="vehicle-item__model">Toyota Corolla · 2021</div>
                    {vehicle.plate === '06 XYZ 77' && <div className="vehicle-item__badge">Aktif ✓</div>}
                </div>
                <button className="cta-btn cta-btn--outline mt-16" onClick={() => setVehicleSwitcherOpen(false)}>+ Yeni Araç Ekle</button>
            </div>
        </div>
    );
}
