import { createContext, useContext, useState, useCallback, useRef } from 'react';

const AppContext = createContext();

const MAIN_TABS = ['screen-home', 'screen-kayitlar', 'screen-ustalar', 'screen-profil'];
const NO_VEHICLE_BAR = ['screen-profil', 'screen-destek', 'screen-bildirimler'];

export function AppProvider({ children }) {
    const [currentScreen, setCurrentScreen] = useState('screen-home');
    const [activeTab, setActiveTab] = useState('screen-home');
    const [fabOpen, setFabOpen] = useState(false);
    const [vehicleSwitcherOpen, setVehicleSwitcherOpen] = useState(false);
    const [vehicle, setVehicle] = useState({ plate: '34 ABC 42', model: 'BMW 3 Serisi · 2019' });
    const historyRef = useRef([]);

    const navigate = useCallback((screenId) => {
        historyRef.current.push(currentScreen);
        setCurrentScreen(screenId);
    }, [currentScreen]);

    const goBack = useCallback(() => {
        if (historyRef.current.length > 0) {
            const prev = historyRef.current.pop();
            setCurrentScreen(prev);
            if (MAIN_TABS.includes(prev)) setActiveTab(prev);
        }
    }, []);

    const navTo = useCallback((screenId) => {
        historyRef.current = [];
        setCurrentScreen(screenId);
        setActiveTab(screenId);
    }, []);

    const fabGo = useCallback((screenId) => {
        setFabOpen(false);
        historyRef.current.push(currentScreen);
        setCurrentScreen(screenId);
    }, [currentScreen]);

    const switchVehicle = useCallback((plate, model) => {
        setVehicle({ plate, model });
        setVehicleSwitcherOpen(false);
    }, []);

    const showVehicleBar = !NO_VEHICLE_BAR.includes(currentScreen);

    return (
        <AppContext.Provider value={{
            currentScreen, activeTab, fabOpen, vehicleSwitcherOpen, vehicle,
            showVehicleBar, navigate, goBack, navTo, fabGo,
            setFabOpen, setVehicleSwitcherOpen, switchVehicle,
        }}>
            {children}
        </AppContext.Provider>
    );
}

export function useApp() {
    return useContext(AppContext);
}
