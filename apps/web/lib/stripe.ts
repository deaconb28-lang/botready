import Stripe from 'stripe';

import { serverEnv } from './env';

/**
 * One Stripe client per process. Constructed lazily because the key is not
 * present at build time, and a module that throws on import takes every route
 * that imports it down with it.
 */
let cached: Stripe | null = null;

export function stripe(): Stripe {
  cached ??= new Stripe(serverEnv.stripeSecretKey(), {
    // Pinned. Stripe's API changes shape between versions and the webhook
    // handler reads specific fields off the event.
    apiVersion: '2025-02-24.acacia',
    typescript: true,
    appInfo: { name: 'botready.dev', url: 'https://botready.dev' },
  });
  return cached;
}

/**
 * Verifies the signature over the raw body and returns the event. The raw body
 * is essential: in the App Router that means `await request.text()` before any
 * JSON parsing, because the signature is over the exact bytes Stripe sent and
 * a re-serialised object will not match.
 */
export function verifyWebhook(rawBody: string, signature: string): Stripe.Event {
  return stripe().webhooks.constructEvent(rawBody, signature, serverEnv.stripeWebhookSecret());
}
