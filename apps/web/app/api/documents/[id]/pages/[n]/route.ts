import { NextResponse } from "next/server";

/**
 * GET /api/documents/:id/pages/:n — rendered page image for the review
 * screen.
 * TODO: render the page (pdfjs + sharp) or read a cached PNG from MinIO,
 * stream it back with image/png content type.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; n: string }> },
) {
  const { id, n } = await params;
  return NextResponse.json({ error: "not implemented", id, page: n }, { status: 501 });
}
