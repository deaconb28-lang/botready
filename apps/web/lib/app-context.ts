/**
 * The app's request-scoped reads, memoised with React's cache() so the
 * layout (which draws the sidebar) and the page (which draws the view) share
 * one round trip per request.
 */

import { cache } from 'react';
import { redirect } from 'next/navigation';

import { currentUser, hasFixpackEntitlement, type CurrentUser } from './auth';
import { listProperties, loadProperty, type Property } from './app-data';
import { getSettings } from './settings';

export const requireUser = cache(async (nextPath: string): Promise<CurrentUser> => {
  const user = await currentUser();
  if (!user) redirect(`/sign-in?next=${encodeURIComponent(nextPath)}`);
  return user;
});

export const propertyFor = cache(async (domain: string, userId: string): Promise<Property | null> => loadProperty(domain, userId));

export const propertiesFor = cache(async (userId: string) => listProperties(userId));

export const ownsFixpack = cache(async (userId: string) => hasFixpackEntitlement(userId));

export const settingsFor = cache(async (userId: string) => getSettings(userId));
