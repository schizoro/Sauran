'use strict';
// "Beni hatırla": işaretli (varsayılan) → 7 günlük kalıcı çerez; işaretsiz → Max-Age'siz oturum çerezi (tarayıcı/uygulama kapanınca
// silinir) ve sunucuda kısa ömürlü oturum. Eski istemciler (alan göndermeyen) bugünkü gibi kalıcı oturum alır.
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, client, makeUser } = require('./helpers');

let srv;
test.before(async () => { srv = await startServer((dbm) => ({ u: makeUser(dbm, 'hatirla') })); });
test.after(async () => { if (srv) await srv.stop(); });

const sessionCookie = (res) => (res.headers.getSetCookie ? res.headers.getSetCookie() : []).find((c) => c.startsWith('sauran_session=')) || '';

test('Beni hatırla işaretli/varsayılan: kalıcı çerez; işaretsiz: oturum çerezi ve kısa ömür', async () => {
  const a = client(srv.base);
  const r1 = await a.post('/api/login', { username: 'hatirla', password: 'Passw0rd!x' });
  assert.equal(r1.status, 200);
  assert.match(sessionCookie(r1), /Max-Age=604800/, 'alan yoksa 7 günlük kalıcı çerez');

  const b = client(srv.base);
  const r2 = await b.post('/api/login', { username: 'hatirla', password: 'Passw0rd!x', remember: false });
  assert.equal(r2.status, 200);
  const c2 = sessionCookie(r2);
  assert.ok(c2, 'çerez verildi');
  assert.doesNotMatch(c2, /Max-Age/, 'işaretsizde Max-Age yok (oturum çerezi)');
  assert.match(c2, /HttpOnly/);
  assert.equal((await b.get('/api/me')).status, 200, 'oturum çalışıyor');

  // Sunucuda kısa ömür: oturum listesinde bu cihazın bitişi ~12 saat içinde
  const list = (await b.get('/api/sessions')).body.sessions;
  const mine = list.find((s) => s.is_current);
  if (mine && mine.expires_at) {
    const left = new Date(mine.expires_at).getTime() - Date.now();
    assert.ok(left <= 12 * 3600 * 1000 + 60000, 'kısa ömürlü oturum');
  }
});
