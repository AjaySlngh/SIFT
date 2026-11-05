import { NextResponse } from "next/server";

/**
 * POST /api/tasks/:id/resolve — approve, correct fields, or reclassify.
 * TODO: apply the resolution, update `fields.set_by` on corrections, write
 * the audit event with before/after in the same transaction, close the task.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return NextResponse.json({ error: "not implemented", id }, { status: 501 });
}
