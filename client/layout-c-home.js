/* Sıkı Düzen — telefon ana ekranı (lobi listesi): üstte "Sabitlenenler", altında gelen kutusu tarzı ince satırlar.
   Satırı sola kaydırınca Sabitle / Sessize al düğmeleri açılır. Satır içeriğini script.js renderHubCard üretir;
   bu dosya yalnızca sabitlenenler şeridini, kaydırma eylemlerini ve sunucuya kaydetmeyi ekler. */
(function () {
    'use strict';
    const $ = (id) => document.getElementById(id);
    const body = document.body;
    const tr = (k, fb) => { try { const v = typeof t === 'function' ? t(k) : ''; return v && v !== k ? v : fb; } catch (_) { return fb; } };
    const esc = (s) => (typeof escapeHtml === 'function' ? escapeHtml(s) : String(s));
    const escA = (s) => (typeof escapeAttr === 'function' ? escapeAttr(s) : String(s));
    const phone = window.matchMedia('(max-width: 720px) and (min-height: 501px)');
    const content = $('hub-list-content');
    if (!content) return;

    // ── Sabitlenenler şeridi ──
    const pinned = document.createElement('div');
    pinned.id = 'hub-pinned';
    pinned.className = 'hub-pinned';
    pinned.hidden = true;
    content.parentElement.insertBefore(pinned, content);

    function renderPinned(hubs) {
        const list = (hubs || []).filter((h) => h.pinned).sort((a, b) => String(a.pinned_at).localeCompare(String(b.pinned_at)));
        pinned.hidden = !list.length;
        if (!list.length) { pinned.innerHTML = ''; return; }
        pinned.innerHTML = `<div class="hub-pinned-title"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4h6l-1 5 3 3v2H7v-2l3-3zM12 14v6"/></svg>${esc(tr('hub-pinned-title', 'Sabitlenenler'))}</div>
            <div class="hub-pinned-row">${list.map((h) => {
                const icon = h.image_data ? `<img src="${escA(h.image_data)}" alt="">` : `<span>${esc(String(h.name || '?').charAt(0).toUpperCase())}</span>`;
                return `<button type="button" class="hub-pin-chip${Number(h.voice_count) ? ' is-voice' : ''}" data-open-hub="${Number(h.id)}">
                    <span class="hub-pin-ico">${icon}</span><b>${esc(h.name)}</b>
                    ${Number(h.voice_count) ? '<i class="hub-pin-mic" aria-label="seste"></i>' : ''}
                    <span class="hub-card-unread" data-hub-unread="${Number(h.id)}" style="display:none;"></span></button>`;
            }).join('')}</div>`;
        if (typeof renderHubUnreadBadges === 'function') renderHubUnreadBadges();
    }
    pinned.addEventListener('click', (e) => {
        const b = e.target.closest('[data-open-hub]');
        if (b && typeof openHub === 'function') openHub(Number(b.dataset.openHub));
    });
    document.addEventListener('sauran:hubs-loaded', (e) => { renderPinned(e.detail); decorateRows(e.detail); });

    // ── Kaydırma eylemleri ──
    const ACT_W = 140;
    function decorateRows(hubs) {
        const byId = new Map((hubs || []).map((h) => [String(h.id), h]));
        content.querySelectorAll('.hub-card[data-hub-id]').forEach((card) => {
            if (card.parentElement && card.parentElement.classList.contains('hub-swipe')) return;
            const h = byId.get(card.dataset.hubId);
            if (!h) return;
            const wrap = document.createElement('div');
            wrap.className = 'hub-swipe';
            const acts = document.createElement('div');
            acts.className = 'hub-swipe-acts';
            acts.innerHTML = `<button type="button" class="hub-swipe-pin" data-act="pin">${esc(h.pinned ? tr('hub-unpin', 'Sabitlemeyi kaldır') : tr('hub-pin', 'Sabitle'))}</button>
                <button type="button" class="hub-swipe-mute" data-act="mute">${esc(h.muted ? tr('hub-unmute', 'Sesi aç') : tr('hub-mute', 'Sessize al'))}</button>`;
            card.parentElement.insertBefore(wrap, card);
            wrap.append(acts, card);
            acts.addEventListener('click', async (ev) => {
                const b = ev.target.closest('[data-act]');
                if (!b) return;
                ev.stopPropagation();
                b.disabled = true;
                const pin = b.dataset.act === 'pin';
                const url = `/api/hubs/${Number(h.id)}/${pin ? 'pin' : 'mute'}`;
                const payload = pin ? { pinned: !h.pinned } : { muted: !h.muted };
                try {
                    const r = await fetch(url, { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
                    const d = await r.json().catch(() => ({}));
                    if (!r.ok || !d.success) throw new Error(d.error || '');
                    if (typeof showToast === 'function') showToast(pin ? (payload.pinned ? 'Sabitlendi' : 'Sabitleme kaldırıldı') : (payload.muted ? 'Sessize alındı' : 'Sesi açıldı'));
                    if (typeof loadHubList === 'function') loadHubList();
                } catch (err) {
                    b.disabled = false;
                    if (typeof showNotice === 'function') showNotice(err.message || 'Kaydedilemedi.');
                }
            });
            attachSwipe(wrap, card);
        });
    }

    let openRow = null;
    function setOffset(card, x, animate) {
        card.style.transition = animate ? 'transform .2s ease' : 'none';
        card.style.transform = x ? `translateX(${x}px)` : '';
    }
    function closeOpen() { if (openRow) { setOffset(openRow, 0, true); openRow = null; } }
    function attachSwipe(wrap, card) {
        let sx = 0, sy = 0, dx = 0, dragging = false, decided = false, base = 0;
        card.addEventListener('touchstart', (e) => {
            if (!phone.matches || !body.classList.contains('lc')) return;
            const p = e.touches[0];
            sx = p.clientX; sy = p.clientY; dx = 0; dragging = true; decided = false;
            base = openRow === card ? -ACT_W : 0;
            if (openRow && openRow !== card) closeOpen();
        }, { passive: true });
        card.addEventListener('touchmove', (e) => {
            if (!dragging) return;
            const p = e.touches[0];
            const mx = p.clientX - sx, my = p.clientY - sy;
            if (!decided) {
                if (Math.abs(mx) < 8 && Math.abs(my) < 8) return;
                decided = true;
                if (Math.abs(my) > Math.abs(mx)) { dragging = false; return; } // dikey kaydırma: listeyi kaydır
            }
            dx = Math.max(-ACT_W - 20, Math.min(0, base + mx));
            setOffset(card, dx, false);
        }, { passive: true });
        card.addEventListener('touchend', () => {
            if (!dragging) return;
            dragging = false;
            if (!decided) return;
            const open = dx < -ACT_W / 2;
            setOffset(card, open ? -ACT_W : 0, true);
            openRow = open ? card : null;
            // Kaydırma sonrası gelen tıklama lobiyi açmasın
            card.dataset.swiped = '1';
            setTimeout(() => { delete card.dataset.swiped; }, 350);
        });
        card.addEventListener('click', (e) => {
            if (card.dataset.swiped || openRow === card) { e.stopImmediatePropagation(); e.preventDefault(); closeOpen(); }
        }, true);
    }
    document.addEventListener('touchstart', (e) => { if (openRow && !e.target.closest('.hub-swipe')) closeOpen(); }, { passive: true });

    // Seste olan değişince liste tazelenir (ana ekran açıkken)
    let t1 = null;
    document.addEventListener('sauran:voice-changed', () => {
        if (body.dataset.view !== 'hubs' || typeof loadHubList !== 'function') return;
        clearTimeout(t1);
        t1 = setTimeout(loadHubList, 800);
    });
})();
