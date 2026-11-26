import { OTHER_STATUSES, PROCESS_STATUSES } from '@/lib/tracker-fields';

const FIXED: Record<string, string> = {
  Complete: 'hsl(152 55% 28%)',
  Cancelled: 'hsl(0 0% 36%)',
  'On Hold': 'hsl(32 85% 32%)'
};
const ORDERED = [...PROCESS_STATUSES, ...OTHER_STATUSES] as string[];

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

/** Solid, distinct colour per status. Known statuses get evenly spread hues; legacy statuses get a stable hash hue. */
export function statusColor(input: string | number | null | undefined): string {
  const status = input === null || input === undefined ? '' : String(input);
  if (!status) return 'hsl(220 10% 30%)';
  if (FIXED[status]) return FIXED[status];
  const i = ORDERED.indexOf(status);
  const hue = i >= 0 ? (i * 137.5) % 360 : hash(status) % 360;
  return `hsl(${Math.round(hue)} 58% 36%)`;
}

export const GROUP_COLORS: Record<string, string> = {
  HOLB: '#b070d6', 'New Pending Orders': '#f59f3a', FirstNet: '#2f93bd', 'LTE Orders': '#a3cf4a',
  'Democratic Alliance': '#8a6458', 'WJ Kemp': '#c9b04a', Afrox: '#f0703f', Tiletoria: '#c04668',
  Scottnet: '#6bc3ee', 'Dis-Chem 2026': '#1f8a63', 'Woolworths 2026': '#2a6b73', 'Open Orders': '#5b93e6',
  'Renewals/Upgrades/Downgrades': '#6a55c8', 'Power Fashion New Stores': '#e86bb4', Completed: '#34b27b', Cancelled: '#7d8498'
};
export const groupColor = (g: string) => GROUP_COLORS[g] ?? '#8a909b';
