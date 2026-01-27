// src/modules/economy/economic-overview.projector.ts
// Projector para Dashboard Econômico (READ-ONLY)
// 🔴 BLINDAGEM: Este domínio NÃO cria dinheiro, NÃO executa pagamento e NÃO decide nada
// 🔴 BLINDAGEM: Ele apenas EXIBE o que já aconteceu
// 🔴 BLINDAGEM: isto NÃO é banco
// 🔴 BLINDAGEM: isto NÃO é carteira
// 🔴 BLINDAGEM: isto NÃO é saldo
// 🔴 BLINDAGEM: isto é apenas visualização histórica

import { runQueriesWithTenant } from '@core/database/pool';
import { ReadModelType } from '@core/read-models/read-model.types';
import type { UnificardEvent } from '@core/events/event-bus';
import type {
  ActorEconomicOverview,
  GroupEconomicOverview,
  EconomicTransaction,
} from './economic-overview.types';

/**
 * Projector para Economic Overview Read Models
 * 🔴 BLINDAGEM: Apenas visualização histórica, não cria nada
 */
class EconomicOverviewProjector {
  /**
   * Projeta Actor Economic Overview
   * 🔴 BLINDAGEM: Calcula agregações a partir de PAYMENT_EXECUTION, PAYMENT_SPLIT, SERVICE_PAYMENT_REQUEST
   */
  async projectActorEconomicOverview(
    tenantId: string,
    actorId: string
  ): Promise<ActorEconomicOverview> {
    // 🔴 BLINDAGEM: Buscar dados de PAYMENT_EXECUTION onde actor é payer ou receiver
    const executionsAsPayer = await runQueriesWithTenant<{
      amount: number;
      currency: string;
      executed_at: Date;
      execution_id: string;
    }>(
      tenantId,
      `
      SELECT 
        amount, currency, executed_at, execution_id
      FROM service_payment_executions
      WHERE payer_actor_id = $1 AND tenant_id = $2
      ORDER BY executed_at DESC
      LIMIT 100
      `,
      [actorId, tenantId]
    );

    const executionsAsReceiver = await runQueriesWithTenant<{
      amount: number;
      currency: string;
      executed_at: Date;
      execution_id: string;
    }>(
      tenantId,
      `
      SELECT 
        amount, currency, executed_at, execution_id
      FROM service_payment_executions
      WHERE receiver_actor_id = $1 AND tenant_id = $2
      ORDER BY executed_at DESC
      LIMIT 100
      `,
      [actorId, tenantId]
    );

    // 🔴 BLINDAGEM: Buscar dados de PAYMENT_SPLIT onde actor é receiver
    const splitsAsReceiver = await runQueriesWithTenant<{
      amount: number;
      currency: string;
      executed_at: Date;
      split_id: string;
      execution_id: string;
    }>(
      tenantId,
      `
      SELECT 
        ps.amount, spe.currency, spe.executed_at, ps.split_id, ps.execution_id
      FROM payment_splits ps
      INNER JOIN service_payment_executions spe ON ps.execution_id = spe.execution_id
      WHERE ps.receiver_actor_id = $1 AND ps.tenant_id = $2
      ORDER BY spe.executed_at DESC
      LIMIT 100
      `,
      [actorId, tenantId]
    );

    // Calcular totais
    const totalPaid = executionsAsPayer.reduce((sum, e) => sum + parseFloat(e.amount.toString()), 0);
    const totalReceivedFromExecutions = executionsAsReceiver.reduce((sum, e) => sum + parseFloat(e.amount.toString()), 0);
    const totalDistributedViaSplit = splitsAsReceiver.reduce((sum, s) => sum + parseFloat(s.amount.toString()), 0);
    const totalReceived = totalReceivedFromExecutions + totalDistributedViaSplit;
    const executionsCount = executionsAsPayer.length + executionsAsReceiver.length;

    // Construir últimas transações
    const lastTransactions: EconomicTransaction[] = [];
    
    // Adicionar execuções como payer
    executionsAsPayer.slice(0, 20).forEach(e => {
      lastTransactions.push({
        transactionId: e.execution_id,
        type: 'payment_execution',
        amount: parseFloat(e.amount.toString()),
        currency: e.currency,
        payerActorId: actorId,
        executedAt: e.executed_at,
        metadata: {},
      });
    });

    // Adicionar execuções como receiver
    executionsAsReceiver.slice(0, 20).forEach(e => {
      lastTransactions.push({
        transactionId: e.execution_id,
        type: 'payment_execution',
        amount: parseFloat(e.amount.toString()),
        currency: e.currency,
        receiverActorId: actorId,
        executedAt: e.executed_at,
        metadata: {},
      });
    });

    // Adicionar splits como receiver
    splitsAsReceiver.slice(0, 20).forEach(s => {
      lastTransactions.push({
        transactionId: s.split_id,
        type: 'payment_split',
        amount: parseFloat(s.amount.toString()),
        currency: s.currency,
        receiverActorId: actorId,
        executedAt: s.executed_at,
        metadata: { executionId: s.execution_id },
      });
    });

    // Ordenar por data (mais recente primeiro) e limitar
    lastTransactions.sort((a, b) => b.executedAt.getTime() - a.executedAt.getTime());
    const limitedTransactions = lastTransactions.slice(0, 20);

    const currency = executionsAsPayer[0]?.currency || executionsAsReceiver[0]?.currency || splitsAsReceiver[0]?.currency || 'FIC';

    return {
      actorId,
      tenantId,
      totalReceived,
      totalPaid,
      totalDistributedViaSplit,
      executionsCount,
      lastTransactions: limitedTransactions,
      currency,
      lastUpdated: new Date(),
    };
  }

