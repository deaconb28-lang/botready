import { catalog } from '@botready/core';

import { CONTACT_EMAIL, ENTERPRISE, PLAN_LIMITS, PRICING, SITE, absoluteUrl } from '@/lib/site';

/**
 * JSON-LD, server-rendered so a client that does not run JavaScript sees it.
 *
 * Every claim here is one the site makes in words elsewhere: the price is the
 * price the pricing page prints, the check count is the catalog's, and the
 * description is the meta description. There is nothing here written for a
 * machine that a person reading the page would not also be told.
 */

function Block({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      // The content is ours and JSON.stringify escapes it; the only sequence
      // that can close the tag early is escaped explicitly.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }}
    />
  );
}

const ORGANISATION = {
  '@type': 'Organization',
  '@id': `${SITE.origin}/#organization`,
  name: 'BotReady',
  url: SITE.origin,
  logo: absoluteUrl('/logo.svg'),
  email: CONTACT_EMAIL,
  description: 'Measures how legible a website is to AI agents, and generates the files that fix what it finds.',
};

const WEBSITE = {
  '@type': 'WebSite',
  '@id': `${SITE.origin}/#website`,
  url: SITE.origin,
  name: SITE.name,
  publisher: { '@id': `${SITE.origin}/#organization` },
  inLanguage: 'en',
};

function offers() {
  return [
    {
      '@type': 'Offer',
      name: 'Fix pack',
      description:
        'The generated files for one scan: llms.txt, a robots.txt patch, a WAF rule, the missing JSON-LD, and a prompt for a coding agent.',
      price: String(PRICING.fixpack.amount),
      priceCurrency: PRICING.fixpack.currency.toUpperCase(),
      url: absoluteUrl('/pricing'),
      availability: 'https://schema.org/InStock',
    },
    subscription(
      'Agency',
      `Up to ${PLAN_LIMITS.agency.domains} domains re-scanned weekly, ${PLAN_LIMITS.agency.prompts} watched questions pooled across them, share of voice against named competitors, verified crawler analytics from your own logs, and a fix pack for every domain.`,
      PRICING.agency.amount,
      PRICING.agency.currency,
    ),
    // No price, only a floor. `priceSpecification` with a `minPrice` is
    // schema.org's way of saying "from", and it is the only honest shape for
    // an offer whose cost depends on a cadence we have not agreed yet. Quoting
    // a single price here would put a number in a machine-readable field that
    // no human on our side has committed to.
    {
      '@type': 'Offer',
      name: 'Enterprise',
      description:
        'Hundreds of domains, a cadence the published plans do not offer, or your own log pipeline. Priced per agreement; the answer comes from a person.',
      priceCurrency: ENTERPRISE.from.currency.toUpperCase(),
      url: absoluteUrl('/pricing'),
      availability: 'https://schema.org/PreOrder',
      priceSpecification: {
        '@type': 'PriceSpecification',
        minPrice: String(ENTERPRISE.from.amount),
        priceCurrency: ENTERPRISE.from.currency.toUpperCase(),
      },
    },
  ];
}

/** A monthly plan, described the same way every time. */
function subscription(name: string, description: string, amount: number, currency: string) {
  return {
    '@type': 'Offer',
    name,
    description,
    price: String(amount),
    priceCurrency: currency.toUpperCase(),
    url: absoluteUrl('/pricing'),
    availability: 'https://schema.org/InStock',
    priceSpecification: {
      '@type': 'UnitPriceSpecification',
      price: String(amount),
      priceCurrency: currency.toUpperCase(),
      billingDuration: 1,
      billingIncrement: 1,
      unitCode: 'MON',
    },
  };
}

/** The homepage: who we are, what the software does, and what it costs. */
export function HomeStructuredData() {
  return (
    <Block
      data={{
        '@context': 'https://schema.org',
        '@graph': [
          ORGANISATION,
          WEBSITE,
          {
            '@type': 'SoftwareApplication',
            '@id': `${SITE.origin}/#app`,
            name: 'BotReady',
            applicationCategory: 'DeveloperApplication',
            applicationSubCategory: 'Website analysis',
            operatingSystem: 'Any, in a browser',
            url: SITE.origin,
            publisher: { '@id': `${SITE.origin}/#organization` },
            description: `Requests your page as ${catalog.agents.length} different clients, compares what each one gets back, and scores the difference against ${catalog.checks.length} published checks.`,
            featureList: catalog.categories.map((c) => `${c.label} — ${c.weight} of the 100`),
            softwareVersion: catalog.scoringVersion,
            offers: offers(),
          },
        ],
      }}
    />
  );
}

