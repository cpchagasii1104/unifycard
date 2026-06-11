/**
 * F2-A KYB PJ (DECISION-0086): writer auditado da identidade fiscal PJ.
 *
 * Espelha o padrão de `identity-validation.service` (KYC PF), MAS é PJ-cêntrico e **NUNCA**
 * toca `identities` PF nem `kyc_status`. A FONTE da verificação PJ é `fiscal_identities.kyb_status`
 * (DECISION-0086 §3.1). Este serviço transiciona essa fonte via workflow `fiscal_identity_kyb_requests`.
 *
 * Características (DECISION-0086):
 *   - keyed por `fiscal_identity_id` (não global_user_id, não company_id, não CPF).
 *   - GLOBAL (sem tenant_id; `fiscal_identities` e a request são globais sem RLS) — sem set_config.
 *   - auditoria por *_actor_id (submitted_by/reviewed_by); `user_id` não é autoridade.
 *   - transições F2-A: pending -> approved | rejected (suspended/closed/under_review/resubmit = fase posterior).
 *   - review ATÔMICO: UPDATE request + UPDATE fiscal_identities numa única transação; rollback total.
 *   - NÃO toca company_validation_requests, company_status/is_verified, Bank, gate, documentos.
 */
import { pool, getClientWithTenant } from '@core/database/pool';

export interface FiscalKybRequest {
  kybRequestId: string;
  fiscalIdentityId: string;
  status: 'pending' | 'approved' | 'rejected';
  submittedByActorId: string;
  reviewedByActorId: string | null;
  reviewedAt: string | null;
  decisionReason: string | null;
}

export interface FiscalKybQueueRow extends FiscalKybRequest {
  cnpj: string;
  kybStatusCurrent: string;
  companyId: string | null;
  companyName: string | null;
}

class FiscalIdentityKybService {
  /**
   * submitFiscalKybRequest: cria pedido de KYB (status='pending') para uma identidade fiscal PJ.
   *
   * Guards: fiscal_identity existe e `kyb_status` ∈ {pending, rejected}. O caso 'rejected' é o
   * CONTRATO DE REENVIO (GO F-PJ-HUMAN-TO-COMPANY §3.1/8.4 — fase antes deferida pela 0086):
   * nova request pending é criada SEM apagar o histórico (a request rejeitada anterior permanece
   * com reason/auditoria); nenhuma request é "reaproveitada". approved/suspended/closed NÃO
   * aceitam novo submit. Duplicidade barrada pela partial-unique (`uq_fikyb_one_pending`)
   * → relança como FISCAL_IDENTITY_HAS_PENDING_KYB. NÃO altera kyb_status.
   * submittedByActorId = actor humano do operador/responsável — autoridade.
   */
  async submitFiscalKybRequest(
    fiscalIdentityId: string,
    submittedByActorId: string,
    reason?: string,
  ): Promise<FiscalKybRequest> {
    if (!fiscalIdentityId || typeof fiscalIdentityId !== 'string' || fiscalIdentityId.trim() === '') {
      throw new Error('submitFiscalKybRequest: fiscalIdentityId é obrigatório');
    }
    if (!submittedByActorId || typeof submittedByActorId !== 'string' || submittedByActorId.trim() === '') {
      throw new Error('submitFiscalKybRequest: submittedByActorId é obrigatório (actor humano do operador)');
    }

    // Guard: a identidade fiscal precisa existir e estar 'pending'.
    const fi = await pool.query<{ kyb_status: string }>(
      `SELECT kyb_status FROM fiscal_identities WHERE fiscal_identity_id = $1::uuid LIMIT 1`,
      [fiscalIdentityId],
    );
    if (fi.rows.length === 0) {
      throw new Error(`FISCAL_IDENTITY_NOT_FOUND: identidade fiscal ${fiscalIdentityId} não existe.`);
    }
    if (fi.rows[0].kyb_status !== 'pending' && fi.rows[0].kyb_status !== 'rejected') {
      throw new Error(`FISCAL_IDENTITY_NOT_PENDING: kyb_status atual='${fi.rows[0].kyb_status}'. Submit só é aceito para 'pending' (1ª análise) ou 'rejected' (reenvio auditável).`);
    }

    try {
      const ins = await pool.query<{
        kyb_request_id: string;
        fiscal_identity_id: string;
        status: 'pending' | 'approved' | 'rejected';
        submitted_by_actor_id: string;
      }>(
        `INSERT INTO fiscal_identity_kyb_requests (fiscal_identity_id, submitted_by_actor_id, decision_reason)
         VALUES ($1::uuid, $2::uuid, $3)
         RETURNING kyb_request_id, fiscal_identity_id, status, submitted_by_actor_id`,
        [fiscalIdentityId, submittedByActorId, reason ?? null],
      );
      const row = ins.rows[0]!;
      return {
        kybRequestId: row.kyb_request_id,
        fiscalIdentityId: row.fiscal_identity_id,
        status: row.status,
        submittedByActorId: row.submitted_by_actor_id,
        reviewedByActorId: null,
        reviewedAt: null,
        decisionReason: reason ?? null,
      };
    } catch (err: any) {
      if (err && (err.code === '23505' || /uq_fikyb_one_pending/.test(String(err.message || '')))) {
        throw new Error('FISCAL_IDENTITY_HAS_PENDING_KYB: já existe um pedido KYB pending para esta identidade fiscal.');
      }
      throw err;
    }
  }

