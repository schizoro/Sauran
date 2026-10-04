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
async function compressEmoji(buffer, { allowAnimated = false, size = 128, maxStatic = OUT_MAX_STATIC, maxAnimated = OUT_MAX_ANIMATED } = {}) {
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
      for (const [dim, quality] of [[size, 65], [Math.round(size * 0.875), 50], [Math.round(size * 0.75), 40], [Math.round(size * 0.625), 30]]) {
        const out = await sharp(buffer, { animated: true, pages: Math.min(frames, MAX_FRAMES), limitInputPixels: PIXEL_LIMIT })
          .resize(dim, dim, { fit: 'inside', withoutEnlargement: true })
          .webp({ quality, effort: 4, loop: 0 })
          .toBuffer({ resolveWithObject: true });
        if (out.data.length <= maxAnimated) {
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
        .resize(size, size, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality, effort: 4 })
        .toBuffer({ resolveWithObject: true });
      if (out.data.length <= maxStatic) {
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

// ── Profil fotoğrafı / kapak: sunucuda küçültülüp WebP'ye çevrilir. ──
// Neden: Avatar ve kapak "data URL" olarak hemen her yanıtta (arkadaş listesi, üyeler, mesajlar, profil) gelir ve her <img> onu ayrı çözer.
// Kırpılmamış 5 MB'lık hareketli GIF telefonda (özellikle iPhone) ekranı saniyelerce dondurur. Hareketli olanlar hafif hareketli WebP'ye indirilir.
const PROFILE_LIMITS = {
  avatar: { staticW: 320, animSizes: [[256, 55], [224, 45], [192, 36], [160, 30]], maxAnimated: 350 * 1024, maxStatic: 120 * 1024, frames: 60 },
  banner: { staticW: 960, animSizes: [[720, 50], [600, 42], [480, 36], [400, 30]], maxAnimated: 700 * 1024, maxStatic: 300 * 1024, frames: 60 }
};
async function compressProfileImage(buffer, kind, { allowAnimated = false } = {}) {
  const L = PROFILE_LIMITS[kind];
  if (!L || !Buffer.isBuffer(buffer) || !buffer.length) return { success: false, error: 'Geçersiz görsel.' };
  if (buffer.length > 6 * 1024 * 1024) return { success: false, error: 'Görsel çok büyük.' };
  let meta;
  try { meta = await sharp(buffer, { animated: true, limitInputPixels: PIXEL_LIMIT }).metadata(); } catch (_) { return { success: false, error: 'Görsel okunamadı.' }; }
  if (!ALLOWED_FORMATS.includes(meta.format)) return { success: false, error: 'Desteklenmeyen görsel türü.' };
  const frames = meta.pages || 1;
  const animatedSource = frames > 1;
  try {
    if (animatedSource && allowAnimated) {
      for (const [w, q] of L.animSizes) {
        const out = await sharp(buffer, { animated: true, pages: Math.min(frames, L.frames), limitInputPixels: PIXEL_LIMIT })
          .resize(w, kind === 'avatar' ? w : null, { fit: kind === 'avatar' ? 'cover' : 'inside', withoutEnlargement: true })
          .webp({ quality: q, effort: 4, loop: 0 }).toBuffer();
        if (out.length <= L.maxAnimated) return { success: true, data: toDataUrl(out), animated: true, bytes: out.length, original_bytes: buffer.length };
      }
      return { success: false, error: 'Hareketli görsel çok ağır; daha kısa ya da daha küçük bir GIF dene.' };
    }
    for (const q of [86, 74, 62, 50]) {
      const out = await sharp(buffer, { limitInputPixels: PIXEL_LIMIT }).rotate()
        .resize(L.staticW, kind === 'avatar' ? L.staticW : null, { fit: kind === 'avatar' ? 'cover' : 'inside', withoutEnlargement: true })
        .webp({ quality: q, effort: 4 }).toBuffer();
      if (out.length <= L.maxStatic) return { success: true, data: toDataUrl(out), animated: false, bytes: out.length, original_bytes: buffer.length, firstFrameOnly: animatedSource };
    }
    return { success: false, error: 'Görsel sıkıştırılamadı.' };
  } catch (_) {
    return { success: false, error: 'Görsel işlenemedi.' };
  }
}

module.exports = { compressProfileImage, compressEmoji, decodeImageDataUrl, OUT_MAX_STATIC, OUT_MAX_ANIMATED, MAX_FRAMES };
