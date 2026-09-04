import type { Metadata } from 'next';

import { AppShell } from '@/components/app/AppShell';
import { NewScanForm } from '@/components/app/NewScanForm';
import { ownsFixpack, propertiesFor, requireUser } from '@/lib/app-context';

export const metadata: Metadata = { title: 'New scan', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

/** Scan a domain that is not one of the person's properties yet, then claim it. */
export default async function NewPropertyPage() {
  const user = await requireUser('/app/new');
  const [properties, owned] = await Promise.all([propertiesFor(user.id), ownsFixpack(user.id)]);
  return (
    <AppShell property={null} properties={properties} email={user.email} owned={owned}>
      <div className="max-w-[580px]">
        <h1 className="display-tight text-[36px]">New scan</h1>
        <p className="mb-[22px] mt-[10px] text-[16px] leading-[1.55] text-body">
          One visit, six pages at most, about thirty seconds. When it finishes you can claim the domain and it becomes a property here.
        </p>
        <NewScanForm mode="claim" />
      </div>
    </AppShell>
  );
}
