const socket = io();

// DOM Elementleri
const loginScreen = document.getElementById('login-screen');
const chatScreen = document.getElementById('chat-screen');
const usernameInput = document.getElementById('username-input');
const joinBtn = document.getElementById('join-btn');
const messagesDiv = document.getElementById('messages');
const chatForm = document.getElementById('chat-form');
const messageInput = document.getElementById('message-input');

let currentUsername = '';

// ─── v1.4: Kullanıcı Renk Sistemi ────────────────────────────────────────────
const USER_COLORS = [
    '#66fcf1', // cyan (varsayılan)
    '#ff6b6b', // kırmızı
    '#ffd93d', // sarı
    '#6bcb77', // yeşil
    '#c77dff', // mor
    '#ff9f43', // turuncu
    '#74b9ff', // mavi
    '#fd79a8', // pembe
    '#a29bfe', // lavanta
    '#55efc4', // nane yeşili
];

function getUserColor(username) {
    let hash = 0;
    for (let i = 0; i < username.length; i++) {
        hash = username.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % USER_COLORS.length;
    return USER_COLORS[index];
}
// ─────────────────────────────────────────────────────────────────────────────

// SAYFA YÜKLENDİĞİNDE HAFIZA KONTROLÜ
const savedUsername = localStorage.getItem('sauran_username');
if (savedUsername) {
    currentUsername = savedUsername;
    socket.emit('join', currentUsername);
}

// Sisteme Giriş Yapma
joinBtn.addEventListener('click', () => {
    const username = usernameInput.value.trim();
    if (username) {
        currentUsername = username;
        socket.emit('join', username); 
    }
});

// Enter tuşu ile giriş
usernameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') joinBtn.click();
});

// Sunucudan Onay Gelirse
socket.on('login_success', () => {
    localStorage.setItem('sauran_username', currentUsername);
    loginScreen.style.display = 'none'; 
    chatScreen.style.display = 'flex';  
    messageInput.focus();
    loadOldMessages(); 
});

// Sunucudan Hata Gelirse
socket.on('login_error', (errorMessage) => {
    alert("Hata: " + errorMessage); 
    localStorage.removeItem('sauran_username');
    loginScreen.style.display = 'flex';
    chatScreen.style.display = 'none';
    currentUsername = ''; 
    usernameInput.value = ''; 
    usernameInput.focus();
});

// Mesaj Hatası
socket.on('message_error', (errorMessage) => {
    alert("Uyarı: " + errorMessage);
});

// Eski Mesajları Getir
async function loadOldMessages() {
    try {
        const response = await fetch('/api/messages');
        const messages = await response.json();
        messagesDiv.innerHTML = ''; 
        messages.forEach(msg => appendMessage(msg));
        scrollToBottom();
    } catch (error) {
        console.error('Mesajlar yüklenemedi:', error);
    }
}

// Yeni Mesaj Gönderme
chatForm.addEventListener('submit', (e) => {
    e.preventDefault(); 
    const content = messageInput.value.trim();
    if (content) {
        socket.emit('chat message', { username: currentUsername, content: content });
        messageInput.value = ''; 
    }
});

// Sunucudan Yeni Mesaj Geldiğinde
socket.on('chat message', (msg) => {
    appendMessage(msg);
    scrollToBottom();
});

// Mesajı Ekrana Yazdır
function appendMessage(msg) {
    const messageEl = document.createElement('div');
    messageEl.classList.add('message');

    const color = getUserColor(msg.username); // v1.4
    const timeString = msg.created_at 
        ? new Date(msg.created_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) 
        : '';

    messageEl.innerHTML = `
        <div class="header">
            <span class="username" style="color: ${color};">${msg.username}</span>
            <span class="time">${timeString}</span>
        </div>
        <div class="content">${msg.content}</div>
    `;

    // Mesajın sol border rengini de kullanıcı rengine göre ayarla (hover'da)
    messageEl.style.setProperty('--user-color', color);

    messagesDiv.appendChild(messageEl);
}

// Scroll en aşağıda
function scrollToBottom() {
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

// ─── v1.3: Çevrimiçi Kullanıcı Durumu ───────────────────────────────────────

const onlineBtn     = document.getElementById('online-btn');
const onlineCount   = document.getElementById('online-count');
const usersModal    = document.getElementById('users-modal');
const usersList     = document.getElementById('users-list');
const closeModalBtn = document.getElementById('close-modal-btn');

// Aktif kullanıcı listesi geldiğinde
socket.on('active_users', (users) => {
    onlineCount.textContent = users.length;
    usersList.innerHTML = '';
    users.forEach(name => {
        const li = document.createElement('li');
        li.textContent = name;
        li.style.color = getUserColor(name); // v1.4: modal'da da kendi rengi
        if (name.toLowerCase() === currentUsername.toLowerCase()) {
            li.classList.add('me');
        }
        usersList.appendChild(li);
    });
});

// Butona tıklayınca modal aç
onlineBtn.addEventListener('click', () => {
    usersModal.style.display = 'flex';
});

// Kapat butonu
closeModalBtn.addEventListener('click', () => {
    usersModal.style.display = 'none';
});

// Modal dışına tıklayınca kapat
usersModal.addEventListener('click', (e) => {
    if (e.target === usersModal) usersModal.style.display = 'none';
});