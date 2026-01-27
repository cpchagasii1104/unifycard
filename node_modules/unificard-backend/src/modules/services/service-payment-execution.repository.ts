// src/modules/services/service-payment-execution.repository.ts
// Repository do Domínio de EXECUÇÃO DE PAGAMENTO
// 🔴 BLINDAGEM: Nenhuma execução deve ser criada sem payment_request = pending
// 🔴 BLINDAGEM: Split NÃO pode existir sem execution
// 🔴 BLINDAGEM: Soma dos splits = amount da execution

import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';
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
      amount: parseFloat(row.amount.toString()),
      currency: row.currency,
      executedAt: row.executed_at,
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
      amount: parseFloat(row.amount.toString()),
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
        amount, currency, executed_at, metadata, created_at, updated_at
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
        amount, currency, executed_at, metadata, created_at, updated_at
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
   * Busca splits de uma execução
   */
  async findSplitsByExecutionId(tenantId: string, executionId: string): Promise<PaymentSplit[]> {
    const rows = await runQueriesWithTenant<PaymentSplitRow>(
      tenantId,
      `
      SELECT 
        split_id, tenant_id, execution_id, receiver_actor_id,
        amount, percentage, metadata, created_at, updated_at
      FROM payment_splits
      WHERE execution_id = $1 AND tenant_id = $2
      ORDER BY created_at ASC
      `,
      [executionId, tenantId]
    );

    return rows.map(this.toPaymentSplit);
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
    amount: number,
    currency: string,
    bankTransactionId?: string
  ): Promise<ServicePaymentExecution> {
    if (!paymentRequestId) {
      throw new Error('paymentRequestId é obrigatório para criar execução');
    }
    if (!amount || amount <= 0) {
      throw new Error('amount deve ser maior que zero');
    }

    const row = await runQueryWithTenant<ServicePaymentExecutionRow>(
      tenantId,
      `
      INSERT INTO service_payment_executions (
        tenant_id, payment_request_id, payer_actor_id, receiver_actor_id,
        amount, currency, executed_at, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (payment_request_id) DO NOTHING
      RETURNING 
        execution_id, tenant_id, payment_request_id, payer_actor_id, receiver_actor_id,
        amount, currency, executed_at, metadata, created_at, updated_at
      `,
      [
        tenantId,
        paymentRequestId,
        payerActorId,
        receiverActorId,
        amount,
        currency,
        new Date(),
        JSON.stringify({ bankTransactionId: bankTransactionId || null }),
      ]
    );

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
    tenantId: string,
    executionId: string,
    receiverActorId: string,
    amount: number,
    percentage?: number | null,
    metadata?: Record<string, any>
  ): Promise<PaymentSplit> {
    if (!executionId) {
      throw new Error('executionId é obrigatório para criar split');
    }
    if (!receiverActorId) {
      throw new Error('receiverActorId é obrigatório para criar split');
    }
    if (!amount || amount <= 0) {
      throw new Error('amount deve ser maior que zero');
    }

    const row = await runQueryWithTenant<PaymentSplitRow>(
      tenantId,
      `
      INSERT INTO payment_splits (
        tenant_id, execution_id, receiver_actor_id, amount, percentage, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING 
        split_id, tenant_id, execution_id, receiver_actor_id,
        amount, percentage, metadata, created_at, updated_at
      `,
      [
        tenantId,
        executionId,
        receiverActorId,
        amount,
        percentage || null,
        JSON.stringify(metadata || {}),
      ]
    );

    return this.toPaymentSplit(row);
  }
}

export const servicePaymentExecutionRepository = new ServicePaymentExecutionRepository();

