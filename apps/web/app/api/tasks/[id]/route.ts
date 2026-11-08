import { cases, db, documents, fields, tasks } from "@sift/db";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

/**
 * GET /api/tasks/:id — the task plus its case, document, and fields, so the
 * review screen can render in one request.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [task] = await db.select().from(tasks).where(eq(tasks.id, id)).limit(1);
  if (!task) {
    return NextResponse.json({ error: "task not found" }, { status: 404 });
  }

  const [caseRow] = task.caseId
    ? await db.select().from(cases).where(eq(cases.id, task.caseId)).limit(1)
    : [undefined];

  const [document] = task.documentId
    ? await db.select().from(documents).where(eq(documents.id, task.documentId)).limit(1)
    : [undefined];

  const fieldRows = task.documentId
    ? await db.select().from(fields).where(eq(fields.documentId, task.documentId))
    : [];

  return NextResponse.json({ ...task, case: caseRow, document, fields: fieldRows });
}
