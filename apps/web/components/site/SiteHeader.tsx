import { currentUser } from '@/lib/auth';
import { PromoBar } from './PromoBar';
import { SiteHeaderClient } from './SiteHeaderClient';

/**
 * The marketing header. Reads the session so "Log in" becomes "Open the app".
 *
 * The promo strip sits above it and outside the sticky element, so it shows
 * once at the top of a page and then gets out of the way. It rides on
 * SiteHeader rather than the root layout so it never appears inside the app,
 * where somebody who has already paid does not need to be sold to.
 */
export async function SiteHeader() {
  const user = await currentUser();
  return (
    <>
      <PromoBar />
      <SiteHeaderClient signedIn={Boolean(user)} />
    </>
  );
}
