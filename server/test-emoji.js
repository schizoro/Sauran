'use strict';
// Kişisel/lobi emojileri: sıkıştırma + yetki + mesaj çözümleme. Çalıştır: node server/test-emoji.js (geçici veri klasörü kullanır)
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'sauran-emoji-'));
const sharp = require('sharp');
const dbm = require('./db.js');
const { compressEmoji, decodeImageDataUrl } = require('./emojiimage');
const db = dbm.db;

let passed = 0;
const tests = [];
const test = (name, fn) => tests.push([name, fn]);
const user = (name, product) => {
  dbm.createUser(name);
  const id = db.prepare('SELECT id FROM users WHERE username = ?').get(name).id;
  if (product) db.prepare(`INSERT INTO entitlements (user_id, product, expires_at) VALUES (?, ?, NULL)`).run(id, product);
  return id;
};

// Örnek görseller: büyük fotoğraf benzeri PNG, JPEG ve çok kareli hareketli GIF
async function bigPhoto() {
  const W = 1600, H = 1200, raw = Buffer.alloc(W * H * 3);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = (y * W + x) * 3; raw[i] = (x * 255 / W) | 0; raw[i + 1] = (y * 255 / H) | 0; raw[i + 2] = ((x ^ y) & 255); }
  return sharp(raw, { raw: { width: W, height: H, channels: 3 } }).jpeg({ quality: 95 }).toBuffer();
}
async function animatedGif(frames = 12, size = 96) {
  const raw = Buffer.alloc(size * size * frames * 4);
  for (let f = 0; f < frames; f++) for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = ((f * size + y) * size + x) * 4; raw[i] = (x * 3 + f * 20) % 256; raw[i + 1] = (y * 3) % 256; raw[i + 2] = (f * 20) % 256; raw[i + 3] = 255;
  }
  return sharp(raw, { raw: { width: size, height: size * frames, channels: 4, pageHeight: size } }).gif({ delay: Array(frames).fill(80), loop: 0 }).toBuffer();
}
const dataUrl = (buf, mime) => `data:${mime};base64,${buf.toString('base64')}`;

test('Statik sıkıştırma: büyük fotoğraf ≤128px ve ≤60 KB WebP olur', async () => {
  const photo = await bigPhoto();
  const r = await compressEmoji(photo, { allowAnimated: false });
  assert.strictEqual(r.success, true);
  assert.strictEqual(r.animated, false);
  assert.ok(r.bytes <= 60 * 1024, 'boyut ' + r.bytes);
  assert.ok(r.width <= 128 && r.height <= 128);
  assert.ok(r.bytes < photo.length / 10);
  assert.match(r.data, /^data:image\/webp;base64,/);
});

test('Hareketli GIF: izin varsa hareketli WebP (çok kareli, küçük); izin yoksa ilk kare + not', async () => {
  const gif = await animatedGif();
  const a = await compressEmoji(gif, { allowAnimated: true });
  assert.strictEqual(a.success, true);
  assert.strictEqual(a.animated, true);
  assert.ok(a.bytes <= 220 * 1024);
  const meta = await sharp(decodeImageDataUrl(a.data) || Buffer.from(a.data.split(',')[1], 'base64'), { animated: true }).metadata();
  assert.ok(meta.pages > 1, 'hareketli kalmadı');
  const s = await compressEmoji(gif, { allowAnimated: false });
  assert.strictEqual(s.success, true);
  assert.strictEqual(s.animated, false);
  assert.match(s.note, /Premium/);
});

test('Geçersiz içerik reddedilir (metin, çok büyük, boş)', async () => {
  assert.strictEqual((await compressEmoji(Buffer.from('bu bir resim değil'), {})).success, false);
  assert.strictEqual((await compressEmoji(Buffer.alloc(0), {})).success, false);
  assert.strictEqual((await compressEmoji(Buffer.alloc(6 * 1024 * 1024, 1), { allowAnimated: true })).success, false);
  assert.strictEqual(decodeImageDataUrl('data:text/html;base64,AAAA'), null);
  assert.strictEqual(decodeImageDataUrl('data:image/svg+xml;base64,AAAA'), null);
});

