import { useApp } from '../context/AppContext';
import { HomeIcon, KayitlarIcon, UstalarIcon, ProfilIcon, PlusIcon } from './Icons';

export default function BottomNav() {
    const { activeTab, navTo, setFabOpen } = useApp();
    return (
        <nav className="bottom-nav">
            <button className={`nav-btn ${activeTab === 'screen-home' ? 'active' : ''}`} onClick={() => navTo('screen-home')}>
                <HomeIcon /><span>Ana Sayfa</span>
            </button>
            <button className={`nav-btn ${activeTab === 'screen-kayitlar' ? 'active' : ''}`} onClick={() => navTo('screen-kayitlar')}>
                <KayitlarIcon /><span>Kayıtlar</span>
            </button>
            <button className="nav-btn nav-btn--fab" onClick={() => setFabOpen(o => !o)}>
                <div className="fab-inner"><PlusIcon /></div>
            </button>
            <button className={`nav-btn ${activeTab === 'screen-ustalar' ? 'active' : ''}`} onClick={() => navTo('screen-ustalar')}>
                <UstalarIcon /><span>Ustalar</span>
            </button>
            <button className={`nav-btn ${activeTab === 'screen-profil' ? 'active' : ''}`} onClick={() => navTo('screen-profil')}>
                <ProfilIcon /><span>Profil</span>
            </button>
        </nav>
    );
}
