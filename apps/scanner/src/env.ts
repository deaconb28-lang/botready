/**
 * Environment, read once and validated at boot rather than discovered at
 * request time. A worker that starts up healthy and then 500s on its first job
 * because a variable is missing is worse than one that refuses to start.
 */

function required(name: string): string {
  const v = process.env[name];
  if (!v) {
    throw new Error(
      `${name} is not set. The worker needs it at boot. See .env.example for the full list.`,
    );
  }
  return v;
}

function optional(name: string): string | undefined {
  return process.env[name] || undefined;
}

export const env = {
  port: Number(process.env.PORT ?? 8080),
  nodeEnv: process.env.NODE_ENV ?? 'development',

  /** The worker rejects any request that does not carry this header. */
  sharedSecret: required('SCANNER_SHARED_SECRET'),

  /**
   * Session pooler, not the transaction pooler. The worker holds a long-lived
   * connection and the transaction pooler will drop prepared statements under it.
   */
  databaseUrl: required('DATABASE_URL'),

  /**
   * QStash signs its callbacks. Without these the worker will accept a job from
   * anyone who learns the shared secret, so they are required in production and
   * optional locally, where you POST to the worker by hand.
   */
  qstashCurrentSigningKey: optional('QSTASH_CURRENT_SIGNING_KEY'),
  qstashNextSigningKey: optional('QSTASH_NEXT_SIGNING_KEY'),

  /** Where the worker believes it is reachable, for QStash signature checks. */
  publicUrl: optional('SCANNER_URL'),

  /** How many scans may be in flight at once. Small on purpose. */
  concurrency: Number(process.env.SCANNER_CONCURRENCY ?? 2),

  /** Set in the Railway image and in CI, where a browser is already present. */
  chromiumExecutable: optional('CHROMIUM_EXECUTABLE_PATH'),
} as const;

export function requireQstashVerification(): boolean {
  return env.nodeEnv === 'production';
}
