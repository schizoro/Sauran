require('dotenv').config();
const { purgeOldBackups } = require('./backup');
const { sendInactivityWarningEmail, sendAccountExistsEmail, sendVerificationEmail, sendPasswordResetEmail, sendReportNotificationEmail, sendRoleNoticeEmail, sendRoleDecisionTeamEmail } = require('./mailer');
const push = require('./push');
const fcm = require('./fcm');
const daily = require('./daily');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');

const {
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
  setHubMuted,
  addHubRole,
  isHubMember,
  getMemberTier,
  setModerator,
  kickMember,
  banMember,
  unbanMember,
  listHubBans,
  getHubMessages,
  saveHubMessage,
  deleteMessage,
  editMessage,
  addReaction,
  removeReaction,
  pinMessage,
  unpinMessage,
  forwardMessageToDm,
  createHubVoiceMessage,
  createHubFileMessage,
  createHubSticker,
  STICKERS,
  createHubPoll,
  voteHubPoll,
  createHubShare,
  deleteHub,
  clearHubMessages,
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
  listFriends,
  listIncomingRequests,
  getUserPublicProfile,
  saveDmMessage,
  saveDmVoiceMessage,
  createDmFileMessage,
  saveDmSticker,
  saveDmCallLog,
  getDmMessages,
  findUserByUsername,
  blockUser,
  unblockUser,
  listBlockedUsers,
  createReport,
  MAX_VOICE_ROOM_PARTICIPANTS,
  getHubPushInfo,
  savePushSubscription,
  removePushSubscription,
  listPushSubscriptions,
  saveFcmToken,
  purgeExpiredRetention,
  purgeExpiredAuthRecords,
  purgeExpiredAuditLog,
  purgeAdultBirthDates,
  touchUserActivity,
  runInactiveAccountPass,
  purgeExpiredIndefiniteData,
  logDataLifecycle,
  purgeExpiredDataLifecycleLog,
  checkpointWal,
  verifyAccountPassword,
  purgeExpiredMessages,
  purgeExpiredNotificationData,
  listDeletedDmThreads,
  getDeletedDmMessages,
  deleteDeletedDmThread,
  purgeExpiredDeletedDmThreads,
  unlinkReportDataForDeletedUser,
  deleteAccount,
  listDueDailyRoomCleanups,
  completeDailyRoomCleanup,
  failDailyRoomCleanup,
  removeFcmToken,
  listFcmTokens,
  createFeedback,
  listFeedback,
  voteFeedback,
  calculateAge,
  isMinorAge,
  isMinorUntil,
  getAccountExport,
  updateUsername,
  updatePassword,
  getTopFriends,
  sendHubInviteNotification,
  listNotifications,
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
  hasAtLeastPlatformRole,
  platformRoleFields,
  acceptPlatformRole,
  declinePlatformRole,
  markRoleNoticeSeen,
  claimNextRoleNoticeEmail,
  getRoleNoticeEmailTarget,
  markRoleNoticeEmailSent,
  markRoleNoticeEmailSkipped,
  markRoleNoticeEmailFailed,
  recoverStaleRoleNoticeEmails,
  getReportDetail,
  getModerationUserDetail,
  listAdminUsers,
  devNoticeFor,
  AUDIT_ACTIONS,
  listAuditLog,
  changePlatformRole,
  suspendAccount,
  unsuspendAccount,
  isAccountSuspended,
  markDevNoticeSeen,
  PLATFORM_ROLES,
  getAdminUserDetail,
  getAdminStats,
  logModerationAction,
  updateReportStatus,
  listReports,
  REPORT_REASONS,
  REPORT_STATUSES,
  REPORT_PRIORITIES,
  db
} = require('./db');

const app = express();

// Render bir ters proxy arkasında çalıştığı için gerçek istemci IP'sini
// almak (rate limiting'in anlamlı olması) için buna ihtiyaç var.
app.set('trust proxy', 1);

const server = http.createServer(app);

// Sauran, istemciyi de aynı origin üzerinden servis ediyor (bkz. express.static
// aşağıda), bu yüzden tarayıcı istekleri için CORS'a normalde gerek yok.
// Üretimde varsayılan olarak sadece aynı origin'e (Origin header'ı olmayan
// istekler dahil) izin verilir; farklı bir origin'den erişim gerekiyorsa
// (ör. ayrı bir mobil/istemci alan adı), ALLOWED_ORIGINS ortam değişkenine
// virgülle ayrılmış origin listesi eklenmelidir.
const isProduction = process.env.NODE_ENV === 'production';
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '').split(',').map(o => o.trim()).filter(Boolean);

// Üretimde VARSAYILAN: yalnızca AYNI ORIGIN (Origin başlığı, isteğin Host'uyla eşleşir) + ALLOWED_ORIGINS listesi. Eskiden ALLOWED_ORIGINS boşken her origin
// kabul ediliyordu (credentials: true ile birlikte gereksiz geniş). Çerez SameSite=Lax olduğundan yine de çapraz-site istekle gönderilmezdi; bu, ek savunmadır.
// origin başlığı olmayan istekler (sunucu-sunucu, aynı-site GET) etkilenmez.
function isRequestOriginAllowed(originHeader, hostHeader) {
  if (!isProduction) return true; // yerel geliştirmede kısıtlama yok
  if (!originHeader) return true;
  if (allowedOrigins.includes(originHeader)) return true;
  try { return new URL(originHeader).host === String(hostHeader || '').toLowerCase(); } catch (_) { return false; }
}

const corsOptionsDelegate = (req, callback) => {
  callback(null, { origin: isRequestOriginAllowed(req.headers.origin, req.headers.host), credentials: true });
};

const io = new Server(server, {
  cors: { origin: true, credentials: true, methods: ['GET', 'POST'] },
  // Bağlantı (el sıkışma) yalnızca izinli origin'den kabul edilir; izinsiz origin'e CORS başlığı olsa bile bağlantı REDDEDİLİR.
  allowRequest: (req, callback) => callback(null, isRequestOriginAllowed(req.headers.origin, req.headers.host)),
  maxHttpBufferSize: 15_000_000
});

app.use(cors(corsOptionsDelegate));
app.use(express.json({ limit: '15mb' }));

// =====================================================
// RATE LIMITING (bellek içi, basit sabit pencere)
// =====================================================

function rateLimit({ windowMs, max, keyFn, message }) {
  const hits = new Map();

  return (req, res, next) => {
    const key = keyFn(req);
    const now = Date.now();

    const existing = hits.get(key) || [];
    const recent = existing.filter(t => now - t < windowMs);

    if (recent.length >= max) {
      return res.status(429).json({ success: false, error: message || 'Çok fazla istek gönderildi. Lütfen biraz sonra tekrar dene.' });
    }

    recent.push(now);
    hits.set(key, recent);
    next();
  };
}

const byIp = (req) => req.ip;
const byIpAndUser = (req) => `${req.ip}:${(req.body?.username || req.body?.email || '').toLowerCase()}`;

const loginLimiter = rateLimit({ windowMs: 5 * 60 * 1000, max: 8, keyFn: byIpAndUser, message: 'Çok fazla giriş denemesi. 5 dakika sonra tekrar dene.' });
// Kod doğrulama uçları: kod 6 haneli olduğundan tahmin edilmesi (kaba kuvvet) zorlaştırılır. Kayıt başına deneme sayısı ayrıca db.js'de sınırlıdır
// (5 hatalı denemeden sonra kod yanar); bu limitler IP başına istek sayısını ve scrypt maliyetini sınırlar. Her uç kendi sayaçlarını kullanır.
const makeCodeLimiters = () => [
  rateLimit({ windowMs: 10 * 60 * 1000, max: 30, keyFn: byIp, message: 'Çok fazla doğrulama denemesi. Biraz sonra tekrar dene.' }),
  rateLimit({ windowMs: 10 * 60 * 1000, max: 10, keyFn: byIpAndUser, message: 'Çok fazla doğrulama denemesi. Biraz sonra tekrar dene.' })
];
const verifyLimiters = makeCodeLimiters();
const resetConfirmLimiters = makeCodeLimiters();

const registerLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 5, keyFn: byIp, message: 'Çok fazla kayıt denemesi. Biraz sonra tekrar dene.' });
const passwordChangeLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, keyFn: byIp, message: 'Çok fazla şifre değiştirme denemesi. Biraz sonra tekrar dene.' });
const accountDeleteLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 5, keyFn: byIp, message: 'Çok fazla hesap silme denemesi. Biraz sonra tekrar dene.' });
// Davet kodu tahmini, kullanıcı adı taraması ve numara ile profil taraması (kullanıcı dizini çıkarma) için hız sınırları.
const joinLimiter = rateLimit({ windowMs: 10 * 60 * 1000, max: 20, keyFn: byIp, message: 'Çok fazla davet kodu denemesi. Biraz sonra tekrar dene.' });
const lookupLimiter = rateLimit({ windowMs: 10 * 60 * 1000, max: 60, keyFn: byIp, message: 'Çok fazla arama yapıldı. Biraz sonra tekrar dene.' });
const profileViewLimiter = rateLimit({ windowMs: 60 * 1000, max: 120, keyFn: byIp, message: 'Çok fazla profil isteği. Biraz sonra tekrar dene.' });
const passwordResetLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 5, keyFn: byIp, message: 'Çok fazla istek. Biraz sonra tekrar dene.' });
const friendRequestLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 30, keyFn: byIp, message: 'Çok fazla arkadaşlık isteği gönderildi. Biraz sonra tekrar dene.' });
const hubCreateLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 10, keyFn: byIp, message: 'Çok fazla Hub oluşturuldu. Biraz sonra tekrar dene.' });
const inviteCreateLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 30, keyFn: byIp, message: 'Çok fazla davet oluşturuldu. Biraz sonra tekrar dene.' });
const reportLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 20, keyFn: byIp, message: 'Çok fazla bildirim gönderildi. Biraz sonra tekrar dene.' });
const feedbackLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 10, keyFn: byIp, message: 'Çok fazla öneri gönderildi. Biraz sonra tekrar dene.' });
const adminWriteLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 30, keyFn: byIp, message: 'Çok fazla yönetim işlemi yapıldı. Biraz sonra tekrar dene.' });
const fileUploadLimiter = rateLimit({ windowMs: 10 * 60 * 1000, max: 30, keyFn: byIp, message: 'Çok fazla dosya gönderildi. Biraz sonra tekrar dene.' });

// Socket üzerinden gönderilen mesajlar için basit hız sınırlama (spam koruması).
function isSocketMessageRateLimited(socket) {
  const now = Date.now();
  const windowMs = 10_000;
  const max = 15;

  if (!socket.data.msgTimestamps) socket.data.msgTimestamps = [];
  socket.data.msgTimestamps = socket.data.msgTimestamps.filter(t => now - t < windowMs);

  if (socket.data.msgTimestamps.length >= max) return true;

  socket.data.msgTimestamps.push(now);
  return false;
}
// Tanıtım sayfası (landing) ve uygulama ayrımı:
//  - /app : uygulamanın kendisi (giriş/kayıt dahil), eskisi gibi çalışır.
//  - /    : oturumu olan kullanıcı, Android WebView ya da bildirimle açılış -> uygulama (mevcut davranış korunur);
//           diğer herkes (arama motorları dahil) -> herkese açık tanıtım sayfası.
const CLIENT_DIR = path.join(__dirname, '..', 'client');

app.get('/app', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.sendFile(path.join(CLIENT_DIR, 'index.html'));
});

app.get('/', (req, res) => {
  const hasSession = /(?:^|;\s*)sauran_session=/.test(req.headers.cookie || '');
  const isNativeWebView = /;\s*wv\)/.test(req.headers['user-agent'] || '');
  const opensChat = 'open_dm' in req.query || 'open_hub' in req.query;

  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Vary', 'Cookie, User-Agent');
  res.sendFile(path.join(CLIENT_DIR, hasSession || isNativeWebView || opensChat ? 'index.html' : 'landing.html'));
});

// Veritabanı/yedek dizini (DATA_DIR) herkese açık istemci dizininin içinde olamaz: aksi halde .db/.db-wal dosyaları HTTP ile indirilebilirdi.
if (require('./backup').isInsidePublicDir(process.env.DATA_DIR || path.join(__dirname, '..', 'data'))) {
  console.error('KRİTİK: DATA_DIR istemcinin herkese açık dizininin içinde olamaz. Sunucu başlatılmıyor.');
  process.exit(1);
}

// Kişisel veri taşıyan API yanıtları (dışa aktarım dahil) tarayıcı/proxy önbelleğine alınmaz.
app.use('/api', (req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });

app.use(express.static(path.join(__dirname, '..', 'client'), {
  etag: false,
  lastModified: false,
  setHeaders: (res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  }
}));

