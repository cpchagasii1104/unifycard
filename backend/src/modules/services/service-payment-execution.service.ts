// src/modules/services/service-payment-execution.service.ts
// SPRINT 3: INTEGRATED WITH UNIFY BANK
// Service do Domínio de EXECUÇÃO DE PAGAMENTO
// 🔴 BLINDAGEM: Execução só pode existir se houver payment_request = pending
// 🔴 BLINDAGEM: Execução é explícita, nunca automática
// 🔴 CRÍTICO: Toda execução cria transação no Unify Bank

import { createHash } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { getClientWithTenant } from '@core/database/pool';
import { insertEventOutboxRow } from '@core/events/event-outbox.repository';
import { servicePaymentExecutionRepository } from './service-payment-execution.repository';
import { servicePaymentRequestRepository } from './service-payment-request.repository';
import { actorRepository } from '@modules/social/actor.repository';
import { ActorEffect } from '@modules/social/actor-effects.types';
import { BadRequestError } from '@core/errors';
import { bankIntegrationService } from '../bank/bank-integration.service';
import { createPaymentIntentWithClient } from '@modules/payments/payment-intent-repository';
import type {
  ServicePaymentExecution,
  PaymentSplit,
  CreateServicePaymentExecutionInput,
  CreatePaymentSplitInput,
} from './service-payment-execution.types';
import { PaymentRequestStatus } from './service-payment-request.types';

