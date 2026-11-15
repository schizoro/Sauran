/* Profil giriş videoları: profil açılınca BİR KEZ oynayan, saydam arka planlı kısa animasyon (Discord'daki giriş efektleri gibi).
   - Biçim: Chrome/Android/masaüstü → saydam WebM (VP9 + alfa); Safari/iPhone → hareketli WebP (Safari WebM alfasını oynatamaz).
     WebM oynatılamazsa (engel/kod çözme hatası) otomatik WebP'ye düşer.
   - Parlaklık zarfı (glow): animasyon sakinken soluk, harekete geçtiği anda parlak, hareket bitince yine soluk.
     Saydamlık (opacity) ile yapılır; ekran kartında çalışır, işlemciyi yormaz.
   - Kart ekrandan çıkınca (pencere kapandı) medya durur ve silinir; yeniden açılınca baştan oynar.
   - Hareketi azalt açıksa oynatılmaz. Mağaza küçük resminde sabit kapak görseli (poster) gösterilir.
   - Dosyalar yalnızca efekt seçili bir profil açılınca indirilir.
   Bağlantı: fx-scenes.js gibi applyProfileEffect'i sarar; script.js, fx-pack.js ve fx-scenes.js'ten sonra yüklenir.
   - Döngü (loop, isteğe bağlı): giriş önde bir kez oynarken kartın ARKASINDA tam sahne bir MP4 sürekli döner
     (Discord'daki giriş + döngü). İsteğe bağlı introEnd: dosyanın başı (0 → introEnd) profil her açıldığında
     bir kez oynar, sonra yalnızca introEnd → son arası döner (tek MP4 ile giriş + sakin döngü). MP4/H.264 her cihazda donanımla çözülür; saydamlık gerekmez. Kendi parlaklık zarfı
     vardır (sakinken soluk, sahnedeki şimşek/enerji anlarında parlak) ve videonun zamanına bağlı kalır.
     Kart görünmezken / sekme gizliyken durur; hareketi azaltta sabit kapak (poster) görünür.
   Yeni video eklemek: VIDEOS'a kayıt + client/fx/ altına .webm/.webp/-poster.webp + sunucu izin listesi (server/db.js PROFILE_EFFECTS). */
