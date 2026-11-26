// Working-day maths for follow-ups: skips Saturdays, Sundays and South African public holidays.
// No imports, so the importer script and tests can run this file directly.
// All dates are 'YYYY-MM-DD' strings, handled in UTC so the server's time zone never shifts a day.

/** One-off public holidays declared by the President (e.g. election days). Add them here as they are gazetted. */
export const EXTRA_HOLIDAYS: readonly string[] = [
  '2024-05-29' // National and provincial elections
];

const DAY = 86_400_000;
const toTime = (d: string) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10));
const fromTime = (t: number) => new Date(t).toISOString().slice(0, 10);

/** Easter Sunday (Gregorian), via the anonymous Gregorian algorithm. */
function easterSunday(year: number): string {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

const FIXED = [
  '01-01', // New Year's Day
  '03-21', // Human Rights Day
  '04-27', // Freedom Day
  '05-01', // Workers' Day
  '06-16', // Youth Day
  '08-09', // National Women's Day
  '09-24', // Heritage Day
  '12-16', // Day of Reconciliation
  '12-25', // Christmas Day
  '12-26' // Day of Goodwill
];

const cache = new Map<number, Set<string>>();

/** South African public holidays for a year, including the Monday off when a holiday falls on a Sunday. */
export function zaHolidays(year: number): Set<string> {
  const hit = cache.get(year);
  if (hit) return hit;
  const easter = toTime(easterSunday(year));
  const days = [
    ...FIXED.map((md) => `${year}-${md}`),
    fromTime(easter - 2 * DAY), // Good Friday
    fromTime(easter + DAY) // Family Day
  ];
  const set = new Set(days);
  // Public Holidays Act, s2(1): a holiday on a Sunday makes the following Monday a holiday.
  for (const d of days)
    if (new Date(toTime(d)).getUTCDay() === 0) set.add(fromTime(toTime(d) + DAY));
  for (const d of EXTRA_HOLIDAYS) if (d.startsWith(`${year}-`)) set.add(d);
  cache.set(year, set);
  return set;
}

export function isWorkingDay(date: string): boolean {
  const dow = new Date(toTime(date)).getUTCDay();
  if (dow === 0 || dow === 6) return false;
  return !zaHolidays(+date.slice(0, 4)).has(date);
}

/** The date `n` working days after `date` (n >= 0). With n = 0, the same date or the next working day. */
export function addWorkingDays(date: string, n: number): string {
  let t = toTime(date.slice(0, 10));
  if (n === 0) {
    while (!isWorkingDay(fromTime(t))) t += DAY;
    return fromTime(t);
  }
  let left = n;
  while (left > 0) {
    t += DAY;
    if (isWorkingDay(fromTime(t))) left--;
  }
  return fromTime(t);
}

/** Today's date in Johannesburg (UTC+2, no daylight saving). */
export function todayZA(now = Date.now()): string {
  return fromTime(now + 2 * 3600_000);
}

export const FOLLOW_UP_WORKING_DAYS = 3;

export type FollowUpState = 'overdue' | 'due' | 'upcoming';

/** When the next follow-up is due, counted from the last follow-up (or from when the order was created). */
export function nextFollowUp(
  lastFollowUp: string | null | undefined,
  createdAt: string | null | undefined
): string | null {
  const from = lastFollowUp || createdAt;
  if (!from) return null;
  return addWorkingDays(String(from).slice(0, 10), FOLLOW_UP_WORKING_DAYS);
}

export function followUpState(due: string, today: string): FollowUpState {
  if (due < today) return 'overdue';
  if (due === today) return 'due';
  return 'upcoming';
}
