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
    session.defaultSession.setDisplayMediaRequestHandler((request, callback) => {
        desktopCapturer.getSources({ types: ['screen', 'window'] })
            .then((sources) => callback(sources.length ? { video: sources[0] } : {}))
            .catch(() => callback({}));
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
