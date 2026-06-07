// backend/src/core/kyb-documents/kyb-document-download.service.ts
// F-PJ-KYB-DOCUMENTS-ADMIN-REVIEW-UI (DECISION-0112 §10 A2/A4): download protegido de documento KYB.
//
// Para o "balcão de análise" admin VER o documento. Caminho fail-closed:
//   getById(SSOT) → DocumentStoragePort.readDocument(file_reference) → valida hash (read vs SSOT) →
//   RE-SCAN (MalwareScanPort) → assertDocumentSafeToExpose (clean-only) → bytes.
// Como NÃO há scan_status persistido (e não inventamos coluna), o scan é refeito NA HORA do download:
// dev (Noop) → clean; produção sem scanner → fail-closed. NUNCA expõe path local/URL pública/uploads;
// NÃO aprova KYB; NÃO muda company_status/kyb_status; NÃO toca Bank.

import { fiscalIdentityDocumentService } from '@core/identity/fiscal-identity-document.service';
import type { DocumentStoragePort } from '@core/document-storage/document-storage.port';
import { resolveDocumentStorageProvider } from '@core/document-storage/document-storage.provider';
import type { MalwareScanPort } from '@core/document-malware-scan/document-malware-scan.port';
import { resolveMalwareScanProvider } from '@core/document-malware-scan/document-malware-scan.provider';
import { canExposeDocumentToHuman } from '@core/document-malware-scan/document-malware-scan.policy';

export class KybDocumentDownloadError extends Error {
  constructor(public readonly statusCode: number, public readonly code: string, message: string) {
    super(message);
    this.name = 'KybDocumentDownloadError';
  }
}

export interface DownloadKybDocumentDeps {
  storage?: DocumentStoragePort;
  scanner?: MalwareScanPort;
}

export interface DownloadKybDocumentResult {
  buffer: Buffer;
  mimeType: string;
  sizeBytes: number;
  fileHash: string;
  documentType: string;
  documentStatus: string;
}

export async function downloadKybDocument(
  documentId: string,
  opts: { scanTenantId?: string } = {},
  deps: DownloadKybDocumentDeps = {},
): Promise<DownloadKybDocumentResult> {
  if (!documentId || typeof documentId !== 'string') {
    throw new KybDocumentDownloadError(400, 'KYB_DOC_BAD_REQUEST', 'documentId é obrigatório.');
  }

  // 1. SSOT — documento existe?
  const doc = await fiscalIdentityDocumentService.getFiscalIdentityDocumentById(documentId);
  if (!doc) {
    throw new KybDocumentDownloadError(404, 'KYB_DOC_NOT_FOUND', `Documento ${documentId} não encontrado no SSOT.`);
  }
  if (!doc.fileReference) {
    throw new KybDocumentDownloadError(422, 'KYB_DOC_NO_REFERENCE', 'Documento sem file_reference — nada a recuperar.');
  }

  // 2. ler conteúdo via storage port (privado; nunca /uploads, nunca path exposto)
  const storage = deps.storage ?? resolveDocumentStorageProvider();
  let read;
  try {
    read = await storage.readDocument(doc.fileReference);
  } catch {
    throw new KybDocumentDownloadError(410, 'KYB_DOC_STORAGE_MISSING', 'Conteúdo do documento não disponível no storage.');
  }

  // 3. integridade — hash do conteúdo lido DEVE bater com o file_hash do SSOT
  if (doc.fileHash && read.fileHash !== doc.fileHash) {
    throw new KybDocumentDownloadError(409, 'KYB_DOC_HASH_MISMATCH', 'Integridade falhou: hash do conteúdo difere do SSOT.');
  }

  // 4. RE-SCAN (clean-only) — fail-closed em produção sem scanner
  const scanner = deps.scanner ?? resolveMalwareScanProvider();
  const scan = await scanner.scanDocument({ tenantId: opts.scanTenantId || 'system', buffer: read.buffer, mimeType: read.mimeType });

  // 5. policy: só 'clean' chega a humano
  if (!canExposeDocumentToHuman(scan)) {
    throw new KybDocumentDownloadError(422, 'KYB_DOC_NOT_SAFE', `Documento não pode ser exposto a humano (scan='${scan.status}').`);
  }

  // 6. bytes (sem path/URL)
  return {
    buffer: read.buffer,
    mimeType: read.mimeType,
    sizeBytes: read.sizeBytes,
    fileHash: read.fileHash,
    documentType: doc.documentType,
    documentStatus: doc.documentStatus,
  };
}
