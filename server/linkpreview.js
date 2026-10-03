// Mesajdaki ilk bağlantı için önizleme (başlık, açıklama, site adı, küçük görsel).
//
// GÜVENLİK (SSRF): sunucu, kullanıcının yazdığı adrese istek atar; bu yüzden
//   - yalnızca http/https, yalnızca 80/443 portları, kullanıcı adı/şifre içeren adres yok;
//   - DNS çözümlemesi bağlantının KENDİSİNDE denetlenir (lookup kancası): özel/yerel/ayrılmış IP'lere
//     (127/8, 10/8, 172.16/12, 192.168/16, 169.254/16 bulut meta verisi, 100.64/10, ::1, fc00::/7, fe80::/10 …)
//     bağlanılmaz; DNS yeniden bağlama (rebinding) da böylece işe yaramaz;
//   - yönlendirmeler elle, en fazla 3 kez ve her adımda aynı denetimle izlenir;
//   - 5 sn zaman aşımı, HTML'den en fazla 512 KB, görselden en fazla 800 KB okunur; çerez gönderilmez.
// GİZLİLİK: görsel sunucu tarafından indirilip /api/link-preview/image/:id üzerinden servis edilir; okuyucuların
// tarayıcısı üçüncü taraf siteye hiç bağlanmaz (IP adresi sızmaz).
const http = require('http');
const https = require('https');
const dns = require('dns');
const net = require('net');
const crypto = require('crypto');

const TIMEOUT_MS = 5000;
const MAX_HTML_BYTES = 512 * 1024;
const MAX_IMAGE_BYTES = 800 * 1024;
const MAX_REDIRECTS = 3;
const USER_AGENT = 'Mozilla/5.0 (compatible; SauranBot/1.0; +https://sauran.online)';
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

function allowPrivate() {
  return process.env.LINK_PREVIEW_ALLOW_PRIVATE === '1' && process.env.NODE_ENV !== 'production';
}

function ipv4ToInt(ip) {
  return ip.split('.').reduce((acc, part) => (acc << 8) + Number(part), 0) >>> 0;
}

function inCidr4(ip, base, bits) {
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  return (ipv4ToInt(ip) & mask) === (ipv4ToInt(base) & mask);
}

const BLOCKED_V4 = [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16], ['172.16.0.0', 12],
  ['192.0.0.0', 24], ['192.0.2.0', 24], ['192.88.99.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15], ['198.51.100.0', 24],
  ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4]
];

function isBlockedIp(ip) {
  if (net.isIPv4(ip)) return BLOCKED_V4.some(([base, bits]) => inCidr4(ip, base, bits));
  if (net.isIPv6(ip)) {
    const lower = ip.toLowerCase();
    const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isBlockedIp(mapped[1]);
    if (lower === '::' || lower === '::1') return true;
    if (/^f[cd]/.test(lower)) return true;          // fc00::/7 benzersiz yerel
    if (/^fe[89ab]/.test(lower)) return true;       // fe80::/10 bağlantı yerel
    if (/^ff/.test(lower)) return true;             // çok noktaya yayın
    if (/^2001:db8:/.test(lower)) return true;      // belgeleme
    if (/^64:ff9b:/.test(lower)) return true;       // NAT64 (içerdeki v4'e gidebilir)
    return false;
  }
  return true;
}

function safeLookup(hostname, options, callback) {
  dns.lookup(hostname, { ...options, all: true }, (error, addresses) => {
    if (error) return callback(error);
    const list = Array.isArray(addresses) ? addresses : [{ address: addresses, family: net.isIPv6(addresses) ? 6 : 4 }];
    const bad = list.find((a) => isBlockedIp(a.address));
    if (bad && !allowPrivate()) return callback(Object.assign(new Error('blocked-address'), { code: 'EBLOCKED' }));
    if (options && options.all) return callback(null, list);
    return callback(null, list[0].address, list[0].family);
  });
}

function checkUrl(raw) {
  let url;
  try { url = new URL(raw); } catch (_) { return null; }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  if (url.username || url.password) return null;
  if (url.port && !['80', '443'].includes(url.port) && !allowPrivate()) return null;
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (net.isIP(host) && isBlockedIp(host) && !allowPrivate()) return null;
  if (/^(localhost|.*\.local|.*\.internal|.*\.localhost)$/i.test(host) && !allowPrivate()) return null;
  url.hash = '';
  return url;
}

// Tek istek; gövdeyi en fazla maxBytes okur. Yönlendirmede { redirect } döner.
function requestOnce(url, { maxBytes, accept }) {
  return new Promise((resolve, reject) => {
    const lib = url.protocol === 'https:' ? https : http;
    const req = lib.request(url, {
      method: 'GET',
      lookup: safeLookup,
      timeout: TIMEOUT_MS,
      headers: { 'User-Agent': USER_AGENT, Accept: accept, 'Accept-Language': 'tr,en;q=0.8' }
    }, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        res.resume();
        return resolve({ redirect: new URL(res.headers.location, url).toString() });
      }
      if (res.statusCode < 200 || res.statusCode >= 300) {
        res.resume();
        return reject(new Error(`status-${res.statusCode}`));
      }
      const chunks = [];
      let size = 0;
      res.on('data', (chunk) => {
        size += chunk.length;
        if (size > maxBytes) {
          chunks.push(chunk.subarray(0, Math.max(0, chunk.length - (size - maxBytes))));
          res.destroy();
          return;
        }
        chunks.push(chunk);
      });
      const done = () => resolve({ body: Buffer.concat(chunks), headers: res.headers, truncated: size > maxBytes });
      res.on('end', done);
      res.on('close', done);
      res.on('error', reject);
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject);
    req.end();
  });
}

