// backend/src/core/ai/packages/packages.types.ts
export interface PackageProposeRequest {
  workspace: 'backend' | 'frontend';
  packageName: string;
  version?: string;
  reason: string;
}

export interface PackageProposeResponse {
  summary: string;
  proposedCommand: string;
  risk_level: 'low' | 'medium' | 'high';
}

export interface PackageInstallRequest {
  approvalToken: string;
  workspace: 'backend' | 'frontend';
  packageName: string;
  version?: string;
}

export interface PackageInstallResponse {
  success: boolean;
  message: string;
  stdoutTail: string;
  installedAt: string;
}


