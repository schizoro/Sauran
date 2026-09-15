const Database = require('better-sqlite3');
const path = require('path');

// Veritabanı dosyasının yolu (data klasöründe olacak)
const dbPath = path.join(__dirname, '..', 'data', 'sauran.db');

// Veritabanını aç (yoksa otomatik oluşturur)
const db = new Database(dbPath);

// Performans için WAL modunu aç
db.pragma('journal_mode = WAL');

// Tabloları oluştur (yoksa)
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    username TEXT NOT NULL,
    content TEXT NOT NULL,
    room TEXT DEFAULT 'general',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`);

// Mesaj kaydetme fonksiyonu
function saveMessage(username, content, room = 'general') {
  const stmt = db.prepare(`
    INSERT INTO messages (username, content, room)
    VALUES (?, ?, ?)
  `);
  const info = stmt.run(username, content, room);
  return info.lastInsertRowid;
}

// Son mesajları getirme fonksiyonu
function getMessages(limit = 50, room = 'general') {
  const stmt = db.prepare(`
    SELECT id, username, content, room, created_at
    FROM messages
    WHERE room = ?
    ORDER BY id DESC
    LIMIT ?
  `);
  const rows = stmt.all(room, limit);
  return rows.reverse(); // Eskiden yeniye sırala
}

// Kullanıcı oluşturma (şimdilik basit)
function createUser(username) {
  try {
    const stmt = db.prepare(`INSERT INTO users (username) VALUES (?)`);
    const info = stmt.run(username);
    return info.lastInsertRowid;
  } catch (err) {
    // Kullanıcı zaten varsa hata vermesin
    return null;
  }
}

module.exports = {
  saveMessage,
  getMessages,
  createUser,
  db
};