'use client';

import { useMemo, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Icons } from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import {
  KIND_LABEL,
  KIND_ORDER,
  attentionList,
  mentions,
  type AttentionItem,
  type AttentionKind
} from '@/lib/attention';
import { OWNERS, getBoard, type Order } from '@/lib/tracker-fields';
import { todayZA } from '@/lib/working-days';
import { cn } from '@/lib/utils';
import { boardHref, fmtDate, fmtDateTime, orderTitle, str, type Summary } from './shared';
import { StatusBadge } from './status-controls';
import { TrackerShell } from './tracker-shell';
import { MentionText } from './updates-panel';

type RecentUpdate = {
  n: number;
  orderId: string;
  at: string;
  author: string | null;
  text: string;
  board: string | null;
  customer: string | null;
  site: string | null;
  storeCode: string | null;
  ref: string | null;
};

const ME_KEY = 'sd-tracker:author';
const EVERYONE = '__everyone__';
const UNASSIGNED = '__unassigned__';

const KIND_HELP: Record<AttentionKind, string> = {
  close: 'Handover was sent and the 2-day confirmation period has passed.',
  'date-passed':
    'A booked survey, install or cutover date has passed but the status has not moved.',
  late: 'Longer than usual in their status.',
  'follow-up': 'Follow-up due today or overdue (every 3 working days).',
  'this-week': 'Surveys, installs and cutovers in the next 5 working days.'
};
const KIND_TONE: Record<AttentionKind, string> = {
  close: 'border-l-emerald-500',
  'date-passed': 'border-l-destructive',
  late: 'border-l-destructive',
  'follow-up': 'border-l-amber-500',
  'this-week': 'border-l-sky-500'
};

function readMe() {
  try {
    return localStorage.getItem(ME_KEY) ?? '';
  } catch {
    return '';
  }
}

const title = (o: { board?: unknown } & Partial<Order>) => {
  const b = getBoard(String(o.board ?? 'orders'));
  return b ? orderTitle(b, o as Order) : str(o.customer) || 'Order';
};
const href = (board: string, id: string) =>
  `${boardHref((getBoard(board)?.id ?? 'orders') as never)}?order=${encodeURIComponent(id)}`;

