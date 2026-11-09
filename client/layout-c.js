// Sauran — "Sıkı Düzen" yerleşimi (tasarım yönü C, 2026-11-08 kullanıcı seçimi).
// Masaüstü: solda lobi rayı · lobi kanal/ses sütunu (altta ses + kullanıcı paneli) · sohbet · sağda üyeler.
// Mevcut mantığa dokunmaz: veriyi shell.js'in /api/hubs listesinden alır, eylemleri mevcut işlevlere/düğmelere devreder
// (openHub, switchToView, toggleLocalMute, call-* düğmeleri) ve mevcut öğeleri (ses odaları listesi, DM listesi) sütuna taşır.
// script.js, mobile-nav.js ve shell.js'ten SONRA yüklenir. Görünüm layout-c.css'te (body.lc).
(function () {
    'use strict';

    // Acil geri dönüş: localStorage 'sauran.layout' = 'classic' ise eski yerleşim kalır.
    try { if (localStorage.getItem('sauran.layout') === 'classic') return; } catch (_) { /* depolama kapalı */ }

    const $ = (id) => document.getElementById(id);
    const body = document.body;
    body.classList.add('lc');
    const desk = window.matchMedia('(min-width: 901px) and (min-height: 501px)');
    const tr = (key, fallback) => { try { const v = t(key); return v && v !== key ? v : fallback; } catch (_) { return fallback; } };
    const svgOf = (id) => { const s = $(id)?.querySelector('svg'); return s ? s.outerHTML : ''; };
    const ICON = {
        mic: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>',
        micOff: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3M4 4l16 16"/></svg>',
        head: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 15v-3a8 8 0 0 1 16 0v3"/><rect x="3" y="14" width="5" height="7" rx="2"/><rect x="16" y="14" width="5" height="7" rx="2"/></svg>',
        headOff: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 15v-3a8 8 0 0 1 16 0v3"/><rect x="3" y="14" width="5" height="7" rx="2"/><rect x="16" y="14" width="5" height="7" rx="2"/><path d="M4 4l16 16"/></svg>',
        gear: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/></svg>',
        leave: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 15c5-4 11-4 16 0l-2 3-3-1.5v-2.5a9 9 0 0 0-6 0v2.5L6 18z"/></svg>',
        plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
        more: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/></svg>',
        members: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c1-3.5 3.5-5 6.5-5s5.5 1.5 6.5 5M16 4.5a3.5 3.5 0 0 1 0 7M18 15c2 .6 3.2 2.2 3.8 5"/></svg>',
        chevron: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>',
        chat: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5h14a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H10l-5 4v-4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z"/></svg>',
        expand: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>'
    };
    // script.js'teki global let değişkenleri: doğrudan ad ile okunur (eval yok; CSP 'unsafe-eval' gerektirmez).
    const STATE = {
        callMode: () => (typeof callMode !== 'undefined' ? callMode : null),
        currentHub: () => (typeof currentHub !== 'undefined' ? currentHub : null),
        currentUser: () => (typeof currentUser !== 'undefined' ? currentUser : null),
        voiceLocalMuted: () => (typeof voiceLocalMuted !== 'undefined' ? voiceLocalMuted : false),
        voiceUserMuted: () => (typeof voiceUserMuted !== 'undefined' ? voiceUserMuted : false),
        voiceDeafened: () => (typeof voiceDeafened !== 'undefined' ? voiceDeafened : false),
        currentVoiceRoomName: () => (typeof currentVoiceRoomName !== 'undefined' ? currentVoiceRoomName : ''),
        outgoingCallToUsername: () => (typeof outgoingCallToUsername !== 'undefined' ? outgoingCallToUsername : '')
    };
    const get = (name) => { try { return STATE[name](); } catch (_) { return undefined; } };

    // ── Sol lobi rayı ──────────────────────────────────────────────────────
    const rail = document.createElement('nav');
    rail.id = 'lc-rail';
    rail.className = 'lc-rail';
    rail.setAttribute('aria-label', tr('lobbies-title', 'Lobiler'));
    rail.innerHTML = `
        <button type="button" class="lc-ico lc-home" id="lc-home"><span class="lc-home-av" id="lc-home-av"></span><span class="lc-pill"></span><i class="lc-dot" id="lc-home-dot" hidden></i></button>
        <div class="lc-sep" aria-hidden="true"></div>
        <div class="lc-lobbies" id="lc-lobbies"></div>
        <button type="button" class="lc-ico lc-tool lc-add" id="lc-add">${ICON.plus}</button>
        <button type="button" class="lc-ico lc-tool" id="lc-discover"><span class="lc-pill"></span>${svgOf('rail-discover')}</button>
        <span class="lc-spacer"></span>
        <button type="button" class="lc-ico lc-tool" id="lc-bell">${svgOf('rail-notifications')}<i class="lc-dot" id="lc-bell-dot" hidden></i></button>
        <button type="button" class="lc-ico lc-tool" id="lc-more">${ICON.more}</button>`;
    document.body.appendChild(rail);
    const label = (id, text) => { const el = $(id); if (el) { el.setAttribute('aria-label', text); el.title = text; } };
    label('lc-home', tr('lc-home', 'Ana sayfa ve mesajlar'));
    label('lc-add', tr('lobby-create', 'Lobi oluştur'));
    label('lc-discover', tr('menu-discover', 'Keşfet'));
    label('lc-bell', tr('menu-notifications', 'Bildirimler'));
    label('lc-more', tr('lc-more', 'Diğer: mağaza, kod ile katıl, ayarlar…'));
    // Kart şeridinde her düğmenin altında kısa adı yazar (ekran okuyucu tam adı aria-label'dan okur).
    [['lc-home', 'lc-short-home', 'Ana sayfa'], ['lc-add', 'lc-short-add', 'Oluştur'], ['lc-discover', 'menu-discover', 'Keşfet'],
        ['lc-bell', 'lc-short-bell', 'Bildirim'], ['lc-more', 'lc-short-more', 'Diğer']].forEach(([id, key, fb]) => {
        const el = $(id);
        if (!el) return;
        const s = document.createElement('span');
        s.className = 'lc-name';
        s.setAttribute('aria-hidden', 'true');
        s.textContent = tr(key, fb);
        el.appendChild(s);
    });

    function renderLobbies() {
        const box = $('lc-lobbies');
        if (!box) return;
        const hubs = (window.__sauranHubs || []).filter((h) => h && h.type !== 'group');
        box.textContent = '';
        hubs.forEach((h) => {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'lc-ico lc-lobby';
            b.dataset.hubId = h.id;
            b.title = h.name || '';
            b.setAttribute('aria-label', h.name || '');
            const mark = document.createElement('span');
            mark.className = 'lc-mark';
            if (h.image_data) { const img = document.createElement('img'); img.src = h.image_data; img.alt = ''; img.decoding = 'async'; mark.appendChild(img); }
            else mark.textContent = String(h.name || '?').trim().charAt(0).toUpperCase() || '?';
            const pill = document.createElement('span'); pill.className = 'lc-pill';
            const name = document.createElement('span');
            name.className = 'lc-name';
            name.textContent = h.name || '';
            name.setAttribute('aria-hidden', 'true');
            const unread = document.createElement('span');
            unread.className = 'hub-card-unread lc-unread';
            unread.dataset.hubUnread = h.id; // içeriği script.js renderHubUnreadBadges doldurur
            unread.style.display = 'none';
            b.append(mark, name, pill, unread);
            b.addEventListener('click', () => { closeDmIfDesk(); if (typeof openHub === 'function') openHub(h.id); });
            box.appendChild(b);
        });
        try { if (typeof renderHubUnreadBadges === 'function') renderHubUnreadBadges(); } catch (_) { /* yoksay */ }
        sync();
    }
    document.addEventListener('sauran:hubs', renderLobbies);

    const closeDmIfDesk = () => { if (desk.matches && typeof closeDmPanel === 'function' && $('dm-modal')?.style.display === 'flex') closeDmPanel(); };
    $('lc-home').addEventListener('click', () => { closeDmIfDesk(); if (typeof switchToView === 'function') switchToView('hubs'); });
    $('lc-add').addEventListener('click', () => $('hub-create-open-btn')?.click());
    $('lc-discover').addEventListener('click', () => { closeDmIfDesk(); $('rail-discover')?.click(); });
    $('lc-bell').addEventListener('click', () => { const b = $('notifications-btn'); if (b) b.click(); else $('rail-notifications')?.click(); });
    const menuDropdown = $('topbar-menu-dropdown');
    if (menuDropdown) document.body.appendChild(menuDropdown); // konumu layout-c.css belirler (position: fixed)
    $('lc-more').addEventListener('click', (e) => {
        e.stopPropagation();
        body.classList.add('lc-menu-from-rail');
        $('topbar-menu-btn')?.click();
    });
    $('topbar-menu-btn')?.addEventListener('click', (e) => { if (e.isTrusted) body.classList.remove('lc-menu-from-rail'); }, true);

    // Ses odası önizleme penceresi #chat-screen (z 1) içindeydi: ray ve sütunun (z 60) altında kalmasın.
    const roomPreview = $('voice-room-preview-modal');
    if (roomPreview) document.body.appendChild(roomPreview);

    // ── Kanal / ses sütunu ─────────────────────────────────────────────────
    const col = document.createElement('aside');
    col.id = 'lc-col';
    col.className = 'lc-col';
    col.innerHTML = `
        <div class="lc-col-head" id="lc-col-head"><span class="lc-col-title" id="lc-col-title"></span><button type="button" class="lc-icon-btn" id="lc-add-friend">${ICON.plus}</button><button type="button" class="lc-icon-btn" id="lc-col-menu">${ICON.chevron}</button></div>
        <div class="lc-col-body">
            <div class="lc-hub-sec" id="lc-hub-sec">
                <button type="button" class="lc-ch lc-chat-card on" id="lc-ch-chat"><span class="lc-chat-ico">${ICON.chat}</span>${tr('lc-chat-card', 'Sohbet')}</button>
                <div class="lc-lbl lc-rooms-lbl"><span>${tr('lc-voice-rooms-label', 'Ses odaları')}</span><button type="button" class="lc-icon-btn lc-lbl-btn" id="lc-room-add">${ICON.plus}</button></div>
                <div id="lc-rooms-slot" class="lc-rooms-slot"></div>
            </div>
            <div class="lc-home-sec" id="lc-home-sec"><div id="lc-pending-slot" class="lc-pending-slot"></div><div id="lc-groups-slot" class="lc-groups-slot"></div><div id="lc-dm-slot" class="lc-dm-slot"></div></div>
        </div>
        <div class="lc-voice" id="lc-voice" hidden>
            <div class="lc-voice-row">
                <div class="lc-voice-info"><b id="lc-voice-state">${tr('lc-voice-connected', 'Sesli bağlı')}</b><span id="lc-voice-room"></span></div>
                <button type="button" class="lc-icon-btn" id="lc-voice-open">${ICON.expand}</button>
                <button type="button" class="lc-icon-btn lc-danger" id="lc-voice-leave">${ICON.leave}</button>
            </div>
        </div>
        <div class="lc-user" id="lc-user">
            <button type="button" class="lc-user-id" id="lc-user-id"><span class="lc-user-av" id="lc-user-av"></span><span class="lc-user-txt"><b id="lc-user-name"></b><span id="lc-user-sub"></span></span></button>
            <button type="button" class="lc-icon-btn" id="lc-mic">${ICON.mic}</button>
            <button type="button" class="lc-icon-btn" id="lc-deaf">${ICON.head}</button>
            <button type="button" class="lc-icon-btn" id="lc-gear">${ICON.gear}</button>
        </div>`;
    document.body.appendChild(col);
    label('lc-col-menu', tr('lc-lobby-info', 'Lobi bilgisi'));
    label('lc-add-friend', tr('menu-add-friend', 'Arkadaş ekle'));
    $('lc-add-friend').addEventListener('click', () => ($('friend-add-open-btn') || $('rail-friend'))?.click());
    label('lc-room-add', tr('voice-room-add', 'Oda ekle'));
    label('lc-voice-open', tr('lc-voice-open', 'Sesli odayı göster'));
    label('lc-voice-leave', tr('lc-voice-leave', 'Sesli odadan ayrıl'));
    label('lc-gear', tr('menu-settings', 'Ayarlar'));
    label('lc-user-id', tr('profile', 'Profilim'));

    // Lobi adının yanındaki ⌄: lobi bilgi penceresi (takviye, üyeler, ayrılma…); yoksa lobi ayarları.
    $('lc-col-menu').addEventListener('click', () => { const b = $('topbar-lobby-badge'); if (b) b.click(); else $('hub-settings-open-btn')?.click(); });
    $('lc-ch-chat').addEventListener('click', () => $('hub-feed')?.scrollTo({ top: $('hub-feed').scrollHeight, behavior: 'smooth' }));
    $('lc-room-add').addEventListener('click', () => $('hub-voice-room-add-btn')?.click());
    $('lc-voice-open').addEventListener('click', () => $('call-mini-expand-btn')?.click());
    $('lc-voice-leave').addEventListener('click', () => ($('call-leave-btn') || $('call-mini-leave-btn'))?.click());
    $('lc-mic').addEventListener('click', () => { if (get('callMode') === 'hub-room' || get('callMode') === 'dm') { if (typeof toggleLocalMute === 'function') toggleLocalMute(); sync(); } });
    $('lc-deaf').addEventListener('click', () => { if (get('callMode') === 'hub-room') { $('call-speaker-btn')?.click(); setTimeout(sync, 50); } });
    $('lc-gear').addEventListener('click', () => $('settings-btn')?.click());
    $('lc-user-id').addEventListener('click', () => $('rail-profile')?.click());

    // Masaüstünde mevcut öğeler sütuna taşınır; dar ekranda eski yerlerine döner (işleyiciler öğeyle birlikte gelir).
    const MOVES = [ // [öğe, yuva, telefonda da taşınır]
        ['hub-voice-rooms-list', 'lc-rooms-slot', true],
        ['fd-pending', 'lc-pending-slot', false],
        ['friends-groups', 'lc-groups-slot', false],
        ['friends-sidebar', 'lc-dm-slot', false]
    ];
    const home = new Map();
    function placeMoved() {
        MOVES.forEach(([id, slotId, always]) => {
            const el = $(id);
            const slot = $(slotId);
            if (!el || !slot) return;
            if (desk.matches || always) {
                if (el.parentElement !== slot) { home.set(id, { parent: el.parentElement, next: el.nextSibling }); slot.appendChild(el); }
            } else if (home.has(id) && el.parentElement === slot) {
                const h = home.get(id);
                if (h.parent) h.parent.insertBefore(el, h.next && h.next.parentElement === h.parent ? h.next : null);
                home.delete(id);
            }
        });
    }

    // Lobi başlığında "# sohbet" ve üye listesi düğmesi
    const header = document.querySelector('#hub-detail-view .hub-detail-header');
    if (header) {
        const ch = document.createElement('span');
        ch.className = 'lc-head-ch';
        ch.innerHTML = `<span class="lc-hash">#</span><span class="lc-head-txt"><b>${tr('lc-chat', 'sohbet')}</b><span class="lc-head-hub" id="lc-head-hub"></span></span>`;
        ch.setAttribute('role', 'button');
        ch.tabIndex = 0;
        ch.addEventListener('click', () => $('lc-col-menu')?.click());
        ch.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('lc-col-menu')?.click(); } });
        header.insertBefore(ch, header.firstChild);
        const mem = document.createElement('button');
        mem.type = 'button';
        mem.className = 'hub-icon-btn lc-members-btn';
        mem.id = 'lc-members-btn';
        mem.innerHTML = ICON.members;
        // Üst çubuk lobi ekranında gizli olduğu için Süper Beğeni düğmesi lobi başlığına taşınır.
        const sl = $('lobby-superlike-btn');
        if (sl) header.appendChild(sl);
        header.appendChild(mem);
        label('lc-members-btn', tr('lc-members', 'Üye listesi'));
        let hide = false;
        try { hide = localStorage.getItem('sauran.lc.members') === 'hidden'; } catch (_) {}
        body.classList.toggle('lc-members-hidden', hide);
        mem.addEventListener('click', () => {
            if (!desk.matches) { $('hub-members-toggle-btn')?.click(); return; } // telefonda mevcut üye paneli
            const h = body.classList.toggle('lc-members-hidden');
            try { localStorage.setItem('sauran.lc.members', h ? 'hidden' : 'shown'); } catch (_) {}
            sync();
        });
    }

    // ── Telefon: ☰ çekmecesi (lobi rayı + kanal/ses sütunu) ─────────────────
    const backdrop = document.createElement('div');
    backdrop.className = 'lc-backdrop';
    document.body.appendChild(backdrop);
    let drawerOpener = null;
    const closeDrawer = () => {
        if (!body.classList.contains('lc-drawer')) return;
        body.classList.remove('lc-drawer');
        $('lc-burger')?.setAttribute('aria-expanded', 'false');
        if (drawerOpener && document.contains(drawerOpener)) drawerOpener.focus();
        drawerOpener = null;
        sync();
    };
    backdrop.addEventListener('click', closeDrawer);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && body.classList.contains('lc-drawer')) closeDrawer(); });
    rail.addEventListener('click', (e) => { if (e.target.closest('.lc-ico')) closeDrawer(); });
    col.addEventListener('click', (e) => {
        if (!body.classList.contains('lc-drawer')) return;
        if (e.target.closest('#lc-mic, #lc-deaf, .hub-voice-room-toggle')) return;
        if (e.target.closest('button, .lc-ch, .hub-voice-room-row')) closeDrawer();
    });
    if (header) {
        const burger = document.createElement('button');
        burger.type = 'button';
        burger.className = 'hub-icon-btn lc-burger';
        burger.id = 'lc-burger';
        burger.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>';
        header.insertBefore(burger, header.firstChild);
        label('lc-burger', tr('lc-drawer', 'Lobiler ve ses odaları'));
        burger.setAttribute('aria-expanded', 'false');
        burger.setAttribute('aria-controls', 'lc-col');
        burger.addEventListener('click', () => {
            drawerOpener = burger;
            body.classList.add('lc-drawer');
            burger.setAttribute('aria-expanded', 'true');
            sync();
            requestAnimationFrame(() => document.querySelector('#lc-lobbies .lc-lobby.on, #lc-home')?.focus());
        });
    }
    // Alt sekme çubuğu: anlaşılır etiketler (mobile-nav.js düğmeleri; davranış aynı)
    const TAB_LABELS = { home: tr('lc-tab-lobbies', 'Lobiler'), dms: tr('lc-tab-messages', 'Mesajlar'), friends: tr('menu-friends', 'Arkadaşlar'),
        discover: tr('menu-discover', 'Keşfet'), groups: tr('groups-title', 'Gruplar'), profile: tr('lc-tab-me', 'Sen') };
    document.querySelectorAll('#mnav .mnav-btn').forEach((b) => {
        const key = b.dataset.m;
        if (!TAB_LABELS[key]) return;
        const lbl = b.querySelector('.mnav-lbl');
        if (lbl) lbl.textContent = TAB_LABELS[key];
        b.setAttribute('aria-label', TAB_LABELS[key]);
        b.title = TAB_LABELS[key];
    });

    // ── Arama ekranı: yazılı "Sohbete dön" düğmesi ve kontrol düğmelerinin altında kısa adlar ──
    // (Kullanıcılar yalnızca simge olan "alta al" düğmesini bulamıyordu.)
    const callOverlay = $('call-overlay');
    if (callOverlay) {
        const back = document.createElement('button');
        back.type = 'button';
        back.className = 'lc-call-back';
        back.id = 'lc-call-back';
        back.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg><span>${tr('lc-call-back', 'Sohbete dön')}</span>`;
        back.title = tr('lc-call-back-hint', 'Görüşme sürer; ekran küçülür');
        back.addEventListener('click', () => $('call-minimize-btn')?.click());
        callOverlay.appendChild(back);
        const CALL_LABELS = {
            'call-mute-btn': tr('lc-call-mic', 'Mikrofon'), 'call-nc-btn': tr('lc-call-nc', 'Gürültü'), 'call-screenshare-btn': tr('lc-call-share', 'Ekran'),
            'call-speaker-btn': tr('lc-call-sound', 'Ses'), 'call-minimize-btn': tr('lc-call-min', 'Küçült'), 'call-leave-btn': tr('lc-call-leave', 'Ayrıl')
        };
        Object.keys(CALL_LABELS).forEach((id) => { const b = $(id); if (b) b.dataset.lcLbl = CALL_LABELS[id]; });
    }

    // ── Durum eşitleme (aktif lobi, görünüm, ses durumu, kullanıcı) ─────────
    let raf = 0;
    function sync() {
        if (raf) return;
        raf = requestAnimationFrame(() => { raf = 0; doSync(); });
    }
    function doSync() {
        setClass('lc-desk', desk.matches);
        const chat = $('chat-screen');
        setClass('lc-auth', Boolean(get('currentUser')) && Boolean(chat) && chat.style.display !== 'none');
        if ((desk.matches || body.dataset.view !== 'hub-detail') && body.classList.contains('lc-drawer')) closeDrawer();
        placeMoved();
        const view = body.dataset.view || 'hubs';
        const hub = get('currentHub');
        const inHub = view === 'hub-detail' && hub;
        const isGroup = inHub && hub.type === 'group';
        setClass('lc-in-hub', Boolean(inHub));
        setClass('lc-in-group', Boolean(isGroup));
        // Masaüstünde lobi/görünüm değişince açık DM kapanır (DM ana alanı doldurur; yoksa eski sohbet ekranda kalır).
        const viewKey = view + ':' + (inHub ? hub.id : '');
        if (lastViewKey && viewKey !== lastViewKey) closeDmIfDesk();
        lastViewKey = viewKey;
        document.querySelectorAll('#lc-lobbies .lc-lobby').forEach((b) => {
            const on = inHub && !isGroup && Number(b.dataset.hubId) === hub.id;
            b.classList.toggle('on', Boolean(on));
            if (on) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current');
        });
        $('lc-home').classList.toggle('on', (!inHub || isGroup) && view !== 'discover');
        $('lc-discover').classList.toggle('on', view === 'discover');
        $('lc-col-title').textContent = inHub && !isGroup ? (hub.name || '') : tr('lc-messages', 'Mesajlar');
        $('lc-add-friend').hidden = Boolean(inHub && !isGroup);
        const groupName = isGroup ? ((typeof groupDisplayName === 'function' ? groupDisplayName(hub) : '') || hub.name || tr('groups-title', 'Grup')) : '';
        const chName = document.querySelector('.lc-head-ch b');
        if (chName) chName.textContent = isGroup ? groupName : tr('lc-chat', 'sohbet');
        const hash = document.querySelector('.lc-head-ch .lc-hash');
        if (hash) hash.hidden = Boolean(isGroup);
        const ctx = $('topbar-context-title');
        if (ctx && desk.matches) ctx.textContent = view === 'discover' ? tr('menu-discover', 'Keşfet') : tr('hubs-title', 'Ana Menü'); // telefonda script.js "← Keşfet" geri düğmesini yazar
        const headHub = $('lc-head-hub');
        if (headHub) headHub.textContent = inHub && !isGroup ? (hub.name || '') : '';
        $('lc-col-menu').hidden = !inHub || isGroup;
        $('lc-hub-sec').hidden = !inHub || isGroup;
        $('lc-home-sec').hidden = Boolean(inHub && !isGroup);
        const addBtn = $('hub-voice-room-add-btn');
        $('lc-room-add').hidden = !addBtn || addBtn.style.display === 'none';

        // Bildirim noktası (üst çubuk rozetini izler)
        const badge = document.querySelector('#notifications-btn .notif-badge, #notifications-badge, #rail-notif-dot');
        const hasNotif = badge && badge.style.display !== 'none' && (badge.textContent.trim() !== '' && badge.textContent.trim() !== '0' || badge.id === 'rail-notif-dot');
        $('lc-bell-dot').hidden = !hasNotif;
        const fdot = $('rail-friends-dot');
        $('lc-home-dot').hidden = !(fdot && fdot.style.display !== 'none');

        // Kullanıcı paneli
        const me = get('currentUser');
        if (me) {
            $('lc-user-name').textContent = me.username || '';
            setAvatar($('lc-user-av'), me);
            setAvatar($('lc-home-av'), me);
        }
        const mode = get('callMode');
        const inVoice = mode === 'hub-room' || mode === 'dm';
        const muted = inVoice && (get('voiceLocalMuted') || get('voiceUserMuted'));
        const deaf = mode === 'hub-room' && get('voiceDeafened');
        const mic = $('lc-mic');
        setHtml(mic, muted ? ICON.micOff : ICON.mic);
        mic.classList.toggle('off', Boolean(muted));
        mic.disabled = !inVoice;
        label('lc-mic', inVoice ? (muted ? tr('lc-unmute', 'Mikrofonu aç') : tr('lc-mute', 'Sessize al')) : tr('lc-mic-idle', 'Mikrofon (sesli odadayken)'));
        const deafBtn = $('lc-deaf');
        setHtml(deafBtn, deaf ? ICON.headOff : ICON.head);
        deafBtn.classList.toggle('off', Boolean(deaf));
        deafBtn.disabled = mode !== 'hub-room';
        label('lc-deaf', deaf ? tr('lc-undeafen', 'Sesi aç') : tr('lc-deafen', 'Sağırlaştır (odadakileri duyma)'));
        $('lc-user-sub').textContent = inVoice ? (muted ? tr('lc-muted', 'Sessizde') : tr('lc-in-voice', 'Seste')) : tr('online-status', 'Çevrimiçi');

        // Ses paneli
        const voice = $('lc-voice');
        voice.hidden = !(mode === 'hub-room' || mode === 'dm' || mode === 'dm-ringing');
        if (!voice.hidden) {
            const roomName = mode === 'hub-room' ? (get('currentVoiceRoomName') || '') : (get('outgoingCallToUsername') || '');
            $('lc-voice-state').textContent = mode === 'dm-ringing' ? tr('lc-ringing', 'Aranıyor…') : tr('lc-voice-connected', 'Sesli bağlı');
            $('lc-voice-room').textContent = roomName;
        }
    }
    function setClass(name, on) { if (body.classList.contains(name) !== Boolean(on)) body.classList.toggle(name, Boolean(on)); }
    function setHtml(el, html) { if (el.dataset.lcHtml !== html) { el.dataset.lcHtml = html; el.innerHTML = html; } }
    let lastViewKey = '';
    function setAvatar(el, user) {
        if (!el) return;
        const src = user.avatar_data && /^data:image\//.test(user.avatar_data) ? user.avatar_data : '';
        if (el.dataset.src === src && el.dataset.name === user.username) return;
        el.dataset.src = src; el.dataset.name = user.username || '';
        el.textContent = '';
        if (src) { const img = document.createElement('img'); img.src = src; img.alt = ''; el.appendChild(img); }
        else el.textContent = String(user.username || '?').charAt(0).toUpperCase();
    }

    let lastBodyState = '';
    new MutationObserver(() => {
        const state = body.className + '|' + (body.dataset.view || '');
        if (state === lastBodyState) return;
        lastBodyState = state;
        sync();
    }).observe(body, { attributes: true, attributeFilter: ['data-view', 'class'] });
    const chatScreen = $('chat-screen');
    if (chatScreen) new MutationObserver(sync).observe(chatScreen, { attributes: true, attributeFilter: ['style'] });
    ['call-overlay', 'call-mini-bar', 'hub-voice-room-add-btn', 'rail-friends-dot', 'rail-notif-dot', 'hub-in-room-pill'].forEach((id) => {
        const el = $(id);
        if (el) new MutationObserver(sync).observe(el, { attributes: true, attributeFilter: ['style', 'class'] });
    });
    const callMuteBtn = $('call-mute-btn');
    if (callMuteBtn) new MutationObserver(sync).observe(callMuteBtn, { attributes: true, childList: true, subtree: true });
    desk.addEventListener('change', sync);
    document.addEventListener('click', () => setTimeout(sync, 0), true);
    setInterval(sync, 2000); // ses durumu ve kullanıcı bilgisi için yedek eşitleme (ucuz)
    if (window.__sauranHubs) renderLobbies();
    sync();
})();
