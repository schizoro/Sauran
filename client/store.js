/* Sauran Mağaza ana sayfası: tüm kozmetik ürünler tek ızgarada, kartlarda kullanıcının KENDİ hesabıyla canlı küçük önizleme.
   Karta dokununca önizleme sayfası açılır (preview-sheet.js); yetki varsa "Uygula", yoksa "Plus/Premium ile aç".
   script.js, preview-sheet.js'ten SONRA yüklenir. "Sauran Market" menü düğmesi artık bu ekranı açar. */
(function () {
    'use strict';
    const $ = (id) => document.getElementById(id);
    const esc = (s) => (typeof escapeHtml === 'function' ? escapeHtml(s) : String(s));
    const escA = (s) => (typeof escapeAttr === 'function' ? escapeAttr(s) : String(s));
    const me = () => (typeof currentUser !== 'undefined' && currentUser) || {};
    const has = (f) => typeof userHasFeature === 'function' && userHasFeature(f);

    const CATS = [['all', 'Tümü'], ['frame', 'Çerçeveler'], ['profile', 'Profil'], ['chat', 'Sohbet'], ['card', 'Üye kartları'], ['atmo', 'Atmosphere'], ['sticker', 'Çıkartmalar']];
    const PICKS = [
        { id: 'profile-theme-picker', cat: 'profile', kind: 'ptheme', attr: 'ptheme', def: 'default', feature: 'profile_theme', field: 'profile_theme', group: 'Profil teması' },
        { id: 'profile-effect-picker', cat: 'profile', kind: 'effect', attr: 'effect', def: 'none', feature: 'profile_effect', field: 'profile_effect', group: 'Profil efekti' },
        { id: 'name-effect-picker', cat: 'profile', kind: 'nfx', attr: 'nfx', def: 'none', feature: 'name_effect', field: 'name_effect', group: 'İsim efekti' },
        { id: 'chat-theme-picker', cat: 'chat', kind: 'theme', attr: 'theme', def: 'classic', feature: 'chat_theme', field: 'chat_theme', group: 'Sohbet teması' },
        { id: 'bubble-style-picker', cat: 'chat', kind: 'bubble', attr: 'bubble', def: 'default', feature: 'bubble_style', field: 'bubble_style', group: 'Mesaj balonu' }
    ];
const optLabel = (btn) => { const c = btn.cloneNode(true); c.querySelectorAll('.nfx-preview, .chat-theme-swatch, .bubble-swatch').forEach((n) => n.remove()); return (c.textContent || '').trim(); };
    const state = { cat: 'all', items: [], wallet: null };

    function avatarInner() {
        const u = me();
        return u.avatar_data ? `<img src="${escA(u.avatar_data)}" alt="">` : `<span>${esc((u.username || '?').charAt(0).toUpperCase())}</span>`;
    }
    function tierBadge(tier, price) {
        if (tier === 'premium') return '<span class="subs-premium-badge st-badge">♛ PREMIUM</span>';
        if (tier === 'plus') return '<span class="plus-badge plus-badge-sm st-badge">✦ PLUS</span>';
        if (tier === 'coin') return `<span class="st-badge st-coin">🪙 ${esc(price)}</span>`;
        return '<span class="st-badge st-free">Ücretsiz</span>';
    }

    // ── Ürün listesi ──
    async function buildItems() {
        const u = me();
        const items = [];
        // Çerçeveler
        try {
            const r = await fetch('/api/market/frames', { credentials: 'include' });
            const d = await r.json();
            if (r.status === 200) {
                const frames = [{ key: 'classic', label: 'Klasik', rarity: 'free', price: 0, purchasable: false, owned: true, equipped: d.equipped === 'classic' }, ...d.items.filter((i) => !(typeof PLUS_ONLY_ITEM_KEYS !== 'undefined' && PLUS_ONLY_ITEM_KEYS.has(i.key)))];
                frames.forEach((f) => {
                    if (f.key === 'classic') return;
                    items.push({ cat: 'frame', id: 'frame:' + f.key, title: f.label, tier: f.price === 0 ? 'free' : 'coin', price: f.price, owned: Boolean(f.owned), active: Boolean(f.equipped), data: f, locked: !f.owned,
                        thumb: `<div class="st-frame profile-avatar-wrap frame-${escA(f.key)}">${typeof mkPreviewHtml === 'function' ? mkPreviewHtml(f) : esc(f.label.charAt(0))}</div>` });
                });
            }
        } catch (_) { /* çerçeveler yüklenemedi: kalan ürünler gösterilir */ }
        // Profil / sohbet seçenekleri (kendi seçicilerinden okunur: yeni seçenek eklenince otomatik gelir)
        PICKS.forEach((cfg) => {
            document.querySelectorAll(`#${cfg.id} .chat-theme-option`).forEach((btn) => {
                const key = btn.dataset[cfg.attr];
                if (key === undefined || key === cfg.def) return;
                const label = optLabel(btn) || key;
                const allowed = has(cfg.feature);
                let thumb = '';
                if (cfg.kind === 'ptheme') thumb = `<div class="st-prof profile-modal-box" data-profile-theme="${escA(key)}"><span class="st-av">${avatarInner()}</span></div>`;
                else if (cfg.kind === 'effect') thumb = `<div class="st-prof st-prof-fx"><span class="st-av" data-fx="${escA(key)}">${avatarInner()}</span></div>`;
                else if (cfg.kind === 'nfx') thumb = `<div class="st-nm">${typeof usernameCardHtml === 'function' ? usernameCardHtml(u.username || 'Ad', true, key) : esc(u.username || 'Ad')}</div>`;
                else if (cfg.kind === 'theme') thumb = `<div class="st-chat"><div class="hub-msg-bubble">Selam! 👋</div><div class="hub-msg-bubble chat-theme-${escA(key)}">Akşam oyun var mı?</div></div>`;
                else thumb = `<div class="st-chat"><div class="hub-msg-bubble">Selam! 👋</div><div class="hub-msg-bubble bubble-${escA(key)}">Akşam oyun var mı?</div></div>`;
                items.push({ cat: cfg.cat, id: cfg.id + ':' + key, title: label, sub: cfg.group, tier: 'plus', owned: allowed, active: (u[cfg.field] || cfg.def) === key, locked: !allowed, thumb, open: () => btn.click() });
            });
        });
        // Üye kartları (Premium)
        if (typeof renderCardStyleCard === 'function') renderCardStyleCard();
        if (typeof CARD_STYLES !== 'undefined') {
            const ok = has('premium_card');
            CARD_STYLES.forEach((c) => {
                const btn = document.querySelector(`#cz-cardstyle-card [data-card-style="${c.key}"]`);
                const prev = btn && btn.querySelector('.cz-card-prev');
                items.push({ cat: 'card', id: 'card:' + c.key, title: c.label, sub: 'Lobi üye kartı', tier: 'premium', owned: ok, active: ok && (u.card_style || 'classic') === c.key, locked: !ok, thumb: `<div class="st-cardthumb">${prev ? prev.outerHTML : ''}</div>`, open: () => btn && btn.click() });
            });
        }
        // Atmosphere
        try {
            const cat = typeof ensureAtmoCatalog === 'function' ? await ensureAtmoCatalog(true) : null;
            if (cat && cat.items) cat.items.forEach((a) => {
                items.push({ cat: 'atmo', id: 'atmo:' + a.key, title: a.label, sub: 'Atmosphere paketi', tier: a.tier === 'free' ? 'free' : a.tier, price: a.price_coins, owned: Boolean(a.available), active: Boolean(a.active), locked: !a.available, data: a,
                    thumb: `<div class="st-atmo" style="background:${a.art}"><span aria-hidden="true">${a.emoji}</span></div>` });
            });
        } catch (_) { /* katalog yok */ }
        // Çıkartmalar
        if (typeof STICKERS !== 'undefined') {
            const lists = [['plus', PLUS_STICKERS, 'sticker_pack', 'plus'], ['premium', PREMIUM_STICKERS, 'premium_sticker_pack', 'premium']];
            lists.forEach(([tier, list, feature]) => list.forEach((s) => {
                const ok = has(feature);
                items.push({ cat: 'sticker', id: 'stk:' + s.id, title: (s.id.replace(/^(plus|prem)-/, '').replace(/-/g, ' ')), sub: tier === 'premium' ? 'Premium çıkartma' : 'Plus çıkartma', tier, owned: ok, active: false, locked: !ok, data: s,
                    thumb: `<div class="st-stk">${typeof stickerInnerHtml === 'function' ? stickerInnerHtml(s.id) : esc(s.emoji)}</div>` });
            }));
        }
        return items;
    }

    // ── Çizim ──
    function cardHtml(it, i) {
        const badge = tierBadge(it.tier, it.price);
        const stateLine = it.active ? '<span class="st-state on">✓ Kullanımda</span>' : it.owned ? '<span class="st-state">Sende</span>' : it.tier === 'coin' ? '<span class="st-state soon">Yakında</span>' : '<span class="st-state lock">🔒 Kilitli</span>';
        return `<button type="button" class="st-card${it.locked ? ' st-locked' : ''}${it.active ? ' st-active' : ''}" data-st-i="${i}">
            <div class="st-thumb">${it.thumb}</div>
            <div class="st-meta"><div class="st-title">${esc(it.title)}</div>${it.sub ? `<div class="st-sub">${esc(it.sub)}</div>` : ''}<div class="st-row">${badge}${stateLine}</div></div>
        </button>`;
    }
    function renderGrid() {
        const grid = $('st-grid');
        if (!grid) return;
        const list = state.items.map((it, i) => [it, i]).filter(([it]) => state.cat === 'all' || it.cat === state.cat);
        grid.innerHTML = list.map(([it, i]) => cardHtml(it, i)).join('') || '<p class="st-empty">Bu kategoride ürün yok.</p>';
        grid.querySelectorAll('.st-av[data-fx]').forEach((el) => { if (typeof applyProfileEffect === 'function') applyProfileEffect(el, el.dataset.fx); });
        $('st-chips').querySelectorAll('[data-st-cat]').forEach((b) => b.classList.toggle('on', b.dataset.stCat === state.cat));
    }
    function renderPromo() {
        const box = $('st-promo');
        const u = me();
        const premOn = has('premium_card'), plusOn = has('chat_theme');
        const cards = [];
        if (!premOn) cards.push(`<button type="button" class="st-promo-card st-promo-prem" data-st-subs="1"><b>♛ Sauran Premium</b><span>Animasyonlu kartlar, hareketli avatar, lobi takviyesi ve daha fazlası</span><i>Aboneliği gör →</i></button>`);
        if (!plusOn) cards.push(`<button type="button" class="st-promo-card st-promo-plus" data-st-subs="1"><b>✦ Sauran Plus</b><span>Profil temaları, efektler, sohbet stilleri, kendi emojilerin</span><i>Aboneliği gör →</i></button>`);
        void u;
        box.innerHTML = cards.join('');
        box.style.display = cards.length ? '' : 'none';
    }

    async function open() {
        let scr = $('store-screen');
        if (!scr) {
            scr = document.createElement('div');
            scr.id = 'store-screen';
            scr.className = 'store-screen';
            scr.setAttribute('role', 'dialog'); scr.setAttribute('aria-modal', 'true'); scr.setAttribute('aria-label', 'Sauran Mağaza');
            scr.innerHTML = `<div class="st-shell">
                <header class="st-head"><button type="button" class="st-close" id="st-close" aria-label="Kapat">←</button><h2>🛍️ Mağaza</h2><span class="st-wallet" id="st-wallet">🪙 …</span></header>
                <div class="st-chips" id="st-chips" role="tablist">${CATS.map(([k, l]) => `<button type="button" role="tab" data-st-cat="${k}">${l}</button>`).join('')}</div>
                <div class="st-body"><div id="st-promo" class="st-promo"></div><div class="st-note">Bir ürüne dokun: kendi hesabınla nasıl görüneceğini gör.</div><div id="st-grid" class="st-grid"></div></div>
            </div>`;
            document.body.appendChild(scr);
            scr.addEventListener('click', onClick);
        }
        scr.style.display = 'flex';
        document.body.classList.add('st-open');
        $('st-grid').innerHTML = '<p class="st-empty">Yükleniyor…</p>';
        try { const w = await fetch('/api/wallet', { credentials: 'include' }); if (w.status === 200) { state.wallet = (await w.json()).balance; $('st-wallet').textContent = `🪙 ${state.wallet}`; } } catch (_) { /* cüzdan yok */ }
        await refresh();
    }
    async function refresh() {
        if (typeof renderChatThemePicker === 'function') { renderChatThemePicker(); renderBubbleStylePicker(); renderProfileThemePicker(); renderNameEffectPicker(); renderProfileEffectPicker(); }
        state.items = await buildItems();
        renderPromo();
        renderGrid();
    }
    function close() { const scr = $('store-screen'); if (scr) scr.style.display = 'none'; document.body.classList.remove('st-open'); }
    window.openStore = open;
    window.closeStore = close;
    document.addEventListener('pv-applied', () => { const scr = $('store-screen'); if (scr && scr.style.display !== 'none') refresh(); });

    // ── Kart → önizleme ──
    function sheetShell(html) {
        let ov = $('pv-overlay');
        if (!ov) { ov = document.createElement('div'); ov.id = 'pv-overlay'; ov.className = 'modal-overlay pv-overlay'; ov.addEventListener('click', (e) => { if (e.target === ov) { ov.style.display = 'none'; ov.innerHTML = ''; } }); document.body.appendChild(ov); }
        ov.innerHTML = `<div class="modal-box pv-sheet" role="dialog" aria-modal="true"><div class="pv-handle" aria-hidden="true"></div>${html}</div>`;
        ov.style.display = 'flex';
        return ov;
    }
    function closeSheet() { const ov = $('pv-overlay'); if (ov) { ov.style.display = 'none'; ov.innerHTML = ''; } }
    function upgrade(tier) { closeSheet(); close(); document.getElementById('subs-open-btn')?.click(); void tier; }

    function openItem(it) {
        if (it.open) { it.open(); return; } // seçici düğmesine devret: ortak önizleme sayfası açılır
        const upLabel = it.tier === 'premium' ? '♛ Premium ile aç' : '✦ Plus ile aç';
        if (it.cat === 'frame') {
            const f = it.data;
            const act = it.active ? '<button class="pv-btn pv-btn-ghost" disabled>Kuşanılı ✓</button>' : it.owned ? '<button class="pv-btn" data-a="equip">Kuşan</button>' : `<button class="pv-btn pv-btn-ghost" disabled>${f.purchasable ? 'Satın Al' : 'Satın Al — Yakında'}</button>`;
            const ov = sheetShell(`<div class="pv-stage"><div class="st-bigframe"><div class="mk-avatar-preview profile-avatar-wrap ${f.key !== 'classic' ? 'frame-' + escA(f.key) : ''}" style="width:104px;height:104px;">${avatarInner()}${typeof plusFrameOverlayHtml === 'function' && f.key === 'plus' ? plusFrameOverlayHtml() : ''}</div></div></div>
                <div class="pv-info"><div class="pv-kicker">Avatar çerçevesi</div><h3>${esc(f.label)} ${tierBadge(it.tier, it.price)}</h3><p>Çerçeve avatarının çevresinde profilinde, mesajlarda ve üst çubukta görünür.</p></div>
                <div class="pv-actions">${act}<button class="pv-btn pv-btn-ghost" data-a="close">Kapat</button></div>`);
            ov.querySelector('[data-a="close"]').onclick = closeSheet;
            const eq = ov.querySelector('[data-a="equip"]');
            if (eq) eq.onclick = async () => {
                eq.disabled = true;
                const r = await fetch('/api/me/cosmetics/equip', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ item_key: f.key }) });
                const d = await r.json().catch(() => null);
                if (d && d.success && typeof currentUser !== 'undefined' && currentUser) { currentUser.avatar_frame = d.avatar_frame; if (typeof renderProfile === 'function') renderProfile(); }
                closeSheet(); refresh();
            };
            return;
        }
        if (it.cat === 'atmo') {
            const a = it.data;
            const act = a.active ? '<button class="pv-btn pv-btn-ghost" disabled>Kullanılıyor ✓</button>' : a.available ? '<button class="pv-btn" data-a="use">Kullan</button>' : a.tier === 'coin' ? `<button class="pv-btn pv-btn-ghost" disabled>🪙 ${esc(a.price_coins)} · Yakında</button>` : `<button class="pv-btn pv-btn-up" data-a="up">${upLabel}</button>`;
            const ov = sheetShell(`<div class="pv-stage"><div class="st-atmo st-atmo-big" style="background:${a.art}"><span aria-hidden="true">${a.emoji}</span></div></div>
                <div class="pv-info"><div class="pv-kicker">Atmosphere paketi</div><h3>${esc(a.label)} ${tierBadge(it.tier, it.price)}</h3><p>${esc(a.desc || '')}</p></div>
                <div class="pv-actions">${act}${a.sound ? '<button class="pv-btn pv-btn-ghost" data-a="snd">▶ Sesi dinle</button>' : ''}<button class="pv-btn pv-btn-ghost" data-a="close">Kapat</button></div>`);
            ov.querySelector('[data-a="close"]').onclick = closeSheet;
            ov.querySelector('[data-a="use"]')?.addEventListener('click', async () => { closeSheet(); if (typeof applyAtmosphereKey === 'function') await applyAtmosphereKey(a.key); refresh(); });
            ov.querySelector('[data-a="up"]')?.addEventListener('click', () => upgrade(it.tier));
            ov.querySelector('[data-a="snd"]')?.addEventListener('click', () => { if (typeof playAtmoSound === 'function') playAtmoSound(a.sound, 'preview'); });
            return;
        }
        if (it.cat === 'sticker') {
            const act = it.owned ? '<button class="pv-btn pv-btn-ghost" disabled>Sohbette 😊 panelinden kullan</button>' : `<button class="pv-btn pv-btn-up" data-a="up">${upLabel}</button>`;
            const ov = sheetShell(`<div class="pv-stage"><div class="st-stk st-stk-big">${typeof stickerInnerHtml === 'function' ? stickerInnerHtml(it.data.id) : esc(it.data.emoji)}</div></div>
                <div class="pv-info"><div class="pv-kicker">${esc(it.sub)}</div><h3>${esc(it.title)} ${tierBadge(it.tier)}</h3><p>${it.owned ? 'Bu çıkartma hesabında açık.' : 'Bu hareketli çıkartma abonelikle açılır.'}</p></div>
                <div class="pv-actions">${act}<button class="pv-btn pv-btn-ghost" data-a="close">Kapat</button></div>`);
            ov.querySelector('[data-a="close"]').onclick = closeSheet;
            ov.querySelector('[data-a="up"]')?.addEventListener('click', () => upgrade(it.tier));
        }
    }

    function onClick(e) {
        if (e.target.closest('#st-close')) { close(); return; }
        const cat = e.target.closest('[data-st-cat]');
        if (cat) { state.cat = cat.dataset.stCat; renderGrid(); return; }
        if (e.target.closest('[data-st-subs]')) { close(); document.getElementById('subs-open-btn')?.click(); return; }
        const card = e.target.closest('[data-st-i]');
        if (card) openItem(state.items[Number(card.dataset.stI)]);
    }
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && $('store-screen') && $('store-screen').style.display !== 'none' && !($('pv-overlay') && $('pv-overlay').style.display === 'flex')) close(); });

    // "Sauran Market" menü düğmesi artık mağaza ana sayfasını açar (eski küçük pencere yerine).
    document.addEventListener('click', (e) => {
        const b = e.target.closest && e.target.closest('#market-open-btn');
        if (!b) return;
        e.preventDefault(); e.stopImmediatePropagation();
        if (typeof closeTopbarDropdown === 'function') closeTopbarDropdown();
        open();
    }, true);
})();
