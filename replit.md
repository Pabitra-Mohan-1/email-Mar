# Sender — Email Marketing Platform

A Mailchimp/Brevo-style email marketing platform for managing contacts, email campaigns, SMTP accounts, and delivery analytics.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/email-platform run dev` — run the frontend (root `/`)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- Required env secret: `MONGODB_URI` — MongoDB Atlas connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite, TanStack Query, wouter, shadcn/ui, Recharts
- API: Express 5, pino logging
- DB: MongoDB + Mongoose (NOT PostgreSQL — the `lib/db` package is unused)
- Validation: Zod, Orval codegen from OpenAPI spec
- Build: esbuild (ESM bundle)

## Where things live

- `lib/api-spec/openapi.yaml` — OpenAPI spec (source of truth for API contracts)
- `lib/api-client-react/src/generated/` — generated hooks and Zod schemas (don't edit manually)
- `artifacts/api-server/src/models/` — Mongoose models (Contact, Campaign, EmailTemplate, SmtpAccount, EmailLog, ContactGroup)
- `artifacts/api-server/src/routes/` — Express route handlers
- `artifacts/email-platform/src/pages/` — Frontend pages (dashboard, contacts, groups, templates, smtp, campaigns, logs, reports)
- `artifacts/email-platform/src/components/forms/` — Create/Edit dialogs

## Architecture decisions

- MongoDB (not PostgreSQL) — chosen for flexible email log schema and campaign data
- Contract-first API: OpenAPI spec drives both server validation (Zod) and client hooks (React Query via Orval)
- Deep imports from `@workspace/api-client-react/src/generated/...` are wrong — always import from the barrel `@workspace/api-client-react`
- MongoDB URI secret had a formatting quirk; `mongodb.ts` strips any accidental `KEY=value` prefix at runtime
- Server does not exit on MongoDB connection failure — uses retry with exponential backoff, then continues serving

## Product

- **Dashboard** — overview stats (contacts, campaigns, emails sent, success rate, pending queue) + daily volume chart + activity feed
- **Contacts** — searchable table with group filtering, add/edit/delete, CSV-style data (name, email, company, location, tags)
- **Groups** — contact list segments for targeting campaigns
- **Email Templates** — HTML email templates with subject, preview text, status (draft/active)
- **SMTP Accounts** — multi-account SMTP management with hourly/daily limits, encryption, priority
- **Campaigns** — schedule and send campaigns to contact groups; start/pause/cancel; per-campaign stats
- **Email Logs** — per-message delivery history with status badges and pagination
- **Reports** — aggregated analytics: daily volume chart, campaign performance table, SMTP performance table

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Do NOT import from `@workspace/api-client-react/src/generated/...` — use the barrel import only
- After editing `lib/api-spec/openapi.yaml`, always run codegen before touching route handlers or frontend hooks
- `lib/db` (PostgreSQL/Drizzle) is not used — do not add DATABASE_URL references
- MongoDB URI secret may have `KEY=value` format quirk — handled in `mongodb.ts`
- Run `pnpm --filter @workspace/api-server run typecheck` before restarting to catch TS errors early

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
