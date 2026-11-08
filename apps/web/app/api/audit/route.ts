import { auditEvents, db, documents, fields, packages } from "@sift/db";
import { asc, eq, inArray, or } from "drizzle-orm";
import { NextResponse } from "next/server";

/**
 * GET /api/audit?entity=case:<id> — audit trail for one entity.
 * GET /api/audit?caseId=<id> — the whole trail for a case, including its
 * packages, documents, and fields (so the case page's audit tab doesn't need
 * N requests).
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const entity = url.searchParams.get("entity");
  const caseId = url.searchParams.get("caseId");

  if (entity) {
    const rows = await db.select().from(auditEvents).where(eq(auditEvents.entity, entity)).orderBy(asc(auditEvents.id));
    return NextResponse.json(rows);
  }

  if (caseId) {
    const packageRows = await db.select({ id: packages.id }).from(packages).where(eq(packages.caseId, caseId));
    const packageIds = packageRows.map((p) => p.id);

    const documentRows = packageIds.length
      ? await db.select({ id: documents.id }).from(documents).where(inArray(documents.packageId, packageIds))
      : [];
    const documentIds = documentRows.map((d) => d.id);

    const fieldRows = documentIds.length
      ? await db.select({ id: fields.id }).from(fields).where(inArray(fields.documentId, documentIds))
      : [];

    const entities = [
      `case:${caseId}`,
      ...packageIds.map((id) => `package:${id}`),
      ...documentIds.map((id) => `document:${id}`),
      ...fieldRows.map((f) => `field:${f.id}`),
    ];

    const rows = await db
      .select()
      .from(auditEvents)
      .where(or(...entities.map((e) => eq(auditEvents.entity, e))))
      .orderBy(asc(auditEvents.id));
    return NextResponse.json(rows);
  }

  return NextResponse.json({ error: "entity or caseId query param is required" }, { status: 400 });
}
