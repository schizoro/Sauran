'use strict';
// Sürüm kimliği (yeni sürüm yayına alınınca istemcinin kendiliğinden yenilenmesi için) ve "Sorunu bildir" kaydı.
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, client, makeUser } = require('./helpers');

let srv;
test.before(async () => { srv = await startServer((dbm) => { makeUser(dbm, 'rapor'); makeUser(dbm, 'radmin', { role: 'admin' }); return {}; }); });
test.after(async () => { if (srv) await srv.stop(); });

test('Sürüm kimliği oturumsuz okunur ve sabittir', async () => {
  const a = await client(srv.base).get('/api/version');
  const b = await client(srv.base).get('/api/version');
  assert.equal(a.status, 200);
  assert.match(a.body.build, /^[0-9a-f]{12}$/);
  assert.equal(a.body.build, b.body.build);
});

test('Sorunu bildir: kayıt sunucu olaylarına düşer, metinler kırpılır, yönetim görür', async () => {
  const c = client(srv.base);
  assert.equal((await c.login('rapor', 'Passw0rd!x')).status, 200);
  const r = await c.post('/api/client-report', { code: 'SR-ABCD', message: 'x'.repeat(5000), stack: 'at foo', path: '/app', note: 'mesaj gönderirken' });
  assert.equal(r.status, 200);
  const adm = client(srv.base);
  await adm.login('radmin', 'Passw0rd!x');
  const h = await adm.get('/api/admin/server-health');
  const ev = (h.body.events || []).find((e) => e.kind === 'client_report');
  assert.ok(ev, 'olay kaydedildi');
  assert.match(ev.message, /SR-ABCD · mesaj gönderirken/);
  assert.ok(ev.detail.length < 2600, 'kırpıldı');
});

test('Sorunu bildir: satır sonu ile sahte satır eklenemez, URL sorguları silinir, geçersiz kod "SR-?" olur', async () => {
  const c = client(srv.base);
  assert.equal((await c.login('rapor', 'Passw0rd!x')).status, 200);
  await c.post('/api/client-report', { code: '<script>', note: 'not\nkullanıcı: 1', message: 'hata https://sauran.online/reset?token=GIZLI#x', path: '/app' });
  const adm = client(srv.base);
  await adm.login('radmin', 'Passw0rd!x');
  const ev = (await adm.get('/api/admin/server-health')).body.events.find((e) => e.kind === 'client_report' && e.message.startsWith('SR-?'));
  assert.ok(ev, 'geçersiz kod SR-? olarak kaydedildi');
  assert.equal(ev.message, 'SR-? · not kullanıcı: 1', 'not tek satır');
  assert.ok(!/GIZLI/.test(ev.detail), 'sorgu kısmı silindi');
  assert.equal((ev.detail.match(/^kullanıcı:/gm) || []).length, 1, 'sahte satır yok');
});

test('Oturumsuz bildirime daha sıkı sınır (10 dakikada 3)', async () => {
  const anon = client(srv.base);
  const codes = [];
  for (let i = 0; i < 4; i++) codes.push((await anon.post('/api/client-report', { code: 'SR-0000' })).status);
  assert.deepEqual(codes.slice(0, 3), [200, 200, 200]);
  assert.equal(codes[3], 429);
});
