// backend/src/core/kyb-documents/kyb-document-submit.service.ts
// F-PJ-KYB-DOCUMENTS-USER-SUBMIT (DECISION-0112 §10 A4): orquestra a submissão documental KYB
// USER-FACING, conectando autoridade → storage → scan → SSOT.
//
// AUTORIA AUTH-DERIVED por LEITURA PURA (F-PJ-KYB-DOCUMENT-ACTOR-CURE-CLOSURE / PJ-B3):
// submittedByActorId = actor humano EXISTENTE do usuário autenticado (findByUserId). A jornada PJ
// NUNCA cria/cura actor humano — cadeia incompleta (actor ausente) = erro estrutural fail-closed
// KYB_DOC_ACTOR_MISSING, sem NENHUM efeito (sem actor novo, sem arquivo, sem registro, sem request).
// NÃO usa actionContext.actorId (client-declared/spoofável). Autoridade da empresa = canManageCompany;
// posse de companyId não basta. Ordem fail-closed: actor(LEITURA) → company→fiscal_identity →
// authority → validate(MIME+magic) → scan(clean-only) → store(privado) → submitFiscalIdentityDocument.
// Se o INSERT falhar APÓS o storage, o blob é removido (compensação idempotente via
// DocumentStoragePort.deleteDocument). Só documento 'clean' grava no SSOT.
// NÃO toca company_status/kyb_status/Bank/company_documents/migration.

import { runQueryWithTenant } from '@core/database/pool';
import { socialPortsRegistry } from '@core/social/ports-registry';
import { companiesService } from '@core/companies/companies.service';
import {
  fiscalIdentityDocumentService,
  VALID_DOCUMENT_TYPES,
} from '@core/identity/fiscal-identity-document.service';
import type { DocumentStoragePort } from '@core/document-storage/document-storage.port';
import { resolveDocumentStorageProvider } from '@core/document-storage/document-storage.provider';
import type { MalwareScanPort } from '@core/document-malware-scan/document-malware-scan.port';
import { resolveMalwareScanProvider } from '@core/document-malware-scan/document-malware-scan.provider';
import { isKybMimeAllowed, magicBytesMatchMime, KYB_ALLOWED_MIME, KYB_MAX_BYTES } from './kyb-document-validation';

export class KybDocumentSubmitError extends Error {
  constructor(public readonly statusCode: number, public readonly code: string, message: string) {
    super(message);
    this.name = 'KybDocumentSubmitError';
  }
}

export interface SubmitKybDocumentInput {
  tenantId: string;
  companyId: string;
  /** Identidade do usuário autenticado (gate de autoridade da empresa). */
  globalUserId: string;
  /** userId do usuário autenticado — resolve o actor humano AUTH-DERIVED (nunca de input). */
  userId: string;
  documentType: string;
  buffer: Buffer;
  mimeType: string;
  originalFilename?: string;
}

/** Test seam: permite injetar storage/scanner fake no e2e (sem produção). Default = factory. */
export interface SubmitKybDocumentDeps {
  storage?: DocumentStoragePort;
  scanner?: MalwareScanPort;
}

export interface SubmitKybDocumentResult {
  documentId: string;
  fiscalIdentityId: string;
  documentType: string;
  documentStatus: string;
  fileReference: string;
  fileHash: string;
  mimeType: string;
  sizeBytes: number;
}

