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
        eject_at_room_exp: false
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

async function createMeetingToken(roomName, userName) {
  const data = await dailyFetch('/meeting-tokens', {
    method: 'POST',
    body: JSON.stringify({
      properties: {
        room_name: roomName,
        user_name: userName,
        exp: Math.floor(Date.now() / 1000) + 60 * 60 * 4
      }
    })
  });

  return data.token;
}

module.exports = { createRoom, getRoom, createMeetingToken, isConfigured: () => Boolean(DAILY_API_KEY) };
