// =====================================================
// TANITIM SİSTEMİ — özellik kataloğu
// Tek kaynak: ayarlarda arama (ayar dışı özellikler), YENİ rozetleri, "Yenilikler" penceresi ve tur buradan beslenir.
// Yeni bir özellik eklerken buraya bir satır ekle; Yenilikler'de görünmesi için `since` alanına RELEASES'teki sürüm
// kimliğini yaz. Ayar satırları ayrıca kayıt gerektirmez (arama onları sayfadan okur) ama YENİ rozeti/Yenilikler
// için `go: { tab, sel }` ile buraya eklenir.
// Görüldü bilgileri hesaba kaydedilir (PATCH /api/me/onboarding); farklı cihazda tekrar gösterilmez.
// =====================================================

// Sürümler: en yenisi en üstte. Yenilikler penceresi, kullanıcının görmediği en yeni sürümü gösterir.
const RELEASES = [
    { id: '2026-11-14', title: 'Yeni profil efektleri', date: '14 Kasım 2026' },
    { id: '2026-11-13', title: 'Kasım güncellemesi', date: '13 Kasım 2026' }
];

const clickId = (id) => () => document.getElementById(id)?.click();
function openSettingsAt(tab, sel) {
    if (typeof settingsBtn !== 'undefined') settingsBtn.click();
    setTimeout(() => {
        if (typeof clearSettingsSearch === 'function') clearSettingsSearch();
        if (typeof switchSettingsTab === 'function') switchSettingsTab(tab);
        const el = sel ? document.querySelector(sel) : null;
        if (el && typeof flashSettingsTarget === 'function') requestAnimationFrame(() => flashSettingsTarget(el));
    }, 60);
}

