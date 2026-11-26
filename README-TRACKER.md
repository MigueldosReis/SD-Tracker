# SD Tracker

Interactive service delivery tracker, started from the MIT-licensed `Kiranism/next-shadcn-dashboard-starter`.

## Run
    bun install
    node scripts/import-orders.mjs   # builds data/tracker.db from data/seed.json
    bun dev                          # then open http://localhost:3000/orders

## What works now
- Orders board: grouped by customer, solid status colours, search and status filter, inline status change, side panel with all fields and an activity log, add and delete orders.
- Rules: a status such as "Install Scheduled" needs its date filled in first.
- Mr Price store orders are kept off this page.

## Data
`data/seed.json` is the baseline export (2,232 orders). It contains real customer data, so it is git-ignored and must be copied in by hand. Without it, the importer falls back to `data/seed.sample.json` (12 fictional orders). Later updates from the original tracker (`update-2026-11-26.json` and others) have NOT been applied yet.
