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
import { pool } from '@core/database/pool';

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
   * Guards: fiscal_identity existe e `kyb_status='pending'`. Duplicidade barrada pela partial-unique
   * (`uq_fikyb_one_pending`) → relança como FISCAL_IDENTITY_HAS_PENDING_KYB. NÃO altera kyb_status.
   * submittedByActorId = actor humano do operador (req.actionContext.actorId) — autoridade.
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
    if (fi.rows[0].kyb_status !== 'pending') {
      throw new Error(`FISCAL_IDENTITY_NOT_PENDING: kyb_status atual='${fi.rows[0].kyb_status}'. Submit só faz sentido para 'pending'.`);
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
      if (fiRes.rows[0].kyb_status !== 'pending') {
        throw new Error(`FISCAL_IDENTITY_NOT_PENDING: kyb_status atual='${fiRes.rows[0].kyb_status}' — review só transiciona de 'pending'.`);
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
          WHERE fiscal_identity_id = $1::uuid AND kyb_status = 'pending'
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
