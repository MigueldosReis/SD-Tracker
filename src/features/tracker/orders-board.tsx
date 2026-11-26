'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  BOARDS,
  CLOSED_GROUPS,
  EDITABLE_FIELDS,
  MONEY_FIELDS,
  OTHER_STATUSES,
  OWNERS,
  PROCESS_STATUSES,
  displaySite,
  getBoard,
  withStoreCode,
  type BoardDef,
  type Order,
  type OrderField
} from '@/lib/tracker-fields';
import {
  FOLLOW_UP_WORKING_DAYS,
  followUpState,
  nextFollowUp,
  todayZA,
  type FollowUpState
} from '@/lib/working-days';
import { groupColor, statusColor } from './status-style';

const ROW_CAP = 100;
const BOTTOM = CLOSED_GROUPS as readonly string[];
const DEFAULT_COLLAPSED = new Set(BOTTOM);
const BASE_STATUSES = [...PROCESS_STATUSES, ...OTHER_STATUSES] as string[];

type LogEntry = { n: number; at: string; text: string };
type Summary = { id: string; title: string; open: number; followUpsDue: number };
type PatchResult = { ok: true; order: Order; log: LogEntry[] } | { ok: false; error: string };

const isOpen = (o: Order) =>
  !BOTTOM.includes(str(o.groupName)) && o.status !== 'Complete' && o.status !== 'Cancelled';
const dueDate = (o: Order) =>
  nextFollowUp(o.lastFollowUp as string | null, o.createdAt as string | null);
/** Follow-up state of an open order on a follow-up board, or null when it needs none. */
function followUpOf(
  board: BoardDef,
  o: Order,
  today: string
): { due: string; state: FollowUpState } | null {
  if (!board.followUp || !isOpen(o)) return null;
  const due = dueDate(o);
  return due ? { due, state: followUpState(due, today) } : null;
}
const FOLLOW_UP_STYLE: Record<FollowUpState, string> = {
  overdue: 'bg-red-600 text-white',
  due: 'bg-amber-500 text-black',
  upcoming: 'text-muted-foreground'
};
const siteName = (board: BoardDef, o: Order) =>
  board.mrp ? (withStoreCode(displaySite(o), str(o.storeCode)) ?? '') : str(o.site);

type Column = { header: string; cell: (o: Order) => ReactNode; className?: string };

const LABELS: Partial<Record<OrderField, string>> = {
  ref: 'Reference',
  board: 'Board',
  groupName: 'Group',
  lastFollowUp: 'Last follow-up',
  customer: 'Customer',
  site: 'Site name',
  circuit: 'Circuit ID',
  status: 'Status',
  orderType: 'New or existing',
  service: 'Service',
  speed: 'Speed',
  linkRole: 'Primary / secondary',
  supplier: 'Supplier',
  supplierService: 'Supplier service',
  storeCode: 'Store code',
  address: 'Address',
  notes: 'Notes',
  owner: 'Owner',
  cofRequested: 'COF requested',
  cofReceived: 'COF received',
  coverRequested: 'Cover requested',
  coverReceived: 'Cover received',
  cofSigned: 'COF signed',
  clientApproved: 'Client approved',
  quoteSent: 'Quote sent',
  siteSurvey: 'Site survey',
  landlordRecvSupplier: 'Landlord docs received from supplier',
  landlordSentClient: 'Landlord docs sent to client',
  landlordSignedFirstnet: 'Landlord docs signed and returned to FirstNet',
  landlordReturnedSupplier: 'Landlord docs returned to supplier',
  installDate: 'Install scheduled',
  cutoverDate: 'Cutover date',
  forecastHandover: 'Forecasted handover',
  serial: 'Equipment serial number',
  equipment: 'Equipment make and model',
  billingStart: 'Billing start date',
  sellMrc: 'Sell MRC',
  sellNrc: 'Sell NRC',
  costMrc: 'Cost MRC',
  costNrc: 'Cost NRC',
  billNrc: 'Bill NRC'
};

