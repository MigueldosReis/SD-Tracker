import { NextResponse } from 'next/server';
import { createOrder, listOrders } from '@/lib/tracker-db';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ orders: listOrders() });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { customer?: string; site?: string; groupName?: string } | null;
  const customer = body?.customer?.trim();
  const groupName = body?.groupName?.trim();
  if (!customer || !groupName) return NextResponse.json({ error: 'customer and groupName are required' }, { status: 400 });
  return NextResponse.json({ order: createOrder({ customer, site: body?.site?.trim(), groupName }) }, { status: 201 });
}
