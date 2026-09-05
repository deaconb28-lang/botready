import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { normaliseDomain, previewOf, punchListMarkdown } from '@botready/core';

import { EditorView, type EditorFile } from '@/components/app/EditorView';
import { ownsFixpack, propertyFor, requireUser } from '@/lib/app-context';
import { PRICING } from '@/lib/site';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Editor', robots: { index: false, follow: false } };

/**
 * The generated files. The diagnosis is free and so is seeing what the files
 * are; the files themselves are the paid artifact. Without the entitlement
 * each file is shown as a real preview cut off part way through, never
 * blurred, and the full text unlocks with the pack.
 */
export default async function EditorPage({ params }: { params: Promise<{ domain: string }> }) {
  const { domain: raw } = await params;
  const domain = normaliseDomain(decodeURIComponent(raw));
  const user = await requireUser(`/app/${domain}/editor`);
  const [p, owned] = await Promise.all([propertyFor(domain, user.id), ownsFixpack(user.id, domain)]);
  if (!p) notFound();

  const files: EditorFile[] = [];
  if (p.pack) {
    for (const f of p.pack.files) {
      const preview = previewOf(f, 9);
      files.push({ name: f.name, purpose: f.purpose, body: owned ? f.content : preview.text, truncated: !owned && preview.truncated, incomplete: f.incomplete });
    }
    const punch = punchListMarkdown(p.domain, p.pack.punchList);
    const punchPreview = previewOf({ name: 'punch-list.md', purpose: '', language: 'markdown', content: punch, addresses: [], incomplete: false }, 12);
    files.push({ name: 'punch-list.md', purpose: 'What to do, ordered by effort rather than by points.', body: owned ? punch : punchPreview.text, truncated: !owned && punchPreview.truncated, incomplete: false });
    const promptPreview = previewOf({ name: 'botready-fixes.md', purpose: '', language: 'markdown', content: p.pack.agentPrompt, addresses: [], incomplete: false }, 12);
    files.push({
      name: 'botready-fixes.md',
      purpose: 'A full prompt for your coding agent. Paste it into Claude Code or Cursor.',
      body: owned ? p.pack.agentPrompt : promptPreview.text,
      truncated: !owned && promptPreview.truncated,
      incomplete: false,
    });
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="display-tight text-[36px]">Editor</h1>
        {p.projected && p.score && p.projected.total > p.score.total ? (
          <span className="edge rounded-[8px] bg-lime px-[10px] py-[3px] font-mono text-[13px] font-bold">
            {p.projected.grade} after these
          </span>
        ) : null}
      </div>
      <p className="mb-[22px] mt-[10px] text-[16px] leading-[1.55] text-body">
        {files.length === 0
          ? 'Run a scan and the files are generated from your own pages.'
          : owned
            ? `${wordNumber(files.length)} files generated from your own pages. Download them, or copy each one straight out of here.`
            : `${wordNumber(files.length)} files generated from your own pages. Each one is shown cut off; the pack unlocks the full text and the download.`}
      </p>
      <EditorView
        files={files}
        run={p.runNumber}
        owned={owned}
        downloadHref={p.scanId ? `/api/fixpack/${p.scanId}` : null}
        buyHref={p.scanId ? `/api/checkout/${p.scanId}` : '/pricing'}
        price={PRICING.fixpack.label}
      />
    </div>
  );
}

function wordNumber(n: number): string {
  const w = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve'][n];
  return w ?? String(n);
}
