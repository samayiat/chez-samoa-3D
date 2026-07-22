// Manual visual check for the new IK chef rig (render/chefRig.js), via
// chef-rig-preview.html. Starts a temporary Vite dev server, screenshots idle
// and mid-punch poses, and reports any console/page errors. Not part of the
// automated test suite -- run by hand: `node verify-chef-rig.mjs [outDir]`.
import { chromium } from '@playwright/test';
import { spawn } from 'child_process';
import path from 'path';

const shotDir = process.argv[2] || '.';

const vite = spawn('npx', ['vite', '--port', '4199', '--strictPort'], { stdio: 'pipe' });
await new Promise((resolve, reject) => {
  const t = setTimeout(() => reject(new Error('vite dev server did not start in time')), 15000);
  vite.stdout.on('data', (d) => { if (String(d).includes('ready in')) { clearTimeout(t); resolve(); } });
  vite.stderr.on('data', (d) => process.stderr.write(d));
});

const browser = await chromium.launch({
  executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium',
  args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 900, height: 900 } });
// Matches verify-vince.mjs's convention: track uncaught page errors only, not
// generic console.error noise (e.g. the browser's own favicon 404).
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

await page.goto('http://localhost:4199/chef-rig-preview.html', { waitUntil: 'load' });
await page.waitForFunction(() => window.__rigPreview?.ready, null, { timeout: 5000 });

await page.evaluate(() => window.__rigPreview.setIdle());
await page.screenshot({ path: path.join(shotDir, 'chef-rig-1-idle.png') });

// mid-punch: t just before hitAt (0.11), left jab (PUNCHES[0])
await page.evaluate(() => window.__rigPreview.setPunch(0.09, 0));
await page.screenshot({ path: path.join(shotDir, 'chef-rig-2-punch-left.png') });

// right jab (PUNCHES[1]) at full extension (t == hitAt)
await page.evaluate(() => window.__rigPreview.setPunch(0.11, 1));
await page.screenshot({ path: path.join(shotDir, 'chef-rig-3-punch-right.png') });

await browser.close();
vite.kill();

console.log('ERRORS:', errors.length ? '\n' + errors.join('\n') : 'none');
process.exit(errors.length ? 1 : 0);