db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    token_hash TEXT UNIQUE NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`);

const sessionColumns = db.prepare(`PRAGMA table_info(sessions)`).all().map(c => c.name);
if (!sessionColumns.includes('user_agent')) {
  db.exec(`ALTER TABLE sessions ADD COLUMN user_agent TEXT`);
}

const SUPPORT_EMAIL = 'destek@sauran.online';

const SESSION_DURATION = 7 * 24 * 60 * 60 * 1000;

function hashSessionToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function createSession(userId, userAgent) {
  const acct = db.prepare(`SELECT account_status FROM users WHERE id = ?`).get(userId);
  if (acct && acct.account_status === 'suspended') {
    throw new Error('Askıdaki hesap için oturum oluşturulamaz.');
  }

  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashSessionToken(token);
  const expiresAt = new Date(Date.now() + SESSION_DURATION).toISOString();

  db.prepare(`
    INSERT INTO sessions (user_id, token_hash, expires_at, user_agent)
    VALUES (?, ?, ?, ?)
  `).run(userId, tokenHash, expiresAt, String(userAgent || '').slice(0, 200));

  return token;
}

function getSessionTokenFromCookie(cookieHeader) {
  if (!cookieHeader) return null;

  const cookies = cookieHeader.split(';').map(c => c.trim());
  const sessionCookie = cookies.find(c => c.startsWith('sauran_session='));

  if (!sessionCookie) return null;

  try {
    return decodeURIComponent(sessionCookie.substring('sauran_session='.length));
  } catch {
    return null;
  }
}

function getUserFromSessionToken(token) {
  if (!token) return null;

  const tokenHash = hashSessionToken(token);

  const user = db.prepare(`
    SELECT users.id, users.username, users.email, users.about_me,
           users.status, users.avatar_visibility, users.avatar_data, users.banner_data,
           users.minor_until, users.platform_role, users.dev_notice_seen, users.dev_notice_new, users.account_status,
           users.role_acceptance_pending, users.role_accepted_role, users.role_notice_kind, users.role_notice_at,
           sessions.expires_at
    FROM sessions
    INNER JOIN users ON users.id = sessions.user_id
    WHERE sessions.token_hash = ?
  `).get(tokenHash);

  if (!user) return null;

  // Askıdaki hesap: oturum satırı kalmış olsa bile doğrulanmaz.
  if (user.account_status === 'suspended') return null;

  if (new Date(user.expires_at).getTime() <= Date.now()) {
    db.prepare(`DELETE FROM sessions WHERE token_hash = ?`).run(tokenHash);
    return null;
  }

  try { touchUserActivity(user.id); } catch (_) { /* etkinlik kaydı hatası oturumu engellemez */ }

  return {
    id: user.id,
    username: user.username,
    email: user.email,
    about_me: user.about_me,
    status: user.status || 'signal',
    avatar_visibility: user.avatar_visibility || 'public',
    avatar_data: user.avatar_data,
    banner_data: user.banner_data,
    is_minor: isMinorUntil(user.minor_until),
    ...platformRoleFields(user),
    dev_notice: devNoticeFor(user.dev_notice_seen, user.dev_notice_new)
  };
}

function getUserFromRequest(req) {
  const token = getSessionTokenFromCookie(req.headers.cookie);
  return getUserFromSessionToken(token);
}

// Oturum çerezi TEK yerden üretilir. Bayraklar: HttpOnly; SameSite=Lax; Path=/; Max-Age=7 gün (SESSION_DURATION); ve aşağıdaki kurala göre Secure.
// Secure kuralı (yanlış yapılandırmaya dayanıklı): yalnızca AÇIKÇA yerel geliştirme (üretim değil + HTTP + localhost/127.0.0.1/::1) ise Secure eklenmez;
// aksi her durumda Secure eklenir. NODE_ENV unutulsa bile Render (RENDER=true) ya da HTTPS isteği (trust proxy ile X-Forwarded-Proto) ya da yerel olmayan
// bir host adı Secure çerez üretir; böylece çerez yanlışlıkla HTTP üzerinden gönderilemez.
const cookieProductionLike = isProduction || process.env.RENDER === 'true';
if (cookieProductionLike && !isProduction) {
  console.warn('UYARI: RENDER ortamı algılandı ama NODE_ENV=production değil; oturum çerezi yine de Secure üretilir. NODE_ENV=production ayarlayın.');
}
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

function shouldMarkSessionCookieSecure(req) {
  if (cookieProductionLike) return true;
  if (req.secure) return true; // HTTPS (doğrudan ya da güvenilen tek proxy'nin X-Forwarded-Proto'su)
  const host = String((req.headers && req.headers.host) || '').toLowerCase().replace(/:\d+$/, '').replace(/^\[|\]$/g, '');
  return !LOCAL_HOSTS.has(host);
}

function buildSessionCookie(req, value, maxAgeSeconds) {
  return `sauran_session=${value}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAgeSeconds}${shouldMarkSessionCookieSecure(req) ? '; Secure' : ''}`;
}

function setSessionCookie(req, res, token) {
  res.setHeader('Set-Cookie', buildSessionCookie(req, encodeURIComponent(token), SESSION_DURATION / 1000));
}

function clearSessionCookie(req, res) {
  res.setHeader('Set-Cookie', buildSessionCookie(req, '', 0));
}

// =====================================================
// ANA SAYFA
// =====================================================

// =====================================================
// KAYIT (YENİ)
// =====================================================

app.post('/api/register', registerLimiter, async (req, res) => {
  try {
    const { username, email, password, birth_date, terms_accepted } = req.body;

    const result = createVerification(username, email, password, birth_date, terms_accepted);

    if (!result.success) {
      return res.status(400).json(result);
    }

    // E-posta gönderimi yanıtı BEKLEMEZ ve adres kayıtlı olsa da olmasa da yanıt/süre aynıdır (e-posta numaralandırma yok). Gönderim hatası günlüğe yazılır.
    const mailJob = result.code ? sendVerificationEmail(email, result.code) : sendAccountExistsEmail(String(email || '').trim().toLowerCase());
    mailJob.catch((error) => console.error('Kayıt e-postası gönderilemedi:', error && error.code ? error.code : 'hata')); // hata metni alıcı adresi içerebilir: günlüğe yalnızca kod yazılır

    return res.json({ success: true, email });

  } catch (error) {
    console.error('Kayıt API hatası:', error);
    return res.status(500).json({ success: false, error: 'Kayıt sırasında bir hata oluştu.' });
  }
});

app.post('/api/verify', ...verifyLimiters, (req, res) => {
  try {
    const { email, code } = req.body;

    const result = verifyAndCreateUser(email, code);

    if (!result.success) {
      return res.status(400).json(result);
    }

    const sessionToken = createSession(result.id, req.headers['user-agent']);
    setSessionCookie(req, res, sessionToken);

    return res.json({
      success: true,
      user: {
        id: result.id,
        username: result.username,
        email: result.email,
        about_me: result.about_me,
        status: result.status,
        avatar_visibility: result.avatar_visibility,
        avatar_data: result.avatar_data,
        is_minor: result.is_minor,
        dev_notice: result.dev_notice
      }
    });

  } catch (error) {
    console.error('Doğrulama API hatası:', error);
    return res.status(500).json({ success: false, error: 'Doğrulama sırasında bir hata oluştu.' });
  }
});

// =====================================================
// GİRİŞ
// =====================================================

app.post('/api/login', loginLimiter, (req, res) => {
  try {
    const { username, password } = req.body;

    const loginValue = String(username || '').trim();

    if (!loginValue || !password) {
      return res.status(400).json({
        success: false,
        error: 'Kullanıcı adı/e-posta ve şifre gerekli.'
      });
    }

    if (loginValue.length > 254 || String(password).length > 1024) {
      return res.status(401).json({ success: false, error: 'Kullanıcı adı/e-posta veya şifre hatalı.' });
    }

    let actualUsername = loginValue;

    if (loginValue.includes('@')) {
      const userByEmail = db.prepare(`
        SELECT username FROM users WHERE LOWER(email) = LOWER(?)
      `).get(loginValue);

      if (userByEmail) {
        actualUsername = userByEmail.username;
      }
    }

    const result = loginUser(actualUsername, password);

    if (!result.success && result.suspended) {
      return res.status(403).json({
        success: false,
        suspended: true,
        error: 'Hesabınız geçici olarak askıya alındı.',
        suspension: { user_reason: result.user_reason, support_email: SUPPORT_EMAIL }
      });
    }

    if (!result.success) {
      return res.status(401).json({
        success: false,
        error: 'Kullanıcı adı/e-posta veya şifre hatalı.'
      });
    }

    const sessionToken = createSession(result.id, req.headers['user-agent']);
    setSessionCookie(req, res, sessionToken);

    return res.json({
      success: true,
      user: {
        id: result.id,
        username: result.username,
        email: result.email,
        about_me: result.about_me,
        status: result.status,
        avatar_visibility: result.avatar_visibility,
        avatar_data: result.avatar_data,
        platform_role: result.platform_role,
        assigned_platform_role: result.assigned_platform_role,
        role_acceptance: result.role_acceptance,
        role_notice: result.role_notice,
        dev_notice: result.dev_notice
      }
    });

  } catch (error) {
    console.error('Giriş API hatası:', error);
    return res.status(500).json({ success: false, error: 'Giriş sırasında bir hata oluştu.' });
  }
});

// =====================================================
// MEVCUT OTURUM
// =====================================================

app.get('/api/me', (req, res) => {
  try {
    const user = getUserFromRequest(req);

    if (!user) {
      return res.status(401).json({ success: false, error: 'Oturum bulunamadı.' });
    }

    return res.json({ success: true, user });

  } catch (error) {
    console.error('Session kontrol hatası:', error);
    return res.status(500).json({ success: false, error: 'Oturum kontrol edilemedi.' });
  }
});

// =====================================================
// OTURUM YÖNETİMİ (aktif cihazlar)
// =====================================================

app.get('/api/sessions', (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;

  const currentToken = getSessionTokenFromCookie(req.headers.cookie);
  const currentHash = currentToken ? hashSessionToken(currentToken) : null;

  const rows = db.prepare(`
    SELECT id, token_hash, user_agent, created_at, expires_at
    FROM sessions WHERE user_id = ? ORDER BY created_at DESC
  `).all(user.id);

  const sessions = rows.map(r => ({
    id: r.id,
    user_agent: r.user_agent,
    created_at: r.created_at,
    expires_at: r.expires_at,
    is_current: r.token_hash === currentHash
  }));

  return res.json({ success: true, sessions });
});

app.delete('/api/sessions/:id', (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;

  const info = db.prepare(`DELETE FROM sessions WHERE id = ? AND user_id = ?`).run(Number(req.params.id), user.id);

  if (!info.changes) return res.status(404).json({ success: false, error: 'Oturum bulunamadı.' });
  disconnectRevokedSockets(user.id);
  return res.json({ success: true });
});

app.post('/api/sessions/logout-all', (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;

  const currentToken = getSessionTokenFromCookie(req.headers.cookie);
  const currentHash = currentToken ? hashSessionToken(currentToken) : null;

  if (currentHash) {
    db.prepare(`DELETE FROM sessions WHERE user_id = ? AND token_hash != ?`).run(user.id, currentHash);
  } else {
    db.prepare(`DELETE FROM sessions WHERE user_id = ?`).run(user.id);
  }

  disconnectRevokedSockets(user.id);
  return res.json({ success: true });
});

// =====================================================
// HESABI SİL
// =====================================================

// Resmi görev kabulü. UI zorlamaları (scroll/checkbox) yalnızca kullanıcı deneyimidir;
// sunucu bekleyen kabulü, sürümü ve accepted/scrolled_to_end alanlarını tekrar doğrular.
app.post('/api/me/role-acceptance', (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;

  try {
    const result = acceptPlatformRole(user.id, {
      version: req.body?.version,
      scrolledToEnd: req.body?.scrolled_to_end,
      accepted: req.body?.accepted
    });

    if (!result.success) {
      return res.status(result.status).json({ success: false, error: result.error });
    }

    io.to(`user:${user.id}`).emit('platform_role_updated', { reason: 'accepted' });
    if (result.outbox_id) scheduleRoleNoticeEmails();
    return res.json({ success: true, role: result.role, version: result.version });
  } catch (error) {
    console.error('Görev kabulü hatası:', error);
    return res.status(500).json({ success: false, error: 'Kabul kaydedilemedi.' });
  }
});

// Görevi reddetme: bekleyen görev + sürüm sunucuda doğrulanır; okuma/kaydırma şartı yoktur.
app.post('/api/me/role-decline', (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;

  try {
    const result = declinePlatformRole(user.id, { version: req.body?.version });

    if (!result.success) {
      return res.status(result.status).json({ success: false, error: result.error });
    }

    io.to(`user:${user.id}`).emit('platform_role_updated', { reason: 'declined' });
    if (result.outbox_id) scheduleRoleNoticeEmails();
    return res.json({ success: true, role: result.role, version: result.version, result_role: result.result_role });
  } catch (error) {
    console.error('Görev reddi hatası:', error);
    return res.status(500).json({ success: false, error: 'Ret kaydedilemedi.' });
  }
});

// Görevden alma bilgilendirme panelinin "bir kez gösterildi" işareti.
app.post('/api/me/role-notice-seen', (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;

  try {
    markRoleNoticeSeen(user.id);
    return res.json({ success: true });
  } catch (error) {
    console.error('Görev bilgilendirme durumu kaydedilemedi:', error);
    return res.status(500).json({ success: false, error: 'Kaydedilemedi.' });
  }
});

app.post('/api/me/dev-notice-seen', (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;

  try {
    markDevNoticeSeen(user.id);
    return res.json({ success: true });
  } catch (error) {
    console.error('Bilgilendirme durumu kaydedilemedi:', error);
    return res.status(500).json({ success: false, error: 'Kaydedilemedi.' });
  }
});

app.get('/api/account/export', (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;

  try {

    const data = getAccountExport(user.id);
    if (!data) {
      return res.status(404).json({ success: false, error: 'Kullanıcı bulunamadı.' });
    }

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Disposition', `attachment; filename="sauran-verilerim-${user.username}.json"`);
    return res.send(JSON.stringify(data, null, 2));

  } catch (error) {
    console.error('Veri ihracı hatası:', error);
    return res.status(500).json({ success: false, error: 'Verilerin dışa aktarılamadı.' });
  }
});

// Hesap silme transaction'ından SONRAKİ adımlar (kullanıcının kendi silmesi ve hareketsiz hesap temizliği için ortak).
function finishAccountDeletion(userId, result) {
  // Açık soketler kapatılır (oturumlar zaten silindi; yeniden bağlanma da reddedilir).
  for (const sid of Array.from(activeUsers.get(userId) || [])) {
    io.sockets.sockets.get(sid)?.disconnect(true);
  }
  activeUsers.delete(userId);
  activeUserNames.delete(userId);

  finalizeHubPurge(result);
  logDataLifecycle('account_deleted', { accounts: 1, hubs_purged: (result.purged_hubs || result.purgedHubs || []).length });

  // DM karşı tarafları: sohbet penceresi açıksa sayfa yenilemeden "Silinmiş hesap / salt okunur" durumuna geçsin (mevcut user:<id> odaları).
  (result.forward_tombstoned || []).forEach((c) => {
    if (c.to_user_id) io.to(`user:${c.user_id}`).to(`user:${c.to_user_id}`).emit('dm_message_deleted', { id: c.id });
  });
  (result.dm_partners || []).forEach((p) => io.to(`user:${p.partner_id}`).emit('dm_partner_deleted', { user_id: userId, token: p.token }));
}

app.delete('/api/account', accountDeleteLimiter, (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;

  try {

    // Çalınmış/açık kalmış bir oturumla hesabın kalıcı silinmesini önlemek için parola ile yeniden doğrulama gerekir.
    if (!verifyAccountPassword(user.id, req.body && req.body.password)) {
      return res.status(403).json({ success: false, error: 'Hesabı silmek için mevcut şifreni doğru girmelisin.' });
    }

    // Tüm DB silme/güncelleme adımları tek transaction'da (bkz. deleteAccount): hata olursa hiçbir şey silinmez, başarı dönülmez.
    // Rapor/kanıt kayıtları fiziksel olarak silinmez (süreli saklama); yalnızca bu hesapla bağlantıları koparılır.
    const result = deleteAccount(user.id);

    // --- Transaction SONRASI (DB artık kalıcı olarak silindi) ---
    finishAccountDeletion(user.id, result);

    clearSessionCookie(req, res);
    return res.json({ success: true });

  } catch (error) {
    console.error('Hesap silme hatası:', error);
    return res.status(500).json({ success: false, error: 'Hesap silinemedi.' });
  }
});

// =====================================================
// PROFİL GÜNCELLEME
// =====================================================

app.patch('/api/profile/about', (req, res) => {
  try {
    const user = getUserFromRequest(req);

    if (!user) {
      return res.status(401).json({ success: false, error: 'Oturum bulunamadı.' });
    }

    const result = updateAboutMe(user.id, req.body.about_me);

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.json(result);

  } catch (error) {
    console.error('Hakkında güncelleme API hatası:', error);
    return res.status(500).json({ success: false, error: 'Güncellenemedi.' });
  }
});

app.patch('/api/profile/status', (req, res) => {
  try {
    const user = getUserFromRequest(req);

    if (!user) {
      return res.status(401).json({ success: false, error: 'Oturum bulunamadı.' });
    }

    const result = updateStatus(user.id, req.body.status);

    if (!result.success) {
      return res.status(400).json(result);
    }

    // Arkadaşların listesi durum değişikliğini anında görsün.
    io.emit('presence_changed');

    return res.json(result);

  } catch (error) {
    console.error('Durum güncelleme API hatası:', error);
    return res.status(500).json({ success: false, error: 'Güncellenemedi.' });
  }
});

app.patch('/api/profile/privacy', (req, res) => {
  try {
    const user = getUserFromRequest(req);

    if (!user) {
      return res.status(401).json({ success: false, error: 'Oturum bulunamadı.' });
    }

    const result = updatePrivacy(user.id, req.body.avatar_visibility);

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.json(result);

  } catch (error) {
    console.error('Gizlilik güncelleme API hatası:', error);
    return res.status(500).json({ success: false, error: 'Güncellenemedi.' });
  }
});

app.patch('/api/profile/avatar', (req, res) => {
  try {
    const user = getUserFromRequest(req);

    if (!user) {
      return res.status(401).json({ success: false, error: 'Oturum bulunamadı.' });
    }

    const result = updateAvatar(user.id, req.body.avatar_data ?? null);

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.json(result);

  } catch (error) {
    console.error('Avatar güncelleme API hatası:', error);
    return res.status(500).json({ success: false, error: 'Güncellenemedi.' });
  }
});

app.patch('/api/profile/banner', (req, res) => {
  try {
    const user = getUserFromRequest(req);

    if (!user) {
      return res.status(401).json({ success: false, error: 'Oturum bulunamadı.' });
    }

    const result = updateBanner(user.id, req.body.banner_data ?? null);

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.json(result);

  } catch (error) {
    console.error('Banner güncelleme API hatası:', error);
    return res.status(500).json({ success: false, error: 'Güncellenemedi.' });
  }
});

app.patch('/api/profile/username', (req, res) => {
  try {
    const user = getUserFromRequest(req);

    if (!user) {
      return res.status(401).json({ success: false, error: 'Oturum bulunamadı.' });
    }

    const result = updateUsername(user.id, req.body.username);

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.json(result);

  } catch (error) {
    console.error('Kullanıcı adı güncelleme API hatası:', error);
    return res.status(500).json({ success: false, error: 'Güncellenemedi.' });
  }
});

app.patch('/api/profile/password', passwordChangeLimiter, (req, res) => {
  try {
    const user = getUserFromRequest(req);

    if (!user) {
      return res.status(401).json({ success: false, error: 'Oturum bulunamadı.' });
    }

    const result = updatePassword(user.id, req.body.current_password, req.body.new_password);

    if (!result.success) {
      return res.status(400).json(result);
    }

    // Şifre değiştiğinde diğer tüm cihazlardaki oturumları kapat — sadece bu oturum kalır.
    const currentToken = getSessionTokenFromCookie(req.headers.cookie);
    const currentHash = currentToken ? hashSessionToken(currentToken) : null;
    if (currentHash) {
      db.prepare(`DELETE FROM sessions WHERE user_id = ? AND token_hash != ?`).run(user.id, currentHash);
    }

    disconnectRevokedSockets(user.id); // diğer cihazlardaki açık soketler de kapanır

    return res.json(result);

  } catch (error) {
    console.error('Şifre güncelleme API hatası:', error);
    return res.status(500).json({ success: false, error: 'Güncellenemedi.' });
  }
});

// =====================================================
// RAPORLAMA (REPORT)
// =====================================================

app.post('/api/reports', reportLimiter, (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;

  try {
    const result = createReport(user.id, req.body || {});

    if (!result.success) {
      return res.status(400).json(result);
    }

    // Rapor DB'ye zaten yazıldı — ana kayıt bu. E-posta bildirimi sadece
    // ek bir bilgilendirme kanalı; başarısız olsa bile raporu etkilemez,
    // yanıtı geciktirmemek için arka planda (fire-and-forget) gönderilir.
    try {
      const detail = getReportDetail(result.id);
      if (detail) {
        // Yalnızca minimum teknik alanlar geçirilir (mesaj içeriği/kullanıcı adı/açıklama e-postaya girmez).
        sendReportNotificationEmail({ id: detail.id, reason: detail.reason, priority: detail.priority, target_type: detail.target_type }).catch((error) => {
          console.error(`Rapor #${result.id} e-posta bildirimi gönderilemedi:`, error);
        });
      }
    } catch (error) {
      console.error(`Rapor #${result.id} e-posta bildirimi hazırlanamadı:`, error);
    }

    return res.json(result);

  } catch (error) {
    console.error('Bildirim oluşturma hatası:', error);
    res.status(500).json({ success: false, error: 'Bildirim gönderilemedi.' });
  }
});

