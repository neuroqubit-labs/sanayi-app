import { createContext, useContext, useState, useCallback, useRef } from 'react';

const AppContext = createContext();

const MAIN_TABS = ['screen-usta-home', 'screen-my-jobs', 'screen-pool', 'screen-business-profile'];

export function AppProvider({ children }) {
    const [currentScreen, setCurrentScreen] = useState('screen-usta-home');
    const [activeTab, setActiveTab] = useState('screen-usta-home');
    const [fabOpen, setFabOpen] = useState(false);
    const [availability, setAvailability] = useState('open');
    const [campaigns, setCampaigns] = useState([]);
    const historyRef = useRef([]);

    const addCampaign = useCallback((campaign) => {
        setCampaigns(prev => [
            { id: `camp-${Date.now()}`, createdAt: new Date().toISOString(), ...campaign },
            ...prev,
        ]);
    }, []);

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

    return (
        <AppContext.Provider value={{
            currentScreen, activeTab, fabOpen,
            navigate, goBack, navTo, fabGo, setFabOpen,
            availability, setAvailability,
            campaigns, addCampaign,
        }}>
            {children}
        </AppContext.Provider>
    );
}

export function useApp() {
    return useContext(AppContext);
}
