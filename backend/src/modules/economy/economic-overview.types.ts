// src/modules/economy/economic-overview.types.ts
// Tipos do Dashboard Econômico (READ-ONLY)
// 🔴 BLINDAGEM: Este domínio NÃO cria dinheiro, NÃO executa pagamento e NÃO decide nada
// 🔴 BLINDAGEM: Ele apenas EXIBE o que já aconteceu
// 🔴 BLINDAGEM: isto NÃO é banco
// 🔴 BLINDAGEM: isto NÃO é carteira
// 🔴 BLINDAGEM: isto NÃO é saldo
// 🔴 BLINDAGEM: isto é apenas visualização histórica

/**
 * Transação Econômica (para histórico)
 * 🔴 BLINDAGEM: Apenas visualização histórica, não é fonte de verdade
 */
export interface EconomicTransaction {
  transactionId: string;
  type: 'payment_execution' | 'payment_split' | 'payment_request';
  amount: number;
  currency: string;
  payerActorId?: string;
  receiverActorId?: string;
  executedAt: Date;
  metadata: Record<string, any>;
}

/**
 * Overview Econômico de um Actor
 * 🔴 BLINDAGEM: Apenas visualização histórica, não é fonte de verdade
 * 🔴 BLINDAGEM: NÃO é banco, NÃO é carteira, NÃO é saldo
 */
export interface ActorEconomicOverview {
  actorId: string;
  tenantId: string;
  totalReceived: number; // Total recebido (como receiver em executions e splits)
  totalPaid: number; // Total pago (como payer em executions)
  totalDistributedViaSplit: number; // Total distribuído via split (como receiver em splits)
  executionsCount: number; // Quantidade de execuções
  lastTransactions: EconomicTransaction[]; // Últimas transações (limitado)
  currency: string; // Moeda (default: 'FIC')
  lastUpdated: Date;
}

/**
 * Overview Econômico de um Grupo
 * 🔴 BLINDAGEM: Apenas visualização histórica, não é fonte de verdade
 * 🔴 BLINDAGEM: NÃO é banco, NÃO é carteira, NÃO é saldo
 */
export interface GroupEconomicOverview {
  groupId: string;
  tenantId: string;
  totalReceived: number; // Total recebido (como receiver em executions e splits)
  totalDistributedViaSplit: number; // Total distribuído via split (como receiver em splits)
  executionsCount: number; // Quantidade de execuções onde grupo recebeu
  lastTransactions: EconomicTransaction[]; // Últimas transações (limitado)
  currency: string; // Moeda (default: 'FIC')
  lastUpdated: Date;
}

