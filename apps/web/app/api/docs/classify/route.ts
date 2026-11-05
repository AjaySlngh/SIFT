import { NextResponse } from "next/server";

/**
 * POST /api/docs/classify — run the classify stage on one document now
 * (synchronous, handy for testing one stage on one document).
 * TODO: call @sift/core stages.classify directly and write the result.
 */
export async function POST(_request: Request) {
  return NextResponse.json({ error: "not implemented" }, { status: 501 });
}
