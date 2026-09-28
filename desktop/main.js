// Sauran Windows masaüstü uygulaması: web uygulamasını (https://sauran.online) sarar ve — yalnızca kullanıcı
// açık rıza verirse — çalışan tanınmış oyunu algılayıp web uygulamasına iletir.
const { app, BrowserWindow, ipcMain, shell, session, desktopCapturer } = require('electron');
const { execFile } = require('child_process');
const path = require('path');
const { detectGame, parseTasklist } = require('./games');

const APP_URL = process.env.SAURAN_URL || 'https://sauran.online';
const APP_HOST = new URL(APP_URL).host;
const POLL_MS = 15000;

let win = null;
let pollTimer = null;
let lastGame = null;

function isAppOrigin(url) {
    try { return new URL(url).host === APP_HOST; } catch (_) { return false; }
}

function scanGame() {
    return new Promise((resolve) => {
        execFile('tasklist', ['/FO', 'CSV', '/NH'], { windowsHide: true, timeout: 8000, maxBuffer: 8 * 1024 * 1024 }, (error, stdout) => {
            resolve(error ? null : detectGame(parseTasklist(stdout)));
        });
    });
}

async function pollOnce() {
    const game = await scanGame();
    if (game !== lastGame) {
        lastGame = game;
        if (win && !win.isDestroyed()) win.webContents.send('sauran:game', game);
    }
}

function setDetection(enabled) {
    if (enabled && !pollTimer) {
        pollOnce();
        pollTimer = setInterval(pollOnce, POLL_MS);
    } else if (!enabled && pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
        lastGame = null;
    }
}

// Paylaşılacak ekranı/pencereyi seçtiren küçük modal pencere. Seçilen desktopCapturer kaynağını, iptalde null döndürür.
async function pickShareSource() {
    const sources = await desktopCapturer.getSources({ types: ['screen', 'window'], thumbnailSize: { width: 320, height: 180 }, fetchWindowIcons: false });
    const byId = new Map(sources.map((s) => [s.id, s]));
    const list = sources.map((s) => ({ id: s.id, name: s.name, isScreen: s.id.startsWith('screen:'), thumbnail: s.thumbnail.toDataURL() }));

    return new Promise((resolve) => {
        const picker = new BrowserWindow({
            width: 780,
            height: 580,
            parent: win || undefined,
            modal: Boolean(win),
            title: 'Ekran paylaş',
            backgroundColor: '#0f1319',
            autoHideMenuBar: true,
            minimizable: false,
            webPreferences: { preload: path.join(__dirname, 'picker-preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true }
        });
        let done = false;
        const finish = (source) => {
            if (done) return;
            done = true;
            ipcMain.removeListener('picker:choose', onChoose);
            ipcMain.removeListener('picker:cancel', onCancel);
            if (!picker.isDestroyed()) picker.close();
            resolve(source);
        };
        const fromPicker = (event) => event.sender === picker.webContents;
        const onChoose = (event, id) => { if (fromPicker(event)) finish(byId.get(id) || null); };
        const onCancel = (event) => { if (fromPicker(event)) finish(null); };
        ipcMain.on('picker:choose', onChoose);
        ipcMain.on('picker:cancel', onCancel);
        picker.on('closed', () => finish(null));
        picker.webContents.on('did-finish-load', () => picker.webContents.send('picker:sources', list));
        picker.loadFile(path.join(__dirname, 'picker.html'));
    });
}

function createWindow() {
    win = new BrowserWindow({
        width: 1280,
        height: 820,
        minWidth: 420,
        minHeight: 560,
        title: 'Sauran',
        backgroundColor: '#0a0d11',
        autoHideMenuBar: true,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true
        }
    });

    win.webContents.setWindowOpenHandler(({ url }) => {
        if (!isAppOrigin(url)) shell.openExternal(url);
        return { action: isAppOrigin(url) ? 'allow' : 'deny' };
    });
    win.webContents.on('will-navigate', (event, url) => {
        if (!isAppOrigin(url)) { event.preventDefault(); shell.openExternal(url); }
    });
    win.on('closed', () => { win = null; setDetection(false); });

    win.loadURL(APP_URL);
}

app.whenReady().then(() => {
    // Mikrofon/kamera/bildirim/ekran paylaşımı yalnızca Sauran kaynağına verilir.
    session.defaultSession.setPermissionRequestHandler((contents, permission, callback, details) => {
        const allowed = ['media', 'notifications', 'display-capture', 'clipboard-sanitized-write', 'fullscreen'];
        callback(allowed.includes(permission) && isAppOrigin(details.requestingUrl || contents.getURL()));
    });
    // Ekran paylaşımı: kullanıcı önce bir ekran/pencere seçer (seçici penceresi), iptal ederse paylaşım başlamaz.
    session.defaultSession.setDisplayMediaRequestHandler(async (request, callback) => {
        let source = null;
        try { source = await pickShareSource(); } catch (_) { source = null; }
        // İptalde boş yanıt sayfaya AbortError döndürür (Electron ek olarak bir uyarı fırlatır; zararsız, yutuyoruz).
        try { callback(source ? { video: source } : {}); } catch (_) { /* iptal */ }
    });

    ipcMain.handle('sauran:set-detection', (event, enabled) => { setDetection(Boolean(enabled)); return true; });
    ipcMain.handle('sauran:get-game', () => lastGame);

    createWindow();
});

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
    app.quit();
} else {
    app.on('second-instance', () => {
        if (win) { if (win.isMinimized()) win.restore(); win.focus(); }
    });
}

app.on('window-all-closed', () => app.quit());
