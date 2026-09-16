let socket = null;

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

const onlineBtn =
    document.getElementById('online-btn');

const onlineCount =
    document.getElementById('online-count');

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

const dmDictateBtn =
    document.getElementById('dm-dictate-btn');

const dmVoiceBtn =
    document.getElementById('dm-voice-btn');

const dmCallBtn =
    document.getElementById('dm-call-btn');

let activeDmUserId = null;
let activeDmUsername = '';

wireAttachMenu('dm', async (file) => {

    const fileData = await handleAttachedFile(file);
    if (!fileData || !activeDmUserId || !socket) return;

    socket.emit('dm_file_message', { to_user_id: activeDmUserId, file: fileData });

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

}


// =====================================================
// GİRİŞ / KAYIT EKRANI
// =====================================================

function showLoginForm() {

    clearAuthError();

    authTitle.textContent =
        "Sauran'a Hoş Geldin";

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

    loginUsernameInput.focus();

}


function showRegisterForm() {

    clearAuthError();

    authTitle.textContent =
        "Sauran'a Katıl";

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

    authTitle.textContent =
        'Şifremi Unuttum';

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

    authTitle.textContent =
        'Şifreyi Sıfırla';

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

    authTitle.textContent =
        'E-postanı Doğrula';

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


    loginBtn.disabled =
        true;

    loginBtn.textContent =
        'Giriş yapılıyor...';


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

            showAuthError(
                data.error ||
                'Giriş yapılamadı.'
            );

            return;

        }


        setCurrentUser(
            data.user
        );


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

        loginBtn.disabled =
            false;

        loginBtn.textContent =
            'Giriş Yap';

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


    if (password.length < 6) {

        showAuthError(
            'Şifre en az 6 karakter olmalı.'
        );

        return;

    }


    if (password !== passwordConfirm) {

        showAuthError(
            'Şifreler eşleşmiyor.'
        );

        return;

    }


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

function setCurrentUser(user) {

    currentUser =
        user;

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


avatarFileInput.addEventListener(
    'change',
    async () => {

        const file =
            avatarFileInput.files[0];

        if (!file) return;


        try {

            const dataUrl =
                await resizeImageToDataUrl(
                    file,
                    128
                );

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


function resizeImageToDataUrlWide(file, maxWidth) {

    return new Promise((resolve, reject) => {

        const reader = new FileReader();
        reader.onerror = reject;

        reader.onload = () => {

            const img = new Image();
            img.onerror = reject;

            img.onload = () => {

                const scale = Math.min(1, maxWidth / img.width);
                const w = Math.round(img.width * scale);
                const h = Math.round(img.height * scale);

                const canvas = document.createElement('canvas');
                canvas.width = w;
                canvas.height = h;

                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, w, h);

                resolve(canvas.toDataURL('image/jpeg', 0.85));

            };

            img.src = reader.result;

        };

        reader.readAsDataURL(file);

    });

}


const bannerChangeBtn = document.getElementById('banner-change-btn');
const bannerFileInput = document.getElementById('banner-file-input');

bannerChangeBtn.addEventListener('click', () => bannerFileInput.click());

bannerFileInput.addEventListener('change', async () => {

    const file = bannerFileInput.files?.[0];
    bannerFileInput.value = '';
    if (!file) return;

    try {

        const dataUrl = await resizeImageToDataUrlWide(file, 900);

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

    }
);


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

    document.body.classList.toggle('theme-light', theme === 'light');

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
    'forgot-email-btn': { tr: 'Kod Gönder', en: 'Send Code' },
    'forgot-reset-btn': { tr: 'Şifreyi Sıfırla', en: 'Reset Password' },
    'hub-create-open-btn': { tr: '+ Yeni Hub', en: '+ New Hub' },
    'hub-create-submit-btn': { tr: "Hub'ı Oluştur", en: 'Create Hub' },
    'hub-create-image-btn': { tr: 'Görsel Ekle', en: 'Add Image' },
    'logout-btn': { tr: 'Çıkış Yap', en: 'Log Out' },
    'settings-password-btn': { tr: 'Şifreyi Güncelle', en: 'Update Password' },
    'lang-confirm-btn': { tr: 'Dili Onayla', en: 'Confirm Language' },
    'hub-join-submit-btn': { tr: 'Katıl', en: 'Join' },
    'friend-add-btn': { tr: 'Ekle', en: 'Add' }
};

const TRANSLATIONS_PLACEHOLDER = {
    'login-username-input': { tr: 'Kullanıcı Adın', en: 'Username' },
    'login-password-input': { tr: 'Şifren', en: 'Password' },
    'register-username-input': { tr: 'Kullanıcı Adın', en: 'Username' },
    'register-email-input': { tr: 'E-posta Adresin', en: 'Your Email' },
    'register-password-input': { tr: 'Şifren', en: 'Password' },
    'register-password-confirm-input': { tr: 'Şifreni Tekrar Gir', en: 'Confirm Password' },
    'hub-create-name-input': { tr: 'Hub adı', en: 'Hub name' },
    'friend-add-input': { tr: 'Kullanıcı adıyla arkadaş ekle...', en: 'Add friend by username...' },
    'hub-join-code-input': { tr: 'Davet kodunu gir...', en: 'Enter invite code...' },
    'hub-message-input': { tr: 'Bir mesaj yaz...', en: 'Type a message...' },
    'dm-message-input': { tr: 'Bir mesaj yaz...', en: 'Type a message...' },
    'hub-settings-name-input': { tr: 'Hub adı', en: 'Hub name' }
};

// data-i18n / data-i18n-placeholder ile işaretlenmiş elemanlar + dinamik
// JS metinleri için ortak sözlük. t(key) her yerde kullanılabilir.
const I18N = {
    'menu-join-code': { tr: 'Davet Koduyla Katıl', en: 'Join with Invite Code' },
    'menu-notifications': { tr: 'Bildirimler', en: 'Notifications' },
    'menu-friends': { tr: 'Arkadaşlar', en: 'Friends' },
    'menu-add-friend': { tr: 'Arkadaş Ekle', en: 'Add Friend' },
    'menu-settings': { tr: 'Ayarlar', en: 'Settings' },
    'hubs-title': { tr: 'HUBLARIM', en: 'MY HUBS' },
    'hubs-owned': { tr: 'OLUŞTURDUĞUM HUBLAR', en: 'HUBS I CREATED' },
    'hubs-joined': { tr: 'KATILDIĞIM HUBLAR', en: 'HUBS I JOINED' },
    'hubs-empty': { tr: "İlk Hub'ını oluştur", en: 'Create your first Hub' },
    'modal-new-hub': { tr: 'Yeni Hub', en: 'New Hub' },
    'add-image': { tr: 'Görsel Ekle', en: 'Add Image' },
    'change-image': { tr: 'Görseli Değiştir', en: 'Change Image' },
    'modal-hub-settings': { tr: '⚙️ Hub Ayarları', en: '⚙️ Hub Settings' },
    'modal-invite-friend': { tr: '👥 Arkadaşını Davet Et', en: '👥 Invite a Friend' },
    'modal-notifications': { tr: '🔔 Bildirimler', en: '🔔 Notifications' },
    'modal-join-code': { tr: '🔑 Davet Koduyla Katıl', en: '🔑 Join with Invite Code' },
    'modal-invite-code': { tr: '🔑 Davet Kodu', en: '🔑 Invite Code' },
    'modal-poll': { tr: '📊 Oylama Başlat', en: '📊 Start a Poll' },
    'modal-share': { tr: '📌 Paylaşım Yap', en: '📌 Share Something' },
    'modal-add-friend': { tr: '➕ Arkadaş Ekle', en: '➕ Add Friend' },
    'modal-settings': { tr: '⚙️ Ayarlar', en: '⚙️ Settings' },
    'label-theme': { tr: 'Tema', en: 'Theme' },
    'theme-dark': { tr: 'Kapalı Tema', en: 'Dark Theme' },
    'theme-dark-desc': { tr: 'Siyah, karanlık arayüz', en: 'Black, dark interface' },
    'theme-light': { tr: 'Açık Tema', en: 'Light Theme' },
    'theme-light-desc': { tr: 'Açık gri arayüz', en: 'Light gray interface' },
    'label-lang': { tr: 'Dil', en: 'Language' },
    'label-change-password': { tr: 'Şifre Değiştir', en: 'Change Password' },
    'attach-camera': { tr: 'Kamerayla Çek', en: 'Take Photo/Video' },
    'attach-gallery': { tr: 'Galeriden Seç', en: 'Choose from Gallery' },
    'attach-file': { tr: 'Dosya Seç', en: 'Choose File' },
    'hub-settings-invite-friend': { tr: 'Arkadaşını Davet Et', en: 'Invite a Friend' },
    'hub-settings-invite-code': { tr: 'Davet Kodu Oluştur', en: 'Create Invite Code' },
    'hub-settings-delete': { tr: "Hub'ı Sil", en: 'Delete Hub' },
    'call-ringing': { tr: 'Aranıyor...', en: 'Calling...' },
    'call-cancel': { tr: 'İptal Et', en: 'Cancel' },
    'call-decline': { tr: 'Reddet', en: 'Decline' },
    'call-accept': { tr: 'Kabul Et', en: 'Accept' },
    'call-incoming-sub': { tr: 'seni arıyor...', en: 'is calling you...' },
    'call-leave': { tr: 'Ayrıl', en: 'Leave' },
    'call-connected': { tr: 'Bağlandı', en: 'Connected' },
    'notif-friend-request': { tr: '1 arkadaşlık isteği', en: '1 friend request' },
    'notif-hub-invite': { tr: '1 hub daveti', en: '1 hub invite' },
    'friend-request-notif-text': { tr: 'sana arkadaşlık isteği gönderdi', en: 'sent you a friend request' },
    'friends-empty': { tr: 'Henüz arkadaşın yok.', en: "You don't have any friends yet." },
    'back-to-hubs': { tr: 'Hublar', en: 'Hubs' },
    'start-something': { tr: 'Bir şey başlat', en: 'Start something' },
    'start-poll': { tr: 'Oylama', en: 'Poll' },
    'start-share': { tr: 'Paylaşım', en: 'Share' },
    'member-count': { tr: 'kişi', en: 'members' },
    'voice-rooms-title': { tr: 'SESLİ ODALAR', en: 'VOICE ROOMS' },
    'voice-room-add': { tr: 'Oda Ekle', en: 'Add Room' },
    'voice-rooms-empty': { tr: 'Henüz sesli oda yok.', en: 'No voice rooms yet.' },
    'voice-room-you-are-here': { tr: 'Bu odadasın', en: "You're here" },
    'voice-room-delete-confirm': { tr: 'Bu sesli odayı silmek istediğine emin misin?', en: 'Are you sure you want to delete this voice room?' },
    'voice-room-name-prompt': { tr: 'Oda adı:', en: 'Room name:' },

    // Dinamik JS metinleri (t() ile kullanılır)
    'send': { tr: 'Gönder', en: 'Send' },
    'save': { tr: 'Kaydet', en: 'Save' },
    'cancel': { tr: 'Vazgeç', en: 'Cancel' },
    'delete': { tr: 'Sil', en: 'Delete' },
    'edit': { tr: 'Düzenle', en: 'Edit' },
    'confirm-delete-message': { tr: 'Bu mesajı silmek istediğine emin misin?', en: 'Are you sure you want to delete this message?' },
    'message-deleted': { tr: 'Bu mesaj silindi', en: 'This message was deleted' },
    'edited-tag': { tr: '(düzenlendi)', en: '(edited)' },
    'hub-feed-empty': { tr: 'Henüz bir şey olmadı. İlk hareketi sen yap.', en: "Nothing here yet. Make the first move." },
    'connecting': { tr: 'Bağlanıyor...', en: 'Connecting...' },
    'file-limit-toast': { tr: "Dosya limiti 10 MB'dir.", en: 'File limit is 10 MB.' },
    'video-limit-toast': { tr: "Video limiti 10 MB'dir.", en: 'Video limit is 10 MB.' }
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

    }
);


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
                refreshFriendsSidebar();

            }

        }
    );


    // -------------------------------------------------
    // Bildirim geldi
    // -------------------------------------------------

    socket.on(
        'notification_received',
        (data) => {
            refreshNotificationsBadge();
            const label = data?.type === 'friend_request' ? t('notif-friend-request') : t('notif-hub-invite');
            showCenterToast(label);
        }
    );


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
    socket.on('dm_call_ended', (data) => {
        if (callFrame && (data.from_user_id === outgoingCallToId || data.from_user_id === incomingCallFromId)) {
            leaveCall();
        }
    });


    // -------------------------------------------------
    // Sesli oda değişiklikleri
    // -------------------------------------------------

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
        if (room) {
            room.participants = data.participants;
            if (currentHub) renderVoiceRoomsList();
        }
    });


    switchToView('hubs');
    loadHubList();
    refreshNotificationsBadge();

}


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