function deterministicServicePaymentExecutedOutboxEventId(tenantId: string, executionId: string): string {
  const hash = createHash('sha256')
    .update(`SERVICE_PAYMENT_EXECUTED:${tenantId}:${executionId}`)
    .digest();
  const b = Buffer.alloc(16);
  hash.copy(b, 0, 0, 16);
  b[6] = (b[6]! & 0x0f) | 0x40;
  b[8] = (b[8]! & 0x3f) | 0x80;
  const h = b.toString('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

function deterministicServicePaymentSplitAppliedOutboxEventId(tenantId: string, splitId: string): string {
  const hash = createHash('sha256')
    .update(`SERVICE_PAYMENT_SPLIT_APPLIED:${tenantId}:${splitId}`)
    .digest();
  const b = Buffer.alloc(16);
  hash.copy(b, 0, 0, 16);
  b[6] = (b[6]! & 0x0f) | 0x40;
  b[8] = (b[8]! & 0x3f) | 0x80;
  const h = b.toString('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

class ServicePaymentExecutionService {
  /**
   * Cria uma nova execução de pagamento
   * 🔴 BLINDAGEM: paymentRequestId é OBRIGATÓRIO
   * 🔴 BLINDAGEM: Execução só pode existir se houver payment_request = pending
   * 🔴 BLINDAGEM: Execução é explícita, nunca automática
   */
  async createExecution(
    tenantId: string,
    userId: string,
    input: CreateServicePaymentExecutionInput
  ): Promise<{ execution: ServicePaymentExecution; splits: PaymentSplit[] }> {
    // 🔴 BLINDAGEM: Validar que paymentRequestId foi fornecido
    if (!input.paymentRequestId) {
      throw new BadRequestError('paymentRequestId é obrigatório para criar execução');
    }

    // 🔴 BLINDAGEM: Validar que payment request existe e está pendente
    const paymentRequest = await servicePaymentRequestRepository.findById(tenantId, input.paymentRequestId);
    if (!paymentRequest) {
      throw new BadRequestError('Payment request não encontrado');
    }
    if (paymentRequest.status !== PaymentRequestStatus.PENDING) {
      throw new BadRequestError('Só é possível executar payment request com status pending');
    }

    // 🔴 BLINDAGEM: Validar que payer_actor existe
    const payerActor = await actorRepository.findById(tenantId, paymentRequest.payerActorId);
    if (!payerActor) {
      throw new BadRequestError('Actor pagador não encontrado');
    }

    // 🔴 BLINDAGEM: Validar que receiver_actor existe
    const receiverActor = await actorRepository.findById(tenantId, paymentRequest.receiverActorId);
    if (!receiverActor) {
      throw new BadRequestError('Actor receptor não encontrado');
    }

    if (paymentRequest.currency !== 'BRL' || payerActor.actor_type !== 'user' || !payerActor.user_id) {
      throw new BadRequestError(
        'Execução canónica exige moeda BRL e pagador usuário com user_id (bank_splits).'
      );
    }

    const payerUserId = payerActor.user_id;

    const splitRecipients =
      input.splits && input.splits.length > 0
        ? input.splits.map((s) => ({
            receiverActorId: s.receiverActorId,
            amountCents: s.amountCents,
            percentage: s.percentage ?? null,
          }))
        : [
            {
              receiverActorId: paymentRequest.receiverActorId,
              amountCents: paymentRequest.amountCents,
              percentage: 100 as number | null,
            },
          ];

    const splitsSum = splitRecipients.reduce((sum, s) => sum + s.amountCents, 0);
    if (Math.abs(splitsSum - paymentRequest.amountCents) > 0.01) {
      throw new BadRequestError(
        `Soma dos splits (${splitsSum}) deve ser igual ao amountCents (${paymentRequest.amountCents})`
      );
    }

    for (const r of splitRecipients) {
      const a = await actorRepository.findById(tenantId, r.receiverActorId);
      if (!a) {
        throw new BadRequestError(`Actor receptor do split não encontrado: ${r.receiverActorId}`);
      }
    }

    const executionId = uuidv4();

    // ============================================================
    // OUTBOX_ATOMICITY_HARDENING (Opção A) — 1 transação cobrindo
    // bank + execution row + outbox. Eliminação do "dinheiro sem
    // evento": se qualquer escrita falhar, ROLLBACK reverte tudo.
    // O catch externo antigo (L222-225 pré-fatia) que engolia falhas
    // de outbox como "não crítico" foi REMOVIDO — agora a falha do
    // outbox DEVE quebrar a transação inteira. DT-OUTBOX-ATOMICITY
    // RESOLVED via este caminho.
    // ============================================================
    const client = await getClientWithTenant(tenantId);
    let execution: ServicePaymentExecution;
    let bankSplitsForOutbox: Array<{
      splitId: string;
      receiverActorId: string;
      amountCents: number;
      percentage: number | null;
    }>;

    try {
      await client.query('BEGIN');

      // 1) BANK — escreve bank_transactions + bank_ledger entries + bank_splits
      //    NO MESMO client. Retorna splits agregados (splitId + receiverActorId
      //    + amountCents + percentage) prontos para emissão do outbox sem
      //    releitura de banco.
      const bankResult = await bankIntegrationService.processServicePaymentExecutionCanonical(
        tenantId,
        {
          paymentRequestId: paymentRequest.paymentRequestId,
          executionId,
          payerUserId,
          payerActorId: paymentRequest.payerActorId,
          amountCents: paymentRequest.amountCents,
          currency: 'BRL',
          splitRecipients,
          metadata: {
            paymentRequestId: paymentRequest.paymentRequestId,
            bookingId: paymentRequest.bookingId,
            serviceId: paymentRequest.serviceId,
          },
        },
        client
      );
      const bankTransactionId = bankResult.transactionId;
      bankSplitsForOutbox = bankResult.splits;

      // 2) EXECUTION row — INSERT service_payment_executions no MESMO client.
      execution = await servicePaymentExecutionRepository.create(
        tenantId,
        paymentRequest.paymentRequestId,
        paymentRequest.payerActorId,
        paymentRequest.receiverActorId,
        paymentRequest.amountCents,
        paymentRequest.currency,
        bankTransactionId,
        executionId,
        client
      );

      // 3) PAYMENT INTENT — INSERT payment_intents status='escrowed' no MESMO
      //    client. Fecha o vínculo execução↔intent que destrava a Camada 1.
      //
      //    CAMADA 1 — ENTRADA EM ESCROW (Decisão Clayton D1'/D1''/D1'''):
      //    sem este intent, o settlement-worker NÃO tem fila para consumir
      //    e o dinheiro recém-creditado em escrow_payments fica preso. O par
      //    (crédito escrow + intent escrowed) acontece JUNTO ou nenhum
      //    acontece — atomicidade preservada pela mesma transação BEGIN/COMMIT.
      //
      //    Rastreabilidade do escrow agregado (D1''): metadata carrega
      //    receiverActorId, executionId, splits agregados — suficiente para
      //    o release alimentar seller_pending por receiver na próxima fatia.
      //
      //    UNIQUE (tenant_id, reference_id) em payment_intents: o
      //    referenceId = paymentRequestId é UNIQUE no payment_request (1
      //    request por booking), logo a constraint protege contra criação
      //    duplicada de intent para a mesma execução.
      await createPaymentIntentWithClient(client, tenantId, {
        referenceId: paymentRequest.paymentRequestId,
        gateway: 'unify_bank',
        actorId: paymentRequest.payerActorId,
        amountCents: paymentRequest.amountCents,
        currency: paymentRequest.currency,
        status: 'escrowed',
        source: 'service_execution',
        intentType: 'payment',
        metadata: {
          executionId: execution.executionId,
          paymentRequestId: paymentRequest.paymentRequestId,
          bookingId: paymentRequest.bookingId,
          serviceId: paymentRequest.serviceId,
          receiverActorId: paymentRequest.receiverActorId,
          bankTransactionId,
          splits: bankSplitsForOutbox.map((s) => ({
            splitId: s.splitId,
            receiverActorId: s.receiverActorId,
            amountCents: s.amountCents,
            percentage: s.percentage,
          })),
        },
      });

      // 4) OUTBOX — INSERTs event_outbox no MESMO client. Atomicidade
      //    completa: bank + execution + intent + outbox commitam ou rollback juntos.
      await insertEventOutboxRow(client, {
        tenantId,
        eventId: deterministicServicePaymentExecutedOutboxEventId(tenantId, execution.executionId),
        eventType: ActorEffect.SERVICE_PAYMENT_EXECUTED,
        eventVersion: 1,
        payload: {
          actorId: paymentRequest.payerActorId,
          actorType: payerActor.actor_type as any,
          intent: 'EXECUTE_PAYMENT',
          sourceId: execution.executionId,
          sourceType: 'service_payment_execution',
          metadata: {
            paymentRequestId: paymentRequest.paymentRequestId,
            amountCents: execution.amountCents,
            currency: execution.currency,
            splitsCount: bankSplitsForOutbox.length,
          },
        },
        metadata: {
          userId: userId,
          paymentRequestId: paymentRequest.paymentRequestId,
          executionId: execution.executionId,
        },
      });
      for (const split of bankSplitsForOutbox) {
        await insertEventOutboxRow(client, {
          tenantId,
          eventId: deterministicServicePaymentSplitAppliedOutboxEventId(tenantId, split.splitId),
          eventType: ActorEffect.SERVICE_PAYMENT_SPLIT_APPLIED,
          eventVersion: 1,
          payload: {
            actorId: split.receiverActorId,
            actorType: 'user' as any, // Será resolvido pelo effect handler
            intent: 'EXECUTE_PAYMENT',
            sourceId: split.splitId,
            sourceType: 'payment_split',
            metadata: {
              executionId: execution.executionId,
              amountCents: split.amountCents,
              percentage: split.percentage,
            },
          },
          metadata: {
            userId: userId,
            executionId: execution.executionId,
            splitId: split.splitId,
          },
        });
      }

      // COMMIT único — ou tudo grava, ou nada grava.
      await client.query('COMMIT');
    } catch (error) {
      try {
        await client.query('ROLLBACK');
      } catch (_rollbackErr) {
        // ROLLBACK falhou (conexão perdida) — propaga erro original.
      }
      throw error;
    } finally {
      client.release();
    }

    // Após COMMIT atômico — leitura derivada para devolver PaymentSplit[] no
    // formato esperado pelo contrato externo do método. bank_splits já está
    // comitado; findSplitsByExecutionId lê de fora da transação com segurança.
    const splits = await servicePaymentExecutionRepository.findSplitsByExecutionId(
      tenantId,
      execution.executionId
    );

    return { execution, splits };
  }

  /**
   * Busca execução por Payment Request ID
   * 🔴 BLINDAGEM: Apenas uma execução por payment_request (constraint UNIQUE)
   */
  async getExecutionByPaymentRequest(tenantId: string, paymentRequestId: string): Promise<{
    execution: ServicePaymentExecution | null;
    splits: PaymentSplit[];
  }> {
    // Validar que payment request existe
    const paymentRequest = await servicePaymentRequestRepository.findById(tenantId, paymentRequestId);
    if (!paymentRequest) {
      throw new BadRequestError('Payment request não encontrado');
    }

    const execution = await servicePaymentExecutionRepository.findByPaymentRequestId(tenantId, paymentRequestId);
    
    if (!execution) {
      return { execution: null, splits: [] };
    }

    const splits = await servicePaymentExecutionRepository.findSplitsByExecutionId(tenantId, execution.executionId);

    return { execution, splits };
  }
}

export const servicePaymentExecutionService = new ServicePaymentExecutionService();