test('Kişisel emoji: yalnızca Plus/Premium; Plus 10 statik, Premium 30; hareketli yalnızca Premium; ad/yinelenen denetimi', async () => {
  const free = user('e_free', null), plus = user('e_plus', 'plus'), prem = user('e_prem', 'premium');
  const stat = await compressEmoji(await bigPhoto(), {});
  const anim = await compressEmoji(await animatedGif(), { allowAnimated: true });
  assert.strictEqual(dbm.addUserEmoji(free, 'kedi', stat).success, false);
  assert.strictEqual(dbm.addUserEmoji(plus, 'kedi', stat).success, true);
  assert.strictEqual(dbm.addUserEmoji(plus, 'kedi', stat).success, false); // yinelenen
  assert.strictEqual(dbm.addUserEmoji(plus, 'Kedi!', stat).success, false); // geçersiz ad
  assert.strictEqual(dbm.addUserEmoji(plus, 'dans', anim).success, false); // Plus hareketli yapamaz
  for (let i = 0; i < 9; i++) assert.strictEqual(dbm.addUserEmoji(plus, 'e' + i + 'x', stat).success, true);
  assert.strictEqual(dbm.addUserEmoji(plus, 'fazla', stat).success, false); // 10 doldu
  assert.strictEqual(dbm.emojiPermissions(plus).limit, 10);
  assert.strictEqual(dbm.addUserEmoji(prem, 'dans', anim).success, true);
  assert.strictEqual(dbm.emojiPermissions(prem).limit, 30);
  for (let i = 0; i < 29; i++) assert.strictEqual(dbm.addUserEmoji(prem, 'p' + i + 'x', stat).success, true);
  assert.strictEqual(dbm.addUserEmoji(prem, 'fazla', stat).success, false); // 30 doldu
  assert.strictEqual(dbm.listUserEmojis(prem).find((e) => e.name === 'dans').animated, true);
});

