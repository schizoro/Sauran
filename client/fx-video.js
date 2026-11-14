/* Profil giriş videoları: profil açılınca BİR KEZ oynayan, saydam arka planlı kısa animasyon (Discord'daki giriş efektleri gibi).
   - Biçim: Chrome/Android/masaüstü → saydam WebM (VP9 + alfa); Safari/iPhone → hareketli WebP (Safari WebM alfasını oynatamaz).
     WebM oynatılamazsa (engel/kod çözme hatası) otomatik WebP'ye düşer.
   - Parlaklık zarfı (glow): animasyon sakinken soluk, harekete geçtiği anda parlak, hareket bitince yine soluk.
     Saydamlık (opacity) ile yapılır; ekran kartında çalışır, işlemciyi yormaz.
   - Kart ekrandan çıkınca (pencere kapandı) medya durur ve silinir; yeniden açılınca baştan oynar.
   - Hareketi azalt açıksa oynatılmaz. Mağaza küçük resminde sabit kapak görseli (poster) gösterilir.
   - Dosyalar yalnızca efekt seçili bir profil açılınca indirilir.
   Bağlantı: fx-scenes.js gibi applyProfileEffect'i sarar; script.js, fx-pack.js ve fx-scenes.js'ten sonra yüklenir.
   Yeni video eklemek: VIDEOS'a kayıt + client/fx/ altına .webm/.webp/-poster.webp + sunucu izin listesi (server/db.js PROFILE_EFFECTS). */
