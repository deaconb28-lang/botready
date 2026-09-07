'use client';

import { useEffect } from 'react';

import { SIGNUP_COOKIE } from '@/lib/affonso';

/**
 * Tell Affonso that somebody signed up.
 *
 * The fact is established on the server — app/auth/callback is the only place
 * that can tell a new account from a returning one — and the call has to be
 * made here, because `window.Affonso` is the pixel and the pixel is in the
 * browser. The cookie is the hop between the two, and spending it is a delete:
 * whatever happens next, this fires once.
 *
 * The pixel is async, so it may not have defined `window.Affonso` by the time
 * this mounts. Rather than assume, it polls briefly and gives up after five
 * seconds — an unreported signup is a gap in a report, and a component that
 * polls forever on every page of the site is a worse thing to have shipped.
 */

interface AffonsoApi {
  signup?: (email: string) => void;
}

const EVERY_MS = 250;
const GIVE_UP_AFTER = 20;

export function AffonsoSignup() {
  useEffect(() => {
    const email = read(SIGNUP_COOKIE);
    if (!email) return;

    let tries = 0;
    const fire = (): boolean => {
      const affonso = (window as unknown as { Affonso?: AffonsoApi }).Affonso;
      if (typeof affonso?.signup !== 'function') return false;
      try {
        affonso.signup(email);
      } finally {
        // Cleared even if their script throws. One attempt is the contract; a
        // signup reported twice is worse than one reported never.
        clear(SIGNUP_COOKIE);
      }
      return true;
    };

    if (fire()) return;
    const timer = setInterval(() => {
      tries += 1;
      if (fire() || tries >= GIVE_UP_AFTER) clearInterval(timer);
    }, EVERY_MS);
    return () => clearInterval(timer);
  }, []);

  return null;
}

function read(name: string): string | null {
  const hit = document.cookie.split('; ').find((row) => row.startsWith(`${name}=`));
  return hit ? decodeURIComponent(hit.slice(name.length + 1)) : null;
}

function clear(name: string): void {
  document.cookie = `${name}=; path=/; max-age=0; samesite=lax`;
}