async function safeGet(rawUrl, opts) {
  let current = rawUrl;
  for (let i = 0; i <= MAX_REDIRECTS; i += 1) {
    const url = checkUrl(current);
    if (!url) throw new Error('bad-url');
    const res = await requestOnce(url, opts);
    if (res.redirect) { current = res.redirect; continue; }
    return { ...res, finalUrl: url.toString() };
  }
  throw new Error('too-many-redirects');
}

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'" };
function decodeEntities(text) {
  return String(text || '').replace(/&(#x[0-9a-f]+|#\d+|[a-z]+\d*);/gi, (m, code) => {
    if (code[0] === '#') {
      const n = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : '';
    }
    return ENTITIES[code.toLowerCase()] ?? m;
  });
}

function clean(text, max) {
  const t = decodeEntities(text).replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
}

function decodeHtml(buffer, contentType) {
  let charset = (String(contentType || '').match(/charset=([\w-]+)/i) || [])[1];
  if (!charset) {
    const head = buffer.subarray(0, 2048).toString('latin1');
    charset = (head.match(/<meta[^>]+charset=["']?([\w-]+)/i) || [])[1];
  }
  try { return new TextDecoder(charset || 'utf-8').decode(buffer); } catch (_) { return buffer.toString('utf8'); }
}

function parseMeta(html) {
  const head = html.slice(0, 300000);
  const meta = {};
  const tagRe = /<meta\b[^>]*>/gi;
  let m;
  while ((m = tagRe.exec(head))) {
    const tag = m[0];
    const key = (tag.match(/\b(?:property|name)\s*=\s*["']([^"']+)["']/i) || [])[1];
    const content = (tag.match(/\bcontent\s*=\s*"([^"]*)"/i) || tag.match(/\bcontent\s*=\s*'([^']*)'/i) || [])[1];
    if (key && content != null && !(key.toLowerCase() in meta)) meta[key.toLowerCase()] = content;
  }
  const title = (head.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1];
  return { meta, title };
}

// Önizleme verisi: { url, title, description, site_name, image_url } ya da null.
async function fetchPreview(rawUrl) {
  const page = await safeGet(rawUrl, { maxBytes: MAX_HTML_BYTES, accept: 'text/html,application/xhtml+xml' });
  const type = String(page.headers['content-type'] || '');
  if (!/text\/html|application\/xhtml/i.test(type)) return null;
  const { meta, title } = parseMeta(decodeHtml(page.body, type));
  const finalUrl = new URL(page.finalUrl);
  const result = {
    url: page.finalUrl,
    title: clean(meta['og:title'] || meta['twitter:title'] || title || '', 160),
    description: clean(meta['og:description'] || meta['twitter:description'] || meta.description || '', 300),
    site_name: clean(meta['og:site_name'] || finalUrl.hostname.replace(/^www\./, ''), 60),
    image_url: null
  };
  const img = meta['og:image:secure_url'] || meta['og:image'] || meta['og:image:url'] || meta['twitter:image'] || meta['twitter:image:src'];
  if (img) {
    try { result.image_url = new URL(decodeEntities(img), finalUrl).toString(); } catch (_) { /* yoksay */ }
  }
  if (!result.title && !result.description) return null;
  return result;
}

// Görseli indirir; { mime, data(Buffer) } ya da null.
async function fetchImage(rawUrl) {
  const res = await safeGet(rawUrl, { maxBytes: MAX_IMAGE_BYTES, accept: IMAGE_TYPES.join(',') });
  if (res.truncated) return null;
  const mime = String(res.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
  if (!IMAGE_TYPES.includes(mime)) return null;
  // İçerik gerçekten bildirilen türde mi (sihirli baytlar)?
  const b = res.body;
  const ok = (mime === 'image/png' && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])))
    || (mime === 'image/jpeg' && b[0] === 0xff && b[1] === 0xd8)
    || (mime === 'image/gif' && b.subarray(0, 4).toString('latin1') === 'GIF8')
    || (mime === 'image/webp' && b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP');
  return ok ? { mime, data: b } : null;
}

// Metindeki ilk http(s) bağlantısı. <adres> biçiminde yazılan (önizlemesi istenmeyen) bağlantılar atlanır.
function firstUrl(text) {
  const source = String(text || '');
  if (/^\s*https:\/\/media[0-9]*\.giphy\.com\/media\//i.test(source)) return null; // GIF mesajı: kart gerekmez
  const re = /(<)?(https?:\/\/[^\s<>"']+)(>)?/gi;
  let m;
  while ((m = re.exec(source))) {
    if (m[1] && m[3]) continue;
    const url = m[2].replace(/[),.!?;:]+$/, '');
    if (checkUrl(url)) return url;
  }
  return null;
}

function urlKey(url) {
  return crypto.createHash('sha256').update(String(url)).digest('hex').slice(0, 32);
}

module.exports = { fetchPreview, fetchImage, firstUrl, urlKey, checkUrl, isBlockedIp };
