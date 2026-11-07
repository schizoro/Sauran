'use strict';
// API yetki testleri: oturum, Lobi/DM erişimi, mesaj sahipliği, platform rolleri, Coin.
// Gerçek sunucu geçici veritabanıyla ayrı süreçte çalışır (bkz. helpers.js).
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, client, makeUser } = require('./helpers');

let srv, S;
const as = {};

test.before(async () => {
  srv = await startServer((dbm) => {
    const alice = makeUser(dbm, 'alice', { role: 'founder' });
    const bob = makeUser(dbm, 'bob');
    const carol = makeUser(dbm, 'carol');
    const dave = makeUser(dbm, 'dave');
    dbm.sendFriendRequest(bob.id, alice.id); dbm.respondFriendRequest(alice.id, bob.id, true);
    dbm.sendFriendRequest(carol.id, alice.id); dbm.respondFriendRequest(alice.id, carol.id, true);
    const h = dbm.createHub(alice.id, { name: 'Test Lobi', type: 'hub' });
    const hubId = h.id || (h.hub && h.hub.id);
    const inv = dbm.createHubInvite(hubId, alice.id, {});
    dbm.joinHubByCode(inv.code || (inv.invite && inv.invite.code), bob.id);
    dbm.saveHubMessage(hubId, alice.id, 'alice', 'GIZLI_LOBI_MESAJI');
    dbm.saveDmMessage(alice.id, 'alice', bob.id, 'GIZLI_DM_ALICE_BOB');
    const q = (content) => dbm.db.prepare(`SELECT id FROM messages WHERE content = ?`).get(content).id;
    // Süper Beğeni için: Keşfet'te görünen Lobi + 3 günden eski hesap
    dbm.db.prepare(`UPDATE hubs SET visibility = 'discoverable' WHERE id = ?`).run(hubId);
    dbm.db.prepare(`UPDATE users SET created_at = datetime('now', '-30 days')`).run();
    return { alice, bob, carol, dave, hubId, hubMsg: q('GIZLI_LOBI_MESAJI'), dmMsg: q('GIZLI_DM_ALICE_BOB') };
  });
  S = srv.seeded;
  for (const name of ['alice', 'bob', 'carol', 'dave']) {
    as[name] = client(srv.base);
    const r = await as[name].login(name, 'Passw0rd!x');
    assert.equal(r.status, 200, `${name} giriş: ${r.text}`);
  }
});

test.after(async () => { if (srv) await srv.stop(); });

// ---------------------------------------------------------------- Oturum
test('Oturumsuz istekler 401 döner', async () => {
  const anon = client(srv.base);
  for (const u of ['/api/me', '/api/hubs', '/api/wallet', `/api/hubs/${S.hubId}/messages`, `/api/users/${S.alice.id}/profile`, '/api/admin/users']) {
    const r = await anon.get(u);
    assert.equal(r.status, 401, u);
  }
  const r = await anon.del(`/api/messages/${S.hubMsg}`);
  assert.equal(r.status, 401);
});

test('Giriş: yanlış şifre/kullanıcı aynı yanıtı verir; e-posta ile giriş çalışır', async () => {
  const c = client(srv.base);
  const wrong = await c.login('alice', 'yanlis-sifre');
  const nouser = await c.login('yok-boyle-biri', 'yanlis-sifre');
  assert.equal(wrong.status, 401);
  assert.equal(nouser.status, 401);
  assert.equal(wrong.body.error, nouser.body.error, 'hesap var/yok ayırt edilememeli');
  assert.equal(c.cookie, '', 'başarısız girişte oturum çerezi verilmemeli');
  const ok = await c.login(S.carol.email.toUpperCase(), 'Passw0rd!x');
  assert.equal(ok.status, 200);
  assert.equal(ok.body.user.username, 'carol');
  assert.equal(ok.body.user.password_hash, undefined);
});

test('Oturum çerezi HttpOnly + SameSite', async () => {
  const res = await fetch(srv.base + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'dave', password: 'Passw0rd!x' }) });
  const c = res.headers.getSetCookie().join('\n');
  assert.match(c, /HttpOnly/i);
  assert.match(c, /SameSite=(Lax|Strict)/i);
});

