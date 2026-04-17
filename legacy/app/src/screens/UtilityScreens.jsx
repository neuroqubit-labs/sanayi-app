import { useApp } from '../context/AppContext';
import SubHeader from '../components/SubHeader';
import { SearchIcon } from '../components/Icons';

export function BildirimlerScreen() {
    const { navigate } = useApp();
    return (<>
        <SubHeader title="Bildirimler" actionLabel="Okundu" />
        <div className="screen-scroll screen-scroll--sub">
            <div className="notif-card notif-card--unread" onClick={() => navigate('screen-teklif')}>
                <div className="notif-dot"></div>
                <div className="activity-item__icon act-green" style={{ width: '36px', height: '36px', fontSize: '16px' }}>💬</div>
                <div style={{ flex: 1, minWidth: 0 }}><div className="activity-item__title">Yeni Teklif — AutoPro Servis</div><div className="activity-item__desc">Motor Sesi vakası için ₺2.400 teklif gönderildi.</div><div className="notif-time">2 dakika önce</div></div>
            </div>
            <div className="notif-card notif-card--unread" onClick={() => navigate('screen-hasar-takip')}>
                <div className="notif-dot"></div>
                <div className="activity-item__icon act-blue" style={{ width: '36px', height: '36px', fontSize: '16px' }}>🔄</div>
                <div style={{ flex: 1, minWidth: 0 }}><div className="activity-item__title">Servis Durum Güncellendi</div><div className="activity-item__desc">AutoPro: "Araç teslim alındı."</div><div className="notif-time">Bugün 09:00</div></div>
            </div>
            <div className="notif-card" onClick={() => navigate('screen-kayitlar')}>
                <div className="activity-item__icon act-orange" style={{ width: '36px', height: '36px', fontSize: '16px' }}>🔔</div>
                <div style={{ flex: 1, minWidth: 0 }}><div className="activity-item__title">Bakım Hatırlatma</div><div className="activity-item__desc">Yağ değişimi için ~1.200 km kaldı.</div><div className="notif-time">Dün</div></div>
            </div>
            <div className="notif-card">
                <div className="activity-item__icon act-purple" style={{ width: '36px', height: '36px', fontSize: '16px' }}>🧾</div>
                <div style={{ flex: 1, minWidth: 0 }}><div className="activity-item__title">Fatura Eklendi</div><div className="activity-item__desc">Ön Fren Balataları — ₺850.</div><div className="notif-time">5 gün önce</div></div>
            </div>
            <div className="bottom-spacer"></div>
        </div>
    </>);
}

export function DestekScreen() {
    return (<>
        <SubHeader title="Yardım Merkezi" />
        <div className="screen-scroll screen-scroll--sub">
            <div className="search-bar"><SearchIcon /><input type="text" placeholder="Sorununuzu arayın…" /></div>
            <div className="section-title">Sık Sorulan Sorular</div>
            <div className="faq-item"><div className="faq-q">Hasar bildirimi nasıl oluşturulur?</div><div className="faq-a">Ana sayfadaki + butonuna veya hızlı erişimdeki "Hasar Bildir" butonuna basarak 4 adımlı akışı başlatabilirsiniz.</div></div>
            <div className="faq-item"><div className="faq-q">Teklif kabul ettikten sonra iptal edebilir miyim?</div><div className="faq-a">Servis süreci başlamadan önce teklifi iptal edebilirsiniz. Servis sürecindeyken destek ekibimizle iletişime geçmeniz gerekmektedir.</div></div>
            <div className="faq-item"><div className="faq-q">Çekici ücretli mi?</div><div className="faq-a">Çekici ücretlendirmesi hizmet sağlayıcıya bağlıdır ve talep sırasında gösterilir.</div></div>
            <div className="faq-item"><div className="faq-q">Ustanın puanı nasıl hesaplanıyor?</div><div className="faq-a">Puanlar tamamlanmış işler sonrası kullanıcı değerlendirmelerinin ortalamasından oluşur.</div></div>
            <div className="section-title mt-20">Destek Talebi Aç</div>
            <div className="form-group"><label className="form-label">Konu</label><input className="form-input" type="text" placeholder="Sorunun ne hakkında?" /></div>
            <div className="form-group"><label className="form-label">Açıklama</label><textarea className="form-textarea" placeholder="Detayları yazın…"></textarea></div>
            <button className="cta-btn mt-16">Destek Talebi Gönder</button>
            <div className="bottom-spacer"></div>
        </div>
    </>);
}

export function FaturaDetayScreen() {
    const { navigate } = useApp();
    return (<>
        <SubHeader title="Fatura Detay" actionLabel="PDF İndir" />
        <div className="screen-scroll screen-scroll--sub">
            <div className="fatura-header"><div className="fatura-tarih">14 Mart 2026</div><div className="fatura-servis">Mobilservis Güngören</div><div className="fatura-arac">34 ABC 42 · BMW 3 Serisi</div></div>
            <div className="section-title mt-20">İş Kalemleri</div>
            <div className="fatura-item"><span>Motor yağı değişimi</span><span>₺600</span></div>
            <div className="fatura-item"><span>Yağ filtresi</span><span>₺180</span></div>
            <div className="fatura-item"><span>Hava filtresi</span><span>₺250</span></div>
            <div className="fatura-item"><span>Buji seti (4 adet)</span><span>₺720</span></div>
            <div className="fatura-item"><span>İşçilik</span><span>₺1.100</span></div>
            <div className="fatura-total"><span>Toplam</span><span>₺2.850</span></div>
            <div className="detail-block mt-20"><div className="detail-block__title">İlgili Kayıt</div><div className="teklif-mini" onClick={() => navigate('screen-kayitlar')}><div className="teklif-mini__name">Periyodik Bakım — 14 Mar 2026</div></div></div>
            <div className="detail-block"><div className="detail-block__title">Not</div><p className="detail-block__text">Sonraki bakımda V kayışı kontrol edilecek.</p></div>
            <div className="bottom-spacer"></div>
        </div>
    </>);
}
