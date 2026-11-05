import { NextResponse } from "next/server";

/**
 * POST /api/docs/queue/classify — enqueue the classify stage instead of
 * running it synchronously.
 * TODO: insert a `jobs` row with stage 'classify'.
 */
export async function POST(_request: Request) {
  return NextResponse.json({ error: "not implemented" }, { status: 501 });
}
