# Ateş / mürekkep dumanı simülasyonu → dikişsiz döngü kareleri (siyah zemin; uygulamada 'screen' karışımıyla ışık gibi biner).
# Kullanım: python simfx.py fire|ink <çıktı_klasörü> [preview]
import sys, os, math
import numpy as np
from PIL import Image

rng = np.random.default_rng(7)
LAT = {}

def lattice(px, py, key):
    k = (px, py, key)
    if k not in LAT:
        LAT[k] = np.random.default_rng(hash(k) & 0xffffffff).random((py, px)).astype(np.float32)
    return LAT[k]

def vnoise(x, y, px, py, key):
    """Periyodik değer gürültüsü (x periyodu px, y periyodu py)."""
    g = lattice(px, py, key)
    xi = np.floor(x).astype(np.int64); yi = np.floor(y).astype(np.int64)
    xf = x - xi; yf = y - yi
    u = xf * xf * (3 - 2 * xf); v = yf * yf * (3 - 2 * yf)
    x0 = xi % px; x1 = (xi + 1) % px; y0 = yi % py; y1 = (yi + 1) % py
    a = g[y0, x0]; b = g[y0, x1]; c = g[y1, x0]; d = g[y1, x1]
    return (a + (b - a) * u) * (1 - v) + (c + (d - c) * u) * v

def fbm(x, y, px, py, key, oct=5, gain=0.5):
    s = 0.0; amp = 0.5; norm = 0.0
    for i in range(oct):
        f = 2 ** i
        s = s + amp * vnoise(x * f, y * f, px * f, py * f, (key, i)); norm += amp; amp *= gain
    return s / norm

def ramp(v, stops):
    v = np.clip(v, 0, 1)
    out = np.zeros(v.shape + (3,), np.float32)
    for (a, ca), (b, cb) in zip(stops[:-1], stops[1:]):
        m = (v >= a) & (v <= b)
        t = ((v - a) / (b - a))[m][:, None]
        out[m] = np.array(ca, np.float32) * (1 - t) + np.array(cb, np.float32) * t
    return out

def fire_frame(t, W=720, H=360):
    # t: 0..1 döngü evresi. Her gürültü katmanı döngü boyunca y'de tam sayı periyot kayar → dikişsiz.
    xs = (np.arange(W, dtype=np.float32) + 0.5) / W
    ys = (np.arange(H, dtype=np.float32) + 0.5) / H
    X, Y = np.meshgrid(xs, ys)          # Y: 0 üst, 1 alt
    up = 1 - Y                          # 0 alt, 1 üst
    PX, PY = 8, 4
    q = fbm(X * PX, up * PY + t * PY * 1, PX, PY, 'q', 4)            # yavaş bükülme (1 periyot/tur)
    r = fbm(X * PX * 1.3 + 3.1, up * PY + t * PY * 2, PX * 1.3 and PX, PY, 'r', 4)
    # dikeyde uzatılmış gürültü → sivri, ayrışmış alev dilleri (x'te sık, y'de seyrek)
    n = fbm(X * 16 + (q - 0.5) * 2.6, up * 4 + (r - 0.5) * 1.2 + t * 4 * 3, 16, 4, 'n', 5)
    d = fbm(X * 32, up * 8 + t * 8 * 4, 32, 8, 'd', 3)                          # ince titreşim
    edge = np.clip(np.abs(X - 0.5) * 2, 0, 1)
    height = 0.40 + 0.55 * (edge ** 1.6)                                          # yanlarda yüksek, ortada (butonlar) alçak
    h = up / height
    heat = n * 1.5 + (d - 0.5) * 0.35 - h * 1.15 + 0.05
    heat = np.clip(heat, 0, None) ** 1.25 * 1.9
    heat += np.clip(1 - up / 0.08, 0, 1) * 0.22 * (0.6 + 0.4 * edge)               # tabanda kor yatağı (beyaza doymasın)
    heat = np.clip(heat * (0.72 + 0.28 * edge), 0, 0.98)                           # orta (alt butonlar) daha sönük, beyaz yok
    col = ramp(heat / 1.1, [(0, (0, 0, 0)), (0.18, (60, 4, 0)), (0.35, (170, 30, 0)), (0.55, (240, 95, 10)), (0.75, (255, 175, 50)), (0.9, (255, 235, 150)), (1, (255, 255, 240))])
    return col

def ink_frame(t, W=360, H=640):
    xs = (np.arange(W, dtype=np.float32) + 0.5) / W
    ys = (np.arange(H, dtype=np.float32) + 0.5) / H
    X, Y = np.meshgrid(xs, ys)
    up = 1 - Y
    PX, PY = 4, 6
    q = fbm(X * PX, up * PY + t * PY, PX, PY, 'iq', 4)
    r = fbm(X * PX + 5.2, up * PY + t * PY * 2, PX, PY, 'ir', 4)
    n = fbm(X * 6 + (q - 0.5) * 3.0, up * 9 + (r - 0.5) * 3.0 + t * 9 * 2, 6, 9, 'in', 5)
    # duman kenarlardan ve alt köşelerden yükselir; ortada (içerik) çok zayıf
    edge = np.clip(np.abs(X - 0.5) * 2, 0, 1)
    side = np.clip((edge - 0.55) / 0.45, 0, 1) ** 1.3
    bottom = np.clip(1 - up / 0.35, 0, 1) ** 1.5 * (0.35 + 0.65 * edge)
    mask = np.maximum(side * (0.55 + 0.45 * np.clip(1 - up, 0, 1)), bottom)
    wisp = np.clip((n - 0.42) * 3.2, 0, 1)
    rim = np.clip(1 - np.abs(n - 0.5) * 9, 0, 1)       # dumanın kıvrım kenarlarında ışıklı çizgi
    v = (wisp * 0.75 + rim * 0.55) * mask
    col = ramp(v, [(0, (0, 0, 0)), (0.25, (25, 12, 70)), (0.5, (80, 40, 190)), (0.75, (150, 105, 255)), (1, (225, 205, 255))])
    return col

if __name__ == '__main__':
    kind, out = sys.argv[1], sys.argv[2]
    preview = len(sys.argv) > 3
    os.makedirs(out, exist_ok=True)
    frames = 120 if kind == 'fire' else 180          # 4 sn / 6 sn @30
    fn = fire_frame if kind == 'fire' else ink_frame
    rng_list = [0, frames // 3] if preview else range(frames)
    for i in rng_list:
        img = fn(i / frames)
        Image.fromarray(np.clip(img, 0, 255).astype(np.uint8)).save(os.path.join(out, f'{i:04d}.png'))
    print('ok', kind, len(list(rng_list)))
