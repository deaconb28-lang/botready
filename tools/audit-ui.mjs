/**
 * The UI checks that need a real browser pointed at a running app.
 *
 * Three things, all of which the build plan asks for by name and none of which
 * a unit test can answer:
 *
 *   accessibility   axe-core over every page at desktop and at 390px. axe is
 *                   what Lighthouse's accessibility category runs, so a clean
 *                   run here is the same measurement.
 *   focus           tab through the result page and assert every stop paints
 *                   something. A keyboard reader has no other affordance, and
 *                   this product's whole argument is about clients that are
 *                   not looking at pixels.
 *   reduced motion  assert the animations run without the preference and stop
 *                   with it. Only asserting the second half would pass on a
 *                   page that never animated in the first place.
 *
 * Also writes a screenshot of every page to --out, and renders the share card,
 * because a card only ever appears inside somebody else's link unfurler and is
 * otherwise the hardest thing in the product to look at.
 *
 * Usage:
 *   pnpm --filter @botready/tools audit:ui -- --base http://127.0.0.1:3000
 *
 * The preview routes it visits are development-only, so point it at `next dev`
 * or at a preview deployment, not at production.
 */

import { chromium } from 'playwright';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { argv, exit } from 'node:process';

// pnpm passes a bare `--` through to the script, so it is dropped before
// pairing keys with values rather than shifting everything by one.
const args = new Map();
{
  const tokens = argv.slice(2).filter((token) => token !== '--');
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (!token?.startsWith('--')) continue;
    const key = token.slice(2);
    const next = tokens[i + 1];
    if (next && !next.startsWith('--')) {
      args.set(key, next);
      i += 1;
    } else {
      args.set(key, 'true');
    }
  }
}

const BASE = args.get('base') ?? 'http://127.0.0.1:3000';
const OUT = args.get('out') ?? 'audit-output';
const SHOTS = args.has('no-shots') ? false : true;

const require = createRequire(import.meta.url);
const axeSource = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');

const PAGES = [
  ['landing', '/'],
  ['result', '/preview/waf-blocked-spa'],
  ['result-with-errors', '/preview/skips-and-errors'],
  ['result-all-pass', '/preview/reference-a'],
  ['result-blocked', '/preview/waf-blocked-spa?state=blocked'],
  ['index', '/index/saas'],
  ['what-we-check', '/what-we-check'],
  ['bot', '/bot'],
  ['pricing', '/pricing'],
  ['live', '/scan/live?id=00000000-0000-4000-8000-000000000000'],
  ['not-found', '/this-does-not-exist'],
];

const VIEWPORTS = [
  ['desktop', { width: 1280, height: 900 }],
  // 390px is the mobile frame in docs/botready-ui-mockups.html.
  ['mobile', { width: 390, height: 844 }],
];

const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'];

/** Next.js injects this in development and it is not part of our UI. */
const DEV_ONLY = /^nextjs-portal$/i;

if (SHOTS) mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ args: ['--no-sandbox'] });
const failures = [];

// ------------------------------------------------------------------ axe

for (const [viewportName, viewport] of VIEWPORTS) {
  const context = await browser.newContext({ viewport });
  for (const [name, path] of PAGES) {
    const page = await context.newPage();
    const consoleErrors = [];
    page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()));
    page.on('pageerror', (e) => consoleErrors.push(String(e)));

    const response = await page.goto(BASE + path, { waitUntil: 'networkidle' }).catch(() => null);
    const status = response?.status() ?? 0;

    // Measure the page at rest. The landing transcript lands its lines over a
    // couple of seconds, and a line at 20% opacity mid-entrance is not a
    // contrast failure. A page that never settles would be, so the wait is
    // capped and infinite animations (the running-line pulse) are ignored.
    await page
      .waitForFunction(
        () =>
          document
            .getAnimations()
            .filter((a) => a.playState === 'running' && a.effect?.getTiming().iterations !== Infinity)
            .length === 0,
        undefined,
        { timeout: 6000 },
      )
      .catch(() => {});

    if (SHOTS) {
      await page.screenshot({
        path: `${OUT}/${viewportName}-${name}.png`,
        fullPage: viewportName === 'desktop',
      });
    }

    // Wide content scrolls inside its own container. The body never does.
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );

    await page.addScriptTag({ content: axeSource });
    const results = await page.evaluate(
      async (tags) => window.axe.run(document, { runOnly: { type: 'tag', values: tags } }),
      AXE_TAGS,
    );

    const label = `${viewportName} ${path}`;
    console.log(`\n${label}  [HTTP ${status}]`);
    console.log(`  overflow ${overflow}px`);

    if (overflow > 1) failures.push(`${label}: body scrolls sideways by ${overflow}px`);
    if (results.violations.length === 0) {
      console.log('  axe: clean');
    } else {
      for (const violation of results.violations) {
        console.log(`  axe [${violation.impact}] ${violation.id}: ${violation.help}`);
        for (const node of violation.nodes.slice(0, 3)) {
          console.log(`      ${node.html.slice(0, 150)}`);
        }
        failures.push(`${label}: ${violation.id} (${violation.nodes.length})`);
      }
    }

    // Two console errors are the app behaving correctly rather than failing.
    // The live page polls an endpoint that needs the database, so a 5xx there
    // is expected when running against a local app with no Supabase; and a page
    // we asked for a 404 from reports its own 404.
    const unexpected = consoleErrors.filter(
      (e) => !/status of 5\d\d/.test(e) && !(status === 404 && /status of 404/.test(e)),
    );
    if (unexpected.length > 0) {
      console.log(`  console: ${unexpected.length} error(s)`);
      for (const err of unexpected.slice(0, 3)) console.log(`      ${err.slice(0, 150)}`);
      failures.push(`${label}: ${unexpected.length} console error(s)`);
    }

    await page.close();
  }
  await context.close();
}

