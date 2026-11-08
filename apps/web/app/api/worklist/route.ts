import { cases, db, documents, tasks } from "@sift/db";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

/**
 * GET /api/worklist?assignee=me — open tasks, newest first, with enough
 * case/document context to render the worklist table without extra fetches.
 */
export async function GET(request: Request) {
  const assignee = new URL(request.url).searchParams.get("assignee");

  const rows = await db
    .select({
      id: tasks.id,
      kind: tasks.kind,
      status: tasks.status,
      reason: tasks.reason,
      assignee: tasks.assignee,
      documentId: tasks.documentId,
      caseId: tasks.caseId,
      caseBorrowerName: cases.borrowerName,
      documentType: documents.docType,
    })
    .from(tasks)
    .leftJoin(cases, eq(tasks.caseId, cases.id))
    .leftJoin(documents, eq(tasks.documentId, documents.id))
    .where(eq(tasks.status, "open"))
    .orderBy(tasks.id);

  const filtered = assignee && assignee !== "me" ? rows.filter((r) => r.assignee === assignee) : rows;

  return NextResponse.json(filtered);
}
