const { db } = require('./db');

const [, , command, arg] = process.argv;

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
  default:
    console.log(`Kullanım:
  node admin.js list-users        Kayıtlı kullanıcıları listele
  node admin.js list-pending      Doğrulama bekleyen kayıtları listele
  node admin.js delete <ad|mail>  Belirli bir kullanıcıyı sil
  node admin.js delete-all        Tüm kullanıcıları sil
  node admin.js clear-pending     Bekleyen doğrulama kayıtlarını temizle`);
}