async function logout() {

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


    onlineCount.style.display =
        'none';

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

friendsSidebarToggleBtn2.addEventListener('click', () => {
    friendsSidebar2.classList.toggle('open');
    friendsSidebarToggleBtn2.classList.toggle('open');
});

async function loadFriendsSidebar() {

    try {

        const response = await fetch('/api/friends', { credentials: 'include' });
        const data = await response.json();
        if (!data.success) return;

        renderFriendsSidebar(data.friends);

    } catch (error) {
        console.error('Arkadaş listesi alınamadı:', error);
    }

}

function refreshFriendsSidebar() {
    if (hubListView.style.display !== 'none') loadFriendsSidebar();
}

function renderFriendsSidebar(friends) {

    if (!friends || friends.length === 0) {
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

        return `
            <div class="friends-sidebar-row ${f.online ? 'online' : ''}" data-friend-id="${f.id}" data-friend-name="${escapeAttr(f.username)}">
                <span class="friends-sidebar-avatar" style="--user-color:${color};">${avatarInner}</span>
                <span class="friends-sidebar-name">${escapeHtml(f.username)}</span>
                ${unread > 0 ? `<span class="friends-sidebar-unread">${unread}</span>` : ''}
            </div>
        `;

    }).join('');

    friendsSidebarList.querySelectorAll('.friends-sidebar-row').forEach((row) => {
        row.addEventListener('click', () => {
            const userId = Number(row.dataset.friendId);
            const username = row.dataset.friendName;
            unreadDmCounts.delete(userId);
            renderFriendsSidebar(friends);
            openDm(userId, username);
        });
    });

}


