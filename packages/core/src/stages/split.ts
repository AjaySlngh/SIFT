import type { StageContext, StageResult } from "./types.js";

export interface SplitDocument {
  pageStart: number;
  pageEnd: number;
  /** First-guess doc type, confirmed later in classify */
  guessedType: string;
}

export interface SplitResult {
  documents: SplitDocument[];
}

/**
 * Sends the whole PDF to a cheap, fast model and asks for page ranges plus a
 * first-guess type for each document. Enqueues `read` for each resulting
 * document once persisted.
 *
 * TODO: call packages/core/src/llm.ts with the package's pages (via pdfjs),
 * parse the tool-use response, and write `documents` rows.
 */
export async function split(_ctx: StageContext): Promise<StageResult<SplitResult>> {
  throw new Error("not implemented");
}
