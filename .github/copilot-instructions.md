# Sift repository conventions

- pnpm monorepo. Workspaces: apps/web, apps/worker, packages/core, packages/db.
- TypeScript end to end, strict mode on (tsconfig.base.json).
- Postgres + Drizzle for schema/migrations (packages/db). No Redis — jobs table is the queue.
- Files live in MinIO (S3-compatible), DB only stores keys/hashes.
- All model calls go through packages/core/src/llm.ts — no stage talks to the API directly.
- Document type templates are YAML under templates/, not code.
- Audit log is append-only (DB-enforced); every write route must pass an actor.
