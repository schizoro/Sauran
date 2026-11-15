/* Profil sahne efektleri (Kedi Partisi · Neon Devre · Ay Işığı Koileri · Astral Mercek · Kiraz Bahçesi;
   2026-11-15'ten beri Sakura · Sahne Işıkları · Alev · Mürekkep · Yıldırım · Tatlı da — eskiden avatar içi / kenar SVG idi).
   Kaynak: kullanıcının hazırladığı "Profile Effects Atelier" paketi (Canvas 2D), Sauran'a uyarlandı:
   - Discord'daki gibi: profil her açıldığında GİRİŞ hareketi oynar, sonra sakin DÖNGÜ.
   - 12 fps (motion-clock ile aynı kare hızı): ölçümde 60 fps sürümü telefonda ana iş parçacığını %10–32 meşgul ediyordu.
   - Kart ekranda değilken (pencere kapalı, kaydırılmış, sekme gizli) hiç çizmez; yeniden görününce girişi baştan oynatır.
   - Çizim alanı kartın gerçek ölçüsüne uyar: genişlik 450 birim kabul edilir, yükseklik karta göre değişir (H).
     Avatar konumu karttan okunur; halka/yörünge gibi öğeler avatarın etrafına yerleşir, kenar öğeleri kenarlara.
   - Mağaza küçük resimlerinde (.st-prof) tek sabit kare çizilir (çok sayıda kart aynı anda canlanmasın).
   - Hareketi azalt (sistem ayarı veya Ayarlar > Hareket) → sakin döngüden tek sabit kare.
   - Kedi görselleri yalnızca Kedi Partisi seçiliyken ve bir kez yüklenir (küçültülmüş WebP, /fx/ klasörü).
   Bağlantı: applyProfileEffect'i sarar; script.js'ten sonra yüklenir. (Eski SVG/CSS efekt paketi fx-pack.js 2026-11-15'te kaldırıldı.) */
