// Üretim öncesi kontrol aracı (Aşama 7). ÜRETİM VERİTABANINI DEĞİŞTİRMEZ; sır DEĞERLERİNİ ASLA yazdırmaz.
//
//   node preflight.js                   -> ortam/yapılandırma kontrolü (yalnızca "ayarlı / eksik" bilgisi)
//   node preflight.js --impact [db]     -> ilk açılışta çalışacak GERİ ALINAMAZ temizliklerin etkisini SALT OKUNUR sayar (yalnızca sayılar; kişisel veri yok)
//
// --impact için önce üretim yedeğinin KOPYASI üzerinde çalıştırılması önerilir (bkz. docs/uretim-oncesi-kontrol.md).

const fs = require('fs');
const path = require('path');

// ---------- yapılandırma kontrolü (sır değerleri yazdırılmaz) ----------
function checkConfig(env = process.env, opts = {}) {
  const out = [];
  const add = (level, key, message) => out.push({ level, key, message });
  const set = (k) => Boolean(String(env[k] || '').trim());
  const production = env.NODE_ENV === 'production';
  const renderHost = env.RENDER === 'true';

  if (!production) add(renderHost ? 'error' : 'warn', 'NODE_ENV', renderHost ? 'Render ortamı algılandı ama NODE_ENV=production DEĞİL (CORS/sıkı ayarlar ve cookie davranışı etkilenir).' : 'NODE_ENV=production ayarlı değil (yerel geliştirme modu).');
  else add('ok', 'NODE_ENV', 'production');

  const dataDir = path.resolve(env.DATA_DIR || path.join(__dirname, '..', 'data'));
  if (!set('DATA_DIR')) add(production ? 'error' : 'warn', 'DATA_DIR', 'DATA_DIR ayarlı değil: veritabanı depo dizininde durur; Render\'da KALICI DİSK yolu verilmezse her dağıtımda veri kaybolur.');
  else add('ok', 'DATA_DIR', 'ayarlı');
  const clientDir = path.resolve(opts.clientDir || path.join(__dirname, '..', 'client'));
  if (dataDir === clientDir || dataDir.startsWith(clientDir + path.sep)) add('error', 'DATA_DIR', 'DATA_DIR herkese açık istemci dizininin İÇİNDE (sunucu başlamaz).');
  try { fs.mkdirSync(dataDir, { recursive: true }); fs.accessSync(dataDir, fs.constants.W_OK); add('ok', 'DATA_DIR yazılabilir', 'evet'); } catch (_) { add('error', 'DATA_DIR yazılabilir', 'HAYIR: dizin yazılamıyor.'); }

  add(set('DAILY_API_KEY') ? 'ok' : 'warn', 'DAILY_API_KEY', set('DAILY_API_KEY') ? 'ayarlı' : 'eksik: sesli sohbet/oda ve Daily temizliği çalışmaz.');

  const vapid = ['VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'VAPID_SUBJECT'].filter(set);
  if (vapid.length === 3) add('ok', 'VAPID_*', 'ayarlı');
  else add('warn', 'VAPID_*', `eksik (${3 - vapid.length}/3): Web Push devre dışı kalır.`);
  if (set('VAPID_SUBJECT') && !/^(mailto:|https:)/.test(env.VAPID_SUBJECT)) add('warn', 'VAPID_SUBJECT', 'mailto: ya da https: ile başlamalı.');

  const fb = env.FIREBASE_SERVICE_ACCOUNT_JSON || (env.FIREBASE_SERVICE_ACCOUNT_BASE64 ? Buffer.from(env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf8') : '');
  if (!fb.trim()) add('warn', 'FIREBASE_SERVICE_ACCOUNT_*', 'eksik: Android (FCM) bildirimi kapalı.');
  else { try { const j = JSON.parse(fb); add(j && j.private_key && j.client_email ? 'ok' : 'error', 'FIREBASE_SERVICE_ACCOUNT_*', j && j.private_key && j.client_email ? 'ayarlı ve çözümlenebilir' : 'JSON geçerli ama beklenen alanlar eksik.'); } catch (_) { add('error', 'FIREBASE_SERVICE_ACCOUNT_*', 'ayarlı ama çözümlenemiyor (bozuk JSON/base64).'); } }

  add(set('ZOHO_EMAIL_PASSWORD') ? 'ok' : (production ? 'error' : 'warn'), 'ZOHO_EMAIL_PASSWORD', set('ZOHO_EMAIL_PASSWORD') ? 'ayarlı' : 'eksik: doğrulama/sıfırlama e-postaları GÖNDERİLEMEZ (kayıt tamamlanamaz).');
  add(set('REPORT_EMAIL_TO') ? 'ok' : 'warn', 'REPORT_EMAIL_TO', set('REPORT_EMAIL_TO') ? 'ayarlı' : 'eksik: rapor bildirim e-postaları varsayılan adrese gider (kontrol edin).');
  add(set('PUBLIC_BASE_URL') ? 'ok' : 'warn', 'PUBLIC_BASE_URL', set('PUBLIC_BASE_URL') ? 'ayarlı' : 'eksik: e-postalardaki panel bağlantısı varsayılan alan adını kullanır.');
  add('ok', 'ALLOWED_ORIGINS', set('ALLOWED_ORIGINS') ? 'ek izinli origin listesi ayarlı' : 'ayarsız: üretimde yalnızca aynı-origin (Host) isteklerine izin verilir');
  add('ok', 'oturum gizli anahtarı', 'GEREKMEZ: oturum belirteçleri 256 bit rastgele üretilir ve yalnızca SHA-256 özeti saklanır (sunucu gizli anahtarı yok)');
  add('ok', 'trust proxy', 'sabit 1 (Render tek ters proxy); HTTPS bilgisi X-Forwarded-Proto ile alınır; üretimde çerez her zaman Secure');
  return out;
}

// ---------- geri alınamaz açılış temizliklerinin etki raporu (SALT OKUNUR, yalnızca sayılar) ----------
// Sabitler server/db.js ile aynı olmalıdır (preflight_suite eşitliği doğrular).
const T = { media_days: 90, text_days: 365, active_keep: 200, dormant_days: 730, deleted_dm_days: 90, audit_reason_days: 90, audit_days: 365, backup_days: 7 };

function impactReport(dbPath, now = new Date()) {
  const Database = require('better-sqlite3');
  const db = new Database(dbPath, { readonly: true, fileMustExist: true });
  const ago = (d) => new Date(now.getTime() - d * 86400000).toISOString().slice(0, 19).replace('T', ' ');
  const one = (sql, ...p) => { try { return db.prepare(sql).get(...p); } catch (_) { return null; } };
  const n = (sql, ...p) => { const r = one(sql, ...p); return r ? Number(Object.values(r)[0]) || 0 : 0; };
  const has = (t) => Boolean(one(`SELECT 1 x FROM sqlite_master WHERE type='table' AND name = ?`, t));
  const cols = (t) => { try { return db.prepare(`PRAGMA table_info(${t})`).all().map(c => c.name); } catch (_) { return []; } };
  const rep = [];
  const add = (mechanism, what, count, note = '') => rep.push({ mechanism, what, count, note });

  const uc = cols('users'), mc = cols('messages');
  if (uc.includes('birth_date')) add('Doğum tarihi geçişi', 'birth_date dolu kullanıcı satırı → minor_until\'a çevrilip birth_date SİLİNİR (18+ için hiçbir tarih kalmaz)', n(`SELECT COUNT(*) FROM users WHERE birth_date IS NOT NULL`), 'GERİ ALINAMAZ');
  if (has('pending_verifications') && cols('pending_verifications').includes('birth_date')) add('Doğum tarihi geçişi', 'bekleyen doğrulama kaydındaki birth_date', n(`SELECT COUNT(*) FROM pending_verifications WHERE birth_date IS NOT NULL`));

  if (mc.length) {
    add('Mesaj saklama: medya', `${T.media_days} günden eski medya içeren mesaj (base64 payload SİLİNİR; ad/tür kalır)`, n(`SELECT COUNT(*) FROM messages WHERE created_at < ? AND payload IS NOT NULL AND (payload LIKE '%"data":"data:%' OR payload LIKE '%"audio":"data:%')`, ago(T.media_days)), 'GERİ ALINAMAZ');
    add('Mesaj saklama: metin', `sohbetin en yeni ${T.active_keep} mesajı DIŞINDA kalan ve ${T.text_days} günden eski mesaj (SİLİNİR; sabitlenmişler hariç)`, n(`WITH r AS (SELECT id, created_at, pinned_at, ROW_NUMBER() OVER (PARTITION BY room ORDER BY id DESC) rn FROM messages WHERE COALESCE(room,'') NOT LIKE 'dmdel\\_%' ESCAPE '\\') SELECT COUNT(*) FROM r WHERE rn > ? AND created_at < ? AND pinned_at IS NULL`, T.active_keep, ago(T.text_days)), 'GERİ ALINAMAZ');
    add('Mesaj saklama: hareketsiz sohbet', `${T.dormant_days} gündür hiç mesaj gelmeyen sohbetlerin tüm mesajları (SİLİNİR)`, n(`SELECT COUNT(*) FROM messages WHERE COALESCE(room,'') NOT LIKE 'dmdel\\_%' ESCAPE '\\' AND room IN (SELECT room FROM messages GROUP BY room HAVING MAX(created_at) < ?)`, ago(T.dormant_days)), 'GERİ ALINAMAZ');
    add('Silinmiş mesaj kalıntısı', 'eski sürümde silinmiş ama kullanıcı bağı/adı taşıyan mezar taşı satırı (kalıntı TEMİZLENİR)', n(`SELECT COUNT(*) FROM messages WHERE kind = 'deleted' AND user_id IS NOT NULL`));
    if (mc.includes('forwarded_from_message_id')) add('Kaynağı olmayan kopya', 'kaynağı fiziksel olarak yok forward kopyası (İÇERİKSİZ mezar taşı olur)', n(`SELECT COUNT(*) FROM messages WHERE forwarded_from_message_id IS NOT NULL AND kind != 'deleted' AND forwarded_from_message_id NOT IN (SELECT id FROM messages)`), 'GERİ ALINAMAZ');
    if (mc.includes('reply_to_message_id')) add('Kopuk bağlantılar', 'var olmayan mesaja yanıt bağlantısı (NULL yapılır)', n(`SELECT COUNT(*) FROM messages WHERE reply_to_message_id IS NOT NULL AND reply_to_message_id NOT IN (SELECT id FROM messages)`));
    add('Eski tek-oda kalıntısı', "'general' odasındaki gönderen bağlantısız eski satırlar (SİLİNİR)", n(`SELECT COUNT(*) FROM messages WHERE room = 'general' AND hub_id IS NULL AND to_user_id IS NULL AND user_id IS NULL AND kind IS NOT 'deleted'`), 'GERİ ALINAMAZ');
    add('Silinmiş hesap DM sohbeti', `hesap silme anından ${T.deleted_dm_days} gün geçen "dmdel_" sohbet mesajları (SİLİNİR)`, n(`SELECT COUNT(*) FROM messages WHERE room LIKE 'dmdel\\_%' ESCAPE '\\' AND CAST(substr(room, length(room) - 9) AS INTEGER) < ?`, Math.floor(now.getTime() / 1000) - T.deleted_dm_days * 86400), 'GERİ ALINAMAZ');
  }
  if (has('reports')) { const iso = now.toISOString(); add('Rapor saklama', 'retention_until\'i geçmiş rapor kaydı (SİLİNİR)', n(`SELECT COUNT(*) FROM reports WHERE retention_until IS NOT NULL AND retention_until <= ?`, iso), 'GERİ ALINAMAZ'); }
  if (has('report_evidence')) { const iso = now.toISOString(); add('Rapor kanıtı', 'retention_until\'i geçmiş kanıt metni (SİLİNİR)', n(`SELECT COUNT(*) FROM report_evidence WHERE retention_until <= ?`, iso), 'GERİ ALINAMAZ'); }
  if (has('report_evidence_media')) { const iso = now.toISOString(); add('Rapor kanıtı medyası', 'retention_until\'i geçmiş kanıt medyası (SİLİNİR)', n(`SELECT COUNT(*) FROM report_evidence_media WHERE retention_until <= ?`, iso), 'GERİ ALINAMAZ'); }
  if (has('notifications')) add('Bildirim saklama', '7 günden eski yanıtlanmış/okunmuş bildirim (üst sınırlar için bkz. docs)', n(`SELECT COUNT(*) FROM notifications WHERE status IN ('accepted','declined','read') AND created_at < ?`, ago(7)));
  if (has('role_notice_email_outbox')) add('E-posta kuyruğu', '7 günden eski kuyruk kaydı', n(`SELECT COUNT(*) FROM role_notice_email_outbox WHERE created_at < ?`, ago(7)));
  if (has('admin_audit_log')) { add('Denetim kaydı', `${T.audit_reason_days} günden eski gerekçe (SİLİNİR)`, n(`SELECT COUNT(*) FROM admin_audit_log WHERE reason IS NOT NULL AND created_at < ?`, ago(T.audit_reason_days))); add('Denetim kaydı', `${T.audit_days} günden eski kayıt (SİLİNİR)`, n(`SELECT COUNT(*) FROM admin_audit_log WHERE created_at < ?`, ago(T.audit_days)), 'GERİ ALINAMAZ'); }
  if (has('sessions')) add('Oturum/kod temizliği', 'süresi dolmuş oturum', n(`SELECT COUNT(*) FROM sessions WHERE expires_at <= ?`, now.toISOString()));

  // görsel üstverisi: kaç profil/kapak/lobi görselinin yeniden yazılacağı
  try {
    const { stripImageMetadata } = require('./imagemeta');
    let changed = 0;
    for (const [t, c] of [['users', 'avatar_data'], ['users', 'banner_data'], ['hubs', 'image_data']]) {
      if (!has(t) || !cols(t).includes(c)) continue;
      for (const r of db.prepare(`SELECT ${c} v FROM ${t} WHERE ${c} LIKE 'data:image/%'`).all()) if (stripImageMetadata(r.v) !== r.v) changed++;
    }
    add('Görsel üstverisi', 'EXIF/GPS/XMP vb. taşıyan profil/kapak/lobi görseli (üstveri ÇIKARILIR; görüntü aynı kalır)', changed);
  } catch (_) { /* yoksay */ }

  db.close();
  return rep;
}

// DATA_DIR içinde otomatik silinecek yedek/geçici dosyalar (yalnızca adları/sayısı)
function backupImpact(dataDir, now = new Date(), days = T.backup_days) {
  const bk = require('./backup');
  const cutoff = now.getTime() - days * 86400000; const found = [];
  const scan = (dir, accept) => { let names = []; try { names = fs.readdirSync(dir); } catch (_) { return; } for (const nme of names) { if (!accept(nme)) continue; try { const st = fs.statSync(path.join(dir, nme)); if (st.isFile() && st.mtimeMs <= cutoff) found.push(nme); } catch (_) { /* yoksay */ } } };
  scan(path.join(dataDir, 'backups'), (x) => /^sauran-backup-/i.test(x));
  scan(dataDir, (x) => /^sauran\.db\.(bak|backup|pre|old|orig)/i.test(x) || /^sauran[-_.]?(pre)?migration/i.test(x) || /^sauran-(export|dump)/i.test(x) || /^sauran-backup-.*\.db$/i.test(x));
  return found;
}

module.exports = { checkConfig, impactReport, backupImpact, THRESHOLDS: T };

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.includes('--impact')) {
    const dbPath = args[args.indexOf('--impact') + 1] && !args[args.indexOf('--impact') + 1].startsWith('--') ? args[args.indexOf('--impact') + 1] : path.join(process.env.DATA_DIR || path.join(__dirname, '..', 'data'), 'sauran.db');
    console.log(`Etki raporu (SALT OKUNUR): ${dbPath}\n`);
    for (const r of impactReport(dbPath)) console.log(`${String(r.count).padStart(8)}  [${r.mechanism}] ${r.what}${r.note ? '  <' + r.note + '>' : ''}`);
    const b = backupImpact(path.dirname(dbPath));
    console.log(`\n${String(b.length).padStart(8)}  [Yedek temizliği] ${T.backup_days} günden eski yedek/geçici dosya (adlar: ${b.join(', ') || '-'})  <GERİ ALINAMAZ>`);
    console.log('\nNot: Bu sayılar yalnızca ilk açılıştaki tek seferlik ve düzenli temizlik turlarının TAHMİNİDİR; kişisel veri içermez.');
  } else {
    const res = checkConfig();
    for (const r of res) console.log(`${{ ok: 'TAMAM ', warn: 'UYARI ', error: 'HATA  ' }[r.level]} ${r.key}: ${r.message}`);
    process.exit(res.some(r => r.level === 'error') ? 1 : 0);
  }
}
