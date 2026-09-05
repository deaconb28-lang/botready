'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { GradeChip, cx } from '@/components/ui';

export interface NavItem {
  group: 'Diagnose' | 'Fix & watch';
  label: string;
  href: string;
  meta: string;
  tone: 'bad' | 'neutral';
}

/**
 * The 272px sidebar. Active rows are lime with a 2px hard shadow; each row
 * carries a right-aligned mono meta value. Under 900px it collapses into a
 * drawer behind a button in the corner.
 */
export function AppSidebar({
  property,
  nav,
  promo,
}: {
  property: { domain: string; grade: string | null; total: number | null; run: number; status: string } | null;
  nav: NavItem[];
  promo: { title: string; body: string; cta: string; href: string };
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => setOpen(false), [pathname]);

  const groups: Array<NavItem['group']> = ['Diagnose', 'Fix & watch'];

  const body = (
    <>
      <div>
        <div className="mb-[10px] font-mono text-[12px] tracking-[0.1em] text-subtle uppercase">Property</div>
        {property ? (
          <div className="edge rounded-[12px] bg-white p-[14px] shadow-hard-3">
            <div className="truncate font-body text-[16px] font-bold" title={property.domain}>
              {property.domain}
            </div>
            <div className="mt-[9px] flex items-center gap-[9px]">
              {property.grade ? (
                <GradeChip grade={property.grade} healthy={/^[AB]/.test(property.grade)} />
              ) : (
                <span className="edge rounded-[7px] bg-canvas px-2 py-px font-mono text-[12.5px] font-bold text-subtle">{property.status === 'blocked' ? '403' : '··'}</span>
              )}
              <span className="font-mono text-[13px] text-quiet">
                {property.total !== null ? `${property.total}/100` : property.status === 'blocked' ? 'refused' : 'no result'} · run {String(property.run).padStart(2, '0')}
              </span>
            </div>
          </div>
        ) : (
          <div className="rounded-[12px] border-2 border-dashed border-dashed bg-surface-alt p-[14px] text-[13.5px] text-quiet">No property yet. Run a scan and claim the domain.</div>
        )}
      </div>

      {/* Above the nav rather than pinned to the bottom with mt-auto. Eight nav
          rows is enough to push it under the fold on a laptop, and the thing
          being sold should not be the one panel you have to scroll a sidebar
          to find. */}
      <div className="edge on-dark rounded-[14px] bg-violet p-[18px] text-white shadow-hard-3">
        <div className="display text-[17px] leading-[1.2]">{promo.title}</div>
        <p className="mb-[14px] mt-[9px] font-mono text-[13px] leading-[1.5] text-on-violet">{promo.body}</p>
        <a
          href={promo.href}
          className="edge block w-full rounded-[10px] bg-lime px-3 py-[11px] text-center font-body text-[14px] font-bold text-ink no-underline shadow-hard-2 hover:bg-white"
        >
          {promo.cta}
        </a>
      </div>

      {nav.length > 0
        ? groups.map((group) => (
            <div key={group}>
              <div className="mb-[10px] font-mono text-[12px] tracking-[0.1em] text-subtle uppercase">{group}</div>
              <div className="grid gap-[9px]">
                {nav
                  .filter((n) => n.group === group)
                  .map((n) => {
                    const active = pathname === n.href;
                    return (
                      <Link
                        key={n.href}
                        href={n.href}
                        aria-current={active ? 'page' : undefined}
                        className={cx(
                          'edge flex w-full items-center justify-between gap-[10px] rounded-[11px] px-[13px] py-[11px] text-left font-body text-[14.5px] text-ink no-underline',
                          active ? 'bg-lime font-bold shadow-hard-2' : 'bg-white font-medium hover:bg-lime-tint',
                        )}
                      >
                        <span className="whitespace-nowrap">{n.label}</span>
                        <span className={cx('truncate font-mono text-[12.5px] font-medium', n.tone === 'bad' ? 'text-coral-text' : 'text-subtle')}>{n.meta}</span>
                      </Link>
                    );
                  })}
              </div>
            </div>
          ))
        : null}

    </>
  );

  return (
    <>
      <aside className="hidden w-[272px] flex-none flex-col gap-[22px] border-r-2 border-ink bg-white px-[18px] py-[22px] min-[900px]:flex" aria-label="App navigation">
        {body}
      </aside>

      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        aria-controls="app-drawer"
        className="edge fixed bottom-4 left-4 z-40 cursor-pointer rounded-full bg-lime px-4 py-[10px] font-body text-[13.5px] font-bold text-ink shadow-hard-3 min-[900px]:hidden"
      >
        Menu
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 min-[900px]:hidden" role="dialog" aria-modal="true" aria-label="App navigation">
          <button type="button" aria-label="Close the menu" onClick={() => setOpen(false)} className="absolute inset-0 cursor-pointer border-0 bg-ink/40" />
          <aside id="app-drawer" className="absolute inset-y-0 left-0 flex w-[288px] max-w-[88vw] flex-col gap-[22px] overflow-y-auto border-r-2 border-ink bg-white px-[18px] py-[22px]">
            <button type="button" onClick={() => setOpen(false)} className="edge w-fit cursor-pointer rounded-[9px] bg-white px-3 py-[6px] font-mono text-[12.5px] font-bold">
              × Close
            </button>
            {body}
          </aside>
        </div>
      ) : null}
    </>
  );
}
