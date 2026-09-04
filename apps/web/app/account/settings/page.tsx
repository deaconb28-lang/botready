import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { AccountShell } from '@/components/account/AccountShell';
import { Lede, PageHeading } from '@/components/account/bits';
import { SettingsForm } from '@/components/account/SettingsForm';
import { currentUser } from '@/lib/auth';
import { getSettings } from '@/lib/settings';

export const metadata: Metadata = {
  title: 'Settings',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const user = await currentUser();
  if (!user) redirect('/sign-in?next=/account/settings');

  const settings = await getSettings(user.id);

  return (
    <AccountShell email={user.email} active="settings">
      <PageHeading>Settings</PageHeading>
      <Lede className="mb-[26px] mt-[9px]">
        Signed in as <span className="font-mono text-[15px]">{user.email}</span>.
      </Lede>
      <SettingsForm initial={settings} />
    </AccountShell>
  );
}
