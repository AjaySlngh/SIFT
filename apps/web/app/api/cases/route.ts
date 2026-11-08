import { appendAuditEvent, cases, db, users } from "@sift/db";
import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

interface CreateCaseBody {
  borrowerName?: string;
  loanNumber?: string;
  /** users.id of the reviewer creating the case. No session/auth yet, so the
   * caller must pass it explicitly — every write route requires an actor. */
  actorId: string;
}

/**
 * GET /api/cases — list all cases, newest first.
 */
export async function GET() {
  const rows = await db.select().from(cases).orderBy(desc(cases.createdAt));
  return NextResponse.json(rows);
}

/**
 * POST /api/cases — create a case.
 */
export async function POST(request: Request) {
  let body: CreateCaseBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  if (!body.actorId) {
    return NextResponse.json({ error: "actorId is required" }, { status: 400 });
  }

  const [actor] = await db.select({ id: users.id }).from(users).where(eq(users.id, body.actorId)).limit(1);
  if (!actor) {
    return NextResponse.json({ error: "actorId does not match a known user" }, { status: 400 });
  }

  const [created] = await db
    .insert(cases)
    .values({ borrowerName: body.borrowerName, loanNumber: body.loanNumber })
    .returning();

  await appendAuditEvent(db, {
    actor: body.actorId,
    action: "case.created",
    entity: `case:${created!.id}`,
    after: { borrowerName: body.borrowerName, loanNumber: body.loanNumber },
  });

  return NextResponse.json(created, { status: 201 });
}
