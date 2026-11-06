import { appendAuditEvent, db, fields as fieldsTable } from "@sift/db";
import { getAgentUserId } from "../agent";
import { getDocumentText } from "../document-text";
import { enqueueJob } from "../jobs";
import { callModel, modelForStage } from "../llm";
import type { ExtractedField } from "../scoring";
import { loadTemplate } from "../templates";
import type { StageContext, StageResult } from "./types";

export interface ExtractResult {
  fields: ExtractedField[];
}

const TOOL_NAME = "report_fields";

interface RawField {
  name: string;
  value: string | number | boolean | null;
  confidence: number;
  source_page?: number;
  evidence?: string;
}

/**
 * One call per document, using tool use with a JSON schema built from the
 * document's template, so the output is always well-formed. Each field
 * returns `value`, `confidence`, `source_page` and `evidence`.
 */
export async function extract(ctx: StageContext): Promise<StageResult<ExtractResult>> {
  if (!ctx.documentId) {
    return { ok: false, error: "extract requires a documentId" };
  }

  const { doc, text } = await getDocumentText(ctx.documentId);
  if (!doc.docType) {
    return { ok: false, error: "document has no confirmed docType" };
  }

  const template = loadTemplate(doc.docType);
  const agentUserId = await getAgentUserId();
  const model = modelForStage("extract");

  const fieldPrompts = template.fields
    .map((f) => `- ${f.name} (${f.type}): ${f.prompt}`)
    .join("\n");

  const { message } = await callModel({
    stage: "extract",
    caller: { userId: agentUserId, model },
    caseId: ctx.caseId,
    system:
      `You extract fields from a ${template.type} document. For every field below, report its ` +
      "value, your confidence (0 to 1), the page number you read it from, and a short quote of " +
      "the evidence text. If a field isn't present, omit it rather than guessing.\n\n" +
      `Fields:\n${fieldPrompts}`,
    messages: [
      {
        role: "user",
        content: `Document text:\n\n${text.slice(0, 8000)}`,
      },
    ],
    tools: [
      {
        name: TOOL_NAME,
        description: "Report the extracted field values with confidence and evidence.",
        input_schema: {
          type: "object",
          properties: {
            fields: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string", enum: template.fields.map((f) => f.name) },
                  value: { type: ["string", "number", "boolean", "null"] },
                  confidence: { type: "number", minimum: 0, maximum: 1 },
                  source_page: { type: "integer" },
                  evidence: { type: "string" },
                },
                required: ["name", "value", "confidence"],
              },
            },
          },
          required: ["fields"],
        },
      },
    ],
    toolChoice: { type: "tool", name: TOOL_NAME },
  });

  const toolUse = message.content.find((b) => b.type === "tool_use" && b.name === TOOL_NAME);
  if (!toolUse || toolUse.type !== "tool_use") {
    return { ok: false, error: "model did not return a tool_use block" };
  }

  const raw = (toolUse.input as { fields: RawField[] }).fields;
  const extracted: ExtractedField[] = raw.map((f) => ({
    name: f.name,
    value: f.value,
    modelConfidence: f.confidence,
    sourcePage: f.source_page,
    evidence: f.evidence,
  }));

  if (extracted.length > 0) {
    const typeByName = new Map(template.fields.map((f) => [f.name, f.type]));
    await db.insert(fieldsTable).values(
      extracted.map((f) => ({
        documentId: ctx.documentId!,
        name: f.name,
        dataType: typeByName.get(f.name) ?? "string",
        value: f.value,
        modelConfidence: String(f.modelConfidence),
        sourcePage: f.sourcePage,
        evidence: f.evidence,
        setBy: agentUserId,
      })),
    );
  }

  await appendAuditEvent(db, {
    actor: agentUserId,
    action: "document.extracted",
    entity: `document:${ctx.documentId}`,
    after: { fieldCount: extracted.length },
    model,
  });

  await enqueueJob("score", { caseId: ctx.caseId, packageId: ctx.packageId, documentId: ctx.documentId });

  return { ok: true, data: { fields: extracted } };
}
