import type { StageContext, StageResult } from "./types.js";

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
 *
 * TODO: tally accepted documents by doc_type against templates, and if
 * incomplete, call llm.ts to draft a letter and open an `approve_letter` task.
 */
export async function act(_ctx: StageContext): Promise<StageResult<ActResult>> {
  throw new Error("not implemented");
}
