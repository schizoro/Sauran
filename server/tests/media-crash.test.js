'use strict';
// Medya artık mesajın içinde taşınmaz: listeler/yayınlar yalnızca adres (url) içerir; dosya /api/messages/:id/media'dan
// erişim kontrolü ve aralık (Range) desteğiyle gelir. Tehlikeli türler (HTML vb.) sayfada açılmaz, indirme olarak verilir.
// Ayrıca: sunucu sağlığı (yönetici) olay kaydı ve beklenmedik yeniden başlatma tespiti.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { startServer, client, makeUser } = require('./helpers');

let srv, S;
const PNG = Buffer.from('89504e470d0a1a0a0000000d4948445200000001000000010806000000', 'hex');
const BIG = Buffer.alloc(4000, 7); // aralık testleri için
const OLD_IMG = Buffer.alloc(5000, 9);
const OLD_VOICE = Buffer.alloc(3 * 1024 * 1024 + 5, 4); // 3 MB parça sınırını aşan

test.before(async () => {
  srv = await startServer((dbm) => {
    const ali = makeUser(dbm, 'medali');
    const ece = makeUser(dbm, 'medece');
    const yab = makeUser(dbm, 'medyab');
    const adm = makeUser(dbm, 'medadm', { role: 'admin' });
    dbm.sendFriendRequest(ece.id, ali.id); dbm.respondFriendRequest(ali.id, ece.id, true);
    const h = dbm.createHub(ali.id, { name: 'Medya Lobi', type: 'hub' });
    const hubId = h.id || (h.hub && h.hub.id);
    const inv = dbm.createHubInvite(hubId, ali.id, {});
    dbm.joinHubByCode(inv.code || (inv.invite && inv.invite.code), ece.id);
    // Önceki çalışma düzgün kapanmamış gibi: açılışta "beklenmedik yeniden başlama" kaydı oluşmalı.
    dbm.serverHeartbeatStart(123);
    // Taşıma testi için eski biçim (veritabanında gömülü) medya: lobi görseli + DM sesli mesajı
    const ch = dbm.db.prepare(`SELECT id FROM hub_channels WHERE hub_id = ? ORDER BY id LIMIT 1`).get(hubId);
    const oldImg = dbm.db.prepare(`INSERT INTO messages (user_id, username, content, room, hub_id, channel_id, kind, payload) VALUES (?, 'medali', '', ?, ?, ?, 'image', ?)`)
      .run(ali.id, `hub_${hubId}`, hubId, ch ? ch.id : null, JSON.stringify({ data: `data:image/png;base64,${OLD_IMG.toString('base64')}`, name: 'eski.png', mime: 'image/png', size: OLD_IMG.length })).lastInsertRowid;
    const room = ali.id < ece.id ? `dm_${ali.id}_${ece.id}` : `dm_${ece.id}_${ali.id}`;
    const oldVoice = dbm.db.prepare(`INSERT INTO messages (user_id, username, content, room, to_user_id, kind, payload) VALUES (?, 'medali', '', ?, ?, 'dm_voice', ?)`)
      .run(ali.id, room, ece.id, JSON.stringify({ audio: `data:audio/webm;base64,${OLD_VOICE.toString('base64')}`, duration: 2 })).lastInsertRowid;
    return { hubId, ali: ali.id, ece: ece.id, yab: yab.id, adm: adm.id, oldImg: Number(oldImg), oldVoice: Number(oldVoice) };
  });
  S = srv.seeded;
});
test.after(async () => { if (srv) await srv.stop(); });

async function login(name) {
  const c = client(srv.base);
  assert.equal((await c.login(name, 'Passw0rd!x')).status, 200);
  return c;
}
const raw = (c, url, headers = {}) => fetch(srv.base + url, { headers: { Cookie: c.cookie, ...headers } });
const dataUrl = (mime, buf) => `data:${mime};base64,${buf.toString('base64')}`;