  /**
   * Projeta Group Economic Overview
   * 🔴 BLINDAGEM: Calcula agregações a partir de PAYMENT_EXECUTION, PAYMENT_SPLIT
   * 🔴 BLINDAGEM: Grupos não pagam, apenas recebem
   */
  async projectGroupEconomicOverview(
    tenantId: string,
    groupId: string
  ): Promise<GroupEconomicOverview> {
    // 🔴 BLINDAGEM: Buscar dados de PAYMENT_EXECUTION onde grupo é receiver
    const executionsAsReceiver = await runQueriesWithTenant<{
      amount: number;
      currency: string;
      executed_at: Date;
      execution_id: string;
    }>(
      tenantId,
      `
      SELECT 
        amount, currency, executed_at, execution_id
      FROM service_payment_executions
      WHERE receiver_actor_id = $1 AND tenant_id = $2
      ORDER BY executed_at DESC
      LIMIT 100
      `,
      [groupId, tenantId]
    );

    // 🔴 BLINDAGEM: Buscar dados de PAYMENT_SPLIT onde grupo é receiver
    const splitsAsReceiver = await runQueriesWithTenant<{
      amount: number;
      currency: string;
      executed_at: Date;
      split_id: string;
      execution_id: string;
    }>(
      tenantId,
      `
      SELECT 
        ps.amount, spe.currency, spe.executed_at, ps.split_id, ps.execution_id
      FROM payment_splits ps
      INNER JOIN service_payment_executions spe ON ps.execution_id = spe.execution_id
      WHERE ps.receiver_actor_id = $1 AND ps.tenant_id = $2
      ORDER BY spe.executed_at DESC
      LIMIT 100
      `,
      [groupId, tenantId]
    );

    // Calcular totais
    const totalReceivedFromExecutions = executionsAsReceiver.reduce((sum, e) => sum + parseFloat(e.amount.toString()), 0);
    const totalDistributedViaSplit = splitsAsReceiver.reduce((sum, s) => sum + parseFloat(s.amount.toString()), 0);
    const totalReceived = totalReceivedFromExecutions + totalDistributedViaSplit;
    const executionsCount = executionsAsReceiver.length;

    // Construir últimas transações
    const lastTransactions: EconomicTransaction[] = [];
    
    // Adicionar execuções como receiver
    executionsAsReceiver.slice(0, 20).forEach(e => {
      lastTransactions.push({
        transactionId: e.execution_id,
        type: 'payment_execution',
        amount: parseFloat(e.amount.toString()),
        currency: e.currency,
        receiverActorId: groupId,
        executedAt: e.executed_at,
        metadata: {},
      });
    });

    // Adicionar splits como receiver
    splitsAsReceiver.slice(0, 20).forEach(s => {
      lastTransactions.push({
        transactionId: s.split_id,
        type: 'payment_split',
        amount: parseFloat(s.amount.toString()),
        currency: s.currency,
        receiverActorId: groupId,
        executedAt: s.executed_at,
        metadata: { executionId: s.execution_id },
      });
    });

    // Ordenar por data (mais recente primeiro) e limitar
    lastTransactions.sort((a, b) => b.executedAt.getTime() - a.executedAt.getTime());
    const limitedTransactions = lastTransactions.slice(0, 20);

    const currency = executionsAsReceiver[0]?.currency || splitsAsReceiver[0]?.currency || 'FIC';

    return {
      groupId,
      tenantId,
      totalReceived,
      totalDistributedViaSplit,
      executionsCount,
      lastTransactions: limitedTransactions,
      currency,
      lastUpdated: new Date(),
    };
  }

  /**
   * Projeta Read Model baseado no tipo
   * 🔴 BLINDAGEM: Apenas visualização histórica, não cria nada
   */
  async projectReadModel(
    readModelType: ReadModelType,
    event: UnificardEvent
  ): Promise<void> {
    // 🔴 BLINDAGEM: Economic Overview Read Models são calculados sob demanda
    // Não precisam ser persistidos, apenas calculados quando solicitados
    // Este método existe para compatibilidade com o sistema de projeção
    // mas não faz nada, pois os dados são calculados em tempo real
  }
}

export const economicOverviewProjector = new EconomicOverviewProjector();

