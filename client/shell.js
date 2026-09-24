// Sauran — uygulama kabuğu (sol ray + lobi listesi).
// Yalnızca görünüm/gezinme bağlar: veriyi mevcut /api/hubs uç noktasından okur,
// eylemleri mevcut düğmelere ve openHub()/switchToView() işlevlerine devreder.
// Backend, oturum ve mesaj mantığına dokunmaz. script.js'ten SONRA yüklenir.
(function () {
    'use strict';

    const $ = (id) => document.getElementById(id);
    const nav = $('lobby-nav');
    const list = $('lobby-nav-list');
    if (!nav || !list) return;

    const tr = (key, fallback) => {
        try { const v = t(key); return v && v !== key ? v : fallback; } catch (_) { return fallback; }
    };
    const escapeText = (s) => String(s == null ? '' : s);
    let lastHubs = [];

    // ── Erişilebilir adlar (yalnızca ikon içeren düğmeler) ──────────────
    function labelButtons() {
        const map = {
            'rail-home': ['hubs-title', 'Ana Menü'],
            'rail-notifications': ['menu-notifications', 'Bildirimler'],
            'rail-friend': ['menu-add-friend', 'Arkadaş Ekle'],
            'rail-settings': ['menu-settings', 'Ayarlar'],
            'rail-profile': ['menu-settings', 'Profilim'],
            'lobby-nav-create': ['lobby-create', 'Lobi oluştur'],
            'lobby-nav-toggle': ['lobby-nav-open', 'Lobileri aç']
        };
        Object.keys(map).forEach((id) => {
            const el = $(id);
            if (!el) return;
            const label = tr(map[id][0], map[id][1]);
            el.setAttribute('aria-label', label);
            el.setAttribute('title', label);
        });
        const rp = $('rail-profile');
        if (rp) { rp.setAttribute('aria-label', tr('profile', 'Profilim')); }
    }

    // ── Lobi listesi ────────────────────────────────────────────────────
    function activeHubId() {
        try { return typeof currentHub !== 'undefined' && currentHub ? currentHub.id : null; } catch (_) { return null; }
    }

    // Lobi fotoğrafı (yuvarlak) ya da ad baş harfi
    function lobbyAvatar(imageData, name, cls) {
        const el = document.createElement('span');
        el.className = cls;
        if (imageData) {
            const img = document.createElement('img');
            img.src = imageData; img.alt = ''; img.decoding = 'async';
            el.appendChild(img);
        } else {
            el.textContent = String(name || '?').trim().charAt(0).toUpperCase() || '?';
        }
        return el;
    }

    function renderNav() {
        const active = activeHubId();
        list.textContent = '';
        const item = (hub) => {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'lobby' + (hub.id === active ? ' active' : '');
            b.dataset.hubId = hub.id;
            if (hub.id === active) b.setAttribute('aria-current', 'true');
            const mark = lobbyAvatar(hub.image_data, hub.name, 'mark lobby-avatar');
            const name = document.createElement('span');
            name.className = 'lobby-name';
            name.textContent = escapeText(hub.name);
            const n = document.createElement('span');
            n.className = 'lobby-count';
            n.textContent = String(hub.member_count == null ? '' : hub.member_count);
            b.append(mark, name, n);
            b.addEventListener('click', () => {
                closeDrawer();
                if (typeof openHub === 'function') openHub(hub.id);
            });
            return b;
        };
        const owned = lastHubs.filter((h) => h.is_owner);
        const joined = lastHubs.filter((h) => !h.is_owner);
        owned.forEach((h) => list.appendChild(item(h)));
        if (joined.length) {
            const sub = document.createElement('div');
            sub.className = 'lobby-nav-sub';
            sub.textContent = tr('lobbies-joined', 'Katıldığım lobiler');
            list.appendChild(sub);
            joined.forEach((h) => list.appendChild(item(h)));
        }
    }

    async function fetchHubs() {
        try {
            const r = await fetch('/api/hubs', { credentials: 'include' });
            const d = await r.json();
            if (d && d.success) { lastHubs = d.hubs || []; renderNav(); }
        } catch (_) { /* sessiz: ana liste zaten hatayı gösterir */ }
    }

    // ── Mevcut işlevlere bağlanma (sarmalama; davranış aynen korunur) ───
    function wrap(name, after) {
        const orig = window[name];
        if (typeof orig !== 'function') return;
        window[name] = function () {
            const out = orig.apply(this, arguments);
            try { after.apply(this, arguments); } catch (_) {}
            return out;
        };
    }
    wrap('loadHubList', fetchHubs);
    wrap('switchToView', function () { renderNav(); syncMainState(); });

    // Ana menü: "Lobilerim" / "Katıldığım lobiler" başlıkları açılır düğme; tıklayınca liste aşağı açılır
    (function hubListAccordions() {
        const groups = [['hub-list-grid-owned', 'owned'], ['hub-list-grid-joined', 'joined']];
        groups.forEach(([gridId, key]) => {
            const grid = $(gridId);
            if (!grid || !grid.parentElement) return;
            const title = grid.parentElement.querySelector('.hub-list-subtitle');
            if (!title) return;
            let open = false;
            try { open = localStorage.getItem('sauran.menu.' + key) === '1'; } catch (_) {}
            title.setAttribute('role', 'button');
            title.setAttribute('tabindex', '0');
            title.classList.add('hub-list-toggle');
            const apply = () => {
                title.setAttribute('aria-expanded', open ? 'true' : 'false');
                grid.style.display = open ? '' : 'none';
                title.classList.toggle('open', open);
            };
            const count = () => { title.setAttribute('data-count', String(grid.children.length)); };
            const toggle = () => {
                open = !open;
                try { localStorage.setItem('sauran.menu.' + key, open ? '1' : '0'); } catch (_) {}
                apply();
            };
            title.addEventListener('click', toggle);
            title.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
            new MutationObserver(count).observe(grid, { childList: true });
            count();
            apply();
        });
    })();

    // Lobi bilgi penceresi (üst çubuktaki lobi fotoğrafına tıklayınca)
    function openHubInfo() {
        let hub = null;
        try { hub = typeof currentHub !== 'undefined' ? currentHub : null; } catch (_) { hub = null; }
        if (!hub) return;
        let ov = $('hub-info-modal');
        if (!ov) {
            ov = document.createElement('div');
            ov.id = 'hub-info-modal'; ov.className = 'modal-overlay'; ov.style.display = 'none';
            ov.addEventListener('click', (e) => { if (e.target === ov) closeHubInfo(); });
            document.body.appendChild(ov);
        }
        const members = Array.isArray(hub.members) ? hub.members : [];
        const owner = members.find((m) => m.user_id === hub.created_by);
        const online = members.filter((m) => m.online).length;
        let created = '';
        if (hub.created_at) {
            const d = new Date(String(hub.created_at).replace(' ', 'T') + 'Z');
            if (!isNaN(d)) created = d.toLocaleDateString(document.documentElement.lang || undefined, { year: 'numeric', month: 'long', day: 'numeric' });
        }
        const box = document.createElement('div');
        box.className = 'modal-box hub-info-box';
        box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true');
        const head = document.createElement('div');
        head.className = 'hub-info-head';
        head.appendChild(lobbyAvatar(hub.image_data, hub.name, 'lobby-avatar hub-info-avatar'));
        const h = document.createElement('h3'); h.textContent = hub.name || '';
        head.appendChild(h);
        box.appendChild(head);
        if (hub.description && String(hub.description).trim()) {
            const p = document.createElement('p'); p.className = 'hub-info-desc'; p.textContent = String(hub.description);
            box.appendChild(p);
        }
        const rows = [
            [tr('hub-info-owner', 'Sahibi'), owner ? owner.username : (hub.is_owner ? tr('voice-room-you', 'Sen') : '—')],
            [tr('hub-info-members', 'Üye'), String(members.length)],
            [tr('hub-info-online', 'Çevrimiçi'), String(online)],
            [tr('hub-info-created', 'Oluşturulma'), created || '—']
        ];
        const dl = document.createElement('dl'); dl.className = 'hub-info-rows';
        rows.forEach(([k, v]) => {
            const dt = document.createElement('dt'); dt.textContent = k;
            const dd = document.createElement('dd'); dd.textContent = v;
            dl.append(dt, dd);
        });
        box.appendChild(dl);
        const close = document.createElement('button');
        close.type = 'button'; close.className = 'hub-info-close'; close.textContent = tr('close', 'Kapat');
        close.addEventListener('click', closeHubInfo);
        box.appendChild(close);
        ov.textContent = '';
        ov.appendChild(box);
        ov.style.display = 'flex';
        close.focus();
    }
    function closeHubInfo() { const ov = $('hub-info-modal'); if (ov) ov.style.display = 'none'; }
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeHubInfo(); });

    // Üst çubuğun ortasında açık lobinin yuvarlak (cam) fotoğrafı
    function updateTopbarBadge() {
        const bar = document.querySelector('.topbar');
        if (!bar) return;
        let badge = $('topbar-lobby-badge');
        if (!badge) {
            badge = document.createElement('button');
            badge.type = 'button';
            badge.id = 'topbar-lobby-badge'; badge.className = 'topbar-lobby-badge';
            badge.addEventListener('click', openHubInfo);
            bar.appendChild(badge);
        }
        let hub = null;
        try { hub = typeof currentHub !== 'undefined' ? currentHub : null; } catch (_) { hub = null; }
        badge.textContent = '';
        if (!hub) { badge.style.display = 'none'; badge.removeAttribute('aria-label'); return; }
        badge.style.display = 'grid';
        badge.setAttribute('aria-label', tr('hub-info-title', 'Lobi bilgisi') + ': ' + (hub.name || ''));
        badge.title = tr('hub-info-title', 'Lobi bilgisi');
        badge.appendChild(lobbyAvatar(hub.image_data, hub.name, 'lobby-avatar lobby-avatar-lg'));
    }

    // Ana içerik: lobi seçili değilken sakin bir boş durum
    function syncMainState() {
        const chat = document.querySelector('#chat-screen');
        if (!chat) return;
        const inHub = activeHubId() != null;
        chat.classList.toggle('in-hub', inHub);
        updateTopbarBadge();
        const home = $('rail-home');
        if (home) home.classList.toggle('on', !inHub);
    }

    // ── Ray düğmeleri: mevcut düğmelere devret ─────────────────────────
    const delegate = {
        notifications: 'notifications-btn',
        friend: 'friend-add-open-btn',
        settings: 'settings-btn',
        profile: 'profile-btn'
    };
    document.querySelectorAll('[data-rail]').forEach((btn) => {
        btn.addEventListener('click', () => {
            const k = btn.dataset.rail;
            if (k === 'home') {
                if (typeof switchToView === 'function') { switchToView('hubs'); }
                if (typeof loadHubList === 'function') loadHubList();
                return;
            }
            const target = $(delegate[k]);
            if (target) target.click();
        });
    });
    const createBtn = $('lobby-nav-create');
    if (createBtn) createBtn.addEventListener('click', () => {
        closeDrawer();
        if (typeof openHubCreateModal === 'function') openHubCreateModal();
    });

    // ── Küçük ekran: lobi listesi çekmece ──────────────────────────────
    const toggle = $('lobby-nav-toggle');
    function closeDrawer() { document.body.classList.remove('lobby-drawer-open'); if (toggle) toggle.setAttribute('aria-expanded', 'false'); }
    if (toggle) {
        toggle.setAttribute('aria-expanded', 'false');
        toggle.addEventListener('click', () => {
            const open = document.body.classList.toggle('lobby-drawer-open');
            toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
        });
    }
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeDrawer(); });
    document.addEventListener('click', (e) => {
        if (document.body.classList.contains('lobby-drawer-open') && !e.target.closest('#lobby-nav, #lobby-nav-toggle')) closeDrawer();
    });

    // ── Arkadaşlar paneli: lobi listesinin altına taşı (sağ panel yok) ──
    const friends = $('friends-sidebar');
    if (friends) nav.appendChild(friends);

    // ── Üye paneli düğmesi: kenar çentiği yerine başlıkta sade ikon ─────
    const mb = $('hub-members-toggle-btn'), hdr = document.querySelector('.hub-detail-header'), setBtn = $('hub-settings-open-btn');
    if (mb && hdr) {
        mb.classList.add('hub-icon-btn', 'members-in-header');
        mb.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="9" cy="8" r="3.5"/><path d="M2.500 20c1-3.500 3.500-5 6.500-5s5.500 1.500 6.500 5M16 4.500a3.500 3.500 0 0 1 0 7M18 15c2 .6 3.200 2.200 3.800 5"/></svg>';
        mb.setAttribute('aria-label', tr('members', 'Üyeler'));
        hdr.insertBefore(mb, setBtn || null);
    }

    // ── Bildirim noktası / avatar: mevcut öğelerden yansıt ─────────────
    function mirror() {
        const badge = $('notifications-badge') || $('topbar-menu-badge');
        const dot = $('rail-notif-dot');
        if (dot && badge) {
            const shown = badge.style.display !== 'none' && (badge.textContent || '').trim() !== '0';
            dot.style.display = shown ? 'block' : 'none';
        }
        const av = $('profile-avatar'), img = $('profile-avatar-img'), ri = $('rail-avatar-initial'), rp = $('rail-profile');
        if (ri && av) {
            ri.textContent = (av.textContent || '').trim();
            if (rp && img && img.style.display !== 'none' && img.src) {
                rp.style.backgroundImage = 'url("' + img.src.replace(/"/g, '%22') + '")';
                ri.style.display = 'none';
            } else if (rp) { rp.style.backgroundImage = ''; ri.style.display = ''; }
        }
    }
    const mo = new MutationObserver(mirror);
    ['notifications-badge', 'topbar-menu-badge', 'profile-avatar', 'profile-avatar-img'].forEach((id) => {
        const el = $(id);
        if (el) mo.observe(el, { attributes: true, childList: true, characterData: true, subtree: true });
    });

    // Lobi seçili değilken ana içerikte sakin bir yönlendirme
    const hv = $('hub-list-view');
    if (hv && !$('home-empty')) {
        const p = document.createElement('p');
        p.id = 'home-empty'; p.className = 'home-empty'; p.setAttribute('data-i18n', 'select-lobby');
        p.textContent = tr('select-lobby', 'Bir lobi seç');
        hv.appendChild(p);
    }

    // Lobi oluştur: "Vazgeç" mevcut kapatma düğmesine devreder
    const cancel = $('hub-create-cancel-btn'), closeC = $('hub-create-close-btn');
    if (cancel && closeC) cancel.addEventListener('click', () => closeC.click());

    // Sesli oda: ikon düğmelerine dile göre erişilebilir ad; başlık altında "Bağlı · N"
    function voiceLabels() {
        const m = { 'call-screenshare-btn': ['voice-screenshare', 'Ekran paylaş'], 'call-minimize-btn': ['voice-minimize', 'Küçült'], 'call-leave-btn': ['call-leave', 'Ayrıl'] };
        Object.keys(m).forEach((id) => { const el = $(id); if (el) { const l = tr(m[id][0], m[id][1]); el.setAttribute('aria-label', l); el.title = l; } });
    }
    const dur = $('call-header-duration');
    if (dur && !$('call-header-sub')) {
        const sub = document.createElement('span');
        sub.id = 'call-header-sub'; sub.className = 'call-header-sub';
        dur.parentNode.insertBefore(sub, dur);
        const cnt = $('hub-in-room-count');
        const upd = () => {
            const n = cnt ? (cnt.textContent || '').replace(/\D/g, '') : '';
            sub.textContent = n ? tr('voice-connected', 'Bağlı') + ' · ' + n + ' ' + tr('member-count', 'kişi') : '';
        };
        if (cnt) new MutationObserver(upd).observe(cnt, { childList: true, characterData: true, subtree: true });
        upd();
    }
    voiceLabels();
    setInterval(voiceLabels, 15000);

    // Lobiden ana menüye dönüş: soldan sağa kaydırma (mobil) — geri düğmesiyle aynı işlev
    (function swipeBack() {
        let sx = 0, sy = 0, t0 = 0, track = false;
        document.addEventListener('touchstart', (e) => {
            const t = e.touches[0];
            track = e.touches.length === 1 && t.clientX < 28 && window.innerWidth <= 900 && activeHubId() != null
                && !document.body.classList.contains('lobby-drawer-open') && !document.querySelector('.modal-overlay[style*="flex"]');
            sx = t.clientX; sy = t.clientY; t0 = Date.now();
        }, { passive: true });
        document.addEventListener('touchend', (e) => {
            if (!track) return;
            track = false;
            const t = e.changedTouches[0];
            if (t.clientX - sx > 70 && Math.abs(t.clientY - sy) < 60 && Date.now() - t0 < 700) {
                const back = $('hub-back-btn');
                if (back) back.click();
            }
        }, { passive: true });
    })();

    // iOS Safari: klavye açılınca yerleşim görünüm alanına (visualViewport) sabitlenir; sayfa kayması sıfırlanır
    (function keepInVisualViewport() {
        const vv = window.visualViewport;
        if (!vv) return;
        const root = document.documentElement;
        const sync = () => {
            root.style.setProperty('--vvh', Math.round(vv.height) + 'px');
            root.style.setProperty('--vvtop', Math.round(vv.offsetTop) + 'px');
            const kb = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
            root.classList.toggle('kb-open', kb > 80);
            if (kb > 80 && (window.scrollY || vv.pageTop)) window.scrollTo(0, 0);
        };
        vv.addEventListener('resize', sync);
        vv.addEventListener('scroll', sync);
        sync();
    })();

    // Klavye: girdi odaklanınca composer görünür kalsın (WebView yeniden boyutlanınca)
    const composerInputs = document.querySelectorAll('.hub-composer input[type="text"], .hub-composer textarea, .dm-modal-box .composer-input-box input');
    composerInputs.forEach((el) => el.addEventListener('focus', () => {
        setTimeout(() => { try { el.scrollIntoView({ block: 'nearest' }); } catch (_) {} }, 320);
    }));
    if (window.visualViewport) {
        let lastH = window.visualViewport.height;
        window.visualViewport.addEventListener('resize', () => {
            const h = window.visualViewport.height;
            const feed = $('hub-feed');
            if (feed && h < lastH && document.activeElement && document.activeElement.closest('.hub-composer')) feed.scrollTop = feed.scrollHeight;
            lastH = h;
        });
    }

    labelButtons();
    mirror();
    syncMainState();
    // Oturum açık sayfa yenilemede ana liste zaten loadHubList() çağırır; yine de ilk veriyi al.
    setTimeout(fetchHubs, 800);
    setInterval(labelButtons, 15000);
})();
