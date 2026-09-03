import type { Metadata } from 'next';

import { EvidenceBlock, Footer, Measure, Nav, SectionHeading, Shell } from '@/components/primitives';
import { LIMITS, ROBOTS_TOKEN, USER_AGENT } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Our crawler',
  description:
    'BotreadyBot/1.0: who we are, what we request, and how to block us. Linked from the user agent string on every request we make.',
};

/**
 * The page the user agent string points at.
 *
 * A descriptive user agent with a contact URL is only worth having if the URL
 * answers the question the person following it has, which is almost always
 * "what is this and how do I stop it". So that answer is first.
 */
export default function BotPage() {
  return (
    <Shell>
      <Nav />

      <Measure as="main" className="max-w-[820px] pb-14 pt-6">
        <p id="main" className="label text-ink-60">
          Our crawler
        </p>
        <h1 className="display-hero mt-3 break-words text-[34px] sm:text-[60px]">BotreadyBot/1.0</h1>
        <p className="mt-4 text-[16px] text-ink-60">You are probably here because you found this in your access logs:</p>
        <EvidenceBlock label="Our user agent string">{USER_AGENT}</EvidenceBlock>

        <section className="mt-12">
          <SectionHeading kicker="First, because it is why you are here">How to block us</SectionHeading>
          <p className="mt-3 max-w-[68ch] text-[14.5px] leading-[1.55] text-ink-60">
            Two lines in your robots.txt. We read it before every scan and obey it, including on the
            scan of your own site, and we stop at the robots.txt rather than reading anything else.
          </p>
          <EvidenceBlock label="The robots.txt rule">{`User-agent: ${ROBOTS_TOKEN}\nDisallow: /`}</EvidenceBlock>
          <p className="mt-4 max-w-[68ch] text-[14.5px] leading-[1.55] text-ink-60">
            That is the whole mechanism. There is no form to fill in and no list to be removed from.
            If you would rather refuse us at the edge instead, a 403 to this user agent works too: we
            record it and stop, and the public result page for your domain says that your site refuses
            our scanner rather than showing a score.
          </p>
        </section>

        <section className="mt-12">
          <SectionHeading kicker="One scan, in order">What we request</SectionHeading>
          <p className="mt-3 max-w-[68ch] text-[14.5px] leading-[1.55] text-ink-60">
            A scan is one visit. In the worst case it is what follows, over about thirty seconds,
            sequentially, one second apart.
          </p>
          <ol className="wire-line mt-5 list-none space-y-2.5 p-0 text-ink-60">
            <Step n="1">
              <b className="text-ink">GET /robots.txt</b> — first, always. If it disallows us, the scan ends here.
            </Step>
            <Step n="2">
              <b className="text-ink">GET the target page</b> as {ROBOTS_TOKEN}. A 401, 403 or 429 ends the scan here.
            </Step>
            <Step n="3">
              <b className="text-ink">GET /sitemap.xml, /llms.txt, /llms-full.txt</b> and four <b className="text-ink">/.well-known/</b> paths.
            </Step>
            <Step n="4">
              <b className="text-ink">GET the target page five more times</b>, once as each of Chrome, ClaudeBot, GPTBot, PerplexityBot and Google-Extended, so the responses can be compared.
            </Step>
            <Step n="5">
              <b className="text-ink">One headless render</b> of the target page, with images, fonts and media declined.
            </Step>
            <Step n="6">
              <b className="text-ink">GET up to {LIMITS.maxPagesPerScan - 1} more pages</b> linked from the target, preferring /pricing and /docs.
            </Step>
          </ol>
          <p className="mt-5 max-w-[68ch] text-[14.5px] leading-[1.55] text-ink-60">
            Never more than {LIMITS.maxPagesPerScan} distinct pages, never concurrently, and never more
            than one scan of a domain in {LIMITS.cacheHours} hours: a second request for a domain inside
            that window is served the first scan&rsquo;s result, so a link to your result page cannot be
            turned into traffic against you.
          </p>
        </section>

        <section className="mt-12">
          <SectionHeading kicker="Stated, not implied">What we do not do</SectionHeading>
          <ul className="mt-4 max-w-[68ch] list-none space-y-2.5 p-0 text-[14.5px] leading-[1.55] text-ink-60">
            <li>We do not spoof a user agent to get past a block, use residential proxies, or solve captchas. If you refuse us, that is the answer, and it is the answer we publish.</li>
            <li>We do not submit forms, click anything, follow a login, or request a URL that carries credentials.</li>
            <li>We do not train anything on your content. The scan stores status codes, header values, character counts and page titles. We keep the readable text only for as long as one scan takes to compute a ratio from it.</li>
            <li>We do not sell your data, and there is no list to be on.</li>
          </ul>
        </section>

        <section className="mt-12">
          <SectionHeading kicker="The reason">Why we exist</SectionHeading>
          <p className="mt-3 max-w-[68ch] text-[14.5px] leading-[1.55] text-ink-60">
            We measure how legible a site is to the clients that read it to answer questions about it.
            The single finding worth the whole product is a site that returns 200 to Chrome and 403 to
            ClaudeBot from the same address in the same second, which almost nobody chose and almost
            nobody knows about. Finding that requires making both requests, which is why this crawler
            exists and why it identifies itself.
          </p>
        </section>

        <section className="mt-12">
          <SectionHeading kicker="A person, not a queue">Reaching us</SectionHeading>
          <p className="mt-3 max-w-[68ch] text-[14.5px] leading-[1.55] text-ink-60">
            <a href="mailto:crawler@botready.dev" className="mono underline">
              crawler@botready.dev
            </a>{' '}
            reaches somebody who can change the crawler&rsquo;s behaviour. If we have got something wrong
            about your site, that is worth knowing: a check that fires on a correctly configured site is
            our bug.
          </p>
        </section>
      </Measure>

      <Footer />
    </Shell>
  );
}

function Step({ n, children }: { n: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-4">
      <span className="w-[20px] shrink-0 text-ink-60">{n}</span>
      <span className="min-w-0">{children}</span>
    </li>
  );
}
