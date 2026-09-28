// Launch Chromium: uses Playwright's own browser, or CHROMIUM_PATH / a preinstalled one.
import { chromium } from 'playwright';
import fs from 'node:fs';

export async function launch() {
  const candidates = [process.env.CHROMIUM_PATH, '/opt/pw-browsers/chromium'].filter(Boolean);
  try {
    return await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  } catch (err) {
    const exe = candidates.find((p) => fs.existsSync(p));
    if (!exe) throw err;
    return chromium.launch({ executablePath: exe, args: ['--autoplay-policy=no-user-gesture-required'] });
  }
}
