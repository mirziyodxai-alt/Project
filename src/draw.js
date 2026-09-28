/* Drawing primitives: camera layers, sky, terrain, houses, trees, grass. */
(function () {
  const N = window.NYOS;
  const { hex, rgb, lit, litS, faceK, clamp, lerp, noise, rng, softSprite, mix } = N;

  const W = 1920, H = 1080;
  const PAL = {
    grass: hex('#6f9440'), grassDark: hex('#47702f'), grassDry: hex('#9a9a52'),
    soil: hex('#a5663c'), path: hex('#b77c4c'),
    mud: hex('#b9845a'), plaster: hex('#cdb58e'), paintBlue: hex('#8fa9b3'), paintOchre: hex('#d0a060'),
    thatch: hex('#cfa65b'), metal: hex('#a2a7ab'), rust: hex('#a0664a'),
    canopy: hex('#3f7f36'), canopy2: hex('#2f6c31'), canopy3: hex('#5b8a3a'), trunk: hex('#5b3d29'),
    rock: hex('#80776c'), wood: hex('#7a5436'), cloth: [hex('#c0392b'), hex('#e1b12c'), hex('#2d7fb8'), hex('#8e44ad'), hex('#e67e22')],
    warm: hex('#ffb35a'),
  };

  // --- camera ------------------------------------------------------------
  // cam = {x, y, z, sx, sy}; S = device scale (canvas px per logical px).
  // Parallax layer p: 0 = infinitely far, 1 = main plane, >1 = foreground.
  const REF_X = 1550, REF_Y = 540;
  function setLayer(ctx, cam, p, S) {
    const z = Math.max(0.05, 1 + (cam.z - 1) * p);
    const cx = REF_X + (cam.x - REF_X) * p;
    const cy = REF_Y + (cam.y - REF_Y) * p;
    const sx = (cam.sx || 0) * p, sy = (cam.sy || 0) * p;
    ctx.setTransform(S * z, 0, 0, S * z, S * (W / 2 - cx * z + sx), S * (H / 2 - cy * z + sy));
    return { z, cx, cy };
  }
  // Visible world-x range for a layer (with margin).
  function layerSpan(cam, p, m = 80) {
    const z = Math.max(0.05, 1 + (cam.z - 1) * p);
    const cx = REF_X + (cam.x - REF_X) * p;
    return [cx - W / 2 / z - m, cx + W / 2 / z + m];
  }
  function screen(ctx, S) {
    ctx.setTransform(S, 0, 0, S, 0, 0);
  }

  // --- sky ---------------------------------------------------------------
  const STARS = (() => {
    const r = rng(7);
    const out = [];
    for (let i = 0; i < 320; i++) out.push({ x: r() * 2200 - 140, y: r() * 700, s: Math.pow(r(), 3) * 1.8 + 0.4, ph: r() * 6.28, f: r() * 2 + 0.5 });
    return out;
  })();

  function drawSky(ctx, env, t, cam, S, opts = {}) {
    screen(ctx, S);
    const hy = opts.horizon || 600;
    const g = ctx.createLinearGradient(0, 0, 0, hy);
    g.addColorStop(0, rgb(env.skyTop));
    g.addColorStop(0.55, rgb(env.skyMid));
    g.addColorStop(1, rgb(env.skyBot));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    const px = -((cam.x || REF_X) - REF_X) * 0.04;
    const py = -((cam.y || REF_Y) - REF_Y) * 0.04;

    if (env.stars > 0.01) {
      for (const s of STARS) {
        const tw = 0.65 + 0.35 * Math.sin(t * s.f + s.ph);
        const yy = s.y + py;
        const fade = clamp(1 - yy / hy);
        ctx.fillStyle = `rgba(235,240,255,${(env.stars * tw * fade * 0.9).toFixed(3)})`;
        ctx.fillRect(s.x + px, yy, s.s, s.s);
      }
    }
    const out = {};
    if (env.moon > 0.01) {
      const mx = (opts.moonX || 380) + px, my = (opts.moonY || 170) + py;
      ctx.globalAlpha = env.moon;
      ctx.drawImage(softSprite([150, 170, 220], 256), mx - 260, my - 260, 520, 520);
      ctx.drawImage(softSprite([220, 225, 240], 128), mx - 90, my - 90, 180, 180);
      const mg = ctx.createRadialGradient(mx - 8, my - 8, 4, mx, my, 34);
      mg.addColorStop(0, '#fffbef');
      mg.addColorStop(1, '#d9d6cc');
      ctx.fillStyle = mg;
      ctx.beginPath();
      ctx.arc(mx, my, 34, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(160,160,170,0.25)';
      for (const [dx, dy, r] of [[-10, -6, 7], [9, 8, 9], [12, -12, 4], [-6, 14, 5]]) {
        ctx.beginPath();
        ctx.arc(mx + dx, my + dy, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      out.moon = [mx, my];
    }
    if (env.sun > 0.01) {
      const sx = (opts.sunX || 1500) + px;
      const sy = hy + 30 - env.sunElev * 330 + py;
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = env.sun * 0.55;
      ctx.drawImage(softSprite(env.glow, 256), sx - 900, sy - 520, 1800, 1040);
      ctx.globalAlpha = env.sun * 0.9;
      ctx.drawImage(softSprite([255, 220, 170], 128), sx - 150, sy - 150, 300, 300);
      ctx.globalAlpha = env.sun;
      ctx.fillStyle = '#fff4dc';
      ctx.beginPath();
      ctx.arc(sx, sy, 30, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      out.sun = [sx, sy];
    }
    return out;
  }

  // Soft horizontal cloud streaks.
  function drawCloudBank(ctx, env, t, S, y, seed, alpha) {
    screen(ctx, S);
    const r = rng(seed);
    const c = mix(env.skyMid, env.glow, 0.35 * env.sun);
    for (let i = 0; i < 14; i++) {
      const x = ((r() * 2400 + t * (6 + r() * 6)) % 2400) - 240;
      const w = 300 + r() * 500, h = 18 + r() * 30;
      ctx.globalAlpha = alpha * (0.3 + r() * 0.5);
      ctx.drawImage(softSprite(c, 128), x - w / 2, y + r() * 120 - h / 2, w, h);
    }
    ctx.globalAlpha = 1;
  }

  // --- terrain -----------------------------------------------------------
  function ridgePath(ctx, fn, x0, x1, bottom, step = 8) {
    ctx.beginPath();
    ctx.moveTo(x0, bottom);
    for (let x = x0; x <= x1 + step; x += step) ctx.lineTo(x, fn(x));
    ctx.lineTo(x1 + step, bottom);
    ctx.closePath();
  }
  function fillRidge(ctx, env, fn, x0, x1, top, bottom, albedo, fog, fogBottom = fog, k = 0.45) {
    ridgePath(ctx, fn, x0, x1, bottom);
    const g = ctx.createLinearGradient(0, top, 0, bottom);
    g.addColorStop(0, litS(env, albedo, k + 0.15, fog));
    g.addColorStop(1, litS(env, albedo, k - 0.15, fogBottom));
    ctx.fillStyle = g;
    ctx.fill();
  }

  // --- shadows & glows ---------------------------------------------------
  function contactShadow(ctx, x, y, rx, ry, a = 0.35) {
    ctx.fillStyle = `rgba(8,10,18,${a})`;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  function castShadow(ctx, env, x, y, w, h) {
    const s = env.sun * clamp(Math.abs(env.keyDir));
    if (s < 0.05) return;
    const dir = -Math.sign(env.keyDir) || 1;
    const len = h * (2.8 - env.sunElev * 1.6);
    ctx.fillStyle = `rgba(20,16,40,${(0.28 * s).toFixed(3)})`;
    ctx.beginPath();
    ctx.moveTo(x - w / 2, y);
    ctx.lineTo(x + w / 2, y);
    ctx.lineTo(x + w / 2 + dir * len, y + h * 0.18);
    ctx.lineTo(x - w / 2 + dir * len, y + h * 0.18);
    ctx.closePath();
    ctx.fill();
  }
  function glow(ctx, x, y, r, color, a) {
    if (a <= 0.01) return;
    const op = ctx.globalCompositeOperation;
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = clamp(a);
    ctx.drawImage(softSprite(color, 128), x - r, y - r, r * 2, r * 2);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = op;
  }
  const warmWin = (a) => rgb(mix([40, 30, 30], [255, 196, 110], a));

  // --- houses ------------------------------------------------------------
  function hGrad(ctx, env, albedo, x0, x1, fog, bias = 0) {
    const g = ctx.createLinearGradient(x0, 0, x1, 0);
    g.addColorStop(0, litS(env, albedo, faceK(env, -1) + bias, fog));
    g.addColorStop(0.45, litS(env, albedo, faceK(env, -0.1) + bias, fog));
    g.addColorStop(1, litS(env, albedo, faceK(env, 1) * 0.9 + bias - 0.1, fog));
    return g;
  }

  function drawHut(ctx, env, h) {
    const { x, y, s } = h;
    const fog = h.fog || 0;
    const w = 64 * s, hw = 42 * s, ery = w * 0.13;
    castShadow(ctx, env, x, y, w, hw + 50 * s);
    contactShadow(ctx, x, y + 2 * s, w * 0.62, ery * 1.1, 0.35);
    // wall
    ctx.fillStyle = hGrad(ctx, env, h.wall || PAL.mud, x - w / 2, x + w / 2, fog);
    ctx.beginPath();
    ctx.moveTo(x - w / 2, y - hw);
    ctx.lineTo(x - w / 2, y);
    ctx.ellipse(x, y, w / 2, ery, 0, Math.PI, 0, true);
    ctx.lineTo(x + w / 2, y - hw);
    ctx.closePath();
    ctx.fill();
    // door
    const dx = x - w * 0.12, dw = 13 * s, dh = 26 * s;
    ctx.fillStyle = h.win > 0.02 ? warmWin(h.win) : litS(env, [40, 28, 20], 0.2, fog);
    ctx.beginPath();
    ctx.moveTo(dx - dw / 2, y + ery * 0.6);
    ctx.lineTo(dx - dw / 2, y - dh + dw / 2);
    ctx.arc(dx, y - dh + dw / 2, dw / 2, Math.PI, 0);
    ctx.lineTo(dx + dw / 2, y + ery * 0.6);
    ctx.fill();
    // roof cone
    const ry = y - hw + 3 * s, rx = w / 2 + 11 * s, apex = ry - 56 * s;
    ctx.fillStyle = hGrad(ctx, env, h.roof || PAL.thatch, x - rx, x + rx, fog, 0.12);
    ctx.beginPath();
    ctx.moveTo(x - rx, ry);
    ctx.quadraticCurveTo(x - rx * 0.35, ry - 30 * s, x, apex);
    ctx.quadraticCurveTo(x + rx * 0.35, ry - 30 * s, x + rx, ry);
    ctx.ellipse(x, ry, rx, 9 * s, 0, 0, Math.PI);
    ctx.closePath();
    ctx.fill();
    if (s > 0.35) {
      ctx.strokeStyle = litS(env, PAL.thatch, 0.05, fog, 0.35);
      ctx.lineWidth = Math.max(0.6, 1.1 * s);
      ctx.beginPath();
      for (let i = 1; i < 9; i++) {
        const u = i / 9;
        const bx = x - rx + u * rx * 2;
        ctx.moveTo(x + (bx - x) * 0.1, apex + 6 * s);
        ctx.lineTo(bx, ry + Math.sin(u * Math.PI) * 8 * s);
      }
      ctx.stroke();
      ctx.strokeStyle = litS(env, PAL.thatch, 0, fog, 0.6);
      ctx.lineWidth = 2 * s;
      ctx.beginPath();
      ctx.ellipse(x, ry, rx, 9 * s, 0, 0.1, Math.PI - 0.1);
      ctx.stroke();
    }
    if (h.win > 0.02) glow(ctx, dx, y - dh * 0.4, 60 * s, [255, 170, 80], h.win * 0.55);
  }

  function drawBox(ctx, env, h) {
    const { x, y, s } = h;
    const fog = h.fog || 0;
    const w = 90 * s, hg = 50 * s, dx = 34 * s, dy = -18 * s, rh = 26 * s;
    const wall = h.wall || PAL.plaster, roof = h.roof || PAL.metal;
    castShadow(ctx, env, x + dx / 2, y, w + dx, hg + rh);
    contactShadow(ctx, x + dx / 2, y + 1, (w + dx) * 0.6, 8 * s, 0.35);
    const L = x - w / 2, R = x + w / 2, T = y - hg;
    // front wall
    ctx.fillStyle = litS(env, wall, faceK(env, 0, 0.4), fog);
    ctx.fillRect(L, T, w, hg);
    // side wall + gable
    ctx.fillStyle = litS(env, wall, faceK(env, 1, 0.2), fog);
    ctx.beginPath();
    ctx.moveTo(R, y);
    ctx.lineTo(R, T);
    ctx.lineTo(R + dx / 2, T + dy / 2 - rh);
    ctx.lineTo(R + dx, T + dy);
    ctx.lineTo(R + dx, y + dy);
    ctx.closePath();
    ctx.fill();
    // bottom band (plinth)
    ctx.fillStyle = litS(env, PAL.soil, 0.25, fog, 0.8);
    ctx.fillRect(L, y - 6 * s, w, 6 * s);
    // roof
    const o = 7 * s;
    const p0 = [L - o, T + 3 * s], p1 = [R + o * 0.4, T + 3 * s];
    const p2 = [R + dx / 2 + o * 0.4, T + dy / 2 - rh], p3 = [L + dx / 2 - o, T + dy / 2 - rh];
    const rg = ctx.createLinearGradient(0, p2[1], 0, p0[1]);
    rg.addColorStop(0, litS(env, roof, 0.85, fog));
    rg.addColorStop(1, litS(env, roof, 0.45, fog));
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.moveTo(...p0); ctx.lineTo(...p1); ctx.lineTo(...p2); ctx.lineTo(...p3);
    ctx.closePath();
    ctx.fill();
    if (s > 0.3) {
      ctx.strokeStyle = litS(env, roof, 0.1, fog, 0.4);
      ctx.lineWidth = Math.max(0.5, s);
      ctx.beginPath();
      for (let i = 1; i < 12; i++) {
        const u = i / 12;
        ctx.moveTo(lerp(p0[0], p1[0], u), p0[1]);
        ctx.lineTo(lerp(p3[0], p2[0], u), p3[1]);
      }
      ctx.stroke();
    }
    // back roof slope peeking over ridge
    ctx.fillStyle = litS(env, roof, 0.25, fog);
    ctx.beginPath();
    ctx.moveTo(...p3); ctx.lineTo(...p2);
    ctx.lineTo(R + dx + o * 0.3, T + dy - 1 * s);
    ctx.lineTo(p2[0] - 2 * s, p2[1] + 1 * s);
    ctx.closePath();
    ctx.fill();
    // door + windows
    ctx.fillStyle = litS(env, PAL.wood, 0.3, fog);
    ctx.fillRect(x + w * 0.12, y - 34 * s, 16 * s, 34 * s);
    const wy = T + hg * 0.28, ws = 13 * s;
    for (const wx of [x - w * 0.32, x - w * 0.05]) {
      ctx.fillStyle = h.win > 0.02 ? warmWin(h.win) : litS(env, [30, 26, 24], 0.2, fog);
      ctx.fillRect(wx, wy, ws, ws);
      ctx.strokeStyle = litS(env, PAL.wood, 0.3, fog);
      ctx.lineWidth = Math.max(0.6, 1.5 * s);
      ctx.strokeRect(wx, wy, ws, ws);
      if (h.win > 0.02) glow(ctx, wx + ws / 2, wy + ws / 2, 55 * s, [255, 170, 80], h.win * 0.5);
    }
  }

  // --- trees -------------------------------------------------------------
  function makeTree(r, x, y, s, type) {
    const blobs = [];
    const n = type === 'round' ? 6 : 0;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + r() * 0.6;
      blobs.push([Math.cos(a) * (18 + r() * 12), Math.sin(a) * (12 + r() * 8) - 6, 20 + r() * 12]);
    }
    blobs.push([0, -14, 26]);
    const fronds = [];
    for (let i = 0; i < 8; i++) fronds.push([(i / 8) * Math.PI * 2 + r() * 0.4, 34 + r() * 14]);
    return { x, y, s, type, blobs, fronds, seed: r() * 100, lean: (r() - 0.5) * 0.25, hue: r() };
  }

  function sway(t, tr, wind) {
    return wind * (0.035 * Math.sin(t * 1.3 + tr.seed) + 0.03 * noise(t * 0.9 + tr.seed * 3));
  }

  function drawTree(ctx, env, tr, t, wind = 0.3) {
    const { x, y, s } = tr;
    const fog = tr.fog || 0;
    const a = sway(t, tr, wind);
    castShadow(ctx, env, x, y, 40 * s, 90 * s);
    contactShadow(ctx, x, y + 1, 26 * s, 6 * s, 0.3);
    if (tr.type === 'palm') {
      const tx = x + tr.lean * 120 * s + a * 60 * s, ty = y - 120 * s;
      ctx.strokeStyle = litS(env, PAL.trunk, 0.4, fog);
      ctx.lineCap = 'round';
      ctx.lineWidth = 7 * s;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + tr.lean * 20 * s, y - 70 * s, tx, ty);
      ctx.stroke();
      for (let i = 0; i < tr.fronds.length; i++) {
        const [ang, len] = tr.fronds[i];
        const sw = a * 1.8 + Math.sin(t * 2.1 + i) * wind * 0.05;
        const ex = tx + Math.cos(ang + sw) * len * 1.5 * s;
        const ey = ty + Math.sin(ang) * len * 0.45 * s + len * 0.55 * s;
        const mx = tx + Math.cos(ang + sw) * len * 0.8 * s;
        const my = ty - 14 * s + Math.sin(ang) * len * 0.2 * s;
        const k = Math.cos(ang) * env.keyDir > 0 ? 0.8 : 0.35;
        ctx.strokeStyle = litS(env, i % 2 ? PAL.canopy : PAL.canopy3, k, fog);
        ctx.lineWidth = 6 * s;
        ctx.beginPath();
        ctx.moveTo(tx, ty);
        ctx.quadraticCurveTo(mx, my, ex, ey);
        ctx.stroke();
      }
      ctx.lineCap = 'butt';
      return;
    }
    // round broadleaf tree
    ctx.fillStyle = litS(env, PAL.trunk, 0.35, fog);
    ctx.beginPath();
    ctx.moveTo(x - 5 * s, y);
    ctx.lineTo(x - 2.5 * s, y - 58 * s);
    ctx.lineTo(x + 2.5 * s, y - 58 * s);
    ctx.lineTo(x + 5 * s, y);
    ctx.fill();
    ctx.save();
    ctx.translate(x, y - 58 * s);
    ctx.rotate(a);
    ctx.translate(0, -20 * s);
    const base = tr.hue < 0.5 ? PAL.canopy : tr.hue < 0.8 ? PAL.canopy2 : PAL.canopy3;
    const lx = env.keyDir * 0.45;
    for (const [bx, by, br] of tr.blobs) {
      const cx = bx * s, cy = by * s, r = br * s;
      const g = ctx.createRadialGradient(cx + lx * r, cy - r * 0.45, r * 0.1, cx, cy, r * 1.05);
      g.addColorStop(0, litS(env, base, 1.0, fog));
      g.addColorStop(0.6, litS(env, base, 0.45, fog));
      g.addColorStop(1, litS(env, base, 0.08, fog));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // --- grass -------------------------------------------------------------
  function drawGrassTufts(ctx, env, x0, x1, yFn, seed, t, wind, s = 1, fog = 0, density = 0.12) {
    const r = rng(seed);
    const n = Math.floor((x1 - x0) * density);
    ctx.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      const x = x0 + r() * (x1 - x0);
      const y = yFn(x) + r() * 6;
      const h = (8 + r() * 14) * s;
      const k = 0.2 + r() * 0.7;
      const bend = wind * (Math.sin(t * 1.7 + x * 0.05) * 0.5 + noise(t + x * 0.01)) * 6 * s;
      ctx.strokeStyle = litS(env, r() < 0.6 ? PAL.grassDark : PAL.grassDry, k, fog);
      ctx.lineWidth = 1.6 * s;
      ctx.beginPath();
      for (let b = -1; b <= 1; b++) {
        ctx.moveTo(x + b * 2 * s, y);
        ctx.quadraticCurveTo(x + b * 3 * s, y - h * 0.6, x + b * 5 * s + bend, y - h);
      }
      ctx.stroke();
    }
    ctx.lineCap = 'butt';
  }

  Object.assign(N, {
    W, H, PAL, REF_X, REF_Y, setLayer, layerSpan, screen, drawSky, drawCloudBank,
    ridgePath, fillRidge, contactShadow, castShadow, glow, warmWin,
    drawHut, drawBox, makeTree, drawTree, drawGrassTufts, sway,
  });
})();
