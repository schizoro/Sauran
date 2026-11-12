'use strict';
// Ölçüm (test değil): içinde 5 × 20 MB video olan bir lobinin mesaj sayfasını 3 kullanıcı aynı anda açınca sunucunun
// bellek tepesi ve yanıt boyutu. Kullanım (Windows): node tests/bench-media-memory.js
const { spawnSync } = require('child_process');
const { startServer, client, makeUser } = require('./helpers');

// index.js çalıştıran node süreçlerinin ömür boyu bellek tepesi (MB)
function serverPeaks() {
  const ps = "Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | ForEach-Object { '{0}|{1}|{2}' -f $_.ProcessId, $_.PeakWorkingSetSize, $_.CommandLine }";
  const out = spawnSync('powershell', ['-NoProfile', '-Command', ps], { encoding: 'utf8' }).stdout || '';
  return out.split(/\r?\n/).filter((l) => /index\.js/.test(l)).map((l) => {
    const [pid, kb] = l.split('|');
    return { pid: Number(pid), peak_mb: Math.round(Number(kb) / 1024) };
  });
}

(async () => {
  const VIDEO = Buffer.alloc(20 * 1024 * 1024, 3);
  const before = new Set(serverPeaks().map((p) => p.pid));
  const srv = await startServer((dbm) => {
    const users = ['bena', 'benb', 'benc'].map((n) => makeUser(dbm, n));
    const h = dbm.createHub(users[0].id, { name: 'Bench', type: 'hub' });
    const hubId = h.id || (h.hub && h.hub.id);
    const inv = dbm.createHubInvite(hubId, users[0].id, {});
    users.slice(1).forEach((u) => dbm.joinHubByCode(inv.code || (inv.invite && inv.invite.code), u.id));
    const payload = JSON.stringify({ data: `data:video/mp4;base64,${VIDEO.toString('base64')}`, name: 'v.mp4', mime: 'video/mp4', size: VIDEO.length });
    const ch = dbm.db.prepare(`SELECT id FROM hub_channels WHERE hub_id = ? ORDER BY id LIMIT 1`).get(hubId);
    for (let i = 0; i < 5; i++) {
      dbm.db.prepare(`INSERT INTO messages (user_id, username, content, room, hub_id, channel_id, kind, payload) VALUES (?, ?, '', ?, ?, ?, 'video', ?)`)
        .run(users[0].id, 'bena', `hub_${hubId}`, hubId, ch ? ch.id : null, payload);
    }
    return { hubId };
  });
  try {
    const mine = () => serverPeaks().filter((p) => !before.has(p.pid));
    const idle = mine();
    const cs = [];
    for (const n of ['bena', 'benb', 'benc']) { const c = client(srv.base); await c.login(n, 'Passw0rd!x'); cs.push(c); }
    const t0 = Date.now();
    const res = await Promise.all(cs.map((c) => c.get(`/api/hubs/${srv.seeded.hubId}/messages`)));
    const ms = Date.now() - t0;
    console.log(JSON.stringify({
      status: res.map((r) => r.status),
      videos_in_page: res[0].body && res[0].body.messages ? res[0].body.messages.filter((m) => m.kind === 'video').length : null,
      response_mb: res.map((r) => +(r.text.length / 1048576).toFixed(2)),
      total_ms: ms,
      server_peak_mb_idle: idle.map((p) => p.peak_mb),
      server_peak_mb_after: mine().map((p) => p.peak_mb)
    }));
    // Medya adresleri: 3 kullanıcı 5 videonun hepsini aynı anda tamamen indirir (15 × 20 MB)
    const urls = (res[0].body.messages || []).filter((m) => m.payload && m.payload.url).map((m) => m.payload.url);
    if (urls.length) {
      const t1 = Date.now();
      const got = await Promise.all(cs.flatMap((c) => urls.map(async (u) => {
        let r = await fetch(srv.base + u, { headers: { Cookie: c.cookie } });
        while (r.status === 503) { await new Promise((ok) => setTimeout(ok, 300)); r = await fetch(srv.base + u, { headers: { Cookie: c.cookie } }); }
        return (await r.arrayBuffer()).byteLength;
      })));
      console.log(JSON.stringify({ media_downloads: got.length, each_mb: +(got[0] / 1048576).toFixed(1), all_ok: got.every((n) => n === VIDEO.length), media_ms: Date.now() - t1, server_peak_mb_after_media: mine().map((p) => p.peak_mb) }));
    }
  } finally {
    await srv.stop();
  }
})();
