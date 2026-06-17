// src/modules/services/service-payment-execution.types.ts
// Tipos do Domínio de EXECUÇÃO DE PAGAMENTO
// 🔴 BLINDAGEM: Execução só pode existir se houver payment_request = pending
// 🔴 BLINDAGEM: Execução é explícita, nunca automática
// 🔴 BLINDAGEM: Nenhuma integração real
// 🔴 BLINDAGEM: Nenhum gateway
// 🔴 BLINDAGEM: Nenhum banco
// 🔴 BLINDAGEM: Nenhuma cobrança externa
// 🔴 BLINDAGEM: Dinheiro é fictício
// 🔴 BLINDAGEM: Execução é apenas registro contábil
// 🔴 BLINDAGEM: Split é explícito
// 🔴 BLINDAGEM: Nada movimenta saldo real

/**
 * Execução de Pagamento de Serviço (entidade de domínio)
 * 🔴 BLINDAGEM: Execução só pode existir se houver payment_request = pending
 * 🔴 BLINDAGEM: Execução é explícita, nunca automática
 * 🔴 BLINDAGEM: Dinheiro é fictício
 * 🔴 BLINDAGEM: Execução é apenas registro contábil
 * 🔴 BLINDAGEM: Nada movimenta saldo real
 */
export interface ServicePaymentExecution {
  executionId: string;
  tenantId: string;
  paymentRequestId: string; // OBRIGATÓRIO: Payment request relacionado
  payerActorId: string; // OBRIGATÓRIO: Actor que paga
  receiverActorId: string; // OBRIGATÓRIO: Actor que recebe (dono do service)
  amountCents: number; // Valor executado (deve ser igual ao payment_request.amountCents)
  currency: string; // Moeda canônica da execução: 'BRL' (07 §4.10; execução é BRL-fail-closed)
  executedAt: Date;
  metadata: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

/**
 * Split de Pagamento (entidade de domínio)
 * 🔴 BLINDAGEM: Split NÃO pode existir sem execution
 * 🔴 BLINDAGEM: Soma dos splits = amount da execution
 * 🔴 BLINDAGEM: Split é explícito
 * 🔴 BLINDAGEM: Grupos podem receber split
 * 🔴 BLINDAGEM: Indicação pode receber split
 */
export interface PaymentSplit {
  splitId: string;
  tenantId: string;
  executionId: string; // OBRIGATÓRIO: Execution relacionado
  receiverActorId: string; // OBRIGATÓRIO: Actor que recebe parte do split
  amountCents: number; // Valor do split
  percentage?: number | null; // Porcentagem do split (opcional, para referência)
  metadata: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

/**
 * Linha do banco de dados (ServicePaymentExecutionRow)
 */
export interface ServicePaymentExecutionRow {
  execution_id: string;
  tenant_id: string;
  payment_request_id: string;
  payer_actor_id: string;
  receiver_actor_id: string;
  amountCents: number;
  currency: string;
  executedAt: Date;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

/**
 * Linha do banco de dados (PaymentSplitRow)
 */
export interface PaymentSplitRow {
  split_id: string;
  tenant_id: string;
  execution_id: string;
  receiver_actor_id: string;
  amountCents: number;
  percentage: number | null;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

/**
 * Input para criar execução de pagamento
 * 🔴 BLINDAGEM: paymentRequestId é OBRIGATÓRIO
 * 🔴 BLINDAGEM: Execução só pode existir se houver payment_request = pending
 */
export interface CreateServicePaymentExecutionInput {
  paymentRequestId: string; // OBRIGATÓRIO
  splits?: CreatePaymentSplitInput[]; // Splits opcionais (se não fornecido, cria split único para receiver)
}

/**
 * Input para criar split de pagamento
 * 🔴 BLINDAGEM: receiverActorId e amount são OBRIGATÓRIOS
 */
export interface CreatePaymentSplitInput {
  receiverActorId: string; // OBRIGATÓRIO
  amountCents: number; // OBRIGATÓRIO: Valor do split
  percentage?: number | null; // Opcional: Porcentagem do split
  metadata?: Record<string, any>;
}




