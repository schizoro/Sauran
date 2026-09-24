// Görsel üstverisi (EXIF/GPS, XMP, IPTC, yorum, metin parçaları) temizliği — veri minimizasyonu.
//
// Kullanıcının gönderdiği/yüklediği görseller (profil, kapak, lobi görseli, sohbet görselleri) konum (GPS), cihaz modeli, zaman ve yazar bilgisi taşıyabilir.
// Bu bilgiler görselin GÖSTERİLMESİ için gerekmez, karşı tarafa/lobiye/rapor kanıtına gereksiz kişisel veri taşır. Bu modül, görsel piksellerine DOKUNMADAN
// yalnızca üstveri bloklarını çıkarır (JPEG: APP1 [EXIF/XMP], APP13 [IPTC], COM; PNG: eXIf, tEXt, zTXt, iTXt, tIME; WebP: EXIF, XMP).
// Renk profili (ICC), JFIF ve renk dönüşümü (Adobe APP14) korunur. Ayrıştırma başarısız olursa görsel OLDUĞU GİBİ bırakılır (görüntüyü bozmaz).
// Not: ses/video/dosya ekleri üstverisi bu modülün kapsamı dışındadır (bkz. docs/ozel-nitelikli-veri-ve-hassas-icerik.md).

const DATA_URL = /^data:image\/(png|jpe?g|webp);base64,([A-Za-z0-9+/=]+)$/;

function stripJpeg(buf) {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  const out = [buf.subarray(0, 2)];
  let i = 2;
  while (i < buf.length) {
    if (buf[i] !== 0xff) return null;
    while (buf[i] === 0xff && i < buf.length) i++; // dolgu baytları
    const marker = buf[i]; i++;
    if (marker === 0xd9) { out.push(Buffer.from([0xff, 0xd9])); i = buf.length; break; }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) { out.push(Buffer.from([0xff, marker])); continue; }
    if (i + 2 > buf.length) return null;
    const len = buf.readUInt16BE(i);
    if (len < 2 || i + len > buf.length) return null;
    if (marker === 0xda) { out.push(buf.subarray(i - 2, buf.length)); i = buf.length; break; } // tarama verisi: geri kalan aynen
    const drop = marker === 0xe1 || marker === 0xed || marker === 0xfe;
    if (!drop) out.push(buf.subarray(i - 2, i + len));
    i += len;
  }
  return Buffer.concat(out);
}

const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const PNG_DROP = new Set(['eXIf', 'tEXt', 'zTXt', 'iTXt', 'tIME']);
function stripPng(buf) {
  if (buf.length < 8 || !buf.subarray(0, 8).equals(PNG_SIG)) return null;
  const out = [buf.subarray(0, 8)];
  let i = 8;
  while (i + 12 <= buf.length) {
    const len = buf.readUInt32BE(i);
    const type = buf.toString('latin1', i + 4, i + 8);
    const end = i + 12 + len;
    if (end > buf.length) return null;
    if (!PNG_DROP.has(type)) out.push(buf.subarray(i, end));
    i = end;
    if (type === 'IEND') break;
  }
  return Buffer.concat(out);
}

function stripWebp(buf) {
  if (buf.length < 12 || buf.toString('latin1', 0, 4) !== 'RIFF' || buf.toString('latin1', 8, 12) !== 'WEBP') return null;
  const chunks = [];
  let i = 12;
  while (i + 8 <= buf.length) {
    const type = buf.toString('latin1', i, i + 4);
    const size = buf.readUInt32LE(i + 4);
    const padded = size + (size % 2);
    if (i + 8 + padded > buf.length) return null;
    if (type !== 'EXIF' && type !== 'XMP ') {
      let chunk = Buffer.from(buf.subarray(i, i + 8 + padded));
      if (type === 'VP8X' && size >= 10) chunk[8] &= ~(0x08 | 0x04); // EXIF ve XMP bayraklarını temizle
      chunks.push(chunk);
    }
    i += 8 + padded;
  }
  const body = Buffer.concat([Buffer.from('WEBP', 'latin1'), ...chunks]);
  const head = Buffer.alloc(8);
  head.write('RIFF', 0, 'latin1'); head.writeUInt32LE(body.length, 4);
  return Buffer.concat([head, body]);
}

// data URL alır; görsel jpeg/png/webp ise üstverisiz yeni data URL, aksi halde (ya da hata halinde) aynısını döndürür.
function stripImageMetadata(dataUrl) {
  try {
    if (typeof dataUrl !== 'string') return dataUrl;
    const m = DATA_URL.exec(dataUrl);
    if (!m) return dataUrl;
    const kind = m[1].toLowerCase();
    const buf = Buffer.from(m[2], 'base64');
    const cleaned = kind === 'png' ? stripPng(buf) : kind === 'webp' ? stripWebp(buf) : stripJpeg(buf);
    if (!cleaned || !cleaned.length) return dataUrl;
    return `data:image/${m[1]};base64,${cleaned.toString('base64')}`;
  } catch (_) {
    return dataUrl;
  }
}

module.exports = { stripImageMetadata, stripJpeg, stripPng, stripWebp };
