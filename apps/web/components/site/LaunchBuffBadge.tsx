import { ExternalBadge } from './ExternalBadge';

/**
 * The LaunchBuff badge.
 *
 * Their dark variant, which is the right one here: it is a #1b1c24 card, near
 * enough the site's own ink, so it reads as a deliberate object on the light
 * footer rather than a white rectangle dissolving into a white-ish one.
 *
 * Hotlinked rather than vendored, for the same reason as the Twelve Tools
 * badge: a directory verifies a listing by fetching the page and looking for
 * its own asset, and a self-hosted copy is what that check is built to miss.
 *
 * Native size is 256x80. It is shown at 54 high so it sits level with the
 * Product Hunt badge beside it — two badges at two heights read as two
 * accidents rather than a set.
 */
export function LaunchBuffBadge({ className = '' }: { className?: string }) {
  return (
    <ExternalBadge
      href="https://launchbuff.com/products/botready-dev-3ibry1"
      src="https://launchbuff.com/badge-featured-dark.svg"
      alt="botready.dev — Featured on LaunchBuff"
      label="botready.dev on LaunchBuff"
      width={173}
      height={54}
      className={className}
    />
  );
}
