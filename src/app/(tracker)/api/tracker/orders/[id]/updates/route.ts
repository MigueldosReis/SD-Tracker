import { NextResponse } from 'next/server';
import { addUpdate, getOrder, getUpdates, ValidationError } from '@/lib/tracker-db';

export const dynamic = 'force-dynamic';
type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  if (!getOrder(id)) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  return NextResponse.json({ updates: getUpdates(id) });
}

/** Post an update (comment) on the order: { text, author? }. */
export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { text?: unknown; author?: unknown };
  try {
    const updates = addUpdate(
      id,
      typeof body.text === 'string' ? body.text : '',
      typeof body.author === 'string' ? body.author : null
    );
    return NextResponse.json({ updates, order: getOrder(id) }, { status: 201 });
  } catch (e) {
    if (e instanceof ValidationError) {
      return NextResponse.json(
        { error: e.message },
        { status: e.message === 'Order not found' ? 404 : 400 }
      );
    }
    throw e;
  }
}
