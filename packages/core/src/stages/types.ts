export interface StageContext {
  caseId: string;
  packageId: string;
  /** Present for stages that operate on a single document (read onward) */
  documentId?: string;
}

export interface StageResult<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
}
