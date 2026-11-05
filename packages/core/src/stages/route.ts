import type { RoutingDecision } from "../scoring.js";
import type { StageContext, StageResult } from "./types.js";

/**
 * Auto-accepts the document or opens a review task, and picks 1 in 20
 * auto-accepted documents for a spot check (see scoring.ts `routeDocument`).
 *
 * TODO: apply routeDocument's decision, write the document's status, and
 * open a `tasks` row when the outcome isn't auto_accepted.
 */
export async function route(_ctx: StageContext): Promise<StageResult<RoutingDecision>> {
  throw new Error("not implemented");
}
