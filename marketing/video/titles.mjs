/**
 * The title cards, drawn in the product's own design system.
 *
 * Not an image model and not a video tool's approximation of our type: this
 * opens a real Chromium, imports the real apps/web/app/tokens.css and embeds
 * the real TTFs checked in at apps/web/assets/fonts, and records the result.
 * The consequence is that a title card and a screen recording of the app are
 * the same pixels — same Familjen Grotesk, same #111318 border, same hard
 * offset shadow with no blur — because they came out of the same renderer.
 *
 * marketing/assets/build.mjs does exactly this for the still graphics. This is
 * that idea with a clock attached.
 *
 * Usage:
 *   node marketing/video/titles.mjs
 *   node marketing/video/titles.mjs --only split-statement
 */

import { mkdirSync, readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { argv, exit } from 'node:process';

// Same resolution dance as marketing/assets/build.mjs: this directory has no
// node_modules of its own, and both dependencies live in the tools workspace.
const from = (rel) => pathToFileURL(join(dirname(fileURLToPath(import.meta.url)), rel)).href;
const { chromium } = await import('playwright')
  .catch(() => import(from('../../tools/node_modules/playwright/index.mjs')));
const ffmpeg = (await import('ffmpeg-static')
  .catch(() => import(from('../../tools/node_modules/ffmpeg-static/index.js')))).default;

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const OUT = join(HERE, 'titles');
const FONTS = join(REPO, 'apps', 'web', 'assets', 'fonts');

const args = new Map();
{
  const tokens = argv.slice(2).filter((t) => t !== '--');
  for (let i = 0; i < tokens.length; i += 1) {
    const t = tokens[i];
    if (!t?.startsWith('--')) continue;
    const next = tokens[i + 1];
    if (next && !next.startsWith('--')) { args.set(t.slice(2), next); i += 1; }
    else args.set(t.slice(2), 'true');
  }
}
const ONLY = args.get('only')?.split(',').map((s) => s.trim()).filter(Boolean) ?? null;

const W = 1920;
const H = 1080;
const FPS = 30;

// ------------------------------------------------------------------ tokens

/** Read the palette out of tokens.css rather than restating it. marketing/assets/
 *  build.mjs keeps its own copy and it has already drifted — its green and its
 *  greys predate the WCAG darkening — so this file refuses to hold a second one. */
function readTokens() {
  const css = readFileSync(join(REPO, 'apps', 'web', 'app', 'tokens.css'), 'utf8');
  const out = {};
  for (const [, name, value] of css.matchAll(/--color-([a-z0-9-]+):\s*(#[0-9A-Fa-f]{3,8})/g)) {
    out[name] = value;
  }
  const need = ['ink', 'canvas', 'surface', 'violet', 'lime', 'coral', 'amber'];
  const missing = need.filter((n) => !out[n]);
  if (missing.length) throw new Error(`tokens.css is missing ${missing.join(', ')}`);
  return out;
}

const C = readTokens();

const face = (family, file, weight) =>
  `@font-face{font-family:'${family}';font-weight:${weight};font-style:normal;src:url(data:font/ttf;base64,${
    readFileSync(join(FONTS, file)).toString('base64')
  }) format('truetype');font-display:block;}`;

const FONT_CSS = [
  face('Familjen Grotesk', 'FamiljenGrotesk-Bold.ttf', 700),
  face('Public Sans', 'PublicSans-Regular.ttf', 400),
  face('JetBrains Mono', 'JetBrainsMono-Regular.ttf', 400),
].join('\n');

// ------------------------------------------------------------------ chrome

/** The house shell: 2px ink border, hard offset shadow, no blur anywhere.
 *  Every rule here is quoted from CLAUDE.md's design tokens section. */
const BASE_CSS = `
*{margin:0;padding:0;box-sizing:border-box;}
html,body{width:${W}px;height:${H}px;overflow:hidden;background:${C.canvas};}
body{font-family:'Public Sans',system-ui,sans-serif;color:${C.ink};
     -webkit-font-smoothing:antialiased;}
.stage{position:relative;width:${W}px;height:${H}px;display:flex;
       align-items:center;justify-content:center;}
.display{font-family:'Familjen Grotesk',sans-serif;font-weight:700;
         letter-spacing:-0.035em;line-height:1.02;}
.mono{font-family:'JetBrains Mono',ui-monospace,monospace;}
.eyebrow{font-family:'JetBrains Mono',ui-monospace,monospace;font-size:22px;
         letter-spacing:0.12em;text-transform:uppercase;}
.edge{border:2px solid ${C.ink};}
.hard-5{box-shadow:5px 5px 0 ${C.ink};}
.hard-7{box-shadow:7px 7px 0 ${C.ink};}
/* The status code plates. The one composition the whole campaign is built on. */
.code{display:flex;align-items:center;justify-content:center;
      font-family:'JetBrains Mono',monospace;font-weight:400;
      width:300px;height:190px;border-radius:20px;font-size:104px;
      border:2px solid ${C.ink};box-shadow:7px 7px 0 ${C.ink};color:${C.ink};}
.code.ok{background:${C.lime};}
.code.no{background:${C.coral};}
/* Motion is declared here, and the reduced-motion block below cannot miss it
   because every animation in this file is in this one list. */
@keyframes rise{from{opacity:0;transform:translateY(14px);}to{opacity:1;transform:none;}}
@keyframes pop{from{opacity:0;transform:translateY(10px) scale(.98);}to{opacity:1;transform:none;}}
@keyframes caret{0%,49%{opacity:1;}50%,100%{opacity:0;}}
.rise{animation:rise .52s ease both;}
.pop{animation:pop .42s ease both;}
.caret{display:inline-block;width:14px;height:52px;background:${C.violet};
       vertical-align:-6px;margin-left:10px;animation:caret 1.1s step-end infinite;}
@media (prefers-reduced-motion:reduce){
  .rise,.pop{animation-duration:.001ms;}
  .caret{animation:none;opacity:1;}
}
`;

// ------------------------------------------------------------------ the cards

/** Each card is html + how long to hold it. The copy is quoted from
 *  marketing/taglines.md's cleared headline slot and apps/web/lib/copy.ts;
 *  nothing here is newly written marketing language. */
const CARDS = [
  {
    name: 'split-statement',
    seconds: 5,
    note: 'The nine words the campaign is built on. taglines.md, headline slot 1.',
    html: `
      <div class="stage" style="flex-direction:column;gap:64px;">
        <div style="display:flex;gap:48px;align-items:center;">
          <div class="code ok rise" style="animation-delay:.10s">200</div>
          <div class="mono rise" style="font-size:30px;color:${C.subtle ?? C.ink};animation-delay:.30s">vs</div>
          <div class="code no rise" style="animation-delay:.45s">403</div>
        </div>
        <div class="display rise" style="animation-delay:.85s;font-size:92px;text-align:center;max-width:1450px;">
          Same URL. Same second.<br>Nobody decided that.
        </div>
      </div>`,
  },
  {
    name: 'analytics',
    seconds: 5,
    note: 'copy.ts whyPoints[0], said the way marketing/README.md says it.',
    html: `
      <div class="stage">
        <div style="max-width:1420px;">
          <div class="eyebrow rise" style="color:${C.violet};animation-delay:.05s">The part you cannot see</div>
          <div class="display rise" style="animation-delay:.30s;font-size:88px;margin-top:34px;">
            You will not find this in your analytics.
          </div>
          <div class="rise" style="animation-delay:.70s;font-size:38px;line-height:1.45;margin-top:34px;color:${C.body ?? C.ink};max-width:1180px;">
            A request that was refused never became a session.
          </div>
        </div>
      </div>`,
  },
  {
    name: 'published',
    seconds: 5,
    note: 'The moat, stated plainly. marketing/README.md, "two things we say in every register".',
    html: `
      <div class="stage">
        <div style="max-width:1440px;text-align:center;">
          <div class="display rise" style="animation-delay:.10s;font-size:86px;">
            Twenty-one checks. Six categories.<br>Every weight published.
          </div>
          <div class="rise" style="animation-delay:.60s;font-size:36px;margin-top:38px;color:${C.body ?? C.ink};">
            So you can argue with the score instead of believing it.
          </div>
        </div>
      </div>`,
  },
  {
    name: 'refusal',
    seconds: 5,
    note: 'The other half of the moat. Coral, because it is the refusal.',
    html: `
      <div class="stage">
        <div class="edge hard-7 pop" style="background:${C.coral};border-radius:24px;padding:70px 84px;max-width:1500px;">
          <div class="eyebrow" style="color:${C.ink};opacity:.72;">We never work around a block</div>
          <div class="display" style="font-size:78px;margin-top:28px;color:${C.ink};">
            If your site refuses us, the page says your site refused us.
          </div>
        </div>
      </div>`,
  },
  {
    name: 'offer',
    seconds: 5,
    note: 'taglines.md, cleared sub-line. The only card that names a price.',
    html: `
      <div class="stage">
        <div style="max-width:1420px;text-align:center;">
          <div class="display rise" style="animation-delay:.10s;font-size:88px;">
            The diagnosis is free<br>and fully visible.
          </div>
          <div class="rise" style="animation-delay:.62s;font-size:44px;margin-top:40px;">
            The files that fix it are
            <span class="edge" style="background:${C.lime};border-radius:12px;padding:6px 18px;box-shadow:4px 4px 0 ${C.ink};">$15</span>.
          </div>
        </div>
      </div>`,
  },
  {
    name: 'endcard',
    seconds: 6,
    note: 'The house line, and the only call to action the campaign allows: a URL box.',
    html: `
      <div class="stage" style="flex-direction:column;gap:56px;">
        <div class="display rise" style="animation-delay:.10s;font-size:112px;">Are you BotReady?</div>
        <div class="edge hard-5 rise" style="animation-delay:.45s;background:${C.surface};border-radius:16px;
             padding:26px 34px;min-width:760px;display:flex;align-items:center;justify-content:space-between;gap:40px;">
          <span class="mono" style="font-size:40px;color:${C.ink};">botready.dev<span class="caret"></span></span>
          <span class="edge" style="background:${C.ink};color:#fff;border-radius:10px;padding:16px 28px;
                font-size:26px;font-weight:700;box-shadow:2px 2px 0 ${C.ink};">Run the check</span>
        </div>
        <div class="mono rise" style="animation-delay:.80s;font-size:24px;color:${C.subtle ?? C.ink};">
          free · no account · ~30 seconds
        </div>
      </div>`,
  },
];

// ------------------------------------------------------------------ render

const cards = ONLY ? CARDS.filter((c) => ONLY.includes(c.name)) : CARDS;
if (!cards.length) { console.error(`No cards matched --only ${args.get('only')}`); exit(1); }

mkdirSync(OUT, { recursive: true });
const raw = join(OUT, '.raw');
rmSync(raw, { recursive: true, force: true });
mkdirSync(raw, { recursive: true });

const browser = await chromium.launch({ args: ['--no-sandbox'] });
const manifest = [];

for (const card of cards) {
  const context = await browser.newContext({
    viewport: { width: W, height: H },
    reducedMotion: 'no-preference',
    recordVideo: { dir: raw, size: { width: W, height: H } },
  });
  const page = await context.newPage();
  await page.setContent(
    `<!doctype html><meta charset="utf-8"><style>${FONT_CSS}\n${BASE_CSS}</style>${card.html}`,
    { waitUntil: 'load' },
  );
  await page.evaluate(() => document.fonts.ready);
  await new Promise((r) => setTimeout(r, card.seconds * 1000));

  const video = page.video();
  await context.close();
  const webm = video ? await video.path() : null;
  if (!webm) continue;

  const dest = join(OUT, `${card.name}.mp4`);
  execFileSync(ffmpeg, [
    '-y', '-loglevel', 'error', '-i', webm,
    '-vf', `fps=${FPS}`,
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '17',
    '-pix_fmt', 'yuv420p', '-movflags', '+faststart', dest,
  ]);
  manifest.push({ name: card.name, file: `${card.name}.mp4`, seconds: card.seconds, note: card.note });
  console.log(`  drew  ${card.name}`);
}

await browser.close();
rmSync(raw, { recursive: true, force: true });

const path = join(OUT, 'titles.json');
const previous = existsSync(path) ? (JSON.parse(readFileSync(path, 'utf8')).cards ?? []) : [];
const merged = [...previous.filter((p) => !manifest.some((m) => m.name === p.name)), ...manifest]
  .sort((a, b) => CARDS.findIndex((c) => c.name === a.name) - CARDS.findIndex((c) => c.name === b.name));
writeFileSync(path, JSON.stringify({ fps: FPS, tokens: C, cards: merged }, null, 2) + '\n');

console.log(`\n${manifest.length} card(s) -> ${OUT}`);
