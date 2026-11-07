'use strict';
// API testleri için: geçici veri klasöründe gerçek sunucuyu (index.js) ayrı süreçte başlatır, HTTP ile konuşur.
// Gerçek veritabanına, e-postaya ya da dış servislere dokunmaz (DATA_DIR geçici; e-posta/Daily/FCM anahtarları boşaltılır).
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const net = require('net');

const SERVER_DIR = path.join(__dirname, '..');

function freePort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.once('error', reject);
    s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => resolve(port)); });
  });
}

// seed(dbm): sunucu başlamadan önce aynı geçici veritabanını doldurur. Dönen değer testlere geçer.
async function startServer(seed) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sauran-api-'));
  let seeded = null;
  if (seed) {
    // db.js'i aynı geçici klasörle ayrı süreçte çalıştırmak yerine burada yükleyip kapatırız (modül önbelleği bu dosyaya özel).
    process.env.DATA_DIR = dataDir;
    const dbm = require('../db.js');
    seeded = await seed(dbm);
    dbm.db.close();
  }
  const port = await freePort();
  const env = {
    ...process.env, DATA_DIR: dataDir, PORT: String(port), NODE_ENV: 'test',
    ZOHO_EMAIL_PASSWORD: '', MAIL_PASS: '', DAILY_API_KEY: '', FIREBASE_SERVICE_ACCOUNT_JSON: '', FIREBASE_SERVICE_ACCOUNT_BASE64: '',
    VAPID_PUBLIC_KEY: '', VAPID_PRIVATE_KEY: '', LINK_PREVIEW_ALLOW_PRIVATE: '', APNS_KEY_P8: '', APNS_KEY_ID: '', APNS_TEAM_ID: '', APNS_HOST_OVERRIDE: '',
    GIPHY_API_KEY: '', TOTP_ENCRYPTION_KEY: '', RENDER: '', ALLOWED_ORIGINS: '', PUBLIC_BASE_URL: ''
  };
  const child = spawn(process.execPath, ['index.js'], { cwd: SERVER_DIR, env, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '';
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Sunucu 20 sn içinde açılmadı:\n' + output)), 20000);
    const onData = (d) => {
      output += d;
      if (output.includes('sunucusu çalışıyor')) { clearTimeout(timer); resolve(); }
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    child.once('exit', (code) => { clearTimeout(timer); reject(new Error(`Sunucu kapandı (${code}):\n${output}`)); });
  });
  child.removeAllListeners('exit');
  const base = `http://127.0.0.1:${port}`;
  return {
    base, seeded, dataDir,
    logs: () => output,
    async stop() {
      child.kill();
      await new Promise((r) => (child.exitCode != null ? r() : child.once('exit', r)));
      try { fs.rmSync(dataDir, { recursive: true, force: true }); } catch (_) { /* Windows dosya kilidi: geçici klasör kalabilir */ }
    }
  };
}

// Çerezli basit istemci. Her kullanıcı kendi oturumunu taşır.
function client(base) {
  let cookie = '';
  async function request(method, url, body) {
    const res = await fetch(base + url, {
      method,
      headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      redirect: 'manual'
    });
    const set = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
    for (const c of set) {
      const pair = c.split(';')[0];
      const [name, value] = [pair.slice(0, pair.indexOf('=')), pair.slice(pair.indexOf('=') + 1)];
      const others = cookie.split('; ').filter((p) => p && !p.startsWith(name + '='));
      cookie = (value ? [...others, pair] : others).join('; ');
    }
    let json = null;
    const text = await res.text();
    try { json = JSON.parse(text); } catch (_) { json = null; }
    return { status: res.status, body: json, text, headers: res.headers };
  }
  return {
    get: (u) => request('GET', u),
    post: (u, b = {}) => request('POST', u, b),
    patch: (u, b = {}) => request('PATCH', u, b),
    put: (u, b = {}) => request('PUT', u, b),
    del: (u, b) => request('DELETE', u, b),
    login: (username, password) => request('POST', '/api/login', { username, password }),
    get cookie() { return cookie; },
    set cookie(v) { cookie = v; }
  };
}