// id: küçük harf + tire (sunucu bu biçimi kabul eder). where: kullanıcıya gösterilen konum.
// highlight: Yenilikler penceresinde büyük kart olarak öne çıkar (en fazla 6).
const FEATURE_CATALOG = [
    // ── Profil efektleri (2026-11-14) ──
    { id: 'profile-scenes', since: '2026-11-14', highlight: true, icon: '🐱', title: 'Yeni profil efektleri',
      desc: 'Kedi Partisi, Neon Devre, Ay Işığı Koileri, Astral Mercek, Kiraz Bahçesi ve Selam Kedi: profilin her açılışında kısa bir giriş.',
      where: 'Özelleştirme › Profil efekti', keywords: ['profil efekti', 'kedi', 'neon', 'koi', 'astral', 'kiraz', 'selam', 'giris videosu'],
      open: () => (typeof openCustomizeCenter === 'function' ? openCustomizeCenter('look') : document.getElementById('plusfx-open-btn')?.click()) },
    // ── Kasım güncellemesi (2026-11-13) ──
    { id: 'settings-search', since: '2026-11-13', highlight: true, icon: '🔎', title: 'Ayarlarda arama',
      desc: 'Bir ayarın yerini hatırlamıyor musun? Ayarların en üstündeki kutuya yaz; seni doğrudan oraya götürelim.',
      where: 'Ayarlar', go: { tab: 'general', sel: '#settings-search-input' } },
    { id: 'passkeys', since: '2026-11-13', highlight: true, icon: '🔑', title: 'Geçiş anahtarıyla giriş',
      desc: 'Şifre yazmadan; parmak izi, yüz tanıma ya da Windows Hello ile gir.',
      where: 'Ayarlar › Güvenlik', go: { tab: 'security', sel: '#passkey-settings' } },
    { id: 'themes', since: '2026-11-13', highlight: true, icon: '🎨', title: 'Açık tema ve Tam Siyah',
      desc: 'Açık, Tam Siyah (OLED) ya da cihazının ayarına uyan tema; sohbet yazı boyutu ve mesaj sıklığı.',
      where: 'Ayarlar › Genel', go: { tab: 'general', sel: '[data-i18n="label-theme"]' } },
    { id: 'voice-pack', since: '2026-11-13', highlight: true, icon: '🎙️', title: 'Daha temiz ses',
      desc: 'Gürültü azaltma, yankı engelleme, otomatik ses seviyesi ve mikrofon testi.',
      where: 'Ayarlar › Ses', go: { tab: 'voice', sel: '[data-i18n="vp-nc-title"]' } },
    { id: 'quiet-hours', since: '2026-11-13', highlight: true, icon: '🌙', title: 'Sessiz saatler',
      desc: 'Belirlediğin saatlerde bildirimler sessize geçer; lobi başına bildirim seviyesi de seçebilirsin.',
      where: 'Ayarlar › Bildirimler', go: { tab: 'notifications', sel: '[data-i18n="qh-title"]' } },
    { id: 'message-requests', since: '2026-11-13', highlight: true, icon: '✉️', title: 'Mesaj istekleri',
      desc: 'Aynı lobideki biri sana yazınca mesajı istek olarak gelir; sen kabul edene kadar bildirim almazsın.',
      where: 'Ayarlar › Gizlilik', go: { tab: 'privacy', sel: '[data-i18n="privacy-dm-title"]' } },
    { id: 'streamer-mode', since: '2026-11-13', icon: '📺', title: 'Yayıncı modu',
      desc: 'Ekran paylaşırken e-posta, davet kodu ve bildirim önizlemelerini gizler.',
      where: 'Ayarlar › Genel', go: { tab: 'general', sel: '#settings-streamer' } },
    { id: 'stream-duck', since: '2026-11-13', icon: '🔉', title: 'Yayın kısma',
      desc: 'Biri konuşurken izlediğin yayının sesi otomatik olarak azalır.',
      where: 'Ayarlar › Ses', go: { tab: 'voice', sel: '#settings-stream-duck' } },
    { id: 'stream-notify', since: '2026-11-13', icon: '🔴', title: 'Yayın bildirimi ve CANLI rozeti',
      desc: 'Arkadaşın yayın başlatınca haber alırsın; yayındakiler CANLI rozetiyle görünür.',
      where: 'Ayarlar › Bildirimler', go: { tab: 'notifications', sel: '[data-pref="notify_friend_stream"]' } },
    { id: 'privacy-pack', since: '2026-11-13', icon: '🔒', title: 'Gizlilik seçenekleri',
      desc: 'Kimin arkadaşlık isteği gönderebileceğini ve profil fotoğrafını kimin görebileceğini seç; birini yok say.',
      where: 'Ayarlar › Gizlilik', go: { tab: 'privacy', sel: '#privacy-fr-group' } },
    { id: 'media-filter', since: '2026-11-13', icon: '🫣', title: 'Hassas içerik filtresi',
      desc: 'Arkadaşın olmayanlardan ya da herkesten gelen görselleri bulanık gösterir.',
      where: 'Ayarlar › Gizlilik', go: { tab: 'privacy', sel: '[data-i18n="mf-title"]' } },
    { id: 'data-saver', since: '2026-11-13', icon: '📶', title: 'Veri tasarrufu',
      desc: 'Mobil veride GIF ve videoları sen dokununca yükler.',
      where: 'Ayarlar › Genel', go: { tab: 'general', sel: '[data-i18n="ds-title"]' } },
    { id: 'reduce-motion', since: '2026-11-13', icon: '🌀', title: 'Animasyonları azalt',
      desc: 'Hareketli efektleri ve geçişleri sadeleştirir.',
      where: 'Ayarlar › Genel', go: { tab: 'general', sel: '#settings-reduce-motion' } },
    { id: 'account-standing', since: '2026-11-13', icon: '✅', title: 'Hesap durumu',
      desc: 'Hesabında bir kısıtlama olup olmadığını tek bakışta gör.',
      where: 'Ayarlar › Hesap', go: { tab: 'account', sel: '#standing-card' } },
    { id: 'export-parts', since: '2026-11-13', icon: '📦', title: 'Verilerimi indir: kategori seçimi',
      desc: 'Verilerinin yalnızca istediğin kısmını indir.',
      where: 'Ayarlar › Gizlilik ve Yasal', go: { tab: 'legal', sel: '#export-pick' } },

    // ── Uygulamanın temel özellikleri (arama + tur; Yenilikler'de görünmez) ──
    { id: 'discover', icon: '🧭', title: 'Keşfet', where: 'Ana Menü',
      desc: 'Herkese açık lobileri bul, beğen ve katıl.', keywords: ['lobi bul', 'topluluk', 'sunucu ara'], open: clickId('discover-open-btn') },
    { id: 'hub-create', icon: '➕', title: 'Lobi oluştur', where: 'Lobiler',
      desc: 'Kendi topluluğunu kur: metin kanalları, sesli odalar, davetler.', keywords: ['sunucu kur', 'yeni lobi'], open: clickId('hub-create-open-btn') },
    { id: 'hub-join', icon: '🎟️', title: 'Davet koduyla katıl', where: 'Ana Menü',
      desc: 'Sana verilen davet koduyla bir lobiye gir.', keywords: ['davet', 'kod', 'katil'], open: clickId('hub-join-open-btn') },
    { id: 'friend-add', icon: '🤝', title: 'Arkadaş ekle', where: 'Arkadaşlar',
      desc: 'Kullanıcı adıyla arkadaşlık isteği gönder.', keywords: ['arkadas', 'ekle', 'kullanici bul'], open: clickId('friend-add-open-btn') },
    { id: 'customize', icon: '✨', title: 'Özelleştirme', where: 'Ana Menü',
      desc: 'Profil rengi, efektler, isim efekti, avatar çerçevesi, sohbet teması ve profil sesi.',
      keywords: ['profil efekti', 'cerceve', 'isim efekti', 'renk', 'profil sesi', 'susleme', 'dekorasyon'],
      open: () => (typeof openCustomizeCenter === 'function' ? openCustomizeCenter('look') : document.getElementById('plusfx-open-btn')?.click()) },
    { id: 'market', icon: '🛍️', title: 'Sauran Market', where: 'Ana Menü',
      desc: 'Profilin için süsler ve efektler.', keywords: ['magaza', 'satin al', 'coin', 'kozmetik'], open: clickId('market-open-btn') },
    { id: 'inventory', icon: '🎒', title: 'Kitaplığım', where: 'Ana Menü',
      desc: 'Sahip olduğun süsler ve efektler.', keywords: ['envanter', 'aldiklarim'], open: clickId('inventory-open-btn') },
    { id: 'subs', icon: '💎', title: 'Abonelikler (Plus / Premium)', where: 'Ana Menü',
      desc: 'Plus ve Premium ayrıcalıkları.', keywords: ['plus', 'premium', 'abonelik', 'uyelik'], open: clickId('subs-open-btn') },
    { id: 'feedback', icon: '💡', title: 'Öneri ve görüş', where: 'Ana Menü',
      desc: 'Fikirlerini paylaş, başkalarının önerilerine oy ver.', keywords: ['oneri', 'geri bildirim', 'istek'], open: clickId('feedback-open-btn') },
    { id: 'notifications-center', icon: '🔔', title: 'Bildirim merkezi', where: 'Üst çubuk',
      desc: 'Arkadaşlık istekleri, davetler, bahsetmeler.', keywords: ['bildirimler', 'zil'], open: clickId('notifications-btn') },
    { id: 'custom-status', icon: '💬', title: 'Özel durum', where: 'Profil',
      desc: 'Arkadaşlarına kısa bir durum yazısı göster.', keywords: ['durum', 'status', 'mesgul'], open: clickId('cstatus-open-btn') },
    { id: 'profile', icon: '🙂', title: 'Profilim', where: 'Sen',
      desc: 'Profil fotoğrafı, kapak, hakkımda ve kullanıcı adı.', keywords: ['avatar', 'kapak', 'hakkimda', 'kullanici adi'], open: clickId('profile-btn') }
];

