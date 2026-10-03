'use strict';

// Emoji görseli sıkıştırma: yüklenen HER görsel (JPEG/PNG/WebP/GIF/AVIF) sunucuda küçültülür ve WebP'ye çevrilir —
// depolama şişmesin diye. Statik: en fazla 128px, ≤ 60 KB. Hareketli (yalnızca izinli kullanıcı): en fazla 128px, ≤ 220 KB
// hareketli WebP (kare sayısı sınırlı). Üstveri (EXIF/GPS) hiçbir zaman korunmaz.
const sharp = require('sharp');

const MAX_INPUT_STATIC = 4 * 1024 * 1024;
const MAX_INPUT_ANIMATED = 5 * 1024 * 1024;
const OUT_MAX_STATIC = 60 * 1024;
const OUT_MAX_ANIMATED = 220 * 1024;
const MAX_FRAMES = 80;
const PIXEL_LIMIT = 4096 * 4096;
const ALLOWED_FORMATS = ['jpeg', 'png', 'webp', 'gif', 'avif', 'heif', 'tiff'];

function toDataUrl(buf) { return 'data:image/webp;base64,' + buf.toString('base64'); }

// buffer: ham dosya. allowAnimated: hareketli çıktıya izin var mı (Premium). Dönüş: { success, data, animated, bytes, width, height, note } | { success:false, error }
async function compressEmoji(buffer, { allowAnimated = false } = {}) {
  if (!Buffer.isBuffer(buffer) || !buffer.length) return { success: false, error: 'Boş görsel.' };
  if (buffer.length > MAX_INPUT_ANIMATED || (buffer.length > MAX_INPUT_STATIC && !allowAnimated)) return { success: false, error: 'Görsel çok büyük.' };

  let meta;
  try {
    meta = await sharp(buffer, { animated: true, limitInputPixels: PIXEL_LIMIT }).metadata();
  } catch (_) {
    return { success: false, error: 'Görsel okunamadı.' };
  }
  if (!ALLOWED_FORMATS.includes(meta.format)) return { success: false, error: 'Desteklenmeyen görsel türü (PNG, JPEG, WebP, GIF).' };

  const frames = meta.pages || 1;
  const isAnimatedSource = frames > 1;

  try {
    if (isAnimatedSource && allowAnimated) {
      for (const [size, quality] of [[128, 65], [112, 50], [96, 40], [80, 30]]) {
        const out = await sharp(buffer, { animated: true, pages: Math.min(frames, MAX_FRAMES), limitInputPixels: PIXEL_LIMIT })
          .resize(size, size, { fit: 'inside', withoutEnlargement: true })
          .webp({ quality, effort: 4, loop: 0 })
          .toBuffer({ resolveWithObject: true });
        if (out.data.length <= OUT_MAX_ANIMATED) {
          const m = await sharp(out.data, { animated: true }).metadata();
          return { success: true, data: toDataUrl(out.data), animated: (m.pages || 1) > 1, bytes: out.data.length, width: out.info.width, height: m.pageHeight || out.info.height, original_bytes: buffer.length, note: null };
        }
      }
      return { success: false, error: 'Hareketli emoji çok ağır; daha kısa ya da daha küçük bir GIF dene.' };
    }

    // Statik (hareketli kaynak + izin yoksa ilk kare)
    for (const quality of [82, 70, 58, 45, 35]) {
      const out = await sharp(buffer, { limitInputPixels: PIXEL_LIMIT })
        .rotate()
        .resize(128, 128, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality, effort: 4 })
        .toBuffer({ resolveWithObject: true });
      if (out.data.length <= OUT_MAX_STATIC) {
        return {
          success: true, data: toDataUrl(out.data), animated: false, bytes: out.data.length, width: out.info.width, height: out.info.height, original_bytes: buffer.length,
          note: isAnimatedSource ? 'Hareketli görsel: yalnızca ilk kare kullanıldı (hareketli emoji Sauran Premium\'a özel).' : null
        };
      }
    }
    return { success: false, error: 'Görsel sıkıştırılamadı (çok ayrıntılı). Daha sade bir görsel dene.' };
  } catch (_) {
    return { success: false, error: 'Görsel işlenemedi.' };
  }
}

// data:image/...;base64,... → Buffer (yalnızca izinli türler)
function decodeImageDataUrl(dataUrl) {
  const m = typeof dataUrl === 'string' && /^data:image\/(?:png|jpe?g|webp|gif|avif|heic|heif|tiff);base64,([A-Za-z0-9+/]+=*)$/.exec(dataUrl);
  return m ? Buffer.from(m[1], 'base64') : null;
}

module.exports = { compressEmoji, decodeImageDataUrl, OUT_MAX_STATIC, OUT_MAX_ANIMATED, MAX_FRAMES };
