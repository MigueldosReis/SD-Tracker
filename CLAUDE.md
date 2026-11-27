# CLAUDE.md

## SD Tracker (this project)

Service delivery tracker for Firstnet connectivity orders, built to replace the monday.com boards. Read `README-TRACKER.md` first.

- **Tracker routes live in `src/app/(tracker)/`** (own root layout, no Clerk): `/orders`, `/boards/[board]` and `/my-work`, API under `/api/tracker`. The starter pages live in `src/app/(starter)/` and still need Clerk keys. `src/proxy.ts` excludes `/orders`, `/boards`, `/my-work` and `/api/tracker` from Clerk.
- **Data**: SQLite via the built-in `node:sqlite` (Node 22.5+). Database file `data/tracker.db`, rebuilt from `data/seed.json` (real customer data, git-ignored; falls back to the fictional `data/seed.sample.json`) with `node scripts/import-orders.mjs`. `tracker-db.ts` adds any missing columns to an older database on first use. All database access goes through `src/lib/tracker-db.ts` (server only). `node:sqlite` returns null-prototype rows: always convert to plain objects before passing to Client Components.
- **Team (staff names)**: `data/team.json`, git-ignored (public repo), read on the server by `src/lib/team.ts` and passed to components through `TeamProvider` / `useTeam()` (`src/features/tracker/team-context.tsx`). Never hard-code staff names in code, tests or docs; tests use the fictional names in `data/team.sample.json`.
- **Fields and rules** (statuses, editable fields, status prerequisites, boards and their groups, which board an order belongs on) are in `src/lib/tracker-fields.ts`. Change them there, not in the UI. Each order has a `board` column. Landlord Approval is a view board (`view` in `BoardDef`): MRP Project Orders in a `LANDLORD_STATUSES` status; use `belongsTo()` for board membership, `STORED_BOARDS` for where orders can live.
- **Delivery journey**: `src/lib/journey.ts` holds the usual working days per step and `stepState()` (late or not); `statusSince` comes from the activity log in `tracker-db.ts`. Updates (comments) live in the `order_updates` table.
- **My work / reminders**: `src/lib/attention.ts` (what needs action per order, @mentions; tested). Page at `src/app/(tracker)/my-work`.
- **Follow-ups**: `src/lib/working-days.ts` (3 working days, skipping weekends and ZA public holidays; tested with `bun test`). Boards with `followUp: true` show the next follow-up date.
- **UI** is in `src/features/tracker/`, built from the project's shadcn/ui (Base UI) components: `tracker-shell.tsx` (sidebar + header), `orders-board.tsx` (summary cards, toolbar, grouped tables), `order-sheet.tsx` (detail panel), `status-controls.tsx`, helpers in `shared.ts`. Filters and the open order are kept in the URL with nuqs (`?q=&status=&due=&order=`). Status colours come from `status-style.ts` (solid, one distinct colour per status). Base UI menus stay open after a radio pick unless the item has `closeOnClick`.
- **Product rules**: 16-step delivery process; legacy statuses stay as they are; MRP (Mr Price) orders are NOT shown on the Orders page (they live on the MRP boards); every MRP site name carries its store code (enforced in `tracker-db.ts`).
- **Roadmap**: `docs/roadmap.md`.
- **Artifact**: the live team tool is the claude.ai artifact "Connectivity Order Tracking"; keep its features in step with the app.
- **Gantt**: `src/lib/gantt.ts` (bar and handover estimate per order from the journey rules; tested) and `src/features/tracker/gantt-view.tsx` (`?view=gantt&zoom=`). Boards with `noTimeline` (MRP Project Orders, Landlord Approval) have no Gantt.
- **Still to build**: notifications, later layers of the source data (`update-*.json`), Postgres/Supabase, replacing Clerk.
- Run: `bun install`, `node scripts/import-orders.mjs`, `bun dev`, open `/orders`. If `bun dev` stops on an upgrade notice, run it again.

---

This is a Next.js 16 + shadcn/ui admin dashboard starter kit.

## Key References

- **[AGENTS.md](./AGENTS.md)** — Full project overview, tech stack, structure, conventions, data fetching patterns, deployment
- **[docs/forms.md](./docs/forms.md)** — Form system: TanStack Form + Zod, composable fields, validation, multi-step, sheet/dialog forms
- **[docs/themes.md](./docs/themes.md)** — Theme system: OKLCH colors, adding themes, font config
- **[docs/nav-rbac.md](./docs/nav-rbac.md)** — Navigation RBAC: access control, Clerk integration
- **[docs/clerk_setup.md](./docs/clerk_setup.md)** — Clerk auth setup: organizations, billing, environment variables
- **[docs/deployment.md](./docs/deployment.md)** — Deployment: Vercel, production environment variables, Docker

## Critical Conventions

- **React Query** for all data fetching — `void queryClient.query(...).catch(noop)` on server (`prefetchQuery` is deprecated) + `useSuspenseQuery` on client (standard TanStack pattern), `useMutation` for forms, `HydrationBoundary` + `dehydrate` for hydration, `<Suspense fallback>` for streaming
- **API layer** per feature — `api/types.ts` → `api/service.ts` → `api/queries.ts`; `queries.ts` exports `entityQueries` (keys + `queryOptions`) and `entityMutations` (`mutationFn` only); components invalidate in `onSettled`; components import from service and queries, never from mock APIs directly
- **nuqs** for URL search params — `searchParamsCache` on server, `useQueryStates` on client, use `getSortingStateParser` for sort (same parser as `useDataTable`)
- **Icons** — only import from `@/components/icons`, never from `@tabler/icons-react` directly
- **Forms** — `useAppForm` from `@/lib/form` (TanStack `createFormHook`) + `form.AppField` rendering the field components in `@/components/forms/fields` (`field.TextField`, `field.SelectField`, …); each component is the shadcn TanStack Form doc anatomy; raw `form.Field` for one-off custom fields; form-level Zod `onSubmit` validators
- **Page headers** — use `PageContainer` props (`pageTitle`, `pageDescription`, `pageHeaderAction`), never import `<Heading>` manually
- **Formatting** — single quotes, JSX single quotes, no trailing comma, 2-space indent
