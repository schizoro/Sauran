// Sauran giriş hassasiyeti (deneysel): mikrofon sesi belirlenen eşiğin altındayken sessize alınır (gürültü kapısı).
// AudioWorklet ses iş parçacığında çalışır; sekme arka plandayken de kesintisiz işler (ana iş parçacığı zamanlayıcılarına bağlı değil).
// Açılış hızlı (≈5 ms), kapanış yumuşak (≈120 ms) ve son sesten sonra 350 ms bekleme: kelime aralarında ses kesik kesik olmasın.
class SauranNoiseGate extends AudioWorkletProcessor {
  constructor() {
    super();
    this.thresholdDb = -50;
    this.env = 0;          // RMS zarfı
    this.gain = 0;         // uygulanan kazanç (0..1)
    this.holdLeft = 0;     // örnek sayısı
    this.reportEvery = Math.round(sampleRate * 0.05);
    this.sinceReport = 0;
    this.port.onmessage = (e) => {
      if (e.data && typeof e.data.thresholdDb === 'number') this.thresholdDb = Math.max(-90, Math.min(0, e.data.thresholdDb));
    };
  }

  process(inputs, outputs) {
    const input = inputs[0];
    const output = outputs[0];
    if (!input || !input.length) return true;
    const n = input[0].length;
    let sum = 0;
    for (let ch = 0; ch < input.length; ch++) {
      const d = input[ch];
      for (let i = 0; i < n; i++) sum += d[i] * d[i];
    }
    const rms = Math.sqrt(sum / (n * input.length));
    // Zarf: yükselişte hızlı, düşüşte yavaş
    this.env = rms > this.env ? rms : this.env * 0.97 + rms * 0.03;
    const db = 20 * Math.log10(this.env + 1e-9);
    if (db >= this.thresholdDb) this.holdLeft = Math.round(sampleRate * 0.35);
    else this.holdLeft = Math.max(0, this.holdLeft - n);
    const target = this.holdLeft > 0 ? 1 : 0;
    const attack = 1 - Math.exp(-1 / (sampleRate * 0.005));
    const release = 1 - Math.exp(-1 / (sampleRate * 0.12));
    for (let ch = 0; ch < output.length; ch++) {
      const inp = input[ch] || input[0];
      const out = output[ch];
      let g = this.gain;
      for (let i = 0; i < n; i++) {
        g += (target - g) * (target > g ? attack : release);
        out[i] = inp[i] * g;
      }
      if (ch === output.length - 1) this.gain = g;
    }
    this.sinceReport += n;
    if (this.sinceReport >= this.reportEvery) {
      this.sinceReport = 0;
      this.port.postMessage({ db, open: target === 1 });
    }
    return true;
  }
}

registerProcessor('sauran-noise-gate', SauranNoiseGate);
