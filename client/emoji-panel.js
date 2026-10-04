/* Birleşik emoji paneli (Discord tarzı): Emoji / GIF'ler / Çıkartmalar sekmeleri, arama, sık kullanılanlar, kişisel emojiler,
   lobi emojileri (diğer lobilerinki Premium'a açık; değilse asma kilitli), standart emojiler ve alta bölüme atlama çubuğu.
   Ayrıca Özelleştirme Merkezi'ndeki "Emojilerim" yönetim kartı. script.js'ten SONRA yüklenir; kullandığı küresel yardımcılar:
   currentUser, currentHub, userHasFeature, showToast, escapeHtml, escapeAttr, readFileAsDataUrl, stickerInnerHtml, STICKERS,
   PLUS_STICKERS, PREMIUM_STICKERS, stickerPickHandlers (script.js). */
(function () {
    'use strict';

    const RECENT_KEY = 'sauran_emoji_recent';
    const UNICODE = ['😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '😉', '😍', '🥰', '😘', '😋', '😎', '🤩', '🥳', '😏', '😒', '😞', '😔', '😢', '😭', '😤', '😡', '🤯', '😳', '🥺', '😱', '🤔', '🤗', '🤫', '🙄', '😴', '🤮', '🤒', '👍', '👎', '👏', '🙏', '💪', '👌', '✌️', '🤝', '🔥', '💯', '❤️', '💔', '💖', '✨', '🎉', '🎮', '🏆', '⭐', '🌈', '🍕', '☕', '🎂'];

    let panel = null;
    const state = { prefix: 'hub', tab: 'emoji', data: null, query: '' };

    const el = (id) => document.getElementById(id);
    const esc = (s) => (typeof escapeHtml === 'function' ? escapeHtml(s) : String(s));
    const escA = (s) => (typeof escapeAttr === 'function' ? escapeAttr(s) : String(s));

    function recent() { try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); } catch (_) { return []; } }
    function pushRecent(item) {
        try {
            const key = (r) => r.k + ':' + (r.name || r.ch);
            const list = [item, ...recent().filter((r) => key(r) !== key(item))].slice(0, 24);
            localStorage.setItem(RECENT_KEY, JSON.stringify(list));
        } catch (_) { /* depolama yok */ }
    }

    async function loadStickers() {
        const hubId = state.prefix === 'hub' && typeof currentHub !== 'undefined' && currentHub ? currentHub.id : '';
        try {
            const d = await (await fetch('/api/me/stickers' + (hubId ? `?hub_id=${hubId}` : ''), { credentials: 'include' })).json();
            state.stk = d.success ? d : { permissions: {}, mine: [], hub: [] };
        } catch (_) { state.stk = { permissions: {}, mine: [], hub: [] }; }
    }

    async function loadData() {
        loadStickers().then(() => { if (state.tab === 'stickers') renderBody(true); });
        const hubId = state.prefix === 'hub' && typeof currentHub !== 'undefined' && currentHub ? currentHub.id : '';
        try {
            const r = await fetch('/api/me/emojis' + (hubId ? `?hub_id=${hubId}` : ''), { credentials: 'include' });
            const d = await r.json();
            state.data = d.success ? d : { permissions: {}, personal: [], lobbies: [], mine: [] };
        } catch (_) { state.data = { permissions: {}, personal: [], lobbies: [], mine: [] }; }
    }

    function build() {
        if (panel) return;
        panel = document.createElement('div');
        panel.id = 'emoji-panel';
        panel.className = 'emoji-panel liquid-glass';
        panel.style.display = 'none';
        panel.setAttribute('role', 'dialog');
        panel.setAttribute('aria-label', 'Emoji, GIF ve çıkartmalar');
        panel.innerHTML = `
            <div class="ep-handle" aria-hidden="true"></div>
            <div class="ep-tabs" role="tablist">
                <button type="button" role="tab" data-ep-tab="emoji">Emoji</button>
                <button type="button" role="tab" data-ep-tab="gif">GIF'ler</button>
                <button type="button" role="tab" data-ep-tab="stickers">Çıkartmalar</button>
            </div>
            <div class="ep-search"><span aria-hidden="true">🔍</span><input id="ep-search-input" type="search" placeholder="Mükemmel emojiyi bul" autocomplete="off"></div>
            <div class="ep-body" id="ep-body"></div>
            <div class="ep-jump" id="ep-jump"></div>`;
        document.body.appendChild(panel);

        panel.addEventListener('click', onPanelClick);
        panel.querySelector('#ep-search-input').addEventListener('input', (e) => {
            state.query = e.target.value.trim().toLowerCase();
            if (state.tab === 'gif') { clearTimeout(gif.timer); gif.timer = setTimeout(loadGifs, 400); return; }
            renderBody();
        });
        document.addEventListener('click', (e) => {
            if (panel.style.display === 'none') return;
            if (e.target.closest('#emoji-panel, .composer-emoji-btn, .composer-attach-wrap')) return;
            closePanel();
        });
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && panel.style.display !== 'none') closePanel(); });
        window.addEventListener('resize', () => { if (panel.style.display !== 'none') position(); });
    }

    function position() {
        const input = el(state.prefix + '-message-input');
        const form = input && input.closest('form');
        const mobile = window.innerWidth <= 720;
        panel.classList.toggle('ep-sheet', mobile);
        if (mobile || !form) { panel.style.left = ''; panel.style.bottom = ''; return; }
        const r = form.getBoundingClientRect();
        panel.style.left = Math.max(8, Math.min(r.left, window.innerWidth - 392)) + 'px';
        panel.style.bottom = (window.innerHeight - r.top + 8) + 'px';
    }

    async function openPanel(prefix, tab) {
        build();
        if (panel.style.display !== 'none' && state.prefix === prefix && (!tab || state.tab === tab)) { closePanel(); return; }
        state.prefix = prefix;
        if (tab) state.tab = tab;
        state.query = '';
        panel.querySelector('#ep-search-input').value = '';
        panel.style.display = 'flex';
        position();
        renderBody();
        await loadData();
        renderBody();
    }
    function closePanel() { if (panel) panel.style.display = 'none'; }

    function sectionHtml(id, title, inner, extra) {
        return `<section class="ep-sec" id="ep-sec-${id}"><h4>${title}${extra || ''}</h4><div class="ep-grid">${inner}</div></section>`;
    }
    function customItem(e, locked) {
        return `<button type="button" class="ep-item${locked ? ' ep-locked' : ''}" data-ins=":${escA(e.name)}:" data-name="${escA(e.name)}" data-url="${escA(e.url)}" ${locked ? 'data-locked="1"' : ''} title=":${escA(e.name)}:"><img src="${escA(e.url)}" alt=":${escA(e.name)}:" loading="lazy" decoding="async">${locked ? '<i class="ep-lock" aria-hidden="true">🔒</i>' : ''}</button>`;
    }

    function renderEmojiTab() {
        const d = state.data || { permissions: {}, personal: [], lobbies: [] };
        const q = state.query;
        const match = (e) => !q || e.name.toLowerCase().includes(q);
        const secs = [], jumps = [];
        // Sık kullanılanlarda yalnızca şu an kullanılabilir özel emojiler (kişisel + kilitsiz lobi) gösterilir.
        const usable = new Set([...(d.personal || []).map((e) => e.url), ...(d.lobbies || []).filter((l) => !l.locked).flatMap((l) => l.emojis.map((e) => e.url))]);
        const rec = recent().filter((r) => (r.k === 'x' || (r.k === 'c' && r.url && (!state.data || usable.has(r.url)))) && (!q || (r.name || '').includes(q)));
        if (rec.length) {
            secs.push(sectionHtml('recent', 'Sık kullanılan', rec.map((r) => r.k === 'x'
                ? `<button type="button" class="ep-item ep-uni" data-ins="${escA(r.ch)}">${esc(r.ch)}</button>`
                : customItem({ name: r.name, url: r.url }, false)).join('')));
            jumps.push(['recent', '🕘']);
        }
        const perms = d.permissions || {};
        if (perms.personal) {
            const mine = (d.personal || []).filter(match);
            const add = !q ? '<button type="button" class="ep-item ep-add" data-ep-add="1" title="Yeni emoji ekle">＋</button>' : '';
            if (mine.length || add) { secs.push(sectionHtml('mine', 'Emojilerim', mine.map((e) => customItem(e, false)).join('') + add, `<small>${(d.personal || []).length} / ${perms.limit}</small>`)); jumps.push(['mine', '👤']); }
        } else if (!q) {
            secs.push(`<section class="ep-sec" id="ep-sec-mine"><h4>Emojilerim</h4><p class="ep-note">Kendi emojini oluşturmak <b>Sauran Plus</b>'a özel. <button type="button" class="ep-link" data-ep-add="1">Ayrıntılar</button></p></section>`);
            jumps.push(['mine', '👤']);
        }
        (d.lobbies || []).forEach((l) => {
            const items = l.emojis.filter(match);
            if (!items.length) return;
            secs.push(sectionHtml('hub' + l.hub_id, esc(l.name) + (l.current ? ' <small>bu lobi</small>' : ''), items.map((e) => customItem(e, l.locked)).join(''), l.locked ? '<small class="ep-prem">🔒 Premium</small>' : ''));
            jumps.push(['hub' + l.hub_id, esc((l.name || '?').charAt(0).toUpperCase())]);
        });
        if (!q) { secs.push(sectionHtml('std', 'Standart', UNICODE.map((c) => `<button type="button" class="ep-item ep-uni" data-ins="${escA(c)}">${esc(c)}</button>`).join(''))); jumps.push(['std', '😀']); }
        if (!secs.length || (q && !secs.some((s) => s.includes('ep-item')))) secs.push('<p class="ep-note ep-empty">Sonuç yok.</p>');
        return { html: secs.join(''), jumps };
    }

    function renderStickerTab() {
        const lock = '<i class="ep-lock" aria-hidden="true">🔒</i>';
        const btn = (s, ok) => `<button type="button" class="ep-item ep-stk${ok ? '' : ' ep-locked'}" data-sticker="${escA(s.id)}" ${ok ? '' : 'data-locked="1"'}><span class="ep-stk-in">${typeof stickerInnerHtml === 'function' ? stickerInnerHtml(s.id) : esc(s.emoji)}</span>${ok ? '' : lock}</button>`;
        const plusOk = typeof userHasFeature === 'function' && userHasFeature('sticker_pack');
        const premOk = typeof userHasFeature === 'function' && userHasFeature('premium_sticker_pack');
        const q = state.query;
        const f = (list) => list.filter((s) => !q || s.id.includes(q));
        const stk = state.stk || { permissions: {}, mine: [], hub: [] };
        const custom = (list, locked) => list.filter((c) => !q || c.name.includes(q)).map((c) => `<button type="button" class="ep-item ep-stk${locked ? ' ep-locked' : ''}" ${locked ? 'data-locked="1" data-xlobby="1"' : ''} data-sticker="${escA(c.sid)}" title="${escA(c.name)}"><span class="ep-stk-in"><img src="${escA(c.url)}" alt="" loading="lazy" decoding="async"></span>${locked ? '<i class="ep-lock" aria-hidden="true">🔒</i>' : ''}</button>`).join('');
        const addBtn = !q && stk.permissions && stk.permissions.personal ? '<button type="button" class="ep-item ep-add" data-ep-add="stk" title="Yeni çıkartma ekle">＋</button>' : '';
        const mineInner = custom(stk.mine || []) + addBtn;
        const lockedNote = !q && !(stk.permissions && stk.permissions.personal) ? '<p class="ep-note">Kendi çıkartmanı oluşturmak <b>Sauran Plus</b>\'a özel. <button type="button" class="ep-link" data-ep-add="stk">Ayrıntılar</button></p>' : '';
        const secs = [
            ...(mineInner || lockedNote ? [['mine', '👤 Çıkartmalarım', mineInner, lockedNote]] : []),
            ...(stk.lobbies || []).filter((l) => custom(l.stickers)).map((l) => ['hub' + l.hub_id, (l.current ? '🏠 ' : '🌐 ') + l.name + (l.current ? ' · bu lobi' : '') + (l.locked ? ' · 🔒 Premium' : ''), custom(l.stickers, l.locked)]),
            ['std', 'Klasik', f(STICKERS).map((s) => btn(s, true)).join('')],
            ['plus', '✦ Plus', f(PLUS_STICKERS).map((s) => btn(s, plusOk)).join('')],
            ['prem', '♛ Premium', f(PREMIUM_STICKERS).map((s) => btn(s, premOk)).join('')]
        ].filter((s) => s[2] || s[3]);
        return { html: secs.map(([id, t, inner, note]) => (note ? `<section class="ep-sec" id="ep-sec-${id}"><h4>${t}</h4>${note}</section>` : sectionHtml(id, t, inner))).join('') || '<p class="ep-note ep-empty">Sonuç yok.</p>', jumps: secs.map(([id, t]) => [id, id === 'mine' ? '👤' : id.startsWith('hub') ? esc((t.replace(/^[^ ]+ /, '').charAt(0) || '?').toUpperCase()) : t.slice(0, 1) === '✦' ? '✦' : t.slice(0, 1) === '♛' ? '♛' : '🧸']) };
    }

    // ── GIF sekmesi (GIPHY, sunucu aracılığıyla) ──
    const gif = { items: [], enabled: null, loading: false, q: '', timer: null, error: '' };
    function renderGifTab() {
        if (gif.enabled === false) return { html: `<div class="ep-gif-soon"><div class="ep-gif-ic">🎞️</div><h4>GIF'ler yakında</h4><p>GIF araması henüz etkin değil.</p></div>`, jumps: [] };
        const grid = gif.items.map((g) => `<button type="button" class="ep-gif" data-gif="${escA(g.url)}" style="aspect-ratio:${g.w}/${g.h}"><img src="${escA(g.preview)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer"></button>`).join('');
        const msg = gif.loading ? '<p class="ep-note ep-empty">Yükleniyor…</p>' : gif.error ? `<p class="ep-note ep-empty">${esc(gif.error)}</p>` : (!gif.items.length && gif.enabled ? '<p class="ep-note ep-empty">Sonuç yok.</p>' : '');
        return { html: `<div class="ep-gif-grid">${grid}</div>${msg}`, jumps: [] };
    }
    async function loadGifs() {
        gif.loading = true; gif.error = ''; renderBodyKeep();
        try {
            const r = await fetch('/api/gifs?q=' + encodeURIComponent(state.query), { credentials: 'include' });
            const d = await r.json();
            gif.enabled = d.enabled !== false;
            gif.items = d.items || [];
            gif.error = d.error || '';
        } catch (_) { gif.items = []; gif.error = 'GIF servisine ulaşılamadı.'; }
        gif.loading = false; renderBodyKeep();
    }
    function renderBodyKeep() { if (state.tab === 'gif') renderBody(true); }

    function renderBody(keepSearch) {
        if (!panel) return;
        panel.querySelectorAll('[data-ep-tab]').forEach((b) => { const on = b.dataset.epTab === state.tab; b.classList.toggle('on', on); b.setAttribute('aria-selected', on ? 'true' : 'false'); });
        const search = panel.querySelector('.ep-search');
        const input = panel.querySelector('#ep-search-input');
        search.style.display = state.tab === 'gif' && gif.enabled === false ? 'none' : '';
        input.placeholder = state.tab === 'gif' ? "GIPHY'de GIF ara" : state.tab === 'stickers' ? 'Mükemmel çıkartmayı bul' : 'Mükemmel emojiyi bul';
        let out;
        if (state.tab === 'gif') {
            out = renderGifTab();
        } else if (state.tab === 'stickers') out = renderStickerTab();
        else out = renderEmojiTab();
        const body = el('ep-body');
        body.innerHTML = out.html;
        if (!keepSearch) body.scrollTop = 0;
        const jump = el('ep-jump');
        const gifOn = state.tab === 'gif' && gif.enabled !== false;
        jump.classList.toggle('ep-attr-bar', gifOn);
        // GIF sekmesinde alt çubuk, kaydırmadan bağımsız her zaman görünen GIPHY atfıdır.
        jump.innerHTML = gifOn ? '<span class="ep-gif-attr">Powered by GIPHY</span>' : out.jumps.map(([id, label]) => `<button type="button" data-ep-jump="${id}">${label}</button>`).join('');
    }

    function insertText(text) {
        const input = el(state.prefix + '-message-input');
        if (!input) return;
        const a = input.selectionStart != null ? input.selectionStart : input.value.length;
        const b = input.selectionEnd != null ? input.selectionEnd : a;
        input.value = input.value.slice(0, a) + text + input.value.slice(b);
        input.focus();
        const p = a + text.length;
        input.setSelectionRange(p, p);
    }

    // GIF, adresi tek başına metin mesajı olarak gönderilir (mevcut gönderim akışı + sunucu doğrulaması aynen kullanılır).
    function sendGif(url) {
        const input = el(state.prefix + '-message-input');
        const form = input && input.closest('form');
        if (!input || !form) return;
        const draft = input.value;
        input.value = url;
        closePanel();
        form.requestSubmit();
        setTimeout(() => { if (input.value === url) input.value = draft; else if (!input.value) input.value = draft; }, 50);
    }

    function onPanelClick(e) {
        const tab = e.target.closest('[data-ep-tab]');
        if (tab) {
            state.tab = tab.dataset.epTab; state.query = ''; panel.querySelector('#ep-search-input').value = ''; renderBody();
            if (state.tab === 'gif') loadGifs();
            return;
        }
        const g = e.target.closest('[data-gif]');
        if (g) { sendGif(g.dataset.gif); return; }
        const jump = e.target.closest('[data-ep-jump]');
        if (jump) { const sec = el('ep-sec-' + jump.dataset.epJump); const body = el('ep-body'); if (sec) body.scrollTo({ top: sec.offsetTop - body.offsetTop - 4, behavior: 'smooth' }); return; }
        const addBtn = e.target.closest('[data-ep-add]');
        if (addBtn) {
            const stkTarget = addBtn.dataset.epAdd === 'stk';
            closePanel();
            const perms = stkTarget ? (state.stk && state.stk.permissions) : (state.data && state.data.permissions);
            if (!(perms && perms.personal)) { showToast(stkTarget ? 'Kendi çıkartmanı oluşturmak Sauran Plus abonelerine açıktır.' : 'Kendi emojini oluşturmak Sauran Plus abonelerine açıktır.'); }
            if (typeof openCustomizeCenter === 'function') { openCustomizeCenter('look'); setTimeout(() => { el(stkTarget ? 'cz-sticker-card' : 'cz-emoji-card')?.scrollIntoView({ block: 'start' }); }, 1000); }
            return;
        }
        const stk = e.target.closest('[data-sticker]');
        if (stk) {
            if (stk.dataset.locked) { showToast(stk.dataset.xlobby ? 'Başka lobilerin çıkartmalarını kullanmak Sauran Premium abonelerine açıktır.' : stk.dataset.sticker.startsWith('prem-') ? 'Premium çıkartmalar Sauran Premium abonelerine açıktır.' : 'Hareketli çıkartmalar Sauran Plus abonelerine açıktır.'); return; }
            const handler = window.stickerPickHandlers && window.stickerPickHandlers[state.prefix];
            if (handler) { closePanel(); handler(stk.dataset.sticker); }
            return;
        }
        const item = e.target.closest('[data-ins]');
        if (!item) return;
        if (item.dataset.locked) { showToast('Başka lobilerin emojilerini kullanmak Sauran Premium abonelerine açıktır.'); return; }
        insertText(item.dataset.ins + (item.classList.contains('ep-uni') ? '' : ' '));
        if (item.classList.contains('ep-uni')) pushRecent({ k: 'x', ch: item.dataset.ins });
        else pushRecent({ k: 'c', name: item.dataset.name, url: item.dataset.url });
    }

    // Composer düğmeleri
    ['hub', 'dm'].forEach((prefix) => {
        document.getElementById(prefix + '-emoji-btn')?.addEventListener('click', (e) => { e.stopPropagation(); openPanel(prefix, 'emoji'); });
    });
    window.openEmojiPanel = openPanel;

    // ── Emoji yükleme: istemci önce büyük statik görselleri küçültür (yükleme hafiflesin); asıl sıkıştırma sunucuda ──
    window.prepareEmojiUpload = function (file, maxSide) {
        return new Promise((resolve, reject) => {
            if (!file) { reject(new Error('Dosya seçilmedi.')); return; }
            if (file.size > 5 * 1024 * 1024) { reject(new Error('Dosya çok büyük (en fazla 5 MB).')); return; }
            if (file.type === 'image/gif' || file.type === 'image/webp') { readFileAsDataUrl(file).then(resolve, reject); return; } // hareketli olabilir: sunucu karar verir
            const img = new Image();
            const url = URL.createObjectURL(file);
            img.onload = () => {
                const max = maxSide || 256, ratio = Math.min(1, max / Math.max(img.width, img.height));
                const c = document.createElement('canvas');
                c.width = Math.max(1, Math.round(img.width * ratio)); c.height = Math.max(1, Math.round(img.height * ratio));
                c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
                URL.revokeObjectURL(url);
                let out = c.toDataURL('image/webp', 0.9);
                if (!out.startsWith('data:image/webp')) out = c.toDataURL('image/png');
                resolve(out);
            };
            img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Görsel okunamadı.')); };
            img.src = url;
        });
    };
    const kb = (n) => (n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB');
    window.emojiUploadSummary = (d) => `${d.original_bytes ? kb(d.original_bytes) + ' → ' : ''}${kb(d.bytes || 0)}`;

    // ── Özelleştirme Merkezi: "Emojilerim" ──
    window.renderPersonalEmojiCard = async function () {
        const box = el('cz-emoji-card');
        if (!box) return;
        let d;
        try { d = await (await fetch('/api/me/emojis', { credentials: 'include' })).json(); } catch (_) { return; }
        if (!d || !d.success) return;
        const p = d.permissions || {};
        const premiumBadge = '<span class="subs-premium-badge" style="margin-left:6px;">♛ PREMIUM</span>';
        if (!p.personal) {
            box.innerHTML = `<div class="cz-card-title">Emojilerim <span class="plus-badge plus-badge-sm" style="margin-left:6px;">✦ PLUS</span></div>
                <p class="hubset-hint">Kendi emojilerini oluştur (herhangi bir fotoğraf; otomatik küçültülür) ve sohbette <b>:isim:</b> ile kullan. Plus: 10 statik emoji. Premium: 30 emoji + hareketli (GIF) + diğer lobilerin emojilerini kullanma.</p>`;
            return;
        }
        const list = d.mine || [];
        box.innerHTML = `<div class="cz-card-title">Emojilerim <small class="ep-count">${list.length} / ${p.limit}</small></div>
            <div class="hub-emoji-grid">${list.map((e) => `<span class="hub-emoji-item"><img src="${escA(e.url)}" alt=""><span class="ep-meta"><b>:${esc(e.name)}:</b><small>${e.animated ? '🎞️ hareketli · ' : ''}${kb(e.bytes || 0)}</small></span><button type="button" data-pemoji-del="${e.id}" aria-label="Sil">✕</button></span>`).join('') || '<span class="hubset-hint">Henüz emojin yok.</span>'}</div>
            <div class="hub-bg-row" style="margin-top:10px;">
                <input id="cz-emoji-name" class="hub-name-input" type="text" maxlength="20" placeholder="isim (a-z, 0-9, _)" autocomplete="off" style="max-width:180px;">
                <button id="cz-emoji-pick" class="hub-create-image-btn" type="button">Görsel${p.animated ? ' / GIF' : ''} Seç</button>
                <input type="file" id="cz-emoji-input" accept="image/png,image/jpeg,image/webp,image/gif,image/avif" hidden>
            </div>
            <p class="hubset-hint">Yüklediğin görsel otomatik <b>128px WebP</b>'ye sıkıştırılır (en fazla 60 KB). ${p.animated ? 'Hareketli GIF/WebP emojiler de sıkıştırılır (en fazla 220 KB).' : `Hareketli (GIF) emoji ${premiumBadge}'a özel; GIF yüklersen ilk kare kullanılır.`}
            ${p.cross ? 'Premium: üyesi olduğun diğer lobilerin emojilerini de kullanabilirsin.' : ''}</p>`;
    };
    document.addEventListener('click', async (e) => {
        if (e.target.closest('#cz-emoji-pick')) {
            if (!/^[a-z0-9_]{2,20}$/.test((el('cz-emoji-name').value || '').trim().toLowerCase())) { showToast('Önce emoji adını yaz (2-20 karakter: a-z, 0-9, _).'); return; }
            el('cz-emoji-input').click(); return;
        }
        const del = e.target.closest('[data-pemoji-del]');
        if (del) {
            const r = await fetch(`/api/me/emojis/${del.dataset.pemojiDel}`, { method: 'DELETE', credentials: 'include' });
            const d = await r.json();
            if (d.success) window.renderPersonalEmojiCard();
        }
    });
    document.addEventListener('change', async (e) => {
        if (e.target.id !== 'cz-emoji-input') return;
        const file = e.target.files && e.target.files[0];
        e.target.value = '';
        if (!file) return;
        const name = el('cz-emoji-name').value.trim().toLowerCase();
        try {
            showToast('Emoji yükleniyor ve sıkıştırılıyor…');
            const image_data = await window.prepareEmojiUpload(file);
            const r = await fetch('/api/me/emojis', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ name, image_data }) });
            const d = await r.json();
            if (!d.success) { showToast(d.error || 'Eklenemedi.'); return; }
            showToast(`:${name}: eklendi (${window.emojiUploadSummary(d)})${d.note ? ' — ' + d.note : ''}`);
            el('cz-emoji-name').value = '';
            window.renderPersonalEmojiCard();
        } catch (err) { showToast(err.message || 'Eklenemedi.'); }
    });

    // ── Çıkartma yönetimi: kişisel (Özelleştirme Merkezi) ve lobi (Lobi Ayarları, Seviye 4) ──
    function stickerGridHtml(list, delAttr) {
        return `<div class="hub-emoji-grid ep-stk-manage">${list.map((e) => `<span class="hub-emoji-item ep-stk-item"><img src="${escA(e.url)}" alt=""><span class="ep-meta"><b>${esc(e.name)}</b><small>${e.animated ? '🎞️ hareketli · ' : ''}${kb(e.bytes || 0)}</small></span><button type="button" ${delAttr}="${e.id}" aria-label="Sil">✕</button></span>`).join('') || '<span class="hubset-hint">Henüz çıkartma yok.</span>'}</div>`;
    }
    window.renderPersonalStickerCard = async function () {
        const box = el('cz-sticker-card');
        if (!box) return;
        let d;
        try { d = await (await fetch('/api/me/stickers', { credentials: 'include' })).json(); } catch (_) { return; }
        if (!d || !d.success) return;
        const p = d.permissions || {};
        if (!p.personal) {
            box.innerHTML = `<div class="cz-card-title">Çıkartmalarım <span class="plus-badge plus-badge-sm" style="margin-left:6px;">✦ PLUS</span></div>
                <p class="hubset-hint">Kendi çıkartmalarını oluştur (herhangi bir fotoğraf; otomatik küçültülür) ve sohbette gönder. Plus: 5 çıkartma. Premium: 15 çıkartma + hareketli (GIF).</p>`;
            return;
        }
        box.innerHTML = `<div class="cz-card-title">Çıkartmalarım <small class="ep-count">${d.mine.length} / ${p.limit}</small></div>
            ${stickerGridHtml(d.mine, 'data-pstk-del')}
            <div class="hub-bg-row" style="margin-top:10px;">
                <input id="cz-stk-name" class="hub-name-input" type="text" maxlength="20" placeholder="isim (a-z, 0-9, _)" autocomplete="off" style="max-width:180px;">
                <button id="cz-stk-pick" class="hub-create-image-btn" type="button">Görsel${p.animated ? ' / GIF' : ''} Seç</button>
                <input type="file" id="cz-stk-input" accept="image/png,image/jpeg,image/webp,image/gif,image/avif" hidden>
            </div>
            <p class="hubset-hint">Yüklediğin görsel otomatik <b>256px WebP</b>'ye sıkıştırılır (en fazla 90 KB). ${p.animated ? 'Hareketli GIF/WebP çıkartmalar da sıkıştırılır (en fazla 300 KB).' : 'Hareketli (GIF) çıkartma <b>Premium</b>\'a özel; GIF yüklersen ilk kare kullanılır.'}</p>`;
    };
    window.renderHubStickerManager = async function () {
        const box = el('hubset-sticker-card');
        if (!box || typeof currentHub === 'undefined' || !currentHub) return;
        if (!currentHub.is_owner) { box.style.display = 'none'; return; }
        box.style.display = '';
        const b = typeof hubBoost === 'function' ? (hubBoost() || { level: 1 }) : { level: 1 };
        if (b.level < 4) { box.innerHTML = `<div class="cz-card-title">Lobi çıkartmaları</div><p class="hubset-hint">🔒 Seviye 4'te açılır (10 takviye). Açılınca lobine 5 özel çıkartma ekleyebilirsin; herkes bu lobide gönderebilir.</p>`; return; }
        let d;
        try { d = await (await fetch(`/api/me/stickers?hub_id=${currentHub.id}`, { credentials: 'include' })).json(); } catch (_) { return; }
        const list = (d && d.hub) || [];
        box.innerHTML = `<div class="cz-card-title">Lobi çıkartmaları <small class="ep-count">${list.length} / 5</small></div>
            ${stickerGridHtml(list, 'data-hstk-del')}
            <div class="hub-bg-row" style="margin-top:10px;">
                <input id="hubset-stk-name" class="hub-name-input" type="text" maxlength="20" placeholder="isim (a-z, 0-9, _)" autocomplete="off" style="max-width:180px;">
                <button id="hubset-stk-pick" class="hub-create-image-btn" type="button">Görsel Seç</button>
                <input type="file" id="hubset-stk-input" accept="image/png,image/jpeg,image/webp,image/gif,image/avif" hidden>
            </div>
            <p class="hubset-hint">Görsel otomatik <b>256px WebP</b>'ye sıkıştırılır. Hareketli (GIF) lobi çıkartması için lobi sahibinin Premium'u gerekir.</p>`;
    };
    async function uploadSticker(url, nameInputId, file, after) {
        const name = el(nameInputId).value.trim().toLowerCase();
        try {
            showToast('Çıkartma yükleniyor ve sıkıştırılıyor…');
            const image_data = await window.prepareEmojiUpload(file, 384);
            const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ name, image_data }) });
            const d = await r.json();
            if (!d.success) { showToast(d.error || 'Eklenemedi.'); return; }
            showToast(`${name} eklendi (${window.emojiUploadSummary(d)})${d.note ? ' — ' + d.note : ''}`);
            el(nameInputId).value = '';
            after();
        } catch (err) { showToast(err.message || 'Eklenemedi.'); }
    }
    const NAME_OK = /^[a-z0-9_]{2,20}$/;
    document.addEventListener('click', async (e) => {
        const pick = e.target.closest('#cz-stk-pick, #hubset-stk-pick');
        if (pick) {
            const nameId = pick.id === 'cz-stk-pick' ? 'cz-stk-name' : 'hubset-stk-name';
            if (!NAME_OK.test((el(nameId).value || '').trim().toLowerCase())) { showToast('Önce çıkartma adını yaz (2-20 karakter: a-z, 0-9, _).'); return; }
            el(pick.id === 'cz-stk-pick' ? 'cz-stk-input' : 'hubset-stk-input').click(); return;
        }
        const pd = e.target.closest('[data-pstk-del]');
        if (pd) { const d = await (await fetch(`/api/me/stickers/${pd.dataset.pstkDel}`, { method: 'DELETE', credentials: 'include' })).json(); if (d.success) window.renderPersonalStickerCard(); return; }
        const hd = e.target.closest('[data-hstk-del]');
        if (hd && typeof currentHub !== 'undefined' && currentHub) {
            const d = await (await fetch(`/api/hubs/${currentHub.id}/stickers/${hd.dataset.hstkDel}`, { method: 'DELETE', credentials: 'include' })).json();
            if (d.success) window.renderHubStickerManager(); else showToast(d.error || 'Silinemedi.');
        }
    });
    document.addEventListener('change', async (e) => {
        if (e.target.id !== 'cz-stk-input' && e.target.id !== 'hubset-stk-input') return;
        const file = e.target.files && e.target.files[0];
        const isHub = e.target.id === 'hubset-stk-input';
        e.target.value = '';
        if (!file) return;
        if (isHub) { if (typeof currentHub === 'undefined' || !currentHub) return; await uploadSticker(`/api/hubs/${currentHub.id}/stickers`, 'hubset-stk-name', file, window.renderHubStickerManager); }
        else await uploadSticker('/api/me/stickers', 'cz-stk-name', file, window.renderPersonalStickerCard);
    });
})();