test('Lobi görseli: listede veri yok, adresten erişim kontrolüyle gelir', async () => {
  const ali = await login('medali');
  const up = await ali.post(`/api/hubs/${S.hubId}/file`, { file: { data: dataUrl('image/png', PNG), name: 'nokta.png', mime: 'image/png', size: PNG.length } });
  assert.equal(up.status, 200, up.text);
  const list = (await ali.get(`/api/hubs/${S.hubId}/messages`)).body.messages;
  const m = list.find((x) => x.kind === 'image' && x.payload && x.payload.name === 'nokta.png');
  assert.ok(m, 'görsel mesajı listede');
  assert.equal(m.payload.data, undefined, 'veri listede taşınmaz');
  assert.equal(m.payload.url, `/api/messages/${m.id}/media`);
  assert.equal(m.payload.name, 'nokta.png');
  assert.ok(!JSON.stringify(list).includes(PNG.toString('base64')), 'yanıtın hiçbir yerinde base64 yok');

  const r = await raw(ali, m.payload.url);
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('content-type'), 'image/png');
  assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
  assert.deepEqual(Buffer.from(await r.arrayBuffer()), PNG);

  const ece = await login('medece');
  assert.equal((await raw(ece, m.payload.url)).status, 200, 'lobi üyesi alır');
  const yab = await login('medyab');
  assert.equal((await raw(yab, m.payload.url)).status, 403, 'üye olmayan alamaz');
  assert.equal((await fetch(srv.base + m.payload.url)).status, 401, 'oturumsuz alamaz');
});

test('DM dosyası: aralık (Range) desteği, yalnızca iki taraf', async () => {
  const ali = await login('medali');
  const up = await ali.post(`/api/dm/${S.ece}/file`, { file: { data: dataUrl('video/mp4', BIG), name: 'klip.mp4', mime: 'video/mp4', size: BIG.length } });
  assert.equal(up.status, 200, up.text);
  const msgs = (await ali.get(`/api/dm/${S.ece}/messages`)).body.messages;
  const m = msgs.find((x) => x.id === up.body.id);
  assert.equal(m.payload.data, undefined);
  const url = m.payload.url;

  const part = await raw(ali, url, { Range: 'bytes=100-199' });
  assert.equal(part.status, 206);
  assert.equal(part.headers.get('content-range'), `bytes 100-199/${BIG.length}`);
  assert.equal((await part.arrayBuffer()).byteLength, 100);
  const tail = await raw(ali, url, { Range: 'bytes=-50' });
  assert.equal(tail.status, 206);
  assert.equal((await tail.arrayBuffer()).byteLength, 50);
  assert.equal((await raw(ali, url, { Range: `bytes=${BIG.length + 5}-` })).status, 416);

  const ece = await login('medece');
  assert.equal((await raw(ece, url)).status, 200, 'alıcı alır');
  const yab = await login('medyab');
  assert.equal((await raw(yab, url)).status, 403, 'üçüncü kişi alamaz');
});

test('Tehlikeli tür (HTML) sayfada açılmaz: indirme olarak verilir', async () => {
  const ali = await login('medali');
  const html = Buffer.from('<script>alert(1)</script>');
  const up = await ali.post(`/api/hubs/${S.hubId}/file`, { file: { data: dataUrl('text/html', html), name: 'x.html', mime: 'text/html', size: html.length } });
  assert.equal(up.status, 200, up.text);
  const m = (await ali.get(`/api/hubs/${S.hubId}/messages`)).body.messages.find((x) => x.payload && x.payload.name === 'x.html');
  const r = await raw(ali, m.payload.url);
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('content-type'), 'application/octet-stream');
  assert.match(r.headers.get('content-disposition'), /^attachment;/);
  assert.match(r.headers.get('content-security-policy'), /sandbox/);
});

test('Büyük dosya akışla gelir: içerik birebir, parça sınırını aşan aralık doğru, önbellek doğrulaması (304)', async () => {
  const ali = await login('medali');
  const big = Buffer.alloc(7 * 1024 * 1024);
  for (let i = 0; i < big.length; i++) big[i] = (i * 31 + (i >> 8)) & 255;
  const up = await ali.post(`/api/hubs/${S.hubId}/file`, { file: { data: dataUrl('video/mp4', big), name: 'buyuk.mp4', mime: 'video/mp4', size: big.length } });
  assert.equal(up.status, 200, up.text);
  const m = (await ali.get(`/api/hubs/${S.hubId}/messages`)).body.messages.find((x) => x.payload && x.payload.name === 'buyuk.mp4');
  const full = await raw(ali, m.payload.url);
  assert.equal(full.status, 200);
  assert.equal(Number(full.headers.get('content-length')), big.length);
  assert.ok(Buffer.from(await full.arrayBuffer()).equals(big), 'tam içerik birebir');
  const s = 3 * 1024 * 1024 - 7, e = 3 * 1024 * 1024 + 12; // 3 MB parça sınırını aşar
  const part = await raw(ali, m.payload.url, { Range: `bytes=${s}-${e}` });
  assert.equal(part.status, 206);
  assert.ok(Buffer.from(await part.arrayBuffer()).equals(big.subarray(s, e + 1)), 'aralık içeriği birebir');
  const etag = full.headers.get('etag');
  assert.ok(etag);
  assert.equal((await raw(ali, m.payload.url, { 'If-None-Match': etag })).status, 304);
  assert.match(full.headers.get('cache-control'), /no-cache/);
});

