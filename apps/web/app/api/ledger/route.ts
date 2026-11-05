import { NextResponse } from "next/server";

/**
 * GET /api/ledger?case=<id> — token spend per case and per stage.
 * TODO: select + group from `token_ledger` where case_id = :case.
 */
export async function GET(request: Request) {
  const caseId = new URL(request.url).searchParams.get("case");
  return NextResponse.json({ error: "not implemented", caseId }, { status: 501 });
}
