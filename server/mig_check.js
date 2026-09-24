// Migration vekil testi: "üretimin önceki şeması" -> HEAD kodu. Üretim DB'sine DOKUNMAZ.
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { spawn, execSync } = require('child_process');
const D = require('better-sqlite3');

const SP = process.argv[2];
const root = path.join(__dirname, '..');
const dbDir = path.join(SP, 'migdb');
const stg = path.join(__dirname, '_stg');
fs.rmSync(dbDir, { recursive: true, force: true }); fs.mkdirSync(dbDir, { recursive: true });
fs.rmSync(stg, { recursive: true, force: true }); fs.mkdirSync(stg);
const H = execSync('git rev-parse origin/main', { cwd: root }).toString().trim();
for (const f of ['db.js', 'index.js', 'daily.js', 'mailer.js', 'push.js']) fs.writeFileSync(path.join(stg, f), execSync(`git show ${H}:server/${f}`, { cwd: root, maxBuffer: 1e9 }));
console.log('Code under test = origin/main', H.slice(0, 7));

// 1) eski şemayı kur
fs.copyFileSync(path.join(root, 'data', 'sauran.db'), path.join(dbDir, 'sauran.db'));
const dbp = path.join(dbDir, 'sauran.db');
let db = new D(dbp); db.exec('REINDEX');
db.pragma('foreign_keys = OFF');
db.exec('DROP TRIGGER IF EXISTS admin_audit_log_no_update; DROP TRIGGER IF EXISTS admin_audit_log_no_delete; DROP INDEX IF EXISTS idx_admin_audit_created; DROP INDEX IF EXISTS idx_admin_audit_target; DROP INDEX IF EXISTS idx_admin_audit_actor; DROP INDEX IF EXISTS idx_admin_audit_action; DROP TABLE IF EXISTS admin_audit_log;');
for (const c of ['account_status', 'suspended_at', 'suspended_by', 'suspension_user_reason']) db.exec(`ALTER TABLE users DROP COLUMN ${c}`);

// 2) gerçekçi veri (yalnızca eski şemadaki kolonlarla)
const hp = (pw) => { const salt = crypto.randomBytes(16).toString('hex'); return [crypto.scryptSync(pw, salt, 64).toString('hex'), salt]; };
const ins = db.prepare(`INSERT INTO users (username,email,password_hash,password_salt,birth_date,avatar_visibility,terms_accepted_at,platform_role,about_me,dev_notice_seen)
  VALUES (?,?,?,?,'1999-05-05','public',CURRENT_TIMESTAMP,?,?,?)`);
const ids = [];
for (let i = 1; i <= 40; i++) { const [h, s] = hp('x' + i); ids.push(ins.run('mg_u' + i, `mg_u${i}@example.com`, h, s, i === 1 ? 'founder' : i <= 3 ? 'admin' : i === 4 ? 'moderator' : 'user', 'hakkımda ' + i, i % 2).lastInsertRowid); }
for (let h = 0; h < 5; h++) {
  const hid = db.prepare("INSERT INTO hubs (name,created_by,type) VALUES (?,?,'public')").run('MgHub' + h, ids[h]).lastInsertRowid;
  db.prepare("INSERT INTO hub_members (hub_id,user_id,permission_tier) VALUES (?,?,'owner')").run(hid, ids[h]);
  for (let m = 5; m < 15; m++) db.prepare("INSERT OR IGNORE INTO hub_members (hub_id,user_id,permission_tier) VALUES (?,?,'member')").run(hid, ids[m]);
  for (let k = 0; k < 30; k++) db.prepare("INSERT INTO messages (user_id,username,content,room,hub_id,kind) VALUES (?,?,?,?,?,'text')").run(ids[5 + (k % 10)], 'mg_u' + (6 + (k % 10)), 'mesaj ' + k, 'hub_' + hid, hid);
}
for (let f = 5; f < 25; f += 2) { const [lo, hi] = [ids[f], ids[f + 1]].sort((a, b) => a - b); db.prepare("INSERT INTO friendships (user_low,user_high,status,requested_by) VALUES (?,?,'accepted',?)").run(lo, hi, ids[f]);
  db.prepare("INSERT INTO messages (user_id,username,content,room,to_user_id,kind) VALUES (?,?,?,?,?,'dm')").run(ids[f], 'x', 'dm', `dm_${lo}_${hi}`, ids[f + 1]); }
