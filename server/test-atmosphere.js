'use strict';
// Atmosphere + Lobi Takviyesi kuralları. Çalıştır:  node server/test-atmosphere.js   (geçici veri klasörü kullanır)
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'sauran-atmo-'));
const dbm = require('./db.js');
const { levelForBoosts, PREMIUM_MONTHLY_BOOSTS } = require('./atmosphere');
const db = dbm.db;

let passed = 0;
const test = (name, fn) => { fn(); passed += 1; console.log('PASS ', name); };
const user = (name, product) => {
  dbm.createUser(name);
  const id = db.prepare('SELECT id FROM users WHERE username = ?').get(name).id;
  if (product) db.prepare(`INSERT INTO entitlements (user_id, product, expires_at) VALUES (?, ?, NULL)`).run(id, product);
  return id;
};

const free = user('t_free', null), plus = user('t_plus', 'plus'), prem = user('t_prem', 'premium');

test('seviye eşikleri 1/2/3/4 = 0/2/7/10', () => {
  assert.deepStrictEqual([0, 1, 2, 6, 7, 9, 10, 50].map(levelForBoosts), [1, 1, 2, 2, 3, 3, 4, 4]);
});

test('Atmosphere yetkisi: Premium paket yalnızca Premium; Plus paket Plus/Premium; ücretsiz hiçbiri', () => {
  assert.strictEqual(dbm.applyAtmosphere(free, 'midnight').success, false);
  assert.strictEqual(dbm.applyAtmosphere(plus, 'cyber').success, false);
  assert.strictEqual(dbm.applyAtmosphere(plus, 'midnight').success, true);
  assert.strictEqual(dbm.applyAtmosphere(prem, 'cyber').success, true);
  assert.strictEqual(dbm.applyAtmosphere(prem, 'yok-boyle-bir-sey').success, false);
});

test('Atmosphere paketi mevcut kişiselleştirme alanlarını uygular; abonelik bitince okuma anında none', () => {
  assert.strictEqual(dbm.effectiveAtmosphere(plus), 'midnight');
  const row = db.prepare('SELECT chat_theme, bubble_style, profile_theme, name_effect FROM users WHERE id = ?').get(plus);
  assert.deepStrictEqual(row, { chat_theme: 'soft', bubble_style: 'glass', profile_theme: 'midnight', name_effect: 'shimmer' });
  db.prepare(`UPDATE entitlements SET expires_at = '2000-01-01 00:00:00' WHERE user_id = ?`).run(plus);
  assert.strictEqual(dbm.effectiveAtmosphere(plus), 'none');
});

test('listAtmospheresFor: available/active kullanıcıya göre', () => {
  const items = dbm.listAtmospheresFor(prem);
  assert.ok(items.filter((a) => a.tier !== 'coin').every((a) => a.available));
  assert.strictEqual(items.find((a) => a.active).key, 'cyber');
  assert.ok(dbm.listAtmospheresFor(free).every((a) => !a.available && !a.active));
});

const owner = user('t_owner', 'premium');
const hubId = dbm.createHub(owner, { name: 'Takviye Lobisi' }).id;

test('Takviye yalnızca Premium: ücretsiz ve Plus reddedilir', () => {
  dbm.joinHubForTest && dbm.joinHubForTest(hubId, free);
  assert.strictEqual(dbm.boostHub(free, hubId).success, false);
  assert.strictEqual(dbm.boostHub(plus, hubId).success, false);
});

test(`Premium aylık ${PREMIUM_MONTHLY_BOOSTS} takviye; fazlası reddedilir`, () => {
  for (let i = 0; i < PREMIUM_MONTHLY_BOOSTS; i++) assert.strictEqual(dbm.boostHub(owner, hubId).success, true);
  const r = dbm.boostHub(owner, hubId);
  assert.strictEqual(r.success, false);
  assert.strictEqual(dbm.getHubBoostInfo(hubId, owner).count, PREMIUM_MONTHLY_BOOSTS);
});

test('Geri çekilen takviyenin yuvası 24 saat dolu kalır', () => {
  assert.strictEqual(dbm.unboostHub(owner, hubId).success, true);
  assert.strictEqual(dbm.listMyBoosts(owner).slots.free, 0);
  assert.strictEqual(dbm.boostHub(owner, hubId).success, false);
});

