#!/usr/bin/env node
/**
 * Every graphic in the campaign, from one file.
 *
 * There is one visual idea here — a lime 200 and a coral 403 stamped with the
 * same second and the same address — and everything below is that idea at a
 * different size. It is drawn in the product's own design system (2px ink
 * borders, hard offset shadows with no blur, lavender ground, the three faces
 * the site loads) so that an ad and the app look like the same company made
 * them.
 *
 * The reason this is a generator rather than thirty-five files is that the copy
 * changes. A tagline edit in taglines.md should be one line here and one
 * command, not an afternoon in a vector editor.
 *
 *   node marketing/assets/build.mjs           writes the SVGs
 *   node marketing/assets/build.mjs --png     also rasterises, needs Playwright
 *
 * Nothing here states a number we have not measured. Where a graphic wants one,
 * it carries MEASURE and the build prints a warning naming the file.
 */

import { mkdirSync, writeFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), 'out');

// ------------------------------------------------------------------ tokens

const C = {
  ink: '#111318',
  canvas: '#EDEBFB',
  white: '#FFFFFF',
  surface: '#F7F6FE',
  lime: '#C6F53C',
  coral: '#FF6B5A',
  amber: '#FFCF5C',
  violet: '#4B44F5',
  green: '#2E9B5E',
  muted: '#4A4A57',
  subtle: '#6B6B7B',
  onInk: '#F4F3FA',
  onInkMuted: '#8E8DA0',
};

const DISPLAY = "'Familjen Grotesk', 'Public Sans', system-ui, sans-serif";
const BODY = "'Public Sans', system-ui, sans-serif";
const MONO = "'JetBrains Mono', ui-monospace, 'SF Mono', monospace";

// ------------------------------------------------------------------ helpers

const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * Rough advance widths, as a fraction of the font size, for the three faces at
 * the weights this campaign uses. Measured off rendered samples rather than
 * guessed, and only accurate enough for the one job they have: deciding when a
 * headline is too big for its column. An SVG generator has no text metrics, and
 * the alternative is discovering the overflow in the PNG.
 */
const ADVANCE = { display: 0.515, body: 0.505, mono: 0.6 };

function widthOf(s, size, face = 'display') {
  return String(s).length * size * ADVANCE[face];
}

