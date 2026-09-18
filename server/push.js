require('dotenv').config();

const webpush = require('web-push');

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

function sendNotification(subscription, payload) {
  return webpush.sendNotification(subscription, JSON.stringify(payload), { TTL: 60 * 60, urgency: 'high' });
}

module.exports = {
  isConfigured: () => configured,
  getPublicKey: () => PUBLIC_KEY || null,
  sendNotification
};
