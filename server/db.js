const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// DATA_DIR verilirse (örn. Render'da bağlı kalıcı disk) oraya, verilmezse
// projenin kendi 'data' klasörüne yazar. Böylece kalıcı disk eklendiğinde
// tek yapılması gereken DATA_DIR ortam değişkenini disk yoluna ayarlamak.
const dataDir = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
fs.mkdirSync(dataDir, { recursive: true });

const dbPath = path.join(dataDir, 'sauran.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// =====================================================
// TABLOLAR
// =====================================================

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    username TEXT NOT NULL,
    content TEXT NOT NULL,
    room TEXT DEFAULT 'general',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`);

// =====================================================
// v1.4 MIGRATION
// =====================================================

const userColumns = db
  .prepare(`PRAGMA table_info(users)`)
  .all()
  .map(col => col.name);

if (!userColumns.includes('email')) {
  db.exec(`ALTER TABLE users ADD COLUMN email TEXT`);
}
if (!userColumns.includes('password_hash')) {
  db.exec(`ALTER TABLE users ADD COLUMN password_hash TEXT`);
}
if (!userColumns.includes('password_salt')) {
  db.exec(`ALTER TABLE users ADD COLUMN password_salt TEXT`);
}

// =====================================================
// v1.5 MIGRATION — PROFİL
// =====================================================

if (!userColumns.includes('about_me')) {
  db.exec(`ALTER TABLE users ADD COLUMN about_me TEXT`);
}
if (!userColumns.includes('status')) {
  db.exec(`ALTER TABLE users ADD COLUMN status TEXT DEFAULT 'active'`);
}

db.exec(`
  UPDATE users SET status = 'active' WHERE status IS NULL OR status = 'signal';
  UPDATE users SET status = 'idle' WHERE status = 'sleep';
  UPDATE users SET status = 'busy' WHERE status = 'locked';
`);
if (!userColumns.includes('avatar_visibility')) {
  db.exec(`ALTER TABLE users ADD COLUMN avatar_visibility TEXT DEFAULT 'public'`);
}
if (!userColumns.includes('avatar_data')) {
  db.exec(`ALTER TABLE users ADD COLUMN avatar_data TEXT`);
}
if (!userColumns.includes('banner_data')) {
  db.exec(`ALTER TABLE users ADD COLUMN banner_data TEXT`);
}

const VALID_STATUSES = ['active', 'idle', 'busy', 'invisible'];
const VALID_VISIBILITIES = ['public', 'friends', 'private'];

// =====================================================
// v1.6 MIGRATION — HUB SİSTEMİ
// =====================================================

db.exec(`
  CREATE TABLE IF NOT EXISTS hubs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    template TEXT,
    icon TEXT NOT NULL DEFAULT '🧩',
    description TEXT,
    created_by INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS hub_roles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    hub_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    icon TEXT NOT NULL DEFAULT '⚪',
    slot_limit INTEGER,
    position INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (hub_id) REFERENCES hubs(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS hub_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    hub_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    role_id INTEGER,
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(hub_id, user_id),
    FOREIGN KEY (hub_id) REFERENCES hubs(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (role_id) REFERENCES hub_roles(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS hub_poll_votes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    message_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    option_index INTEGER NOT NULL,
    UNIQUE(message_id, user_id),
    FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`);

const messageColumns = db
  .prepare(`PRAGMA table_info(messages)`)
  .all()
  .map(col => col.name);

if (!messageColumns.includes('hub_id')) {
  db.exec(`ALTER TABLE messages ADD COLUMN hub_id INTEGER`);
}
if (!messageColumns.includes('kind')) {
  db.exec(`ALTER TABLE messages ADD COLUMN kind TEXT DEFAULT 'text'`);
}
if (!messageColumns.includes('payload')) {
  db.exec(`ALTER TABLE messages ADD COLUMN payload TEXT`);
}
if (!messageColumns.includes('to_user_id')) {
  db.exec(`ALTER TABLE messages ADD COLUMN to_user_id INTEGER`);
}
if (!messageColumns.includes('edited')) {
  db.exec(`ALTER TABLE messages ADD COLUMN edited INTEGER DEFAULT 0`);
}

const HUB_TYPES = ['chat', 'game', 'stream', 'custom'];

// =====================================================
// v1.7 MIGRATION — ARKADAŞLIK
// =====================================================

db.exec(`
  CREATE TABLE IF NOT EXISTS friendships (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_low INTEGER NOT NULL,
    user_high INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    requested_by INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    responded_at DATETIME,
    UNIQUE(user_low, user_high),
    FOREIGN KEY (user_low) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (user_high) REFERENCES users(id) ON DELETE CASCADE
  );
`);

// =====================================================
// v1.8 MIGRATION — DAVET / ENGELLEME / GİZLİLİK
// =====================================================

db.exec(`
  CREATE TABLE IF NOT EXISTS hub_invites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    hub_id INTEGER NOT NULL,
    code TEXT UNIQUE NOT NULL,
    created_by INTEGER NOT NULL,
    max_uses INTEGER,
    uses INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (hub_id) REFERENCES hubs(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS blocked_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    blocked_user_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, blocked_user_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (blocked_user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`);

const hubColumns = db
  .prepare(`PRAGMA table_info(hubs)`)
  .all()
  .map(col => col.name);

if (!hubColumns.includes('image_data')) {
  db.exec(`ALTER TABLE hubs ADD COLUMN image_data TEXT`);
}
if (!hubColumns.includes('daily_room_name')) {
  db.exec(`ALTER TABLE hubs ADD COLUMN daily_room_name TEXT`);
}

// =====================================================
// v1.16 MIGRATION — SESLİ ODALAR (BİRDEN FAZLA)
// =====================================================

db.exec(`
  CREATE TABLE IF NOT EXISTS hub_voice_rooms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    hub_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    daily_room_name TEXT,
    created_by INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (hub_id) REFERENCES hubs(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id)
  );
`);

// =====================================================
// v1.19 MIGRATION — HUB YETKİ KATMANLARI (owner/moderator/member) + BAN
// =====================================================

const hubMembersColumns = db
  .prepare(`PRAGMA table_info(hub_members)`)
  .all()
  .map(col => col.name);

if (!hubMembersColumns.includes('permission_tier')) {
  db.exec(`ALTER TABLE hub_members ADD COLUMN permission_tier TEXT NOT NULL DEFAULT 'member'`);

  // Mevcut Hub sahiplerini geriye dönük olarak 'owner' yap.
  db.exec(`
    UPDATE hub_members SET permission_tier = 'owner'
    WHERE user_id = (SELECT created_by FROM hubs WHERE hubs.id = hub_members.hub_id)
  `);
}

db.exec(`
  CREATE TABLE IF NOT EXISTS hub_bans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    hub_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    banned_by INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(hub_id, user_id),
    FOREIGN KEY (hub_id) REFERENCES hubs(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`);

const PERMISSION_RANK = { member: 0, moderator: 1, owner: 2 };

// =====================================================
// v1.20 MIGRATION — RAPORLAMA (REPORT) SİSTEMİ
// =====================================================

db.exec(`
  CREATE TABLE IF NOT EXISTS reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    reporter_user_id INTEGER NOT NULL,
    target_type TEXT NOT NULL,
    target_id INTEGER NOT NULL,
    reason TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'new',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    reviewed_by INTEGER,
    reviewed_at DATETIME,
    FOREIGN KEY (reporter_user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`);

const REPORT_TARGET_TYPES = ['message', 'user', 'hub', 'voice_room'];
const REPORT_REASONS = ['harassment', 'threat', 'spam', 'scam', 'inappropriate', 'child_safety', 'hate', 'impersonation', 'other'];
const REPORT_STATUSES = ['new', 'under_review', 'action_taken', 'dismissed'];
const REPORT_PRIORITIES = ['normal', 'high', 'critical'];

// Kategoriye göre otomatik öncelik — bu sadece moderasyon kuyruğunda
// görünürlük sırası, kategori otomatik suçluluk/ceza anlamına gelmez
// (rapor her zaman bir inceleme talebidir, moderatör karar verir).
const REPORT_REASON_PRIORITY = {
  child_safety: 'critical',
  threat: 'critical',
  harassment: 'high',
  hate: 'high',
  impersonation: 'high'
};

function priorityForReason(reason) {
  return REPORT_REASON_PRIORITY[reason] || 'normal';
}

// =====================================================
// v1.21 MIGRATION — YAŞ DOĞRULAMA / ÇOCUK GÜVENLİĞİ
// =====================================================
// NOT: Asgari yaş eşiği (13) yaygın bir sektör pratiğidir (ör. COPPA), ancak
// Türkiye mevzuatı ve mağaza politikaları güncel olabilir — yayın öncesi
// güncel resmi kaynaklarla doğrulanmalıdır. Bu eşik "kesin yasal sonuç" değildir.

const MIN_SIGNUP_AGE = 13;
const MINOR_AGE_THRESHOLD = 18;

const pendingVerificationColumns = db
  .prepare(`PRAGMA table_info(pending_verifications)`)
  .all()
  .map(col => col.name);

if (!pendingVerificationColumns.includes('birth_date')) {
  db.exec(`ALTER TABLE pending_verifications ADD COLUMN birth_date TEXT`);
}

const usersAgeColumns = db
  .prepare(`PRAGMA table_info(users)`)
  .all()
  .map(col => col.name);

if (!usersAgeColumns.includes('birth_date')) {
  db.exec(`ALTER TABLE users ADD COLUMN birth_date TEXT`);
}

function calculateAge(birthDateStr) {
  const birthDate = new Date(birthDateStr);
  if (Number.isNaN(birthDate.getTime())) return null;

  const now = new Date();
  let age = now.getFullYear() - birthDate.getFullYear();
  const monthDiff = now.getMonth() - birthDate.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birthDate.getDate())) {
    age -= 1;
  }

  return age;
}

function isMinorAge(age) {
  return typeof age === 'number' && age < MINOR_AGE_THRESHOLD;
}

// =====================================================
// v1.22 MIGRATION — KVKK / KULLANIM ŞARTLARI ONAYI
// =====================================================

const pendingTermsColumns = db
  .prepare(`PRAGMA table_info(pending_verifications)`)
  .all()
  .map(col => col.name);

if (!pendingTermsColumns.includes('terms_accepted')) {
  db.exec(`ALTER TABLE pending_verifications ADD COLUMN terms_accepted INTEGER NOT NULL DEFAULT 0`);
}

const usersTermsColumns = db
  .prepare(`PRAGMA table_info(users)`)
  .all()
  .map(col => col.name);

if (!usersTermsColumns.includes('terms_accepted_at')) {
  db.exec(`ALTER TABLE users ADD COLUMN terms_accepted_at DATETIME`);
}

// =====================================================
// v1.23 MIGRATION — MERKEZİ BİLDİRİM SİSTEMİ / TERCİHLER
// =====================================================
// NOT: Bu tablo, hangi bildirim türünün hangi tercih sütununa karşılık
// geldiğini eşleştiren NOTIFICATION_CATEGORY_MAP ile birlikte kullanılır
// (bkz. index.js). Yeni bir bildirim türü eklerken önce bu eşleştirmeye
// bakılmalı — her özellik kendi bildirim mantığını yazmamalı.

db.exec(`
  CREATE TABLE IF NOT EXISTS notification_preferences (
    user_id INTEGER PRIMARY KEY,
    desktop_enabled INTEGER NOT NULL DEFAULT 1,
    inapp_enabled INTEGER NOT NULL DEFAULT 1,
    sound_enabled INTEGER NOT NULL DEFAULT 1,
    notify_dm_message INTEGER NOT NULL DEFAULT 1,
    notify_hub_message INTEGER NOT NULL DEFAULT 1,
    notify_friend_request INTEGER NOT NULL DEFAULT 1,
    notify_friend_accepted INTEGER NOT NULL DEFAULT 1,
    notify_incoming_call INTEGER NOT NULL DEFAULT 1,
    notify_missed_call INTEGER NOT NULL DEFAULT 1,
    notify_hub_event INTEGER NOT NULL DEFAULT 1,
    notify_system INTEGER NOT NULL DEFAULT 1,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`);

const NOTIFICATION_PREF_COLUMNS = [
  'desktop_enabled', 'inapp_enabled', 'sound_enabled',
  'notify_dm_message', 'notify_hub_message',
  'notify_friend_request', 'notify_friend_accepted',
  'notify_incoming_call', 'notify_missed_call',
  'notify_hub_event', 'notify_system'
];

function getNotificationPreferences(userId) {
  db.prepare(`INSERT OR IGNORE INTO notification_preferences (user_id) VALUES (?)`).run(userId);
  return db.prepare(`SELECT * FROM notification_preferences WHERE user_id = ?`).get(userId);
}

function updateNotificationPreferences(userId, patch) {
  getNotificationPreferences(userId); // satırın var olduğundan emin ol

  const updates = [];
  const values = [];

  for (const key of NOTIFICATION_PREF_COLUMNS) {
    if (Object.prototype.hasOwnProperty.call(patch || {}, key)) {
      updates.push(`${key} = ?`);
      values.push(patch[key] ? 1 : 0);
    }
  }

  if (updates.length === 0) return { success: true, preferences: getNotificationPreferences(userId) };

  values.push(userId);
  db.prepare(`UPDATE notification_preferences SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?`).run(...values);

  return { success: true, preferences: getNotificationPreferences(userId) };
}

// Tek merkezi bildirim yazma noktası — tüm özellikler (arkadaşlık, Hub
// daveti, aramalar, vb.) bildirim oluşturmak için bunu kullanmalı, kendi
// INSERT'ini yazmamalı.
function createNotification(userId, type, data) {
  const info = db.prepare(`
    INSERT INTO notifications (user_id, type, data) VALUES (?, ?, ?)
  `).run(userId, type, JSON.stringify(data || {}));

  return { id: info.lastInsertRowid, user_id: userId, type, data };
}

// =====================================================
// v1.24 MIGRATION — RAPOR ÖNCELİĞİ + MODERASYON GEÇMİŞİ
// =====================================================

const reportsColumns = db
  .prepare(`PRAGMA table_info(reports)`)
  .all()
  .map(col => col.name);

if (!reportsColumns.includes('priority')) {
  db.exec(`ALTER TABLE reports ADD COLUMN priority TEXT NOT NULL DEFAULT 'normal'`);
}

db.exec(`
  CREATE TABLE IF NOT EXISTS moderation_actions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    report_id INTEGER NOT NULL,
    moderator_id INTEGER,
    action TEXT NOT NULL,
    reason TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE
  );
`);

function logModerationAction(reportId, moderatorId, action, reason) {
  db.prepare(`
    INSERT INTO moderation_actions (report_id, moderator_id, action, reason) VALUES (?, ?, ?, ?)
  `).run(reportId, moderatorId || null, action, reason || null);
}

function listModerationHistory(reportId) {
  return db.prepare(`
    SELECT moderation_actions.*, users.username AS moderator_username
    FROM moderation_actions
    LEFT JOIN users ON users.id = moderation_actions.moderator_id
    WHERE moderation_actions.report_id = ?
    ORDER BY moderation_actions.created_at ASC
  `).all(reportId);
}

// =====================================================
// v1.25 MIGRATION — PLATFORM YETKİ SİSTEMİ (Hub rollerinden AYRI)
// =====================================================
// users.platform_role, Sauran platformu genelindeki yetkiyi tutar
// (user/moderator/admin/founder). Bu, hub_members.permission_tier
// (owner/moderator/member) ile KARIŞTIRILMAMALI — bir kullanıcı aynı anda
// platform_role='user' VE bir Hub'da permission_tier='owner' olabilir; bu
// ona platform moderasyon yetkisi VERMEZ. Web arayüzünden hiç kimse kendi
// platform_role'ünü değiştiremez — bu kolon sadece CLI'den (admin.js
// set-role) yazılabilir.

const usersRoleColumns = db
  .prepare(`PRAGMA table_info(users)`)
  .all()
  .map(col => col.name);

if (!usersRoleColumns.includes('platform_role')) {
  db.exec(`ALTER TABLE users ADD COLUMN platform_role TEXT NOT NULL DEFAULT 'user'`);
}

const PLATFORM_ROLES = ['user', 'moderator', 'admin', 'founder'];
const PLATFORM_ROLE_RANK = { user: 0, moderator: 1, admin: 2, founder: 3 };

function hasAtLeastPlatformRole(platformRole, minRole) {
  return (PLATFORM_ROLE_RANK[platformRole] ?? 0) >= (PLATFORM_ROLE_RANK[minRole] ?? 0);
}

function setPlatformRole(username, role) {
  if (!PLATFORM_ROLES.includes(role)) {
    return { success: false, error: `Geçersiz rol. Geçerli roller: ${PLATFORM_ROLES.join(', ')}` };
  }

  const user = db.prepare(`SELECT id, username, platform_role FROM users WHERE LOWER(username) = LOWER(?)`).get(username);
  if (!user) return { success: false, error: 'Kullanıcı bulunamadı.' };

  db.prepare(`UPDATE users SET platform_role = ? WHERE id = ?`).run(role, user.id);

  return { success: true, username: user.username, old_role: user.platform_role, new_role: role };
}

function getReportTargetContext(targetType, targetId) {
  try {
    if (targetType === 'user') {
      const u = db.prepare(`SELECT id, username, avatar_data FROM users WHERE id = ?`).get(targetId);
      return u ? { exists: true, username: u.username, user_id: u.id, avatar_data: u.avatar_data } : { exists: false };
    }

    if (targetType === 'hub') {
      const h = db.prepare(`SELECT id, name, icon, created_by FROM hubs WHERE id = ?`).get(targetId);
      if (!h) return { exists: false };
      const owner = db.prepare(`SELECT username FROM users WHERE id = ?`).get(h.created_by);
      return { exists: true, hub_id: h.id, hub_name: h.name, hub_icon: h.icon, owner_username: owner?.username || null };
    }

    if (targetType === 'message') {
      const m = db.prepare(`
        SELECT messages.id, messages.user_id, messages.username, messages.content, messages.kind, messages.payload,
               messages.hub_id, messages.to_user_id, messages.created_at,
               hubs.name AS hub_name
        FROM messages LEFT JOIN hubs ON hubs.id = messages.hub_id
        WHERE messages.id = ?
      `).get(targetId);
      if (!m) return { exists: false };

      let payload = null;
      if (m.payload) {
        try { payload = JSON.parse(m.payload); } catch (_) { payload = null; }
      }
      // Ses/görsel/video/dosya payload'ı ham base64 veri içerir — moderasyon panelinde
      // önizleme için gerekli, bu yüzden diğer rapor context'lerinden farklı olarak aynen iletiliyor.

      return {
        exists: true,
        message_id: m.id,
        sender_id: m.user_id,
        sender_username: m.username,
        content: m.content,
        kind: m.kind || 'text',
        payload,
        created_at: m.created_at,
        context: m.hub_id ? { type: 'hub', hub_id: m.hub_id, hub_name: m.hub_name } : { type: 'dm', to_user_id: m.to_user_id }
      };
    }

    if (targetType === 'voice_room') {
      const r = db.prepare(`
        SELECT hub_voice_rooms.id, hub_voice_rooms.name, hub_voice_rooms.hub_id, hubs.name AS hub_name
        FROM hub_voice_rooms LEFT JOIN hubs ON hubs.id = hub_voice_rooms.hub_id
        WHERE hub_voice_rooms.id = ?
      `).get(targetId);
      return r ? { exists: true, room_id: r.id, room_name: r.name, hub_id: r.hub_id, hub_name: r.hub_name } : { exists: false };
    }
  } catch (error) {
    console.error('Rapor hedefi bağlamı alınamadı:', error);
  }
  return { exists: false };
}

function getReportDetail(reportId) {
  const report = db.prepare(`
    SELECT reports.*, users.username AS reporter_username
    FROM reports INNER JOIN users ON users.id = reports.reporter_user_id
    WHERE reports.id = ?
  `).get(reportId);

  if (!report) return null;

  return {
    ...report,
    target_context: getReportTargetContext(report.target_type, report.target_id),
    history: listModerationHistory(reportId)
  };
}

// =====================================================
// v1.10 MIGRATION — BİLDİRİMLER / ŞİFRE SIFIRLAMA
// =====================================================

db.exec(`
  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    data TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS password_resets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    code TEXT NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`);

// =====================================================
// E-POSTA DOĞRULAMA TABLOSU
// =====================================================

db.exec(`
  CREATE TABLE IF NOT EXISTS pending_verifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL,
    email TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    password_salt TEXT NOT NULL,
    code TEXT NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// =====================================================
// ŞİFRE HASHLEME
// =====================================================

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { hash, salt };
}

function verifyPassword(password, storedHash, storedSalt) {
  try {
    const hash = crypto.scryptSync(password, storedSalt, 64).toString('hex');
    const hashBuffer = Buffer.from(hash, 'hex');
    const storedBuffer = Buffer.from(storedHash, 'hex');
    if (hashBuffer.length !== storedBuffer.length) return false;
    return crypto.timingSafeEqual(hashBuffer, storedBuffer);
  } catch {
    return false;
  }
}

// =====================================================
// DOĞRULAMA KODU OLUŞTUR
// =====================================================

function createVerification(username, email, password, birthDate, termsAccepted) {
  try {
    username = String(username || '').trim();
    email = String(email || '').trim().toLowerCase();
    password = String(password || '');
    birthDate = String(birthDate || '').trim();

    if (!username || !email || !password || !birthDate) {
      return { success: false, error: 'Tüm alanları doldurmalısınız.' };
    }

    if (!termsAccepted) {
      return { success: false, error: 'Kullanım Şartları ve Gizlilik Politikası\'nı kabul etmelisin.' };
    }

    const age = calculateAge(birthDate);

    if (age === null || age < 0 || age > 120) {
      return { success: false, error: 'Geçerli bir doğum tarihi girin.' };
    }

    if (age < MIN_SIGNUP_AGE) {
      return { success: false, error: `Sauran'a kayıt olmak için en az ${MIN_SIGNUP_AGE} yaşında olmalısın.` };
    }

    if (username.length < 3 || username.length > 20) {
      return { success: false, error: 'Kullanıcı adı 3-20 karakter olmalıdır.' };
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { success: false, error: 'Geçerli bir e-posta adresi girin.' };
    }

    if (password.length < 6) {
      return { success: false, error: 'Şifre en az 6 karakter olmalıdır.' };
    }

    const existingUsername = db
      .prepare(`SELECT id FROM users WHERE LOWER(username) = LOWER(?)`)
      .get(username);

    if (existingUsername) {
      return { success: false, error: 'Bu kullanıcı adı zaten alınmış.' };
    }

    const existingEmail = db
      .prepare(`SELECT id FROM users WHERE LOWER(email) = LOWER(?)`)
      .get(email);

    if (existingEmail) {
      return { success: false, error: 'Bu e-posta adresi zaten kullanılıyor.' };
    }

    // Eski doğrulama kaydını temizle
    db.prepare(`DELETE FROM pending_verifications WHERE LOWER(email) = LOWER(?)`).run(email);

    const { hash, salt } = hashPassword(password);
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    db.prepare(`
      INSERT INTO pending_verifications (username, email, password_hash, password_salt, code, expires_at, birth_date, terms_accepted)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(username, email, hash, salt, code, expiresAt, birthDate, termsAccepted ? 1 : 0);

    return { success: true, code };

  } catch (error) {
    console.error('Doğrulama oluşturma hatası:', error);
    return { success: false, error: 'Bir hata oluştu.' };
  }
}

// =====================================================
// DOĞRULAMA KODUNU KONTROL ET VE HESAP OLUŞTUr
// =====================================================

function verifyAndCreateUser(email, code) {
  try {
    email = String(email || '').trim().toLowerCase();
    code = String(code || '').trim();

    const pending = db.prepare(`
      SELECT * FROM pending_verifications
      WHERE LOWER(email) = LOWER(?) AND code = ?
    `).get(email, code);

    if (!pending) {
      return { success: false, error: 'Geçersiz kod.' };
    }

    if (new Date(pending.expires_at).getTime() <= Date.now()) {
      db.prepare(`DELETE FROM pending_verifications WHERE id = ?`).run(pending.id);
      return { success: false, error: 'Kodun süresi dolmuş. Tekrar kayıt ol.' };
    }

    const age = calculateAge(pending.birth_date);
    const minor = isMinorAge(age);

    const result = db.prepare(`
      INSERT INTO users (username, email, password_hash, password_salt, birth_date, avatar_visibility, terms_accepted_at)
      VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).run(pending.username, pending.email, pending.password_hash, pending.password_salt, pending.birth_date, minor ? 'friends' : 'public');

    db.prepare(`DELETE FROM pending_verifications WHERE id = ?`).run(pending.id);

    return {
      success: true,
      id: result.lastInsertRowid,
      username: pending.username,
      email: pending.email,
      about_me: null,
      status: 'signal',
      avatar_visibility: minor ? 'friends' : 'public',
      avatar_data: null,
      is_minor: minor
    };

  } catch (error) {
    console.error('Doğrulama hatası:', error);
    return { success: false, error: 'Bir hata oluştu.' };
  }
}

// =====================================================
// GİRİŞ
// =====================================================

function findUserByUsername(username) {
  return db.prepare(`SELECT id, username FROM users WHERE LOWER(username) = LOWER(?)`).get(String(username || '').trim());
}

function loginUser(username, password) {
  try {
    username = String(username || '').trim();
    password = String(password || '');

    const user = db.prepare(`
      SELECT id, username, email, password_hash, password_salt,
             about_me, status, avatar_visibility, avatar_data, banner_data
      FROM users WHERE LOWER(username) = LOWER(?)
    `).get(username);

    if (!user) {
      return { success: false, error: 'Kullanıcı adı veya şifre hatalı.' };
    }

    if (!user.password_hash || !user.password_salt) {
      return { success: false, error: 'Bu hesap yeni sisteme geçirilmemiş.' };
    }

    const valid = verifyPassword(password, user.password_hash, user.password_salt);

    if (!valid) {
      return { success: false, error: 'Kullanıcı adı veya şifre hatalı.' };
    }

    return {
      success: true,
      id: user.id,
      username: user.username,
      email: user.email,
      about_me: user.about_me,
      status: user.status || 'signal',
      avatar_visibility: user.avatar_visibility || 'public',
      avatar_data: user.avatar_data,
      banner_data: user.banner_data
    };

  } catch (error) {
    console.error('Giriş hatası:', error);
    return { success: false, error: 'Giriş sırasında bir hata oluştu.' };
  }
}

// =====================================================
// PROFİL GÜNCELLEME
// =====================================================

function updateAboutMe(userId, aboutMe) {
  try {
    const text = String(aboutMe || '').trim().slice(0, 300);

    db.prepare(`UPDATE users SET about_me = ? WHERE id = ?`).run(text, userId);

    return { success: true, about_me: text };

  } catch (error) {
    console.error('Hakkında güncelleme hatası:', error);
    return { success: false, error: 'Güncellenemedi.' };
  }
}

function updateStatus(userId, status) {
  try {
    if (!VALID_STATUSES.includes(status)) {
      return { success: false, error: 'Geçersiz durum.' };
    }

    db.prepare(`UPDATE users SET status = ? WHERE id = ?`).run(status, userId);

    return { success: true, status };

  } catch (error) {
    console.error('Durum güncelleme hatası:', error);
    return { success: false, error: 'Güncellenemedi.' };
  }
}

function updatePrivacy(userId, visibility) {
  try {
    if (!VALID_VISIBILITIES.includes(visibility)) {
      return { success: false, error: 'Geçersiz gizlilik seçeneği.' };
    }

    db.prepare(`UPDATE users SET avatar_visibility = ? WHERE id = ?`).run(visibility, userId);

    return { success: true, avatar_visibility: visibility };

  } catch (error) {
    console.error('Gizlilik güncelleme hatası:', error);
    return { success: false, error: 'Güncellenemedi.' };
  }
}

function updateAvatar(userId, dataUrl) {
  try {
    if (dataUrl !== null) {
      if (typeof dataUrl !== 'string' || !/^data:image\/(png|jpe?g|webp|gif);base64,/.test(dataUrl)) {
        return { success: false, error: 'Geçersiz görsel formatı.' };
      }

      if (dataUrl.length > 2_000_000) {
        return { success: false, error: 'Görsel çok büyük.' };
      }
    }

    db.prepare(`UPDATE users SET avatar_data = ? WHERE id = ?`).run(dataUrl, userId);

    return { success: true, avatar_data: dataUrl };

  } catch (error) {
    console.error('Avatar güncelleme hatası:', error);
    return { success: false, error: 'Güncellenemedi.' };
  }
}

function updateBanner(userId, dataUrl) {
  try {
    if (dataUrl !== null) {
      if (typeof dataUrl !== 'string' || !/^data:image\/(png|jpe?g|webp|gif);base64,/.test(dataUrl)) {
        return { success: false, error: 'Geçersiz görsel formatı.' };
      }

      if (dataUrl.length > 3_000_000) {
        return { success: false, error: 'Görsel çok büyük.' };
      }
    }

    db.prepare(`UPDATE users SET banner_data = ? WHERE id = ?`).run(dataUrl, userId);

    return { success: true, banner_data: dataUrl };

  } catch (error) {
    console.error('Banner güncelleme hatası:', error);
    return { success: false, error: 'Güncellenemedi.' };
  }
}

// =====================================================
// MESAJ SİSTEMİ
// =====================================================

function saveMessage(username, content, room = 'general') {
  const info = db.prepare(`
    INSERT INTO messages (username, content, room) VALUES (?, ?, ?)
  `).run(username, content, room);
  return info.lastInsertRowid;
}

function getMessages(limit = 50, room = 'general') {
  const rows = db.prepare(`
    SELECT id, username, content, room, created_at
    FROM messages WHERE room = ?
    ORDER BY id DESC LIMIT ?
  `).all(room, limit);
  return rows.reverse();
}

// =====================================================
// HUB SİSTEMİ
// =====================================================

function createHub(userId, { name, image_data }) {
  try {
    name = String(name || '').trim();

    if (!name || name.length < 3 || name.length > 40) {
      return { success: false, error: 'Hub adı 3-40 karakter olmalıdır.' };
    }

    if (image_data && !/^data:image\/(png|jpe?g|webp|gif);base64,/.test(image_data)) {
      return { success: false, error: 'Geçersiz görsel formatı.' };
    }

    const insertHub = db.prepare(`
      INSERT INTO hubs (name, type, icon, image_data, created_by)
      VALUES (?, 'custom', '🧩', ?, ?)
    `);

    const hubResult = insertHub.run(name, image_data || null, userId);
    const hubId = hubResult.lastInsertRowid;

    db.prepare(`INSERT INTO hub_members (hub_id, user_id, permission_tier) VALUES (?, ?, 'owner')`).run(hubId, userId);

    return { success: true, id: hubId };

  } catch (error) {
    console.error('Hub oluşturma hatası:', error);
    return { success: false, error: 'Hub oluşturulamadı.' };
  }
}

function updateHub(hubId, userId, { name, image_data }) {
  const hub = db.prepare(`SELECT created_by FROM hubs WHERE id = ?`).get(hubId);
  if (!hub) return { success: false, error: 'Hub bulunamadı.' };
  if (hub.created_by !== userId) return { success: false, error: 'Sadece Hub sahibi düzenleyebilir.' };

  if (name !== undefined) {
    name = String(name || '').trim();
    if (!name || name.length < 3 || name.length > 40) {
      return { success: false, error: 'Hub adı 3-40 karakter olmalıdır.' };
    }
    db.prepare(`UPDATE hubs SET name = ? WHERE id = ?`).run(name, hubId);
  }

  if (image_data !== undefined) {
    if (image_data && !/^data:image\/(png|jpe?g|webp|gif);base64,/.test(image_data)) {
      return { success: false, error: 'Geçersiz görsel formatı.' };
    }
    db.prepare(`UPDATE hubs SET image_data = ? WHERE id = ?`).run(image_data || null, hubId);
  }

  return { success: true };
}

function listHubs(userId) {
  return db.prepare(`
    SELECT
      hubs.id, hubs.name, hubs.type, hubs.icon, hubs.image_data, hubs.created_at, hubs.created_by,
      (SELECT COUNT(*) FROM hub_members WHERE hub_members.hub_id = hubs.id) AS member_count
    FROM hubs
    INNER JOIN hub_members ON hub_members.hub_id = hubs.id AND hub_members.user_id = ?
    ORDER BY hubs.created_at DESC
  `).all(userId).map(h => ({ ...h, is_owner: h.created_by === userId }));
}

function generateInviteCode() {
  return crypto.randomBytes(5).toString('hex');
}

function createHubInvite(hubId, userId) {
  if (!isHubMember(hubId, userId)) {
    return { success: false, error: 'Bu Hub\'a üye değilsin.' };
  }

  const code = generateInviteCode();

  db.prepare(`
    INSERT INTO hub_invites (hub_id, code, created_by)
    VALUES (?, ?, ?)
  `).run(hubId, code, userId);

  return { success: true, code };
}

function joinHubByCode(code, userId) {
  const invite = db.prepare(`SELECT * FROM hub_invites WHERE code = ?`).get(String(code || '').trim());

  if (!invite) return { success: false, error: 'Geçersiz davet kodu.' };
  if (invite.max_uses && invite.uses >= invite.max_uses) {
    return { success: false, error: 'Bu davet kodu kullanım limitine ulaşmış.' };
  }

  if (isHubMember(invite.hub_id, userId)) {
    return { success: false, error: 'Bu Hub\'a zaten üyesin.' };
  }

  if (db.prepare(`SELECT 1 FROM hub_bans WHERE hub_id = ? AND user_id = ?`).get(invite.hub_id, userId)) {
    return { success: false, error: 'Bu Hub\'dan banlandın.' };
  }

  db.prepare(`INSERT INTO hub_members (hub_id, user_id) VALUES (?, ?)`).run(invite.hub_id, userId);
  db.prepare(`UPDATE hub_invites SET uses = uses + 1 WHERE id = ?`).run(invite.id);

  return { success: true, hub_id: invite.hub_id };
}

function getHubDetail(hubId, userId) {
  const hub = db.prepare(`SELECT * FROM hubs WHERE id = ?`).get(hubId);
  if (!hub) return null;

  const roles = db.prepare(`
    SELECT id, name, icon, slot_limit, position
    FROM hub_roles WHERE hub_id = ? ORDER BY position ASC
  `).all(hubId);

  const members = db.prepare(`
    SELECT hub_members.user_id, hub_members.role_id, hub_members.permission_tier, users.username, users.status, users.avatar_data
    FROM hub_members
    INNER JOIN users ON users.id = hub_members.user_id
    WHERE hub_members.hub_id = ?
  `).all(hubId);

  const membership = userId
    ? db.prepare(`SELECT role_id, permission_tier FROM hub_members WHERE hub_id = ? AND user_id = ?`).get(hubId, userId)
    : null;

  return {
    ...hub,
    roles,
    members,
    is_member: Boolean(membership),
    is_owner: hub.created_by === userId,
    my_role_id: membership ? membership.role_id : null,
    my_permission_tier: membership ? membership.permission_tier : null
  };
}

function setHubRole(hubId, userId, roleId) {
  try {
    if (!isHubMember(hubId, userId)) {
      return { success: false, error: 'Bu Hub\'a üye değilsin. Önce bir davet koduyla katılmalısın.' };
    }

    if (roleId) {
      const role = db.prepare(`SELECT id, slot_limit FROM hub_roles WHERE id = ? AND hub_id = ?`).get(roleId, hubId);
      if (!role) return { success: false, error: 'Geçersiz rol.' };

      if (role.slot_limit) {
        const taken = db.prepare(`SELECT COUNT(*) AS c FROM hub_members WHERE role_id = ?`).get(roleId).c;
        const already = db.prepare(`SELECT role_id FROM hub_members WHERE hub_id = ? AND user_id = ?`).get(hubId, userId);

        if (taken >= role.slot_limit && (!already || already.role_id !== roleId)) {
          return { success: false, error: 'Bu rolde boş slot kalmadı.' };
        }
      }
    }

    db.prepare(`
      INSERT INTO hub_members (hub_id, user_id, role_id)
      VALUES (?, ?, ?)
      ON CONFLICT(hub_id, user_id) DO UPDATE SET role_id = excluded.role_id
    `).run(hubId, userId, roleId || null);

    return { success: true };

  } catch (error) {
    console.error('Hub katılım hatası:', error);
    return { success: false, error: 'Katılınamadı.' };
  }
}

function leaveHub(hubId, userId) {
  db.prepare(`DELETE FROM hub_members WHERE hub_id = ? AND user_id = ?`).run(hubId, userId);
  return { success: true };
}

function addHubRole(hubId, userId, { name, icon, slot_limit }) {
  const hub = db.prepare(`SELECT created_by FROM hubs WHERE id = ?`).get(hubId);
  if (!hub) return { success: false, error: 'Hub bulunamadı.' };
  if (hub.created_by !== userId) return { success: false, error: 'Yalnızca Hub sahibi rol ekleyebilir.' };

  const roleName = String(name || '').trim().slice(0, 24);
  if (!roleName) return { success: false, error: 'Rol adı gerekli.' };

  const roleIcon = String(icon || '⚪').trim().slice(0, 4) || '⚪';
  const slotLimit = Number.isInteger(slot_limit) && slot_limit > 0 ? slot_limit : null;

  const position = db.prepare(`SELECT COUNT(*) AS c FROM hub_roles WHERE hub_id = ?`).get(hubId).c;

  const info = db.prepare(`
    INSERT INTO hub_roles (hub_id, name, icon, slot_limit, position)
    VALUES (?, ?, ?, ?, ?)
  `).run(hubId, roleName, roleIcon, slotLimit, position);

  return { success: true, id: info.lastInsertRowid };
}

function isHubMember(hubId, userId) {
  return Boolean(db.prepare(`SELECT 1 FROM hub_members WHERE hub_id = ? AND user_id = ?`).get(hubId, userId));
}

// =====================================================
// HUB YETKİ KATMANLARI (owner / moderator / member)
// =====================================================

function getMemberTier(hubId, userId) {
  const row = db.prepare(`SELECT permission_tier FROM hub_members WHERE hub_id = ? AND user_id = ?`).get(hubId, userId);
  return row ? row.permission_tier : null;
}

function hasAtLeastTier(hubId, userId, minTier) {
  const tier = getMemberTier(hubId, userId);
  if (!tier) return false;
  return PERMISSION_RANK[tier] >= PERMISSION_RANK[minTier];
}

function setModerator(hubId, actorId, targetId, isModerator) {
  if (!hasAtLeastTier(hubId, actorId, 'owner')) {
    return { success: false, error: 'Yalnızca Hub sahibi moderatör atayabilir.' };
  }

  const targetTier = getMemberTier(hubId, targetId);
  if (!targetTier) return { success: false, error: 'Kullanıcı bu Hub\'ın üyesi değil.' };
  if (targetTier === 'owner') return { success: false, error: 'Hub sahibinin yetkisi değiştirilemez.' };

  db.prepare(`UPDATE hub_members SET permission_tier = ? WHERE hub_id = ? AND user_id = ?`)
    .run(isModerator ? 'moderator' : 'member', hubId, targetId);

  return { success: true };
}

function kickMember(hubId, actorId, targetId) {
  if (actorId === targetId) return { success: false, error: 'Kendini atamazsın.' };
  if (!hasAtLeastTier(hubId, actorId, 'moderator')) {
    return { success: false, error: 'Bu işlem için yetkin yok.' };
  }

  const actorTier = getMemberTier(hubId, actorId);
  const targetTier = getMemberTier(hubId, targetId);
  if (!targetTier) return { success: false, error: 'Kullanıcı bu Hub\'ın üyesi değil.' };
  if (targetTier === 'owner') return { success: false, error: 'Hub sahibi atılamaz.' };
  if (targetTier === 'moderator' && actorTier !== 'owner') {
    return { success: false, error: 'Yalnızca Hub sahibi bir moderatörü atabilir.' };
  }

  db.prepare(`DELETE FROM hub_members WHERE hub_id = ? AND user_id = ?`).run(hubId, targetId);

  return { success: true };
}

function banMember(hubId, actorId, targetId) {
  const result = kickMember(hubId, actorId, targetId);
  if (!result.success) return result;

  db.prepare(`
    INSERT INTO hub_bans (hub_id, user_id, banned_by) VALUES (?, ?, ?)
    ON CONFLICT(hub_id, user_id) DO UPDATE SET banned_by = excluded.banned_by, created_at = CURRENT_TIMESTAMP
  `).run(hubId, targetId, actorId);

  return { success: true };
}

function unbanMember(hubId, actorId, targetId) {
  if (!hasAtLeastTier(hubId, actorId, 'moderator')) {
    return { success: false, error: 'Bu işlem için yetkin yok.' };
  }

  db.prepare(`DELETE FROM hub_bans WHERE hub_id = ? AND user_id = ?`).run(hubId, targetId);

  return { success: true };
}

function isHubBanned(hubId, userId) {
  return Boolean(db.prepare(`SELECT 1 FROM hub_bans WHERE hub_id = ? AND user_id = ?`).get(hubId, userId));
}

function listHubBans(hubId) {
  return db.prepare(`
    SELECT users.id, users.username, users.avatar_data, hub_bans.created_at
    FROM hub_bans
    INNER JOIN users ON users.id = hub_bans.user_id
    WHERE hub_bans.hub_id = ?
    ORDER BY hub_bans.created_at DESC
  `).all(hubId);
}

function getHubMessages(hubId, limit = 50) {
  const rows = db.prepare(`
    SELECT messages.id, messages.user_id, messages.username, messages.content, messages.kind,
           messages.payload, messages.edited, messages.created_at, users.avatar_data
    FROM messages LEFT JOIN users ON users.id = messages.user_id
    WHERE hub_id = ?
    ORDER BY messages.id DESC LIMIT ?
  `).all(hubId, limit);

  return rows.reverse().map(hydrateMessage);
}

function getMessageById(id) {
  return hydrateMessage(db.prepare(`
    SELECT messages.id, messages.user_id, messages.username, messages.content, messages.to_user_id,
           messages.kind, messages.payload, messages.edited, messages.created_at, users.avatar_data
    FROM messages LEFT JOIN users ON users.id = messages.user_id
    WHERE messages.id = ?
  `).get(id));
}

function hydrateMessage(row) {
  if (row.kind === 'poll' && row.payload) {
    const payload = JSON.parse(row.payload);
    const votes = db.prepare(`
      SELECT option_index, COUNT(*) AS c FROM hub_poll_votes WHERE message_id = ? GROUP BY option_index
    `).all(row.id);

    const counts = payload.options.map((_, i) => {
      const found = votes.find(v => v.option_index === i);
      return found ? found.c : 0;
    });

    return { ...row, payload: { ...payload, counts } };
  }

  if (row.payload) {
    return { ...row, payload: JSON.parse(row.payload) };
  }

  return row;
}

function deleteMessage(messageId, userId) {
  const msg = db.prepare(`SELECT user_id, hub_id, to_user_id, kind FROM messages WHERE id = ?`).get(messageId);
  if (!msg) return { success: false, error: 'Mesaj bulunamadı.' };
  if (msg.user_id !== userId) return { success: false, error: 'Yalnızca kendi mesajını silebilirsin.' };
  if (msg.kind === 'deleted') return { success: false, error: 'Mesaj zaten silinmiş.' };

  db.prepare(`UPDATE messages SET kind = 'deleted', content = '', payload = NULL WHERE id = ?`).run(messageId);

  return { success: true, id: messageId, hub_id: msg.hub_id, to_user_id: msg.to_user_id };
}

function editMessage(messageId, userId, newContent) {
  const msg = db.prepare(`SELECT user_id, hub_id, to_user_id, kind FROM messages WHERE id = ?`).get(messageId);
  if (!msg) return { success: false, error: 'Mesaj bulunamadı.' };
  if (msg.user_id !== userId) return { success: false, error: 'Yalnızca kendi mesajını düzenleyebilirsin.' };
  if (!['text', 'dm'].includes(msg.kind)) return { success: false, error: 'Bu mesaj türü düzenlenemez.' };

  newContent = String(newContent || '').trim().slice(0, 500);
  if (!newContent) return { success: false, error: 'Boş mesaj gönderilemez.' };

  db.prepare(`UPDATE messages SET content = ?, edited = 1 WHERE id = ?`).run(newContent, messageId);

  return {
    success: true,
    hub_id: msg.hub_id,
    to_user_id: msg.to_user_id,
    message: getMessageById(messageId)
  };
}

function saveHubMessage(hubId, userId, username, content) {
  const info = db.prepare(`
    INSERT INTO messages (user_id, username, content, room, hub_id, kind)
    VALUES (?, ?, ?, ?, ?, 'text')
  `).run(userId, username, content, `hub_${hubId}`, hubId);

  return getMessageById(info.lastInsertRowid);
}

function createHubPoll(hubId, userId, username, question, options) {
  question = String(question || '').trim().slice(0, 200);
  const cleanOptions = (Array.isArray(options) ? options : [])
    .map(o => String(o || '').trim().slice(0, 60))
    .filter(Boolean)
    .slice(0, 6);

  if (!question || cleanOptions.length < 2) {
    return { success: false, error: 'Bir soru ve en az 2 seçenek girmelisin.' };
  }

  const payload = JSON.stringify({ question, options: cleanOptions });

  const info = db.prepare(`
    INSERT INTO messages (user_id, username, content, room, hub_id, kind, payload)
    VALUES (?, ?, ?, ?, ?, 'poll', ?)
  `).run(userId, username, question, `hub_${hubId}`, hubId, payload);

  return { success: true, message: getMessageById(info.lastInsertRowid) };
}

function voteHubPoll(messageId, userId, optionIndex) {
  const message = db.prepare(`SELECT id, kind, payload FROM messages WHERE id = ?`).get(messageId);
  if (!message || message.kind !== 'poll') return { success: false, error: 'Anket bulunamadı.' };

  const payload = JSON.parse(message.payload);
  if (!Number.isInteger(optionIndex) || optionIndex < 0 || optionIndex >= payload.options.length) {
    return { success: false, error: 'Geçersiz seçenek.' };
  }

  db.prepare(`
    INSERT INTO hub_poll_votes (message_id, user_id, option_index)
    VALUES (?, ?, ?)
    ON CONFLICT(message_id, user_id) DO UPDATE SET option_index = excluded.option_index
  `).run(messageId, userId, optionIndex);

  return { success: true, message: getMessageById(messageId) };
}

function createHubShare(hubId, userId, username, content, url) {
  content = String(content || '').trim().slice(0, 300);
  url = String(url || '').trim().slice(0, 500);

  if (!content && !url) {
    return { success: false, error: 'Bir metin veya bağlantı paylaşmalısın.' };
  }

  const payload = JSON.stringify({ url: url || null });

  const info = db.prepare(`
    INSERT INTO messages (user_id, username, content, room, hub_id, kind, payload)
    VALUES (?, ?, ?, ?, ?, 'share', ?)
  `).run(userId, username, content, `hub_${hubId}`, hubId, payload);

  return { success: true, message: getMessageById(info.lastInsertRowid) };
}

function createHubVoiceMessage(hubId, userId, username, audioData, duration) {
  if (typeof audioData !== 'string' || !/^data:audio\/(webm|ogg|mp4|mpeg|wav);base64,/.test(audioData)) {
    return { success: false, error: 'Geçersiz ses formatı.' };
  }

  if (audioData.length > 6_000_000) {
    return { success: false, error: 'Sesli mesaj çok uzun.' };
  }

  const payload = JSON.stringify({ audio: audioData, duration: Number(duration) || 0 });

  const info = db.prepare(`
    INSERT INTO messages (user_id, username, content, room, hub_id, kind, payload)
    VALUES (?, ?, '', ?, ?, 'voice', ?)
  `).run(userId, username, `hub_${hubId}`, hubId, payload);

  return { success: true, message: getMessageById(info.lastInsertRowid) };
}

const FILE_MAX_BYTES = 10 * 1024 * 1024;

function validateFilePayload(fileData, mime, size) {
  if (typeof fileData !== 'string' || !fileData.startsWith('data:')) {
    return { success: false, error: 'Geçersiz dosya formatı.' };
  }

  const declaredSize = Number(size) || 0;
  if (declaredSize > FILE_MAX_BYTES) {
    const isVideo = String(mime || '').startsWith('video/');
    return { success: false, error: isVideo ? 'Video limiti 10 MB\'dir.' : 'Dosya limiti 10 MB\'dir.' };
  }

  // base64 payload gerçek boyutu ~4/3 katı büyür; ekstra pay bırakarak sunucu tarafında da doğrula.
  if (fileData.length > FILE_MAX_BYTES * 1.4) {
    const isVideo = String(mime || '').startsWith('video/');
    return { success: false, error: isVideo ? 'Video limiti 10 MB\'dir.' : 'Dosya limiti 10 MB\'dir.' };
  }

  return { success: true };
}

function createHubFileMessage(hubId, userId, username, file) {
  const { data, name, mime, size } = file || {};

  const check = validateFilePayload(data, mime, size);
  if (!check.success) return check;

  const kind = String(mime || '').startsWith('image/') ? 'image'
    : String(mime || '').startsWith('video/') ? 'video'
    : 'file';

  const payload = JSON.stringify({
    data,
    name: String(name || 'dosya').slice(0, 200),
    mime: String(mime || 'application/octet-stream').slice(0, 100),
    size: Number(size) || 0
  });

  const info = db.prepare(`
    INSERT INTO messages (user_id, username, content, room, hub_id, kind, payload)
    VALUES (?, ?, '', ?, ?, ?, ?)
  `).run(userId, username, `hub_${hubId}`, hubId, kind, payload);

  return { success: true, message: getMessageById(info.lastInsertRowid) };
}

function getHubDailyRoomName(hubId) {
  const hub = db.prepare(`SELECT daily_room_name FROM hubs WHERE id = ?`).get(hubId);
  return hub ? hub.daily_room_name : null;
}

function setHubDailyRoomName(hubId, roomName) {
  db.prepare(`UPDATE hubs SET daily_room_name = ? WHERE id = ?`).run(roomName, hubId);
}

// =====================================================
// SESLİ ODALAR (Hub içinde birden fazla oda)
// =====================================================

function listVoiceRooms(hubId) {
  return db.prepare(`SELECT id, hub_id, name, created_by, created_at FROM hub_voice_rooms WHERE hub_id = ? ORDER BY id ASC`).all(hubId);
}

function createVoiceRoom(hubId, userId, name) {
  const hub = db.prepare(`SELECT created_by FROM hubs WHERE id = ?`).get(hubId);
  if (!hub) return { success: false, error: 'Hub bulunamadı.' };
  if (hub.created_by !== userId) return { success: false, error: 'Yalnızca Hub sahibi sesli oda açabilir.' };

  name = String(name || '').trim().slice(0, 40);
  if (!name) return { success: false, error: 'Oda adı gerekli.' };

  const info = db.prepare(`INSERT INTO hub_voice_rooms (hub_id, name, created_by) VALUES (?, ?, ?)`).run(hubId, name, userId);

  return { success: true, room: db.prepare(`SELECT id, hub_id, name, created_by, created_at FROM hub_voice_rooms WHERE id = ?`).get(info.lastInsertRowid) };
}

function deleteVoiceRoom(hubId, userId, roomId) {
  const hub = db.prepare(`SELECT created_by FROM hubs WHERE id = ?`).get(hubId);
  if (!hub) return { success: false, error: 'Hub bulunamadı.' };
  if (hub.created_by !== userId) return { success: false, error: 'Yalnızca Hub sahibi sesli odayı silebilir.' };

  const info = db.prepare(`DELETE FROM hub_voice_rooms WHERE id = ? AND hub_id = ?`).run(roomId, hubId);
  if (!info.changes) return { success: false, error: 'Oda bulunamadı.' };

  return { success: true };
}

function getVoiceRoomDailyName(roomId) {
  const room = db.prepare(`SELECT daily_room_name FROM hub_voice_rooms WHERE id = ?`).get(roomId);
  return room ? room.daily_room_name : null;
}

function setVoiceRoomDailyName(roomId, dailyRoomName) {
  db.prepare(`UPDATE hub_voice_rooms SET daily_room_name = ? WHERE id = ?`).run(dailyRoomName, roomId);
}

function getVoiceRoom(roomId) {
  return db.prepare(`SELECT id, hub_id, name, created_by FROM hub_voice_rooms WHERE id = ?`).get(roomId);
}

function deleteHub(hubId, userId) {
  const hub = db.prepare(`SELECT created_by FROM hubs WHERE id = ?`).get(hubId);
  if (!hub) return { success: false, error: 'Hub bulunamadı.' };
  if (hub.created_by !== userId) return { success: false, error: 'Yalnızca Hub sahibi silebilir.' };

  const messageIds = db.prepare(`SELECT id FROM messages WHERE hub_id = ?`).all(hubId).map(r => r.id);

  const deleteVotes = db.prepare(`DELETE FROM hub_poll_votes WHERE message_id = ?`);
  messageIds.forEach(id => deleteVotes.run(id));

  db.prepare(`DELETE FROM messages WHERE hub_id = ?`).run(hubId);
  db.prepare(`DELETE FROM hub_members WHERE hub_id = ?`).run(hubId);
  db.prepare(`DELETE FROM hub_roles WHERE hub_id = ?`).run(hubId);
  db.prepare(`DELETE FROM hubs WHERE id = ?`).run(hubId);

  return { success: true };
}

// =====================================================
// ARKADAŞLIK SİSTEMİ
// =====================================================

function pairKey(a, b) {
  return a < b ? [a, b] : [b, a];
}

function sendFriendRequest(fromId, toId) {
  if (fromId === toId) return { success: false, error: 'Kendine arkadaşlık isteği gönderemezsin.' };

  const targetUser = db.prepare(`SELECT id FROM users WHERE id = ?`).get(toId);
  if (!targetUser) return { success: false, error: 'Kullanıcı bulunamadı.' };

  if (isBlocked(fromId, toId) || isBlocked(toId, fromId)) {
    return { success: false, error: 'Bu kullanıcıya istek gönderilemiyor.' };
  }

  const [low, high] = pairKey(fromId, toId);

  const existing = db.prepare(`SELECT * FROM friendships WHERE user_low = ? AND user_high = ?`).get(low, high);

  if (existing) {
    if (existing.status === 'accepted') return { success: false, error: 'Zaten arkadaşsınız.' };
    if (existing.status === 'pending') return { success: false, error: 'Zaten bekleyen bir istek var.' };
  }

  db.prepare(`
    INSERT INTO friendships (user_low, user_high, status, requested_by)
    VALUES (?, ?, 'pending', ?)
    ON CONFLICT(user_low, user_high) DO UPDATE SET status = 'pending', requested_by = excluded.requested_by, created_at = CURRENT_TIMESTAMP, responded_at = NULL
  `).run(low, high, fromId);

  const fromUser = db.prepare(`SELECT username FROM users WHERE id = ?`).get(fromId);
  createNotification(toId, 'friend_request', { from_user_id: fromId, from_username: fromUser?.username || '' });

  return { success: true };
}

function respondFriendRequest(userId, otherUserId, accept) {
  const [low, high] = pairKey(userId, otherUserId);

  const existing = db.prepare(`SELECT * FROM friendships WHERE user_low = ? AND user_high = ?`).get(low, high);
  if (!existing || existing.status !== 'pending') return { success: false, error: 'Bekleyen bir istek yok.' };
  if (existing.requested_by === userId) return { success: false, error: 'Kendi isteğini yanıtlayamazsın.' };

  if (accept) {
    db.prepare(`UPDATE friendships SET status = 'accepted', responded_at = CURRENT_TIMESTAMP WHERE id = ?`).run(existing.id);
  } else {
    db.prepare(`DELETE FROM friendships WHERE id = ?`).run(existing.id);
  }

  db.prepare(`
    UPDATE notifications SET status = ? WHERE user_id = ? AND type = 'friend_request' AND status = 'pending'
    AND json_extract(data, '$.from_user_id') = ?
  `).run(accept ? 'accepted' : 'declined', userId, otherUserId);

  if (accept) {
    const accepter = db.prepare(`SELECT username FROM users WHERE id = ?`).get(userId);
    createNotification(otherUserId, 'friend_request_accepted', { from_user_id: userId, from_username: accepter?.username || '' });
  }

  return { success: true };
}

function removeFriend(userId, otherUserId) {
  const [low, high] = pairKey(userId, otherUserId);
  db.prepare(`DELETE FROM friendships WHERE user_low = ? AND user_high = ?`).run(low, high);
  return { success: true };
}

function areFriends(a, b) {
  const [low, high] = pairKey(a, b);
  const row = db.prepare(`SELECT status FROM friendships WHERE user_low = ? AND user_high = ?`).get(low, high);
  return Boolean(row && row.status === 'accepted');
}

function getFriendshipStatus(a, b) {
  const [low, high] = pairKey(a, b);
  const row = db.prepare(`SELECT status, requested_by FROM friendships WHERE user_low = ? AND user_high = ?`).get(low, high);

  if (!row) return 'none';
  if (row.status === 'accepted') return 'friends';
  if (row.requested_by === a) return 'pending_sent';
  return 'pending_received';
}

function listFriends(userId) {
  return db.prepare(`
    SELECT users.id, users.username, users.status, users.avatar_data
    FROM friendships
    INNER JOIN users ON users.id = CASE WHEN friendships.user_low = ? THEN friendships.user_high ELSE friendships.user_low END
    WHERE friendships.status = 'accepted' AND (friendships.user_low = ? OR friendships.user_high = ?)
    ORDER BY users.username COLLATE NOCASE
  `).all(userId, userId, userId);
}

function listIncomingRequests(userId) {
  return db.prepare(`
    SELECT friendships.id, users.id AS user_id, users.username
    FROM friendships
    INNER JOIN users ON users.id = friendships.requested_by
    WHERE friendships.status = 'pending'
      AND friendships.requested_by != ?
      AND (friendships.user_low = ? OR friendships.user_high = ?)
  `).all(userId, userId, userId);
}

function getTopFriends(userId, limit = 5) {
  const friends = listFriends(userId);

  const withCounts = friends.map((friend) => {
    const room = dmRoom(userId, friend.id);
    const count = db.prepare(`SELECT COUNT(*) AS c FROM messages WHERE room = ? AND kind IN ('dm', 'dm_voice')`).get(room).c;
    return { ...friend, message_count: count };
  });

  return withCounts
    .sort((a, b) => b.message_count - a.message_count)
    .filter(f => f.message_count > 0)
    .slice(0, limit);
}

// =====================================================
// HUB DAVETİ (ARKADAŞA) / BİLDİRİMLER
// =====================================================

function sendHubInviteNotification(hubId, fromUserId, fromUsername, toUserId) {
  if (!areFriends(fromUserId, toUserId)) {
    return { success: false, error: 'Sadece arkadaşlarını davet edebilirsin.' };
  }

  if (!isHubMember(hubId, fromUserId)) {
    return { success: false, error: 'Bu Hub\'a üye değilsin.' };
  }

  if (isHubMember(hubId, toUserId)) {
    return { success: false, error: 'Bu kişi zaten Hub\'a üye.' };
  }

  const hub = db.prepare(`SELECT id, name, icon, image_data FROM hubs WHERE id = ?`).get(hubId);
  if (!hub) return { success: false, error: 'Hub bulunamadı.' };

  const existing = db.prepare(`
    SELECT id FROM notifications
    WHERE user_id = ? AND type = 'hub_invite' AND status = 'pending'
      AND json_extract(data, '$.hub_id') = ? AND json_extract(data, '$.from_user_id') = ?
  `).get(toUserId, hubId, fromUserId);

  if (existing) return { success: false, error: 'Zaten bekleyen bir davetin var.' };

  const notification = createNotification(toUserId, 'hub_invite', {
    hub_id: hub.id,
    hub_name: hub.name,
    hub_icon: hub.icon,
    from_user_id: fromUserId,
    from_username: fromUsername
  });

  return { success: true, id: notification.id };
}

function listNotifications(userId) {
  const rows = db.prepare(`
    SELECT id, type, data, status, created_at FROM notifications
    WHERE user_id = ? AND status = 'pending'
    ORDER BY created_at DESC
  `).all(userId);

  return rows.map(r => ({ ...r, data: JSON.parse(r.data) }));
}

function respondHubInviteNotification(notificationId, userId, accept) {
  const notif = db.prepare(`SELECT * FROM notifications WHERE id = ? AND user_id = ?`).get(notificationId, userId);
  if (!notif || notif.status !== 'pending') return { success: false, error: 'Bildirim bulunamadı.' };

  const data = JSON.parse(notif.data);

  if (accept) {
    if (!isHubMember(data.hub_id, userId)) {
      db.prepare(`INSERT INTO hub_members (hub_id, user_id) VALUES (?, ?)`).run(data.hub_id, userId);
    }
    db.prepare(`UPDATE notifications SET status = 'accepted' WHERE id = ?`).run(notificationId);
    return { success: true, hub_id: data.hub_id };
  }

  db.prepare(`UPDATE notifications SET status = 'declined' WHERE id = ?`).run(notificationId);
  return { success: true };
}

// Aksiyon gerektirmeyen (salt bilgilendirici, ör. "isteğin kabul edildi")
// bildirimleri listeden düşürmek için genel amaçlı okundu işaretleme.
function markNotificationRead(notificationId, userId) {
  const info = db.prepare(`
    UPDATE notifications SET status = 'read' WHERE id = ? AND user_id = ? AND status = 'pending'
  `).run(notificationId, userId);

  if (!info.changes) return { success: false, error: 'Bildirim bulunamadı.' };
  return { success: true };
}

// =====================================================
// ŞİFREMİ UNUTTUM
// =====================================================

function requestPasswordReset(email) {
  email = String(email || '').trim().toLowerCase();

  const user = db.prepare(`SELECT id FROM users WHERE LOWER(email) = LOWER(?)`).get(email);
  if (!user) return { success: false, error: 'Bu e-posta ile kayıtlı bir hesap yok.' };

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  db.prepare(`DELETE FROM password_resets WHERE user_id = ?`).run(user.id);
  db.prepare(`INSERT INTO password_resets (user_id, code, expires_at) VALUES (?, ?, ?)`).run(user.id, code, expiresAt);

  return { success: true, code, userId: user.id };
}

function confirmPasswordReset(email, code, newPassword) {
  email = String(email || '').trim().toLowerCase();
  code = String(code || '').trim();

  const user = db.prepare(`SELECT id FROM users WHERE LOWER(email) = LOWER(?)`).get(email);
  if (!user) return { success: false, error: 'Geçersiz istek.' };

  const reset = db.prepare(`SELECT * FROM password_resets WHERE user_id = ? AND code = ?`).get(user.id, code);
  if (!reset) return { success: false, error: 'Geçersiz kod.' };

  if (new Date(reset.expires_at).getTime() <= Date.now()) {
    db.prepare(`DELETE FROM password_resets WHERE id = ?`).run(reset.id);
    return { success: false, error: 'Kodun süresi dolmuş.' };
  }

  const newPasswordStr = String(newPassword || '');
  if (newPasswordStr.length < 6) {
    return { success: false, error: 'Yeni şifre en az 6 karakter olmalıdır.' };
  }

  const { hash, salt } = hashPassword(newPasswordStr);
  db.prepare(`UPDATE users SET password_hash = ?, password_salt = ? WHERE id = ?`).run(hash, salt, user.id);
  db.prepare(`DELETE FROM password_resets WHERE user_id = ?`).run(user.id);

  // Şifre unutulup sıfırlandığında (başka biri erişmiş olabilir ihtimaline karşı)
  // tüm cihazlardaki oturumlar kapatılır — kullanıcı yeniden giriş yapmalı.
  db.prepare(`DELETE FROM sessions WHERE user_id = ?`).run(user.id);

  return { success: true };
}

function getUserPublicProfile(viewerId, targetId) {
  const user = db.prepare(`
    SELECT id, username, status, about_me, avatar_data, banner_data
    FROM users WHERE id = ?
  `).get(targetId);

  if (!user) return null;

  const isSelf = viewerId === targetId;
  const friendship = viewerId ? getFriendshipStatus(viewerId, targetId) : 'none';
  const blockedByMe = viewerId ? isBlocked(viewerId, targetId) : false;

  return {
    id: user.id,
    username: user.username,
    status: user.status,
    about_me: user.about_me,
    avatar_data: user.avatar_data,
    banner_data: user.banner_data,
    friendship_status: isSelf ? 'self' : friendship,
    blocked_by_me: blockedByMe
  };
}

// =====================================================
// ENGELLEME
// =====================================================

function blockUser(userId, targetId) {
  if (userId === targetId) return { success: false, error: 'Kendini engelleyemezsin.' };

  db.prepare(`
    INSERT INTO blocked_users (user_id, blocked_user_id) VALUES (?, ?)
    ON CONFLICT(user_id, blocked_user_id) DO NOTHING
  `).run(userId, targetId);

  removeFriend(userId, targetId);

  return { success: true };
}

function unblockUser(userId, targetId) {
  db.prepare(`DELETE FROM blocked_users WHERE user_id = ? AND blocked_user_id = ?`).run(userId, targetId);
  return { success: true };
}

function isBlocked(userId, targetId) {
  return Boolean(db.prepare(`SELECT 1 FROM blocked_users WHERE user_id = ? AND blocked_user_id = ?`).get(userId, targetId));
}

function listBlockedUsers(userId) {
  return db.prepare(`
    SELECT users.id, users.username, users.avatar_data
    FROM blocked_users
    INNER JOIN users ON users.id = blocked_users.blocked_user_id
    WHERE blocked_users.user_id = ?
    ORDER BY users.username COLLATE NOCASE
  `).all(userId);
}

// =====================================================
// RAPORLAMA (REPORT) SİSTEMİ
// =====================================================

function createReport(reporterId, { target_type, target_id, reason, description }) {
  if (!REPORT_TARGET_TYPES.includes(target_type)) {
    return { success: false, error: 'Geçersiz bildirim türü.' };
  }
  if (!REPORT_REASONS.includes(reason)) {
    return { success: false, error: 'Geçersiz bildirim nedeni.' };
  }

  const targetId = Number(target_id);
  if (!targetId) return { success: false, error: 'Geçersiz hedef.' };

  // Kendi hesabını veya kendi sahibi olduğun Hub'ı bildiremezsin — sadece
  // istemci tarafında buton gizlemekle yetinmiyoruz, API'ye doğrudan istek
  // atılsa bile burada reddediliyor.
  if (target_type === 'user' && targetId === reporterId) {
    return { success: false, error: 'Kendini bildiremezsin.' };
  }
  if (target_type === 'hub') {
    const hub = db.prepare(`SELECT created_by FROM hubs WHERE id = ?`).get(targetId);
    if (hub && hub.created_by === reporterId) {
      return { success: false, error: 'Kendi Hub\'ını bildiremezsin.' };
    }
  }

  const info = db.prepare(`
    INSERT INTO reports (reporter_user_id, target_type, target_id, reason, description, priority)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(reporterId, target_type, targetId, reason, String(description || '').trim().slice(0, 500), priorityForReason(reason));

  return { success: true, id: info.lastInsertRowid };
}

function listReports(status, filters) {
  const conditions = [];
  const params = [];

  if (status) {
    conditions.push('reports.status = ?');
    params.push(status);
  }
  if (filters?.priority) {
    conditions.push('reports.priority = ?');
    params.push(filters.priority);
  }
  if (filters?.reason) {
    conditions.push('reports.reason = ?');
    params.push(filters.reason);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const rows = db.prepare(`
    SELECT reports.*, users.username AS reporter_username
    FROM reports INNER JOIN users ON users.id = reports.reporter_user_id
    ${whereClause}
    ORDER BY reports.created_at DESC
  `).all(...params);

  return rows.map(r => ({ ...r, target_label: describeReportTarget(r.target_type, r.target_id) }));
}

function describeMessageKindLabel(kind, content, rawPayload) {
  let payload = null;
  if (rawPayload) {
    try { payload = JSON.parse(rawPayload); } catch (_) { payload = null; }
  }

  if (kind === 'voice') return `🎙️ Sesli mesaj (${payload?.duration || 0} sn)`;
  if (kind === 'image') return `🖼️ Görsel: ${payload?.name || 'görsel'}`;
  if (kind === 'video') return `🎬 Video: ${payload?.name || 'video'}`;
  if (kind === 'file') return `📎 Dosya: ${payload?.name || 'dosya'}`;
  if (kind === 'poll') return `📊 Anket: ${String(content || payload?.question || '').slice(0, 60)}`;
  if (kind === 'share') return `🔗 Paylaşım: ${String(content || '').slice(0, 60)}${payload?.url ? ' — ' + payload.url.slice(0, 60) : ''}`;
  if (kind === 'deleted') return '(silinmiş mesaj)';
  return String(content || '').slice(0, 60);
}

function describeReportTarget(targetType, targetId) {
  try {
    if (targetType === 'user') {
      const u = db.prepare(`SELECT username FROM users WHERE id = ?`).get(targetId);
      return u ? `Kullanıcı: ${u.username}` : 'Kullanıcı (silinmiş)';
    }
    if (targetType === 'hub') {
      const h = db.prepare(`SELECT name FROM hubs WHERE id = ?`).get(targetId);
      return h ? `Hub: ${h.name}` : 'Hub (silinmiş)';
    }
    if (targetType === 'message') {
      const m = db.prepare(`SELECT username, content, kind, payload FROM messages WHERE id = ?`).get(targetId);
      if (!m) return 'Mesaj (silinmiş)';
      const kindLabel = describeMessageKindLabel(m.kind, m.content, m.payload);
      return `Mesaj (${m.username}): ${kindLabel}`;
    }
    if (targetType === 'voice_room') {
      const r = db.prepare(`SELECT name FROM hub_voice_rooms WHERE id = ?`).get(targetId);
      return r ? `Sesli Oda: ${r.name}` : 'Sesli Oda (silinmiş)';
    }
  } catch (_) { /* yoksay */ }
  return `${targetType} #${targetId}`;
}

function updateReportStatus(reportId, reviewerId, status, reason) {
  if (!REPORT_STATUSES.includes(status)) return { success: false, error: 'Geçersiz durum.' };

  const info = db.prepare(`
    UPDATE reports SET status = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP WHERE id = ?
  `).run(status, reviewerId, reportId);

  if (!info.changes) return { success: false, error: 'Rapor bulunamadı.' };

  logModerationAction(reportId, reviewerId, status, reason);

  return { success: true };
}

// =====================================================
// VERİ İHRACI (KVKK md. 11 — erişim / taşınabilirlik hakkı)
// =====================================================

function getAccountExport(userId) {
  const profile = db.prepare(`
    SELECT id, username, email, about_me, status, avatar_visibility, birth_date,
           terms_accepted_at, created_at
    FROM users WHERE id = ?
  `).get(userId);

  if (!profile) return null;

  const messages = db.prepare(`
    SELECT id, content, room, to_user_id, kind, created_at
    FROM messages WHERE user_id = ? ORDER BY id
  `).all(userId);

  const hubs = db.prepare(`
    SELECT hubs.id, hubs.name, hub_members.permission_tier, hub_members.joined_at
    FROM hub_members INNER JOIN hubs ON hubs.id = hub_members.hub_id
    WHERE hub_members.user_id = ?
  `).all(userId);

  const friendships = db.prepare(`
    SELECT users.username, friendships.status, friendships.created_at
    FROM friendships
    INNER JOIN users ON users.id = (CASE WHEN friendships.user_low = ? THEN friendships.user_high ELSE friendships.user_low END)
    WHERE friendships.user_low = ? OR friendships.user_high = ?
  `).all(userId, userId, userId);

  const blocked = db.prepare(`
    SELECT users.username, blocked_users.created_at
    FROM blocked_users INNER JOIN users ON users.id = blocked_users.blocked_user_id
    WHERE blocked_users.user_id = ?
  `).all(userId);

  const sessions = db.prepare(`
    SELECT user_agent, created_at, expires_at FROM sessions WHERE user_id = ?
  `).all(userId);

  const reportsFiled = db.prepare(`
    SELECT target_type, target_id, reason, status, created_at FROM reports WHERE reporter_user_id = ?
  `).all(userId);

  return {
    exported_at: new Date().toISOString(),
    profile,
    messages,
    hub_memberships: hubs,
    friendships,
    blocked_users: blocked,
    sessions,
    reports_filed: reportsFiled
  };
}

// =====================================================
// KULLANICI ADI / ŞİFRE DEĞİŞTİRME
// =====================================================

function updateUsername(userId, newUsername) {
  newUsername = String(newUsername || '').trim();

  if (newUsername.length < 3 || newUsername.length > 20) {
    return { success: false, error: 'Kullanıcı adı 3-20 karakter olmalıdır.' };
  }

  const existing = db.prepare(`SELECT id FROM users WHERE LOWER(username) = LOWER(?) AND id != ?`).get(newUsername, userId);
  if (existing) return { success: false, error: 'Bu kullanıcı adı zaten alınmış.' };

  db.prepare(`UPDATE users SET username = ? WHERE id = ?`).run(newUsername, userId);
  return { success: true, username: newUsername };
}

function updatePassword(userId, currentPassword, newPassword) {
  const user = db.prepare(`SELECT password_hash, password_salt FROM users WHERE id = ?`).get(userId);
  if (!user) return { success: false, error: 'Kullanıcı bulunamadı.' };

  if (!verifyPassword(currentPassword, user.password_hash, user.password_salt)) {
    return { success: false, error: 'Mevcut şifre yanlış.' };
  }

  const newPasswordStr = String(newPassword || '');
  if (newPasswordStr.length < 6) {
    return { success: false, error: 'Yeni şifre en az 6 karakter olmalıdır.' };
  }

  const { hash, salt } = hashPassword(newPasswordStr);
  db.prepare(`UPDATE users SET password_hash = ?, password_salt = ? WHERE id = ?`).run(hash, salt, userId);

  return { success: true };
}

// =====================================================
// ÖZEL MESAJLAR (DM)
// =====================================================

function dmRoom(a, b) {
  const [low, high] = pairKey(a, b);
  return `dm_${low}_${high}`;
}

function saveDmMessage(fromId, fromUsername, toId, content) {
  if (!areFriends(fromId, toId)) {
    return { success: false, error: 'Sadece arkadaşlarınla mesajlaşabilirsin.' };
  }

  content = String(content || '').trim().slice(0, 500);
  if (!content) return { success: false, error: 'Boş mesaj gönderilemez.' };

  const info = db.prepare(`
    INSERT INTO messages (user_id, username, content, room, to_user_id, kind)
    VALUES (?, ?, ?, ?, ?, 'dm')
  `).run(fromId, fromUsername, content, dmRoom(fromId, toId), toId);

  return {
    success: true,
    message: getMessageById(info.lastInsertRowid)
  };
}

function saveDmVoiceMessage(fromId, fromUsername, toId, audioData, duration) {
  if (!areFriends(fromId, toId)) {
    return { success: false, error: 'Sadece arkadaşlarınla mesajlaşabilirsin.' };
  }

  if (typeof audioData !== 'string' || !/^data:audio\/(webm|ogg|mp4|mpeg|wav);base64,/.test(audioData)) {
    return { success: false, error: 'Geçersiz ses formatı.' };
  }

  if (audioData.length > 6_000_000) {
    return { success: false, error: 'Sesli mesaj çok uzun.' };
  }

  const payload = JSON.stringify({ audio: audioData, duration: Number(duration) || 0 });

  const info = db.prepare(`
    INSERT INTO messages (user_id, username, content, room, to_user_id, kind, payload)
    VALUES (?, ?, '', ?, ?, 'dm_voice', ?)
  `).run(fromId, fromUsername, dmRoom(fromId, toId), toId, payload);

  return {
    success: true,
    message: getMessageById(info.lastInsertRowid)
  };
}

function createDmFileMessage(fromId, fromUsername, toId, file) {
  if (!areFriends(fromId, toId)) {
    return { success: false, error: 'Sadece arkadaşlarınla mesajlaşabilirsin.' };
  }

  const { data, name, mime, size } = file || {};

  const check = validateFilePayload(data, mime, size);
  if (!check.success) return check;

  const kind = String(mime || '').startsWith('image/') ? 'dm_image'
    : String(mime || '').startsWith('video/') ? 'dm_video'
    : 'dm_file';

  const payload = JSON.stringify({
    data,
    name: String(name || 'dosya').slice(0, 200),
    mime: String(mime || 'application/octet-stream').slice(0, 100),
    size: Number(size) || 0
  });

  const info = db.prepare(`
    INSERT INTO messages (user_id, username, content, room, to_user_id, kind, payload)
    VALUES (?, ?, '', ?, ?, ?, ?)
  `).run(fromId, fromUsername, dmRoom(fromId, toId), toId, kind, payload);

  return { success: true, message: getMessageById(info.lastInsertRowid) };
}

function getDmMessages(userId, otherUserId, limit = 50) {
  const rows = db.prepare(`
    SELECT messages.id, messages.user_id, messages.username, messages.content, messages.to_user_id,
           messages.kind, messages.payload, messages.edited, messages.created_at, users.avatar_data
    FROM messages LEFT JOIN users ON users.id = messages.user_id
    WHERE room = ?
    ORDER BY messages.id DESC LIMIT ?
  `).all(dmRoom(userId, otherUserId), limit);

  return rows.reverse().map(hydrateMessage);
}

function createUser(username) {
  try {
    const info = db.prepare(`INSERT INTO users (username) VALUES (?)`).run(username);
    return info.lastInsertRowid;
  } catch {
    return null;
  }
}

module.exports = {
  saveMessage,
  getMessages,
  createUser,
  loginUser,
  createVerification,
  verifyAndCreateUser,
  updateAboutMe,
  updateStatus,
  updatePrivacy,
  updateAvatar,
  updateBanner,
  createHub,
  updateHub,
  listHubs,
  getHubDetail,
  setHubRole,
  leaveHub,
  addHubRole,
  isHubMember,
  getMemberTier,
  hasAtLeastTier,
  setModerator,
  kickMember,
  banMember,
  unbanMember,
  isHubBanned,
  listHubBans,
  getHubMessages,
  saveHubMessage,
  deleteMessage,
  editMessage,
  createHubVoiceMessage,
  createHubFileMessage,
  createHubPoll,
  voteHubPoll,
  createHubShare,
  deleteHub,
  getHubDailyRoomName,
  listVoiceRooms,
  createVoiceRoom,
  deleteVoiceRoom,
  getVoiceRoomDailyName,
  setVoiceRoomDailyName,
  getVoiceRoom,
  setHubDailyRoomName,
  createHubInvite,
  joinHubByCode,
  sendFriendRequest,
  respondFriendRequest,
  removeFriend,
  areFriends,
  getFriendshipStatus,
  listFriends,
  listIncomingRequests,
  getUserPublicProfile,
  saveDmMessage,
  saveDmVoiceMessage,
  createDmFileMessage,
  getDmMessages,
  findUserByUsername,
  blockUser,
  unblockUser,
  listBlockedUsers,
  createReport,
  listReports,
  updateReportStatus,
  logModerationAction,
  listModerationHistory,
  hasAtLeastPlatformRole,
  setPlatformRole,
  getReportDetail,
  PLATFORM_ROLES,
  REPORT_REASONS,
  REPORT_STATUSES,
  REPORT_PRIORITIES,
  calculateAge,
  isMinorAge,
  MIN_SIGNUP_AGE,
  getAccountExport,
  isBlocked,
  updateUsername,
  updatePassword,
  getTopFriends,
  sendHubInviteNotification,
  listNotifications,
  respondHubInviteNotification,
  requestPasswordReset,
  confirmPasswordReset,
  createNotification,
  getNotificationPreferences,
  updateNotificationPreferences,
  markNotificationRead,
  db
};