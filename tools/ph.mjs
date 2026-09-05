import { chromium } from 'playwright';
const b = await chromium.launch();
for (const blocked of [false, true]) {
  const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
  await p.route('**/*', (r) => {
    const h = new URL(r.request().url()).hostname;
    if (h === 'localhost') return r.continue();
    if (h === 'api.producthunt.com' && !blocked) {
      // Stand in for the real badge: same 250x54 box, so layout is measured.
      return r.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="250" height="54"><rect width="250" height="54" fill="#DA552F"/><text x="14" y="33" fill="#fff" font-size="16" font-family="sans-serif">PRODUCT HUNT</text></svg>' });
    }
    return r.abort();
  });
  await p.goto('http://localhost:3000/pricing', { waitUntil: 'networkidle' });
  await p.waitForTimeout(1200);
  const n = await p.evaluate(() => document.querySelectorAll('a[href*="producthunt"]').length);
  const hero = await p.evaluate(() => Math.round(document.querySelector('h1').getBoundingClientRect().top));
  console.log(blocked ? 'blocked' : 'loads', '| badge nodes:', n, '| h1 top:', hero);
  const f = await p.$('footer');
  await f.scrollIntoViewIfNeeded();
  await p.waitForTimeout(400);
  await f.screenshot({ path: blocked ? 'footer-blocked.png' : 'footer.png' });
  await p.close();
}
// and confirm the home hero no longer carries it
const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
await p.route('**/*', (r) => new URL(r.request().url()).hostname === 'localhost' ? r.continue() : r.abort());
await p.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
console.log('home input top:', await p.evaluate(() => Math.round(document.querySelector('input').getBoundingClientRect().top)));
await p.close();
await b.close();