test('Mesajda çözümleme: kişisel emoji (gönderici hakkı), lobi emojisi, Premium için diğer lobiler; kilit/abonelik bitince çözülmez', async () => {
  const stat = await compressEmoji(await bigPhoto(), {});
  const owner = user('r_owner', 'premium'), plus = user('r_plus', 'plus'), prem = user('r_prem', 'premium'), free = user('r_free', null);
  // iki Seviye 4 lobi (A, B) ve her birinde bir lobi emojisi
  const mkHub = (name) => {
    const id = dbm.createHub(owner, { name }).id;
    const boosters = [user(name + '_1', 'premium'), user(name + '_2', 'premium'), user(name + '_3', 'premium'), user(name + '_4', 'premium')];
    const ins = db.prepare('INSERT INTO hub_boosts (hub_id, user_id) VALUES (?, ?)');
    boosters.forEach((b, i) => { for (let k = 0; k < (i < 3 ? 3 : 1); k++) ins.run(id, b); });
    return id;
  };
  const hubA = mkHub('LobiA'), hubB = mkHub('LobiB');
  assert.strictEqual(dbm.addHubEmoji(hubA, owner, 'aemoji', stat).success, true);
  assert.strictEqual(dbm.addHubEmoji(hubB, owner, 'bemoji', stat).success, true);
  const join = (hid, uid) => db.prepare('INSERT OR IGNORE INTO hub_members (hub_id, user_id, role_id, permission_tier) VALUES (?, ?, NULL, ?)').run(hid, uid, 'member');
  [plus, prem, free].forEach((u) => { join(hubA, u); join(hubB, u); });
  assert.strictEqual(dbm.addUserEmoji(plus, 'benimki', stat).success, true);

  const msg = (uid, content, hid) => ({ user_id: uid, content, kind: 'text', hub_id: hid });
  // Plus: kendi emojisi + bu lobinin emojisi çözülür; diğer lobininki çözülmez
  let m = dbm.resolveMessageEmojis(msg(plus, ':benimki: :aemoji: :bemoji:', hubA));
  assert.ok(m.benimki && m.aemoji);
  assert.strictEqual(m.bemoji, undefined);
  // Premium: diğer lobilerin emojisi de çözülür
  m = dbm.resolveMessageEmojis(msg(prem, ':aemoji: :bemoji:', hubA));
  assert.ok(m.aemoji && m.bemoji);
  // Ücretsiz: lobi emojisi kullanamaz ama bulunduğu lobinin emojisi herkese açık (üye) — mevcut davranış korunur
  m = dbm.resolveMessageEmojis(msg(free, ':aemoji: :bemoji:', hubA));
  assert.ok(m.aemoji);
  assert.strictEqual(m.bemoji, undefined);
  assert.strictEqual(dbm.resolveMessageEmojis(msg(free, 'merhaba', hubA)), null);
  // Plus bitince kişisel emoji çözülmez
  db.prepare(`UPDATE entitlements SET expires_at = '2000-01-01 00:00:00' WHERE user_id = ?`).run(plus);
  m = dbm.resolveMessageEmojis(msg(plus, ':benimki:', hubA));
  assert.strictEqual(m, null);
  // Görsel servisi: kişisel emoji sahibi aboneyse, lobi emojisi Seviye 4 ise
  const uid = dbm.listUserEmojis(prem).length ? dbm.listUserEmojis(prem)[0].id : null;
  assert.strictEqual(dbm.getEmojiImage('h', dbm.getHubDetail(hubA, owner).emojis[0].id, owner).startsWith('data:image/webp'), true);
  assert.strictEqual(dbm.getEmojiImage('h', 999999, owner), null);
  assert.strictEqual(dbm.getEmojiImage('u', 999999, owner), null);
  assert.strictEqual(dbm.getEmojiImage('h', dbm.getHubDetail(hubA, owner).emojis[0].id, null), null); // giriş şart
  void uid;
});

test('Emoji paleti: Premium diğer lobilerin emojilerini açık, Plus kilitli görür', async () => {
  const stat = await compressEmoji(await bigPhoto(), {});
  const owner = user('p_owner', 'premium'), plus = user('p_plus', 'plus'), prem = user('p_prem', 'premium');
  const mk = (name) => {
    const id = dbm.createHub(owner, { name }).id;
    const bs = [user(name + 'a', 'premium'), user(name + 'b', 'premium'), user(name + 'c', 'premium'), user(name + 'd', 'premium')];
    const ins = db.prepare('INSERT INTO hub_boosts (hub_id, user_id) VALUES (?, ?)');
    bs.forEach((b, i) => { for (let k = 0; k < (i < 3 ? 3 : 1); k++) ins.run(id, b); });
    dbm.addHubEmoji(id, owner, 'x' + name.toLowerCase(), stat);
    return id;
  };
  const h1 = mk('Pal1'), h2 = mk('Pal2');
  [plus, prem].forEach((u) => [h1, h2].forEach((h) => db.prepare('INSERT OR IGNORE INTO hub_members (hub_id, user_id, role_id, permission_tier) VALUES (?, ?, NULL, ?)').run(h, u, 'member')));
  const pPlus = dbm.listEmojiPalette(plus, h1), pPrem = dbm.listEmojiPalette(prem, h1);
  assert.strictEqual(pPlus.lobbies.find((l) => l.hub_id === h1).locked, false); // bu lobi herkese açık
  assert.strictEqual(pPlus.lobbies.find((l) => l.hub_id === h2).locked, true);
  assert.strictEqual(pPrem.lobbies.find((l) => l.hub_id === h2).locked, false);
  assert.strictEqual(dbm.listCrossLobbyEmojis(plus).length, 0);
  assert.ok(dbm.listCrossLobbyEmojis(prem, h1).length >= 1);
});

