import 'server-only';
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import {
  BOARDS,
  CLOSED_GROUPS,
  EDITABLE_FIELDS,
  MONEY_FIELDS,
  ORDER_FIELDS,
  STATUS_REQUIRES,
  boardFor,
  getBoard,
  isBoardId,
  withStoreCode,
  type BoardId,
  type Order,
  type OrderField
} from './tracker-fields';
import { followUpState, nextFollowUp, todayZA } from './working-days';

const DB_PATH = process.env.TRACKER_DB_PATH ?? path.join(process.cwd(), 'data', 'tracker.db');

const g = globalThis as unknown as { __trackerDb?: DatabaseSync };
function db(): DatabaseSync {
  if (!g.__trackerDb) {
    const d = new DatabaseSync(DB_PATH);
    migrate(d);
    g.__trackerDb = d;
  }
  return g.__trackerDb;
}

/** Bring a database built by an older importer up to date: add missing columns, fill in each order's board. */
function migrate(d: DatabaseSync) {
  const have = new Set(
    (d.prepare('PRAGMA table_info(orders)').all() as { name: string }[]).map((c) => c.name)
  );
  const missing = ORDER_FIELDS.filter((f) => !have.has(f));
  if (missing.length === 0) return;
  d.exec('BEGIN');
  try {
    for (const f of missing) d.exec(`ALTER TABLE orders ADD COLUMN "${f}"`);
    if (missing.includes('board')) {
      const rows = d.prepare('SELECT id, groupName, customer, ref FROM orders').all() as {
        id: string;
        groupName: string | null;
        customer: string | null;
        ref: string | null;
      }[];
      const set = d.prepare('UPDATE orders SET board = ? WHERE id = ?');
      for (const r of rows) set.run(boardFor(r), r.id);
      d.exec('CREATE INDEX IF NOT EXISTS idx_orders_board ON orders(board)');
    }
    d.exec('COMMIT');
  } catch (e) {
    d.exec('ROLLBACK');
    throw e;
  }
}

const SELECT_COLS = ['id', ...ORDER_FIELDS].map((f) => `"${f}"`).join(', ');

// node:sqlite returns rows with a null prototype; Next.js can only pass plain objects to Client Components.
const plain = <T extends object>(row: T): T => ({ ...row });

export function listOrders(board: BoardId): Order[] {
  const rows = db()
    .prepare(`SELECT ${SELECT_COLS} FROM orders WHERE board = ? ORDER BY updatedAt DESC`)
    .all(board) as unknown as Order[];
  return rows.map(plain);
}

export const isOpen = (o: Pick<Order, 'groupName' | 'status'>) =>
  !(CLOSED_GROUPS as readonly string[]).includes(String(o.groupName ?? '')) &&
  o.status !== 'Complete' &&
  o.status !== 'Cancelled';

export type BoardSummary = { id: BoardId; title: string; open: number; followUpsDue: number };

/** Open orders and follow-ups due today or overdue, per board (for the navigation). */
export function boardSummaries(): BoardSummary[] {
  const rows = db()
    .prepare('SELECT board, groupName, status, lastFollowUp, createdAt FROM orders')
    .all() as unknown as Order[];
  const today = todayZA();
  return BOARDS.map((b) => {
    let open = 0,
      followUpsDue = 0;
    for (const o of rows) {
      if (o.board !== b.id || !isOpen(o)) continue;
      open++;
      if (b.followUp) {
        const due = nextFollowUp(o.lastFollowUp as string | null, o.createdAt as string | null);
        if (due && followUpState(due, today) !== 'upcoming') followUpsDue++;
      }
    }
    return { id: b.id, title: b.title, open, followUpsDue };
  });
}

export function getOrder(id: string): Order | undefined {
  const row = db().prepare(`SELECT ${SELECT_COLS} FROM orders WHERE id = ?`).get(id) as unknown as
    | Order
    | undefined;
  return row ? plain(row) : undefined;
}

export type LogEntry = { n: number; orderId: string; at: string; text: string };
export function getLog(id: string): LogEntry[] {
  const rows = db()
    .prepare('SELECT n, orderId, at, text FROM order_log WHERE orderId = ? ORDER BY n DESC')
    .all(id) as unknown as LogEntry[];
  return rows.map(plain);
}

function nowIso() {
  // Johannesburg local time with offset, matching the format of the imported data.
  const d = new Date(Date.now() + 2 * 3600_000);
  return (
    d
      .toISOString()
      .replace('Z', '')
      .replace(/\.\d+$/, '.000') + '+02:00'
  );
}

export class ValidationError extends Error {
  constructor(
    message: string,
    public field?: OrderField
  ) {
    super(message);
  }
}

