/* Sauran Atmosphere ses motoru — dosya gerektirmeyen, tamamen özgün (WebAudio ile üretilen) sesler.
   Her ses AYNI zarfı izler:  0–3 sn  IMPACT (güçlü giriş)  →  3–6 sn  FADE (kademeli düşüş)  →  6 sn+  AMBIENT (düşük seviye, sakin).
   Profil sesi, lobi sesi ve ▶ Önizleme aynı fonksiyonu kullanır; önizleme gerçek kullanımın birebir aynısıdır.
   Lisanslı ses dosyası eklenirse RECIPES'e `file` tabanlı bir tarif eklenebilir (arayüz değişmez). */
(function () {
    'use strict';
    const IMPACT_END = 3, FADE_END = 6, AMBIENT_LEVEL = 0.28, MAX_SECONDS = 90, MAKEUP = 1.8;
    let ctx = null, master = null, noiseBuf = null, current = null;

    function getCtx() {
        if (!ctx) {
            const C = window.AudioContext || window.webkitAudioContext;
            if (!C) return null;
            ctx = new C();
            master = ctx.createDynamicsCompressor();
            master.threshold.value = -14; master.ratio.value = 4;
            master.connect(ctx.destination);
            noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
            const d = noiseBuf.getChannelData(0);
            for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        }
        if (ctx.state === 'suspended') ctx.resume();
        return ctx;
    }

    function osc(dest, type, f, t, dur, gain, o = {}) {
        const n = ctx.createOscillator(), g = ctx.createGain();
        n.type = type; n.frequency.setValueAtTime(f, t);
        if (o.to) n.frequency.exponentialRampToValueAtTime(o.to, t + dur);
        if (o.detune) n.detune.value = o.detune;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(gain, t + (o.att || 0.006));
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        let out = g;
        if (o.lp) { const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = o.lp; n.connect(lp); lp.connect(g); } else n.connect(g);
        out.connect(dest); n.start(t); n.stop(t + dur + 0.05);
    }
    function noise(dest, t, dur, gain, type, f, fTo) {
        const s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain();
        s.buffer = noiseBuf; fl.type = type; fl.frequency.setValueAtTime(f, t);
        if (fTo) fl.frequency.exponentialRampToValueAtTime(fTo, t + dur);
        g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(gain, t + dur * 0.25); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        s.connect(fl); fl.connect(g); g.connect(dest); s.start(t); s.stop(t + dur + 0.05);
    }
    // Süregelen ambient katmanı: detune'lu osilatörler → alçak geçiren filtre (yavaş LFO'lu). stop() ile yumuşakça kapanır.
    function pad(dest, freqs, o) {
        const g = ctx.createGain(), lp = ctx.createBiquadFilter(), lfo = ctx.createOscillator(), lg = ctx.createGain();
        g.gain.value = o.gain; lp.type = 'lowpass'; lp.frequency.value = o.lp;
        lfo.frequency.value = o.lfo || 0.1; lg.gain.value = (o.lfoDepth || 0.4) * o.lp; lfo.connect(lg); lg.connect(lp.frequency);
        const nodes = [lfo];
        freqs.forEach((f, i) => {
            const n = ctx.createOscillator(); n.type = o.type || 'sawtooth'; n.frequency.value = f; n.detune.value = (i % 2 ? 1 : -1) * (o.detune || 6);
            n.connect(lp); n.start(); nodes.push(n);
        });
        lp.connect(g); g.connect(dest); lfo.start();
        return () => { const t = ctx.currentTime; g.gain.cancelScheduledValues(t); g.gain.setTargetAtTime(0.0001, t, 0.4); nodes.forEach((n) => { try { n.stop(t + 2); } catch (_) {} }); };
    }
    const every = (sec, fn) => { const id = setInterval(fn, sec * 1000); return () => clearInterval(id); };
    const rnd = (arr) => arr[Math.floor(Math.random() * arr.length)];

    const RECIPES = {
        cyber: {
            impact(d, t) {
                osc(d, 'sine', 130, t, 1.3, 0.9, { to: 38 });
                noise(d, t, 0.6, 0.32, 'highpass', 4200, 700);
                [220, 262, 330, 440, 660].forEach((f, i) => osc(d, 'square', f, t + 0.06 + i * 0.09, 0.5, 0.1, { lp: 2400 }));
                osc(d, 'sawtooth', 110, t + 0.9, 1.8, 0.16, { lp: 900, att: 0.05 });
            },
            ambient(d) {
                const stop = pad(d, [110, 165, 220], { type: 'sawtooth', lp: 420, gain: 0.05, lfo: 0.12 });
                const stop2 = every(2.4, () => osc(d, 'square', rnd([440, 523, 659, 880]), ctx.currentTime + 0.02, 0.35, 0.03, { lp: 1800 }));
                return () => { stop(); stop2(); };
            }
        },
        midnight: {
            impact(d, t) {
                [293.7, 349.2, 440, 523.3].forEach((f, i) => { osc(d, 'sine', f, t + i * 0.07, 3.4, 0.2); osc(d, 'sine', f * 2.76, t + i * 0.07, 1.4, 0.05); });
                noise(d, t, 2.4, 0.07, 'lowpass', 700, 300);
            },
            ambient(d) {
                const stop = pad(d, [73.4, 110, 146.8, 174.6], { type: 'triangle', lp: 650, gain: 0.07, lfo: 0.08 });
                const stop2 = every(3.2, () => osc(d, 'sine', rnd([587, 659, 784, 880, 1047]), ctx.currentTime + 0.02, 2.2, 0.035));
                return () => { stop(); stop2(); };
            }
        },
        cosmic: {
            impact(d, t) {
                osc(d, 'sine', 70, t, 2.8, 1, { to: 27 });
                noise(d, t, 3, 0.3, 'bandpass', 200, 6000);
                [659, 988, 1319].forEach((f, i) => osc(d, 'sine', f, t + 0.4 + i * 0.12, 3, 0.05, { att: 0.6 }));
            },
            ambient(d) {
                const stop = pad(d, [55, 82.4, 123.5, 185, 277], { type: 'sine', lp: 900, gain: 0.07, lfo: 0.05, lfoDepth: 0.55, detune: 10 });
                const stop2 = every(5, () => osc(d, 'sine', rnd([1319, 1760, 2093]), ctx.currentTime + 0.02, 3, 0.02, { att: 0.5 }));
                return () => { stop(); stop2(); };
            }
        },
        garden: {
            impact(d, t) {
                [587.3, 740, 880, 987.8, 1174.7].forEach((f, i) => osc(d, 'triangle', f, t + i * 0.17, 1.7, 0.22, { att: 0.004 }));
                osc(d, 'sine', 146.8, t, 2.6, 0.3, { att: 0.05 });
            },
            ambient(d) {
                const stop = pad(d, [146.8, 220, 370], { type: 'sine', lp: 800, gain: 0.05, lfo: 0.09 });
                const stop2 = every(3.4, () => osc(d, 'triangle', rnd([587.3, 740, 880, 987.8]), ctx.currentTime + 0.02, 1.8, 0.07, { att: 0.004 }));
                return () => { stop(); stop2(); };
            }
        }
    };

    function stop() {
        if (!current) return;
        const c = current; current = null;
        clearTimeout(c.t1); clearTimeout(c.t2); clearTimeout(c.t3);
        try {
            const t = ctx.currentTime;
            c.env.gain.cancelScheduledValues(t); c.env.gain.setValueAtTime(c.env.gain.value, t); c.env.gain.linearRampToValueAtTime(0.0001, t + 0.35);
            setTimeout(() => { try { c.stopAmbient && c.stopAmbient(); c.env.disconnect(); } catch (_) {} }, 600);
        } catch (_) {}
        if (c.onStage) c.onStage('end');
    }

    // soundKey: 'cyber' | 'midnight' | 'cosmic' | 'garden'.  opts: { volume 0..1, onStage(stage) }
    function play(soundKey, opts = {}) {
        const recipe = RECIPES[soundKey];
        if (!recipe || !getCtx()) return null;
        stop();
        const vol = Math.max(0, Math.min(1, opts.volume == null ? 0.6 : opts.volume)) * MAKEUP;
        const env = ctx.createGain();
        env.connect(master);
        const t = ctx.currentTime + 0.03;
        env.gain.setValueAtTime(0.0001, t);
        env.gain.linearRampToValueAtTime(vol, t + 0.04);                 // IMPACT: tam seviye
        env.gain.setValueAtTime(vol, t + IMPACT_END);
        env.gain.linearRampToValueAtTime(vol * AMBIENT_LEVEL, t + FADE_END); // FADE: kademeli düşüş
        recipe.impact(env, t);
        const stopAmbient = recipe.ambient(env);
        const c = { env, stopAmbient, onStage: opts.onStage, key: soundKey };
        current = c;
        if (c.onStage) c.onStage('impact');
        c.t1 = setTimeout(() => { if (current === c && c.onStage) c.onStage('fade'); }, IMPACT_END * 1000);
        c.t2 = setTimeout(() => { if (current === c && c.onStage) c.onStage('ambient'); }, FADE_END * 1000);
        c.t3 = setTimeout(() => { if (current === c) stop(); }, MAX_SECONDS * 1000);
        return { stop: () => { if (current === c) stop(); } };
    }

    window.SauranAtmo = { play, stop, isPlaying: (key) => Boolean(current && (!key || current.key === key)), keys: Object.keys(RECIPES) };
})();