/** Everything that needs a person's attention today, across every board, with one-click fixes where possible. */
export function MyWork({
  initialOrders,
  updates,
  summaries
}: {
  initialOrders: Order[];
  updates: RecentUpdate[];
  summaries: Summary[];
}) {
  const [orders, setOrders] = useState(initialOrders);
  const stored = useSyncExternalStore(
    () => () => {},
    readMe,
    () => ''
  );
  const [picked, setPicked] = useState<string | null>(null);
  const who = picked ?? (stored || EVERYONE);
  const [busy, setBusy] = useState<string | null>(null);
  const today = todayZA();

  const byId = useMemo(() => new Map(orders.map((o) => [o.id, o])), [orders]);
  const items = useMemo(
    () =>
      attentionList(orders, today, who === EVERYONE ? undefined : who === UNASSIGNED ? null : who),
    [orders, today, who]
  );
  const grouped = useMemo(() => {
    const m = new Map<AttentionKind, AttentionItem[]>();
    for (const i of items) m.set(i.kind, [...(m.get(i.kind) ?? []), i]);
    return KIND_ORDER.filter((k) => m.has(k)).map((k) => ({ kind: k, items: m.get(k)! }));
  }, [items]);
  const myMentions = useMemo(
    () =>
      (OWNERS as readonly string[]).includes(who)
        ? updates.filter((u) => mentions(u.text).includes(who))
        : [],
    [updates, who]
  );
  const unassigned = useMemo(() => orders.filter((o) => !o.owner).length, [orders]);
  const perOwner = useMemo(() => {
    const all = attentionList(orders, today);
    return [...OWNERS, null].map((p) => ({
      name: p,
      n: all.filter((i) => (byId.get(i.orderId)?.owner ?? null) === p && i.kind !== 'this-week')
        .length
    }));
  }, [orders, today, byId]);

  function choose(v: string) {
    setPicked(v);
    if ((OWNERS as readonly string[]).includes(v)) {
      try {
        localStorage.setItem(ME_KEY, v);
      } catch {
        /* not available */
      }
    }
  }

  async function act(item: AttentionItem) {
    if (!item.action) return;
    setBusy(item.orderId);
    const res = await fetch(`/api/tracker/orders/${encodeURIComponent(item.orderId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item.action.patch)
    });
    const data = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) {
      toast.error(
        String(data.error ?? 'Could not change the order. Refresh the page and try again.')
      );
      return;
    }
    const updated = data.order as Order;
    setOrders((p) =>
      updated.status === 'Complete' || updated.status === 'Cancelled'
        ? p.filter((o) => o.id !== updated.id)
        : p.map((o) => (o.id === updated.id ? updated : o))
    );
    toast.success(`${title(updated)}: ${item.action.label.replace(/^Mark /, 'marked ')}`);
  }

  const actionable = items.filter((i) => i.kind !== 'this-week').length;
  const personLabel =
    who === EVERYONE ? 'everyone' : who === UNASSIGNED ? 'unassigned orders' : who.split(' ')[0];

  return (
    <TrackerShell board={{ id: 'my-work', title: 'My work' }} summaries={summaries}>
      <div className='flex flex-wrap items-start justify-between gap-4'>
        <div className='min-w-0'>
          <h1 className='text-2xl font-semibold tracking-tight text-balance'>
            {actionable === 0
              ? `Nothing needs action for ${personLabel}`
              : `${actionable} ${actionable === 1 ? 'thing needs' : 'things need'} action for ${personLabel}`}
          </h1>
          <p className='text-muted-foreground text-sm'>
            Reminders are worked out from the delivery rules, so there is nothing to set up.{' '}
            {fmtDate(today)}.
          </p>
        </div>
        <Select value={who} onValueChange={(v) => choose(String(v))}>
          <SelectTrigger className='w-56' aria-label='Show work for'>
            <Icons.user aria-hidden className='text-muted-foreground' />
            <SelectValue>
              {(v: string) =>
                v === EVERYONE ? 'Everyone' : v === UNASSIGNED ? 'Unassigned orders' : v
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {OWNERS.map((o) => (
              <SelectItem key={o} value={o}>
                {o}
              </SelectItem>
            ))}
            <SelectSeparator />
            <SelectItem value={EVERYONE}>Everyone</SelectItem>
            <SelectItem value={UNASSIGNED}>Unassigned orders</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <section
        aria-label='Summary'
        className='grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5'
      >
        {KIND_ORDER.map((k) => {
          const n = grouped.find((g) => g.kind === k)?.items.length ?? 0;
          return (
            <a
              key={k}
              href={`#${k}`}
              className={cn(
                'bg-card hover:bg-muted/50 focus-visible:ring-ring/50 rounded-xl border border-l-4 p-4 outline-none focus-visible:ring-3',
                KIND_TONE[k],
                !n && 'opacity-60'
              )}
            >
              <div className='text-muted-foreground text-sm'>{KIND_LABEL[k]}</div>
              <div className='text-2xl font-semibold tabular-nums'>{n}</div>
            </a>
          );
        })}
      </section>

      <div className='grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_320px]'>
        <div className='flex min-w-0 flex-col gap-6'>
          {grouped.length === 0 && (
            <Card className='items-center gap-2 py-12 text-center'>
              <Icons.circleCheck aria-hidden className='size-8 text-emerald-500' />
              <p className='font-medium'>All clear</p>
              <p className='text-muted-foreground max-w-sm text-sm'>
                No late steps, passed dates, follow-ups or bookings this week for {personLabel}.
              </p>
            </Card>
          )}
          {grouped.map(({ kind, items: list }) => (
            <section key={kind} id={kind} aria-labelledby={`${kind}-h`} className='scroll-mt-20'>
              <div className='mb-2 flex items-baseline gap-2'>
                <h2 id={`${kind}-h`} className='font-semibold'>
                  {KIND_LABEL[kind]}
                </h2>
                <Badge variant='secondary' className='tabular-nums'>
                  {list.length}
                </Badge>
                <span className='text-muted-foreground hidden text-xs sm:inline'>
                  {KIND_HELP[kind]}
                </span>
              </div>
              <Card className='gap-0 divide-y overflow-hidden py-0'>
                {list.slice(0, 50).map((i) => {
                  const o = byId.get(i.orderId);
                  if (!o) return null;
                  return (
                    <div
                      key={`${i.kind}-${i.orderId}-${i.detail}`}
                      className={cn(
                        'flex flex-wrap items-center gap-3 border-l-4 px-4 py-3',
                        KIND_TONE[kind]
                      )}
                    >
                      <div className='min-w-0 flex-1'>
                        <div className='flex flex-wrap items-center gap-2'>
                          <Link
                            href={href(i.board, i.orderId)}
                            className='truncate font-medium hover:underline'
                          >
                            {title(o)}
                          </Link>
                          <Badge variant='outline' className='font-normal'>
                            {getBoard(i.board)?.title ?? i.board}
                          </Badge>
                        </div>
                        <div className='text-muted-foreground mt-0.5 flex flex-wrap items-center gap-2 text-sm'>
                          <StatusBadge status={o.status} />
                          <span>{i.detail}</span>
                          {who === EVERYONE && (
                            <span>· {o.owner ? str(o.owner) : 'Unassigned'}</span>
                          )}
                        </div>
                      </div>
                      <div className='flex shrink-0 items-center gap-2'>
                        {i.action && (
                          <Button
                            size='sm'
                            disabled={busy === i.orderId}
                            onClick={() => void act(i)}
                          >
                            {busy === i.orderId ? (
                              <Icons.spinner className='animate-spin' />
                            ) : (
                              <Icons.check />
                            )}
                            {i.action.label}
                          </Button>
                        )}
                        <Button
                          size='sm'
                          variant='outline'
                          nativeButton={false}
                          render={
                            <Link href={href(i.board, i.orderId)} aria-label={`Open ${title(o)}`} />
                          }
                        >
                          Open
                        </Button>
                      </div>
                    </div>
                  );
                })}
                {list.length > 50 && (
                  <p className='text-muted-foreground px-4 py-2 text-sm'>
                    {list.length - 50} more. Open the board and use the Late filter to see them all.
                  </p>
                )}
              </Card>
            </section>
          ))}
        </div>

        <aside className='flex flex-col gap-6'>
          {(OWNERS as readonly string[]).includes(who) && (
            <section aria-labelledby='mentions-h'>
              <h2 id='mentions-h' className='mb-2 font-semibold'>
                Mentions
              </h2>
              <Card className='gap-0 divide-y py-0'>
                {myMentions.length === 0 && (
                  <p className='text-muted-foreground p-4 text-sm'>
                    No one has mentioned {who.split(' ')[0]} in the last 30 days. Type @
                    {who.split(' ')[0]} in an update to mention them.
                  </p>
                )}
                {myMentions.slice(0, 20).map((u) => (
                  <Link
                    key={u.n}
                    href={href(u.board ?? 'orders', u.orderId)}
                    className='hover:bg-muted/50 block p-3 text-sm'
                  >
                    <div className='flex items-center justify-between gap-2'>
                      <span className='truncate font-medium'>{title(u as never)}</span>
                      <time className='text-muted-foreground shrink-0 text-xs' dateTime={u.at}>
                        {fmtDateTime(u.at)}
                      </time>
                    </div>
                    <p className='text-muted-foreground line-clamp-2'>
                      <span className='text-foreground'>{u.author || 'Someone'}:</span>{' '}
                      <MentionText text={u.text} />
                    </p>
                  </Link>
                ))}
              </Card>
            </section>
          )}
          <section aria-labelledby='team-h'>
            <h2 id='team-h' className='mb-2 font-semibold'>
              Team
            </h2>
            <Card className='gap-0 divide-y py-0'>
              {perOwner.map(({ name, n }) => (
                <button
                  key={name ?? 'none'}
                  type='button'
                  onClick={() => choose(name ?? UNASSIGNED)}
                  className={cn(
                    'hover:bg-muted/50 flex items-center justify-between px-4 py-2 text-left text-sm',
                    (name ?? UNASSIGNED) === who && 'bg-muted font-medium'
                  )}
                >
                  <span>{name ?? `Unassigned (${unassigned} open)`}</span>
                  <span
                    className={cn(
                      'tabular-nums',
                      n ? 'text-destructive font-medium' : 'text-muted-foreground'
                    )}
                  >
                    {n}
                  </span>
                </button>
              ))}
            </Card>
            <p className='text-muted-foreground mt-2 text-xs'>
              Things needing action per person (not counting this week&apos;s bookings).
            </p>
          </section>
        </aside>
      </div>
    </TrackerShell>
  );
}
