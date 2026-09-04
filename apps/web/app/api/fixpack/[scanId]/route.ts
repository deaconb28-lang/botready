import { NextResponse } from 'next/server';


import { currentUser, hasFixpackEntitlement } from '@/lib/auth';
import { loadScanView } from '@/lib/scan-data';
import { assembleFixPack } from '@/lib/fixpack';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/fixpack/:scanId -> a zip
 *
 * The entitlement unlocks the download. The files are generated on the way out
 * from the evidence rows rather than stored, because they are a pure function
 * of the scan and storing them would only create a second thing that could go
 * stale.
 *
 * Every response here is a plain sentence about what to do next. A 401 from a
 * download link with a JSON blob behind it is a dead end.
 */
export async function GET(_request: Request, context: { params: Promise<{ scanId: string }> }) {
  const { scanId } = await context.params;

  const user = await currentUser();
  if (!user) {
    return NextResponse.redirect(
      new URL(`/sign-in?next=${encodeURIComponent(`/api/fixpack/${scanId}`)}`, _request.url),
      { status: 303 },
    );
  }

  if (!(await hasFixpackEntitlement(user.id))) {
    return text(
      403,
      `${user.email} has not bought the fix pack. If you have, and the receipt went to a different address, sign in with that one. The result page has the button.`,
    );
  }

  const view = await loadScanView(scanId);
  if (!view) return text(404, 'No scan with that id.');
  if (!view.score) {
    return text(409, 'This scan did not produce a result, so there is nothing to generate from it.');
  }

  const pack = assembleFixPack(view, scanId);
  if (!pack) return text(409, 'This scan did not produce a result, so there is nothing to generate from it.');
  const archive = pack.archive;

  return new Response(Buffer.from(archive), {
    status: 200,
    headers: {
      'content-type': 'application/zip',
      'content-disposition': `attachment; filename="${pack.filename}"`,
      'content-length': String(archive.byteLength),
      'cache-control': 'private, no-store',
    },
  });
}

function text(status: number, body: string): Response {
  return new Response(body + '\n', {
    status,
    headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
  });
}