export async function submitKybDocument(
  input: SubmitKybDocumentInput,
  deps: SubmitKybDocumentDeps = {},
): Promise<SubmitKybDocumentResult> {
  const { tenantId, companyId, globalUserId, userId, documentType, buffer, mimeType, originalFilename } = input;

  if (!tenantId || !companyId || !globalUserId || !userId) {
    throw new KybDocumentSubmitError(400, 'KYB_DOC_BAD_REQUEST', 'tenantId, companyId, globalUserId e userId são obrigatórios.');
  }

  // ── 1. AUTORIA auth-derived por LEITURA PURA (NUNCA actionContext/body; NUNCA cura) ──
  // PJ-B3: o humano nasce com identity+actor (C1). Aqui o actor é RESOLVIDO por leitura;
  // ausência = cadeia humana incompleta → erro estrutural ANTES de qualquer efeito
  // (nenhum actor criado, nenhum arquivo armazenado, nenhum registro/request).
  const actor = await socialPortsRegistry.getActorRepository().findByUserId(tenantId, userId);
  if (!actor?.actor_id) {
    throw new KybDocumentSubmitError(
      403,
      'KYB_DOC_ACTOR_MISSING',
      'Actor humano do usuário autenticado não existe — a submissão documental não cria/cura actors (nascimento C1 é o caminho canônico).',
    );
  }

  // ── 2. company → fiscal_identity_id (tenant-scoped) ──────────────────────────
  const company = await runQueryWithTenant<{ fiscal_identity_id: string | null }>(
    tenantId,
    `SELECT fiscal_identity_id::text AS fiscal_identity_id FROM companies WHERE company_id = $1::uuid AND tenant_id = $2 LIMIT 1`,
    [companyId, tenantId],
  );
  if (!company) {
    throw new KybDocumentSubmitError(404, 'KYB_DOC_COMPANY_NOT_FOUND', `Empresa ${companyId} não encontrada no tenant.`);
  }
  if (!company.fiscal_identity_id) {
    throw new KybDocumentSubmitError(422, 'KYB_DOC_FISCAL_IDENTITY_MISSING', 'Empresa sem identidade fiscal — não é possível submeter documento KYB.');
  }
  const fiscalIdentityId = company.fiscal_identity_id;

  // ── 3. AUTORIDADE sobre a empresa (posse de companyId não basta) ─────────────
  const canManage = await companiesService.canManageCompany(tenantId, companyId, globalUserId);
  if (!canManage) {
    throw new KybDocumentSubmitError(403, 'KYB_DOC_FORBIDDEN', 'Sem autoridade (canManageCompany) para submeter documentos desta empresa.');
  }

  // ── 4. document_type válido (contrato do SSOT, 0087 §3.9) ────────────────────
  if (!(VALID_DOCUMENT_TYPES as readonly string[]).includes(documentType)) {
    throw new KybDocumentSubmitError(400, 'KYB_DOC_INVALID_TYPE', `document_type '${documentType}' inválido (esperado: ${VALID_DOCUMENT_TYPES.join(', ')}).`);
  }

  // ── 5. validação de arquivo (vazio / tamanho / MIME allowlist / MAGIC BYTES) ─
  if (!buffer || !Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new KybDocumentSubmitError(400, 'KYB_DOC_EMPTY_FILE', 'Arquivo vazio não é aceito.');
  }
  if (buffer.length > KYB_MAX_BYTES) {
    throw new KybDocumentSubmitError(400, 'KYB_DOC_TOO_LARGE', `Arquivo (${buffer.length} bytes) excede o máximo de ${KYB_MAX_BYTES} bytes.`);
  }
  if (!isKybMimeAllowed(mimeType)) {
    throw new KybDocumentSubmitError(400, 'KYB_DOC_MIME_NOT_ALLOWED', `MIME '${mimeType}' não permitido (allowlist: ${KYB_ALLOWED_MIME.join(', ')}).`);
  }
  if (!magicBytesMatchMime(buffer, mimeType)) {
    throw new KybDocumentSubmitError(400, 'KYB_DOC_MAGIC_MISMATCH', `Conteúdo do arquivo não corresponde ao MIME declarado '${mimeType}' (magic bytes).`);
  }

  // ── 6. MALWARE SCAN — clean-only; não-clean falha fechado SEM armazenar/gravar ─
  const scanner = deps.scanner ?? resolveMalwareScanProvider();
  const scan = await scanner.scanDocument({ tenantId, buffer, mimeType });
  if (scan.status !== 'clean') {
    throw new KybDocumentSubmitError(422, 'KYB_DOC_SCAN_NOT_CLEAN', `Documento não passou no scan de malware (status='${scan.status}'). Nada foi armazenado nem gravado.`);
  }

  // ── 7. STORAGE privado (só após clean) → file_reference opaco + hash ─────────
  const storage = deps.storage ?? resolveDocumentStorageProvider();
  const stored = await storage.storeDocument({ tenantId, buffer, mimeType, originalFilename });

  // ── 8. WRITER canônico do SSOT (fiscal_identity_documents; status='submitted') ─
  //      COMPENSAÇÃO fail-closed (§6): INSERT falhou após o storage → remove o blob
  //      (deleteDocument idempotente) e relança — zero arquivo órfão, zero registro.
  let doc;
  try {
    doc = await fiscalIdentityDocumentService.submitFiscalIdentityDocument({
      fiscalIdentityId,
      documentType,
      fileReference: stored.fileReference,
      fileHash: stored.fileHash,
      submittedByActorId: actor.actor_id,
    });
  } catch (err) {
    try {
      await storage.deleteDocument(stored.fileReference);
    } catch {
      // best-effort: a falha ORIGINAL do INSERT prevalece; blob residual é varrível por ref.
    }
    throw err;
  }

  // ── 9. resposta segura (sem path local, sem URL pública) ─────────────────────
  return {
    documentId: doc.documentId,
    fiscalIdentityId: doc.fiscalIdentityId,
    documentType: doc.documentType,
    documentStatus: doc.documentStatus,
    fileReference: doc.fileReference,
    // SHA-256 do conteúdo armazenado (sempre string; doc.fileHash do SSOT é nullable). Resposta honesta
    // = o hash que acabamos de computar/armazenar (igual ao gravado).
    fileHash: stored.fileHash,
    mimeType: stored.mimeType,
    sizeBytes: stored.sizeBytes,
  };
}
