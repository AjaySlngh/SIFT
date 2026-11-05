import { NextResponse } from "next/server";

/**
 * POST /api/cases/:id/packages — upload a PDF, hash it, store it in MinIO,
 * create the `packages` row, enqueue `split`.
 * TODO: stream the upload, sha256 it, reject duplicates, write to S3/MinIO,
 * insert `packages`, insert a `jobs` row for stage 'split'.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return NextResponse.json({ error: "not implemented", id }, { status: 501 });
}
