require('dotenv').config();
const { sendVerificationEmail, sendPasswordResetEmail, sendReportNotificationEmail } = require('./mailer');
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
  getDmMessages,
  findUserByUsername,
  blockUser,
  unblockUser,
  listBlockedUsers,
  createReport,
  createFeedback,
  listFeedback,
  voteFeedback,
  calculateAge,
  isMinorAge,
  getAccountExport,
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
  hasAtLeastPlatformRole,
  getReportDetail,
  getModerationUserDetail,
  listAdminUsers,
  devNoticeFor,
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

function isOriginAllowed(origin) {
  if (!isProduction) return true; // yerel geliştirmede kısıtlama yok
  if (!origin) return true; // Origin header'ı olmayan istekler (ör. sunucu-sunucu)
  // Tarayıcılar aynı origin'den yapılan fetch/XHR/socket.io isteklerinde de
  // Origin header'ı gönderir. ALLOWED_ORIGINS ayarlanmadıysa varsayılan
  // olarak kısıtlama uygulanmaz — aksi halde canlıdaki kendi sitesi bile
  // (kendi Origin'i beyaz listede olmadığı için) engellenmiş olur.
  if (allowedOrigins.length === 0) return true;
  return allowedOrigins.includes(origin);
}

const corsOptions = {
  origin: (origin, callback) => {
    if (isOriginAllowed(origin)) return callback(null, true);
    return callback(new Error('CORS: bu origin izinli değil.'));
  },
  credentials: true
};

const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      if (isOriginAllowed(origin)) return callback(null, true);
      return callback(new Error('CORS: bu origin izinli değil.'));
    },
    credentials: true,
    methods: ['GET', 'POST']
  },
  maxHttpBufferSize: 15_000_000
});

app.use(cors(corsOptions));
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
const registerLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 5, keyFn: byIp, message: 'Çok fazla kayıt denemesi. Biraz sonra tekrar dene.' });
const passwordResetLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 5, keyFn: byIp, message: 'Çok fazla istek. Biraz sonra tekrar dene.' });
const friendRequestLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 30, keyFn: byIp, message: 'Çok fazla arkadaşlık isteği gönderildi. Biraz sonra tekrar dene.' });
const hubCreateLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 10, keyFn: byIp, message: 'Çok fazla Hub oluşturuldu. Biraz sonra tekrar dene.' });
const inviteCreateLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 30, keyFn: byIp, message: 'Çok fazla davet oluşturuldu. Biraz sonra tekrar dene.' });
const reportLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 20, keyFn: byIp, message: 'Çok fazla bildirim gönderildi. Biraz sonra tekrar dene.' });
const feedbackLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 10, keyFn: byIp, message: 'Çok fazla öneri gönderildi. Biraz sonra tekrar dene.' });
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

const SESSION_DURATION = 7 * 24 * 60 * 60 * 1000;

function hashSessionToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function createSession(userId, userAgent) {
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
           users.birth_date, users.platform_role, users.dev_notice_seen, users.dev_notice_new,
           sessions.expires_at
    FROM sessions
    INNER JOIN users ON users.id = sessions.user_id
    WHERE sessions.token_hash = ?
  `).get(tokenHash);

  if (!user) return null;

  if (new Date(user.expires_at).getTime() <= Date.now()) {
    db.prepare(`DELETE FROM sessions WHERE token_hash = ?`).run(tokenHash);
    return null;
  }

  return {
    id: user.id,
    username: user.username,
    email: user.email,
    about_me: user.about_me,
    status: user.status || 'signal',
    avatar_visibility: user.avatar_visibility || 'public',
    avatar_data: user.avatar_data,
    banner_data: user.banner_data,
    is_minor: isMinorAge(calculateAge(user.birth_date)),
    platform_role: user.platform_role || 'user',
    dev_notice: devNoticeFor(user.dev_notice_seen, user.dev_notice_new)
  };
}

function getUserFromRequest(req) {
  const token = getSessionTokenFromCookie(req.headers.cookie);
  return getUserFromSessionToken(token);
}

function setSessionCookie(res, token) {
  const secureFlag = isProduction ? '; Secure' : '';
  res.setHeader(
    'Set-Cookie',
    `sauran_session=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_DURATION / 1000}${secureFlag}`
  );
}

function clearSessionCookie(res) {
  const secureFlag = isProduction ? '; Secure' : '';
  res.setHeader('Set-Cookie', `sauran_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secureFlag}`);
}

// =====================================================
// ANA SAYFA
// =====================================================

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'client', 'index.html'));
});

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

    await sendVerificationEmail(email, result.code);

    return res.json({ success: true, email });

  } catch (error) {
    console.error('Kayıt API hatası:', error);
    return res.status(500).json({ success: false, error: 'Kayıt sırasında bir hata oluştu.' });
  }
});

app.post('/api/verify', (req, res) => {
  try {
    const { email, code } = req.body;

    const result = verifyAndCreateUser(email, code);

    if (!result.success) {
      return res.status(400).json(result);
    }

    const sessionToken = createSession(result.id, req.headers['user-agent']);
    setSessionCookie(res, sessionToken);

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

    if (!result.success) {
      return res.status(401).json({
        success: false,
        error: 'Kullanıcı adı/e-posta veya şifre hatalı.'
      });
    }

    const sessionToken = createSession(result.id, req.headers['user-agent']);
    setSessionCookie(res, sessionToken);

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

  return res.json({ success: true });
});

// =====================================================
// HESABI SİL
// =====================================================

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
    res.setHeader('Content-Disposition', `attachment; filename="sauran-verilerim-${user.username}.json"`);
    return res.send(JSON.stringify(data, null, 2));

  } catch (error) {
    console.error('Veri ihracı hatası:', error);
    return res.status(500).json({ success: false, error: 'Verilerin dışa aktarılamadı.' });
  }
});

app.delete('/api/account', (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;

  try {

    const ownedHubs = db.prepare(`SELECT id FROM hubs WHERE created_by = ?`).all(user.id);
    ownedHubs.forEach(h => db.prepare(`DELETE FROM hubs WHERE id = ?`).run(h.id));

    db.prepare(`DELETE FROM messages WHERE user_id = ? OR to_user_id = ?`).run(user.id, user.id);
    db.prepare(`DELETE FROM friendships WHERE user_low = ? OR user_high = ?`).run(user.id, user.id);
    db.prepare(`DELETE FROM blocked_users WHERE user_id = ? OR blocked_user_id = ?`).run(user.id, user.id);
    db.prepare(`DELETE FROM notifications WHERE user_id = ?`).run(user.id);
    db.prepare(`DELETE FROM hub_members WHERE user_id = ?`).run(user.id);
    db.prepare(`DELETE FROM sessions WHERE user_id = ?`).run(user.id);
    db.prepare(`DELETE FROM users WHERE id = ?`).run(user.id);

    clearSessionCookie(res);
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

app.patch('/api/profile/password', (req, res) => {
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
        sendReportNotificationEmail(detail).catch((error) => {
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
    }

    clearSessionCookie(res);
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

app.post('/api/hubs/join', (req, res) => {
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
    return res.json(leaveHub(Number(req.params.id), user.id));
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

    io.to(`hub:${hubId}`).emit('hub_message', result.message);

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

    io.to(`hub:${hubId}`).emit('hub_message', result.message);

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

    io.to(`hub:${hubId}`).emit('hub_message', result.message);

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

    io.to(`hub:${hubId}`).emit('hub_message', result.message);

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

    io.to(`hub:${hubId}`).emit('hub_message', result.message);

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

    const token = await daily.createMeetingToken(roomName, user.username);

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
    participants: Array.from(voiceRoomParticipants.get(room.id) || []).map(uid => activeUserNames.get(uid) || '').filter(Boolean)
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

  voiceRoomParticipants.delete(roomId);
  io.to(`hub:${hubId}`).emit('voice_room_deleted', { id: roomId });

  return res.json(result);
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

  if (!daily.isConfigured()) {
    return res.status(503).json({ success: false, error: 'Sesli sohbet henüz yapılandırılmadı.' });
  }

  try {
    const roomName = getVoiceRoomDailyName(roomId) || `sauran-vr-${roomId}`;
    setVoiceRoomDailyName(roomId, roomName);

    const room = await daily.getOrCreateRoom(roomName);
    const roomUrl = room.url;

    const token = await daily.createMeetingToken(roomName, user.username);

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

    const token = await daily.createMeetingToken(roomName, user.username);

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

    return res.json(result);

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

    io.to(`user:${user.id}`).to(`user:${toUserId}`).emit('dm_message', result.message);

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
  system: 'notify_system'
};

// NOT: Bildirimin veritabanına yazılması bu fonksiyonun işi DEĞİL — o iş
// ilgili db.js fonksiyonuna (ör. sendFriendRequest, sendHubInviteNotification)
// ait ve her zaman gerçekleşir (kullanıcı bildirimi kapatmış olsa bile
// Bildirimler panelinde geçmişte görünsün diye). Bu fonksiyon SADECE gerçek
// zamanlı (socket) dağıtımı, kullanıcının tercihine göre kontrollü yapar.
function pushNotification(userId, type, data) {

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
// SESLİ ODA KATILIMCILARI (bellek içi, gerçek zamanlı)
// roomId -> Set(userId)
// =====================================================

const voiceRoomParticipants = new Map();

function getVoiceRoomParticipantIds(roomId) {
  return Array.from(voiceRoomParticipants.get(roomId) || []);
}

// =====================================================
// HUB SİLME
// =====================================================

app.delete('/api/hubs/:id', (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;

  try {
    const result = deleteHub(Number(req.params.id), user.id);

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.json(result);

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
  for (const [roomId, participantIds] of voiceRoomParticipants.entries()) {
    if (participantIds.has(userId)) {
      participantIds.delete(userId);
      io.to(`hub:${hubId}`).emit('voice_room_participants_updated', {
        room_id: roomId,
        participants: getVoiceRoomParticipantIds(roomId).map(uid => activeUserNames.get(uid) || '').filter(Boolean)
      });
    }
  }
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

  return res.json({ success: true, bans: listHubBans(hubId) });
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
      await sendPasswordResetEmail(user.email, result.code);
    }

    return res.json({ success: true, error: null });

  } catch (error) {
    console.error('Şifre sıfırlama isteği hatası:', error);
    res.status(500).json({ success: false, error: 'İstek gönderilemedi.' });
  }
});

app.post('/api/password-reset/confirm', (req, res) => {
  try {
    const result = confirmPasswordReset(req.body?.email, req.body?.code, req.body?.new_password);

    if (!result.success) {
      return res.status(400).json(result);
    }

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

app.get('/api/users/lookup', (req, res) => {
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

app.get('/api/users/:id/profile', (req, res) => {
  const viewer = getUserFromRequest(req);

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
    console.log(`Socket bağlandı: ${username} [${socket.id}]`);

    if (!activeUsers.has(userId)) {
      activeUsers.set(userId, new Set());
    }

    activeUsers.get(userId).add(socket.id);
    activeUserNames.set(userId, username);

    socket.join(`user:${userId}`);

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

      io.to(`user:${socket.userId}`).to(`user:${toUserId}`).emit('dm_message', result.message);

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

      io.to(`user:${socket.userId}`).to(`user:${toUserId}`).emit('dm_message', result.message);

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

      io.to(`user:${socket.userId}`).to(`user:${toUserId}`).emit('dm_message', result.message);

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

      io.to(`user:${socket.userId}`).to(`user:${toUserId}`).emit('dm_message', result.message);

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

      io.to(`user:${toUserId}`).emit('dm_call_incoming', {
        from_user_id: socket.userId,
        from_username: socket.username
      });

    } catch (error) {
      console.error('DM arama daveti hatası:', error);
    }
  });

  socket.on('dm_call_cancel', (data) => {
    const toUserId = Number(data?.to_user_id);
    if (!toUserId || !socket.userId) return;
    io.to(`user:${toUserId}`).emit('dm_call_cancelled', { from_user_id: socket.userId });
  });

  socket.on('dm_call_decline', (data) => {
    const toUserId = Number(data?.to_user_id);
    if (!toUserId || !socket.userId) return;
    io.to(`user:${toUserId}`).emit('dm_call_declined', { from_user_id: socket.userId });
  });

  socket.on('dm_call_accept', (data) => {
    const toUserId = Number(data?.to_user_id);
    if (!toUserId || !socket.userId) return;
    io.to(`user:${toUserId}`).emit('dm_call_accepted', { from_user_id: socket.userId });
  });

  socket.on('dm_call_end', (data) => {
    const toUserId = Number(data?.to_user_id);
    if (!toUserId || !socket.userId) return;
    io.to(`user:${toUserId}`).emit('dm_call_ended', { from_user_id: socket.userId });
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

      io.to(`hub:${hubId}`).emit('hub_message', message);

    } catch (error) {
      console.error('Hub mesajı kaydedilirken hata:', error);
      socket.emit('message_error', 'Mesaj gönderilemedi.');
    }
  });

  socket.on('voice_room_join', (data) => {
    if (!socket.userId) return;

    const roomId = Number(data?.room_id);
    const hubId = Number(data?.hub_id);
    if (!roomId || !hubId) return;

    if (!voiceRoomParticipants.has(roomId)) voiceRoomParticipants.set(roomId, new Set());
    voiceRoomParticipants.get(roomId).add(socket.userId);
    socket.data.voiceRoomId = roomId;
    socket.data.voiceRoomHubId = hubId;

    io.to(`hub:${hubId}`).emit('voice_room_participants_updated', {
      room_id: roomId,
      participants: getVoiceRoomParticipantIds(roomId).map(uid => activeUserNames.get(uid) || '').filter(Boolean)
    });
  });

  socket.on('voice_room_leave', (data) => {
    if (!socket.userId) return;

    const roomId = Number(data?.room_id) || socket.data.voiceRoomId;
    const hubId = Number(data?.hub_id) || socket.data.voiceRoomHubId;
    if (!roomId || !hubId) return;

    voiceRoomParticipants.get(roomId)?.delete(socket.userId);
    socket.data.voiceRoomId = null;
    socket.data.voiceRoomHubId = null;

    io.to(`hub:${hubId}`).emit('voice_room_participants_updated', {
      room_id: roomId,
      participants: getVoiceRoomParticipantIds(roomId).map(uid => activeUserNames.get(uid) || '').filter(Boolean)
    });
  });

  socket.on('disconnect', (reason) => {
    console.log(`Socket ayrıldı: ${username} [${socket.id}] - ${reason}`);

    if (!socket.userId) return;

    if (socket.data.voiceRoomId && socket.data.voiceRoomHubId) {
      const roomId = socket.data.voiceRoomId;
      const hubId = socket.data.voiceRoomHubId;
      voiceRoomParticipants.get(roomId)?.delete(socket.userId);
      io.to(`hub:${hubId}`).emit('voice_room_participants_updated', {
        room_id: roomId,
        participants: getVoiceRoomParticipantIds(roomId).map(uid => activeUserNames.get(uid) || '').filter(Boolean)
      });
    }

    const userSockets = activeUsers.get(socket.userId);
    if (!userSockets) return;

    userSockets.delete(socket.id);

    if (userSockets.size === 0) {
      activeUsers.delete(socket.userId);
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
});