test('Seviye 3 öncesi lobi Atmosphere reddedilir; 7 takviyede açılır ve lobi temasını çeker', () => {
  assert.strictEqual(dbm.setHubAtmosphere(hubId, owner, 'cyber').success, false);
  const a = user('t_a', 'premium'), b = user('t_b', 'premium');
  const ins = db.prepare('INSERT INTO hub_boosts (hub_id, user_id) VALUES (?, ?)');
  for (let i = 0; i < 3; i++) { ins.run(hubId, a); ins.run(hubId, b); }
  assert.strictEqual(dbm.hubLevel(hubId), 3);
  const r = dbm.setHubAtmosphere(hubId, owner, 'cyber');
  assert.strictEqual(r.success, true);
  assert.strictEqual(dbm.getHubDetail(hubId, owner).atmosphere, 'cyber');
  assert.strictEqual(dbm.getHubDetail(hubId, owner).theme, 'aurora');
});

test('Yalnızca lobi sahibi Atmosphere seçebilir', () => {
  assert.strictEqual(dbm.setHubAtmosphere(hubId, plus, 'cyber').success, false);
});

test('Takviyeci Premium bitince takviyesi düşer, seviye ve lobi Atmosphere\'i kendiliğinden kapanır', () => {
  const aId = db.prepare(`SELECT id FROM users WHERE username = 't_a'`).get().id;
  db.prepare(`UPDATE entitlements SET expires_at = '2000-01-01 00:00:00' WHERE user_id = ?`).run(aId);
  assert.strictEqual(dbm.hubLevel(hubId), 2);
  assert.strictEqual(dbm.getHubDetail(hubId, owner).atmosphere, 'none');
});

test('Takviyeci işareti üye listesinde', () => {
  const m = dbm.getHubDetail(hubId, owner).members.find((x) => x.user_id === owner);
  assert.strictEqual(m.is_booster, true);
});

test('Profil sesi: Atmosphere izlenir, seçim bunu ezer, kapalıyken/abonelik bitince boş', () => {
  const p2 = user('t_sound', 'plus');
  assert.strictEqual(dbm.effectiveProfileSound(p2), '');
  dbm.applyAtmosphere(p2, 'sakura');
  assert.strictEqual(dbm.effectiveProfileSound(p2), 'garden');
  assert.strictEqual(dbm.setProfileSound(p2, 'cosmic').success, true);
  assert.strictEqual(dbm.effectiveProfileSound(p2), 'cosmic');
  assert.strictEqual(dbm.setProfileSound(p2, 'bilinmeyen').success, false);
  dbm.setProfileSoundOn(p2, false);
  assert.strictEqual(dbm.effectiveProfileSound(p2), '');
  dbm.setProfileSoundOn(p2, true);
  assert.strictEqual(dbm.setProfileSound(free, 'cyber').success, false);
  db.prepare(`UPDATE entitlements SET expires_at = '2000-01-01 00:00:00' WHERE user_id = ?`).run(p2);
  assert.strictEqual(dbm.effectiveProfileSound(p2), '');
});

test('Coin paketi listede fiyatıyla görünür ama satın alma açılana kadar kullanılamaz', () => {
  const items = dbm.listAtmospheresFor(prem);
  const c = items.find((a) => a.key === 'cosmic-night');
  assert.ok(c);
  assert.strictEqual(c.price_coins, 250);
  assert.strictEqual(c.available, false);
  assert.strictEqual(c.purchasable, false);
  assert.strictEqual(dbm.applyAtmosphere(prem, 'cosmic-night').success, false);
});

test('Lobi bannerı: Seviye 3 şartı, yalnızca sahip, GIF kabul, boyut sınırı, seviye düşünce gizlenir', () => {
  const gif = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
  const o2 = user('t_ban_o', 'premium');
  const hub2 = dbm.createHub(o2, { name: 'Banner Lobisi' }).id;
  assert.strictEqual(dbm.setHubBanner(hub2, o2, gif).success, false); // Seviye 1
  const ins = db.prepare('INSERT INTO hub_boosts (hub_id, user_id) VALUES (?, ?)');
  const boosters = [user('t_ban_1', 'premium'), user('t_ban_2', 'premium'), user('t_ban_3', 'premium')];
  boosters.forEach((b) => { for (let i = 0; i < 3; i++) ins.run(hub2, b); });
  assert.strictEqual(dbm.hubLevel(hub2), 3);
  assert.strictEqual(dbm.setHubBanner(hub2, boosters[0], gif).success, false); // sahip değil
  assert.strictEqual(dbm.setHubBanner(hub2, o2, 'data:text/html;base64,AAAA').success, false);
  assert.strictEqual(dbm.setHubBanner(hub2, o2, 'data:image/gif;base64,' + 'A'.repeat(3_100_000)).success, false); // çok büyük
  assert.strictEqual(dbm.setHubBanner(hub2, o2, gif).success, true);
  assert.strictEqual(dbm.getHubDetail(hub2, o2).banner_data, gif);
  db.prepare(`UPDATE entitlements SET expires_at = '2000-01-01 00:00:00' WHERE user_id = ?`).run(boosters[0]);
  assert.strictEqual(dbm.hubLevel(hub2), 2);
  assert.strictEqual(dbm.getHubDetail(hub2, o2).banner_data, null); // Seviye 3 altında gizli
  assert.strictEqual(dbm.setHubBanner(hub2, o2, null).success, true); // kaldırma her seviyede serbest
});