/** The pricing page: the two things you can buy, as Offers a machine can read. */
export function PricingStructuredData() {
  return (
    <Block
      data={{
        '@context': 'https://schema.org',
        '@graph': [
          ORGANISATION,
          {
            '@type': 'Product',
            '@id': `${SITE.origin}/pricing#product`,
            name: 'BotReady',
            url: absoluteUrl('/pricing'),
            brand: { '@id': `${SITE.origin}/#organization` },
            description: 'The diagnosis is free. The fix pack and the monitoring are what you can buy.',
            offers: offers(),
          },
        ],
      }}
    />
  );
}

/** A content page, described as the article it is rather than as "a web page". */
export function ArticleStructuredData({
  path,
  headline,
  description,
  updated,
}: {
  path: string;
  headline: string;
  description: string;
  updated: string;
}) {
  return (
    <Block
      data={{
        '@context': 'https://schema.org',
        '@graph': [
          ORGANISATION,
          {
            '@type': 'TechArticle',
            '@id': `${absoluteUrl(path)}#article`,
            headline,
            description,
            url: absoluteUrl(path),
            dateModified: updated,
            inLanguage: 'en',
            isPartOf: { '@id': `${SITE.origin}/#website` },
            publisher: { '@id': `${SITE.origin}/#organization` },
            author: { '@id': `${SITE.origin}/#organization` },
          },
        ],
      }}
    />
  );
}

/**
 * A post, and the blog it belongs to.
 *
 * `BlogPosting` rather than `TechArticle` because that is what it is, and
 * `datePublished` as well as `dateModified` because a post has both and the
 * pair is what tells a reader whether an old post has been kept current.
 * Neither date is the build time: they come from the post's own record, for
 * the same reason the sitemap's lastmod does.
 */
export function BlogPostStructuredData({
  path,
  headline,
  description,
  published,
  updated,
  section,
}: {
  path: string;
  headline: string;
  description: string;
  published: string;
  updated: string;
  section: string;
}) {
  return (
    <Block
      data={{
        '@context': 'https://schema.org',
        '@graph': [
          ORGANISATION,
          {
            '@type': 'BlogPosting',
            '@id': `${absoluteUrl(path)}#post`,
            headline,
            description,
            url: absoluteUrl(path),
            datePublished: published,
            dateModified: updated,
            articleSection: section,
            inLanguage: 'en',
            isPartOf: { '@id': `${SITE.origin}/blog#blog` },
            publisher: { '@id': `${SITE.origin}/#organization` },
            author: { '@id': `${SITE.origin}/#organization` },
            mainEntityOfPage: { '@type': 'WebPage', '@id': absoluteUrl(path) },
          },
        ],
      }}
    />
  );
}

/** The index, with the posts on it named rather than only linked. */
export function BlogIndexStructuredData({
  posts,
}: {
  posts: Array<{ path: string; title: string; dek: string; published: string }>;
}) {
  return (
    <Block
      data={{
        '@context': 'https://schema.org',
        '@graph': [
          ORGANISATION,
          WEBSITE,
          {
            '@type': 'Blog',
            '@id': `${SITE.origin}/blog#blog`,
            url: absoluteUrl('/blog'),
            name: 'BotReady writing',
            description:
              'What we found measuring how legible websites are to AI agents, and how the measuring works.',
            inLanguage: 'en',
            publisher: { '@id': `${SITE.origin}/#organization` },
            blogPost: posts.map((p) => ({
              '@type': 'BlogPosting',
              '@id': `${absoluteUrl(p.path)}#post`,
              headline: p.title,
              description: p.dek,
              url: absoluteUrl(p.path),
              datePublished: p.published,
            })),
          },
        ],
      }}
    />
  );
}
