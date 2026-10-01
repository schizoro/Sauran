// Lobi kelime filtresi (otomatik moderasyon).
//
// Eşleştirme kelime bazlıdır (bir kelimenin içinde geçen parça yakalanmaz; "sikke", "Scunthorpe" gibi masum kelimeler
// takılmasın diye). Terim sonunda * varsa o kökle BAŞLAYAN her kelime eşleşir ("orospu*" → "orospular").
// Kaçamaklara karşı karşılaştırmadan önce iki taraf da aynı biçime getirilir:
//   - küçük harf (Türkçe kuralıyla), aksan/çengel düşer (ç→c, ş→s, ğ→g, ö→o, ü→u). "ı" ile "i" AYRI tutulur:
//     birleştirilseydi "sık", "sıkıntı" gibi çok yaygın kelimeler yanlışlıkla yakalanırdı.
//   - basit leet: 0→o 1→i 3→e 4→a 5→s 7→t @→a $→s
//   - aynı harfin tekrarı teke iner ("amkkk" → "amk", "yarrak" → "yarak")
//   - kelime içine sokulan nokta/tire/alt çizgi yok sayılır ("s.i.k" → "sik")

const LEET = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', '@': 'a', $: 's' };

function normalizeWord(word) {
  return String(word || '')
    .toLocaleLowerCase('tr')
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .replace(/[013457@$]/g, (ch) => LEET[ch])
    .replace(/[^\p{L}\p{N}]+/gu, '')
    .replace(/(.)\1+/gu, '$1');
}

// Hazır liste: yalnızca neredeyse her bağlamda küfür/hakaret olan kelimeler. Yanlış pozitif riski olan kısa ya da çok
// anlamlı kelimeler (ör. "göt" → "got" İngilizce "got" ile çakışır) bilerek yoktur; lobi kendi listesine ekleyebilir.
const PRESET_TERMS = [
  'amk', 'amq', 'aq', 'mk', 'amına*', 'amina*', 'aminakoyim', 'amcık*', 'amcik*',
  'orospu*', 'orosbu*', 'piç', 'piçler', 'piçlik', 'pezevenk*', 'gavat*', 'kahpe*', 'ibne*', 'yavşak*', 'götveren*',
  'sikerim', 'sikeyim', 'sikiyim', 'sikik', 'sikim', 'siktir*', 'siktiğim*', 'sikmek', 'sikiş*', 'yarrak*', 'yarak',
  'fuck*', 'motherfuck*', 'shit', 'bullshit', 'bitch*', 'cunt*', 'nigger*', 'nigga*', 'faggot*', 'whore*'
];

const MAX_TERMS = 200;
const MAX_TERM_LENGTH = 40;

// Kullanıcının girdiği listeyi temizler: virgül/satır ile ayrılmış, boşluksuz kelimeler; sonda isteğe bağlı tek *.
function parseTerms(input) {
  const raw = Array.isArray(input) ? input : String(input || '').split(/[\n,;]+/);
  const seen = new Set();
  const terms = [];
  for (const item of raw) {
    let term = String(item || '').trim();
    if (!term) continue;
    const prefix = term.endsWith('*');
    term = term.replace(/\*+$/, '').trim();
    if (!term || /\s/.test(term) || term.length > MAX_TERM_LENGTH) continue;
    const key = normalizeWord(term) + (prefix ? '*' : '');
    if (!normalizeWord(term) || seen.has(key)) continue;
    seen.add(key);
    terms.push(term.toLocaleLowerCase('tr') + (prefix ? '*' : ''));
    if (terms.length >= MAX_TERMS) break;
  }
  return terms;
}

function compileTerms(terms) {
  const exact = new Set();
  const prefixes = [];
  for (const term of terms) {
    const prefix = term.endsWith('*');
    const norm = normalizeWord(term.replace(/\*+$/, ''));
    if (!norm) continue;
    if (prefix) prefixes.push(norm); else exact.add(norm);
  }
  return { exact, prefixes };
}

const presetCompiled = compileTerms(PRESET_TERMS);

// Kelime: harf/rakam ve aralarına sokulmuş . - _ * gibi ayraçlar (leet karakterleri dahil).
const TOKEN_RE = /[\p{L}\p{N}@$]+(?:[._\-*'’]+[\p{L}\p{N}@$]+)*/gu;

function matches(norm, compiled) {
  if (!norm) return false;
  if (compiled.exact.has(norm)) return true;
  return compiled.prefixes.some((p) => norm.startsWith(p));
}

// text içindeki yasaklı kelimeleri bulur. masked: her yasaklı kelime aynı uzunlukta yıldızla değiştirilmiş metin.
function scan(text, { terms = [], usePreset = false } = {}) {
  const source = String(text || '');
  const custom = compileTerms(terms);
  const hits = [];
  const masked = source.replace(TOKEN_RE, (token) => {
    const norm = normalizeWord(token);
    if (matches(norm, custom) || (usePreset && matches(norm, presetCompiled))) {
      hits.push(token);
      return '*'.repeat([...token].length);
    }
    return token;
  });
  return { hit: hits.length > 0, hits, masked };
}

module.exports = { scan, parseTerms, normalizeWord, PRESET_TERMS, MAX_TERMS, MAX_TERM_LENGTH };
