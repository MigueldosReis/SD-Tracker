// Shared by the importer script and the app. No imports: Node can run this file directly.
export const ORDER_FIELDS = [
  'ref',
  'board',
  'groupName',
  'customer',
  'site',
  'circuit',
  'status',
  'orderType',
  'service',
  'speed',
  'linkRole',
  'supplier',
  'supplierService',
  'storeCode',
  'address',
  'notes',
  'owner',
  'cofRequested',
  'cofReceived',
  'coverRequested',
  'coverReceived',
  'cofSigned',
  'clientApproved',
  'quoteSent',
  'siteSurvey',
  'landlordRecvSupplier',
  'landlordSentClient',
  'landlordSignedFirstnet',
  'landlordReturnedSupplier',
  'installDate',
  'cutoverDate',
  'forecastHandover',
  'lastFollowUp',
  'serial',
  'equipment',
  'billingStart',
  'sellMrc',
  'sellNrc',
  'costMrc',
  'costNrc',
  'billNrc',
  'createdAt',
  'updatedAt'
] as const;

export type OrderField = (typeof ORDER_FIELDS)[number];
export type Order = { id: string } & { [K in OrderField]: string | number | null } & {
  /** When the order entered its current status (from the activity log), read-only. */
  statusSince?: string | null;
  /** Number of updates (comments) on the order, read-only. */
  updateCount?: number;
};

/** Fields a user may edit (everything except identity and timestamps). */
export const EDITABLE_FIELDS: readonly OrderField[] = ORDER_FIELDS.filter(
  (f) => f !== 'createdAt' && f !== 'updatedAt'
);

export const MONEY_FIELDS: readonly OrderField[] = [
  'sellMrc',
  'sellNrc',
  'costMrc',
  'costNrc',
  'billNrc'
];

// The 16-step delivery process, in order, followed by the other statuses seen in the data.
export const PROCESS_STATUSES = [
  'Awaiting Internal Approval',
  'Order to be Placed',
  'Order Placed with Supplier',
  'Awaiting Site Survey',
  'Site Survey Scheduled',
  'Awaiting Planning Document',
  'Awaiting Landlord Approval',
  'Awaiting Wayleave Approval',
  'Awaiting Install Dates',
  'Install Scheduled',
  'Install in Progress',
  'Awaiting Supplier Handover',
  'Cutover to be Scheduled',
  'Cutover Scheduled',
  'Handover Sent',
  'Complete'
] as const;

export const OTHER_STATUSES = ['Cancelled', 'On Hold'] as const;

/** A status change needs these fields filled in first. */
export const STATUS_REQUIRES: Record<string, { field: OrderField; label: string }> = {
  'Site Survey Scheduled': { field: 'siteSurvey', label: 'Site survey date' },
  'Install Scheduled': { field: 'installDate', label: 'Install date' },
  'Cutover Scheduled': { field: 'cutoverDate', label: 'Cutover date' },
  'Handover Sent': { field: 'serial', label: 'Equipment serial number' }
};

// Display order of groups on the Orders page.
export const GROUP_ORDER = [
  'HOLB',
  'New Pending Orders',
  'FirstNet',
  'LTE Orders',
  'Democratic Alliance',
  'WJ Kemp',
  'Afrox',
  'Tiletoria',
  'Scottnet',
  'Dis-Chem 2026',
  'Woolworths 2026',
  'Open Orders',
  'Renewals/Upgrades/Downgrades',
  'Power Fashion New Stores',
  'Completed',
  'Cancelled'
] as const;

/** Groups for finished orders. They sit at the bottom of every board, collapsed, and never need a follow-up. */
export const CLOSED_GROUPS = ['Completed', 'Cancelled'] as const;

export const BOARD_IDS = [
  'orders',
  'mrp-new-stores',
  'mrp-projects',
  'feasibility',
  'dual-supplier',
  'landlord-approval'
] as const;
export type BoardId = (typeof BOARD_IDS)[number];

export type BoardDef = {
  id: BoardId;
  title: string;
  description: string;
  /** Group display order; the first one is where new orders go. Closed groups are added at the bottom. */
  groups: readonly string[];
  /** Open orders need a follow-up every FOLLOW_UP_WORKING_DAYS working days. */
  followUp: boolean;
  /** Mr Price store board: a store code is required and the site name always carries it. */
  mrp: boolean;
  /**
   * A view board holds no orders of its own: it shows the orders of `source` whose status is one of `statuses`.
   * Orders are added on the source board and leave the view when their status moves on.
   */
  view?: { source: BoardId; statuses: readonly string[] };
  /** No delivery timeline (Gantt) for this board's orders. */
  noTimeline?: true;
};

