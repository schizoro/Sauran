'use strict';
// Başka cihazdan oturum kapatılınca (tümünden çıkış ya da tek oturum) o cihaza ANINDA "session_revoked" gider ve bağlantısı kesilir;
// çıkışı yapan cihaz açık kalır.
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, client, makeUser, socket } = require('./helpers');

let srv;
test.before(async () => { srv = await startServer((dbm) => ({ u: makeUser(dbm, 'cokcihaz') })); });
test.after(async () => { if (srv) await srv.stop(); });

async function device() {
  const c = client(srv.base);
  assert.equal((await c.login('cokcihaz', 'Passw0rd!x')).status, 200);
  const s = socket(srv.base, c.cookie);
  await s.ready;
  return { c, s };
}

test('Tüm cihazlardan çıkış: diğer cihaza anında session_revoked gider, çıkışı yapan açık kalır', async () => {
  const a = await device();
  const b = await device();
  const revoked = b.s.waitFor('session_revoked');
  const r = await a.c.post('/api/sessions/logout-all');
  assert.equal(r.status, 200, r.text);
  await revoked;
  assert.equal((await b.c.get('/api/me')).status, 401, 'kapatılan cihazın oturumu geçersiz');
  assert.equal((await a.c.get('/api/me')).status, 200, 'çıkışı yapan cihaz açık kalır');
  assert.ok(await a.s.expectNone('session_revoked'));
  a.s.close(); b.s.close();
});

test('Tek oturumu kapatma: yalnızca o cihaza session_revoked gider', async () => {
  const a = await device();
  const b = await device();
  const c = await device();
  const list = (await a.c.get('/api/sessions')).body.sessions;
  // b'nin oturumu: b'nin kendi listesinde "is_current" olan
  const bId = (await b.c.get('/api/sessions')).body.sessions.find((x) => x.is_current).id;
  assert.ok(list.some((x) => x.id === bId));
  const revoked = b.s.waitFor('session_revoked');
  assert.equal((await a.c.del(`/api/sessions/${bId}`)).status, 200);
  await revoked;
  assert.ok(await c.s.expectNone('session_revoked'), 'diğer cihaz etkilenmez');
  assert.equal((await c.c.get('/api/me')).status, 200);
  a.s.close(); b.s.close(); c.s.close();
});
