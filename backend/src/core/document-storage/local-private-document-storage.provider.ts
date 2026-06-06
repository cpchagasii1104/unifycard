// backend/src/core/document-storage/local-private-document-storage.provider.ts
// F-PJ-DOCUMENT-STORAGE-PORT (DECISION-0112 A1): provider LOCAL-DEV privado.
//
// SÓ para dev/test (o factory recusa este provider em produção — fail-closed). Grava em diretório
// PRIVADO fora de /uploads (que é servido por @fastify/static, público). NUNCA é registrado em static.
// O `fileReference` é um token OPACO (32 hex aleatórios) — não é path, não contém '..', não deriva do
// filename do usuário. Metadados (mime/size/hash) ficam num sidecar .meta.json ao lado do blob.

import { createHash, randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';

import type { DocumentStoragePort } from './document-storage.port';
import {
  DOCUMENT_STORAGE_ALLOWED_MIME,
  DOCUMENT_STORAGE_MAX_BYTES,
  DOC_STORAGE_ERR,
  DocumentStorageError,
  type ReadDocumentResult,
  type StoreDocumentInput,
  type StoredDocument,
} from './document-storage.types';

/** fileReference opaco: exatamente 32 hex minúsculos. Qualquer outra coisa é rejeitada (anti-traversal). */
const OPAQUE_REF = /^[0-9a-f]{32}$/;

interface SidecarMeta {
  mimeType: string;
  sizeBytes: number;
  fileHash: string;
  tenantId: string;
  // Apenas para rastreio/exibição futura — NUNCA usado como path/reference.
  originalFilenameSanitized?: string;
}

export class LocalPrivateDocumentStorageProvider implements DocumentStoragePort {
  private readonly baseDir: string;

  constructor(baseDir?: string) {
    // Default: <cwd>/.private/document-storage (privado, FORA de uploads/). Override por env/arg.
    const resolved = baseDir
      ?? process.env.DOCUMENT_STORAGE_LOCAL_DIR
      ?? path.join(process.cwd(), '.private', 'document-storage');
    this.baseDir = path.resolve(resolved);
    // Trava de segurança: nunca apontar para a raiz pública de uploads.
    const publicUploads = path.resolve(path.join(process.cwd(), 'uploads'));
    if (this.baseDir === publicUploads || this.baseDir.startsWith(publicUploads + path.sep)) {
      throw new DocumentStorageError(
        DOC_STORAGE_ERR.INVALID_REFERENCE,
        'LocalPrivateDocumentStorageProvider: baseDir não pode estar dentro de uploads/ (público).',
      );
    }
  }

  async storeDocument(input: StoreDocumentInput): Promise<StoredDocument> {
    const { tenantId, buffer, mimeType, originalFilename } = input;

    if (!tenantId || typeof tenantId !== 'string' || tenantId.trim() === '') {
      throw new DocumentStorageError(DOC_STORAGE_ERR.TENANT_REQUIRED, 'storeDocument: tenantId é obrigatório.');
    }
    if (!buffer || !Buffer.isBuffer(buffer) || buffer.length === 0) {
      throw new DocumentStorageError(DOC_STORAGE_ERR.EMPTY_FILE, 'storeDocument: arquivo vazio não é aceito.');
    }
    if (buffer.length > DOCUMENT_STORAGE_MAX_BYTES) {
      throw new DocumentStorageError(
        DOC_STORAGE_ERR.TOO_LARGE,
        `storeDocument: arquivo (${buffer.length} bytes) excede o máximo de ${DOCUMENT_STORAGE_MAX_BYTES} bytes.`,
      );
    }
    const mime = (mimeType ?? '').trim().toLowerCase();
    if (!(DOCUMENT_STORAGE_ALLOWED_MIME as readonly string[]).includes(mime)) {
      throw new DocumentStorageError(
        DOC_STORAGE_ERR.MIME_NOT_ALLOWED,
        `storeDocument: MIME '${mimeType}' não permitido (allowlist: ${DOCUMENT_STORAGE_ALLOWED_MIME.join(', ')}).`,
      );
    }

    const fileHash = createHash('sha256').update(buffer).digest('hex');
    // Reference OPACO: gerado, não derivado do conteúdo nem do filename. 32 hex.
    const fileReference = randomUUID().replace(/-/g, '');

    await fs.mkdir(this.baseDir, { recursive: true });
    const blobPath = this.resolveBlobPath(fileReference);
    const metaPath = `${blobPath}.meta.json`;

    const meta: SidecarMeta = {
      mimeType: mime,
      sizeBytes: buffer.length,
      fileHash,
      tenantId,
      originalFilenameSanitized: sanitizeFilename(originalFilename),
    };

    // Escreve o blob e o sidecar. O filename do usuário NÃO compõe o path.
    await fs.writeFile(blobPath, buffer, { flag: 'wx' }); // wx: nunca sobrescreve (ref é único)
    await fs.writeFile(metaPath, JSON.stringify(meta), 'utf8');

    return { fileReference, fileHash, mimeType: mime, sizeBytes: buffer.length };
  }

  async readDocument(fileReference: string): Promise<ReadDocumentResult> {
    if (!fileReference || typeof fileReference !== 'string' || !OPAQUE_REF.test(fileReference)) {
      throw new DocumentStorageError(
        DOC_STORAGE_ERR.INVALID_REFERENCE,
        'readDocument: fileReference inválido (esperado token opaco de 32 hex).',
      );
    }
    const blobPath = this.resolveBlobPath(fileReference);
    let buffer: Buffer;
    let metaRaw: string;
    try {
      buffer = await fs.readFile(blobPath);
      metaRaw = await fs.readFile(`${blobPath}.meta.json`, 'utf8');
    } catch {
      throw new DocumentStorageError(DOC_STORAGE_ERR.NOT_FOUND, `readDocument: documento ${fileReference} não encontrado.`);
    }
    const meta = JSON.parse(metaRaw) as SidecarMeta;
    return { buffer, mimeType: meta.mimeType, sizeBytes: meta.sizeBytes, fileHash: meta.fileHash };
  }

  /** Resolve o path do blob com defesa-em-profundidade: o resultado DEVE ficar dentro de baseDir. */
  private resolveBlobPath(fileReference: string): string {
    if (!OPAQUE_REF.test(fileReference)) {
      throw new DocumentStorageError(DOC_STORAGE_ERR.INVALID_REFERENCE, 'fileReference fora do formato opaco.');
    }
    const resolved = path.resolve(this.baseDir, fileReference);
    if (resolved !== path.join(this.baseDir, fileReference) || !resolved.startsWith(this.baseDir + path.sep)) {
      throw new DocumentStorageError(DOC_STORAGE_ERR.INVALID_REFERENCE, 'fileReference resolveu fora do diretório privado (anti-traversal).');
    }
    return resolved;
  }
}

/** Sanitiza o filename SÓ para registro/exibição (basename, sem separadores). NUNCA vira path. */
function sanitizeFilename(name?: string): string | undefined {
  if (!name || typeof name !== 'string') return undefined;
  const base = path.basename(name).replace(/[\\/]/g, '').replace(/\.\./g, '').trim();
  return base.length > 0 ? base.slice(0, 200) : undefined;
}
