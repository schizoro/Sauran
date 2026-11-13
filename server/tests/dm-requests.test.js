'use strict';
// Mesaj istekleri: aynı lobideki arkadaş olmayan kişi en fazla 3 yazılı mesajla istek gönderir; alıcı kabul edene
// kadar bildirim yok; kabul → normal sohbet; ret → gönderen yeni mesaj atamaz. Ayar kapalıysa / lobi ortak değilse yok.
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, client, makeUser, socket } = require('./helpers');

let srv, S;
test.before(async () => {
  srv = await startServer((dbm) => {
    const ali = makeUser(dbm, 'ali');
    const veli = makeUser(dbm, 'veli');   // aynı lobide, istek gönderir → kabul
    const can = makeUser(dbm, 'can');     // aynı lobide, istek gönderir → ret
    const yab = makeUser(dbm, 'yabanci'); // ortak lobi yok
    const kapali = makeUser(dbm, 'kapali'); // aynı lobide ama "lobi üyelerinden mesaj" kapalı
    const genc = makeUser(dbm, 'genc', { birth: '2012-03-03' }); // 18 yaş altı: varsayılan kapalı
    const ayr = makeUser(dbm, 'ayrilan');   // kabul edildikten sonra lobiden ayrılır
    const spam = makeUser(dbm, 'spamci');   // günlük istek sınırı
    const eski = makeUser(dbm, 'eskiyas');  // yaşı bilinmeyen eski hesap
    const h = dbm.createHub(ali.id, { name: 'DM Lobisi', type: 'hub' });
    const hubId = h.id || (h.hub && h.hub.id);
    const inv = dbm.createHubInvite(hubId, ali.id, {});
    const code = inv.code || (inv.invite && inv.invite.code);
    for (const u of [veli, can, kapali, genc, ayr, spam, eski]) dbm.joinHubByCode(code, u.id);
    dbm.db.prepare(`UPDATE users SET age_declared = 0 WHERE id = ?`).run(eski.id);
    const others = [];
    for (let i = 0; i < 11; i++) { const o = makeUser(dbm, `uye${i}`); dbm.joinHubByCode(code, o.id); others.push(o.id); }
    dbm.db.prepare(`UPDATE users SET dm_from_hub = 0 WHERE id = ?`).run(kapali.id);
    return { hubId, ali: ali.id, veli: veli.id, can: can.id, yab: yab.id, kapali: kapali.id, genc: genc.id, ayr: ayr.id, spam: spam.id, eski: eski.id, others };
  });
  S = srv.seeded;
});
test.after(async () => { if (srv) await srv.stop(); });

async function sess(name) {
  const c = client(srv.base);
  assert.equal((await c.login(name, 'Passw0rd!x')).status, 200);
  const s = socket(srv.base, c.cookie);
  await s.ready;
  s.http = c;
  return s;
}
const send = (s, to, content) => s.emit('dm_message', { to_user_id: to, content });

test('İstek: 3 mesaja kadar gider, alıcıda istek olarak görünür, bildirim üretmez; kabul edilince normal sohbet', async () => {
  const ali = await sess('ali');
  const veli = await sess('veli');
  const before = (await ali.http.get('/api/notifications')).body.notifications.length;

  const got = ali.waitFor('dm_message', (m) => m.user_id === S.veli);
  send(veli, S.ali, 'Merhaba, lobide gördüm');
  const m = await got;
  assert.equal(m.is_request, true);
  send(veli, S.ali, 'ikinci'); send(veli, S.ali, 'üçüncü');
  const err = veli.waitFor('message_error', () => true);
  await new Promise((r) => setTimeout(r, 150));
  send(veli, S.ali, 'dördüncü');
  assert.match(String(await err), /en fazla 3/);

  const reqs = (await ali.http.get('/api/dm/requests')).body.requests;
  assert.equal(reqs.length, 1);
  assert.equal(reqs[0].username, 'veli');
  assert.equal(reqs[0].count, 3);
  assert.equal((await ali.http.get('/api/notifications')).body.notifications.length, before, 'bildirim yok');

  const view = await ali.http.get(`/api/dm/${S.veli}/messages`);
  assert.equal(view.body.dm_state, 'request_in');
  assert.equal(view.body.messages.length, 3);
  const aliErr = ali.waitFor('message_error', () => true);
  send(ali, S.veli, 'cevap');
  assert.match(String(await aliErr), /kabul et/, 'kabul etmeden cevap yazılamaz');

  const acc = veli.waitFor('dm_request_accepted', (d) => d.user_id === S.ali);
  assert.equal((await ali.http.post(`/api/dm/requests/${S.veli}/accept`)).status, 200);
  await acc;
  assert.equal((await ali.http.get('/api/dm/requests')).body.requests.length, 0);
  const conv = (await ali.http.get('/api/dm/conversations')).body.conversations.find((c) => c.id === S.veli);
  assert.ok(conv && conv.not_friend, 'kabul edilen sohbet listede, arkadaş değil olarak');
  const ok = veli.waitFor('dm_message', (x) => x.user_id === S.ali && x.content === 'hoş geldin');
  send(ali, S.veli, 'hoş geldin');
  const reply = await ok;
  assert.ok(!reply.is_request);
  [ali, veli].forEach((s) => s.close());
});

