import type { Metadata, Viewport } from 'next';
import { Familjen_Grotesk, JetBrains_Mono, Public_Sans } from 'next/font/google';

import { ModeProvider } from '@/lib/mode';
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
  description:
    'We request your page as five different clients, compare what each one gets back, and hand you the exact files that fix the gaps.',
  openGraph: {
    siteName: SITE.name,
    type: 'website',
  },
  twitter: { card: 'summary_large_image' },
  robots: { index: true, follow: true },
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
        <ModeProvider>{children}</ModeProvider>
      </body>
    </html>
  );
}
