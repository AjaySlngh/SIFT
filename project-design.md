# Intake pipeline project: design spec

Nov 2, 2026 · @Not Tellingya

## Overview

Working name: **sift**. You upload a mortgage borrower's assistance packet as one messy PDF, and sift splits it into documents, classifies each one, pulls out typed fields, and scores how sure it is about every value. Anything it isn't sure about goes to a human review queue, and every action, by the agent or a person, lands in an append-only audit log.

It's a scaled-down version of the problem QDocs solves, built as a working slice of the intake architecture you already started. The goal isn't to beat their product. It's to show Eric you understand why their design looks the way it does: the agent works as a user, confidence decides routing, and nothing happens off the record.

**In scope**

- One packet type: a borrower assistance (loss mitigation) packet, using synthetic documents only
- 4 document types plus an "other" fallback
- Split, classify, extract, validate, route, review, and a completeness check at the end
- Audit log and token cost ledger
- An eval script that reports accuracy and how well the confidence scores hold up

**Out of scope**

- Real borrower data of any kind
- Auth beyond a few seeded users (one reviewer, one admin, one agent account)
- Production deployment hardening. A local Docker Compose setup and a demo video are enough.

## User flow

The demo is about two minutes long and follows one packet from upload to a closed case.

1. A reviewer creates a case for a borrower and drops in a 12-page PDF: an application, a hardship letter, two pay stubs and a bank statement, in shuffled order, with one page scanned crooked.
2. The case page shows each stage ticking off live: split into 5 documents, classified, fields extracted.
3. Four of the five documents clear on their own. The bank statement shows up in the worklist because its ending balance came back at 0.62 confidence and the borrower name doesn't match the application.
4. The reviewer opens the task and sees the source page on the left and the extracted fields on the right, with the weak fields highlighted. They fix the balance, confirm the name, and approve.
5. The completeness check runs and flags that the packet has no second month of bank statements. The agent drafts a missing-documents letter, and the reviewer edits and approves it.
6. The audit tab shows the whole history: which account did what, which model ran, what each value was before and after the correction, and what the run cost in tokens.

## Architecture

&#91;embedded content: architecture · web app, worker, Postgres, storage, model API\]

There are two processes and one database. The web app never calls the model. It writes jobs, and the worker picks them up, so a slow model call never blocks a reviewer. Files stay in object storage, and the database only keeps keys and hashes.

## Pipeline stages

&#91;embedded content: pipeline · 6 stages, 1 routing decision\]

Every stage runs as its own job, so a crash halfway through resumes where it stopped instead of starting over. A stage that fails 3 times opens a `stage_failed` task rather than dying silently.

1. **Ingest:** Store the upload in MinIO, hash it with sha256 so duplicate uploads get rejected, create the `packages` row, and enqueue `split`.
2. **Split:** Send the whole PDF to a cheap, fast model and ask for page ranges plus a first-guess type for each document. Doing a rough classification in the same pass saves a call, which is how QDocs does it too.
3. **Read:** Pull each page's text layer with pdfjs. Pages with no text (the fake scans) get rendered to PNG and passed to the model as images in later stages.
4. **Classify:** Confirm the type against the template descriptions and return a confidence. Anything below 0.80 or labeled `other` opens a reclassify task.
5. **Extract:** Make one call per document, using tool use with a JSON schema built from the template, so the output is always well-formed. Each field returns `value`, `confidence`, `source_page` and `evidence`.
6. **Score:** Run parse checks, template rules, and cross-document matching, then compute field and document scores.
7. **Route:** Auto-accept the document or open a review task, and pick 1 in 20 auto-accepted documents for a spot check.
8. **Act:** Once every document in the case is accepted, compare what's there against `required_per_packet`. Close the case, or draft a missing-documents letter that a person has to approve before it goes anywhere.

## Document types and field templates

Document types are YAML templates, not code. The plain-English description in each one doubles as the model's instructions, the same way QDocs works. Adding a new document type means adding a file, with no code changes and no training.

```yaml
# templates/pay_stub.yaml
type: pay_stub
description: >
  An employee earnings statement for a single pay period.
  Shows employer, pay dates, gross and net pay, and deductions.
required_per_packet: 2   # two most recent stubs
fields:
  - name: employee_name
    type: string
    prompt: Full name of the employee as printed.
    weight: 2
  - name: pay_period_end
    type: date
    prompt: Last day of the pay period, not the pay date.
    weight: 1
  - name: gross_pay
    type: money
    prompt: Gross pay for this period only, not year to date.
    weight: 3
  - name: net_pay
    type: money
    prompt: Net pay for this period only.
    weight: 2
checks:
  - net_pay <= gross_pay
  - pay_period_end within 60 days of case.created_at
```

