import { NextResponse } from 'next/server';
import { boardSummaries } from '@/lib/tracker-db';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ boards: boardSummaries() });
}
