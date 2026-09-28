/* The main set: Lake Nyos in its crater with the village on the slope below. */
(function () {
  const N = window.NYOS;
  const { rng, fbm, noise, clamp, lerp, smooth, rgb, lit, litS, mix, hex, softSprite, PAL,
    setLayer, layerSpan, fillRidge, ridgePath, drawHut, drawBox, makeTree, drawTree, drawGrassTufts, glow } = N;

  // ---- world geometry (main plane, p = 1) ----
  const LAKE = { cx: 1030, cy: 556, rx: 600, ry: 58 };
  const farShore = (x) => LAKE.cy - LAKE.ry * Math.sqrt(clamp(1 - ((x - LAKE.cx) / LAKE.rx) ** 2)) ;
  // Crater skyline behind the lake.
  const craterTop = (x) => {
    const bowl = Math.exp(-(((x - LAKE.cx) / 760) ** 2));
    const right = smooth(1500, 2700, x) * 70;
    return 492 - 118 * bowl + right + fbm(x * 0.004 + 3) * 34 + fbm(x * 0.02) * 6;
  };
  const farMountains = (x) => 470 - 120 * Math.exp(-(((x - 500) / 500) ** 2)) - 60 * Math.exp(-(((x - 1400) / 380) ** 2)) + fbm(x * 0.003 + 9) * 60;
  const hills = (x) => 500 - 40 * Math.exp(-(((x - 1900) / 500) ** 2)) + fbm(x * 0.005 + 1.7) * 40;
  // Escarpment edge: the lake sits above; the village terrace is below and in front.
  const edge = (x) => (x < 1650 ? 662 + (1650 - x) * 0.03 : 662 + smooth(1650, 2400, x) * 60 + (x - 1650) * 0.02);
  // Where the invisible cloud's ground sits (used for the mist path).
  const mistGround = (x) => (x < 1560 ? LAKE.cy + 20 : lerp(LAKE.cy + 20, edge(x) + 90, smooth(1560, 2500, x)));

  const world = (() => {
    const r = rng(1986);
    const houses = [];
    const cells = [];
    for (let gx = 1760; gx < 3900; gx += 118) for (let gy = 700; gy < 1060; gy += 76) cells.push([gx, gy]);
    for (let gx = 700; gx < 1760; gx += 130) for (let gy = 800; gy < 1080; gy += 80) if (r() < 0.55) cells.push([gx, gy]);
    for (const [gx, gy] of cells) {
      const x = gx + r.range(-40, 40), y = gy + r.range(-20, 20);
      if (y < edge(x) + 40) continue;
      if (r() < 0.38) continue;
      const depth = clamp((y - 680) / 380);
      const s = 0.5 + depth * 0.62;
      const hut = r() < 0.55;
      houses.push({
        x, y, s, hut,
        wall: hut ? (r() < 0.5 ? PAL.mud : hex('#a8744c')) : r.pick([PAL.plaster, PAL.paintBlue, PAL.paintOchre, PAL.mud]),
        roof: hut ? PAL.thatch : r() < 0.6 ? PAL.metal : PAL.rust,
        lightOn: r() < 0.75, off: r.range(0.6, 4.4), fog: (1 - depth) * 0.25,
      });
    }
    const trees = [];
    for (let i = 0; i < 70; i++) {
      const x = r.range(600, 3900), y = r.range(690, 1080);
      if (x < 1500 && y < 760) continue;
      if (y < edge(x) + 20) continue;
      const depth = clamp((y - 680) / 380);
      const t = makeTree(r, x, y, 0.55 + depth * 0.7, r() < 0.3 ? 'palm' : 'round');
      t.fog = (1 - depth) * 0.25;
      trees.push(t);
    }
    // Trees on the crater walls and shore.
    const wallTrees = [];
    for (let i = 0; i < 90; i++) {
      const x = r.range(-300, 2400);
      const top = craterTop(x);
      const bottom = x > LAKE.cx - LAKE.rx - 40 && x < LAKE.cx + LAKE.rx + 40 ? farShore(x) - 6 : 640;
      if (bottom - top < 30) continue;
      const y = r.range(top + 25, bottom);
      const t = makeTree(r, x, y, r.range(0.22, 0.34), r() < 0.2 ? 'palm' : 'round');
      t.fog = 0.45 - (y - top) / 600;
      wallTrees.push(t);
    }
    // Near-shore bushes along the front edge of the lake.
    const shore = [];
    for (let i = 0; i < 40; i++) {
      const x = r.range(LAKE.cx - LAKE.rx - 200, LAKE.cx + LAKE.rx + 100);
      const t = makeTree(r, x, r.range(640, 690), r.range(0.3, 0.45), 'round');
      t.fog = 0.12;
      shore.push(t);
    }
    // Foreground (p = 1.35).
    const fg = [makeTree(r, 3050, 1130, 2.1, 'round'), makeTree(r, 800, 1150, 1.9, 'palm'), makeTree(r, 1350, 1170, 2.3, 'round')];
    const all = [...houses.map((h) => ({ y: h.y, h })), ...trees.map((t) => ({ y: t.y, t }))].sort((a, b) => a.y - b.y);
    const fields = [];
    for (let i = 0; i < 7; i++) {
      const x = r.range(1750, 3700), y = r.range(740, 1020);
      if (y < edge(x) + 30) continue;
      fields.push({ x, y, w: r.range(120, 230), h: r.range(26, 48), sk: r.range(-40, 40), crop: r() < 0.5 });
    }
    return { houses, trees, wallTrees, shore, fg, all, fields };
  })();

  const TERRAIN = (() => {
    const r = rng(77);
    const out = [];
    for (let i = 0; i < 70; i++) out.push({ x: r.range(-400, 3900), y: r.range(420, 1200), r: r.range(120, 380), dark: r() < 0.55, a: r.range(0.12, 0.3) });
    return out;
  })();

  // ---- lake -------------------------------------------------------------
  function lakePath(ctx) {
    ctx.beginPath();
    const n = 90;
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2;
      const wob = 1 + 0.02 * Math.sin(3 * a + 1) + 0.015 * Math.sin(7 * a + 2) + 0.01 * Math.sin(13 * a);
      const x = LAKE.cx + Math.cos(a) * LAKE.rx * wob;
      const y = LAKE.cy + Math.sin(a) * LAKE.ry * wob * (Math.sin(a) > 0 ? 1.25 : 1);
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.closePath();
  }

  function drawLake(ctx, env, t, o, lightX) {
    const { cx, cy, rx, ry } = LAKE;
    ctx.save();
    lakePath(ctx);
    ctx.clip();
    // Base: far part reflects the dark crater wall, near part the sky.
    const tint = o.lakeTint || 0;
    const deep = mix(hex('#123846'), hex('#5a3322'), tint);
    const g = ctx.createLinearGradient(0, cy - ry, 0, cy + ry * 1.25);
    g.addColorStop(0, rgb(mix(lit(env, deep, 0.3), env.haze, 0.25)));
    g.addColorStop(0.5, rgb(mix(lit(env, deep, 0.5), env.skyMid, 0.35)));
    g.addColorStop(1, rgb(mix(lit(env, deep, 0.6), env.skyTop, 0.55)));
    ctx.fillStyle = g;
    ctx.fillRect(cx - rx - 40, cy - ry - 40, rx * 2 + 80, ry * 3);
    // Sky sheen across the middle of the lake.
    const sh = ctx.createLinearGradient(0, cy - ry * 0.3, 0, cy + ry * 1.2);
    sh.addColorStop(0, rgb(env.skyBot, 0));
    sh.addColorStop(0.5, rgb(env.skyBot, 0.18));
    sh.addColorStop(1, rgb(env.skyBot, 0));
    ctx.fillStyle = sh;
    ctx.fillRect(cx - rx - 40, cy - ry * 0.3, rx * 2 + 80, ry * 1.6);
    // Mirror of the crater wall.
    const mirrorY = cy - ry + 2;
    ctx.globalAlpha = 0.7;
    ridgePath(ctx, (x) => mirrorY + (mirrorY - craterTop(x)) * 0.5, cx - rx - 40, cx + rx + 40, mirrorY - 2);
    const mg = ctx.createLinearGradient(0, mirrorY, 0, mirrorY + 70);
    mg.addColorStop(0, litS(env, PAL.grassDark, 0.3, 0.25));
    mg.addColorStop(1, litS(env, PAL.grassDark, 0.3, 0.45, 0.4));
    ctx.fillStyle = mg;
    ctx.fill();
    ctx.globalAlpha = 1;
    // Sky/moon/sun glitter column.
    if (lightX != null) {
      const la = o.lightA == null ? 1 : o.lightA;
      const col = o.lightCol || [255, 245, 220];
      for (let i = 0; i < 26; i++) {
        const u = i / 26;
        const y = cy - ry * 0.7 + u * ry * 2.1;
        const wv = (10 + u * 50) * (0.6 + 0.4 * noise(i * 3.1 + t * (o.still ? 0.3 : 1.5)));
        ctx.fillStyle = rgb(col, la * (0.08 + 0.25 * (1 - u)) * (0.6 + 0.4 * noise(i + t * 0.8)));
        ctx.fillRect(lightX - wv / 2 + noise(i * 1.7 + t * 0.4) * 8, y, wv, 1.2 + u * 1.5);
      }
      ctx.globalAlpha = la * 0.25;
      ctx.drawImage(softSprite(col, 128), lightX - 120, cy - ry - 10, 240, ry * 2.2);
      ctx.globalAlpha = 1;
    }
    // Very faint surface lines — the water is almost unnaturally still.
    ctx.strokeStyle = rgb(env.skyMid, 0.12 * (o.ripple == null ? 1 : o.ripple));
    ctx.lineWidth = 1;
    for (let i = 0; i < 18; i++) {
      const y = cy - ry + ((i * 13.7) % (ry * 2.3));
      const x = cx - rx + ((i * 331.7) % (rx * 2)) + Math.sin(t * 0.2 + i) * 20;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 60 + (i % 5) * 30, y);
      ctx.stroke();
    }
    // Bubbles breaking the surface.
    if (o.bubbles > 0) drawSurfaceBubbles(ctx, env, t, o.bubbles, o.bubbleT0 || 0);
    ctx.restore();
    // Shore line highlight.
    ctx.strokeStyle = litS(env, PAL.soil, 0.5, 0.2, 0.5);
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.ellipse(cx, cy + 3, rx * 0.985, ry * 1.25, 0, 0.15, Math.PI - 0.15);
    ctx.stroke();
  }

  function drawSurfaceBubbles(ctx, env, t, amount, t0) {
    const { cx, cy, rx, ry } = LAKE;
    const n = Math.floor(6 + amount * 40);
    for (let i = 0; i < n; i++) {
      const per = 2.2 + N.hash(i * 7) * 2.5;
      const ph = N.hash(i * 13) * per;
      const lt = ((t - t0 + ph) % per) / per;
      if (t - t0 + ph < per * 0.3 && i > 4) continue;
      const bx = cx + (N.hash(i * 3) - 0.5) * rx * 1.3 * (0.4 + 0.6 * N.hash(i * 5));
      const by = cy + (N.hash(i * 11) - 0.45) * ry * 1.6;
      const persp = 0.6 + (by - (cy - ry)) / (ry * 2.5);
      const r = (4 + lt * 38) * persp;
      ctx.strokeStyle = rgb(mix(env.skyMid, [220, 240, 240], 0.4), (1 - lt) * 0.45 * amount + 0.05);
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.ellipse(bx, by, r, r * 0.2, 0, 0, Math.PI * 2);
      ctx.stroke();
      if (lt < 0.18) {
        ctx.fillStyle = rgb([220, 245, 245], (0.18 - lt) * 4 * amount);
        ctx.beginPath();
        ctx.arc(bx, by - 1, 1.6 * persp + 1, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // ---- eruption on the surface -----------------------------------------
  function drawEruption(ctx, env, t, e) {
    // e: 0..1 progress of the eruption (slow motion).
    const { cx, cy } = LAKE;
    if (e <= 0) return;
    const col = mix(lit(env, [230, 235, 240], 1.2), [196, 202, 214], 0.6);
    const brown = mix(lit(env, [170, 150, 120], 1.0), [120, 118, 120], 0.5);
    // Churning dome of water.
    const dome = smooth(0, 0.35, e);
    for (let i = 0; i < 60; i++) {
      const a = N.hash(i) * Math.PI * 2, rr = Math.sqrt(N.hash(i + 99)) * 330 * (0.4 + dome);
      const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr * 0.12;
      const s = 30 + N.hash(i + 5) * 50;
      ctx.globalAlpha = 0.45 * dome * (1 - rr / 600);
      ctx.drawImage(softSprite(i % 3 ? col : brown, 64), x - s, y - s * 0.4 - Math.sin(t * 3 + i) * 5, s * 2, s * 0.8);
    }
    // Fountain of spray (the real one rose ~100 m).
    const fount = smooth(0.08, 0.5, e) * (1 - smooth(0.75, 1, e) * 0.6);
    for (let i = 0; i < 180; i++) {
      const life = 1.8 + N.hash(i * 3) * 1.4;
      const lt = ((t * 0.45 + N.hash(i) * life) % life) / life;
      const vx = (N.hash(i * 5) - 0.5) * 420;
      const vy = 380 + N.hash(i * 7) * 380;
      const x = cx + vx * lt + (N.hash(i * 9) - 0.5) * 60;
      const y = cy - (vy * lt - 470 * lt * lt) * fount * 2.0;
      const s = (10 + N.hash(i * 11) * 26) * (0.6 + lt);
      ctx.globalAlpha = 0.7 * fount * (1 - lt * 0.8);
      ctx.drawImage(softSprite(i % 4 ? col : brown, 64), x - s, y - s, s * 2, s * 2);
    }
    ctx.globalAlpha = 1;
    // Expanding wave ring.
    for (const d of [0.1, 0.3]) {
      const w = smooth(d, d + 0.7, e);
      if (w <= 0 || w >= 1) continue;
      const rr = 80 + w * 560;
      ctx.strokeStyle = rgb(col, 0.3 * (1 - w));
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.ellipse(cx, cy + 4, rr, rr * 0.1, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = rgb([235, 242, 250], 0.4 * (1 - w));
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  // ---- the invisible cloud ---------------------------------------------
  // amount 0..1 of how far the cloud has travelled; rise = the vertical column above the lake.
  const MIST = (() => {
    const r = rng(42);
    const ps = [];
    for (let i = 0; i < 260; i++) {
      ps.push({
        x0: LAKE.cx + r.range(-420, 420), d: r.range(-10, 1), spread: r.range(-60, 420),
        hover: r.range(-60, -8), size: r.range(70, 190), delay: r() * 0.45, ph: r() * 6.28, a: r.range(0.5, 1),
        left: r() < 0.18,
      });
    }
    return ps;
  })();

  function drawMist(ctx, env, t, m) {
    // m = {spread 0..1, rise 0..1, alpha, pass: 'back'|'front'}
    const base = mix(lit(env, [205, 212, 222], 0.9), [132, 138, 146], 0.6);
    for (let i = 0; i < MIST.length; i++) {
      const p = MIST[i];
      const k = clamp((m.spread - p.delay) / (1 - p.delay));
      let x, y;
      if (p.left) {
        x = p.x0 - k * 360;
        y = LAKE.cy + 5 + p.spread * 0.06;
      } else {
        x = p.x0 + k * (2400 + p.d * 300) + Math.sin(t * 0.3 + p.ph) * 20;
        const depthF = smooth(1600, 2500, x);
        y = mistGround(x) + p.spread * lerp(0.08, 0.75, depthF);
      }
      const front = y > 780;
      if ((m.pass === 'back' && front) || (m.pass === 'front' && !front)) continue;
      const hov = p.hover * (1 + (1 - k) * 1.5) - (m.rise || 0) * 120 * (1 - k);
      const s = p.size * (0.7 + k * 0.6) * (y > 700 ? 1 + (y - 700) / 400 : 1);
      const a = m.alpha * p.a * 0.22 * smooth(0, 0.08, k + (m.rise || 0) * 0.2) * (1 - smooth(0.93, 1, k) * 0.3);
      if (a < 0.003) continue;
      ctx.globalAlpha = a;
      ctx.drawImage(softSprite(base, 128, 0.8), x - s, y + hov - s * 0.45, s * 2, s * 0.9);
    }
    ctx.globalAlpha = 1;
  }

  // Rising column / billow right after the eruption.
  function drawCloudColumn(ctx, env, t, c) {
    if (c <= 0) return;
    const base = mix(lit(env, [210, 215, 225], 0.9), [150, 155, 164], 0.6);
    for (let i = 0; i < 120; i++) {
      const u = N.hash(i * 17);
      const h = u * 330 * smooth(0, 0.7, c);
      const wide = 60 + u * 260 * c + c * 200;
      const x = LAKE.cx + (N.hash(i * 23) - 0.5) * wide * 2 + Math.sin(t * 0.5 + i) * 10;
      const y = LAKE.cy - h + Math.sin(t * 0.7 + i * 2) * 6;
      const s = 70 + N.hash(i * 29) * 120 + c * 60;
      ctx.globalAlpha = 0.13 * smooth(0, 0.3, c) * (1 - u * 0.5);
      ctx.drawImage(softSprite(base, 128, 0.8), x - s, y - s * 0.7, s * 2, s * 1.4);
    }
    ctx.globalAlpha = 1;
  }

  // ---- full draw --------------------------------------------------------
  // o: {windows(house)->0..1, bubbles, eruption, cloudColumn, mist:{...}, wind, foreground, lakeTint, shake}
  function drawValley(ctx, t, cam, env, S, o = {}) {
    const sky = N.drawSky(ctx, env, t, cam, S, { horizon: o.horizon || 620, sunX: o.sunX || 1560, moonX: o.moonX, moonY: o.moonY });
    if (o.clouds) N.drawCloudBank(ctx, env, t, S, 200, 11, o.clouds);
    // Far mountains
    let [a, b] = layerSpan(cam, 0.25);
    setLayer(ctx, cam, 0.25, S);
    fillRidge(ctx, env, farMountains, a, b, 300, 700, hex('#4b6a5a'), 0.72, 0.6);
    [a, b] = layerSpan(cam, 0.55);
    setLayer(ctx, cam, 0.55, S);
    fillRidge(ctx, env, hills, a, b, 420, 760, hex('#4d7040'), 0.5, 0.4);
    // Main plane
    [a, b] = layerSpan(cam, 1, 160);
    setLayer(ctx, cam, 1, S);
    // Crater walls & land
    ridgePath(ctx, craterTop, a, b, 1500);
    let g = ctx.createLinearGradient(0, 380, 0, 1300);
    g.addColorStop(0, litS(env, PAL.grassDark, 0.55, 0.3));
    g.addColorStop(0.25, litS(env, PAL.grass, 0.45, 0.12));
    g.addColorStop(1, litS(env, PAL.grass, 0.55, 0));
    ctx.fillStyle = g;
    ctx.fill();
    // Rim lighting on the crater skyline.
    ctx.strokeStyle = litS(env, PAL.grassDry, 0.9, 0.2, 0.35);
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let x = a; x < b; x += 8) x === a ? ctx.moveTo(x, craterTop(x)) : ctx.lineTo(x, craterTop(x));
    ctx.stroke();
    // Rocky streaks on the crater wall.
    ctx.strokeStyle = litS(env, PAL.rock, 0.3, 0.3, 0.25);
    ctx.lineWidth = 3;
    for (let i = 0; i < 26; i++) {
      const x = LAKE.cx - 620 + i * 48 + noise(i) * 20;
      if (x < a || x > b) continue;
      const y0 = craterTop(x) + 12;
      ctx.beginPath();
      ctx.moveTo(x, y0);
      ctx.lineTo(x + 8 + noise(i * 2) * 8, Math.min(y0 + 40 + N.hash(i) * 40, farShore(x) - 5));
      ctx.stroke();
    }
    for (const tr of world.wallTrees) if (tr.x > a && tr.x < b && tr.y < 600) drawTree(ctx, env, tr, t, (o.wind || 0.3) * 0.5);

    // Escarpment shading: slope face between lake terrace and village terrace.
    // Soft large-scale terrain shading so the land doesn't read flat.
    for (const pt of TERRAIN) {
      if (pt.x < a - pt.r || pt.x > b + pt.r) continue;
      if (pt.y < craterTop(pt.x) + pt.r * 0.2) continue;
      ctx.globalAlpha = pt.a;
      ctx.drawImage(softSprite(pt.dark ? lit(env, PAL.grassDark, 0.05) : lit(env, PAL.grassDry, 0.9), 64), pt.x - pt.r, pt.y - pt.r * 0.35, pt.r * 2, pt.r * 0.7);
    }
    ctx.globalAlpha = 1;
    for (let x = a; x < b; x += 40) {
      const y = edge(x);
      const hgt = 30 + 50 * smooth(1500, 2300, x);
      const eg = ctx.createLinearGradient(0, y, 0, y + hgt);
      eg.addColorStop(0, litS(env, PAL.grassDark, 0.05, 0, 0.45));
      eg.addColorStop(1, litS(env, PAL.grassDark, 0.05, 0, 0));
      ctx.fillStyle = eg;
      ctx.fillRect(x, y, 41, hgt);
    }
    ctx.strokeStyle = litS(env, PAL.grassDry, 0.9, 0.05, 0.35);
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let x = a; x <= b; x += 10) x === a ? ctx.moveTo(x, edge(x) - 1) : ctx.lineTo(x, edge(x) - 1);
    ctx.stroke();

    const lightX = sky.moon ? worldX(sky.moon[0], cam, S) : sky.sun ? worldX(sky.sun[0], cam, S) : null;
    drawLake(ctx, env, t, { ...o, lightA: sky.moon ? env.moon : env.sun * 0.9, lightCol: sky.moon ? [230, 235, 255] : [255, 210, 150] }, lightX);
    drawEruption(ctx, env, t, o.eruption || 0);
    for (const tr of world.shore) drawTree(ctx, env, tr, t, (o.wind || 0.3) * 0.5);

    // Fields & paths on the village terrace.
    for (const f of world.fields) {
      ctx.fillStyle = litS(env, f.crop ? PAL.grassDry : PAL.soil, 0.5, 0.1, 0.85);
      ctx.beginPath();
      ctx.moveTo(f.x, f.y);
      ctx.lineTo(f.x + f.w, f.y);
      ctx.lineTo(f.x + f.w + f.sk, f.y + f.h);
      ctx.lineTo(f.x + f.sk, f.y + f.h);
      ctx.fill();
      ctx.strokeStyle = litS(env, f.crop ? PAL.grassDark : hex('#7d4a2a'), 0.3, 0.1, 0.5);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let i = 1; i < 7; i++) {
        const u = i / 7;
        ctx.moveTo(f.x + f.sk * u, f.y + f.h * u);
        ctx.lineTo(f.x + f.w + f.sk * u, f.y + f.h * u);
      }
      ctx.stroke();
    }
    ctx.strokeStyle = litS(env, PAL.path, 0.5, 0.05, 0.75);
    ctx.lineCap = 'round';
    for (const [w, pts] of [[14, [[1560, 676], [1800, 730], [2100, 800], [2500, 860], [3000, 900], [3600, 960]]], [9, [[2100, 800], [2200, 900], [2150, 1050]]], [9, [[2700, 880], [2850, 780], [3200, 740]]]]) {
      ctx.lineWidth = w;
      ctx.beginPath();
      ctx.moveTo(...pts[0]);
      for (let i = 1; i < pts.length - 1; i++) ctx.quadraticCurveTo(pts[i][0], pts[i][1], (pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2);
      ctx.lineTo(...pts[pts.length - 1]);
      ctx.stroke();
    }
    ctx.lineCap = 'butt';

    if (o.mist) drawMist(ctx, env, t, { ...o.mist, pass: 'back' });
    drawCloudColumn(ctx, env, t, o.cloudColumn || 0);

    // Village (depth-sorted).
    const wind = o.wind == null ? 0.3 : o.wind;
    let mistDrawn = false;
    for (const it of world.all) {
      if (!mistDrawn && it.y > 780 && o.mist) {
        drawMist(ctx, env, t, { ...o.mist, pass: 'front', maxY: 99999 });
        mistDrawn = true;
      }
      if (it.h) {
        const h = it.h;
        if (h.x < a - 100 || h.x > b + 100) continue;
        const w = o.windows ? o.windows(h) : 0;
        (h.hut ? drawHut : drawBox)(ctx, env, { ...h, win: w });
      } else {
        const tr = it.t;
        if (tr.x < a - 100 || tr.x > b + 100) continue;
        drawTree(ctx, env, tr, t, wind);
      }
    }
    if (!mistDrawn && o.mist) drawMist(ctx, env, t, { ...o.mist, pass: 'front' });
    drawGrassTufts(ctx, env, Math.max(a, 1400), b, (x) => edge(x) + 30 + (N.hash(Math.floor(x)) * 300), 5, t, wind, 0.9, 0.05, 0.05);

    if (o.foreground) {
      setLayer(ctx, cam, 1.35, S);
      const [fa, fb] = layerSpan(cam, 1.35, 200);
      const fgTop = (x) => 1090 + fbm(x * 0.004) * 40;
      ridgePath(ctx, fgTop, fa, fb, 1600);
      ctx.fillStyle = litS(env, PAL.grassDark, 0.35, 0);
      ctx.fill();
      drawGrassTufts(ctx, env, fa, fb, fgTop, 9, t, wind, 2.2, 0, 0.06);
      for (const tr of world.fg) drawTree(ctx, env, tr, t, wind);
      if (o.mist && o.mist.fg) drawMist(ctx, env, t, { ...o.mist, pass: 'front' });
    }
    return sky;
  }

  function worldX(sx, cam, S) {
    const z = cam.z, cx = cam.x;
    return (sx - 960 - (cam.sx || 0)) / z + cx;
  }

  Object.assign(N, { drawValley, LAKE, VALLEY: world, craterTop, edge, mistGround, drawMist, lakePath });
})();
