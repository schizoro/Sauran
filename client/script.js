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

function stickerEmoji(id) {
    return STICKERS.find((s) => s.id === id)?.emoji || '❔';
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

// Bildirim (arkadaşlık isteği, lobi daveti vb.) için iki notalı yükselen "ding".
function playNotifSound() {
    if (!notifSoundEnabled) return;
    const ctx = getAppAudioCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    playAppTone(ctx, 880, now, 0.14, 'sine', 0.2);
    playAppTone(ctx, 1318.5, now + 0.09, 0.18, 'sine', 0.2);
}

// Gelen DM mesajı için tek, yumuşak "pop".
function playMessageSound() {
    if (!notifSoundEnabled) return;
    const ctx = getAppAudioCtx();
    if (!ctx) return;
    playAppTone(ctx, 660, ctx.currentTime, 0.1, 'sine', 0.15);
}

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
    '#66fcf1',
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

function showLoginForm() {

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
        return getComputedStyle(document.body).getPropertyValue('--accent').trim() || '#66fcf1';
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
}

function setCurrentUser(user) {

    currentUser =
        user;

    applyAdminLinkVisibility(user);

    currentUsername =
        user.username;

    renderProfile();

}


// =====================================================
// PROFİL GÖRÜNÜMÜ
// =====================================================

function renderProfile() {

    if (!currentUser) return;

    const color =
        getUserColor(
            currentUser.username
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

    profileModalUsername.textContent =
        currentUser.username;


    // ------------------------------------------------
    // Kapak fotoğrafı
    // ------------------------------------------------

    const bannerEl = document.getElementById('profile-modal-banner');
    if (currentUser.banner_data) {
        bannerEl.style.setProperty('--banner-img', `url(${currentUser.banner_data})`);
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

            const dataUrl =
                await openImageCropper(file, { aspect: 1, outWidth: 256, title: 'Profil Fotoğrafını Kırp', round: true });

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

        const dataUrl = await openImageCropper(file, { aspect: 16 / 9, outWidth: 900, title: 'Kapak Fotoğrafını Kırp' });

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
                const response = await fetch('/api/fcm/register', {
                    method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token: value })
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

    showSystemNotification(currentHub.name, `${msg.username}: ${dmPreviewText(msg)}`, {
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

async function loadSessions() {

    const container = document.getElementById('settings-sessions-list');

    try {

        const response = await fetch('/api/sessions', { credentials: 'include' });
        const data = await response.json();
        if (!data.success) return;

        container.innerHTML = data.sessions.map((s) => {
            const date = new Date(s.created_at).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
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
    'hubs-title': { tr: 'Ana Menü', en: 'Home' },
    'hubs-owned': { tr: 'OLUŞTURDUĞUM LOBİLER', en: 'LOBBIES I CREATED' },
    'hubs-joined': { tr: 'KATILDIĞIM LOBİLER', en: 'LOBBIES I JOINED' },
    'hubs-empty': { tr: 'İlk Lobini oluştur', en: 'Create your first lobby' },
    'modal-new-hub': { tr: 'Yeni Lobi', en: 'New Lobby' },
    'add-image': { tr: 'Görsel Ekle', en: 'Add Image' },
    'change-image': { tr: 'Görseli Değiştir', en: 'Change Image' },
    'modal-hub-settings': { tr: '⚙️ Lobi Ayarları', en: '⚙️ Lobby Settings' },
    'modal-invite-friend': { tr: 'Arkadaşını Davet Et', en: 'Invite a Friend' },
    'modal-invite-friend-subtitle': { tr: 'Lobiye katılmasını istediğin arkadaşını seç.', en: 'Pick the friend you want to invite to the Hub.' },
    'modal-notifications': { tr: '🔔 Bildirimler', en: '🔔 Notifications' },
    'modal-join-code': { tr: '🔑 Davet Koduyla Katıl', en: '🔑 Join with Invite Code' },
    'modal-invite-code': { tr: '🔑 Davet Kodu', en: '🔑 Invite Code' },
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
    'report-description-placeholder': { tr: 'Ek açıklama (opsiyonel)', en: 'Additional details (optional)' },
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
            aboutInput.value = currentUser?.about_me || '';
            if (aboutCount) aboutCount.textContent = `${aboutInput.value.length}/300`;
        }

    }
);


// =====================================================
// HAKKIMDA (kendi profilim)
// =====================================================

document.getElementById('about-me-input')?.addEventListener('input', (event) => {
    const count = document.getElementById('about-me-count');
    if (count) count.textContent = `${event.target.value.length}/300`;
});

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
        withCredentials: true
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
        (errorMessage) => {

            alert(
                'Uyarı: ' +
                errorMessage
            );

        }
    );


    // -------------------------------------------------
    // Hub mesajları
    // -------------------------------------------------

    socket.on(
        'hub_message',
        (msg) => {

            appendHubMessage(msg);

            if (msg.user_id !== currentUser.id) maybeNotifyIncomingHubMessage(msg);

        }
    );


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

                appendDmMessage(msg);

            } else if (msg.user_id !== currentUser.id) {

                unreadDmCounts.set(otherId, (unreadDmCounts.get(otherId) || 0) + 1);
                updateFriendsToggleBadge();
                refreshFriendsSidebar();
                playMessageSound();

            }

            if (msg.user_id !== currentUser.id) maybeNotifyIncomingDm(msg);

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
                platform_role_revoked: t('notif-role-revoked')
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

    socket.on('hub_members_changed', (data) => {
        if (currentHub && data.hub_id === currentHub.id) {
            openHub(currentHub.id);
        }
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

    socket.on('hub_force_muted', () => {
        if (callFrame) {
            voiceUserMuted = true;
            callFrame.setLocalAudio(false);
            if (callMode === 'hub-room') syncLocalMuteState(true);
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
    refreshNotificationsBadge();
    loadNotificationPreferences();
    ensurePushSubscription();
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

async function checkExistingSession() {

    try {

        const response =
            await fetch(
                '/api/me',
                {
                    method: 'GET',
                    credentials: 'include'
                }
            );


        if (!response.ok) {

            showLoginForm();

            return;

        }


        const data =
            await response.json();


        if (
            data.success &&
            data.user
        ) {

            setCurrentUser(
                data.user
            );


            connectToChat();

        } else {

            showLoginForm();

        }

    } catch (error) {

        console.error(
            'Session kontrolü başarısız:',
            error
        );

        showLoginForm();

    }

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

    } catch (error) {
        console.error('Arkadaş listesi alınamadı:', error);
    }

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

    if ((!friends || friends.length === 0) && (!deletedDmThreads || deletedDmThreads.length === 0)) {
        friendsSidebarList.innerHTML = `<div class="friends-sidebar-empty">${t('friends-empty')}</div>`;
        return;
    }

    friendsSidebarList.innerHTML = friends.map((f) => {

        const color = getUserColor(f.username);
        const initial = f.username.charAt(0).toUpperCase();
        const unread = unreadDmCounts.get(f.id) || 0;

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
                <span class="friends-sidebar-avatar-wrap">
                    <span class="friends-sidebar-avatar" style="--user-color:${color};">${avatarInner}</span>
                    <span class="status-hex status-hex-sm friends-sidebar-status ${statusClass}" title="${escapeAttr(statusTitle)}"></span>
                </span>
                <span class="friends-sidebar-name">${escapeHtml(f.username)}</span>
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
            <span class="profile-avatar" style="--user-color:${getUserColor(f.username)};">${f.username.charAt(0).toUpperCase()}</span>
            <span>${escapeHtml(f.username)}</span>
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

        usersList.innerHTML = `<div class="users-list-empty">${isHubMembers ? 'Bu Hub\'da kimse yok.' : 'Henüz arkadaşın yok. Yukarıdan ekleyebilirsin.'}</div>`;
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
    const color = getUserColor(profile.username);
    const initial = profile.username.charAt(0).toUpperCase();
    const hasAvatar = Boolean(profile.avatar_data);

    const otherBannerEl = document.getElementById('other-profile-banner');
    if (profile.banner_data) {
        otherBannerEl.style.setProperty('--banner-img', `url(${profile.banner_data})`);
        otherBannerEl.classList.add('has-image');
    } else {
        otherBannerEl.classList.remove('has-image');
    }

    otherProfileAvatar.textContent = initial;
    otherProfileAvatar.style.setProperty('--user-color', color);
    otherProfileAvatar.style.display = hasAvatar ? 'none' : 'flex';

    otherProfileAvatarImg.src = hasAvatar ? profile.avatar_data : '';
    otherProfileAvatarImg.style.display = hasAvatar ? 'block' : 'none';

    otherProfileUsername.textContent = profile.username;

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
    activeDmUserId = userId;
    activeDmUsername = username;
    dmModalTitle.textContent = `💬 ${username}`;
    dmFeed.innerHTML = '';

    unreadDmCounts.delete(userId);
    updateFriendsToggleBadge();
    nativeNotifyCancel(`dm-${userId}`);
    refreshFriendsSidebar();

    try {

        const response = await fetch(`/api/dm/${userId}/messages`, { credentials: 'include' });
        const data = await response.json();

        if (data.success) {
            data.messages.forEach(appendDmMessage);
        }

    } catch (error) {

        console.error('DM mesajları alınamadı:', error);

    }

    dmModal.style.display = 'flex';
    dmMessageInput.focus();

}


function appendDmMessage(msg) {

    const row = document.createElement('div');

    const isMine = msg.user_id === currentUser.id;
    row.className = `dm-msg-row ${isMine ? 'msg-mine' : ''}`;

    row.innerHTML = avatarButtonHtml(msg.sender_deleted ? null : msg.user_id, msg.avatar_data, msg.sender_deleted ? t('deleted-account-label') : msg.username);

    const wrap = document.createElement('div');
    wrap.className = `dm-msg ${isMine ? 'dm-msg-mine' : 'dm-msg-theirs'}`;
    wrap.dataset.messageId = msg.id;

    renderDmMessageIntoWrap(wrap, msg, isMine);

    row.appendChild(wrap);
    wireMsgAvatars(row);

    dmFeed.appendChild(row);
    dmFeed.scrollTop = dmFeed.scrollHeight;

}


function renderDmMessageIntoWrap(wrap, msg, isMine) {

    const time = msg.created_at
        ? new Date(msg.created_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
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

        body = `<span class="dm-msg-sticker">${stickerEmoji(msg.payload.id)}</span>`;

    } else {

        body = `<span class="dm-msg-content">${escapeHtml(msg.content)}</span>`;

    }

    wrap.innerHTML = `${actions}${forwardedTag}${replyQuote}<div class="dm-msg-line">${body}<span class="dm-msg-time">${time}${editedTag}</span></div>${reactionsRow}`;

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
// MESAJ AVATARI (Hub + DM ortak)
// =====================================================

// Profil görseli gizlilik ayarına göre sunucu tarafından süzülür. Canlı (yayın) mesajlarda alıcıya özel içerik üretilemediğinden başkasının görseli gelmeyebilir;
// bu durumda REST ile (kendi yetkimize göre) daha önce alınmış görsel önbellekten kullanılır. Kendi görselimiz her zaman currentUser'dan gelir.
const knownAvatars = new Map();

function resolveAvatar(userId, avatarData) {
    if (avatarData) { knownAvatars.set(userId, avatarData); return avatarData; }
    if (currentUser && userId === currentUser.id) return currentUser.avatar_data || null;
    return knownAvatars.get(userId) || null;
}

function avatarButtonHtml(userId, avatarData, username) {

    avatarData = resolveAvatar(userId, avatarData);

    const color = getUserColor(username || '');
    const initial = (username || '?').charAt(0).toUpperCase();

    const inner = avatarData
        ? `<img src="${escapeAttr(avatarData)}" alt="">`
        : escapeHtml(initial);

    return `
        <button type="button" class="msg-avatar-btn" data-user-id="${userId}" style="--user-color:${color};color:${avatarData ? '' : color};" title="${escapeAttr(username || '')}">
            ${inner}
        </button>
    `;

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
// TEK bu modülü kullanıyor — Hub/DM için ayrı ayrı tekrar eden kod yok.

const QUICK_REACTION_EMOJIS = ['❤️', '😂', '👍', '🔥', '😮'];
const ALL_REACTION_EMOJIS = ['❤️', '😂', '👍', '👎', '😮', '😢', '🔥'];
const FORWARDABLE_KINDS = ['text', 'dm', 'voice', 'dm_voice', 'image', 'dm_image', 'video', 'dm_video', 'file', 'dm_file'];

let hubReplyTarget = null;
let dmReplyTarget = null;
let forwardMessageId = null;

function getMessagePermissions(msg, opts) {

    const isMine = Boolean(currentUser && msg.user_id === currentUser.id);
    const isDeleted = msg.kind === 'deleted';
    const isPinned = Boolean(msg.pinned_at);

    // ÖNEMLİ: Pin yetkisi SADECE Hub izin sistemi (hasAtLeastTier) üzerinden —
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
                    <span>${escapeHtml(f.username)}</span>
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

const FILE_MAX_BYTES = 10 * 1024 * 1024;

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

    document.addEventListener('click', (event) => {
        if (picker.style.display === 'grid' && !picker.contains(event.target)) {
            picker.style.display = 'none';
        }
    });

}

// prefix: 'hub' | 'dm' — bekler #{prefix}-attach-btn, #{prefix}-attach-menu,
// #{prefix}-attach-input-camera/gallery/file elementlerinin var olduğunu.
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
                if (picker) picker.style.display = 'grid';
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

    if (file.size > FILE_MAX_BYTES) {
        showToast(isVideo ? t('video-limit-toast') : t('file-limit-toast'));
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

        socket.emit('dm_message', { to_user_id: activeDmUserId, content, reply_to_message_id: dmReplyTarget });

        dmMessageInput.value = '';
        cancelMessageReply('dm');

    }
);


dmCloseBtn.addEventListener(
    'click',
    () => {
        dmModal.style.display = 'none';
        activeDmUserId = null;
    }
);


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

// ─── Sayfanın en altına in butonu ─────────────────────────────────────────
const hubScrollBottomBtn = document.getElementById('hub-scroll-bottom-btn');

function isHubFeedNearBottom() {
    return hubFeed.scrollHeight - hubFeed.scrollTop - hubFeed.clientHeight < 80;
}

function updateHubScrollBottomBtn() {
    hubScrollBottomBtn.style.display = isHubFeedNearBottom() ? 'none' : 'flex';
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
        console.error('Hub dosyası gönderilemedi:', error);
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
        console.error('Hub çıkartması gönderilemedi:', error);
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

// Sesli oda oturumu (13A): Hub ekranından çıkılsa bile korunur; üyelik
// durumunun tek doğru kaynağı sunucudur (socket ile gelen anlık görüntü).
let currentVoiceRoomHubId = null;
let currentVoiceParticipants = []; // [{ user_id, username, muted }]
let voiceSessionConfirmed = false;
let voiceRejoining = false;
let voiceLocalMuted = false;
// Kullanıcının (ya da moderatörün) BİLEREK yaptığı sessize alma. Tarayıcının/işletim sisteminin
// mikrofonu askıya alması (arka plan, ekran kilidi, başka uygulama) bunu DEĞİŞTİRMEZ.
let voiceUserMuted = false;
// Bu çağrıda mikrofon en az bir kez çalışır durumda görüldü mü (izin reddedilmişse kurtarma denenmez).
let callMicEverLive = false;
let voiceDeafened = false; // dinleme kapalı: odadaki uzak sesler bu cihazda çalınmaz
let voiceLocalSpeaking = false;
let voiceRemoteSpeaking = new Set();
let voiceSpeakingIds = new Set();
const voiceRoomsExpanded = new Set(); // "Odadakiler" listesi açık olan oda id'leri
const voiceAvatarCache = new Map(); // userId -> avatar_data (Hub değişse de kalır)

const hubInRoomCount = document.getElementById('hub-in-room-count');
const callMuteBtn = document.getElementById('call-mute-btn');

function rememberVoiceAvatars() {
    (currentHub?.members || []).forEach((m) => voiceAvatarCache.set(m.user_id, m.avatar_data || null));
}

function voiceAvatarInnerHtml(userId, username) {
    const avatar = voiceAvatarCache.get(userId);
    return avatar
        ? `<img src="${escapeAttr(avatar)}" alt="">`
        : escapeHtml((username || '?').charAt(0).toUpperCase());
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
            <${tag} class="voice-icon-btn${p.muted ? ' off' : ''}${interactive ? ' interactive' : ''}" data-voice-user="${p.user_id}"${attrs('mic')} title="${t('voice-mic-title')}">${VOICE_MIC_SVG}</${tag}>
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

function updateMuteButton() {
    callMuteBtn.textContent = voiceLocalMuted ? `🔇 ${t('voice-mic-off')}` : `🎤 ${t('voice-mic-on')}`;
    callMuteBtn.classList.toggle('muted', voiceLocalMuted);
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

function toggleLocalMute() {
    if (!callFrame || callMode !== 'hub-room') return;
    const nextMuted = !voiceLocalMuted;
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

function voiceRoomMembersHtml(room) {

    const participants = room.participants || [];
    const open = voiceRoomsExpanded.has(room.id);

    const items = participants.length === 0
        ? `<div class="hub-voice-room-members-empty">${t('voice-room-nobody-here')}</div>`
        : participants.map((p) => `
            <div class="hub-voice-room-member${p.user_id === currentUser?.id ? ' is-self' : ''}">
                <span class="hub-voice-member-avatar" style="--user-color:${getUserColor(p.username)};">${voiceAvatarInnerHtml(p.user_id, p.username)}</span>
                <span class="hub-voice-member-name">${escapeHtml(p.username)}${voiceSelfTagHtml(p.user_id)}</span>
                ${voiceStatusIconsHtml(p, true)}
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
            <span class="voice-room-preview-avatar" style="--user-color:${getUserColor(p.username)};">${voiceAvatarInnerHtml(p.user_id, p.username)}</span>
            <span class="voice-room-preview-name">${escapeHtml(p.username)}</span>
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
        <div class="call-hub-room-person${p.user_id === currentUser?.id ? ' is-self' : ''}">
            <span class="call-hub-room-avatar" style="--user-color:${getUserColor(p.username)};">${voiceAvatarInnerHtml(p.user_id, p.username)}</span>
            <span class="call-hub-room-name">${escapeHtml(p.username)}</span>
            ${p.user_id === currentUser?.id ? `<span class="voice-self-tag">${t('voice-room-you')}</span>` : ''}
            ${voiceStatusIconsHtml(p, true)}
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

});

function closeScreenshareViewer() {
    const viewer = document.getElementById('call-screenshare-viewer');
    const video = document.getElementById('call-screenshare-video');
    if (document.fullscreenElement === viewer) document.exitFullscreen?.();
    viewer.style.display = 'none';
    video.srcObject = null;
}

document.getElementById('call-screenshare-close-btn').addEventListener('click', closeScreenshareViewer);

document.querySelectorAll('.call-screenshare-viewer-controls [data-corner]').forEach((btn) => {
    btn.addEventListener('click', () => {
        const viewer = document.getElementById('call-screenshare-viewer');
        viewer.classList.remove('corner-tl', 'corner-tr', 'corner-bl', 'corner-br', 'fullscreen-mode');
        viewer.classList.add(`corner-${btn.dataset.corner}`);
    });
});

document.getElementById('call-screenshare-fullscreen-btn').addEventListener('click', () => {
    const viewer = document.getElementById('call-screenshare-viewer');
    if (document.fullscreenElement === viewer) {
        document.exitFullscreen?.();
    } else {
        viewer.requestFullscreen?.().catch(() => {});
    }
});

document.addEventListener('fullscreenchange', () => {
    const viewer = document.getElementById('call-screenshare-viewer');
    viewer.classList.toggle('fullscreen-mode', document.fullscreenElement === viewer);
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

hubSettingsOpenBtn.addEventListener('click', () => {

    if (!currentHub) return;

    hubSettingsNewImageData = undefined;
    hubSettingsNameInput.value = currentHub.name || '';
    hubSettingsError.textContent = '';

    if (currentHub.image_data) {
        hubSettingsImagePreview.style.backgroundImage = `url(${currentHub.image_data})`;
        hubSettingsImagePreview.classList.remove('hub-icon-initial');
        hubSettingsImagePreview.innerHTML = '';
    } else {
        hubSettingsImagePreview.style.backgroundImage = '';
        hubSettingsImagePreview.classList.add('hub-icon-initial');
        hubSettingsImagePreview.innerHTML = hubInitialHtml(currentHub.name);
    }

    hubSettingsModal.style.display = 'flex';

    const isOwner = !!currentHub.is_owner;
    hubSettingsNameInput.disabled = !isOwner;
    hubSettingsImageBtn.disabled = !isOwner;
    hubSettingsSaveBtn.style.display = isOwner ? '' : 'none';

    const canModerate = currentHub.my_permission_tier === 'owner' || currentHub.my_permission_tier === 'moderator';
    const bansSection = document.getElementById('hub-settings-bans-section');
    bansSection.style.display = canModerate ? 'block' : 'none';
    document.getElementById('hub-clear-chat-btn').style.display = canModerate ? 'flex' : 'none';


    document.getElementById('hub-ban-member-btn').style.display = canModerate ? 'flex' : 'none';
    showHubSettingsView('main');

});

function showHubSettingsView(view) {
    ['main', 'pick', 'bans'].forEach((v) => {
        document.getElementById(`hub-settings-${v}-view`).style.display = v === view ? 'flex' : 'none';
    });
}

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

document.getElementById('hub-bans-open-btn').addEventListener('click', () => {
    showHubSettingsView('bans');
    loadHubBans();
});

document.getElementById('hub-bans-back-btn').addEventListener('click', () => showHubSettingsView('main'));

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

hubSettingsCloseBtn.addEventListener('click', () => hubSettingsModal.style.display = 'none');
hubSettingsModal.addEventListener('click', (event) => {
    if (event.target === hubSettingsModal) hubSettingsModal.style.display = 'none';
});

hubSettingsImageBtn.addEventListener('click', () => hubSettingsImageInput.click());

hubSettingsImageInput.addEventListener('change', () => {

    const file = hubSettingsImageInput.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
        showToast("Görsel limiti 5 MB'dir.");
        return;
    }

    const reader = new FileReader();
    reader.onload = () => {
        hubSettingsNewImageData = reader.result;
        hubSettingsImagePreview.style.backgroundImage = `url(${reader.result})`;
        hubSettingsImagePreview.textContent = '';
    };
    reader.readAsDataURL(file);

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

        hubSettingsModal.style.display = 'none';
        openHub(currentHub.id);

    } catch (error) {
        console.error('Hub ayarları kaydedilemedi:', error);
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
});

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

    hubListView.style.display = view === 'hubs' ? 'flex' : 'none';
    hubDetailView.style.display = view === 'hub-detail' ? 'flex' : 'none';

    // "Ana Menü" başlığı üst çubukta sadece Ana Menü (Lobi listesi) ekranındayken görünür.
    const topbarContextTitle = document.getElementById('topbar-context-title');
    if (topbarContextTitle) topbarContextTitle.style.display = view === 'hubs' ? 'block' : 'none';

    const friendsSidebar = document.getElementById('friends-sidebar');
    const friendsSidebarToggleBtn = document.getElementById('friends-sidebar-toggle-btn');
    const showFriendsSidebar = view === 'hubs';
    friendsSidebar.style.display = showFriendsSidebar ? 'flex' : 'none';
    friendsSidebarToggleBtn.style.display = showFriendsSidebar ? 'flex' : 'none';

    // Masaüstünde panel varsayılan olarak açık kalsın (yeterli yer var),
    // ama mobilde (≤768px) sayfa açılır açılmaz Hub listesinin üzerine
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
        ? `<img src="${hub.image_data}" class="hub-card-icon" alt="">`
        : `<span class="hub-card-icon">${hubInitialHtml(hub.name)}</span>`;

    card.innerHTML = `
        ${iconHtml}
        <span class="hub-card-text">
            <span class="hub-card-name">${escapeHtml(hub.name)}</span>
            <span class="hub-card-meta">👥 ${hub.member_count} ${t('member-count')}</span>
        </span>
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

        hubListGridOwned.parentElement.style.display = hubListGridOwned.children.length ? 'block' : 'none';
        hubListGridJoined.parentElement.style.display = hubListGridJoined.children.length ? 'block' : 'none';

    } catch (error) {

        console.error('Hub listesi alınamadı:', error);

    }

}


// =====================================================
// HUB OLUŞTURMA
// =====================================================

function openHubCreateModal() {

    hubCreateNameInput.value = '';
    hubCreateImageData = null;
    hubCreateImagePreview.innerHTML = '🧩';
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

            hubCreateImageData = await resizeImageToDataUrl(file, 128);
            hubCreateImagePreview.innerHTML = `<img src="${hubCreateImageData}" alt="">`;

        } catch (error) {

            console.error('Görsel işlenemedi:', error);

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
                body: JSON.stringify({ name, image_data: hubCreateImageData })
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

            console.error('Hub oluşturulamadı:', error);
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


hubInviteBtn.addEventListener(
    'click',
    async () => {

        if (!currentHub) return;

        try {

            const response = await fetch(`/api/hubs/${currentHub.id}/invite`, {
                method: 'POST',
                credentials: 'include'
            });

            const data = await response.json();

            if (!data.success) return;

            hubInviteCodeDisplay.textContent = data.code;
            hubInviteModal.style.display = 'flex';

        } catch (error) {

            console.error('Davet oluşturulamadı:', error);

        }

    }
);


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
                    ${avatarButtonHtml(friend.id, friend.avatar_data, friend.username)}
                    <span class="liquid-friend-name">${escapeHtml(friend.username)}</span>
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

async function openHub(hubId) {

    nativeNotifyCancel(`hub-${hubId}`);

    try {

        const response = await fetch(`/api/hubs/${hubId}`, { credentials: 'include' });
        const data = await response.json();

        if (!data.success) return;

        currentHub = data.hub;

        switchToView('hub-detail');
        renderHubDetail();

        if (socket) {
            socket.emit('join_hub', hubId);
        }

        loadHubMessages(hubId);
        loadVoiceRooms(hubId);

    } catch (error) {

        console.error('Hub açılamadı:', error);

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

    if (currentHub.image_data) {
        hubDetailIcon.innerHTML = `<img src="${currentHub.image_data}" alt="" style="width:22px;height:22px;border-radius:6px;object-fit:cover;">`;
    } else {
        hubDetailIcon.innerHTML = hubInitialHtml(currentHub.name);
    }

    hubDetailName.textContent = currentHub.name;
    hubDetailCount.textContent = `👥 ${currentHub.members.length} ${t('member-count')}`;

    hubDeleteBtn.style.display = currentHub.is_owner ? 'block' : 'none';
    if (hubSettingsOpenBtn) {
        const canOpenSettings = currentHub.is_owner || currentHub.my_permission_tier === 'moderator';
        hubSettingsOpenBtn.style.display = canOpenSettings ? 'block' : 'none';
    }

    // Hub sahibi kendi Hub'ını bildiremez (anlamsız) — backend de aynı
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

// Hub sesli sohbeti artık odalar üzerinden yönetiliyor (bkz. joinVoiceRoom,
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
}

function showIncomingCall(fromId, fromUsername) {

    if (callFrame || callMode) return; // zaten görüşmedeyse gelen aramayı gösterme

    incomingCallFromId = fromId;
    incomingCallFromUsername = fromUsername;

    dmIncomingCallUsername.textContent = fromUsername;
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
        await joinCallFrame(data.room_url, data.token);
        dmCallBtn.classList.add('in-call');

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
    // kendi özel arayüzümüzü (DM profil kartı, Hub oda grid'i) gösterdiğimiz
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
            startAudioOff: false,
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
        startCallBackgroundKeepAlive();

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
}

function wireCallAudioUnlock() {

    callFrame.on('track-started', (event) => {

        if (event?.track?.kind !== 'audio' || event?.participant?.local) return;

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
        audioEl.play().catch(() => {});

    });

    callFrame.on('track-stopped', (event) => {

        if (event?.track?.kind !== 'audio') return;

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
            await callFrame.startScreenShare();
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
        if (event?.type === 'toggle_mic' && callMode === 'hub-room') toggleLocalMute();
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
        setHandler('togglemicrophone', () => { if (callMode === 'hub-room') toggleLocalMute(); });
    }

    requestCallWakeLock();
}

function stopCallBackgroundKeepAlive() {

    stopNativeVoiceService();

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

// Öne dönünce: uzak sesi tekrar oynat ve — kullanıcı KENDİSİ susturmadıysa — mikrofonu geri aç.
async function recoverCallMedia() {

    if (!callFrame || document.visibilityState !== 'visible') return;

    tryPlayAllCallAudio();

    // Kullanıcı (ya da moderatör) bilerek sessize aldıysa dokunma. İzin hiç verilmediyse de deneme.
    if (voiceUserMuted || !callMicEverLive) return;

    try {
        const local = callFrame.participants()?.local;
        const audio = local?.tracks?.audio;
        const track = audio?.persistentTrack;

        const interrupted = audio?.state === 'interrupted';
        const ended = track?.readyState === 'ended';
        const lost = !callFrame.localAudio() || interrupted || ended || Boolean(track?.muted);
        if (!lost) return;

        callFrame.setLocalAudio(true);

        // Yakalama gerçekten sonlanmışsa (track kapanmış / kesintiye uğramış) mikrofonu yeniden al.
        if ((interrupted || ended) && typeof callFrame.setInputDevicesAsync === 'function') {
            await callFrame.setInputDevicesAsync({ audioSource: true });
            callFrame.setLocalAudio(true);
        }

        if (callMode === 'hub-room' && voiceLocalMuted) syncLocalMuteState(false);

    } catch (error) {
        console.warn('Mikrofon geri açılamadı:', error);
    }
}

function scheduleCallRecovery() {
    callRecoveryTimers.forEach(clearTimeout);
    // Öne dönüşten hemen sonra izler/aygıtlar hazır olmayabilir; kısa aralıklarla tekrar dene.
    callRecoveryTimers = [0, 400, 1500, 4000].map((ms) => setTimeout(recoverCallMedia, ms));
}

document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && callFrame) {
        requestCallWakeLock();
        scheduleCallRecovery();
    }
});
window.addEventListener('pageshow', () => { if (callFrame) { requestCallWakeLock(); scheduleCallRecovery(); } });
window.addEventListener('focus', () => { if (callFrame) scheduleCallRecovery(); });


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
        membersPanelTitle.textContent = `${currentHub.name} — ${t('members-title')} - ${currentHub.members.length}`;
    }

    hubMemberList.innerHTML = currentHub.members.map((m) => {

        const avatar = avatarButtonHtml(m.user_id, m.avatar_data, m.username);
        const isSelf = m.user_id === currentUser.id;
        const tierBadge = m.permission_tier === 'owner' ? ' 👑' : m.permission_tier === 'moderator' ? ' 🛡️' : '';

        const showMenu = canModerate && !isSelf && m.permission_tier !== 'owner';

        return `
            <div class="hub-member-row" data-user-id="${m.user_id}" data-tier="${m.permission_tier}">
                <span class="hub-member-avatar-wrap">
                    ${avatar}
                    <span class="hub-member-dot" style="background:${m.online ? '#57f287' : '#4b5563'};"></span>
                </span>
                <span class="hub-member-name">${escapeHtml(m.username)}${tierBadge}</span>
                ${showMenu ? `
                    <div class="hub-member-menu-wrap">
                        <button class="hub-member-menu-btn" type="button">⋯</button>
                        <div class="hub-member-menu liquid-glass" style="display:none;">
                            ${myTier === 'owner' ? `<button data-action="moderator">${m.permission_tier === 'moderator' ? t('remove-moderator') : t('make-moderator')}</button>` : ''}
                            <button data-action="mute">🔇 ${t('mute')}</button>
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

    if (action === 'mute') {
        await fetch(`/api/hubs/${currentHub.id}/members/${targetId}/mute`, { method: 'POST', credentials: 'include' });
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

hubChatForm.addEventListener(
    'submit',
    (event) => {

        event.preventDefault();

        const content = hubMessageInput.value.trim();
        if (!content || !currentHub || !socket) return;

        socket.emit('hub_chat_message', { hub_id: currentHub.id, content, reply_to_message_id: hubReplyTarget });

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

        if (data.messages.length === 0) {
            hubFeed.innerHTML = `<div class="hub-feed-empty">${t('hub-feed-empty')}</div>`;
            return;
        }

        data.messages.forEach(appendHubMessage);

    } catch (error) {

        console.error('Hub mesajları alınamadı:', error);

    }

}


function appendHubMessage(msg) {

    const empty = hubFeed.querySelector('.hub-feed-empty');
    if (empty) empty.remove();

    const wrap = document.createElement('div');
    wrap.className = 'hub-msg';
    wrap.dataset.messageId = msg.id;

    renderHubMessageIntoWrap(wrap, msg);

    hubFeed.appendChild(wrap);
    hubFeed.scrollTop = hubFeed.scrollHeight;

}


function renderHubMessageIntoWrap(wrap, msg) {

    const time = msg.created_at
        ? new Date(msg.created_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
        : '';

    const editedTag = msg.edited ? `<span class="edited-tag">(${t('edited-tag')})</span>` : '';
    const pinnedTag = msg.pinned_at ? `<span class="msg-pinned-tag">${t('message-pinned')}</span>` : '';

    const avatar = avatarButtonHtml(msg.user_id, msg.avatar_data, msg.username);

    const header = `
        <div class="header">
            <span class="username">${escapeHtml(msg.username)}</span>
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

        body = `<div class="hub-msg-sticker">${stickerEmoji(msg.payload.id)}</div>`;

    } else {

        body = `<div class="hub-msg-text">${escapeHtml(msg.content)}</div>`;

    }

    wrap.innerHTML = `${avatar}<div class="hub-msg-body">${header}${actions}${replyQuote}${body}${reactionsRow}</div>`;

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

function escapeAttr(value) {

    return String(value || '').replaceAll('"', '&quot;');

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