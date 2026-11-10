/* Dosya önizleme tepsisi: yapıştırılan (Ctrl+V), sürükle-bırakılan ya da + menüsünden seçilen dosyalar yazma kutusunun
   üstünde bekler; × ile çıkarılır. Gönder'e basınca önce dosyalar (sırayla), sonra yazılan metin açıklama olarak gönderilir.
   Gönderim mevcut yollarla yapılır (script.js wireAttachMenu → window.attachSenders[prefix]). script.js'ten SONRA yüklenir. */
(function () {
    'use strict';
    const MAX_FILES = 10;
    const esc = (s) => (typeof escapeHtml === 'function' ? escapeHtml(s) : String(s));
    const toast = (m) => { if (typeof showToast === 'function') showToast(m); };
    const fmtSize = (n) => (typeof formatFileSize === 'function' ? formatFileSize(n) : `${Math.round(n / 1024)} KB`);
    const maxBytes = () => (typeof currentFileMaxBytes === 'function' ? currentFileMaxBytes() : 25 * 1024 * 1024);

    const KINDS = {
        hub: { input: 'hub-message-input', drop: 'hub-detail-view', ready: () => typeof currentHub !== 'undefined' && currentHub },
        dm: { input: 'dm-message-input', drop: 'dm-modal', ready: () => typeof activeDmUserId !== 'undefined' && activeDmUserId && !(typeof dmReadOnly !== 'undefined' && dmReadOnly) }
    };
    const state = { hub: [], dm: [] }; // { file, url }

    function trayFor(kind) {
        const input = document.getElementById(KINDS[kind].input);
        const form = input && input.form;
        if (!form) return null;
        // Yazma satırı yatay (flex) olduğundan tepsi formun içine değil, hemen üstüne konur.
        let tray = form.previousElementSibling && form.previousElementSibling.classList.contains('attach-tray') ? form.previousElementSibling : null;
        if (!tray) {
            tray = document.createElement('div');
            tray.className = 'attach-tray';
            tray.hidden = true;
            tray.setAttribute('aria-label', 'Gönderilecek dosyalar');
            form.parentNode.insertBefore(tray, form);
            tray.addEventListener('click', (e) => {
                const b = e.target.closest('[data-tray-remove]');
                if (!b) return;
                e.preventDefault();
                const i = Number(b.dataset.trayRemove);
                const [gone] = state[kind].splice(i, 1);
                if (gone && gone.url) URL.revokeObjectURL(gone.url);
                render(kind);
                input.focus();
            });
        }
        return tray;
    }

    function render(kind) {
        const tray = trayFor(kind);
        if (!tray) return;
        const items = state[kind];
        tray.hidden = !items.length;
        if (!items.length) { tray.innerHTML = ''; return; }
        const total = items.reduce((n, it) => n + it.file.size, 0);
        tray.innerHTML = `<div class="attach-tray-row">${items.map((it, i) => {
            const f = it.file;
            const thumb = f.type.startsWith('image/') && it.url
                ? `<img src="${it.url}" alt="">`
                : `<span class="attach-tray-icon">${f.type.startsWith('video/') ? '<svg viewBox="0 0 24 24"><rect x="3" y="6" width="13" height="12" rx="2"/><path d="M16 10l5-3v10l-5-3z"/></svg>' : '<svg viewBox="0 0 24 24"><path d="M6 3h8l4 4v14H6zM14 3v4h4"/></svg>'}<small>${esc(f.name)}</small></span>`;
            return `<div class="attach-tray-item" title="${esc(f.name)} · ${esc(fmtSize(f.size))}">${thumb}<button type="button" class="attach-tray-x" data-tray-remove="${i}" aria-label="${esc(f.name)} kaldır">×</button></div>`;
        }).join('')}</div><div class="attach-tray-meta">${items.length} dosya · ${esc(fmtSize(total))}<span> · Gönder'e basınca gönderilir</span></div>`;
    }

    // Dış API: + menüsü de buraya ekler
    window.attachTrayAdd = function (kind, files) {
        if (!KINDS[kind] || !KINDS[kind].ready()) return;
        let skippedBig = 0, skippedMany = 0;
        for (const f of files) {
            if (!f || !f.size) continue;
            if (state[kind].length >= MAX_FILES) { skippedMany += 1; continue; }
            if (f.size > maxBytes()) { skippedBig += 1; continue; }
            const url = f.type.startsWith('image/') ? URL.createObjectURL(f) : null;
            state[kind].push({ file: f, url });
        }
        if (skippedBig) toast(`${skippedBig} dosya boyut sınırını aşıyor (${typeof fileMaxLabel === 'function' ? fileMaxLabel() : ''}).`);
        if (skippedMany) toast(`En fazla ${MAX_FILES} dosya birlikte gönderilebilir.`);
        render(kind);
        document.getElementById(KINDS[kind].input)?.focus();
    };

    function clear(kind) {
        state[kind].forEach((it) => { if (it.url) URL.revokeObjectURL(it.url); });
        state[kind] = [];
        render(kind);
    }

    // ── Gönderim: önce dosyalar, sonra metin (açıklama) ──
    const bypass = new WeakSet();
    document.addEventListener('submit', async (e) => {
        const form = e.target;
        const kind = Object.keys(KINDS).find((k) => document.getElementById(KINDS[k].input)?.form === form);
        if (!kind || !state[kind].length || bypass.has(form)) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        const send = window.attachSenders && window.attachSenders[kind];
        if (!send) return;
        const items = state[kind].slice();
        state[kind] = [];
        render(kind);
        for (const it of items) {
            try { await send(it.file); } catch (err) { console.error('Dosya gönderilemedi:', err); }
            if (it.url) URL.revokeObjectURL(it.url);
        }
        const input = document.getElementById(KINDS[kind].input);
        if (input && input.value.trim()) {
            bypass.add(form);
            try { form.requestSubmit(); } finally { setTimeout(() => bypass.delete(form), 0); }
        }
    }, true);

    // ── Yapıştırma ──
    Object.keys(KINDS).forEach((kind) => {
        const input = document.getElementById(KINDS[kind].input);
        input?.addEventListener('paste', (e) => {
            const files = [...(e.clipboardData?.files || [])];
            if (!files.length) return; // metin yapıştırması olduğu gibi kalır
            e.preventDefault();
            window.attachTrayAdd(kind, files);
        });
    });

    // ── Sürükle-bırak ──
    function wireDrop(kind) {
        const zone = document.getElementById(KINDS[kind].drop);
        if (!zone) return;
        let depth = 0;
        const overlay = document.createElement('div');
        overlay.className = 'attach-drop';
        overlay.innerHTML = '<div><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 18a4 4 0 0 1-.6-8A6 6 0 0 1 18 9a4.5 4.5 0 0 1-1 9M12 12v8M9 15l3-3 3 3"/></svg><b>Eklemek için bırak</b><small>Dosyalar gönderilmeden önce yazma kutusunun üstünde bekler</small></div>';
        overlay.hidden = true;
        if (getComputedStyle(zone).position === 'static') zone.style.position = 'relative'; // katman yerleşimi için
        zone.appendChild(overlay);
        const hasFiles = (e) => [...(e.dataTransfer?.types || [])].includes('Files');
        zone.addEventListener('dragenter', (e) => { if (!hasFiles(e) || !KINDS[kind].ready()) return; e.preventDefault(); depth += 1; overlay.hidden = false; });
        zone.addEventListener('dragover', (e) => { if (!hasFiles(e) || !KINDS[kind].ready()) return; e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; });
        zone.addEventListener('dragleave', () => { depth = Math.max(0, depth - 1); if (!depth) overlay.hidden = true; });
        zone.addEventListener('drop', (e) => {
            if (!hasFiles(e)) return;
            e.preventDefault();
            depth = 0; overlay.hidden = true;
            window.attachTrayAdd(kind, [...e.dataTransfer.files]);
        });
    }
    wireDrop('hub');
    wireDrop('dm');
    // Pencere dışına bırakılan dosya tarayıcıda açılıp uygulamadan çıkılmasın
    window.addEventListener('dragover', (e) => { if ([...(e.dataTransfer?.types || [])].includes('Files')) e.preventDefault(); });
    window.addEventListener('drop', (e) => { if ([...(e.dataTransfer?.types || [])].includes('Files')) e.preventDefault(); });

    // Sohbet değişince bekleyen dosyalar başka sohbete gitmesin
    let lastHub = null, lastDm = null;
    setInterval(() => {
        const h = typeof currentHub !== 'undefined' && currentHub ? `${currentHub.id}:${typeof currentChannelId !== 'undefined' ? currentChannelId : ''}` : null;
        const d = typeof activeDmUserId !== 'undefined' ? activeDmUserId : null;
        if (h !== lastHub) { if (state.hub.length) clear('hub'); lastHub = h; }
        if (d !== lastDm) { if (state.dm.length) clear('dm'); lastDm = d; }
    }, 500);
})();
