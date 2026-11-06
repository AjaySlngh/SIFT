import { db, jobs } from "@sift/db";
import type { Stage } from "./llm";

/** Enqueues a job for the worker to pick up with `FOR UPDATE SKIP LOCKED`. */
export async function enqueueJob(stage: Stage, payload: Record<string, unknown>): Promise<void> {
  await db.insert(jobs).values({ stage, payload, status: "queued" });
}
