/* Bildirimler penceresi görünümü: simge rozetleri, zaman, gün grupları, "Yeni" süzgeci, okunmamış sayacı.
   Mevcut render/işleyici mantığına dokunmaz; renderNotifications() çıktısını süsler. script.js'ten SONRA yüklenir. */
(function () {
    'use strict';
    const $ = (id) => document.getElementById(id);
    const esc = (s) => (typeof escapeHtml === 'function' ? escapeHtml(s) : String(s));

    const ICONS = {
        hub_invite: ['✉️', 'blue'], friend_request: ['👤', 'violet'], friend_request_accepted: ['🤝', 'green'],
        voice_muted: ['🔇', 'red'], voice_unmuted: ['🔈', 'green'], voice_kicked: ['👢', 'red'], voice_unblocked: ['🚪', 'green'],
        hub_mention: ['@', 'blue'], gift: ['🎁', 'gold'], platform_role_notice: ['🛡️', 'gold'], platform_role_revoked: ['⚖️', 'gray']
    };
    let mode = 'all'; // all | unread | read

    function parseDate(s) {
        if (!s) return null;
        const d = new Date(String(s).replace(' ', 'T') + (String(s).includes('Z') || String(s).includes('+') ? '' : 'Z'));
        return Number.isNaN(d.getTime()) ? null : d;
    }
    function ago(d) {
        const sec = Math.max(0, Math.round((Date.now() - d.getTime()) / 1000));
        if (sec < 60) return 'şimdi';
        const m = Math.round(sec / 60); if (m < 60) return m + ' dk';
        const h = Math.round(m / 60); if (h < 24) return h + ' sa';
        const dd = Math.round(h / 24); if (dd < 7) return dd + ' gün';
        return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
    }
    function groupOf(d) {
        if (!d) return 'Daha önce';
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const day = new Date(d); day.setHours(0, 0, 0, 0);
        const diff = Math.round((today - day) / 86400000);
        if (diff <= 0) return 'Bugün';
        if (diff === 1) return 'Dün';
        if (diff < 7) return 'Bu hafta';
        return 'Daha önce';
    }

    // Süzgeç: Hepsi / Okunmamış (yanıt bekleyen ya da henüz okunmamış) / Okundu (soluklaşan kartlar)
    function applyMode(box) {
        if (!box) return;
        box.classList.toggle('nc-only-unread', mode === 'unread');
        box.classList.toggle('nc-only-read', mode === 'read');
        box.querySelectorAll('.nc-filter button').forEach((b) => b.classList.toggle('on', b.dataset.ncf === mode));
        // boş grup başlıkları gizlensin
        box.querySelectorAll('.nc-group').forEach((g) => {
            let n = g.nextElementSibling, any = false;
            while (n && !n.classList.contains('nc-group')) { if (n.classList.contains('notification-card') && getComputedStyle(n).display !== 'none') any = true; n = n.nextElementSibling; }
            g.style.display = any ? '' : 'none';
        });
    }

    function decorateHeader(unread) {
        const head = document.querySelector('#notifications-modal .modal-header');
        if (!head) return;
        let cnt = head.querySelector('.nm-count');
        if (!cnt) {
            cnt = document.createElement('b');
            cnt.className = 'nm-count';
            const title = head.querySelector('span');
            if (title) title.insertAdjacentElement('afterend', cnt);
        }
        cnt.textContent = unread > 0 ? unread + ' yeni' : 'Hepsi okundu';
        cnt.classList.toggle('zero', unread === 0);
    }

    function decorate(list) {
        const box = $('notifications-list');
        if (!box) return;
        const byId = new Map((list || []).map((n) => [String(n.id), n]));
        const cards = [...box.querySelectorAll('.notification-card')];
        let unread = 0;
        let lastGroup = null;
        cards.forEach((card) => {
            if (card.dataset.ncDone) return;
            card.dataset.ncDone = '1';
            const n = byId.get(card.dataset.notifId) || {};
            const type = card.dataset.notifType;
            const [emoji, tone] = ICONS[type] || ['🔔', 'blue'];
            // Metnin başındaki emoji (artık rozette) tekrarlanmasın
            const txt = card.querySelector('.notification-text');
            if (txt && txt.firstChild && txt.firstChild.nodeType === 3) txt.firstChild.textContent = txt.firstChild.textContent.replace(/^\s*(🔇|👢|🚪|🔈|🎁|@)\s*/u, '');
            const body = document.createElement('div');
            body.className = 'nc-body';
            while (card.firstChild) body.appendChild(card.firstChild);
            const ic = document.createElement('span');
            ic.className = 'nc-ic nc-ic-' + tone;
            ic.setAttribute('aria-hidden', 'true');
            ic.textContent = emoji;
            card.append(ic, body);
            const d = parseDate(n.created_at);
            if (d) {
                const t = document.createElement('time');
                t.className = 'nc-time'; t.textContent = ago(d); t.title = d.toLocaleString('tr-TR');
                card.appendChild(t);
            }
            card.dataset.ncGroup = groupOf(d);
        });
        // gün başlıkları + yeni işareti
        box.querySelectorAll('.nc-group').forEach((g) => g.remove());
        box.querySelectorAll('.notification-card').forEach((card) => {
            const isNew = !card.classList.contains('notification-seen');
            card.classList.toggle('nc-new', isNew);
            if (isNew) unread += 1;
            const g = card.dataset.ncGroup;
            if (g !== lastGroup) {
                lastGroup = g;
                const h = document.createElement('div');
                h.className = 'nc-group'; h.textContent = g;
                card.parentNode.insertBefore(h, card);
            }
        });
        // süzgeç çipleri (araç çubuğunun yanına, bir kez)
        const tb = box.querySelector('.notifications-toolbar');
        if (tb && !box.querySelector('.nc-filter')) {
            const f = document.createElement('div');
            f.className = 'nc-filter';
            f.innerHTML = '<button type="button" data-ncf="all">Hepsi</button><button type="button" data-ncf="unread">Okunmamış</button><button type="button" data-ncf="read">Okundu</button>';
            tb.insertAdjacentElement('afterend', f);
        }
        applyMode(box);
        decorateHeader(unread);
        // boş durum
        const empty = box.querySelector('.notifications-empty');
        if (empty && !empty.querySelector('.nc-empty-ic')) {
            empty.innerHTML = '<span class="nc-empty-ic">🔔</span><b>Her şey yolunda</b><small>Yeni bildirimin yok.</small>';
            decorateHeader(0);
        }
    }

    const orig = window.renderNotifications;
    if (typeof orig === 'function') {
        window.renderNotifications = function (list) {
            const out = orig.apply(this, arguments);
            try { decorate(list); } catch (e) { console.warn('Bildirim görünümü uygulanamadı:', e); }
            return out;
        };
    }
    document.addEventListener('click', (e) => {
        const b = e.target.closest && e.target.closest('.nc-filter button');
        if (!b) return;
        mode = b.dataset.ncf;
        applyMode($('notifications-list'));
    });
    // Kart okundu olunca (soluklaşınca) sayaç ve süzgeç güncellensin
    const box = $('notifications-list');
    if (box) new MutationObserver(() => {
        const unread = box.querySelectorAll('.notification-card:not(.notification-seen)').length;
        box.querySelectorAll('.notification-card').forEach((c) => c.classList.toggle('nc-new', !c.classList.contains('notification-seen')));
        decorateHeader(unread);
        applyMode(box);
    }).observe(box, { subtree: true, attributes: true, attributeFilter: ['class'] });
})();