const SECTIONS: { title: string; fields: OrderField[] }[] = [
  {
    title: 'Order',
    fields: [
      'customer',
      'site',
      'board',
      'groupName',
      'status',
      'owner',
      'orderType',
      'storeCode',
      'circuit',
      'ref',
      'address'
    ]
  },
  {
    title: 'Service and supplier',
    fields: ['service', 'speed', 'linkRole', 'supplier', 'supplierService']
  },
  {
    title: 'Dates',
    fields: [
      'quoteSent',
      'clientApproved',
      'cofRequested',
      'cofReceived',
      'cofSigned',
      'coverRequested',
      'coverReceived',
      'siteSurvey',
      'landlordRecvSupplier',
      'landlordSentClient',
      'landlordSignedFirstnet',
      'landlordReturnedSupplier',
      'installDate',
      'cutoverDate',
      'forecastHandover',
      'billingStart',
      'lastFollowUp'
    ]
  },
  { title: 'Equipment', fields: ['serial', 'equipment'] },
  { title: 'Costs', fields: ['sellMrc', 'sellNrc', 'costMrc', 'costNrc', 'billNrc'] },
  { title: 'Notes', fields: ['notes'] }
];
const DATE_FIELDS = new Set<OrderField>([
  'quoteSent',
  'clientApproved',
  'cofRequested',
  'cofReceived',
  'cofSigned',
  'coverRequested',
  'coverReceived',
  'siteSurvey',
  'landlordRecvSupplier',
  'landlordSentClient',
  'landlordSignedFirstnet',
  'landlordReturnedSupplier',
  'installDate',
  'cutoverDate',
  'forecastHandover',
  'billingStart',
  'lastFollowUp'
]);

const str = (v: unknown) => (v === null || v === undefined ? '' : String(v));
const fmtDate = (v: unknown) => str(v).slice(0, 10);

