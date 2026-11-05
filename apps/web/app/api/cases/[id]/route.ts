import { NextResponse } from "next/server";

/**
 * GET /api/cases/:id — case with documents, fields, status.
 * TODO: join cases -> packages -> documents -> fields.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return NextResponse.json({ error: "not implemented", id }, { status: 501 });
}
