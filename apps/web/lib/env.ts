/**
 * Environment for the web app.
 *
 * Read through accessors rather than at module load, because Next.js evaluates
 * modules during the build, when none of these are set. A route that needs
 * Stripe should fail when it is called, not when the site is compiled.
 */

function need(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} is not set. See .env.example. This route cannot work without it.`,
    );
  }
  return value;
}

function want(name: string): string | undefined {
  return process.env[name] || undefined;
}

export const serverEnv = {
  supabaseUrl: () => need('SUPABASE_URL'),
  supabaseAnonKey: () => need('SUPABASE_ANON_KEY'),
  /** Bypasses row level security. Never import this into a client component. */
  supabaseServiceRoleKey: () => need('SUPABASE_SERVICE_ROLE_KEY'),

  redisUrl: () => want('UPSTASH_REDIS_REST_URL'),
  redisToken: () => want('UPSTASH_REDIS_REST_TOKEN'),

  qstashToken: () => want('QSTASH_TOKEN'),

  scannerUrl: () => need('SCANNER_URL'),
  scannerSharedSecret: () => need('SCANNER_SHARED_SECRET'),

  stripeSecretKey: () => need('STRIPE_SECRET_KEY'),
  stripeWebhookSecret: () => need('STRIPE_WEBHOOK_SECRET'),
  stripePriceFixpack: () => need('STRIPE_PRICE_FIXPACK'),
  stripePriceMonitor: () => need('STRIPE_PRICE_MONITOR'),

  resendApiKey: () => want('RESEND_API_KEY'),
  /** Report prose only. Never anything factual. */
  anthropicApiKey: () => want('ANTHROPIC_API_KEY'),

  /** Guards the cron routes, which Vercel calls with this as a bearer token. */
  cronSecret: () => want('CRON_SECRET'),
} as const;

export function isProduction(): boolean {
  return process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production';
}
