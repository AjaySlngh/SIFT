import { appendAuditEvent, db, documents, fields as fieldsTable, packages, tasks } from "@sift/db";
import { and, eq, ne } from "drizzle-orm";
import { getAgentUserId } from "../agent";
import { enqueueJob } from "../jobs";
import { routeDocument, type CheckFailure, type FieldScoreResult, type RoutingDecision } from "../scoring";
import { loadTemplate } from "../templates";
import type { StageContext, StageResult } from "./types";

/**
 * Auto-accepts the document or opens a review task, and picks 1 in 20
 * auto-accepted documents for a spot check. Once every document in the case
 * is resolved, enqueues `act` to run the packet completeness check.
 */
export async function route(ctx: StageContext): Promise<StageResult<RoutingDecision>> {
  if (!ctx.documentId) {
    return { ok: false, error: "route requires a documentId" };
  }

  const [doc] = await db.select().from(documents).where(eq(documents.id, ctx.documentId)).limit(1);
  if (!doc || !doc.docType) {
    return { ok: false, error: `document ${ctx.documentId} not found or not classified` };
  }

  const template = loadTemplate(doc.docType);
  const fieldRows = await db.select().from(fieldsTable).where(eq(fieldsTable.documentId, ctx.documentId));

  const fieldScores: FieldScoreResult[] = fieldRows.map((r) => ({
    name: r.name!,
    score: Number(r.score ?? 0),
    failedChecks: (r.failedChecks ?? []) as CheckFailure[],
  }));

  const extractedNames = new Set(fieldRows.map((r) => r.name));
  const requiredFieldsPresent = template.fields.every((f) => extractedNames.has(f.name));

  const decision = routeDocument({
    classConfidence: Number(doc.classConfidence ?? 0),
    docType: doc.docType,
    fieldScores,
    requiredFieldsPresent,
  });

  const agentUserId = await getAgentUserId();

  if (decision.outcome === "auto_accepted" || decision.outcome === "spot_check") {
    await db.update(documents).set({ status: "accepted" }).where(eq(documents.id, ctx.documentId));

    if (decision.outcome === "spot_check") {
      await db.insert(tasks).values({
        kind: "spot_check",
        documentId: ctx.documentId,
        caseId: ctx.caseId,
        status: "open",
        reason: "randomly selected for spot-check audit",
      });
    }
  } else {
    await db.update(documents).set({ status: "needs_review" }).where(eq(documents.id, ctx.documentId));

    const weakFields = fieldScores.filter((f) => f.score < 0.85 || f.failedChecks.length > 0);
    await db.insert(tasks).values({
      kind: decision.reason === "reclassify" ? "reclassify" : "review_fields",
      documentId: ctx.documentId,
      caseId: ctx.caseId,
      status: "open",
      reason:
        decision.reason === "reclassify"
          ? `classification confidence ${doc.classConfidence}`
          : `weak fields: ${weakFields.map((f) => f.name).join(", ") || "missing required field"}`,
    });
  }

  await appendAuditEvent(db, {
    actor: agentUserId,
    action: "document.routed",
    entity: `document:${ctx.documentId}`,
    after: { outcome: decision.outcome, reason: "reason" in decision ? decision.reason : undefined },
  });

  // Once every document in the case has cleared review, run the completeness check.
  const [pkg] = await db.select().from(packages).where(eq(packages.id, ctx.packageId)).limit(1);
  if (pkg) {
    const pending = await db
      .select({ id: documents.id })
      .from(documents)
      .innerJoin(packages, eq(documents.packageId, packages.id))
      .where(and(eq(packages.caseId, ctx.caseId), ne(documents.status, "accepted")))
      .limit(1);

    if (pending.length === 0) {
      await enqueueJob("act", { caseId: ctx.caseId, packageId: ctx.packageId });
    }
  }

  return { ok: true, data: decision };
}
