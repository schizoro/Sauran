'use strict';
// Görünüm tercihleri hesaba kaydedilir; yalnızca bilinen alanlar ve geçerli değerler kabul edilir.
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, client, makeUser } = require('./helpers');

let srv;
test.before(async () => { srv = await startServer((dbm) => { makeUser(dbm, 'gorunum'); return {}; }); });
test.after(async () => { if (srv) await srv.stop(); });

test('Tercihler kaydedilir, /api/me ile döner; geçersiz değerler yok sayılır', async () => {
  const c = client(srv.base);
  assert.equal((await c.login('gorunum', 'Passw0rd!x')).status, 200);
  assert.equal((await c.get('/api/me')).body.user.ui_prefs, null, 'başta yok');
  const r = await c.patch('/api/me/ui-prefs', { theme: 'oled', chatFont: 18, density: 'compact', reduceMotion: true, motionSync: false, evil: '<x>' });
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.ui_prefs, { theme: 'oled', chatFont: 18, density: 'compact', reduceMotion: true, motionSync: false });
  const bad = await c.patch('/api/me/ui-prefs', { theme: 'neon', chatFont: 99, density: 'x', reduceMotion: 'evet' });
  assert.deepEqual(bad.body.ui_prefs, { theme: 'oled', chatFont: 18, density: 'compact', reduceMotion: true, motionSync: false }, 'geçersizler değiştirmez');
  assert.deepEqual((await c.get('/api/me')).body.user.ui_prefs.theme, 'oled');
  assert.equal((await client(srv.base).patch('/api/me/ui-prefs', { theme: 'dark' })).status, 401);
});
