import { currentUser } from '@/lib/auth';
import { SiteHeaderClient } from './SiteHeaderClient';

/** The marketing header. Reads the session so "Log in" becomes "Open the app". */
export async function SiteHeader() {
  const user = await currentUser();
  return <SiteHeaderClient signedIn={Boolean(user)} />;
}
