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

function createVerification(username, email, password) {
  try {
    username = String(username || '').trim();
    email = String(email || '').trim().toLowerCase();
    password = String(password || '');

    if (!username || !email || !password) {
      return { success: false, error: 'Tüm alanları doldurmalısınız.' };
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
      INSERT INTO pending_verifications (username, email, password_hash, password_salt, code, expires_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(username, email, hash, salt, code, expiresAt);

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

    const result = db.prepare(`
      INSERT INTO users (username, email, password_hash, password_salt)
      VALUES (?, ?, ?, ?)
    `).run(pending.username, pending.email, pending.password_hash, pending.password_salt);

    db.prepare(`DELETE FROM pending_verifications WHERE id = ?`).run(pending.id);

    return {
      success: true,
      id: result.lastInsertRowid,
      username: pending.username,
      email: pending.email,
      about_me: null,
      status: 'signal',
      avatar_visibility: 'public',
      avatar_data: null
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

    db.prepare(`INSERT INTO hub_members (hub_id, user_id) VALUES (?, ?)`).run(hubId, userId);

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
    SELECT hub_members.user_id, hub_members.role_id, users.username, users.status
    FROM hub_members
    INNER JOIN users ON users.id = hub_members.user_id
    WHERE hub_members.hub_id = ?
  `).all(hubId);

  const membership = userId
    ? db.prepare(`SELECT role_id FROM hub_members WHERE hub_id = ? AND user_id = ?`).get(hubId, userId)
    : null;

  return {
    ...hub,
    roles,
    members,
    is_member: Boolean(membership),
    is_owner: hub.created_by === userId,
    my_role_id: membership ? membership.role_id : null
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
  const data = JSON.stringify({ from_user_id: fromId, from_username: fromUser?.username || '' });
  db.prepare(`INSERT INTO notifications (user_id, type, data) VALUES (?, 'friend_request', ?)`).run(toId, data);

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

  const data = JSON.stringify({
    hub_id: hub.id,
    hub_name: hub.name,
    hub_icon: hub.icon,
    from_user_id: fromUserId,
    from_username: fromUsername
  });

  const info = db.prepare(`
    INSERT INTO notifications (user_id, type, data) VALUES (?, 'hub_invite', ?)
  `).run(toUserId, data);

  return { success: true, id: info.lastInsertRowid };
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

  return { success: true };
}

function getUserPublicProfile(viewerId, targetId) {
  const user = db.prepare(`
    SELECT id, username, status, avatar_data, banner_data
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
  isBlocked,
  updateUsername,
  updatePassword,
  getTopFriends,
  sendHubInviteNotification,
  listNotifications,
  respondHubInviteNotification,
  requestPasswordReset,
  confirmPasswordReset,
  db
};