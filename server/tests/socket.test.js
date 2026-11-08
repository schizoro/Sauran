'use strict';
// Gerçek zamanlı bağlantı (Socket.IO) testleri: bağlantı kimlik doğrulaması, DM ve Lobi mesajlarının yalnızca
// doğru kişilere ulaşması, Lobi kelime filtresi.
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, client, makeUser, socket } = require('./helpers');

let srv, S;
const http = {};
const sock = {};

test.before(async () => {
  srv = await startServer((dbm) => {
    const alice = makeUser(dbm, 'alice');
    const bob = makeUser(dbm, 'bob');
    const carol = makeUser(dbm, 'carol');
    dbm.sendFriendRequest(bob.id, alice.id); dbm.respondFriendRequest(alice.id, bob.id, true);
    const h = dbm.createHub(alice.id, { name: 'Soket Lobi', type: 'hub' });
    const hubId = h.id || (h.hub && h.hub.id);
    const inv = dbm.createHubInvite(hubId, alice.id, {});
    dbm.joinHubByCode(inv.code || (inv.invite && inv.invite.code), bob.id);
    return { alice, bob, carol, hubId };
  });
  S = srv.seeded;
  for (const name of ['alice', 'bob', 'carol']) {
    http[name] = client(srv.base);
    assert.equal((await http[name].login(name, 'Passw0rd!x')).status, 200);
    sock[name] = socket(srv.base, http[name].cookie);
    await sock[name].ready;
  }
});

test.after(async () => {
  for (const s of Object.values(sock)) s.close();
  if (srv) await srv.stop();
});

test('Oturum çerezi olmadan / sahte çerezle bağlantı kurulamaz', async () => {
  await assert.rejects(socket(srv.base, '').ready);
  await assert.rejects(socket(srv.base, 'sauran_session=sahte-belirtec').ready);
});

test('DM: alıcıya ve gönderene ulaşır, üçüncü kişiye ulaşmaz; kalıcı kaydedilir', async () => {
  const gotP = sock.bob.waitFor('dm_message', (m) => m.content === 'selam bob DM_1');
  const echoP = sock.alice.waitFor('dm_message', (m) => m.content === 'selam bob DM_1');
  sock.alice.emit('dm_message', { to_user_id: S.bob.id, content: 'selam bob DM_1', client_id: 'c1' });
  const got = await gotP;
  assert.equal(got.user_id, S.alice.id);
  const echo = await echoP;
  assert.equal(echo.client_id, 'c1');
  assert.ok(await sock.carol.expectNone('dm_message'), 'carol DM almamalı');
  const page = await http.bob.get(`/api/dm/${S.alice.id}/messages`);
  assert.ok(page.text.includes('DM_1'));
});

test('DM: arkadaş olmayana gönderilemez', async () => {
  const err = sock.carol.waitFor('message_error');
  sock.carol.emit('dm_message', { to_user_id: S.alice.id, content: 'izinsiz DM_2' });
  await err;
  assert.ok(await sock.alice.expectNone('dm_message', (m) => m.content === 'izinsiz DM_2'));
});

test('DM: sahte gönderen kimliği yok sayılır (gönderen her zaman oturum sahibi)', async () => {
  const gotP = sock.alice.waitFor('dm_message', (m) => m.content === 'kimlik DM_3');
  sock.bob.emit('dm_message', { to_user_id: S.alice.id, content: 'kimlik DM_3', user_id: S.carol.id, username: 'carol' });
  const got = await gotP;
  assert.equal(got.user_id, S.bob.id);
  assert.equal(got.username, 'bob');
});

