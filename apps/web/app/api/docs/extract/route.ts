import { NextResponse } from "next/server";

/**
 * POST /api/docs/extract — run the extract stage on one document now.
 * TODO: call @sift/core stages.extract directly and write the result.
 */
export async function POST(_request: Request) {
  return NextResponse.json({ error: "not implemented" }, { status: 501 });
}
