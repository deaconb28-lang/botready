/**
 * The still cards the promo floats on its gradient, captured from the real
 * running app at 2x so they stay sharp at 1920x1080.
 *
 * Same rule as capture-footage.mjs: every panel in the promo is a screenshot of
 * the product, never a drawing of it. A tool that sells a measurement cannot
 * ship a picture of a measurement it did not take.
 *
 *   node tools/capture-cards.mjs --base http://127.0.0.1:3000
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { argv } from 'node:process';

const args = new Map();
{
  const t = argv.slice(2).filter((x) => x !== '--');
  for (let i = 0; i < t.length; i += 1)
    if (t[i]?.startsWith('--')) {
      const n = t[i + 1];
      if (n && !n.startsWith('--')) { args.set(t[i].slice(2), n); i += 1; } else args.set(t[i].slice(2), 'true');
    }
}
const BASE = args.get('base') ?? 'http://127.0.0.1:3000';
const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, '..', 'marketing', 'video', 'cards');

/**
 * The smallest bordered card whose text contains the needle. The design system
 * puts `.edge` on every card, and the smallest match is the card itself rather
 * than a section that happens to contain it. Comparison is lowercased because
 * the eyebrows are uppercased by CSS, not in the DOM.
 */
async function rectOf(page, needle, { minW = 120, minH = 60 } = {}) {
  return page.evaluate(({ text, minW, minH }) => {
    const n = text.toLowerCase();
    const r = [...document.querySelectorAll('.edge')]
      .filter((el) => el.textContent?.toLowerCase().includes(n))
      .map((el) => el.getBoundingClientRect())
      .filter((b) => b.width >= minW && b.height >= minH)
      .sort((a, b) => a.width * a.height - b.width * b.height)[0];
    return r ? { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) } : null;
  }, { text: needle, minW, minH });
}

const SHOTS = [
  { name: 'urlbox',    path: '/',                        needle: 'run the check',           pad: 10 },
  { name: 'assistant', path: '/',                        needle: 'not mentioned',           pad: 10 },
  { name: 'agents',    path: '/',                        needle: 'one request, five agents', pad: 10 },
  { name: 'blocked403',path: '/',                        needle: 'nobody chose the block',   pad: 10 },
  { name: 'fixfiles',  path: '/',                        needle: 'the fix is four',          pad: 10 },
  { name: 'shortlist', path: '/',                        needle: 'the shortlist forms',      pad: 10 },
  { name: 'whateach',  path: '/preview/waf-blocked-spa', needle: 'what each client got',     pad: 10 },
  { name: 'retrieve',  path: '/preview/waf-blocked-spa', needle: 'being turned away',        pad: 10 },
];

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ args: ['--no-sandbox'] });
const page = await browser.newPage({
  viewport: { width: 1920, height: 1080 },
  deviceScaleFactor: 2,
  reducedMotion: 'no-preference',
});
// Nothing off-box may load; the promo must not depend on a third party.
await page.route('**/*', (route) => {
  const u = route.request().url();
  return (u.startsWith(BASE) || u.startsWith('data:') || u.startsWith('blob:'))
    ? route.continue() : route.abort();
});

let last = null;
for (const s of SHOTS) {
  if (s.path !== last) {
    await page.goto(BASE + s.path, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('load');
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(5200);   // the race rests at step 7, the score finishes counting
    last = s.path;
  }
  // Bring the card into the viewport first. Scrolling is done inside evaluate
  // because scrollIntoViewIfNeeded never settles next to the infinite marquee.
  await page.evaluate(({ text }) => {
    const n = text.toLowerCase();
    const el = [...document.querySelectorAll('.edge')]
      .filter((e) => e.textContent?.toLowerCase().includes(n))
      .sort((a, b) => {
        const x = a.getBoundingClientRect(), y = b.getBoundingClientRect();
        return x.width * x.height - y.width * y.height;
      })[0];
    if (!el) return;
    const b = el.getBoundingClientRect();
    window.scrollBy(0, b.top + b.height / 2 - window.innerHeight / 2);
  }, { text: s.needle });
  await page.waitForTimeout(700);

  const r = await rectOf(page, s.needle);
  if (!r) { console.log(`  MISS  ${s.name} ("${s.needle}")`); continue; }
  const p = s.pad ?? 0;
  await page.screenshot({
    path: join(OUT, `${s.name}.png`),
    clip: { x: r.x - p, y: r.y - p, width: r.width + p * 2, height: r.height + p * 2 },
  });
  console.log(`  ok    ${s.name.padEnd(10)} ${r.width}x${r.height}`);
}
await browser.close();
