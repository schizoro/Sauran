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

// VERİ MİNİMİZASYONU: FCM (Google altyapısı) üzerinden mesaj İÇERİĞİ, gönderen ADI, lobi adı ve kullanıcıya ya da konuşmaya özgü HİÇBİR tanımlayıcı
// (kullanıcı/sohbet/lobi numarası, o numaralarla kurulan bildirim etiketi, yönlendirme URL'si) ASLA gönderilmez. Yük yalnızca bildirim TÜRÜNÜ ve o türe ait
// sabit, genel bir cümleyi taşır. Çağıranın verdiği title/body/url/tag bilerek YOK SAYILIR: bir çağıran hatası bile bir şey sızdıramaz.
// Bildirime dokunulunca uygulama tür bazlı GENEL bir ekranı açar (mesaj/arkadaş listesi ya da bildirim paneli); gerçek kullanıcı ve mesaj bilgileri
// uygulama açıldıktan sonra oturumlu mevcut API'lerden ve Socket.io'dan alınır.
const GENERIC_BODY = {
  dm_message: 'Yeni mesajınız var',
  hub_message: 'Lobide yeni mesaj var',
  incoming_call: 'Gelen arama',
  friend_request: 'Yeni bir arkadaşlık isteğin var',
  friend_request_accepted: 'Bir arkadaşlık isteğin kabul edildi',
  hub_invite: 'Yeni bir lobi davetin var',
  platform_role_notice: 'Sauran Yönetim: Yeni bir görev bildirimin var.',
  platform_role_revoked: 'Sauran Yönetim: Yönetim görevin hakkında bir bilgilendirme var.'
};
const GENERIC_FALLBACK = 'Yeni bir bildirimin var';

// Google'a giden içeriği üretir (sınanabilirlik için dışa açık). Yalnızca tür + sabit metin; başka hiçbir alan yoktur.
function buildGenericContent({ type } = {}) {
  const known = Object.prototype.hasOwnProperty.call(GENERIC_BODY, type);
  return {
    title: 'Sauran',
    body: known ? GENERIC_BODY[type] : GENERIC_FALLBACK,
    data: { type: known ? String(type) : 'generic' }
  };
}

// Kullanıcının isteğiyle: yalnızca mesaj/arama türlerinde gönderen adı (title) ve mesaj önizlemesi (body) bildirimde görünür.
// Diğer bütün türler (arkadaşlık, davet, yönetim bildirimleri...) sabit genel metinle kalır. Kimlik numarası, URL, etiket ya da lobi adı yine gönderilmez.
const RICH_TYPES = new Set(['dm_message', 'hub_message', 'incoming_call']);
const clip = (s, n) => String(s).replace(/\s+/g, ' ').trim().slice(0, n);
function buildContent({ type, title, body } = {}) {
  const generic = buildGenericContent({ type });
  if (RICH_TYPES.has(type) && typeof title === 'string' && title.trim() && typeof body === 'string' && body.trim()) {
    return { title: clip(title, 60), body: clip(body, 140), data: generic.data, rich: true };
  }
  return { ...generic, rich: false };
}

// Verilen cihaz anahtarlarına bildirim gönderir; artık geçersiz olan anahtarları döndürür.
async function sendToTokens(tokens, { type, title, body } = {}) {
  if (!configured || !tokens.length) return [];

  const content = buildContent({ type, title, body });

  const response = await messaging.sendEachForMulticast({
    tokens,
    notification: { title: content.title, body: content.body },
    data: content.data,
    android: {
      priority: 'high',
      ttl: 60 * 60 * 1000,
      // Etiket yalnızca bildirim TÜRÜdür (kişiye/sohbete özgü değil): aynı türden bildirimler birikmek yerine tek bildirimde birleşir.
      notification: { channelId: 'sauran_messages', icon: 'ic_stat_message', ...(content.rich ? {} : { tag: content.data.type }) }
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
  sendToTokens,
  buildGenericContent,
  buildContent
};
