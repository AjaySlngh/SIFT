import { NextResponse } from "next/server";

/**
 * GET /api/audit?entity=case:<id> — audit trail for anything.
 * TODO: select from `audit_events` where entity = :entity order by at.
 */
export async function GET(request: Request) {
  const entity = new URL(request.url).searchParams.get("entity");
  return NextResponse.json({ error: "not implemented", entity }, { status: 501 });
}
