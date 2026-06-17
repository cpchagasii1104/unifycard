// src/modules/services/service-payment-execution.repository.ts
// Repository do Domínio de EXECUÇÃO DE PAGAMENTO
// 🔴 BLINDAGEM: Nenhuma execução deve ser criada sem payment_request = pending
// 🔴 BLINDAGEM: Split NÃO pode existir sem execution
// 🔴 BLINDAGEM: Soma dos splits = amount da execution

import type { PoolClient } from 'pg';
import { runQueryWithTenant } from '@core/database/pool';
import { bankSplitRepository } from '@modules/bank/bank-split.repository';
import type {
  ServicePaymentExecution,
  ServicePaymentExecutionRow,
  PaymentSplit,
  PaymentSplitRow,
  CreateServicePaymentExecutionInput,
  CreatePaymentSplitInput,
} from './service-payment-execution.types';

class ServicePaymentExecutionRepository {
  /**
   * Converte ServicePaymentExecutionRow para ServicePaymentExecution
   */
  private toServicePaymentExecution(row: ServicePaymentExecutionRow): ServicePaymentExecution {
    return {
      executionId: row.execution_id,
      tenantId: row.tenant_id,
      paymentRequestId: row.payment_request_id,
      payerActorId: row.payer_actor_id,
      receiverActorId: row.receiver_actor_id,
      amountCents: Number(row.amountCents),
      currency: row.currency,
      executedAt: row.executedAt,
      metadata: row.metadata || {},
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Converte PaymentSplitRow para PaymentSplit
   */
  private toPaymentSplit(row: PaymentSplitRow): PaymentSplit {
    return {
      splitId: row.split_id,
      tenantId: row.tenant_id,
      executionId: row.execution_id,
      receiverActorId: row.receiver_actor_id,
      amountCents: Number(row.amountCents),
      percentage: row.percentage ? parseFloat(row.percentage.toString()) : null,
      metadata: row.metadata || {},
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Busca execução por ID
   */
  async findById(tenantId: string, executionId: string): Promise<ServicePaymentExecution | null> {
    const row = await runQueryWithTenant<ServicePaymentExecutionRow>(
      tenantId,
      `
      SELECT 
        execution_id, tenant_id, payment_request_id, payer_actor_id, receiver_actor_id,
        amount_cents AS "amountCents", currency, executed_at as "executedAt", metadata, created_at, updated_at
      FROM service_payment_executions
      WHERE execution_id = $1 AND tenant_id = $2
      LIMIT 1
      `,
      [executionId, tenantId]
    );

    if (!row) {
      return null;
    }

    return this.toServicePaymentExecution(row);
  }

  /**
   * Busca execução por Payment Request ID
   * 🔴 BLINDAGEM: Apenas uma execução por payment_request (constraint UNIQUE)
   */
  async findByPaymentRequestId(tenantId: string, paymentRequestId: string): Promise<ServicePaymentExecution | null> {
    const row = await runQueryWithTenant<ServicePaymentExecutionRow>(
      tenantId,
      `
      SELECT 
        execution_id, tenant_id, payment_request_id, payer_actor_id, receiver_actor_id,
        amount_cents AS "amountCents", currency, executed_at as "executedAt", metadata, created_at, updated_at
      FROM service_payment_executions
      WHERE payment_request_id = $1 AND tenant_id = $2
      LIMIT 1
      `,
      [paymentRequestId, tenantId]
    );

    if (!row) {
      return null;
    }

    return this.toServicePaymentExecution(row);
  }

  /**
   * Busca splits de uma execução (fonte canónica: bank_splits via bankTransactionId no metadata).
   */
  async findSplitsByExecutionId(tenantId: string, executionId: string): Promise<PaymentSplit[]> {
    const exec = await runQueryWithTenant<{ metadata: Record<string, unknown> | string | null }>(
      tenantId,
      `SELECT metadata FROM service_payment_executions WHERE execution_id = $1 AND tenant_id = $2 LIMIT 1`,
      [executionId, tenantId]
    );
    if (!exec?.metadata) {
      return [];
    }
    const meta =
      typeof exec.metadata === 'string'
        ? (JSON.parse(exec.metadata) as Record<string, unknown>)
        : exec.metadata;
    const bankTxId = meta?.bankTransactionId as string | undefined;
    if (!bankTxId) {
      return [];
    }

    const rows = await bankSplitRepository.getPaymentExecutionSplitRows(tenantId, bankTxId);

    return rows.map((row) => {
      const sm =
        row.metadata && typeof row.metadata === 'string'
          ? (JSON.parse(row.metadata) as Record<string, unknown>)
          : (row.metadata as Record<string, unknown>) || {};
      const receiverActorId =
        (sm.receiverActorId as string) || row.receiver_actor_id || '';
      return {
        splitId: row.split_id,
        tenantId,
        executionId,
        receiverActorId,
        amountCents: row.amount_cents,
        percentage: row.percentage ? parseFloat(row.percentage) : null,
        metadata: sm,
        createdAt: row.created_at.toISOString(),
        updatedAt: row.created_at.toISOString(),
      };
    });
  }

  /**
   * Associa bank_transaction_id à execução (metadata JSON).
   */
  async attachBankTransactionId(
    tenantId: string,
    executionId: string,
    bankTransactionId: string
  ): Promise<void> {
    await runQueryWithTenant(
      tenantId,
      `
      UPDATE service_payment_executions
      SET metadata = COALESCE(metadata::jsonb, '{}'::jsonb) || $3::jsonb
      WHERE execution_id = $1 AND tenant_id = $2
      `,
      [
        executionId,
        tenantId,
        JSON.stringify({ bankTransactionId }),
      ]
    );
  }

  /**
   * Cria nova execução
   * 🔴 BLINDAGEM: paymentRequestId é OBRIGATÓRIO
   * 🔴 BLINDAGEM: Apenas uma execução por payment_request (constraint UNIQUE)
   */
  async create(
    tenantId: string,
    paymentRequestId: string,
    payerActorId: string,
    receiverActorId: string,
    amountCents: number,
    currency: string,
    bankTransactionId?: string,
    executionId?: string,
    /**
     * OUTBOX_ATOMICITY_HARDENING (Opção A): aceita client externo já com
     * BEGIN aberto. Quando informado, usa client.query (participa da
     * transação maior orquestrada pelo serviço). Quando ausente, usa
     * runQueryWithTenant (transação própria) — comportamento original
     * preservado, retrocompatível.
     */
    executingClient?: PoolClient
  ): Promise<ServicePaymentExecution> {
    if (!paymentRequestId) {
      throw new Error('paymentRequestId é obrigatório para criar execução');
    }
    if (!amountCents || amountCents <= 0) {
      throw new Error('amountCents deve ser maior que zero');
    }

    const sql = `
      INSERT INTO service_payment_executions (
        execution_id, tenant_id, payment_request_id, payer_actor_id, receiver_actor_id,
        amount_cents, currency, executed_at, metadata
      )
      VALUES (COALESCE($9::uuid, gen_random_uuid()), $1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (payment_request_id) DO NOTHING
      RETURNING
        execution_id, tenant_id, payment_request_id, payer_actor_id, receiver_actor_id,
        amount_cents AS "amountCents", currency, executed_at as "executedAt", metadata, created_at, updated_at
      `;
    const params: unknown[] = [
      tenantId,
      paymentRequestId,
      payerActorId,
      receiverActorId,
      amountCents,
      currency,
      new Date(),
      JSON.stringify({ bankTransactionId: bankTransactionId || null }),
      executionId ?? null,
    ];

    let row: ServicePaymentExecutionRow | undefined;
    if (executingClient) {
      // Participa da transação externa — client já tem BEGIN aberto.
      const res = await executingClient.query<ServicePaymentExecutionRow>(sql, params);
      row = res.rows[0];
    } else {
      // Transação própria via runQueryWithTenant (caminho retrocompatível).
      row = await runQueryWithTenant<ServicePaymentExecutionRow>(tenantId, sql, params);
    }

    if (!row) {
      // Conflito: já existe uma execução para este payment request
      throw new Error('Já existe uma execução para este payment request');
    }

    return this.toServicePaymentExecution(row);
  }

  /**
   * Cria novo split
   * 🔴 BLINDAGEM: executionId, receiverActorId e amount são OBRIGATÓRIOS
   * 🔴 BLINDAGEM: Soma dos splits = amount da execution (validado por trigger)
   */
  async createSplit(
    _tenantId: string,
    _executionId: string,
    _receiverActorId: string,
    _amountCents: number,
    _percentage?: number | null,
    _metadata?: Record<string, any>
  ): Promise<PaymentSplit> {
    throw new Error('DERIVA_FINANCEIRA_BLOQUEADA');
  }
}

export const servicePaymentExecutionRepository = new ServicePaymentExecutionRepository();




