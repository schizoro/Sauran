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

if (!hubMembersColumns.includes('muted')) {
  db.exec(`ALTER TABLE hub_members ADD COLUMN muted INTEGER NOT NULL DEFAULT 0`);
}

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

// Sesli oda katılma/ayrılma bildirimi ve sesi (13A) — mevcut kurulumlara sonradan eklenir.
const notifPrefColumns = db.prepare(`PRAGMA table_info(notification_preferences)`).all().map(col => col.name);
for (const column of ['notify_voice_presence', 'voice_join_sound']) {
  if (!notifPrefColumns.includes(column)) {
    db.exec(`ALTER TABLE notification_preferences ADD COLUMN ${column} INTEGER NOT NULL DEFAULT 1`);
  }
}

const NOTIFICATION_PREF_COLUMNS = [
  'desktop_enabled', 'inapp_enabled', 'sound_enabled',
  'notify_dm_message', 'notify_hub_message',
  'notify_friend_request', 'notify_friend_accepted',
  'notify_incoming_call', 'notify_missed_call',
  'notify_hub_event', 'notify_system',
  'notify_voice_presence', 'voice_join_sound'
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
  // Askıdaki hesap için yeni bildirim üretilmez (geçmiş silinmez, askı kalkınca korunmuş kalır).
  // isAccountSuspended aşağıda tanımlı (function bildirimi hoisted).
  if (isAccountSuspended(userId)) {
    return { id: null, user_id: userId, type, data, suppressed: true };
  }

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

// =====================================================
// RAPOR SAKLAMA (RETENTION) + MESAJ KANIT KAYDI
// =====================================================
// Amaç: raporlanan mesajın, mesaj silinse / hesap kapansa bile moderasyon incelemesi için gerekli MİNİMUM kanıtını
// süreli olarak korumak; ama hiçbir şeyi süresiz saklamamak. Ayrıntılı gerekçe: docs/rapor-kaniti-saklama-politikasi.md
//
// Tablolar (birbirinden bağımsız retention_until alanları):
//   reports                 rapor kaydı (metadata)           -> retention_until
//   report_evidence         mesajın raporlandığı an metni    -> retention_until   (mesajlar tablosundan AYRI)
//   report_evidence_media   ses/görsel/video/dosya verisi    -> retention_until   (metinden AYRI, daha kısa)
//   evidence_lifecycle_log  imha/anonimleştirme olayları     (olay + zaman + rapor id + sayılar; içerik/kişisel veri YOK;
//                                                             rapor/kanıt silinince SİLİNMEZ, en az 3 yıl korunur)

// Süreler GÜN. Bunlar TEKNİK VARSAYILANLARDIR; KVKK'ya uygunluk garantisi değildir (bkz. docs).
const RETENTION_POLICY = {
  evidence_media: { open: 90, dismissed: 7, action_taken: 180 },   // en hassas / en ağır veri: en kısa
  evidence_text: { open: 180, dismissed: 30, action_taken: 365 },
  report_record: { open: 365, dismissed: 90, action_taken: 730 },
  // Silme/yok etme/anonimleştirme kayıtları (evidence_lifecycle_log) rapor ve kanıttan BAĞIMSIZ bir yaşam döngüsüne sahiptir:
  // rapor/kanıt/medya temizliği bu kayda dokunmaz; kayıt en az 3 TAKVİM YILI korunur (sabit gün sayısı değil: artık yıllarda
  // 1095 gün üç yılı garanti etmez). max_days bu kayda UYGULANMAZ.
  lifecycle_log_years: 3,
  max_days: 730,           // rapor/kanıt/medya için üst sınır: bunları aşamaz, süresiz saklama YOK
  // Migration sırasında, bu özellikten ÖNCE açılmış raporlara tanınan operasyonel ek süre (gün). Hukuki bir gerekçesi yoktur;
  // bu nedenle varsayılan 0'dır: politika eski raporlara da kendi tarihlerinden uygulanır, ek saklama verilmez. Tarihi
  // geçmiş eski raporlar ilk açılışta silinir (geri alınamaz) — deploy ÖNCESİ veritabanı yedeği alınması ayrı bir operasyonel önlemdir.
  legacy_migration_grace_days: 0
};
// NOT: Rapor nedenine (taciz, tehdit, çocuk güvenliği vb.) göre süre UZATAN bir mekanizma bilerek YOKTUR. Tüm nedenler
// aynı süreleri kullanır. İleride bir kategori için ayrı süre gerekirse, önce hukuki dayanağı belgelenip bu tabloya AÇIKÇA
// (ör. ayrı bir nedene özel tablo + docs güncellemesiyle) eklenmelidir; kodda "daha uzun sakla" varsayımı yapılmaz.

const EVIDENCE_MEDIA_MAX_CHARS = 6 * 1024 * 1024; // daha büyük medya kopyalanmaz (metin + metadata yine saklanır)
const DAY_MS = 24 * 60 * 60 * 1000;

// `years` takvim yılı önceki an (UTC). 29 Şubat'ın olmadığı yıla düşerse 28 Şubat'a çekilir (daha UZUN saklama tarafında kalır).
function subtractCalendarYears(date, years) {
  const d = new Date(date.getTime());
  const month = d.getUTCMonth();
  d.setUTCFullYear(d.getUTCFullYear() - years);
  if (d.getUTCMonth() !== month) d.setUTCDate(0);
  return d;
}

// Yaşam döngüsü logunda bu tarihten ÖNCE (kesinlikle) oluşmuş kayıtlar silinebilir: tam 3 takvim yılı henüz aşılmamış kayıt korunur.
function lifecycleLogCutoff(now = new Date()) {
  return subtractCalendarYears(now, RETENTION_POLICY.lifecycle_log_years).toISOString().replace('T', ' ').slice(0, 19);
}

function retentionBucket(status) {
  return status === 'dismissed' ? 'dismissed' : status === 'action_taken' ? 'action_taken' : 'open';
}

// Bir raporun üç saklama bitiş tarihini (ISO) hesaplar. Açık raporda süre rapor tarihinden, kapanmış raporda kapanıştan sayılır.
function computeRetention(status, createdAt, closedAt) {
  const bucket = retentionBucket(status);
  const pick = (category) => Math.min(Math.max(1, Number(RETENTION_POLICY[category][bucket]) || 1), RETENTION_POLICY.max_days);

  const record = pick('report_record');
  const text = Math.min(pick('evidence_text'), record);   // kanıt, rapor kaydından uzun yaşayamaz
  const media = Math.min(pick('evidence_media'), text);   // medya, kanıt metninden uzun yaşayamaz

  // SQLite CURRENT_TIMESTAMP 'YYYY-MM-DD HH:MM:SS' (UTC) döndürür; ISO biçimiyle aynı şekilde yorumlanır.
  const ms = (v) => new Date(String(v).includes('T') ? v : String(v).replace(' ', 'T') + 'Z').getTime();
  const base = bucket === 'open' ? ms(createdAt) : (closedAt ? ms(closedAt) : Date.now());
  const at = (days) => new Date((Number.isFinite(base) ? base : Date.now()) + days * DAY_MS).toISOString();

  return { record: at(record), text: at(text), media: at(media) };
}

// ---- Şema ------------------------------------------------------------------------------------------------------
// reports.reporter_user_id eskiden NOT NULL + ON DELETE CASCADE idi: raporlayan hesabını silince rapor ve kanıt yok oluyordu.
// SQLite kısıtı yerinde değiştiremez; SQLite'ın önerdiği tablo yeniden oluşturma prosedürü uygulanır (idempotent, transaction içinde).
let legacyRetentionAssigned = 0; // migration sonunda yaşam döngüsü loguna yazılır (tablo daha sonra oluşur)
(function migrateReportsForRetention() {
  const cols = db.prepare(`PRAGMA table_info(reports)`).all();
  const reporterCol = cols.find(c => c.name === 'reporter_user_id');

  if (reporterCol && reporterCol.notnull === 1) {
    db.pragma('foreign_keys = OFF'); // transaction dışında olmalı
    try {
      db.transaction(() => {
        db.exec(`
          CREATE TABLE reports_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            reporter_user_id INTEGER,
            target_type TEXT NOT NULL,
            target_id INTEGER NOT NULL,
            reason TEXT NOT NULL,
            description TEXT,
            status TEXT NOT NULL DEFAULT 'new',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            reviewed_by INTEGER,
            reviewed_at DATETIME,
            priority TEXT NOT NULL DEFAULT 'normal',
            retention_until TEXT,
            evidence_status TEXT,
            reporter_account_deleted INTEGER NOT NULL DEFAULT 0,
            FOREIGN KEY (reporter_user_id) REFERENCES users(id) ON DELETE SET NULL
          );

          INSERT INTO reports_new (id, reporter_user_id, target_type, target_id, reason, description, status, created_at, reviewed_by, reviewed_at, priority)
          SELECT id, reporter_user_id, target_type, target_id, reason, description, status, created_at, reviewed_by, reviewed_at, priority FROM reports;

          DROP TABLE reports;
          ALTER TABLE reports_new RENAME TO reports;
        `);

        const broken = db.prepare(`PRAGMA foreign_key_check`).all();
        if (broken.length) throw new Error('reports migration: foreign_key_check başarısız');
      })();
    } finally {
      db.pragma('foreign_keys = ON');
    }
  } else {
    // Yeniden oluşturma gerekmiyorsa (yeni kurulum ya da yarım kalmış eski sürüm) eksik kolonları ekle.
    const names = cols.map(c => c.name);
    if (!names.includes('retention_until')) db.exec(`ALTER TABLE reports ADD COLUMN retention_until TEXT`);
    if (!names.includes('evidence_status')) db.exec(`ALTER TABLE reports ADD COLUMN evidence_status TEXT`);
    if (!names.includes('reporter_account_deleted')) db.exec(`ALTER TABLE reports ADD COLUMN reporter_account_deleted INTEGER NOT NULL DEFAULT 0`);
  }

  // Bu özellikten önce açılmış raporlar için retention_until, politika kendi tarihlerinden uygulanarak hesaplanır.
  // Varsayılan (legacy_migration_grace_days = 0): ek süre YOK; tarihi geçmiş eski raporlar ilk açılıştaki temizlikte silinir.
  // Ek süre yalnızca operasyonel bir tercih olarak (>0) ve hukuki gerekçesi olmadan tanınabilir; belgelenmiştir.
  // Eski raporlar için geriye dönük KANIT üretilmez (evidence_status boş kalır).
  const legacy = db.prepare(`SELECT id, status, created_at, reviewed_at FROM reports WHERE retention_until IS NULL`).all();
  const setUntil = db.prepare(`UPDATE reports SET retention_until = ? WHERE id = ?`);
  const grace = Math.max(0, Number(RETENTION_POLICY.legacy_migration_grace_days) || 0);
  const floor = Date.now() + grace * DAY_MS;
  legacy.forEach(r => {
    const until = new Date(computeRetention(r.status, r.created_at, r.reviewed_at || r.created_at).record).getTime();
    setUntil.run(new Date(grace > 0 ? Math.max(until, floor) : until).toISOString(), r.id);
  });
  legacyRetentionAssigned = legacy.length;
})();

// Kanıt tablosu eski (yayınlanmamış) taslak şemayla oluşmuşsa yeniden kur; retention_until yoksa eski şemadır.
(function dropDraftEvidenceSchema() {
  const cols = db.prepare(`PRAGMA table_info(report_evidence)`).all().map(c => c.name);
  // Yayınlanmamış taslak şemalar (retention_until yok ya da kullanıcı adı kopyası var) yeniden kurulur.
  if (cols.length && (!cols.includes('retention_until') || cols.includes('sender_username'))) {
    db.exec(`DROP TABLE IF EXISTS report_evidence_media; DROP TABLE report_evidence`);
  }
})();

db.exec(`
  CREATE TABLE IF NOT EXISTS report_evidence (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    report_id INTEGER NOT NULL UNIQUE,
    message_id INTEGER NOT NULL,
    sender_id INTEGER,
    sender_account_deleted INTEGER NOT NULL DEFAULT 0,
    kind TEXT,
    content TEXT,
    payload TEXT,
    media_status TEXT,
    integrity_sha256 TEXT,
    was_edited INTEGER NOT NULL DEFAULT 0,
    message_created_at DATETIME,
    context_type TEXT NOT NULL,
    hub_id INTEGER,
    hub_name TEXT,
    to_user_id INTEGER,
    recipient_account_deleted INTEGER NOT NULL DEFAULT 0,
    captured_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    retention_until TEXT NOT NULL,
    FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_report_evidence_retention ON report_evidence(retention_until);

  CREATE TABLE IF NOT EXISTS report_evidence_media (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    evidence_id INTEGER NOT NULL UNIQUE,
    field TEXT NOT NULL,
    mime TEXT,
    size_chars INTEGER NOT NULL,
    sha256 TEXT NOT NULL,
    data TEXT NOT NULL,
    retention_until TEXT NOT NULL,
    FOREIGN KEY (evidence_id) REFERENCES report_evidence(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_report_evidence_media_retention ON report_evidence_media(retention_until);

  CREATE TABLE IF NOT EXISTS evidence_lifecycle_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event TEXT NOT NULL,
    report_id INTEGER,
    detail TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TRIGGER IF NOT EXISTS evidence_lifecycle_log_no_update
  BEFORE UPDATE ON evidence_lifecycle_log
  BEGIN SELECT RAISE(ABORT, 'evidence_lifecycle_log is append-only'); END;
`);

// Yalnızca olay türü, rapor id'si ve sayılar yazılır. Mesaj içeriği, kullanıcı adı/id'si ASLA yazılmaz.
function logEvidenceLifecycle(event, reportId, detail) {
  db.prepare(`INSERT INTO evidence_lifecycle_log (event, report_id, detail) VALUES (?, ?, ?)`)
    .run(event, reportId || null, detail ? JSON.stringify(detail) : null);
}

// ---- Yakalama --------------------------------------------------------------------------------------------------
if (legacyRetentionAssigned) {
  logEvidenceLifecycle('legacy_retention_assigned', null, { reports: legacyRetentionAssigned, grace_days: RETENTION_POLICY.legacy_migration_grace_days });
}

const MEDIA_FIELDS = ['audio', 'data']; // payload içindeki ağır (base64 data URI) alanlar

// Rapor edilen mesajın o anki halini yazar (createReport'un transaction'ı içinde çağrılır).
// Yalnızca gerekli minimum: mesaj içeriği + bağlam. Kullanıcı ADI kopyalanmaz (gönderen/alıcı/raporlayan): yalnızca iç
// kimlik (id) tutulur, panel adı canlı çözer; hesap silinince id NULL olur ve ad hiçbir yerde kalmaz.
function captureMessageEvidence(reportId, message, retention) {
  const hub = message.hub_id ? db.prepare(`SELECT name FROM hubs WHERE id = ?`).get(message.hub_id) : null;

  let light = null;
  let mediaField = null;
  let mediaData = null;

  if (message.payload) {
    try { light = JSON.parse(message.payload); } catch (_) { light = null; }
    if (light && typeof light === 'object') {
      for (const f of MEDIA_FIELDS) {
        if (typeof light[f] === 'string' && light[f].startsWith('data:')) {
          mediaField = f; mediaData = light[f];
          delete light[f];
          break;
        }
      }
    }
  }

  let mediaStatus = null;
  if (mediaData) mediaStatus = mediaData.length > EVIDENCE_MEDIA_MAX_CHARS ? 'too_large' : 'stored';

  const lightJson = light ? JSON.stringify(light) : null;
  const mediaSha = mediaData ? crypto.createHash('sha256').update(mediaData).digest('hex') : '';
  const integrity = crypto.createHash('sha256')
    .update(`${message.kind || 'text'}\n${message.content || ''}\n${lightJson || ''}\n${mediaSha}`).digest('hex');

  const info = db.prepare(`
    INSERT INTO report_evidence
      (report_id, message_id, sender_id, kind, content, payload, media_status, integrity_sha256, was_edited,
       message_created_at, context_type, hub_id, hub_name, to_user_id, retention_until)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    reportId, message.id, message.user_id, message.kind || 'text', message.content || '',
    lightJson, mediaStatus, integrity, message.edited ? 1 : 0, message.created_at,
    message.hub_id ? 'hub' : 'dm', message.hub_id || null, hub ? hub.name : null,
    !message.hub_id ? (message.to_user_id || null) : null, retention.text
  );

  if (mediaStatus === 'stored') {
    const mime = (/^data:([^;,]+)/.exec(mediaData) || [])[1] || null;
    db.prepare(`
      INSERT INTO report_evidence_media (evidence_id, field, mime, size_chars, sha256, data, retention_until)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(info.lastInsertRowid, mediaField, mime, mediaData.length, mediaSha, mediaData, retention.media);
  }

  logEvidenceLifecycle('evidence_captured', reportId, { kind: message.kind || 'text', media: mediaStatus || 'none' });
}

// Rapor durumu değişince üç saklama tarihi yeniden hesaplanır.
function refreshRetention(reportId) {
  const r = db.prepare(`SELECT status, created_at, reviewed_at FROM reports WHERE id = ?`).get(reportId);
  if (!r) return;
  const t = computeRetention(r.status, r.created_at, r.reviewed_at);

  db.prepare(`UPDATE reports SET retention_until = ? WHERE id = ?`).run(t.record, reportId);
  db.prepare(`UPDATE report_evidence SET retention_until = ? WHERE report_id = ?`).run(t.text, reportId);
  db.prepare(`
    UPDATE report_evidence_media SET retention_until = ?
    WHERE evidence_id IN (SELECT id FROM report_evidence WHERE report_id = ?)
  `).run(t.media, reportId);
}

// ---- Hesap silme: rapor/kanıt bağlantılarını koparır (kaydı silmez; süresi dolunca temizlik siler) ------------------
// Silinen hesabın kimliği (id) raporlarda/kanıtlarda kalmaz; hesap ile bağlantı NULL'a çekilir ve bayrak konur.
function unlinkReportDataForDeletedUser(userId) {
  const run = db.transaction(() => {
    const asReporter = db.prepare(`
      UPDATE reports SET reporter_user_id = NULL, reporter_account_deleted = 1 WHERE reporter_user_id = ?
    `).run(userId).changes;

    const asSender = db.prepare(`
      UPDATE report_evidence SET sender_id = NULL, sender_account_deleted = 1 WHERE sender_id = ?
    `).run(userId).changes;

    const asRecipient = db.prepare(`
      UPDATE report_evidence SET to_user_id = NULL, recipient_account_deleted = 1 WHERE to_user_id = ?
    `).run(userId).changes;

    if (asReporter || asSender || asRecipient) {
      logEvidenceLifecycle('account_unlinked', null, { as_reporter: asReporter, as_sender: asSender, as_recipient: asRecipient });
    }
  });
  run();
}

// ---- Temizlik (retention_until üzerinden) ----------------------------------------------------------------------------
// Sıra: medya -> kanıt metni -> rapor kaydı. Silmede SQLite secure_delete açılır (içerik sayfada sıfırlanır) ve WAL kırpılır.
// Not: Render/yedek/disk anlık görüntüleri gibi veritabanı dışındaki kopyalar bu işlemin kapsamı dışındadır.
function purgeExpiredRetention(now = new Date()) {
  const iso = now.toISOString();
  const result = { media: 0, evidence: 0, reports: 0, log: 0 };

  db.pragma('secure_delete = ON');
  try {
    db.transaction(() => {
      const media = db.prepare(`
        SELECT report_evidence_media.id AS mid, report_evidence.id AS eid, report_evidence.report_id AS rid
        FROM report_evidence_media JOIN report_evidence ON report_evidence.id = report_evidence_media.evidence_id
        WHERE report_evidence_media.retention_until <= ?
      `).all(iso);
      media.forEach(m => {
        db.prepare(`DELETE FROM report_evidence_media WHERE id = ?`).run(m.mid);
        db.prepare(`UPDATE report_evidence SET media_status = 'purged' WHERE id = ?`).run(m.eid);
        logEvidenceLifecycle('media_purged', m.rid, null);
      });
      result.media = media.length;

      const evidence = db.prepare(`SELECT id, report_id FROM report_evidence WHERE retention_until <= ?`).all(iso);
      evidence.forEach(e => {
        db.prepare(`DELETE FROM report_evidence WHERE id = ?`).run(e.id); // medya varsa CASCADE ile gider
        db.prepare(`UPDATE reports SET evidence_status = 'expired' WHERE id = ?`).run(e.report_id);
        logEvidenceLifecycle('evidence_purged', e.report_id, null);
      });
      result.evidence = evidence.length;

      const reports = db.prepare(`SELECT id FROM reports WHERE retention_until <= ?`).all(iso);
      reports.forEach(r => {
        db.prepare(`DELETE FROM reports WHERE id = ?`).run(r.id); // moderation_actions + varsa kanıt CASCADE
        logEvidenceLifecycle('report_purged', r.id, null);
      });
      result.reports = reports.length;

      result.log = db.prepare(`DELETE FROM evidence_lifecycle_log WHERE created_at < ?`).run(lifecycleLogCutoff(now)).changes;
    })();
  } finally {
    db.pragma('secure_delete = OFF');
  }

  if (result.media || result.evidence || result.reports) {
    try { db.pragma('wal_checkpoint(TRUNCATE)'); } catch (_) { /* yoksay */ }
  }
  return result;
}

// ---- Süresi dolmuş geçici kimlik doğrulama kayıtları ---------------------------------------------------------------------
// pending_verifications (e-posta, parola özeti+tuzu, doğum tarihi, kod), password_resets (kod) ve sessions (oturum özeti, cihaz bilgisi)
// süresi dolduktan sonra da kullanılmadıkça satır olarak kalıyordu. Uygulamanın kendi süre kontrolüyle AYNI kural kullanılır
// (`new Date(expires_at).getTime() <= Date.now()`): yalnızca gerçekten süresi dolmuş satırlar silinir; süresi dolmamış ya da
// tarihi çözümlenemeyen satırlar (uygulama bunları geçerli sayar) korunur. Başka hiçbir tabloya dokunulmaz.
// Silme sırasında secure_delete açılır (parola özeti/kod gibi içerik sayfada sıfırlanır) ve WAL kırpılır.
const AUTH_EXPIRY_TABLES = { pending: 'pending_verifications', resets: 'password_resets', sessions: 'sessions' }; // sabit adlar

function purgeExpiredAuthRecords(now = new Date()) {
  const nowMs = now.getTime();
  const result = { pending: 0, resets: 0, sessions: 0 };

  db.pragma('secure_delete = ON');
  try {
    db.transaction(() => {
      for (const [key, table] of Object.entries(AUTH_EXPIRY_TABLES)) {
        if (!db.prepare(`SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?`).get(table)) continue;

        const expiredIds = db.prepare(`SELECT id, expires_at FROM ${table}`).all()
          .filter((row) => { const t = new Date(row.expires_at).getTime(); return Number.isFinite(t) && t <= nowMs; })
          .map((row) => row.id);

        const remove = db.prepare(`DELETE FROM ${table} WHERE id = ?`);
        expiredIds.forEach((id) => remove.run(id));
        result[key] = expiredIds.length;
      }
    })();
  } finally {
    db.pragma('secure_delete = OFF');
  }

  if (result.pending || result.resets || result.sessions) {
    try { db.pragma('wal_checkpoint(TRUNCATE)'); } catch (_) { /* yoksay */ }
  }
  return result;
}

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

// =====================================================
// GELİŞTİRME BİLGİLENDİRME PENCERESİ — hesaba bağlı kalıcı durum
// =====================================================
// dev_notice_seen: kullanıcı bilgilendirmeyi "Anladım" ile onayladı mı (cihazdan bağımsız).
// dev_notice_new : 1 = hesap yeni kayıtla oluştu ("Sauran Geliştirme Sürecinde"),
//                  0 = bu özellikten önce var olan hesap ("Sauran Geliştirilmeye Devam Ediyor").
// Mevcut satırlar iki kolonda da 0 alır (görmedi, eski kullanıcı) — ayrı bir veri
// dönüşümü gerekmez, auth/session yapısına dokunulmaz.
const usersNoticeColumns = db.prepare(`PRAGMA table_info(users)`).all().map(col => col.name);
if (!usersNoticeColumns.includes('dev_notice_seen')) {
  db.exec(`ALTER TABLE users ADD COLUMN dev_notice_seen INTEGER NOT NULL DEFAULT 0`);
}
if (!usersNoticeColumns.includes('dev_notice_new')) {
  db.exec(`ALTER TABLE users ADD COLUMN dev_notice_new INTEGER NOT NULL DEFAULT 0`);
}

function devNoticeFor(seen, isNew) {
  if (seen) return null;
  return isNew ? 'new' : 'existing';
}

function markDevNoticeSeen(userId) {
  db.prepare(`UPDATE users SET dev_notice_seen = 1 WHERE id = ?`).run(userId);
}

const PLATFORM_ROLES = ['user', 'moderator', 'admin', 'founder'];
const PLATFORM_ROLE_RANK = { user: 0, moderator: 1, admin: 2, founder: 3 };

function hasAtLeastPlatformRole(platformRole, minRole) {
  return (PLATFORM_ROLE_RANK[platformRole] ?? 0) >= (PLATFORM_ROLE_RANK[minRole] ?? 0);
}

// =====================================================
// RESMİ YÖNETİM GÖREVİ KABULÜ (role acceptance)
// =====================================================
// platform_role, founder'ın atadığı GERÇEK rolü tutmaya devam eder. Web üzerinden
// yeni bir moderator/admin rolü verildiğinde kullanıcı görev bildirisini kabul
// edene kadar (role_acceptance_pending = 1) yeni yetki KULLANILMAZ; kullanıcı
// bu sürede önceki etkin yetkisiyle kalır (bkz. getEffectivePlatformRole).
//   role_acceptance_pending : 1 = atanan görev henüz kabul edilmedi
//   role_acceptance_version : bekleyen / son kabul edilen bildirim sürümü (ör. moderator-v1)
//   role_accepted_role      : kullanıcının kabul EDİLMİŞ (etkin) taban yetkisi
//   role_accepted_at        : son kabul zamanı
//   role_notice_kind/at     : bir kez gösterilecek "görevden alma" bilgilendirmesi
// Founder bu mekanizmanın dışındadır. CLI (admin.js set-role) bu akışı ATLAR:
// CLI ile verilen rol bildirim/kabul üretmeden doğrudan geçerlidir.
const ROLE_NOTICE_VERSIONS = { moderator: 'moderator-v1', admin: 'admin-v1' };
const OFFICIAL_SENDER_LABEL = 'Sauran Yönetim';
const SUPPORT_EMAIL_ADDRESS = 'destek@sauran.online';

const usersAcceptanceColumns = db.prepare(`PRAGMA table_info(users)`).all().map(col => col.name);
for (const [name, ddl] of [
  ['role_acceptance_pending', 'INTEGER NOT NULL DEFAULT 0'],
  ['role_acceptance_version', 'TEXT'],
  ['role_accepted_role', 'TEXT'],
  ['role_accepted_at', 'DATETIME'],
  ['role_notice_kind', 'TEXT'],
  ['role_notice_at', 'DATETIME']
]) {
  if (!usersAcceptanceColumns.includes(name)) {
    db.exec(`ALTER TABLE users ADD COLUMN ${name} ${ddl}`);
  }
}

// Güvenli backfill (idempotent): mevcut moderator/admin'ler yetkilerini KAYBETMEZ ve
// kabul beklemeye alınmaz; founder asla kabul bekleyen duruma düşmez.
db.exec(`
  UPDATE users SET role_acceptance_pending = 0 WHERE platform_role = 'founder' AND role_acceptance_pending <> 0;
  UPDATE users SET role_accepted_role = platform_role
    WHERE role_accepted_role IS NULL AND role_acceptance_pending = 0 AND platform_role IN ('moderator', 'admin');
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS role_notice_email_outbox (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    role TEXT NOT NULL,
    version TEXT,
    payload TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    attempts INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    claimed_at DATETIME,
    next_attempt_at DATETIME,
    sent_at DATETIME,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_role_notice_outbox_status ON role_notice_email_outbox(status, next_attempt_at);
`);

// Sistem (resmi yönetim) görev bildirimi: yalnızca kabul bekleyen görev için anlamlıdır.
// Sistem bildirimleri sistem tarafından temizlenebilir; diğer bildirimler yalnızca kullanıcı silince gider.
function deleteStalePlatformNotices(userId) {
  db.prepare(`DELETE FROM notifications WHERE user_id = ? AND type = 'platform_role_notice'`).run(userId);
}

// Kendini onaran temizlik: kabul BEKLEMEYEN bir kullanıcının görev bildirimi geçersizdir
// (ör. bu düzeltmeden önce kalmış eski kayıtlar). Kullanıcı sistem hatası yüzünden
// bildirim silmek zorunda kalmamalı; sistem kendi bildirimini kendisi temizler.
// userId verilmezse tüm kullanıcılar için çalışır (açılışta).
function cleanupStalePlatformNotices(userId = null) {
  const single = userId !== null && userId !== undefined;
  return db.prepare(`
    DELETE FROM notifications
    WHERE type = 'platform_role_notice'
      AND user_id NOT IN (
        SELECT id FROM users WHERE role_acceptance_pending = 1 AND platform_role IN ('moderator', 'admin')
      )${single ? ' AND user_id = ?' : ''}
  `).run(...(single ? [userId] : [])).changes;
}

function isOfficialRole(role) {
  return role === 'moderator' || role === 'admin';
}

// TEK yetkili yer: "etkin" platform rolü. Kullanıcının atanmış rolü (platform_role)
// henüz kabul edilmemişse yetki, kabul edilmiş taban yetkiyle sınırlanır:
//   user -> moderator/admin (bekliyor)  => user
//   moderator -> admin (bekliyor)        => moderator
//   admin -> moderator (bekliyor)        => moderator (admin yetkisi anında biter)
function getEffectivePlatformRole(row) {
  const assigned = PLATFORM_ROLES.includes(row?.platform_role) ? row.platform_role : 'user';
  if (assigned === 'founder') return 'founder';
  if (!row.role_acceptance_pending) return assigned;

  const base = PLATFORM_ROLES.includes(row.role_accepted_role) && row.role_accepted_role !== 'founder'
    ? row.role_accepted_role
    : 'user';
  return PLATFORM_ROLE_RANK[assigned] <= PLATFORM_ROLE_RANK[base] ? assigned : base;
}

// Oturum / giriş / /api/me için kullanıcı nesnesine eklenen rol alanları.
// platform_role BURADA etkin roldür — yetki kontrolleri bunun üzerinden çalışır.
function platformRoleFields(row) {
  const assigned = PLATFORM_ROLES.includes(row?.platform_role) ? row.platform_role : 'user';
  const pending = assigned !== 'founder' && isOfficialRole(assigned) && Boolean(row.role_acceptance_pending);

  let notice = null;
  if (row.role_notice_kind && String(row.role_notice_kind).startsWith('revoked_')) {
    notice = {
      kind: 'revoked',
      removed_role: String(row.role_notice_kind).slice('revoked_'.length),
      current_role: assigned,
      at: row.role_notice_at || null,
      support_email: SUPPORT_EMAIL_ADDRESS
    };
  }

  return {
    platform_role: getEffectivePlatformRole(row),
    assigned_platform_role: assigned,
    role_acceptance: pending
      ? { pending: true, role: assigned, version: ROLE_NOTICE_VERSIONS[assigned] }
      : null,
    role_notice: notice
  };
}

// Kullanıcı bildirisini okuyup kabul eder. UI zorlamaları (scroll/checkbox) yalnızca
// kullanıcı deneyimidir; asıl doğrulama burada: gerçekten bekleyen kabul, sürüm
// eşleşmesi, accepted ve scrolled_to_end alanlarının kesin true olması. Bu bir
// hukuki "okuma kanıtı" DEĞİLDİR; yalnızca istemci akışının kaydıdır.
const acceptPlatformRoleTx = db.transaction((userId, version) => {
  const user = db.prepare(`
    SELECT id, platform_role, role_acceptance_pending FROM users WHERE id = ?
  `).get(userId);

  if (!user || user.platform_role === 'founder' || !isOfficialRole(user.platform_role) || !user.role_acceptance_pending) {
    throw new AdminActionError(409, 'Kabul bekleyen bir görev bildirimi yok.');
  }
  if (version !== ROLE_NOTICE_VERSIONS[user.platform_role]) {
    throw new AdminActionError(409, 'Bildirim sürümü güncel değil. Sayfayı yenileyip tekrar dene.');
  }

  db.prepare(`
    UPDATE users
    SET role_acceptance_pending = 0, role_acceptance_version = ?, role_accepted_role = platform_role,
        role_accepted_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(version, userId);

  // Görev bildirimi artık geçersiz: sistem bildirimini kendisi temizler.
  deleteStalePlatformNotices(userId);

  // Tam bildirim metni audit'e kopyalanmaz; yalnızca rol (old_value) ve sürüm (new_value).
  writeAuditLog({
    actorUserId: userId,
    action: 'platform_role_accepted',
    targetUserId: userId,
    reason: null,
    oldValue: user.platform_role,
    newValue: version
  });

  // Moderasyon ekibine kısa bilgilendirme e-postası (outbox; gönderim transaction'a bağlı değildir).
  const outboxId = enqueueRoleNoticeEmail({
    userId, type: 'team_accepted', role: user.platform_role, version, payload: { result_role: user.platform_role }
  });

  return { role: user.platform_role, version, outbox_id: outboxId };
});

// Görevi REDDETME: kabul beklemeyen bir görev reddedilemez. Rol, reddedilen görevden
// bir kademe aşağıdaki VE kullanıcının kabul edilmiş taban yetkisini aşmayan role döner:
//   user -> moderator/admin reddi => user;  moderator -> admin reddi => moderator;
//   admin -> moderator (düşürme) reddi => user (kullanıcı görevi hiç istemiyor).
// Reddetmek için metnin sonuna kadar okumak gerekmez.
const ROLE_ONE_BELOW = { moderator: 'user', admin: 'moderator' };

const declinePlatformRoleTx = db.transaction((userId, version) => {
  const user = db.prepare(`
    SELECT id, platform_role, role_acceptance_pending, role_accepted_role FROM users WHERE id = ?
  `).get(userId);

  if (!user || user.platform_role === 'founder' || !isOfficialRole(user.platform_role) || !user.role_acceptance_pending) {
    throw new AdminActionError(409, 'Reddedilecek bekleyen bir görev bildirimi yok.');
  }
  if (version !== ROLE_NOTICE_VERSIONS[user.platform_role]) {
    throw new AdminActionError(409, 'Bildirim sürümü güncel değil. Sayfayı yenileyip tekrar dene.');
  }

  const declined = user.platform_role;
  const base = PLATFORM_ROLES.includes(user.role_accepted_role) && user.role_accepted_role !== 'founder'
    ? user.role_accepted_role
    : 'user';
  const below = ROLE_ONE_BELOW[declined];
  const result = PLATFORM_ROLE_RANK[base] <= PLATFORM_ROLE_RANK[below] ? base : below;

  db.prepare(`
    UPDATE users
    SET platform_role = ?, role_acceptance_pending = 0, role_acceptance_version = NULL, role_accepted_role = ?,
        role_accepted_at = CASE WHEN ? = 'user' THEN NULL ELSE role_accepted_at END,
        role_notice_kind = NULL, role_notice_at = NULL
    WHERE id = ?
  `).run(result, result, result, userId);

  // Görev bildirimi artık geçersiz: sistem kendi bildirimini temizler.
  deleteStalePlatformNotices(userId);

  writeAuditLog({
    actorUserId: userId,
    action: 'platform_role_declined',
    targetUserId: userId,
    reason: `result_role=${result}`,
    oldValue: declined,
    newValue: version
  });

  const outboxId = enqueueRoleNoticeEmail({
    userId, type: 'team_declined', role: declined, version, payload: { result_role: result }
  });

  return { role: declined, version, result_role: result, outbox_id: outboxId };
});

function declinePlatformRole(userId, { version } = {}) {
  if (typeof version !== 'string' || !version) {
    return { success: false, status: 400, error: 'Bildirim sürümü gerekli.' };
  }

  try {
    return { success: true, ...declinePlatformRoleTx(userId, version) };
  } catch (error) {
    if (error instanceof AdminActionError) {
      return { success: false, status: error.status, error: error.message };
    }
    throw error;
  }
}

function acceptPlatformRole(userId, { version, scrolledToEnd, accepted } = {}) {
  if (accepted !== true || scrolledToEnd !== true) {
    return { success: false, status: 400, error: 'Görev bildirimini sonuna kadar okuyup onay kutusunu işaretlemelisin.' };
  }
  if (typeof version !== 'string' || !version) {
    return { success: false, status: 400, error: 'Bildirim sürümü gerekli.' };
  }

  try {
    return { success: true, ...acceptPlatformRoleTx(userId, version) };
  } catch (error) {
    if (error instanceof AdminActionError) {
      return { success: false, status: error.status, error: error.message };
    }
    throw error;
  }
}

function markRoleNoticeSeen(userId) {
  db.prepare(`
    UPDATE users SET role_notice_kind = NULL, role_notice_at = NULL WHERE id = ? AND role_notice_kind IS NOT NULL
  `).run(userId);
}

// ---- E-posta outbox ----
// Rol değişikliği transaction'ı e-posta gönderimine BAĞLI DEĞİLDİR: satır transaction
// içinde yazılır, gönderim sonradan yapılır; başarısız gönderimler kaybolmaz.
// Aynı satırın iki kez gönderilmemesi için satır atomik olarak 'pending' -> 'sending'
// durumuna alınır (koşullu UPDATE). Bir süreç gönderim sırasında çökerse takılı
// kalan 'sending' satırları belirli süre sonra tekrar kuyruğa alınır; bu istisnai
// durumda aynı e-posta nadiren iki kez gidebilir (at-least-once).
const ROLE_EMAIL_MAX_ATTEMPTS = 8;
const ROLE_EMAIL_STALE_MINUTES = 10;

function enqueueRoleNoticeEmail({ userId, type, role, version, payload }) {
  const info = db.prepare(`
    INSERT INTO role_notice_email_outbox (user_id, type, role, version, payload)
    VALUES (?, ?, ?, ?, ?)
  `).run(userId, type, role, version || null, payload ? JSON.stringify(payload) : null);
  return info.lastInsertRowid;
}

const claimRoleNoticeEmailTx = db.transaction(() => {
  const row = db.prepare(`
    SELECT * FROM role_notice_email_outbox
    WHERE status = 'pending' AND attempts < ? AND (next_attempt_at IS NULL OR next_attempt_at <= datetime('now'))
    ORDER BY id LIMIT 1
  `).get(ROLE_EMAIL_MAX_ATTEMPTS);
  if (!row) return null;

  const info = db.prepare(`
    UPDATE role_notice_email_outbox
    SET status = 'sending', attempts = attempts + 1, claimed_at = CURRENT_TIMESTAMP
    WHERE id = ? AND status = 'pending'
  `).run(row.id);
  if (info.changes !== 1) return null;

  return { ...row, attempts: row.attempts + 1, payload: row.payload ? JSON.parse(row.payload) : null };
});

function claimNextRoleNoticeEmail() {
  return claimRoleNoticeEmailTx();
}

function getRoleNoticeEmailTarget(userId) {
  return db.prepare(`SELECT id, username, email, platform_role, account_status FROM users WHERE id = ?`).get(userId);
}

function markRoleNoticeEmailSent(id) {
  db.prepare(`
    UPDATE role_notice_email_outbox SET status = 'sent', sent_at = CURRENT_TIMESTAMP, last_error = NULL
    WHERE id = ? AND status = 'sending'
  `).run(id);
}

function markRoleNoticeEmailSkipped(id, reason) {
  db.prepare(`
    UPDATE role_notice_email_outbox SET status = 'skipped', last_error = ? WHERE id = ? AND status = 'sending'
  `).run(String(reason || '').slice(0, 300), id);
}

function markRoleNoticeEmailFailed(id, error) {
  const row = db.prepare(`SELECT attempts FROM role_notice_email_outbox WHERE id = ?`).get(id);
  if (!row) return;

  const message = String(error?.message || error || 'bilinmeyen hata').slice(0, 300);
  if (row.attempts >= ROLE_EMAIL_MAX_ATTEMPTS) {
    db.prepare(`
      UPDATE role_notice_email_outbox SET status = 'failed', last_error = ? WHERE id = ? AND status = 'sending'
    `).run(message, id);
    return;
  }

  const backoffSeconds = Math.min(60 * 2 ** (row.attempts - 1), 3600);
  db.prepare(`
    UPDATE role_notice_email_outbox
    SET status = 'pending', last_error = ?, next_attempt_at = datetime('now', ?)
    WHERE id = ? AND status = 'sending'
  `).run(message, `+${backoffSeconds} seconds`, id);
}

function recoverStaleRoleNoticeEmails() {
  return db.prepare(`
    UPDATE role_notice_email_outbox SET status = 'pending'
    WHERE status = 'sending' AND claimed_at <= datetime('now', ?)
  `).run(`-${ROLE_EMAIL_STALE_MINUTES} minutes`).changes;
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

// Moderatörlerin bir kullanıcı profili raporunu incelerken hesaba dair yeterli bilgiye
// erişebilmesi için — normal /api/users/:id/profile herkese açık alanları döndürür,
// bu ise sadece requirePlatformRole('moderator') arkasında kullanılan ayrı bir görünüm.
function getModerationUserDetail(userId) {
  const user = db.prepare(`
    SELECT id, username, email, created_at, birth_date, platform_role, status, about_me, avatar_data
    FROM users WHERE id = ?
  `).get(userId);

  if (!user) return null;

  const reportsAgainst = db.prepare(`
    SELECT COUNT(*) AS count FROM reports WHERE target_type = 'user' AND target_id = ?
  `).get(userId).count;

  const reportsFiled = db.prepare(`
    SELECT COUNT(*) AS count FROM reports WHERE reporter_user_id = ?
  `).get(userId).count;

  const hubsOwned = db.prepare(`SELECT COUNT(*) AS count FROM hubs WHERE created_by = ?`).get(userId).count;
  const hubsMember = db.prepare(`SELECT COUNT(*) AS count FROM hub_members WHERE user_id = ?`).get(userId).count;
  const messageCount = db.prepare(`SELECT COUNT(*) AS count FROM messages WHERE user_id = ?`).get(userId).count;

  return {
    ...user,
    stats: { reportsAgainst, reportsFiled, hubsOwned, hubsMember, messageCount }
  };
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
    FROM reports LEFT JOIN users ON users.id = reports.reporter_user_id
    WHERE reports.id = ?
  `).get(reportId);

  if (!report) return null;

  const detail = {
    ...report,
    target_context: getReportTargetContext(report.target_type, report.target_id),
    history: listModerationHistory(reportId)
  };

  if (report.target_type === 'message') detail.evidence = getReportEvidence(report, detail.target_context);

  return detail;
}

// Moderasyon paneli için kanıt (YALNIZCA moderasyon uçlarından döner). Panelde ayrı ayrı gösterilebilmesi için durumlar:
//   state         : 'captured' (kanıt var) | 'expired' (saklama süresi doldu, imha edildi) | 'none' (bu özellikten önceki rapor)
//   message_state : 'available' | 'edited' | 'deleted' (kullanıcı sildi) | 'hub_removed' (lobi silindi)
//                   | 'chat_cleared' (lobi sohbeti temizlendi) | 'removed' (mesaj başka nedenle yok: ör. hesap silme)
//   flags         : sender_account_deleted / recipient_account_deleted / reporter_account_deleted / hub_removed
//   media_state   : 'none' | 'available' | 'purged' (retention doldu) | 'too_large' (kopyalanmadı)
function getReportEvidence(report, liveContext) {
  const row = db.prepare(`SELECT * FROM report_evidence WHERE report_id = ?`).get(report.id);
  if (!row) return { state: report.evidence_status === 'expired' ? 'expired' : 'none' };

  let payload = null;
  if (row.payload) { try { payload = JSON.parse(row.payload); } catch (_) { payload = null; } }

  let mediaState = 'none';
  const media = row.media_status === 'stored'
    ? db.prepare(`SELECT field, data, mime, sha256, retention_until FROM report_evidence_media WHERE evidence_id = ?`).get(row.id)
    : null;
  if (media) {
    payload = { ...(payload || {}), [media.field]: media.data };
    mediaState = 'available';
  } else if (row.media_status === 'purged') mediaState = 'purged';
  else if (row.media_status === 'too_large') mediaState = 'too_large';
  else if (row.media_status === 'stored') mediaState = 'purged';

  const hubRemoved = row.context_type === 'hub' && !db.prepare(`SELECT 1 FROM hubs WHERE id = ?`).get(row.hub_id);

  let messageState = 'available';
  if (!liveContext || !liveContext.exists) {
    messageState = hubRemoved ? 'hub_removed' : (row.context_type === 'hub' && !row.sender_account_deleted ? 'chat_cleared' : 'removed');
  } else if (liveContext.kind === 'deleted') messageState = 'deleted';
  else if (liveContext.content !== row.content) messageState = 'edited';

  return {
    state: 'captured',
    message_state: messageState,
    flags: {
      sender_account_deleted: Boolean(row.sender_account_deleted),
      recipient_account_deleted: Boolean(row.recipient_account_deleted),
      reporter_account_deleted: Boolean(report.reporter_account_deleted),
      hub_removed: hubRemoved
    },
    media_state: mediaState,
    captured_at: row.captured_at,
    retention_until: row.retention_until,
    media_retention_until: media ? media.retention_until : null,
    report_retention_until: report.retention_until,
    integrity_sha256: row.integrity_sha256,
    message_id: row.message_id,
    sender_username: row.sender_id ? (db.prepare(`SELECT username FROM users WHERE id = ?`).get(row.sender_id)?.username || null) : null, // canlı çözüm; kopya değil
    kind: row.kind,
    content: row.content,
    payload,
    was_edited_before_report: Boolean(row.was_edited),
    message_created_at: row.message_created_at,
    context: row.context_type === 'hub'
      ? { type: 'hub', hub_id: row.hub_id, hub_name: row.hub_name }
      : { type: 'dm' }
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
      INSERT INTO users (username, email, password_hash, password_salt, birth_date, avatar_visibility, terms_accepted_at, dev_notice_new)
      VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, 1)
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
      is_minor: minor,
      dev_notice: 'new'
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
             about_me, status, avatar_visibility, avatar_data, banner_data,
             platform_role, dev_notice_seen, dev_notice_new, account_status, suspension_user_reason,
             role_acceptance_pending, role_accepted_role, role_notice_kind, role_notice_at
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

    // Askı durumu YALNIZCA kimlik doğrulandıktan sonra bildirilir; böylece bir hesabın
    // askıda olduğu şifre tahmin edilerek öğrenilemez.
    if (user.account_status === 'suspended') {
      return { success: false, suspended: true, user_reason: user.suspension_user_reason || null };
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
      banner_data: user.banner_data,
      ...platformRoleFields(user),
      dev_notice: devNoticeFor(user.dev_notice_seen, user.dev_notice_new)
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
    ? db.prepare(`SELECT role_id, permission_tier, muted FROM hub_members WHERE hub_id = ? AND user_id = ?`).get(hubId, userId)
    : null;

  return {
    ...hub,
    roles,
    members,
    is_member: Boolean(membership),
    is_owner: hub.created_by === userId,
    my_role_id: membership ? membership.role_id : null,
    my_permission_tier: membership ? membership.permission_tier : null,
    my_muted: membership ? Boolean(membership.muted) : false
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

// Kullanıcının kendi tercihi olarak bir Lobi'nin mesaj bildirimlerini
// açıp/kapatması — sadece kendi hub_members satırını etkiler.
function setHubMuted(hubId, userId, muted) {
  if (!isHubMember(hubId, userId)) return { success: false, error: 'Bu Lobi\'nin üyesi değilsin.' };
  db.prepare(`UPDATE hub_members SET muted = ? WHERE hub_id = ? AND user_id = ?`).run(muted ? 1 : 0, hubId, userId);
  return { success: true, muted: Boolean(muted) };
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

function getHubMessages(hubId, limit = 50, viewerId = null) {
  const rows = db.prepare(`
    SELECT messages.id, messages.user_id, messages.username, messages.content, messages.kind,
           messages.payload, messages.edited, messages.created_at, users.avatar_data,
           messages.reply_to_message_id, messages.pinned_at, messages.pinned_by, messages.forwarded_from_message_id
    FROM messages LEFT JOIN users ON users.id = messages.user_id
    WHERE hub_id = ?
    ORDER BY messages.id DESC LIMIT ?
  `).all(hubId, limit);

  return rows.reverse().map((row) => hydrateMessage(row, viewerId));
}

function getMessageById(id, viewerId = null) {
  return hydrateMessage(db.prepare(`
    SELECT messages.id, messages.user_id, messages.username, messages.content, messages.to_user_id,
           messages.kind, messages.payload, messages.edited, messages.created_at, users.avatar_data,
           messages.reply_to_message_id, messages.pinned_at, messages.pinned_by, messages.forwarded_from_message_id
    FROM messages LEFT JOIN users ON users.id = messages.user_id
    WHERE messages.id = ?
  `).get(id), viewerId);
}

// Yanıtlanan mesajın küçük bir önizlemesini (gönderen + kısa metin) döndürür —
// tam mesaj metnini kopyalayıp sahte alıntı oluşturmak yerine gerçek message ID
// ilişkisi (reply_to_message_id) üzerinden anlık okunuyor.
function getReplyPreview(messageId) {
  const parent = db.prepare(`SELECT id, username, content, kind FROM messages WHERE id = ?`).get(messageId);
  if (!parent) return null;

  if (parent.kind === 'deleted') {
    return { id: parent.id, username: parent.username, preview: null, kind: 'deleted' };
  }

  const preview = parent.content
    ? parent.content.slice(0, 80)
    : describeMessageKindLabel(parent.kind, parent.content, null);

  return { id: parent.id, username: parent.username, preview, kind: parent.kind };
}

function hydrateMessage(row, viewerId = null) {
  if (!row) return row;

  let result = row;

  if (row.kind === 'poll' && row.payload) {
    const payload = JSON.parse(row.payload);
    const votes = db.prepare(`
      SELECT option_index, COUNT(*) AS c FROM hub_poll_votes WHERE message_id = ? GROUP BY option_index
    `).all(row.id);

    const counts = payload.options.map((_, i) => {
      const found = votes.find(v => v.option_index === i);
      return found ? found.c : 0;
    });

    result = { ...row, payload: { ...payload, counts } };
  } else if (row.payload) {
    result = { ...row, payload: JSON.parse(row.payload) };
  }

  if (result.reply_to_message_id) {
    result = { ...result, reply_to: getReplyPreview(result.reply_to_message_id) };
  }

  result = { ...result, reactions: getMessageReactions(result.id, viewerId) };

  return result;
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

function saveHubMessage(hubId, userId, username, content, replyToMessageId = null) {
  // Yanıtlanan mesaj aynı Hub'a ait değilse (ör. silinmiş/başka Hub) sessizce
  // yok sayılır — mesaj yine de gönderilir, sadece yanıt bağlantısı kurulmaz.
  let validReplyId = null;
  if (replyToMessageId) {
    const parent = db.prepare(`SELECT id FROM messages WHERE id = ? AND hub_id = ?`).get(replyToMessageId, hubId);
    if (parent) validReplyId = parent.id;
  }

  const info = db.prepare(`
    INSERT INTO messages (user_id, username, content, room, hub_id, kind, reply_to_message_id)
    VALUES (?, ?, ?, ?, ?, 'text', ?)
  `).run(userId, username, content, `hub_${hubId}`, hubId, validReplyId);

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

const STICKERS = [
  'wave', 'thumbsup', 'heart', 'laugh', 'cry', 'fire', 'clap', 'party',
  'shock', 'love-eyes', 'thinking', 'sleep', 'cool', 'wink', 'ok', 'pray'
];

const STICKER_EMOJIS = {
  wave: '👋', thumbsup: '👍', heart: '❤️', laugh: '😂', cry: '😭', fire: '🔥',
  clap: '👏', party: '🎉', shock: '😱', 'love-eyes': '😍', thinking: '🤔',
  sleep: '😴', cool: '😎', wink: '😉', ok: '👌', pray: '🙏'
};

function stickerEmoji(id) {
  return STICKER_EMOJIS[id] || '❔';
}

function createHubSticker(hubId, userId, username, stickerId) {
  if (!STICKERS.includes(stickerId)) {
    return { success: false, error: 'Geçersiz çıkartma.' };
  }

  const payload = JSON.stringify({ id: stickerId });

  const info = db.prepare(`
    INSERT INTO messages (user_id, username, content, room, hub_id, kind, payload)
    VALUES (?, ?, '', ?, ?, 'sticker', ?)
  `).run(userId, username, `hub_${hubId}`, hubId, payload);

  return { success: true, message: getMessageById(info.lastInsertRowid) };
}

function saveDmSticker(fromId, fromUsername, toId, stickerId) {
  if (!areFriends(fromId, toId)) {
    return { success: false, error: 'Sadece arkadaşlarınla mesajlaşabilirsin.' };
  }

  // Askıdaki hesaba YENİ mesaj gönderilemez (mevcut DM geçmişi olduğu gibi durur).
  if (isAccountSuspended(toId)) return { success: false, error: DM_UNAVAILABLE_ERROR };

  if (!STICKERS.includes(stickerId)) {
    return { success: false, error: 'Geçersiz çıkartma.' };
  }

  const payload = JSON.stringify({ id: stickerId });

  const info = db.prepare(`
    INSERT INTO messages (user_id, username, content, room, to_user_id, kind, payload)
    VALUES (?, ?, '', ?, ?, 'dm_sticker', ?)
  `).run(fromId, fromUsername, dmRoom(fromId, toId), toId, payload);

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

// Sesli oda limitleri — ileride değiştirmek için tek yer burası.
const MAX_VOICE_ROOM_PARTICIPANTS = 25;
const MAX_VOICE_ROOMS_PER_HUB = 5;

function createVoiceRoom(hubId, userId, name) {
  const hub = db.prepare(`SELECT created_by FROM hubs WHERE id = ?`).get(hubId);
  if (!hub) return { success: false, error: 'Hub bulunamadı.' };
  if (hub.created_by !== userId) return { success: false, error: 'Yalnızca Hub sahibi sesli oda açabilir.' };

  name = String(name || '').trim().slice(0, 40);
  if (!name) return { success: false, error: 'Oda adı gerekli.' };

  const roomCount = db.prepare(`SELECT COUNT(*) AS count FROM hub_voice_rooms WHERE hub_id = ?`).get(hubId).count;
  if (roomCount >= MAX_VOICE_ROOMS_PER_HUB) {
    return { success: false, error: `Bir lobide en fazla ${MAX_VOICE_ROOMS_PER_HUB} sesli oda olabilir.` };
  }

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

// Lobi sohbetini tamamen temizler. Yalnızca Hub sahibi ve lobi moderatörleri.
// Tepkiler ve anket oyları messages'a bağlı ON DELETE CASCADE ile birlikte silinir.
function clearHubMessages(hubId, userId) {
  if (!hasAtLeastTier(hubId, userId, 'moderator')) {
    return { success: false, error: 'Bu işlem için yetkin yok.' };
  }

  const info = db.prepare(`DELETE FROM messages WHERE hub_id = ?`).run(hubId);
  return { success: true, deleted: info.changes };
}

// ---- Daily.co oda temizlik kuyruğu ------------------------------------------------------------------------------------
// Lobi silinirken DB temizliği tek transaction'da yapılır; Daily (üçüncü taraf) çağrısı o transaction'a KATILMAZ. Silinecek Daily
// oda adları aynı transaction içinde bu kuyruğa yazılır (DB kalıcıdır); silme işlemi transaction'dan sonra yapılır ve başarısız olursa
// üstel geri çekilmeyle yeniden denenir (açılışta ve periyodik). Kuyrukta kişisel veri yoktur (yalnızca oda adı + deneme bilgisi).
db.exec(`
  CREATE TABLE IF NOT EXISTS daily_room_cleanup (
    room_name TEXT PRIMARY KEY,
    attempts INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    next_attempt_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

const isoNoMs = (ms) => new Date(ms).toISOString().replace(/\.\d+Z$/, 'Z');

function listDueDailyRoomCleanups(limit = 20) {
  return db.prepare(`
    SELECT room_name, attempts FROM daily_room_cleanup WHERE next_attempt_at <= ? ORDER BY created_at LIMIT ?
  `).all(isoNoMs(Date.now()), limit);
}

function completeDailyRoomCleanup(roomName) {
  db.prepare(`DELETE FROM daily_room_cleanup WHERE room_name = ?`).run(roomName);
}

function failDailyRoomCleanup(roomName, message) {
  const row = db.prepare(`SELECT attempts FROM daily_room_cleanup WHERE room_name = ?`).get(roomName);
  const attempts = (row ? row.attempts : 0) + 1;
  const backoffMs = Math.min(6 * 60 * 60 * 1000, Math.pow(2, Math.min(attempts, 12)) * 60 * 1000); // 2 dk ... en çok 6 saat
  db.prepare(`
    UPDATE daily_room_cleanup SET attempts = ?, last_error = ?, next_attempt_at = ? WHERE room_name = ?
  `).run(attempts, String(message || '').slice(0, 200), isoNoMs(Date.now() + backoffMs), roomName);
}

// Bir lobiye bağlı TÜM veriyi siler (yetki kontrolü YOK; çağıran yetkiyi doğrular). Ayrı bir transaction başlatmaz:
// çağıran (deleteHub / deleteAccount) transaction içinde çalıştırır, böylece kısmi silme olmaz.
// Dokunmadıkları: rapor kanıtları (report_evidence / report_evidence_media mesajlardan bağımsızdır), başka lobiler, DM'ler.
function purgeHubData(hubId) {
  const hub = db.prepare(`SELECT daily_room_name FROM hubs WHERE id = ?`).get(hubId);
  const voiceRooms = db.prepare(`SELECT id, daily_room_name FROM hub_voice_rooms WHERE hub_id = ?`).all(hubId);
  const dailyRoomNames = [hub && hub.daily_room_name, ...voiceRooms.map(r => r.daily_room_name)].filter(Boolean);

  const enqueue = db.prepare(`INSERT OR IGNORE INTO daily_room_cleanup (room_name) VALUES (?)`);
  dailyRoomNames.forEach(name => enqueue.run(name));

  db.prepare(`DELETE FROM hub_poll_votes WHERE message_id IN (SELECT id FROM messages WHERE hub_id = ?)`).run(hubId);
  db.prepare(`DELETE FROM message_reactions WHERE message_id IN (SELECT id FROM messages WHERE hub_id = ?)`).run(hubId);
  db.prepare(`DELETE FROM messages WHERE hub_id = ?`).run(hubId);
  db.prepare(`DELETE FROM hub_invites WHERE hub_id = ?`).run(hubId);
  db.prepare(`DELETE FROM hub_bans WHERE hub_id = ?`).run(hubId);
  db.prepare(`DELETE FROM hub_voice_rooms WHERE hub_id = ?`).run(hubId);
  db.prepare(`DELETE FROM hub_members WHERE hub_id = ?`).run(hubId);
  db.prepare(`DELETE FROM hub_roles WHERE hub_id = ?`).run(hubId);
  db.prepare(`DELETE FROM hubs WHERE id = ?`).run(hubId);

  return { hubId, voiceRoomIds: voiceRooms.map(r => r.id), dailyRoomNames };
}

function deleteHub(hubId, userId) {
  const hub = db.prepare(`SELECT created_by FROM hubs WHERE id = ?`).get(hubId);
  if (!hub) return { success: false, error: 'Hub bulunamadı.' };
  if (hub.created_by !== userId) return { success: false, error: 'Yalnızca Hub sahibi silebilir.' };

  const purged = db.transaction(() => purgeHubData(hubId))();

  return { success: true, hub_id: purged.hubId, voice_room_ids: purged.voiceRoomIds, daily_room_names: purged.dailyRoomNames };
}

// Hesap silme: TEK transaction. Herhangi bir adım başarısız olursa hepsi geri alınır (yarım silinmiş hesap kalmaz).
// Raporlanan mesajların kanıtları silinmez: rapor/kanıt kayıtlarının yalnızca bu hesapla bağlantısı koparılır (retention aynen sürer).
// Sahip olunan lobiler deleteHub ile aynı temizlik yolundan (purgeHubData) silinir. Üçüncü taraf çağrıları (Daily) transaction DIŞINDADIR:
// silinecek oda adları kuyruğa yazılır, çağıran transaction'dan sonra işler.
function deleteAccount(userId) {
  const run = db.transaction(() => {
    unlinkReportDataForDeletedUser(userId);

    const owned = db.prepare(`SELECT id FROM hubs WHERE created_by = ?`).all(userId);
    const purgedHubs = owned.map(h => purgeHubData(h.id));

    db.prepare(`DELETE FROM messages WHERE user_id = ? OR to_user_id = ?`).run(userId, userId);
    db.prepare(`DELETE FROM friendships WHERE user_low = ? OR user_high = ?`).run(userId, userId);
    db.prepare(`DELETE FROM blocked_users WHERE user_id = ? OR blocked_user_id = ?`).run(userId, userId);
    db.prepare(`DELETE FROM notifications WHERE user_id = ?`).run(userId);
    db.prepare(`DELETE FROM hub_members WHERE user_id = ?`).run(userId);
    db.prepare(`DELETE FROM sessions WHERE user_id = ?`).run(userId);

    const info = db.prepare(`DELETE FROM users WHERE id = ?`).run(userId);
    if (info.changes !== 1) throw new Error('Hesap silinemedi (kullanıcı satırı silinmedi).');

    return purgedHubs;
  });

  const purgedHubs = run();

  return {
    success: true,
    hub_ids: purgedHubs.map(h => h.hubId),
    voice_room_ids: purgedHubs.flatMap(h => h.voiceRoomIds),
    daily_room_names: purgedHubs.flatMap(h => h.dailyRoomNames)
  };
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

// Yanıt/eylem bekleyen bildirim türleri: bekledikleri sürece "okundu" yapılamaz ve silinemez.
const ACTIONABLE_NOTIFICATION_TYPES = ['friend_request', 'hub_invite', 'platform_role_notice'];
const ACTIONABLE_SQL = ACTIONABLE_NOTIFICATION_TYPES.map(t => `'${t}'`).join(',');

function listNotifications(userId) {
  cleanupStalePlatformNotices(userId);

  const rows = db.prepare(`
    SELECT id, type, data, status, created_at FROM notifications
    WHERE user_id = ? AND status IN ('pending', 'seen')
    ORDER BY created_at DESC, id DESC
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
// "Okundu": bildirim listede KALIR ('seen'), silinmez. Eski 'read' değeri geçmişte
// "kapatılmış" anlamındaydı ve listelenmez; bu yüzden yeni durum ayrı bir değerdir.
function markNotificationRead(notificationId, userId) {
  const info = db.prepare(`
    UPDATE notifications SET status = 'seen'
    WHERE id = ? AND user_id = ? AND status = 'pending' AND type NOT IN (${ACTIONABLE_SQL})
  `).run(notificationId, userId);

  if (!info.changes) return { success: false, error: 'Bildirim bulunamadı.' };
  return { success: true };
}

function markAllNotificationsRead(userId) {
  const info = db.prepare(`
    UPDATE notifications SET status = 'seen'
    WHERE user_id = ? AND status = 'pending' AND type NOT IN (${ACTIONABLE_SQL})
  `).run(userId);
  return { success: true, updated: info.changes };
}

// Bildirimleri YALNIZCA kullanıcı siler (sistem bildirimleri ayrıca sistem tarafından temizlenebilir).
// Yanıt bekleyen (arkadaşlık isteği, lobi daveti, kabul bekleyen görev) bildirimler silinemez.
function deleteNotification(notificationId, userId) {
  const info = db.prepare(`
    DELETE FROM notifications
    WHERE id = ? AND user_id = ? AND status IN ('pending', 'seen')
      AND NOT (status = 'pending' AND type IN (${ACTIONABLE_SQL}))
  `).run(notificationId, userId);

  if (!info.changes) return { success: false, error: 'Bildirim silinemedi.' };
  return { success: true };
}

function clearNotifications(userId) {
  const info = db.prepare(`
    DELETE FROM notifications
    WHERE user_id = ? AND status IN ('pending', 'seen')
      AND NOT (status = 'pending' AND type IN (${ACTIONABLE_SQL}))
  `).run(userId);
  return { success: true, deleted: info.changes };
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

  // Mesaj raporunda kanıt alınacak mesaj gerçekten var, silinmemiş ve raporlayan tarafından görülebilir olmalı.
  let evidenceMessage = null;
  if (target_type === 'message') {
    evidenceMessage = db.prepare(`
      SELECT id, user_id, username, content, kind, payload, hub_id, to_user_id, edited, created_at
      FROM messages WHERE id = ?
    `).get(targetId);

    if (!evidenceMessage || evidenceMessage.kind === 'deleted') {
      return { success: false, error: 'Bu mesaj artık mevcut değil.' };
    }

    const canSee = evidenceMessage.hub_id
      ? isHubMember(evidenceMessage.hub_id, reporterId)
      : (evidenceMessage.user_id === reporterId || evidenceMessage.to_user_id === reporterId);

    if (!canSee) return { success: false, error: 'Bu mesajı bildirme yetkin yok.' };
    if (evidenceMessage.user_id === reporterId) return { success: false, error: 'Kendi mesajını bildiremezsin.' };
  }

  // Rapor ve kanıt tek transaction'da yazılır: kanıt alınamazsa rapor da oluşmaz (kanıtsız mesaj raporu olmaz).
  const retention = computeRetention('new', new Date().toISOString(), null);
  const insert = db.transaction(() => {
    const info = db.prepare(`
      INSERT INTO reports (reporter_user_id, target_type, target_id, reason, description, priority, retention_until, evidence_status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(reporterId, target_type, targetId, reason, String(description || '').trim().slice(0, 500), priorityForReason(reason),
      retention.record, evidenceMessage ? 'captured' : null);

    if (evidenceMessage) captureMessageEvidence(info.lastInsertRowid, evidenceMessage, retention);
    return info.lastInsertRowid;
  });

  return { success: true, id: insert() };
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
    FROM reports LEFT JOIN users ON users.id = reports.reporter_user_id
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
  if (kind === 'sticker' || kind === 'dm_sticker') return `${stickerEmoji(payload?.id)} Çıkartma`;
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
  refreshRetention(reportId);

  return { success: true };
}

// =====================================================
// VERİ İHRACI (KVKK md. 11 — erişim / taşınabilirlik hakkı)
// =====================================================

// "Verilerimi İndir": kullanıcının KENDİ verileri. Dahil edilmeyenler (bilerek): başkalarının kişisel verileri ve içerikleri (ör. alınan
// DM'lerin içeriği, lobi üyelerinin listesi), rapor kanıtları ve moderasyon iç kayıtları, bildirim listesi (başka kullanıcıların adlarını
// içerebilir) ve güvenlik sırları (parola özeti/tuzu, doğrulama ve sıfırlama kodları, oturum belirteci, push/FCM anahtarları).
const EXPORT_MEDIA_BUDGET_CHARS = 40 * 1024 * 1024; // toplam ek dosya verisi bunu aşarsa yalnızca metadata verilir

function getAccountExport(userId) {
  const profile = db.prepare(`
    SELECT id, username, email, about_me, status, avatar_visibility, birth_date,
           terms_accepted_at, created_at, avatar_data, banner_data
    FROM users WHERE id = ?
  `).get(userId);

  if (!profile) return null;

  const account = db.prepare(`
    SELECT platform_role, account_status, suspended_at, suspension_user_reason,
           role_acceptance_pending, role_acceptance_version, role_accepted_role, role_accepted_at
    FROM users WHERE id = ?
  `).get(userId);

  // Kullanıcının gönderdiği mesajlar (alınanlar hariç). Ek dosyalar (base64) mesaj metninden ayrılır; bütçe aşılırsa yalnızca metadata.
  let mediaBudget = EXPORT_MEDIA_BUDGET_CHARS;
  const messages = db.prepare(`
    SELECT messages.id, messages.content, messages.room, messages.hub_id, hubs.name AS hub_name, messages.to_user_id,
           messages.kind, messages.payload, messages.edited, messages.reply_to_message_id, messages.created_at
    FROM messages LEFT JOIN hubs ON hubs.id = messages.hub_id
    WHERE messages.user_id = ? ORDER BY messages.id
  `).all(userId).map((row) => {
    const { payload, ...message } = row;
    let light = null;
    let attachment = null;

    if (payload) {
      try { light = JSON.parse(payload); } catch (_) { light = null; }
      if (light && typeof light === 'object') {
        for (const field of MEDIA_FIELDS) {
          if (typeof light[field] === 'string' && light[field].startsWith('data:')) {
            const data = light[field];
            delete light[field];
            attachment = {
              field,
              mime: (/^data:([^;,]+)/.exec(data) || [])[1] || null,
              name: light.name || null,
              size_chars: data.length
            };
            if (data.length <= mediaBudget) { attachment.data = data; mediaBudget -= data.length; }
            else attachment.data_omitted = 'size_limit';
            break;
          }
        }
      }
    }

    return { ...message, payload: light, attachment };
  });

  const hubs = db.prepare(`
    SELECT hubs.id, hubs.name, hub_members.permission_tier, hub_members.joined_at,
           hub_members.muted, hub_roles.name AS role_name
    FROM hub_members
    INNER JOIN hubs ON hubs.id = hub_members.hub_id
    LEFT JOIN hub_roles ON hub_roles.id = hub_members.role_id
    WHERE hub_members.user_id = ?
  `).all(userId);

  // Kullanıcının oluşturduğu lobilere ait KENDİ verisi (ayarlar, roller, sesli odalar, davet istatistikleri). Üye listesi/ban listesi
  // başkalarının verisi olduğundan yalnızca sayı olarak verilir; davet kodları erişim sırrı olduğundan verilmez.
  const ownedHubs = db.prepare(`
    SELECT id, name, type, template, icon, description, image_data, created_at FROM hubs WHERE created_by = ?
  `).all(userId).map((hub) => ({
    ...hub,
    member_count: db.prepare(`SELECT COUNT(*) AS c FROM hub_members WHERE hub_id = ?`).get(hub.id).c,
    roles: db.prepare(`SELECT name, icon, slot_limit, position FROM hub_roles WHERE hub_id = ? ORDER BY position`).all(hub.id),
    voice_rooms: db.prepare(`SELECT name, created_at FROM hub_voice_rooms WHERE hub_id = ? ORDER BY id`).all(hub.id),
    invites: db.prepare(`SELECT created_at, max_uses, uses FROM hub_invites WHERE hub_id = ? ORDER BY id`).all(hub.id)
  }));

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
    SELECT target_type, target_id, reason, description, status, created_at FROM reports WHERE reporter_user_id = ?
  `).all(userId);

  // Yalnızca KENDİ tepkileri/oyları (hangi mesaja, ne): mesaj içeriği ya da başkalarının verisi yok.
  const reactions = db.prepare(`
    SELECT message_id, emoji, created_at FROM message_reactions WHERE user_id = ? ORDER BY id
  `).all(userId);

  const pollVotes = db.prepare(`
    SELECT hub_poll_votes.message_id, hub_poll_votes.option_index, messages.hub_id
    FROM hub_poll_votes LEFT JOIN messages ON messages.id = hub_poll_votes.message_id
    WHERE hub_poll_votes.user_id = ?
  `).all(userId);

  const feedback = db.prepare(`
    SELECT id, title, body, created_at FROM feedback WHERE user_id = ? ORDER BY id
  `).all(userId);

  const feedbackVotes = db.prepare(`
    SELECT feedback_id, created_at FROM feedback_votes WHERE user_id = ?
  `).all(userId);

  const notificationPreferences = db.prepare(`
    SELECT * FROM notification_preferences WHERE user_id = ?
  `).get(userId) || null;
  if (notificationPreferences) delete notificationPreferences.user_id;

  // Bildirim cihazları: yalnızca tür + cihaz bilgisi + kayıt zamanı. Uç nokta URL'si, anahtarlar ve FCM anahtarı GÜVENLİK SIRRIDIR, verilmez.
  const notificationDevices = [
    ...db.prepare(`SELECT user_agent, created_at FROM push_subscriptions WHERE user_id = ?`).all(userId).map(r => ({ type: 'web_push', ...r })),
    ...db.prepare(`SELECT user_agent, created_at FROM fcm_tokens WHERE user_id = ?`).all(userId).map(r => ({ type: 'android_fcm', ...r }))
  ];

  return {
    exported_at: new Date().toISOString(),
    profile,
    account,
    messages,
    hub_memberships: hubs,
    owned_hubs: ownedHubs,
    friendships,
    blocked_users: blocked,
    reactions,
    poll_votes: pollVotes,
    feedback,
    feedback_votes: feedbackVotes,
    notification_preferences: notificationPreferences,
    notification_devices: notificationDevices,
    sessions,
    reports_filed: reportsFiled,
    not_included: [
      'Başkalarından aldığın mesajların içeriği (yalnızca senin gönderdiklerin dahildir)',
      'Başka kullanıcıların kişisel verileri (lobi üyeleri, banlananlar vb.)',
      'Rapor kanıtları ve moderasyon/yönetim iç kayıtları',
      'Bildirim listesi (başka kullanıcıların adlarını içerebilir)',
      'Güvenlik sırları: parola özeti/tuzu, doğrulama ve sıfırlama kodları, oturum belirteci, push/FCM anahtarları, lobi davet kodları'
    ]
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

function saveDmMessage(fromId, fromUsername, toId, content, replyToMessageId = null) {
  if (!areFriends(fromId, toId)) {
    return { success: false, error: 'Sadece arkadaşlarınla mesajlaşabilirsin.' };
  }

  // Askıdaki hesaba YENİ mesaj gönderilemez (mevcut DM geçmişi olduğu gibi durur).
  if (isAccountSuspended(toId)) return { success: false, error: DM_UNAVAILABLE_ERROR };

  content = String(content || '').trim().slice(0, 500);
  if (!content) return { success: false, error: 'Boş mesaj gönderilemez.' };

  // Yanıtlanan mesaj bu iki kullanıcı arasındaki DM'e ait değilse (başka bir
  // konuşmadan sızdırılmış bir ID olabilir) sessizce yok sayılır.
  let validReplyId = null;
  if (replyToMessageId) {
    const parent = db.prepare(`SELECT id FROM messages WHERE id = ? AND room = ?`).get(replyToMessageId, dmRoom(fromId, toId));
    if (parent) validReplyId = parent.id;
  }

  const info = db.prepare(`
    INSERT INTO messages (user_id, username, content, room, to_user_id, kind, reply_to_message_id)
    VALUES (?, ?, ?, ?, ?, 'dm', ?)
  `).run(fromId, fromUsername, content, dmRoom(fromId, toId), toId, validReplyId);

  return {
    success: true,
    message: getMessageById(info.lastInsertRowid)
  };
}

function saveDmVoiceMessage(fromId, fromUsername, toId, audioData, duration) {
  if (!areFriends(fromId, toId)) {
    return { success: false, error: 'Sadece arkadaşlarınla mesajlaşabilirsin.' };
  }

  // Askıdaki hesaba YENİ mesaj gönderilemez (mevcut DM geçmişi olduğu gibi durur).
  if (isAccountSuspended(toId)) return { success: false, error: DM_UNAVAILABLE_ERROR };

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

  // Askıdaki hesaba YENİ mesaj gönderilemez (mevcut DM geçmişi olduğu gibi durur).
  if (isAccountSuspended(toId)) return { success: false, error: DM_UNAVAILABLE_ERROR };

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
           messages.kind, messages.payload, messages.edited, messages.created_at, users.avatar_data,
           messages.reply_to_message_id, messages.pinned_at, messages.pinned_by, messages.forwarded_from_message_id
    FROM messages LEFT JOIN users ON users.id = messages.user_id
    WHERE room = ?
    ORDER BY messages.id DESC LIMIT ?
  `).all(dmRoom(userId, otherUserId), limit);

  return rows.reverse().map((row) => hydrateMessage(row, userId));
}

// =====================================================
// v1.26 MIGRATION — MESAJ AKSİYONLARI (Reply / Reaction / Pin / Forward)
// =====================================================
// NOT: Edit/Delete/Report zaten mevcuttu (bkz. editMessage/deleteMessage,
// yukarıda), burada yeniden yazılmadı — sadece bu 4 yeni yeteneğin altyapısı
// ekleniyor. platform_role ile hub permission_tier burada da birbirine
// KARIŞTIRILMIYOR: pinMessage() sadece hasAtLeastTier() kullanıyor.

const messageColumnsV126 = db.prepare(`PRAGMA table_info(messages)`).all().map(c => c.name);

if (!messageColumnsV126.includes('reply_to_message_id')) {
  db.exec(`ALTER TABLE messages ADD COLUMN reply_to_message_id INTEGER`);
}
if (!messageColumnsV126.includes('pinned_at')) {
  db.exec(`ALTER TABLE messages ADD COLUMN pinned_at DATETIME`);
}
if (!messageColumnsV126.includes('pinned_by')) {
  db.exec(`ALTER TABLE messages ADD COLUMN pinned_by INTEGER`);
}
if (!messageColumnsV126.includes('forwarded_from_message_id')) {
  db.exec(`ALTER TABLE messages ADD COLUMN forwarded_from_message_id INTEGER`);
}

db.exec(`
  CREATE TABLE IF NOT EXISTS message_reactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    message_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    emoji TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(message_id, user_id, emoji),
    FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`);

const ALLOWED_REACTION_EMOJIS = ['❤️', '😂', '👍', '👎', '😮', '😢', '🔥'];

function getMessageReactions(messageId, viewerId) {
  const rows = db.prepare(`
    SELECT emoji, COUNT(*) AS count, SUM(CASE WHEN user_id = ? THEN 1 ELSE 0 END) AS mine
    FROM message_reactions WHERE message_id = ? GROUP BY emoji
  `).all(viewerId || 0, messageId);

  return rows.map(r => ({ emoji: r.emoji, count: r.count, reactedByMe: r.mine > 0 }));
}

// Bir mesaja erişimi olup olmadığını doğrular — Hub üyesi mi, ya da DM'in
// göndereni/alıcısı mı. Reaction/pin/forward hepsi bunu kullanıyor; başka bir
// kullanıcının hiç erişemediği bir message ID'sine işlem yapılamaz.
function getMessageAccessInfo(messageId, actorId) {
  const msg = db.prepare(`SELECT id, user_id, hub_id, to_user_id, kind FROM messages WHERE id = ?`).get(messageId);
  if (!msg) return { msg: null, hasAccess: false };

  if (msg.hub_id) {
    return { msg, hasAccess: isHubMember(msg.hub_id, actorId) };
  }
  if (msg.to_user_id) {
    return { msg, hasAccess: msg.user_id === actorId || msg.to_user_id === actorId };
  }
  return { msg, hasAccess: false };
}

function addReaction(messageId, userId, emoji) {
  if (!ALLOWED_REACTION_EMOJIS.includes(emoji)) return { success: false, error: 'Geçersiz emoji.' };

  const { msg, hasAccess } = getMessageAccessInfo(messageId, userId);
  if (!msg) return { success: false, error: 'Mesaj bulunamadı.' };
  if (!hasAccess) return { success: false, error: 'Bu mesaja erişimin yok.' };
  if (msg.kind === 'deleted') return { success: false, error: 'Silinmiş mesaja tepki eklenemez.' };

  db.prepare(`
    INSERT INTO message_reactions (message_id, user_id, emoji) VALUES (?, ?, ?)
    ON CONFLICT(message_id, user_id, emoji) DO NOTHING
  `).run(messageId, userId, emoji);

  return { success: true, hub_id: msg.hub_id, to_user_id: msg.to_user_id, reactions: getMessageReactions(messageId, userId) };
}

function removeReaction(messageId, userId, emoji) {
  const { msg, hasAccess } = getMessageAccessInfo(messageId, userId);
  if (!msg) return { success: false, error: 'Mesaj bulunamadı.' };
  if (!hasAccess) return { success: false, error: 'Bu mesaja erişimin yok.' };

  db.prepare(`DELETE FROM message_reactions WHERE message_id = ? AND user_id = ? AND emoji = ?`).run(messageId, userId, emoji);

  return { success: true, hub_id: msg.hub_id, to_user_id: msg.to_user_id, reactions: getMessageReactions(messageId, userId) };
}

// Sabitleme SADECE Hub yetkisi (hasAtLeastTier) üzerinden çalışır — platform_role
// (moderator/admin/founder) burada hiç kontrol edilmiyor, bilerek. Bir Hub'ın
// sahibi/moderatörü olmayan platform admini bile normal bir üye gibi davranır.
function pinMessage(messageId, userId) {
  const msg = db.prepare(`SELECT id, hub_id, kind FROM messages WHERE id = ?`).get(messageId);
  if (!msg) return { success: false, error: 'Mesaj bulunamadı.' };
  if (!msg.hub_id) return { success: false, error: 'Sadece Hub mesajları sabitlenebilir.' };
  if (!hasAtLeastTier(msg.hub_id, userId, 'moderator')) return { success: false, error: 'Bu işlem için Hub yetkin yok.' };
  if (msg.kind === 'deleted') return { success: false, error: 'Silinmiş mesaj sabitlenemez.' };

  db.prepare(`UPDATE messages SET pinned_at = CURRENT_TIMESTAMP, pinned_by = ? WHERE id = ?`).run(userId, messageId);

  return { success: true, hub_id: msg.hub_id, message: getMessageById(messageId, userId) };
}

function unpinMessage(messageId, userId) {
  const msg = db.prepare(`SELECT id, hub_id FROM messages WHERE id = ?`).get(messageId);
  if (!msg) return { success: false, error: 'Mesaj bulunamadı.' };
  if (!msg.hub_id) return { success: false, error: 'Sadece Hub mesajları sabitlenebilir.' };
  if (!hasAtLeastTier(msg.hub_id, userId, 'moderator')) return { success: false, error: 'Bu işlem için Hub yetkin yok.' };

  db.prepare(`UPDATE messages SET pinned_at = NULL, pinned_by = NULL WHERE id = ?`).run(messageId);

  return { success: true, hub_id: msg.hub_id, message: getMessageById(messageId, userId) };
}

// Forward v1: yalnızca arkadaşlar arasındaki DM'lere. Hub->Hub veya Hub->DM
// forwarding bilerek desteklenmiyor (bkz. AŞAMA D analiz notu) — ayrı bir
// sonraki aşamaya bırakıldı.
const FORWARD_KIND_MAP = {
  text: 'dm', dm: 'dm',
  voice: 'dm_voice', dm_voice: 'dm_voice',
  image: 'dm_image', dm_image: 'dm_image',
  video: 'dm_video', dm_video: 'dm_video',
  file: 'dm_file', dm_file: 'dm_file'
};

function forwardMessageToDm(messageId, fromUserId, fromUsername, toUserId) {
  const { msg: original, hasAccess } = getMessageAccessInfo(messageId, fromUserId);
  if (!original) return { success: false, error: 'Mesaj bulunamadı.' };
  if (!hasAccess) return { success: false, error: 'Bu mesaja erişimin yok.' };
  if (original.kind === 'deleted') return { success: false, error: 'Silinmiş mesaj iletilemez.' };

  const targetKind = FORWARD_KIND_MAP[original.kind];
  if (!targetKind) return { success: false, error: 'Bu mesaj türü iletilemez.' };

  if (!areFriends(fromUserId, toUserId)) return { success: false, error: 'Sadece arkadaşlarına iletebilirsin.' };
  if (isAccountSuspended(toUserId)) return { success: false, error: DM_UNAVAILABLE_ERROR };

  const fullOriginal = db.prepare(`SELECT content, payload FROM messages WHERE id = ?`).get(messageId);

  const info = db.prepare(`
    INSERT INTO messages (user_id, username, content, room, to_user_id, kind, payload, forwarded_from_message_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(fromUserId, fromUsername, fullOriginal.content || '', dmRoom(fromUserId, toUserId), toUserId, targetKind, fullOriginal.payload, messageId);

  return { success: true, message: getMessageById(info.lastInsertRowid, fromUserId) };
}

function createUser(username) {
  try {
    const info = db.prepare(`INSERT INTO users (username) VALUES (?)`).run(username);
    return info.lastInsertRowid;
  } catch {
    return null;
  }
}

// =====================================================
// WEB PUSH ABONELİKLERİ (cihaz başına bir kayıt)
// =====================================================

db.exec(`
  CREATE TABLE IF NOT EXISTS push_subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    endpoint TEXT NOT NULL UNIQUE,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    user_agent TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`);

const MAX_PUSH_SUBSCRIPTIONS_PER_USER = 10;

function getHubPushInfo(hubId) {
  const hub = db.prepare(`SELECT name FROM hubs WHERE id = ?`).get(hubId);
  if (!hub) return null;

  // "Bildirimleri Sustur" diyen üyeler (muted = 1) push almaz.
  const memberIds = db.prepare(`SELECT user_id FROM hub_members WHERE hub_id = ? AND muted = 0`).all(hubId).map(row => row.user_id);
  return { name: hub.name, member_ids: memberIds };
}

function savePushSubscription(userId, subscription, userAgent) {
  const endpoint = subscription?.endpoint;
  const p256dh = subscription?.keys?.p256dh;
  const auth = subscription?.keys?.auth;

  if (typeof endpoint !== 'string' || !/^https:\/\//.test(endpoint) || endpoint.length > 1000
      || typeof p256dh !== 'string' || typeof auth !== 'string' || !p256dh || !auth
      || p256dh.length > 200 || auth.length > 100) {
    return { success: false, error: 'Geçersiz bildirim aboneliği.' };
  }

  // Aynı cihaz başka bir hesapla giriş yaptıysa abonelik yeni hesaba geçer.
  db.prepare(`
    INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(endpoint) DO UPDATE SET user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth, user_agent = excluded.user_agent
  `).run(userId, endpoint, p256dh, auth, String(userAgent || '').slice(0, 300));

  db.prepare(`
    DELETE FROM push_subscriptions WHERE user_id = ? AND id NOT IN (
      SELECT id FROM push_subscriptions WHERE user_id = ? ORDER BY id DESC LIMIT ?
    )
  `).run(userId, userId, MAX_PUSH_SUBSCRIPTIONS_PER_USER);

  return { success: true };
}

function removePushSubscription(endpoint, userId) {
  if (userId) {
    db.prepare(`DELETE FROM push_subscriptions WHERE endpoint = ? AND user_id = ?`).run(endpoint, userId);
  } else {
    db.prepare(`DELETE FROM push_subscriptions WHERE endpoint = ?`).run(endpoint);
  }
}

function listPushSubscriptions(userId) {
  return db.prepare(`SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?`).all(userId);
}

// ---- Android uygulaması (FCM) cihaz anahtarları --------------------------------
// Web Push abonelikleriyle (push_subscriptions) AYRI tutulur; ikisi birbirini etkilemez.
db.exec(`
  CREATE TABLE IF NOT EXISTS fcm_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    token TEXT NOT NULL UNIQUE,
    user_agent TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_fcm_tokens_user ON fcm_tokens(user_id);
`);

const MAX_FCM_TOKENS_PER_USER = 10;

function saveFcmToken(userId, token, userAgent) {
  if (typeof token !== 'string' || token.length < 20 || token.length > 4096 || /\s/.test(token)) {
    return { success: false, error: 'Geçersiz cihaz anahtarı.' };
  }

  // Aynı cihaz başka bir hesapla giriş yaptıysa anahtar yeni hesaba geçer.
  db.prepare(`
    INSERT INTO fcm_tokens (user_id, token, user_agent) VALUES (?, ?, ?)
    ON CONFLICT(token) DO UPDATE SET user_id = excluded.user_id, user_agent = excluded.user_agent
  `).run(userId, token, String(userAgent || '').slice(0, 300));

  db.prepare(`
    DELETE FROM fcm_tokens WHERE user_id = ? AND id NOT IN (
      SELECT id FROM fcm_tokens WHERE user_id = ? ORDER BY id DESC LIMIT ?
    )
  `).run(userId, userId, MAX_FCM_TOKENS_PER_USER);

  return { success: true };
}

function removeFcmToken(token, userId) {
  if (userId) {
    db.prepare(`DELETE FROM fcm_tokens WHERE token = ? AND user_id = ?`).run(token, userId);
  } else {
    db.prepare(`DELETE FROM fcm_tokens WHERE token = ?`).run(token);
  }
}

function listFcmTokens(userId) {
  return db.prepare(`SELECT token FROM fcm_tokens WHERE user_id = ?`).all(userId).map(row => row.token);
}

// =====================================================
// ÖNERİ / GERİ BİLDİRİM PANOSU
// =====================================================
// Kullanıcıların uygulama hakkında öneri/görüş paylaşabildiği, herkese açık,
// oylanabilir bir pano. Moderasyon raporlarından (reports) tamamen ayrı —
// buradaki kayıtlar gizli değil, tüm giriş yapmış kullanıcılara açık.

db.exec(`
  CREATE TABLE IF NOT EXISTS feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS feedback_votes (
    feedback_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (feedback_id, user_id),
    FOREIGN KEY (feedback_id) REFERENCES feedback(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`);

const FEEDBACK_TITLE_MAX = 120;
const FEEDBACK_BODY_MAX = 1000;

function createFeedback(userId, { title, body }) {
  const cleanTitle = String(title || '').trim().slice(0, FEEDBACK_TITLE_MAX);
  const cleanBody = String(body || '').trim().slice(0, FEEDBACK_BODY_MAX);

  if (!cleanTitle) return { success: false, error: 'Başlık boş olamaz.' };
  if (!cleanBody) return { success: false, error: 'Açıklama boş olamaz.' };

  const info = db.prepare(`
    INSERT INTO feedback (user_id, title, body) VALUES (?, ?, ?)
  `).run(userId, cleanTitle, cleanBody);

  return { success: true, id: info.lastInsertRowid };
}

// viewerId: oy verip vermediğini (has_voted) işaretlemek için kullanılır.
function listFeedback(viewerId, sort = 'top') {
  const orderBy = sort === 'new'
    ? 'feedback.created_at DESC'
    : 'vote_count DESC, feedback.created_at DESC';

  return db.prepare(`
    SELECT
      feedback.id,
      feedback.title,
      feedback.body,
      feedback.created_at,
      feedback.user_id,
      users.username,
      COUNT(feedback_votes.user_id) AS vote_count,
      MAX(CASE WHEN feedback_votes.user_id = ? THEN 1 ELSE 0 END) AS has_voted
    FROM feedback
    JOIN users ON users.id = feedback.user_id
    LEFT JOIN feedback_votes ON feedback_votes.feedback_id = feedback.id
    GROUP BY feedback.id
    ORDER BY ${orderBy}
  `).all(viewerId || 0);
}

function voteFeedback(userId, feedbackId) {
  const feedback = db.prepare(`SELECT id FROM feedback WHERE id = ?`).get(feedbackId);
  if (!feedback) return { success: false, error: 'Öneri bulunamadı.' };

  const existing = db.prepare(`
    SELECT 1 FROM feedback_votes WHERE feedback_id = ? AND user_id = ?
  `).get(feedbackId, userId);

  if (existing) {
    db.prepare(`DELETE FROM feedback_votes WHERE feedback_id = ? AND user_id = ?`).run(feedbackId, userId);
  } else {
    db.prepare(`INSERT INTO feedback_votes (feedback_id, user_id) VALUES (?, ?)`).run(feedbackId, userId);
  }

  const { vote_count } = db.prepare(`
    SELECT COUNT(*) AS vote_count FROM feedback_votes WHERE feedback_id = ?
  `).get(feedbackId);

  return { success: true, voted: !existing, vote_count };
}

// =====================================================
// FOUNDER / ADMIN PANELİ — SADECE OKUMA (read-only)
// =====================================================
// Bu fonksiyonlar kullanıcı verisini DEĞİŞTİRMEZ, silmez, dışa aktarmaz.
// Kullanıcının kendi veri hakları ("Verilerimi İndir" / "Hesabımı Sil") ayrı
// mevcut sistemdir; burası onların alternatifi değil, sadece yönetim
// görünürlüğüdür. Yalnızca açıkça seçilen kolonlar döner — password_hash,
// password_salt, token/kod alanları ve doğum tarihi HİÇBİR zaman seçilmez.

const ADMIN_USERS_MAX_LIMIT = 50;

function escapeLike(value) {
  return String(value).replace(/[\\%_]/g, (c) => `\\${c}`);
}

function countsByUser(sql, ids) {
  // ids: sayfadaki kullanıcı id'leri. Tek sorguyla hepsi için sayı alınır (N+1 yok).
  const map = new Map();
  if (ids.length === 0) return map;
  const placeholders = ids.map(() => '?').join(',');
  db.prepare(sql.replace('__IDS__', placeholders)).all(...ids).forEach((r) => map.set(r.uid, r.c));
  return map;
}

function listAdminUsers({ page = 1, limit = 20, search = '', role = '' } = {}) {
  limit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), ADMIN_USERS_MAX_LIMIT);
  page = Math.max(parseInt(page, 10) || 1, 1);

  const where = [];
  const params = [];

  search = String(search || '').trim().slice(0, 64);
  if (search) {
    const like = `%${escapeLike(search)}%`;
    if (/^\d+$/.test(search)) {
      where.push(`(id = ? OR username LIKE ? ESCAPE '\\' OR email LIKE ? ESCAPE '\\')`);
      params.push(Number(search), like, like);
    } else {
      where.push(`(username LIKE ? ESCAPE '\\' OR email LIKE ? ESCAPE '\\')`);
      params.push(like, like);
    }
  }

  if (role) {
    where.push(`platform_role = ?`);
    params.push(role);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const total = db.prepare(`SELECT COUNT(*) AS c FROM users ${whereSql}`).get(...params).c;

  const users = db.prepare(`
    SELECT id, username, platform_role, account_status, created_at
    FROM users ${whereSql}
    ORDER BY id DESC LIMIT ? OFFSET ?
  `).all(...params, limit, (page - 1) * limit);

  const ids = users.map((u) => u.id);

  const hubCounts = countsByUser(`SELECT user_id AS uid, COUNT(*) AS c FROM hub_members WHERE user_id IN (__IDS__) GROUP BY user_id`, ids);
  const messageCounts = countsByUser(`SELECT user_id AS uid, COUNT(*) AS c FROM messages WHERE user_id IN (__IDS__) GROUP BY user_id`, ids);
  const reportCounts = countsByUser(`SELECT target_id AS uid, COUNT(*) AS c FROM reports WHERE target_type = 'user' AND target_id IN (__IDS__) GROUP BY target_id`, ids);

  // Kabul edilmiş arkadaşlıklar iki kolondan birinde olabilir.
  const friendCounts = new Map();
  if (ids.length) {
    const ph = ids.map(() => '?').join(',');
    db.prepare(`
      SELECT uid, COUNT(*) AS c FROM (
        SELECT user_low AS uid FROM friendships WHERE status = 'accepted' AND user_low IN (${ph})
        UNION ALL
        SELECT user_high AS uid FROM friendships WHERE status = 'accepted' AND user_high IN (${ph})
      ) GROUP BY uid
    `).all(...ids, ...ids).forEach((r) => friendCounts.set(r.uid, r.c));
  }

  return {
    total,
    page,
    limit,
    users: users.map((u) => ({
      id: u.id,
      username: u.username,
      platform_role: u.platform_role,
      account_status: u.account_status,
      created_at: u.created_at,
      hub_count: hubCounts.get(u.id) || 0,
      friend_count: friendCounts.get(u.id) || 0,
      message_count: messageCounts.get(u.id) || 0,
      reports_against: reportCounts.get(u.id) || 0
    }))
  };
}

function getAdminUserDetail(userId) {
  const user = db.prepare(`
    SELECT id, username, email, created_at, platform_role, about_me, avatar_data, avatar_visibility,
           account_status, suspended_at, suspension_user_reason,
           role_acceptance_pending, role_acceptance_version
    FROM users WHERE id = ?
  `).get(userId);

  if (!user) return null;

  const count = (sql, ...p) => db.prepare(sql).get(...p).c;

  const friends = count(`SELECT COUNT(*) AS c FROM friendships WHERE status = 'accepted' AND (user_low = ? OR user_high = ?)`, userId, userId);
  const dmSent = count(`SELECT COUNT(*) AS c FROM messages WHERE user_id = ? AND to_user_id IS NOT NULL`, userId);
  const hubMessages = count(`SELECT COUNT(*) AS c FROM messages WHERE user_id = ? AND to_user_id IS NULL`, userId);
  const hubsOwned = count(`SELECT COUNT(*) AS c FROM hubs WHERE created_by = ?`, userId);
  const hubsMember = count(`SELECT COUNT(*) AS c FROM hub_members WHERE user_id = ?`, userId);

  const reportRows = db.prepare(`
    SELECT status, COUNT(*) AS c FROM reports WHERE target_type = 'user' AND target_id = ? GROUP BY status
  `).all(userId);
  const openStatuses = ['new', 'under_review'];
  const reportsAgainst = reportRows.reduce((sum, r) => sum + r.c, 0);
  const reportsOpen = reportRows.filter((r) => openStatuses.includes(r.status)).reduce((sum, r) => sum + r.c, 0);

  const reportsFiled = count(`SELECT COUNT(*) AS c FROM reports WHERE reporter_user_id = ?`, userId);

  return {
    account: {
      id: user.id,
      username: user.username,
      email: user.email,
      created_at: user.created_at,
      platform_role: user.platform_role,
      role_acceptance_pending: isOfficialRole(user.platform_role) && Boolean(user.role_acceptance_pending),
      role_acceptance_version: isOfficialRole(user.platform_role) && user.role_acceptance_pending ? user.role_acceptance_version : null,
      account_status: user.account_status,
      suspended_at: user.suspended_at,
      // Kullanıcıya gösterilen metin (iç gerekçe burada YOK; yalnızca audit log'da).
      user_reason: user.suspension_user_reason
    },
    profile: {
      about_me: user.about_me,
      avatar_data: user.avatar_data,
      avatar_visibility: user.avatar_visibility
    },
    activity: {
      // Sistemde son aktivite/son giriş zamanı tutulmuyor — sahte değer üretilmez.
      last_activity: null,
      hub_message_count: hubMessages,
      dm_sent_count: dmSent,
      hubs_owned: hubsOwned,
      hubs_member: hubsMember,
      friend_count: friends
    },
    moderation: {
      reports_against: reportsAgainst,
      reports_open: reportsOpen,
      reports_resolved: reportsAgainst - reportsOpen,
      reports_filed: reportsFiled
    }
  };
}

function getAdminStats() {
  const one = (sql) => db.prepare(sql).get().c;

  const roleRows = db.prepare(`SELECT platform_role AS role, COUNT(*) AS c FROM users GROUP BY platform_role`).all();
  const usersByRole = {};
  PLATFORM_ROLES.forEach((r) => { usersByRole[r] = 0; });
  roleRows.forEach((r) => { usersByRole[r.role] = r.c; });

  return {
    total_users: one(`SELECT COUNT(*) AS c FROM users`),
    users_registered_today: one(`SELECT COUNT(*) AS c FROM users WHERE date(created_at) = date('now')`),
    users_by_role: usersByRole,
    total_hubs: one(`SELECT COUNT(*) AS c FROM hubs`),
    total_messages: one(`SELECT COUNT(*) AS c FROM messages`),
    total_reports: one(`SELECT COUNT(*) AS c FROM reports`),
    open_reports: one(`SELECT COUNT(*) AS c FROM reports WHERE status IN ('new', 'under_review')`)
  };
}

// =====================================================
// ADMIN AUDIT LOG (platform yöneticisinin YAZMA işlemlerinin geçmişi)
// =====================================================
// Amaç: kim → ne yaptı → kime/neye → ne zaman → hangi (iç) gerekçeyle.
// moderation_actions'tan AYRIDIR: o, rapor iş akışının geçmişidir; bu ise
// yöneticinin kendi yönetim eylemleridir. İkisi birleştirilmez.
//
// Tasarım notları:
// - actor_user_id / target_user_id düz sayı olarak tutulur, FK YOKTUR. FK olsaydı
//   "Hesabımı Sil" (users satırı silme) ile tetikleyiciler çakışırdı. Bu ID'ler
//   ANONİM VERİ DEĞİLDİR: bir hesaba geri çözülebilen kişisel veri olarak ele
//   alınmalıdır (silinen hesabın ID'si de pseudonymous veri olarak kalır).
// - Kullanıcı adı, IP, şifre/token/kod, mesaj içeriği KAYDEDİLMEZ.
// - reason bir İÇ yönetim gerekçesidir; kullanıcıya gösterilen metin ayrı tutulur.
// - Değiştirilemezlik UYGULAMA DÜZEYİNDEDİR: aşağıdaki SQLite tetikleyicileri,
//   uygulama üzerinden yapılan UPDATE/DELETE'i reddeder ve panelde silme/düzenleme
//   yolu yoktur. Bu, veritabanı yöneticisine ya da dosya erişimi olan birine karşı
//   mutlak/kriptografik bir koruma DEĞİLDİR (tetikleyici kaldırılabilir).

db.exec(`
  CREATE TABLE IF NOT EXISTS admin_audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    actor_user_id INTEGER,
    action TEXT NOT NULL,
    target_user_id INTEGER,
    reason TEXT,
    old_value TEXT,
    new_value TEXT,
    report_id INTEGER,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_admin_audit_created ON admin_audit_log(created_at);
  CREATE INDEX IF NOT EXISTS idx_admin_audit_target ON admin_audit_log(target_user_id);
  CREATE INDEX IF NOT EXISTS idx_admin_audit_actor ON admin_audit_log(actor_user_id);
  CREATE INDEX IF NOT EXISTS idx_admin_audit_action ON admin_audit_log(action);

  CREATE TRIGGER IF NOT EXISTS admin_audit_log_no_update
  BEFORE UPDATE ON admin_audit_log
  BEGIN SELECT RAISE(ABORT, 'admin_audit_log is append-only'); END;

  CREATE TRIGGER IF NOT EXISTS admin_audit_log_no_delete
  BEFORE DELETE ON admin_audit_log
  BEGIN SELECT RAISE(ABORT, 'admin_audit_log is append-only'); END;
`);

const AUDIT_ACTIONS = ['platform_role_changed', 'platform_role_accepted', 'platform_role_declined', 'account_suspended', 'account_unsuspended'];
const AUDIT_REASON_MAX = 500;
const AUDIT_VALUE_MAX = 100;
const AUDIT_MAX_LIMIT = 50;

// Bir yazma işleminin içinde (db.transaction ile) çağrılmak üzere tasarlandı:
// aynı bağlantıyı kullandığı için işlemle birlikte commit/rollback olur.
// Hata fırlatırsa çağıran işlem de geri alınmalıdır.
function writeAuditLog({ actorUserId, action, targetUserId, reason, oldValue, newValue, reportId }) {
  if (!AUDIT_ACTIONS.includes(action)) {
    throw new Error('Geçersiz audit işlemi.');
  }
  if (!Number.isInteger(actorUserId) || !Number.isInteger(targetUserId)) {
    throw new Error('Audit kaydı için geçerli kullanıcı ID\'leri gerekli.');
  }

  const clip = (v, max) => (v == null ? null : String(v).slice(0, max));

  const info = db.prepare(`
    INSERT INTO admin_audit_log (actor_user_id, action, target_user_id, reason, old_value, new_value, report_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    actorUserId,
    action,
    targetUserId,
    clip(reason, AUDIT_REASON_MAX),
    clip(oldValue, AUDIT_VALUE_MAX),
    clip(newValue, AUDIT_VALUE_MAX),
    Number.isInteger(reportId) ? reportId : null
  );

  return info.lastInsertRowid;
}

function nextDayStart(dateStr) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return `${d.toISOString().slice(0, 10)} 00:00:00`;
}

// Kullanıcı adları yalnızca GÖSTERİM için o anki users tablosundan çözülür
// (audit satırında saklanmaz); hesap silinmişse NULL döner.
function listAuditLog({ page = 1, limit = 20, action = '', actorUserId = null, targetUserId = null, from = '', to = '' } = {}) {
  limit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), AUDIT_MAX_LIMIT);
  page = Math.max(parseInt(page, 10) || 1, 1);

  const where = [];
  const params = [];

  if (action) { where.push('a.action = ?'); params.push(action); }
  if (actorUserId != null) { where.push('a.actor_user_id = ?'); params.push(actorUserId); }
  if (targetUserId != null) { where.push('a.target_user_id = ?'); params.push(targetUserId); }
  if (from) { where.push('a.created_at >= ?'); params.push(`${from} 00:00:00`); }
  if (to) { where.push('a.created_at < ?'); params.push(nextDayStart(to)); }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const total = db.prepare(`SELECT COUNT(*) AS c FROM admin_audit_log a ${whereSql}`).get(...params).c;

  const entries = db.prepare(`
    SELECT a.id, a.created_at, a.action, a.reason, a.old_value, a.new_value, a.report_id,
           a.actor_user_id, actor.username AS actor_username,
           a.target_user_id, target.username AS target_username
    FROM admin_audit_log a
    LEFT JOIN users actor ON actor.id = a.actor_user_id
    LEFT JOIN users target ON target.id = a.target_user_id
    ${whereSql}
    ORDER BY a.id DESC LIMIT ? OFFSET ?
  `).all(...params, limit, (page - 1) * limit);

  return { total, page, limit, entries };
}

// =====================================================
// FOUNDER ROL YÖNETİMİ (AŞAMA C)
// =====================================================
// Yalnızca founder çağırabilir (route katmanı + burada DB'den tekrar doğrulanır).
// Web'den atanabilecek roller sınırlıdır: founder ATANAMAZ (founder için güvenli
// CLI mekanizması — admin.js set-role — aynen sürer). Founder ne kendi rolünü ne
// başka bir founder'ın rolünü değiştirebilir; bu iki kural sayesinde web'den
// founder sayısı azaltılamaz. Rol güncelleme ve audit kaydı TEK transaction'dadır:
// audit yazılamazsa rol de değişmez.

const ROLE_ASSIGNABLE = ['user', 'moderator', 'admin'];
const ADMIN_REASON_MAX = 500;

class AdminActionError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const changePlatformRoleTx = db.transaction(({ actorId, targetId, newRole, reason }) => {
  const actor = db.prepare(`SELECT id, platform_role FROM users WHERE id = ?`).get(actorId);
  if (!actor || actor.platform_role !== 'founder') {
    throw new AdminActionError(403, 'Bu işlem için yetkin yok.');
  }

  if (actorId === targetId) {
    throw new AdminActionError(403, 'Kendi rolünü değiştiremezsin.');
  }

  const target = db.prepare(`
    SELECT id, platform_role, role_acceptance_pending, role_accepted_role, account_status FROM users WHERE id = ?
  `).get(targetId);
  if (!target) {
    throw new AdminActionError(404, 'Kullanıcı bulunamadı.');
  }

  if (target.platform_role === 'founder') {
    throw new AdminActionError(403, 'Founder rolü web panelinden değiştirilemez.');
  }

  if (target.platform_role === newRole) {
    throw new AdminActionError(409, 'Kullanıcı zaten bu rolde.');
  }

  // Değişiklikten ÖNCEKİ etkin yetki, kabul edilmiş taban yetki olarak korunur.
  const effectiveBefore = getEffectivePlatformRole(target);

  db.prepare(`UPDATE users SET platform_role = ? WHERE id = ?`).run(newRole, targetId);

  // Savunma amaçlı: hiçbir koşulda founder sayısı 1'in altına inmemeli.
  const founders = db.prepare(`SELECT COUNT(*) AS c FROM users WHERE platform_role = 'founder'`).get().c;
  if (founders < 1) {
    throw new AdminActionError(500, 'En az bir founder bulunmalı.');
  }

  writeAuditLog({
    actorUserId: actorId,
    action: 'platform_role_changed',
    targetUserId: targetId,
    reason,
    oldValue: target.platform_role,
    newValue: newRole
  });

  // Resmi bildirim + e-posta outbox kaydı, rol ve audit ile AYNI transaction'da:
  // biri başarısız olursa hepsi geri alınır. SMTP gönderimi burada YAPILMAZ.
  const notice = recordRoleNotice({ target, newRole, effectiveBefore });

  return {
    id: targetId,
    old_role: target.platform_role,
    new_role: newRole,
    acceptance_pending: isOfficialRole(newRole),
    notice
  };
});

function recordRoleNotice({ target, newRole, effectiveBefore }) {
  const targetId = target.id;
  const suspended = target.account_status === 'suspended';
  let type;
  let notificationType;
  let notificationData;
  let version = null;
  let emailPayload = { previous_role: target.platform_role };

  if (isOfficialRole(newRole)) {
    // user->mod/admin, mod->admin, admin->mod: HER yeni atama yeni bir kabul gerektirir.
    version = ROLE_NOTICE_VERSIONS[newRole];
    db.prepare(`
      UPDATE users
      SET role_acceptance_pending = 1, role_acceptance_version = ?, role_accepted_role = ?,
          role_accepted_at = CASE WHEN ? = 'user' THEN NULL ELSE role_accepted_at END,
          role_notice_kind = NULL, role_notice_at = NULL
      WHERE id = ?
    `).run(version, effectiveBefore, effectiveBefore, targetId);

    type = 'assigned';
    notificationType = 'platform_role_notice';
    notificationData = {
      system: true, sender_label: OFFICIAL_SENDER_LABEL,
      role: newRole, version, previous_role: target.platform_role
    };
  } else {
    // mod/admin -> user: görevden alma; kabul İSTENMEZ, kabul beklemesi temizlenir.
    db.prepare(`
      UPDATE users
      SET role_acceptance_pending = 0, role_acceptance_version = NULL, role_accepted_role = 'user',
          role_accepted_at = NULL, role_notice_kind = ?, role_notice_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(`revoked_${target.platform_role}`, targetId);

    type = 'revoked';
    notificationType = 'platform_role_revoked';
    notificationData = {
      system: true, sender_label: OFFICIAL_SENDER_LABEL,
      removed_role: target.platform_role, current_role: newRole, support_email: SUPPORT_EMAIL_ADDRESS
    };
    emailPayload = { removed_role: target.platform_role, current_role: newRole };
  }

  // Eski görev bildirimi(leri) artık geçersiz (görev geri alındı ya da yerine yenisi atandı):
  // sistem bildirimi olduğu için kullanıcı silmeden sistem tarafından temizlenir.
  deleteStalePlatformNotices(targetId);

  const notification = createNotification(targetId, notificationType, notificationData);

  // Askıdaki hesaba yeni e-posta da çıkmaz; kabul durumu yine users üzerinde durur.
  const outboxId = suspended
    ? null
    : enqueueRoleNoticeEmail({
        userId: targetId,
        type,
        role: isOfficialRole(newRole) ? newRole : target.platform_role,
        version,
        payload: emailPayload
      });

  return {
    kind: type,
    role: isOfficialRole(newRole) ? newRole : target.platform_role,
    version,
    notification: { id: notification.id, type: notificationType, data: notificationData, suppressed: Boolean(notification.suppressed) },
    outbox_id: outboxId
  };
}

function changePlatformRole({ actorId, targetId, newRole, reason }) {
  if (typeof newRole !== 'string' || !ROLE_ASSIGNABLE.includes(newRole)) {
    return { success: false, status: 400, error: 'Geçersiz rol. Web panelinden yalnızca user, moderator veya admin atanabilir.' };
  }

  reason = typeof reason === 'string' ? reason.trim() : '';
  if (!reason) {
    return { success: false, status: 400, error: 'Gerekçe zorunlu.' };
  }
  if (reason.length > ADMIN_REASON_MAX) {
    return { success: false, status: 400, error: `Gerekçe en fazla ${ADMIN_REASON_MAX} karakter olabilir.` };
  }

  try {
    return { success: true, ...changePlatformRoleTx({ actorId, targetId, newRole, reason }) };
  } catch (error) {
    if (error instanceof AdminActionError) {
      return { success: false, status: error.status, error: error.message };
    }
    throw error;
  }
}

// =====================================================
// HESAP ASKIYA ALMA (AŞAMA D)
// =====================================================
// Askıya alma GERİ ALINABİLİR bir erişim kısıtlamasıdır: hiçbir kullanıcı verisi
// (mesaj, DM, Lobi, üyelik, arkadaşlık, bildirim, rapor, moderasyon/audit kaydı,
// profil) silinmez veya değiştirilmez; yalnızca hesap "suspended" durumuna geçer
// ve oturumları kapatılır.
//
// İKİ AYRI GEREKÇE:
// - iç gerekçe (internal_reason): yalnızca admin_audit_log.reason'a yazılır,
//   users tablosuna KOPYALANMAZ ve kullanıcıya asla gösterilmez.
// - kullanıcı gerekçesi (user_reason): isteğe bağlı, kısa, sade metin; users
//   tablosunda suspension_user_reason olarak tutulur ve yalnızca doğru kimlik
//   doğrulamadan sonra kullanıcıya gösterilir. Audit'e KOPYALANMAZ.
// Askı kalkınca users üzerindeki askı alanları temizlenir (tarihçe audit'te kalır).

const usersSuspensionColumns = db.prepare(`PRAGMA table_info(users)`).all().map(col => col.name);
if (!usersSuspensionColumns.includes('account_status')) {
  db.exec(`ALTER TABLE users ADD COLUMN account_status TEXT NOT NULL DEFAULT 'active'`);
}
if (!usersSuspensionColumns.includes('suspended_at')) {
  db.exec(`ALTER TABLE users ADD COLUMN suspended_at DATETIME`);
}
if (!usersSuspensionColumns.includes('suspended_by')) {
  db.exec(`ALTER TABLE users ADD COLUMN suspended_by INTEGER`);
}
if (!usersSuspensionColumns.includes('suspension_user_reason')) {
  db.exec(`ALTER TABLE users ADD COLUMN suspension_user_reason TEXT`);
}

const USER_REASON_MAX = 300;

// Askıdaki (veya artık var olmayan) hesap mı? Yalnızca OKUR.
function isAccountSuspended(userId) {
  const row = db.prepare(`SELECT account_status FROM users WHERE id = ?`).get(userId);
  return Boolean(row && row.account_status === 'suspended');
}

// Gönderene askı durumu açıklanmaz.
const DM_UNAVAILABLE_ERROR = 'Bu kullanıcıya şu an mesaj gönderilemiyor.';

function loadFounderActor(actorId) {
  const actor = db.prepare(`SELECT id, platform_role FROM users WHERE id = ?`).get(actorId);
  if (!actor || actor.platform_role !== 'founder') {
    throw new AdminActionError(403, 'Bu işlem için yetkin yok.');
  }
  return actor;
}

const suspendAccountTx = db.transaction(({ actorId, targetId, internalReason, userReason }) => {
  loadFounderActor(actorId);

  if (actorId === targetId) {
    throw new AdminActionError(403, 'Kendi hesabını askıya alamazsın.');
  }

  const target = db.prepare(`SELECT id, platform_role, account_status FROM users WHERE id = ?`).get(targetId);
  if (!target) {
    throw new AdminActionError(404, 'Kullanıcı bulunamadı.');
  }
  if (target.platform_role === 'founder') {
    throw new AdminActionError(403, 'Founder hesabı askıya alınamaz.');
  }
  if (target.account_status === 'suspended') {
    throw new AdminActionError(409, 'Hesap zaten askıda.');
  }

  db.prepare(`
    UPDATE users
    SET account_status = 'suspended', suspended_at = CURRENT_TIMESTAMP, suspended_by = ?, suspension_user_reason = ?
    WHERE id = ?
  `).run(actorId, userReason, targetId);

  // Yalnızca oturumlar kapatılır; başka hiçbir kullanıcı verisine dokunulmaz.
  const revoked = db.prepare(`DELETE FROM sessions WHERE user_id = ?`).run(targetId).changes;

  writeAuditLog({
    actorUserId: actorId,
    action: 'account_suspended',
    targetUserId: targetId,
    reason: internalReason,
    oldValue: 'active',
    newValue: 'suspended'
  });

  return { id: targetId, sessions_revoked: revoked };
});

const unsuspendAccountTx = db.transaction(({ actorId, targetId, internalReason }) => {
  loadFounderActor(actorId);

  if (actorId === targetId) {
    throw new AdminActionError(403, 'Kendi hesabın için bu işlemi yapamazsın.');
  }

  const target = db.prepare(`SELECT id, platform_role, account_status FROM users WHERE id = ?`).get(targetId);
  if (!target) {
    throw new AdminActionError(404, 'Kullanıcı bulunamadı.');
  }
  if (target.platform_role === 'founder') {
    throw new AdminActionError(403, 'Founder hesabı üzerinde bu işlem yapılamaz.');
  }
  if (target.account_status !== 'suspended') {
    throw new AdminActionError(409, 'Hesap askıda değil.');
  }

  db.prepare(`
    UPDATE users
    SET account_status = 'active', suspended_at = NULL, suspended_by = NULL, suspension_user_reason = NULL
    WHERE id = ?
  `).run(targetId);

  writeAuditLog({
    actorUserId: actorId,
    action: 'account_unsuspended',
    targetUserId: targetId,
    reason: internalReason,
    oldValue: 'suspended',
    newValue: 'active'
  });

  return { id: targetId };
});

function validateInternalReason(reason) {
  reason = typeof reason === 'string' ? reason.trim() : '';
  if (!reason) return { error: 'İç gerekçe zorunlu.' };
  if (reason.length > ADMIN_REASON_MAX) return { error: `İç gerekçe en fazla ${ADMIN_REASON_MAX} karakter olabilir.` };
  return { value: reason };
}

function suspendAccount({ actorId, targetId, internalReason, userReason }) {
  const internal = validateInternalReason(internalReason);
  if (internal.error) return { success: false, status: 400, error: internal.error };

  // Kullanıcıya gösterilecek metin: tek satır, kontrol karakterleri temizlenir, isteğe bağlı.
  let shown = typeof userReason === 'string' ? userReason.replace(/[ -]+/g, ' ').replace(/\s+/g, ' ').trim() : '';
  if (shown.length > USER_REASON_MAX) {
    return { success: false, status: 400, error: `Kullanıcı gerekçesi en fazla ${USER_REASON_MAX} karakter olabilir.` };
  }
  shown = shown || null;

  try {
    return { success: true, ...suspendAccountTx({ actorId, targetId, internalReason: internal.value, userReason: shown }), user_reason: shown };
  } catch (error) {
    if (error instanceof AdminActionError) return { success: false, status: error.status, error: error.message };
    throw error;
  }
}

function unsuspendAccount({ actorId, targetId, internalReason }) {
  const internal = validateInternalReason(internalReason);
  if (internal.error) return { success: false, status: 400, error: internal.error };

  try {
    return { success: true, ...unsuspendAccountTx({ actorId, targetId, internalReason: internal.value }) };
  } catch (error) {
    if (error instanceof AdminActionError) return { success: false, status: error.status, error: error.message };
    throw error;
  }
}

// Açılışta eski/geçersiz görev bildirimlerini temizle (idempotent).
cleanupStalePlatformNotices();

module.exports = {
  isAccountSuspended,
  suspendAccount,
  unsuspendAccount,
  changePlatformRole,
  devNoticeFor,
  markDevNoticeSeen,
  listAdminUsers,
  getAdminUserDetail,
  getAdminStats,
  saveMessage,
  getMessages,
  createUser,
  loginUser,
  createVerification,

  verifyAndCreateUser,
  AUDIT_ACTIONS,
  writeAuditLog,
  listAuditLog,
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
  setHubMuted,
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
  createHubSticker,
  STICKERS,
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
  saveDmSticker,
  getDmMessages,
  addReaction,
  removeReaction,
  pinMessage,
  unpinMessage,
  forwardMessageToDm,
  clearHubMessages,
  getMessageById,
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
  getEffectivePlatformRole,
  platformRoleFields,
  ROLE_NOTICE_VERSIONS,
  acceptPlatformRole,
  declinePlatformRole,
  markRoleNoticeSeen,
  claimNextRoleNoticeEmail,
  getRoleNoticeEmailTarget,
  markRoleNoticeEmailSent,
  markRoleNoticeEmailSkipped,
  markRoleNoticeEmailFailed,
  recoverStaleRoleNoticeEmails,
  setPlatformRole,
  getReportDetail,
  getModerationUserDetail,
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
  cleanupStalePlatformNotices,
  markAllNotificationsRead,
  deleteNotification,
  clearNotifications,
  respondHubInviteNotification,
  requestPasswordReset,
  confirmPasswordReset,
  createNotification,
  getNotificationPreferences,
  updateNotificationPreferences,
  markNotificationRead,
  MAX_VOICE_ROOM_PARTICIPANTS,
  MAX_VOICE_ROOMS_PER_HUB,
  getHubPushInfo,
  savePushSubscription,
  removePushSubscription,
  listPushSubscriptions,
  saveFcmToken,
  purgeExpiredRetention,
  purgeExpiredAuthRecords,
  lifecycleLogCutoff,
  unlinkReportDataForDeletedUser,
  RETENTION_POLICY,
  deleteAccount,
  purgeHubData,
  listDueDailyRoomCleanups,
  completeDailyRoomCleanup,
  failDailyRoomCleanup,
  removeFcmToken,
  listFcmTokens,
  createFeedback,
  listFeedback,
  voteFeedback,
  db
};