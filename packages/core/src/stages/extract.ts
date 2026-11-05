import type { ExtractedField } from "../scoring.js";
import type { StageContext, StageResult } from "./types.js";

export interface ExtractResult {
  fields: ExtractedField[];
}

/**
 * One call per document, using tool use with a JSON schema built from the
 * document's template, so the output is always well-formed. Each field
 * returns `value`, `confidence`, `source_page` and `evidence`.
 *
 * TODO: build a JSON schema from the template's fields, call llm.ts with
 * forced tool use, map the response into ExtractedField[].
 */
export async function extract(_ctx: StageContext): Promise<StageResult<ExtractResult>> {
  throw new Error("not implemented");
}