| Type | Key fields | Per packet |
| --- | --- | --- |
| `assistance_application` | borrower name, loan number, property address, monthly income, hardship reason | 1 |
| `hardship_letter` | borrower name, hardship type, hardship start date, signed (yes/no) | 1 |
| `pay_stub` | employee name, pay period end, gross pay, net pay | 2 |
| `bank_statement` | account holder, statement end date, ending balance | 2 |
| `other` | none, it's the fallback for anything that doesn't match | 0 |

Weights say how much a field counts toward the document's overall score. Getting gross pay wrong matters more than getting the pay date wrong, so gross pay carries more weight.

## Confidence scoring and routing rules

Don't trust the model's self-reported confidence on its own. LLMs say "0.95" about values that are wrong. sift combines the model's number with checks it can actually verify, then measures how well the combined score predicts errors (see the eval section). QDocs' public docs don't describe how they calibrate, so this is where your project can say something original.

**Field score** starts at the model's reported confidence, then gets cut by:

- **Parse failure:** the value isn't a valid date, amount, or yes/no → score 0
- **Rule failure:** a template check fails, such as `net_pay <= gross_pay` → multiply by 0.5
- **Cross-document mismatch:** a name or loan number disagrees with the application (compared after normalizing case and spacing, with fuzzy matching) → multiply by 0.6
- **No evidence:** the model can't point to the page the value came from → multiply by 0.7

Ask the model to return a `source_page` and a short `evidence` quote for each field. That powers the "no evidence" check, and it lets the review screen jump straight to the right page.

**Document score** = the weighted average of its field scores, using the template weights.

The cut multipliers above are starting guesses. Tune them against the eval set rather than treating them as fixed.

**Routing**

| Condition | Goes to |
| --- | --- |
| Every field ≥ 0.85 and no failed checks | Auto-accepted |
| Any field < 0.85, or a required field missing | Review worklist, weak fields highlighted |
| Classification confidence < 0.80, or type is `other` | Review worklist, reclassification task |
| 1 in 20 auto-accepted documents, picked at random | Spot-check audit task |

The random spot-check matters. It's how you catch confident mistakes that the threshold lets through, and it mirrors Quandis' worklist audits. Keep thresholds in config, not code.

## Data model

One Postgres database holds everything, including the job queue, so there's no Redis to run. The agent is a row in `users` like anyone else, so "who did this" always has the same answer shape.

```sql
create table users (
  id uuid primary key,
  name text not null,
  kind text not null check (kind in ('human','agent')),
  role text not null check (role in ('reviewer','admin','agent')),
  model text            -- set for agents, e.g. 'claude-sonnet-5-5'
);

create table cases (
  id uuid primary key,
  borrower_name text,
  loan_number text,
  status text not null default 'open',  -- open | in_review | incomplete | complete
  created_at timestamptz default now()
);

create table packages (            -- the original uploaded file
  id uuid primary key,
  case_id uuid references cases,
  storage_key text not null,       -- S3/MinIO key, file never lives in the DB
  sha256 text not null unique,     -- duplicate upload detection
  page_count int
);

create table documents (
  id uuid primary key,
  package_id uuid references packages,
  page_start int, page_end int,
  doc_type text,
  class_confidence numeric,
  score numeric,                   -- weighted doc score
  status text not null             -- pending | accepted | needs_review | rejected
);

create table fields (
  id uuid primary key,
  document_id uuid references documents,
  name text, data_type text,
  value jsonb,
  model_confidence numeric,
  score numeric,                   -- after checks
  failed_checks text[],
  source_page int, evidence text,
  set_by uuid references users     -- agent or the reviewer who corrected it
);

create table tasks (               -- the worklist
  id uuid primary key,
  kind text,                       -- review_fields | reclassify | spot_check | approve_letter
  document_id uuid, case_id uuid,
  assignee uuid references users,
  status text default 'open',
  reason text
);

create table jobs (                -- queue: workers claim with FOR UPDATE SKIP LOCKED
  id bigserial primary key,
  stage text, payload jsonb,
  status text default 'queued', attempts int default 0,
  run_at timestamptz default now()
);

create table audit_events (...);   -- see Audit log section
create table token_ledger (...);
```

## API endpoints

These are Next.js route handlers. Pipeline stages get both a synchronous route and a queued route, the same split QDocs exposes (`/api/{module}/{operation}` vs `/api/{module}/queue/{operation}`). The sync routes are handy for testing one stage on one document.

