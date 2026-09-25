// Kapalı beta: davet kodları + beta geri bildirimi.
//
// Davet kodları düz metin olarak SAKLANMAZ: yalnızca SHA-256 özeti tutulur; kodun kendisi oluşturulurken founder'a BİR KEZ gösterilir.
// Kod 50 bit rastgeleliktedir (10 karakter, Crockford base32) ve kayıt ucundaki IP hız sınırıyla korunur.
// Kod, kayıt sırasında yalnızca DOĞRULANIR; e-posta doğrulaması başarıyla bitip kullanıcı oluşurken tek bir atomik işlemle TÜKETİLİR
// (doğrulanmamış bir kayıt kodu yakmaz). Mevcut kullanıcıların girişine dokunmaz.
//
// Beta modu: BETA_INVITE_REQUIRED=off ortam değişkeni her şeyi kapatır (testler/yerel geliştirme). Aksi halde ayar veritabanındadır ve
// VARSAYILAN olarak AÇIKTIR (kapalı beta: kayıt için davet kodu gerekir). Founder panelden kapatıp açabilir.

const crypto = require('crypto');
const { db } = require('./db');

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; // Crockford base32 (I, L, O, U yok)
const CODE_LEN = 10;

db.exec(`
  CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS beta_invites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code_hash TEXT UNIQUE NOT NULL,
    code_hint TEXT NOT NULL,
    label TEXT,
    max_uses INTEGER NOT NULL DEFAULT 1,
    used_count INTEGER NOT NULL DEFAULT 0,
    expires_at DATETIME,
    revoked_at DATETIME,
    created_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS beta_invite_uses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invite_id INTEGER NOT NULL,
    user_id INTEGER,
    used_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (invite_id) REFERENCES beta_invites(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS beta_feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    category TEXT NOT NULL,
    message TEXT NOT NULL,
    context TEXT,
    status TEXT NOT NULL DEFAULT 'new',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_beta_feedback_created ON beta_feedback(created_at);
`);

const pendingCols = db.prepare(`PRAGMA table_info(pending_verifications)`).all().map(c => c.name);
if (!pendingCols.includes('beta_invite_id')) db.exec(`ALTER TABLE pending_verifications ADD COLUMN beta_invite_id INTEGER`);

// ── Beta modu ────────────────────────────────────────────────────────────────
function isRequired() {
  if (String(process.env.BETA_INVITE_REQUIRED || '').toLowerCase() === 'off') return false;
  const row = db.prepare(`SELECT value FROM app_settings WHERE key = 'beta_invite_required'`).get();
  return row ? row.value === '1' : true;
}

function setRequired(enabled) {
  db.prepare(`
    INSERT INTO app_settings (key, value, updated_at) VALUES ('beta_invite_required', ?, CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
  `).run(enabled ? '1' : '0');
}

// ── Davet kodları ────────────────────────────────────────────────────────────
function normalize(code) {
  return String(code || '').toUpperCase().replace(/[^0-9A-Z]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1');
}
function hashCode(code) { return crypto.createHash('sha256').update('sauran-beta-invite:' + normalize(code)).digest('hex'); }

function generateCode() {
  const bytes = crypto.randomBytes(CODE_LEN);
  let out = '';
  for (let i = 0; i < CODE_LEN; i++) out += ALPHABET[bytes[i] % 32];
  return out;
}
const pretty = (c) => `${c.slice(0, 5)}-${c.slice(5)}`;

function createInvite({ createdBy, label, maxUses, expiresInDays }) {
  const uses = Math.min(Math.max(parseInt(maxUses, 10) || 1, 1), 1000);
  const days = expiresInDays === null || expiresInDays === undefined || expiresInDays === '' ? null : Math.min(Math.max(parseInt(expiresInDays, 10) || 0, 1), 365);
  const expiresAt = days ? new Date(Date.now() + days * 86400000).toISOString() : null;
  const cleanLabel = String(label || '').replace(/[\r\n]+/g, ' ').trim().slice(0, 60) || null;

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateCode();
    try {
      const info = db.prepare(`
        INSERT INTO beta_invites (code_hash, code_hint, label, max_uses, expires_at, created_by) VALUES (?, ?, ?, ?, ?, ?)
      `).run(hashCode(code), code.slice(-3), cleanLabel, uses, expiresAt, createdBy);
      return { id: Number(info.lastInsertRowid), code: pretty(code), max_uses: uses, expires_at: expiresAt, label: cleanLabel };
    } catch (e) { if (!/UNIQUE/.test(String(e.message))) throw e; }
  }
  throw new Error('Kod üretilemedi.');
}

function findUsable(code) {
  const norm = normalize(code);
  if (norm.length !== CODE_LEN) return null;
  const row = db.prepare(`SELECT * FROM beta_invites WHERE code_hash = ?`).get(hashCode(norm));
  if (!row || row.revoked_at || row.used_count >= row.max_uses) return null;
  if (row.expires_at && new Date(row.expires_at).getTime() <= Date.now()) return null;
  return row;
}

// Kayıt sırasında: yalnızca doğrular (tüketmez).
function validateCode(code) {
  const row = findUsable(code);
  return row ? { ok: true, id: row.id } : { ok: false };
}

