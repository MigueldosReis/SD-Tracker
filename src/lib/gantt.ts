// Gantt timeline for one order: when it started, where its current step sits, and when handover is expected.
// Pure: built on the journey rules, so the bars and the "late" flags agree with the rest of the tracker.
import { STEP_RULES, stepState } from './journey';
import { PROCESS_STATUSES } from './tracker-fields';
import { addWorkingDays } from './working-days';

export type Milestone = {
  kind: 'Survey' | 'Install' | 'Cutover' | 'Handover';
  date: string;
  /** The order has moved past this milestone. */
  done: boolean;
};

export type GanttRow = {
  /** When the order came in (YYYY-MM-DD). */
  start: string;
  /** Start of the current step, or null when not recorded (imported orders). */
  stepStart: string | null;
  /** When the current step should be done; today when late or when the step has no deadline. */
  stepEnd: string;
  late: boolean;
  /** When the current step was due, if it has a deadline (the start of the red part when late). */
  due: string | null;
  /** Expected handover: the forecast handover date, or worked out from the usual time per step. */
  end: string;
  /** True when `end` is worked out rather than a forecast someone entered. */
  estimated: boolean;
  /** The estimate skips steps that depend on others (landlord, survey availability), so it may move. */
  uncertain: boolean;
  /** Not on the delivery journey (On Hold, legacy statuses): no estimate is made. */
  offJourney: boolean;
  milestones: Milestone[];
};

type OrderLike = {
  status?: unknown;
  statusSince?: unknown;
  createdAt?: unknown;
  siteSurvey?: unknown;
  installDate?: unknown;
  cutoverDate?: unknown;
  forecastHandover?: unknown;
};

const day = (v: unknown) =>
  typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : '';
const later = (a: string, b: string) => (a > b ? a : b);

// Landlord and wayleave approval only happen on some orders: counted only while the order is in them.
const CONDITIONAL = new Set<string>(['Awaiting Landlord Approval', 'Awaiting Wayleave Approval']);
const MILESTONES: [Milestone['kind'], 'siteSurvey' | 'installDate' | 'cutoverDate', number][] = [
  ['Survey', 'siteSurvey', PROCESS_STATUSES.indexOf('Site Survey Scheduled')],
  ['Install', 'installDate', PROCESS_STATUSES.indexOf('Install Scheduled')],
  ['Cutover', 'cutoverDate', PROCESS_STATUSES.indexOf('Cutover Scheduled')]
];

export function ganttRow(o: OrderLike, today: string): GanttRow {
  const status = String(o.status ?? '');
  const idx = (PROCESS_STATUSES as readonly string[]).indexOf(status);
  const s = stepState(o, today);
  const stepStart = day(o.statusSince) || null;
  const start = day(o.createdAt) || stepStart || today;
  const stepEnd = s.late || !s.due ? today : s.due;
  const forecast = day(o.forecastHandover);

  let cursor = stepEnd;
  let uncertain = false;
  if (idx >= 0 && status !== 'Complete') {
    if (STEP_RULES[status as keyof typeof STEP_RULES].kind === 'waiting') uncertain = true;
    for (const next of PROCESS_STATUSES.slice(idx + 1, -1)) {
      if (CONDITIONAL.has(next)) continue;
      const rule = STEP_RULES[next];
      if (rule.kind === 'days') cursor = addWorkingDays(cursor, rule.max);
      else if (rule.kind === 'date') cursor = later(cursor, day(o[rule.field]));
      else uncertain = true;
    }
  }

  const milestones: Milestone[] = MILESTONES.flatMap(([kind, field, at]) => {
    const date = day(o[field]);
    return date ? [{ kind, date, done: idx > at }] : [];
  });
  const end = later(start, forecast || cursor);
  milestones.push({
    kind: 'Handover',
    date: end,
    done: idx >= PROCESS_STATUSES.length - 2
  });

  return {
    start,
    stepStart,
    stepEnd,
    late: s.late,
    due: s.due,
    end,
    estimated: !forecast,
    uncertain: !forecast && uncertain,
    offJourney: idx < 0,
    milestones
  };
}
