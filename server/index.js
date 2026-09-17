require('dotenv').config();
const { sendVerificationEmail, sendPasswordResetEmail } = require('./mailer');
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
  updateUsername,
  updatePassword,
  getTopFriends,
  sendHubInviteNotification,
  listNotifications,
  respondHubInviteNotification,
  requestPasswordReset,
  confirmPasswordReset,
  db
} = require('./db');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: true,
    credentials: true,
    methods: ['GET', 'POST']
  },
  maxHttpBufferSize: 15_000_000
});

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '15mb' }));
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

const SESSION_DURATION = 7 * 24 * 60 * 60 * 1000;

function hashSessionToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function createSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashSessionToken(token);
  const expiresAt = new Date(Date.now() + SESSION_DURATION).toISOString();

  db.prepare(`
    INSERT INTO sessions (user_id, token_hash, expires_at)
    VALUES (?, ?, ?)
  `).run(userId, tokenHash, expiresAt);

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
    banner_data: user.banner_data
  };
}

function getUserFromRequest(req) {
  const token = getSessionTokenFromCookie(req.headers.cookie);
  return getUserFromSessionToken(token);
}

function setSessionCookie(res, token) {
  res.setHeader(
    'Set-Cookie',
    `sauran_session=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_DURATION / 1000}`
  );
}

function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', 'sauran_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0');
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

app.post('/api/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    const result = createVerification(username, email, password);

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

    const sessionToken = createSession(result.id);
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
        avatar_data: result.avatar_data
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

app.post('/api/login', (req, res) => {
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

    const sessionToken = createSession(result.id);
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
        avatar_data: result.avatar_data
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

    return res.json(result);

  } catch (error) {
    console.error('Şifre güncelleme API hatası:', error);
    return res.status(500).json({ success: false, error: 'Güncellenemedi.' });
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

app.post('/api/hubs', (req, res) => {
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

    hub.members = hub.members.map(m => ({ ...m, online: isUserOnline(m.user_id) }));

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

app.post('/api/hubs/:id/invite', (req, res) => {
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

    const targetSockets = activeUsers.get(Number(req.body?.to_user_id));
    if (targetSockets) {
      targetSockets.forEach(sid => io.to(sid).emit('notification_received', { type: 'hub_invite' }));
    }

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
    res.json({ success: true, messages: getHubMessages(hubId, 50) });
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

app.post('/api/hubs/:id/share', (req, res) => {
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

app.post('/api/hubs/:id/voice', (req, res) => {
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

app.post('/api/hubs/:id/file', (req, res) => {
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
    let roomName = getHubDailyRoomName(hubId);
    let roomUrl = null;

    if (roomName) {
      const existing = await daily.getRoom(roomName);
      if (existing) roomUrl = existing.url;
      else roomName = null;
    }

    if (!roomName) {
      roomName = `sauran-hub-${hubId}-${crypto.randomBytes(3).toString('hex')}`;
      const created = await daily.createRoom(roomName);
      roomUrl = created.url;
      setHubDailyRoomName(hubId, roomName);
    }

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
    let roomName = getVoiceRoomDailyName(roomId);
    let roomUrl = null;

    if (roomName) {
      const existing = await daily.getRoom(roomName);
      if (existing) roomUrl = existing.url;
      else roomName = null;
    }

    if (!roomName) {
      roomName = `sauran-vr-${roomId}-${crypto.randomBytes(3).toString('hex')}`;
      const created = await daily.createRoom(roomName);
      roomUrl = created.url;
      setVoiceRoomDailyName(roomId, roomName);
    }

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

    let roomUrl = null;
    const existing = await daily.getRoom(roomName);

    if (existing) {
      roomUrl = existing.url;
    } else {
      const created = await daily.createRoom(roomName, { screenshare: false });
      roomUrl = created.url;
    }

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
// AKTİF KULLANICILAR
// userId -> Set(socketId)
// =====================================================

const activeUsers = new Map();
const activeUserNames = new Map(); // userId -> username (son bilinen)

function isUserOnline(userId) {
  const sockets = activeUsers.get(userId);
  return Boolean(sockets && sockets.size > 0);
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
    const friends = listFriends(user.id).map(f => ({ ...f, online: isUserOnline(f.id) }));
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
    const friends = getTopFriends(user.id, 5).map(f => ({ ...f, online: isUserOnline(f.id) }));
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

// =====================================================
// ŞİFREMİ UNUTTUM
// =====================================================

app.post('/api/password-reset/request', async (req, res) => {
  try {
    const result = requestPasswordReset(req.body?.email);

    if (!result.success) {
      return res.status(400).json(result);
    }

    const user = db.prepare(`SELECT email FROM users WHERE id = ?`).get(result.userId);
    await sendPasswordResetEmail(user.email, result.code);

    return res.json({ success: true });

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

app.post('/api/friends/request', (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;

  try {
    const result = sendFriendRequest(user.id, Number(req.body?.to_user_id));

    if (!result.success) {
      return res.status(400).json(result);
    }

    const targetSockets = activeUsers.get(Number(req.body?.to_user_id));
    if (targetSockets) {
      targetSockets.forEach(sid => {
        io.to(sid).emit('friend_request_received', { from_username: user.username });
        io.to(sid).emit('notification_received', { type: 'friend_request' });
      });
    }

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
    const result = respondFriendRequest(user.id, Number(req.body?.user_id), Boolean(req.body?.accept));

    if (!result.success) {
      return res.status(400).json(result);
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

    return res.json({ success: true, profile: { ...profile, online: isUserOnline(profile.id) } });

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

      const toUserId = Number(data?.to_user_id);
      const result = saveDmMessage(socket.userId, socket.username, toUserId, data?.content);

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

      const message = saveHubMessage(hubId, socket.userId, socket.username, content);

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