// =====================================================
// ÇEVRİMİÇİ / ARKADAŞLAR MODALI
// =====================================================

onlineBtn.addEventListener(
    'click',
    () => {

        usersModal.style.display = 'flex';
        openOnlinePanel();

    }
);


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


function updateOnlineLabel() {

    if (currentHub) {

        onlineBtn.title = 'Hub Üyeleri';
        onlineCount.style.display = 'flex';
        onlineCount.textContent = currentHub.members.length;

    } else {

        onlineBtn.title = 'Arkadaşlar';
        onlineCount.style.display = 'none';

    }

}


function refreshOnlinePanelIfOpen() {

    updateOnlineLabel();

    if (usersModal.style.display === 'flex') {
        openOnlinePanel();
    }

}


async function openOnlinePanel() {

    updateOnlineLabel();

    if (currentHub) {

        usersModalTitle.textContent = `🧩 ${currentHub.name} — Üyeler`;
        friendRequestsSection.style.display = 'none';
        topFriendsSection.style.display = 'none';
        usersListSubtitle.style.display = 'none';

        renderUsersList(
            currentHub.members.map(m => ({ id: m.user_id, username: m.username, online: m.online })),
            true
        );

        return;

    }

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

        const onlineFriendCount = friendsData.friends.filter(f => f.online).length;
        onlineCount.style.display = onlineFriendCount > 0 ? 'flex' : 'none';
        onlineCount.textContent = onlineFriendCount;

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

        const count = data.notifications.length;
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


function renderNotifications(notifications) {

    if (notifications.length === 0) {
        notificationsList.innerHTML = '<div class="notifications-empty">Bildirim yok.</div>';
        return;
    }

    notificationsList.innerHTML = notifications.map((n) => {

        if (n.type === 'hub_invite') {

            return `
                <div class="notification-card" data-notif-id="${n.id}" data-notif-type="hub_invite">
                    <div class="notification-text">
                        <strong>${escapeHtml(n.data.from_username)}</strong> seni
                        <strong>${escapeHtml(n.data.hub_name)}</strong> Hub'ına davet etti.
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

        return '';

    }).join('');

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
// BAŞKASININ PROFİLİ
// =====================================================

let otherProfileCache = null;

async function openOtherProfile(userId) {

    try {

        const response = await fetch(`/api/users/${userId}/profile`, { credentials: 'include' });
        const data = await response.json();

        if (!data.success) return;

        otherProfileCache = data.profile;
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

    const info = STATUS_INFO[profile.status] || STATUS_INFO.active;
    otherProfileStatusDot.classList.remove(...STATUS_CLASS_NAMES);
    otherProfileStatusDot.classList.add(info.className);
    otherProfileStatusDot.textContent = profile.status === 'invisible' ? '👻' : '';
    otherProfileStatusLabel.textContent = info.label;

    renderOtherProfileActions(profile);

}


function renderOtherProfileActions(profile) {

    let html = '';

    if (profile.blocked_by_me) {

        html = `<button class="profile-action-btn profile-action-disabled" id="unblock-btn">Engeli Kaldır</button>`;

    } else if (profile.friendship_status === 'friends') {

        html = `
            <button class="profile-action-btn profile-action-primary" id="dm-open-btn">💬 Mesaj Gönder</button>
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
            <button class="profile-action-btn profile-action-primary" id="add-friend-btn">+ Arkadaş Ekle</button>
            <button class="profile-action-btn profile-action-disabled" id="block-btn">🚫 Engelle</button>
        `;

    }

    otherProfileActions.innerHTML = html;


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

async function openDm(userId, username) {

    activeDmUserId = userId;
    activeDmUsername = username;
    dmModalTitle.textContent = `💬 ${username}`;
    dmFeed.innerHTML = '';

    unreadDmCounts.delete(userId);
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
    row.className = 'dm-msg-row';

    const isMine = msg.user_id === currentUser.id;

    row.innerHTML = avatarButtonHtml(msg.user_id, msg.avatar_data, msg.username);

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

    const canEdit = isMine && msg.kind === 'dm';
    const canDelete = isMine && msg.kind !== 'deleted';

    const actions = canDelete ? `
        <div class="hub-msg-actions">
            ${canEdit ? `<button class="msg-edit-btn" type="button" title="${t('edit')}">✎</button>` : ''}
            <button class="msg-delete-btn" type="button" title="${t('delete')}">🗑</button>
        </div>
    ` : '';

    let body;

    if (msg.kind === 'deleted') {

        body = `<span class="hub-msg-deleted">${t('message-deleted')}</span>`;

    } else if (msg.kind === 'dm_voice' && msg.payload) {

        body = buildVoiceCardHtml(msg.payload.audio, msg.payload.duration);

    } else if ((msg.kind === 'dm_image' || msg.kind === 'dm_video' || msg.kind === 'dm_file') && msg.payload) {

        body = buildFileCardHtml(msg.payload);

    } else {

        body = `<span class="dm-msg-content">${escapeHtml(msg.content)}</span>`;

    }

    wrap.innerHTML = `${actions}<div class="dm-msg-line">${body}<span class="dm-msg-time">${time}${editedTag}</span></div>`;

    wireVoiceCards(wrap);
    enableLongPress(wrap);

    wrap.querySelector('.msg-delete-btn')?.addEventListener('click', async () => {

        if (!confirm(t('confirm-delete-message'))) return;

        await fetch(`/api/messages/${msg.id}`, { method: 'DELETE', credentials: 'include' });

    });

    wrap.querySelector('.msg-edit-btn')?.addEventListener('click', () => {

        const contentEl = wrap.querySelector('.dm-msg-content');
        if (!contentEl) return;

        contentEl.outerHTML = `
            <span class="hub-msg-edit-box">
                <input type="text" value="${escapeAttr(msg.content)}" maxlength="500">
                <button class="msg-edit-save" type="button">${t('save')}</button>
                <button class="msg-edit-cancel" type="button">${t('cancel')}</button>
            </span>
        `;

        const box = wrap.querySelector('.hub-msg-edit-box');
        const input = box.querySelector('input');
        input.focus();

        box.querySelector('.msg-edit-save').addEventListener('click', async () => {

            const newContent = input.value.trim();
            if (!newContent) return;

            await fetch(`/api/messages/${msg.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ content: newContent })
            });

        });

        box.querySelector('.msg-edit-cancel').addEventListener('click', () => {
            renderDmMessageIntoWrap(wrap, msg, isMine);
        });

        input.addEventListener('keypress', (event) => {
            if (event.key === 'Enter') box.querySelector('.msg-edit-save').click();
        });

    });

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

