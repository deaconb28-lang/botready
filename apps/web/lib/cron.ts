import { timingSafeEqual } from 'node:crypto';

import { serverEnv } from './env';

/**
 * Vercel calls the cron routes with `Authorization: Bearer <CRON_SECRET>`.
 * Without the secret configured the routes refuse to run at all, because a
 * cron that anyone can trigger is a cron that queues two hundred scans
 * whenever someone feels like it.
 */
export function authoriseCron(request: Request): { ok: true } | { ok: false; status: number; error: string } {
  const secret = serverEnv.cronSecret();
  if (!secret) {
    return { ok: false, status: 503, error: 'CRON_SECRET is not set, so the cron routes are disabled.' };
  }

  const header = request.headers.get('authorization') ?? '';
  const presented = header.startsWith('Bearer ') ? header.slice(7) : '';
  const a = Buffer.from(presented);
  const b = Buffer.from(secret);

  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, status: 401, error: 'This route needs the cron bearer token.' };
  }
  return { ok: true };
}
