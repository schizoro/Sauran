/* Canlı önizleme sayfası: Özelleştirme Merkezi'ndeki bir seçeneğe dokununca (kilitli olsa bile) kullanıcının KENDİ avatar/adıyla
   nasıl görüneceğini gösterir; yetkisi varsa "Uygula", yoksa "Plus/Premium ile aç". Uygulama, mevcut seçici işleyicileri üzerinden yapılır.
   script.js'ten SONRA yüklenir. */
(function () {
    'use strict';
    const $ = (id) => document.getElementById(id);
    const esc = (s) => (typeof escapeHtml === 'function' ? escapeHtml(s) : String(s));

    const PICKERS = [
        { id: 'profile-theme-picker', cat: 'profile', feature: 'profile_theme', tier: 'Plus', attr: 'ptheme', def: 'default', field: 'profile_theme', slot: 'ptheme', title: 'Profil teması' },
        { id: 'profile-effect-picker', cat: 'profile', feature: 'profile_effect', tier: 'Plus', attr: 'effect', def: 'none', field: 'profile_effect', slot: 'effect', title: 'Profil efekti' },
        { id: 'name-effect-picker', cat: 'profile', feature: 'name_effect', tier: 'Plus', attr: 'nfx', def: 'none', field: 'name_effect', slot: 'nfx', title: 'İsim efekti' },
        { id: 'chat-theme-picker', cat: 'chat', feature: 'chat_theme', tier: 'Plus', attr: 'theme', def: 'classic', field: 'chat_theme', slot: 'theme', title: 'Sohbet teması' },
        { id: 'bubble-style-picker', cat: 'chat', feature: 'bubble_style', tier: 'Plus', attr: 'bubble', def: 'default', field: 'bubble_style', slot: 'bubble', title: 'Mesaj balonu' }
    ];
    let pass = false; // "Uygula" mevcut işleyiciyi çalıştırırken kendi yakalayıcımızı atlar

    // Kilitli seçenekler `disabled` ile gelir ve tıklama almaz; önizlenebilsinler diye işareti taşıyıp disabled'ı kaldırırız.
    function unlock(btn, cfg) {
        if (btn.disabled) btn.disabled = false;
        const value = btn.dataset[cfg.attr];
        const locked = typeof userHasFeature === 'function' && !userHasFeature(cfg.feature) && value !== cfg.def;
        btn.classList.toggle('pv-locked', locked);
    }
    PICKERS.forEach((cfg) => {
        const picker = $(cfg.id);
        if (!picker) return;
        const sweep = () => picker.querySelectorAll('.chat-theme-option').forEach((b) => unlock(b, cfg));
        new MutationObserver(sweep).observe(picker, { attributes: true, subtree: true, attributeFilter: ['disabled'] });
        sweep();
    });

    function state() {
        const u = (typeof currentUser !== 'undefined' && currentUser) || {};
        return { ptheme: u.profile_theme || 'default', effect: u.profile_effect || 'none', nfx: u.name_effect || 'none', theme: u.chat_theme || 'classic', bubble: u.bubble_style || 'default' };
    }

    function avatarHtml() {
        const u = (typeof currentUser !== 'undefined' && currentUser) || {};
        if (u.avatar_data) return `<img src="${esc(u.avatar_data)}" alt="">`;
        return `<span class="pv-initial">${esc((u.username || '?').charAt(0).toUpperCase())}</span>`;
    }

    function stageHtml(cfg, st) {
        const u = (typeof currentUser !== 'undefined' && currentUser) || {};
        const name = u.username || 'Sen';
        if (cfg.cat === 'profile') {
            const nameHtml = typeof usernameCardHtml === 'function' ? usernameCardHtml(name, true, st.nfx) : esc(name);
            return `<div class="pv-profile profile-modal-box" data-profile-theme="${esc(st.ptheme)}">
                <div class="pv-avatar" id="pv-avatar">${avatarHtml()}</div>
                <div class="pv-name">${nameHtml}</div>
                <div class="pv-about"><b>Hakkımda</b><span>Sauran'da oyun ve sohbet 🎮</span></div>
            </div>`;
        }
        const cls = `${st.theme !== 'classic' ? ' chat-theme-' + st.theme : ''}${st.bubble !== 'default' ? ' bubble-' + st.bubble : ''}`;
        return `<div class="pv-chat">
            <div class="pv-msg"><span class="pv-msg-av">M</span><div><b>Mert</b><div class="hub-msg-bubble">Akşam oyun var mı?</div></div></div>
            <div class="pv-msg"><span class="pv-msg-av pv-me">${avatarHtml()}</span><div><b>${esc(name)}</b><div class="hub-msg-bubble${cls}">Ben varım! Saat 9'da lobide 🎮</div></div></div>
            <div class="pv-msg"><span class="pv-msg-av">M</span><div><b>Mert</b><div class="hub-msg-bubble">Süper, bekliyorum 😄</div></div></div>
        </div>`;
    }

    function close() { const o = $('pv-overlay'); if (o) { o.style.display = 'none'; o.innerHTML = ''; } }

    function openSheet(cfg, btn) {
        const value = btn.dataset[cfg.attr];
        const st = state();
        const active = st[cfg.slot] === value;
        st[cfg.slot] = value;
        const allowed = typeof userHasFeature === 'function' && userHasFeature(cfg.feature);
        const locked = !allowed && value !== cfg.def;
        let ov = $('pv-overlay');
        if (!ov) {
            ov = document.createElement('div');
            ov.id = 'pv-overlay';
            ov.className = 'modal-overlay pv-overlay';
            ov.addEventListener('click', (e) => { if (e.target === ov) close(); });
            document.body.appendChild(ov);
        }
        const label = (btn.textContent || '').trim() || value;
        const action = active ? '<button type="button" class="pv-btn pv-btn-ghost" disabled>Kullanımda ✓</button>'
            : locked ? `<button type="button" class="pv-btn pv-btn-up" data-pv="upgrade">✦ ${cfg.tier} ile aç</button>`
            : '<button type="button" class="pv-btn" data-pv="apply">Uygula</button>';
        ov.innerHTML = `<div class="modal-box pv-sheet" role="dialog" aria-modal="true" aria-label="${esc(cfg.title)} önizlemesi">
            <div class="pv-handle" aria-hidden="true"></div>
            <div class="pv-stage">${stageHtml(cfg, st)}</div>
            <div class="pv-info">
                <div class="pv-kicker">${esc(cfg.title)}</div>
                <h3>${esc(label)} ${locked ? `<span class="plus-badge plus-badge-sm">✦ ${cfg.tier.toUpperCase()}</span>` : ''}</h3>
                <p>${locked ? `Bu görünüm Sauran ${cfg.tier} ile açılır. Yukarıda kendi profilinde nasıl görüneceğine bak.` : 'Yukarıdaki önizleme kendi hesabınla gösterilir.'}</p>
            </div>
            <div class="pv-actions">${action}<button type="button" class="pv-btn pv-btn-ghost" data-pv="close">Kapat</button></div>
        </div>`;
        ov.style.display = 'flex';
        if (cfg.cat === 'profile' && typeof applyProfileEffect === 'function') applyProfileEffect($('pv-avatar'), st.effect);
        ov.querySelector('[data-pv="close"]').addEventListener('click', close);
        const apply = ov.querySelector('[data-pv="apply"]');
        if (apply) apply.addEventListener('click', () => { close(); pass = true; try { btn.click(); } finally { pass = false; } });
        const up = ov.querySelector('[data-pv="upgrade"]');
        if (up) up.addEventListener('click', () => { close(); if (typeof closeCustomizeCenter === 'function') closeCustomizeCenter(); document.getElementById('subs-open-btn')?.click(); });
    }

    // Üye kartı stili (Premium): düğmenin kendi kart önizlemesini büyütüp gösterir
    function openCardSheet(btn) {
        const allowed = typeof userHasFeature === 'function' && userHasFeature('premium_card');
        const key = btn.dataset.cardStyle;
        const active = allowed && ((currentUser && currentUser.card_style) || 'classic') === key;
        const prev = btn.querySelector('.cz-card-prev');
        let ov = $('pv-overlay');
        if (!ov) { ov = document.createElement('div'); ov.id = 'pv-overlay'; ov.className = 'modal-overlay pv-overlay'; ov.addEventListener('click', (e) => { if (e.target === ov) close(); }); document.body.appendChild(ov); }
        const label = ((typeof CARD_STYLES !== 'undefined' && CARD_STYLES.find((c) => c.key === key)) || {}).label || key;
        const action = active ? '<button type="button" class="pv-btn pv-btn-ghost" disabled>Kullanımda ✓</button>'
            : allowed ? '<button type="button" class="pv-btn" data-pv="apply">Uygula</button>'
            : '<button type="button" class="pv-btn pv-btn-up" data-pv="upgrade">♛ Premium ile aç</button>';
        ov.innerHTML = `<div class="modal-box pv-sheet" role="dialog" aria-modal="true" aria-label="Üye kartı önizlemesi">
            <div class="pv-handle" aria-hidden="true"></div>
            <div class="pv-stage"><div class="pv-cardstage">${prev ? prev.outerHTML : ''}</div></div>
            <div class="pv-info"><div class="pv-kicker">Lobi üye kartı</div><h3>${esc(label)} ${allowed ? '' : '<span class="subs-premium-badge">♛ PREMIUM</span>'}</h3>
            <p>${allowed ? 'Lobilerde Üyeler panelinde kartın böyle görünür.' : 'Animasyonlu üye kartları Sauran Premium ile açılır.'}</p></div>
            <div class="pv-actions">${action}<button type="button" class="pv-btn pv-btn-ghost" data-pv="close">Kapat</button></div></div>`;
        ov.style.display = 'flex';
        ov.querySelector('[data-pv="close"]').addEventListener('click', close);
        ov.querySelector('[data-pv="apply"]')?.addEventListener('click', () => { close(); pass = true; try { btn.click(); } finally { pass = false; } });
        ov.querySelector('[data-pv="upgrade"]')?.addEventListener('click', () => { close(); if (typeof closeCustomizeCenter === 'function') closeCustomizeCenter(); document.getElementById('subs-open-btn')?.click(); });
    }

    // Yakalayıcı: seçeneğe tıklamak önce önizlemeyi açar
    document.addEventListener('click', (e) => {
        if (pass) return;
        const card = e.target.closest && e.target.closest('#cz-cardstyle-card [data-card-style]');
        if (card) { e.preventDefault(); e.stopImmediatePropagation(); openCardSheet(card); return; }
        const btn = e.target.closest && e.target.closest('.chat-theme-option');
        if (!btn) return;
        const cfg = PICKERS.find((p) => btn.closest('#' + p.id));
        if (!cfg || btn.dataset[cfg.attr] === undefined) return;
        e.preventDefault(); e.stopImmediatePropagation();
        openSheet(cfg, btn);
    }, true);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
})();
