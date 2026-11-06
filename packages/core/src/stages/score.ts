import { appendAuditEvent, cases, db, documents, fields as fieldsTable, packages } from "@sift/db";
import { and, eq } from "drizzle-orm";
import { getAgentUserId } from "../agent";
import { enqueueJob } from "../jobs";
import {
  scoreDocument,
  scoreField,
  type CheckFailure,
  type DocumentScoreResult,
  type ExtractedField,
  type FieldScoreResult,
} from "../scoring";
import { loadTemplate } from "../templates";
import type { StageContext, StageResult } from "./types";

const IDENTITY_FIELD_NAMES = new Set(["borrower_name", "employee_name", "account_holder"]);

function parseMoney(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/[$,\s]/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) && cleaned !== "" ? n : null;
}

function parseDateValue(value: unknown): Date | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseBooleanValue(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const v = value.trim().toLowerCase();
    if (v === "yes" || v === "true") return true;
    if (v === "no" || v === "false") return false;
  }
  return null;
}

/** Normalizes case + whitespace for fuzzy name/identity comparison. */
function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Classic Levenshtein edit distance, used for a simple fuzzy-match ratio. */
function levenshtein(a: string, b: string): number {
  const dp: number[][] = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) dp[i]![0] = i;
  for (let j = 0; j <= b.length; j++) dp[0]![j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i]![j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1]![j - 1]!
          : 1 + Math.min(dp[i - 1]![j]!, dp[i]![j - 1]!, dp[i - 1]![j - 1]!);
    }
  }
  return dp[a.length]![b.length]!;
}

function fuzzyMatches(a: string, b: string, threshold = 0.85): boolean {
  const na = normalize(a);
  const nb = normalize(b);
  if (na === nb) return true;
  const maxLen = Math.max(na.length, nb.length);
  if (maxLen === 0) return true;
  const ratio = 1 - levenshtein(na, nb) / maxLen;
  return ratio >= threshold;
}

/** Evaluates `net_pay <= gross_pay`-style checks. Returns the field names implicated on failure. */
function evalComparisonCheck(
  check: string,
  valueByName: Map<string, unknown>,
): { evaluated: boolean; passed: boolean; fieldNames: string[] } | null {
  const m = check.match(/^(\w+)\s*(<=|>=|<|>)\s*(\w+)$/);
  if (!m) return null;
  const [, left, op, right] = m as unknown as [string, string, string, string];
  const l = parseMoney(valueByName.get(left));
  const r = parseMoney(valueByName.get(right));
  if (l === null || r === null) return { evaluated: false, passed: true, fieldNames: [left, right] };

  const passed = op === "<=" ? l <= r : op === ">=" ? l >= r : op === "<" ? l < r : l > r;
  return { evaluated: true, passed, fieldNames: [left, right] };
}

/** Evaluates `field within N days of case.created_at`-style checks. */
function evalWithinDaysCheck(
  check: string,
  valueByName: Map<string, unknown>,
  caseCreatedAt: Date,
): { evaluated: boolean; passed: boolean; fieldNames: string[] } | null {
  const m = check.match(/^(\w+)\s+within\s+(\d+)\s+days\s+of\s+case\.created_at$/);
  if (!m) return null;
  const [, fieldName, daysStr] = m as unknown as [string, string, string];
  const date = parseDateValue(valueByName.get(fieldName));
  if (!date) return { evaluated: false, passed: true, fieldNames: [fieldName] };

  const days = Number(daysStr);
  const diffDays = Math.abs(date.getTime() - caseCreatedAt.getTime()) / (1000 * 60 * 60 * 24);
  return { evaluated: true, passed: diffDays <= days, fieldNames: [fieldName] };
}

/**
 * Runs parse checks, template rules, and cross-document matching, then
 * computes field and document scores via scoring.ts.
 */
