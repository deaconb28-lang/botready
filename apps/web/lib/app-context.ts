/**
 * The app's request-scoped reads, memoised with React's cache() so the
 * layout (which draws the sidebar) and the page (which draws the view) share
 * one round trip per request.
 */

import { cache } from 'react';
import { redirect } from 'next/navigation';

import { currentUser, hasFixpackFor, ownsAnyFixpack, type CurrentUser } from './auth';
import { listProperties, loadProperty, type Property } from './app-data';
import { getSettings } from './settings';

export const requireUser = cache(async (nextPath: string): Promise<CurrentUser> => {
  const user = await currentUser();
  if (!user) redirect(`/sign-in?next=${encodeURIComponent(nextPath)}`);
  return user;
});

export const propertyFor = cache(async (domain: string, userId: string): Promise<Property | null> => loadProperty(domain, userId));

export const propertiesFor = cache(async (userId: string) => listProperties(userId));

/**
 * Whether to offer a fix pack download in the app chrome.
 *
 * With a domain it is the real access question, so the sidebar of a property
 * they have not bought for does not offer a download that would 403. Without
 * one — /app/new, where no property is in scope — it is "do they own any",
 * which is all that view can sensibly ask.
 */
export const ownsFixpack = cache(async (userId: string, domain?: string | null) =>
  domain === undefined ? ownsAnyFixpack(userId) : hasFixpackFor(userId, domain),
);

export const settingsFor = cache(async (userId: string) => getSettings(userId));
