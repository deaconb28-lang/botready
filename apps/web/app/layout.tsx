import type { Metadata, Viewport } from 'next';
import { Familjen_Grotesk, JetBrains_Mono, Public_Sans } from 'next/font/google';

import { SITE } from '@/lib/site';
import './globals.css';

/**
 * Three faces. Familjen Grotesk for every heading, grade and big number;
 * Public Sans for body copy, buttons and labels; JetBrains Mono for every
 * eyebrow, status chip, metric, file name and terminal block. Self-hosted
 * through next/font so the first paint does not wait on a third party.
 */
const familjen = Familjen_Grotesk({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-familjen',
  display: 'swap',
});

const publicSans = Public_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-public-sans',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE.origin),
  title: {
    default: `${SITE.name} — ${SITE.tagline}`,
    template: `%s — ${SITE.name}`,
  },
  // The home page's opening line, cut where a search result cuts it.
  //
  // Google truncates a description somewhere around 155 characters, so the
  // hero's third sentence — "No engineer, no rebuild, no marketing budget" —
  // would be sheared off mid-promise in the one place this text is read by
  // strangers. Dropping it here keeps the description a whole thought and
  // still the same thought the page opens with; the page itself keeps the
  // full line, where nothing is cutting it.
  description:
    'Get found by AI agents. See how well your site can be seen by the assistants your customers ask, then fix what is hiding you.',
  openGraph: {
    siteName: SITE.name,
    type: 'website',
  },
  twitter: { card: 'summary_large_image' },
  robots: { index: true, follow: true },
  /**
   * Our own claim on botready.dev, proving to this product that we control
   * this domain — the same tag the /claim flow asks anyone else for.
   *
   * Public by design and safe to commit: the token is an HMAC over (user id,
   * domain) and is only useful to the account it was issued to. It is not a
   * credential and grants nothing to whoever reads it.
   *
   * One thing to know: it is derived from SCANNER_SHARED_SECRET, so rotating
   * that secret invalidates this string and the claim has to be re-verified
   * with a fresh one from /claim/botready.dev.
   */
  other: {
    'botready-verify': 'botready-verify=T5ypwC2V2UjR0fKxw2UjEtofns8giG2V',
  },
};

export const viewport: Viewport = {
  themeColor: '#EDEBFB',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${familjen.variable} ${publicSans.variable} ${jetbrainsMono.variable}`}>
      <body>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:rounded-[9px] focus:border-2 focus:border-ink focus:bg-lime focus:px-3 focus:py-2 focus:font-mono focus:text-[12px] focus:text-ink"
        >
          Skip to content
        </a>
        {children}
        {analytics ? (
          // The vendor's own tag, rather than next/script. next/script's
          // afterInteractive strategy emits only a preload link server-side and
          // injects the real element once React has hydrated, so the pageview
          // ends up depending on hydration finishing. A plain deferred tag is in
          // the HTML the moment the document is, which is what you want from the
          // one script whose whole job is to notice that somebody arrived.
          <script
            defer
            src="https://datafa.st/js/script.js"
            data-website-id="dfid_Ql9zHILfNWAueJUsfzAdD"
            data-domain="botready.dev"
          />
        ) : null}
      </body>
    </html>
  );
}

/**
 * Whether to load the analytics script at all.
 *
 * Not a privacy switch — DataFast is cookieless and there is nothing here to
 * consent to. It is about the numbers being worth reading. Every preview
 * deployment and every `pnpm dev` session would otherwise report itself as
 * traffic to botready.dev, and the first thing anyone wants from analytics on a
 * launch day is to trust the count.
 *
 * Deliberately failing open: it loads unless we can see a reason not to. A
 * stray hit from a preview is a smaller problem than discovering at noon on
 * launch day that the tag never fired because an environment variable was not
 * what this expected.
 *
 * The website id is not a secret. It is what the script announces itself with
 * on every page load of every site that uses it, so it belongs in the source
 * rather than in an env var pretending otherwise.
 */
const analytics = process.env.NODE_ENV === 'production' && process.env.VERCEL_ENV !== 'preview';