// ------------------------------------------------------------------ focus

{
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  await page.goto(`${BASE}/preview/waf-blocked-spa`, { waitUntil: 'networkidle' });

  const stops = [];
  for (let i = 0; i < 60; i += 1) {
    await page.keyboard.press('Tab');
    const stop = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return null;
      const style = getComputedStyle(el);
      const width = Number.parseFloat(style.outlineWidth) || 0;
      return {
        tag: el.tagName.toLowerCase(),
        text: (el.textContent ?? '').trim().slice(0, 40),
        visible: (style.outlineStyle !== 'none' && width > 0) || style.boxShadow !== 'none',
        outline: `${style.outlineStyle} ${style.outlineWidth} ${style.outlineColor}`,
      };
    });
    if (!stop) break;
    stops.push(stop);
  }

  const invisible = stops.filter((s) => !s.visible && !DEV_ONLY.test(s.tag));
  console.log(`\nfocus: ${stops.length} stops, ${invisible.length} without a visible indicator`);
  for (const bad of invisible) console.log(`  <${bad.tag}> "${bad.text}" -> ${bad.outline}`);
  if (stops.length < 5) failures.push(`focus: only ${stops.length} stops, which cannot be right`);
  for (const bad of invisible) failures.push(`focus: <${bad.tag}> "${bad.text}" paints nothing`);

  await context.close();
}

// ------------------------------------------------------------------ motion

for (const preference of ['no-preference', 'reduce']) {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    reducedMotion: preference,
  });
  const page = await context.newPage();
  await page.goto(`${BASE}/scan/live?id=00000000-0000-4000-8000-000000000000`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForTimeout(600);

  const moving = await page.evaluate(() =>
    [...document.querySelectorAll('*')]
      .map((el) => {
        const s = getComputedStyle(el);
        return {
          animation: s.animationName,
          duration: Number.parseFloat(s.animationDuration) || 0,
          transition: Number.parseFloat(s.transitionDuration) || 0,
        };
      })
      .filter((a) => (a.animation !== 'none' && a.duration > 0.05) || a.transition > 0.05),
  );

  console.log(`\nprefers-reduced-motion: ${preference} -> ${moving.length} element(s) moving`);
  if (preference === 'reduce' && moving.length > 0) {
    failures.push(`reduced motion: ${moving.length} element(s) still animate`);
  }
  if (preference === 'no-preference' && moving.length === 0) {
    failures.push('reduced motion: nothing animates either way, so the check proves nothing');
  }
  await context.close();
}

// ------------------------------------------------------------------ share card

if (SHOTS) {
  const context = await browser.newContext();
  const page = await context.newPage();
  for (const fixture of ['waf-blocked-spa', 'reference-a', 'skips-and-errors']) {
    const response = await page.goto(`${BASE}/api/og/preview/${fixture}`).catch(() => null);
    if (response?.ok()) {
      const body = await response.body();
      writeFileSync(`${OUT}/share-card-${fixture}.png`, body);
      // The PNG header carries the dimensions, and 1200x630 is not negotiable.
      const width = body.readUInt32BE(16);
      const height = body.readUInt32BE(20);
      console.log(`\nshare card ${fixture}: ${width}x${height}`);
      if (width !== 1200 || height !== 630) {
        failures.push(`share card ${fixture}: ${width}x${height}, expected 1200x630`);
      }
    } else {
      failures.push(`share card ${fixture}: HTTP ${response?.status() ?? 'no response'}`);
    }
  }
  await context.close();
}

await browser.close();

console.log('\n' + '-'.repeat(60));
if (failures.length === 0) {
  console.log('clean');
  exit(0);
}
console.log(`${failures.length} finding(s):`);
for (const failure of failures) console.log(`  ${failure}`);
exit(1);
