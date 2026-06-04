/**
 * F2-B PJ KYB Documents (DECISION-0087): SSOT documental KYB da identidade fiscal PJ.
 *
 * Documentos DA EMPRESA, ancorados em `fiscal_identity_id` (sobrevivem à transferência). `file_reference`
 * é ponteiro OPACO (provider-agnóstico) — este serviço NÃO faz upload, NÃO escolhe provider, NÃO guarda
 * blob/metadata. Append-only via `supersedes_document_id`. NÃO toca `identities` PF, Bank, company_status,
 * gate. NÃO altera `kyb_status` (a pré-condição de aprovação vive no writer KYB — fiscal-identity-kyb).
 *
 * Tese (DECISION-0087): documento = evidência · kyb_request = processo · kyb_status = resultado ·
 * fiscal_identity = âncora.
 */
import { pool } from '@core/database/pool';

export const REQUIRED_KYB_DOCUMENT_TYPES = ['cnpj_registration', 'articles_of_association'] as const;
export const VALID_DOCUMENT_TYPES = [
  'cnpj_registration',
  'articles_of_association',
  'articles_amendment',
  'business_address_proof',
  'complementary_document',
] as const;
export type FiscalDocumentType = (typeof VALID_DOCUMENT_TYPES)[number];
export type FiscalDocumentStatus = 'submitted' | 'accepted' | 'rejected' | 'superseded';

export interface FiscalIdentityDocument {
  documentId: string;
  fiscalIdentityId: string;
  kybRequestId: string | null;
  documentType: FiscalDocumentType;
  documentStatus: FiscalDocumentStatus;
  fileReference: string;
  fileHash: string | null;
  submittedByActorId: string;
  reviewedByActorId: string | null;
  reviewedAt: string | null;
  decisionReason: string | null;
  supersedesDocumentId: string | null;
}

function mapRow(row: any): FiscalIdentityDocument {
  return {
    documentId: row.document_id,
    fiscalIdentityId: row.fiscal_identity_id,
    kybRequestId: row.kyb_request_id,
    documentType: row.document_type,
    documentStatus: row.document_status,
    fileReference: row.file_reference,
    fileHash: row.file_hash,
    submittedByActorId: row.submitted_by_actor_id,
    reviewedByActorId: row.reviewed_by_actor_id,
    reviewedAt: row.reviewed_at ? new Date(row.reviewed_at).toISOString() : null,
    decisionReason: row.decision_reason,
    supersedesDocumentId: row.supersedes_document_id,
  };
}

class FiscalIdentityDocumentService {
  /**
   * submitFiscalIdentityDocument: registra um documento (status='submitted') para uma identidade fiscal.
   * NÃO faz upload — `fileReference` é ponteiro opaco fornecido pelo caller. NÃO altera kyb_status.
   */
  async submitFiscalIdentityDocument(input: {
    fiscalIdentityId: string;
    documentType: string;
    fileReference: string;
    submittedByActorId: string;
    kybRequestId?: string | null;
    fileHash?: string | null;
  }): Promise<FiscalIdentityDocument> {
    const { fiscalIdentityId, documentType, fileReference, submittedByActorId } = input;
    if (!fiscalIdentityId || typeof fiscalIdentityId !== 'string') {
      throw new Error('submitFiscalIdentityDocument: fiscalIdentityId é obrigatório');
    }
    if (!submittedByActorId || typeof submittedByActorId !== 'string') {
      throw new Error('submitFiscalIdentityDocument: submittedByActorId é obrigatório (actor humano)');
    }
    if (!(VALID_DOCUMENT_TYPES as readonly string[]).includes(documentType)) {
      throw new Error(`INVALID_DOCUMENT_TYPE: '${documentType}' fora do conjunto F2-B (empresa). Docs de pessoa = outro trilho.`);
    }
    if (!fileReference || typeof fileReference !== 'string' || fileReference.trim() === '') {
      throw new Error('submitFiscalIdentityDocument: fileReference (ponteiro opaco) é obrigatório');
    }

    const fi = await pool.query<{ x: number }>(
      `SELECT 1 AS x FROM fiscal_identities WHERE fiscal_identity_id = $1::uuid LIMIT 1`,
      [fiscalIdentityId],
    );
    if (fi.rows.length === 0) {
      throw new Error(`FISCAL_IDENTITY_NOT_FOUND: identidade fiscal ${fiscalIdentityId} não existe.`);
    }

    const ins = await pool.query(
      `INSERT INTO fiscal_identity_documents
         (fiscal_identity_id, kyb_request_id, document_type, file_reference, file_hash, submitted_by_actor_id)
       VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6::uuid)
       RETURNING document_id, fiscal_identity_id::text, kyb_request_id::text, document_type, document_status,
                 file_reference, file_hash, submitted_by_actor_id::text, reviewed_by_actor_id::text,
                 reviewed_at, decision_reason, supersedes_document_id::text`,
      [fiscalIdentityId, input.kybRequestId ?? null, documentType, fileReference, input.fileHash ?? null, submittedByActorId],
    );
    return mapRow(ins.rows[0]);
  }

