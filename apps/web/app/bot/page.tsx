import type { Metadata } from 'next';

import { SiteFooter } from '@/components/site/SiteFooter';
import { SiteHeader } from '@/components/site/SiteHeader';
import { Card, Container, PageTitle, cx } from '@/components/ui';
import { CRAWLER_EMAIL, LIMITS, ROBOTS_TOKEN, USER_AGENT } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Our crawler',
  description: `What ${USER_AGENT} requests, how to block it, and what it never does.`,
  alternates: { canonical: '/bot' },
};

const REQUESTS = [
  'GET /robots.txt — first, always. If it disallows us, the scan ends here.',
  'GET the target page as BotreadyBot. A 401, 403 or 429 ends the scan here.',
  'GET /sitemap.xml, /llms.txt, /llms-full.txt and four /.well-known/ paths.',
  'GET the target page five more times, once as each of Chrome, ClaudeBot, GPTBot, PerplexityBot and Google-Extended, so the responses can be compared.',
  'One headless render of the target page, with images, fonts and media declined.',
  `GET up to ${LIMITS.maxPagesPerScan - 1} more pages linked from the target, preferring /pricing and /docs.`,
];

const NOT_DO = [
  'We do not spoof a user agent to get past a block, use residential proxies, or solve captchas. If you refuse us, that is the answer, and it is the answer we publish.',
  'We do not submit forms, click anything, follow a login, or request a URL that carries credentials.',
  'We do not train anything on your content. The scan stores status codes, header values, character counts and page titles. We keep the readable text only for as long as one scan takes to compute a ratio from it.',
  'We do not sell your data, and there is no list to be on.',
];

/**
 * The documentation page the user agent points at. Close to the published
 * wording on purpose: this is content, not marketing.
 */
export default function CrawlerPage() {
  return (
    <div className="min-h-dvh bg-canvas">
      <SiteHeader />
      <Container as="main" id="main" width={820} className="pb-24 pt-14">
        <PageTitle eyebrow="Our crawler" size="xl">
          BotreadyBot/1.0
        </PageTitle>
        <p className="mb-[14px] mt-[18px] text-[17.5px] leading-[1.6] text-muted">You are probably here because you found this in your access logs:</p>
        <pre className="overflow-auto rounded-[16px] bg-ink p-5 font-mono text-[13px] text-on-ink">{USER_AGENT}</pre>

        <H2>How to block us</H2>
        <P>
          Two lines in your robots.txt. We read it before every scan and obey it, including on the scan of your own site, and we stop at
          the robots.txt rather than reading anything else.
        </P>
        <pre className="edge overflow-auto rounded-[12px] border-l-[3px] bg-white p-[18px] font-mono text-[13.5px] font-medium leading-[1.7]">{`User-agent: ${ROBOTS_TOKEN}\nDisallow: /`}</pre>
        <P className="mt-4">
          That is the whole mechanism. There is no form to fill in and no list to be removed from. If you would rather refuse us at the edge
          instead, a 403 to this user agent works too: we record it and stop, and the public result page for your domain says that your
          site refuses our scanner rather than showing a score.
        </P>

        <H2>What we request</H2>
        <P className="mb-[18px]">A scan is one visit. In the worst case it is what follows, over about thirty seconds, sequentially, one second apart.</P>
        <Card radius="panel" shadow={0} className="overflow-hidden">
          <ol className="m-0 list-none p-0">
            {REQUESTS.map((text, i) => (
              <li key={text} className={cx('flex gap-4 px-5 py-[15px]', i < REQUESTS.length - 1 && 'border-b border-hairline-2')}>
                <span className="min-w-4 font-mono text-[12.5px] font-medium text-placeholder">{i + 1}</span>
                <span className="font-mono text-[13px] leading-[1.65] text-muted">{text}</span>
              </li>
            ))}
          </ol>
        </Card>
        <P className="mt-5">
          Never more than {LIMITS.maxPagesPerScan} distinct pages, never concurrently, and never more than one scan of a domain in{' '}
          {LIMITS.cacheHours} hours: a second request for a domain inside that window is served the first scan&rsquo;s result, so a link to
          your result page cannot be turned into traffic against you.
        </P>

        <H2>What we do not do</H2>
        <div className="grid gap-[14px]">
          {NOT_DO.map((text) => (
            <P key={text}>{text}</P>
          ))}
        </div>

        <H2>Reaching us</H2>
        <P>
          <a href={`mailto:${CRAWLER_EMAIL}`}>{CRAWLER_EMAIL}</a> reaches somebody who can change the crawler&rsquo;s behaviour. If we have
          got something wrong about your site, that is worth knowing: a check that fires on a correctly configured site is our bug.
        </P>
      </Container>
      <SiteFooter />
    </div>
  );
}

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="display mb-3 mt-11 text-[30px] tracking-[-0.03em]">{children}</h2>;
}

function P({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <p className={cx('text-[16.5px] leading-[1.65] text-muted', className)}>{children}</p>;
}