// Kullanıcı oluşurken (db.transaction içinde çağrılır): atomik tüketim + kullanım kaydı.
function redeem(inviteId, userId) {
  if (!inviteId) return false;
  const changed = db.prepare(`
    UPDATE beta_invites SET used_count = used_count + 1
    WHERE id = ? AND revoked_at IS NULL AND used_count < max_uses AND (expires_at IS NULL OR expires_at > ?)
  `).run(inviteId, new Date().toISOString()).changes;
  if (!changed) return false;
  db.prepare(`INSERT INTO beta_invite_uses (invite_id, user_id) VALUES (?, ?)`).run(inviteId, userId);
  return true;
}

function revokeInvite(id) {
  return db.prepare(`UPDATE beta_invites SET revoked_at = CURRENT_TIMESTAMP WHERE id = ? AND revoked_at IS NULL`).run(id).changes > 0;
}

function listInvites() {
  return db.prepare(`
    SELECT i.id, i.label, i.code_hint, i.max_uses, i.used_count, i.expires_at, i.revoked_at, i.created_at,
      (SELECT COUNT(*) FROM beta_invite_uses u WHERE u.invite_id = i.id) AS uses
    FROM beta_invites i ORDER BY i.id DESC LIMIT 200
  `).all().map((r) => ({
    ...r,
    state: r.revoked_at ? 'revoked'
      : (r.expires_at && new Date(r.expires_at).getTime() <= Date.now()) ? 'expired'
      : r.used_count >= r.max_uses ? 'used_up' : 'active'
  }));
}

// ── Beta geri bildirimi ──────────────────────────────────────────────────────
const FEEDBACK_CATEGORIES = ['bug', 'usability', 'performance', 'voice', 'notification', 'android', 'iphone', 'web', 'idea', 'other'];
const FEEDBACK_STATUSES = ['new', 'seen', 'resolved'];
const FEEDBACK_MSG_MAX = 1500;

function createFeedback(userId, { category, message, context }) {
  if (!FEEDBACK_CATEGORIES.includes(category)) return { success: false, error: 'Geçerli bir kategori seç.' };
  const msg = String(message || '').replace(/\r/g, '').trim();
  if (msg.length < 5) return { success: false, error: 'Lütfen en az birkaç kelimelik bir açıklama yaz.' };
  if (msg.length > FEEDBACK_MSG_MAX) return { success: false, error: `Mesaj en fazla ${FEEDBACK_MSG_MAX} karakter olabilir.` };
  // Bağlam yalnızca kısa teknik etiket olabilir (ekran adı, platform); serbest kişisel veri kabul edilmez.
  const ctx = String(context || '').trim();
  const cleanCtx = /^[A-Za-z0-9_ .:\-\/()çğıöşüÇĞİÖŞÜ]{1,120}$/.test(ctx) ? ctx : null;
  const info = db.prepare(`INSERT INTO beta_feedback (user_id, category, message, context) VALUES (?, ?, ?, ?)`).run(userId, category, msg, cleanCtx);
  return { success: true, id: Number(info.lastInsertRowid) };
}

function listFeedback({ status, limit = 100 } = {}) {
  const lim = Math.min(Math.max(parseInt(limit, 10) || 100, 1), 200);
  const rows = FEEDBACK_STATUSES.includes(status)
    ? db.prepare(`SELECT f.id, f.user_id, u.username, f.category, f.message, f.context, f.status, f.created_at FROM beta_feedback f LEFT JOIN users u ON u.id = f.user_id WHERE f.status = ? ORDER BY f.id DESC LIMIT ?`).all(status, lim)
    : db.prepare(`SELECT f.id, f.user_id, u.username, f.category, f.message, f.context, f.status, f.created_at FROM beta_feedback f LEFT JOIN users u ON u.id = f.user_id ORDER BY f.id DESC LIMIT ?`).all(lim);
  return rows;
}

function setFeedbackStatus(id, status) {
  if (!FEEDBACK_STATUSES.includes(status)) return false;
  return db.prepare(`UPDATE beta_feedback SET status = ? WHERE id = ?`).run(status, id).changes > 0;
}

function listOwnFeedback(userId) {
  return db.prepare(`SELECT id, category, message, context, status, created_at FROM beta_feedback WHERE user_id = ? ORDER BY id DESC`).all(userId);
}

// Süresiz kalmasın: 365 günden eski geri bildirim ve süresi çok geçmiş davetler silinir.
function purgeExpired() {
  const feedback = db.prepare(`DELETE FROM beta_feedback WHERE created_at < datetime('now', '-365 days')`).run().changes;
  const invites = db.prepare(`
    DELETE FROM beta_invites WHERE (revoked_at IS NOT NULL AND revoked_at < datetime('now', '-90 days'))
      OR (expires_at IS NOT NULL AND expires_at < datetime('now', '-90 days'))
  `).run().changes;
  return { feedback, invites };
}

module.exports = {
  isRequired, setRequired, createInvite, validateCode, redeem, revokeInvite, listInvites,
  FEEDBACK_CATEGORIES, FEEDBACK_STATUSES, createFeedback, listFeedback, setFeedbackStatus, listOwnFeedback, purgeExpired,
  _hashCode: hashCode, _normalize: normalize
};
