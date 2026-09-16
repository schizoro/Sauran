require('dotenv').config();
const { sendVerificationEmail } = require('./mailer');
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
  createHub,
  listHubs,
  getHubDetail,
  setHubRole,
  leaveHub,
  addHubRole,
  isHubMember,
  getHubMessages,
  saveHubMessage,
  createHubPoll,
  voteHubPoll,
  createHubShare,
  deleteHub,
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
  getDmMessages,
  findUserByUsername,
  blockUser,
  unblockUser,
  updateUsername,
  updatePassword,
  db
} = require('./db');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: true,
    credentials: true,
    methods: ['GET', 'POST']
  }
});

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '3mb' }));
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
           users.status, users.avatar_visibility, users.avatar_data,
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
    avatar_data: user.avatar_data
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

// =====================================================
// AKTİF KULLANICILAR
// userId -> Set(socketId)
// =====================================================

const activeUsers = new Map();

function isUserOnline(userId) {
  const sockets = activeUsers.get(userId);
  return Boolean(sockets && sockets.size > 0);
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
      targetSockets.forEach(sid => io.to(sid).emit('friend_request_received', { from_username: user.username }));
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

  socket.on('disconnect', (reason) => {
    console.log(`Socket ayrıldı: ${username} [${socket.id}] - ${reason}`);

    if (!socket.userId) return;

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