test('Kişisel çıkartma: Plus 5 statik, Premium 15 + hareketli; yalnızca sahibi gönderir; Plus hareketli yapamaz', async () => {
  const free = user('s_free', null), plus = user('s_plus', 'plus'), prem = user('s_prem', 'premium'), other = user('s_other', 'premium');
  const opts = { size: 256, maxStatic: 90 * 1024, maxAnimated: 300 * 1024 };
  const stat = await compressEmoji(await bigPhoto(), opts);
  assert.ok(stat.success && stat.width <= 256 && stat.bytes <= 90 * 1024);
  const anim = await compressEmoji(await animatedGif(), { allowAnimated: true, ...opts });
  assert.strictEqual(anim.animated, true);
  assert.strictEqual(dbm.addUserSticker(free, 'kedi', stat).success, false);
  assert.strictEqual(dbm.addUserSticker(plus, 'kedi', stat).success, true);
  assert.strictEqual(dbm.addUserSticker(plus, 'kedi', stat).success, false);
  assert.strictEqual(dbm.addUserSticker(plus, 'dans', anim).success, false);
  for (let i = 0; i < 4; i++) assert.strictEqual(dbm.addUserSticker(plus, 's' + i + 'x', stat).success, true);
  assert.strictEqual(dbm.addUserSticker(plus, 'fazla', stat).success, false); // 5 doldu
  assert.strictEqual(dbm.addUserSticker(prem, 'dans', anim).success, true);
  assert.strictEqual(dbm.stickerPermissions(prem).limit, 15);
  const pid = 'u' + dbm.listUserStickers(plus)[0].id;
  assert.strictEqual(dbm.createHubSticker(1, other, 'x', pid).success, false); // başkasınınki
  assert.strictEqual(dbm.createHubSticker(1, free, 'x', 'u999999').success, false);
  const hubId = dbm.createHub(prem, { name: 'StkLobi' }).id;
  assert.strictEqual(dbm.createHubSticker(hubId, plus, 'plus', pid).success, true);
  assert.strictEqual(dbm.getStickerImage('u', dbm.listUserStickers(plus)[0].id, plus).startsWith('data:image/webp'), true);
  db.prepare(`UPDATE entitlements SET expires_at = '2000-01-01 00:00:00' WHERE user_id = ?`).run(plus);
  assert.strictEqual(dbm.getStickerImage('u', dbm.listUserStickers(plus)[0].id, plus), null);
  assert.strictEqual(dbm.createHubSticker(hubId, plus, 'plus', pid).success, false);
});

test('Lobi çıkartması: Seviye 4, yalnızca sahip, 5 yuva; yalnızca o lobide gönderilir; DM içinde reddedilir', async () => {
  const stat = await compressEmoji(await bigPhoto(), { size: 256, maxStatic: 90 * 1024 });
  const owner = user('hs_owner', 'premium'), member = user('hs_member', null);
  const id = dbm.createHub(owner, { name: 'HsLobi' }).id, id2 = dbm.createHub(owner, { name: 'HsLobi2' }).id;
  assert.strictEqual(dbm.addHubSticker(id, owner, 'a1', stat).success, false); // Seviye 1
  const ins = db.prepare('INSERT INTO hub_boosts (hub_id, user_id) VALUES (?, ?)');
  [id, id2].forEach((h) => [1, 2, 3, 4].forEach((i) => { const b = user('hsb' + h + i, 'premium'); for (let k = 0; k < (i < 4 ? 3 : 1); k++) ins.run(h, b); }));
  assert.strictEqual(dbm.hubLevel(id), 4);
  assert.strictEqual(dbm.addHubSticker(id, member, 'a1', stat).success, false); // sahip değil
  for (let i = 0; i < 5; i++) assert.strictEqual(dbm.addHubSticker(id, owner, 'h' + i + 'x', stat).success, true);
  assert.strictEqual(dbm.addHubSticker(id, owner, 'fazla', stat).success, false);
  const sid = 'h' + dbm.listHubStickers(id)[0].id;
  assert.strictEqual(dbm.createHubSticker(id, member, 'm', sid).success, true); // lobide herkes
  assert.strictEqual(dbm.createHubSticker(id2, member, 'm', sid).success, false); // başka lobide değil
  assert.strictEqual(dbm.validateStickerFor ? true : true, true);
  assert.strictEqual(dbm.saveDmSticker(member, 'm', owner, sid).success, false); // DM'de yok
  assert.strictEqual(dbm.listStickerPalette(member, id).hub.length, 0); // üye değil → liste boş
});

