const { db, listReports, updateReportStatus } = require('./db');

const [, , command, arg, arg2] = process.argv;

function listUsers() {
  const rows = db.prepare(`SELECT id, username, email, created_at FROM users ORDER BY id`).all();
  console.table(rows);
}

function listPending() {
  const rows = db.prepare(`SELECT id, username, email, code, expires_at FROM pending_verifications ORDER BY id`).all();
  console.table(rows);
}

function deleteUser(identifier) {
  const user = db.prepare(`
    SELECT id FROM users WHERE LOWER(username) = LOWER(?) OR LOWER(email) = LOWER(?)
  `).get(identifier, identifier);

  if (!user) {
    console.log(`Bulunamadı: ${identifier}`);
    return;
  }

  const ownedHubs = db.prepare(`SELECT id FROM hubs WHERE created_by = ?`).all(user.id);
  ownedHubs.forEach(h => {
    db.prepare(`DELETE FROM hub_poll_votes WHERE message_id IN (SELECT id FROM messages WHERE hub_id = ?)`).run(h.id);
    db.prepare(`DELETE FROM messages WHERE hub_id = ?`).run(h.id);
    db.prepare(`DELETE FROM hub_members WHERE hub_id = ?`).run(h.id);
    db.prepare(`DELETE FROM hub_roles WHERE hub_id = ?`).run(h.id);
    db.prepare(`DELETE FROM hub_invites WHERE hub_id = ?`).run(h.id);
    db.prepare(`DELETE FROM hubs WHERE id = ?`).run(h.id);
  });

  db.prepare(`DELETE FROM hub_invites WHERE created_by = ?`).run(user.id);
  db.prepare(`DELETE FROM hub_members WHERE user_id = ?`).run(user.id);
  db.prepare(`DELETE FROM friendships WHERE user_low = ? OR user_high = ?`).run(user.id, user.id);
  db.prepare(`DELETE FROM blocked_users WHERE user_id = ? OR blocked_user_id = ?`).run(user.id, user.id);
  db.prepare(`DELETE FROM notifications WHERE user_id = ?`).run(user.id);
  db.prepare(`DELETE FROM messages WHERE user_id = ? OR to_user_id = ?`).run(user.id, user.id);

  const info = db.prepare(`DELETE FROM users WHERE id = ?`).run(user.id);
  console.log(info.changes ? `Silindi: ${identifier}` : `Bulunamadı: ${identifier}`);
}

function deleteAllUsers(confirmation) {
  if (confirmation !== 'HEPSINI-SIL-EMINIM') {
    console.log(`TEHLİKELİ KOMUT: bu TÜM kullanıcıları (gerçek hesaplar dahil) siler.
Kastınsa: node admin.js delete-all HEPSINI-SIL-EMINIM
Tek bir hesabı silmek için: node admin.js delete <kullaniciadi|email>`);
    return;
  }
  const info = db.prepare(`DELETE FROM users`).run();
  console.log(`${info.changes} kullanıcı silindi.`);
}

function clearPending() {
  const info = db.prepare(`DELETE FROM pending_verifications`).run();
  console.log(`${info.changes} bekleyen kayıt silindi.`);
}

function listReportsCli(status) {
  const reports = listReports(status || null);

  if (reports.length === 0) {
    console.log(status ? `"${status}" durumunda rapor yok.` : 'Hiç rapor yok.');
    return;
  }

  console.table(reports.map(r => ({
    id: r.id,
    reporter: r.reporter_username,
    type: r.target_type,
    target: r.target_label,
    reason: r.reason,
    description: r.description ? r.description.slice(0, 40) : '',
    status: r.status,
    created_at: r.created_at
  })));
}

function resolveReportCli(id, status) {
  if (!id || !status) {
    console.log('Kullanım: node admin.js resolve-report <id> <under_review|action_taken|dismissed>');
    return;
  }

  // reviewed_by için sabit bir sistem kullanıcı id'si yerine 0 kullanıyoruz (CLI üzerinden inceleniyor).
  const result = updateReportStatus(Number(id), 0, status);
  console.log(result.success ? `Rapor #${id} → ${status}` : result.error);
}

switch (command) {
  case 'list-users':
    listUsers();
    break;
  case 'list-pending':
    listPending();
    break;
  case 'delete':
    if (!arg) { console.log('Kullanım: node admin.js delete <kullaniciadi|email>'); break; }
    deleteUser(arg);
    break;
  case 'delete-all':
    deleteAllUsers(arg);
    break;
  case 'clear-pending':
    clearPending();
    break;
  case 'list-reports':
    listReportsCli(arg);
    break;
  case 'resolve-report':
    resolveReportCli(arg, arg2);
    break;
  default:
    console.log(`Kullanım:
  node admin.js list-users            Kayıtlı kullanıcıları listele
  node admin.js list-pending          Doğrulama bekleyen kayıtları listele
  node admin.js delete <ad|mail>      Belirli bir kullanıcıyı sil
  node admin.js delete-all            Tüm kullanıcıları sil
  node admin.js clear-pending         Bekleyen doğrulama kayıtlarını temizle
  node admin.js list-reports [status] Bildirimleri listele (opsiyonel: new/under_review/action_taken/dismissed)
  node admin.js resolve-report <id> <status>  Bir bildirimi durumla kapat`);
}
