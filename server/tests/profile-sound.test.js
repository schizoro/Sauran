'use strict';
// Kendi profil sesi: yalnızca Plus/Premium; sunucu WAV'ı ve süreyi (≤ 7,5 sn) doğrular; başkası profilde adresini görüp dinler;
// kaldırılınca erişim kapanır ve eski dosya temizlikte diskten silinir.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { startServer, client, makeUser } = require('./helpers');

let srv, S;
test.before(async () => {
  srv = await startServer((dbm) => {
    const plus = makeUser(dbm, 'sesplus');
    const free = makeUser(dbm, 'sesfree');
    const dinleyen = makeUser(dbm, 'sesdinle');
    const adm = makeUser(dbm, 'sesadm', { role: 'admin' });
    dbm.db.prepare(`INSERT INTO entitlements (user_id, product, expires_at) VALUES (?, 'plus', NULL)`).run(plus.id);
    dbm.sendFriendRequest(dinleyen.id, plus.id); dbm.respondFriendRequest(plus.id, dinleyen.id, true);
    const genc = makeUser(dbm, 'sesgenc', { birth: '2013-05-05' });
    dbm.db.prepare(`INSERT INTO entitlements (user_id, product, expires_at) VALUES (?, 'plus', NULL)`).run(genc.id);
    dbm.sendFriendRequest(dinleyen.id, genc.id); dbm.respondFriendRequest(genc.id, dinleyen.id, true);
    return { plus: plus.id, free: free.id, dinleyen: dinleyen.id, adm: adm.id, genc: genc.id };
  });
  S = srv.seeded;
});
test.after(async () => { if (srv) await srv.stop(); });

async function login(name) { const c = client(srv.base); assert.equal((await c.login(name, 'Passw0rd!x')).status, 200); return c; }
const raw = (c, url) => fetch(srv.base + url, { headers: { Cookie: c.cookie } });

// 16 bit mono PCM WAV
function wav(seconds, rate = 22050) {
  const n = Math.round(seconds * rate);
  const b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVE', 8); b.write('fmt ', 12);
  b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(rate, 24); b.writeUInt32LE(rate * 2, 28);
  b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(Math.sin(i / 8) * 8000), 44 + i * 2);
  return `data:audio/wav;base64,${b.toString('base64')}`;
}
const mediaFiles = () => {
  const root = path.join(srv.dataDir, 'media');
  return fs.existsSync(root) ? fs.readdirSync(root).flatMap((d) => fs.readdirSync(path.join(root, d))) : [];
};

test('Plus olmayan yükleyemez; geçersiz biçim ve 7,5 sn üstü reddedilir', async () => {
  const free = await login('sesfree');
  assert.equal((await free.post('/api/profile/custom-sound', { audio: wav(3) })).status, 403);
  const plus = await login('sesplus');
  assert.equal((await plus.post('/api/profile/custom-sound', { audio: wav(9) })).status, 400, '9 sn reddedilir');
  assert.equal((await plus.post('/api/profile/custom-sound', { audio: 'data:audio/wav;base64,' + Buffer.from('merhaba dunya bu wav degil ki').toString('base64') })).status, 400, 'WAV değil');
  assert.equal((await plus.post('/api/profile/custom-sound', { audio: 'data:audio/mpeg;base64,AAAA' })).status, 400, 'yalnızca WAV');
  // Veri bölümünden sonra gizlenmiş içerik
  const padded = Buffer.concat([Buffer.from(wav(1).split(',')[1], 'base64'), Buffer.alloc(5000, 65)]);
  assert.equal((await plus.post('/api/profile/custom-sound', { audio: 'data:audio/wav;base64,' + padded.toString('base64') })).status, 400, 'fazladan bayt');
  assert.equal(mediaFiles().length, 0, 'reddedilenler diske yazılmaz');
});

test('Yükle → profilde adres görünür, arkadaş dinler; kaldırınca kapanır ve dosya temizlenir', async () => {
  const plus = await login('sesplus');
  const up = await plus.post('/api/profile/custom-sound', { audio: wav(7) });
  assert.equal(up.status, 200, up.text);
  assert.equal(up.body.profile_sound, 'custom');
  assert.equal(mediaFiles().length, 1);

  const dinle = await login('sesdinle');
  const prof = (await dinle.get(`/api/users/${S.plus}/profile`)).body.profile;
  assert.equal(prof.profile_sound, 'custom');
  assert.ok(prof.profile_sound_url && prof.profile_sound_url.startsWith(`/api/users/${S.plus}/profile-sound?v=`));
  const r = await raw(dinle, prof.profile_sound_url);
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('content-type'), 'audio/wav');
  assert.equal((await r.arrayBuffer()).byteLength, 44 + Math.round(7 * 22050) * 2);
  assert.equal((await fetch(srv.base + prof.profile_sound_url)).status, 401, 'oturumsuz alamaz');

  // Yeni ses yüklenince eski dosya hemen silinir (birikmez)
  assert.equal((await plus.post('/api/profile/custom-sound', { audio: wav(2) })).status, 200);
  assert.equal(mediaFiles().length, 1, 'eski ses hemen silindi, yenisi duruyor');
  const adm = await login('sesadm');

  // Kaldır
  const del = await plus.del('/api/profile/custom-sound');
  assert.equal(del.status, 200);
  const prof2 = (await dinle.get(`/api/users/${S.plus}/profile`)).body.profile;
  assert.notEqual(prof2.profile_sound, 'custom');
  assert.equal(prof2.profile_sound_url, null);
  assert.equal((await raw(dinle, prof.profile_sound_url)).status, 404);
  assert.equal(mediaFiles().length, 0, 'kaldırılan ses hemen diskten silindi');
  assert.equal((await adm.post('/api/admin/storage', { action: 'sweep' })).status, 200);
});

test('18 yaş altı: ses yalnızca arkadaşlara açık', async () => {
  const genc = await login('sesgenc');
  assert.equal((await genc.post('/api/profile/custom-sound', { audio: wav(2) })).status, 200);
  const arkadas = await login('sesdinle');
  const p1 = (await arkadas.get(`/api/users/${S.genc}/profile`)).body.profile;
  assert.ok(p1.profile_sound_url, 'arkadaş görür');
  assert.equal((await raw(arkadas, p1.profile_sound_url)).status, 200);
  const yabanci = await login('sesfree');
  const p2 = (await yabanci.get(`/api/users/${S.genc}/profile`)).body.profile;
  assert.equal(p2.profile_sound_url || null, null, 'arkadaş olmayana adres verilmez');
  assert.equal((await raw(yabanci, p1.profile_sound_url)).status, 404, 'adres bilinse de alınamaz');
});
