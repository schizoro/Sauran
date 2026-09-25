// Manuel yedek aracı + yedek yaşam döngüsü (Aşama 18).
//
// Uygulama HİÇBİR yedeği kendiliğinden ALMAZ (otomatik yedek, kişisel veri kopyası sayısını artırırdı). Bu araç yalnızca elle çalıştırılır:
//     node backup.js            -> "asgari" yedek (varsayılan): oturumlar, bekleyen kayıtlar, sıfırlama kodları, push/FCM anahtarları BOŞ
//     node backup.js --full     -> tam yedek (yalnızca gerçekten gerekliyse)
// Yedekler DATA_DIR/backups/ altına, yalnızca sahibin okuyabileceği izinle (0600, dizin 0700) yazılır ve BACKUP_RETENTION_DAYS (varsayılan 7 gün, TEKNİK
// VARSAYILAN; hukuki bir süre değildir) sonra sunucu tarafından otomatik silinir. Bu araç, canlı veritabanından silinen verinin ESKİ bir yedekte kalabileceğini
// ortadan kaldırmaz; yedeklerin kendi yaşam döngüsü ayrıdır (bkz. docs/yedekleme-ve-dis-kopyalar.md).

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_RETENTION_DAYS = 7; // Render anlık görüntü süresi ayrıdır ve Render'dan doğrulanmalıdır; migration öncesi doğrulama için yeterli, daha uzun tutmak için gerekçe yok

// Asgari yedekte BOŞALTILAN tablolar: geri yüklemede yeniden oluşan/işe yaramayan ve doğrudan kimlik doğrulama/cihaz gizli bilgisi içerenler.
// Ayrıca geçici/yeniden üretilebilir bildirim kayıtları (notifications, e-posta kuyruğu) da boşaltılır: geri yüklemede işe yaramaz ve başkalarının adlarını içerebilir.
const MINIMAL_EXCLUDED_TABLES = ['sessions', 'pending_verifications', 'password_resets', 'push_subscriptions', 'fcm_tokens', 'notifications', 'role_notice_email_outbox'];

// Geçici olduğu açıkça belli, elle alınmış eski yedek adları (DATA_DIR kökünde); yedek dizini dışındaki bu kalıplar da süresi dolunca silinir.
const STRAY_BACKUP_PATTERNS = [/^sauran\.db\.(bak|backup|pre|old|orig)[-_.\w]*$/i, /^sauran[-_.]?(pre)?migration[-_.\w]*$/i, /^sauran-backup-[-\w.]*\.db$/i, /^sauran-(export|dump)[-_.\w]*$/i];

