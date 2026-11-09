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
        pen: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4zM14 6l4 4"/></svg>',
        trash: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>',
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
    // "Diğer" menüsü yeni görünümde: gruplar, renkli simge kutuları ve kısa açıklamalar. Düğmeler (ve işleyicileri) aynen kalır,
    // yalnızca içerikleri ve sıraları değişir; yönetim grubu yalnızca yetkili hesapta görünür.
    const MI = {
        key: '<path d="M14.5 9.5a4 4 0 1 0-4.6 4L4 19.5V22h3v-2h2v-2h2l1.4-1.4A4 4 0 0 0 14.5 9.5z"/><circle cx="15.5" cy="8.5" r="1"/>',
        bulb: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2V16h5v-.1c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z"/>',
        shield: '<path d="M12 3l7 3v6c0 4.5-3 7.8-7 9-4-1.2-7-4.5-7-9V6z"/>',
        gift: '<path d="M4 11h16v9H4zM3 7h18v4H3zM12 7v13M12 7c-1.5-3-5-3.5-5-1.2C7 7 9.5 7 12 7zm0 0c1.5-3 5-3.5 5-1.2C17 7 14.5 7 12 7z"/>',
        bag: '<path d="M5 8h14l-1 12H6zM9 8V6a3 3 0 0 1 6 0v2"/>',
        box: '<path d="M4 7.5l8-4 8 4v9l-8 4-8-4zM4 7.5l8 4 8-4M12 11.5v9"/>',
        gem: '<path d="M6 4h12l3 5-9 11L3 9zM3 9h18M9 4l3 16 3-16"/>',
        spark: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.7 1.8 1.8.7-1.8.7L19 21l-.7-1.8-1.8-.7 1.8-.7z"/>',
        gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/>'
    };
    const MENU_GROUPS = [
        { title: tr('lc-menu-community', 'Topluluk'), items: [
            ['hub-join-open-btn', 'key', 'cyan', tr('lc-menu-join-sub', 'Bir lobinin davet kodunu gir')],
            ['feedback-open-btn', 'bulb', 'amber', tr('lc-menu-feedback-sub', 'Fikrini Sauran ekibine ilet')]] },
        { title: tr('lc-menu-store', 'Mağaza ve görünüm'), items: [
            ['market-open-btn', 'bag', 'violet', tr('lc-menu-market-sub', 'Çerçeve, efekt ve daha fazlası')],
            ['inventory-open-btn', 'box', 'orange', tr('lc-menu-inventory-sub', 'Sahip olduğun ürünler')],
            ['subs-open-btn', 'gem', 'cyan', tr('lc-menu-subs-sub', 'Plus ve Premium')],
            ['plusfx-open-btn', 'spark', 'violet', tr('lc-menu-custom-sub', 'Profil ve sohbet görünümün')]] },
        { title: tr('lc-menu-admin', 'Yönetim'), admin: true, items: [
            ['admin-panel-link', 'shield', 'blue', tr('lc-menu-admin-sub', 'Platform yönetim paneli')],
            ['gift-tool-link', 'gift', 'pink', tr('lc-menu-gift-sub', 'Kullanıcılara hediye gönder')]] }
    ];
    if (menuDropdown) {
        menuDropdown.classList.add('lc-menu');
        const dress = (id, icon, tone, sub) => {
            const el = $(id);
            if (!el) return null;
            const label = el.querySelector('span') || document.createElement('span');
            [...el.childNodes].forEach((n) => { if (n.nodeType === 3) n.remove(); }); // emoji metni
            const ico = document.createElement('span');
            ico.className = `lc-mi-ico tone-${tone}`;
            ico.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${MI[icon]}</svg>`;
            const txt = document.createElement('span');
            txt.className = 'lc-mi-txt';
            const b = document.createElement('b');
            b.appendChild(label);
            const small = document.createElement('small');
            small.textContent = sub;
            txt.append(b, small);
            el.prepend(ico, txt);
            return el;
        };
        MENU_GROUPS.forEach((g) => {
            const box = document.createElement('div');
            box.className = 'lc-mi-group' + (g.admin ? ' lc-mi-admin' : '');
            const head = document.createElement('div');
            head.className = 'lc-mi-head';
            head.textContent = g.title;
            box.appendChild(head);
            g.items.forEach(([id, icon, tone, sub]) => { const el = dress(id, icon, tone, sub); if (el) box.appendChild(el); });
            menuDropdown.appendChild(box);
        });
        const settings = dress('settings-btn', 'gear', 'gray', tr('lc-menu-settings-sub', 'Hesap, bildirim, ses ve gizlilik'));
        if (settings) { const foot = document.createElement('div'); foot.className = 'lc-mi-foot'; foot.appendChild(settings); menuDropdown.appendChild(foot); }
    }
    // ── Küçük pencereler: ortak yeni görünüm ──────────────────────────────────────────────
    // Başlıktaki emoji yerine renkli simge kutusu + başlık + bir satırlık açıklama; kutu, giriş alanları ve düğmeler
    // layout-c.css'teki .lc-modal kurallarıyla tek tip görünür. İçerik, kimlikler ve işleyiciler değişmez.
    const MODAL_ICONS = {
        ...MI,
        home: '<path d="M4 11l8-7 8 7v9H4zM10 20v-6h4v6"/><path d="M19 3v4M17 5h4"/>',
        userplus: '<circle cx="10" cy="8" r="4"/><path d="M2 20c1.5-4 4.5-5.5 8-5.5S16.5 16 18 20M19 8v6M16 11h6"/>',
        people: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c1-3.5 3.5-5 6.5-5s5.5 1.5 6.5 5M16 4.5a3.5 3.5 0 0 1 0 7M18 15c2 .6 3.2 2.2 3.8 5"/>'
    };
    const MODALS = [
        ['hub-join-modal', 'key', 'cyan', tr('lc-modal-join-sub', 'Arkadaşının paylaştığı davet kodunu yapıştır.')],
        ['feedback-modal', 'bulb', 'amber', tr('lc-modal-feedback-sub', 'Önerin panoda görünür; diğer kullanıcılar oylayabilir.')],
        ['hub-create-modal', 'home', 'violet', ''],
        ['group-pick-modal', 'people', 'violet', tr('lc-modal-group-sub', 'Arkadaşlarını seç, birlikte sohbet edin.')],
        ['inventory-modal', 'box', 'orange', '']
    ];
    // Başlıktaki baştaki emoji/simge karakterlerini atar (çeviri uygulanınca geri gelirse yine atılır).
    const stripLead = (el) => {
        if (!el) return;
        const clean = () => {
            const txt = el.textContent || '';
            const next = txt.replace(/^[^\p{L}\p{N}]+/u, '');
            if (next !== txt) el.textContent = next;
        };
        clean();
        new MutationObserver(clean).observe(el, { childList: true, characterData: true, subtree: true });
    };
    function dressModal(id, icon, tone, sub) {
        const ov = $(id);
        const box = ov && ov.querySelector('.modal-box');
        const head = box && box.querySelector('.modal-header');
        if (!head || head.dataset.lcDressed) return;
        head.dataset.lcDressed = '1';
        box.classList.add('lc-modal');
        const title = head.querySelector('span');
        stripLead(title);
        const ico = document.createElement('span');
        ico.className = `lc-mi-ico lc-mh-ico tone-${tone}`;
        ico.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${MODAL_ICONS[icon]}</svg>`;
        const txt = document.createElement('span');
        txt.className = 'lc-mh-txt';
        if (title) { title.classList.add('lc-mh-title'); txt.appendChild(title); }
        // Açıklama: verilmediyse pencerenin kendi açıklama paragrafı başlığa taşınır (hub-create-desc, mk-sub).
        const own = box.querySelector('.hub-create-desc, .mk-sub');
        if (sub || own) {
            const small = document.createElement('small');
            if (sub) small.textContent = sub; else { small.appendChild(own); own.classList.add('lc-mh-own'); }
            txt.appendChild(small);
        }
        head.prepend(ico, txt);
        const close = head.querySelector('button');
        if (close) { close.classList.add('lc-mh-close'); close.setAttribute('aria-label', tr('close', 'Kapat')); }
    }
    MODALS.forEach(([id, icon, tone, sub]) => dressModal(id, icon, tone, sub));
    // Arkadaş ekle penceresinin kendi büyük başlığı var: yalnızca simgesi yenilenir.
    const faIcon = document.querySelector('#friend-add-modal .friend-add-hero-icon');
    if (faIcon) { faIcon.className = 'lc-mi-ico lc-mh-ico tone-cyan friend-add-hero-icon'; faIcon.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${MODAL_ICONS.userplus}</svg>`; }
    ['friend-add-modal', 'other-profile-modal', 'profile-modal'].forEach((id) => $(id)?.querySelector('.modal-box')?.classList.add('lc-modal', 'lc-modal-' + id));
    // ── Küçük açılır menüler (ek ekle, Bir şey başlat): Diğer menüsüyle aynı satır görünümü ──
    const POP_ICONS = {
        camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
        image: '<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><circle cx="9" cy="10" r="1.8"/><path d="M20 16l-5-5-8 8.5"/>',
        clip: '<path d="M20 11.5l-8 8a5 5 0 0 1-7-7l8.5-8.5a3.3 3.3 0 0 1 4.7 4.7L9.8 17a1.7 1.7 0 0 1-2.4-2.4l7.4-7.4"/>',
        poll: '<path d="M5 20V10M12 20V4M19 20v-7"/>',
        pin: '<path d="M9 4h6l-1 6 3 3v1H7v-1l3-3zM12 14v6"/>'
    };
    function dressPopItem(el, icon, tone, sub) {
        if (!el || el.dataset.lcDressed) return;
        el.dataset.lcDressed = '1';
        const label = el.querySelector('span') || document.createElement('span');
        [...el.childNodes].forEach((n) => { if (n.nodeType === 3) n.remove(); });
        const ico = document.createElement('span');
        ico.className = `lc-mi-ico tone-${tone}`;
        ico.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${POP_ICONS[icon]}</svg>`;
        const txt = document.createElement('span');
        txt.className = 'lc-mi-txt';
        const b = document.createElement('b');
        b.appendChild(label);
        const small = document.createElement('small');
        small.textContent = sub;
        txt.append(b, small);
        el.prepend(ico, txt);
    }
    ['hub-attach-menu', 'dm-attach-menu'].forEach((id) => {
        const menu = $(id);
        if (!menu) return;
        menu.classList.add('lc-pop');
        dressPopItem(menu.querySelector('[data-attach="camera"]'), 'camera', 'cyan', tr('lc-attach-camera-sub', 'Fotoğraf ya da video çek'));
        dressPopItem(menu.querySelector('[data-attach="gallery"]'), 'image', 'violet', tr('lc-attach-gallery-sub', 'Cihazındaki fotoğraf ve videolar'));
        dressPopItem(menu.querySelector('[data-attach="file"]'), 'clip', 'orange', tr('lc-attach-file-sub', 'Belge, ses ya da başka bir dosya'));
    });
    const startMenu = $('hub-start-menu');
    if (startMenu) {
        startMenu.classList.add('lc-pop');
        dressPopItem(startMenu.querySelector('[data-action="poll"]'), 'poll', 'amber', tr('lc-start-poll-sub', 'Seçenekler sun, lobi oylasın'));
        dressPopItem(startMenu.querySelector('[data-action="share"]'), 'pin', 'cyan', tr('lc-start-share-sub', 'Bağlantı ya da duyuru paylaş'));
    }

    // Lobi bilgisi penceresi shell.js tarafından açılışta üretilir: göründüğünde sınıf eklenir.
    new MutationObserver(() => { const b = document.querySelector('#hub-info-modal .modal-box'); if (b && !b.classList.contains('lc-modal')) b.classList.add('lc-modal', 'lc-modal-hub-info'); })
        .observe(document.body, { childList: true });

    // Yönetim grubu yalnızca bağlantılarından biri görünürse gösterilir (görünürlüğü script.js hesaba göre ayarlar).
    const syncAdminGroup = () => {
        const grp = menuDropdown && menuDropdown.querySelector('.lc-mi-admin');
        if (!grp) return;
        grp.hidden = ![...grp.querySelectorAll('.topbar-menu-item')].some((a) => a.style.display !== 'none');
    };
    $('lc-more').addEventListener('click', (e) => {
        e.stopPropagation();
        syncAdminGroup();
        body.classList.add('lc-menu-from-rail');
        // Masaüstünde düğme alttaki dokta: menü düğmenin hemen üstünde, ortalanmış açılır (ekran kenarına taşmadan).
        const r = e.currentTarget.getBoundingClientRect();
        body.style.setProperty('--lc-menu-x', `${Math.round(Math.min(Math.max(8, r.left + r.width / 2 - 120), window.innerWidth - 248))}px`);
        $('topbar-menu-btn')?.click();
    });
    $('topbar-menu-btn')?.addEventListener('click', (e) => { syncAdminGroup(); if (e.isTrusted) body.classList.remove('lc-menu-from-rail'); }, true);

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
                <div class="lc-lbl lc-rooms-lbl"><span>${tr('channel-text-label', 'Metin kanalları')}</span><button type="button" class="lc-icon-btn lc-lbl-btn" id="lc-ch-add" hidden>${ICON.plus}</button></div>
                <div id="lc-channels" class="lc-channels" role="list"></div>
                <div class="lc-lbl lc-rooms-lbl"><span>${tr('lc-voice-rooms-label', 'Ses odaları')}</span><button type="button" class="lc-icon-btn lc-lbl-btn" id="lc-room-add">${ICON.plus}</button></div>
                <div id="lc-rooms-slot" class="lc-rooms-slot"></div>
            </div>
            <div class="lc-home-sec" id="lc-home-sec"><div id="lc-pending-slot" class="lc-pending-slot"></div><div id="lc-groups-slot" class="lc-groups-slot"></div><div id="lc-dm-slot" class="lc-dm-slot"></div></div>
        </div>
        <div class="lc-voice" id="lc-voice" hidden>
            <div class="lc-voice-row" id="lc-voice-row">
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

    // ── Masaüstü alt dok (kimlik seçimi 3F): telefondaki alt çubuğa benzer, sohbet alanının altında ortada yüzer ──
    // Keşfet / Bildirim / Diğer (raydan), ses paneli (sütundan), Sen ve Ayarlar (kullanıcı panelinden) masaüstünde buraya TAŞINIR
    // (bkz. MOVES); telefonda yerlerine döner. Mesajlar ve Arkadaşlar düğmeleri yalnızca dokta vardır.
    const dock = document.createElement('nav');
    dock.id = 'lc-dock';
    dock.className = 'lc-dock';
    dock.setAttribute('aria-label', tr('lc-dock', 'Hızlı gezinme'));
    dock.innerHTML = `
        <div class="lc-dock-group" id="lc-dock-nav">
            <button type="button" class="lc-ico lc-tool" id="lc-dock-dms">${ICON.chat}<span class="lc-name" aria-hidden="true">${tr('lc-dock-dms', 'Mesajlar')}</span></button>
            <button type="button" class="lc-ico lc-tool" id="lc-dock-friends">${ICON.members}<span class="lc-name" aria-hidden="true">${tr('menu-friends', 'Arkadaşlar')}</span></button>
        </div>
        <div class="lc-dock-group lc-dock-voice" id="lc-dock-voice"></div>
        <div class="lc-dock-group" id="lc-dock-me"></div>`;
    document.body.appendChild(dock);
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
    label('lc-ch-add', tr('channel-add', 'Metin kanalı aç'));
    label('lc-dock-dms', tr('lc-dock-dms-full', 'Mesajlar: özel sohbetler ve gruplar'));
    label('lc-dock-friends', tr('menu-friends', 'Arkadaşlar'));
    $('lc-user-id').dataset.dockLabel = tr('lc-dock-me', 'Sen');
    $('lc-gear').dataset.dockLabel = tr('menu-settings', 'Ayarlar');
    // Mesajlar: Ana sayfaya geçer ve özel sohbet listesini gösterir; Arkadaşlar: Ana sayfadaki arkadaş sayfası.
    const flash = (el) => { if (!el) return; el.classList.remove('lc-flash'); void el.offsetWidth; el.classList.add('lc-flash'); setTimeout(() => el.classList.remove('lc-flash'), 1000); };
    $('lc-dock-dms').addEventListener('click', () => {
        $('lc-home').click();
        requestAnimationFrame(() => { const slot = $('lc-dm-slot'); slot?.scrollIntoView({ block: 'start', behavior: 'smooth' }); flash(slot); });
    });
    $('lc-dock-friends').addEventListener('click', () => {
        $('lc-home').click();
        requestAnimationFrame(() => { const page = $('lc-friends'); page?.querySelector('.lcf-body')?.scrollTo({ top: 0, behavior: 'smooth' }); flash(page?.querySelector('.lcf-groups')); });
    });
    $('lc-ch-add').addEventListener('click', () => { if (typeof createChannelPrompt === 'function') createChannelPrompt(); });

    // ── Metin kanalları listesi (script.js 'sauran:channels' duyurusunda yeniden çizilir) ──
    function renderChannels() {
        const box = $('lc-channels');
        if (!box) return;
        const hub = get('currentHub');
        const list = hub && hub.type !== 'group' && Array.isArray(hub.channels) ? hub.channels : [];
        const cur = typeof currentChannelId !== 'undefined' ? currentChannelId : null;
        const manage = typeof canManageChannels === 'function' && canManageChannels();
        $('lc-ch-add').hidden = !manage;
        box.textContent = '';
        list.forEach((c) => {
            const row = document.createElement('div');
            row.className = 'lc-chan' + (c.id === cur ? ' on' : '');
            row.setAttribute('role', 'listitem');
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'lc-chan-btn';
            if (c.id === cur) btn.setAttribute('aria-current', 'true');
            btn.innerHTML = `<span class="lc-chat-ico">${ICON.chat}</span>`;
            const name = document.createElement('span');
            name.className = 'lc-chan-name';
            name.textContent = c.name;
            btn.appendChild(name);
            const unread = c.id !== cur && typeof channelUnread === 'function' ? channelUnread(c.id) : null;
            if (unread && (unread.count || unread.mentions)) {
                row.classList.add('has-unread');
                const badge = document.createElement('span');
                badge.className = 'lc-chan-badge' + (unread.mentions ? '' : ' soft');
                badge.textContent = unread.mentions ? `@${unread.mentions > 99 ? '99+' : unread.mentions}` : (unread.count > 99 ? '99+' : String(unread.count));
                btn.appendChild(badge);
            }
            btn.addEventListener('click', () => { if (typeof switchHubChannel === 'function') switchHubChannel(c.id); });
            row.appendChild(btn);
            if (manage) {
                const ren = document.createElement('button');
                ren.type = 'button';
                ren.className = 'lc-chan-act';
                ren.innerHTML = ICON.pen;
                ren.title = tr('channel-rename', 'Adını değiştir');
                ren.setAttribute('aria-label', `${c.name}: ${ren.title}`);
                ren.addEventListener('click', () => renameChannelPrompt(c.id));
                row.appendChild(ren);
                if (list.length > 1) {
                    const del = document.createElement('button');
                    del.type = 'button';
                    del.className = 'lc-chan-act lc-chan-del';
                    del.innerHTML = ICON.trash;
                    del.title = tr('channel-delete', 'Kanalı sil');
                    del.setAttribute('aria-label', `${c.name}: ${del.title}`);
                    del.addEventListener('click', () => deleteChannelConfirm(c.id));
                    row.appendChild(del);
                }
            }
            box.appendChild(row);
        });
        sync();
    }
    document.addEventListener('sauran:channels', renderChannels);
    $('lc-room-add').addEventListener('click', () => $('hub-voice-room-add-btn')?.click());
    $('lc-voice-open').addEventListener('click', () => $('call-mini-expand-btn')?.click());
    $('lc-voice-leave').addEventListener('click', () => ($('call-leave-btn') || $('call-mini-leave-btn'))?.click());
    $('lc-mic').addEventListener('click', () => { if (get('callMode') === 'hub-room' || get('callMode') === 'dm') { if (typeof toggleLocalMute === 'function') toggleLocalMute(); sync(); } });
    $('lc-deaf').addEventListener('click', () => { if (get('callMode') === 'hub-room') { $('call-speaker-btn')?.click(); setTimeout(sync, 50); } });
    $('lc-gear').addEventListener('click', () => $('settings-btn')?.click());
    $('lc-user-id').addEventListener('click', () => $('rail-profile')?.click());

    // Masaüstünde mevcut öğeler sütuna taşınır; dar ekranda eski yerlerine döner (işleyiciler öğeyle birlikte gelir).
    const MOVES = [ // [öğe, yuva, telefonda da taşınır]
        ['lc-discover', 'lc-dock-nav', false],
        ['lc-bell', 'lc-dock-nav', false],
        ['lc-more', 'lc-dock-nav', false],
        ['lc-voice', 'lc-dock-voice', false],
        ['lc-mic', 'lc-voice-row', false],
        ['lc-deaf', 'lc-voice-row', false],
        ['lc-user-id', 'lc-dock-me', false],
        ['lc-gear', 'lc-dock-me', false],
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
        ch.innerHTML = `<span class="lc-hash lc-hash-ico">${ICON.chat}</span><span class="lc-head-txt"><b>${tr('lc-chat', 'sohbet')}</b><span class="lc-head-hub" id="lc-head-hub"></span></span>`;
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
    document.addEventListener('sauran:channel-picked', () => closeDrawer());
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
        const channelName = !isGroup && typeof currentChannel === 'function' ? (currentChannel() || {}).name : '';
        if (chName) chName.textContent = isGroup ? groupName : (channelName || tr('lc-chat', 'sohbet'));
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
