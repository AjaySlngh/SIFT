import { enqueueJob } from "../jobs";
import { getDocumentText } from "../document-text";
import type { StageContext, StageResult } from "./types";

export interface ReadResult {
  text: string;
}

/**
 * Pulls the document's page range text layer with pdfjs. Classify and
 * extract re-derive this themselves (stateless, resumable), so this stage's
 * job is mainly to validate the pages actually have readable text and to act
 * as a checkpoint the worker can retry independently of split.
 *
 * TODO: pages with no text layer (fake scans) aren't rendered to PNG yet —
 * `generate-packets.ts`'s `scanPage()` is still a stub, so this path isn't
 * exercised. Once scans exist, fall back to sharp-rendered images here.
 */
export async function read(ctx: StageContext): Promise<StageResult<ReadResult>> {
  if (!ctx.documentId) {
    return { ok: false, error: "read requires a documentId" };
  }

  const { text } = await getDocumentText(ctx.documentId);

  if (!text.trim()) {
    console.warn(`document ${ctx.documentId} has no text layer (scan support not implemented yet)`);
  }

  await enqueueJob("classify", { caseId: ctx.caseId, packageId: ctx.packageId, documentId: ctx.documentId });

  return { ok: true, data: { text } };
}