(function () {
    'use strict';
    // glow: [saniye, saydamlık] noktaları; araları yumuşak geçiş. size: kart genişliğine oranla genişlik. anchor: 'bottom' | 'center'.
    // behind: true → animasyon kartın içeriğinin ARKASINDA oynar (butonlar/yazılar hep üstte ve okunur), false → önünde.
    const VIDEOS = {
        hellocat: { name: 'Selam Kedi', base: '/fx/selam-kedi', dur: 3.0, size: 0.78, anchor: 'bottom', behind: false,   // kullanıcı tercihi (2026-11-14): kedi butonların önünde
            glow: [[0, 0.35], [0.3, 0.35], [0.55, 1], [2.3, 1], [2.75, 0.35], [3.0, 0]] }
    };
    const has = (k) => Object.prototype.hasOwnProperty.call(VIDEOS, k);
    const ua = navigator.userAgent || '';
    // iPhone/iPad'deki tüm tarayıcılar ve masaüstü Safari WebKit'tir; WebM alfayı desteklemez.
    const appleWebKit = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && 'ontouchend' in document) || (/AppleWebKit/.test(ua) && !/Chrome|Chromium|Edg|Android|Electron/.test(ua));
    // Firefox'un VP9 alfa desteği doğrulanmadı: güvenli tarafta kalıp WebP kullanılır
    const firefox = /Firefox\//.test(ua);
    const canWebm = !appleWebKit && !firefox && (() => { try { return document.createElement('video').canPlayType('video/webm; codecs="vp9"') !== ''; } catch (_) { return false; } })();
    const reducedMq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
    const reduced = () => (reducedMq && reducedMq.matches) || document.documentElement.classList.contains('reduce-motion');

    const blobs = {};   // WebP: her oynatmada yeni bir nesne adresi (aynı adres animasyonu baştan başlatmaz)
    function webpBlob(v) {
        if (!blobs[v.base]) blobs[v.base] = fetch(v.base + '.webp').then((r) => { if (!r.ok) throw new Error(r.status); return r.blob(); }).catch((e) => { delete blobs[v.base]; throw e; });
        return blobs[v.base];
    }

    const byBox = new WeakMap();
    const all = new Set();

    function place(el, v) {
        el.style.width = (v.size * 100) + '%';
        el.style.left = ((1 - v.size) * 50) + '%';
        if (v.anchor === 'center') el.style.top = '50%', el.style.transform = 'translateY(-50%)';
        else el.style.bottom = '0';
    }
    function glow(el, v) {
        if (typeof el.animate !== 'function') return null;
        const kf = v.glow.map(([t, o]) => ({ offset: Math.min(1, t / v.dur), opacity: o }));
        return el.animate(kf, { duration: v.dur * 1000, fill: 'forwards', easing: 'linear' });
    }

    function mount(box, key) {
        const v = VIDEOS[key];
        const layer = document.createElement('div');
        layer.className = 'pfxv' + (v.behind ? ' pfxv-behind' : '');
        layer.setAttribute('aria-hidden', 'true');
        box.appendChild(layer);
        box.classList.add('has-pfxc');
        if (v.behind) box.classList.add('has-pfxv-behind');
        // Kart kendi içinde kayıyorsa (uzun profil) katman görünen alana sabitlenir (fx-scenes ile aynı)
        const onScroll = () => { layer.style.transform = box.scrollTop ? `translateY(${box.scrollTop}px)` : ''; };
        box.addEventListener('scroll', onScroll, { passive: true });
        onScroll();
        const inst = { box, key, v, layer, media: null, timer: 0, url: '', visible: false, playId: 0, unscroll: () => box.removeEventListener('scroll', onScroll) };

        if (box.classList.contains('st-prof')) {        // mağaza küçük resmi: sabit kapak
            const img = new Image(); img.alt = ''; img.decoding = 'async'; img.src = v.base + '-poster.webp'; img.className = 'pfxv-media';
            place(img, v); layer.appendChild(img);
            all.add(inst); byBox.set(box, inst);
            return inst;
        }

        inst.clear = () => {
            inst.playId++;
            if (inst.timer) { clearTimeout(inst.timer); inst.timer = 0; }
            if (inst.deadline) { clearTimeout(inst.deadline); inst.deadline = 0; }
            if (inst.media) {
                if (inst.media.tagName === 'VIDEO') { try { inst.media.pause(); inst.media.removeAttribute('src'); inst.media.load(); } catch (_) {} }
                inst.media.remove(); inst.media = null;
            }
            if (inst.url) { URL.revokeObjectURL(inst.url); inst.url = ''; }
        };
        const finish = (id) => { if (id === inst.playId) inst.clear(); };
        const armEnd = (id) => {   // oynamaya başladı: en geç süre bitince silinir
            if (inst.deadline) { clearTimeout(inst.deadline); inst.deadline = 0; }
            if (inst.timer) clearTimeout(inst.timer);
            inst.timer = setTimeout(() => finish(id), v.dur * 1000 + 300);
        };

        function playWebp(id) {
            webpBlob(v).then((blob) => {
                if (id !== inst.playId || !inst.visible || !box.isConnected) return;
                inst.url = URL.createObjectURL(blob);
                const img = new Image(); img.alt = ''; img.className = 'pfxv-media'; place(img, v);
                img.onload = () => { if (id !== inst.playId) return; img.style.visibility = ''; glow(img, v); armEnd(id); };
                img.onerror = () => finish(id);
                img.style.visibility = 'hidden';     // yüklenmeden boş kutu görünmesin
                img.src = inst.url;
                inst.media = img; layer.appendChild(img);
            }).catch(() => finish(id));
        }
        function playWebm(id) {
            const vid = document.createElement('video');
            vid.className = 'pfxv-media'; vid.muted = true; vid.defaultMuted = true; vid.playsInline = true;
            vid.setAttribute('playsinline', ''); vid.setAttribute('muted', ''); vid.preload = 'auto'; vid.disablePictureInPicture = true;
            place(vid, v);
            vid.style.visibility = 'hidden';         // ilk kare gelmeden siyah/boş kutu görünmesin
            let fell = false;
            const fallback = () => {
                if (fell || id !== inst.playId) return; fell = true;
                if (inst.timer) { clearTimeout(inst.timer); inst.timer = 0; }   // WebM'in zamanlayıcısı WebP'yi yarıda kesmesin
                vid.remove(); inst.media = null; playWebp(id);
            };
            vid.addEventListener('playing', () => { if (id !== inst.playId) return; vid.style.visibility = ''; glow(vid, v); armEnd(id); }, { once: true });
            vid.addEventListener('ended', () => finish(id), { once: true });
            vid.addEventListener('error', fallback, { once: true });
            vid.src = v.base + '.webm';
            inst.media = vid; layer.appendChild(vid);
            const p = vid.play();
            if (p && p.catch) p.catch(fallback);
        }
        inst.play = () => {
            inst.clear();
            if (reduced() || document.hidden) return;
            const id = inst.playId;
            // Dosya 2,5 sn içinde oynamaya başlamazsa (yavaş ağ) vazgeç: kedi profil açıldıktan çok sonra beklenmedik anda çıkmasın
            inst.deadline = setTimeout(() => { inst.deadline = 0; if (!inst.timer) finish(id); }, 2500);
            if (canWebm) playWebm(id); else playWebp(id);
        };
        // Kart görünür olunca (profil açıldı) baştan oynar; görünmez olunca (kapandı) durur ve temizlenir.
        inst.io = 'IntersectionObserver' in window ? new IntersectionObserver((es) => {
            const vis = es[es.length - 1].isIntersecting;
            if (vis && !inst.visible) { inst.visible = true; inst.play(); }
            else if (!vis && inst.visible) { inst.visible = false; inst.clear(); if (!box.isConnected) destroy(inst); }
        }) : null;
        if (inst.io) inst.io.observe(box); else { inst.visible = true; inst.play(); }
        all.add(inst); byBox.set(box, inst);
        return inst;
    }
    function destroy(inst) {
        if (inst.dead) return;
        inst.dead = true;
        if (inst.clear) inst.clear();
        inst.unscroll();
        if (inst.io) inst.io.disconnect();
        inst.layer.remove();
        inst.box.classList.remove('has-pfxv-behind');
        all.delete(inst); byBox.delete(inst.box);
    }
    function applyVideo(box, effect) {
        if (!box) return;
        const cur = byBox.get(box);
        if (cur && cur.key === effect) { box.classList.add('has-pfxc'); return; }
        if (cur) destroy(cur);
        if (has(effect)) mount(box, effect);
        all.forEach((i) => { if (!i.box.isConnected) destroy(i); });
    }
    document.addEventListener('visibilitychange', () => { if (document.hidden) all.forEach((i) => i.clear && i.clear()); });

    window.SauranVideoFx = { VIDEOS, applyVideo, format: canWebm ? 'webm' : 'webp', size: () => all.size,
        state: () => [...all].map((i) => ({ key: i.key, visible: i.visible, playing: Boolean(i.media), tag: i.media && i.media.tagName })) };

    const orig = window.applyProfileEffect;
    if (typeof orig === 'function') {
        window.applyProfileEffect = function (el, effect) {
            const out = orig.apply(this, arguments);
            try { if (el) applyVideo(el.closest('.profile-modal-box, .st-prof'), effect); } catch (e) { console.error(e); }
            return out;
        };
    }
})();
