'use strict';
// Sessiz saatler ve lobi bildirim seviyesi (Tümü / @Bahsetmeler / Hiç).
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, client, makeUser, socket } = require('./helpers');

let srv, S, dbm;
test.before(async () => {
  srv = await startServer((d) => {
    const a = makeUser(d, 'sahip'); const b = makeUser(d, 'uye');
    const h = d.createHub(a.id, { name: 'Bildirim Lobisi', type: 'hub' });
    const hubId = h.id || (h.hub && h.hub.id);
    const inv = d.createHubInvite(hubId, a.id, {});
    d.joinHubByCode(inv.code || (inv.invite && inv.invite.code), b.id);
    return { hubId, a: a.id, b: b.id };
  });
  S = srv.seeded;
  dbm = require('../db.js');
});
test.after(async () => { if (srv) await srv.stop(); });

test('inQuietHours: gece yarısını aşan aralık ve saat dilimi', () => {
  const p = { quiet_enabled: 1, quiet_start: 23 * 60, quiet_end: 8 * 60, quiet_tz: 'UTC' };
  assert.equal(dbm.inQuietHours(p, new Date('2026-11-13T23:30:00Z')), true);
  assert.equal(dbm.inQuietHours(p, new Date('2026-11-14T07:59:00Z')), true);
  assert.equal(dbm.inQuietHours(p, new Date('2026-11-14T08:00:00Z')), false);
  assert.equal(dbm.inQuietHours(p, new Date('2026-11-14T12:00:00Z')), false);
  assert.equal(dbm.inQuietHours({ ...p, quiet_tz: 'Europe/Istanbul' }, new Date('2026-11-13T20:30:00Z')), true, 'İstanbul 23:30');
  assert.equal(dbm.inQuietHours({ ...p, quiet_enabled: 0 }, new Date('2026-11-13T23:30:00Z')), false);
  const day = { quiet_enabled: 1, quiet_start: 9 * 60, quiet_end: 17 * 60, quiet_tz: 'UTC' };
  assert.equal(dbm.inQuietHours(day, new Date('2026-11-13T10:00:00Z')), true);
  assert.equal(dbm.inQuietHours(day, new Date('2026-11-13T18:00:00Z')), false);
});

test('Sessiz saat ayarı kaydedilir; geçersiz değerler yok sayılır', async () => {
  const c = client(srv.base);
  await c.login('uye', 'Passw0rd!x');
  const r = await c.patch('/api/notifications/quiet-hours', { quiet_enabled: true, quiet_start: 1380, quiet_end: 480, quiet_tz: 'Europe/Istanbul' });
  assert.equal(r.status, 200);
  assert.equal(r.body.preferences.quiet_enabled, 1);
  const bad = await c.patch('/api/notifications/quiet-hours', { quiet_start: 5000, quiet_tz: 'Mars/Olympus' });
  assert.equal(bad.body.preferences.quiet_start, 1380);
  assert.equal(bad.body.preferences.quiet_tz, 'Europe/Istanbul');
  await c.patch('/api/notifications/quiet-hours', { quiet_enabled: false });
});

test('Lobi bildirim seviyesi: "Hiç" seçince @bahsetme bildirimi de gelmez; "@Bahsetmeler" seçince gelir', async () => {
  const a = client(srv.base); await a.login('sahip', 'Passw0rd!x');
  const b = client(srv.base); await b.login('uye', 'Passw0rd!x');
  assert.equal((await b.patch(`/api/hubs/${S.hubId}/notify-level`, { level: 'bogus' })).status, 400);
  assert.equal((await b.patch(`/api/hubs/${S.hubId}/notify-level`, { level: 'none' })).status, 200);
  assert.equal((await b.get(`/api/hubs/${S.hubId}`)).body.hub?.my_notify_level ?? (await b.get(`/api/hubs/${S.hubId}`)).body.my_notify_level, 'none');
  const sa = socket(srv.base, a.cookie); await sa.ready;
  const sb = socket(srv.base, b.cookie); await sb.ready;
  sa.emit('join_hub', S.hubId); sb.emit('join_hub', S.hubId);
  await new Promise((r) => setTimeout(r, 200));
  const before = (await b.get('/api/notifications')).body.notifications.length;
  sa.emit('hub_chat_message', { hub_id: S.hubId, content: '@uye selam' });
  assert.ok(await sb.expectNone('hub_mention', () => true, 600), '"Hiç": bahsetme gelmez');
  assert.equal((await b.get('/api/notifications')).body.notifications.length, before);
  assert.equal((await b.patch(`/api/hubs/${S.hubId}/notify-level`, { level: 'mentions' })).status, 200);
  const got = sb.waitFor('hub_mention', () => true, 3000);
  sa.emit('hub_chat_message', { hub_id: S.hubId, content: '@uye tekrar' });
  await got;
  [sa, sb].forEach((x) => x.close());
});