function dataDir() { return process.env.DATA_DIR || path.join(__dirname, '..', 'data'); }
function backupDir() { return path.join(dataDir(), 'backups'); }
function retentionDays() {
  const v = Number(process.env.BACKUP_RETENTION_DAYS);
  return Number.isFinite(v) && v > 0 ? v : DEFAULT_RETENTION_DAYS;
}
function stamp(now) { return now.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z'); }

// Tutarlı (tek anlık görüntü) bir kopya alır: VACUUM INTO. Kaynak yalnızca okunur.
function createBackup({ minimal = true, dbPath = path.join(dataDir(), 'sauran.db'), dir = backupDir(), now = new Date() } = {}) {
  const Database = require('better-sqlite3');
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  try { fs.chmodSync(dir, 0o700); } catch (_) { /* Windows */ }

  const target = path.join(dir, `sauran-backup-${stamp(now)}${minimal ? '-minimal' : '-full'}.db`);
  if (fs.existsSync(target)) throw new Error('Aynı adlı yedek zaten var.');

  const src = new Database(dbPath, { readonly: true, fileMustExist: true });
  try { src.exec(`VACUUM INTO '${target.replace(/'/g, "''")}'`); } finally { src.close(); }

  const excluded = [];
  if (minimal) {
    const copy = new Database(target);
    try {
      copy.pragma('secure_delete = ON');
      const existing = new Set(copy.prepare(`SELECT name FROM sqlite_master WHERE type = 'table'`).all().map(r => r.name));
      for (const table of MINIMAL_EXCLUDED_TABLES) {
        if (!existing.has(table)) continue;
        copy.prepare(`DELETE FROM "${table}"`).run();
        excluded.push(table);
      }
      copy.exec('VACUUM'); // silinen satırların sayfaları kopyada da tamamen yeniden yazılır
      copy.pragma('wal_checkpoint(TRUNCATE)');
    } finally { copy.close(); }
  }

  try { fs.chmodSync(target, 0o600); } catch (_) { /* Windows */ }

  // Bütünlük denetimi ve sağlama toplamı: yedek gerçekten açılıp doğrulanabilmeli (aksi halde "yedek var" yanılgısı doğar).
  const verification = verifyDatabaseFile(target);
  const sha256 = sha256File(target);
  fs.writeFileSync(`${target}.sha256`, `${sha256}  ${path.basename(target)}\n`, { mode: 0o600 });
  return { path: target, minimal, excluded, integrity: verification.integrity, tables: verification.tables, sha256 };
}

function sha256File(file) {
  const hash = crypto.createHash('sha256');
  const fd = fs.openSync(file, 'r');
  try {
    const buf = Buffer.alloc(1 << 20);
    let n;
    while ((n = fs.readSync(fd, buf, 0, buf.length, null)) > 0) hash.update(buf.subarray(0, n));
  } finally { fs.closeSync(fd); }
  return hash.digest('hex');
}

// Yedek dosyasını salt okunur açar: PRAGMA integrity_check + temel tabloların satır sayısı (içerik yazdırılmaz).
function verifyDatabaseFile(file) {
  const Database = require('better-sqlite3');
  const db = new Database(file, { readonly: true, fileMustExist: true });
  try {
    const integrity = db.pragma('integrity_check', { simple: true });
    const tables = {};
    for (const t of ['users', 'hubs', 'messages', 'hub_members', 'friendships']) {
      try { tables[t] = db.prepare(`SELECT COUNT(*) AS c FROM "${t}"`).get().c; } catch (_) { tables[t] = null; }
    }
    return { integrity, tables };
  } finally { db.close(); }
}

// Tam doğrulama: sağlama toplamı sidecar ile eşleşiyor mu + SQLite bütünlüğü ok mu.
function verifyBackup(file) {
  const out = { ok: false, file: path.basename(file), checksum: 'missing', integrity: null };
  if (!fs.existsSync(file)) return { ...out, error: 'dosya yok' };
  try {
    const side = `${file}.sha256`;
    if (fs.existsSync(side)) {
      const want = String(fs.readFileSync(side, 'utf8')).trim().split(/\s+/)[0];
      out.checksum = want === sha256File(file) ? 'ok' : 'MISMATCH';
    }
    const v = verifyDatabaseFile(file);
    out.integrity = v.integrity; out.tables = v.tables;
    out.ok = out.checksum === 'ok' && v.integrity === 'ok';
  } catch (error) { out.error = error.message; }
  return out;
}

// Geri yükleme: yedeği DOĞRULAYIP hedef yola kopyalar. Var olan bir dosyanın üzerine YAZMAZ (force olmadan), canlı veritabanını doğrudan değiştirmez:
// hizmeti durdurup dosyayı yerine koymak operatörün bilinçli adımıdır (bkz. docs/uretim-operasyon.md).
function restoreBackup(file, target, { force = false } = {}) {
  const v = verifyBackup(file);
  if (!v.ok) throw new Error(`Yedek doğrulanamadı (sağlama toplamı: ${v.checksum}, bütünlük: ${v.integrity}).`);
  if (!target) throw new Error('Hedef yol gerekli.');
  if (fs.existsSync(target) && !force) throw new Error('Hedef dosya zaten var; üzerine yazmak için --force verin.');
  fs.copyFileSync(file, target);
  try { fs.chmodSync(target, 0o600); } catch (_) { /* Windows */ }
  return { restoredTo: target, verification: v };
}

// Günlük otomatik yedek: asgari yedek al → doğrula → (yapılandırılmışsa) şifreli off-site yükle → eski yedekleri temizle.
async function runAutoBackup({ upload = true } = {}) {
  const r = createBackup({ minimal: true });
  const v = verifyBackup(r.path);
  if (!v.ok) throw new Error('Otomatik yedek doğrulanamadı (yedek geçersiz sayıldı).');
  let offsite = { uploaded: false, reason: 'atlandı' };
  if (upload) {
    try { offsite = await require('./offsite').uploadBackup(r.path); } catch (error) { offsite = { uploaded: false, reason: 'hata: ' + String(error.message).slice(0, 80) }; }
  }
  const purged = purgeOldBackups();
  return { file: path.basename(r.path), verified: true, sha256: r.sha256, tables: r.tables, offsite, purged: purged.deleted };
}

// Sağlık göstergesi için: son yedeğin yaşı/durumu (dosya adı, boyut; içerik yok).
function latestBackupInfo() {
  const dir = backupDir();
  try {
    const files = fs.readdirSync(dir).filter((n) => /^sauran-backup-.*\.db$/.test(n)).map((n) => ({ n, st: fs.statSync(path.join(dir, n)) })).sort((a, b) => b.st.mtimeMs - a.st.mtimeMs);
    if (!files.length) return { count: 0, latest: null };
    return { count: files.length, latest: { name: files[0].n, ageHours: Math.round((Date.now() - files[0].st.mtimeMs) / 3600000), bytes: files[0].st.size } };
  } catch (_) { return { count: 0, latest: null }; }
}

// Süresi dolan yedekleri siler: yedek dizini + DATA_DIR kökündeki açıkça geçici/yedek adlı eski dosyalar. Diğer hiçbir dosyaya dokunmaz. BACKUP_CLEANUP=off ile kapatılabilir.
function purgeOldBackups({ now = new Date(), maxAgeDays = retentionDays(), dir = backupDir(), root = dataDir() } = {}) {
  const result = { deleted: 0, files: [] };
  if (String(process.env.BACKUP_CLEANUP || '').toLowerCase() === 'off') return result;

  const cutoff = now.getTime() - maxAgeDays * DAY_MS;
  const sweep = (folder, accept) => {
    let names = [];
    try { names = fs.readdirSync(folder); } catch (_) { return; }
    for (const name of names) {
      if (!accept(name)) continue;
      const full = path.join(folder, name);
      try {
        const st = fs.statSync(full);
        if (!st.isFile() || st.mtimeMs > cutoff) continue;
        fs.unlinkSync(full);
        result.deleted += 1; result.files.push(name);
      } catch (_) { /* yoksay */ }
    }
  };

  sweep(dir, (name) => /^sauran-backup-[-\w.]*\.db(-wal|-shm|\.sha256)?$/i.test(name));
  // Adet sınırı: en yeni BACKUP_KEEP (varsayılan 7) yedek kalır, fazlası (yaşına bakılmaksızın) silinir.
  try {
    const keep = Math.max(1, Number(process.env.BACKUP_KEEP) || 7);
    const dbs = fs.readdirSync(dir).filter((n) => /^sauran-backup-[-\w.]*\.db$/i.test(n)).map((n) => ({ n, t: fs.statSync(path.join(dir, n)).mtimeMs })).sort((a, b) => b.t - a.t);
    for (const old of dbs.slice(keep)) {
      for (const suffix of ['', '.sha256']) { try { fs.unlinkSync(path.join(dir, old.n + suffix)); } catch (_) { /* yoksay */ } }
      result.deleted += 1; result.files.push(old.n);
    }
  } catch (_) { /* dizin yok */ }
  sweep(root, (name) => STRAY_BACKUP_PATTERNS.some(re => re.test(name)));
  return result;
}

// Yedek/DB dizini istemcinin herkese açık (static) dizininin İÇİNDE olamaz: aksi halde dosyalar HTTP ile indirilebilirdi.
function isInsidePublicDir(dir, publicDir = path.join(__dirname, '..', 'client')) {
  const d = path.resolve(dir), p = path.resolve(publicDir);
  return d === p || d.startsWith(p + path.sep);
}

module.exports = { isInsidePublicDir, createBackup, verifyBackup, restoreBackup, runAutoBackup, latestBackupInfo, purgeOldBackups, backupDir, retentionDays, MINIMAL_EXCLUDED_TABLES, DEFAULT_RETENTION_DAYS };

if (require.main === module) {
  try {
    if (process.argv.includes('--list')) {
      const dir = backupDir();
      const list = fs.existsSync(dir) ? fs.readdirSync(dir).filter(n => /^sauran-backup-/.test(n)) : [];
      list.forEach((n) => {
        const st = fs.statSync(path.join(dir, n));
        const left = Math.max(0, Math.ceil((st.mtimeMs + retentionDays() * DAY_MS - Date.now()) / DAY_MS));
        console.log(`${n}  ${(st.size / 1024).toFixed(0)} KB  otomatik silinmesine ~${left} gün`);
      });
      if (!list.length) console.log('Yedek yok.');
      process.exit(0);
    }
    const argAfter = (flag) => { const i = process.argv.indexOf(flag); return i > -1 ? process.argv[i + 1] : undefined; };
    if (process.argv.includes('--verify')) {
      const f = argAfter('--verify');
      const v = verifyBackup(f);
      console.log(`Doğrulama: ${v.ok ? 'BAŞARILI' : 'BAŞARISIZ'} · sağlama toplamı: ${v.checksum} · bütünlük: ${v.integrity} · satır sayıları: ${JSON.stringify(v.tables || {})}`);
      process.exit(v.ok ? 0 : 1);
    }
    if (process.argv.includes('--restore')) {
      const f = argAfter('--restore');
      const to = argAfter('--to') || path.join(dataDir(), 'sauran.db.restored');
      const r = restoreBackup(f, to, { force: process.argv.includes('--force') });
      console.log(`Yedek doğrulandı ve geri yüklendi: ${r.restoredTo}\nCanlı veritabanının yerine koymak için hizmeti DURDURUN, mevcut sauran.db'yi başka yere taşıyın, bu dosyayı sauran.db adıyla yerine koyup hizmeti başlatın.`);
      process.exit(0);
    }
    if (process.argv.includes('--auto')) {
      runAutoBackup().then((r) => { console.log(`Otomatik yedek: ${r.file} · doğrulandı · off-site: ${r.offsite.uploaded ? 'yüklendi' : 'yüklenmedi (' + (r.offsite.reason || '-') + ')'}`); process.exit(0); }).catch((e) => { console.error('Yedek alınamadı:', e.message); process.exit(1); });
      return;
    }
    if (process.argv.includes('--purge')) { const r = purgeOldBackups(); console.log(`Süresi dolan ${r.deleted} dosya silindi.`); process.exit(0); }
    const full = process.argv.includes('--full');
    if (isInsidePublicDir(backupDir())) throw new Error('Yedek dizini herkese açık istemci dizininin içinde olamaz.');
    const r = createBackup({ minimal: !full });
    console.log(`Yedek alındı: ${r.path}`);
    console.log(full ? 'TAM yedek: oturum/kod/anahtar tabloları DAHİL. Gerekmedikten sonra silin.' : `Asgari yedek: şu tablolar boşaltıldı: ${r.excluded.join(', ') || '-'}`);
    console.log(`Bu dosya kişisel veri içerir. ${retentionDays()} gün sonra sunucu tarafından otomatik silinir; işiniz bitince hemen elle de silin.`);
  } catch (error) {
    console.error('Yedek alınamadı:', error.message);
    process.exit(1);
  }
}
