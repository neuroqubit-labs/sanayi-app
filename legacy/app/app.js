// ── SANAYI APP — Navigation & Interaction Logic ──

const SUB_SCREENS = new Set([
    'screen-hasar-detail', 'screen-eslestir', 'screen-usta-profil',
    'screen-teklif', 'screen-servis-takip', 'screen-hasar-flow',
    'screen-bakim-flow', 'screen-cekici',
    // New flow screens
    'screen-hasar-flow-2', 'screen-hasar-flow-3', 'screen-hasar-flow-4',
    'screen-bakim-flow-2', 'screen-bakim-flow-3',
    'screen-arac-ekle', 'screen-arac-ekle-2', 'screen-arac-ekle-3', 'screen-arac-ekle-4',
    'screen-arac-yonetim', 'screen-arac-list',
    'screen-bildirimler', 'screen-destek', 'screen-fatura-detay'
]);

const VehicleBarlessScreens = new Set(['screen-profil']);
const MainTabs = ['screen-home', 'screen-kayitlar', 'screen-ustalar', 'screen-profil'];

let history = ['screen-home'];
let currentNavBtn = null;

// ── Navigate to a screen ──
function navigate(id) {
    const current = history[history.length - 1];
    if (current === id) return;

    const fromEl = document.getElementById(current);
    const toEl = document.getElementById(id);
    if (!fromEl || !toEl) return;

    // Hide FAB if open
    closeFab();
    closeVehicleSwitcher();

    fromEl.classList.remove('active');
    fromEl.classList.add('slide-out');
    setTimeout(() => fromEl.classList.remove('slide-out'), 320);

    toEl.style.transform = 'translateX(30px)';
    toEl.style.opacity = '0';
    toEl.classList.add('active');
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            toEl.style.transform = '';
            toEl.style.opacity = '';
        });
    });

    // Vehicle bar visibility
    const vehicleBar = document.getElementById('vehicleBar');
    if (VehicleBarlessScreens.has(id) || SUB_SCREENS.has(id)) {
        vehicleBar.classList.add('hidden');
    } else {
        vehicleBar.classList.remove('hidden');
    }

    // Bottom nav visibility
    const nav = document.getElementById('bottomNav');
    if (SUB_SCREENS.has(id)) {
        nav.style.display = 'none';
    } else {
        nav.style.display = 'flex';
    }

    history.push(id);
}

// ── Nav tab buttons ──
function navTo(id, btn) {
    // If same tab double-tap, scroll to top
    const current = history[history.length - 1];
    if (current === id) {
        document.querySelector(`#${id} .screen-scroll`)?.scrollTo({ top: 0, behavior: 'smooth' });
        return;
    }

    // Update nav active state
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');

    navigate(id);
}

// ── Go back ──
function goBack() {
    if (history.length <= 1) return;
    const current = history.pop();
    const prev = history[history.length - 1];

    const fromEl = document.getElementById(current);
    const toEl = document.getElementById(prev);
    if (!fromEl || !toEl) return;

    fromEl.classList.remove('active');
    fromEl.style.transform = 'translateX(30px)';
    fromEl.style.opacity = '0';
    setTimeout(() => { fromEl.style.transform = ''; fromEl.style.opacity = ''; }, 320);

    toEl.classList.add('active');

    // Vehicle bar
    const vehicleBar = document.getElementById('vehicleBar');
    if (VehicleBarlessScreens.has(prev) || SUB_SCREENS.has(prev)) {
        vehicleBar.classList.add('hidden');
    } else {
        vehicleBar.classList.remove('hidden');
    }

    // Nav bar
    const nav = document.getElementById('bottomNav');
    if (SUB_SCREENS.has(prev)) {
        nav.style.display = 'none';
    } else {
        nav.style.display = 'flex';
        // Restore active nav button
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        const idx = MainTabs.indexOf(prev);
        if (idx >= 0) {
            const btns = document.querySelectorAll('.nav-btn:not(.nav-btn--fab)');
            if (btns[idx]) btns[idx].classList.add('active');
        }
    }
}

// ── FAB ──
let fabOpen = false;
function toggleFab() {
    fabOpen = !fabOpen;
    const overlay = document.getElementById('fabOverlay');
    overlay.classList.toggle('open', fabOpen);
    const fabIcon = document.querySelector('.fab-inner svg');
    if (fabIcon) {
        fabIcon.style.transform = fabOpen ? 'rotate(45deg)' : 'rotate(0deg)';
        fabIcon.style.transition = 'transform 0.25s ease';
    }
}
function closeFab() {
    if (!fabOpen) return;
    fabOpen = false;
    document.getElementById('fabOverlay').classList.remove('open');
    const fabIcon = document.querySelector('.fab-inner svg');
    if (fabIcon) fabIcon.style.transform = 'rotate(0deg)';
}
function fabGo(id) {
    closeFab();
    setTimeout(() => navigate(id), 50);
}

