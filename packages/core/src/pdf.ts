import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
// pdfjs-dist ships this worker entry without type declarations.
// @ts-expect-error - no types for pdfjs-dist/legacy/build/pdf.worker.mjs
import * as pdfjsWorker from "pdfjs-dist/legacy/build/pdf.worker.mjs";

// pdfjs's Node "fake worker" (no real worker_threads) normally loads its
// message handler via a *dynamic* `import()` of a computed path, which
// bundlers (Turbopack/webpack) can't statically analyze or include in their
// chunk graph. pdfjs explicitly supports sidestepping this by checking
// `globalThis.pdfjsWorker.WorkerMessageHandler` first — registering it via a
// normal static import (which bundlers handle fine) avoids the dynamic
// import path entirely. See pdf.mjs's `#mainThreadWorkerMessageHandler`.
(globalThis as unknown as { pdfjsWorker?: typeof pdfjsWorker }).pdfjsWorker = pdfjsWorker;

// Resolved lazily (not at module evaluation time) because bundlers that
// statically analyze/transform `require.resolve` calls (e.g. Next.js's
// Turbopack build-time "collect page data" pass) don't always return a real
// filesystem path when a module is merely imported, not actually invoked.
let cachedStandardFontDataUrl: string | undefined;
function getStandardFontDataUrl(): string {
  if (!cachedStandardFontDataUrl) {
    const require = createRequire(import.meta.url);
    cachedStandardFontDataUrl = join(dirname(require.resolve("pdfjs-dist/package.json")), "standard_fonts") + "/";
  }
  return cachedStandardFontDataUrl;
}

export interface PageText {
  pageNumber: number;
  text: string;
}


/** Returns the number of pages in a PDF without extracting text. */
export async function getPageCount(bytes: Uint8Array): Promise<number> {
  const doc = await getDocument({ data: bytes, standardFontDataUrl: getStandardFontDataUrl() }).promise;
  const count = doc.numPages;
  await doc.destroy();
  return count;
}

/** Extracts the text layer for every page in the PDF, 1-indexed. */
export async function extractAllPageText(bytes: Uint8Array): Promise<PageText[]> {
  const doc = await getDocument({ data: bytes, standardFontDataUrl: getStandardFontDataUrl() }).promise;
  const pages: PageText[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const text = content.items.map((item) => ("str" in item ? item.str : "")).join(" ").trim();
    pages.push({ pageNumber: i, text });
  }
  await doc.destroy();
  return pages;
}

/** Extracts and joins the text for an inclusive page range, 1-indexed. */
export async function extractPageRangeText(
  bytes: Uint8Array,
  pageStart: number,
  pageEnd: number,
): Promise<string> {
  const doc = await getDocument({ data: bytes, standardFontDataUrl: getStandardFontDataUrl() }).promise;
  const parts: string[] = [];
  for (let i = pageStart; i <= pageEnd; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const text = content.items.map((item) => ("str" in item ? item.str : "")).join(" ").trim();
    parts.push(`[page ${i}]\n${text}`);
  }
  await doc.destroy();
  return parts.join("\n\n");
}