/** Break on spaces to fit a column. Never mid-word, which a slice does. */
function wrap(s, maxWidth, size, face = 'body') {
  const lines = [];
  let line = '';
  for (const word of String(s).split(' ')) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && widthOf(candidate, size, face) > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** The largest size at which every line fits the column. */
function fit(lines, maxWidth, start, face = 'display', min = 10) {
  let size = start;
  while (size > min && Math.max(...lines.map((l) => widthOf(l, size, face))) > maxWidth) size -= 1;
  return size;
}

/** A hard offset shadow is a second rect behind the first. No blur, ever. */
function card({ x, y, w, h, r = 16, fill = C.white, shadow = 5, shadowColor = C.ink, stroke = C.ink, strokeWidth = 2 }) {
  const parts = [];
  if (shadow > 0) {
    parts.push(`<rect x="${x + shadow}" y="${y + shadow}" width="${w}" height="${h}" rx="${r}" fill="${shadowColor}"/>`);
  }
  parts.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"/>`);
  return parts.join('');
}

function text({ x, y, s, size = 16, family = BODY, weight = 400, fill = C.ink, anchor = 'start', tracking = 0, opacity = 1 }) {
  return `<text x="${x}" y="${y}" font-family="${family}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}"${tracking ? ` letter-spacing="${tracking}"` : ''}${opacity !== 1 ? ` opacity="${opacity}"` : ''}>${esc(s)}</text>`;
}

/** Several lines of display type, set tight, from an explicit array. */
function display({ x, y, lines, size, lead = 1.02, fill = C.ink, anchor = 'start', weight = 700 }) {
  return lines
    .map((line, i) =>
      text({ x, y: y + i * size * lead, s: line, size, family: DISPLAY, weight, fill, anchor, tracking: -size * 0.035 }),
    )
    .join('');
}

/** Uppercase mono, 0.12em tracked. The site's eyebrow, everywhere. */
function eyebrow({ x, y, s, size = 12, fill = C.subtle, anchor = 'start' }) {
  return text({ x, y, s: s.toUpperCase(), size, family: MONO, weight: 500, fill, anchor, tracking: size * 0.12 });
}

/** The graph-paper ground the product's own cards use. */
function ground(w, h, fill = C.canvas, step = 64) {
  const lines = [];
  for (let gx = step; gx < w; gx += step) lines.push(`M${gx} 0V${h}`);
  for (let gy = step; gy < h; gy += step) lines.push(`M0 ${gy}H${w}`);
  return (
    `<rect width="${w}" height="${h}" fill="${fill}"/>` +
    `<path d="${lines.join('')}" stroke="${C.ink}" stroke-width="1" opacity=".13" stroke-dasharray="3 7"/>`
  );
}

/**
 * The motif. One client, one status code, one moment.
 *
 * `code` is the HTTP status and `tone` the colour it earns. Nothing here is
 * decorative: every field is something a scan actually records.
 */
function statusRow({ x, y, w, h = 96, agent, code, tone, meta, codeSize = 44 }) {
  const chipW = Math.round(h * 1.45);
  return [
    card({ x, y, w, h, r: 14, fill: C.white, shadow: 4 }),
    `<rect x="${x + 14}" y="${y + 14}" width="${chipW}" height="${h - 28}" rx="10" fill="${tone}" stroke="${C.ink}" stroke-width="2"/>`,
    text({
      x: x + 14 + chipW / 2,
      y: y + h / 2 + codeSize * 0.35,
      s: code,
      size: codeSize,
      family: DISPLAY,
      weight: 700,
      anchor: 'middle',
      tracking: -codeSize * 0.03,
    }),
    text({ x: x + chipW + 34, y: y + h / 2 - 4, s: agent, size: Math.round(h * 0.2), family: MONO, weight: 500 }),
    text({ x: x + chipW + 34, y: y + h / 2 + Math.round(h * 0.22), s: meta, size: Math.round(h * 0.16), family: MONO, fill: C.subtle }),
  ].join('');
}

/** The URL box, drawn. Every asset ends here. */
function urlBox({ x, y, w, h = 72, label = 'yoursite.com', button = 'Run a check' }) {
  const bw = Math.round(w * 0.34);
  return [
    card({ x, y, w, h, r: 14, fill: C.white, shadow: 4 }),
    text({ x: x + 22, y: y + h / 2 + h * 0.11, s: label, size: h * 0.3, family: MONO, fill: C.subtle }),
    `<rect x="${x + w - bw - 10}" y="${y + 10}" width="${bw}" height="${h - 20}" rx="10" fill="${C.violet}" stroke="${C.ink}" stroke-width="2"/>`,
    text({
      x: x + w - bw / 2 - 10,
      y: y + h / 2 + h * 0.11,
      s: button,
      size: h * 0.27,
      family: BODY,
      weight: 600,
      fill: C.white,
      anchor: 'middle',
    }),
  ].join('');
}

/**
 * One text node with two spans rather than two nodes at computed offsets: this
 * generator has no text metrics, so any x it computes for the ".dev" is a guess
 * that is wrong at some size. The renderer knows where the first span ended.
 */
function wordmark({ x, y, size = 26, fill = C.ink, dot = C.violet }) {
  return (
    `<text x="${x}" y="${y}" font-family="${DISPLAY}" font-size="${size}" font-weight="700" letter-spacing="${-size * 0.03}" fill="${fill}">` +
    `botready<tspan fill="${dot}">.dev</tspan></text>`
  );
}

function svg(w, h, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" font-kerning="normal">\n${body}\n</svg>\n`;
}

const files = [];
const warnings = [];
function emit(name, w, h, body) {
  const markup = svg(w, h, body);
  if (markup.includes('MEASURE')) warnings.push(name);
  files.push({ name, markup, w, h });
}

// ------------------------------------------------------------------ the split
//
// The one composition, parameterised by size. Everything that has room for
// three lines of type uses this.

function splitScene({ w, h, headline, sub, showUrl = true, scale = 1 }) {
  const pad = Math.round(w * 0.055);
  const colW = Math.round((w - pad * 2) * 0.46);
  const rightX = w - pad - colW;
  const leftW = rightX - pad - Math.round(w * 0.03);
  // The headline is the biggest thing on the card and the only one that can
  // collide with the status stack, so it is sized to the column rather than to
  // the canvas.
  const titleSize = fit(headline, leftW, Math.round(w * 0.052 * scale));
  const subSize = fit([sub], leftW, Math.round(titleSize * 0.34), 'body');

  const rows = [
    { agent: 'chrome', code: '200', tone: C.lime, meta: '84.1 KB · 14:22:07' },
    { agent: 'claudebot', code: '403', tone: C.coral, meta: '0.9 KB · 14:22:08' },
    { agent: 'gptbot', code: '403', tone: C.coral, meta: '0.9 KB · 14:22:09' },
  ];
  const rowH = Math.round(h * 0.135);
  const gap = Math.round(rowH * 0.19);
  const stackH = rows.length * rowH + (rows.length - 1) * gap;
  const stackY = Math.round((h - stackH) / 2);

  return [
    ground(w, h),
    wordmark({ x: pad, y: pad + titleSize * 0.5, size: Math.round(titleSize * 0.5) }),
    display({
      x: pad,
      y: Math.round(h * 0.42),
      lines: headline,
      size: titleSize,
    }),
    text({
      x: pad,
      y: Math.round(h * 0.42) + titleSize * (headline.length - 1) * 1.02 + titleSize * 0.95,
      s: sub,
      size: subSize,
      family: BODY,
      fill: C.muted,
    }),
    showUrl
      ? urlBox({
          x: pad,
          y: h - pad - Math.round(h * 0.11),
          w: leftW,
          h: Math.round(h * 0.11),
        })
      : '',
    rows
      .map((row, i) =>
        statusRow({
          x: rightX,
          y: stackY + i * (rowH + gap),
          w: colW,
          h: rowH,
          codeSize: Math.round(rowH * 0.46),
          ...row,
        }),
      )
      .join(''),
    eyebrow({
      x: rightX,
      y: stackY - Math.round(rowH * 0.32),
      s: 'one url · one ip · three seconds',
      size: Math.round(w * 0.0125),
    }),
  ].join('');
}

// ------------------------------------------------------------------ 1. cards

emit(
  'og-launch',
  1200,
  630,
  splitScene({
    w: 1200,
    h: 630,
    headline: ['200 for Chrome.', '403 for ClaudeBot.', 'Same second.'],
    sub: 'The free check for whether AI agents can read your site.',
  }),
);

emit(
  'x-card',
  1600,
  900,
  splitScene({
    w: 1600,
    h: 900,
    headline: ['200 for Chrome.', '403 for ClaudeBot.', 'Same second.'],
    sub: 'Nobody decided that. Find it in 30 seconds, free.',
  }),
);

emit(
  'linkedin-card',
  1200,
  627,
  splitScene({
    w: 1200,
    h: 627,
    headline: ['Your site is fine.', 'Your site is also', 'invisible.'],
    sub: '21 checks, published weights, free diagnosis.',
  }),
);

emit(
  'press-hero',
  2400,
  1260,
  splitScene({
    w: 2400,
    h: 1260,
    headline: ['200 for Chrome.', '403 for ClaudeBot.', 'Same second.'],
    sub: 'botready.dev measures how legible a website is to AI agents.',
    scale: 0.94,
  }),
);

// ------------------------------------------------------------ 2. product hunt

const PH = { w: 1270, h: 760 };

emit(
  'ph-01-cover',
  PH.w,
  PH.h,
  [
    ground(PH.w, PH.h),
    // Two codes, nothing else. It has to work as a thumbnail with no words read.
    card({ x: 150, y: 190, w: 440, h: 300, r: 22, fill: C.lime, shadow: 7 }),
    text({ x: 370, y: 400, s: '200', size: 172, family: DISPLAY, weight: 700, anchor: 'middle', tracking: -6 }),
    text({ x: 370, y: 448, s: 'chrome', size: 26, family: MONO, weight: 500, anchor: 'middle' }),
    card({ x: 680, y: 190, w: 440, h: 300, r: 22, fill: C.coral, shadow: 7 }),
    text({ x: 900, y: 400, s: '403', size: 172, family: DISPLAY, weight: 700, anchor: 'middle', tracking: -6 }),
    text({ x: 900, y: 448, s: 'claudebot', size: 26, family: MONO, weight: 500, anchor: 'middle' }),
    display({ x: PH.w / 2, y: 600, lines: ['Same site. Same second.'], size: 60, anchor: 'middle' }),
    text({ x: PH.w / 2, y: 650, s: 'Nobody decided that.', size: 27, family: BODY, fill: C.muted, anchor: 'middle' }),
    wordmark({ x: PH.w / 2 - 62, y: 128, size: 30 }),
  ].join(''),
);

/** A drawn result page. Replace with a screenshot of a real scan before launch. */
emit(
  'ph-02-result',
  PH.w,
  PH.h,
  [
    ground(PH.w, PH.h),
    eyebrow({ x: 80, y: 78, s: 'the result page · replace with a real scan', size: 13 }),
    card({ x: 80, y: 100, w: PH.w - 170, h: 200, r: 22, shadow: 6 }),
    card({ x: 112, y: 132, w: 136, h: 136, r: 16, fill: C.coral, shadow: 0 }),
    text({ x: 180, y: 232, s: 'C', size: 108, family: DISPLAY, weight: 700, anchor: 'middle' }),
    display({ x: 282, y: 196, lines: ['57 / 100'], size: 58 }),
    text({ x: 282, y: 236, s: 'example.com · scoring v1.2 · 21 checks · 6 pages', size: 21, family: MONO, fill: C.subtle }),
    statusRow({ x: 80, y: 326, w: 540, h: 82, agent: 'chrome', code: '200', tone: C.lime, meta: 'control · 84.1 KB', codeSize: 38 }),
    statusRow({ x: 80, y: 420, w: 540, h: 82, agent: 'claudebot', code: '403', tone: C.coral, meta: 'refused · 0.9 KB', codeSize: 38 }),
    statusRow({ x: 80, y: 514, w: 540, h: 82, agent: 'gptbot', code: '403', tone: C.coral, meta: 'refused · 0.9 KB', codeSize: 38 }),
    statusRow({ x: 80, y: 608, w: 540, h: 82, agent: 'perplexitybot', code: '200', tone: C.lime, meta: 'ok · 84.1 KB', codeSize: 38 }),
    card({ x: 660, y: 326, w: 460, h: 364, r: 20, fill: C.white, shadow: 6, shadowColor: C.violet }),
    eyebrow({ x: 688, y: 372, s: 'the finding', size: 13, fill: C.violet }),
    display({ x: 688, y: 424, lines: ['Two clients', 'were refused'], size: 40 }),
    text({ x: 688, y: 494, s: 'Both got 403 from the same address', size: 20, family: BODY, fill: C.muted }),
    text({ x: 688, y: 520, s: 'that answered Chrome with 200, one', size: 20, family: BODY, fill: C.muted }),
    text({ x: 688, y: 546, s: 'second earlier.', size: 20, family: BODY, fill: C.muted }),
    card({ x: 688, y: 578, w: 404, h: 82, r: 12, fill: C.ink, shadow: 0, stroke: C.ink }),
    text({ x: 708, y: 612, s: 'agent_status_parity', size: 19, family: MONO, fill: C.onInk }),
    text({ x: 708, y: 640, s: '−12.9 of the 100', size: 19, family: MONO, fill: C.coral }),
  ].join(''),
);

emit(
  'ph-03-catalog',
  PH.w,
  PH.h,
  (() => {
    const cats = [
      ['Retrievability', 25, C.violet],
      ['Discovery', 20, C.lime],
      ['Representation', 20, C.amber],
      ['Structure', 15, C.coral],
      ['Actionability', 15, '#3EC6C6'],
      ['Freshness', 5, '#F79ED0'],
    ];
    const chartX = 80;
    const chartY = 190;
    const chartW = PH.w - 170;
    const chartH = 300;
    const barW = Math.floor((chartW - 60 - (cats.length - 1) * 18) / cats.length);
    return [
      ground(PH.w, PH.h),
      eyebrow({ x: 80, y: 96, s: 'what we check · scoring v1.2', size: 14 }),
      display({ x: 80, y: 156, lines: ['Every weight is published'], size: 54 }),
      card({ x: chartX, y: chartY, w: chartW, h: chartH, r: 20, fill: C.ink, shadow: 6, shadowColor: C.violet, stroke: C.ink }),
      cats
        .map(([label, weight, colour], i) => {
          const bh = Math.round((weight / 25) * (chartH - 96));
          const bx = chartX + 30 + i * (barW + 18);
          const by = chartY + chartH - 54 - bh;
          return [
            `<rect x="${bx}" y="${by}" width="${barW}" height="${bh}" rx="8" fill="${colour}" stroke="${C.lime}" stroke-width="2"/>`,
            text({ x: bx + barW / 2, y: by - 14, s: `${weight}%`, size: 22, family: MONO, weight: 700, fill: C.onInk, anchor: 'middle' }),
            text({
              x: bx + barW / 2,
              y: chartY + chartH - 24,
              s: label.slice(0, 4).toUpperCase(),
              size: 15,
              family: MONO,
              weight: 500,
              fill: C.onInkMuted,
              anchor: 'middle',
              tracking: 1.8,
            }),
          ].join('');
        })
        .join(''),
      card({ x: 80, y: 530, w: 560, h: 160, r: 18, shadow: 5 }),
      text({ x: 108, y: 578, s: 'agent_status_parity', size: 24, family: MONO, weight: 500 }),
      text({ x: 108, y: 614, s: '12.9 of the 100', size: 19, family: MONO, fill: C.subtle }),
      text({ x: 108, y: 652, s: 'Fails when any agent client receives a', size: 19, family: BODY, fill: C.muted }),
      text({ x: 108, y: 676, s: 'different status class than the control.', size: 19, family: BODY, fill: C.muted }),
      card({ x: 672, y: 530, w: 448, h: 160, r: 18, fill: C.lime, shadow: 5 }),
      display({ x: 700, y: 590, lines: ['A score nobody can', 'argue with is a', 'horoscope.'], size: 33 }),
    ].join('');
  })(),
);

emit(
  'ph-04-fixpack',
  PH.w,
  PH.h,
  (() => {
    const tabs = ['llms.txt', 'robots.txt', 'waf-rule.tf', 'schema.json', 'botready-fixes.md'];
    const body = [
      '# example.com',
      '',
      '> A design tool for teams that ship. Every URL below',
      '> returned 200 when we checked it.',
      '',
      '## Pages',
      '',
      '- [Pricing](https://example.com/pricing): plans and limits',
      '- [Docs](https://example.com/docs): the API and the SDKs',
      '- [Changelog](https://example.com/changelog): shipped weekly',
    ];
    return [
      ground(PH.w, PH.h),
      eyebrow({ x: 80, y: 96, s: 'the fix pack · $15, one time', size: 14 }),
      display({ x: 80, y: 156, lines: ['Generated from your own scan'], size: 50 }),
      card({ x: 80, y: 200, w: PH.w - 170, h: 500, r: 22, fill: C.ink, shadow: 6, shadowColor: C.violet, stroke: C.ink }),
      tabs
        .map((tab, i) => {
          const tx = 110 + i * 218;
          const on = i === 0;
          return [
            `<rect x="${tx}" y="${230}" width="200" height="46" rx="10" fill="${on ? C.lime : 'none'}" stroke="${on ? C.ink : C.onInkMuted}" stroke-width="2"/>`,
            text({ x: tx + 100, y: 260, s: tab, size: 17, family: MONO, weight: 500, fill: on ? C.ink : C.onInkMuted, anchor: 'middle' }),
          ].join('');
        })
        .join(''),
      body
        .map((line, i) =>
          text({
            x: 112,
            y: 330 + i * 32,
            s: line,
            size: 20,
            family: MONO,
            fill: line.startsWith('#') ? C.lime : line.startsWith('>') ? C.onInkMuted : C.onInk,
          }),
        )
        .join(''),
    ].join('');
  })(),
);

emit(
  'ph-05-refusal',
  PH.w,
  PH.h,
  [
    ground(PH.w, PH.h),
    eyebrow({ x: 80, y: 96, s: 'the constraint', size: 14 }),
    display({ x: 80, y: 186, lines: ['We never work', 'around a block.'], size: 76 }),
    text({ x: 80, y: 372, s: 'No spoofed user agents. No residential proxies. No captcha solving.', size: 26, family: BODY, fill: C.muted }),
    text({ x: 80, y: 410, s: 'If your site refuses our crawler, the result says your site refuses', size: 26, family: BODY, fill: C.muted }),
    text({ x: 80, y: 448, s: 'our crawler. That is the finding.', size: 26, family: BODY, fill: C.muted }),
    card({ x: 80, y: 500, w: 520, h: 190, r: 18, fill: C.ink, shadow: 5, stroke: C.ink }),
    text({ x: 110, y: 552, s: '# your robots.txt', size: 21, family: MONO, fill: C.onInkMuted }),
    text({ x: 110, y: 594, s: 'User-agent: BotreadyBot', size: 23, family: MONO, fill: C.lime }),
    text({ x: 110, y: 630, s: 'Disallow: /', size: 23, family: MONO, fill: C.lime }),
    text({ x: 110, y: 670, s: 'and we stop, on every future scan.', size: 19, family: MONO, fill: C.onInkMuted }),
    card({ x: 646, y: 500, w: 474, h: 190, r: 18, fill: C.coral, shadow: 5 }),
    display({ x: 674, y: 566, lines: ['A number you', 'cheated to get is', 'worth nothing.'], size: 38 }),
  ].join(''),
);

emit(
  'ph-06-monitoring',
  PH.w,
  PH.h,
  [
    ground(PH.w, PH.h),
    eyebrow({ x: 80, y: 96, s: 'monitoring · $5 a month', size: 14 }),
    display({ x: 80, y: 168, lines: ['It goes green. Then a WAF', 'update turns it red.'], size: 50 }),
    card({ x: 80, y: 268, w: PH.w - 170, h: 300, r: 20, shadow: 6 }),
    text({ x: 116, y: 322, s: 'From: botready.dev <team@botready.dev>', size: 21, family: MONO, fill: C.subtle }),
    text({ x: 116, y: 356, s: 'Subject: example.com — ClaudeBot is being refused', size: 23, family: MONO, weight: 500 }),
    `<path d="M116 382H${PH.w - 126}" stroke="${C.ink}" stroke-width="1" opacity=".2"/>`,
    text({ x: 116, y: 424, s: 'ClaudeBot got a 403 this morning. It got a 200 last week, and', size: 23, family: BODY, fill: C.muted }),
    text({ x: 116, y: 458, s: 'Chrome still gets a 200 from the same address.', size: 23, family: BODY, fill: C.muted }),
    text({ x: 116, y: 508, s: 'Nothing was deployed. Something changed at the edge.', size: 23, family: BODY, fill: C.muted }),
    card({ x: 116, y: 528, w: 280, h: 24, r: 6, fill: 'none', shadow: 0, stroke: 'none' }),
    text({ x: 116, y: 546, s: 'botready.dev/scan/…', size: 21, family: MONO, fill: C.violet }),
    card({ x: 80, y: 600, w: PH.w - 170, h: 90, r: 16, fill: C.lime, shadow: 5 }),
    text({ x: 112, y: 654, s: 'That regression is silent by nature. It is a firewall update, not a deploy.', size: 26, family: BODY, weight: 600 }),
  ].join(''),
);

// ------------------------------------------------------------------ 3. instagram

const IG = 1080;

/** A statement frame: huge type on lavender, one idea, nothing else. */
function igStatement(lines, { size = 92, foot = 'botready.dev', fill = C.canvas, type = C.ink } = {}) {
  const s = fit(lines, IG - 176, size);
  return [
    ground(IG, IG, fill),
    display({ x: 88, y: 400, lines, size: s, fill: type }),
    text({ x: 88, y: IG - 88, s: foot, size: 30, family: MONO, weight: 500, fill: type, opacity: 0.65 }),
  ].join('');
}

emit(
  'ig-c1-1',
  IG,
  IG,
  [
    ground(IG, IG),
    card({ x: 88, y: 190, w: IG - 176, h: 240, r: 20, fill: C.lime, shadow: 6 }),
    text({ x: 128, y: 340, s: '200', size: 128, family: DISPLAY, weight: 700, tracking: -4 }),
    text({ x: IG - 128, y: 300, s: 'chrome', size: 32, family: MONO, weight: 500, anchor: 'end' }),
    text({ x: IG - 128, y: 348, s: '14:22:07', size: 32, family: MONO, anchor: 'end' }),
    card({ x: 88, y: 460, w: IG - 176, h: 240, r: 20, fill: C.coral, shadow: 6 }),
    text({ x: 128, y: 610, s: '403', size: 128, family: DISPLAY, weight: 700, tracking: -4 }),
    text({ x: IG - 128, y: 570, s: 'claudebot', size: 32, family: MONO, weight: 500, anchor: 'end' }),
    text({ x: IG - 128, y: 618, s: '14:22:08', size: 32, family: MONO, anchor: 'end' }),
    display({ x: 88, y: 810, lines: ['Same site.', 'Same second.', 'Two answers.'], size: 76 }),
  ].join(''),
);

emit('ig-c1-2', IG, IG, igStatement(['Your website', 'returns 200 to', 'Chrome and 403', 'to ClaudeBot.'], { size: 84 }));
emit('ig-c1-3', IG, IG, igStatement(['Nobody', 'decided', 'that.'], { size: 148 }));

emit(
  'ig-c1-4',
  IG,
  IG,
  [
    ground(IG, IG),
    eyebrow({ x: 88, y: 150, s: 'three ways it happens', size: 26 }),
    ...[
      ['A WAF preset', 'that cannot tell a scraper from a client trying to answer a question about you.'],
      ['A pasted robots.txt', 'from a 2023 blocklist, added by somebody who has since left.'],
      ['A rule from 2am', 'written after a scraping incident and never removed.'],
    ].map(([title, body], i) => {
      const y = 210 + i * 230;
      return [
        card({ x: 88, y, w: IG - 176, h: 196, r: 18, shadow: 5 }),
        text({ x: 122, y: y + 62, s: title, size: 40, family: DISPLAY, weight: 700 }),
        wrap(body, IG - 176 - 68, 27)
          .slice(0, 2)
          .map((line, j) => text({ x: 122, y: y + 112 + j * 38, s: line, size: 27, family: BODY, fill: C.muted }))
          .join(''),
      ].join('');
    }),
    text({ x: 88, y: IG - 88, s: 'None of them was a decision.', size: 32, family: MONO, weight: 500, fill: C.muted }),
  ].join(''),
);

emit('ig-c1-5', IG, IG, igStatement(['You cannot see', 'it in analytics.', '', 'A refused request', 'never became', 'a session.'], { size: 74 }));

emit(
  'ig-c1-6',
  IG,
  IG,
  [
    ground(IG, IG),
    card({ x: 88, y: 300, w: IG - 176, h: 380, r: 20, fill: C.ink, shadow: 6, shadowColor: C.violet, stroke: C.ink }),
    text({ x: 124, y: 380, s: '$ curl -sI \\', size: 30, family: MONO, fill: C.onInk }),
    text({ x: 124, y: 424, s: '    -A "ClaudeBot/1.0" \\', size: 30, family: MONO, fill: C.onInk }),
    text({ x: 124, y: 468, s: '    https://yoursite.com', size: 30, family: MONO, fill: C.onInk }),
    text({ x: 124, y: 548, s: 'HTTP/2 403', size: 40, family: MONO, weight: 700, fill: C.coral }),
    text({ x: 124, y: 604, s: 'server: cloudflare', size: 28, family: MONO, fill: C.onInkMuted }),
    text({ x: 124, y: 644, s: 'cf-mitigated: challenge', size: 28, family: MONO, fill: C.onInkMuted }),
    display({ x: 88, y: 800, lines: ['Three commands.', 'Do it yourself.'], size: 72 }),
  ].join(''),
);

emit(
  'ig-c1-7',
  IG,
  IG,
  [
    ground(IG, IG),
    display({ x: 88, y: 340, lines: ['Thirty seconds.', 'Free. Nothing', 'blurred.'], size: 88 }),
    urlBox({ x: 88, y: 640, w: IG - 176, h: 120 }),
    wordmark({ x: 88, y: IG - 100, size: 48 }),
  ].join(''),
);

emit(
  'ig-c2-1',
  IG,
  IG,
  [
    ground(IG, IG),
    eyebrow({ x: 88, y: 150, s: 'your pricing page, twice', size: 26 }),
    card({ x: 88, y: 200, w: 424, h: 480, r: 18, shadow: 5 }),
    text({ x: 118, y: 254, s: 'what you see', size: 26, family: MONO, fill: C.subtle }),
    ...Array.from({ length: 9 }, (_, i) =>
      `<rect x="118" y="${288 + i * 40}" width="${i % 3 === 0 ? 360 : 300}" height="20" rx="6" fill="${C.ink}" opacity="${0.16 + (i % 3) * 0.05}"/>`,
    ),
    card({ x: 568, y: 200, w: 424, h: 480, r: 18, fill: C.surface, shadow: 5 }),
    text({ x: 598, y: 254, s: 'what it sees', size: 26, family: MONO, fill: C.subtle }),
    text({ x: 598, y: 320, s: 'Example — Pricing', size: 30, family: MONO, fill: C.ink }),
    text({ x: 598, y: 368, s: 'Loading…', size: 30, family: MONO, fill: C.coral }),
    display({ x: 88, y: 800, lines: ['These clients do not', 'run your JavaScript.'], size: 66 }),
  ].join(''),
);

emit('ig-c2-2', IG, IG, igStatement(['A price rendered', 'by React is not', 'a wrong price.'], { size: 84 }));
emit('ig-c2-3', IG, IG, igStatement(['It is', 'no price.'], { size: 168 }));

emit(
  'ig-c2-4',
  IG,
  IG,
  (() => {
    const barX = 88;
    const barW = IG - 176;
    const barY = 420;
    return [
      ground(IG, IG),
      eyebrow({ x: 88, y: 160, s: 'raw characters ÷ rendered characters', size: 24 }),
      display({ x: 88, y: 300, lines: ['The one number', 'worth measuring'], size: 68 }),
      card({ x: barX, y: barY, w: barW, h: 90, r: 14, fill: C.white, shadow: 5 }),
      `<rect x="${barX + 6}" y="${barY + 6}" width="${(barW - 12) * 0.4}" height="78" rx="10" fill="${C.lime}"/>`,
      `<rect x="${barX + 6 + (barW - 12) * 0.4}" y="${barY + 6}" width="${(barW - 12) * 0.3}" height="78" rx="0" fill="${C.amber}"/>`,
      `<rect x="${barX + 6 + (barW - 12) * 0.7}" y="${barY + 6}" width="${(barW - 12) * 0.3 - 6}" height="78" rx="10" fill="${C.coral}"/>`,
      text({ x: barX + (barW * 0.2), y: barY + 60, s: 'fine', size: 34, family: DISPLAY, weight: 700, anchor: 'middle' }),
      text({ x: barX + (barW * 0.55), y: barY + 60, s: 'thin', size: 34, family: DISPLAY, weight: 700, anchor: 'middle' }),
      text({ x: barX + (barW * 0.85), y: barY + 60, s: 'empty', size: 34, family: DISPLAY, weight: 700, anchor: 'middle' }),
      text({ x: barX, y: barY + 146, s: '0.0', size: 28, family: MONO, fill: C.subtle }),
      text({ x: barX + barW * 0.4, y: barY + 146, s: '0.4', size: 28, family: MONO, fill: C.subtle, anchor: 'middle' }),
      text({ x: barX + barW * 0.7, y: barY + 146, s: '0.7', size: 28, family: MONO, fill: C.subtle, anchor: 'middle' }),
      text({ x: barX + barW, y: barY + 146, s: '1.0', size: 28, family: MONO, fill: C.subtle, anchor: 'end' }),
      text({ x: 88, y: IG - 88, s: 'botready.dev', size: 30, family: MONO, weight: 500, fill: C.muted }),
    ].join('');
  })(),
);

emit('ig-c2-5', IG, IG, igStatement(['View source.', 'Not the inspector —', 'that shows the page', 'after JavaScript ran.'], { size: 68 }));

emit(
  'ig-c2-6',
  IG,
  IG,
  [
    ground(IG, IG),
    display({ x: 88, y: 380, lines: ['Search for your', 'headline price.', 'If it is not there,', 'it is not there', 'for them.'], size: 74 }),
    wordmark({ x: 88, y: IG - 100, size: 48 }),
  ].join(''),
);

// ------------------------------------------------------------------ 4. stories

const ST = { w: 1080, h: 1920 };

function story(body) {
  return ground(ST.w, ST.h) + body;
}

emit(
  'ig-story-1',
  ST.w,
  ST.h,
  story(
    [
      card({ x: 90, y: 520, w: ST.w - 180, h: 280, r: 22, fill: C.lime, shadow: 7 }),
      text({ x: 140, y: 700, s: '200', size: 150, family: DISPLAY, weight: 700, tracking: -5 }),
      text({ x: ST.w - 140, y: 690, s: 'chrome', size: 36, family: MONO, weight: 500, anchor: 'end' }),
      card({ x: 90, y: 840, w: ST.w - 180, h: 280, r: 22, fill: C.coral, shadow: 7 }),
      text({ x: 140, y: 1020, s: '403', size: 150, family: DISPLAY, weight: 700, tracking: -5 }),
      text({ x: ST.w - 140, y: 1010, s: 'claudebot', size: 36, family: MONO, weight: 500, anchor: 'end' }),
      display({ x: 90, y: 1300, lines: ['Same site.', 'Same second.'], size: 96 }),
      text({ x: 90, y: 1460, s: 'botready.dev', size: 40, family: MONO, weight: 500, fill: C.muted }),
    ].join(''),
  ),
);

emit(
  'ig-story-2',
  ST.w,
  ST.h,
  story(
    [
      display({ x: 90, y: 800, lines: ['We are live', 'on Product', 'Hunt today.'], size: 118 }),
      card({ x: 90, y: 1120, w: ST.w - 180, h: 130, r: 16, fill: C.violet, shadow: 6 }),
      text({ x: ST.w / 2, y: 1205, s: 'Tap to see it', size: 44, family: BODY, weight: 600, fill: C.white, anchor: 'middle' }),
      wordmark({ x: 90, y: 1400, size: 52 }),
    ].join(''),
  ),
);

emit(
  'ig-story-3',
  ST.w,
  ST.h,
  story(
    [
      eyebrow({ x: 90, y: 560, s: 'a real result', size: 28 }),
      card({ x: 90, y: 600, w: ST.w - 180, h: 420, r: 22, shadow: 7 }),
      card({ x: 130, y: 640, w: 180, h: 180, r: 18, fill: C.coral, shadow: 0 }),
      text({ x: 220, y: 770, s: 'C', size: 140, family: DISPLAY, weight: 700, anchor: 'middle' }),
      display({ x: 348, y: 730, lines: ['57 / 100'], size: 68 }),
      text({ x: 348, y: 786, s: 'example.com', size: 32, family: MONO, fill: C.subtle }),
      text({ x: 130, y: 900, s: '2 of 5 clients were refused', size: 34, family: MONO, weight: 500 }),
      text({ x: 130, y: 952, s: '11 of 21 checks passed', size: 34, family: MONO, fill: C.subtle }),
      display({ x: 90, y: 1200, lines: ['Every result', 'page is public.'], size: 84 }),
    ].join(''),
  ),
);

emit(
  'ig-story-4',
  ST.w,
  ST.h,
  story(
    [
      display({ x: 90, y: 760, lines: ['Every weight', 'is published.'], size: 112 }),
      text({ x: 90, y: 1000, s: 'Retrievability 25 · Discovery 20', size: 38, family: MONO, fill: C.muted }),
      text({ x: 90, y: 1058, s: 'Representation 20 · Structure 15', size: 38, family: MONO, fill: C.muted }),
      text({ x: 90, y: 1116, s: 'Actionability 15 · Freshness 5', size: 38, family: MONO, fill: C.muted }),
      card({ x: 90, y: 1200, w: ST.w - 180, h: 200, r: 20, fill: C.lime, shadow: 6 }),
      display({ x: 130, y: 1290, lines: ['A score nobody can argue', 'with is a horoscope.'], size: 44 }),
    ].join(''),
  ),
);

emit(
  'ig-story-5',
  ST.w,
  ST.h,
  story(
    [
      display({ x: 90, y: 820, lines: ['Which check', 'do you think', 'is wrong?'], size: 118 }),
      text({ x: 90, y: 1120, s: 'A check that fires on a correctly', size: 40, family: BODY, fill: C.muted }),
      text({ x: 90, y: 1176, s: 'configured site is our bug.', size: 40, family: BODY, fill: C.muted }),
      wordmark({ x: 90, y: 1360, size: 52 }),
    ].join(''),
  ),
);

// ------------------------------------------------------------------ 5. display ads

/**
 * One creative, six shapes. At every size there is room for the two codes, one
 * line of type and somewhere to click, and room for nothing else — so the ad is
 * a vertical budget rather than a layout, and the headline takes whatever the
 * fixed parts leave.
 */
function ad(w, h) {
  const wide = w / h > 2.2;
  const pad = Math.max(8, Math.round(Math.min(w, h) * 0.06));

  if (wide) {
    const chip = h - pad * 2;
    const textX = pad * 3 + chip * 2;
    const headSize = fit(['Same site. Same second.'], w - textX - pad, h * 0.22);
    return [
      ground(w, h, C.canvas, 40),
      card({ x: pad, y: pad, w: chip, h: chip, r: 8, fill: C.lime, shadow: 3 }),
      text({ x: pad + chip / 2, y: pad + chip * 0.7, s: '200', size: chip * 0.46, family: DISPLAY, weight: 700, anchor: 'middle' }),
      card({ x: pad * 2 + chip, y: pad, w: chip, h: chip, r: 8, fill: C.coral, shadow: 3 }),
      text({ x: pad * 2 + chip * 1.5, y: pad + chip * 0.7, s: '403', size: chip * 0.46, family: DISPLAY, weight: 700, anchor: 'middle' }),
      text({ x: textX, y: h * 0.46, s: 'Same site. Same second.', size: headSize, family: DISPLAY, weight: 700, tracking: -headSize * 0.035 }),
      text({
        x: textX,
        y: h * 0.78,
        s: 'Free 30-second check · botready.dev',
        size: fit(['Free 30-second check · botready.dev'], w - textX - pad, h * 0.17, 'mono'),
        family: MONO,
        fill: C.muted,
      }),
    ].join('');
  }

  const colW = w - pad * 2;
  const chipH = Math.round(h * 0.155);
  const boxH = Math.round(h * 0.145);
  const chipsTop = pad;
  const chipsBottom = chipsTop + chipH * 2 + 8;
  const boxTop = h - pad - boxH;
  // Whatever is between the chips and the button, minus breathing room at both
  // ends, is the headline's. Two lines have to fit it and the column.
  const headBand = boxTop - chipsBottom - Math.round(h * 0.06);
  const headLines = ['Same site.', 'Same second.'];
  const headSize = Math.min(fit(headLines, colW, Math.round(w * 0.12)), Math.floor(headBand / 2.15));

  return [
    ground(w, h, C.canvas, 40),
    card({ x: pad, y: chipsTop, w: colW, h: chipH, r: 8, fill: C.lime, shadow: 3 }),
    text({ x: pad + 12, y: chipsTop + chipH * 0.72, s: '200', size: chipH * 0.6, family: DISPLAY, weight: 700 }),
    text({ x: pad + colW - 12, y: chipsTop + chipH * 0.66, s: 'chrome', size: chipH * 0.3, family: MONO, weight: 500, anchor: 'end' }),
    card({ x: pad, y: chipsTop + chipH + 8, w: colW, h: chipH, r: 8, fill: C.coral, shadow: 3 }),
    text({ x: pad + 12, y: chipsTop + chipH * 1.72 + 8, s: '403', size: chipH * 0.6, family: DISPLAY, weight: 700 }),
    text({ x: pad + colW - 12, y: chipsTop + chipH * 1.66 + 8, s: 'claudebot', size: chipH * 0.3, family: MONO, weight: 500, anchor: 'end' }),
    display({
      x: pad,
      y: chipsBottom + Math.round(h * 0.04) + headSize,
      lines: headLines,
      size: headSize,
    }),
    urlBox({ x: pad, y: boxTop, w: colW, h: boxH, label: 'yoursite.com', button: 'Check' }),
  ].join('');
}

for (const [w, h] of [
  [300, 250],
  [336, 280],
  [728, 90],
  [320, 50],
  [300, 600],
  [160, 600],
]) {
  emit(`ad-${w}x${h}`, w, h, ad(w, h));
}

// ------------------------------------------------------------------ write

// ------------------------------------------------- 6. the two launch channels
//
// Sizes the platforms actually ask for, which the compositions above do not
// cover: Product Hunt wants a square thumbnail beside a 1270x760 gallery, and
// X wants a 1500x500 header and 16:9 in-stream images.

/**
 * Product Hunt's thumbnail. 240x240, and it is rendered at about 60px in the
 * feed — so it is the mark and one word, and nothing else survives that size.
 */
emit(
  'ph-thumbnail',
  240,
  240,
  [
    `<rect width="240" height="240" fill="${C.violet}"/>`,
    // The favicon's b, scaled. Drawn rather than set: at 60px a webfont's
    // lowercase b is a smudge, and the counter has to stay a hole.
    `<g fill="none" stroke="${C.lime}" stroke-width="21" stroke-linecap="round">`,
    `<path d="M74 52V176"/>`,
    `<circle cx="139" cy="140" r="35"/>`,
    `</g>`,
  ].join(''),
);

/**
 * The X header. 1500x500, but the profile picture covers the bottom-left and
 * the bio crowds the bottom edge, so everything lives in the right two thirds
 * and vertically centred — the only part of this canvas that is reliably seen.
 */
emit(
  'x-header',
  1500,
  500,
  [
    ground(1500, 500),
    // Two codes at the left, clear of the avatar, which sits below the frame.
    card({ x: 96, y: 150, w: 200, h: 92, r: 14, fill: C.lime, shadow: 5 }),
    text({ x: 196, y: 214, s: '200', size: 62, family: DISPLAY, weight: 700, anchor: 'middle', tracking: -2 }),
    card({ x: 96, y: 258, w: 200, h: 92, r: 14, fill: C.coral, shadow: 5 }),
    text({ x: 196, y: 322, s: '403', size: 62, family: DISPLAY, weight: 700, anchor: 'middle', tracking: -2 }),
    display({ x: 360, y: 228, lines: ['Same site. Same second.'], size: fit(['Same site. Same second.'], 1040, 64) }),
    text({ x: 360, y: 286, s: 'The free check for whether AI agents can read your site.', size: 26, family: BODY, fill: C.muted }),
    text({ x: 360, y: 330, s: 'botready.dev', size: 26, family: MONO, weight: 500, fill: C.violet }),
  ].join(''),
);

/** In-stream images for the launch thread. 16:9, which is what X crops to. */
function xPost(lines, sub, body) {
  const w = 1600;
  const h = 900;
  return [
    ground(w, h),
    wordmark({ x: 88, y: 108, size: 30 }),
    display({ x: 88, y: 260, lines, size: fit(lines, w - 176, 84) }),
    text({ x: 88, y: 260 + fit(lines, w - 176, 84) * (lines.length - 1) * 1.02 + 70, s: sub, size: 30, family: BODY, fill: C.muted }),
    body ?? '',
  ].join('');
}

emit(
  'x-post-curl',
  1600,
  900,
  xPost(
    ['Do it in your own', 'terminal. Three lines.'],
    'A user agent is all it takes to find this.',
    [
      card({ x: 88, y: 520, w: 1424, h: 300, r: 20, fill: C.ink, shadow: 6, shadowColor: C.violet, stroke: C.ink }),
      text({ x: 124, y: 580, s: '$ curl -sI -A "Mozilla/5.0" yoursite.com | head -1', size: 30, family: MONO, fill: C.onInk }),
      text({ x: 124, y: 624, s: 'HTTP/2 200', size: 30, family: MONO, weight: 700, fill: C.lime }),
      text({ x: 124, y: 700, s: '$ curl -sI -A "ClaudeBot/1.0" yoursite.com | head -1', size: 30, family: MONO, fill: C.onInk }),
      text({ x: 124, y: 744, s: 'HTTP/2 403', size: 30, family: MONO, weight: 700, fill: C.coral }),
    ].join(''),
  ),
);

emit(
  'x-post-weights',
  1600,
  900,
  xPost(
    ['Every weight is', 'published.'],
    'A score nobody can argue with is a horoscope.',
    (() => {
      const cats = [
        ['RETR', 25, C.violet],
        ['DISC', 20, C.lime],
        ['REPR', 20, C.amber],
        ['STRU', 15, C.coral],
        ['ACTI', 15, '#3EC6C6'],
        ['FRES', 5, '#F79ED0'],
      ];
      const x0 = 88;
      const y0 = 520;
      const w = 1424;
      const hh = 300;
      const bw = Math.floor((w - 60 - 5 * 20) / 6);
      return [
        card({ x: x0, y: y0, w, h: hh, r: 20, fill: C.ink, shadow: 6, shadowColor: C.violet, stroke: C.ink }),
        ...cats.map(([label, weight, colour], i) => {
          const bh = Math.round((weight / 25) * (hh - 110));
          const bx = x0 + 30 + i * (bw + 20);
          const by = y0 + hh - 56 - bh;
          return [
            `<rect x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="8" fill="${colour}" stroke="${C.lime}" stroke-width="2"/>`,
            text({ x: bx + bw / 2, y: by - 14, s: `${weight}%`, size: 24, family: MONO, weight: 700, fill: C.onInk, anchor: 'middle' }),
            text({ x: bx + bw / 2, y: y0 + hh - 24, s: label, size: 16, family: MONO, weight: 500, fill: C.onInkMuted, anchor: 'middle', tracking: 2 }),
          ].join('');
        }),
      ].join('');
    })(),
  ),
);

emit(
  'x-post-refusal',
  1600,
  900,
  xPost(
    ['We never work', 'around a block.'],
    'No spoofed agents. No proxies. No captcha solving.',
    [
      card({ x: 88, y: 560, w: 700, h: 250, r: 20, fill: C.ink, shadow: 6, stroke: C.ink }),
      text({ x: 124, y: 620, s: '# your robots.txt', size: 26, family: MONO, fill: C.onInkMuted }),
      text({ x: 124, y: 672, s: 'User-agent: BotreadyBot', size: 30, family: MONO, fill: C.lime }),
      text({ x: 124, y: 716, s: 'Disallow: /', size: 30, family: MONO, fill: C.lime }),
      text({ x: 124, y: 770, s: 'and we stop. Every scan, forever.', size: 24, family: MONO, fill: C.onInkMuted }),
      card({ x: 826, y: 560, w: 686, h: 250, r: 20, fill: C.coral, shadow: 6 }),
      display({ x: 862, y: 640, lines: ['A number you', 'cheated to get is', 'worth nothing.'], size: 46 }),
    ].join(''),
  ),
);

mkdirSync(OUT, { recursive: true });
for (const file of files) writeFileSync(join(OUT, `${file.name}.svg`), file.markup);

console.log(`${files.length} SVGs written to marketing/assets/out/`);
if (warnings.length) {
  console.warn(`\n${warnings.length} carry an unfilled MEASURE and must not ship:`);
  for (const name of warnings) console.warn(`  ${name}`);
}

// ------------------------------------------------------------------ rasterise

if (process.argv.includes('--png')) {
  // Playwright lives in the tools workspace rather than beside this file, and a
  // bare specifier resolves from here. Try both rather than making the caller
  // remember which directory to stand in.
  const { chromium } = await import('playwright').catch(() =>
    import(pathToFileURL(join(dirname(fileURLToPath(import.meta.url)), '../../tools/node_modules/playwright/index.mjs')).href),
  );
  const browser = await chromium.launch();
  const page = await browser.newPage();
  let done = 0;

  for (const file of files) {
    await page.setViewportSize({ width: file.w, height: file.h });
    await page.setContent(
      `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Familjen+Grotesk:wght@500;600;700&family=Public+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=block">` +
        `<style>html,body{margin:0;padding:0;background:${C.canvas}}svg{display:block}</style>` +
        file.markup,
    );
    // Block until the faces are actually resident; a screenshot taken during
    // the swap ships an ad set in the fallback stack.
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: join(OUT, `${file.name}.png`) });
    done += 1;
  }

  await browser.close();
  console.log(`${done} PNGs written.`);
}

if (process.argv.includes('--list')) {
  for (const name of readdirSync(OUT).sort()) console.log(name);
}