for (let n = 0; n < 15; n++) db.prepare("INSERT INTO notifications (user_id,type,data) VALUES (?,?,?)").run(ids[10 + (n % 10)], 'friend_request', '{"from_username":"a"}');
const rp = db.prepare("INSERT INTO reports (reporter_user_id,target_type,target_id,reason,status) VALUES (?,'user',?,'spam','new')").run(ids[20], ids[21]).lastInsertRowid;
db.prepare("INSERT INTO moderation_actions (report_id,moderator_id,action,reason) VALUES (?,?,'note','n')").run(rp, ids[3]);
for (let s = 0; s < 6; s++) db.prepare("INSERT INTO sessions (user_id,token_hash,expires_at) VALUES (?,?,?)").run(ids[s], crypto.randomBytes(16).toString('hex'), new Date(Date.now() + 86400000).toISOString());
db.prepare("INSERT INTO password_resets (user_id,code,expires_at) VALUES (?,?,?)").run(ids[30], '111111', new Date(Date.now() + 600000).toISOString());
db.pragma('foreign_keys = ON'); db.close();

// 3) anlık görüntü: DDL + satır sayıları + her tablo için eski kolonlar üzerinden özet
function snap(p, colsOnly) {
  const d = new D(p, { readonly: true });
  const tables = d.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map((r) => r.name);
  const out = { tables: {}, ddl: {}, integrity: d.pragma('integrity_check', { simple: true }), fk: d.pragma('foreign_key_check').length };
  for (const t of tables) {
    const cols = d.prepare(`PRAGMA table_info(${t})`).all().map((c) => c.name);
    const use = colsOnly && colsOnly[t] ? colsOnly[t] : cols;
    const rows = d.prepare(`SELECT ${use.map((c) => `"${c}"`).join(',')} FROM "${t}" ORDER BY rowid`).all();
    out.tables[t] = { count: rows.length, cols, hash: crypto.createHash('sha1').update(JSON.stringify(rows)).digest('hex').slice(0, 12) };
  }
  for (const r of d.prepare("SELECT type,name,sql FROM sqlite_master WHERE sql IS NOT NULL ORDER BY name").all()) out.ddl[r.type + ':' + r.name] = r.sql;
  d.close();
  return out;
}
const before = snap(dbp); const uB = new D(dbp,{readonly:true}).prepare('select * from users order by rowid').all();
const oldCols = Object.fromEntries(Object.entries(before.tables).map(([t, v]) => [t, v.cols]));

// 4) HEAD kodunu aç (iki kez)
async function boot() {
  const env = { ...process.env, DATA_DIR: dbDir, PORT: '3011' };
  const child = spawn(process.execPath, ['index.js'], { cwd: stg, env });
  let log = '';
  child.stdout.on('data', (d) => (log += d)); child.stderr.on('data', (d) => (log += d));
  const t0 = Date.now();
  while (!/Sauran sunucusu çalışıyor/.test(log) && Date.now() - t0 < 20000 && child.exitCode === null) await new Promise((r) => setTimeout(r, 200));
  const started = /Sauran sunucusu çalışıyor/.test(log);
  const probe = started ? (await fetch('http://localhost:3011/api/me').then((r) => r.status).catch(() => 0)) : 0;
  child.kill();
  await new Promise((r) => setTimeout(r, 800));
  return { started, probe, errors: (log.match(/Error|SqliteError/g) || []).length, log };
}

