/* Lobi Seviye 4 içerik ve görünüm: duyuru panosu, karşılama mesajı, vurgu rengi.
   script.js'ten SONRA yüklenir. Sahip düzenler (Lobi Ayarları > Özelleştirme); üyeler lobi bilgi penceresinde ve ilk girişte görür. */
(function () {
    'use strict';
    const el = (id) => document.getElementById(id);
    const esc = (s) => (typeof escapeHtml === 'function' ? escapeHtml(s) : String(s));
    const level = () => { try { return (hubBoost() || { level: 1 }).level; } catch (_) { return 1; } };

    // Vurgu rengi: lobi görünümünde --accent değişkenlerini boyar (düğmeler, sekmeler, vurgular).
    window.applyHubAccent = function () {
        const view = el('hub-detail-view');
        if (!view) return;
        const c = typeof currentHub !== 'undefined' && currentHub && currentHub.accent_color;
        if (c && /^#[0-9a-f]{6}$/i.test(c)) {
            view.style.setProperty('--accent', c);
            view.style.setProperty('--accent-soft', `color-mix(in srgb, ${c} 16%, transparent)`);
            view.style.setProperty('--accent-line', `color-mix(in srgb, ${c} 40%, transparent)`);
        } else {
            ['--accent', '--accent-soft', '--accent-line'].forEach((p) => view.style.removeProperty(p));
        }
    };

    // Karşılama mesajı: üye bu lobiyi bu mesajla ilk kez açtığında bir kez gösterilir.
    function hashText(t) { let h = 0; for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) | 0; return String(h); }
    window.maybeShowHubWelcome = function () {
        const hub = typeof currentHub !== 'undefined' ? currentHub : null;
        if (!hub || !hub.welcome_message || !hub.is_member || hub.is_owner) return;
        const key = `sauran.welcome.${hub.id}`;
        const h = hashText(hub.welcome_message);
        try { if (localStorage.getItem(key) === h) return; } catch (_) { /* depolama yok: her seferinde göstermeyelim */ return; }
        let ov = el('hub-welcome-modal');
        if (!ov) {
            ov = document.createElement('div');
            ov.id = 'hub-welcome-modal';
            ov.className = 'modal-overlay';
            document.body.appendChild(ov);
        }
        ov.innerHTML = `<div class="modal-box hub-welcome-box" role="dialog" aria-modal="true"><div class="hub-welcome-ic" aria-hidden="true">👋</div><h3>${esc(hub.name)}</h3><p class="hub-welcome-msg"></p><button type="button" class="hub-welcome-ok">Tamam</button></div>`;
        ov.querySelector('.hub-welcome-msg').textContent = hub.welcome_message;
        ov.style.display = 'flex';
        const done = () => { ov.style.display = 'none'; try { localStorage.setItem(key, h); } catch (_) { /* yoksay */ } };
        ov.querySelector('.hub-welcome-ok').addEventListener('click', done);
        ov.addEventListener('click', (e) => { if (e.target === ov) done(); });
    };

    // Lobi Ayarları kartı (yalnızca sahip)
    window.renderHubL4Card = function () {
        const box = el('hubset-l4-card');
        if (!box || typeof currentHub === 'undefined' || !currentHub) return;
        if (!currentHub.is_owner) { box.style.display = 'none'; return; }
        box.style.display = '';
        if (level() < 4) {
            box.innerHTML = `<div class="cz-card-title">Duyuru panosu, karşılama ve vurgu rengi</div><p class="hubset-hint">🔒 Seviye 4'te açılır (10 takviye). Açılınca lobine duyuru panosu, yeni üyeler için karşılama mesajı ve lobinin tüm arayüzünü boyayan bir vurgu rengi ekleyebilirsin.</p>`;
            return;
        }
        const h = currentHub;
        box.innerHTML = `<div class="cz-card-title">Duyuru panosu ve karşılama</div>
            <label class="profile-field-label" for="hubset-announce">📌 Duyuru panosu <small>(lobi bilgi penceresinde görünür, en fazla 500 karakter)</small></label>
            <textarea id="hubset-announce" class="about-me-input" maxlength="500" placeholder="Etkinlikler, kurallar, önemli haberler…">${esc(h.announcement || '')}</textarea>
            <label class="profile-field-label" for="hubset-welcome" style="margin-top:10px;">👋 Karşılama mesajı <small>(yeni üye lobiyi ilk açtığında bir kez gösterilir, en fazla 300 karakter)</small></label>
            <textarea id="hubset-welcome" class="about-me-input" maxlength="300" placeholder="Lobiye hoş geldin! Önce kuralları oku…">${esc(h.welcome_message || '')}</textarea>
            <div class="wf-actions"><span id="hubset-l4-status" class="hubset-hint"></span><button type="button" class="hubset-save-btn" id="hubset-l4-save">Kaydet</button></div>
            <div class="cz-card-title" style="margin-top:16px;">Lobi vurgu rengi</div>
            <div class="hub-bg-row"><input type="color" id="hubset-accent" value="${esc(h.accent_color || '#5cc8ff')}" aria-label="Vurgu rengi"><button id="hubset-accent-save" class="hub-create-image-btn" type="button">Uygula</button><button id="hubset-accent-clear" class="hub-create-image-btn" type="button" ${h.accent_color ? '' : 'disabled'}>Sıfırla</button></div>
            <p class="hubset-hint">Bu renk yalnızca bu lobinin içinde düğmeleri, sekmeleri ve vurguları boyar.</p>`;
    };

    document.addEventListener('click', async (e) => {
        const hub = typeof currentHub !== 'undefined' ? currentHub : null;
        if (!hub) return;
        const put = async (path, body) => {
            const r = await fetch(`/api/hubs/${hub.id}/${path}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(body) });
            return r.json();
        };
        if (e.target.closest('#hubset-l4-save')) {
            const d = await put('content', { announcement: el('hubset-announce').value, welcome_message: el('hubset-welcome').value });
            if (!d.success) { showToast(d.error || 'Kaydedilemedi.'); return; }
            hub.announcement = d.announcement; hub.welcome_message = d.welcome_message;
            el('hubset-l4-status').textContent = 'Kaydedildi ✓';
            return;
        }
        if (e.target.closest('#hubset-accent-save') || e.target.closest('#hubset-accent-clear')) {
            const clear = Boolean(e.target.closest('#hubset-accent-clear'));
            const d = await put('accent', { color: clear ? null : el('hubset-accent').value });
            if (!d.success) { showToast(d.error || 'Uygulanamadı.'); return; }
            hub.accent_color = d.accent_color;
            window.applyHubAccent(); window.renderHubL4Card();
            showToast(clear ? 'Vurgu rengi sıfırlandı.' : 'Vurgu rengi uygulandı.');
        }
    });
})();
