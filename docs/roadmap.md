# SD Tracker roadmap: a better monday.com for service delivery

monday.com is a general-purpose work board. SD Tracker is built for one job, getting connectivity orders
from quote to handover, so it can do that job better than a configurable board.

## What monday.com does well (research, November 2026)

- Boards as tables, with many column types; several **views** of one board (table, Kanban, calendar,
  Gantt/timeline) and **dashboards** across boards.
- **Updates** (a conversation per item) with mentions and files.
- No-code **automations** ("when status changes to X, notify Y"), across boards and other tools.
- AI summaries and suggested automations (credit-based since May 2026).

## What its users complain about

- Automations are hard to set up and limited in places (e.g. on subitems); features feel half finished.
- Occasional slowness; reporting widgets are limited.
- The mobile app has less than the desktop.
- Useful features (automations, timeline/Gantt, integrations) are gated by plan; pricing is per seat.

Sources: G2 review (learn.g2.com/monday-review), Capterra reviews (capterra.com/p/147657/monday-com/reviews),
TrustRadius reviews, ClickUp's monday.com review, monday.com support docs.

## Where SD Tracker is already better

| Need | monday.com | SD Tracker |
| --- | --- | --- |
| Status rules (e.g. no "Install Scheduled" without an install date) | Build an automation or rely on discipline | Built in, enforced on every edit, bulk change and Kanban drag |
| Is this order late? | Formula columns and automations per board | Built in: usual working days per delivery step, booked dates that passed |
| Follow-ups every 3 working days | Date automations; no South African holidays | Built in, skips weekends and SA public holidays (Easter, Sunday-to-Monday rule) |
| Mr Price store codes in site names | Manual | Enforced automatically |
| Landlord approval list | Separate board kept in sync by hand | A live view of MRP Project Orders in landlord approval |
| Views | Table, Kanban, Calendar (Gantt on paid plans) | Table, Kanban (by delivery step), Calendar |
| Cost | Per seat, features by plan | No seats, no plans |

## Shipped

- Boards: Orders, MRP New Stores, MRP Project Orders, Landlord Approval (view), Feasibility, Dual Supplier.
- Table, Kanban and Calendar views; filters and view kept in the address bar.
- Updates on every order; activity log of every change.
- Late-for-step flags with the 16-step journey bar on each order.
- Bulk status / owner / group / delete, with the same rules as single edits.
- Follow-ups every 3 working days on follow-up boards.

## Next

1. **Notifications and a "My work" page**: orders I own that are late, follow-ups due today, updates on my orders.
2. **Simple automations without the setup**: e.g. when an order reaches Handover Sent, remind the owner to
   mark it Complete after 2 working days; when Install Scheduled is set, add the install to the calendar feed.
3. **Mentions in updates** (`@Jordan`) and file attachments (COFs, landlord documents, handover packs).
4. **Overview dashboard across boards**: open orders by step and supplier, late orders by who to chase,
   average days per step (from the activity log).
5. **Chase list**: late orders grouped by supplier with a copy-ready email, as in the current artifact.
6. **Apply the `update-*.json` data layers** from the original tracker.
7. **Sign-in and real users** (replace Clerk or set its keys), then **Postgres/Supabase** for a shared database.
8. **Gantt/timeline** for install programmes (Mr Price new-store roll-outs).
