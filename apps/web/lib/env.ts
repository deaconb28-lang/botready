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
/** The optional form of the same idea. */
function wantEither(primary: string, alias: string): string | undefined {
  return process.env[primary] || process.env[alias] || undefined;
}

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

  /**
   * Two names for one thing, because there are two ways to attach Upstash to a
   * Vercel project and they disagree. Upstash's own integration writes
   * UPSTASH_REDIS_REST_URL; adding a Redis store through the Vercel
   * Marketplace writes KV_REST_API_URL. Both are the same REST endpoint.
   *
   * This is not a nicety. Everything here degrades open when Redis is absent —
   * no rate limit, no burst cache — so a variable under the wrong name is a
   * silent loss of the only thing stopping /api/scan being pointed at somebody
   * else's site in a loop. Accepting both names removes the way that happens.
   */
  redisUrl: () => wantEither('UPSTASH_REDIS_REST_URL', 'KV_REST_API_URL'),
  redisToken: () => wantEither('UPSTASH_REDIS_REST_TOKEN', 'KV_REST_API_TOKEN'),

  qstashToken: () => want('QSTASH_TOKEN'),
  /**
   * QStash tokens are regional. The console exports QSTASH_URL alongside the
   * token, and a token for qstash-us-east-1 answers 404 at the default
   * qstash.upstash.io, so the URL has to travel with it.
   */
  qstashUrl: () => want('QSTASH_URL'),

  scannerUrl: () => need('SCANNER_URL'),
  scannerSharedSecret: () => need('SCANNER_SHARED_SECRET'),

  /**
   * Stripe's dashboard calls this the secret key and its own docs sometimes
   * call it the API key, so both spellings are accepted rather than making
   * someone rename a variable they pasted from one page or the other.
   */
  stripeSecretKey: () => needEither('STRIPE_SECRET_KEY', 'STRIPE_API_KEY'),
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