function avatarButtonHtml(userId, avatarData, username) {

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
        item.addEventListener('click', () => {
            menu.style.display = 'none';
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

        socket.emit('dm_message', { to_user_id: activeDmUserId, content });

        dmMessageInput.value = '';

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

const hubStartBtn = document.getElementById('hub-start-btn');
const hubStartMenu = document.getElementById('hub-start-menu');
const hubChatForm = document.getElementById('hub-chat-form');
const hubMessageInput = document.getElementById('hub-message-input');
const hubDictateBtn = document.getElementById('hub-dictate-btn');
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
        callOverlay.style.display = 'flex';
    }
});

let voiceRoomsCache = [];
let currentVoiceRoomId = null;
let currentVoiceRoomName = '';

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
                    <div class="hub-voice-room-count">${isActive ? t('voice-room-you-are-here') : `${count} ${t('member-count')}`}</div>
                </div>
                ${currentHub?.is_owner ? `<button class="hub-voice-room-delete" data-delete-room="${room.id}" type="button" title="${t('delete')}">🗑</button>` : ''}
            </div>
        `;
    }).join('');

    hubVoiceRoomsList.querySelectorAll('.hub-voice-room-row').forEach((row) => {
        row.addEventListener('click', (event) => {
            if (event.target.closest('[data-delete-room]')) return;
            const roomId = Number(row.dataset.roomId);
            const room = voiceRoomsCache.find(r => r.id === roomId);
            if (!room) return;

            if (currentVoiceRoomId === roomId) {
                leaveCall();
            } else {
                joinVoiceRoom(room);
            }
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
        currentVoiceRoomName = room.name;
        callHubName.textContent = `🎙️ ${room.name}`;
        callScreenshareBtn.style.display = 'inline-block';

        await joinCallFrame(data.room_url, data.token);

        socket?.emit('voice_room_join', { room_id: room.id, hub_id: currentHub.id });

        hubInRoomPill.style.display = 'flex';
        hubInRoomName.textContent = room.name;

        renderVoiceRoomsList();

    } catch (error) {
        console.error('Sesli odaya katılınamadı:', error);
        alert('Sesli odaya katılınamadı.');
        leaveCall();
    }

}

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
        hubSettingsImagePreview.textContent = '';
    } else {
        hubSettingsImagePreview.style.backgroundImage = '';
        hubSettingsImagePreview.textContent = currentHub.icon || '🧩';
    }

    hubSettingsModal.style.display = 'flex';

});

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
        hubSettingsError.textContent = 'Hub adı en az 3 karakter olmalı.';
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
const callMiniExpandBtn = document.getElementById('call-mini-expand-btn');
const callMiniLeaveBtn = document.getElementById('call-mini-leave-btn');

callMinimizeBtn.addEventListener('click', () => {
    if (!callFrame && callMode !== 'dm-ringing') return;
    callMiniName.textContent = callHubName.textContent;
    callOverlay.style.display = 'none';
    callMiniBar.style.display = 'flex';
});

callMiniExpandBtn.addEventListener('click', () => {
    callMiniBar.style.display = 'none';
    callOverlay.style.display = 'flex';
});

callMiniLeaveBtn.addEventListener('click', () => {
    callMiniBar.style.display = 'none';
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

    const friendsSidebar = document.getElementById('friends-sidebar');
    const friendsSidebarToggleBtn = document.getElementById('friends-sidebar-toggle-btn');
    const showFriendsSidebar = view === 'hubs';
    friendsSidebar.style.display = showFriendsSidebar ? 'flex' : 'none';
    friendsSidebarToggleBtn.style.display = showFriendsSidebar ? 'flex' : 'none';

    if (view !== 'hub-detail' && currentHub) {

        if (socket) {
            socket.emit('leave_hub', currentHub.id);
        }

        // Sesli odadaysa bağlantı kopmaz — kullanıcı "Ayrıl" demeden çağrı
        // arka planda (küçültülmüş çubukta) devam eder.

        currentHub = null;

    }

    if (showFriendsSidebar) loadFriendsSidebar();

    updateOnlineLabel();

}


// =====================================================
// HUB LİSTESİ
// =====================================================

function renderHubCard(hub) {

    const card = document.createElement('div');
    card.className = 'hub-card';

    const iconHtml = hub.image_data
        ? `<img src="${hub.image_data}" class="hub-card-icon" alt="">`
        : `<span class="hub-card-icon">${hub.icon}</span>`;

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
            hubCreateError.textContent = 'Hub adı gerekli.';
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
                hubCreateError.textContent = data.error || 'Hub oluşturulamadı.';
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
            hubCreateSubmitBtn.textContent = 'Hub\'ı Oluştur';

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
                hubInviteFriendList.innerHTML = '<div class="users-list-empty">Davet edilebilecek arkadaşın yok.</div>';
            }

            invitableFriends.forEach((friend) => {

                const li = document.createElement('li');
                li.style.justifyContent = 'space-between';

                li.innerHTML = `
                    <span>${escapeHtml(friend.username)}</span>
                    <button class="friend-accept-btn" data-invite-user="${friend.id}" type="button">Davet Et</button>
                `;

                hubInviteFriendList.appendChild(li);

            });

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
        hubDetailIcon.textContent = currentHub.icon;
    }

    hubDetailName.textContent = currentHub.name;
    hubDetailCount.textContent = `👥 ${currentHub.members.length} ${t('member-count')}`;

    hubDeleteBtn.style.display = currentHub.is_owner ? 'block' : 'none';

    renderHubMembers();

}


hubDeleteBtn.addEventListener(
    'click',
    async () => {

        if (!currentHub) return;

        if (!confirm(`"${currentHub.name}" Hub'ını kalıcı olarak silmek istediğine emin misin?`)) return;

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
    callRingingState.style.display = 'flex';
    callOverlay.style.display = 'flex';

});

