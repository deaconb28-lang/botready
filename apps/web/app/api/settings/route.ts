import { NextResponse } from 'next/server';

import { currentUser } from '@/lib/auth';
import { getSettings, updateSettings, type UserSettings } from '@/lib/settings';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const KEYS: Array<keyof UserSettings> = ['weeklyRescan', 'alertOnDrop', 'monthlyDigest', 'showInIndex'];

/** GET /api/settings -> the four toggles. PATCH { key: boolean, … } -> saved. */
export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
  return NextResponse.json(await getSettings(user.id));
}

export async function PATCH(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const patch: Partial<UserSettings> = {};
  for (const key of KEYS) {
    if (typeof body[key] === 'boolean') patch[key] = body[key] as boolean;
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: `Send one of ${KEYS.join(', ')} as a boolean.` }, { status: 400 });
  }
  try {
    return NextResponse.json(await updateSettings(user.id, patch));
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
