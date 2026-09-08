/**
 * The moving assets, recorded from the real running app.
 *
 * Everything in the launch film that shows the product is a recording made by
 * this file. Nothing is drawn to look like the product, because a tool that
 * sells a measurement cannot ship a picture of a measurement it did not take.
 * The campaign rule is in marketing/README.md; this is the half of it that runs.
 *
 * Each shot records the whole viewport and writes its crop rectangle to
 * shots.json beside the video, so the framing decision stays a number that
 * marketing/video/build-film.mjs can re-apply rather than a re-record.
 *
 * Usage:
 *   pnpm --filter @botready/tools capture -- --base http://127.0.0.1:3000
 *   pnpm --filter @botready/tools capture -- --only split,result
 *
 * Point --base at `next dev`, at a preview deployment, or at production. The
 * preview routes it uses exist in every one of those.
 */

import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { argv, exit } from 'node:process';
import ffmpeg from 'ffmpeg-static';

// pnpm passes a bare `--` through, so drop it before pairing keys with values.
const args = new Map();
{
  const tokens = argv.slice(2).filter((t) => t !== '--');
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (!token?.startsWith('--')) continue;
    const next = tokens[i + 1];
    if (next && !next.startsWith('--')) { args.set(token.slice(2), next); i += 1; }
    else args.set(token.slice(2), 'true');
  }
}

const BASE = args.get('base') ?? 'http://127.0.0.1:3000';
const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = args.get('out') ?? join(HERE, '..', 'marketing', 'video', 'footage');
const ONLY = args.get('only')?.split(',').map((s) => s.trim()).filter(Boolean) ?? null;
const FPS = 30;
const W = 1920;
const H = 1080;

/** The landing race advances one row per 620ms and rests at step 7 (AgentRace.tsx). */
const RACE_STEP_MS = 620;
const RACE_LOOP_MS = RACE_STEP_MS * 8;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Wait for an element and return its viewport rectangle, rounded to even numbers
 *  because h264 chroma subsampling refuses odd dimensions. */
async function rectOf(page, locator) {
  await locator.first().waitFor({ state: 'visible', timeout: 20000 });
  const box = await locator.first().boundingBox();
  if (!box) return null;
  const even = (n) => Math.max(2, Math.round(n / 2) * 2);
  const x = Math.max(0, Math.round(box.x));
  const y = Math.max(0, Math.round(box.y));
  return {
    x: even(x), y: even(y),
    width: even(Math.min(box.width, W - x)),
    height: even(Math.min(box.height, H - y)),
  };
}

/** Find the bordered card that contains some text and return its viewport rect.
 *  Locators match the deepest element containing the text, which for a card is
 *  its header row rather than the card, so this walks up to the nearest `.edge`
 *  — the class every bordered surface in the design system carries. */
async function rectOfCard(page, needle, fallback) {
  const box = await page.evaluate((text) => {
    // Eyebrows are uppercased in CSS, so the DOM text is not what is on screen.
    // Every bordered surface carries `.edge`, so the card is the smallest one
    // that contains the text — smallest, because ancestors contain it too.
    const needle = text.toLowerCase();
    const cards = [...document.querySelectorAll('.edge')]
      .filter((el) => el.textContent?.toLowerCase().includes(needle))
      .map((el) => el.getBoundingClientRect())
      .filter((r) => r.width >= 80 && r.height >= 60)
      .sort((a, b) => a.width * a.height - b.width * b.height);
    const r = cards[0];
    return r ? { x: r.x, y: r.y, width: r.width, height: r.height } : null;
  }, needle);
  if (!box || box.width < 80 || box.height < 60) return fallback;
  const even = (n) => Math.max(2, Math.round(n / 2) * 2);
  const pad = 14;                                  // keep the hard shadow in frame
  const x = Math.max(0, Math.round(box.x) - pad);
  const y = Math.max(0, Math.round(box.y) - pad);
  return {
    x: even(x), y: even(y),
    width: even(Math.min(box.width + pad * 2, W - x)),
    height: even(Math.min(box.height + pad * 2, H - y)),
  };
}

/** The violet panel on the landing page. Matched by its copy rather than a class,
 *  so a Tailwind change does not silently reframe the shot. */
const racePanel = (page) =>
  page.locator('div', { hasText: 'ONE REQUEST' }).filter({ has: page.locator('.anim-marquee') }).last();

// ------------------------------------------------------------------ the shots

