// Sauran — Arkadaşlar sayfası (kimlik seçimi 4C: akıllı gruplar). Masaüstünde Ana sayfanın ortası; telefonda "Arkadaşlar" sekmesi.
// Sekme yok; tek sayfada gruplar: Şimdi aktif · En çok konuştukların · İstekler · Diğer arkadaşlar · Engellenenler.
// Her grubun başlığındaki ▲/▼ düğmesi listeyi tamamen kapatır / açar; durum tarayıcıda hatırlanır.
// Veri mevcut uçlardan: arkadaşlar script.js'in önbelleğinden (window.__friendsCache, 'friends-updated' olayı),
// istekler /api/friends/requests, engellenenler /api/users/blocked, en çok konuşulanlar /api/friends/top.
// Eylemler mevcut işlevlere devredilir: openDm, DM arama düğmesi, openOtherProfile, loadFriendsSidebar.
// layout-c.js'ten SONRA yüklenir; body.lc yoksa (eski yerleşim) hiçbir şey yapmaz.
(function () {
    'use strict';
    const body = document.body;
    if (!body.classList.contains('lc')) return;
    const $ = (id) => document.getElementById(id);
    const tr = (key, fallback) => { try { const v = t(key); return v && v !== key ? v : fallback; } catch (_) { return fallback; } };
    const esc = (s) => (typeof escapeHtml === 'function' ? escapeHtml(s) : String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])));
    const desk = window.matchMedia('(min-width: 901px) and (min-height: 501px)');
    const ICON = {
        people: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c1-3.5 3.5-5 6.5-5s5.5 1.5 6.5 5M16 4.5a3.5 3.5 0 0 1 0 7M18 15c2 .6 3.2 2.2 3.8 5"/></svg>',
        chat: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v11H9l-5 4z"/></svg>',
        call: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/></svg>',
        more: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="5" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="12" cy="19" r="1.6"/></svg>',
        ok: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
        no: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
        add: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10" cy="8" r="4"/><path d="M2 20c1.5-4 4.5-5.5 8-5.5S16.5 16 18 20M19 8v6M16 11h6"/></svg>',
        search: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/></svg>',
        fold: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 15l6-6 6 6"/></svg>'
    };

    const page = document.createElement('section');
    page.id = 'lc-friends';
    page.className = 'lc-friends';
    page.hidden = true;
    page.setAttribute('aria-labelledby', 'lcf-title');
    page.innerHTML = `
        <header class="lcf-head">
            <h2 class="lcf-title" id="lcf-title">${ICON.people}<span>${esc(tr('lcf-your-friends', 'Arkadaşların'))}</span><b class="lcf-badge" id="lcf-pending-n" hidden></b></h2>
            <button type="button" class="lcf-add" id="lcf-add" data-lcf-add>${ICON.add}<span>${esc(tr('menu-add-friend', 'Arkadaş ekle'))}</span></button>
        </header>
        <div class="lcf-body">
            <div class="lcf-tools">
                <label class="lcf-search">${ICON.search}<input id="lcf-q" type="search" autocomplete="off" placeholder="${esc(tr('lcf-search', 'Arkadaşlarında ara'))}"></label>
                <button type="button" class="lcf-add lcf-add-m" data-lcf-add aria-label="${esc(tr('menu-add-friend', 'Arkadaş ekle'))}">${ICON.add}</button>
            </div>
            <div class="lcf-groups" id="lcf-groups"></div>
        </div>`;
    const chatArea = document.querySelector('#chat-screen .chat-area');
    if (!chatArea) return;
    chatArea.insertBefore(page, chatArea.firstChild);

    let requests = [];
    let blocked = [];
    let topIds = [];
    let loaded = false;

    // Kapalı grupların hatırlanması (yalnızca bu tarayıcıda). Engellenenler varsayılan olarak kapalı.
    const FOLD_KEY = 'sauran.lcf.fold';
    let folded = { blocked: true };
    try { folded = { ...folded, ...(JSON.parse(localStorage.getItem(FOLD_KEY) || '{}') || {}) }; } catch (_) { /* varsayılan */ }
    const saveFold = () => { try { localStorage.setItem(FOLD_KEY, JSON.stringify(folded)); } catch (_) { /* yoksay */ } };

    const friends = () => (Array.isArray(window.__friendsCache) ? window.__friendsCache : []);
    const avatar = (u) => {
        if (typeof avatarButtonHtml === 'function') return avatarButtonHtml(u.id, u.avatar_data, u.username, u.avatar_frame, u.profile_color);
        return `<span class="lcf-av-fallback">${esc(String(u.username || '?').charAt(0).toUpperCase())}</span>`;
    };
    const activityText = (f) => {
        if (f.voice) return `${tr('lcf-in-voice', 'Seste')} · ${f.voice.hub_name} › ${f.voice.room_name}`;
        const a = f.activity;
        if (a && typeof a === 'object' && a.text) return a.text;
        if (typeof a === 'string' && a) return a;
        return f.online ? tr('online-status', 'Çevrimiçi') : tr('offline-status', 'Çevrimdışı');
    };

    async function loadExtras() {
        try {
            const [r, b, tp] = await Promise.all([
                fetch('/api/friends/requests', { credentials: 'include' }).then((x) => x.json()),
                fetch('/api/users/blocked', { credentials: 'include' }).then((x) => x.json()),
                fetch('/api/friends/top?limit=5', { credentials: 'include' }).then((x) => x.json()).catch(() => null)
            ]);
            requests = r && r.success && Array.isArray(r.requests) ? r.requests : [];
            blocked = b && b.success && Array.isArray(b.blocked) ? b.blocked : [];
            topIds = tp && tp.success && Array.isArray(tp.friends) ? tp.friends.map((f) => Number(f.id)) : [];
        } catch (_) { /* liste boş görünür */ }
        loaded = true;
        render();
    }

    function friendRow(u, kind) {
        if (kind === 'pending') {
            const id = Number(u.user_id);
            return `<div class="lcf-row" role="listitem" data-uid="${id}" data-kind="pending">
                <span class="lcf-av">${avatar({ id, username: u.username, avatar_data: u.avatar_data })}</span>
                <span class="lcf-txt"><b>${esc(u.username)}</b><span>${esc(tr('lcf-wants', 'Arkadaşlık isteği gönderdi'))}</span></span>
                <span class="lcf-acts">
                    <button type="button" class="lcf-act lcf-text ok" data-act="accept">${esc(tr('accept', 'Kabul et'))}</button>
                    <button type="button" class="lcf-act lcf-text no" data-act="reject">${esc(tr('reject', 'Reddet'))}</button>
                </span></div>`;
        }
        if (kind === 'blocked') {
            return `<div class="lcf-row" role="listitem" data-uid="${Number(u.id)}" data-kind="blocked">
                <span class="lcf-av">${avatar(u)}</span>
                <span class="lcf-txt"><b>${esc(u.username)}</b><span>${esc(tr('lcf-is-blocked', 'Engellendi'))}</span></span>
                <span class="lcf-acts"><button type="button" class="lcf-act lcf-text" data-act="unblock">${esc(tr('lcf-unblock', 'Engeli kaldır'))}</button></span></div>`;
        }
        const v = u.voice;
        const join = v ? `<button type="button" class="lcf-act lcf-text lcf-join" data-act="join" data-hub="${Number(v.hub_id)}" data-room="${Number(v.room_id)}" data-room-name="${esc(v.room_name)}" title="${esc(tr('lcf-join-title', 'Odaya katıl'))}">${esc(tr('lcf-join', 'Katıl'))}</button>` : '';
        return `<div class="lcf-row${u.online ? ' is-on' : ''}${v ? ' is-voice' : ''}" role="listitem" data-uid="${Number(u.id)}" data-name="${esc(u.username)}" data-kind="friend">
            <span class="lcf-av">${avatar(u)}<i class="lcf-st" aria-hidden="true"></i></span>
            <span class="lcf-txt"><b>${esc(u.username)}</b><span>${esc(activityText(u))}</span></span>
            <span class="lcf-acts">${join}
                <button type="button" class="lcf-act" data-act="dm" title="${esc(tr('lcf-message', 'Mesaj gönder'))}" aria-label="${esc(tr('lcf-message', 'Mesaj gönder'))}">${ICON.chat}</button>
                <button type="button" class="lcf-act" data-act="call" title="${esc(tr('lcf-call', 'Sesli ara'))}" aria-label="${esc(tr('lcf-call', 'Sesli ara'))}">${ICON.call}</button>
                <button type="button" class="lcf-act" data-act="profile" title="${esc(tr('lcf-profile', 'Profili gör'))}" aria-label="${esc(tr('lcf-profile', 'Profili gör'))}">${ICON.more}</button>
            </span></div>`;
    }

    function render() {
        if (page.hidden) return;
        const n = requests.length;
        const badge = $('lcf-pending-n');
        badge.hidden = n === 0;
        badge.textContent = String(n);
        const box = $('lcf-groups');
        const all = friends();
        if (!loaded && !all.length) { box.innerHTML = `<div class="lcf-empty">${esc(tr('loading', 'Yükleniyor…'))}</div>`; return; }

        const q = ($('lcf-q').value || '').trim().toLocaleLowerCase('tr');
        const match = (u) => !q || String(u.username || '').toLocaleLowerCase('tr').includes(q);
        const byName = (a, b) => String(a.username).localeCompare(String(b.username), 'tr');
        const active = all.filter((f) => f.online).sort(byName);
        const activeIds = new Set(active.map((f) => Number(f.id)));
        const top = topIds.map((id) => all.find((f) => Number(f.id) === id)).filter((f) => f && !activeIds.has(Number(f.id)));
        const topSet = new Set(top.map((f) => Number(f.id)));
        const others = all.filter((f) => !activeIds.has(Number(f.id)) && !topSet.has(Number(f.id))).sort(byName);

        const groups = [
            { key: 'active', title: tr('lcf-g-active', 'Şimdi aktif'), rows: active, kind: 'friend', tone: 'on' },
            { key: 'top', title: tr('lcf-g-top', 'En çok konuştukların'), rows: top, kind: 'friend' },
            { key: 'pending', title: tr('lcf-g-pending', 'İstekler'), rows: requests.map((r) => ({ ...r, username: r.username })), kind: 'pending', tone: 'warn' },
            { key: 'others', title: tr('lcf-g-others', 'Diğer arkadaşların'), rows: others, kind: 'friend' },
            { key: 'blocked', title: tr('lcf-g-blocked', 'Engellediklerin'), rows: blocked, kind: 'blocked', tone: 'muted' }
        ];
        const html = groups.map((g) => {
            const rows = g.rows.filter(match);
            if (!rows.length) return '';
            const open = q ? true : !folded[g.key]; // ararken tüm eşleşmeler görünür
            return `<section class="lcf-group${g.tone ? ' tone-' + g.tone : ''}" data-group="${g.key}">
                <button type="button" class="lcf-group-head" data-fold="${g.key}" aria-expanded="${open}" aria-controls="lcf-g-${g.key}">
                    <span class="lcf-group-title">${esc(g.title)}</span><span class="lcf-group-n">${rows.length}</span>
                    <span class="lcf-fold" aria-hidden="true">${ICON.fold}</span>
                    <span class="lcf-visually-hidden">${esc(open ? tr('lcf-collapse', 'Listeyi kapat') : tr('lcf-expand', 'Listeyi aç'))}</span>
                </button>
                <div class="lcf-list" id="lcf-g-${g.key}" role="list"${open ? '' : ' hidden'}>${rows.map((u) => friendRow(u, g.kind)).join('')}</div>
            </section>`;
        }).join('');
        box.innerHTML = html || `<div class="lcf-empty">${esc(q ? tr('lcf-no-match', 'Bu adla eşleşen kimse yok.')
            : tr('lcf-empty-all', 'Henüz arkadaşın yok. Sağ üstteki "Arkadaş ekle" ile kullanıcı adından ekleyebilirsin.'))}</div>`;
    }

    page.addEventListener('click', async (e) => {
        const foldBtn = e.target.closest('[data-fold]');
        if (foldBtn) {
            const key = foldBtn.dataset.fold;
            folded[key] = foldBtn.getAttribute('aria-expanded') === 'true';
            saveFold();
            render();
            page.querySelector(`[data-fold="${key}"]`)?.focus();
            return;
        }
        if (e.target.closest('[data-lcf-add]')) { ($('friend-add-open-btn') || $('rail-friend'))?.click(); return; }
        const act = e.target.closest('[data-act]');
        const row = e.target.closest('.lcf-row');
        if (!row) return;
        const id = Number(row.dataset.uid);
        const name = row.dataset.name || row.querySelector('.lcf-txt b')?.textContent || '';
        if (!act) { if (row.dataset.kind === 'friend' && typeof openDm === 'function') openDm(id, name); return; }
        e.stopPropagation();
        const kind = act.dataset.act;
        if (kind === 'dm') { if (typeof openDm === 'function') openDm(id, name); }
        else if (kind === 'join') {
            // Arkadaşın odasına: önce lobi açılır, sonra odaya katılınır (zaten o odadaysan yalnızca lobi açılır).
            const hubId = Number(act.dataset.hub), roomId = Number(act.dataset.room);
            act.disabled = true;
            try {
                if (typeof openHub === 'function') await openHub(hubId);
                const here = typeof currentVoiceRoomId !== 'undefined' && Number(currentVoiceRoomId) === roomId;
                if (!here && typeof joinVoiceRoom === 'function') await joinVoiceRoom({ id: roomId, name: act.dataset.roomName || '' });
            } finally { act.disabled = false; }
        }
        else if (kind === 'call') {
            if (typeof openDm === 'function') await openDm(id, name);
            $('dm-call-btn')?.click();
        } else if (kind === 'profile') { if (typeof openOtherProfile === 'function') openOtherProfile(id, { hideMessageAction: false }); }
        else if (kind === 'accept' || kind === 'reject') {
            act.disabled = true;
            try {
                const r = await fetch('/api/friends/respond', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: id, accept: kind === 'accept' }) });
                const d = await r.json().catch(() => ({}));
                if (!r.ok || !d.success) throw new Error(d.error || '');
                if (typeof showToast === 'function') showToast(kind === 'accept' ? tr('lcf-accepted', 'Arkadaş olarak eklendi.') : tr('lcf-rejected', 'İstek reddedildi.'));
                if (typeof loadFriendsSidebar === 'function') loadFriendsSidebar();
            } catch (err) {
                act.disabled = false;
                if (typeof showNotice === 'function') showNotice(err.message || tr('error', 'Bir hata oluştu.'));
            }
            loadExtras();
        } else if (kind === 'unblock') {
            act.disabled = true;
            try {
                const r = await fetch(`/api/users/${id}/block`, { method: 'DELETE', credentials: 'include' });
                if (!r.ok) throw new Error('');
                if (typeof showToast === 'function') showToast(tr('lcf-unblocked', 'Engel kaldırıldı.'));
            } catch (_) {
                act.disabled = false;
                if (typeof showNotice === 'function') showNotice(tr('error', 'Bir hata oluştu.'));
            }
            loadExtras();
        }
    });
    $('lcf-q').addEventListener('input', render);
    // Seste olma bilgisi: bir sesli odada biri girip çıkınca (ve sayfa açıkken 30 sn'de bir) arkadaş listesi tazelenir.
    let voiceTimer = null;
    const refreshVoice = () => {
        if (page.hidden || typeof loadFriendsSidebar !== 'function') return;
        clearTimeout(voiceTimer);
        voiceTimer = setTimeout(() => loadFriendsSidebar(), 600);
    };
    document.addEventListener('sauran:voice-changed', refreshVoice);
    setInterval(refreshVoice, 30000);
    document.addEventListener('friends-updated', render);

    // Görünürlük: masaüstünde Ana sayfa; telefonda "Arkadaşlar" sekmesi (body.lc-friends-page)
    document.addEventListener('sauran:open-friends', () => {
        if (typeof switchToView === 'function' && body.dataset.view !== 'hubs') switchToView('hubs');
        body.classList.add('lc-friends-page');
        update();
    });
    $('mnav')?.addEventListener('click', (e) => {
        const b = e.target.closest('.mnav-btn');
        if (b && b.dataset.m !== 'friends' && body.classList.contains('lc-friends-page')) { body.classList.remove('lc-friends-page'); update(); }
    }, true);

    function update() {
        const authed = body.classList.contains('lc-auth') || (typeof currentUser !== 'undefined' && currentUser);
        const show = Boolean(authed) && body.dataset.view === 'hubs' && (desk.matches || body.classList.contains('lc-friends-page'));
        if (body.dataset.view !== 'hubs' && body.classList.contains('lc-friends-page')) body.classList.remove('lc-friends-page');
        if (body.classList.contains('lc-show-friends') !== show) body.classList.toggle('lc-show-friends', show);
        // Telefonda üst çubuğun başlığı sayfanın adını taşır (sayfanın kendi başlık satırı telefonda gizli)
        const ctx = $('topbar-context-title');
        if (ctx && !desk.matches) {
            if (show) ctx.textContent = tr('menu-friends', 'Arkadaşlar');
            else if (ctx.textContent === tr('menu-friends', 'Arkadaşlar')) ctx.textContent = tr('hubs-title', 'Ana Menü');
        }
        if (page.hidden === !show) return;
        page.hidden = !show;
        if (show) { render(); loadExtras(); }
    }
    let last = '';
    new MutationObserver(() => {
        const s = body.className + '|' + (body.dataset.view || '');
        if (s === last) return;
        last = s;
        update();
    }).observe(body, { attributes: true, attributeFilter: ['class', 'data-view'] });
    desk.addEventListener('change', update);
    update();
})();
