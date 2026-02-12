// backend/src/modules/marketplace/fiscal-provider.types.ts
// SPRINT 45: FISCAL ADAPTER - Interface canônica para providers externos

import type { FiscalDocument, FiscalDocumentItem } from './fiscal-document.types';

/**
 * Resultado da emissão fiscal
 */
export interface FiscalIssueResult {
  success: boolean;
  documentId: string;
  chaveAcesso?: string; // Chave de acesso da NF-e/NFC-e
  protocolo?: string; // Protocolo de autorização
  xml?: string; // XML da nota (futuro)
  errorCode?: string;
  errorMessage?: string;
  metadata?: Record<string, any>;
}

/**
 * Resultado do cancelamento fiscal
 */
export interface FiscalCancelResult {
  success: boolean;
  documentId: string;
  protocoloCancelamento?: string; // Protocolo de cancelamento
  errorCode?: string;
  errorMessage?: string;
  metadata?: Record<string, any>;
}

/**
 * Status do documento fiscal no sistema externo
 */
export interface FiscalStatus {
  documentId: string;
  status: 'PENDING' | 'AUTHORIZED' | 'CANCELLED' | 'REJECTED' | 'UNKNOWN';
  chaveAcesso?: string;
  protocolo?: string;
  errorCode?: string;
  errorMessage?: string;
  metadata?: Record<string, any>;
}

/**
 * Dados do documento para emissão
 */
export interface FiscalDocumentData {
  id: string;
  tenantId: string;
  orderId: string;
  paymentIntentId: string | null;
  documentType: 'NFCE' | 'NFE' | 'SAT' | 'NONE';
  totalAmount: number;
  items: Array<{
    productVariantId: string;
    quantity: number;
    unit: string;
    metadata?: Record<string, any>;
  }>;
  metadata?: Record<string, any>;
}







