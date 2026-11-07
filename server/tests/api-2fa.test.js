'use strict';
// İki adımlı doğrulama (2FA) uçtan uca: kurulum şifre ister, girişte kod zorunlu, kod tekrar kullanılamaz,
// kurtarma kodu tek kullanımlık, ikinci adım bileti deneme sınırlı.
const test = require('node:test');
const assert = require('node:assert/strict');
const totp = require('../totp');
const { startServer, client, makeUser } = require('./helpers');

let srv, S, secret, recovery, enabledStep;
const me = () => client(srv.base);

test.before(async () => {
  srv = await startServer((dbm) => ({ erin: makeUser(dbm, 'erin'), frank: makeUser(dbm, 'frank') }));
  S = srv.seeded;
});
test.after(async () => { if (srv) await srv.stop(); });

test('/api/me şifre özeti ve 2FA anahtarı içermez', async () => {
  const c = me();
  await c.login('erin', 'Passw0rd!x');
  const r = await c.get('/api/me');
  assert.equal(r.status, 200);
  assert.ok(!/password|totp_secret|token_hash|recovery/i.test(Object.keys(r.body.user).join(',')), Object.keys(r.body.user).join(','));
});

test('Kurulum yanlış şifreyle başlamaz; doğru şifre + kod ile açılır', async () => {
  const c = me();
  await c.login('erin', 'Passw0rd!x');
  assert.equal((await c.post('/api/2fa/setup', { password: 'yanlis' })).status, 403);
  const setup = await c.post('/api/2fa/setup', { password: 'Passw0rd!x' });
  assert.equal(setup.status, 200, setup.text);
  secret = setup.body.secret;
  assert.equal((await c.post('/api/2fa/enable', { code: '000000' === totp.hotp(secret, totp.currentStep()) ? '111111' : '000000' })).status >= 400, true);
  enabledStep = totp.currentStep();
  const en = await c.post('/api/2fa/enable', { code: totp.hotp(secret, enabledStep) });
  assert.equal(en.status, 200, en.text);
  recovery = en.body.recovery_codes;
  assert.equal(recovery.length, 10);
  assert.equal((await c.get('/api/2fa/status')).body.enabled, true);
});

test('Şifre tek başına oturum açmaz; yanlış kod reddedilir', async () => {
  const c = me();
  const r = await c.login('erin', 'Passw0rd!x');
  assert.equal(r.body.requires_2fa, true);
  assert.equal(c.cookie, '', 'ikinci adımdan önce çerez verilmemeli');
  assert.equal((await c.get('/api/me')).status, 401);
  const bad = await c.post('/api/login/2fa', { challenge: r.body.challenge, code: '000000' === totp.hotp(secret, totp.currentStep()) ? '111111' : '000000' });
  assert.equal(bad.status, 401);
  assert.equal((await c.post('/api/login/2fa', { challenge: 'uydurma', code: '123456' })).status, 401);
});

test('Kurulumda kullanılan kod girişte tekrar kullanılamaz; sonraki kod çalışır', async () => {
  const c = me();
  const r = await c.login('erin', 'Passw0rd!x');
  const replay = await c.post('/api/login/2fa', { challenge: r.body.challenge, code: totp.hotp(secret, enabledStep) });
  assert.equal(replay.status, 401, 'aynı kod ikinci kez geçmemeli');
  const ok = await c.post('/api/login/2fa', { challenge: r.body.challenge, code: totp.hotp(secret, enabledStep + 1) });
  assert.equal(ok.status, 200, ok.text);
  assert.equal((await c.get('/api/me')).status, 200);
});

test('Kurtarma kodu bir kez çalışır', async () => {
  const a = me();
  const r1 = await a.login('erin', 'Passw0rd!x');
  const ok = await a.post('/api/login/2fa', { challenge: r1.body.challenge, code: recovery[0] });
  assert.equal(ok.status, 200, ok.text);
  assert.equal(ok.body.recovery_used, true);
  assert.equal(ok.body.recovery_remaining, 9);
  const b = me();
  const r2 = await b.login('erin', 'Passw0rd!x');
  assert.equal((await b.post('/api/login/2fa', { challenge: r2.body.challenge, code: recovery[0] })).status, 401);
});

test('İkinci adım bileti 5 hatalı denemeden sonra geçersiz olur', async () => {
  const c = me();
  const r = await c.login('erin', 'Passw0rd!x');
  const wrong = '000000' === totp.hotp(secret, totp.currentStep()) ? '111111' : '000000';
  for (let i = 0; i < 5; i++) await c.post('/api/login/2fa', { challenge: r.body.challenge, code: wrong });
  const late = await c.post('/api/login/2fa', { challenge: r.body.challenge, code: recovery[1] });
  assert.equal(late.status, 429, 'doğru kod bile artık kabul edilmemeli');
  assert.equal((await c.get('/api/me')).status, 401);
});

test('2FA kapatma şifre + kod ister', async () => {
  const c = me();
  const r = await c.login('erin', 'Passw0rd!x');
  await c.post('/api/login/2fa', { challenge: r.body.challenge, code: recovery[2] });
  assert.equal((await c.post('/api/2fa/disable', { password: 'Passw0rd!x', code: '' })).status, 401);
  assert.equal((await c.post('/api/2fa/disable', { password: 'yanlis', code: recovery[3] })).status, 403);
  assert.equal((await c.post('/api/2fa/disable', { password: 'Passw0rd!x', code: recovery[3] })).status, 200);
  assert.equal((await c.get('/api/2fa/status')).body.enabled, false);
});

test('Giriş hız sınırı: aynı hesaba 8 denemeden sonra doğru şifre de 429 alır', async () => {
  const c = me();
  for (let i = 0; i < 8; i++) assert.equal((await c.login('frank', 'yanlis')).status, 401);
  assert.equal((await c.login('frank', 'Passw0rd!x')).status, 429, 'kaba kuvvet koruması');
});