callRingingCancelBtn.addEventListener('click', () => {
    if (outgoingCallToId && socket) socket.emit('dm_call_cancel', { to_user_id: outgoingCallToId });
    endDmCallUi();
});

function showIncomingCall(fromId, fromUsername) {

    if (callFrame || callMode) return; // zaten görüşmedeyse gelen aramayı gösterme

    incomingCallFromId = fromId;
    incomingCallFromUsername = fromUsername;

    dmIncomingCallUsername.textContent = fromUsername;
    dmIncomingCallModal.style.display = 'flex';

}

function hideIncomingCall() {
    dmIncomingCallModal.style.display = 'none';
    incomingCallFromId = null;
    incomingCallFromUsername = '';
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
    callRingingState.style.display = 'none';
    callFrameContainer.style.display = 'none';
    callOverlay.style.display = 'flex';

    const dmProfile = document.getElementById('call-dm-profile');
    const dmAvatar = document.getElementById('call-dm-avatar');
    const dmAvatarImg = document.getElementById('call-dm-avatar-img');
    const dmUsernameEl = document.getElementById('call-dm-username');

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
        alert('Aramaya katılınamadı.');
        leaveCall();
    }

}

function endDmCallUi() {
    callOverlay.style.display = 'none';
    callRingingState.style.display = 'none';
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

    callFrame = DailyIframe.createFrame(callFrameContainer, {
        showLeaveButton: false,
        iframeStyle: { width: '100%', height: '100%', border: 'none' }
    });

    try {

        // Bu uygulamada görüntülü görüşme yok — kamerayı hiç istemiyoruz ki
        // tarayıcı kamera izni bile sormasın (sadece mikrofon).
        await callFrame.join({
            url: roomUrl,
            token,
            startVideoOff: true,
            userMediaVideoConstraints: false
        });

    } catch (error) {
        callFrame.destroy();
        callFrame = null;
        throw error;
    }

    callFrame.on('participant-updated', (event) => {
        if (event?.participant?.local && event.participant.video) {
            callFrame.setLocalVideo(false);
        }
    });

    callFrame.on('left-meeting', leaveCall);
    callFrame.on('error', (event) => {
        console.error('Daily.co çağrı hatası:', event);
        leaveCall();
    });

}


