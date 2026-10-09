/* Profil kartı efektleri (Alev · Mürekkep · Yıldırım · Tatlı): kartın kenarlarından taşan, tamamen özgün, hafif (SVG + CSS transform/opacity) animasyonlar.
   Yalnızca profil kartında ve önizlemelerde canlıdır; listelerde kullanılmaz. Çizimler kodla üretilir (dosya/görsel yok).
   SauranFx.applyCard(kutu, 'flame'|'ink'|'storm'|'sweet'|diğer) → efekt katmanını ekler/kaldırır. script.js'ten sonra yüklenir. */
(function () {
    'use strict';
    const EFFECTS = { flame: 'Alev', ink: 'Mürekkep', storm: 'Yıldırım', sweet: 'Tatlı' };
    const rnd = (seed) => { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; };
    const f1 = (n) => (+n).toFixed(1);

    const FLAME_DEFS = '<defs><linearGradient id="fxfo" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#ffb02e"/><stop offset=".5" stop-color="#ff4d0f"/><stop offset="1" stop-color="#a3120a" stop-opacity=".85"/></linearGradient><linearGradient id="fxfi" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#fff1a8"/><stop offset=".6" stop-color="#ffc233"/><stop offset="1" stop-color="#ff7a1a"/></linearGradient></defs>';
    function flames(count, hMin, hMax, seed, cls) {
        const r = rnd(seed), step = 400 / count; let out = '';
        for (let i = 0; i < count; i++) {
            const x = step * (i + 0.5) + (r() - 0.5) * step * 0.4, h = hMin + r() * (hMax - hMin), w = step * 1.4, y0 = 140;
            const p = (hh, ww) => `M${f1(x - ww / 2)},${y0} C${f1(x - ww * 0.62)},${f1(y0 - hh * 0.45)} ${f1(x - ww * 0.1)},${f1(y0 - hh * 0.55)} ${f1(x)},${f1(y0 - hh)} C${f1(x + ww * 0.1)},${f1(y0 - hh * 0.55)} ${f1(x + ww * 0.62)},${f1(y0 - hh * 0.45)} ${f1(x + ww / 2)},${y0}Z`;
            out += `<g class="fl" style="animation-delay:${(-r() * 2).toFixed(2)}s;animation-duration:${(0.9 + r() * 0.8).toFixed(2)}s"><path d="${p(h, w)}" fill="url(#fxfo)"/><path d="${p(h * 0.62, w * 0.6)}" fill="url(#fxfi)"/></g>`;
        }
        return `<svg class="${cls}" viewBox="0 0 400 140" preserveAspectRatio="none" aria-hidden="true">${FLAME_DEFS}${out}</svg>`;
    }
    function particles(n, seed, cls, extra) {
        const r = rnd(seed); let out = '';
        for (let i = 0; i < n; i++) out += `<i class="${cls}" style="left:${f1(r() * 96 + 2)}%;--d:${(-r() * 8).toFixed(2)}s;--t:${(4 + r() * 5).toFixed(2)}s;--x:${Math.round((r() - 0.5) * 50)}px;${extra ? extra(r) : ''}"></i>`;
        return out;
    }

    function flame() {
        // Üstte kapak fotoğrafını kapatan katman yok; yalnızca alttan alevler ve yükselen kıvılcımlar.
        return flames(9, 70, 128, 11, 'fxc-bot') + particles(12, 5, 'fxc-ember');
    }

    function ink() {
        const r = rnd(7); let drips = '';
        for (let i = 0; i < 9; i++) {
            const x = 22 + i * 44 + (r() - 0.5) * 16, len = 26 + r() * 74, w = 9 + r() * 9;
            drips += `<g class="dr" style="animation-delay:${(-r() * 5).toFixed(2)}s;animation-duration:${(4.5 + r() * 3).toFixed(2)}s"><rect x="${f1(x - w / 2)}" y="10" width="${f1(w)}" height="${f1(len)}" rx="${f1(w / 2)}"/><circle cx="${f1(x)}" cy="${f1(10 + len)}" r="${f1(w * 0.95)}"/></g>`;
        }
        const top = `<svg class="fxc-top" viewBox="0 0 400 150" preserveAspectRatio="none" aria-hidden="true"><g fill="#07070d" stroke="#32325a" stroke-width="1.4"><path d="M0,0 H400 V20 C360,34 330,12 290,24 C250,36 220,14 180,26 C140,36 110,12 70,24 C40,32 20,20 0,26Z"/>${drips}</g></svg>`;
        const smoke = '<i class="fxc-smoke s1"></i><i class="fxc-smoke s2"></i><i class="fxc-smoke s3"></i>';
        // Üstten sarkan damlalar (top) kapak fotoğrafını kapattığı için gösterilmez.
        void top;
        return smoke + particles(8, 3, 'fxc-ash');
    }

    function bolt(x, y, seed) {
        const r = rnd(seed); const pts = [[x, y]]; let cx = x, cy = y;
        for (let i = 0; i < 6; i++) { cx += (r() - 0.5) * 36; cy += 22 + r() * 26; pts.push([cx, cy]); }
        const d = pts.map((p) => p.map(f1).join(',')).join(' ');
        return `<g class="bo" style="animation-delay:${(-r() * 6).toFixed(2)}s;animation-duration:${(5 + r() * 4).toFixed(2)}s"><polyline points="${d}" fill="none" stroke="rgba(120,160,255,.45)" stroke-width="10" stroke-linejoin="round" stroke-linecap="round"/><polyline points="${d}" fill="none" stroke="#eef4ff" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"/></g>`;
    }
    function storm() {
        const arcs = '<rect x="6" y="6" width="388" height="548" rx="26" fill="none" stroke="#8fbaff" stroke-width="2.2" stroke-dasharray="8 26" class="arc"/><rect x="12" y="12" width="376" height="536" rx="22" fill="none" stroke="#c7a8ff" stroke-width="1.4" stroke-dasharray="4 30" class="arc arc2"/>';
        return `<svg class="fxc-full" viewBox="0 0 400 560" preserveAspectRatio="none" aria-hidden="true">${arcs}${bolt(70, 0, 3)}${bolt(335, 120, 9)}${bolt(130, 340, 14)}</svg>` + particles(8, 17, 'fxc-spark');
    }

    function sweet() {
        const r = rnd(31); let out = '';
        const kinds = [['♥', '#ff7fb2'], ['✦', '#fff2a8'], ['♥', '#ffc4dc'], ['•', '#ffffff'], ['✦', '#ffd6ec']];
        for (let i = 0; i < 20; i++) {
            const k = kinds[i % kinds.length];
            out += `<i class="fxc-sw" style="left:${f1(r() * 94 + 2)}%;font-size:${Math.round(10 + r() * 14)}px;color:${k[1]};--d:${(-r() * 9).toFixed(2)}s;--t:${(6 + r() * 6).toFixed(2)}s;--x:${Math.round((r() - 0.5) * 40)}px">${k[0]}</i>`;
        }
        return out;
    }

    const BUILD = { flame, ink, storm, sweet };

    function applyCard(box, effect) {
        if (!box) return;
        box.querySelectorAll(':scope > .pfxc').forEach((n) => n.remove());
        box.classList.remove('has-pfxc');
        const build = BUILD[effect];
        if (!build) return;
        const layer = document.createElement('div');
        layer.className = 'pfxc pfxc-' + effect;
        layer.setAttribute('aria-hidden', 'true');
        layer.innerHTML = build();
        box.appendChild(layer);
        box.classList.add('has-pfxc');
        // Mağaza küçük resimlerinde (çok sayıda kart) CSS animasyonu kalır; ekran dışında duraklatılabilsin.
        if (!box.classList.contains('st-prof')) setRise(box, layer);
    }

    // iOS Safari, @keyframes içindeki CSS değişkenini animasyon başladıktan sonra güncellemiyor (eski kısa mesafede kalıyor).
    // Bu yüzden yükselme Web Animations API ile, mesafe doğrudan piksel olarak verilerek çalıştırılır.
    function animateRise(layer, rise) {
        if (layer._riseFor === rise) return;
        layer._riseFor = rise;
        const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        layer.querySelectorAll('.fxc-ember, .fxc-ash').forEach((el) => {
            if (el._riseAnim) el._riseAnim.cancel();
            if (reduce || typeof el.animate !== 'function') return;
            const cs = el.style;
            const dur = parseFloat(cs.getPropertyValue('--t')) * 1000 || 6000;
            const delay = parseFloat(cs.getPropertyValue('--d')) * 1000 || 0;
            const x = parseFloat(cs.getPropertyValue('--x')) || 0;
            el.style.animation = 'none';
            el._riseAnim = el.animate([
                { transform: 'translate(0px, 0px) scale(1)', opacity: 0 },
                { opacity: 1, offset: 0.1 },
                { opacity: 0.9, offset: 0.85 },
                { transform: `translate(${x}px, ${-rise}px) scale(.45)`, opacity: 0 }
            ], { duration: dur, delay, iterations: Infinity, easing: el.classList.contains('fxc-ash') ? 'linear' : 'ease-out' });
        });
    }

    // Yükselen parçacıklar kapak fotoğrafının hemen altına kadar çıksın: kutunun yüksekliğine göre mesafe.
    function setRise(box, layer) {
        const calc = () => {
            if (!layer.isConnected) return;
            const banner = box.querySelector('.profile-banner');
            const top = banner ? banner.offsetTop + banner.offsetHeight + 8 : 0;
            const h = box.clientHeight || box.getBoundingClientRect().height;
            if (!h) return;
            const rise = Math.max(160, h * 0.96 - top);
            layer.style.setProperty('--rise', `${Math.round(rise)}px`);
            animateRise(layer, Math.round(rise));
        };
        requestAnimationFrame(calc);
        setTimeout(calc, 400);
        setTimeout(calc, 1200);
        // Pencere açılış animasyonu / içerik yüklenmesi sırasında kutunun boyu değişirse yeniden hesapla.
        if (typeof ResizeObserver === 'function') {
            const ro = new ResizeObserver(() => { if (!layer.isConnected) { ro.disconnect(); return; } calc(); });
            ro.observe(box);
        }
    }

    window.SauranFx = { EFFECTS, applyCard };

    // Mevcut avatar efekti işlevine bağla: profil penceresi, önizleme sayfası ve mağaza küçük resimleri otomatik efekti gösterir.
    const orig = window.applyProfileEffect;
    if (typeof orig === 'function') {
        window.applyProfileEffect = function (el, effect) {
            const out = orig.apply(this, arguments);
            try { if (el) window.SauranFx.applyCard(el.closest('.profile-modal-box, .st-prof'), effect); } catch (_) { /* yoksay */ }
            return out;
        };
    }
})();
