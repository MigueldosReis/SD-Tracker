'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { parseAsStringLiteral, useQueryState } from 'nuqs';
import { Button } from '@/components/ui/button';
import { ganttRow, type GanttRow } from '@/lib/gantt';
import type { BoardDef, Order } from '@/lib/tracker-fields';
import { cn } from '@/lib/utils';
import { fmtDate, isOpen, orderTitle, siteName, str } from './shared';
import { statusColor } from './status-style';

const ZOOMS = { weeks: 22, months: 6 } as const; // pixels per day
type Zoom = keyof typeof ZOOMS;
const ROW_CAP = 150;
const NAME_W = 240;
const DAY = 86_400_000;

const toT = (d: string) => Date.parse(`${d}T00:00:00Z`);
const ymd = (t: number) => new Date(t).toISOString().slice(0, 10);
const addDays = (d: string, n: number) => ymd(toT(d) + n * DAY);
const mondayOf = (d: string) => addDays(d, -((new Date(toT(d)).getUTCDay() + 6) % 7));
const MONTH = new Intl.DateTimeFormat('en-ZA', {
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC'
});

type Item = { o: Order; r: GanttRow };

/** What a bar shows, in words: for screen readers and the hover tip. */
const summary = ({ o, r }: Item) =>
  [
    `${str(o.status) || 'No status'}${r.late ? ', late for this step' : ''}.`,
    `Came in ${fmtDate(r.start)}.`,
    r.offJourney
      ? 'Not on the delivery journey, so no handover estimate.'
      : `Handover ${r.estimated ? 'estimated for' : 'forecast for'} ${fmtDate(r.end)}${r.uncertain ? ' (may move: some steps wait on others)' : ''}.`,
    ...r.milestones
      .filter((m) => m.kind !== 'Handover')
      .map((m) => `${m.kind} ${m.done ? 'was' : 'booked for'} ${fmtDate(m.date)}.`)
  ].join(' ');

/**
 * Open orders on a timeline: when each came in, the current step (red when late), the estimated rest of the
 * journey up to handover, and booked survey, install and cutover dates. Click a bar or a name to open the order.
 */
