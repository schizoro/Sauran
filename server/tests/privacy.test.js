'use strict';
// Gizlilik paketi: arkadaşlık isteği kaynakları (Herkes / Arkadaşların arkadaşları / Lobi üyeleri) ve Yok sayma.
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, client, makeUser } = require('./helpers');

let srv, S;
test.before(async () => {
  srv = await startServer((dbm) => {
    const ali = makeUser(dbm, 'ali');     // ayarlarını değiştiren hedef
    const ece = makeUser(dbm, 'ece');     // ali'nin arkadaşı (ortak arkadaş)
    const fof = makeUser(dbm, 'fofo');    // ece'nin arkadaşı → ali için "arkadaşın arkadaşı"
    const lob = makeUser(dbm, 'lobi');    // ali ile aynı lobide
    const yab = makeUser(dbm, 'yabanci'); // hiçbir bağı yok
    const gur = makeUser(dbm, 'gurultu'); // ali'nin yok saydığı
    dbm.sendFriendRequest(ece.id, ali.id); dbm.respondFriendRequest(ali.id, ece.id, true);
    dbm.sendFriendRequest(fof.id, ece.id); dbm.respondFriendRequest(ece.id, fof.id, true);
    const h = dbm.createHub(ali.id, { name: 'Gizlilik Lobisi', type: 'hub' });
    const hubId = h.id || (h.hub && h.hub.id);
    const inv = dbm.createHubInvite(hubId, ali.id, {});
    dbm.joinHubByCode(inv.code || (inv.invite && inv.invite.code), lob.id);
    return { ali: ali.id, fof: fof.id, lob: lob.id, yab: yab.id, gur: gur.id };
  });
  S = srv.seeded;
});
test.after(async () => { if (srv) await srv.stop(); });

async function login(name) {
  const c = client(srv.base);
  assert.equal((await c.login(name, 'Passw0rd!x')).status, 200);
  return c;
}

test('Varsayılan: herkes istek gönderebilir; ayarlar okunur', async () => {
  const ali = await login('ali');
  const r = await ali.get('/api/privacy');
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.friend_requests, { everyone: true, friends_of_friends: true, lobby_members: true });
});

test('"Herkes" kapalıyken yalnızca arkadaşın arkadaşı ve lobi üyesi istek gönderebilir', async () => {
  const ali = await login('ali');
  assert.equal((await ali.patch('/api/privacy/friend-requests', { everyone: false })).status, 200);

  const yab = await login('yabanci');
  const p = await yab.get(`/api/users/${S.ali}/profile`);
  assert.equal(p.body.can_friend_request ?? p.body.profile?.can_friend_request, false, 'profil, isteğin gönderilemeyeceğini söyler');
  const r1 = await yab.post('/api/friends/request', { to_user_id: S.ali });
  assert.equal(r1.status, 400);
  assert.equal(r1.body.code, 'privacy');

  const fof = await login('fofo');
  assert.equal((await fof.post('/api/friends/request', { to_user_id: S.ali })).status, 200, 'arkadaşın arkadaşı gönderebilir');

  const lob = await login('lobi');
  assert.equal((await lob.post('/api/friends/request', { to_user_id: S.ali })).status, 200, 'lobi üyesi gönderebilir');
});

test('Üçü de kapalıysa kimse istek gönderemez', async () => {
  const ali = await login('ali');
  await ali.patch('/api/privacy/friend-requests', { everyone: false, friends_of_friends: false, lobby_members: false });
  const gur = await login('gurultu');
  const r = await gur.post('/api/friends/request', { to_user_id: S.ali });
  assert.equal(r.status, 400);
  await ali.patch('/api/privacy/friend-requests', { everyone: true });
});

test('Yok sayma: liste, profil işareti; yok sayılanın isteği bildirim üretmez ve gönderen bunu bilmez', async () => {
  const ali = await login('ali');
  assert.equal((await ali.post(`/api/users/${S.gur}/ignore`)).status, 200);
  const list = await ali.get('/api/users/ignored');
  assert.deepEqual(list.body.ignored.map((u) => u.username), ['gurultu']);
  const prof = await ali.get(`/api/users/${S.gur}/profile`);
  assert.equal(prof.body.ignored_by_me ?? prof.body.profile?.ignored_by_me, true);

  const gur = await login('gurultu');
  const before = (await ali.get('/api/notifications')).body.notifications.length;
  const r = await gur.post('/api/friends/request', { to_user_id: S.ali });
  assert.equal(r.status, 200);
  assert.equal(r.body.silent, undefined, 'gönderen yok sayıldığını öğrenmez');
  const after = (await ali.get('/api/notifications')).body.notifications.length;
  assert.equal(after, before, 'bildirim oluşmaz');
  const reqs = await ali.get('/api/friends/requests');
  const incoming = reqs.body.requests || reqs.body.incoming || [];
  assert.ok(!incoming.some((r) => r.username === 'gurultu'), 'yok sayılanın isteği bekleyenler listesinde görünmez');

  assert.equal((await ali.del(`/api/users/${S.gur}/ignore`)).status, 200);
  assert.equal((await ali.get('/api/users/ignored')).body.ignored.length, 0);
});

test('Kendini yok sayamazsın', async () => {
  const ali = await login('ali');
  assert.equal((await ali.post(`/api/users/${S.ali}/ignore`)).status, 400);
});

test('Yeni uç noktalar oturum ister; geçersiz kimlik 400 döner', async () => {
  const anon = client(srv.base);
  for (const [m, u] of [['get', '/api/privacy'], ['patch', '/api/privacy/friend-requests'], ['post', `/api/users/${S.gur}/ignore`], ['del', `/api/users/${S.gur}/ignore`], ['get', '/api/users/ignored']]) {
    assert.equal((await anon[m](u)).status, 401, `${m} ${u}`);
  }
  const ali = await login('ali');
  assert.equal((await ali.post('/api/users/abc/ignore')).status, 400);
  assert.equal((await ali.patch('/api/privacy/friend-requests', {})).status, 400, 'boş değişiklik reddedilir');
  assert.equal((await ali.patch('/api/privacy/friend-requests', { everyone: 'evet' })).status, 400, 'boolean olmayan değer yok sayılır');
});

test('Engelleyince yok sayma kaydı temizlenir', async () => {
  const ali = await login('ali');
  await ali.post(`/api/users/${S.yab}/ignore`);
  await ali.post(`/api/users/${S.yab}/block`);
  await ali.del(`/api/users/${S.yab}/block`);
  assert.ok(!(await ali.get('/api/users/ignored')).body.ignored.some((u) => u.username === 'yabanci'));
});