function StatusPill({ status }: { status: string | null }) {
  return (
    <span
      className='inline-block rounded px-2 py-0.5 text-xs font-medium text-white'
      style={{ background: statusColor(status) }}
    >
      {status || 'No status'}
    </span>
  );
}

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
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dueOnly, setDueOnly] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set(DEFAULT_COLLAPSED));
  const [showAll, setShowAll] = useState<Set<string>>(new Set());
  const [openId, setOpenId] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [adding, setAdding] = useState<string | null>(null);
  const today = todayZA();

  // Keep the local list in step with the server; an order moved to another board leaves this one.
  const applyOrder = useCallback(
    (order: Order) => {
      setOrders((prev) =>
        order.board === board.id
          ? prev.map((o) => (o.id === order.id ? order : o))
          : prev.filter((o) => o.id !== order.id)
      );
    },
    [board.id]
  );

  const patch = useCallback(
    async (id: string, body: Record<string, unknown>): Promise<PatchResult> => {
      const res = await fetch(`/api/tracker/orders/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        return { ok: false, error: String(data.error ?? `Request failed (${res.status})`) };
      applyOrder(data.order as Order);
      return { ok: true, order: data.order as Order, log: (data.log ?? []) as LogEntry[] };
    },
    [applyOrder]
  );

  const followUp = useCallback(
    async (id: string, note?: string): Promise<PatchResult> => {
      const res = await fetch(`/api/tracker/orders/${encodeURIComponent(id)}/follow-up`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        return { ok: false, error: String(data.error ?? `Request failed (${res.status})`) };
      applyOrder(data.order as Order);
      return { ok: true, order: data.order as Order, log: (data.log ?? []) as LogEntry[] };
    },
    [applyOrder]
  );

  const statuses = useMemo(() => {
    const seen = new Set(BASE_STATUSES);
    const extra = [
      ...new Set(orders.map((o) => str(o.status)).filter((s) => s && !seen.has(s)))
    ].sort();
    return { base: BASE_STATUSES, extra };
  }, [orders]);

  const dueCount = useMemo(
    () =>
      orders.filter((o) => {
        const f = followUpOf(board, o, today);
        return f && f.state !== 'upcoming';
      }).length,
    [orders, board, today]
  );

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
        o.supplier
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
    // On follow-up boards, the most urgent follow-ups come first.
    if (board.followUp) {
      for (const rows of map.values()) {
        rows.sort((a, b) => {
          const da = isOpen(a) ? (dueDate(a) ?? '9') : '9';
          const db = isOpen(b) ? (dueDate(b) ?? '9') : '9';
          return da.localeCompare(db);
        });
      }
    }
    const known = board.groups.filter((g) => !BOTTOM.includes(g));
    const unknown = [...map.keys()].filter((g) => !known.includes(g) && !BOTTOM.includes(g)).sort();
    const names = [...known, ...unknown, ...BOTTOM];
    return names
      .filter((g) => map.has(g) || (!filtering && known.includes(g)))
      .map((g) => ({ name: g, rows: map.get(g) ?? [] }));
  }, [filtered, filtering, board]);

  const columns = useMemo<Column[]>(() => {
    const status: Column = { header: 'Status', cell: () => null };
    const updated: Column = {
      header: 'Updated',
      cell: (o) => fmtDate(o.updatedAt),
      className: 'tabular-nums'
    };
    const next: Column = {
      header: 'Next follow-up',
      cell: (o) => {
        const f = followUpOf(board, o, today);
        if (!f) return null;
        return (
          <span className='flex items-center gap-2'>
            <span
              className={`rounded px-1.5 py-0.5 tabular-nums ${FOLLOW_UP_STYLE[f.state]}`}
              title={
                f.state === 'overdue' ? 'Overdue' : f.state === 'due' ? 'Due today' : 'Upcoming'
              }
            >
              {f.due}
            </span>
            <button
              className='text-primary text-xs underline'
              onClick={async (e) => {
                e.stopPropagation();
                const r = await followUp(o.id);
                if (!r.ok) setBanner(r.error);
              }}
            >
              Done
            </button>
          </span>
        );
      }
    };
    if (board.mrp) {
      return [
        { header: 'Store', cell: (o) => siteName(board, o), className: 'max-w-64 truncate' },
        { header: 'Store code', cell: (o) => str(o.storeCode), className: 'font-mono text-xs' },
        status,
        { header: 'Supplier', cell: (o) => str(o.supplier) },
        { header: 'Supplier service', cell: (o) => str(o.supplierService) },
        { header: 'Owner', cell: (o) => str(o.owner) },
        next,
        updated
      ];
    }
    if (board.followUp) {
      return [
        { header: 'Customer', cell: (o) => str(o.customer), className: 'max-w-56 truncate' },
        { header: 'Site', cell: (o) => str(o.site), className: 'max-w-56 truncate' },
        status,
        { header: 'Supplier', cell: (o) => str(o.supplier) },
        { header: 'Owner', cell: (o) => str(o.owner) },
        next,
        updated
      ];
    }
    return [
      { header: 'Customer', cell: (o) => str(o.customer), className: 'max-w-56 truncate' },
      { header: 'Site', cell: (o) => str(o.site), className: 'max-w-56 truncate' },
      status,
      { header: 'Circuit ID', cell: (o) => str(o.circuit), className: 'font-mono text-xs' },
      { header: 'Supplier', cell: (o) => str(o.supplier) },
      { header: 'Service', cell: (o) => str(o.service) },
      { header: 'Speed', cell: (o) => str(o.speed) },
      { header: 'Install', cell: (o) => fmtDate(o.installDate), className: 'tabular-nums' },
      updated
    ];
  }, [board, today, followUp]);

  const toggle = (set: Set<string>, name: string) => {
    const n = new Set(set);
    if (n.has(name)) n.delete(name);
    else n.add(name);
    return n;
  };

  async function onStatusChange(o: Order, status: string) {
    setBanner(null);
    const r = await patch(o.id, { status });
    if (!r.ok) {
      setBanner(`${siteName(board, o) || str(o.customer) || 'Order'}: ${r.error}`);
      setOpenId(o.id);
    }
  }

  async function addOrder(groupName: string, customer: string, site: string, storeCode: string) {
    const res = await fetch('/api/tracker/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ board: board.id, customer, site, groupName, storeCode })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setBanner(String(data.error ?? 'Could not add the order'));
      return;
    }
    setOrders((prev) => [data.order as Order, ...prev]);
    setAdding(null);
    setOpenId((data.order as Order).id);
  }

  const open = openId ? (orders.find((o) => o.id === openId) ?? null) : null;
  const openCount = orders.filter(isOpen).length;
  const nav = summaries.map((s) =>
    s.id === board.id ? { ...s, open: openCount, followUpsDue: dueCount } : s
  );

  return (
    <div className='flex min-h-dvh flex-col'>
      <nav
        aria-label='Boards'
        className='border-border bg-card flex gap-1 overflow-x-auto border-b px-4'
      >
        {nav.map((s) => {
          const active = s.id === board.id;
          return (
            <Link
              key={s.id}
              href={s.id === 'orders' ? '/orders' : `/boards/${s.id}`}
              aria-current={active ? 'page' : undefined}
              className={`-mb-px flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-sm ${active ? 'border-primary font-semibold' : 'text-muted-foreground hover:text-foreground border-transparent'}`}
            >
              {s.title}
              <span className='bg-muted rounded px-1.5 text-xs tabular-nums' title='Open orders'>
                {s.open}
              </span>
              {s.followUpsDue > 0 && (
                <span
                  className='rounded bg-red-600 px-1.5 text-xs text-white tabular-nums'
                  title='Follow-ups due or overdue'
                >
                  {s.followUpsDue}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
      <header className='border-border flex flex-wrap items-end justify-between gap-3 border-b px-6 py-4'>
        <div>
          <h1 className='text-xl font-semibold tracking-tight'>{board.title}</h1>
          <p className='text-muted-foreground text-sm'>
            {filtered.length.toLocaleString()} of {orders.length.toLocaleString()} orders
            <span className='ml-2'>· {board.description}</span>
          </p>
          {board.followUp && (
            <p className='text-muted-foreground text-xs'>
              Follow up every {FOLLOW_UP_WORKING_DAYS} working days (weekends and South African
              public holidays skipped).
            </p>
          )}
        </div>
        <div className='flex flex-wrap items-center gap-2'>
          <Input
            aria-label='Search orders'
            placeholder={
              board.mrp
                ? 'Search store, store code, supplier…'
                : 'Search customer, site, circuit, store code…'
            }
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className='w-72'
          />
          <select
            aria-label='Filter by status'
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className='border-input bg-background h-8 rounded-lg border px-2 text-sm'
          >
            <option value=''>All statuses</option>
            {statuses.base.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
            {statuses.extra.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          {board.followUp && (
            <Button
              variant={dueOnly ? 'default' : 'outline'}
              size='sm'
              aria-pressed={dueOnly}
              onClick={() => setDueOnly((v) => !v)}
            >
              Follow-ups due ({dueCount})
            </Button>
          )}
          {filtering && (
            <Button
              variant='ghost'
              size='sm'
              onClick={() => {
                setQ('');
                setStatusFilter('');
                setDueOnly(false);
              }}
            >
              Clear
            </Button>
          )}
        </div>
      </header>

      {banner && (
        <div
          role='alert'
          className='mx-6 mt-3 flex items-center justify-between rounded-md border border-red-500/50 bg-red-500/10 px-3 py-2 text-sm text-red-300'
        >
          <span>{banner}</span>
          <button className='ml-4 underline' onClick={() => setBanner(null)}>
            Dismiss
          </button>
        </div>
      )}

      <main className='flex flex-col gap-4 px-6 py-4'>
        {groups.length === 0 && (
          <p className='text-muted-foreground py-12 text-center'>
            {filtering ? 'No orders match.' : 'No orders on this board yet.'}
          </p>
        )}
        {groups.map(({ name, rows }) => {
          const isCollapsed = filtering ? false : collapsed.has(name);
          const visible = showAll.has(name) ? rows : rows.slice(0, ROW_CAP);
          const color = groupColor(name);
          return (
            <section
              key={name}
              className='border-border overflow-hidden rounded-lg border'
              style={{ borderLeft: `4px solid ${color}` }}
            >
              <div className='bg-card flex items-center justify-between px-3 py-2'>
                <button
                  className='flex items-center gap-2 text-left'
                  aria-expanded={!isCollapsed}
                  onClick={() => setCollapsed((c) => toggle(c, name))}
                >
                  <span aria-hidden className='text-muted-foreground w-4 text-xs'>
                    {isCollapsed ? '▶' : '▼'}
                  </span>
                  <span className='font-semibold' style={{ color }}>
                    {name}
                  </span>
                  <span className='text-muted-foreground text-sm'>
                    {rows.length.toLocaleString()} {rows.length === 1 ? 'order' : 'orders'}
                  </span>
                </button>
                {!BOTTOM.includes(name) && (
                  <Button
                    variant='ghost'
                    size='sm'
                    onClick={() => setAdding(adding === name ? null : name)}
                  >
                    + Add order
                  </Button>
                )}
              </div>
              {adding === name && (
                <AddOrderRow
                  board={board}
                  groupName={name}
                  onAdd={addOrder}
                  onCancel={() => setAdding(null)}
                />
              )}
              {!isCollapsed && rows.length === 0 && adding !== name && (
                <p className='text-muted-foreground px-3 py-3 text-sm'>
                  No orders in this group yet.
                </p>
              )}
              {!isCollapsed && rows.length > 0 && (
                <div className='overflow-x-auto'>
                  <table className='w-full min-w-[1000px] border-collapse text-sm'>
                    <thead>
                      <tr className='bg-muted/40 text-muted-foreground text-left text-xs uppercase'>
                        {columns.map((c) => (
                          <th
                            key={c.header}
                            scope='col'
                            className='border-border border-r border-b px-3 py-2 font-medium last:border-r-0'
                          >
                            {c.header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {visible.map((o) => (
                        <tr
                          key={o.id}
                          className='border-border hover:bg-muted/30 cursor-pointer border-b'
                          onClick={() => setOpenId(o.id)}
                        >
                          {columns.map((c) =>
                            c.header === 'Status' ? (
                              <td
                                key={c.header}
                                className='border-border border-r p-1'
                                onClick={(e) => e.stopPropagation()}
                              >
                                <select
                                  aria-label={`Status for ${siteName(board, o) || str(o.customer)}`}
                                  value={str(o.status)}
                                  onChange={(e) => onStatusChange(o, e.target.value)}
                                  className='w-full cursor-pointer rounded px-2 py-1 text-xs font-medium text-white'
                                  style={{ background: statusColor(o.status) }}
                                >
                                  {!BASE_STATUSES.includes(str(o.status)) && (
                                    <option value={str(o.status)}>
                                      {str(o.status) || 'No status'}
                                    </option>
                                  )}
                                  {BASE_STATUSES.map((s) => (
                                    <option
                                      key={s}
                                      value={s}
                                      style={{ background: '#111', color: '#fff' }}
                                    >
                                      {s}
                                    </option>
                                  ))}
                                </select>
                              </td>
                            ) : (
                              <td
                                key={c.header}
                                className={`border-border border-r px-3 py-1.5 last:border-r-0 ${c.className ?? ''}`}
                              >
                                {c.cell(o)}
                              </td>
                            )
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {rows.length > visible.length && (
                    <div className='p-2 text-center'>
                      <Button
                        variant='ghost'
                        size='sm'
                        onClick={() => setShowAll((s) => toggle(s, name))}
                      >
                        Show all {rows.length.toLocaleString()} orders (
                        {(rows.length - visible.length).toLocaleString()} more)
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </section>
          );
        })}
      </main>

      {open && (
        <OrderPanel
          key={open.id}
          board={board}
          order={open}
          statuses={[...statuses.base, ...statuses.extra]}
          groupNames={[
            ...new Set([...board.groups, ...BOTTOM, ...orders.map((o) => str(o.groupName))])
          ].filter(Boolean)}
          today={today}
          onClose={() => setOpenId(null)}
          patch={patch}
          followUp={followUp}
          onDeleted={(id) => {
            setOrders((p) => p.filter((o) => o.id !== id));
            setOpenId(null);
          }}
        />
      )}
    </div>
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
  onAdd: (g: string, c: string, s: string, code: string) => void;
  onCancel: () => void;
}) {
  const [customer, setCustomer] = useState(board.mrp ? 'Mr Price Group' : '');
  const [site, setSite] = useState('');
  const [storeCode, setStoreCode] = useState('');
  const ready = customer.trim() !== '' && (!board.mrp || storeCode.trim() !== '');
  return (
    <form
      className='bg-muted/20 flex flex-wrap items-center gap-2 px-3 py-2'
      onSubmit={(e) => {
        e.preventDefault();
        if (ready) onAdd(groupName, customer.trim(), site.trim(), storeCode.trim());
      }}
    >
      <Input
        autoFocus={!board.mrp}
        aria-label='Customer'
        placeholder='Customer'
        value={customer}
        onChange={(e) => setCustomer(e.target.value)}
        className='w-56'
      />
      {board.mrp && (
        <Input
          autoFocus
          aria-label='Store code'
          placeholder='Store code (required)'
          value={storeCode}
          onChange={(e) => setStoreCode(e.target.value)}
          className='w-40'
        />
      )}
      <Input
        aria-label={board.mrp ? 'Store name' : 'Site name'}
        placeholder={board.mrp ? 'Store name, e.g. Mr Price Kids Mall of Africa' : 'Site name'}
        value={site}
        onChange={(e) => setSite(e.target.value)}
        className='w-72'
      />
      <Button type='submit' size='sm' disabled={!ready}>
        Add
      </Button>
      <Button type='button' variant='ghost' size='sm' onClick={onCancel}>
        Cancel
      </Button>
      {board.mrp && (
        <span className='text-muted-foreground text-xs'>
          The store code is added to the store name automatically.
        </span>
      )}
    </form>
  );
}

function OrderPanel({
  board,
  order,
  statuses,
  groupNames,
  today,
  onClose,
  patch,
  followUp,
  onDeleted
}: {
  board: BoardDef;
  order: Order;
  statuses: string[];
  groupNames: string[];
  today: string;
  onClose: () => void;
  patch: (id: string, body: Record<string, unknown>) => Promise<PatchResult>;
  followUp: (id: string, note?: string) => Promise<PatchResult>;
  onDeleted: (id: string) => void;
}) {
  const [note, setNote] = useState('');
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<'details' | 'activity'>('details');
  const [log, setLog] = useState<LogEntry[] | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const loadLog = useCallback(async () => {
    const res = await fetch(`/api/tracker/orders/${encodeURIComponent(order.id)}`);
    if (res.ok) setLog(((await res.json()).log ?? []) as LogEntry[]);
  }, [order.id]);
  useEffect(() => {
    if (tab === 'activity' && log === null) void loadLog();
  }, [tab, log, loadLog]);

  const value = (f: OrderField) =>
    f in draft ? draft[f] : DATE_FIELDS.has(f) ? fmtDate(order[f]) : str(order[f]);
  const dirty = Object.keys(draft).length > 0;

  async function save() {
    setSaving(true);
    setError(null);
    const body: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(draft)) body[k] = v;
    const r = await patch(order.id, body);
    setSaving(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setDraft({});
    setLog(r.log);
  }

  async function remove() {
    const res = await fetch(`/api/tracker/orders/${encodeURIComponent(order.id)}`, {
      method: 'DELETE'
    });
    if (res.ok) onDeleted(order.id);
    else setError('Could not delete this order');
  }

  const field = (f: OrderField) => {
    if (!(EDITABLE_FIELDS as readonly string[]).includes(f)) return null;
    const id = `f-${f}`;
    const common = 'border-input bg-background w-full rounded-lg border px-2 py-1.5 text-sm';
    let input;
    if (f === 'status') {
      const list = statuses.includes(value(f)) || !value(f) ? statuses : [value(f), ...statuses];
      input = (
        <select
          id={id}
          className={common}
          value={value(f)}
          onChange={(e) => setDraft((d) => ({ ...d, [f]: e.target.value }))}
        >
          {list.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      );
    } else if (f === 'board') {
      input = (
        <select
          id={id}
          className={common}
          value={value(f)}
          onChange={(e) => {
            const target = getBoard(e.target.value);
            // Moving to another board puts the order in that board's first group.
            setDraft((d) => ({
              ...d,
              board: e.target.value,
              groupName:
                target && target.id !== order.board ? target.groups[0] : str(order.groupName)
            }));
          }}
        >
          {BOARDS.map((b) => (
            <option key={b.id} value={b.id}>
              {b.title}
            </option>
          ))}
        </select>
      );
    } else if (f === 'groupName') {
      const targetGroups =
        draft.board && draft.board !== order.board
          ? [...(getBoard(draft.board)?.groups ?? []), ...BOTTOM]
          : groupNames;
      const list = targetGroups.includes(value(f)) ? targetGroups : [value(f), ...targetGroups];
      input = (
        <select
          id={id}
          className={common}
          value={value(f)}
          onChange={(e) => setDraft((d) => ({ ...d, [f]: e.target.value }))}
        >
          {list.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      );
    } else if (f === 'owner') {
      input = (
        <select
          id={id}
          className={common}
          value={value(f)}
          onChange={(e) => setDraft((d) => ({ ...d, [f]: e.target.value }))}
        >
          <option value=''>Unassigned</option>
          {(OWNERS as readonly string[]).map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      );
    } else if (f === 'notes' || f === 'address') {
      input = (
        <textarea
          id={id}
          rows={3}
          className={common}
          value={value(f)}
          onChange={(e) => setDraft((d) => ({ ...d, [f]: e.target.value }))}
        />
      );
    } else {
      input = (
        <input
          id={id}
          className={common}
          type={DATE_FIELDS.has(f) ? 'date' : 'text'}
          inputMode={(MONEY_FIELDS as readonly string[]).includes(f) ? 'decimal' : undefined}
          value={value(f)}
          onChange={(e) => setDraft((d) => ({ ...d, [f]: e.target.value }))}
        />
      );
    }
    return (
      <div key={f} className={f === 'notes' || f === 'address' ? 'col-span-2' : ''}>
        <label htmlFor={id} className='text-muted-foreground mb-1 block text-xs'>
          {LABELS[f] ?? f}
        </label>
        {input}
      </div>
    );
  };

  return (
    <div
      className='fixed inset-0 z-50 flex justify-end'
      role='dialog'
      aria-modal='true'
      aria-label='Order details'
    >
      <button aria-label='Close panel' className='absolute inset-0 bg-black/50' onClick={onClose} />
      <aside className='bg-card border-border relative flex h-full w-full max-w-xl flex-col border-l shadow-2xl'>
        <div className='border-border flex items-start justify-between gap-3 border-b p-4'>
          <div className='min-w-0'>
            <h2 className='truncate text-lg font-semibold'>
              {board.mrp
                ? siteName(board, order) || 'Untitled store'
                : str(order.customer) || 'Untitled order'}
            </h2>
            <p className='text-muted-foreground truncate text-sm'>
              {board.mrp ? str(order.customer) : str(order.site)}
            </p>
            <div className='mt-2'>
              <StatusPill status={order.status === null ? null : String(order.status)} />
            </div>
          </div>
          <Button variant='ghost' size='sm' onClick={onClose}>
            Close
          </Button>
        </div>
        <div className='border-border flex gap-4 border-b px-4' role='tablist'>
          {(['details', 'activity'] as const).map((t) => (
            <button
              key={t}
              role='tab'
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={`-mb-px border-b-2 py-2 text-sm capitalize ${tab === t ? 'border-primary font-semibold' : 'text-muted-foreground border-transparent'}`}
            >
              {t}
            </button>
          ))}
        </div>
        <div className='flex-1 overflow-y-auto p-4'>
          {error && (
            <div
              role='alert'
              className='mb-3 rounded-md border border-red-500/50 bg-red-500/10 px-3 py-2 text-sm text-red-300'
            >
              {error}
            </div>
          )}
          {tab === 'details' ? (
            <div className='flex flex-col gap-6'>
              {(() => {
                const f = followUpOf(board, order, today);
                if (!f) return null;
                return (
                  <div className='border-border rounded-lg border p-3'>
                    <div className='flex items-center justify-between gap-2 text-sm'>
                      <span>
                        Next follow-up{' '}
                        <span
                          className={`ml-1 rounded px-1.5 py-0.5 tabular-nums ${FOLLOW_UP_STYLE[f.state]}`}
                        >
                          {f.due}
                        </span>
                      </span>
                      <span className='text-muted-foreground text-xs'>
                        Last: {fmtDate(order.lastFollowUp) || 'never'}
                      </span>
                    </div>
                    <form
                      className='mt-2 flex gap-2'
                      onSubmit={async (e) => {
                        e.preventDefault();
                        const r = await followUp(order.id, note);
                        if (!r.ok) {
                          setError(r.error);
                          return;
                        }
                        setNote('');
                        setLog(r.log);
                      }}
                    >
                      <input
                        aria-label='Follow-up note'
                        placeholder='What happened? (optional)'
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        className='border-input bg-background flex-1 rounded-lg border px-2 py-1.5 text-sm'
                      />
                      <Button type='submit' size='sm'>
                        Followed up today
                      </Button>
                    </form>
                  </div>
                );
              })()}
              {SECTIONS.map((s) => (
                <fieldset key={s.title}>
                  <legend className='mb-2 text-sm font-semibold'>{s.title}</legend>
                  <div className='grid grid-cols-2 gap-3'>{s.fields.map(field)}</div>
                </fieldset>
              ))}
              <div className='border-border border-t pt-4'>
                {confirmDelete ? (
                  <div className='flex items-center gap-2 text-sm'>
                    <span>Delete this order permanently?</span>
                    <Button variant='destructive' size='sm' onClick={remove}>
                      Yes, delete
                    </Button>
                    <Button variant='ghost' size='sm' onClick={() => setConfirmDelete(false)}>
                      Keep
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant='ghost'
                    size='sm'
                    className='text-red-400'
                    onClick={() => setConfirmDelete(true)}
                  >
                    Delete order
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <ol className='flex flex-col gap-3'>
              {log === null && <li className='text-muted-foreground text-sm'>Loading…</li>}
              {log?.length === 0 && (
                <li className='text-muted-foreground text-sm'>No activity yet.</li>
              )}
              {log?.map((l) => (
                <li key={l.n} className='border-border border-l-2 pl-3 text-sm'>
                  <div className='text-muted-foreground text-xs tabular-nums'>
                    {l.at.replace('T', ' ').slice(0, 16)}
                  </div>
                  <div>{l.text}</div>
                </li>
              ))}
            </ol>
          )}
        </div>
        {tab === 'details' && (
          <div className='border-border flex items-center justify-end gap-2 border-t p-3'>
            <Button
              variant='ghost'
              size='sm'
              disabled={!dirty || saving}
              onClick={() => {
                setDraft({});
                setError(null);
              }}
            >
              Discard
            </Button>
            <Button size='sm' disabled={!dirty || saving} onClick={save}>
              {saving ? 'Saving…' : 'Save changes'}
            </Button>
          </div>
        )}
      </aside>
    </div>
  );
}
