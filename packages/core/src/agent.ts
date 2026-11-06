import { db, users } from "@sift/db";
import { eq } from "drizzle-orm";

/**
 * Looks up the seeded agent account (kind='agent', role='agent') that
 * performs every automated model-driven action. Cached after first lookup.
 */
let cachedAgentId: string | null = null;

export async function getAgentUserId(): Promise<string> {
  if (cachedAgentId) return cachedAgentId;

  const [agent] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.kind, "agent"))
    .limit(1);

  if (!agent) {
    throw new Error("no seeded agent user found — run `pnpm seed` first");
  }

  cachedAgentId = agent.id;
  return agent.id;
}
