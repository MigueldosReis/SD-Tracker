'use client';

import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { parseAsBoolean, parseAsString, useQueryStates } from 'nuqs';
import { toast } from 'sonner';
import { Icons } from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput
} from '@/components/ui/input-group';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { Toggle } from '@/components/ui/toggle';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import Link from 'next/link';
import { belongsTo, getBoard, type BoardDef, type Order } from '@/lib/tracker-fields';
import { FOLLOW_UP_WORKING_DAYS, todayZA } from '@/lib/working-days';
import { cn } from '@/lib/utils';
import { OrderSheet } from './order-sheet';
import {
  BASE_STATUSES,
  BOARD_ICONS,
  boardHref,
  CLOSED,
  dueDate,
  followUpOf,
  fmtDate,
  isOpen,
  isoDate,
  siteName,
  str,
  type LogEntry,
  type SaveResult,
  type Summary
} from './shared';
import { FollowUpBadge, StatusMenu } from './status-controls';
import { groupColor } from './status-style';
import { TrackerShell } from './tracker-shell';

const ROW_CAP = 100;
const ALL = '__all__';

type Column = { key: string; header: string; cell: (o: Order) => ReactNode; className?: string };

const toggleIn = (set: Set<string>, name: string) => {
  const n = new Set(set);
  if (n.has(name)) n.delete(name);
  else n.add(name);
  return n;
};
const without = (set: Set<string>, name: string) => {
  const n = new Set(set);
  n.delete(name);
  return n;
};

