// Shared by the importer script and the app. No imports: Node can run this file directly.
export const ORDER_FIELDS = [
  'ref', 'groupName', 'customer', 'site', 'circuit', 'status', 'orderType', 'service', 'speed',
  'linkRole', 'supplier', 'supplierService', 'storeCode', 'address', 'notes', 'owner',
  'cofRequested', 'cofReceived', 'coverRequested', 'coverReceived', 'cofSigned', 'clientApproved',
  'quoteSent', 'siteSurvey', 'landlordRecvSupplier', 'landlordSentClient',
  'landlordSignedFirstnet', 'landlordReturnedSupplier', 'installDate', 'cutoverDate',
  'forecastHandover', 'serial', 'equipment', 'billingStart', 'sellMrc', 'sellNrc', 'costMrc',
  'costNrc', 'billNrc', 'createdAt', 'updatedAt'
] as const;

export type OrderField = (typeof ORDER_FIELDS)[number];
export type Order = { id: string } & { [K in OrderField]: string | number | null };

/** Fields a user may edit (everything except identity and timestamps). */
export const EDITABLE_FIELDS: readonly OrderField[] = ORDER_FIELDS.filter(
  (f) => f !== 'createdAt' && f !== 'updatedAt'
);

export const MONEY_FIELDS: readonly OrderField[] = ['sellMrc', 'sellNrc', 'costMrc', 'costNrc', 'billNrc'];

// The 16-step delivery process, in order, followed by the other statuses seen in the data.
export const PROCESS_STATUSES = [
  'Awaiting Internal Approval', 'Order to be Placed', 'Order Placed with Supplier',
  'Awaiting Site Survey', 'Site Survey Scheduled', 'Awaiting Planning Document',
  'Awaiting Landlord Approval', 'Awaiting Wayleave Approval', 'Awaiting Install Dates',
  'Install Scheduled', 'Install in Progress', 'Awaiting Supplier Handover',
  'Cutover to be Scheduled', 'Cutover Scheduled', 'Handover Sent', 'Complete'
] as const;

export const OTHER_STATUSES = ['Cancelled', 'On Hold'] as const;

/** A status change needs these fields filled in first. */
export const STATUS_REQUIRES: Record<string, { field: OrderField; label: string }> = {
  'Site Survey Scheduled': { field: 'siteSurvey', label: 'Site survey date' },
  'Install Scheduled': { field: 'installDate', label: 'Install date' },
  'Cutover Scheduled': { field: 'cutoverDate', label: 'Cutover date' },
  'Handover Sent': { field: 'serial', label: 'Equipment serial number' }
};

// Display order of groups on the Orders page. MRP orders are tracked on their own board.
export const GROUP_ORDER = [
  'HOLB', 'New Pending Orders', 'FirstNet', 'LTE Orders', 'Democratic Alliance', 'WJ Kemp',
  'Afrox', 'Tiletoria', 'Scottnet', 'Dis-Chem 2026', 'Woolworths 2026', 'Open Orders',
  'Renewals/Upgrades/Downgrades', 'Power Fashion New Stores', 'Completed', 'Cancelled'
] as const;

export const EXCLUDED_GROUPS = ['Mr Price New Stores'] as const;
export const OWNERS = [
  'Alex Mokoena', 'Priya Naidoo', 'Sam van Wyk', 'Thandi Dlamini', 'Jordan Petersen', 'Lee Botha'
] as const;
