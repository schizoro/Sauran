'use strict';
// Tanıtım durumu: hesaba bağlı; /api/me ile gelir, PATCH /api/me/onboarding ile güncellenir; geçersiz değerler yok sayılır.
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, client, makeUser } = require('./helpers');

let srv;
test.before(async () => {
  srv = await startServer((dbm) => { makeUser(dbm, 'obuser'); makeUser(dbm, 'obother'); return {}; });
});
test.after(async () => { if (srv) await srv.stop(); });

async function login(name) {
  const c = client(srv.base);
  assert.equal((await c.login(name, 'Passw0rd!x')).status, 200);
  return c;
}

test('Oturumsuz güncelleme reddedilir', async () => {
  assert.equal((await client(srv.base).patch('/api/me/onboarding', { tour: 'done' })).status, 401);
});

test('Varsayılan boş; /api/me ile hesap oluşturma zamanı gelir', async () => {
  const c = await login('obuser');
  const ob = (await c.get('/api/me')).body.user.onboarding;
  assert.deepEqual(ob.seen, []);
  assert.equal(ob.tour, undefined);
  assert.ok(ob.account_created_at);
});

test('Güncelleme: tur, yenilikler, görülen özellikler (birleşir, tekrarsız), liste kapatma', async () => {
  const c = await login('obuser');
  let r = await c.patch('/api/me/onboarding', { tour: 'skipped', wn: '2026-11-13', seen: ['settings-search', 'passkeys'] });
  assert.equal(r.status, 200);
  r = await c.patch('/api/me/onboarding', { seen: ['passkeys', 'light-theme'], cl: 'dismissed' });
  const ob = r.body.onboarding;
  assert.equal(ob.tour, 'skipped');
  assert.equal(ob.wn, '2026-11-13');
  assert.equal(ob.cl, 'dismissed');
  assert.deepEqual(ob.seen, ['settings-search', 'passkeys', 'light-theme']);
  // Başka cihazdan (yeni oturum) aynı durum gelir
  const d = await login('obuser');
  assert.deepEqual((await d.get('/api/me')).body.user.onboarding.seen, ['settings-search', 'passkeys', 'light-theme']);
  // Turu yeniden başlat
  r = await c.patch('/api/me/onboarding', { tour: null });
  assert.equal(r.body.onboarding.tour, undefined);
});

test('Geçersiz değerler yok sayılır; başka hesabı etkilemez', async () => {
  const c = await login('obother');
  const r = await c.patch('/api/me/onboarding', { tour: 'hacked', wn: '<script>', seen: ['OK', 'a'.repeat(80), 5, '../x', 'gecerli-id'], cl: 'x', extra: 1 });
  const ob = r.body.onboarding;
  assert.equal(ob.tour, undefined);
  assert.equal(ob.wn, undefined);
  assert.equal(ob.cl, undefined);
  assert.deepEqual(ob.seen, ['gecerli-id']);
  assert.ok(!('extra' in ob));
});

test('Veri indirmede tanıtım durumu yer alır', async () => {
  const c = await login('obuser');
  const r = await c.get('/api/account/export?parts=account');
  assert.equal(r.status, 200);
  assert.ok(Array.isArray(r.body.onboarding.seen));
  assert.ok(!('account_created_at' in r.body.onboarding));
});