// Doğrulanmış kullanıcı oluşturur (kayıt + e-posta kodu adımı doğrudan db üzerinden).
function makeUser(dbm, username, { password = 'Passw0rd!x', email, birth = '1995-01-01', role } = {}) {
  const mail = email || `${username}@test.invalid`;
  const v = dbm.createVerification(username, mail, password, birth, true);
  if (!v.success) throw new Error('createVerification: ' + JSON.stringify(v));
  const u = dbm.verifyAndCreateUser(mail, v.code);
  if (!u.success) throw new Error('verifyAndCreateUser: ' + JSON.stringify(u));
  if (role) dbm.db.prepare(`UPDATE users SET platform_role = ? WHERE id = ?`).run(role, u.id);
  return { id: u.id, username, email: mail, password };
}

// En küçük Socket.IO istemcisi (Engine.IO v4 + Socket.IO v5 metin paketleri), socket.io'nun zaten getirdiği `ws` paketiyle.
// Yeni bağımlılık gerektirmez. Yalnızca test için: ikili paket, onay (ack) ve yeniden bağlanma yok.
function socket(base, cookie, { origin } = {}) {
  const WebSocket = require('ws');
  const url = base.replace(/^http/, 'ws') + '/socket.io/?EIO=4&transport=websocket';
  const ws = new WebSocket(url, { headers: { ...(cookie ? { Cookie: cookie } : {}), ...(origin ? { Origin: origin } : {}) } });
  const events = [];
  const waiters = [];
  const deliver = () => {
    for (let i = waiters.length - 1; i >= 0; i--) {
      const w = waiters[i];
      const idx = events.findIndex((e, j) => j >= w.from && !e.used && e.name === w.name && w.pred(e.data));
      if (idx >= 0) { events[idx].used = true; waiters.splice(i, 1); clearTimeout(w.timer); w.resolve(events[idx].data); }
    }
  };
  let connected;
  const ready = new Promise((resolve, reject) => {
    connected = { resolve, reject };
    ws.on('error', (e) => reject(e)); // hazır olduktan sonraki hatalar süreci çökertmesin (reject tekrar çağrılınca etkisizdir)
    ws.once('unexpected-response', (_req, res) => reject(Object.assign(new Error('el sıkışma reddedildi: ' + res.statusCode), { status: res.statusCode })));
    ws.once('close', () => reject(new Error('bağlantı kapandı')));
  });
  ws.on('message', (buf) => {
    const msg = buf.toString();
    if (msg[0] === '0') ws.send('40');                       // Engine.IO açıldı → Socket.IO ad alanına bağlan
    else if (msg === '2') ws.send('3');                       // ping → pong
    else if (msg.startsWith('40')) connected.resolve();
    else if (msg.startsWith('44')) connected.reject(new Error('bağlantı reddedildi: ' + msg.slice(2)));
    else if (msg.startsWith('42')) {
      let parsed;
      try { parsed = JSON.parse(msg.slice(2)); } catch (_) { return; } // onay kimlikli ya da başka ad alanı paketi: testlerde kullanılmıyor
      const [name, ...args] = parsed;
      events.push({ name, data: args.length > 1 ? args : args[0] });
      deliver();
    }
  });
  return {
    ready,
    events,
    emit: (name, ...args) => ws.send('42' + JSON.stringify([name, ...args])),
    // Çağrıdan SONRA gelen ve koşula uyan olayı bekler (eski olaylar sayılmaz; her olay bir kez eşleşir); gelmezse ms sonra hata.
    waitFor(name, pred = () => true, ms = 3000) {
      return new Promise((resolve, reject) => {
        const w = { name, pred, resolve, from: events.length, timer: setTimeout(() => { waiters.splice(waiters.indexOf(w), 1); reject(new Error(`'${name}' olayı ${ms} ms içinde gelmedi`)); }, ms) };
        waiters.push(w);
        deliver();
      });
    },
    // ms boyunca koşula uyan olay gelmediğini doğrular.
    async expectNone(name, pred = () => true, ms = 600) {
      await new Promise((r) => setTimeout(r, ms));
      return !events.some((e) => e.name === name && pred(e.data));
    },
    close: () => ws.close()
  };
}

module.exports = { startServer, client, makeUser, socket };
