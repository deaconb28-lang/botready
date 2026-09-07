import { catalog } from '@botready/core';

import { CONTACT_EMAIL, PLAN_LIMITS, PRICING, SITE, absoluteUrl } from '@/lib/site';

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
    {
      '@type': 'Offer',
      name: 'Agency',
      description: `Up to ${PLAN_LIMITS.monitor.domains} claimed domains re-scanned every week, with an email the day a client stops being able to read you.`,
      price: String(PRICING.monitor.amount),
      priceCurrency: PRICING.monitor.currency.toUpperCase(),
      url: absoluteUrl('/pricing'),
      availability: 'https://schema.org/InStock',
      priceSpecification: {
        '@type': 'UnitPriceSpecification',
        price: String(PRICING.monitor.amount),
        priceCurrency: PRICING.monitor.currency.toUpperCase(),
        billingDuration: 1,
        billingIncrement: 1,
        unitCode: 'MON',
      },
    },
    {
      // A floor rather than a price, so this publishes minPrice and no `price`.
      // Stating 1000 flat would be the one claim on this page that is not the
      // number somebody actually pays.
      '@type': 'Offer',
      name: 'Enterprise',
      description: 'Unlimited domains, scheduled JSON export, SSO and multiple seats, on invoiced annual terms.',
      priceCurrency: PRICING.enterprise.currency.toUpperCase(),
      url: absoluteUrl('/pricing'),
      availability: 'https://schema.org/InStock',
      priceSpecification: {
        '@type': 'PriceSpecification',
        minPrice: String(PRICING.enterprise.amount),
        priceCurrency: PRICING.enterprise.currency.toUpperCase(),
      },
    },
  ];
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

/** The pricing page: everything you can buy, as Offers a machine can read. */
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
            description: 'The diagnosis is free. The fix pack and the agency plan are what you can buy.',
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
