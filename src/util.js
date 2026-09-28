/* Shared helpers: math, easing, deterministic noise, colour. */
(function () {
  const N = (window.NYOS = window.NYOS || {});

  const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
  const lerp = (a, b, t) => a + (b - a) * t;
  const inv = (a, b, x) => clamp((x - a) / (b - a));
  const smooth = (a, b, x) => {
    const t = inv(a, b, x);
    return t * t * (3 - 2 * t);
  };
  const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  const easeIn = (t) => t * t * t;

  // Seeded PRNG so the film renders identically every time.
  function rng(seed) {
    let a = seed >>> 0;
    const next = () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    next.range = (lo, hi) => lo + (hi - lo) * next();
    next.pick = (arr) => arr[Math.floor(next() * arr.length)];
    return next;
  }

  function hash(i) {
    let x = Math.imul(i | 0, 0x27d4eb2d) ^ 0x9e3779b9;
    x = Math.imul(x ^ (x >>> 15), 0x85ebca6b);
    x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
    return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
  }

  // 1-D value noise in [-1, 1].
  function noise(x) {
    const i = Math.floor(x);
    const f = x - i;
    const u = f * f * (3 - 2 * f);
    return lerp(hash(i), hash(i + 1), u) * 2 - 1;
  }
  function fbm(x, oct = 4) {
    let v = 0, amp = 0.5, fr = 1;
    for (let o = 0; o < oct; o++) {
      v += amp * noise(x * fr + o * 17.3);
      fr *= 2;
      amp *= 0.5;
    }
    return v;
  }

  // Colours are [r, g, b] arrays in 0..255.
  const hex = (h) => {
    const n = parseInt(h.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const mix = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
  const mul = (a, m) => [a[0] * m[0], a[1] * m[1], a[2] * m[2]];
  const scale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
  const rgb = (c, a = 1) => {
    const r = Math.round(clamp(c[0], 0, 255));
    const g = Math.round(clamp(c[1], 0, 255));
    const b = Math.round(clamp(c[2], 0, 255));
    return a >= 1 ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${clamp(a).toFixed(4)})`;
  };

  // Interpolate an array of {t, ...values} keyframes.
  function keyframes(frames, t, keys) {
    if (t <= frames[0].t) return frames[0];
    const last = frames[frames.length - 1];
    if (t >= last.t) return last;
    let i = 0;
    while (frames[i + 1].t < t) i++;
    const a = frames[i], b = frames[i + 1];
    const u = (t - a.t) / (b.t - a.t);
    const out = { t };
    for (const k of keys) {
      const va = a[k], vb = b[k];
      out[k] = Array.isArray(va) ? mix(va, vb, u) : lerp(va, vb, u);
    }
    return out;
  }

  // Soft round sprite cache (used for mist, glows and bubbles).
  const spriteCache = new Map();
  function softSprite(color, size = 128, falloff = 1) {
    color = color.map((v) => Math.round(v / 6) * 6); // quantise to keep the cache small
    const key = color.join(',') + '|' + size + '|' + falloff;
    let c = spriteCache.get(key);
    if (c) return c;
    c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    for (let i = 0; i <= 8; i++) {
      const s = i / 8;
      const a = Math.pow(1 - s, 1.6 * falloff) * (1 - s * s);
      gr.addColorStop(s, rgb(color, a));
    }
    g.fillStyle = gr;
    g.fillRect(0, 0, size, size);
    if (spriteCache.size > 400) spriteCache.clear();
    spriteCache.set(key, c);
    return c;
  }

  Object.assign(N, {
    clamp, lerp, inv, smooth, easeInOut, easeOut, easeIn,
    rng, hash, noise, fbm, hex, mix, mul, scale, rgb, keyframes, softSprite,
  });
})();
