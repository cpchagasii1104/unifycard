// backend/src/core/document-storage/document-storage.port.ts
// F-PJ-DOCUMENT-STORAGE-PORT (DECISION-0112 D5): PORT canônico de storage documental KYB.
//
// O core fala SÓ com este port; o provider (local-dev / produção real futura) é detalhe substituível
// (precedente: pix-provider.interface). storeDocument recebe o conteúdo e devolve um `fileReference`
// OPACO + metadados; readDocument recupera o conteúdo internamente por esse fileReference (sem
// endpoint público, sem /uploads). NUNCA expõe path local; NUNCA grava no banco.

import type { StoreDocumentInput, StoredDocument, ReadDocumentResult } from './document-storage.types';

export interface DocumentStoragePort {
  /** Armazena o conteúdo em local privado e retorna um fileReference OPACO + hash/mime/size. */
  storeDocument(input: StoreDocumentInput): Promise<StoredDocument>;

  /** Recupera o conteúdo por fileReference para uso interno (sem endpoint público). */
  readDocument(fileReference: string): Promise<ReadDocumentResult>;
}
