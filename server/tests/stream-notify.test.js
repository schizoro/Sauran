'use strict';
// "Arkadaşın yayın başlattığında" bildirimi: yalnızca aynı Lobideki arkadaşlara gider; lobide olmayan arkadaşa
// (hangi lobide olunduğu sızmasın) ve tercihi kapatana gitmez; odada zaten olana gitmez; 10 dakikada bir kez gider.
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, client, makeUser, socket } = require('./helpers');

let srv, S;
test.before(async () => {
  srv = await startServer((dbm) => {
    const ali = makeUser(dbm, 'ali');   // yayın açan
    const ece = makeUser(dbm, 'ece');   // aynı lobide arkadaş → bildirim alır
    const can = makeUser(dbm, 'can');   // arkadaş ama lobide değil → almaz
    const ela = makeUser(dbm, 'ela');   // aynı lobide arkadaş, tercihi kapalı → almaz
    const veli = makeUser(dbm, 'veli'); // aynı lobide ama arkadaş değil → almaz
    const zeki = makeUser(dbm, 'zeki'); // görünmezken yayın açar
    const nur = makeUser(dbm, 'nur');   // ece ile aynı odadayken yayın açar
    const oya = makeUser(dbm, 'oya');   // "tüm arkadaşlarım" kapsamıyla yayın açar
    const tan = makeUser(dbm, 'tan');   // "haber verme" seçerek yayın açar
    for (const u of [ece, can, ela]) { dbm.sendFriendRequest(u.id, ali.id); dbm.respondFriendRequest(ali.id, u.id, true); }
    for (const u of [zeki, nur, oya, tan]) { dbm.sendFriendRequest(u.id, ece.id); dbm.respondFriendRequest(ece.id, u.id, true); }
    for (const u of [oya, tan]) { dbm.sendFriendRequest(u.id, can.id); dbm.respondFriendRequest(can.id, u.id, true); }
    const h = dbm.createHub(ali.id, { name: 'Yayın Lobisi', type: 'hub' });
    const hubId = h.id || (h.hub && h.hub.id);
    const inv = dbm.createHubInvite(hubId, ali.id, {});
    const code = inv.code || (inv.invite && inv.invite.code);
    for (const u of [ece, ela, veli, zeki, nur, oya, tan]) dbm.joinHubByCode(code, u.id);
    dbm.updateNotificationPreferences(ela.id, { notify_friend_stream: 0 });
    const room = dbm.createVoiceRoom(hubId, ali.id, 'Oyun Odası');
    const roomId = room.id || (room.room && room.room.id);
    return { hubId, roomId };
  });
  S = srv.seeded;
});
test.after(async () => { if (srv) await srv.stop(); });

async function sock(name) {
  const c = client(srv.base);
  assert.equal((await c.login(name, 'Passw0rd!x')).status, 200);
  const s = socket(srv.base, c.cookie);
  await s.ready;
  s.http = c;
  return s;
}
async function joinRoom(s) {
  const joined = s.waitFor('voice_room_participants_updated', (d) => d && d.room_id === S.roomId);
  s.emit('voice_room_join', { room_id: S.roomId, hub_id: S.hubId });
  await joined;
}
const isStream = (d) => d && d.type === 'stream_started';

test('Yayın başlayınca yalnızca aynı lobideki, tercihi açık arkadaşa bildirim gider; tekrar aç-kapa spam yapmaz', async () => {
  const ali = await sock('ali');
  const ece = await sock('ece');
  const can = await sock('can');
  const ela = await sock('ela');
  const veli = await sock('veli');

  const joined = ali.waitFor('voice_room_participants_updated', (d) => d && d.room_id === S.roomId);
  ali.emit('voice_room_join', { room_id: S.roomId, hub_id: S.hubId });
  await joined;

  const got = ece.waitFor('notification_received', isStream);
  ali.emit('voice_room_share', { sharing: true });
  const n = await got;
  assert.equal(n.data.from_username, 'ali');
  assert.equal(n.data.hub_name, 'Yayın Lobisi');
  assert.equal(n.data.room_name, 'Oyun Odası');
  assert.equal(n.data.hub_id, S.hubId);
  assert.equal(n.data.room_id, S.roomId);

  assert.ok(await can.expectNone('notification_received', isStream), 'lobide olmayan arkadaş almaz');
  assert.ok(await ela.expectNone('notification_received', isStream, 50), 'tercihi kapalı olan almaz');
  assert.ok(await veli.expectNone('notification_received', isStream, 50), 'arkadaş olmayan almaz');

  // Kapat-aç: bekleme süresi dolmadan ikinci bildirim yok.
  const second = ece.waitFor('notification_received', isStream, 700);
  ali.emit('voice_room_share', { sharing: false });
  ali.emit('voice_room_share', { sharing: true });
  await assert.rejects(second, /gelmedi/, '10 dakika dolmadan ikinci bildirim gitmez');

  [ali, ece, can, ela, veli].forEach((s) => s.close());
});

