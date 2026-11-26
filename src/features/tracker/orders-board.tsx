'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  EDITABLE_FIELDS, EXCLUDED_GROUPS, GROUP_ORDER, MONEY_FIELDS, OTHER_STATUSES, OWNERS,
  PROCESS_STATUSES, type Order, type OrderField
} from '@/lib/tracker-fields';
import { groupColor, statusColor } from './status-style';

const ROW_CAP = 100;
const ALWAYS_SHOW = ['New Pending Orders', 'Open Orders'];
const BOTTOM = ['Completed', 'Cancelled'];
const DEFAULT_COLLAPSED = new Set(BOTTOM);
const BASE_STATUSES = [...PROCESS_STATUSES, ...OTHER_STATUSES] as string[];

type LogEntry = { n: number; at: string; text: string };

const LABELS: Partial<Record<OrderField, string>> = {
  ref: 'Reference', groupName: 'Group', customer: 'Customer', site: 'Site name', circuit: 'Circuit ID',
  status: 'Status', orderType: 'New or existing', service: 'Service', speed: 'Speed', linkRole: 'Primary / secondary',
  supplier: 'Supplier', supplierService: 'Supplier service', storeCode: 'Store code', address: 'Address',
  notes: 'Notes', owner: 'Owner', cofRequested: 'COF requested', cofReceived: 'COF received',
  coverRequested: 'Cover requested', coverReceived: 'Cover received', cofSigned: 'COF signed',
  clientApproved: 'Client approved', quoteSent: 'Quote sent', siteSurvey: 'Site survey',
  landlordRecvSupplier: 'Landlord docs received from supplier', landlordSentClient: 'Landlord docs sent to client',
  landlordSignedFirstnet: 'Landlord docs signed and returned to FirstNet',
  landlordReturnedSupplier: 'Landlord docs returned to supplier', installDate: 'Install scheduled',
  cutoverDate: 'Cutover date', forecastHandover: 'Forecasted handover', serial: 'Equipment serial number',
  equipment: 'Equipment make and model', billingStart: 'Billing start date', sellMrc: 'Sell MRC', sellNrc: 'Sell NRC',
  costMrc: 'Cost MRC', costNrc: 'Cost NRC', billNrc: 'Bill NRC'
};

const SECTIONS: { title: string; fields: OrderField[] }[] = [
  { title: 'Order', fields: ['customer', 'site', 'groupName', 'status', 'owner', 'orderType', 'storeCode', 'circuit', 'ref', 'address'] },
  { title: 'Service and supplier', fields: ['service', 'speed', 'linkRole', 'supplier', 'supplierService'] },
  { title: 'Dates', fields: ['quoteSent', 'clientApproved', 'cofRequested', 'cofReceived', 'cofSigned', 'coverRequested', 'coverReceived', 'siteSurvey', 'landlordRecvSupplier', 'landlordSentClient', 'landlordSignedFirstnet', 'landlordReturnedSupplier', 'installDate', 'cutoverDate', 'forecastHandover', 'billingStart'] },
  { title: 'Equipment', fields: ['serial', 'equipment'] },
  { title: 'Costs', fields: ['sellMrc', 'sellNrc', 'costMrc', 'costNrc', 'billNrc'] },
  { title: 'Notes', fields: ['notes'] }
];
const DATE_FIELDS = new Set<OrderField>([
  'quoteSent', 'clientApproved', 'cofRequested', 'cofReceived', 'cofSigned', 'coverRequested', 'coverReceived',
  'siteSurvey', 'landlordRecvSupplier', 'landlordSentClient', 'landlordSignedFirstnet', 'landlordReturnedSupplier',
  'installDate', 'cutoverDate', 'forecastHandover', 'billingStart'
]);

const str = (v: unknown) => (v === null || v === undefined ? '' : String(v));
const fmtDate = (v: unknown) => str(v).slice(0, 10);

function StatusPill({ status }: { status: string | null }) {
  return (
    <span className='inline-block rounded px-2 py-0.5 text-xs font-medium text-white' style={{ background: statusColor(status) }}>
      {status || 'No status'}
    </span>
  );
}

