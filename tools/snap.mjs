// Render individual frames to PNG for previewing: node tools/snap.mjs out_dir t1 t2 ...
import { launch } from './browser.mjs';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [outDir, ...times] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });
const browser = await launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
page.on('pageerror', (e) => console.error('PAGE ERROR', e.message));
page.on('console', (m) => m.type() === 'error' && console.error('CONSOLE', m.text()));
await page.goto(pathToFileURL(path.join(root, 'index.html')).href + '?export');
await page.evaluate(() => window.NYOS.ready);
for (const t of times) {
  const data = await page.evaluate((t) => {
    const t0 = performance.now();
    window.renderAt(t);
    const ms = performance.now() - t0;
    return [document.getElementById('film').toDataURL('image/jpeg', 0.85), ms];
  }, parseFloat(t));
  fs.writeFileSync(path.join(outDir, `f_${String(t).padStart(5, '0')}.jpg`), Buffer.from(data[0].split(',')[1], 'base64'));
  console.log(t, data[1].toFixed(0) + 'ms');
}
await browser.close();
