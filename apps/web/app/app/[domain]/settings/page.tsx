import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { normaliseDomain } from '@botready/core';

import { SettingsToggles } from '@/components/app/SettingsToggles';
import { planFor } from '@/lib/account-data';
import { propertyFor, requireUser, settingsFor } from '@/lib/app-context';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Settings', robots: { index: false, follow: false } };

export default async function AppSettingsPage({ params }: { params: Promise<{ domain: string }> }) {
  const { domain: raw } = await params;
  const domain = normaliseDomain(decodeURIComponent(raw));
  const user = await requireUser(`/app/${domain}/settings`);
  const [p, settings, plan] = await Promise.all([propertyFor(domain, user.id), settingsFor(user.id), planFor(user.id)]);
  if (!p) notFound();

  return (
    <div>
      <h1 className="display-tight text-[36px]">Settings</h1>
      <p className="mb-[22px] mt-[10px] text-[16px] leading-[1.55] text-body">
        Scanning {p.domain} on the {plan.plan === 'monitor' ? 'monitoring' : 'free'} plan.{plan.plan === 'free' ? ' Weekly re-scans and alerts start with monitoring.' : ''}
      </p>
      <SettingsToggles initial={settings} />
    </div>
  );
}
