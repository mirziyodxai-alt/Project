/* The edit: shots, camera moves, subtitles and the frame renderer. */
(function () {
  const N = window.NYOS;
  const { lerp, smooth, clamp, easeInOut, easeOut, makeEnv, noise, inv } = N;

  const DURATION = 60;

  const SUBS = [
    { start: 0.3, end: 4.9, text: 'On August 21st, 1986... an entire village fell asleep.' },
    { start: 5.2, end: 9.9, text: 'By sunrise... most of them were dead.' },
    { start: 10.2, end: 15.9, text: 'There were no explosions... no warning... no screams.' },
    { start: 16.2, end: 21.9, text: 'The only witness... was the lake.' },
    { start: 22.3, end: 30.8, text: 'Deep below the surface... millions of tons of carbon dioxide had been trapped for centuries.' },
    { start: 31.3, end: 39.8, text: 'Then... something released it.' },
    { start: 40.2, end: 48.8, text: "The cloud couldn't be seen... or smelled." },
    { start: 49.2, end: 55.8, text: 'Because it was heavier than air... it pushed the oxygen away.' },
    { start: 56.1, end: 58.4, text: 'By morning... more than 1,700 people were gone.' },
  ];

  const lerpCam = (a, b, u) => ({ x: lerp(a.x, b.x, u), y: lerp(a.y, b.y, u), z: lerp(a.z, b.z, u) });
  const shake = (t, amt, f = 9) => ({ sx: noise(t * f) * amt, sy: noise(t * f + 50) * amt });

  // Scene 1 window lights: families going to sleep one by one.
  const lightsFading = (lt) => (h) => (h.lightOn ? 1 - smooth(h.off, h.off + 0.35, lt) : 0);

  const TEAL = { tint: [0.5, 1.05, 0.95], amount: 0.9 };

  const SHOTS = [
    // [0:00–0:05] Peaceful night village; slow push toward the lake.
    {
      start: 0, end: 5, xf: 0,
      draw(ctx, t, lt, S) {
        const u = easeInOut(lt / 5);
        const cam = lerpCam({ x: 1800, y: 620, z: 0.9 }, { x: 1180, y: 560, z: 1.24 }, u);
        N.drawValley(ctx, t, cam, makeEnv(0), S, { windows: lightsFading(lt), ripple: 0.3, still: true, wind: 0.15, foreground: true });
      },
    },
    // [0:05–0:07.6] Time-lapse: night to sunrise over the silent village.
    {
      start: 5, end: 7.6, xf: 0.5,
      draw(ctx, t, lt, S) {
        const u = lt / 2.6;
        const cam = lerpCam({ x: 1640, y: 600, z: 0.88 }, { x: 1740, y: 610, z: 0.96 }, easeInOut(u));
        const tod = smooth(0, 1, u) * 0.86;
        N.drawValley(ctx, t, cam, makeEnv(tod), S, { ripple: 0.3, still: true, wind: 0.1, foreground: true, clouds: 0.5 * smooth(0.3, 1, u) });
      },
    },
    // [0:07.6–0:10] Gliding down an empty street at dawn.
    {
      start: 7.6, end: 10, xf: 0.4,
      draw(ctx, t, lt, S) {
        N.drawStreet && N.drawStreet(ctx, t, lt / 2.4, S);
      },
    },
    // [0:10–0:16] Close-ups: frozen in time.
    { start: 10, end: 12, xf: 0.3, draw: (ctx, t, lt, S) => N.drawCloseTree && N.drawCloseTree(ctx, t, lt / 2, S) },
    { start: 12, end: 14, xf: 0.3, draw: (ctx, t, lt, S) => N.drawCloseDoor && N.drawCloseDoor(ctx, t, lt / 2, S) },
    { start: 14, end: 16, xf: 0.3, draw: (ctx, t, lt, S) => N.drawCloseYard && N.drawCloseYard(ctx, t, lt / 2, S) },
    // [0:16–0:22] The camera turns to the lake. Faint bubbles begin.
    {
      start: 16, end: 19.6, xf: 0.5,
      draw(ctx, t, lt, S) {
        const u = easeInOut(lt / 3.6);
        const cam = lerpCam({ x: 2500, y: 700, z: 1.35 }, { x: 980, y: 560, z: 1.55 }, u);
        N.drawValley(ctx, t, cam, makeEnv(0.3, TEAL), S, { ripple: 0.4, bubbles: smooth(0.5, 1, u) * 0.4, bubbleT0: 17.5, wind: 0.25 });
        N.grade(ctx, S, 'rgb(20,120,110)', 0.35, 'soft-light');
      },
    },
    {
      start: 19.6, end: 22, xf: 0.6,
      draw: (ctx, t, lt, S) => N.drawLakeSurface && N.drawLakeSurface(ctx, t, lt / 2.4, S),
    },
    // [0:22–0:31] Cutaway beneath the lake.
    { start: 22, end: 31, xf: 0.7, draw: (ctx, t, lt, S) => N.drawCutaway && N.drawCutaway(ctx, t, lt, S, 'calm') },
    // [0:31–0:40] The release.
    { start: 31, end: 35, xf: 0, draw: (ctx, t, lt, S) => N.drawCutaway && N.drawCutaway(ctx, t, lt + 9, S, 'erupt') },
    {
      start: 35, end: 40, xf: 0.25,
      draw(ctx, t, lt, S) {
        const u = lt / 5;
        const cam = lerpCam({ x: 900, y: 470, z: 1.55 }, { x: 1150, y: 520, z: 1.12 }, easeOut(u));
        Object.assign(cam, shake(t, 7 * (1 - smooth(0.4, 1, u))));
        const env = makeEnv(0.02);
        N.drawValley(ctx, t * 0.5, cam, env, S, {
          eruption: 0.15 + u * 0.85, cloudColumn: smooth(0.1, 0.8, u), ripple: 1,
          mist: { spread: smooth(0.45, 1, u) * 0.18, rise: 1 - smooth(0.5, 1, u), alpha: 1 },
          wind: 0.5,
        });
      },
    },
    // [0:40–0:49] The cloud flows downhill.
    {
      start: 40, end: 43.6, xf: 0.4,
      draw(ctx, t, lt, S) {
        const u = lt / 3.6;
        const cam = lerpCam({ x: 1450, y: 610, z: 1.12 }, { x: 2450, y: 760, z: 1.3 }, easeInOut(u));
        N.drawValley(ctx, t, cam, makeEnv(0.03), S, {
          mist: { spread: 0.2 + u * 0.5, rise: 0, alpha: 1.1, fg: true }, wind: 0.2, foreground: true, ripple: 0.4,
        });
      },
    },
    { start: 43.6, end: 46.2, xf: 0.5, draw: (ctx, t, lt, S) => N.drawInterior && N.drawInterior(ctx, t, lt / 2.6, S) },
    { start: 46.2, end: 49, xf: 0.5, draw: (ctx, t, lt, S) => N.drawAerial && N.drawAerial(ctx, t, lt / 2.8, S) },
    // [0:49–0:56] Why it killed: heavier than air.
    { start: 49, end: 56, xf: 0.6, draw: (ctx, t, lt, S) => N.drawDiagram && N.drawDiagram(ctx, t, lt, S) },
    // [0:56–1:00] Peaceful again at sunrise.
    {
      start: 56, end: 60, xf: 0.7,
      draw(ctx, t, lt, S) {
        const u = lt / 4;
        const cam = lerpCam({ x: 1350, y: 540, z: 1.08 }, { x: 1450, y: 580, z: 0.86 }, easeOut(u));
        N.drawValley(ctx, t, cam, makeEnv(0.78), S, { ripple: 0.2, still: true, wind: 0.12, lakeTint: 0.15, clouds: 0.5, foreground: true });
      },
    },
  ];

  // Grade and post per time.
  function postFor(t) {
    return {
      vignette: 0.55 + 0.15 * smooth(30, 40, t) - 0.1 * smooth(49, 50, t) * (1 - smooth(55.5, 56.5, t)),
      grain: 0.07,
    };
  }

  let buf = null;
  function renderFrame(ctx, t, S, opts = {}) {
    const W = N.W, H = N.H;
    t = clamp(t, 0, DURATION - 1e-4);
    // Which shots are on screen (a shot lingers under the next one's cross-fade).
    const active = [];
    for (let i = 0; i < SHOTS.length; i++) {
      const s = SHOTS[i], next = SHOTS[i + 1];
      const until = next ? next.start + next.xf : s.end;
      if (t >= s.start && t < until) active.push(s);
    }
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    active.forEach((s, i) => {
      const a = i === 0 || !s.xf ? 1 : easeInOut(clamp((t - s.start) / s.xf));
      if (a >= 1 || i === 0) {
        ctx.save();
        s.draw(ctx, t, t - s.start, S);
        ctx.restore();
      } else {
        if (!buf || buf.width !== ctx.canvas.width || buf.height !== ctx.canvas.height) {
          buf = document.createElement('canvas');
          buf.width = ctx.canvas.width;
          buf.height = ctx.canvas.height;
        }
        const b = buf.getContext('2d');
        b.save();
        b.setTransform(1, 0, 0, 1, 0, 0);
        b.clearRect(0, 0, buf.width, buf.height);
        s.draw(b, t, t - s.start, S);
        b.restore();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalAlpha = a;
        ctx.drawImage(buf, 0, 0);
        ctx.globalAlpha = 1;
      }
    });
    const p = postFor(t);
    N.vignette(ctx, S, p.vignette);
    N.grain(ctx, S, t, p.grain);
    // Fade in from black, and to black for the title.
    N.fadeBlack(ctx, S, 1 - smooth(0, 1.2, t));
    N.fadeBlack(ctx, S, smooth(57.6, 59.0, t));
    N.letterbox(ctx, S);
    if (opts.subtitles !== false) N.subtitle(ctx, S, t, SUBS);
    N.title(ctx, S, t, 58.2);
    ctx.restore();
  }

  Object.assign(N, { DURATION, SUBS, SHOTS, renderFrame });
})();
