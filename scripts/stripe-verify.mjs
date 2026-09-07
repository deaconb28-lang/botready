#!/usr/bin/env node
/**
 * Does Stripe charge what the site says it charges?
 *
 *   pnpm stripe:verify
 *
 * The pricing page, the JSON-LD offers and the checkout routes all read
 * PRICING in apps/web/lib/site.ts. But when STRIPE_PRICE_FIXPACK or
 * STRIPE_PRICE_MONITOR is set, that price id wins at checkout and PRICING is
 * only what the page *says*. Nothing made the two agree, so editing one and
 * forgetting the other shows one number and charges another.
 *
 * That is the same failure this product exists to find, pointed at ourselves:
 * a claim on a page that nobody checks against what actually happens.
 *
 * Reads the ids out of the environment, asks Stripe what they cost, and exits
 * non-zero on any disagreement. No SDK — one REST call each, so this runs
 * anywhere the secret key does.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const key = process.env.STRIPE_SECRET_KEY ?? process.env.STRIPE_API_KEY;
if (!key) {
  console.error('STRIPE_SECRET_KEY is not set. See .env.example.');
  process.exit(1);
}

/** PRICING, read from the source rather than restated, so this cannot drift too. */
const site = readFileSync(fileURLToPath(new URL('../apps/web/lib/site.ts', import.meta.url)), 'utf8');
function priced(name) {
  const m = site.match(new RegExp(`${name}:\\s*\\{\\s*amount:\\s*(\\d+)`));
  if (!m) throw new Error(`could not read PRICING.${name} out of lib/site.ts`);
  return Number(m[1]);
}

const CHECKS = [
  { env: 'STRIPE_PRICE_FIXPACK', expect: priced('fixpack'), recurring: false, label: 'fix pack' },
  { env: 'STRIPE_PRICE_MONITOR', expect: priced('monitor'), recurring: 'month', label: 'agency' },
];

let bad = 0;
for (const check of CHECKS) {
  const id = process.env[check.env];
  if (!id) {
    console.log(`- ${check.label}: ${check.env} not set, checkout builds the price from PRICING ($${check.expect})`);
    continue;
  }

  const res = await fetch(`https://api.stripe.com/v1/prices/${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${key}` },
  });
  if (!res.ok) {
    console.error(`! ${check.label}: Stripe returned ${res.status} for ${id}`);
    bad += 1;
    continue;
  }
  const price = await res.json();
  const dollars = (price.unit_amount ?? 0) / 100;
  const interval = price.recurring?.interval ?? null;

  const wrongAmount = dollars !== check.expect;
  const wrongCadence = check.recurring ? interval !== check.recurring : interval !== null;

  if (wrongAmount || wrongCadence) {
    console.error(
      `! ${check.label}: the site says $${check.expect}${check.recurring ? `/${check.recurring}` : ' one time'}, ` +
      `Stripe charges $${dollars}${interval ? `/${interval}` : ' one time'}  (${id})`,
    );
    bad += 1;
  } else if (price.active === false) {
    console.error(`! ${check.label}: $${dollars} matches, but the price is archived in Stripe (${id})`);
    bad += 1;
  } else {
    console.log(`✓ ${check.label}: $${dollars}${interval ? `/${interval}` : ' one time'} in both places`);
  }
}

if (bad) {
  console.error(`\n${bad} price${bad === 1 ? '' : 's'} disagree with the site. Fix Stripe or fix PRICING.`);
  process.exit(1);
}
console.log('\nEvery configured price matches the site.');