// ── Vehicle Switcher ──
function openVehicleSwitcher() {
    document.getElementById('vehicleSwitcher').classList.add('open');
}
function closeVehicleSwitcher() {
    document.getElementById('vehicleSwitcher').classList.remove('open');
}
function switchVehicle(el, plate, model) {
    document.querySelector('.vehicle-bar__plate').textContent = plate;
    document.querySelector('.vehicle-bar__model').textContent = model;
    // Update active state in switcher
    document.querySelectorAll('.vehicle-item').forEach(v => v.classList.remove('vehicle-item--active'));
    el.classList.add('vehicle-item--active');
    setTimeout(closeVehicleSwitcher, 300);
}

// ── Tabs (Kayıtlar) ──
function switchTab(btn, contentId) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.getElementById(contentId).classList.add('active');
}

// ── Premium Swipe Engine ──
const SWIPE_THRESHOLD = 80;   // px to trigger action
const SWIPE_UP_THRESHOLD = 60;
const MAX_ROTATION = 15;       // degrees at full drag

let swipeCards = [
    { name: 'AutoPro Servis', initials: 'AP', tags: 'Motor · Elektrik · BMW Uzmanı', rating: '4.8', dist: '2.1km', resp: '~2g', price: '₺1.800 – ₺3.200', note: '"BMW motor arızalarında 8 yıllık deneyim. Teşhis ücretsiz."', badge: '📍 Sana Önerilen', badgeClass: 'badge-algo' },
    { name: 'Engin Oto Elektrik', initials: 'EO', tags: 'Elektrik · Teşhis · Renault', rating: '4.5', dist: '3.4km', resp: '~4g', price: '₺1.200 – ₺2.800', note: '"Tüm marka araçlarda elektronik tanı. 15 yıllık deneyim."', badge: '💬 Sana Teklif Gönderdi', badgeClass: 'badge-teklif' },
    { name: 'Sarıyer Motor', initials: 'SM', tags: 'Motor · Revizyon · Turbo', rating: '4.7', dist: '6.1km', resp: '~1g', price: '₺2.000 – ₺5.000', note: '"Motor revizyonunda 12 yıllık uzmanız."', badge: '⭐ Sponsorlu', badgeClass: 'badge-sponsor' },
];
let currentCardIdx = 0;
let swipeHistory = [];  // for undo

// Touch state
let isDragging = false;
let startX = 0, startY = 0;
let currentX = 0, currentY = 0;
let dragDirection = null; // 'horizontal' | 'vertical' | null

function setCardContent(card, data) {
    if (!card) return;
    const avatar = card.querySelector('.swipe-card__avatar-lg');
    const name = card.querySelector('.swipe-card__name');
    const verify = card.querySelector('.swipe-card__verify');
    const tags = card.querySelector('.swipe-card__tags');
    const stats = card.querySelectorAll('.swipe-stat__val');
    const price = card.querySelector('.swipe-card__price');
    const note = card.querySelector('.swipe-card__note');
    const badgeTag = card.querySelector('.swipe-card__badge-tag');

    if (avatar) avatar.textContent = data.initials;
    if (name) name.textContent = data.name;
    if (verify) verify.textContent = '✓ Doğrulanmış Servis';
    if (tags) tags.textContent = data.tags;
    if (stats[0]) stats[0].textContent = data.rating;
    if (stats[1]) stats[1].textContent = data.dist;
    if (stats[2]) stats[2].textContent = data.resp;
    if (price) price.textContent = 'Tahmini: ' + data.price;
    if (note) note.textContent = data.note;
    if (badgeTag) {
        badgeTag.textContent = data.badge;
        badgeTag.className = 'swipe-card__badge-tag ' + data.badgeClass;
    }
}

// Initialize touch events (works for both touch and mouse)
document.addEventListener('DOMContentLoaded', () => {
    const card = document.getElementById('swipeCard');
    if (!card) return;

    // Touch events
    card.addEventListener('touchstart', onDragStart, { passive: false });
    card.addEventListener('touchmove', onDragMove, { passive: false });
    card.addEventListener('touchend', onDragEnd);

    // Mouse events
    card.addEventListener('mousedown', onDragStart);
    document.addEventListener('mousemove', onDragMove);
    document.addEventListener('mouseup', onDragEnd);
});