callScreenshareBtn.addEventListener('click', async () => {

    if (!callFrame || callMode !== 'hub') return;

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
    }

});


callLeaveBtn.addEventListener('click', leaveCall);


function leaveCall() {

    if ((callMode === 'dm' || callMode === 'dm-ringing') && (outgoingCallToId || incomingCallFromId) && socket) {
        socket.emit('dm_call_end', { to_user_id: outgoingCallToId || incomingCallFromId });
    }

    if (callMode === 'hub-room' && currentVoiceRoomId && socket && currentHub) {
        socket.emit('voice_room_leave', { room_id: currentVoiceRoomId, hub_id: currentHub.id });
    }

    if (callFrame) {
        callFrame.leave();
        callFrame.destroy();
        callFrame = null;
    }

    callOverlay.style.display = 'none';
    callMiniBar.style.display = 'none';
    callRingingState.style.display = 'none';
    callFrameContainer.style.display = 'block';
    document.getElementById('call-dm-profile').style.display = 'none';
    callScreenshareBtn.classList.remove('active');

    dmCallBtn.classList.remove('in-call');

    currentVoiceRoomId = null;
    currentVoiceRoomName = '';
    hubInRoomPill.style.display = 'none';
    renderVoiceRoomsList();

    callMode = null;
    outgoingCallToId = null;
    outgoingCallToUsername = '';
    incomingCallFromId = null;
    incomingCallFromUsername = '';

}



