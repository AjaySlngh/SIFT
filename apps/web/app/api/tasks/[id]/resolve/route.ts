import { enqueueJob } from "@sift/core";
import { appendAuditEvent, db, documents, fields as fieldsTable, packages, tasks, users } from "@sift/db";
import { and, eq, ne } from "drizzle-orm";
import { NextResponse } from "next/server";

interface FieldEdit {
  fieldId: string;
  value: string | number | boolean | null;
  reason: string;
}

interface ResolveBody {
  actorId: string;
  action: "approve" | "edit" | "reclassify" | "reject";
  fieldEdits?: FieldEdit[];
  newDocType?: string;
  reason?: string;
}

/** Mirrors route.ts's completeness check: once every document in the case is
 * accepted, enqueue `act` to run it. */
async function maybeEnqueueAct(caseId: string, packageId: string) {
  const pending = await db
    .select({ id: documents.id })
    .from(documents)
    .innerJoin(packages, eq(documents.packageId, packages.id))
    .where(and(eq(packages.caseId, caseId), ne(documents.status, "accepted")))
    .limit(1);

  if (pending.length === 0) {
    await enqueueJob("act", { caseId, packageId });
  }
}

/**
 * POST /api/tasks/:id/resolve — approve, correct fields, reclassify, or
 * reject. Every write is paired with an audit event describing before/after.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let body: ResolveBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  if (!body.actorId) {
    return NextResponse.json({ error: "actorId is required" }, { status: 400 });
  }
  if (!body.action) {
    return NextResponse.json({ error: "action is required" }, { status: 400 });
  }

  const [actor] = await db.select({ id: users.id }).from(users).where(eq(users.id, body.actorId)).limit(1);
  if (!actor) {
    return NextResponse.json({ error: "actorId does not match a known user" }, { status: 400 });
  }

  const [task] = await db.select().from(tasks).where(eq(tasks.id, id)).limit(1);
  if (!task) {
    return NextResponse.json({ error: "task not found" }, { status: 404 });
  }
  if (task.status !== "open") {
    return NextResponse.json({ error: `task already ${task.status}` }, { status: 409 });
  }

  let document: typeof documents.$inferSelect | undefined;
  let pkg: typeof packages.$inferSelect | undefined;
  if (task.documentId) {
    [document] = await db.select().from(documents).where(eq(documents.id, task.documentId)).limit(1);
    if (document?.packageId) {
      [pkg] = await db.select().from(packages).where(eq(packages.id, document.packageId)).limit(1);
    }
  }

  if (task.kind === "approve_letter") {
    if (body.action !== "approve" && body.action !== "reject") {
      return NextResponse.json({ error: "approve_letter tasks only accept approve or reject" }, { status: 400 });
    }
    await appendAuditEvent(db, {
      actor: body.actorId,
      action: body.action === "approve" ? "case.letter_approved" : "case.letter_rejected",
      entity: `case:${task.caseId}`,
    });
  } else {
    // review_fields | reclassify | spot_check
    if (!document) {
      return NextResponse.json({ error: "task has no associated document" }, { status: 400 });
    }

    if (body.action === "reject") {
      await db.update(documents).set({ status: "rejected" }).where(eq(documents.id, document.id));
      await appendAuditEvent(db, {
        actor: body.actorId,
        action: "document.rejected",
        entity: `document:${document.id}`,
        before: { status: document.status },
        after: { status: "rejected", reason: body.reason },
      });
    } else if (body.action === "reclassify") {
      if (!body.newDocType) {
        return NextResponse.json({ error: "newDocType is required to reclassify" }, { status: 400 });
      }
      await db
        .update(documents)
        .set({ docType: body.newDocType, classConfidence: "1", status: "pending" })
        .where(eq(documents.id, document.id));
      await appendAuditEvent(db, {
        actor: body.actorId,
        action: "document.reclassified",
        entity: `document:${document.id}`,
        before: { docType: document.docType },
        after: { docType: body.newDocType },
      });
      if (pkg) {
        await enqueueJob("extract", { caseId: task.caseId!, packageId: pkg.id, documentId: document.id });
      }
    } else {
      // approve or edit — apply any field corrections, then accept the document.
      for (const edit of body.fieldEdits ?? []) {
        const [before] = await db.select().from(fieldsTable).where(eq(fieldsTable.id, edit.fieldId)).limit(1);
        if (!before) continue;
        await db
          .update(fieldsTable)
          .set({ value: edit.value, score: "1", failedChecks: [], setBy: body.actorId })
          .where(eq(fieldsTable.id, edit.fieldId));
        await appendAuditEvent(db, {
          actor: body.actorId,
          action: "field.corrected",
          entity: `field:${edit.fieldId}`,
          before: { value: before.value, score: before.score },
          after: { value: edit.value, score: 1, reason: edit.reason },
        });
      }

      await db.update(documents).set({ status: "accepted" }).where(eq(documents.id, document.id));
      await appendAuditEvent(db, {
        actor: body.actorId,
        action: "document.reviewed",
        entity: `document:${document.id}`,
        before: { status: document.status },
        after: { status: "accepted" },
      });

      if (pkg) {
        await maybeEnqueueAct(task.caseId!, pkg.id);
      }
    }
  }

  await db.update(tasks).set({ status: "resolved" }).where(eq(tasks.id, id));
  await appendAuditEvent(db, {
    actor: body.actorId,
    action: "task.resolved",
    entity: `task:${id}`,
    after: { action: body.action },
  });

  return NextResponse.json({ ok: true });
}
