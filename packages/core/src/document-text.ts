import { db, documents, packages } from "@sift/db";
import { eq } from "drizzle-orm";
import { extractPageRangeText } from "./pdf";
import { getObject } from "./storage";

/** Fetches a document's row and re-derives its page-range text on demand. */
export async function getDocumentText(documentId: string): Promise<{
  doc: typeof documents.$inferSelect;
  text: string;
}> {
  const [doc] = await db.select().from(documents).where(eq(documents.id, documentId)).limit(1);
  if (!doc) {
    throw new Error(`document ${documentId} not found`);
  }

  const [pkg] = await db.select().from(packages).where(eq(packages.id, doc.packageId!)).limit(1);
  if (!pkg) {
    throw new Error(`package ${doc.packageId} not found`);
  }

  const bytes = await getObject(pkg.storageKey);
  const text = await extractPageRangeText(bytes, doc.pageStart ?? 1, doc.pageEnd ?? doc.pageStart ?? 1);
  return { doc, text };
}
