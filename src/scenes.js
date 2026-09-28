/* Secondary sets: the street, close-ups, lake surface, interior, aerial view and the diagram. */
(function () {
  const N = window.NYOS;
  const { W, H, PAL, rng, hex, rgb, lit, litS, faceK, mix, clamp, lerp, smooth, easeInOut, easeOut, noise, fbm,
    softSprite, setLayer, layerSpan, screen, fillRidge, ridgePath, drawHut, drawBox, makeTree, drawTree, drawGrassTufts,
    glow, makeEnv, contactShadow } = N;

  const shakeOf = (t, amt, f = 7) => ({ sx: noise(t * f) * amt, sy: noise(t * f + 31) * amt });

  function sunRays(ctx, S, x, y, a, t) {
    if (a <= 0) return;
    screen(ctx, S);
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 9; i++) {
      const ang = Math.PI * (0.62 + i * 0.05) + noise(i + t * 0.1) * 0.02;
      const len = 2400, w = 0.018 + N.hash(i) * 0.03;
      const g = ctx.createLinearGradient(x, y, x + Math.cos(ang) * len, y + Math.sin(ang) * len);
      g.addColorStop(0, `rgba(255,214,160,${(a * (0.05 + N.hash(i + 4) * 0.05)).toFixed(3)})`);
      g.addColorStop(1, 'rgba(255,214,160,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(ang - w) * len, y + Math.sin(ang - w) * len);
      ctx.lineTo(x + Math.cos(ang + w) * len, y + Math.sin(ang + w) * len);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  function dust(ctx, S, t, n, seed, a, color = [255, 225, 180]) {
    screen(ctx, S);
    const r = rng(seed);
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < n; i++) {
      const x = (r() * W + t * (6 + r() * 10) + Math.sin(t * 0.5 + i) * 20) % W;
      const y = (r() * H + Math.sin(t * 0.3 + i * 2) * 25 - t * 3) % H;
      const s = 2 + r() * 5;
      ctx.globalAlpha = a * (0.3 + 0.7 * Math.abs(Math.sin(t * 0.7 + i)));
      ctx.drawImage(softSprite(color, 32), x - s, (y + H) % H - s, s * 2, s * 2);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  function drawBird(ctx, env, x, y, s, facing = -1) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(facing * s, s);
    ctx.fillStyle = litS(env, [40, 36, 40], 0.3);
    ctx.beginPath();
    ctx.ellipse(0, -9, 11, 7, -0.25, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(-9, -17, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(8, -9); ctx.lineTo(22, -2); ctx.lineTo(9, -4);
    ctx.fill();
    ctx.fillStyle = litS(env, [210, 160, 60], 0.6);
    ctx.beginPath();
    ctx.moveTo(-13, -18); ctx.lineTo(-19, -16); ctx.lineTo(-13, -15);
    ctx.fill();
    ctx.strokeStyle = litS(env, [60, 50, 40], 0.3);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-2, -3); ctx.lineTo(-2, 1); ctx.moveTo(2, -3); ctx.lineTo(2, 1);
    ctx.stroke();
    ctx.restore();
  }

  // ------------------------------------------------------------------ street
  const STREET = (() => {
    const r = rng(303);
    const back = [], front = [], trees = [];
    for (let x = 300; x < 3200; x += r.range(140, 230)) back.push({ x, y: 618 + r.range(-6, 6), s: r.range(0.7, 0.95), hut: r() < 0.5, wall: r.pick([PAL.mud, PAL.plaster, PAL.paintOchre]), roof: r() < 0.5 ? PAL.metal : PAL.thatch, fog: 0.35 });
    for (let x = 500; x < 2900; x += r.range(330, 430)) front.push({ x, y: 712, s: r.range(1.7, 2.0), hut: r() < 0.45, wall: r.pick([PAL.mud, PAL.plaster, PAL.paintBlue, PAL.paintOchre]), roof: r() < 0.6 ? PAL.metal : PAL.rust });
    for (let i = 0; i < 16; i++) { const t = makeTree(r, r.range(200, 3200), 612, r.range(0.8, 1.2), r() < 0.35 ? 'palm' : 'round'); t.fog = 0.35; trees.push(t); }
    const frontTrees = [makeTree(r, 1180, 706, 2.1, 'palm'), makeTree(r, 2080, 706, 2.3, 'round'), makeTree(r, 820, 706, 2.0, 'round')];
    return { back, front, trees, frontTrees };
  })();

  function drawStreet(ctx, t, u, S) {
    const env = makeEnv(0.84);
    const cam = { x: lerp(1250, 1650, easeInOut(u)), y: 540, z: 1.0 + 0.03 * u, ...shakeOf(t, 1.2, 3) };
    const sky = N.drawSky(ctx, env, t, cam, S, { horizon: 560, sunX: 1680 });
    N.drawCloudBank(ctx, env, t, S, 180, 21, 0.45);
    let [a, b] = layerSpan(cam, 0.12);
    setLayer(ctx, cam, 0.12, S);
    fillRidge(ctx, env, (x) => 470 + fbm(x * 0.003 + 2) * 70, a, b, 380, 700, hex('#4b6a5a'), 0.7, 0.55);
    [a, b] = layerSpan(cam, 0.3);
    setLayer(ctx, cam, 0.3, S);
    fillRidge(ctx, env, (x) => 540 + fbm(x * 0.004 + 7) * 40, a, b, 480, 700, hex('#4d7040'), 0.5, 0.4);
    // back row
    [a, b] = layerSpan(cam, 0.55);
    setLayer(ctx, cam, 0.55, S);
    ctx.fillStyle = litS(env, PAL.grass, 0.5, 0.3);
    ctx.fillRect(a, 596, b - a, 600);
    const items = [...STREET.back.map((h) => ({ y: h.y, h })), ...STREET.trees.map((tr) => ({ y: tr.y, tr }))].sort((p, q) => p.y - q.y);
    for (const it of items) {
      if (it.h) (it.h.hut ? drawHut : drawBox)(ctx, env, { ...it.h, win: 0 });
      else drawTree(ctx, env, it.tr, t, 0.2);
    }
    // main: grass verge, road
    [a, b] = layerSpan(cam, 1, 300);
    setLayer(ctx, cam, 1, S);
    let g = ctx.createLinearGradient(0, 660, 0, 1200);
    g.addColorStop(0, litS(env, PAL.grass, 0.55, 0.15));
    g.addColorStop(1, litS(env, PAL.grassDark, 0.5, 0));
    ctx.fillStyle = g;
    ctx.fillRect(a, 660, b - a, 700);
    g = ctx.createLinearGradient(0, 725, 0, 930);
    g.addColorStop(0, litS(env, PAL.path, 0.6, 0.1));
    g.addColorStop(1, litS(env, PAL.soil, 0.55, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(a, 730);
    for (let x = a; x < b; x += 30) ctx.lineTo(x, 728 + noise(x * 0.01) * 6);
    ctx.lineTo(b, 930);
    for (let x = b; x > a; x -= 30) ctx.lineTo(x, 925 + noise(x * 0.013 + 5) * 8);
    ctx.fill();
    ctx.strokeStyle = litS(env, hex('#7d4a2a'), 0.3, 0, 0.35);
    ctx.lineWidth = 3;
    for (const ry of [790, 812, 860, 884]) {
      ctx.beginPath();
      for (let x = a; x < b; x += 40) ctx.lineTo(x, ry + noise(x * 0.02 + ry) * 3);
      ctx.stroke();
    }
    drawGrassTufts(ctx, env, a, b, () => 726, 31, t, 0.3, 1.4, 0.05, 0.05);
    const fitems = [...STREET.front.map((h) => ({ y: h.y, h })), ...STREET.frontTrees.map((tr) => ({ y: tr.y, tr }))].sort((p, q) => p.y - q.y);
    for (const it of fitems) {
      if (it.h) (it.h.hut ? drawHut : drawBox)(ctx, env, { ...it.h, win: 0 });
      else drawTree(ctx, env, it.tr, t, 0.35);
    }
    // bicycle leaning against a wall
    drawBicycle(ctx, env, 1660, 716, 1.3);
    // An empty bench.
    ctx.fillStyle = litS(env, PAL.wood, 0.6);
    ctx.fillRect(2230, 690, 150, 10);
    ctx.fillStyle = litS(env, PAL.wood, 0.3);
    ctx.fillRect(2240, 700, 8, 22);
    ctx.fillRect(2362, 700, 8, 22);
    // foreground fence with the motionless bird
    [a, b] = layerSpan(cam, 1.5, 200);
    setLayer(ctx, cam, 1.5, S);
    const fy = 1040;
    ridgePath(ctx, (x) => fy - 10 + fbm(x * 0.01) * 12, a, b, 1400);
    ctx.fillStyle = litS(env, PAL.grassDark, 0.3, 0);
    ctx.fill();
    for (let x = Math.floor(a / 260) * 260; x < b; x += 260) {
      ctx.fillStyle = litS(env, PAL.wood, 0.25);
      ctx.fillRect(x - 9, fy - 150, 18, 170);
      ctx.fillStyle = litS(env, PAL.wood, 0.75);
      ctx.fillRect(x + 5, fy - 150, 4, 170);
    }
    ctx.fillStyle = litS(env, PAL.wood, 0.35);
    ctx.fillRect(a, fy - 120, b - a, 9);
    ctx.fillRect(a, fy - 64, b - a, 9);
    drawBird(ctx, env, 1300, fy - 150, 2.6, -1);
    drawGrassTufts(ctx, env, a, b, () => fy - 4, 41, t, 0.4, 2.6, 0, 0.05);
    sunRays(ctx, S, sky.sun ? sky.sun[0] : 1700, sky.sun ? sky.sun[1] : 400, 0.9, t);
    dust(ctx, S, t, 50, 5, 0.35);
    N.grade(ctx, S, 'rgb(255,190,140)', 0.1, 'soft-light');
  }

  function drawBicycle(ctx, env, x, y, s) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.rotate(-0.08);
    ctx.strokeStyle = litS(env, [40, 40, 45], 0.4);
    ctx.lineWidth = 3;
    for (const wx of [-38, 38]) {
      ctx.beginPath();
      ctx.arc(wx, -24, 22, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.strokeStyle = litS(env, [150, 40, 35], 0.6);
    ctx.beginPath();
    ctx.moveTo(-38, -24); ctx.lineTo(-6, -24); ctx.lineTo(18, -54); ctx.lineTo(-14, -54); ctx.lineTo(-38, -24);
    ctx.moveTo(-6, -24); ctx.lineTo(-18, -62); ctx.moveTo(18, -54); ctx.lineTo(38, -24); ctx.moveTo(18, -54); ctx.lineTo(14, -70);
    ctx.stroke();
    ctx.strokeStyle = litS(env, [30, 30, 30], 0.3);
    ctx.beginPath();
    ctx.moveTo(4, -72); ctx.lineTo(24, -70); ctx.moveTo(-26, -64); ctx.lineTo(-10, -64);
    ctx.stroke();
    ctx.restore();
  }

  // ------------------------------------------------------------- close-ups
  const BIGTREE = (() => {
    const r = rng(11);
    const clusters = [];
    const branches = [
      [[640, 1100], [660, 700], [700, 470]],
      [[690, 600], [520, 470], [380, 330]],
      [[700, 520], [900, 400], [1130, 300]],
      [[700, 470], [760, 300], [760, 170]],
      [[680, 760], [880, 660], [1080, 560]],
    ];
    const ends = [[700, 470, 170], [380, 330, 190], [1130, 300, 200], [760, 170, 190], [1080, 560, 150], [520, 220, 150], [950, 180, 160]];
    for (const [x, y, R] of ends) {
      const blobs = [];
      for (let i = 0; i < 11; i++) {
        const a = r() * Math.PI * 2, d = Math.sqrt(r()) * R * 0.7;
        blobs.push([Math.cos(a) * d, Math.sin(a) * d * 0.75, R * r.range(0.35, 0.55)]);
      }
      const leaves = [];
      for (let i = 0; i < 70; i++) {
        const a = r() * Math.PI * 2, d = R * r.range(0.75, 1.05);
        leaves.push([Math.cos(a) * d, Math.sin(a) * d * 0.8, r.range(8, 16), r() * 6.28]);
      }
      clusters.push({ x, y, R, blobs, leaves, ph: r() * 6.28 });
    }
    return { branches, clusters };
  })();

  function drawBigTree(ctx, env, t, wind) {
    ctx.lineCap = 'round';
    for (let i = 0; i < BIGTREE.branches.length; i++) {
      const [p0, p1, p2] = BIGTREE.branches[i];
      const sw = Math.sin(t * 1.1 + i) * wind * 6;
      const w = i === 0 ? 70 : 30 - i * 2;
      const g = ctx.createLinearGradient(p0[0] - w, 0, p0[0] + w, 0);
      g.addColorStop(0, litS(env, PAL.trunk, 0.1));
      g.addColorStop(0.7, litS(env, PAL.trunk, 0.4));
      g.addColorStop(1, litS(env, PAL.trunk, 1.0));
      ctx.strokeStyle = g;
      ctx.lineWidth = w;
      ctx.beginPath();
      ctx.moveTo(...p0);
      ctx.quadraticCurveTo(p1[0] + sw * 0.5, p1[1], p2[0] + sw, p2[1]);
      ctx.stroke();
      ctx.lineWidth = w * 0.6;
      ctx.stroke();
    }
    ctx.lineCap = 'butt';
    const base = PAL.canopy;
    for (const c of BIGTREE.clusters) {
      const a = wind * (0.03 * Math.sin(t * 1.3 + c.ph) + 0.02 * noise(t * 1.7 + c.ph));
      ctx.save();
      ctx.translate(c.x, c.y + c.R);
      ctx.rotate(a);
      ctx.translate(0, -c.R);
      // Shadowed mass first so the cluster reads as one volume.
      ctx.fillStyle = litS(env, PAL.canopy2, 0.12);
      ctx.beginPath();
      for (const [bx, by, br] of c.blobs) {
        ctx.moveTo(bx + br * 1.05, by + br * 0.1);
        ctx.arc(bx, by + br * 0.1, br * 1.05, 0, Math.PI * 2);
      }
      ctx.fill();
      for (const [bx, by, br] of c.blobs) {
        const gr = ctx.createRadialGradient(bx + br * 0.35, by - br * 0.45, br * 0.2, bx, by, br * 1.0);
        gr.addColorStop(0, litS(env, PAL.canopy3, 0.95));
        gr.addColorStop(0.5, litS(env, base, 0.5));
        gr.addColorStop(1, litS(env, PAL.canopy2, 0.18, 0, 0));
        ctx.fillStyle = gr;
        ctx.beginPath();
        ctx.arc(bx, by, br, 0, Math.PI * 2);
        ctx.fill();
      }
      for (const [lx, ly, ls, lp] of c.leaves) {
        const fl = Math.sin(t * 6 + lp) * 0.4 * wind;
        const k = lx > 0 ? 0.95 : 0.3;
        ctx.fillStyle = litS(env, lx > 0 ? PAL.canopy3 : PAL.canopy2, k);
        ctx.beginPath();
        ctx.ellipse(lx, ly, ls, ls * 0.45, lp + fl, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  // Out-of-focus background. Blur filters are slow, so it's drawn once into a
  // cache and then just shifted/scaled for the camera (parallax 0.4).
  const bgCache = new Map();
  function blurredVillage(ctx, env, t, cam, S, groundY, blur) {
    const P = 0.4, M = 200;
    const key = `${groundY}|${blur}|${S}|${env.tod.toFixed(2)}`;
    let c = bgCache.get(key);
    if (!c) {
      c = document.createElement('canvas');
      c.width = Math.ceil((W + 2 * M) * S);
      c.height = Math.ceil((H + 2 * M) * S);
      const g = c.getContext('2d');
      drawVillageLayer(g, env, 0, { x: N.REF_X, y: N.REF_Y, z: 1, sx: M / P, sy: M / P }, S, groundY, blur);
      if (bgCache.size > 8) bgCache.clear();
      bgCache.set(key, c);
    }
    const z = 1 + (cam.z - 1) * P;
    const dx = -(cam.x - N.REF_X) * P * z + (cam.sx || 0) * P;
    const dy = -(cam.y - N.REF_Y) * P * z + (cam.sy || 0) * P;
    ctx.setTransform(S, 0, 0, S, 0, 0);
    ctx.translate(W / 2 + dx, H / 2 + dy);
    ctx.scale(z, z);
    ctx.drawImage(c, -(W / 2 + M), -(H / 2 + M), W + 2 * M, H + 2 * M);
  }
  function drawVillageLayer(ctx, env, t, cam, S, groundY, blur) {
    ctx.filter = `blur(${blur * S}px)`;
    const [a, b] = layerSpan(cam, 0.4, 300);
    setLayer(ctx, cam, 0.4, S);
    fillRidge(ctx, env, (x) => groundY - 180 + fbm(x * 0.003) * 60, a, b, groundY - 250, groundY + 100, hex('#4d7040'), 0.45, 0.3);
    ctx.fillStyle = litS(env, PAL.grass, 0.55, 0.2);
    ctx.fillRect(a, groundY - 20, b - a, 800);
    const r = rng(8);
    for (let x = a; x < b; x += r.range(180, 320)) {
      if (r() < 0.5) drawHut(ctx, env, { x, y: groundY + r.range(0, 40), s: r.range(1.1, 1.5), win: 0, wall: PAL.mud, roof: PAL.thatch });
      else drawBox(ctx, env, { x, y: groundY + r.range(0, 40), s: r.range(1.0, 1.3), win: 0, wall: r.pick([PAL.plaster, PAL.paintBlue]), roof: PAL.metal });
      if (r() < 0.6) drawTree(ctx, env, makeTree(r, x + 110, groundY + 10, r.range(1.3, 1.8), r() < 0.4 ? 'palm' : 'round'), t, 0.3);
    }
    ctx.filter = 'none';
  }

  function drawCloseTree(ctx, t, u, S) {
    const env = makeEnv(0.9);
    const cam = { x: 1550, y: 540, z: 1 + u * 0.06, ...shakeOf(t, 2.2, 2.5) };
    const sky = N.drawSky(ctx, env, t, cam, S, { horizon: 760, sunX: 1720 });
    N.drawCloudBank(ctx, env, t, S, 160, 3, 0.5);
    blurredVillage(ctx, env, t, cam, S, 800, 5);
    setLayer(ctx, cam, 1, S);
    const g = ctx.createLinearGradient(0, 860, 0, 1100);
    g.addColorStop(0, litS(env, PAL.grass, 0.6, 0.05));
    g.addColorStop(1, litS(env, PAL.grassDark, 0.4));
    ctx.fillStyle = g;
    ctx.fillRect(-800, 860, 4000, 400);
    // long shadow of the tree on the ground
    ctx.fillStyle = 'rgba(20,20,40,0.22)';
    ctx.beginPath();
    ctx.ellipse(250, 990, 560, 60, 0, 0, Math.PI * 2);
    ctx.fill();
    drawGrassTufts(ctx, env, -600, 3000, () => 1040, 3, t, 0.9, 2.4, 0, 0.05);
    // swing hanging still-ish from the right branch
    const sw = Math.sin(t * 1.4) * 0.05 + noise(t * 0.8) * 0.03;
    ctx.save();
    ctx.translate(1000, 590);
    ctx.rotate(sw);
    ctx.strokeStyle = litS(env, [120, 100, 70], 0.6);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-40, 0); ctx.lineTo(-45, 320); ctx.moveTo(40, 0); ctx.lineTo(45, 320);
    ctx.stroke();
    ctx.fillStyle = litS(env, PAL.wood, 0.7);
    ctx.fillRect(-60, 318, 120, 14);
    ctx.fillStyle = litS(env, PAL.wood, 0.25);
    ctx.fillRect(-60, 330, 120, 5);
    ctx.restore();
    drawBigTree(ctx, env, t, 1.0);
    // a single falling leaf
    const lt = (t - 10) / 2;
    ctx.fillStyle = litS(env, PAL.grassDry, 0.8);
    ctx.save();
    ctx.translate(1250 - lt * 120 + Math.sin(lt * 5) * 40, 380 + lt * 330);
    ctx.rotate(Math.sin(lt * 6) * 0.8);
    ctx.beginPath();
    ctx.ellipse(0, 0, 11, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // light through leaves
    glow(ctx, 1500, 300, 500, [255, 220, 170], 0.25);
    if (sky.sun) sunRays(ctx, S, sky.sun[0], sky.sun[1], 0.6, t);
    dust(ctx, S, t, 40, 9, 0.3);
    N.grade(ctx, S, 'rgb(70,80,110)', 0.18, 'multiply');
  }

  function drawCloth(ctx, x, y, w, h, color, ang, env, k) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    ctx.fillStyle = litS(env, color, k);
    ctx.beginPath();
    ctx.moveTo(-w / 2, 0);
    ctx.lineTo(w / 2, 0);
    ctx.quadraticCurveTo(w / 2 + Math.sin(ang * 8) * 6, h * 0.6, w / 2 - 4, h);
    ctx.lineTo(-w / 2 + 4, h + Math.sin(ang * 5) * 4);
    ctx.quadraticCurveTo(-w / 2 - 3, h * 0.5, -w / 2, 0);
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.14)';
    ctx.fillRect(-w / 2, h * 0.3, w, 4);
    ctx.fillRect(-w / 2, h * 0.7, w, 4);
    ctx.restore();
  }

  function drawCloseDoor(ctx, t, u, S) {
    const env = makeEnv(0.92);
    const cam = { x: 1550 + u * -60, y: 540, z: 1.04, ...shakeOf(t, 1.8, 2.2) };
    setLayer(ctx, cam, 1, S);
    // Plaster wall lit by low morning sun from the right.
    let g = ctx.createLinearGradient(0, 0, 3200, 0);
    g.addColorStop(0, litS(env, PAL.mud, 0.45));
    g.addColorStop(1, litS(env, PAL.mud, 1.0));
    ctx.fillStyle = g;
    ctx.fillRect(0, -100, 3200, 1100);
    const r = rng(5);
    for (let i = 0; i < 60; i++) {
      const x = r.range(0, 3200), y = r.range(-50, 900), s = r.range(40, 160);
      ctx.globalAlpha = r.range(0.08, 0.2);
      ctx.drawImage(softSprite(r() < 0.5 ? lit(env, [120, 80, 50], 0.4) : lit(env, [230, 190, 150], 0.9), 64), x - s, y - s * 0.6, s * 2, s * 1.2);
    }
    ctx.globalAlpha = 1;
    ctx.strokeStyle = litS(env, [90, 60, 40], 0.3, 0, 0.5);
    ctx.lineWidth = 2;
    for (const [x, y] of [[700, 150], [2100, 620], [1350, 90]]) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      for (let i = 1; i < 6; i++) ctx.lineTo(x + i * 18 + noise(i + x) * 12, y + i * 22);
      ctx.stroke();
    }
    // Ground strip.
    g = ctx.createLinearGradient(0, 900, 0, 1100);
    g.addColorStop(0, litS(env, PAL.soil, 0.6));
    g.addColorStop(1, litS(env, PAL.soil, 0.35));
    ctx.fillStyle = g;
    ctx.fillRect(0, 900, 3200, 300);
    ctx.fillStyle = 'rgba(30,15,10,0.35)';
    ctx.fillRect(0, 900, 3200, 10);
    // Door: open, dark inside.
    const dx = 1500, dy = 300, dw = 300, dh = 600;
    ctx.fillStyle = litS(env, PAL.wood, 0.35);
    ctx.fillRect(dx - 22, dy - 22, dw + 44, dh + 22);
    const ig = ctx.createLinearGradient(dx, 0, dx + dw, 0);
    ig.addColorStop(0, '#0b0806');
    ig.addColorStop(1, '#1c130d');
    ctx.fillStyle = ig;
    ctx.fillRect(dx, dy, dw, dh);
    // Sunlight falling into the doorway.
    ctx.fillStyle = litS(env, [220, 170, 120], 0.8, 0, 0.18);
    ctx.beginPath();
    ctx.moveTo(dx + dw, dy + 80); ctx.lineTo(dx + dw * 0.35, dy + dh); ctx.lineTo(dx + dw, dy + dh);
    ctx.fill();
    // Door leaf swung inward.
    const open = 0.62 + Math.sin(t * 0.9) * 0.02;
    const lw = dw * (1 - open);
    ctx.fillStyle = litS(env, PAL.wood, 0.28);
    ctx.beginPath();
    ctx.moveTo(dx, dy); ctx.lineTo(dx + lw, dy + 26); ctx.lineTo(dx + lw, dy + dh - 20); ctx.lineTo(dx, dy + dh);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 2;
    for (let i = 1; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(dx + (lw * i) / 4, dy + (26 * i) / 4);
      ctx.lineTo(dx + (lw * i) / 4, dy + dh - (20 * i) / 4);
      ctx.stroke();
    }
    // Step with a tin cup.
    ctx.fillStyle = litS(env, [150, 130, 110], 0.7);
    ctx.fillRect(dx - 60, dy + dh, dw + 120, 26);
    ctx.fillStyle = litS(env, [150, 130, 110], 0.3);
    ctx.fillRect(dx - 60, dy + dh + 26, dw + 120, 10);
    ctx.fillStyle = litS(env, [180, 190, 200], 0.9);
    ctx.fillRect(dx + dw + 20, dy + dh - 34, 30, 34);
    ctx.fillStyle = 'rgba(20,20,40,0.3)';
    ctx.beginPath();
    ctx.ellipse(dx + dw - 20, dy + dh + 10, 44, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    // Window with shutters and a curtain moving in the breeze.
    const wx = 600, wy = 330, ww = 260, wh = 230;
    ctx.fillStyle = litS(env, PAL.wood, 0.35);
    ctx.fillRect(wx - 16, wy - 16, ww + 32, wh + 32);
    ctx.fillStyle = '#120c08';
    ctx.fillRect(wx, wy, ww, wh);
    const cw = Math.sin(t * 1.6) * 14 + noise(t * 2) * 10;
    ctx.fillStyle = litS(env, hex('#d9c7a0'), 0.8);
    ctx.beginPath();
    ctx.moveTo(wx, wy);
    ctx.lineTo(wx + ww * 0.45, wy);
    ctx.quadraticCurveTo(wx + ww * 0.3 + cw, wy + wh * 0.6, wx + ww * 0.36 + cw * 1.6, wy + wh);
    ctx.lineTo(wx, wy + wh);
    ctx.fill();
    ctx.fillStyle = litS(env, PAL.paintBlue, 0.4);
    ctx.fillRect(wx - 130, wy - 10, 110, wh + 20);
    ctx.fillStyle = litS(env, PAL.paintBlue, 1.0);
    ctx.fillRect(wx + ww + 20, wy - 10, 110, wh + 20);
    // Laundry line (and its shadow on the wall).
    const line = (x) => 210 + Math.pow((x - 1500) / 1500, 2) * -120 + 120;
    const clothes = [[500, 150, 190], [800, 120, 230], [1080, 170, 160], [1900, 160, 210], [2200, 130, 250], [2480, 150, 180]];
    for (const pass of ['shadow', 'real']) {
      const ox = pass === 'shadow' ? -150 : 0, oy = pass === 'shadow' ? 110 : 0;
      ctx.strokeStyle = pass === 'shadow' ? 'rgba(40,20,20,0.18)' : litS(env, [80, 70, 60], 0.5);
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (let x = -200; x < 3300; x += 40) ctx.lineTo(x + ox, line(x) + oy);
      ctx.stroke();
      clothes.forEach(([cx, w, h], i) => {
        const ang = Math.sin(t * 1.3 + i * 1.7) * 0.07 + noise(t * 1.1 + i * 5) * 0.06;
        if (pass === 'shadow') {
          ctx.save();
          ctx.globalAlpha = 0.18;
          drawCloth(ctx, cx + ox, line(cx) + oy, w, h, [20, 10, 10], ang, { amb: [1, 1, 1], key: [0, 0, 0], haze: [0, 0, 0] }, 0);
          ctx.restore();
        } else drawCloth(ctx, cx, line(cx), w, h, PAL.cloth[i % PAL.cloth.length], ang, env, 0.8);
      });
    }
    dust(ctx, S, t, 35, 13, 0.3);
    N.grade(ctx, S, 'rgb(80,90,120)', 0.2, 'multiply');
  }

  function drawCloseYard(ctx, t, u, S) {
    const env = makeEnv(0.9);
    const cam = { x: 1330 + u * 40, y: 700, z: 1.18 + u * 0.1, ...shakeOf(t, 1.6, 2.4) };
    const sky = N.drawSky(ctx, env, t, cam, S, { horizon: 560, sunX: 1800 });
    blurredVillage(ctx, env, t, cam, S, 590, 6);
    setLayer(ctx, cam, 1, S);
    let g = ctx.createLinearGradient(0, 560, 0, 1150);
    g.addColorStop(0, litS(env, PAL.path, 0.55, 0.2));
    g.addColorStop(1, litS(env, PAL.soil, 0.5));
    ctx.fillStyle = g;
    ctx.fillRect(-800, 600, 4000, 700);
    const r = rng(17);
    for (let i = 0; i < 90; i++) {
      const x = r.range(-100, 2100), y = r.range(640, 1100), s = r.range(2, 7) * (y / 700);
      ctx.fillStyle = litS(env, r() < 0.5 ? [120, 80, 50] : [200, 150, 110], r.range(0.3, 0.9));
      ctx.beginPath();
      ctx.ellipse(x, y, s * 1.4, s * 0.7, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // Fire pit: three stones, cold ash, a pot. No smoke.
    const fx = 820, fy = 840;
    ctx.fillStyle = 'rgba(30,20,20,0.35)';
    ctx.beginPath();
    ctx.ellipse(fx - 170, fy + 20, 260, 34, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = litS(env, [90, 88, 86], 0.4);
    ctx.beginPath();
    ctx.ellipse(fx, fy, 140, 34, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = litS(env, [40, 36, 34], 0.3);
    ctx.beginPath();
    ctx.ellipse(fx, fy - 4, 100, 22, 0, 0, Math.PI * 2);
    ctx.fill();
    for (const [sx, sy, sr] of [[-110, 2, 40], [100, -2, 44], [0, 26, 46]]) {
      const sg = ctx.createRadialGradient(fx + sx + 12, fy + sy - 18, 4, fx + sx, fy + sy - 8, sr);
      sg.addColorStop(0, litS(env, PAL.rock, 1.0));
      sg.addColorStop(1, litS(env, PAL.rock, 0.1));
      ctx.fillStyle = sg;
      ctx.beginPath();
      ctx.ellipse(fx + sx, fy + sy - 10, sr, sr * 0.7, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    const pg = ctx.createRadialGradient(fx + 40, fy - 120, 10, fx, fy - 80, 130);
    pg.addColorStop(0, litS(env, [90, 90, 95], 1.0));
    pg.addColorStop(0.5, litS(env, [40, 40, 44], 0.4));
    pg.addColorStop(1, litS(env, [12, 12, 14], 0.1));
    ctx.fillStyle = pg;
    ctx.beginPath();
    ctx.ellipse(fx, fy - 80, 120, 90, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = litS(env, [25, 25, 28], 0.3);
    ctx.beginPath();
    ctx.ellipse(fx, fy - 158, 90, 16, 0, 0, Math.PI * 2);
    ctx.fill();
    // Tipped-over basket with spilled mangoes.
    const bx = 1330, by = 900;
    ctx.fillStyle = 'rgba(30,20,20,0.3)';
    ctx.beginPath();
    ctx.ellipse(bx - 170, by + 10, 230, 30, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    ctx.translate(bx, by - 60);
    ctx.rotate(-1.25);
    const bg = ctx.createLinearGradient(-80, 0, 80, 0);
    bg.addColorStop(0, litS(env, PAL.thatch, 0.3));
    bg.addColorStop(1, litS(env, PAL.thatch, 1.0));
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.moveTo(-90, -70); ctx.lineTo(90, -70); ctx.lineTo(60, 70); ctx.lineTo(-60, 70);
    ctx.fill();
    ctx.strokeStyle = litS(env, PAL.thatch, 0.15, 0, 0.6);
    ctx.lineWidth = 3;
    for (let i = -60; i <= 60; i += 20) {
      ctx.beginPath();
      ctx.moveTo(-85, i); ctx.lineTo(85, i);
      ctx.stroke();
    }
    ctx.fillStyle = '#20150c';
    ctx.beginPath();
    ctx.ellipse(0, -70, 90, 22, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    for (const [mx, my, mr] of [[1180, 915, 26], [1110, 940, 24], [1240, 950, 28], [1040, 905, 22], [960, 960, 25]]) {
      const mg = ctx.createRadialGradient(mx + 8, my - 8, 2, mx, my, mr);
      mg.addColorStop(0, litS(env, hex('#f5c542'), 1.1));
      mg.addColorStop(0.6, litS(env, hex('#e0802c'), 0.6));
      mg.addColorStop(1, litS(env, hex('#6f8b2a'), 0.2));
      ctx.fillStyle = mg;
      ctx.beginPath();
      ctx.ellipse(mx, my, mr * 1.2, mr * 0.85, 0.3, 0, Math.PI * 2);
      ctx.fill();
    }
    // Bucket of perfectly still water.
    const qx = 1720, qy = 800;
    const qg = ctx.createLinearGradient(qx - 70, 0, qx + 70, 0);
    qg.addColorStop(0, litS(env, PAL.metal, 0.3));
    qg.addColorStop(0.7, litS(env, PAL.metal, 1.0));
    qg.addColorStop(1, litS(env, PAL.metal, 0.6));
    ctx.fillStyle = qg;
    ctx.beginPath();
    ctx.moveTo(qx - 70, qy - 120); ctx.lineTo(qx + 70, qy - 120); ctx.lineTo(qx + 56, qy); ctx.lineTo(qx - 56, qy);
    ctx.fill();
    ctx.fillStyle = rgb(mix(env.skyTop, env.skyBot, 0.4));
    ctx.beginPath();
    ctx.ellipse(qx, qy - 120, 68, 16, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = litS(env, PAL.metal, 0.8);
    ctx.lineWidth = 4;
    ctx.stroke();
    if (sky.sun) sunRays(ctx, S, sky.sun[0], sky.sun[1], 0.7, t);
    dust(ctx, S, t, 50, 21, 0.35);
    N.grade(ctx, S, 'rgb(80,90,120)', 0.16, 'multiply');
  }

  // ---------------------------------------------------------- lake surface
  function drawLakeSurface(ctx, t, u, S) {
    const env = makeEnv(0.3, { tint: [0.5, 1.05, 0.95], amount: 0.9 });
    const cam = { x: 1550, y: 540 - u * 20, z: 1 + u * 0.12, sx: 0, sy: Math.sin(t * 0.8) * 3 };
    N.drawSky(ctx, env, t, cam, S, { horizon: 430, moonX: 1300, moonY: 150 });
    const hz = 470;
    let [a, b] = layerSpan(cam, 0.3, 200);
    setLayer(ctx, cam, 0.3, S);
    const wall = (x) => hz - 150 - 70 * Math.exp(-(((x - 1300) / 500) ** 2)) + fbm(x * 0.004) * 50;
    fillRidge(ctx, env, wall, a, b, 250, hz + 2, PAL.grassDark, 0.35, 0.25);
    // water
    [a, b] = layerSpan(cam, 1, 300);
    setLayer(ctx, cam, 1, S);
    let g = ctx.createLinearGradient(0, hz, 0, 1150);
    g.addColorStop(0, rgb(lit(env, hex('#1d4c55'), 0.3)));
    g.addColorStop(0.3, rgb(mix(lit(env, hex('#1b4a55'), 0.5), env.skyMid, 0.3)));
    g.addColorStop(1, rgb(lit(env, hex('#0a2a33'), 0.5)));
    ctx.fillStyle = g;
    ctx.fillRect(a, hz, b - a, 800);
    // reflection of the crater walls
    setLayer(ctx, cam, 0.3, S);
    const [a3, b3] = layerSpan(cam, 0.3, 200);
    ctx.globalAlpha = 0.6;
    ridgePath(ctx, (x) => hz + (hz - wall(x)) * 0.8, a3, b3, hz);
    ctx.fillStyle = litS(env, PAL.grassDark, 0.2, 0.35);
    ctx.fill();
    ctx.globalAlpha = 1;
    setLayer(ctx, cam, 1, S);
    // perspective ripple lines
    for (let i = 0; i < 60; i++) {
      const d = i / 60;
      const y = hz + Math.pow(d, 2.2) * 650;
      const x = a + ((N.hash(i) * 3000 + t * 8 * (1 + d)) % (b - a));
      ctx.strokeStyle = rgb(env.skyBot, 0.06 + d * 0.08);
      ctx.lineWidth = 1 + d * 2;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 80 + d * 300, y);
      ctx.stroke();
    }
    // Low mist hanging on the water.
    for (let i = 0; i < 14; i++) {
      const x = ((N.hash(i * 3) * 2600 + t * 12) % 2600) - 300;
      const y = hz + 10 + N.hash(i * 7) * 60;
      ctx.globalAlpha = 0.12;
      ctx.drawImage(softSprite(mix(env.haze, [200, 220, 225], 0.3), 128), x - 300, y - 30, 600, 60);
    }
    ctx.globalAlpha = 1;
    // Bubbles rising from the deep (visible through the near water) and surface rings.
    const amt = 0.35 + u * 0.65;
    for (let i = 0; i < 44; i++) {
      const per = 1.6 + N.hash(i * 5) * 1.8;
      const lt = ((t + N.hash(i) * per) % per) / per;
      const bx = 150 + N.hash(i * 9) * 1650 + Math.sin(t * 3 + i) * 5;
      const surf = hz + 60 + Math.pow(N.hash(i * 13), 1.5) * 520;
      const p = (surf - hz) / 650;
      if (N.hash(i * 17) > amt) continue;
      if (lt < 0.65) {
        const k = lt / 0.65;
        const by = surf + (1 - k) * 260 * p + 12 * p;
        const r = (2 + 5 * p) * (0.6 + 0.4 * k);
        ctx.fillStyle = rgb([190, 235, 235], 0.12 + 0.25 * k * p);
        ctx.beginPath();
        ctx.arc(bx, by, r, 0, Math.PI * 2);
        ctx.fill();
      } else {
        const k = (lt - 0.65) / 0.35;
        const r = (6 + k * 80) * p;
        ctx.strokeStyle = rgb([200, 240, 240], (1 - k) * 0.45);
        ctx.lineWidth = 1 + p * 1.5;
        ctx.beginPath();
        ctx.ellipse(bx, surf, r, r * 0.14 * (0.4 + p), 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    N.grade(ctx, S, 'rgb(30,140,120)', 0.3, 'soft-light');
  }

  // --------------------------------------------------------------- interior
  function drawInterior(ctx, t, u, S) {
    const env = makeEnv(0.0);
    const cam = { x: 1260 + u * 40, y: 660, z: 1.04 + u * 0.1, ...shakeOf(t, 0.8, 1.5) };
    setLayer(ctx, cam, 1, S);
    // back wall
    let g = ctx.createLinearGradient(0, 0, 0, 1100);
    g.addColorStop(0, '#111528');
    g.addColorStop(1, '#1e2034');
    ctx.fillStyle = g;
    ctx.fillRect(0, -100, 3200, 1300);
    // window with moonlit night outside and mist drifting past
    const wx = 1640, wy = 250, ww = 330, wh = 260;
    ctx.save();
    ctx.beginPath();
    ctx.rect(wx, wy, ww, wh);
    ctx.clip();
    g = ctx.createLinearGradient(0, wy, 0, wy + wh);
    g.addColorStop(0, '#0d1a36');
    g.addColorStop(1, '#2a3a60');
    ctx.fillStyle = g;
    ctx.fillRect(wx, wy, ww, wh);
    ctx.fillStyle = '#0c1422';
    ridgePath(ctx, (x) => wy + wh - 60 + Math.sin(x * 0.02) * 12, wx, wx + ww, wy + wh + 10);
    ctx.fill();
    const mistCol = [150, 160, 185];
    for (let i = 0; i < 26; i++) {
      const x = wx - 200 + ((N.hash(i) * 700 + t * (40 + N.hash(i * 3) * 30)) % 800);
      const y = wy + wh * 0.35 + N.hash(i * 7) * wh * 0.7;
      const s = 70 + N.hash(i * 11) * 90;
      ctx.globalAlpha = 0.32 * smooth(43.6, 44.4, t);
      ctx.drawImage(softSprite(mistCol, 128), x - s, y - s * 0.4, s * 2, s * 0.8);
    }
    ctx.globalAlpha = 1;
    ctx.restore();
    ctx.strokeStyle = '#2b1d14';
    ctx.lineWidth = 16;
    ctx.strokeRect(wx, wy, ww, wh);
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(wx + ww / 2, wy); ctx.lineTo(wx + ww / 2, wy + wh);
    ctx.stroke();
    // moonlight shaft onto the floor
    ctx.globalCompositeOperation = 'lighter';
    g = ctx.createLinearGradient(wx, wy, wx - 500, 1000);
    g.addColorStop(0, 'rgba(110,130,190,0.16)');
    g.addColorStop(1, 'rgba(110,130,190,0.02)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(wx, wy); ctx.lineTo(wx + ww, wy); ctx.lineTo(wx + ww - 560, 1060); ctx.lineTo(wx - 640, 1060);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    // floor
    g = ctx.createLinearGradient(0, 700, 0, 1100);
    g.addColorStop(0, '#1a1414');
    g.addColorStop(1, '#0d0a0c');
    ctx.fillStyle = g;
    ctx.fillRect(0, 700, 3200, 500);
    ctx.fillStyle = 'rgba(120,140,200,0.10)';
    ctx.beginPath();
    ctx.moveTo(1080, 720); ctx.lineTo(1560, 720); ctx.lineTo(1260, 1060); ctx.lineTo(560, 1060);
    ctx.fill();
    // shelves, pots and a hanging lamp (off)
    ctx.fillStyle = '#20160f';
    ctx.fillRect(420, 300, 420, 14);
    for (const [px, pr] of [[480, 40], [580, 34], [700, 46], [790, 30]]) {
      ctx.fillStyle = '#2d2019';
      ctx.beginPath();
      ctx.ellipse(px, 300 - pr * 0.8, pr * 0.8, pr, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = '#1c1512';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(1150, -100); ctx.lineTo(1150, 200);
    ctx.stroke();
    ctx.fillStyle = '#2a211b';
    ctx.fillRect(1128, 200, 44, 56);
    // Embers of an evening fire, almost out.
    glow(ctx, 330, 890, 160, [255, 120, 50], 0.22 + 0.04 * Math.sin(t * 3));
    ctx.fillStyle = '#3a1b10';
    ctx.beginPath();
    ctx.ellipse(330, 900, 90, 18, 0, 0, Math.PI * 2);
    ctx.fill();
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = `rgba(255,${120 + i * 15},60,${0.5 + 0.3 * Math.sin(t * 4 + i)})`;
      ctx.beginPath();
      ctx.arc(300 + i * 16, 894 + (i % 2) * 5, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    // sleeping family on mats
    const sleepers = [
      { x: 700, y: 920, w: 420, c: PAL.cloth[2], skin: [92, 60, 44], ph: 0 },
      { x: 1150, y: 940, w: 440, c: PAL.cloth[0], skin: [80, 52, 38], ph: 1.3 },
      { x: 1520, y: 900, w: 280, c: PAL.cloth[1], skin: [96, 64, 46], ph: 2.1 },
    ];
    for (const s of sleepers) {
      ctx.fillStyle = '#3a2c1c';
      ctx.fillRect(s.x - s.w / 2 - 40, s.y - 10, s.w + 90, 40);
      ctx.fillStyle = '#4a3924';
      for (let i = 0; i < 8; i++) ctx.fillRect(s.x - s.w / 2 - 40 + i * ((s.w + 90) / 8), s.y - 10, 3, 40);
      const br = Math.sin(t * 1.4 + s.ph) * 3;
      const moon = 0.55;
      // head on pillow
      ctx.fillStyle = '#6b6a78';
      ctx.beginPath();
      ctx.ellipse(s.x - s.w / 2 + 10, s.y - 8, 50, 18, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = rgb(N.scale(s.skin, moon));
      ctx.beginPath();
      ctx.arc(s.x - s.w / 2 + 16, s.y - 38, 32, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = rgb(N.scale([20, 16, 16], 1));
      ctx.beginPath();
      ctx.arc(s.x - s.w / 2 + 6, s.y - 46, 30, Math.PI * 0.9, Math.PI * 1.9);
      ctx.fill();
      // blanket
      const bg2 = ctx.createLinearGradient(0, s.y - 90, 0, s.y + 20);
      bg2.addColorStop(0, rgb(N.scale(s.c, 0.55)));
      bg2.addColorStop(1, rgb(N.scale(s.c, 0.22)));
      ctx.fillStyle = bg2;
      ctx.beginPath();
      ctx.moveTo(s.x - s.w / 2 + 40, s.y + 18);
      ctx.bezierCurveTo(s.x - s.w / 2 + 40, s.y - 70 - br, s.x + s.w * 0.1, s.y - 80 - br, s.x + s.w * 0.25, s.y - 50 - br * 0.6);
      ctx.bezierCurveTo(s.x + s.w * 0.4, s.y - 30, s.x + s.w / 2, s.y - 40, s.x + s.w / 2 + 20, s.y + 18);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = rgb(N.scale(s.c, 0.8), 0.35);
      ctx.lineWidth = 6;
      for (let i = 1; i < 4; i++) {
        const xx = s.x - s.w / 2 + 40 + (s.w * i) / 4;
        ctx.beginPath();
        ctx.moveTo(xx, s.y + 15);
        ctx.lineTo(xx + 10, s.y - 52 - br);
        ctx.stroke();
      }
    }
    // The door on the right; mist creeping under it along the floor.
    ctx.fillStyle = '#1d140e';
    ctx.fillRect(2080, 330, 260, 440);
    ctx.fillStyle = 'rgba(120,140,200,0.25)';
    ctx.fillRect(2080, 764, 260, 6);
    const creep = smooth(44.2, 46.2, t);
    for (let i = 0; i < 16; i++) {
      const k = N.hash(i * 3);
      const x = 2210 - k * 520 * creep + Math.sin(t * 0.6 + i) * 20;
      const y = 770 + N.hash(i * 5) * 60;
      const s = 60 + k * 90;
      ctx.globalAlpha = 0.2 * creep * (1 - k * 0.5);
      ctx.drawImage(softSprite(mistCol, 128), x - s, y - s * 0.25, s * 2, s * 0.5);
    }
    ctx.globalAlpha = 1;
    N.grade(ctx, S, 'rgb(40,60,120)', 0.25, 'soft-light');
  }

  // ----------------------------------------------------------------- aerial
  const AERIAL = (() => {
    const r = rng(404);
    // Valley floor (downhill path of the cloud), in aerial world coords.
    const path = [[300, 260], [620, 420], [900, 520], [1180, 640], [1500, 720], [1820, 860], [2150, 960], [2500, 1120], [2800, 1200]];
    const branch = [[900, 520], [1000, 760], [1060, 1000], [1120, 1250]];
    const villages = [];
    for (const [cx, cy, n] of [[980, 560, 16], [1560, 770, 22], [1060, 900, 12], [2200, 1010, 18]]) {
      const rot = r() * 0.6 - 0.3;
      for (let i = 0; i < n; i++) {
        const a = r() * 6.28, d = Math.sqrt(r()) * 150;
        villages.push({ x: cx + Math.cos(a) * d, y: cy + Math.sin(a) * d * 0.6, hut: r() < 0.65, rot: rot + (r() < 0.5 ? 0 : Math.PI / 2), s: r.range(0.8, 1.1), roof: r() < 0.5 ? PAL.rust : PAL.metal });
      }
    }
    const trees = [];
    for (let i = 0; i < 600; i++) trees.push({ x: r.range(-400, 3200), y: r.range(-200, 1600), s: r.range(12, 30), h: r() });
    const blobs = [];
    for (let i = 0; i < 70; i++) blobs.push({ x: r.range(-400, 3200), y: r.range(-200, 1600), s: r.range(150, 400), dark: r() < 0.5 });
    return { path, branch, villages, trees, blobs };
  })();

  function pathPoint(path, s) {
    const segs = [];
    let total = 0;
    for (let i = 0; i < path.length - 1; i++) {
      const l = Math.hypot(path[i + 1][0] - path[i][0], path[i + 1][1] - path[i][1]);
      segs.push(l);
      total += l;
    }
    let d = clamp(s) * total;
    for (let i = 0; i < segs.length; i++) {
      if (d <= segs[i]) {
        const k = d / segs[i];
        return [lerp(path[i][0], path[i + 1][0], k), lerp(path[i][1], path[i + 1][1], k)];
      }
      d -= segs[i];
    }
    return path[path.length - 1];
  }

  function drawAerial(ctx, t, u, S) {
    const env = makeEnv(0.02);
    const front = 0.28 + u * 0.3;
    const [fx, fy] = pathPoint(AERIAL.path, front - 0.06);
    const cam = { x: fx, y: fy, z: 1.05 - u * 0.1 };
    // Top-down: use a plain transform (no parallax), gently rotating.
    const z = cam.z;
    ctx.setTransform(S, 0, 0, S, 0, 0);
    ctx.translate(W / 2, H / 2);
    ctx.rotate(-0.12 + u * 0.05);
    ctx.scale(z, z);
    ctx.translate(-cam.x, -cam.y);
    ctx.fillStyle = litS(env, PAL.grass, 0.6);
    ctx.fillRect(-1000, -800, 5000, 3200);
    for (const b of AERIAL.blobs) {
      ctx.globalAlpha = 0.35;
      ctx.drawImage(softSprite(b.dark ? lit(env, PAL.grassDark, 0.1) : lit(env, PAL.grassDry, 0.8), 64), b.x - b.s, b.y - b.s, b.s * 2, b.s * 2);
    }
    ctx.globalAlpha = 1;
    // Valley floor stream & road.
    const stroke = (path, w, col) => {
      ctx.strokeStyle = col;
      ctx.lineWidth = w;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(...path[0]);
      for (let i = 1; i < path.length - 1; i++) ctx.quadraticCurveTo(path[i][0], path[i][1], (path[i][0] + path[i + 1][0]) / 2, (path[i][1] + path[i + 1][1]) / 2);
      ctx.lineTo(...path[path.length - 1]);
      ctx.stroke();
    };
    stroke(AERIAL.path, 160, litS(env, PAL.grassDark, 0.2, 0, 0.5));
    stroke(AERIAL.branch, 120, litS(env, PAL.grassDark, 0.2, 0, 0.5));
    stroke(AERIAL.path.map(([x, y]) => [x + 30, y + 40]), 10, litS(env, PAL.path, 0.6));
    stroke(AERIAL.path.map(([x, y]) => [x - 20, y - 10]), 6, litS(env, hex('#3d6a7a'), 1.0));
    // Lake
    const lg = ctx.createRadialGradient(260, 180, 20, 250, 200, 360);
    lg.addColorStop(0, litS(env, hex('#1f5363'), 0.9));
    lg.addColorStop(1, litS(env, hex('#0d2b36'), 0.5));
    ctx.fillStyle = lg;
    ctx.beginPath();
    ctx.ellipse(250, 190, 330, 230, 0.3, 0, Math.PI * 2);
    ctx.fill();
    // Trees (with moon shadows)
    for (const tr of AERIAL.trees) {
      if (Math.hypot(tr.x - 250, tr.y - 190) < 380) continue;
      if (Math.abs(tr.x - cam.x) > 1400 || Math.abs(tr.y - cam.y) > 1000) continue;
      ctx.fillStyle = 'rgba(0,0,10,0.35)';
      ctx.beginPath();
      ctx.arc(tr.x + tr.s * 0.5, tr.y + tr.s * 0.5, tr.s, 0, Math.PI * 2);
      ctx.fill();
      const g = ctx.createRadialGradient(tr.x - tr.s * 0.4, tr.y - tr.s * 0.4, 1, tr.x, tr.y, tr.s);
      g.addColorStop(0, litS(env, tr.h < 0.5 ? PAL.canopy3 : PAL.canopy, 1.0));
      g.addColorStop(1, litS(env, PAL.canopy2, 0.1));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(tr.x, tr.y, tr.s, 0, Math.PI * 2);
      ctx.fill();
    }
    // Roofs
    for (const v of AERIAL.villages) {
      ctx.save();
      ctx.translate(v.x, v.y);
      ctx.fillStyle = 'rgba(0,0,10,0.4)';
      if (v.hut) {
        ctx.beginPath();
        ctx.arc(8, 8, 22 * v.s, 0, Math.PI * 2);
        ctx.fill();
        const g = ctx.createRadialGradient(-6, -6, 1, 0, 0, 22 * v.s);
        g.addColorStop(0, litS(env, PAL.thatch, 1.1));
        g.addColorStop(1, litS(env, PAL.thatch, 0.1));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(0, 0, 22 * v.s, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.rotate(v.rot);
        ctx.fillRect(-26 * v.s + 8, -16 * v.s + 8, 52 * v.s, 32 * v.s);
        ctx.fillStyle = litS(env, v.roof, 0.9);
        ctx.fillRect(-26 * v.s, -16 * v.s, 52 * v.s, 16 * v.s);
        ctx.fillStyle = litS(env, v.roof, 0.35);
        ctx.fillRect(-26 * v.s, 0, 52 * v.s, 16 * v.s);
      }
      ctx.restore();
    }
    // The cloud pours down the valleys like a liquid.
    const col = mix(lit(env, [215, 220, 232], 1.0), [140, 145, 152], 0.7);
    for (let i = 0; i < 340; i++) {
      const onBranch = i % 4 === 0;
      const k = N.hash(i * 7);
      const lim = onBranch ? front * 0.9 : front;
      const s = k * lim;
      const [px, py] = pathPoint(onBranch ? AERIAL.branch : AERIAL.path, onBranch ? s * 1.4 : s);
      const spread = (60 + k * 120) * (onBranch ? 0.8 : 1);
      const ox = (N.hash(i * 11) - 0.5) * spread * 2 + Math.sin(t * 0.4 + i) * 12;
      const oy = (N.hash(i * 13) - 0.5) * spread * 2 + Math.cos(t * 0.35 + i) * 12;
      const size = 90 + N.hash(i * 17) * 120;
      ctx.globalAlpha = 0.1 * (1 - Math.pow(s / Math.max(lim, 0.01), 6) * 0.6);
      ctx.drawImage(softSprite(col, 128, 0.8), px + ox - size, py + oy - size, size * 2, size * 2);
    }
    // lake-top cloud
    ctx.globalAlpha = 0.2;
    ctx.drawImage(softSprite(col, 128, 0.8), 250 - 460, 190 - 360, 920, 720);
    ctx.globalAlpha = 1;
    N.grade(ctx, S, 'rgb(40,60,120)', 0.12, 'soft-light');
  }

  // ---------------------------------------------------------------- diagram
  const DIAG = (() => {
    const r = rng(505);
    const air = [], co2 = [];
    for (let i = 0; i < 260; i++) air.push({ x: r.range(0, 1920), y: r.range(160, 900), ph: r() * 6.28, s: r.range(3, 5) });
    for (let i = 0; i < 220; i++) co2.push({ x0: r.range(0, 2200), y: r.range(0, 1), ph: r() * 6.28, s: r.range(5, 8), sp: r.range(0.8, 1.2) });
    return { air, co2 };
  })();

  function drawDiagram(ctx, t, lt, S) {
    const u = lt / 7;
    screen(ctx, S);
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#0b1426');
    g.addColorStop(1, '#152239');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    // faint grid
    ctx.strokeStyle = 'rgba(160,190,230,0.05)';
    ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 80) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = 0; y < H; y += 80) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    const ground = (x) => 760 + (x / W) * 110 + Math.sin(x * 0.004) * 12;
    // CO2 layer thickness (flows in from the left, settles low).
    const flow = smooth(0, 0.45, u);
    const front = -200 + flow * 2400;
    const thick = (x) => (x > front ? 0 : 170 * smooth(front, front - 500, x) * (0.9 + 0.1 * Math.sin(x * 0.01 + t)));
    // Air particles, pushed up by the CO2.
    for (const p of DIAG.air) {
      const top = ground(p.x) - thick(p.x);
      let y = p.y + Math.sin(t * 0.8 + p.ph) * 6;
      const floor = top - 18;
      if (y > floor) y = floor - (y - floor) * 0.2 - N.hash(p.x) * 60 * (thick(p.x) / 170);
      if (y > ground(p.x) - 10) continue;
      ctx.fillStyle = 'rgba(126,200,255,0.75)';
      ctx.beginPath();
      ctx.arc(p.x + Math.sin(t * 0.5 + p.ph) * 4, y, p.s, 0, Math.PI * 2);
      ctx.fill();
    }
    // CO2 layer body
    ctx.beginPath();
    ctx.moveTo(-10, ground(-10));
    for (let x = -10; x <= W + 10; x += 10) ctx.lineTo(x, ground(x) - thick(x));
    for (let x = W + 10; x >= -10; x -= 10) ctx.lineTo(x, ground(x));
    ctx.closePath();
    const cg = ctx.createLinearGradient(0, 580, 0, 900);
    cg.addColorStop(0, 'rgba(170,176,186,0.28)');
    cg.addColorStop(1, 'rgba(170,176,186,0.62)');
    ctx.fillStyle = cg;
    ctx.fill();
    for (const p of DIAG.co2) {
      const x = ((p.x0 + t * 40 * p.sp) % 2200) - 100;
      if (x > front - 30 || x < -20 || x > W + 20) continue;
      const th = thick(x);
      const y = ground(x) - 12 - p.y * Math.max(0, th - 24) + Math.sin(t + p.ph) * 4;
      ctx.fillStyle = 'rgba(205,208,214,0.85)';
      ctx.beginPath();
      ctx.arc(x, y, p.s, 0, Math.PI * 2);
      ctx.fill();
    }
    // ground and silhouettes
    ctx.fillStyle = '#243016';
    ctx.beginPath();
    ctx.moveTo(-10, ground(-10));
    for (let x = -10; x <= W + 10; x += 10) ctx.lineTo(x, ground(x));
    ctx.lineTo(W + 10, H); ctx.lineTo(-10, H);
    ctx.fill();
    ctx.strokeStyle = '#6f8f4a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let x = -10; x <= W + 10; x += 10) ctx.lineTo(x, ground(x));
    ctx.stroke();
    const sil = '#0c1220';
    ctx.fillStyle = sil;
    for (const hx of [720, 1180, 1500]) {
      const gy = ground(hx);
      ctx.beginPath();
      ctx.moveTo(hx - 50, gy); ctx.lineTo(hx - 50, gy - 60); ctx.lineTo(hx, gy - 110); ctx.lineTo(hx + 50, gy - 60); ctx.lineTo(hx + 50, gy);
      ctx.fill();
    }
    for (const tx of [480, 960, 1700]) {
      const gy = ground(tx);
      ctx.fillRect(tx - 5, gy - 90, 10, 90);
      ctx.beginPath();
      ctx.arc(tx, gy - 120, 50, 0, Math.PI * 2);
      ctx.fill();
    }
    // labels
    const la = smooth(0.25, 0.4, u), lb = smooth(0.45, 0.6, u);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    if (la > 0) {
      ctx.globalAlpha = la;
      ctx.fillStyle = '#e4e6ea';
      ctx.font = '500 36px "Nyos Sans", sans-serif';
      N.subText(ctx, 'CO₂', 300, 560, 36);
      ctx.font = '400 24px "Nyos Sans", sans-serif';
      ctx.fillStyle = 'rgba(228,230,234,0.75)';
      ctx.fillText('about 1.5× heavier than air', 300, 600);
      ctx.strokeStyle = 'rgba(228,230,234,0.6)';
      ctx.lineWidth = 2;
      arrow(ctx, 270, 540, 270, 700 + Math.sin(t * 2) * 4);
      ctx.globalAlpha = 1;
    }
    if (lb > 0) {
      ctx.globalAlpha = lb;
      ctx.fillStyle = '#9fd4ff';
      ctx.font = '500 36px "Nyos Sans", sans-serif';
      ctx.fillText('Oxygen-rich air', 1180, 250);
      ctx.font = '400 24px "Nyos Sans", sans-serif';
      ctx.fillStyle = 'rgba(159,212,255,0.75)';
      ctx.fillText('pushed upward, out of reach', 1180, 290);
      ctx.strokeStyle = 'rgba(159,212,255,0.7)';
      ctx.lineWidth = 2;
      arrow(ctx, 1150, 430 - Math.sin(t * 2) * 4, 1150, 240);
      ctx.globalAlpha = 1;
    }
  }

  function arrow(ctx, x0, y0, x1, y1) {
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    const a = Math.atan2(y1 - y0, x1 - x0);
    ctx.moveTo(x1, y1);
    ctx.lineTo(x1 - Math.cos(a - 0.45) * 16, y1 - Math.sin(a - 0.45) * 16);
    ctx.moveTo(x1, y1);
    ctx.lineTo(x1 - Math.cos(a + 0.45) * 16, y1 - Math.sin(a + 0.45) * 16);
    ctx.stroke();
  }

  Object.assign(N, { drawStreet, drawCloseTree, drawCloseDoor, drawCloseYard, drawLakeSurface, drawInterior, drawAerial, drawDiagram, sunRays, dust, shakeOf });
})();
