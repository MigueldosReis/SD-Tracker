import type { Icon } from '@/components/icons';
import { Icons } from '@/components/icons';
import {
  CLOSED_GROUPS,
  OTHER_STATUSES,
  PROCESS_STATUSES,
  displaySite,
  withStoreCode,
  type BoardDef,
  type BoardId,
  type Order,
  type OrderField
} from '@/lib/tracker-fields';
import { followUpState, nextFollowUp, type FollowUpState } from '@/lib/working-days';

export type LogEntry = { n: number; at: string; text: string };
export type Summary = { id: BoardId; title: string; open: number; followUpsDue: number };
export type SaveResult =
  | { ok: true; order: Order; log: LogEntry[] }
  | { ok: false; error: string; field?: string };

export const CLOSED = CLOSED_GROUPS as readonly string[];
export const BASE_STATUSES = [...PROCESS_STATUSES, ...OTHER_STATUSES] as string[];

export const BOARD_ICONS: Record<BoardId, Icon> = {
  orders: Icons.router,
  'mrp-new-stores': Icons.store,
  'mrp-projects': Icons.warehouse,
  feasibility: Icons.radar,
  'dual-supplier': Icons.split,
  'landlord-approval': Icons.homeCheck
};

export const boardHref = (id: BoardId) => (id === 'orders' ? '/orders' : `/boards/${id}`);

export const str = (v: unknown) => (v === null || v === undefined ? '' : String(v));
export const isoDate = (v: unknown) => str(v).slice(0, 10);

// UTC so the server and the browser always print the same day (no hydration mismatch).
const DATE_FMT = new Intl.DateTimeFormat('en-ZA', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC'
});
const SHORT_FMT = new Intl.DateTimeFormat('en-ZA', {
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC'
});
const DATETIME_FMT = new Intl.DateTimeFormat('en-ZA', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Africa/Johannesburg'
});

/** '2026-11-26' → '26 Nov 2026' (or '26 Nov' when `short`). */
export function fmtDate(v: unknown, short = false): string {
  const d = isoDate(v);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return '';
  const t = new Date(`${d}T00:00:00Z`);
  return (short ? SHORT_FMT : DATE_FMT).format(t);
}
export function fmtDateTime(v: unknown): string {
  const t = new Date(str(v));
  return Number.isNaN(t.getTime()) ? str(v) : DATETIME_FMT.format(t);
}

export const isOpen = (o: Order) =>
  !CLOSED.includes(str(o.groupName)) && o.status !== 'Complete' && o.status !== 'Cancelled';

export const dueDate = (o: Order) =>
  nextFollowUp(o.lastFollowUp as string | null, o.createdAt as string | null);

/** Follow-up state of an open order on a follow-up board, or null when it needs none. */
export function followUpOf(
  board: BoardDef,
  o: Order,
  today: string
): { due: string; state: FollowUpState } | null {
  if (!board.followUp || !isOpen(o)) return null;
  const due = dueDate(o);
  return due ? { due, state: followUpState(due, today) } : null;
}

export const siteName = (board: BoardDef, o: Order) =>
  board.mrp ? (withStoreCode(displaySite(o), str(o.storeCode)) ?? '') : str(o.site);

/** The main line identifying an order: the store on MRP boards, the customer elsewhere. */
export const orderTitle = (board: BoardDef, o: Order) =>
  board.mrp ? siteName(board, o) || 'Untitled store' : str(o.customer) || 'Untitled order';

export const LABELS: Partial<Record<OrderField, string>> = {
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
  landlordRecvSupplier: 'Landlord docs from supplier',
  landlordSentClient: 'Landlord docs sent to client',
  landlordSignedFirstnet: 'Landlord docs signed to FirstNet',
  landlordReturnedSupplier: 'Landlord docs to supplier',
  installDate: 'Install date',
  cutoverDate: 'Cutover date',
  forecastHandover: 'Forecast handover',
  serial: 'Equipment serial number',
  equipment: 'Equipment make & model',
  billingStart: 'Billing start',
  sellMrc: 'Sell MRC',
  sellNrc: 'Sell NRC',
  costMrc: 'Cost MRC',
  costNrc: 'Cost NRC',
  billNrc: 'Bill NRC'
};

export const SECTIONS: { title: string; fields: OrderField[] }[] = [
  {
    title: 'Order',
    fields: [
      'customer',
      'site',
      'storeCode',
      'board',
      'groupName',
      'status',
      'owner',
      'orderType',
      'circuit',
      'ref',
      'address'
    ]
  },
  {
    title: 'Service & supplier',
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

export const DATE_FIELDS = new Set<OrderField>(SECTIONS.find((s) => s.title === 'Dates')!.fields);
export const WIDE_FIELDS = new Set<OrderField>(['notes', 'address']);

/** The person using this device ("Posting as" / My work), remembered in the browser; '' when not chosen. */
export function currentPerson(): string {
  try {
    return localStorage.getItem('sd-tracker:author') ?? '';
  } catch {
    return '';
  }
}