test('Odaya katılmamış soketin yayın olayı yok sayılır', async () => {
  const veli = await sock('veli');
  const ece = await sock('ece');
  veli.emit('voice_room_share', { sharing: true });
  assert.ok(await ece.expectNone('notification_received', (d) => isStream(d) && d.data.from_username === 'veli'));
  [veli, ece].forEach((s) => s.close());
});

test('Görünmez kişi yayın açınca bildirim gitmez ve bekleme süresi harcanmaz', async () => {
  const zeki = await sock('zeki');
  const ece = await sock('ece');
  assert.equal((await zeki.http.patch('/api/profile/status', { status: 'invisible' })).status, 200);
  await joinRoom(zeki);
  zeki.emit('voice_room_share', { sharing: true });
  assert.ok(await ece.expectNone('notification_received', (d) => isStream(d) && d.data.from_username === 'zeki'), 'görünmezken bildirim yok');
  zeki.emit('voice_room_share', { sharing: false });
  assert.equal((await zeki.http.patch('/api/profile/status', { status: 'active' })).status, 200);
  const got = ece.waitFor('notification_received', (d) => isStream(d) && d.data.from_username === 'zeki');
  zeki.emit('voice_room_share', { sharing: true });
  await got; // görünür olunca bildirim gider (bekleme süresi görünmezken başlamamıştı)
  [zeki, ece].forEach((s) => s.close());
});

test('Zaten aynı odada olan arkadaşa bildirim gitmez', async () => {
  const nur = await sock('nur');
  const ece = await sock('ece');
  await joinRoom(ece);
  await joinRoom(nur);
  nur.emit('voice_room_share', { sharing: true });
  assert.ok(await ece.expectNone('notification_received', (d) => isStream(d) && d.data.from_username === 'nur'));
  // Bağlantı kopunca tolerans süresi boyunca odada sayılır; sonraki testler için açıkça ayrıl.
  [nur, ece].forEach((s) => s.emit('voice_room_leave'));
  await new Promise((r) => setTimeout(r, 150));
  [nur, ece].forEach((s) => s.close());
});

test('"Tüm arkadaşlarım": lobide olmayan arkadaş lobi adı OLMADAN bildirim alır; lobidekiler tam bilgi alır; herkes CANLI rozetini görür', async () => {
  const oya = await sock('oya');
  const ece = await sock('ece');
  const can = await sock('can');
  const veli = await sock('veli'); // lobi üyesi, arkadaş değil: bildirim yok ama CANLI rozeti var
  veli.emit('join_hub', S.hubId); await new Promise((r) => setTimeout(r, 200));
  await joinRoom(oya);
  const live = veli.waitFor('voice_room_participants_updated', (d) => d && d.room_id === S.roomId && d.participants.some((p) => p.username === 'oya' && p.sharing));
  const full = ece.waitFor('notification_received', (d) => isStream(d) && d.data.from_username === 'oya');
  const bare = can.waitFor('notification_received', (d) => isStream(d) && d.data.from_username === 'oya');
  oya.emit('voice_room_share', { sharing: true, notify: true, scope: 'all' });
  const f = await full; const b = await bare;
  assert.equal(f.data.hub_name, 'Yayın Lobisi');
  assert.equal(b.data.hub_name, undefined, 'lobide olmayan arkadaşa lobi adı gitmez');
  assert.equal(b.data.room_name, undefined);
  assert.equal(b.data.hub_id, undefined);
  await live;
  assert.ok(await veli.expectNone('notification_received', (d) => isStream(d) && d.data.from_username === 'oya', 100), 'arkadaş olmayana bildirim yok');
  [oya, ece, can, veli].forEach((s) => s.close());
});

test('"Arkadaşlarıma haber ver" kapalıysa kimseye bildirim gitmez', async () => {
  const tan = await sock('tan');
  const ece = await sock('ece');
  const can = await sock('can');
  await joinRoom(tan);
  tan.emit('voice_room_share', { sharing: true, notify: false, scope: 'all' });
  assert.ok(await ece.expectNone('notification_received', (d) => isStream(d) && d.data.from_username === 'tan'));
  assert.ok(await can.expectNone('notification_received', (d) => isStream(d) && d.data.from_username === 'tan', 50));
  [tan, ece, can].forEach((s) => s.close());
});
