// backend/src/modules/marketplace/payment-split.repository.ts
// SPRINT 40.1: MARKETPLACE EXECUÇÃO - Split Declarativo
//
// ⚠️ LEGACY — GATE 3 (SSOT)
//
// Este repositório representa splits de pagamento LEGACY (marketplace).
//
// ❌ NÃO cria split
// ❌ NÃO remove split
// ❌ NÃO agrega valores
// ❌ NÃO decide distribuição financeira
//
// ✅ Permitido apenas:
// - leitura histórica / auditoria
//
// Split financeiro final vive EXCLUSIVAMENTE no Bank (bank_splits).

import db from '@core/db';
import type { PaymentSplit, CreatePaymentSplitInput } from './payment-split.types';

interface PaymentSplitRow {
  id: string;
  tenant_id: string;
  payment_intent_id: string;
  recipient_actor_id: string;
  amount: string;
  percentage: string | null;
  role: string;
  metadata: any;
  created_at: Date;
}

class PaymentSplitRepository {
  /**
   * Conversão LEGACY.
   * 🔴 Valor financeiro INVALIDADO.
   */
  private toSplit(row: PaymentSplitRow): PaymentSplit {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      paymentIntentId: row.payment_intent_id,
      recipientActorId: row.recipient_actor_id,
      amount: 0, // 🔴 dinheiro invalidado (Gate 3)
      percentage: null, // 🔴 percentuais inválidos fora do Bank
      role: row.role as any,
      metadata: row.metadata || null,
      createdAt: row.created_at,
    };
  }

  // =====================================================
  // 🔴 ESCRITA / EXECUÇÃO — BLOQUEADA
  // =====================================================

  async createSplit(
    _tenantId: string,
    _paymentIntentId: string,
    _input: CreatePaymentSplitInput
  ): Promise<never> {
    throw new Error(
      '[GATE 3] paymentSplitRepository.createSplit() BLOQUEADO. ' +
      'Split financeiro deve ser definido no Bank.'
    );
  }

  async deleteSplitsByIntent(): Promise<never> {
    throw new Error(
      '[GATE 3] paymentSplitRepository.deleteSplitsByIntent() BLOQUEADO.'
    );
  }

  async calculateTotalByIntent(): Promise<never> {
    throw new Error(
      '[GATE 3] Agregação financeira de splits LEGACY é proibida. Use Bank.'
    );
  }

  // =====================================================
  // 🟡 LEITURA HISTÓRICA — PERMITIDA
  // =====================================================

  async listSplitsByIntent(
    tenantId: string,
    paymentIntentId: string
  ): Promise<PaymentSplit[]> {
    const rows = await db.runQueriesWithTenant<PaymentSplitRow>(
      tenantId,
      {
        text: `
          SELECT id, tenant_id, payment_intent_id, recipient_actor_id,
                 amount, percentage, role, metadata, created_at
          FROM payment_splits
          WHERE tenant_id = $1 AND payment_intent_id = $2
          ORDER BY created_at ASC
        `,
        values: [tenantId, paymentIntentId],
      }
    );

    return rows.map((row) => this.toSplit(row));
  }
}

export const paymentSplitRepository = new PaymentSplitRepository();




