import type { Metadata } from 'next';

import { catalog, categoryPoints } from '@botready/core';

import { Footer, Measure, Microcopy, Nav, SectionHeading, Shell } from '@/components/primitives';
import { LIMITS } from '@/lib/site';

export const metadata: Metadata = {
  title: 'What we check',
  description:
    'The full check catalog and the weights, published. Twenty-one checks across six categories, scoring version 1.2.',
};

/**
 * The weights are published, and this is where. Arguing about the weights in
 * public is free marketing, and it only works if there is something to argue
 * with. The page is generated from checks.json, so it cannot drift from what
 * the scorer actually does.
 */
export default function WhatWeCheckPage() {
  return (
    <Shell>
      <Nav />

      <Measure as="main" className="pb-14 pt-6">
        <p id="main" className="label text-fail">
          Scoring v{catalog.scoringVersion}
        </p>
        <h1 className="display-hero mt-3 text-[40px] sm:text-[60px]">What we check</h1>
        <p className="mt-4 max-w-[64ch] text-[16px] text-ink-60">
          {catalog.checks.length} checks across {catalog.categories.length} categories. The weights are
          below because publishing them is the only way the score can be argued with, and a score
          nobody can argue with is a horoscope.
        </p>

        <section className="mt-12">
          <SectionHeading kicker="The arithmetic">The weights</SectionHeading>
          <p className="mt-3 max-w-[66ch] text-[14.5px] leading-[1.55] text-ink-60">
            A category&rsquo;s score is the share of its available points earned. A pass earns all of
            them, a warn earns half, a fail and an error earn none, and a skipped check leaves the
            denominator rather than counting as a zero. Changing any number here is a versioned event,
            not a tweak: every score row records the version that produced it, so history can be
            re-scored instead of overwritten.
          </p>

          {/* Wide content scrolls inside its own container rather than making the
              page scroll sideways, and the container is focusable so a keyboard
              reader can reach it. */}
          <div className="mt-6 overflow-x-auto" tabIndex={0} role="group" aria-label="Category weights">
            <table className="w-full min-w-[520px] border-collapse">
              <thead>
                <tr className="label text-ink-60">
                  <Th>Category</Th>
                  <Th align="right">Weight</Th>
                  <Th align="right">Checks</Th>
                  <Th align="right">Points</Th>
                </tr>
              </thead>
              <tbody>
                {catalog.categories.map((category) => (
                  <tr key={category.key} className="border-b border-rule">
                    <td className="py-3 pr-3 text-[15px] font-semibold">
                      <a href={`#${category.key}`} className="hover:underline">
                        {category.label}
                      </a>
                    </td>
                    <Td align="right">{category.weight}%</Td>
                    <Td align="right">{catalog.checks.filter((c) => c.category === category.key).length}</Td>
                    <Td align="right">{categoryPoints(category.key)}</Td>
                  </tr>
                ))}
                <tr>
                  <td className="py-3 pr-3 text-[15px] font-semibold">Total</td>
                  <Td align="right">{catalog.categories.reduce((sum, c) => sum + c.weight, 0)}%</Td>
                  <Td align="right">{catalog.checks.length}</Td>
                  <Td align="right">{catalog.categories.reduce((sum, c) => sum + categoryPoints(c.key), 0)}</Td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-12">
          <SectionHeading kicker="Pass A">The clients</SectionHeading>
          <p className="mt-3 max-w-[66ch] text-[14.5px] leading-[1.55] text-ink-60">
            We request your page once as each of these, sequentially, one second apart. The Chrome
            request is the control and everything else is compared against it.
          </p>
          <ul className="mt-5 list-none p-0">
            {catalog.agents.map((agent) => (
              <li key={agent.id} className="wire-line flex flex-wrap items-baseline gap-x-4 border-b border-dashed border-rule py-2">
                <span className="w-[100px] shrink-0 font-bold">{agent.id}</span>
                <span className="min-w-0 flex-1 text-ink-60">User-Agent: {agent.ua}</span>
                <span className="text-ink-60">{agent.role}</span>
              </li>
            ))}
          </ul>
        </section>

        {catalog.categories.map((category) => (
          <section key={category.key} className="mt-12">
            <SectionHeading id={category.key} kicker={`weight ${category.weight}% · ${categoryPoints(category.key)} points`}>
              {category.label}
            </SectionHeading>
            <dl className="mt-2">
              {catalog.checks
                .filter((check) => check.category === category.key)
                .map((check) => (
                  <div key={check.key} className="border-b border-rule py-5">
                    <dt className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                      <span className="text-[16px] font-semibold">{check.label}</span>
                      <span className="mono text-[12px] text-ink-60">
                        {check.points} {check.points === 1 ? 'point' : 'points'}
                      </span>
                    </dt>
                    <dd className="mt-1.5">
                      <p className="mono text-[12px] text-ink-60">{check.key}</p>
                      {check.fails_when ? (
                        <p className="mt-2 text-[14px] text-ink-60">
                          <span className="mono text-fail">fails when</span> {check.fails_when}
                        </p>
                      ) : null}
                      {check.warns_when ? (
                        <p className="mt-1 text-[14px] text-ink-60">
                          <span className="mono text-warn">warns when</span> {check.warns_when}
                        </p>
                      ) : null}
                    </dd>
                  </div>
                ))}
            </dl>
          </section>
        ))}

        <section className="mt-12">
          <SectionHeading kicker="Letters">The grade bands</SectionHeading>
          <ul className="mono mt-4 flex flex-wrap gap-x-8 gap-y-2 p-0 text-[13px]">
            {[...catalog.grades]
              .sort((a, b) => b.min - a.min)
              .map((band, index, all) => {
                const upper = index === 0 ? 100 : (all[index - 1]?.min ?? 100) - 1;
                return (
                  <li key={band.grade} className="list-none">
                    <span className="display-section text-[20px]">{band.grade}</span>{' '}
                    <span className="text-ink-60">
                      {band.min}
                      {upper > band.min ? `–${upper}` : ''}
                    </span>
                  </li>
                );
              })}
          </ul>
        </section>

        <section className="mt-12">
          <SectionHeading kicker="Limits, stated here rather than in a footer">What we will not do</SectionHeading>
          <ul className="mt-4 max-w-[70ch] list-none space-y-3 p-0 text-[14.5px] leading-[1.55] text-ink-60">
            <li>
              <span className="text-ink">We never work around a block.</span> If your site refuses{' '}
              <span className="mono">BotreadyBot/1.0</span>, we record it as refused and display it as
              refused. No second request under another user agent, no residential proxies, no captcha
              solving.
            </li>
            <li>
              <span className="text-ink">We read at most {LIMITS.maxPagesPerScan} pages.</span> Sequentially,{' '}
              {LIMITS.pageDelayMs / 1000} second apart. We are a diagnostic tool, not a load generator.
            </li>
            <li>
              <span className="text-ink">We obey your robots.txt.</span> Including when it is the thing
              being measured, and CI asserts it.
            </li>
            <li>
              <span className="text-ink">We do not scan behind auth.</span> A URL with credentials in it is
              refused rather than followed.
            </li>
          </ul>
          <Microcopy className="mt-5 max-w-[72ch] leading-[1.7]">
            The catalog above is data, not code: adding, retiring or reweighting a check is an edit to
            one JSON file, which is why the numbers on this page cannot disagree with the scores on the
            result pages.
          </Microcopy>
        </section>
      </Measure>

      <Footer />
    </Shell>
  );
}

function Th({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return (
    <th scope="col" className={`border-b border-ink pb-2.5 pr-3 ${align === 'right' ? 'text-right' : 'text-left'}`}>
      {children}
    </th>
  );
}

function Td({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return <td className={`mono py-3 pr-3 text-[13px] ${align === 'right' ? 'text-right' : 'text-left'}`}>{children}</td>;
}
