import { AppProvider, useApp } from './context/AppContext';
import VehicleBar from './components/VehicleBar';
import BottomNav from './components/BottomNav';
import FABOverlay from './components/FABOverlay';
import VehicleSwitcher from './components/VehicleSwitcher';

// Screens
import HomeScreen from './screens/HomeScreen';
import KayitlarScreen from './screens/KayitlarScreen';
import UstalarScreen from './screens/UstalarScreen';
import ProfilScreen from './screens/ProfilScreen';
import SwipeScreen from './screens/SwipeScreen';
import { HasarDetailScreen, UstaProfilScreen, TeklifScreen, ServisTakipScreen, HasarTakipScreen, ServisDetayScreen } from './screens/SubScreens';
import CekiciFlow from './screens/CekiciFlow';
import { HasarFlow1, HasarFlow2, HasarFlow3, HasarFlow4 } from './screens/HasarFlow';
import { KazaFlow0, KazaFlow1, KazaFlow2, KazaFlow3, KazaFlow4, KazaFlow5, KazaFlow6 } from './screens/KazaFlow';
import { BakimFlow1, BakimFlow2, BakimFlow3 } from './screens/BakimFlow';
import { AracEkleScreen, AracYonetimScreen, AracListScreen } from './screens/AracScreens';
import { BildirimlerScreen, DestekScreen, FaturaDetayScreen } from './screens/UtilityScreens';
import { VakaHavuzScreen, TeklifDetayScreen, KesinKabulScreen } from './screens/QuoteScreens';
import SearchScreen from './screens/SearchScreen';
import PackageDetailScreen from './screens/PackageDetailScreen';
import CheckoutScreen from './screens/CheckoutScreen';
import OrderConfirmScreen from './screens/OrderConfirmScreen';

const SCREEN_MAP = {
    'screen-home': HomeScreen,
    'screen-kayitlar': KayitlarScreen,
    'screen-ustalar': UstalarScreen,
    'screen-profil': ProfilScreen,
    'screen-eslestir': SwipeScreen,
    'screen-hasar-detail': HasarDetailScreen,
    'screen-usta-profil': UstaProfilScreen,
    'screen-teklif': TeklifScreen,
    'screen-servis-takip': ServisTakipScreen,
    'screen-cekici': CekiciFlow,
    'screen-hasar-flow': HasarFlow1,
    'screen-hasar-flow-2': HasarFlow2,
    'screen-hasar-flow-3': HasarFlow3,
    'screen-hasar-flow-4': HasarFlow4,
    'screen-kaza-flow-0': KazaFlow0,
    'screen-kaza-flow-1': KazaFlow1,
    'screen-kaza-flow-2': KazaFlow2,
    'screen-kaza-flow-3': KazaFlow3,
    'screen-kaza-flow-4': KazaFlow4,
    'screen-kaza-flow-5': KazaFlow5,
    'screen-kaza-flow-6': KazaFlow6,
    'screen-bakim-flow': BakimFlow1,
    'screen-bakim-flow-2': BakimFlow2,
    'screen-bakim-flow-3': BakimFlow3,
    'screen-arac-ekle': AracEkleScreen,
    'screen-arac-yonetim': AracYonetimScreen,
    'screen-arac-list': AracListScreen,
    'screen-bildirimler': BildirimlerScreen,
    'screen-destek': DestekScreen,
    'screen-fatura-detay': FaturaDetayScreen,
    'screen-hasar-takip': HasarTakipScreen,
    'screen-servis-detay': ServisDetayScreen,
    'screen-vaka-havuz': VakaHavuzScreen,
    'screen-teklif-detay': TeklifDetayScreen,
    'screen-kesin-kabul': KesinKabulScreen,
    'screen-search': SearchScreen,
    'screen-paket-detay': PackageDetailScreen,
    'screen-checkout': CheckoutScreen,
    'screen-siparis-onay': OrderConfirmScreen,
};

// Main tab screens have special wrapper
const MAIN_TABS = ['screen-home', 'screen-kayitlar', 'screen-ustalar', 'screen-profil'];

function ScreenContainer({ capturePreset }) {
    const { currentScreen } = useApp();
    const ScreenComponent = SCREEN_MAP[currentScreen] || HomeScreen;
    const isMainTab = MAIN_TABS.includes(currentScreen);
    const showVehicleBar = isMainTab && currentScreen !== 'screen-profil';
    const showBottomNav = isMainTab;

    return (
        <div
            className="app-shell"
            data-capture-active={capturePreset ? 'true' : undefined}
            data-capture-mode={capturePreset?.captureMode}
            data-capture-preset={capturePreset?.id}
            data-capture-screen={currentScreen}
        >
            {showVehicleBar && <VehicleBar />}
            <main className={`screen-main ${isMainTab ? '' : 'screen-main--sub'}`}>
                <ScreenComponent key={currentScreen} />
            </main>
            {isMainTab && <FABOverlay />}
            {isMainTab && <VehicleSwitcher />}
            {showBottomNav && <BottomNav />}
        </div>
    );
}

export default function App({ initialState = null, capturePreset = null }) {
    return (
        <AppProvider initialState={initialState}>
            <ScreenContainer capturePreset={capturePreset} />
        </AppProvider>
    );
}