test('Silinen mesaj 404, lobiden atılan 403, bozuk karakterli ad sorun çıkarmaz', async () => {
  const ali = await login('medali');
  const ece = await login('medece');
  const weird = 'kötü\ud800ad.png';
  const up = await ali.post(`/api/hubs/${S.hubId}/file`, { file: { data: dataUrl('image/png', PNG), name: weird, mime: 'image/png', size: PNG.length } });
  assert.equal(up.status, 200, up.text);
  const msgs = (await ali.get(`/api/hubs/${S.hubId}/messages`)).body.messages;
  const m = msgs.filter((x) => x.kind === 'image').pop();
  const r = await raw(ali, m.payload.url);
  assert.equal(r.status, 200, 'yalnız vekil karakterli ad 500 vermez');
  assert.equal((await raw(ece, m.payload.url)).status, 200);

  assert.equal((await ali.del(`/api/messages/${m.id}`)).status, 200);
  assert.equal((await raw(ali, m.payload.url)).status, 404, 'silinen mesajın dosyası yok');

  const up2 = await ali.post(`/api/hubs/${S.hubId}/file`, { file: { data: dataUrl('image/png', PNG), name: 'ikinci.png', mime: 'image/png', size: PNG.length } });
  const m2 = (await ali.get(`/api/hubs/${S.hubId}/messages`)).body.messages.find((x) => x.payload && x.payload.name === 'ikinci.png');
  assert.equal(up2.status, 200);
  assert.equal((await raw(ece, m2.payload.url)).status, 200);
  const kick = await ali.post(`/api/hubs/${S.hubId}/members/${S.ece}/kick`, {});
  assert.equal(kick.status, 200, kick.text);
  assert.equal((await raw(ece, m2.payload.url)).status, 403, 'atılan üye artık alamaz');
});

test('Sunucu sağlığı: yalnızca yönetici; beklenmedik yeniden başlama kaydı', async () => {
  const ali = await login('medali');
  assert.equal((await ali.get('/api/admin/server-health')).status, 403);
  const adm = await login('medadm');
  const h = await adm.get('/api/admin/server-health');
  assert.equal(h.status, 200, h.text);
  assert.ok(h.body.memory.rss_mb > 0);
  assert.equal(h.body.heartbeat.state, 'running');
  assert.ok(h.body.events.some((e) => e.kind === 'unexpected_restart'), 'önceki düzgün kapanmamış çalışma kaydedildi');
  assert.ok(h.body.events.some((e) => e.kind === 'server_start'));
});


// ── Disk deposu ──
const mediaFiles = () => {
  const root = path.join(srv.dataDir, 'media');
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root).flatMap((d) => fs.readdirSync(path.join(root, d)).filter((f) => !f.endsWith('.tmp')));
};

