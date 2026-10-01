require('dotenv').config();

// Apple Push Notification service (APNs): iPhone uygulaması tamamen kapalıyken de bildirim gelmesini sağlar.
// Harici paket kullanılmaz: HTTP/2 + ES256 imzalı JWT (Node'un kendi http2 ve crypto modülleri).
//
// Kurulum (Apple geliştirici hesabı açıldıktan sonra):
//   developer.apple.com → Certificates, Identifiers & Profiles → Keys → "+" → Apple Push Notifications service (APNs)
//   İndirilen AuthKey_XXXXXXXXXX.p8 dosyası depoya KOYULMAZ; Render ortam değişkenleri:
//     APNS_KEY_P8      = .p8 dosyasının içeriği (-----BEGIN PRIVATE KEY----- … dahil) ya da onun base64 hali
//     APNS_KEY_ID      = anahtarın 10 karakterlik kimliği (Keys sayfasında)
//     APNS_TEAM_ID     = 10 karakterlik Team ID (Membership sayfasında)
//     APNS_BUNDLE_ID   = online.sauran.app (varsayılan)
//     APNS_ENV         = production (App Store / TestFlight) | sandbox (Xcode'dan doğrudan kurulan geliştirme sürümü)
// Ayarlanmamışsa APNs kapalıdır ve sunucu normal çalışır.
//
// VERİ MİNİMİZASYONU (FCM ile aynı kural): Apple altyapısına mesaj İÇERİĞİ, gönderen ADI, lobi adı ya da kişiye/sohbete özgü HİÇBİR
// tanımlayıcı gönderilmez; yalnızca bildirim TÜRÜ ve o türün sabit, genel cümlesi gider (fcm.buildGenericContent).
const http2 = require('http2');
const crypto = require('crypto');
const { buildGenericContent } = require('./fcm');

const HOSTS = { production: 'https://api.push.apple.com', sandbox: 'https://api.sandbox.push.apple.com' };

function readKey() {
  const raw = String(process.env.APNS_KEY_P8 || '').trim();
  if (!raw) return null;
  const pem = raw.includes('BEGIN PRIVATE KEY') ? raw.replace(/\\n/g, '\n') : Buffer.from(raw, 'base64').toString('utf8');
  return crypto.createPrivateKey(pem);
}

let key = null;
let configured = false;
const keyId = String(process.env.APNS_KEY_ID || '').trim();
const teamId = String(process.env.APNS_TEAM_ID || '').trim();
const bundleId = String(process.env.APNS_BUNDLE_ID || 'online.sauran.app').trim();
const env = process.env.APNS_ENV === 'sandbox' ? 'sandbox' : 'production';

try {
  key = readKey();
  if (key && /^[A-Z0-9]{10}$/.test(keyId) && /^[A-Z0-9]{10}$/.test(teamId)) {
    configured = true;
    console.log(`APNs açık (${env}, ${bundleId}).`);
  } else if (key || keyId || teamId) {
    console.warn('APNs kapalı: APNS_KEY_P8, APNS_KEY_ID ve APNS_TEAM_ID birlikte ve doğru biçimde ayarlanmalı.');
  }
} catch (error) {
  console.error('APNs anahtarı okunamadı (bozuk olabilir):', error.message);
}

const b64url = (buf) => Buffer.from(buf).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');

// Apple, sağlayıcı belirtecinin en az 20 dk, en çok 60 dk'da bir yenilenmesini ister.
let cachedJwt = null;
let cachedAt = 0;

function providerToken(now = Date.now()) {
  if (cachedJwt && now - cachedAt < 40 * 60 * 1000) return cachedJwt;
  const header = b64url(JSON.stringify({ alg: 'ES256', kid: keyId }));
  const claims = b64url(JSON.stringify({ iss: teamId, iat: Math.floor(now / 1000) }));
  const signature = crypto.sign('sha256', Buffer.from(`${header}.${claims}`), { key, dsaEncoding: 'ieee-p1363' });
  cachedJwt = `${header}.${claims}.${b64url(signature)}`;
  cachedAt = now;
  return cachedJwt;
}

// Apple'a giden yük (sınanabilirlik için dışa açık): yalnızca tür + sabit metin.
function buildPayload({ type } = {}) {
  const content = buildGenericContent({ type });
  return {
    aps: {
      alert: { title: content.title, body: content.body },
      sound: 'default',
      'thread-id': content.data.type
    },
    type: content.data.type
  };
}

let session = null;

function getSession() {
  const host = process.env.APNS_HOST_OVERRIDE || HOSTS[env]; // yalnızca testte yerel sunucuya yönlendirmek için
  if (session && !session.closed && !session.destroyed) return session;
  session = http2.connect(host, process.env.APNS_HOST_OVERRIDE ? { rejectUnauthorized: false } : {});
  session.on('error', () => { session = null; });
  session.on('goaway', () => { session = null; });
  session.setTimeout(5 * 60 * 1000, () => { try { session.close(); } catch (_) { /* yoksay */ } session = null; });
  return session;
}

function sendOne(token, body) {
  return new Promise((resolve) => {
    let req;
    try {
      req = getSession().request({
        ':method': 'POST',
        ':path': `/3/device/${token}`,
        authorization: `bearer ${providerToken()}`,
        'apns-topic': bundleId,
        'apns-push-type': 'alert',
        'apns-priority': '10',
        'apns-expiration': String(Math.floor(Date.now() / 1000) + 3600),
        'content-type': 'application/json'
      });
    } catch (error) {
      resolve({ token, status: 0, reason: error.message });
      return;
    }
    let status = 0;
    let data = '';
    req.setTimeout(10000, () => req.close(http2.constants.NGHTTP2_CANCEL));
    req.on('response', (headers) => { status = Number(headers[':status']); });
    req.on('data', (chunk) => { data += chunk; });
    req.on('end', () => {
      let reason = null;
      try { reason = data ? JSON.parse(data).reason : null; } catch (_) { reason = null; }
      resolve({ token, status, reason });
    });
    req.on('error', (error) => resolve({ token, status: 0, reason: error.message }));
    req.end(body);
  });
}

const INVALID_REASONS = new Set(['BadDeviceToken', 'Unregistered', 'DeviceTokenNotForTopic']);

// Verilen cihaz anahtarlarına GENEL bir bildirim gönderir; artık geçersiz olan anahtarları döndürür.
async function sendToTokens(tokens, { type } = {}) {
  if (!configured || !tokens.length) return [];
  const body = JSON.stringify(buildPayload({ type }));
  const results = await Promise.all(tokens.map((token) => sendOne(token, body)));
  const invalid = [];
  results.forEach((r) => {
    if (r.status === 200) return;
    if (r.status === 410 || INVALID_REASONS.has(r.reason)) invalid.push(r.token);
    else console.error('APNs gönderim hatası:', r.status, r.reason || '');
  });
  return invalid;
}

module.exports = {
  isConfigured: () => configured,
  sendToTokens,
  buildPayload,
  providerToken
};
