import { db, documents, packages } from "@sift/db";
import { appendAuditEvent } from "@sift/db";
import { eq } from "drizzle-orm";
import { getAgentUserId } from "../agent";
import { enqueueJob } from "../jobs";
import { callModel, modelForStage } from "../llm";
import { extractAllPageText } from "../pdf";
import { getObject } from "../storage";
import { loadAllTemplates } from "../templates";
import type { StageContext, StageResult } from "./types";

export interface SplitDocument {
  pageStart: number;
  pageEnd: number;
  /** First-guess doc type, confirmed later in classify */
  guessedType: string;
}

export interface SplitResult {
  documents: SplitDocument[];
}

const TOOL_NAME = "report_documents";

/**
 * Sends the package's page text to a cheap, fast model and asks for page
 * ranges plus a first-guess type for each document. Inserts `documents` rows
 * and enqueues `read` for each one.
 */
export async function split(ctx: StageContext): Promise<StageResult<SplitResult>> {
  const [pkg] = await db.select().from(packages).where(eq(packages.id, ctx.packageId)).limit(1);
  if (!pkg) {
    return { ok: false, error: `package ${ctx.packageId} not found` };
  }

  const bytes = await getObject(pkg.storageKey);
  const pages = await extractAllPageText(bytes);
  const templates = loadAllTemplates();
  const typeNames = templates.map((t) => t.type);

  const pagesBlock = pages
    .map((p) => `--- page ${p.pageNumber} ---\n${p.text.slice(0, 1500)}`)
    .join("\n\n");

  const agentUserId = await getAgentUserId();
  const model = modelForStage("split");

  const { message } = await callModel({
    stage: "split",
    caller: { userId: agentUserId, model },
    caseId: ctx.caseId,
    system:
      "You split a multi-document PDF packet into its component documents. " +
      "Every page belongs to exactly one contiguous document. Guess each document's " +
      `type from this list (use "other" if nothing fits): ${typeNames.join(", ")}.`,
    messages: [
      {
        role: "user",
        content: `Here is the text of every page in the packet:\n\n${pagesBlock}`,
      },
    ],
    tools: [
      {
        name: TOOL_NAME,
        description: "Report the page ranges and guessed document type for each document in the packet.",
        input_schema: {
          type: "object",
          properties: {
            documents: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  pageStart: { type: "integer", minimum: 1 },
                  pageEnd: { type: "integer", minimum: 1 },
                  guessedType: { type: "string", enum: typeNames },
                },
                required: ["pageStart", "pageEnd", "guessedType"],
              },
            },
          },
          required: ["documents"],
        },
      },
    ],
    toolChoice: { type: "tool", name: TOOL_NAME },
  });

  const toolUse = message.content.find((b) => b.type === "tool_use" && b.name === TOOL_NAME);
  if (!toolUse || toolUse.type !== "tool_use") {
    return { ok: false, error: "model did not return a tool_use block" };
  }

  const parsed = toolUse.input as SplitResult;
  if (!parsed.documents || parsed.documents.length === 0) {
    return { ok: false, error: "model returned zero documents" };
  }

  const sorted = [...parsed.documents].sort((a, b) => a.pageStart - b.pageStart);

  const inserted = await db
    .insert(documents)
    .values(
      sorted.map((d) => ({
        packageId: ctx.packageId,
        pageStart: d.pageStart,
        pageEnd: d.pageEnd,
        docType: d.guessedType,
        status: "pending" as const,
      })),
    )
    .returning({ id: documents.id });

  for (const doc of inserted) {
    await enqueueJob("read", { caseId: ctx.caseId, packageId: ctx.packageId, documentId: doc.id });
  }

  await appendAuditEvent(db, {
    actor: agentUserId,
    action: "package.split",
    entity: `package:${ctx.packageId}`,
    after: { documentCount: inserted.length },
    model,
  });

  return { ok: true, data: { documents: sorted } };
}
