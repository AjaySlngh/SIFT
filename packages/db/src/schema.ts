import {
  bigserial,
  check,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    kind: text("kind").notNull(), // 'human' | 'agent'
    role: text("role").notNull(), // 'reviewer' | 'admin' | 'agent'
    model: text("model"), // set for agents, e.g. 'claude-sonnet-4-5'
  },
  (table) => [
    check("users_kind_check", sql`${table.kind} in ('human','agent')`),
    check("users_role_check", sql`${table.role} in ('reviewer','admin','agent')`),
  ],
);

export const cases = pgTable("cases", {
  id: uuid("id").primaryKey().defaultRandom(),
  borrowerName: text("borrower_name"),
  loanNumber: text("loan_number"),
  status: text("status").notNull().default("open"), // open | in_review | incomplete | complete
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const packages = pgTable("packages", {
  id: uuid("id").primaryKey().defaultRandom(),
  caseId: uuid("case_id").references(() => cases.id),
  storageKey: text("storage_key").notNull(), // S3/MinIO key, file never lives in the DB
  sha256: text("sha256").notNull().unique(), // duplicate upload detection
  pageCount: integer("page_count"),
});

export const documents = pgTable("documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  packageId: uuid("package_id").references(() => packages.id),
  pageStart: integer("page_start"),
  pageEnd: integer("page_end"),
  docType: text("doc_type"),
  classConfidence: numeric("class_confidence"),
  score: numeric("score"), // weighted doc score
  status: text("status").notNull().default("pending"), // pending | accepted | needs_review | rejected
});

export const fields = pgTable("fields", {
  id: uuid("id").primaryKey().defaultRandom(),
  documentId: uuid("document_id").references(() => documents.id),
  name: text("name"),
  dataType: text("data_type"),
  value: jsonb("value"),
  modelConfidence: numeric("model_confidence"),
  score: numeric("score"), // after checks
  failedChecks: text("failed_checks").array(),
  sourcePage: integer("source_page"),
  evidence: text("evidence"),
  setBy: uuid("set_by").references(() => users.id), // agent or the reviewer who corrected it
});

export const tasks = pgTable("tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  kind: text("kind"), // review_fields | reclassify | spot_check | approve_letter
  documentId: uuid("document_id"),
  caseId: uuid("case_id"),
  assignee: uuid("assignee").references(() => users.id),
  status: text("status").default("open"),
  reason: text("reason"),
});

export const jobs = pgTable("jobs", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  stage: text("stage"),
  payload: jsonb("payload"),
  status: text("status").default("queued"), // queued | running | done | failed
  attempts: integer("attempts").default(0),
  runAt: timestamp("run_at", { withTimezone: true }).defaultNow(),
});

export const auditEvents = pgTable("audit_events", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  actor: uuid("actor")
    .notNull()
    .references(() => users.id), // human or agent
  action: text("action").notNull(), // e.g. field.extracted, field.corrected, task.resolved
  entity: text("entity").notNull(), // e.g. 'field:<uuid>'
  before: jsonb("before"),
  after: jsonb("after"),
  model: text("model"),
  requestId: text("request_id"), // set when an agent acted
  prevHash: text("prev_hash"),
  hash: text("hash").notNull(), // sha256(prev_hash || row contents)
});

export const tokenLedger = pgTable("token_ledger", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  caseId: uuid("case_id"),
  stage: text("stage"),
  model: text("model"),
  inputTokens: integer("input_tokens"),
  cachedTokens: integer("cached_tokens"),
  outputTokens: integer("output_tokens"),
  usd: numeric("usd", { precision: 10, scale: 5 }),
  at: timestamp("at", { withTimezone: true }).defaultNow(),
});
