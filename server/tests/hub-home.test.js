'use strict';
// Telefon ana ekranı: lobi listesinde son mesaj önizlemesi, sabitleme (kişiye özel) ve sessize alma.
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, client, makeUser, socket } = require('./helpers');

let srv, S;
test.before(async () => {
  srv = await startServer((dbm) => {
    const ali = makeUser(dbm, 'ali');
    const ece = makeUser(dbm, 'ece');
    const h = dbm.createHub(ali.id, { name: 'Ana Lobi', type: 'hub' });
    const hubId = h.id || (h.hub && h.hub.id);
    const inv = dbm.createHubInvite(hubId, ali.id, {});
    dbm.joinHubByCode(inv.code || (inv.invite && inv.invite.code), ece.id);
    return { hubId };
  });
  S = srv.seeded;
});
test.after(async () => { if (srv) await srv.stop(); });

async function login(name) {
  const c = client(srv.base);
  assert.equal((await c.login(name, 'Passw0rd!x')).status, 200);
  return c;
}
const hubOf = async (c) => (await c.get('/api/hubs')).body.hubs.find((h) => h.id === S.hubId);

test('Lobi listesi: mesaj yokken önizleme boş; sabitleme ve sessize alma kişiye özel; üye olmayan sabitleyemez', async () => {
  const ali = await login('ali');
  const ece = await login('ece');
  const h0 = await hubOf(ali);
  assert.equal(h0.last, null);
  assert.equal(h0.pinned, false);
  assert.equal(h0.voice_count, 0);

  assert.equal((await ali.patch(`/api/hubs/${S.hubId}/pin`, { pinned: true })).status, 200);
  assert.equal((await hubOf(ali)).pinned, true, 'sabitleyen görür');
  assert.equal((await hubOf(ece)).pinned, false, 'diğer üyeyi etkilemez');
  assert.equal((await ali.patch(`/api/hubs/${S.hubId}/pin`, { pinned: false })).status, 200);
  assert.equal((await hubOf(ali)).pinned, false);

  assert.equal((await ece.patch(`/api/hubs/${S.hubId}/mute`, { muted: true })).status, 200);
  assert.equal((await hubOf(ece)).muted, true);
  assert.equal((await hubOf(ali)).muted, false);

  assert.equal((await ali.patch('/api/hubs/999999/pin', { pinned: true })).status, 400, 'üye olunmayan lobi sabitlenemez');
});

test('Lobi listesi: son mesaj önizlemesi (boşluklar sadeleşir), kendi mesajında mine=true', async () => {
  const ali = await login('ali');
  const ece = await login('ece');
  // Lobi mesajı uygulamadaki gibi socket üzerinden gönderilir
  const sa = socket(srv.base, ali.cookie); await sa.ready;
  const se = socket(srv.base, ece.cookie); await se.ready;
  se.emit('join_hub', S.hubId);
  sa.emit('join_hub', S.hubId);
  await new Promise((r) => setTimeout(r, 150));
  const got = se.waitFor('hub_message', (m) => /oyun var/.test(m.content));
  sa.emit('hub_chat_message', { hub_id: S.hubId, content: "Akşam   9'da oyun var" });
  await got;
  sa.close(); se.close();

  const a = (await hubOf(ali)).last;
  assert.equal(a.preview, "Akşam 9'da oyun var");
  assert.equal(a.mine, true);
  const e = (await hubOf(ece)).last;
  assert.equal(e.mine, false);
  assert.equal(e.author, 'ali');
});
