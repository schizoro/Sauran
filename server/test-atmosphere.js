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
  assert.strictEqual(dbm.getHubDetail(hub2, o2).has_banner, true);
  assert.strictEqual(dbm.getHubDetail(hub2, o2).banner_data, undefined); // ham veri istemciye gitmez
  assert.strictEqual(dbm.getHubBannerImage(hub2, o2), gif);
  db.prepare(`UPDATE entitlements SET expires_at = '2000-01-01 00:00:00' WHERE user_id = ?`).run(boosters[0]);
  assert.strictEqual(dbm.hubLevel(hub2), 2);
  assert.strictEqual(dbm.getHubDetail(hub2, o2).has_banner, false); // Seviye 3 altında gizli
  assert.strictEqual(dbm.getHubBannerImage(hub2, o2), null); // servis de edilmez
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

test('HEDİYE ARACI KORUMASI: features.js ve atmosphere.js kayıtlarının tamamı Hediye Aracı kataloğunda (yeni ekleneni unutma)', () => {
  const { FEATURES } = require('./features');
  const { ATMOSPHERES } = require('./atmosphere');
  const keys = new Set(dbm.listGiftProducts().map((p) => p.key));
  Object.keys(FEATURES).forEach((k) => assert.ok(keys.has(k), 'Hediye kataloğunda yok: ' + k));
  ATMOSPHERES.forEach((a) => assert.ok(keys.has('atmo:' + a.key), 'Hediye kataloğunda yok: atmo:' + a.key));
  ['coin', 'plus', 'premium', 'boost'].forEach((k) => assert.ok(keys.has(k)));
});

test('Hediye: tek özellik (sohbet teması, balon, profil sesi, GIF banner) yalnızca o özelliği açar', () => {
  const founder = user('t_gift_f', null), g1 = user('t_gift_1', null);
  assert.strictEqual(dbm.updateChatTheme(g1, 'soft').success, false);
  assert.strictEqual(dbm.giftProduct(founder, 't_gift_1', 'chat_theme', 1).success, true);
  assert.strictEqual(dbm.updateChatTheme(g1, 'soft').success, true);
  assert.strictEqual(dbm.updateBubbleStyle(g1, 'glass').success, false); // balon verilmedi
  assert.strictEqual(dbm.giftProduct(founder, 't_gift_1', 'bubble_style', 1).success, true);
  assert.strictEqual(dbm.updateBubbleStyle(g1, 'glass').success, true);
  assert.strictEqual(dbm.setProfileSound(g1, 'cyber').success, false);
  assert.strictEqual(dbm.giftProduct(founder, 't_gift_1', 'profile_sound', 1).success, true);
  assert.strictEqual(dbm.setProfileSound(g1, 'cyber').success, true);
  assert.strictEqual(dbm.effectiveProfileSound(g1), 'cyber');
  assert.strictEqual(dbm.listFeatures(g1).includes('gif_banner'), false);
  assert.strictEqual(dbm.giftProduct(founder, 't_gift_1', 'gif_banner', 1).success, true);
  assert.strictEqual(dbm.listFeatures(g1).includes('gif_banner'), true);
});

test('Hediye: Premium\'a özel özellik (Premium çıkartma, GIF avatar) Plus ile açılmaz, hediyeyle açılır', () => {
  const founder = user('t_gift_f2', null), plusU = user('t_gift_pl', 'plus'), freeU = user('t_gift_fr', null);
  assert.strictEqual(dbm.hasFeature(plusU, 'premium_sticker_pack'), false);
  assert.strictEqual(dbm.giftProduct(founder, 't_gift_fr', 'premium_sticker_pack', 1).success, true);
  assert.strictEqual(dbm.hasFeature(freeU, 'premium_sticker_pack'), true);
  assert.strictEqual(dbm.hasFeature(freeU, 'gif_avatar'), false);
  assert.strictEqual(dbm.giftProduct(founder, 't_gift_pl', 'gif_avatar', 1).success, true);
  assert.strictEqual(dbm.hasFeature(plusU, 'gif_avatar'), true);
});

