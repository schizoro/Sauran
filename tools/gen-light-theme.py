"""Açık tema üretici: koyu temaya göre yazılmış stil dosyalarındaki sabit renkleri okur ve
`html.theme-light` önekli karşılık kurallarını client/light.css'e yazar.

Kullanım:  python tools/gen-light-theme.py
Stil dosyalarında renk değişikliği yapınca yeniden çalıştırılmalı. Elle ince ayarlar
client/light-manual.css'tedir (bu araç o dosyaya dokunmaz).

Kurallar:
- Nötr/koyu renkler (doygunluğu düşük ya da çok koyu): açıklık tersine çevrilir (zemin açılır, yazı koyulaşır).
- Canlı renkler: zeminde aynı kalır; yazı rengi olarak çok açıksa okunabilsin diye koyulaştırılır.
- rgba(255,255,255,a) (koyu zemindeki ince çizgi/yüzey) → koyu lacivert, aynı saydamlık.
- Gölgeler hafifletilir.
Seçicilerin hepsine aynı önek eklendiği için kuralların birbirine göre sırası ve önceliği korunur.
"""
import io, os, re, colorsys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
SOURCES = ['client/style.css', 'client/theme.css', 'client/layout-c.css']
OUT = 'client/light.css'
PREFIX = 'html.theme-light'  # html'de: sayfa açılırken (script.js yüklenmeden) uygulanabilsin

COLOR_PROPS = {
    'color', 'background', 'background-color', 'background-image', 'border', 'border-color', 'border-top', 'border-bottom',
    'border-left', 'border-right', 'border-top-color', 'border-bottom-color', 'border-left-color', 'border-right-color',
    'outline', 'outline-color', 'box-shadow', 'text-shadow', 'fill', 'stroke', 'caret-color', 'text-decoration-color',
    'scrollbar-color', 'accent-color', '-webkit-text-fill-color', 'column-rule-color'
}
TEXT_PROPS = {'color', '-webkit-text-fill-color', 'caret-color', 'fill', 'text-decoration-color'}
COLOR_RE = re.compile(r'#[0-9a-fA-F]{8}\b|#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3,4}\b|rgba?\([^)]*\)|hsla?\([^)]*\)')

def parse_color(tok):
    t = tok.strip()
    if t.startswith('#'):
        h = t[1:]
        if len(h) in (3, 4): h = ''.join(c * 2 for c in h)
        r, g, b = int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)
        a = int(h[6:8], 16) / 255 if len(h) == 8 else 1.0
        return r, g, b, a
    m = re.match(r'rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+%?))?\s*\)', t)
    if m:
        a = m.group(4)
        av = 1.0 if a is None else (float(a[:-1]) / 100 if a.endswith('%') else float(a))
        return float(m.group(1)), float(m.group(2)), float(m.group(3)), av
    return None  # hsl vb. olduğu gibi kalır

def fmt(r, g, b, a):
    r, g, b = (max(0, min(255, round(x))) for x in (r, g, b))
    if a >= 0.999: return '#%02x%02x%02x' % (r, g, b)
    return 'rgba(%d, %d, %d, %s)' % (r, g, b, ('%.3f' % a).rstrip('0').rstrip('.'))

def map_color(tok, prop):
    c = parse_color(tok)
    if not c: return tok
    r, g, b, a = c
    # Beyaz/neredeyse beyaz saydam katmanlar (koyu zeminde çizgi/yüzey) → koyu lacivert, aynı saydamlık
    if r > 235 and g > 235 and b > 235 and a < 0.999:
        return fmt(15, 23, 42, min(1, a * 1.05))
    # Siyah saydam (gölge/karartma) → daha hafif
    if r < 20 and g < 20 and b < 20 and a < 0.999:
        return fmt(15, 23, 42, a * (0.45 if prop in ('box-shadow', 'text-shadow') else 0.25))
    h, l, s = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
    neutral = s < 0.22 or l < 0.3 or (l > 0.88 and s < 0.6)  # koyu renkli yüzeyler (lacivert, koyu mor) de zemin sayılır
    if neutral:
        if prop in TEXT_PROPS:
            if l < 0.35: return tok  # koyu yazı koyu temada yalnızca parlak (vurgu) zeminlerde kullanılır; aynen kalır
            nl = 0.1 + (1 - l) * 0.55 if l > 0.5 else min(0.45, 1 - l)  # açık yazı → koyu yazı
        else:
            nl = 0.985 - l * 0.4 if l < 0.5 else max(0.05, 1 - l)       # koyu zemin → açık zemin (koyu katmanlar arası fark korunur)
        ns = min(s, 0.25)
        rr, gg, bb = colorsys.hls_to_rgb(h, max(0, min(1, nl)), ns)
        return fmt(rr * 255, gg * 255, bb * 255, a)
    # Canlı renk: yazıda çok açıksa koyulaştır (beyaz zeminde okunsun)
    if prop in TEXT_PROPS and l > 0.55:
        rr, gg, bb = colorsys.hls_to_rgb(h, 0.38, min(1, s * 1.05))
        return fmt(rr * 255, gg * 255, bb * 255, a)
    return tok