test('Lobi: üye olmayan Lobi kanalına katılamaz ve mesaj gönderemez/alamaz', async () => {
  sock.alice.emit('join_hub', S.hubId);
  sock.bob.emit('join_hub', S.hubId);
  const joinErr = sock.carol.waitFor('message_error', (e) => /üye değil/.test(String(e)));
  sock.carol.emit('join_hub', S.hubId);
  await joinErr;
  await new Promise((r) => setTimeout(r, 150));
  const sendErr = sock.carol.waitFor('message_error', (e) => /üye değil/.test(String(e)));
  sock.carol.emit('hub_chat_message', { hub_id: S.hubId, content: 'izinsiz LOBI_1' });
  await sendErr;
  const bobGets = sock.bob.waitFor('hub_message', (m) => m.content === 'herkese LOBI_2');
  sock.alice.emit('hub_chat_message', { hub_id: S.hubId, content: 'herkese LOBI_2' });
  await bobGets;
  assert.ok(await sock.carol.expectNone('hub_message'), 'üye olmayan Lobi mesajı almamalı');
  assert.ok(!(await http.alice.get(`/api/hubs/${S.hubId}/messages`)).text.includes('LOBI_1'));
});

test('Lobi: 2000 karakter sınırı', async () => {
  const err = sock.bob.waitFor('message_error', (e) => /uzun/.test(String(e)));
  sock.bob.emit('hub_chat_message', { hub_id: S.hubId, content: 'x'.repeat(2001) });
  await err;
});

test('Lobi kelime filtresi: engelleme modunda mesaj yayınlanmaz', async () => {
  const set = await http.alice.put(`/api/hubs/${S.hubId}/word-filter`, { enabled: true, use_preset: true, terms: 'yasakkelime', action: 'block' });
  assert.equal(set.status, 200, set.text);
  const blocked = sock.bob.waitFor('message_blocked');
  sock.bob.emit('hub_chat_message', { hub_id: S.hubId, content: 'bu bir yasakkelime FILTRE_1' });
  await blocked;
  assert.ok(await sock.alice.expectNone('hub_message', (m) => String(m.content).includes('FILTRE_1')));
});

test('DM: 2000 karakter gider; 2001 sessizce kesilmez, reddedilir ve hata hangi mesaja ait olduğunu söyler', async () => {
  const ok = 'UZUN_OK_' + 'a'.repeat(1992);
  const got = sock.bob.waitFor('dm_message', (m) => m.content === ok.slice(0, 2000));
  sock.alice.emit('dm_message', { to_user_id: S.bob.id, content: ok.slice(0, 2000), client_id: 'u1' });
  assert.equal((await got).content.length, 2000);
  const err = sock.alice.waitFor('message_error', (e) => Array.isArray(e) && e[1] === 'u2');
  sock.alice.emit('dm_message', { to_user_id: S.bob.id, content: 'b'.repeat(2001), client_id: 'u2' });
  assert.match(String((await err)[0]), /uzun/);
  assert.ok(await sock.bob.expectNone('dm_message', (m) => String(m.content).startsWith('bbbb')));
});

test('Mesaj hataları gönderilen geçici mesajın kimliğini taşır (yanlış balon işaretlenmesin)', async () => {
  const err = sock.carol.waitFor('message_error', (e) => Array.isArray(e) && e[1] === 'c-kimlik-1');
  sock.carol.emit('hub_chat_message', { hub_id: S.hubId, content: 'izinsiz', client_id: 'c-kimlik-1' });
  assert.match(String((await err)[0]), /üye değil/);
  const err2 = sock.carol.waitFor('message_error', (e) => Array.isArray(e) && e[1] === 'c-kimlik-2');
  sock.carol.emit('dm_message', { to_user_id: S.alice.id, content: 'arkadaş değiliz', client_id: 'c-kimlik-2' });
  await err2;
});

test('Arama: görüşmede olmayan birinin "meşgul" yanıtı yok sayılır; normal ret iletilir', async () => {
  // alice'in süren bir DM görüşmesi yok: busy ret sahte/yanlış kabul edilir, bob'a hiçbir şey gitmez (diğer cihazlar çalmaya devam eder).
  sock.alice.emit('dm_call_decline', { to_user_id: S.bob.id, busy: true });
  assert.ok(await sock.bob.expectNone('dm_call_declined', (d) => d.from_user_id === S.alice.id && d.busy === true));
  const got = sock.bob.waitFor('dm_call_declined', (d) => d.from_user_id === S.alice.id);
  sock.alice.emit('dm_call_decline', { to_user_id: S.bob.id });
  assert.equal((await got).busy, false);
});
