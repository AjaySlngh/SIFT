import { eq } from "drizzle-orm";
import { db, users } from "@sift/db";

/**
 * Seeds the users the demo needs: one reviewer, one admin, and one agent
 * account. Re-running is safe — it skips names that already exist.
 */
async function main() {
  const seedUsers = [
    { name: "Dana Reviewer", kind: "human" as const, role: "reviewer" as const, model: null },
    { name: "Alex Admin", kind: "human" as const, role: "admin" as const, model: null },
    {
      name: "sift-agent",
      kind: "agent" as const,
      role: "agent" as const,
      model: process.env.SIFT_MODEL_EXTRACT ?? "claude-sonnet-4-5",
    },
  ];

  for (const u of seedUsers) {
    const [existing] = await db.select().from(users).where(eq(users.name, u.name)).limit(1);
    if (existing) {
      console.log(`skipping existing user: ${u.name}`);
      continue;
    }
    await db.insert(users).values(u);
    console.log(`seeded user: ${u.name} (${u.role})`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