  /**
   * reviewFiscalKybRequest: admin decide pending → approved | rejected.
   *
   * ATÔMICO: UPDATE da request + UPDATE `fiscal_identities.kyb_status` no MESMO client/transação.
   * Qualquer falha → ROLLBACK total (request e kyb_status inalterados). decisionReason é obrigatório
   * (CHECK `chk_fikyb_final_audit` + `chk_fiscal_identities_approved_audit`). reviewerActorId = autoridade.
   */
  async reviewFiscalKybRequest(
    requestId: string,
    decision: 'approved' | 'rejected',
    decisionReason: string,
    reviewerActorId: string,
  ): Promise<FiscalKybRequest> {
    if (!requestId || typeof requestId !== 'string' || requestId.trim() === '') {
      throw new Error('reviewFiscalKybRequest: requestId é obrigatório');
    }
    if (decision !== 'approved' && decision !== 'rejected') {
      throw new Error(`reviewFiscalKybRequest: decision inválida '${decision}' — esperado 'approved' ou 'rejected'`);
    }
    if (!decisionReason || typeof decisionReason !== 'string' || decisionReason.trim() === '') {
      throw new Error('reviewFiscalKybRequest: decisionReason é obrigatório (auditoria de aprovação/rejeição).');
    }
    if (!reviewerActorId || typeof reviewerActorId !== 'string' || reviewerActorId.trim() === '') {
      throw new Error('reviewFiscalKybRequest: reviewerActorId é obrigatório (actor humano do operador).');
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // (1) Lock + guard da request (precisa estar pending).
      const reqRes = await client.query<{
        kyb_request_id: string;
        fiscal_identity_id: string;
        status: string;
      }>(
        `SELECT kyb_request_id, fiscal_identity_id::text, status
           FROM fiscal_identity_kyb_requests
          WHERE kyb_request_id = $1::uuid
          FOR UPDATE`,
        [requestId],
      );
      if (reqRes.rows.length === 0) {
        throw new Error(`KYB_REQUEST_NOT_FOUND: request ${requestId} não encontrado.`);
      }
      if (reqRes.rows[0].status !== 'pending') {
        throw new Error(`KYB_REQUEST_NOT_REVIEWABLE: request ${requestId} está em status='${reqRes.rows[0].status}' (esperado 'pending').`);
      }
      const fiscalIdentityId = reqRes.rows[0].fiscal_identity_id;

      // (2) Lock + guard da identidade fiscal (precisa estar pending).
      const fiRes = await client.query<{ kyb_status: string }>(
        `SELECT kyb_status FROM fiscal_identities WHERE fiscal_identity_id = $1::uuid FOR UPDATE`,
        [fiscalIdentityId],
      );
      if (fiRes.rows.length === 0) {
        throw new Error(`FISCAL_IDENTITY_DISAPPEARED: identidade fiscal ${fiscalIdentityId} sumiu sob lock (corrupção).`);
      }
      // Reenvio pós-rejeição (GO §3.1/8.4): a fonte pode estar 'rejected' quando a request sob
      // review é uma RESSUBMISSÃO — a decisão transiciona rejected→approved|rejected normalmente.
      if (fiRes.rows[0].kyb_status !== 'pending' && fiRes.rows[0].kyb_status !== 'rejected') {
        throw new Error(`FISCAL_IDENTITY_NOT_PENDING: kyb_status atual='${fiRes.rows[0].kyb_status}' — review só transiciona de 'pending'/'rejected'.`);
      }

      // (2.5) PRÉ-CONDIÇÃO DOCUMENTAL (F2-B / DECISION-0087 §3.10): aprovar KYB sem documentos
      //       mínimos aceitos é proibido. Na MESMA transação, exigir cnpj_registration +
      //       articles_of_association com document_status='accepted'. Falta qualquer um → rollback total
      //       (request e kyb_status seguem 'pending'). `rejected` NÃO exige documentos.
      if (decision === 'approved') {
        const docs = await client.query<{ document_type: string }>(
          `SELECT DISTINCT document_type FROM fiscal_identity_documents
            WHERE fiscal_identity_id = $1::uuid AND document_status = 'accepted'
              AND document_type IN ('cnpj_registration','articles_of_association')`,
          [fiscalIdentityId],
        );
        const have = new Set(docs.rows.map((r) => r.document_type));
        const missing = ['cnpj_registration', 'articles_of_association'].filter((t) => !have.has(t));
        if (missing.length > 0) {
          throw new Error(`KYB_APPROVAL_REQUIRES_DOCUMENTS: faltam documentos aceitos [${missing.join(', ')}] — não é possível aprovar o KYB sem lastro documental mínimo (DECISION-0087 §3.10).`);
        }
      }

      // (3) UPDATE da request (pending → decision) + auditoria.
      const updReq = await client.query<{
        kyb_request_id: string;
        fiscal_identity_id: string;
        status: 'approved' | 'rejected';
        submitted_by_actor_id: string;
        reviewed_by_actor_id: string;
        reviewed_at: Date;
        decision_reason: string;
      }>(
        `UPDATE fiscal_identity_kyb_requests
            SET status = $2,
                reviewed_by_actor_id = $3::uuid,
                reviewed_at = NOW(),
                decision_reason = $4,
                updated_at = NOW()
          WHERE kyb_request_id = $1::uuid AND status = 'pending'
          RETURNING kyb_request_id, fiscal_identity_id::text, status,
                    submitted_by_actor_id::text, reviewed_by_actor_id::text, reviewed_at, decision_reason`,
        [requestId, decision, reviewerActorId, decisionReason],
      );
      const updated = updReq.rows[0];
      if (!updated) {
        throw new Error(`KYB_REQUEST_NOT_REVIEWABLE: request ${requestId} mudou sob lock.`);
      }

      // (4) UPDATE da FONTE: fiscal_identities.kyb_status = decision + auditoria.
      const updFi = await client.query<{ fiscal_identity_id: string }>(
        `UPDATE fiscal_identities
            SET kyb_status = $2,
                reviewed_by_actor_id = $3::uuid,
                reviewed_at = NOW(),
                decision_reason = $4,
                updated_at = NOW()
          WHERE fiscal_identity_id = $1::uuid AND kyb_status IN ('pending','rejected')
          RETURNING fiscal_identity_id`,
        [fiscalIdentityId, decision, reviewerActorId, decisionReason],
      );
      if (updFi.rows.length === 0) {
        throw new Error(`FISCAL_IDENTITY_KYB_UPDATE_FAILED: kyb_status de ${fiscalIdentityId} não transicionou (race?).`);
      }

      await client.query('COMMIT');

      return {
        kybRequestId: updated.kyb_request_id,
        fiscalIdentityId: updated.fiscal_identity_id,
        status: updated.status,
        submittedByActorId: updated.submitted_by_actor_id,
        reviewedByActorId: updated.reviewed_by_actor_id,
        reviewedAt: updated.reviewed_at ? updated.reviewed_at.toISOString() : null,
        decisionReason: updated.decision_reason,
      };
    } catch (err) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // rollback best-effort; erro original prevalece.
      }
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * revokeFiscalKybApproval (F-PJ-KYB-APPROVED-REVOCATION-WRITER / DECISION-0101 D2/D5/D6/D7/D8):
   * transição fiscal de SAÍDA de approved: `approved → suspended | closed`, por AUTORIDADE FISCAL
   * (reviewer humano), com CASCATA ATÔMICA de retração de publicações + recálculo da projeção.
   *
   * Fail-closed: `reviewerActorId` DEVE ser actor humano (`actor_type='user'`); page-actor / SYSTEM /
   * inexistente = recusa (0101 D5/D6 — sem system actor). Só transiciona de 'approved' (senão erro).
   * `reason` obrigatório (auditoria). Reaprovação NÃO republica (retired permanece retired). ATÔMICO:
   * flip de `fiscal_identities.kyb_status` + cascata numa ÚNICA transação (rollback total em qualquer falha).
   */
  async revokeFiscalKybApproval(input: {
    fiscalIdentityId: string;
    newStatus: 'suspended' | 'closed';
    reason: string;
    reviewerActorId: string;
  }): Promise<{
    fiscalIdentityId: string;
    previousStatus: 'approved';
    newStatus: 'suspended' | 'closed';
    retiredPublications: number;
    affectedConcepts: string[];
  }> {
    const { fiscalIdentityId, newStatus, reason, reviewerActorId } = input;
    if (!fiscalIdentityId || typeof fiscalIdentityId !== 'string' || fiscalIdentityId.trim() === '') {
      throw new Error('revokeFiscalKybApproval: fiscalIdentityId é obrigatório');
    }
    if (newStatus !== 'suspended' && newStatus !== 'closed') {
      throw new Error(`revokeFiscalKybApproval: newStatus inválido '${newStatus}' — esperado 'suspended' ou 'closed'`);
    }
    if (!reason || typeof reason !== 'string' || reason.trim() === '') {
      throw new Error('revokeFiscalKybApproval: reason é obrigatório (auditoria da revogação).');
    }
    if (!reviewerActorId || typeof reviewerActorId !== 'string' || reviewerActorId.trim() === '') {
      throw new Error('revokeFiscalKybApproval: reviewerActorId é obrigatório (actor humano do reviewer).');
    }

    // Fail-closed (0101 D5/D6): reviewer DEVE ser actor humano. page-actor / SYSTEM / inexistente = recusa.
    const reviewer = await pool.query<{ actor_type: string }>(
      `SELECT actor_type FROM actors WHERE id = $1::uuid LIMIT 1`,
      [reviewerActorId],
    );
    if (reviewer.rows.length === 0 || reviewer.rows[0].actor_type !== 'user') {
      throw new Error('KYB_REVOCATION_REQUIRES_HUMAN_REVIEWER: revogação de KYB exige actor humano (actor_type=user); page-actor/SYSTEM/inexistente recusado (DECISION-0101 D5/D6).');
    }

    // Elo fiscal → company → tenant (CNPJ único ⇒ ≤1 company). Sem company: flip sem cascata.
    const comp = await pool.query<{ company_id: string; tenant_id: string }>(
      `SELECT company_id::text, tenant_id::text FROM companies WHERE fiscal_identity_id = $1::uuid LIMIT 1`,
      [fiscalIdentityId],
    );
    const company = comp.rows[0] ?? null;

    // Tenant context p/ RLS de actors/publicações quando há company; senão client global do pool.
    const client = company ? await getClientWithTenant(company.tenant_id) : await pool.connect();
    try {
      await client.query('BEGIN');

      // Lock + guard: só revoga de 'approved' (0101 D2).
      const fiRes = await client.query(
        `SELECT kyb_status FROM fiscal_identities WHERE fiscal_identity_id = $1::uuid FOR UPDATE`,
        [fiscalIdentityId],
      );
      if (fiRes.rows.length === 0) {
        throw new Error(`FISCAL_IDENTITY_NOT_FOUND: identidade fiscal ${fiscalIdentityId} não existe.`);
      }
      const current = (fiRes.rows[0] as { kyb_status: string }).kyb_status;
      if (current !== 'approved') {
        throw new Error(`FISCAL_IDENTITY_NOT_APPROVED: kyb_status atual='${current}' — revogação só transiciona de 'approved'.`);
      }

      // Flip da FONTE com auditoria do reviewer humano.
      await client.query(
        `UPDATE fiscal_identities
            SET kyb_status = $2, reviewed_by_actor_id = $3::uuid, reviewed_at = NOW(),
                decision_reason = $4, updated_at = NOW()
          WHERE fiscal_identity_id = $1::uuid AND kyb_status = 'approved'`,
        [fiscalIdentityId, newStatus, reviewerActorId, reason],
      );

      // Cascata ATÔMICA (0101 D2/D7/D8): retira publicações active + recalcula projeção, MESMA tx.
      let retired = 0;
      let concepts: string[] = [];
      if (company) {
        const { retireAllActivePublicationsForCompanyTx } = await import('@core/companies/company-publications.service');
        const casc = await retireAllActivePublicationsForCompanyTx(client, company.tenant_id, company.company_id, reviewerActorId);
        retired = casc.retired;
        concepts = casc.concepts;
      }

      await client.query('COMMIT');
      return {
        fiscalIdentityId,
        previousStatus: 'approved',
        newStatus,
        retiredPublications: retired,
        affectedConcepts: concepts,
      };
    } catch (err) {
      try { await client.query('ROLLBACK'); } catch { /* rollback best-effort; erro original prevalece. */ }
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * getFiscalKybQueue: lista requests (opcionalmente por status), com contexto mínimo.
   * JOIN fiscal_identities (cnpj/kyb_status atual) + LEFT JOIN companies (contexto, não fonte).
   */
  async getFiscalKybQueue(status?: string): Promise<FiscalKybQueueRow[]> {
    const allowed = ['pending', 'approved', 'rejected'];
    if (status !== undefined && !allowed.includes(status)) {
      throw new Error(`getFiscalKybQueue: status inválido '${status}' — esperado um de ${allowed.join(',')}`);
    }

    const rows = await pool.query<{
      kyb_request_id: string;
      fiscal_identity_id: string;
      status: 'pending' | 'approved' | 'rejected';
      submitted_by_actor_id: string;
      reviewed_by_actor_id: string | null;
      reviewed_at: Date | null;
      decision_reason: string | null;
      cnpj: string;
      kyb_status_current: string;
      company_id: string | null;
      company_name: string | null;
    }>(
      `SELECT r.kyb_request_id, r.fiscal_identity_id::text, r.status,
              r.submitted_by_actor_id::text, r.reviewed_by_actor_id::text, r.reviewed_at, r.decision_reason,
              fi.cnpj, fi.kyb_status AS kyb_status_current,
              c.company_id::text AS company_id, c.company_name
         FROM fiscal_identity_kyb_requests r
         JOIN fiscal_identities fi ON fi.fiscal_identity_id = r.fiscal_identity_id
         LEFT JOIN companies c ON c.fiscal_identity_id = r.fiscal_identity_id
        ${status ? 'WHERE r.status = $1' : ''}
        ORDER BY r.created_at DESC`,
      status ? [status] : [],
    );

    return rows.rows.map((row) => ({
      kybRequestId: row.kyb_request_id,
      fiscalIdentityId: row.fiscal_identity_id,
      status: row.status,
      submittedByActorId: row.submitted_by_actor_id,
      reviewedByActorId: row.reviewed_by_actor_id,
      reviewedAt: row.reviewed_at ? row.reviewed_at.toISOString() : null,
      decisionReason: row.decision_reason,
      cnpj: row.cnpj,
      kybStatusCurrent: row.kyb_status_current,
      companyId: row.company_id,
      companyName: row.company_name,
    }));
  }
}

export const fiscalIdentityKybService = new FiscalIdentityKybService();