test('Yeni yükleme diske yazılır; iletilen kopya aynı dosyayı kullanır; silinince temizlikte diskten gider', async () => {
  const ali = await login('medali');
  const ece = await login('medece');
  const adm = await login('medadm');
  const payload = Buffer.alloc(9000, 5);
  const beforeSet = new Set(mediaFiles());
  const before = beforeSet.size;
  const up = await ali.post(`/api/dm/${S.ece}/file`, { file: { data: dataUrl('image/png', payload), name: 'disk.png', mime: 'image/png', size: payload.length } });
  assert.equal(up.status, 200, up.text);
  assert.equal(mediaFiles().length, before + 1, 'dosya diske yazıldı');
  const [newFile] = mediaFiles().filter((f) => !beforeSet.has(f));
  assert.ok(newFile);
  const m = (await ali.get(`/api/dm/${S.ece}/messages`)).body.messages.find((x) => x.id === up.body.id);
  assert.equal(m.payload.file, undefined, 'iç dosya kimliği istemciye gitmez');
  assert.ok(Buffer.from(await (await raw(ece, m.payload.url)).arrayBuffer()).equals(payload), 'diskten birebir');
  const part = await raw(ece, m.payload.url, { Range: 'bytes=10-19' });
  assert.equal(part.status, 206);
  assert.equal((await part.arrayBuffer()).byteLength, 10);

  // İlet: ece aynı dosyayı aliye geri iletir → yeni dosya yazılmaz
  const fw = await ece.post(`/api/messages/${m.id}/forward`, { to_user_id: S.ali });
  assert.equal(fw.status, 200, fw.text);
  assert.equal(mediaFiles().length, before + 1, 'iletme yeni dosya yazmaz');
  const copy = fw.body.message;
  assert.equal((await raw(ali, copy.payload.url)).status, 200);

  // Kopyayı silmek asıl mesajın dosyasına dokunmaz (temizlikten sonra da)
  const fw2 = await ece.post(`/api/messages/${m.id}/forward`, { to_user_id: S.ali });
  assert.equal((await ece.del(`/api/messages/${fw2.body.message.id}`)).status, 200);
  assert.equal((await adm.post('/api/admin/storage', { action: 'sweep' })).status, 200);
  assert.ok(mediaFiles().includes(newFile), 'paylaşılan dosya duruyor');
  assert.ok(Buffer.from(await (await raw(ece, m.payload.url)).arrayBuffer()).equals(payload), 'asıl mesaj hâlâ açılıyor');

  // Kaynağı sil → kopyalar da içeriksiz kalır, temizlik dosyayı siler
  assert.equal((await ali.del(`/api/messages/${m.id}`)).status, 200);
  assert.equal((await raw(ece, m.payload.url)).status, 404);
  assert.equal((await raw(ali, copy.payload.url)).status, 404, 'kaynak silinince iletilen kopya da açılmaz');
  const sw = await adm.post('/api/admin/storage', { action: 'sweep' });
  assert.equal(sw.status, 200, sw.text);
  assert.ok(sw.body.removed >= 1);
  assert.ok(!mediaFiles().includes(newFile), 'yetim dosya diskten silindi');
});

test('Taşıma: gömülü eski dosyalar diske taşınır, içerik birebir; sıkıştırma çalışır', async () => {
  const ali = await login('medali');
  const ece = await login('medece');
  const adm = await login('medadm');
  const h0 = (await adm.get('/api/admin/server-health')).body;
  assert.ok(h0.storage.inline_count >= 2, 'gömülü dosyalar görünür');
  assert.ok(h0.storage.disk === null || h0.storage.disk.total > 0);

  assert.equal((await adm.post('/api/admin/storage', { action: 'migrate_start' })).status, 200);
  let h;
  for (let i = 0; i < 100; i++) {
    h = (await adm.get('/api/admin/server-health')).body;
    if (h.migration.state !== 'running') break;
    await new Promise((r) => setTimeout(r, 100));
  }
  assert.equal(h.migration.state, 'done', JSON.stringify(h.migration));
  assert.ok(h.migration.moved >= 2);

  const img = await raw(ali, `/api/messages/${S.oldImg}/media`);
  assert.equal(img.status, 200);
  assert.ok(Buffer.from(await img.arrayBuffer()).equals(OLD_IMG), 'taşınan görsel birebir');
  const voice = await raw(ece, `/api/messages/${S.oldVoice}/media`);
  assert.equal(voice.status, 200);
  assert.ok(Buffer.from(await voice.arrayBuffer()).equals(OLD_VOICE), 'taşınan sesli mesaj (3 MB+) birebir');
  const listed = (await ali.get(`/api/dm/${S.ece}/messages`)).body.messages.find((x) => x.id === S.oldVoice);
  assert.equal(listed.payload.url, `/api/messages/${S.oldVoice}/media`);

  const vac = await adm.post('/api/admin/storage', { action: 'vacuum' });
  assert.equal(vac.status, 200, vac.text);
  const h2 = (await adm.get('/api/admin/server-health')).body;
  assert.equal(h2.storage.inline_count, 0, 'gömülü dosya kalmadı');
  assert.equal((await ali.post('/api/admin/storage', { action: 'sweep' })).status, 403, 'yönetici değilse yasak');
});
