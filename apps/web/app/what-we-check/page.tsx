import type { Metadata } from 'next';

import { catalog, checksInCategory, effectivePoints } from '@botready/core';

import { SiteFooter } from '@/components/site/SiteFooter';
import { SiteHeader } from '@/components/site/SiteHeader';
import { Card, Container, Eyebrow, PageTitle, cx } from '@/components/ui';
import { CATEGORY_PAINT } from '@/lib/theme';

export const metadata: Metadata = {
  title: 'What we check',
  description: `The full check catalog and the weights, published. ${catalog.checks.length} checks across ${catalog.categories.length} categories, scoring version ${catalog.scoringVersion}.`,
  alternates: { canonical: '/what-we-check' },
};

const MAX_WEIGHT = Math.max(...catalog.categories.map((c) => c.weight));
const TOTAL_POINTS = catalog.categories.reduce((sum, c) => sum + c.weight, 0);

/**
 * The weights are published, and this is where. The page is generated from
 * checks.json, so it cannot drift from what the scorer actually does.
 */
/** One decimal, and no trailing zero on the checks that land whole. */
function formatPoints(value: number): string {
  return value.toFixed(1).replace(/\.0$/, '');
}

export default function WhatWeCheckPage() {
  return (
    <div className="min-h-dvh bg-canvas">
      <SiteHeader />
      <Container as="main" id="main" width={960} className="pb-24 pt-14">
        <PageTitle eyebrow={`Scoring v${catalog.scoringVersion}`} size="xl">
          What we check
        </PageTitle>
        <p className="mt-[18px] max-w-[58ch] text-[17.5px] leading-[1.6] text-muted">
          {catalog.checks.length} checks across {catalog.categories.length} categories. The weights are below because publishing them is the
          only way the score can be argued with, and a score nobody can argue with is a horoscope.
        </p>

        <div className="edge mt-7 rounded-[16px] bg-surface-alt px-6 py-5">
          <h2 className="display text-[17px]">How the arithmetic works</h2>
          <p className="mt-2 max-w-[68ch] text-[15px] leading-[1.6] text-muted">
            Every number on this page is out of the same 100. A category is worth its weight; the checks inside it split that weight
            between them; and the figure beside each check is exactly what failing it takes off your score — the same number the findings
            list on your result prints back to you. A pass earns all of it, a warn earns half, a fail and an error earn none, and a check
            we could not run at all leaves the denominator instead of counting as a zero.
          </p>
          <p className="mt-3 max-w-[68ch] text-[15px] leading-[1.6] text-muted">
            The weights themselves are our estimates, argued for one by one below and not yet measured against whether a site actually
            gets cited. We are collecting that evidence now and will publish it, alongside whatever it says about these numbers, before we
            change them. Changing any of them is a versioned event: every score records the version that produced it, so history is
            re-scored rather than quietly rewritten.
          </p>
        </div>

        {/* The weights, as a bar chart. */}
        <figure id="weights" className="m-0 mt-9">
          <div className="edge flex h-[150px] items-end gap-[10px] rounded-[18px] bg-ink p-[22px] shadow-violet-5" role="img" aria-label={`Category weights: ${catalog.categories.map((c) => `${c.label} ${c.weight}%`).join(', ')}`}>
            {catalog.categories.map((c) => (
              <div key={c.key} className="flex h-full flex-1 flex-col justify-end gap-2">
                <div
                  className="rounded-t-[8px] border-2 border-lime transition-[height] duration-[800ms] ease-out"
                  style={{ height: `${(c.weight / MAX_WEIGHT) * 100}%`, background: CATEGORY_PAINT[c.key].color }}
                />
                <div className="overflow-hidden text-ellipsis whitespace-nowrap text-center font-mono text-[10.5px] font-medium text-subtle-2 uppercase">{c.label.slice(0, 4)}</div>
              </div>
            ))}
          </div>
          <figcaption className="sr-only">Heights are normalised against the {MAX_WEIGHT}% maximum.</figcaption>
        </figure>

        <div className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-4">
          {catalog.categories.map((c) => {
            const paint = CATEGORY_PAINT[c.key];
            const checks = checksInCategory(c.key);
            return (
              <Card key={c.key} radius="card-lg" shadow={4} lift className="p-5" style={{ background: paint.tint }}>
                <div className="flex items-start gap-[14px]">
                  <div className="edge min-w-[64px] flex-none rounded-[12px] px-2 py-[10px] text-center font-display text-[22px] font-bold tracking-[-0.03em] text-ink" style={{ background: paint.color }}>
                    {c.weight}%
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="display text-[19px]">{c.label}</h2>
                    <p className="mt-1 text-[14px] leading-[1.45] text-muted">{paint.what}</p>
                  </div>
                </div>
                <div className="mt-4 flex gap-[5px]" aria-hidden="true">
                  {checks.map((ck, i) => (
                    <div key={ck.key} className="anim-pip edge h-[10px] flex-1 rounded-full" style={{ background: paint.color, ['--i' as string]: i }} />
                  ))}
                </div>
                <div className="mt-[10px] flex justify-between gap-[10px] font-mono text-[12px] font-medium text-muted">
                  <span>{checks.length} checks</span>
                  <span>{c.weight} of the 100</span>
                </div>
              </Card>
            );
          })}
        </div>

        <div className="edge mt-4 flex flex-wrap items-center justify-between gap-4 rounded-[16px] bg-lime px-6 py-[18px] shadow-hard-4">
          <span className="display text-[22px]">Everything adds up</span>
          <div className="flex gap-[22px] font-mono text-[14px] font-bold">
            <span>{catalog.checks.length} checks</span>
            <span>{TOTAL_POINTS} points</span>
            <span>one score</span>
          </div>
        </div>

        <h2 className="display mb-2 mt-12 text-[30px] tracking-[-0.03em]">The clients</h2>
        <p className="mb-[18px] max-w-[62ch] text-[16px] leading-[1.6] text-muted">
          We request your page once as each of these, sequentially, one second apart. The Chrome request is the control and everything
          else is compared against it.
        </p>
        <Card radius="card-lg" shadow={4} className="overflow-hidden">
          <ul className="m-0 list-none p-0">
            {catalog.agents.map((agent, i) => (
              <li key={agent.id} className={cx('flex items-center gap-4 px-[22px] py-[14px]', i < catalog.agents.length - 1 && 'border-b border-hairline-2')}>
                <span className="min-w-[100px] font-mono text-[13px] font-medium">{agent.id}</span>
                <span className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap font-mono text-[12.5px] text-subtle-2" title={agent.ua}>
                  {agent.ua}
                </span>
                <span className={cx('rounded-[7px] px-[10px] py-1 font-mono text-[11.5px] font-medium', agent.role === 'control' ? 'bg-violet-chip text-violet' : 'bg-hairline-2 text-subtle-2')}>
                  {agent.role}
                </span>
              </li>
            ))}
          </ul>
        </Card>

        <h2 className="display mb-[18px] mt-12 text-[30px] tracking-[-0.03em]">The checks</h2>
        {catalog.categories.map((c) => (
          <section key={c.key} id={c.key} className="mt-6 first:mt-0">
            <Eyebrow className="mb-3">
              {c.label} · {c.weight} of the 100
            </Eyebrow>
            {c.rationale ? <p className="mb-3 max-w-[68ch] text-[15px] leading-[1.6] text-muted">{c.rationale}</p> : null}
            <div className="grid gap-3">
              {checksInCategory(c.key).map((ck) => (
                <Card key={ck.key} radius="card" shadow={3} className="px-[22px] py-5">
                  <div className="flex flex-wrap items-baseline justify-between gap-4">
                    <h3 className="display text-[17.5px] font-semibold">{ck.label}</h3>
                    <span className="font-mono text-[11.5px] text-placeholder">
                      {formatPoints(effectivePoints(ck.key))} of the 100
                    </span>
                  </div>
                  <div className="mt-[7px] font-mono text-[12.5px] text-subtle-2">{ck.key}</div>
                  {ck.rationale ? <p className="mt-3 max-w-[68ch] text-[14.5px] leading-[1.6] text-muted">{ck.rationale}</p> : null}
                  {ck.fails_when ? <div className="mt-2 font-mono text-[13px] text-coral-text">fails when {ck.fails_when}</div> : null}
                  {ck.warns_when ? <div className="mt-1 font-mono text-[13px] text-amber-text">warns when {ck.warns_when}</div> : null}
                </Card>
              ))}
            </div>
          </section>
        ))}
      </Container>
      <SiteFooter />
    </div>
  );
}