// Katalog öğesini açar: ayar satırıysa ayarlarda o satıra gider, değilse kendi ekranını açar.
function openFeature(f) {
    if (!f) return;
    if (f.go) openSettingsAt(f.go.tab, f.go.sel);
    else if (f.open) f.open();
}

// =====================================================
// DURUM + YENİ ROZETLERİ
// =====================================================
const OB_TITLE_SEL = '.profile-field-label, .voice-sub-title, .privacy-option-title, .notif-pref-group-title';
const SauranOnboarding = (() => {
    const RECENT_DAYS = 30;           // bu kadar günden eski sürümlerin özelliklerine rozet konmaz
    let state = null;                 // sunucudaki tanıtım durumu (currentUser.onboarding)
    let started = false;
    let pendingSeen = new Set();
    let flushTimer = null;
    let gen = 0;                      // çıkışta artar: eski oturumdan kalan zamanlayıcılar/beklemeler iptal olur
    const timers = new Set();         // reset() ile temizlenen aralıklar

    const releaseDate = (id) => new Date(id + 'T00:00:00');
    const accountCreated = () => {
        const v = state && state.account_created_at;
        if (!v) return null;
        const s = String(v).replace(' ', 'T');
        return new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(s) ? s : s + 'Z');
    };

    function save(patch) {
        return fetch('/api/me/onboarding', {
            method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch)
        }).then((r) => r.json()).then((d) => {
            if (d && d.success && d.onboarding && state) {
                const local = state.seen || [];
                state = d.onboarding;
                for (const id of local) if (!state.seen.includes(id)) state.seen.push(id); // bekleyenler korunur
            }
            return d;
        }).catch(() => null);
    }
    function markSeen(ids) {
        if (!state) return;
        for (const id of ids) if (!state.seen.includes(id)) { state.seen.push(id); pendingSeen.add(id); }
        clearTimeout(flushTimer);
        flushTimer = setTimeout(() => {
            if (!pendingSeen.size) return;
            const seen = Array.from(pendingSeen);
            pendingSeen = new Set();
            save({ seen });
        }, 800);
    }

    // Rozet alacak özellikler: son 30 gündeki sürümlerden, kullanıcının henüz görmediği ve hesabı o sürümden ÖNCE
    // açılmış olanlar. Yeni kullanıcıya her şey yenidir; ona rozet yerine tur ve başlangıç listesi gösterilir.
    function unseenFeatures() {
        if (!state) return [];
        const created = accountCreated();
        const now = Date.now();
        return FEATURE_CATALOG.filter((f) => {
            if (!f.since || state.seen.includes(f.id)) return false;
            const d = releaseDate(f.since).getTime();
            if (now - d > RECENT_DAYS * 86400000) return false;
            if (created && created.getTime() >= d) return false; // yeni hesap: rozet yok (isNew ile aynı kural)
            return true;
        });
    }

    // Rozetin konacağı başlık: kontrolün kendisi (input/select/kapsayıcı) yerine ona ait başlık metni.
    function badgeTargetFor(f) {
        if (!f.go || !f.go.sel) return null;
        const el = document.querySelector(f.go.sel);
        if (!el) return null;
        if (el.matches(OB_TITLE_SEL)) return el;
        const row = el.closest('.notif-pref-row');
        if (row) return row.querySelector(':scope > span > span') || row.querySelector(':scope > span') || row;
        const inner = el.querySelector(OB_TITLE_SEL);
        if (inner) return inner;
        if (el.id) { const lab = document.querySelector(`label[for="${el.id}"]`); if (lab) return lab; }
        let p = el.previousElementSibling;
        for (let i = 0; p && i < 4; i++, p = p.previousElementSibling) if (p.matches(OB_TITLE_SEL)) return p;
        return null;
    }

    // Nokta gerçek bir öğe olarak eklenir (düğmelerin ::after'ı başka işlerde, ör. alt çubuk etiketinde, kullanılıyor).
    function addDot(el) {
        if (!el || el.querySelector(':scope > .ob-dot')) return;
        if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
        const d = document.createElement('span');
        d.className = 'ob-dot';
        d.setAttribute('aria-hidden', 'true');
        el.appendChild(d);
        el.classList.add('ob-new-dot');
    }
    function removeDot(el) {
        if (!el) return;
        el.querySelector(':scope > .ob-dot')?.remove();
        el.classList.remove('ob-new-dot');
    }

    function renderBadges() {
        document.querySelectorAll('.ob-new-pill, .ob-dot').forEach((n) => n.remove());
        document.querySelectorAll('.ob-new-dot').forEach((n) => n.classList.remove('ob-new-dot'));
        // Ayarlardaki her yeni özellik rozet alır (kullanıcı tercihi, 2026-11-13).
        const list = unseenFeatures().filter((f) => f.go);
        if (!list.length) return;
        const tabs = new Set();
        for (const f of list) {
            tabs.add(f.go.tab);
            const t = badgeTargetFor(f);
            if (t && !t.querySelector('.ob-new-pill')) {
                const pill = document.createElement('span');
                pill.className = 'ob-new-pill';
                pill.textContent = 'YENİ';
                pill.dataset.feature = f.id;
                t.appendChild(pill);
            }
        }
        tabs.forEach((tab) => addDot(document.querySelector(`.settings-tab-btn[data-settings-tab="${tab}"]`)));
        ['rail-settings', 'lc-gear', 'settings-btn'].forEach((id) => addDot(document.getElementById(id)));
        document.getElementById('topbar-menu-btn')?.classList.add('ob-new-dot'); // kendi noktası var; o kırmızıya döner
    }

    // Ayarlarda bir sekme açılınca: oradaki yeni özellikler bu bakışta rozetli görünür ve "görüldü" sayılır;
    // rozet bir sonraki açılışta kalkar (Discord'daki gibi). Sekmenin noktası hemen söner.
    function onSettingsTab(tab) {
        if (!state) return;
        const ids = unseenFeatures().filter((f) => f.go && f.go.tab === tab).map((f) => f.id);
        if (!ids.length) return;
        removeDot(document.querySelector(`.settings-tab-btn[data-settings-tab="${tab}"]`));
        markSeen(ids);
        if (!unseenFeatures().some((f) => f.go)) {
            ['rail-settings', 'lc-gear', 'settings-btn', 'topbar-menu-btn'].forEach((id) => removeDot(document.getElementById(id)));
        }
    }
    // Ayarlar her açılışta rozetleri tazeler (önceki açılışta görülenler kalkar)
    function onSettingsOpen() { renderBadges(); }

    // ─────────────────────────────────────────────
    // YENİLİKLER PENCERESİ
    // ─────────────────────────────────────────────
    const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const latestRelease = () => RELEASES[0] || null;
    const createdBefore = (releaseId) => {
        const c = accountCreated();
        return !c || c.getTime() < releaseDate(releaseId).getTime();
    };
    // Başka bir zorunlu/önemli pencere açıkken (politika, yaş, geliştirme bildirimi, rol, ayarlar…) beklenir.
    function somethingOpen() {
        if (document.querySelector('.dev-notice-overlay.visible, .dev-notice-overlay.open')) return true;
        const login = document.getElementById('login-screen') || document.querySelector('.login-box');
        if (login && login.getClientRects().length > 0 && getComputedStyle(login).display !== 'none') return true;
        return Array.from(document.querySelectorAll('.modal-overlay, .hubset-screen, #profile-modal, #customize-screen'))
            .some((el) => el.id !== 'whatsnew-overlay' && el.isConnected && getComputedStyle(el).display !== 'none' && getComputedStyle(el).visibility !== 'hidden' && el.getClientRects().length > 0);
    }
    const loggedIn = () => typeof currentUser !== 'undefined' && Boolean(currentUser);
    function typing() {
        const a = document.activeElement;
        return Boolean(a && (a.isContentEditable || (/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && a.id !== 'settings-search-input')));
    }
    function whenQuiet(fn, tries = 0, g = gen) {
        if (g !== gen || !loggedIn()) return; // çıkış yapıldı / hesap değişti
        if (document.hidden) { // gizli sekmedeki süre sayılmaz: sekme görünür olunca yeniden denenir
            document.addEventListener('visibilitychange', () => whenQuiet(fn, tries, g), { once: true });
            return;
        }
        if (tries > 120) return; // ~3 dk görünür bekleme sonra vazgeç; bir sonraki girişte yeniden denenir
        if (somethingOpen() || typing()) { setTimeout(() => whenQuiet(fn, tries + 1, g), 1500); return; }
        fn();
    }

    function closeWhatsNew() {
        const ov = document.getElementById('whatsnew-overlay');
        if (!ov) return;
        ov.classList.remove('open');
        setTimeout(() => ov.remove(), document.documentElement.classList.contains('reduce-motion') ? 0 : 200);
        const rel = latestRelease();
        if (rel && state && state.wn !== rel.id) { state.wn = rel.id; save({ wn: rel.id }); }
        // Turu hiç görmemiş kullanıcıya Yenilikler'den sonra bir kez tur (ekran sakinleşince: "Göster" ile
        // ayarlara gidildiyse ayarlar kapanana kadar bekler).
        if (state && !state.tour) setTimeout(() => whenQuiet(() => { if (state && !state.tour && !tour) startTour(); }), 500);
    }

    function openWhatsNew() {
        const rel = latestRelease();
        if (!rel || document.getElementById('whatsnew-overlay')) return;
        const items = FEATURE_CATALOG.filter((f) => f.since === rel.id);
        const top = items.filter((f) => f.highlight).slice(0, 6);
        const rest = items.filter((f) => !top.includes(f));
        const ov = document.createElement('div');
        ov.id = 'whatsnew-overlay';
        ov.className = 'modal-overlay whatsnew-overlay';
        ov.innerHTML = `
            <div class="whatsnew-box" role="dialog" aria-modal="true" aria-labelledby="whatsnew-title">
                <div class="whatsnew-hero">
                    <div class="whatsnew-hero-art" aria-hidden="true"><span>✦</span><span>✧</span><span>✦</span></div>
                    <div class="whatsnew-hero-txt">
                        <small>${esc(rel.date)}</small>
                        <h2 id="whatsnew-title">Sauran'da neler yeni?</h2>
                        <p>${esc(rel.title)}: ${items.length} yenilik. Birine dokun, seni oraya götürelim.</p>
                    </div>
                    <button type="button" class="whatsnew-x" data-wn="close" aria-label="Kapat">✕</button>
                </div>
                <div class="whatsnew-scroll">
                    <div class="whatsnew-grid">
                        ${top.map((f) => `
                            <button type="button" class="whatsnew-card" data-wn-open="${esc(f.id)}">
                                <span class="whatsnew-ico" aria-hidden="true">${esc(f.icon || '✨')}</span>
                                <span class="whatsnew-card-txt">
                                    <b>${esc(f.title)}</b>
                                    <span>${esc(f.desc)}</span>
                                    <em>${esc(f.where || '')} · Göster →</em>
                                </span>
                            </button>`).join('')}
                    </div>
                    ${rest.length ? `<div class="whatsnew-more-head">Diğer yenilikler</div>
                    <div class="whatsnew-list">
                        ${rest.map((f) => `
                            <button type="button" class="whatsnew-row" data-wn-open="${esc(f.id)}">
                                <span class="whatsnew-row-ico" aria-hidden="true">${esc(f.icon || '•')}</span>
                                <span class="whatsnew-row-txt"><b>${esc(f.title)}</b><span>${esc(f.desc)}</span></span>
                                <span class="whatsnew-row-go" aria-hidden="true">›</span>
                            </button>`).join('')}
                    </div>` : ''}
                </div>
                <div class="whatsnew-foot">
                    <span>Bu pencereye istediğin zaman Menü › Yenilikler'den ulaşabilirsin.</span>
                    <span class="whatsnew-foot-btns">
                        <button type="button" class="whatsnew-tour" data-wn="tour">🧭 Kısa tur</button>
                        <button type="button" class="whatsnew-ok" data-wn="close">Harika, anladım</button>
                    </span>
                </div>
            </div>`;
        ov.addEventListener('click', (e) => {
            if (e.target === ov || e.target.closest('[data-wn="close"]')) { closeWhatsNew(); return; }
            if (e.target.closest('[data-wn="tour"]')) { closeWhatsNew(); setTimeout(startTour, 220); return; }
            const b = e.target.closest('[data-wn-open]');
            if (b) {
                const f = FEATURE_CATALOG.find((x) => x.id === b.dataset.wnOpen);
                closeWhatsNew();
                setTimeout(() => openFeature(f), 120);
            }
        });
        ov.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); closeWhatsNew(); } });
        document.body.appendChild(ov);
        ov.style.display = 'flex';
        requestAnimationFrame(() => ov.classList.add('open'));
        ov.querySelector('.whatsnew-ok')?.focus({ preventScroll: true });
    }

    function maybeAutoWhatsNew() {
        const rel = latestRelease();
        if (!rel || !state || state.wn === rel.id) return;
        if (!createdBefore(rel.id)) return; // yeni hesap: her şey zaten yeni; ona tur gösterilir
        whenQuiet(() => { if (state.wn !== rel.id) openWhatsNew(); });
    }

    // ─────────────────────────────────────────────
    // HOŞ GELDİN TURU (vurgulayan tur)
    // Her adımda hedef, listedeki seçicilerden EKRANDA GÖRÜNEN ilkidir (mobil alt çubuk / masaüstü alt çubuk).
    // Hedefi bulunamayan adım atlanır. Hedefsiz adım ortada kart olarak görünür.
    // ─────────────────────────────────────────────
    const TOUR_SINCE = '2026-11-13'; // bu tarihte ve sonra açılan hesaplarda tur kendiliğinden başlar
    const TOUR_STEPS = [
        { title: "Sauran'a hoş geldin! 👋", text: 'Bir dakikalık kısa bir turla temel yerleri gösterelim. İstediğin an atlayabilirsin.' },
        { sel: ['#mnav [data-m="home"]', '#lc-rail'], title: 'Lobiler', text: 'Lobiler toplulukların: metin kanalları ve sesli odalar burada. Kendi lobini kurabilir ya da davet koduyla katılabilirsin.' },
        { sel: ['#mnav [data-m="dms"]', '#lc-dock-dms'], title: 'Mesajlar', text: 'Arkadaşlarınla özel mesajlaşma ve grup sohbetleri. Aynı lobideki birinden gelen ilk mesaj istek olarak düşer.' },
        { sel: ['#mnav [data-m="friends"]', '#lc-dock-friends'], title: 'Arkadaşlar', text: 'Kullanıcı adıyla arkadaş ekle, kimin çevrimiçi olduğunu gör, tek dokunuşla sesli ara.' },
        { sel: ['#mnav [data-m="discover"]', '#lc-discover'], title: 'Keşfet', text: 'Herkese açık lobileri bul, beğen ve katıl.' },
        { sel: ['#notifications-btn', '#lc-bell'], title: 'Bildirimler', text: 'Arkadaşlık istekleri, davetler ve senden bahsedilen mesajlar burada toplanır.' },
        { sel: ['#mnav [data-m="profile"]', '#lc-dock-me'], title: 'Sen', text: 'Profilin, durumun ve “ne oynuyorum” bilgin. Profil fotoğrafı ve kapak da buradan.' },
        { sel: ['#topbar-menu-btn', '#lc-more'], title: 'Menü', text: 'Özelleştirme (efektler, çerçeveler, profil sesi), Market, Yenilikler ve Ayarlar burada.' },
        { sel: ['#lc-gear'], title: 'Ayarlar', text: 'Tema, ses, bildirim ve gizlilik ayarların. Bir şeyin yerini unutursan en üstteki arama kutusuna yaz.' },
        { title: 'Hazırsın! 🎉', text: 'Takılırsan Ayarlar’daki aramayı kullan. Bu turu istediğin zaman Ayarlar › Genel › Yardım’dan yeniden başlatabilirsin.', last: true }
    ];
    let tour = null; // { steps, i, root, spot, bubble }

    const visibleEl = (sel) => {
        for (const s of sel || []) {
            const el = document.querySelector(s);
            if (!el) continue;
            const r = el.getBoundingClientRect();
            const cs = getComputedStyle(el);
            if (r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && r.bottom > 0 && r.top < innerHeight) return el;
        }
        return null;
    };

    function placeTour() {
        if (!tour) return;
        const step = tour.steps[tour.i];
        const el = step.sel ? visibleEl(step.sel) : null;
        const { spot, bubble } = tour;
        const pad = 6;
        if (el) {
            const r = el.getBoundingClientRect();
            spot.style.display = 'block';
            // Halka ekran içinde kalır (kenardaki hedeflerde kesilmesin)
            const x1 = Math.max(3, r.left - pad), y1 = Math.max(3, r.top - pad);
            const x2 = Math.min(innerWidth - 3, r.right + pad), y2 = Math.min(innerHeight - 3, r.bottom + pad);
            spot.style.left = x1 + 'px';
            spot.style.top = y1 + 'px';
            spot.style.width = (x2 - x1) + 'px';
            spot.style.height = (y2 - y1) + 'px';
            tour.root.classList.remove('centered');
            const bw = bubble.offsetWidth, bh = bubble.offsetHeight;
            // Uzun (ekranın yarısından yüksek) hedef, ör. masaüstünde sol şerit: balon yanına konur
            if (r.height > innerHeight * 0.5) {
                const right = r.right + pad + 14 + bw < innerWidth - 8;
                const left = right ? r.right + pad + 14 : Math.max(12, r.left - pad - 14 - bw);
                const top = Math.max(12, Math.min(innerHeight - bh - 12, r.top + 60));
                bubble.style.left = left + 'px';
                bubble.style.top = top + 'px';
                bubble.dataset.side = right ? 'right' : 'left';
                bubble.style.setProperty('--ay', '30px');
                return;
            }
            // Balon: altta yer varsa hedefin altına, yoksa üstüne; yatayda ekrana sığdırılır
            const below = r.bottom + pad + 12 + bh < innerHeight - 8;
            let top = below ? r.bottom + pad + 12 : r.top - pad - 12 - bh;
            top = Math.max(8, Math.min(innerHeight - bh - 8, top));
            let left = r.left + r.width / 2 - bw / 2;
            left = Math.max(12, Math.min(innerWidth - bw - 12, left));
            bubble.style.top = top + 'px';
            bubble.style.left = left + 'px';
            bubble.dataset.side = below ? 'below' : 'above';
            const ax = Math.max(16, Math.min(bw - 16, r.left + r.width / 2 - left));
            bubble.style.setProperty('--ax', ax + 'px');
        } else {
            spot.style.display = 'none';
            tour.root.classList.add('centered');
            bubble.style.top = Math.max(12, (innerHeight - bubble.offsetHeight) / 2) + 'px';
            bubble.style.left = Math.max(12, (innerWidth - bubble.offsetWidth) / 2) + 'px';
            bubble.dataset.side = 'none';
        }
    }

    function renderTourStep() {
        const step = tour.steps[tour.i];
        // Sayaç yalnızca bu ekranda gösterilebilen adımları sayar (mobilde ayrı Ayarlar düğmesi yok vb.)
        const shown = tour.steps.filter((s) => !s.sel || visibleEl(s.sel));
        const n = shown.length;
        const pos = Math.max(1, shown.indexOf(step) + 1);
        tour.bubble.innerHTML = `
            <div class="tour-count">${pos} / ${n}</div>
            <h3 id="tour-title">${esc(step.title)}</h3>
            <p>${esc(step.text)}</p>
            <div class="tour-actions">
                ${step.last ? '' : '<button type="button" class="tour-skip" data-tour="skip">Turu atla</button>'}
                <span class="tour-gap"></span>
                ${tour.i > 0 && !step.last ? '<button type="button" class="tour-back" data-tour="back">Geri</button>' : ''}
                <button type="button" class="tour-next" data-tour="next">${tour.i === 0 ? 'Başlayalım' : step.last ? 'Bitir' : 'İleri'}</button>
            </div>`;
        placeTour();
        tour.bubble.querySelector('.tour-next')?.focus({ preventScroll: true });
    }

    function endTour(result) {
        if (!tour) return;
        window.removeEventListener('resize', placeTour);
        window.removeEventListener('scroll', placeTour, true);
        document.removeEventListener('keydown', tourKeys, true);
        tour.root.remove();
        tour = null;
        if (state) { state.tour = result; save({ tour: result }); }
        renderChecklist();
    }
    function tourKeys(e) {
        if (!tour) return;
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); endTour('skipped'); }
        else if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
        else if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
        else if (e.key === 'Tab') {
            // Odak balonun içinde kalır
            const f = Array.from(tour.bubble.querySelectorAll('button'));
            if (!f.length) return;
            const i = f.indexOf(document.activeElement);
            e.preventDefault();
            f[(i + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus();
        }
    }
    function go(dir) {
        if (!tour) return;
        let i = tour.i + dir;
        // Hedefi ekranda olmayan adımlar atlanır
        while (i > 0 && i < tour.steps.length - 1 && tour.steps[i].sel && !visibleEl(tour.steps[i].sel)) i += dir;
        if (i >= tour.steps.length) { endTour('done'); return; }
        if (i < 0) i = 0;
        tour.i = i;
        renderTourStep();
    }

    function startTour() {
        if (tour) return;
        // Açık pencereler kapatılır (tur ana ekranı gösterir)
        document.getElementById('whatsnew-overlay')?.remove();
        const sm = document.getElementById('settings-modal');
        if (sm && getComputedStyle(sm).display !== 'none') document.getElementById('settings-close-btn')?.click();
        document.getElementById('topbar-menu-dropdown')?.style.setProperty('display', 'none');
        const root = document.createElement('div');
        root.className = 'tour-root';
        root.innerHTML = '<div class="tour-block"></div><div class="tour-spot" aria-hidden="true"></div><div class="tour-bubble" role="dialog" aria-modal="true" aria-labelledby="tour-title"></div>';
        document.body.appendChild(root);
        document.getElementById('ob-cl-chip')?.remove();
        document.getElementById('ob-cl-panel')?.remove();
        tour = { steps: TOUR_STEPS, i: 0, root, spot: root.querySelector('.tour-spot'), bubble: root.querySelector('.tour-bubble') };
        root.addEventListener('click', (e) => {
            const b = e.target.closest('[data-tour]');
            if (!b) return;
            if (b.dataset.tour === 'skip') endTour('skipped');
            else if (b.dataset.tour === 'back') go(-1);
            else if (b.dataset.tour === 'next') { if (tour.steps[tour.i].last) endTour('done'); else go(1); }
        });
        window.addEventListener('resize', placeTour);
        window.addEventListener('scroll', placeTour, true);
        document.addEventListener('keydown', tourKeys, true);
        renderTourStep();
        requestAnimationFrame(() => root.classList.add('open'));
    }

    // Tur her hesapta bir kez kendiliğinden açılır (kullanıcı tercihi, 2026-11-13):
    //  • yeni hesap (TOUR_SINCE ve sonrası): doğrudan tur
    //  • mevcut hesap: önce Yenilikler (görülmediyse), kapanınca tur; Yenilikler görüldüyse doğrudan tur
    function autoIntro() {
        if (!state) return;
        const c = accountCreated();
        const isNew = c && c.getTime() >= releaseDate(TOUR_SINCE).getTime();
        const rel = latestRelease();
        if (!isNew && rel && state.wn !== rel.id && createdBefore(rel.id)) { maybeAutoWhatsNew(); return; }
        if (!state.tour) whenQuiet(() => { if (state && !state.tour && !tour) startTour(); });
    }

    // ─────────────────────────────────────────────
    // BAŞLANGIÇ LİSTESİ (yeni hesaplar: ilk 14 gün)
    // Görevler mümkün olduğunca uygulamanın zaten bildiği veriden işaretlenir; sesli oda ve özelleştirme
    // gibi geçmişi tutulmayan adımlar yapıldığı an hesaba kaydedilir (seen: 'cl-voice', 'cl-customize').
    // ─────────────────────────────────────────────
    const CHECKLIST_DAYS = 14;
    const me = () => (typeof currentUser !== 'undefined' ? currentUser : null);
    const CHECKLIST = [
        { id: 'avatar', icon: '🖼️', title: 'Profil fotoğrafı ekle', done: () => Boolean(me()?.avatar_data),
          go: () => document.getElementById('profile-btn')?.click() },
        { id: 'about', icon: '✍️', title: 'Kendini kısaca tanıt', done: () => Boolean(String(me()?.about_me || '').trim()),
          go: () => document.getElementById('profile-btn')?.click() },
        { id: 'friend', icon: '🤝', title: 'Bir arkadaş ekle', done: () => (window.__friendsCache || []).length > 0,
          go: () => document.getElementById('friend-add-open-btn')?.click() },
        { id: 'hub', icon: '🏠', title: 'Bir lobiye katıl ya da kendi lobini kur', done: () => (window.__hubListCache || []).length > 0,
          go: () => document.getElementById('discover-open-btn')?.click() },
        { id: 'voice', icon: '🎙️', title: 'Bir sesli odaya gir', done: () => state?.seen.includes('cl-voice'),
          go: () => (document.querySelector('#mnav [data-m="home"]') || document.getElementById('lc-lobbies'))?.click() },
        { id: 'customize', icon: '✨', title: 'Görünümünü özelleştir', done: () => state?.seen.includes('cl-customize'),
          go: () => (typeof openCustomizeCenter === 'function' ? openCustomizeCenter('look') : document.getElementById('plusfx-open-btn')?.click()) }
    ];
    let clCelebrated = false;
    let clLastKey = '';

    function checklistEligible() {
        if (!state || state.cl === 'dismissed') return false;
        const c = accountCreated();
        return Boolean(c) && Date.now() - c.getTime() < CHECKLIST_DAYS * 86400000;
    }
    // Uygulama içinden çağrılır: task('voice') → sesli odaya girildi
    function task(id) {
        const key = 'cl-' + id;
        if (state && !state.seen.includes(key)) { markSeen([key]); renderChecklist(); }
    }

    // Sohbet açıkken (yazma kutusu görünürken) liste düğmesi gizlenir: gönder düğmesinin/mesajların üstüne binmesin.
    function chatOpen() {
        return Array.from(document.querySelectorAll('#hub-message-input, #dm-message-input, .composer-textarea'))
            .some((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; });
    }
    function updateChipVisibility() {
        const chip = document.getElementById('ob-cl-chip');
        if (!chip) return;
        const hide = chatOpen();
        chip.hidden = hide;
        if (hide) document.getElementById('ob-cl-panel')?.remove();
    }

    function renderChecklist() {
        let chip = document.getElementById('ob-cl-chip');
        if (!checklistEligible() || tour) { chip?.remove(); document.getElementById('ob-cl-panel')?.remove(); return; }
        const done = CHECKLIST.filter((t) => { try { return t.done(); } catch (_) { return false; } });
        const n = CHECKLIST.length, k = done.length;
        if (!chip) {
            chip = document.createElement('button');
            chip.type = 'button';
            chip.id = 'ob-cl-chip';
            chip.className = 'ob-cl-chip';
            chip.addEventListener('click', toggleChecklistPanel);
            document.body.appendChild(chip);
        }
        const pct = Math.round((k / n) * 100);
        const C = 2 * Math.PI * 9;
        chip.setAttribute('aria-label', `Başlangıç listesi: ${k} / ${n} tamamlandı`);
        chip.innerHTML = `<svg viewBox="0 0 24 24" class="ob-cl-ring" aria-hidden="true"><circle cx="12" cy="12" r="9" class="bg"/><circle cx="12" cy="12" r="9" class="fg" stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${(C * (1 - k / n)).toFixed(1)}"/></svg><span>Başlangıç <b>${k}/${n}</b></span>`;
        updateChipVisibility();
        const panel = document.getElementById('ob-cl-panel');
        const key = done.map((t) => t.id).join(',');
        if (panel && (key !== clLastKey || !panel.childElementCount)) fillChecklistPanel(panel, done, pct);
        clLastKey = key;
        if (k === n && !clCelebrated) { clCelebrated = true; if (!panel) toggleChecklistPanel(); }
    }

    function fillChecklistPanel(panel, done, pct) {
        const all = done.length === CHECKLIST.length;
        panel.innerHTML = `
            <div class="ob-cl-head">
                <b>${all ? 'Hepsi tamam! 🎉' : "Sauran'a başla"}</b>
                <button type="button" class="ob-cl-x" data-cl="close" aria-label="Kapat">✕</button>
            </div>
            <div class="ob-cl-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><span style="width:${pct}%"></span></div>
            <ul class="ob-cl-list">
                ${CHECKLIST.map((t) => {
                    const ok = done.includes(t);
                    return `<li class="${ok ? 'ok' : ''}">
                        <span class="ob-cl-check" aria-hidden="true">${ok ? '✓' : esc(t.icon)}</span>
                        <span class="ob-cl-title">${esc(t.title)}</span>
                        ${ok ? '<span class="ob-cl-done">Tamam</span>' : `<button type="button" class="ob-cl-go" data-cl-go="${esc(t.id)}">Yap</button>`}
                    </li>`;
                }).join('')}
            </ul>
            <button type="button" class="ob-cl-hide" data-cl="dismiss">${all ? 'Listeyi kapat' : 'Bu listeyi bir daha gösterme'}</button>`;
    }

    function toggleChecklistPanel() {
        const existing = document.getElementById('ob-cl-panel');
        if (existing) { existing.remove(); return; }
        const panel = document.createElement('div');
        panel.id = 'ob-cl-panel';
        panel.className = 'ob-cl-panel';
        panel.setAttribute('role', 'dialog');
        panel.setAttribute('aria-label', 'Başlangıç listesi');
        panel.addEventListener('click', (e) => {
            const c = e.target.closest('[data-cl]');
            if (c?.dataset.cl === 'close') { panel.remove(); return; }
            if (c?.dataset.cl === 'dismiss') {
                panel.remove();
                if (state) { state.cl = 'dismissed'; save({ cl: 'dismissed' }); }
                renderChecklist();
                return;
            }
            const g = e.target.closest('[data-cl-go]');
            if (g) { panel.remove(); CHECKLIST.find((t) => t.id === g.dataset.clGo)?.go(); }
        });
        panel.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') { e.stopPropagation(); panel.remove(); document.getElementById('ob-cl-chip')?.focus(); }
        });
        panel.tabIndex = -1;
        document.body.appendChild(panel);
        clLastKey = '';
        renderChecklist();
        (panel.querySelector('.ob-cl-go') || panel.querySelector('.ob-cl-x'))?.focus({ preventScroll: true });
    }

    let autoChecked = false;
    let startedFor = null;   // durumun ait olduğu kullanıcı numarası
    let loading = false;
    async function start(user) {
        if (!user) return;
        // Başka hesaba geçildiyse (sayfa yenilenmeden çıkış + giriş) önceki hesabın durumu tamamen bırakılır
        if (started && startedFor !== user.id) reset();
        // Yeniden bağlanmada (connectToChat tekrar çağrılır) girişteki eski durum, bu oturumdaki güncellemeleri ezmesin
        if (started && state) { renderBadges(); return; }
        if (loading) return;
        let ob = user.onboarding;
        if (!ob) {
            // /api/login, /api/login/2fa ve kayıt yanıtları tanıtım durumunu taşımaz: oturumdan alınır
            loading = true;
            const g = gen;
            try {
                const d = await fetch('/api/me', { credentials: 'include' }).then((r) => r.json());
                ob = d && d.user && d.user.onboarding;
            } catch (_) { ob = null; }
            loading = false;
            if (g !== gen || !loggedIn()) return;
            if (!ob) return; // durum alınamadı: bu oturumda tanıtım gösterilmez (yanlışlıkla tekrar göstermektense)
        }
        state = ob;
        if (!Array.isArray(state.seen)) state.seen = [];
        started = true;
        startedFor = user.id;
        renderBadges();
        if (!autoChecked) {
            autoChecked = true;
            const g = gen;
            setTimeout(() => { if (g === gen) autoIntro(); }, 1200);
            // Liste, açılış pencereleri/tur bittikten sonra görünür ve arada bir tazelenir (profil, arkadaş, lobi değişince)
            setTimeout(() => whenQuiet(() => {
                renderChecklist();
                timers.add(setInterval(renderChecklist, 5000));
                timers.add(setInterval(updateChipVisibility, 700));
            }, 0, g), 2500);
        }
    }

    // Çıkışta: tüm durum, zamanlayıcılar ve ekrandaki tanıtım öğeleri temizlenir (kayıtlı durum sunucuda kalır).
    function reset() {
        gen++;
        timers.forEach((t) => clearInterval(t));
        timers.clear();
        clearTimeout(flushTimer);
        pendingSeen = new Set();
        if (tour) {
            window.removeEventListener('resize', placeTour);
            window.removeEventListener('scroll', placeTour, true);
            document.removeEventListener('keydown', tourKeys, true);
            tour.root.remove();
            tour = null;
        }
        document.getElementById('whatsnew-overlay')?.remove();
        document.getElementById('ob-cl-chip')?.remove();
        document.getElementById('ob-cl-panel')?.remove();
        document.querySelectorAll('.ob-new-pill, .ob-dot').forEach((n) => n.remove());
        document.querySelectorAll('.ob-new-dot').forEach((n) => n.classList.remove('ob-new-dot'));
        state = null;
        started = false;
        startedFor = null;
        autoChecked = false;
        clCelebrated = false;
        clLastKey = '';
    }

    document.getElementById('whatsnew-open-btn')?.addEventListener('click', () => {
        document.getElementById('topbar-menu-dropdown')?.style.setProperty('display', 'none');
        openWhatsNew();
    });
    document.getElementById('tour-start-btn')?.addEventListener('click', () => startTour());
    document.getElementById('whatsnew-settings-btn')?.addEventListener('click', () => {
        document.getElementById('settings-close-btn')?.click();
        setTimeout(openWhatsNew, 80);
    });

    return { start, onSettingsTab, onSettingsOpen, renderBadges, markSeen, save, unseenFeatures, openWhatsNew, startTour, task, renderChecklist, reset, get started() { return started; }, get state() { return state; } };
})();
window.SauranOnboarding = SauranOnboarding;
