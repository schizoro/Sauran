import math, random
random.seed(7)
CX, CY = 256, 252
R = 214  # halka merkez yarıçapı

def pol(r, deg):
    a = math.radians(deg)
    return CX + r * math.cos(a), CY + r * math.sin(a)

out = []
add = out.append
add('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -112 512 624" width="512" height="624">')
add('''<defs>
<linearGradient id="gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffe9d6"/><stop offset=".25" stop-color="#ffa9ca"/><stop offset=".55" stop-color="#e2639a"/><stop offset=".78" stop-color="#ffc5a3"/><stop offset="1" stop-color="#c9507d"/></linearGradient>
<linearGradient id="goldB" x1="1" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff0e0"/><stop offset=".4" stop-color="#ffb8d2"/><stop offset=".75" stop-color="#e07fa8"/><stop offset="1" stop-color="#ffd9bf"/></linearGradient>
<radialGradient id="pearl" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#ffffff"/><stop offset=".55" stop-color="#ffeef4"/><stop offset="1" stop-color="#e9a9c0"/></radialGradient>
<radialGradient id="petal" cx=".5" cy=".85" r=".95"><stop offset="0" stop-color="#ff8fb6"/><stop offset=".55" stop-color="#ffc3d8"/><stop offset="1" stop-color="#fff5f8"/></radialGradient>
<radialGradient id="petalD" cx=".5" cy=".85" r=".95"><stop offset="0" stop-color="#f4709f"/><stop offset=".6" stop-color="#ffaccb"/><stop offset="1" stop-color="#ffe6ef"/></radialGradient>
<radialGradient id="core" cx=".4" cy=".35" r=".8"><stop offset="0" stop-color="#fff7c2"/><stop offset="1" stop-color="#e8a73a"/></radialGradient>
<linearGradient id="ribbon" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff9cc2"/><stop offset=".5" stop-color="#ef6f9e"/><stop offset="1" stop-color="#c94679"/></linearGradient>
<linearGradient id="ribbonSide" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e65f90"/><stop offset="1" stop-color="#a73566"/></linearGradient>
<linearGradient id="leaf" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e6f7e4"/><stop offset="1" stop-color="#8fcfa6"/></linearGradient>
<filter id="blur2" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="1.6"/></filter>
<filter id="blur8" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="9"/></filter>
<filter id="soft" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="2" stdDeviation="2.2" flood-color="#8a2a55" flood-opacity=".45"/></filter>
<g id="earShape">
  <path d="M-23,0 C-37,-48 -36,-112 -11,-146 C-5,-154 5,-154 11,-146 C36,-112 37,-48 23,0 Z" fill="url(#earOut)" stroke="#e77ca4" stroke-width="2.2" stroke-linejoin="round"/>
  <path d="M-12,-6 C-21,-48 -20,-100 -6,-130 C-2,-137 2,-137 6,-130 C20,-100 21,-48 12,-6 Z" fill="url(#earIn)"/>
  <path d="M-9,-26 C-13,-60 -11,-96 -4,-122" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" opacity=".55"/>
  <path d="M-30,-70 C-26,-100 -18,-124 -8,-140" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".6"/>
</g>
<linearGradient id="earOut" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#ffc3d8"/><stop offset=".45" stop-color="#fff0f5"/><stop offset="1" stop-color="#ffffff"/></linearGradient>
<linearGradient id="earIn" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#ff86b3"/><stop offset=".6" stop-color="#ffb4cf"/><stop offset="1" stop-color="#ffd9e6"/></linearGradient>
<clipPath id="earLow"><rect x="-60" y="-77" width="120" height="102"/></clipPath>
<clipPath id="earUp"><rect x="-60" y="-200" width="120" height="127"/></clipPath>
<path id="spark" d="M0,-10 C1.2,-3 3,-1.2 10,0 C3,1.2 1.2,3 0,10 C-1.2,3 -3,1.2 -10,0 C-3,-1.2 -1.2,-3 0,-10Z"/>
<style>
.tw{transform-box:fill-box;transform-origin:center;animation:tw 2.8s ease-in-out infinite}
@keyframes tw{0%,100%{opacity:.15;transform:scale(.45) rotate(0deg)}50%{opacity:1;transform:scale(1) rotate(45deg)}}
.sway{animation:sway 5s ease-in-out infinite alternate}
.swayB{animation:sway 6s ease-in-out -2s infinite alternate}
@keyframes sway{from{transform:rotate(-2deg)}to{transform:rotate(2.5deg)}}
.fold{animation:fold 8s ease-in-out infinite}
@keyframes fold{0%,52%{transform:rotate(0)}60%{transform:rotate(82deg)}64%{transform:rotate(70deg)}80%{transform:rotate(76deg)}90%{transform:rotate(-7deg)}95%{transform:rotate(2deg)}100%{transform:rotate(0)}}
.fl{transform-box:fill-box;transform-origin:center;animation:fl 4.6s ease-in-out infinite alternate}
@keyframes fl{from{transform:translateY(-3px) rotate(-14deg)}to{transform:translateY(5px) rotate(18deg)}}
@media (prefers-reduced-motion:reduce){.tw,.fl{animation:none;opacity:.85}.fold,.sway,.swayB{animation:none}}
</style>
</defs>''')


