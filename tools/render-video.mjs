// Render the film to MP4 (H.264 + AAC) frame by frame in headless Chromium.
//
//   node tools/render-video.mjs [--out renders/lake-nyos.mp4] [--fps 30] [--no-subs] [--from 0] [--to 60]
//
// Needs ffmpeg with libx264 on PATH (or set FFMPEG=/path/to/ffmpeg).
import { launch } from './browser.mjs';
import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const fps = parseFloat(opt('fps', '30'));
const from = parseFloat(opt('from', '0'));
const to = parseFloat(opt('to', '60'));
const subs = !args.includes('--no-subs');
const out = path.resolve(opt('out', path.join(root, 'renders', subs ? 'lake-nyos.mp4' : 'lake-nyos-nosubs.mp4')));
const ffmpeg = process.env.FFMPEG || 'ffmpeg';
fs.mkdirSync(path.dirname(out), { recursive: true });

const browser = await launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
page.on('pageerror', (e) => console.error('page error:', e.message));
await page.goto(pathToFileURL(path.join(root, 'index.html')).href + `?export&subs=${subs ? 1 : 0}`);
await page.evaluate(() => window.NYOS.ready);

console.log('Rendering score…');
const wavPath = path.join(os.tmpdir(), `nyos-score-${process.pid}.wav`);
fs.writeFileSync(wavPath, Buffer.from(await page.evaluate(() => window.NYOS.scoreWavBase64()), 'base64'));

const ff = spawn(ffmpeg, [
  '-y', '-loglevel', 'error',
  '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-',
  '-ss', String(from), '-t', String(to - from), '-i', wavPath,
  '-map', '0:v', '-map', '1:a',
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
  '-c:a', 'aac', '-b:a', '192k', '-shortest', out,
], { stdio: ['pipe', 'inherit', 'inherit'] });
const ffDone = new Promise((res, rej) => ff.on('close', (c) => (c === 0 ? res() : rej(new Error(`ffmpeg exited ${c}`)))));

const frames = Math.round((to - from) * fps);
const t0 = Date.now();
for (let i = 0; i < frames; i++) {
  const t = from + i / fps;
  const b64 = await page.evaluate((t) => {
    window.renderAt(t);
    return document.getElementById('film').toDataURL('image/jpeg', 0.96).split(',')[1];
  }, t);
  if (!ff.stdin.write(Buffer.from(b64, 'base64'))) await new Promise((r) => ff.stdin.once('drain', r));
  if (i % fps === 0) {
    const el = (Date.now() - t0) / 1000;
    process.stdout.write(`\r  ${t.toFixed(1)}s / ${to}s  (${(i / Math.max(el, 0.01)).toFixed(1)} fps)   `);
  }
}
ff.stdin.end();
await ffDone;
await browser.close();
fs.rmSync(wavPath, { force: true });
console.log(`\nWrote ${path.relative(process.cwd(), out)}`);