// =====================================================
// WEB PUSH ABONELİK API'Sİ
// =====================================================

app.get('/api/push/public-key', (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;

  return res.json({ success: true, configured: push.isConfigured(), public_key: push.getPublicKey() });
});

app.post('/api/push/subscribe', (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;

  if (!push.isConfigured()) {
    return res.status(503).json({ success: false, error: 'Bildirim servisi yapılandırılmamış.' });
  }

  const result = savePushSubscription(user.id, req.body?.subscription, req.headers['user-agent']);
  return res.status(result.success ? 200 : 400).json(result);
});

// Android uygulaması (FCM): cihaz anahtarını kaydet / kaldır. Web Push'tan ayrıdır.
app.post('/api/fcm/register', (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;

  const result = saveFcmToken(user.id, req.body?.token, req.headers['user-agent']);
  // delivery: sunucu tarafında FCM gerçekten yapılandırılmış mı (istemci yerel bildirimi buna göre bırakır).
  return res.status(result.success ? 200 : 400).json({ ...result, delivery: fcm.isConfigured() });
});

app.post('/api/fcm/unregister', (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;

  if (typeof req.body?.token === 'string') removeFcmToken(req.body.token, user.id);
  return res.json({ success: true });
});

app.post('/api/push/unsubscribe', (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;

  if (typeof req.body?.endpoint === 'string') removePushSubscription(req.body.endpoint, user.id);
  return res.json({ success: true });
});

// =====================================================
// ÖNERİ / GERİ BİLDİRİM PANOSU
// =====================================================
// Herkese açık: giriş yapmış tüm kullanıcılar öneri yazabilir, listeyi
// görebilir ve oy verebilir. Moderasyon raporlarından (reports) ayrı.

app.get('/api/feedback', (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;

  const sort = req.query.sort === 'new' ? 'new' : 'top';

  try {
    res.json({ success: true, feedback: listFeedback(user.id, sort) });
  } catch (error) {
    console.error('Öneri listesi alınamadı:', error);
    res.status(500).json({ success: false, error: 'Öneriler yüklenemedi.' });
  }
});

app.post('/api/feedback', feedbackLimiter, (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;

  try {
    const result = createFeedback(user.id, req.body || {});
    if (!result.success) return res.status(400).json(result);
    return res.json(result);
  } catch (error) {
    console.error('Öneri oluşturma hatası:', error);
    res.status(500).json({ success: false, error: 'Öneri gönderilemedi.' });
  }
});

app.post('/api/feedback/:id/vote', (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;

  const feedbackId = Number(req.params.id);
  if (!feedbackId) return res.status(400).json({ success: false, error: 'Geçersiz öneri.' });

  try {
    const result = voteFeedback(user.id, feedbackId);
    if (!result.success) return res.status(404).json(result);
    return res.json(result);
  } catch (error) {
    console.error('Oy verme hatası:', error);
    res.status(500).json({ success: false, error: 'Oy verilemedi.' });
  }
});

// =====================================================
// MODERASYON PANELİ (yalnızca platform_role >= moderator)
// =====================================================
// Bu bölümdeki HER route requirePlatformRole ile başlar — normal bir
// kullanıcı (Hub sahibi olsa bile) buraya asla erişemez. Frontend'de bir
// buton gizlenmesi güvenlik değildir; asıl kontrol burada, server-side.

app.get('/api/moderation/meta', (req, res) => {
  const user = requirePlatformRole(req, res, 'moderator');
  if (!user) return;

  return res.json({
    success: true,
    reasons: REPORT_REASONS,
    statuses: REPORT_STATUSES,
    priorities: REPORT_PRIORITIES
  });
});

app.get('/api/moderation/reports', (req, res) => {
  const user = requirePlatformRole(req, res, 'moderator');
  if (!user) return;

  try {
    const filters = {};
    if (req.query.priority) filters.priority = String(req.query.priority);
    if (req.query.reason) filters.reason = String(req.query.reason);

    const status = req.query.status ? String(req.query.status) : null;
    const reports = listReports(status, filters);

    return res.json({ success: true, reports });

  } catch (error) {
    console.error('Moderasyon rapor listesi hatası:', error);
    res.status(500).json({ success: false, error: 'Raporlar alınamadı.' });
  }
});

app.get('/api/moderation/reports/:id', (req, res) => {
  const user = requirePlatformRole(req, res, 'moderator');
  if (!user) return;

  try {
    const detail = getReportDetail(Number(req.params.id));

    if (!detail) {
      return res.status(404).json({ success: false, error: 'Rapor bulunamadı.' });
    }

    return res.json({ success: true, report: detail });

  } catch (error) {
    console.error('Moderasyon rapor detay hatası:', error);
    res.status(500).json({ success: false, error: 'Rapor alınamadı.' });
  }
});

app.get('/api/moderation/users/:id', (req, res) => {
  const user = requirePlatformRole(req, res, 'moderator');
  if (!user) return;

  try {
    const detail = getModerationUserDetail(Number(req.params.id));

    if (!detail) {
      return res.status(404).json({ success: false, error: 'Kullanıcı bulunamadı.' });
    }

    return res.json({ success: true, user: detail });

  } catch (error) {
    console.error('Moderasyon kullanıcı detay hatası:', error);
    res.status(500).json({ success: false, error: 'Kullanıcı bilgisi alınamadı.' });
  }
});

// =====================================================
// FOUNDER / ADMIN PANELİ (yalnızca platform_role >= admin, SADECE OKUMA)
// =====================================================
// Kasıtlı olarak yalnızca GET: silme, export, rol değiştirme veya askıya alma
// endpoint'i YOKTUR. Kullanıcının kendi veri hakları (Verilerimi İndir /
// Hesabımı Sil) ayrı, mevcut sistemdir. Lobi sahipliği burada hiçbir yetki
// vermez — sadece users.platform_role belirleyicidir.

app.get('/api/admin/users', (req, res) => {
  const user = requirePlatformRole(req, res, 'admin');
  if (!user) return;

  const role = String(req.query.role || '');
  if (role && !PLATFORM_ROLES.includes(role)) {
    return res.status(400).json({ success: false, error: 'Geçersiz rol filtresi.' });
  }

  try {
    const result = listAdminUsers({
      page: req.query.page,
      limit: req.query.limit,
      search: req.query.search,
      role
    });
    return res.json({ success: true, ...result });
  } catch (error) {
    console.error('Admin kullanıcı listesi hatası:', error);
    res.status(500).json({ success: false, error: 'Kullanıcılar alınamadı.' });
  }
});

app.get('/api/admin/users/:id', (req, res) => {
  const user = requirePlatformRole(req, res, 'admin');
  if (!user) return;

  if (!/^[0-9]+$/.test(req.params.id)) {
    return res.status(400).json({ success: false, error: 'Geçersiz kullanıcı ID.' });
  }

  try {
    const detail = getAdminUserDetail(Number(req.params.id));
    if (!detail) return res.status(404).json({ success: false, error: 'Kullanıcı bulunamadı.' });
    return res.json({ success: true, ...detail });
  } catch (error) {
    console.error('Admin kullanıcı detay hatası:', error);
    res.status(500).json({ success: false, error: 'Kullanıcı bilgisi alınamadı.' });
  }
});

app.get('/api/admin/stats', (req, res) => {
  const user = requirePlatformRole(req, res, 'admin');
  if (!user) return;

  try {
    return res.json({ success: true, stats: { ...getAdminStats(), online_now: activeUsers.size } });
  } catch (error) {
    console.error('Admin istatistik hatası:', error);
    res.status(500).json({ success: false, error: 'İstatistikler alınamadı.' });
  }
});

// Platform rolü değiştirme: YALNIZCA founder. Hedef kullanıcı ID'si sadece URL'den,
// yeni rol ve gerekçe sadece gövdeden okunur; gövdedeki başka alanlar (actor,
// platform_role, id vb.) YOK SAYILIR. Rol + audit kaydı tek transaction'dadır.
// Rol değişikliği commit edildikten SONRA: canlı bildirim (socket) + e-posta outbox işleme.
// Hiçbiri rol değişikliğinin sonucunu etkilemez.
function deliverRoleNotice(userId, notice) {
  try {
    if (notice?.notification && !notice.notification.suppressed) {
      pushNotification(userId, notice.notification.type, notice.notification.data);
    }
    io.to(`user:${userId}`).emit('platform_role_updated', { reason: notice?.kind || 'changed' });
  } catch (error) {
    console.error('Rol bildirimi canlı iletilemedi:', error);
  }

  if (notice?.outbox_id) scheduleRoleNoticeEmails();
}

// E-posta outbox işleyicisi. Satırlar atomik olarak talep edilir (aynı satır iki kez
// gönderilmez); hata durumunda satır 'pending' + geri çekilme ile kalır ve tekrar denenir.
let roleEmailWorkerRunning = false;

async function processRoleNoticeEmails() {
  if (roleEmailWorkerRunning) return;
  roleEmailWorkerRunning = true;

  try {
    let row;
    while ((row = claimNextRoleNoticeEmail())) {
      try {
        const target = getRoleNoticeEmailTarget(row.user_id);

        if (row.type === 'team_accepted' || row.type === 'team_declined') {
          // Moderasyon ekibine giden kısa bilgilendirme: alıcı kullanıcı değil, ekip adresi.
          if (!target) {
            markRoleNoticeEmailSkipped(row.id, 'kullanıcı yok');
          } else {
            await sendRoleDecisionTeamEmail({
              username: target.username,
              userId: target.id,
              decision: row.type === 'team_accepted' ? 'accepted' : 'declined',
              role: row.role,
              version: row.version,
              resultRole: row.payload?.result_role,
              date: row.created_at
            });
            markRoleNoticeEmailSent(row.id);
          }
        } else if (!target || !target.email) {
          markRoleNoticeEmailSkipped(row.id, 'alıcı veya e-posta yok');
        } else if (target.account_status === 'suspended') {
          markRoleNoticeEmailSkipped(row.id, 'hesap askıda');
        } else if (row.type === 'assigned' && target.platform_role !== row.role) {
          // Aradan geçen sürede rol değişmiş: eski "görevlendirildiniz" e-postası yanıltıcı olur.
          markRoleNoticeEmailSkipped(row.id, 'atama güncelliğini yitirdi');
        } else {
          await sendRoleNoticeEmail({
            toEmail: target.email,
            username: target.username,
            type: row.type,
            role: row.role,
            version: row.version,
            payload: row.payload,
            date: row.created_at
          });
          markRoleNoticeEmailSent(row.id);
        }
      } catch (error) {
        console.error(`Rol bildirimi e-postası gönderilemedi (outbox #${row.id}, deneme ${row.attempts}):`, error.message);
        markRoleNoticeEmailFailed(row.id, error);
      }
    }
  } catch (error) {
    console.error('Rol e-postası işleyicisi hatası:', error);
  } finally {
    roleEmailWorkerRunning = false;
  }
}

function scheduleRoleNoticeEmails() {
  setImmediate(() => { processRoleNoticeEmails().catch(() => {}); });
}

app.patch('/api/admin/users/:id/role', adminWriteLimiter, (req, res) => {
  const actor = requirePlatformRole(req, res, 'founder');
  if (!actor) return;

  if (!/^[0-9]{1,15}$/.test(req.params.id)) {
    return res.status(400).json({ success: false, error: 'Geçersiz kullanıcı ID.' });
  }

  try {
    const result = changePlatformRole({
      actorId: actor.id,
      targetId: Number(req.params.id),
      newRole: req.body?.role,
      reason: req.body?.reason
    });

    if (!result.success) {
      return res.status(result.status).json({ success: false, error: result.error });
    }

    // Transaction (rol + audit + bildirim + outbox) commit edildi; bundan sonrası "en iyi
    // çaba"dır ve başarısız olsa bile rol değişikliğini/yanıtı etkilemez.
    deliverRoleNotice(result.id, result.notice);

    return res.json({
      success: true,
      user: {
        id: result.id,
        platform_role: result.new_role,
        role_acceptance_pending: result.acceptance_pending
      }
    });
  } catch (error) {
    console.error('Rol değiştirme hatası:', error);
    res.status(500).json({ success: false, error: 'Rol değiştirilemedi.' });
  }
});

// Hesap askıya alma / kaldırma: YALNIZCA founder. Hedef yalnızca URL'den, gerekçeler
// yalnızca gövdeden okunur (gövdedeki account_status, actor_user_id vb. yok sayılır).
// Askı transaction'ı (durum + oturum iptali + audit) başarıyla bittikten SONRA canlı
// socket bağlantıları kontrollü bir olayla bilgilendirilip kapatılır.
function terminateSuspendedUserSockets(userId, userReason) {
  try {
    const room = `user:${userId}`;
    io.to(room).emit('account_suspended', { user_reason: userReason || null, support_email: SUPPORT_EMAIL });
    io.in(room).disconnectSockets(true);
  } catch (error) {
    console.error('Askıdaki kullanıcının socket bağlantıları kapatılamadı:', error);
  }
}

app.patch('/api/admin/users/:id/suspend', adminWriteLimiter, (req, res) => {
  const actor = requirePlatformRole(req, res, 'founder');
  if (!actor) return;

  if (!/^[0-9]{1,15}$/.test(req.params.id)) {
    return res.status(400).json({ success: false, error: 'Geçersiz kullanıcı ID.' });
  }

  try {
    const targetId = Number(req.params.id);
    const result = suspendAccount({
      actorId: actor.id,
      targetId,
      internalReason: req.body?.internal_reason,
      userReason: req.body?.user_reason
    });

    if (!result.success) {
      return res.status(result.status).json({ success: false, error: result.error });
    }

    terminateSuspendedUserSockets(targetId, result.user_reason);

    return res.json({ success: true, user: { id: targetId, account_status: 'suspended' } });
  } catch (error) {
    console.error('Hesap askıya alma hatası:', error);
    res.status(500).json({ success: false, error: 'Hesap askıya alınamadı.' });
  }
});

app.patch('/api/admin/users/:id/unsuspend', adminWriteLimiter, (req, res) => {
  const actor = requirePlatformRole(req, res, 'founder');
  if (!actor) return;

  if (!/^[0-9]{1,15}$/.test(req.params.id)) {
    return res.status(400).json({ success: false, error: 'Geçersiz kullanıcı ID.' });
  }

  try {
    const targetId = Number(req.params.id);
    const result = unsuspendAccount({ actorId: actor.id, targetId, internalReason: req.body?.internal_reason });

    if (!result.success) {
      return res.status(result.status).json({ success: false, error: result.error });
    }

    return res.json({ success: true, user: { id: targetId, account_status: 'active' } });
  } catch (error) {
    console.error('Askı kaldırma hatası:', error);
    res.status(500).json({ success: false, error: 'Askı kaldırılamadı.' });
  }
});

