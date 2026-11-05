import type { DocumentScoreResult } from "../scoring.js";
import type { StageContext, StageResult } from "./types.js";

/**
 * Runs parse checks, template rules, and cross-document matching, then
 * computes field and document scores via scoring.ts.
 *
 * TODO: load the document's template, validate each field's parsed type,
 * evaluate template `checks`, compare against other documents in the case
 * for cross-document mismatches, then call scoreField/scoreDocument.
 */
export async function score(_ctx: StageContext): Promise<StageResult<DocumentScoreResult>> {
  throw new Error("not implemented");
}
