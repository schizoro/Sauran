/* Hareket saati — pahalı, sürekli dönen süs animasyonlarını Discord'daki gibi saniyede 12 kareye indirir.
   Neden: Telefonlarda (özellikle iPhone) isim efektleri, çerçeve parlamaları, profil efektleri gibi sonsuz CSS animasyonları
   saniyede 60 kez yeniden hesaplanıyordu (renk kaydırma, gölge, filtre, SVG). Ölçüm (telefon görünümü, 4× yavaş işlemci):
   lobi sohbeti %23 → %10, efektli profil %40 → %18, masaüstü lobi %65 → %14 ana iş parçacığı meşguliyeti.
   Kurallar:
   - Animasyonlar DURMAZ; yalnızca kare hızı düşer. Ekranda olmayan (kapsayıcısı görünmeyen) öğe o an ilerletilmez.
   - Transform/opacity animasyonları da yönetilir: 60 fps'te bırakılınca ekran saniyede 60 kez yeniden oluşturuluyordu
     (ölçüm: masaüstü lobi %14 → %32). 12 fps'te ekran saniyede 12 kez güncellenir; telefonda grafik işlemcisi de dinlenir.
   - CSS'in bilerek durdurduğu animasyonlara (animation-play-state: paused — ör. üzerine gelince oynayanlar, yan panel açıkken
     akış) dokunulmaz / o sırada ilerletilmez.
   - Yükleniyor göstergeleri gibi arayüz animasyonları hariç tutulur. Sonsuz olmayan (tek seferlik) animasyonlara dokunulmaz. */
(function () {
    'use strict';
    if (!document.getAnimations || typeof CSSAnimation === 'undefined') return; // eski tarayıcı: hiçbir şey değişmez
    const FPS = 12;
    const STEP = 1000 / FPS;
    const EXCLUDE = /spin|loader|loading|skeleton|skShimmer|btn-spinner|typing|speak/i;
    const controlled = new Map();   // Animation → { el, watch, offset }
    const watchCount = new Map();   // kapsayıcı → kaç animasyon izliyor (unobserve için)
    const visible = new WeakMap();  // kapsayıcı → görünür mü
    const pausedByCss = new WeakMap(); // öğe → { at, paused }
    const io = 'IntersectionObserver' in window ? new IntersectionObserver((entries) => {
        for (const e of entries) visible.set(e.target, e.isIntersecting);
    }, { rootMargin: '64px' }) : null;
    let timer = 0;
    let lastScan = 0;
    const t0 = performance.now();

    function isInfinite(a) {
        try { const t = a.effect && a.effect.getTiming(); return t && t.iterations === Infinity; } catch (_) { return false; }
    }
    function cssPaused(el) {
        // CSS ile durdurulmuş mu (play-state: paused)? Saniyede en fazla bir kez okunur.
        const now = performance.now();
        const c = pausedByCss.get(el);
        if (c && now - c.at < 1000) return c.paused;
        let paused = false;
        try { paused = /paused/.test(getComputedStyle(el).animationPlayState); } catch (_) {}
        pausedByCss.set(el, { at: now, paused });
        return paused;
    }
    function release(a, c) {
        controlled.delete(a);
        const n = (watchCount.get(c.watch) || 1) - 1;
        if (n <= 0) { watchCount.delete(c.watch); io && io.unobserve(c.watch); }
        else watchCount.set(c.watch, n);
    }
    function take(a) {
        if (controlled.has(a) || a.playState !== 'running' || !isInfinite(a)) return;
        if (!(a instanceof CSSAnimation) || EXCLUDE.test(a.animationName || '')) return;
        const el = a.effect && a.effect.target;
        if (!el || cssPaused(el)) return;
        // Her animasyonun kendi evresi (negatif gecikmeyle dağıtılmış parçacıklar dahil) korunur.
        const offset = (a.currentTime || 0) - (performance.now() - t0);
        try { a.pause(); } catch (_) { return; }
        // Görünürlük, hareket eden öğenin değil SABİT kapsayıcısının üzerinden ölçülür (parçacık kutudan çıkınca donmasın).
        const watch = el.parentElement || el;
        controlled.set(a, { el, watch, offset });
        watchCount.set(watch, (watchCount.get(watch) || 0) + 1);
        if (io && watchCount.get(watch) === 1) { if (!visible.has(watch)) visible.set(watch, true); io.observe(watch); }
        schedule();
    }
    function scan() {
        lastScan = performance.now();
        for (const a of document.getAnimations()) take(a);
    }
    function tick() {
        timer = 0;
        if (document.hidden) return; // gizli sekmede hiç uyanmaz; görünür olunca visibilitychange yeniden başlatır
        if (performance.now() - lastScan > 10000) scan(); // animationstart kaçırırsa diye seyrek emniyet taraması
        if (controlled.size) {
            const q = Math.floor((performance.now() - t0) / STEP) * STEP; // 12 fps'e yuvarlanmış zaman
            requestAnimationFrame(() => {
                for (const [a, c] of controlled) {
                    if (!c.el.isConnected || a.playState === 'idle') { release(a, c); continue; }
                    if (io && visible.get(c.watch) === false) continue;  // ekranda değil
                    if (cssPaused(c.el)) continue;                         // CSS bilerek durdurmuş (ör. yan panel açık)
                    try { a.currentTime = Math.max(0, q + c.offset); } catch (_) { release(a, c); }
                }
            });
        }
        schedule();
    }
    function schedule() {
        if (!timer && !document.hidden) timer = setTimeout(tick, controlled.size ? STEP : 10000);
    }

    // Yeni başlayan animasyonlar (mesaj, profil, kart açıldıkça). Sözde öğeler (::before/::after) dahil.
    document.addEventListener('animationstart', (e) => {
        const el = e.target;
        if (!el || !el.getAnimations) return;
        const pseudo = e.pseudoElement || '';
        for (const a of el.getAnimations({ subtree: true })) {
            if (a.animationName !== e.animationName) continue;
            const pe = (a.effect && a.effect.pseudoElement) || '';
            if (pe !== pseudo || a.effect.target !== el) continue;
            take(a);
        }
        schedule();
    }, true);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) schedule(); });
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => { scan(); schedule(); });
    else { scan(); schedule(); }

    window.SauranMotionClock = { FPS, size: () => controlled.size, scan };
})();
