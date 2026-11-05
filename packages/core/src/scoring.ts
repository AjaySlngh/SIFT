import type { DocumentTemplate, TemplateField } from "./templates.js";

export interface ExtractedField {
  name: string;
  value: unknown;
  modelConfidence: number;
  sourcePage?: number;
  evidence?: string;
}

export type CheckFailure = "parse_failure" | "rule_failure" | "cross_doc_mismatch" | "no_evidence";

export interface FieldScoreResult {
  name: string;
  score: number;
  failedChecks: CheckFailure[];
}

export interface ScoreFieldInput {
  field: ExtractedField;
  /** true if the value failed to parse as its declared type (date/money/boolean) */
  parseFailed: boolean;
  /** true if a template rule check referencing this field failed */
  ruleFailed: boolean;
  /** true if this field disagrees with another document after normalization + fuzzy match */
  crossDocMismatch: boolean;
}

// Starting guesses from the design spec. Tune against the eval set, not by feel.
export const SCORE_MULTIPLIERS = {
  ruleFailure: 0.5,
  crossDocMismatch: 0.6,
  noEvidence: 0.7,
} as const;

export function scoreField(input: ScoreFieldInput): FieldScoreResult {
  const failedChecks: CheckFailure[] = [];

  if (input.parseFailed) {
    return { name: input.field.name, score: 0, failedChecks: ["parse_failure"] };
  }

  let score = input.field.modelConfidence;

  if (input.ruleFailed) {
    score *= SCORE_MULTIPLIERS.ruleFailure;
    failedChecks.push("rule_failure");
  }
  if (input.crossDocMismatch) {
    score *= SCORE_MULTIPLIERS.crossDocMismatch;
    failedChecks.push("cross_doc_mismatch");
  }
  if (!input.field.sourcePage || !input.field.evidence) {
    score *= SCORE_MULTIPLIERS.noEvidence;
    failedChecks.push("no_evidence");
  }

  return { name: input.field.name, score, failedChecks };
}

export interface DocumentScoreResult {
  score: number;
  fieldScores: FieldScoreResult[];
}

/** Weighted average of field scores, using the template's field weights. */
export function scoreDocument(
  template: DocumentTemplate,
  fieldScores: FieldScoreResult[],
): DocumentScoreResult {
  const weightByName = new Map<string, number>(
    template.fields.map((f: TemplateField) => [f.name, f.weight]),
  );

  let weightedSum = 0;
  let totalWeight = 0;
  for (const fs of fieldScores) {
    const weight = weightByName.get(fs.name) ?? 1;
    weightedSum += fs.score * weight;
    totalWeight += weight;
  }

  return {
    score: totalWeight > 0 ? weightedSum / totalWeight : 0,
    fieldScores,
  };
}

export const ROUTING_THRESHOLDS = {
  autoAcceptFieldScore: 0.85,
  classificationConfidence: 0.8,
  spotCheckSampleRate: 1 / 20,
} as const;

export type RoutingDecision =
  | { outcome: "auto_accepted" }
  | { outcome: "spot_check" }
  | { outcome: "review"; reason: "weak_fields" | "reclassify" };

export function routeDocument(params: {
  classConfidence: number;
  docType: string;
  fieldScores: FieldScoreResult[];
  requiredFieldsPresent: boolean;
  random?: () => number;
}): RoutingDecision {
  if (params.classConfidence < ROUTING_THRESHOLDS.classificationConfidence || params.docType === "other") {
    return { outcome: "review", reason: "reclassify" };
  }

  const allFieldsStrong = params.fieldScores.every(
    (f) => f.score >= ROUTING_THRESHOLDS.autoAcceptFieldScore && f.failedChecks.length === 0,
  );

  if (!allFieldsStrong || !params.requiredFieldsPresent) {
    return { outcome: "review", reason: "weak_fields" };
  }

  const rand = params.random ?? Math.random;
  if (rand() < ROUTING_THRESHOLDS.spotCheckSampleRate) {
    return { outcome: "spot_check" };
  }

  return { outcome: "auto_accepted" };
}