| Method | Path | Does |
| --- | --- | --- |
| POST | `/api/cases` | Create a case |
| POST | `/api/cases/:id/packages` | Upload a PDF, hash it, store it, enqueue `split` |
| GET | `/api/cases/:id` | Case with documents, fields, status |
| GET | `/api/cases/:id/events` | Server-sent events for live stage updates |
| POST | `/api/docs/classify` | Run classify on one document now |
| POST | `/api/docs/queue/classify` | Enqueue it instead |
| POST | `/api/docs/extract` | Run extract on one document now |
| POST | `/api/docs/queue/extract` | Enqueue it instead |
| GET | `/api/documents/:id/pages/:n` | Rendered page image for the review screen |
| GET | `/api/worklist?assignee=me` | Open tasks |
| POST | `/api/tasks/:id/resolve` | Approve, correct fields, or reclassify |
| GET | `/api/audit?entity=case:<id>` | Audit trail for anything |
| GET | `/api/ledger?case=<id>` | Token spend |

Every write route takes the acting user from the session and passes it into the audit log. No route writes without an actor.

## Review UI

The UI has four screens. Keep it plain and fast, since a reviewer would sit in the worklist all day.

- **Worklist:** a table of open tasks sorted by age, with columns for type, case, reason ("ending\_balance 0.62, name mismatch") and assignee. Keyboard shortcuts: `j`/`k` to move, `enter` to open.
- **Review task:** the source page on the left (react-pdf, zoomed to `source_page`, with the evidence text highlighted when the text layer allows it). The fields on the right, each showing its value, score and any failed checks. Fields under the threshold get a colored border. Actions: approve, edit a value (a reason is required), reclassify, or reject the document.
- **Case view:** the packet's documents with status chips, a completeness checklist against the templates' `required_per_packet`, the live stage progress, and a tab for the audit trail.
- **Ledger:** token spend per case and per stage. This one's small, but it shows you thought about cost.

If a reviewer edits a value, the field's `set_by` changes to the reviewer and the old value goes into the audit event. Never overwrite without keeping the before-and-after.

## Audit log and token cost tracking

The audit log is append-only, and the database enforces it, not just the app. Each row also stores a hash of the row before it, so any edit to history breaks the chain and a verify script can catch it. Someone who's been through SOC 2 audits will notice that detail.

```sql
create table audit_events (
  id bigserial primary key,
  at timestamptz not null default now(),
  actor uuid not null references users,   -- human or agent
  action text not null,                    -- e.g. field.extracted, field.corrected, task.resolved
  entity text not null,                    -- e.g. 'field:<uuid>'
  before jsonb, after jsonb,
  model text, request_id text,             -- set when an agent acted
  prev_hash text, hash text not null       -- sha256(prev_hash || row contents)
);

-- block UPDATE and DELETE outright
create rule no_update as on update to audit_events do instead nothing;
create rule no_delete as on delete to audit_events do instead nothing;

create table token_ledger (
  id bigserial primary key,
  case_id uuid, stage text, model text,
  input_tokens int, cached_tokens int, output_tokens int,
  usd numeric(10,5),                       -- from a per-model rate table in config
  at timestamptz default now()
);
```

Write each audit event in the same transaction as the change it describes, so the log can't drift from the data. `scripts/verify-audit.ts` walks the chain and prints the first broken link, if there is one. Show it running in the demo.

A trigger that raises an exception is stricter than a rule that silently does nothing, since writes fail loudly instead of disappearing. Pick the trigger if you have time.

## Synthetic test data and evaluation

The eval is what makes this an engineering project instead of a demo. Generate the packets yourself, keep the ground truth, and report real numbers.

**Generator** (`scripts/generate-packets.ts`)

- Faker for borrowers, employers, addresses, and loan numbers. pdf-lib to render each document type from your own simple layouts. Don't copy real lender or agency forms.
- "Scan" a share of the pages by rasterizing them, then adding a slight rotation, blur, and noise with sharp. These pages have no text layer, so the model has to read the image.
- Plant errors on purpose: a name spelled differently on one document, net pay higher than gross, a missing bank statement month, a stray utility bill that should land in `other`.
- Shuffle the documents and merge them into one PDF. Write `packet-017.pdf` next to `packet-017.truth.json` (page ranges, types, field values, planted errors).
- Start with 50 packets. That's roughly 250 documents, enough to say something.

**Eval** (`eval/run.ts`, using the Batch API so a full run is cheap)

| Metric | What it tells you |
| --- | --- |
| Split accuracy | Share of packets where every page range is exactly right |
| Classification accuracy | Share of documents with the right type |
| Field accuracy | Share of fields matching the truth after normalizing |
| Straight-through rate | Share of documents auto-accepted |
| Auto-accept error rate | Share of auto-accepted fields that were actually wrong. **This is the headline number.** |
| Planted-error catch rate | Share of planted errors that ended up in review |