NAMED = {'white': '#ffffff', 'black': '#000000'}
NAMED_RE = re.compile(r'(?<![\w-])(white|black)(?![\w-])', re.I)

def map_value(val, prop):
    # Renk özelliklerindeki HER bildirim (değişmese de, var() olsa da) yazılır: aksi hâlde önekli, daha az özgül bir kural
    # orijinaldeki daha özgül kuralı ezebilir (ör. genel düğme zemini, vurgu düğmesinin degradesini).
    # url(...) içi (ör. gömülü SVG simge) olduğu gibi korunur; yalnızca dışındaki renkler dönüştürülür.
    urls = []
    def keep(m):
        urls.append(m.group(0))
        return '@@URL%d@@' % (len(urls) - 1)
    val = re.sub(r'url\((?:[^()]|\([^()]*\))*\)', keep, val)
    val = NAMED_RE.sub(lambda m: NAMED[m.group(1).lower()], val)
    val = COLOR_RE.sub(lambda m: map_color(m.group(0), prop), val)
    return re.sub(r'@@URL(\d+)@@', lambda m: urls[int(m.group(1))], val)

def split_decls(body):
    out, depth, cur = [], 0, ''
    for ch in body:
        if ch == '(': depth += 1
        elif ch == ')': depth -= 1
        if ch == ';' and depth == 0: out.append(cur); cur = ''
        else: cur += ch
    if cur.strip(): out.append(cur)
    return out

def prefix_selector(sel):
    parts, depth, cur = [], 0, ''
    for ch in sel:
        if ch == '(': depth += 1
        elif ch == ')': depth -= 1
        if ch == ',' and depth == 0: parts.append(cur); cur = ''
        else: cur += ch
    parts.append(cur)
    out = []
    for p in parts:
        p = p.strip()
        if not p: continue
        if p.startswith(':root'): return None
        if p.startswith('html'):
            out.append('html.theme-light' + p[4:]); continue  # html.reduce-motion … → html.theme-light.reduce-motion …
        out.append(PREFIX + ' ' + p)
    return ', '.join(out) if out else None

def strip_comments(s):
    return re.sub(r'/\*.*?\*/', '', s, flags=re.S)

def walk(s, out, indent=''):
    i = 0; n = len(s)
    while i < n:
        j = s.find('{', i)
        if j == -1: break
        head = s[i:j].strip()
        depth = 0; k = j
        while k < n:
            if s[k] == '{': depth += 1
            elif s[k] == '}':
                depth -= 1
                if depth == 0: break
            k += 1
        body = s[j + 1:k]
        i = k + 1
        if head.startswith('@'):
            if head.startswith('@media') or head.startswith('@supports'):
                inner = []
                walk(body, inner, indent + '  ')
                if inner: out.append(f'{indent}{head} {{\n' + '\n'.join(inner) + f'\n{indent}}}')
            continue  # @keyframes, @font-face vb. atlanır
        sel = prefix_selector(head)
        if not sel: continue
        decls = []
        for d in split_decls(body):
            if ':' not in d: continue
            prop, val = d.split(':', 1)
            prop = prop.strip().lower(); val = val.strip()
            if prop.startswith('--'):
                nv = map_value(val, 'background') if COLOR_RE.search(val) else None  # özel değişkenler: yalnızca renk taşıyanlar
            elif prop in COLOR_PROPS or (prop.startswith('border') and not prop.endswith('radius') and 'width' not in prop and 'style' not in prop and 'spacing' not in prop and 'collapse' not in prop):
                nv = map_value(val, prop)
            else:
                nv = None
            if nv: decls.append(f'{prop}: {nv}')
        if decls: out.append(f'{indent}{sel} {{ ' + '; '.join(decls) + '; }')

def main():
    os.chdir(ROOT)
    out = ['/* OTOMATİK ÜRETİLDİ — elle düzenlemeyin. Kaynak: tools/gen-light-theme.py. Elle ayarlar: light-manual.css */']
    for src in SOURCES:
        s = strip_comments(io.open(src, encoding='utf-8').read())
        out.append(f'/* ── {src} ── */')
        walk(s, out)
    io.open(OUT, 'w', encoding='utf-8', newline='\n').write('\n'.join(out) + '\n')
    print(OUT, sum(1 for l in out if '{' in l), 'kural', os.path.getsize(OUT), 'bayt')

if __name__ == '__main__':
    main()
