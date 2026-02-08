// backend/src/modules/bank/bank-split.repository.ts
// SPRINT 2: TRANSACTIONS + SPLIT ENGINE
// Repository para splits do Unify Bank

import { getClientWithTenant } from '@core/database/pool';
import type {
  BankSplit,
  CreateBankSplitInput,
} from './bank-split.types';
import type { FinancialAuthorshipContext } from './financial-authorship.types';

interface BankSplitRow {
  split_id: string;
  tenant_id: string;
  transaction_id: string;
  service_order_id: string | null;
  target_account_id: string;
  amountCents: string;
  percentage: string | null;
  split_type: string;
  description: string | null;
  metadata: any;
  createdAt: Date;
}

class BankSplitRepository {
  /**
   * Converte row do banco para objeto BankSplit
   */
  private toSplit(row: BankSplitRow): BankSplit {
    return {
      splitId: row.split_id,
      tenantId: row.tenant_id,
      transactionId: row.transaction_id,
      serviceOrderId: row.service_order_id,
      targetAccountId: row.target_account_id,
      amountCents: parseFloat(row.amount),
      percentage: row.percentage ? parseFloat(row.percentage) : null,
      splitType: row.split_type as any,
      description: row.description,
      metadata: row.metadata,
      createdAt: row.createdAt.toISOString(),
    };
  }

  /**
   * Cria um split
   * 
   * 🔴 HARD FAIL: authorship é obrigatório (exceto jobs internos/system com authoritySource='system')
   */
  async createSplit(
    tenantId: string,
    input: CreateBankSplitInput
  ): Promise<BankSplit> {
    const {
      transactionId,
      targetAccountId,
      amount,
      percentage,
      splitType,
      description,
      metadata,
      authorship,
    } = input;

    // 🔴 HARD FAIL: Autoria obrigatória (REGRA INQUEBRÁVEL)
    if (!authorship) {
      throw new Error('Financial authorship is mandatory. Missing authorship context.');
    }

    return this.createSplitWithAuthorship(tenantId, input, authorship);
  }

  /**
   * Cria split com autoria (método interno)
   */
  private async createSplitWithAuthorship(
    tenantId: string,
    input: CreateBankSplitInput,
    authorship: FinancialAuthorshipContext
  ): Promise<BankSplit> {
    const {
      transactionId,
      targetAccountId,
      amount,
      percentage,
      splitType,
      description,
      metadata,
    } = input;

    const client = await getClientWithTenant(tenantId);

    try {
      const result = await client.query<BankSplitRow>(
        `
        INSERT INTO bank_splits (
          tenant_id, transaction_id, service_order_id, target_account_id,
          amount, percentage, split_type, description, metadata,
          performed_by_user_id, acting_for_actor_id, acting_for_account_id,
          authority_source, permission_snapshot, policy_snapshot
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        RETURNING split_id, tenant_id, transaction_id, service_order_id, target_account_id,
                  amount, percentage, split_type, description, metadata, createdAt
        `,
        [
          tenantId,
          transactionId,
          input.serviceOrderId || null,
          targetAccountId,
          amount,
          percentage || null,
          splitType,
          description || null,
          metadata ? JSON.stringify(metadata) : null,
          authorship.performedByUserId,
          authorship.actingForActorId,
          authorship.actingForAccountId || null,
          authorship.authoritySource,
          authorship.permissionSnapshot ? JSON.stringify(authorship.permissionSnapshot) : null,
          authorship.policySnapshot ? JSON.stringify(authorship.policySnapshot) : null,
        ]
      );

      if (result.rows.length === 0) {
        throw new Error('Failed to create split');
      }

      return this.toSplit(result.rows[0]);
    } finally {
      client.release();
    }
  }

  /**
   * Busca splits de uma transação
   */
  async getSplitsByTransaction(
    tenantId: string,
    transactionId: string
  ): Promise<BankSplit[]> {
    const client = await getClientWithTenant(tenantId);

    try {
      const result = await client.query<BankSplitRow>(
        `
        SELECT split_id, tenant_id, transaction_id, service_order_id, target_account_id,
               amount, percentage, split_type, description, metadata, createdAt
        FROM bank_splits
        WHERE transaction_id = $1
        ORDER BY createdAt ASC
        `,
        [transactionId]
      );

      return result.rows.map((row) => this.toSplit(row));
    } finally {
      client.release();
    }
  }

  /**
   * Valida que a soma dos splits é igual ao total da transação
   */
  async validateSplitsSum(
    tenantId: string,
    transactionId: string,
    transactionAmount: number
  ): Promise<{ isValid: boolean; totalCents: number; difference: number }> {
    const client = await getClientWithTenant(tenantId);

    try {
      const result = await client.query<{ totalCents: string }>(
        `
        SELECT COALESCE(SUM(amount), 0) as total
        FROM bank_splits
        WHERE transaction_id = $1
        `,
        [transactionId]
      );

      const total = parseFloat(result.rows[0]?.total || '0');
      const difference = Math.abs(transactionAmount - total);

      return {
        isValid: difference < 0.01, // Tolerância de 1 centavo
        total,
        difference,
      };
    } finally {
      client.release();
    }
  }

  /**
   * Busca splits de uma Service Order
   */
  async getSplitsByServiceOrder(
    tenantId: string,
    serviceOrderId: string
  ): Promise<BankSplit[]> {
    const client = await getClientWithTenant(tenantId);

    try {
      const result = await client.query<BankSplitRow>(
        `
        SELECT split_id, tenant_id, transaction_id, service_order_id, target_account_id,
               amount, percentage, split_type, description, metadata, createdAt
        FROM bank_splits
        WHERE tenant_id = $1 AND service_order_id = $2
        ORDER BY createdAt ASC
        `,
        [tenantId, serviceOrderId]
      );

      return result.rows.map((row) => this.toSplit(row));
    } finally {
      client.release();
    }
  }
}

export const bankSplitRepository = new BankSplitRepository();








