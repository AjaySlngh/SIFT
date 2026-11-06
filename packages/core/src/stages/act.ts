import { appendAuditEvent, cases, db, documents, packages, tasks } from "@sift/db";
import { and, eq } from "drizzle-orm";
import { getAgentUserId } from "../agent";
import { callModel, modelForStage } from "../llm";
import { loadAllTemplates } from "../templates";
import type { StageContext, StageResult } from "./types";

export interface ActResult {
  /** 'complete' when every required document type/count is present, else 'incomplete' */
  caseStatus: "complete" | "incomplete";
  missingDocumentTypes: string[];
}

/**
 * Once every document in the case is accepted, compares what's there against
 * each template's `required_per_packet`. Closes the case, or drafts a
 * missing-documents letter that a person has to approve before it goes
 * anywhere.
 */
export async function act(ctx: StageContext): Promise<StageResult<ActResult>> {
  const [caseRow] = await db.select().from(cases).where(eq(cases.id, ctx.caseId)).limit(1);
  if (!caseRow) {
    return { ok: false, error: `case ${ctx.caseId} not found` };
  }
  if (caseRow.status === "complete") {
    return { ok: true, data: { caseStatus: "complete", missingDocumentTypes: [] } };
  }

  const acceptedDocs = await db
    .select({ docType: documents.docType })
    .from(documents)
    .innerJoin(packages, eq(documents.packageId, packages.id))
    .where(and(eq(packages.caseId, ctx.caseId), eq(documents.status, "accepted")));

  const countByType = new Map<string, number>();
  for (const d of acceptedDocs) {
    if (!d.docType) continue;
    countByType.set(d.docType, (countByType.get(d.docType) ?? 0) + 1);
  }

  const templates = loadAllTemplates();
  const missingDocumentTypes = templates
    .filter((t) => t.required_per_packet > 0 && (countByType.get(t.type) ?? 0) < t.required_per_packet)
    .map((t) => t.type);

  const agentUserId = await getAgentUserId();

  if (missingDocumentTypes.length === 0) {
    await db.update(cases).set({ status: "complete" }).where(eq(cases.id, ctx.caseId));
    await appendAuditEvent(db, {
      actor: agentUserId,
      action: "case.closed",
      entity: `case:${ctx.caseId}`,
      after: { status: "complete" },
    });
    return { ok: true, data: { caseStatus: "complete", missingDocumentTypes: [] } };
  }

  // Avoid drafting a second letter if one is already pending approval.
  const [existingLetterTask] = await db
    .select({ id: tasks.id })
    .from(tasks)
    .where(and(eq(tasks.caseId, ctx.caseId), eq(tasks.kind, "approve_letter"), eq(tasks.status, "open")))
    .limit(1);

  await db.update(cases).set({ status: "incomplete" }).where(eq(cases.id, ctx.caseId));

  if (!existingLetterTask) {
    const model = modelForStage("act");
    const { message } = await callModel({
      stage: "act",
      caller: { userId: agentUserId, model },
      caseId: ctx.caseId,
      system:
        "You draft a short, courteous missing-documents letter to a borrower applying for " +
        "mortgage assistance. List exactly what's still needed and how to submit it. No legal advice.",
      messages: [
        {
          role: "user",
          content:
            `Borrower: ${caseRow.borrowerName ?? "the borrower"}. ` +
            `Still missing: ${missingDocumentTypes.join(", ")}.`,
        },
      ],
    });

    const letterText = message.content
      .filter((b) => b.type === "text")
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("\n");

    await db.insert(tasks).values({
      kind: "approve_letter",
      caseId: ctx.caseId,
      status: "open",
      reason: letterText || `missing documents: ${missingDocumentTypes.join(", ")}`,
    });

    await appendAuditEvent(db, {
      actor: agentUserId,
      action: "case.missing_documents_letter_drafted",
      entity: `case:${ctx.caseId}`,
      after: { missingDocumentTypes },
      model,
    });
  }

  return { ok: true, data: { caseStatus: "incomplete", missingDocumentTypes } };
}
