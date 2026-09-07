import { ExternalBadge } from './ExternalBadge';

/**
 * The Twelve Tools badge.
 *
 * Served from twelve.tools rather than vendored into /public, and that is a
 * deliberate choice against the usual instinct. The file is a static 1.8 KB SVG
 * with no cache-busting query, so unlike the Product Hunt one it *could* be
 * copied in and served from our own origin, saving a cross-origin request.
 *
 * It is not, because a directory listing is worth more than one request. These
 * sites verify a badge by fetching the page and looking for their own asset on
 * it, and a self-hosted copy is exactly what that check is designed to miss.
 * Hotlinking also means their badge stays their badge if they redesign it.
 *
 * Native size is 200x54, and it is shown at exactly that beside the other two
 * badges, which are also 54 high. It sat on the landing page at 148x40 while it
 * was alone under the scan card; in a row it has to match its neighbours.
 *
 * Like the Product Hunt one, this is a moment rather than a fixture. It earns
 * its place while the listing is current and should come out when it stops
 * being news.
 */
export function TwelveToolsBadge({ className = '' }: { className?: string }) {
  return (
    <ExternalBadge
      href="https://twelve.tools"
      src="https://twelve.tools/badge3-white.svg"
      alt="botready.dev — Featured on Twelve Tools"
      label="botready.dev on Twelve Tools"
      width={200}
      height={54}
      className={className}
    />
  );
}
