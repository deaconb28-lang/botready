import { chromium } from 'playwright';
const b = await chromium.launch();
for (const [w, h, tag] of [[1280, 900, 'desktop'], [390, 800, 'mobile']]) {
  const p = await b.newPage({ viewport: { width: w, height: h } });
  await p.route('**/*', (r) => new URL(r.request().url()).hostname === 'localhost' ? r.continue() : r.abort());
  await p.goto('http://localhost:3000/pricing', { waitUntil: 'networkidle' });
  console.log(tag, JSON.stringify(await p.evaluate(() => {
    const h1 = document.querySelector('h1');
    const r = h1.getBoundingClientRect();
    return { text: h1.textContent, lines: Math.round(r.height / parseFloat(getComputedStyle(h1).lineHeight)), w: Math.round(r.width) };
  })));
  await p.screenshot({ path: `pricing-${tag}.png`, clip: { x: 0, y: 0, width: w, height: Math.min(h, 700) } });
  await p.close();
}
await b.close();