export function GanttView({
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
  // Zoom lives in the URL like the other view settings, so a shared link opens at the same zoom.
  const [zoom, setZoom] = useQueryState(
    'zoom',
    parseAsStringLiteral(Object.keys(ZOOMS) as Zoom[]).withDefault('weeks')
  );
  const [cap, setCap] = useState(ROW_CAP);
  const scroller = useRef<HTMLDivElement>(null);
  const px = ZOOMS[zoom];

  const { items, from, days } = useMemo(() => {
    const items: Item[] = orders
      .filter(isOpen)
      .map((o) => ({ o, r: ganttRow(o, today) }))
      .toSorted(
        (a, b) =>
          Number(b.r.late) - Number(a.r.late) ||
          a.r.end.localeCompare(b.r.end) ||
          a.r.start.localeCompare(b.r.start)
      );
    // From the earliest start (at most a year back) to the latest handover (at most 18 months ahead).
    const min = items.reduce((m, it) => (it.r.start < m ? it.r.start : m), addDays(today, -28));
    const max = items.reduce((m, it) => (it.r.end > m ? it.r.end : m), addDays(today, 56));
    const from = mondayOf(min < addDays(today, -365) ? addDays(today, -365) : min);
    const to = max > addDays(today, 548) ? addDays(today, 548) : max;
    return { items, from, days: Math.round((toT(to) - toT(from)) / DAY) + 14 };
  }, [orders, today]);

  const x = (d: string) => Math.max(0, Math.min(days, (toT(d) - toT(from)) / DAY)) * px;
  const width = days * px;
  const todayX = x(today);
  const homeLeft = Math.max(0, todayX - 3 * 7 * px);

  // Open with today in view, three weeks in from the left, and keep it there when zooming.
  useEffect(() => {
    if (scroller.current) scroller.current.scrollLeft = homeLeft;
  }, [homeLeft]);

  const months = useMemo(() => {
    const out: { label: string; left: number }[] = [];
    let d = `${from.slice(0, 8)}01`;
    while (toT(d) < toT(from) + days * DAY) {
      if (d >= from)
        out.push({
          label: MONTH.format(toT(d)),
          left: (toT(d) - toT(from)) / DAY
        });
      const t = new Date(toT(d));
      d = ymd(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 1));
    }
    return out;
  }, [from, days]);
  const weeks = Array.from({ length: Math.ceil(days / 7) }, (_, i) => addDays(from, i * 7));

  const title = (o: Order) =>
    board.mrp ? siteName(board, o) || 'Untitled store' : orderTitle(board, o);
  const sub = (o: Order) =>
    board.mrp ? str(o.status) : [str(o.site), str(o.status)].filter(Boolean).join(' · ');
  if (items.length === 0)
    return (
      <p className='text-muted-foreground rounded-xl border p-8 text-center text-sm'>
        No open orders to show on the timeline.
      </p>
    );

  return (
    <div className='flex flex-col gap-3'>
      <div className='flex flex-wrap items-center gap-x-4 gap-y-2'>
        <div role='group' aria-label='Zoom' className='bg-muted flex rounded-lg p-0.5'>
          {(Object.keys(ZOOMS) as Zoom[]).map((z) => (
            <button
              key={z}
              type='button'
              aria-pressed={zoom === z}
              onClick={() => void setZoom(z === 'weeks' ? null : z)}
              className={cn(
                'focus-visible:ring-ring rounded-md px-3 py-1 text-sm capitalize outline-none focus-visible:ring-3',
                zoom === z
                  ? 'bg-background font-medium shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {z}
            </button>
          ))}
        </div>
        <Button
          variant='outline'
          size='sm'
          onClick={() =>
            scroller.current?.scrollTo({
              left: homeLeft,
              behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
            })
          }
        >
          Today
        </Button>
        <Legend />
      </div>

      <div
        ref={scroller}
        className='bg-card relative max-h-[calc(100dvh-15rem)] overflow-auto overscroll-x-contain rounded-xl border'
        role='region'
        aria-label='Timeline of open orders'
        // Scrollable region: focusable so it can be scrolled from the keyboard.
        // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex
        tabIndex={0}
      >
        <div className='relative' style={{ width: NAME_W + width }}>
          {/* Header: months, then week starts (or week ticks when zoomed out). */}
          <div className='bg-card sticky top-0 z-20 flex border-b'>
            <div
              className='bg-card text-muted-foreground sticky left-0 z-10 flex shrink-0 items-end border-r px-3 pb-1.5 text-xs font-medium'
              style={{ width: NAME_W }}
            >
              {items.length} open {items.length === 1 ? 'order' : 'orders'}, late first
            </div>
            <div className='relative h-12' style={{ width }}>
              {months.map((m) => (
                <span
                  key={m.label}
                  className='absolute top-1.5 border-l pl-1.5 text-xs font-medium whitespace-nowrap'
                  style={{ left: m.left * px }}
                >
                  {m.label}
                </span>
              ))}
              <span
                className='bg-primary text-primary-foreground absolute bottom-0 z-10 -translate-x-1/2 rounded-t px-1.5 text-[10px] leading-4 font-medium'
                style={{ left: todayX }}
              >
                Today
              </span>
              {weeks.map((w) => (
                <span
                  key={w}
                  className={cn(
                    'text-muted-foreground absolute bottom-1.5 border-l pl-1 text-[11px] tabular-nums',
                    zoom === 'months' && 'h-1.5'
                  )}
                  style={{ left: x(w) }}
                >
                  {zoom === 'weeks' ? fmtDate(w, true) : null}
                </span>
              ))}
            </div>
          </div>

          {/* Weekend shading (zoomed in) and the today line sit behind the rows. */}
          {zoom === 'weeks' && (
            <div
              aria-hidden
              className='pointer-events-none absolute top-12 bottom-0'
              style={{
                left: NAME_W,
                width,
                backgroundImage: `repeating-linear-gradient(to right, transparent 0 ${5 * px}px, color-mix(in oklch, var(--muted) 70%, transparent) ${5 * px}px ${7 * px}px)`
              }}
            />
          )}
          <div
            aria-hidden
            className='bg-primary pointer-events-none absolute top-12 bottom-0 z-[5] w-0.5'
            style={{ left: NAME_W + todayX }}
          />

          <ul className='relative'>
            {items.slice(0, cap).map((it) => (
              <GanttLine
                key={it.o.id}
                item={it}
                title={title(it.o)}
                sub={sub(it.o)}
                summary={summary(it)}
                x={x}
                today={today}
                onOpen={onOpen}
              />
            ))}
          </ul>
        </div>
      </div>
      {items.length > cap && (
        <Button variant='outline' className='self-start' onClick={() => setCap((c) => c + ROW_CAP)}>
          Show {Math.min(ROW_CAP, items.length - cap)} more of {items.length - cap}
        </Button>
      )}
    </div>
  );
}

function GanttLine({
  item: { o, r },
  title,
  sub,
  summary,
  x,
  today,
  onOpen
}: {
  item: Item;
  title: string;
  sub: string;
  summary: string;
  x: (d: string) => number;
  today: string;
  onOpen: (id: string) => void;
}) {
  const color = statusColor(str(o.status));
  // Late part: from when the step was due up to today.
  const lateFrom = r.late && r.due ? (r.due > r.start ? r.due : r.start) : null;
  // The current step starts at its recorded start; imported orders have none, so it starts where it went late, or today.
  const stepFrom =
    r.stepStart && r.stepStart > r.start
      ? r.stepStart
      : (lateFrom ?? (today > r.start ? today : r.start));
  const stepTo = lateFrom ?? r.stepEnd;
  const seg = (a: string, b: string) => ({
    left: x(a),
    width: Math.max(4, x(b) - x(a))
  });
  return (
    <li className='group relative flex h-11 border-b last:border-b-0'>
      <button
        type='button'
        onClick={() => onOpen(o.id)}
        className='bg-card group-hover:bg-muted focus-visible:ring-ring sticky left-0 z-10 flex shrink-0 scroll-mt-12 flex-col justify-center border-r px-3 text-left outline-none focus-visible:ring-3 focus-visible:ring-inset'
        style={{ width: NAME_W }}
      >
        <span className='truncate text-sm font-medium'>{title}</span>
        <span className='text-muted-foreground truncate text-xs'>{sub}</span>
        <span className='sr-only'>{summary}</span>
      </button>
      {/* Mouse shortcut to the same order; the name button is the keyboard and screen reader route. */}
      <button
        type='button'
        tabIndex={-1}
        aria-hidden
        title={summary}
        onClick={() => onOpen(o.id)}
        className='group-hover:bg-muted/40 relative flex-1 cursor-pointer'
      >
        {/* Time so far, before the current step. */}
        {stepFrom > r.start && (
          <span
            className='absolute top-1/2 h-2 -translate-y-1/2 rounded-l-full'
            style={{
              ...seg(r.start, stepFrom),
              background: `color-mix(in oklch, ${color} 25%, transparent)`
            }}
          />
        )}
        {/* Current step in its status colour, then the late part in red. */}
        {stepTo > stepFrom || !lateFrom ? (
          <span
            className='absolute top-1/2 h-4 -translate-y-1/2 rounded-sm shadow-sm'
            style={{ ...seg(stepFrom, stepTo), background: color }}
          />
        ) : null}
        {lateFrom && (
          <span
            className='bg-destructive absolute top-1/2 h-4 -translate-y-1/2 rounded-sm shadow-sm'
            style={seg(lateFrom, today)}
          />
        )}
        {/* Rest of the journey, up to the forecast or estimated handover. */}
        {!r.offJourney && r.end > r.stepEnd && (
          <span
            className={cn(
              'absolute top-1/2 h-4 -translate-y-1/2 rounded-r-sm border-2 border-l-0',
              r.estimated && 'border-dashed'
            )}
            style={{
              ...seg(r.stepEnd, r.end),
              borderColor: `color-mix(in oklch, ${color} ${r.uncertain ? 40 : 70}%, transparent)`
            }}
          />
        )}
        {r.milestones.map((m) => (
          <span
            key={m.kind}
            className={cn(
              'ring-card absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rotate-45 ring-2',
              m.kind === 'Handover' ? 'size-3' : 'size-2.5',
              m.done ? 'bg-muted-foreground' : 'bg-card border-foreground border-2'
            )}
            style={{ left: x(m.date) }}
          />
        ))}
      </button>
    </li>
  );
}

function Legend() {
  return (
    <ul className='text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 text-xs'>
      <li className='flex items-center gap-1.5'>
        <span aria-hidden className='bg-primary/25 h-2 w-5 rounded-full' /> Time so far
      </li>
      <li className='flex items-center gap-1.5'>
        <span aria-hidden className='bg-primary h-3 w-5 rounded-sm' /> Current step
      </li>
      <li className='flex items-center gap-1.5'>
        <span aria-hidden className='bg-destructive h-3 w-5 rounded-sm' /> Late
      </li>
      <li className='flex items-center gap-1.5'>
        <span aria-hidden className='border-primary/70 h-3 w-5 rounded-sm border-2 border-dashed' />
        Estimated to handover
      </li>
      <li className='flex items-center gap-1.5'>
        <span aria-hidden className='border-foreground size-2.5 rotate-45 border-2' /> Booked date
      </li>
      <li className='flex items-center gap-1.5'>
        <span aria-hidden className='bg-primary h-3 w-0.5' /> Today
      </li>
    </ul>
  );
}
