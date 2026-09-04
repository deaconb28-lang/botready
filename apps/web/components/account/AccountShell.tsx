import type { ReactNode } from 'react';
import Link from 'next/link';

import { Mark, cx } from '@/components/ui';

export type AccountSection = 'domains' | 'billing' | 'settings';

const TABS: Array<{ id: AccountSection; label: string; href: string }> = [
  { id: 'domains', label: 'Domains', href: '/account' },
  { id: 'billing', label: 'Plan & billing', href: '/account/billing' },
  { id: 'settings', label: 'Settings', href: '/account/settings' },
];

/**
 * The signed-in frame: a sticky white header with the wordmark, the three
 * section pills (lime when active), the signed-in email in mono, and Sign out
 * as a real form post. The main measure is 1140px.
 */
export function AccountShell({ email, active, children }: { email: string; active: AccountSection; children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-canvas">
      <header className="sticky top-0 z-50 border-b-2 border-ink bg-white">
        <div className="mx-auto flex max-w-[1140px] items-center gap-4 px-6 py-3">
          <Link href="/" className="flex items-center gap-[10px] whitespace-nowrap font-display text-[19px] font-bold tracking-[-0.02em] text-ink no-underline hover:text-ink">
            <Mark size={28} />
            BotReady
          </Link>

          <nav aria-label="Account" className="ml-[10px] flex flex-wrap gap-2">
            {TABS.map((tab) => {
              const current = tab.id === active;
              return (
                <Link
                  key={tab.id}
                  href={tab.href}
                  aria-current={current ? 'page' : undefined}
                  className={cx(
                    'edge whitespace-nowrap rounded-full px-[15px] py-[7px] font-body text-[13.5px] text-ink no-underline transition-colors duration-150 hover:text-ink',
                    current ? 'bg-lime font-bold' : 'bg-white font-medium',
                  )}
                >
                  {tab.label}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            <span className="hidden whitespace-nowrap font-mono text-[12.5px] text-quiet sm:inline">{email}</span>
            <form method="post" action="/api/auth/sign-out">
              <button
                type="submit"
                className="edge cursor-pointer whitespace-nowrap rounded-full bg-white px-[14px] py-2 font-body text-[12.5px] font-semibold text-ink transition-colors duration-150 hover:bg-coral"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      <main id="main" className="mx-auto max-w-[1140px] px-6 pb-[72px] pt-[30px]">
        {children}
      </main>
    </div>
  );
}