function renderHubMembers() {

    hubMemberList.innerHTML = currentHub.members.map((m) => `
        <div class="hub-member-row" data-user-id="${m.user_id}" style="cursor:pointer;">
            <span class="hub-member-dot" style="background:${m.online ? '#57f287' : '#4b5563'};"></span>
            <span class="hub-member-name">${escapeHtml(m.username)}</span>
        </div>
    `).join('');

    hubMemberList.querySelectorAll('.hub-member-row').forEach((row) => {

        const userId = Number(row.dataset.userId);
        if (userId === currentUser.id) return;

        row.addEventListener('click', () => openOtherProfile(userId));

    });

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

        socket.emit('hub_chat_message', { hub_id: currentHub.id, content });

        hubMessageInput.value = '';

    }
);


// =====================================================
// DİKTE (KONUŞARAK YAZMA)
// =====================================================

const SpeechRecognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition;

function setupDictation(button, input) {

    if (!SpeechRecognitionClass) {
        button.style.display = 'none';
        return;
    }

    let recognition = null;
    let listening = false;

    button.addEventListener('click', () => {

        if (listening) {
            recognition?.stop();
            return;
        }

        recognition = new SpeechRecognitionClass();
        recognition.lang = (localStorage.getItem('sauran_lang') || 'tr') === 'en' ? 'en-US' : 'tr-TR';
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        recognition.onstart = () => {
            listening = true;
            button.classList.add('listening');
        };

        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            input.value = (input.value ? input.value + ' ' : '') + transcript;
            input.focus();
        };

        recognition.onerror = () => {};

        recognition.onend = () => {
            listening = false;
            button.classList.remove('listening');
        };

        recognition.start();

    });

}