(function () {
    'use strict';
    const SCENES = { catparty: 'Kedi Partisi', neon: 'Neon Devre', koi: 'Ay Işığı Koileri', astral: 'Astral Mercek', cherry: 'Kiraz Bahçesi',
        sakura: 'Sakura', stagelights: 'Sahne Işıkları', flame: 'Alev', ink: 'Mürekkep', storm: 'Yıldırım', sweet: 'Tatlı' };
    const FPS = 12, STEP = 1000 / FPS, STILL_T = 3.7, MAX_DPR = 2;
    // Sabit karenin anı: mağaza küçük resmi en dikkat çekici an (kediler havada), hareketi azalt ise içeriği kapatmayan sakin an
    // Yıldırım küçük resmi şimşek anında; Tatlı'da kalpler avatardan fışkırırken
    const THUMB_T = { catparty: 1.0, storm: 0.5, sweet: 0.6 }, CALM_T = { catparty: 4.75 };
    const TAU = Math.PI * 2, INK = '#22163a';

    // ── yardımcılar ──
    const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
    const mix = (a, b, t) => a + (b - a) * t;
    const ease = (v) => { v = clamp(v); return 1 - Math.pow(1 - v, 3); };
    const smooth = (a, b, v) => { v = clamp((v - a) / (b - a)); return v * v * (3 - 2 * v); };
    const back = (v) => { v = clamp(v); const s = 1.70158; return 1 + (s + 1) * Math.pow(v - 1, 3) + s * Math.pow(v - 1, 2); };
    const rnd = (n) => { const x = Math.sin(n * 127.1 + 78.233) * 43758.5453; return x - Math.floor(x); };
    const period = (t, len) => ((t % len) + len) % len;
    function alpha(ctx, a, fn) { ctx.save(); ctx.globalAlpha *= clamp(a); fn(); ctx.restore(); }
    function line(ctx, color, w) { ctx.strokeStyle = color; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; }
    function ellipse(ctx, x, y, rx, ry, fill, stroke = null, w = 1) { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, TAU); if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { line(ctx, stroke, w); ctx.stroke(); } }
    // roundRect iOS 15 ve öncesinde yok: elle yuvarlatılmış dikdörtgen
    function rrPath(ctx, x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
    function rounded(ctx, x, y, w, h, r, fill, stroke = null, sw = 1) { rrPath(ctx, x, y, w, h, r); if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { line(ctx, stroke, sw); ctx.stroke(); } }
    function poly(ctx, pts, fill, stroke = null, sw = 1) { ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.closePath(); if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { line(ctx, stroke, sw); ctx.stroke(); } }
    function star(ctx, x, y, r, color = '#fff4c2', scale = 1) { ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale); ctx.beginPath(); ctx.moveTo(0, -r); ctx.quadraticCurveTo(r * 0.18, -r * 0.16, r, 0); ctx.quadraticCurveTo(r * 0.15, r * 0.19, 0, r); ctx.quadraticCurveTo(-r * 0.19, r * 0.19, -r, 0); ctx.quadraticCurveTo(-r * 0.16, -r * 0.16, 0, -r); ctx.fillStyle = color; ctx.fill(); ctx.restore(); }
    function flare(ctx, x, y, r, color = '#fff6d5', a = 1) { alpha(ctx, a, () => { ellipse(ctx, x, y, r * 1.45, r * 1.45, color); star(ctx, x, y, r * 2.2, color); }); }
    function ring(ctx, x, y, rx, ry, color, width, opacity = 1, rotation = 0) { alpha(ctx, opacity, () => { ctx.save(); ctx.translate(x, y); ctx.rotate(rotation); ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, TAU); line(ctx, color, width); ctx.stroke(); ctx.restore(); }); }
    function bezierStroke(ctx, pts, color, width) { ctx.beginPath(); ctx.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 6) ctx.bezierCurveTo(...pts.slice(i, i + 6)); line(ctx, color, width); ctx.stroke(); }
    function petal(ctx, x, y, sz, rot, fill = '#ffd5e4', shadow = '#efa1c5') {
        ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.beginPath(); ctx.moveTo(0, 0); ctx.bezierCurveTo(-sz * 0.7, -sz * 0.2, -sz * 0.72, -sz * 0.88, 0, -sz); ctx.bezierCurveTo(sz * 0.76, -sz * 0.88, sz * 0.76, -sz * 0.2, 0, 0); ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); line(ctx, INK, 1.2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-sz * 0.3, -sz * 0.35, 0, -sz * 0.78); line(ctx, shadow, 1.3); ctx.stroke(); ctx.restore();
    }

    // ── görseller (yalnızca Kedi Partisi) ──
    const IMG = {};
    function images() {
        if (IMG.ready) return IMG;
        IMG.ready = true;
        ['kedi-turuncu', 'kedi-gri', 'kedi-siyah', 'pati'].forEach((n) => {
            const im = new Image();
            im.decoding = 'async';
            im.onload = () => { all.forEach((inst) => inst.effect === 'catparty' && inst.visible && inst.draw()); };
            im.onerror = () => { IMG.ready = false; };   // ağ hatası: bir sonraki açılışta yeniden denenir
            im.src = '/fx/' + n + '.webp';
            IMG[n] = im;
        });
        return IMG;
    }
    const ok = (im) => im && im.complete && im.naturalWidth;

    // ════════ Kedi Partisi ════════
    // Giriş: üç kedi alttan sırayla zıplar, iki konfeti patlaması. Sonra kediler alt kenarda yalnızca başları görünecek
    // kadar oturur (butonları kapatmasın), sağ kenardan ara sıra pati sallanır, seyrek konfeti.
    function confetti(ctx, t, burst, ox, oy, count, seed, H) {
        const age = t - burst; if (age < 0 || age > 4.4) return;
        const colors = ['#ffdc5c', '#ff8eaf', '#99d5fa', '#a9e7b6', '#be98ef', '#fff3d0'];
        for (let i = 0; i < count; i++) {
            const s = i + seed * 97, a = -Math.PI * 0.97 + rnd(s + 4) * Math.PI * 0.94;
            const speed = 150 + 135 * rnd(s + 1);
            const x = ox + Math.cos(a) * speed * age + (rnd(s + 6) - 0.5) * 22 * age;
            const y = oy + Math.sin(a) * speed * age + 98 * age * age;
            if (y > H + 30 || x < -30 || x > 480) continue;
            ctx.save(); ctx.translate(x, y); ctx.rotate(age * (2 + rnd(s + 2) * 5) + (s % 9)); ctx.globalAlpha *= clamp((4.3 - age) / 1.1);
            ctx.fillStyle = colors[i % colors.length]; ctx.strokeStyle = INK; ctx.lineWidth = 1.25;
            const sz = 4.5 + 4 * rnd(s + 5);
            if (i % 4 === 0) ellipse(ctx, 0, 0, sz * 0.55, sz * 0.55, ctx.fillStyle, INK, 1);
            else { ctx.fillRect(-sz / 2, -sz * 0.65, sz, sz * 1.3); ctx.strokeRect(-sz / 2, -sz * 0.65, sz, sz * 1.3); }
            ctx.restore();
        }
    }
    function kitten(ctx, img, x, w, t, delay, H, peek, idx) {
        if (!ok(img)) return;
        const h = w * img.naturalHeight / img.naturalWidth;
        const hop = H * 0.56;                       // zıplamanın tepe noktası (merkez)
        const hidden = H + h / 2 + 8;               // kartın altında, görünmez
        const p = clamp((t - delay) / 0.88);
        let y = mix(H + h, hop, back(p));
        if (t > delay + 1.05) y = mix(hop, hidden, smooth(delay + 1.05, delay + 2.15, t));
        // Sakin döngü: kediler butonları sürekli kapatmasın diye sırayla, kısa süre alttan başını uzatır
        // (21 sn'lik turda her kedi 2,5 sn; aralarda 4,5 sn kimse görünmez)
        if (t > 3.4) {
            const c = period(t - 3.4 - idx * 7, 21), bump = smooth(0, 0.5, c) * (1 - smooth(1.9, 2.5, c));
            if (bump <= 0) return;
            y = mix(hidden, H + h / 2 - peek, bump) + Math.sin(t * 2 + delay) * 2;
        }
        const squash = 1 + 0.1 * (1 - smooth(0, 0.25, p)) - 0.06 * Math.sin(p * Math.PI), sc = 0.75 + 0.25 * ease(p);
        ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(t * 3 + delay * 2) * 0.028); ctx.scale(sc * squash, sc * (2 - squash));
        ctx.drawImage(img, -w / 2, -h / 2, w, h); ctx.restore();
    }
    function drawPaw(ctx, img, t, H) {
        if (!ok(img) || t < 4.3) return;
        const cyc = period(t - 4.3, 8.2); if (cyc >= 1.9) return;
        const inV = smooth(0, 0.45, cyc) * (1 - smooth(1.45, 1.9, cyc));
        // Sol kenardan, kapak alanında avatarın yanına uzanıp el sallar (butonlara ve kapat düğmesine uzak)
        const w = 64, h = w * img.naturalHeight / img.naturalWidth, reach = mix(-h * 0.55, 0, inV);
        ctx.save(); ctx.translate(-10 + reach, Math.min(H * 0.16, 90)); ctx.rotate(-Math.PI / 2 + Math.sin(cyc * 13) * 0.15); ctx.drawImage(img, -w / 2, -h * 0.08, w, h); ctx.restore();
    }
    function catparty(ctx, t, S) {
        const H = S.H, im = images();
        for (let j = 0; j < 3; j++) {
            const x = [92, 225, 358][j], d = [0.05, 0.24, 0.46][j], cy = H * 0.56;
            alpha(ctx, smooth(d, d + 0.28, t) * (1 - smooth(2.4, 3.2, t)), () => {
                for (let k = 0; k < 5; k++) { const ang = (k / 5) * TAU + t * 0.2, rad = 70 + (1 - smooth(d, d + 0.7, t)) * 42; star(ctx, x + Math.cos(ang) * rad, cy + Math.sin(ang) * rad, 3.6, ['#ffdea4', '#d9b6ff', '#baf4e8'][j], 0.8); }
            });
        }
        confetti(ctx, t, 0.35, 225, H * 0.43, 48, 1, H); confetti(ctx, t, 0.9, 185, H * 0.59, 42, 2, H);
        if (t > 6.3 && period(t - 6.3, 8.4) < 3.4) confetti(ctx, t, 6.3 + Math.floor((t - 6.3) / 8.4) * 8.4, 225, H * 0.12, 15, 3, H);
        for (let i = 0; i < 9; i++) {          // kenarlarda süzülen kurdeleler
            const s = i * 41, x = (i % 2 === 0 ? 14 : 436) + (rnd(s) - 0.5) * 20;
            const y = period(130 * i + 36 * t * (0.5 + rnd(s + 2)), H + 80) - 40;
            alpha(ctx, 0.42 * smooth(0.2, 1.2, t), () => { ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(t * 0.6 + s)); rounded(ctx, -2, -7, 4, 14, 1, ['#ffc6d5', '#b3f3e2', '#c0dcff'][i % 3], INK, 0.7); ctx.restore(); });
        }
        kitten(ctx, im['kedi-gri'], 70, 132, t, 0.26, H, 70, 1);
        kitten(ctx, im['kedi-siyah'], 380, 128, t, 0.47, H, 66, 2);
        kitten(ctx, im['kedi-turuncu'], 225, 148, t, 0.05, H, 74, 0);
        drawPaw(ctx, im.pati, t, H);
    }

    // ════════ Ay Işığı Koileri ════════
    function drawKoi(ctx, x, y, heading, scale, c, t, flip = 1) {
        ctx.save(); ctx.translate(x, y); ctx.rotate(heading); ctx.scale(scale, scale);
        const wave = Math.sin(t * 8 + flip) * 0.28;
        ctx.save(); ctx.translate(-60, 0); ctx.rotate(wave);
        ctx.beginPath(); ctx.moveTo(-9, 0); ctx.bezierCurveTo(-29, -22, -53, -40, -52, -13); ctx.quadraticCurveTo(-41, 0, -54, 15); ctx.bezierCurveTo(-54, 40, -29, 23, -8, 0); ctx.fillStyle = c.tail; ctx.fill(); line(ctx, INK, 4); ctx.stroke(); ctx.restore();
        ctx.beginPath(); ctx.moveTo(-30, -15); ctx.quadraticCurveTo(-15, -48, 17, -22); ctx.lineTo(20, -7); ctx.closePath(); ctx.fillStyle = c.fin; ctx.fill(); line(ctx, INK, 3); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-59, 0); ctx.bezierCurveTo(-34, -31, 7, -34, 39, -15); ctx.bezierCurveTo(64, 0, 41, 17, 13, 24); ctx.bezierCurveTo(-19, 36, -44, 20, -59, 0); ctx.fillStyle = c.base; ctx.fill(); line(ctx, INK, 4); ctx.stroke();
        ctx.save(); ctx.clip(); ctx.beginPath(); ctx.ellipse(-12, -20, 23, 16, -0.14, 0, TAU); ctx.fillStyle = c.patch; ctx.fill(); ctx.beginPath(); ctx.ellipse(29, 9, 19, 17, 0.18, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.moveTo(-59, 1); ctx.bezierCurveTo(-16, 27, 23, 23, 60, 0); ctx.lineTo(80, 34); ctx.lineTo(-60, 40); ctx.closePath(); ctx.fillStyle = c.shade; ctx.fill();
        ctx.beginPath(); ctx.ellipse(4, -17, 21, 5, -0.18, 0, TAU); ctx.fillStyle = '#fff9f1'; ctx.fill(); ctx.restore();
        ctx.beginPath(); ctx.moveTo(3, -13); ctx.quadraticCurveTo(21, -45, 35, -34); ctx.quadraticCurveTo(44, -18, 20, -3); ctx.fillStyle = c.fin; ctx.fill(); line(ctx, INK, 3); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-5, 14); ctx.quadraticCurveTo(5, 41, 25, 39); ctx.quadraticCurveTo(29, 15, 6, 10); ctx.fillStyle = c.fin; ctx.fill(); line(ctx, INK, 3); ctx.stroke();
        ellipse(ctx, 44, -6, 3.3, 3.3, INK); ellipse(ctx, 44, -7, 1.1, 1.1, '#ffffff');
        bezierStroke(ctx, [59, 3, 67, 2, 65, -2, 62, -4], INK, 1.8);
        ctx.restore();
    }
    const KOI_A = { base: '#fff2d8', patch: '#f58e6d', shade: '#e8d9bf', fin: '#fab17a', tail: '#f6a574' };
    const KOI_B = { base: '#e8fbff', patch: '#7bbde3', shade: '#c6e8ee', fin: '#8ec9e7', tail: '#87c3df' };
    function koi(ctx, t, S) {
        const H = S.H, entry = smooth(0.1, 1.35, t);
        // Avatarın etrafında su halkaları
        for (let i = 0; i < 4; i++) ring(ctx, S.ax, S.ay, S.ar + 18 + i * 22, (S.ar + 18 + i * 22) * 0.62, ['#80d5df', '#b1f6e5', '#6a9de2', '#b4dbff'][i], 4 - i * 0.5, entry * (0.32 + 0.18 * Math.sin(t * 1.2 + i)), -0.2);
        for (let i = 0; i < 3; i++) { const ph = period(t * 0.43 + i * 0.33, 1); ring(ctx, S.ax, S.ay + 8, S.ar + 30 + 46 * ph, (S.ar + 30 + 46 * ph) * 0.55, '#76d9e7', 2.4, entry * (1 - ph) * 0.7, -0.2); }
        for (const side of [-1, 1]) {      // kenar dalgaları
            ctx.save(); ctx.translate(side === -1 ? 0 : 450, 0); ctx.scale(side, 1);
            for (let j = 0; j * 165 < H; j++) { const y = 40 + j * 165 + Math.sin(t * 1.2 + j) * 10; alpha(ctx, entry * 0.6, () => bezierStroke(ctx, [-25, y, 14, y - 22, 34, y + 24, 20, y + 59, 4, y + 90, 34, y + 107, 44, y + 100], j % 2 ? '#abeee6' : '#8cd2ef', 3)); }
            ctx.restore();
        }
        // İki koi kartın kenarına yakın bir yörüngede yüzer (içerik ortada kalır)
        const pr = ease(t / 1.1), a = t * 0.52 - 0.8, b = a + Math.PI;
        const rx = 205, ry = Math.max(120, H / 2 - 34), cy = H / 2;
        const orbit = (g) => ({ x: 225 + rx * Math.cos(g), y: cy + ry * Math.sin(g), h: Math.atan2(ry * Math.cos(g), -rx * Math.sin(g)) });
        const c1 = orbit(a), c2 = orbit(b);
        alpha(ctx, pr, () => { drawKoi(ctx, c2.x, c2.y, c2.h, 0.62, KOI_B, t, 2); drawKoi(ctx, c1.x, c1.y, c1.h, 0.7, KOI_A, t, 1); });
        for (let i = 0; i < 18; i++) {     // kabarcıklar
            const s = i * 31, sp = 0.12 + rnd(s + 1) * 0.12, p = period(t * sp + rnd(s + 3), 1);
            const x = 20 + rnd(s + 2) * 410 + Math.sin(t * 0.8 + s) * 10, y = H + 20 - p * (H + 80), r = 3 + rnd(s + 7) * 5;
            alpha(ctx, entry * (0.25 + 0.5 * rnd(s + 5)), () => { ellipse(ctx, x, y, r, r, '#d5fcf9', '#73cbd7', 1.4); ellipse(ctx, x - r * 0.25, y - r * 0.25, r * 0.28, r * 0.28, '#ffffff'); });
        }
    }

    // ════════ Kiraz Bahçesi ════════
    function blossom(ctx, x, y, r, bloom = 1) {
        ctx.save(); ctx.translate(x, y); ctx.scale(Math.max(0.001, bloom), Math.max(0.001, bloom));
        for (let j = 0; j < 5; j++) petal(ctx, 0, 0, r, j * TAU / 5 + Math.PI / 5, j % 2 ? '#ffd7e5' : '#ffc3dd', '#e99cc4');
        ellipse(ctx, 0, 0, r * 0.2, r * 0.2, '#ffdc68', INK, 1.2); ellipse(ctx, -r * 0.055, -r * 0.08, r * 0.06, r * 0.06, '#fff7cc'); ctx.restore();
    }
    function leaf(ctx, x, y, r, angle = 0, fill = '#88ceb0') {
        ctx.save(); ctx.translate(x, y); ctx.rotate(angle); ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-r * 1.1, -r * 0.5, 0, -r * 1.5); ctx.quadraticCurveTo(r * 1.1, -r * 0.55, 0, 0); ctx.fillStyle = fill; ctx.fill(); line(ctx, INK, 2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -r * 1.26); line(ctx, '#e0f6c5', 1.4); ctx.stroke(); ctx.restore();
    }
    const LEAVES = [[40, 87, 14, -0.5], [95, 169, 12, 0.4], [110, 253, 15, -0.25], [152, 55, 12, 0.8], [169, 115, 15, 0.18], [189, 222, 12, 0.55], [56, 136, 14, -0.7], [122, 198, 12, 0.5]];
    const FLOWERS = [[32, 55, 18], [82, 139, 25], [125, 79, 21], [135, 210, 20], [195, 232, 19], [178, 112, 24], [92, 242, 20], [46, 170, 19]];
    function branch(ctx, right, t, k) {
        // Dallar üst köşelerden büyür; avatarı kapatmasın diye küçültülür (k)
        const g = smooth(0.1, 1.1, t); ctx.save(); ctx.translate(right ? 470 : -20, right ? 40 : -25); ctx.scale((right ? -1 : 1) * k, k); // sağ dal, kapat düğmesinin altından başlar
        alpha(ctx, g, () => {
            bezierStroke(ctx, [-25, -25, 18, 50, 44, 80, 83, 168, 118, 212, 112, 252, 171, 301], INK, 13);
            bezierStroke(ctx, [-25, -25, 18, 50, 44, 80, 83, 168, 118, 212, 112, 252, 171, 301], '#986c79', 7);
            bezierStroke(ctx, [37, 110, 81, 82, 107, 68, 151, 48], INK, 8);
            bezierStroke(ctx, [83, 172, 120, 132, 149, 122, 179, 117], INK, 7);
            bezierStroke(ctx, [112, 252, 133, 226, 173, 227, 197, 226], INK, 7);
        });
        LEAVES.forEach((l, i) => alpha(ctx, smooth(0.5 + i * 0.05, 1.3 + i * 0.06, t), () => leaf(ctx, l[0], l[1], l[2], l[3], i % 2 ? '#a7dfaf' : '#80c69e')));
        FLOWERS.forEach((f, i) => blossom(ctx, f[0], f[1], f[2], back((t - 0.65 - i * 0.09) / 0.55)));
        ctx.restore();
    }
    function butterfly(ctx, x, y, t, scale = 1) {
        ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(t * 2.5) * 0.14); ctx.scale(scale, scale);
        const wing = 0.35 + Math.abs(Math.sin(t * 13)) * 0.65;
        for (const sx of [wing, -wing]) { ctx.save(); ctx.scale(sx, 1); ellipse(ctx, -14, -7, 20, 24, '#bd9dff', INK, 3); ellipse(ctx, -14, 15, 13, 18, '#8bd8f3', INK, 3); ellipse(ctx, -15, -9, 9, 12, '#fce7ff'); ctx.restore(); }
        ellipse(ctx, 0, 2, 4, 23, '#493868', INK, 2); bezierStroke(ctx, [-2, -15, -8, -34, -14, -31, -17, -30], INK, 2); bezierStroke(ctx, [2, -15, 8, -34, 14, -31, 17, -30], INK, 2); ctx.restore();
    }
    function cherry(ctx, t, S) {
        const H = S.H, k = clamp(S.H / 1100, 0.42, 0.52);   // dallar avatar hizasında kalır, butonlara inmez
        branch(ctx, false, t, k); branch(ctx, true, t - 0.22, k);
        for (let i = 0; i < 26; i++) {         // süzülen yapraklar
            const s = 14 * i + 2, p = period(t * 0.16 + rnd(s), 1), y = p * (H + 120) - 60;
            const x = 25 + rnd(s + 3) * 400 + 35 * Math.sin(t * 0.7 + i * 2.3);
            alpha(ctx, smooth(0.7, 2, t) * (0.3 + 0.5 * rnd(s + 2)), () => petal(ctx, x, y, 6 + rnd(s + 6) * 9, t * (0.8 + rnd(s + 5)) * (i % 2 ? -1 : 1), i % 3 ? '#ffd3e5' : '#ffe9f3', '#e8a0c3'));
        }
        const bx = t < 1.6 ? -90 : -70 + period((t - 1.6) * 57, 650), by = H * 0.45 - 60 * Math.sin(t * 0.45);
        if (t > 1.6 && bx < 490) butterfly(ctx, bx, by, t, 0.7);
        for (let i = 0; i < 10; i++) { const s = 10 * i, x = 20 + rnd(s) * 410, y = 60 + rnd(s + 2) * (H - 100); alpha(ctx, smooth(1.2, 2, t) * (0.3 + 0.55 * (0.5 + 0.5 * Math.sin(t * 2.2 + i * 3.1))), () => flare(ctx, x, y, 2.3, '#fff0a5', 0.8)); }
    }

    // ════════ Astral Mercek ════════
    function planet(ctx, x, y, r, fill, shade, ringed = false) {
        ellipse(ctx, x, y, r, r, fill, INK, 2.4);
        ctx.save(); ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.clip(); ellipse(ctx, x + r * 0.32, y + r * 0.46, r * 0.92, r * 0.75, shade); ellipse(ctx, x - r * 0.31, y - r * 0.4, r * 0.36, r * 0.18, '#ffffff'); ctx.restore();
        if (ringed) { ctx.save(); ctx.translate(x, y); ctx.rotate(-0.32); ctx.beginPath(); ctx.ellipse(0, 0, r * 1.6, r * 0.5, 0, 0, TAU); line(ctx, '#ead9fc', 2.4); ctx.stroke(); ctx.restore(); }
    }
    function astral(ctx, t, S) {
        const H = S.H, enter = smooth(0.1, 1.25, t), spin = t * 0.065, cx = S.ax, cy = S.ay, R = S.ar;
        for (let i = 0; i < 4; i++) {          // avatarın etrafında kurulan büyü halkaları
            const r = R + 16 + 12 * i, prog = clamp(t / 0.85 - i * 0.15); if (prog <= 0) continue;
            alpha(ctx, (0.55 - i * 0.09) * enter, () => { ctx.save(); ctx.translate(cx, cy); ctx.rotate((i % 2 ? -1 : 1) * spin); ctx.beginPath(); ctx.arc(0, 0, r, -Math.PI * 0.63, -Math.PI * 0.63 + TAU * ease(prog)); line(ctx, ['#e3caff', '#98c9ff', '#fadf9f', '#b7a5ff'][i], i === 1 ? 3 : 2); ctx.stroke(); ctx.restore(); });
        }
        for (let i = 0; i < 12; i++) { const g = (i / 12) * TAU + spin * 0.6, r = R + 34; alpha(ctx, enter, () => star(ctx, cx + Math.cos(g) * r, cy + Math.sin(g) * r, i % 3 === 0 ? 7 : 4, i % 2 ? '#b8cbff' : '#ffe8b1', 0.9 + 0.05 * Math.sin(t * 1.1 + i))); }
        const ts = t - 1.5;                     // kuyruklu yıldız kapak alanından geçer
        if (ts > 0) {
            const ph = period(ts, 7.5), x = -130 + ph * 102, y = Math.max(16, cy - R - 14) - 8 * Math.sin(ph * 0.7), a = (1 - smooth(4.8, 7.3, ph)) * smooth(0, 0.4, ph);
            alpha(ctx, a, () => { ctx.save(); ctx.translate(x, y); ctx.rotate(-0.18); for (let j = 0; j < 4; j++) bezierStroke(ctx, [-j * 22, 0, -80 - j * 23, 4, -100 - j * 20, 30, -135 - j * 18, 20], ['#dbd1ff', '#b8a8ff', '#ffdfad', '#99e1ff'][j], 5 - j * 0.6); flare(ctx, 0, 0, 11, '#fff3ca', 1); ctx.restore(); });
        }
        const rad = R + 54, g = t * 0.33;
        // Gezegenler avatarın iki yanında yassı bir yörüngede (isim satırına inmez)
        planet(ctx, cx + Math.cos(g) * rad * 1.6, cy + Math.sin(g) * R * 0.45, 9, '#f5cc9e', '#c993bd', true);
        planet(ctx, cx + Math.cos(g + Math.PI) * rad * 1.45, cy + Math.sin(g + Math.PI) * R * 0.4, 6.5, '#addff1', '#90accf');
        for (let i = 0; i < 36; i++) { const s = i * 61, x = 14 + rnd(s) * 422, y = 14 + rnd(s + 11) * (H - 28), r = 1 + rnd(s + 6) * 2.6; alpha(ctx, enter * (0.17 + 0.55 * Math.pow(0.5 + 0.5 * Math.sin(t * (1.7 + rnd(s + 15) * 2) + i), 4)), () => star(ctx, x, y, r * 1.8, ['#ffecc2', '#d2c1ff', '#a7edff'][i % 3])); }
        for (let i = 0; i < 6; i++) { const x = i % 2 === 0 ? 14 : 436, y = H * 0.35 + (i >> 1) * H * 0.2; alpha(ctx, enter * (0.32 + 0.3 * Math.sin(t * 1.8 + i)) * 0.8, () => star(ctx, x, y, 7, '#dcc5ff')); }
    }

    // ════════ Neon Devre ════════
    function neonLine(ctx, pts, color, thick) { ctx.save(); line(ctx, INK, thick + 3); ctx.beginPath(); ctx.moveTo(...pts[0]); for (let i = 1; i < pts.length; i++) ctx.lineTo(...pts[i]); ctx.stroke(); line(ctx, color, thick); ctx.stroke(); ctx.restore(); }
    function neon(ctx, t, S) {
        const H = S.H, enter = smooth(0, 0.9, t), y = (f) => f * H;   // dikey konumlar kart yüksekliğine oranlı
        // Devre çizgileri kartın en dış kenarında (butonların ve yazıların dışında)
        const L = [[30, 9], [9, 30], [9, y(0.3)], [16, y(0.33)], [16, y(0.6)], [9, y(0.63)], [9, H - 30], [30, H - 9], [120, H - 9]];
        const R = L.map(([x, yy]) => [450 - x, yy]);
        alpha(ctx, enter, () => {
            neonLine(ctx, L, '#5dece9', 3.2); neonLine(ctx, R, '#ef86e7', 3.2);
            neonLine(ctx, [[30, 9], [110, 9], [126, 18]], '#ef86e7', 2.6); neonLine(ctx, [[420, 9], [340, 9], [324, 18]], '#64e5e9', 2.6);
            neonLine(ctx, [[120, H - 9], [136, H - 18], [314, H - 18], [330, H - 9]], '#b9a5ff', 2.6);
        });
        for (let i = 0; i < 10; i++) {          // kenar düğümleri
            const l = i % 2 === 0, x = l ? 12 : 438, yy = H * (0.12 + Math.floor(i / 2) * 0.18), glow = (Math.cos(t * 2.7 + i * 0.95) + 1) / 2;
            alpha(ctx, enter, () => { ellipse(ctx, x, yy, 3 + glow * 1.4, 3 + glow * 1.4, l ? '#8cfaf0' : '#ffc0fb', INK, 1.6); ellipse(ctx, x - 1, yy - 1, 1.2, 1.2, '#ffffff'); });
        }
        const scroll = t < 2 ? t * (H + 120) / 2 - 60 : period((t - 2) * 125, H + 200) - 90;   // açılışta bir kez güçlü tarama
        alpha(ctx, enter * (t < 2 ? 0.7 : 0.08), () => { rounded(ctx, 14, scroll, 422, 4, 2, '#9be8f2'); rounded(ctx, 54, scroll - 9, 342, 2, 1, '#fff0ff'); });
        for (let i = 0; i < 16; i++) {          // kenar hız çizgileri
            const s = i * 71, x = i % 2 === 0 ? 4 + rnd(s) * 22 : 424 + rnd(s) * 22, yy = period(t * (110 + rnd(s + 7) * 180) + rnd(s + 11) * 940, H + 60) - 30;
            alpha(ctx, enter * (0.12 + 0.3 * rnd(s + 3)), () => rounded(ctx, x, yy, 1.7, 9 + rnd(s + 2) * 30, 1, ['#9dfffc', '#ffb0f4', '#cfc5ff'][i % 3]));
        }
        for (let k = 0; k < 4; k++) {           // köşe kamaları (küçültülmüş)
            const a = smooth(0.17 + k * 0.12, 0.7 + k * 0.12, t), x = k % 2 ? 450 : 0, yy = k > 1 ? H : 0;
            alpha(ctx, a * 0.88, () => {
                ctx.save(); ctx.translate(x, yy); ctx.scale((k % 2 ? -1 : 1) * 0.55, (k > 1 ? -1 : 1) * 0.55);
                poly(ctx, [[0, 0], [104, 0], [70, 29], [30, 29], [29, 94], [0, 117]], k < 2 ? '#3b4167' : '#47365e', INK, 3);
                poly(ctx, [[0, 0], [58, 0], [31, 24], [23, 64], [0, 76]], k % 2 ? '#ed83df' : '#7ce9e8');
                line(ctx, '#b6f9f3', 2); ctx.beginPath(); ctx.moveTo(55, 41); ctx.lineTo(76, 41); ctx.stroke(); ctx.restore();
            });
        }
        if (t < 2.3 || period(t - 2.3, 7.2) < 0.9) {   // girişte ve ara sıra parlayan kırıklar (yalnızca kenar şeritlerinde)
            const f = t < 2.3 ? t : period(t - 2.3, 7.2), op = (1 - smooth(0.5, 1.1, f)) * enter;
            alpha(ctx, op, () => { for (let j = 0; j < 8; j++) { const x = j % 2 ? 26 : 412, yy = H * (0.1 + j * 0.11); poly(ctx, [[x, yy], [x + 8, yy - 9], [x + 16, yy - 9], [x + 8, yy]], j % 2 ? '#f3b5ef' : '#87f5ef', INK, 1.3); } });
        }
    }


    // ════════════════ Yenilenen eski efektler (2026-11-15) ════════════════
    // Eskiden yalnızca avatarın içinde (Sakura, Sahne Işıkları) ya da kenarda sade SVG/CSS idi (Alev, Mürekkep, Yıldırım, Tatlı).
    // Artık diğer sahneler gibi tüm kartı kullanır: giriş hareketi + sakin döngü. Kartın orta şeridinde (yazılar, butonlar)
    // yoğunluk düşük tutulur; asıl hareket kenarlarda, kapak alanında ve avatarın çevresindedir.
    const glowDot = (ctx, x, y, r, color, a) => alpha(ctx, a, () => {
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, color); g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
    });
    // Ortadaki içerik şeridinde parçacıklar soluklaşır (yazı/buton okunur kalsın)
    const edgeFade = (x, y, H) => { const cx = Math.abs(x - 225) / 225; return y < H * 0.22 ? 1 : 0.35 + 0.65 * smooth(0.55, 0.9, cx); };

    // ════════ Sakura ════════
    function sakuraPetal(ctx, x, y, sz, rot, tumble, col) {
        ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(1, 0.35 + 0.65 * Math.abs(tumble));
        ctx.beginPath(); ctx.moveTo(0, -sz);
        ctx.bezierCurveTo(sz * 0.95, -sz * 0.55, sz * 0.7, sz * 0.65, 0, sz);
        ctx.bezierCurveTo(-sz * 0.7, sz * 0.65, -sz * 0.95, -sz * 0.55, 0, -sz);
        ctx.fillStyle = col; ctx.fill();
        ctx.beginPath(); ctx.moveTo(-sz * 0.18, -sz * 0.98); ctx.lineTo(0, -sz * 0.7); ctx.lineTo(sz * 0.18, -sz * 0.98); ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.fill();
        ctx.restore();
    }
    function sakura(ctx, t, S) {
        const H = S.H, cols = ['#ffc6dc', '#ffd9e7', '#ff9fc6', '#fff1f6', '#f7a8cf'];
        // pembe ışık hüzmeleri (kapak alanı)
        for (let i = 0; i < 7; i++) { const s = i * 23; glowDot(ctx, 30 + rnd(s) * 390, 20 + rnd(s + 1) * H * 0.25, 40 + rnd(s + 2) * 50, 'rgba(255,170,205,.22)', smooth(0, 1.2, t) * (0.6 + 0.4 * Math.sin(t * 0.7 + i))); }
        // Giriş: soldan esen yaprak rüzgârı
        if (t < 3) for (let i = 0; i < 46; i++) {
            const s = i * 13, d = rnd(s) * 0.7, age = t - d; if (age < 0) continue;
            const x = -30 + age * (330 + rnd(s + 1) * 160), y = H * (0.08 + rnd(s + 2) * 0.8) + Math.sin(age * 4 + s) * 26 - age * 40;
            if (x > 480) continue;
            alpha(ctx, 1 - smooth(2.2, 3, t), () => sakuraPetal(ctx, x, y, 5 + rnd(s + 3) * 5, age * 5 + s, Math.cos(age * 6 + s), cols[i % 5]));
        }
        // Giriş: avatarın çevresinde dönen yapraklar, sonra açılıp dağılır; sakinde 4 yaprak yavaşça döner
        const sw = smooth(0.2, 0.9, t) * (1 - smooth(2.2, 3.1, t));
        for (let i = 0; i < 14; i++) {
            const a = (i / 14) * TAU + t * 2.2, r = S.ar + 16 + 30 * smooth(1.6, 3.1, t);
            if (sw > 0) alpha(ctx, sw, () => sakuraPetal(ctx, S.ax + Math.cos(a) * r, S.ay + Math.sin(a) * r * 0.9, 6, a + 1.6, Math.cos(t * 5 + i), cols[i % 5]));
        }
        for (let i = 0; i < 4; i++) { const a = (i / 4) * TAU + t * 0.45, r = S.ar + 18; alpha(ctx, smooth(2.6, 3.4, t) * 0.9, () => sakuraPetal(ctx, S.ax + Math.cos(a) * r, S.ay + Math.sin(a) * r * 0.85, 5.5, a + 1.6, Math.cos(t * 2 + i), cols[(i + 2) % 5])); }
        // Sürekli düşen yapraklar; 9 sn'de bir rüzgâr sağa savurur
        const gust = Math.sin(clamp(period(t, 9) / 2.2) * Math.PI);
        for (let i = 0; i < 28; i++) {
            const s = i * 37, speed = 26 + rnd(s + 1) * 34;
            const y = period(t * speed + rnd(s + 2) * (H + 60) * 3, H + 60) - 30;
            const x = period(rnd(s) * 470 + Math.sin(t * (0.6 + rnd(s + 3)) + s) * 22 + gust * 70 * (0.5 + rnd(s + 4)), 490) - 20;
            alpha(ctx, smooth(0.6, 1.8, t) * edgeFade(x, y, H) * 0.95, () => sakuraPetal(ctx, x, y, 4 + rnd(s + 5) * 5, t * (0.8 + rnd(s + 6) * 2) + s, Math.cos(t * (1.5 + rnd(s + 7) * 2) + s), cols[i % 5]));
        }
    }

    // ════════ Sahne Işıkları ════════
    function stagelights(ctx, t, S) {
        const H = S.H, hues = [[190, 120, 255], [90, 220, 255], [255, 120, 200], [255, 205, 110]];
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        for (let k = 0; k < 4; k++) {
            const on = t - (0.15 + k * 0.28); if (on < 0) continue;
            const flash = 1 + 1.6 * (1 - smooth(0, 0.35, on));          // yanarken kısa parlama
            const ox = [55, 168, 282, 395][k], ang = Math.sin(t * (0.32 + k * 0.05) + k * 1.7) * 0.32 + (ox < 225 ? 0.12 : -0.12);
            const len = H * 1.05, half = 95 + 25 * Math.sin(t * 0.5 + k);
            const ex = ox + Math.sin(ang) * len, ey = Math.cos(ang) * len, nx = Math.cos(ang) * half, ny = -Math.sin(ang) * half;
            const c = hues[(k + Math.floor(t / 6)) % 4], c2 = hues[(k + Math.floor(t / 6) + 1) % 4], mixc = smooth(5, 6, period(t, 6));
            const col = c.map((v, j) => Math.round(mix(v, c2[j], mixc)));
            const g = ctx.createLinearGradient(ox, -8, ex, ey);
            g.addColorStop(0, `rgba(${col},${0.42 * flash})`); g.addColorStop(0.55, `rgba(${col},${0.12 * flash})`); g.addColorStop(1, `rgba(${col},0)`);
            ctx.beginPath(); ctx.moveTo(ox - 6, -8); ctx.lineTo(ox + 6, -8); ctx.lineTo(ex + nx, ey + ny); ctx.lineTo(ex - nx, ey - ny); ctx.closePath();
            ctx.fillStyle = g; ctx.globalAlpha = smooth(0, 0.25, on) * 0.55; ctx.fill();
            ctx.globalAlpha = 1; glowDot(ctx, ox, 0, 26, `rgba(${col},.9)`, smooth(0, 0.25, on));   // projektör ağzı
            // huzme içindeki toz zerreleri
            for (let i = 0; i < 9; i++) {
                const s = k * 50 + i * 7, f = period(rnd(s) + t * (0.03 + rnd(s + 1) * 0.04), 1);
                const px = ox + Math.sin(ang) * len * f + nx * (rnd(s + 2) - 0.5) * 1.4 * f, py = Math.cos(ang) * len * f + ny * (rnd(s + 2) - 0.5) * 1.4 * f;
                glowDot(ctx, px, py, 3.5, 'rgba(255,255,255,.9)', smooth(0, 0.4, on) * (0.25 + 0.5 * Math.pow(0.5 + 0.5 * Math.sin(t * 3 + s), 3)) * (1 - f * 0.6));
            }
        }
        ctx.restore();
        // avatarın etrafında sahne halkası
        const pulse = 0.5 + 0.5 * Math.sin(t * 2.4);
        ring(ctx, S.ax, S.ay, S.ar + 7 + pulse * 3, S.ar + 7 + pulse * 3, '#ffe7a8', 2, smooth(1.2, 1.8, t) * (0.35 + 0.35 * pulse));
    }

    // ════════ Alev ════════
    function flame(ctx, t, S) {
        // Alevin kendisi simülasyon videosu (VID.flame, kartın altı, 'screen' karışımı). Burada yalnızca ışık ve kor parçacıkları.
        const H = S.H, grow = ease(t / 1.1);
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        glowDot(ctx, 225, H + 30, 230, 'rgba(255,90,20,.28)', grow * (0.8 + 0.2 * Math.sin(t * 5)));
        // yükselen korlar
        for (let i = 0; i < 30; i++) {
            const s = i * 29, life = 2.4 + rnd(s) * 2.2, ph = period(t + rnd(s + 1) * life, life) / life;
            const x = 10 + rnd(s + 2) * 430 + Math.sin(ph * 7 + s) * 14, y = H - 30 - ph * H * (0.35 + rnd(s + 3) * 0.3);
            const a = grow * (1 - ph) * smooth(0, 0.1, ph) * edgeFade(x, y, H);
            glowDot(ctx, x, y, 7, 'rgba(255,170,60,.95)', a); glowDot(ctx, x, y, 2.2, 'rgba(255,245,200,1)', a);
        }
        // Giriş: avatarın çevresinde dönen, sonra yukarı savrulan kor halkası; sakinde avatarın çevresinde hafif ısı ışıması
        const ringA = smooth(0.05, 0.4, t) * (1 - smooth(1.5, 2.6, t));
        if (ringA > 0) for (let i = 0; i < 34; i++) {
            const a = (i / 34) * TAU + t * 1.6, lift = smooth(1.3, 2.6, t) * (30 + 40 * rnd(i * 7));
            const r = S.ar + 8 + 10 * ease(t / 1.2) + Math.sin(t * 9 + i) * 2;
            const x = S.ax + Math.cos(a) * r, y = S.ay + Math.sin(a) * r - lift;
            glowDot(ctx, x, y, 9, 'rgba(255,120,30,.9)', ringA); glowDot(ctx, x, y, 3, 'rgba(255,240,190,1)', ringA);
        }
        glowDot(ctx, S.ax, S.ay, S.ar + 30, 'rgba(255,110,30,.22)', smooth(1.4, 2.4, t) * (0.7 + 0.3 * Math.sin(t * 3)));
        // 7 sn'de bir alt köşelerden kıvılcım fışkırması
        const b = period(t - 2.5, 7);
        if (t > 2.5 && b < 1.6) for (let i = 0; i < 18; i++) {
            const s = i * 53, a = -Math.PI / 2 + (rnd(s) - 0.5) * 1.3, sp = 160 + rnd(s + 1) * 140;
            const x = (i % 2 ? 60 : 390) + (rnd(s + 2) - 0.5) * 80 + Math.cos(a) * sp * b, y = H - 20 + Math.sin(a) * sp * b + 120 * b * b;
            glowDot(ctx, x, y, 5, 'rgba(255,200,90,1)', (1 - b / 1.6) * edgeFade(x, y, H));
        }
        ctx.restore();
    }

    // ════════ Mürekkep ════════
    function blot(ctx, x, y, r, seed, t, fill) {
        ctx.beginPath();
        for (let i = 0; i <= 18; i++) {
            const a = (i / 18) * TAU, k = 1 + 0.28 * Math.sin(a * 3 + seed) + 0.14 * Math.sin(a * 7 + seed * 2 + t * 0.6);
            const px = x + Math.cos(a) * r * k, py = y + Math.sin(a) * r * k;
            if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
    }
    function ink(ctx, t, S) {
        const H = S.H;
        // Giriş: köşelerden açılan lekeler, sonra kenara çekilir
        const corners = [[0, 0, 1], [450, 0, 2], [0, H, 3], [450, H, 4]];
        corners.forEach(([x, y, s], i) => {
            const open = ease((t - i * 0.12) / 0.8), settle = 1 - smooth(1.4, 3.2, t);    // giriş sonunda tamamen çekilir
            const r = (y ? 70 : 120) * open * settle + 8 * Math.sin(t * 0.8 + s);   // alt köşeler küçük: butonlara taşmasın
            if (r <= 0) return;
            alpha(ctx, 0.9, () => blot(ctx, x, y, r, s, t, '#0b0814'));
            ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.5; ctx.lineWidth = 2; ctx.strokeStyle = '#8a63ff';
            blot(ctx, x, y, r, s, t, 'rgba(0,0,0,0)'); ctx.stroke(); ctx.restore();
            // sıçrama damlaları
            for (let j = 0; j < 6; j++) { const a = rnd(s * 10 + j) * TAU, d = r * (1.15 + 0.5 * rnd(s * 10 + j + 1)); ellipse(ctx, x + Math.cos(a) * d, y + Math.sin(a) * d, 3 + 4 * rnd(s + j), 3 + 4 * rnd(s + j), 'rgba(11,8,20,.85)'); }
        });
        // Duman simülasyon videosu (VID.ink, tüm kart, 'screen' karışımı): kenarlardan ve alt köşelerden yükselir.
        // 6 sn'de bir üstten damla düşer, altta halka olur
        const dp = period(t - 2, 6), ds = Math.floor((t - 2) / 6), dx = 40 + rnd(ds * 3) * 370;
        if (t > 2) {
            if (dp < 1.1) { const y = 10 + 0.5 * 700 * dp * dp; alpha(ctx, edgeFade(dx, y, H), () => { ellipse(ctx, dx, y, 4, 6, '#0b0814', '#8a63ff', 1.4); }); }
            else if (dp < 2.4) { const k = (dp - 1.1) / 1.3; ring(ctx, dx, Math.min(H - 12, 10 + 0.5 * 700 * 1.21), 8 + 40 * k, 3 + 12 * k, '#8a63ff', 2, (1 - k) * 0.8); }
        }
        // süzülen kül zerreleri
        for (let i = 0; i < 18; i++) { const s = i * 43, y = period(rnd(s) * H - t * (8 + rnd(s + 1) * 10), H), x = rnd(s + 2) * 450 + Math.sin(t + s) * 8; glowDot(ctx, x, y, 3, 'rgba(190,170,255,.8)', 0.6 * smooth(1, 2, t) * edgeFade(x, y, H)); }
    }

    // ════════ Yıldırım ════════
    function boltPath(seed, x, y, len, H) {
        const pts = [[x, y]]; let cx = x, cy = y; const branches = [];
        for (let i = 0; i < 10; i++) {
            cx += (rnd(seed + i) - 0.5) * 46; cy += len / 10; pts.push([cx, cy]);
            if (i > 1 && i < 7 && rnd(seed + i + 50) > 0.62) {
                const b = [[cx, cy]]; let bx = cx, by = cy; const dir = rnd(seed + i + 70) > 0.5 ? 1 : -1;
                for (let j = 0; j < 4; j++) { bx += dir * (10 + rnd(seed + i * 9 + j) * 18); by += 14 + rnd(seed + i * 7 + j) * 14; b.push([bx, by]); }
                branches.push(b);
            }
        }
        return { pts, branches };
    }
    function strokePts(ctx, pts) { ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.stroke(); }
    function storm(ctx, t, S) {
        const H = S.H, enter = smooth(0, 0.8, t);
        // üstte yavaş kayan bulutlar
        for (let i = 0; i < 11; i++) { const s = i * 31, x = period(rnd(s) * 600 + t * (6 + rnd(s + 1) * 6), 600) - 75, y = 4 + rnd(s + 2) * 50; glowDot(ctx, x, y, 60 + rnd(s + 3) * 45, 'rgba(22,28,58,.95)', enter); }
        // bulutların içinde çakan uzak ışık
        const far = period(t, 2.7); if (far < 0.18) glowDot(ctx, 60 + rnd(Math.floor(t / 2.7)) * 330, 30, 90, 'rgba(150,180,255,.45)', 1 - far / 0.18);
        // yağmur
        alpha(ctx, enter * 0.85, () => {
            line(ctx, 'rgba(180,205,255,.7)', 1.5); ctx.beginPath();
            for (let i = 0; i < 70; i++) { const s = i * 17, sp = 520 + rnd(s) * 260, y = period(rnd(s + 1) * H + t * sp, H + 40) - 20, x = period(rnd(s + 2) * 500 - y * 0.18, 470) - 10; const k = edgeFade(x, y, H); if (k < 0.5 && rnd(s + 3) > 0.4) continue; ctx.moveTo(x, y); ctx.lineTo(x - 3, y + 14); }
            ctx.stroke();
        });
        // Şimşekler: girişte çift çakma, sonra 4 sn'de bir; kenar şeritlerinde
        const strikes = t < 2.2 ? [0.45, 0.95] : [];
        const cyc = Math.floor((t - 2.2) / 4);
        if (t >= 2.2) strikes.push(2.2 + cyc * 4 + 2.4);
        let flashA = 0;
        strikes.forEach((st, n) => {
            const age = t - st; if (age < 0 || age > 0.42) return;
            const seed = Math.floor(st * 10) * 13 + n, left = rnd(seed) > 0.5, x = left ? 30 + rnd(seed + 1) * 60 : 360 + rnd(seed + 1) * 60;
            const { pts, branches } = boltPath(seed, x, -5, H * (0.45 + rnd(seed + 2) * 0.2), H);
            const on = age < 0.08 || (age > 0.14 && age < 0.3) ? 1 : 0.25;
            flashA = Math.max(flashA, (1 - age / 0.42) * 0.26 * on);
            ctx.save(); ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha = on * (1 - age / 0.5);
            line(ctx, 'rgba(110,150,255,.5)', 16); strokePts(ctx, pts); branches.forEach((b) => strokePts(ctx, b));
            line(ctx, 'rgba(170,200,255,.8)', 6); strokePts(ctx, pts);
            line(ctx, '#f4f8ff', 3); strokePts(ctx, pts); line(ctx, '#e6eeff', 1.8); branches.forEach((b) => strokePts(ctx, b));
            ctx.restore();
            // avatarın çevresinde elektrik arkları
            for (let j = 0; j < 5; j++) {
                const a = rnd(seed + j * 3) * TAU, a2 = a + 0.5 + rnd(seed + j) * 0.6, r = S.ar + 6;
                const p = [[S.ax + Math.cos(a) * r, S.ay + Math.sin(a) * r]];
                for (let k = 1; k <= 4; k++) { const aa = mix(a, a2, k / 4), rr = r + (rnd(seed + j * 11 + k) - 0.5) * 12; p.push([S.ax + Math.cos(aa) * rr, S.ay + Math.sin(aa) * rr]); }
                alpha(ctx, on, () => { line(ctx, '#bcd2ff', 1.6); strokePts(ctx, p); });
            }
        });
        if (flashA > 0 && !S.lite) alpha(ctx, flashA, () => { ctx.fillStyle = '#dfe8ff'; ctx.fillRect(0, 0, 450, H); });   // hafif modda ekran flaşı yok
        // kenarlarda gezinen kıvılcımlar
        for (let i = 0; i < 10; i++) { const s = i * 57, y = period(rnd(s) * H + t * 40 * (rnd(s + 1) > 0.5 ? 1 : -1), H), x = i % 2 ? 6 + rnd(s + 2) * 14 : 430 + rnd(s + 2) * 14; glowDot(ctx, x, y, 6, 'rgba(160,190,255,.9)', enter * (0.3 + 0.7 * Math.pow(0.5 + 0.5 * Math.sin(t * 9 + s), 6))); }
    }

    // ════════ Tatlı ════════
    function heart(ctx, x, y, sz, rot, fill) {
        ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(sz / 10, sz / 10);
        ctx.beginPath(); ctx.moveTo(0, 3); ctx.bezierCurveTo(-10, -4, -6, -12, 0, -6); ctx.bezierCurveTo(6, -12, 10, -4, 0, 3); ctx.closePath();
        ctx.fillStyle = fill; ctx.fill(); line(ctx, INK, 1.4); ctx.stroke();
        ctx.beginPath(); ctx.ellipse(-3.6, -6.6, 1.6, 1, -0.6, 0, TAU); ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.fill();
        ctx.restore();
    }
    function candy(ctx, x, y, sz, rot, col) {
        ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
        poly(ctx, [[-sz * 0.6, 0], [-sz * 1.2, -sz * 0.5], [-sz * 1.2, sz * 0.5]], col, INK, 1.2);
        poly(ctx, [[sz * 0.6, 0], [sz * 1.2, -sz * 0.5], [sz * 1.2, sz * 0.5]], col, INK, 1.2);
        ellipse(ctx, 0, 0, sz * 0.7, sz * 0.55, col, INK, 1.4);
        ctx.beginPath(); ctx.moveTo(-sz * 0.3, -sz * 0.45); ctx.lineTo(sz * 0.1, sz * 0.5); line(ctx, 'rgba(255,255,255,.8)', 1.6); ctx.stroke();
        ctx.restore();
    }
    function sweet(ctx, t, S) {
        const H = S.H, cols = ['#ff8fbd', '#ffc2dc', '#c8a8ff', '#ffd59e', '#9fe3ff'];
        for (let i = 0; i < 8; i++) { const s = i * 29; glowDot(ctx, rnd(s) * 450, rnd(s + 1) * H, 50 + rnd(s + 2) * 40, ['rgba(255,170,210,.18)', 'rgba(200,170,255,.16)', 'rgba(255,220,160,.14)'][i % 3], smooth(0, 1, t)); }
        // Giriş: avatardan fışkıran kalpler + genişleyen kalp halkası
        if (t < 2.6) for (let i = 0; i < 16; i++) {
            const s = i * 11, a = (i / 16) * TAU + rnd(s) * 0.3, sp = 120 + rnd(s + 1) * 90, age = t - 0.15; if (age < 0) continue;
            const x = S.ax + Math.cos(a) * sp * age, y = S.ay + Math.sin(a) * sp * age + 60 * age * age;
            alpha(ctx, 1 - smooth(1.6, 2.5, t), () => heart(ctx, x, y, 9 + rnd(s + 2) * 6, Math.sin(age * 6 + s) * 0.4, cols[i % 5]));
        }
        ring(ctx, S.ax, S.ay, S.ar + 6 + 60 * ease(t / 0.9), S.ar + 6 + 60 * ease(t / 0.9), '#ffb3d1', 3, 1 - smooth(0.3, 1, t));
        // süzülen kalpler ve şekerler (aşağıdan yukarı)
        for (let i = 0; i < 22; i++) {
            const s = i * 47, speed = 18 + rnd(s + 1) * 20, y = H + 20 - period(t * speed + rnd(s + 2) * (H + 40) * 2, H + 40);
            const x = rnd(s) * 430 + 10 + Math.sin(t * (0.8 + rnd(s + 3)) + s) * 16;
            const a = smooth(0.8, 2, t) * edgeFade(x, y, H) * smooth(-10, 40, y);
            if (i % 5 === 4) alpha(ctx, a, () => candy(ctx, x, y, 6 + rnd(s + 4) * 3, t * 0.8 + s, cols[(i + 1) % 5]));
            else alpha(ctx, a, () => heart(ctx, x, y, 7 + rnd(s + 4) * 7, Math.sin(t * 1.4 + s) * 0.3, cols[i % 5]));
        }
        // parıltılar
        for (let i = 0; i < 18; i++) { const s = i * 61, x = 14 + rnd(s) * 422, y = 14 + rnd(s + 1) * (H - 28); alpha(ctx, smooth(0.5, 1.5, t) * edgeFade(x, y, H) * Math.pow(0.5 + 0.5 * Math.sin(t * (2 + rnd(s + 2) * 2) + i), 5), () => star(ctx, x, y, 6, ['#fff3c4', '#ffd1e8', '#e2d4ff'][i % 3])); }
        // 7 sn'de bir avatarın yanında küçük kalp patlaması
        const p = period(t - 3, 7);
        if (t > 3 && p < 1.4) for (let i = 0; i < 6; i++) {
            const a = -Math.PI / 2 + (i - 2.5) * 0.35, side = Math.floor((t - 3) / 7) % 2 ? 1 : -1, ox = S.ax + side * (S.ar + 26);
            alpha(ctx, 1 - p / 1.4, () => heart(ctx, ox + Math.cos(a) * 50 * p, S.ay + Math.sin(a) * 50 * p, 7, 0, cols[i % 5]));
        }
    }

    const RENDER = { catparty, koi, cherry, astral, neon, sakura, stagelights, flame, ink, storm, sweet };
    // Simülasyonla üretilmiş döngüler (fx-studio/sim/simfx.py): siyah zemin, CSS 'screen' karışımıyla karta ışık gibi biner.
    // Video kartın doğrudan çocuğudur (katmanın içinde olsa karışım yalnızca boş katmanla olurdu → siyah görünürdü).
    const VID = { flame: { src: '/fx/alev.mp4', poster: '/fx/alev-poster.webp', cls: 'pfxs-vid-bottom' },
        ink: { src: '/fx/murekkep.mp4', poster: '/fx/murekkep-poster.webp', cls: 'pfxs-vid-full' } };

    // ── örnek (instance) yönetimi ──
    const all = new Set();
    const byBox = new WeakMap();
    const reducedMq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
    // Uygulamanın kendi ayarı esas (Ayarlar › Genel › Animasyonları azalt; 'Sistemle eşitle' açıksa sistem ayarını da bu sınıf taşır).
    // Sistem ayarına doğrudan bakılmaz: Windows'ta animasyon efektleri kapalıyken efektler hiç oynamıyordu (uygulama ayarı esas).
    const reduced = () => document.documentElement.classList.contains('reduce-motion');
    // Hafif mod: sahneler sürer ama saniyede 6 kare ve ani parlamasız (Yıldırım flaşı kapalı)
    const lite = () => document.documentElement.classList.contains('motion-lite');

    function mount(box, effect) {
        const still = box.classList.contains('st-prof');      // mağaza küçük resmi: tek sabit kare
        const layer = document.createElement('div');
        layer.className = 'pfxs';
        layer.setAttribute('aria-hidden', 'true');
        const canvas = document.createElement('canvas');
        layer.appendChild(canvas);
        box.appendChild(layer);
        box.classList.add('has-pfxc');
        const ctx = canvas.getContext('2d');
        if (!ctx) { layer.remove(); return null; }   // tuval belleği dolu (iOS): efektsiz devam
        const inst = { box, effect, layer, still, start: performance.now(), timer: 0, visible: false, S: { H: 880, ax: 225, ay: 120, ar: 48 }, w: 0, h: 0, sc: 1, vid: null };
        if (VID[effect]) {
            const V = VID[effect];
            const v = document.createElement(still ? 'img' : 'video');
            v.className = 'pfxs-vid ' + V.cls; v.setAttribute('aria-hidden', 'true');
            if (still) { v.alt = ''; v.decoding = 'async'; v.src = V.poster; v.classList.add('on'); }
            else {
                v.muted = true; v.defaultMuted = true; v.loop = true; v.playsInline = true; v.preload = 'none'; v.disablePictureInPicture = true;   // kart görünmeden inmez
                v.setAttribute('muted', ''); v.setAttribute('playsinline', ''); v.poster = V.poster; v.src = V.src;
                v.addEventListener('playing', () => v.classList.add('on'));
            }
            box.insertBefore(v, layer);
            inst.vid = v;
        }
        if (effect === 'catparty') images();

        // Ölçü: transform'dan etkilenmeyen yerleşim ölçüleri (açılış animasyonu sırasında da doğru).
        // Kart kendi içinde kayıyorsa (uzun profil) katman görünen alana sabitlenir.
        inst.measure = () => {
            const W = box.clientWidth, Hh = box.clientHeight;
            if (!W || !Hh) return false;
            const dpr = Math.min(MAX_DPR, window.devicePixelRatio || 1);
            inst.w = W; inst.h = Hh; inst.sc = W / 450; inst.dpr = dpr;
            const cw = Math.round(W * dpr), ch = Math.round(Hh * dpr);
            if (canvas.width !== cw) canvas.width = cw;      // aynı boyutu yeniden atamak tuval belleğini baştan ayırır
            if (canvas.height !== ch) canvas.height = ch;
            const S = inst.S; S.H = Hh / inst.sc;
            const av = box.querySelector('.profile-avatar-wrap, .st-av, .pv-avatar');
            if (av) {
                // Görünen alana göre konum; açılış animasyonundaki ölçek (k) geri alınır
                const a = av.getBoundingClientRect(), r = box.getBoundingClientRect(), k = (r.width / W) || 1;
                S.ax = (a.left + a.width / 2 - r.left - box.clientLeft * k) / k / inst.sc;
                S.ay = (a.top + a.height / 2 - r.top - box.clientTop * k) / k / inst.sc;
                S.ar = Math.max(20, a.width / 2 / k / inst.sc);
            }
            return true;
        };
        const onScroll = () => { const tr = box.scrollTop ? `translateY(${box.scrollTop}px)` : ''; layer.style.transform = tr; if (inst.vid) inst.vid.style.transform = tr; if (inst.measure()) inst.draw(); };
        box.addEventListener('scroll', onScroll, { passive: true });
        inst.unscroll = () => box.removeEventListener('scroll', onScroll);
        inst.draw = () => {
            if (!box.isConnected) { destroy(inst); return; }   // kart DOM'dan kaldırıldı (önizleme kapandı, ızgara yeniden çizildi)
            if (!inst.w && !inst.measure()) return;
            const t = inst.still ? (THUMB_T[inst.effect] ?? STILL_T) : reduced() ? (CALM_T[inst.effect] ?? STILL_T) : (performance.now() - inst.start) / 1000;
            const fps = lite() ? FPS / 2 : FPS, tq = Math.floor(t * fps) / fps;
            inst.S.lite = lite();
            try {
                ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.setTransform(inst.dpr * inst.sc, 0, 0, inst.dpr * inst.sc, 0, 0);
                RENDER[inst.effect](ctx, tq, inst.S);
            } catch (e) { console.error('Profil efekti çizilemedi:', e); destroy(inst); }
        };
        function loop() {
            inst.timer = 0;
            if (!box.isConnected) { destroy(inst); return; }
            if (!inst.visible || document.hidden || inst.still) return;
            // Uygulama odakta değilken / ekran paylaşımı izlenirken (CSS animasyonlarının duraklatılmasıyla aynı kural) bekler
            const bc = document.body.classList, v = inst.vid && inst.vid.tagName === 'VIDEO' ? inst.vid : null;
            if (bc.contains('app-unfocused') || bc.contains('watching-share')) { if (v) v.pause(); inst.timer = setTimeout(loop, 1000); return; }
            // Tamamen kapalıyken tek sabit kare (video durur, kapak karesi görünür); ayar kapatılırsa (sınıf değişimi olay vermez)
            // saniyede bir kontrolle devam eder
            if (reduced()) { if (!inst.calm) { inst.calm = true; inst.draw(); if (v) { v.pause(); v.classList.add('on'); } } inst.timer = setTimeout(loop, 1000); return; }
            if (inst.calm) { inst.calm = false; inst.start = performance.now(); }
            if (v) {
                const rate = lite() ? 0.6 : 1;                // hafif modda ateş/duman da yavaşlar (daha az kare çözülür)
                if (v.playbackRate !== rate) v.playbackRate = rate;
                if (v.paused) { const p = v.play(); if (p && p.catch) p.catch(() => {}); }
            }
            requestAnimationFrame(() => { if (inst.visible) inst.draw(); });
            inst.timer = setTimeout(loop, lite() ? STEP * 2 : STEP);
        }
        inst.play = (fromStart) => {
            if (fromStart) inst.start = performance.now();
            inst.measure(); inst.draw();
            if (!inst.timer) inst.timer = setTimeout(loop, STEP);
            const v = inst.vid;
            if (v && v.tagName === 'VIDEO') {
                if (reduced()) { v.pause(); v.classList.add('on'); }        // kapalı: kapak karesi (poster) sabit
                else {
                    v.preload = 'auto';
                    if (fromStart) { v.classList.remove('on'); try { v.currentTime = 0; } catch (_) {} }
                    const p = v.play(); if (p && p.catch) p.catch(() => v.classList.add('on'));   // otomatik oynatma engeli: kapak görünür
                }
            }
        };
        inst.ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => { if (inst.measure()) inst.draw(); }) : null;
        if (inst.ro) inst.ro.observe(box);
        // Açılış animasyonu bitince avatar konumunu yeniden ölç
        const onAnimEnd = (e) => { if (e.target === box && inst.measure()) inst.draw(); };
        box.addEventListener('animationend', onAnimEnd);
        inst.unanim = () => box.removeEventListener('animationend', onAnimEnd);
        // Görünürlük: kart ekrana geldiğinde (pencere açıldı / kaydırıldı) giriş baştan oynar; gidince çizim durur.
        inst.io = 'IntersectionObserver' in window ? new IntersectionObserver((es) => {
            const vis = es[es.length - 1].isIntersecting;
            if (vis && !inst.visible) { inst.visible = true; inst.play(!inst.still); }
            else if (!vis) { inst.visible = false; stop(inst); if (!box.isConnected) destroy(inst); }
        }) : null;
        if (inst.io) inst.io.observe(box); else { inst.visible = true; inst.play(true); }
        all.add(inst); byBox.set(box, inst);
        return inst;
    }
    function stop(inst) {
        if (inst.timer) { clearTimeout(inst.timer); inst.timer = 0; }
        if (inst.vid && inst.vid.tagName === 'VIDEO') { try { inst.vid.pause(); } catch (_) {} }
    }
    function destroy(inst) {
        if (inst.dead) return;
        inst.dead = true;
        stop(inst);
        inst.unscroll(); inst.unanim();
        const c = inst.layer.firstChild; if (c) { c.width = 0; c.height = 0; }   // iOS'ta tuval belleğini hemen bırak
        if (inst.ro) inst.ro.disconnect();
        if (inst.io) inst.io.disconnect();
        if (inst.vid) { if (inst.vid.tagName === 'VIDEO') { try { inst.vid.removeAttribute('src'); inst.vid.load(); } catch (_) {} } inst.vid.remove(); }
        inst.layer.remove();
        all.delete(inst); byBox.delete(inst.box);
    }
    function applyScene(box, effect) {
        if (!box) return;
        const cur = byBox.get(box);
        if (cur && cur.effect === effect) { box.classList.add('has-pfxc'); return; } // aynı efekt: yeniden açılışta görünürlük girişi baştan oynatır
        if (cur) destroy(cur);
        if (Object.prototype.hasOwnProperty.call(RENDER, effect)) mount(box, effect);
        // Kopmuş kartlarda kalan örnekleri temizle (ör. mağaza ızgarası innerHTML ile yeniden çizildi)
        all.forEach((i) => { if (!i.box.isConnected) destroy(i); });
    }
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) all.forEach((i) => { if (i.vid && i.vid.tagName === 'VIDEO') i.vid.pause(); });
        else all.forEach((i) => i.visible && !i.timer && i.play(false));
    });
    if (reducedMq && reducedMq.addEventListener) reducedMq.addEventListener('change', () => all.forEach((i) => { i.calm = false; if (i.visible) i.draw(); }));

    window.SauranScenes = { SCENES, applyScene, size: () => all.size, state: () => [...all].map((i) => ({ effect: i.effect, visible: i.visible, running: !!i.timer, w: Math.round(i.w), still: i.still })) };

    // applyProfileEffect'e bağlan
    const orig = window.applyProfileEffect;
    if (typeof orig === 'function') {
        window.applyProfileEffect = function (el, effect) {
            const out = orig.apply(this, arguments);
            try { if (el) applyScene(el.closest('.profile-modal-box, .st-prof'), effect); } catch (e) { console.error(e); }
            return out;
        };
    }
})();
