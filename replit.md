# MoiFilmi

A cinematic streaming catalog prototype for browsing films, series, anime, and saved titles.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Next.js App Router (static export for the current catalog prototype)
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/stellar-stream/app/` — Next.js routes
- `artifacts/stellar-stream/src/` — shared catalog UI and styling
- `artifacts/stellar-stream/public/images/` — original sample title artwork
- `lib/api-spec/openapi.yaml` — API contract source of truth
- `lib/db/src/schema/` — database schema

## Architecture decisions

- The current catalog is a frontend-only prototype; account, catalog, upload, and streaming integrations are future work.

## Product

Viewers can browse films and series, search and filter the sample catalog, save titles to a local watch list, and open title details or a demo preview. Only content the uploader is authorized to distribute should be published.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
