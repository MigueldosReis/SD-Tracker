# SD Tracker

Interactive service delivery tracker, started from the MIT-licensed `Kiranism/next-shadcn-dashboard-starter`.

## Run
    bun install
    node scripts/import-orders.mjs   # builds data/tracker.db from data/seed.json
    bun dev                          # then open http://localhost:3000/orders

## What works now
- Six boards, with tabs at the top showing open orders and follow-ups due:
  - **Orders** (`/orders`): customer orders, grouped by customer.
  - **MRP New Stores** and **MRP Project Orders** (`/boards/mrp-new-stores`, `/boards/mrp-projects`): every Mr Price Group order, including finished ones, lives here and not on Orders. A store code is required, and the store name always carries it (added automatically).
  - **Feasibility**, **Dual Supplier**, **Landlord Approval** (`/boards/feasibility`, `/boards/dual-supplier`, `/boards/landlord-approval`).
- Follow-ups (all boards except Orders): each open order is due a follow-up 3 working days after the last one (or after it was created), skipping weekends and South African public holidays. Overdue dates are red, today's are amber. "Done" in the row, or "Followed up today" with a note in the side panel, records it in the activity log. "Follow-ups due" filters to what needs chasing.
- Every board: solid status colours, search and status filter, inline status change, side panel with all fields and an activity log, add, delete and move orders between boards.
- Rules: a status such as "Install Scheduled" needs its date filled in first.

## Tests
    bun test     # working-day and public-holiday maths

One-off public holidays (e.g. election days) are not predictable: add them to `EXTRA_HOLIDAYS` in `src/lib/working-days.ts` when they are declared.

## Data
`data/seed.json` is the baseline export (2,232 orders). It contains real customer data, so it is git-ignored and must be copied in by hand. Without it, the importer falls back to `data/seed.sample.json` (12 fictional orders). Imported Mr Price Group orders whose reference says "new store" go to MRP New Stores, the rest to MRP Project Orders. Older `tracker.db` files are upgraded automatically on first use. Later updates from the original tracker (`update-2026-11-26.json` and others) have NOT been applied yet.
