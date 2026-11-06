import { appendAuditEvent, db, documents, tasks } from "@sift/db";
import { eq } from "drizzle-orm";
import { getAgentUserId } from "../agent";
import { getDocumentText } from "../document-text";
import { enqueueJob } from "../jobs";
import { callModel, modelForStage } from "../llm";
import { ROUTING_THRESHOLDS } from "../scoring";
import { loadAllTemplates } from "../templates";
import type { StageContext, StageResult } from "./types";

export interface ClassifyResult {
  docType: string;
  confidence: number;
}

const TOOL_NAME = "report_classification";

/**
 * Confirms the document type against the template descriptions and returns a
 * confidence. Anything below 0.80 or labeled `other` opens a reclassify task
 * instead of moving on to extract.
 */
export async function classify(ctx: StageContext): Promise<StageResult<ClassifyResult>> {
  if (!ctx.documentId) {
    return { ok: false, error: "classify requires a documentId" };
  }

  const { doc, text } = await getDocumentText(ctx.documentId);
  const templates = loadAllTemplates();

  const agentUserId = await getAgentUserId();
  const model = modelForStage("classify");

  const descriptions = templates
    .map((t) => `- ${t.type}: ${t.description.trim()}`)
    .join("\n");

  const { message } = await callModel({
    stage: "classify",
    caller: { userId: agentUserId, model },
    caseId: ctx.caseId,
    system:
      "You confirm a document's type against a set of template descriptions and report " +
      `your confidence (0 to 1). Document types:\n${descriptions}\n` +
      'Use "other" if nothing fits well. The split stage already guessed ' +
      `"${doc.docType}" — confirm or correct it.`,
    messages: [
      {
        role: "user",
        content: `Document text:\n\n${text.slice(0, 6000)}`,
      },
    ],
    tools: [
      {
        name: TOOL_NAME,
        description: "Report the confirmed document type and your confidence.",
        input_schema: {
          type: "object",
          properties: {
            docType: { type: "string", enum: templates.map((t) => t.type) },
            confidence: { type: "number", minimum: 0, maximum: 1 },
          },
          required: ["docType", "confidence"],
        },
      },
    ],
    toolChoice: { type: "tool", name: TOOL_NAME },
  });

  const toolUse = message.content.find((b) => b.type === "tool_use" && b.name === TOOL_NAME);
  if (!toolUse || toolUse.type !== "tool_use") {
    return { ok: false, error: "model did not return a tool_use block" };
  }

  const parsed = toolUse.input as ClassifyResult;

  await db
    .update(documents)
    .set({ docType: parsed.docType, classConfidence: String(parsed.confidence) })
    .where(eq(documents.id, ctx.documentId));

  await appendAuditEvent(db, {
    actor: agentUserId,
    action: "document.classified",
    entity: `document:${ctx.documentId}`,
    before: { docType: doc.docType },
    after: { docType: parsed.docType, confidence: parsed.confidence },
    model,
  });

  const needsReclassify =
    parsed.confidence < ROUTING_THRESHOLDS.classificationConfidence || parsed.docType === "other";

  if (needsReclassify) {
    await db
      .update(documents)
      .set({ status: "needs_review" })
      .where(eq(documents.id, ctx.documentId));

    await db.insert(tasks).values({
      kind: "reclassify",
      documentId: ctx.documentId,
      caseId: ctx.caseId,
      status: "open",
      reason: `classification confidence ${parsed.confidence.toFixed(2)} for type "${parsed.docType}"`,
    });
  } else {
    await enqueueJob("extract", { caseId: ctx.caseId, packageId: ctx.packageId, documentId: ctx.documentId });
  }

  return { ok: true, data: parsed };
}