export function OrdersBoard({ initialOrders }: { initialOrders: Order[] }) {
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set(DEFAULT_COLLAPSED));
  const [showAll, setShowAll] = useState<Set<string>>(new Set());
  const [openId, setOpenId] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [adding, setAdding] = useState<string | null>(null);

  const patch = useCallback(async (id: string, body: Record<string, unknown>) => {
    const res = await fetch(`/api/tracker/orders/${encodeURIComponent(id)}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false as const, error: String(data.error ?? `Request failed (${res.status})`) };
    setOrders((prev) => prev.map((o) => (o.id === id ? (data.order as Order) : o)));
    return { ok: true as const, order: data.order as Order, log: (data.log ?? []) as LogEntry[] };
  }, []);

  const statuses = useMemo(() => {
    const seen = new Set(BASE_STATUSES);
    const extra = [...new Set(orders.map((o) => str(o.status)).filter((s) => s && !seen.has(s)))].sort();
    return { base: BASE_STATUSES, extra };
  }, [orders]);

  const filtering = q.trim() !== '' || statusFilter !== '';
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return orders.filter((o) => {
      if (statusFilter && o.status !== statusFilter) return false;
      if (!needle) return true;
      return [o.customer, o.site, o.circuit, o.ref, o.storeCode, o.address, o.supplier]
        .some((v) => str(v).toLowerCase().includes(needle));
    });
  }, [orders, q, statusFilter]);

  const groups = useMemo(() => {
    const map = new Map<string, Order[]>();
    for (const o of filtered) {
      const g = str(o.groupName) || 'No group';
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(o);
    }
    const known = (GROUP_ORDER as readonly string[]).filter((g) => !BOTTOM.includes(g));
    const unknown = [...map.keys()].filter((g) => !known.includes(g) && !BOTTOM.includes(g)).sort();
    const names = [...known, ...unknown, ...BOTTOM];
    return names
      .filter((g) => map.has(g) || (!filtering && ALWAYS_SHOW.includes(g)))
      .map((g) => ({ name: g, rows: map.get(g) ?? [] }));
  }, [filtered, filtering]);

  const toggle = (set: Set<string>, name: string) => {
    const n = new Set(set);
    if (n.has(name)) n.delete(name);
    else n.add(name);
    return n;
  };

  async function onStatusChange(o: Order, status: string) {
    setBanner(null);
    const r = await patch(o.id, { status });
    if (!r.ok) { setBanner(`${o.customer ?? 'Order'} ${o.site ? '· ' + o.site : ''}: ${r.error}`); setOpenId(o.id); }
  }

  async function addOrder(groupName: string, customer: string, site: string) {
    const res = await fetch('/api/tracker/orders', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ customer, site, groupName })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { setBanner(String(data.error ?? 'Could not add the order')); return; }
    setOrders((prev) => [data.order as Order, ...prev]);
    setAdding(null);
    setOpenId((data.order as Order).id);
  }

  const open = openId ? orders.find((o) => o.id === openId) ?? null : null;

  return (
    <div className='flex min-h-dvh flex-col'>
      <header className='border-border flex flex-wrap items-end justify-between gap-3 border-b px-6 py-4'>
        <div>
          <h1 className='text-xl font-semibold tracking-tight'>Orders</h1>
          <p className='text-muted-foreground text-sm'>
            {filtered.length.toLocaleString()} of {orders.length.toLocaleString()} orders
            <span className='ml-2'>· Mr Price store orders are tracked on their own board</span>
          </p>
        </div>
        <div className='flex flex-wrap items-center gap-2'>
          <Input aria-label='Search orders' placeholder='Search customer, site, circuit, store code…' value={q}
            onChange={(e) => setQ(e.target.value)} className='w-72' />
          <select aria-label='Filter by status' value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
            className='border-input bg-background h-8 rounded-lg border px-2 text-sm'>
            <option value=''>All statuses</option>
            {statuses.base.map((s) => <option key={s} value={s}>{s}</option>)}
            {statuses.extra.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          {filtering && <Button variant='ghost' size='sm' onClick={() => { setQ(''); setStatusFilter(''); }}>Clear</Button>}
        </div>
      </header>

      {banner && (
        <div role='alert' className='mx-6 mt-3 flex items-center justify-between rounded-md border border-red-500/50 bg-red-500/10 px-3 py-2 text-sm text-red-300'>
          <span>{banner}</span>
          <button className='ml-4 underline' onClick={() => setBanner(null)}>Dismiss</button>
        </div>
      )}

      <main className='flex flex-col gap-4 px-6 py-4'>
        {groups.length === 0 && <p className='text-muted-foreground py-12 text-center'>No orders match.</p>}
        {groups.map(({ name, rows }) => {
          const isCollapsed = filtering ? false : collapsed.has(name);
          const visible = showAll.has(name) ? rows : rows.slice(0, ROW_CAP);
          const color = groupColor(name);
          return (
            <section key={name} className='border-border overflow-hidden rounded-lg border' style={{ borderLeft: `4px solid ${color}` }}>
              <div className='bg-card flex items-center justify-between px-3 py-2'>
                <button className='flex items-center gap-2 text-left' aria-expanded={!isCollapsed}
                  onClick={() => setCollapsed((c) => toggle(c, name))}>
                  <span aria-hidden className='text-muted-foreground w-4 text-xs'>{isCollapsed ? '▶' : '▼'}</span>
                  <span className='font-semibold' style={{ color }}>{name}</span>
                  <span className='text-muted-foreground text-sm'>{rows.length.toLocaleString()} {rows.length === 1 ? 'order' : 'orders'}</span>
                </button>
                {!BOTTOM.includes(name) && (
                  <Button variant='ghost' size='sm' onClick={() => setAdding(adding === name ? null : name)}>+ Add order</Button>
                )}
              </div>
              {adding === name && <AddOrderRow groupName={name} onAdd={addOrder} onCancel={() => setAdding(null)} />}
              {!isCollapsed && rows.length > 0 && (
                <div className='overflow-x-auto'>
                  <table className='w-full min-w-[1000px] border-collapse text-sm'>
                    <thead>
                      <tr className='bg-muted/40 text-muted-foreground text-left text-xs uppercase'>
                        {['Customer', 'Site', 'Status', 'Circuit ID', 'Supplier', 'Service', 'Speed', 'Install', 'Updated'].map((h) => (
                          <th key={h} scope='col' className='border-border border-r border-b px-3 py-2 font-medium last:border-r-0'>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {visible.map((o) => (
                        <tr key={o.id} className='border-border hover:bg-muted/30 cursor-pointer border-b' onClick={() => setOpenId(o.id)}>
                          <td className='border-border max-w-56 truncate border-r px-3 py-1.5'>{str(o.customer)}</td>
                          <td className='border-border max-w-56 truncate border-r px-3 py-1.5'>{str(o.site)}</td>
                          <td className='border-border border-r p-1' onClick={(e) => e.stopPropagation()}>
                            <select aria-label={`Status for ${str(o.customer)} ${str(o.site)}`} value={str(o.status)}
                              onChange={(e) => onStatusChange(o, e.target.value)}
                              className='w-full cursor-pointer rounded px-2 py-1 text-xs font-medium text-white'
                              style={{ background: statusColor(o.status) }}>
                              {!BASE_STATUSES.includes(str(o.status)) && <option value={str(o.status)}>{str(o.status) || 'No status'}</option>}
                              {BASE_STATUSES.map((s) => <option key={s} value={s} style={{ background: '#111', color: '#fff' }}>{s}</option>)}
                            </select>
                          </td>
                          <td className='border-border border-r px-3 py-1.5 font-mono text-xs'>{str(o.circuit)}</td>
                          <td className='border-border border-r px-3 py-1.5'>{str(o.supplier)}</td>
                          <td className='border-border border-r px-3 py-1.5'>{str(o.service)}</td>
                          <td className='border-border border-r px-3 py-1.5'>{str(o.speed)}</td>
                          <td className='border-border border-r px-3 py-1.5 tabular-nums'>{fmtDate(o.installDate)}</td>
                          <td className='px-3 py-1.5 tabular-nums'>{fmtDate(o.updatedAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {rows.length > visible.length && (
                    <div className='p-2 text-center'>
                      <Button variant='ghost' size='sm' onClick={() => setShowAll((s) => toggle(s, name))}>
                        Show all {rows.length.toLocaleString()} orders ({(rows.length - visible.length).toLocaleString()} more)
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
        <OrderPanel key={open.id} order={open} statuses={[...statuses.base, ...statuses.extra]}
          groupNames={[...new Set([...GROUP_ORDER as readonly string[], ...orders.map((o) => str(o.groupName))])].filter((g) => !(EXCLUDED_GROUPS as readonly string[]).includes(g))}
          onClose={() => setOpenId(null)} patch={patch}
          onDeleted={(id) => { setOrders((p) => p.filter((o) => o.id !== id)); setOpenId(null); }} />
      )}
    </div>
  );
}

function AddOrderRow({ groupName, onAdd, onCancel }: { groupName: string; onAdd: (g: string, c: string, s: string) => void; onCancel: () => void }) {
  const [customer, setCustomer] = useState('');
  const [site, setSite] = useState('');
  return (
    <form className='bg-muted/20 flex flex-wrap items-center gap-2 px-3 py-2' onSubmit={(e) => { e.preventDefault(); if (customer.trim()) onAdd(groupName, customer.trim(), site.trim()); }}>
      <Input autoFocus aria-label='Customer' placeholder='Customer' value={customer} onChange={(e) => setCustomer(e.target.value)} className='w-56' />
      <Input aria-label='Site name' placeholder='Site name' value={site} onChange={(e) => setSite(e.target.value)} className='w-56' />
      <Button type='submit' size='sm' disabled={!customer.trim()}>Add</Button>
      <Button type='button' variant='ghost' size='sm' onClick={onCancel}>Cancel</Button>
    </form>
  );
}

function OrderPanel({ order, statuses, groupNames, onClose, patch, onDeleted }: {
  order: Order; statuses: string[]; groupNames: string[]; onClose: () => void;
  patch: (id: string, body: Record<string, unknown>) => Promise<{ ok: true; order: Order; log: LogEntry[] } | { ok: false; error: string }>;
  onDeleted: (id: string) => void;
}) {
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<'details' | 'activity'>('details');
  const [log, setLog] = useState<LogEntry[] | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const loadLog = useCallback(async () => {
    const res = await fetch(`/api/tracker/orders/${encodeURIComponent(order.id)}`);
    if (res.ok) setLog(((await res.json()).log ?? []) as LogEntry[]);
  }, [order.id]);
  useEffect(() => { if (tab === 'activity' && log === null) void loadLog(); }, [tab, log, loadLog]);

  const value = (f: OrderField) => (f in draft ? draft[f] : DATE_FIELDS.has(f) ? fmtDate(order[f]) : str(order[f]));
  const dirty = Object.keys(draft).length > 0;

  async function save() {
    setSaving(true); setError(null);
    const body: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(draft)) body[k] = v;
    const r = await patch(order.id, body);
    setSaving(false);
    if (!r.ok) { setError(r.error); return; }
    setDraft({}); setLog(r.log);
  }

  async function remove() {
    const res = await fetch(`/api/tracker/orders/${encodeURIComponent(order.id)}`, { method: 'DELETE' });
    if (res.ok) onDeleted(order.id); else setError('Could not delete this order');
  }

  const field = (f: OrderField) => {
    if (!(EDITABLE_FIELDS as readonly string[]).includes(f)) return null;
    const id = `f-${f}`;
    const common = 'border-input bg-background w-full rounded-lg border px-2 py-1.5 text-sm';
    let input;
    if (f === 'status') {
      const list = statuses.includes(value(f)) || !value(f) ? statuses : [value(f), ...statuses];
      input = <select id={id} className={common} value={value(f)} onChange={(e) => setDraft((d) => ({ ...d, [f]: e.target.value }))}>
        {list.map((s) => <option key={s} value={s}>{s}</option>)}</select>;
    } else if (f === 'groupName') {
      const list = groupNames.includes(value(f)) ? groupNames : [value(f), ...groupNames];
      input = <select id={id} className={common} value={value(f)} onChange={(e) => setDraft((d) => ({ ...d, [f]: e.target.value }))}>
        {list.map((s) => <option key={s} value={s}>{s}</option>)}</select>;
    } else if (f === 'owner') {
      input = <select id={id} className={common} value={value(f)} onChange={(e) => setDraft((d) => ({ ...d, [f]: e.target.value }))}>
        <option value=''>Unassigned</option>{(OWNERS as readonly string[]).map((s) => <option key={s} value={s}>{s}</option>)}</select>;
    } else if (f === 'notes' || f === 'address') {
      input = <textarea id={id} rows={3} className={common} value={value(f)} onChange={(e) => setDraft((d) => ({ ...d, [f]: e.target.value }))} />;
    } else {
      input = <input id={id} className={common} type={DATE_FIELDS.has(f) ? 'date' : 'text'}
        inputMode={(MONEY_FIELDS as readonly string[]).includes(f) ? 'decimal' : undefined}
        value={value(f)} onChange={(e) => setDraft((d) => ({ ...d, [f]: e.target.value }))} />;
    }
    return (
      <div key={f} className={f === 'notes' || f === 'address' ? 'col-span-2' : ''}>
        <label htmlFor={id} className='text-muted-foreground mb-1 block text-xs'>{LABELS[f] ?? f}</label>
        {input}
      </div>
    );
  };

  return (
    <div className='fixed inset-0 z-50 flex justify-end' role='dialog' aria-modal='true' aria-label='Order details'>
      <button aria-label='Close panel' className='absolute inset-0 bg-black/50' onClick={onClose} />
      <aside className='bg-card border-border relative flex h-full w-full max-w-xl flex-col border-l shadow-2xl'>
        <div className='border-border flex items-start justify-between gap-3 border-b p-4'>
          <div className='min-w-0'>
            <h2 className='truncate text-lg font-semibold'>{str(order.customer) || 'Untitled order'}</h2>
            <p className='text-muted-foreground truncate text-sm'>{str(order.site)}</p>
            <div className='mt-2'><StatusPill status={order.status === null ? null : String(order.status)} /></div>
          </div>
          <Button variant='ghost' size='sm' onClick={onClose}>Close</Button>
        </div>
        <div className='border-border flex gap-4 border-b px-4' role='tablist'>
          {(['details', 'activity'] as const).map((t) => (
            <button key={t} role='tab' aria-selected={tab === t} onClick={() => setTab(t)}
              className={`-mb-px border-b-2 py-2 text-sm capitalize ${tab === t ? 'border-primary font-semibold' : 'text-muted-foreground border-transparent'}`}>{t}</button>
          ))}
        </div>
        <div className='flex-1 overflow-y-auto p-4'>
          {error && <div role='alert' className='mb-3 rounded-md border border-red-500/50 bg-red-500/10 px-3 py-2 text-sm text-red-300'>{error}</div>}
          {tab === 'details' ? (
            <div className='flex flex-col gap-6'>
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
                    <Button variant='destructive' size='sm' onClick={remove}>Yes, delete</Button>
                    <Button variant='ghost' size='sm' onClick={() => setConfirmDelete(false)}>Keep</Button>
                  </div>
                ) : (
                  <Button variant='ghost' size='sm' className='text-red-400' onClick={() => setConfirmDelete(true)}>Delete order</Button>
                )}
              </div>
            </div>
          ) : (
            <ol className='flex flex-col gap-3'>
              {log === null && <li className='text-muted-foreground text-sm'>Loading…</li>}
              {log?.length === 0 && <li className='text-muted-foreground text-sm'>No activity yet.</li>}
              {log?.map((l) => (
                <li key={l.n} className='border-border border-l-2 pl-3 text-sm'>
                  <div className='text-muted-foreground text-xs tabular-nums'>{l.at.replace('T', ' ').slice(0, 16)}</div>
                  <div>{l.text}</div>
                </li>
              ))}
            </ol>
          )}
        </div>
        {tab === 'details' && (
          <div className='border-border flex items-center justify-end gap-2 border-t p-3'>
            <Button variant='ghost' size='sm' disabled={!dirty || saving} onClick={() => { setDraft({}); setError(null); }}>Discard</Button>
            <Button size='sm' disabled={!dirty || saving} onClick={save}>{saving ? 'Saving…' : 'Save changes'}</Button>
          </div>
        )}
      </aside>
    </div>
  );
}