const SHOTS = [
  {
    name: 'split',
    path: '/',
    seconds: 10,
    note: 'The five agents landing. Two full loops, so it can be cut on any row.',
    async prepare(page) {
      const panel = racePanel(page);
      await panel.scrollIntoViewIfNeeded();
      await sleep(400);
      return rectOf(page, panel);
    },
    async perform() { await sleep(RACE_LOOP_MS * 2 + 600); },
  },
  {
    name: 'terminal',
    path: '/',
    seconds: 7,
    note: 'The product\'s own terminal block: 403 Forbidden, cf-mitigated: challenge.',
    async prepare(page) {
      const block = page.locator('text=cf-mitigated').first();
      await block.scrollIntoViewIfNeeded();
      await sleep(600);
      const panel = page.locator('div').filter({ hasText: /HTTP\/1\.1 403 Forbidden/ }).last();
      return (await rectOf(page, panel)) ?? { x: 0, y: 0, width: W, height: H };
    },
    async perform() { await sleep(5000); },
  },
  {
    name: 'marquee',
    path: '/',
    seconds: 10,
    note: 'The twelve real crawler user agents, one pass of the 26s slide.',
    async prepare(page) {
      // Playwright's scrollIntoViewIfNeeded waits for the element to stop moving,
      // and this one never does — the slide is `marquee 26s linear infinite`.
      // So both the scroll and the measurement happen in the page.
      const r = await page.evaluate((grow) => {
        const el = document.querySelector('.anim-marquee');
        if (!el) return null;
        el.scrollIntoView({ block: 'center', behavior: 'instant' });
        const b = el.getBoundingClientRect();
        const y = Math.max(0, Math.round(b.y) - grow);
        return { x: 0, y, width: 1920, height: Math.round(b.height) + grow * 2 };
      }, 38);
      await sleep(400);
      if (!r) return null;
      const even = (n) => Math.max(2, Math.round(n / 2) * 2);
      return { x: 0, y: even(r.y), width: 1920, height: even(Math.min(r.height, H - r.y)) };
    },
    async perform() { await sleep(9000); },
  },
  {
    name: 'hero',
    path: '/',
    seconds: 8,
    note: 'Are you BotReady? and the URL box with the caret blinking.',
    async prepare(page) {
      await page.locator('h1').first().waitFor({ state: 'visible' });
      await sleep(600);
      return { x: 0, y: 0, width: W, height: H };
    },
    async perform() { await sleep(6500); },
  },
  {
    name: 'result',
    path: '/preview/waf-blocked-spa',
    seconds: 9,
    note: 'The score counting to 50 over 1500ms, grade D, the six category bars.',
    async prepare(page) {
      // Land at the top so the count-up is caught from its first frame.
      await page.evaluate(() => window.scrollTo(0, 0));
      return { x: 0, y: 0, width: W, height: H };
    },
    async perform(page) {
      await sleep(3200);            // the count-up plus a beat on the finished number
      await page.mouse.wheel(0, 420);
      await sleep(4200);
    },
  },
  {
    name: 'score',
    path: '/preview/waf-blocked-spa',
    seconds: 7,
    note: 'The report header alone: the score counting to 50, grade D, six category bars.',
    async prepare(page) {
      await page.evaluate(() => window.scrollTo(0, 0));
      await sleep(150);
      return rectOfCard(page, 'scoring v1.2', { x: 420, y: 250, width: 1080, height: 260 });
    },
    async perform() { await sleep(5200); },
  },
  {
    name: 'clients',
    path: '/preview/waf-blocked-spa',
    seconds: 7,
    note: 'What each client got. The 200-vs-403 column, which is the headline finding.',
    async prepare(page) {
      await sleep(500);
      return rectOfCard(page, 'WHAT EACH CLIENT GOT', { x: 0, y: 0, width: W, height: H });
    },
    async perform() { await sleep(5200); },
  },
  {
    name: 'findings',
    path: '/preview/waf-blocked-spa',
    seconds: 10,
    note: 'What to fix, with the parity finding opened.',
    async prepare(page) {
      const h = page.getByRole('heading', { name: /What to fix/i }).first();
      await h.scrollIntoViewIfNeeded();
      await sleep(700);
      return { x: 0, y: 0, width: W, height: H };
    },
    async perform(page) {
      await sleep(1400);
      const first = page.locator('summary').first();
      if (await first.count()) { await first.click().catch(() => {}); }
      await sleep(6000);
    },
  },
  {
    name: 'fixpack',
    path: '/preview/waf-blocked-spa',
    seconds: 9,
    note: 'The violet panel and the coding-agent line.',
    async prepare(page) {
      const t = page.locator('text=botready-fixes.md').first();
      await t.scrollIntoViewIfNeeded().catch(() => {});
      await sleep(700);
      return { x: 0, y: 0, width: W, height: H };
    },
    async perform() { await sleep(7000); },
  },
  {
    name: 'blocked',
    path: '/preview/waf-blocked-spa?state=blocked',
    seconds: 8,
    note: 'The refusal screen. This is the moat, so it gets its own shot.',
    async prepare(page) {
      await page.evaluate(() => window.scrollTo(0, 0));
      await sleep(700);
      return { x: 0, y: 0, width: W, height: H };
    },
    async perform() { await sleep(6000); },
  },
  {
    name: 'live-open',
    path: '/scan/live?id=00000000-0000-4000-8000-000000000000',
    seconds: 9,
    note: 'The scan page as it opens. See marketing/video/README.md — the stages '
        + 'only advance against a real backend, so this shot is the opening only.',
    async prepare(page) {
      await sleep(900);
      return { x: 0, y: 0, width: W, height: H };
    },
    async perform() { await sleep(7000); },
  },
];

