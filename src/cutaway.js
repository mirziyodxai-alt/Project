/* Cross-section beneath Lake Nyos: layered water, trapped CO2, and the limnic eruption. */
(function () {
  const N = window.NYOS;
  const { W, H, rng, rgb, mix, hex, clamp, lerp, smooth, easeInOut, easeOut, noise, fbm, softSprite } = N;

  const SURF = 330, CX = 960, HALF = 560, DEPTH = 560;
  const bottom = (x) => {
    const u = clamp(1 - ((x - CX) / HALF) ** 2);
    return SURF + DEPTH * Math.pow(u, 0.75) + fbm(x * 0.01) * 10 * u;
  };
  // Land surface outside and around the crater.
  const terrain = (x) => {
    if (x < CX - HALF) return lerp(430, 292, smooth(0, CX - HALF - 70, x)) + fbm(x * 0.01) * 10;
    if (x > CX + HALF) return lerp(300, 520, smooth(CX + HALF + 70, W + 200, x)) + fbm(x * 0.01 + 3) * 10;
    return SURF;
  };
  const rimL = CX - HALF, rimR = CX + HALF;

  const DATA = (() => {
    const r = rng(2208);
    const pockets = [];
    for (let i = 0; i < 7; i++) {
      const x = CX + (i - 3) * 82 + r.range(-20, 20);
      pockets.push({ x, w: r.range(90, 150), h: r.range(26, 44), ph: r() * 6.28 });
    }
    const dissolved = [];
    for (let i = 0; i < 420; i++) {
      const x = r.range(rimL + 40, rimR - 40);
      const y = r.range(640, bottom(x) - 6);
      if (y < 640) continue;
      dissolved.push({ x, y, s: r.range(1, 2.4), ph: r() * 6.28 });
    }
    const cracks = [];
    for (let i = 0; i < 5; i++) {
      const pts = [];
      let x = CX + (i - 2) * 150 + r.range(-40, 40), y = 1180;
      const tx = CX + (i - 2) * 110;
      while (y > bottom(tx) + 4) {
        pts.push([x, y]);
        y -= r.range(30, 60);
        x += (tx - x) * 0.2 + r.range(-20, 20);
      }
      pts.push([tx, bottom(tx) + 2]);
      cracks.push(pts);
    }
    const rocks = [];
    for (let i = 0; i < 11; i++) rocks.push({ d: r.range(0, 0.35), s: r.range(14, 34), sp: r.range(0.8, 1.2), off: r.range(-20, 20), rot: r() * 6, sides: 5 + Math.floor(r() * 3) });
    const strata = [];
    for (let i = 0; i < 9; i++) strata.push({ y: 420 + i * 90 + r.range(-20, 20), c: r.pick(['#3a2a20', '#46342a', '#2e241e', '#4d3a2c']), a: r.range(6, 22) });
    return { pockets, dissolved, cracks, rocks, strata };
  })();

  function camFor(lt) {
    // lt is seconds since 0:22 (calm: 0..9, erupt: 9..13).
    if (lt < 9) {
      const a = easeInOut(clamp(lt / 3.6));
      const b = easeInOut(clamp((lt - 3.6) / 5.4));
      return { x: CX, y: lerp(360, 640, a) + b * 40, z: lerp(2.3, 0.95, a) * (1 + b * 0.08) };
    }
    const e = lt - 9;
    const k = easeOut(clamp(e / 4));
    const sh = smooth(1.2, 1.8, e) * (1 - smooth(3.2, 4, e) * 0.5) * 9;
    return { x: CX + lerp(0, 60, k), y: lerp(680, 600, k), z: lerp(1.026, 0.95, k), sx: noise(e * 11) * sh, sy: noise(e * 11 + 5) * sh };
  }

  function drawCutaway(ctx, t, lt, S, mode) {
    const e = mode === 'erupt' ? lt - 9 : -1; // seconds into the eruption
    const cam = camFor(lt);
    ctx.setTransform(S * cam.z, 0, 0, S * cam.z, S * (W / 2 - cam.x * cam.z + (cam.sx || 0)), S * (H / 2 - cam.y * cam.z + (cam.sy || 0)));

    // Sky
    let g = ctx.createLinearGradient(0, -400, 0, 520);
    g.addColorStop(0, '#040814');
    g.addColorStop(1, '#16264a');
    ctx.fillStyle = g;
    ctx.fillRect(-800, -600, W + 1600, 1300);
    const r = rng(3);
    for (let i = 0; i < 120; i++) {
      ctx.fillStyle = `rgba(230,236,255,${(0.3 + r() * 0.6).toFixed(2)})`;
      ctx.fillRect(r() * 3200 - 600, r() * 700 - 500, 1.6, 1.6);
    }
    // Distant hills
    ctx.fillStyle = '#101c2c';
    ctx.beginPath();
    ctx.moveTo(-800, 520);
    for (let x = -800; x < W + 800; x += 20) ctx.lineTo(x, 250 + fbm(x * 0.004 + 1) * 60);
    ctx.lineTo(W + 800, 520);
    ctx.fill();

    // Rock body
    ctx.beginPath();
    ctx.moveTo(-800, terrain(-800));
    for (let x = -800; x <= W + 800; x += 10) ctx.lineTo(x, x > rimL && x < rimR ? bottom(x) : terrain(x));
    ctx.lineTo(W + 800, 1500);
    ctx.lineTo(-800, 1500);
    ctx.closePath();
    g = ctx.createLinearGradient(0, 300, 0, 1300);
    g.addColorStop(0, '#4a3a2c');
    g.addColorStop(0.5, '#302219');
    g.addColorStop(1, '#1a100c');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.save();
    ctx.clip();
    for (const s of DATA.strata) {
      ctx.fillStyle = s.c;
      ctx.globalAlpha = 0.55;
      ctx.beginPath();
      ctx.moveTo(-800, s.y);
      for (let x = -800; x <= W + 800; x += 20) ctx.lineTo(x, s.y + Math.sin(x * 0.004 + s.a) * s.a);
      for (let x = W + 800; x >= -800; x -= 20) ctx.lineTo(x, s.y + 26 + Math.sin(x * 0.005 + s.a) * s.a);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    // Magma far below, glowing, and cracks leaking gas upward.
    const mg = ctx.createRadialGradient(CX, 1260, 20, CX, 1260, 520);
    mg.addColorStop(0, 'rgba(255,170,70,0.95)');
    mg.addColorStop(0.3, 'rgba(220,70,30,0.6)');
    mg.addColorStop(1, 'rgba(120,20,10,0)');
    ctx.fillStyle = mg;
    ctx.fillRect(CX - 700, 800, 1400, 700);
    for (const pts of DATA.cracks) {
      ctx.strokeStyle = 'rgba(255,120,50,0.45)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.stroke();
      ctx.strokeStyle = 'rgba(20,10,8,0.9)';
      ctx.lineWidth = 2;
      ctx.stroke();
      // seeping gas along the crack
      for (let k = 0; k < 6; k++) {
        const u = ((t * 0.12 + k / 6 + pts.length * 0.13) % 1);
        const idx = (1 - u) * (pts.length - 1);
        const i0 = Math.floor(idx), f = idx - i0;
        const p0 = pts[i0], p1 = pts[Math.min(i0 + 1, pts.length - 1)];
        const x = lerp(p0[0], p1[0], f), y = lerp(p0[1], p1[1], f);
        ctx.fillStyle = `rgba(220,230,240,${(0.5 * Math.sin(u * Math.PI)).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
    // Grass on the surface + tree and hut silhouettes (village downhill on the right).
    ctx.strokeStyle = '#3f6a33';
    ctx.lineWidth = 8;
    ctx.beginPath();
    for (let x = -800; x <= rimL + 2; x += 10) ctx.lineTo(x, terrain(x));
    ctx.stroke();
    ctx.beginPath();
    for (let x = rimR - 2; x <= W + 800; x += 10) ctx.lineTo(x, terrain(x));
    ctx.stroke();
    ctx.fillStyle = '#0d1a14';
    for (const tx of [120, 260, 1620, 1700, 2250, 2400]) {
      const y = terrain(tx);
      ctx.fillRect(tx - 3, y - 30, 6, 30);
      ctx.beginPath();
      ctx.arc(tx, y - 40, 20, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const hx of [1880, 1990, 2120]) {
      const y = terrain(hx);
      ctx.beginPath();
      ctx.moveTo(hx - 22, y + 2); ctx.lineTo(hx - 22, y - 20); ctx.lineTo(hx, y - 44); ctx.lineTo(hx + 22, y - 20); ctx.lineTo(hx + 22, y + 2);
      ctx.fill();
    }

    // ---- water ----
    const churn = e < 0 ? 0 : smooth(1.4, 3.6, e);
    const dome = e < 0 ? 0 : smooth(2.4, 4, e);
    const surfY = (x) => SURF - dome * 80 * Math.exp(-(((x - CX) / 260) ** 2)) + (e > 0 ? Math.sin(x * 0.03 - e * 6) * 4 * smooth(0.5, 1.5, e) : 0);
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(rimL - 10, surfY(rimL - 10));
    for (let x = rimL - 10; x <= rimR + 10; x += 8) ctx.lineTo(x, surfY(x));
    for (let x = rimR + 10; x >= rimL - 10; x -= 8) ctx.lineTo(x, Math.max(bottom(x), surfY(x)));
    ctx.closePath();
    ctx.clip();
    const topC = hex('#2c7c89'), midC = hex('#185061'), botC = hex('#0a2433'), murk = hex('#27505a');
    g = ctx.createLinearGradient(0, SURF - 90, 0, SURF + DEPTH);
    g.addColorStop(0, rgb(mix(topC, murk, churn * 0.6)));
    g.addColorStop(0.18, rgb(mix(topC, murk, churn * 0.6)));
    g.addColorStop(0.2, rgb(mix(midC, murk, churn * 0.7)));
    g.addColorStop(0.55, rgb(mix(midC, murk, churn * 0.7)));
    g.addColorStop(0.58, rgb(mix(botC, murk, churn * 0.8)));
    g.addColorStop(1, rgb(mix(botC, murk, churn * 0.8)));
    ctx.fillStyle = g;
    ctx.fillRect(rimL - 20, SURF - 120, HALF * 2 + 40, DEPTH + 140);
    // Layer boundaries (warm surface water / cold dense water / CO2-rich bottom).
    const wob = e > 0 ? smooth(0.6, 2.0, e) : 0;
    for (const [ly, a] of [[SURF + DEPTH * 0.19, 0.22], [SURF + DEPTH * 0.565, 0.28]]) {
      ctx.strokeStyle = `rgba(160,220,230,${(a * (1 - churn)).toFixed(3)})`;
      ctx.lineWidth = 2;
      ctx.setLineDash([10, 10]);
      ctx.beginPath();
      for (let x = rimL; x <= rimR; x += 10) ctx.lineTo(x, ly + Math.sin(x * 0.02 + t * 0.6) * 3 + Math.sin(x * 0.01 - (e > 0 ? e : 0) * 5) * 28 * wob);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    // Light rays from the surface.
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 7; i++) {
      const x = rimL + 120 + i * 150 + Math.sin(t * 0.3 + i) * 20;
      const lg = ctx.createLinearGradient(0, SURF, 0, SURF + 380);
      lg.addColorStop(0, 'rgba(120,200,210,0.10)');
      lg.addColorStop(1, 'rgba(120,200,210,0)');
      ctx.fillStyle = lg;
      ctx.beginPath();
      ctx.moveTo(x, SURF); ctx.lineTo(x + 50, SURF); ctx.lineTo(x + 10, SURF + 380); ctx.lineTo(x - 70, SURF + 380);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
    // Dissolved CO2 (tiny specks), then the trapped pockets on the floor.
    const release = e < 0 ? 0 : smooth(1.4, 2.6, e);
    for (const d of DATA.dissolved) {
      const tw = 0.5 + 0.5 * Math.sin(t * 1.5 + d.ph);
      const rise = release * (e - 1.4) * 140 * (0.5 + (d.ph % 1));
      ctx.fillStyle = `rgba(215,240,245,${(0.25 * tw * (1 - release * 0.6)).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(d.x + (CX - d.x) * release * 0.3, d.y - Math.max(0, rise), d.s, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const p of DATA.pockets) {
      const by = bottom(p.x) - 4;
      const pulse = 1 + 0.06 * Math.sin(t * 1.3 + p.ph) + (e > 0 ? 0.25 * smooth(0.8, 1.6, e) * Math.sin(e * 20 + p.ph) : 0);
      const gone = 1 - release;
      if (gone <= 0.01) continue;
      const w = p.w * pulse, h = p.h * pulse;
      ctx.save();
      ctx.globalAlpha = gone;
      const pg = ctx.createRadialGradient(p.x, by - h * 0.4, 2, p.x, by - h * 0.2, w);
      pg.addColorStop(0, 'rgba(210,235,240,0.30)');
      pg.addColorStop(0.7, 'rgba(190,225,235,0.14)');
      pg.addColorStop(1, 'rgba(190,225,235,0)');
      ctx.fillStyle = pg;
      ctx.beginPath();
      ctx.ellipse(p.x, by - h * 0.35, w, h, 0, Math.PI, 0);
      ctx.lineTo(p.x + w, by);
      ctx.lineTo(p.x - w, by);
      ctx.fill();
      ctx.strokeStyle = 'rgba(220,245,250,0.45)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(p.x, by - h * 0.35, w * 0.92, h * 0.9, 0, Math.PI * 1.1, Math.PI * 1.9);
      ctx.stroke();
      ctx.restore();
    }
    // Small bubbles slowly rising (calm), then the eruption column.
    const nCalm = 34;
    for (let i = 0; i < nCalm; i++) {
      const p = DATA.pockets[i % DATA.pockets.length];
      const per = 3.5 + N.hash(i) * 3;
      const u = ((t + N.hash(i * 3) * per) % per) / per;
      const x0 = p.x + (N.hash(i * 5) - 0.5) * p.w;
      const y0 = bottom(x0) - p.h * 0.6;
      const y = lerp(y0, SURF + DEPTH * 0.2, u);
      const x = x0 + Math.sin(u * 12 + i) * 6;
      const rr = 2 + u * 3;
      ctx.strokeStyle = `rgba(220,245,250,${(0.55 * Math.sin(u * Math.PI) * (1 - churn)).toFixed(3)})`;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(x, y, rr, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (e > 1.2) {
      const k = smooth(1.2, 3.2, e);
      for (let i = 0; i < 260; i++) {
        const spd = 0.35 + N.hash(i * 7) * 0.5;
        const u = ((e - 1.2) * spd * 0.55 + N.hash(i) * 1.2) % 1.2;
        if (u > 1) continue;
        const startX = CX + (N.hash(i * 11) - 0.5) * 700 * (1 - k * 0.3);
        const y0 = bottom(startX) - 10;
        const y = lerp(y0, SURF - dome * 70, easeOut(u));
        const spread = (N.hash(i * 13) - 0.5) * (80 + u * 260 * k);
        const x = lerp(startX, CX + spread, smooth(0, 0.6, u)) + Math.sin(u * 14 + i) * 8;
        const rr = (3 + u * 18 * (0.5 + N.hash(i * 17))) * (0.6 + k * 0.6);
        const a = smooth(0, 0.08, u) * (1 - smooth(0.9, 1, u)) * smooth(1.2, 1.8, e);
        ctx.fillStyle = `rgba(225,245,250,${(0.18 * a).toFixed(3)})`;
        ctx.strokeStyle = `rgba(235,250,255,${(0.6 * a).toFixed(3)})`;
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.arc(x, y, rr, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      // turbulent plume glow
      ctx.globalAlpha = 0.25 * k;
      ctx.drawImage(softSprite([200, 230, 235], 128), CX - 300, SURF - 50, 600, DEPTH * 0.95);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
    // Surface line
    ctx.strokeStyle = 'rgba(170,220,230,0.8)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let x = rimL; x <= rimR; x += 8) ctx.lineTo(x, surfY(x));
    ctx.stroke();

    // ---- the trigger: a rockfall from the crater wall ----
    if (e >= 0) {
      for (const rk of DATA.rocks) {
        const u = clamp((e - rk.d) * 0.9 * rk.sp);
        if (u <= 0) continue;
        // slide down the right wall and sink along it
        const sx = rimR + 40 + rk.off, sy = terrain(rimR + 40) - 20;
        const ex = rimR - 150 + rk.off * 2, ey = SURF + 260 + rk.off * 3;
        const x = lerp(sx, ex, easeInOut(u)) - Math.sin(u * Math.PI) * 30;
        const y = lerp(sy, ey, u * u);
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(rk.rot + u * 6);
        ctx.fillStyle = y > SURF ? '#3a3a3e' : '#5e544a';
        ctx.beginPath();
        for (let k = 0; k < rk.sides; k++) {
          const a = (k / rk.sides) * Math.PI * 2;
          const rr = rk.s * (0.75 + 0.25 * N.hash(k + rk.sides * 7));
          k ? ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
        }
        ctx.fill();
        ctx.restore();
      }
      // splash and dust
      const sp = smooth(0.3, 0.6, e) * (1 - smooth(1.2, 2.2, e));
      if (sp > 0) {
        ctx.globalAlpha = sp * 0.6;
        ctx.drawImage(softSprite([220, 235, 240], 64), rimR - 190, SURF - 90, 180, 110);
        ctx.globalAlpha = sp * 0.5;
        ctx.drawImage(softSprite([150, 130, 110], 64), rimR - 40, SURF - 150, 260, 170);
        ctx.globalAlpha = 1;
      }
      // Pressure wave from the disturbance.
      const wv = smooth(0.6, 2.0, e);
      if (wv > 0 && wv < 1) {
        ctx.strokeStyle = `rgba(200,240,250,${(0.35 * (1 - wv)).toFixed(3)})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(rimR - 140, SURF + 250, 40 + wv * 700, Math.PI * 0.5, Math.PI * 1.3);
        ctx.stroke();
      }
      // Gas erupting out of the lake into the air.
      const gas = smooth(2.6, 4.0, e);
      if (gas > 0) {
        for (let i = 0; i < 60; i++) {
          const u = N.hash(i * 19);
          const x = CX + (N.hash(i * 23) - 0.5) * (200 + gas * 700 * u);
          const y = SURF - 40 - u * 260 * gas + Math.sin(t + i) * 8;
          const s = 60 + N.hash(i * 29) * 100;
          ctx.globalAlpha = 0.18 * gas;
          ctx.drawImage(softSprite([190, 198, 210], 128), x - s, y - s * 0.6, s * 2, s * 1.2);
        }
        ctx.globalAlpha = 1;
        // spray
        for (let i = 0; i < 70; i++) {
          const u = ((e - 2.6) * 0.5 + N.hash(i)) % 1;
          const vx = (N.hash(i * 3) - 0.5) * 360;
          const x = CX + vx * u;
          const y = SURF - 60 - (500 * u - 520 * u * u) * gas;
          ctx.fillStyle = `rgba(220,240,245,${(0.5 * (1 - u) * gas).toFixed(3)})`;
          ctx.beginPath();
          ctx.arc(x, y, 3 + N.hash(i * 5) * 4, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // ---- labels (calm phase) ----
    if (mode === 'calm') {
      const la = smooth(3.8, 4.8, lt) * (1 - smooth(8.3, 8.9, lt));
      if (la > 0.01) {
        ctx.globalAlpha = la;
        const px = CX + 270, py = bottom(CX + 270) - 40;
        ctx.strokeStyle = 'rgba(225,240,245,0.7)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px + 140, py - 120);
        ctx.lineTo(px + 190, py - 120);
        ctx.stroke();
        ctx.fillStyle = 'rgba(225,240,245,0.95)';
        ctx.beginPath();
        ctx.arc(px, py, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.font = '500 30px "Nyos Sans", sans-serif';
        N.subText(ctx, 'Trapped CO₂', px + 200, py - 124, 30);
        ctx.font = '400 20px "Nyos Sans", sans-serif';
        ctx.fillStyle = 'rgba(225,240,245,0.7)';
        ctx.fillText('dissolved in cold, heavy bottom water', px + 200, py - 90);
        const lb = smooth(5.2, 6.2, lt) * (1 - smooth(8.3, 8.9, lt));
        ctx.globalAlpha = lb;
        ctx.fillStyle = 'rgba(255,190,130,0.9)';
        ctx.font = '400 23px "Nyos Sans", sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('volcanic CO₂ seeping up from magma below', CX - 700, 880);
        ctx.globalAlpha = 1;
      }
    }
  }

  Object.assign(N, { drawCutaway });
})();
