'use strict';
// Profil efektleri: yeni sahne efektleri (2026-11-14) sunucu izin listesinde; Plus kilidi ve geçersiz değer reddi korunur.
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, client, makeUser } = require('./helpers');

let srv;
test.before(async () => {
  srv = await startServer((dbm) => {
    const plus = makeUser(dbm, 'pfxplus');
    makeUser(dbm, 'pfxfree');
    // Profil efekti hakkı (hediye edilmiş gibi): Plus abonesi olmadan yalnızca bu özellik açılır
    dbm.db.prepare(`INSERT INTO entitlements (user_id, product, expires_at) VALUES (?, 'profile_effect', NULL)`).run(plus.id);
    return {};
  });
});
test.after(async () => { if (srv) await srv.stop(); });

async function login(name) {
  const c = client(srv.base);
  assert.equal((await c.login(name, 'Passw0rd!x')).status, 200);
  return c;
}

test('Yeni sahne efektleri seçilebilir ve /api/me ile geri gelir', async () => {
  const c = await login('pfxplus');
  for (const fx of ['catparty', 'neon', 'koi', 'astral', 'cherry']) {
    const r = await c.patch('/api/profile/effect', { profile_effect: fx });
    assert.equal(r.status, 200);
    assert.equal(r.body.profile_effect, fx);
    assert.equal((await c.get('/api/me')).body.user.profile_effect, fx);
  }
});

test('Eski efektler çalışmaya devam eder', async () => {
  const c = await login('pfxplus');
  for (const fx of ['sakura', 'stagelights', 'flame', 'ink', 'storm', 'sweet', 'none']) {
    assert.equal((await c.patch('/api/profile/effect', { profile_effect: fx })).body.profile_effect, fx);
  }
});

test('Geçersiz efekt adı reddedilir', async () => {
  const c = await login('pfxplus');
  for (const fx of ['kedi-partisi', '<script>', 'CATPARTY', '']) {
    const r = await c.patch('/api/profile/effect', { profile_effect: fx });
    if (fx === '') { assert.equal(r.body.profile_effect, 'none'); continue; } // boş = efekti kaldır
    assert.equal(r.body.success, false);
  }
});

test('Hakkı olmayan kullanıcı yeni efekti seçemez', async () => {
  const c = await login('pfxfree');
  const r = await c.patch('/api/profile/effect', { profile_effect: 'catparty' });
  assert.equal(r.body.success, false);
  assert.equal((await c.get('/api/me')).body.user.profile_effect, 'none');
});