# ── tavşan kulakları (halkanın arkasında; tabanları halka bandıyla örtülür) ──
def ear(bx, by, ang, fold, cls):
    add(f'<g transform="translate({bx} {by}) rotate({ang})"><g class="{cls}" style="transform-origin:0 0">')
    add('<g clip-path="url(#earLow)"><use href="#earShape"/></g>')
    add('<g transform="translate(0 -75)"><g class="' + ('fold' if fold else '') + '" style="transform-origin:0 0"><g transform="translate(0 75)"><g clip-path="url(#earUp)"><use href="#earShape"/></g></g></g></g>')
    add('</g></g>')
ear(212, 56, -15, False, 'sway')
ear(300, 56, 15, True, 'swayB')

# dış yumuşak parıltı
add(f'<circle cx="{CX}" cy="{CY}" r="{R}" fill="none" stroke="#ff9ec6" stroke-width="44" opacity=".42" filter="url(#blur8)"/>')
# ana halka (gül-altın), kenar kabartması
add(f'<circle cx="{CX}" cy="{CY}" r="{R}" fill="none" stroke="#8f2f5a" stroke-width="46" opacity=".6"/>')
add(f'<circle cx="{CX}" cy="{CY}" r="{R}" fill="none" stroke="url(#gold)" stroke-width="40"/>')
add(f'<circle cx="{CX}" cy="{CY}" r="{R-11}" fill="none" stroke="url(#goldB)" stroke-width="11" opacity=".95"/>')
add(f'<circle cx="{CX}" cy="{CY}" r="{R+13}" fill="none" stroke="#fff6ea" stroke-width="2.4" opacity=".85"/>')
add(f'<circle cx="{CX}" cy="{CY}" r="{R-19}" fill="none" stroke="#fff6ea" stroke-width="1.8" opacity=".75"/>')

# ince dalgalı asma (iç ve dış)
def wave(r0, amp, freq, phase, color, w, op, a0=0, a1=360):
    pts = []
    n = 360
    for i in range(n + 1):
        d = a0 + (a1 - a0) * i / n
        r = r0 + amp * math.sin(math.radians(d * freq + phase))
        pts.append(pol(r, d))
    dstr = 'M' + ' L'.join(f'{x:.1f},{y:.1f}' for x, y in pts)
    add(f'<path d="{dstr}" fill="none" stroke="{color}" stroke-width="{w}" stroke-linecap="round" opacity="{op}"/>')
wave(R + 28, 4, 12, 0, '#ffd3e3', 2.2, .9)
wave(R - 27, 3, 9, 90, '#ffe9f1', 1.8, .85)

