// Usage: node scripts/import-orders.mjs [path/to/seed.json]
// Rebuilds data/tracker.db from the exported tracker data. Safe to re-run: it replaces the database.
// data/seed.json holds real customer data and is NOT committed (see .gitignore). Without it, the
// fictional data/seed.sample.json is used so the app still runs from a fresh clone.
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, rmSync, mkdirSync, existsSync } from 'node:fs';
import { ORDER_FIELDS } from '../src/lib/tracker-fields.ts';

const src = process.argv[2] ?? (existsSync('data/seed.json') ? 'data/seed.json' : 'data/seed.sample.json');
console.log(`importing from ${src}`);
const rows = JSON.parse(readFileSync(src, 'utf8'));
mkdirSync('data', { recursive: true });
rmSync('data/tracker.db', { force: true });
const db = new DatabaseSync('data/tracker.db');

const cols = ORDER_FIELDS.map((f) => `"${f}"`).join(', ');
db.exec(`
  CREATE TABLE orders (id TEXT PRIMARY KEY, ${cols});
  CREATE TABLE order_log (n INTEGER PRIMARY KEY AUTOINCREMENT, orderId TEXT NOT NULL, at TEXT NOT NULL, text TEXT NOT NULL);
  CREATE INDEX idx_orders_group ON orders(groupName);
  CREATE INDEX idx_orders_status ON orders(status);
  CREATE INDEX idx_log_order ON order_log(orderId);
`);

// The source data calls the group "group"; "group" is a reserved word in SQL, so we store it as groupName.
const ins = db.prepare(`INSERT INTO orders (id, ${cols}) VALUES (?, ${ORDER_FIELDS.map(() => '?').join(', ')})`);
const insLog = db.prepare('INSERT INTO order_log (orderId, at, text) VALUES (?, ?, ?)');
let n = 0, logs = 0;
db.exec('BEGIN');
for (const r of rows) {
  const rec = { ...r, groupName: r.group };
  ins.run(r.id, ...ORDER_FIELDS.map((f) => (rec[f] === undefined ? null : rec[f])));
  for (const l of r.log ?? []) { insLog.run(r.id, l.at, l.text); logs++; }
  n++;
}
db.exec('COMMIT');
const count = db.prepare('SELECT COUNT(*) c FROM orders').get().c;
console.log(`imported ${n} orders, ${logs} log entries; db has ${count} orders`);
if (count !== rows.length) { console.error('COUNT MISMATCH'); process.exit(1); }
