'use strict';
// Saf modüllerin birim testleri: 2FA (TOTP), e-posta/sıfırlama kodları, kelime filtresi, bağlantı önizleme SSRF koruması, görsel meta temizleme.
// Çalıştır: npm test (server klasöründe)
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

// totp.js anahtar dosyasını DATA_DIR'e yazar: gerçek veri klasörüne dokunmasın.
process.env.DATA_DIR = process.env.DATA_DIR || fs.mkdtempSync(path.join(os.tmpdir(), 'sauran-unit-'));

const totp = require('../totp');
const codes = require('../authcodes');
const wf = require('../wordfilter');
const lp = require('../linkpreview');
const meta = require('../imagemeta');

// ---------------------------------------------------------------- TOTP
test('TOTP: RFC 6238 test vektörleri (SHA1, 6 hane)', () => {
  // RFC 6238 Ek B anahtarı "12345678901234567890" (ASCII) → base32
  const secret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
  const vectors = [[59, '287082'], [1111111109, '081804'], [1111111111, '050471'], [1234567890, '005924'], [2000000000, '279037']];
  for (const [t, code] of vectors) assert.equal(totp.hotp(secret, Math.floor(t / 30)), code, `t=${t}`);
});

test('TOTP: ±1 adım kabul, ±2 adım red, aynı/eski adım tekrar kullanılamaz', () => {
  const secret = totp.generateSecret();
  const now = 1_700_000_000_000;
  const step = totp.currentStep(now);
  assert.equal(totp.verifyTotp(secret, totp.hotp(secret, step), null, now), step);
  assert.equal(totp.verifyTotp(secret, totp.hotp(secret, step - 1), null, now), step - 1);
  assert.equal(totp.verifyTotp(secret, totp.hotp(secret, step + 1), null, now), step + 1);
  assert.equal(totp.verifyTotp(secret, totp.hotp(secret, step - 2), null, now), null);
  assert.equal(totp.verifyTotp(secret, totp.hotp(secret, step + 2), null, now), null);
  // Tekrar oynatma: son kullanılan adım ve öncesi reddedilir
  assert.equal(totp.verifyTotp(secret, totp.hotp(secret, step), step, now), null);
  assert.equal(totp.verifyTotp(secret, totp.hotp(secret, step - 1), step, now), null);
});

test('TOTP: biçimsiz kod reddedilir, boşluk yok sayılır', () => {
  const secret = totp.generateSecret();
  const now = 1_700_000_000_000;
  const code = totp.hotp(secret, totp.currentStep(now));
  for (const bad of ['', null, undefined, '12345', '1234567', 'abcdef', code + 'x']) assert.equal(totp.verifyTotp(secret, bad, null, now), null, String(bad));
  assert.notEqual(totp.verifyTotp(secret, code.slice(0, 3) + ' ' + code.slice(3), null, now), null);
});

test('TOTP: gizli anahtar şifreleme gidiş-dönüş; şifreli metin düz anahtarı içermez', () => {
  const secret = totp.generateSecret();
  const enc = totp.encryptSecret(secret);
  assert.ok(!enc.includes(secret));
  assert.equal(totp.decryptSecret(enc), secret);
  assert.notEqual(totp.encryptSecret(secret), enc, 'aynı anahtar her seferinde farklı şifrelenmeli (rastgele IV)');
});

test('TOTP: kurtarma kodları benzersiz; hash biçim farkından etkilenmez', () => {
  const list = totp.generateRecoveryCodes(10);
  assert.equal(new Set(list).size, 10);
  const c = list[0];
  assert.equal(totp.hashRecoveryCode(c), totp.hashRecoveryCode(c.toLowerCase().replace(/-/g, ' ')));
  assert.notEqual(totp.hashRecoveryCode(list[0]), totp.hashRecoveryCode(list[1]));
});

// ---------------------------------------------------------------- Doğrulama kodları
test('Kodlar: 6 hane; doğru kod + doğru bağlam kabul, yanlış bağlam/kod red', () => {
  const code = codes.generateNumericCode();
  assert.match(code, /^\d{6}$/);
  const stored = codes.hashCode(code, 'verify:a@b.com');
  assert.ok(codes.isHashedCode(stored));
  assert.ok(!stored.includes(code), 'kod düz metin saklanmamalı');
  assert.equal(codes.verifyCode(code, stored, 'verify:a@b.com'), true);
  assert.equal(codes.verifyCode(` ${code} `, stored, 'verify:a@b.com'), true);
  assert.equal(codes.verifyCode(code, stored, 'verify:c@d.com'), false, 'başka e-postanın kodu geçmemeli');
  assert.equal(codes.verifyCode(code === '000000' ? '000001' : '000000', stored, 'verify:a@b.com'), false);
  assert.equal(codes.verifyCode('', stored, 'verify:a@b.com'), false);
  assert.equal(codes.verifyCode(code, code, 'verify:a@b.com'), false, 'düz metin kayıt kabul edilmemeli');
  assert.equal(codes.verifyCode('1'.repeat(33), stored, 'verify:a@b.com'), false);
});

