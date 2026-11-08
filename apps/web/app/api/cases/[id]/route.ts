import { cases, db, documents, fields, packages } from "@sift/db";
import { asc, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";

/**
 * GET /api/cases/:id — case with its packages, documents, and fields.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [caseRow] = await db.select().from(cases).where(eq(cases.id, id)).limit(1);
  if (!caseRow) {
    return NextResponse.json({ error: "case not found" }, { status: 404 });
  }

  const packageRows = await db.select().from(packages).where(eq(packages.caseId, id));
  const packageIds = packageRows.map((p) => p.id);

  const documentRows = packageIds.length
    ? await db
        .select()
        .from(documents)
        .where(inArray(documents.packageId, packageIds))
        .orderBy(asc(documents.pageStart))
    : [];
  const documentIds = documentRows.map((d) => d.id);

  const fieldRows = documentIds.length
    ? await db.select().from(fields).where(inArray(fields.documentId, documentIds))
    : [];

  const fieldsByDocument = new Map<string, typeof fieldRows>();
  for (const f of fieldRows) {
    if (!f.documentId) continue;
    const list = fieldsByDocument.get(f.documentId) ?? [];
    list.push(f);
    fieldsByDocument.set(f.documentId, list);
  }

  const documentsByPackage = new Map<string, Array<(typeof documentRows)[number] & { fields: typeof fieldRows }>>();
  for (const d of documentRows) {
    if (!d.packageId) continue;
    const list = documentsByPackage.get(d.packageId) ?? [];
    list.push({ ...d, fields: fieldsByDocument.get(d.id) ?? [] });
    documentsByPackage.set(d.packageId, list);
  }

  return NextResponse.json({
    ...caseRow,
    packages: packageRows.map((p) => ({ ...p, documents: documentsByPackage.get(p.id) ?? [] })),
  });
}
