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

/**
 * Supabase issues two key formats. The legacy JWT keys are `anon` and
 * `service_role`; the newer ones are `sb_publishable_…` and `sb_secret_…`, and
 * the dashboard exports them under different names. Either form works with
 * supabase-js, so accept both names rather than making someone rename a
 * variable they pasted straight from the dashboard.
 */
function needEither(primary: string, alias: string): string {
  const value = process.env[primary] || process.env[alias];
  if (!value) {
    throw new Error(
      `${primary} is not set (${alias} also accepted). See .env.example. This route cannot work without it.`,
    );
  }
  return value;
}

export const serverEnv = {
  supabaseUrl: () => need('SUPABASE_URL'),
  supabaseAnonKey: () => needEither('SUPABASE_ANON_KEY', 'SUPABASE_PUBLISHABLE_KEY'),
  /** Bypasses row level security. Never import this into a client component. */
  supabaseServiceRoleKey: () => needEither('SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SECRET_KEY'),

  redisUrl: () => want('UPSTASH_REDIS_REST_URL'),
  redisToken: () => want('UPSTASH_REDIS_REST_TOKEN'),

  qstashToken: () => want('QSTASH_TOKEN'),
  /**
   * QStash tokens are regional. The console exports QSTASH_URL alongside the
   * token, and a token for qstash-us-east-1 answers 404 at the default
   * qstash.upstash.io, so the URL has to travel with it.
   */
  qstashUrl: () => want('QSTASH_URL'),

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
