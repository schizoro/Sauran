let socket = null;

const STICKERS = [
    { id: 'wave', emoji: '👋' },
    { id: 'thumbsup', emoji: '👍' },
    { id: 'heart', emoji: '❤️' },
    { id: 'laugh', emoji: '😂' },
    { id: 'cry', emoji: '😭' },
    { id: 'fire', emoji: '🔥' },
    { id: 'clap', emoji: '👏' },
    { id: 'party', emoji: '🎉' },
    { id: 'shock', emoji: '😱' },
    { id: 'love-eyes', emoji: '😍' },
    { id: 'thinking', emoji: '🤔' },
    { id: 'sleep', emoji: '😴' },
    { id: 'cool', emoji: '😎' },
    { id: 'wink', emoji: '😉' },
    { id: 'ok', emoji: '👌' },
    { id: 'pray', emoji: '🙏' }
];

// Sauran Plus: hareketli çıkartmalar (emoji + CSS animasyonu). Sunucu tarafı yalnızca aktif Plus'a izin verir.
const PLUS_STICKERS = [
    { id: 'plus-cat', emoji: '🐱' },
    { id: 'plus-dog', emoji: '🐶' },
    { id: 'plus-bunny', emoji: '🐰' },
    { id: 'plus-bear', emoji: '🐻' },
    { id: 'plus-panda', emoji: '🐼' },
    { id: 'plus-fox', emoji: '🦊' },
    { id: 'plus-chick', emoji: '🐥' },
    { id: 'plus-penguin', emoji: '🐧' },
    { id: 'plus-frog', emoji: '🐸' },
    { id: 'plus-unicorn', emoji: '🦄' },
    { id: 'plus-octopus', emoji: '🐙' },
    { id: 'plus-whale', emoji: '🐳' },
    { id: 'plus-donut', emoji: '🍩' },
    { id: 'plus-strawberry', emoji: '🍓' },
    { id: 'plus-teddy', emoji: '🧸' },
    { id: 'plus-star', emoji: '⭐' },
    { id: 'plus-rainbow', emoji: '🌈' },
    { id: 'plus-clover', emoji: '🍀' },
    { id: 'plus-sparkle-heart', emoji: '💖' },
    { id: 'plus-balloon', emoji: '🎈' },
    { id: 'plus-coffee', emoji: '☕' },
    { id: 'plus-pizza', emoji: '🍕' },
    { id: 'plus-cake', emoji: '🎂' },
    { id: 'plus-gamepad', emoji: '🎮' },
    { id: 'plus-bulb', emoji: '💡' },
    { id: 'plus-ghost', emoji: '👻' }
];

function stickerEmoji(id) {
    return STICKERS.find((s) => s.id === id)?.emoji || PLUS_STICKERS.find((s) => s.id === id)?.emoji || '❔';
}

// Sauran Plus çıkartmaları SVG karakter (stickers.js); klasik çıkartmalar emoji olarak kalır.
function stickerInnerHtml(id) {
    if (typeof plusStickerSvg === 'function' && id && id.startsWith('plus-')) {
        const svg = plusStickerSvg(id);
        if (svg) return svg;
    }
    return stickerEmoji(id);
}

// Sunucu /api/me ile kullanıcının açık özelliklerini gönderir (Plus/Premium hepsi, hediye tek özellik).
function userHasFeature(key) {
    return Boolean(currentUser && Array.isArray(currentUser.features) && currentUser.features.includes(key));
}

function stickerIsPlus(id) {
    return Boolean(id && id.startsWith('plus-'));
}

// =====================================================
// UYGULAMAYA ÖZEL BİLDİRİM SESLERİ (Web Audio ile sentezlenir,
// dış ses dosyası gerekmez — mobil + masaüstü aynı şekilde çalışır)
// =====================================================

let notifSoundEnabled = true;
let appAudioCtx = null;

function getAppAudioCtx() {
    if (!appAudioCtx) {
        try {
            appAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
        } catch (error) {
            return null;
        }
    }
    if (appAudioCtx.state === 'suspended') appAudioCtx.resume().catch(() => {});
    return appAudioCtx;
}

function playAppTone(ctx, freq, startTime, duration, type = 'sine', gainPeak = 0.18) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(gainPeak, startTime + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(startTime);
    osc.stop(startTime + duration + 0.03);
}

// Bildirim sesi paketleri (Ayarlar > Bildirimler; herkese açık). Her nota: [frekans, başlangıç gecikmesi (sn), süre (sn), dalga, ses seviyesi].
// 'classic' varsayılan; seçim bu cihazda tutulur.
const SOUND_PACKS = {
    classic: { label: 'Klasik', notif: [[880, 0, .14, 'sine', .2], [1318.5, .09, .18, 'sine', .2]], msg: [[660, 0, .1, 'sine', .15]] },
    crystal: { label: 'Kristal', notif: [[1568, 0, .12, 'triangle', .16], [2093, .08, .14, 'triangle', .16], [2637, .17, .2, 'triangle', .14]], msg: [[1760, 0, .09, 'triangle', .13]] },
    bubble: { label: 'Baloncuk', notif: [[420, 0, .07, 'sine', .22], [640, .07, .09, 'sine', .22]], msg: [[330, 0, .06, 'sine', .2], [480, .05, .07, 'sine', .18]] },
    chime: { label: 'Çan', notif: [[659, 0, .18, 'sine', .16], [831, .1, .18, 'sine', .16], [988, .2, .26, 'sine', .16]], msg: [[988, 0, .14, 'sine', .13]] },
    retro: { label: 'Retro', notif: [[440, 0, .07, 'square', .07], [660, .08, .07, 'square', .07], [880, .16, .1, 'square', .07]], msg: [[520, 0, .06, 'square', .06]] },
    soft: { label: 'Yumuşak', notif: [[523, 0, .3, 'sine', .11], [659, .12, .34, 'sine', .11]], msg: [[440, 0, .18, 'sine', .1]] }
};

function currentSoundPack() {
    let id = 'classic';
    try { id = localStorage.getItem('sauran_sound_pack') || 'classic'; } catch (_) {}
    if (!SOUND_PACKS[id]) id = 'classic';
    return SOUND_PACKS[id];
}

function playSoundPattern(notes) {
    const ctx = getAppAudioCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    notes.forEach(([freq, delay, dur, type, gain]) => playAppTone(ctx, freq, now + delay, dur, type, gain));
}

// Bildirim (arkadaşlık isteği, lobi daveti vb.) sesi.
function playNotifSound() {
    if (!notifSoundEnabled) return;
    playSoundPattern(currentSoundPack().notif);
}

// Gelen mesaj sesi.
function playMessageSound() {
    if (!notifSoundEnabled) return;
    playSoundPattern(currentSoundPack().msg);
}

function renderSoundPackPicker() {
    const picker = document.getElementById('sound-pack-picker');
    const hint = document.getElementById('sound-pack-hint');
    if (!picker) return;
    let active = 'classic';
    try { active = localStorage.getItem('sauran_sound_pack') || 'classic'; } catch (_) {}
    if (!SOUND_PACKS[active]) active = 'classic';
    picker.querySelectorAll('.chat-theme-option').forEach((btn) => {
        btn.disabled = false;
        btn.title = '';
        btn.classList.toggle('selected', btn.dataset.sound === active);
    });
    if (hint) hint.textContent = '';
}

document.getElementById('sound-pack-picker')?.addEventListener('click', (event) => {
    const btn = event.target.closest('.chat-theme-option');
    if (!btn || btn.disabled) return;
    try { localStorage.setItem('sauran_sound_pack', btn.dataset.sound); } catch (_) {}
    renderSoundPackPicker();
    playSoundPattern(SOUND_PACKS[btn.dataset.sound].notif);
});

// Sesli odaya biri katılınca yükselen, ayrılınca alçalan iki notalı kısa ses.
let notifInappEnabled = true;
let notifDesktopEnabled = true;
let notifDmEnabled = true;
let notifHubMessageEnabled = true;
let notifVoicePresenceEnabled = true;
let voiceJoinSoundEnabled = true;

function playVoicePresenceSound(joined) {
    if (!notifSoundEnabled || !voiceJoinSoundEnabled) return;
    const ctx = getAppAudioCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const [first, second] = joined ? [523.25, 783.99] : [659.25, 440];
    playAppTone(ctx, first, now, 0.1, 'sine', 0.13);
    playAppTone(ctx, second, now + 0.08, 0.14, 'sine', 0.13);
}

// Gelen arama için tekrar eden zil sesi (kabul/red/iptal edilene kadar).
let ringtoneIntervalId = null;
function startRingtone() {
    if (!notifSoundEnabled || ringtoneIntervalId) return;
    const ring = () => {
        const ctx = getAppAudioCtx();
        if (!ctx) return;
        const now = ctx.currentTime;
        playAppTone(ctx, 740, now, 0.22, 'sine', 0.22);
        playAppTone(ctx, 740, now + 0.32, 0.22, 'sine', 0.22);
    };
    ring();
    ringtoneIntervalId = setInterval(ring, 1600);
}
function stopRingtone() {
    if (ringtoneIntervalId) {
        clearInterval(ringtoneIntervalId);
        ringtoneIntervalId = null;
    }
}

// =====================================================
// DOM
// =====================================================

const loginScreen =
    document.getElementById('login-screen');

const chatScreen =
    document.getElementById('chat-screen');


// =====================================================
// GİRİŞ
// =====================================================

const loginForm =
    document.getElementById('login-form');

const loginUsernameInput =
    document.getElementById('login-username-input');

const loginPasswordInput =
    document.getElementById('login-password-input');

const loginBtn =
    document.getElementById('login-btn');


// =====================================================
// KAYIT
// =====================================================

const registerForm =
    document.getElementById('register-form');

const registerUsernameInput =
    document.getElementById('register-username-input');

const registerEmailInput =
    document.getElementById('register-email-input');

const registerPasswordInput =
    document.getElementById('register-password-input');

const registerPasswordConfirmInput =
    document.getElementById('register-password-confirm-input');

const registerBirthdateInput =
    document.getElementById('register-birthdate-input');

const registerBtn =
    document.getElementById('register-btn');


// =====================================================
// DOĞRULAMA
// =====================================================

const verifyForm =
    document.getElementById('verify-form');

const verifyEmailLabel =
    document.getElementById('verify-email-label');

const verifyCodeInput =
    document.getElementById('verify-code-input');

const verifyBtn =
    document.getElementById('verify-btn');

const backToRegisterBtn =
    document.getElementById('back-to-register-btn');

let pendingVerifyEmail = '';


// =====================================================
// ŞİFREMİ UNUTTUM
// =====================================================

const showForgotBtn =
    document.getElementById('show-forgot-btn');

const forgotEmailForm =
    document.getElementById('forgot-email-form');

const forgotEmailInput =
    document.getElementById('forgot-email-input');

const forgotEmailBtn =
    document.getElementById('forgot-email-btn');

const backToLoginFromForgotBtn =
    document.getElementById('back-to-login-from-forgot-btn');

const forgotResetForm =
    document.getElementById('forgot-reset-form');

const forgotEmailLabel =
    document.getElementById('forgot-email-label');

const forgotCodeInput =
    document.getElementById('forgot-code-input');

const forgotNewPasswordInput =
    document.getElementById('forgot-new-password-input');

const forgotResetBtn =
    document.getElementById('forgot-reset-btn');

const backToLoginFromResetBtn =
    document.getElementById('back-to-login-from-reset-btn');

let pendingResetEmail = '';


// =====================================================
// GEÇİŞ
// =====================================================

const showRegisterBtn =
    document.getElementById('show-register-btn');

const showLoginBtn =
    document.getElementById('show-login-btn');


// =====================================================
// BAŞLIK / HATA
// =====================================================

const authTitle =
    document.getElementById('auth-title');

const authError =
    document.getElementById('auth-error');


// =====================================================
// ÇEVRİMİÇİ / ARKADAŞLAR MODALI
// =====================================================

const usersModal =
    document.getElementById('users-modal');

const usersModalTitle =
    document.getElementById('users-modal-title');

const usersList =
    document.getElementById('users-list');

const usersListSubtitle =
    document.getElementById('users-list-subtitle');

const closeModalBtn =
    document.getElementById('close-modal-btn');

const friendRequestsSection =
    document.getElementById('friend-requests-section');

const friendRequestsList =
    document.getElementById('friend-requests-list');

const topFriendsSection =
    document.getElementById('top-friends-section');

const topFriendsList =
    document.getElementById('top-friends-list');


// =====================================================
// ÜST BAR HAMBURGER MENÜSÜ
// =====================================================

const topbarMenuBtn = document.getElementById('topbar-menu-btn');
const topbarMenuDropdown = document.getElementById('topbar-menu-dropdown');
const topbarMenuBadge = document.getElementById('topbar-menu-badge');

topbarMenuBtn.addEventListener('click', (event) => {
    event.stopPropagation();
    const isOpen = topbarMenuDropdown.style.display === 'flex';
    topbarMenuDropdown.style.display = isOpen ? 'none' : 'flex';
});

document.addEventListener('click', (event) => {
    if (topbarMenuDropdown.style.display === 'flex' &&
        !topbarMenuDropdown.contains(event.target) &&
        event.target !== topbarMenuBtn) {
        topbarMenuDropdown.style.display = 'none';
    }
});

topbarMenuDropdown.querySelectorAll('.topbar-menu-item').forEach((btn) => {
    btn.addEventListener('click', () => {
        topbarMenuDropdown.style.display = 'none';
    });
});


// =====================================================
// ARKADAŞ EKLE (AYRI MODAL)
// =====================================================

const friendAddOpenBtn =
    document.getElementById('friend-add-open-btn');

const friendAddModal =
    document.getElementById('friend-add-modal');

const friendAddCloseBtn =
    document.getElementById('friend-add-close-btn');

const friendAddInput =
    document.getElementById('friend-add-input');

const friendAddBtn =
    document.getElementById('friend-add-btn');

const friendAddError =
    document.getElementById('friend-add-error');


// =====================================================
// BİLDİRİMLER
// =====================================================

const notificationsBtn =
    document.getElementById('notifications-btn');

const notificationsBadge =
    document.getElementById('notifications-badge');

const notificationsModal =
    document.getElementById('notifications-modal');

const notificationsCloseBtn =
    document.getElementById('notifications-close-btn');

const notificationsList =
    document.getElementById('notifications-list');


// =====================================================
// ÖNERİ & GÖRÜŞ
// =====================================================

const feedbackOpenBtn =
    document.getElementById('feedback-open-btn');

const feedbackModal =
    document.getElementById('feedback-modal');

const feedbackCloseBtn =
    document.getElementById('feedback-close-btn');

const feedbackTitleInput =
    document.getElementById('feedback-title-input');

const feedbackBodyInput =
    document.getElementById('feedback-body-input');

const feedbackFormError =
    document.getElementById('feedback-form-error');

const feedbackSubmitBtn =
    document.getElementById('feedback-submit-btn');

const feedbackSortTopBtn =
    document.getElementById('feedback-sort-top');

const feedbackSortNewBtn =
    document.getElementById('feedback-sort-new');

const feedbackList =
    document.getElementById('feedback-list');

let feedbackCurrentSort = 'top';


// =====================================================
// BAŞKASININ PROFİLİ
// =====================================================

const otherProfileModal =
    document.getElementById('other-profile-modal');

const closeOtherProfileBtn =
    document.getElementById('close-other-profile-btn');

const otherProfileAvatar =
    document.getElementById('other-profile-avatar');

const otherProfileAvatarImg =
    document.getElementById('other-profile-avatar-img');

const otherProfileStatusDot =
    document.getElementById('other-profile-status-dot');

const otherProfileUsername =
    document.getElementById('other-profile-username');

const otherProfileStatusLabel =
    document.getElementById('other-profile-status-label');

const otherProfileActions =
    document.getElementById('other-profile-actions');


// =====================================================
// DM PANELİ
// =====================================================

const dmModal =
    document.getElementById('dm-modal');

const dmModalTitle =
    document.getElementById('dm-modal-title');

const dmCloseBtn =
    document.getElementById('dm-close-btn');

const dmFeed =
    document.getElementById('dm-feed');

const dmForm =
    document.getElementById('dm-form');

const dmMessageInput =
    document.getElementById('dm-message-input');

const dmVoiceBtn =
    document.getElementById('dm-voice-btn');

const dmCallBtn =
    document.getElementById('dm-call-btn');

let activeDmUserId = null;
let activeDmUsername = '';
// Hesabı silinmiş kişilerle korunmuş (salt okunur) sohbetler
let deletedDmThreads = [];
let dmReadOnly = false;

wireAttachMenu('dm', async (file) => {

    const fileData = await handleAttachedFile(file);
    if (!fileData || !activeDmUserId || !socket) return;

    socket.emit('dm_file_message', { to_user_id: activeDmUserId, file: fileData });

});

wireStickerPicker('dm', (stickerId) => {
    if (!activeDmUserId || !socket) return;
    socket.emit('dm_sticker_message', { to_user_id: activeDmUserId, sticker_id: stickerId });
});


// =====================================================
// PROFİL
// =====================================================

const profileBtn =
    document.getElementById('profile-btn');

const profileAvatar =
    document.getElementById('profile-avatar');

const profileAvatarImg =
    document.getElementById('profile-avatar-img');

const sidebarStatusDot =
    document.getElementById('sidebar-status-dot');

const profileUsername =
    document.getElementById('profile-username');

const profileModal =
    document.getElementById('profile-modal');

const profileModalAvatar =
    document.getElementById('profile-modal-avatar');

const profileModalAvatarImg =
    document.getElementById('profile-modal-avatar-img');

const profileModalUsername =
    document.getElementById('profile-modal-username');

const closeProfileModalBtn =
    document.getElementById('close-profile-modal-btn');

const logoutBtn =
    document.getElementById('logout-btn');


// =====================================================
// PROFİL — KULLANICI ADI DÜZENLEME
// =====================================================

const usernameView =
    document.getElementById('username-view');

const usernameEditBtn =
    document.getElementById('username-edit-btn');

const usernameEdit =
    document.getElementById('username-edit');

const usernameEditInput =
    document.getElementById('username-edit-input');

const usernameSaveBtn =
    document.getElementById('username-save-btn');

const usernameCancelBtn =
    document.getElementById('username-cancel-btn');

const usernameEditError =
    document.getElementById('username-edit-error');


// =====================================================
// PROFİL — AVATAR DEĞİŞTİRME
// =====================================================

const avatarChangeBtn =
    document.getElementById('avatar-change-btn');

const avatarRemoveBtn =
    document.getElementById('avatar-remove-btn');

const avatarFileInput =
    document.getElementById('avatar-file-input');

const avatarMoreBtn = document.getElementById('avatar-more-btn');
const avatarMoreMenu = document.getElementById('avatar-more-menu');

avatarMoreBtn?.addEventListener('click', (event) => {
    event.stopPropagation();
    avatarMoreMenu.style.display = avatarMoreMenu.style.display === 'flex' ? 'none' : 'flex';
});

document.addEventListener('click', () => { if (avatarMoreMenu) avatarMoreMenu.style.display = 'none'; });


// =====================================================
// PROFİL — DURUM
// =====================================================

const statusDotBtn =
    document.getElementById('status-dot-btn');

const statusDropdown =
    document.getElementById('status-dropdown');

const statusLabel =
    document.getElementById('status-label');

const statusOptionButtons =
    document.querySelectorAll('.status-option');

const statusLabelBtn = document.getElementById('status-label-btn');
statusLabelBtn?.addEventListener('click', (event) => {
    event.stopPropagation();
    statusDropdown.style.display = statusDropdown.style.display === 'flex' ? 'none' : 'flex';
});


// =====================================================
// AYARLAR
// =====================================================

const settingsBtn =
    document.getElementById('settings-btn');

const settingsModal =
    document.getElementById('settings-modal');

const settingsCloseBtn =
    document.getElementById('settings-close-btn');

const themeButtons =
    document.querySelectorAll('[data-theme]');

const langButtons =
    document.querySelectorAll('[data-lang]');

const settingsCurrentPassword =
    document.getElementById('settings-current-password');

const settingsNewPassword =
    document.getElementById('settings-new-password');

const settingsPasswordError =
    document.getElementById('settings-password-error');

const settingsPasswordBtn =
    document.getElementById('settings-password-btn');


// =====================================================
// DURUM TANIMLARI
// =====================================================

const STATUS_INFO = {
    active: { label: 'Aktif', className: 'status-active' },
    idle: { label: 'Takılıyor', className: 'status-idle' },
    busy: { label: 'Meşgul', className: 'status-busy' },
    invisible: { label: 'Gizli', className: 'status-invisible' }
};

const STATUS_CLASS_NAMES = ['status-active', 'status-idle', 'status-busy', 'status-invisible'];


// =====================================================
// KULLANICI
// =====================================================

let currentUser = null;
let currentUsername = '';


// =====================================================
// KULLANICI RENKLERİ
// =====================================================

const USER_COLORS = [
    '#5cc8ff',
    '#ff6b6b',
    '#ffd93d',
    '#6bcb77',
    '#c77dff',
    '#ff9f43',
    '#74b9ff',
    '#fd79a8',
    '#a29bfe',
    '#55efc4'
];


function getUserColor(username) {

    let hash = 0;

    for (
        let i = 0;
        i < username.length;
        i++
    ) {

        hash =
            username.charCodeAt(i) +
            ((hash << 5) - hash);

    }

    const index =
        Math.abs(hash) %
        USER_COLORS.length;

    return USER_COLORS[index];
}


// =====================================================
// AUTH HATA MESAJI
// =====================================================

function showAuthError(message) {

    authError.textContent = message;

    authError.style.display =
        'block';

}


function clearAuthError() {

    authError.textContent =
        '';

    authError.style.display =
        'none';

    const suspendedBox = document.getElementById('auth-suspended');
    if (suspendedBox) suspendedBox.style.display = 'none';

}


// =====================================================
// GİRİŞ / KAYIT EKRANI
// =====================================================

// Başlığı harf harf, dalga gibi sırayla beliren <span>'lara böler.
// prefers-reduced-motion'da düz metin olarak kalır.
const authTitlePrefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function setAuthTitle(text) {

    if (authTitlePrefersReducedMotion) {
        authTitle.textContent = text;
        return;
    }

    authTitle.innerHTML = '';

    [...text].forEach((char, i) => {
        const span = document.createElement('span');
        span.className = 'title-char';
        span.textContent = char === ' ' ? ' ' : char;
        span.style.animationDelay = `${0.15 + i * 0.032}s`;
        authTitle.appendChild(span);
    });

}

// Oturum kontrolü bitti: giriş ekranı gizleme ipucu kaldırılır. hasSession: yalnızca gerçekten oturum varsa ipucu saklanır.
function finishAuthPending(hasSession) {
    document.documentElement.classList.remove('auth-pending');
    try {
        if (hasSession) localStorage.setItem('sauran_session_hint', '1');
        else localStorage.removeItem('sauran_session_hint');
    } catch (_) { /* yoksay */ }
}

function showLoginForm() {

    finishAuthPending(false);
    clearAuthError();

    setAuthTitle(
        "Sauran'a Hoş Geldin"
    );

    loginForm.style.display =
        'block';

    registerForm.style.display =
        'none';

    verifyForm.style.display =
        'none';

    forgotEmailForm.style.display =
        'none';

    forgotResetForm.style.display =
        'none';

    loginBtn.disabled = false;
    loginBtn.classList.remove('is-loading', 'is-success');

    loginUsernameInput.focus();

}


function showRegisterForm() {

    clearAuthError();

    setAuthTitle(
        "Sauran'a Katıl"
    );

    loginForm.style.display =
        'none';

    registerForm.style.display =
        'block';

    verifyForm.style.display =
        'none';

    forgotEmailForm.style.display =
        'none';

    forgotResetForm.style.display =
        'none';

    registerUsernameInput.focus();

}


function showForgotEmailForm() {

    clearAuthError();

    setAuthTitle(
        'Şifremi Unuttum'
    );

    loginForm.style.display =
        'none';

    registerForm.style.display =
        'none';

    verifyForm.style.display =
        'none';

    forgotResetForm.style.display =
        'none';

    forgotEmailForm.style.display =
        'block';

    forgotEmailInput.value =
        '';

    forgotEmailInput.focus();

}


function showForgotResetForm(email) {

    clearAuthError();

    pendingResetEmail = email;

    setAuthTitle(
        'Şifreyi Sıfırla'
    );

    forgotEmailForm.style.display =
        'none';

    forgotResetForm.style.display =
        'block';

    forgotEmailLabel.textContent =
        email;

    forgotCodeInput.value =
        '';

    forgotNewPasswordInput.value =
        '';

    forgotCodeInput.focus();

}


showForgotBtn.addEventListener(
    'click',
    showForgotEmailForm
);


backToLoginFromForgotBtn.addEventListener(
    'click',
    showLoginForm
);


backToLoginFromResetBtn.addEventListener(
    'click',
    showLoginForm
);


forgotEmailBtn.addEventListener(
    'click',
    async () => {

        const email = forgotEmailInput.value.trim();

        if (!email) {
            showAuthError('E-posta adresini gir.');
            return;
        }

        forgotEmailBtn.disabled = true;
        forgotEmailBtn.textContent = 'Gönderiliyor...';

        try {

            const response = await fetch('/api/password-reset/request', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                showAuthError(data.error || 'İstek gönderilemedi.');
                return;
            }

            showForgotResetForm(email);

        } catch (error) {

            console.error('Şifre sıfırlama isteği hatası:', error);
            showAuthError('Sunucuya bağlanılamadı.');

        } finally {

            forgotEmailBtn.disabled = false;
            forgotEmailBtn.textContent = 'Kod Gönder';

        }

    }
);


forgotResetBtn.addEventListener(
    'click',
    async () => {

        const code = forgotCodeInput.value.trim();
        const newPassword = forgotNewPasswordInput.value;

        if (!code || !newPassword) {
            showAuthError('Kodu ve yeni şifreni gir.');
            return;
        }

        forgotResetBtn.disabled = true;
        forgotResetBtn.textContent = 'Sıfırlanıyor...';

        try {

            const response = await fetch('/api/password-reset/confirm', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: pendingResetEmail, code, new_password: newPassword })
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                showAuthError(data.error || 'Sıfırlanamadı.');
                return;
            }

            showLoginForm();
            showAuthError('Şifren güncellendi, şimdi giriş yapabilirsin.');

        } catch (error) {

            console.error('Şifre sıfırlama onay hatası:', error);
            showAuthError('Sunucuya bağlanılamadı.');

        } finally {

            forgotResetBtn.disabled = false;
            forgotResetBtn.textContent = 'Şifreyi Sıfırla';

        }

    }
);


function showVerifyForm(email) {

    clearAuthError();

    pendingVerifyEmail =
        email;

    setAuthTitle(
        'E-postanı Doğrula'
    );

    verifyEmailLabel.textContent =
        email;

    loginForm.style.display =
        'none';

    registerForm.style.display =
        'none';

    verifyForm.style.display =
        'block';

    forgotEmailForm.style.display =
        'none';

    forgotResetForm.style.display =
        'none';

    verifyCodeInput.value =
        '';

    verifyCodeInput.focus();

}


// =====================================================
// GİRİŞ / KAYIT GEÇİŞLERİ
// =====================================================

showRegisterBtn.addEventListener(
    'click',
    showRegisterForm
);


showLoginBtn.addEventListener(
    'click',
    showLoginForm
);


// =====================================================
// GİRİŞ EKRANI ARKA PLAN PARTİKÜLLERİ (hafif, yavaş, tema renkli)
// =====================================================

(function initLoginParticles() {

    const canvas = document.getElementById('login-particles');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    let particles = [];
    let width = 0;
    let height = 0;
    let rafId = null;

    function accentColor() {
        return getComputedStyle(document.body).getPropertyValue('--accent').trim() || '#5cc8ff';
    }

    function resize() {
        const w = canvas.offsetWidth;
        const h = canvas.offsetHeight;
        if (!w || !h || (w === width && h === height)) return;
        width = canvas.width = w;
        height = canvas.height = h;
        const count = width < 480 ? 26 : 42;
        particles = Array.from({ length: count }, () => ({
            x: Math.random() * width,
            y: Math.random() * height,
            r: 0.6 + Math.random() * 1.8,
            vx: (Math.random() - 0.5) * 0.12,
            vy: -0.06 - Math.random() * 0.14,
            o: 0.15 + Math.random() * 0.35
        }));
    }

    function tick() {

        rafId = requestAnimationFrame(tick);

        // Ekran görünür değilse (giriş yapılmış, sohbet açık) gereksiz çizim yapma.
        if (canvas.offsetParent === null) return;

        // offsetParent null iken boyut değişmiş olabilir (ör. logout ile tekrar
        // görünür oldu) — her karede ucuz bir boyut kontrolü yapıp gerekirse
        // yeniden boyutlandır, ResizeObserver'a bağımlı kalmadan sağlam çalışsın.
        resize();

        ctx.clearRect(0, 0, width, height);
        const color = accentColor();

        particles.forEach((p) => {
            p.x += p.vx;
            p.y += p.vy;
            if (p.y < -4) { p.y = height + 4; p.x = Math.random() * width; }
            if (p.x < -4) p.x = width + 4;
            if (p.x > width + 4) p.x = -4;

            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fillStyle = color;
            ctx.globalAlpha = p.o;
            ctx.fill();
        });

        ctx.globalAlpha = 1;

    }

    window.addEventListener('resize', resize);
    resize();
    tick();

})();


// =====================================================
// GİRİŞ FORMU
// =====================================================

loginBtn.addEventListener(
    'click',
    login
);


loginPasswordInput.addEventListener(
    'keypress',
    (event) => {

        if (event.key === 'Enter') {

            login();

        }

    }
);


loginUsernameInput.addEventListener(
    'keypress',
    (event) => {

        if (event.key === 'Enter') {

            loginPasswordInput.focus();

        }

    }
);


// =====================================================
// GİRİŞ API
// =====================================================

// ─── Girişte ikinci adım (2FA) ───
let login2faChallenge = null;
let login2faRecovery = false;

function showLogin2faStep(challenge) {
    login2faChallenge = challenge;
    login2faRecovery = false;
    document.querySelectorAll('#login-form > .field-float, #login-btn, #login-form > .auth-switch').forEach((el) => { el.style.display = 'none'; });
    document.getElementById('login-2fa-step').style.display = 'flex';
    syncLogin2faMode();
    const input = document.getElementById('login-2fa-input');
    input.value = '';
    setTimeout(() => input.focus(), 30);
}

function hideLogin2faStep() {
    login2faChallenge = null;
    document.querySelectorAll('#login-form > .field-float, #login-btn, #login-form > .auth-switch').forEach((el) => { el.style.display = ''; });
    document.getElementById('login-2fa-step').style.display = 'none';
    clearAuthError();
}

function syncLogin2faMode() {
    const input = document.getElementById('login-2fa-input');
    document.getElementById('login-2fa-text').textContent = login2faRecovery
        ? 'Kurtarma kodlarından birini gir (ör. abcd-efgh). Her kod bir kez kullanılabilir.'
        : 'Doğrulayıcı uygulamandaki 6 haneli kodu gir.';
    document.getElementById('login-2fa-label').textContent = login2faRecovery ? 'Kurtarma kodu' : 'Doğrulama kodu';
    document.getElementById('login-2fa-recovery-toggle').textContent = login2faRecovery ? 'Uygulama kodu kullan' : 'Kurtarma kodu kullan';
    input.inputMode = login2faRecovery ? 'text' : 'numeric';
    input.autocomplete = login2faRecovery ? 'off' : 'one-time-code';
}

async function submitLogin2fa() {
    const input = document.getElementById('login-2fa-input');
    const btn = document.getElementById('login-2fa-btn');
    const code = input.value.trim();
    if (!code || !login2faChallenge) return;
    clearAuthError();
    btn.disabled = true;
    try {
        const response = await fetch('/api/login/2fa', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
            body: JSON.stringify({ challenge: login2faChallenge, code })
        });
        const data = await response.json();
        if (!data.success) {
            showAuthError(data.error || 'Kod doğru değil.');
            if (data.expired) hideLogin2faStep();
            input.select();
            return;
        }
        if (data.recovery_used) {
            alert(`Bir kurtarma kodu kullandın. Kalan kurtarma kodu: ${data.recovery_remaining}. Azaldıysa Ayarlar > Güvenlik'ten yenile.`);
        }
        login2faChallenge = null;
        setCurrentUser(data.user);
        connectToChat();
    } catch (error) {
        showAuthError('Sunucuya bağlanılamadı.');
    } finally {
        btn.disabled = false;
    }
}

document.getElementById('login-2fa-btn').addEventListener('click', submitLogin2fa);
document.getElementById('login-2fa-input').addEventListener('keydown', (event) => { if (event.key === 'Enter') submitLogin2fa(); });
document.getElementById('login-2fa-input').addEventListener('input', (event) => {
    // Uygulama kodunda 6 hane tamamlanınca otomatik doğrula.
    if (!login2faRecovery && /^\d{6}$/.test(event.target.value.trim())) submitLogin2fa();
});
document.getElementById('login-2fa-recovery-toggle').addEventListener('click', () => {
    login2faRecovery = !login2faRecovery;
    syncLogin2faMode();
    document.getElementById('login-2fa-input').value = '';
    document.getElementById('login-2fa-input').focus();
});
document.getElementById('login-2fa-back').addEventListener('click', hideLogin2faStep);

async function login() {

    clearAuthError();

    const username =
        loginUsernameInput.value.trim();

    const password =
        loginPasswordInput.value;


    if (!username) {

        showAuthError(
            'Kullanıcı adını gir.'
        );

        return;

    }


    if (!password) {

        showAuthError(
            'Şifreni gir.'
        );

        return;

    }


    loginBtn.disabled = true;
    loginBtn.classList.add('is-loading');

    let loggedIn = false;

    try {

        const response =
            await fetch(
                '/api/login',
                {
                    method: 'POST',

                    headers: {
                        'Content-Type':
                            'application/json'
                    },

                    credentials: 'include',

                    body: JSON.stringify({
                        username,
                        password
                    })
                }
            );


        const data =
            await response.json();


        if (data.requires_2fa) {
            showLogin2faStep(data.challenge);
            return;
        }

        if (
            !response.ok ||
            !data.success
        ) {

            if (response.status === 403 && data.suspended) {
                showSuspensionNotice(data.suspension && data.suspension.user_reason);
                return;
            }

            showAuthError(
                data.error ||
                'Giriş yapılamadı.'
            );

            return;

        }


        setCurrentUser(
            data.user
        );

        loggedIn = true;
        loginBtn.classList.remove('is-loading');
        loginBtn.classList.add('is-success');

        // Başarı animasyonunun görünmesi için kısa bir an bekleyip sohbete geç.
        await new Promise((resolve) => setTimeout(resolve, 450));

        connectToChat();


    } catch (error) {

        console.error(
            'Giriş hatası:',
            error
        );

        showAuthError(
            'Sunucuya bağlanılamadı.'
        );

    } finally {

        if (!loggedIn) {
            loginBtn.disabled = false;
            loginBtn.classList.remove('is-loading');
        }

    }

}


// =====================================================
// KAYIT FORMU
// =====================================================

registerBtn.addEventListener(
    'click',
    register
);


registerPasswordConfirmInput.addEventListener(
    'keypress',
    (event) => {

        if (event.key === 'Enter') {

            register();

        }

    }
);


// =====================================================
// KAYIT API
// =====================================================

async function register() {

    clearAuthError();

    const username =
        registerUsernameInput.value.trim();

    const email =
        registerEmailInput.value.trim();

    const password =
        registerPasswordInput.value;

    const passwordConfirm =
        registerPasswordConfirmInput.value;

    const birthDate =
        registerBirthdateInput.value;


    if (!username) {

        showAuthError(
            'Kullanıcı adını gir.'
        );

        return;

    }


    if (!email) {

        showAuthError(
            'E-posta adresini gir.'
        );

        return;

    }


    if (!password) {

        showAuthError(
            'Şifre oluştur.'
        );

        return;

    }


    if (password.length < 8) {

        showAuthError(
            'Şifre en az 8 karakter olmalı.'
        );

        return;

    }


    if (password !== passwordConfirm) {

        showAuthError(
            'Şifreler eşleşmiyor.'
        );

        return;

    }


    if (!birthDate) {

        showAuthError(
            'Doğum tarihini gir.'
        );

        return;

    }


    openTermsModal({ username, email, password, birthDate });

}


async function submitRegistration({ username, email, password, birthDate }) {

    registerBtn.disabled =
        true;

    registerBtn.textContent =
        'Hesap oluşturuluyor...';


    try {

        const response =
            await fetch(
                '/api/register',
                {
                    method: 'POST',

                    headers: {
                        'Content-Type':
                            'application/json'
                    },

                    credentials: 'include',

                    body: JSON.stringify({
                        username,
                        email,
                        password,
                        birth_date: birthDate,
                        terms_accepted: true
                    })
                }
            );


        const data =
            await response.json();


        if (
            !response.ok ||
            !data.success
        ) {

            showAuthError(
                data.error ||
                'Kayıt oluşturulamadı.'
            );

            return;

        }


        showVerifyForm(
            data.email
        );


    } catch (error) {

        console.error(
            'Kayıt hatası:',
            error
        );

        showAuthError(
            'Sunucuya bağlanılamadı.'
        );

    } finally {

        registerBtn.disabled =
            false;

        registerBtn.textContent =
            'Kayıt Ol';

    }

}


// =====================================================
// KULLANIM ŞARTLARI / GİZLİLİK ONAY MODALI
// =====================================================

const termsModal = document.getElementById('terms-modal');
const termsModalBody = document.getElementById('terms-modal-body');
const termsModalContent = document.getElementById('terms-modal-content');
const termsModalCloseBtn = document.getElementById('terms-modal-close-btn');
const termsAcceptBtn = document.getElementById('terms-accept-btn');

let termsModalHtmlCache = null;
let pendingRegistration = null;

async function loadTermsModalContent() {

    if (termsModalHtmlCache) return termsModalHtmlCache;

    const [termsPage, privacyPage] = await Promise.all([
        fetch('kullanim-sartlari.html').then(r => r.text()),
        fetch('gizlilik-politikasi.html').then(r => r.text())
    ]);

    const extractWrap = (html) => {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const wrap = doc.querySelector('.legal-wrap');
        if (!wrap) return '';
        wrap.querySelector('.legal-back')?.remove();
        return wrap.innerHTML;
    };

    termsModalHtmlCache = `${extractWrap(termsPage)}<hr>${extractWrap(privacyPage)}`;
    return termsModalHtmlCache;

}

async function openTermsModal(formValues) {

    pendingRegistration = formValues;

    termsAcceptBtn.disabled = true;
    termsModalContent.textContent = 'Yükleniyor…';
    termsModal.style.display = 'flex';
    termsModalBody.scrollTop = 0;

    try {
        termsModalContent.innerHTML = await loadTermsModalContent();
    } catch {
        termsModalContent.textContent = 'Metin yüklenemedi. Lütfen tekrar dene.';
    }

    checkTermsScrollPosition();

}

function checkTermsScrollPosition() {
    const atBottom = termsModalBody.scrollTop + termsModalBody.clientHeight >= termsModalBody.scrollHeight - 8;
    if (atBottom) termsAcceptBtn.disabled = false;
}

termsModalBody.addEventListener('scroll', checkTermsScrollPosition);

termsModalCloseBtn.addEventListener('click', () => {
    termsModal.style.display = 'none';
    pendingRegistration = null;
});

termsModal.addEventListener('click', (event) => {
    if (event.target === termsModal) {
        termsModal.style.display = 'none';
        pendingRegistration = null;
    }
});

termsAcceptBtn.addEventListener('click', () => {
    if (termsAcceptBtn.disabled || !pendingRegistration) return;
    termsModal.style.display = 'none';
    const formValues = pendingRegistration;
    pendingRegistration = null;
    submitRegistration(formValues);
});


// =====================================================
// DOĞRULAMA GEÇİŞLERİ
// =====================================================

verifyBtn.addEventListener(
    'click',
    verify
);


verifyCodeInput.addEventListener(
    'keypress',
    (event) => {

        if (event.key === 'Enter') {

            verify();

        }

    }
);


backToRegisterBtn.addEventListener(
    'click',
    showRegisterForm
);


// =====================================================
// DOĞRULAMA API
// =====================================================

async function verify() {

    clearAuthError();

    const code =
        verifyCodeInput.value.trim();


    if (!code) {

        showAuthError(
            'Doğrulama kodunu gir.'
        );

        return;

    }


    verifyBtn.disabled =
        true;

    verifyBtn.textContent =
        'Doğrulanıyor...';


    try {

        const response =
            await fetch(
                '/api/verify',
                {
                    method: 'POST',

                    headers: {
                        'Content-Type':
                            'application/json'
                    },

                    credentials: 'include',

                    body: JSON.stringify({
                        email: pendingVerifyEmail,
                        code
                    })
                }
            );


        const data =
            await response.json();


        if (
            !response.ok ||
            !data.success
        ) {

            showAuthError(
                data.error ||
                'Doğrulama başarısız.'
            );

            return;

        }


        setCurrentUser(
            data.user
        );


        connectToChat();


    } catch (error) {

        console.error(
            'Doğrulama hatası:',
            error
        );

        showAuthError(
            'Sunucuya bağlanılamadı.'
        );

    } finally {

        verifyBtn.disabled =
            false;

        verifyBtn.textContent =
            'Doğrula';

    }

}


// =====================================================
// KULLANICIYI AYARLA
// =====================================================

// Sadece bir GÖRÜNÜRLÜK kolaylığı — asıl yetki kontrolü sunucuda (requirePlatformRole).
// user.platform_role sunucudan ETKİN rol olarak gelir (kabul bekleyen görev sayılmaz).
function applyAdminLinkVisibility(user) {
    const adminLink = document.getElementById('admin-panel-link');
    if (adminLink) {
        const role = user.platform_role;
        adminLink.style.display = (role === 'moderator' || role === 'admin' || role === 'founder') ? 'flex' : 'none';
        adminLink.setAttribute('href', role === 'moderator' ? 'moderation.html' : 'admin.html');
    }
    const giftLink = document.getElementById('gift-tool-link');
    if (giftLink) giftLink.style.display = user.platform_role === 'founder' ? 'flex' : 'none';
}


// ─── iPhone: "Ana Ekrana Ekle" yönergesi ── Safari'de (ana ekrandan açılmamış) iPhone/iPad kullanıcısına, oturum açtıktan
// birkaç saniye sonra bir kez gösterilir. "Anladım" 14 gün, "Bir daha gösterme" kalıcı susturur. Yerel uygulamada hiç çıkmaz.
const A2HS_KEY = 'sauran_a2hs';
var a2hsScheduled = false;

function a2hsEnvironment() {
    const ua = navigator.userAgent || '';
    const isIos = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    if (!isIos) return null;
    if (window.Capacitor?.isNativePlatform?.()) return null;
    const standalone = navigator.standalone === true || Boolean(window.matchMedia?.('(display-mode: standalone)').matches);
    if (standalone) return null;
    // Instagram, Facebook, TikTok, X vb. uygulama içi tarayıcılar ana ekrana ekleyemez: önce Safari'de açılmalı.
    const inApp = /FBAN|FBAV|Instagram|Line\/|Twitter|TikTok|musical_ly|Snapchat|GSA\//i.test(ua);
    return { inApp };
}

function a2hsShouldShow() {
    try {
        const v = JSON.parse(localStorage.getItem(A2HS_KEY) || 'null');
        if (v?.never) return false;
        if (v?.until && Date.now() < v.until) return false;
    } catch (_) { /* yoksay */ }
    return true;
}

function a2hsRemember(value) {
    try { localStorage.setItem(A2HS_KEY, JSON.stringify(value)); } catch (_) { /* yoksay */ }
}

function maybeShowA2hs(force = false) {
    const env = a2hsEnvironment();
    if (!force && (!env || !a2hsShouldShow())) return;
    const modal = document.getElementById('a2hs-modal');
    document.getElementById('a2hs-steps-safari').style.display = env?.inApp ? 'none' : '';
    document.getElementById('a2hs-steps-inapp').style.display = env?.inApp ? '' : 'none';
    modal.style.display = 'flex';
}

function scheduleA2hs() {
    if (a2hsScheduled || !a2hsEnvironment() || !a2hsShouldShow()) return;
    a2hsScheduled = true;
    // Başka bir pencere (sesli arama, ayar, bildirim izni…) açıksa onu bölmesin: biraz bekleyip yeniden dener.
    const tryShow = (attempt) => {
        const busy = callMode || [...document.querySelectorAll('.modal-overlay, .hubset-screen')].some((el) => el.style.display === 'flex');
        if (busy && attempt < 6) { setTimeout(() => tryShow(attempt + 1), 20000); return; }
        if (!busy) maybeShowA2hs();
    };
    setTimeout(() => tryShow(0), 4000);
}

{
    const btn = document.getElementById('settings-a2hs-btn');
    if (btn && a2hsEnvironment()) btn.style.display = 'flex';
    btn?.addEventListener('click', () => maybeShowA2hs(true));
}

document.getElementById('a2hs-ok-btn').addEventListener('click', () => {
    a2hsRemember({ until: Date.now() + 14 * 86400000 });
    document.getElementById('a2hs-modal').style.display = 'none';
});
document.getElementById('a2hs-close-btn').addEventListener('click', () => {
    a2hsRemember({ until: Date.now() + 14 * 86400000 });
    document.getElementById('a2hs-modal').style.display = 'none';
});
document.getElementById('a2hs-never-btn').addEventListener('click', () => {
    a2hsRemember({ never: true });
    document.getElementById('a2hs-modal').style.display = 'none';
});

function setCurrentUser(user) {

    currentUser =
        user;

    finishAuthPending(true);

    applyAdminLinkVisibility(user);

    currentUsername =
        user.username;

    renderProfile();

    scheduleA2hs();

}


// =====================================================
// PROFİL GÖRÜNÜMÜ
// =====================================================

// Supporter çerçevesi: özel üretilen (assets/frame-supporter.png, şeffaf) altın alev halkası görseli.
// Dönen ışık, saf CSS'te (maskeli conic-gradient) ayrı bir katman olarak görselin üstüne bindirilir.
function supporterFrameOverlayHtml() {
    return `<span class="sf-overlay" aria-hidden="true">
        <img src="assets/frame-supporter.png" class="sf-ring-img" alt="">
        <span class="sf-highlight"></span>
    </span>`;
}

// Sauran Plus çerçevesi: satın alınmaz/hediye edilmez — aktif abonelikte otomatik açılır. Mesaj balonundaki
// gibi yükselen mor ışıltı tozuyla, iki katmanlı zıt yönde dönen halka + nabız atan dış parıltı +
// sabit duran küçük yıldız pırıltılarıyla (saf CSS, görsel dosya gerekmez) — sade bir parlamadan daha zengin.
function plusFrameOverlayHtml() {
    return `<span class="pf-overlay" aria-hidden="true">
        <span class="pf-glow"></span>
        <span class="pf-ring pf-ring-outer"></span>
        <span class="pf-ring pf-ring-inner"></span>
        <span class="pf-dust"></span><span class="pf-dust"></span><span class="pf-dust"></span><span class="pf-dust"></span><span class="pf-dust"></span><span class="pf-dust"></span><span class="pf-dust"></span>
        <span class="pf-spark"></span><span class="pf-spark"></span><span class="pf-spark"></span>
    </span>`;
}
function frameOverlayHtml(frameKey) {
    if (frameKey === 'supporter') return supporterFrameOverlayHtml();
    if (frameKey === 'plus') return plusFrameOverlayHtml();
    return '';
}

const AVATAR_FRAME_CLASSES = ['frame-ocean', 'frame-neon', 'frame-galaxy', 'frame-supporter', 'frame-plus'];
const AVATAR_FRAME_INFO = {
    supporter: { title: '👑 Sauran Supporter', text: "Sauran'ın geliştirme döneminde projeye destek veren özel topluluk üyelerine ait. Market'te satılmaz." },
    plus: { title: '✦ Sauran Plus', text: 'Aktif Sauran Plus/Premium abonelerine otomatik açılan, yükselen ışıltı tozlu mor çerçeve.' },
    ocean: { title: '🌊 Ocean', text: 'Hafif dalga hissi veren mavi tonlu çerçeve.' },
    neon: { title: '⚡ Neon', text: 'Parlayan kenarlı neon çerçeve.' },
    galaxy: { title: '🌌 Galaxy', text: 'Yıldızların hafif hareket ettiği uzay temalı çerçeve.' }
};
// Sauran Plus rozeti: kullanıcı adının hemen yanında mor parlak "★ PLUS" hap rozeti,
// içinden yükselip kaybolan ışıltı tozlarıyla (Supporter'ın altın halkasından ayrı, mor/Plus kimliği).
function plusBadgeHtml(isPlus) {
    return isPlus ? ` <span class="plus-name-card" title="Sauran Plus"><i class="pnc-star">★</i><span class="pnc-label">PLUS</span><i class="pnc-dust"></i><i class="pnc-dust"></i><i class="pnc-dust"></i></span>` : '';
}

// Sauran Plus "Oyuncu İsim Kartı": rozetten AYRI bir özellik — kullanıcı adının kendisi mor parlak
// bir kart üzerinde görünür (ışıltı tozu yükselir), her yerde (mesaj, üye/arkadaş listesi, sesli oda,
// profil) kullanıcı adı basılan her noktada kullanılmalı.
function usernameCardHtml(username, isPlus, nameEffect) {
    let safe = escapeHtml(username);
    if (nameEffect && nameEffect !== 'none') safe = `<span class="name-fx name-fx-${escapeAttr(nameEffect)}">${safe}</span>`;
    if (!isPlus) return safe;
    return `<span class="plus-name-plate"><i class="pnp-dust"></i><i class="pnp-dust"></i><i class="pnp-dust"></i><i class="pnp-dust"></i><span class="pnp-text">${safe}</span></span>`;
}

function applyAvatarFrame(el, frameKey) {
    if (!el) return;
    AVATAR_FRAME_CLASSES.forEach((c) => el.classList.remove(c));
    el.querySelectorAll(':scope > .sf-overlay, :scope > .pf-overlay').forEach((n) => n.remove());
    if (frameKey && frameKey !== 'classic') {
        el.classList.add('frame-' + frameKey);
        const overlay = frameOverlayHtml(frameKey);
        if (overlay) el.insertAdjacentHTML('beforeend', overlay);
    }
    el.dataset.frameKey = frameKey && frameKey !== 'classic' ? frameKey : '';
}

// Sauran Plus: profil penceresinde avatarın çevresinde animasyonlu efekt (sakura/sahne ışıkları). Yalnızca
// büyük profil avatarına uygulanır (rail/topbar gibi küçük avatarlara değil — orada çerçeve zaten yeterli).
// Parçacıklar dairesel bir maske (.pfx-mask, overflow:hidden) içinde durur — avatar penceresini taşmaz.
const PROFILE_EFFECT_CLASSES = ['profile-effect-sakura', 'profile-effect-stagelights'];
function applyProfileEffect(el, effect) {
    if (!el) return;
    PROFILE_EFFECT_CLASSES.forEach((c) => el.classList.remove(c));
    el.querySelectorAll(':scope > .pfx-mask').forEach((n) => n.remove());
    if (effect === 'sakura') {
        el.classList.add('profile-effect-sakura');
        el.insertAdjacentHTML('beforeend', '<span class="pfx-mask">' + '<i class="pfx-petal"></i>'.repeat(12) + '</span>');
    } else if (effect === 'stagelights') {
        el.classList.add('profile-effect-stagelights');
        // 4 ince ışık huzmesi, alt kısımlara yayılmış, sürekli sağa-sola sallanıyor (hiç kaybolup yeniden belirmiyor).
        el.insertAdjacentHTML('beforeend', '<span class="pfx-mask">' + '<i class="pfx-stagelight"></i>'.repeat(4) + '</span>');
    }
}
// Yalnızca başkasının profilinde: kendi profilinde aynı avatar tıklaması zaten "avatarı değiştir" anlamına geliyor.
document.addEventListener('click', (event) => {
    const wrap = event.target.closest && event.target.closest('#other-profile-avatar-wrap[data-frame-key]');
    if (!wrap || !wrap.dataset.frameKey) return;
    const info = AVATAR_FRAME_INFO[wrap.dataset.frameKey];
    if (info) showToast(`${info.title} — ${info.text}`);
});

function renderProfile() {

    if (!currentUser) return;

    renderSoundPackPicker();

    applyAvatarFrame(document.getElementById('topbar-profile-avatar-wrap'), currentUser.avatar_frame);
    applyAvatarFrame(document.getElementById('rail-profile'), currentUser.avatar_frame);
    applyAvatarFrame(document.getElementById('profile-modal-avatar-wrap'), currentUser.avatar_frame);
    applyProfileEffect(document.getElementById('profile-modal-avatar-wrap'), currentUser.profile_effect);
    applyProfileTheme(document.querySelector('#profile-modal .profile-modal-box'), currentUser.profile_theme);

    const color =
        resolveUserColor(
            currentUser.id,
            currentUser.username,
            currentUser.profile_color
        );

    const initial =
        currentUser.username
            .charAt(0)
            .toUpperCase();

    const hasAvatarImage =
        Boolean(currentUser.avatar_data);


    // ------------------------------------------------
    // Sidebar avatarı
    // ------------------------------------------------

    profileAvatar.textContent =
        initial;

    profileAvatar.style.setProperty(
        '--user-color',
        color
    );

    profileAvatar.style.display =
        hasAvatarImage ?
            'none' :
            'flex';

    profileAvatarImg.src =
        hasAvatarImage ?
            currentUser.avatar_data :
            '';

    profileAvatarImg.style.display =
        hasAvatarImage ?
            'block' :
            'none';

    profileUsername.textContent =
        currentUser.username;


    // ------------------------------------------------
    // Modal avatarı
    // ------------------------------------------------

    profileModalAvatar.textContent =
        initial;

    profileModalAvatar.style.setProperty(
        '--user-color',
        color
    );

    profileModalAvatar.style.display =
        hasAvatarImage ?
            'none' :
            'flex';

    profileModalAvatarImg.src =
        hasAvatarImage ?
            currentUser.avatar_data :
            '';

    profileModalAvatarImg.style.display =
        hasAvatarImage ?
            'block' :
            'none';

    profileModalUsername.innerHTML =
        `${usernameCardHtml(currentUser.username, currentUser.plus_active, currentUser.name_effect)}${plusBadgeHtml(currentUser.plus_active)}`;


    // ------------------------------------------------
    // Kapak fotoğrafı
    // ------------------------------------------------

    const bannerEl = document.getElementById('profile-modal-banner');
    if (currentUser.banner_data) {
        bannerEl.style.setProperty('--banner-img', cssImageUrl(currentUser.banner_data));
        bannerEl.classList.add('has-image');
    } else {
        bannerEl.classList.remove('has-image');
    }


    // ------------------------------------------------
    // Durum
    // ------------------------------------------------

    renderStatus(
        currentUser.status ||
        'active'
    );

    renderProfileColorPicker();

}


// =====================================================
// DURUM GÖRÜNÜMÜ
// =====================================================

function renderStatus(status) {

    const info =
        STATUS_INFO[status] ||
        STATUS_INFO.active;


    [statusDotBtn, sidebarStatusDot].forEach(
        (dot) => {

            dot.classList.remove(
                ...STATUS_CLASS_NAMES
            );

            dot.classList.add(
                info.className
            );

            dot.textContent =
                status === 'invisible' ? '👻' : '';

        }
    );

    statusLabel.textContent =
        info.label;

}


statusDotBtn.addEventListener(
    'click',
    (event) => {

        event.stopPropagation();

        statusDropdown.style.display =
            statusDropdown.style.display === 'flex' ?
                'none' :
                'flex';

    }
);


statusOptionButtons.forEach(
    (btn) => {

        btn.addEventListener(
            'click',
            async () => {

                const status =
                    btn.dataset.status;

                statusDropdown.style.display =
                    'none';

                renderStatus(status);

                if (currentUser) {
                    currentUser.status = status;
                }


                try {

                    await fetch(
                        '/api/profile/status',
                        {
                            method: 'PATCH',

                            headers: {
                                'Content-Type':
                                    'application/json'
                            },

                            credentials: 'include',

                            body: JSON.stringify({
                                status
                            })
                        }
                    );

                } catch (error) {

                    console.error(
                        'Durum güncellenemedi:',
                        error
                    );

                }

            }
        );

    }
);


document.addEventListener(
    'click',
    (event) => {

        if (
            statusDropdown.style.display === 'flex' &&
            !statusDropdown.contains(event.target) &&
            event.target !== statusDotBtn
        ) {

            statusDropdown.style.display =
                'none';

        }

    }
);


// =====================================================
// KULLANICI ADI DÜZENLEME
// =====================================================

usernameEditBtn.addEventListener(
    'click',
    () => {

        usernameEditInput.value = currentUser?.username || '';
        usernameEditError.textContent = '';

        usernameView.style.display = 'none';
        usernameEdit.style.display = 'flex';

        usernameEditInput.focus();

    }
);


usernameCancelBtn.addEventListener(
    'click',
    () => {

        usernameEdit.style.display = 'none';
        usernameView.style.display = 'flex';

    }
);


usernameSaveBtn.addEventListener(
    'click',
    async () => {

        const newUsername = usernameEditInput.value.trim();
        usernameEditError.textContent = '';

        if (!newUsername) return;

        usernameSaveBtn.disabled = true;

        try {

            const response = await fetch('/api/profile/username', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ username: newUsername })
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                usernameEditError.textContent = data.error || 'Güncellenemedi.';
                return;
            }

            currentUser.username = data.username;
            currentUsername = data.username;

            renderProfile();

            usernameEdit.style.display = 'none';
            usernameView.style.display = 'flex';

        } catch (error) {

            console.error('Kullanıcı adı güncellenemedi:', error);
            usernameEditError.textContent = 'Sunucuya bağlanılamadı.';

        } finally {

            usernameSaveBtn.disabled = false;

        }

    }
);


// =====================================================
// AVATAR DEĞİŞTİRME / KALDIRMA
// =====================================================

profileModalAvatar.addEventListener('click', () => {
    document.querySelector('#profile-modal .avatar-change-overlay').classList.toggle('show');
});

profileModalAvatarImg.addEventListener('click', () => {
    document.querySelector('#profile-modal .avatar-change-overlay').classList.toggle('show');
});


avatarChangeBtn.addEventListener(
    'click',
    () => {

        avatarFileInput.click();

    }
);


avatarRemoveBtn.addEventListener(
    'click',
    async () => {

        if (!currentUser?.avatar_data) return;

        try {

            const response = await fetch('/api/profile/avatar', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ avatar_data: null })
            });

            const data = await response.json();

            if (!data.success) return;

            currentUser.avatar_data = null;
            renderProfile();

        } catch (error) {

            console.error('Avatar kaldırılamadı:', error);

        }

    }
);


function openImageCropper(file, { aspect, outWidth, title, round }) {

    return new Promise((resolve) => {

        const modal = document.getElementById('cropper-modal');
        const stage = document.getElementById('cropper-stage');
        const canvas = document.getElementById('cropper-canvas');
        const guide = document.getElementById('cropper-guide');
        const zoomInput = document.getElementById('cropper-zoom');
        const confirmBtn = document.getElementById('cropper-confirm-btn');
        const cancelBtn = document.getElementById('cropper-cancel-btn');
        const closeBtn = document.getElementById('cropper-close-btn');

        document.getElementById('cropper-title').textContent = title;

        const stageW = Math.max(200, Math.min(320, window.innerWidth - 80));
        const stageH = Math.round(stageW / aspect);
        canvas.width = stageW;
        canvas.height = stageH;
        stage.style.width = `${stageW}px`;
        stage.style.height = `${stageH}px`;
        guide.classList.toggle('round', Boolean(round));

        const url = URL.createObjectURL(file);
        const img = new Image();

        let baseScale = 1;
        let zoom = 1;
        let offX = 0;
        let offY = 0;

        function clamp() {
            const w = img.width * baseScale * zoom;
            const h = img.height * baseScale * zoom;
            offX = Math.min(0, Math.max(stageW - w, offX));
            offY = Math.min(0, Math.max(stageH - h, offY));
        }

        function draw() {
            const ctx = canvas.getContext('2d');
            const s = baseScale * zoom;
            ctx.clearRect(0, 0, stageW, stageH);
            ctx.drawImage(img, offX, offY, img.width * s, img.height * s);
        }

        function cleanup(result) {
            modal.style.display = 'none';
            URL.revokeObjectURL(url);
            stage.onpointerdown = stage.onpointermove = stage.onpointerup = stage.onpointercancel = null;
            zoomInput.oninput = confirmBtn.onclick = cancelBtn.onclick = closeBtn.onclick = null;
            resolve(result);
        }

        img.onerror = () => cleanup(null);

        img.onload = () => {

            baseScale = Math.max(stageW / img.width, stageH / img.height);
            zoom = 1;
            zoomInput.value = '1';
            offX = (stageW - img.width * baseScale) / 2;
            offY = (stageH - img.height * baseScale) / 2;
            draw();
            modal.style.display = 'flex';

            let dragging = false;
            let lastX = 0;
            let lastY = 0;

            stage.onpointerdown = (e) => {
                dragging = true;
                lastX = e.clientX;
                lastY = e.clientY;
                stage.setPointerCapture(e.pointerId);
            };

            stage.onpointermove = (e) => {
                if (!dragging) return;
                offX += e.clientX - lastX;
                offY += e.clientY - lastY;
                lastX = e.clientX;
                lastY = e.clientY;
                clamp();
                draw();
            };

            stage.onpointerup = stage.onpointercancel = () => { dragging = false; };

            zoomInput.oninput = () => {
                const cx = stageW / 2;
                const cy = stageH / 2;
                const prev = baseScale * zoom;
                zoom = Number(zoomInput.value);
                const next = baseScale * zoom;
                offX = cx - (cx - offX) * (next / prev);
                offY = cy - (cy - offY) * (next / prev);
                clamp();
                draw();
            };

            confirmBtn.onclick = () => {
                const out = document.createElement('canvas');
                out.width = outWidth;
                out.height = Math.round(outWidth / aspect);
                const k = outWidth / stageW;
                const s = baseScale * zoom * k;
                out.getContext('2d').drawImage(img, offX * k, offY * k, img.width * s, img.height * s);
                cleanup(out.toDataURL('image/jpeg', 0.88));
            };

            cancelBtn.onclick = closeBtn.onclick = () => cleanup(null);

        };

        img.src = url;

    });

}


avatarFileInput.addEventListener(
    'change',
    async () => {

        const file =
            avatarFileInput.files[0];

        if (!file) return;


        try {

            // Sauran Premium: animasyonlu (GIF) profil fotoğrafı — kırpma aracı her kareyi tek kareye
            // düzleştirdiği için Premium abonesinde GIF'i kırpmadan, olduğu gibi (animasyonlu) yüklüyoruz.
            const isAnimatedGif = file.type === 'image/gif' && currentUser?.premium_active;
            let dataUrl;
            if (isAnimatedGif) {
                const GIF_MAX_BYTES = 5 * 1024 * 1024;
                if (file.size > GIF_MAX_BYTES) {
                    showToast("Animasyonlu profil fotoğrafı limiti 5 MB'dir.");
                    return;
                }
                dataUrl = await readFileAsDataUrl(file);
            } else {
                dataUrl = await openImageCropper(file, { aspect: 1, outWidth: 256, title: 'Profil Fotoğrafını Kırp', round: true });
            }

            if (!dataUrl) return;

            const response =
                await fetch(
                    '/api/profile/avatar',
                    {
                        method: 'PATCH',

                        headers: {
                            'Content-Type':
                                'application/json'
                        },

                        credentials: 'include',

                        body: JSON.stringify({
                            avatar_data: dataUrl
                        })
                    }
                );

            const data =
                await response.json();


            if (
                !response.ok ||
                !data.success
            ) {

                showAuthError(
                    data.error ||
                    'Görsel yüklenemedi.'
                );

                return;

            }


            if (currentUser) {
                currentUser.avatar_data = data.avatar_data;
            }

            renderProfile();

        } catch (error) {

            console.error(
                'Avatar yüklenemedi:',
                error
            );

        } finally {

            avatarFileInput.value =
                '';

        }

    }
);


const bannerChangeBtn = document.getElementById('banner-change-btn');
const bannerFileInput = document.getElementById('banner-file-input');

bannerChangeBtn.addEventListener('click', () => bannerFileInput.click());

bannerFileInput.addEventListener('change', async () => {

    const file = bannerFileInput.files?.[0];
    bannerFileInput.value = '';
    if (!file) return;

    try {

        // Sauran Plus: animasyonlu (GIF) kapak fotoğrafı — kırpma aracı GIF'i tek kareye düzleştirdiği için
        // Plus abonesinde GIF olduğu gibi yüklenir; Plus olmayan GIF seçerse bilgilendirilir.
        let dataUrl;
        if (file.type === 'image/gif') {
            if (!currentUser?.plus_active) {
                showToast('Hareketli kapak fotoğrafı Sauran Plus abonelerine açıktır.');
                return;
            }
            if (file.size > 5 * 1024 * 1024) {
                showToast("Animasyonlu kapak fotoğrafı limiti 5 MB'dir.");
                return;
            }
            dataUrl = await readFileAsDataUrl(file);
        } else {
            dataUrl = await openImageCropper(file, { aspect: 16 / 9, outWidth: 900, title: 'Kapak Fotoğrafını Kırp' });
        }

        if (!dataUrl) return;

        const response = await fetch('/api/profile/banner', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ banner_data: dataUrl })
        });

        const data = await response.json();

        if (!data.success) {
            showToast(data.error || 'Kapak fotoğrafı yüklenemedi.');
            return;
        }

        if (currentUser) currentUser.banner_data = data.banner_data;
        renderProfile();

    } catch (error) {
        console.error('Kapak fotoğrafı yüklenemedi:', error);
        showToast('Kapak fotoğrafı yüklenemedi.');
    }

});


function resizeImageToDataUrl(file, size) {

    return new Promise(
        (resolve, reject) => {

            const reader =
                new FileReader();

            reader.onerror =
                reject;

            reader.onload = () => {

                const img =
                    new Image();

                img.onerror =
                    reject;

                img.onload = () => {

                    const canvas =
                        document.createElement('canvas');

                    canvas.width =
                        size;

                    canvas.height =
                        size;

                    const ctx =
                        canvas.getContext('2d');

                    const minSide =
                        Math.min(
                            img.width,
                            img.height
                        );

                    const sx =
                        (img.width - minSide) / 2;

                    const sy =
                        (img.height - minSide) / 2;

                    ctx.drawImage(
                        img,
                        sx, sy, minSide, minSide,
                        0, 0, size, size
                    );

                    resolve(
                        canvas.toDataURL(
                            'image/jpeg',
                            0.85
                        )
                    );

                };

                img.src =
                    reader.result;

            };

            reader.readAsDataURL(
                file
            );

        }
    );

}


// =====================================================
// AYARLAR — TEMA / DİL / ŞİFRE
// =====================================================

settingsBtn.addEventListener(
    'click',
    () => {

        settingsModal.style.display = 'flex';
        renderConnectionInfo();

        const savedTheme = localStorage.getItem('sauran_theme') || 'dark';
        const savedLang = localStorage.getItem('sauran_lang') || 'tr';

        themeButtons.forEach(b => b.classList.toggle('selected', b.dataset.theme === savedTheme));
        langButtons.forEach(b => b.classList.toggle('selected', b.dataset.lang === savedLang));
        document.getElementById('lang-confirm-btn').style.display = 'none';

        settingsCurrentPassword.value = '';
        settingsNewPassword.value = '';
        settingsPasswordError.textContent = '';

        loadBlockedUsers();
        loadSessions();
        updateBrowserNotifUI();
        loadNotificationPreferences();
        switchSettingsTab('general');

    }
);


// =====================================================
// AYARLAR — KATEGORİ SEKMELERİ
// =====================================================

function switchSettingsTab(tabName) {

    document.querySelectorAll('.settings-tab-btn').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.settingsTab === tabName);
    });

    document.querySelectorAll('.settings-panel').forEach((panel) => {
        panel.style.display = panel.dataset.settingsPanel === tabName ? 'flex' : 'none';
    });

}

document.querySelectorAll('.settings-tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => switchSettingsTab(btn.dataset.settingsTab));
});


// =====================================================
// BİLDİRİM TERCİHLERİ (kategorilere ayrılmış checkbox'lar)
// =====================================================

async function loadNotificationPreferences() {

    try {

        const response = await fetch('/api/notifications/preferences', { credentials: 'include' });
        const data = await response.json();
        if (!data.success) return;

        document.querySelectorAll('#notif-pref-groups input[data-pref]').forEach((input) => {
            const key = input.dataset.pref;
            input.checked = data.preferences[key] !== 0;
            if (key === 'sound_enabled') notifSoundEnabled = input.checked;
            if (key === 'inapp_enabled') notifInappEnabled = input.checked;
        if (key === 'desktop_enabled') notifDesktopEnabled = input.checked;
        if (key === 'notify_dm_message') notifDmEnabled = input.checked;
        if (key === 'notify_hub_message') notifHubMessageEnabled = input.checked;
            if (key === 'desktop_enabled') notifDesktopEnabled = input.checked;
            if (key === 'notify_dm_message') notifDmEnabled = input.checked;
            if (key === 'notify_hub_message') notifHubMessageEnabled = input.checked;
            if (key === 'notify_voice_presence') notifVoicePresenceEnabled = input.checked;
            if (key === 'voice_join_sound') voiceJoinSoundEnabled = input.checked;
        });

    } catch (error) {
        console.error('Bildirim tercihleri alınamadı:', error);
    }

}

document.querySelectorAll('#notif-pref-groups input[data-pref]').forEach((input) => {

    input.addEventListener('change', async () => {

        const key = input.dataset.pref;
        if (key === 'sound_enabled') notifSoundEnabled = input.checked;
        if (key === 'inapp_enabled') notifInappEnabled = input.checked;
        if (key === 'notify_voice_presence') notifVoicePresenceEnabled = input.checked;
        if (key === 'voice_join_sound') voiceJoinSoundEnabled = input.checked;

        try {
            await fetch('/api/notifications/preferences', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ [key]: input.checked })
            });
        } catch (error) {
            console.error('Bildirim tercihi güncellenemedi:', error);
        }

    });

});


// =====================================================
// TARAYICI BİLDİRİM İZNİ
// =====================================================
// Sayfa açılır açılmaz izin isteme — yalnızca kullanıcı Ayarlar'daki
// butona bastığında (açık bir kullanıcı etkileşimi) sorulur. Tarayıcı
// zaten izin vermiş/reddetmişse tekrar sorulmaz, ilgili durum gösterilir.

function getBrowserNotifState() {
    if (!('Notification' in window)) return 'unsupported';
    return Notification.permission; // 'default' | 'granted' | 'denied'
}

function updateBrowserNotifUI() {

    const state = getBrowserNotifState();
    const textEl = document.getElementById('browser-notif-status-text');
    const btnEl = document.getElementById('browser-notif-permission-btn');
    if (!textEl || !btnEl) return;

    // "Masaüstü Bildirimlerine İzin Ver" metni mobilde de sabit kalıyordu —
    // burada da AŞAMA E'deki mobil/masaüstü ayrımıyla aynı eşiği kullanıyoruz.
    const isMobile = window.innerWidth <= 768;
    const k = (key) => isMobile ? `${key}-mobile` : key;

    textEl.classList.remove('state-granted', 'state-denied');
    btnEl.style.display = 'none';

    if (state === 'unsupported') {
        textEl.textContent = t(k('notif-permission-unsupported'));
    } else if (state === 'granted') {
        textEl.textContent = t(k('notif-permission-granted'));
        textEl.classList.add('state-granted');
    } else if (state === 'denied') {
        textEl.textContent = t(k('notif-permission-denied'));
        textEl.classList.add('state-denied');
    } else {
        textEl.textContent = t('notif-permission-default');
        btnEl.style.display = 'block';
        btnEl.querySelector('span').textContent = t(k('notif-permission-btn'));
    }

}

document.getElementById('browser-notif-permission-btn')?.addEventListener('click', async () => {

    if (!('Notification' in window)) return;

    try {

        const result = await Notification.requestPermission();
        updateBrowserNotifUI();

        if (result === 'granted') {
            await fetch('/api/notifications/preferences', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ desktop_enabled: true })
            });

            ensurePushSubscription();
        }

    } catch (error) {
        console.error('Bildirim izni istenemedi:', error);
    }

});

// ─── Sistem bildirimi + Web Push ─────────────────────────────────────────
// Uygulama ekranda görünürken ama odakta değilken bildirimi bu sayfa kendisi
// gösterir; uygulama arka plandayken / kapalıyken sunucu Web Push gönderir
// (bkz. server/index.js dispatchWebPush) ve service worker (sw.js) gösterir.
// Android Chrome `new Notification()` kurucusunu desteklemez — bu yüzden
// bildirimler service worker kaydı üzerinden gösteriliyor.

let pushSubscribed = false;

if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch((error) => console.error('Service worker kaydedilemedi:', error));

    navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data?.type === 'open-dm' && currentUser) {
            openDm(event.data.userId, event.data.username || '');
        }

        if (event.data?.type === 'open-hub' && currentUser) {
            openHub(event.data.hubId);
        }

        // Web Push bildirimi kullanıcıya/sohbete özgü bilgi taşımaz: dokununca tür bazlı genel ekran açılır.
        if (event.data?.type === 'open-general' && currentUser) {
            openGeneralScreenForNotificationType(event.data.notificationType);
        }
    });
}

function urlBase64ToUint8Array(base64) {
    const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(padded);
    return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}

// Girişten sonra bildirim izni henüz sorulmadıysa küçük, kapatılabilir bir istek gösterir (izin, yalnızca kullanıcı "Bildirimleri aç"a basınca istenir).
// Reddedilmiş izin için gösterilmez; "Şimdi değil" 14 gün boyunca tekrar göstermez. Yerel Android uygulaması (FCM) kendi akışını kullanır.
const NOTIF_PROMPT_KEY = 'sauran_notif_prompt_until';

async function maybeShowNotificationPrompt() {

    if (getNativeNotify()) return;
    if (getBrowserNotifState() !== 'default') return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    if (document.getElementById('notif-prompt')) return;

    try {
        const until = Number(localStorage.getItem(NOTIF_PROMPT_KEY) || 0);
        if (until && Date.now() < until) return;
    } catch (_) { /* depolama yok: yine de göster */ }

    // Sunucuda Web Push yapılandırılmamışsa izin istemenin anlamı yok.
    try {
        const keyResponse = await fetch('/api/push/public-key', { credentials: 'include' });
        const keyData = await keyResponse.json();
        if (!keyData.success || !keyData.configured) return;
    } catch (_) { return; }

    const box = document.createElement('div');
    box.id = 'notif-prompt';
    box.className = 'notif-prompt liquid-glass';
    box.setAttribute('role', 'dialog');
    box.innerHTML = `
        <span class="notif-prompt-text">${escapeHtml(t('notif-prompt-text'))}</span>
        <span class="notif-prompt-actions">
            <button type="button" class="notif-prompt-later">${escapeHtml(t('notif-prompt-later'))}</button>
            <button type="button" class="notif-prompt-enable">${escapeHtml(t('notif-prompt-enable'))}</button>
        </span>`;
    document.body.appendChild(box);

    const close = (snooze) => {
        if (snooze) { try { localStorage.setItem(NOTIF_PROMPT_KEY, String(Date.now() + 14 * 24 * 60 * 60 * 1000)); } catch (_) { /* yoksay */ } }
        box.remove();
    };

    box.querySelector('.notif-prompt-later').addEventListener('click', () => close(true));
    box.querySelector('.notif-prompt-enable').addEventListener('click', async () => {
        close(false);
        // Ayarlar'daki izin düğmesiyle aynı akış (izin → tercihi aç → push aboneliği).
        document.getElementById('browser-notif-permission-btn')?.click();
    });
}

async function ensurePushSubscription() {

    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    if (getBrowserNotifState() !== 'granted') return;

    try {

        const keyResponse = await fetch('/api/push/public-key', { credentials: 'include' });
        const keyData = await keyResponse.json();
        if (!keyData.success || !keyData.configured) return;

        const registration = await navigator.serviceWorker.ready;
        const applicationServerKey = urlBase64ToUint8Array(keyData.public_key);

        let subscription = await registration.pushManager.getSubscription();

        if (!subscription) {
            subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey });
        }

        const response = await fetch('/api/push/subscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ subscription: subscription.toJSON() })
        });

        pushSubscribed = (await response.json()).success === true;

    } catch (error) {
        console.error('Push aboneliği kurulamadı:', error);
    }

}

async function removePushSubscriptionOnLogout() {

    removeNativeFcmOnLogout();
    pushSubscribed = false;
    if (!('serviceWorker' in navigator)) return;

    try {
        const registration = await navigator.serviceWorker.getRegistration();
        const subscription = await registration?.pushManager?.getSubscription();
        if (!subscription) return;

        await fetch('/api/push/unsubscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ endpoint: subscription.endpoint })
        });

        await subscription.unsubscribe();
    } catch (error) {
        console.error('Push aboneliği kaldırılamadı:', error);
    }

}

// ── Yerel (Android) uygulama: arka plandayken sistem bildirimi ───────────────
// WebView'da Notification API / Web Push yoktur. Uygulama çalışırken (arka planda) gelen
// mesaj / arama / istek bildirimleri yerel köprü üzerinden Android bildirim çubuğuna gönderilir.
// Uygulama tamamen kapalıyken bildirim için sunucudan gönderilen push (FCM) gerekir.
let nativeNotifyPlugin = null;
let nativeNotifyReady = false;

function getNativeNotify() {
    try {
        const cap = window.Capacitor;
        if (!cap || typeof cap.isNativePlatform !== 'function' || !cap.isNativePlatform()) return null;
        if (!nativeNotifyPlugin) {
            nativeNotifyPlugin = typeof cap.registerPlugin === 'function'
                ? cap.registerPlugin('SauranNotify')
                : (cap.Plugins && cap.Plugins.SauranNotify) || null;
        }
        return nativeNotifyPlugin;
    } catch (_) {
        return null;
    }
}

// Yerel uygulamada ön/arka plan durumu Activity yaşam döngüsünden gelir (SauranNotify 'appState').
let nativeAppActive = true;

// Sistem bildirimi gösterilmeli mi? Tarayıcıda: sekme odakta değilse (ve push yoksa). Yerel uygulamada:
// uygulama arka plandaysa.
function shouldShowSystemNotification() {
    if (getNativeNotify()) return !nativeAppActive && !nativeFcmActive;
    if (document.hasFocus()) return false;
    if (document.visibilityState === 'hidden' && pushSubscribed) return false;
    return true;
}

// Aynı sohbetten gelen bildirimleri sayar ("3 yeni mesaj"): etiket -> adet. Bildirim kaldırılınca sıfırlanır.
const nativeNotifyCounts = new Map();

function nativeNotifyCancel(tag) {
    nativeNotifyCounts.delete(tag);
    const plugin = getNativeNotify();
    if (!plugin) return;
    try { Promise.resolve(plugin.cancel({ tag })).catch(() => {}); } catch (_) { /* yoksay */ }
}

// Uygulama öne gelince: açık sohbetin bildirimini ve genel bildirimleri temizle
// (kullanıcı zaten uygulamada; diğer sohbetlerin kartları, o sohbetler açılana kadar kalır).
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || !getNativeNotify()) return;
    nativeNotifyCancel('sauran');
    if (activeDmUserId) nativeNotifyCancel(`dm-${activeDmUserId}`);
    if (currentHub) nativeNotifyCancel(`hub-${currentHub.id}`);
});

function openFromNotificationUrl(url) {
    if (!currentUser || !url) return;
    try {
        const params = new URL(url, location.origin).searchParams;
        const userId = Number(params.get('open_dm'));
        const hubId = Number(params.get('open_hub'));
        if (userId) openDm(userId, params.get('name') || '');
        else if (hubId) openHub(hubId);
    } catch (_) { /* yoksay */ }
}

// FCM bildirimine dokunma: kullanıcıya/sohbete özgü bilgi olmadığından tür bazlı genel ekran açılır.
async function openGeneralScreenForNotificationType(type) {
    if (!currentUser) return;

    if (['friend_request', 'friend_request_accepted', 'hub_invite', 'platform_role_notice', 'platform_role_revoked'].includes(type)) {
        await reloadNotifications();
        notificationsModal.style.display = 'flex';
    } else if (type === 'dm_message' || type === 'incoming_call') {
        friendsSidebar2.classList.add('open');
        friendsSidebarToggleBtn2.classList.add('open');
        loadFriendsSidebar();
    }
    // hub_message ve bilinmeyen türler: uygulama zaten lobi listesiyle açılır.
}

// ── FCM: uygulama tamamen kapalıyken bile bildirim ─────────────────────────────
// Sunucu FCM'i gerçekten yapılandırmışsa (kayıt yanıtındaki delivery) yerel bildirimler bırakılır;
// aksi halde çift bildirim olmasın diye ikisinden yalnızca biri kullanılır.
let nativeFcmActive = false;
const FCM_TOKEN_KEY = 'sauran_fcm_token';

async function initNativeFcm() {
    const cap = window.Capacitor;
    if (!cap || typeof cap.isNativePlatform !== 'function' || !cap.isNativePlatform() || typeof cap.registerPlugin !== 'function') return;

    let plugin;
    try { plugin = cap.registerPlugin('PushNotifications'); } catch (_) { return; }

    try {
        plugin.addListener('registration', async (token) => {
            const value = token?.value;
            if (!value) return;

            try {
                // iPhone uygulamasında anahtar Apple'ın (APNs) cihaz anahtarıdır; sunucu platforma göre gönderir.
                const platform = typeof cap.getPlatform === 'function' && cap.getPlatform() === 'ios' ? 'ios' : 'android';
                const response = await fetch('/api/fcm/register', {
                    method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token: value, platform })
                });
                const data = await response.json().catch(() => ({}));
                if (response.ok && data.success) {
                    nativeFcmActive = data.delivery === true;
                    try { localStorage.setItem(FCM_TOKEN_KEY, value); } catch (_) { /* yoksay */ }
                }
            } catch (error) {
                console.warn('FCM anahtarı sunucuya iletilemedi:', error);
            }
        });

        plugin.addListener('registrationError', (error) => console.warn('FCM kaydı başarısız:', error));

        // FCM bildirimi (Google altyapısı) kullanıcıya/sohbete özgü hiçbir bilgi taşımaz: dokununca yalnızca tür bazlı GENEL ekran açılır;
        // gerçek mesajlar ve adlar uygulama açıldıktan sonra oturumlu API/Socket.io ile gelir.
        plugin.addListener('pushNotificationActionPerformed', (event) => openGeneralScreenForNotificationType(event?.notification?.data?.type));

        const permission = await plugin.requestPermissions();
        if (permission?.receive === 'granted') await plugin.register();
    } catch (error) {
        console.warn('FCM başlatılamadı:', error);
    }
}

async function removeNativeFcmOnLogout() {
    nativeFcmActive = false;
    let token = null;
    try { token = localStorage.getItem(FCM_TOKEN_KEY); localStorage.removeItem(FCM_TOKEN_KEY); } catch (_) { /* yoksay */ }
    if (!token) return;

    try {
        await fetch('/api/fcm/unregister', {
            method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token })
        });
    } catch (_) { /* yoksay */ }
}

// Giriş sonrası bir kez: bildirim iznini iste ve bildirime dokunulunca ilgili sohbeti aç.
function initNativeNotifications() {
    const plugin = getNativeNotify();
    if (!plugin || nativeNotifyReady) return;
    nativeNotifyReady = true;

    try {
        Promise.resolve(plugin.requestPermission()).catch(() => {});

        plugin.addListener('appState', (event) => {
            nativeAppActive = event?.active !== false;
            reportAppVisibility(); // sunucu, uygulama görünmüyorsa (FCM ile) bildirim gönderir
        });

        plugin.addListener('tap', (event) => openFromNotificationUrl(event?.url));
    } catch (error) {
        console.warn('Yerel bildirim köprüsü başlatılamadı:', error);
    }

    initNativeFcm();
}

async function showSystemNotification(title, body, options = {}) {

    const nativePlugin = getNativeNotify();
    if (nativePlugin) {
        const tag = options.tag || 'sauran';

        // Aynı sohbetten art arda gelen mesajlar tek kartta toplanır: "3 yeni mesaj · son mesaj".
        if (tag.startsWith('dm-') || tag.startsWith('hub-')) {
            const count = (nativeNotifyCounts.get(tag) || 0) + 1;
            nativeNotifyCounts.set(tag, count);
            if (count > 1) {
                const label = localStorage.getItem('sauran_lang') === 'en' ? 'new messages' : 'yeni mesaj';
                body = `${count} ${label} · ${body}`;
            }
        }

        await nativePlugin.notify({ title, body, tag, url: options.data?.url || '/' });
        return;
    }

    const registration = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : null;

    if (registration?.showNotification) {
        await registration.showNotification(title, { body, ...options });
        return;
    }

    new Notification(title, { body });

}

// Sekme odakta değilse (kullanıcı uygulama içi toast'u göremeyeceği için)
// sistem bildirimi de göster. Sekme tamamen gizliyse ve push aboneliği varsa
// bildirimi sunucudan gelen push gösterir (çift bildirim olmasın diye burada
// gösterilmez). İzin yoksa hiçbir şey yapma — burada asla izin İSTEMİYORUZ.
function maybeShowBrowserNotification(type, label) {

    if (getBrowserNotifState() !== 'granted' && !getNativeNotify()) return;
    if (!shouldShowSystemNotification()) return;

    showSystemNotification('Sauran', label).catch((error) => {
        console.error('Tarayıcı bildirimi gösterilemedi:', error);
    });

}

function dmPreviewText(msg) {
    const labels = {
        dm_voice: '🎤 Sesli mesaj', voice: '🎤 Sesli mesaj',
        dm_file: '📎 Dosya', file: '📎 Dosya',
        dm_image: '🖼 Fotoğraf', image: '🖼 Fotoğraf',
        dm_video: '🎬 Video', video: '🎬 Video',
        dm_sticker: '🖼 Çıkartma', sticker: '🖼 Çıkartma',
        poll: '📊 Anket', share: '🔗 Paylaşım'
    };
    return labels[msg.kind] || String(msg.content || '').slice(0, 140);
}

// Lobi mesajı: yalnızca "Yeni Lobi mesaj bildirimleri" açıksa (ve bildirimlere izin verilmişse).
function maybeNotifyIncomingHubMessage(msg) {

    if (!notifDesktopEnabled || !notifHubMessageEnabled || !currentHub || currentHub.my_muted) return;
    if (getBrowserNotifState() !== 'granted' && !getNativeNotify()) return;
    if (!shouldShowSystemNotification()) return;

    showSystemNotification(currentHub.type === 'group' ? groupDisplayName(currentHub) : currentHub.name, `${msg.username}: ${dmPreviewText(msg)}`, {
        tag: `hub-${currentHub.id}`,
        renotify: true,
        data: { url: `/?open_hub=${currentHub.id}` }
    }).catch((error) => console.error('Lobi bildirimi gösterilemedi:', error));

}

function maybeNotifyIncomingDm(msg) {

    if (!notifDesktopEnabled || !notifDmEnabled) return;
    if (getBrowserNotifState() !== 'granted' && !getNativeNotify()) return;
    if (!shouldShowSystemNotification()) return;

    showSystemNotification(msg.username, dmPreviewText(msg), {
        tag: `dm-${msg.user_id}`,
        renotify: true,
        data: { url: `/?open_dm=${msg.user_id}` } // kullanıcı adı URL'ye (sunucu/proxy erişim günlüklerine) yazılmaz; açılışta API'den alınır
    }).catch((error) => console.error('DM bildirimi gösterilemedi:', error));

}

// Push sunucusu, uygulamanın ekranda görünür olup olmadığını buradan öğrenir.
function reportAppVisibility() {
    // Yerel uygulamada WebView'ın visibilityState'i arka planda güvenilir değildir: Activity durumuna güven.
    const visible = getNativeNotify() ? nativeAppActive : document.visibilityState === 'visible';
    socket?.emit('app_visibility', { visible });
}

document.addEventListener('visibilitychange', reportAppVisibility);
window.addEventListener('pagehide', () => socket?.emit('app_visibility', { visible: false }));

// Bildirime dokununca (soğuk açılışta) URL'deki ?open_dm=<id>&name=<ad> ya da
// ?open_hub=<id> ile ilgili sohbeti/lobiyi aç.
function handlePendingNotificationOpen() {

    const params = new URLSearchParams(location.search);

    // Web Push bildirimiyle soğuk açılış: yalnızca genel tür (?notif_type=...) gelir; tür bazlı genel ekran açılır.
    const notifType = params.get('notif_type');
    if (notifType) {
        history.replaceState(null, '', location.pathname);
        openGeneralScreenForNotificationType(notifType);
        return;
    }

    const userId = Number(params.get('open_dm'));
    const hubId = Number(params.get('open_hub'));
    if (!userId && !hubId) return;

    history.replaceState(null, '', location.pathname);

    if (userId) openDm(userId, params.get('name') || '');
    else openHub(hubId);

}


function describeUserAgent(ua) {

    ua = ua || '';

    if (/iphone|ipad/i.test(ua)) return '📱 iPhone / iPad';
    if (/android/i.test(ua)) return '📱 Android';
    if (/macintosh/i.test(ua)) return '💻 Mac';
    if (/windows/i.test(ua)) return '💻 Windows';
    if (/linux/i.test(ua)) return '💻 Linux';
    return '🖥️ ' + t('unknown-device');

}

// ─── Ayarlar > Güvenlik: iki adımlı doğrulama ───
async function loadTwoFactorStatus() {
    const status = document.getElementById('twofa-status');
    try {
        const data = await (await fetch('/api/2fa/status', { credentials: 'include' })).json();
        if (!data.success) return;
        twofaEnabledCache = Boolean(data.enabled);
        renderSettingsEmail();
        status.innerHTML = data.enabled
            ? `<span class="twofa-badge on">● Açık</span> <span class="twofa-meta">Kalan kurtarma kodu: ${Number(data.recovery_remaining)}</span>`
            : `<span class="twofa-badge off">● Kapalı</span> <span class="twofa-meta">Girişte şifreye ek olarak telefonundaki koddan da sorulur.</span>`;
        document.getElementById('twofa-enable-btn').style.display = data.enabled ? 'none' : 'flex';
        document.getElementById('twofa-codes-btn').style.display = data.enabled ? 'flex' : 'none';
        document.getElementById('twofa-disable-btn').style.display = data.enabled ? 'flex' : 'none';
    } catch (_) { /* yoksay */ }
}

const twofaModal = document.getElementById('twofa-modal');
let twofaMode = 'enable'; // enable | disable | codes
let twofaCodes = [];

function showTwofaStep(step) {
    twofaModal.querySelectorAll('[data-twofa-step]').forEach((el) => { el.style.display = el.dataset.twofaStep === step ? 'flex' : 'none'; });
    document.getElementById('twofa-error').textContent = '';
}

function openTwofaModal(mode) {
    twofaMode = mode;
    const pw = document.getElementById('twofa-password');
    const code = document.getElementById('twofa-code-confirm');
    pw.value = '';
    code.value = '';
    pw.style.display = mode === 'codes' ? 'none' : '';
    code.style.display = mode === 'enable' ? 'none' : '';
    document.getElementById('twofa-password-text').textContent = mode === 'enable'
        ? 'Devam etmek için şifreni gir.'
        : mode === 'disable'
            ? 'Kapatmak için şifreni ve uygulamadaki kodu (ya da bir kurtarma kodunu) gir.'
            : 'Yeni kurtarma kodları için uygulamadaki kodu (ya da bir kurtarma kodunu) gir. Eski kodlar geçersiz olur.';
    document.getElementById('twofa-password-next').textContent = mode === 'disable' ? 'Kapat' : 'Devam';
    showTwofaStep('password');
    twofaModal.style.display = 'flex';
    setTimeout(() => (mode === 'codes' ? code : pw).focus(), 30);
}

function closeTwofaModal() {
    twofaModal.style.display = 'none';
    twofaCodes = [];
    document.getElementById('twofa-codes').innerHTML = '';
    document.getElementById('twofa-qr').innerHTML = '';
    document.getElementById('twofa-secret').textContent = '';
    loadTwoFactorStatus();
}

async function twofaPost(url, body) {
    const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(body) });
    return response.json();
}

function showRecoveryCodes(codes) {
    twofaCodes = codes;
    document.getElementById('twofa-codes').innerHTML = codes.map((c) => `<li><code>${escapeHtml(c)}</code></li>`).join('');
    showTwofaStep('codes');
}

document.getElementById('twofa-password-next').addEventListener('click', async () => {
    const error = document.getElementById('twofa-error');
    const password = document.getElementById('twofa-password').value;
    const code = document.getElementById('twofa-code-confirm').value.trim();
    try {
        if (twofaMode === 'enable') {
            const data = await twofaPost('/api/2fa/setup', { password });
            if (!data.success) { error.textContent = data.error || 'Olmadı.'; return; }
            // QR sunucuda üretilen SVG'dir; sayfaya img kaynağı olarak (betik çalıştıramaz) konur.
            document.getElementById('twofa-qr').innerHTML = data.qr_svg
                ? `<img alt="QR kodu" src="data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(data.qr_svg)))}">`
                : '';
            document.getElementById('twofa-secret').textContent = data.secret.replace(/(.{4})/g, '$1 ').trim();
            // Telefonda (dokunmatik + dar ekran) QR yerine doğrulayıcı uygulamayı doğrudan açan bağlantı gösterilir.
            const isPhone = window.matchMedia('(pointer: coarse)').matches && Math.min(window.screen.width, window.screen.height) < 820;
            twofaModal.querySelector('.twofa-box').dataset.device = isPhone ? 'phone' : 'desktop';
            document.getElementById('twofa-open-app').href = data.otpauth;
            twofaModal.querySelector('.twofa-manual').open = false;
            document.getElementById('twofa-setup-code').value = '';
            showTwofaStep('scan');
            setTimeout(() => document.getElementById('twofa-setup-code').focus(), 30);
        } else if (twofaMode === 'disable') {
            const data = await twofaPost('/api/2fa/disable', { password, code });
            if (!data.success) { error.textContent = data.error || 'Olmadı.'; return; }
            showToast('İki adımlı doğrulama kapatıldı.');
            closeTwofaModal();
        } else {
            const data = await twofaPost('/api/2fa/recovery-codes', { code });
            if (!data.success) { error.textContent = data.error || 'Olmadı.'; return; }
            showRecoveryCodes(data.recovery_codes);
        }
    } catch (_) {
        error.textContent = 'Sunucuya bağlanılamadı.';
    }
});

document.getElementById('twofa-setup-verify').addEventListener('click', async () => {
    const error = document.getElementById('twofa-error');
    const data = await twofaPost('/api/2fa/enable', { code: document.getElementById('twofa-setup-code').value.trim() }).catch(() => null);
    if (!data || !data.success) { error.textContent = data?.error || 'Sunucuya bağlanılamadı.'; return; }
    showToast('İki adımlı doğrulama açıldı.');
    showRecoveryCodes(data.recovery_codes);
});
document.getElementById('twofa-setup-code').addEventListener('keydown', (e) => { if (e.key === 'Enter') document.getElementById('twofa-setup-verify').click(); });

document.getElementById('twofa-codes-copy').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(twofaCodes.join('\n')); showToast('Kopyalandı.'); } catch (_) { showToast('Kopyalanamadı; kodları elle not al.'); }
});
document.getElementById('twofa-codes-download').addEventListener('click', () => {
    const text = `Sauran kurtarma kodları (${currentUser?.username || ''})\nHer kod bir kez kullanılabilir.\n\n${twofaCodes.join('\n')}\n`;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
    a.download = 'sauran-kurtarma-kodlari.txt';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
});
document.getElementById('twofa-codes-done').addEventListener('click', closeTwofaModal);
document.getElementById('twofa-close-btn').addEventListener('click', () => {
    if (twofaCodes.length && !confirm('Kurtarma kodlarını kaydettin mi? Bu pencereyi kapatınca bir daha gösterilmeyecek.')) return;
    closeTwofaModal();
});

// ── E-posta adresini değiştirme ──
var emailRevealed = false;
var twofaEnabledCache = false;

function maskEmailClient(email) {
    const [local, domain] = String(email || '').split('@');
    if (!domain) return '';
    const head = local.slice(0, Math.min(2, Math.max(1, local.length - 1)));
    return `${head}${'•'.repeat(Math.max(3, local.length - head.length))}@${domain}`;
}

function renderSettingsEmail() {
    const el = document.getElementById('settings-email-display');
    if (!el) return;
    const email = currentUser && currentUser.email ? currentUser.email : '';
    el.textContent = email ? (emailRevealed ? email : maskEmailClient(email)) : '—';
    document.getElementById('settings-email-reveal').textContent = emailRevealed ? 'Gizle' : 'Göster';
}

document.getElementById('settings-email-reveal').addEventListener('click', () => {
    emailRevealed = !emailRevealed;
    renderSettingsEmail();
});

const emailChangeModal = document.getElementById('email-change-modal');

function showEmailChangeStep(step) {
    emailChangeModal.querySelectorAll('[data-email-step]').forEach((el) => { el.style.display = el.dataset.emailStep === step ? 'flex' : 'none'; });
    document.getElementById('email-change-error').textContent = '';
}

function openEmailChangeModal() {
    document.getElementById('email-change-new').value = '';
    document.getElementById('email-change-password').value = '';
    document.getElementById('email-change-2fa').value = '';
    document.getElementById('email-change-code').value = '';
    document.getElementById('email-change-2fa').style.display = twofaEnabledCache ? '' : 'none';
    showEmailChangeStep('form');
    emailChangeModal.style.display = 'flex';
    setTimeout(() => document.getElementById('email-change-new').focus(), 30);
}

function closeEmailChangeModal() {
    emailChangeModal.style.display = 'none';
    document.getElementById('email-change-password').value = '';
    document.getElementById('email-change-2fa').value = '';
}

document.getElementById('email-change-btn').addEventListener('click', openEmailChangeModal);
document.getElementById('email-change-close-btn').addEventListener('click', closeEmailChangeModal);
emailChangeModal.addEventListener('click', (e) => { if (e.target === emailChangeModal) closeEmailChangeModal(); });

async function emailChangeSend() {
    const error = document.getElementById('email-change-error');
    const btn = document.getElementById('email-change-send');
    const newEmail = document.getElementById('email-change-new').value.trim();
    const password = document.getElementById('email-change-password').value;
    const code = document.getElementById('email-change-2fa').value.trim();
    error.textContent = '';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) { error.textContent = 'Geçerli bir e-posta adresi gir.'; return; }
    if (!password) { error.textContent = 'Mevcut şifreni gir.'; return; }
    if (twofaEnabledCache && !code) { error.textContent = 'Doğrulayıcı uygulamadaki kodu gir.'; return; }
    btn.disabled = true;
    try {
        const data = await twofaPost('/api/email-change/request', { new_email: newEmail, password, code });
        if (!data.success) { error.textContent = data.error || 'Gönderilemedi.'; return; }
        document.getElementById('email-change-target').textContent = data.new_email;
        document.getElementById('email-change-code').value = '';
        document.getElementById('email-change-password').value = '';
        document.getElementById('email-change-2fa').value = '';
        showEmailChangeStep('code');
        setTimeout(() => document.getElementById('email-change-code').focus(), 30);
    } catch (_) {
        error.textContent = 'Bağlantı hatası. Tekrar dene.';
    } finally {
        btn.disabled = false;
    }
}

async function emailChangeConfirm() {
    const error = document.getElementById('email-change-error');
    const btn = document.getElementById('email-change-confirm');
    const code = document.getElementById('email-change-code').value.trim();
    if (!/^\d{6}$/.test(code)) { error.textContent = '6 haneli kodu gir.'; return; }
    btn.disabled = true;
    try {
        const data = await twofaPost('/api/email-change/confirm', { code });
        if (!data.success) { error.textContent = data.error || 'Olmadı.'; return; }
        if (currentUser) currentUser.email = data.email;
        renderSettingsEmail();
        closeEmailChangeModal();
        showToast('E-posta adresin değiştirildi.');
    } catch (_) {
        error.textContent = 'Bağlantı hatası. Tekrar dene.';
    } finally {
        btn.disabled = false;
    }
}

document.getElementById('email-change-send').addEventListener('click', emailChangeSend);
document.getElementById('email-change-confirm').addEventListener('click', emailChangeConfirm);
document.getElementById('email-change-back').addEventListener('click', () => showEmailChangeStep('form'));
['email-change-new', 'email-change-password', 'email-change-2fa'].forEach((id) => {
    document.getElementById(id).addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); emailChangeSend(); } });
});
document.getElementById('email-change-code').addEventListener('input', (e) => {
    e.target.value = e.target.value.replace(/\D/g, '').slice(0, 6);
    if (e.target.value.length === 6) emailChangeConfirm();
});
document.getElementById('email-change-code').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); emailChangeConfirm(); } });

document.getElementById('twofa-secret-copy').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(document.getElementById('twofa-secret').textContent.replace(/\s/g, '')); showToast('Anahtar kopyalandı.'); }
    catch (_) { showToast('Kopyalanamadı.'); }
});
document.getElementById('twofa-enable-btn').addEventListener('click', () => openTwofaModal('enable'));
document.getElementById('twofa-disable-btn').addEventListener('click', () => openTwofaModal('disable'));
document.getElementById('twofa-codes-btn').addEventListener('click', () => openTwofaModal('codes'));

async function loadSessions() {
    loadTwoFactorStatus();

    const container = document.getElementById('settings-sessions-list');

    try {

        const response = await fetch('/api/sessions', { credentials: 'include' });
        const data = await response.json();
        if (!data.success) return;

        container.innerHTML = data.sessions.map((s) => {
            const date = serverDate(s.created_at).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
            return `
                <div class="settings-blocked-row">
                    <span class="settings-blocked-name">
                        ${describeUserAgent(s.user_agent)} — ${date}
                        ${s.is_current ? ` <strong style="color:#57f287;">(${t('this-device')})</strong>` : ''}
                    </span>
                    ${!s.is_current ? `<button class="settings-unblock-btn" data-revoke-session="${s.id}" type="button">${t('revoke')}</button>` : ''}
                </div>
            `;
        }).join('');

        container.querySelectorAll('[data-revoke-session]').forEach((btn) => {
            btn.addEventListener('click', async () => {
                await fetch(`/api/sessions/${btn.dataset.revokeSession}`, { method: 'DELETE', credentials: 'include' });
                loadSessions();
            });
        });

    } catch (error) {
        console.error('Oturumlar alınamadı:', error);
    }

}

document.getElementById('settings-logout-all-btn').addEventListener('click', async () => {
    if (!confirm(t('confirm-logout-all'))) return;
    await fetch('/api/sessions/logout-all', { method: 'POST', credentials: 'include' });
    loadSessions();
    showToast(t('logout-all-done'));
});

document.getElementById('settings-export-data-btn').addEventListener('click', async () => {

    try {

        const response = await fetch('/api/account/export', { credentials: 'include' });
        if (!response.ok) throw new Error('export failed');

        const blob = await response.blob();
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `sauran-verilerim-${currentUser.username}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);

    } catch {
        showToast(t('export-data-error'));
    }

});

document.getElementById('settings-delete-account-btn').addEventListener('click', async () => {

    const typed = prompt(t('delete-account-prompt').replace('{username}', currentUser.username));
    if (typed !== currentUser.username) {
        if (typed !== null) showToast(t('delete-account-mismatch'));
        return;
    }

    // Kalıcı silme için parola ile yeniden doğrulama (çalınmış/açık kalmış oturumla silmeyi önler).
    const passwordInput = document.getElementById('settings-delete-password');
    const password = passwordInput ? passwordInput.value : '';
    if (!password) {
        showToast(t('delete-account-password-required'));
        if (passwordInput) passwordInput.focus();
        return;
    }

    const response = await fetch('/api/account', {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
    });
    const data = await response.json();

    if (!data.success) {
        showToast(data.error || 'Hesap silinemedi.');
        return;
    }

    location.reload();

});


async function loadBlockedUsers() {

    const container = document.getElementById('settings-blocked-list');

    try {

        const response = await fetch('/api/users/blocked', { credentials: 'include' });
        const data = await response.json();
        if (!data.success) return;

        if (data.blocked.length === 0) {
            container.innerHTML = `<div class="settings-blocked-empty">${t('blocked-empty')}</div>`;
            return;
        }

        container.innerHTML = data.blocked.map((u) => {
            const color = getUserColor(u.username);
            const initial = u.username.charAt(0).toUpperCase();
            const avatarInner = u.avatar_data ? `<img src="${escapeAttr(u.avatar_data)}" alt="">` : escapeHtml(initial);
            return `
                <div class="settings-blocked-row" data-user-id="${u.id}">
                    <span class="settings-blocked-avatar" style="--user-color:${color};">${avatarInner}</span>
                    <span class="settings-blocked-name">${escapeHtml(u.username)}</span>
                    <button class="settings-unblock-btn" data-unblock="${u.id}" type="button">${t('unblock')}</button>
                </div>
            `;
        }).join('');

        container.querySelectorAll('[data-unblock]').forEach((btn) => {
            btn.addEventListener('click', async () => {
                await fetch(`/api/users/${btn.dataset.unblock}/block`, { method: 'DELETE', credentials: 'include' });
                loadBlockedUsers();
            });
        });

    } catch (error) {
        console.error('Engellenenler alınamadı:', error);
    }

}


settingsCloseBtn.addEventListener(
    'click',
    () => settingsModal.style.display = 'none'
);


settingsModal.addEventListener(
    'click',
    (event) => {
        if (event.target === settingsModal) settingsModal.style.display = 'none';
    }
);


themeButtons.forEach((btn) => {

    btn.addEventListener('click', () => {

        const theme = btn.dataset.theme;
        localStorage.setItem('sauran_theme', theme);
        applyTheme(theme);
        themeButtons.forEach(b => b.classList.toggle('selected', b === btn));

    });

});


const langConfirmBtn = document.getElementById('lang-confirm-btn');

langButtons.forEach((btn) => {

    btn.addEventListener('click', () => {

        langButtons.forEach(b => b.classList.toggle('selected', b === btn));

        const currentLang = localStorage.getItem('sauran_lang') || 'tr';
        langConfirmBtn.style.display = btn.dataset.lang !== currentLang ? 'block' : 'none';

    });

});


langConfirmBtn.addEventListener('click', () => {

    const selected = document.querySelector('#settings-modal [data-lang].selected');
    if (!selected) return;

    const lang = selected.dataset.lang;
    localStorage.setItem('sauran_lang', lang);
    applyLanguage(lang);
    langConfirmBtn.style.display = 'none';

});


function applyTheme(theme) {

    document.body.classList.toggle('theme-purple', theme === 'purple');

}


applyTheme(localStorage.getItem('sauran_theme') || 'dark');


// =====================================================
// DİL (i18n)
// =====================================================

const TRANSLATIONS = {
    'auth-title': { tr: "Sauran'a Hoş Geldin", en: 'Welcome to Sauran' },
    'show-forgot-btn': { tr: 'Şifremi Unuttum', en: 'Forgot Password' },
    'show-register-btn': { tr: 'Kayıt Ol', en: 'Sign Up' },
    'show-login-btn': { tr: 'Giriş Yap', en: 'Log In' },
    'login-btn': { tr: 'Giriş Yap', en: 'Log In' },
    'register-btn': { tr: 'Kayıt Ol', en: 'Sign Up' },
    'verify-btn': { tr: 'Doğrula', en: 'Verify' },
    'back-to-register-btn': { tr: 'Geri Dön', en: 'Back' },
    'back-to-login-from-forgot-btn': { tr: 'Geri Dön', en: 'Back' },
    'back-to-login-from-reset-btn': { tr: 'Geri Dön', en: 'Back' },
    'register-birthdate-label': { tr: 'Doğum Tarihin', en: 'Date of Birth' },
    'forgot-email-btn': { tr: 'Kod Gönder', en: 'Send Code' },
    'forgot-reset-btn': { tr: 'Şifreyi Sıfırla', en: 'Reset Password' },
    'hub-create-open-btn': { tr: '+ Yeni Lobi', en: '+ New Lobby' },
    'hub-create-submit-btn': { tr: 'Lobiyi Oluştur', en: 'Create Lobby' },
    'hub-create-image-btn': { tr: 'Görsel Ekle', en: 'Add Image' },
    'logout-btn': { tr: 'Çıkış Yap', en: 'Log Out' },
    'settings-password-btn': { tr: 'Şifreyi Güncelle', en: 'Update Password' },
    'lang-confirm-btn': { tr: 'Dili Onayla', en: 'Confirm Language' },
    'hub-join-submit-btn': { tr: 'Katıl', en: 'Join' },
    'friend-add-btn': { tr: 'Ekle', en: 'Add' }
};

const TRANSLATIONS_PLACEHOLDER = {
    'register-username-input': { tr: 'Kullanıcı Adın', en: 'Username' },
    'register-email-input': { tr: 'E-posta Adresin', en: 'Your Email' },
    'register-password-input': { tr: 'Şifren', en: 'Password' },
    'register-password-confirm-input': { tr: 'Şifreni Tekrar Gir', en: 'Confirm Password' },
    'hub-create-name-input': { tr: 'Lobi adı', en: 'Lobby name' },
    'friend-add-input': { tr: 'Kullanıcı adı', en: 'Username' },
    'hub-join-code-input': { tr: 'Davet kodunu gir...', en: 'Enter invite code...' },
    'hub-message-input': { tr: 'Bir mesaj yaz...', en: 'Type a message...' },
    'dm-message-input': { tr: 'Bir mesaj yaz...', en: 'Type a message...' },
    'hub-settings-name-input': { tr: 'Lobi adı', en: 'Lobby name' }
};

// data-i18n / data-i18n-placeholder ile işaretlenmiş elemanlar + dinamik
// JS metinleri için ortak sözlük. t(key) her yerde kullanılabilir.
const I18N = {
    'menu-join-code': { tr: 'Davet Koduyla Katıl', en: 'Join with Invite Code' },
    'menu-notifications': { tr: 'Bildirimler', en: 'Notifications' },
    'menu-friends': { tr: 'Arkadaşlar', en: 'Friends' },
    'menu-hub-members': { tr: 'Lobi Üyeleri', en: 'Lobby Members' },
    'menu-add-friend': { tr: 'Arkadaş Ekle', en: 'Add Friend' },
    'menu-settings': { tr: 'Ayarlar', en: 'Settings' },
    'menu-admin': { tr: 'Yönetim', en: 'Admin' },
    'suspended-title': { tr: 'Hesabınız geçici olarak askıya alındı.', en: 'Your account has been temporarily suspended.' },
    'suspended-reason': { tr: 'Gerekçe:', en: 'Reason:' },
    'suspended-support': { tr: 'Destek:', en: 'Support:' },
    'dev-notice-btn': { tr: 'Anladım, Devam Et', en: 'Got it, Continue' },
    'ios-voice-hint': {
        tr: 'iPhone\'da Ana Ekran uygulamasında ekranı kilitlersen ya da başka uygulamaya geçersen mikrofonun kapanır. Arka planda konuşmak için Sauran\'ı Safari\'de aç.',
        en: 'On iPhone, in the Home Screen app your microphone turns off when you lock the screen or switch to another app. To keep talking in the background, open Sauran in Safari.'
    },
    'ios-voice-hint-ok': { tr: 'Anladım', en: 'Got it' },
    'notif-role-notice': { tr: 'Sauran Yönetim: yeni görev bildirimi', en: 'Sauran Management: new duty notice' },
    'notif-role-revoked': { tr: 'Sauran Yönetim: görev bilgilendirmesi', en: 'Sauran Management: duty information' },
    'voice-screenshare': { tr: 'Ekran paylaş', en: 'Share screen' },
    'voice-minimize': { tr: 'Küçült', en: 'Minimize' },
    'voice-connected': { tr: 'Bağlı', en: 'Connected' },
    'hub-create-desc': { tr: 'Yeni bir sosyal alan aç. Sonra arkadaşlarını davet edebilirsin.', en: 'Open a new social space. You can invite friends afterwards.' },
    'cancel': { tr: 'Vazgeç', en: 'Cancel' },
    'lobbies-joined': { tr: 'Katıldığım lobiler', en: 'Lobbies I joined' },
    'hub-info-title': { tr: 'Lobi bilgisi', en: 'Lobby info' },
    'hub-info-owner': { tr: 'Sahibi', en: 'Owner' },
    'hub-info-members': { tr: 'Üye', en: 'Members' },
    'hub-info-online': { tr: 'Çevrimiçi', en: 'Online' },
    'hub-info-created': { tr: 'Oluşturulma', en: 'Created' },
    'close': { tr: 'Kapat', en: 'Close' },
    'lobbies-title': { tr: 'Lobilerim', en: 'My lobbies' },
    'select-lobby': { tr: 'Bir lobi seç', en: 'Select a lobby' },
    'lobby-nav-open': { tr: 'Lobileri aç', en: 'Open lobbies' },
    'lobby-create': { tr: 'Lobi oluştur', en: 'Create lobby' },
    'hubs-title': { tr: 'Ana Menü', en: 'Home' },
    'hubs-owned': { tr: 'Lobilerim', en: 'My lobbies' },
    'hubs-joined': { tr: 'Katıldığım lobiler', en: 'Lobbies I joined' },
    'hubs-empty': { tr: 'İlk Lobini oluştur', en: 'Create your first lobby' },
    'modal-new-hub': { tr: 'Yeni Lobi', en: 'New Lobby' },
    'add-image': { tr: 'Görsel Ekle', en: 'Add Image' },
    'change-image': { tr: 'Görseli Değiştir', en: 'Change Image' },
    'modal-hub-settings': { tr: '⚙️ Lobi Ayarları', en: '⚙️ Lobby Settings' },
    'modal-invite-friend': { tr: 'Arkadaşını Davet Et', en: 'Invite a Friend' },
    'modal-invite-friend-subtitle': { tr: 'Lobiye katılmasını istediğin arkadaşını seç.', en: 'Pick the friend you want to invite to the lobby.' },
    'modal-notifications': { tr: '🔔 Bildirimler', en: '🔔 Notifications' },
    'modal-join-code': { tr: '🔑 Davet Koduyla Katıl', en: '🔑 Join with Invite Code' },
    'modal-invite-code': { tr: '🔑 Davet Kodu', en: '🔑 Invite Code' },
    'invite-expiry-note': { tr: 'Bu kod {days} gün boyunca hiç kullanılmazsa otomatik silinir.', en: 'This code is deleted automatically if it is not used for {days} days.' },
    'invites-active': { tr: 'Etkin davet kodları', en: 'Active invite codes' },
    'invites-mine': { tr: 'Etkin davet kodların', en: 'Your active invite codes' },
    'invites-empty': { tr: 'Etkin davet kodu yok.', en: 'No active invite codes.' },
    'invite-revoke': { tr: 'İptal et', en: 'Revoke' },
    'invite-revoke-confirm': { tr: 'Bu davet kodu iptal edilsin mi? Kodla artık kimse katılamaz.', en: 'Revoke this invite code? Nobody will be able to join with it.' },
    'invite-expiry-label': { tr: 'Geçerlilik süresi', en: 'Expires after' },
    'invite-exp-30m': { tr: '30 dakika', en: '30 minutes' },
    'invite-exp-1h': { tr: '1 saat', en: '1 hour' },
    'invite-exp-6h': { tr: '6 saat', en: '6 hours' },
    'invite-exp-12h': { tr: '12 saat', en: '12 hours' },
    'invite-exp-1d': { tr: '1 gün', en: '1 day' },
    'invite-exp-7d': { tr: '7 gün', en: '7 days' },
    'invite-exp-never': { tr: 'Süresiz', en: 'Never' },
    'invite-uses-label': { tr: 'Kullanım sınırı', en: 'Max uses' },
    'invite-uses-unlimited': { tr: 'Sınırsız', en: 'No limit' },
    'invite-uses-1': { tr: '1 kişi', en: '1 use' },
    'invite-uses-5': { tr: '5 kişi', en: '5 uses' },
    'invite-uses-10': { tr: '10 kişi', en: '10 uses' },
    'invite-uses-25': { tr: '25 kişi', en: '25 uses' },
    'invite-uses-50': { tr: '50 kişi', en: '50 uses' },
    'invite-uses-100': { tr: '100 kişi', en: '100 uses' },
    'invite-create': { tr: 'Kodu oluştur', en: 'Create code' },
    'invite-share-info': { tr: 'Bu kodu arkadaşınla paylaş, lobiye katılabilsin.', en: 'Share this code so your friend can join the lobby.' },
    'invite-copy': { tr: '📋 Kodu kopyala', en: '📋 Copy code' },
    'modal-poll': { tr: '📊 Oylama Başlat', en: '📊 Start a Poll' },
    'modal-share': { tr: '📌 Paylaşım Yap', en: '📌 Share Something' },
    'modal-add-friend': { tr: '👤＋ Arkadaş Ekle', en: '👤＋ Add Friend' },
    'modal-add-friend-title': { tr: 'Arkadaş Ekle', en: 'Add Friend' },
    'modal-add-friend-subtitle': { tr: 'Kullanıcı adını yaz, arkadaşlık isteği gönder.', en: 'Type a username to send a friend request.' },
    'friend-add-submit': { tr: 'Gönder', en: 'Send' },
    'modal-settings': { tr: '⚙️ Ayarlar', en: '⚙️ Settings' },
    'label-theme': { tr: 'Tema', en: 'Theme' },
    'theme-dark': { tr: 'Kapalı Tema', en: 'Dark Theme' },
    'theme-dark-desc': { tr: 'Siyah, karanlık arayüz', en: 'Black, dark interface' },
    'theme-purple': { tr: 'Mor Tema', en: 'Purple Theme' },
    'theme-purple-desc': { tr: 'Derin mor, karanlık arayüz', en: 'Deep purple, dark interface' },
    'label-lang': { tr: 'Dil', en: 'Language' },
    'label-notifications': { tr: 'Bildirimler', en: 'Notifications' },
    'notif-permission-btn': { tr: 'Masaüstü Bildirimlerine İzin Ver', en: 'Allow Desktop Notifications' },
    'notif-permission-unsupported': { tr: 'Tarayıcın masaüstü bildirimlerini desteklemiyor.', en: 'Your browser does not support desktop notifications.' },
    'notif-permission-granted': { tr: '✓ Masaüstü bildirimleri açık.', en: '✓ Desktop notifications are on.' },
    'notif-permission-denied': { tr: 'Masaüstü bildirimleri engellendi. Açmak için tarayıcı adres çubuğundaki site ayarlarından izin vermen gerekiyor.', en: 'Desktop notifications are blocked. To enable them, allow notifications from your browser\'s site settings.' },
    // Mobil cihazlarda aynı butonun/metnin "Masaüstü" değil "Mobil" demesi için
    // (AŞAMA 2/3 mobil dönüşümü sırasında bulunan gerçek bir hata düzeltmesi).
    'notif-permission-btn-mobile': { tr: 'Mobil Bildirimlerine İzin Ver', en: 'Allow Mobile Notifications' },
    'notif-permission-unsupported-mobile': { tr: 'Bu tarayıcı/mod mobil bildirimleri desteklemiyor. iPhone\'da bildirim alabilmek için Sauran\'ı Ana Ekrana Ekle.', en: "This browser/mode doesn't support mobile notifications. On iPhone, add Sauran to your Home Screen to receive notifications." },
    'notif-permission-granted-mobile': { tr: '✓ Mobil bildirimler açık.', en: '✓ Mobile notifications are on.' },
    'notif-permission-denied-mobile': { tr: 'Mobil bildirimler engellendi. Açmak için tarayıcı/site ayarlarından izin vermen gerekiyor.', en: "Mobile notifications are blocked. To enable them, allow notifications from your browser/site settings." },
    'notif-permission-default': { tr: 'Sauran, önemli olaylarda (mesaj, arkadaşlık isteği, arama) masaüstünde bildirim gösterebilir.', en: 'Sauran can show desktop notifications for important events (messages, friend requests, calls).' },
    'notif-group-general': { tr: 'Genel', en: 'General' },
    'notif-group-messages': { tr: 'Mesajlar', en: 'Messages' },
    'notif-group-friends': { tr: 'Arkadaşlar', en: 'Friends' },
    'notif-group-calls': { tr: 'Aramalar', en: 'Calls' },
    'notif-group-hub': { tr: 'Lobi', en: 'Lobby' },
    'notif-group-other': { tr: 'Diğer', en: 'Other' },
    'notif-pref-desktop': { tr: 'Masaüstü / tarayıcı bildirimleri', en: 'Desktop / browser notifications' },
    'notif-pref-mobile': { tr: 'Mobil bildirimleri', en: 'Mobile notifications' },
    'notif-pref-inapp': { tr: 'Uygulama içi bildirimler', en: 'In-app notifications' },
    'notif-pref-sound': { tr: 'Bildirim sesleri', en: 'Notification sounds' },
    'notif-pref-dm': { tr: 'Yeni özel mesajlar', en: 'New private messages' },
    'notif-pref-hub-message': { tr: 'Yeni Lobi mesaj bildirimleri', en: 'New lobby message notifications' },
    'notif-pref-friend-request': { tr: 'Arkadaşlık istekleri', en: 'Friend requests' },
    'notif-pref-friend-accepted': { tr: 'Arkadaşlık isteği kabul edildi', en: 'Friend request accepted' },
    'notif-pref-incoming-call': { tr: 'Gelen aramalar', en: 'Incoming calls' },
    'notif-pref-missed-call': { tr: 'Cevapsız aramalar', en: 'Missed calls' },
    'notif-pref-hub-event': { tr: 'Lobi bildirimleri (davet, vb.)', en: 'Lobby notifications (invites, etc.)' },
    'notif-pref-system': { tr: 'Sistem bildirimleri', en: 'System notifications' },
    'members-title': { tr: 'Üyeler', en: 'Members' },
    'settings-tab-general': { tr: 'Genel', en: 'General' },
    'settings-tab-notifications': { tr: 'Bildirimler', en: 'Notifications' },
    'settings-tab-security': { tr: 'Güvenlik', en: 'Security' },
    'settings-tab-privacy': { tr: 'Gizlilik', en: 'Privacy' },
    'settings-tab-legal': { tr: 'Gizlilik ve Yasal', en: 'Privacy & Legal' },
    'settings-tab-account': { tr: 'Hesap', en: 'Account' },
    'presence-online': { tr: 'Çevrimiçi', en: 'Online' },
    'presence-offline': { tr: 'Çevrimdışı', en: 'Offline' },
    'about-me-label': { tr: 'Hakkımda', en: 'About me' },
    'about-me-empty': { tr: 'Henüz bir şey yazmamış.', en: 'Hasn\'t written anything yet.' },
    'about-me-placeholder': { tr: 'Kendinden bahset...', en: 'Tell us about yourself...' },
    'about-me-info': { tr: 'Güvenliğin için adres, telefon numarası, şifre veya başka kişisel bilgilerini paylaşmaktan kaçın.', en: 'For your safety, avoid sharing your address, phone number, password or other personal information.' },
    'about-me-saved': { tr: 'Hakkımda güncellendi.', en: 'About me updated.' },
    'label-change-password': { tr: 'Şifre Değiştir', en: 'Change Password' },
    'label-blocked-users': { tr: 'Engellenenler', en: 'Blocked Users' },
    'blocked-empty': { tr: 'Engellediğin kimse yok.', en: "You haven't blocked anyone." },
    'unblock': { tr: 'Engeli Kaldır', en: 'Unblock' },
    'watch': { tr: 'İzle', en: 'Watch' },
    'screensharing-active': { tr: 'ekran paylaşıyor', en: 'is sharing their screen' },
    'make-moderator': { tr: 'Moderatör Yap', en: 'Make Moderator' },
    'remove-moderator': { tr: 'Moderatörlükten Al', en: 'Remove Moderator' },
    'mute': { tr: 'Sustur', en: 'Mute' },
    'kick': { tr: 'At', en: 'Kick' },
    'ban': { tr: 'Yasakla', en: 'Ban' },
    'confirm-kick': { tr: 'Bu kullanıcıyı lobiden atmak istediğine emin misin?', en: 'Are you sure you want to kick this user from the lobby?' },
    'confirm-ban': { tr: 'Bu kullanıcıyı lobiden yasaklamak istediğine emin misin?', en: 'Are you sure you want to ban this user from the lobby?' },
    'kicked-from-hub': { tr: 'Bu lobiden atıldın.', en: "You've been kicked from this lobby." },
    'banned-from-hub': { tr: 'Bu lobiden yasaklandın.', en: "You've been banned from this lobby." },
    'hub-bans-title': { tr: 'Yasaklılar', en: 'Banned Users' },
    'hub-bans-empty': { tr: 'Yasaklı kimse yok.', en: 'No one is banned.' },
    'hub-mutes-title': { tr: 'Susturulanlar', en: 'Muted users' },
    'slowmode-label': { tr: '🐢 Yavaş mod', en: '🐢 Slow mode' },
    'modlog-title': { tr: 'Kayıt', en: 'Log' },
    'modlog-cat-all': { tr: 'Tüm işlemler', en: 'All actions' },
    'modlog-cat-members': { tr: 'Üyeler (atma, yasak, yetki, istek)', en: 'Members (kick, ban, roles, requests)' },
    'modlog-cat-voice': { tr: 'Sesli odalar', en: 'Voice rooms' },
    'modlog-cat-chat': { tr: 'Sohbet (temizleme, yavaş mod, filtre)', en: 'Chat (clear, slow mode, filter)' },
    'modlog-cat-settings': { tr: 'Lobi ayarları', en: 'Lobby settings' },
    'modlog-search': { tr: 'Kullanıcı adı ara (yapan ya da etkilenen)', en: 'Search username (actor or target)' },
    'modlog-more': { tr: 'Daha eski kayıtlar', en: 'Older entries' },
    'modlog-hint': { tr: 'Kayıtları yalnızca kurucu ve moderatörler görür. 180 gün saklanır; mesaj içerikleri kaydedilmez.', en: 'Only the founder and moderators can see this log. Kept for 180 days; message contents are never stored.' },
    'modlog-empty': { tr: 'Henüz kayıt yok.', en: 'No entries yet.' },
    'wf-label': { tr: '🚫 Kelime filtresi', en: '🚫 Word filter' },
    'groups-title': { tr: 'Gruplar', en: 'Groups' },
    'groups-empty': { tr: 'Henüz grubun yok. ＋ ile arkadaşlarınla bir grup kur.', en: 'No groups yet. Tap ＋ to start one with friends.' },
    'group-empty-name': { tr: 'Adsız grup', en: 'Unnamed group' },
    'group-member-count': { tr: '{n} kişi', en: '{n} members' },
    'group-create-title': { tr: '👥 Grup oluştur', en: '👥 New group' },
    'group-add-title': { tr: '👥 Kişi ekle', en: '👥 Add people' },
    'group-create-btn': { tr: 'Grubu oluştur', en: 'Create group' },
    'group-add-btn': { tr: 'Ekle', en: 'Add' },
    'group-already': { tr: 'grupta', en: 'in group' },
    'group-pick-count': { tr: '{n} kişi seçildi · en fazla {max}', en: '{n} selected · up to {max}' },
    'group-pick-nomatch': { tr: 'Eşleşen arkadaş yok.', en: 'No matching friends.' },
    'group-pick-nofriends': { tr: 'Gruba yalnızca arkadaşlarını ekleyebilirsin; henüz arkadaşın yok.', en: 'You can only add friends, and you have none yet.' },
    'group-members-title': { tr: 'Üyeler ({n}/{max})', en: 'Members ({n}/{max})' },
    'group-you': { tr: '(sen)', en: '(you)' },
    'group-owner': { tr: 'Kurucu', en: 'Owner' },
    'group-remove': { tr: 'Çıkar', en: 'Remove' },
    'group-remove-confirm': { tr: '{u} gruptan çıkarılsın mı?', en: 'Remove {u} from the group?' },
    'group-leave-confirm': { tr: 'Gruptan ayrılmak istiyor musun? Mesajlarını artık göremezsin.', en: 'Leave this group? You will no longer see its messages.' },
    'group-leave-last-confirm': { tr: 'Gruptaki son kişisin. Ayrılırsan grup ve tüm mesajları silinir.', en: 'You are the last member. Leaving deletes the group and all its messages.' },
    'group-renamed': { tr: 'Grup adı güncellendi.', en: 'Group renamed.' },
    'group-removed-toast': { tr: 'Gruptan çıkarıldın.', en: 'You were removed from the group.' },
    'deleted-account-short': { tr: 'Silinmiş hesap', en: 'Deleted account' },
    'group-sys-create': { tr: '{a} grubu kurdu · {u}', en: '{a} created the group · {u}' },
    'group-sys-add': { tr: '{a} gruba ekledi: {u}', en: '{a} added {u}' },
    'group-sys-remove': { tr: '{a} gruptan çıkardı: {u}', en: '{a} removed {u}' },
    'group-sys-leave': { tr: '{a} gruptan ayrıldı', en: '{a} left the group' },
    'group-sys-new-owner': { tr: 'Yeni kurucu: {u}', en: 'New owner: {u}' },
    'group-sys-rename': { tr: '{a} grubun adını {n} yaptı', en: '{a} renamed the group to {n}' },
    'group-sys-rename-clear': { tr: '{a} grubun adını kaldırdı', en: '{a} removed the group name' },
    'link-preview-remove': { tr: 'Önizlemeyi kaldır', en: 'Remove preview' },
    'wf-off': { tr: 'Kapalı', en: 'Off' },
    'wf-mask': { tr: 'Kelimeyi gizle (*** ile)', en: 'Hide the word (with ***)' },
    'wf-block': { tr: 'Mesajı engelle (gönderilmez)', en: 'Block the message' },
    'wf-preset': { tr: 'Hazır küfür ve hakaret listesini kullan (Türkçe + İngilizce)', en: 'Use the built-in profanity list (Turkish + English)' },
    'wf-terms-label': { tr: 'Ek yasaklı kelimeler', en: 'Extra blocked words' },
    'wf-terms-placeholder': { tr: 'spamkelime, reklam*, …', en: 'spamword, promo*, …' },
    'wf-hint': { tr: 'Virgül ya da yeni satırla ayır. Sonuna * koyarsan o kökle başlayan her kelime yakalanır (reklam* → reklamlar). Büyük/küçük harf, Türkçe karakter (ç/c, ş/s…), 0/o gibi rakam hileleri ve harf uzatma (amkkk) yakalanır; kelimenin içinde geçen parçalar yakalanmaz. Kurucu ve moderatörler muaftır. Liste üyelere gösterilmez.', en: 'Separate with commas or new lines. Add * at the end to catch every word starting with it (promo* → promotions). Case, accents, digit tricks (0/o) and stretched letters are handled; parts inside other words are not matched. The founder and moderators are exempt. Members can\'t see the list.' },
    'wf-save': { tr: 'Filtreyi kaydet', en: 'Save filter' },
    'wf-saved': { tr: 'Kaydedildi · {n} kelime', en: 'Saved · {n} words' },
    'wf-blocked': { tr: 'Mesajın bu lobinin kelime filtresine takıldı ve gönderilmedi.', en: 'Your message was blocked by this lobby\'s word filter.' },
    'slowmode-off': { tr: 'Kapalı', en: 'Off' },
    'slowmode-hint': { tr: 'Üyeler sohbete bu aralıktan daha sık mesaj gönderemez. Kurucu ve moderatörler muaftır. Değişiklik hemen uygulanır.', en: 'Members can\'t send messages more often than this. The founder and moderators are exempt. Applies immediately.' },
    'slowmode-on-bar': { tr: '🐢 Yavaş mod açık: {d} aralıkla mesaj gönderilebilir.', en: '🐢 Slow mode is on: one message every {d}.' },
    'slowmode-exempt-bar': { tr: '🐢 Yavaş mod açık ({d}). Sen muafsın.', en: '🐢 Slow mode is on ({d}). You are exempt.' },
    'slowmode-wait-bar': { tr: '🐢 Yavaş mod: {s} sonra yeniden yazabilirsin.', en: '🐢 Slow mode: you can send again in {s}.' },
    'slowmode-wait-toast': { tr: 'Yavaş mod: {s} sonra gönderebilirsin.', en: 'Slow mode: you can send in {s}.' },
    'slowmode-changed-on': { tr: '{u} yavaş modu açtı ({d}).', en: '{u} turned on slow mode ({d}).' },
    'slowmode-changed-off': { tr: '{u} yavaş modu kapattı.', en: '{u} turned off slow mode.' },
    'hubset-sec-general': { tr: 'Genel', en: 'General' },
    'hubset-sec-general-desc': { tr: 'Lobinin adı, görseli ve görünümü.', en: 'Name, image and look of the lobby.' },
    'hubset-sec-visibility': { tr: 'Görünürlük ve Katılım', en: 'Visibility & joining' },
    'hubset-sec-visibility-desc': { tr: 'Lobinin Keşfet\'te görünüp görünmeyeceği ve insanların nasıl katılacağı.', en: 'Whether the lobby appears in Discover and how people join.' },
    'hubset-sec-permissions': { tr: 'Bahsetmeler', en: 'Mentions' },
    'hubset-sec-permissions-desc': { tr: '@everyone ile lobideki herkese bildirim gönderebilecek kişiler.', en: 'Who can notify everyone in the lobby with @everyone.' },
    'hubset-sec-invite': { tr: 'Davet', en: 'Invite' },
    'hubset-sec-invite-desc': { tr: 'Arkadaşlarını davet et ya da paylaşılabilir bir davet kodu oluştur.', en: 'Invite friends or create a shareable invite code.' },
    'hubset-sec-moderation': { tr: 'Moderasyon', en: 'Moderation' },
    'hubset-sec-moderation-desc': { tr: 'Yavaş mod, kelime filtresi, yasaklar, sesli oda susturmaları ve oda giriş engelleri.', en: 'Slow mode, word filter, bans, voice room mutes and room blocks.' },
    'hubset-sec-other': { tr: 'Diğer', en: 'Other' },
    'hubset-sec-other-desc': { tr: 'Bildirme ve geri alınamayan işlemler.', en: 'Reporting and irreversible actions.' },
    'hubset-danger-title': { tr: 'Tehlikeli bölge', en: 'Danger zone' },
    'hubset-name-label': { tr: 'Lobi adı', en: 'Lobby name' },
    'hubset-everyone-label': { tr: '@everyone kullanabilecekler', en: 'Who can use @everyone' },
    'hubset-everyone-owner': { tr: 'Yalnızca Lobi kurucusu', en: 'Lobby founder only' },
    'hubset-everyone-moderators': { tr: 'Kurucu ve moderatörler', en: 'Founder and moderators' },
    'hubset-everyone-everyone': { tr: 'Herkes', en: 'Everyone' },
    'hubset-everyone-nobody': { tr: 'Kimse (kapalı)', en: 'No one (off)' },
    'hubset-everyone-hint': { tr: 'Kişilere tek tek @ad ile bahsetmek her üyeye açıktır; bu ayar yalnızca @everyone içindir.', en: 'Mentioning people with @name is open to all members; this setting only covers @everyone.' },
    'hub-blocks-title-short': { tr: 'Oda Engelleri', en: 'Room blocks' },
    'conn-label': { tr: 'Sunucu bağlantısı', en: 'Server connection' },
    'conn-measuring': { tr: 'Ölçülüyor…', en: 'Measuring…' },
    'conn-polling': { tr: 'Yedek bağlantı (yavaş)', en: 'Fallback (slow)' },
    'conn-offline': { tr: 'Bağlı değil', en: 'Not connected' },
    'search-eyebrow': { tr: 'Mesajlarda ara', en: 'Search messages' },
    'search-placeholder': { tr: 'Kelime ara…', en: 'Search words…' },
    'search-hint': { tr: 'İpucu: "kimden:kullanıcıadı" ile yalnızca bir kişinin mesajlarında ara.', en: 'Tip: use "from:username" to search one person\'s messages.' },
    'search-no-results': { tr: 'Sonuç bulunamadı.', en: 'No results.' },
    'search-more': { tr: 'Daha fazla sonuç', en: 'More results' },
    'search-jump-latest': { tr: 'En yeni mesajlara dön', en: 'Jump to latest' },
    'typing-one': { tr: 'yazıyor…', en: 'is typing…' },
    'typing-and': { tr: 've', en: 'and' },
    'typing-many': { tr: 'yazıyor…', en: 'are typing…' },
    'typing-several': { tr: 'Birkaç kişi yazıyor…', en: 'Several people are typing…' },
    'msg-send-failed': { tr: 'Gönderilemedi', en: 'Not sent' },
    'mention-toast': { tr: 'senden bahsetti', en: 'mentioned you' },
    'mention-everyone-hint': { tr: 'Lobideki herkese bildirim', en: 'Notify everyone in the lobby' },
    'mention-badge-title': { tr: 'Senden bahsedildi', en: 'You were mentioned' },
    'hubset-eyebrow': { tr: 'Lobi Ayarları', en: 'Lobby settings' },
    'hubset-saved': { tr: 'Lobi ayarları kaydedildi.', en: 'Lobby settings saved.' },
    'feed-older-loading': { tr: 'Daha eski mesajlar yükleniyor…', en: 'Loading older messages…' },
    'feed-start': { tr: 'Sohbetin başı', en: 'Start of the conversation' },
    'hub-mutes-empty': { tr: 'Susturulan kimse yok.', en: 'No one is muted.' },
    'hub-mutes-unmute': { tr: 'Kaldır', en: 'Unmute' },
    'voice-mute-action': { tr: 'Sesli odada sustur', en: 'Mute in voice room' },
    'voice-mute-room-label': { tr: 'Oda', en: 'Room' },
    'voice-mute-duration-label': { tr: 'Süre', en: 'Duration' },
    'voice-mute-30': { tr: '30 dakika', en: '30 minutes' },
    'voice-mute-60': { tr: '60 dakika', en: '60 minutes' },
    'voice-mute-until': { tr: 'Kaldırılana kadar', en: 'Until lifted' },
    'voice-mute-until-hint': { tr: 'Bir moderatör ya da Lobi kurucusu kaldırana kadar sürer.', en: 'Lasts until a moderator or the lobby founder lifts it.' },
    'voice-mute-no-rooms': { tr: 'Bu Lobide sesli oda yok.', en: 'This lobby has no voice rooms.' },
    'voice-mute-done': { tr: 'Kullanıcı susturuldu.', en: 'User muted.' },
    'voice-unmute-done': { tr: 'Susturma kaldırıldı.', en: 'Mute lifted.' },
    'voice-unmute-confirm': { tr: 'Bu kullanıcının bu odadaki susturmasını kaldırmak istiyor musun?', en: 'Lift this user\'s mute in this room?' },
    'voice-muted-by-owner': { tr: 'Lobi kurucusu', en: 'The lobby founder' },
    'voice-muted-by-mod': { tr: 'Bir moderatör', en: 'A moderator' },
    'voice-muted-title': { tr: 'Bu odada susturuldun', en: 'You are muted in this room' },
    'voice-muted-remaining': { tr: 'Kalan süre', en: 'Time left' },
    'voice-muted-until-lifted': { tr: 'Süre: kaldırılana kadar', en: 'Duration: until lifted' },
    'voice-muted-share-note': { tr: 'Ekran paylaşırsan ekranın görünür, ama mikrofonun ve ekrandaki sesler izleyenlere iletilmez.', en: 'If you share your screen it stays visible, but your microphone and screen audio are not sent to viewers.' },
    'voice-muted-locked': { tr: 'Susturulduğun için mikrofonunu açamazsın.', en: 'You are muted and cannot turn your microphone on.' },
    'voice-unmuted-toast': { tr: 'Susturman kaldırıldı. Mikrofonunu istersen açabilirsin.', en: 'Your mute was lifted. You can turn your microphone on.' },
    'voice-unmuted-expired-toast': { tr: 'Susturma süren doldu. Mikrofonunu istersen açabilirsin.', en: 'Your mute expired. You can turn your microphone on.' },
    'voice-force-muted-tag': { tr: 'Susturuldu', en: 'Muted' },
    'voice-kick-action': { tr: 'Sesli odadan at', en: 'Remove from voice room' },
    'voice-kick-confirm': { tr: 'Bu kişiyi sesli odadan atmak istediğine emin misin? (İsterse yeniden girebilir.)', en: 'Remove this person from the voice room? (They can rejoin.)' },
    'voice-kick-done': { tr: 'Kişi sesli odadan atıldı.', en: 'Removed from the voice room.' },
    'voice-kick-now': { tr: 'Anlık (bağlantıyı kes)', en: 'Now (disconnect only)' },
    'voice-kick-now-hint': { tr: 'Kişi odadan çıkarılır, isterse hemen geri girebilir.', en: 'They are removed and can rejoin right away.' },
    'voice-kick-blocked-done': { tr: 'Kişi odadan atıldı ve girişi engellendi.', en: 'Removed and blocked from the room.' },
    'voice-kick-blocked-until': { tr: 'Bu odaya kaldırılana kadar giremezsin.', en: 'You cannot enter this room until it is lifted.' },
    'voice-kick-blocked-for': { tr: 'Bu odaya şu saate kadar giremezsin', en: 'You cannot enter this room until' },
    'voice-kick-can-rejoin': { tr: 'İstersen yeniden girebilirsin.', en: 'You can rejoin if you want.' },
    'voice-unblocked-toast': { tr: 'odasına artık girebilirsin.', en: 'room is open to you again.' },
    'hub-blocks-title': { tr: 'Odaya Girişi Engellenenler', en: 'Blocked from rooms' },
    'hub-blocks-empty': { tr: 'Girişi engellenen kimse yok.', en: 'No one is blocked.' },
    'hub-blocks-lift': { tr: 'Engeli kaldır', en: 'Lift' },
    'voice-kicked-text': { tr: 'seni bu sesli odadan attı', en: 'removed you from this voice room' },
    'hub-ban-search-placeholder': { tr: 'Kullanıcı adı ara...', en: 'Search username...' },
    'bans-back': { tr: 'Geri', en: 'Back' },
    'hub-ban-member': { tr: 'Katılımcı Yasakla', en: 'Ban a Member' },
    'hub-ban-picker-empty': { tr: 'Yasaklanabilecek katılımcı yok.', en: 'No members available to ban.' },
    'unban': { tr: 'Yasağı Kaldır', en: 'Unban' },
    'label-sessions': { tr: 'Aktif Oturumlar', en: 'Active Sessions' },
    'logout-all': { tr: 'Tüm Cihazlardan Çıkış Yap', en: 'Log Out of All Devices' },
    'delete-account': { tr: 'Hesabı Sil', en: 'Delete Account' },
    'unknown-device': { tr: 'Bilinmeyen Cihaz', en: 'Unknown Device' },
    'this-device': { tr: 'bu cihaz', en: 'this device' },
    'revoke': { tr: 'Kapat', en: 'Revoke' },
    'confirm-logout-all': { tr: 'Bu cihaz dışındaki tüm oturumlar kapatılacak. Emin misin?', en: 'All sessions except this device will be signed out. Are you sure?' },
    'logout-all-done': { tr: 'Diğer tüm cihazlardan çıkış yapıldı.', en: 'Signed out of all other devices.' },
    'delete-account-prompt': { tr: 'Hesabını kalıcı olarak silmek üzeresin. Onaylamak için kullanıcı adını yaz: {username}', en: 'You are about to permanently delete your account. Type your username to confirm: {username}' },
    'delete-account-password-required': { tr: 'Hesabı silmek için mevcut şifreni yaz.', en: 'Enter your current password to delete your account.' },
    'delete-account-password-placeholder': { tr: 'Mevcut şifren (hesabı silmek için)', en: 'Current password (to delete the account)' },
    'delete-account-mismatch': { tr: 'Kullanıcı adı eşleşmedi, hesap silinmedi.', en: "Username didn't match, account not deleted." },
    'attach-camera': { tr: 'Kamerayla Çek', en: 'Take Photo/Video' },
    'attach-gallery': { tr: 'Galeriden Seç', en: 'Choose from Gallery' },
    'attach-file': { tr: 'Dosya Seç', en: 'Choose File' },
    'attach-sticker': { tr: 'Çıkartma', en: 'Sticker' },
    'login-username-label': { tr: 'Kullanıcı Adın', en: 'Username' },
    'login-password-label': { tr: 'Şifren', en: 'Password' },
    'hub-settings-invite-friend': { tr: 'Arkadaşını Davet Et', en: 'Invite a Friend' },
    'hub-settings-invite-code': { tr: 'Davet Kodu Oluştur', en: 'Create Invite Code' },
    'hub-settings-delete': { tr: 'Lobiyi Sil', en: 'Delete Lobby' },
    'hub-settings-clear-chat': { tr: 'Lobi Sohbetini Temizle', en: 'Clear Lobby Chat' },
    'hub-clear-chat-confirm': { tr: 'Bu lobideki TÜM mesajlar herkes için kalıcı olarak silinecek. Bu işlem geri alınamaz. Devam etmek istiyor musun?', en: 'ALL messages in this lobby will be permanently deleted for everyone. This cannot be undone. Continue?' },
    'hub-chat-cleared': { tr: 'Lobi sohbeti temizlendi.', en: 'Lobby chat cleared.' },
    'call-ringing': { tr: 'Aranıyor...', en: 'Calling...' },
    'call-cancel': { tr: 'İptal Et', en: 'Cancel' },
    'call-decline': { tr: 'Reddet', en: 'Decline' },
    'call-accept': { tr: 'Kabul Et', en: 'Accept' },
    'call-incoming-sub': { tr: 'seni arıyor...', en: 'is calling you...' },
    'call-leave': { tr: 'Ayrıl', en: 'Leave' },
    'call-connected': { tr: 'Bağlandı', en: 'Connected' },
    'call-connecting': { tr: 'Bağlanıyor...', en: 'Connecting...' },
    'notif-friend-request': { tr: '1 arkadaşlık isteği', en: '1 friend request' },
    'notif-hub-invite': { tr: '1 lobi daveti', en: '1 lobby invite' },
    'notif-friend-accepted': { tr: 'Arkadaşlık isteğin kabul edildi', en: 'Your friend request was accepted' },
    'friend-request-notif-text': { tr: 'sana arkadaşlık isteği gönderdi', en: 'sent you a friend request' },
    'friend-accepted-notif-text': { tr: 'arkadaşlık isteğini kabul etti', en: 'accepted your friend request' },
    'ok-got-it': { tr: 'Tamam', en: 'Got it' },
    'friends-empty': { tr: 'Henüz arkadaşın yok.', en: "You don't have any friends yet." },
    'back-to-hubs': { tr: 'Lobiler', en: 'Lobbies' },
    'start-something': { tr: 'Bir şey başlat', en: 'Start something' },
    'start-poll': { tr: 'Oylama', en: 'Poll' },
    'start-share': { tr: 'Paylaşım', en: 'Share' },
    'member-count': { tr: 'kişi', en: 'members' },
    'voice-rooms-title': { tr: 'SESLİ ODALAR', en: 'VOICE ROOMS' },
    'voice-room-add': { tr: 'Oda Ekle', en: 'Add Room' },
    'voice-rooms-empty': { tr: 'Henüz sesli oda yok.', en: 'No voice rooms yet.' },
    'voice-room-members-btn': { tr: 'Odadakiler', en: 'In room' },
    'voice-mic-title': { tr: 'Mikrofon', en: 'Microphone' },
    'voice-speaker-title': { tr: 'Hoparlör (dinleme)', en: 'Speaker (listening)' },
    'voice-room-delete-confirm': { tr: 'Bu sesli odayı silmek istediğine emin misin?', en: 'Are you sure you want to delete this voice room?' },
    'voice-room-name-prompt': { tr: 'Oda adı:', en: 'Room name:' },
    'voice-room-join': { tr: 'Katıl', en: 'Join' },
    'voice-room-nobody-here': { tr: 'Bu odada henüz kimse yok.', en: 'Nobody is here yet.' },
    'voice-room-you': { tr: '(Sen)', en: '(You)' },
    'voice-mic-on': { tr: 'Mikrofon', en: 'Mic' },
    'voice-mic-off': { tr: 'Kapalı', en: 'Muted' },
    'voice-room-user-joined': { tr: 'odaya katıldı', en: 'joined the room' },
    'voice-room-user-left': { tr: 'odadan ayrıldı', en: 'left the room' },
    'voice-room-removed': { tr: 'Sesli odadan çıkarıldın.', en: 'You were removed from the voice room.' },
    'session-check-unreachable': { tr: 'Sunucuya şu an ulaşılamıyor; oturumun kapanmış olmayabilir. Biraz sonra sayfayı yenile.', en: 'The server is unreachable right now; your session may still be valid. Refresh in a moment.' },
    'settings-tab-voice': { tr: 'Ses', en: 'Voice' },
    'nc-desc': { tr: 'Klavye, fan ve arka plan gürültüsünü bastırır. Sesli oda ve özel aramada da açıp kapatabilirsin.', en: 'Suppresses keyboard, fan and background noise. You can also toggle it in voice rooms and private calls.' },
    'nc-unsupported': { tr: 'Bu cihazda gürültü engelleme desteklenmiyor.', en: 'Noise suppression is not supported on this device.' },
    'nc-state-on': { tr: 'Gürültü engelleme: açık', en: 'Noise suppression: on' },
    'nc-state-off': { tr: 'Gürültü engelleme: kapalı', en: 'Noise suppression: off' },
    'call-log-answered': { tr: 'Sesli arama', en: 'Voice call' },
    'call-log-missed-in': { tr: 'Cevapsız arama', en: 'Missed call' },
    'call-log-missed-out': { tr: 'Arama cevaplanmadı', en: 'Call not answered' },
    'call-log-declined-in': { tr: 'Aramayı reddettin', en: 'You declined the call' },
    'call-log-declined-out': { tr: 'Arama reddedildi', en: 'Call declined' },
    'call-log-min': { tr: 'dk', en: 'min' },
    'call-log-sec': { tr: 'sn', en: 's' },
    'call-no-answer': { tr: 'Cevap vermedi.', en: 'No answer.' },
    'notif-prompt-text': { tr: 'Arama ve mesajları uygulama kapalıyken de alabilmek için bildirimleri aç.', en: 'Turn on notifications to get calls and messages even when the app is closed.' },
    'notif-prompt-enable': { tr: 'Bildirimleri aç', en: 'Turn on' },
    'notif-prompt-later': { tr: 'Şimdi değil', en: 'Not now' },
    'menu-discover': { tr: 'Keşfet', en: 'Discover' },
    'discover-title': { tr: 'Keşfet', en: 'Discover' },
    'discover-subtitle': { tr: 'İlgi alanına uygun bir Lobi bul.', en: 'Find a Lobby that fits your interests.' },
    'discover-search-placeholder': { tr: 'Lobi ara...', en: 'Search lobbies...' },
    'discover-more': { tr: 'Daha fazla göster', en: 'Show more' },
    'discover-view-lobby': { tr: 'Lobiyi Gör', en: 'View Lobby' },
    'discover-report': { tr: 'Lobiyi Bildir', en: 'Report Lobby' },
    'discover-empty': { tr: 'Aramana uygun Lobi bulunamadı. Filtreleri değiştirmeyi dene.', en: 'No lobbies match your search. Try changing the filters.' },
    'discover-empty-none': { tr: 'Henüz keşfedilebilir Lobi yok.', en: 'There are no discoverable lobbies yet.' },
    'discover-error': { tr: 'Lobiler şu an alınamadı. Biraz sonra tekrar dene.', en: 'Could not load lobbies. Please try again shortly.' },
    'discover-all-cats': { tr: 'Tümü', en: 'All' },
    'discover-all-langs': { tr: 'Tüm diller', en: 'All languages' },
    'discover-all-policies': { tr: 'Her katılım türü', en: 'Any join type' },
    'discover-cat-oyun': { tr: 'Oyun', en: 'Gaming' },
    'discover-cat-sohbet': { tr: 'Sohbet', en: 'Chat' },
    'discover-cat-muzik': { tr: 'Müzik', en: 'Music' },
    'discover-cat-yayin': { tr: 'Yayın', en: 'Streaming' },
    'discover-cat-teknoloji': { tr: 'Teknoloji', en: 'Technology' },
    'discover-cat-spor': { tr: 'Spor', en: 'Sports' },
    'discover-cat-diger': { tr: 'Diğer', en: 'Other' },
    'discover-lang-tr': { tr: 'Türkçe', en: 'Turkish' },
    'discover-lang-en': { tr: 'English', en: 'English' },
    'discover-lang-other': { tr: 'Diğer / belirtilmemiş', en: 'Other / unspecified' },
    'discover-policy-everyone': { tr: 'Herkes katılabilir', en: 'Anyone can join' },
    'discover-policy-request': { tr: 'İstekle katılım', en: 'Join by request' },
    'discover-policy-owner_approval': { tr: 'Sahip onayıyla katılım', en: 'Owner approval required' },
    'discover-mic-required': { tr: 'Mikrofon zorunlu', en: 'Microphone required' },
    'discover-mic-preferred': { tr: 'Mikrofon tercih edilir', en: 'Microphone preferred' },
    'discover-mic-none': { tr: 'Mikrofon gerekli değil', en: 'Microphone not required' },
    'discover-members': { tr: 'üye', en: 'members' },
    'discover-in-voice': { tr: 'sesli odada', en: 'in voice' },
    'discover-owner': { tr: 'Sahibi', en: 'Owner' },
    'discover-fact-members': { tr: 'Üye', en: 'Members' },
    'discover-fact-category': { tr: 'Kategori', en: 'Category' },
    'discover-fact-topic': { tr: 'Konu', en: 'Topic' },
    'discover-fact-language': { tr: 'Dil', en: 'Language' },
    'discover-fact-join': { tr: 'Katılım', en: 'Joining' },
    'discover-fact-mic': { tr: 'Mikrofon', en: 'Microphone' },
    'discover-fact-status': { tr: 'Durum', en: 'Status' },
    'discover-status-open': { tr: 'Yer var', en: 'Open' },
    'discover-status-full': { tr: 'Dolu', en: 'Full' },
    'discover-purpose': { tr: 'Amaç', en: 'Purpose' },
    'discover-rules': { tr: 'Kurallar', en: 'Rules' },
    'discover-join': { tr: 'Lobiye Katıl', en: 'Join Lobby' },
    'discover-join-request': { tr: 'Katılma İsteği Gönder', en: 'Send Join Request' },
    'discover-go': { tr: 'Lobiye Git', en: 'Open Lobby' },
    'discover-requested': { tr: 'İstek gönderildi', en: 'Request sent' },
    'discover-full': { tr: 'Lobi dolu', en: 'Lobby is full' },
    'discover-joined-toast': { tr: 'Lobiye katıldın.', en: 'You joined the lobby.' },
    'discover-requested-toast': { tr: 'Katılma isteğin gönderildi. Sahibi onaylayınca üye olacaksın.', en: 'Join request sent. You will become a member once approved.' },
    'discover-decision-approved': { tr: 'Bir Lobiye katılma isteğin onaylandı.', en: 'Your join request was approved.' },
    'discover-decision-rejected': { tr: 'Bir Lobiye katılma isteğin reddedildi.', en: 'Your join request was declined.' },
    'discover-new-request': { tr: 'Lobinde yeni bir katılma isteği var.', en: 'There is a new join request in your lobby.' },
    'hubset-visibility': { tr: 'Görünürlük', en: 'Visibility' },
    'hubset-vis-private': { tr: 'Gizli (yalnızca üyeler)', en: 'Private (members only)' },
    'hubset-vis-invite_only': { tr: 'Yalnızca davetle', en: 'Invite only' },
    'hubset-vis-discoverable': { tr: 'Keşfedilebilir (Keşfet\'te listelenir)', en: 'Discoverable (listed in Discover)' },
    'hubset-vis-hint-private': { tr: 'Keşfet\'te görünmez. Üyeler davet koduyla katılır.', en: 'Not shown in Discover. Members join with an invite code.' },
    'hubset-vis-hint-invite_only': { tr: 'Keşfet\'te görünmez. Yalnızca davetle katılım.', en: 'Not shown in Discover. Join by invite only.' },
    'hubset-vis-hint-discoverable': { tr: 'Keşfet\'te herkes görebilir. Görünmek otomatik üyelik demek değildir; katılım yöntemini sen belirlersin.', en: 'Anyone can see it in Discover. Being visible does not mean automatic membership; you choose how people join.' },
    'hubset-category': { tr: 'Kategori', en: 'Category' },
    'hubset-category-pick': { tr: 'Kategori seç', en: 'Choose a category' },
    'hubset-topic': { tr: 'Konu / etiket (isteğe bağlı)', en: 'Topic / tag (optional)' },
    'hubset-topic-placeholder': { tr: 'Örn. Valorant', en: 'e.g. Valorant' },
    'hubset-description': { tr: 'Amaç / açıklama', en: 'Purpose / description' },
    'hubset-description-placeholder': { tr: 'Lobi ne amaçla kullanılacak?', en: 'What is this lobby for?' },
    'hubset-rules': { tr: 'Kurallar (her satıra bir kural)', en: 'Rules (one per line)' },
    'hubset-rules-placeholder': { tr: 'Saygılı iletişim.\nHakaret ve taciz yok.', en: 'Be respectful.\nNo insults or harassment.' },
    'hubset-language': { tr: 'Dil', en: 'Language' },
    'hubset-join-policy': { tr: 'Katılım yöntemi', en: 'Join method' },
    'hubset-mic': { tr: 'Mikrofon koşulu', en: 'Microphone requirement' },
    'hubset-capacity': { tr: 'Kapasite (boş = sınırsız)', en: 'Capacity (empty = unlimited)' },
    'hubset-requests': { tr: 'Katılma İstekleri', en: 'Join Requests' },
    'hubset-requests-empty': { tr: 'Bekleyen istek yok.', en: 'No pending requests.' },
    'hubset-approve': { tr: 'Onayla', en: 'Approve' },
    'hubset-reject': { tr: 'Reddet', en: 'Decline' },
    'fav-title': { tr: 'Sık Tercihlerim', en: 'Favorites' },
    'discover-search-toggle': { tr: 'Ara ve filtrele', en: 'Search and filter' },
    'discover-like': { tr: 'Beğen', en: 'Like' },
    'discover-liked-today': { tr: 'Bugün beğendin', en: 'Liked today' },
    'discover-liked-tomorrow': { tr: 'Yarın yeniden beğenebilirsin.', en: 'You can like again tomorrow.' },
    'discover-like-reason-not_member': { tr: 'Beğenmek için Lobiye üye olmalısın.', en: 'Join the lobby to like it.' },
    'discover-like-reason-already_today': { tr: 'Bugün bu Lobiyi zaten beğendin. Yarın tekrar beğenebilirsin.', en: 'You already liked this lobby today. You can like again tomorrow.' },
    'discover-level': { tr: 'Seviye', en: 'Level' },
    'discover-level-short': { tr: 'Sv.', en: 'Lv.' },
    'discover-level-progress': { tr: 'puan', en: 'points' },
    'discover-points-30d': { tr: 'Son 30 gün', en: 'Last 30 days' },
    'discover-superlike': { tr: 'Süper Beğeni', en: 'Super Like' },
    'coin-buy-soon': { tr: 'Sauran Coin satın alma yakında...', en: 'Sauran Coin purchases coming soon...' },
    'coin-not-enough': { tr: 'Yeterli Sauran Coin\'in yok. Coin satın alma yakında.', en: 'Not enough Sauran Coin. Purchases coming soon.' },
    'discover-superlike-confirm': { tr: 'Onayla', en: 'Confirm' },
    'discover-superlike-sent': { tr: 'Süper Beğeni gönderildi ⚡ (+25 puan)', en: 'Super Like sent ⚡ (+25 points)' },
    'discover-superlike-limit-user': { tr: 'Bu Lobiye bugünkü Süper Beğeni hakkın doldu.', en: 'You reached today\'s Super Like limit for this lobby.' },
    'discover-superlike-limit-lobby': { tr: 'Bu Lobi bugün alabileceği Süper Beğeni sınırına ulaştı.', en: 'This lobby reached today\'s Super Like limit.' },
    'discover-super-received': { tr: 'Lobinize Süper Beğeni atıldı ⚡', en: 'Your lobby received a Super Like ⚡' },
    'discover-superlike-info': { tr: 'Süper Beğeni: {cost} Coin, +{points} Keşfet puanı (yalnızca son 30 gün; seviyeyi etkilemez).', en: 'Super Like: {cost} Coin, +{points} Discover points (last 30 days only; does not affect level).' },
    'discover-like-reason-account_new': { tr: 'Lobileri beğenebilmek için hesabının en az 3 günlük olması gerekiyor.', en: 'Your account must be at least 3 days old to like lobbies.' },
    'discover-like-reason-member_new': { tr: 'Bu Lobiyi beğenebilmek için en az 24 saat üye olmalısın.', en: 'You must be a member for at least 24 hours to like this lobby.' },
    'discover-like-hint-account_new': { tr: 'Hesabın 3 günlük olduğunda kullanılabilir.', en: 'Available once your account is 3 days old.' },
    'discover-like-hint-member_new': { tr: 'Bu Lobide 24 saat üye olduktan sonra kullanılabilir.', en: 'Available after 24 hours of membership.' },
    'discover-like-hint-not_member': { tr: 'Beğenmek için Lobiye üye ol.', en: 'Join the lobby to like it.' },
    'discover-level-note': { tr: 'Seviye toplam puandan gelir; Keşfet sıralaması son 30 günün puanına göredir. Her beğeni 5 puandır. Süper Beğeni seviyeyi etkilemez.', en: 'Level comes from total points; Discover ranking uses the last 30 days. Each like is worth 5 points. Super Likes do not affect level.' },
    'hint-call-controls-room': { tr: 'Mikrofon, gürültü engelleme ve diğer ses ayarları için yeşil oda etiketine dokun.', en: 'For microphone, noise suppression and other audio controls, tap the green room label.' },
    'hint-call-controls-dm': { tr: 'Mikrofon ve gürültü engelleme için küçük görüşme çubuğundaki genişlet düğmesine dokun.', en: 'For microphone and noise suppression, tap the expand button on the small call bar.' },
    'nc-label': { tr: 'Gürültü engelleme (yalnızca konuşma)', en: 'Noise suppression (voice only)' },
    'ptt-label': { tr: 'Bas-konuş', en: 'Push to talk' },
    'ptt-desc': { tr: 'Mikrofonun yalnızca bir tuşu (ya da ekrandaki 🎙 düğmesini) basılı tuttuğun sürece açılır. Sesli oda ve özel aramada geçerlidir.', en: 'Your mic is live only while you hold a key (or the 🎙 button on screen). Applies to voice rooms and private calls.' },
    'ptt-key': { tr: 'Tuş:', en: 'Key:' },
    'ptt-change': { tr: 'Değiştir', en: 'Change' },
    'ptt-press-key': { tr: 'Bir tuşa bas…', en: 'Press a key…' },
    'ptt-key-hint': { tr: 'Harf ya da rakam tuşu seçersen, sohbete yazı yazarken bas-konuş çalışmaz. F tuşları, Ctrl, Alt, CapsLock ya da farenin yan tuşları her zaman çalışır. Telefonda ekrandaki düğmeyi kullan.', en: 'If you pick a letter or digit, push to talk won\'t fire while you\'re typing in chat. F-keys, Ctrl, Alt, CapsLock or side mouse buttons always work. On phones, use the on-screen button.' },
    'ptt-hold': { tr: 'Konuşmak için basılı tut', en: 'Hold to talk' },
    'ptt-hold-key': { tr: 'Konuşmak için basılı tut · {k}', en: 'Hold to talk · {k}' },
    'ptt-talking': { tr: 'Konuşuyorsun…', en: 'Talking…' },
    'ptt-mute-hint': { tr: 'Bas-konuş açık: konuşmak için {k} tuşunu ya da 🎙 düğmesini basılı tut.', en: 'Push to talk is on: hold {k} or the 🎙 button to talk.' },
    'nc-failed': { tr: 'Gürültü engelleme bu cihazda çalışmadı; kapatıldı.', en: 'Noise suppression did not work on this device; turned off.' },
    'voice-recovering': { tr: 'Ses bağlantısı yeniden kuruluyor...', en: 'Restoring audio connection...' },
    'voice-recover-failed': { tr: 'Mikrofon geri açılamadı. Mikrofon iznini kontrol et; sorun sürerse odadan çıkıp tekrar gir.', en: 'Could not restore the microphone. Check the microphone permission; if it persists, leave and rejoin.' },
    'audio-mic-title': { tr: 'Mikrofon', en: 'Microphone' },
    'audio-out-title': { tr: 'Ses çıkışı', en: 'Audio output' },
    'audio-default': { tr: 'Varsayılan', en: 'Default' },
    'audio-route-speaker': { tr: 'Hoparlör', en: 'Speaker' },
    'audio-route-earpiece': { tr: 'Telefon ahizesi', en: 'Phone earpiece' },
    'audio-route-bluetooth': { tr: 'Bluetooth', en: 'Bluetooth' },
    'audio-route-wired': { tr: 'Kablolu kulaklık', en: 'Wired headset' },
    'audio-route-usb': { tr: 'USB ses', en: 'USB audio' },
    'audio-route-other': { tr: 'Diğer', en: 'Other' },
    'voice-room-replaced': { tr: 'Başka bir cihazdan bu odaya katıldın.', en: 'You joined this room from another device.' },
    'notif-pref-voice-presence': { tr: 'Sesli oda katılma/ayrılma bildirimleri', en: 'Voice room join/leave notices' },
    'notif-pref-voice-sound': { tr: 'Sesli oda katılma/ayrılma sesi', en: 'Voice room join/leave sound' },

    // Dinamik JS metinleri (t() ile kullanılır)
    'send': { tr: 'Gönder', en: 'Send' },
    'save': { tr: 'Kaydet', en: 'Save' },
    'cancel': { tr: 'Vazgeç', en: 'Cancel' },
    'delete': { tr: 'Sil', en: 'Delete' },
    'edit': { tr: 'Düzenle', en: 'Edit' },
    'my-status': { tr: 'Durumum', en: 'My Status' },
    'remove-photo': { tr: 'Kaldır', en: 'Remove' },
    'confirm-delete-message': { tr: 'Bu mesajı silmek istediğine emin misin?', en: 'Are you sure you want to delete this message?' },
    'message-deleted': { tr: 'Bu mesaj silindi', en: 'This message was deleted' },
    'media-expired': { tr: 'medya süresi doldu (silindi)', en: 'media expired (deleted)' },
    'deleted-account-label': { tr: 'Silinmiş hesap', en: 'Deleted account' },
    'deleted-account-message': { tr: 'Silinmiş hesabın mesajı', en: 'Message from a deleted account' },
    'deleted-dm-readonly': { tr: 'Bu kişi hesabını sildi. Bu sohbet salt okunurdur.', en: 'This person deleted their account. This conversation is read-only.' },
    'deleted-dm-expires': { tr: 'Bu sohbet {date} tarihinde otomatik olarak silinecek.', en: 'This conversation will be deleted automatically on {date}.' },
    'deleted-dm-delete': { tr: 'Sohbeti sil', en: 'Delete conversation' },
    'deleted-dm-delete-confirm': { tr: 'Bu sohbetteki tüm mesajlar (senin mesajların dahil) kalıcı olarak silinsin mi?', en: 'Permanently delete all messages in this conversation (including your own)?' },
    'edited-tag': { tr: '(düzenlendi)', en: '(edited)' },
    'hub-feed-empty': { tr: 'Henüz bir şey olmadı. İlk hareketi sen yap.', en: "Nothing here yet. Make the first move." },
    'connecting': { tr: 'Bağlanıyor...', en: 'Connecting...' },
    'file-limit-toast': { tr: "Dosya limiti 10 MB'dir.", en: 'File limit is 10 MB.' },
    'video-limit-toast': { tr: "Video limiti 10 MB'dir.", en: 'Video limit is 10 MB.' },

    'message-reply': { tr: 'Yanıtla', en: 'Reply' },
    'message-react': { tr: 'Tepki ekle', en: 'Add reaction' },
    'message-copy': { tr: 'Kopyala', en: 'Copy' },
    'message-copy-link': { tr: 'Bağlantıyı kopyala', en: 'Copy link' },
    'message-forward': { tr: 'İlet', en: 'Forward' },
    'message-edit': { tr: 'Düzenle', en: 'Edit' },
    'message-delete': { tr: 'Sil', en: 'Delete' },
    'message-pin': { tr: 'Sabitle', en: 'Pin' },
    'message-unpin': { tr: 'Sabitlemeyi kaldır', en: 'Unpin' },
    'message-report': { tr: 'Bildir', en: 'Report' },
    'message-copied': { tr: 'Kopyalandı', en: 'Copied' },
    'message-link-copied': { tr: 'Bağlantı kopyalandı', en: 'Link copied' },
    'message-edited': { tr: 'Mesaj düzenlendi', en: 'Message edited' },
    'message-forwarded': { tr: 'İletildi', en: 'Forwarded' },
    'message-pinned': { tr: '📌 Sabitlendi', en: '📌 Pinned' },
    'message-unpinned': { tr: 'Sabitleme kaldırıldı', en: 'Unpinned' },
    'message-replying': { tr: '↩ Yanıtlanıyor', en: '↩ Replying' },
    'message-cancel-reply': { tr: 'Yanıtı iptal et', en: 'Cancel reply' },
    'message-more-actions': { tr: 'Diğer aksiyonlar', en: 'More actions' },
    'message-reply-deleted': { tr: 'Silinmiş mesaj', en: 'Deleted message' },
    'forward-no-friends': { tr: 'İletebileceğin arkadaşın yok.', en: "You don't have friends to forward to." },
    'reply-select-quick-emoji': { tr: 'Hızlı tepkiler', en: 'Quick reactions' },

    'report-user': { tr: 'Bildir', en: 'Report' },
    'report-modal-title': { tr: 'Bildir', en: 'Report' },
    'report-reason-label': { tr: 'Neden', en: 'Reason' },
    'report-reason-harassment': { tr: 'Taciz', en: 'Harassment' },
    'report-reason-threat': { tr: 'Tehdit', en: 'Threat' },
    'report-reason-spam': { tr: 'Spam', en: 'Spam' },
    'report-reason-scam': { tr: 'Dolandırıcılık', en: 'Scam' },
    'report-reason-inappropriate': { tr: 'Uygunsuz içerik', en: 'Inappropriate content' },
    'report-reason-child_safety': { tr: 'Çocuk güvenliği', en: 'Child safety' },
    'report-reason-hate': { tr: 'Nefret / ayrımcılık', en: 'Hate / discrimination' },
    'report-reason-impersonation': { tr: 'Sahte hesap / taklit', en: 'Fake account / impersonation' },
    'report-reason-other': { tr: 'Diğer', en: 'Other' },
    'report-description-placeholder': { tr: 'Ek açıklama (opsiyonel). Sağlık, din, cinsel hayat gibi hassas kişisel bilgileri yazma.', en: 'Additional details (optional). Do not write sensitive personal information such as health, religion or sexual life.' },
    'report-submit': { tr: 'Bildir', en: 'Submit report' },
    'report-success-toast': { tr: 'Bildirimin alındı, teşekkürler.', en: 'Your report was received, thank you.' },
    'report-error-toast': { tr: 'Bildirim gönderilemedi.', en: 'Could not send report.' },
    'hub-settings-report': { tr: 'Lobiyi Bildir', en: 'Report Lobby' },
    'hub-member-notifications': { tr: 'Lobi Bildirimleri', en: 'Lobby Notifications' },
    'hub-member-leave': { tr: 'Lobiden Ayrıl', en: 'Leave Lobby' },
    'confirm-leave-hub': { tr: '"{name}" lobisinden ayrılıyorsun, onaylıyor musun?', en: 'You are leaving "{name}". Are you sure?' },
    'left-hub-toast': { tr: 'Lobiden ayrıldın.', en: 'You left the lobby.' },
    'label-legal': { tr: 'Gizlilik ve Yasal', en: 'Privacy & Legal' },
    'settings-privacy-policy': { tr: 'Gizlilik Politikası', en: 'Privacy Policy' },
    'settings-terms': { tr: 'Kullanım Şartları', en: 'Terms of Service' },
    'settings-export-data': { tr: 'Verilerimi İndir', en: 'Export My Data' },
    'settings-support': { tr: 'Destek & İletişim', en: 'Support & Contact' },
    'settings-community': { tr: 'Topluluk Kuralları', en: 'Community Guidelines' },
    'settings-child-safety': { tr: 'Çocuk Güvenliği', en: 'Child Safety' },
    'export-data-error': { tr: 'Verilerin indirilemedi.', en: 'Could not export your data.' }
};

function t(key) {
    const lang = localStorage.getItem('sauran_lang') || 'tr';
    const entry = I18N[key];
    if (!entry) return key;
    return entry[lang] || entry.tr;
}

function applyLanguage(lang) {

    Object.entries(TRANSLATIONS).forEach(([id, text]) => {
        const el = document.getElementById(id);
        if (el) el.textContent = text[lang] || text.tr;
    });

    Object.entries(TRANSLATIONS_PLACEHOLDER).forEach(([id, text]) => {
        const el = document.getElementById(id);
        if (el) el.placeholder = text[lang] || text.tr;
    });

    document.querySelectorAll('[data-i18n]').forEach((el) => {
        const entry = I18N[el.dataset.i18n];
        if (entry) el.textContent = entry[lang] || entry.tr;
    });

    document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
        const entry = I18N[el.dataset.i18nPlaceholder];
        if (entry) el.placeholder = entry[lang] || entry.tr;
    });

    document.documentElement.lang = lang;

    // Açık olan sohbetlerdeki dinamik metinleri (saat, "silindi" vb.) tazele.
    if (currentHub) loadHubMessages(currentHub.id);
    if (activeDmUserId) openDm(activeDmUserId, activeDmUsername);

    // Yukarıdaki genel data-i18n döngüsü bildirim izni metnini masaüstü
    // versiyonuna geri döndürüyor olabilir — mobil/masaüstü ayrımını yeniden uygula.
    updateBrowserNotifUI();

}


// İlk uygulanış (currentHub/activeDmUserId henüz tanımlanmadığı için
// dosyanın sonunda, tüm let/const bildirimleri tamamlandıktan sonra çağrılır).


settingsPasswordBtn.addEventListener(
    'click',
    async () => {

        const currentPassword = settingsCurrentPassword.value;
        const newPassword = settingsNewPassword.value;

        settingsPasswordError.textContent = '';

        if (!currentPassword || !newPassword) {
            settingsPasswordError.textContent = 'İki alanı da doldurmalısın.';
            return;
        }

        settingsPasswordBtn.disabled = true;

        try {

            const response = await fetch('/api/profile/password', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ current_password: currentPassword, new_password: newPassword })
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                settingsPasswordError.textContent = data.error || 'Güncellenemedi.';
                return;
            }

            settingsCurrentPassword.value = '';
            settingsNewPassword.value = '';
            settingsPasswordError.textContent = 'Şifren güncellendi.';
            settingsPasswordError.style.color = '#57f287';

        } catch (error) {

            console.error('Şifre güncellenemedi:', error);
            settingsPasswordError.textContent = 'Sunucuya bağlanılamadı.';

        } finally {

            settingsPasswordBtn.disabled = false;

        }

    }
);


// =====================================================
// PROFİL MODALI AÇ / KAPAT
// =====================================================

profileBtn.addEventListener(
    'click',
    () => {

        profileModal.style.display =
            'flex';

        const aboutInput = document.getElementById('about-me-input');
        const aboutCount = document.getElementById('about-me-count');
        if (aboutInput) {
            const max = currentUser?.plus_active ? 600 : 300;
            aboutInput.maxLength = max;
            aboutInput.value = currentUser?.about_me || '';
            if (aboutCount) aboutCount.textContent = `${aboutInput.value.length}/${max}`;
        }
        renderActivityControls();

    }
);


// =====================================================
// HAKKIMDA (kendi profilim)
// =====================================================

document.getElementById('about-me-input')?.addEventListener('input', (event) => {
    const count = document.getElementById('about-me-count');
    if (count) count.textContent = `${event.target.value.length}/${event.target.maxLength}`;
});

// Sauran Plus: Sohbet Teması seçici — Plus olmayanlar seçenekleri görür ama seçemez, "yakında" değil
// "Plus gerekli" ipucu görürler (özellik gerçekten var, sadece abonelik şartlı).
function renderChatThemePicker() {
    const picker = document.getElementById('chat-theme-picker');
    const hint = document.getElementById('chat-theme-hint');
    if (!picker || !currentUser) return;
    const isPlus = Boolean(currentUser.plus_active);
    const active = currentUser.chat_theme || 'classic';
    picker.querySelectorAll('.chat-theme-option').forEach((btn) => {
        const theme = btn.dataset.theme;
        const locked = theme !== 'classic' && !isPlus;
        btn.disabled = locked;
        btn.classList.toggle('selected', theme === active);
        btn.title = locked ? 'Sauran Plus gerekli' : '';
    });
    hint.textContent = isPlus ? '' : 'Yumuşak ve Kontrast temaları Sauran Plus abonelerine açıktır.';
}

document.getElementById('chat-theme-picker')?.addEventListener('click', async (event) => {
    const btn = event.target.closest('.chat-theme-option');
    if (!btn || btn.disabled) return;
    const theme = btn.dataset.theme;
    try {
        const response = await fetch('/api/profile/chat-theme', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ chat_theme: theme })
        });
        const data = await response.json();
        if (!data.success) { showToast(data.error || 'Güncellenemedi.'); return; }
        currentUser.chat_theme = data.chat_theme;
        renderChatThemePicker();
    } catch (error) {
        console.error('Sohbet teması güncellenemedi:', error);
        showToast('Güncellenemedi.');
    }
});

// Profil rengi (Profil penceresinde, herkese açık).
function renderProfileColorPicker() {
    const input = document.getElementById('profile-color-input');
    const saveBtn = document.getElementById('profile-color-save-btn');
    const resetBtn = document.getElementById('profile-color-reset-btn');
    const hint = document.getElementById('profile-color-hint');
    if (!input || !currentUser) return;
    input.disabled = false;
    saveBtn.disabled = false;
    resetBtn.disabled = !currentUser.profile_color;
    input.value = currentUser.profile_color || getUserColor(currentUser.username);
    if (hint) hint.textContent = '';
}

async function saveProfileColor(color) {
    try {
        const response = await fetch('/api/profile/color', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ profile_color: color })
        });
        const data = await response.json();
        if (!data.success) { showToast(data.error || 'Güncellenemedi.'); return; }
        currentUser.profile_color = data.profile_color;
        resolveUserColor(currentUser.id, currentUser.username, currentUser.profile_color);
        renderProfileColorPicker();
        renderProfile();
    } catch (error) {
        console.error('Profil rengi güncellenemedi:', error);
        showToast('Güncellenemedi.');
    }
}

document.getElementById('profile-color-save-btn')?.addEventListener('click', () => {
    const input = document.getElementById('profile-color-input');
    if (input && !input.disabled) saveProfileColor(input.value);
});
document.getElementById('profile-color-reset-btn')?.addEventListener('click', () => {
    const btn = document.getElementById('profile-color-reset-btn');
    if (!btn.disabled) saveProfileColor(null);
});

// Ekran paylaşımı FPS seçici: 60 (Plus, deneysel) / 30 / 15. Son seçim hatırlanır.
function askShareFps() {
    return new Promise((resolve) => {
        const modal = document.getElementById('share-fps-modal');
        const isPlus = Boolean(currentUser?.plus_active);
        let last = '30';
        try { last = localStorage.getItem('sauran_share_fps') || '30'; } catch (_) {}
        if (last === '60' && !isPlus) last = '30';
        const opts = [...modal.querySelectorAll('.share-fps-opt')];
        const closeBtn = document.getElementById('share-fps-close-btn');
        const finish = (value) => {
            modal.style.display = 'none';
            opts.forEach((o) => { o.onclick = null; });
            closeBtn.onclick = null;
            modal.onclick = null;
            resolve(value);
        };
        opts.forEach((opt) => {
            const fps = opt.dataset.fps;
            opt.disabled = fps === '60' && !isPlus;
            opt.classList.toggle('selected', fps === last);
            opt.onclick = () => {
                try { localStorage.setItem('sauran_share_fps', fps); } catch (_) {}
                finish(fps);
            };
        });
        closeBtn.onclick = () => finish(null);
        modal.onclick = (e) => { if (e.target === modal) finish(null); };
        modal.style.display = 'flex';
    });
}

async function startScreenShareWithFps(fps, quality) {
    // Susturulmuş kullanıcı ekran paylaşabilir ama ekran sesi hiç yakalanmaz (Daily izni de zaten iletmez).
    const muteOpts = voiceForceMute ? { displayMediaOptions: { audio: false } } : {};
    if (voiceForceMute) showToast(t('voice-muted-share-note'));
    const layers = {
        '60': { low: { maxBitrate: 600000, maxFramerate: 15, scaleResolutionDownBy: 2 }, medium: { maxBitrate: 1200000, maxFramerate: 30, scaleResolutionDownBy: 1 }, high: { maxBitrate: 2500000, maxFramerate: 60, scaleResolutionDownBy: 1 } },
        '15': { low: { maxBitrate: 400000, maxFramerate: 15, scaleResolutionDownBy: 2 }, medium: { maxBitrate: 800000, maxFramerate: 15, scaleResolutionDownBy: 1 }, high: { maxBitrate: 1500000, maxFramerate: 15, scaleResolutionDownBy: 1 } }
    };
    if (fps === '30' || !layers[fps]) {
        await callFrame.startScreenShare({ ...muteOpts, screenVideoSendSettings: { maxQuality: quality } });
        return;
    }
    try {
        await callFrame.startScreenShare({ ...muteOpts, screenVideoSendSettings: { encodings: layers[fps] } });
    } catch (error) {
        // Kullanıcı tarayıcı seçicisini iptal ettiyse hatayı yukarı bırak; ayar reddedildiyse standart kaliteye dön.
        if (error?.name === 'NotAllowedError') throw error;
        console.warn(fps + ' FPS ayarı reddedildi, standart kaliteye dönülüyor:', error);
        await callFrame.startScreenShare({ ...muteOpts, screenVideoSendSettings: { maxQuality: quality } });
    }
}

// "Şu an ne oynuyorum": kullanıcı yazar, isterse paylaşımı kapatır; yalnızca arkadaşlar görür.
let autoGameInitDone = false;
function renderActivityControls() {
    const input = document.getElementById('activity-input');
    const toggle = document.getElementById('activity-show-toggle');
    if (!input || !currentUser) return;
    if (!autoGameInitDone) { autoGameInitDone = true; initAutoGameToggle(); }
    input.value = currentUser.activity_text || '';
    toggle.checked = currentUser.show_activity !== false;
}

// Sauran Windows uygulaması (window.sauranDesktop): kullanıcı açık rıza verirse çalışan tanınmış oyunu algılar.
// Oyun adı otomatik yazılır (auto=true → sunucu kalp atışı kesilirse 20 dk sonra gizler), oyun kapanınca temizlenir.
let autoGameCleanup = null;
let autoGameHeartbeat = null;
let autoGameCurrent = null;

function stopAutoGame(clearActivity) {
    if (autoGameCleanup) { autoGameCleanup(); autoGameCleanup = null; }
    if (autoGameHeartbeat) { clearInterval(autoGameHeartbeat); autoGameHeartbeat = null; }
    window.sauranDesktop?.setDetection(false);
    if (clearActivity && autoGameCurrent) saveActivity({ activity_text: '' });
    autoGameCurrent = null;
}

function startAutoGame() {
    if (!window.sauranDesktop || autoGameCleanup) return;
    const apply = (game) => {
        if (game === autoGameCurrent) return;
        autoGameCurrent = game;
        if (game) saveActivity({ activity_text: game, auto: true });
        else saveActivity({ activity_text: '' });
    };
    autoGameCleanup = window.sauranDesktop.onGame(apply);
    autoGameHeartbeat = setInterval(() => {
        if (autoGameCurrent) saveActivity({ activity_text: autoGameCurrent, auto: true });
    }, 5 * 60 * 1000);
    window.sauranDesktop.setDetection(true);
}

function initAutoGameToggle() {
    const row = document.getElementById('activity-auto-row');
    const toggle = document.getElementById('activity-auto-toggle');
    if (!row || !toggle || !window.sauranDesktop?.isDesktop) return;
    row.style.display = '';
    let enabled = false;
    try { enabled = localStorage.getItem('sauran_auto_game') === '1'; } catch (_) {}
    toggle.checked = enabled;
    if (enabled) startAutoGame();
    toggle.addEventListener('change', () => {
        try { localStorage.setItem('sauran_auto_game', toggle.checked ? '1' : '0'); } catch (_) {}
        if (toggle.checked) startAutoGame(); else stopAutoGame(true);
    });
}

async function saveActivity(payload) {
    try {
        const response = await fetch('/api/profile/activity', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(payload)
        });
        const data = await response.json();
        if (!data.success) { showToast(data.error || 'Güncellenemedi.'); return false; }
        currentUser.activity_text = data.activity_text;
        currentUser.show_activity = data.show_activity;
        renderActivityControls();
        return true;
    } catch (error) {
        console.error('Etkinlik güncellenemedi:', error);
        showToast('Güncellenemedi.');
        return false;
    }
}

document.getElementById('activity-save-btn')?.addEventListener('click', async () => {
    if (await saveActivity({ activity_text: document.getElementById('activity-input').value })) showToast('Kaydedildi.');
});
document.getElementById('activity-clear-btn')?.addEventListener('click', () => saveActivity({ activity_text: '' }));
document.getElementById('activity-show-toggle')?.addEventListener('change', (event) => saveActivity({ show_activity: event.target.checked }));

// Sauran Plus: isim efekti (kullanıcı adı metninde animasyon). Aynı kilit deseni.
function renderNameEffectPicker() {
    const picker = document.getElementById('name-effect-picker');
    const hint = document.getElementById('name-effect-hint');
    if (!picker || !currentUser) return;
    const allowed = userHasFeature('name_effect');
    const active = currentUser.name_effect || 'none';
    picker.querySelectorAll('.chat-theme-option').forEach((btn) => {
        const fx = btn.dataset.nfx;
        btn.disabled = fx !== 'none' && !allowed;
        btn.classList.toggle('selected', fx === active);
        btn.title = btn.disabled ? 'Sauran Plus gerekli' : '';
    });
    hint.textContent = allowed ? '' : 'İsim efektleri Sauran Plus abonelerine açıktır.';
}

document.getElementById('name-effect-picker')?.addEventListener('click', async (event) => {
    const btn = event.target.closest('.chat-theme-option');
    if (!btn || btn.disabled) return;
    try {
        const response = await fetch('/api/profile/name-effect', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ name_effect: btn.dataset.nfx })
        });
        const data = await response.json();
        if (!data.success) { showToast(data.error || 'Güncellenemedi.'); return; }
        currentUser.name_effect = data.name_effect;
        renderNameEffectPicker();
        renderProfile();
    } catch (error) {
        console.error('İsim efekti güncellenemedi:', error);
        showToast('Güncellenemedi.');
    }
});

// Sauran Plus: mesaj balonu stili. Aynı kilit deseni.
function renderBubbleStylePicker() {
    const picker = document.getElementById('bubble-style-picker');
    const hint = document.getElementById('bubble-style-hint');
    if (!picker || !currentUser) return;
    const isPlus = Boolean(currentUser.plus_active);
    const active = currentUser.bubble_style || 'default';
    picker.querySelectorAll('.chat-theme-option').forEach((btn) => {
        const style = btn.dataset.bubble;
        btn.disabled = style !== 'default' && !isPlus;
        btn.classList.toggle('selected', style === active);
        btn.title = btn.disabled ? 'Sauran Plus gerekli' : '';
    });
    hint.textContent = isPlus ? '' : 'Mesaj balonu stilleri Sauran Plus abonelerine açıktır.';
}

document.getElementById('bubble-style-picker')?.addEventListener('click', async (event) => {
    const btn = event.target.closest('.chat-theme-option');
    if (!btn || btn.disabled) return;
    try {
        const response = await fetch('/api/profile/bubble-style', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ bubble_style: btn.dataset.bubble })
        });
        const data = await response.json();
        if (!data.success) { showToast(data.error || 'Güncellenemedi.'); return; }
        currentUser.bubble_style = data.bubble_style;
        renderBubbleStylePicker();
        document.querySelectorAll('.hub-msg, .dm-msg').forEach((el) => {
            if (String(el.dataset.userId || '') === String(currentUser.id)) applyChatTheme(el, currentUser.id, currentUser.chat_theme, data.bubble_style, el.querySelector('.hub-msg-bubble') || el);
        });
    } catch (error) {
        console.error('Balon stili güncellenemedi:', error);
        showToast('Güncellenemedi.');
    }
});

// Sauran Plus: profil teması (pencerenin renk şeması). Aynı kilit deseni.
function renderProfileThemePicker() {
    const picker = document.getElementById('profile-theme-picker');
    const hint = document.getElementById('profile-theme-hint');
    if (!picker || !currentUser) return;
    const allowed = userHasFeature('profile_theme');
    const active = currentUser.profile_theme || 'default';
    picker.querySelectorAll('.chat-theme-option').forEach((btn) => {
        const theme = btn.dataset.ptheme;
        btn.disabled = theme !== 'default' && !allowed;
        btn.classList.toggle('selected', theme === active);
        btn.title = btn.disabled ? 'Sauran Plus gerekli' : '';
    });
    hint.textContent = allowed ? '' : 'Profil temaları Sauran Plus abonelerine açıktır.';
}

function applyProfileTheme(boxEl, theme) {
    if (boxEl) boxEl.dataset.profileTheme = theme || 'default';
}

document.getElementById('profile-theme-picker')?.addEventListener('click', async (event) => {
    const btn = event.target.closest('.chat-theme-option');
    if (!btn || btn.disabled) return;
    try {
        const response = await fetch('/api/profile/theme', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ profile_theme: btn.dataset.ptheme })
        });
        const data = await response.json();
        if (!data.success) { showToast(data.error || 'Güncellenemedi.'); return; }
        currentUser.profile_theme = data.profile_theme;
        renderProfileThemePicker();
        renderProfile();
    } catch (error) {
        console.error('Profil teması güncellenemedi:', error);
        showToast('Güncellenemedi.');
    }
});

// Sauran Plus: profil penceresinde avatar çevresinde animasyonlu efekt. Aynı kilit deseni.
function renderProfileEffectPicker() {
    const picker = document.getElementById('profile-effect-picker');
    const hint = document.getElementById('profile-effect-hint');
    if (!picker || !currentUser) return;
    const isPlus = userHasFeature('profile_effect');
    const active = currentUser.profile_effect || 'none';
    picker.querySelectorAll('.chat-theme-option').forEach((btn) => {
        const effect = btn.dataset.effect;
        const locked = effect !== 'none' && !isPlus;
        btn.disabled = locked;
        btn.classList.toggle('selected', effect === active);
        btn.title = locked ? 'Sauran Plus gerekli' : '';
    });
    hint.textContent = isPlus ? '' : 'Sakura ve Sahne Işıkları efektleri Sauran Plus abonelerine açıktır.';
}

document.getElementById('profile-effect-picker')?.addEventListener('click', async (event) => {
    const btn = event.target.closest('.chat-theme-option');
    if (!btn || btn.disabled) return;
    const effect = btn.dataset.effect;
    try {
        const response = await fetch('/api/profile/effect', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ profile_effect: effect })
        });
        const data = await response.json();
        if (!data.success) { showToast(data.error || 'Güncellenemedi.'); return; }
        currentUser.profile_effect = data.profile_effect;
        renderProfileEffectPicker();
        renderProfile();
    } catch (error) {
        console.error('Profil efekti güncellenemedi:', error);
        showToast('Güncellenemedi.');
    }
});

// Bilgi balonları (Hakkımda, Profil Rengi): masaüstünde hover/odak (CSS), dokunmatikte/tıklamada aç-kapa
(function initAboutInfoTips() {
    document.querySelectorAll('.about-info-btn').forEach((btn) => {
        const row = btn.closest('.about-label-row');
        if (!row) return;
        const setOpen = (open) => { row.classList.toggle('open', open); btn.setAttribute('aria-expanded', open ? 'true' : 'false'); };
        btn.addEventListener('click', (event) => { event.stopPropagation(); setOpen(!row.classList.contains('open')); });
        document.addEventListener('click', (event) => { if (!row.contains(event.target)) setOpen(false); });
        document.addEventListener('keydown', (event) => { if (event.key === 'Escape') setOpen(false); });
    });
})();

document.getElementById('about-me-save-btn')?.addEventListener('click', async () => {

    const input = document.getElementById('about-me-input');
    if (!input) return;

    try {

        const response = await fetch('/api/profile/about', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ about_me: input.value })
        });

        const data = await response.json();

        if (data.success) {
            if (currentUser) currentUser.about_me = data.about_me;
            showToast(t('about-me-saved'));
        } else {
            showToast(data.error || 'Güncellenemedi.');
        }

    } catch (error) {
        console.error('Hakkımda güncelleme hatası:', error);
        showToast('Güncellenemedi.');
    }

});


closeProfileModalBtn.addEventListener(
    'click',
    () => {

        profileModal.style.display =
            'none';

        statusDropdown.style.display =
            'none';

    }
);


profileModal.addEventListener(
    'click',
    (event) => {

        if (
            event.target ===
            profileModal
        ) {

            profileModal.style.display =
                'none';

            statusDropdown.style.display =
                'none';

        }

    }
);


logoutBtn.addEventListener(
    'click',
    () => {

        profileModal.style.display =
            'none';

        logout();

    }
);

document.getElementById('settings-logout-btn').addEventListener('click', () => {
    settingsModal.style.display = 'none';
    logout();
});


// =====================================================
// SOHBETE GİR
// =====================================================

function connectToChat() {

    loginScreen.style.display =
        'none';

    chatScreen.style.display =
        'flex';


    // -------------------------------------------------
    // Önce varsa eski socket bağlantısını kapat
    // -------------------------------------------------

    if (socket) {

        socket.disconnect();

        socket = null;

    }


    // -------------------------------------------------
    // Session doğrulandıktan sonra Socket.io bağlantısı
    // -------------------------------------------------

    socket = io({
        withCredentials: true,
        // Doğrudan WebSocket ile başla (önce HTTP uzun yoklama + yükseltme yerine): her mesajda ek HTTP gidiş-dönüşü olmaz.
        // WebSocket engelli ağlarda otomatik olarak yoklamaya düşülür.
        transports: ['websocket', 'polling'],
        tryAllTransports: true
    });


    // -------------------------------------------------
    // Socket bağlantı hatası
    // -------------------------------------------------

    socket.on(
        'connect_error',
        (error) => {

            console.error(
                'Socket bağlantı hatası:',
                error.message
            );


            showAuthError(
                'Gerçek zamanlı bağlantı kurulamadı.'
            );

        }
    );


    // -------------------------------------------------
    // Socket authentication başarılı
    // -------------------------------------------------

    socket.on('account_email_changed', (data) => {
        if (currentUser && data && data.email) { currentUser.email = data.email; renderSettingsEmail(); }
    });

    socket.on('account_suspended', (data) => {
        handleAccountSuspended(data);
    });


    socket.on(
        'login_success',
        (user) => {

            console.log(
                'Socket authenticated:',
                user.username
            );

        }
    );


    // -------------------------------------------------
    // Mesaj hatası
    // -------------------------------------------------

    socket.on(
        'message_error',
        (errorMessage, clientId) => {

            markPendingFailed(clientId);

            alert(
                'Uyarı: ' +
                errorMessage
            );

        }
    );


    // -------------------------------------------------
    // Lobi mesajları
    // -------------------------------------------------

    socket.on('message_link_preview', (data) => {
        const id = Number(data?.id);
        if (!id) return;
        document.querySelectorAll(`[data-message-id="${id}"]`).forEach((wrap) => {
            if (!wrap.querySelector('.hub-msg-bubble, .dm-msg-line')) return;
            placeLinkPreview(wrap, { id, user_id: wrap.dataset.authorId ? Number(wrap.dataset.authorId) : null, link_preview: data.link_preview });
        });
    });

    socket.on('slow_mode_wait', (data) => {
        if (!currentHub || Number(data?.hub_id) !== currentHub.id) return;
        // Sunucu reddetti: "gönderiliyor" balonu kaldırılır, yazı geri konur, geri sayım başlar.
        const entry = data.client_id && pendingSends.get(data.client_id);
        if (entry) {
            clearTimeout(entry.timer);
            pendingSends.delete(data.client_id);
            const text = entry.content || '';
            entry.el.remove();
            if (text && !hubMessageInput.value) hubMessageInput.value = text;
        }
        slowModeUntil = Date.now() + Number(data.retry_after || 0) * 1000;
        renderSlowModeBar();
        showToast(t('slowmode-wait-toast').replace('{s}', formatSlowDuration(data.retry_after)));
    });

    socket.on('message_blocked', (data) => {
        if (!currentHub || Number(data?.hub_id) !== currentHub.id) return;
        const entry = data.client_id && pendingSends.get(data.client_id);
        if (entry) {
            clearTimeout(entry.timer);
            pendingSends.delete(data.client_id);
            const text = entry.content || '';
            entry.el.remove();
            if (text && !hubMessageInput.value) hubMessageInput.value = text;
        }
        // Gönderimde başlatılan yavaş mod geri sayımı geri alınır (mesaj gitmedi).
        slowModeUntil = 0;
        renderSlowModeBar();
        showToast(t('wf-blocked'));
    });

    socket.on('hub_slow_mode', (data) => {
        if (!currentHub || Number(data?.hub_id) !== currentHub.id) return;
        const changed = Number(currentHub.slow_mode_seconds || 0) !== Number(data.seconds);
        currentHub.slow_mode_seconds = Number(data.seconds) || 0;
        if (!currentHub.slow_mode_seconds) slowModeUntil = 0;
        const sel = document.getElementById('hubset-slowmode');
        if (sel) sel.value = String(currentHub.slow_mode_seconds);
        renderSlowModeBar();
        if (changed && data.by && data.by !== currentUser?.username) {
            showToast(currentHub.slow_mode_seconds
                ? t('slowmode-changed-on').replace('{u}', data.by).replace('{d}', formatSlowDuration(currentHub.slow_mode_seconds))
                : t('slowmode-changed-off').replace('{u}', data.by));
        }
    });

    socket.on(
        'hub_message',
        (msg) => {

            if (!resolvePendingSend(msg) && !feedPaging.hub.hasNewer) appendHubMessage(msg);
            if (currentHub && Number(msg.hub_id ?? currentHub.id) === currentHub.id && currentUser && msg.user_id === currentUser.id) startSlowModeCooldown(currentHub.slow_mode_seconds);
            typingDoneBy('hub', msg.user_id);

            if (currentHub && document.visibilityState === 'visible') markReadSoon('hub', currentHub.id, msg.id);

            if (msg.user_id !== currentUser.id) maybeNotifyIncomingHubMessage(msg);

        }
    );


    socket.on('typing', handleTypingSignal);

    socket.on('hub_unread_ping', (data) => {
        const hubId = Number(data?.hub_id);
        if (!hubId) return;
        // Şu an bu lobiye bakıyorsa mesaj zaten akışa gelir ve okundu sayılır.
        if (currentHub?.id === hubId && document.body.dataset.view === 'hub-detail' && document.visibilityState === 'visible') return;
        const info = unreadHubCounts.get(hubId) || { count: 0, muted: false };
        unreadHubCounts.set(hubId, { ...info, count: Math.min(info.count + 1, 100) });
        renderHubUnreadBadges();
    });

    // Biri senden (ya da @everyone ile) bahsetti. Doğrudan bahsetme lobi sessizde olsa da bildirilir; @everyone sunucuda zaten süzülür.
    socket.on('hub_mention', (data) => {
        const hubId = Number(data?.hub_id);
        const viewing = currentHub?.id === hubId && document.body.dataset.view === 'hub-detail' && document.visibilityState === 'visible';
        if (viewing) return;
        const info = unreadHubCounts.get(hubId) || { count: 1, muted: false };
        unreadHubCounts.set(hubId, { ...info, mentions: (info.mentions || 0) + 1 });
        renderHubUnreadBadges();
        const label = data.everyone
            ? `📣 ${data.from_username} @everyone · ${data.hub_name}`
            : `@ ${data.from_username} ${t('mention-toast')} · ${data.hub_name}`;
        showCenterToast(label);
        playNotifSound();
        if (notifDesktopEnabled && (getBrowserNotifState() === 'granted' || getNativeNotify()) && shouldShowSystemNotification()) {
            showSystemNotification(data.hub_name, `${data.from_username}: ${data.preview || ''}`, {
                tag: `mention-${hubId}`, renotify: true, data: { url: `/?open_hub=${hubId}` }
            }).catch(() => {});
        }
    });

    // Başka cihazda okundu: buradaki sayaç da sıfırlanır.
    socket.on('read_state_updated', (data) => {
        const id = Number(data?.id);
        if (data?.type === 'dm') {
            unreadDmCounts.delete(id);
            updateFriendsToggleBadge();
            refreshFriendsSidebar();
        } else if (data?.type === 'hub') {
            unreadHubCounts.delete(id);
            renderHubUnreadBadges();
        }
    });

    socket.on('connect', refreshUnreadCounts);

    socket.on(
        'hub_message_update',
        (msg) => {

            updateHubMessage(msg);

        }
    );


    socket.on(
        'hub_message_deleted',
        (data) => {

            removeHubMessage(data.id);

        }
    );


    socket.on(
        'dm_message_deleted',
        (data) => {

            removeDmMessage(data.id);

        }
    );


    socket.on(
        'dm_message_update',
        (msg) => {

            updateDmMessage(msg);

        }
    );


    // -------------------------------------------------
    // Mesaj aksiyonları — tepki / sabitleme (AŞAMA D)
    // -------------------------------------------------

    socket.on('hub_message_reaction', (data) => patchMessageReactionsUI(hubFeed, data.id, data.reactions));
    socket.on('dm_message_reaction', (data) => patchMessageReactionsUI(dmFeed, data.id, data.reactions));
    socket.on('hub_message_pinned', (msg) => updateHubMessage(msg));
    socket.on('hub_message_unpinned', (msg) => updateHubMessage(msg));


    // -------------------------------------------------
    // Varlık (kim çevrimiçi) değişti
    // -------------------------------------------------

    socket.on(
        'presence_changed',
        () => {

            refreshOnlinePanelIfOpen();
            refreshFriendsSidebar();

        }
    );


    // -------------------------------------------------
    // Arkadaşlık isteği geldi
    // -------------------------------------------------

    socket.on(
        'friend_request_received',
        (data) => {

            refreshOnlinePanelIfOpen();

            console.log(
                `${data.from_username} sana arkadaşlık isteği gönderdi.`
            );

        }
    );


    // -------------------------------------------------
    // DM mesajı
    // -------------------------------------------------

    socket.on(
        'dm_message',
        (msg) => {

            const otherId =
                msg.user_id === currentUser.id ?
                    msg.to_user_id :
                    msg.user_id;

            if (otherId === activeDmUserId) {

                if (!resolvePendingSend(msg) && !feedPaging.dm.hasNewer) appendDmMessage(msg);
                typingDoneBy('dm', msg.user_id);
                if (document.visibilityState === 'visible') markReadSoon('dm', otherId, msg.id);

            } else if (msg.kind === 'dm_call') {

                // Arama kaydı yalnızca sohbet geçmişine yazılır; okunmamış sayacı, ses ya da bildirim üretmez.

            } else if (msg.user_id !== currentUser.id) {

                unreadDmCounts.set(otherId, (unreadDmCounts.get(otherId) || 0) + 1);
                updateFriendsToggleBadge();
                refreshFriendsSidebar();
                playMessageSound();

            }

            if (msg.user_id !== currentUser.id && msg.kind !== 'dm_call') maybeNotifyIncomingDm(msg);

        }
    );


    // -------------------------------------------------
    // Bildirim geldi
    // -------------------------------------------------

    socket.on(
        'notification_received',
        (payload) => {
            refreshNotificationsBadge();
            const labelByType = {
                friend_request: t('notif-friend-request'),
                friend_request_accepted: t('notif-friend-accepted'),
                hub_invite: t('notif-hub-invite'),
                platform_role_notice: t('notif-role-notice'),
                platform_role_revoked: t('notif-role-revoked'),
                gift: '🎁 Bir hediye aldın!',
                voice_muted: payload?.data ? voiceMuteNoticeText(payload.data) : t('voice-muted-title'),
                voice_unmuted: t('voice-unmuted-toast'),
                hub_mention: `@ ${payload?.data?.from_username || ''} ${t('mention-toast')}`,
                voice_kicked: `👢 ${voiceMuteByLabel(payload?.data?.by_tier)} ${t('voice-kicked-text')}`,
                voice_unblocked: `🚪 ${payload?.data?.room_name || ''} ${t('voice-unblocked-toast')}`
            };
            const label = labelByType[payload?.type] || t('notif-hub-invite');
            const channels = payload?.channels || {};

            if (channels.inapp !== false) showCenterToast(label);
            if (channels.desktop !== false) maybeShowBrowserNotification(payload?.type, label);
            if (channels.sound !== false) playNotifSound();
        }
    );


    // Platform rolü (görev / görevden alma / kabul) değişti: etkin rolü ve bildirimleri yenile.
    socket.on('platform_role_updated', async () => {
        await refreshCurrentUserRole();
        roleNoticeDismissed = false;
        maybeShowRoleNotices();
        if (notificationsModal.style.display === 'flex') reloadNotifications();
    });


    // -------------------------------------------------
    // DM sesli arama sinyalleşmesi
    // -------------------------------------------------

    socket.on('dm_call_incoming', (data) => showIncomingCall(data.from_user_id, data.from_username));
    socket.on('dm_call_cancelled', (data) => {
        if (data.from_user_id === incomingCallFromId) hideIncomingCall();
    });
    socket.on('dm_call_declined', (data) => {
        if (data.from_user_id === outgoingCallToId) {
            showToast('Arama reddedildi.');
            endDmCallUi();
        }
    });
    // Sunucu çalma süresi doldu (karşı taraf cevap vermedi): "Aranıyor" ekranı sonsuza dek açık kalmasın.
    socket.on('dm_call_missed', (data) => {
        if (callMode === 'dm-ringing' && data.to_user_id === outgoingCallToId) {
            showToast(t('call-no-answer'));
            endDmCallUi();
        }
    });
    // Bu arama aynı hesabın başka cihazında yanıtlandı/reddedildi: buradaki zil ve pencere kapansın.
    socket.on('dm_call_handled', (data) => {
        if (incomingCallFromId && data.from_user_id === incomingCallFromId) hideIncomingCall();
    });
    socket.on('dm_call_accepted', (data) => {
        if (data.from_user_id === outgoingCallToId) joinDmCall(outgoingCallToId, outgoingCallToUsername);
    });
    // Karşı taraf hesabını sildi: açık DM penceresi sayfa yenilemeden "Silinmiş hesap / salt okunur" görünümüne geçer (ya da korunacak
    // mesaj yoksa kapanır); arkadaş listesi de yenilenir.
    socket.on('dm_partner_deleted', async (data) => {
        await loadFriendsSidebar();

        if (dmModal.style.display !== 'none' && activeDmUserId && activeDmUserId === data.user_id) {
            if (data.token) {
                openDeletedDm(data.token);
            } else {
                dmModal.style.display = 'none';
                activeDmUserId = null;
                activeDmUsername = '';
            }
        }
    });

    socket.on('dm_call_ended', (data) => {
        // Arayan çalarken kapattıysa (henüz bir çağrı çerçevemiz yok) gelen arama zili de durmalı.
        if (!callFrame && data.from_user_id === incomingCallFromId) hideIncomingCall();

        if (callFrame && (data.from_user_id === outgoingCallToId || data.from_user_id === incomingCallFromId)) {
            leaveCall();
        }
    });


    // -------------------------------------------------
    // Sesli oda değişiklikleri
    // -------------------------------------------------

    socket.on('groups_changed', (data) => {
        loadGroups();
        if (data?.reason === 'created' || data?.reason === 'members') refreshUnreadCounts();
        if (currentHub && Number(data?.group_id) === currentHub.id && data?.reason === 'renamed') refreshGroupSettings();
    });
    socket.on('group_removed', (data) => {
        const id = Number(data?.group_id);
        if (!id) return;
        if (!data.by_self && currentHub && currentHub.id === id) showToast(t('group-removed-toast'));
        leaveGroupView(id);
    });

    socket.on('hub_members_changed', (data) => {
        if (currentHub && data.hub_id === currentHub.id) {
            openHub(currentHub.id);
        }
    });

    // Keşfet: sahibe yeni katılma isteği / isteği gönderene karar bildirimi
    socket.on('hub_join_request', () => {
        showToast(t('discover-new-request'));
        if (currentHub && hubSettingsModal.style.display === 'flex') openHub(currentHub.id);
    });
    socket.on('lobby_super_like_owner', () => showToast(t('discover-super-received')));
    socket.on('lobby_super_like', (d) => {
        if (currentHub && currentHub.id === d.lobby_id) {
            loadLobbySupporters(d.lobby_id);
            if (document.visibilityState === 'visible') playSuperLikeAnimation(d);
        }
    });
    socket.on('gift_received', (g) => { showToast('🎁 Hediye aldın: ' + g.quantity + ' ' + g.unit + ' ' + g.label); if (typeof loadWallet === 'function') loadWallet(); });
    socket.on('hub_join_decision', (data) => {
        showToast(t(data && data.approved ? 'discover-decision-approved' : 'discover-decision-rejected'));
        loadHubList();
    });

    socket.on('hub_chat_cleared', (data) => {
        if (currentHub && data.hub_id === currentHub.id) {
            loadHubMessages(currentHub.id);
            showToast(t('hub-chat-cleared'));
        }
    });

    socket.on('hub_kicked', (data) => {
        if (callMode === 'hub-room' && currentVoiceRoomHubId === data.hub_id) leaveCall();
        if (currentHub && data.hub_id === currentHub.id) {
            showToast(t('kicked-from-hub'));
            switchToView('hubs');
            loadHubList();
        }
    });

    socket.on('hub_banned', (data) => {
        if (callMode === 'hub-room' && currentVoiceRoomHubId === data.hub_id) leaveCall();
        if (currentHub && data.hub_id === currentHub.id) {
            showToast(t('banned-from-hub'));
            switchToView('hubs');
            loadHubList();
        }
    });

    // Moderatör/kurucu bu kullanıcıyı bir sesli odada susturdu (ya da kaldırdı). Kalıcı bildirim ayrıca bildirim listesine düşer.
    socket.on('voice_force_muted', (mute) => {
        if (!mute) return;
        if (callMode === 'hub-room' && currentVoiceRoomId === mute.room_id) {
            applyVoiceForceMute(mute, { announce: true });
        }
    });

    socket.on('voice_room_kicked', (data) => {
        if (callMode === 'hub-room' && currentVoiceRoomId === data?.room_id) {
            leaveCall();
            const after = !data.blocked ? t('voice-kick-can-rejoin')
                : data.expires_at ? `${t('voice-kick-blocked-for')} ${new Date(data.expires_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`
                : t('voice-kick-blocked-until');
            alert(`👢 ${voiceMuteByLabel(data.by_tier)} ${t('voice-kicked-text')}: ${data.room_name || ''}\n${after}`);
        }
    });

    socket.on('voice_room_unblocked', (data) => {
        showToast(`🚪 ${data?.room_name || ''} ${t('voice-unblocked-toast')}`);
    });

    socket.on('voice_force_unmuted', (data) => {
        if (callMode === 'hub-room' && currentVoiceRoomId === data?.room_id) {
            clearVoiceForceMute();
            showToast(t(data?.reason === 'expired' ? 'voice-unmuted-expired-toast' : 'voice-unmuted-toast'));
        }
    });

    socket.on('voice_room_created', (room) => {
        if (currentHub && room.hub_id === currentHub.id) {
            voiceRoomsCache.push({ ...room, participants: [] });
            renderVoiceRoomsList();
        }
    });

    socket.on('voice_room_deleted', (data) => {
        voiceRoomsCache = voiceRoomsCache.filter(r => r.id !== data.id);
        if (currentHub) renderVoiceRoomsList();
        if (currentVoiceRoomId === data.id) leaveCall();
    });

    socket.on('voice_room_participants_updated', (data) => {

        const room = voiceRoomsCache.find(r => r.id === data.room_id);
        if (room) room.participants = data.participants;

        if (callMode === 'hub-room' && currentVoiceRoomId === data.room_id) {

            // Sunucu beni listeden çıkardıysa (ör. başka cihaz, atılma) yerel bağlantıyı da kapat.
            if (voiceSessionConfirmed && !voiceRejoining && !data.participants.some(p => p.user_id === currentUser.id)) {
                showToast(t('voice-room-removed'));
                leaveCall();
                return;
            }

            currentVoiceParticipants = data.participants;
            renderHubRoomGrid(currentVoiceParticipants);
            updateVoiceSessionSummary();
            // İzlenen ekranın sahibi bu arada susturulduysa (ya da susturması kalktıysa) ekran sesi buna göre kesilir/açılır.
            if (watchedScreenshareSessionId) attachWatchedScreenAudio();
            handleVoicePresenceChange(data.change);
            refreshVoiceSpeaking();

        }

        if (currentHub) renderVoiceRoomsList();
        if (room && pendingVoiceRoomId === data.room_id) renderVoiceRoomPreviewList(room);

    });

    socket.on('voice_room_replaced', (data) => {
        if (callMode === 'hub-room' && currentVoiceRoomId === data.room_id) {
            showToast(t('voice-room-replaced'));
            leaveCall();
        }
    });

    // Bağlantı kopup geri geldiğinde sunucu tarafındaki üyelik yeniden kurulur
    // (Daily/WebRTC bağlantısı bundan bağımsız olarak açık kalır).
    socket.on('connect', async () => {

        if (callMode !== 'hub-room' || !voiceSessionConfirmed) return;

        voiceRejoining = true;
        const ack = await emitVoiceRoomJoin();
        voiceRejoining = false;

        if (!ack.success) {
            showToast(ack.error || t('voice-room-removed'));
            leaveCall();
            return;
        }

        currentVoiceParticipants = ack.participants;
        renderHubRoomGrid(currentVoiceParticipants);
        updateVoiceSessionSummary();
        if (currentHub) loadVoiceRooms(currentHub.id);

    });


    socket.on('connect', reportAppVisibility);
    reportAppVisibility();

    switchToView('hubs');
    loadHubList();
    refreshUnreadCounts();
    refreshNotificationsBadge();
    loadNotificationPreferences();
    ensurePushSubscription();
    setTimeout(maybeShowNotificationPrompt, 4000);
    handlePendingNotificationOpen();
    initNativeNotifications();

    maybeShowDevNotice();
    maybeShowRoleNotices();

}


// =====================================================
// GELİŞTİRME BİLGİLENDİRME PENCERESİ
// =====================================================
// Görüldü bilgisi HESABA bağlı (users.dev_notice_seen) — localStorage'a
// güvenilmiyor; farklı cihazda/oturumda tekrar çıkmaz. Sunucu, hesabın yeni
// kayıtla mı oluştuğunu ('new') yoksa önceden var olan mı olduğunu ('existing')
// currentUser.dev_notice ile bildirir; null ise zaten görülmüştür.

const DEV_NOTICE_COPY = {
    new: {
        tr: {
            title: 'Sauran Geliştirme Sürecinde',
            paras: [
                'Sauran şu anda aktif olarak geliştirilmeye devam ediyor. Geliştirme ve yazılım ekibimiz, uygulamanın performansını, kararlılığını ve yeni özelliklerini sürekli olarak iyileştirmek için çalışmalarını sürdürüyor.',
                'Bu geliştirme sürecinde, sistem üzerinde yapılan bazı güncellemeler veya teknik çalışmalar nedeniyle zaman zaman kısa süreli bağlantı kesintileri yaşanabilir.',
                'Bu kesintilerin süresi genellikle <strong>yaklaşık 30 saniye</strong> civarında olabilir. Ancak geliştirme çalışmalarının ve teknik güncellemelerin zamanlaması önceden sabit olmadığı için bu kesintilerin belirli veya düzenli bir zamanı bulunmamaktadır.',
                'Çalışmalar sırasında göstereceğiniz anlayış için teşekkür ederiz. Sauran\'ı daha iyi, daha hızlı ve daha kararlı bir deneyim haline getirmek için çalışmaya devam ediyoruz.'
            ],
            sign: 'Sauran Geliştirme Ekibi'
        },
        en: {
            title: 'Sauran Is Under Development',
            paras: [
                'Sauran is being actively developed. Our development and engineering team keeps working to continuously improve the app\'s performance, stability and new features.',
                'During this process, some updates or technical work on the system may occasionally cause brief connection interruptions.',
                'These interruptions usually last <strong>about 30 seconds</strong>. Since the timing of development work and technical updates is not fixed in advance, there is no specific or regular schedule for them.',
                'Thank you for your understanding while we work. We are continuing to make Sauran a better, faster and more stable experience.'
            ],
            sign: 'The Sauran Development Team'
        }
    },
    existing: {
        tr: {
            title: 'Sauran Geliştirilmeye Devam Ediyor',
            paras: [
                'Sauran\'ı kullandığınız için teşekkür ederiz.',
                'Uygulamamız şu anda aktif geliştirme sürecindedir. Geliştirici ekibimiz; performans, kararlılık, sesli iletişim ve yeni özellikler üzerinde çalışmalarını sürdürmektedir.',
                'Bu süreçte gerçekleştirilen geliştirme ve teknik çalışmalar nedeniyle zaman zaman kısa süreli bağlantı kesintileri yaşanabilir. Bu kesintilerin süresi genellikle <strong>yaklaşık 30 saniye</strong> olabilir ve çalışmaların zamanlamasına bağlı olarak önceden belirlenmiş sabit bir saati bulunmamaktadır.',
                'Amacımız Sauran\'ı zaman içerisinde daha hızlı, daha kararlı ve daha iyi bir iletişim deneyimi sunan bir platform haline getirmek.',
                'Göstereceğiniz anlayış ve Sauran\'ın gelişim sürecine eşlik ettiğiniz için teşekkür ederiz.'
            ],
            sign: 'Sauran Geliştirme Ekibi'
        },
        en: {
            title: 'Sauran Keeps Evolving',
            paras: [
                'Thank you for using Sauran.',
                'Our app is currently in active development. Our developer team continues to work on performance, stability, voice communication and new features.',
                'Because of development and technical work during this period, brief connection interruptions may occasionally occur. They usually last <strong>about 30 seconds</strong> and, depending on the work being done, have no fixed pre-announced time.',
                'Our goal is to turn Sauran, over time, into a platform that offers a faster, more stable and better communication experience.',
                'Thank you for your understanding and for being part of Sauran\'s journey.'
            ],
            sign: 'The Sauran Development Team'
        }
    }
};

let devNoticeShown = false;
let devNoticeReturnFocus = null;

function maybeShowDevNotice() {

    if (devNoticeShown || !currentUser || !currentUser.dev_notice) return;
    const copy = DEV_NOTICE_COPY[currentUser.dev_notice];
    if (!copy) return;

    devNoticeShown = true;

    let lang = 'tr';
    try { lang = localStorage.getItem('sauran_lang') === 'en' ? 'en' : 'tr'; } catch (e) {}
    const text = copy[lang] || copy.tr;

    document.getElementById('dev-notice-title').textContent = text.title;
    // İçerik yukarıdaki sabit metinlerden gelir (kullanıcı girdisi değil), <strong> içerir.
    document.getElementById('dev-notice-body').innerHTML = text.paras.map((p) => '<p>' + p + '</p>').join('');
    document.getElementById('dev-notice-sign').textContent = text.sign;

    const overlay = document.getElementById('dev-notice-overlay');
    const btn = document.getElementById('dev-notice-btn');

    devNoticeReturnFocus = document.activeElement;
    chatScreen.inert = true;

    overlay.classList.add('visible');
    overlay.setAttribute('aria-hidden', 'false');
    void overlay.offsetWidth;
    overlay.classList.add('open');
    setTimeout(() => btn.focus(), 60);

}

function closeDevNotice() {

    const overlay = document.getElementById('dev-notice-overlay');

    // Hesaba bağlı kalıcı işaret — başarısız olursa bir sonraki girişte tekrar gösterilir.
    fetch('/api/me/dev-notice-seen', { method: 'POST', credentials: 'include' }).catch(() => {});
    if (currentUser) currentUser.dev_notice = null;

    overlay.classList.remove('open');
    overlay.setAttribute('aria-hidden', 'true');
    chatScreen.inert = false;

    setTimeout(() => {
        overlay.classList.remove('visible');
        if (devNoticeReturnFocus && typeof devNoticeReturnFocus.focus === 'function') devNoticeReturnFocus.focus();
        maybeShowRoleNotices();
    }, 240);

}

document.getElementById('dev-notice-btn').addEventListener('click', closeDevNotice);

// Kullanıcının bildirimi gerçekten görmesi için ESC ile kapanmaz; tek etkileşimli
// öğe düğme olduğundan Tab odağı da pencere içinde kalır.
document.addEventListener('keydown', (event) => {
    const overlay = document.getElementById('dev-notice-overlay');
    if (!overlay.classList.contains('open')) return;
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); }
    if (event.key === 'Tab') { event.preventDefault(); document.getElementById('dev-notice-btn').focus(); }
}, true);



// =====================================================
// RESMİ YÖNETİM GÖREVİ BİLDİRİSİ / GÖREVDEN ALMA BİLGİLENDİRMESİ
// =====================================================
// Görev bildirisi: kullanıcı metnin sonuna kadar kaydırmadan onay kutusu, onay kutusu
// işaretlenmeden kabul düğmesi etkinleşmez. Bunlar yalnızca kullanıcı deneyimi
// zorlamalarıdır; sunucu kabulü (bekleyen görev + sürüm + accepted + scrolled_to_end)
// ayrıca doğrular. Metinler bir hukuki sözleşme değildir; görev kapsamını bildirir.

const ROLE_NOTICE_UI = {
    tr: {
        official: 'Sauran Yönetim',
        title: 'Sauran Yönetim Görevi Bildirimi',
        hint: 'Onay kutusunu etkinleştirmek için metnin sonuna kadar kaydırın.',
        check: 'Bildirim metnini okudum, anladım ve bu görev kapsamında belirtilen sorumlulukları kabul ediyorum.',
        accept: 'Okudum, Anladım ve Kabul Ediyorum',
        decline: 'Reddet',
        declineConfirm: 'Bu görevi reddedersen atanan rol geri alınır ve moderasyon ekibine bilgi gider. Reddetmek istediğine emin misin?',
        later: 'Daha sonra',
        working: 'Kaydediliyor…',
        error: 'Kabul kaydedilemedi. Lütfen tekrar dene.',
        revokedTitle: 'Yönetim göreviniz sona erdirilmiştir.',
        revokedRemoved: 'Kaldırılan görev',
        revokedCurrent: 'Güncel rolünüz',
        revokedBy: 'İşlemi yapan',
        revokedByValue: 'Founder (Sauran Yönetim)',
        revokedDate: 'Tarih',
        revokedSupport: 'Destek için',
        revokedInfo: 'Bu bilgilendirme için herhangi bir onay gerekmez.',
        ok: 'Tamam',
        roles: { moderator: 'Moderator', admin: 'Admin', user: 'Kullanıcı' },
        sign: 'Sauran Yönetim'
    },
    en: {
        official: 'Sauran Management',
        title: 'Sauran Management Duty Notice',
        hint: 'Scroll to the end of the text to enable the confirmation box.',
        check: 'I have read and understood this notice and I accept the responsibilities described for this duty.',
        accept: 'I Have Read, Understood and Accept',
        decline: 'Decline',
        declineConfirm: 'If you decline this duty, the assigned role is withdrawn and the moderation team is informed. Are you sure you want to decline?',
        later: 'Later',
        working: 'Saving…',
        error: 'Could not save your acceptance. Please try again.',
        revokedTitle: 'Your management duty has been ended.',
        revokedRemoved: 'Duty removed',
        revokedCurrent: 'Your current role',
        revokedBy: 'Action taken by',
        revokedByValue: 'Founder (Sauran Management)',
        revokedDate: 'Date',
        revokedSupport: 'Support',
        revokedInfo: 'No confirmation is needed for this notice.',
        ok: 'OK',
        roles: { moderator: 'Moderator', admin: 'Admin', user: 'User' },
        sign: 'Sauran Management'
    }
};

const ROLE_NOTICE_COPY = {
    moderator: {
        tr: [
            'Sauran yönetimi tarafından <strong>Moderator</strong> olarak görevlendirildiniz. Bu görev, Sauran topluluğuna karşı bir sorumluluk içerir ve Sauran yönetim politikalarına tabidir.',
            ['Moderasyon araçları ve yetkileri yalnızca size verilen görev kapsamında ve görev amacıyla kullanılabilir.',
             'Kullanıcı güvenliğini gözetmeniz ve topluluk kurallarının tarafsız ve kurallara uygun biçimde uygulanmasını sağlamanız beklenir.',
             'Kullanıcılara ait özel bilgileri ve göreviniz sırasında eriştiğiniz gizli yönetim bilgilerini korumanız gerekir.',
             'Yetkilerinizi kişisel amaçlarla kullanmamanız ve kötüye kullanmamanız gerekir.',
             'Gerektiğinde üst yönetimin (Founder/Admin) kararlarına uymanız beklenir.',
             'Bu yetki, Founder veya Admin tarafından her zaman geri alınabilir.'],
            'Bu bildirim, görevin kapsamını ve beklentileri bilgilendirme amacıyla hazırlanmıştır. Aşağıdaki onayı vermeden bu görev için yeni yönetim yetkileri etkin olmaz.'
        ],
        en: [
            'You have been assigned by Sauran management as a <strong>Moderator</strong>. This duty carries responsibility toward the Sauran community and is subject to Sauran\'s management policies.',
            ['Moderation tools and permissions may be used only within the scope and for the purpose of the duty given to you.',
             'You are expected to look after user safety and to apply the community rules impartially and in accordance with the rules.',
             'You must protect users\' private information and any confidential management information you access during this duty.',
             'You must not use your permissions for personal purposes or misuse them.',
             'You are expected to follow the decisions of senior management (Founder/Admin) when required.',
             'This permission can be withdrawn at any time by the Founder or an Admin.'],
            'This notice is prepared to inform you about the scope of the duty and what is expected. New management permissions for this duty will not become active until you give the confirmation below.'
        ]
    },
    admin: {
        tr: [
            'Sauran yönetimi tarafından <strong>Admin</strong> olarak görevlendirildiniz. Admin görevi, moderatör görevinden daha geniş platform yetkileri ve sorumlulukları içerir ve Sauran yönetim politikalarına tabidir.',
            ['Admin yetkileri yalnızca platform yönetimi amacıyla kullanılabilir.',
             'Kullanıcı verilerini ve yönetimsel bilgileri korumanız, bunlara yalnızca görev gereği erişmeniz gerekir.',
             'Moderasyon süreçlerinin düzenli, tarafsız ve kurallara uygun yürütülmesi konusunda yönetim sorumluluğu taşırsınız.',
             'Diğer yöneticilerin ve moderatörlerin çalışmalarının politikalara uygunluğunu gözetmeniz beklenir.',
             'Yetkilerinizi kişisel amaçlarla kullanmamanız ve kötüye kullanmamanız gerekir.',
             'Mevcut Sauran yönetim politikalarına ve Founder\'ın kararlarına uymanız beklenir.',
             'Bu yetki, Founder tarafından her zaman geri alınabilir.'],
            'Bu bildirim, görevin kapsamını ve beklentileri bilgilendirme amacıyla hazırlanmıştır. Aşağıdaki onayı vermeden bu görev için yeni yönetim yetkileri etkin olmaz.'
        ],
        en: [
            'You have been assigned by Sauran management as an <strong>Admin</strong>. The Admin duty carries broader platform permissions and responsibilities than the Moderator duty and is subject to Sauran\'s management policies.',
            ['Admin permissions may be used only for the purpose of managing the platform.',
             'You must protect user data and administrative information and access them only as your duty requires.',
             'You carry management responsibility for ensuring that moderation processes are run in an orderly, impartial and rule-compliant way.',
             'You are expected to look after whether the work of other administrators and moderators complies with the policies.',
             'You must not use your permissions for personal purposes or misuse them.',
             'You are expected to follow the current Sauran management policies and the Founder\'s decisions.',
             'This permission can be withdrawn at any time by the Founder.'],
            'This notice is prepared to inform you about the scope of the duty and what is expected. New management permissions for this duty will not become active until you give the confirmation below.'
        ]
    }
};

function roleNoticeLang() {
    try { return localStorage.getItem('sauran_lang') === 'en' ? 'en' : 'tr'; } catch (e) { return 'tr'; }
}

let roleNoticeScrolled = false;
let roleNoticeDismissed = false;
let roleNoticeReturnFocus = null;
let roleRevokedReturnFocus = null;

function roleNoticeIsOpen() {
    return document.getElementById('role-notice-overlay').classList.contains('open');
}

// Sırayla: önce bekleyen görev bildirisi, yoksa (bir kez) görevden alma bilgilendirmesi.
// Geliştirme bilgilendirme penceresi açıkken beklenir; kapanınca tekrar çağrılır.
function maybeShowRoleNotices() {
    if (!currentUser) return;
    if (document.getElementById('dev-notice-overlay').classList.contains('open')) return;
    if (roleNoticeIsOpen() || document.getElementById('role-revoked-overlay').classList.contains('open')) return;

    const acceptance = currentUser.role_acceptance;
    if (acceptance && acceptance.pending) {
        if (!roleNoticeDismissed) openRoleNotice();
        return;
    }
    if (currentUser.role_notice && currentUser.role_notice.kind === 'revoked') openRoleRevoked();
}

function updateRoleNoticeScrollState() {
    const box = document.getElementById('role-notice-scroll');
    const check = document.getElementById('role-notice-check');
    const accept = document.getElementById('role-notice-accept');
    const hint = document.getElementById('role-notice-hint');

    // Metin kaydırılabilir değilse (kısa içerik/büyük ekran) sonu zaten görünürdür.
    if (!roleNoticeScrolled && box.scrollTop + box.clientHeight >= box.scrollHeight - 4) {
        roleNoticeScrolled = true;
    }

    check.disabled = !roleNoticeScrolled;
    if (!roleNoticeScrolled) check.checked = false;
    hint.hidden = roleNoticeScrolled;
    accept.disabled = !(roleNoticeScrolled && check.checked);
}

function openRoleNotice() {
    const acceptance = currentUser && currentUser.role_acceptance;
    if (!acceptance || !acceptance.pending) return;

    const copy = ROLE_NOTICE_COPY[acceptance.role];
    if (!copy) return;

    const lang = roleNoticeLang();
    const ui = ROLE_NOTICE_UI[lang];
    const [intro, bullets, outro] = copy[lang];

    document.getElementById('role-notice-official').textContent = ui.official;
    document.getElementById('role-notice-title').textContent = ui.title;
    // İçerik yukarıdaki sabit metinlerden gelir (kullanıcı girdisi değil), <strong> içerir.
    document.getElementById('role-notice-body').innerHTML =
        '<p>' + intro + '</p><ul class="role-notice-body-list">' + bullets.map((b) => '<li>' + b + '</li>').join('') + '</ul><p>' + outro + '</p>';
    document.getElementById('role-notice-sign').textContent = ui.sign + ' · ' + acceptance.version;
    document.getElementById('role-notice-hint').textContent = ui.hint;
    document.getElementById('role-notice-check-text').textContent = ui.check;
    document.getElementById('role-notice-accept').textContent = ui.accept;
    document.getElementById('role-notice-decline').textContent = ui.decline;
    document.getElementById('role-notice-decline').disabled = false;
    document.getElementById('role-notice-later').textContent = ui.later;
    document.getElementById('role-notice-error').textContent = '';

    const box = document.getElementById('role-notice-scroll');
    const check = document.getElementById('role-notice-check');
    roleNoticeScrolled = false;
    check.checked = false;
    box.scrollTop = 0;

    const overlay = document.getElementById('role-notice-overlay');
    roleNoticeReturnFocus = document.activeElement;
    chatScreen.inert = true;

    overlay.classList.add('visible');
    overlay.setAttribute('aria-hidden', 'false');
    void overlay.offsetWidth;
    overlay.classList.add('open');

    updateRoleNoticeScrollState();
    requestAnimationFrame(updateRoleNoticeScrollState);
    setTimeout(() => { updateRoleNoticeScrollState(); box.focus(); }, 260);
}

function closeRoleNotice() {
    const overlay = document.getElementById('role-notice-overlay');
    overlay.classList.remove('open');
    overlay.setAttribute('aria-hidden', 'true');
    chatScreen.inert = false;

    setTimeout(() => {
        overlay.classList.remove('visible');
        if (roleNoticeReturnFocus && typeof roleNoticeReturnFocus.focus === 'function') roleNoticeReturnFocus.focus();
    }, 240);
}

async function refreshCurrentUserRole() {
    try {
        const response = await fetch('/api/me', { credentials: 'include' });
        if (!response.ok) return;
        const data = await response.json();
        if (!data.success || !currentUser) return;

        currentUser.platform_role = data.user.platform_role;
        currentUser.assigned_platform_role = data.user.assigned_platform_role;
        currentUser.role_acceptance = data.user.role_acceptance;
        currentUser.role_notice = data.user.role_notice;
        applyAdminLinkVisibility(currentUser);
    } catch (e) {}
}

async function submitRoleAcceptance() {
    const acceptance = currentUser && currentUser.role_acceptance;
    if (!acceptance) return;

    const ui = ROLE_NOTICE_UI[roleNoticeLang()];
    const accept = document.getElementById('role-notice-accept');
    const errorEl = document.getElementById('role-notice-error');
    accept.disabled = true;
    errorEl.textContent = '';

    try {
        const response = await fetch('/api/me/role-acceptance', {
            method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                version: acceptance.version,
                scrolled_to_end: roleNoticeScrolled,
                accepted: document.getElementById('role-notice-check').checked
            })
        });
        const data = await response.json().catch(() => ({}));

        if (!response.ok || !data.success) {
            errorEl.textContent = data.error || ui.error;
            await refreshCurrentUserRole();
            updateRoleNoticeScrollState();
            return;
        }

        await refreshCurrentUserRole();
        closeRoleNotice();
        refreshNotificationsBadge();
    } catch (e) {
        errorEl.textContent = ui.error;
        updateRoleNoticeScrollState();
    }
}

async function submitRoleDecline() {
    const acceptance = currentUser && currentUser.role_acceptance;
    if (!acceptance) return;

    const ui = ROLE_NOTICE_UI[roleNoticeLang()];
    if (!confirm(ui.declineConfirm)) return;

    const declineBtn = document.getElementById('role-notice-decline');
    const errorEl = document.getElementById('role-notice-error');
    declineBtn.disabled = true;
    errorEl.textContent = '';

    try {
        const response = await fetch('/api/me/role-decline', {
            method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ version: acceptance.version })
        });
        const data = await response.json().catch(() => ({}));

        if (!response.ok || !data.success) {
            errorEl.textContent = data.error || ui.error;
            declineBtn.disabled = false;
            await refreshCurrentUserRole();
            return;
        }

        await refreshCurrentUserRole();
        closeRoleNotice();
        refreshNotificationsBadge();
    } catch (e) {
        errorEl.textContent = ui.error;
        declineBtn.disabled = false;
    }
}

document.getElementById('role-notice-decline').addEventListener('click', submitRoleDecline);

document.getElementById('role-notice-scroll').addEventListener('scroll', updateRoleNoticeScrollState, { passive: true });
window.addEventListener('resize', () => { if (roleNoticeIsOpen()) updateRoleNoticeScrollState(); });
document.getElementById('role-notice-check').addEventListener('change', updateRoleNoticeScrollState);
document.getElementById('role-notice-accept').addEventListener('click', submitRoleAcceptance);
document.getElementById('role-notice-later').addEventListener('click', () => {
    roleNoticeDismissed = true;
    closeRoleNotice();
});

function openRoleRevoked() {
    const notice = currentUser && currentUser.role_notice;
    if (!notice) return;

    const ui = ROLE_NOTICE_UI[roleNoticeLang()];
    const roleName = (r) => ui.roles[r] || r;
    const when = notice.at ? String(notice.at).replace('T', ' ').slice(0, 16) : '—';
    const row = (label, value) => '<div class="role-revoked-row"><b>' + escapeHtml(label) + '</b><span>' + value + '</span></div>';

    document.getElementById('role-revoked-official').textContent = ui.official;
    document.getElementById('role-revoked-title').textContent = ui.revokedTitle;
    document.getElementById('role-revoked-body').innerHTML =
        row(ui.revokedRemoved, escapeHtml(roleName(notice.removed_role))) +
        row(ui.revokedCurrent, escapeHtml(roleName(notice.current_role))) +
        row(ui.revokedBy, escapeHtml(ui.revokedByValue)) +
        row(ui.revokedDate, escapeHtml(when)) +
        row(ui.revokedSupport, escapeHtml(notice.support_email || 'destek@sauran.online')) +
        '<p style="margin-top:14px;">' + escapeHtml(ui.revokedInfo) + '</p>';
    document.getElementById('role-revoked-btn').textContent = ui.ok;

    const overlay = document.getElementById('role-revoked-overlay');
    roleRevokedReturnFocus = document.activeElement;
    chatScreen.inert = true;
    overlay.classList.add('visible');
    overlay.setAttribute('aria-hidden', 'false');
    void overlay.offsetWidth;
    overlay.classList.add('open');
    setTimeout(() => document.getElementById('role-revoked-btn').focus(), 60);
}

function closeRoleRevoked() {
    const overlay = document.getElementById('role-revoked-overlay');

    // Bir kez gösterilir: sunucuda işaretlenir; başarısız olursa bir sonraki girişte tekrar çıkar.
    fetch('/api/me/role-notice-seen', { method: 'POST', credentials: 'include' }).catch(() => {});
    if (currentUser) currentUser.role_notice = null;

    overlay.classList.remove('open');
    overlay.setAttribute('aria-hidden', 'true');
    chatScreen.inert = false;
    setTimeout(() => {
        overlay.classList.remove('visible');
        if (roleRevokedReturnFocus && typeof roleRevokedReturnFocus.focus === 'function') roleRevokedReturnFocus.focus();
    }, 240);
}

document.getElementById('role-revoked-btn').addEventListener('click', closeRoleRevoked);

document.addEventListener('keydown', (event) => {
    const acceptOverlay = document.getElementById('role-notice-overlay');
    if (acceptOverlay.classList.contains('open')) {
        if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); document.getElementById('role-notice-later').click(); return; }
        if (event.key === 'Tab') {
            const focusables = Array.from(acceptOverlay.querySelectorAll('#role-notice-scroll, input, button')).filter((el) => !el.disabled);
            if (!focusables.length) return;
            const first = focusables[0];
            const last = focusables[focusables.length - 1];
            if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
            else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
        }
        return;
    }
    const revokedOverlay = document.getElementById('role-revoked-overlay');
    if (revokedOverlay.classList.contains('open')) {
        if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeRoleRevoked(); }
        if (event.key === 'Tab') { event.preventDefault(); document.getElementById('role-revoked-btn').focus(); }
    }
}, true);


// =====================================================
// SESSION KONTROLÜ
// =====================================================

// Sayfa yenilenince oturum kontrolü: yalnızca sunucu oturumu gerçekten yok dediğinde (401) giriş formu gösterilir.
// Geçici sorunlar (ağ kopması, 5xx, 429 hız sınırı) geçerli oturumu "çıkış yapılmış" gibi göstermesin diye
// birkaç kez yeniden denenir; hâlâ ulaşılamıyorsa kullanıcı, gerçek sebebi anlatan bir mesajla giriş formuna alınır.
async function checkExistingSession() {

    const RETRY_DELAYS_MS = [800, 2000, 4000];
    let transientFailure = false;

    for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {

        try {

            const response = await fetch('/api/me', { method: 'GET', credentials: 'include' });

            if (response.status === 401) { showLoginForm(); return; }

            if (response.ok) {
                const data = await response.json();
                if (data.success && data.user) {
                    setCurrentUser(data.user);
                    connectToChat();
                } else {
                    showLoginForm();
                }
                return;
            }

            transientFailure = true; // 5xx / 429 / diğer: oturumun geçersiz olduğu anlamına GELMEZ

        } catch (error) {

            console.error('Session kontrolü başarısız:', error);
            transientFailure = true;

        }

        if (attempt < RETRY_DELAYS_MS.length) await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS_MS[attempt]));

    }

    showLoginForm();
    if (transientFailure) showAuthError(t('session-check-unreachable'));

}


// =====================================================
// ÇIKIŞ
// =====================================================

// =====================================================
// HESAP ASKIDA BİLDİRİMİ
// =====================================================
// İçerik (user_reason) sunucudan gelen düz metindir; textContent ile yazılır.
// Rapor sahibi, moderasyon notu veya iç gerekçe bu ekrana hiçbir zaman gelmez.

let accountSuspendedHandled = false;

function showSuspensionNotice(userReason) {

    const box = document.getElementById('auth-suspended');
    if (!box) return;

    document.getElementById('auth-suspended-title').textContent = t('suspended-title');

    const reasonEl = document.getElementById('auth-suspended-reason');
    if (userReason) {
        reasonEl.textContent = t('suspended-reason') + ' ' + userReason;
        reasonEl.style.display = 'block';
    } else {
        reasonEl.textContent = '';
        reasonEl.style.display = 'none';
    }

    document.getElementById('auth-suspended-support').textContent = t('suspended-support') + ' destek@sauran.online';
    box.style.display = 'block';

}

// Sunucu 'account_suspended' olayını gönderip bağlantıyı kapatır. Yeniden
// bağlanma denemeleri KAPATILIR (oturum artık geçersiz) ve kullanıcı giriş
// ekranına, askı bildirimiyle birlikte döner.
async function handleAccountSuspended(data) {

    if (accountSuspendedHandled) return;
    accountSuspendedHandled = true;

    try {
        if (socket) socket.io.reconnection(false);
    } catch (error) {}

    await logout();

    showSuspensionNotice(data && data.user_reason);

    accountSuspendedHandled = false;

}

async function logout() {

    await removePushSubscriptionOnLogout();

    try {

        await fetch(
            '/api/logout',
            {
                method: 'POST',
                credentials: 'include'
            }
        );

    } catch (error) {

        console.error(
            'Çıkış hatası:',
            error
        );

    }


    // -------------------------------------------------
    // Socket bağlantısını güvenli şekilde kapat
    // -------------------------------------------------

    if (socket) {

        socket.disconnect();

        socket = null;

    }

    if (callFrame) leaveCall();

    currentHub = null;

    switchToView('hubs');


    // -------------------------------------------------
    // Kullanıcı bilgilerini temizle
    // -------------------------------------------------

    currentUser =
        null;

    currentUsername =
        '';


    // -------------------------------------------------
    // Ekranları değiştir
    // -------------------------------------------------

    loginScreen.style.display =
        'flex';

    chatScreen.style.display =
        'none';


    // -------------------------------------------------
    // Formları temizle
    // -------------------------------------------------

    loginUsernameInput.value =
        '';

    loginPasswordInput.value =
        '';

    registerUsernameInput.value =
        '';

    registerEmailInput.value =
        '';

    registerPasswordInput.value =
        '';

    registerPasswordConfirmInput.value =
        '';

    verifyCodeInput.value =
        '';

    pendingVerifyEmail =
        '';


    usersList.innerHTML =
        '';

    otherProfileModal.style.display =
        'none';

    dmModal.style.display =
        'none';

    activeDmUserId =
        null;

    profileModal.style.display =
        'none';

    statusDropdown.style.display =
        'none';

    profileUsername.textContent =
        '';

    profileAvatar.textContent =
        '';

    profileAvatarImg.style.display =
        'none';

    usernameEdit.style.display =
        'none';

    usernameView.style.display =
        'flex';

    settingsModal.style.display =
        'none';

    hubJoinModal.style.display =
        'none';

    hubInviteModal.style.display =
        'none';

    hubInviteFriendModal.style.display =
        'none';

    friendAddModal.style.display =
        'none';

    notificationsModal.style.display =
        'none';

    notificationsBadge.style.display =
        'none';


    showLoginForm();

}


// =====================================================
// HTML GÜVENLİĞİ
// =====================================================

// Sunucu (SQLite) zamanları UTC'dir ama saat dilimi eki taşımaz ("2026-10-01 04:02:00"); eksiz okunursa tarayıcı yerel saat sanar
// ve Türkiye'de saatler 3 saat geride görünür. Eki olmayan bu biçim UTC olarak okunur; ISO (Z'li) değerler olduğu gibi kalır.
function serverDate(value) {
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(value)) {
        return new Date(value.replace(' ', 'T') + 'Z');
    }
    return new Date(value);
}

// Sunucuya gidiş-dönüş süresi (ms) ve kullanılan bağlantı türü: Ayarlar > Genel'de gösterilir (gecikmeyi tahmin değil ölçerek görmek için).
async function measureSocketLatency(samples = 3) {
    if (!socket || !socket.connected) return null;
    const times = [];
    for (let i = 0; i < samples; i += 1) {
        const t0 = performance.now();
        const ok = await new Promise((resolve) => {
            const timer = setTimeout(() => resolve(false), 5000);
            socket.emit('latency_ping', () => { clearTimeout(timer); resolve(true); });
        });
        if (ok) times.push(performance.now() - t0);
    }
    if (!times.length) return null;
    times.sort((a, b) => a - b);
    return { ms: Math.round(times[Math.floor(times.length / 2)]), transport: socket.io?.engine?.transport?.name || '?' };
}

document.getElementById('settings-connection-info')?.addEventListener('click', () => renderConnectionInfo());

async function renderConnectionInfo() {
    const el = document.getElementById('settings-connection-info');
    if (!el) return;
    el.textContent = t('conn-measuring');
    const r = await measureSocketLatency();
    el.textContent = r ? `${r.ms} ms · ${r.transport === 'websocket' ? 'WebSocket' : t('conn-polling')}` : t('conn-offline');
    el.dataset.quality = !r ? 'bad' : r.ms < 150 ? 'good' : r.ms < 400 ? 'ok' : 'bad';
}

function escapeHtml(value) {

    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');

}


// =====================================================
// ARKADAŞLAR PANELİ (ana ekran sağı)
// =====================================================

const friendsSidebarToggleBtn2 = document.getElementById('friends-sidebar-toggle-btn');
const friendsSidebar2 = document.getElementById('friends-sidebar');
const friendsSidebarList = document.getElementById('friends-sidebar-list');
const unreadDmCounts = new Map(); // userId -> count
const unreadHubCounts = new Map(); // hubId -> { count, muted }

// ─── Okunmamış mesajlar (sunucuda kalıcı; yenileme/başka cihaz sonrası da doğru) ───
async function refreshUnreadCounts() {
    try {
        const response = await fetch('/api/unread', { credentials: 'include' });
        const data = await response.json();
        if (!data.success) return;

        unreadDmCounts.clear();
        Object.entries(data.dms || {}).forEach(([id, count]) => {
            if (Number(id) !== activeDmUserId || document.visibilityState !== 'visible') unreadDmCounts.set(Number(id), count);
        });

        unreadHubCounts.clear();
        Object.entries(data.hubs || {}).forEach(([id, info]) => {
            if (Number(id) !== currentHub?.id || document.visibilityState !== 'visible') unreadHubCounts.set(Number(id), info);
        });

        updateFriendsToggleBadge();
        refreshFriendsSidebar();
        renderHubUnreadBadges();
    } catch (error) {
        console.error('Okunmamış sayıları alınamadı:', error);
    }
}

function renderGroupsRailDot() {
    const dot = document.getElementById('rail-groups-dot');
    if (!dot) return;
    const any = (groupsCache || []).some((g) => { const i = unreadHubCounts.get(g.id); return i && !i.muted && (i.count > 0 || i.mentions > 0); });
    dot.style.display = any ? '' : 'none';
}

function renderHubUnreadBadges() {
    try { renderGroupsRailDot(); } catch (_) { /* gruplar henüz yüklenmedi */ }
    document.querySelectorAll('[data-hub-unread]').forEach((el) => {
        const info = unreadHubCounts.get(Number(el.dataset.hubUnread));
        const count = info?.count || 0;
        const mentions = info?.mentions || 0;
        el.textContent = mentions ? `@ ${mentions > 99 ? '99+' : mentions}` : (count > 99 ? '99+' : String(count));
        el.style.display = count > 0 || mentions > 0 ? 'inline-flex' : 'none';
        el.classList.toggle('is-muted', Boolean(info?.muted) && !mentions);
        el.classList.toggle('has-mention', mentions > 0);
        el.title = mentions ? t('mention-badge-title') : '';
    });
}

const readMarkTimers = new Map();

// Sohbet görülünce sunucuya "buraya kadar okundu" bildirilir (art arda gelenler birleştirilir).
function markReadSoon(type, id, messageId) {
    if (!id || !messageId) return;
    const key = `${type}:${id}`;
    const prev = readMarkTimers.get(key);
    if (prev) clearTimeout(prev.timer);
    const upTo = Math.max(Number(messageId), prev?.messageId || 0);
    const timer = setTimeout(() => {
        readMarkTimers.delete(key);
        fetch('/api/read-state', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
            body: JSON.stringify({ type, id, message_id: upTo })
        }).catch(() => { /* bir sonraki görüntülemede yeniden denenir */ });
    }, 400);
    readMarkTimers.set(key, { timer, messageId: upTo });
}

function latestFeedMessageId(feed) {
    const items = [...feed.querySelectorAll('[data-message-id]')].filter((el) => /^[0-9]+$/.test(el.dataset.messageId));
    return items.length ? Number(items[items.length - 1].dataset.messageId) : null;
}

// Açık sohbet görünür hâldeyse en son mesaja kadar okundu say.
function markOpenChatsRead() {
    if (document.visibilityState !== 'visible') return;
    if (activeDmUserId && dmModal.style.display === 'flex') {
        unreadDmCounts.delete(activeDmUserId);
        markReadSoon('dm', activeDmUserId, latestFeedMessageId(dmFeed));
    }
    if (currentHub && document.body.dataset.view === 'hub-detail') {
        unreadHubCounts.delete(currentHub.id);
        markReadSoon('hub', currentHub.id, latestFeedMessageId(hubFeed));
    }
}

document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    markOpenChatsRead();
    refreshUnreadCounts();
});

// Sağdaki "Arkadaşlar" düğmesinin üstünde toplam okunmamış özel mesaj sayısını göster.
function updateFriendsToggleBadge() {
    const badge = document.getElementById('friends-sidebar-toggle-badge');
    if (!badge) return;

    let total = 0;
    unreadDmCounts.forEach((count) => { total += count; });

    badge.textContent = total > 99 ? '99+' : String(total);
    badge.style.display = total > 0 ? 'flex' : 'none';
}

friendsSidebarToggleBtn2.addEventListener('click', () => {
    friendsSidebar2.classList.toggle('open');
    friendsSidebarToggleBtn2.classList.toggle('open');
});

async function loadFriendsSidebar() {

    try {

        const response = await fetch('/api/friends', { credentials: 'include' });
        const data = await response.json();
        if (!data.success) return;

        try {
            const deletedRes = await fetch('/api/dm/deleted', { credentials: 'include' });
            const deletedData = await deletedRes.json();
            deletedDmThreads = deletedData.success ? deletedData.threads : [];
        } catch (_) { deletedDmThreads = []; }

        renderFriendsSidebar(data.friends);
        loadFriendFavorites();
        loadGroups();

    } catch (error) {
        console.error('Arkadaş listesi alınamadı:', error);
    }

}

// ─── Sık Tercihlerim: DM'de en çok etkileşime girilen 3 arkadaş (üstte, yan yana) ───────────────
// Sıralama sunucuda hesaplanır (yalnızca kendi sohbetlerin; sayılar istemciye/başkasına gösterilmez). Etkileşim yoksa bölüm gizlenir.
let friendFavorites = [];

async function loadFriendFavorites() {
    try {
        const response = await fetch('/api/friends/top?limit=3&all=1', { credentials: 'include' });
        const data = await response.json();
        friendFavorites = data.success ? data.friends.slice(0, 3) : [];
    } catch (_) {
        friendFavorites = [];
    }
    renderFriendFavorites();
}

function renderFriendFavorites() {
    const box = document.getElementById('friends-favorites');
    const row = document.getElementById('friends-favorites-row');
    if (!box || !row) return;

    if (!friendFavorites.length) { box.style.display = 'none'; row.innerHTML = ''; return; }

    box.style.display = '';
    row.innerHTML = friendFavorites.map((f) => {
        if (f.avatar_data) knownAvatars.set(f.id, f.avatar_data);
        knownVoicePlus.set(f.id, Boolean(f.plus_active));
        knownNameFx.set(f.id, f.name_effect || 'none');
        const frameKey = resolveFrame(f.id, f.avatar_frame);
        const favColor = resolveUserColor(f.id, f.username, f.profile_color);
        const unread = unreadDmCounts.get(f.id) || 0;
        const inner = f.avatar_data
            ? `<img src="${escapeAttr(f.avatar_data)}" alt="">`
            : escapeHtml((f.username || '?').charAt(0).toUpperCase());
        const frameClass = frameKey && frameKey !== 'classic' ? ` frame-${escapeAttr(frameKey)}` : '';
        const frameOverlay = frameOverlayHtml(frameKey);
        return `
            <button type="button" class="friends-fav" data-friend-id="${f.id}" data-friend-name="${escapeAttr(f.username)}" title="${escapeAttr(f.username)}">
                <span class="friends-fav-avatar${frameClass}" style="--user-color:${favColor};">
                    ${inner}
                    <span class="friends-fav-dot${f.online ? ' on' : ''}" aria-hidden="true"></span>
                    ${unread > 0 ? `<span class="friends-fav-unread">${unread > 9 ? '9+' : unread}</span>` : ''}
                    ${frameOverlay}
                </span>
                <span class="friends-fav-name">${usernameCardHtml(f.username, f.plus_active, f.name_effect)}</span>
            </button>`;
    }).join('');

    row.querySelectorAll('.friends-fav').forEach((btn) => {
        btn.addEventListener('click', () => {
            const userId = Number(btn.dataset.friendId);
            unreadDmCounts.delete(userId);
            updateFriendsToggleBadge();
            openDm(userId, btn.dataset.friendName);
        });
    });
}

function refreshFriendsSidebar() {
    if (hubListView.style.display !== 'none') loadFriendsSidebar();
}

// Hesabı silinmiş kişilerle olan korunmuş sohbetler (salt okunur): listenin sonunda "Silinmiş hesap" olarak görünür.
function buildDeletedDmRowsHtml() {
    return (deletedDmThreads || []).map((thread) => `
        <div class="friends-sidebar-row deleted-account" data-deleted-thread="${escapeAttr(thread.token)}">
            <span class="friends-sidebar-presence" aria-hidden="true"></span>
            <span class="friends-sidebar-avatar-wrap"><span class="friends-sidebar-avatar" style="--user-color:#6b7280;">?</span></span>
            <span class="friends-sidebar-name">${escapeHtml(t('deleted-account-label'))}</span>
            <button type="button" class="friends-sidebar-deleted-del" data-deleted-del="${escapeAttr(thread.token)}" title="${escapeAttr(t('deleted-dm-delete'))}">🗑</button>
        </div>
    `).join('');
}

function renderFriendsSidebar(friends) {

    renderFriendFavorites();

    if ((!friends || friends.length === 0) && (!deletedDmThreads || deletedDmThreads.length === 0)) {
        friendsSidebarList.innerHTML = `<div class="friends-sidebar-empty">${t('friends-empty')}</div>`;
        return;
    }

    friendsSidebarList.innerHTML = friends.map((f) => {

        const color = resolveUserColor(f.id, f.username, f.profile_color);
        const initial = f.username.charAt(0).toUpperCase();
        const unread = unreadDmCounts.get(f.id) || 0;

        // Arkadaş listesi (gizlilik ayarına göre süzülmüş) profil görselinin güncel kaynağıdır; DM başlığı da bundan yararlanır.
        if (f.avatar_data) knownAvatars.set(f.id, f.avatar_data); else knownAvatars.delete(f.id);
        knownVoicePlus.set(f.id, Boolean(f.plus_active));
        knownNameFx.set(f.id, f.name_effect || 'none');
        const frameKey = resolveFrame(f.id, f.avatar_frame);
        const frameClass = frameKey && frameKey !== 'classic' ? ` frame-${escapeAttr(frameKey)}` : '';
        const frameOverlay = frameOverlayHtml(frameKey);

        const avatarInner = f.avatar_data
            ? `<img src="${escapeAttr(f.avatar_data)}" alt="">`
            : escapeHtml(initial);

        // Çevrimdışı ya da durumunu "gizli" yapmış arkadaşlar sunucuda zaten
        // online=false gelir; ikisi de gri görünür, gizli durum asla ele verilmez.
        const statusInfo = f.online ? STATUS_INFO[f.status] : null;
        const statusClass = statusInfo ? statusInfo.className : 'status-offline';
        const statusTitle = statusInfo ? statusInfo.label : '';

        return `
            <div class="friends-sidebar-row ${f.online ? 'online' : ''}" data-friend-id="${f.id}" data-friend-name="${escapeAttr(f.username)}">
                <span class="friends-sidebar-presence" aria-hidden="true"></span>
                <span class="friends-sidebar-avatar-wrap${frameClass}">
                    <span class="friends-sidebar-avatar" style="--user-color:${color};">${avatarInner}</span>
                    ${frameOverlay}
                    <span class="status-hex status-hex-sm friends-sidebar-status ${statusClass}" title="${escapeAttr(statusTitle)}"></span>
                </span>
                <span class="friends-sidebar-name">${usernameCardHtml(f.username, f.plus_active, f.name_effect)}${f.activity ? `<small class="friends-activity">🎮 ${escapeHtml(f.activity)}</small>` : ''}</span>
                ${unread > 0 ? `<span class="friends-sidebar-unread">${unread}</span>` : ''}
            </div>
        `;

    }).join('') + buildDeletedDmRowsHtml();

    // Avatara tıklama → profil penceresi (mesaj gönder seçeneği olmadan, çünkü
    // buradan zaten tek tıkla sohbete geçilebiliyor). Satırın geri kalanına
    // tıklama → doğrudan sohbet penceresi. stopPropagation ile ikisi ayrılıyor.
    friendsSidebarList.querySelectorAll('.friends-sidebar-row:not(.deleted-account)').forEach((row) => {

        const userId = Number(row.dataset.friendId);
        const username = row.dataset.friendName;

        row.querySelector('.friends-sidebar-avatar-wrap').addEventListener('click', (event) => {
            event.stopPropagation();
            openOtherProfile(userId, { hideMessageAction: true });
        });

        row.addEventListener('click', () => {
            unreadDmCounts.delete(userId);
            updateFriendsToggleBadge();
            renderFriendsSidebar(friends);
            openDm(userId, username);
        });

    });

    friendsSidebarList.querySelectorAll('.friends-sidebar-row.deleted-account').forEach((row) => {

        const token = row.dataset.deletedThread;

        row.addEventListener('click', () => openDeletedDm(token));

        row.querySelector('[data-deleted-del]').addEventListener('click', async (event) => {
            event.stopPropagation();
            if (!window.confirm(t('deleted-dm-delete-confirm'))) return;

            try {
                await fetch(`/api/dm/deleted/${encodeURIComponent(token)}`, { method: 'DELETE', credentials: 'include' });
            } catch (error) {
                console.error('Sohbet silinemedi:', error);
            }

            if (dmReadOnly) dmModal.style.display = 'none';
            loadFriendsSidebar();
        });

    });

}


// =====================================================
// ÇEVRİMİÇİ / ARKADAŞLAR MODALI
// =====================================================

closeModalBtn.addEventListener(
    'click',
    () => usersModal.style.display = 'none'
);


usersModal.addEventListener(
    'click',
    (event) => {
        if (event.target === usersModal) usersModal.style.display = 'none';
    }
);


function refreshOnlinePanelIfOpen() {

    if (usersModal.style.display === 'flex') {
        openOnlinePanel();
    }

}


async function openOnlinePanel() {

    usersModalTitle.textContent = '👥 Arkadaşlar';
    friendRequestsSection.style.display = 'none';
    usersListSubtitle.style.display = 'block';
    usersListSubtitle.textContent = 'ARKADAŞLARIM';

    try {

        const [friendsRes, requestsRes, topRes] = await Promise.all([
            fetch('/api/friends', { credentials: 'include' }),
            fetch('/api/friends/requests', { credentials: 'include' }),
            fetch('/api/friends/top', { credentials: 'include' })
        ]);

        const friendsData = await friendsRes.json();
        const requestsData = await requestsRes.json();
        const topData = await topRes.json();

        renderUsersList(friendsData.friends, false);

        if (requestsData.requests.length > 0) {

            friendRequestsSection.style.display = 'block';
            renderFriendRequests(requestsData.requests);

        } else {

            friendRequestsSection.style.display = 'none';

        }

        if (topData.success && topData.friends.length > 0) {

            topFriendsSection.style.display = 'block';
            renderTopFriends(topData.friends);

        } else {

            topFriendsSection.style.display = 'none';

        }

    } catch (error) {

        console.error('Arkadaşlar alınamadı:', error);

    }

}


function renderTopFriends(friends) {

    topFriendsList.innerHTML = friends.map(f => `
        <div class="top-friend-item" data-user-id="${f.id}">
            <span class="profile-avatar" style="--user-color:${getUserColor(f.username)};">${escapeHtml(f.username.charAt(0).toUpperCase())}</span>
            <span>${usernameCardHtml(f.username, f.plus_active, f.name_effect)}</span>
        </div>
    `).join('');

    topFriendsList.querySelectorAll('.top-friend-item').forEach((item) => {

        item.addEventListener('click', () => {
            usersModal.style.display = 'none';
            openOtherProfile(Number(item.dataset.userId));
        });

    });

}


function renderUsersList(list, isHubMembers) {

    usersList.innerHTML = '';

    if (list.length === 0) {

        usersList.innerHTML = `<div class="users-list-empty">${isHubMembers ? 'Bu Lobi\'da kimse yok.' : 'Henüz arkadaşın yok. Yukarıdan ekleyebilirsin.'}</div>`;
        return;

    }

    list.forEach((person) => {

        const li = document.createElement('li');
        const isMe = person.id === currentUser.id;

        li.textContent = person.username;
        li.style.color = getUserColor(person.username);
        li.classList.toggle('is-online', Boolean(person.online));
        li.classList.toggle('me', isMe);

        if (!isMe) {

            li.addEventListener('click', () => {
                usersModal.style.display = 'none';
                openOtherProfile(person.id);
            });

        }

        usersList.appendChild(li);

    });

}


function renderFriendRequests(requests) {

    friendRequestsList.innerHTML = requests.map(r => `
        <div class="friend-request-row" data-user-id="${r.user_id}">
            <span class="friend-request-name">${escapeHtml(r.username)}</span>
            <div class="friend-request-actions">
                <button class="friend-accept-btn" data-accept="${r.user_id}">Kabul Et</button>
                <button class="friend-decline-btn" data-decline="${r.user_id}">Reddet</button>
            </div>
        </div>
    `).join('');

    friendRequestsList.querySelectorAll('[data-accept]').forEach((btn) => {

        btn.addEventListener('click', async () => {

            await fetch('/api/friends/respond', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ user_id: Number(btn.dataset.accept), accept: true })
            });

            openOnlinePanel();

        });

    });

    friendRequestsList.querySelectorAll('[data-decline]').forEach((btn) => {

        btn.addEventListener('click', async () => {

            await fetch('/api/friends/respond', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ user_id: Number(btn.dataset.decline), accept: false })
            });

            openOnlinePanel();

        });

    });

}


friendAddOpenBtn.addEventListener(
    'click',
    () => {

        friendAddInput.value = '';
        friendAddError.textContent = '';
        friendAddModal.style.display = 'flex';
        friendAddInput.focus();

    }
);


friendAddCloseBtn.addEventListener(
    'click',
    () => friendAddModal.style.display = 'none'
);


friendAddModal.addEventListener(
    'click',
    (event) => {
        if (event.target === friendAddModal) friendAddModal.style.display = 'none';
    }
);


friendAddBtn.addEventListener(
    'click',
    async () => {

        const username = friendAddInput.value.trim();
        friendAddError.textContent = '';

        if (!username) return;

        try {

            const lookup = await fetch(`/api/users/lookup?username=${encodeURIComponent(username)}`, { credentials: 'include' });
            const lookupData = await lookup.json();

            if (!lookupData.success) {
                friendAddError.textContent = lookupData.error || 'Kullanıcı bulunamadı.';
                return;
            }

            const response = await fetch('/api/friends/request', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ to_user_id: lookupData.user.id })
            });

            const data = await response.json();

            if (!data.success) {
                friendAddError.textContent = data.error || 'İstek gönderilemedi.';
                return;
            }

            friendAddInput.value = '';
            friendAddError.style.color = '#57f287';
            friendAddError.textContent = 'İstek gönderildi.';

        } catch (error) {

            console.error('Arkadaş eklenemedi:', error);
            friendAddError.style.color = '';
            friendAddError.textContent = 'Sunucuya bağlanılamadı.';

        }

    }
);


friendAddInput.addEventListener(
    'keypress',
    (event) => {
        if (event.key === 'Enter') friendAddBtn.click();
    }
);


// =====================================================
// BİLDİRİMLER
// =====================================================

async function refreshNotificationsBadge() {

    try {

        const response = await fetch('/api/notifications', { credentials: 'include' });
        const data = await response.json();

        if (!data.success) return;

        const count = data.notifications.filter((n) => n.status === 'pending').length;
        notificationsBadge.style.display = count > 0 ? 'flex' : 'none';
        notificationsBadge.textContent = count;
        topbarMenuBadge.style.display = count > 0 ? 'block' : 'none';

    } catch (error) {

        console.error('Bildirimler alınamadı:', error);

    }

}


notificationsBtn.addEventListener(
    'click',
    async () => {

        try {

            const response = await fetch('/api/notifications', { credentials: 'include' });
            const data = await response.json();

            if (!data.success) return;

            renderNotifications(data.notifications);
            notificationsModal.style.display = 'flex';

        } catch (error) {

            console.error('Bildirimler alınamadı:', error);

        }

    }
);


notificationsCloseBtn.addEventListener(
    'click',
    () => notificationsModal.style.display = 'none'
);


notificationsModal.addEventListener(
    'click',
    (event) => {
        if (event.target === notificationsModal) notificationsModal.style.display = 'none';
    }
);


const NOTIF_UI = {
    tr: {
        readAll: 'Tümünü okundu say',
        clearAll: 'Bildirimleri sil',
        del: 'Sil',
        confirmClear: 'Yanıt bekleyenler (arkadaşlık isteği, lobi daveti, kabul bekleyen görev) hariç tüm bildirimler kalıcı olarak silinecek. Emin misin?',
        empty: 'Bildirim yok.',
        openNotice: 'Görev Bildirimini Aç'
    },
    en: {
        readAll: 'Mark all as read',
        clearAll: 'Delete notifications',
        del: 'Delete',
        confirmClear: 'All notifications except those awaiting your response (friend requests, lobby invites, duty pending acceptance) will be permanently deleted. Are you sure?',
        empty: 'No notifications.',
        openNotice: 'Open Duty Notice'
    }
};

async function reloadNotifications() {
    try {
        const response = await fetch('/api/notifications', { credentials: 'include' });
        const data = await response.json();
        if (!data.success) return;
        renderNotifications(data.notifications);
    } catch (error) {
        console.error('Bildirimler alınamadı:', error);
    }
    refreshNotificationsBadge();
}

function renderNotifications(notifications) {

    const nui = NOTIF_UI[roleNoticeLang()];

    if (notifications.length === 0) {
        notificationsList.innerHTML = '<div class="notifications-empty">' + escapeHtml(nui.empty) + '</div>';
        return;
    }

    const toolbar = `
        <div class="notifications-toolbar">
            <button type="button" class="notifications-tool-btn" data-notif-read-all>${escapeHtml(nui.readAll)}</button>
            <button type="button" class="notifications-tool-btn danger" data-notif-clear-all>${escapeHtml(nui.clearAll)}</button>
        </div>
    `;

    // Bilgi amaçlı (yanıt gerektirmeyen) kartlar: okundu yapılınca listeden KALKMAZ, yalnızca kullanıcı silince gider.
    const infoActions = (n, okLabel) => `
        <div class="notification-actions">
            ${n.status === 'pending' ? `<button class="notification-accept" data-dismiss type="button">${escapeHtml(okLabel)}</button>` : ''}
            <button class="notification-delete" data-delete type="button">${escapeHtml(nui.del)}</button>
        </div>
    `;
    const seenClass = (n) => (n.status === 'seen' ? ' notification-seen' : '');

    notificationsList.innerHTML = toolbar + notifications.map((n) => {

        if (n.type === 'hub_invite') {

            return `
                <div class="notification-card" data-notif-id="${n.id}" data-notif-type="hub_invite">
                    <div class="notification-text">
                        <strong>${escapeHtml(n.data.from_username)}</strong> seni
                        <strong>${escapeHtml(n.data.hub_name)}</strong> lobisine davet etti.
                    </div>
                    <div class="notification-actions">
                        <button class="notification-accept" data-accept type="button">Katıl</button>
                        <button class="notification-decline" data-decline type="button">Reddet</button>
                    </div>
                </div>
            `;

        }

        if (n.type === 'friend_request') {

            return `
                <div class="notification-card" data-notif-id="${n.id}" data-notif-type="friend_request" data-from-user-id="${n.data.from_user_id}">
                    <div class="notification-text">
                        <strong>${escapeHtml(n.data.from_username)}</strong> ${t('friend-request-notif-text')}.
                    </div>
                    <div class="notification-actions">
                        <button class="notification-accept" data-accept type="button">${t('call-accept')}</button>
                        <button class="notification-decline" data-decline type="button">${t('call-decline')}</button>
                    </div>
                </div>
            `;

        }

        if (n.type === 'voice_muted') {

            const d = n.data || {};
            const duration = d.expires_at ? `${new Date(d.expires_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}'e kadar` : t('voice-mute-until').toLowerCase();
            return `
                <div class="notification-card${seenClass(n)}" data-notif-id="${n.id}" data-notif-type="voice_muted">
                    <div class="notification-text">
                        🔇 <strong>${escapeHtml(voiceMuteByLabel(d.by_tier))}</strong> seni <strong>${escapeHtml(d.room_name || '')}</strong> sesli odasında susturdu (${escapeHtml(duration)}).
                        ${escapeHtml(t('voice-muted-share-note'))}
                    </div>
                    ${infoActions(n, t('ok-got-it'))}
                </div>
            `;

        }

        if (n.type === 'hub_mention') {

            const d = n.data || {};
            return `
                <div class="notification-card${seenClass(n)}" data-notif-id="${n.id}" data-notif-type="hub_mention">
                    <div class="notification-text">
                        @ <strong>${escapeHtml(d.from_username || '')}</strong> ${escapeHtml(t('mention-toast'))} · <strong>${escapeHtml(d.hub_name || '')}</strong>
                        ${d.preview ? `<div class="notification-preview">“${escapeHtml(d.preview)}”</div>` : ''}
                    </div>
                    ${infoActions(n, t('ok-got-it'))}
                </div>
            `;

        }

        if (n.type === 'voice_kicked') {

            const d = n.data || {};
            return `
                <div class="notification-card${seenClass(n)}" data-notif-id="${n.id}" data-notif-type="voice_kicked">
                    <div class="notification-text">
                        👢 <strong>${escapeHtml(voiceMuteByLabel(d.by_tier))}</strong> seni <strong>${escapeHtml(d.room_name || '')}</strong> sesli odasından attı.
                        ${escapeHtml(!d.blocked ? t('voice-kick-can-rejoin') : d.expires_at ? `${t('voice-kick-blocked-for')} ${new Date(d.expires_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.` : t('voice-kick-blocked-until'))}
                    </div>
                    ${infoActions(n, t('ok-got-it'))}
                </div>
            `;

        }

        if (n.type === 'voice_unblocked') {

            const d = n.data || {};
            return `
                <div class="notification-card${seenClass(n)}" data-notif-id="${n.id}" data-notif-type="voice_unblocked">
                    <div class="notification-text">🚪 <strong>${escapeHtml(d.room_name || '')}</strong> ${escapeHtml(t('voice-unblocked-toast'))}</div>
                    ${infoActions(n, t('ok-got-it'))}
                </div>
            `;

        }

        if (n.type === 'voice_unmuted') {

            const d = n.data || {};
            return `
                <div class="notification-card${seenClass(n)}" data-notif-id="${n.id}" data-notif-type="voice_unmuted">
                    <div class="notification-text">
                        🔈 <strong>${escapeHtml(d.room_name || '')}</strong> sesli odasındaki susturman ${d.reason === 'expired' ? 'süresi dolduğu için' : ''} kaldırıldı.
                    </div>
                    ${infoActions(n, t('ok-got-it'))}
                </div>
            `;

        }

        if (n.type === 'friend_request_accepted') {

            return `
                <div class="notification-card${seenClass(n)}" data-notif-id="${n.id}" data-notif-type="friend_request_accepted">
                    <div class="notification-text">
                        <strong>${escapeHtml(n.data.from_username)}</strong> ${t('friend-accepted-notif-text')}.
                    </div>
                    ${infoActions(n, t('ok-got-it'))}
                </div>
            `;

        }

        if (n.type === 'gift') {

            const collected = n.status !== 'pending';
            return `
                <div class="notification-card gift-notification-card${collected ? ' notification-seen' : ''}" data-notif-id="${n.id}" data-notif-type="gift">
                    <div class="notification-official-tag">Sauran Moderasyon Ekibi</div>
                    <div class="notification-text">
                        🎁 Sana bir hediye gönderildi: <strong>${escapeHtml(n.data.label || 'Ödül')}</strong>${n.data.quantity > 1 ? ` × ${n.data.quantity}` : ''}
                    </div>
                    <div class="notification-actions">
                        ${collected
                            ? `<span class="gift-collected-tag">✓ Kitaplığına eklendi</span>`
                            : `<button class="notification-accept" data-collect-gift type="button">🎁 Ödülü Topla</button>`}
                    </div>
                </div>
            `;

        }

        if (n.type === 'platform_role_notice') {

            const ui = ROLE_NOTICE_UI[roleNoticeLang()];
            const roleLabel = ui.roles[n.data.role] || n.data.role;

            return `
                <div class="notification-card" data-notif-id="${n.id}" data-notif-type="platform_role_notice">
                    <div class="notification-official-tag">${escapeHtml(ui.official)}</div>
                    <div class="notification-text">
                        <strong>${escapeHtml(ui.title)}</strong> — ${escapeHtml(roleLabel)}
                    </div>
                    <div class="notification-actions">
                        <button class="notification-accept" data-open-role-notice type="button">${escapeHtml(nui.openNotice)}</button>
                    </div>
                </div>
            `;

        }

        if (n.type === 'platform_role_revoked') {

            const ui = ROLE_NOTICE_UI[roleNoticeLang()];
            const removed = ui.roles[n.data.removed_role] || n.data.removed_role;

            return `
                <div class="notification-card${seenClass(n)}" data-notif-id="${n.id}" data-notif-type="platform_role_revoked">
                    <div class="notification-official-tag">${escapeHtml(ui.official)}</div>
                    <div class="notification-text">
                        <strong>${escapeHtml(ui.revokedTitle)}</strong> (${escapeHtml(removed)})
                    </div>
                    ${infoActions(n, ui.ok)}
                </div>
            `;

        }

        return '';

    }).join('');

    notificationsList.querySelectorAll('[data-notif-type="platform_role_notice"]').forEach((card) => {

        card.querySelector('[data-open-role-notice]').addEventListener('click', async () => {
            await refreshCurrentUserRole();
            roleNoticeDismissed = false;
            if (currentUser && currentUser.role_acceptance && currentUser.role_acceptance.pending) {
                notificationsModal.style.display = 'none';
                openRoleNotice();
            } else {
                // Görev artık kabul beklemiyor: pencereyi kapatma, güncel listeyi göster (eski kart sunucuda temizlenir).
                reloadNotifications();
            }
        });

    });

    // Ortak işleyiciler: okundu (kart listede kalır, soluklaşır) ve sil (kart gider).
    notificationsList.querySelectorAll('.notification-card [data-dismiss]').forEach((btn) => {
        btn.addEventListener('click', async () => {
            const card = btn.closest('.notification-card');
            await fetch(`/api/notifications/${card.dataset.notifId}/read`, { method: 'POST', credentials: 'include' });
            card.classList.add('notification-seen');
            btn.remove();
            refreshNotificationsBadge();
        });
    });

    notificationsList.querySelectorAll('.notification-card [data-delete]').forEach((btn) => {
        btn.addEventListener('click', async () => {
            const card = btn.closest('.notification-card');
            await fetch(`/api/notifications/${card.dataset.notifId}`, { method: 'DELETE', credentials: 'include' });
            reloadNotifications();
        });
    });

    notificationsList.querySelectorAll('[data-collect-gift]').forEach((btn) => {
        btn.addEventListener('click', () => {
            const card = btn.closest('.notification-card');
            const notifId = card.dataset.notifId;
            const notif = notifications.find((n) => String(n.id) === String(notifId));
            if (notif) openGiftBoxModal(notif);
        });
    });

    const readAllBtn = notificationsList.querySelector('[data-notif-read-all]');
    if (readAllBtn) {
        readAllBtn.addEventListener('click', async () => {
            await fetch('/api/notifications/read-all', { method: 'POST', credentials: 'include' });
            reloadNotifications();
        });
    }

    const clearAllBtn = notificationsList.querySelector('[data-notif-clear-all]');
    if (clearAllBtn) {
        clearAllBtn.addEventListener('click', async () => {
            if (!confirm(nui.confirmClear)) return;
            await fetch('/api/notifications', { method: 'DELETE', credentials: 'include' });
            reloadNotifications();
        });
    }

    notificationsList.querySelectorAll('[data-notif-type="friend_request"]').forEach((card) => {

        const fromUserId = Number(card.dataset.fromUserId);

        card.querySelector('[data-accept]').addEventListener('click', async () => {
            await fetch('/api/friends/respond', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
                body: JSON.stringify({ user_id: fromUserId, accept: true })
            });
            refreshFriendsSidebar();
            refreshNotificationsBadge();
            card.remove();
        });

        card.querySelector('[data-decline]').addEventListener('click', async () => {
            await fetch('/api/friends/respond', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
                body: JSON.stringify({ user_id: fromUserId, accept: false })
            });
            refreshNotificationsBadge();
            card.remove();
        });

    });

    notificationsList.querySelectorAll('[data-notif-type="hub_invite"]').forEach((card) => {

        const notifId = Number(card.dataset.notifId);

        card.querySelector('[data-accept]').addEventListener('click', async () => {

            const response = await fetch(`/api/notifications/${notifId}/respond`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ accept: true })
            });

            const data = await response.json();

            if (data.success) {
                notificationsModal.style.display = 'none';
                loadHubList();
                refreshNotificationsBadge();
                openHub(data.hub_id);
            }

        });

        card.querySelector('[data-decline]').addEventListener('click', async () => {

            await fetch(`/api/notifications/${notifId}/respond`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ accept: false })
            });

            card.remove();
            refreshNotificationsBadge();

        });

    });

}

// =====================================================
// HEDİYE KUTUSU (bildirimden "Ödülü Topla")
// =====================================================

const GIFT_ICON_BY_KEY = {
    coin: '🪙', plus: '✦', premium: '👑',
    ocean: '🌊', neon: '⚡', galaxy: '🌌', supporter: '👑',
    profile_theme: '🎨', profile_effect: '✨', name_effect: '🔤',
    avatar_frame: '🖼️', lobby_theme: '🏠', lobby_image: '🖼️',
    custom_emoji: '😊', sticker_pack: '🧩'
};

function openGiftBoxModal(notif) {
    const modal = document.getElementById('gift-box-modal');
    const visual = document.getElementById('gift-box-visual');
    const stage = document.getElementById('gift-box-stage');
    const reveal = document.getElementById('gift-box-reveal');
    const revealIcon = document.getElementById('gift-box-reveal-icon');
    const revealLabel = document.getElementById('gift-box-reveal-label');
    const revealSub = document.getElementById('gift-box-reveal-sub');
    const hint = document.getElementById('gift-box-hint');
    const claimBtn = document.getElementById('gift-box-claim-btn');

    // Sıfırla (aynı modal tekrar açılırsa önceki durumdan kalmasın).
    visual.style.display = '';
    visual.classList.remove('opening');
    reveal.style.display = 'none';
    stage.classList.remove('revealed');
    hint.style.display = '';
    hint.textContent = 'Kutuya dokun';
    claimBtn.style.display = 'none';

    const data = notif.data || {};
    const key = data.item_key || data.product || '';
    const icon = GIFT_ICON_BY_KEY[key] || '🎁';

    const openBox = () => {
        if (visual.classList.contains('opening')) return;
        visual.classList.add('opening');
        setTimeout(() => {
            visual.style.display = 'none';
            reveal.style.display = 'flex';
            stage.classList.add('revealed');
            revealIcon.textContent = icon;
            revealLabel.textContent = data.label || 'Ödül';
            revealSub.textContent = data.quantity > 1 ? `× ${data.quantity} ${data.unit || ''}`.trim() : (data.rarity ? data.rarity.toUpperCase() : '');
            hint.style.display = 'none';
            claimBtn.style.display = '';
        }, 550);
    };

    visual.onclick = openBox;

    claimBtn.onclick = async () => {
        claimBtn.disabled = true;
        try {
            await fetch(`/api/notifications/${notif.id}/read`, { method: 'POST', credentials: 'include' });
        } catch (_) { /* bildirim geçmişte kalır, hediyenin kendisi zaten hesapta */ }
        modal.style.display = 'none';
        refreshNotificationsBadge();
        if (notificationsModal.style.display === 'flex') reloadNotifications();
        showToast('📚 Kitaplığına eklendi.');
        claimBtn.disabled = false;
    };

    modal.style.display = 'flex';
}

document.getElementById('gift-box-close-btn')?.addEventListener('click', () => {
    document.getElementById('gift-box-modal').style.display = 'none';
});
document.getElementById('gift-box-modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'gift-box-modal') e.currentTarget.style.display = 'none';
});


// =====================================================
// SAURAN MARKET / KİTAPLIĞIM (uygulama içi panel)
// =====================================================

const RARITY_LABEL = { free: 'Ücretsiz', rare: 'Rare', epic: 'Epic', legendary: 'Legendary', special: 'Özel' };

function mkPreviewHtml(item) {
    if (item.key === 'supporter') {
        return `<span class="sf-overlay" aria-hidden="true"><img src="assets/frame-supporter.png" class="sf-ring-img" alt="${escapeHtml(item.label)}"><span class="sf-highlight"></span></span>`;
    }
    if (item.key === 'plus') {
        return `${escapeHtml(item.label.charAt(0))}${plusFrameOverlayHtml()}`;
    }
    return escapeHtml(item.label.charAt(0));
}

function mkCardHtml(item, { showPrice }) {
    const previewClass = item.key !== 'classic' ? ('frame-' + item.key) : '';
    let btn;
    if (item.equipped) btn = `<button class="mk-btn owned" disabled>✓ Kuşanılı</button>`;
    else if (item.owned) btn = `<button class="mk-btn" data-mk-equip="${escapeHtml(item.key)}">Kuşan</button>`;
    else btn = `<button class="mk-btn" disabled>${item.purchasable ? 'Satın Al' : 'Satın Al — Yakında'}</button>`;
    const priceText = item.price === 0 ? 'Ücretsiz' : (item.price == null ? '—' : `${item.price} 🪙`);
    return `<div class="mk-card">
        <div class="mk-avatar-preview profile-avatar-wrap ${previewClass}">${mkPreviewHtml(item)}</div>
        <div class="mk-name">${escapeHtml(item.label)}</div>
        <span class="mk-rarity mk-rarity-${item.rarity}">${escapeHtml(RARITY_LABEL[item.rarity] || item.rarity)}</span>
        ${showPrice ? `<div class="mk-price">${priceText}</div>` : ''}
        ${btn}
    </div>`;
}

async function mkFetchFrames() {
    const r = await fetch('/api/market/frames', { credentials: 'include' });
    let body = {}; try { body = await r.json(); } catch (_) {}
    return { status: r.status, body };
}

async function loadMarketModal() {
    const state = document.getElementById('market-state');
    const main = document.getElementById('market-main');
    state.style.display = 'none'; main.style.display = 'none';
    const r = await mkFetchFrames();
    if (r.status !== 200) { state.style.display = 'block'; state.textContent = r.status === 401 ? 'Giriş yapmalısın.' : 'Market yüklenemedi.'; return; }
    try {
        const w = await fetch('/api/wallet', { credentials: 'include' });
        if (w.status === 200) { const wb = await w.json(); document.getElementById('market-wallet').textContent = `🪙 ${wb.balance} Coin`; }
    } catch (_) {}
    const classic = { key: 'classic', label: 'Klasik', rarity: 'free', price: 0, purchasable: false, owned: true, equipped: r.body.equipped === 'classic' };
    // Plus'a ait ürünler (Plus çerçevesi) Market'te gösterilmez; "Plus Özellikleri" panelinde yer alır.
    const items = [classic, ...r.body.items.filter((i) => !PLUS_ONLY_ITEM_KEYS.has(i.key))];
    const owned = items.filter((i) => i.owned);
    const locked = items.filter((i) => !i.owned);
    document.getElementById('market-grid-owned').innerHTML = owned.map((i) => mkCardHtml(i, { showPrice: false })).join('') || '<p class="mk-state" style="padding:12px 0;">Henüz hiçbir şeye sahip değilsin.</p>';
    document.getElementById('market-grid-locked').innerHTML = locked.map((i) => mkCardHtml(i, { showPrice: true })).join('');
    document.getElementById('market-locked-title').style.display = locked.length ? '' : 'none';
    main.style.display = '';
}

// =====================================================
// PLUS ÖZELLİKLERİ (Plus'a ait tüm kişiselleştirmeler tek panelde; Market'te satılmaz)
// =====================================================

const PLUS_ONLY_ITEM_KEYS = new Set(['plus']);

async function loadPlusFeaturesModal() {
    const status = document.getElementById('plusfx-status');
    const grid = document.getElementById('plusfx-frame-grid');
    status.textContent = '';
    let plus = { active: false }, premium = { active: false };
    try {
        const s = await fetch('/api/me/subscription', { credentials: 'include' });
        const d = await s.json();
        if (d.success) { plus = d.plus; premium = d.premium; }
    } catch (_) {}
    const active = plus.active || premium.active;
    status.innerHTML = active
        ? '<span class="subs-status subs-status-on" style="display:inline-block;">✓ Plus aktif</span>'
        : 'Bu özellikleri kullanmak için Sauran Plus gerekir. Ayrıntılar Abonelikler bölümünde.';
    const r = await mkFetchFrames();
    const frames = r.status === 200 ? r.body.items.filter((i) => PLUS_ONLY_ITEM_KEYS.has(i.key)) : [];
    if (!frames.length) {
        // Sunucu Plus çerçevesini yalnızca sahibine döndürür; sahip değilsen önizleme olarak göster.
        frames.push({ key: 'plus', label: 'Sauran Plus', rarity: 'special', owned: false, equipped: false });
    }
    grid.innerHTML = frames.map((i) => mkCardHtml(i, { showPrice: false }).replace(
        /<button class="mk-btn" disabled>[^<]*<\/button>/,
        '<button class="mk-btn" disabled>✦ Plus ile açılır</button>'
    )).join('');
    renderChatThemePicker();
    renderBubbleStylePicker();
    renderProfileThemePicker();
    renderNameEffectPicker();
    renderProfileEffectPicker();
}

document.getElementById('plusfx-open-btn')?.addEventListener('click', () => {
    closeTopbarDropdown();
    document.getElementById('plusfx-modal').style.display = 'flex';
    loadPlusFeaturesModal();
});
document.getElementById('plusfx-close-btn')?.addEventListener('click', () => { document.getElementById('plusfx-modal').style.display = 'none'; });
document.getElementById('plusfx-modal')?.addEventListener('click', (e) => { if (e.target.id === 'plusfx-modal') e.currentTarget.style.display = 'none'; });

async function loadInventoryModal() {
    const state = document.getElementById('inventory-state');
    const main = document.getElementById('inventory-main');
    state.style.display = 'none'; main.style.display = 'none';
    const r = await mkFetchFrames();
    if (r.status !== 200) { state.style.display = 'block'; state.textContent = r.status === 401 ? 'Giriş yapmalısın.' : 'Kitaplık yüklenemedi.'; return; }
    const classic = { key: 'classic', label: 'Klasik', rarity: 'free', price: 0, owned: true, equipped: r.body.equipped === 'classic' };
    const owned = [classic, ...r.body.items.filter((i) => i.owned)];
    document.getElementById('inventory-grid').innerHTML = owned.map((i) => mkCardHtml(i, { showPrice: false })).join('') || '<p class="mk-state" style="padding:12px 0;">Henüz hiçbir şeye sahip değilsin. Market\'ten göz atabilirsin.</p>';
    main.style.display = '';
}

function closeTopbarDropdown() {
    const dropdown = document.getElementById('topbar-menu-dropdown');
    if (dropdown) dropdown.style.display = 'none';
}

document.getElementById('market-open-btn')?.addEventListener('click', () => {
    closeTopbarDropdown();
    document.getElementById('market-modal').style.display = 'flex';
    loadMarketModal();
});
document.getElementById('inventory-open-btn')?.addEventListener('click', () => {
    closeTopbarDropdown();
    document.getElementById('inventory-modal').style.display = 'flex';
    loadInventoryModal();
});
const SUBS_PLUS_ITEMS = `<li><span class="subs-ic">✦</span><span>Mor <b>PLUS</b> rozeti ve parıltılı isim kartı</span></li><li><span class="subs-ic">🪙</span><span>Her ay <b>100 Sauran Coin</b></span></li><li><span class="subs-ic">📎</span><span><b>50 MB</b> dosya/video yükleme <small>(ücretsiz: 25 MB)</small></span></li><li><span class="subs-ic">📝</span><span>Hakkımda alanı <b>600 karakter</b> <small>(ücretsiz: 300)</small></span></li><li><span class="subs-ic">🎨</span><span>Sohbet teması, <b>profil teması</b> ve <b>profil efekti</b></span></li><li><span class="subs-ic">🔤</span><span><b>İsim efektleri</b> (gradyan, parıltı, gökkuşağı, ışıltı)</span></li><li><span class="subs-ic">🖼️</span><span><b>Animasyonlu (GIF)</b> kapak fotoğrafı</span></li><li><span class="subs-ic">💬</span><span><b>Mesaj balonu stilleri</b> (yuvarlak, cam, çerçeve, gölge)</span></li><li><span class="subs-ic">🎙️</span><span>Sesli odada özel konuşma göstergesi</span></li><li><span class="subs-ic">🖥️</span><span>Yüksek kalite ekran paylaşımı</span></li><li><span class="subs-ic">🏠</span><span>Lobi için <b>tema</b> ve <b>özel arka plan görseli</b></span></li><li><span class="subs-ic">🧸</span><span><b>26 hareketli çıkartma</b></span></li><li><span class="subs-ic">😍</span><span><b>12 ek tepki emojisi</b></span></li><li><span class="subs-ic">👑</span><span>Lobi sahibi olarak Keşfet'te Plus rozeti</span></li>`;

function subsStatusHtml(state, otherActive) {
    if (state.active) {
        const until = state.expires_at ? `${new Date(state.expires_at.replace(' ', 'T') + 'Z').toLocaleDateString('tr-TR')} tarihine kadar` : 'Süresiz';
        return `<div class="subs-status subs-status-on">✓ Aktif — ${until}</div>`;
    }
    if (otherActive) return '<div class="subs-status subs-status-on">✓ Premium ile dahil</div>';
    return '<button type="button" class="subs-buy-btn" disabled>Satın alma yakında</button>';
}

async function loadSubscriptions() {
    const box = document.getElementById('subs-cards');
    box.innerHTML = '<div class="mk-state">Yükleniyor...</div>';
    let plus = { active: false }, premium = { active: false };
    try {
        const r = await fetch('/api/me/subscription', { credentials: 'include' });
        const d = await r.json();
        if (d.success) { plus = d.plus; premium = d.premium; }
    } catch (_) {}
    box.innerHTML = `
        <div class="subs-card subs-card-plus${plus.active ? ' subs-card-active' : ''}">
            <div class="subs-card-head"><span class="plus-badge" style="margin-left:0;">✦ PLUS</span><span class="subs-card-name">Sauran Plus</span></div>
            <p class="subs-card-tag">Kendini ifade et, daha rahat paylaş.</p>
            <ul class="subs-list">${SUBS_PLUS_ITEMS}</ul>
            ${subsStatusHtml(plus, premium.active)}
        </div>
        <div class="subs-card subs-card-premium${premium.active ? ' subs-card-active' : ''}">
            <div class="subs-card-ribbon">EN KAPSAMLI</div>
            <div class="subs-card-head"><span class="subs-premium-badge">♛ PREMIUM</span><span class="subs-card-name">Sauran Premium</span></div>
            <p class="subs-card-tag">Plus'taki her şey <b>+</b> daha fazlası.</p>
            <ul class="subs-list">
                <li class="subs-plus-all"><span class="subs-ic">✓</span><span><b>Sauran Plus'taki her şey:</b></span></li>
                ${SUBS_PLUS_ITEMS
                    .replace(/Her ay <b>100 Sauran Coin<\/b>/, 'Her ay <b>250 Sauran Coin</b> <small>(Plus: 100)</small>')
                    .replace(/<b>50 MB<\/b> dosya\/video yükleme <small>\(ücretsiz: 25 MB\)<\/small>/, '<b>100 MB</b> dosya/video yükleme <small>(Plus: 50 MB)</small>')}
                <li class="subs-extra-head"><span class="subs-ic">＋</span><span><b>Ek olarak Premium'da:</b></span></li>
                <li><span class="subs-ic">🎞️</span><span><b>Animasyonlu (GIF)</b> profil fotoğrafı</span></li>
                <li class="subs-soon"><span class="subs-ic">🚀</span><span>Yeni Premium'a özel ayrıcalıklar <small>(yakında)</small></span></li>
            </ul>
            ${subsStatusHtml(premium, false)}
        </div>`;
}

document.getElementById('subs-open-btn')?.addEventListener('click', () => {
    closeTopbarDropdown();
    document.getElementById('subs-modal').style.display = 'flex';
    loadSubscriptions();
});
document.getElementById('subs-close-btn')?.addEventListener('click', () => { document.getElementById('subs-modal').style.display = 'none'; });
document.getElementById('subs-modal')?.addEventListener('click', (e) => { if (e.target.id === 'subs-modal') e.currentTarget.style.display = 'none'; });

document.getElementById('market-close-btn')?.addEventListener('click', () => { document.getElementById('market-modal').style.display = 'none'; });
document.getElementById('inventory-close-btn')?.addEventListener('click', () => { document.getElementById('inventory-modal').style.display = 'none'; });
document.getElementById('market-modal')?.addEventListener('click', (e) => { if (e.target.id === 'market-modal') e.currentTarget.style.display = 'none'; });
document.getElementById('inventory-modal')?.addEventListener('click', (e) => { if (e.target.id === 'inventory-modal') e.currentTarget.style.display = 'none'; });

document.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-mk-equip]');
    if (!btn) return;
    const grid = btn.closest('#market-grid-owned, #market-grid-locked, #inventory-grid, #plusfx-frame-grid');
    if (!grid) return;
    btn.disabled = true; btn.textContent = 'Kuşanılıyor...';
    const response = await fetch('/api/me/cosmetics/equip', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ item_key: btn.dataset.mkEquip }) });
    const data = await response.json().catch(() => null);
    // Kuşanma isteği başarılıysa uygulamayı kapatıp açmaya gerek kalmadan anında yansısın:
    // kendi çerçevemizi her yerde (üst çubuk, ray, profil, mesajlarımız) currentUser üzerinden çiziyoruz.
    if (data?.success && currentUser) {
        currentUser.avatar_frame = data.avatar_frame;
        renderProfile();
    }
    if (document.getElementById('market-modal').style.display === 'flex') loadMarketModal();
    if (document.getElementById('inventory-modal').style.display === 'flex') loadInventoryModal();
    if (document.getElementById('plusfx-modal').style.display === 'flex') loadPlusFeaturesModal();
});


// =====================================================
// ÖNERİ & GÖRÜŞ
// =====================================================

feedbackOpenBtn.addEventListener(
    'click',
    async () => {
        feedbackFormError.textContent = '';
        feedbackModal.style.display = 'flex';
        await loadFeedback();
    }
);


feedbackCloseBtn.addEventListener(
    'click',
    () => feedbackModal.style.display = 'none'
);


feedbackModal.addEventListener(
    'click',
    (event) => {
        if (event.target === feedbackModal) feedbackModal.style.display = 'none';
    }
);


feedbackSortTopBtn.addEventListener('click', () => {
    if (feedbackCurrentSort === 'top') return;
    feedbackCurrentSort = 'top';
    feedbackSortTopBtn.classList.add('feedback-sort-active');
    feedbackSortNewBtn.classList.remove('feedback-sort-active');
    loadFeedback();
});


feedbackSortNewBtn.addEventListener('click', () => {
    if (feedbackCurrentSort === 'new') return;
    feedbackCurrentSort = 'new';
    feedbackSortNewBtn.classList.add('feedback-sort-active');
    feedbackSortTopBtn.classList.remove('feedback-sort-active');
    loadFeedback();
});


feedbackSubmitBtn.addEventListener('click', async () => {

    const title = feedbackTitleInput.value.trim();
    const body = feedbackBodyInput.value.trim();

    if (!title || !body) {
        feedbackFormError.textContent = 'Başlık ve açıklama boş olamaz.';
        return;
    }

    feedbackFormError.textContent = '';
    feedbackSubmitBtn.disabled = true;

    try {

        const response = await fetch('/api/feedback', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ title, body })
        });

        const data = await response.json();

        if (!data.success) {
            feedbackFormError.textContent = data.error || 'Öneri gönderilemedi.';
            return;
        }

        feedbackTitleInput.value = '';
        feedbackBodyInput.value = '';
        await loadFeedback();

    } catch (error) {

        console.error('Öneri gönderilemedi:', error);
        feedbackFormError.textContent = 'Öneri gönderilemedi.';

    } finally {

        feedbackSubmitBtn.disabled = false;

    }

});


async function loadFeedback() {

    try {

        const response = await fetch(`/api/feedback?sort=${feedbackCurrentSort}`, { credentials: 'include' });
        const data = await response.json();

        if (!data.success) return;

        renderFeedback(data.feedback);

    } catch (error) {

        console.error('Öneriler alınamadı:', error);

    }

}


function renderFeedback(items) {

    if (items.length === 0) {
        feedbackList.innerHTML = '<div class="feedback-empty">Henüz öneri yok. İlk öneriyi sen paylaş!</div>';
        return;
    }

    feedbackList.innerHTML = items.map((item) => `
        <div class="feedback-card" data-feedback-id="${item.id}">
            <button class="feedback-vote-btn${item.has_voted ? ' feedback-voted' : ''}" type="button" data-vote>
                <span class="feedback-vote-arrow">▲</span>
                <span class="feedback-vote-count">${item.vote_count}</span>
            </button>
            <div class="feedback-content">
                <div class="feedback-title">${escapeHtml(item.title)}</div>
                <div class="feedback-body">${escapeHtml(item.body)}</div>
                <div class="feedback-meta">@${escapeHtml(item.username)} · ${new Date(item.created_at).toLocaleDateString('tr-TR')}</div>
            </div>
        </div>
    `).join('');

    feedbackList.querySelectorAll('[data-feedback-id]').forEach((card) => {

        const feedbackId = card.dataset.feedbackId;

        card.querySelector('[data-vote]').addEventListener('click', async () => {

            try {

                const response = await fetch(`/api/feedback/${feedbackId}/vote`, {
                    method: 'POST',
                    credentials: 'include'
                });

                const data = await response.json();
                if (!data.success) return;

                const voteBtn = card.querySelector('[data-vote]');
                voteBtn.classList.toggle('feedback-voted', data.voted);
                voteBtn.querySelector('.feedback-vote-count').textContent = data.vote_count;

            } catch (error) {

                console.error('Oy verilemedi:', error);

            }

        });

    });

}


// =====================================================
// BAŞKASININ PROFİLİ
// =====================================================

let otherProfileCache = null;
let otherProfileHideMessageAction = false;

async function openOtherProfile(userId, options = {}) {

    try {

        const response = await fetch(`/api/users/${userId}/profile`, { credentials: 'include' });
        const data = await response.json();

        if (!data.success) return;

        otherProfileCache = data.profile;
        otherProfileHideMessageAction = !!options.hideMessageAction;
        renderOtherProfile();

        otherProfileModal.style.display = 'flex';

    } catch (error) {

        console.error('Profil açılamadı:', error);

    }

}


function renderOtherProfile() {

    const profile = otherProfileCache;
    const color = resolveUserColor(profile.id, profile.username, profile.profile_color);
    const initial = profile.username.charAt(0).toUpperCase();
    const hasAvatar = Boolean(profile.avatar_data);

    const otherBannerEl = document.getElementById('other-profile-banner');
    if (profile.banner_data) {
        otherBannerEl.style.setProperty('--banner-img', cssImageUrl(profile.banner_data));
        otherBannerEl.classList.add('has-image');
    } else {
        otherBannerEl.classList.remove('has-image');
    }

    otherProfileAvatar.textContent = initial;
    otherProfileAvatar.style.setProperty('--user-color', color);
    otherProfileAvatar.style.display = hasAvatar ? 'none' : 'flex';

    applyAvatarFrame(document.getElementById('other-profile-avatar-wrap'), profile.avatar_frame);
    applyProfileEffect(document.getElementById('other-profile-avatar-wrap'), profile.profile_effect);
    applyProfileTheme(document.querySelector('#other-profile-modal .profile-modal-box'), profile.profile_theme);
    otherProfileAvatarImg.src = hasAvatar ? profile.avatar_data : '';
    otherProfileAvatarImg.style.display = hasAvatar ? 'block' : 'none';

    const otherActivityEl = document.getElementById('other-profile-activity');
    if (otherActivityEl) {
        otherActivityEl.style.display = profile.activity ? '' : 'none';
        otherActivityEl.textContent = profile.activity ? `🎮 ${profile.activity}` : '';
    }
    otherProfileUsername.innerHTML = `${usernameCardHtml(profile.username, profile.plus_active, profile.name_effect)}${plusBadgeHtml(profile.plus_active)}`;

    // ÖNEMLİ: presence (gerçek bağlantı durumu) ile kullanıcının seçtiği
    // manuel durum birbirinden ayrı. Kullanıcı "Müsait" seçmiş olsa bile
    // uygulamada değilse (profile.online === false) burada "Çevrimdışı"
    // gösterilir — sunucudan gelen gerçek presence bilgisine güveniyoruz.
    otherProfileStatusDot.classList.remove(...STATUS_CLASS_NAMES, 'status-offline');

    if (profile.online) {
        const info = STATUS_INFO[profile.status] || STATUS_INFO.active;
        otherProfileStatusDot.classList.add(info.className);
        otherProfileStatusDot.textContent = '';
        otherProfileStatusLabel.textContent = `${t('presence-online')} · ${info.label}`;
    } else {
        otherProfileStatusDot.classList.add('status-offline');
        otherProfileStatusDot.textContent = '';
        otherProfileStatusLabel.textContent = t('presence-offline');
    }

    const otherAboutMeEl = document.getElementById('other-profile-about-me');
    if (otherAboutMeEl) {
        otherAboutMeEl.textContent = profile.about_me?.trim() ? profile.about_me : t('about-me-empty');
        otherAboutMeEl.classList.toggle('is-empty', !profile.about_me?.trim());
    }

    renderOtherProfileActions(profile);

}


function renderOtherProfileActions(profile) {

    let html = '';

    if (profile.friendship_status === 'self') {

        html = '';

    } else if (profile.blocked_by_me) {

        html = `<button class="profile-action-btn profile-action-disabled" id="unblock-btn">Engeli Kaldır</button>`;

    } else if (profile.friendship_status === 'friends') {

        html = `
            ${otherProfileHideMessageAction ? '' : '<button class="profile-action-btn profile-action-primary" id="dm-open-btn">💬 Mesaj Gönder</button>'}
            <button class="profile-action-btn profile-action-danger" id="unfriend-btn">Arkadaşlıktan Çıkar</button>
            <button class="profile-action-btn profile-action-disabled" id="block-btn">🚫 Engelle</button>
        `;

    } else if (profile.friendship_status === 'pending_sent') {

        html = `
            <button class="profile-action-btn profile-action-disabled" disabled>İstek Gönderildi</button>
            <button class="profile-action-btn profile-action-disabled" id="block-btn">🚫 Engelle</button>
        `;

    } else if (profile.friendship_status === 'pending_received') {

        html = `
            <div class="profile-action-row">
                <button class="profile-action-btn profile-action-primary" id="accept-req-btn">Kabul Et</button>
                <button class="profile-action-btn profile-action-danger" id="decline-req-btn">Reddet</button>
            </div>
            <button class="profile-action-btn profile-action-disabled" id="block-btn">🚫 Engelle</button>
        `;

    } else {

        html = `
            <button class="profile-action-btn profile-action-primary" id="add-friend-btn">👤＋ Arkadaş Ekle</button>
            <button class="profile-action-btn profile-action-disabled" id="block-btn">🚫 Engelle</button>
        `;

    }

    if (profile.friendship_status !== 'self') {
        html += `<button class="profile-action-btn profile-action-disabled" id="report-user-btn">🚩 <span data-i18n="report-user">Bildir</span></button>`;
    }

    otherProfileActions.innerHTML = html;

    document.getElementById('report-user-btn')?.addEventListener('click', () => {
        openReportModal('user', profile.id, profile.username);
    });

    document.getElementById('dm-open-btn')?.addEventListener('click', () => {
        otherProfileModal.style.display = 'none';
        openDm(profile.id, profile.username);
    });

    document.getElementById('unfriend-btn')?.addEventListener('click', async () => {

        if (!confirm(`${profile.username} ile arkadaşlığı sonlandırmak istediğine emin misin?`)) return;

        await fetch(`/api/friends/${profile.id}`, { method: 'DELETE', credentials: 'include' });
        otherProfileModal.style.display = 'none';

    });

    document.getElementById('accept-req-btn')?.addEventListener('click', async () => {

        await fetch('/api/friends/respond', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ user_id: profile.id, accept: true })
        });

        openOtherProfile(profile.id);

    });

    document.getElementById('decline-req-btn')?.addEventListener('click', async () => {

        await fetch('/api/friends/respond', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ user_id: profile.id, accept: false })
        });

        otherProfileModal.style.display = 'none';

    });

    document.getElementById('add-friend-btn')?.addEventListener('click', async () => {

        const response = await fetch('/api/friends/request', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ to_user_id: profile.id })
        });

        const data = await response.json();
        if (data.success) openOtherProfile(profile.id);

    });

    document.getElementById('block-btn')?.addEventListener('click', async () => {

        if (!confirm(`${profile.username} kullanıcısını engellemek istediğine emin misin?`)) return;

        const response = await fetch(`/api/users/${profile.id}/block`, { method: 'POST', credentials: 'include' });
        const data = await response.json();
        if (data.success) openOtherProfile(profile.id);

    });

    document.getElementById('unblock-btn')?.addEventListener('click', async () => {

        const response = await fetch(`/api/users/${profile.id}/block`, { method: 'DELETE', credentials: 'include' });
        const data = await response.json();
        if (data.success) openOtherProfile(profile.id);

    });

}


closeOtherProfileBtn.addEventListener(
    'click',
    () => otherProfileModal.style.display = 'none'
);


otherProfileModal.addEventListener(
    'click',
    (event) => {
        if (event.target === otherProfileModal) otherProfileModal.style.display = 'none';
    }
);


// =====================================================
// DM PANELİ
// =====================================================

function setDmReadOnlyMode(on, expiresAt) {

    dmReadOnly = on;
    dmForm.style.display = on ? 'none' : '';
    dmCallBtn.style.display = on ? 'none' : '';
    document.getElementById('dm-search-btn').style.display = on ? 'none' : '';
    document.getElementById('dm-reply-preview').style.display = 'none';

    let note = document.getElementById('dm-readonly-note');
    if (on && !note) {
        note = document.createElement('div');
        note.id = 'dm-readonly-note';
        note.className = 'dm-readonly-note';
        dmForm.parentNode.insertBefore(note, dmForm);
    }
    if (note) {
        const when = expiresAt ? new Date(expiresAt).toLocaleDateString(localStorage.getItem('sauran_lang') === 'en' ? 'en-GB' : 'tr-TR') : '';
        note.textContent = t('deleted-dm-readonly') + (when ? ' ' + t('deleted-dm-expires').replace('{date}', when) : '');
        note.style.display = on ? '' : 'none';
    }

}


// Hesabı silinmiş kişiyle olan korunmuş sohbeti (yalnızca karşı tarafın kendi mesajları + "silinmiş hesabın mesajı") salt okunur açar.
async function openDeletedDm(token) {

    activeDmUserId = null;
    activeDmUsername = '';

    let thread = deletedDmThreads.find((x) => x.token === token);
    if (!thread) {
        try {
            const listRes = await fetch('/api/dm/deleted', { credentials: 'include' });
            const listData = await listRes.json();
            deletedDmThreads = listData.success ? listData.threads : [];
            thread = deletedDmThreads.find((x) => x.token === token);
        } catch (_) { /* yoksay */ }
    }

    setDmReadOnlyMode(true, thread && thread.expires_at);
    dmModalTitle.textContent = `💬 ${t('deleted-account-label')}`;
    dmFeed.innerHTML = '';
    feedPaging.dm = { key: null, oldestId: null, hasMore: false, loading: false };

    try {

        const response = await fetch(`/api/dm/deleted/${encodeURIComponent(token)}/messages`, { credentials: 'include' });
        const data = await response.json();

        if (data.success) {
            data.messages.forEach(appendDmMessage);
        } else {
            loadFriendsSidebar();
        }

    } catch (error) {

        console.error('Silinmiş hesap sohbeti alınamadı:', error);

    }

    dmModal.style.display = 'flex';

}


function renderDmTitle(userId, username) {
    dmModalTitle.innerHTML = `${avatarButtonHtml(userId, null, username)}<span class="dm-title-name">${usernameCardHtml(username, isVoicePlus(userId), nameFxOf(userId))}</span>`;
    wireMsgAvatars(dmModalTitle);
}

async function openDm(userId, username) {

    // Bildirim bağlantısında ad taşınmaz: yoksa oturumlu API'den alınır.
    if (!username) {
        try {
            const r = await fetch(`/api/users/${userId}/profile`, { credentials: 'include' });
            const j = await r.json();
            username = (j && j.profile && j.profile.username) || '';
        } catch (_) { /* ad boş kalır */ }
    }

    setDmReadOnlyMode(false);
    clearTyping('dm');
    if (msgSearchPanel?.dataset.kind === 'dm') closeMessageSearch();
    activeDmUserId = userId;
    activeDmUsername = username;
    renderDmTitle(userId, username);
    dmFeed.innerHTML = '';

    // Profil görseli henüz bilinmiyorsa (ör. bildirimden açıldı) profilden al: görsel varsa görünür, yoksa kullanıcı adının baş harfi kalır.
    if (!knownAvatars.get(userId)) {
        fetch(`/api/users/${userId}/profile`, { credentials: 'include' })
            .then((r) => r.json())
            .then((data) => {
                const avatar = data && data.success && data.profile && data.profile.avatar_data;
                if (avatar) {
                    knownAvatars.set(userId, avatar);
                    if (activeDmUserId === userId) renderDmTitle(userId, username);
                }
            })
            .catch(() => { /* görsel alınamazsa baş harf kalır */ });
    }

    unreadDmCounts.delete(userId);
    updateFriendsToggleBadge();
    nativeNotifyCancel(`dm-${userId}`);
    refreshFriendsSidebar();

    try {

        feedPaging.dm = { key: null, oldestId: null, hasMore: false, loading: false };
        const response = await fetch(`/api/dm/${userId}/messages`, { credentials: 'include' });
        const data = await response.json();

        if (data.success && activeDmUserId === userId) {
            data.messages.forEach((m) => appendDmMessage(m));
            resetFeedPaging('dm', userId, data.messages, data.has_more);
            if (data.messages.length) markReadSoon('dm', userId, data.messages[data.messages.length - 1].id);
        }

    } catch (error) {

        console.error('DM mesajları alınamadı:', error);

    }

    dmModal.style.display = 'flex';
    dmMessageInput.focus();

}


function formatCallLogDuration(totalSeconds) {
    const seconds = Math.max(0, Math.round(Number(totalSeconds) || 0));
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    const parts = [];
    if (h) parts.push(`${h} ${t('call-log-min') === 'dk' ? 'sa' : 'h'}`);
    if (h || m) parts.push(`${m} ${t('call-log-min')}`);
    parts.push(`${s} ${t('call-log-sec')}`);
    return parts.join(' ');
}

// Arama kaydı: konuşma balonu değil, ortalanmış sistem satırı (eylem menüsü/tepki yok).
function appendDmCallLog(msg, opts) {

    const status = msg.payload && msg.payload.status;
    const iAmCaller = msg.user_id === currentUser.id;
    let label;
    let icon = '📞';

    if (status === 'answered') {
        label = `${t('call-log-answered')} · ${formatCallLogDuration(msg.payload.duration)}`;
    } else if (status === 'declined') {
        label = t(iAmCaller ? 'call-log-declined-out' : 'call-log-declined-in');
        icon = '📵';
    } else {
        label = t(iAmCaller ? 'call-log-missed-out' : 'call-log-missed-in');
        icon = '📵';
    }

    const time = msg.created_at
        ? serverDate(msg.created_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
        : '';

    const row = document.createElement('div');
    row.className = `dm-call-log${status === 'answered' ? '' : ' is-missed'}`;
    row.dataset.messageId = msg.id;
    row.dataset.userId = msg.user_id;
    row.innerHTML = `<span class="dm-call-log-pill"><span aria-hidden="true">${icon}</span><span class="dm-call-log-text">${escapeHtml(label)}</span><span class="dm-call-log-time">${escapeHtml(time)}</span></span>`;

    placeFeedItem(dmFeed, row, opts);
}

function appendDmMessage(msg, opts) {

    if (msg.kind === 'dm_call') { appendDmCallLog(msg, opts); return; }

    const row = document.createElement('div');

    const isMine = msg.user_id === currentUser.id;
    row.className = `dm-msg-row ${isMine ? 'msg-mine' : ''}`;

    row.innerHTML = avatarButtonHtml(msg.sender_deleted ? null : msg.user_id, msg.avatar_data, msg.sender_deleted ? t('deleted-account-label') : msg.username, msg.sender_deleted ? null : msg.avatar_frame, msg.sender_deleted ? null : msg.profile_color);

    const wrap = document.createElement('div');
    wrap.className = `dm-msg ${isMine ? 'dm-msg-mine' : 'dm-msg-theirs'}`;
    wrap.dataset.messageId = msg.id;
    wrap.dataset.userId = msg.user_id;

    renderDmMessageIntoWrap(wrap, msg, isMine);

    row.appendChild(wrap);
    wireMsgAvatars(row);
    if (opts && opts.clientId) trackPendingSend(opts.clientId, row, 'dm');

    placeFeedItem(dmFeed, row, opts);

}

// Akışa öğe ekler: normalde en alta (ve en alta kaydırır); eski sayfa yüklenirken en üste (kaydırmaya dokunmadan).
// opts bir forEach indeksi de olabilir; yalnızca { prepend: true } nesnesi "üste ekle" demektir.
function placeFeedItem(feed, el, opts) {
    if (opts && opts.prepend === true) {
        const anchor = feed.querySelector(':scope > .feed-older-status')?.nextSibling || feed.firstChild;
        feed.insertBefore(el, anchor);
        return;
    }
    feed.appendChild(el);
    // Kullanıcı yukarıda eski mesajları okuyorsa yeni mesaj onu aşağı çekmez; kendi gönderdiği ya da en alttaysa kaydırılır.
    if (opts && opts.noScroll === true) return;
    if ((opts && opts.forceScroll === true) || feed._stickBottom !== false) feed.scrollTop = feed.scrollHeight;
}

// ─── Akış en altta kalsın: klavye açılıp kapanınca / pencere boyutu değişince zıplama olmasın ───
function keepFeedPinned(feed) {
    feed._stickBottom = true;
    feed.addEventListener('scroll', () => {
        feed._stickBottom = feed.scrollHeight - feed.scrollTop - feed.clientHeight < 80;
    }, { passive: true });
    const repin = () => { if (feed._stickBottom) feed.scrollTop = feed.scrollHeight; };
    if (typeof ResizeObserver === 'function') new ResizeObserver(repin).observe(feed);
    window.visualViewport?.addEventListener('resize', repin);
}

// ─── Gönderilen mesaj sunucudan dönmeden "gönderiliyor" olarak hemen görünür; dönünce gerçek mesajla yer değiştirir ───
const pendingSends = new Map(); // client_id -> { el, kind, timer }

function newClientId() {
    return `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function optimisticMessage(content, kind, extra) {
    return {
        id: null,
        user_id: currentUser.id,
        username: currentUser.username,
        avatar_data: currentUser.avatar_data || null,
        avatar_frame: currentUser.avatar_frame || null,
        profile_color: currentUser.profile_color || null,
        chat_theme: currentUser.chat_theme,
        bubble_style: currentUser.bubble_style,
        name_effect: currentUser.name_effect,
        plus_active: currentUser.plus_active,
        content,
        kind,
        created_at: new Date().toISOString(),
        reactions: [],
        ...extra
    };
}

function trackPendingSend(clientId, el, kind) {
    el.classList.add('msg-pending');
    el.dataset.clientId = clientId;
    const timer = setTimeout(() => markPendingFailed(clientId), 15000);
    pendingSends.set(clientId, { el, kind, timer });
}

function markPendingFailed(clientId) {
    const entry = clientId ? pendingSends.get(clientId) : [...pendingSends.values()][0];
    if (!entry) return;
    clearTimeout(entry.timer);
    entry.el.classList.remove('msg-pending');
    entry.el.classList.add('msg-failed');
    entry.el.title = t('msg-send-failed');
    pendingSends.delete(entry.el.dataset.clientId);
}

// Sunucudan dönen mesaj bekleyen geçici mesajla eşleşirse onun yerine geçer (true döner) ve yeni satır eklenmez.
function resolvePendingSend(msg) {
    const entry = msg?.client_id && pendingSends.get(msg.client_id);
    if (!entry) return false;
    clearTimeout(entry.timer);
    pendingSends.delete(msg.client_id);
    entry.el.classList.remove('msg-pending');
    if (entry.kind === 'hub') {
        entry.el.dataset.messageId = msg.id;
        renderHubMessageIntoWrap(entry.el, msg);
    } else {
        const wrap = entry.el.querySelector('.dm-msg');
        if (wrap) {
            wrap.dataset.messageId = msg.id;
            renderDmMessageIntoWrap(wrap, msg, true);
        }
    }
    return true;
}

// Gönder düğmesine dokunmak giriş alanının odağını almasın: iPhone'da klavye kapanıp ekran zıplamasın.
function keepComposerFocus(button, input) {
    if (!button) return;
    const hold = (event) => { if (document.activeElement === input) event.preventDefault(); };
    button.addEventListener('pointerdown', hold);
    button.addEventListener('mousedown', hold);
}

// ─── Sohbet geçmişi sayfalama (yukarı kaydırınca daha eski mesajlar) ───
const feedPaging = {
    hub: { key: null, oldestId: null, hasMore: false, loading: false, newestId: null, hasNewer: false },
    dm: { key: null, oldestId: null, hasMore: false, loading: false, newestId: null, hasNewer: false }
};

// hasNewer: aramadan eski bir mesaja gidildiğinde akış "geçmişte" durur; en yeni mesajlar ileri kaydırınca yüklenir.
function resetFeedPaging(kind, key, messages, hasMore, hasNewer = false) {
    feedPaging[kind] = {
        key, oldestId: messages.length ? messages[0].id : null, hasMore: Boolean(hasMore), loading: false,
        newestId: messages.length ? messages[messages.length - 1].id : null, hasNewer: Boolean(hasNewer)
    };
    renderJumpToLatest(kind);
    const feed = kind === 'hub' ? hubFeed : dmFeed;
    feed.querySelector(':scope > .feed-older-status')?.remove();
    // İçerik kaydırma çubuğu oluşturmayacak kadar azsa (ilk sayfa ekranı doldurmadıysa) bir sonraki sayfayı hemen iste.
    requestAnimationFrame(() => { if (feed.scrollHeight <= feed.clientHeight + 4) loadOlderMessages(kind); });
}

function setFeedOlderStatus(feed, text) {
    let el = feed.querySelector(':scope > .feed-older-status');
    if (!text) { el?.remove(); return; }
    if (!el) {
        el = document.createElement('div');
        el.className = 'feed-older-status';
        feed.insertBefore(el, feed.firstChild);
    }
    el.textContent = text;
}

async function loadOlderMessages(kind) {
    const paging = feedPaging[kind];
    if (!paging.hasMore || paging.loading || !paging.oldestId || !paging.key) return;
    if (paging.quietUntil && Date.now() < paging.quietUntil) return;

    const feed = kind === 'hub' ? hubFeed : dmFeed;
    const key = paging.key;
    const url = kind === 'hub'
        ? `/api/hubs/${key}/messages?before=${paging.oldestId}`
        : `/api/dm/${key}/messages?before=${paging.oldestId}`;

    paging.loading = true;
    setFeedOlderStatus(feed, t('feed-older-loading'));

    try {
        const response = await fetch(url, { credentials: 'include' });
        const data = await response.json();

        // Bu arada başka sohbete geçildiyse sonuç atılır.
        if (feedPaging[kind] !== paging || paging.key !== key) return;
        if (!data.success) { setFeedOlderStatus(feed, null); return; }

        const prevHeight = feed.scrollHeight;
        const prevTop = feed.scrollTop;
        const append = kind === 'hub' ? appendHubMessage : appendDmMessage;

        // Gelen sayfa eskiden yeniye sıralı; üste eklerken en yeniden başlanır ki sıra korunsun.
        for (let i = data.messages.length - 1; i >= 0; i -= 1) append(data.messages[i], { prepend: true });

        if (data.messages.length) paging.oldestId = data.messages[0].id;
        paging.hasMore = Boolean(data.has_more);
        setFeedOlderStatus(feed, paging.hasMore ? null : t('feed-start'));

        // Kullanıcının baktığı mesaj yerinde kalsın (yeni eklenenler üstte, görünür alan kaymaz).
        feed.scrollTop = feed.scrollHeight - prevHeight + prevTop;
    } catch (error) {
        console.error('Eski mesajlar alınamadı:', error);
        setFeedOlderStatus(feed, null);
    } finally {
        paging.loading = false;
    }
}



// ─── Link önizlemesi kartı ── (görsel sunucudan gelir; tarayıcı üçüncü taraf siteye bağlanmaz)
function linkPreviewHtml(msg) {
    const lp = msg && msg.link_preview;
    if (!lp || !lp.url || !/^https?:\/\//i.test(lp.url)) return '';
    const mine = currentUser && msg.user_id === currentUser.id && msg.id;
    const image = lp.image && /^[0-9a-f]{32}$/.test(lp.image)
        ? `<img class="link-preview-img" src="/api/link-preview/image/${lp.image}" alt="" loading="lazy" onerror="this.remove()">` : '';
    return `
        <div class="link-preview" data-link-preview="${Number(msg.id) || ''}">
            <a class="link-preview-main" href="${escapeAttr(lp.url)}" target="_blank" rel="noopener noreferrer nofollow">
                <span class="link-preview-site">${escapeHtml(lp.site_name || '')}</span>
                ${lp.title ? `<span class="link-preview-title">${escapeHtml(lp.title)}</span>` : ''}
                ${lp.description ? `<span class="link-preview-desc">${escapeHtml(lp.description)}</span>` : ''}
                ${image}
            </a>
            ${mine ? `<button type="button" class="link-preview-remove" data-remove-preview="${Number(msg.id)}" title="${escapeAttr(t('link-preview-remove'))}" aria-label="${escapeAttr(t('link-preview-remove'))}">✕</button>` : ''}
        </div>`;
}

function scrollParentOf(el) {
    for (let node = el?.parentElement; node; node = node.parentElement) {
        const oy = getComputedStyle(node).overflowY;
        if ((oy === 'auto' || oy === 'scroll') && node.scrollHeight > node.clientHeight) return node;
    }
    return null;
}

// Kart mesajdan SONRA gelir: sohbet en alttaysa kart (ve görseli) yüklenince de en altta kalınır.
function placeLinkPreview(wrap, msg) {
    if (!wrap) return;
    const feed = scrollParentOf(wrap);
    const pinned = feed ? feed.scrollHeight - feed.scrollTop - feed.clientHeight < 120 : false;
    wrap.querySelector('.link-preview')?.remove();
    const html = linkPreviewHtml(msg);
    if (html) {
        const hubBubble = wrap.querySelector('.hub-msg-bubble');
        if (hubBubble) hubBubble.insertAdjacentHTML('beforeend', html);
        else wrap.querySelector('.dm-msg-line')?.insertAdjacentHTML('afterend', html);
    }
    if (feed && pinned) {
        const stick = () => { feed.scrollTop = feed.scrollHeight; };
        stick();
        wrap.querySelector('.link-preview-img')?.addEventListener('load', stick, { once: true });
    }
}

document.addEventListener('click', async (event) => {
    const btn = event.target.closest('[data-remove-preview]');
    if (!btn) return;
    event.preventDefault();
    try {
        const data = await (await fetch(`/api/messages/${Number(btn.dataset.removePreview)}/link-preview`, { method: 'DELETE', credentials: 'include' })).json();
        if (!data.success) showToast(data.error || 'Kaldırılamadı.');
    } catch (_) { /* yoksay */ }
});

function renderDmMessageIntoWrap(wrap, msg, isMine) {
    wrap.dataset.authorId = msg.user_id != null ? String(msg.user_id) : (isMine && currentUser ? String(currentUser.id) : '');

    applyChatTheme(wrap, msg.user_id, msg.chat_theme, msg.bubble_style);

    const time = msg.created_at
        ? serverDate(msg.created_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
        : '';

    const editedTag = msg.edited ? ` <span class="edited-tag">(${t('edited-tag')})</span>` : '';
    const forwardedTag = msg.forwarded_from_message_id ? `<div class="msg-forwarded-tag">↗ ${t('message-forwarded')}</div>` : '';
    const opts = { context: 'dm', readOnly: dmReadOnly };
    const actions = buildMsgActionsBarHtml(msg, opts);
    const replyQuote = buildMsgReplyQuoteHtml(msg);
    const reactionsRow = buildMsgReactionsRowHtml(msg);

    let body;

    if (msg.kind === 'deleted') {

        body = `<span class="hub-msg-deleted">${t(msg.sender_deleted ? 'deleted-account-message' : 'message-deleted')}</span>`;

    } else if (msg.kind === 'dm_voice' && msg.payload) {

        body = buildVoiceCardHtml(msg.payload.audio, msg.payload.duration);

    } else if ((msg.kind === 'dm_image' || msg.kind === 'dm_video' || msg.kind === 'dm_file') && msg.payload) {

        body = buildFileCardHtml(msg.payload);

    } else if (msg.kind === 'dm_sticker' && msg.payload) {

        body = `<span class="dm-msg-sticker${stickerIsPlus(msg.payload.id) ? ' stk-msg' : ''}">${stickerInnerHtml(msg.payload.id)}</span>`;

    } else {

        body = `<span class="dm-msg-content">${escapeHtml(msg.content)}</span>`;

    }

    wrap.innerHTML = `${actions}${forwardedTag}${replyQuote}<div class="dm-msg-line">${body}<span class="dm-msg-time">${time}${editedTag}</span></div>${linkPreviewHtml(msg)}${reactionsRow}`;

    wireVoiceCards(wrap);
    enableLongPress(wrap);
    wireMessageActions(wrap, msg, opts);

}


function updateDmMessage(msg) {

    const wrap = dmFeed.querySelector(`[data-message-id="${msg.id}"]`);
    if (!wrap) return;

    renderDmMessageIntoWrap(wrap, msg, msg.user_id === currentUser.id);

}


function removeDmMessage(messageId) {

    const wrap = dmFeed.querySelector(`[data-message-id="${messageId}"]`);
    if (!wrap) return;

    const isMine = wrap.classList.contains('dm-msg-mine');
    renderDmMessageIntoWrap(wrap, { id: messageId, kind: 'deleted' }, isMine);

}


// =====================================================
// MESAJ AVATARI (Lobi + DM ortak)
// =====================================================

// Profil görseli gizlilik ayarına göre sunucu tarafından süzülür. Canlı (yayın) mesajlarda alıcıya özel içerik üretilemediğinden başkasının görseli gelmeyebilir;
// bu durumda REST ile (kendi yetkimize göre) daha önce alınmış görsel önbellekten kullanılır. Kendi görselimiz her zaman currentUser'dan gelir.
const knownAvatars = new Map();
const knownFrames = new Map();

function resolveAvatar(userId, avatarData) {
    if (avatarData) { knownAvatars.set(userId, avatarData); return avatarData; }
    if (currentUser && userId === currentUser.id) return currentUser.avatar_data || null;
    return knownAvatars.get(userId) || null;
}

// Kuşanılan avatar çerçevesi herkese görünür: mesaj/üye/arkadaş listelerinden geçen her yerde
// aynı önbelleğe (knownFrames) yazılır, veri gelmeyen tekrar render'larda oradan okunur.
function resolveFrame(userId, frameKey) {
    if (frameKey !== undefined) { knownFrames.set(userId, frameKey || null); return frameKey || null; }
    if (currentUser && userId === currentUser.id) return currentUser.avatar_frame || null;
    return knownFrames.get(userId) || null;
}

// Sauran Plus sohbet temaları: aynı önbellek deseni (mesaj satırı başına, gönderenin son bilinen teması).
const knownChatThemes = new Map();
function resolveChatTheme(userId, theme) {
    if (theme !== undefined) { knownChatThemes.set(userId, theme || 'classic'); return theme || 'classic'; }
    if (currentUser && userId === currentUser.id) return currentUser.chat_theme || 'classic';
    return knownChatThemes.get(userId) || 'classic';
}
const CHAT_THEME_CLASSES = ['chat-theme-soft', 'chat-theme-contrast'];
// Sauran Plus mesaj balonu stili: sohbet temasıyla aynı önbellek deseni.
const knownBubbleStyles = new Map();
const BUBBLE_CLASSES = ['bubble-round', 'bubble-glass', 'bubble-outline', 'bubble-shadow'];
function resolveBubbleStyle(userId, style) {
    if (style !== undefined) { knownBubbleStyles.set(userId, style || 'default'); return style || 'default'; }
    if (currentUser && userId === currentUser.id) return currentUser.bubble_style || 'default';
    return knownBubbleStyles.get(userId) || 'default';
}
// target: sınıfların uygulanacağı öğe — DM'de balonun kendisi (wrap), Lobi'de ise yalnızca ileti
// içeriğini saran .hub-msg-bubble (kullanıcı adı/avatar kutunun DIŞINDA kalsın diye). Belirtilmezse wrap kullanılır.
function applyChatTheme(wrap, userId, theme, bubble, target) {
    const el = target || wrap;
    const resolved = resolveChatTheme(userId, theme);
    CHAT_THEME_CLASSES.forEach((c) => el.classList.remove(c));
    if (resolved && resolved !== 'classic') el.classList.add('chat-theme-' + resolved);
    const b = resolveBubbleStyle(userId, bubble);
    BUBBLE_CLASSES.forEach((c) => el.classList.remove(c));
    if (b && b !== 'default') el.classList.add('bubble-' + b);
}

// Profil rengi (herkese açık). getUserColor(username) yerine bu kullanılır — aynı önbellek deseni
// (avatar_frame/chat_theme ile aynı yerlerden geçer); veri gelmeyen tekrar render'da son bilinen değeri döner.
const knownUserColors = new Map();
function resolveUserColor(userId, username, customColor) {
    if (customColor !== undefined) { knownUserColors.set(userId, customColor || null); }
    if (currentUser && userId === currentUser.id) return currentUser.profile_color || getUserColor(username);
    const known = knownUserColors.get(userId);
    return known || getUserColor(username);
}

function avatarButtonHtml(userId, avatarData, username, frameKey, profileColor) {

    avatarData = resolveAvatar(userId, avatarData);
    if (profileColor !== undefined) resolveUserColor(userId, username, profileColor);
    frameKey = resolveFrame(userId, frameKey);

    const color = resolveUserColor(userId, username || '');
    const initial = (username || '?').charAt(0).toUpperCase();

    const inner = avatarData
        ? `<img src="${escapeAttr(avatarData)}" alt="">`
        : escapeHtml(initial);

    const btn = `
        <button type="button" class="msg-avatar-btn" data-user-id="${userId}" style="--user-color:${color};color:${avatarData ? '' : color};" title="${escapeAttr(username || '')}">
            ${inner}
        </button>
    `;

    if (!frameKey || frameKey === 'classic') return btn;
    const overlay = frameOverlayHtml(frameKey);
    return `<span class="msg-avatar-frame-wrap frame-${escapeAttr(frameKey)}" data-frame-key="${escapeAttr(frameKey)}">${btn}${overlay}</span>`;

}


function wireMsgAvatars(container) {

    container.querySelectorAll('.msg-avatar-btn').forEach((btn) => {

        if (btn.dataset.wired) return;
        btn.dataset.wired = '1';

        btn.addEventListener('click', () => {
            const userId = Number(btn.dataset.userId);
            if (userId) openOtherProfile(userId);
        });

    });

}


// =====================================================
// BİLDİRİM (TOAST)
// =====================================================

// Mobilde üst çubuk: Keşfet'te Coin rozeti, Lobi'de ⭐ Süper Beğeni + ⚙️ Ayarlar sağ üstte durur (düğümler taşınır, işlevleri aynı).
const topbarHomes = new Map();
function moveNode(el, target, before) {
    if (!el || !target) return;
    if (!topbarHomes.has(el)) topbarHomes.set(el, { parent: el.parentNode, next: el.nextSibling });
    if (before) target.insertBefore(el, before); else target.appendChild(el);
}
function restoreNode(el) {
    const home = topbarHomes.get(el);
    if (home && el.parentNode !== home.parent) home.parent.insertBefore(el, home.next && home.next.parentNode === home.parent ? home.next : null);
}
function placeMobileTopbarItems(view) {
    const right = document.querySelector('.topbar-right');
    const wallet = document.getElementById('discover-wallet');
    const gear = document.getElementById('hub-settings-open-btn');
    const menuBtn = document.getElementById('topbar-menu-btn');
    const mobile = window.innerWidth <= 900;
    if (mobile && view === 'discover') moveNode(wallet, right, menuBtn); else restoreNode(wallet);
    const back = document.getElementById('hub-back-btn');
    const nameEl = document.getElementById('hub-detail-name');
    const left = document.querySelector('.topbar-left');
    const actions = document.getElementById('topbar-lobby-actions');
    const sl = document.getElementById('lobby-superlike-btn');
    const membersBtn = document.getElementById('hub-members-toggle-btn');
    const ctxTitle = document.getElementById('topbar-context-title');
    if (mobile && view === 'hub-detail') {
        moveNode(back, left, left.firstChild); moveNode(nameEl, left, ctxTitle);
        if (actions) { moveNode(sl, actions); moveNode(gear, actions); moveNode(membersBtn, actions); actions.style.display = 'flex'; }
    } else {
        restoreNode(back); restoreNode(nameEl);
        if (actions) { restoreNode(sl); restoreNode(gear); restoreNode(membersBtn); actions.style.display = 'none'; }
    }
    const title = document.getElementById('topbar-context-title');
    if (title) {
        if (mobile && view === 'discover') { title.textContent = '← Keşfet'; }
        else if (view === 'hubs') { title.textContent = t('hubs-title'); }
    }
    updateLobbySuperLikeButton(view);
}

document.addEventListener('click', (e) => {
    if (e.target.id === 'topbar-context-title' && document.body.dataset.view === 'discover' && window.innerWidth <= 900) document.getElementById('rail-home')?.click();
});

let lobbySuperLikeTimer = null;
function updateLobbySuperLikeButton(view) {
    const btn = document.getElementById('lobby-superlike-btn');
    if (!btn) return;
    const show = view === 'hub-detail' && currentHub && currentHub.visibility === 'discoverable';
    btn.style.display = show ? '' : 'none';
    btn.classList.remove('confirming');
    btn.dataset.confirm = '';
}
document.addEventListener('click', async (e) => {
    const btn = e.target.closest && e.target.closest('#lobby-superlike-btn');
    if (!btn || !currentHub) return;
    if (btn.dataset.confirm !== '1') {
        btn.dataset.confirm = '1';
        btn.classList.add('confirming');
        showToast('Süper Beğeni: 10 🪙 — onaylamak için tekrar dokun');
        clearTimeout(lobbySuperLikeTimer);
        lobbySuperLikeTimer = setTimeout(() => { btn.dataset.confirm = ''; btn.classList.remove('confirming'); }, 4000);
        return;
    }
    btn.dataset.confirm = ''; btn.classList.remove('confirming'); btn.disabled = true;
    try {
        const r = await fetch(`/api/discover/lobbies/${currentHub.id}/super-like`, { method: 'POST', credentials: 'include' });
        const data = await r.json();
        if (!data.success) showToast(data.error || 'Süper Beğeni gönderilemedi.');
        else if (typeof setWalletBalance === 'function') setWalletBalance(data.super_like.balance);
    } catch (_) { showToast('Süper Beğeni gönderilemedi.'); }
    btn.disabled = false;
});

// Buton açıklamaları: ikonların altında kısa (2 kelime) etiket.
(function labelButtons() {
    const map = { 'rail-home': 'Ana Menü', 'rail-lobbies': 'Lobiler', 'rail-groups': 'Gruplar', 'rail-friends': 'Arkadaşlar', 'rail-discover': 'Keşfet', 'rail-notifications': 'Bildirim', 'rail-friend': 'Arkadaş Ekle', 'rail-settings': 'Ayarlar', 'rail-profile': 'Profil',
        'discover-search-toggle': 'Ara', 'discover-wallet': 'Coin', 'topbar-menu-btn': 'Menü', 'lobby-nav-toggle': 'Lobiler', 'hub-back-btn': '' };
    Object.entries(map).forEach(([id, label]) => { const el = document.getElementById(id); if (el && label) el.dataset.lbl = label; });
})();

// Lobi içi Süper Beğeni animasyonu + son 24 saat "Destekçiler" şeridi (yalnızca profil resimleri).
function playSuperLikeAnimation(d) {
    const el = document.createElement('div');
    el.className = 'super-like-burst';
    const who = d.by_owner ? 'Lobi sahibi' : d.username;
    el.innerHTML = `<div class="slb-star">⭐</div><div class="slb-text">${escapeHtml(who)} Lobiye Süper Beğeni attı!</div>`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3200);
}

async function loadLobbySupporters(lobbyId) {
    const box = document.getElementById('lobby-supporters');
    if (!box) return;
    try {
        const res = await fetch(`/api/hubs/${lobbyId}/supporters`, { credentials: 'same-origin' });
        const data = await res.json();
        if (!currentHub || currentHub.id !== lobbyId) return;
        const list = (data && data.success && data.supporters) || [];
        if (!list.length) { box.hidden = true; box.innerHTML = ''; return; }
        box.innerHTML = '<span class="ls-label">⭐ Destekçiler (24 sa)</span>' + list.map((s) => {
            const inner = s.avatar_data ? `<img src="${escapeAttr(s.avatar_data)}" alt="">` : escapeHtml(s.username.charAt(0).toUpperCase());
            return `<span class="ls-avatar" title="${escapeAttr(s.username)}">${inner}</span>`;
        }).join('');
        box.hidden = false;
    } catch (_) { /* şerit ikincil; sessizce geç */ }
}

function showToast(message) {

    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;

    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('toast-leaving');
        setTimeout(() => toast.remove(), 250);
    }, 3200);

}


function showCenterToast(message) {

    const bubble = document.createElement('div');
    bubble.className = 'center-toast';
    bubble.textContent = message;
    document.body.appendChild(bubble);

    setTimeout(() => {
        bubble.classList.add('center-toast-leaving');
        setTimeout(() => bubble.remove(), 300);
    }, 2000);

}


// =====================================================
// MESSAGE ACTIONS — ORTAK MODÜL (AŞAMA D)
// =====================================================
// Reply / Reaction / Copy / CopyLink / Forward / Pin — Edit/Delete/Report
// zaten vardı (yukarıda), burada yeniden yazılmadı, sadece aynı modül
// üzerinden çağrılıyor. Hem renderHubMessageIntoWrap hem renderDmMessageIntoWrap
// TEK bu modülü kullanıyor — Lobi/DM için ayrı ayrı tekrar eden kod yok.

const QUICK_REACTION_EMOJIS = ['❤️', '😂', '👍', '🔥', '😮'];
const ALL_REACTION_EMOJIS = ['❤️', '😂', '👍', '👎', '😮', '😢', '🔥'];
// Sauran Plus "Özel emoji paketi": ek tepki emojileri (sunucu yetkisiz eklemeyi reddeder).
const EXTRA_REACTION_EMOJIS = ['🥰', '😎', '🤩', '🥳', '🤔', '💯', '🎉', '🙏', '👏', '💀', '😭', '✨'];
const FORWARDABLE_KINDS = ['text', 'dm', 'voice', 'dm_voice', 'image', 'dm_image', 'video', 'dm_video', 'file', 'dm_file'];

let hubReplyTarget = null;
let dmReplyTarget = null;
let forwardMessageId = null;

function getMessagePermissions(msg, opts) {

    const isMine = Boolean(currentUser && msg.user_id === currentUser.id);
    const isDeleted = msg.kind === 'deleted';
    const isPinned = Boolean(msg.pinned_at);

    // ÖNEMLİ: Pin yetkisi SADECE Lobi izin sistemi (hasAtLeastTier) üzerinden —
    // platform_role (moderator/admin/founder) burada hiç kontrol edilmiyor.
    // Bu görsel kontrol sadece UX içindir; asıl güvenlik server'da (bkz. pinMessage).
    const canPin = opts.context === 'hub' && !isDeleted && currentHub &&
        (currentHub.my_permission_tier === 'owner' || currentHub.my_permission_tier === 'moderator');

    const readOnly = Boolean(opts.readOnly);

    return {
        isMine, isDeleted, isPinned,
        canReply: !isDeleted && !readOnly,
        canReact: !isDeleted && !readOnly,
        canCopy: !isDeleted && Boolean(msg.content),
        canCopyLink: !isDeleted && Boolean(msg.payload?.url),
        canForward: !isDeleted && !readOnly && FORWARDABLE_KINDS.includes(msg.kind),
        canEdit: isMine && !isDeleted && !readOnly && (msg.kind === 'text' || msg.kind === 'dm'),
        canDelete: isMine && !isDeleted,
        canPin,
        canReport: !isMine && !msg.sender_deleted
    };

}

function buildMsgActionsBarHtml(msg, opts) {

    const p = getMessagePermissions(msg, opts);
    const hasAnything = p.canReply || p.canReact || p.canCopy || p.canCopyLink || p.canForward || p.canEdit || p.canDelete || p.canPin || p.canReport;
    if (!hasAnything) return '';

    const menuRowsPrimary = [];
    if (p.canReply) menuRowsPrimary.push(`<button data-action="reply" type="button">↩ ${t('message-reply')}</button>`);
    if (p.canReact) menuRowsPrimary.push(`<button data-action="react" type="button">😊 ${t('message-react')}</button>`);
    if (p.canCopy) menuRowsPrimary.push(`<button data-action="copy" type="button">📋 ${t('message-copy')}</button>`);
    if (p.canCopyLink) menuRowsPrimary.push(`<button data-action="copy-link" type="button">🔗 ${t('message-copy-link')}</button>`);
    if (p.canForward) menuRowsPrimary.push(`<button data-action="forward" type="button">↗ ${t('message-forward')}</button>`);

    const menuRowsOwn = [];
    if (p.canEdit) menuRowsOwn.push(`<button data-action="edit" type="button">✏ ${t('message-edit')}</button>`);
    if (p.canDelete) menuRowsOwn.push(`<button data-action="delete" type="button" class="hub-member-menu-danger">🗑 ${t('message-delete')}</button>`);

    const menuRowsMod = [];
    if (p.canPin) menuRowsMod.push(`<button data-action="pin" type="button">${p.isPinned ? `📌 ${t('message-unpin')}` : `📌 ${t('message-pin')}`}</button>`);

    const menuRowsReport = [];
    if (p.canReport) menuRowsReport.push(`<button data-action="report" type="button">⚠ ${t('message-report')}</button>`);

    const menuHtml = [menuRowsPrimary, menuRowsOwn, menuRowsMod, menuRowsReport]
        .filter(group => group.length)
        .map(group => group.join(''))
        .join('<div class="msg-actions-menu-divider"></div>');

    return `
        <div class="hub-msg-actions msg-actions-bar">
            ${p.canReact ? `<button class="msg-action-quick" data-quick="react" type="button" title="${t('message-react')}" aria-label="${t('message-react')}">😊</button>` : ''}
            ${p.canReply ? `<button class="msg-action-quick" data-quick="reply" type="button" title="${t('message-reply')}" aria-label="${t('message-reply')}">↩</button>` : ''}
            <button class="msg-action-quick" data-quick="more" type="button" title="${t('message-more-actions')}" aria-label="${t('message-more-actions')}">⋯</button>
            <div class="msg-reaction-picker liquid-glass" style="display:none;">
                ${ALL_REACTION_EMOJIS.map(e => `<button type="button" data-emoji="${e}">${e}</button>`).join('')}
                ${EXTRA_REACTION_EMOJIS.map(e => `<button type="button" class="react-extra${userHasFeature('custom_emoji') ? '' : ' locked'}" data-emoji="${e}" title="Sauran Plus">${e}</button>`).join('')}
            </div>
            <div class="msg-actions-menu liquid-glass" style="display:none;">${menuHtml}</div>
        </div>
    `;

}

function buildMsgReactionsRowHtml(msg) {

    if (!msg.reactions || !msg.reactions.length) return '';

    return `
        <div class="msg-reactions-row">
            ${msg.reactions.map(r => `
                <button type="button" class="msg-reaction-pill ${r.reactedByMe ? 'mine' : ''}" data-emoji="${escapeAttr(r.emoji)}">${r.emoji} <span>${r.count}</span></button>
            `).join('')}
        </div>
    `;

}

function describeClientMessageKind(msg) {
    const map = {
        voice: '🎙️ Sesli mesaj', dm_voice: '🎙️ Sesli mesaj',
        image: '🖼️ Görsel', dm_image: '🖼️ Görsel',
        video: '🎬 Video', dm_video: '🎬 Video',
        file: '📎 Dosya', dm_file: '📎 Dosya',
        poll: '📊 Anket', share: '🔗 Paylaşım',
        deleted: t('message-reply-deleted')
    };
    return map[msg.kind] || '';
}

function buildMsgReplyQuoteHtml(msg) {

    if (!msg.reply_to) return '';

    const rt = msg.reply_to;
    const previewText = (rt.kind === 'deleted' || !rt.preview) ? t('message-reply-deleted') : escapeHtml(rt.preview);

    return `
        <div class="msg-reply-quote" data-jump-to="${rt.id}">
            <span class="msg-reply-quote-user">↩ ${escapeHtml(rt.username || '')}</span>
            <span class="msg-reply-quote-text">${previewText}</span>
        </div>
    `;

}

function wireMessageActions(wrap, msg, opts) {

    const bar = wrap.querySelector('.msg-actions-bar');

    if (bar) {

        const reactBtn = bar.querySelector('[data-quick="react"]');
        const replyBtn = bar.querySelector('[data-quick="reply"]');
        const moreBtn = bar.querySelector('[data-quick="more"]');
        const picker = bar.querySelector('.msg-reaction-picker');
        const menu = bar.querySelector('.msg-actions-menu');

        reactBtn?.addEventListener('click', (event) => {
            event.stopPropagation();
            const willOpen = picker.style.display !== 'flex';
            closeAllMessageMenus();
            if (willOpen) openPortalPanel(picker, bar);
        });

        picker?.querySelectorAll('[data-emoji]').forEach((btn) => {
            btn.addEventListener('click', (event) => {
                event.stopPropagation();
                if (btn.classList.contains('locked')) { showToast('Ek emoji paketi Sauran Plus abonelerine açıktır.'); return; }
                picker.style.display = 'none';
                sendReactionRequest(msg.id, btn.dataset.emoji, false);
            });
        });

        replyBtn?.addEventListener('click', (event) => {
            event.stopPropagation();
            startMessageReply(msg, opts);
        });

        moreBtn?.addEventListener('click', (event) => {
            event.stopPropagation();
            const willOpen = menu.style.display !== 'flex';
            closeAllMessageMenus();
            if (willOpen) openPortalPanel(menu, bar);
        });

        menu?.querySelectorAll('[data-action]').forEach((btn) => {
            btn.addEventListener('click', (event) => {
                event.stopPropagation();
                menu.style.display = 'none';
                runMessageAction(btn.dataset.action, msg, opts, wrap, picker);
            });
        });

    }

    wireReactionPills(wrap, msg.id);

    wrap.querySelector('.msg-reply-quote')?.addEventListener('click', (event) => {
        scrollToMessage(event.currentTarget.dataset.jumpTo);
    });

}

function wireReactionPills(wrap, messageId) {
    wrap.querySelectorAll('.msg-reaction-pill').forEach((pill) => {
        if (pill.dataset.wired) return;
        pill.dataset.wired = '1';
        pill.addEventListener('click', (event) => {
            event.stopPropagation();
            const mine = pill.classList.contains('mine');
            sendReactionRequest(messageId, pill.dataset.emoji, mine);
        });
    });
}

// .hub-msg-actions'ın backdrop-filter'ı (liquid glass) CSS spesifikasyonu gereği
// position:fixed alt öğeler için yeni bir konumlandırma bağlamı oluşturuyor — bu
// yüzden mobil alt-sheet menüsü gerçek viewport'a değil o küçük çubuğa göre
// sabitleniyordu. Çözüm: panel açılırken document.body'ye taşınıyor (portal),
// kapanınca ait olduğu çubuğa geri dönüyor.
function openPortalPanel(panel, homeParent) {
    panel._homeParent = homeParent;
    panel.dataset.reparented = '1';

    const isMobile = window.innerWidth <= 768;

    if (isMobile) {
        // Mobilde CSS zaten alt-sheet konumlandırmasını (bottom:0) yapıyor —
        // inline stil bırakmıyoruz ki stylesheet kuralıyla çakışmasın.
        panel.style.position = '';
        panel.style.top = '';
        panel.style.left = '';
        panel.style.right = '';
        panel.style.bottom = '';
    } else {
        // Masaüstünde body'ye taşındığı için artık DOM konumundan bağımsız —
        // orijinal çubuğun ekran konumuna göre elle hizalıyoruz (aşağıda).
        panel.style.position = 'fixed';
        panel.style.bottom = 'auto';
        panel.style.right = 'auto';
        panel.style.top = '0px';
        panel.style.left = '0px';
    }

    document.body.appendChild(panel);
    panel.style.display = 'flex';

    if (!isMobile) placePortalPanel(panel, homeParent);
}

// Varsayılan: panel, çubuğun sağ kenarına hizalı açılır. Sol taraftaki
// mesajlarda (çubuk sol kenara yakın) bu, paneli ekranın soluna taşırıp
// kırpıyor ve sol kenardaki "Sesli Odalar" sekmesinin üstüne bindiriyordu —
// sığmıyorsa mesajın sağına kaydırılır. Alta sığmıyorsa çubuğun üstüne açılır.
function placePortalPanel(panel, anchor) {

    const rect = anchor.getBoundingClientRect();
    const width = panel.offsetWidth;
    const height = panel.offsetHeight;
    const edge = 8;
    const leftTabClearance = 40;

    let left = rect.right - width;
    if (left < leftTabClearance) left = Math.max(leftTabClearance, rect.left);
    left = Math.max(edge, Math.min(left, window.innerWidth - width - edge));

    let top = rect.bottom + 6;
    if (top + height > window.innerHeight - edge) top = Math.max(edge, rect.top - height - 6);

    panel.style.left = `${left}px`;
    panel.style.top = `${top}px`;

}

function closeAllMessageMenus() {
    document.querySelectorAll('.msg-actions-menu, .msg-reaction-picker').forEach((el) => {
        el.style.display = 'none';
        el.style.position = '';
        el.style.top = '';
        el.style.left = '';
        el.style.right = '';
        el.style.bottom = '';
        if (el.dataset.reparented && el._homeParent) {
            el._homeParent.appendChild(el);
            delete el.dataset.reparented;
        }
    });
}

document.addEventListener('click', closeAllMessageMenus);
document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeAllMessageMenus();
});

async function sendReactionRequest(messageId, emoji, remove) {
    try {
        if (remove) {
            await fetch(`/api/messages/${messageId}/reactions/${encodeURIComponent(emoji)}`, { method: 'DELETE', credentials: 'include' });
        } else {
            await fetch(`/api/messages/${messageId}/reactions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ emoji })
            });
        }
    } catch (error) {
        console.error('Tepki gönderilemedi:', error);
    }
}

// Diğer kullanıcılarda anlık güncelleme — tüm mesajı yeniden çizmek yerine
// (edit-box gibi geçici UI durumlarını bozmamak için) sadece tepki satırını
// güncelliyoruz.
function patchMessageReactionsUI(feedEl, messageId, reactions) {

    const wrap = feedEl.querySelector(`[data-message-id="${messageId}"]`);
    if (!wrap) return;

    const existingRow = wrap.querySelector('.msg-reactions-row');
    if (existingRow) existingRow.remove();

    const html = buildMsgReactionsRowHtml({ reactions });
    if (html) {
        const container = wrap.querySelector('.hub-msg-body') || wrap;
        container.insertAdjacentHTML('beforeend', html);
    }

    wireReactionPills(wrap, messageId);

}

function runMessageAction(action, msg, opts, wrap, picker) {
    if (action === 'reply') return startMessageReply(msg, opts);
    if (action === 'react') { if (picker) picker.style.display = 'flex'; return; }
    if (action === 'copy') return copyMessageText(msg);
    if (action === 'copy-link') return copyMessageLink(msg);
    if (action === 'forward') return openForwardModal(msg.id);
    if (action === 'edit') return startInlineEdit(wrap, msg, opts);
    if (action === 'delete') return deleteMessageWithConfirm(msg.id);
    if (action === 'pin') return toggleMessagePin(msg);
    if (action === 'report') return openReportModal('message', msg.id, msg.username);
}

async function copyMessageText(msg) {
    try {
        await navigator.clipboard.writeText(msg.content || '');
        showToast(t('message-copied'));
    } catch (error) {
        console.error('Kopyalanamadı:', error);
    }
}

async function copyMessageLink(msg) {
    const url = msg.payload?.url;
    if (!url) return;
    try {
        await navigator.clipboard.writeText(url);
        showToast(t('message-link-copied'));
    } catch (error) {
        console.error('Bağlantı kopyalanamadı:', error);
    }
}

function deleteMessageWithConfirm(messageId) {
    if (!confirm(t('confirm-delete-message'))) return;
    fetch(`/api/messages/${messageId}`, { method: 'DELETE', credentials: 'include' });
}

async function toggleMessagePin(msg) {
    const method = msg.pinned_at ? 'DELETE' : 'POST';
    try {
        const res = await fetch(`/api/messages/${msg.id}/pin`, { method, credentials: 'include' });
        const data = await res.json();
        if (!data.success) showToast(data.error || 'İşlem başarısız.');
    } catch (error) {
        console.error('Sabitleme hatası:', error);
    }
}

function startMessageReply(msg, opts) {

    const label = msg.content ? msg.content.slice(0, 60) : describeClientMessageKind(msg);
    const html = `<strong>${escapeHtml(msg.username)}</strong>: ${escapeHtml(label)}`;

    if (opts.context === 'hub') {
        hubReplyTarget = msg.id;
        document.getElementById('hub-reply-preview-content').innerHTML = html;
        document.getElementById('hub-reply-preview').style.display = 'flex';
        hubMessageInput.focus();
    } else {
        dmReplyTarget = msg.id;
        document.getElementById('dm-reply-preview-content').innerHTML = html;
        document.getElementById('dm-reply-preview').style.display = 'flex';
        dmMessageInput.focus();
    }

}

function cancelMessageReply(context) {
    if (context === 'hub') {
        hubReplyTarget = null;
        document.getElementById('hub-reply-preview').style.display = 'none';
    } else {
        dmReplyTarget = null;
        document.getElementById('dm-reply-preview').style.display = 'none';
    }
}

document.getElementById('hub-reply-cancel-btn').addEventListener('click', () => cancelMessageReply('hub'));
document.getElementById('dm-reply-cancel-btn').addEventListener('click', () => cancelMessageReply('dm'));

function scrollToMessage(id) {
    const wrap = document.querySelector(`[data-message-id="${id}"]`);
    if (!wrap) return;
    wrap.scrollIntoView({ behavior: 'smooth', block: 'center' });
    wrap.classList.add('msg-jump-highlight');
    setTimeout(() => wrap.classList.remove('msg-jump-highlight'), 1500);
}

function startInlineEdit(wrap, msg, opts) {

    const isHub = opts.context === 'hub';
    const textSelector = isHub ? '.hub-msg-text' : '.dm-msg-content';
    const textEl = wrap.querySelector(textSelector);
    if (!textEl) return;

    textEl.outerHTML = `
        <${isHub ? 'div' : 'span'} class="hub-msg-edit-box" data-edit-box>
            <input type="text" value="${escapeAttr(msg.content)}" maxlength="500">
            <button class="msg-edit-save" type="button">${t('save')}</button>
            <button class="msg-edit-cancel" type="button">${t('cancel')}</button>
        </${isHub ? 'div' : 'span'}>
    `;

    const box = wrap.querySelector('[data-edit-box]');
    const input = box.querySelector('input');
    input.focus();

    box.querySelector('.msg-edit-save').addEventListener('click', async () => {

        const newContent = input.value.trim();
        if (!newContent) return;

        const res = await fetch(`/api/messages/${msg.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ content: newContent })
        });

        const data = await res.json();
        if (!data.success) alert(data.error || 'Düzenlenemedi.');
        // Başarılıysa UI güncellemesi socket (hub_message_update/dm_message_update) üzerinden gelir.

    });

    box.querySelector('.msg-edit-cancel').addEventListener('click', () => {
        box.outerHTML = `<${isHub ? 'div' : 'span'} class="${isHub ? 'hub-msg-text' : 'dm-msg-content'}">${escapeHtml(msg.content)}</${isHub ? 'div' : 'span'}>`;
    });

}

async function openForwardModal(messageId) {

    forwardMessageId = messageId;
    const listEl = document.getElementById('forward-friend-list');
    const emptyEl = document.getElementById('forward-modal-empty');
    listEl.innerHTML = '';
    emptyEl.style.display = 'none';

    try {

        const res = await fetch('/api/friends', { credentials: 'include' });
        const data = await res.json();
        const friends = data.success ? data.friends : [];

        if (!friends.length) {
            emptyEl.style.display = 'block';
        } else {

            listEl.innerHTML = friends.map(f => `
                <label class="report-reason-option" data-user-id="${f.id}" style="cursor:pointer;">
                    <span>${usernameCardHtml(f.username, f.plus_active, f.name_effect)}</span>
                </label>
            `).join('');

            listEl.querySelectorAll('[data-user-id]').forEach((row) => {
                row.addEventListener('click', async () => {

                    const toUserId = Number(row.dataset.userId);

                    const res2 = await fetch(`/api/messages/${forwardMessageId}/forward`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify({ to_user_id: toUserId })
                    });

                    const data2 = await res2.json();

                    if (data2.success) {
                        showToast(t('message-forwarded'));
                        document.getElementById('forward-modal').style.display = 'none';
                    } else {
                        showToast(data2.error || 'İletilemedi.');
                    }

                });
            });

        }

    } catch (error) {
        console.error('Arkadaş listesi alınamadı:', error);
    }

    document.getElementById('forward-modal').style.display = 'flex';

}

document.getElementById('forward-modal-close-btn').addEventListener('click', () => {
    document.getElementById('forward-modal').style.display = 'none';
});


// =====================================================
// DOSYA / FOTOĞRAF / VİDEO MESAJLARI
// =====================================================

const FILE_MAX_BYTES_FREE = 25 * 1024 * 1024;
const FILE_MAX_BYTES_PLUS = 50 * 1024 * 1024;
const FILE_MAX_BYTES_PREMIUM = 100 * 1024 * 1024;
function currentFileMaxBytes() {
    if (currentUser && currentUser.premium_active) return FILE_MAX_BYTES_PREMIUM;
    return (currentUser && currentUser.plus_active) ? FILE_MAX_BYTES_PLUS : FILE_MAX_BYTES_FREE;
}
function fileMaxLabel() { return `${Math.round(currentFileMaxBytes() / (1024 * 1024))} MB`; }

function formatFileSize(bytes) {
    bytes = Number(bytes) || 0;
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// prefix: 'hub' | 'dm' — bekler #{prefix}-sticker-picker elementinin var olduğunu.
function wireStickerPicker(prefix, onPick) {

    const picker = document.getElementById(`${prefix}-sticker-picker`);
    if (!picker) return;

    STICKERS.forEach((sticker) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = sticker.emoji;
        btn.title = sticker.id;
        btn.addEventListener('click', () => {
            picker.style.display = 'none';
            onPick(sticker.id);
        });
        picker.appendChild(btn);
    });

    const plusLabel = document.createElement('div');
    plusLabel.className = 'sticker-picker-label';
    plusLabel.innerHTML = '<span class="plus-badge plus-badge-sm" style="margin-left:0;">✦ PLUS</span> Hareketli çıkartmalar';
    picker.appendChild(plusLabel);

    PLUS_STICKERS.forEach((sticker) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'sticker-plus-btn';
        btn.innerHTML = stickerInnerHtml(sticker.id);
        btn.title = 'Sauran Plus';
        btn.addEventListener('click', () => {
            if (!userHasFeature('sticker_pack')) {
                showToast('Hareketli çıkartmalar Sauran Plus abonelerine açıktır.');
                return;
            }
            picker.style.display = 'none';
            onPick(sticker.id);
        });
        picker.appendChild(btn);
    });

    document.addEventListener('click', (event) => {
        if (picker.style.display === 'grid' && !picker.contains(event.target)) {
            picker.style.display = 'none';
        }
    });

}

// prefix: 'hub' | 'dm' — bekler #{prefix}-attach-btn, #{prefix}-attach-menu,
// #{prefix}-attach-input-camera/gallery/file elementlerinin var olduğunu.
// Açılır menü ekran dışına taşıyorsa yatayda içeri kaydırır.
function clampPopupToViewport(el) {
    el.style.marginLeft = '';
    const r = el.getBoundingClientRect();
    const vw = document.documentElement.clientWidth;
    let dx = 0;
    if (r.left < 8) dx = 8 - r.left;
    else if (r.right > vw - 8) dx = (vw - 8) - r.right;
    if (dx) el.style.marginLeft = `${Math.round(dx)}px`;
}

function wireAttachMenu(prefix, onFile) {

    const btn = document.getElementById(`${prefix}-attach-btn`);
    const menu = document.getElementById(`${prefix}-attach-menu`);
    const inputs = {
        camera: document.getElementById(`${prefix}-attach-input-camera`),
        gallery: document.getElementById(`${prefix}-attach-input-gallery`),
        file: document.getElementById(`${prefix}-attach-input-file`)
    };

    btn.addEventListener('click', (event) => {
        event.stopPropagation();
        menu.style.display = menu.style.display === 'flex' ? 'none' : 'flex';
        if (menu.style.display === 'flex') clampPopupToViewport(menu);
    });

    document.addEventListener('click', (event) => {
        if (menu.style.display === 'flex' && !menu.contains(event.target) && event.target !== btn) {
            menu.style.display = 'none';
        }
    });

    menu.querySelectorAll('[data-attach]').forEach((item) => {
        item.addEventListener('click', (event) => {
            menu.style.display = 'none';
            if (item.dataset.attach === 'sticker') {
                event.stopPropagation();
                const picker = document.getElementById(`${prefix}-sticker-picker`);
                if (picker) { picker.style.display = 'grid'; clampPopupToViewport(picker); }
                return;
            }
            inputs[item.dataset.attach]?.click();
        });
    });

    Object.values(inputs).forEach((input) => {
        input.addEventListener('change', () => {
            const file = input.files?.[0];
            input.value = '';
            if (file) onFile(file);
        });
    });

}


async function handleAttachedFile(file) {

    if (!file) return null;

    const isVideo = file.type.startsWith('video/');

    if (file.size > currentFileMaxBytes()) {
        showToast((isVideo ? 'Video limiti ' : 'Dosya limiti ') + fileMaxLabel() + "'dir.");
        return null;
    }

    try {

        const data = await readFileAsDataUrl(file);

        return {
            data,
            name: file.name,
            mime: file.type || 'application/octet-stream',
            size: file.size
        };

    } catch (error) {

        console.error('Dosya okunamadı:', error);
        showToast('Dosya okunamadı, tekrar dene.');
        return null;

    }

}

function buildFileCardHtml(payload) {

    const mime = payload?.mime || '';
    const name = payload?.name || 'dosya';
    const size = formatFileSize(payload?.size);

    // Medya saklama süresi dolduysa (sunucu base64 veriyi sildi) yalnızca ad ve bir bilgi gösterilir.
    if (!payload || payload.expired || !payload.data) {
        return `<div class="file-msg-card"><span class="hub-msg-deleted">📎 ${escapeHtml(name)} — ${t('media-expired')}</span></div>`;
    }

    if (mime.startsWith('image/')) {
        return `
            <div class="file-msg-card image-msg-card">
                <img class="lightbox-img" src="${escapeAttr(payload.data)}" alt="${escapeAttr(name)}" loading="lazy">
            </div>
        `;
    }

    if (mime.startsWith('video/')) {
        return `
            <div class="file-msg-card video-msg-card">
                <video src="${escapeAttr(payload.data)}" controls preload="metadata"></video>
            </div>
        `;
    }

    return `
        <div class="file-msg-card">
            <span class="file-msg-icon">📎</span>
            <div class="file-msg-info">
                <div class="file-msg-name">${escapeHtml(name)}</div>
                <div class="file-msg-size">${size}</div>
            </div>
            <a class="file-msg-download" href="${escapeAttr(payload.data)}" download="${escapeAttr(name)}">İndir</a>
        </div>
    `;

}


function formatDuration(seconds) {

    seconds = Math.round(seconds || 0);
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(s).padStart(2, '0')}`;

}


function buildVoiceCardHtml(audioSrc, duration) {

    if (!audioSrc) {
        return `<div class="voice-msg-card"><span class="hub-msg-deleted">🎙️ ${t('media-expired')}</span></div>`;
    }

    return `
        <div class="voice-msg-card">
            <button class="voice-play-btn" type="button" data-audio-src="${escapeAttr(audioSrc)}">▶</button>
            <div class="voice-progress"><div class="voice-progress-fill"></div></div>
            <span class="voice-msg-duration">${formatDuration(duration)}</span>
            <audio class="voice-audio-el" preload="none"></audio>
        </div>
    `;

}


function wireVoiceCards(container) {

    container.querySelectorAll('.voice-play-btn').forEach((btn) => {

        if (btn.dataset.wired) return;
        btn.dataset.wired = '1';

        const card = btn.closest('.voice-msg-card');
        const audio = card.querySelector('.voice-audio-el');
        const fill = card.querySelector('.voice-progress-fill');

        btn.addEventListener('click', () => {

            document.querySelectorAll('.voice-audio-el').forEach((el) => {

                if (el !== audio && !el.paused) {

                    el.pause();

                    const otherBtn = el.closest('.voice-msg-card')?.querySelector('.voice-play-btn');
                    if (otherBtn) otherBtn.textContent = '▶';

                }

            });

            if (!audio.src) audio.src = btn.dataset.audioSrc;

            if (audio.paused) {

                audio.play().catch((error) => {
                    console.error('Ses oynatılamadı:', error);
                    btn.textContent = '⚠';
                });

                btn.textContent = '⏸';

            } else {

                audio.pause();
                btn.textContent = '▶';

            }

        });

        audio.addEventListener('timeupdate', () => {
            if (audio.duration) fill.style.width = `${(audio.currentTime / audio.duration) * 100}%`;
        });

        audio.addEventListener('ended', () => {
            btn.textContent = '▶';
            fill.style.width = '0%';
        });

        audio.addEventListener('error', () => {
            btn.textContent = '⚠';
        });

    });

}


function enableLongPress(el) {

    if (el.dataset.longPressWired) return;
    el.dataset.longPressWired = '1';

    let timer = null;

    el.addEventListener('touchstart', () => {

        timer = setTimeout(() => {

            document.querySelectorAll('.show-actions').forEach((other) => {
                if (other !== el) other.classList.remove('show-actions');
            });

            el.classList.add('show-actions');

        }, 450);

    }, { passive: true });

    el.addEventListener('touchmove', () => clearTimeout(timer), { passive: true });
    el.addEventListener('touchend', () => clearTimeout(timer));
    el.addEventListener('touchcancel', () => clearTimeout(timer));

}


document.addEventListener('touchstart', (event) => {

    document.querySelectorAll('.show-actions').forEach((el) => {
        if (!el.contains(event.target)) el.classList.remove('show-actions');
    });

}, { passive: true });


dmForm.addEventListener(
    'submit',
    (event) => {

        event.preventDefault();

        const content = dmMessageInput.value.trim();
        if (!content || !activeDmUserId || !socket) return;
        if (feedPaging.dm.hasNewer) returnToLatest('dm');

        const clientId = newClientId();
        appendDmMessage(optimisticMessage(content, 'dm', { to_user_id: activeDmUserId, reply_to_message_id: dmReplyTarget }), { forceScroll: true, clientId });
        typingSendStop('dm');
        socket.emit('dm_message', { to_user_id: activeDmUserId, content, reply_to_message_id: dmReplyTarget, client_id: clientId });

        dmMessageInput.value = '';
        cancelMessageReply('dm');

    }
);


function closeDmPanel() {
    dmModal.style.display = 'none';
    activeDmUserId = null;
}

// Dokunur dokunmaz kapanır (pointerup); 'click' yedek olarak kalır (klavye / erişilebilirlik).
dmCloseBtn.addEventListener('pointerup', (event) => {
    if (event.button !== undefined && event.button !== 0) return;
    event.preventDefault();
    closeDmPanel();
});
dmCloseBtn.addEventListener('click', closeDmPanel);

// ── Görünmeyen mesajların efektlerini duraklat (iPhone'da akıcılık) ──
(() => {
    if (typeof IntersectionObserver !== 'function') return;
    const io = new IntersectionObserver((entries) => {
        entries.forEach((entry) => entry.target.classList.toggle('msg-offscreen', !entry.isIntersecting));
    }, { rootMargin: '150px 0px' });
    const watch = (feed, selector) => {
        if (!feed) return;
        const observeAll = (root) => {
            if (root.nodeType !== 1) return;
            if (root.matches(selector)) io.observe(root);
            root.querySelectorAll?.(selector).forEach((el) => io.observe(el));
        };
        observeAll(feed);
        new MutationObserver((mutations) => mutations.forEach((m) => {
            m.addedNodes.forEach(observeAll);
            m.removedNodes.forEach((n) => { if (n.nodeType === 1) { if (n.matches(selector)) io.unobserve(n); n.querySelectorAll?.(selector).forEach((el) => io.unobserve(el)); } });
        })).observe(feed, { childList: true, subtree: true });
    };
    watch(document.getElementById('dm-feed'), '.dm-msg-row');
    watch(document.getElementById('hub-feed'), '.hub-msg');
})();


dmModal.addEventListener(
    'click',
    (event) => {
        if (event.target === dmModal) {
            dmModal.style.display = 'none';
            activeDmUserId = null;
        }
    }
);


// =====================================================
// HUB SİSTEMİ — DOM
// =====================================================

const hubListView = document.getElementById('hub-list-view');
const hubDetailView = document.getElementById('hub-detail-view');

const hubListHeader = document.getElementById('hub-list-header');
const hubListContent = document.getElementById('hub-list-content');
const hubListGridOwned = document.getElementById('hub-list-grid-owned');
const hubListGridJoined = document.getElementById('hub-list-grid-joined');
const hubListEmpty = document.getElementById('hub-list-empty');
const hubCreateOpenBtn = document.getElementById('hub-create-open-btn');
const hubCreateOpenBtnBig = document.getElementById('hub-create-open-btn-big');

const hubCreateModal = document.getElementById('hub-create-modal');
const hubCreateCloseBtn = document.getElementById('hub-create-close-btn');
const hubCreateNameInput = document.getElementById('hub-create-name-input');
const hubCreateImagePreview = document.getElementById('hub-create-image-preview');
const hubCreateImageBtn = document.getElementById('hub-create-image-btn');
const hubCreateImageInput = document.getElementById('hub-create-image-input');
const hubCreateError = document.getElementById('hub-create-error');
const hubCreateSubmitBtn = document.getElementById('hub-create-submit-btn');

const hubJoinOpenBtn = document.getElementById('hub-join-open-btn');
const hubJoinModal = document.getElementById('hub-join-modal');
const hubJoinCloseBtn = document.getElementById('hub-join-close-btn');
const hubJoinCodeInput = document.getElementById('hub-join-code-input');
const hubJoinError = document.getElementById('hub-join-error');
const hubJoinSubmitBtn = document.getElementById('hub-join-submit-btn');

const hubInviteBtn = document.getElementById('hub-invite-btn');
const hubInviteModal = document.getElementById('hub-invite-modal');
const hubInviteCloseBtn = document.getElementById('hub-invite-close-btn');
const hubInviteCodeDisplay = document.getElementById('hub-invite-code-display');

const hubInviteFriendBtn = document.getElementById('hub-invite-friend-btn');
const hubInviteFriendModal = document.getElementById('hub-invite-friend-modal');
const hubInviteFriendCloseBtn = document.getElementById('hub-invite-friend-close-btn');
const hubInviteFriendList = document.getElementById('hub-invite-friend-list');

const hubBackBtn = document.getElementById('hub-back-btn');
const hubDetailIcon = document.getElementById('hub-detail-icon');
const hubDetailName = document.getElementById('hub-detail-name');
const hubDetailCount = document.getElementById('hub-detail-count');
const hubFeed = document.getElementById('hub-feed');
hubFeed.addEventListener('scroll', () => { if (hubFeed.scrollTop < 120) loadOlderMessages('hub'); }, { passive: true });
dmFeed.addEventListener('scroll', () => { if (dmFeed.scrollTop < 120) loadOlderMessages('dm'); }, { passive: true });
keepFeedPinned(hubFeed);
keepFeedPinned(dmFeed);

// ─── "Yazıyor…" göstergesi ───
const TYPING_TTL_MS = 5000;     // son sinyalden bu kadar sonra kişi listeden düşer
const TYPING_SEND_MS = 2500;    // yazarken en sık bu aralıkla sinyal gönderilir
const typingState = { hub: new Map(), dm: new Map() }; // kapsam -> Map(user_id -> { username, timer })
const typingSent = { hub: { key: null, at: 0 }, dm: { key: null, at: 0 } };

function makeTypingIndicator(form) {
    const el = document.createElement('div');
    el.className = 'typing-indicator';
    el.setAttribute('aria-live', 'polite');
    el.innerHTML = '<span class="typing-dots" aria-hidden="true"><i></i><i></i><i></i></span><span class="typing-text"></span>';
    form.parentElement.insertBefore(el, form);
    return el;
}
const typingEls = { hub: makeTypingIndicator(document.getElementById('hub-chat-form')), dm: makeTypingIndicator(dmForm) };

function currentTypingKey(scope) {
    return scope === 'hub' ? (currentHub?.id || null) : (activeDmUserId || null);
}

function renderTyping(scope) {
    const el = typingEls[scope];
    const names = [...typingState[scope].values()].map((v) => v.username);
    let text = '';
    if (names.length === 1) text = `${names[0]} ${t('typing-one')}`;
    else if (names.length === 2) text = `${names[0]} ${t('typing-and')} ${names[1]} ${t('typing-many')}`;
    else if (names.length > 2) text = t('typing-several');
    el.querySelector('.typing-text').textContent = text;
    el.classList.toggle('active', names.length > 0);
}

function clearTyping(scope) {
    typingState[scope].forEach((v) => clearTimeout(v.timer));
    typingState[scope].clear();
    renderTyping(scope);
}

function handleTypingSignal(data) {
    const scope = data?.scope === 'dm' ? 'dm' : data?.scope === 'hub' ? 'hub' : null;
    if (!scope || data.user_id === currentUser?.id) return;
    if (Number(data.id) !== currentTypingKey(scope)) return; // yalnızca açık sohbet için gösterilir
    const map = typingState[scope];
    const prev = map.get(data.user_id);
    if (prev) clearTimeout(prev.timer);
    if (data.stop) {
        map.delete(data.user_id);
    } else {
        const timer = setTimeout(() => { map.delete(data.user_id); renderTyping(scope); }, TYPING_TTL_MS);
        map.set(data.user_id, { username: data.username, timer });
    }
    renderTyping(scope);
}

// Mesajı gelen kişi artık yazmıyordur.
function typingDoneBy(scope, userId) {
    const entry = typingState[scope].get(userId);
    if (!entry) return;
    clearTimeout(entry.timer);
    typingState[scope].delete(userId);
    renderTyping(scope);
}

function emitTyping(scope, input) {
    const id = currentTypingKey(scope);
    if (!socket || !id) return;
    const sent = typingSent[scope];
    if (!input.value.trim()) {
        if (sent.key === id && sent.at) { socket.emit('typing_stop', { scope, id }); sent.at = 0; }
        return;
    }
    const now = Date.now();
    if (sent.key === id && now - sent.at < TYPING_SEND_MS) return;
    sent.key = id;
    sent.at = now;
    socket.emit('typing', { scope, id });
}

function typingSendStop(scope) {
    const id = currentTypingKey(scope);
    if (socket && id && typingSent[scope].at) socket.emit('typing_stop', { scope, id });
    typingSent[scope].at = 0;
}

document.getElementById('hub-message-input').addEventListener('input', (e) => emitTyping('hub', e.target));
dmMessageInput.addEventListener('input', () => emitTyping('dm', dmMessageInput));

// ─── Mesaj arama ───
// İstemcideki katlama sunucudakiyle aynıdır (vurgulamada eşleşen kelimeyi bulmak için).
function searchFold(text) {
    return String(text || '').toLocaleLowerCase('tr').replace(/ı/g, 'i').normalize('NFKD').replace(/\p{M}+/gu, '');
}

function highlightSearchWords(content, words) {
    const parts = String(content || '').split(/([\p{L}\p{N}]+)/u);
    return parts.map((part, i) => {
        if (i % 2 === 0 || !words.length) return escapeHtml(part);
        const folded = searchFold(part);
        return words.some((w) => folded.startsWith(w)) ? `<mark>${escapeHtml(part)}</mark>` : escapeHtml(part);
    }).join('');
}

const msgSearch = { kind: null, key: null, query: '', results: [], hasMore: false, words: [], loading: false, timer: null };
const msgSearchPanel = document.getElementById('msg-search-panel');
const msgSearchInput = document.getElementById('msg-search-input');
const msgSearchResults = document.getElementById('msg-search-results');

function openMessageSearch(kind) {
    const key = kind === 'hub' ? currentHub?.id : activeDmUserId;
    if (!key) return;
    if (msgSearch.kind !== kind || msgSearch.key !== key) {
        Object.assign(msgSearch, { kind, key, query: '', results: [], hasMore: false, words: [] });
        msgSearchInput.value = '';
        msgSearchResults.innerHTML = '';
    }
    document.getElementById('msg-search-title').textContent = kind === 'hub' ? (currentHub?.name || '') : (activeDmUsername || '');
    msgSearchPanel.dataset.kind = kind;
    msgSearchPanel.style.display = 'flex';
    setTimeout(() => msgSearchInput.focus(), 30);
}

function closeMessageSearch() {
    msgSearchPanel.style.display = 'none';
}

async function runMessageSearch(more = false) {
    const q = msgSearchInput.value.trim();
    if (!more) { msgSearch.results = []; msgSearch.hasMore = false; }
    msgSearch.query = q;
    if (!q) { msgSearchResults.innerHTML = ''; return; }
    if (msgSearch.loading) return;
    msgSearch.loading = true;
    const before = more && msgSearch.results.length ? `&before=${msgSearch.results[msgSearch.results.length - 1].id}` : '';
    const url = msgSearch.kind === 'hub'
        ? `/api/hubs/${msgSearch.key}/search?q=${encodeURIComponent(q)}${before}`
        : `/api/dm/${msgSearch.key}/search?q=${encodeURIComponent(q)}${before}`;
    try {
        const response = await fetch(url, { credentials: 'include' });
        const data = await response.json();
        if (q !== msgSearchInput.value.trim()) return; // bu arada yeni bir şey yazıldı
        if (!data.success) { msgSearchResults.innerHTML = `<div class="msg-search-empty">${escapeHtml(data.error || '')}</div>`; return; }
        msgSearch.results = more ? msgSearch.results.concat(data.results) : data.results;
        msgSearch.hasMore = Boolean(data.has_more);
        msgSearch.words = (data.words || []).map(searchFold);
        renderMessageSearchResults();
    } catch (error) {
        console.error('Arama yapılamadı:', error);
    } finally {
        msgSearch.loading = false;
    }
}

function renderMessageSearchResults() {
    if (!msgSearch.results.length) {
        msgSearchResults.innerHTML = `<div class="msg-search-empty">${t('search-no-results')}</div>`;
        return;
    }
    msgSearchResults.innerHTML = msgSearch.results.map((r) => {
        const when = serverDate(r.created_at);
        const date = when.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' });
        const time = when.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
        const name = r.username || t('deleted-account-label');
        const avatar = r.avatar_data ? `<img src="${escapeAttr(r.avatar_data)}" alt="">` : escapeHtml(name.charAt(0).toUpperCase());
        return `
            <button type="button" class="msg-search-item" role="listitem" data-jump="${Number(r.id)}">
                <span class="msg-search-avatar" style="--user-color:${getUserColor(name)};">${avatar}</span>
                <span class="msg-search-body">
                    <span class="msg-search-meta"><strong>${escapeHtml(name)}</strong> · ${escapeHtml(date)} ${escapeHtml(time)}</span>
                    <span class="msg-search-text">${highlightSearchWords(r.content, msgSearch.words)}</span>
                </span>
            </button>
        `;
    }).join('') + (msgSearch.hasMore ? `<button type="button" class="msg-search-more" data-search-more>${t('search-more')}</button>` : '');
}

msgSearchInput.addEventListener('input', () => {
    clearTimeout(msgSearch.timer);
    msgSearch.timer = setTimeout(() => runMessageSearch(false), 300);
});
msgSearchInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') { clearTimeout(msgSearch.timer); runMessageSearch(false); }
    if (event.key === 'Escape') closeMessageSearch();
});
msgSearchResults.addEventListener('click', (event) => {
    if (event.target.closest('[data-search-more]')) { runMessageSearch(true); return; }
    const item = event.target.closest('[data-jump]');
    if (!item) return;
    if (window.innerWidth <= 768) closeMessageSearch();
    jumpToMessage(msgSearch.kind, Number(item.dataset.jump));
});
document.getElementById('msg-search-close').addEventListener('click', closeMessageSearch);
document.getElementById('hub-search-btn').addEventListener('click', () => openMessageSearch('hub'));
document.getElementById('dm-search-btn').addEventListener('click', () => openMessageSearch('dm'));

function flashMessage(el, instant) {
    el.scrollIntoView({ block: 'center', behavior: instant ? 'auto' : 'smooth' });
    el.classList.remove('msg-flash');
    void el.offsetWidth;
    el.classList.add('msg-flash');
    setTimeout(() => el.classList.remove('msg-flash'), 2200);
}

// Sonuca git: mesaj akışta zaten varsa oraya kaydırılır; yoksa çevresi (öncesi + sonrası) yüklenir, akış o noktadan devam eder.
async function jumpToMessage(kind, messageId) {
    const feed = kind === 'hub' ? hubFeed : dmFeed;
    const existing = feed.querySelector(`[data-message-id="${messageId}"]`);
    if (existing) { flashMessage(existing.closest('.dm-msg-row') || existing); return; }

    const key = kind === 'hub' ? currentHub?.id : activeDmUserId;
    if (!key) return;
    const url = kind === 'hub' ? `/api/hubs/${key}/messages?around=${messageId}` : `/api/dm/${key}/messages?around=${messageId}`;
    try {
        const response = await fetch(url, { credentials: 'include' });
        const data = await response.json();
        if (!data.success || (kind === 'hub' ? currentHub?.id : activeDmUserId) !== key) return;
        feed.innerHTML = '';
        feed._stickBottom = false;
        const append = kind === 'hub' ? appendHubMessage : appendDmMessage;
        data.messages.forEach((m) => append(m, { noScroll: true }));
        resetFeedPaging(kind, key, data.messages, data.has_more, data.has_newer);
        // Atlama sırasında kaydırma olayları otomatik eski/yeni sayfa yüklemesini tetiklemesin (hedef yerinden kaymasın).
        feedPaging[kind].quietUntil = Date.now() + 900;
        const target = feed.querySelector(`[data-message-id="${messageId}"]`);
        if (target) flashMessage(target.closest('.dm-msg-row') || target, true);
    } catch (error) {
        console.error('Mesaja gidilemedi:', error);
    }
}

// "En yeni mesajlara dön" düğmesi (akış geçmişte dururken).
function renderJumpToLatest(kind) {
    const feed = kind === 'hub' ? hubFeed : dmFeed;
    let btn = feed.parentElement.querySelector(`:scope > .jump-latest-btn[data-kind="${kind}"]`);
    const show = Boolean(feedPaging[kind]?.hasNewer);
    if (kind === 'hub' && typeof hubScrollBottomBtn !== 'undefined') updateHubScrollBottomBtn();
    if (!show) { btn?.remove(); return; }
    if (!btn) {
        btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'jump-latest-btn';
        btn.dataset.kind = kind;
        btn.textContent = `↓ ${t('search-jump-latest')}`;
        btn.addEventListener('click', () => returnToLatest(kind));
        feed.insertAdjacentElement('afterend', btn);
    }
}

async function returnToLatest(kind) {
    feedPaging[kind].hasNewer = false;
    renderJumpToLatest(kind);
    dmFeed._stickBottom = true;
    hubFeed._stickBottom = true;
    if (kind === 'hub' && currentHub) await loadHubMessages(currentHub.id);
    if (kind === 'dm' && activeDmUserId) await reloadDmMessages(activeDmUserId);
}

async function reloadDmMessages(userId) {
    try {
        const response = await fetch(`/api/dm/${userId}/messages`, { credentials: 'include' });
        const data = await response.json();
        if (!data.success || activeDmUserId !== userId) return;
        dmFeed.innerHTML = '';
        data.messages.forEach((m) => appendDmMessage(m));
        resetFeedPaging('dm', userId, data.messages, data.has_more);
    } catch (error) {
        console.error('DM mesajları alınamadı:', error);
    }
}

async function loadNewerMessages(kind) {
    const paging = feedPaging[kind];
    if (!paging.hasNewer || paging.loadingNewer || !paging.newestId) return;
    if (paging.quietUntil && Date.now() < paging.quietUntil) return;
    const feed = kind === 'hub' ? hubFeed : dmFeed;
    const key = paging.key;
    paging.loadingNewer = true;
    try {
        const url = kind === 'hub' ? `/api/hubs/${key}/messages?after=${paging.newestId}` : `/api/dm/${key}/messages?after=${paging.newestId}`;
        const data = await (await fetch(url, { credentials: 'include' })).json();
        if (feedPaging[kind] !== paging || !data.success) return;
        const append = kind === 'hub' ? appendHubMessage : appendDmMessage;
        data.messages.forEach((m) => append(m, { noScroll: true }));
        if (data.messages.length) paging.newestId = data.messages[data.messages.length - 1].id;
        paging.hasNewer = Boolean(data.has_newer);
        renderJumpToLatest(kind);
        if (!paging.hasNewer) feed._stickBottom = feed.scrollHeight - feed.scrollTop - feed.clientHeight < 80;
    } catch (error) {
        console.error('Yeni mesajlar alınamadı:', error);
    } finally {
        paging.loadingNewer = false;
    }
}

hubFeed.addEventListener('scroll', () => { if (hubFeed.scrollHeight - hubFeed.scrollTop - hubFeed.clientHeight < 160) loadNewerMessages('hub'); }, { passive: true });
dmFeed.addEventListener('scroll', () => { if (dmFeed.scrollHeight - dmFeed.scrollTop - dmFeed.clientHeight < 160) loadNewerMessages('dm'); }, { passive: true });
keepComposerFocus(document.getElementById('hub-send-btn'), document.getElementById('hub-message-input'));
keepComposerFocus(document.querySelector('#dm-form .composer-send-btn, form .composer-send-btn:not(#hub-send-btn)'), dmMessageInput);

// ─── Sayfanın en altına in butonu ─────────────────────────────────────────
const hubScrollBottomBtn = document.getElementById('hub-scroll-bottom-btn');

function isHubFeedNearBottom() {
    return hubFeed.scrollHeight - hubFeed.scrollTop - hubFeed.clientHeight < 80;
}

function updateHubScrollBottomBtn() {
    // Akış geçmişteyken (aramadan gidilmiş) yuvarlak düğme yerine "En yeni mesajlara dön" düğmesi görünür.
    hubScrollBottomBtn.style.display = isHubFeedNearBottom() || feedPaging.hub.hasNewer ? 'none' : 'flex';
}

hubFeed.addEventListener('scroll', updateHubScrollBottomBtn);

hubScrollBottomBtn.addEventListener('click', () => {
    hubFeed.scrollTo({ top: hubFeed.scrollHeight, behavior: 'smooth' });
    hubScrollBottomBtn.style.display = 'none';
});

const hubStartBtn = document.getElementById('hub-start-btn');
const hubStartMenu = document.getElementById('hub-start-menu');
const hubChatForm = document.getElementById('hub-chat-form');
const hubMessageInput = document.getElementById('hub-message-input');
const hubVoiceBtn = document.getElementById('hub-voice-btn');
wireAttachMenu('hub', async (file) => {

    const fileData = await handleAttachedFile(file);
    if (!fileData || !currentHub) return;

    try {

        const response = await fetch(`/api/hubs/${currentHub.id}/file`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ file: fileData })
        });

        const data = await response.json();
        if (!data.success) showToast(data.error || 'Gönderilemedi.');

    } catch (error) {
        console.error('Lobi dosyası gönderilemedi:', error);
        showToast('Gönderilemedi.');
    }

});

wireStickerPicker('hub', async (stickerId) => {
    if (!currentHub) return;

    try {

        const response = await fetch(`/api/hubs/${currentHub.id}/sticker`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ sticker_id: stickerId })
        });

        const data = await response.json();
        if (!data.success) showToast(data.error || 'Gönderilemedi.');

    } catch (error) {
        console.error('Lobi çıkartması gönderilemedi:', error);
        showToast('Gönderilemedi.');
    }

});

const hubMemberList = document.getElementById('hub-member-list');
const hubMembersToggleBtn = document.getElementById('hub-members-toggle-btn');
const hubDetailSide = document.getElementById('hub-detail-side');
const hubSideBackdrop = document.getElementById('hub-side-backdrop');

hubMembersToggleBtn.addEventListener('click', () => {
    hubDetailSide.classList.toggle('open');
    hubSideBackdrop.classList.toggle('open');
    hubMembersToggleBtn.classList.toggle('open');
});

hubSideBackdrop.addEventListener('click', () => {
    hubDetailSide.classList.remove('open');
    hubSideBackdrop.classList.remove('open');
    hubMembersToggleBtn.classList.remove('open');
});

const hubDeleteBtn = document.getElementById('hub-delete-btn');

const hubVoiceRoomsToggleBtn = document.getElementById('hub-voice-rooms-toggle-btn');
const hubVoiceRoomsSide = document.getElementById('hub-voice-rooms-side');
const hubVoiceRoomsBackdrop = document.getElementById('hub-voice-rooms-backdrop');
const hubVoiceRoomsList = document.getElementById('hub-voice-rooms-list');
const hubVoiceRoomAddBtn = document.getElementById('hub-voice-room-add-btn');
const hubInRoomPill = document.getElementById('hub-in-room-pill');
const hubInRoomName = document.getElementById('hub-in-room-name');

hubVoiceRoomsToggleBtn.addEventListener('click', () => {
    hubVoiceRoomsSide.classList.toggle('open');
    hubVoiceRoomsBackdrop.classList.toggle('open');
    hubVoiceRoomsToggleBtn.classList.toggle('open');
});

hubVoiceRoomsBackdrop.addEventListener('click', () => {
    hubVoiceRoomsSide.classList.remove('open');
    hubVoiceRoomsBackdrop.classList.remove('open');
    hubVoiceRoomsToggleBtn.classList.remove('open');
});

hubInRoomPill.addEventListener('click', () => {
    if (callFrame) {
        callMiniBar.style.display = 'none';
        document.body.classList.remove('call-mini-active');
        callOverlay.style.display = 'flex';
    }
});

let voiceRoomsCache = [];
let currentVoiceRoomId = null;
let currentVoiceRoomName = '';

// Sesli oda oturumu (13A): Lobi ekranından çıkılsa bile korunur; üyelik
// durumunun tek doğru kaynağı sunucudur (socket ile gelen anlık görüntü).
let currentVoiceRoomHubId = null;
let currentVoiceParticipants = []; // [{ user_id, username, muted }]
let voiceSessionConfirmed = false;
let voiceRejoining = false;
let voiceLocalMuted = false;
// Kullanıcının (ya da moderatörün) BİLEREK yaptığı sessize alma. Tarayıcının/işletim sisteminin
// mikrofonu askıya alması (arka plan, ekran kilidi, başka uygulama) bunu DEĞİŞTİRMEZ.
let voiceUserMuted = false;
// Moderatör/kurucunun bu odada koyduğu susturma (sunucudan gelir): { room_id, by_tier, expires_at|null }. Açıkken mikrofon açılamaz.
let voiceForceMute = null;
let voiceForceMuteTimer = null;
let voiceJoinStartMuted = false; // susturulmuş kullanıcı odaya mikrofon kapalı girer
// Bu çağrıda mikrofon en az bir kez çalışır durumda görüldü mü (izin reddedilmişse kurtarma denenmez).
let callMicEverLive = false;
let voiceDeafened = false; // dinleme kapalı: odadaki uzak sesler bu cihazda çalınmaz
let voiceLocalSpeaking = false;
let voiceRemoteSpeaking = new Set();
let voiceSpeakingIds = new Set();
const voiceRoomsExpanded = new Set(); // "Odadakiler" listesi açık olan oda id'leri
const voiceAvatarCache = new Map(); // userId -> avatar_data (Lobi değişse de kalır)

const hubInRoomCount = document.getElementById('hub-in-room-count');
const callMuteBtn = document.getElementById('call-mute-btn');

const knownVoicePlus = new Map();
const knownNameFx = new Map();
function nameFxOf(userId) {
    if (currentUser && userId === currentUser.id) return currentUser.name_effect || 'none';
    return knownNameFx.get(userId) || 'none';
}
function rememberVoiceAvatars() {
    (currentHub?.members || []).forEach((m) => {
        voiceAvatarCache.set(m.user_id, m.avatar_data || null);
        resolveFrame(m.user_id, m.avatar_frame);
        resolveUserColor(m.user_id, m.username, m.profile_color);
        knownVoicePlus.set(m.user_id, Boolean(m.plus_active));
        knownNameFx.set(m.user_id, m.name_effect || 'none');
    });
}
function isVoicePlus(userId) {
    if (currentUser && userId === currentUser.id) return Boolean(currentUser.plus_active);
    return knownVoicePlus.get(userId) || false;
}

function voiceAvatarInnerHtml(userId, username) {
    const avatar = voiceAvatarCache.get(userId);
    return avatar
        ? `<img src="${escapeAttr(avatar)}" alt="">`
        : escapeHtml((username || '?').charAt(0).toUpperCase());
}

// Sesli oda avatarları da kuşanılan çerçeveyi gösterir (aynı önbellek, resolveFrame üzerinden).
function voiceFrameParts(userId) {
    const frameKey = resolveFrame(userId);
    if (!frameKey || frameKey === 'classic') return { cls: '', overlay: '' };
    return { cls: ` frame-${frameKey}`, overlay: frameOverlayHtml(frameKey) };
}

const VOICE_MIC_SVG = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0"/><path d="M12 18v3"/></svg>';
const VOICE_SPK_SVG = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16.5 8.5a5 5 0 0 1 0 7"/><path d="M19 6a8.5 8.5 0 0 1 0 12"/></svg>';

// Mikrofon + hoparlör durum simgeleri. Kendi satırında (odadayken) tıklanabilir
// düğme, başkalarında yalnızca durum göstergesi. Konuşma ışığı mikrofon simgesinde.
function voiceStatusIconsHtml(p, allowSelfAction) {

    const interactive = Boolean(allowSelfAction) && p.user_id === currentUser?.id && callMode === 'hub-room';
    const tag = interactive ? 'button' : 'span';
    const attrs = (action) => interactive ? ` type="button" data-voice-action="${action}"` : '';

    return `
        <span class="voice-status">
            ${p.force_muted ? `<span class="voice-force-muted-tag" title="${escapeAttr(t('voice-force-muted-tag'))}">🔇 ${t('voice-force-muted-tag')}</span>` : ''}
            <${tag} class="voice-icon-btn${p.muted ? ' off' : ''}${interactive ? ' interactive' : ''}${p.force_muted && p.user_id === currentUser?.id ? ' locked' : ''}" data-voice-user="${p.user_id}"${attrs('mic')} title="${t('voice-mic-title')}">${VOICE_MIC_SVG}</${tag}>
            <${tag} class="voice-icon-btn${p.deafened ? ' off' : ''}${interactive ? ' interactive' : ''}"${attrs('spk')} title="${t('voice-speaker-title')}">${VOICE_SPK_SVG}</${tag}>
        </span>
    `;

}

function voiceSelfTagHtml(userId) {
    return userId === currentUser?.id ? ` <em class="voice-self-tag">${t('voice-room-you')}</em>` : '';
}

function refreshVoiceSpeaking() {
    const muted = new Set(currentVoiceParticipants.filter(p => p.muted).map(p => p.user_id));
    const next = new Set(voiceRemoteSpeaking);
    if (voiceLocalSpeaking && currentUser) next.add(currentUser.id);
    muted.forEach((id) => next.delete(id));

    voiceSpeakingIds = next;
    updateVoiceSpeakingUi();
}

function updateVoiceSpeakingUi() {
    document.querySelectorAll('[data-voice-user]').forEach((el) => {
        el.classList.toggle('speaking', voiceSpeakingIds.has(Number(el.dataset.voiceUser)));
    });
}

function updateVoiceSessionSummary() {
    const count = currentVoiceParticipants.length;
    hubInRoomCount.textContent = count ? `· ${count}` : '';

    if (callMode === 'hub-room' && callMiniBar.style.display !== 'none') {
        callMiniName.textContent = `${callHubName.textContent} · ${count}`;
    }
}

const VOICE_CTRL_ICONS = {
    mic: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>',
    micOff: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M3 3l18 18M9 9v2a3 3 0 0 0 5 2.2M15 9V6a3 3 0 0 0-5.7-1.3M5 11a7 7 0 0 0 11 5.7M19 11a7 7 0 0 1-.6 2.8M12 18v3"/></svg>'
};

function updateMuteButton() {
    callMuteBtn.innerHTML = voiceLocalMuted ? VOICE_CTRL_ICONS.micOff : VOICE_CTRL_ICONS.mic;
    const micLabel = voiceLocalMuted ? `${t('voice-mic-on')} · ${t('voice-mic-off')}` : t('voice-mic-on');
    callMuteBtn.setAttribute('aria-label', micLabel);
    callMuteBtn.title = micLabel;
    callMuteBtn.setAttribute('aria-pressed', voiceLocalMuted ? 'true' : 'false');
    callMuteBtn.classList.toggle('muted', voiceLocalMuted);
    callMuteBtn.classList.toggle('locked', Boolean(voiceForceMute));
    if (voiceForceMute) callMuteBtn.title = t('voice-muted-locked');
}


// ─── Sesli oda susturması (moderasyon) ──────────────────────────────

function voiceMuteByLabel(byTier) {
    return byTier === 'owner' ? t('voice-muted-by-owner') : t('voice-muted-by-mod');
}

function formatMuteRemaining(expiresAt) {
    const ms = Math.max(0, new Date(expiresAt).getTime() - Date.now());
    const total = Math.ceil(ms / 1000);
    const m = Math.floor(total / 60);
    const sec = total % 60;
    return `${m}:${String(sec).padStart(2, '0')}`;
}

function renderVoiceForceMuteBanner() {
    const banner = document.getElementById('call-voice-mute-banner');
    if (!banner) return;
    if (!voiceForceMute) {
        banner.style.display = 'none';
        return;
    }
    const by = voiceMuteByLabel(voiceForceMute.by_tier);
    const duration = voiceForceMute.expires_at
        ? `${t('voice-muted-remaining')}: ${formatMuteRemaining(voiceForceMute.expires_at)}`
        : t('voice-muted-until-lifted');
    document.getElementById('call-voice-mute-title').textContent = `🔇 ${t('voice-muted-title')} · ${by}`;
    document.getElementById('call-voice-mute-detail').textContent = `${duration}. ${t('voice-muted-share-note')}`;
    banner.style.display = 'block';
}

function voiceMuteNoticeText(mute) {
    const by = voiceMuteByLabel(mute.by_tier);
    const duration = mute.expires_at ? `${t('voice-muted-remaining')}: ${formatMuteRemaining(mute.expires_at)}` : t('voice-muted-until-lifted');
    return `🔇 ${by} · ${t('voice-muted-title')}. ${duration}. ${t('voice-muted-share-note')}`;
}

// Susturmayı yerel olarak uygular: mikrofon kapanır ve kilitlenir, ekran sesi kesilir, uyarı gösterilir.
// Asıl engel sunucudadır (Daily izni); bu, kullanıcının neyin neden olduğunu görmesi ve arayüzün tutarlı kalması içindir.
function applyVoiceForceMute(mute, { announce } = {}) {
    voiceForceMute = mute;
    voiceUserMuted = true;
    if (callFrame) {
        try { callFrame.setLocalAudio(false); } catch (_) { /* yoksay */ }
        try {
            if (callFrame.participants()?.local?.screen) callFrame.updateScreenShare?.({ screenAudio: { isEnabled: false } });
        } catch (_) { /* yoksay */ }
    }
    syncLocalMuteState(true);
    updateMuteButton();
    renderVoiceForceMuteBanner();
    if (voiceForceMuteTimer) clearInterval(voiceForceMuteTimer);
    if (mute.expires_at) voiceForceMuteTimer = setInterval(renderVoiceForceMuteBanner, 1000);
    if (announce) alert(voiceMuteNoticeText(mute));
}

function clearVoiceForceMute() {
    voiceForceMute = null;
    if (voiceForceMuteTimer) { clearInterval(voiceForceMuteTimer); voiceForceMuteTimer = null; }
    renderVoiceForceMuteBanner();
    updateMuteButton();
    // Mikrofon kendiliğinden AÇILMAZ; kullanıcı isterse kendisi açar.
}

// Sunucunun (oda katılımı / yeniden bağlanma) bildirdiği güncel duruma uyum.
function syncVoiceForceMuteFromServer(mute) {
    if (mute) applyVoiceForceMute(mute, { announce: !voiceForceMute });
    else if (voiceForceMute) clearVoiceForceMute();
}

// Moderatör: susturma penceresi. Oda verilirse o oda seçili gelir; verilmezse kullanıcının şu an bulunduğu oda (yoksa ilk oda).
function openVoiceMuteModal(targetId, targetName, presetRoomId, mode = 'mute') {
    if (!currentHub) return;
    const isKick = mode === 'kick';
    document.getElementById('voice-mute-modal-title').textContent = isKick ? `👢 ${t('voice-kick-action')}` : `🔇 ${t('voice-mute-action')}`;
    document.getElementById('voice-kick-now-opt').style.display = isKick ? '' : 'none';
    const modal = document.getElementById('voice-mute-modal');
    const select = document.getElementById('voice-mute-room-select');
    const error = document.getElementById('voice-mute-error');
    error.textContent = '';

    if (!voiceRoomsCache.length) {
        showToast(t('voice-mute-no-rooms'));
        return;
    }

    const currentRoom = voiceRoomsCache.find((r) => (r.participants || []).some((p) => p.user_id === targetId));
    const selectedId = presetRoomId || currentRoom?.id || voiceRoomsCache[0].id;
    select.innerHTML = voiceRoomsCache.map((r) => `<option value="${r.id}"${r.id === selectedId ? ' selected' : ''}>${escapeHtml(r.name)}</option>`).join('');
    document.getElementById('voice-mute-modal-sub').textContent = targetName || '';

    const close = () => {
        modal.style.display = 'none';
        modal.querySelectorAll('[data-mute-duration]').forEach((b) => { b.onclick = null; });
    };

    modal.querySelectorAll('[data-mute-duration]').forEach((btn) => {
        btn.onclick = async () => {
            error.textContent = '';
            try {
                const response = await fetch(`/api/hubs/${currentHub.id}/voice-rooms/${Number(select.value)}/${isKick ? 'kick' : 'mutes'}`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
                    body: JSON.stringify({ user_id: targetId, duration: btn.dataset.muteDuration })
                });
                const data = await response.json();
                if (!data.success) { error.textContent = data.error || 'İşlem başarısız.'; return; }
                close();
                showToast(isKick ? t(data.block ? 'voice-kick-blocked-done' : 'voice-kick-done') : t('voice-mute-done'));
                if (document.getElementById('hub-settings-mutes-view')?.style.display === 'flex') loadHubMutes();
                if (document.getElementById('hub-settings-blocks-view')?.style.display === 'flex') loadHubBlocks();
            } catch (_) {
                error.textContent = 'İşlem başarısız.';
            }
        };
    });

    document.getElementById('voice-mute-close-btn').onclick = close;
    modal.onclick = (event) => { if (event.target === modal) close(); };
    modal.style.display = 'flex';
}

function kickFromVoiceRoom(roomId, userId) {
    const member = (currentHub?.members || []).find((m) => m.user_id === userId);
    openVoiceMuteModal(userId, member?.username || '', roomId, 'kick');
}

async function liftVoiceBlock(roomId, userId) {
    if (!currentHub) return false;
    try {
        const response = await fetch(`/api/hubs/${currentHub.id}/voice-rooms/${roomId}/blocks/${userId}`, { method: 'DELETE', credentials: 'include' });
        const data = await response.json();
        if (!data.success) { showToast(data.error || 'İşlem başarısız.'); return false; }
        return true;
    } catch (_) {
        showToast('İşlem başarısız.');
        return false;
    }
}

let hubBlocksSearchTimer = null;

async function loadHubBlocks() {
    if (!currentHub) return;
    const container = document.getElementById('hub-settings-blocks-list');
    const q = document.getElementById('hub-blocks-search-input').value.trim();
    try {
        const response = await fetch(`/api/hubs/${currentHub.id}/voice-blocks?q=${encodeURIComponent(q)}`, { credentials: 'include' });
        const data = await response.json();
        if (!data.success) return;
        if (data.blocks.length === 0) {
            container.innerHTML = `<div class="settings-blocked-empty">${t('hub-blocks-empty')}</div>`;
            return;
        }
        container.innerHTML = data.blocks.map((b) => {
            const name = b.username || '?';
            const avatarInner = b.avatar_data ? `<img src="${escapeAttr(b.avatar_data)}" alt="">` : escapeHtml(name.charAt(0).toUpperCase());
            const duration = b.expires_at ? `${t('voice-muted-remaining')}: ${formatMuteRemaining(b.expires_at)}` : t('voice-mute-until');
            return `
                <div class="settings-blocked-row">
                    <span class="settings-blocked-avatar" style="--user-color:${getUserColor(name)};">${avatarInner}</span>
                    <span class="settings-blocked-name">${escapeHtml(name)}
                        <span class="voice-mute-row-meta">🎙 ${escapeHtml(b.room_name || '')} · ${escapeHtml(voiceMuteByLabel(b.by_tier))} · ${escapeHtml(duration)}</span>
                    </span>
                    <button class="settings-unblock-btn" data-unblock-room="${b.room_id}" data-unblock-user="${b.user_id}" type="button">${t('hub-blocks-lift')}</button>
                </div>
            `;
        }).join('');
        container.querySelectorAll('[data-unblock-user]').forEach((btn) => {
            btn.addEventListener('click', async () => {
                if (await liftVoiceBlock(Number(btn.dataset.unblockRoom), Number(btn.dataset.unblockUser))) loadHubBlocks();
            });
        });
    } catch (error) {
        console.error('Engellenenler alınamadı:', error);
    }
}

async function liftVoiceMute(roomId, userId) {
    if (!currentHub) return false;
    try {
        const response = await fetch(`/api/hubs/${currentHub.id}/voice-rooms/${roomId}/mutes/${userId}`, { method: 'DELETE', credentials: 'include' });
        const data = await response.json();
        if (!data.success) { showToast(data.error || 'İşlem başarısız.'); return false; }
        showToast(t('voice-unmute-done'));
        return true;
    } catch (_) {
        showToast('İşlem başarısız.');
        return false;
    }
}

let hubMutesSearchTimer = null;

async function loadHubMutes() {
    if (!currentHub) return;
    const container = document.getElementById('hub-settings-mutes-list');
    const q = document.getElementById('hub-mutes-search-input').value.trim();

    try {
        const response = await fetch(`/api/hubs/${currentHub.id}/voice-mutes?q=${encodeURIComponent(q)}`, { credentials: 'include' });
        const data = await response.json();
        if (!data.success) return;

        if (data.mutes.length === 0) {
            container.innerHTML = `<div class="settings-blocked-empty">${t('hub-mutes-empty')}</div>`;
            return;
        }

        container.innerHTML = data.mutes.map((m) => {
            const name = m.username || '?';
            const avatarInner = m.avatar_data ? `<img src="${escapeAttr(m.avatar_data)}" alt="">` : escapeHtml(name.charAt(0).toUpperCase());
            const duration = m.expires_at ? `${t('voice-muted-remaining')}: ${formatMuteRemaining(m.expires_at)}` : t('voice-mute-until');
            return `
                <div class="settings-blocked-row">
                    <span class="settings-blocked-avatar" style="--user-color:${getUserColor(name)};">${avatarInner}</span>
                    <span class="settings-blocked-name">${escapeHtml(name)}
                        <span class="voice-mute-row-meta">🎙 ${escapeHtml(m.room_name || '')} · ${escapeHtml(voiceMuteByLabel(m.by_tier))} · ${escapeHtml(duration)}</span>
                    </span>
                    <button class="settings-unblock-btn" data-unmute-room="${m.room_id}" data-unmute-user="${m.user_id}" type="button">${t('hub-mutes-unmute')}</button>
                </div>
            `;
        }).join('');

        container.querySelectorAll('[data-unmute-user]').forEach((btn) => {
            btn.addEventListener('click', async () => {
                if (await liftVoiceMute(Number(btn.dataset.unmuteRoom), Number(btn.dataset.unmuteUser))) loadHubMutes();
            });
        });
    } catch (error) {
        console.error('Susturulanlar alınamadı:', error);
    }
}

function syncLocalMuteState(muted) {

    if (muted === voiceLocalMuted) return;

    voiceLocalMuted = muted;
    if (muted) voiceLocalSpeaking = false;
    updateMuteButton();

    // Yerel uygulamada bildirimdeki "Sustur / Mikrofonu aç" etiketini güncel tut.
    try { getNativeVoice()?.setMuted({ muted }); } catch (_) { /* yoksay */ }

    if (voiceSessionConfirmed) socket?.emit('voice_room_mute', { muted });

    // Sunucu anlık görüntüsü gelene kadar kendi satırını hemen güncelle.
    const me = currentVoiceParticipants.find(p => p.user_id === currentUser?.id);
    if (me && me.muted !== muted) {
        me.muted = muted;
        renderHubRoomGrid(currentVoiceParticipants);
        if (currentHub) renderVoiceRoomsList();
    }

    refreshVoiceSpeaking();

}


// =====================================================
// BAS-KONUŞ (push-to-talk) — cihaz tercihi, localStorage'da
// =====================================================
const PTT_RELEASE_DELAY_MS = 250; // bırakınca son hece kesilmesin
var pttPressed = false;
var pttReleaseTimer = null;
var pttListening = false;

function pttSettings() {
    try {
        const v = JSON.parse(localStorage.getItem('sauran_ptt') || 'null');
        if (v && typeof v === 'object') return { enabled: Boolean(v.enabled), code: String(v.code || 'KeyV'), label: String(v.label || 'V'), printable: v.printable !== false };
    } catch (_) { /* yoksay */ }
    return { enabled: false, code: 'KeyV', label: 'V', printable: true };
}

function savePttSettings(next) {
    try { localStorage.setItem('sauran_ptt', JSON.stringify({ ...pttSettings(), ...next })); } catch (_) { /* yoksay */ }
}

function pttActiveInCall() {
    return pttSettings().enabled && Boolean(callFrame) && (callMode === 'hub-room' || callMode === 'dm');
}

function pttKeyLabelFor(event) {
    const special = { Space: 'Space', CapsLock: 'CapsLock', ControlLeft: 'Ctrl (sol)', ControlRight: 'Ctrl (sağ)', AltLeft: 'Alt (sol)', AltRight: 'AltGr', ShiftLeft: 'Shift (sol)', ShiftRight: 'Shift (sağ)', Backquote: '"', Tab: 'Tab' };
    if (special[event.code]) return special[event.code];
    if (/^F\d+$/.test(event.code)) return event.code;
    if (event.key && event.key.length === 1) return event.key.toLocaleUpperCase('tr');
    return event.code;
}

function renderPttCallButton() {
    const btn = document.getElementById('call-ptt-btn');
    if (!btn) return;
    const on = pttActiveInCall();
    btn.style.display = on ? 'flex' : 'none';
    if (!on) return;
    // Arama kontrolleri altta duruyorsa düğme onların hemen üstüne yerleşir (üstüne binmesin).
    const header = document.querySelector('#call-overlay .call-header');
    const overlay = document.getElementById('call-overlay');
    if (header && overlay) {
        const h = header.getBoundingClientRect();
        const o = overlay.getBoundingClientRect();
        btn.style.bottom = h.top > o.top + o.height / 2 ? `${Math.round(o.bottom - h.top + 14)}px` : '';
    }
    const s = pttSettings();
    const coarse = window.matchMedia('(pointer: coarse)').matches;
    btn.classList.toggle('active', pttPressed);
    btn.classList.toggle('locked', Boolean(voiceForceMute) && callMode === 'hub-room');
    document.getElementById('call-ptt-label').textContent = pttPressed ? t('ptt-talking') : (coarse ? t('ptt-hold') : t('ptt-hold-key').replace('{k}', s.label));
}

function pttPress() {
    if (!pttActiveInCall()) return;
    clearTimeout(pttReleaseTimer);
    pttReleaseTimer = null;
    if (pttPressed) return;
    if (voiceForceMute && callMode === 'hub-room') { showToast(t('voice-muted-locked')); return; }
    pttPressed = true;
    voiceUserMuted = false;
    try { callFrame.setLocalAudio(true); } catch (_) { /* yoksay */ }
    callMicEverLive = true;
    syncLocalMuteState(false);
    renderPttCallButton();
}

function pttRelease(immediate = false) {
    if (!pttPressed && !immediate) return;
    clearTimeout(pttReleaseTimer);
    const doRelease = () => {
        pttReleaseTimer = null;
        pttPressed = false;
        if (!callFrame) { renderPttCallButton(); return; }
        voiceUserMuted = true;
        try { callFrame.setLocalAudio(false); } catch (_) { /* yoksay */ }
        syncLocalMuteState(true);
        renderPttCallButton();
    };
    if (immediate) doRelease(); else pttReleaseTimer = setTimeout(doRelease, PTT_RELEASE_DELAY_MS);
}

// Aramaya girince (ya da bas-konuş arama sırasında açılınca) mikrofon kapalı başlar.
function pttOnCallStart() {
    pttPressed = false;
    if (pttActiveInCall()) pttRelease(true);
    renderPttCallButton();
}

function isTypingTarget(el) {
    return Boolean(el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)));
}

function pttMatches(event) {
    const s = pttSettings();
    if (event.code !== s.code) return false;
    // Harf/rakam tuşu, yazı yazılırken bas-konuşa dönüşmez.
    if (s.printable && isTypingTarget(event.target)) return false;
    return true;
}

document.addEventListener('keydown', (event) => {
    if (pttListening || !pttActiveInCall() || !pttMatches(event)) return;
    event.preventDefault();
    if (!event.repeat) pttPress();
}, true);

document.addEventListener('keyup', (event) => {
    if (pttListening || !pttActiveInCall() || event.code !== pttSettings().code) return;
    pttRelease();
}, true);

// Fare yan tuşları (Mouse4/Mouse5)
document.addEventListener('mousedown', (event) => {
    if (pttListening || !pttActiveInCall() || (event.button !== 3 && event.button !== 4)) return;
    if (pttSettings().code !== `Mouse${event.button + 1}`) return;
    event.preventDefault();
    pttPress();
}, true);
document.addEventListener('mouseup', (event) => {
    if (pttListening || !pttActiveInCall() || pttSettings().code !== `Mouse${event.button + 1}`) return;
    pttRelease();
}, true);

// Pencere odağı giderse tuş bırakılmış sayılır (keyup hiç gelmeyebilir).
window.addEventListener('blur', () => { if (pttPressed) pttRelease(true); });
document.addEventListener('visibilitychange', () => { if (document.visibilityState !== 'visible' && pttPressed) pttRelease(true); });

{
    const btn = document.getElementById('call-ptt-btn');
    btn.addEventListener('pointerdown', (event) => { event.preventDefault(); try { btn.setPointerCapture(event.pointerId); } catch (_) { /* yoksay */ } pttPress(); });
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((type) => btn.addEventListener(type, () => pttRelease()));
    btn.addEventListener('contextmenu', (event) => event.preventDefault());
}

function renderPttSettings() {
    const s = pttSettings();
    const toggle = document.getElementById('settings-ptt-toggle');
    if (!toggle) return;
    toggle.checked = s.enabled;
    document.getElementById('settings-ptt-key-row').style.display = s.enabled ? 'flex' : 'none';
    document.getElementById('settings-ptt-key-hint').style.display = s.enabled ? 'block' : 'none';
    const kbd = document.getElementById('settings-ptt-key');
    kbd.textContent = pttListening ? t('ptt-press-key') : s.label;
    kbd.classList.toggle('listening', pttListening);
}

document.getElementById('settings-ptt-toggle').addEventListener('change', (event) => {
    savePttSettings({ enabled: event.target.checked });
    renderPttSettings();
    if (callFrame && (callMode === 'hub-room' || callMode === 'dm')) {
        if (event.target.checked) {
            pttRelease(true);
        } else {
            // Kapatınca mikrofon kendiliğinden AÇILMAZ; kullanıcı mikrofon düğmesiyle açar.
            pttPressed = false;
            clearTimeout(pttReleaseTimer);
        }
        renderPttCallButton();
    }
});

document.getElementById('settings-ptt-change').addEventListener('click', () => {
    pttListening = true;
    renderPttSettings();
    const finish = (code, label, printable) => {
        pttListening = false;
        document.removeEventListener('keydown', onKey, true);
        document.removeEventListener('mousedown', onMouse, true);
        if (code) savePttSettings({ code, label, printable });
        renderPttSettings();
        renderPttCallButton();
    };
    const onKey = (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (event.code === 'Escape') { finish(null); return; }
        finish(event.code, pttKeyLabelFor(event), Boolean(event.key && event.key.length === 1 && event.code !== 'Space') || event.code === 'Space');
    };
    const onMouse = (event) => {
        if (event.button !== 3 && event.button !== 4) return;
        event.preventDefault();
        finish(`Mouse${event.button + 1}`, event.button === 3 ? 'Fare 4' : 'Fare 5', false);
    };
    setTimeout(() => {
        document.addEventListener('keydown', onKey, true);
        document.addEventListener('mousedown', onMouse, true);
    }, 0);
});

renderPttSettings();

function toggleLocalMute() {
    if (!callFrame || (callMode !== 'hub-room' && callMode !== 'dm')) return;
    if (pttSettings().enabled) {
        showToast(t('ptt-mute-hint').replace('{k}', pttSettings().label));
        return;
    }
    const nextMuted = !voiceLocalMuted;
    if (!nextMuted && voiceForceMute && callMode === 'hub-room') {
        showToast(t('voice-muted-locked'));
        return;
    }
    voiceUserMuted = nextMuted;
    callFrame.setLocalAudio(!nextMuted);
    syncLocalMuteState(nextMuted);
}

callMuteBtn.addEventListener('click', toggleLocalMute);

function applyDeafenToAudio() {
    document.querySelectorAll('audio[data-call-audio]').forEach((el) => { el.muted = voiceDeafened; });
}

function setLocalDeafened(deafened) {

    if (deafened === voiceDeafened) return;

    voiceDeafened = deafened;
    applyDeafenToAudio();
    if (typeof updateAudioControls === 'function') updateAudioControls();

    if (voiceSessionConfirmed) socket?.emit('voice_room_deafen', { deafened });

    const me = currentVoiceParticipants.find(p => p.user_id === currentUser?.id);
    if (me && me.deafened !== deafened) {
        me.deafened = deafened;
        renderHubRoomGrid(currentVoiceParticipants);
        if (currentHub) renderVoiceRoomsList();
    }

}

document.addEventListener('click', (event) => {

    const btn = event.target.closest('[data-voice-action]');
    if (!btn || callMode !== 'hub-room') return;

    event.stopPropagation();

    if (btn.dataset.voiceAction === 'mic') toggleLocalMute();
    else setLocalDeafened(!voiceDeafened);

});

function voiceUserIdForDailyParticipant(p) {
    if (!p) return null;
    const byId = Number(p.user_id);
    if (byId) return byId;
    return currentVoiceParticipants.find(x => x.username === p.user_name)?.user_id || null;
}

function wireHubRoomPresenceEvents() {

    if (!callFrame) return;

    callFrame.on('participant-updated', (event) => {
        if (!event?.participant?.local) return;

        // Uygulama arka plana alınınca / ekran kilitlenince tarayıcı yerel mikrofonu askıya alabilir
        // (Daily bunu 'interrupted' olarak bildirir). Bunu kullanıcının "sessize alması" sayıp
        // durumu susturulmuş göstermeyiz; öne dönünce mikrofon geri açılır (bkz. recoverCallMedia).
        const audioState = event.participant.tracks?.audio?.state;
        if (document.visibilityState === 'hidden' || audioState === 'interrupted') return;

        syncLocalMuteState(!callFrame.localAudio());
    });

    const useActiveSpeakerFallback = () => {
        callFrame.on('active-speaker-change', (event) => {
            const sessionId = event?.activeSpeaker?.peerId;
            const participant = Object.values(callFrame.participants()).find(p => p.session_id === sessionId);
            const userId = participant && !participant.local ? voiceUserIdForDailyParticipant(participant) : null;
            voiceRemoteSpeaking = new Set(userId ? [userId] : []);
            refreshVoiceSpeaking();
        });
    };

    try {

        callFrame.on('local-audio-level', (event) => {
            const speaking = !voiceLocalMuted && (event?.audioLevel || 0) > 0.02;
            if (speaking === voiceLocalSpeaking) return;
            voiceLocalSpeaking = speaking;
            refreshVoiceSpeaking();
        });

        callFrame.on('remote-participants-audio-level', (event) => {
            const participants = Object.values(callFrame.participants());
            const ids = new Set();

            Object.entries(event?.participantsAudioLevel || {}).forEach(([sessionId, level]) => {
                if (level <= 0.02) return;
                const userId = voiceUserIdForDailyParticipant(participants.find(p => p.session_id === sessionId));
                if (userId) ids.add(userId);
            });

            voiceRemoteSpeaking = ids;
            refreshVoiceSpeaking();
        });

        Promise.all([
            callFrame.startLocalAudioLevelObserver(250),
            callFrame.startRemoteParticipantsAudioLevelObserver(250)
        ]).catch(useActiveSpeakerFallback);

    } catch (error) {
        useActiveSpeakerFallback();
    }

}

function emitVoiceRoomJoin() {
    return new Promise((resolve) => {

        if (!socket || !socket.connected) {
            resolve({ success: false, error: 'Gerçek zamanlı bağlantı yok.' });
            return;
        }

        const timer = setTimeout(() => resolve({ success: false, error: 'Sunucu yanıt vermedi.' }), 8000);

        socket.emit(
            'voice_room_join',
            { room_id: currentVoiceRoomId, hub_id: currentVoiceRoomHubId, muted: voiceLocalMuted, deafened: voiceDeafened },
            (response) => {
                clearTimeout(timer);
                if (response?.success) syncVoiceForceMuteFromServer(response.voice_mute || null);
                resolve(response || { success: false, error: 'Odaya katılınamadı.' });
            }
        );

    });
}

function handleVoicePresenceChange(change) {

    if (!change || !voiceSessionConfirmed) return;
    if (change.type !== 'joined' && change.type !== 'left') return;
    if (change.user_id === currentUser?.id) return;

    const joined = change.type === 'joined';

    if (notifVoicePresenceEnabled && notifInappEnabled) {
        showToast(`🎙 ${change.username} ${t(joined ? 'voice-room-user-joined' : 'voice-room-user-left')}`);
    }

    playVoicePresenceSound(joined);

}

// iPhone'da Ana Ekrana eklenmiş uygulama (standalone), ekran kilitlenince / başka uygulamaya geçilince
// mikrofonu sistem düzeyinde kapatır; Safari sekmesinde bu kısıt yoktur. Kullanıcıyı bilgilendiririz.
const IOS_VOICE_HINT_KEY = 'sauran_ios_voice_hint_seen';

function isIosStandalonePwa() {
    const ua = navigator.userAgent || '';
    const isIos = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const standalone = navigator.standalone === true || Boolean(window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
    return isIos && standalone;
}

function updateIosVoiceHint() {
    const el = document.getElementById('ios-voice-hint');
    if (!el) return;

    let seen = false;
    try { seen = localStorage.getItem(IOS_VOICE_HINT_KEY) === '1'; } catch (_) { /* yoksay */ }

    el.style.display = (callMode === 'hub-room' && isIosStandalonePwa() && !seen) ? 'flex' : 'none';
}

document.getElementById('ios-voice-hint-ok').addEventListener('click', () => {
    try { localStorage.setItem(IOS_VOICE_HINT_KEY, '1'); } catch (_) { /* yoksay */ }
    updateIosVoiceHint();
});

function canShareScreen() {
    const ua = navigator.userAgent || '';
    const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(ua)
        || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    return !isMobile && Boolean(navigator.mediaDevices?.getDisplayMedia);
}

// Kurucu: kendisi dışında herkes; moderatör: yalnızca üyeler (sunucu da aynı kuralı uygular).
function canModerateVoiceTarget(userId) {
    if (!currentHub || !currentUser || userId === currentUser.id) return false;
    const myTier = currentHub.my_permission_tier;
    if (myTier !== 'owner' && myTier !== 'moderator') return false;
    const target = (currentHub.members || []).find((m) => m.user_id === userId);
    if (!target || target.permission_tier === 'owner') return false;
    return myTier === 'owner' || target.permission_tier === 'member';
}

function voiceRoomMembersHtml(room) {

    const participants = room.participants || [];
    const open = voiceRoomsExpanded.has(room.id);

    const items = participants.length === 0
        ? `<div class="hub-voice-room-members-empty">${t('voice-room-nobody-here')}</div>`
        : participants.map((p) => `
            <div class="hub-voice-room-member${p.user_id === currentUser?.id ? ' is-self' : ''}">
                <span class="hub-voice-member-avatar${voiceFrameParts(p.user_id).cls}" style="--user-color:${resolveUserColor(p.user_id, p.username)};">${voiceAvatarInnerHtml(p.user_id, p.username)}${voiceFrameParts(p.user_id).overlay}</span>
                <span class="hub-voice-member-name">${usernameCardHtml(p.username, isVoicePlus(p.user_id), nameFxOf(p.user_id))}${voiceSelfTagHtml(p.user_id)}</span>
                ${voiceStatusIconsHtml(p, true)}
                ${canModerateVoiceTarget(p.user_id) ? `<button class="voice-mod-mute-btn" type="button" data-mod-mute-user="${p.user_id}" data-mod-mute-room="${room.id}" data-mod-mute-name="${escapeAttr(p.username)}" data-mod-mute-active="${p.force_muted ? '1' : '0'}" title="${escapeAttr(p.force_muted ? t('hub-mutes-unmute') : t('voice-mute-action'))}">${p.force_muted ? '🔈' : '🔇'}</button><button class="voice-mod-mute-btn" type="button" data-mod-kick-user="${p.user_id}" data-mod-kick-room="${room.id}" title="${escapeAttr(t('voice-kick-action'))}">👢</button>` : ''}
            </div>
        `).join('');

    return `
        <div class="hub-voice-room-members-wrap${open ? ' open' : ''}" data-members-of="${room.id}">
            <div class="hub-voice-room-members"><div class="hub-voice-room-members-list">${items}</div></div>
        </div>
    `;

}

async function loadVoiceRooms(hubId) {

    try {

        const response = await fetch(`/api/hubs/${hubId}/voice-rooms`, { credentials: 'include' });
        const data = await response.json();
        if (!data.success) return;

        voiceRoomsCache = data.rooms;
        renderVoiceRoomsList();

    } catch (error) {
        console.error('Sesli odalar alınamadı:', error);
    }

}

function renderVoiceRoomsList() {

    rememberVoiceAvatars();

    hubVoiceRoomAddBtn.style.display = currentHub?.is_owner ? 'block' : 'none';

    const anyActive = voiceRoomsCache.some(r => r.participants && r.participants.length > 0);
    hubVoiceRoomsToggleBtn.classList.toggle('has-active', anyActive);

    if (voiceRoomsCache.length === 0) {
        hubVoiceRoomsList.innerHTML = `<div class="users-list-empty">${t('voice-rooms-empty')}</div>`;
        return;
    }

    hubVoiceRoomsList.innerHTML = voiceRoomsCache.map((room) => {
        const isActive = room.id === currentVoiceRoomId;
        const count = room.participants?.length || 0;
        return `
            <div class="hub-voice-room-row ${isActive ? 'active' : ''}" data-room-id="${room.id}">
                <span class="hub-voice-room-icon">${isActive ? '🔊' : '🔈'}</span>
                <div class="hub-voice-room-info">
                    <div class="hub-voice-room-name">${escapeHtml(room.name)}</div>
                    <button class="hub-voice-room-toggle${voiceRoomsExpanded.has(room.id) ? ' open' : ''}" data-toggle-members="${room.id}" type="button" aria-expanded="${voiceRoomsExpanded.has(room.id)}">
                        <span>${t('voice-room-members-btn')}</span>
                        <span class="hub-voice-room-chevron">▸</span>
                    </button>
                </div>
                <div class="hub-voice-room-side">
                    ${currentHub?.is_owner ? `<button class="hub-voice-room-delete" data-delete-room="${room.id}" type="button" title="${t('delete')}">🗑</button>` : ''}
                    <div class="hub-voice-room-count">${count} ${t('member-count')}</div>
                </div>
            </div>
            ${voiceRoomMembersHtml(room)}
            ${isActive ? `<button class="hub-voice-room-leave-btn" data-leave-room="${room.id}" type="button">🚪 ${t('call-leave')}</button>` : ''}
        `;
    }).join('');

    hubVoiceRoomsList.querySelectorAll('[data-toggle-members]').forEach((btn) => {
        btn.addEventListener('click', (event) => {
            event.stopPropagation();
            const roomId = Number(btn.dataset.toggleMembers);
            const open = !voiceRoomsExpanded.has(roomId);

            if (open) voiceRoomsExpanded.add(roomId);
            else voiceRoomsExpanded.delete(roomId);

            btn.classList.toggle('open', open);
            btn.setAttribute('aria-expanded', String(open));
            hubVoiceRoomsList.querySelector(`[data-members-of="${roomId}"]`)?.classList.toggle('open', open);
        });
    });

    hubVoiceRoomsList.querySelectorAll('.hub-voice-room-row').forEach((row) => {
        row.addEventListener('click', (event) => {
            if (event.target.closest('[data-delete-room]')) return;
            const roomId = Number(row.dataset.roomId);
            const room = voiceRoomsCache.find(r => r.id === roomId);
            if (!room) return;

            // Zaten bu odadaysa hiçbir şey yapma — mevcut bağlantı bozulmasın.
            if (currentVoiceRoomId === roomId) return;

            openVoiceRoomPreview(room);
        });
    });

    hubVoiceRoomsList.querySelectorAll('[data-delete-room]').forEach((btn) => {
        btn.addEventListener('click', async (event) => {
            event.stopPropagation();
            const roomId = Number(btn.dataset.deleteRoom);
            if (!confirm(t('voice-room-delete-confirm'))) return;

            await fetch(`/api/hubs/${currentHub.id}/voice-rooms/${roomId}`, { method: 'DELETE', credentials: 'include' });
        });
    });

    hubVoiceRoomsList.querySelectorAll('[data-mod-mute-user]').forEach((btn) => {
        btn.addEventListener('click', async (event) => {
            event.stopPropagation();
            const userId = Number(btn.dataset.modMuteUser);
            const roomId = Number(btn.dataset.modMuteRoom);
            if (btn.dataset.modMuteActive === '1') {
                if (confirm(t('voice-unmute-confirm'))) await liftVoiceMute(roomId, userId);
                return;
            }
            openVoiceMuteModal(userId, btn.dataset.modMuteName, roomId);
        });
    });

    hubVoiceRoomsList.querySelectorAll('[data-mod-kick-user]').forEach((btn) => {
        btn.addEventListener('click', (event) => {
            event.stopPropagation();
            kickFromVoiceRoom(Number(btn.dataset.modKickRoom), Number(btn.dataset.modKickUser));
        });
    });

    hubVoiceRoomsList.querySelectorAll('[data-leave-room]').forEach((btn) => {
        btn.addEventListener('click', (event) => {
            event.stopPropagation();
            leaveCall();
        });
    });

}

hubVoiceRoomAddBtn.addEventListener('click', async () => {

    const name = prompt(t('voice-room-name-prompt'));
    if (!name || !name.trim()) return;

    try {

        const response = await fetch(`/api/hubs/${currentHub.id}/voice-rooms`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ name: name.trim() })
        });

        const data = await response.json();
        if (!data.success) showToast(data.error || 'Oda oluşturulamadı.');

    } catch (error) {
        console.error('Sesli oda oluşturulamadı:', error);
    }

});

const voiceRoomPreviewModal = document.getElementById('voice-room-preview-modal');
const voiceRoomPreviewTitle = document.getElementById('voice-room-preview-title');
const voiceRoomPreviewList = document.getElementById('voice-room-preview-list');
const voiceRoomPreviewJoinBtn = document.getElementById('voice-room-preview-join-btn');
const voiceRoomPreviewCloseBtn = document.getElementById('voice-room-preview-close-btn');

let pendingVoiceRoomId = null;

function openVoiceRoomPreview(room) {

    pendingVoiceRoomId = room.id;
    voiceRoomPreviewTitle.textContent = `🎙 ${room.name}`;
    renderVoiceRoomPreviewList(room);
    voiceRoomPreviewModal.style.display = 'flex';

}

function renderVoiceRoomPreviewList(room) {

    rememberVoiceAvatars();

    const participants = room.participants || [];

    if (participants.length === 0) {
        voiceRoomPreviewList.innerHTML = `<div class="voice-room-preview-empty">${t('voice-room-nobody-here')}</div>`;
        return;
    }

    voiceRoomPreviewList.innerHTML = participants.map((p) => `
        <div class="voice-room-preview-person">
            <span class="voice-room-preview-avatar${voiceFrameParts(p.user_id).cls}" style="--user-color:${resolveUserColor(p.user_id, p.username)};">${voiceAvatarInnerHtml(p.user_id, p.username)}${voiceFrameParts(p.user_id).overlay}</span>
            <span class="voice-room-preview-name">${usernameCardHtml(p.username, isVoicePlus(p.user_id), nameFxOf(p.user_id))}</span>
            ${voiceStatusIconsHtml(p, false)}
        </div>
    `).join('');

}

voiceRoomPreviewCloseBtn.addEventListener('click', () => {
    voiceRoomPreviewModal.style.display = 'none';
    pendingVoiceRoomId = null;
});

voiceRoomPreviewModal.addEventListener('click', (event) => {
    if (event.target === voiceRoomPreviewModal) {
        voiceRoomPreviewModal.style.display = 'none';
        pendingVoiceRoomId = null;
    }
});

voiceRoomPreviewJoinBtn.addEventListener('click', () => {
    const room = voiceRoomsCache.find(r => r.id === pendingVoiceRoomId);
    voiceRoomPreviewModal.style.display = 'none';
    pendingVoiceRoomId = null;
    if (room) joinVoiceRoom(room);
});

async function joinVoiceRoom(room) {

    if (callFrame) leaveCall();

    try {

        const response = await fetch(`/api/hubs/${currentHub.id}/voice-rooms/${room.id}/join`, {
            method: 'POST',
            credentials: 'include'
        });

        const data = await response.json();

        if (!data.success) {
            alert(data.error || 'Sesli odaya katılınamadı.');
            return;
        }

        callMode = 'hub-room';
        voiceJoinStartMuted = Boolean(data.voice_mute);
        currentVoiceRoomId = room.id;
        currentVoiceRoomHubId = currentHub.id;
        currentVoiceRoomName = room.name;
        voiceSessionConfirmed = false;
        voiceRejoining = false;
        voiceLocalMuted = false;
        voiceUserMuted = false;
        callMicEverLive = false;
        voiceDeafened = false;
        voiceLocalSpeaking = false;
        voiceRemoteSpeaking = new Set();
        callHubName.textContent = `🎙️ ${room.name}`;
        callScreenshareBtn.style.display = canShareScreen() ? 'inline-block' : 'none';
        callMuteBtn.style.display = 'inline-block';
        updateMuteButton();

        callFrameContainer.style.display = 'none';
        document.getElementById('call-hub-room-view').style.display = 'flex';
        updateIosVoiceHint();

        // Sunucu onaylayana kadar geçici görünüm: mevcut liste + ben.
        currentVoiceParticipants = [
            ...(room.participants || []).filter(p => p.user_id !== currentUser.id),
            { user_id: currentUser.id, username: currentUser.username, muted: false }
        ];
        renderHubRoomGrid(currentVoiceParticipants);

        await joinCallFrame(data.room_url, data.token);
        wireHubRoomScreenshareEvents();
        wireHubRoomPresenceEvents();

        voiceLocalMuted = !callFrame.localAudio();
        callMicEverLive = Boolean(callFrame.localAudio());
        updateMuteButton();

        const ack = await emitVoiceRoomJoin();

        if (!ack.success) {
            const failure = new Error('voice-presence');
            failure.presenceError = ack.error;
            throw failure;
        }

        voiceSessionConfirmed = true;
        currentVoiceParticipants = ack.participants;
        renderHubRoomGrid(currentVoiceParticipants);
        voiceJoinStartMuted = false;

        hubInRoomPill.style.display = 'flex';
        hubInRoomName.textContent = room.name;
        updateVoiceSessionSummary();

        renderVoiceRoomsList();

    } catch (error) {
        console.error('Sesli odaya katılınamadı:', error);
        alert(error?.presenceError || 'Sesli odaya katılınamadı.');
        leaveCall();
    }

}


function renderHubRoomGrid(participants) {

    rememberVoiceAvatars();

    const grid = document.getElementById('call-hub-room-grid');

    grid.innerHTML = (participants || []).map((p) => `
        <div class="call-hub-room-person${p.user_id === currentUser?.id ? ' is-self' : ''}${isVoicePlus(p.user_id) ? ' plus-voice' : ''}">
            <span class="call-hub-room-avatar${voiceFrameParts(p.user_id).cls}" style="--user-color:${resolveUserColor(p.user_id, p.username)};">${voiceAvatarInnerHtml(p.user_id, p.username)}${voiceFrameParts(p.user_id).overlay}</span>
            <span class="call-hub-room-name">${usernameCardHtml(p.username, isVoicePlus(p.user_id), nameFxOf(p.user_id))}</span>
            ${p.user_id === currentUser?.id ? `<span class="voice-self-tag">${t('voice-room-you')}</span>` : ''}
            ${p.user_id === currentUser?.id ? '' /* görüşme ekranında kendi kartında düğme yok (mikrofon alt çubukta); yan paneldeki liste düğmeleri korunur */ : voiceStatusIconsHtml(p, true)}
        </div>
    `).join('');

    updateVoiceSpeakingUi();

}


// ─── Ekran paylaşımı: banner + "İzle" akışı (sadece hub sesli odalarında) ──

let screensharingSessionId = null;
let screensharingUsername = '';

function wireHubRoomScreenshareEvents() {

    if (!callFrame) return;

    callFrame.on('participant-updated', (event) => {

        const p = event?.participant;
        if (!p || p.local) return;

        const sharing = p.tracks?.screenVideo?.state === 'playable';

        if (sharing && screensharingSessionId !== p.session_id) {
            screensharingSessionId = p.session_id;
            // Ad Daily'den değil (orada yalnızca sayısal kimlik var), Socket.io katılımcı listemizden çözülür.
            screensharingUsername = currentVoiceParticipants.find(x => x.user_id === Number(p.user_id))?.username || '';
            showScreenshareBanner(screensharingUsername);
        } else if (!sharing && screensharingSessionId === p.session_id) {
            screensharingSessionId = null;
            screensharingUsername = '';
            hideScreenshareBanner();
            closeScreenshareViewer();
        }

    });

    callFrame.on('participant-left', (event) => {
        if (event?.participant?.session_id === screensharingSessionId) {
            screensharingSessionId = null;
            screensharingUsername = '';
            hideScreenshareBanner();
            closeScreenshareViewer();
        }
    });

}

function showScreenshareBanner(username) {
    const banner = document.getElementById('call-hub-room-screenshare-banner');
    document.getElementById('call-hub-room-screenshare-text').textContent = `🖥️ ${username} ${t('screensharing-active')}`;
    banner.style.display = 'flex';
}

function hideScreenshareBanner() {
    document.getElementById('call-hub-room-screenshare-banner').style.display = 'none';
}

document.getElementById('call-hub-room-watch-btn').addEventListener('click', () => {

    if (!callFrame || !screensharingSessionId) return;

    const participants = callFrame.participants();
    const participant = Object.values(participants).find(p => p.session_id === screensharingSessionId);
    const track = participant?.tracks?.screenVideo?.persistentTrack;

    if (!track) return;

    const video = document.getElementById('call-screenshare-video');
    video.srcObject = new MediaStream([track]);

    const viewer = document.getElementById('call-screenshare-viewer');
    viewer.className = 'call-screenshare-viewer corner-tr';
    viewer.style.display = 'block';
    startScreenshareFpsMeter(video, viewer);

    watchedScreenshareSessionId = screensharingSessionId;
    attachWatchedScreenAudio();

});

// İzleyici penceresinde ölçülen gerçek FPS'i gösterir (paylaşan tarafın seçimini izleyen bilmez, ölçüm her zaman açık).
let fpsMeterStop = null;
function startScreenshareFpsMeter(video, viewer) {
    if (fpsMeterStop) fpsMeterStop();
    let badge = viewer.querySelector('.screenshare-fps-badge');
    if (typeof video.requestVideoFrameCallback !== 'function') {
        if (badge) badge.remove();
        return;
    }
    if (!badge) {
        badge = document.createElement('span');
        badge.className = 'screenshare-fps-badge';
        viewer.appendChild(badge);
    }
    let frames = 0;
    let stopped = false;
    const onFrame = () => { if (stopped) return; frames += 1; video.requestVideoFrameCallback(onFrame); };
    video.requestVideoFrameCallback(onFrame);
    const timer = setInterval(() => { badge.textContent = `≈ ${frames} FPS`; frames = 0; }, 1000);
    fpsMeterStop = () => { stopped = true; clearInterval(timer); badge.remove(); fpsMeterStop = null; };
}

function closeScreenshareViewer() {
    if (fpsMeterStop) fpsMeterStop();
    const viewer = document.getElementById('call-screenshare-viewer');
    const video = document.getElementById('call-screenshare-video');
    if (currentFullscreenElement() === viewer) (document.exitFullscreen || document.webkitExitFullscreen)?.call(document);
    if (video.webkitDisplayingFullscreen) video.webkitExitFullscreen?.();
    viewer.classList.remove('fullscreen-mode', 'pseudo-fullscreen');
    viewer.style.display = 'none';
    video.srcObject = null;
    watchedScreenshareSessionId = null;
    detachWatchedScreenAudio();
}

document.getElementById('call-screenshare-close-btn').addEventListener('click', closeScreenshareViewer);

document.querySelectorAll('.call-screenshare-viewer-controls [data-corner]').forEach((btn) => {
    btn.addEventListener('click', () => {
        const viewer = document.getElementById('call-screenshare-viewer');
        viewer.classList.remove('corner-tl', 'corner-tr', 'corner-bl', 'corner-br', 'fullscreen-mode', 'pseudo-fullscreen');
        viewer.classList.add(`corner-${btn.dataset.corner}`);
    });
});

// Tam ekran: iPhone Safari'de Element.requestFullscreen yoktur; orada yalnızca <video>'nun
// yerel oynatıcısı (webkitEnterFullscreen) tam ekran olabilir. Sırayla dener, hiçbiri yoksa
// CSS ile sayfayı kaplayan "sahte tam ekran"a düşer.
function currentFullscreenElement() {
    return document.fullscreenElement || document.webkitFullscreenElement || null;
}

function toggleScreenshareFullscreen() {
    const viewer = document.getElementById('call-screenshare-viewer');
    const video = document.getElementById('call-screenshare-video');

    // Açıksa kapat (gerçek ya da CSS tam ekran)
    if (currentFullscreenElement() === viewer) {
        (document.exitFullscreen || document.webkitExitFullscreen)?.call(document);
        return;
    }
    if (viewer.classList.contains('fullscreen-mode')) {
        viewer.classList.remove('fullscreen-mode', 'pseudo-fullscreen');
        return;
    }

    // 1) Standart / WebKit öğe tam ekranı (masaüstü, Android, iPad)
    const req = viewer.requestFullscreen || viewer.webkitRequestFullscreen;
    if (req) {
        try {
            const p = req.call(viewer);
            if (p && typeof p.catch === 'function') p.catch(() => enterVideoOrPseudoFullscreen(viewer, video));
            return;
        } catch (_) { /* aşağıdaki yedeklere geç */ }
    }
    enterVideoOrPseudoFullscreen(viewer, video);
}

function enterVideoOrPseudoFullscreen(viewer, video) {
    // 2) iPhone: video'nun yerel tam ekran oynatıcısı
    if (typeof video.webkitEnterFullscreen === 'function' && video.webkitSupportsFullscreen !== false) {
        try {
            video.webkitEnterFullscreen();
            return;
        } catch (_) { /* CSS yedeğine geç */ }
    }
    // 3) Son çare: CSS ile ekranı kapla
    viewer.classList.add('fullscreen-mode', 'pseudo-fullscreen');
}

document.getElementById('call-screenshare-fullscreen-btn').addEventListener('click', toggleScreenshareFullscreen);

function syncScreenshareFullscreenClass() {
    const viewer = document.getElementById('call-screenshare-viewer');
    if (viewer.classList.contains('pseudo-fullscreen')) return;
    viewer.classList.toggle('fullscreen-mode', currentFullscreenElement() === viewer);
}
document.addEventListener('fullscreenchange', syncScreenshareFullscreenClass);
document.addEventListener('webkitfullscreenchange', syncScreenshareFullscreenClass);

// iOS yerel oynatıcıdan "Bitti" ile çıkınca videoyu duraklatır; canlı yayın donmasın diye yeniden oynat.
document.getElementById('call-screenshare-video').addEventListener('webkitendfullscreen', (e) => {
    const video = e.currentTarget;
    if (video.srcObject) video.play?.().catch(() => {});
});


const hubSettingsOpenBtn = document.getElementById('hub-settings-open-btn');
const hubSettingsModal = document.getElementById('hub-settings-modal');
const hubSettingsCloseBtn = document.getElementById('hub-settings-close-btn');
const hubSettingsImagePreview = document.getElementById('hub-settings-image-preview');
const hubSettingsImageBtn = document.getElementById('hub-settings-image-btn');
const hubSettingsImageInput = document.getElementById('hub-settings-image-input');
const hubSettingsNameInput = document.getElementById('hub-settings-name-input');
const hubSettingsError = document.getElementById('hub-settings-error');
const hubSettingsSaveBtn = document.getElementById('hub-settings-save-btn');

let hubSettingsNewImageData = undefined;
let hubSettingsTheme = 'default';
let hubSettingsBgImage = undefined; // undefined = değişmedi, null = kaldır, string = yeni görsel

function renderHubBgControls() {
    const preview = document.getElementById('hubset-bg-preview');
    if (!preview || !currentHub) return;
    const allowed = userHasFeature('lobby_image');
    const shown = hubSettingsBgImage === undefined ? currentHub.bg_image : hubSettingsBgImage;
    preview.style.backgroundImage = shown ? cssImageUrl(shown) : '';
    document.getElementById('hubset-bg-pick-btn').disabled = !allowed;
    document.getElementById('hubset-bg-clear-btn').disabled = !allowed || !shown;
    document.getElementById('hubset-bg-hint').textContent = allowed ? '' : 'Lobi arka planı Sauran Plus abonelerine açıktır.';
}

document.getElementById('hubset-bg-pick-btn')?.addEventListener('click', () => document.getElementById('hubset-bg-input').click());
document.getElementById('hubset-bg-clear-btn')?.addEventListener('click', () => { hubSettingsBgImage = null; renderHubBgControls(); });
document.getElementById('hubset-bg-input')?.addEventListener('change', async (event) => {
    const file = event.target.files[0];
    event.target.value = '';
    if (!file) return;
    try {
        const dataUrl = await openImageCropper(file, { aspect: 16 / 9, outWidth: 960, title: 'Lobi Arka Planını Kırp' });
        if (!dataUrl) return;
        hubSettingsBgImage = dataUrl;
        renderHubBgControls();
    } catch (error) {
        console.error('Arka plan işlenemedi:', error);
        showToast('Görsel işlenemedi.');
    }
});

function renderHubThemePicker() {
    const block = document.getElementById('hubset-theme-block');
    if (!block || !currentHub) return;
    block.style.display = currentHub.is_owner ? '' : 'none';
    const isPlus = userHasFeature('lobby_theme');
    document.querySelectorAll('#hubset-theme-picker .chat-theme-option').forEach((btn) => {
        const theme = btn.dataset.hubTheme;
        btn.disabled = theme !== 'default' && !isPlus;
        btn.classList.toggle('selected', theme === hubSettingsTheme);
        btn.title = btn.disabled ? 'Sauran Plus gerekli' : '';
    });
    document.getElementById('hubset-theme-hint').textContent = isPlus ? '' : 'Lobi temaları Sauran Plus abonelerine açıktır.';
}

document.getElementById('hubset-theme-picker')?.addEventListener('click', (event) => {
    const btn = event.target.closest('.chat-theme-option');
    if (!btn || btn.disabled) return;
    hubSettingsTheme = btn.dataset.hubTheme;
    renderHubThemePicker();
});

hubSettingsOpenBtn.addEventListener('click', () => {

    if (!currentHub) return;

    hubSettingsNewImageData = undefined;
    hubSettingsTheme = currentHub.theme || 'default';
    hubSettingsBgImage = undefined;
    renderHubThemePicker();
    renderHubBgControls();
    hubSettingsNameInput.value = currentHub.name || '';
    hubSettingsError.textContent = '';

    if (currentHub.image_data) {
        hubSettingsImagePreview.style.backgroundImage = cssImageUrl(currentHub.image_data);
        hubSettingsImagePreview.classList.remove('hub-icon-initial');
        hubSettingsImagePreview.innerHTML = '';
    } else {
        hubSettingsImagePreview.style.backgroundImage = '';
        hubSettingsImagePreview.classList.add('hub-icon-initial');
        hubSettingsImagePreview.innerHTML = hubInitialHtml(currentHub.name);
    }

    const isOwner = !!currentHub.is_owner;
    populateHubDiscoverSettings(isOwner);
    hubSettingsNameInput.disabled = !isOwner;
    hubSettingsImageBtn.disabled = !isOwner;
    document.getElementById('hubset-everyone').value = currentHub.mention_everyone || 'owner';
    document.getElementById('hubset-slowmode').value = String(currentHub.slow_mode_seconds || 0);
    fillWordFilterCard();

    const canModerate = currentHub.my_permission_tier === 'owner' || currentHub.my_permission_tier === 'moderator';
    document.getElementById('hub-settings-bans-section').style.display = canModerate ? 'flex' : 'none';
    document.getElementById('hub-clear-chat-btn').style.display = canModerate ? 'flex' : 'none';
    document.getElementById('hub-delete-btn').style.display = isOwner ? 'flex' : 'none';
    document.getElementById('hubset-danger-zone').style.display = canModerate ? 'flex' : 'none';
    document.getElementById('hub-ban-member-btn').style.display = canModerate ? 'inline-flex' : 'none';

    // Bölümler role göre: kurucu hepsini görür; moderatör moderasyon/davet/diğer (+ istekler); üye davet/diğer.
    const hasRequests = typeof currentHub.pending_join_requests === 'number';
    hubsetAllowed = {
        general: isOwner,
        visibility: isOwner || hasRequests,
        permissions: isOwner,
        invite: true,
        moderation: canModerate,
        other: true
    };
    document.querySelectorAll('#hubset-nav [data-hubset-section]').forEach((btn) => {
        btn.style.display = hubsetAllowed[btn.dataset.hubsetSection] ? '' : 'none';
    });
    document.getElementById('hubset-title').textContent = currentHub.name || '';
    const icon = document.getElementById('hubset-topbar-icon');
    icon.innerHTML = currentHub.image_data ? `<img src="${escapeAttr(currentHub.image_data)}" alt="">` : hubInitialHtml(currentHub.name);

    hubSettingsModal.style.display = 'flex';
    document.body.classList.add('hubset-open');
    showHubsetSection(isOwner ? 'general' : canModerate ? 'moderation' : 'invite');

});

// ─── Lobi ayarları: tam ekran, bölümlü pencere ───
let hubsetAllowed = {};
let hubsetCurrent = 'general';
const HUBSET_SAVE_SECTIONS = ['general', 'visibility', 'permissions'];

function showHubsetSection(section) {
    if (!hubsetAllowed[section]) section = Object.keys(hubsetAllowed).find((k) => hubsetAllowed[k]) || 'invite';
    hubsetCurrent = section;
    document.querySelectorAll('#hub-settings-modal [data-hubset-panel]').forEach((panel) => {
        panel.style.display = panel.dataset.hubsetPanel === section ? 'flex' : 'none';
    });
    document.querySelectorAll('#hubset-nav [data-hubset-section]').forEach((btn) => {
        const active = btn.dataset.hubsetSection === section;
        btn.classList.toggle('active', active);
        btn.setAttribute('aria-current', active ? 'page' : 'false');
        if (active) btn.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    });
    // Kaydet çubuğu yalnızca kurucunun düzenleyebildiği bölümlerde görünür.
    const saveVisible = Boolean(currentHub?.is_owner) && HUBSET_SAVE_SECTIONS.includes(section);
    document.getElementById('hubset-savebar').style.display = saveVisible ? 'flex' : 'none';
    document.getElementById('hubset-content').scrollTop = 0;
    if (section === 'moderation') showHubSettingsView('bans');
    if (section === 'invite') loadHubInvites();
}

// Moderasyon alt sekmeleri (eski "görünüm" adlarıyla uyumlu): pick | bans | mutes | blocks. 'main' genel bölüme döner.
function showHubSettingsView(view) {
    if (view === 'main') { showHubsetSection(Object.keys(hubsetAllowed).find((k) => hubsetAllowed[k]) || 'invite'); return; }
    if (hubsetCurrent !== 'moderation') {
        hubsetCurrent = 'moderation';
        showHubsetSection('moderation');
    }
    ['pick', 'bans', 'mutes', 'blocks', 'modlog'].forEach((v) => {
        document.getElementById(`hub-settings-${v}-view`).style.display = v === view ? 'flex' : 'none';
    });
    document.querySelectorAll('#hub-settings-bans-section [data-hubset-tab]').forEach((tab) => {
        const active = tab.dataset.hubsetTab === view;
        tab.classList.toggle('active', active);
        tab.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    if (view === 'bans') loadHubBans();
}

function closeHubSettings() {
    hubSettingsModal.style.display = 'none';
    document.body.classList.remove('hubset-open');
}

document.getElementById('hubset-nav').addEventListener('click', (event) => {
    const btn = event.target.closest('[data-hubset-section]');
    if (btn) showHubsetSection(btn.dataset.hubsetSection);
});

document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && hubSettingsModal.style.display === 'flex') closeHubSettings();
});

document.getElementById('hub-clear-chat-btn').addEventListener('click', async () => {

    if (!currentHub) return;
    if (!confirm(t('hub-clear-chat-confirm'))) return;

    try {

        const response = await fetch(`/api/hubs/${currentHub.id}/messages`, { method: 'DELETE', credentials: 'include' });
        const data = await response.json();

        if (!data.success) {
            showToast(data.error || 'Sohbet temizlenemedi.');
            return;
        }

        hubSettingsModal.style.display = 'none';

    } catch (error) {
        console.error('Lobi sohbeti temizlenemedi:', error);
        showToast('Sohbet temizlenemedi.');
    }

});


// =====================================================
// MODERASYON KAYDI (lobi ayarları → Moderasyon → Kayıt)
// =====================================================
const MODLOG_ACTIONS = {
    member_kick: ['👢', 'Lobiden atıldı', 'Kicked from lobby'],
    member_ban: ['⛔', 'Lobiden yasaklandı', 'Banned from lobby'],
    member_unban: ['✅', 'Yasak kaldırıldı', 'Ban lifted'],
    mod_add: ['🛡️', 'Moderatör yapıldı', 'Made moderator'],
    mod_remove: ['🔻', 'Moderatörlük alındı', 'Moderator removed'],
    join_approve: ['🟢', 'Katılma isteği onaylandı', 'Join request approved'],
    join_reject: ['🔴', 'Katılma isteği reddedildi', 'Join request declined'],
    voice_mute: ['🔇', 'Sesli odada susturuldu', 'Muted in voice room'],
    voice_unmute: ['🔈', 'Susturma kaldırıldı', 'Mute lifted'],
    voice_kick: ['🚪', 'Sesli odadan atıldı', 'Kicked from voice room'],
    voice_unblock: ['🔓', 'Oda engeli kaldırıldı', 'Room block lifted'],
    voice_room_create: ['➕', 'Sesli oda açıldı', 'Voice room created'],
    voice_room_delete: ['🗑️', 'Sesli oda silindi', 'Voice room deleted'],
    chat_clear: ['🧹', 'Sohbet temizlendi', 'Chat cleared'],
    slow_mode: ['🐢', 'Yavaş mod değişti', 'Slow mode changed'],
    word_filter: ['🚫', 'Kelime filtresi güncellendi', 'Word filter updated'],
    hub_update: ['⚙️', 'Lobi ayarları değişti', 'Lobby settings changed'],
    invite_revoke: ['🔑', 'Davet kodu iptal edildi', 'Invite code revoked']
};
var modlogBefore = null;
var modlogSearchTimer = null;

function modlogIsEn() {
    try { return localStorage.getItem('sauran_lang') === 'en'; } catch (_) { return false; }
}

function modlogDuration(d) {
    const en = modlogIsEn();
    if (d === 'now') return en ? 'instant (can rejoin)' : 'anlık (geri girebilir)';
    if (d === 'until_lifted') return en ? 'until lifted' : 'kaldırılana kadar';
    if (/^\d+$/.test(String(d || ''))) return en ? `${d} min` : `${d} dk`;
    return '';
}

function modlogTime(value) {
    const date = serverDate(value);
    const diff = (Date.now() - date.getTime()) / 1000;
    const en = modlogIsEn();
    if (diff < 60) return en ? 'just now' : 'az önce';
    if (diff < 3600) return en ? `${Math.floor(diff / 60)} min ago` : `${Math.floor(diff / 60)} dk önce`;
    if (diff < 86400) return en ? `${Math.floor(diff / 3600)} h ago` : `${Math.floor(diff / 3600)} sa önce`;
    return date.toLocaleString(en ? 'en-GB' : 'tr-TR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function modlogDetails(entry) {
    const d = entry.details || {};
    const en = modlogIsEn();
    const parts = [];
    if (d.room_name) parts.push(`${en ? 'Room' : 'Oda'}: ${escapeHtml(d.room_name)}`);
    if (d.duration) parts.push(escapeHtml(modlogDuration(d.duration)));
    if (entry.action === 'slow_mode') parts.push(Number(d.seconds) ? escapeHtml(formatSlowDuration(d.seconds)) : (en ? 'off' : 'kapatıldı'));
    if (entry.action === 'word_filter') {
        const mode = { off: en ? 'off' : 'kapalı', mask: en ? 'hide words' : 'kelimeyi gizle', block: en ? 'block message' : 'mesajı engelle' }[d.action] || '';
        parts.push(escapeHtml(mode));
        if (d.use_preset) parts.push(en ? 'built-in list' : 'hazır liste');
        if (d.count) parts.push(en ? `${Number(d.count)} words` : `${Number(d.count)} kelime`);
    }
    if (entry.action === 'hub_update' && Array.isArray(d.fields)) {
        const names = { name: en ? 'name' : 'ad', image: en ? 'image' : 'görsel', theme: en ? 'theme' : 'tema', background: en ? 'background' : 'arka plan', mention_everyone: '@everyone', visibility: en ? 'visibility & joining' : 'görünürlük ve katılım', discover: en ? 'discover info' : 'keşfet bilgileri' };
        parts.push(d.fields.map((f) => escapeHtml(names[f] || f)).join(', '));
        if (d.name) parts.push(`“${escapeHtml(d.name)}”`);
    }
    return parts;
}

function renderModlogEntry(entry) {
    const def = MODLOG_ACTIONS[entry.action] || ['•', entry.action, entry.action];
    const en = modlogIsEn();
    const deleted = en ? 'deleted account' : 'silinmiş hesap';
    const actor = entry.actor ? `<b>${escapeHtml(entry.actor.username || deleted)}</b>` : `<b>${deleted}</b>`;
    const target = entry.target ? ` → <b>${escapeHtml(entry.target.username || deleted)}</b>` : '';
    const extra = modlogDetails(entry);
    return `
        <div class="modlog-row">
            <span class="modlog-icon" aria-hidden="true">${def[0]}</span>
            <div class="modlog-body">
                <div class="modlog-title">${escapeHtml(en ? def[2] : def[1])}</div>
                <div class="modlog-meta">${actor}${target}${extra.length ? ' · ' + extra.join(' · ') : ''}</div>
            </div>
            <span class="modlog-time" title="${escapeAttr(serverDate(entry.created_at).toLocaleString())}">${escapeHtml(modlogTime(entry.created_at))}</span>
        </div>`;
}

async function loadModLog(append = false) {
    if (!currentHub) return;
    const list = document.getElementById('hub-modlog-list');
    const more = document.getElementById('hub-modlog-more');
    if (!append) modlogBefore = null;
    const params = new URLSearchParams({
        category: document.getElementById('hub-modlog-category').value,
        q: document.getElementById('hub-modlog-search').value.trim()
    });
    if (append && modlogBefore) params.set('before', String(modlogBefore));
    try {
        const response = await fetch(`/api/hubs/${currentHub.id}/mod-log?${params}`, { credentials: 'include' });
        const data = await response.json();
        if (!data.success) { list.innerHTML = `<div class="settings-blocked-empty">${escapeHtml(data.error || '')}</div>`; more.style.display = 'none'; return; }
        const html = data.entries.map(renderModlogEntry).join('');
        if (append) list.insertAdjacentHTML('beforeend', html);
        else list.innerHTML = html || `<div class="settings-blocked-empty">${t('modlog-empty')}</div>`;
        if (data.entries.length) modlogBefore = data.entries[data.entries.length - 1].id;
        more.style.display = data.has_more ? 'flex' : 'none';
    } catch (error) {
        console.error('Moderasyon kaydı alınamadı:', error);
    }
}

document.getElementById('hub-modlog-open-btn').addEventListener('click', () => {
    document.getElementById('hub-modlog-search').value = '';
    document.getElementById('hub-modlog-category').value = '';
    showHubSettingsView('modlog');
    loadModLog();
});
document.getElementById('hub-modlog-category').addEventListener('change', () => loadModLog());
document.getElementById('hub-modlog-search').addEventListener('input', () => {
    clearTimeout(modlogSearchTimer);
    modlogSearchTimer = setTimeout(() => loadModLog(), 250);
});
document.getElementById('hub-modlog-more').addEventListener('click', () => loadModLog(true));

document.getElementById('hub-bans-open-btn').addEventListener('click', () => showHubSettingsView('bans'));

document.getElementById('hub-bans-back-btn').addEventListener('click', () => showHubSettingsView('main'));

document.getElementById('hub-mutes-open-btn').addEventListener('click', () => {
    document.getElementById('hub-mutes-search-input').value = '';
    showHubSettingsView('mutes');
    loadHubMutes();
});
document.getElementById('hub-mutes-back-btn').addEventListener('click', () => showHubSettingsView('main'));
document.getElementById('hub-blocks-open-btn').addEventListener('click', () => {
    document.getElementById('hub-blocks-search-input').value = '';
    showHubSettingsView('blocks');
    loadHubBlocks();
});
document.getElementById('hub-blocks-back-btn').addEventListener('click', () => showHubSettingsView('main'));
document.getElementById('hub-blocks-search-input').addEventListener('input', () => {
    clearTimeout(hubBlocksSearchTimer);
    hubBlocksSearchTimer = setTimeout(loadHubBlocks, 250);
});
document.getElementById('hub-mutes-search-input').addEventListener('input', () => {
    clearTimeout(hubMutesSearchTimer);
    hubMutesSearchTimer = setTimeout(loadHubMutes, 250);
});

document.getElementById('hub-ban-member-btn').addEventListener('click', () => {
    document.getElementById('hub-ban-search-input').value = '';
    renderHubBanPicker();
    showHubSettingsView('pick');
});

document.getElementById('hub-pick-back-btn').addEventListener('click', () => showHubSettingsView('main'));
document.getElementById('hub-ban-search-input').addEventListener('input', renderHubBanPicker);

function renderHubBanPicker() {

    const picker = document.getElementById('hub-ban-picker');
    if (!currentHub) return;

    const myTier = currentHub.my_permission_tier;
    const query = document.getElementById('hub-ban-search-input').value.trim().toLowerCase();
    const candidates = currentHub.members.filter((m) =>
        (!query || m.username.toLowerCase().includes(query)) &&
        m.user_id !== currentUser.id &&
        m.permission_tier !== 'owner' &&
        !(m.permission_tier === 'moderator' && myTier !== 'owner')
    );

    if (candidates.length === 0) {
        picker.innerHTML = `<div class="settings-blocked-empty">${t('hub-ban-picker-empty')}</div>`;
        return;
    }

    picker.innerHTML = candidates.map((m) => {
        const color = getUserColor(m.username);
        const avatarInner = m.avatar_data ? `<img src="${escapeAttr(m.avatar_data)}" alt="">` : escapeHtml(m.username.charAt(0).toUpperCase());
        return `
            <div class="settings-blocked-row">
                <span class="settings-blocked-avatar" style="--user-color:${color};">${avatarInner}</span>
                <span class="settings-blocked-name">${escapeHtml(m.username)}</span>
                <button class="settings-unblock-btn" data-ban="${m.user_id}" type="button">${t('ban')}</button>
            </div>
        `;
    }).join('');

    picker.querySelectorAll('[data-ban]').forEach((btn) => {
        btn.addEventListener('click', async () => {
            await handleMemberModerationAction('ban', Number(btn.dataset.ban), null);
            if (currentHub) {
                currentHub.members = currentHub.members.filter((m) => m.user_id !== Number(btn.dataset.ban));
                renderHubBanPicker();
                loadHubBans();
            }
        });
    });

}

async function loadHubBans() {

    if (!currentHub) return;
    const container = document.getElementById('hub-settings-bans-list');

    try {

        const response = await fetch(`/api/hubs/${currentHub.id}/bans`, { credentials: 'include' });
        const data = await response.json();
        if (!data.success) return;

        if (data.bans.length === 0) {
            container.innerHTML = `<div class="settings-blocked-empty">${t('hub-bans-empty')}</div>`;
            return;
        }

        container.innerHTML = data.bans.map((u) => {
            const color = getUserColor(u.username);
            const initial = u.username.charAt(0).toUpperCase();
            const avatarInner = u.avatar_data ? `<img src="${escapeAttr(u.avatar_data)}" alt="">` : escapeHtml(initial);
            return `
                <div class="settings-blocked-row">
                    <span class="settings-blocked-avatar" style="--user-color:${color};">${avatarInner}</span>
                    <span class="settings-blocked-name">${escapeHtml(u.username)}</span>
                    <button class="settings-unblock-btn" data-unban="${u.id}" type="button">${t('unban')}</button>
                </div>
            `;
        }).join('');

        container.querySelectorAll('[data-unban]').forEach((btn) => {
            btn.addEventListener('click', async () => {
                await fetch(`/api/hubs/${currentHub.id}/members/${btn.dataset.unban}/unban`, { method: 'POST', credentials: 'include' });
                loadHubBans();
            });
        });

    } catch (error) {
        console.error('Yasaklılar alınamadı:', error);
    }

}

hubSettingsCloseBtn.addEventListener('click', closeHubSettings);

hubSettingsImageBtn.addEventListener('click', () => hubSettingsImageInput.click());

hubSettingsImageInput.addEventListener('change', async () => {

    const file = hubSettingsImageInput.files?.[0];
    if (!file) return;

    try {
        const dataUrl = await openImageCropper(file, { aspect: 1, outWidth: 256, title: 'Lobi Görselini Kırp' });
        if (!dataUrl) return;
        hubSettingsNewImageData = dataUrl;
        hubSettingsImagePreview.style.backgroundImage = cssImageUrl(dataUrl);
        hubSettingsImagePreview.textContent = '';
    } catch (error) {
        console.error('Görsel işlenemedi:', error);
        showToast('Görsel işlenemedi.');
    } finally {
        hubSettingsImageInput.value = '';
    }

});

// ═══ KEŞFET ══════════════════════════════════════════════════════════════
// Yalnızca keşfedilebilir Lobiler; arama/filtre/sayfalama SUNUCUDA yapılır. Kartta tek eylem "Lobiyi Gör"; katılım yalnızca detay ekranındadır.

const DISCOVER_CATEGORIES = ['oyun', 'sohbet', 'muzik', 'yayin', 'teknoloji', 'spor', 'diger'];
const DISCOVER_LANGUAGES = ['tr', 'en', 'other'];
const DISCOVER_POLICIES = ['everyone', 'request', 'owner_approval'];
const DISCOVER_MICS = ['none', 'preferred', 'required'];
const discoverState = { q: '', category: '', language: '', join_policy: '', page: 1, hasMore: false, seq: 0, ready: false };

const discoverSearchEl = document.getElementById('discover-search');
const discoverCategoriesEl = document.getElementById('discover-categories');
const discoverLanguageEl = document.getElementById('discover-language');
const discoverPolicyEl = document.getElementById('discover-policy');
const discoverResultsEl = document.getElementById('discover-results');
const discoverEmptyEl = document.getElementById('discover-empty');
const discoverNoticeEl = document.getElementById('discover-notice');
const discoverMoreBtn = document.getElementById('discover-more');
const discoverDetailModal = document.getElementById('discover-detail-modal');
const discoverDetailBody = document.getElementById('discover-detail-body');
const discoverDetailTitle = document.getElementById('discover-detail-title');
const discoverDetailError = document.getElementById('discover-detail-error');
const discoverDetailJoinBtn = document.getElementById('discover-detail-join');
let discoverDetail = null;

function discoverFillSelect(select, firstLabel, values, labelFor, selected) {
    select.innerHTML = (firstLabel != null ? `<option value="">${escapeHtml(firstLabel)}</option>` : '')
        + values.map((v) => `<option value="${escapeAttr(v)}">${escapeHtml(labelFor(v))}</option>`).join('');
    select.value = selected == null ? '' : selected;
}

function renderDiscoverFilters() {
    discoverCategoriesEl.innerHTML = [''].concat(DISCOVER_CATEGORIES).map((c) =>
        `<button type="button" class="discover-chip${discoverState.category === c ? ' on' : ''}" data-category="${escapeAttr(c)}" aria-pressed="${discoverState.category === c}">${escapeHtml(c ? t('discover-cat-' + c) : t('discover-all-cats'))}</button>`
    ).join('');
    discoverFillSelect(discoverLanguageEl, t('discover-all-langs'), DISCOVER_LANGUAGES, (v) => t('discover-lang-' + v), discoverState.language);
    discoverFillSelect(discoverPolicyEl, t('discover-all-policies'), DISCOVER_POLICIES, (v) => t('discover-policy-' + v), discoverState.join_policy);
}

function discoverAvatarHtml(lobby) {
    return lobby.has_image
        ? `<img src="/api/discover/lobbies/${lobby.id}/image" alt="" loading="lazy" decoding="async">`
        : hubInitialHtml(lobby.name);
}

function buildDiscoverCard(lobby, rank) {
    const card = document.createElement('div');
    card.className = 'discover-card' + (rank ? ` rank-${rank}` : '');
    if (rank) {
        const badge = document.createElement('span');
        badge.className = `rank-badge rank-badge-${rank}`;
        badge.innerHTML = rank === 1 ? '<b>👑</b>1' : String(rank);
        badge.title = `${rank}. Popüler Lobi`;
        card._rankBadge = badge;
    }
    card.tabIndex = 0;
    card.setAttribute('role', 'article');

    const cap = lobby.capacity ? `${lobby.member_count}/${lobby.capacity}` : String(lobby.member_count);
    const tags = [
        lobby.level > 0 ? `<span class="discover-lv">${escapeHtml(t('discover-level-short'))} ${lobby.level}</span>` : '',
        lobby.category ? `<span class="discover-tag">${escapeHtml(t('discover-cat-' + lobby.category))}</span>` : '',
        lobby.topic ? `<span class="discover-tag muted">${escapeHtml(lobby.topic)}</span>` : ''
    ].join('');
    const voice = lobby.voice_active > 0 ? `<span class="voice-live">🎙 ${lobby.voice_active} ${escapeHtml(t('discover-in-voice'))}</span>` : '';
    const pop = (lobby.points_30d > 0)
        ? `<span class="discover-pop level-${lobby.level > 0 ? 1 : 0}">${lobby.points_30d >= 50 ? '🔥' : '♥'} ${lobby.points_30d}</span>`
        : '';
    const lang = lobby.language ? `<span>${escapeHtml(t('discover-lang-' + lobby.language))}</span>` : '';

    card.innerHTML = `
        <div class="discover-card-top">
            <span class="discover-card-avatar">${discoverAvatarHtml(lobby)}</span>
            <div style="min-width:0;">
                <div class="discover-card-name">${escapeHtml(lobby.name)}</div>
                <div class="discover-card-tags">${tags}</div>
            </div>
        </div>
        <p class="discover-card-desc">${escapeHtml(lobby.description || '')}</p>
        <div class="discover-card-meta">
            <span>👥 ${escapeHtml(cap)} ${escapeHtml(t('discover-members'))}</span>${pop}${voice}
            <span>${escapeHtml(t('discover-owner'))}: ${usernameCardHtml(lobby.owner_username, lobby.owner_plus)}${lobby.owner_plus ? ' <span class="plus-badge plus-badge-sm" title="Sauran Plus">✦ PLUS</span>' : ''}</span>
        </div>
        <button type="button" class="discover-card-cta">${escapeHtml(t('discover-view-lobby'))}</button>
    `;
    if (card._rankBadge) card.prepend(card._rankBadge);

    const open = () => openDiscoverDetail(lobby.id);
    card.addEventListener('click', open);
    card.addEventListener('keydown', (event) => { if (event.key === 'Enter') open(); });
    return card;
}

async function loadDiscover(reset) {

    if (reset) { discoverState.page = 1; discoverResultsEl.innerHTML = ''; }
    updateDiscoverFilterDot();
    discoverEmptyEl.style.display = 'none';
    discoverNoticeEl.style.display = 'none';
    const seq = ++discoverState.seq;

    // Popüler Lobiler: filtre/arama yokken en yüksek 30 günlük puanlı ilk 3 (puanı 0 olan yok).
    const popularBox = document.getElementById('discover-popular');
    const popularGrid = document.getElementById('discover-popular-grid');
    if (reset) {
        discoverState.popularIds = [];
        if (!discoverToolsActive()) {
            try {
                const pr = await fetch('/api/discover/lobbies?page=1&limit=3', { credentials: 'include' });
                const pd = await pr.json();
                if (seq !== discoverState.seq) return;
                const top = (pd.success ? pd.lobbies : []).filter((l) => l.points_30d > 0).slice(0, 3);
                popularGrid.innerHTML = '';
                top.forEach((l, i) => popularGrid.appendChild(buildDiscoverCard(l, i + 1)));
                discoverState.popularIds = top.map((l) => l.id);
                popularBox.style.display = top.length ? '' : 'none';
            } catch (_) { popularBox.style.display = 'none'; }
        } else {
            popularBox.style.display = 'none';
        }
    }

    const params = new URLSearchParams({ page: String(discoverState.page), limit: '12' });
    if (discoverState.q) params.set('q', discoverState.q);
    if (discoverState.category) params.set('category', discoverState.category);
    if (discoverState.language) params.set('language', discoverState.language);
    if (discoverState.join_policy) params.set('join_policy', discoverState.join_policy);

    try {
        const response = await fetch(`/api/discover/lobbies?${params}`, { credentials: 'include' });
        const data = await response.json();
        if (seq !== discoverState.seq) return; // daha yeni bir arama başladı

        if (!data.success) throw new Error(data.error || 'hata');

        data.lobbies.filter((l) => !(discoverState.popularIds || []).includes(l.id)).forEach((lobby) => discoverResultsEl.appendChild(buildDiscoverCard(lobby)));
        discoverState.hasMore = Boolean(data.has_more);
        discoverMoreBtn.style.display = discoverState.hasMore ? 'block' : 'none';

        if (data.total === 0 && !(discoverState.popularIds || []).length) {
            const filtered = discoverState.q || discoverState.category || discoverState.language || discoverState.join_policy;
            discoverEmptyEl.textContent = t(filtered ? 'discover-empty' : 'discover-empty-none');
            discoverEmptyEl.style.display = 'block';
        }
    } catch (error) {
        if (seq !== discoverState.seq) return;
        console.error('Keşfet yüklenemedi:', error);
        discoverEmptyEl.textContent = t('discover-error');
        discoverEmptyEl.style.display = 'block';
        discoverMoreBtn.style.display = 'none';
    }
}

function openDiscover() {
    switchToView('discover');
    loadWallet();
    renderDiscoverFilters();
    loadDiscover(true);
}

function discoverToolsActive() {
    return Boolean(discoverState.q || discoverState.category || discoverState.language || discoverState.join_policy);
}

function updateDiscoverFilterDot() {
    const dot = document.getElementById('discover-filter-dot');
    if (dot) dot.style.display = discoverToolsActive() ? 'block' : 'none';
}

(function wireDiscover() {
    if (!discoverSearchEl) return;

    // Arama/filtreler varsayılan olarak kapalı; büyüteç düğmesiyle açılır (ekranın yarısını kaplamasın).
    const toggleBtn = document.getElementById('discover-search-toggle');
    const tools = document.getElementById('discover-tools');
    toggleBtn.addEventListener('click', () => {
        const open = tools.style.display === 'none';
        tools.style.display = open ? 'flex' : 'none';
        toggleBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
        if (open) setTimeout(() => discoverSearchEl.focus(), 50);
    });
    let timer = null;
    discoverSearchEl.addEventListener('input', () => {
        clearTimeout(timer);
        timer = setTimeout(() => { discoverState.q = discoverSearchEl.value.trim(); loadDiscover(true); }, 300);
    });
    discoverCategoriesEl.addEventListener('click', (event) => {
        const btn = event.target.closest('[data-category]');
        if (!btn) return;
        discoverState.category = btn.dataset.category;
        renderDiscoverFilters();
        loadDiscover(true);
    });
    discoverLanguageEl.addEventListener('change', () => { discoverState.language = discoverLanguageEl.value; loadDiscover(true); });
    discoverPolicyEl.addEventListener('change', () => { discoverState.join_policy = discoverPolicyEl.value; loadDiscover(true); });
    discoverMoreBtn.addEventListener('click', () => { discoverState.page += 1; loadDiscover(false); });

    const menuBtn = document.getElementById('discover-open-btn');
    if (menuBtn) menuBtn.addEventListener('click', () => {
        const dropdown = document.getElementById('topbar-menu-dropdown');
        if (dropdown) dropdown.style.display = 'none';
        openDiscover();
    });

    document.getElementById('discover-detail-close').addEventListener('click', () => { discoverDetailModal.style.display = 'none'; });
    discoverDetailModal.addEventListener('click', (event) => { if (event.target === discoverDetailModal) discoverDetailModal.style.display = 'none'; });
    document.getElementById('discover-detail-report').addEventListener('click', () => {
        if (discoverDetail) openReportModal('hub', discoverDetail.id, discoverDetail.name);
    });
    discoverDetailJoinBtn.addEventListener('click', joinDiscoverDetail);
    document.getElementById('discover-detail-like').addEventListener('click', toggleDiscoverLike);
    document.getElementById('discover-detail-superlike').addEventListener('click', superLikeDiscoverDetail);
    // Coin satın alma henüz yok: rozet yalnızca bakiyeyi gösterir, dokununca "yakında" der.
    document.getElementById('discover-wallet').addEventListener('click', () => showToast(t('coin-buy-soon')));
})();

function discoverDetailButtonState(lobby) {
    const full = lobby.capacity && lobby.member_count >= lobby.capacity;
    if (lobby.is_member) return { label: t('discover-go'), disabled: false, mode: 'open' };
    if (lobby.my_request_status === 'pending') return { label: t('discover-requested'), disabled: true, mode: 'none' };
    if (full) return { label: t('discover-full'), disabled: true, mode: 'none' };
    return { label: t(lobby.join_policy === 'everyone' ? 'discover-join' : 'discover-join-request'), disabled: false, mode: 'join' };
}

// Rastgele cihaz kimliği: yalnızca bu tarayıcıda saklanır; sunucu yalnızca sırlı özetini ve yalnızca bir gün tutar
// (aynı cihazdan aynı gün aynı Lobiye ikinci hesabın beğenisini saymamak için).
function getDeviceId() {
    const KEY = 'sauran_device_id';
    try {
        let id = localStorage.getItem(KEY);
        if (!/^[0-9a-f]{32}$/.test(id || '')) {
            const bytes = crypto.getRandomValues(new Uint8Array(16));
            id = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
            localStorage.setItem(KEY, id);
        }
        return id;
    } catch (_) {
        return null; // depolama yok: sunucu cihaz kimliği olmadan beğeniyi kabul etmez
    }
}

function renderDiscoverLike(lobby) {
    const btn = document.getElementById('discover-detail-like');
    const label = document.getElementById('discover-detail-like-label');
    const reason = lobby.like_reason;
    const liked = Boolean(lobby.liked_today);
    const locked = reason === 'account_new' || reason === 'member_new';

    btn.classList.toggle('liked', liked);
    btn.classList.toggle('locked', locked);
    btn.setAttribute('aria-pressed', liked ? 'true' : 'false');
    btn.querySelector('.discover-like-heart').textContent = liked ? '♥' : (locked ? '🔒' : '♡');
    label.textContent = t(liked ? 'discover-liked-today' : 'discover-like');

    // Beğeni günde bir kez ve geri alınamaz. Kilitli durumlar (yeni hesap / yeni üye) düğmeyi gizlemez: açık kalır, nedenini söyler.
    btn.disabled = liked || reason === 'not_member';
    btn.title = liked ? t('discover-liked-tomorrow') : (reason ? t('discover-like-reason-' + reason) : t('discover-like'));

    // Açıklayıcı ipucu satırı (dokunmadan da görünür)
    const lines = [];
    if (liked) lines.push(t('discover-liked-tomorrow'));
    else if (reason) lines.push(t('discover-like-hint-' + reason));
    const sl = lobby.super_like;
    if (sl) {
        lines.push(t('discover-superlike-info').replace('{cost}', sl.cost).replace('{points}', sl.points));
        if (sl.user_today >= sl.user_max) lines.push(t('discover-superlike-limit-user'));
        else if (sl.lobby_today_points + sl.points > sl.lobby_cap) lines.push(t('discover-superlike-limit-lobby'));
    }
    document.getElementById('discover-detail-hint').textContent = lines.join(' ');

    renderSuperLikeButton(lobby);
}

let superLikeConfirmTimer = null;

function renderSuperLikeButton(lobby) {
    const btn = document.getElementById('discover-detail-superlike');
    const label = document.getElementById('discover-superlike-label');
    const sl = lobby.super_like;
    clearTimeout(superLikeConfirmTimer);
    btn.classList.remove('confirming');
    btn.dataset.confirm = '';
    label.textContent = t('discover-superlike') + (sl ? ` · ${sl.cost} 🪙` : '');
    const limited = sl && (sl.user_today >= sl.user_max || sl.lobby_today_points + sl.points > sl.lobby_cap);
    btn.disabled = Boolean(limited);
}

// Süper Beğeni: Coin harcar → yanlışlıkla harcamayı önlemek için iki dokunuş (ilki "Onayla" gösterir).
async function superLikeDiscoverDetail() {
    if (!discoverDetail || !discoverDetail.super_like) return;
    const btn = document.getElementById('discover-detail-superlike');
    const label = document.getElementById('discover-superlike-label');
    const sl = discoverDetail.super_like;

    if (sl.balance < sl.cost) { showToast(t('coin-not-enough')); return; }

    if (btn.dataset.confirm !== '1') {
        btn.dataset.confirm = '1';
        btn.classList.add('confirming');
        label.textContent = `${t('discover-superlike-confirm')} · ${sl.cost} 🪙`;
        clearTimeout(superLikeConfirmTimer);
        superLikeConfirmTimer = setTimeout(() => renderSuperLikeButton(discoverDetail), 4000);
        return;
    }

    btn.disabled = true;
    try {
        const response = await fetch(`/api/discover/lobbies/${discoverDetail.id}/super-like`, { method: 'POST', credentials: 'include' });
        const data = await response.json();
        if (!data.success) {
            discoverDetailError.textContent = data.error || t('discover-error');
            renderSuperLikeButton(discoverDetail);
            return;
        }
        discoverDetailError.textContent = '';
        Object.assign(discoverDetail, { points_30d: data.points_30d, points_total: data.points_total, level: data.level, level_progress: data.level_progress, level_needed: data.level_needed, super_like: data.super_like });
        setWalletBalance(data.super_like.balance);
        showToast(t('discover-superlike-sent'));
        renderDiscoverDetail(discoverDetail);
        loadDiscover(true);
    } catch (error) {
        console.error('Süper Beğeni hatası:', error);
        discoverDetailError.textContent = t('discover-error');
        renderSuperLikeButton(discoverDetail);
    }
}

function setWalletBalance(balance) {
    const el = document.getElementById('discover-wallet-balance');
    if (el) el.textContent = String(balance);
}

async function loadWallet() {
    try {
        const response = await fetch('/api/wallet', { credentials: 'include' });
        const data = await response.json();
        if (data.success) setWalletBalance(data.balance);
    } catch (_) { /* bakiye alınamazsa 0 kalır */ }
}

async function toggleDiscoverLike() {
    if (!discoverDetail) return;
    const reason = discoverDetail.like_reason;
    if (reason === 'account_new' || reason === 'member_new') { showToast(t('discover-like-reason-' + reason)); return; }
    if (document.getElementById('discover-detail-like').disabled) return;

    try {
        const response = await fetch(`/api/discover/lobbies/${discoverDetail.id}/like`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ device_id: getDeviceId() })
        });
        const data = await response.json();
        if (!data.success) {
            discoverDetailError.textContent = data.error || t('discover-error');
            if (data.reason === 'already_today') { discoverDetail.liked_today = true; discoverDetail.like_reason = 'already_today'; renderDiscoverLike(discoverDetail); }
            return;
        }
        discoverDetail.liked_today = true;
        discoverDetail.like_reason = 'already_today';
        Object.assign(discoverDetail, { points_30d: data.points_30d, points_total: data.points_total, level: data.level, level_progress: data.level_progress, level_needed: data.level_needed });
        discoverDetailError.textContent = '';
        renderDiscoverDetail(discoverDetail);
        loadDiscover(true); // sıralama son 30 günlük puana göre değişir
    } catch (error) {
        console.error('Beğeni hatası:', error);
        discoverDetailError.textContent = t('discover-error');
    }
}

function renderDiscoverDetail(lobby) {
    discoverDetail = lobby;
    discoverDetailTitle.textContent = lobby.name;
    discoverDetailError.textContent = '';

    const full = lobby.capacity && lobby.member_count >= lobby.capacity;
    const cap = lobby.capacity ? `${lobby.member_count}/${lobby.capacity}` : String(lobby.member_count);
    const fact = (label, value) => value ? `<div class="discover-fact"><b>${escapeHtml(label)}</b><span>${escapeHtml(value)}</span></div>` : '';
    const rules = (lobby.rules || '').split('\n').map((l) => l.trim()).filter(Boolean);

    discoverDetailBody.innerHTML = `
        <div class="discover-detail-top">
            <span class="discover-card-avatar">${discoverAvatarHtml(lobby)}</span>
            <div style="min-width:0;">
                <div class="discover-card-name" style="white-space:normal;">${escapeHtml(lobby.name)}</div>
                <div class="discover-detail-owner">${escapeHtml(t('discover-owner'))}: ${usernameCardHtml(lobby.owner_username, lobby.owner_plus)}${lobby.owner_plus ? ' <span class="plus-badge plus-badge-sm" title="Sauran Plus">✦ PLUS</span>' : ''}</div>
            </div>
        </div>
        <div class="discover-facts">
            ${fact(t('discover-fact-members'), cap)}
            ${fact(t('discover-fact-status'), t(full ? 'discover-status-full' : 'discover-status-open'))}
            ${fact(t('discover-fact-category'), lobby.category ? t('discover-cat-' + lobby.category) : '')}
            ${fact(t('discover-fact-topic'), lobby.topic)}
            ${fact(t('discover-fact-language'), lobby.language ? t('discover-lang-' + lobby.language) : '')}
            ${fact(t('discover-fact-join'), t('discover-policy-' + lobby.join_policy))}
            ${fact(t('discover-fact-mic'), t('discover-mic-' + lobby.mic_requirement))}
            ${lobby.voice_active > 0 ? fact('🎙', `${lobby.voice_active} ${t('discover-in-voice')}`) : ''}
        </div>
        <div class="discover-level">
            <div class="discover-level-top"><b>${escapeHtml(t('discover-level'))} ${lobby.level || 0}</b><span>${lobby.level_progress || 0} / ${lobby.level_needed || 0} ${escapeHtml(t('discover-level-progress'))}</span></div>
            <div class="discover-level-bar"><i style="width:${Math.min(100, Math.round(((lobby.level_progress || 0) / Math.max(1, lobby.level_needed || 1)) * 100))}%"></i></div>
            <div class="discover-level-note">${escapeHtml(t('discover-points-30d'))}: ${lobby.points_30d || 0} ${escapeHtml(t('discover-level-progress'))} · ${escapeHtml(t('discover-level-note'))}</div>
        </div>
        ${lobby.description ? `<div class="discover-detail-section"><h4>${escapeHtml(t('discover-purpose'))}</h4><p>${escapeHtml(lobby.description)}</p></div>` : ''}
        ${rules.length ? `<div class="discover-detail-section"><h4>${escapeHtml(t('discover-rules'))}</h4><ul class="discover-rules">${rules.map((r) => `<li>${escapeHtml(r)}</li>`).join('')}</ul></div>` : ''}
    `;

    renderDiscoverLike(lobby);

    const state = discoverDetailButtonState(lobby);
    discoverDetailJoinBtn.textContent = state.label;
    discoverDetailJoinBtn.disabled = state.disabled;
    discoverDetailJoinBtn.dataset.mode = state.mode;
    document.getElementById('discover-detail-report').style.display = lobby.is_owner ? 'none' : '';
}

async function openDiscoverDetail(id) {
    try {
        const response = await fetch(`/api/discover/lobbies/${id}`, { credentials: 'include' });
        const data = await response.json();
        if (!data.success) { showToast(data.error || t('discover-error')); return; }
        renderDiscoverDetail(data.lobby);
        discoverDetailModal.style.display = 'flex';
    } catch (error) {
        console.error('Lobi detayı alınamadı:', error);
        showToast(t('discover-error'));
    }
}

async function joinDiscoverDetail() {
    if (!discoverDetail) return;
    const mode = discoverDetailJoinBtn.dataset.mode;

    if (mode === 'open') {
        discoverDetailModal.style.display = 'none';
        openHub(discoverDetail.id);
        return;
    }
    if (mode !== 'join') return;

    discoverDetailJoinBtn.disabled = true;
    discoverDetailError.textContent = '';

    try {
        const response = await fetch(`/api/discover/lobbies/${discoverDetail.id}/join`, { method: 'POST', credentials: 'include' });
        const data = await response.json();

        if (!data.success) {
            discoverDetailError.textContent = data.error || t('discover-error');
            discoverDetailJoinBtn.disabled = false;
            return;
        }

        if (data.status === 'joined') {
            showToast(t('discover-joined-toast'));
            discoverDetailModal.style.display = 'none';
            loadHubList();
            openHub(discoverDetail.id);
        } else {
            showToast(t('discover-requested-toast'));
            discoverDetail.my_request_status = 'pending';
            renderDiscoverDetail(discoverDetail);
        }
    } catch (error) {
        console.error('Keşfet katılım hatası:', error);
        discoverDetailError.textContent = t('discover-error');
        discoverDetailJoinBtn.disabled = false;
    }
}

// ─── Lobi ayarları: Keşfet alanları (yalnızca sahip) ────────────────────────
const hubsetVisibility = document.getElementById('hubset-visibility');

function hubsetSelect(id, values, labelFor, first) {
    const el = document.getElementById(id);
    if (!el) return null;
    el.innerHTML = (first ? `<option value="">${escapeHtml(first)}</option>` : '') + values.map((v) => `<option value="${escapeAttr(v)}">${escapeHtml(labelFor(v))}</option>`).join('');
    return el;
}

function syncHubsetVisibilityUi() {
    const value = hubsetVisibility.value;
    document.getElementById('hubset-discover-fields').style.display = value === 'discoverable' ? 'flex' : 'none';
    document.getElementById('hubset-discover-fields').style.flexDirection = 'column';
    document.getElementById('hubset-discover-fields').style.gap = '8px';
    document.getElementById('hubset-visibility-hint').textContent = t('hubset-vis-hint-' + value);
}

function populateHubDiscoverSettings(isOwner) {
    const box = document.getElementById('hub-discover-settings');
    const reqBtn = document.getElementById('hub-requests-open-btn');
    document.getElementById('hub-settings-requests-view').style.display = 'none';

    // Katılma istekleri: sunucu yalnızca yetkili kullanıcıya sayıyı gönderir.
    const pending = currentHub && currentHub.pending_join_requests;
    reqBtn.style.display = typeof pending === 'number' ? 'flex' : 'none';
    document.getElementById('hub-requests-count').textContent = pending ? String(pending) : '';
    const navBadge = document.getElementById('hubset-nav-requests');
    navBadge.textContent = pending ? String(pending) : '';
    navBadge.style.display = pending ? 'inline-flex' : 'none';

    if (!box) return;
    box.style.display = isOwner ? 'flex' : 'none';
    if (!isOwner) return;

    hubsetSelect('hubset-visibility', ['private', 'invite_only', 'discoverable'], (v) => t('hubset-vis-' + v));
    hubsetSelect('hubset-category', DISCOVER_CATEGORIES, (v) => t('discover-cat-' + v), t('hubset-category-pick'));
    hubsetSelect('hubset-language', DISCOVER_LANGUAGES, (v) => t('discover-lang-' + v), '—');
    hubsetSelect('hubset-join-policy', DISCOVER_POLICIES, (v) => t('discover-policy-' + v));
    hubsetSelect('hubset-mic', DISCOVER_MICS, (v) => t('discover-mic-' + v));

    hubsetVisibility.value = currentHub.visibility || 'private';
    document.getElementById('hubset-category').value = currentHub.category || '';
    document.getElementById('hubset-topic').value = currentHub.topic || '';
    document.getElementById('hubset-description').value = currentHub.description || '';
    document.getElementById('hubset-rules').value = currentHub.rules || '';
    document.getElementById('hubset-language').value = currentHub.language || '';
    document.getElementById('hubset-join-policy').value = currentHub.join_policy || 'everyone';
    document.getElementById('hubset-mic').value = currentHub.mic_requirement || 'none';
    document.getElementById('hubset-capacity').value = currentHub.capacity || '';
    syncHubsetVisibilityUi();
}

if (hubsetVisibility) hubsetVisibility.addEventListener('change', syncHubsetVisibilityUi);

// Sunucuya yalnızca sahibin gördüğü alanlar gönderilir; keşfedilebilir değilse ayrıntı alanları değiştirilmez.
function collectHubDiscoverSettings() {
    const visibility = hubsetVisibility.value || 'private';
    const body = { visibility };
    if (visibility === 'discoverable') {
        const capacity = document.getElementById('hubset-capacity').value.trim();
        Object.assign(body, {
            category: document.getElementById('hubset-category').value || null,
            topic: document.getElementById('hubset-topic').value,
            description: document.getElementById('hubset-description').value,
            rules: document.getElementById('hubset-rules').value,
            language: document.getElementById('hubset-language').value || null,
            join_policy: document.getElementById('hubset-join-policy').value || 'everyone',
            mic_requirement: document.getElementById('hubset-mic').value || 'none',
            capacity: capacity ? Number(capacity) : null
        });
    }
    return body;
}

// ─── Katılma istekleri (Lobi ayarları alt görünümü) ─────────────────────────
async function loadHubJoinRequests() {
    const list = document.getElementById('hub-settings-requests-list');
    list.innerHTML = '';
    try {
        const response = await fetch(`/api/hubs/${currentHub.id}/join-requests`, { credentials: 'include' });
        const data = await response.json();
        if (!data.success) { list.textContent = data.error || ''; return; }
        if (!data.requests.length) { list.innerHTML = `<p class="hubset-hint">${escapeHtml(t('hubset-requests-empty'))}</p>`; }
        data.requests.forEach((req) => {
            const row = document.createElement('div');
            row.className = 'join-request-row';
            row.innerHTML = `<span class="join-request-name">${escapeHtml(req.username)}</span>
                <button type="button" class="join-request-approve">${escapeHtml(t('hubset-approve'))}</button>
                <button type="button" class="join-request-reject">${escapeHtml(t('hubset-reject'))}</button>`;
            const decide = async (decision) => {
                row.querySelectorAll('button').forEach((b) => { b.disabled = true; });
                try {
                    const r = await fetch(`/api/hubs/${currentHub.id}/join-requests/${req.id}/${decision}`, { method: 'POST', credentials: 'include' });
                    const d = await r.json();
                    if (!d.success) showToast(d.error || t('discover-error'));
                } catch (_) { showToast(t('discover-error')); }
                loadHubJoinRequests();
            };
            row.querySelector('.join-request-approve').addEventListener('click', () => decide('approve'));
            row.querySelector('.join-request-reject').addEventListener('click', () => decide('reject'));
            list.appendChild(row);
        });
        currentHub.pending_join_requests = data.requests.length;
        document.getElementById('hub-requests-count').textContent = data.requests.length ? String(data.requests.length) : '';
    } catch (error) {
        console.error('Katılma istekleri alınamadı:', error);
    }
}

document.getElementById('hub-requests-open-btn')?.addEventListener('click', () => {
    const view = document.getElementById('hub-settings-requests-view');
    const open = view.style.display === 'none';
    view.style.display = open ? 'flex' : 'none';
    if (open) loadHubJoinRequests();
});
document.getElementById('hub-requests-back-btn')?.addEventListener('click', () => {
    document.getElementById('hub-settings-requests-view').style.display = 'none';
});

hubSettingsSaveBtn.addEventListener('click', async () => {

    if (!currentHub) return;

    const name = hubSettingsNameInput.value.trim();

    if (name.length < 3) {
        hubSettingsError.textContent = 'Lobi adı en az 3 karakter olmalı.';
        return;
    }

    const body = { name };
    if (hubSettingsNewImageData !== undefined) body.image_data = hubSettingsNewImageData;
    if (currentHub.is_owner) {
        Object.assign(body, collectHubDiscoverSettings());
        if (hubSettingsTheme !== (currentHub.theme || 'default')) body.theme = hubSettingsTheme;
        if (hubSettingsBgImage !== undefined) body.bg_image = hubSettingsBgImage;
        const everyone = document.getElementById('hubset-everyone').value;
        if (everyone !== (currentHub.mention_everyone || 'owner')) body.mention_everyone = everyone;
    }

    try {

        const response = await fetch(`/api/hubs/${currentHub.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(body)
        });

        const data = await response.json();

        if (!data.success) {
            hubSettingsError.textContent = data.error || 'Kaydedilemedi.';
            return;
        }

        closeHubSettings();
        showToast(t('hubset-saved'));
        openHub(currentHub.id);

    } catch (error) {
        console.error('Lobi ayarları kaydedilemedi:', error);
        hubSettingsError.textContent = 'Kaydedilemedi.';
    }

});

const callOverlay = document.getElementById('call-overlay');
const callHubName = document.getElementById('call-hub-name');
const callFrameContainer = document.getElementById('call-frame-container');
const callLeaveBtn = document.getElementById('call-leave-btn');
const callScreenshareBtn = document.getElementById('call-screenshare-btn');
const callRingingState = document.getElementById('call-ringing-state');
const callRingingText = document.getElementById('call-ringing-text');
const callRingingCancelBtn = document.getElementById('call-ringing-cancel-btn');
const callMinimizeBtn = document.getElementById('call-minimize-btn');
const callMiniBar = document.getElementById('call-mini-bar');
const callMiniName = document.getElementById('call-mini-name');
const callMiniDuration = document.getElementById('call-mini-duration');
const callMiniExpandBtn = document.getElementById('call-mini-expand-btn');
const callMiniLeaveBtn = document.getElementById('call-mini-leave-btn');
const callHeaderDuration = document.getElementById('call-header-duration');
const callDmDuration = document.getElementById('call-dm-duration');

// ─── Arama süresi sayacı — bağlantı kurulduğunda başlar (joined-meeting),
// hem üst panelde hem küçültülmüş çubukta hem DM bekleme ekranında aynı
// anda güncellenir, "Ayrıl"/leaveCall() ile durur.
let callStartTime = null;
let callTimerInterval = null;

function formatCallDuration(ms) {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function updateCallDurationDisplays() {
    if (!callStartTime) return;
    const text = formatCallDuration(Date.now() - callStartTime);
    [callHeaderDuration, callDmDuration, callMiniDuration].forEach((el) => {
        if (!el) return;
        el.textContent = text;
        el.style.display = '';
    });
}

function startCallTimer() {
    if (callTimerInterval) return;
    callStartTime = Date.now();
    updateCallDurationDisplays();
    callTimerInterval = setInterval(updateCallDurationDisplays, 1000);
}

function stopCallTimer() {
    if (callTimerInterval) {
        clearInterval(callTimerInterval);
        callTimerInterval = null;
    }
    callStartTime = null;
    [callHeaderDuration, callDmDuration, callMiniDuration].forEach((el) => {
        if (!el) return;
        el.textContent = '';
        el.style.display = 'none';
    });
}

callMinimizeBtn.addEventListener('click', () => {
    if (!callFrame && callMode !== 'dm-ringing') return;
    callMiniName.textContent = callHubName.textContent;
    callOverlay.style.display = 'none';
    callMiniBar.style.display = 'flex';
    document.body.classList.add('call-mini-active');
    if (callMode === 'hub-room') updateVoiceSessionSummary();
    showCallControlsHintOnce();
});

// Görüşme ekranı küçültülünce mikrofon/gürültü engelleme gibi kontrollerin nerede olduğunu bir kez hatırlat (cihaz başına bir kez).
function showCallControlsHintOnce() {
    const KEY = 'sauran_hint_call_controls';
    try {
        if (localStorage.getItem(KEY)) return;
        localStorage.setItem(KEY, '1');
    } catch (_) { /* depolama yok: her seferinde göstermek yerine hiç gösterme */ return; }
    showToast(t(callMode === 'hub-room' ? 'hint-call-controls-room' : 'hint-call-controls-dm'));
}

callMiniExpandBtn.addEventListener('click', () => {
    callMiniBar.style.display = 'none';
    document.body.classList.remove('call-mini-active');
    callOverlay.style.display = 'flex';
});

callMiniLeaveBtn.addEventListener('click', () => {
    callMiniBar.style.display = 'none';
    document.body.classList.remove('call-mini-active');
    leaveCall();
});

const dmIncomingCallModal = document.getElementById('dm-incoming-call-modal');
const dmIncomingCallUsername = document.getElementById('dm-incoming-call-username');
const dmIncomingCallAcceptBtn = document.getElementById('dm-incoming-call-accept-btn');
const dmIncomingCallDeclineBtn = document.getElementById('dm-incoming-call-decline-btn');

let callFrame = null;
let callMode = null; // 'hub' | 'dm'
let incomingCallFromId = null;
let incomingCallFromUsername = '';
let outgoingCallToId = null;
let outgoingCallToUsername = '';

const pollCreateModal = document.getElementById('poll-create-modal');
const pollCreateCloseBtn = document.getElementById('poll-create-close-btn');
const pollQuestionInput = document.getElementById('poll-question-input');
const pollOptionsList = document.getElementById('poll-options-list');
const pollAddOptionBtn = document.getElementById('poll-add-option-btn');
const pollSubmitBtn = document.getElementById('poll-submit-btn');

const shareCreateModal = document.getElementById('share-create-modal');
const shareCreateCloseBtn = document.getElementById('share-create-close-btn');
const shareContentInput = document.getElementById('share-content-input');
const shareUrlInput = document.getElementById('share-url-input');
const shareSubmitBtn = document.getElementById('share-submit-btn');


// =====================================================
// HUB SİSTEMİ — DURUM
// =====================================================

let currentHub = null;
let hubCreateImageData = null;


// =====================================================
// GÖRÜNÜM GEÇİŞİ
// =====================================================

function switchToView(view) {

    document.body.dataset.view = view;
    placeMobileTopbarItems(view);

    hubListView.style.display = view === 'hubs' ? 'flex' : 'none';
    hubDetailView.style.display = view === 'hub-detail' ? 'flex' : 'none';
    const discoverViewEl = document.getElementById('discover-view');
    if (discoverViewEl) discoverViewEl.style.display = view === 'discover' ? 'flex' : 'none';
    // Ray: Keşfet ekranındayken Keşfet, ana listedeyken Ana Menü vurgulanır.
    const railDiscoverEl = document.getElementById('rail-discover');
    const railHomeEl = document.getElementById('rail-home');
    if (railDiscoverEl) railDiscoverEl.classList.toggle('on', view === 'discover');
    if (railHomeEl && (view === 'discover' || view === 'hubs')) railHomeEl.classList.toggle('on', view === 'hubs');

    // "Ana Menü" başlığı üst çubukta sadece Ana Menü (Lobi listesi) ekranındayken görünür.
    const topbarContextTitle = document.getElementById('topbar-context-title');
    if (topbarContextTitle) topbarContextTitle.style.display = (view === 'hubs' || (view === 'discover' && window.innerWidth <= 900)) ? 'block' : 'none';

    const friendsSidebar = document.getElementById('friends-sidebar');
    const friendsSidebarToggleBtn = document.getElementById('friends-sidebar-toggle-btn');
    const showFriendsSidebar = view === 'hubs';
    friendsSidebar.style.display = showFriendsSidebar ? 'flex' : 'none';
    friendsSidebarToggleBtn.style.display = showFriendsSidebar ? 'flex' : 'none';

    // Masaüstünde panel varsayılan olarak açık kalsın (yeterli yer var),
    // ama mobilde (≤768px) sayfa açılır açılmaz Lobi listesinin üzerine
    // binmesin diye varsayılan olarak kapalı gelsin — kullanıcı istediğinde
    // çentikten açabilir. Kullanıcının panel açıkken elle kapatması/açması
    // bu mantığı ezmesin diye bu sadece görünüme geçişte bir kez uygulanır.
    if (showFriendsSidebar) {
        const isMobile = window.innerWidth <= 768;
        friendsSidebar.classList.toggle('open', !isMobile);
        friendsSidebarToggleBtn.classList.toggle('open', !isMobile);
    }

    if (view !== 'hub-detail' && currentHub) {

        if (socket) {
            socket.emit('leave_hub', currentHub.id);
        }

        // Sesli odadaysa bağlantı kopmaz — kullanıcı "Ayrıl" demeden çağrı
        // arka planda (küçültülmüş çubukta) devam eder.

        currentHub = null;

    }

    if (showFriendsSidebar) loadFriendsSidebar();

}


// =====================================================
// HUB LİSTESİ
// =====================================================

// image_data yoksa lobi isminin baş harfi, kullanıcı renkli, varsayılan ikon olarak gösterilir (eski 🧩 yerine).
function hubInitialHtml(name) {
    const initial = String(name || '?').trim().charAt(0).toUpperCase() || '?';
    const color = getUserColor(name || '');
    return `<span class="hub-icon-initial" style="--user-color:${color};">${escapeHtml(initial)}</span>`;
}

function renderHubCard(hub) {

    const card = document.createElement('div');
    card.className = 'hub-card';

    const iconHtml = hub.image_data
        ? `<img src="${escapeAttr(hub.image_data)}" class="hub-card-icon" alt="">`
        : `<span class="hub-card-icon">${hubInitialHtml(hub.name)}</span>`;

    card.innerHTML = `
        ${iconHtml}
        <span class="hub-card-text">
            <span class="hub-card-name">${escapeHtml(hub.name)}</span>
            <span class="hub-card-meta">👥 ${hub.member_count} ${t('member-count')}</span>
        </span>
        <span class="hub-card-unread" data-hub-unread="${Number(hub.id)}" style="display:none;"></span>
    `;

    card.addEventListener('click', () => openHub(hub.id));

    return card;

}


async function loadHubList() {

    try {

        const response = await fetch('/api/hubs', { credentials: 'include' });
        const data = await response.json();

        if (!data.success) return;

        hubListGridOwned.innerHTML = '';
        hubListGridJoined.innerHTML = '';

        const hasHubs = data.hubs.length > 0;

        hubListEmpty.style.display = hasHubs ? 'none' : 'flex';
        hubListHeader.style.display = hasHubs ? 'flex' : 'none';
        hubListContent.style.display = hasHubs ? 'block' : 'none';

        data.hubs.forEach((hub) => {

            const card = renderHubCard(hub);

            if (hub.is_owner) {
                hubListGridOwned.appendChild(card);
            } else {
                hubListGridJoined.appendChild(card);
            }

        });

        renderHubUnreadBadges();
        hubListGridOwned.parentElement.style.display = hubListGridOwned.children.length ? 'block' : 'none';
        hubListGridJoined.parentElement.style.display = hubListGridJoined.children.length ? 'block' : 'none';

    } catch (error) {

        console.error('Lobi listesi alınamadı:', error);

    }

}


// =====================================================
// HUB OLUŞTURMA
// =====================================================

function hubNewSelect(id, values, labelFor, first) {
    return `<select id="${id}" class="discover-select">${first ? `<option value="">${escapeHtml(first)}</option>` : ''}${values.map((v) => `<option value="${escapeAttr(v)}">${escapeHtml(labelFor(v))}</option>`).join('')}</select>`;
}

function renderHubCreateDiscover() {
    const box = document.getElementById('hub-create-discover');
    box.innerHTML = `
        <span class="profile-field-label">${escapeHtml(t('hubset-visibility'))}</span>
        ${hubNewSelect('hubnew-visibility', ['private', 'invite_only', 'discoverable'], (v) => t('hubset-vis-' + v))}
        <p id="hubnew-visibility-hint" class="hubset-hint"></p>
        <div id="hubnew-fields" style="display:none; flex-direction:column; gap:8px;">
            <span class="profile-field-label">${escapeHtml(t('hubset-category'))}</span>
            ${hubNewSelect('hubnew-category', DISCOVER_CATEGORIES, (v) => t('discover-cat-' + v), t('hubset-category-pick'))}
            <span class="profile-field-label">${escapeHtml(t('hubset-topic'))}</span>
            <input type="text" id="hubnew-topic" class="hub-name-input" maxlength="40" placeholder="${escapeAttr(t('hubset-topic-placeholder'))}">
            <span class="profile-field-label">${escapeHtml(t('hubset-description'))}</span>
            <textarea id="hubnew-description" class="about-me-input" maxlength="300" placeholder="${escapeAttr(t('hubset-description-placeholder'))}"></textarea>
            <span class="profile-field-label">${escapeHtml(t('hubset-rules'))}</span>
            <textarea id="hubnew-rules" class="about-me-input" maxlength="800" placeholder="${escapeAttr(t('hubset-rules-placeholder'))}"></textarea>
            <span class="profile-field-label">${escapeHtml(t('hubset-language'))}</span>
            ${hubNewSelect('hubnew-language', DISCOVER_LANGUAGES, (v) => t('discover-lang-' + v), '—')}
            <span class="profile-field-label">${escapeHtml(t('hubset-join-policy'))}</span>
            ${hubNewSelect('hubnew-join-policy', DISCOVER_POLICIES, (v) => t('discover-policy-' + v))}
            <span class="profile-field-label">${escapeHtml(t('hubset-mic'))}</span>
            ${hubNewSelect('hubnew-mic', DISCOVER_MICS, (v) => t('discover-mic-' + v))}
            <span class="profile-field-label">${escapeHtml(t('hubset-capacity'))}</span>
            <input type="number" id="hubnew-capacity" class="hub-name-input" min="2" max="500" inputmode="numeric" placeholder="2 - 500">
        </div>`;
    const vis = document.getElementById('hubnew-visibility');
    const sync = () => {
        document.getElementById('hubnew-fields').style.display = vis.value === 'discoverable' ? 'flex' : 'none';
        document.getElementById('hubnew-visibility-hint').textContent = t('hubset-vis-hint-' + vis.value);
    };
    vis.addEventListener('change', sync);
    sync();
}

function collectHubCreateDiscover() {
    const visibility = document.getElementById('hubnew-visibility').value || 'private';
    const body = { visibility };
    if (visibility === 'discoverable') {
        const capacity = document.getElementById('hubnew-capacity').value.trim();
        Object.assign(body, {
            category: document.getElementById('hubnew-category').value || null,
            topic: document.getElementById('hubnew-topic').value,
            description: document.getElementById('hubnew-description').value,
            rules: document.getElementById('hubnew-rules').value,
            language: document.getElementById('hubnew-language').value || null,
            join_policy: document.getElementById('hubnew-join-policy').value || 'everyone',
            mic_requirement: document.getElementById('hubnew-mic').value || 'none',
            capacity: capacity ? Number(capacity) : null
        });
    }
    return body;
}

function openHubCreateModal() {

    hubCreateNameInput.value = '';
    hubCreateImageData = null;
    hubCreateImagePreview.innerHTML = '';
    hubCreateImagePreview.style.display = 'none';
    renderHubCreateDiscover();
    hubCreateError.textContent = '';
    hubCreateModal.style.display = 'flex';
    hubCreateNameInput.focus();

}


hubCreateOpenBtn.addEventListener('click', openHubCreateModal);
hubCreateOpenBtnBig.addEventListener('click', openHubCreateModal);


hubCreateImageBtn.addEventListener(
    'click',
    () => hubCreateImageInput.click()
);


hubCreateImageInput.addEventListener(
    'change',
    async () => {

        const file = hubCreateImageInput.files[0];
        if (!file) return;

        try {

            const dataUrl = await openImageCropper(file, { aspect: 1, outWidth: 256, title: 'Lobi Görselini Kırp' });
            if (!dataUrl) return;
            hubCreateImageData = dataUrl;
            hubCreateImagePreview.innerHTML = `<img src="${escapeAttr(hubCreateImageData)}" alt="">`;
            hubCreateImagePreview.style.display = '';

        } catch (error) {

            console.error('Görsel işlenemedi:', error);
            showToast('Görsel işlenemedi.');

        } finally {

            hubCreateImageInput.value = '';

        }

    }
);


hubCreateSubmitBtn.addEventListener(
    'click',
    async () => {

        const name = hubCreateNameInput.value.trim();
        hubCreateError.textContent = '';

        if (!name) {
            hubCreateError.textContent = 'Lobi adı gerekli.';
            return;
        }

        hubCreateSubmitBtn.disabled = true;
        hubCreateSubmitBtn.textContent = 'Oluşturuluyor...';

        try {

            const response = await fetch('/api/hubs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ name, image_data: hubCreateImageData, ...collectHubCreateDiscover() })
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                hubCreateError.textContent = data.error || 'Lobi oluşturulamadı.';
                return;
            }

            hubCreateModal.style.display = 'none';
            loadHubList();
            openHub(data.id);

        } catch (error) {

            console.error('Lobi oluşturulamadı:', error);
            hubCreateError.textContent = 'Sunucuya bağlanılamadı.';

        } finally {

            hubCreateSubmitBtn.disabled = false;
            hubCreateSubmitBtn.textContent = 'Lobiyi Oluştur';

        }

    }
);


// =====================================================
// DAVET KODUYLA KATIL / DAVET OLUŞTUR
// =====================================================

hubJoinOpenBtn.addEventListener(
    'click',
    () => {

        hubJoinCodeInput.value = '';
        hubJoinError.textContent = '';
        hubJoinModal.style.display = 'flex';
        hubJoinCodeInput.focus();

    }
);


hubJoinCloseBtn.addEventListener(
    'click',
    () => hubJoinModal.style.display = 'none'
);


hubJoinModal.addEventListener(
    'click',
    (event) => {
        if (event.target === hubJoinModal) hubJoinModal.style.display = 'none';
    }
);


hubJoinSubmitBtn.addEventListener(
    'click',
    async () => {

        const code = hubJoinCodeInput.value.trim();
        hubJoinError.textContent = '';

        if (!code) return;

        hubJoinSubmitBtn.disabled = true;

        try {

            const response = await fetch('/api/hubs/join', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ code })
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                hubJoinError.textContent = data.error || 'Katılınamadı.';
                return;
            }

            hubJoinModal.style.display = 'none';
            loadHubList();
            openHub(data.hub_id);

        } catch (error) {

            console.error('Davetle katılınamadı:', error);
            hubJoinError.textContent = 'Sunucuya bağlanılamadı.';

        } finally {

            hubJoinSubmitBtn.disabled = false;

        }

    }
);


function inviteIsEn() {
    try { return localStorage.getItem('sauran_lang') === 'en'; } catch (_) { return false; }
}

// "2 sa 15 dk kaldı" / "süresiz" ve "3/10 kullanım" gibi kısa özet.
function inviteSummaryText(inv) {
    const en = inviteIsEn();
    const parts = [];
    if (inv.expires_at) {
        const mins = Math.max(0, Math.round((new Date(inv.expires_at).getTime() - Date.now()) / 60000));
        let left;
        if (mins >= 1440) left = en ? `${Math.floor(mins / 1440)} d` : `${Math.floor(mins / 1440)} gün`;
        else if (mins >= 60) left = en ? `${Math.floor(mins / 60)} h${mins % 60 ? ` ${mins % 60} min` : ''}` : `${Math.floor(mins / 60)} sa${mins % 60 ? ` ${mins % 60} dk` : ''}`;
        else left = en ? `${mins} min` : `${mins} dk`;
        parts.push(en ? `expires in ${left}` : `${left} kaldı`);
    } else {
        parts.push(en ? 'no expiry' : 'süresiz');
    }
    parts.push(inv.max_uses ? `${Number(inv.uses || 0)}/${Number(inv.max_uses)} ${en ? 'uses' : 'kullanım'}` : `${Number(inv.uses || 0)} ${en ? 'uses' : 'kullanım'} · ${en ? 'no limit' : 'sınırsız'}`);
    return parts.join(' · ');
}

async function loadHubInvites() {
    if (!currentHub) return;
    const list = document.getElementById('hub-invites-list');
    try {
        const data = await (await fetch(`/api/hubs/${currentHub.id}/invites`, { credentials: 'include' })).json();
        if (!data.success) { list.innerHTML = ''; return; }
        document.getElementById('hub-invites-title').textContent = t(data.can_manage_all ? 'invites-active' : 'invites-mine');
        if (!data.invites.length) { list.innerHTML = `<div class="settings-blocked-empty">${t('invites-empty')}</div>`; return; }
        list.innerHTML = data.invites.map((inv) => `
            <div class="settings-blocked-row">
                <span class="settings-blocked-name"><span class="invite-row-code">${escapeHtml(inv.code)}</span>
                    <span class="voice-mute-row-meta">${data.can_manage_all && !inv.mine ? `👤 ${escapeHtml(inv.creator?.username || '—')} · ` : ''}${escapeHtml(inviteSummaryText(inv))}</span>
                </span>
                <button class="settings-unblock-btn" type="button" data-revoke-invite="${escapeAttr(inv.code)}">${t('invite-revoke')}</button>
            </div>`).join('');
    } catch (error) {
        console.error('Davet kodları alınamadı:', error);
    }
}

document.getElementById('hub-invites-list').addEventListener('click', async (event) => {
    const btn = event.target.closest('[data-revoke-invite]');
    if (!btn || !currentHub) return;
    if (!confirm(t('invite-revoke-confirm'))) return;
    try {
        const data = await (await fetch(`/api/hubs/${currentHub.id}/invites/${encodeURIComponent(btn.dataset.revokeInvite)}`, { method: 'DELETE', credentials: 'include' })).json();
        if (!data.success) { showToast(data.error || 'İptal edilemedi.'); return; }
        loadHubInvites();
    } catch (_) { /* yoksay */ }
});

hubInviteBtn.addEventListener('click', () => {
    if (!currentHub) return;
    document.getElementById('hub-invite-options').style.display = 'flex';
    document.getElementById('hub-invite-result').style.display = 'none';
    document.getElementById('hub-invite-error').textContent = '';
    hubInviteModal.style.display = 'flex';
});

document.getElementById('hub-invite-create-btn').addEventListener('click', async () => {
    if (!currentHub) return;
    const btn = document.getElementById('hub-invite-create-btn');
    const error = document.getElementById('hub-invite-error');
    const expiry = document.getElementById('hub-invite-expiry').value;
    const uses = document.getElementById('hub-invite-uses').value;
    btn.disabled = true;
    error.textContent = '';
    try {
        const response = await fetch(`/api/hubs/${currentHub.id}/invite`, {
            method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ expires_in_minutes: expiry === 'never' ? 'never' : Number(expiry), max_uses: uses === 'unlimited' ? 'unlimited' : Number(uses) })
        });
        const data = await response.json();
        if (!data.success) { error.textContent = data.error || 'Davet oluşturulamadı.'; return; }
        hubInviteCodeDisplay.textContent = data.code;
        document.getElementById('hub-invite-summary').textContent = inviteSummaryText({ expires_at: data.expires_at, max_uses: data.max_uses, uses: 0 });
        const expiryNote = document.getElementById('hub-invite-expiry-note');
        if (expiryNote) expiryNote.textContent = !data.expires_at && data.expires_after_idle_days ? t('invite-expiry-note').replace('{days}', data.expires_after_idle_days) : '';
        document.getElementById('hub-invite-options').style.display = 'none';
        document.getElementById('hub-invite-result').style.display = 'flex';
        loadHubInvites();
    } catch (err) {
        console.error('Davet oluşturulamadı:', err);
        error.textContent = 'Bağlantı hatası.';
    } finally {
        btn.disabled = false;
    }
});

document.getElementById('hub-invite-copy-btn').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(hubInviteCodeDisplay.textContent); showToast(inviteIsEn() ? 'Copied.' : 'Kopyalandı.'); }
    catch (_) { showToast(inviteIsEn() ? 'Could not copy.' : 'Kopyalanamadı.'); }
});


hubInviteCloseBtn.addEventListener(
    'click',
    () => hubInviteModal.style.display = 'none'
);


hubInviteModal.addEventListener(
    'click',
    (event) => {
        if (event.target === hubInviteModal) hubInviteModal.style.display = 'none';
    }
);


// =====================================================
// ARKADAŞINI HUB'A DAVET ET
// =====================================================

hubInviteFriendBtn.addEventListener(
    'click',
    async () => {

        if (!currentHub) return;

        try {

            const response = await fetch('/api/friends', { credentials: 'include' });
            const data = await response.json();

            if (!data.success) return;

            hubInviteFriendList.innerHTML = '';

            const memberIds = new Set((currentHub.members || []).map(m => m.user_id));
            const invitableFriends = data.friends.filter(friend => !memberIds.has(friend.id));

            if (invitableFriends.length === 0) {
                hubInviteFriendList.innerHTML = '<div class="liquid-friend-empty">Davet edilebilecek arkadaşın yok.</div>';
            }

            invitableFriends.forEach((friend) => {

                const li = document.createElement('li');
                li.className = 'liquid-friend-row';

                li.innerHTML = `
                    ${avatarButtonHtml(friend.id, friend.avatar_data, friend.username, friend.avatar_frame, friend.profile_color)}
                    <span class="liquid-friend-name">${usernameCardHtml(friend.username, friend.plus_active, friend.name_effect)}</span>
                    <button class="liquid-friend-invite-btn" data-invite-user="${friend.id}" type="button">Davet Et</button>
                `;

                hubInviteFriendList.appendChild(li);

            });

            wireMsgAvatars(hubInviteFriendList);

            hubInviteFriendList.querySelectorAll('[data-invite-user]').forEach((btn) => {

                btn.addEventListener('click', async (event) => {

                    event.stopPropagation();

                    const toUserId = Number(btn.dataset.inviteUser);

                    const response = await fetch(`/api/hubs/${currentHub.id}/invite-friend`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify({ to_user_id: toUserId })
                    });

                    const result = await response.json();

                    btn.textContent = result.success ? 'Gönderildi ✓' : (result.error || 'Hata');
                    btn.disabled = true;

                });

            });

            hubInviteFriendModal.style.display = 'flex';

        } catch (error) {

            console.error('Arkadaş listesi alınamadı:', error);

        }

    }
);


hubInviteFriendCloseBtn.addEventListener(
    'click',
    () => hubInviteFriendModal.style.display = 'none'
);


hubInviteFriendModal.addEventListener(
    'click',
    (event) => {
        if (event.target === hubInviteFriendModal) hubInviteFriendModal.style.display = 'none';
    }
);


hubCreateCloseBtn.addEventListener(
    'click',
    () => hubCreateModal.style.display = 'none'
);


hubCreateModal.addEventListener(
    'click',
    (event) => {
        if (event.target === hubCreateModal) hubCreateModal.style.display = 'none';
    }
);



// =====================================================
// HUB DETAY
// =====================================================


// =====================================================
// GRUP DM (sunucuda lobi altyapısı, type = 'group')
// =====================================================
const GROUP_MAX_MEMBERS = 10;
var groupsCache = [];
var groupPickMode = 'create'; // create | add
var groupPickSelected = new Set();
var groupPickFriends = [];

function isGroupHub(hub) {
    return Boolean(hub && hub.type === 'group');
}

function groupDisplayName(group) {
    if (group && group.name) return group.name;
    const others = (group?.members || []).filter((m) => (m.user_id ?? m.id) !== currentUser?.id).map((m) => m.username);
    if (!others.length) return t('group-empty-name');
    return others.slice(0, 3).join(', ') + (others.length > 3 ? ` +${others.length - 3}` : '');
}

function groupAvatarHtml(group) {
    const others = (group.members || []).filter((m) => m.id !== currentUser?.id).slice(0, 2);
    const list = others.length ? others : (group.members || []).slice(0, 1);
    return `<span class="group-avatar" aria-hidden="true">${list.map((m) => `<span style="--user-color:${getUserColor(m.username || '?')};">${m.avatar_data ? `<img src="${escapeAttr(m.avatar_data)}" alt="">` : escapeHtml((m.username || '?').charAt(0).toUpperCase())}</span>`).join('')}</span>`;
}

async function loadGroups() {
    try {
        const data = await (await fetch('/api/groups', { credentials: 'include' })).json();
        if (!data.success) return;
        groupsCache = data.groups;
        renderGroupsList();
    } catch (error) {
        console.error('Gruplar alınamadı:', error);
    }
}

function renderGroupsList() {
    const list = document.getElementById('friends-groups-list');
    if (!list) return;
    if (!groupsCache.length) {
        list.innerHTML = `<div class="friends-groups-empty">${t('groups-empty')}</div>`;
        return;
    }
    list.innerHTML = groupsCache.map((g) => `
        <button type="button" class="group-row${currentHub && currentHub.id === g.id ? ' active' : ''}" data-group-id="${g.id}">
            ${groupAvatarHtml(g)}
            <span class="group-row-text">
                <span class="group-row-name">${escapeHtml(groupDisplayName(g))}</span>
                <span class="group-row-sub">${t('group-member-count').replace('{n}', String(g.members.length))}</span>
            </span>
            <span class="hub-card-unread" data-hub-unread="${g.id}" style="display:none;"></span>
        </button>`).join('');
    renderHubUnreadBadges();
}

document.getElementById('friends-groups-list').addEventListener('click', (event) => {
    const row = event.target.closest('[data-group-id]');
    if (!row) return;
    openHub(Number(row.dataset.groupId));
});

// ── Grup oluştur / kişi ekle penceresi ──
const groupPickModal = document.getElementById('group-pick-modal');

async function openGroupPick(mode) {
    groupPickMode = mode;
    groupPickSelected = new Set();
    document.getElementById('group-pick-title').textContent = mode === 'create' ? t('group-create-title') : t('group-add-title');
    document.getElementById('group-pick-submit').textContent = mode === 'create' ? t('group-create-btn') : t('group-add-btn');
    document.getElementById('group-pick-name').style.display = mode === 'create' ? '' : 'none';
    document.getElementById('group-pick-name').value = '';
    document.getElementById('group-pick-search').value = '';
    document.getElementById('group-pick-error').textContent = '';
    try {
        const data = await (await fetch('/api/friends', { credentials: 'include' })).json();
        groupPickFriends = data.success ? data.friends : [];
    } catch (_) { groupPickFriends = []; }
    renderGroupPick();
    groupPickModal.style.display = 'flex';
    setTimeout(() => document.getElementById(mode === 'create' ? 'group-pick-name' : 'group-pick-search').focus(), 30);
}

function groupPickCapacity() {
    const existing = groupPickMode === 'add' && currentHub ? currentHub.members.length : 1;
    return GROUP_MAX_MEMBERS - existing;
}

function renderGroupPick() {
    const q = document.getElementById('group-pick-search').value.trim().toLocaleLowerCase('tr');
    const inGroup = new Set(groupPickMode === 'add' && currentHub ? currentHub.members.map((m) => m.user_id) : []);
    const capacity = groupPickCapacity();
    const friends = groupPickFriends.filter((f) => !q || f.username.toLocaleLowerCase('tr').includes(q));
    const list = document.getElementById('group-pick-list');
    list.innerHTML = friends.length ? friends.map((f) => {
        const already = inGroup.has(f.id);
        const checked = already || groupPickSelected.has(f.id);
        const disabled = already || (!checked && groupPickSelected.size >= capacity);
        return `<label class="group-pick-item${disabled ? ' disabled' : ''}">
            <input type="checkbox" data-pick-id="${f.id}" ${checked ? 'checked' : ''} ${disabled ? 'disabled' : ''}>
            <span class="settings-blocked-avatar" style="--user-color:${getUserColor(f.username)};">${f.avatar_data ? `<img src="${escapeAttr(f.avatar_data)}" alt="">` : escapeHtml(f.username.charAt(0).toUpperCase())}</span>
            <span>${escapeHtml(f.username)}${already ? ` <span class="group-pick-count">· ${t('group-already')}</span>` : ''}</span>
        </label>`;
    }).join('') : `<div class="friends-groups-empty">${t(groupPickFriends.length ? 'group-pick-nomatch' : 'group-pick-nofriends')}</div>`;
    document.getElementById('group-pick-count').textContent = t('group-pick-count').replace('{n}', String(groupPickSelected.size)).replace('{max}', String(capacity));
    document.getElementById('group-pick-submit').disabled = groupPickSelected.size === 0;
}

document.getElementById('group-pick-list').addEventListener('change', (event) => {
    const box = event.target.closest('[data-pick-id]');
    if (!box) return;
    const id = Number(box.dataset.pickId);
    if (box.checked) groupPickSelected.add(id); else groupPickSelected.delete(id);
    renderGroupPick();
});
document.getElementById('group-pick-search').addEventListener('input', renderGroupPick);
document.getElementById('group-pick-close-btn').addEventListener('click', () => { groupPickModal.style.display = 'none'; });
groupPickModal.addEventListener('click', (event) => { if (event.target === groupPickModal) groupPickModal.style.display = 'none'; });
document.getElementById('group-create-open-btn').addEventListener('click', () => openGroupPick('create'));

document.getElementById('group-pick-submit').addEventListener('click', async () => {
    const btn = document.getElementById('group-pick-submit');
    const error = document.getElementById('group-pick-error');
    btn.disabled = true;
    error.textContent = '';
    try {
        const ids = [...groupPickSelected];
        const response = groupPickMode === 'create'
            ? await fetch('/api/groups', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: document.getElementById('group-pick-name').value.trim(), member_ids: ids }) })
            : await fetch(`/api/groups/${currentHub.id}/members`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_ids: ids }) });
        const data = await response.json();
        if (!data.success) { error.textContent = data.error || 'Olmadı.'; return; }
        groupPickModal.style.display = 'none';
        if (groupPickMode === 'create') {
            await loadGroups();
            openHub(data.group_id);
        } else {
            refreshGroupSettings();
        }
    } catch (_) {
        error.textContent = 'Bağlantı hatası.';
    } finally {
        btn.disabled = groupPickSelected.size === 0;
    }
});

// ── Grup ayarları ──
const groupSettingsModal = document.getElementById('group-settings-modal');

function renderGroupSettings() {
    if (!currentHub || !isGroupHub(currentHub)) return;
    document.getElementById('group-settings-name').value = currentHub.name || '';
    document.getElementById('group-settings-name').placeholder = groupDisplayName(currentHub);
    document.getElementById('group-settings-notify').checked = !currentHub.my_muted;
    document.getElementById('group-settings-count').textContent = t('group-members-title').replace('{n}', String(currentHub.members.length)).replace('{max}', String(GROUP_MAX_MEMBERS));
    document.getElementById('group-settings-add').style.display = currentHub.members.length >= GROUP_MAX_MEMBERS ? 'none' : '';
    document.getElementById('group-settings-error').textContent = '';
    document.getElementById('group-settings-members').innerHTML = currentHub.members.map((m) => {
        const isOwner = m.permission_tier === 'owner';
        const me = m.user_id === currentUser?.id;
        return `<div class="settings-blocked-row">
            <span class="settings-blocked-avatar" style="--user-color:${getUserColor(m.username)};">${m.avatar_data ? `<img src="${escapeAttr(m.avatar_data)}" alt="">` : escapeHtml(m.username.charAt(0).toUpperCase())}</span>
            <span class="settings-blocked-name">${escapeHtml(m.username)}${me ? ` <span class="voice-mute-row-meta">${t('group-you')}</span>` : ''}${isOwner ? ` <span class="voice-mute-row-meta">👑 ${t('group-owner')}</span>` : ''}</span>
            ${currentHub.is_owner && !me ? `<button class="settings-unblock-btn" type="button" data-group-remove="${m.user_id}" data-group-remove-name="${escapeAttr(m.username)}">${t('group-remove')}</button>` : ''}
        </div>`;
    }).join('');
}

async function refreshGroupSettings() {
    if (!currentHub) return;
    try {
        const data = await (await fetch(`/api/hubs/${currentHub.id}`, { credentials: 'include' })).json();
        if (!data.success) return;
        currentHub = data.hub;
        renderHubDetail();
        renderGroupSettings();
    } catch (_) { /* yoksay */ }
}

document.getElementById('group-settings-btn').addEventListener('click', () => {
    renderGroupSettings();
    groupSettingsModal.style.display = 'flex';
});
document.getElementById('group-settings-close-btn').addEventListener('click', () => { groupSettingsModal.style.display = 'none'; });
groupSettingsModal.addEventListener('click', (event) => { if (event.target === groupSettingsModal) groupSettingsModal.style.display = 'none'; });
document.getElementById('group-settings-add').addEventListener('click', () => openGroupPick('add'));

async function groupSettingsCall(url, options, okToast) {
    const error = document.getElementById('group-settings-error');
    error.textContent = '';
    try {
        const data = await (await fetch(url, { credentials: 'include', headers: { 'Content-Type': 'application/json' }, ...options })).json();
        if (!data.success) { error.textContent = data.error || 'Olmadı.'; return null; }
        if (okToast) showToast(okToast);
        return data;
    } catch (_) {
        error.textContent = 'Bağlantı hatası.';
        return null;
    }
}

document.getElementById('group-settings-rename').addEventListener('click', async () => {
    if (!currentHub) return;
    const data = await groupSettingsCall(`/api/groups/${currentHub.id}`, { method: 'PATCH', body: JSON.stringify({ name: document.getElementById('group-settings-name').value.trim() }) }, t('group-renamed'));
    if (data) refreshGroupSettings();
});

document.getElementById('group-settings-notify').addEventListener('change', async (event) => {
    if (!currentHub) return;
    const muted = !event.target.checked;
    try {
        await fetch(`/api/hubs/${currentHub.id}/mute`, { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ muted }) });
        currentHub.my_muted = muted;
    } catch (_) { event.target.checked = !muted; }
});

document.getElementById('group-settings-members').addEventListener('click', async (event) => {
    const btn = event.target.closest('[data-group-remove]');
    if (!btn || !currentHub) return;
    if (!confirm(t('group-remove-confirm').replace('{u}', btn.dataset.groupRemoveName))) return;
    const data = await groupSettingsCall(`/api/groups/${currentHub.id}/members/${Number(btn.dataset.groupRemove)}`, { method: 'DELETE' });
    if (data) refreshGroupSettings();
});

document.getElementById('group-settings-leave').addEventListener('click', async () => {
    if (!currentHub) return;
    const last = currentHub.members.length <= 1;
    if (!confirm(t(last ? 'group-leave-last-confirm' : 'group-leave-confirm'))) return;
    const groupId = currentHub.id;
    const data = await groupSettingsCall(`/api/groups/${groupId}/members/${currentUser.id}`, { method: 'DELETE' });
    if (!data) return;
    groupSettingsModal.style.display = 'none';
    leaveGroupView(groupId);
});

function leaveGroupView(groupId) {
    if (callMode === 'hub-room' && currentVoiceRoomHubId === groupId) leaveCall();
    if (currentHub && currentHub.id === groupId) {
        socket?.emit('leave_hub', groupId);
        currentHub = null;
        switchToView('hubs');
        loadHubList();
    }
    groupsCache = groupsCache.filter((g) => g.id !== groupId);
    unreadHubCounts.delete(groupId);
    renderGroupsList();
}

// Grup araması: grubun tek sesli odasına katılır.
document.getElementById('group-call-btn').addEventListener('click', async () => {
    if (!currentHub || !isGroupHub(currentHub)) return;
    if (!voiceRoomsCache || !voiceRoomsCache.length || voiceRoomsCache[0].hub_id !== currentHub.id) await loadVoiceRooms(currentHub.id);
    const room = (voiceRoomsCache || []).find((r) => r.hub_id === currentHub.id) || (voiceRoomsCache || [])[0];
    if (room) joinVoiceRoom(room);
});

function groupSystemText(msg) {
    const p = msg.payload || {};
    const actor = `<b>${escapeHtml(msg.username || t('deleted-account-short'))}</b>`;
    const users = (p.users || []).map((u) => `<b>${escapeHtml(u.username || '?')}</b>`).join(', ');
    switch (p.type) {
        case 'create': return t('group-sys-create').replace('{a}', actor).replace('{u}', users);
        case 'add': return t('group-sys-add').replace('{a}', actor).replace('{u}', users);
        case 'remove': return t('group-sys-remove').replace('{a}', actor).replace('{u}', users);
        case 'leave': return t('group-sys-leave').replace('{a}', actor) + (p.new_owner ? ' · ' + t('group-sys-new-owner').replace('{u}', `<b>${escapeHtml(p.new_owner.username)}</b>`) : '');
        case 'rename': return p.name ? t('group-sys-rename').replace('{a}', actor).replace('{n}', `<b>${escapeHtml(p.name)}</b>`) : t('group-sys-rename-clear').replace('{a}', actor);
        default: return '';
    }
}

async function openHub(hubId) {

    nativeNotifyCancel(`hub-${hubId}`);
    clearTyping('hub');
    if (msgSearchPanel?.dataset.kind === 'hub') closeMessageSearch();
    unreadHubCounts.delete(hubId);
    renderHubUnreadBadges();

    try {

        const response = await fetch(`/api/hubs/${hubId}`, { credentials: 'include' });
        const data = await response.json();

        if (!data.success) return;

        currentHub = data.hub;
        resetSlowModeForHub();

        switchToView('hub-detail');
        renderHubDetail();
        loadLobbySupporters(currentHub.id);

        if (socket) {
            socket.emit('join_hub', hubId);
        }

        loadHubMessages(hubId);
        loadVoiceRooms(hubId);

    } catch (error) {

        console.error('Lobi açılamadı:', error);

    }

}


hubBackBtn.addEventListener(
    'click',
    () => {
        switchToView('hubs');
        loadHubList();
    }
);


function renderHubDetail() {

    if (!currentHub) return;

    hubDetailView.dataset.hubTheme = currentHub.theme || 'default';
    hubDetailView.classList.toggle('has-hub-bg', Boolean(currentHub.bg_image));
    if (currentHub.bg_image) hubDetailView.style.setProperty('--hub-bg-image', cssImageUrl(currentHub.bg_image));
    else hubDetailView.style.removeProperty('--hub-bg-image');

    if (currentHub.image_data) {
        hubDetailIcon.innerHTML = `<img src="${escapeAttr(currentHub.image_data)}" alt="" style="width:22px;height:22px;border-radius:6px;object-fit:cover;">`;
    } else {
        hubDetailIcon.innerHTML = hubInitialHtml(currentHub.name);
    }

    const group = isGroupHub(currentHub);
    hubDetailView.classList.toggle('is-group', group);
    // Telefonda lobi düğmeleri üst çubuğa taşınıyor: grup gizlemesi sayfa genelinde (body) yapılır.
    document.body.classList.toggle('in-group', group);
    document.getElementById('group-call-btn').style.display = group ? '' : 'none';
    document.getElementById('group-settings-btn').style.display = group ? '' : 'none';
    hubDetailName.textContent = group ? groupDisplayName(currentHub) : currentHub.name;
    hubDetailCount.textContent = `${currentHub.members.length} ${t('member-count')}`;
    if (group && !currentHub.image_data) hubDetailIcon.innerHTML = '👥';
    if (group) document.querySelectorAll('.group-row').forEach((r) => r.classList.toggle('active', Number(r.dataset.groupId) === currentHub.id));

    hubDeleteBtn.style.display = currentHub.is_owner ? 'block' : 'none';
    if (hubSettingsOpenBtn) {
        const canOpenSettings = currentHub.is_owner || currentHub.my_permission_tier === 'moderator';
        hubSettingsOpenBtn.style.display = canOpenSettings ? 'block' : 'none';
    }

    // Lobi sahibi kendi Lobi'ını bildiremez (anlamsız) — backend de aynı
    // kontrolü ayrıca uyguluyor (bkz. server/db.js createReport).
    const hubReportBtnEl = document.getElementById('hub-report-btn');
    if (hubReportBtnEl) hubReportBtnEl.style.display = currentHub.is_owner ? 'none' : 'block';

    // Katıldığım ama sahibi olmadığım Lobiler için: Bildirimleri Sustur /
    // Lobiyi Bildir / Lobiden Ayrıl seçeneklerini içeren küçük menü.
    if (hubMemberOptionsWrap) {
        const showMemberOptions = currentHub.is_member && !currentHub.is_owner;
        hubMemberOptionsWrap.style.display = showMemberOptions ? 'block' : 'none';
        if (showMemberOptions && hubMuteToggle) hubMuteToggle.checked = Boolean(currentHub.my_muted);
    }

    renderHubMembers();

}


hubDeleteBtn.addEventListener(
    'click',
    async () => {

        if (!currentHub) return;

        if (!confirm(`"${currentHub.name}" Lobisini kalıcı olarak silmek istediğine emin misin?`)) return;

        const response = await fetch(`/api/hubs/${currentHub.id}`, {
            method: 'DELETE',
            credentials: 'include'
        });

        const data = await response.json();
        if (!data.success) return;

        switchToView('hubs');
        loadHubList();

    }
);

const hubReportBtn = document.getElementById('hub-report-btn');

hubReportBtn?.addEventListener('click', () => {
    if (!currentHub) return;
    openReportModal('hub', currentHub.id, currentHub.name);
});


// =====================================================
// LOBİ ÜYESİ SEÇENEKLERİ (Bildirimleri Sustur / Bildir / Ayrıl)
// =====================================================
// Sadece katıldığın ama sahibi olmadığın Lobiler'de görünür (bkz. renderHubDetail).

const hubMemberOptionsWrap = document.getElementById('hub-member-options-wrap');
const hubMemberOptionsBtn = document.getElementById('hub-member-options-btn');
const hubMemberOptionsMenu = document.getElementById('hub-member-options-menu');
const hubMuteToggle = document.getElementById('hub-mute-toggle');
const hubMemberReportBtn = document.getElementById('hub-member-report-btn');
const hubMemberLeaveBtn = document.getElementById('hub-member-leave-btn');

hubMemberOptionsBtn?.addEventListener('click', (event) => {
    event.stopPropagation();
    const willOpen = hubMemberOptionsMenu.style.display !== 'flex';
    closeAllMessageMenus();
    hubMemberOptionsMenu.style.display = willOpen ? 'flex' : 'none';
});

hubMuteToggle?.addEventListener('click', (event) => event.stopPropagation());

hubMuteToggle?.addEventListener('change', async () => {
    if (!currentHub) return;

    const muted = hubMuteToggle.checked;

    try {
        const res = await fetch(`/api/hubs/${currentHub.id}/mute`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ muted })
        });
        const data = await res.json();
        if (!data.success) {
            hubMuteToggle.checked = !muted;
            showToast(data.error || 'Kaydedilemedi.');
            return;
        }
        currentHub.my_muted = muted;
    } catch (error) {
        console.error('Lobi susturma tercihi kaydedilemedi:', error);
        hubMuteToggle.checked = !muted;
    }
});

hubMemberReportBtn?.addEventListener('click', () => {
    if (!currentHub) return;
    hubMemberOptionsMenu.style.display = 'none';
    openReportModal('hub', currentHub.id, currentHub.name);
});

hubMemberLeaveBtn?.addEventListener('click', async () => {
    if (!currentHub) return;
    hubMemberOptionsMenu.style.display = 'none';

    const confirmMsg = t('confirm-leave-hub').replace('{name}', currentHub.name);
    if (!confirm(confirmMsg)) return;

    try {
        const res = await fetch(`/api/hubs/${currentHub.id}/leave`, { method: 'POST', credentials: 'include' });
        const data = await res.json();
        if (!data.success) {
            showToast(data.error || 'Ayrılınamadı.');
            return;
        }
        showToast(t('left-hub-toast'));
        switchToView('hubs');
        loadHubList();
    } catch (error) {
        console.error('Lobiden ayrılınamadı:', error);
    }
});


// =====================================================
// BİLDİR (REPORT) SİSTEMİ
// =====================================================

const reportModal = document.getElementById('report-modal');
const reportModalCloseBtn = document.getElementById('report-modal-close-btn');
const reportDescriptionInput = document.getElementById('report-description-input');
const reportModalError = document.getElementById('report-modal-error');
const reportSubmitBtn = document.getElementById('report-submit-btn');

let reportTarget = null;

function openReportModal(targetType, targetId, label) {
    reportTarget = { target_type: targetType, target_id: targetId };
    reportDescriptionInput.value = '';
    reportModalError.textContent = '';
    const firstRadio = reportModal.querySelector('input[name="report-reason"]');
    if (firstRadio) firstRadio.checked = true;
    reportModal.style.display = 'flex';
}

reportModalCloseBtn?.addEventListener('click', () => {
    reportModal.style.display = 'none';
});

reportModal?.addEventListener('click', (e) => {
    if (e.target === reportModal) reportModal.style.display = 'none';
});

reportSubmitBtn?.addEventListener('click', async () => {

    if (!reportTarget) return;

    const reasonInput = reportModal.querySelector('input[name="report-reason"]:checked');
    const reason = reasonInput ? reasonInput.value : 'other';
    const description = reportDescriptionInput.value.trim();

    try {

        const response = await fetch('/api/reports', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
                target_type: reportTarget.target_type,
                target_id: reportTarget.target_id,
                reason,
                description
            })
        });

        const data = await response.json();

        if (data.success) {
            reportModal.style.display = 'none';
            showCenterToast(t('report-success-toast'));
        } else {
            reportModalError.textContent = data.error || t('report-error-toast');
        }

    } catch {
        reportModalError.textContent = t('report-error-toast');
    }

});


// =====================================================
// SESLİ SOHBET (DAILY.CO)
// =====================================================

// Lobi sesli sohbeti artık odalar üzerinden yönetiliyor (bkz. joinVoiceRoom,
// hub-voice-rooms-side paneli). Eski tekil "Sesli Sohbet" butonu kaldırıldı.


// ─── DM SESLİ ARAMA (kamera / ekran paylaşımı yok) ───────────────────────

dmCallBtn.addEventListener('click', () => {

    if (callFrame) {
        leaveCall();
        return;
    }

    if (!activeDmUserId || !socket) return;

    outgoingCallToId = activeDmUserId;
    outgoingCallToUsername = activeDmUsername;

    socket.emit('dm_call_invite', { to_user_id: activeDmUserId });

    callMode = 'dm-ringing';
    callHubName.textContent = `📞 ${activeDmUsername}`;
    callScreenshareBtn.style.display = 'none';
    callFrameContainer.style.display = 'none';
    callRingingText.textContent = `${activeDmUsername} aranıyor...`;
    setRingingUi(true);
    setCallAvatar(document.getElementById('call-ringing-avatar'), activeDmUserId, activeDmUsername, setCallRingBackground);
    callOverlay.style.display = 'flex';

});

callRingingCancelBtn.addEventListener('click', () => {
    if (outgoingCallToId && socket) socket.emit('dm_call_cancel', { to_user_id: outgoingCallToId });
    endDmCallUi();
});

// Arayan kişi aramayı iptal ederken bizim soketimiz kopuksa (uygulama arka plana alınmış) 'iptal'
// olayı kaçırılır ve zil sonsuza dek çalardı. Sunucu çağrı durumunu tutmadığı için istemci tarafında
// gelen arama bu süre sonra kendiliğinden kapanır.
const INCOMING_CALL_RING_TIMEOUT_MS = 45_000;
let incomingCallRingTimer = null;

// "Aranıyor" ekranında yalnızca "İptal Et" vardır; "Ayrıl" düğmesi çalma sırasında anlamsızdı
// (karşı taraf çalmaya devam ediyordu). Çalma ekranını tek yerden aç/kapat.
function setRingingUi(on) {
    callRingingState.style.display = on ? 'flex' : 'none';
    callLeaveBtn.style.display = on ? 'none' : '';
    if (!on) setCallRingBackground(null);
}

// Arama/gelen arama ekranı avatarı: profil görseli varsa görsel, yoksa kullanıcı adının baş harfi.
// Görsel bilinmiyorsa profilden alınır (gizlilik ayarına göre sunucu süzer). onPhoto: görsel bulunduğunda çağrılır.
function setCallAvatar(el, userId, username, onPhoto) {
    if (!el) return;
    const paint = () => {
        const avatar = knownAvatars.get(userId) || null;
        el.classList.toggle('has-photo', Boolean(avatar));
        el.style.setProperty('--user-color', getUserColor(username || ''));
        el.innerHTML = avatar
            ? `<img src="${escapeAttr(avatar)}" alt="">`
            : `<span class="call-avatar-initial">${escapeHtml((username || '?').charAt(0).toUpperCase())}</span>`;
        if (avatar && onPhoto) onPhoto(avatar);
    };
    paint();
    if (!knownAvatars.get(userId)) {
        fetch(`/api/users/${userId}/profile`, { credentials: 'include' })
            .then((r) => r.json())
            .then((data) => {
                const avatar = data && data.success && data.profile && data.profile.avatar_data;
                if (avatar) { knownAvatars.set(userId, avatar); paint(); }
            })
            .catch(() => { /* görsel alınamazsa baş harf kalır */ });
    }
}

// Aranan kişinin görseli varsa arama ekranının arkasında bulanık arka plan olarak gösterilir.
function setCallRingBackground(url) {
    const bg = document.getElementById('call-ring-bg');
    if (!bg) return;
    if (url) { bg.style.backgroundImage = `url("${String(url).replace(/"/g, '%22')}")`; bg.style.display = 'block'; }
    else { bg.style.display = 'none'; bg.style.backgroundImage = ''; }
}

function showIncomingCall(fromId, fromUsername) {

    if (callFrame || callMode) return; // zaten görüşmedeyse gelen aramayı gösterme

    incomingCallFromId = fromId;
    incomingCallFromUsername = fromUsername;

    dmIncomingCallUsername.textContent = fromUsername;
    setCallAvatar(document.getElementById('dm-incoming-call-avatar'), fromId, fromUsername);
    dmIncomingCallModal.style.display = 'flex';
    startRingtone();

    clearTimeout(incomingCallRingTimer);
    incomingCallRingTimer = setTimeout(() => {
        if (incomingCallFromId === fromId) hideIncomingCall();
    }, INCOMING_CALL_RING_TIMEOUT_MS);

    // Uygulama arka plandaysa (yerel uygulama) gelen aramayı bildirim çubuğunda da göster.
    if (getNativeNotify() && !nativeAppActive) {
        showSystemNotification(fromUsername, 'Seni arıyor', { tag: 'call', data: { url: '/' } }).catch(() => {});
    }

}

function hideIncomingCall() {
    clearTimeout(incomingCallRingTimer);
    incomingCallRingTimer = null;
    dmIncomingCallModal.style.display = 'none';
    incomingCallFromId = null;
    incomingCallFromUsername = '';
    stopRingtone();
    nativeNotifyCancel('call');
}

dmIncomingCallDeclineBtn.addEventListener('click', () => {
    if (incomingCallFromId && socket) socket.emit('dm_call_decline', { to_user_id: incomingCallFromId });
    hideIncomingCall();
});

dmIncomingCallAcceptBtn.addEventListener('click', () => {
    const fromId = incomingCallFromId;
    const fromUsername = incomingCallFromUsername;
    hideIncomingCall();
    if (socket) socket.emit('dm_call_accept', { to_user_id: fromId });
    joinDmCall(fromId, fromUsername);
});

async function joinDmCall(userId, username) {

    stopRingtone(); // görüşme başlarken hiçbir zil sesi devam etmesin

    outgoingCallToId = userId;
    outgoingCallToUsername = username;

    callHubName.textContent = `📞 ${username}`;
    callScreenshareBtn.style.display = 'none';
    setRingingUi(false);
    callFrameContainer.style.display = 'none';
    document.getElementById('call-hub-room-view').style.display = 'none';
    callOverlay.style.display = 'flex';

    const dmProfile = document.getElementById('call-dm-profile');
    const dmAvatar = document.getElementById('call-dm-avatar');
    const dmAvatarImg = document.getElementById('call-dm-avatar-img');
    const dmUsernameEl = document.getElementById('call-dm-username');
    const dmStatusText = document.getElementById('call-dm-status-text');

    if (dmStatusText) dmStatusText.textContent = t('call-connecting');
    dmUsernameEl.textContent = username;
    dmAvatar.textContent = username.charAt(0).toUpperCase();
    dmAvatar.style.setProperty('--user-color', getUserColor(username));
    dmAvatarImg.style.display = 'none';
    dmAvatar.style.display = 'flex';
    dmProfile.style.display = 'flex';

    fetch(`/api/users/${userId}/profile`, { credentials: 'include' })
        .then(r => r.json())
        .then((data) => {
            if (data.success && data.profile.avatar_data) {
                dmAvatarImg.src = data.profile.avatar_data;
                dmAvatarImg.style.display = 'block';
                dmAvatar.style.display = 'none';
            }
        })
        .catch(() => {});

    try {

        const response = await fetch(`/api/dm/${userId}/call/join`, {
            method: 'POST',
            credentials: 'include'
        });

        const data = await response.json();

        if (!data.success) {
            alert(data.error || 'Aramaya katılınamadı.');
            leaveCall();
            return;
        }

        callMode = 'dm';
        voiceLocalMuted = false;
        voiceUserMuted = false;
        await joinCallFrame(data.room_url, data.token);
        dmCallBtn.classList.add('in-call');

        // Özel aramada da mikrofonu kapatıp açma düğmesi (ses odasıyla aynı düğme ve mantık).
        voiceLocalMuted = !callFrame.localAudio();
        callMuteBtn.style.display = 'inline-block';
        updateMuteButton();
        updateAudioControls();

    } catch (error) {
        console.error('DM araması başarısız:', error);
        alert(error?.message === 'join-timeout'
            ? 'Bağlantı kurulamadı (zaman aşımı). Ağ bağlantını kontrol edip tekrar dene.'
            : 'Aramaya katılınamadı.');
        leaveCall();
    }

}

function endDmCallUi() {
    callOverlay.style.display = 'none';
    setRingingUi(false);
    callFrameContainer.style.display = 'block';
    document.getElementById('call-dm-profile').style.display = 'none';
    callMode = null;
    outgoingCallToId = null;
    outgoingCallToUsername = '';
    dmCallBtn.classList.remove('in-call');
}


// ─── ORTAK: Daily.co çerçevesine katıl (kamera her zaman kapalı) ─────────

async function joinCallFrame(roomUrl, token) {

    if (typeof DailyIframe === 'undefined') {
        alert('Sesli sohbet bileşeni yüklenemedi.');
        throw new Error('DailyIframe yok');
    }

    // Önceden bırakılmamış bir çerçeve varsa (ör. başarısız bir önceki deneme),
    // yeni bağlantı kurmadan önce kaynaklarını serbest bırak.
    if (callFrame) {
        try { callFrame.destroy(); } catch (_) { /* yoksay */ }
        callFrame = null;
    }

    // NOT: Bilerek createFrame (Daily'nin kendi arayüzünü gösteren iframe modu)
    // DEĞİL, createCallObject (arayüzsüz/"headless" mod) kullanıyoruz. Tamamen
    // kendi özel arayüzümüzü (DM profil kartı, Lobi oda grid'i) gösterdiğimiz
    // için Daily'nin iframe'i zaten hep gizli kalıyordu (display:none) — bu da
    // iOS Safari otomatik oynatmayı (autoplay) engellediğinde Daily'nin kendi
    // "sesi etkinleştir" kurtarma arayüzünün görünmez/dokunulmaz kalmasına ve
    // "Bağlandı" yazmasına rağmen sesin hiç gelmemesine yol açıyordu. Headless
    // modda ses elemanları sayfamızın kendi DOM'unda (aynı origin) olduğu için
    // bunu kendimiz tespit edip düzeltebiliyoruz (bkz. aşağıdaki audio-unlock).
    callFrame = DailyIframe.createCallObject();

    // ÖNEMLİ: Tüm olay dinleyicileri join()'den ÖNCE bağlanmalı. join()'in
    // döndürdüğü promise çözülmesiyle 'joined-meeting' olayının ateşlenmesi
    // neredeyse eş zamanlı olabiliyor — dinleyiciyi await'ten SONRA eklersek,
    // olay çoktan geçmiş olabilir ve hiç yakalanmaz (ör. "Bağlandı" yazısının
    // hiç görünmemesi, ses her şeye rağmen çalışsa bile).
    callFrame.on('participant-updated', (event) => {
        if (event?.participant?.local && event.participant.video) {
            callFrame.setLocalVideo(false);
        }

        // Tarayıcı mikrofonu askıya aldıysa ve uygulama görünürse (örn. kısa bir kesinti) kurtarmayı dene.
        if (event?.participant?.local && event.participant.tracks?.audio?.state === 'interrupted' && document.visibilityState === 'visible') {
            scheduleCallRecovery();
        }
    });

    callFrame.on('joined-meeting', () => {
        const dmStatusText = document.getElementById('call-dm-status-text');
        if (dmStatusText) dmStatusText.textContent = t('call-connected');
        startCallTimer();
    });

    callFrame.on('nonfatal-error', (event) => {
        if (event?.type === 'audio-processor-error') noiseCancelFailed();
    });

    callFrame.on('left-meeting', leaveCall);
    callFrame.on('error', (event) => {
        console.error('Daily.co çağrı hatası:', event);
        leaveCall();
    });

    wireCallAudioUnlock();

    try {

        // Bazı ağ/cihaz kombinasyonlarında (özellikle iOS Safari'nin WebRTC
        // bağlantı kurma aşamasında) join() hiç sonuçlanmadan askıda
        // kalabiliyor — kullanıcı sonsuza kadar "Bağlanıyor..." ekranında
        // takılı kalmasın diye bir zaman aşımı koyuyoruz.
        const JOIN_TIMEOUT_MS = 20_000;

        const joinPromise = callFrame.join({
            url: roomUrl,
            token,
            // Bu uygulamada görüntülü görüşme yok — kamerayı hiç istemiyoruz ki
            // tarayıcı kamera izni bile sormasın (sadece mikrofon).
            startVideoOff: true,
            startAudioOff: voiceJoinStartMuted || pttSettings().enabled,
            userMediaVideoConstraints: false
        });

        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('join-timeout')), JOIN_TIMEOUT_MS);
        });

        await Promise.race([joinPromise, timeoutPromise]);

        // 'joined-meeting' olayı kaçırılmış olsa bile (bkz. yukarıdaki not),
        // join() hatasız tamamlandıysa gerçekten bağlanmışızdır — durumu
        // doğrudan da güncelleyelim.
        const dmStatusText = document.getElementById('call-dm-status-text');
        if (dmStatusText) dmStatusText.textContent = t('call-connected');
        startCallTimer();

        callMicEverLive = callMicEverLive || Boolean(callFrame.localAudio());
        pttOnCallStart();
        startCallBackgroundKeepAlive();
        startCallHealthMonitor();
        refreshAudioDevices();
        applyNoiseCancellation();

    } catch (error) {
        callFrame.destroy();
        callFrame = null;
        throw error;
    }

}


// ─── SES OYNATMA (headless modda elle bağlanmalı) ─────────────────────────
// createFrame (Daily'nin kendi arayüzü) uzak sesi otomatik çalar, ama
// headless call-object modunda bu garanti değil — bu yüzden gelen ses
// track'lerini kendi <audio> elemanlarımıza elle bağlıyoruz. Ayrıca iOS
// Safari, kullanıcı etkileşiminden yeterince "taze" sayılmayan bir bağlamda
// (ör. aradaki async fetch/join adımları yüzünden) otomatik oynatmayı
// engelleyebilir — bunun için de çağrı ekranındaki her dokunuşta tekrar
// .play() deniyoruz.

const remoteCallAudioEls = new Map(); // session_id -> <audio>

function tryPlayAllCallAudio() {
    document.querySelectorAll('audio[data-call-audio]').forEach((el) => {
        el.play().catch(() => {});
    });
    if (callKeepAliveEl && callKeepAliveEl.paused) callKeepAliveEl.play().catch(() => {});
}

// Çağrı ekranındaki herhangi bir dokunuş/tıklama, tarayıcının engellemiş
// olabileceği ses oynatmayı gerçek bir kullanıcı hareketiyle tekrar dener.
// Tek seferlik global kurulum (her joinCallFrame çağrısında tekrar eklenmez).
callOverlay.addEventListener('click', tryPlayAllCallAudio);

function clearRemoteCallAudio() {
    remoteCallAudioEls.forEach((el) => el.remove());
    remoteCallAudioEls.clear();
    remoteScreenAudioTracks?.clear();
    detachWatchedScreenAudio();
}

// ─── Ekran sesi: yalnızca izleyene, paylaşan susturulmamışsa ───
// var: bu fonksiyonlar dosyanın başındaki akıştan da çağrılabilir (let/const geçici ölü bölgesine düşmesin).
var remoteScreenAudioTracks = new Map(); // session_id -> MediaStreamTrack
var watchedScreenshareSessionId = null;
var watchedScreenAudioEl = null;

function screenshareOwnerIsForceMuted(sessionId) {
    const participant = callFrame ? Object.values(callFrame.participants() || {}).find((p) => p.session_id === sessionId) : null;
    const userId = participant ? voiceUserIdForDailyParticipant(participant) : null;
    return Boolean(userId && currentVoiceParticipants.find((p) => p.user_id === userId)?.force_muted);
}

function attachWatchedScreenAudio() {
    const sessionId = watchedScreenshareSessionId;
    const track = sessionId && remoteScreenAudioTracks.get(sessionId);
    if (!track || screenshareOwnerIsForceMuted(sessionId)) { detachWatchedScreenAudio(); return; }
    if (!watchedScreenAudioEl) {
        watchedScreenAudioEl = document.createElement('audio');
        watchedScreenAudioEl.autoplay = true;
        watchedScreenAudioEl.playsInline = true;
        watchedScreenAudioEl.setAttribute('data-call-audio', '1');
        document.body.appendChild(watchedScreenAudioEl);
    }
    watchedScreenAudioEl.srcObject = new MediaStream([track]);
    watchedScreenAudioEl.muted = voiceDeafened;
    applySinkToAudioEl(watchedScreenAudioEl);
    watchedScreenAudioEl.play().catch(() => {});
}

function detachWatchedScreenAudio() {
    if (watchedScreenAudioEl) {
        watchedScreenAudioEl.srcObject = null;
        watchedScreenAudioEl.remove();
        watchedScreenAudioEl = null;
    }
}

function wireCallAudioUnlock() {

    callFrame.on('track-started', (event) => {

        if (event?.track?.kind !== 'audio' || event?.participant?.local) return;

        // Ekran sesi mikrofon sesinden AYRI tutulur ve herkese çalınmaz: yalnızca "İzle" ile o ekranı izleyen duyar
        // (ve paylaşan susturulmuşsa hiç kimse). Eskiden aynı oturum anahtarıyla mikrofon sesinin yerine geçebiliyordu.
        if (event.type === 'screenAudio') {
            remoteScreenAudioTracks.set(event.participant.session_id, event.track);
            if (watchedScreenshareSessionId === event.participant.session_id) attachWatchedScreenAudio();
            return;
        }

        const sessionId = event.participant?.session_id || `remote-${remoteCallAudioEls.size}`;

        let audioEl = remoteCallAudioEls.get(sessionId);
        if (!audioEl) {
            audioEl = document.createElement('audio');
            audioEl.autoplay = true;
            audioEl.playsInline = true;
            audioEl.setAttribute('data-call-audio', '1');
            document.body.appendChild(audioEl);
            remoteCallAudioEls.set(sessionId, audioEl);
        }

        audioEl.srcObject = new MediaStream([event.track]);
        audioEl.muted = voiceDeafened;
        applySinkToAudioEl(audioEl);
        audioEl.play().catch(() => {});

    });

    callFrame.on('track-stopped', (event) => {

        if (event?.track?.kind !== 'audio') return;

        if (event.type === 'screenAudio') {
            remoteScreenAudioTracks.delete(event.participant?.session_id);
            if (watchedScreenshareSessionId === event.participant?.session_id) detachWatchedScreenAudio();
            return;
        }

        const sessionId = event.participant?.session_id;
        const audioEl = sessionId && remoteCallAudioEls.get(sessionId);
        if (audioEl) {
            audioEl.remove();
            remoteCallAudioEls.delete(sessionId);
        }

    });

}


callScreenshareBtn.addEventListener('click', async () => {

    // NOT: Sesli odalara katılırken callMode 'hub-room' olarak ayarlanıyor
    // (bkz. joinVoiceRoom) — burada yanlışlıkla 'hub' bekleniyordu, bu yüzden
    // buton hiçbir zaman çalışmıyordu (kod yolu asla tetiklenmiyordu).
    if (!callFrame || callMode !== 'hub-room') return;

    if (!navigator.mediaDevices?.getDisplayMedia) {
        alert('Bu cihaz/tarayıcı ekran paylaşımını desteklemiyor. Ekran paylaşımı şu an yalnızca masaüstü tarayıcılarda (Chrome, Edge, Firefox) çalışıyor.');
        return;
    }

    try {

        const participants = callFrame.participants();
        const isSharing = participants?.local?.screen;

        if (isSharing) {
            await callFrame.stopScreenShare();
            callScreenshareBtn.classList.remove('active');
        } else {
            // Sauran Plus: daha yüksek ekran paylaşımı kalitesi (Daily'nin desteklediği maxQuality kademesi:
            // low/medium/high). Herkes 'medium' alır, Plus 'high' — temel kalite kısıtlanmıyor, yalnızca yükseltiliyor.
            const quality = currentUser?.plus_active ? 'high' : 'medium';
            // Paylaşım başlamadan önce akıcılık (FPS) seçtirilir; tarayıcının kendi ekran seçici penceresi FPS seçeneği sunmaz.
            const fps = await askShareFps();
            if (!fps) return;
            await startScreenShareWithFps(fps, quality);
            callScreenshareBtn.classList.add('active');
        }

    } catch (error) {
        console.error('Ekran paylaşımı başarısız:', error);
        // Kullanıcı izin penceresini iptal ettiğinde (NotAllowedError) sessizce
        // çıkıyoruz — bu bir hata değil, bilinçli bir vazgeçme.
        if (error?.name !== 'NotAllowedError') {
            alert('Ekran paylaşımı başlatılamadı. Tarayıcı izinlerini kontrol edip tekrar dene.');
        }
        callScreenshareBtn.classList.remove('active');
    }

});


callLeaveBtn.addEventListener('click', leaveCall);


// ─── ARKA PLANDA SES / MİKROFON DEVAMLILIĞI ─────────────────────────────
// Kod, uygulama arka plana alındığında mikrofonu ya da sesi KENDİSİ susturmaz. Ancak mobil
// tarayıcılar arka plana alınan / ekranı kilitlenen sayfada mikrofon yakalamayı ve sesi
// askıya alabilir; ayrıca bunun ardından yerel mikrofon "kapalı" görünüp kullanıcının
// kendi susturmasıymış gibi yansıtılıyordu. Bu bölüm elinden geleni yapar (best-effort):
//  1) çağrı sırasında "medya oturumu" + sessiz döngü sesi ile tarayıcıya bunun bir çağrı olduğunu bildirir,
//  2) çağrı sürerken ekranın kendiliğinden kilitlenmesini (Wake Lock) engeller,
//  3) uygulama öne gelince, kullanıcı kendisi susturmadıysa mikrofonu ve sesi geri açar.
// iOS Safari / ana ekran uygulaması (PWA) arka planda mikrofonu sistem düzeyinde durdurabilir;
// bu, bir web uygulamasının aşamayacağı bir sınırdır.

// ── Yerel (Android) uygulama köprüsü ──────────────────────────────────────
// Sauran'ın Android uygulaması (Capacitor) bu web uygulamasını WebView'da açar ve sesli odadayken
// mikrofonu arka planda canlı tutan bir ön plan servisi (bildirimde "Sustur / Ayrıl") çalıştırır.
// Tarayıcıda ve iPhone'da bu köprü YOKTUR: aşağıdaki işlevler hiçbir şey yapmaz, eski davranış aynen sürer.
let nativeVoicePlugin = null;
let nativeVoiceActionsWired = false;

function getNativeVoice() {
    try {
        const cap = window.Capacitor;
        if (!cap || typeof cap.isNativePlatform !== 'function' || !cap.isNativePlatform()) return null;
        if (!nativeVoicePlugin) {
            nativeVoicePlugin = typeof cap.registerPlugin === 'function'
                ? cap.registerPlugin('SauranVoice')
                : (cap.Plugins && cap.Plugins.SauranVoice) || null;
        }
        return nativeVoicePlugin;
    } catch (_) {
        return null;
    }
}

function wireNativeVoiceActions(plugin) {
    if (nativeVoiceActionsWired || typeof plugin.addListener !== 'function') return;
    nativeVoiceActionsWired = true;

    plugin.addListener('action', (event) => {
        if (event?.type === 'leave') leaveCall();
        if (event?.type === 'toggle_mic' && (callMode === 'hub-room' || callMode === 'dm')) toggleLocalMute();
    });
}

// Yerel servis başlatıldıysa true döner (web tarafındaki medya oturumu/sessiz ses hilesi gerekmez).
function startNativeVoiceService() {
    const plugin = getNativeVoice();
    if (!plugin) return false;

    try {
        wireNativeVoiceActions(plugin);
        Promise.resolve(plugin.start({ title: currentVoiceRoomName || 'Sesli görüşme', text: 'Sauran', muted: voiceLocalMuted }))
            .catch((error) => console.warn('Yerel ses servisi başlatılamadı:', error));
    } catch (error) {
        console.warn('Yerel ses servisi başlatılamadı:', error);
        return false;
    }
    return true;
}

function stopNativeVoiceService() {
    const plugin = getNativeVoice();
    if (!plugin) return;
    try { Promise.resolve(plugin.stop()).catch(() => {}); } catch (_) { /* yoksay */ }
}

let callKeepAliveEl = null;
let callKeepAliveUrl = null;
let callWakeLock = null;
let callRecoveryTimers = [];

function buildSilentWavUrl() {
    const sampleRate = 8000;
    const samples = sampleRate; // 1 sn
    const buffer = new ArrayBuffer(44 + samples * 2);
    const view = new DataView(buffer);
    const writeStr = (offset, str) => { for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i)); };

    writeStr(0, 'RIFF'); view.setUint32(4, 36 + samples * 2, true); writeStr(8, 'WAVE'); writeStr(12, 'fmt ');
    view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true); view.setUint16(34, 16, true);
    writeStr(36, 'data'); view.setUint32(40, samples * 2, true);

    return URL.createObjectURL(new Blob([buffer], { type: 'audio/wav' }));
}

async function requestCallWakeLock() {
    if (!callFrame || callWakeLock || !navigator.wakeLock || document.visibilityState !== 'visible') return;

    try {
        const lock = await navigator.wakeLock.request('screen');
        callWakeLock = lock;
        lock.addEventListener('release', () => { if (callWakeLock === lock) callWakeLock = null; });
    } catch (_) {
        callWakeLock = null;
    }
}

function startCallBackgroundKeepAlive() {

    // Yerel uygulamada asıl koruma ön plan servisidir; web tarafındaki medya kartı gerekmez.
    if (startNativeVoiceService()) return;

    if (!callKeepAliveEl) {
        try {
            callKeepAliveUrl = buildSilentWavUrl();
            const el = document.createElement('audio');
            el.src = callKeepAliveUrl;
            el.loop = true;
            el.playsInline = true;
            el.setAttribute('data-call-keepalive', '1');
            document.body.appendChild(el);
            callKeepAliveEl = el;
            el.play().catch(() => {}); // otomatik oynatma engellenirse ilk dokunuşta tekrar denenir (tryPlayAllCallAudio)
        } catch (_) { /* yoksay */ }
    }

    if ('mediaSession' in navigator) {
        const setHandler = (action, handler) => {
            try { navigator.mediaSession.setActionHandler(action, handler); } catch (_) { /* bu tarayıcıda yok */ }
        };

        try {
            navigator.mediaSession.metadata = new MediaMetadata({
                title: currentVoiceRoomName || 'Sesli görüşme',
                artist: 'Sauran'
            });
            navigator.mediaSession.playbackState = 'playing';
        } catch (_) { /* yoksay */ }

        // Sistem "duraklat" derse çağrı sesini sürdür; kapatma ve mikrofon düğmeleri gerçek işlevini görür.
        setHandler('play', () => { callKeepAliveEl?.play().catch(() => {}); });
        setHandler('pause', () => { callKeepAliveEl?.play().catch(() => {}); });
        setHandler('hangup', () => leaveCall());
        setHandler('togglemicrophone', () => { if (callMode === 'hub-room' || callMode === 'dm') toggleLocalMute(); });
    }

    requestCallWakeLock();
}

function stopCallBackgroundKeepAlive() {

    stopNativeVoiceService();
    stopCallHealthMonitor();
    resetAudioSession();

    callRecoveryTimers.forEach(clearTimeout);
    callRecoveryTimers = [];

    if (callKeepAliveEl) {
        try { callKeepAliveEl.pause(); } catch (_) { /* yoksay */ }
        callKeepAliveEl.remove();
        callKeepAliveEl = null;
    }
    if (callKeepAliveUrl) {
        URL.revokeObjectURL(callKeepAliveUrl);
        callKeepAliveUrl = null;
    }

    if ('mediaSession' in navigator) {
        try {
            navigator.mediaSession.playbackState = 'none';
            navigator.mediaSession.metadata = null;
            ['play', 'pause', 'hangup', 'togglemicrophone'].forEach((a) => {
                try { navigator.mediaSession.setActionHandler(a, null); } catch (_) { /* yoksay */ }
            });
        } catch (_) { /* yoksay */ }
    }

    if (callWakeLock) {
        try { callWakeLock.release(); } catch (_) { /* yoksay */ }
        callWakeLock = null;
    }
}

// ─── MİKROFON SAĞLIĞI VE KURTARMA ────────────────────────────────────────
// Sorun yalnızca "sessize alma" değildir; yerel ses izi şu durumlarda bozulabilir:
//   disabled     : Daily'de yerel ses kapalı (biz kapatmadıysak açmak yeter)
//   interrupted  : tarayıcı/OS yakalamayı askıya aldı (başka uygulama sesi/mikrofonu aldı)
//   ended        : iz sonlandı (cihaz çıkarıldı, izin geri alındı, OS yakalamayı kapattı)
//   os-muted     : iz "muted" (OS/ses odağı kaybı); iz sonlanmamış ama ses yok
//   no-track     : iz hiç yok
// Yalnızca gerçekten bozuk durumda, sınırlı sayıda ve kullanıcıya bildirerek yeniden alınır.

const sleepMs = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const CALL_RECOVERY_MAX_PER_MIN = 3;
const CALL_HEALTH_TICK_MS = 10_000;
let callHealthTimer = null;
let callHealthTicks = 0;
let callRecoveryBusy = false;
let callRecoveryHistory = [];
let callRecoveryFailedShown = false;
let callWatchedTrack = null;
let callCustomMicTrack = null; // getUserMedia ile kendimizin aldığı yedek iz (Daily'ye verilir; çıkışta durdurulur)

function localAudioHealth() {
    if (!callFrame) return { ok: true, reason: 'no-call' };
    const audio = callFrame.participants()?.local?.tracks?.audio;
    const track = audio?.persistentTrack || null;
    if (!callFrame.localAudio()) return { ok: false, reason: 'disabled', track };
    if (audio?.state === 'interrupted') return { ok: false, reason: 'interrupted', track };
    if (!track) return { ok: false, reason: 'no-track', track };
    if (track.readyState === 'ended') return { ok: false, reason: 'ended', track };
    if (track.muted) return { ok: false, reason: 'os-muted', track };
    return { ok: true, reason: 'ok', track };
}

function watchLocalAudioTrack() {
    const track = callFrame?.participants()?.local?.tracks?.audio?.persistentTrack || null;
    if (!track || track === callWatchedTrack) return;
    callWatchedTrack = track;
    const onChange = () => { if (callFrame && callWatchedTrack === track) scheduleCallRecovery(); };
    track.addEventListener('ended', onChange);
    track.addEventListener('mute', onChange);
    track.addEventListener('unmute', onChange);
}

// Kendi aldığımız izi (seçili cihazla) Daily'ye verir; seçili cihaz artık yoksa varsayılana düşer.
async function reacquireLocalMic() {
    let stream = null;
    const wanted = audioSession.selectedInputId;
    try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: wanted ? { deviceId: { exact: wanted } } : true });
    } catch (error) {
        if (wanted && (error?.name === 'OverconstrainedError' || error?.name === 'NotFoundError')) {
            audioSession.selectedInputId = null; // seçilen cihaz gitti → varsayılan mikrofona düş
            stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        } else {
            throw error;
        }
    }
    const track = stream.getAudioTracks()[0];
    if (callCustomMicTrack && callCustomMicTrack !== track) { try { callCustomMicTrack.stop(); } catch (_) { /* yoksay */ } }
    callCustomMicTrack = track;
    await callFrame.setInputDevicesAsync({ audioSource: track });
    applyNoiseCancellation();
}

// Öne dönünce / ağ gelince / iz olayında / periyodik: uzak sesi tekrar oynat ve —
// kullanıcı KENDİSİ susturmadıysa — bozuk mikrofonu onar.
async function recoverCallMedia() {

    if (!callFrame || document.visibilityState !== 'visible' || callRecoveryBusy) return;

    tryPlayAllCallAudio();

    // Kullanıcı (ya da moderatör) bilerek sessize aldıysa dokunma. İzin hiç verilmediyse de deneme.
    if (voiceUserMuted || !callMicEverLive) return;

    let health = localAudioHealth();
    if (health.ok) { watchLocalAudioTrack(); return; }

    callRecoveryBusy = true;

    try {

        // 1) Yalnızca "kapalı" ise açmak yeter.
        if (health.reason === 'disabled') {
            callFrame.setLocalAudio(true);
            await sleepMs(500);
            health = localAudioHealth();
        }

        // 2) İz gerçekten bozuk: mikrofonu yeniden al. Sonsuz döngüye karşı dakikada en fazla 3 deneme.
        if (!health.ok) {
            const now = Date.now();
            callRecoveryHistory = callRecoveryHistory.filter((at) => now - at < 60_000);
            if (callRecoveryHistory.length >= CALL_RECOVERY_MAX_PER_MIN) {
                if (!callRecoveryFailedShown) { callRecoveryFailedShown = true; showToast(t('voice-recover-failed')); }
                return;
            }
            callRecoveryHistory.push(now);

            showToast(t('voice-recovering'));
            callFrame.setLocalAudio(true);
            try {
                await reacquireLocalMic();
            } catch (error) {
                // Kendi yakalamamız olmadıysa Daily'nin kendi yeniden almasını dene.
                console.warn('Mikrofon yeniden alınamadı, Daily ile denenecek:', error?.name || error);
                if (typeof callFrame.setInputDevicesAsync === 'function') await callFrame.setInputDevicesAsync({ audioSource: true });
            }
            callFrame.setLocalAudio(true);
            await sleepMs(700);
            health = localAudioHealth();
        }

        if (health.ok) {
            callRecoveryFailedShown = false;
            if ((callMode === 'hub-room' || callMode === 'dm') && voiceLocalMuted) syncLocalMuteState(false);
            watchLocalAudioTrack();
        }

    } catch (error) {
        console.warn('Mikrofon geri açılamadı:', error);
        if (!callRecoveryFailedShown) { callRecoveryFailedShown = true; showToast(t('voice-recover-failed')); }
    } finally {
        callRecoveryBusy = false;
    }
}

function scheduleCallRecovery() {
    callRecoveryTimers.forEach(clearTimeout);
    // Öne dönüşten hemen sonra izler/aygıtlar hazır olmayabilir; kısa aralıklarla tekrar dene.
    callRecoveryTimers = [0, 400, 1500, 4000].map((ms) => setTimeout(recoverCallMedia, ms));
}

// Sesli oda üyeliği sunucuda bellekte tutulur; socket kopmasında/sunucu yeniden başlamasında silinebilir.
// Daily bağlantısı açıkken listede kaybolmamak için üyelik periyodik ve öne dönünce yeniden ilan edilir (idempotent).
const VOICE_PRESENCE_TRANSIENT_ERRORS = ['Sunucu yanıt vermedi.', 'Gerçek zamanlı bağlantı yok.'];

async function syncVoicePresence() {

    if (callMode !== 'hub-room' || !voiceSessionConfirmed || voiceRejoining || !socket || !socket.connected) return;

    voiceRejoining = true;
    let ack;
    try { ack = await emitVoiceRoomJoin(); } finally { voiceRejoining = false; }

    if (callMode !== 'hub-room') return;

    if (!ack.success) {
        if (VOICE_PRESENCE_TRANSIENT_ERRORS.includes(ack.error)) return; // geçici: bir sonraki turda tekrar dene
        showToast(ack.error || t('voice-room-removed'));
        leaveCall();
        return;
    }

    if (JSON.stringify(ack.participants) !== JSON.stringify(currentVoiceParticipants)) {
        currentVoiceParticipants = ack.participants;
        renderHubRoomGrid(currentVoiceParticipants);
        updateVoiceSessionSummary();
        if (currentHub) renderVoiceRoomsList();
    }
}

function startCallHealthMonitor() {
    stopCallHealthMonitor();
    callHealthTicks = 0;
    callHealthTimer = setInterval(() => {
        if (!callFrame) return;
        callHealthTicks += 1;
        if (document.visibilityState === 'visible') {
            const health = localAudioHealth();
            if (!health.ok && !voiceUserMuted && callMicEverLive) recoverCallMedia();
        }
        if (callHealthTicks % 3 === 0) syncVoicePresence(); // ~30 sn
    }, CALL_HEALTH_TICK_MS);
    setTimeout(watchLocalAudioTrack, 1500);
}

function stopCallHealthMonitor() {
    if (callHealthTimer) { clearInterval(callHealthTimer); callHealthTimer = null; }
    callRecoveryHistory = [];
    callRecoveryFailedShown = false;
    callWatchedTrack = null;
    if (callCustomMicTrack) { try { callCustomMicTrack.stop(); } catch (_) { /* yoksay */ } callCustomMicTrack = null; }
}

document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && callFrame) {
        requestCallWakeLock();
        scheduleCallRecovery();
        syncVoicePresence();
    }
});
window.addEventListener('pageshow', () => { if (callFrame) { requestCallWakeLock(); scheduleCallRecovery(); } });
window.addEventListener('focus', () => { if (callFrame) scheduleCallRecovery(); });
window.addEventListener('online', () => { if (callFrame) { scheduleCallRecovery(); syncVoicePresence(); } });



// ─── SES OTURUMU: mikrofon/çıkış seçimi, hoparlör↔ahize, yakınlık algılama ─
// Ses odası ve DM araması aynı callFrame (Daily) üzerinde çalıştığı için tek ortak katman kullanılır.
// Özellik algılama: desteklenmeyen platformda ilgili düğme HİÇ gösterilmez.
//   • Mikrofon seçimi   : navigator.mediaDevices.enumerateDevices + Daily setInputDevicesAsync (tüm platformlar)
//   • Çıkış seçimi (web): HTMLMediaElement.setSinkId — yalnızca masaüstü Chromium/Edge; Android Chrome/WebView'da YOK
//   • Hoparlör↔ahize    : yalnızca yerel Android uygulamasında (SauranVoice eklentisi, AudioManager) — yeni APK gerekir
//   • Yakınlık sensörü  : yalnızca yerel Android uygulamasında, ahize seçiliyken
// Cihaz adları/kimlikleri yalnızca bellekte tutulur; sunucuya gönderilmez, depoya yazılmaz.

const audioSession = {
    inputs: [],            // { id, label }
    outputs: [],           // web setSinkId çıkışları { id, label }
    selectedInputId: null,
    selectedOutputId: null,
    native: { available: false, routes: [], active: null },
    iosRoute: 'speaker',   // 'speaker' | 'earpiece' (yalnızca iOS ipucu modu)
    devicechangeWired: false
};

// ─── GÜRÜLTÜ ENGELLEME (yalnızca konuşma) ─────────────────────────────────
// Daily'nin (Krisp tabanlı) mikrofon işlemcisi: arka plan gürültüsünü tarayıcıda, yerelde bastırır (ses Krisp'e gönderilmez).
// Desteklenmeyen ortamda updateInputSettings hata verir → özellik gizlenir. Tercih yalnızca bu cihazda (localStorage, açık/kapalı).
const NC_STORAGE_KEY = 'sauran_noise_cancel';
const noiseCancel = { supported: null, enabled: true, failedShown: false };
try { noiseCancel.enabled = localStorage.getItem(NC_STORAGE_KEY) !== 'off'; } catch (_) { /* depolama yok → varsayılan açık */ }

async function applyNoiseCancellation() {
    if (!callFrame || noiseCancel.supported === false || typeof callFrame.updateInputSettings !== 'function') return;
    try {
        await callFrame.updateInputSettings({ audio: { processor: { type: noiseCancel.enabled ? 'noise-cancellation' : 'none' } } });
        noiseCancel.supported = true;
    } catch (error) {
        console.warn('Gürültü engelleme uygulanamadı:', error?.message || error);
        noiseCancelFailed();
        return;
    }
    updateAudioControls();
}

function noiseCancelFailed() {
    noiseCancel.supported = false;
    if (noiseCancel.enabled && !noiseCancel.failedShown) { noiseCancel.failedShown = true; showToast(t('nc-failed')); }
    updateAudioControls();
}

function setNoiseCancel(enabled) {
    noiseCancel.enabled = enabled;
    try { localStorage.setItem(NC_STORAGE_KEY, enabled ? 'on' : 'off'); } catch (_) { /* yoksay */ }
    syncNoiseCancelUi();
    applyNoiseCancellation();
}

// Ayarlar sekmesi + çağrı düğmesi tek durumdan beslenir (noiseCancel).
function syncNoiseCancelUi() {
    const toggle = document.getElementById('settings-nc-toggle');
    if (toggle) {
        toggle.checked = noiseCancel.enabled;
        toggle.disabled = noiseCancel.supported === false;
    }
    const note = document.getElementById('settings-nc-note');
    if (note) note.style.display = noiseCancel.supported === false ? 'block' : 'none';

    const btn = document.getElementById('call-nc-btn');
    if (btn) {
        btn.style.display = (callFrame && noiseCancel.supported === true) ? 'inline-flex' : 'none';
        btn.classList.toggle('on', noiseCancel.enabled);
        btn.setAttribute('aria-pressed', noiseCancel.enabled ? 'true' : 'false');
        const label = t(noiseCancel.enabled ? 'nc-state-on' : 'nc-state-off');
        btn.title = label;
        btn.setAttribute('aria-label', label);
        btn.innerHTML = NC_ICON;
    }
}

const NC_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M3 12h2M7 8v8M11 5v14M15 8v8M19 10v4"/></svg>';

(function wireNoiseCancelControls() {
    const toggle = document.getElementById('settings-nc-toggle');
    if (toggle) toggle.addEventListener('change', () => setNoiseCancel(toggle.checked));
    const btn = document.getElementById('call-nc-btn');
    if (btn) btn.addEventListener('click', (event) => { event.stopPropagation(); setNoiseCancel(!noiseCancel.enabled); });
    syncNoiseCancelUi();
})();

// Safari/iOS (WebKit) setSinkId'i sunar ama WebRTC uzak sesi için sessizce yok sayar (ses iOS'un kendi rotasında kalır; gerçek cihazda doğrulandı:
// Bluetooth bağlıyken "Hoparlör" seçimi bir şey değiştirmedi). Çalışmayan seçenek gösterilmesin diye WebKit'te web çıkış seçimi kapalıdır;
// çıkışı iOS'un kendi denetim merkezi/ses yönlendirme menüsünden değiştirir.
// iOS'ta ses çıkışı seçilemez; ancak Audio Session API ile oturum türü ipucu verilebilir:
//   'play-and-record' → ahize (kulak hoparlörü) tercih edilir; 'auto' → Safari'nin varsayılanı (çoğunlukla hoparlör).
// Bu bir İPUCUDUR, garanti değildir (Bluetooth/kulaklık bağlıysa iOS onu tercih eder). Oturum sırasında kararsız olabildiği için
// yalnızca kullanıcı düğmeye basınca değiştirilir ve görüşme bitince 'auto'ya döner.
const isIosDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const supportsIosAudioSession = isIosDevice && Boolean(navigator.audioSession) && 'type' in navigator.audioSession;
const isWebKitAudio = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) || (/^((?!chrome|chromium|android|crios|fxios|edg).)*safari/i.test(navigator.userAgent));
const supportsSinkId = typeof HTMLMediaElement !== 'undefined' && 'setSinkId' in HTMLMediaElement.prototype && !isWebKitAudio;
const callMicArrowBtn = document.getElementById('call-mic-arrow-btn');
const callSpeakerBtn = document.getElementById('call-speaker-btn');
const callOutArrowBtn = document.getElementById('call-out-arrow-btn');
const callDeviceMenu = document.getElementById('call-device-menu');

const AUDIO_ICONS = {
    speaker: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16 9a4 4 0 0 1 0 6M18.500 6.500a8 8 0 0 1 0 11"/></svg>',
    earpiece: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6.500 3.500h3l1.500 4-2 1.500a11 11 0 0 0 6 6l1.500-2 4 1.500v3a2 2 0 0 1-2 2A16 16 0 0 1 4.500 5.500a2 2 0 0 1 2-2z"/></svg>',
    speakerOff: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M3 3l18 18"/></svg>',
    chevron: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M7 10l5 5 5-5"/></svg>'
};

function audioRouteLabel(type, name) {
    const key = { speaker: 'audio-route-speaker', earpiece: 'audio-route-earpiece', bluetooth: 'audio-route-bluetooth', wired: 'audio-route-wired', usb: 'audio-route-usb' }[type];
    const base = key ? t(key) : t('audio-route-other');
    return name && type !== 'speaker' && type !== 'earpiece' ? `${base} · ${name}` : base;
}

function applySinkToAudioEl(el) {
    if (!supportsSinkId || !audioSession.selectedOutputId || typeof el.setSinkId !== 'function') return;
    el.setSinkId(audioSession.selectedOutputId).catch(() => { /* cihaz yok/izin yok → varsayılan çıkışta kalır */ });
}

function isMobileNative() {
    return Boolean(getNativeVoice());
}

async function refreshNativeRoutes() {
    const plugin = getNativeVoice();
    if (!plugin || typeof plugin.getAudioRoutes !== 'function') { audioSession.native = { available: false, routes: [], active: null }; return; }
    try {
        const result = await plugin.getAudioRoutes();
        const routes = Array.isArray(result?.routes) ? result.routes : [];
        audioSession.native = { available: routes.length > 0, routes, active: result?.active ?? null };
        if (!audioSession.nativeWired && typeof plugin.addListener === 'function') {
            audioSession.nativeWired = true;
            plugin.addListener('audioRoutesChanged', () => refreshAudioDevices());
        }
    } catch (_) {
        // Eski APK: yöntem yok → yerel yönlendirme desteklenmiyor, düğme gösterilmez.
        audioSession.native = { available: false, routes: [], active: null };
    }
}

let audioRefreshTimer = null;

async function refreshAudioDevices() {

    if (!callFrame) return;

    try {
        if (navigator.mediaDevices && typeof navigator.mediaDevices.enumerateDevices === 'function') {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const clean = (kind) => devices
                .filter((d) => d.kind === kind && d.deviceId && d.deviceId !== 'communications')
                .map((d) => ({ id: d.deviceId, label: d.deviceId === 'default' ? t('audio-default') : (d.label || t('audio-route-other')) }));
            audioSession.inputs = clean('audioinput');
            audioSession.outputs = supportsSinkId ? clean('audiooutput') : [];
        }
    } catch (_) { /* izin/destek yok → liste boş kalır */ }

    await refreshNativeRoutes();

    // Seçili cihaz artık yoksa (kulaklık çıkarıldı) güvenli varsayılana düş.
    if (audioSession.selectedInputId && !audioSession.inputs.some((d) => d.id === audioSession.selectedInputId)) {
        audioSession.selectedInputId = null;
        scheduleCallRecovery();
    }
    if (audioSession.selectedOutputId && !audioSession.outputs.some((d) => d.id === audioSession.selectedOutputId)) {
        audioSession.selectedOutputId = null;
        document.querySelectorAll('audio[data-call-audio]').forEach((el) => { if (typeof el.setSinkId === 'function') el.setSinkId('').catch(() => {}); });
    }

    updateAudioControls();
}

function wireAudioDeviceChange() {
    if (audioSession.devicechangeWired || !navigator.mediaDevices || typeof navigator.mediaDevices.addEventListener !== 'function') return;
    audioSession.devicechangeWired = true;
    navigator.mediaDevices.addEventListener('devicechange', () => {
        clearTimeout(audioRefreshTimer);
        audioRefreshTimer = setTimeout(() => { if (callFrame) refreshAudioDevices(); }, 400);
    });
}
wireAudioDeviceChange();

function nativeSpeakerToggleAvailable() {
    const types = audioSession.native.routes.map((r) => r.type);
    return audioSession.native.available && types.includes('speaker') && types.includes('earpiece');
}

function updateAudioControls() {

    const inCall = Boolean(callFrame);
    const showMicArrow = inCall && (audioSession.inputs.length > 1 || noiseCancel.supported === true);
    const nativeToggle = inCall && nativeSpeakerToggleAvailable();
    const iosToggle = inCall && !nativeToggle && supportsIosAudioSession;
    const routeToggle = nativeToggle || iosToggle;
    const webOutMenu = inCall && !routeToggle && audioSession.outputs.length > 1;

    // Mikrofon oku: hub odasında ana mikrofon düğmesinin yanında; DM aramasında (mute düğmesi yok) mikrofon simgesiyle.
    if (callMicArrowBtn) {
        callMicArrowBtn.style.display = showMicArrow ? 'inline-flex' : 'none';
        callMicArrowBtn.classList.toggle('has-mic-icon', callMuteBtn.style.display === 'none');
        callMicArrowBtn.innerHTML = (callMuteBtn.style.display === 'none' ? VOICE_CTRL_ICONS.mic : '') + AUDIO_ICONS.chevron;
        callMicArrowBtn.setAttribute('aria-label', t('audio-mic-title'));
        callMicArrowBtn.title = t('audio-mic-title');
    }

    if (callSpeakerBtn) {
        const active = audioSession.native.routes.find((r) => r.id === audioSession.native.active);
        const onEarpiece = nativeToggle ? Boolean(active && active.type === 'earpiece') : (iosToggle && audioSession.iosRoute === 'earpiece');
        const hubRoom = inCall && callMode === 'hub-room';
        callSpeakerBtn.style.display = (hubRoom || routeToggle || webOutMenu) ? 'inline-flex' : 'none';
        // Sesli odada hoparlör düğmesi dinlemeyi açar/kapatır; ahize/hoparlör/cihaz seçimi yanındaki okta.
        callSpeakerBtn.innerHTML = hubRoom ? (voiceDeafened ? AUDIO_ICONS.speakerOff : AUDIO_ICONS.speaker) : (onEarpiece ? AUDIO_ICONS.earpiece : AUDIO_ICONS.speaker);
        callSpeakerBtn.classList.toggle('on-earpiece', !hubRoom && Boolean(onEarpiece));
        callSpeakerBtn.classList.toggle('deafened', hubRoom && voiceDeafened);
        const label = hubRoom ? t('voice-speaker-title') : (routeToggle ? (onEarpiece ? t('audio-route-earpiece') : t('audio-route-speaker')) : t('audio-out-title'));
        callSpeakerBtn.setAttribute('aria-label', label);
        callSpeakerBtn.title = label;
        callSpeakerBtn.setAttribute('aria-pressed', hubRoom ? String(voiceDeafened) : (routeToggle ? String(!onEarpiece) : 'false'));
    }

    syncNoiseCancelUi();

    if (callOutArrowBtn) {
        // Yerel modda ok yalnızca ikiden fazla rota (Bluetooth/kablolu/USB) varken anlamlıdır.
        const hubRoomArrow = inCall && callMode === 'hub-room' && (routeToggle || webOutMenu);
        callOutArrowBtn.style.display = (hubRoomArrow || (nativeToggle && audioSession.native.routes.length > 2)) ? 'inline-flex' : 'none';
        callOutArrowBtn.classList.toggle('has-mic-icon', hubRoomArrow);
        const arrowIcon = hubRoomArrow ? (routeToggle && audioSession.native.routes.find((r) => r.id === audioSession.native.active)?.type === 'earpiece' || audioSession.iosRoute === 'earpiece' ? AUDIO_ICONS.earpiece : AUDIO_ICONS.speaker) : '';
        callOutArrowBtn.innerHTML = arrowIcon + AUDIO_ICONS.chevron;
        callOutArrowBtn.setAttribute('aria-label', t('audio-out-title'));
        callOutArrowBtn.title = t('audio-out-title');
    }
}

function closeDeviceMenu() {
    if (callDeviceMenu) { callDeviceMenu.style.display = 'none'; callDeviceMenu.innerHTML = ''; }
}

function openDeviceMenu(kind, anchor) {

    if (!callDeviceMenu || !anchor) return;
    if (callDeviceMenu.style.display === 'flex' && callDeviceMenu.dataset.kind === kind) { closeDeviceMenu(); return; }

    let items = [];
    let title = '';
    if (kind === 'input') {
        title = t('audio-mic-title');
        items = audioSession.inputs.map((d) => ({ id: d.id, label: d.label, selected: (audioSession.selectedInputId || 'default') === d.id || (!audioSession.selectedInputId && d.id === audioSession.inputs[0]?.id && !audioSession.inputs.some((x) => x.id === 'default')) }));
    } else if (audioSession.native.available && nativeSpeakerToggleAvailable()) {
        title = t('audio-out-title');
        items = audioSession.native.routes.map((r) => ({ id: r.id, label: audioRouteLabel(r.type, r.name), selected: r.id === audioSession.native.active }));
    } else {
        title = t('audio-out-title');
        items = audioSession.outputs.map((d) => ({ id: d.id, label: d.label, selected: (audioSession.selectedOutputId || 'default') === d.id }));
    }
    const showNc = kind === 'input' && noiseCancel.supported === true;
    if (!items.length && !showNc) return;

    callDeviceMenu.dataset.kind = kind;
    callDeviceMenu.innerHTML = `<div class="call-device-menu-title">${escapeHtml(title)}</div>` + (audioSession.inputs.length > 1 || kind !== 'input' ? items : []).map((it) =>
        `<button type="button" role="menuitemradio" aria-checked="${it.selected ? 'true' : 'false'}" data-device-id="${escapeAttr(it.id)}" class="${it.selected ? 'selected' : ''}"><span>${escapeHtml(it.label)}</span><span class="call-device-check" aria-hidden="true">${it.selected ? '✓' : ''}</span></button>`
    ).join('') + (showNc
        ? `<button type="button" role="menuitemcheckbox" aria-checked="${noiseCancel.enabled ? 'true' : 'false'}" data-nc-toggle="1" class="call-device-nc${noiseCancel.enabled ? ' selected' : ''}"><span>${escapeHtml(t('nc-label'))}</span><span class="call-device-check" aria-hidden="true">${noiseCancel.enabled ? '✓' : ''}</span></button>`
        : '');

    const rect = anchor.getBoundingClientRect();
    callDeviceMenu.style.display = 'flex';
    const width = Math.min(callDeviceMenu.offsetWidth || 240, window.innerWidth - 16);
    callDeviceMenu.style.left = `${Math.max(8, Math.min(rect.left + rect.width / 2 - width / 2, window.innerWidth - width - 8))}px`;
    // Alt çubukta (mobil/masaüstü sesli oda çubuğu) menü yukarı, aksi hâlde aşağı açılır.
    const menuHeight = callDeviceMenu.offsetHeight || 160;
    const openUp = rect.bottom + 8 + menuHeight > window.innerHeight - 8;
    callDeviceMenu.style.top = `${Math.max(8, openUp ? rect.top - menuHeight - 8 : rect.bottom + 8)}px`;
}

async function chooseInputDevice(id) {
    closeDeviceMenu();
    if (!callFrame) return;
    try {
        await callFrame.setInputDevicesAsync({ audioDeviceId: id });
        audioSession.selectedInputId = id === 'default' ? null : id;
        if (callCustomMicTrack) { try { callCustomMicTrack.stop(); } catch (_) { /* yoksay */ } callCustomMicTrack = null; }
        if (!voiceUserMuted) callFrame.setLocalAudio(true);
        watchLocalAudioTrack();
        applyNoiseCancellation();
    } catch (error) {
        console.warn('Mikrofon değiştirilemedi:', error);
        showToast(t('voice-recover-failed'));
    }
    updateAudioControls();
}

async function chooseOutputDevice(id) {
    closeDeviceMenu();
    const native = audioSession.native.available && nativeSpeakerToggleAvailable();
    if (native) {
        await setNativeRoute(id);
        return;
    }
    audioSession.selectedOutputId = id === 'default' ? null : id;
    document.querySelectorAll('audio[data-call-audio]').forEach((el) => {
        if (typeof el.setSinkId === 'function') el.setSinkId(audioSession.selectedOutputId || '').catch(() => {});
    });
    updateAudioControls();
}

async function setNativeRoute(id) {
    const plugin = getNativeVoice();
    if (!plugin || typeof plugin.setAudioRoute !== 'function') return;
    try {
        const result = await plugin.setAudioRoute({ id });
        audioSession.native.active = result?.active ?? id;
    } catch (error) {
        console.warn('Ses çıkışı değiştirilemedi:', error);
    }
    await refreshNativeRoutes();
    updateAudioControls();
}

// Hoparlör düğmesi: yerel modda hoparlör ↔ ahize; masaüstünde çıkış cihazı menüsünü açar.
function toggleIosAudioRoute() {
    const toEarpiece = audioSession.iosRoute !== 'earpiece';
    try {
        navigator.audioSession.type = toEarpiece ? 'play-and-record' : 'auto';
        audioSession.iosRoute = toEarpiece ? 'earpiece' : 'speaker';
    } catch (error) {
        console.warn('iOS ses oturumu değiştirilemedi:', error);
        return;
    }
    updateAudioControls();
    // Kategori değişimi mikrofonu/çalmayı kesebilir: uzak sesi tekrar oynat, mikrofon sağlığını kısa süre sonra denetle.
    tryPlayAllCallAudio();
    scheduleCallRecovery();
}

function onSpeakerButton() {
    if (callMode === 'hub-room') { setLocalDeafened(!voiceDeafened); updateAudioControls(); return; }
    onSpeakerRouteAction();
}

function onSpeakerRouteAction() {
    if (!nativeSpeakerToggleAvailable() && supportsIosAudioSession) { toggleIosAudioRoute(); return; }
    if (nativeSpeakerToggleAvailable()) {
        const active = audioSession.native.routes.find((r) => r.id === audioSession.native.active);
        const target = audioSession.native.routes.find((r) => r.type === (active && active.type === 'earpiece' ? 'speaker' : 'earpiece'));
        if (target) setNativeRoute(target.id);
        return;
    }
    openDeviceMenu('output', callSpeakerBtn);
}

if (callMicArrowBtn) callMicArrowBtn.addEventListener('click', (event) => { event.stopPropagation(); openDeviceMenu('input', callMicArrowBtn); });
if (callSpeakerBtn) callSpeakerBtn.addEventListener('click', (event) => { event.stopPropagation(); onSpeakerButton(); });
if (callOutArrowBtn) callOutArrowBtn.addEventListener('click', (event) => {
    event.stopPropagation();
    // Sesli odada ok: ahize ↔ hoparlör geçişi (iOS/yerel); yoksa çıkış cihazı menüsü.
    if (callMode === 'hub-room' && (nativeSpeakerToggleAvailable() || supportsIosAudioSession) && !(nativeSpeakerToggleAvailable() && audioSession.native.routes.length > 2)) { onSpeakerRouteAction(); return; }
    openDeviceMenu('output', callOutArrowBtn);
});
if (callDeviceMenu) {
    callDeviceMenu.addEventListener('click', (event) => {
        const ncBtn = event.target.closest('button[data-nc-toggle]');
        if (ncBtn) {
            event.stopPropagation();
            setNoiseCancel(!noiseCancel.enabled);
            closeDeviceMenu();
            return;
        }
        const btn = event.target.closest('button[data-device-id]');
        if (!btn) return;
        event.stopPropagation();
        if (callDeviceMenu.dataset.kind === 'input') chooseInputDevice(btn.dataset.deviceId);
        else chooseOutputDevice(btn.dataset.deviceId);
    });
}
document.addEventListener('click', (event) => {
    if (callDeviceMenu && callDeviceMenu.style.display === 'flex' && !callDeviceMenu.contains(event.target)) closeDeviceMenu();
});
document.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeDeviceMenu(); });

function resetAudioSession() {
    closeDeviceMenu();
    if (supportsIosAudioSession && audioSession.iosRoute === 'earpiece') { try { navigator.audioSession.type = 'auto'; } catch (_) { /* yoksay */ } }
    audioSession.iosRoute = 'speaker';
    noiseCancel.failedShown = false;
    audioSession.inputs = [];
    audioSession.outputs = [];
    audioSession.selectedInputId = null;
    audioSession.selectedOutputId = null;
    audioSession.native = { available: false, routes: [], active: null };
    [callMicArrowBtn, callSpeakerBtn, callOutArrowBtn, document.getElementById('call-nc-btn')].forEach((el) => { if (el) el.style.display = 'none'; });
}


function leaveCall() {

    // Çalarken herhangi bir yoldan çıkılırsa karşı tarafın zili de durmalı (iptal olayı).
    if (callMode === 'dm-ringing' && outgoingCallToId && socket) {
        socket.emit('dm_call_cancel', { to_user_id: outgoingCallToId });
    }

    if ((callMode === 'dm' || callMode === 'dm-ringing') && (outgoingCallToId || incomingCallFromId) && socket) {
        socket.emit('dm_call_end', { to_user_id: outgoingCallToId || incomingCallFromId });
    }

    if (callMode === 'hub-room' && currentVoiceRoomId && socket) {
        socket.emit('voice_room_leave');
    }

    if (callFrame) {
        callFrame.leave();
        callFrame.destroy();
        callFrame = null;
    }

    clearRemoteCallAudio();
    stopCallBackgroundKeepAlive();
    stopCallTimer();

    callOverlay.style.display = 'none';
    callMiniBar.style.display = 'none';
    document.body.classList.remove('call-mini-active');
    setRingingUi(false);
    callFrameContainer.style.display = 'block';
    document.getElementById('call-dm-profile').style.display = 'none';
    document.getElementById('call-hub-room-view').style.display = 'none';
    hideScreenshareBanner();
    closeScreenshareViewer();
    screensharingSessionId = null;
    screensharingUsername = '';
    callScreenshareBtn.classList.remove('active');

    dmCallBtn.classList.remove('in-call');

    currentVoiceRoomId = null;
    currentVoiceRoomHubId = null;
    currentVoiceRoomName = '';
    currentVoiceParticipants = [];
    voiceSessionConfirmed = false;
    voiceRejoining = false;
    voiceLocalMuted = false;
    voiceUserMuted = false;
    voiceJoinStartMuted = false;
    if (voiceForceMute) clearVoiceForceMute();
    pttPressed = false;
    clearTimeout(pttReleaseTimer);
    pttReleaseTimer = null;
    document.getElementById('call-ptt-btn').style.display = 'none';
    callMicEverLive = false;
    voiceDeafened = false;
    voiceLocalSpeaking = false;
    voiceRemoteSpeaking = new Set();
    voiceSpeakingIds = new Set();
    callMuteBtn.style.display = 'none';
    hubInRoomCount.textContent = '';
    hubInRoomPill.style.display = 'none';
    renderVoiceRoomsList();

    callMode = null;
    outgoingCallToId = null;
    outgoingCallToUsername = '';
    incomingCallFromId = null;
    incomingCallFromUsername = '';

}



function renderHubMembers() {

    const myTier = currentHub.my_permission_tier;
    const canModerate = myTier === 'owner' || myTier === 'moderator';

    const membersPanelTitle = document.getElementById('hub-members-panel-title');
    if (membersPanelTitle) {
        membersPanelTitle.textContent = `${currentHub.type === 'group' ? groupDisplayName(currentHub) : currentHub.name} — ${t('members-title')} - ${currentHub.members.length}`;
    }

    // Sıra: kurucu, hemen altında moderatörler, sonra üyeler (grup içinde sunucu sırası korunur); yönetim ile üyeler arasında ince çizgi
    const tierRank = { owner: 0, moderator: 1 };
    const orderedMembers = currentHub.members
        .map((m, i) => ({ m, i }))
        .sort((x, y) => ((tierRank[x.m.permission_tier] ?? 2) - (tierRank[y.m.permission_tier] ?? 2)) || (x.i - y.i))
        .map((x) => x.m);
    const isStaffTier = (m) => m.permission_tier === 'owner' || m.permission_tier === 'moderator';

    hubMemberList.innerHTML = orderedMembers.map((m, idx) => {

        const avatar = avatarButtonHtml(m.user_id, m.avatar_data, m.username, m.avatar_frame, m.profile_color);
        knownVoicePlus.set(m.user_id, Boolean(m.plus_active));
        knownNameFx.set(m.user_id, m.name_effect || 'none');
        const isSelf = m.user_id === currentUser.id;
        const tierBadge = m.permission_tier === 'owner' ? ' 👑' : m.permission_tier === 'moderator' ? ' 🛡️' : '';

        // Kurucu herkese (kendisi hariç) işlem yapabilir; moderatör yalnızca üyelere — diğer moderatör ve kurucuya değil.
        const showMenu = canModerate && !isSelf && m.permission_tier !== 'owner' && (myTier === 'owner' || m.permission_tier === 'member');

        const divider = (idx > 0 && !isStaffTier(m) && isStaffTier(orderedMembers[idx - 1])) ? '<div class="hub-member-divider" role="separator"></div>' : '';

        return `
            ${divider}
            <div class="hub-member-row" data-user-id="${m.user_id}" data-tier="${m.permission_tier}">
                <span class="hub-member-avatar-wrap">
                    ${avatar}
                    <span class="hub-member-dot" style="background:${m.online ? '#57f287' : '#4b5563'};"></span>
                </span>
                <span class="hub-member-name">${usernameCardHtml(m.username, m.plus_active, m.name_effect)}${tierBadge}</span>
                ${showMenu ? `
                    <div class="hub-member-menu-wrap">
                        <button class="hub-member-menu-btn" type="button">⋯</button>
                        <div class="hub-member-menu liquid-glass" style="display:none;">
                            ${myTier === 'owner' ? `<button data-action="moderator">${m.permission_tier === 'moderator' ? t('remove-moderator') : t('make-moderator')}</button>` : ''}
                            <button data-action="mute">🔇 ${t('voice-mute-action')}</button>
                            ${voiceRoomsCache.some((r) => (r.participants || []).some((p) => p.user_id === m.user_id)) ? `<button data-action="voice-kick">👢 ${t('voice-kick-action')}</button>` : ''}
                            <button data-action="kick">👢 ${t('kick')}</button>
                            <button data-action="ban" class="hub-member-menu-danger">🚫 ${t('ban')}</button>
                        </div>
                    </div>
                ` : ''}
            </div>
        `;

    }).join('');

    hubMemberList.querySelectorAll('.hub-member-row').forEach((row) => {

        const userId = Number(row.dataset.userId);

        row.querySelector('.hub-member-name').addEventListener('click', () => openOtherProfile(userId));

        const menuBtn = row.querySelector('.hub-member-menu-btn');
        const menu = row.querySelector('.hub-member-menu');
        if (!menuBtn) return;

        menuBtn.addEventListener('click', (event) => {
            event.stopPropagation();
            if (menu.style.display === 'flex') {
                closeMemberMenus();
            } else {
                openMemberMenu(menu, menuBtn);
            }
        });

        menu.querySelectorAll('[data-action]').forEach((btn) => {
            btn.addEventListener('click', async (event) => {
                event.stopPropagation();
                closeMemberMenus();
                await handleMemberModerationAction(btn.dataset.action, userId, row.dataset.tier);
            });
        });

    });

    wireMsgAvatars(hubMemberList);

}

// Üye satırlarında backdrop-filter var: her satır kendi yığın bağlamını (ve fixed
// için yeni containing block'unu) oluşturduğundan menü satır içinde kalırsa alttaki
// satırın ALTINDA kalıyordu. Menü açılırken body'ye taşınıp düğmenin ekran
// konumuna göre sabitleniyor, kapanınca yerine dönüyor.
function closeMemberMenus() {
    document.querySelectorAll('.hub-member-menu').forEach((m) => {
        m.style.display = 'none';
        m.style.position = '';
        m.style.top = '';
        m.style.right = '';
        m.style.left = '';
        m.style.zIndex = '';
        if (m._homeParent) {
            if (m._homeParent.isConnected) m._homeParent.appendChild(m);
            else m.remove();
        }
    });
}

function openMemberMenu(menu, menuBtn) {

    closeMemberMenus();

    menu._homeParent = menu.parentElement;
    document.body.appendChild(menu);

    menu.style.position = 'fixed';
    menu.style.zIndex = '250';
    menu.style.display = 'flex';

    const rect = menuBtn.getBoundingClientRect();
    const height = menu.offsetHeight;
    let top = rect.bottom + 4;
    if (top + height > window.innerHeight - 8) top = Math.max(8, rect.top - height - 4);

    menu.style.top = `${top}px`;
    menu.style.left = 'auto';
    menu.style.right = `${Math.max(8, window.innerWidth - rect.right)}px`;

}

document.addEventListener('click', closeMemberMenus);
window.addEventListener('resize', closeMemberMenus);
document.addEventListener('scroll', closeMemberMenus, true);

async function handleMemberModerationAction(action, targetId, targetTier) {

    if (!currentHub) return;

    if (action === 'moderator') {

        const makeModerator = targetTier !== 'moderator';
        const response = await fetch(`/api/hubs/${currentHub.id}/members/${targetId}/moderator`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
            body: JSON.stringify({ moderator: makeModerator })
        });
        const data = await response.json();
        if (!data.success) showToast(data.error || 'İşlem başarısız.');
        return;

    }

    if (action === 'voice-kick') {
        const room = voiceRoomsCache.find((r) => (r.participants || []).some((p) => p.user_id === targetId));
        if (room) await kickFromVoiceRoom(room.id, targetId);
        return;
    }

    if (action === 'mute') {
        const target = (currentHub.members || []).find((m) => m.user_id === targetId);
        openVoiceMuteModal(targetId, target?.username || '', null);
        return;
    }

    if (action === 'kick') {
        if (!confirm(t('confirm-kick'))) return;
        const response = await fetch(`/api/hubs/${currentHub.id}/members/${targetId}/kick`, { method: 'POST', credentials: 'include' });
        const data = await response.json();
        if (!data.success) showToast(data.error || 'İşlem başarısız.');
        return;
    }

    if (action === 'ban') {
        if (!confirm(t('confirm-ban'))) return;
        const response = await fetch(`/api/hubs/${currentHub.id}/members/${targetId}/ban`, { method: 'POST', credentials: 'include' });
        const data = await response.json();
        if (!data.success) showToast(data.error || 'İşlem başarısız.');
        return;
    }

}


// =====================================================
// HUB — "BİR ŞEY BAŞLAT" MENÜSÜ
// =====================================================

hubStartBtn.addEventListener(
    'click',
    (event) => {
        event.stopPropagation();
        hubStartMenu.style.display = hubStartMenu.style.display === 'flex' ? 'none' : 'flex';
    }
);


document.addEventListener(
    'click',
    (event) => {
        if (hubStartMenu.style.display === 'flex' && !hubStartMenu.contains(event.target) && event.target !== hubStartBtn) {
            hubStartMenu.style.display = 'none';
        }
    }
);


hubStartMenu.querySelectorAll('button').forEach((btn) => {

    btn.addEventListener('click', () => {

        hubStartMenu.style.display = 'none';
        const action = btn.dataset.action;

        if (action === 'chat') {
            hubMessageInput.focus();
        } else if (action === 'poll') {
            openPollCreateModal();
        } else if (action === 'share') {
            openShareCreateModal();
        }

    });

});


// =====================================================
// HUB — SOHBET
// =====================================================

// ─── @ önerisi (yazarken lobi üyeleri) ───
const mentionSuggest = (() => {
    const box = document.createElement('div');
    box.id = 'hub-mention-suggest';
    box.className = 'mention-suggest liquid-glass';
    box.setAttribute('role', 'listbox');
    box.hidden = true;
    hubChatForm.querySelector('.composer-input-box')?.appendChild(box);
    return box;
})();
let mentionItems = [];
let mentionIndex = 0;

function mentionQueryAtCaret() {
    const caret = hubMessageInput.selectionStart ?? hubMessageInput.value.length;
    const before = hubMessageInput.value.slice(0, caret);
    const m = /(^|\s)@([^\s@]{0,20})$/.exec(before);
    return m ? { query: m[2], start: caret - m[2].length - 1, end: caret } : null;
}

function closeMentionSuggest() {
    mentionSuggest.hidden = true;
    mentionItems = [];
}

function renderMentionSuggest() {
    const q = mentionQueryAtCaret();
    if (!q || !currentHub) { closeMentionSuggest(); return; }
    const query = q.query.toLocaleLowerCase('tr');
    const members = (currentHub.members || [])
        .filter((m) => m.user_id !== currentUser?.id && m.username.toLocaleLowerCase('tr').includes(query))
        .sort((a, b) => Number(!a.username.toLocaleLowerCase('tr').startsWith(query)) - Number(!b.username.toLocaleLowerCase('tr').startsWith(query)))
        .slice(0, 8)
        .map((m) => ({ value: m.username, label: m.username, avatar: m.avatar_data, user_id: m.user_id }));
    if (currentHub.can_mention_everyone && 'everyone'.startsWith(query)) {
        members.unshift({ value: 'everyone', label: '@everyone', hint: t('mention-everyone-hint') });
    }
    mentionItems = members;
    if (!mentionItems.length) { closeMentionSuggest(); return; }
    mentionIndex = Math.min(mentionIndex, mentionItems.length - 1);
    mentionSuggest.innerHTML = mentionItems.map((item, i) => `
        <button type="button" class="mention-suggest-item${i === mentionIndex ? ' active' : ''}" role="option" aria-selected="${i === mentionIndex}" data-mention-index="${i}">
            <span class="mention-suggest-avatar" style="--user-color:${getUserColor(item.value)};">${item.avatar ? `<img src="${escapeAttr(item.avatar)}" alt="">` : (item.user_id ? escapeHtml(item.value.charAt(0).toUpperCase()) : '@')}</span>
            <span class="mention-suggest-name">${escapeHtml(item.label)}</span>
            ${item.hint ? `<span class="mention-suggest-hint">${escapeHtml(item.hint)}</span>` : ''}
        </button>
    `).join('');
    mentionSuggest.hidden = false;
}

function applyMention(index) {
    const item = mentionItems[index];
    const q = mentionQueryAtCaret();
    if (!item || !q) return;
    const value = hubMessageInput.value;
    const insert = `@${item.value} `;
    hubMessageInput.value = value.slice(0, q.start) + insert + value.slice(q.end);
    const caret = q.start + insert.length;
    hubMessageInput.setSelectionRange(caret, caret);
    closeMentionSuggest();
    hubMessageInput.focus();
}

hubMessageInput.addEventListener('input', () => { mentionIndex = 0; renderMentionSuggest(); });
hubMessageInput.addEventListener('blur', () => setTimeout(closeMentionSuggest, 150));
hubMessageInput.addEventListener('keydown', (event) => {
    if (mentionSuggest.hidden || !mentionItems.length) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        mentionIndex = (mentionIndex + (event.key === 'ArrowDown' ? 1 : -1) + mentionItems.length) % mentionItems.length;
        renderMentionSuggest();
    } else if (event.key === 'Enter' || event.key === 'Tab') {
        event.preventDefault();
        applyMention(mentionIndex);
    } else if (event.key === 'Escape') {
        event.preventDefault();
        closeMentionSuggest();
    }
});
mentionSuggest.addEventListener('mousedown', (event) => {
    const btn = event.target.closest('[data-mention-index]');
    if (!btn) return;
    event.preventDefault();
    applyMention(Number(btn.dataset.mentionIndex));
});


// =====================================================
// YAVAŞ MOD
// =====================================================
var slowModeUntil = 0;      // bu cihazda tekrar gönderilebilecek an (ms)
var slowModeTicker = null;

function formatSlowDuration(sec) {
    sec = Number(sec) || 0;
    let tr = true;
    try { tr = (localStorage.getItem('sauran_lang') || 'tr') !== 'en'; } catch (_) { /* yoksay */ }
    if (sec >= 3600 && sec % 3600 === 0) return tr ? `${sec / 3600} saat` : `${sec / 3600} h`;
    if (sec >= 60) {
        const m = Math.floor(sec / 60), s = sec % 60;
        if (!s) return tr ? `${m} dk` : `${m} min`;
        return tr ? `${m} dk ${s} sn` : `${m} min ${s} s`;
    }
    return tr ? `${sec} sn` : `${sec} s`;
}

function slowModeActiveForMe() {
    return Boolean(currentHub && Number(currentHub.slow_mode_seconds) > 0 && !currentHub.slow_mode_exempt);
}

function slowModeRemaining() {
    return Math.max(0, Math.ceil((slowModeUntil - Date.now()) / 1000));
}

function renderSlowModeBar() {
    const bar = document.getElementById('hub-slowmode-bar');
    const sendBtn = document.getElementById('hub-send-btn');
    if (!bar) return;
    const seconds = currentHub ? Number(currentHub.slow_mode_seconds) || 0 : 0;
    const remaining = slowModeActiveForMe() ? slowModeRemaining() : 0;
    if (!seconds) {
        bar.style.display = 'none';
    } else {
        bar.style.display = 'flex';
        bar.classList.toggle('waiting', remaining > 0);
        bar.textContent = remaining > 0
            ? t('slowmode-wait-bar').replace('{s}', formatSlowDuration(remaining))
            : currentHub.slow_mode_exempt
                ? t('slowmode-exempt-bar').replace('{d}', formatSlowDuration(seconds))
                : t('slowmode-on-bar').replace('{d}', formatSlowDuration(seconds));
    }
    sendBtn?.classList.toggle('slowmode-locked', remaining > 0);
    if (remaining > 0 && !slowModeTicker) {
        slowModeTicker = setInterval(() => {
            renderSlowModeBar();
            if (!slowModeActiveForMe() || slowModeRemaining() <= 0) { clearInterval(slowModeTicker); slowModeTicker = null; renderSlowModeBar(); }
        }, 1000);
    }
}

function startSlowModeCooldown(seconds) {
    if (!slowModeActiveForMe()) return;
    slowModeUntil = Math.max(slowModeUntil, Date.now() + Number(seconds) * 1000);
    renderSlowModeBar();
}

// Gönderim engellenirse true döner ve kullanıcıya kalan süre gösterilir.
function slowModeGuard() {
    if (!slowModeActiveForMe()) return false;
    const remaining = slowModeRemaining();
    if (remaining <= 0) return false;
    showToast(t('slowmode-wait-toast').replace('{s}', formatSlowDuration(remaining)));
    renderSlowModeBar();
    return true;
}

function resetSlowModeForHub() {
    slowModeUntil = currentHub && currentHub.slow_mode_retry_after ? Date.now() + Number(currentHub.slow_mode_retry_after) * 1000 : 0;
    renderSlowModeBar();
}

document.getElementById('hubset-slowmode').addEventListener('change', async (event) => {
    if (!currentHub) return;
    const select = event.target;
    const previous = String(currentHub.slow_mode_seconds || 0);
    try {
        const response = await fetch(`/api/hubs/${currentHub.id}/slow-mode`, {
            method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ seconds: Number(select.value) })
        });
        const data = await response.json();
        if (!data.success) { select.value = previous; showToast(data.error || 'Olmadı.'); return; }
        currentHub.slow_mode_seconds = data.seconds;
        renderSlowModeBar();
    } catch (_) {
        select.value = previous;
    }
});


// =====================================================
// KELİME FİLTRESİ (lobi ayarları → Moderasyon)
// =====================================================
function fillWordFilterCard() {
    const card = document.getElementById('hubset-wordfilter-card');
    if (!card || !currentHub) return;
    const wf = currentHub.word_filter;
    card.style.display = wf ? '' : 'none';
    if (!wf) return;
    document.getElementById('hubset-wordfilter-action').value = wf.action || 'off';
    document.getElementById('hubset-wordfilter-preset').checked = Boolean(wf.use_preset);
    document.getElementById('hubset-wordfilter-terms').value = (wf.terms || []).join(', ');
    document.getElementById('hubset-wordfilter-status').textContent = '';
}

document.getElementById('hubset-wordfilter-save').addEventListener('click', async () => {
    if (!currentHub) return;
    const btn = document.getElementById('hubset-wordfilter-save');
    const status = document.getElementById('hubset-wordfilter-status');
    btn.disabled = true;
    try {
        const response = await fetch(`/api/hubs/${currentHub.id}/word-filter`, {
            method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: document.getElementById('hubset-wordfilter-action').value,
                use_preset: document.getElementById('hubset-wordfilter-preset').checked,
                terms: document.getElementById('hubset-wordfilter-terms').value
            })
        });
        const data = await response.json();
        if (!data.success) { status.textContent = data.error || 'Olmadı.'; return; }
        currentHub.word_filter = data.filter;
        fillWordFilterCard();
        status.textContent = t('wf-saved').replace('{n}', String(data.filter.terms.length));
    } catch (_) {
        status.textContent = 'Bağlantı hatası.';
    } finally {
        btn.disabled = false;
    }
});

hubChatForm.addEventListener(
    'submit',
    (event) => {

        event.preventDefault();
        closeMentionSuggest();

        const content = hubMessageInput.value.trim();
        if (!content || !currentHub || !socket) return;
        if (slowModeGuard()) return;
        if (feedPaging.hub.hasNewer) returnToLatest('hub');

        const clientId = newClientId();
        if (content.length <= 500) {
            appendHubMessage(optimisticMessage(content, 'text', { reply_to_message_id: hubReplyTarget }), { forceScroll: true, clientId });
        }
        typingSendStop('hub');
        socket.emit('hub_chat_message', { hub_id: currentHub.id, content, reply_to_message_id: hubReplyTarget, client_id: clientId });
        if (content.length <= 500) startSlowModeCooldown(currentHub.slow_mode_seconds);
        if (pendingSends.get(clientId)) pendingSends.get(clientId).content = content;

        hubMessageInput.value = '';
        cancelMessageReply('hub');

    }
);


// =====================================================
// SESLİ MESAJ KAYDI
// =====================================================

function pickSupportedAudioMimeType() {

    const candidates = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg'];

    for (const type of candidates) {
        if (window.MediaRecorder?.isTypeSupported?.(type)) return type;
    }

    return '';

}


// Tarayıcılar farklı codec'lerle kaydediyor (Chrome: webm, Safari: mp4) ve
// iOS Safari webm'i hiç oynatamıyor. Herkesin her yerde dinleyebilmesi için
// kayıttan sonra evrensel destekli mono 16 kHz WAV'a dönüştürüyoruz.
function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

function encodeWavMono16(samples, sampleRate) {

    const buffer = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(buffer);

    function writeString(offset, str) {
        for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
    }

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + samples.length * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, samples.length * 2, true);

    let offset = 44;
    for (let i = 0; i < samples.length; i++, offset += 2) {
        const s = Math.max(-1, Math.min(1, samples[i]));
        view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }

    return new Blob([buffer], { type: 'audio/wav' });

}

async function recordingToWavDataUrl(blob) {

    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    const arrayBuffer = await blob.arrayBuffer();

    const decodeCtx = new AudioCtx();
    const decoded = await decodeCtx.decodeAudioData(arrayBuffer);
    decodeCtx.close();

    const targetRate = 16000;
    const offlineCtx = new OfflineAudioContext(1, Math.ceil(decoded.duration * targetRate) + 1, targetRate);
    const source = offlineCtx.createBufferSource();
    source.buffer = decoded;
    source.connect(offlineCtx.destination);
    source.start(0);

    const rendered = await offlineCtx.startRendering();
    const wavBlob = encodeWavMono16(rendered.getChannelData(0), targetRate);

    return blobToDataUrl(wavBlob);

}


function setupVoiceRecorder(button, onRecorded) {

    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
        button.style.display = 'none';
        return;
    }

    let mediaRecorder = null;
    let chunks = [];
    let startTime = 0;
    let stream = null;

    button.addEventListener('click', async () => {

        if (mediaRecorder && mediaRecorder.state === 'recording') {
            mediaRecorder.stop();
            return;
        }

        try {

            stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            chunks = [];

            const mimeType = pickSupportedAudioMimeType();

            mediaRecorder = mimeType
                ? new MediaRecorder(stream, { mimeType })
                : new MediaRecorder(stream);

            const recordedType = (mediaRecorder.mimeType || mimeType || 'audio/webm').split(';')[0];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) chunks.push(event.data);
            };

            mediaRecorder.onstop = async () => {

                button.classList.remove('recording');
                stream.getTracks().forEach(track => track.stop());

                const duration = (Date.now() - startTime) / 1000;
                if (duration < 0.5) return;

                const blob = new Blob(chunks, { type: recordedType });

                try {

                    const wavDataUrl = await recordingToWavDataUrl(blob);
                    onRecorded(wavDataUrl, duration);

                } catch (error) {

                    console.error('Ses WAV formatına dönüştürülemedi, ham format gönderiliyor:', error);

                    const reader = new FileReader();
                    reader.onload = () => onRecorded(reader.result, duration);
                    reader.readAsDataURL(blob);

                }

            };

            startTime = Date.now();
            mediaRecorder.start();
            button.classList.add('recording');

        } catch (error) {

            console.error('Mikrofona erişilemedi:', error);
            alert('Mikrofona erişim izni gerekiyor.');

        }

    });

}


setupVoiceRecorder(hubVoiceBtn, (audioData, duration) => {

    if (!currentHub) return;

    fetch(`/api/hubs/${currentHub.id}/voice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ audio_data: audioData, duration })
    }).catch(error => console.error('Sesli mesaj gönderilemedi:', error));

});


setupVoiceRecorder(dmVoiceBtn, (audioData, duration) => {

    if (!activeDmUserId || !socket) return;

    socket.emit('dm_voice_message', { to_user_id: activeDmUserId, audio_data: audioData, duration });

});


async function loadHubMessages(hubId) {

    try {

        const response = await fetch(`/api/hubs/${hubId}/messages`, { credentials: 'include' });
        const data = await response.json();

        if (!data.success) return;

        hubFeed.innerHTML = '';
        feedPaging.hub = { key: null, oldestId: null, hasMore: false, loading: false };

        if (data.messages.length === 0) {
            hubFeed.innerHTML = `<div class="hub-feed-empty">${t('hub-feed-empty')}</div>`;
            return;
        }

        data.messages.forEach((m) => appendHubMessage(m));
        resetFeedPaging('hub', hubId, data.messages, data.has_more);
        if (currentHub?.id === hubId) markReadSoon('hub', hubId, data.messages[data.messages.length - 1].id);

    } catch (error) {

        console.error('Lobi mesajları alınamadı:', error);

    }

}


function appendHubMessage(msg, opts) {

    const empty = hubFeed.querySelector('.hub-feed-empty');
    if (empty) empty.remove();

    const wrap = document.createElement('div');
    wrap.className = 'hub-msg';
    wrap.dataset.messageId = msg.id;
    wrap.dataset.userId = msg.user_id;

    renderHubMessageIntoWrap(wrap, msg);
    if (opts && opts.clientId) trackPendingSend(opts.clientId, wrap, 'hub');

    placeFeedItem(hubFeed, wrap, opts);

}


// ─── @bahsetme ───
function messageMentionsMe(msg) {
    const m = msg?.mentions;
    if (!m || !currentUser || msg.user_id === currentUser.id) return false;
    return Boolean(m.everyone) || (m.users || []).some((u) => u.id === currentUser.id);
}

// Metin önce kaçışlanır; ardından YALNIZCA sunucunun çözdüğü bahsetmeler vurgulanır (rastgele @kelime vurgulanmaz).
function renderMentionText(content, mentions) {
    let html = escapeHtml(content || '');
    if (!mentions) return html;
    const names = (mentions.users || []).map((u) => ({ name: u.username, me: u.id === currentUser?.id }));
    if (mentions.everyone) names.push({ name: 'everyone', me: true, everyone: true });
    names.sort((a, b) => b.name.length - a.name.length);
    for (const n of names) {
        const escapedName = escapeHtml(n.name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const re = new RegExp(`(?<![\\p{L}\\p{N}_>])@${escapedName}(?![\\p{L}\\p{N}_])`, 'giu');
        html = html.replace(re, (match) => `<span class="mention${n.me ? ' mention-me' : ''}${n.everyone ? ' mention-everyone' : ''}">${match}</span>`);
    }
    return html;
}

function renderHubMessageIntoWrap(wrap, msg) {
    wrap.dataset.authorId = msg.user_id != null ? String(msg.user_id) : '';
    if (msg.kind === 'system') {
        wrap.classList.add('is-system');
        wrap.innerHTML = `<div class="hub-msg-system">${groupSystemText(msg)}</div>`;
        return;
    }

    wrap.classList.toggle('hub-msg-mentions-me', messageMentionsMe(msg));

    const time = msg.created_at
        ? serverDate(msg.created_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
        : '';

    const editedTag = msg.edited ? `<span class="edited-tag">(${t('edited-tag')})</span>` : '';
    const pinnedTag = msg.pinned_at ? `<span class="msg-pinned-tag">${t('message-pinned')}</span>` : '';

    const avatar = avatarButtonHtml(msg.user_id, msg.avatar_data, msg.username, msg.avatar_frame, msg.profile_color);

    const header = `
        <div class="header">
            <span class="username">${usernameCardHtml(msg.username, msg.plus_active, msg.name_effect)}</span>
            <span class="time">${time}${editedTag}</span>
            ${pinnedTag}
        </div>
    `;

    const isMine = currentUser && msg.user_id === currentUser.id;
    wrap.classList.toggle('msg-mine', Boolean(isMine));
    const opts = { context: 'hub' };
    const actions = buildMsgActionsBarHtml(msg, opts);
    const replyQuote = buildMsgReplyQuoteHtml(msg);
    const reactionsRow = buildMsgReactionsRowHtml(msg);

    let body;

    if (msg.kind === 'deleted') {

        body = `<div class="hub-msg-deleted">${t('message-deleted')}</div>`;

    } else if (msg.kind === 'poll') {

        body = renderPollCard(msg);

    } else if (msg.kind === 'share') {

        body = `
            <div class="hub-share-card">
                <span class="hub-share-tag">📌 Paylaşım</span>
                ${msg.content ? `<div class="hub-share-content">${escapeHtml(msg.content)}</div>` : ''}
                ${msg.payload?.url ? `<div class="hub-share-url">${escapeHtml(msg.payload.url)}</div>` : ''}
            </div>
        `;

    } else if (msg.kind === 'voice' && msg.payload) {

        body = buildVoiceCardHtml(msg.payload.audio, msg.payload.duration);

    } else if ((msg.kind === 'image' || msg.kind === 'video' || msg.kind === 'file') && msg.payload) {

        body = buildFileCardHtml(msg.payload);

    } else if (msg.kind === 'sticker' && msg.payload) {

        body = `<div class="hub-msg-sticker${stickerIsPlus(msg.payload.id) ? ' stk-msg' : ''}">${stickerInnerHtml(msg.payload.id)}</div>`;

    } else {

        body = `<div class="hub-msg-text">${renderMentionText(msg.content, msg.mentions)}</div>`;

    }

    wrap.innerHTML = `${avatar}<div class="hub-msg-body">${header}${actions}<div class="hub-msg-bubble">${replyQuote}${body}${linkPreviewHtml(msg)}</div>${reactionsRow}</div>`;

    // Sohbet teması/balon stili yalnızca .hub-msg-bubble'a uygulanır — kullanıcı adı ve avatar kutunun dışında kalır.
    applyChatTheme(wrap, msg.user_id, msg.chat_theme, msg.bubble_style, wrap.querySelector('.hub-msg-bubble'));

    wireVoiceCards(wrap);
    wireMsgAvatars(wrap);
    enableLongPress(wrap);
    wireMessageActions(wrap, msg, opts);

    wrap.querySelectorAll('.hub-poll-option').forEach((opt) => {

        opt.addEventListener('click', async () => {

            const optionIndex = Number(opt.dataset.optionIndex);

            await fetch(`/api/hubs/${currentHub.id}/poll/${msg.id}/vote`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ option_index: optionIndex })
            });

        });

    });

}


function renderPollCard(msg) {

    const options = msg.payload.options;
    const counts = msg.payload.counts || options.map(() => 0);
    const total = counts.reduce((a, b) => a + b, 0);

    return `
        <div class="hub-poll-card">
            <div class="hub-poll-question">📊 ${escapeHtml(msg.payload.question)}</div>
            ${options.map((opt, i) => {
                const pct = total ? Math.round((counts[i] / total) * 100) : 0;
                return `
                    <div class="hub-poll-option" data-option-index="${i}">
                        <div class="hub-poll-option-fill" style="width:${pct}%;"></div>
                        <div class="hub-poll-option-row">
                            <span>${escapeHtml(opt)}</span>
                            <span>${pct}%</span>
                        </div>
                    </div>
                `;
            }).join('')}
            <div class="hub-poll-total">${total} oy</div>
        </div>
    `;

}


function updateHubMessage(msg) {

    const wrap = hubFeed.querySelector(`[data-message-id="${msg.id}"]`);
    if (!wrap) return;

    renderHubMessageIntoWrap(wrap, msg);

}


function removeHubMessage(messageId) {

    const wrap = hubFeed.querySelector(`[data-message-id="${messageId}"]`);
    if (!wrap) return;

    renderHubMessageIntoWrap(wrap, { id: messageId, kind: 'deleted', username: wrap.querySelector('.username')?.textContent || '' });

}


// =====================================================
// ANKET OLUŞTURMA MODALI
// =====================================================

function openPollCreateModal() {

    pollQuestionInput.value = '';
    pollOptionsList.innerHTML = '';

    addPollOptionRow();
    addPollOptionRow();

    pollCreateModal.style.display = 'flex';
    pollQuestionInput.focus();

}


function addPollOptionRow() {

    const row = document.createElement('div');
    row.className = 'poll-option-row';
    row.innerHTML = `<input type="text" placeholder="Seçenek" maxlength="60">`;
    pollOptionsList.appendChild(row);

}


pollAddOptionBtn.addEventListener(
    'click',
    () => {
        if (pollOptionsList.children.length < 6) addPollOptionRow();
    }
);


pollCreateCloseBtn.addEventListener(
    'click',
    () => pollCreateModal.style.display = 'none'
);


pollCreateModal.addEventListener(
    'click',
    (event) => {
        if (event.target === pollCreateModal) pollCreateModal.style.display = 'none';
    }
);


pollSubmitBtn.addEventListener(
    'click',
    async () => {

        const question = pollQuestionInput.value.trim();
        const options = Array.from(pollOptionsList.querySelectorAll('input')).map(i => i.value.trim()).filter(Boolean);

        if (!question || options.length < 2 || !currentHub) return;

        pollSubmitBtn.disabled = true;

        try {

            const response = await fetch(`/api/hubs/${currentHub.id}/poll`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ question, options })
            });

            const data = await response.json();
            if (data.success) pollCreateModal.style.display = 'none';

        } catch (error) {

            console.error('Anket oluşturulamadı:', error);

        } finally {

            pollSubmitBtn.disabled = false;

        }

    }
);


// =====================================================
// PAYLAŞIM OLUŞTURMA MODALI
// =====================================================

function openShareCreateModal() {

    shareContentInput.value = '';
    shareUrlInput.value = '';
    shareCreateModal.style.display = 'flex';
    shareContentInput.focus();

}


shareCreateCloseBtn.addEventListener(
    'click',
    () => shareCreateModal.style.display = 'none'
);


shareCreateModal.addEventListener(
    'click',
    (event) => {
        if (event.target === shareCreateModal) shareCreateModal.style.display = 'none';
    }
);


shareSubmitBtn.addEventListener(
    'click',
    async () => {

        const content = shareContentInput.value.trim();
        const url = shareUrlInput.value.trim();

        if (!content && !url) return;
        if (!currentHub) return;

        shareSubmitBtn.disabled = true;

        try {

            const response = await fetch(`/api/hubs/${currentHub.id}/share`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ content, url })
            });

            const data = await response.json();
            if (data.success) shareCreateModal.style.display = 'none';

        } catch (error) {

            console.error('Paylaşılamadı:', error);

        } finally {

            shareSubmitBtn.disabled = false;

        }

    }
);


// =====================================================
// YARDIMCI — HTML NİTELİK KAÇIŞI
// =====================================================

// CSS url() içine yalnızca katı biçimde doğrulanmış base64 görsel girer (tırnak/parantez kaçamaz, dış adres yüklenemez).
function cssImageUrl(value) {
    return typeof value === 'string' && /^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/]+=*$/.test(value) ? `url("${value}")` : 'none';
}

function escapeAttr(value) {

    return String(value || '').replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

}


// =====================================================
// BAŞLAT
// =====================================================

applyLanguage(localStorage.getItem('sauran_lang') || 'tr');
// =====================================================
// FOTOĞRAF TAM EKRAN (LIGHTBOX)
// =====================================================

const imageLightbox = document.getElementById('image-lightbox');
const imageLightboxImg = document.getElementById('image-lightbox-img');
const imageLightboxClose = document.getElementById('image-lightbox-close');

document.addEventListener('click', (event) => {
    const img = event.target.closest('.lightbox-img');
    if (!img) return;
    imageLightboxImg.src = img.src;
    imageLightbox.style.display = 'flex';
});

imageLightbox.addEventListener('click', () => {
    imageLightbox.style.display = 'none';
    imageLightboxImg.src = '';
});

imageLightboxClose.addEventListener('click', (event) => {
    event.stopPropagation();
    imageLightbox.style.display = 'none';
    imageLightboxImg.src = '';
});


checkExistingSession();
window.addEventListener('resize', () => { if (typeof renderPttCallButton === 'function' && pttActiveInCall()) renderPttCallButton(); });
