import { db, tokenLedger } from "@sift/db";
import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

/**
 * GET /api/ledger?case=<id> — token spend, newest first. Omit `case` to see
 * spend across every case.
 */
export async function GET(request: Request) {
  const caseId = new URL(request.url).searchParams.get("case");

  const rows = caseId
    ? await db.select().from(tokenLedger).where(eq(tokenLedger.caseId, caseId)).orderBy(desc(tokenLedger.at))
    : await db.select().from(tokenLedger).orderBy(desc(tokenLedger.at));

  const totalUsd = rows.reduce((sum, r) => sum + Number(r.usd ?? 0), 0);
  const totalInputTokens = rows.reduce((sum, r) => sum + (r.inputTokens ?? 0), 0);
  const totalOutputTokens = rows.reduce((sum, r) => sum + (r.outputTokens ?? 0), 0);

  return NextResponse.json({ rows, totalUsd, totalInputTokens, totalOutputTokens });
}
