'use strict';
// Resmi site değerlendirme sayfası (degerlendirme.html) ve "Sauran Geliştirici Ekibi" toplu bildirimi:
// kimlik (oturum ya da kişiye özel bağlantı), doğrulama, yetki (admin okur, yalnızca kurucu gönderir), çift gönderim koruması.
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, client, makeUser, socket } = require('./helpers');

let srv, S;

test.before(async () => {
  srv = await startServer((dbm) => {
    const seeded = {
      user: makeUser(dbm, 'ufuk'),
      admin: makeUser(dbm, 'ada', { role: 'admin' }),
      founder: makeUser(dbm, 'kurucu', { role: 'founder' }),
      banned: makeUser(dbm, 'askida')
    };
    dbm.db.prepare(`UPDATE users SET account_status = 'suspended' WHERE id = ?`).run(seeded.banned.id);
    // ufuk tüm bildirimleri kapatmış: sistem duyurusu yine de ulaşmalı.
    dbm.getNotificationPreferences(seeded.user.id);
    dbm.db.prepare(`UPDATE notification_preferences SET desktop_enabled = 0, inapp_enabled = 0, sound_enabled = 0, notify_dm_message = 0, notify_hub_message = 0,
      notify_friend_request = 0, notify_friend_accepted = 0, notify_incoming_call = 0, notify_missed_call = 0, notify_hub_event = 0, notify_system = 0 WHERE user_id = ?`).run(seeded.user.id);
    return seeded;
  });
  S = srv.seeded;
});
test.after(async () => { if (srv) await srv.stop(); });

const as = async (who) => { const c = client(srv.base); const r = await c.login(who.username, who.password); assert.equal(r.status, 200, r.text); return c; };
const withToken = (token, path, body) => fetch(srv.base + path, {
  method: body ? 'POST' : 'GET',
  headers: { 'Content-Type': 'application/json', ...(token ? { 'X-Sauran-Review-Token': token } : {}) },
  body: body ? JSON.stringify(body) : undefined
}).then(async (r) => ({ status: r.status, body: await r.json() }));

test('Kimliksiz ziyaretçi tanınmaz ve gönderim yapamaz', async () => {
  const anon = client(srv.base);
  const me = await anon.get('/api/site-feedback/me');
  assert.equal(me.status, 200);
  assert.equal(me.body.identified, false);
  assert.equal((await anon.post('/api/site-feedback/review', { scores: { look: 5 } })).status, 401);
  assert.equal((await anon.post('/api/site-feedback/message', { kind: 'oneri', body: 'merhaba ekip' })).status, 401);
  assert.equal((await withToken('uydurma-anahtar-uydurma-anahtar', '/api/site-feedback/me')).body.identified, false);
});

test('Oturumlu kullanıcı puan verir; genel görünüm zorunlu; ikinci gönderim günceller', async () => {
  const c = await as(S.user);
  assert.equal((await c.post('/api/site-feedback/review', { scores: { ease: 4 } })).status, 400);
  assert.equal((await c.post('/api/site-feedback/review', { scores: { look: 9 } })).status, 400);
  const first = await c.post('/api/site-feedback/review', { scores: { look: 4, ease: 3, speed: 7 }, comment: 'Güzel olmuş' });
  assert.equal(first.status, 200, first.text);
  assert.equal(first.body.review.speed, null, 'geçersiz isteğe bağlı puan boş kalmalı');
  await c.post('/api/site-feedback/review', { scores: { look: 5, voice: 2 }, comment: '' });
  const me = await c.get('/api/site-feedback/me');
  assert.equal(me.body.identified, true);
  assert.equal(me.body.username, 'ufuk');
  assert.deepEqual([me.body.review.look, me.body.review.ease, me.body.review.voice, me.body.review.comment], [5, null, 2, null]);
});

test('Öneri/görüş/şikayet: konu ve uzunluk doğrulanır', async () => {
  const c = await as(S.user);
  assert.equal((await c.post('/api/site-feedback/message', { kind: 'reklam', body: 'merhaba ekip' })).status, 400);
  assert.equal((await c.post('/api/site-feedback/message', { kind: 'sikayet', body: 'a' })).status, 400);
  const ok = await c.post('/api/site-feedback/message', { kind: 'sikayet', body: 'Ses odasında <b>yankı</b> var' });
  assert.equal(ok.status, 200, ok.text);
});

test('Sonuçları yalnızca admin ve üstü görür; mesaj ham metin olarak döner', async () => {
  assert.equal((await (await as(S.user)).get('/api/admin/site-feedback')).status, 403);
  const r = await (await as(S.admin)).get('/api/admin/site-feedback');
  assert.equal(r.status, 200, r.text);
  assert.equal(r.body.summary.count, 1);
  assert.equal(r.body.kinds.sikayet, 1);
  const msgs = (await (await as(S.admin)).get('/api/admin/site-feedback/messages')).body.messages;
  assert.equal(msgs[0].username, 'ufuk');
  assert.equal(msgs[0].body, 'Ses odasında <b>yankı</b> var');
});