setupDictation(hubDictateBtn, hubMessageInput);
setupDictation(dmDictateBtn, dmMessageInput);


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

    const avatar = avatarButtonHtml(msg.user_id, msg.avatar_data, msg.username);

    const header = `
        <div class="header">
            <span class="username">${escapeHtml(msg.username)}</span>
            <span class="time">${time}${editedTag}</span>
        </div>
    `;

    const isMine = currentUser && msg.user_id === currentUser.id;
    const canEdit = isMine && msg.kind === 'text';
    const canDelete = isMine && msg.kind !== 'deleted';

    const actions = canDelete ? `
        <div class="hub-msg-actions">
            ${canEdit ? `<button class="msg-edit-btn" type="button" title="${t('edit')}">✎</button>` : ''}
            <button class="msg-delete-btn" type="button" title="${t('delete')}">🗑</button>
        </div>
    ` : '';

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

    } else {

        body = `<div class="hub-msg-text">${escapeHtml(msg.content)}</div>`;

    }

    wrap.innerHTML = `${avatar}<div class="hub-msg-body">${header}${actions}${body}</div>`;

    wireVoiceCards(wrap);
    wireMsgAvatars(wrap);
    enableLongPress(wrap);

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

    wrap.querySelector('.msg-delete-btn')?.addEventListener('click', async () => {

        if (!confirm(t('confirm-delete-message'))) return;

        await fetch(`/api/messages/${msg.id}`, { method: 'DELETE', credentials: 'include' });

    });

    wrap.querySelector('.msg-edit-btn')?.addEventListener('click', () => {

        const textEl = wrap.querySelector('.hub-msg-text');
        if (!textEl) return;

        textEl.outerHTML = `
            <div class="hub-msg-edit-box">
                <input type="text" value="${escapeAttr(msg.content)}" maxlength="500">
                <button class="msg-edit-save" type="button">${t('save')}</button>
                <button class="msg-edit-cancel" type="button">${t('cancel')}</button>
            </div>
        `;

        const box = wrap.querySelector('.hub-msg-edit-box');
        const input = box.querySelector('input');
        input.focus();

        box.querySelector('.msg-edit-save').addEventListener('click', async () => {

            const newContent = input.value.trim();
            if (!newContent) return;

            await fetch(`/api/messages/${msg.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ content: newContent })
            });

        });

        box.querySelector('.msg-edit-cancel').addEventListener('click', () => {
            renderHubMessageIntoWrap(wrap, msg);
        });

        input.addEventListener('keypress', (event) => {
            if (event.key === 'Enter') box.querySelector('.msg-edit-save').click();
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