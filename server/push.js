require('dotenv').config();

const webpush = require('web-push');
// FCM ile AYNI genel içerik üreticisi (tek doğruluk kaynağı): bildirim metni türe göre sabittir.
const { buildGenericContent } = require('./fcm');

// VAPID anahtarlarını üretmek için (bir kez):  npx web-push generate-vapid-keys
const PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const SUBJECT = process.env.VAPID_SUBJECT || (process.env.MAIL_FROM ? `mailto:${process.env.MAIL_FROM}` : null);

const configured = Boolean(PUBLIC_KEY && PRIVATE_KEY && SUBJECT);

if (configured) {
  webpush.setVapidDetails(SUBJECT, PUBLIC_KEY, PRIVATE_KEY);
} else {
  console.warn('Web Push kapalı: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY ve VAPID_SUBJECT (ya da MAIL_FROM) ayarlanmamış.');
}

// VERİ MİNİMİZASYONU: Web Push (tarayıcı üreticisinin push hizmeti) yükünde mesaj içeriği, gönderen adı, lobi adı, kullanıcı/sohbet/lobi numarası ya da
// kişiselleştirilmiş yönlendirme (URL, name=) ASLA bulunmaz. Yük yalnızca genel bir başlık, türe göre sabit bir metin ve genel `type` içerir.
// Çağıranın verdiği title/body/url/tag bilerek YOK SAYILIR (bir çağıran hatası bile bir şey sızdıramaz). Web Push şifrelemesi (web-push kütüphanesi) aynen sürer.
// Tıklama davranışı servis işçisinde (sw.js) `type` ile tür bazlı genel ekrana yönlendirir; gerçek bilgiler uygulama açılınca oturumlu API/Socket.io'dan gelir.
function buildPayload({ type } = {}) {
  const content = buildGenericContent({ type });
  return { title: content.title, body: content.body, type: content.data.type, tag: content.data.type };
}

function sendNotification(subscription, payload) {
  return webpush.sendNotification(subscription, JSON.stringify(buildPayload(payload)), { TTL: 60 * 60, urgency: 'high' });
}

module.exports = {
  isConfigured: () => configured,
  getPublicKey: () => PUBLIC_KEY || null,
  sendNotification,
  buildPayload
};
