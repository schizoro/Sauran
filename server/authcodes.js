// E-posta doğrulama ve şifre sıfırlama kodları için TEK güvenli üretim + doğrulama yardımcısı.
//
//  - Üretim: crypto.randomInt (kriptografik olarak güvenli, önyargısız). Math.random KULLANILMAZ.
//  - Saklama: kod veritabanında ASLA düz metin tutulmaz. Kayıt başına rastgele tuz + scrypt (yavaş hash) ile,
//    bağlama (doğrulama: e-posta, sıfırlama: kullanıcı no) bağlanmış olarak `s1$<tuz>$<hash>` biçiminde saklanır.
//  - Doğrulama: aynı yöntemle yeniden hesaplanır ve sabit zamanlı karşılaştırılır (timingSafeEqual).
//  - Kaba kuvvet: 6 haneli kod tek başına zayıf olduğundan, kayıt başına deneme sayısı sınırlıdır (CODE_MAX_ATTEMPTS); bkz. db.js.
//
// Bu dosya oturum belirteçlerini (index.js: randomBytes + sha256) etkilemez.
const crypto = require('crypto');

const CODE_DIGITS = 6;
const CODE_MAX_ATTEMPTS = 5;
const PREFIX = 's1$';
const HASHED = /^s1\$[0-9a-f]{32}\$[0-9a-f]{64}$/;

function generateNumericCode(digits = CODE_DIGITS) {
  return String(crypto.randomInt(0, 10 ** digits)).padStart(digits, '0');
}

function digest(code, context, salt) {
  return crypto.scryptSync(`${context}\n${code}`, salt, 32);
}

// context: kodu belirli bir kayda bağlar (ör. "verify:<e-posta>" ya da "reset:<kullanıcı no>")
function hashCode(code, context) {
  const salt = crypto.randomBytes(16);
  return `${PREFIX}${salt.toString('hex')}$${digest(String(code), context, salt).toString('hex')}`;
}

function isHashedCode(stored) {
  return HASHED.test(String(stored || ''));
}

function verifyCode(code, stored, context) {
  const candidate = String(code == null ? '' : code).trim();
  if (!isHashedCode(stored) || candidate.length === 0 || candidate.length > 32) return false;

  const [, saltHex, hashHex] = String(stored).split('$');
  const actual = digest(candidate, context, Buffer.from(saltHex, 'hex'));
  return crypto.timingSafeEqual(actual, Buffer.from(hashHex, 'hex'));
}

module.exports = { generateNumericCode, hashCode, verifyCode, isHashedCode, CODE_MAX_ATTEMPTS, CODE_DIGITS };