# inci dizisi
for i in range(48):
    d = i * 7.5
    if 78 < d < 102:  # alt plaket
        continue
    x, y = pol(R, d)
    add(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="5.6" fill="url(#pearl)" stroke="#d98aa9" stroke-width=".6"/>')

# yapraklar (dış tarafa, çiçek kümelerine yakın)
def leaf(deg, r, length, ang_off, fill='url(#leaf)'):
    x, y = pol(r, deg)
    rot = deg + ang_off
    add(f'<ellipse cx="{x:.1f}" cy="{y:.1f}" rx="{length}" ry="{length*0.36:.1f}" transform="rotate({rot:.1f} {x:.1f} {y:.1f})" fill="{fill}" stroke="#7fbf98" stroke-width=".8" opacity=".95"/>')
for deg in (200, 208, 216, 232, 240, 248, 20, 28, 36, 52, 60, 68):
    leaf(deg, R + 24, 15, 90 + (12 if deg % 2 else -12))

# çiçek
def flower(cx, cy, size, rot=0, dark=False, petals=5):
    g = 'petalD' if dark else 'petal'
    add(f'<g transform="translate({cx:.1f} {cy:.1f}) rotate({rot})" filter="url(#soft)">')
    for k in range(petals):
        a = k * 360 / petals
        add(f'<g transform="rotate({a})"><path d="M0,0 C{-size*0.55:.1f},{-size*0.35:.1f} {-size*0.62:.1f},{-size*1.05:.1f} 0,{-size*1.12:.1f} C{size*0.62:.1f},{-size*1.05:.1f} {size*0.55:.1f},{-size*0.35:.1f} 0,0Z" fill="url(#{g})" stroke="#e77ca4" stroke-width=".9"/><path d="M0,{-size*0.2:.1f} L0,{-size*0.82:.1f}" stroke="#ffffff" stroke-width=".9" opacity=".55"/></g>')
    add(f'<circle r="{size*0.22:.1f}" fill="url(#core)" stroke="#c88a2a" stroke-width=".8"/>')
    for k in range(7):
        a = math.radians(k * 360 / 7)
        add(f'<circle cx="{math.cos(a)*size*0.34:.1f}" cy="{math.sin(a)*size*0.34:.1f}" r="{size*0.05:.1f}" fill="#f6c24a"/>')
    add('</g>')

def cluster(deg, scale=1.0, flip=1):
    x, y = pol(R + 2, deg)
    tx, ty = -math.sin(math.radians(deg)) * flip, math.cos(math.radians(deg)) * flip
    flower(x, y, 34 * scale, deg + 10, False)
    flower(x + tx * 40 * scale, y + ty * 40 * scale, 22 * scale, deg + 40, True)
    flower(x - tx * 38 * scale, y - ty * 38 * scale, 18 * scale, deg - 20, False)
    flower(x + tx * 66 * scale, y + ty * 66 * scale, 12 * scale, deg, True)
cluster(222, 1.12)
cluster(40, 1.0, -1)

# küçük tomurcuklar
for deg, s in ((300, 13), (330, 10), (150, 13), (120, 10), (185, 9), (10, 9)):
    x, y = pol(R + 2, deg)
    flower(x, y, s, deg, deg % 20 == 0)

# üstte kurdele (fiyonk)
bx, by = pol(R + 4, -90)
add(f'<g transform="translate({bx:.1f} {by+4:.1f}) scale(0.9)" filter="url(#soft)">')
add('<path d="M-6,4 C-34,-26 -66,-18 -58,6 C-52,26 -22,22 -6,6Z" fill="url(#ribbon)" stroke="#b83f6e" stroke-width="1.2"/>')
add('<path d="M6,4 C34,-26 66,-18 58,6 C52,26 22,22 6,6Z" fill="url(#ribbon)" stroke="#b83f6e" stroke-width="1.2"/>')
add('<path d="M-6,4 C-26,-10 -48,-8 -50,4" fill="none" stroke="#ffd1e2" stroke-width="2" opacity=".7"/>')
add('<path d="M6,4 C26,-10 48,-8 50,4" fill="none" stroke="#ffd1e2" stroke-width="2" opacity=".7"/>')
add('<path d="M-4,10 L-26,40 L-12,38 L-4,52 L4,10Z" fill="url(#ribbonSide)" stroke="#a73566" stroke-width="1"/>')
add('<path d="M4,10 L26,40 L12,38 L4,52 L-4,10Z" fill="url(#ribbonSide)" stroke="#a73566" stroke-width="1"/>')
add('<ellipse cx="0" cy="3" rx="11" ry="12" fill="url(#ribbon)" stroke="#b83f6e" stroke-width="1.2"/>')
add('<circle cx="-3" cy="-1" r="3.2" fill="#fff" opacity=".6"/>')
add('</g>')

# alt plaket: kurdele bandı "SUPPORTER"
px, py = CX, 492
add(f'<g transform="translate({px} {py})" filter="url(#soft)">')
add('<path d="M-132,-14 L-176,-6 L-160,12 L-176,30 L-126,24Z" fill="url(#ribbonSide)" stroke="#a73566" stroke-width="1.2"/>')
add('<path d="M132,-14 L176,-6 L160,12 L176,30 L126,24Z" fill="url(#ribbonSide)" stroke="#a73566" stroke-width="1.2"/>')
add('<rect x="-138" y="-24" width="276" height="50" rx="25" fill="url(#ribbon)" stroke="#fff2dc" stroke-width="3"/>')
add('<rect x="-131" y="-17" width="262" height="36" rx="18" fill="none" stroke="#ffd7a8" stroke-width="1.4" opacity=".9"/>')
add('<text x="0" y="8.5" text-anchor="middle" font-family="\'Segoe UI\',Arial,Helvetica,sans-serif" font-weight="800" font-size="25" letter-spacing="3.2" fill="#fff9ef" stroke="#a73566" stroke-width=".7" paint-order="stroke">SUPPORTER</text>')
add('</g>')
# plaket yanlarında küçük inciler
for sx in (-1, 1):
    add(f'<circle cx="{px + sx*150}" cy="{py+2}" r="4.4" fill="url(#pearl)" stroke="#d98aa9" stroke-width=".6"/>')

# metalik vurgu (üst-sol parlak, alt-sağ gölge)
def arc(r, a0, a1, color, w, op, blur=False):
    pts = [pol(r, a0 + (a1 - a0) * i / 60) for i in range(61)]
    d = 'M' + ' L'.join(f'{x:.1f},{y:.1f}' for x, y in pts)
    f = ' filter="url(#blur2)"' if blur else ''
    add(f'<path d="{d}" fill="none" stroke="{color}" stroke-width="{w}" stroke-linecap="round" opacity="{op}"{f}/>')
arc(R + 4, 150, 330, '#ffffff', 6, .5, True)
arc(R + 4, 188, 262, '#ffffff', 2.6, .9)
arc(R - 6, 8, 78, '#7d2650', 7, .35, True)

# savrulan yapraklar (halkanın dışında, hafif süzülür)
for deg, rr, sz, dl in ((262, 246, 11, 0), (300, 244, 9, 1.2), (338, 246, 10, .6), (150, 246, 9, 2), (118, 242, 8, 1.6), (186, 246, 10, .3), (8, 246, 9, 2.4)):
    x, y = pol(rr, deg)
    add(f'<g transform="translate({x:.1f} {y:.1f}) rotate({deg+90})"><path class="fl" style="animation-delay:{dl}s" d="M0,0 C{-sz*0.7:.1f},{-sz*0.6:.1f} {-sz*0.6:.1f},{-sz*1.5:.1f} 0,{-sz*1.7:.1f} C{sz*0.6:.1f},{-sz*1.5:.1f} {sz*0.7:.1f},{-sz*0.6:.1f} 0,0Z" fill="url(#petal)" stroke="#e77ca4" stroke-width=".7" opacity=".95"/></g>')

# pırıltılar (animasyonlu)
sp = [(-62, 276, 7, 0), (-20, 188, 10, .4), (14, 232, 8, 1.1), (118, 270, 6, .8), (160, 266, 9, 1.5), (196, 232, 7, .2), (245, 300, 9, 1.9), (290, 262, 6, .6), (330, 218, 8, 1.3), (350, 240, 6, 2.2), (260, 196, 7, .9), (-30, 238, 11, 1.7), (95, 262, 8, 2.5), (178, 240, 12, .5), (212, 270, 7, 2.1), (310, 268, 10, 1.0), (28, 266, 7, .7)]
for deg, r, s, dl in sp:
    x, y = pol(r, deg)
    add(f'<g transform="translate({x:.1f} {y:.1f}) scale({s/8:.2f})"><use href="#spark" fill="#fff" class="tw" style="animation-delay:{dl}s"/></g>')

add('</svg>')
svg = '\n'.join(out)
open(r'C:\Users\7kmht\OneDrive\Masaüstü\Sauran\client\assets\frame-supporter-rose.svg', 'w', encoding='utf-8', newline='\n').write(svg)
print(len(svg))
