// Pencere (modal) erişilebilirliği — tüm .modal-overlay pencereleri için ortak:
//  • Açılınca: role="dialog" + aria-modal + başlık bağlantısı; klavye odağı pencereye taşınır (açan öğe hatırlanır).
//  • Açıkken: Tab / Shift+Tab pencerenin dışına çıkmaz.
//  • Esc: en üstteki pencereyi kendi kapatma düğmesiyle kapatır (sayfanın kendi Esc işleyicisi kapattıysa bir şey yapmaz).
//  • Kapanınca: odak pencereyi açan öğeye döner.
//  • Yalnızca simge olan düğmelere (×, ⋯, emoji, SVG) ekran okuyucu adı verilir (title varsa o, yoksa bilinen simgeler).
(function () {
    'use strict';
    const OVERLAY = '.modal-overlay, .hubset-screen, #profile-modal';
    const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), [contenteditable="true"]';
    const lang = () => { try { return localStorage.getItem('sauran_lang') || 'tr'; } catch (_) { return 'tr'; } };
    const L = (tr, en) => (lang() === 'en' ? en : tr);

    const isShown = (el) => {
        if (!el || !el.isConnected) return false;
        const cs = getComputedStyle(el);
        return cs.display !== 'none' && cs.visibility !== 'hidden' && el.getClientRects().length > 0;
    };
    const openOverlays = () => Array.from(document.querySelectorAll(OVERLAY)).filter(isShown);
    // En üstteki: z-index büyük olan; eşitse DOM'da sonra gelen.
    function topOverlay() {
        const list = openOverlays();
        if (!list.length) return null;
        return list.reduce((best, el) => {
            const z = parseInt(getComputedStyle(el).zIndex, 10) || 0;
            const bz = parseInt(getComputedStyle(best).zIndex, 10) || 0;
            if (z > bz) return el;
            if (z === bz && (best.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING)) return el;
            return best;
        });
    }
    // Pencere listesinde olmayan, kendi klavye yönetimi olan üst katmanlar (özel durum, düzenleme geçmişi, ışık kutusu…)
    const FOREIGN_LAYERS = '.cstatus-backdrop, .edits-pop, .image-lightbox, .store-screen, .user-vol-pop, .lc-notify-pop';
    function foreignLayerOpen() {
        return Array.from(document.querySelectorAll(FOREIGN_LAYERS)).some(isShown);
    }
    // Pencerenin içinde açık bir açılır menü/ipucu varsa Esc önce onu kapatsın (sayfanın kendi işleyicisi).
    const INNER_POPUPS = '[role="menu"], [role="listbox"], .status-dropdown, .avatar-more-menu, .emoji-panel, [aria-expanded="true"]';
    function innerPopupOpen(ov) {
        return Array.from(ov.querySelectorAll(INNER_POPUPS)).some((el) => (el.getAttribute('aria-expanded') === 'true' ? true : isShown(el)));
    }
    function closeButtonOf(ov) {
        const btns = Array.from(ov.querySelectorAll('button')).filter(isShown);
        return btns.find((b) => /^[×✕✖]$/.test(b.textContent.trim()))
            || btns.find((b) => /(^close-|-close(-btn)?$)/.test(b.id || ''))
            || null;
    }
    function focusables(ov) {
        return Array.from(ov.querySelectorAll(FOCUSABLE)).filter((el) => isShown(el) && !el.closest('[inert], [aria-hidden="true"]'));
    }

    // ── Açılış / kapanış ──
    const openers = new WeakMap();
    const wasOpen = new WeakSet();
    function prepare(ov) {
        if (ov.querySelector('[role="dialog"]')) return; // iç kutu zaten iletişim kutusu: iç içe rol verilmez
        if (!ov.hasAttribute('role')) ov.setAttribute('role', 'dialog');
        if (!ov.hasAttribute('aria-modal')) ov.setAttribute('aria-modal', 'true');
        if (!ov.hasAttribute('aria-labelledby') && !ov.hasAttribute('aria-label')) {
            const h = ov.querySelector('h1, h2, h3, .modal-title, [class*="-title"]');
            if (h && h.textContent.trim()) {
                if (!h.id) h.id = `${ov.id || 'dlg'}-a11y-title`;
                ov.setAttribute('aria-labelledby', h.id);
            }
        }
    }
    // Pencereyi açan öğe: sayfa çoğu zaman açılır açılmaz içerideki bir alana odaklandığı için, pencere dışında en son
    // odaklanan/dokunulan öğe sürekli izlenir.
    let lastOutside = null;
    let lastOutsideAt = 0;
    const noteOutside = (e) => {
        const el = e.target && e.target.closest ? e.target.closest(FOCUSABLE) : null;
        if (el && !el.closest(OVERLAY)) { lastOutside = el; lastOutsideAt = Date.now(); }
    };
    const isTyping = (el) => Boolean(el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)));
    document.addEventListener('focusin', noteOutside, true);
    document.addEventListener('pointerdown', noteOutside, true);
    function onOpened(ov) {
        prepare(ov);
        const active = document.activeElement;
        const recent = Date.now() - lastOutsideAt < 1500 ? lastOutside : null;
        const opener = active && active !== document.body && !ov.contains(active) ? active : recent;
        if (opener && !ov.contains(opener) && !isTyping(opener)) openers.set(ov, opener);
        // Kendiliğinden açılan pencere (ör. ana ekrana ekle önerisi) kullanıcı yazarken odağı çalmasın.
        if (isTyping(active) && !ov.contains(active)) return;
        // Odak zaten içerideyse (ör. sayfa bir alana odakladı) dokunulmaz; değilse pencerenin kendisine (klavye açılmaz).
        requestAnimationFrame(() => {
            if (!isShown(ov) || ov.contains(document.activeElement)) return;
            const box = ov.firstElementChild && isShown(ov.firstElementChild) ? ov.firstElementChild : ov;
            if (!box.hasAttribute('tabindex')) box.setAttribute('tabindex', '-1');
            try { box.focus({ preventScroll: true }); } catch (_) { /* yoksay */ }
        });
    }
    function onClosed(ov) {
        const opener = openers.get(ov);
        openers.delete(ov);
        const active = document.activeElement;
        if (!opener || !opener.isConnected || !isShown(opener)) return;
        if (active && active !== document.body && !ov.contains(active)) return; // kullanıcı başka yere geçmiş
        try { opener.focus({ preventScroll: true }); } catch (_) { /* yoksay */ }
    }
    function scan() {
        document.querySelectorAll(OVERLAY).forEach((ov) => {
            const shown = isShown(ov);
            if (shown && !wasOpen.has(ov)) { wasOpen.add(ov); onOpened(ov); }
            else if (!shown && wasOpen.has(ov)) { wasOpen.delete(ov); onClosed(ov); }
        });
    }
    let scanQueued = false;
    const queueScan = () => { if (scanQueued) return; scanQueued = true; requestAnimationFrame(() => { scanQueued = false; scan(); }); };
    new MutationObserver((muts) => {
        for (const m of muts) {
            const el = m.target;
            if (el === document.body || (el.nodeType === 1 && el.matches(OVERLAY))) { queueScan(); return; }
        }
    }).observe(document.body, { attributes: true, attributeFilter: ['style', 'class', 'hidden'], subtree: true, childList: true });
    // Gövde sınıfı değişince açılan ekranlar için de (ör. CSS ile gösterilenler)
    document.addEventListener('DOMContentLoaded', scan);

    // ── Klavye ──
    let escTarget = null;
    let escOpenCount = 0;
    // Yakalama aşaması (ilk): Esc anında en üstteki pencere ve açık pencere sayısı not edilir.
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const open = openOverlays();
            const top = topOverlay();
            escTarget = top;
            escOpenCount = open.length;
            // Üst üste iki pencere: eski "alttakini kapat" işleyicileri devreye girmeden yalnızca üstteki kapatılır.
            if (top && open.length > 1 && !foreignLayerOpen() && !innerPopupOpen(top)) {
                const btn = closeButtonOf(top);
                if (btn) { e.preventDefault(); e.stopImmediatePropagation(); escTarget = null; btn.click(); }
            }
            return;
        }
        if (e.key !== 'Tab') return;
        const ov = topOverlay();
        if (!ov || foreignLayerOpen()) return;
        const act = document.activeElement;
        const otherDialog = act && act.closest ? act.closest('[role="dialog"], [aria-modal="true"]') : null;
        if (otherDialog && !ov.contains(otherDialog) && !otherDialog.contains(ov)) return;
        const f = focusables(ov);
        if (!f.length) { e.preventDefault(); return; }
        const first = f[0];
        const last = f[f.length - 1];
        const a = document.activeElement;
        if (!ov.contains(a)) { e.preventDefault(); first.focus(); }
        else if (e.shiftKey && (a === first || a === ov.firstElementChild || a === ov)) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && a === last) { e.preventDefault(); first.focus(); }
    }, true);
    // Kabarcık aşaması (son): sayfanın kendi işleyicisi ele almadıysa ve pencere hâlâ açıksa kapatma düğmesine basılır.
    window.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        const ov = escTarget;
        escTarget = null;
        if (!ov || e.defaultPrevented || !isShown(ov)) return;
        if (openOverlays().length !== escOpenCount) return; // başka bir işleyici bir pencereyi zaten kapattı
        if (foreignLayerOpen() || innerPopupOpen(ov)) return;
        const t = e.target;
        // Açık bir açılır menü/seçici içindeyken Esc önce onu kapatsın.
        if (t && t.closest && t.closest('[role="menu"], [role="listbox"], .emoji-panel')) return;
        const btn = closeButtonOf(ov);
        if (!btn) return;
        e.preventDefault();
        btn.click();
    });

    // ── Simge düğmelerine ekran okuyucu adı ──
    const ICON_NAMES = {
        '×': ['Kapat', 'Close'], '✕': ['Kapat', 'Close'], '✖': ['Kapat', 'Close'],
        '⋯': ['Diğer seçenekler', 'More options'], '…': ['Diğer seçenekler', 'More options'], '⋮': ['Diğer seçenekler', 'More options'],
        '‹': ['Geri', 'Back'], '←': ['Geri', 'Back'], '›': ['İleri', 'Next'], '→': ['İleri', 'Next'],
        '🗑': ['Sil', 'Delete'], '🗑️': ['Sil', 'Delete'], '✏️': ['Düzenle', 'Edit'], '✎': ['Düzenle', 'Edit'],
        '⚙️': ['Ayarlar', 'Settings'], '⚙': ['Ayarlar', 'Settings'], '🔍': ['Ara', 'Search'], '😊': ['Emoji', 'Emoji'],
        '+': ['Ekle', 'Add'], '＋': ['Ekle', 'Add'], '➤': ['Gönder', 'Send'], '▶': ['Oynat', 'Play']
    };
    const hasWords = (s) => /[\p{L}\p{N}]{2,}/u.test(s);
    function labelIconButtons(root) {
        const lg = lang();
        (root || document).querySelectorAll('button:not([aria-labelledby])').forEach((b) => {
            const auto = b.dataset.a11yAuto;
            if (b.hasAttribute('aria-label') && !auto) return; // sayfanın verdiği ad korunur
            if (auto && auto === lg) return;
            const txt = (b.textContent || '').trim();
            // title zaten erişilebilir ad sayılır; yalnızca title'sız simge düğmeleri adlandırılır.
            if (hasWords(txt) || b.getAttribute('title') || !ICON_NAMES[txt]) {
                if (auto) { b.removeAttribute('aria-label'); delete b.dataset.a11yAuto; }
                return;
            }
            b.setAttribute('aria-label', L(ICON_NAMES[txt][0], ICON_NAMES[txt][1]));
            b.dataset.a11yAuto = lg;
        });
    }
    let labelTimer = null;
    const queueLabels = () => {
        if (labelTimer) return;
        labelTimer = setTimeout(() => {
            labelTimer = null;
            (window.requestIdleCallback || ((fn) => setTimeout(fn, 0)))(() => labelIconButtons());
        }, 600);
    };
    new MutationObserver(queueLabels).observe(document.body, { childList: true, subtree: true });
    labelIconButtons();
    scan();
})();
