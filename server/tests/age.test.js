'use strict';
// Eski hesaplara bir kerelik doğum tarihi sorusu ve yöneticinin "18 yaş altı" işareti.
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, client, makeUser } = require('./helpers');

let srv, S;
test.before(async () => {
  srv = await startServer((dbm) => {
    const legacy = (name) => {
      const u = makeUser(dbm, name);
      dbm.db.prepare(`UPDATE users SET age_declared = 0, created_at = '2026-08-01 10:00:00' WHERE id = ?`).run(u.id);
      return u;
    };
    const eski = legacy('eskihesap');     // yetişkin olduğunu beyan edecek
    const genc = legacy('eskigenc');      // 15 yaşında olduğunu beyan edecek
    const kucuk = legacy('eskikucuk');    // 11 yaşında → askıya alınır
    const yeni = makeUser(dbm, 'yenihesap');
    const adm = makeUser(dbm, 'ageadmin', { role: 'admin' });
    const kur = makeUser(dbm, 'agekurucu', { role: 'founder' });
    const sikayet = makeUser(dbm, 'sikayetli');
    const pol = legacy('politikasiz'); // politika güncellemesini henüz kabul etmemiş eski hesap
    dbm.db.prepare(`UPDATE users SET policy_version = NULL WHERE id = ?`).run(pol.id);
    const pol2 = makeUser(dbm, 'politikasiz2'); // sunucu engeli testi
    dbm.db.prepare(`UPDATE users SET policy_version = NULL WHERE id = ?`).run(pol2.id);
    // geçiş süresi bitmiş say: sunucu engeli etkin
    dbm.db.prepare(`UPDATE app_meta SET value = '2000-01-01T00:00:00.000Z' WHERE key LIKE 'policy_enforce_at:%'`).run();
    return { eski: eski.id, genc: genc.id, kucuk: kucuk.id, yeni: yeni.id, adm: adm.id, kur: kur.id, sikayet: sikayet.id };
  });
  S = srv.seeded;
});
test.after(async () => { if (srv) await srv.stop(); });

async function login(name) {
  const c = client(srv.base);
  assert.equal((await c.login(name, 'Passw0rd!x')).status, 200);
  return c;
}
const birthForAge = (age) => { const d = new Date(); d.setFullYear(d.getFullYear() - age); d.setDate(d.getDate() - 10); return d.toISOString().slice(0, 10); };

test('Eski hesaba sorulur, yeni hesaba sorulmaz; yetişkin beyanı bir kez kaydedilir', async () => {
  const eski = await login('eskihesap');
  assert.equal((await eski.get('/api/me')).body.user.needs_age, true);
  const yeni = await login('yenihesap');
  assert.equal((await yeni.get('/api/me')).body.user.needs_age, false);
  assert.equal((await yeni.post('/api/profile/age', { birth_date: birthForAge(30) })).status, 409, 'zaten beyanlı hesap tekrar beyan edemez');

  assert.equal((await eski.post('/api/profile/age', { birth_date: 'saçma' })).status, 400);
  const r = await eski.post('/api/profile/age', { birth_date: birthForAge(25) });
  assert.equal(r.status, 200);
  assert.equal(r.body.minor, false);
  assert.equal((await eski.get('/api/me')).body.user.needs_age, false);
  assert.equal((await eski.post('/api/profile/age', { birth_date: birthForAge(15) })).status, 409, 'sonradan yaş değiştirilemez');
});

test('15 yaş beyanı: 18 yaş altı korumaları uygulanır', async () => {
  const genc = await login('eskigenc');
  const r = await genc.post('/api/profile/age', { birth_date: birthForAge(15) });
  assert.equal(r.body.minor, true);
  const p = (await genc.get('/api/privacy')).body;
  assert.equal(p.friend_requests.everyone, false);
  assert.notEqual(p.avatar_visibility, 'public');
});

test('13 yaş altı beyanı: hesap askıya alınır ve oturum kapanır', async () => {
  const k = await login('eskikucuk');
  const r = await k.post('/api/profile/age', { birth_date: birthForAge(11) });
  assert.equal(r.body.suspended, true);
  assert.equal((await k.get('/api/me')).status, 401, 'oturum kapandı');
  const relog = await client(srv.base).login('eskikucuk', 'Passw0rd!x');
  assert.notEqual(relog.status, 200, 'askıdaki hesap giriş yapamaz');
  // Kurucu askıyı kaldırsa bile hesap 18 yaş altı korumalarıyla kalır
  const kur = await login('agekurucu');
  assert.equal((await kur.patch(`/api/admin/users/${S.kucuk}/unsuspend`, { internal_reason: 'itiraz' })).status, 200);
  assert.equal((await kur.get(`/api/admin/users/${S.kucuk}`)).body.account.is_minor, true);
});

