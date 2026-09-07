/**
 * Affonso, the affiliate program — the names both sides agree on.
 *
 * Deliberately importless. The cookie names are needed by a server route and by
 * a browser component, and the moment this file reaches for `next/headers` it
 * stops being safe for the second one: importing it from a client component
 * pulls a server-only module into the browser bundle and the build fails. The
 * half that reads cookies lives in affonso-server.ts for exactly that reason.
 */

/** Written by the pixel in app/layout.tsx when somebody arrives on an affiliate's link. */
export const REFERRAL_COOKIE = 'affonso_referral';

/**
 * Set by app/auth/callback for one hop when somebody has just signed up, and
 * spent by components/site/AffonsoSignup. It carries the address because the
 * only thing that reads it is a browser about to hand that address to Affonso
 * anyway.
 */
export const SIGNUP_COOKIE = 'affonso_signup';
