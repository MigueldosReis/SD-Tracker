import { NextResponse } from 'next/server';
import { personFrom } from '@/lib/team';
import { bulkDelete, bulkUpdate } from '@/lib/tracker-db';

export const dynamic = 'force-dynamic';
const MAX = 500;

/** { ids, patch } applies the same change to each order; { ids, delete: true } deletes them. */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    ids?: unknown;
    patch?: unknown;
    delete?: unknown;
  } | null;
  const ids = Array.isArray(body?.ids)
    ? body.ids.filter((x): x is string => typeof x === 'string')
    : [];
  if (ids.length === 0)
    return NextResponse.json({ error: 'Select at least one order' }, { status: 400 });
  if (ids.length > MAX)
    return NextResponse.json({ error: `Select at most ${MAX} orders at a time` }, { status: 400 });
  if (body?.delete === true) return NextResponse.json({ results: bulkDelete(ids) });
  const patch = body?.patch;
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
    return NextResponse.json({ error: 'Expected a change to apply' }, { status: 400 });
  }
  return NextResponse.json({
    results: bulkUpdate(ids, patch as Record<string, unknown>, personFrom(req))
  });
}
