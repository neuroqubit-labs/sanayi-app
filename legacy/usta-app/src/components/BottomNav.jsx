import { useApp } from '../context/AppContext';
import { HomeIcon, PlusIcon, ProfilIcon } from '@shared/components/Icons';

const JobsIcon = () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
        <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    </svg>
);

const PoolIcon = () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
        <line x1="8" y1="11" x2="14" y2="11" />
        <line x1="11" y1="8" x2="11" y2="14" />
    </svg>
);

export default function BottomNav() {
    const { activeTab, navTo, setFabOpen } = useApp();
    return (
        <nav className="bottom-nav">
            <button className={`nav-btn ${activeTab === 'screen-usta-home' ? 'active' : ''}`} onClick={() => navTo('screen-usta-home')}>
                <HomeIcon /><span>Anasayfa</span>
            </button>
            <button className={`nav-btn ${activeTab === 'screen-my-jobs' ? 'active' : ''}`} onClick={() => navTo('screen-my-jobs')}>
                <JobsIcon /><span>İşlerim</span>
            </button>
            <button className="nav-btn nav-btn--fab" onClick={() => setFabOpen(o => !o)}>
                <div className="fab-inner"><PlusIcon /></div>
            </button>
            <button className={`nav-btn ${activeTab === 'screen-pool' ? 'active' : ''}`} onClick={() => navTo('screen-pool')}>
                <PoolIcon /><span>Havuz</span>
            </button>
            <button className={`nav-btn ${activeTab === 'screen-business-profile' ? 'active' : ''}`} onClick={() => navTo('screen-business-profile')}>
                <ProfilIcon /><span>Profil</span>
            </button>
        </nav>
    );
}