test('Çıkış yapılan oturum çerezi bir daha çalışmaz', async () => {
  const c = client(srv.base);
  await c.login('dave', 'Passw0rd!x');
  const saved = c.cookie;
  assert.equal((await c.get('/api/me')).status, 200);
  await c.post('/api/logout');
  const replay = client(srv.base); replay.cookie = saved;
  assert.equal((await replay.get('/api/me')).status, 401);
});

test('Oturumlar: başkasının oturumu kapatılamaz; "diğerlerini kapat" mevcut oturumu korur', async () => {
  const second = client(srv.base);
  await second.login('carol', 'Passw0rd!x');
  const list = await second.get('/api/sessions');
  const other = list.body.sessions.find((s) => !s.is_current);
  assert.ok(other, 'carol için ikinci oturum olmalı');
  assert.equal((await as.bob.del(`/api/sessions/${other.id}`)).status, 404, 'bob, carol\'ın oturumunu kapatamaz');
  assert.equal((await as.carol.get('/api/me')).status, 200);
  await second.post('/api/sessions/logout-all');
  assert.equal((await second.get('/api/me')).status, 200, 'mevcut oturum açık kalır');
  assert.equal((await as.carol.get('/api/me')).status, 401, 'diğer oturum kapanır');
  await as.carol.login('carol', 'Passw0rd!x');
});

// ---------------------------------------------------------------- Lobi erişimi
test('Lobi mesajları yalnızca üyelere görünür', async () => {
  const member = await as.bob.get(`/api/hubs/${S.hubId}/messages`);
  assert.equal(member.status, 200);
  assert.ok(member.text.includes('GIZLI_LOBI_MESAJI'));
  for (const u of [`/api/hubs/${S.hubId}/messages`, `/api/hubs/${S.hubId}/messages?around=${S.hubMsg}`, `/api/hubs/${S.hubId}/search?q=GIZLI`, `/api/hubs/${S.hubId}/supporters`]) {
    const r = await as.carol.get(u);
    assert.ok(r.status === 403 || r.status === 404, `${u} → ${r.status}`);
    assert.ok(!r.text.includes('GIZLI_LOBI_MESAJI'), u);
  }
});

test('Üye olmayan Lobiye mesaj gönderemez', async () => {
  const r = await as.carol.post(`/api/hubs/${S.hubId}/messages`, { content: 'izinsiz' });
  assert.ok(r.status >= 400, String(r.status));
  const page = await as.alice.get(`/api/hubs/${S.hubId}/messages`);
  assert.ok(!page.text.includes('izinsiz'));
});

test('Mesaj: başkasının mesajı silinemez/düzenlenemez; sahibi düzenleyebilir', async () => {
  for (const who of ['bob', 'carol']) {
    assert.ok((await as[who].del(`/api/messages/${S.hubMsg}`)).status >= 400, `${who} silme`);
    assert.ok((await as[who].patch(`/api/messages/${S.hubMsg}`, { content: 'ele geçirildi' })).status >= 400, `${who} düzenleme`);
    assert.ok((await as[who].del(`/api/messages/${S.dmMsg}`)).status >= 400, `${who} DM silme`);
  }
  const page = await as.alice.get(`/api/hubs/${S.hubId}/messages`);
  assert.ok(page.text.includes('GIZLI_LOBI_MESAJI') && !page.text.includes('ele geçirildi'));
  const edit = await as.alice.patch(`/api/messages/${S.hubMsg}`, { content: 'GIZLI_LOBI_MESAJI düzenlendi' });
  assert.equal(edit.status, 200, edit.text);
});

test('Lobi yönetimi: üye sahibi atamaz, Lobiyi silemez; yabancı ayarları değiştiremez', async () => {
  assert.ok((await as.bob.post(`/api/hubs/${S.hubId}/members/${S.alice.id}/kick`)).status >= 400);
  assert.ok((await as.bob.post(`/api/hubs/${S.hubId}/members/${S.alice.id}/ban`)).status >= 400);
  assert.ok((await as.bob.del(`/api/hubs/${S.hubId}`)).status >= 400);
  assert.ok((await as.carol.del(`/api/hubs/${S.hubId}`)).status >= 400);
  assert.ok((await as.bob.post(`/api/hubs/${S.hubId}/members/${S.bob.id}/moderator`)).status >= 400, 'üye kendini moderatör yapamaz');
  assert.equal((await as.alice.get(`/api/hubs/${S.hubId}/messages`)).status, 200, 'Lobi hâlâ var');
});

