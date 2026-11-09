'use strict';
// Lobi metin kanalları: varsayılan "chat" kanalı ve eski mesajların taşınması, yetki (kurucu + moderatör), mesajların
// kanala göre ayrılması, kanal bazında okunmamış, seviyeye göre sınır, kanal silme (mesajlarıyla) ve son kanalın korunması.
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, client, makeUser, socket } = require('./helpers');

let srv, S;
const http = {};
const sock = {};

test.before(async () => {
  srv = await startServer((dbm) => {
    const owner = makeUser(dbm, 'kurucu');
    const mod = makeUser(dbm, 'moder');
    const member = makeUser(dbm, 'uye');
    const h = dbm.createHub(owner.id, { name: 'Kanal Lobi', type: 'hub' });
    const hubId = h.id || (h.hub && h.hub.id);
    for (const u of [mod, member]) {
      const inv = dbm.createHubInvite(hubId, owner.id, {});
      dbm.joinHubByCode(inv.code || (inv.invite && inv.invite.code), u.id);
    }
    dbm.db.prepare(`UPDATE hub_members SET permission_tier = 'moderator' WHERE hub_id = ? AND user_id = ?`).run(hubId, mod.id);
    // Kanallar gelmeden önce yazılmış eski mesaj (channel_id yok): açılışta "chat" kanalına taşınmalı.
    dbm.db.prepare(`DELETE FROM hub_channels WHERE hub_id = ?`).run(hubId);
    dbm.db.prepare(`INSERT INTO messages (user_id, username, content, room, hub_id, kind) VALUES (?, ?, ?, ?, ?, 'text')`)
      .run(owner.id, owner.username, 'ESKI_MESAJ', `hub_${hubId}`, hubId);
    // Kanalı zaten olan ikinci lobi + kanalsız kalmış mesaj (ör. dağıtım sırasında eski süreç yazdı): açılışta ilk kanala geçmeli.
    const h2 = dbm.createHub(owner.id, { name: 'İkinci Lobi', type: 'hub' });
    const hub2 = h2.id || (h2.hub && h2.hub.id);
    dbm.db.prepare(`INSERT INTO hub_channels (hub_id, name, position) VALUES (?, 'chat', 0)`).run(hub2);
    dbm.db.prepare(`INSERT INTO messages (user_id, username, content, room, hub_id, kind) VALUES (?, ?, ?, ?, ?, 'text')`)
      .run(owner.id, owner.username, 'KANALSIZ_KALAN', `hub_${hub2}`, hub2);
    return { owner, mod, member, hubId, hub2 };
  });
  S = srv.seeded;
  for (const [name, u] of [['owner', S.owner], ['mod', S.mod], ['member', S.member]]) {
    http[name] = client(srv.base);
    assert.equal((await http[name].login(u.username, 'Passw0rd!x')).status, 200);
    sock[name] = socket(srv.base, http[name].cookie);
    await sock[name].ready;
    sock[name].emit('join_hub', S.hubId);
  }
  await new Promise((r) => setTimeout(r, 200));
});

test.after(async () => {
  for (const s of Object.values(sock)) s.close();
  if (srv) await srv.stop();
});

let chatId, newsId;

test('Varsayılan "chat" kanalı açılır ve eski mesajlar ona taşınır', async () => {
  const hub = await http.member.get(`/api/hubs/${S.hubId}`);
  assert.equal(hub.status, 200, hub.text);
  const channels = hub.body.hub.channels;
  assert.equal(channels.length, 1);
  assert.equal(channels[0].name, 'chat');
  chatId = channels[0].id;
  const page = await http.member.get(`/api/hubs/${S.hubId}/messages?channel_id=${chatId}`);
  assert.ok(page.body.messages.some((m) => m.content === 'ESKI_MESAJ' && m.channel_id === chatId));
  assert.equal(hub.body.hub.channel_limit, 5, 'seviye 1 lobide 5 kanal');
});

test('Yalnızca kurucu ve moderatör kanal açar; aynı ad iki kez kullanılamaz', async () => {
  assert.equal((await http.member.post(`/api/hubs/${S.hubId}/channels`, { name: 'üye kanalı' })).status, 403);
  const changed = sock.member.waitFor('hub_channels_changed', (d) => d.hub_id === S.hubId && d.created);
  const created = await http.mod.post(`/api/hubs/${S.hubId}/channels`, { name: '  Duyurular  ' });
  assert.equal(created.status, 200, created.text);
  assert.equal(created.body.channel.name, 'Duyurular');
  newsId = created.body.channel.id;
  assert.equal((await changed).channels.length, 2);
  assert.equal((await http.owner.post(`/api/hubs/${S.hubId}/channels`, { name: 'duyurular' })).status, 409);
  assert.equal((await http.owner.post(`/api/hubs/${S.hubId}/channels`, { name: '   ' })).status, 400);
});

test('Kanalı olan lobide kanalsız kalmış mesaj açılışta ilk kanala geçer', async () => {
  const page = await http.owner.get(`/api/hubs/${S.hub2}/messages`);
  assert.ok(page.body.messages.some((m) => m.content === 'KANALSIZ_KALAN'), page.text);
});

