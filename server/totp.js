// İki adımlı doğrulama (TOTP, RFC 6238) — harici bağımlılık olmadan.
// Doğrulayıcı uygulamalarla (Google Authenticator, Microsoft Authenticator, 1Password, Authy vb.) uyumlu:
// SHA-1, 6 hane, 30 saniye. Gizli anahtarlar veritabanında AES-256-GCM ile ŞİFRELİ saklanır; anahtar ya
// TOTP_ENCRYPTION_KEY ortam değişkeninden (32 bayt, base64 ya da hex) ya da DATA_DIR içindeki ayrı bir
// dosyadan (ilk kullanımda üretilir, 0600) gelir. Böylece veritabanı (ya da yedeği) tek başına sızsa bile
// 2FA anahtarları okunamaz.
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const STEP_SECONDS = 30;
const DIGITS = 6;

function base32Encode(buf) {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32[(value << (5 - bits)) & 31];
  return out;
}

function base32Decode(str) {
  const clean = String(str || '').toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0;
  let value = 0;
  const out = [];
  for (const ch of clean) {
    value = (value << 5) | BASE32.indexOf(ch);
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

function generateSecret() {
  return base32Encode(crypto.randomBytes(20)); // 160 bit, RFC 4226 önerisi
}

function hotp(secretBase32, counter) {
  const key = base32Decode(secretBase32);
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const h = crypto.createHmac('sha1', key).update(msg).digest();
  const offset = h[h.length - 1] & 0x0f;
  const bin = ((h[offset] & 0x7f) << 24) | (h[offset + 1] << 16) | (h[offset + 2] << 8) | h[offset + 3];
  return String(bin % 10 ** DIGITS).padStart(DIGITS, '0');
}

function currentStep(now = Date.now()) {
  return Math.floor(now / 1000 / STEP_SECONDS);
}

// Kod doğruysa eşleşen zaman adımını döndürür (saat kayması için ±1 adım tolerans). lastStep verilirse o adım ve
// öncesi kabul edilmez: aynı kod (ya da daha eski bir kod) ikinci kez kullanılamaz.
function verifyTotp(secretBase32, code, lastStep = null, now = Date.now()) {
  const clean = String(code || '').replace(/\s+/g, '');
  if (!/^\d{6}$/.test(clean)) return null;
  const step = currentStep(now);
  for (const s of [step, step - 1, step + 1]) {
    if (lastStep != null && s <= lastStep) continue;
    const expected = hotp(secretBase32, s);
    if (crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(clean))) return s;
  }
  return null;
}

function otpauthUri(secretBase32, accountName, issuer = 'Sauran') {
  const label = encodeURIComponent(`${issuer}:${accountName}`);
  return `otpauth://totp/${label}?secret=${secretBase32}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=${DIGITS}&period=${STEP_SECONDS}`;
}

// ── Şifreleme anahtarı ──
let cachedKey = null;

function loadKey() {
  if (cachedKey) return cachedKey;
  const fromEnv = String(process.env.TOTP_ENCRYPTION_KEY || '').trim();
  if (fromEnv) {
    const key = /^[0-9a-f]{64}$/i.test(fromEnv) ? Buffer.from(fromEnv, 'hex') : Buffer.from(fromEnv, 'base64');
    if (key.length !== 32) throw new Error('TOTP_ENCRYPTION_KEY 32 bayt olmalı (64 hex ya da base64).');
    cachedKey = key;
    return cachedKey;
  }
  const dir = path.resolve(process.env.DATA_DIR || path.join(__dirname, '..', 'data'));
  const file = path.join(dir, 'totp.key');
  if (!fs.existsSync(file)) {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(file, crypto.randomBytes(32).toString('base64'), { mode: 0o600, flag: 'wx' });
  }
  cachedKey = Buffer.from(fs.readFileSync(file, 'utf8').trim(), 'base64');
  if (cachedKey.length !== 32) throw new Error('totp.key bozuk.');
  return cachedKey;
}

function encryptSecret(plain) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', loadKey(), iv);
  const enc = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  return `v1:${iv.toString('base64')}:${cipher.getAuthTag().toString('base64')}:${enc.toString('base64')}`;
}

function decryptSecret(stored) {
  const [v, iv, tag, data] = String(stored || '').split(':');
  if (v !== 'v1' || !iv || !tag || !data) return null;
  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', loadKey(), Buffer.from(iv, 'base64'));
    decipher.setAuthTag(Buffer.from(tag, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()]).toString('utf8');
  } catch (_) {
    return null;
  }
}

// ── Kurtarma kodları ── (yalnızca bir kez gösterilir; veritabanında SHA-256 özeti tutulur)
function generateRecoveryCodes(count = 10) {
  const codes = [];
  for (let i = 0; i < count; i += 1) {
    const raw = base32Encode(crypto.randomBytes(5)).toLowerCase(); // 8 karakter
    codes.push(`${raw.slice(0, 4)}-${raw.slice(4, 8)}`);
  }
  return codes;
}

function normalizeRecoveryCode(code) {
  return String(code || '').toLowerCase().replace(/[^a-z2-7]/g, '');
}

function hashRecoveryCode(code) {
  return crypto.createHash('sha256').update(normalizeRecoveryCode(code)).digest('hex');
}

module.exports = {
  generateSecret,
  verifyTotp,
  hotp,
  currentStep,
  otpauthUri,
  encryptSecret,
  decryptSecret,
  generateRecoveryCodes,
  hashRecoveryCode,
  normalizeRecoveryCode,
  base32Decode
};