test('Toplu bildirimi yalnızca kurucu gönderir; alıcı sayısı onayı ve 10 dakika koruması', async () => {
  const admin = await as(S.admin);
  assert.equal((await admin.get('/api/admin/team-broadcast')).status, 403);
  assert.equal((await admin.post('/api/admin/team-broadcast', { title: 'x', body: 'y', confirm_recipients: 3 })).status, 403);

  const f = await as(S.founder);
  const info = await f.get('/api/admin/team-broadcast');
  assert.equal(info.status, 200);
  assert.equal(info.body.sender, 'Sauran Geliştirici Ekibi');
  assert.equal(info.body.recipients, 3, 'askıdaki hesap sayılmamalı');

  const payload = { title: 'Yeni tasarımı nasıl buldun?', body: 'Puanlar mısın?', with_review_link: true, button_label: 'Değerlendir' };
  assert.equal((await f.post('/api/admin/team-broadcast', { ...payload, confirm_recipients: 99 })).status, 409);
  assert.equal((await f.post('/api/admin/team-broadcast', { ...payload, title: '  ', confirm_recipients: 3 })).status, 400);
  const userHttp = await as(S.user);
  const userSock = socket(srv.base, userHttp.cookie);
  await userSock.ready;
  const live = userSock.waitFor('notification_received', (p) => p && p.type === 'team_message');
  const sent = await f.post('/api/admin/team-broadcast', { ...payload, confirm_recipients: 3 });
  assert.equal(sent.status, 200, sent.text);
  const got = await live;
  userSock.close();
  assert.deepEqual(got.channels, { inapp: false, desktop: false, sound: false }, 'açılır kutu/ses yok; yalnızca panele düşer');
  assert.equal(got.data.title, payload.title);
  assert.equal(sent.body.recipients, 3);
  assert.equal((await f.post('/api/admin/team-broadcast', { ...payload, confirm_recipients: 3 })).status, 429, 'çift gönderim engellenmeli');
  assert.equal((await f.get('/api/admin/team-broadcast')).body.history.length, 1);
});

test('Bildirimde anahtar yok; düğmeye basınca 24 saatlik kişisel anahtar üretilir ve oturumsuz çalışır', async () => {
  const c = await as(S.user);
  const list = (await c.get('/api/notifications')).body.notifications;
  const n = list.find((x) => x.type === 'team_message');
  assert.ok(n, 'team_message bildirimi olmalı');
  assert.equal(n.data.sender, 'Sauran Geliştirici Ekibi');
  assert.equal(n.data.button_label, 'Değerlendir');
  assert.equal(n.data.link, '/degerlendirme.html', 'bildirim verisinde kişisel anahtar saklanmamalı');

  assert.equal((await client(srv.base).post('/api/site-feedback/link')).status, 401, 'oturumsuz anahtar üretilemez');
  const first = (await c.post('/api/site-feedback/link')).body.token;
  const token = (await c.post('/api/site-feedback/link')).body.token;
  assert.match(token, /^[A-Za-z0-9_-]{20,64}$/);
  assert.equal((await withToken(first, '/api/site-feedback/me')).body.identified, false, 'yeni anahtar eskisini geçersiz kılar');

  const me = await withToken(token, '/api/site-feedback/me');
  assert.equal(me.body.identified, true);
  assert.equal(me.body.username, 'ufuk');
  const saved = await withToken(token, '/api/site-feedback/review', { scores: { look: 3 } });
  assert.equal(saved.status, 200);
  assert.equal(saved.body.review.look, 3);

  // Tarayıcıda başka bir hesap açık olsa bile geçerli anahtarın sahibi esas alınır.
  const founderCookie = (await as(S.founder)).cookie;
  const mixed = await fetch(srv.base + '/api/site-feedback/me', { headers: { Cookie: founderCookie, 'X-Sauran-Review-Token': token } }).then((r) => r.json());
  assert.equal(mixed.username, 'ufuk');
});

test('Yönetim mesaj listesi: konu süzgeci ve sayfalama sunucuda', async () => {
  const c = await as(S.user);
  for (let i = 0; i < 3; i++) assert.equal((await c.post('/api/site-feedback/message', { kind: 'oneri', body: 'öneri numara ' + i })).status, 200);
  const a = await as(S.admin);
  const p1 = await a.get('/api/admin/site-feedback/messages?kind=oneri&limit=2');
  assert.equal(p1.status, 200);
  assert.equal(p1.body.messages.length, 2);
  assert.equal(p1.body.has_more, true);
  assert.ok(p1.body.messages.every((m) => m.kind === 'oneri'));
  const p2 = await a.get('/api/admin/site-feedback/messages?kind=oneri&limit=2&before_id=' + p1.body.messages[1].id);
  assert.equal(p2.body.messages.length, 1);
  assert.equal(p2.body.has_more, false);
  assert.equal((await c.get('/api/admin/site-feedback/messages')).status, 403);
});

test('Verilerimi İndir değerlendirme ve mesajları içerir', async () => {
  const c = await as(S.user);
  const r = await c.get('/api/account/export');
  assert.equal(r.status, 200);
  const data = r.body.data || r.body;
  assert.equal(data.site_reviews.length, 1);
  assert.equal(data.site_messages.length, 4);
});
