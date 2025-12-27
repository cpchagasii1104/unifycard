// backend/src/core/ai/patch/patch-apply.types.ts
export interface ApplyPatchRequest {
  approvalToken: string;
  filePath: string;
  diff: string;
}

export interface ApplyPatchResponse {
  success: boolean;
  message: string;
  backupPath?: string;
  appliedAt: string;
}


