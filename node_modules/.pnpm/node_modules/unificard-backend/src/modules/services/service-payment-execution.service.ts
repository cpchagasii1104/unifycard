// src/modules/services/service-payment-execution.service.ts
// SPRINT 3: INTEGRATED WITH UNIFY BANK
// Service do Domínio de EXECUÇÃO DE PAGAMENTO
// 🔴 BLINDAGEM: Execução só pode existir se houver payment_request = pending
// 🔴 BLINDAGEM: Execução é explícita, nunca automática
// 🔴 CRÍTICO: Toda execução cria transação no Unify Bank

import { servicePaymentExecutionRepository } from './service-payment-execution.repository';
import { servicePaymentRequestRepository } from './service-payment-request.repository';
import { actorRepository } from '@modules/social/actor.repository';
import { BadRequestError } from '@core/errors';
import { bankIntegrationService } from '../bank/bank-integration.service';
import type {
  ServicePaymentExecution,
  PaymentSplit,
  CreateServicePaymentExecutionInput,
  CreatePaymentSplitInput,
} from './service-payment-execution.types';
import { PaymentRequestStatus } from './service-payment-request.types';

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

    // SPRINT 3: Criar transação no Unify Bank ANTES de criar execução
    // (para poder incluir transaction_id no metadata)
    let bankTransactionId: string | undefined;
    
    // Resolver user_id dos actors (assumindo que actor_id = user_id para actors do tipo 'user')
    let payerUserId: string | undefined;
    let receiverUserId: string | undefined;

    if (payerActor.actor_type === 'user') {
      payerUserId = payerActor.actor_id; // Assumindo que actor_id = user_id para users
    }

    if (receiverActor.actor_type === 'user') {
      receiverUserId = receiverActor.actor_id;
    }

    // Criar transação no Unify Bank se ambos são users e moeda é BRL
    if (payerUserId && receiverUserId && paymentRequest.currency === 'BRL') {
      try {
        const bankResult = await bankIntegrationService.processServiceBookingPayment(tenantId, {
          bookingId: paymentRequest.bookingId,
          serviceId: paymentRequest.serviceId,
          buyerUserId: payerUserId,
          providerUserId: receiverUserId,
          amountCents: paymentRequest.amountCents,
          currency: 'BRL',
          idempotencyKey: `execution-${paymentRequest.paymentRequestId}`,
          metadata: {
            paymentRequestId: paymentRequest.paymentRequestId,
            bookingId: paymentRequest.bookingId,
            serviceId: paymentRequest.serviceId,
          },
        });

        bankTransactionId = bankResult.transactionId;
      } catch (error) {
        // Log mas não falha a execução se bank falhar (para compatibilidade)
        console.error('Erro ao criar transação no Unify Bank (não crítico):', error);
      }
    }

    // Criar execução (com bankTransactionId no metadata se disponível)
    const execution = await servicePaymentExecutionRepository.create(
      tenantId,
      paymentRequest.paymentRequestId,
      paymentRequest.payerActorId,
      paymentRequest.receiverActorId,
      paymentRequest.amount,
      paymentRequest.currency,
      bankTransactionId
    );

    // Criar transação no Unify Bank se ambos são users e moeda é BRL
    if (payerUserId && receiverUserId && paymentRequest.currency === 'BRL') {
      try {
        const bankResult = await bankIntegrationService.processServiceBookingPayment(tenantId, {
          bookingId: paymentRequest.bookingId,
          serviceId: paymentRequest.serviceId,
          buyerUserId: payerUserId,
          providerUserId: receiverUserId,
          amountCents: paymentRequest.amountCents,
          currency: 'BRL',
          idempotencyKey: execution.executionId,
          metadata: {
            paymentRequestId: paymentRequest.paymentRequestId,
            executionId: execution.executionId,
            bookingId: paymentRequest.bookingId,
            serviceId: paymentRequest.serviceId,
          },
        });

        bankTransactionId = bankResult.transactionId;
      } catch (error) {
        // Log mas não falha a execução se bank falhar (para compatibilidade)
        console.error('Erro ao criar transação no Unify Bank (não crítico):', error);
      }
    }

    // Criar splits
    const splits: PaymentSplit[] = [];
    
    if (input.splits && input.splits.length > 0) {
      // 🔴 BLINDAGEM: Validar que soma dos splits = amount da execution
      const splitsSum = input.splits.reduce((sum, split) => sum + split.amountCents, 0);
      if (Math.abs(splitsSum - execution.amountCents) > 0.01) {
        throw new BadRequestError(`Soma dos splits (${splitsSum}) deve ser igual ao amountCents da execution (${execution.amountCents})`);
      }

      // Criar cada split
      for (const splitInput of input.splits) {
        // Validar que receiver_actor existe
        const splitReceiverActor = await actorRepository.findById(tenantId, splitInput.receiverActorId);
        if (!splitReceiverActor) {
          throw new BadRequestError(`Actor receptor do split não encontrado: ${splitInput.receiverActorId}`);
        }

        const split = await servicePaymentExecutionRepository.createSplit(
          tenantId,
          execution.executionId,
          splitInput.receiverActorId,
          splitInput.amountCents,
          splitInput.percentage,
          splitInput.metadata
        );
        splits.push(split);
      }
    } else {
      // Se não fornecido splits, criar split único para receiver
      const split = await servicePaymentExecutionRepository.createSplit(
        tenantId,
        execution.executionId,
        paymentRequest.receiverActorId,
        paymentRequest.amountCents,
        100.0, // 100% para o receiver principal
        {}
      );
      splits.push(split);
    }

    // 🔴 BLINDAGEM: Emitir effects ao criar execução
    // Effect é consequência sistêmica, não decisão humana
    // Execução é explícita, nunca automática
    try {
      const { eventBus } = await import('@core/events/event-bus');
      const { v4: uuidv4 } = await import('uuid');
      const { ActorEffect } = await import('@modules/social/actor-effects.types');
      
      await eventBus.publish({
        eventId: uuidv4(),
        tenantId,
        type: ActorEffect.SERVICE_PAYMENT_EXECUTED,
        version: 1,
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
            splitsCount: splits.length,
          },
        },
        metadata: {
          userId: userId,
          paymentRequestId: paymentRequest.paymentRequestId,
          executionId: execution.executionId,
        },
      });

      // Emitir effect para cada split
      for (const split of splits) {
        await eventBus.publish({
          eventId: uuidv4(),
          tenantId,
          type: ActorEffect.SERVICE_PAYMENT_SPLIT_APPLIED,
          version: 1,
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
    } catch (error) {
      // Não quebra criação se effect falhar
      console.error('Erro ao emitir effects ao criar execução (não crítico):', error);
    }

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


