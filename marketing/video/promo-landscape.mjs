/**
 * The landscape promo. 35s, 1920x1080, in the manner of the reference: real
 * product panels floating on a soft drifting gradient, two big type beats, the
 * wordmark, and an end card.
 *
 * Rendered rather than generated, for the same reason as ui-short.mjs and for
 * one more. Every panel here is a 2x screenshot of the running app taken by
 * tools/capture-cards.mjs. A generative video model cannot draw legible UI, and
 * if it could, the result would be a picture of a scan nobody ran — which is
 * the one thing marketing/README.md forbids outright. So the pixels are real
 * and the motion is ours.
 *
 * Frames are a pure function of t, drawn one at a time and stitched at 60fps,
 * so the render is deterministic and the motion does not depend on how fast the
 * browser felt like painting.
 *
 *   node marketing/video/promo-landscape.mjs
 */

import { mkdirSync, readFileSync, rmSync, existsSync } from 'node:fs';
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
const FRAMES = join(OUT, '.promo-frames');

// tokens.css, read rather than restated.
const css = readFileSync(join(REPO, 'apps/web/app/tokens.css'), 'utf8');
const tok = (n) => (css.match(new RegExp(`--color-${n}:\\s*(#[0-9A-Fa-f]{3,8})`)) ?? [])[1];
const C = {
  ink: tok('ink') ?? '#111318',
  canvas: tok('canvas') ?? '#EDEBFB',
  violet: tok('violet') ?? '#4B44F5',
  lime: tok('lime') ?? '#C6F53C',
  coral: tok('coral') ?? '#FF6B5A',
  subtle: tok('subtle') ?? '#5B6070',
  white: '#FFFFFF',
};

const b64 = (p) => readFileSync(p).toString('base64');
const font = (fam, file, w) =>
  `@font-face{font-family:'${fam}';font-weight:${w};src:url(data:font/ttf;base64,${
    b64(join(REPO, 'apps/web/assets/fonts', file))}) format('truetype');font-display:block}`;

/** Cards are 2x captures, so `half` is their 1:1 display width. */
const CARDS = ['urlbox', 'assistant', 'agents', 'blocked403', 'fixfiles', 'shortlist',
               'whateach', 'retrieve'];
const src = {};
for (const n of CARDS) {
  const p = join(HERE, 'cards', `${n}.png`);
  if (!existsSync(p)) throw new Error(`missing card: ${p} — run tools/capture-cards.mjs first`);
  src[n] = `data:image/png;base64,${b64(p)}`;
}

const TOTAL = 35.0;

