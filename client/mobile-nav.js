/* Telefon (dikey) alt hap gezinme çubuğu: Gruplar · Keşfet · Ana Menü · Arkadaşlar · Mesajlar · Profil.
   Mevcut ray düğmelerine/işleyicilerine devreder (yeni mantık yok); yalnızca "Arkadaşlar" yeni bir panel açar:
   mesajlaşma değil, arkadaş listesi + kullanıcı adı arama. script.js ve shell.js'ten SONRA yüklenir. */
(function () {
    'use strict';
    const $ = (id) => document.getElementById(id);
    const mq = window.matchMedia('(max-width: 720px) and (min-height: 501px)');
    const esc = (s) => (typeof escapeHtml === 'function' ? escapeHtml(s) : String(s));
    const escA = (s) => (typeof escapeAttr === 'function' ? escapeAttr(s) : String(s));
    const railSvg = (id) => { const b = $(id); const s = b && b.querySelector('svg'); return s ? s.outerHTML : ''; };

    const nav = document.createElement('nav');
    nav.id = 'mnav';
    nav.className = 'mnav';
    nav.setAttribute('aria-label', 'Ana gezinme');
    const ITEMS = [
        { key: 'groups', label: 'Gruplar', icon: () => railSvg('rail-lobbies') },
        { key: 'discover', label: 'Keşfet', icon: () => railSvg('rail-discover') },
        { key: 'home', label: 'Ana Menü', icon: () => railSvg('rail-home') },
        { key: 'friends', label: 'Arkadaşlar', icon: () => railSvg('rail-friends') },
        { key: 'dms', label: 'Mesajlar', icon: () => railSvg('rail-groups') },
        { key: 'profile', label: 'Profil', icon: null }
    ];
    nav.innerHTML = ITEMS.map((it) => it.key === 'profile'
        ? `<button type="button" class="mnav-btn mnav-avatar" data-m="profile" aria-label="Profil"><span class="mnav-av" id="mnav-av"></span><i class="mnav-dot" id="mnav-profile-dot" style="display:none"></i></button>`
        : `<button type="button" class="mnav-btn" data-m="${it.key}" aria-label="${it.label}" title="${it.label}">${it.icon()}<i class="mnav-dot" data-dot="${it.key}" style="display:none"></i></button>`).join('');
    document.body.appendChild(nav);

    const body = document.body;
    function closeAll() { body.classList.remove('lobby-drawer-open', 'drawer-friends', 'drawer-groups', 'drawer-friendlist'); }
    function toggleMode(mode) {
        const open = body.classList.contains('lobby-drawer-open') && body.classList.contains(mode);
        closeAll();
        if (!open) body.classList.add('lobby-drawer-open', mode);
        sync();
    }

    // ── Arkadaşlar paneli (mesajlaşma değil): liste + kullanıcı adı arama ──
    const dir = document.createElement('div');
    dir.id = 'friends-directory';
    dir.className = 'friends-directory';
    dir.innerHTML = `<div class="fd-head"><span>Arkadaşlar</span><button type="button" class="rail-btn rail-btn-sm" id="fd-add" aria-label="Arkadaş ekle" title="Arkadaş ekle"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 5v14M5 12h14"/></svg></button></div>
        <div class="fd-search"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/></svg><input id="fd-input" type="search" placeholder="Arkadaşlarda kullanıcı adı ara" autocomplete="off" aria-label="Arkadaş ara"></div>
        <div class="fd-list" id="fd-list"></div>`;
    const lobbyNav = $('lobby-nav');
    if (lobbyNav) lobbyNav.appendChild(dir);

    function renderDir() {
        const list = $('fd-list');
        if (!list) return;
        const q = ($('fd-input').value || '').trim().toLowerCase();
        const friends = (window.__friendsCache || []).filter((f) => !q || f.username.toLowerCase().includes(q));
        if (!friends.length) { list.innerHTML = `<div class="fd-empty">${q ? 'Eşleşen arkadaş yok.' : 'Henüz arkadaşın yok. Sağ üstteki + ile ekleyebilirsin.'}</div>`; return; }
        friends.sort((a, b) => Number(Boolean(b.online)) - Number(Boolean(a.online)) || a.username.localeCompare(b.username, 'tr'));
        list.innerHTML = friends.map((f) => {
            const color = typeof resolveUserColor === 'function' ? resolveUserColor(f.id, f.username, f.profile_color) : '#5b6cff';
            const av = f.avatar_data ? `<img src="${escA(f.avatar_data)}" alt="">` : esc(f.username.charAt(0).toUpperCase());
            return `<button type="button" class="fd-row" data-fid="${f.id}"><span class="fd-av" style="--user-color:${escA(color)}">${av}<i class="fd-st${f.online ? ' on' : ''}"></i></span><span class="fd-name">${esc(f.username)}</span><span class="fd-sub">${f.online ? 'çevrimiçi' : ''}</span></button>`;
        }).join('');
    }
    $('fd-input')?.addEventListener('input', renderDir);
    $('fd-add')?.addEventListener('click', () => { closeAll(); sync(); $('friend-add-open-btn')?.click(); });
    $('fd-list')?.addEventListener('click', (e) => {
        const row = e.target.closest('[data-fid]');
        if (!row) return;
        closeAll(); sync();
        if (typeof openOtherProfile === 'function') openOtherProfile(Number(row.dataset.fid), { hideMessageAction: false });
    });
    // Arkadaş listesi yenilendikçe (sunucudan) panel de güncellenir
    document.addEventListener('friends-updated', renderDir);

    // ── Düğmeler ──
    nav.addEventListener('click', (e) => {
        const b = e.target.closest('.mnav-btn');
        if (!b) return;
        const k = b.dataset.m;
        if (k === 'groups') { $('rail-groups')?.click(); }
        else if (k === 'discover') { closeAll(); $('rail-discover')?.click(); }
        else if (k === 'home') { closeAll(); $('rail-home')?.click(); }
        else if (k === 'dms') { $('rail-friends')?.click(); }
        else if (k === 'friends') { toggleMode('drawer-friendlist'); if (body.classList.contains('drawer-friendlist')) { renderDir(); } return; }
        else if (k === 'profile') { closeAll(); $('rail-profile')?.click(); }
        setTimeout(sync, 0);
    });

    function sync() {
        const view = body.dataset.view || '';
        const drawer = body.classList.contains('lobby-drawer-open');
        const on = {
            groups: drawer && body.classList.contains('drawer-groups'),
            dms: drawer && body.classList.contains('drawer-friends'),
            friends: drawer && body.classList.contains('drawer-friendlist'),
            discover: view === 'discover' && !drawer,
            home: !drawer && view !== 'discover' && (view === 'hubs' || view === ''),
            profile: false
        };
        nav.querySelectorAll('.mnav-btn').forEach((b) => b.classList.toggle('on', Boolean(on[b.dataset.m])));
        // Mesaj noktası (okunmamış DM) mevcut göstergeden yansıtılır
        const fd = $('rail-friends-dot'), dot = nav.querySelector('[data-dot="dms"]');
        if (fd && dot) dot.style.display = fd.style.display !== 'none' && getComputedStyle(fd).display !== 'none' ? 'block' : 'none';
        const gd = $('rail-groups-dot'), gdot = nav.querySelector('[data-dot="groups"]');
        if (gd && gdot) gdot.style.display = getComputedStyle(gd).display !== 'none' ? 'block' : 'none';
        // Profil avatarı
        const rp = $('rail-profile'), av = $('mnav-av');
        if (rp && av) {
            const bg = rp.style.backgroundImage;
            const ini = $('rail-avatar-initial');
            av.style.backgroundImage = bg || '';
            av.textContent = bg ? '' : (ini ? ini.textContent : '');
        }
    }
    new MutationObserver(sync).observe(body, { attributes: true, attributeFilter: ['class', 'data-view'] });
    ['rail-friends-dot', 'rail-groups-dot', 'rail-profile', 'rail-avatar-initial'].forEach((id) => { const el = $(id); if (el) new MutationObserver(sync).observe(el, { attributes: true, childList: true, characterData: true, subtree: true }); });
    mq.addEventListener && mq.addEventListener('change', sync);
    sync();
    setInterval(sync, 4000); // nokta/avatar yansıtmaları için hafif güvence

    // ── Ana Menü üst satırı: Yeni Arkadaş / Yeni Grup kısayolları ──
    const header = $('hub-list-header');
    if (header && !$('hub-friend-open-btn')) {
        const mk = (id, label, targetId) => {
            const b = document.createElement('button');
            b.id = id; b.type = 'button'; b.className = 'hub-create-btn hub-create-btn-alt'; b.textContent = label;
            b.addEventListener('click', () => $(targetId)?.click());
            return b;
        };
        header.appendChild(mk('hub-friend-open-btn', '+ Yeni Arkadaş', 'friend-add-open-btn'));
        header.appendChild(mk('hub-group-open-btn', '+ Yeni Grup', 'group-create-open-btn'));
    }
})();