test('Lobi emojileri: Seviye 4 şartı, yalnızca sahip, ad/format/boyut/yuva denetimi, seviye düşünce gizlenir', () => {
  const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==';
  const o3 = user('t_em_o', 'premium');
  const hub3 = dbm.createHub(o3, { name: 'Emoji Lobisi' }).id;
  assert.strictEqual(dbm.addHubEmoji(hub3, o3, 'kedi', png).success, false); // Seviye 1
  const ins = db.prepare('INSERT INTO hub_boosts (hub_id, user_id) VALUES (?, ?)');
  const bs = [user('t_em_1', 'premium'), user('t_em_2', 'premium'), user('t_em_3', 'premium'), user('t_em_4', 'premium')];
  bs.forEach((b) => { for (let i = 0; i < 3; i++) ins.run(hub3, b); });
  assert.strictEqual(dbm.hubLevel(hub3), 4);
  assert.strictEqual(dbm.addHubEmoji(hub3, bs[0], 'kedi', png).success, false); // sahip değil
  assert.strictEqual(dbm.addHubEmoji(hub3, o3, 'Kedi!', png).success, false); // geçersiz ad
  assert.strictEqual(dbm.addHubEmoji(hub3, o3, 'kedi', 'data:image/svg+xml;base64,AAAA').success, false); // svg yok
  assert.strictEqual(dbm.addHubEmoji(hub3, o3, 'kedi', 'data:image/png;base64,' + 'A'.repeat(150_000)).success, false); // çok büyük
  assert.strictEqual(dbm.addHubEmoji(hub3, o3, 'kedi', png).success, true);
  assert.strictEqual(dbm.addHubEmoji(hub3, o3, 'kedi', png).success, false); // yinelenen ad
  for (let i = 0; i < 9; i++) assert.strictEqual(dbm.addHubEmoji(hub3, o3, 'e' + i + 'x', png).success, true);
  assert.strictEqual(dbm.addHubEmoji(hub3, o3, 'fazla', png).success, false); // 10 yuva dolu
  assert.strictEqual(dbm.getHubDetail(hub3, o3).emojis.length, 10);
  const emojiId = dbm.getHubDetail(hub3, o3).emojis[0].id;
  assert.strictEqual(dbm.removeHubEmoji(hub3, bs[0], emojiId).success, false); // sahip değil
  assert.strictEqual(dbm.removeHubEmoji(hub3, o3, emojiId).emojis.length, 9);
  db.prepare(`UPDATE entitlements SET expires_at = '2000-01-01 00:00:00' WHERE user_id = ?`).run(bs[0]);
  assert.strictEqual(dbm.hubLevel(hub3), 3);
  assert.deepStrictEqual(dbm.getHubDetail(hub3, o3).emojis, []); // Seviye 4 altında gizli
});

test('Premium çıkartmalar: yalnızca Premium gönderebilir; Plus ve ücretsiz reddedilir; geçersiz kimlik reddedilir', () => {
  const sOwner = user('t_stk_o', 'premium'), sPlus = user('t_stk_p', 'plus'), sFree = user('t_stk_f', null);
  const hubS = dbm.createHub(sOwner, { name: 'Çıkartma Lobisi' }).id;
  const send = (uid, uname, id) => dbm.createHubSticker(hubS, uid, uname, id);
  assert.strictEqual(send(sOwner, 't_stk_o', 'prem-dragon').success, true);
  assert.strictEqual(send(sPlus, 't_stk_p', 'prem-dragon').success, false);
  assert.strictEqual(send(sFree, 't_stk_f', 'prem-dragon').success, false);
  assert.strictEqual(send(sPlus, 't_stk_p', 'plus-cat').success, true); // Plus seti hâlâ çalışır
  assert.strictEqual(send(sOwner, 't_stk_o', 'prem-yok').success, false);
});

console.log(`\n${passed} test geçti`);
try { db.close(); fs.rmSync(process.env.DATA_DIR, { recursive: true, force: true }); } catch (_) { /* Windows dosya kilidi: geçici klasör bırakılabilir */ }
process.exit(0);
