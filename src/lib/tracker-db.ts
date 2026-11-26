import 'server-only';
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import {
  EDITABLE_FIELDS, EXCLUDED_GROUPS, MONEY_FIELDS, ORDER_FIELDS, STATUS_REQUIRES,
  type Order, type OrderField
} from './tracker-fields';

const DB_PATH = process.env.TRACKER_DB_PATH ?? path.join(process.cwd(), 'data', 'tracker.db');

const g = globalThis as unknown as { __trackerDb?: DatabaseSync };
function db(): DatabaseSync {
  if (!g.__trackerDb) g.__trackerDb = new DatabaseSync(DB_PATH);
  return g.__trackerDb;
}

const SELECT_COLS = ['id', ...ORDER_FIELDS].map((f) => `"${f}"`).join(', ');

// node:sqlite returns rows with a null prototype; Next.js can only pass plain objects to Client Components.
const plain = <T extends object>(row: T): T => ({ ...row });

export function listOrders(): Order[] {
  const marks = EXCLUDED_GROUPS.map(() => '?').join(', ');
  const rows = db()
    .prepare(`SELECT ${SELECT_COLS} FROM orders WHERE groupName NOT IN (${marks}) ORDER BY updatedAt DESC`)
    .all(...EXCLUDED_GROUPS) as unknown as Order[];
  return rows.map(plain);
}

export function getOrder(id: string): Order | undefined {
  const row = db().prepare(`SELECT ${SELECT_COLS} FROM orders WHERE id = ?`).get(id) as unknown as Order | undefined;
  return row ? plain(row) : undefined;
}

export type LogEntry = { n: number; orderId: string; at: string; text: string };
export function getLog(id: string): LogEntry[] {
  const rows = db().prepare('SELECT n, orderId, at, text FROM order_log WHERE orderId = ? ORDER BY n DESC').all(id) as unknown as LogEntry[];
  return rows.map(plain);
}

function nowIso() {
  // Johannesburg local time with offset, matching the format of the imported data.
  const d = new Date(Date.now() + 2 * 3600_000);
  return d.toISOString().replace('Z', '').replace(/\.\d+$/, '.000') + '+02:00';
}

export class ValidationError extends Error {
  constructor(message: string, public field?: OrderField) { super(message); }
}

/** Apply a partial update. Returns the updated order. Throws ValidationError on bad input. */
export function updateOrder(id: string, patch: Record<string, unknown>): Order {
  const current = getOrder(id);
  if (!current) throw new ValidationError('Order not found');

  const changes: Partial<Record<OrderField, string | number | null>> = {};
  for (const [key, raw] of Object.entries(patch)) {
    if (!(EDITABLE_FIELDS as readonly string[]).includes(key)) throw new ValidationError(`Field not editable: ${key}`);
    const f = key as OrderField;
    let v: string | number | null;
    if (raw === null || raw === '' || raw === undefined) v = null;
    else if ((MONEY_FIELDS as readonly string[]).includes(f)) {
      const num = typeof raw === 'number' ? raw : Number(String(raw).replace(/[ ,]/g, ''));
      if (!Number.isFinite(num)) throw new ValidationError(`${f} must be a number`, f);
      v = num;
    } else if (typeof raw === 'string') v = raw.trim();
    else throw new ValidationError(`${f} must be text`, f);
    if (f === 'groupName' && !v) throw new ValidationError('Group cannot be empty', f);
    if (f === 'status' && !v) throw new ValidationError('Status cannot be empty', f);
    if (v !== current[f]) changes[f] = v;
  }
  const keys = Object.keys(changes) as OrderField[];
  if (keys.length === 0) return current;

  // A status change needs its date/serial to be filled in (either already, or in the same save).
  if (changes.status) {
    const req = STATUS_REQUIRES[String(changes.status)];
    if (req) {
      const val = req.field in changes ? changes[req.field] : current[req.field];
      if (val === null || val === undefined || val === '') {
        throw new ValidationError(`${req.label} is needed before the status can be "${changes.status}"`, req.field);
      }
    }
  }

  const at = nowIso();
  const d = db();
  d.exec('BEGIN');
  try {
    const sets = [...keys, 'updatedAt' as OrderField].map((k) => `"${k}" = ?`).join(', ');
    d.prepare(`UPDATE orders SET ${sets} WHERE id = ?`).run(...keys.map((k) => changes[k] ?? null), at, id);
    const log = d.prepare('INSERT INTO order_log (orderId, at, text) VALUES (?, ?, ?)');
    for (const k of keys) {
      if (k === 'status') log.run(id, at, `Status changed from ${current.status ?? '(none)'} to ${changes.status}`);
      else log.run(id, at, `${k} changed from ${current[k] ?? '(empty)'} to ${changes[k] ?? '(empty)'}`);
    }
    d.exec('COMMIT');
  } catch (e) { d.exec('ROLLBACK'); throw e; }
  return getOrder(id)!;
}

export function deleteOrder(id: string): boolean {
  const d = db();
  d.exec('BEGIN');
  try {
    d.prepare('DELETE FROM order_log WHERE orderId = ?').run(id);
    const r = d.prepare('DELETE FROM orders WHERE id = ?').run(id);
    d.exec('COMMIT');
    return Number(r.changes) > 0;
  } catch (e) { d.exec('ROLLBACK'); throw e; }
}

export function createOrder(init: { customer: string; site?: string; groupName: string }): Order {
  const d = db();
  const at = nowIso();
  const id = 'n' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  d.exec('BEGIN');
  try {
    d.prepare('INSERT INTO orders (id, customer, site, groupName, status, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(id, init.customer, init.site ?? null, init.groupName, 'Awaiting Internal Approval', at, at);
    d.prepare('INSERT INTO order_log (orderId, at, text) VALUES (?, ?, ?)').run(id, at, `Order created in ${init.groupName}`);
    d.exec('COMMIT');
  } catch (e) { d.exec('ROLLBACK'); throw e; }
  return getOrder(id)!;
}