test('Yönetici: tahmini yaşla 18 yaş altı işaretler, gerekçe zorunlu, kaldırabilir; normal kullanıcı yapamaz', async () => {
  const adm = await login('ageadmin');
  assert.equal((await adm.patch(`/api/admin/users/${S.sikayet}/minor`, { age: 15 })).status, 400, 'gerekçe zorunlu');
  assert.equal((await adm.patch(`/api/admin/users/${S.sikayet}/minor`, { age: 12, internal_reason: 'x' })).status, 400, '13-17 dışı reddedilir');
  const r = await adm.patch(`/api/admin/users/${S.sikayet}/minor`, { age: 15, internal_reason: 'Şikâyet: okul öğrencisi olduğunu yazdı' });
  assert.equal(r.status, 200);
  assert.ok(r.body.minor_until > new Date().toISOString().slice(0, 10));
  const d = await adm.get(`/api/admin/users/${S.sikayet}`);
  assert.equal(d.body.account.is_minor, true);
  const sik = await login('sikayetli');
  assert.equal((await sik.get('/api/privacy')).body.friend_requests.everyone, false);

  assert.equal((await adm.patch(`/api/admin/users/${S.sikayet}/minor`, { internal_reason: 'yaş yok' })).status, 400, 'yaş alanı olmadan işaret kaldırılamaz');
  assert.equal((await adm.patch(`/api/admin/users/${S.sikayet}/minor`, { age: '15', internal_reason: 'metin yaş' })).status, 400);
  assert.equal((await adm.patch(`/api/admin/users/${S.sikayet}/minor`, { age: null, internal_reason: 'Yanlış işaret' })).status, 403, 'yönetici kaldıramaz');
  assert.equal((await adm.patch(`/api/admin/users/${S.kur}/minor`, { age: 15, internal_reason: 'x' })).status, 400, 'kurucu işaretlenemez');
  const kur = await login('agekurucu');
  assert.equal((await kur.patch(`/api/admin/users/${S.sikayet}/minor`, { age: null, internal_reason: 'Yanlış işaret' })).status, 200, 'kurucu kaldırır');
  assert.equal((await adm.get(`/api/admin/users/${S.sikayet}`)).body.account.is_minor, false);

  const normal = await login('yenihesap');
  assert.equal((await normal.patch(`/api/admin/users/${S.sikayet}/minor`, { age: 15, internal_reason: 'x' })).status, 403);
});

test('Politika güncellemesi: kabul edilmeden yaş beyanı yapılamaz; kabul sürümü kaydeder, sonra yaş sorulur', async () => {
  const c = await login('politikasiz');
  let me = (await c.get('/api/me')).body.user;
  assert.equal(me.needs_policy, true);
  assert.equal(me.needs_age, true);
  // Bu dosyada sunucu engeli etkin: önce 428 (engel), engel kapalıyken de 409 (declareAge kontrolü) döner.
  assert.ok([409, 428].includes((await c.post('/api/profile/age', { birth_date: birthForAge(30) })).status), 'önce politika');
  assert.equal((await c.post('/api/policy/accept')).status, 200);
  me = (await c.get('/api/me')).body.user;
  assert.equal(me.needs_policy, false);
  assert.equal((await c.post('/api/profile/age', { birth_date: birthForAge(30) })).status, 200);
  const yeni = await login('yenihesap');
  assert.equal((await yeni.get('/api/me')).body.user.needs_policy, false, 'yeni kayıt güncel sürümü kabul etmiş sayılır');
  assert.equal((await client(srv.base).post('/api/policy/accept')).status, 401);
});

test('Geçiş süresinden sonra sunucu engeli: kabul edilmeden yalnızca izinli uç noktalar çalışır', async () => {
  const c = await login('politikasiz2');
  assert.equal((await c.get('/api/me')).status, 200, 'oturum bilgisi açık');
  const blocked = await c.get('/api/friends');
  assert.equal(blocked.status, 428);
  assert.equal(blocked.body.code, 'policy_required');
  assert.equal((await c.get('/api/account/export')).status, 200, 'veri indirme açık');
  assert.equal((await c.post('/api/policy/accept')).status, 200);
  assert.equal((await c.get('/api/friends')).status, 200, 'kabulden sonra açılır');
});
