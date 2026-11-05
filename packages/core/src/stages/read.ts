import type { StageContext, StageResult } from "./types.js";

export interface PageContent {
  pageNumber: number;
  /** Present when the page has a text layer */
  text?: string;
  /** Present when the page has no text layer (e.g. a scanned page); PNG bytes */
  imagePng?: Uint8Array;
}

export interface ReadResult {
  pages: PageContent[];
}

/**
 * Pulls each page's text layer with pdfjs. Pages with no text (fake scans)
 * get rendered to PNG via sharp and passed to the model as images in later
 * stages.
 *
 * TODO: use pdfjs-dist to extract text per page; fall back to rendering +
 * sharp for image-only pages.
 */
export async function read(_ctx: StageContext): Promise<StageResult<ReadResult>> {
  throw new Error("not implemented");
}