// ------------------------------------------------------------------ run

const shots = ONLY ? SHOTS.filter((s) => ONLY.includes(s.name)) : SHOTS;
if (!shots.length) { console.error(`No shots matched --only ${args.get('only')}`); exit(1); }

mkdirSync(OUT, { recursive: true });
const raw = join(OUT, '.raw');
rmSync(raw, { recursive: true, force: true });
mkdirSync(raw, { recursive: true });

const browser = await chromium.launch({ args: ['--no-sandbox'] });
const manifest = [];
const failures = [];

for (const shot of shots) {
  const context = await browser.newContext({
    viewport: { width: W, height: H },
    deviceScaleFactor: 1,
    // globals.css kills every animation under this preference, and the film is
    // mostly animation. Asking for it explicitly means a machine configured to
    // reduce motion produces a flat film instead of a wrong one.
    reducedMotion: 'no-preference',
    recordVideo: { dir: raw, size: { width: W, height: H } },
  });

  // Third-party requests (the scanned site's own favicon in SitePanel) hang when
  // there is no route to them, and they are never in frame. Refusing them keeps
  // the recording deterministic and is why this file never waits on networkidle.
  await context.route('**/*', (route) => {
    const url = route.request().url();
    const local = url.startsWith(BASE) || url.startsWith('data:') || url.startsWith('blob:');
    return local ? route.continue() : route.abort();
  });

  const page = await context.newPage();
  let crop = { x: 0, y: 0, width: W, height: H };
  try {
    await page.goto(BASE + shot.path, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForLoadState('load', { timeout: 20000 }).catch(() => {});
    await page.evaluate(() => document.fonts?.ready).catch(() => {});
    crop = (await shot.prepare(page)) ?? crop;
    await shot.perform(page);
    console.log(`  recorded  ${shot.name}`);
  } catch (error) {
    failures.push(`${shot.name}: ${String(error).split('\n')[0]}`);
    console.error(`  FAILED    ${shot.name}  ${String(error).split('\n')[0]}`);
  }

  const video = page.video();
  await context.close();                       // flushes the webm
  const webm = video ? await video.path() : null;
  if (!webm) continue;

  const dest = join(OUT, `${shot.name}.mp4`);
  execFileSync(ffmpeg, [
    '-y', '-loglevel', 'error',
    '-i', webm,
    '-vf', `crop=${crop.width}:${crop.height}:${crop.x}:${crop.y},fps=${FPS}`,
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '17',
    '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
    dest,
  ]);
  manifest.push({ name: shot.name, path: shot.path, file: `${shot.name}.mp4`, crop, note: shot.note });
}

await browser.close();
rmSync(raw, { recursive: true, force: true });

// A --only run re-records part of the set, so the manifest is merged rather than
// replaced. Otherwise re-shooting one frame would orphan the other eight.
const manifestPath = join(OUT, 'shots.json');
const previous = existsSync(manifestPath)
  ? (JSON.parse(readFileSync(manifestPath, 'utf8')).shots ?? [])
  : [];
const merged = [...previous.filter((p) => !manifest.some((m) => m.name === p.name)), ...manifest]
  .sort((a, b) => SHOTS.findIndex((s) => s.name === a.name) - SHOTS.findIndex((s) => s.name === b.name));
writeFileSync(manifestPath, JSON.stringify({ base: BASE, fps: FPS, shots: merged }, null, 2) + '\n');

console.log(`\n${manifest.length} shot(s) -> ${OUT}`);
for (const f of failures) console.error(`  ! ${f}`);
if (failures.length) exit(1);
