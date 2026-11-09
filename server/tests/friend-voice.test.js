'use strict';
// Arkadaşlar listesinde "Seste · Lobi › Oda": oda bilgisi yalnızca görüntüleyen de o lobinin üyesiyse görünür
// (üye olmadığın lobide kimin konuştuğu sızmaz); arkadaş odadan çıkınca bilgi kalkar.
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, client, makeUser, socket } = require('./helpers');

let srv, S;
test.before(async () => {
  srv = await startServer((dbm) => {
    const ali = makeUser(dbm, 'ali');      // seste olan
    const ece = makeUser(dbm, 'ece');      // aynı lobide, arkadaş
    const can = makeUser(dbm, 'can');      // arkadaş ama lobide değil
    dbm.sendFriendRequest(ece.id, ali.id); dbm.respondFriendRequest(ali.id, ece.id, true);
    dbm.sendFriendRequest(can.id, ali.id); dbm.respondFriendRequest(ali.id, can.id, true);
    const h = dbm.createHub(ali.id, { name: 'Ses Lobisi', type: 'hub' });
    const hubId = h.id || (h.hub && h.hub.id);
    const inv = dbm.createHubInvite(hubId, ali.id, {});
    dbm.joinHubByCode(inv.code || (inv.invite && inv.invite.code), ece.id);
    const room = dbm.createVoiceRoom(hubId, ali.id, 'Genel Sohbet');
    const roomId = room.id || (room.room && room.room.id);
    return { hubId, roomId };
  });
  S = srv.seeded;
});
test.after(async () => { if (srv) await srv.stop(); });

async function login(name) {
  const c = client(srv.base);
  assert.equal((await c.login(name, 'Passw0rd!x')).status, 200);
  return c;
}
const voiceOf = async (c, name) => (await c.get('/api/friends')).body.friends.find((f) => f.username === name).voice;

test('Seste olan arkadaş: aynı lobideki arkadaş odayı görür, lobide olmayan görmez; çıkınca kalkar', async () => {
  const ali = await login('ali');
  const ece = await login('ece');
  const can = await login('can');
  assert.equal(await voiceOf(ece, 'ali'), null, 'seste değilken bilgi yok');

  const s = socket(srv.base, ali.cookie);
  await s.ready;
  const joined = s.waitFor('voice_room_participants_updated', (d) => d && d.room_id === S.roomId);
  s.emit('voice_room_join', { room_id: S.roomId, hub_id: S.hubId });
  await joined;

  const v = await voiceOf(ece, 'ali');
  assert.ok(v, 'aynı lobideki arkadaş görür');
  assert.equal(v.hub_id, S.hubId);
  assert.equal(v.room_id, S.roomId);
  assert.equal(v.room_name, 'Genel Sohbet');
  assert.equal(v.hub_name, 'Ses Lobisi');
  assert.equal(await voiceOf(can, 'ali'), null, 'lobide olmayan arkadaş oda bilgisini görmez');

  const left = s.waitFor('voice_room_participants_updated', (d) => d && d.room_id === S.roomId);
  s.emit('voice_room_leave', { room_id: S.roomId });
  await left.catch(() => {});
  s.close();
  // Bağlantı kopunca tolerans süresi olabilir; açıkça ayrılma (voice_room_leave) bilgiyi hemen kaldırmalı.
  assert.equal(await voiceOf(ece, 'ali'), null, 'odadan çıkınca bilgi kalkar');
});
