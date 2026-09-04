import { redirect } from 'next/navigation';

import { propertiesFor, requireUser } from '@/lib/app-context';

export const dynamic = 'force-dynamic';

/** /app -> the first claimed domain, or the page that adds one. */
export default async function AppIndex() {
  const user = await requireUser('/app');
  const properties = await propertiesFor(user.id);
  redirect(properties[0] ? `/app/${properties[0].domain}` : '/app/new');
}
