#!/usr/bin/env node
/**
 * The favicons, from the two SVGs that are their source.
 *
 *   pnpm icons
 *
 * `apps/web/app/icon.svg` is the source and is also shipped as-is — a browser
 * that takes an SVG favicon gets the vector. Everything else is derived from
 * it here rather than drawn twice:
 *
 *   app/favicon.ico     16, 32 and 48, for the browsers and crawlers that ask
 *                       for /favicon.ico by name
 *   app/apple-icon.png  180x180, from assets/icon/apple-icon.svg, which is the
 *                       same mark without the rounded tile or the ink border:
 *                       iOS applies its own mask, and a rounded rectangle
 *                       inside a rounded mask reads as a sticker of an icon
 *   public/logo.svg     the logo the JSON-LD and the agent manifests point at.
 *                       Not public/icon.svg: app/icon.svg already claims that
 *                       URL through Next's own convention, and two files
 *                       answering to one path is a trap for whoever edits one
 *
 * Regenerate after editing either SVG. The outputs are committed, so a build
 * never needs a browser.
 */

import { copyFileSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const APP = join(ROOT, 'apps/web/app');
const SOURCE = join(ROOT, 'apps/web/assets/icon');

const { chromium } = await import('playwright').catch(() =>
  import(pathToFileURL(join(ROOT, 'tools/node_modules/playwright/index.mjs')).href),
);

const tile = readFileSync(join(APP, 'icon.svg'), 'utf8');
const apple = readFileSync(join(SOURCE, 'apple-icon.svg'), 'utf8');

const browser = await chromium.launch();
const page = await browser.newPage();

async function render(svg, size, path) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<style>html,body{margin:0;padding:0}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`,
  );
  await page.screenshot({ path, omitBackground: true });
}

await render(apple, 180, join(APP, 'apple-icon.png'));

// An ICO directory entry may carry PNG data rather than a BMP, which is how
// every icon since Vista has been packed and is why there is no BMP encoder
// in this file.
const SIZES = [16, 32, 48];
const pngs = [];
for (const size of SIZES) {
  const path = join(SOURCE, `.ico-${size}.png`);
  await render(tile, size, path);
  pngs.push(readFileSync(path));
}
await browser.close();

const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0); // reserved
header.writeUInt16LE(1, 2); // 1 = icon, 2 = cursor
header.writeUInt16LE(SIZES.length, 4);

let offset = 6 + SIZES.length * 16;
const entries = SIZES.map((size, i) => {
  const entry = Buffer.alloc(16);
  entry.writeUInt8(size, 0); // 0 would mean 256
  entry.writeUInt8(size, 1);
  entry.writeUInt8(0, 2); // palette entries; 0 for truecolour
  entry.writeUInt8(0, 3); // reserved
  entry.writeUInt16LE(1, 4); // colour planes
  entry.writeUInt16LE(32, 6); // bits per pixel
  entry.writeUInt32LE(pngs[i].length, 8);
  entry.writeUInt32LE(offset, 12);
  offset += pngs[i].length;
  return entry;
});

writeFileSync(join(APP, 'favicon.ico'), Buffer.concat([header, ...entries, ...pngs]));

// The manifests and the JSON-LD want a logo URL they can state plainly, and
// Next serves the app convention as /icon.svg?<hash>. Same mark, own path.
copyFileSync(join(APP, 'icon.svg'), join(ROOT, 'apps/web/public/logo.svg'));

console.log(`favicon.ico (${SIZES.join(', ')}), apple-icon.png (180), public/logo.svg`);
