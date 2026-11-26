import { NextResponse } from 'next/server';
import { getLog, recordFollowUp, ValidationError } from '@/lib/tracker-db';

export const dynamic = 'force-dynamic';
type Ctx = { params: Promise<{ id: string }> };

/** Record that the order was followed up today, with an optional note. */
export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { note?: unknown };
  try {
    const order = recordFollowUp(id, typeof body.note === 'string' ? body.note : undefined);
    return NextResponse.json({ order, log: getLog(id) });
  } catch (e) {
    if (e instanceof ValidationError)
      return NextResponse.json({ error: e.message }, { status: 404 });
    throw e;
  }
}