function getEventPos(e) {
    if (e.touches && e.touches.length > 0) return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    if (e.changedTouches && e.changedTouches.length > 0) return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
    return { x: e.clientX, y: e.clientY };
}

function onDragStart(e) {
    const card = document.getElementById('swipeCard');
    if (!card) return;
    isDragging = true;
    dragDirection = null;
    const pos = getEventPos(e);
    startX = pos.x;
    startY = pos.y;
    currentX = 0;
    currentY = 0;
    card.style.transition = 'none';
    card.style.cursor = 'grabbing';
}

function onDragMove(e) {
    if (!isDragging) return;
    const pos = getEventPos(e);
    const dx = pos.x - startX;
    const dy = pos.y - startY;

    // Determine direction on first significant movement
    if (!dragDirection) {
        if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
            dragDirection = Math.abs(dy) > Math.abs(dx) && dy < 0 ? 'vertical' : 'horizontal';
        } else return;
    }

    if (dragDirection === 'vertical' && dy < 0) {
        // Swipe up — prevent scroll, show resistance
        e.preventDefault();
        currentY = dy;
        const card = document.getElementById('swipeCard');
        const progress = Math.min(Math.abs(dy) / 150, 1);
        card.style.transform = `translateY(${dy * 0.5}px) scale(${1 - progress * 0.05})`;
        card.style.opacity = 1 - progress * 0.3;
        return;
    }

    // Horizontal drag
    e.preventDefault();
    currentX = dx;
    currentY = 0;

    const card = document.getElementById('swipeCard');
    const rotation = (dx / window.innerWidth) * MAX_ROTATION * 2;
    card.style.transform = `translateX(${dx}px) rotate(${rotation}deg)`;

    // Show directional labels
    const labelNo = document.getElementById('labelNo');
    const labelYes = document.getElementById('labelYes');
    const progress = Math.min(Math.abs(dx) / SWIPE_THRESHOLD, 1);
    if (dx < -20) {
        labelNo.style.opacity = progress;
        labelYes.style.opacity = 0;
    } else if (dx > 20) {
        labelYes.style.opacity = progress;
        labelNo.style.opacity = 0;
    } else {
        labelNo.style.opacity = 0;
        labelYes.style.opacity = 0;
    }
}

function onDragEnd(e) {
    if (!isDragging) return;
    isDragging = false;

    const card = document.getElementById('swipeCard');
    if (!card) return;
    card.style.cursor = '';

    // Hide labels
    const labelNo = document.getElementById('labelNo');
    const labelYes = document.getElementById('labelYes');
    if (labelNo) labelNo.style.opacity = 0;
    if (labelYes) labelYes.style.opacity = 0;

    // Check vertical swipe up
    if (dragDirection === 'vertical' && currentY < -SWIPE_UP_THRESHOLD) {
        card.style.transition = 'transform 0.3s ease, opacity 0.3s ease';
        card.style.transform = '';
        card.style.opacity = '';
        openDetailSheet();
        return;
    }

    // Horizontal threshold check
    if (currentX > SWIPE_THRESHOLD) {
        animateSwipeOut('yes');
    } else if (currentX < -SWIPE_THRESHOLD) {
        animateSwipeOut('no');
    } else {
        // Snap back
        card.style.transition = 'transform 0.35s cubic-bezier(.2,.8,.3,1), opacity 0.35s ease';
        card.style.transform = '';
        card.style.opacity = '';
    }
}

function animateSwipeOut(dir) {
    const card = document.getElementById('swipeCard');
    const tx = dir === 'no' ? '-120%' : '120%';
    const rot = dir === 'no' ? '-25deg' : '25deg';

    card.style.transition = 'transform 0.4s cubic-bezier(.6,.05,.3,.9), opacity 0.4s ease';
    card.style.transform = `translateX(${tx}) rotate(${rot})`;
    card.style.opacity = '0';

    // Save for undo
    swipeHistory.push({ idx: currentCardIdx, action: dir });
    const undoBtn = document.getElementById('undoBtn');
    if (undoBtn) { undoBtn.style.opacity = '1'; undoBtn.style.pointerEvents = 'auto'; }

    setTimeout(() => {
        if (dir === 'yes') {
            showMatch();
        }
        advanceCard(card);
    }, 420);
}

function advanceCard(card) {
    currentCardIdx = (currentCardIdx + 1) % swipeCards.length;
    setCardContent(card, swipeCards[currentCardIdx]);
    card.style.transition = 'none';
    card.style.transform = 'translateY(20px) scale(0.95)';
    card.style.opacity = '0';
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            card.style.transition = 'transform 0.35s cubic-bezier(.2,.8,.3,1), opacity 0.35s ease';
            card.style.transform = '';
            card.style.opacity = '';
        });
    });
}