test('Ret: gönderen artık mesaj atamaz; ortak lobi yoksa, ayar kapalıysa ya da 18 yaş altıysa istek gönderilemez', async () => {
  const ali = await sess('ali');
  const can = await sess('can');
  const g = ali.waitFor('dm_message', (m) => m.user_id === S.can);
  send(can, S.ali, 'selam');
  await g;
  assert.equal((await ali.http.post(`/api/dm/requests/${S.can}/decline`)).status, 200);
  const e1 = can.waitFor('message_error', () => true);
  send(can, S.ali, 'tekrar');
  assert.match(String(await e1), /gönderemezsin/);

  for (const [name, target] of [['yabanci', S.ali], ['ali', S.kapali], ['ali', S.genc]]) {
    const s = name === 'ali' ? ali : await sess(name);
    const e = s.waitFor('message_error', () => true);
    send(s, target, 'deneme');
    assert.match(String(await e), /gönderemezsin/, `${name} → ${target}`);
    if (s !== ali) s.close();
  }
  const prof = (await can.http.get(`/api/users/${S.genc}/profile`)).body;
  assert.equal((prof.profile || prof).dm_state, null, 'profil mesaj düğmesi göstermez');
  [ali, can].forEach((s) => s.close());
});

test('İstek sırasında fotoğraf/ses/çıkartma gibi tam erişim gerektiren işlemler kapalı', async () => {
  const ali = await sess('ali');
  const res = await ali.http.get(`/api/dm/${S.kapali}/messages`);
  assert.equal(res.status, 403, 'ilişkisi olmayan sohbet açılamaz');
  ali.close();
});

test('18 yaş altı da arkadaş olmayana istek GÖNDEREMEZ ve ayarı açamaz', async () => {
  const genc = await sess('genc');
  const e = genc.waitFor('message_error', () => true);
  send(genc, S.ali, 'merhaba');
  assert.match(String(await e), /gönderemezsin/);
  assert.equal((await genc.http.patch('/api/privacy', { lobby_dms: true })).status, 400);
  genc.close();
});

test('İstek alıcısı kabul etmeden tepki ekleyemez (görüldü sinyali olmasın)', async () => {
  const ali = await sess('ali');
  const ayr = await sess('ayrilan');
  const got = ali.waitFor('dm_message', (m) => m.user_id === S.ayr);
  send(ayr, S.ali, 'selam');
  const m = await got;
  const r = await ali.http.post(`/api/messages/${m.id}/reactions`, { emoji: '👍' });
  assert.notEqual(r.status, 200, 'request_in iken tepki yok');
  // Kabul → sonra gönderen lobiden ayrılırsa sohbet kapanır
  assert.equal((await ali.http.post(`/api/dm/requests/${S.ayr}/accept`)).status, 200);
  assert.equal((await ayr.http.get(`/api/dm/${S.ali}/messages`)).body.dm_state, 'accepted');
  assert.equal((await ayr.http.post(`/api/hubs/${S.hubId}/leave`)).status, 200);
  assert.equal((await ayr.http.get(`/api/dm/${S.ali}/messages`)).status, 403, 'ortak lobi kalmayınca kapanır');
  [ali, ayr].forEach((x) => x.close());
});

test('Gönderen başına günde en fazla 10 yeni kişiye istek', async () => {
  const sp = await sess('spamci');
  for (let i = 0; i < 10; i++) send(sp, S.others[i], 'reklam');
  await new Promise((r) => setTimeout(r, 400));
  const e = sp.waitFor('message_error', () => true);
  send(sp, S.others[10], 'reklam');
  assert.match(String(await e), /çok fazla kişiye/);
  sp.close();
});

test('Yaşı bilinmeyen eski hesap cevaplayana kadar mesaj isteği alamaz ve gönderemez', async () => {
  const ali = await sess('ali');
  const eski = await sess('eskiyas');
  const e1 = ali.waitFor('message_error', () => true);
  send(ali, S.eski, 'merhaba');
  assert.match(String(await e1), /gönderemezsin/);
  const e2 = eski.waitFor('message_error', () => true);
  send(eski, S.ali, 'merhaba');
  assert.match(String(await e2), /gönderemezsin/);
  assert.equal((await eski.http.post('/api/profile/age', { birth_date: '1990-01-01' })).status, 200);
  const got = ali.waitFor('dm_message', (m) => m.user_id === S.eski);
  send(eski, S.ali, 'şimdi oldu');
  assert.equal((await got).is_request, true, 'yaş beyanından sonra normal kurallar');
  [ali, eski].forEach((x) => x.close());
});
