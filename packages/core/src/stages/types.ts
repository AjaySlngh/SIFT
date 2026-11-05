export interface StageContext {
  caseId: string;
  packageId: string;
}

export interface StageResult<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
}
