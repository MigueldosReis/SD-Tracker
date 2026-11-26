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
  - **Landlord Approval** (`/boards/landlord-approval`): only MRP Project Orders whose status is a landlord approval step (Awaiting Landlord Approval, or the legacy Awaiting Landlord Docs statuses). It holds no orders of its own: an order appears when its status moves into landlord approval and leaves when it moves on.
  - **Feasibility**, **Dual Supplier** (`/boards/feasibility`, `/boards/dual-supplier`).
- Follow-ups (all boards except Orders): each open order is due a follow-up 3 working days after the last one (or after it was created), skipping weekends and South African public holidays. Overdue dates are red, today's are amber. "Done" in the row, or "Followed up today" with a note in the side panel, records it in the activity log. "Follow-ups due" filters to what needs chasing.
- Interface: sidebar with every board and its counts (red = follow-ups due), summary cards, light and dark mode, filters kept in the address bar so a view can be bookmarked or shared (e.g. `/boards/mrp-new-stores?due=true`), and a side panel for each order with details, follow-ups and its activity log.
- My work (`/my-work`): pick yourself once; see what needs action across every board (ready to close with one-click Mark Complete, booked dates passed, late steps, follow-ups due, this week's bookings), updates that @mention you, and who on the team has what.
- Views: Table, Kanban (open orders by delivery step; drag a card to change status, rules still apply) and Calendar (booked surveys, installs, cutovers and follow-ups for six weeks, plus booked dates that passed without a status change).
- Late for their step: each of the 16 steps has a usual time in working days (or a booked date); late orders get a red badge, a summary card and a Late filter. Imported orders are only flagged once their status changes here, or when a booked date has passed.
- Updates: a conversation on every order (Updates tab in the side panel), with a count on the row. Type @ and a first name to mention someone.
- Bulk changes: tick rows to set status, owner or group for all of them, or delete them.
- Every board: solid status colours, search and status filter, inline status change, side panel with all fields and an activity log, add, delete and move orders between boards.
- Rules: a status such as "Install Scheduled" needs its date filled in first.

## Tests
    bun test     # working days, public holidays, step deadlines, board rules

One-off public holidays (e.g. election days) are not predictable: add them to `EXTRA_HOLIDAYS` in `src/lib/working-days.ts` when they are declared.

## Data
`data/team.json` lists the service delivery team (owners, update authors, @mentions). It is git-ignored to keep staff names out of the public repository; copy it in by hand like `seed.json`. Without it the fictional `data/team.sample.json` is used.

`data/seed.json` is the baseline export (2,232 orders). It contains real customer data, so it is git-ignored and must be copied in by hand. Without it, the importer falls back to `data/seed.sample.json` (12 fictional orders). Imported Mr Price Group orders whose reference says "new store" go to MRP New Stores, the rest to MRP Project Orders. Older `tracker.db` files are upgraded automatically on first use. Later updates from the original tracker (`update-2026-11-26.json` and others) have NOT been applied yet.

## Roadmap
See `docs/roadmap.md`: research on monday.com, where SD Tracker is already better, and what comes next.
