import { catalog } from '@botready/core';

import { CONTACT_EMAIL, EARLY_ACCESS, PLAN_LIMITS, PRICING, SITE, absoluteUrl } from '@/lib/site';

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
      'Monitoring',
      `Up to ${PLAN_LIMITS.monitor.domains} claimed domains re-scanned on a schedule, with an email when a client stops being able to read you.`,
      PRICING.monitor.amount,
      PRICING.monitor.currency,
    ),
    subscription(
      'Agency',
      `Up to ${PLAN_LIMITS.agency.domains} domains re-scanned weekly, ${PLAN_LIMITS.agency.prompts} watched questions pooled across them, share of voice against named competitors, verified crawler analytics from your own logs, and a fix pack for every domain.`,
      PRICING.agency.amount,
      PRICING.agency.currency,
    ),
    // PreOrder rather than InStock, because it is not built and the page says
    // so. An offer that claims availability it does not have is exactly the
    // kind of thing this product exists to find on other people's sites.
    {
      ...subscription(
        'Early access',
        'What the answer engines say about you, and which crawlers verifiably reached your pages. In development.',
        EARLY_ACCESS.scale.amount,
        EARLY_ACCESS.scale.currency,
      ),
      availability: 'https://schema.org/PreOrder',
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
