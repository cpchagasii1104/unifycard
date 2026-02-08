// backend/src/modules/marketplace/fiscal-document.types.ts
// SPRINT 44: DOCUMENTO FISCAL - BASE CANÔNICA
// Tipos TypeScript para documentos fiscais

export type FiscalDocumentType = 'NFCE' | 'NFE' | 'SAT' | 'NONE';
export type FiscalDocumentStatus = 'DRAFT' | 'ISSUED' | 'CANCELLED';

export interface FiscalDocument {
  id: string;
  tenantId: string;
  orderId: string;
  paymentIntentId: string | null;
  documentType: FiscalDocumentType;
  status: FiscalDocumentStatus;
  totalAmount: number;
  metadata: Record<string, any> | null;
  issuedAt: Date | null;
  createdAt: string;
  updatedAt: string;
}

export interface FiscalDocumentItem {
  id: string;
  fiscalDocumentId: string;
  productVariantId: string;
  quantity: number;
  unit: string;
  metadata: Record<string, any> | null;
  createdAt: string;
}

export interface CreateFiscalDocumentInput {
  orderId: string;
  paymentIntentId?: string;
  documentType: FiscalDocumentType;
  totalAmount: number;
  metadata?: Record<string, any>;
}

export interface IssueFiscalDocumentInput {
  metadata?: Record<string, any>;
}

export interface CancelFiscalDocumentInput {
  reason?: string;
  metadata?: Record<string, any>;
}








