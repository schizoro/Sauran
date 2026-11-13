'use strict';
// Giriş hassasiyeti (gürültü kapısı) işlemcisi: eşiğin altındaki ses kesilir, konuşma geçer, konuşma bitince
// kısa bir bekleme sonrası yumuşakça kapanır. AudioWorklet ortamı küçük bir taklitle çalıştırılır.
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('vm');
const fs = require('fs');
const path = require('path');

function loadGate() {
  let Proc;
  const ctx = { sampleRate: 48000, Math, AudioWorkletProcessor: class { constructor() { this.port = { postMessage() {}, onmessage: null }; } }, registerProcessor: (n, c) => { Proc = c; } };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', '..', 'client', 'noise-gate-worklet.js'), 'utf8'), ctx);
  return new Proc();
}
function run(g, amp, blocks) {
  let peak = 0;
  for (let b = 0; b < blocks; b++) {
    const inp = new Float32Array(128).map((_, i) => amp * Math.sin(i / 5));
    const out = new Float32Array(128);
    g.process([[inp]], [[out]]);
    peak = Math.max(...Array.from(out, Math.abs));
  }
  return peak;
}

test('Eşiğin altındaki gürültü kesilir, konuşma geçer, sonra kapanır', () => {
  const g = loadGate();
  g.port.onmessage({ data: { thresholdDb: -45 } });
  assert.ok(run(g, 0.0014, 400) < 1e-4, 'sessiz arka plan gürültüsü gönderilmez');
  assert.ok(run(g, 0.14, 40) > 0.13, 'konuşma geçer');
  assert.ok(run(g, 0.0014, 75) > 0.001, 'konuşma bitince 350 ms bekler (kelime arası kesilmez)');
  assert.ok(run(g, 0.0014, 300) < 3e-4, 'sonra yumuşakça kapanır');
});

test('Eşik sınırlanır', () => {
  const g = loadGate();
  g.port.onmessage({ data: { thresholdDb: 50 } });
  assert.equal(g.thresholdDb, 0);
  g.port.onmessage({ data: { thresholdDb: -500 } });
  assert.equal(g.thresholdDb, -90);
});