test('Atılan üye Lobiye erişimini kaybeder', async () => {
  const kick = await as.alice.post(`/api/hubs/${S.hubId}/members/${S.bob.id}/kick`);
  assert.equal(kick.status, 200, kick.text);
  assert.equal((await as.bob.get(`/api/hubs/${S.hubId}/messages`)).status, 403);
});

// ---------------------------------------------------------------- DM erişimi
test('DM: yalnızca arkadaşlar; başkasının konuşması sızmaz', async () => {
  const mine = await as.bob.get(`/api/dm/${S.alice.id}/messages`);
  assert.equal(mine.status, 200);
  assert.ok(mine.text.includes('GIZLI_DM_ALICE_BOB'));
  const carolAlice = await as.carol.get(`/api/dm/${S.alice.id}/messages`);
  assert.equal(carolAlice.status, 200);
  assert.ok(!carolAlice.text.includes('GIZLI_DM_ALICE_BOB'), 'carol, alice–bob konuşmasını görmemeli');
  const stranger = await as.dave.get(`/api/dm/${S.alice.id}/messages`);
  assert.equal(stranger.status, 403);
  assert.ok(!(await as.dave.get(`/api/dm/${S.bob.id}/search?q=GIZLI`)).text.includes('GIZLI_DM'));
  assert.ok(!(await as.carol.get(`/api/messages/${S.dmMsg}`)).text.includes('GIZLI_DM'));
});

test('Profil yanıtı e-posta / şifre özeti içermez', async () => {
  const r = await as.carol.get(`/api/users/${S.alice.id}/profile`);
  assert.equal(r.status, 200);
  assert.ok(!r.text.includes(S.alice.email), 'e-posta sızmamalı');
  assert.ok(!/password|token_hash|totp/i.test(r.text), r.text.slice(0, 200));
});

// ---------------------------------------------------------------- Platform rolleri ve Coin
test('Yönetim uçları normal kullanıcıya kapalı', async () => {
  for (const [m, u] of [['get', '/api/admin/users'], ['get', '/api/admin/stats'], ['get', '/api/admin/audit-log'], ['get', '/api/moderation/reports'],
    ['patch', `/api/admin/users/${S.bob.id}/role`], ['patch', `/api/admin/users/${S.alice.id}/suspend`], ['post', '/api/admin/coins/grant'], ['post', '/api/admin/gifts']]) {
    const r = await as.bob[m](u, m !== 'get' ? { username: 'bob', amount: 1000, role: 'admin' } : undefined);
    assert.equal(r.status, 403, `${m} ${u} → ${r.status}`);
  }
  assert.equal((await as.bob.get('/api/wallet')).body.balance, 0, 'izinsiz Coin verilmemeli');
  assert.equal((await as.alice.get('/api/me')).status, 200, 'alice askıya alınmamalı');
});

test('Coin: yalnızca kurucu verir; geçersiz miktar reddedilir', async () => {
  for (const amount of [-50, 0, 1.5, '10; DROP', 100001]) {
    const r = await as.alice.post('/api/admin/coins/grant', { username: 'carol', amount });
    assert.equal(r.status, 400, `miktar ${amount}`);
  }
  const ok = await as.alice.post('/api/admin/coins/grant', { username: 'carol', amount: 15 });
  assert.equal(ok.status, 200, ok.text);
  assert.equal((await as.carol.get('/api/wallet')).body.balance, 15);
});

