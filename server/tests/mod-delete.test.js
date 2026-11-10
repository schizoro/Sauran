'use strict';
// Moderatör silmesi: kurucu herkesin, moderatör yalnızca normal üyelerin lobi mesajını silebilir; üye başkasınınkini silemez.
// Silinen mesaj "moderatör tarafından" işaretlenir ve moderasyon kaydına yazılır.
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, client, makeUser, socket } = require('./helpers');

let srv, S;
test.before(async () => {
  srv = await startServer((dbm) => {
    const kurucu = makeUser(dbm, 'kurucu');
    const mod = makeUser(dbm, 'modkisi');
    const mod2 = makeUser(dbm, 'modiki');
    const uye = makeUser(dbm, 'uyekisi');
    const h = dbm.createHub(kurucu.id, { name: 'Mod Lobi', type: 'hub' });
    const hubId = h.id || (h.hub && h.hub.id);
    const inv = dbm.createHubInvite(hubId, kurucu.id, {});
    const code = inv.code || (inv.invite && inv.invite.code);
    [mod, mod2, uye].forEach((u) => dbm.joinHubByCode(code, u.id));
    dbm.setModerator(hubId, kurucu.id, mod.id, true);
    dbm.setModerator(hubId, kurucu.id, mod2.id, true);
    return { hubId };
  });
  S = srv.seeded;
});
test.after(async () => { if (srv) await srv.stop(); });

const http = {};
async function login(name) {
  if (http[name]) return http[name];
  const c = client(srv.base);
  assert.equal((await c.login(name, 'Passw0rd!x')).status, 200);
  http[name] = c;
  return c;
}

// Socket ile (uygulamadaki gibi) mesaj gönderir, kimliğini döndürür.
async function say(name, text) {
  const c = await login(name);
  const s = socket(srv.base, c.cookie);
  await s.ready;
  s.emit('join_hub', S.hubId);
  await new Promise((r) => setTimeout(r, 120));
  const got = s.waitFor('hub_message', (m) => m.content === text);
  s.emit('hub_chat_message', { hub_id: S.hubId, content: text });
  const m = await got;
  s.close();
  return m.id;
}
const del = async (name, id) => (await login(name)).del(`/api/messages/${id}`);

test('Moderatör silme kuralları ve işaretleme', async () => {
  const uyeMsg = await say('uyekisi', 'uye mesaji 1');
  const uyeMsg2 = await say('uyekisi', 'uye mesaji 2');
  const kurucuMsg = await say('kurucu', 'kurucu mesaji');
  const modMsg = await say('modiki', 'diger mod mesaji');

  assert.equal((await del('uyekisi', kurucuMsg)).status, 400, 'üye başkasının mesajını silemez');
  assert.equal((await del('modkisi', kurucuMsg)).status, 400, 'moderatör kurucunun mesajını silemez');
  assert.equal((await del('modkisi', modMsg)).status, 400, 'moderatör başka moderatörün mesajını silemez');

  const r1 = await del('modkisi', uyeMsg);
  assert.equal(r1.status, 200, r1.text);
  assert.equal(r1.body.by_mod, true);
  assert.equal(r1.body.target_user_id, undefined, 'hedef kimliği yanıtta açığa çıkmaz');

  assert.equal((await del('kurucu', modMsg)).status, 200, 'kurucu moderatörün mesajını silebilir');
  assert.equal((await del('kurucu', uyeMsg2)).status, 200);

  // Silinen mesaj geçmişte "moderatör tarafından" işaretli
  const page = (await (await login('uyekisi')).get(`/api/hubs/${S.hubId}/messages`)).body.messages;
  const tomb = page.find((m) => m.id === uyeMsg);
  assert.equal(tomb.kind, 'deleted');
  assert.equal(tomb.payload && tomb.payload.by_mod, true);
  assert.equal(tomb.content, '', 'içerik silinir');

  // Moderasyon kaydı
  const log = (await (await login('kurucu')).get(`/api/hubs/${S.hubId}/mod-log`)).body;
  const entries = (log.entries || log.log || []).filter((e) => e.action === 'message_delete');
  assert.ok(entries.length >= 3, 'her moderatör silmesi kayda yazılır');
});
