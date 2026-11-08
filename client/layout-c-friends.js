// Sauran — "Sıkı Düzen" Arkadaşlar sayfası (Paket 6). Masaüstünde Ana sayfanın ortası; telefonda "Arkadaşlar" sekmesi.
// Sekmeler: Çevrimiçi · Tümü · Bekleyen · Engellenen. Veri mevcut uçlardan: arkadaşlar script.js'in önbelleğinden
// (window.__friendsCache, 'friends-updated' olayı), istekler /api/friends/requests, engellenenler /api/users/blocked.
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
        search: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/></svg>'
    };

    const page = document.createElement('section');
    page.id = 'lc-friends';
    page.className = 'lc-friends';
    page.hidden = true;
    page.setAttribute('aria-labelledby', 'lcf-title');
    page.innerHTML = `
        <header class="lcf-head">
            <h2 class="lcf-title" id="lcf-title">${ICON.people}<span>${esc(tr('menu-friends', 'Arkadaşlar'))}</span></h2>
            <div class="lcf-tabs" role="tablist">
                <button type="button" role="tab" data-tab="online">${esc(tr('lcf-online', 'Çevrimiçi'))}</button>
                <button type="button" role="tab" data-tab="all">${esc(tr('lcf-all', 'Tümü'))}</button>
                <button type="button" role="tab" data-tab="pending">${esc(tr('lcf-pending', 'Bekleyen'))}<b class="lcf-badge" id="lcf-pending-n" hidden></b></button>
                <button type="button" role="tab" data-tab="blocked">${esc(tr('lcf-blocked', 'Engellenen'))}</button>
            </div>
            <button type="button" class="lcf-add" id="lcf-add">${ICON.add}<span>${esc(tr('menu-add-friend', 'Arkadaş ekle'))}</span></button>
        </header>
        <div class="lcf-body">
            <label class="lcf-search">${ICON.search}<input id="lcf-q" type="search" autocomplete="off" placeholder="${esc(tr('lcf-search', 'Arkadaşlarında ara'))}"></label>
            <div class="lcf-count" id="lcf-count"></div>
            <div class="lcf-list" id="lcf-list" role="list"></div>
        </div>`;
    const chatArea = document.querySelector('#chat-screen .chat-area');
    if (!chatArea) return;
    chatArea.insertBefore(page, chatArea.firstChild);

    let tab = '';
    let requests = [];
    let blocked = [];
    let loaded = false;

    const friends = () => (Array.isArray(window.__friendsCache) ? window.__friendsCache : []);
    const avatar = (u) => {
        if (typeof avatarButtonHtml === 'function') return avatarButtonHtml(u.id, u.avatar_data, u.username, u.avatar_frame, u.profile_color);
        return `<span class="lcf-av-fallback">${esc(String(u.username || '?').charAt(0).toUpperCase())}</span>`;
    };
    const activityText = (f) => {
        const a = f.activity;
        if (a && typeof a === 'object' && a.text) return a.text;
        if (typeof a === 'string' && a) return a;
        return f.online ? tr('online-status', 'Çevrimiçi') : tr('offline-status', 'Çevrimdışı');
    };

    async function loadExtras() {
        try {
            const [r, b] = await Promise.all([
                fetch('/api/friends/requests', { credentials: 'include' }).then((x) => x.json()),
                fetch('/api/users/blocked', { credentials: 'include' }).then((x) => x.json())
            ]);
            requests = r && r.success && Array.isArray(r.requests) ? r.requests : [];
            blocked = b && b.success && Array.isArray(b.blocked) ? b.blocked : [];
        } catch (_) { /* liste boş görünür */ }
        loaded = true;
        render();
    }

    function setTab(next) {
        tab = next;
        page.querySelectorAll('.lcf-tabs [data-tab]').forEach((b) => {
            const on = b.dataset.tab === tab;
            b.classList.toggle('on', on);
            b.setAttribute('aria-selected', on ? 'true' : 'false');
        });
        render();
    }

    function render() {
        if (page.hidden) return;
        const n = requests.length;
        const badge = $('lcf-pending-n');
        badge.hidden = n === 0;
        badge.textContent = String(n);
        // Varsayılan sekme istekler yüklendikten sonra seçilir: bekleyen istek varsa "Bekleyen", yoksa çevrimiçi varsa "Çevrimiçi".
        if (!tab) {
            if (!loaded) { $('lcf-count').textContent = ''; $('lcf-list').innerHTML = `<div class="lcf-empty">${esc(tr('loading', 'Yükleniyor…'))}</div>`; return; }
            setTab(n ? 'pending' : (friends().some((f) => f.online) ? 'online' : 'all'));
            return;
        }
        const q = ($('lcf-q').value || '').trim().toLocaleLowerCase('tr');
        const match = (u) => !q || String(u.username || '').toLocaleLowerCase('tr').includes(q);
        let rows = [];
        let label = '';
        let empty = '';
        if (tab === 'online' || tab === 'all') {
            rows = friends().filter((f) => (tab === 'all' || f.online) && match(f));
            rows.sort((a, b) => Number(Boolean(b.online)) - Number(Boolean(a.online)) || String(a.username).localeCompare(String(b.username), 'tr'));
            label = (tab === 'online' ? tr('lcf-online', 'Çevrimiçi') : tr('lcf-all-friends', 'Tüm arkadaşlar')) + ' — ' + rows.length;
            empty = q ? tr('lcf-no-match', 'Bu adla eşleşen arkadaş yok.')
                : tab === 'online' ? tr('lcf-empty-online', 'Şu an çevrimiçi arkadaşın yok.')
                : tr('lcf-empty-all', 'Henüz arkadaşın yok. Sağ üstteki "Arkadaş ekle" ile kullanıcı adından ekleyebilirsin.');
        } else if (tab === 'pending') {
            rows = requests.filter((r) => match({ username: r.username }));
            label = tr('lcf-incoming', 'Gelen istekler') + ' — ' + rows.length;
            empty = loaded ? tr('lcf-empty-pending', 'Bekleyen arkadaşlık isteğin yok.') : tr('loading', 'Yükleniyor…');
        } else {
            rows = blocked.filter(match);
            label = tr('lcf-blocked', 'Engellenen') + ' — ' + rows.length;
            empty = loaded ? tr('lcf-empty-blocked', 'Kimseyi engellemedin.') : tr('loading', 'Yükleniyor…');
        }
        $('lcf-count').textContent = rows.length ? label : '';
        const list = $('lcf-list');
        if (!rows.length) { list.innerHTML = `<div class="lcf-empty">${esc(empty)}</div>`; return; }
        list.innerHTML = rows.map((u) => {
            if (tab === 'pending') {
                const id = Number(u.user_id);
                return `<div class="lcf-row" role="listitem" data-uid="${id}">
                    <span class="lcf-av">${avatar({ id, username: u.username, avatar_data: u.avatar_data })}</span>
                    <span class="lcf-txt"><b>${esc(u.username)}</b><span>${esc(tr('lcf-wants', 'Arkadaşlık isteği gönderdi'))}</span></span>
                    <span class="lcf-acts">
                        <button type="button" class="lcf-act ok" data-act="accept" title="${esc(tr('accept', 'Kabul et'))}" aria-label="${esc(tr('accept', 'Kabul et'))}">${ICON.ok}</button>
                        <button type="button" class="lcf-act no" data-act="reject" title="${esc(tr('reject', 'Reddet'))}" aria-label="${esc(tr('reject', 'Reddet'))}">${ICON.no}</button>
                    </span></div>`;
            }
            if (tab === 'blocked') {
                return `<div class="lcf-row" role="listitem" data-uid="${Number(u.id)}">
                    <span class="lcf-av">${avatar(u)}</span>
                    <span class="lcf-txt"><b>${esc(u.username)}</b><span>${esc(tr('lcf-is-blocked', 'Engellendi'))}</span></span>
                    <span class="lcf-acts"><button type="button" class="lcf-act lcf-text" data-act="unblock">${esc(tr('lcf-unblock', 'Engeli kaldır'))}</button></span></div>`;
            }
            return `<div class="lcf-row${u.online ? ' is-on' : ''}" role="listitem" data-uid="${Number(u.id)}" data-name="${esc(u.username)}">
                <span class="lcf-av">${avatar(u)}<i class="lcf-st" aria-hidden="true"></i></span>
                <span class="lcf-txt"><b>${esc(u.username)}</b><span>${esc(activityText(u))}</span></span>
                <span class="lcf-acts">
                    <button type="button" class="lcf-act" data-act="dm" title="${esc(tr('lcf-message', 'Mesaj gönder'))}" aria-label="${esc(tr('lcf-message', 'Mesaj gönder'))}">${ICON.chat}</button>
                    <button type="button" class="lcf-act" data-act="call" title="${esc(tr('lcf-call', 'Sesli ara'))}" aria-label="${esc(tr('lcf-call', 'Sesli ara'))}">${ICON.call}</button>
                    <button type="button" class="lcf-act" data-act="profile" title="${esc(tr('lcf-profile', 'Profili gör'))}" aria-label="${esc(tr('lcf-profile', 'Profili gör'))}">${ICON.more}</button>
                </span></div>`;
        }).join('');
    }

    page.addEventListener('click', async (e) => {
        const tabBtn = e.target.closest('.lcf-tabs [data-tab]');
        if (tabBtn) { setTab(tabBtn.dataset.tab); return; }
        if (e.target.closest('#lcf-add')) { ($('friend-add-open-btn') || $('rail-friend'))?.click(); return; }
        const act = e.target.closest('[data-act]');
        const row = e.target.closest('.lcf-row');
        if (!row) return;
        const id = Number(row.dataset.uid);
        const name = row.dataset.name || row.querySelector('.lcf-txt b')?.textContent || '';
        if (!act) { if (tab === 'online' || tab === 'all') openDm?.(id, name); return; }
        e.stopPropagation();
        const kind = act.dataset.act;
        if (kind === 'dm') { if (typeof openDm === 'function') openDm(id, name); }
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
