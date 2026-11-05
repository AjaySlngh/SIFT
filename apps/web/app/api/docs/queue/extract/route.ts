import { NextResponse } from "next/server";

/**
 * POST /api/docs/queue/extract — enqueue the extract stage instead of
 * running it synchronously.
 * TODO: insert a `jobs` row with stage 'extract'.
 */
export async function POST(_request: Request) {
  return NextResponse.json({ error: "not implemented" }, { status: 501 });
}
