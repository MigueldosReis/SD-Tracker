import { OTHER_STATUSES, PROCESS_STATUSES } from '@/lib/tracker-fields';

// Meaningful anchors: done is green, cancelled is grey, on hold is amber.
const FIXED: Record<string, string> = {
  Complete: 'oklch(0.5 0.13 152)',
  'Handover Sent': 'oklch(0.5 0.1 190)',
  Cancelled: 'oklch(0.5 0.015 260)',
  'On Hold': 'oklch(0.52 0.12 65)'
};
const ORDERED = [...PROCESS_STATUSES, ...OTHER_STATUSES] as string[];

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

/**
 * Solid, distinct colour per status, all at the same OKLCH lightness so white text reads on every one (about 5:1).
 * The delivery steps get evenly spread hues (golden angle); legacy statuses get a stable hue from their name.
 */
export function statusColor(input: string | number | null | undefined): string {
  const status = input === null || input === undefined ? '' : String(input);
  if (!status) return 'oklch(0.45 0.02 260)';
  if (FIXED[status]) return FIXED[status];
  const i = ORDERED.indexOf(status);
  const hue = i >= 0 ? (250 + i * 137.508) % 360 : hash(status) % 360;
  return `oklch(0.5 0.15 ${Math.round(hue)})`;
}

export const GROUP_COLORS: Record<string, string> = {
  HOLB: '#b070d6',
  'New Pending Orders': '#f59f3a',
  FirstNet: '#2f93bd',
  'LTE Orders': '#a3cf4a',
  'Democratic Alliance': '#8a6458',
  'WJ Kemp': '#c9b04a',
  Afrox: '#f0703f',
  Tiletoria: '#c04668',
  Scottnet: '#6bc3ee',
  'Dis-Chem 2026': '#1f8a63',
  'Woolworths 2026': '#2a6b73',
  'Open Orders': '#5b93e6',
  'Renewals/Upgrades/Downgrades': '#6a55c8',
  'Power Fashion New Stores': '#e86bb4',
  Completed: '#34b27b',
  Cancelled: '#7d8498',
  'Mr Price New Stores': '#e0465a',
  'Mr Price Project Orders': '#d9822b',
  'Feasibility Requests': '#3a9bd9',
  'Dual Supplier Requests': '#8b6bd9',
  'Awaiting Landlord Approval': '#c79a2e'
};
export const groupColor = (g: string) => GROUP_COLORS[g] ?? '#8a909b';