test('Hediye: Atmosphere paketi (ücretsiz kullanıcıya) paketi ve ihtiyaç duyduğu tüm hakları açar, uygulanabilir', () => {
  const founder = user('t_gift_f3', null), g3 = user('t_gift_3', null);
  assert.strictEqual(dbm.applyAtmosphere(g3, 'cyber').success, false);
  assert.strictEqual(dbm.giftProduct(founder, 't_gift_3', 'atmo:cyber', 1).success, true);
  const r = dbm.applyAtmosphere(g3, 'cyber');
  assert.strictEqual(r.success, true);
  assert.strictEqual(dbm.effectiveAtmosphere(g3), 'cyber');
  assert.strictEqual(dbm.effectiveProfileSound(g3), 'cyber');
  assert.strictEqual(dbm.listAtmospheresFor(g3).find((a) => a.key === 'cyber').available, true);
  assert.strictEqual(dbm.listAtmospheresFor(g3).find((a) => a.key === 'cosmic').available, false); // diğer paket hâlâ kilitli
  // Coin kademeli paket de hediye edilebilir (satın alma açılmadan önce)
  assert.strictEqual(dbm.giftProduct(founder, 't_gift_3', 'atmo:cosmic-night', 1).success, true);
  assert.strictEqual(dbm.applyAtmosphere(g3, 'cosmic-night').success, true);
});

test('Hediye Lobi Takviyesi: Premium olmadan kullanılır, kalıcıdır, Premium yuvalarıyla birleşir', () => {
  const founder = user('t_bg_f', null), gu = user('t_bg_u', null), pu = user('t_bg_p', 'premium');
  const hubG = dbm.createHub(pu, { name: 'Hediye Takviye Lobisi' }).id;
  dbm.joinHubForTest && dbm.joinHubForTest(hubG, gu);
  db.prepare('INSERT OR IGNORE INTO hub_members (hub_id, user_id, role_id, permission_tier) VALUES (?, ?, NULL, ?)').run(hubG, gu, 'member');
  assert.strictEqual(dbm.boostHub(gu, hubG).success, false); // kredisi yok
  assert.strictEqual(dbm.giftProduct(founder, 't_bg_u', 'boost', 2).success, true);
  assert.deepStrictEqual([dbm.listMyBoosts(gu).slots.total, dbm.listMyBoosts(gu).slots.free], [2, 2]);
  assert.strictEqual(dbm.boostHub(gu, hubG).success, true);
  assert.strictEqual(dbm.boostHub(gu, hubG).success, true);
  assert.strictEqual(dbm.boostHub(gu, hubG).success, false); // 2 hediye bitti
  assert.strictEqual(dbm.getHubBoostInfo(hubG, gu).count, 2);
  // hediye takviye Premium'dan bağımsız kalıcıdır; Premium takviyesi ise abonelikle düşer
  assert.strictEqual(dbm.giftProduct(founder, 't_bg_p', 'boost', 1).success, true);
  assert.strictEqual(dbm.listMyBoosts(pu).slots.total, PREMIUM_MONTHLY_BOOSTS + 1);
  assert.strictEqual(dbm.boostHub(pu, hubG).success, true); // önce Premium yuvası kullanılır
  assert.strictEqual(db.prepare(`SELECT source FROM hub_boosts WHERE user_id = ? ORDER BY id DESC LIMIT 1`).get(pu).source, 'premium');
  db.prepare(`UPDATE entitlements SET expires_at = '2000-01-01 00:00:00' WHERE user_id = ?`).run(pu);
  assert.strictEqual(dbm.getHubBoostInfo(hubG, gu).count, 2); // Premium'un takviyesi düştü, hediye olanlar kaldı
  assert.strictEqual(dbm.listMyBoosts(pu).slots.total, 1); // yalnızca hediye yuva
});

