/**
 * The short. A UI-style launch film in the manner of the reference: one small
 * real interface card floating in a lot of empty space, a caption under it with
 * a single accent word, a cursor that moves and clicks, and a light half that
 * flips to dark before the end card.
 *
 * Rendered rather than generated. Every card is a real screenshot of the real
 * app, pulled out of marketing/video/footage by the same crops
 * tools/capture-footage.mjs recorded, and the type is the checked-in TTFs at
 * the real token colours. Nothing here is an image model's idea of an
 * interface, which is the same rule the rest of marketing/ runs on.
 *
 * Frames are drawn one at a time from a pure function of t and stitched at
 * 60fps, so the motion is smooth and the render is deterministic — a recording
 * would come out at whatever rate the browser felt like.
 *
 *   node marketing/video/ui-short.mjs
 */

import { mkdirSync, readFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const from = (rel) => pathToFileURL(join(HERE, rel)).href;
const { chromium } = await import('playwright')
  .catch(() => import(from('../../tools/node_modules/playwright/index.mjs')));
const ffmpeg = (await import('ffmpeg-static')
  .catch(() => import(from('../../tools/node_modules/ffmpeg-static/index.js')))).default;

const W = 1920, H = 1080, FPS = 60;
const OUT = join(HERE, 'out');
const FRAMES = join(OUT, '.frames');

// tokens.css, read rather than restated.
const css = readFileSync(join(REPO, 'apps/web/app/tokens.css'), 'utf8');
const tok = (n) => (css.match(new RegExp(`--color-${n}:\\s*(#[0-9A-Fa-f]{3,8})`)) ?? [])[1];
const C = { ink: tok('ink'), canvas: tok('canvas'), violet: tok('violet'),
            lime: tok('lime'), coral: tok('coral'), subtle: tok('subtle'), white: '#FFFFFF' };

const b64 = (p) => readFileSync(p).toString('base64');
const font = (fam, file, w) =>
  `@font-face{font-family:'${fam}';font-weight:${w};src:url(data:font/ttf;base64,${
    b64(join(REPO, 'apps/web/assets/fonts', file))}) format('truetype');font-display:block}`;
const card = (n) => `data:image/png;base64,${b64(join(HERE, 'cards', `${n}.png`))}`;

/** eyebrow, card, caption, accent, cursor path, dark. Each beat is 3.6s. */
const BEATS = [
  { eyebrow: 'one request, five clients', img: 'split',   w: 900,
    plain: 'Same second.', accent: 'Two answers.', cursor: null },
  { eyebrow: 'what each client got',     img: 'clients', w: 400,
    plain: 'One got the page.', accent: 'Four did not.', cursor: [180, 250] },
  { eyebrow: 'twenty-one checks',        img: 'score',   w: 700,
    plain: 'A grade,', accent: 'and the numbers behind it.', cursor: null },
  { eyebrow: 'the files that fix it',    img: 'fixpack', w: 760,
    plain: 'Four files.', accent: 'From your own scan.', cursor: [120, 26] },
  // The one dark beat, and it is the refusal — coral on ink is the only pairing
  // in the palette that earns an inversion.
  { eyebrow: 'we never work around a block', img: 'blocked', w: 860, dark: true,
    plain: 'If your site refuses us,', accent: 'the page says so.', cursor: null },
];
const BEAT = 3.6;
const END = 4.4;
const TOTAL = BEATS.length * BEAT + END;

const page_html = `<style>
${font('Familjen Grotesk','FamiljenGrotesk-Bold.ttf',700)}
${font('Public Sans','PublicSans-Regular.ttf',400)}
${font('JetBrains Mono','JetBrainsMono-Regular.ttf',400)}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:${W}px;height:${H}px;overflow:hidden;background:${C.canvas}}
#bg{position:absolute;inset:0;background:${C.canvas}}
.wrap{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:0}
.eyebrow{font-family:'JetBrains Mono',monospace;font-size:15px;letter-spacing:.16em;
  text-transform:uppercase;color:${C.subtle};margin-bottom:34px}
.shot{display:block;border-radius:14px}
.cap{font-family:'Familjen Grotesk',sans-serif;font-weight:700;letter-spacing:-.035em;
  font-size:60px;margin-top:64px;white-space:nowrap}
.accent{color:${C.coral}}
#cursor{position:absolute;width:26px;height:26px;pointer-events:none}
#end{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center}
.mark{display:flex;align-items:center;gap:22px}
.wordmark{font-family:'Familjen Grotesk',sans-serif;font-weight:700;font-size:96px;letter-spacing:-.035em}
.tag{font-family:'Public Sans',sans-serif;font-size:30px;margin-top:26px}
.chip{margin-top:52px;font-family:'JetBrains Mono',monospace;font-size:23px;padding:16px 26px;
  border-radius:12px;border:2px solid ${C.ink};background:${C.white};box-shadow:4px 4px 0 ${C.ink}}
</style>
<div id="bg"></div>
<div class="wrap" id="stage">
  <div class="eyebrow" id="eyebrow"></div>
  <img class="shot" id="shot">
  <div class="cap" id="cap"></div>
</div>
<div id="end" style="opacity:0">
  <div class="mark">
    <svg width="104" height="104" viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="${C.violet}"/>
      <g transform="translate(16 16) scale(.92) translate(-16 -16.3)" fill="none" stroke="${C.lime}"
         stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round">
        <path d="M10.4 7.6V24.4"/><path d="M10.4 19.4a5.6 5.6 0 1 0 11.2 0 5.6 5.6 0 1 0-11.2 0"/></g></svg>
    <div class="wordmark" id="wm">BotReady</div>
  </div>
  <div class="tag" id="tag">Get found by AI agents.</div>
  <div class="chip" id="chip">botready.dev</div>
</div>
<svg id="cursor" viewBox="0 0 24 24" style="opacity:0">
  <path d="M4 2l14 9-6 1.4L9.4 19z" fill="${C.white}" stroke="${C.ink}" stroke-width="1.8" stroke-linejoin="round"/>
</svg>`;

const browser = await chromium.launch({ args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
await page.setContent(page_html, { waitUntil: 'load' });
await page.evaluate(() => document.fonts.ready);

await page.evaluate(({ BEATS, BEAT, END, C, cards }) => {
  const $ = (id) => document.getElementById(id);
  const ease = (x) => 1 - Math.pow(1 - x, 3);
  const clamp = (x) => Math.max(0, Math.min(1, x));

  window.draw = (t) => {
    const i = Math.min(BEATS.length - 1, Math.floor(t / BEAT));
    const inEnd = t >= BEATS.length * BEAT;
    const b = BEATS[i];
    const local = t - i * BEAT;

    $('end').style.opacity = inEnd ? String(ease(clamp((t - BEATS.length * BEAT) / 0.55))) : '0';
    $('stage').style.opacity = inEnd ? '0' : '1';
    document.getElementById('bg').style.background = (b.dark && !inEnd) ? C.ink : C.canvas;

    if (inEnd) {
      const e = t - BEATS.length * BEAT;
      $('wm').style.color = C.ink; $('tag').style.color = C.ink;
      $('chip').style.opacity = String(ease(clamp((e - 0.9) / 0.5)));
      $('chip').style.transform = `translateY(${(1 - ease(clamp((e - 0.9) / 0.5))) * 12}px)`;
      $('cursor').style.opacity = '0';
      return;
    }

    // Card and caption rise in, then hold. The card leads the words by 180ms.
    const cardIn = ease(clamp(local / 0.62));
    const capIn = ease(clamp((local - 0.18) / 0.62));
    const out = ease(clamp((local - (BEAT - 0.34)) / 0.34));

    $('eyebrow').textContent = b.eyebrow;
    $('eyebrow').style.color = b.dark ? '#8A929B' : C.subtle;
    $('eyebrow').style.opacity = String(cardIn * (1 - out));

    const img = $('shot');
    img.src = cards[b.img];
    img.style.width = b.w + 'px';
    img.style.opacity = String(cardIn * (1 - out));
    img.style.transform = `translateY(${(1 - cardIn) * 22 - out * 14}px) scale(${0.985 + cardIn * 0.015})`;
    img.style.boxShadow = b.dark ? '6px 6px 0 #000' : `6px 6px 0 ${C.ink}`;

    const cap = $('cap');
    cap.innerHTML = `<span>${b.plain}</span> <span class="accent">${b.accent}</span>`;
    cap.style.color = b.dark ? '#F2F4F7' : C.ink;
    cap.style.opacity = String(capIn * (1 - out));
    cap.style.transform = `translateY(${(1 - capIn) * 16 - out * 10}px)`;

    // The cursor drifts to the card and settles. Only on the beats that have one.
    const cur = $('cursor');
    if (b.cursor) {
      const p = ease(clamp((local - 0.5) / 1.5));
      const x = 1320 - p * (1320 - (960 - b.w / 2 + b.cursor[0]));
      const y = 820 - p * (820 - (400 + b.cursor[1]));
      cur.style.opacity = String(clamp((local - 0.45) / 0.3) * (1 - out));
      cur.style.transform = `translate(${x}px, ${y}px) scale(${p > 0.94 ? 0.88 : 1})`;
    } else {
      cur.style.opacity = '0';
    }
  };
}, { BEATS, BEAT, END, C, cards: Object.fromEntries(BEATS.map((b) => [b.img, card(b.img)])) });

rmSync(FRAMES, { recursive: true, force: true });
mkdirSync(FRAMES, { recursive: true });
mkdirSync(OUT, { recursive: true });

const total = Math.round(TOTAL * FPS);
for (let f = 0; f < total; f += 1) {
  await page.evaluate((t) => window.draw(t), f / FPS);
  await page.screenshot({ path: join(FRAMES, String(f).padStart(5, '0') + '.png') });
  if (f % 120 === 0) console.log(`  ${f}/${total}`);
}
await browser.close();

const dest = join(OUT, 'ui-short-16x9.mp4');
execFileSync(ffmpeg, ['-y', '-loglevel', 'error', '-framerate', String(FPS),
  '-i', join(FRAMES, '%05d.png'), '-c:v', 'libx264', '-preset', 'slow', '-crf', '16',
  '-pix_fmt', 'yuv420p', '-movflags', '+faststart', dest]);
rmSync(FRAMES, { recursive: true, force: true });
console.log(`\n${TOTAL.toFixed(1)}s @ ${FPS}fps -> ${dest}`);
