'use strict';
// Disk dolu: yükleme açık bir hata mesajıyla reddedilir, diskte yarım dosya kalmaz; taşıma kendiliğinden durur.
// (Rezerv olarak çok büyük bir değer verilerek "disk dolu" durumu taklit edilir.)
process.env.MEDIA_UPLOAD_RESERVE_MB = String(1024 * 1024 * 1024); // 1 PB
process.env.MEDIA_MIGRATION_MIN_FREE_MB = String(1024 * 1024 * 1024);
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { startServer, client, makeUser } = require('./helpers');

let srv, S;
test.before(async () => {
  srv = await startServer((dbm) => {
    const a = makeUser(dbm, 'dolua'); const b = makeUser(dbm, 'dolub'); const adm = makeUser(dbm, 'doluadm', { role: 'admin' });
    dbm.sendFriendRequest(b.id, a.id); dbm.respondFriendRequest(a.id, b.id, true);
    const room = a.id < b.id ? `dm_${a.id}_${b.id}` : `dm_${b.id}_${a.id}`;
    dbm.db.prepare(`INSERT INTO messages (user_id, username, content, room, to_user_id, kind, payload) VALUES (?, 'dolua', '', ?, ?, 'dm_image', ?)`)
      .run(a.id, room, b.id, JSON.stringify({ data: `data:image/png;base64,${Buffer.alloc(6000, 1).toString('base64')}`, name: 'e.png', mime: 'image/png', size: 6000 }));
    return { a: a.id, b: b.id };
  });
  S = srv.seeded;
});
test.after(async () => { if (srv) await srv.stop(); });

async function login(name) { const c = client(srv.base); assert.equal((await c.login(name, 'Passw0rd!x')).status, 200); return c; }

test('Disk dolu: yükleme reddedilir, yarım dosya kalmaz; taşıma durur', async () => {
  const a = await login('dolua');
  const r = await a.post(`/api/dm/${S.b}/file`, { file: { data: `data:image/png;base64,${Buffer.alloc(5000, 2).toString('base64')}`, name: 'x.png', mime: 'image/png', size: 5000 } });
  assert.equal(r.status, 400, r.text);
  assert.match(r.body.error, /yer kalmadı/);
  const root = path.join(srv.dataDir, 'media');
  const files = fs.existsSync(root) ? fs.readdirSync(root).flatMap((d) => fs.readdirSync(path.join(root, d))) : [];
  assert.equal(files.length, 0, 'diskte dosya ya da yarım dosya yok');

  const adm = await login('doluadm');
  assert.equal((await adm.post('/api/admin/storage', { action: 'migrate_start' })).status, 200);
  let h;
  for (let i = 0; i < 50; i++) {
    h = (await adm.get('/api/admin/server-health')).body;
    if (h.migration.state !== 'running') break;
    await new Promise((ok) => setTimeout(ok, 100));
  }
  assert.equal(h.migration.state, 'disk_low');
  assert.equal(h.storage.inline_count, 1, 'gömülü dosya yerinde kaldı');
});
