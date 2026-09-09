/**
 * Why a scan read fewer pages than it was allowed to.
 *
 * "1 of 6 allowed" is the single most confusing number on a result. Forty-three
 * of the 342 scans in the corpus read exactly one page, and every one of those
 * reports left the reader guessing whether the limit was their site or our
 * scanner. Those are opposite conclusions and we had the facts to tell them
 * apart the whole time.
 *
 * Six reasons, and the important thing about them is which side each one is on:
 *
 *   budget            we stopped because we said we would. Not a finding.
 *   partial           the site has fewer pages than the budget. Not a finding.
 *   links_js_only     the raw HTML has no internal links and the rendered DOM
 *                     does. A client that does not run a browser sees one page
 *                     and nothing else. This is the finding.
 *   no_internal_links neither has any. Same consequence, different cause.
 *   links_off_origin  every link leaves the site. Common on a one-page site
 *                     whose content lives on a booking platform.
 *   robots_disallowed their robots.txt told us not to. A decision, not a defect.
 *   fetches_failed    we asked and got nothing back. Whose problem that is
 *                     depends on whether anything answered at all.
 *
 * Constraint 2: pure, versioned, no I/O. The scanner counts; what the counts
 * mean is decided here, so re-scoring history does not need a re-crawl.
 */

export const CRAWL_ACCOUNT_VERSION = '1.0';

export type CrawlLimit =
  | 'budget'
  | 'partial'
  | 'links_js_only'
  | 'no_internal_links'
  | 'links_off_origin'
  | 'robots_disallowed'
  | 'fetches_failed';

/**
 * What the crawl counted. Facts only: no field here says whether anything is
 * wrong, which is the whole point of keeping the two apart.
 */
export interface CrawlObserved {
  /** Pages we were allowed to read beyond the target. */
  budget: number;
  /** Additional pages that came back readable. */
  pages_read: number;
  /** Same-origin candidates found in the raw HTML, before any script ran. */
  raw_links: number;
  /** Same-origin candidates found in the rendered DOM. */
  rendered_links: number;
  /** Hrefs that were links and pointed at another origin. */
  off_origin_links: number;
  /** Same-origin candidates the sitemap offered. */
  sitemap_urls: number;
  /** Candidates we did not request because robots.txt disallowed the path. */
  robots_blocked: number;
  /** Candidates we did request. */
  attempted: number;
  /** Requests that produced no usable page. */
  failed: number;
  /** Requests that produced no response at all, which is ours to explain. */
  no_response: number;
  /** Our headless browser produced no document. */
  render_failed: boolean;
}

export interface CrawlAccount {
  version: string;
  limit: CrawlLimit;
  /** What to print beside "N of 6". Always a whole sentence. */
  sentence: string;
  /**
   * Whether the limit is something about the site rather than about us. Only
   * these earn or lose points: blaming a site for our own timeout would make
   * the score a measure of our infrastructure.
   */
  onTheSite: boolean;
}

/**
 * The reason, in the order the reasons rule each other out.
 *
 * Budget first, because a scan that read everything it was allowed to has no
 * truncation to explain regardless of what else is true of the site. Then the
 * two "we asked and it did not work" cases, because an attempt that failed is
 * more specific than an absence of candidates. Then the shape of the links.
 */
export function crawlLimit(o: CrawlObserved): CrawlLimit {
  if (o.pages_read >= o.budget) return 'budget';
  if (o.attempted > 0 && o.failed >= o.attempted) return 'fetches_failed';
  if (o.pages_read > 0) return 'partial';

  // Nothing was read and nothing was attempted. Why were there no candidates?
  const internal = o.raw_links + o.rendered_links + o.sitemap_urls;
  if (o.robots_blocked > 0 && internal > 0) return 'robots_disallowed';
  if (o.raw_links === 0 && o.rendered_links > 0) return 'links_js_only';
  if (internal === 0 && o.off_origin_links > 0) return 'links_off_origin';
  return 'no_internal_links';
}

/** The whole account: the reason, the sentence, and whose problem it is. */
export function crawlAccount(o: CrawlObserved): CrawlAccount {
  const limit = crawlLimit(o);
  const read = o.pages_read + 1;
  const allowed = o.budget + 1;

  switch (limit) {
    case 'budget':
      return {
        version: CRAWL_ACCOUNT_VERSION,
        limit,
        sentence: `We read all ${allowed} pages we allow ourselves, so this is our cap rather than a limit of your site.`,
        onTheSite: false,
      };

    case 'partial':
      return {
        version: CRAWL_ACCOUNT_VERSION,
        limit,
        sentence: `We read ${read} of ${allowed}. Your homepage linked to ${plural(o.pages_read, 'other page')} we could open, and we stopped when we ran out of links rather than when we ran out of budget.`,
        onTheSite: false,
      };

    case 'links_js_only':
      return {
        version: CRAWL_ACCOUNT_VERSION,
        limit,
        sentence: `Your homepage has no links in the HTML it sends. ${plural(o.rendered_links, 'link')} appeared only after we ran the page in a browser, so a client that does not run one sees your homepage and no way to reach the rest of your site.`,
        onTheSite: true,
      };

    case 'no_internal_links':
      return {
        version: CRAWL_ACCOUNT_VERSION,
        limit,
        sentence:
          'We found no links from your homepage to another page on your site, and no sitemap offering any, so there was nothing else to read.',
        onTheSite: true,
      };

    case 'links_off_origin':
      return {
        version: CRAWL_ACCOUNT_VERSION,
        limit,
        sentence: `Every one of the ${o.off_origin_links} links on your homepage leaves your site. There is one page here for an agent to read, and everything it might want next is somebody else's to describe.`,
        onTheSite: true,
      };

    case 'robots_disallowed':
      return {
        version: CRAWL_ACCOUNT_VERSION,
        limit,
        sentence: `Your robots.txt disallows ${plural(o.robots_blocked, 'page')} we would otherwise have read, so we did not request them. That is your call and we obeyed it — but it is also what a reading agent gets.`,
        onTheSite: true,
      };

    case 'fetches_failed':
      // Whose fault turns on whether anything answered. A 404 is the site
      // telling us the link is dead; no response at all is as likely to be us.
      return o.no_response >= o.attempted
        ? {
            version: CRAWL_ACCOUNT_VERSION,
            limit,
            sentence: `We asked for ${plural(o.attempted, 'other page')} and got no response to any of them. That is as likely to be our problem as yours, so it costs you nothing.`,
            onTheSite: false,
          }
        : {
            version: CRAWL_ACCOUNT_VERSION,
            limit,
            sentence: `Every one of the ${plural(o.attempted, 'link')} we followed from your homepage returned an error. The links are on the page and the pages behind them are not there.`,
            onTheSite: true,
          };
  }
}

function plural(n: number, noun: string): string {
  return `${n} ${noun}${n === 1 ? '' : 's'}`;
}
