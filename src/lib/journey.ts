// The 16-step delivery journey: how long each step normally takes, and when an order is late for its step.
// No imports beyond pure helpers, so tests and the importer can use it directly.
import { PROCESS_STATUSES } from './tracker-fields';
import { addWorkingDays, workingDaysBetween } from './working-days';

type StepRule =
  | { kind: 'waiting'; note: string } // depends on someone else: never "late" on time alone
  | { kind: 'days'; min: number; max: number } // usual working days in this status
  | { kind: 'date'; field: 'siteSurvey' | 'installDate' | 'cutoverDate'; label: string }; // late once the booked date passes

/** Expected time per status (working days, weekends and SA public holidays skipped). */
export const STEP_RULES: Record<(typeof PROCESS_STATUSES)[number], StepRule> = {
  'Awaiting Internal Approval': { kind: 'waiting', note: 'Depends on signed quotes' },
  'Order to be Placed': { kind: 'days', min: 0, max: 3 },
  'Order Placed with Supplier': { kind: 'days', min: 7, max: 10 },
  'Awaiting Site Survey': { kind: 'waiting', note: 'Depends on supplier survey availability' },
  'Site Survey Scheduled': { kind: 'date', field: 'siteSurvey', label: 'Survey date' },
  'Awaiting Planning Document': { kind: 'days', min: 5, max: 10 },
  'Awaiting Landlord Approval': { kind: 'waiting', note: 'Depends on the landlord' },
  'Awaiting Wayleave Approval': { kind: 'days', min: 40, max: 60 },
  'Awaiting Install Dates': { kind: 'days', min: 3, max: 5 },
  'Install Scheduled': { kind: 'date', field: 'installDate', label: 'Install date' },
  'Install in Progress': { kind: 'days', min: 21, max: 30 },
  'Awaiting Supplier Handover': { kind: 'days', min: 3, max: 5 },
  'Cutover to be Scheduled': { kind: 'days', min: 0, max: 3 },
  'Cutover Scheduled': { kind: 'date', field: 'cutoverDate', label: 'Cutover date' },
  'Handover Sent': { kind: 'days', min: 0, max: 2 },
  Complete: { kind: 'waiting', note: 'Done' }
};

export type StepState = {
  /** Step number 1-16, or null for statuses outside the journey (legacy, On Hold, Cancelled). */
  step: number | null;
  late: boolean;
  /** Working days late (0 when on time). */
  daysLate: number;
  /** Working days spent in this status so far. */
  daysInStep: number;
  /** When the step is due to be done (YYYY-MM-DD), if the step has a deadline. */
  due: string | null;
  /** Plain-language summary, e.g. "Day 4 of 7-10" or "Install date has passed". */
  summary: string;
};

type OrderLike = {
  status?: unknown;
  statusSince?: unknown;
  siteSurvey?: unknown;
  installDate?: unknown;
  cutoverDate?: unknown;
};

const day = (v: unknown) =>
  typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : '';

/**
 * Where an order stands against its step's usual time. `statusSince` is when it entered its current status
 * (null when unknown, e.g. imported orders whose status has not changed since).
 */
export function stepState(o: OrderLike, today: string): StepState {
  const status = String(o.status ?? '');
  const idx = (PROCESS_STATUSES as readonly string[]).indexOf(status);
  const since = day(o.statusSince);
  const daysInStep = since ? workingDaysBetween(since, today) : 0;
  const none = { late: false, daysLate: 0, due: null };
  if (idx < 0)
    return {
      step: null,
      daysInStep,
      summary: status ? 'Not a journey step' : 'No status',
      ...none
    };
  const rule = STEP_RULES[status as keyof typeof STEP_RULES];
  const step = idx + 1;
  if (status === 'Complete') return { step, daysInStep, summary: 'Delivered', ...none };
  if (rule.kind === 'waiting') {
    return {
      step,
      daysInStep,
      summary: since ? `Day ${daysInStep} (${rule.note.toLowerCase()})` : rule.note,
      ...none
    };
  }
  if (rule.kind === 'date') {
    const date = day(o[rule.field]);
    if (!date) return { step, daysInStep, summary: `No ${rule.label.toLowerCase()} yet`, ...none };
    if (date < today) {
      return {
        step,
        late: true,
        daysLate: workingDaysBetween(date, today),
        daysInStep,
        due: date,
        summary: `${rule.label} has passed`
      };
    }
    return { step, late: false, daysLate: 0, daysInStep, due: date, summary: `Booked for ${date}` };
  }
  // Imported orders have no record of when they entered their status: don't guess, wait for the next change.
  if (!since) return { step, daysInStep, summary: 'Start of this step not recorded', ...none };
  const due = addWorkingDays(since, rule.max);
  const range = rule.min === rule.max ? `${rule.max}` : `${rule.min}-${rule.max}`;
  if (daysInStep > rule.max) {
    return {
      step,
      late: true,
      daysLate: daysInStep - rule.max,
      daysInStep,
      due,
      summary: `${daysInStep} working days, usually ${range}`
    };
  }
  return {
    step,
    late: false,
    daysLate: 0,
    daysInStep,
    due,
    summary: `Day ${daysInStep} of ${range}`
  };
}