(function () {
    'use strict';
    // glow: [saniye, saydamlık] noktaları; araları yumuşak geçiş. size: kart genişliğine oranla genişlik. anchor: 'bottom' | 'center'.
    // behind: true → animasyon kartın içeriğinin ARKASINDA oynar (butonlar/yazılar hep üstte ve okunur), false → önünde.
    const VIDEOS = {
        hellocat: { name: 'Selam Kedi', base: '/fx/selam-kedi', dur: 3.0, size: 0.78, anchor: 'bottom', behind: false,   // kullanıcı tercihi (2026-11-14): kedi butonların önünde
            glow: [[0, 0.35], [0.3, 0.35], [0.55, 1], [2.3, 1], [2.75, 0.35], [3.0, 0]] },
        // Mor Bakış: kullanıcının Kling ile ürettiği özgün karakter (fx-studio/video/kling-arkaplan-1.mov).
        // Yalnızca döngü (giriş videosu yok). 1,6 sn sonrası ileri + geri (ping-pong) birleştirildi: başa dönüşte dikiş/atlama yok.
        // Videodaki karanlıktan açılma, reveal ile (ilk açılışta 0 → tam, yumuşak) yapılır; böylece her turda kararmaz.
        violetgaze: { name: 'Mor Bakış',
            loop: { src: '/fx/mor-bakis.mp4', poster: '/fx/mor-bakis-poster.webp', dur: 8.75, pos: 'center 30%', zoom: 1.4, origin: '0% 51%', reveal: 1.4,   // mor göz avatarın/düğmenin altında kalmasın: adın sağına gelir
                // yumuşak nefes: sert sıçrama yok (kullanıcı geri bildirimi 2026-11-15)
                glow: [[0, 0.55], [4.375, 0.72], [8.75, 0.55]] } },
        // Hilal Mührü: kullanıcının Kling ile ürettiği özgün karakter (fx-studio/video/hilal-kaynak.mp4, 6,6 sn).
        // Giriş (0–6,6 sn): el yüzden iner, göz yanar, avuçta hilal oluşur, yumruk kapanır. Döngü (6,6–10,47 sn): son sakin
        // bölüm ileri + geri ve yarı hızda (saç/göz parıltısı), giriş sonundan dikişsiz devam eder.
        crescent: { name: 'Hilal Mührü',
            loop: { src: '/fx/hilal.mp4', poster: '/fx/hilal-poster.webp', dur: 10.467, introEnd: 6.6, pos: 'center 100%', reveal: 0.6,
                // giriş: sakin → göz yanınca parlak → hilal anında tam → yumrukla yumuşakça söner
                introGlow: [[0, 0.5], [1.4, 0.55], [2.2, 0.85], [3.4, 0.95], [5.0, 0.95], [6.0, 0.7], [6.6, 0.6]],
                glow: [[0, 0.6], [1.93, 0.68], [3.867, 0.6]] } }
    };
    const has = (k) => Object.prototype.hasOwnProperty.call(VIDEOS, k);
    const ua = navigator.userAgent || '';
    // iPhone/iPad'deki tüm tarayıcılar ve masaüstü Safari WebKit'tir; WebM alfayı desteklemez.
    const appleWebKit = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && 'ontouchend' in document) || (/AppleWebKit/.test(ua) && !/Chrome|Chromium|Edg|Android|Electron/.test(ua));
    // Firefox'un VP9 alfa desteği doğrulanmadı: güvenli tarafta kalıp WebP kullanılır
    const firefox = /Firefox\//.test(ua);
    const canWebm = !appleWebKit && !firefox && (() => { try { return document.createElement('video').canPlayType('video/webm; codecs="vp9"') !== ''; } catch (_) { return false; } })();
    const reducedMq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
    // Uygulamanın kendi ayarı esas (Ayarlar › Genel › Animasyonları azalt; 'Sistemle eşitle' açıksa sistem ayarını da bu sınıf taşır).
    // Sistem ayarına doğrudan bakılmaz: Windows'ta animasyon efektleri kapalıyken efektler hiç oynamıyordu (fx-pack ile aynı kural).
    const reduced = () => document.documentElement.classList.contains('reduce-motion');

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
    // Döngü sahnesinin kadrajı: pos = object-position; zoom + origin = yakınlaştırıp önemli noktayı (ör. göz) boş alana taşır
    function frame(el, L) {
        el.style.objectPosition = L.pos || 'center';
        if (L.zoom) { el.style.transform = 'scale(' + L.zoom + ')'; el.style.transformOrigin = L.origin || 'center'; }
    }
    function showPoster(b, L) {
        if (b.vid) b.vid.style.display = 'none';
        if (!b.img) {
            const img = new Image(); img.alt = ''; img.decoding = 'async'; img.src = L.poster; img.className = 'pfxv-bgv';
            frame(img, L); b.layer.insertBefore(img, b.layer.firstChild); b.img = img;
        }
        b.img.style.display = '';
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
        if (v.base) box.appendChild(layer);
        box.classList.add('has-pfxc');
        if (v.behind) box.classList.add('has-pfxv-behind');
        // Kart kendi içinde kayıyorsa (uzun profil) katman görünen alana sabitlenir (fx-scenes ile aynı)
        const onScroll = () => {
            const tr = box.scrollTop ? `translateY(${box.scrollTop}px)` : '';
            layer.style.transform = tr;
            if (inst.bg) inst.bg.layer.style.transform = tr;
        };
        box.addEventListener('scroll', onScroll, { passive: true });
        const inst = { box, key, v, layer, media: null, timer: 0, url: '', visible: false, playId: 0, bg: null, unscroll: () => box.removeEventListener('scroll', onScroll) };
        const thumb = box.classList.contains('st-prof');

        // Döngü katmanı: içeriğin arkasında, kartın zemininin üstünde
        if (v.loop) {
            const L = v.loop;
            box.classList.add('has-pfxv-behind');
            const bgl = document.createElement('div');
            bgl.className = 'pfxv pfxv-behind pfxv-bg';
            bgl.setAttribute('aria-hidden', 'true');
            bgl.style.opacity = String(L.glow[0][1]);
            box.insertBefore(bgl, box.firstChild);
            inst.bg = { layer: bgl, vid: null, img: null, anim: null, last: 0 };
            if (thumb || reduced()) showPoster(inst.bg, L);
        }
        onScroll();

        if (thumb) {        // mağaza küçük resmi: sabit kapak
            if (v.base) {
            const img = new Image(); img.alt = ''; img.decoding = 'async'; img.src = v.base + '-poster.webp'; img.className = 'pfxv-media';
            place(img, v); layer.appendChild(img);
            }
            all.add(inst); byBox.set(box, inst);
            return inst;
        }

        // restart: profil yeni açıldı → baştan + karanlıktan belirme. false: sekmeye dönüş / ayar değişimi → kaldığı yerden.
        inst.startBg = (restart) => {
            const b = inst.bg; if (!b) return;
            const L = v.loop;
            if (reduced()) { inst.stopBg(); showPoster(b, L); return; }   // hareketi azalt: sabit kapak
            if (document.hidden) return;
            if (!b.vid) {
                const vid = document.createElement('video');
                vid.className = 'pfxv-bgv'; vid.muted = true; vid.defaultMuted = true; vid.playsInline = true; vid.loop = !L.introEnd;
                vid.setAttribute('playsinline', ''); vid.setAttribute('muted', ''); vid.preload = 'metadata'; vid.disablePictureInPicture = true;
                frame(vid, L);   // poster özniteliği yok: ilk karede parlak kapak görünüp sonra kararmasın (reveal ile karanlıktan açılır)
                // Parlaklık zarfı videonun kendi zamanına bağlı: oynamaya başlayınca ve her başa dönüşte eşitlenir
                const start = L.introEnd || 0, span = L.dur - start;
                const sync = () => {
                    const t = vid.currentTime;
                    if (b.intro && t < start) { b.intro.currentTime = t * 1000; b.intro.play(); }
                    else if (b.intro) b.intro.cancel();      // giriş bitti: döngü zarfı devralır
                    if (b.anim) b.anim.currentTime = (Math.max(0, t - start) % span) * 1000;
                };
                // Giriş + döngü: dosya sonuna gelince döngü başına (introEnd) atlar; giriş bir daha ancak profil yeniden açılınca oynar
                if (start) vid.addEventListener('ended', () => {
                    try { vid.currentTime = start; } catch (_) {}
                    const p2 = vid.play(); if (p2 && p2.catch) p2.catch(() => {});
                });
                vid.addEventListener('playing', () => {
                    if (b.reveal && L.reveal && typeof vid.animate === 'function') {   // karanlıktan yumuşakça belirme
                        vid.animate([{ opacity: 0 }, { opacity: 1 }], { duration: L.reveal * 1000, easing: 'ease-out' });
                    }
                    vid.style.opacity = '';
                    b.reveal = false;
                    if (!b.anim && typeof b.layer.animate === 'function') {
                        b.anim = b.layer.animate(L.glow.map(([t, o]) => ({ offset: Math.min(1, t / span), opacity: o })), { duration: span * 1000, iterations: Infinity });
                        // giriş zarfı döngününkinden sonra oluşturulur: oynarken onu ezer, bitince (fill yok) döngü zarfı görünür
                        if (start && L.introGlow) b.intro = b.layer.animate(L.introGlow.map(([t, o]) => ({ offset: Math.min(1, t / start), opacity: o })), { duration: start * 1000 });
                    }
                    if (b.anim) b.anim.play();
                    sync();
                });
                vid.addEventListener('timeupdate', () => { if (vid.currentTime < b.last) sync(); b.last = vid.currentTime; });
                vid.src = L.src;
                b.vid = vid; b.layer.appendChild(vid);
            }
            b.vid.style.display = '';
            if (b.img) b.img.style.display = 'none';
            if (restart || b.vid.paused && !b.vid.currentTime) {
                try { b.vid.currentTime = 0; } catch (_) {}
                b.last = 0; b.reveal = true;
                if (L.reveal) b.vid.style.opacity = '0';   // 'playing' gelene kadar karanlık
            }
            const p = b.vid.play();
            if (p && p.catch) p.catch(() => {          // ör. iPhone düşük güç modu: video yerine sabit kapak
                if (!inst.visible || reduced()) return;
                b.vid.style.display = 'none'; showPoster(b, L);
            });
        };
        inst.stopBg = () => {
            const b = inst.bg; if (!b || !b.vid) return;
            try { b.vid.pause(); } catch (_) {}
            if (b.anim) b.anim.pause();
            if (b.intro) b.intro.pause();
        };

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
            if (!v.base || reduced() || document.hidden) return;   // yalnızca döngülü efektte giriş yok
            const id = inst.playId;
            // Dosya 2,5 sn içinde oynamaya başlamazsa (yavaş ağ) vazgeç: kedi profil açıldıktan çok sonra beklenmedik anda çıkmasın
            inst.deadline = setTimeout(() => { inst.deadline = 0; if (!inst.timer) finish(id); }, 2500);
            if (canWebm) playWebm(id); else playWebp(id);
        };
        // Kart görünür olunca (profil açıldı) baştan oynar; görünmez olunca (kapandı) durur ve temizlenir.
        inst.io = 'IntersectionObserver' in window ? new IntersectionObserver((es) => {
            const vis = es[es.length - 1].isIntersecting;
            if (vis && !inst.visible) { inst.visible = true; inst.play(); inst.startBg(true); }
            else if (!vis && inst.visible) { inst.visible = false; inst.clear(); inst.stopBg(); if (!box.isConnected) destroy(inst); }
        }) : null;
        if (inst.io) inst.io.observe(box); else { inst.visible = true; inst.play(); inst.startBg(true); }
        all.add(inst); byBox.set(box, inst);
        return inst;
    }
    function destroy(inst) {
        if (inst.dead) return;
        inst.dead = true;
        if (inst.clear) inst.clear();
        if (inst.stopBg) inst.stopBg();
        if (inst.bg) {
            if (inst.bg.vid) { try { inst.bg.vid.removeAttribute('src'); inst.bg.vid.load(); } catch (_) {} }
            if (inst.bg.anim) inst.bg.anim.cancel();
            if (inst.bg.intro) inst.bg.intro.cancel();
            inst.bg.layer.remove();
        }
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
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) all.forEach((i) => { if (i.clear) i.clear(); if (i.stopBg) i.stopBg(); });
        else all.forEach((i) => { if (i.visible && i.startBg) i.startBg(false); });
    });
    // Hareketi azalt açık profil kartındayken değişirse döngü hemen durur (kapak) / kaldığı yerden sürer
    const onMotionPref = () => all.forEach((i) => { if (i.visible && i.startBg) i.startBg(false); });
    if (reducedMq && reducedMq.addEventListener) reducedMq.addEventListener('change', onMotionPref);
    if ('MutationObserver' in window) {
        let was = document.documentElement.classList.contains('reduce-motion');
        new MutationObserver(() => {
            const now = document.documentElement.classList.contains('reduce-motion');
            if (now !== was) { was = now; onMotionPref(); }
        }).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    }

    window.SauranVideoFx = { VIDEOS, applyVideo, format: canWebm ? 'webm' : 'webp', size: () => all.size,
        state: () => [...all].map((i) => ({ key: i.key, visible: i.visible, playing: Boolean(i.media), tag: i.media && i.media.tagName,
            bg: i.bg ? { video: Boolean(i.bg.vid), paused: i.bg.vid ? i.bg.vid.paused : null, t: i.bg.vid ? +i.bg.vid.currentTime.toFixed(2) : null, op: +getComputedStyle(i.bg.layer).opacity } : null })) };

    const orig = window.applyProfileEffect;
    if (typeof orig === 'function') {
        window.applyProfileEffect = function (el, effect) {
            const out = orig.apply(this, arguments);
            try { if (el) applyVideo(el.closest('.profile-modal-box, .st-prof'), effect); } catch (e) { console.error(e); }
            return out;
        };
    }
})();
