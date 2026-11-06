import { createHash } from "node:crypto";
import type { Database } from "./client";
import { auditEvents } from "./schema";
import { desc } from "drizzle-orm";

export interface AppendAuditEventInput {
  actor: string;
  action: string;
  entity: string;
  before?: unknown;
  after?: unknown;
  model?: string;
  requestId?: string;
}

/**
 * Computes sha256(prevHash || canonical row contents).
 * Call this inside the same transaction as the change it describes.
 */
export function hashAuditRow(prevHash: string | null, row: Omit<AppendAuditEventInput, never> & { at: string }): string {
  const canonical = JSON.stringify({
    prevHash,
    at: row.at,
    actor: row.actor,
    action: row.action,
    entity: row.entity,
    before: row.before ?? null,
    after: row.after ?? null,
    model: row.model ?? null,
    requestId: row.requestId ?? null,
  });
  return createHash("sha256").update(canonical).digest("hex");
}

/**
 * Appends an audit event, chaining it to the previous row's hash.
 * Must be called within the same transaction as the data change it describes.
 */
export async function appendAuditEvent(tx: Database, input: AppendAuditEventInput) {
  const [last] = await tx
    .select({ hash: auditEvents.hash })
    .from(auditEvents)
    .orderBy(desc(auditEvents.id))
    .limit(1);

  const prevHash = last?.hash ?? null;
  const at = new Date().toISOString();
  const hash = hashAuditRow(prevHash, { ...input, at });

  const [row] = await tx
    .insert(auditEvents)
    .values({
      at: new Date(at),
      actor: input.actor,
      action: input.action,
      entity: input.entity,
      before: input.before,
      after: input.after,
      model: input.model,
      requestId: input.requestId,
      prevHash,
      hash,
    })
    .returning();

  return row;
}
