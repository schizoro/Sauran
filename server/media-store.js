'use strict';
// Sohbet dosyaları (görsel/video/dosya/sesli mesaj) için disk deposu: DATA_DIR/media/<ilk 2 karakter>/<32 hex kimlik>.
// Dosyalar ikili (binary) saklanır — base64'e göre %25 daha az yer. Veritabanında yalnızca kimlik ve boyut tutulur
// (media_files tablosu + messages.media_file). Klasör herkese açık istemci dizininin dışındadır (DATA_DIR kontrolü index.js'te).
// Yalnızca bu modül diske yazar/siler; depolama ileride başka bir yere (ör. nesne deposu) taşınırsa değişecek tek yer burasıdır.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function dataDir() { return process.env.DATA_DIR || path.join(__dirname, '..', 'data'); }
function mediaRoot() { return path.join(dataDir(), 'media'); }
function isId(id) { return typeof id === 'string' && /^[0-9a-f]{32}$/.test(id); }
function filePath(id) {
  if (!isId(id)) throw new Error('Geçersiz medya kimliği.');
  return path.join(mediaRoot(), id.slice(0, 2), id);
}
function prepare() {
  const id = crypto.randomBytes(16).toString('hex');
  const p = filePath(id);
  fs.mkdirSync(path.dirname(p), { recursive: true, mode: 0o700 });
  return { id, p, tmp: `${p}.tmp` };
}

// Bellekteki veriyi yazar (yükleme yolu). Önce geçici ada, sonra atomik yeniden adlandırma.
function writeBuffer(buf) {
  const { id, p, tmp } = prepare();
  try {
    const fd = fs.openSync(tmp, 'w', 0o600);
    try { fs.writeSync(fd, buf); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
    fs.renameSync(tmp, p);
  } catch (error) {
    try { fs.unlinkSync(tmp); } catch (_) { /* yoksay */ } // disk doldu vb.: yarım dosya kalmasın
    throw error;
  }
  return { id, bytes: buf.length };
}

// Parça parça yazar (taşıma yolu): nextChunk() Buffer döndürür, bitince null. Her parçadan sonra olay döngüsüne nefes aldırılır.
async function writeChunks(nextChunk) {
  const { id, p, tmp } = prepare();
  const fd = fs.openSync(tmp, 'w', 0o600);
  let bytes = 0;
  try {
    for (;;) {
      const b = await nextChunk();
      if (!b || !b.length) break;
      fs.writeSync(fd, b);
      bytes += b.length;
      await new Promise((r) => setImmediate(r));
    }
    fs.fsyncSync(fd);
  } catch (error) {
    try { fs.closeSync(fd); } catch (_) { /* yoksay */ }
    try { fs.unlinkSync(tmp); } catch (_) { /* yoksay */ }
    throw error;
  }
  fs.closeSync(fd);
  fs.renameSync(tmp, p);
  return { id, bytes };
}

function exists(id) { try { return isId(id) && fs.statSync(filePath(id)).isFile(); } catch (_) { return false; } }
function readAll(id) { return fs.readFileSync(filePath(id)); }
function createReadStream(id, opts) { return fs.createReadStream(filePath(id), opts); }
function remove(id) {
  if (!isId(id)) return false;
  try { fs.unlinkSync(filePath(id)); return true; } catch (error) { return error && error.code === 'ENOENT'; }
}

// Diskin toplam/boş alanı (bayt). Desteklenmeyen ortamda null.
function diskStats() {
  try {
    const s = fs.statfsSync(dataDir());
    return { total: Number(s.blocks) * Number(s.bsize), free: Number(s.bavail) * Number(s.bsize) };
  } catch (_) { return null; }
}

// Klasördeki tüm dosyalar: { id (geçici dosyada .tmp ile), tmp, mtimeMs } — tutarlılık taraması için.
function listFiles() {
  const out = [];
  let dirs = [];
  try { dirs = fs.readdirSync(mediaRoot(), { withFileTypes: true }).filter((d) => d.isDirectory()); } catch (_) { return out; }
  for (const d of dirs) {
    let names = [];
    try { names = fs.readdirSync(path.join(mediaRoot(), d.name)); } catch (_) { continue; }
    for (const name of names) {
      const full = path.join(mediaRoot(), d.name, name);
      try { out.push({ name, full, tmp: name.endsWith('.tmp'), mtimeMs: fs.statSync(full).mtimeMs }); } catch (_) { /* yoksay */ }
    }
  }
  return out;
}
function removePath(full) { try { fs.unlinkSync(full); return true; } catch (_) { return false; } }

// Bir klasördeki dosyaların toplam boyutu (yedek klasörü gibi küçük klasörler için).
function dirBytes(dir) {
  let total = 0;
  try {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) total += dirBytes(p);
      else if (e.isFile()) { try { total += fs.statSync(p).size; } catch (_) { /* yoksay */ } }
    }
  } catch (_) { /* klasör yok */ }
  return total;
}

module.exports = { dataDir, mediaRoot, isId, filePath, writeBuffer, writeChunks, exists, readAll, createReadStream, remove, diskStats, dirBytes, listFiles, removePath };
