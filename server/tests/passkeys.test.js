'use strict';
// Geçiş anahtarı: yazılımla taklit edilen bir doğrulayıcı (P-256 anahtar çifti) ile uçtan uca kayıt + şifresiz giriş.
// Gerçek tarayıcı olmadan WebAuthn verisini (CBOR attestationObject, authenticatorData, imza) burada üretiyoruz.
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const { startServer, client, makeUser } = require('./helpers');

let srv, S;
test.before(async () => {
  srv = await startServer((dbm) => {
    const pk = makeUser(dbm, 'pkuser');
    const other = makeUser(dbm, 'pkother');
    const susp = makeUser(dbm, 'pksusp');
    const reset = makeUser(dbm, 'pkreset');
    const tfa = makeUser(dbm, 'pktfa');
    return { pk: pk.id, other: other.id, susp: susp.id, reset: reset.id, tfa: tfa.id };
  });
  S = srv.seeded;
});
test.after(async () => { if (srv) await srv.stop(); });

// --- Küçük CBOR kodlayıcı (yalnızca gerekli tipler)
function head(major, n) {
  if (n < 24) return Buffer.from([(major << 5) | n]);
  if (n < 256) return Buffer.from([(major << 5) | 24, n]);
  const b = Buffer.alloc(3); b[0] = (major << 5) | 25; b.writeUInt16BE(n, 1); return b;
}
function cbor(v) {
  if (Buffer.isBuffer(v)) return Buffer.concat([head(2, v.length), v]);
  if (typeof v === 'string') { const b = Buffer.from(v, 'utf8'); return Buffer.concat([head(3, b.length), b]); }
  if (typeof v === 'number') return v >= 0 ? head(0, v) : head(1, -1 - v);
  if (v instanceof Map) {
    const parts = [head(5, v.size)];
    for (const [k, val] of v) parts.push(cbor(k), cbor(val));
    return Buffer.concat(parts);
  }
  throw new Error('desteklenmeyen tip');
}
const PW = 'Passw0rd!x';
const b64u = (b) => Buffer.from(b).toString('base64url');
const sha = (b) => crypto.createHash('sha256').update(b).digest();

function makeAuthenticator() {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const jwk = publicKey.export({ format: 'jwk' });
  const credId = crypto.randomBytes(16);
  const cose = cbor(new Map([[1, 2], [3, -7], [-1, 1], [-2, Buffer.from(jwk.x, 'base64url')], [-3, Buffer.from(jwk.y, 'base64url')]]));
  let counter = 0;
  return {
    credId,
    register(options, origin) {
      const rpHash = sha(Buffer.from(options.rp.id));
      const cnt = Buffer.alloc(4);
      const idLen = Buffer.alloc(2); idLen.writeUInt16BE(credId.length);
      const authData = Buffer.concat([rpHash, Buffer.from([0x45]), cnt, Buffer.alloc(16), idLen, credId, cose]);
      const clientData = Buffer.from(JSON.stringify({ type: 'webauthn.create', challenge: options.challenge, origin, crossOrigin: false }));
      const att = cbor(new Map([['fmt', 'none'], ['attStmt', new Map()], ['authData', authData]]));
      return { id: b64u(credId), rawId: b64u(credId), type: 'public-key', clientExtensionResults: {},
        response: { clientDataJSON: b64u(clientData), attestationObject: b64u(att), transports: ['internal'] } };
    },
    login(options, origin, { rpId, challenge, flags = 0x05 } = {}) {
      counter += 1;
      const cnt = Buffer.alloc(4); cnt.writeUInt32BE(counter);
      const authData = Buffer.concat([sha(Buffer.from(rpId || options.rpId)), Buffer.from([flags]), cnt]);
      const clientData = Buffer.from(JSON.stringify({ type: 'webauthn.get', challenge: challenge || options.challenge, origin, crossOrigin: false }));
      const sig = crypto.sign('sha256', Buffer.concat([authData, sha(clientData)]), privateKey);
      return { id: b64u(credId), rawId: b64u(credId), type: 'public-key', clientExtensionResults: {},
        response: { clientDataJSON: b64u(clientData), authenticatorData: b64u(authData), signature: b64u(sig) } };
    }
  };
}

async function loggedIn(name) {
  const c = client(srv.base);
  assert.equal((await c.login(name, 'Passw0rd!x')).status, 200);
  return c;
}

test('Oturumsuz kullanıcı geçiş anahtarı ekleyemez, listeleyemez, silemez', async () => {
  const c = client(srv.base);
  assert.equal((await c.post('/api/passkeys/register/options')).status, 401);
  assert.equal((await c.post('/api/passkeys/register/verify', { response: {} })).status, 401);
  assert.equal((await c.get('/api/passkeys')).status, 401);
  assert.equal((await c.del('/api/passkeys/abc')).status, 401);
});