test('Süper Beğeni: Coin yetmezse düşmez; yeterse 10 Coin düşer', async () => {
  const poor = await as.dave.post(`/api/discover/lobbies/${S.hubId}/super-like`);
  assert.equal(poor.status, 400);
  assert.equal(poor.body.reason, 'insufficient_coins');
  assert.equal((await as.dave.get('/api/wallet')).body.balance, 0);
  const ok = await as.carol.post(`/api/discover/lobbies/${S.hubId}/super-like`);
  assert.equal(ok.status, 200, ok.text);
  assert.equal((await as.carol.get('/api/wallet')).body.balance, 5);
  const again = await as.carol.post(`/api/discover/lobbies/${S.hubId}/super-like`);
  assert.equal(again.status, 400, 'bakiye 5 iken ikinci Süper Beğeni geçmemeli');
  assert.equal((await as.carol.get('/api/wallet')).body.balance, 5);
});

// ---------------------------------------------------------------- CSP ihlal raporları
test('CSP raporu: oturumsuz kabul edilir, kişisel ayrıntı (yol/sorgu) atılır, yalnızca yönetici görür', async () => {
  const send = (body, type = 'application/csp-report') => fetch(srv.base + '/api/csp-report', { method: 'POST', headers: { 'Content-Type': type }, body: JSON.stringify(body) });
  const r = await send({ 'csp-report': { 'effective-directive': 'img-src', 'blocked-uri': 'https://kotu.example/izle?kullanici=gizli@posta.com', 'document-uri': 'https://sauran.online/app?token=GIZLI', 'source-file': 'https://sauran.online/script.js?v=1' } });
  assert.equal(r.status, 204);
  await send([{ type: 'csp-violation', body: { effectiveDirective: 'img-src', blockedURL: 'https://kotu.example/baska', documentURL: 'https://sauran.online/app', sourceFile: 'https://sauran.online/script.js' } }], 'application/reports+json');
  for (const [body, status] of [['{bozuk', 400], ['{"a":"' + 'x'.repeat(20000) + '"}', 413]]) {
    const bad = await fetch(srv.base + '/api/csp-report', { method: 'POST', headers: { 'Content-Type': 'application/csp-report' }, body });
    const text = await bad.text();
    assert.equal(bad.status, status);
    assert.ok(!/<html|Error|at \w/i.test(text), 'hata sayfası/yığın izi sızmamalı: ' + text.slice(0, 80));
  }
  // Uydurma yönerge kaydedilmez; bir istek en fazla 2 yeni satır açar
  await send([1, 2, 3, 4, 5].map((i) => ({ body: { effectiveDirective: 'img-src', blockedURL: `https://sahte${i}.example/`, documentURL: 'https://sauran.online/app' } })), 'application/reports+json');
  await send({ 'csp-report': { 'effective-directive': 'uydurma-src', 'blocked-uri': 'https://uydurma.example/' } });
  assert.equal((await as.bob.get('/api/admin/csp-reports')).status, 403);
  const list = await as.alice.get('/api/admin/csp-reports');
  assert.equal(list.status, 200);
  const hit = list.body.reports.find((x) => x.blocked === 'https://kotu.example');
  assert.ok(hit, list.text);
  assert.equal(hit.count, 2, 'aynı ihlal tek satırda sayılır');
  assert.equal(hit.page, '/app');
  assert.ok(!/gizli|GIZLI|token|kullanici/.test(list.text), 'sorgu/yol ayrıntısı saklanmamalı');
  assert.ok(!list.text.includes('uydurma'));
  assert.equal(list.body.reports.filter((x) => /sahte/.test(x.blocked)).length, 2);
});

test('CSP üst bilgisi: Daily yedek alan adları ve rapor adresi var, unsafe-eval yok', async () => {
  const res = await fetch(srv.base + '/app');
  const csp = res.headers.get('content-security-policy-report-only');
  for (const part of ['https://*.dailywebrtc.com', 'https://*.dailywebrtc.net', 'report-uri /api/csp-report', "worker-src 'self' blob:"]) assert.ok(csp.includes(part), part);
  assert.ok(!/'unsafe-eval'/.test(csp), 'JavaScript eval izni olmamalı');
  assert.ok(csp.includes("'wasm-unsafe-eval'"), 'gürültü engelleme (WebAssembly) için');
  assert.match(res.headers.get('content-security-policy'), /frame-ancestors 'none'/);
});
