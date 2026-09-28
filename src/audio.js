/* The score: rendered offline (deterministically) with Web Audio, then played in sync. */
(function () {
  const N = window.NYOS;
  const RATE = 44100;

  function seededNoise(ctx, seconds, seed) {
    const r = N.rng(seed);
    const buf = ctx.createBuffer(2, Math.floor(seconds * ctx.sampleRate), ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      let brown = 0;
      for (let i = 0; i < d.length; i++) {
        const w = r() * 2 - 1;
        brown = (brown + 0.02 * w) / 1.02;
        d[i] = w * 0.35 + brown * 2.5;
      }
    }
    return buf;
  }

  function impulse(ctx, seconds, seed) {
    const r = N.rng(seed);
    const buf = ctx.createBuffer(2, Math.floor(seconds * ctx.sampleRate), ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < d.length; i++) d[i] = (r() * 2 - 1) * Math.pow(1 - i / d.length, 3);
    }
    return buf;
  }

  // Apply [[time, value], ...] keyframes to an AudioParam (linear ramps).
  function env(param, pts) {
    param.setValueAtTime(pts[0][1], 0);
    for (const [t, v] of pts) param.linearRampToValueAtTime(v, t);
  }

  async function renderScore() {
    const ctx = new OfflineAudioContext(2, RATE * N.DURATION, RATE);
    const master = ctx.createGain();
    master.gain.value = 0.9;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 3;
    master.connect(comp).connect(ctx.destination);
    const verb = ctx.createConvolver();
    verb.buffer = impulse(ctx, 4.5, 3);
    const verbGain = ctx.createGain();
    verbGain.gain.value = 0.55;
    verb.connect(verbGain).connect(master);
    const noiseBuf = seededNoise(ctx, 8, 11);

    const bus = (dry = 1, wet = 0.4) => {
      const g = ctx.createGain();
      const d = ctx.createGain();
      d.gain.value = dry;
      const w = ctx.createGain();
      w.gain.value = wet;
      g.connect(d).connect(master);
      g.connect(w).connect(verb);
      return g;
    };

    // --- Drone pad: D minor colour, darkening and swelling with the story.
    const padOut = bus(0.7, 0.8);
    const padLP = ctx.createBiquadFilter();
    padLP.type = 'lowpass';
    env(padLP.frequency, [[0, 500], [5, 700], [16, 600], [22, 380], [31, 420], [34, 1400], [40, 500], [49, 800], [56, 1200], [60, 600]]);
    const padGain = ctx.createGain();
    env(padGain.gain, [[0, 0], [1.5, 0.05], [5, 0.06], [7, 0.075], [16, 0.07], [21.8, 0.085], [22.3, 0.06], [30.8, 0.075], [31.2, 0.04], [40, 0.07], [49, 0.06], [56, 0.075], [58.5, 0.06], [60, 0]]);
    padLP.connect(padGain).connect(padOut);
    const chord = [73.42, 110.0, 146.83, 174.61, 220.0];
    chord.forEach((f, i) => {
      for (const det of [-6, 5]) {
        const o = ctx.createOscillator();
        o.type = i < 2 ? 'sawtooth' : 'triangle';
        o.frequency.value = f;
        o.detune.value = det + i;
        const g = ctx.createGain();
        g.gain.value = i < 2 ? 0.35 : 0.25;
        o.connect(g).connect(padLP);
        o.start(0);
      }
    });
    // A minor-second rub enters for tension under the cutaway.
    const rub = ctx.createOscillator();
    rub.type = 'triangle';
    rub.frequency.value = 155.56;
    const rubG = ctx.createGain();
    env(rubG.gain, [[0, 0], [22, 0], [26, 0.02], [31, 0.035], [33, 0], [44, 0], [46, 0.018], [49, 0], [60, 0]]);
    rub.connect(rubG).connect(padOut);
    rub.start(0);

    // Final resolve: D major colour at sunrise.
    const fin = ctx.createGain();
    env(fin.gain, [[0, 0], [56, 0], [57.2, 0.05], [59.2, 0.04], [60, 0]]);
    fin.connect(bus(0.6, 0.9));
    for (const f of [146.83, 185.0, 220.0, 293.66]) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f;
      o.connect(fin);
      o.start(56);
    }

    // --- Night crickets (0–5 s) — then they fall silent.
    const crOut = bus(0.5, 0.3);
    for (let t = 0.2; t < 5.05; t += 0.42) {
      for (let k = 0; k < 3; k++) {
        const st = t + k * 0.06 + (N.hash(Math.floor(t * 100)) - 0.5) * 0.04;
        const o = ctx.createOscillator();
        o.frequency.value = 4400 + (Math.floor(t * 10) % 2) * 300;
        const g = ctx.createGain();
        const vol = 0.012 * Math.min(1, t / 1.5);
        g.gain.setValueAtTime(0, st);
        g.gain.linearRampToValueAtTime(vol, st + 0.01);
        g.gain.linearRampToValueAtTime(0, st + 0.04);
        const pan = ctx.createStereoPanner();
        pan.pan.value = Math.floor(t * 7) % 2 ? 0.5 : -0.4;
        o.connect(g).connect(pan).connect(crOut);
        o.start(st);
        o.stop(st + 0.05);
      }
    }

    // --- Noise beds: night air, wind in the close-ups, underwater murk, eruption roar.
    function noiseBed(type, freq, q, pts, wet = 0.3, freqPts) {
      const src = ctx.createBufferSource();
      src.buffer = noiseBuf;
      src.loop = true;
      const f = ctx.createBiquadFilter();
      f.type = type;
      f.frequency.value = freq;
      f.Q.value = q;
      if (freqPts) env(f.frequency, freqPts);
      const g = ctx.createGain();
      env(g.gain, pts);
      src.connect(f).connect(g).connect(bus(1, wet));
      src.start(0);
    }
    noiseBed('lowpass', 900, 0.5, [[0, 0], [1, 0.05], [5, 0.04], [5.5, 0.015], [10, 0.02], [16, 0.02], [22, 0], [60, 0]]);
    noiseBed('bandpass', 700, 0.7, [[0, 0], [10, 0], [10.4, 0.12], [12, 0.08], [13, 0.13], [15, 0.1], [16.2, 0], [60, 0]], 0.4, [[0, 700], [10, 600], [11, 900], [12.5, 500], [14, 1000], [16, 700]]);
    noiseBed('lowpass', 260, 1.2, [[0, 0], [21.8, 0], [23, 0.22], [30.8, 0.26], [31.5, 0.12], [35, 0], [60, 0]], 0.5);
    noiseBed('lowpass', 140, 0.8, [[0, 0], [31.3, 0], [32.2, 0.35], [33, 0.9], [36, 0.8], [39, 0.4], [41, 0.1], [44, 0], [60, 0]], 0.3);
    noiseBed('bandpass', 1800, 0.6, [[0, 0], [33, 0], [35.2, 0.14], [38, 0.18], [40, 0.07], [44, 0.03], [49, 0], [60, 0]], 0.6, [[0, 1800], [35, 1400], [40, 2600], [48, 3000]]);

    // --- Bubbles breaking the surface (17–22 s) and under water (22–31 s).
    const blOut = bus(0.6, 0.7);
    const bubbleTimes = [];
    for (let i = 0; i < 26; i++) bubbleTimes.push(17.3 + N.hash(i * 7) * 4.6);
    for (let i = 0; i < 20; i++) bubbleTimes.push(22.5 + N.hash(i * 13) * 8.2);
    bubbleTimes.forEach((st, i) => {
      const o = ctx.createOscillator();
      const base = st < 22 ? 520 + N.hash(i) * 500 : 260 + N.hash(i) * 260;
      o.frequency.setValueAtTime(base * 0.6, st);
      o.frequency.exponentialRampToValueAtTime(base * 1.6, st + 0.07);
      const g = ctx.createGain();
      const vol = st < 22 ? 0.05 * Math.min(1, (st - 17) / 3) : 0.03;
      g.gain.setValueAtTime(0, st);
      g.gain.linearRampToValueAtTime(vol, st + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, st + 0.12);
      const pan = ctx.createStereoPanner();
      pan.pan.value = N.hash(i * 3) * 1.4 - 0.7;
      o.connect(g).connect(pan).connect(blOut);
      o.start(st);
      o.stop(st + 0.15);
    });

    // --- Rockfall (31.0 s) and the deep boom of the release (32.3 s).
    const rkOut = bus(0.9, 0.5);
    for (let i = 0; i < 9; i++) {
      const st = 31.0 + i * 0.09 + N.hash(i) * 0.1;
      const src = ctx.createBufferSource();
      src.buffer = noiseBuf;
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 300 + N.hash(i * 5) * 500;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, st);
      g.gain.linearRampToValueAtTime(0.25, st + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, st + 0.35);
      src.connect(f).connect(g).connect(rkOut);
      src.start(st, N.hash(i) * 5, 0.5);
    }
    for (const [st, f0, f1, vol, dur] of [[32.3, 70, 26, 0.7, 5], [35.0, 55, 30, 0.45, 4]]) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(f0, st);
      o.frequency.exponentialRampToValueAtTime(f1, st + dur);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, st);
      g.gain.linearRampToValueAtTime(vol, st + 0.08);
      g.gain.exponentialRampToValueAtTime(0.001, st + dur);
      o.connect(g).connect(bus(1, 0.6));
      o.start(st);
      o.stop(st + dur + 0.1);
    }

    // --- Diagram (49–56): a slow, soft pulse.
    const plOut = bus(0.5, 0.8);
    for (let st = 49.6; st < 55.8; st += 1.2) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = 293.66;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, st);
      g.gain.linearRampToValueAtTime(0.03, st + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0005, st + 1.0);
      o.connect(g).connect(plOut);
      o.start(st);
      o.stop(st + 1.1);
    }

    // --- Title: a single low, piano-like note.
    const pnOut = bus(0.7, 1.0);
    [[58.2, 73.42], [58.2, 146.83], [58.25, 220.0]].forEach(([st, f], i) => {
      for (const [h, a] of [[1, 1], [2, 0.4], [3, 0.18], [4, 0.08]]) {
        const o = ctx.createOscillator();
        o.frequency.value = f * h;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, st);
        g.gain.linearRampToValueAtTime(0.06 * a * (i ? 0.6 : 1), st + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0005, Math.min(st + 3.5 / h, 60));
        o.connect(g).connect(pnOut);
        o.start(st);
        o.stop(60);
      }
    });

    return ctx.startRendering();
  }

  function toWav(buf) {
    const ch = buf.numberOfChannels, len = buf.length, rate = buf.sampleRate;
    const out = new DataView(new ArrayBuffer(44 + len * ch * 2));
    const str = (o, s) => [...s].forEach((c, i) => out.setUint8(o + i, c.charCodeAt(0)));
    str(0, 'RIFF'); out.setUint32(4, 36 + len * ch * 2, true); str(8, 'WAVE'); str(12, 'fmt ');
    out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, ch, true);
    out.setUint32(24, rate, true); out.setUint32(28, rate * ch * 2, true); out.setUint16(32, ch * 2, true);
    out.setUint16(34, 16, true); str(36, 'data'); out.setUint32(40, len * ch * 2, true);
    const data = [...Array(ch)].map((_, c) => buf.getChannelData(c));
    let o = 44;
    for (let i = 0; i < len; i++) for (let c = 0; c < ch; c++) {
      const v = Math.max(-1, Math.min(1, data[c][i]));
      out.setInt16(o, v < 0 ? v * 0x8000 : v * 0x7fff, true);
      o += 2;
    }
    return out.buffer;
  }

  let rendered = null, player = null;
  function createScore() {
    if (!player) player = makePlayer();
    return player;
  }
  async function makePlayer() {
    if (!rendered) rendered = renderScore();
    const buffer = await rendered;
    const ac = new AudioContext();
    return {
      play(from) {
        if (ac.state === 'suspended') ac.resume();
        const src = ac.createBufferSource();
        src.buffer = buffer;
        src.connect(ac.destination);
        src.start(0, Math.max(0, from));
        return src;
      },
    };
  }

  async function scoreWavBase64() {
    if (!rendered) rendered = renderScore();
    const bytes = new Uint8Array(toWav(await rendered));
    let s = '';
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(s);
  }

  Object.assign(N, { createScore, scoreWavBase64 });
})();