test('Premium emoji paketi: yalnızca Premium (ya da hediye) tepki verebilir', () => {
  const eP = user('t_em_prem', 'premium'), eL = user('t_em_plus', 'plus'), eF = user('t_em_free', null), founder = user('t_em_f', null);
  assert.match(dbm.addReaction(999999, eF, '🐉').error, /Premium/);
  assert.match(dbm.addReaction(999999, eL, '🐉').error, /Premium/); // Plus yetmez
  assert.strictEqual(dbm.addReaction(999999, eP, '🐉').error, 'Mesaj bulunamadı.'); // kapıdan geçti
  assert.strictEqual(dbm.addReaction(999999, eL, '🥰').error, 'Mesaj bulunamadı.'); // Plus emojisi hâlâ Plus'ta
  assert.strictEqual(dbm.giftProduct(founder, 't_em_plus', 'premium_emoji_pack', 1).success, true);
  assert.strictEqual(dbm.addReaction(999999, eL, '🐉').error, 'Mesaj bulunamadı.'); // hediyeyle açıldı
});

test('Erken erişim: tarihe kadar yalnızca Premium; sonra normal kademe; hediye/sahiplik her zaman geçer', () => {
  const { ATMOSPHERES } = require('./atmosphere');
  const { FEATURES } = require('./features');
  const ePrem = user('t_ea_prem', 'premium'), ePlus = user('t_ea_plus', 'plus'), eGift = user('t_ea_gift', null), founder = user('t_ea_f', null);
  const midnight = ATMOSPHERES.find((a) => a.key === 'midnight');
  const future = new Date(Date.now() + 86400000).toISOString(), past = new Date(Date.now() - 86400000).toISOString();
  try {
    midnight.early_access_until = future;
    assert.strictEqual(dbm.listAtmospheresFor(ePlus).find((a) => a.key === 'midnight').available, false);
    assert.strictEqual(dbm.listAtmospheresFor(ePrem).find((a) => a.key === 'midnight').available, true);
    assert.ok(dbm.listAtmospheresFor(ePlus).find((a) => a.key === 'midnight').early_access_until);
    dbm.giftProduct(founder, 't_ea_gift', 'atmo:midnight', 1);
    assert.strictEqual(dbm.listAtmospheresFor(eGift).find((a) => a.key === 'midnight').available, true);
    midnight.early_access_until = past;
    assert.strictEqual(dbm.listAtmospheresFor(ePlus).find((a) => a.key === 'midnight').available, true);
    assert.strictEqual(dbm.listAtmospheresFor(ePlus).find((a) => a.key === 'midnight').early_access_until, null);
    FEATURES.chat_theme.early_access_until = future;
    assert.strictEqual(dbm.hasFeature(ePlus, 'chat_theme'), false);
    assert.strictEqual(dbm.hasFeature(ePrem, 'chat_theme'), true);
    FEATURES.chat_theme.early_access_until = past;
    assert.strictEqual(dbm.hasFeature(ePlus, 'chat_theme'), true);
  } finally {
    delete midnight.early_access_until;
    delete FEATURES.chat_theme.early_access_until;
  }
});

test('Maksimum seviyedeki lobiye takviye verilmez (uyarı) ve takviye harcanmaz; geri çekme serbest', () => {
  const mo = user('t_mx_o', 'premium'), mg = user('t_mx_g', 'premium');
  const hubM = dbm.createHub(mo, { name: 'Maksimum Lobi' }).id;
  const join = (hid, uid) => db.prepare('INSERT OR IGNORE INTO hub_members (hub_id, user_id, role_id, permission_tier) VALUES (?, ?, NULL, ?)').run(hid, uid, 'member');
  join(hubM, mg);
  const ins = db.prepare('INSERT INTO hub_boosts (hub_id, user_id) VALUES (?, ?)');
  const fill = [user('t_mx_1', 'premium'), user('t_mx_2', 'premium'), user('t_mx_3', 'premium'), user('t_mx_4', 'premium')];
  fill.forEach((f, i) => { for (let k = 0; k < (i < 3 ? 3 : 1); k++) ins.run(hubM, f); }); // 10 takviye
  assert.strictEqual(dbm.getHubBoostInfo(hubM, mg).at_max, true);
  const before = dbm.listMyBoosts(mg).slots.free;
  const r = dbm.boostHub(mg, hubM);
  assert.strictEqual(r.success, false);
  assert.match(r.error, /maksimum seviyede/);
  assert.strictEqual(dbm.listMyBoosts(mg).slots.free, before); // yuva harcanmadı
  const hub9 = dbm.createHub(mo, { name: 'Dokuz Lobi' }).id;
  join(hub9, mg);
  fill.forEach((f, i) => { for (let k = 0; k < (i < 3 ? 3 : 0); k++) ins.run(hub9, f); }); // 9 takviye
  assert.strictEqual(dbm.getHubBoostInfo(hub9, mg).at_max, false);
  assert.strictEqual(dbm.boostHub(mg, hub9).success, true); // 9 -> 10: son takviye verilebilir
  assert.strictEqual(dbm.boostHub(mg, hub9).success, false); // artık maksimum
});