(async () => {
  const b1 = await boot();
  const after1 = snap(dbp, oldCols);
  const b2 = await boot();
  const after2 = snap(dbp, oldCols);
  const res = [];
  const chk = (n, c, x) => { res.push(c); console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? '  ' + x : '')); };

  chk('OLD-schema DB has no audit table / suspension columns before boot', !before.ddl['table:admin_audit_log'] && !before.tables.users.cols.includes('account_status'));
  chk('boot #1 on old-schema DB: server started, no SQL errors, /api/me -> 401', b1.started && b1.errors === 0 && b1.probe === 401, `started=${b1.started} errors=${b1.errors} probe=${b1.probe}`);
  chk('boot #2 (idempotency): started, no errors', b2.started && b2.errors === 0 && b2.probe === 401);
  const added = Object.keys(after1.ddl).filter((k) => !(k in before.ddl));
  const changed = Object.keys(before.ddl).filter((k) => k in after1.ddl && before.ddl[k] !== after1.ddl[k]);
  const removed = Object.keys(before.ddl).filter((k) => !(k in after1.ddl));
  console.log('  schema ADDED  :', added.join(', '));
  console.log('  schema CHANGED:', changed.join(', ') || '(none)');
  console.log('  schema REMOVED:', removed.join(', ') || '(none)');
  chk('migration only ADDS objects (audit table, 4 indexes, 2 triggers) — nothing removed', removed.length === 0 && added.filter((k) => /admin_audit/.test(k)).length === 7);
  chk('users table CHANGED only by the 4 new columns (ALTER TABLE ADD COLUMN)', changed.every((k) => k === 'table:users') && ['account_status', 'suspended_at', 'suspended_by', 'suspension_user_reason'].every((c) => after1.tables.users.cols.includes(c)) && after1.tables.users.cols.length === before.tables.users.cols.length + 4);
  const diffCounts = Object.keys(before.tables).filter((t) => before.tables[t].count !== after1.tables[t].count);
  chk('row counts identical for EVERY pre-existing table', diffCounts.length === 0, diffCounts.join(','));
  const diffHash = Object.keys(before.tables).filter((t) => before.tables[t].hash !== after1.tables[t].hash);
  chk('row CONTENTS identical for every pre-existing table (old columns checksum)', diffHash.length === 0, diffHash.join(','));
  const n = new D(dbp, { readonly: true }); { const uA = n.prepare('select * from users order by rowid').all(); const dc = new Set(); uB.forEach((r,i)=>{ for (const k in r) if (r[k] !== uA[i][k]) dc.add(k+': '+String(r[k]).slice(0,25)+' -> '+String(uA[i][k]).slice(0,25)); }); console.log('  users diff cols:', [...dc].slice(0,8)); }
  chk('all existing users defaulted to account_status=active, no suspension data', n.prepare("SELECT COUNT(*) c FROM users WHERE account_status='active' AND suspended_at IS NULL AND suspended_by IS NULL AND suspension_user_reason IS NULL").get().c === 43 && n.prepare("SELECT COUNT(*) c FROM users WHERE account_status<>'active'").get().c === 0);
  chk('audit table exists and is empty after migration', n.prepare('SELECT COUNT(*) c FROM admin_audit_log').get().c === 0);
  n.close();
  chk('DB integrity_check ok and foreign_key_check clean after migration', after1.integrity === 'ok' && after1.fk === 0);
  chk('second boot changed nothing (schema + data identical to first boot)', JSON.stringify(after1.ddl) === JSON.stringify(after2.ddl) && Object.keys(after1.tables).every((t) => after1.tables[t].count === after2.tables[t].count && after1.tables[t].hash === after2.tables[t].hash));
  console.log(`\nMIGRATION PROXY: ${res.filter(Boolean).length}/${res.length} passed`);
  fs.rmSync(stg, { recursive: true, force: true });
  process.exit(res.every(Boolean) ? 0 : 1);
})();