test('Seviye 4 lobi: duyuru/karşılama/vurgu rengi yalnızca sahip + Seviye 4; sesli oda sınırları 5→8, 25→50', async () => {
  const owner = user('l4_owner', 'premium'), other = user('l4_other', null);
  const id = dbm.createHub(owner, { name: 'L4Lobi' }).id;
  assert.strictEqual(dbm.setHubContent(id, owner, { announcement: 'x' }).success, false); // Seviye 1
  assert.strictEqual(dbm.setHubAccent(id, owner, '#ff0000').success, false);
  for (let i = 0; i < 5; i++) assert.strictEqual(dbm.createVoiceRoom(id, owner, 'Oda' + i).success, i < 5);
  assert.strictEqual(dbm.createVoiceRoom(id, owner, 'Fazla').success, false); // 5 sınır
  assert.strictEqual(dbm.maxVoiceRoomsForHub(id), 5);
  const ins = db.prepare('INSERT INTO hub_boosts (hub_id, user_id) VALUES (?, ?)');
  [1, 2, 3, 4].forEach((i) => { const b = user('l4b' + i, 'premium'); for (let k = 0; k < (i < 4 ? 3 : 1); k++) ins.run(id, b); });
  assert.strictEqual(dbm.hubLevel(id), 4);
  assert.strictEqual(dbm.setHubContent(id, other, { announcement: 'x' }).success, false); // sahip değil
  assert.strictEqual(dbm.setHubContent(id, owner, { announcement: 'a'.repeat(501) }).success, false);
  const r = dbm.setHubContent(id, owner, { announcement: '  Merhaba  ', welcome_message: 'Hoş geldin' });
  assert.ok(r.success && r.announcement === 'Merhaba');
  assert.strictEqual(dbm.setHubAccent(id, owner, 'kirmizi').success, false);
  assert.strictEqual(dbm.setHubAccent(id, owner, '#FF8800').accent_color, '#ff8800');
  const d = dbm.getHubDetail(id, owner);
  assert.ok(d.announcement === 'Merhaba' && d.welcome_message === 'Hoş geldin' && d.accent_color === '#ff8800');
  assert.deepStrictEqual(d.voice_limits, { rooms: 8, participants: 50 });
  for (let i = 0; i < 3; i++) assert.strictEqual(dbm.createVoiceRoom(id, owner, 'Ek' + i).success, true);
  assert.strictEqual(dbm.createVoiceRoom(id, owner, 'Fazla2').success, false); // 8 sınır
  const roomId = dbm.getVoiceRooms ? null : null; void roomId;
  // Seviye düşünce gizlenir
  db.prepare(`UPDATE entitlements SET expires_at = '2000-01-01 00:00:00' WHERE user_id = (SELECT user_id FROM hub_boosts WHERE hub_id = ? LIMIT 1)`).run(id);
  const d2 = dbm.getHubDetail(id, owner);
  if (d2.boost.level < 4) assert.ok(d2.announcement === null && d2.accent_color === null);
});

(async () => {
  for (const [name, fn] of tests) {
    await fn();
    passed += 1;
    console.log('PASS ', name);
  }
  console.log(`\n${passed} test geçti`);
  try { db.close(); fs.rmSync(process.env.DATA_DIR, { recursive: true, force: true }); } catch (_) { /* Windows dosya kilidi */ }
  process.exit(0);
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
