import { NextResponse } from 'next/server';
import { createOrder, listOrders, ValidationError } from '@/lib/tracker-db';
import { isBoardId } from '@/lib/tracker-fields';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const board = new URL(req.url).searchParams.get('board') ?? 'orders';
  if (!isBoardId(board)) return NextResponse.json({ error: 'Unknown board' }, { status: 400 });
  return NextResponse.json({ orders: listOrders(board) });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    board?: string;
    customer?: string;
    site?: string;
    groupName?: string;
    storeCode?: string;
  } | null;
  const board = body?.board ?? 'orders';
  const customer = body?.customer?.trim();
  const groupName = body?.groupName?.trim();
  if (!isBoardId(board)) return NextResponse.json({ error: 'Unknown board' }, { status: 400 });
  if (!customer || !groupName)
    return NextResponse.json({ error: 'customer and groupName are required' }, { status: 400 });
  try {
    const order = createOrder({
      board,
      customer,
      groupName,
      site: body?.site,
      storeCode: body?.storeCode
    });
    return NextResponse.json({ order }, { status: 201 });
  } catch (e) {
    if (e instanceof ValidationError)
      return NextResponse.json({ error: e.message, field: e.field }, { status: 400 });
    throw e;
  }
}
