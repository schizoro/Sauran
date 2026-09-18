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
        exp: Math.floor(Date.now() / 1000) + 60 * 60 * 4
      }
    })
  });

  return data.token;
}

module.exports = { createRoom, getRoom, getOrCreateRoom, createMeetingToken, isConfigured: () => Boolean(DAILY_API_KEY) };
