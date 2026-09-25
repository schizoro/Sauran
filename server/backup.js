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
  return { path: target, minimal, excluded };
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

  sweep(dir, (name) => /^sauran-backup-[-\w.]*\.db(-wal|-shm)?$/i.test(name));
  sweep(root, (name) => STRAY_BACKUP_PATTERNS.some(re => re.test(name)));
  return result;
}

// Yedek/DB dizini istemcinin herkese açık (static) dizininin İÇİNDE olamaz: aksi halde dosyalar HTTP ile indirilebilirdi.
function isInsidePublicDir(dir, publicDir = path.join(__dirname, '..', 'client')) {
  const d = path.resolve(dir), p = path.resolve(publicDir);
  return d === p || d.startsWith(p + path.sep);
}

module.exports = { isInsidePublicDir, createBackup, purgeOldBackups, backupDir, retentionDays, MINIMAL_EXCLUDED_TABLES, DEFAULT_RETENTION_DAYS };

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
