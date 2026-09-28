/* Time-of-day lighting. `tod` runs 0 (deep night) -> 1 (full morning). */
(function () {
  const N = window.NYOS;
  const { hex, keyframes, mix, clamp, rgb, smooth } = N;

  const FRAMES = [
    {
      t: 0.0,
      skyTop: hex('#02050d'), skyMid: hex('#0a1430'), skyBot: hex('#1b2a4c'),
      amb: [0.16, 0.19, 0.36], key: [0.26, 0.33, 0.56], keyDir: -0.6,
      haze: hex('#141f3a'), stars: 1, moon: 1, sun: 0, glow: hex('#27365c'),
    },
    {
      t: 0.35,
      skyTop: hex('#0c1632'), skyMid: hex('#24335a'), skyBot: hex('#56597c'),
      amb: [0.24, 0.27, 0.38], key: [0.16, 0.18, 0.26], keyDir: 0.1,
      haze: hex('#353f62'), stars: 0.35, moon: 0.35, sun: 0, glow: hex('#6d6384'),
    },
    {
      t: 0.6,
      skyTop: hex('#243c6c'), skyMid: hex('#77789a'), skyBot: hex('#e3966a'),
      amb: [0.38, 0.37, 0.45], key: [0.72, 0.46, 0.32], keyDir: 0.9,
      haze: hex('#957f8c'), stars: 0.04, moon: 0, sun: 0.55, glow: hex('#ffae6e'),
    },
    {
      t: 0.8,
      skyTop: hex('#3b64a0'), skyMid: hex('#a6a1b3'), skyBot: hex('#f5b378'),
      amb: [0.5, 0.49, 0.53], key: [1.0, 0.72, 0.48], keyDir: 0.9,
      haze: hex('#c7a89b'), stars: 0, moon: 0, sun: 1, glow: hex('#ffc07c'),
    },
    {
      t: 1.0,
      skyTop: hex('#5a8ecb'), skyMid: hex('#a8c1db'), skyBot: hex('#f0d4ad'),
      amb: [0.6, 0.62, 0.66], key: [0.95, 0.85, 0.68], keyDir: 0.8,
      haze: hex('#b8c2cf'), stars: 0, moon: 0, sun: 1, glow: hex('#ffe1b0'),
    },
  ];
  const KEYS = ['skyTop', 'skyMid', 'skyBot', 'amb', 'key', 'keyDir', 'haze', 'stars', 'moon', 'sun', 'glow'];

  function makeEnv(tod, grade) {
    const e = keyframes(FRAMES, clamp(tod), KEYS);
    e.tod = tod;
    e.sunElev = smooth(0.5, 1.0, tod); // 0 = on the horizon
    // Optional colour grade applied to the light (e.g. the teal "lake" look).
    if (grade) {
      const g = grade.tint, a = grade.amount;
      e.amb = mix(e.amb, [e.amb[0] * g[0], e.amb[1] * g[1], e.amb[2] * g[2]], a);
      e.key = mix(e.key, [e.key[0] * g[0], e.key[1] * g[1], e.key[2] * g[2]], a);
      e.haze = mix(e.haze, [e.haze[0] * g[0], e.haze[1] * g[1], e.haze[2] * g[2]], a);
      for (const k of ['skyTop', 'skyMid', 'skyBot']) e[k] = mix(e[k], [e[k][0] * g[0], e[k][1] * g[1], e[k][2] * g[2]], a);
    }
    return e;
  }

  // Light an albedo colour. k = how much the surface faces the key light (0..1),
  // fog = atmospheric perspective (0 near .. 1 fully hazed).
  function lit(env, albedo, k = 0.5, fog = 0) {
    const c = [
      albedo[0] * (env.amb[0] + env.key[0] * k),
      albedo[1] * (env.amb[1] + env.key[1] * k),
      albedo[2] * (env.amb[2] + env.key[2] * k),
    ];
    return fog > 0 ? mix(c, env.haze, clamp(fog)) : c;
  }
  const litS = (env, albedo, k, fog, a) => rgb(lit(env, albedo, k, fog), a);

  // How strongly a face with horizontal normal nx (-1 left .. 1 right) is lit.
  const faceK = (env, nx, up = 0.35) => clamp(up + Math.max(0, nx * env.keyDir) * 0.9, 0, 1.2);

  Object.assign(N, { makeEnv, lit, litS, faceK });
})();
