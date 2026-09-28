/* Post-processing: vignette, grain, letterbox, fades, subtitles and title. */
(function () {
  const N = window.NYOS;
  const { W, H, clamp, smooth, rng, screen } = N;

  let grainTiles = null;
  function makeGrain() {
    const r = rng(99);
    grainTiles = [];
    for (let k = 0; k < 6; k++) {
      const c = document.createElement('canvas');
      c.width = c.height = 256;
      const g = c.getContext('2d');
      const img = g.createImageData(256, 256);
      for (let i = 0; i < img.data.length; i += 4) {
        const v = r() * 255;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
        img.data[i + 3] = 255;
      }
      g.putImageData(img, 0, 0);
      grainTiles.push(c);
    }
  }

  function vignette(ctx, S, amount) {
    screen(ctx, S);
    const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 1.05);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, `rgba(0,0,0,${amount})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  function grain(ctx, S, t, amount) {
    if (!grainTiles) makeGrain();
    screen(ctx, S);
    const tile = grainTiles[Math.floor(t * 24) % grainTiles.length];
    ctx.globalAlpha = amount;
    ctx.globalCompositeOperation = 'overlay';
    const off = Math.floor(t * 24) * 37;
    ctx.save();
    ctx.translate(-(off % 256), -((off * 3) % 256));
    ctx.fillStyle = ctx.createPattern(tile, 'repeat');
    ctx.fillRect(0, 0, W + 256, H + 256);
    ctx.restore();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  function grade(ctx, S, color, alpha, mode) {
    if (alpha <= 0.001) return;
    screen(ctx, S);
    ctx.globalCompositeOperation = mode;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  const BAR = 62;
  function letterbox(ctx, S) {
    screen(ctx, S);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, BAR);
    ctx.fillRect(0, H - BAR, W, BAR);
  }

  function fadeBlack(ctx, S, a) {
    if (a <= 0.001) return;
    screen(ctx, S);
    ctx.fillStyle = `rgba(0,0,0,${clamp(a)})`;
    ctx.fillRect(0, 0, W, H);
  }

  // Draw text, rendering "₂" as a real lowered subscript so any font works.
  function subText(ctx, text, x, y, size) {
    const parts = text.split('₂');
    let total = 0;
    const subSize = size * 0.62;
    const widths = parts.map((p) => ctx.measureText(p).width);
    const font = ctx.font;
    ctx.font = font.replace(/\d+px/, `${Math.round(subSize)}px`);
    const sw = ctx.measureText('2').width;
    ctx.font = font;
    total = widths.reduce((a, b) => a + b, 0) + sw * (parts.length - 1);
    const align = ctx.textAlign;
    let cx = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
    ctx.textAlign = 'left';
    parts.forEach((p, i) => {
      ctx.fillText(p, cx, y);
      cx += widths[i];
      if (i < parts.length - 1) {
        ctx.font = font.replace(/\d+px/, `${Math.round(subSize)}px`);
        ctx.fillText('2', cx, y + size * 0.18);
        ctx.font = font;
        cx += sw;
      }
    });
    ctx.textAlign = align;
    return total;
  }

  function subtitle(ctx, S, t, subs) {
    screen(ctx, S);
    for (const s of subs) {
      const a = smooth(s.start, s.start + 0.45, t) * (1 - smooth(s.end - 0.4, s.end, t));
      if (a <= 0.001) continue;
      const rise = (1 - smooth(s.start, s.start + 0.6, t)) * 8;
      ctx.font = '500 44px "Nyos Serif", Georgia, serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      const lines = wrap(ctx, s.text, 1500);
      const lh = 54;
      const y0 = H - BAR - 38 - (lines.length - 1) * lh + rise;
      lines.forEach((ln, i) => {
        const y = y0 + i * lh;
        ctx.fillStyle = `rgba(0,0,0,${0.55 * a})`;
        ctx.shadowColor = `rgba(0,0,0,${0.9 * a})`;
        ctx.shadowBlur = 18;
        subText(ctx, ln, W / 2 + 2, y + 2, 44);
        ctx.shadowBlur = 0;
        ctx.fillStyle = `rgba(250,246,236,${a})`;
        subText(ctx, ln, W / 2, y, 44);
      });
    }
    ctx.shadowColor = 'transparent';
  }

  function wrap(ctx, text, max) {
    // Two balanced lines rather than one long line and a dangling word.
    if (ctx.measureText(text).width <= max) return [text];
    const words = text.split(' ');
    let best = null;
    for (let i = 1; i < words.length; i++) {
      const a = words.slice(0, i).join(' '), b = words.slice(i).join(' ');
      const w = Math.max(ctx.measureText(a).width, ctx.measureText(b).width);
      if (w <= max && (!best || w < best.w)) best = { w, lines: [a, b] };
    }
    return best ? best.lines : greedyWrap(ctx, text, max);
  }
  function greedyWrap(ctx, text, max) {
    const words = text.split(' ');
    const lines = [];
    let cur = '';
    for (const w of words) {
      const test = cur ? cur + ' ' + w : w;
      if (ctx.measureText(test).width > max && cur) {
        lines.push(cur);
        cur = w;
      } else cur = test;
    }
    if (cur) lines.push(cur);
    return lines;
  }

  function title(ctx, S, t, t0) {
    const a = smooth(t0, t0 + 1.0, t);
    if (a <= 0.001) return;
    screen(ctx, S);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const spread = 1 + (1 - a) * 0.02;
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.scale(spread, spread);
    ctx.fillStyle = `rgba(236,230,218,${a})`;
    ctx.font = 'italic 500 58px "Nyos Serif", Georgia, serif';
    ctx.fillText('Sometimes...', 0, -40);
    ctx.font = '500 58px "Nyos Serif", Georgia, serif';
    ctx.fillText('the deadliest disasters make no sound.', 0, 36);
    ctx.fillStyle = `rgba(236,230,218,${a * 0.35})`;
    ctx.fillRect(-60, 100, 120, 1.5);
    ctx.restore();
  }

  Object.assign(N, { vignette, grain, grade, letterbox, fadeBlack, subtitle, title, subText, BAR });
})();
