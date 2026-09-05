import { withProbe, type SiteIdentity } from '@/lib/site-identity';
import { probeSite } from '@/lib/site-probe';
import { SitePanel } from './SitePanel';

/**
 * The site card, once we have looked at the site.
 *
 * Split out and rendered inside a Suspense boundary so the probe never sits in
 * front of the result. The score, the fix pack and the findings are all
 * derived from evidence we already hold and stream immediately; this one panel
 * arrives when it arrives, and on a warm cache that is the same paint.
 */
export async function SitePanelAsync({ identity }: { identity: SiteIdentity }) {
  // A scan taken since the scanner started recording the icon and the framing
  // headers has already answered both questions, at the moment it actually
  // requested the page. Asking again would be a request to someone's site for
  // something we know.
  if (identity.framing !== 'unknown' && identity.declaredIcon) {
    return <SitePanel identity={identity} />;
  }
  const probe = await probeSite(identity.url);
  return <SitePanel identity={withProbe(identity, probe)} />;
}

/** The card's own outline while the probe is out. Same height, no jump. */
export function SitePanelSkeleton({ identity }: { identity: SiteIdentity }) {
  return (
    <section className="edge overflow-hidden rounded-[16px] bg-white shadow-hard-4" aria-hidden="true">
      <div className="flex items-center gap-[10px] border-b-2 border-ink bg-surface-alt px-4 py-[11px]">
        <span className="h-[22px] w-[22px] shrink-0 rounded-[6px] border-2 border-ink bg-hairline" />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-mono text-[12px] font-medium text-ink">{identity.domain}</span>
        </span>
      </div>
      <div className="h-[120px] bg-surface-alt" />
    </section>
  );
}
