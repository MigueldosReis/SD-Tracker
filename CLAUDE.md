# CLAUDE.md

## SD Tracker (this project)

Service delivery tracker for Firstnet connectivity orders, built to replace the monday.com boards. Read `README-TRACKER.md` first.

- **Tracker routes live in `src/app/(tracker)/`** (own root layout, no Clerk). The starter pages live in `src/app/(starter)/` and still need Clerk keys. `src/proxy.ts` excludes `/orders` and `/api/tracker` from Clerk.
- **Data**: SQLite via the built-in `node:sqlite` (Node 22.5+). Database file `data/tracker.db`, rebuilt from `data/seed.json` with `node scripts/import-orders.mjs`. All database access goes through `src/lib/tracker-db.ts` (server only). `node:sqlite` returns null-prototype rows: always convert to plain objects before passing to Client Components.
- **Fields and rules** (statuses, editable fields, status prerequisites, group order) are in `src/lib/tracker-fields.ts`. Change them there, not in the UI.
- **UI** is in `src/features/tracker/`. Status colours come from `status-style.ts` (solid, one distinct colour per status).
- **Product rules**: 16-step delivery process; legacy statuses stay as they are; MRP (Mr Price) orders are NOT shown on the Orders page (separate board, not built yet); every MRP site name carries its store code.
- **Still to build**: MRP Project Orders, MRP New Stores, Feasibility, Dual Supplier and Landlord Approval boards (follow-up every 3 working days, skipping weekends and ZA public holidays), Gantt/calendar views, later layers of the source data (`update-*.json`), Postgres/Supabase, replacing Clerk.
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
