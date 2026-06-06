// backend/src/core/kyb-documents/kyb-document-validation.ts
// F-PJ-KYB-DOCUMENTS-USER-SUBMIT (DECISION-0112 §10 A4): validação de conteúdo do documento KYB.
//
// MIME declarado NÃO basta (alerta de segurança IA-DT): valida também magic bytes (assinatura do
// conteúdo). Extensão e filename do usuário NÃO são autoridade. Allowlist MIME e limite reaproveitam
// o storage (fonte única).

import { DOCUMENT_STORAGE_ALLOWED_MIME, DOCUMENT_STORAGE_MAX_BYTES } from '@core/document-storage/document-storage.types';

export { DOCUMENT_STORAGE_ALLOWED_MIME as KYB_ALLOWED_MIME, DOCUMENT_STORAGE_MAX_BYTES as KYB_MAX_BYTES };

/** Assinaturas (magic bytes) por MIME permitido. */
const MAGIC: Record<string, (b: Buffer) => boolean> = {
  // %PDF-  (25 50 44 46 2D)
  'application/pdf': (b) => b.length >= 5 && b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46 && b[4] === 0x2d,
  // FF D8 FF
  'image/jpeg': (b) => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  // 89 50 4E 47 0D 0A 1A 0A
  'image/png': (b) =>
    b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a,
};

/** true se o MIME está na allowlist KYB. */
export function isKybMimeAllowed(mimeType: string): boolean {
  return (DOCUMENT_STORAGE_ALLOWED_MIME as readonly string[]).includes((mimeType ?? '').trim().toLowerCase());
}

/** true se os magic bytes do buffer batem com o MIME declarado (allowlist). */
export function magicBytesMatchMime(buffer: Buffer, mimeType: string): boolean {
  const fn = MAGIC[(mimeType ?? '').trim().toLowerCase()];
  return !!fn && Buffer.isBuffer(buffer) && fn(buffer);
}
