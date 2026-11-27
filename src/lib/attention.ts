// What needs someone's attention today: the reminders a monday.com user would have to build as automations.
// Pure functions, shared by the My work page and its tests.
import { STEP_RULES, stepState } from './journey';
import { CLOSED_GROUPS, getBoard, type Order } from './tracker-fields';
import { addWorkingDays, followUpState, nextFollowUp, workingDaysBetween } from './working-days';

export type AttentionKind =
  | 'close'
  | 'date-passed'
  | 'late'
  | 'documents'
  | 'follow-up'
  | 'this-week';

export type AttentionItem = {
  kind: AttentionKind;
  orderId: string;
  board: string;
  /** What the reminder is about, e.g. "Install date has passed (20 Nov)". */
  detail: string;
  /** Sort key: most urgent first (bigger = more urgent). */
  urgency: number;
  /** When the thing is due or happens (YYYY-MM-DD), if relevant. */
  date?: string;
  /** A one-click fix the reminder offers, e.g. mark the order Complete. */
  action?: { label: string; patch: Record<string, string> };
};

export const KIND_LABEL: Record<AttentionKind, string> = {
  close: 'Ready to close',
  'date-passed': 'Booked date passed',
  late: 'Late for their step',
  documents: 'Documents outstanding',
  'follow-up': 'Follow-ups due',
  'this-week': 'Coming up this week'
};
export const KIND_ORDER: AttentionKind[] = [
  'close',
  'date-passed',
  'late',
  'documents',
  'follow-up',
  'this-week'
];

const isOpenOrder = (o: Order) =>
  !(CLOSED_GROUPS as readonly string[]).includes(String(o.groupName ?? '')) &&
  o.status !== 'Complete' &&
  o.status !== 'Cancelled';

const dayOf = (v: unknown) =>
  typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : '';

/** Paperwork that should come back within a few working days. */
export const DOC_CHASES = [
  {
    sent: 'cofRequested',
    back: 'cofReceived',
    days: 3,
    label: 'COF requested from the supplier',
    missing: 'not received yet'
  },
  {
    sent: 'coverRequested',
    back: 'coverReceived',
    days: 3,
    label: 'Cover page requested',
    missing: 'not received yet'
  },
  {
    sent: 'landlordSentClient',
    back: 'landlordSignedFirstnet',
    days: 5,
    label: 'Landlord documents sent to the client',
    missing: 'not signed yet'
  }
] as const;

const DATE_FIELDS = [
  ['siteSurvey', 'Site survey'],
  ['installDate', 'Install'],
  ['cutoverDate', 'Cutover']
] as const;

/** Reminders for one open order (an order can need more than one thing). */
export function attentionFor(o: Order, today: string): AttentionItem[] {
  if (!isOpenOrder(o)) return [];
  const board = String(o.board ?? 'orders');
  const def = getBoard(board);
  const out: AttentionItem[] = [];
  const step = stepState(o, today);
  const status = String(o.status ?? '');
  const rule = STEP_RULES[status as keyof typeof STEP_RULES];

  if (step.late && status === 'Handover Sent') {
    out.push({
      kind: 'close',
      orderId: o.id,
      board,
      urgency: 1000 + step.daysLate,
      detail: `Handover sent ${step.daysInStep} working days ago; the customer's 2 days to confirm have passed`,
      action: { label: 'Mark Complete', patch: { status: 'Complete' } }
    });
  } else if (step.late && rule?.kind === 'date') {
    out.push({
      kind: 'date-passed',
      orderId: o.id,
      board,
      urgency: 800 + step.daysLate,
      date: step.due ?? undefined,
      detail: `${rule.label} ${step.due} has passed; move the status on or rebook the date`
    });
  } else if (step.late) {
    out.push({
      kind: 'late',
      orderId: o.id,
      board,
      urgency: 600 + step.daysLate,
      detail: `${status}: ${step.summary}`
    });
  }

  // Documents that went out and have not come back.
  for (const d of DOC_CHASES) {
    const sent = dayOf(o[d.sent]);
    if (!sent || dayOf(o[d.back])) continue;
    const waited = workingDaysBetween(sent, today);
    if (waited > d.days) {
      out.push({
        kind: 'documents',
        orderId: o.id,
        board,
        urgency: 500 + waited,
        date: sent,
        detail: `${d.label} ${waited} working days ago, ${d.missing}`
      });
    }
  }

  if (def?.followUp) {
    const due = nextFollowUp(o.lastFollowUp as string | null, o.createdAt as string | null);
    if (due && followUpState(due, today) !== 'upcoming') {
      out.push({
        kind: 'follow-up',
        orderId: o.id,
        board,
        urgency: 400 + (due < today ? 1 : 0),
        date: due,
        detail: due < today ? `Follow-up was due ${due}` : 'Follow-up due today'
      });
    }
  }

  const weekEnd = addWorkingDays(today, 5);
  for (const [field, label] of DATE_FIELDS) {
    const d = typeof o[field] === 'string' ? (o[field] as string).slice(0, 10) : '';
    if (d && d >= today && d <= weekEnd) {
      out.push({
        kind: 'this-week',
        orderId: o.id,
        board,
        urgency: 100,
        date: d,
        detail: `${label} ${d === today ? 'today' : d}`
      });
    }
  }
  return out;
}

/** Reminders for everyone's orders, grouped by kind, most urgent first. `owner` null means unassigned orders. */
export function attentionList(
  orders: Order[],
  today: string,
  owner?: string | null
): AttentionItem[] {
  return orders
    .filter((o) => owner === undefined || (owner === null ? !o.owner : o.owner === owner))
    .flatMap((o) => attentionFor(o, today))
    .toSorted(
      (a, b) =>
        KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) ||
        b.urgency - a.urgency ||
        (a.date ?? '').localeCompare(b.date ?? '')
    );
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Team members mentioned in an update, e.g. "@Alex" or "@Alex Mokoena" (first names are unique on the team). */
export function mentions(text: string, people: readonly string[]): string[] {
  return people.filter((p) => {
    const [first, ...rest] = p.split(' ');
    const re = new RegExp(
      `(^|[^\\w@])@${escapeRe(first)}(\\s+${escapeRe(rest.join(' '))})?(?![\\w])`,
      'i'
    );
    return re.test(text);
  });
}
