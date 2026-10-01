require('dotenv').config();

const DAILY_API_KEY = process.env.DAILY_API_KEY;
const DAILY_API_BASE = 'https://api.daily.co/v1';

async function dailyFetch(path, options = {}) {
  const response = await fetch(`${DAILY_API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${DAILY_API_KEY}`,
      'Content-Type': 'application/json',
      ...options.headers
    }
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.info || data?.error || `Daily API hatası (${response.status})`);
  }

  return data;
}

async function createRoom(roomName, { screenshare = true } = {}) {
  return dailyFetch('/rooms', {
    method: 'POST',
    body: JSON.stringify({
      name: roomName,
      privacy: 'private',
      properties: {
        enable_screenshare: screenshare,
        enable_chat: false,
        start_video_off: true,
        start_audio_off: false,
        eject_at_room_exp: false,
        enable_prejoin_ui: false
      }
    })
  });
}

async function getRoom(roomName) {
  try {
    return await dailyFetch(`/rooms/${roomName}`);
  } catch (error) {
    return null;
  }
}

// İki kullanıcı (ör. arayan ve kabul eden) aynı anda aynı oda adına istek
// atabilir — ikisi de odayı bulamayıp aynı anda oluşturmaya çalışırsa Daily
// API'si ikinci isteği "oda zaten var" hatasıyla reddeder. Bu durumda
// oluşturmayı başaran diğer isteğin odasını bulup onu kullanıyoruz.
async function getOrCreateRoom(roomName, opts = {}) {
  const existing = await getRoom(roomName);
  if (existing) return existing;

  try {
    return await createRoom(roomName, opts);
  } catch (error) {
    const fallback = await getRoom(roomName);
    if (fallback) return fallback;
    throw error;
  }
}

async function createMeetingToken(roomName, userName, userId) {
  const data = await dailyFetch('/meeting-tokens', {
    method: 'POST',
    body: JSON.stringify({
      properties: {
        room_name: roomName,
        user_name: userName,
        ...(userId ? { user_id: String(userId) } : {}),
        // Token yalnızca odaya GİRİŞ için kullanılır; kısa ömür, atılan/yetkisi kalkan birinin eski token ile geri girebileceği süreyi daraltır.
        exp: Math.floor(Date.now() / 1000) + 60 * 30
      }
    })
  });

  return data.token;
}

// Odayı Daily tarafında siler. Oda zaten yoksa (404) başarılı sayılır (idempotent); diğer hatalarda fırlatır.
async function deleteRoom(roomName) {
  const response = await fetch(`${DAILY_API_BASE}/rooms/${encodeURIComponent(roomName)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${DAILY_API_KEY}` }
  });

  if (response.ok || response.status === 404) return true;

  let info = '';
  try { info = (await response.json())?.info || ''; } catch (_) { /* yoksay */ }
  throw new Error(info || `Daily API hatası (${response.status})`);
}

// Kullanıcıyı (meeting token'daki user_id ile) Daily odasından çıkarır; ban=true ise aynı oturuma bu user_id ile yeniden giremez.
// Oda yoksa/oturum açık değilse sessizce geçilir (en iyi çaba).
async function ejectUser(roomName, userId, { ban = false } = {}) {
  if (!DAILY_API_KEY || !roomName || !userId) return false;
  try {
    await dailyFetch(`/rooms/${encodeURIComponent(roomName)}/eject`, {
      method: 'POST',
      body: JSON.stringify({ user_ids: [String(userId)], ban: Boolean(ban) })
    });
    return true;
  } catch (_) {
    return false;
  }
}

module.exports = { ejectUser, createRoom, getRoom, getOrCreateRoom, createMeetingToken, deleteRoom, isConfigured: () => Boolean(DAILY_API_KEY) };
