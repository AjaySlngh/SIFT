import type { StageContext, StageResult } from "./types.js";

export interface ClassifyResult {
  docType: string;
  confidence: number;
}

/**
 * Confirms the document type against the template descriptions and returns a
 * confidence. Anything below 0.80 or labeled `other` opens a reclassify task
 * (see scoring.ts `routeDocument`).
 *
 * TODO: call llm.ts with the template descriptions as context, compare against
 * the split stage's guessed type.
 */
export async function classify(_ctx: StageContext): Promise<StageResult<ClassifyResult>> {
  throw new Error("not implemented");
}
