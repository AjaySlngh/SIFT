import { db, users } from "@sift/db";
import { NextResponse } from "next/server";

/**
 * GET /api/users — seeded users, for the actor picker. There's no
 * session/auth yet, so the UI lets you pick which seeded user you're acting
 * as and sends that id as `actorId` on every write.
 */
export async function GET() {
  const rows = await db
    .select({ id: users.id, name: users.name, kind: users.kind, role: users.role })
    .from(users);
  return NextResponse.json(rows);
}