/** Apply a partial update. Returns the updated order. Throws ValidationError on bad input. */
export function updateOrder(id: string, patch: Record<string, unknown>): Order {
  const current = getOrder(id);
  if (!current) throw new ValidationError('Order not found');

  const changes: Partial<Record<OrderField, string | number | null>> = {};
  for (const [key, raw] of Object.entries(patch)) {
    if (!(EDITABLE_FIELDS as readonly string[]).includes(key))
      throw new ValidationError(`Field not editable: ${key}`);
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
    if (f === 'board' && !isBoardId(v)) throw new ValidationError('Unknown board', f);
    if (f === 'lastFollowUp' && v !== null && !/^\d{4}-\d{2}-\d{2}$/.test(String(v))) {
      throw new ValidationError('Last follow-up must be a date (YYYY-MM-DD)', f);
    }
    if (f === 'status' && !v) throw new ValidationError('Status cannot be empty', f);
    if (v !== current[f]) changes[f] = v;
  }

  // Mr Price boards: a store code is required, and the site name always carries it.
  const finalBoard = String('board' in changes ? changes.board : current.board);
  if (
    getBoard(finalBoard)?.mrp &&
    ('site' in changes || 'storeCode' in changes || 'board' in changes)
  ) {
    const code = String(('storeCode' in changes ? changes.storeCode : current.storeCode) ?? '');
    if (!code) throw new ValidationError('A store code is needed for Mr Price orders', 'storeCode');
    const site = withStoreCode(
      String(('site' in changes ? changes.site : current.site) ?? ''),
      code
    );
    if (site !== current.site) changes.site = site;
    else delete changes.site;
  }
  const keys = Object.keys(changes) as OrderField[];
  if (keys.length === 0) return current;

  // A status change needs its date/serial to be filled in (either already, or in the same save).
  if (changes.status) {
    const req = STATUS_REQUIRES[String(changes.status)];
    if (req) {
      const val = req.field in changes ? changes[req.field] : current[req.field];
      if (val === null || val === undefined || val === '') {
        throw new ValidationError(
          `${req.label} is needed before the status can be "${changes.status}"`,
          req.field
        );
      }
    }
  }

  const at = nowIso();
  const d = db();
  d.exec('BEGIN');
  try {
    const sets = [...keys, 'updatedAt' as OrderField].map((k) => `"${k}" = ?`).join(', ');
    d.prepare(`UPDATE orders SET ${sets} WHERE id = ?`).run(
      ...keys.map((k) => changes[k] ?? null),
      at,
      id
    );
    const log = d.prepare('INSERT INTO order_log (orderId, at, text) VALUES (?, ?, ?)');
    for (const k of keys) {
      if (k === 'status')
        log.run(id, at, `Status changed from ${current.status ?? '(none)'} to ${changes.status}`);
      else
        log.run(
          id,
          at,
          `${k} changed from ${current[k] ?? '(empty)'} to ${changes[k] ?? '(empty)'}`
        );
    }
    d.exec('COMMIT');
  } catch (e) {
    d.exec('ROLLBACK');
    throw e;
  }
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
  } catch (e) {
    d.exec('ROLLBACK');
    throw e;
  }
}

export function createOrder(init: {
  board: BoardId;
  customer: string;
  site?: string;
  groupName: string;
  storeCode?: string;
}): Order {
  const board = getBoard(init.board);
  if (!board) throw new ValidationError('Unknown board', 'board');
  const storeCode = init.storeCode?.trim() || null;
  if (board.mrp && !storeCode)
    throw new ValidationError('A store code is needed for Mr Price orders', 'storeCode');
  const site = board.mrp ? withStoreCode(init.site, storeCode) : init.site?.trim() || null;
  const d = db();
  const at = nowIso();
  const id = 'n' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  d.exec('BEGIN');
  try {
    d.prepare(
      'INSERT INTO orders (id, board, customer, site, storeCode, groupName, status, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(
      id,
      board.id,
      init.customer,
      site,
      storeCode,
      init.groupName,
      'Awaiting Internal Approval',
      at,
      at
    );
    d.prepare('INSERT INTO order_log (orderId, at, text) VALUES (?, ?, ?)').run(
      id,
      at,
      `Order created in ${board.title} · ${init.groupName}`
    );
    d.exec('COMMIT');
  } catch (e) {
    d.exec('ROLLBACK');
    throw e;
  }
  return getOrder(id)!;
}

/** Record a follow-up made today; the next one is then due FOLLOW_UP_WORKING_DAYS working days later. */
export function recordFollowUp(id: string, note?: string): Order {
  const current = getOrder(id);
  if (!current) throw new ValidationError('Order not found');
  const at = nowIso();
  const d = db();
  d.exec('BEGIN');
  try {
    d.prepare('UPDATE orders SET lastFollowUp = ?, updatedAt = ? WHERE id = ?').run(
      todayZA(),
      at,
      id
    );
    const text = note?.trim() ? `Followed up: ${note.trim()}` : 'Followed up';
    d.prepare('INSERT INTO order_log (orderId, at, text) VALUES (?, ?, ?)').run(id, at, text);
    d.exec('COMMIT');
  } catch (e) {
    d.exec('ROLLBACK');
    throw e;
  }
  return getOrder(id)!;
}
