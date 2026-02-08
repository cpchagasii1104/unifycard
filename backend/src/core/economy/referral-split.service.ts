// src/core/economy/referral-split.service.ts
// Motor de split para comissões de indicação
// Colaboração Claude + ChatGPT - 02/01/2026
//
// ⚠️ LEGACY — GATE 3 (SSOT)
//
// Este serviço representa o split LEGACY (fora do Bank).
//
// ❌ NÃO cria split
// ❌ NÃO altera status
// ❌ NÃO agrega valores financeiros
// ❌ NÃO produz estatísticas financeiras
//
// ✅ Permitido apenas:
// - leitura histórica (lista / detalhe)
//
// Split final e estatísticas vivem exclusivamente no Bank (bank_splits).

import db from '@core/db';

// ============================================================================
// REGRA DE NEGÓCIO (HISTÓRICA — DOCUMENTAL):
// - Cadastro cria identidade
// - Uso cria valor
// - Valor cria split
// ============================================================================

interface ReferralSplitInput {
  tenantId: string;
  transactionId: string;
  sourceUserId: string;
  amountCents: number;
  percentageBps?: number;
  metadata?: Record<string, any>;
}

interface ReferralSplitResult {
  created: boolean;
  splitId?: string;
  beneficiaryUserId?: string;
  splitAmountCents?: number;
  reason?: string;
}

class ReferralSplitService {
  /**
   * ❌ BLOQUEADO (Gate 3)
   */
  async processReferralSplit(_input: ReferralSplitInput): Promise<never> {
    throw new Error(
      '[GATE 3] referralSplitService.processReferralSplit() BLOQUEADO. ' +
      'Split final deve ser criado no Bank.'
    );
  }

  /**
   * Busca splits pendentes (LEGACY / leitura).
   * ⚠️ Não usar para decisão financeira.
   */
  async getPendingSplits(tenantId: string, limit: number = 100) {
    const rows = await db.runQueriesWithTenant<any>(
      tenantId,
      {
        text: `
          SELECT 
            lrs.*,
            u_source.email as source_email,
            u_beneficiary.email as beneficiary_email
          FROM ledger_referral_splits lrs
          JOIN users u_source ON u_source.user_id = lrs.source_user_id
          JOIN users u_beneficiary ON u_beneficiary.user_id = lrs.beneficiary_user_id
          WHERE lrs.status = 'pending'
          ORDER BY lrs.createdAt ASC
          LIMIT $1
        `,
        values: [limit],
      }
    );

    return rows || [];
  }

  /**
   * ❌ BLOQUEADO (Gate 3)
   */
  async markAsCredited(): Promise<never> {
    throw new Error(
      '[GATE 3] Alteração de status de split LEGACY é proibida. Use Bank.'
    );
  }

  /**
   * ❌ BLOQUEADO (Gate 3)
   */
  async markAsFailed(): Promise<never> {
    throw new Error(
      '[GATE 3] Alteração de status de split LEGACY é proibida. Use Bank.'
    );
  }

  /**
   * Histórico de comissões recebidas (LEGACY / leitura).
   * ⚠️ Valores monetários NÃO são retornados.
   */
  async getReceivedCommissions(
    tenantId: string,
    userId: string,
    options?: { status?: string; limit?: number; offset?: number }
  ) {
    const { status, limit = 50, offset = 0 } = options || {};

    let query = `
      SELECT 
        lrs.split_id,
        lrs.status,
        lrs.createdAt,
        lrs.creditedAt,
        lrs.metadata,
        u.email as source_email,
        p.full_name as source_name
      FROM ledger_referral_splits lrs
      JOIN users u ON u.user_id = lrs.source_user_id
      LEFT JOIN profiles p 
        ON p.user_id = u.user_id 
       AND p.tenant_id = lrs.tenant_id
      WHERE lrs.beneficiary_user_id = $1
    `;
    const params: any[] = [userId];

    if (status) {
      params.push(status);
      query += ` AND lrs.status = $${params.length}`;
    }

    query += `
      ORDER BY lrs.createdAt DESC
      LIMIT $${params.length + 1}
      OFFSET $${params.length + 2}
    `;
    params.push(limit, offset);

    return db.runQueriesWithTenant<any>(tenantId, {
      text: query,
      values: params,
    });
  }

  /**
   * ❌ BLOQUEADO (Gate 3)
   *
   * Agregação financeira fora do Bank é proibida.
   */
  async getTotalCommissions(): Promise<never> {
    throw new Error(
      '[GATE 3] Agregação de comissões LEGACY é proibida. Use Bank.'
    );
  }

  /**
   * ❌ BLOQUEADO (Gate 3)
   *
   * Estatísticas financeiras devem vir do Bank.
   */
  async getReferralStats(): Promise<never> {
    throw new Error(
      '[GATE 3] Estatísticas de referral LEGACY são proibidas. Use Bank.'
    );
  }
}

export const referralSplitService = new ReferralSplitService();