function swipeAction(dir) {
    if (dir === 'continue') return; // match overlay → keep going
    if (dir === 'star') {
        // Star pulse animation
        const card = document.getElementById('swipeCard');
        card.style.transition = 'transform 0.2s ease';
        card.style.transform = 'scale(1.03)';
        setTimeout(() => {
            card.style.transform = '';
            card.style.transition = '';
        }, 250);
        // TODO: Add to shortlist in backend
        return;
    }
    animateSwipeOut(dir);
}

// ── Undo ──
function undoSwipe() {
    if (swipeHistory.length === 0) return;
    const last = swipeHistory.pop();
    currentCardIdx = last.idx;
    const card = document.getElementById('swipeCard');
    setCardContent(card, swipeCards[currentCardIdx]);
    card.style.transition = 'none';
    card.style.transform = last.action === 'no' ? 'translateX(-120%) rotate(-25deg)' : 'translateX(120%) rotate(25deg)';
    card.style.opacity = '0';
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            card.style.transition = 'transform 0.45s cubic-bezier(.2,.8,.3,1), opacity 0.35s ease';
            card.style.transform = '';
            card.style.opacity = '';
        });
    });
    if (swipeHistory.length === 0) {
        const undoBtn = document.getElementById('undoBtn');
        if (undoBtn) { undoBtn.style.opacity = '0.3'; undoBtn.style.pointerEvents = 'none'; }
    }
}

// ── Detail Sheet (swipe-up) ──
function openDetailSheet() {
    const sheet = document.getElementById('detailSheet');
    if (sheet) sheet.classList.add('open');
}
function closeDetailSheet() {
    const sheet = document.getElementById('detailSheet');
    if (sheet) sheet.classList.remove('open');
}

// ── Match Overlay ──
function showMatch() {
    const data = swipeCards[currentCardIdx];
    const overlay = document.getElementById('matchOverlay');
    const namEl = document.getElementById('matchServisName');
    const ustaEl = document.getElementById('matchUstaName');
    const priceEl = document.getElementById('matchPrice');
    if (namEl) namEl.textContent = data.name;
    if (ustaEl) ustaEl.textContent = data.name;
    if (priceEl) priceEl.textContent = data.price;
    if (overlay) overlay.classList.add('open');
}
function closeMatch() {
    const overlay = document.getElementById('matchOverlay');
    if (overlay) overlay.classList.remove('open');
}

// ── Option card selection toggle ──
document.addEventListener('click', (e) => {
    const optCard = e.target.closest('.option-card');
    if (optCard) {
        optCard.closest('.option-grid')?.querySelectorAll('.option-card').forEach(c => c.classList.remove('selected'));
        optCard.classList.add('selected');
    }
    const optRow = e.target.closest('.option-row');
    if (optRow) {
        optRow.closest('.option-list')?.querySelectorAll('.option-row').forEach(r => {
            r.classList.remove('selected');
            const chk = r.querySelector('.checkmark');
            if (chk) chk.textContent = '';
        });
        optRow.classList.add('selected');
        const chk = optRow.querySelector('.checkmark');
        if (chk) chk.textContent = '✓';
    }
    // Toggle buttons
    const toggleBtn = e.target.closest('.toggle-btn');
    if (toggleBtn) {
        toggleBtn.closest('.toggle-group')?.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
        toggleBtn.classList.add('active');
    }
    // Chips
    const chip = e.target.closest('.chip');
    if (chip) {
        chip.closest('.filter-chips')?.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
    }
    // FAQ toggle
    const faqQ = e.target.closest('.faq-q');
    if (faqQ) {
        const item = faqQ.closest('.faq-item');
        item.classList.toggle('open');
    }
});

// ── Submit flows ──
function submitHasar() {
    document.getElementById('hasarSubmitBtn').style.display = 'none';
    document.getElementById('hasarSuccess').style.display = 'block';
    document.getElementById('hasarSwipeBtn').style.display = 'block';
    document.getElementById('hasarHomeBtn').style.display = 'block';
    // Scroll to success message
    document.getElementById('hasarSuccess').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function submitBakim() {
    document.getElementById('bakimSubmitBtn').style.display = 'none';
    document.getElementById('bakimSuccess').style.display = 'block';
    document.getElementById('bakimSwipeBtn').style.display = 'block';
    document.getElementById('bakimHomeBtn').style.display = 'block';
    document.getElementById('bakimSuccess').scrollIntoView({ behavior: 'smooth', block: 'center' });
}
