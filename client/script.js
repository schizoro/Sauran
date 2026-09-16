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

let activeDmUserId = null;


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
    'hub-message-input': { tr: 'Bir mesaj yaz...', en: 'Type a message...' }
};

function applyLanguage(lang) {

    Object.entries(TRANSLATIONS).forEach(([id, text]) => {
        const el = document.getElementById(id);
        if (el) el.textContent = text[lang] || text.tr;
    });

    Object.entries(TRANSLATIONS_PLACEHOLDER).forEach(([id, text]) => {
        const el = document.getElementById(id);
        if (el) el.placeholder = text[lang] || text.tr;
    });

}


applyLanguage(localStorage.getItem('sauran_lang') || 'tr');


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


    // -------------------------------------------------
    // Varlık (kim çevrimiçi) değişti
    // -------------------------------------------------

    socket.on(
        'presence_changed',
        () => {

            refreshOnlinePanelIfOpen();

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

            }

        }
    );


    // -------------------------------------------------
    // Bildirim geldi
    // -------------------------------------------------

    socket.on(
        'notification_received',
        () => refreshNotificationsBadge()
    );


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
                <div class="notification-card" data-notif-id="${n.id}">
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

        return '';

    }).join('');

    notificationsList.querySelectorAll('.notification-card').forEach((card) => {

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
    dmModalTitle.textContent = `💬 ${username}`;
    dmFeed.innerHTML = '';

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

    const wrap = document.createElement('div');
    const isMine = msg.user_id === currentUser.id;

    wrap.className = `dm-msg ${isMine ? 'dm-msg-mine' : 'dm-msg-theirs'}`;

    const time = msg.created_at
        ? new Date(msg.created_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
        : '';

    wrap.innerHTML = `${escapeHtml(msg.content)}<span class="dm-msg-time">${time}</span>`;

    dmFeed.appendChild(wrap);
    dmFeed.scrollTop = dmFeed.scrollHeight;

}


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

const hubMemberList = document.getElementById('hub-member-list');
const hubDeleteBtn = document.getElementById('hub-delete-btn');

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

    if (view !== 'hub-detail' && currentHub) {

        if (socket) {
            socket.emit('leave_hub', currentHub.id);
        }

        currentHub = null;

    }

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
            <span class="hub-card-meta">👥 ${hub.member_count} kişi</span>
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

            if (data.friends.length === 0) {
                hubInviteFriendList.innerHTML = '<div class="users-list-empty">Henüz arkadaşın yok.</div>';
            }

            data.friends.forEach((friend) => {

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
    hubDetailCount.textContent = `👥 ${currentHub.members.length} kişi`;

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


async function loadHubMessages(hubId) {

    try {

        const response = await fetch(`/api/hubs/${hubId}/messages`, { credentials: 'include' });
        const data = await response.json();

        if (!data.success) return;

        hubFeed.innerHTML = '';

        if (data.messages.length === 0) {
            hubFeed.innerHTML = '<div class="hub-feed-empty">Henüz bir şey olmadı. İlk hareketi sen yap.</div>';
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

    const time = msg.created_at
        ? new Date(msg.created_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
        : '';

    const header = `
        <div class="header">
            <span class="username">${escapeHtml(msg.username)}</span>
            <span class="time">${time}</span>
        </div>
    `;

    if (msg.kind === 'poll') {

        wrap.innerHTML = header + renderPollCard(msg);

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

    } else if (msg.kind === 'share') {

        wrap.innerHTML = header + `
            <div class="hub-share-card">
                <span class="hub-share-tag">📌 Paylaşım</span>
                ${msg.content ? `<div class="hub-share-content">${escapeHtml(msg.content)}</div>` : ''}
                ${msg.payload?.url ? `<div class="hub-share-url">${escapeHtml(msg.payload.url)}</div>` : ''}
            </div>
        `;

    } else {

        wrap.innerHTML = header + `<div class="hub-msg-text">${escapeHtml(msg.content)}</div>`;

    }

    hubFeed.appendChild(wrap);
    hubFeed.scrollTop = hubFeed.scrollHeight;

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

    const header = wrap.querySelector('.header').outerHTML;
    wrap.innerHTML = header + renderPollCard(msg);

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

checkExistingSession();