Then sweep the threshold from 0.5 to 0.99 and plot straight-through rate against auto-accept error rate. That one chart answers the question an operations leader actually asks: "How much work can I skip, and how much risk does that cost me?" Run it twice, once with the model's raw confidence and once with the combined score. If the checks are pulling their weight, the combined score should do better, and that comparison is the most interesting thing you can show Eric.

## Repo layout and tech stack

Use TypeScript end to end so you're moving fast in tools you already know. It's a pnpm monorepo, so the worker and the web app share the pipeline code.

```
sift/
  apps/
    web/                 # Next.js: worklist, review, case view, API routes
    worker/              # polls jobs table, runs stages
  packages/
    core/                # stages: split, read, classify, extract, score, route, act
      src/stages/
      src/scoring.ts     # field + doc score, checks
      src/llm.ts         # one wrapper: picks model per agent, logs tokens
    db/                  # Drizzle schema + migrations, audit helpers
  templates/             # one YAML per document type
  scripts/
    generate-packets.ts
    verify-audit.ts
    seed.ts              # users incl. the agent account
  eval/
    run.ts
    report.md            # generated: tables + threshold sweep chart
  docker-compose.yml     # postgres + minio
  README.md
```

| Piece | Choice | Why |
| --- | --- | --- |
| Web | Next.js + TypeScript | You already ship it at MigaLabs |
| DB | Postgres + Drizzle | Queue, audit, and data in one place |
| Files | MinIO (S3-compatible) | Shows the docs-stay-in-your-storage pattern |
| LLM | Anthropic SDK, PDF + image input, tool use for structured output | Quandis lists Claude as a provider. A Haiku-tier model for split/classify, a Sonnet-tier model for extract, set per agent in config. |
| PDF | pdf-lib (generate), pdfjs-dist (text layer + rendering), react-pdf (viewer) |  |
| Images | sharp | Fake scans |
| Tests | Vitest | Unit tests on scoring and checks at minimum |

Keep every model call in `llm.ts`. That's where the agent's user id, the token ledger write, and retries live, so no stage talks to the API directly.

## Build plan

The plan is three weekends plus a polish weekend. Each weekend ends with something that runs, so if you stop early you still have something to show.

**Weekend 1: data and the happy path**

- [ ] Repo, Docker Compose, Drizzle schema, seed users
- [ ] Two templates (pay stub, bank statement) and the packet generator for just those two
- [ ] Split → classify → extract as plain function calls, results written to Postgres
- [ ] `llm.ts` with the token ledger

**Weekend 2: scoring, queue, audit**

- [ ] Remaining templates and the full generator with scans and planted errors
- [ ] Checks, field and document scores, routing into `tasks`
- [ ] Jobs table and worker with `SKIP LOCKED`, retries
- [ ] Audit events in the same transaction, the hash chain, `verify-audit.ts`

**Weekend 3: the UI people see**

- [ ] Upload and case view with live stage updates
- [ ] Worklist and review screen with the source page side by side
- [ ] Completeness check and the missing-documents letter task

**Weekend 4: prove it**

- [ ] Eval run on 50 packets, threshold sweep, raw vs. combined comparison
- [ ] README with the architecture diagram, the eval numbers, and a "what I'd change" section
- [ ] A 2-minute demo video following the user flow above
- [ ] Add it to the top of jays.cs.house with the stack and the headline numbers

## Stretch goals and how to present it

**Stretch goals, roughly in order of payoff**

1. **An MCP server** that exposes `get_case`, `list_worklist`, and `resolve_task`. Quandis agents can call external MCP tools, so this shows you know where their platform is heading.
2. **Voicemail intake:** transcribe an mp3 from a borrower and attach it to the case. This ties back to the voice channel in your intake architecture.
3. **Read-only reporting:** a plain-English question becomes a single `SELECT`, checked against the schema before it runs, run on a read-only role.
4. **Swappable model providers** behind `llm.ts`, with the eval run per provider.

**How to present it to Eric**

- Lead with the problem, not the stack: "After our conversation I got curious about document-heavy servicing workflows, so I built a small version to understand where the hard parts are."
- Give one number and one insight, such as the auto-accept error rate and what you learned about trusting model confidence.
- Link the repo, the README, and the 2-minute video. Don't make him run anything.
- Don't call it a QDocs clone or claim it's production-ready. Saying where it falls short reads as maturity.
- Close with the ask: internships anytime in 2027, and whether he'd be open to a short call.