let auth;
test('Kayıt: seçenekler kaynak alan adına göre üretilir, doğrulanan anahtar listede görünür', async () => {
  const c = await loggedIn('pkuser');
  assert.equal((await c.post('/api/passkeys/register/options')).status, 403, 'şifresiz ekleme başlamaz');
  assert.equal((await c.post('/api/passkeys/register/options', { password: 'yanlis' })).status, 403);
  const o = await c.post('/api/passkeys/register/options', { password: PW });
  assert.equal(o.status, 200);
  assert.equal(o.body.options.authenticatorSelection.userVerification, 'required');
  const opt = o.body.options;
  assert.equal(opt.rp.id, '127.0.0.1');
  assert.equal(opt.rp.name, 'Sauran');
  assert.equal(opt.authenticatorSelection.residentKey, 'required');
  assert.ok(opt.user.id && opt.user.id.length > 20, 'kullanıcı tutamacı rastgele bayt olmalı (kullanıcı adı/id değil)');
  assert.notEqual(Buffer.from(opt.user.id, 'base64url').toString(), String(S.pk));

  auth = makeAuthenticator();
  const v = await c.post('/api/passkeys/register/verify', { response: auth.register(opt, srv.base), name: 'Test cihazı\u0000<b>' });
  assert.equal(v.status, 200, JSON.stringify(v.body));
  const list = (await c.get('/api/passkeys')).body.passkeys;
  assert.equal(list.length, 1);
  assert.equal(list[0].id, b64u(auth.credId));
  assert.ok(!list[0].name.includes('\u0000'));
  assert.ok(!('public_key' in list[0]));

  // Aynı meydan okuma tekrar kullanılamaz
  const again = await c.post('/api/passkeys/register/verify', { response: auth.register(opt, srv.base) });
  assert.equal(again.status, 400);
});

test('Kayıt: yanlış köken reddedilir', async () => {
  const c = await loggedIn('pkother');
  const opt = (await c.post('/api/passkeys/register/options', { password: PW })).body.options;
  const bad = makeAuthenticator();
  const v = await c.post('/api/passkeys/register/verify', { response: bad.register(opt, 'https://kotu.example') });
  assert.equal(v.status, 400);
  assert.equal((await c.get('/api/passkeys')).body.passkeys.length, 0);
});

test('Giriş: geçerli imza oturum açar ve sayaç güncellenir', async () => {
  const c = client(srv.base);
  const o = await c.post('/api/passkeys/login/options');
  assert.equal(o.status, 200);
  assert.deepEqual(o.body.options.allowCredentials || [], []);
  const v = await c.post('/api/passkeys/login/verify', { challenge_id: o.body.challenge_id, response: auth.login(o.body.options, srv.base) });
  assert.equal(v.status, 200, JSON.stringify(v.body));
  const me = await c.get('/api/me');
  assert.equal(me.status, 200);
  assert.equal((me.body.user || me.body).username, 'pkuser');
  const list = (await c.get('/api/passkeys')).body.passkeys;
  assert.ok(list[0].last_used_at);
});

test('Giriş: meydan okuma tek kullanımlık; yanlış köken/imza/bilinmeyen anahtar reddedilir', async () => {
  const c = client(srv.base);
  const o = await c.post('/api/passkeys/login/options');
  const good = auth.login(o.body.options, srv.base);
  assert.equal((await c.post('/api/passkeys/login/verify', { challenge_id: o.body.challenge_id, response: good })).status, 200);
  // Tekrar oynatma
  const c2 = client(srv.base);
  assert.equal((await c2.post('/api/passkeys/login/verify', { challenge_id: o.body.challenge_id, response: good })).status, 400);

  const o2 = await c2.post('/api/passkeys/login/options');
  assert.equal((await c2.post('/api/passkeys/login/verify', { challenge_id: o2.body.challenge_id, response: auth.login(o2.body.options, 'https://kotu.example') })).status, 401);

  const o3 = await c2.post('/api/passkeys/login/options');
  const forged = auth.login(o3.body.options, srv.base);
  forged.response.signature = b64u(crypto.randomBytes(70));
  assert.equal((await c2.post('/api/passkeys/login/verify', { challenge_id: o3.body.challenge_id, response: forged })).status, 401);

  const o4 = await c2.post('/api/passkeys/login/options');
  const stranger = makeAuthenticator().login(o4.body.options, srv.base);
  assert.equal((await c2.post('/api/passkeys/login/verify', { challenge_id: o4.body.challenge_id, response: stranger })).status, 401);
  assert.equal((await c2.get('/api/me')).status, 401);
});

