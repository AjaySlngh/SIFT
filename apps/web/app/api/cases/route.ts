import { NextResponse } from "next/server";

/**
 * POST /api/cases — create a case.
 * TODO: insert into `cases`, write an audit event for case.created with the
 * acting user from the session.
 */
export async function POST(_request: Request) {
  return NextResponse.json({ error: "not implemented" }, { status: 501 });
}
