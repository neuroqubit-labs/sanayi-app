import { useApp } from '../context/AppContext';
import { ChevronDown } from './Icons';

export default function VehicleBar() {
    const { vehicle, showVehicleBar, setVehicleSwitcherOpen, navigate, currentScreen } = useApp();
    if (!showVehicleBar) return null;

    const isHome = currentScreen === 'screen-home';

    return (
        <header className="vehicle-bar">
            <div className="vehicle-bar__info">
                <span className="vehicle-bar__plate">{vehicle.plate}</span>
                <span className="vehicle-bar__model">{vehicle.model}</span>
            </div>
            <div className="vehicle-bar__actions">
                <button className="vehicle-bar__switch" onClick={() => setVehicleSwitcherOpen(true)}>
                    <ChevronDown />
                </button>
                {isHome && (
                    <button className="notif-bell" onClick={() => navigate('screen-bildirimler')}>
                        🔔<span className="notif-bell__badge">2</span>
                    </button>
                )}
            </div>
        </header>
    );
}
