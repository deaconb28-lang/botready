import { NextResponse } from 'next/server';


import { claimEntitlement, claimable, coversDomain, currentUser, entitlementsFor } from '@/lib/auth';
import { purchaseCovers } from '@/lib/purchase';
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
export async function GET(request: Request, context: { params: Promise<{ scanId: string }> }) {
  const { scanId } = await context.params;

  // Two proofs, either one enough. The checkout session is what somebody who
  // has just paid actually has — a payment link creates no session here, so
  // requiring an account made the download unreachable at the exact moment it
  // mattered most. The entitlement is for everyone coming back later.
  const sessionId = new URL(request.url).searchParams.get('session_id');
  if (await purchaseCovers(sessionId, scanId)) {
    return await deliver(scanId);
  }

  const user = await currentUser();
  if (!user) {
    return NextResponse.redirect(
      new URL(`/sign-in?next=${encodeURIComponent(`/api/fixpack/${scanId}`)}`, request.url),
      { status: 303 },
    );
  }

  // The scan names the domain, and the domain is what was bought. Loading the
  // view twice on this path is cheap next to handing over the wrong pack.
  const view = await loadScanView(scanId);
  if (!view) return text(404, 'No scan with that id.');

  const held = await entitlementsFor(user.id);
  if (!coversDomain(held, view.site.domain)) {
    return text(
      403,
      `${user.email} has not bought the fix pack for ${view.site.domain}. A pack covers one domain; the result page has the button to add this one. If you have bought it and the receipt went to a different address, sign in with that one.`,
    );
  }

  // Spend an unclaimed grant on this domain. A purchase the webhook could not
  // tie to a site arrives with no domain on it, and it is worth one pack — this
  // is the moment the buyer says which one, by asking for it. Stamped before
  // the files go out so a second domain gets the paywall rather than a race.
  if (claimable(held, view.site.domain)) {
    await claimEntitlement(user.id, view.site.domain);
  }

  return await deliver(scanId);
}

/** The archive itself, once the caller has proved they may have it. */
async function deliver(scanId: string): Promise<Response> {

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
