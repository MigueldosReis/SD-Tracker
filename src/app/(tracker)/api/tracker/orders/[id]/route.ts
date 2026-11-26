import { NextResponse } from 'next/server';
import { deleteOrder, getLog, getOrder, updateOrder, ValidationError } from '@/lib/tracker-db';

export const dynamic = 'force-dynamic';
type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const order = getOrder(id);
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  return NextResponse.json({ order, log: getLog(id) });
}

export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: 'Expected a JSON object' }, { status: 400 });
  }
  try {
    const order = updateOrder(id, body as Record<string, unknown>);
    return NextResponse.json({ order, log: getLog(id) });
  } catch (e) {
    if (e instanceof ValidationError) {
      return NextResponse.json({ error: e.message, field: e.field }, { status: e.message === 'Order not found' ? 404 : 400 });
    }
    throw e;
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  return deleteOrder(id)
    ? NextResponse.json({ ok: true })
    : NextResponse.json({ error: 'Order not found' }, { status: 404 });
}