  /**
   * listFiscalIdentityDocuments: lista documentos de uma identidade fiscal (mais recentes primeiro).
   */
  async listFiscalIdentityDocuments(fiscalIdentityId: string): Promise<FiscalIdentityDocument[]> {
    if (!fiscalIdentityId || typeof fiscalIdentityId !== 'string') {
      throw new Error('listFiscalIdentityDocuments: fiscalIdentityId é obrigatório');
    }
    const rows = await pool.query(
      `SELECT document_id, fiscal_identity_id::text, kyb_request_id::text, document_type, document_status,
              file_reference, file_hash, submitted_by_actor_id::text, reviewed_by_actor_id::text,
              reviewed_at, decision_reason, supersedes_document_id::text
         FROM fiscal_identity_documents
        WHERE fiscal_identity_id = $1::uuid
        ORDER BY created_at DESC`,
      [fiscalIdentityId],
    );
    return rows.rows.map(mapRow);
  }

  /**
   * reviewFiscalIdentityDocument: admin decide submitted → accepted | rejected (auditado).
   * NÃO altera kyb_status. reason obrigatório (CHECK chk_fidoc_final_audit).
   */
  async reviewFiscalIdentityDocument(
    documentId: string,
    decision: 'accepted' | 'rejected',
    decisionReason: string,
    reviewedByActorId: string,
  ): Promise<FiscalIdentityDocument> {
    if (!documentId || typeof documentId !== 'string') {
      throw new Error('reviewFiscalIdentityDocument: documentId é obrigatório');
    }
    if (decision !== 'accepted' && decision !== 'rejected') {
      throw new Error(`reviewFiscalIdentityDocument: decision inválida '${decision}' — esperado 'accepted' ou 'rejected'`);
    }
    if (!decisionReason || typeof decisionReason !== 'string' || decisionReason.trim() === '') {
      throw new Error('reviewFiscalIdentityDocument: decisionReason é obrigatório (auditoria).');
    }
    if (!reviewedByActorId || typeof reviewedByActorId !== 'string') {
      throw new Error('reviewFiscalIdentityDocument: reviewedByActorId é obrigatório (actor humano).');
    }

    const upd = await pool.query(
      `UPDATE fiscal_identity_documents
          SET document_status = $2,
              reviewed_by_actor_id = $3::uuid,
              reviewed_at = NOW(),
              decision_reason = $4,
              updated_at = NOW()
        WHERE document_id = $1::uuid AND document_status = 'submitted'
        RETURNING document_id, fiscal_identity_id::text, kyb_request_id::text, document_type, document_status,
                  file_reference, file_hash, submitted_by_actor_id::text, reviewed_by_actor_id::text,
                  reviewed_at, decision_reason, supersedes_document_id::text`,
      [documentId, decision, reviewedByActorId, decisionReason],
    );
    if (upd.rows.length === 0) {
      throw new Error(`DOCUMENT_NOT_REVIEWABLE: documento ${documentId} não encontrado ou não está em 'submitted'.`);
    }
    return mapRow(upd.rows[0]);
  }

