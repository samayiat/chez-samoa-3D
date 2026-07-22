// Manual visual check of the new combat wired into the REAL running game
// (index.html), not the isolated chef-rig-preview.html. Builds, serves the
// built site, triggers a brawl, holds the attack key, and screenshots.
// Not part of the automated test suite -- run by hand:
//   node verify-brawl3d-live.mjs [outDir]
import { chromium } from '@playwright/test';
import { spawn } from 'child_process';
import path from 'path';

const shotDir = process.argv[2] || '.';

const preview = spawn('npx', ['vite', 'preview', '--port', '4198', '--strictPort'], { stdio: 'pipe' });
await new Promise((resolve, reject) => {
  const t = setTimeout(() => reject(new Error('vite preview did not start in time')), 15000);
  preview.stdout.on('data', (d) => { if (String(d).includes('Local:')) { clearTimeout(t); resolve(); } });
  preview.stderr.on('data', (d) => process.stderr.write(d));
});

const browser = await chromium.launch({
  executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium',
  args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1000, height: 750 } });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

await page.goto('http://localhost:4198/', { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__game, null, { timeout: 5000 });
await page.click('#startBtn').catch(() => {}); // dismiss the start overlay if present
await page.waitForTimeout(300);

await page.screenshot({ path: path.join(shotDir, 'brawl3d-live-1-service.png') });

// trigger the new brawl directly via the exposed hook (matches e2e/game.spec.js's
// existing pattern for the old system)
await page.evaluate(() => window.__game.startBrawl(window.__game.state, 1));
await page.waitForTimeout(150);
await page.screenshot({ path: path.join(shotDir, 'brawl3d-live-2-idle.png') });

// hold E briefly (light punch), release, let it play out
await page.keyboard.down('KeyE');
await page.waitForTimeout(80);
await page.screenshot({ path: path.join(shotDir, 'brawl3d-live-3-charging.png') });
await page.keyboard.up('KeyE');
await page.waitForTimeout(60);
await page.screenshot({ path: path.join(shotDir, 'brawl3d-live-4-punching.png') });

const hpAfter = await page.evaluate(() => {
  const c = window.__game.state.combat3d;
  return { chefHp: c.entities[0].hp, bagHp: c.entities[1].hp };
});

await browser.close();
preview.kill();

console.log('HP after one punch:', JSON.stringify(hpAfter));
console.log('ERRORS:', errors.length ? '\n' + errors.join('\n') : 'none');
process.exit(errors.length ? 1 : 0);