test('Aynı ad Türkçe büyük/küçük harf farkıyla da kullanılamaz; görünmez karakterler atılır', async () => {
  const a = await http.owner.post(`/api/hubs/${S.hubId}/channels`, { name: 'İnfo' });
  assert.equal(a.status, 200, a.text);
  assert.equal((await http.owner.post(`/api/hubs/${S.hubId}/channels`, { name: 'info' })).status, 409);
  assert.equal((await http.owner.post(`/api/hubs/${S.hubId}/channels`, { name: 'in​fo' })).status, 409);
  await http.owner.del(`/api/hubs/${S.hubId}/channels/${a.body.channel.id}`);
});

test('Bahsedilme bildirimi kanal bilgisini taşır', async () => {
  const got = sock.member.waitFor('hub_mention', (d) => d.hub_id === S.hubId);
  sock.owner.emit('hub_chat_message', { hub_id: S.hubId, channel_id: newsId, content: '@uye bakar mısın BAHSET_1' });
  assert.equal((await got).channel_id, newsId);
});

test('Kanal adı değiştirilebilir (üye değiştiremez)', async () => {
  assert.equal((await http.member.patch(`/api/hubs/${S.hubId}/channels/${chatId}`, { name: 'genel' })).status, 403);
  const r = await http.owner.patch(`/api/hubs/${S.hubId}/channels/${chatId}`, { name: 'sohbet' });
  assert.equal(r.status, 200, r.text);
  assert.equal(r.body.channel.name, 'sohbet');
  await http.owner.patch(`/api/hubs/${S.hubId}/channels/${chatId}`, { name: 'chat' });
});

test('Mesajlar kanala göre ayrılır (soket ve REST)', async () => {
  const got = sock.owner.waitFor('hub_message', (m) => m.content === 'KANAL_B_1');
  sock.member.emit('hub_chat_message', { hub_id: S.hubId, channel_id: newsId, content: 'KANAL_B_1' });
  assert.equal((await got).channel_id, newsId);
  const inNews = await http.owner.get(`/api/hubs/${S.hubId}/messages?channel_id=${newsId}`);
  const inChat = await http.owner.get(`/api/hubs/${S.hubId}/messages?channel_id=${chatId}`);
  assert.ok(inNews.body.messages.some((m) => m.content === 'KANAL_B_1'));
  assert.ok(!inChat.body.messages.some((m) => m.content === 'KANAL_B_1'));
  const noChannel = await http.owner.get(`/api/hubs/${S.hubId}/messages`);
  assert.equal(noChannel.body.channel_id, chatId, 'kanal verilmezse ilk kanal');
  const poll = await http.mod.post(`/api/hubs/${S.hubId}/poll`, { question: 'Hangi gün?', options: ['Cuma', 'Cumartesi'], channel_id: newsId });
  assert.equal(poll.status, 200, poll.text);
  assert.equal(poll.body.message.channel_id, newsId);
  assert.equal((await http.owner.get(`/api/hubs/${S.hubId}/messages?channel_id=999999`)).status, 404);
});

test('Okunmamış sayısı kanal bazında; kanal okundu işaretlenince düşer', async () => {
  const before = await http.owner.get('/api/unread');
  const hubUnread = before.body.hubs[S.hubId];
  assert.ok(hubUnread && hubUnread.channels && hubUnread.channels[newsId].count >= 2, JSON.stringify(before.body));
  const mark = await http.owner.post('/api/read-state', { type: 'channel', id: newsId });
  assert.equal(mark.status, 200, mark.text);
  const after = await http.owner.get('/api/unread');
  const h = after.body.hubs[S.hubId];
  assert.ok(!h || !h.channels[newsId], JSON.stringify(after.body));
  assert.equal((await http.owner.post('/api/read-state', { type: 'channel', id: 999999 })).status, 403);
});

test('Kanal sınırı lobi seviyesine göre (seviye 1: 5)', async () => {
  for (const n of ['k3', 'k4', 'k5']) assert.equal((await http.owner.post(`/api/hubs/${S.hubId}/channels`, { name: n })).status, 200);
  const over = await http.owner.post(`/api/hubs/${S.hubId}/channels`, { name: 'k6' });
  assert.equal(over.status, 400);
  assert.match(over.body.error, /en fazla 5/);
});

test('Kanal silinince mesajları da silinir; silinen kanala mesaj gitmez; son kanal silinemez', async () => {
  assert.equal((await http.member.del(`/api/hubs/${S.hubId}/channels/${newsId}`)).status, 403);
  const stats = await http.owner.get(`/api/hubs/${S.hubId}/channels/${newsId}/stats`);
  assert.ok(stats.body.messages >= 2);
  const del = await http.owner.del(`/api/hubs/${S.hubId}/channels/${newsId}`);
  assert.equal(del.status, 200, del.text);
  assert.ok(del.body.deleted_messages >= 2);
  const err = sock.member.waitFor('message_error', (e) => /kanal/i.test(String(Array.isArray(e) ? e[0] : e)));
  sock.member.emit('hub_chat_message', { hub_id: S.hubId, channel_id: newsId, content: 'SILINMIS_KANAL', client_id: 'x1' });
  await err;
  const list = (await http.owner.get(`/api/hubs/${S.hubId}/channels`)).body.channels;
  for (const ch of list.slice(1)) assert.equal((await http.owner.del(`/api/hubs/${S.hubId}/channels/${ch.id}`)).status, 200);
  const last = await http.owner.del(`/api/hubs/${S.hubId}/channels/${list[0].id}`);
  assert.equal(last.status, 400);
  assert.match(last.body.error, /en az bir/);
});
