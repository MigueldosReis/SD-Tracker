'use client';

import { useMemo, useState } from 'react';
import { Icons } from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { stepState } from '@/lib/journey';
import { OTHER_STATUSES, PROCESS_STATUSES, type BoardDef, type Order } from '@/lib/tracker-fields';
import { cn } from '@/lib/utils';
import { followUpOf, fmtDate, isOpen, isoDate, siteName, str } from './shared';
import { statusColor } from './status-style';

const CARD_CAP = 60;

const titleOf = (board: BoardDef, o: Order) =>
  (board.mrp ? siteName(board, o) : str(o.customer) || str(o.site)) || 'Untitled order';
const subOf = (board: BoardDef, o: Order) =>
  board.mrp ? str(o.supplier) : str(o.customer) ? str(o.site) : '';

/**
 * Open orders as columns of the 16-step journey. Drag a card to another column (or use its menu in the
 * table) to change the status; the same rules apply, e.g. Install Scheduled needs an install date.
 */
export function KanbanView({
  board,
  orders,
  today,
  onOpen,
  onStatusChange
}: {
  board: BoardDef;
  orders: Order[];
  today: string;
  onOpen: (id: string) => void;
  onStatusChange: (o: Order, status: string) => void;
}) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);

  const columns = useMemo(() => {
    const open = orders.filter(isOpen);
    const known = [
      ...PROCESS_STATUSES.filter((s) => s !== 'Complete'),
      ...OTHER_STATUSES.filter((s) => s !== 'Cancelled')
    ] as string[];
    const extra = [
      ...new Set(open.map((o) => str(o.status)).filter((s) => s && !known.includes(s)))
    ].toSorted();
    return [...known, ...extra].map((status) => {
      const cards = open
        .filter((o) => str(o.status) === status)
        .map((o) => ({ o, step: stepState(o, today) }))
        .toSorted(
          (a, b) => Number(b.step.late) - Number(a.step.late) || b.step.daysLate - a.step.daysLate
        );
      return { status, cards, legacy: extra.includes(status) };
    });
  }, [orders, today]);

  const order = dragId ? orders.find((o) => o.id === dragId) : undefined;

  return (
    <div className='flex flex-col gap-2'>
      <p className='text-muted-foreground text-sm'>
        Open orders by delivery step. Drag a card to another column to change its status. Late
        orders are listed first.
      </p>
      <div
        className='-mx-1 flex gap-3 overflow-x-auto px-1 pb-3'
        role='list'
        aria-label='Delivery steps'
      >
        {columns.map(({ status, cards, legacy }) => (
          // Drop target for drag and drop; keyboard users change status from the card's order panel instead.
          // oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
          <section
            key={status}
            role='listitem'
            aria-label={`${status}: ${cards.length} orders`}
            className={cn(
              'bg-muted/40 flex max-h-[calc(100dvh-16rem)] shrink-0 flex-col rounded-xl border',
              cards.length ? 'w-72' : 'w-48',
              over === status && 'ring-primary ring-2',
              legacy && 'border-dashed'
            )}
            onDragOver={(e) => {
              if (dragId) {
                e.preventDefault();
                setOver(status);
              }
            }}
            onDragLeave={() => setOver((s) => (s === status ? null : s))}
            onDrop={(e) => {
              e.preventDefault();
              setOver(null);
              if (order && str(order.status) !== status) onStatusChange(order, status);
              setDragId(null);
            }}
          >
            <header className='flex items-center gap-2 border-b px-3 py-2'>
              <span
                aria-hidden
                className='size-2.5 shrink-0 rounded-sm'
                style={{ background: statusColor(status) }}
              />
              <h3 className='min-w-0 flex-1 truncate text-sm font-medium' title={status}>
                {status}
              </h3>
              <Badge variant='secondary' className='tabular-nums'>
                {cards.length}
              </Badge>
            </header>
            <div className='flex min-h-16 flex-col gap-2 overflow-y-auto p-2'>
              {cards.length === 0 && (
                <p className='text-muted-foreground px-1 py-2 text-xs'>Nothing at this step.</p>
              )}
              {cards.slice(0, CARD_CAP).map(({ o, step }) => (
                <button
                  key={o.id}
                  type='button'
                  draggable
                  onDragStart={(e) => {
                    setDragId(o.id);
                    e.dataTransfer.effectAllowed = 'move';
                  }}
                  onDragEnd={() => {
                    setDragId(null);
                    setOver(null);
                  }}
                  onClick={() => onOpen(o.id)}
                  className={cn(
                    'bg-card hover:border-ring focus-visible:ring-ring/50 flex flex-col gap-1 rounded-lg border p-2.5 text-left text-sm outline-none focus-visible:ring-3',
                    step.late && 'border-l-destructive border-l-4',
                    dragId === o.id && 'opacity-40'
                  )}
                >
                  <span className='truncate font-medium'>{titleOf(board, o)}</span>
                  {subOf(board, o) && (
                    <span className='text-muted-foreground truncate text-xs'>
                      {subOf(board, o)}
                    </span>
                  )}
                  <span className='flex flex-wrap items-center gap-1.5 text-xs'>
                    {step.late ? (
                      <Badge variant='destructive' className='tabular-nums'>
                        {step.daysLate > 0 ? `${step.daysLate}d late` : 'Late'}
                      </Badge>
                    ) : step.daysInStep > 0 || step.due ? (
                      <span className='text-muted-foreground'>{step.summary}</span>
                    ) : null}
                    {o.supplier && !board.mrp ? (
                      <span className='text-muted-foreground'>· {str(o.supplier)}</span>
                    ) : null}
                  </span>
                </button>
              ))}
              {cards.length > CARD_CAP && (
                <p className='text-muted-foreground px-1 text-xs'>
                  {cards.length - CARD_CAP} more. Search or filter to narrow the list.
                </p>
              )}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

type CalEvent = { o: Order; date: string; kind: 'Survey' | 'Install' | 'Cutover' | 'Follow-up' };
const KIND_STYLE: Record<CalEvent['kind'], string> = {
  Survey: 'border-l-sky-500',
  Install: 'border-l-violet-500',
  Cutover: 'border-l-emerald-500',
  'Follow-up': 'border-l-amber-500'
};
const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const WEEKS = 6;

function mondayOf(date: string) {
  const t = new Date(`${date}T00:00:00Z`);
  const dow = (t.getUTCDay() + 6) % 7;
  return new Date(t.getTime() - dow * 86_400_000);
}
const ymd = (t: Date) => t.toISOString().slice(0, 10);

/** Six weeks of booked surveys, installs and cutovers (and follow-ups on follow-up boards) for open orders. */
export function CalendarView({
  board,
  orders,
  today,
  onOpen
}: {
  board: BoardDef;
  orders: Order[];
  today: string;
  onOpen: (id: string) => void;
}) {
  const { days, missed } = useMemo(() => {
    const events: CalEvent[] = [];
    const missed: CalEvent[] = [];
    for (const o of orders) {
      if (!isOpen(o)) continue;
      const add = (date: string, kind: CalEvent['kind'], status: string) => {
        if (!date) return;
        if (date >= today) events.push({ o, date, kind });
        else if (o.status === status) missed.push({ o, date, kind });
      };
      add(isoDate(o.siteSurvey), 'Survey', 'Site Survey Scheduled');
      add(isoDate(o.installDate), 'Install', 'Install Scheduled');
      add(isoDate(o.cutoverDate), 'Cutover', 'Cutover Scheduled');
      const f = followUpOf(board, o, today);
      if (f) events.push({ o, date: f.due < today ? today : f.due, kind: 'Follow-up' });
    }
    const start = mondayOf(today);
    const days = Array.from({ length: WEEKS * 7 }, (_, i) => {
      const date = ymd(new Date(start.getTime() + i * 86_400_000));
      return { date, events: events.filter((e) => e.date === date) };
    });
    return { days, missed: missed.toSorted((a, b) => a.date.localeCompare(b.date)) };
  }, [orders, board, today]);

  const chip = (e: CalEvent, withDate = false) => (
    <button
      key={`${e.o.id}-${e.kind}`}
      type='button'
      onClick={() => onOpen(e.o.id)}
      title={`${e.kind}: ${titleOf(board, e.o)}${withDate ? ` (${fmtDate(e.date)})` : ''}`}
      className={cn(
        'bg-card hover:bg-muted focus-visible:ring-ring/50 w-full truncate rounded-md border border-l-4 px-1.5 py-0.5 text-left text-xs outline-none focus-visible:ring-3',
        KIND_STYLE[e.kind]
      )}
    >
      <span className='font-medium'>{e.kind}</span> {titleOf(board, e.o)}
      {withDate ? ` · ${fmtDate(e.date, true)}` : ''}
    </button>
  );

  return (
    <div className='flex flex-col gap-4'>
      <div className='text-muted-foreground flex flex-wrap items-center gap-3 text-xs'>
        {(
          [
            'Survey',
            'Install',
            'Cutover',
            ...(board.followUp ? ['Follow-up'] : [])
          ] as CalEvent['kind'][]
        ).map((k) => (
          <span
            key={k}
            className={cn('bg-card rounded-md border border-l-4 px-2 py-0.5', KIND_STYLE[k])}
          >
            {k}
          </span>
        ))}
        <span>
          Booked dates for open orders over the next six weeks. Overdue follow-ups show on today.
        </span>
      </div>
      {missed.length > 0 && (
        <Card className='border-destructive/40 gap-2 p-4'>
          <h3 className='flex items-center gap-2 text-sm font-medium'>
            <Icons.alertCircle aria-hidden className='text-destructive size-4' />
            Date passed, status not updated ({missed.length})
          </h3>
          <div className='grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-3'>
            {missed.slice(0, 30).map((e) => chip(e, true))}
          </div>
        </Card>
      )}
      <div className='overflow-x-auto'>
        <div className='grid min-w-[760px] grid-cols-7 gap-1.5'>
          {DAY_NAMES.map((d) => (
            <div key={d} className='text-muted-foreground px-1 text-xs font-medium'>
              {d}
            </div>
          ))}
          {days.map(({ date, events }, i) => {
            const weekend = i % 7 >= 5;
            const isToday = date === today;
            return (
              <div
                key={date}
                className={cn(
                  'bg-card flex min-h-24 flex-col gap-1 rounded-lg border p-1.5',
                  weekend && 'bg-muted/40',
                  isToday && 'ring-primary ring-2'
                )}
              >
                <div
                  className={cn(
                    'flex items-center justify-between text-xs tabular-nums',
                    isToday ? 'font-semibold' : 'text-muted-foreground'
                  )}
                >
                  <span>{fmtDate(date, true)}</span>
                  {isToday && <span>Today</span>}
                </div>
                {events.slice(0, 4).map((e) => chip(e))}
                {events.length > 4 && (
                  <span className='text-muted-foreground text-xs'>{events.length - 4} more</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