  /**
   * supersedeFiscalIdentityDocument: cria uma NOVA versão (submitted) do mesmo document_type e marca a
   * anterior como 'superseded' (append-only; nunca sobrescreve o arquivo anterior). Atômico.
   */
  async supersedeFiscalIdentityDocument(
    documentId: string,
    newFileReference: string,
    newFileHash: string | null,
    submittedByActorId: string,
  ): Promise<{ superseded: FiscalIdentityDocument; created: FiscalIdentityDocument }> {
    if (!documentId || typeof documentId !== 'string') {
      throw new Error('supersedeFiscalIdentityDocument: documentId é obrigatório');
    }
    if (!newFileReference || typeof newFileReference !== 'string' || newFileReference.trim() === '') {
      throw new Error('supersedeFiscalIdentityDocument: newFileReference (ponteiro opaco) é obrigatório');
    }
    if (!submittedByActorId || typeof submittedByActorId !== 'string') {
      throw new Error('supersedeFiscalIdentityDocument: submittedByActorId é obrigatório');
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const old = await client.query(
        `SELECT document_id, fiscal_identity_id::text, kyb_request_id::text, document_type, document_status
           FROM fiscal_identity_documents WHERE document_id = $1::uuid FOR UPDATE`,
        [documentId],
      );
      if (old.rows.length === 0) {
        throw new Error(`DOCUMENT_NOT_FOUND: documento ${documentId} não existe.`);
      }
      if (old.rows[0].document_status === 'superseded') {
        throw new Error(`DOCUMENT_ALREADY_SUPERSEDED: documento ${documentId} já foi substituído.`);
      }
      const o = old.rows[0];

      // Cria a nova versão (submitted), apontando para a anterior.
      const created = await client.query(
        `INSERT INTO fiscal_identity_documents
           (fiscal_identity_id, kyb_request_id, document_type, file_reference, file_hash,
            submitted_by_actor_id, supersedes_document_id)
         VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6::uuid, $7::uuid)
         RETURNING document_id, fiscal_identity_id::text, kyb_request_id::text, document_type, document_status,
                   file_reference, file_hash, submitted_by_actor_id::text, reviewed_by_actor_id::text,
                   reviewed_at, decision_reason, supersedes_document_id::text`,
        [o.fiscal_identity_id, o.kyb_request_id, o.document_type, newFileReference, newFileHash, submittedByActorId, documentId],
      );

      // Marca a anterior como superseded (preenche auditoria — CHECK chk_fidoc_final_audit).
      const sup = await client.query(
        `UPDATE fiscal_identity_documents
            SET document_status = 'superseded',
                reviewed_by_actor_id = $2::uuid,
                reviewed_at = NOW(),
                decision_reason = $3,
                updated_at = NOW()
          WHERE document_id = $1::uuid
          RETURNING document_id, fiscal_identity_id::text, kyb_request_id::text, document_type, document_status,
                    file_reference, file_hash, submitted_by_actor_id::text, reviewed_by_actor_id::text,
                    reviewed_at, decision_reason, supersedes_document_id::text`,
        [documentId, submittedByActorId, `superseded by ${created.rows[0].document_id}`],
      );

      await client.query('COMMIT');
      return { superseded: mapRow(sup.rows[0]), created: mapRow(created.rows[0]) };
    } catch (err) {
      try { await client.query('ROLLBACK'); } catch { /* noop */ }
      throw err;
    } finally {
      client.release();
    }
  }
}

export const fiscalIdentityDocumentService = new FiscalIdentityDocumentService();
