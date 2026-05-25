/**
 * Frente C Fatia C2 (2026-05-25): workflow submit→review→approve para KYC humano.
 *
 * Arquivo NOVO — `identity.service.ts` é legado pré-Gate-0 CONGELADO (header L1-17),
 * apenas alterações pós-Gate-1. Este módulo segue a arquitetura modular: cada serviço
 * em arquivo próprio, sem tocar o congelado.
 *
 * Espelha o padrão da Frente B (companies.service.ts: submitForValidation,
 * reviewCompanyValidation, getValidationQueue) — convergência sobre
 * modules/disputes/financial-dispute-repository.ts.
 *
 * Diferença estrutural vs Frente B:
 *   - identities é GLOBAL (PK só global_user_id; sem tenant_id; sem RLS).
 *   - identity_validation_requests também é GLOBAL (sem tenant_id, sem RLS).
 *   - Acesso controlado por requireRole(['admin']) na camada HTTP.
 *   - submitted_by_user_id / reviewed_by_user_id (FKs users) carregam o tenant
 *     do operador APENAS para auditoria.
 *   - Workflow não precisa de set_config('app.current_tenant') — RLS ausente.
 *
 * As 3 camadas conectadas (decisão Clayton, Frente C):
 *   1. cadastro CRIA EXISTÊNCIA  (identity nasce pending/none — Fatia C1)
 *   2. KYC      APROVA CAPACIDADE (workflow deste módulo)
 *   3. authority LIBERA EXECUÇÃO  (gate em authority-decision intocado:
 *                                   approved passa, pending/rejected bloqueia)
 */
import { pool } from '@core/database/pool';

export interface IdentityValidationRequest {
  id: string;
  globalUserId: string;
  submittedByUserId: string;
  submittedAt: string;
  submissionNotes: string | null;
  status: 'pending' | 'under_review' | 'approved' | 'rejected';
  reviewedAt: string | null;
  reviewedByUserId: string | null;
  decisionReason: string | null;
  targetKycLevel: 'basic' | 'complete';
}

export interface IdentityValidationQueueRow extends IdentityValidationRequest {
  fullName: string | null;
  taxId: string;
  taxIdType: string;
  kycStatusCurrent: string;
  kycLevelCurrent: string;
}

class IdentityValidationService {
  /**
   * submitIdentityValidation: cria pedido de validação de KYC (status='pending').
   *
   * Guard: identity precisa existir e kyc_status='pending' (nasce assim pós-C1).
   * Se já 'approved' → IDENTITY_ALREADY_APPROVED.
   * Se 'rejected' → IDENTITY_REJECTED_NEEDS_DECISION (resubmit exige decisão arquitetural
   * — fora do escopo desta fatia).
   * UNIQUE parcial barra duplicidade — relança como IDENTITY_HAS_PENDING_VALIDATION.
   *
   * Não exige tenant (workflow global). submittedByUserId é users.id do operador
   * (req.user.id) — carrega tenant do operador via FK para auditoria.
   */
  async submitIdentityValidation(
    globalUserId: string,
    submittedByUserId: string,
    targetKycLevel: 'basic' | 'complete',
    notes?: string,
  ): Promise<IdentityValidationRequest> {
    if (!globalUserId || typeof globalUserId !== 'string' || globalUserId.trim() === '') {
      throw new Error('submitIdentityValidation: globalUserId é obrigatório');
    }
    if (!submittedByUserId || typeof submittedByUserId !== 'string' || submittedByUserId.trim() === '') {
      throw new Error('submitIdentityValidation: submittedByUserId é obrigatório (req.user.id = users.id)');
    }
    if (targetKycLevel !== 'basic' && targetKycLevel !== 'complete') {
      throw new Error(`submitIdentityValidation: targetKycLevel inválido '${targetKycLevel}' — esperado 'basic' ou 'complete'`);
    }

    // Guard: identity precisa existir e estar em status='pending'.
    const idRow = await pool.query<{ kyc_status: string; kyc_level: string }>(
      `SELECT kyc_status, kyc_level FROM identities WHERE global_user_id = $1::uuid LIMIT 1`,
      [globalUserId],
    );
    if (idRow.rows.length === 0) {
      throw new Error(`IDENTITY_NOT_FOUND: identity para global_user_id ${globalUserId} não existe. Use /auth/register que cria identity pending/none (Fatia C1).`);
    }
    const currentStatus = idRow.rows[0]!.kyc_status;
    if (currentStatus === 'approved') {
      throw new Error(`IDENTITY_ALREADY_APPROVED: identity já está approved (kyc_level='${idRow.rows[0]!.kyc_level}'). Não há o que submeter.`);
    }
    if (currentStatus === 'rejected') {
      throw new Error(`IDENTITY_REJECTED_NEEDS_DECISION: identity está rejected. Resubmit exige decisão arquitetural (fora do escopo de C2 — fatia separada).`);
    }
    if (currentStatus !== 'pending') {
      throw new Error(`IDENTITY_NOT_IN_PENDING: kyc_status atual='${currentStatus}'. Submit só faz sentido para 'pending'.`);
    }

    try {
      const ins = await pool.query<{
        id: string;
        global_user_id: string;
        submitted_by_user_id: string;
        submitted_at: Date;
        submission_notes: string | null;
        status: 'pending' | 'under_review' | 'approved' | 'rejected';
        target_kyc_level: 'basic' | 'complete';
      }>(
        `INSERT INTO identity_validation_requests
           (global_user_id, submitted_by_user_id, submission_notes, target_kyc_level)
         VALUES ($1::uuid, $2::uuid, $3, $4)
         RETURNING id, global_user_id, submitted_by_user_id, submitted_at,
                   submission_notes, status, target_kyc_level`,
        [globalUserId, submittedByUserId, notes ?? null, targetKycLevel],
      );
      const row = ins.rows[0]!;
      return {
        id: row.id,
        globalUserId: row.global_user_id,
        submittedByUserId: row.submitted_by_user_id,
        submittedAt: row.submitted_at.toISOString(),
        submissionNotes: row.submission_notes,
        status: row.status,
        reviewedAt: null,
        reviewedByUserId: null,
        decisionReason: null,
        targetKycLevel: row.target_kyc_level,
      };
    } catch (err: any) {
      // 23505 = unique_violation. Captura a partial unique e dá mensagem clara.
      if (err && (err.code === '23505' || /uq_identity_validation_requests_pending/.test(String(err.message || '')))) {
        throw new Error(`IDENTITY_HAS_PENDING_VALIDATION: já existe um pedido de validação pending para esta pessoa. Aguarde a revisão ou cancele o pedido existente antes de submeter novo.`);
      }
      throw err;
    }
  }

