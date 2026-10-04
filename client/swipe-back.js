/* Genel "geri" kaydırması: ekranın sol kenarından sağa kaydırınca (dokunmatik) bir önceki ekrana dönülür.
   Geri düğmesi olan ya da olmayan TÜM pencerelerde çalışır. Sıra: en üstteki açık pencere/ekran → açık çekmece → görünüm (Keşfet/Lobi → Ana Menü).
   Zorunlu bilgilendirme pencereleri (kapatma düğmesi olmayan) kaydırmayla kapanmaz. script.js ve shell.js'ten SONRA yüklenir. */
(function () {
    'use strict';
    const $ = (id) => document.getElementById(id);
    const EDGE = 34;           // kenardan en çok bu kadar piksel içinden başlamalı
    const MIN_DX = 70, MAX_DY = 60, MAX_MS = 700;
    const LAYERS = '.modal-overlay, .hubset-screen, .cz-screen, .store-screen, .pv-overlay, #dm-modal, .emoji-panel';
    const CLOSE_SEL = '[data-close], .modal-close, .profile-close-btn, .hub-info-close, .hubset-close, [id$="close-btn"], [id$="-close"], [id$="cancel-btn"], button[aria-label="Kapat"], button[aria-label="Close"]';
    const CLOSE_TEXT = new Set(['✕', '×', 'x', 'X', 'Kapat', 'Vazgeç', 'İptal', '←']);

    function visible(el) {
        if (!el || !el.isConnected) return false;
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden') return false;
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
    }
    function topLayer() {
        let best = null, bestZ = -1;
        document.querySelectorAll(LAYERS).forEach((el) => {
            if (!visible(el) || el.hasAttribute('data-no-swipe')) return;
            const z = parseInt(getComputedStyle(el).zIndex, 10);
            const zz = Number.isNaN(z) ? 0 : z;
            if (zz >= bestZ) { best = el; bestZ = zz; }
        });
        return best;
    }
    function findClose(layer) {
        const direct = [...layer.querySelectorAll(CLOSE_SEL)].find((b) => b.tagName === 'BUTTON' && visible(b) && !b.disabled);
        if (direct) return direct;
        return [...layer.querySelectorAll('button')].find((b) => visible(b) && !b.disabled && CLOSE_TEXT.has((b.textContent || '').trim()));
    }
    function closeLayer(layer) {
        if (layer.id === 'pv-overlay') { layer.style.display = 'none'; layer.innerHTML = ''; return true; }
        if (layer.id === 'store-screen' && typeof window.closeStore === 'function') { window.closeStore(); return true; }
        if (layer.id === 'emoji-panel') { layer.style.display = 'none'; return true; }
        const btn = findClose(layer);
        if (btn) { btn.click(); return true; }
        // kapatma düğmesi yok: yalnızca dışına dokununca kapanan pencereler (overlay'in kendisine tıklama) denenir; zorunlu bilgilendirmeler etkilenmez
        if (layer.classList.contains('modal-overlay') && !layer.querySelector('[data-required], .modal-required')) {
            const before = visible(layer);
            layer.click();
            return before && !visible(layer);
        }
        return false;
    }
    function goBack() {
        const layer = topLayer();
        if (layer && closeLayer(layer)) return true;
        const body = document.body;
        if (body.classList.contains('lobby-drawer-open')) {
            body.classList.remove('lobby-drawer-open', 'drawer-friends', 'drawer-groups', 'drawer-friendlist');
            return true;
        }
        const view = body.dataset.view || '';
        if (view === 'hub-detail') { const b = $('hub-back-btn'); if (b) { b.click(); return true; } }
        if (view === 'discover') { const h = $('rail-home'); if (h) { h.click(); return true; } }
        return false;
    }

    let sx = 0, sy = 0, t0 = 0, track = false;
    document.addEventListener('touchstart', (e) => {
        const t = e.touches[0];
        track = e.touches.length === 1 && t.clientX <= EDGE;
        sx = t.clientX; sy = t.clientY; t0 = Date.now();
    }, { passive: true });
    document.addEventListener('touchcancel', () => { track = false; }, { passive: true });
    document.addEventListener('touchend', (e) => {
        if (!track) return;
        track = false;
        const t = e.changedTouches[0];
        if (t.clientX - sx > MIN_DX && Math.abs(t.clientY - sy) < MAX_DY && Date.now() - t0 < MAX_MS) {
            if (goBack() && navigator.vibrate) { try { navigator.vibrate(8); } catch (_) { /* yoksay */ } }
        }
    }, { passive: true });
    // Sağdan açılan yan pencere (Bildirimler): panelin üzerinde sağa doğru kaydırınca kapanır (liste dikey kaydırması etkilenmez)
    (function sidePanelSwipe() {
        const modal = $('notifications-modal');
        if (!modal) return;
        let px = 0, py = 0, pt = 0, on = false;
        modal.addEventListener('touchstart', (e) => { const t = e.touches[0]; on = e.touches.length === 1; px = t.clientX; py = t.clientY; pt = Date.now(); }, { passive: true });
        modal.addEventListener('touchend', (e) => {
            if (!on) return; on = false;
            const t = e.changedTouches[0];
            if (t.clientX - px > 90 && Math.abs(t.clientY - py) < 45 && Date.now() - pt < 600) { const b = $('notifications-close-btn'); if (b) b.click(); }
        }, { passive: true });
    })();
    window.__swipeBack = goBack; // test/elle çağırma
})();
