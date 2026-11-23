// Usage: node scripts/screenshot.mjs <abs path to index.html> <out prefix> <steps e.g. 1,2,3> [width] [height]
// KEYS=p presses keys (comma separated) before each shot. Uses the locally installed Google Chrome.
import { chromium } from 'playwright';
const [,, file, prefix, stepsArg, w = '1920', h = '1080'] = process.argv;
const browser = await chromium.launch({ channel: 'chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: +w, height: +h } });
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(String(e)));
for (const s of stepsArg.split(',')) {
  await page.goto('file://' + file + '#/' + s);
  await page.reload();
  await page.waitForTimeout(400);
  if (process.env.KEYS) for (const k of process.env.KEYS.split(',')) await page.keyboard.press(k);
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${prefix}-${s}.png` });
}
console.log('errors:', JSON.stringify(errors));
await browser.close();