test('Başkasının geçiş anahtarı silinemez; sahibi silebilir', async () => {
  const other = await loggedIn('pkother');
  assert.equal((await other.del(`/api/passkeys/${b64u(auth.credId)}`)).status, 404);
  const owner = await loggedIn('pkuser');
  assert.equal((await owner.del(`/api/passkeys/${b64u(auth.credId)}`)).status, 200);
  assert.equal((await owner.get('/api/passkeys')).body.passkeys.length, 0);
});

test('Askıdaki hesap geçiş anahtarıyla giremez', async () => {
  const c = await loggedIn('pksusp');
  const opt = (await c.post('/api/passkeys/register/options', { password: PW })).body.options;
  const a = makeAuthenticator();
  assert.equal((await c.post('/api/passkeys/register/verify', { response: a.register(opt, srv.base) })).status, 200);
  const ext = extDb();
  ext.prepare(`UPDATE users SET account_status = 'suspended', suspension_user_reason = 'test' WHERE id = ?`).run(S.susp);
  ext.close();
  const n = client(srv.base);
  const o = await n.post('/api/passkeys/login/options');
  const v = await n.post('/api/passkeys/login/verify', { challenge_id: o.body.challenge_id, response: a.login(o.body.options, srv.base) });
  assert.equal(v.status, 403);
  assert.equal(v.body.suspension.user_reason, 'test');
  assert.equal((await n.get('/api/me')).status, 401);
});

function extDb() {
  const Database = require('better-sqlite3');
  return new Database(require('path').join(srv.dataDir, 'sauran.db'));
}

test('Giriş: kullanıcı doğrulaması (UV) olmayan imza reddedilir', async () => {
  const c = await loggedIn('pkother');
  const opt = (await c.post('/api/passkeys/register/options', { password: PW })).body.options;
  const a = makeAuthenticator();
  assert.equal((await c.post('/api/passkeys/register/verify', { response: a.register(opt, srv.base) })).status, 200);
  const n = client(srv.base);
  const o = await n.post('/api/passkeys/login/options');
  const resp = a.login(o.body.options, srv.base, { flags: 0x01 }); // yalnızca "dokundu" (UP), UV yok
  assert.equal((await n.post('/api/passkeys/login/verify', { challenge_id: o.body.challenge_id, response: resp })).status, 401);
});

test('Aynı IP çok sayıda giriş meydan okuması açınca eskiler düşer, yenisi çalışır (küresel kilit yok)', async () => {
  const c = client(srv.base);
  const first = await c.post('/api/passkeys/login/options');
  for (let i = 0; i < 6; i++) await c.post('/api/passkeys/login/options');
  // İlk bilet düşürüldü
  assert.equal((await c.post('/api/passkeys/login/verify', { challenge_id: first.body.challenge_id, response: { id: 'x' } })).status, 400);
});

test('2FA açık hesapta ekleme için doğrulama kodu da gerekir', async () => {
  const totp = require('../totp');
  const c = await loggedIn('pktfa');
  const setup = await c.post('/api/2fa/setup', { password: PW });
  assert.equal((await c.post('/api/2fa/enable', { code: totp.hotp(setup.body.secret, totp.currentStep()) })).status, 200);
  assert.equal((await c.post('/api/passkeys/register/options', { password: PW })).status, 401, 'kodsuz başlamaz');
  assert.equal((await c.post('/api/passkeys/register/options', { password: PW, code: '12345' })).status, 401);
});

test('Şifre sıfırlanınca hesabın tüm geçiş anahtarları silinir', async () => {
  const c = await loggedIn('pkreset');
  const opt = (await c.post('/api/passkeys/register/options', { password: PW })).body.options;
  const a = makeAuthenticator();
  assert.equal((await c.post('/api/passkeys/register/verify', { response: a.register(opt, srv.base) })).status, 200);

  const authcodes = require('../authcodes');
  const ext = extDb();
  ext.prepare(`INSERT INTO password_resets (user_id, code, expires_at) VALUES (?, ?, ?)`)
    .run(S.reset, authcodes.hashCode('123456', `reset:${S.reset}`), new Date(Date.now() + 600000).toISOString());
  ext.close();
  const r = await client(srv.base).post('/api/password-reset/confirm', { email: 'pkreset@test.invalid', code: '123456', new_password: 'YeniSifre!42x' });
  assert.equal(r.status, 200, r.text);

  const n = client(srv.base);
  const o = await n.post('/api/passkeys/login/options');
  assert.equal((await n.post('/api/passkeys/login/verify', { challenge_id: o.body.challenge_id, response: a.login(o.body.options, srv.base) })).status, 401);
});
