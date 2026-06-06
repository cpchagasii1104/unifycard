// backend/src/core/document-storage/document-storage.types.ts
// F-PJ-DOCUMENT-STORAGE-PORT (DECISION-0112): tipos + invariantes do storage documental KYB.
//
// Substrato técnico mínimo e seguro. NÃO é upload user-facing, NÃO é wizard, NÃO é review UI,
// NÃO aprova KYB, NÃO toca company_status/kyb_status/Bank, NÃO grava em fiscal_identity_documents,
// NÃO usa /uploads (diretório público). O arquivo bruto NUNCA entra no banco; o que circula é o
// `fileReference` OPACO (DECISION-0112 D2/D3) + `fileHash` (D11). Provider real de produção e
// MalwareScanPort são fatias próprias futuras.

/** Allowlist de MIME para documento KYB (DECISION-0112 D11 — MIME limitado). */
export const DOCUMENT_STORAGE_ALLOWED_MIME = ['application/pdf', 'image/jpeg', 'image/png'] as const;
export type AllowedDocumentMime = (typeof DOCUMENT_STORAGE_ALLOWED_MIME)[number];

/** Tamanho máximo (DECISION-0112 D11 — tamanho limitado, sem aceitar infinito). */
export const DOCUMENT_STORAGE_MAX_BYTES = 10 * 1024 * 1024; // 10 MB

export interface StoreDocumentInput {
  /** Tenant da operação (isolamento; nunca compõe o fileReference opaco). */
  tenantId: string;
  /** Conteúdo bruto. NUNCA é persistido no banco — vai para o provider de storage. */
  buffer: Buffer;
  /** MIME declarado; validado contra a allowlist. */
  mimeType: string;
  /** Nome original do usuário — NUNCA confiável, NUNCA define path/reference (DECISION-0112 D11). */
  originalFilename?: string;
}

export interface StoredDocument {
  /** Ponteiro OPACO provider-agnóstico (NÃO é path, NÃO contém '..', NÃO deriva do filename). */
  fileReference: string;
  /** SHA-256 (hex) do conteúdo. */
  fileHash: string;
  mimeType: string;
  sizeBytes: number;
}

export interface ReadDocumentResult {
  buffer: Buffer;
  mimeType: string;
  sizeBytes: number;
  fileHash: string;
}

/** Códigos de erro fail-closed (honestos; sem cair em default público). */
export const DOC_STORAGE_ERR = {
  PROVIDER_REQUIRED: 'DOCUMENT_STORAGE_PROVIDER_REQUIRED',
  PROVIDER_NOT_IMPLEMENTED: 'DOCUMENT_STORAGE_PROVIDER_NOT_IMPLEMENTED',
  TENANT_REQUIRED: 'DOCUMENT_STORAGE_TENANT_REQUIRED',
  EMPTY_FILE: 'DOCUMENT_STORAGE_EMPTY_FILE',
  MIME_NOT_ALLOWED: 'DOCUMENT_STORAGE_MIME_NOT_ALLOWED',
  TOO_LARGE: 'DOCUMENT_STORAGE_TOO_LARGE',
  INVALID_REFERENCE: 'DOCUMENT_STORAGE_INVALID_REFERENCE',
  NOT_FOUND: 'DOCUMENT_STORAGE_NOT_FOUND',
} as const;

export type DocumentStorageErrorCode = (typeof DOC_STORAGE_ERR)[keyof typeof DOC_STORAGE_ERR];

export class DocumentStorageError extends Error {
  constructor(public readonly code: DocumentStorageErrorCode, message: string) {
    super(message);
    this.name = 'DocumentStorageError';
  }
}