const html = `<style>
${font('Familjen Grotesk', 'FamiljenGrotesk-Bold.ttf', 700)}
${font('Public Sans', 'PublicSans-Regular.ttf', 400)}
${font('JetBrains Mono', 'JetBrainsMono-Regular.ttf', 400)}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:${W}px;height:${H}px;overflow:hidden;
  background:linear-gradient(160deg,#FFFFFF 0%,${C.canvas} 62%,#FFFFFF 100%)}
#wash{position:absolute;inset:-25%;filter:blur(110px);opacity:.62}
.blob{position:absolute;border-radius:50%}
#stage{position:absolute;inset:0}
.card{position:absolute;display:block;border-radius:16px;will-change:transform,opacity}
#type{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;
  justify-content:center;pointer-events:none}
.line{font-family:'Familjen Grotesk',sans-serif;font-weight:700;letter-spacing:-.035em;
  font-size:104px;line-height:1.04;color:${C.ink};white-space:nowrap}
.line .acc{color:${C.coral}}
#eyebrow{position:absolute;left:0;right:0;top:96px;text-align:center;
  font-family:'JetBrains Mono',monospace;font-size:15px;letter-spacing:.16em;
  text-transform:uppercase;color:${C.subtle}}
#mark{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center}
.row{display:flex;align-items:center;gap:26px}
.wm{font-family:'Familjen Grotesk',sans-serif;font-weight:700;font-size:110px;
  letter-spacing:-.035em;color:${C.ink}}
.tag{font-family:'Public Sans',sans-serif;font-size:32px;color:${C.ink};margin-top:30px}
.chip{margin-top:46px;font-family:'JetBrains Mono',monospace;font-size:24px;padding:16px 28px;
  border-radius:12px;border:2px solid ${C.ink};background:${C.white};box-shadow:4px 4px 0 ${C.ink}}
</style>
<div id="wash">
  <div class="blob" id="b1"></div>
  <div class="blob" id="b2"></div>
  <div class="blob" id="b3"></div>
</div>
<div id="stage">
  ${CARDS.map((n) => `<img class="card" id="c_${n}" src="${src[n]}">`).join('\n  ')}
</div>
<div id="eyebrow"></div>
<div id="type"><div class="line" id="l1"></div><div class="line" id="l2"></div></div>
<div id="mark" style="opacity:0">
  <div class="row">
    <svg width="118" height="118" viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="${C.violet}"/>
      <g transform="translate(16 16) scale(.92) translate(-16 -16.3)" fill="none" stroke="${C.lime}"
         stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round">
        <path d="M10.4 7.6V24.4"/><path d="M10.4 19.4a5.6 5.6 0 1 0 11.2 0 5.6 5.6 0 1 0-11.2 0"/></g></svg>
    <div class="wm">BotReady</div>
  </div>
  <div class="tag" id="tag"></div>
  <div class="chip" id="chip">botready.dev</div>
</div>`;