/** Statuses that mean an MRP project store is in landlord approval (the last two are legacy statuses). */
export const LANDLORD_STATUSES = [
  'Awaiting Landlord Approval',
  'Awaiting Landlord Docs - Supplier',
  'Awaiting Landlord Docs - Client'
] as const;

export const BOARDS: readonly BoardDef[] = [
  {
    id: 'orders',
    title: 'Orders',
    description: 'Customer connectivity orders (Mr Price store orders have their own boards)',
    groups: GROUP_ORDER.filter((g) => !(CLOSED_GROUPS as readonly string[]).includes(g)),
    followUp: false,
    mrp: false
  },
  {
    id: 'mrp-new-stores',
    title: 'MRP New Stores',
    description: 'Connectivity for new Mr Price Group stores',
    groups: ['Mr Price New Stores'],
    followUp: true,
    mrp: true
  },
  {
    id: 'mrp-projects',
    title: 'MRP Project Orders',
    description: 'Mr Price Group project orders: upgrades, relocations and other store changes',
    groups: ['Mr Price Project Orders'],
    followUp: false,
    mrp: true,
    noTimeline: true
  },
  {
    id: 'feasibility',
    title: 'Feasibility',
    description: 'Feasibility checks with suppliers before an order is placed',
    groups: ['Feasibility Requests'],
    followUp: true,
    mrp: false
  },
  {
    id: 'dual-supplier',
    title: 'Dual Supplier',
    description: 'Sites being set up with a second supplier for redundancy',
    groups: ['Dual Supplier Requests'],
    followUp: true,
    mrp: false
  },
  {
    id: 'landlord-approval',
    title: 'Landlord Approval',
    description: 'MRP project stores waiting on landlord approval',
    groups: ['Mr Price Project Orders'],
    followUp: true,
    mrp: true,
    noTimeline: true,
    view: { source: 'mrp-projects', statuses: LANDLORD_STATUSES }
  }
];

export const getBoard = (id: string): BoardDef | undefined => BOARDS.find((b) => b.id === id);
export const isBoardId = (id: unknown): id is BoardId =>
  typeof id === 'string' && (BOARD_IDS as readonly string[]).includes(id);
/** Boards an order can be stored on (view boards only show orders from their source board). */
export const STORED_BOARDS: readonly BoardDef[] = BOARDS.filter((b) => !b.view);
export const isStoredBoardId = (id: unknown): id is BoardId =>
  STORED_BOARDS.some((b) => b.id === id);

/** Whether an order shows on a board. */
export function belongsTo(board: BoardDef, o: { board?: unknown; status?: unknown }): boolean {
  if (board.view)
    return o.board === board.view.source && board.view.statuses.includes(String(o.status ?? ''));
  return o.board === board.id;
}

export const isMrpCustomer = (customer: unknown) => /\bmr\s*price\b/i.test(String(customer ?? ''));

/**
 * Which board an imported order belongs on. Mr Price Group orders go to the MRP boards: new-store orders
 * (their reference says "new store") to MRP New Stores, anything else to MRP Project Orders.
 */
export function boardFor(o: { groupName?: unknown; customer?: unknown; ref?: unknown }): BoardId {
  const group = String(o.groupName ?? '');
  for (const b of STORED_BOARDS) if (b.id !== 'orders' && b.groups.includes(group)) return b.id;
  if (isMrpCustomer(o.customer) || /^mr price/i.test(group)) {
    return /new\s*stores?\b/i.test(String(o.ref ?? '')) ? 'mrp-new-stores' : 'mrp-projects';
  }
  return 'orders';
}

/** Mr Price site names always carry the store code: append it when it is missing. */
export function withStoreCode(
  site: string | null | undefined,
  storeCode: string | null | undefined
): string | null {
  const code = (storeCode ?? '').trim();
  const name = (site ?? '').trim();
  if (!code) return name || null;
  if (!name) return code;
  return name.includes(code) ? name : `${name} ${code}`;
}

/** Imported MRP orders often have no site name; their reference holds it (e.g. "#New Store Mr Price Kids 11099"). */
export function displaySite(o: { site?: unknown; ref?: unknown }): string {
  const site = String(o.site ?? '').trim();
  if (site) return site.replace(/^"|"$/g, '');
  return String(o.ref ?? '')
    .replace(/^#\s*/, '')
    .replace(/^new\s+stores?\s+/i, '')
    .replace(/\s*\(copy\)$/i, '')
    .trim();
}
