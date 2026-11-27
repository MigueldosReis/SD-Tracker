import { NextResponse } from 'next/server';
import { personFrom } from '@/lib/team';
import { listNotifications, markNotificationsRead } from '@/lib/tracker-db';

export const dynamic = 'force-dynamic';

const nobody = () =>
  NextResponse.json(
    { error: 'Choose who you are (Posting as) to see your notifications' },
    { status: 400 }
  );

/** The caller's notifications (X-Tracker-Person header) and how many are unread. */
export async function GET(req: Request) {
  const me = personFrom(req);
  if (!me) return nobody();
  return NextResponse.json(listNotifications(me));
}

/** Mark notifications as read: { n } for one, {} for all. */
export async function POST(req: Request) {
  const me = personFrom(req);
  if (!me) return nobody();
  const body = (await req.json().catch(() => ({}))) as { n?: unknown };
  const n = typeof body.n === 'number' && Number.isInteger(body.n) ? body.n : undefined;
  markNotificationsRead(me, n);
  return NextResponse.json(listNotifications(me));
}
