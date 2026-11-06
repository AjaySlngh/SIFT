import { enqueueJob, getPageCount, putObject } from "@sift/core";
import { appendAuditEvent, cases, db, packages, users } from "@sift/db";
import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

/**
 * POST /api/cases/:id/packages — upload a PDF, hash it, store it in object
 * storage, create the `packages` row, enqueue `split`.
 *
 * multipart/form-data with fields:
 *   file     — the PDF
 *   actorId  — users.id of the uploader (no session/auth yet)
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: caseId } = await params;

  const [caseRow] = await db.select({ id: cases.id }).from(cases).where(eq(cases.id, caseId)).limit(1);
  if (!caseRow) {
    return NextResponse.json({ error: "case not found" }, { status: 404 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "expected multipart/form-data" }, { status: 400 });
  }

  const file = form.get("file");
  const actorId = form.get("actorId");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }
  if (typeof actorId !== "string" || !actorId) {
    return NextResponse.json({ error: "actorId is required" }, { status: 400 });
  }

  const [actor] = await db.select({ id: users.id }).from(users).where(eq(users.id, actorId)).limit(1);
  if (!actor) {
    return NextResponse.json({ error: "actorId does not match a known user" }, { status: 400 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const sha256 = createHash("sha256").update(bytes).digest("hex");

  const [existing] = await db.select().from(packages).where(eq(packages.sha256, sha256)).limit(1);
  if (existing) {
    return NextResponse.json({ error: "duplicate upload", package: existing }, { status: 409 });
  }

  let pageCount: number;
  try {
    // pdfjs's Node worker transfers (detaches) the underlying ArrayBuffer of
    // whatever is passed in, so hand it a copy — `bytes` itself is still
    // needed below for putObject.
    pageCount = await getPageCount(bytes.slice());
  } catch (err) {
    console.error("getPageCount failed", err);
    return NextResponse.json({ error: "could not parse PDF" }, { status: 400 });
  }

  const storageKey = `packages/${caseId}/${sha256}.pdf`;
  await putObject(storageKey, bytes, "application/pdf");

  const [created] = await db
    .insert(packages)
    .values({ caseId, storageKey, sha256, pageCount })
    .returning();

  await appendAuditEvent(db, {
    actor: actorId,
    action: "package.uploaded",
    entity: `package:${created!.id}`,
    after: { sha256, pageCount, storageKey },
  });

  await enqueueJob("split", { caseId, packageId: created!.id });

  return NextResponse.json(created, { status: 201 });
}
