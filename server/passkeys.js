// Geçiş anahtarı (WebAuthn / passkey): parmak izi, yüz tanıma ya da Windows Hello ile şifresiz giriş.
// Kriptografik doğrulama @simplewebauthn/server ile yapılır (elle yazılmaz). Şifre ve iki adımlı doğrulama aynen çalışmaya devam eder.
// Geçiş anahtarı kendi başına güçlü bir doğrulamadır (cihazda kullanıcı doğrulaması); bu yüzden girişte ikinci adım istenmez.
const crypto = require('crypto');
const {
  generateRegistrationOptions, verifyRegistrationResponse,
  generateAuthenticationOptions, verifyAuthenticationResponse
} = require('@simplewebauthn/server');

const CHALLENGE_TTL_MS = 5 * 60 * 1000;
const MAX_PASSKEYS = 10;

function setup(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS passkeys (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      public_key BLOB NOT NULL,
      counter INTEGER NOT NULL DEFAULT 0,
      transports TEXT,
      device_type TEXT,
      backed_up INTEGER NOT NULL DEFAULT 0,
      name TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_used_at DATETIME,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_passkeys_user ON passkeys(user_id);
  `);
  const cols = db.prepare(`PRAGMA table_info(users)`).all().map((c) => c.name);
  if (!cols.includes('passkey_handle')) db.exec(`ALTER TABLE users ADD COLUMN passkey_handle BLOB`);
}

// RP kimliği (alan adı) ve kabul edilen kökenler. Üretimde sabittir (PASSKEY_RP_ID / PASSKEY_ORIGINS ya da sauran.online);
// Host başlığından türetme yalnızca yerel geliştirme ve testlerde kullanılır.
const IS_PROD = process.env.NODE_ENV === 'production' || process.env.RENDER === 'true';
const FIXED_RP_ID = process.env.PASSKEY_RP_ID || (IS_PROD ? 'sauran.online' : '');
const FIXED_ORIGINS = (process.env.PASSKEY_ORIGINS || (IS_PROD ? 'https://sauran.online' : '')).split(',').map((s) => s.trim()).filter(Boolean);
function rpFromRequest(req) {
  if (FIXED_RP_ID) return { rpID: FIXED_RP_ID, origin: FIXED_ORIGINS.length ? FIXED_ORIGINS : [`https://${FIXED_RP_ID}`] };
  const host = String(req.get('host') || '').toLowerCase();
  return { rpID: host.replace(/:\d+$/, ''), origin: `${req.protocol}://${host}` };
}

const MAX_OPEN_LOGIN_PER_IP = 5;

function createPasskeyApi({ app, db, requireAuth, createSession, setSessionCookie, manageLimiter, loginLimiter, verifyAccountPassword, isTwoFactorEnabled, verifyTwoFactorCode, onPasskeyAdded, suspensionPayload }) {
  setup(db);
  const regChallenges = new Map();   // userId -> { challenge, expires }
  const loginChallenges = new Map(); // challengeId -> { challenge, expires, ip }
  const sweep = (m) => { const now = Date.now(); for (const [k, v] of m) if (v.expires < now) m.delete(k); };

  const userHandle = (userId) => {
    let row = db.prepare(`SELECT passkey_handle FROM users WHERE id = ?`).get(userId);
    if (!row || !row.passkey_handle) {
      const h = crypto.randomBytes(32);
      db.prepare(`UPDATE users SET passkey_handle = ? WHERE id = ?`).run(h, userId);
      return new Uint8Array(h);
    }
    return new Uint8Array(row.passkey_handle);
  };
  const listFor = (userId) => db.prepare(`SELECT id, transports FROM passkeys WHERE user_id = ?`).all(userId)
    .map((p) => ({ id: p.id, transports: p.transports ? JSON.parse(p.transports) : undefined }));

  app.get('/api/passkeys', (req, res) => {
    const user = requireAuth(req, res); if (!user) return;
    const rows = db.prepare(`SELECT id, name, device_type, backed_up, created_at, last_used_at FROM passkeys WHERE user_id = ? ORDER BY created_at`).all(user.id);
    res.json({ success: true, passkeys: rows.map((r) => ({ id: r.id, name: r.name || 'Geçiş anahtarı', synced: Boolean(r.backed_up), created_at: r.created_at, last_used_at: r.last_used_at })) });
  });

  app.delete('/api/passkeys/:id', manageLimiter, (req, res) => {
    const user = requireAuth(req, res); if (!user) return;
    const info = db.prepare(`DELETE FROM passkeys WHERE id = ? AND user_id = ?`).run(String(req.params.id), user.id);
    res.status(info.changes ? 200 : 404).json({ success: Boolean(info.changes) });
  });

  app.post('/api/passkeys/register/options', manageLimiter, async (req, res) => {
    const user = requireAuth(req, res); if (!user) return;
    if (!verifyAccountPassword(user.id, req.body?.password)) {
      return res.status(403).json({ success: false, code: 'password', error: 'Şifre doğru değil.' });
    }
    if (isTwoFactorEnabled(user.id) && !verifyTwoFactorCode(user.id, req.body?.code).ok) {
      return res.status(401).json({ success: false, code: 'twofa', error: 'Doğrulama kodu doğru değil.' });
    }
    try {
      if (db.prepare(`SELECT COUNT(*) AS c FROM passkeys WHERE user_id = ?`).get(user.id).c >= MAX_PASSKEYS) {
        return res.status(400).json({ success: false, error: `En fazla ${MAX_PASSKEYS} geçiş anahtarı ekleyebilirsin.` });
      }
      const { rpID } = rpFromRequest(req);
      const options = await generateRegistrationOptions({
        rpName: 'Sauran', rpID, userName: user.username, userDisplayName: user.username, userID: userHandle(user.id),
        attestationType: 'none',
        excludeCredentials: listFor(user.id),
        authenticatorSelection: { residentKey: 'required', userVerification: 'required' }
      });
      sweep(regChallenges);
      regChallenges.set(user.id, { challenge: options.challenge, expires: Date.now() + CHALLENGE_TTL_MS });
      res.json({ success: true, options });
    } catch (e) { console.error('Geçiş anahtarı seçenek hatası:', e && e.message); res.status(500).json({ success: false, error: 'Geçiş anahtarı başlatılamadı.' }); }
  });

  app.post('/api/passkeys/register/verify', manageLimiter, async (req, res) => {
    const user = requireAuth(req, res); if (!user) return;
    const pending = regChallenges.get(user.id);
    regChallenges.delete(user.id);
    if (!pending || pending.expires < Date.now()) return res.status(400).json({ success: false, error: 'Süre doldu, tekrar dene.' });
    try {
      const { rpID, origin } = rpFromRequest(req);
      const v = await verifyRegistrationResponse({ response: req.body?.response, expectedChallenge: pending.challenge, expectedOrigin: origin, expectedRPID: rpID, requireUserVerification: true });
      if (!v.verified || !v.registrationInfo) return res.status(400).json({ success: false, error: 'Geçiş anahtarı doğrulanamadı.' });
      const { credential, credentialDeviceType, credentialBackedUp } = v.registrationInfo;
      const name = String(req.body?.name || '').replace(/[\x00-\x1F\x7F]/g, ' ').trim().slice(0, 40) || 'Geçiş anahtarı';
      db.prepare(`INSERT INTO passkeys (id, user_id, public_key, counter, transports, device_type, backed_up, name) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(credential.id, user.id, Buffer.from(credential.publicKey), credential.counter || 0, credential.transports ? JSON.stringify(credential.transports) : null, credentialDeviceType || null, credentialBackedUp ? 1 : 0, name);
      try { onPasskeyAdded && onPasskeyAdded(user.id, name); } catch (_) { /* bildirim hatası eklemeyi bozmaz */ }
      res.json({ success: true });
    } catch (e) {
      console.warn('Geçiş anahtarı kayıt doğrulaması başarısız:', e && e.message);
      res.status(400).json({ success: false, error: 'Geçiş anahtarı doğrulanamadı.' });
    }
  });

  app.post('/api/passkeys/login/options', loginLimiter, async (req, res) => {
    try {
      const { rpID } = rpFromRequest(req);
      const options = await generateAuthenticationOptions({ rpID, userVerification: 'required', allowCredentials: [] });
      sweep(loginChallenges);
      // Aynı IP'nin açık meydan okumaları: en fazla 5; fazlası en eskisini düşürür (reddetmez).
      const mine = [];
      for (const [k, v] of loginChallenges) if (v.ip === req.ip) mine.push(k);
      while (mine.length >= MAX_OPEN_LOGIN_PER_IP) loginChallenges.delete(mine.shift());
      const challengeId = crypto.randomBytes(18).toString('base64url');
      loginChallenges.set(challengeId, { challenge: options.challenge, expires: Date.now() + CHALLENGE_TTL_MS, ip: req.ip });
      res.json({ success: true, options, challenge_id: challengeId });
    } catch (e) { console.error('Geçiş anahtarı giriş seçenek hatası:', e && e.message); res.status(500).json({ success: false, error: 'Başlatılamadı.' }); }
  });

  app.post('/api/passkeys/login/verify', loginLimiter, async (req, res) => {
    const id = String(req.body?.challenge_id || '');
    const pending = loginChallenges.get(id);
    loginChallenges.delete(id);
    if (!pending || pending.expires < Date.now()) return res.status(400).json({ success: false, error: 'Süre doldu, tekrar dene.' });
    const response = req.body?.response;
    const pk = response && typeof response.id === 'string' ? db.prepare(`SELECT * FROM passkeys WHERE id = ?`).get(response.id) : null;
    if (!pk) return res.status(401).json({ success: false, error: 'Bu geçiş anahtarı tanınmadı.' });
    try {
      const { rpID, origin } = rpFromRequest(req);
      const v = await verifyAuthenticationResponse({
        response, expectedChallenge: pending.challenge, expectedOrigin: origin, expectedRPID: rpID, requireUserVerification: true,
        credential: { id: pk.id, publicKey: new Uint8Array(pk.public_key), counter: pk.counter, transports: pk.transports ? JSON.parse(pk.transports) : undefined }
      });
      if (!v.verified) return res.status(401).json({ success: false, error: 'Geçiş anahtarı doğrulanamadı.' });
      const acct = db.prepare(`SELECT account_status FROM users WHERE id = ?`).get(pk.user_id);
      if (!acct) return res.status(401).json({ success: false, error: 'Hesap bulunamadı.' });
      if (acct.account_status === 'suspended') {
        return res.status(403).json({ success: false, suspended: true, error: 'Hesabınız geçici olarak askıya alındı.', ...(suspensionPayload ? suspensionPayload(pk.user_id) : {}) });
      }
      db.prepare(`UPDATE passkeys SET counter = ?, last_used_at = CURRENT_TIMESTAMP WHERE id = ?`).run(v.authenticationInfo.newCounter || 0, pk.id);
      const remember = req.body?.remember !== false;
      const token = createSession(pk.user_id, req.headers['user-agent'], { remember });
      setSessionCookie(req, res, token, { remember });
      res.json({ success: true });
    } catch (e) {
      console.warn('Geçiş anahtarı giriş doğrulaması başarısız:', e && e.message);
      res.status(401).json({ success: false, error: 'Geçiş anahtarı doğrulanamadı.' });
    }
  });
}

module.exports = { createPasskeyApi, rpFromRequest };