export function OrdersBoard({
  board,
  initialOrders,
  summaries
}: {
  board: BoardDef;
  initialOrders: Order[];
  summaries: Summary[];
}) {
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  // Filters and the open order live in the URL, so a view can be bookmarked or shared.
  const [{ q, status: statusFilter, due: dueOnly, order: openId }, setUrl] = useQueryStates(
    {
      q: parseAsString.withDefault(''),
      status: parseAsString.withDefault(''),
      due: parseAsBoolean.withDefault(false),
      order: parseAsString
    },
    { history: 'replace' }
  );
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set(CLOSED));
  const [showAll, setShowAll] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState<string | null>(null);
  const today = todayZA();

  // Keep the local list in step with the server; an order moved to another board leaves this one.
  const applyOrder = useCallback(
    (order: Order) => {
      setOrders((prev) =>
        belongsTo(board, order)
          ? prev.map((o) => (o.id === order.id ? order : o))
          : prev.filter((o) => o.id !== order.id)
      );
    },
    [board]
  );

  const send = useCallback(
    async (url: string, method: string, body: unknown): Promise<SaveResult> => {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        return {
          ok: false,
          error: String(
            data.error ?? `Request failed (${res.status}). Refresh the page and try again.`
          ),
          field: data.field
        };
      applyOrder(data.order as Order);
      return { ok: true, order: data.order as Order, log: (data.log ?? []) as LogEntry[] };
    },
    [applyOrder]
  );

  const save = useCallback(
    (id: string, body: Record<string, unknown>) =>
      send(`/api/tracker/orders/${encodeURIComponent(id)}`, 'PATCH', body),
    [send]
  );
  const followUp = useCallback(
    (id: string, note?: string) =>
      send(`/api/tracker/orders/${encodeURIComponent(id)}/follow-up`, 'POST', { note }),
    [send]
  );
  const remove = useCallback(
    async (id: string) => {
      const res = await fetch(`/api/tracker/orders/${encodeURIComponent(id)}`, {
        method: 'DELETE'
      });
      if (!res.ok) return false;
      setOrders((p) => p.filter((o) => o.id !== id));
      void setUrl({ order: null });
      return true;
    },
    [setUrl]
  );

  const extraStatuses = useMemo(() => {
    const seen = new Set(BASE_STATUSES);
    return [
      ...new Set(orders.map((o) => str(o.status)).filter((s) => s && !seen.has(s)))
    ].toSorted();
  }, [orders]);

  const stats = useMemo(() => {
    let open = 0,
      overdue = 0,
      dueToday = 0,
      upcoming = 0,
      completed = 0,
      cancelled = 0,
      installs = 0;
    for (const o of orders) {
      if (o.groupName === 'Completed' || o.status === 'Complete') completed++;
      else if (o.groupName === 'Cancelled' || o.status === 'Cancelled') cancelled++;
      if (!isOpen(o)) continue;
      open++;
      if (o.installDate && isoDate(o.installDate) >= today) installs++;
      const f = followUpOf(board, o, today);
      if (f?.state === 'overdue') overdue++;
      else if (f?.state === 'due') dueToday++;
      else if (f) upcoming++;
    }
    return { open, overdue, dueToday, upcoming, completed, cancelled, installs };
  }, [orders, board, today]);

  const filtering = q.trim() !== '' || statusFilter !== '' || dueOnly;
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return orders.filter((o) => {
      if (statusFilter && o.status !== statusFilter) return false;
      if (dueOnly) {
        const f = followUpOf(board, o, today);
        if (!f || f.state === 'upcoming') return false;
      }
      if (!needle) return true;
      return [
        o.customer,
        siteName(board, o),
        o.circuit,
        o.ref,
        o.storeCode,
        o.address,
        o.supplier,
        o.owner
      ].some((v) => str(v).toLowerCase().includes(needle));
    });
  }, [orders, q, statusFilter, dueOnly, board, today]);

  const groups = useMemo(() => {
    const map = new Map<string, Order[]>();
    for (const o of filtered) {
      const g = str(o.groupName) || 'No group';
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(o);
    }
    if (board.followUp) {
      // The most urgent follow-ups first.
      const key = (o: Order) => (isOpen(o) ? (dueDate(o) ?? '9') : '9');
      for (const [g, rows] of map)
        map.set(
          g,
          rows.toSorted((a, b) => key(a).localeCompare(key(b)))
        );
    }
    const known = board.groups.filter((g) => !CLOSED.includes(g));
    const unknown = [...map.keys()]
      .filter((g) => !known.includes(g) && !CLOSED.includes(g))
      .toSorted();
    return [...known, ...unknown, ...CLOSED]
      .filter((g) => map.has(g) || (!filtering && !board.view && known.includes(g)))
      .map((g) => ({ name: g, rows: map.get(g) ?? [] }));
  }, [filtered, filtering, board]);

  const onStatusChange = useCallback(
    async (o: Order, status: string) => {
      const r = await save(o.id, { status });
      if (!r.ok) {
        toast.error(r.error, {
          description:
            'Fill in the missing detail in the order panel, then change the status again.'
        });
        void setUrl({ order: o.id });
      } else toast.success(`Status changed to ${status}`);
    },
    [save, setUrl]
  );

  const onFollowUpRow = useCallback(
    async (o: Order) => {
      const r = await followUp(o.id);
      if (r.ok)
        toast.success('Follow-up recorded', {
          description: `${siteName(board, o) || str(o.customer)} · next one in ${FOLLOW_UP_WORKING_DAYS} working days`
        });
      else toast.error(r.error);
    },
    [followUp, board]
  );

  const columns = useMemo<Column[]>(() => {
    const title = (o: Order) => siteName(board, o) || str(o.customer);
    const dash = <span className='text-muted-foreground'>—</span>;
    const status: Column = {
      key: 'status',
      header: 'Status',
      className: 'w-56 max-w-56',
      cell: (o) => (
        <StatusMenu
          status={str(o.status)}
          label={title(o)}
          onChange={(s) => onStatusChange(o, s)}
        />
      )
    };
    const updated: Column = {
      key: 'updated',
      header: 'Updated',
      className: 'text-muted-foreground tabular-nums whitespace-nowrap',
      cell: (o) => fmtDate(o.updatedAt)
    };
    const owner: Column = {
      key: 'owner',
      header: 'Owner',
      className: 'whitespace-nowrap',
      cell: (o) => str(o.owner) || dash
    };
    const next: Column = {
      key: 'next',
      header: 'Next follow-up',
      className: 'whitespace-nowrap',
      cell: (o) => {
        const f = followUpOf(board, o, today);
        if (!f) return dash;
        return (
          <span className='flex items-center gap-1.5'>
            <FollowUpBadge due={f.due} state={f.state} />
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant='ghost'
                    size='icon-xs'
                    aria-label={`Record follow-up for ${title(o)}`}
                  />
                }
                onClick={(e) => {
                  e.stopPropagation();
                  void onFollowUpRow(o);
                }}
              >
                <Icons.check />
              </TooltipTrigger>
              <TooltipContent>Followed up today</TooltipContent>
            </Tooltip>
          </span>
        );
      }
    };
    const primary = (
      header: string,
      main: (o: Order) => string,
      sub: (o: Order) => string
    ): Column => ({
      key: 'primary',
      header,
      className: 'max-w-72',
      cell: (o) => (
        <div className='min-w-0'>
          <div className='truncate font-medium'>{main(o) || '—'}</div>
          {sub(o) && <div className='text-muted-foreground truncate text-xs'>{sub(o)}</div>}
        </div>
      )
    });
    const supplier: Column = {
      key: 'supplier',
      header: 'Supplier',
      className: 'max-w-48',
      cell: (o) => (
        <div className='min-w-0'>
          <div className='truncate'>{str(o.supplier) || '—'}</div>
          {o.supplierService ? (
            <div className='text-muted-foreground truncate text-xs'>{str(o.supplierService)}</div>
          ) : null}
        </div>
      )
    };
    const service = (o: Order) => [str(o.service), str(o.speed)].filter(Boolean).join(' · ');
    if (board.mrp) {
      return [
        primary('Store', (o) => siteName(board, o), service),
        {
          key: 'code',
          header: 'Store code',
          className: 'font-mono text-xs tabular-nums',
          cell: (o) => <span translate='no'>{str(o.storeCode)}</span>
        },
        status,
        supplier,
        owner,
        ...(board.followUp ? [next] : []),
        updated
      ];
    }
    if (board.followUp)
      return [
        primary(
          'Customer',
          (o) => str(o.customer),
          (o) => str(o.site)
        ),
        status,
        supplier,
        owner,
        next,
        updated
      ];
    return [
      primary(
        'Customer',
        (o) => str(o.customer),
        (o) => str(o.site)
      ),
      status,
      {
        key: 'circuit',
        header: 'Circuit ID',
        className: 'font-mono text-xs whitespace-nowrap',
        cell: (o) => <span translate='no'>{str(o.circuit)}</span>
      },
      supplier,
      {
        key: 'service',
        header: 'Service',
        className: 'whitespace-nowrap',
        cell: (o) => service(o) || dash
      },
      {
        key: 'install',
        header: 'Install',
        className: 'tabular-nums whitespace-nowrap',
        cell: (o) => fmtDate(o.installDate) || dash
      },
      updated
    ];
  }, [board, today, onStatusChange, onFollowUpRow]);

  async function addOrder(groupName: string, customer: string, site: string, storeCode: string) {
    const res = await fetch('/api/tracker/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ board: board.id, customer, site, groupName, storeCode })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(String(data.error ?? 'Could not add the order. Refresh the page and try again.'));
      return;
    }
    setOrders((prev) => [data.order as Order, ...prev]);
    setAdding(null);
    toast.success('Order added');
    void setUrl({ order: (data.order as Order).id });
  }

  function startAdding(group: string) {
    setAdding((a) => (a === group ? null : group));
    setCollapsed((c) => without(c, group));
  }

  const open = openId ? (orders.find((o) => o.id === openId) ?? null) : null;
  const nav = summaries.map((s) =>
    s.id === board.id ? { ...s, open: stats.open, followUpsDue: stats.overdue + stats.dueToday } : s
  );
  const BoardIcon = BOARD_ICONS[board.id];
  const resetFilters = () => void setUrl({ q: null, status: null, due: null });
  const dueTotal = stats.overdue + stats.dueToday;

  return (
    <TrackerShell board={board} summaries={nav}>
      <div className='flex flex-wrap items-start justify-between gap-4'>
        <div className='flex min-w-0 items-start gap-3'>
          <div className='bg-primary/10 text-primary hidden size-10 shrink-0 items-center justify-center rounded-xl sm:flex'>
            <BoardIcon aria-hidden className='size-5' />
          </div>
          <div className='min-w-0'>
            <h1 className='text-2xl font-semibold tracking-tight text-balance'>{board.title}</h1>
            <p className='text-muted-foreground text-sm text-pretty'>{board.description}</p>
          </div>
        </div>
        {board.view ? (
          <Button variant='outline' render={<Link href={boardHref(board.view.source)} />}>
            <Icons.add /> Add on {getBoard(board.view.source)?.title}
          </Button>
        ) : (
          <Button onClick={() => startAdding(board.groups[0])}>
            <Icons.add /> New Order
          </Button>
        )}
      </div>

      <section aria-label='Summary' className='grid grid-cols-2 gap-3 lg:grid-cols-4'>
        <Stat label='Open orders' value={stats.open} icon={<Icons.page />} />
        {board.followUp ? (
          <>
            <Stat
              label='Follow-ups overdue'
              value={stats.overdue}
              tone={stats.overdue ? 'danger' : undefined}
              icon={<Icons.alertCircle />}
              active={dueOnly}
              onClick={() => void setUrl({ due: !dueOnly || null })}
            />
            <Stat
              label='Due today'
              value={stats.dueToday}
              tone={stats.dueToday ? 'warning' : undefined}
              icon={<Icons.clock />}
              active={dueOnly}
              onClick={() => void setUrl({ due: !dueOnly || null })}
            />
            <Stat
              label='Upcoming'
              value={stats.upcoming}
              icon={<Icons.calendar />}
              hint={`Every ${FOLLOW_UP_WORKING_DAYS} working days, skipping weekends & SA public holidays`}
            />
          </>
        ) : (
          <>
            <Stat
              label='Installs scheduled'
              value={stats.installs}
              icon={<Icons.calendar />}
              hint='Open orders with an install date from today'
            />
            <Stat label='Completed' value={stats.completed} icon={<Icons.circleCheck />} />
            <Stat label='Cancelled' value={stats.cancelled} icon={<Icons.circleX />} />
          </>
        )}
      </section>

      <div className='flex flex-wrap items-center gap-2'>
        <InputGroup className='w-full sm:w-80'>
          <InputGroupAddon>
            <Icons.search aria-hidden />
          </InputGroupAddon>
          <InputGroupInput
            type='search'
            name='q'
            autoComplete='off'
            spellCheck={false}
            aria-label='Search orders'
            placeholder={
              board.mrp ? 'Search store, store code, supplier…' : 'Search customer, site, circuit…'
            }
            value={q}
            onChange={(e) => void setUrl({ q: e.target.value || null })}
          />
          {q && (
            <InputGroupAddon align='inline-end'>
              <InputGroupButton
                size='icon-xs'
                aria-label='Clear search'
                onClick={() => void setUrl({ q: null })}
              >
                <Icons.close />
              </InputGroupButton>
            </InputGroupAddon>
          )}
        </InputGroup>
        <Select
          value={statusFilter || ALL}
          onValueChange={(v) => void setUrl({ status: v === ALL ? null : String(v) })}
        >
          <SelectTrigger aria-label='Filter by status' className='w-full sm:w-64'>
            <Icons.filter aria-hidden className='text-muted-foreground' />
            <SelectValue>{(v: string) => (v === ALL ? 'All statuses' : v)}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All statuses</SelectItem>
            <SelectSeparator />
            <SelectGroup>
              <SelectLabel>Delivery steps</SelectLabel>
              {BASE_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectGroup>
            {extraStatuses.length > 0 && (
              <>
                <SelectSeparator />
                <SelectGroup>
                  <SelectLabel>Legacy statuses</SelectLabel>
                  {extraStatuses.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </>
            )}
          </SelectContent>
        </Select>
        {board.followUp && (
          <Toggle
            variant='outline'
            pressed={dueOnly}
            onPressedChange={(p) => void setUrl({ due: p || null })}
          >
            <Icons.phoneCall /> Follow-ups Due
            <Badge variant={dueTotal ? 'destructive' : 'secondary'} className='tabular-nums'>
              {dueTotal}
            </Badge>
          </Toggle>
        )}
        {filtering && (
          <Button variant='ghost' onClick={resetFilters}>
            <Icons.close /> Reset
          </Button>
        )}
        <span className='text-muted-foreground ml-auto text-sm tabular-nums' aria-live='polite'>
          {filtered.length.toLocaleString('en-ZA')} of {orders.length.toLocaleString('en-ZA')}{' '}
          orders
        </span>
      </div>

      <div className='flex flex-col gap-4'>
        {groups.length === 0 && (
          <Card className='items-center py-12 text-center'>
            <CardContent className='flex flex-col items-center gap-2'>
              <Icons.search className='text-muted-foreground size-8' aria-hidden />
              <p className='font-medium'>
                {filtering ? 'No orders match these filters' : 'No orders on this board yet'}
              </p>
              {!filtering && board.view && (
                <p className='text-muted-foreground max-w-md text-sm text-pretty'>
                  {getBoard(board.view.source)?.title} orders show here while their status is{' '}
                  {board.view.statuses.join(', ')}, and leave once it moves on.
                </p>
              )}
              {filtering && (
                <Button variant='outline' size='sm' onClick={resetFilters}>
                  Reset Filters
                </Button>
              )}
            </CardContent>
          </Card>
        )}
        {groups.map(({ name, rows }) => {
          const isCollapsed = filtering ? false : collapsed.has(name);
          const visible = showAll.has(name) ? rows : rows.slice(0, ROW_CAP);
          const color = groupColor(name);
          return (
            <Card key={name} className='gap-0 overflow-hidden py-0'>
              <Collapsible
                open={!isCollapsed}
                onOpenChange={() => setCollapsed((c) => toggleIn(c, name))}
              >
                <div
                  className='flex items-center justify-between gap-2 px-3 py-2'
                  style={{ boxShadow: `inset 4px 0 0 ${color}` }}
                >
                  <CollapsibleTrigger className='hover:bg-muted/60 focus-visible:ring-ring/50 flex min-w-0 items-center gap-2 rounded-md px-2 py-1 text-left outline-none focus-visible:ring-3'>
                    <Icons.chevronRight
                      aria-hidden
                      className={cn(
                        'text-muted-foreground size-4 shrink-0 transition-transform motion-reduce:transition-none',
                        !isCollapsed && 'rotate-90'
                      )}
                    />
                    <span className='truncate font-semibold' style={{ color }}>
                      {name}
                    </span>
                    <Badge variant='secondary' className='tabular-nums'>
                      {rows.length.toLocaleString('en-ZA')}
                    </Badge>
                  </CollapsibleTrigger>
                  {!CLOSED.includes(name) && !board.view && (
                    <Button variant='ghost' size='sm' onClick={() => startAdding(name)}>
                      <Icons.add /> Add Order
                    </Button>
                  )}
                </div>
                <CollapsibleContent>
                  {adding === name && (
                    <AddOrderRow
                      board={board}
                      groupName={name}
                      onAdd={addOrder}
                      onCancel={() => setAdding(null)}
                    />
                  )}
                  {rows.length === 0 && adding !== name && (
                    <p className='text-muted-foreground border-t px-5 py-4 text-sm'>
                      No orders in this group yet.
                    </p>
                  )}
                  {rows.length > 0 && (
                    <div className='border-t'>
                      <Table className='min-w-[960px]'>
                        <TableHeader className='bg-muted/40'>
                          <TableRow className='hover:bg-transparent'>
                            {columns.map((c) => (
                              <TableHead
                                key={c.key}
                                className='text-muted-foreground h-9 text-xs font-medium'
                              >
                                {c.header}
                              </TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {visible.map((o) => (
                            <TableRow
                              key={o.id}
                              data-state={o.id === openId ? 'selected' : undefined}
                              className='focus-visible:bg-muted/60 cursor-pointer outline-none [contain-intrinsic-size:auto_49px] [content-visibility:auto]'
                              tabIndex={0}
                              aria-label={`Open ${siteName(board, o) || str(o.customer)}`}
                              onClick={() => void setUrl({ order: o.id })}
                              onKeyDown={(e) => {
                                if (
                                  (e.key === 'Enter' || e.key === ' ') &&
                                  e.target === e.currentTarget
                                ) {
                                  e.preventDefault();
                                  void setUrl({ order: o.id });
                                }
                              }}
                            >
                              {columns.map((c) => (
                                <TableCell key={c.key} className={cn('py-2', c.className)}>
                                  {c.cell(o)}
                                </TableCell>
                              ))}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      {rows.length > visible.length && (
                        <div className='border-t p-2 text-center'>
                          <Button
                            variant='ghost'
                            size='sm'
                            onClick={() => setShowAll((s) => toggleIn(s, name))}
                          >
                            Show All {rows.length.toLocaleString('en-ZA')} Orders (
                            {(rows.length - visible.length).toLocaleString('en-ZA')} more)
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </CollapsibleContent>
              </Collapsible>
            </Card>
          );
        })}
      </div>

      {open && (
        <OrderSheet
          key={open.id}
          board={board}
          order={open}
          statuses={[...BASE_STATUSES, ...extraStatuses]}
          groupNames={[
            ...new Set([...board.groups, ...CLOSED, ...orders.map((o) => str(o.groupName))])
          ].filter(Boolean)}
          today={today}
          onClose={() => void setUrl({ order: null })}
          save={save}
          followUp={followUp}
          remove={remove}
        />
      )}
    </TrackerShell>
  );
}

function Stat({
  label,
  value,
  icon,
  tone,
  hint,
  active,
  onClick
}: {
  label: string;
  value: number;
  icon: ReactNode;
  tone?: 'danger' | 'warning';
  hint?: string;
  active?: boolean;
  onClick?: () => void;
}) {
  const body = (
    <CardHeader className='gap-1'>
      <CardDescription className='flex items-center gap-1.5 [&_svg]:size-4'>
        {icon}
        {label}
      </CardDescription>
      <CardTitle
        className={cn(
          'text-3xl font-semibold tabular-nums',
          tone === 'danger' && 'text-destructive',
          tone === 'warning' && 'text-amber-600 dark:text-amber-400'
        )}
      >
        {value.toLocaleString('en-ZA')}
      </CardTitle>
      {hint && <p className='text-muted-foreground text-xs text-pretty'>{hint}</p>}
    </CardHeader>
  );
  if (!onClick) return <Card className='gap-0 py-4'>{body}</Card>;
  return (
    <Card className={cn('gap-0 p-0', active && 'ring-primary ring-2')}>
      <button
        type='button'
        onClick={onClick}
        aria-pressed={active}
        className='hover:bg-muted/50 focus-visible:ring-ring/50 rounded-xl py-4 text-left transition-colors outline-none focus-visible:ring-3'
      >
        {body}
      </button>
    </Card>
  );
}

function AddOrderRow({
  board,
  groupName,
  onAdd,
  onCancel
}: {
  board: BoardDef;
  groupName: string;
  onAdd: (g: string, c: string, s: string, code: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [customer, setCustomer] = useState(board.mrp ? 'Mr Price Group' : '');
  const [site, setSite] = useState('');
  const [storeCode, setStoreCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [tried, setTried] = useState(false);
  const missingCode = board.mrp && !storeCode.trim();
  const missingCustomer = !customer.trim();
  return (
    <form
      className='bg-muted/30 flex flex-wrap items-start gap-2 border-t px-4 py-3'
      onSubmit={async (e) => {
        e.preventDefault();
        setTried(true);
        if (missingCustomer || missingCode) return;
        setBusy(true);
        await onAdd(groupName, customer.trim(), site.trim(), storeCode.trim());
        setBusy(false);
      }}
    >
      <Input
        aria-label='Customer'
        name='customer'
        autoComplete='off'
        placeholder='Customer, e.g. Clicks…'
        value={customer}
        aria-invalid={(tried && missingCustomer) || undefined}
        onChange={(e) => setCustomer(e.target.value)}
        className='w-full sm:w-56'
      />
      {board.mrp && (
        <Input
          aria-label='Store code'
          name='storeCode'
          autoComplete='off'
          spellCheck={false}
          placeholder='Store code, e.g. 11099…'
          aria-invalid={(tried && missingCode) || undefined}
          value={storeCode}
          onChange={(e) => setStoreCode(e.target.value)}
          className='w-full font-mono sm:w-44'
        />
      )}
      <Input
        aria-label={board.mrp ? 'Store name' : 'Site name'}
        name='site'
        autoComplete='off'
        placeholder={
          board.mrp
            ? 'Store name, e.g. Mr Price Kids Mall of Africa…'
            : 'Site name, e.g. Rosebank Mall…'
        }
        value={site}
        onChange={(e) => setSite(e.target.value)}
        className='w-full sm:w-80'
      />
      <Button type='submit' disabled={busy}>
        {busy && <Icons.spinner className='animate-spin' />}Add Order
      </Button>
      <Button type='button' variant='ghost' onClick={onCancel}>
        Cancel
      </Button>
      {tried && (missingCustomer || missingCode) && (
        <p role='alert' className='text-destructive w-full text-xs'>
          {missingCode
            ? 'Enter the store code: Mr Price orders need one.'
            : 'Enter the customer name.'}
        </p>
      )}
      {board.mrp && !tried && (
        <p className='text-muted-foreground w-full text-xs'>
          The store code is added to the store name automatically.
        </p>
      )}
    </form>
  );
}
