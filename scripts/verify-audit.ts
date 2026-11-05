import { asc } from "drizzle-orm";
import { auditEvents, db, hashAuditRow } from "@sift/db";

/**
 * Walks the audit_events hash chain in order and prints the first broken
 * link, if there is one. Exits non-zero on a broken chain so it can gate CI.
 */
async function main() {
  const rows = await db.select().from(auditEvents).orderBy(asc(auditEvents.id));

  let prevHash: string | null = null;
  for (const row of rows) {
    const expected = hashAuditRow(prevHash, {
      at: row.at instanceof Date ? row.at.toISOString() : String(row.at),
      actor: row.actor,
      action: row.action,
      entity: row.entity,
      before: row.before,
      after: row.after,
      model: row.model ?? undefined,
      requestId: row.requestId ?? undefined,
    });

    if (row.prevHash !== prevHash || row.hash !== expected) {
      console.error(`broken link at audit_events.id=${row.id}`);
      console.error(`  expected prev_hash=${prevHash} hash=${expected}`);
      console.error(`  found    prev_hash=${row.prevHash} hash=${row.hash}`);
      process.exit(1);
    }

    prevHash = row.hash;
  }

  console.log(`verified ${rows.length} audit events, chain intact.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
