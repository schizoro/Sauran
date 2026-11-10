'use strict';
// Kanal başına bildirim ayarı (kişiye özel, geçersiz/üye olmayan reddedilir) ve özel mesaja HTTP ile dosya yükleme
// (yalnızca arkadaşa; arkadaş olmayana reddedilir).
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, client, makeUser } = require('./helpers');

let srv, S;
test.before(async () => {
  srv = await startServer((dbm) => {
    const ali = makeUser(dbm, 'alinot');
    const ece = makeUser(dbm, 'ecenot');
    const yab = makeUser(dbm, 'yabanci');
    dbm.sendFriendRequest(ece.id, ali.id); dbm.respondFriendRequest(ali.id, ece.id, true);
    const h = dbm.createHub(ali.id, { name: 'Bildirim Lobi', type: 'hub' });
    const hubId = h.id || (h.hub && h.hub.id);
    const inv = dbm.createHubInvite(hubId, ali.id, {});
    dbm.joinHubByCode(inv.code || (inv.invite && inv.invite.code), ece.id);
    return { hubId, ece: ece.id, yab: yab.id };
  });
  S = srv.seeded;
});
test.after(async () => { if (srv) await srv.stop(); });

async function login(name) {
  const c = client(srv.base);
  assert.equal((await c.login(name, 'Passw0rd!x')).status, 200);
  return c;
}

test('Kanal bildirim ayarı: kaydedilir, kişiye özel, geçersiz seçim ve üye olmayan reddedilir', async () => {
  const ali = await login('alinot');
  const ece = await login('ecenot');
  const yab = await login('yabanci');
  const hub = (await ali.get(`/api/hubs/${S.hubId}`)).body.hub;
  const ch = hub.channels[0];
  assert.equal(ch.notify_mode, 'all', 'varsayılan: tüm mesajlar');

  assert.equal((await ali.patch(`/api/hubs/${S.hubId}/channels/${ch.id}/notify`, { mode: 'mentions' })).status, 200);
  assert.equal((await ali.get(`/api/hubs/${S.hubId}`)).body.hub.channels[0].notify_mode, 'mentions');
  assert.equal((await ece.get(`/api/hubs/${S.hubId}`)).body.hub.channels[0].notify_mode, 'all', 'başka üyeyi etkilemez');

  assert.equal((await ali.patch(`/api/hubs/${S.hubId}/channels/${ch.id}/notify`, { mode: 'bazen' })).status, 400, 'geçersiz seçim');
  assert.equal((await yab.patch(`/api/hubs/${S.hubId}/channels/${ch.id}/notify`, { mode: 'none' })).status, 403, 'üye olmayan');

  assert.equal((await ali.patch(`/api/hubs/${S.hubId}/channels/${ch.id}/notify`, { mode: 'all' })).status, 200);
  assert.equal((await ali.get(`/api/hubs/${S.hubId}`)).body.hub.channels[0].notify_mode, 'all');
});

test('DM dosyası (HTTP): arkadaşa gider, arkadaş olmayana reddedilir', async () => {
  const ali = await login('alinot');
  const file = { data: 'data:text/plain;base64,' + Buffer.from('merhaba').toString('base64'), name: 'not.txt', mime: 'text/plain', size: 7 };
  const ok = await ali.post(`/api/dm/${S.ece}/file`, { file });
  assert.equal(ok.status, 200, ok.text);
  assert.ok(ok.body.id);
  const msgs = (await ali.get(`/api/dm/${S.ece}/messages`)).body.messages;
  assert.ok(msgs.some((m) => m.id === ok.body.id), 'mesaj kaydedildi');

  const bad = await ali.post(`/api/dm/${S.yab}/file`, { file });
  assert.equal(bad.status, 400, 'arkadaş olmayana gönderilemez');
});
