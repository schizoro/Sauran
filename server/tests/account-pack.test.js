'use strict';
// Hesap durumu ve veri dışa aktarmada kategori seçimi.
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, client, makeUser } = require('./helpers');

let srv, S;
test.before(async () => {
  srv = await startServer((d) => {
    const a = makeUser(d, 'durum'); const r = makeUser(d, 'bildiren');
    const h = d.createHub(r.id, { name: 'Durum Lobisi', type: 'hub' });
    const hubId = h.id || (h.hub && h.hub.id);
    d.db.prepare(`INSERT INTO hub_bans (hub_id, user_id, banned_by) VALUES (?, ?, ?)`).run(hubId, a.id, r.id);
    d.db.prepare(`INSERT INTO reports (reporter_user_id, target_type, target_id, reason, status, reviewed_at) VALUES (?, 'user', ?, 'spam', 'action_taken', datetime('now'))`).run(r.id, a.id);
    d.db.prepare(`INSERT INTO reports (reporter_user_id, target_type, target_id, reason, status) VALUES (?, 'user', ?, 'hate', 'dismissed')`).run(r.id, a.id);
    return { a: a.id };
  });
  S = srv.seeded;
});
test.after(async () => { if (srv) await srv.stop(); });

test('Hesap durumu: yalnızca işlem yapılmış bildirimler ve lobi yasakları; bildiren gizli', async () => {
  const c = client(srv.base); await c.login('durum', 'Passw0rd!x');
  const r = await c.get('/api/me/standing');
  assert.equal(r.status, 200);
  assert.equal(r.body.status, 'limited');
  assert.equal(r.body.violations.length, 1, 'reddedilen bildirim sayılmaz');
  assert.equal(r.body.violations[0].reason, 'spam');
  assert.ok(!JSON.stringify(r.body).includes('bildiren'), 'bildirenin adı yok');
  assert.equal(r.body.hub_bans[0].hub_name, 'Durum Lobisi');
  assert.equal((await client(srv.base).get('/api/me/standing')).status, 401);
});

test('Veri dışa aktarma: seçilen kategoriler; bilinmeyen kategori yok sayılır; boşsa hepsi', async () => {
  const c = client(srv.base); await c.login('durum', 'Passw0rd!x');
  const part = (await c.get('/api/account/export?parts=account,bogus')).body;
  assert.deepEqual(part.included_categories, ['account']);
  assert.ok(part.profile && part.account && part.privacy, 'hesap kategorisi');
  assert.equal(part.messages, undefined, 'mesajlar istenmedi');
  const all = (await c.get('/api/account/export')).body;
  assert.ok(all.messages && all.friendships && all.ignored_users && all.dm_requests, 'hepsi');
});
