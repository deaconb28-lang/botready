import type { Metadata, Viewport } from 'next';
import { Archivo, Instrument_Sans, JetBrains_Mono } from 'next/font/google';

import { SITE } from '@/lib/site';
import './globals.css';

/**
 * Archivo carries the width axis, which is how emphasis is expressed in this
 * design instead of italics or colour. Loading the axis is the point, so it is
 * declared rather than left to the default instance.
 */
const archivo = Archivo({
  subsets: ['latin'],
  axes: ['wdth'],
  weight: ['400', '600', '700', '800'],
  variable: '--font-archivo',
  display: 'swap',
});

const instrumentSans = Instrument_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-instrument-sans',
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
  themeColor: '#16181C',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${archivo.variable} ${instrumentSans.variable} ${jetbrainsMono.variable}`}
    >
      <body>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-[3px] focus:border focus:border-ink focus:bg-paper focus:px-3 focus:py-2 focus:font-data focus:text-micro"
        >
          Skip to the results
        </a>
        {children}
      </body>
    </html>
  );
}
