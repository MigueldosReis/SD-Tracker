// Built-in automations: changes the tracker makes for you when you edit an order.
// monday.com users build these as "when X, then Y" recipes; here they are part of the delivery rules.
// Pure: given the order and the edit, returns the extra changes and a note for the activity log.
import { CLOSED_GROUPS, getBoard, type Order, type OrderField } from './tracker-fields';

export type Automation = { id: string; title: string; when: string; action: string };

export const AUTOMATIONS: readonly Automation[] = [
  {
    id: 'close-group',
    title: 'File finished orders',
    when: 'The status changes to Complete or Cancelled',
    action: 'Move the order to the Completed or Cancelled group'
  },
  {
    id: 'reopen-group',
    title: 'Reopen orders',
    when: 'A Completed or Cancelled order gets an open status again',
    action: "Move it back to its board's main group"
  },
  {
    id: 'date-advances',
    title: 'Booking a date moves the order on',
    when: 'A survey, install or cutover date is filled in while the order is waiting for it',
    action: 'Set the status to Site Survey Scheduled, Install Scheduled or Cutover Scheduled'
  },
  {
    id: 'status-follow-up',
    title: 'Progress counts as a follow-up',
    when: 'The status changes on a board with follow-ups',
    action: 'Record today as the last follow-up, so the next one is due in 3 working days'
  },
  {
    id: 'owner-on-create',
    title: 'New orders get an owner',
    when: 'Someone adds an order',
    action: 'Make the person adding it the owner (from "Posting as")'
  }
];

type Value = string | number | null;
type Changes = Partial<Record<OrderField, Value>>;
export type AutomationResult = { extra: Changes; notes: string[] };

/** When a date is booked while the order waits for it, the status moves on. */
const DATE_ADVANCES: { field: OrderField; from: string; to: string; label: string }[] = [
  {
    field: 'siteSurvey',
    from: 'Awaiting Site Survey',
    to: 'Site Survey Scheduled',
    label: 'site survey date'
  },
  {
    field: 'installDate',
    from: 'Awaiting Install Dates',
    to: 'Install Scheduled',
    label: 'install date'
  },
  {
    field: 'cutoverDate',
    from: 'Cutover to be Scheduled',
    to: 'Cutover Scheduled',
    label: 'cutover date'
  }
];

const CLOSED = CLOSED_GROUPS as readonly string[];
const note = (id: string, text: string) =>
  `Automation (${AUTOMATIONS.find((a) => a.id === id)!.title}): ${text}`;

/** Extra changes the automations make for an edit. Explicit choices in the edit always win. */
export function automate(current: Order, changes: Changes, today: string): AutomationResult {
  const extra: Changes = {};
  const notes: string[] = [];
  const has = (f: OrderField) => f in changes;
  const now = (f: OrderField) => (has(f) ? changes[f] : f in extra ? extra[f] : current[f]);

  // Booking a date moves the order on (only when the status is not being set in the same edit).
  if (!has('status')) {
    for (const r of DATE_ADVANCES) {
      if (has(r.field) && changes[r.field] && current.status === r.from) {
        extra.status = r.to;
        notes.push(
          note('date-advances', `status set to ${r.to} because the ${r.label} was filled in`)
        );
        break;
      }
    }
  }

  const status = String(now('status') ?? '');
  const statusChanged = status !== String(current.status ?? '');
  const group = String(now('groupName') ?? '');
  const board = getBoard(String(now('board') ?? 'orders'));

  if (statusChanged && !has('groupName')) {
    const target =
      status === 'Complete' ? 'Completed' : status === 'Cancelled' ? 'Cancelled' : null;
    if (target && group !== target) {
      extra.groupName = target;
      notes.push(note('close-group', `moved to ${target} because the status is ${status}`));
    } else if (!target && CLOSED.includes(group) && board) {
      const home = board.view ? getBoard(board.view.source)?.groups[0] : board.groups[0];
      if (home) {
        extra.groupName = home;
        notes.push(note('reopen-group', `moved back to ${home} because the status is ${status}`));
      }
    }
  }

  if (
    statusChanged &&
    board?.followUp &&
    !has('lastFollowUp') &&
    !['Complete', 'Cancelled'].includes(status)
  ) {
    extra.lastFollowUp = today;
    notes.push(note('status-follow-up', "status change recorded as today's follow-up"));
  }

  return { extra, notes };
}
