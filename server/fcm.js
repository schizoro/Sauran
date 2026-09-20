require('dotenv').config();

// Firebase Cloud Messaging (FCM): Android uygulaması tamamen kapalıyken de bildirim gelmesini sağlar.
// Web Push'tan (push.js) bağımsızdır; tarayıcı / iPhone abonelikleri aynen çalışmaya devam eder.
//
// Kurulum: Firebase konsolu -> Proje ayarları -> Hizmet hesapları -> "Yeni özel anahtar oluştur".
// İndirilen JSON, Render ortam değişkeni olarak eklenir (dosya depoya KOYULMAZ):
//   FIREBASE_SERVICE_ACCOUNT_JSON     = JSON'un tamamı (tek satır)
//   veya FIREBASE_SERVICE_ACCOUNT_BASE64 = aynı JSON'un base64 hali
// Ayarlanmamışsa FCM kapalıdır ve sunucu normal çalışır.

let messaging = null;
let configured = false;

function readCredentials() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
    || (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64
      ? Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf8')
      : '');
  return raw.trim() ? JSON.parse(raw) : null;
}

try {
  const credentials = readCredentials();

  if (credentials) {
    const { initializeApp, cert } = require('firebase-admin/app');
    const { getMessaging } = require('firebase-admin/messaging');
    const app = initializeApp({ credential: cert(credentials) }, 'sauran-fcm');
    messaging = getMessaging(app);
    configured = true;
    console.log(`FCM açık (proje: ${credentials.project_id || 'bilinmiyor'}).`);
  } else {
    console.warn('FCM kapalı: FIREBASE_SERVICE_ACCOUNT_JSON (ya da _BASE64) ayarlanmamış.');
  }
} catch (error) {
  console.error('FCM başlatılamadı (anahtar bozuk olabilir):', error.message);
}

const INVALID_TOKEN_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
  'messaging/invalid-argument'
]);

// Verilen cihaz anahtarlarına bildirim gönderir; artık geçersiz olan anahtarları döndürür.
async function sendToTokens(tokens, { title, body, url, tag, type }) {
  if (!configured || !tokens.length) return [];

  const response = await messaging.sendEachForMulticast({
    tokens,
    notification: { title: String(title || 'Sauran'), body: String(body || '') },
    data: { url: String(url || '/'), tag: String(tag || ''), type: String(type || '') },
    android: {
      priority: 'high',
      ttl: 60 * 60 * 1000,
      notification: {
        channelId: 'sauran_messages',
        icon: 'ic_stat_message',
        ...(tag ? { tag: String(tag) } : {})
      }
    }
  });

  const invalid = [];
  response.responses.forEach((result, index) => {
    if (result.success) return;
    const code = result.error && result.error.code;
    if (INVALID_TOKEN_CODES.has(code)) invalid.push(tokens[index]);
    else console.error('FCM gönderim hatası:', code || (result.error && result.error.message));
  });

  return invalid;
}

module.exports = {
  isConfigured: () => configured,
  sendToTokens
};
