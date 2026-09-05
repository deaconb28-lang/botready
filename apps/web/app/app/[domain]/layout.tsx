import { notFound } from 'next/navigation';
import { normaliseDomain } from '@botready/core';

import { AppShell } from '@/components/app/AppShell';
import { ownsFixpack, propertiesFor, propertyFor, requireUser } from '@/lib/app-context';

export const dynamic = 'force-dynamic';

export default async function PropertyLayout({ children, params }: { children: React.ReactNode; params: Promise<{ domain: string }> }) {
  const { domain: raw } = await params;
  const domain = safe(raw);
  const user = await requireUser(`/app/${domain}`);
  const [property, properties, owned] = await Promise.all([propertyFor(domain, user.id), propertiesFor(user.id), ownsFixpack(user.id, domain)]);
  if (!property) notFound();

  return (
    <AppShell property={property} properties={properties} email={user.email} owned={owned}>
      {children}
    </AppShell>
  );
}

function safe(raw: string): string {
  try {
    return normaliseDomain(decodeURIComponent(raw));
  } catch {
    notFound();
  }
}