// Audit Log: YALNIZCA founder okuyabilir. Kayıtlar bu API'den silinemez/düzenlenemez
// (böyle bir endpoint yoktur); ilk sürümde sadece yönetimsel DEĞİŞİKLİKLER loglanır,
// panel görüntülemeleri değil.
app.get('/api/admin/audit-log', (req, res) => {
  const user = requirePlatformRole(req, res, 'founder');
  if (!user) return;

  const isId = (v) => /^[0-9]{1,15}$/.test(String(v));
  const isDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`));

  const { action, actor_user_id, target_user_id, from, to } = req.query;

  if (action && !AUDIT_ACTIONS.includes(String(action))) {
    return res.status(400).json({ success: false, error: 'Geçersiz işlem filtresi.' });
  }
  if (actor_user_id && !isId(actor_user_id)) {
    return res.status(400).json({ success: false, error: 'Geçersiz yapan kullanıcı ID.' });
  }
  if (target_user_id && !isId(target_user_id)) {
    return res.status(400).json({ success: false, error: 'Geçersiz hedef kullanıcı ID.' });
  }
  if ((from && !isDate(String(from))) || (to && !isDate(String(to)))) {
    return res.status(400).json({ success: false, error: 'Tarih YYYY-AA-GG biçiminde olmalı.' });
  }

  try {
    const result = listAuditLog({
      page: req.query.page,
      limit: req.query.limit,
      action: action ? String(action) : '',
      actorUserId: actor_user_id ? Number(actor_user_id) : null,
      targetUserId: target_user_id ? Number(target_user_id) : null,
      from: from ? String(from) : '',
      to: to ? String(to) : ''
    });
    return res.json({ success: true, ...result });
  } catch (error) {
    console.error('Audit log listeleme hatası:', error);
    res.status(500).json({ success: false, error: 'Audit log alınamadı.' });
  }
});

app.patch('/api/moderation/reports/:id', (req, res) => {
  const user = requirePlatformRole(req, res, 'moderator');
  if (!user) return;

  try {
    const result = updateReportStatus(Number(req.params.id), user.id, req.body?.status, req.body?.reason);

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.json(result);

  } catch (error) {
    console.error('Moderasyon rapor güncelleme hatası:', error);
    res.status(500).json({ success: false, error: 'Güncellenemedi.' });
  }
});

// =====================================================
// ENGELLEME
// =====================================================

app.post('/api/users/:id/block', (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;

  try {
    const result = blockUser(user.id, Number(req.params.id));

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.json(result);

  } catch (error) {
    console.error('Engelleme API hatası:', error);
    res.status(500).json({ success: false, error: 'Engellenemedi.' });
  }
});

app.delete('/api/users/:id/block', (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;

  try {
    return res.json(unblockUser(user.id, Number(req.params.id)));
  } catch (error) {
    console.error('Engel kaldırma API hatası:', error);
    res.status(500).json({ success: false, error: 'Engel kaldırılamadı.' });
  }
});

app.get('/api/users/blocked', (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;

  try {
    return res.json({ success: true, blocked: listBlockedUsers(user.id) });
  } catch (error) {
    console.error('Engellenenler listesi hatası:', error);
    res.status(500).json({ success: false, error: 'Liste alınamadı.' });
  }
});

// =====================================================
// ÇIKIŞ
// =====================================================

app.post('/api/logout', (req, res) => {
  try {
    const token = getSessionTokenFromCookie(req.headers.cookie);

    if (token) {
      const tokenHash = hashSessionToken(token);
      db.prepare(`DELETE FROM sessions WHERE token_hash = ?`).run(tokenHash);
      disconnectRevokedSockets();
    }

    clearSessionCookie(req, res);
    return res.json({ success: true });

  } catch (error) {
    console.error('Çıkış API hatası:', error);
    return res.status(500).json({ success: false, error: 'Çıkış yapılamadı.' });
  }
});

// =====================================================
// HUB SİSTEMİ
// =====================================================

function requireAuth(req, res) {
  const user = getUserFromRequest(req);
  if (!user) {
    res.status(401).json({ success: false, error: 'Oturum bulunamadı.' });
    return null;
  }
  return user;
}

// =====================================================
// PLATFORM YETKİ KONTROLÜ (Hub rollerinden tamamen ayrı)
// =====================================================
// ÖNEMLİ: Bu, hub_members.permission_tier (owner/moderator/member) ile
// KARIŞTIRILMAMALI. Bir kullanıcı bir Hub'ın owner'ı olsa bile bu ona
// platform moderasyon yetkisi vermez — sadece users.platform_role
// (user/moderator/admin/founder) buradaki kararı belirler. Bu kolon
// web üzerinden hiçbir endpoint'ten yazılamaz, sadece CLI'den
// (node admin.js set-role) değiştirilebilir — bkz. server/admin.js.
//
// deny-by-default: requireAuth zaten başarısızsa 401 ile döner; burada
// da rol yetersizse 403 ile döner, hiçbir moderasyon route'u bu kontrolü
// atlayarak devam edemez.
function requirePlatformRole(req, res, minRole) {
  const user = requireAuth(req, res);
  if (!user) return null;

  if (!hasAtLeastPlatformRole(user.platform_role, minRole)) {
    res.status(403).json({ success: false, error: 'Bu işlem için yetkin yok.' });
    return null;
  }

  return user;
}

app.get('/api/hubs', (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;

  try {
    res.json({ success: true, hubs: listHubs(user.id) });
  } catch (error) {
    console.error('Hub listeleme hatası:', error);
    res.status(500).json({ success: false, error: 'Hublar alınamadı.' });
  }
});

app.post('/api/hubs', hubCreateLimiter, (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;

  try {
    const result = createHub(user.id, req.body);

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.json(result);

  } catch (error) {
    console.error('Hub oluşturma API hatası:', error);
    res.status(500).json({ success: false, error: 'Hub oluşturulamadı.' });
  }
});

app.patch('/api/hubs/:id', (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;

  try {
    const hubId = Number(req.params.id);
    const result = updateHub(hubId, user.id, req.body || {});

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.json(result);

  } catch (error) {
    console.error('Hub güncelleme hatası:', error);
    res.status(500).json({ success: false, error: 'Hub güncellenemedi.' });
  }
});

app.get('/api/hubs/:id', (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;

  try {
    const hubId = Number(req.params.id);

    if (!isHubMember(hubId, user.id)) {
      return res.status(403).json({ success: false, error: 'Bu Hub\'a üye değilsin.' });
    }

    const hub = getHubDetail(hubId, user.id);

    if (!hub) {
      return res.status(404).json({ success: false, error: 'Hub bulunamadı.' });
    }

    hub.members = hub.members.map(m => ({ ...m, online: isVisiblyOnline(m.user_id, m.status) }));

    return res.json({ success: true, hub });

  } catch (error) {
    console.error('Hub detay hatası:', error);
    res.status(500).json({ success: false, error: 'Hub alınamadı.' });
  }
});

app.post('/api/hubs/:id/role', (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;

  try {
    const result = setHubRole(Number(req.params.id), user.id, req.body?.role_id || null);

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.json(result);

  } catch (error) {
    console.error('Rol atama API hatası:', error);
    res.status(500).json({ success: false, error: 'Rol atanamadı.' });
  }
});

app.post('/api/hubs/:id/invite', inviteCreateLimiter, (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;

  try {
    const result = createHubInvite(Number(req.params.id), user.id);

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.json(result);

  } catch (error) {
    console.error('Davet oluşturma API hatası:', error);
    res.status(500).json({ success: false, error: 'Davet oluşturulamadı.' });
  }
});

app.post('/api/hubs/:id/invite-friend', (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;

  try {
    const result = sendHubInviteNotification(Number(req.params.id), user.id, user.username, Number(req.body?.to_user_id));

    if (!result.success) {
      return res.status(400).json(result);
    }

    pushNotification(Number(req.body?.to_user_id), 'hub_invite', { from_username: user.username });

    return res.json(result);

  } catch (error) {
    console.error('Hub daveti gönderme hatası:', error);
    res.status(500).json({ success: false, error: 'Davet gönderilemedi.' });
  }
});

app.post('/api/hubs/join', joinLimiter, (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;

  try {
    const result = joinHubByCode(req.body?.code, user.id);

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.json(result);

  } catch (error) {
    console.error('Davetle katılma API hatası:', error);
    res.status(500).json({ success: false, error: 'Katılınamadı.' });
  }
});

app.post('/api/hubs/:id/leave', (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;

  try {
    const result = leaveHub(Number(req.params.id), user.id);
    if (result.success) removeUserFromHubVoiceRooms(Number(req.params.id), user.id);
    return res.json(result);
  } catch (error) {
    console.error('Hub ayrılma API hatası:', error);
    res.status(500).json({ success: false, error: 'Ayrılınamadı.' });
  }
});

app.patch('/api/hubs/:id/mute', (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;

  try {
    const result = setHubMuted(Number(req.params.id), user.id, Boolean(req.body?.muted));
    if (!result.success) return res.status(400).json(result);
    return res.json(result);
  } catch (error) {
    console.error('Lobi susturma API hatası:', error);
    res.status(500).json({ success: false, error: 'Kaydedilemedi.' });
  }
});

app.post('/api/hubs/:id/roles', (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;

  try {
    const result = addHubRole(Number(req.params.id), user.id, req.body);

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.json(result);

  } catch (error) {
    console.error('Rol ekleme API hatası:', error);
    res.status(500).json({ success: false, error: 'Rol eklenemedi.' });
  }
});

app.get('/api/hubs/:id/messages', (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;

  const hubId = Number(req.params.id);

  if (!isHubMember(hubId, user.id)) {
    return res.status(403).json({ success: false, error: 'Bu Hub\'a üye değilsin.' });
  }

  try {
    res.json({ success: true, messages: getHubMessages(hubId, 50, user.id) });
  } catch (error) {
    console.error('Hub mesaj hatası:', error);
    res.status(500).json({ success: false, error: 'Mesajlar alınamadı.' });
  }
});

app.post('/api/hubs/:id/poll', (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;

  const hubId = Number(req.params.id);

  if (!isHubMember(hubId, user.id)) {
    return res.status(403).json({ success: false, error: 'Bu Hub\'a üye değilsin.' });
  }

  try {
    const result = createHubPoll(hubId, user.id, user.username, req.body?.question, req.body?.options);

    if (!result.success) {
      return res.status(400).json(result);
    }

    emitHubMessage(hubId, result.message);

    return res.json(result);

  } catch (error) {
    console.error('Anket oluşturma hatası:', error);
    res.status(500).json({ success: false, error: 'Anket oluşturulamadı.' });
  }
});

app.post('/api/hubs/:id/poll/:messageId/vote', (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;

  const hubId = Number(req.params.id);

  if (!isHubMember(hubId, user.id)) {
    return res.status(403).json({ success: false, error: 'Bu Hub\'a üye değilsin.' });
  }

  try {
    const result = voteHubPoll(Number(req.params.messageId), user.id, req.body?.option_index);

    if (!result.success) {
      return res.status(400).json(result);
    }

    io.to(`hub:${hubId}`).emit('hub_message_update', result.message);

    return res.json(result);

  } catch (error) {
    console.error('Oylama hatası:', error);
    res.status(500).json({ success: false, error: 'Oy kaydedilemedi.' });
  }
});

app.post('/api/hubs/:id/share', fileUploadLimiter, (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;

  const hubId = Number(req.params.id);

  if (!isHubMember(hubId, user.id)) {
    return res.status(403).json({ success: false, error: 'Bu Hub\'a üye değilsin.' });
  }

  try {
    const result = createHubShare(hubId, user.id, user.username, req.body?.content, req.body?.url);

    if (!result.success) {
      return res.status(400).json(result);
    }

    emitHubMessage(hubId, result.message);

    return res.json(result);

  } catch (error) {
    console.error('Paylaşım hatası:', error);
    res.status(500).json({ success: false, error: 'Paylaşılamadı.' });
  }
});

app.post('/api/hubs/:id/voice', fileUploadLimiter, (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;

  const hubId = Number(req.params.id);

  if (!isHubMember(hubId, user.id)) {
    return res.status(403).json({ success: false, error: 'Bu Hub\'a üye değilsin.' });
  }

  try {
    const result = createHubVoiceMessage(hubId, user.id, user.username, req.body?.audio_data, req.body?.duration);

    if (!result.success) {
      return res.status(400).json(result);
    }

    emitHubMessage(hubId, result.message);

    return res.json(result);

  } catch (error) {
    console.error('Sesli mesaj hatası:', error);
    res.status(500).json({ success: false, error: 'Gönderilemedi.' });
  }
});

app.post('/api/hubs/:id/file', fileUploadLimiter, (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;

  const hubId = Number(req.params.id);

  if (!isHubMember(hubId, user.id)) {
    return res.status(403).json({ success: false, error: 'Bu Hub\'a üye değilsin.' });
  }

  try {
    const result = createHubFileMessage(hubId, user.id, user.username, req.body?.file);

    if (!result.success) {
      return res.status(400).json(result);
    }

    emitHubMessage(hubId, result.message);

    return res.json(result);

  } catch (error) {
    console.error('Dosya mesajı hatası:', error);
    res.status(500).json({ success: false, error: 'Gönderilemedi.' });
  }
});

app.post('/api/hubs/:id/sticker', (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;

  const hubId = Number(req.params.id);

  if (!isHubMember(hubId, user.id)) {
    return res.status(403).json({ success: false, error: 'Bu Hub\'a üye değilsin.' });
  }

  try {
    const result = createHubSticker(hubId, user.id, user.username, req.body?.sticker_id);

    if (!result.success) {
      return res.status(400).json(result);
    }

    emitHubMessage(hubId, result.message);

    return res.json(result);

  } catch (error) {
    console.error('Çıkartma mesajı hatası:', error);
    res.status(500).json({ success: false, error: 'Gönderilemedi.' });
  }
});

// =====================================================
// SESLİ SOHBET (DAILY.CO)
// =====================================================

app.post('/api/hubs/:id/call/join', async (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;

  const hubId = Number(req.params.id);

  if (!isHubMember(hubId, user.id)) {
    return res.status(403).json({ success: false, error: 'Bu Hub\'a üye değilsin.' });
  }

  if (!daily.isConfigured()) {
    return res.status(503).json({ success: false, error: 'Sesli sohbet henüz yapılandırılmadı.' });
  }

  try {
    const roomName = getHubDailyRoomName(hubId) || `sauran-hub-${hubId}`;
    setHubDailyRoomName(hubId, roomName);

    const room = await daily.getOrCreateRoom(roomName);
    const roomUrl = room.url;

    // Daily'ye kullanıcı ADI gönderilmez (sabit ad + yalnızca sayısal kimlik); arayüz adları kendi katılımcı listesinden (Socket.io) çözer.
    const token = await daily.createMeetingToken(roomName, 'Sauran', user.id);

    return res.json({ success: true, room_url: roomUrl, token });

  } catch (error) {
    console.error('Sesli sohbet başlatma hatası:', error);
    res.status(500).json({ success: false, error: 'Sesli sohbete katılınamadı.' });
  }
});

// =====================================================
// SESLİ ODALAR (Hub içinde birden fazla oda)
// =====================================================

app.get('/api/hubs/:id/voice-rooms', (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;

  const hubId = Number(req.params.id);

  if (!isHubMember(hubId, user.id)) {
    return res.status(403).json({ success: false, error: 'Bu Hub\'a üye değilsin.' });
  }

  const rooms = listVoiceRooms(hubId).map(room => ({
    ...room,
    participants: serializeVoiceParticipants(room.id)
  }));

  return res.json({ success: true, rooms });
});

app.post('/api/hubs/:id/voice-rooms', (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;

  const hubId = Number(req.params.id);
  const result = createVoiceRoom(hubId, user.id, req.body?.name);

  if (!result.success) {
    return res.status(400).json(result);
  }

  io.to(`hub:${hubId}`).emit('voice_room_created', result.room);

  return res.json(result);
});

app.delete('/api/hubs/:id/voice-rooms/:roomId', (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;

  const hubId = Number(req.params.id);
  const roomId = Number(req.params.roomId);
  const result = deleteVoiceRoom(hubId, user.id, roomId);

  if (!result.success) {
    return res.status(400).json(result);
  }

  io.to(`hub:${hubId}`).to(`voiceroom:${roomId}`).emit('voice_room_deleted', { id: roomId });
  clearVoiceRoom(roomId);

  // Daily odası, DB transaction'ı içinde kuyruğa yazıldı; silme DB işlemi bittikten sonra (yanıtı geciktirmeden) denenir, başarısızsa kuyruk yeniden dener.
  finalizeHubPurge({ daily_room_names: result.daily_room_names });

  return res.json({ success: true });
});

app.post('/api/hubs/:id/voice-rooms/:roomId/join', async (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;

  const hubId = Number(req.params.id);
  const roomId = Number(req.params.roomId);

  if (!isHubMember(hubId, user.id)) {
    return res.status(403).json({ success: false, error: 'Bu Hub\'a üye değilsin.' });
  }

  const room = getVoiceRoom(roomId);
  if (!room || room.hub_id !== hubId) {
    return res.status(404).json({ success: false, error: 'Oda bulunamadı.' });
  }

  if (isVoiceRoomFull(roomId, user.id)) {
    return res.status(409).json({ success: false, error: `Bu oda dolu (en fazla ${MAX_VOICE_ROOM_PARTICIPANTS} kişi).` });
  }

  if (!daily.isConfigured()) {
    return res.status(503).json({ success: false, error: 'Sesli sohbet henüz yapılandırılmadı.' });
  }

  try {
    const roomName = getVoiceRoomDailyName(roomId) || `sauran-vr-${roomId}`;
    setVoiceRoomDailyName(roomId, roomName);

    const room = await daily.getOrCreateRoom(roomName);
    const roomUrl = room.url;

    const token = await daily.createMeetingToken(roomName, 'Sauran', user.id); // kullanıcı adı Daily'ye gitmez

    return res.json({ success: true, room_url: roomUrl, token, room_id: roomId, room_name: room.name });

  } catch (error) {
    console.error('Sesli oda başlatma hatası:', error);
    res.status(500).json({ success: false, error: 'Sesli odaya katılınamadı.' });
  }
});

// Özel (DM) sesli arama — sadece iki arkadaş arasında, kamera/ekran paylaşımı yok.
app.post('/api/dm/:userId/call/join', async (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;

  const otherId = Number(req.params.userId);

  if (!areFriends(user.id, otherId)) {
    return res.status(403).json({ success: false, error: 'Sadece arkadaşlarınla sesli arama yapabilirsin.' });
  }

  if (!daily.isConfigured()) {
    return res.status(503).json({ success: false, error: 'Sesli arama henüz yapılandırılmadı.' });
  }

  try {
    const [low, high] = [user.id, otherId].sort((a, b) => a - b);
    const roomName = `sauran-dm-${low}-${high}`;

    const room = await daily.getOrCreateRoom(roomName, { screenshare: false });
    const roomUrl = room.url;

    // Birebir DM aramasında arayüz katılımcı adlarını Daily'den okumaz; bu yüzden Daily'ye kullanıcı adı GÖNDERİLMEZ (veri minimizasyonu).
    const token = await daily.createMeetingToken(roomName, 'Sauran');

    return res.json({ success: true, room_url: roomUrl, token, room_name: roomName });

  } catch (error) {
    console.error('DM araması başlatma hatası:', error);
    res.status(500).json({ success: false, error: 'Aramaya katılınamadı.' });
  }
});

// =====================================================
// MESAJ SİLME / DÜZENLEME
// =====================================================

app.delete('/api/messages/:id', (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;

  try {
    const result = deleteMessage(Number(req.params.id), user.id);

    if (!result.success) {
      return res.status(400).json(result);
    }

    if (result.hub_id) {
      io.to(`hub:${result.hub_id}`).emit('hub_message_deleted', { id: result.id });
    } else if (result.to_user_id) {
      io.to(`user:${user.id}`).to(`user:${result.to_user_id}`).emit('dm_message_deleted', { id: result.id });
    }

    // Silinen mesajın forward kopyaları da içeriksiz kaldı: açık sohbet pencereleri sayfa yenilemeden güncellensin.
    (result.forward_copies || []).forEach((c) => {
      if (c.to_user_id) io.to(`user:${c.user_id}`).to(`user:${c.to_user_id}`).emit('dm_message_deleted', { id: c.id });
    });

    const { forward_copies, ...publicResult } = result;
    return res.json(publicResult);

  } catch (error) {
    console.error('Mesaj silme hatası:', error);
    res.status(500).json({ success: false, error: 'Silinemedi.' });
  }
});

app.patch('/api/messages/:id', (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;

  try {
    const result = editMessage(Number(req.params.id), user.id, req.body?.content);

    if (!result.success) {
      return res.status(400).json(result);
    }

    if (result.hub_id) {
      io.to(`hub:${result.hub_id}`).emit('hub_message_update', result.message);
    } else if (result.to_user_id) {
      io.to(`user:${user.id}`).to(`user:${result.to_user_id}`).emit('dm_message_update', result.message);
    }

    return res.json(result);

  } catch (error) {
    console.error('Mesaj düzenleme hatası:', error);
    res.status(500).json({ success: false, error: 'Düzenlenemedi.' });
  }
});

// =====================================================
// MESAJ AKSİYONLARI — Tepki / Sabitleme / İletme
// =====================================================
// NOT: Edit/Delete yukarıda zaten mevcuttu, dokunulmadı. Bunlar AŞAMA D'de
// eklenen yeni aksiyonlar — hepsi requireAuth + kendi fonksiyonu içindeki
// erişim/yetki kontrolüyle korunuyor (bkz. server/db.js).

app.post('/api/messages/:id/reactions', (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;

  try {
    const result = addReaction(Number(req.params.id), user.id, String(req.body?.emoji || ''));

    if (!result.success) return res.status(400).json(result);

    const payload = { id: Number(req.params.id), reactions: result.reactions };
    if (result.hub_id) {
      io.to(`hub:${result.hub_id}`).emit('hub_message_reaction', payload);
    } else if (result.to_user_id) {
      io.to(`user:${user.id}`).to(`user:${result.to_user_id}`).emit('dm_message_reaction', payload);
    }

    return res.json(result);

  } catch (error) {
    console.error('Tepki eklenirken hata:', error);
    res.status(500).json({ success: false, error: 'Tepki eklenemedi.' });
  }
});

app.delete('/api/messages/:id/reactions/:emoji', (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;

  try {
    const result = removeReaction(Number(req.params.id), user.id, decodeURIComponent(req.params.emoji));

    if (!result.success) return res.status(400).json(result);

    const payload = { id: Number(req.params.id), reactions: result.reactions };
    if (result.hub_id) {
      io.to(`hub:${result.hub_id}`).emit('hub_message_reaction', payload);
    } else if (result.to_user_id) {
      io.to(`user:${user.id}`).to(`user:${result.to_user_id}`).emit('dm_message_reaction', payload);
    }

    return res.json(result);

  } catch (error) {
    console.error('Tepki kaldırılırken hata:', error);
    res.status(500).json({ success: false, error: 'Tepki kaldırılamadı.' });
  }
});

app.post('/api/messages/:id/pin', (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;

  try {
    const result = pinMessage(Number(req.params.id), user.id);

    if (!result.success) return res.status(403).json(result);

    io.to(`hub:${result.hub_id}`).emit('hub_message_pinned', result.message);

    return res.json(result);

  } catch (error) {
    console.error('Mesaj sabitlenirken hata:', error);
    res.status(500).json({ success: false, error: 'Sabitlenemedi.' });
  }
});

app.delete('/api/messages/:id/pin', (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;

  try {
    const result = unpinMessage(Number(req.params.id), user.id);

    if (!result.success) return res.status(403).json(result);

    io.to(`hub:${result.hub_id}`).emit('hub_message_unpinned', result.message);

    return res.json(result);

  } catch (error) {
    console.error('Sabitleme kaldırılırken hata:', error);
    res.status(500).json({ success: false, error: 'Kaldırılamadı.' });
  }
});

app.post('/api/messages/:id/forward', (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;

  try {
    const toUserId = Number(req.body?.to_user_id);
    const result = forwardMessageToDm(Number(req.params.id), user.id, user.username, toUserId);

    if (!result.success) return res.status(400).json(result);

    emitDmMessage(result.message);

    return res.json(result);

  } catch (error) {
    console.error('Mesaj iletilirken hata:', error);
    res.status(500).json({ success: false, error: 'İletilemedi.' });
  }
});

// =====================================================
// AKTİF KULLANICILAR
// userId -> Set(socketId)
// =====================================================

const activeUsers = new Map();

// Oturumu artık geçerli olmayan (çıkış, oturum iptali, tümünden çıkış, şifre değişimi/sıfırlama, süre dolması) soketleri kapatır.
// userId verilirse yalnızca o hesabın, verilmezse tüm açık soketler denetlenir. Bir soket ancak KENDİ oturumu duruyorsa açık kalır.
function disconnectRevokedSockets(userId = null) {
  const ids = userId != null ? [userId] : Array.from(activeUsers.keys());
  const now = Date.now();
  for (const uid of ids) {
    for (const sid of Array.from(activeUsers.get(uid) || [])) {
      const s = io.sockets.sockets.get(sid);
      if (!s) continue;
      const h = s.data && s.data.tokenHash;
      const row = h ? db.prepare(`SELECT expires_at FROM sessions WHERE token_hash = ?`).get(h) : null;
      if (!row || new Date(row.expires_at).getTime() <= now) s.disconnect(true);
    }
  }
}
setInterval(() => { try { disconnectRevokedSockets(); } catch (e) { console.error('Soket oturum denetimi hatası:', e); } }, 5 * 60 * 1000).unref();
const activeUserNames = new Map(); // userId -> username (son bilinen)

function isUserOnline(userId) {
  const sockets = activeUsers.get(userId);
  return Boolean(sockets && sockets.size > 0);
}

// "Görünmez" (invisible) durumunu seçen kullanıcı gerçekten bağlı olsa bile
// başkalarına çevrimdışı görünmeli — presence (gerçek bağlantı) ile
// kullanıcının seçtiği manuel durum kavramsal olarak ayrı ama "invisible"
// özel olarak presence'ı maskeler (Discord/Slack'teki standart anlamıyla).
function isVisiblyOnline(userId, status) {
  return isUserOnline(userId) && status !== 'invisible';
}

// =====================================================
// WEB PUSH (uygulama kapalıyken/arka plandayken telefon bildirimi)
// =====================================================
// Kullanıcının ekranda görünür bir Sauran sekmesi/uygulaması varsa push
// GÖNDERİLMEZ (o durumda istemci kendi bildirimini/sesini gösteriyor);
// aksi halde — bağlantı yoksa ya da uygulama arka plandaysa — abone olan
// tüm cihazlarına gönderilir. Tercihler (kategori + masaüstü/mobil bildirim
// anahtarı) her seferinde sunucuda kontrol edilir.

function userHasVisibleSocket(userId) {
  for (const sid of activeUsers.get(userId) || []) {
    if (io.sockets.sockets.get(sid)?.data.visible) return true;
  }
  return false;
}

async function dispatchWebPush(userId, type, payload) {

  const webPushOn = push.isConfigured();
  const fcmOn = fcm.isConfigured();
  if (!webPushOn && !fcmOn) return;

  // Askıdaki (veya artık var olmayan) hesabın cihazlarına — mesaj önizlemesi dahil —
  // hiçbir bildirim gönderilmez. Abonelik satırları silinmez (askı geri alınabilir).
  const acct = db.prepare(`SELECT account_status FROM users WHERE id = ?`).get(userId);
  if (!acct || acct.account_status === 'suspended') return;

  const prefs = getNotificationPreferences(userId);
  const categoryColumn = NOTIFICATION_CATEGORY_MAP[type];
  if (categoryColumn && prefs[categoryColumn] === 0) return;
  if (prefs.desktop_enabled === 0) return;
  if (userHasVisibleSocket(userId)) return;

  if (webPushOn) {
    const subscriptions = listPushSubscriptions(userId);

    await Promise.all(subscriptions.map(async (sub) => {
      try {
        await push.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          { ...payload, type }
        );
      } catch (error) {
        // Süresi dolmuş/geçersiz abonelikleri temizle.
        if (error.statusCode === 404 || error.statusCode === 410) removePushSubscription(sub.endpoint);
        else console.error('Web push hatası:', error.statusCode || error.message);
      }
    }));
  }

  // Android uygulaması (FCM): aynı kurallardan (askı, tercihler, ekranda görünür mü) sonra gönderilir.
  if (fcmOn) {
    try {
      const tokens = listFcmTokens(userId);
      const invalid = await fcm.sendToTokens(tokens, { ...payload, type });
      invalid.forEach((token) => removeFcmToken(token));
    } catch (error) {
      console.error('FCM hatası:', error.message);
    }
  }

}

function messagePushPreview(message) {
  const labels = {
    dm_voice: '🎤 Sesli mesaj', voice: '🎤 Sesli mesaj',
    dm_file: '📎 Dosya', file: '📎 Dosya',
    dm_image: '🖼 Fotoğraf', image: '🖼 Fotoğraf',
    dm_video: '🎬 Video', video: '🎬 Video',
    dm_sticker: '🖼 Çıkartma', sticker: '🖼 Çıkartma',
    poll: '📊 Anket', share: '🔗 Paylaşım'
  };
  return labels[message.kind] || String(message.content || 'Yeni mesaj').slice(0, 140);
}

// Tüm DM türleri (yazı, sesli, dosya, çıkartma, iletme) buradan geçer.
function emitDmMessage(message) {

  io.to(`user:${message.user_id}`).to(`user:${message.to_user_id}`).emit('dm_message', message);

  if (!message.to_user_id || message.to_user_id === message.user_id) return;

  dispatchWebPush(message.to_user_id, 'dm_message', {
    title: message.username,
    body: messagePushPreview(message),
    url: `/?open_dm=${message.user_id}&name=${encodeURIComponent(message.username)}`,
    tag: `dm-${message.user_id}`
  }).catch(error => console.error('Web push gönderilemedi:', error));

}

// Lobi mesajı: gönderen hariç tüm üyelere (tercihleri dispatchWebPush'ta kontrol edilir).
function emitHubMessage(hubId, message) {

  io.to(`hub:${hubId}`).emit('hub_message', message);

  if (!push.isConfigured() || !message?.user_id) return;

  const info = getHubPushInfo(hubId);
  if (!info) return;

  const body = `${message.username}: ${messagePushPreview(message)}`;

  for (const memberId of info.member_ids) {
    if (memberId === message.user_id) continue;

    dispatchWebPush(memberId, 'hub_message', {
      title: info.name,
      body,
      url: `/?open_hub=${hubId}`,
      tag: `hub-${hubId}`
    }).catch(error => console.error('Web push gönderilemedi:', error));
  }

}

// =====================================================
// MERKEZİ BİLDİRİM SERVİSİ
// =====================================================
// Tüm özellikler (arkadaşlık, Hub daveti, aramalar, vb.) kullanıcıya bildirim
// göndermek için BUNU kullanmalı — kendi socket.emit + tercih kontrolünü
// yazmamalı. AŞAMA 3/4'te buraya tarayıcı bildirimi ve ses dağıtımı eklenecek.

const NOTIFICATION_CATEGORY_MAP = {
  friend_request: 'notify_friend_request',
  friend_request_accepted: 'notify_friend_accepted',
  hub_invite: 'notify_hub_event',
  dm_message: 'notify_dm_message',
  hub_message: 'notify_hub_message',
  incoming_call: 'notify_incoming_call',
  missed_call: 'notify_missed_call',
  system: 'notify_system',
  platform_role_notice: 'notify_system',
  platform_role_revoked: 'notify_system'
};

// NOT: Bildirimin veritabanına yazılması bu fonksiyonun işi DEĞİL — o iş
// ilgili db.js fonksiyonuna (ör. sendFriendRequest, sendHubInviteNotification)
// ait ve her zaman gerçekleşir (kullanıcı bildirimi kapatmış olsa bile
// Bildirimler panelinde geçmişte görünsün diye). Bu fonksiyon SADECE gerçek
// zamanlı (socket) dağıtımı, kullanıcının tercihine göre kontrollü yapar.
function pushNotification(userId, type, data) {

  // Askıdaki hesap için ne uygulama içi ne de Web Push bildirimi üretilir.
  if (isAccountSuspended(userId)) return;

  const prefs = getNotificationPreferences(userId);
  const categoryColumn = NOTIFICATION_CATEGORY_MAP[type];
  const categoryEnabled = !categoryColumn || prefs[categoryColumn] !== 0;

  // Kategori tamamen kapalıysa gerçek zamanlı hiçbir kanala gönderme (yine de
  // bildirim geçmişte DB'de duruyor — bkz. çağıran fonksiyonlardaki
  // createNotification). Kategori açıksa hangi kanalların (uygulama içi /
  // masaüstü / ses) kullanılacağına istemci, gelen 'channels' bilgisine göre
  // karar verir — böylece "uygulama içi bildirimleri kapat ama masaüstü
  // bildirimleri açık kalsın" gibi bağımsız tercihler çalışır.
  if (!categoryEnabled) return;

  const webPushLabel = {
    friend_request: `${data?.from_username || 'Biri'} sana arkadaşlık isteği gönderdi.`,
    friend_request_accepted: `${data?.from_username || 'Biri'} arkadaşlık isteğini kabul etti.`,
    hub_invite: `${data?.from_username || 'Biri'} seni ${data?.hub_name || 'bir'} lobisine davet etti.`,
    platform_role_notice: 'Sauran Yönetim: Yeni bir görev bildirimin var.',
    platform_role_revoked: 'Sauran Yönetim: Yönetim görevin hakkında bir bilgilendirme var.'
  }[type];

  if (webPushLabel) {
    dispatchWebPush(userId, type, { title: 'Sauran', body: webPushLabel, url: '/', tag: `notif-${type}` })
      .catch(error => console.error('Web push gönderilemedi:', error));
  }

  const targetSockets = activeUsers.get(userId);
  if (targetSockets) {
    targetSockets.forEach(sid => io.to(sid).emit('notification_received', {
      type,
      data,
      channels: {
        inapp: prefs.inapp_enabled !== 0,
        desktop: prefs.desktop_enabled !== 0,
        sound: prefs.sound_enabled !== 0
      }
    }));
  }

}

// =====================================================
// DM SESLİ ARAMA YAŞAM DÖNGÜSÜ (bellek içi)
// =====================================================
// Sunucu, çalan ve cevaplanmış aramaları izler: (1) alıcı uygulamayı sonradan açarsa (bildirime dokunarak) çalan arama yeniden iletilir,
// (2) arama bitince sohbete "Sesli arama · süre / Cevapsız / Reddedildi" kaydı yazılır. Kayıt yalnızca durum + süre + zaman içerir.
const DM_CALL_RING_MS = 45 * 1000;
const pendingDmCalls = new Map(); // arayanId -> { toId, callerName, at, timer }
const activeDmCalls = new Map();  // "küçükId:büyükId" -> { callerId, calleeId, callerName, answeredAt }
const dmPairKey = (a, b) => (a < b ? `${a}:${b}` : `${b}:${a}`);

function logDmCall(callerId, callerName, calleeId, status, durationSec) {
  try {
    const result = saveDmCallLog(callerId, callerName, calleeId, status, durationSec);
    if (result && result.success) io.to(`user:${callerId}`).to(`user:${calleeId}`).emit('dm_message', result.message);
  } catch (error) {
    console.error('Arama kaydı yazılamadı:', error);
  }
}

function clearPendingDmCall(callerId) {
  const pending = pendingDmCalls.get(callerId);
  if (!pending) return null;
  clearTimeout(pending.timer);
  pendingDmCalls.delete(callerId);
  return pending;
}

// Çalan arama cevapsız bitti (arayan iptal etti, süre doldu ya da bağlantısı koptu).
function finishMissedDmCall(callerId, reason) {
  const pending = clearPendingDmCall(callerId);
  if (!pending) return;
  logDmCall(callerId, pending.callerName, pending.toId, 'missed');
  io.to(`user:${pending.toId}`).emit('dm_call_cancelled', { from_user_id: callerId });
  if (reason === 'timeout') io.to(`user:${callerId}`).emit('dm_call_missed', { to_user_id: pending.toId });
}

// Cevaplanmış arama bitti: süreyi hesapla ve kaydı yaz (tek sefer; iki taraf da 'end' gönderse de tekrar yazılmaz).
function finishAnsweredDmCall(userA, userB) {
  const key = dmPairKey(userA, userB);
  const call = activeDmCalls.get(key);
  if (!call) return false;
  activeDmCalls.delete(key);
  logDmCall(call.callerId, call.callerName, call.calleeId, 'answered', Math.round((Date.now() - call.answeredAt) / 1000));
  return true;
}

// =====================================================
// SESLİ ODA PRESENCE (bellek içi, sunucu otoritesi)
// roomId -> Map(userId -> { user_id, username, muted, socketId, hubId })
// =====================================================
// Socket.io yalnızca "kim odada / mikrofon durumu" bilgisini taşır; ses
// aktarımı (WebRTC) Daily üzerinden ayrı yürür. Üyelik yalnızca bu
// sunucu tarafından değiştirilir: istemci sadece istekte bulunur, tüm
// istemciler sunucunun yayınladığı anlık görüntüyü (snapshot) gösterir.
// Odadaki socket'ler ayrıca `voiceroom:<id>` odasındadır — kullanıcı
// Hub ekranından çıksa (`hub:<id>` odasından ayrılsa) bile güncellemeleri
// almaya devam eder.

const voiceRoomParticipants = new Map();

// Mobil uygulama arka plana alınınca socket kısa süre kopabilir (Daily/WebRTC bağlantısı açık kalır). Katılımcı hemen
// listeden silinmesin diye kopmada kısa bir tolerans süresi tanınır; süre içinde aynı kullanıcı yeniden katılırsa kayıt korunur.
const VOICE_DISCONNECT_GRACE_MS = 25 * 1000;

function serializeVoiceParticipants(roomId) {
  return Array.from(voiceRoomParticipants.get(roomId)?.values() || []).map(p => ({
    user_id: p.user_id,
    username: p.username,
    muted: p.muted,
    deafened: p.deafened
  }));
}

function broadcastVoiceRoom(hubId, roomId, change) {
  io.to(`hub:${hubId}`).to(`voiceroom:${roomId}`).emit('voice_room_participants_updated', {
    room_id: roomId,
    hub_id: hubId,
    participants: serializeVoiceParticipants(roomId),
    change: change || null
  });
}

// Zaten odada olan kullanıcı (yeniden bağlanma / cihaz devri) kapasiteye takılmaz.
function isVoiceRoomFull(roomId, userId) {
  const members = voiceRoomParticipants.get(roomId);
  if (!members || members.has(userId)) return false;
  return members.size >= MAX_VOICE_ROOM_PARTICIPANTS;
}

function findUserVoiceRoom(userId) {
  for (const [roomId, members] of voiceRoomParticipants.entries()) {
    const entry = members.get(userId);
    if (entry) return { roomId, entry };
  }
  return null;
}

// socketId verilirse yalnızca o socket'in kaydını siler (eski/yenilenmiş
// bağlantı yeni bir katılımı yanlışlıkla silmesin diye).
function removeVoiceParticipant(userId, roomId, socketId) {
  const members = voiceRoomParticipants.get(roomId);
  const entry = members?.get(userId);
  if (!entry) return false;
  if (socketId && entry.socketId !== socketId) return false;

  if (entry.graceTimer) { clearTimeout(entry.graceTimer); entry.graceTimer = null; }
  members.delete(userId);
  if (members.size === 0) voiceRoomParticipants.delete(roomId);

  const sock = io.sockets.sockets.get(entry.socketId);
  if (sock) {
    sock.leave(`voiceroom:${roomId}`);
    if (sock.data.voiceRoomId === roomId) {
      sock.data.voiceRoomId = null;
      sock.data.voiceRoomHubId = null;
    }
  }

  broadcastVoiceRoom(entry.hubId, roomId, { type: 'left', user_id: userId, username: entry.username });
  return true;
}

function removeUserFromHubVoiceRooms(hubId, userId) {
  for (const [roomId, members] of Array.from(voiceRoomParticipants.entries())) {
    if (members.get(userId)?.hubId === hubId) removeVoiceParticipant(userId, roomId);
  }
}

function clearVoiceRoom(roomId) {
  voiceRoomParticipants.delete(roomId);
  io.in(`voiceroom:${roomId}`).socketsLeave(`voiceroom:${roomId}`);
}

// =====================================================
// HUB SİLME
// =====================================================

// Lobi(ler) DB'den silindikten SONRA: bellekteki sesli oda katılımcılarını temizle ve Daily oda silmelerini başlat.
// Daily çağrıları DB transaction'ının dışındadır; oda adları transaction içinde kalıcı kuyruğa yazılmıştır (daily_room_cleanup).
function finalizeHubPurge(result) {
  (result.voice_room_ids || []).forEach(roomId => clearVoiceRoom(roomId));
  if ((result.daily_room_names || []).length) processDailyRoomCleanup().catch(() => {});
}

let dailyCleanupRunning = false;

async function processDailyRoomCleanup() {
  if (dailyCleanupRunning || !daily.isConfigured()) return;
  dailyCleanupRunning = true;

  try {
    for (const row of listDueDailyRoomCleanups(20)) {
      try {
        await daily.deleteRoom(row.room_name);
        completeDailyRoomCleanup(row.room_name);
      } catch (error) {
        failDailyRoomCleanup(row.room_name, error.message);
        console.error(`Daily oda temizliği başarısız (yeniden denenecek): ${row.room_name}:`, error.message);
      }
    }
  } finally {
    dailyCleanupRunning = false;
  }
}

app.delete('/api/hubs/:id/messages', (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;

  const hubId = Number(req.params.id);

  try {
    const result = clearHubMessages(hubId, user.id);

    if (!result.success) {
      return res.status(403).json(result);
    }

    io.to(`hub:${hubId}`).emit('hub_chat_cleared', { hub_id: hubId });

    return res.json(result);

  } catch (error) {
    console.error('Lobi sohbeti temizleme hatası:', error);
    res.status(500).json({ success: false, error: 'Sohbet temizlenemedi.' });
  }
});

app.delete('/api/hubs/:id', (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;

  try {
    const result = deleteHub(Number(req.params.id), user.id);

    if (!result.success) {
      return res.status(400).json(result);
    }

    finalizeHubPurge({ voice_room_ids: result.voice_room_ids, daily_room_names: result.daily_room_names });

    return res.json({ success: true });

  } catch (error) {
    console.error('Hub silme API hatası:', error);
    res.status(500).json({ success: false, error: 'Hub silinemedi.' });
  }
});

// =====================================================
// HUB YETKİ / MODERASYON (owner / moderator / member)
// =====================================================

function kickUserFromHubSockets(hubId, userId, eventName) {
  const sockets = activeUsers.get(userId);
  if (sockets) {
    sockets.forEach(sid => io.to(sid).emit(eventName, { hub_id: hubId }));
  }
  // Aktif sesli oda bağlantısı varsa da kes.
  removeUserFromHubVoiceRooms(hubId, userId);
}

app.post('/api/hubs/:id/members/:userId/moderator', (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;

  const hubId = Number(req.params.id);
  const targetId = Number(req.params.userId);
  const result = setModerator(hubId, user.id, targetId, Boolean(req.body?.moderator));

  if (!result.success) return res.status(400).json(result);

  io.to(`hub:${hubId}`).emit('hub_members_changed', { hub_id: hubId });
  return res.json(result);
});

app.post('/api/hubs/:id/members/:userId/kick', (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;

  const hubId = Number(req.params.id);
  const targetId = Number(req.params.userId);
  const result = kickMember(hubId, user.id, targetId);

  if (!result.success) return res.status(400).json(result);

  kickUserFromHubSockets(hubId, targetId, 'hub_kicked');
  io.to(`hub:${hubId}`).emit('hub_members_changed', { hub_id: hubId });
  return res.json(result);
});

app.post('/api/hubs/:id/members/:userId/ban', (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;

  const hubId = Number(req.params.id);
  const targetId = Number(req.params.userId);
  const result = banMember(hubId, user.id, targetId);

  if (!result.success) return res.status(400).json(result);

  kickUserFromHubSockets(hubId, targetId, 'hub_banned');
  io.to(`hub:${hubId}`).emit('hub_members_changed', { hub_id: hubId });
  return res.json(result);
});

app.post('/api/hubs/:id/members/:userId/unban', (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;

  const result = unbanMember(Number(req.params.id), user.id, Number(req.params.userId));
  if (!result.success) return res.status(400).json(result);
  return res.json(result);
});

app.post('/api/hubs/:id/members/:userId/mute', (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;

  const hubId = Number(req.params.id);
  const targetId = Number(req.params.userId);

  const actorTier = getMemberTier(hubId, user.id);
  if (actorTier !== 'owner' && actorTier !== 'moderator') {
    return res.status(403).json({ success: false, error: 'Bu işlem için yetkin yok.' });
  }

  // Hedef bu lobinin üyesi olmalı; kurucu susturulamaz; moderatör yalnızca üyeleri susturabilir (moderatörü yalnızca kurucu).
  const targetTier = getMemberTier(hubId, targetId);
  if (targetId === user.id) return res.status(400).json({ success: false, error: 'Kendini susturamazsın.' });
  if (!targetTier) return res.status(400).json({ success: false, error: 'Kullanıcı bu Hub üyesi değil.' });
  if (targetTier === 'owner') return res.status(403).json({ success: false, error: 'Hub sahibi susturulamaz.' });
  if (targetTier === 'moderator' && actorTier !== 'owner') {
    return res.status(403).json({ success: false, error: 'Yalnızca Hub sahibi bir moderatörü susturabilir.' });
  }

  const sockets = activeUsers.get(targetId);
  if (sockets) sockets.forEach(sid => io.to(sid).emit('hub_force_muted', { hub_id: hubId }));

  return res.json({ success: true });
});

app.get('/api/hubs/:id/bans', (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;

  const hubId = Number(req.params.id);
  if (getMemberTier(hubId, user.id) !== 'owner' && getMemberTier(hubId, user.id) !== 'moderator') {
    return res.status(403).json({ success: false, error: 'Bu işlem için yetkin yok.' });
  }

  return res.json({ success: true, bans: listHubBans(hubId, user.id) });
});

// =====================================================
// ARKADAŞLIK
// =====================================================

app.get('/api/friends', (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;

  try {
    const friends = listFriends(user.id).map(f => ({ ...f, online: isVisiblyOnline(f.id, f.status) }));
    return res.json({ success: true, friends });
  } catch (error) {
    console.error('Arkadaş listesi hatası:', error);
    res.status(500).json({ success: false, error: 'Arkadaşlar alınamadı.' });
  }
});

app.get('/api/friends/top', (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;

  try {
    const friends = getTopFriends(user.id, 5).map(f => ({ ...f, online: isVisiblyOnline(f.id, f.status) }));
    return res.json({ success: true, friends });
  } catch (error) {
    console.error('Sık tercihler hatası:', error);
    res.status(500).json({ success: false, error: 'Alınamadı.' });
  }
});

// =====================================================
// BİLDİRİMLER
// =====================================================

app.get('/api/notifications', (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;

  try {
    return res.json({ success: true, notifications: listNotifications(user.id) });
  } catch (error) {
    console.error('Bildirim listesi hatası:', error);
    res.status(500).json({ success: false, error: 'Alınamadı.' });
  }
});

app.post('/api/notifications/:id/respond', (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;

  try {
    const result = respondHubInviteNotification(Number(req.params.id), user.id, Boolean(req.body?.accept));

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.json(result);

  } catch (error) {
    console.error('Bildirim yanıtlama hatası:', error);
    res.status(500).json({ success: false, error: 'Yanıtlanamadı.' });
  }
});

app.get('/api/notifications/preferences', (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;

  try {
    return res.json({ success: true, preferences: getNotificationPreferences(user.id) });
  } catch (error) {
    console.error('Bildirim tercihleri alınamadı:', error);
    res.status(500).json({ success: false, error: 'Alınamadı.' });
  }
});

app.patch('/api/notifications/preferences', (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;

  try {
    const result = updateNotificationPreferences(user.id, req.body || {});
    return res.json(result);
  } catch (error) {
    console.error('Bildirim tercihleri güncellenemedi:', error);
    res.status(500).json({ success: false, error: 'Güncellenemedi.' });
  }
});

app.post('/api/notifications/read-all', (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;

  try {
    return res.json(markAllNotificationsRead(user.id));
  } catch (error) {
    console.error('Bildirimleri okundu işaretleme hatası:', error);
    res.status(500).json({ success: false, error: 'İşaretlenemedi.' });
  }
});

// Kullanıcı kendi bildirimlerini siler; yanıt bekleyen bildirimler korunur.
app.delete('/api/notifications', (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;

  try {
    return res.json(clearNotifications(user.id));
  } catch (error) {
    console.error('Bildirimleri silme hatası:', error);
    res.status(500).json({ success: false, error: 'Silinemedi.' });
  }
});

app.delete('/api/notifications/:id', (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;

  if (!/^[0-9]{1,15}$/.test(req.params.id)) {
    return res.status(400).json({ success: false, error: 'Geçersiz bildirim.' });
  }

  try {
    const result = deleteNotification(Number(req.params.id), user.id);
    if (!result.success) return res.status(404).json(result);
    return res.json(result);
  } catch (error) {
    console.error('Bildirim silme hatası:', error);
    res.status(500).json({ success: false, error: 'Silinemedi.' });
  }
});

app.post('/api/notifications/:id/read', (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;

  try {
    const result = markNotificationRead(Number(req.params.id), user.id);
    if (!result.success) return res.status(404).json(result);
    return res.json(result);
  } catch (error) {
    console.error('Bildirim okundu işaretleme hatası:', error);
    res.status(500).json({ success: false, error: 'İşaretlenemedi.' });
  }
});

// =====================================================
// ŞİFREMİ UNUTTUM
// =====================================================

app.post('/api/password-reset/request', passwordResetLimiter, async (req, res) => {
  try {
    const result = requestPasswordReset(req.body?.email);

    // Hesabın var olup olmadığını istemciye sızdırmamak için (kullanıcı
    // numaralandırma saldırısına karşı), bulunamasa bile aynı genel yanıt
    // döndürülür — e-posta yalnızca hesap gerçekten varsa gönderilir.
    if (result.success) {
      const user = db.prepare(`SELECT email FROM users WHERE id = ?`).get(result.userId);
      // Yanıt e-posta gönderimini BEKLEMEZ (hesap var/yok zamanlama farkı olmasın); hata günlüğe yazılır.
      sendPasswordResetEmail(user.email, result.code).catch((error) => console.error('Şifre sıfırlama e-postası gönderilemedi:', error && error.code ? error.code : 'hata'));
    }

    return res.json({ success: true, error: null });

  } catch (error) {
    console.error('Şifre sıfırlama isteği hatası:', error);
    res.status(500).json({ success: false, error: 'İstek gönderilemedi.' });
  }
});

app.post('/api/password-reset/confirm', ...resetConfirmLimiters, (req, res) => {
  try {
    const result = confirmPasswordReset(req.body?.email, req.body?.code, req.body?.new_password);

    if (!result.success) {
      return res.status(400).json(result);
    }

    // Tüm oturumlar silindi; bu hesabın açık soketleri de kapatılır.
    disconnectRevokedSockets();

    return res.json(result);

  } catch (error) {
    console.error('Şifre sıfırlama onay hatası:', error);
    res.status(500).json({ success: false, error: 'Sıfırlanamadı.' });
  }
});

app.get('/api/friends/requests', (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;

  try {
    return res.json({ success: true, requests: listIncomingRequests(user.id) });
  } catch (error) {
    console.error('İstek listesi hatası:', error);
    res.status(500).json({ success: false, error: 'İstekler alınamadı.' });
  }
});

app.get('/api/users/lookup', lookupLimiter, (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;

  try {
    const found = findUserByUsername(req.query.username);

    if (!found || found.id === user.id) {
      return res.status(404).json({ success: false, error: 'Kullanıcı bulunamadı.' });
    }

    return res.json({ success: true, user: found });

  } catch (error) {
    console.error('Kullanıcı arama hatası:', error);
    res.status(500).json({ success: false, error: 'Aranamadı.' });
  }
});

app.post('/api/friends/request', friendRequestLimiter, (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;

  try {
    const result = sendFriendRequest(user.id, Number(req.body?.to_user_id));

    if (!result.success) {
      return res.status(400).json(result);
    }

    const targetSockets = activeUsers.get(Number(req.body?.to_user_id));
    if (targetSockets) {
      targetSockets.forEach(sid => io.to(sid).emit('friend_request_received', { from_username: user.username }));
    }
    pushNotification(Number(req.body?.to_user_id), 'friend_request', { from_username: user.username });

    return res.json(result);

  } catch (error) {
    console.error('Arkadaşlık isteği hatası:', error);
    res.status(500).json({ success: false, error: 'İstek gönderilemedi.' });
  }
});

app.post('/api/friends/respond', (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;

  try {
    const otherUserId = Number(req.body?.user_id);
    const accept = Boolean(req.body?.accept);
    const result = respondFriendRequest(user.id, otherUserId, accept);

    if (!result.success) {
      return res.status(400).json(result);
    }

    if (accept) {
      pushNotification(otherUserId, 'friend_request_accepted', { from_username: user.username });
    }

    return res.json(result);

  } catch (error) {
    console.error('İstek yanıtlama hatası:', error);
    res.status(500).json({ success: false, error: 'Yanıtlanamadı.' });
  }
});

app.delete('/api/friends/:userId', (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;

  try {
    return res.json(removeFriend(user.id, Number(req.params.userId)));
  } catch (error) {
    console.error('Arkadaş silme hatası:', error);
    res.status(500).json({ success: false, error: 'Silinemedi.' });
  }
});

// =====================================================
// KULLANICI PROFİLİ (BAŞKASI)
// =====================================================

app.get('/api/users/:id/profile', profileViewLimiter, (req, res) => {
  // Giriş ŞART: oturumsuz istemci numara tarayarak kullanıcı dizini çıkaramasın.
  const viewer = requireAuth(req, res);
  if (!viewer) return;

  try {
    const profile = getUserPublicProfile(viewer?.id, Number(req.params.id));

    if (!profile) {
      return res.status(404).json({ success: false, error: 'Kullanıcı bulunamadı.' });
    }

    return res.json({ success: true, profile: { ...profile, online: isVisiblyOnline(profile.id, profile.status) } });

  } catch (error) {
    console.error('Profil hatası:', error);
    res.status(500).json({ success: false, error: 'Profil alınamadı.' });
  }
});

// =====================================================
// ÖZEL MESAJLAR (DM)
// =====================================================

// Hesabı silinmiş kişilerle olan korunmuş (salt okunur) sohbetler: karşı tarafın kendi mesajları burada kalır.
app.get('/api/dm/deleted', (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;

  return res.json({ success: true, threads: listDeletedDmThreads(user.id) });
});

app.get('/api/dm/deleted/:token/messages', (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;

  const messages = getDeletedDmMessages(user.id, req.params.token, 50);
  if (!messages) return res.status(404).json({ success: false, error: 'Sohbet bulunamadı.' });

  return res.json({ success: true, messages });
});

app.delete('/api/dm/deleted/:token', (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;

  const result = deleteDeletedDmThread(user.id, req.params.token);
  return res.status(result.success ? 200 : 404).json(result);
});

app.get('/api/dm/:userId/messages', (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;

  const otherId = Number(req.params.userId);

  if (!areFriends(user.id, otherId)) {
    return res.status(403).json({ success: false, error: 'Sadece arkadaşlarınla mesajlaşabilirsin.' });
  }

  try {
    return res.json({ success: true, messages: getDmMessages(user.id, otherId, 50) });
  } catch (error) {
    console.error('DM mesaj hatası:', error);
    res.status(500).json({ success: false, error: 'Mesajlar alınamadı.' });
  }
});

// =====================================================
// SOCKET.IO AUTH MIDDLEWARE
// =====================================================

io.use((socket, next) => {
  try {
    const cookieHeader = socket.handshake.headers.cookie;
    const token = getSessionTokenFromCookie(cookieHeader);

    if (!token) return next(new Error('Oturum bulunamadı.'));

    const user = getUserFromSessionToken(token);

    if (!user) return next(new Error('Geçersiz veya süresi dolmuş oturum.'));

    socket.userId = user.id;
    socket.data.tokenHash = hashSessionToken(token); // soket, doğrulandığı oturuma bağlıdır (oturum iptal edilirse kapanır)
    socket.username = user.username;
    socket.email = user.email;

    next();

  } catch (error) {
    console.error('Socket authentication hatası:', error);
    next(new Error('Kimlik doğrulama başarısız.'));
  }
});

// =====================================================
// SOCKET.IO BAĞLANTI
// =====================================================

io.on('connection', (socket) => {
  const userId = socket.userId;
  const username = socket.username;

  try {
    console.log(`Socket bağlandı [${socket.id}]`); // günlüğe kullanıcı adı yazılmaz

    if (!activeUsers.has(userId)) {
      activeUsers.set(userId, new Set());
    }

    activeUsers.get(userId).add(socket.id);
    activeUserNames.set(userId, username);

    socket.join(`user:${userId}`);

    // Alıcı uygulamayı arama çalarken (ör. bildirime dokunarak) açtıysa çalan aramayı yeniden ilet.
    for (const [callerId, pending] of pendingDmCalls.entries()) {
      if (pending.toId === userId && Date.now() - pending.at < DM_CALL_RING_MS) {
        socket.emit('dm_call_incoming', { from_user_id: callerId, from_username: pending.callerName });
      }
    }

    socket.emit('login_success', { id: userId, username });
    io.emit('presence_changed');

  } catch (error) {
    console.error('Socket bağlantı hatası:', error);
  }

  socket.on('dm_message', (data) => {
    try {
      if (!socket.userId || !socket.username) {
        socket.emit('message_error', 'Oturum doğrulanamadı.');
        return;
      }

      if (isSocketMessageRateLimited(socket)) {
        socket.emit('message_error', 'Çok hızlı mesaj gönderiyorsun, biraz yavaşla.');
        return;
      }

      const toUserId = Number(data?.to_user_id);
      const replyToMessageId = data?.reply_to_message_id ? Number(data.reply_to_message_id) : null;
      const result = saveDmMessage(socket.userId, socket.username, toUserId, data?.content, replyToMessageId);

      if (!result.success) {
        socket.emit('message_error', result.error);
        return;
      }

      emitDmMessage(result.message);

    } catch (error) {
      console.error('DM kaydedilirken hata:', error);
      socket.emit('message_error', 'Mesaj gönderilemedi.');
    }
  });

  socket.on('dm_voice_message', (data) => {
    try {
      if (!socket.userId || !socket.username) {
        socket.emit('message_error', 'Oturum doğrulanamadı.');
        return;
      }

      if (isSocketMessageRateLimited(socket)) {
        socket.emit('message_error', 'Çok hızlı mesaj gönderiyorsun, biraz yavaşla.');
        return;
      }

      const toUserId = Number(data?.to_user_id);
      const result = saveDmVoiceMessage(socket.userId, socket.username, toUserId, data?.audio_data, data?.duration);

      if (!result.success) {
        socket.emit('message_error', result.error);
        return;
      }

      emitDmMessage(result.message);

    } catch (error) {
      console.error('Sesli DM kaydedilirken hata:', error);
      socket.emit('message_error', 'Sesli mesaj gönderilemedi.');
    }
  });

  socket.on('dm_file_message', (data) => {
    try {
      if (!socket.userId || !socket.username) {
        socket.emit('message_error', 'Oturum doğrulanamadı.');
        return;
      }

      if (isSocketMessageRateLimited(socket)) {
        socket.emit('message_error', 'Çok hızlı mesaj gönderiyorsun, biraz yavaşla.');
        return;
      }

      const toUserId = Number(data?.to_user_id);
      const result = createDmFileMessage(socket.userId, socket.username, toUserId, data?.file);

      if (!result.success) {
        socket.emit('message_error', result.error);
        return;
      }

      emitDmMessage(result.message);

    } catch (error) {
      console.error('Dosyalı DM kaydedilirken hata:', error);
      socket.emit('message_error', 'Dosya gönderilemedi.');
    }
  });

  socket.on('dm_sticker_message', (data) => {
    try {
      if (!socket.userId || !socket.username) {
        socket.emit('message_error', 'Oturum doğrulanamadı.');
        return;
      }

      if (isSocketMessageRateLimited(socket)) {
        socket.emit('message_error', 'Çok hızlı mesaj gönderiyorsun, biraz yavaşla.');
        return;
      }

      const toUserId = Number(data?.to_user_id);
      const result = saveDmSticker(socket.userId, socket.username, toUserId, data?.sticker_id);

      if (!result.success) {
        socket.emit('message_error', result.error);
        return;
      }

      emitDmMessage(result.message);

    } catch (error) {
      console.error('Çıkartmalı DM kaydedilirken hata:', error);
      socket.emit('message_error', 'Çıkartma gönderilemedi.');
    }
  });

  // ─── ÖZEL (DM) SESLİ ARAMA SİNYALLEŞMESİ ─────────────────────────────
  // Kamera/görüntülü görüşme yok — sadece ses. Odaya asıl giriş REST
  // /api/dm/:userId/call/join üzerinden auth+arkadaşlık kontrolüyle yapılır;
  // bu event'ler sadece "biri seni arıyor" bildirimini iletir.

  socket.on('dm_call_invite', (data) => {
    try {
      if (!socket.userId || !socket.username) return;

      const toUserId = Number(data?.to_user_id);
      if (!toUserId || !areFriends(socket.userId, toUserId)) return;

      // Aynı arayan için önceki çalan arama varsa sessizce değiştirilir (çift kayıt yazılmaz).
      clearPendingDmCall(socket.userId);
      const ringTimer = setTimeout(() => finishMissedDmCall(socket.userId, 'timeout'), DM_CALL_RING_MS);
      if (ringTimer.unref) ringTimer.unref();
      pendingDmCalls.set(socket.userId, { toId: toUserId, callerName: socket.username, at: Date.now(), timer: ringTimer });

      io.to(`user:${toUserId}`).emit('dm_call_incoming', {
        from_user_id: socket.userId,
        from_username: socket.username
      });

      // Alıcı uygulamayı görmüyorsa (arka plan / kapalı) gelen aramayı bildirim olarak da ilet.
      dispatchWebPush(toUserId, 'incoming_call', { title: socket.username, body: 'Seni arıyor', url: '/', tag: 'call' })
        .catch((error) => console.error('Arama bildirimi gönderilemedi:', error));

    } catch (error) {
      console.error('DM arama daveti hatası:', error);
    }
  });

  socket.on('dm_call_cancel', (data) => {
    const toUserId = Number(data?.to_user_id);
    if (!toUserId || !socket.userId) return;
    io.to(`user:${toUserId}`).emit('dm_call_cancelled', { from_user_id: socket.userId });
    const pending = pendingDmCalls.get(socket.userId);
    if (pending && pending.toId === toUserId) {
      clearPendingDmCall(socket.userId);
      logDmCall(socket.userId, pending.callerName, toUserId, 'missed');
    }
  });

  socket.on('dm_call_decline', (data) => {
    const toUserId = Number(data?.to_user_id);
    if (!toUserId || !socket.userId) return;
    io.to(`user:${toUserId}`).emit('dm_call_declined', { from_user_id: socket.userId });
    const pendingDecline = pendingDmCalls.get(toUserId);
    if (pendingDecline && pendingDecline.toId === socket.userId) {
      clearPendingDmCall(toUserId);
      logDmCall(toUserId, pendingDecline.callerName, socket.userId, 'declined');
    }
    // Aynı hesabın diğer cihazlarında çalan gelen arama kapansın.
    socket.to(`user:${socket.userId}`).emit('dm_call_handled', { from_user_id: toUserId });
  });

  socket.on('dm_call_accept', (data) => {
    const toUserId = Number(data?.to_user_id);
    if (!toUserId || !socket.userId) return;
    io.to(`user:${toUserId}`).emit('dm_call_accepted', { from_user_id: socket.userId });
    const pendingAccept = pendingDmCalls.get(toUserId);
    if (pendingAccept && pendingAccept.toId === socket.userId) {
      clearPendingDmCall(toUserId);
      activeDmCalls.set(dmPairKey(toUserId, socket.userId), { callerId: toUserId, calleeId: socket.userId, callerName: pendingAccept.callerName, answeredAt: Date.now() });
    }
    socket.to(`user:${socket.userId}`).emit('dm_call_handled', { from_user_id: toUserId });
  });

  socket.on('dm_call_end', (data) => {
    const toUserId = Number(data?.to_user_id);
    if (!toUserId || !socket.userId) return;
    io.to(`user:${toUserId}`).emit('dm_call_ended', { from_user_id: socket.userId });
    finishAnsweredDmCall(socket.userId, toUserId);
  });

  socket.on('join_hub', (hubId) => {
    try {
      hubId = Number(hubId);

      if (!isHubMember(hubId, socket.userId)) {
        socket.emit('message_error', 'Bu Hub\'a üye değilsin.');
        return;
      }

      socket.join(`hub:${hubId}`);

    } catch (error) {
      console.error('Hub odasına katılım hatası:', error);
    }
  });

  socket.on('leave_hub', (hubId) => {
    socket.leave(`hub:${Number(hubId)}`);
  });

  socket.on('hub_chat_message', (data) => {
    try {
      if (!socket.userId || !socket.username) {
        socket.emit('message_error', 'Oturum doğrulanamadı.');
        return;
      }

      if (isSocketMessageRateLimited(socket)) {
        socket.emit('message_error', 'Çok hızlı mesaj gönderiyorsun, biraz yavaşla.');
        return;
      }

      const hubId = Number(data?.hub_id);
      const content = String(data?.content || '').trim();

      if (!content || !hubId) return;

      if (content.length > 500) {
        socket.emit('message_error', 'Mesajınız çok uzun (Maksimum 500 karakter).');
        return;
      }

      if (!isHubMember(hubId, socket.userId)) {
        socket.emit('message_error', 'Bu Hub\'a üye değilsin.');
        return;
      }

      const replyToMessageId = data?.reply_to_message_id ? Number(data.reply_to_message_id) : null;
      const message = saveHubMessage(hubId, socket.userId, socket.username, content, replyToMessageId);

      emitHubMessage(hubId, message);

    } catch (error) {
      console.error('Hub mesajı kaydedilirken hata:', error);
      socket.emit('message_error', 'Mesaj gönderilemedi.');
    }
  });

  socket.on('voice_room_join', (data, ack) => {
    const reply = typeof ack === 'function' ? ack : () => {};

    try {
      if (!socket.userId) return reply({ success: false, error: 'Oturum bulunamadı.' });

      const roomId = Number(data?.room_id);
      const hubId = Number(data?.hub_id);
      if (!roomId || !hubId) return reply({ success: false, error: 'Geçersiz oda.' });

      if (!isHubMember(hubId, socket.userId)) {
        return reply({ success: false, error: "Bu Hub'a üye değilsin." });
      }

      const room = getVoiceRoom(roomId);
      if (!room || room.hub_id !== hubId) {
        return reply({ success: false, error: 'Oda bulunamadı.' });
      }

      if (isVoiceRoomFull(roomId, socket.userId)) {
        return reply({ success: false, error: `Bu oda dolu (en fazla ${MAX_VOICE_ROOM_PARTICIPANTS} kişi).` });
      }

      const previous = findUserVoiceRoom(socket.userId);
      let isNewJoin = true;

      if (previous && previous.roomId !== roomId) {
        removeVoiceParticipant(socket.userId, previous.roomId);
      } else if (previous) {
        // Aynı oda: başka bir cihaz/sekme devralıyor ya da bağlantı yeniden kuruldu.
        isNewJoin = false;
        if (previous.entry.socketId !== socket.id) {
          const oldSock = io.sockets.sockets.get(previous.entry.socketId);
          if (oldSock) {
            oldSock.leave(`voiceroom:${roomId}`);
            oldSock.data.voiceRoomId = null;
            oldSock.data.voiceRoomHubId = null;
            oldSock.emit('voice_room_replaced', { room_id: roomId });
          }
        }
      }

      if (!voiceRoomParticipants.has(roomId)) voiceRoomParticipants.set(roomId, new Map());

      const replacedEntry = voiceRoomParticipants.get(roomId).get(socket.userId);
      if (replacedEntry && replacedEntry.graceTimer) clearTimeout(replacedEntry.graceTimer);

      voiceRoomParticipants.get(roomId).set(socket.userId, {
        user_id: socket.userId,
        username: socket.username,
        muted: Boolean(data?.muted),
        deafened: Boolean(data?.deafened),
        socketId: socket.id,
        hubId
      });

      socket.join(`voiceroom:${roomId}`);
      socket.data.voiceRoomId = roomId;
      socket.data.voiceRoomHubId = hubId;

      broadcastVoiceRoom(hubId, roomId, isNewJoin
        ? { type: 'joined', user_id: socket.userId, username: socket.username }
        : null);

      reply({ success: true, participants: serializeVoiceParticipants(roomId) });

    } catch (error) {
      console.error('Sesli oda katılım hatası:', error);
      reply({ success: false, error: 'Odaya katılınamadı.' });
    }
  });

  socket.on('voice_room_leave', () => {
    if (!socket.userId) return;

    const roomId = socket.data.voiceRoomId;
    if (!roomId) return;

    removeVoiceParticipant(socket.userId, roomId, socket.id);
  });

  socket.on('voice_room_mute', (data) => {
    if (!socket.userId) return;

    const roomId = socket.data.voiceRoomId;
    const entry = voiceRoomParticipants.get(roomId)?.get(socket.userId);
    if (!entry || entry.socketId !== socket.id) return;

    const muted = Boolean(data?.muted);
    if (entry.muted === muted) return;

    entry.muted = muted;
    broadcastVoiceRoom(entry.hubId, roomId, { type: 'mute', user_id: socket.userId, muted });
  });

  socket.on('app_visibility', (data) => {
    socket.data.visible = Boolean(data?.visible);
  });

  socket.on('voice_room_deafen', (data) => {
    if (!socket.userId) return;

    const roomId = socket.data.voiceRoomId;
    const entry = voiceRoomParticipants.get(roomId)?.get(socket.userId);
    if (!entry || entry.socketId !== socket.id) return;

    const deafened = Boolean(data?.deafened);
    if (entry.deafened === deafened) return;

    entry.deafened = deafened;
    broadcastVoiceRoom(entry.hubId, roomId, { type: 'deafen', user_id: socket.userId, deafened });
  });

  socket.on('disconnect', (reason) => {
    console.log(`Socket ayrıldı [${socket.id}] - ${reason}`);

    if (!socket.userId) return;

    if (socket.data.voiceRoomId) {
      const roomId = socket.data.voiceRoomId;
      const entry = voiceRoomParticipants.get(roomId)?.get(socket.userId);
      if (entry && entry.socketId === socket.id) {
        // Tolerans: süre dolmadan aynı kullanıcı yeniden katılırsa (voice_room_join) zamanlayıcı iptal edilir.
        if (entry.graceTimer) clearTimeout(entry.graceTimer);
        entry.graceTimer = setTimeout(() => removeVoiceParticipant(socket.userId, roomId, socket.id), VOICE_DISCONNECT_GRACE_MS);
        if (entry.graceTimer.unref) entry.graceTimer.unref();
      }
    }

    const userSockets = activeUsers.get(socket.userId);
    if (!userSockets) return;

    userSockets.delete(socket.id);

    if (userSockets.size === 0) {
      activeUsers.delete(socket.userId);

      // Kullanıcının hiç bağlantısı kalmadı: çalan aramasını cevapsız say, cevaplanmış aramasını sonlandır.
      finishMissedDmCall(socket.userId, 'disconnect');
      for (const [key, call] of Array.from(activeDmCalls.entries())) {
        if (call.callerId === socket.userId || call.calleeId === socket.userId) {
          const otherId = call.callerId === socket.userId ? call.calleeId : call.callerId;
          finishAnsweredDmCall(socket.userId, otherId);
          io.to(`user:${otherId}`).emit('dm_call_ended', { from_user_id: socket.userId });
        }
      }
    }

    io.emit('presence_changed');
  });
});

// =====================================================
// SUNUCU
// =====================================================

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`Sauran sunucusu çalışıyor → http://localhost:${PORT}`);

  // Yapılandırma özeti: yalnızca "ayarlı/eksik" (sır DEĞERLERİ hiçbir zaman yazılmaz). Ayrıntı: node server/preflight.js
  try {
    const problems = require('./preflight').checkConfig(process.env).filter(r => r.level !== 'ok');
    problems.forEach(r => console.warn(`[yapılandırma ${r.level}] ${r.key}: ${r.message}`));
  } catch (_) { /* özet başarısız olsa da sunucu çalışır */ }

  // Önceki çalışmadan kalan (gönderilememiş / yarıda kalmış) rol e-postalarını yeniden dene.
  try { recoverStaleRoleNoticeEmails(); } catch (error) { console.error('Outbox toparlama hatası:', error); }
  scheduleRoleNoticeEmails();

  // retention_until'i dolan rapor medyası / kanıtı / rapor kaydını temizle (açılışta ve günde bir).
  const runEvidencePurge = () => {
    try {
      const purged = purgeExpiredRetention();
      if (purged.media || purged.evidence || purged.reports) {
        console.log(`Saklama süresi dolanlar silindi: medya=${purged.media}, kanıt=${purged.evidence}, rapor=${purged.reports}.`);
      }
    } catch (error) { console.error('Saklama süresi temizleme hatası:', error); }
  };
  runEvidencePurge();
  setInterval(runEvidencePurge, 24 * 60 * 60 * 1000).unref();

  // Admin audit log saklama temizliği (açılışta ve günde bir): eski serbest metin gerekçeler ve süresi dolan kayıtlar silinir.
  const runAuditPurge = () => {
    try {
      const purged = purgeExpiredAuditLog();
      if (purged.reasons || purged.rows) console.log(`Audit log temizliği: gerekçe=${purged.reasons}, kayıt=${purged.rows}.`);
      logDataLifecycle('audit_log_purged', purged);
      const lc = purgeExpiredDataLifecycleLog(); if (lc) console.log(`Süresi dolan veri silme kayıtları silindi: ${lc}.`);
    } catch (error) { console.error('Audit log temizleme hatası:', error); }
  };
  runAuditPurge();

  // Doğum tarihi minimizasyonu: 18 yaşını dolduran (ve eski) hesaplarda tam tarih silinir; açılışta ve günde bir.
  const runBirthDatePurge = () => {
    try {
      const purged = purgeAdultBirthDates();
      logDataLifecycle('birth_dates_minimized', { legacy: purged.legacy, expired: purged.expired, pending: purged.pending });
      if (purged.users || purged.pending) console.log(`Doğum tarihi minimizasyonu: eski kayıt=${purged.legacy}, reşit olan=${purged.expired}, bekleyen kayıt=${purged.pending}.`);
    } catch (error) { console.error('Doğum tarihi temizleme hatası:', error); }
  };
  runBirthDatePurge();

  // Aktif mesajların teknik saklama modeli (bkz. docs/mesaj-saklama-politikasi.md): açılışta ve saatte bir; hata uygulamayı etkilemez.
  const runMessagePurge = () => {
    try {
      const purged = purgeExpiredMessages();
      logDataLifecycle('messages_purged', purged);
      if (purged.media || purged.deleted || purged.copies) console.log(`Mesaj saklama temizliği: medya=${purged.media}, silinen=${purged.deleted}, kopya=${purged.copies}.`);
    } catch (error) { console.error('Mesaj saklama temizleme hatası:', error); }
  };
  runMessagePurge();
  setInterval(runMessagePurge, 60 * 60 * 1000).unref();

  // Elle alınmış yedeklerin (DATA_DIR/backups + açıkça geçici adlı eski dosyalar) süresi (varsayılan 7 gün, teknik varsayılan) dolunca silinmesi:
  // açılışta ve günde bir. Uygulama kendiliğinden yedek ALMAZ (bkz. docs/yedekleme-ve-dis-kopyalar.md).
  const runBackupCleanup = () => {
    try {
      const r = purgeOldBackups();
      logDataLifecycle('backups_purged', { files: r.deleted });
      if (r.deleted) console.log(`Süresi dolan yedek/geçici dosyalar silindi: ${r.deleted}.`);
    } catch (error) { console.error('Yedek temizleme hatası:', error); }
  };
  runBackupCleanup();
  setInterval(runBackupCleanup, 24 * 60 * 60 * 1000).unref();

  // WAL dosyası saatte bir kesilir (silinen verinin eski sayfa görüntüleri diskte gereksiz kalmasın).
  setInterval(() => { checkpointWal(); }, 60 * 60 * 1000).unref();
  setInterval(runBirthDatePurge, 24 * 60 * 60 * 1000).unref();
  setInterval(runAuditPurge, 24 * 60 * 60 * 1000).unref();

  // Süresi dolmuş doğrulama kodları, şifre sıfırlama kodları ve oturumlar: açılışta (yeniden başlatma sonrası birikmiş kayıtlar) ve
  // 10 dakikada bir silinir. Yalnızca süresi dolmuş satırlar etkilenir; hata olursa uygulamanın çalışmasını etkilemez.
  const runAuthCleanup = () => {
    try {
      const purged = purgeExpiredAuthRecords();
      logDataLifecycle('auth_records_purged', purged);
      if (purged.pending || purged.resets || purged.sessions) {
        console.log(`Süresi dolan geçici kayıtlar silindi: doğrulama=${purged.pending}, şifre sıfırlama=${purged.resets}, oturum=${purged.sessions}.`);
      }
    } catch (error) { console.error('Geçici kayıt temizleme hatası:', error); }
  };
  runAuthCleanup();
  setInterval(runAuthCleanup, 10 * 60 * 1000).unref();

  // Bildirimler ve e-posta kuyruğu (outbox): saklama süresi dolanlar açılışta ve saatte bir temizlenir (bkz. docs/bildirim-outbox-saklama-politikasi.md).
  const runNotificationCleanup = () => {
    try {
      const r = purgeExpiredNotificationData();
      logDataLifecycle('notifications_purged', r);
      if (r.notifications || r.orphan_sources || r.outbox_deleted || r.outbox_scrubbed) {
        console.log(`Bildirim/e-posta kuyruğu temizliği: bildirim=${r.notifications}, kaynağı silinmiş bildirim=${r.orphan_sources}, kuyruk silinen=${r.outbox_deleted}, kuyruk içeriği temizlenen=${r.outbox_scrubbed}.`);
      }
    } catch (error) { console.error('Bildirim/kuyruk temizleme hatası:', error); }
  };
  runNotificationCleanup();
  setInterval(runNotificationCleanup, 60 * 60 * 1000).unref();

  // Süresi (hesap silme anından 90 gün, teknik varsayılan) dolan "silinmiş hesap" DM sohbetleri: açılışta ve saatte bir.
  const runDeletedDmCleanup = () => {
    try {
      const r = purgeExpiredDeletedDmThreads();
      logDataLifecycle('deleted_dm_threads_purged', r);
      if (r.threads) console.log(`Süresi dolan silinmiş-hesap DM sohbetleri silindi: sohbet=${r.threads}, mesaj=${r.messages}.`);
    } catch (error) { console.error('Silinmiş-hesap DM temizleme hatası:', error); }
  };
  runDeletedDmCleanup();
  setInterval(runDeletedDmCleanup, 60 * 60 * 1000).unref();

  // Süresiz kalan verilere kademeli sınırlı saklama (bkz. docs/suresiz-veriler.md): davet kodu, bekleyen arkadaşlık isteği, öneri; açılışta ve günde bir.
  const runIndefiniteCleanup = () => {
    try {
      const r = purgeExpiredIndefiniteData();
      logDataLifecycle('indefinite_data_purged', r);
      if (r.invites || r.pending_friend_requests || r.feedback) console.log(`Süresi dolan davet/istek/öneri silindi: davet=${r.invites}, istek=${r.pending_friend_requests}, öneri=${r.feedback}.`);
    } catch (error) { console.error('Süresiz veri temizleme hatası:', error); }
  };
  runIndefiniteCleanup();
  setInterval(runIndefiniteCleanup, 24 * 60 * 60 * 1000).unref();

  // Hareketsiz hesaplar: ÖNCE e-posta uyarısı, en az 30 gün sonra silme (giriş sayaç sıfırlar). Yönetim rolleri/askıdakiler/aktif lobi sahipleri hariç.
  const runInactiveAccounts = async () => {
    try {
      const r = await runInactiveAccountPass({
        sendWarning: (email, deleteOn) => sendInactivityWarningEmail(email, deleteOn),
        onDeleted: (userId, result) => finishAccountDeletion(userId, result)
      });
      logDataLifecycle('inactive_accounts', { warned: r.warned, deleted: r.deleted });
      if (r.warned || r.deleted || r.warn_failed) console.log(`Hareketsiz hesap turu: uyarılan=${r.warned}, uyarı gönderilemedi=${r.warn_failed}, silinen=${r.deleted}.`);
    } catch (error) { console.error('Hareketsiz hesap turu hatası:', error); }
  };
  runInactiveAccounts();
  setInterval(runInactiveAccounts, 24 * 60 * 60 * 1000).unref();

  // Daily oda silme kuyruğu: açılışta ve 5 dakikada bir (başarısız silmeler geri çekilmeyle yeniden denenir).
  processDailyRoomCleanup().catch(() => {});
  setInterval(() => processDailyRoomCleanup().catch(() => {}), 5 * 60 * 1000).unref();

  setInterval(() => {
    try { recoverStaleRoleNoticeEmails(); } catch (error) { console.error('Outbox toparlama hatası:', error); }
    scheduleRoleNoticeEmails();
  }, 5 * 60 * 1000).unref();
});

// Zarif kapanış (Render dağıtımda SIGTERM gönderir): WAL kesilir, bağlantılar kapanır.
let shuttingDown = false;
function gracefulShutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal} alındı, kapanıyor...`);
  const done = () => { checkpointWal(); process.exit(0); };
  try { io.close(() => server.close(done)); } catch (_) { done(); }
  setTimeout(done, 5000).unref();
}
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));