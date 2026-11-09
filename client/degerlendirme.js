// Resmi site: tasarım değerlendirmesi + öneri/görüş/şikayet (degerlendirme.html).
// Kimlik: oturum çerezi ya da "Sauran Geliştirici Ekibi" bildirimindeki kişiye özel bağlantı (#t=...).
// Bağlantı anahtarı adresin # kısmında gelir (sunucuya ya da başka sitelere gitmez); okununca adresten silinir,
// sekme açık kaldıkça sessionStorage'da tutulur ve yalnızca X-Sauran-Review-Token başlığıyla gönderilir.
(function () {
    'use strict';
    const $ = (id) => document.getElementById(id);
    const TOKEN_KEY = 'sauran_review_token';

    let token = '';
    const m = /(?:^|[#&])t=([A-Za-z0-9_-]{20,64})/.exec(location.hash);
    if (m) {
        token = m[1];
        try { sessionStorage.setItem(TOKEN_KEY, token); } catch (_) { /* yoksay */ }
        history.replaceState(null, '', location.pathname + location.search);
    } else {
        try { token = sessionStorage.getItem(TOKEN_KEY) || ''; } catch (_) { token = ''; }
    }

    function api(path, body) {
        const headers = { 'Content-Type': 'application/json' };
        if (token) headers['X-Sauran-Review-Token'] = token;
        return fetch(path, { method: body ? 'POST' : 'GET', headers, credentials: 'same-origin', body: body ? JSON.stringify(body) : undefined })
            .then((r) => r.json().catch(() => ({ success: false, error: 'Sunucuya ulaşılamadı.' })))
            .catch(() => ({ success: false, error: 'Bağlantı kurulamadı. İnternetini kontrol edip tekrar dene.' }));
    }

    // ── Yıldızlar ──
    const CRITERIA = [
        { key: 'look', label: 'Genel görünüm', hint: 'Renkler, düzen, yazılar', required: true },
        { key: 'ease', label: 'Kullanım kolaylığı', hint: 'Aradığını bulmak, geri dönmek' },
        { key: 'speed', label: 'Hız ve akıcılık', hint: 'Açılış, mesajlaşma, geçişler' },
        { key: 'voice', label: 'Sesli odalar', hint: 'Katılma, ses kalitesi, düğmeler' }
    ];
    const scores = { look: 0, ease: 0, speed: 0, voice: 0 };
    const WORDS = ['', 'Çok kötü', 'Kötü', 'İdare eder', 'İyi', 'Çok iyi'];

    $('rate-rows').innerHTML = CRITERIA.map((c) => `
        <div class="rate-row">
            <div class="rate-label">${c.label}${c.required ? ' <span class="req">*</span>' : ''}<small>${c.hint}</small></div>
            <div class="stars" role="radiogroup" aria-label="${c.label}" data-key="${c.key}">
                ${[1, 2, 3, 4, 5].map((n) => `<button type="button" class="star" role="radio" aria-checked="false" aria-label="${n} yıldız — ${WORDS[n]}" title="${WORDS[n]}" data-n="${n}" tabindex="${n === 1 ? 0 : -1}">★</button>`).join('')}
            </div>
        </div>`).join('');

    function paint(key) {
        const group = document.querySelector(`.stars[data-key="${key}"]`);
        group.querySelectorAll('.star').forEach((b) => {
            const n = Number(b.dataset.n);
            b.classList.toggle('on', n <= scores[key]);
            b.setAttribute('aria-checked', String(n === scores[key]));
            b.tabIndex = n === (scores[key] || 1) ? 0 : -1;
        });
    }

    document.querySelectorAll('.stars').forEach((group) => {
        const key = group.dataset.key;
        group.addEventListener('click', (e) => {
            const b = e.target.closest('.star');
            if (!b) return;
            const n = Number(b.dataset.n);
            scores[key] = scores[key] === n && key !== 'look' ? 0 : n; // isteğe bağlı satırda aynı yıldıza tekrar basmak puanı kaldırır
            paint(key);
            $('rv-msg').textContent = '';
        });
        group.addEventListener('keydown', (e) => {
            if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
            e.preventDefault();
            const step = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1 : -1;
            scores[key] = Math.min(5, Math.max(1, (scores[key] || 0) + step));
            paint(key);
            group.querySelector(`.star[data-n="${scores[key]}"]`).focus();
        });
    });

    // ── Sayaçlar ──
    [['rv-comment', 'rv-count'], ['ms-body', 'ms-count']].forEach(([input, out]) => {
        $(input).addEventListener('input', () => { $(out).textContent = $(input).value.length; });
    });

    // ── Konu seçimi ──
    let kind = 'oneri';
    const kindButtons = [...document.querySelectorAll('.kind')];
    function setKind(k) {
        kind = k;
        kindButtons.forEach((b) => { const on = b.dataset.kind === k; b.setAttribute('aria-checked', String(on)); b.tabIndex = on ? 0 : -1; });
    }
    kindButtons.forEach((b, i) => {
        b.addEventListener('click', () => setKind(b.dataset.kind));
        b.addEventListener('keydown', (e) => {
            if (!['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
            e.preventDefault();
            const next = kindButtons[(i + (e.key === 'ArrowRight' ? 1 : kindButtons.length - 1)) % kindButtons.length];
            setKind(next.dataset.kind); next.focus();
        });
    });
    const q = new URLSearchParams(location.search).get('konu');
    setKind(['oneri', 'gorus', 'sikayet', 'destek'].includes(q) ? q : 'oneri');

    function say(el, text, ok) { el.textContent = text; el.className = 'msg ' + (ok ? 'ok' : 'err'); }

    // ── Gönderimler ──
    $('rv-send').addEventListener('click', async () => {
        if (!scores.look) return say($('rv-msg'), 'Genel görünüm için bir puan seç.', false);
        const btn = $('rv-send');
        btn.disabled = true;
        const res = await api('/api/site-feedback/review', { scores: { ...scores }, comment: $('rv-comment').value });
        btn.disabled = false;
        if (!res.success) return say($('rv-msg'), res.error || 'Gönderilemedi.', false);
        btn.textContent = 'Değerlendirmeyi güncelle';
        say($('rv-msg'), 'Teşekkürler! Değerlendirmen ekibe ulaştı.', true);
    });

    $('ms-send').addEventListener('click', async () => {
        const body = $('ms-body').value.trim();
        if (body.length < 3) return say($('ms-msg'), 'Lütfen biraz daha ayrıntı yaz.', false);
        const btn = $('ms-send');
        btn.disabled = true;
        const res = await api('/api/site-feedback/message', { kind, body });
        btn.disabled = false;
        if (!res.success) return say($('ms-msg'), res.error || 'Gönderilemedi.', false);
        $('ms-body').value = '';
        $('ms-count').textContent = '0';
        say($('ms-msg'), 'Teşekkürler! Mesajın Sauran Geliştirici Ekibi\'ne ulaştı.', true);
    });

    // ── Kimlik ──
    function lock(on) {
        ['puanla', 'yaz'].forEach((id) => $(id).classList.toggle('locked', on));
        ['rv-send', 'ms-send'].forEach((id) => { $(id).disabled = on; });
    }

    (async function init() {
        lock(true);
        const me = await api('/api/site-feedback/me');
        const who = $('who');
        if (me.success && me.identified) {
            const name = document.createElement('strong');
            name.textContent = me.username;
            const line = who.querySelector('.grow');
            line.textContent = '';
            line.append(name, ' olarak yazıyorsun. Gönderdiklerin hesabınla birlikte yalnızca ekibe görünür.');
            lock(false);
            const r = me.review;
            if (r) {
                CRITERIA.forEach((c) => { scores[c.key] = r[c.key] || 0; paint(c.key); });
                $('rv-comment').value = r.comment || '';
                $('rv-count').textContent = $('rv-comment').value.length;
                $('rv-send').textContent = 'Değerlendirmeyi güncelle';
                say($('rv-msg'), 'Daha önce puan vermişsin; istersen değiştirebilirsin.', true);
            }
        } else {
            who.classList.add('warn');
            who.querySelector('.grow').textContent = me.success === false
                ? (me.error || 'Sunucuya ulaşılamadı.')
                : 'Kim olduğunu doğrulayamadık. Uygulamadaki "Sauran Geliştirici Ekibi" bildirimindeki bağlantıyla gel ya da hesabına giriş yap; sonra bu sayfayı yenile.';
            if (me.success !== false) {
                const a = document.createElement('a');
                a.className = 'btn small primary';
                a.href = '/app';
                a.textContent = 'Giriş yap';
                who.appendChild(a);
            }
        }
        if (location.hash === '#yaz' || new URLSearchParams(location.search).get('konu')) $('yaz').scrollIntoView({ block: 'start' });
    })();
})();
