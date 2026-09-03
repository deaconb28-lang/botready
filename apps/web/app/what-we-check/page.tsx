import type { Metadata } from 'next';

import { catalog, categoryPoints } from '@botready/core';

import { Footer, Microcopy, Nav } from '@/components/primitives';
import { LIMITS } from '@/lib/site';

export const metadata: Metadata = {
  title: 'What we check',
  description:
    'The full check catalog and the weights, published. Twenty-one checks across six categories, scoring version 1.2.',
};

/**
 * The weights are published, and this is where. That is not transparency
 * theatre: arguing about the weights in public is free marketing, and it only
 * works if there is something to argue with. The page is generated from
 * checks.json, so it cannot drift from what the scorer actually does.
 */
export default function WhatWeCheckPage() {
  return (
    <div className="mx-auto min-h-dvh max-w-[1240px] bg-paper">
      <Nav />

      <main id="main" className="px-5 pb-14 pt-10 sm:px-7">
        <h1
          className="font-display text-[30px] font-extrabold tracking-[-0.02em] sm:text-[38px]"
          style={{ fontVariationSettings: "'wdth' 112" }}
        >
          What we check
        </h1>
        <p className="mt-3 max-w-[68ch] text-[16px] text-ink-60">
          {catalog.checks.length} checks across {catalog.categories.length} categories, scoring
          version {catalog.scoringVersion}. The weights are below because publishing them is the
          only way the score can be argued with, and a score nobody can argue with is a horoscope.
        </p>

        <section className="mt-8">
          <h2 className="text-[20px] font-bold">The weights</h2>
          <p className="mt-1 mb-4 max-w-[68ch] text-[14px] text-ink-60">
            A category&rsquo;s score is the share of its available points earned. A pass earns all
            of them, a warn earns half, a fail and an error earn none, and a skipped check leaves
            the denominator rather than counting as a zero. Changing any number here is a versioned
            event, not a tweak: every score row records the version that produced it, so history
            can be re-scored instead of overwritten.
          </p>

          {/* Wide content scrolls inside its own container rather than making
              the page scroll sideways, and the container is focusable so a
              keyboard reader can reach it. */}
          <div
            className="overflow-x-auto"
            tabIndex={0}
            role="group"
            aria-label="Category weights"
          >
            <table className="w-full min-w-[520px] border-collapse text-[14px]">
              <thead>
                <tr>
                  <Th>Category</Th>
                  <Th align="right">Weight</Th>
                  <Th align="right">Checks</Th>
                  <Th align="right">Points</Th>
                </tr>
              </thead>
              <tbody>
                {catalog.categories.map((category) => (
                  <tr key={category.key} className="border-b border-rule">
                    <td className="py-3 pr-2.5 font-body text-[14.5px] font-semibold">
                      <a href={`#${category.key}`} className="hover:underline">
                        {category.label}
                      </a>
                    </td>
                    <Td align="right">{category.weight}%</Td>
                    <Td align="right">
                      {catalog.checks.filter((c) => c.category === category.key).length}
                    </Td>
                    <Td align="right">{categoryPoints(category.key)}</Td>
                  </tr>
                ))}
                <tr>
                  <td className="py-3 pr-2.5 font-body text-[14.5px] font-semibold">Total</td>
                  <Td align="right">
                    {catalog.categories.reduce((sum, c) => sum + c.weight, 0)}%
                  </Td>
                  <Td align="right">{catalog.checks.length}</Td>
                  <Td align="right">
                    {catalog.categories.reduce((sum, c) => sum + categoryPoints(c.key), 0)}
                  </Td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-10">
          <h2 className="text-[20px] font-bold">The clients</h2>
          <p className="mt-1 mb-4 max-w-[68ch] text-[14px] text-ink-60">
            We request your page once as each of these, sequentially, one second apart. The Chrome
            request is the control and everything else is compared against it.
          </p>
          <ul className="list-none p-0">
            {catalog.agents.map((agent) => (
              <li
                key={agent.id}
                className="flex flex-wrap items-baseline gap-x-3 border-b border-dashed border-rule py-2 font-data text-[12.5px]"
              >
                <span className="w-[100px] shrink-0 font-bold">{agent.id}</span>
                <span className="min-w-0 flex-1 break-all text-ink-60">{agent.ua}</span>
                <span className="text-ink-60">{agent.role}</span>
              </li>
            ))}
          </ul>
        </section>

        {catalog.categories.map((category) => (
          <section key={category.key} id={category.key} className="mt-10 scroll-mt-6">
            <div className="flex items-baseline justify-between gap-4 border-b-2 border-ink pb-2">
              <h2 className="text-[20px] font-bold">{category.label}</h2>
              <span className="font-data text-[12.5px] text-ink-60">
                weight {category.weight}% · {categoryPoints(category.key)} points
              </span>
            </div>

            <dl className="mt-4">
              {catalog.checks
                .filter((check) => check.category === category.key)
                .map((check) => (
                  <div key={check.key} className="border-b border-rule py-4">
                    <dt className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                      <span className="text-[15.5px] font-semibold">{check.label}</span>
                      <span className="font-data text-[12px] text-ink-60">
                        {check.points} {check.points === 1 ? 'point' : 'points'}
                      </span>
                    </dt>
                    <dd className="mt-1.5">
                      <p className="font-data text-[12px] text-ink-60">{check.key}</p>
                      {check.fails_when ? (
                        <p className="mt-1.5 text-[13.5px] text-ink-60">
                          <span className="font-data text-fail">fails when</span>{' '}
                          {check.fails_when}
                        </p>
                      ) : null}
                      {check.warns_when ? (
                        <p className="mt-1 text-[13.5px] text-ink-60">
                          <span className="font-data text-warn">warns when</span>{' '}
                          {check.warns_when}
                        </p>
                      ) : null}
                    </dd>
                  </div>
                ))}
            </dl>
          </section>
        ))}

        <section className="mt-10">
          <h2 className="text-[20px] font-bold">The grade bands</h2>
          <ul className="mt-3 flex flex-wrap gap-x-8 gap-y-2 p-0 font-data text-[13px]">
            {[...catalog.grades]
              .sort((a, b) => b.min - a.min)
              .map((band, index, all) => {
                const upper = index === 0 ? 100 : (all[index - 1]?.min ?? 100) - 1;
                return (
                  <li key={band.grade} className="list-none">
                    <span className="font-bold">{band.grade}</span>{' '}
                    <span className="text-ink-60">
                      {band.min}
                      {upper > band.min ? `–${upper}` : ''}
                    </span>
                  </li>
                );
              })}
          </ul>
        </section>

        <section className="mt-10 border-t border-ink pt-6">
          <h2 className="text-[20px] font-bold">What we will not do</h2>
          <ul className="mt-3 max-w-[70ch] list-none space-y-2.5 p-0 text-[14px] text-ink-60">
            <li>
              <span className="text-ink">We never work around a block.</span> If your site refuses{' '}
              <span className="font-data">BotreadyBot/1.0</span>, we record it as refused and
              display it as refused. No second request under another user agent, no residential
              proxies, no captcha solving.
            </li>
            <li>
              <span className="text-ink">We read at most {LIMITS.maxPagesPerScan} pages.</span>{' '}
              Sequentially, {LIMITS.pageDelayMs / 1000} second apart. We are a diagnostic tool, not
              a load generator.
            </li>
            <li>
              <span className="text-ink">We obey your robots.txt.</span> Including when it is the
              thing being measured, and CI asserts it.
            </li>
            <li>
              <span className="text-ink">We do not scan behind auth.</span> A URL with credentials
              in it is refused rather than followed.
            </li>
          </ul>
          <Microcopy className="mt-5">
            The catalog above is data, not code: adding, retiring or reweighting a check is an edit
            to one JSON file, which is why the numbers on this page cannot disagree with the scores
            on the result pages.
          </Microcopy>
        </section>
      </main>

      <Footer />
    </div>
  );
}

function Th({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return (
    <th
      scope="col"
      className={`border-b border-ink pb-2.5 pr-2.5 font-data text-[10.5px] font-bold uppercase tracking-[0.1em] text-ink-60 ${
        align === 'right' ? 'text-right' : 'text-left'
      }`}
    >
      {children}
    </th>
  );
}

function Td({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return (
    <td
      className={`py-3 pr-2.5 font-data text-[13px] ${align === 'right' ? 'text-right' : 'text-left'}`}
    >
      {children}
    </td>
  );
}