// ---------------------------------------------------------------- Kelime filtresi
test('Kelime filtresi: kaçamaklar yakalanır, masum kelimeler geçer', () => {
  const hit = (t) => wf.scan(t, { usePreset: true }).hit;
  for (const bad of ['amk', 'AMKKK', 's.i.k.t.i.r', 'Siktir git', 'or0spu', 'orospular', 'fuuuck you']) assert.ok(hit(bad), bad);
  for (const ok of ['sikke topladım', 'sık sık gelirim', 'sıkıntı yok', 'Scunthorpe', 'merhaba dünya', '']) assert.ok(!hit(ok), ok);
});

test('Kelime filtresi: lobi listesi; * kök eşleşmesi; liste temizliği', () => {
  const terms = wf.parseTerms('elma, armut*\n  , iki kelime, armut*, ' + 'x'.repeat(41));
  assert.deepEqual(terms, ['elma', 'armut*']);
  const has = (t) => wf.scan(t, { terms }).hit;
  assert.ok(has('bir elma'));
  assert.ok(has('armutlar'));
  assert.ok(!has('elmalar'), 'yıldızsız terim yalnızca tam kelimeyi yakalar');
  assert.ok(!has('amk'), 'hazır liste kapalıyken yakalanmaz');
  assert.equal(wf.parseTerms(Array.from({ length: 300 }, (_, i) => 'k' + i)).length, wf.MAX_TERMS);
});

// ---------------------------------------------------------------- Bağlantı önizleme (SSRF)
test('SSRF: iç ağ / özel IP adresleri engelli', () => {
  for (const ip of ['127.0.0.1', '10.1.2.3', '172.16.0.1', '172.31.255.255', '192.168.1.1', '169.254.169.254', '0.0.0.0', '100.64.0.1', '224.0.0.1',
    '::1', '::', 'fe80::1', 'fc00::1', 'fd12::1', '::ffff:127.0.0.1', '::ffff:7f00:1', '::ffff:a9fe:a9fe', '::7f00:1', '::127.0.0.1', '::ffff:0:7f00:1', '0:0:0:0:0:ffff:7f00:1', '2002:7f00:1::', '2001:0:1::1', '0064:ff9b::1', 'fe80::1%eth0', '2001:db8::1', 'fec0::1', '100::1']) {
    assert.equal(lp.isBlockedIp(ip), true, ip);
  }
  for (const ip of ['8.8.8.8', '1.1.1.1', '172.32.0.1', '2606:4700::1111', '::ffff:8.8.8.8', '2002:808:808::1', '2a00:1450:4001::200e']) assert.equal(lp.isBlockedIp(ip), false, ip);
  assert.equal(lp.isBlockedIp('not-an-ip'), true, 'IP olmayan değer güvenli tarafta engelli sayılır');
});

test('SSRF: checkUrl tehlikeli bağlantıları reddeder', () => {
  for (const u of ['http://127.0.0.1/', 'http://localhost/', 'http://foo.localhost/', 'http://printer.local/', 'http://db.internal/',
    'http://[::1]/', 'http://[::ffff:127.0.0.1]/', 'http://[::ffff:169.254.169.254]/latest/meta-data/', 'http://[::ffff:a9fe:a9fe]/', 'http://[::127.0.0.1]/', 'http://[2002:a9fe:a9fe::]/', 'http://2130706433/', 'http://0x7f.1/',
    'http://169.254.169.254/', 'ftp://example.com/', 'file:///etc/passwd', 'javascript:alert(1)', 'http://user:pw@example.com/', 'http://example.com:8080/', 'http://localhost./', 'http://metadata.google.internal./', 'http://[fec0::1]/', 'kötü']) {
    assert.equal(lp.checkUrl(u), null, u);
  }
  const ok = lp.checkUrl('https://example.com/yol?a=1#parca');
  assert.equal(ok && ok.href, 'https://example.com/yol?a=1', 'güvenli adres kabul edilir, # kısmı atılır');
});

test('Önizleme: metindeki ilk bağlantı bulunur', () => {
  assert.equal(lp.firstUrl('bak https://example.com/a. süper'), 'https://example.com/a');
  assert.equal(lp.firstUrl('bağlantı yok'), null);
});

// ---------------------------------------------------------------- Görsel meta verisi
test('Görsel: JPEG EXIF (konum vb.) temizlenir, görsel bozulmaz', async () => {
  const sharp = require('sharp');
  const jpeg = await sharp({ create: { width: 8, height: 8, channels: 3, background: '#f00' } })
    .jpeg().withExif({ IFD0: { Artist: 'GIZLI_AD', ImageDescription: 'GIZLI_KONUM' } }).toBuffer();
  assert.ok(jpeg.includes('GIZLI_AD'), 'örnek dosya EXIF içermeli');
  const out = meta.stripImageMetadata('data:image/jpeg;base64,' + jpeg.toString('base64'));
  const buf = Buffer.from(String(out).split(',')[1], 'base64');
  assert.ok(!buf.includes('GIZLI_AD') && !buf.includes('GIZLI_KONUM'));
  const info = await sharp(buf).metadata();
  assert.equal(info.width, 8);
});