test('Premium üye kartı: üye listesinde yalnızca Premium (ya da hediye alan) için işaretlenir', () => {
  const cO = user('t_card_o', 'premium'), cP = user('t_card_plus', 'plus'), cF = user('t_card_free', null), cG = user('t_card_gift', null), founder = user('t_card_f', null);
  const hubC = dbm.createHub(cO, { name: 'Kart Lobisi' }).id;
  const join = (uid) => db.prepare('INSERT OR IGNORE INTO hub_members (hub_id, user_id, role_id, permission_tier) VALUES (?, ?, NULL, ?)').run(hubC, uid, 'member');
  [cP, cF, cG].forEach(join);
  assert.strictEqual(dbm.giftProduct(founder, 't_card_gift', 'premium_card', 1).success, true);
  const flag = (uid) => dbm.getHubDetail(hubC, cO).members.find((m) => m.user_id === uid).premium_card;
  assert.strictEqual(flag(cO), true);
  assert.strictEqual(flag(cP), false); // Plus yetmez
  assert.strictEqual(flag(cF), false);
  assert.strictEqual(flag(cG), true); // hediye
  db.prepare(`UPDATE entitlements SET expires_at = '2000-01-01 00:00:00' WHERE user_id = ? AND product = 'premium'`).run(cO);
  assert.strictEqual(flag(cO), false); // abonelik bitince kart sade
});

test('Üye kartı stili: yalnızca Premium (premium_card) seçebilir; geçersiz reddedilir; abonelik bitince klasik', () => {
  const { CARD_STYLES } = require('./features');
  assert.ok(CARD_STYLES.filter((c) => c.group === 'cute').length >= 4 && CARD_STYLES.filter((c) => c.group === 'strong').length >= 4);
  const kP = user('t_cs_p', 'premium'), kL = user('t_cs_l', 'plus'), kF = user('t_cs_f', null);
  const hubK = dbm.createHub(kP, { name: 'Stil Lobisi' }).id;
  db.prepare('INSERT OR IGNORE INTO hub_members (hub_id, user_id, role_id, permission_tier) VALUES (?, ?, NULL, ?)').run(hubK, kL, 'member');
  assert.strictEqual(dbm.setCardStyle(kP, 'bunny').success, true);
  assert.strictEqual(dbm.setCardStyle(kP, 'yok-stil').success, false);
  assert.strictEqual(dbm.setCardStyle(kL, 'fire').success, false); // Plus yetmez
  assert.strictEqual(dbm.setCardStyle(kF, 'fire').success, false);
  const style = (uid) => dbm.getHubDetail(hubK, kP).members.find((m) => m.user_id === uid).card_style;
  assert.strictEqual(style(kP), 'bunny');
  assert.strictEqual(style(kL), '');
  assert.strictEqual(dbm.setCardStyle(kP, 'classic').success, true);
  assert.strictEqual(style(kP), 'classic');
  dbm.setCardStyle(kP, 'dragon');
  db.prepare(`UPDATE entitlements SET expires_at = '2000-01-01 00:00:00' WHERE user_id = ? AND product = 'premium'`).run(kP);
  assert.strictEqual(style(kP), ''); // abonelik bitti: stil görünmez
});

console.log(`\n${passed} test geçti`);
try { db.close(); fs.rmSync(process.env.DATA_DIR, { recursive: true, force: true }); } catch (_) { /* Windows dosya kilidi: geçici klasör bırakılabilir */ }
process.exit(0);
