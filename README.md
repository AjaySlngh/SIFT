# sift

An intake pipeline for mortgage borrower assistance packets. Upload one messy
PDF, and sift splits it into documents, classifies each one, extracts typed
fields, scores how sure it is about every value, and routes anything uncertain
to a human review queue. Every action — by the agent or a person — lands in
an append-only audit log.

See [project-design.md](project-design.md) for the full design doc.

## Stack

- **Web**: Next.js (`apps/web`) — worklist, review, case view, API routes
- **Worker**: `apps/worker` — polls the `jobs` table, runs pipeline stages
- **DB**: Postgres + Drizzle (`packages/db`) — schema, migrations, audit helpers
- **Core**: `packages/core` — pipeline stages, scoring, the single `llm.ts` wrapper
- **Files**: MinIO (S3-compatible)
- **Templates**: YAML under `templates/`, one per document type

## Repo layout

```
sift/
  apps/
    web/                 # Next.js: worklist, review, case view, API routes
    worker/              # polls jobs table, runs stages
  packages/
    core/                # stages: split, read, classify, extract, score, route, act
    db/                  # Drizzle schema + migrations, audit helpers
  templates/              # one YAML per document type
  scripts/
    generate-packets.ts   # synthetic packet generator
    verify-audit.ts        # walks the audit hash chain
    seed.ts                 # seeds users incl. the agent account
  eval/
    run.ts                 # accuracy + threshold sweep
    report.md               # generated
  docker-compose.yml       # postgres + minio
```

## Getting started

```bash
# 1. install dependencies
pnpm install

# 2. start Postgres + MinIO
docker compose up -d

# 3. copy env and fill in ANTHROPIC_API_KEY
cp .env.example .env

# 4. generate and run migrations
pnpm db:generate
pnpm db:migrate

# 5. seed the demo users (reviewer, admin, agent)
pnpm seed

# 6. generate synthetic packets
pnpm generate:packets 50

# 7. run the web app and worker (separate terminals)
pnpm dev:web
pnpm dev:worker
```

## Testing

```bash
pnpm test        # vitest across all packages
pnpm typecheck    # tsc --noEmit across all packages
```

## Eval

```bash
pnpm eval   # writes eval/report.md
```
