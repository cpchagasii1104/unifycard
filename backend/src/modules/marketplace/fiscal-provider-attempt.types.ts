// backend/src/modules/marketplace/fiscal-provider-attempt.types.ts
// SPRINT 53: Tipos para tentativas de providers fiscais

export type FiscalProviderType = 'mock' | 'sefaz';
export type FiscalProviderAction = 'ISSUE' | 'CANCEL' | 'STATUS';
export type FiscalProviderAttemptStatus = 'SUCCESS' | 'FAILED' | 'SKIPPED';

export interface FiscalProviderAttempt {
  id: string;
  tenantId: string;
  fiscalDocumentId: string;
  provider: FiscalProviderType;
  action: FiscalProviderAction;
  status: FiscalProviderAttemptStatus;
  errorCode?: string | null;
  errorMessage?: string | null;
  metadata?: Record<string, any> | null;
  createdAt: string;
}

export interface CreateFiscalProviderAttemptInput {
  fiscalDocumentId: string;
  provider: FiscalProviderType;
  action: FiscalProviderAction;
  status: FiscalProviderAttemptStatus;
  errorCode?: string;
  errorMessage?: string;
  metadata?: Record<string, any>;
}








