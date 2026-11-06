import postgres from "postgres";
import { stages } from "@sift/core";

const sql = postgres(process.env.DATABASE_URL ?? "postgres://sift:sift@localhost:55432/sift");

const POLL_INTERVAL_MS = Number(process.env.WORKER_POLL_INTERVAL_MS ?? 1000);
const MAX_ATTEMPTS = 3;

interface Job {
  id: number;
  stage: string;
  payload: Record<string, unknown>;
  status: string;
  attempts: number;
}

/** Claims one queued job with FOR UPDATE SKIP LOCKED so workers never race. */
async function claimNextJob(): Promise<Job | null> {
  const rows = await sql<Job[]>`
    update jobs
    set status = 'running'
    where id = (
      select id from jobs
      where status = 'queued' and run_at <= now()
      order by id
      for update skip locked
      limit 1
    )
    returning id, stage, payload, status, attempts
  `;
  return rows[0] ?? null;
}

async function runStage(job: Job): Promise<void> {
  const ctx = {
    caseId: job.payload.caseId as string,
    packageId: job.payload.packageId as string,
    documentId: job.payload.documentId as string | undefined,
  };

  switch (job.stage) {
    case "split":
      await stages.split(ctx);
      return;
    case "read":
      await stages.read(ctx);
      return;
    case "classify":
      await stages.classify(ctx);
      return;
    case "extract":
      await stages.extract(ctx);
      return;
    case "score":
      await stages.score(ctx);
      return;
    case "route":
      await stages.route(ctx);
      return;
    case "act":
      await stages.act(ctx);
      return;
    default:
      throw new Error(`unknown stage: ${job.stage}`);
  }
}

async function handleJob(job: Job): Promise<void> {
  try {
    await runStage(job);
    await sql`update jobs set status = 'done' where id = ${job.id}`;
  } catch (err) {
    const attempts = job.attempts + 1;
    console.error(`job ${job.id} (${job.stage}) failed attempt ${attempts}:`, err);

    if (attempts >= MAX_ATTEMPTS) {
      // Open a stage_failed task instead of dying silently.
      await sql`update jobs set status = 'failed', attempts = ${attempts} where id = ${job.id}`;
      await sql`
        insert into tasks (kind, case_id, status, reason)
        values ('stage_failed', ${job.payload.caseId as string}, 'open', ${`${job.stage} failed after ${attempts} attempts: ${String(err)}`})
      `;
    } else {
      await sql`
        update jobs
        set status = 'queued', attempts = ${attempts}, run_at = now() + interval '5 seconds'
        where id = ${job.id}
      `;
    }
  }
}

async function poll(): Promise<void> {
  const job = await claimNextJob();
  if (job) {
    await handleJob(job);
    // Immediately check for more work instead of waiting out the interval.
    setImmediate(poll);
    return;
  }
  setTimeout(poll, POLL_INTERVAL_MS);
}

console.log(`sift worker started, polling every ${POLL_INTERVAL_MS}ms`);
poll();
