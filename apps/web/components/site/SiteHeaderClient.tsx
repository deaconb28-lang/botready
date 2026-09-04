'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

import { useMode } from '@/lib/mode';
import { Button, Wordmark, cx } from '@/components/ui';

const NAV: Array<{ label: string; href: string }> = [
  { label: 'Why AEO', href: '/#aeo' },
  { label: 'What we check', href: '/what-we-check' },
  { label: 'Pricing', href: '/pricing' },
  { label: 'Index', href: '/index/saas' },
  { label: 'Crawler', href: '/bot' },
];

const HEADER_OFFSET = 80;

/**
 * Sticky, translucent over the canvas, with the Plain ⇄ Technical switch on
 * the right. "Why AEO" smooth-scrolls to #aeo on the home page with an 80px
 * offset for the sticky header, and navigates there from anywhere else.
 */
export function SiteHeaderClient({ signedIn }: { signedIn: boolean }) {
  const { mode, toggle } = useMode();
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  useEffect(() => setOpen(false), [pathname]);

  function goAeo(event: React.MouseEvent) {
    if (pathname !== '/') return;
    event.preventDefault();
    const el = document.getElementById('aeo');
    if (!el) return;
    window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - HEADER_OFFSET, behavior: 'smooth' });
  }

  function runCheck() {
    if (pathname === '/') {
      document.getElementById('scan-url')?.focus();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      router.push('/#check');
    }
  }

  return (
    <header className="sticky top-0 z-[60] border-b-2 border-ink bg-[rgba(247,247,244,.88)] backdrop-blur-[14px]">
      <div className="mx-auto flex max-w-[1200px] items-center gap-5 px-6 py-[14px] sm:px-[26px]">
        <Wordmark />

        <nav aria-label="Site" className="mx-auto hidden min-w-0 gap-5 lg:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={item.href === '/#aeo' ? goAeo : undefined}
              className={cx(
                'whitespace-nowrap py-[6px] font-body text-[14.5px] font-medium text-muted no-underline hover:text-ink',
                pathname === item.href && 'text-ink',
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-3 lg:ml-0">
          <button
            type="button"
            onClick={toggle}
            aria-pressed={mode === 'tech'}
            aria-label={mode === 'plain' ? 'Switch to technical language' : 'Switch to plain language'}
            className="edge hidden cursor-pointer whitespace-nowrap rounded-[9px] bg-white px-3 py-2 font-body text-[13px] font-medium text-muted hover:text-ink sm:inline-block"
          >
            {mode === 'plain' ? 'Plain ⇄' : 'Technical ⇄'}
          </button>
          <Link
            href={signedIn ? '/app' : '/sign-in'}
            className="hidden whitespace-nowrap py-[6px] font-body text-[14.5px] font-medium text-muted no-underline hover:text-ink sm:inline-block"
          >
            {signedIn ? 'Open the app' : 'Log in'}
          </Link>
          <Button onClick={runCheck} tone="ink" size="md">
            Run a check
          </Button>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="site-menu"
            aria-label={open ? 'Close the menu' : 'Open the menu'}
            className="edge flex h-10 w-10 cursor-pointer items-center justify-center rounded-[9px] bg-white lg:hidden"
          >
            <span aria-hidden="true" className="font-mono text-[14px] font-bold">
              {open ? '×' : '≡'}
            </span>
          </button>
        </div>
      </div>

      <div id="site-menu" hidden={!open} className="border-t-2 border-ink bg-white lg:hidden">
        <nav aria-label="Site, mobile" className="mx-auto grid max-w-[1200px] gap-1 px-6 py-3">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={item.href === '/#aeo' ? goAeo : undefined}
              className="rounded-[9px] px-2 py-2 font-body text-[15px] font-medium text-ink no-underline hover:bg-surface-alt"
            >
              {item.label}
            </Link>
          ))}
          <Link href={signedIn ? '/app' : '/sign-in'} className="rounded-[9px] px-2 py-2 font-body text-[15px] font-medium text-ink no-underline hover:bg-surface-alt">
            {signedIn ? 'Open the app' : 'Log in'}
          </Link>
          <button
            type="button"
            onClick={toggle}
            className="edge mt-1 w-fit cursor-pointer rounded-[9px] bg-white px-3 py-2 font-body text-[13px] font-medium text-muted"
          >
            {mode === 'plain' ? 'Plain ⇄ switch to technical' : 'Technical ⇄ switch to plain'}
          </button>
        </nav>
      </div>
    </header>
  );
}