const browser = await chromium.launch({ args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
await page.setContent(html, { waitUntil: 'load' });
await page.evaluate(() => document.fonts.ready);

await page.evaluate(({ W, H, C, TOTAL }) => {
  const $ = (id) => document.getElementById(id);
  const clamp = (x) => Math.max(0, Math.min(1, x));
  const ease = (x) => 1 - Math.pow(1 - clamp(x), 3);

  /** A card's natural 1:1 width: the 2x capture shown at half size. */
  const NAT = {
    urlbox: 640, assistant: 462, agents: 1148, blocked403: 371,
    fixfiles: 371, shortlist: 371, whateach: 340, retrieve: 702,
  };

  /** window(t, a, b, fade) -> 0..1 presence with an eased edge on both sides. */
  const win = (t, a, b, f = 0.5) => Math.min(ease((t - a) / f), ease((b - t) / f));

  /**
   * Place a card. `scale` multiplies its natural width; going far above 1.15
   * starts to soften, since the source is only 2x.
   */
  const put = (name, { x, y, scale = 1, alpha = 1, rise = 0, rot = 0, z = 1 }) => {
    const el = $('c_' + name);
    const w = NAT[name] * scale;
    el.style.width = w + 'px';
    el.style.opacity = String(clamp(alpha));
    el.style.zIndex = String(z);
    el.style.boxShadow = alpha > 0.02 ? `5px 5px 0 ${C.ink}` : 'none';
    // translate is from the element's own top-left, so centre it by hand.
    el.style.transform =
      `translate(${x - w / 2}px, ${y + rise}px) rotate(${rot}deg)`;
    el.style.transformOrigin = 'center center';
  };
  const hide = (name) => { const e = $('c_' + name); e.style.opacity = '0'; e.style.boxShadow = 'none'; };

  window.draw = (t) => {
    // --- background: three slow washes, so the frame is never dead ---------
    const drift = (i, sx, sy, r, col) => {
      const p = t / TOTAL;
      const b = $('b' + i);
      b.style.width = r + 'px'; b.style.height = r + 'px';
      b.style.background = col;
      b.style.left = (sx + Math.sin(p * Math.PI * 2 + i) * 130) + 'px';
      b.style.top = (sy + Math.cos(p * Math.PI * 2 + i * 1.7) * 110) + 'px';
    };
    drift(1, 100, -80, 1250, C.violet + '30');
    drift(2, 1220, 300, 1050, C.coral + '2C');
    drift(3, 620, 700, 900, C.violet + '18');

    for (const n of ['urlbox', 'assistant', 'agents', 'blocked403', 'fixfiles',
                     'shortlist', 'whateach', 'retrieve']) hide(n);
    $('l1').style.opacity = '0'; $('l2').style.opacity = '0';
    $('eyebrow').style.opacity = '0';
    $('mark').style.opacity = '0';

    const eyebrow = (text, a) => {
      const e = $('eyebrow'); e.textContent = text; e.style.opacity = String(clamp(a));
    };
    const say = (a, b, alpha, dy = 0) => {
      $('l1').innerHTML = a; $('l2').innerHTML = b;
      for (const id of ['l1', 'l2']) {
        const e = $(id);
        e.style.opacity = String(clamp(alpha));
        e.style.transform = `translateY(${dy}px)`;
      }
    };

    // ================= 1. the box, alone (0 - 3.4) ========================
    if (t < 3.5) {
      const a = ease(t / 0.9);
      eyebrow('one url', a * ease((t - 0.35) / 0.7));
      put('urlbox', { x: W / 2, y: H / 2 - 130, scale: 1.55, alpha: a, rise: (1 - a) * 26 });
    }

    // ============ 2. what the assistant answers (3.1 - 7.6) ===============
    if (t >= 3.0 && t < 7.8) {
      const p = win(t, 3.1, 7.6, 0.55);
      const q = ease((t - 3.3) / 0.8);
      eyebrow('what your customers get back', p);
      put('urlbox', { x: W / 2 - 470, y: H / 2 - 330, scale: 1.18, alpha: p, z: 2 });
      put('shortlist', {
        x: W / 2 - 470, y: H / 2 - 30, scale: 1.30,
        alpha: p * ease((t - 4.4) / 0.8), rise: (1 - ease((t - 4.4) / 0.8)) * 28, rot: -0.7, z: 2,
      });
      put('assistant', {
        x: W / 2 + 420, y: H / 2 - 300, scale: 1.55,
        alpha: p * q, rise: (1 - q) * 36, rot: 0.7, z: 3,
      });
    }

    // ===== 3. the finding: 200 for one, 403 for four (7.4 - 12.6) =========
    if (t >= 7.3 && t < 12.8) {
      const p = win(t, 7.4, 12.6, 0.55);
      const q = ease((t - 7.6) / 0.9);
      eyebrow('same url, same second, same ip', p);
      put('agents', {
        x: W / 2, y: H / 2 - 330, scale: 1.42,
        alpha: p * q, rise: (1 - q) * 42, z: 4,
      });
      const r = ease((t - 8.9) / 0.9);
      put('blocked403', {
        x: W / 2 + 620, y: H / 2 + 220, scale: 0.80,
        alpha: p * r, rise: (1 - r) * 30, rot: 0.9, z: 3,
      });
    }

    // ================ 4. the type beat (12.4 - 16.8) ======================
    if (t >= 12.4 && t < 17.0) {
      const p = win(t, 12.5, 16.8, 0.5);
      const second = ease((t - 14.1) / 0.6);
      say('Your site is fine.',
          'Your site is also <span class="acc">invisible</span>.',
          p, (1 - ease((t - 12.6) / 0.7)) * 18);
      $('l2').style.opacity = String(p * second);
    }

    // ================ 5. the wordmark (16.6 - 19.4) =======================
    if (t >= 16.6 && t < 19.6) {
      const p = win(t, 16.7, 19.4, 0.45);
      $('mark').style.opacity = String(p);
      $('tag').textContent = '';
      $('chip').style.opacity = '0';
    }

    // ========== 6. the score, and what it costs (19.2 - 23.6) ============
    if (t >= 19.2 && t < 23.8) {
      const p = win(t, 19.3, 23.6, 0.5);
      const q = ease((t - 19.5) / 0.8);
      eyebrow('twenty-one checks, six categories', p);
      put('whateach', {
        x: W / 2 - 430, y: H / 2 - 330, scale: 1.55,
        alpha: p * q, rise: (1 - q) * 32, z: 4,
      });
      const r = ease((t - 20.5) / 0.9);
      put('retrieve', {
        x: W / 2 + 400, y: H / 2 - 180, scale: 1.20,
        alpha: p * r, rise: (1 - r) * 26, rot: 0.6, z: 3,
      });
    }

    // ======== 7. the drift grid: everything at once (23.4 - 28.8) =========
    if (t >= 23.4 && t < 29.0) {
      const p = win(t, 23.5, 28.8, 0.6);
      const d = (t - 23.5) * 15;          // slow upward parallax
      eyebrow('every check, with the evidence under it', p);
      const grid = [
        ['agents',     700,  120, 0.62, -1.0, 1.00],
        ['whateach',  1520,   90, 0.72,  1.2, 0.90],
        ['assistant',  270,  430, 0.70,  0.8, 0.95],
        ['shortlist', 1150,  560, 0.62,  1.1, 0.93],
        ['blocked403',1560,  720, 0.62, -0.9, 0.86],
        ['retrieve',   640,  530, 0.62,  0.7, 0.92],
        ['fixfiles',   250,  770, 0.62,  1.4, 0.88],
      ];
      grid.forEach(([n, x, y, s, rot, lag], i) => {
        const a = ease((t - 23.6 - i * 0.13) / 0.7);
        put(n, {
          x, y: y - d * lag, scale: s, alpha: p * a * 0.97,
          rise: (1 - a) * 34, rot, z: 2 + (i % 3),
        });
      });
    }

    // ============== 8. the files that fix it (28.6 - 32.0) ================
    if (t >= 28.6 && t < 32.2) {
      const p = win(t, 28.7, 32.0, 0.5);
      const q = ease((t - 28.9) / 0.8);
      eyebrow('the files that fix it', p);
      put('fixfiles', {
        x: W / 2, y: H / 2 - 380, scale: 1.75,
        alpha: p * q, rise: (1 - q) * 34, z: 5,
      });
      const r = ease((t - 29.9) / 0.7);
      say('', 'Four files. <span class="acc">From your own scan.</span>', p * r, 0);
      $('l1').style.opacity = '0';
      $('l2').style.fontSize = '56px';
      $('l2').style.transform = `translateY(${330 + (1 - r) * 14}px)`;
    }

    // ===================== 9. the end card (31.8 - 35) ====================
    if (t >= 31.8) {
      const p = ease((t - 31.9) / 0.6);
      $('mark').style.opacity = String(p);
      $('tag').textContent = 'The diagnosis is free. The files that fix it are $15.';
      const c = ease((t - 32.8) / 0.5);
      $('chip').style.opacity = String(c);
      $('chip').style.transform = `translateY(${(1 - c) * 12}px)`;
    }
  };
}, { W, H, C, TOTAL });

rmSync(FRAMES, { recursive: true, force: true });
mkdirSync(FRAMES, { recursive: true });
mkdirSync(OUT, { recursive: true });

const total = Math.round(TOTAL * FPS);
for (let f = 0; f < total; f += 1) {
  await page.evaluate((t) => window.draw(t), f / FPS);
  await page.screenshot({ path: join(FRAMES, String(f).padStart(5, '0') + '.png') });
  if (f % 180 === 0) console.log(`  ${f}/${total}`);
}
await browser.close();

const dest = join(OUT, 'promo-landscape-silent.mp4');
execFileSync(ffmpeg, ['-y', '-loglevel', 'error', '-framerate', String(FPS),
  '-i', join(FRAMES, '%05d.png'), '-c:v', 'libx264', '-preset', 'slow', '-crf', '16',
  '-pix_fmt', 'yuv420p', '-movflags', '+faststart', dest]);
rmSync(FRAMES, { recursive: true, force: true });
console.log(`\n${TOTAL.toFixed(1)}s @ ${FPS}fps -> ${dest}`);
