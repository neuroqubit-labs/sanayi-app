import { AppProvider, useApp } from './context/AppContext';
import BottomNav from './components/BottomNav';
import FABOverlay from './components/FABOverlay';

import UstaHomeScreen from './screens/UstaHomeScreen';
import MyJobsScreen from './screens/MyJobsScreen';
import PoolScreen from './screens/PoolScreen';
import PoolJobDetailScreen from './screens/PoolJobDetailScreen';
import BusinessProfileScreen from './screens/BusinessProfileScreen';
import UstaJobDetailScreen from './screens/UstaJobDetailScreen';
import UstaQuoteFormScreen from './screens/UstaQuoteFormScreen';
import RevenueScreen from './screens/RevenueScreen';
import CampaignCreateScreen from './screens/CampaignCreateScreen';
import MyCampaignsScreen from './screens/MyCampaignsScreen';

const SCREEN_MAP = {
    'screen-usta-home': UstaHomeScreen,
    'screen-my-jobs': MyJobsScreen,
    'screen-pool': PoolScreen,
    'screen-pool-detail': PoolJobDetailScreen,
    'screen-business-profile': BusinessProfileScreen,
    'screen-job-detail': UstaJobDetailScreen,
    'screen-quote-form': UstaQuoteFormScreen,
    'screen-revenue': RevenueScreen,
    'screen-campaign-create': CampaignCreateScreen,
    'screen-my-campaigns': MyCampaignsScreen,
};

const MAIN_TABS = ['screen-usta-home', 'screen-my-jobs', 'screen-pool', 'screen-business-profile'];

function ScreenContainer() {
    const { currentScreen } = useApp();
    const ScreenComponent = SCREEN_MAP[currentScreen] || UstaHomeScreen;
    const isMainTab = MAIN_TABS.includes(currentScreen);

    return (
        <div className="app-shell">
            <main className={`screen-main ${isMainTab ? '' : 'screen-main--sub'}`}>
                <ScreenComponent key={currentScreen} />
            </main>
            {isMainTab && <FABOverlay />}
            {isMainTab && <BottomNav />}
        </div>
    );
}

export default function App() {
    return (
        <AppProvider>
            <ScreenContainer />
        </AppProvider>
    );
}
