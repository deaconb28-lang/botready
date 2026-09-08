/**
 * Two redesigns of the corpus stat strip, drawn in a real Chromium from the
 * real tokens.css and the real TTFs, so the preview and the shipped component
 * are the same pixels rather than a near-match.
 *
 *   node tools/preview-corpus-strip.mjs
 */
import { chromium } from 'playwright';
import { readFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..');
const OUT = join(HERE, 'design-out');

const css = readFileSync(join(REPO, 'apps/web/app/tokens.css'), 'utf8');
const tok = (n) => (css.match(new RegExp(`--color-${n}:\\s*(#[0-9A-Fa-f]{3,8})`)) ?? [])[1];
const T = Object.fromEntries(['canvas', 'surface', 'surface-alt', 'ink', 'body', 'muted',
  'subtle-2', 'violet', 'lime', 'coral', 'coral-tint', 'coral-text', 'amber', 'amber-tint',
  'lime-tint', 'violet-tint'].map((n) => [n, tok(n)]));

const b64 = (p) => readFileSync(p).toString('base64');
const font = (fam, file, w) =>
  `@font-face{font-family:'${fam}';font-weight:${w};src:url(data:font/ttf;base64,${
    b64(join(REPO, 'apps/web/assets/fonts', file))}) format('truetype');font-display:block}`;

/** The figures from the element as briefed. Real ones come from the corpus. */
const D = { sites: 149, avg: 64, poorPct: 25, poorCount: 37, refused: 11 };

const base = `
${font('Familjen Grotesk', 'FamiljenGrotesk-Bold.ttf', 700)}
${font('Public Sans', 'PublicSans-Regular.ttf', 400)}
${font('JetBrains Mono', 'JetBrainsMono-Regular.ttf', 400)}
*{margin:0;padding:0;box-sizing:border-box}
body{background:${T.canvas};font-family:'Public Sans',sans-serif;color:${T.ink};padding:44px}
.edge{border:2px solid ${T.ink}}
.panel{background:${T.surface};border-radius:20px;box-shadow:5px 5px 0 ${T.ink};padding:34px 40px}
.eyebrow{font-family:'JetBrains Mono',monospace;font-size:11.5px;letter-spacing:.12em;
  text-transform:uppercase;color:${T['subtle-2']}}
.head{display:flex;align-items:baseline;justify-content:space-between;gap:24px}
.num{font-family:'Familjen Grotesk',sans-serif;font-weight:700;letter-spacing:-.035em;
  line-height:1;font-variant-numeric:proportional-nums}
.den{font-family:'Familjen Grotesk',sans-serif;font-weight:700;letter-spacing:-.03em;
  color:${T['subtle-2']}}
.lab{font-size:15.5px;color:${T.body};line-height:1.35}
.meter{height:10px;border-radius:99px;overflow:hidden;position:relative}
.meter i{display:block;height:100%;border-radius:99px}
.dot{width:9px;height:9px;border-radius:50%;display:inline-block;margin-right:8px;
  vertical-align:middle;border:1.5px solid ${T.ink}}
.link{font-family:'JetBrains Mono',monospace;font-size:12.5px;color:${T.violet};
  text-decoration:underline;text-underline-offset:3px}
`;

/* ------------------------------------------------------------------ variant A
   A KPI row, but every value now carries its denominator and a proportion mark,
   so the reader sees magnitude rather than parsing four bare numbers. Status
   colour maps to state instead of decorating two cells at random. */
const A = `<div class="panel edge" style="width:1560px">
  <div class="head">
    <span class="eyebrow">What we have found so far</span>
    <span class="eyebrow">${D.sites} sites &middot; 21 checks each</span>
  </div>
  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:44px;margin-top:30px">
    ${[
      { v: String(D.avg), d: ' / 100', lab: 'average score', pct: D.avg,
        fill: T.amber, track: T['amber-tint'], dot: T.amber },
      { v: '1 in 4', d: `  ${D.poorCount} of ${D.sites}`, lab: 'score a D or worse', pct: D.poorPct,
        fill: T.coral, track: T['coral-tint'], dot: T.coral },
      { v: String(D.refused), d: `  of ${D.sites}`, lab: 'refused our crawler outright', pct: 7.4,
        fill: T.coral, track: T['coral-tint'], dot: T.coral },
    ].map((s) => `
      <div>
        <div style="display:flex;align-items:baseline;gap:10px">
          <span class="num" style="font-size:62px">${s.v}</span>
          <span class="den" style="font-size:23px">${s.d}</span>
        </div>
        <div class="lab" style="margin-top:11px"><span class="dot" style="background:${s.dot}"></span>${s.lab}</div>
        <div class="meter edge" style="background:${s.track};margin-top:16px">
          <i style="width:${s.pct}%;background:${s.fill}"></i>
        </div>
      </div>`).join('')}
  </div>
  <div style="display:flex;justify-content:flex-end;margin-top:26px">
    <a class="link" href="#">Check every number on the chart &rarr;</a>
  </div>
</div>`;

/* ------------------------------------------------------------------ variant B
   Emphasis rather than a flat row. One finding leads at hero size; the sample
   size drops into the eyebrow where provenance belongs, and the other two
   numbers support it. */
const B = `<div class="panel edge" style="width:1560px">
  <div class="head">
    <span class="eyebrow">What we have found so far</span>
    <span class="eyebrow">${D.sites} sites checked &middot; 21 checks each</span>
  </div>
  <div style="display:grid;grid-template-columns:minmax(0,440px) 1fr;gap:56px;margin-top:26px;align-items:start">
    <div>
      <div class="num" style="font-size:104px;color:${T['coral-text']}">1 in 4</div>
      <div class="lab" style="margin-top:10px;font-size:17px;color:${T.ink}">
        sites score a D or worse &mdash; ${D.poorCount} of the ${D.sites} we have checked
      </div>
      <div class="meter edge" style="background:${T['coral-tint']};margin-top:18px">
        <i style="width:${D.poorPct}%;background:${T.coral}"></i>
      </div>
    </div>
    <div style="display:flex;flex-direction:column;gap:20px;padding-top:8px">
      ${[
        { v: String(D.avg), d: '/ 100', lab: 'average score', pct: D.avg,
          fill: T.amber, track: T['amber-tint'] },
        { v: String(D.refused), d: `of ${D.sites}`, lab: 'refused our crawler outright', pct: 7.4,
          fill: T.coral, track: T['coral-tint'] },
      ].map((s) => `
        <div style="background:${T['surface-alt']};border-radius:14px;padding:18px 22px" class="edge">
          <div style="display:flex;align-items:baseline;justify-content:space-between;gap:16px">
            <span class="lab">${s.lab}</span>
            <span style="display:flex;align-items:baseline;gap:8px">
              <span class="num" style="font-size:38px">${s.v}</span>
              <span class="den" style="font-size:17px">${s.d}</span>
            </span>
          </div>
          <div class="meter edge" style="background:${s.track};margin-top:13px">
            <i style="width:${s.pct}%;background:${s.fill}"></i>
          </div>
        </div>`).join('')}
      <div style="display:flex;justify-content:flex-end">
        <a class="link" href="#">Check every number on the chart &rarr;</a>
      </div>
    </div>
  </div>
</div>`;

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1660, height: 700 }, deviceScaleFactor: 2 });
for (const [name, body] of [['a', A], ['b', B]]) {
  await page.setContent(`<style>${base}</style>${body}`, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  const el = await page.$('.panel');
  await el.screenshot({ path: join(OUT, `corpus-${name}.png`) });
  console.log(`  ${name} -> ${join(OUT, `corpus-${name}.png`)}`);
}
await browser.close();
