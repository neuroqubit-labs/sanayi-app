import { useApp } from '../context/AppContext';

export default function FABOverlay() {
    const { fabOpen, setFabOpen, fabGo } = useApp();
    return (
        <div className={`fab-overlay ${fabOpen ? 'open' : ''}`} onClick={() => setFabOpen(false)}>
            <div className="fab-menu glass" onClick={e => e.stopPropagation()}>
                <div className="fab-menu__title">Ne yapmak istersiniz?</div>

                {/* Hero Action - Usta Keşfet */}
                <button className="fab-action fab-action--hero" onClick={() => fabGo('screen-eslestir')}>
                    <span className="fab-action__icon">👆</span>
                    <div>
                        <div className="fab-action__title">Kaydır & Usta Bul</div>
                        <div className="fab-action__desc">Sana önerilen ustaları keşfet</div>
                    </div>
                </button>

                {/* Urgent Action - Kaza (kırmızı, dikkat çekici) */}
                <button className="fab-action fab-action--urgent" onClick={() => fabGo('screen-kaza-flow-0')}>
                    <span className="fab-action__icon">💥</span>
                    <div>
                        <div className="fab-action__title">Kaza Bildir</div>
                        <div className="fab-action__desc">Kaza, çarpma ve hasar olayları</div>
                    </div>
                </button>

                {/* Standard Actions */}
                <button className="fab-action" onClick={() => fabGo('screen-hasar-flow')}>
                    <span className="fab-action__icon">🔧</span>
                    <div>
                        <div className="fab-action__title">Arıza Bildir</div>
                        <div className="fab-action__desc">Ses, titreşim, sızıntı ve arızalar</div>
                    </div>
                </button>
                <button className="fab-action" onClick={() => fabGo('screen-bakim-flow')}>
                    <span className="fab-action__icon">🛠️</span>
                    <div>
                        <div className="fab-action__title">Bakım Talebi</div>
                        <div className="fab-action__desc">Periyodik bakım veya özel işlem</div>
                    </div>
                </button>
                <button className="fab-action" onClick={() => fabGo('screen-cekici')}>
                    <span className="fab-action__icon">🚛</span>
                    <div>
                        <div className="fab-action__title">Çekici Çağır</div>
                        <div className="fab-action__desc">Acil yol yardımı</div>
                    </div>
                </button>
            </div>
        </div>
    );
}