  /**
   * reviewIdentityValidation: admin decide pending → approved/rejected.
   *
   * Atomicidade: caminho approved/rejected encadeia 2 escritas (UPDATE request +
   * UPDATE identities). Tudo dentro de BEGIN/COMMIT no MESMO client; qualquer falha
   * força ROLLBACK — ou tudo grava, ou nada grava.
   *
   * approved: identities.kyc_status='approved', kyc_level=target (basic|complete).
   * rejected: identities.kyc_status='rejected'  (kyc_level preservado).
   *
   * NÃO usa set_config app.current_tenant — tabela global sem RLS.
   */
  async reviewIdentityValidation(
    requestId: string,
    decision: 'approved' | 'rejected',
    reason: string | undefined,
    reviewerUserId: string,
  ): Promise<IdentityValidationRequest> {
    if (!requestId || typeof requestId !== 'string' || requestId.trim() === '') {
      throw new Error('reviewIdentityValidation: requestId é obrigatório');
    }
    if (!reviewerUserId || typeof reviewerUserId !== 'string' || reviewerUserId.trim() === '') {
      throw new Error('reviewIdentityValidation: reviewerUserId é obrigatório (req.user.id = users.id)');
    }
    if (decision !== 'approved' && decision !== 'rejected') {
      throw new Error(`reviewIdentityValidation: decision inválida '${decision}' — esperado 'approved' ou 'rejected'`);
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // (1) UPDATE da request (transição pending→approved|rejected). RETURNING para encadear.
      const reqResult = await client.query<{
        id: string;
        global_user_id: string;
        target_kyc_level: 'basic' | 'complete';
        status: 'pending' | 'under_review' | 'approved' | 'rejected';
        reviewed_at: Date | null;
        reviewed_by_user_id: string | null;
        decision_reason: string | null;
        submitted_by_user_id: string;
        submitted_at: Date;
        submission_notes: string | null;
      }>(
        `UPDATE identity_validation_requests
            SET status = $2,
                reviewed_at = NOW(),
                reviewed_by_user_id = $3::uuid,
                decision_reason = $4,
                updated_at = NOW()
          WHERE id = $1::uuid AND status = 'pending'
          RETURNING id, global_user_id, target_kyc_level, status, reviewed_at,
                    reviewed_by_user_id, decision_reason, submitted_by_user_id,
                    submitted_at, submission_notes`,
        [requestId, decision, reviewerUserId, reason ?? null],
      );
      const updatedRequest = reqResult.rows[0];
      if (!updatedRequest) {
        throw new Error(`VALIDATION_REQUEST_NOT_REVIEWABLE: request ${requestId} não encontrado ou não está em status='pending'.`);
      }

      // (2) UPDATE identities — projeta o estado da última decisão.
      //     approved: kyc_status='approved', kyc_level=target.
      //     rejected: kyc_status='rejected'  (kyc_level preservado).
      if (decision === 'approved') {
        const idUpdate = await client.query<{ global_user_id: string }>(
          `UPDATE identities
              SET kyc_status = 'approved',
                  kyc_level = $2,
                  updated_at = NOW()
            WHERE global_user_id = $1::uuid
            RETURNING global_user_id`,
          [updatedRequest.global_user_id, updatedRequest.target_kyc_level],
        );
        if (idUpdate.rows.length === 0) {
          throw new Error(`IDENTITY_DISAPPEARED_ON_APPROVE: identity ${updatedRequest.global_user_id} desapareceu entre request e approve (race?).`);
        }
      } else {
        // rejected
        const idUpdate = await client.query<{ global_user_id: string }>(
          `UPDATE identities
              SET kyc_status = 'rejected',
                  updated_at = NOW()
            WHERE global_user_id = $1::uuid
            RETURNING global_user_id`,
          [updatedRequest.global_user_id],
        );
        if (idUpdate.rows.length === 0) {
          throw new Error(`IDENTITY_DISAPPEARED_ON_REJECT: identity ${updatedRequest.global_user_id} desapareceu entre request e reject (race?).`);
        }
      }

      await client.query('COMMIT');

      return {
        id: updatedRequest.id,
        globalUserId: updatedRequest.global_user_id,
        submittedByUserId: updatedRequest.submitted_by_user_id,
        submittedAt: updatedRequest.submitted_at.toISOString(),
        submissionNotes: updatedRequest.submission_notes,
        status: updatedRequest.status,
        reviewedAt: updatedRequest.reviewed_at ? updatedRequest.reviewed_at.toISOString() : null,
        reviewedByUserId: updatedRequest.reviewed_by_user_id,
        decisionReason: updatedRequest.decision_reason,
        targetKycLevel: updatedRequest.target_kyc_level,
      };
    } catch (err) {
      try {
        await client.query('ROLLBACK');
      } catch (_rollbackErr) {
        // ROLLBACK falhou (conexão perdida) — deixa o erro original propagar.
      }
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * getIdentityValidationQueue: lista requests, opcionalmente filtrados por status.
   * JOIN identities + global_users para contexto (nome, CPF, KYC atual).
   */
  async getIdentityValidationQueue(status?: string): Promise<IdentityValidationQueueRow[]> {
    const allowedStatus = ['pending', 'under_review', 'approved', 'rejected'];
    if (status !== undefined && !allowedStatus.includes(status)) {
      throw new Error(`getIdentityValidationQueue: status inválido '${status}' — esperado um de ${allowedStatus.join(',')}`);
    }

    const rows = await pool.query<{
      id: string;
      global_user_id: string;
      submitted_by_user_id: string;
      submitted_at: Date;
      submission_notes: string | null;
      status: 'pending' | 'under_review' | 'approved' | 'rejected';
      reviewed_at: Date | null;
      reviewed_by_user_id: string | null;
      decision_reason: string | null;
      target_kyc_level: 'basic' | 'complete';
      full_name: string | null;
      tax_id: string;
      tax_id_type: string;
      kyc_status_current: string;
      kyc_level_current: string;
    }>(
      status
        ? `SELECT r.id, r.global_user_id, r.submitted_by_user_id, r.submitted_at,
                  r.submission_notes, r.status, r.reviewed_at, r.reviewed_by_user_id,
                  r.decision_reason, r.target_kyc_level,
                  gu.full_name, i.tax_id, i.tax_id_type,
                  i.kyc_status AS kyc_status_current, i.kyc_level AS kyc_level_current
             FROM identity_validation_requests r
             JOIN identities i   ON i.global_user_id  = r.global_user_id
             JOIN global_users gu ON gu.global_user_id = r.global_user_id
            WHERE r.status = $1
            ORDER BY r.submitted_at DESC`
        : `SELECT r.id, r.global_user_id, r.submitted_by_user_id, r.submitted_at,
                  r.submission_notes, r.status, r.reviewed_at, r.reviewed_by_user_id,
                  r.decision_reason, r.target_kyc_level,
                  gu.full_name, i.tax_id, i.tax_id_type,
                  i.kyc_status AS kyc_status_current, i.kyc_level AS kyc_level_current
             FROM identity_validation_requests r
             JOIN identities i   ON i.global_user_id  = r.global_user_id
             JOIN global_users gu ON gu.global_user_id = r.global_user_id
            ORDER BY r.submitted_at DESC`,
      status ? [status] : [],
    );

    return rows.rows.map((row) => ({
      id: row.id,
      globalUserId: row.global_user_id,
      submittedByUserId: row.submitted_by_user_id,
      submittedAt: row.submitted_at.toISOString(),
      submissionNotes: row.submission_notes,
      status: row.status,
      reviewedAt: row.reviewed_at ? row.reviewed_at.toISOString() : null,
      reviewedByUserId: row.reviewed_by_user_id,
      decisionReason: row.decision_reason,
      targetKycLevel: row.target_kyc_level,
      fullName: row.full_name,
      taxId: row.tax_id,
      taxIdType: row.tax_id_type,
      kycStatusCurrent: row.kyc_status_current,
      kycLevelCurrent: row.kyc_level_current,
    }));
  }
}

export const identityValidationService = new IdentityValidationService();
