// Off-site yedek adaptörü (S3 uyumlu depolama: Cloudflare R2, Backblaze B2, AWS S3, MinIO...). Ek bağımlılık YOK (yalnızca Node crypto + fetch).
//
// GÜVENLİK: Yedek kişisel veri içerir. Bu yüzden dosya, YÜKLENMEDEN ÖNCE AES-256-GCM ile şifrelenir; şifreleme anahtarı BACKUP_ENCRYPTION_KEY
// (en az 16 karakter parola) olmadan yükleme yapılmaz. Depolama sağlayıcısı yalnızca şifreli veriyi görür. Anahtar KAYBOLURSA yedek çözülemez.
//
// Ortam değişkenleri (değerleri HİÇBİR yerde yazdırılmaz; yalnızca "ayarlı/eksik" bildirilir):
//   BACKUP_S3_ENDPOINT           örn. https://<hesap>.r2.cloudflarestorage.com
//   BACKUP_S3_BUCKET             kova adı
//   BACKUP_S3_REGION             varsayılan "auto"
//   BACKUP_S3_ACCESS_KEY_ID
//   BACKUP_S3_SECRET_ACCESS_KEY
//   BACKUP_S3_PREFIX             isteğe bağlı klasör öneki (varsayılan "sauran/")
//   BACKUP_ENCRYPTION_KEY        şifreleme parolası (scrypt ile anahtara çevrilir)

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const REQUIRED = ['BACKUP_S3_ENDPOINT', 'BACKUP_S3_BUCKET', 'BACKUP_S3_ACCESS_KEY_ID', 'BACKUP_S3_SECRET_ACCESS_KEY', 'BACKUP_ENCRYPTION_KEY'];
const MAGIC = Buffer.from('SAURANBK1');

function status(env = process.env) {
  const missing = REQUIRED.filter((k) => !String(env[k] || '').trim());
  if (env.BACKUP_ENCRYPTION_KEY && String(env.BACKUP_ENCRYPTION_KEY).length < 16) missing.push('BACKUP_ENCRYPTION_KEY (en az 16 karakter)');
  return { configured: missing.length === 0, missing };
}

function deriveKey(passphrase, salt) { return crypto.scryptSync(String(passphrase), salt, 32); }

// Biçim: MAGIC | salt(16) | iv(12) | tag(16) | şifreli veri
function encrypt(buffer, passphrase) {
  const salt = crypto.randomBytes(16), iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', deriveKey(passphrase, salt), iv);
  const enc = Buffer.concat([cipher.update(buffer), cipher.final()]);
  return Buffer.concat([MAGIC, salt, iv, cipher.getAuthTag(), enc]);
}

function decrypt(blob, passphrase) {
  if (blob.length < MAGIC.length + 44 || !blob.subarray(0, MAGIC.length).equals(MAGIC)) throw new Error('Geçersiz yedek biçimi.');
  let o = MAGIC.length;
  const salt = blob.subarray(o, o += 16), iv = blob.subarray(o, o += 12), tag = blob.subarray(o, o += 16);
  const decipher = crypto.createDecipheriv('aes-256-gcm', deriveKey(passphrase, salt), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(blob.subarray(o)), decipher.final()]);
}

const hmac = (key, data) => crypto.createHmac('sha256', key).update(data).digest();
const sha256hex = (data) => crypto.createHash('sha256').update(data).digest('hex');

// AWS Signature V4 (path-style PUT).
function signPut({ endpoint, bucket, key, region, accessKey, secretKey, body, now = new Date() }) {
  const url = new URL(endpoint);
  const amzDate = now.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  const date = amzDate.slice(0, 8);
  const canonicalUri = '/' + [bucket, ...key.split('/')].map(encodeURIComponent).join('/');
  const payloadHash = sha256hex(body);
  const headers = { host: url.host, 'x-amz-content-sha256': payloadHash, 'x-amz-date': amzDate };
  const signedHeaders = Object.keys(headers).sort().join(';');
  const canonicalHeaders = Object.keys(headers).sort().map((h) => `${h}:${headers[h]}\n`).join('');
  const canonicalRequest = ['PUT', canonicalUri, '', canonicalHeaders, signedHeaders, payloadHash].join('\n');
  const scope = `${date}/${region}/s3/aws4_request`;
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256hex(canonicalRequest)].join('\n');
  const kSigning = hmac(hmac(hmac(hmac('AWS4' + secretKey, date), region), 's3'), 'aws4_request');
  const signature = crypto.createHmac('sha256', kSigning).update(stringToSign).digest('hex');
  return {
    url: `${url.origin}${canonicalUri}`,
    headers: { ...headers, Authorization: `AWS4-HMAC-SHA256 Credential=${accessKey}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}` }
  };
}

// Yedek dosyasını şifreleyip yükler. Yapılandırma eksikse yüklemez (hata fırlatmaz): { uploaded:false, reason }.
async function uploadBackup(filePath, { env = process.env, fetchImpl = fetch } = {}) {
  const st = status(env);
  if (!st.configured) return { uploaded: false, reason: 'yapılandırılmamış', missing: st.missing };

  const plain = fs.readFileSync(filePath);
  const blob = encrypt(plain, env.BACKUP_ENCRYPTION_KEY);
  const prefix = String(env.BACKUP_S3_PREFIX || 'sauran/').replace(/^\/+/, '');
  const key = `${prefix}${path.basename(filePath)}.enc`;
  const signed = signPut({
    endpoint: env.BACKUP_S3_ENDPOINT, bucket: env.BACKUP_S3_BUCKET, key, region: env.BACKUP_S3_REGION || 'auto',
    accessKey: env.BACKUP_S3_ACCESS_KEY_ID, secretKey: env.BACKUP_S3_SECRET_ACCESS_KEY, body: blob
  });
  const res = await fetchImpl(signed.url, { method: 'PUT', headers: { ...signed.headers, 'content-length': String(blob.length) }, body: blob });
  if (!res.ok) return { uploaded: false, reason: `sağlayıcı HTTP ${res.status}` }; // yanıt gövdesi (hesap bilgisi içerebilir) yazdırılmaz
  return { uploaded: true, key, bytes: blob.length, sha256_encrypted: sha256hex(blob) };
}

module.exports = { status, encrypt, decrypt, signPut, uploadBackup, REQUIRED };
