// backend/src/core/document-storage/document-storage.provider.ts
// F-PJ-DOCUMENT-STORAGE-PORT (DECISION-0112 D6/D13/A1): factory/resolver do provider.
//
// dev/test: provider LOCAL privado por default (ou DOCUMENT_STORAGE_PROVIDER=local).
// produção (NODE_ENV=production): exige provider explícito; `local` é PROIBIDO em produção; providers
// reais (s3/gcs/minio) ainda NÃO implementados nesta fatia → FAIL-CLOSED. NUNCA cai silenciosamente
// para local em produção (precedente de resolução por env: pix.service `process.env.PIX_PROVIDER`).

import type { DocumentStoragePort } from './document-storage.port';
import { LocalPrivateDocumentStorageProvider } from './local-private-document-storage.provider';
import { DOC_STORAGE_ERR, DocumentStorageError } from './document-storage.types';

/**
 * Resolve o DocumentStoragePort conforme o ambiente. SEM cache (cada chamada reavalia o env) —
 * o caching/wiring no app fica para a fatia user-submit.
 */
export function resolveDocumentStorageProvider(): DocumentStoragePort {
  const isProduction = process.env.NODE_ENV === 'production';
  const configured = (process.env.DOCUMENT_STORAGE_PROVIDER ?? '').trim().toLowerCase();

  if (isProduction) {
    if (!configured) {
      throw new DocumentStorageError(
        DOC_STORAGE_ERR.PROVIDER_REQUIRED,
        'DOCUMENT_STORAGE_PROVIDER_REQUIRED: storage documental em produção exige provider explícito ' +
          '(DECISION-0112 D6/D13). Nenhum provider configurado — fail-closed (sem fallback local/público).',
      );
    }
    if (configured === 'local') {
      throw new DocumentStorageError(
        DOC_STORAGE_ERR.PROVIDER_REQUIRED,
        'DOCUMENT_STORAGE_PROVIDER_REQUIRED: provider "local" é dev-only e não é permitido em produção. ' +
          'Configure um provider real (DECISION-0112).',
      );
    }
    throw new DocumentStorageError(
      DOC_STORAGE_ERR.PROVIDER_NOT_IMPLEMENTED,
      `DOCUMENT_STORAGE_PROVIDER_NOT_IMPLEMENTED: provider "${configured}" ainda não implementado ` +
        '(fatia futura). Fail-closed em produção.',
    );
  }

  // dev/test
  if (!configured || configured === 'local') {
    return new LocalPrivateDocumentStorageProvider();
  }
  throw new DocumentStorageError(
    DOC_STORAGE_ERR.PROVIDER_NOT_IMPLEMENTED,
    `DOCUMENT_STORAGE_PROVIDER_NOT_IMPLEMENTED: provider "${configured}" ainda não implementado.`,
  );
}
