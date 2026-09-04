import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { normaliseDomain } from '@botready/core';

import { PromptWatchView } from '@/components/app/PromptWatchView';
import { loadPrompts } from '@/lib/app-data';
import { propertyFor, requireUser } from '@/lib/app-context';
import { probeConfigured } from '@/lib/prompt-probe';
import { planFor } from '@/lib/account-data';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Prompt watch', robots: { index: false, follow: false } };

export default async function WatchPage({ params }: { params: Promise<{ domain: string }> }) {
  const { domain: raw } = await params;
  const domain = normaliseDomain(decodeURIComponent(raw));
  const user = await requireUser(`/app/${domain}/watch`);
  const p = await propertyFor(domain, user.id);
  if (!p) notFound();
  const [prompts, plan] = await Promise.all([loadPrompts(p.siteId, p.domain), planFor(user.id)]);

  return (
    <div>
      <h1 className="display-tight text-[36px]">Prompt watch</h1>
      <p className="mb-[22px] mt-[10px] text-[16px] leading-[1.55] text-body">
        {prompts.length === 0
          ? 'The questions a buyer would ask an assistant about your category. Add up to twelve; we ask them each week and record whether the answer mentions you.'
          : `${wordNumber(prompts.length)} ${prompts.length === 1 ? 'question' : 'questions'} we ask ${plan.plan === 'monitor' ? 'each week' : 'when you press the button'}, and whether the answer mentions you.`}
      </p>
      <PromptWatchView siteId={p.siteId} domain={p.domain} prompts={prompts} configured={probeConfigured()} weekly={plan.plan === 'monitor'} />
    </div>
  );
}

function wordNumber(n: number): string {
  const w = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve'][n];
  return w ?? String(n);
}
