import { NextResponse } from "next/server";

/**
 * GET /api/worklist?assignee=me — open tasks.
 * TODO: select from `tasks` where status = 'open', filter by assignee,
 * order by age.
 */
export async function GET(request: Request) {
  const assignee = new URL(request.url).searchParams.get("assignee");
  return NextResponse.json({ error: "not implemented", assignee }, { status: 501 });
}