export async function score(ctx: StageContext): Promise<StageResult<DocumentScoreResult>> {
  if (!ctx.documentId) {
    return { ok: false, error: "score requires a documentId" };
  }

  const [doc] = await db.select().from(documents).where(eq(documents.id, ctx.documentId)).limit(1);
  if (!doc || !doc.docType) {
    return { ok: false, error: `document ${ctx.documentId} not found or not classified` };
  }

  const template = loadTemplate(doc.docType);
  const extractedRows = await db.select().from(fieldsTable).where(eq(fieldsTable.documentId, ctx.documentId));

  const [caseRow] = await db.select().from(cases).where(eq(cases.id, ctx.caseId)).limit(1);
  const caseCreatedAt = caseRow?.createdAt ?? new Date();

  // Pull the packet's identity value (assistance_application.borrower_name) for cross-doc matching.
  let identityValue: string | null = null;
  if (doc.docType !== "assistance_application") {
    const [application] = await db
      .select({ id: documents.id })
      .from(documents)
      .innerJoin(packages, eq(documents.packageId, packages.id))
      .where(and(eq(packages.id, doc.packageId!), eq(documents.docType, "assistance_application")))
      .limit(1);

    if (application) {
      const [nameField] = await db
        .select()
        .from(fieldsTable)
        .where(and(eq(fieldsTable.documentId, application.id), eq(fieldsTable.name, "borrower_name")))
        .limit(1);
      if (nameField && typeof nameField.value === "string") {
        identityValue = nameField.value;
      }
    }
  }

  const valueByName = new Map<string, unknown>(extractedRows.map((r) => [r.name!, r.value]));
  const ruleFailedNames = new Set<string>();

  for (const check of template.checks) {
    const comparison = evalComparisonCheck(check, valueByName);
    const within = comparison ?? evalWithinDaysCheck(check, valueByName, caseCreatedAt);
    if (within?.evaluated && !within.passed) {
      for (const name of within.fieldNames) ruleFailedNames.add(name);
    }
  }

  const fieldScores: FieldScoreResult[] = [];
  for (const row of extractedRows) {
    const templateField = template.fields.find((f) => f.name === row.name);
    const dataType = templateField?.type ?? row.dataType ?? "string";

    let parseFailed = false;
    if (dataType === "date") parseFailed = parseDateValue(row.value) === null;
    else if (dataType === "money") parseFailed = parseMoney(row.value) === null;
    else if (dataType === "boolean") parseFailed = parseBooleanValue(row.value) === null;
    else parseFailed = row.value === null || row.value === "";

    let crossDocMismatch = false;
    if (IDENTITY_FIELD_NAMES.has(row.name!) && identityValue && typeof row.value === "string") {
      crossDocMismatch = !fuzzyMatches(row.value, identityValue);
    }

    const extractedField: ExtractedField = {
      name: row.name!,
      value: row.value,
      modelConfidence: Number(row.modelConfidence ?? 0),
      sourcePage: row.sourcePage ?? undefined,
      evidence: row.evidence ?? undefined,
    };

    const result = scoreField({
      field: extractedField,
      parseFailed,
      ruleFailed: ruleFailedNames.has(row.name!),
      crossDocMismatch,
    });

    fieldScores.push(result);

    await db
      .update(fieldsTable)
      .set({ score: String(result.score), failedChecks: result.failedChecks as unknown as string[] })
      .where(eq(fieldsTable.id, row.id));
  }

  const docScore = scoreDocument(template, fieldScores);

  await db
    .update(documents)
    .set({ score: String(docScore.score) })
    .where(eq(documents.id, ctx.documentId));

  const agentUserId = await getAgentUserId();
  await appendAuditEvent(db, {
    actor: agentUserId,
    action: "document.scored",
    entity: `document:${ctx.documentId}`,
    after: { score: docScore.score, failedChecks: fieldScores.flatMap((f) => f.failedChecks) as CheckFailure[] },
  });

  await enqueueJob("route", { caseId: ctx.caseId, packageId: ctx.packageId, documentId: ctx.documentId });

  return { ok: true, data: docScore };
}
