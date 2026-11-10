'use strict';
// Özel durum yazısı (emoji + metin + süre; görünmezken gizli, bağlantı reddedilir) ve lobi mesajı düzenleme geçmişi
// (yazar + kurucu/moderatör görür; normal üye ve özel mesaj göremez; mesaj silinince geçmiş de silinir).
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, client, makeUser, socket } = require('./helpers');

let srv, S;
test.before(async () => {
  srv = await startServer((dbm) => {
    const kur = makeUser(dbm, 'durkurucu');
    const mod = makeUser(dbm, 'durmod');
    const uye = makeUser(dbm, 'duruye');
    const ark = makeUser(dbm, 'durark');
    dbm.sendFriendRequest(ark.id, kur.id); dbm.respondFriendRequest(kur.id, ark.id, true);
    const h = dbm.createHub(kur.id, { name: 'Durum Lobi', type: 'hub' });
    const hubId = h.id || (h.hub && h.hub.id);
    const inv = dbm.createHubInvite(hubId, kur.id, {});
    const code = inv.code || (inv.invite && inv.invite.code);
    [mod, uye].forEach((u) => dbm.joinHubByCode(code, u.id));
    dbm.setModerator(hubId, kur.id, mod.id, true);
    return { hubId, kur: kur.id, mod: mod.id, uye: uye.id, ark: ark.id };
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
const memberOf = async (viewer, userId) => (await (await login(viewer)).get(`/api/hubs/${S.hubId}`)).body.hub.members.find((m) => m.user_id === userId);

test('Özel durum: kaydedilir, üye listesi/arkadaş/profilde görünür, görünmezken gizlenir, temizlenir', async () => {
  const kur = await login('durkurucu');
  const set = await kur.patch('/api/profile/custom-status', { emoji: '🎮', text: 'Maçtayım, sonra yazarım', minutes: 60 });
  assert.equal(set.status, 200, set.text);
  assert.equal(set.body.custom_status.text, 'Maçtayım, sonra yazarım');
  assert.ok(set.body.custom_status.until, 'bitiş zamanı var');

  assert.equal((await kur.get('/api/me')).body.user.custom_status.emoji, '🎮');
  assert.equal((await memberOf('duruye', S.kur)).custom_status.text, 'Maçtayım, sonra yazarım', 'lobi üye listesinde');
  const fr = (await (await login('durark')).get('/api/friends')).body;
  const friends = fr.friends || fr;
  assert.equal(friends.find((f) => f.id === S.kur).custom_status.emoji, '🎮', 'arkadaş listesinde');
  assert.equal((await (await login('duruye')).get(`/api/users/${S.kur}/profile`)).body.profile.custom_status.text, 'Maçtayım, sonra yazarım');

  // Görünmez: başkaları görmez, kendisi görür
  assert.equal((await kur.patch('/api/profile/status', { status: 'invisible' })).status, 200);
  assert.equal((await memberOf('duruye', S.kur)).custom_status, null, 'görünmezken gizli');
  assert.ok((await memberOf('durkurucu', S.kur)).custom_status, 'kendisi görür');
  await kur.patch('/api/profile/status', { status: 'active' });

  // Geçersiz girişler
  assert.equal((await kur.patch('/api/profile/custom-status', { text: 'bak https://x.com' })).status, 400, 'bağlantı');
  assert.equal((await kur.patch('/api/profile/custom-status', { text: 'a'.repeat(61) })).status, 400, 'çok uzun');
  assert.equal((await kur.patch('/api/profile/custom-status', { emoji: 'abc', text: 'x' })).status, 400, 'emoji alanına harf');
  assert.equal((await kur.patch('/api/profile/custom-status', { text: 'x', minutes: 99999 })).status, 400, 'süre sınırı');

  // Süresiz
  const forever = await kur.patch('/api/profile/custom-status', { text: 'Tatildeyim' });
  assert.equal(forever.body.custom_status.until, null);

  // Temizle
  assert.equal((await kur.patch('/api/profile/custom-status', { emoji: '', text: '' })).status, 200);
  assert.equal((await kur.get('/api/me')).body.user.custom_status, null);
  assert.equal((await memberOf('duruye', S.kur)).custom_status, null);
});

test('Düzenleme geçmişi: yazar ve kurucu/moderatör görür, üye göremez; silinince gider', async () => {
  const id = await say('duruye', 'ilk hali');
  const uye = await login('duruye');
  assert.equal((await uye.patch(`/api/messages/${id}`, { content: 'ikinci hali' })).status, 200);
  assert.equal((await uye.patch(`/api/messages/${id}`, { content: 'son hali' })).status, 200);
  assert.equal((await uye.patch(`/api/messages/${id}`, { content: 'son hali' })).status, 200, 'aynı metin: geçmişe eklenmez');

  const mine = await uye.get(`/api/messages/${id}/edits`);
  assert.equal(mine.status, 200, mine.text);
  assert.deepEqual(mine.body.versions.map((v) => v.content), ['ilk hali', 'ikinci hali', 'son hali']);
  assert.ok(mine.body.versions[0].at, 'ilk sürümün zamanı = gönderim');
  assert.equal(mine.body.versions[2].current, true);

  assert.equal((await (await login('durkurucu')).get(`/api/messages/${id}/edits`)).status, 200, 'kurucu görür');
  assert.equal((await (await login('durmod')).get(`/api/messages/${id}/edits`)).status, 200, 'moderatör görür');

  const modMsg = await say('durmod', 'mod yazdi');
  await (await login('durmod')).patch(`/api/messages/${modMsg}`, { content: 'mod duzeltti' });
  assert.equal((await uye.get(`/api/messages/${modMsg}/edits`)).status, 403, 'normal üye başkasının geçmişini göremez');
  assert.equal((await (await login('durark')).get(`/api/messages/${id}/edits`)).status, 403, 'üye olmayan göremez');

  assert.equal((await uye.del(`/api/messages/${id}`)).status, 200);
  assert.equal((await (await login('durkurucu')).get(`/api/messages/${id}/edits`)).status, 404, 'silinen mesajın geçmişi yok');
});

test('Düzenleme geçmişi 20 sürümle sınırlı ve budanınca "ilk hâl" sayılmaz', async () => {
  const id = await say('durkurucu', 'surum 0');
  const kur = await login('durkurucu');
  for (let i = 1; i <= 22; i++) assert.equal((await kur.patch(`/api/messages/${id}`, { content: `surum ${i}` })).status, 200);
  const h = (await kur.get(`/api/messages/${id}/edits`)).body;
  assert.equal(h.versions.length, 21, '20 eski + şimdiki');
  assert.equal(h.truncated, true);
  assert.equal(h.versions[0].content, 'surum 2', 'en eski ikisi budandı');
  assert.equal(h.versions[0].at, null, 'budanmış ilk sürümün başlangıcı bilinmez');
  assert.equal(h.versions[20].content, 'surum 22');
});

test('Özel mesaj düzenlemeleri geçmişe yazılmaz', async () => {
  const kur = await login('durkurucu');
  const s = socket(srv.base, kur.cookie);
  await s.ready;
  const got = s.waitFor('dm_message', (m) => m.content === 'dm ilk');
  s.emit('dm_message', { to_user_id: S.ark, content: 'dm ilk' });
  const m = await got;
  s.close();
  assert.equal((await kur.patch(`/api/messages/${m.id}`, { content: 'dm son' })).status, 200);
  assert.equal((await kur.get(`/api/messages/${m.id}/edits`)).status, 403);
});
