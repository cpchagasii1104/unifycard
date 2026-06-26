// backend/src/modules/services/service-order.service.ts
// SPRINT 68: SERVICE ORDERS + AGENDA CANÔNICA

import { createHash } from 'crypto';
import type { PoolClient } from 'pg';
import { serviceOrderRepository } from './service-order.repository';
// 🔴 CORREÇÃO FASE 1B: Toda lógica temporal agora usa unifiedAvailabilityService
import { serviceBookingDecisionRepository } from './service-booking-decision.repository';
import { servicesRepository } from './services.repository';
import { BookingDecisionStatus } from './service-booking-decision.types';
import { bankAccountService } from '@modules/bank/bank-account.service';
import { bankSplitRepository } from '@modules/bank/bank-split.repository';
import { bankTransactionService } from '@modules/bank/bank-transaction.service';
import { getClientWithTenant } from '@core/database/pool';
import { insertEventOutboxRow } from '@core/events/event-outbox.repository';
import { drainRecoveryObligationsForCredit } from '@modules/financial-recovery/actor-wallet-recovery-obligation.service';
import { HttpError } from '@core/errors/http-error';
import type { PermissionKey } from '@core/authorization/permission-keys';
import type { BankCurrency } from '@modules/bank/bank-account.types';
import type {
  ServiceOrder,
  CreateServiceOrderInput,
  ConfirmServiceOrderInput,
  StartServiceOrderInput,
  CompleteServiceOrderInput,
  CancelServiceOrderInput,
  ServiceOrderFilters,
  ServiceOrderFinancialTerms,
  ConfirmFinancialTermsInput,
} from './service-order.types';

/**
 * F1 (Camada 1 saída — 2026-05-26):
 *   Janela default de confirmação do buyer pós-conclusão do prestador.
 *   Configurável via env `CAMADA1_BUYER_CONFIRMATION_WINDOW_DAYS` (padrão 7).
 *   Vetada para 0 ou negativo (regra econômica: buyer DEVE ter janela
 *   real para confirmar antes do release).
 */
function resolveBuyerConfirmationWindowDays(): number {
  const raw = process.env.CAMADA1_BUYER_CONFIRMATION_WINDOW_DAYS;
  const parsed = raw != null && raw !== '' ? Number(raw) : NaN;
  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed;
  }
  return 7;
}

/**
 * F1 — event_id determinístico do outbox para SERVICE_ORDER_PENDING_BUYER_
 * CONFIRMATION. Pattern espelhado de service-payment-execution.service.ts:26-36
 * (deterministicServicePaymentExecutedOutboxEventId). Garante idempotência via
 * ON CONFLICT (event_id) DO NOTHING do event_outbox.
 */
function deterministicServiceOrderPendingOutboxEventId(
  tenantId: string,
  orderId: string
): string {
  const hash = createHash('sha256')
    .update(`SERVICE_ORDER_PENDING_BUYER_CONFIRMATION:${tenantId}:${orderId}`)
    .digest();
  const b = Buffer.alloc(16);
  hash.copy(b, 0, 0, 16);
  b[6] = (b[6]! & 0x0f) | 0x40;
  b[8] = (b[8]! & 0x3f) | 0x80;
  const h = b.toString('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

/**
 * D2 (Camada 1 saída — 2026-05-26) — event_id determinístico para
 * SERVICE_ORDER_RELEASE_APPROVED. Mesmo pattern do F1 — garante
 * idempotência via ON CONFLICT (event_id) DO NOTHING do event_outbox.
 *
 * Único event_id por orderId (não depende do caller: buyer confirm e
 * timeout emitem o MESMO event_id, então duas chamadas reusam a chave).
 *
 * Semântica do evento: "ordem APROVADA para futura liberação financeira"
 * — NÃO "fundos liberados". Frente financeira futura é responsável
 * por mover dinheiro de escrow_payments para seller_available (Bank).
 */
function deterministicServiceOrderReleaseApprovedOutboxEventId(
  tenantId: string,
  orderId: string
): string {
  const hash = createHash('sha256')
    .update(`SERVICE_ORDER_RELEASE_APPROVED:${tenantId}:${orderId}`)
    .digest();
  const b = Buffer.alloc(16);
  hash.copy(b, 0, 0, 16);
  b[6] = (b[6]! & 0x0f) | 0x40;
  b[8] = (b[8]! & 0x3f) | 0x80;
  const h = b.toString('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

/**
 * D-money (Camada 1 — 2026-05-26) — eventId determinístico do transfer
 * escrow_payments → actor_wallet POR SPLIT. Garante idempotência financeira
 * cross-retry mesmo em caminho excepcional (idempotência delegada do transfer
 * já protege; este eventId é defesa adicional).
 */
function deterministicReleaseTransferEventId(
  tenantId: string,
  orderId: string,
  splitId: string
): string {
  const hash = createHash('sha256')
    .update(`FIXED_PRICE_RELEASE_TO_ACTOR_WALLET:${tenantId}:${orderId}:${splitId}`)
    .digest();
  const b = Buffer.alloc(16);
  hash.copy(b, 0, 0, 16);
  b[6] = (b[6]! & 0x0f) | 0x40;
  b[8] = (b[8]! & 0x3f) | 0x80;
  const h = b.toString('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

/**
 * D-money — eventId determinístico do outbox SERVICE_ORDER_FUNDS_RELEASED_TO_
 * ACTOR_WALLET. Pattern espelho do F1/D2. Único event_id por orderId —
 * idempotência via ON CONFLICT (event_id) DO NOTHING.
 */
function deterministicReleaseFundsOutboxEventId(
  tenantId: string,
  orderId: string
): string {
  const hash = createHash('sha256')
    .update(`SERVICE_ORDER_FUNDS_RELEASED_TO_ACTOR_WALLET:${tenantId}:${orderId}`)
    .digest();
  const b = Buffer.alloc(16);
  hash.copy(b, 0, 0, 16);
  b[6] = (b[6]! & 0x0f) | 0x40;
  b[8] = (b[8]! & 0x3f) | 0x80;
  const h = b.toString('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

/**
 * Service para Ordens de Serviço
 *
 * ⚠️ REGRAS ARQUITETURAIS:
 * - Append-only: status muda, mas registros não desaparecem
 * - Status declarativos
 * - Audit em todas as mudanças
 * - Nada automático sem ação explícita
 * - NÃO executa pagamentos
 * - NÃO emite fiscal
 */
class ServiceOrderService {
  /**
   * Cria ordem de serviço (status: DRAFT)
   */
  async createOrder(
    tenantId: string,
    input: CreateServiceOrderInput,
    createdByActorId: string,
    createdByUserId?: string
  ): Promise<ServiceOrder> {
    // 0. Verificar rate limit
    try {
      const { businessRateLimitService } = await import('@core/rate-limiting/business-rate-limit.service');
      const rateLimit = await businessRateLimitService.checkRateLimit(
        tenantId,
        createdByActorId,
        'service_order:create',
        input.serviceId
      );
      if (!rateLimit.allowed) {
        const { RateLimitError } = await import('@core/errors');
        throw new RateLimitError(
          `Limite de criação de ordens de serviço excedido. Tente novamente após ${rateLimit.resetAt.toISOString()}`,
          rateLimit.resetAt,
          rateLimit.remaining
        );
      }
    } catch (rateLimitError: any) {
      if (rateLimitError.statusCode === 429) {
        throw rateLimitError;
      }
      console.warn('[ServiceOrder] Erro ao verificar rate limit (não bloqueante):', rateLimitError);
    }

    // Converter strings para Date se necessário
    const scheduledStart = input.scheduledStart instanceof Date ? input.scheduledStart : new Date(input.scheduledStart);
    const scheduledEnd = input.scheduledEnd ? (input.scheduledEnd instanceof Date ? input.scheduledEnd : new Date(input.scheduledEnd)) : null;

    // 1. Validar scheduled_start é no futuro
    const now = new Date();
    if (scheduledStart <= now) {
      throw new Error('scheduled_start deve ser no futuro');
    }

    // 2. Validar scheduled_end > scheduled_start (se fornecido)
    if (scheduledEnd && scheduledEnd <= scheduledStart) {
      throw new Error('scheduled_end deve ser depois de scheduled_start');
    }

    // 3. Criar ordem
    const order = await serviceOrderRepository.createOrder(tenantId, {
      serviceId: input.serviceId,
      workerActorId: input.workerActorId,
      customerActorId: input.customerActorId,
      bookingId: input.bookingId || null,
      decisionId: input.decisionId ?? null,
      serviceOfferingId: input.serviceOfferingId ?? null,
      scheduledStart,
      scheduledEnd,
      estimatedDurationMinutes: input.estimatedDurationMinutes || null,
      locationAddress: input.locationAddress || null,
      locationLatitude: input.locationLatitude || null,
      locationLongitude: input.locationLongitude || null,
      description: input.description || null,
      customerNotes: input.customerNotes || null,
      createdByActorId,
      createdByUserId: createdByUserId || null,
      metadata: input.metadata || {},
    });

    // 4. Registrar auditoria (sistema antigo)
    await this.recordAudit(tenantId, {
      eventType: 'SERVICE_ORDER_CREATED',
      orderId: order.id,
      status: order.status,
      createdByActorId,
      createdByUserId: createdByUserId || null,
    });

    // 5. Registrar log de auditoria de negócio (não bloqueante)
    try {
      const { recordBusinessAuditSafely } = await import('../business-audit/business-audit.helpers');
      await recordBusinessAuditSafely(tenantId, {
        action: 'service_order_created',
        actorId: createdByActorId,
        userId: createdByUserId || null,
        contextType: 'service_order',
        contextId: order.id,
        metadata: {
          serviceId: input.serviceId,
          status: order.status,
        },
      });
    } catch (auditError) {
      console.error('Erro ao registrar log de auditoria para service order criada:', auditError);
    }

    return order;
  }

  /**
   * Confirma ordem de serviço (DRAFT → CONFIRMED)
   * 
   * SPRINT 68: Cria evento de agenda automaticamente ao confirmar
   */
  async confirmOrder(
    tenantId: string,
    orderId: string,
    input: ConfirmServiceOrderInput
  ): Promise<ServiceOrder> {
    // 1. Buscar ordem
    const order = await serviceOrderRepository.getOrderById(tenantId, orderId);
    if (!order) {
      throw new Error(`Ordem não encontrada: ${orderId}`);
    }

    if (order.status !== 'draft') {
      throw new Error(`Ordem não está em draft (status: ${order.status})`);
    }

    // 2. 🔴 CORREÇÃO FASE 1B: Verificar conflitos (apenas alerta, não bloqueia)
    // Se order tiver bookingId, verificar conflitos via Unified Availability
    const endTime = order.scheduledEnd || new Date(
      order.scheduledStart.getTime() + (order.estimatedDurationMinutes || 60) * 60 * 1000
    );

    if (order.bookingId) {
      try {
        const { unifiedAvailabilityService } = await import('@core/availability/unified-availability.service');
        const booking = await unifiedAvailabilityService.getBooking(tenantId, order.bookingId);
        const conflictResult = await unifiedAvailabilityService.detectConflicts(
          tenantId,
          booking.availabilityId,
          order.workerActorId
        );
        
        if (conflictResult.hasConflicts) {
          // Apenas logar alerta, não bloquear
          console.warn(`[ServiceOrder] Conflitos detectados para ordem ${orderId}:`, conflictResult.conflicts);
        }
      } catch (conflictError) {
        // Não bloquear se detecção de conflito falhar
        console.warn(`[ServiceOrder] Erro ao detectar conflitos para ordem ${orderId}:`, conflictError);
      }
    }

    // 3. Confirmar ordem
    const confirmedOrder = await serviceOrderRepository.confirmOrder(
      tenantId,
      orderId,
      input.confirmedByActorId
    );

    // 4. 🔴 CORREÇÃO FASE 1B: Removida criação de calendar event (agenda paralela proibida)
    // Service order não cria agenda própria, apenas referencia Unified Availability via booking

    // 5. Registrar auditoria (sistema antigo)
    await this.recordAudit(tenantId, {
      eventType: 'SERVICE_ORDER_CONFIRMED',
      orderId: confirmedOrder.id,
      status: confirmedOrder.status,
      confirmedByActorId: input.confirmedByActorId,
      confirmedByUserId: input.confirmedByUserId,
    });

    // 6. Registrar log de auditoria de negócio (não bloqueante)
    try {
      const { recordBusinessAuditSafely } = await import('../business-audit/business-audit.helpers');
      await recordBusinessAuditSafely(tenantId, {
        action: 'service_order_confirmed',
        actorId: input.confirmedByActorId,
        userId: input.confirmedByUserId || null,
        contextType: 'service_order',
        contextId: confirmedOrder.id,
        metadata: {
          previousStatus: order.status,
          newStatus: confirmedOrder.status,
        },
      });
    } catch (auditError) {
      console.error('Erro ao registrar log de auditoria para service order confirmada:', auditError);
    }

    return confirmedOrder;
  }

  /**
   * Inicia ordem de serviço (CONFIRMED → IN_PROGRESS)
   */
  async startOrder(
    tenantId: string,
    orderId: string,
    input: StartServiceOrderInput
  ): Promise<ServiceOrder> {
    // 0. Validar permissão via authority.service (§4.9)
    if (input.startedByUserId) {
      const { authorityService } = await import('@modules/authority/authority.service');
      const auth = await authorityService.canPerformAction(
        input.startedByActorId,
        'service_order:start',
        undefined,
        { tenantId, userId: input.startedByUserId }
      );
      if (!auth.allowed) {
        throw HttpError.forbidden(
          auth.reason || 'Você não tem permissão para iniciar ordem de serviço'
        );
      }
    }

    // 1. Buscar ordem
    const order = await serviceOrderRepository.getOrderById(tenantId, orderId);
    if (!order) {
      throw new Error(`Ordem não encontrada: ${orderId}`);
    }

    if (order.status !== 'confirmed') {
      throw new Error(`Ordem não está em confirmed (status: ${order.status})`);
    }

    // 2. Iniciar ordem
    const startedOrder = await serviceOrderRepository.startOrder(
      tenantId,
      orderId,
      input.workerNotes || null
    );

    // 3. 🔴 CORREÇÃO FASE 1B: Removida atualização de calendar event (agenda paralela não existe mais)
    // Status da ordem é gerenciado apenas em service_orders, não em agenda paralela

    // 4. Registrar auditoria (sistema antigo)
    await this.recordAudit(tenantId, {
      eventType: 'SERVICE_ORDER_STARTED',
      orderId: startedOrder.id,
      status: startedOrder.status,
      startedByActorId: input.startedByActorId,
      startedByUserId: input.startedByUserId,
    });

    // 5. Registrar log de auditoria de negócio (não bloqueante)
    try {
      const { recordBusinessAuditSafely } = await import('../business-audit/business-audit.helpers');
      await recordBusinessAuditSafely(tenantId, {
        action: 'service_order_started',
        actorId: input.startedByActorId,
        userId: input.startedByUserId || null,
        contextType: 'service_order',
        contextId: startedOrder.id,
        metadata: {
          previousStatus: order.status,
          newStatus: startedOrder.status,
        },
      });
    } catch (auditError) {
      console.error('Erro ao registrar log de auditoria para service order iniciada:', auditError);
    }

    return startedOrder;
  }

  /**
   * Completa ordem de serviço.
   *
   * BIFURCAÇÃO POR settlement_flow (decisão Clayton F1 — 2026-05-26):
   *
   *   - `fixed_price_escrow` (Camada 1):
   *       in_progress → SELLER_PENDING + carimba buyer_confirmation_deadline_at
   *       (now()+7d configurável) + release_eligible_at. Atômico com INSERT
   *       no event_outbox (SERVICE_ORDER_PENDING_BUYER_CONFIRMATION).
   *       NÃO MOVE DINHEIRO — dinheiro permanece em escrow_payments.
   *
   *   - `none` ou qualquer outro fluxo (comportamento legado):
   *       in_progress → COMPLETED, sem campos F1, sem outbox F1.
   *
   * @param existingClient Pattern existingClient (convergência arquitetural —
   *   espelha createExecution após commit 1352d9da). Modo CONVIDADO permite
   *   teste/caller controlar a tx por fora (B7.b análogo).
   */
  async completeOrder(
    tenantId: string,
    orderId: string,
    input: CompleteServiceOrderInput,
    existingClient?: PoolClient
  ): Promise<ServiceOrder> {
    // 0. Validar permissão via authority.service (fachada modules — §4.9)
    if (input.completedByUserId) {
      const { authorityService } = await import('@modules/authority/authority.service');
      const auth = await authorityService.canPerformAction(
        input.completedByActorId,
        'service_order:complete',
        undefined,
        { tenantId, userId: input.completedByUserId }
      );
      if (!auth.allowed) {
        throw HttpError.forbidden(
          auth.reason || 'Você não tem permissão para completar ordem de serviço'
        );
      }
    }

    // 1. Buscar ordem
    const order = await serviceOrderRepository.getOrderById(tenantId, orderId);
    if (!order) {
      throw new Error(`Ordem não encontrada: ${orderId}`);
    }

    if (order.status !== 'in_progress') {
      throw new Error(`Ordem não está em in_progress (status: ${order.status})`);
    }

    // 1.5. 🔴 BLINDAGEM: Validar escrow antes de completar (se houver agreement)
    // Se service order tiver agreement vinculado, verificar escrow
    if (order.bookingId) {
      try {
        const { unifiedAvailabilityService } = await import('@core/availability/unified-availability.service');
        const booking = await unifiedAvailabilityService.getBooking(tenantId, order.bookingId);
        if (booking && booking.metadata?.eventId) {
          // Buscar agreement do evento
          const { agreementRepository } = await import('../agreements/agreement.repository');
          const agreements = await agreementRepository.findByContext(
            tenantId,
            'event',
            booking.metadata.eventId
          );
          const finalizedAgreement = agreements.find((a) => a.status === 'finalized');

          if (finalizedAgreement) {
            // Verificar se existe escrow
            const { escrowRepository } = await import('../escrow/escrow.repository');
            const escrow = await escrowRepository.findByAgreement(tenantId, finalizedAgreement.agreementId);

            if (!escrow) {
              throw new Error(
                'Não é possível completar a ordem sem escrow account. Crie o escrow antes de completar.'
              );
            }

            // Validar que milestone completed está autorizado ou pode ser autorizado
            const milestones = await escrowRepository.listMilestones(tenantId, escrow.escrowId);
            const completedMilestone = milestones.find((m) => m.milestone === 'completed');

            if (completedMilestone && completedMilestone.status === 'pending') {
              // Autorizar milestone completed automaticamente ao completar ordem
              await escrowRepository.updateMilestoneStatus(
                tenantId,
                completedMilestone.milestoneId,
                'AUTHORIZED',
                input.completedByActorId,
                undefined
              );
            }
          }
        }
      } catch (escrowError: any) {
        // Se erro for sobre escrow obrigatório, lançar
        if (escrowError.message?.includes('escrow') || escrowError.message?.includes('Escrow')) {
          throw escrowError;
        }
        // Outros erros são ignorados (não bloqueiam completion se não houver agreement)
        console.warn('[ServiceOrder] Erro ao validar escrow (não bloqueante):', escrowError);
      }
    }

    // 2. Completar ordem — BIFURCA POR settlement_flow (F1 Camada 1).
    let completedOrder: ServiceOrder;
    if (order.settlementFlow === 'fixed_price_escrow') {
      // ============================================================
      // CAMINHO F1 — fixed_price_escrow → seller_pending + outbox atômico
      // ============================================================
      // Atomicidade: UPDATE service_orders + INSERT event_outbox JUNTOS
      // ou ROLLBACK juntos. Pattern existingClient (8afeec9a/1352d9da).
      const windowDays = resolveBuyerConfirmationWindowDays();
      const now = new Date();
      const deadlineAt = new Date(now.getTime() + windowDays * 24 * 60 * 60 * 1000);
      // Hoje release_eligible_at = deadline_at (D2 caminho lento). Quando
      // D2 caminho rápido (buyer confirma cedo) chegar, este campo pode
      // ser antecipado por buyer_confirmed_completion_at.
      const releaseEligibleAt = deadlineAt;

      const client = existingClient ?? (await getClientWithTenant(tenantId));
      const ownClient = !existingClient;
      try {
        if (ownClient) {
          await client.query('BEGIN');
        }

        completedOrder = await serviceOrderRepository.markAsSellerPending(
          tenantId,
          orderId,
          deadlineAt,
          releaseEligibleAt,
          input.workerNotes ?? null,
          client
        );

        // Outbox atômico — event_id determinístico (idempotência via
        // ON CONFLICT DO NOTHING do event_outbox).
        await insertEventOutboxRow(client, {
          tenantId,
          eventId: deterministicServiceOrderPendingOutboxEventId(tenantId, orderId),
          eventType: 'SERVICE_ORDER_PENDING_BUYER_CONFIRMATION',
          eventVersion: 1,
          payload: {
            orderId,
            serviceId: completedOrder.serviceId,
            workerActorId: completedOrder.workerActorId,
            customerActorId: completedOrder.customerActorId,
            bookingId: completedOrder.bookingId,
            settlementFlow: completedOrder.settlementFlow,
            buyerConfirmationDeadlineAt: deadlineAt.toISOString(),
            releaseEligibleAt: releaseEligibleAt.toISOString(),
            providerCompletedAt: completedOrder.completedAt
              ? completedOrder.completedAt.toISOString()
              : null,
          },
          metadata: {
            completedByActorId: input.completedByActorId,
            completedByUserId: input.completedByUserId ?? null,
            confirmationWindowDays: windowDays,
          },
        });

        if (ownClient) {
          await client.query('COMMIT');
        }
      } catch (error) {
        if (ownClient) {
          try {
            await client.query('ROLLBACK');
          } catch (_rollbackErr) {
            // ROLLBACK falhou (conexão perdida) — propaga erro original.
          }
        }
        throw error;
      } finally {
        if (ownClient) {
          client.release();
        }
      }
    } else {
      // ============================================================
      // CAMINHO LEGADO — settlement_flow='none' (ou outro): COMPLETED
      // ============================================================
      // Comportamento original preservado. Nenhum campo F1 carimbado,
      // nenhum outbox F1 emitido.
      completedOrder = await serviceOrderRepository.completeOrder(
        tenantId,
        orderId,
        input.workerNotes || null
      );
    }

    // 3. 🔴 CORREÇÃO FASE 1B: Removida atualização de calendar event (agenda paralela não existe mais)
    // Status da ordem é gerenciado apenas em service_orders, não em agenda paralela

    // 4. Registrar auditoria (sistema antigo)
    await this.recordAudit(tenantId, {
      eventType:
        completedOrder.status === 'seller_pending'
          ? 'SERVICE_ORDER_PENDING_BUYER_CONFIRMATION'
          : 'SERVICE_ORDER_COMPLETED',
      orderId: completedOrder.id,
      status: completedOrder.status,
      completedByActorId: input.completedByActorId,
      completedByUserId: input.completedByUserId,
    });

    // 5. Registrar log de auditoria de negócio (não bloqueante)
    try {
      const { recordBusinessAuditSafely } = await import('../business-audit/business-audit.helpers');
      await recordBusinessAuditSafely(tenantId, {
        action: 'service_order_completed',
        actorId: input.completedByActorId,
        userId: input.completedByUserId || null,
        contextType: 'service_order',
        contextId: completedOrder.id,
        metadata: {
          previousStatus: order.status,
          newStatus: completedOrder.status,
        },
      });
    } catch (auditError) {
      console.error('Erro ao registrar log de auditoria para service order completada:', auditError);
    }

    return completedOrder;
  }

  /**
   * D2 (Camada 1 saída — 2026-05-26) — Método interno UNIFICADO de
   * APROVAÇÃO seller_pending → release_approved. Single source of truth
   * para os 2 callers (buyer confirma + timeout) — evita duplicação.
   *
   * Semântica: ordem fica APROVADA para futura liberação financeira.
   * NÃO MOVE DINHEIRO. Estado-only. Dinheiro permanece em escrow_payments
   * até frente própria de release financeiro mover para seller_available
   * (conta do Bank) lastreado pela ledger. Ver DT-D2-WIRING-MONEY-PENDING.
   *
   * Atomicidade: UPDATE service_orders + INSERT event_outbox JUNTOS via
   * pattern existingClient (espelha F1 / db47798d).
   *
   * Idempotência tripla:
   *   1. SQL WHERE status='seller_pending' (2ª chamada não bate).
   *   2. event_id determinístico SHA-256 (ON CONFLICT DO NOTHING).
   *   3. Caller decide eligibilidade ANTES de chamar (releaseEligibleAt
   *      OR buyerConfirmedAt).
   */
  private async approveServiceOrderRelease(
    tenantId: string,
    orderId: string,
    buyerConfirmedAt: Date | null,
    existingClient?: PoolClient
  ): Promise<ServiceOrder> {
    const client = existingClient ?? (await getClientWithTenant(tenantId));
    const ownClient = !existingClient;
    try {
      if (ownClient) {
        await client.query('BEGIN');
      }

      const approved = await serviceOrderRepository.approveServiceOrderRelease(
        tenantId,
        orderId,
        buyerConfirmedAt,
        client
      );

      // Outbox atômico — event_id determinístico (idempotência via ON
      // CONFLICT DO NOTHING). Único event_id por orderId — buyer confirm
      // e timeout reusam a mesma chave (não duplicam).
      //
      // Significado do evento SERVICE_ORDER_RELEASE_APPROVED:
      //   "ordem foi APROVADA para futura liberação financeira" — NÃO
      //   "fundos liberados". Dinheiro permanece em escrow_payments.
      await insertEventOutboxRow(client, {
        tenantId,
        eventId: deterministicServiceOrderReleaseApprovedOutboxEventId(tenantId, orderId),
        eventType: 'SERVICE_ORDER_RELEASE_APPROVED',
        eventVersion: 1,
        payload: {
          orderId,
          serviceId: approved.serviceId,
          workerActorId: approved.workerActorId,
          customerActorId: approved.customerActorId,
          bookingId: approved.bookingId,
          settlementFlow: approved.settlementFlow,
          approvalTrigger: buyerConfirmedAt ? 'buyer_confirmation' : 'timeout',
          buyerConfirmedCompletionAt: approved.buyerConfirmedCompletionAt
            ? approved.buyerConfirmedCompletionAt.toISOString()
            : null,
          releaseEligibleAt: approved.releaseEligibleAt
            ? approved.releaseEligibleAt.toISOString()
            : null,
        },
        metadata: {
          buyerConfirmedAt: buyerConfirmedAt ? buyerConfirmedAt.toISOString() : null,
        },
      });

      if (ownClient) {
        await client.query('COMMIT');
      }
      return approved;
    } catch (error) {
      if (ownClient) {
        try {
          await client.query('ROLLBACK');
        } catch (_rollbackErr) {
          // ROLLBACK falhou (conexão perdida) — propaga erro original.
        }
      }
      throw error;
    } finally {
      if (ownClient) {
        client.release();
      }
    }
  }

  /**
   * D2 — Caller A: buyer confirma conclusão.
   *
   * Pré-condições verificadas neste service:
   *   1. order existe + status='seller_pending'.
   *   2. buyerActorId === order.customerActorId (autoridade fina —
   *      reforço explícito do gap herdado em DT-SERVICE-ORDER-AUTHORITY).
   *   3. Autoridade canônica via authorityService.canPerformAction
   *      service_order:confirm_completion (se buyerUserId fornecido).
   *
   * Após validações, delega para internalReleaseToSellerAvailable
   * com buyerConfirmedAt = NOW (que carimba buyer_confirmed_
   * completion_at e libera ignorando release_eligible_at).
   */
  async confirmBuyerCompletion(
    tenantId: string,
    orderId: string,
    input: { buyerActorId: string; buyerUserId?: string },
    existingClient?: PoolClient
  ): Promise<ServiceOrder> {
    // 0. Autoridade canônica (gate genérico). Mesmo padrão do completeOrder.
    if (input.buyerUserId) {
      const { authorityService } = await import('@modules/authority/authority.service');
      const auth = await authorityService.canPerformAction(
        input.buyerActorId,
        'service_order:confirm_completion',
        undefined,
        { tenantId, userId: input.buyerUserId }
      );
      if (!auth.allowed) {
        throw HttpError.forbidden(
          auth.reason || 'Você não tem permissão para confirmar conclusão de ordem de serviço'
        );
      }
    }

    // 1. Buscar order
    const order = await serviceOrderRepository.getOrderById(tenantId, orderId);
    if (!order) {
      throw new Error(`Ordem não encontrada: ${orderId}`);
    }

    // 2. Autoridade fina: buyer deve ser o customer da order (reforço
    //    explícito — o gate genérico não cruza com customerActorId).
    if (order.customerActorId !== input.buyerActorId) {
      throw HttpError.forbidden(
        'Apenas o comprador da ordem pode confirmar a conclusão'
      );
    }

    // 3. Pré-checagens declarativas (mensagens claras). O UPDATE atômico
    //    do repository tem as mesmas guardas em SQL — esta camada antecipa
    //    o erro com mensagem específica.
    if (order.status !== 'seller_pending') {
      throw new Error(
        `Ordem não está em seller_pending (status atual: ${order.status})`
      );
    }
    if (order.settlementFlow !== 'fixed_price_escrow') {
      throw new Error(
        'Confirmação de buyer só se aplica a fluxo fixed_price_escrow'
      );
    }
    if (order.disputedAt !== null) {
      throw new Error('Ordem está em disputa — release bloqueado');
    }

    return this.approveServiceOrderRelease(
      tenantId,
      orderId,
      new Date(),
      existingClient
    );
  }

  /**
   * D2 — Caller B: timeout. Varre service_orders elegíveis (status=
   * seller_pending + flow=fixed_price_escrow + disputed_at IS NULL +
   * release_eligible_at <= NOW()), APROVA cada uma para release_approved.
   *
   * NÃO MOVE DINHEIRO. Estado-only — ordem fica APROVADA para futura
   * liberação financeira. Frente financeira posterior é responsável
   * por mover dinheiro de escrow_payments.
   *
   * Chamável standalone (script CLI release-expired-service-orders.ts;
   * futuro worker periódico — DT-D2-TIMEOUT-WORKER-PENDING).
   *
   * Cada approve usa sua própria transação (modo dono em
   * approveServiceOrderRelease). Falha individual NÃO interrompe
   * o batch — registra e continua.
   */
  async approveExpiredServiceOrderReleases(
    tenantId: string,
    limit = 100
  ): Promise<{ approved: string[]; failed: Array<{ orderId: string; error: string }> }> {
    const candidates = await serviceOrderRepository.listExpiredSellerPending(tenantId, limit);
    const approved: string[] = [];
    const failed: Array<{ orderId: string; error: string }> = [];

    for (const order of candidates) {
      try {
        await this.approveServiceOrderRelease(tenantId, order.id, null);
        approved.push(order.id);
      } catch (err) {
        failed.push({
          orderId: order.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return { approved, failed };
  }

  /**
   * D-money (Camada 1 saída — 2026-05-26, decisão Clayton K_wallet_1 = Opção D)
   *
   * Move o dinheiro custodiado em escrow_payments para a actor_wallet
   * do(s) receiver(s) do split, fechando o ciclo da Camada 1:
   *
   *   release_approved (D2) → funds_released (D-money).
   *
   * Transição atômica (uma única transação) cobrindo:
   *   1. UPDATE service_orders SET status='funds_released'
   *      WHERE status='release_approved' AND settlement_flow=
   *      'fixed_price_escrow' AND disputed_at IS NULL
   *      AND booking_id IS NOT NULL.
   *   2. Resolve service_payment_request via booking_id.
   *   3. Resolve payment_intent via reference_id=payment_request_id +
   *      source='service_execution'. Valida payment_status='escrowed'.
   *   4. Valida metadata.splits fail-closed (array, splitId,
   *      receiverActorId, amountCents, soma=intent.amount_cents).
   *   5. Para cada split:
   *      - ensureActorWalletAccount(receiverActorId).
   *      - transfer(escrow_payments → actor_wallet, amountCents,
   *        referenceType='fixed_price_release_to_actor_wallet',
   *        referenceId=`${orderId}:${splitId}`).
   *        Idempotência financeira delegada (DT-RELEASE-WORKER-
   *        IDEMPOTENCY R1 / commit 39abbd5d).
   *   6. UPDATE payment_intent.payment_status='released_to_actor_wallet'.
   *   7. INSERT event_outbox SERVICE_ORDER_FUNDS_RELEASED_TO_ACTOR_WALLET
   *      (event_id determinístico SHA-256 — idempotente).
   *
   * NÃO toca: payout_requests, bank_settlements, seller_*, user_wallet,
   * release-worker antigo, escrow_accounts/payment_milestones (Plano B).
   */
  async releaseFundsToActorWalletForOrder(
    tenantId: string,
    orderId: string,
    existingClient?: PoolClient
  ): Promise<{
    orderId: string;
    paymentIntentId: string;
    paymentRequestId: string;
    totalAmountCents: number;
    splits: Array<{
      splitId: string;
      receiverActorId: string;
      amountCents: number;
      bankTransactionId: string;
      toAccountId: string;
    }>;
  }> {
    const client = existingClient ?? (await getClientWithTenant(tenantId));
    const ownClient = !existingClient;
    try {
      if (ownClient) {
        await client.query('BEGIN');
      }

      // ────────────────────────────────────────────────────────────
      // 1. UPDATE service_orders → funds_released (idempotência por estado)
      // ────────────────────────────────────────────────────────────
      const orderResult = await client.query<{
        id: string;
        booking_id: string | null;
        worker_actor_id: string;
        customer_actor_id: string;
      }>(
        `UPDATE service_orders
         SET status = 'funds_released', updated_at = NOW()
         WHERE tenant_id = $1::uuid AND id = $2::uuid
           AND status = 'release_approved'
           AND settlement_flow = 'fixed_price_escrow'
           AND disputed_at IS NULL
           AND booking_id IS NOT NULL
         RETURNING id::text, booking_id::text, worker_actor_id::text, customer_actor_id::text`,
        [tenantId, orderId]
      );
      const orderRow = orderResult.rows[0];
      if (!orderRow) {
        throw new Error(
          'releaseFundsToActorWalletForOrder: ordem não atende as condições D-money ' +
            '(status≠release_approved, flow≠fixed_price_escrow, disputed_at preenchido, ' +
            'booking_id NULL, ou já foi processada).'
        );
      }
      const bookingId = orderRow.booking_id!;

      // ────────────────────────────────────────────────────────────
      // 2. Resolve service_payment_request via booking_id
      // ────────────────────────────────────────────────────────────
      const requestResult = await client.query<{ payment_request_id: string; amount_cents: string }>(
        `SELECT payment_request_id::text, amount_cents::text
           FROM service_payment_requests
          WHERE tenant_id = $1::uuid AND booking_id = $2::uuid LIMIT 1`,
        [tenantId, bookingId]
      );
      const requestRow = requestResult.rows[0];
      if (!requestRow) {
        throw new Error(
          `releaseFundsToActorWalletForOrder: service_payment_request não encontrada para booking ${bookingId}`
        );
      }
      const paymentRequestId = requestRow.payment_request_id;

      // ────────────────────────────────────────────────────────────
      // 3. Resolve payment_intent — source='service_execution' +
      //    reference_id=paymentRequestId + payment_status='escrowed'
      // ────────────────────────────────────────────────────────────
      const intentResult = await client.query<{
        id: string;
        amount_cents: string;
        currency: string;
        payment_status: string;
        source: string | null;
        metadata: any;
      }>(
        `SELECT id::text, amount_cents::text, currency, payment_status, source, metadata
           FROM payment_intents
          WHERE tenant_id = $1::uuid AND reference_id = $2 LIMIT 1`,
        [tenantId, paymentRequestId]
      );
      const intentRow = intentResult.rows[0];
      if (!intentRow) {
        throw new Error(
          `releaseFundsToActorWalletForOrder: payment_intent não encontrado para reference ${paymentRequestId}`
        );
      }
      if (intentRow.source !== 'service_execution') {
        throw new Error(
          `releaseFundsToActorWalletForOrder: payment_intent.source='${intentRow.source}' ≠ 'service_execution'`
        );
      }
      if (intentRow.payment_status !== 'escrowed') {
        throw new Error(
          `releaseFundsToActorWalletForOrder: payment_intent.payment_status='${intentRow.payment_status}' ≠ 'escrowed' (já liberado?)`
        );
      }
      const intentId = intentRow.id;
      const totalAmountCents = parseInt(intentRow.amount_cents, 10);
      const currency = intentRow.currency as 'BRL';

      // ────────────────────────────────────────────────────────────
      // 4. Valida metadata.splits FAIL-CLOSED
      // ────────────────────────────────────────────────────────────
      const meta =
        typeof intentRow.metadata === 'string'
          ? JSON.parse(intentRow.metadata)
          : intentRow.metadata;
      const splitsRaw = meta?.splits;
      if (!Array.isArray(splitsRaw) || splitsRaw.length === 0) {
        throw new Error(
          'releaseFundsToActorWalletForOrder: metadata.splits ausente, vazio ou não-array'
        );
      }
      type ValidSplit = { splitId: string; receiverActorId: string; amountCents: number };
      const splits: ValidSplit[] = [];
      let sumSplits = 0;
      for (const s of splitsRaw) {
        if (
          !s ||
          typeof s.splitId !== 'string' ||
          typeof s.receiverActorId !== 'string' ||
          typeof s.amountCents !== 'number' ||
          !Number.isFinite(s.amountCents) ||
          !Number.isInteger(s.amountCents) ||
          s.amountCents <= 0
        ) {
          throw new Error(
            `releaseFundsToActorWalletForOrder: split inválido em metadata.splits: ${JSON.stringify(s)}`
          );
        }
        splits.push({
          splitId: s.splitId,
          receiverActorId: s.receiverActorId,
          amountCents: s.amountCents,
        });
        sumSplits += s.amountCents;
      }
      // PE-3 (DECISION-0048): metadata.splits agora carrega APENAS revenue_share
      // (splits que devem ser repassados ao actor_wallet). Demais splits (fee,
      // regional_fund, reserve, etc.) já caíram nos destinos finais na hora da
      // execução e NÃO entram em metadata.splits.
      //
      // Logo: soma(metadata.splits) <= payment_intent.amount_cents (NUNCA igual
      // num fluxo PE-3 com fee>0). Validação anti-vazamento: bloquear se a
      // soma EXCEDER o valor bruto — actor_wallet jamais pode receber mais que
      // o pago. Compat preservado para legacy onde sum == amount.
      if (sumSplits > totalAmountCents) {
        throw new Error(
          `releaseFundsToActorWalletForOrder: soma dos splits (${sumSplits}) > payment_intent.amount_cents (${totalAmountCents}) — vazamento bloqueado`
        );
      }

      // ────────────────────────────────────────────────────────────
      // 5. Resolve conta escrow_payments (source)
      // ────────────────────────────────────────────────────────────
      await bankAccountService.ensurePlatformAccounts(tenantId, currency);
      const escrowAccount = await bankAccountService.getPlatformLifecycleAccount(
        tenantId,
        'escrow_payments',
        currency
      );
      if (!escrowAccount) {
        throw new Error(
          'releaseFundsToActorWalletForOrder: conta escrow_payments do tenant não encontrada'
        );
      }

      // ────────────────────────────────────────────────────────────
      // 6. Para cada split: ensure actor_wallet + transfer atômico
      // ────────────────────────────────────────────────────────────
      const splitResults: Array<{
        splitId: string;
        receiverActorId: string;
        amountCents: number;
        bankTransactionId: string;
        toAccountId: string;
      }> = [];

      for (const split of splits) {
        // 6.a — garante actor_wallet do receiver (idempotente).
        const wallet = await bankAccountService.ensureActorWalletAccount(
          tenantId,
          split.receiverActorId,
          currency
        );

        // 6.b — transfer escrow_payments → actor_wallet.
        // referenceType='fixed_price_release_to_actor_wallet' (semântica
        // distinta de 'seller_release' do release-worker antigo).
        // referenceId='${orderId}:${splitId}' — estável + único por split
        // (idempotência financeira pela camada de transfer).
        const referenceId = `${orderId}:${split.splitId}`;
        const transferResult = await bankTransactionService.transfer(
          tenantId,
          {
            eventId: deterministicReleaseTransferEventId(tenantId, orderId, split.splitId),
            fromAccountId: escrowAccount.accountId,
            toAccountId: wallet.accountId,
            amountCents: split.amountCents,
            currency,
            transactionType: 'transfer',
            description: `D-money: fixed-price release to actor_wallet (order ${orderId}, split ${split.splitId})`,
            referenceType: 'fixed_price_release_to_actor_wallet',
            referenceId,
            treasurySource: 'treasury:settlement',
            concept_id: 'seller-funds-release',
            authorship: {
              performedByUserId: null,
              performedByActorId: null,
              actingForActorId: split.receiverActorId,
              actingForAccountId: wallet.accountId,
              authoritySource: 'system',
              permissionSnapshot: {
                permissionKey: 'system',
                allowed: true,
                actorId: split.receiverActorId,
                decidedAt: new Date().toISOString(),
              },
            } as any,
          },
          client
        );

        splitResults.push({
          splitId: split.splitId,
          receiverActorId: split.receiverActorId,
          amountCents: split.amountCents,
          bankTransactionId: transferResult.transactionId,
          toAccountId: wallet.accountId,
        });

        // 6.c — C3.1 income withholding (DECISION-0055 D3): drena obligations ativas
        // do receiver dentro da mesma transação SQL, limitando ao crédito recém-entrado.
        await drainRecoveryObligationsForCredit(
          tenantId,
          split.receiverActorId,
          split.amountCents,
          client
        );
      }

      // ────────────────────────────────────────────────────────────
      // 7. UPDATE payment_intent.payment_status='released_to_actor_wallet'
      // ────────────────────────────────────────────────────────────
      await client.query(
        `UPDATE payment_intents
         SET payment_status = 'released_to_actor_wallet', updated_at = NOW()
         WHERE tenant_id = $1::uuid AND id = $2::uuid AND payment_status = 'escrowed'`,
        [tenantId, intentId]
      );

      // ────────────────────────────────────────────────────────────
      // 8. INSERT event_outbox — emit DEPOIS do ledger
      // ────────────────────────────────────────────────────────────
      await insertEventOutboxRow(client, {
        tenantId,
        eventId: deterministicReleaseFundsOutboxEventId(tenantId, orderId),
        eventType: 'SERVICE_ORDER_FUNDS_RELEASED_TO_ACTOR_WALLET',
        eventVersion: 1,
        payload: {
          serviceOrderId: orderId,
          bookingId,
          paymentRequestId,
          paymentIntentId: intentId,
          totalAmountCents,
          destinationAccountType: 'actor_wallet',
          splits: splitResults,
          releasedAt: new Date().toISOString(),
        },
        metadata: {},
      });

      if (ownClient) {
        await client.query('COMMIT');
      }

      return {
        orderId,
        paymentIntentId: intentId,
        paymentRequestId,
        totalAmountCents,
        splits: splitResults,
      };
    } catch (error) {
      if (ownClient) {
        try {
          await client.query('ROLLBACK');
        } catch (_rollbackErr) {
          // ROLLBACK falhou — propaga erro original.
        }
      }
      throw error;
    } finally {
      if (ownClient) {
        client.release();
      }
    }
  }

  /**
   * Cancela ordem de serviço
   */
  async cancelOrder(
    tenantId: string,
    orderId: string,
    input: CancelServiceOrderInput
  ): Promise<ServiceOrder> {
    // 0. Validar permissão via authority.service (§4.9)
    if (input.cancelledByUserId) {
      const { authorityService } = await import('@modules/authority/authority.service');
      const auth = await authorityService.canPerformAction(
        input.cancelledByActorId,
        'service_order:cancel',
        undefined,
        { tenantId, userId: input.cancelledByUserId }
      );
      if (!auth.allowed) {
        throw HttpError.forbidden(
          auth.reason || 'Você não tem permissão para cancelar ordem de serviço'
        );
      }
    }

    // 1. Buscar ordem
    const order = await serviceOrderRepository.getOrderById(tenantId, orderId);
    if (!order) {
      throw new Error(`Ordem não encontrada: ${orderId}`);
    }

    if (!['draft', 'confirmed', 'in_progress'].includes(order.status)) {
      throw new Error(`Ordem não pode ser cancelada (status: ${order.status})`);
    }

    // 2. Cancelar ordem
    const cancelledOrder = await serviceOrderRepository.cancelOrder(
      tenantId,
      orderId,
      input.cancellationReason || null
    );

    // 3. 🔴 CORREÇÃO FASE 1B: Removido cancelamento de calendar event (agenda paralela não existe mais)
    // Status da ordem é gerenciado apenas em service_orders, não em agenda paralela

    // 4. Registrar auditoria (sistema antigo)
    await this.recordAudit(tenantId, {
      eventType: 'SERVICE_ORDER_CANCELLED',
      orderId: cancelledOrder.id,
      status: cancelledOrder.status,
      cancelledByActorId: input.cancelledByActorId,
      cancelledByUserId: input.cancelledByUserId,
      cancellationReason: input.cancellationReason,
    });

    // 5. Registrar log de auditoria de negócio (não bloqueante)
    try {
      const { recordBusinessAuditSafely } = await import('../business-audit/business-audit.helpers');
      await recordBusinessAuditSafely(tenantId, {
        action: 'service_order_cancelled',
        actorId: input.cancelledByActorId,
        userId: input.cancelledByUserId || null,
        contextType: 'service_order',
        contextId: cancelledOrder.id,
        metadata: {
          previousStatus: order.status,
          newStatus: cancelledOrder.status,
          cancellationReason: input.cancellationReason || null,
        },
      });
    } catch (auditError) {
      console.error('Erro ao registrar log de auditoria para service order cancelada:', auditError);
    }

    return cancelledOrder;
  }

  /**
   * Lista ordens com filtros
   */
  async listOrders(tenantId: string, filters: ServiceOrderFilters = {}): Promise<ServiceOrder[]> {
    return await serviceOrderRepository.listOrders(tenantId, filters);
  }

  /**
   * Busca ordem por ID
   */
  async getOrderById(tenantId: string, orderId: string): Promise<ServiceOrder | null> {
    return await serviceOrderRepository.getOrderById(tenantId, orderId);
  }

  // ============================================================
  // MÉTODOS PRIVADOS
  // ============================================================

  /**
   * Registra evento de auditoria
   */
  private async recordAudit(
    tenantId: string,
    data: {
      eventType: string;
      orderId: string;
      status: string;
      createdByActorId?: string;
      createdByUserId?: string | null;
      confirmedByActorId?: string;
      confirmedByUserId?: string | null;
      startedByActorId?: string;
      startedByUserId?: string | null;
      completedByActorId?: string;
      completedByUserId?: string | null;
      cancelledByActorId?: string;
      cancelledByUserId?: string | null;
      cancellationReason?: string | null;
      bookingId?: string;
      decisionId?: string;
      grossAmountCents?: number;
      platformFee?: number;
      providerNetAmount?: number;
    }
  ): Promise<void> {
    try {
      const { auditService } = await import('@core/audit/audit.service');
      await auditService.record(tenantId, {
        event_type: data.eventType,
        severity: 'medium',
        actor_id: data.createdByActorId || data.confirmedByActorId || data.startedByActorId || data.completedByActorId || data.cancelledByActorId || undefined,
        actor_type: 'user',
        source: 'automation',
        context: {
          order_id: data.orderId,
          status: data.status,
          created_by_user_id: data.createdByUserId ?? undefined,
          confirmed_by_actor_id: data.confirmedByActorId,
          confirmed_by_user_id: data.confirmedByUserId ?? undefined,
          started_by_actor_id: data.startedByActorId,
          started_by_user_id: data.startedByUserId ?? undefined,
          completed_by_actor_id: data.completedByActorId,
          completed_by_user_id: data.completedByUserId ?? undefined,
          cancelled_by_actor_id: data.cancelledByActorId,
          cancelled_by_user_id: data.cancelledByUserId ?? undefined,
          cancellation_reason: data.cancellationReason ?? undefined,
          ...(data.bookingId != null && { booking_id: data.bookingId }),
          ...(data.decisionId != null && { decision_id: data.decisionId }),
          ...(data.grossAmountCents != null && { gross_amount_cents: data.grossAmountCents }),
          ...(data.platformFee != null && { platform_fee: data.platformFee }),
          ...(data.providerNetAmount != null && { provider_net_amount: data.providerNetAmount }),
        },
      });
    } catch (error) {
      // Não bloquear se auditoria falhar
      console.warn('[ServiceOrder] Erro ao registrar auditoria:', error);
    }
  }

  /**
   * Confirma booking aceito criando Service Order
   * 
   * REGRAS:
   * - NÃO cria pagamento
   * - NÃO cria comissão
   * - NÃO cria split
   * - Bloqueia agenda explicitamente
   * - Status inicial: CONFIRMED
   */
  async confirmBookingFromDecision(
    tenantId: string,
    bookingId: string,
    decisionId: string,
    confirmedByActorId: string,
    confirmedByUserId?: string
  ): Promise<ServiceOrder> {
    // 0. Validar permissão via authority.service (§4.9)
    // Este método cria e confirma uma service order, então usa service_order:confirm
    if (confirmedByUserId) {
      const { authorityService } = await import('@modules/authority/authority.service');
      const auth = await authorityService.canPerformAction(
        confirmedByActorId,
        'service_order:confirm',
        undefined,
        { tenantId, userId: confirmedByUserId }
      );
      if (!auth.allowed) {
        throw HttpError.forbidden(
          auth.reason || 'Você não tem permissão para confirmar ordem de serviço'
        );
      }
    }

    // 1. Buscar booking via Unified Availability
    const { unifiedAvailabilityService } = await import('@core/availability/unified-availability.service');
    const booking = await unifiedAvailabilityService.getBooking(tenantId, bookingId);
    if (!booking) {
      throw new Error(`Booking não encontrado: ${bookingId}`);
    }

    // 2. Buscar decisão
    const decision = await serviceBookingDecisionRepository.findById(tenantId, decisionId);
    if (!decision) {
      throw new Error(`Decisão não encontrada: ${decisionId}`);
    }

    // 3. Validar que decisão é ACCEPTED
    if (decision.status !== BookingDecisionStatus.ACCEPTED) {
      throw new Error(`Decisão não está aceita (status: ${decision.status})`);
    }

    // 4. Validar que decisão pertence ao booking
    if (decision.bookingId !== bookingId) {
      throw new Error('Decisão não pertence ao booking informado');
    }

    // 5. Buscar availability para pegar datas via Unified Availability
    const availability = await unifiedAvailabilityService.getAvailability(tenantId, booking.availabilityId);
    if (!availability) {
      throw new Error(`Disponibilidade não encontrada: ${booking.availabilityId}`);
    }

    // 🔴 CONFUSED-DEPUTY FIX (F-BOOKING-ORDER-BINDING-CANONICAL): o provider (worker) da order
    // deriva do DONO SOBERANO da availability (SSOT temporal), não de booking.metadata.serviceId
    // (hint cliente-declarado — DECISION-0113). Resolução server-side via primitivo canônico.
    const { resolveAvailabilityOwner, assertAuthorityActorActive } = await import('@core/availability/availability-owner-authority');
    const { authorizationService } = await import('@core/authorization/authorization.service');
    const owner = await resolveAvailabilityOwner(tenantId, availability.ownerType, availability.ownerId);

    // Autoria == authority actor (DECISION-0118 D2) + representabilidade server-side (fail-closed).
    if (confirmedByActorId !== owner.authorityActorId) {
      throw HttpError.forbidden('Apenas o dono da disponibilidade pode confirmar este booking');
    }
    if (confirmedByUserId) {
      let canRepOwner = false;
      try {
        canRepOwner = await authorizationService.canRepresentActor(tenantId, confirmedByUserId, owner.authorityActorId);
      } catch {
        canRepOwner = false;
      }
      if (!canRepOwner) {
        throw HttpError.forbidden('Sem autoridade para representar o dono da disponibilidade');
      }
    }
    // 🔴 F-SERVICE-BOOKING-DECISION-QUARANTINE-GATE (§4.8.4): a confirmação operacional (decisão→service_order) é a
    // "sala atrás da porta". Se o dono soberano (authority actor resolvido, NUNCA metadata.serviceId cru) está em
    // quarentena, NÃO nasce service_order. Gate ANTES da criação da order. canRepresentActor segue puro.
    await assertAuthorityActorActive(tenantId, owner.authorityActorId);

    // 🔴 F-SERVICE-OFFERING-CANONICAL-BINDING (DECISION-0122): quando o recurso temporal é uma OFERTA
    // (owner_type='service_offering'), ela é o recurso comercial/agendável CANÔNICO da order — gravada
    // a partir do SSOT (availability.ownerId), NUNCA do cliente/metadata. service_id segue legado/
    // projeção (NOT NULL), validado contra o MESMO provider soberano.
    let serviceOfferingId: string | null = null;
    if (availability.ownerType === 'service_offering') {
      serviceOfferingId = availability.ownerId;
      // Anti-divergência: se a oferta carrega service_id próprio, metadata.serviceId não pode contradizê-lo.
      const { pool } = await import('@core/database/pool');
      const offeringRow = (await pool.query<{ service_id: string | null }>(
        `SELECT service_id::text AS service_id FROM service_offerings WHERE id = $1::uuid AND tenant_id = $2::uuid LIMIT 1`,
        [serviceOfferingId, tenantId]
      )).rows[0];
      if (offeringRow?.service_id && booking.metadata?.serviceId && offeringRow.service_id !== booking.metadata.serviceId) {
        throw HttpError.conflict('serviceId do metadata diverge do service da oferta canônica');
      }
    }

    const bookingServiceId = booking.metadata?.serviceId;
    if (!bookingServiceId) {
      throw new Error('Booking deve ter metadata.serviceId para criar service order');
    }

    // 6. Service do metadata é HINT — só aceite se pertencer ao dono soberano da availability.
    const service = await servicesRepository.findById(tenantId, bookingServiceId);
    if (!service) {
      throw new Error(`Serviço não encontrado: ${bookingServiceId}`);
    }
    if (service.actorId !== owner.authorityActorId) {
      throw HttpError.conflict('Serviço declarado não pertence ao dono da disponibilidade reservada');
    }

    // 7. Verificar se já existe service order para este booking
    const existingOrders = await serviceOrderRepository.listOrders(tenantId, {
      bookingId: bookingId,
      limit: 1,
    });
    if (existingOrders.length > 0) {
      throw new Error('Já existe uma Service Order para este booking');
    }

    // 8. Calcular scheduled_end se não fornecido
    const scheduledStart = availability.startDatetime;
    const scheduledEnd = availability.endDatetime || (() => {
      // Se não tem end, calcular baseado em duração estimada ou padrão de 1 hora
      const defaultDurationMinutes = 60;
      return new Date(scheduledStart.getTime() + defaultDurationMinutes * 60 * 1000);
    })();

    // 9. 🔴 CORREÇÃO FASE 1B: Verificar conflitos (apenas alerta, não bloqueia)
    try {
      const conflictResult = await unifiedAvailabilityService.detectConflicts(
        tenantId,
        booking.availabilityId,
        service.actorId
      );
      
      if (conflictResult.hasConflicts) {
        // Apenas logar alerta, não bloquear
        console.warn(`[ServiceOrder] Conflitos detectados ao confirmar booking ${bookingId}:`, conflictResult.conflicts);
      }
    } catch (conflictError) {
      // Não bloquear se detecção de conflito falhar
      console.warn(`[ServiceOrder] Erro ao detectar conflitos para booking ${bookingId}:`, conflictError);
    }

    // 9.5. 🔴 BLINDAGEM: Validar acordo finalizado antes de confirmar booking
    // Se houver thread de negociação ou contexto de evento, exige acordo FINALIZED
    if (booking.metadata?.eventId || booking.metadata?.threadId) {
      try {
        const { agreementService } = await import('../agreements/agreement.service');
        const contextType = booking.metadata.eventId ? 'event' : 'booking';
        const contextId = booking.metadata.eventId || booking.bookingId;
        const expectedPriceCents = service.priceCents || 0;

        const validation = await agreementService.validateAgreementForClosure(
          tenantId,
          contextType,
          contextId,
          expectedPriceCents
        );

        if (!validation.valid) {
          // Se houver thread mas não houver acordo, bloquear
          if (booking.metadata?.threadId && !validation.agreement) {
            throw new Error(
              'Existe negociação em andamento. É necessário finalizar o acordo antes de confirmar o booking.'
            );
          }
          // Se houver acordo mas valor divergir, bloquear
          if (validation.agreement && validation.error) {
            throw new Error(validation.error);
          }
        }
      } catch (agreementError: any) {
        // Se for erro de acordo, lançar
        if (agreementError.message?.includes('acordo') || agreementError.message?.includes('negociação')) {
          throw agreementError;
        }
        // Outros erros são ignorados (não bloqueiam confirmação se não houver thread/evento)
        console.warn('[ServiceOrder] Erro ao validar acordo (não bloqueante):', agreementError);
      }
    }

    // 10. Criar Service Order com status CONFIRMED
    const order = await serviceOrderRepository.createOrder(tenantId, {
      serviceId: bookingServiceId,
      workerActorId: owner.authorityActorId, // provider SOBERANO (dono da availability), não metadata
      customerActorId: booking.requesterActorId,
      bookingId: booking.bookingId,
      decisionId: decision.decisionId,
      serviceOfferingId, // recurso comercial canônico (do SSOT availability) quando offering-owned

      scheduledStart,
      scheduledEnd,
      estimatedDurationMinutes: availability.endDatetime 
        ? Math.round((availability.endDatetime.getTime() - availability.startDatetime.getTime()) / (1000 * 60))
        : null,
      locationAddress: null, // Pode ser extraído do metadata se necessário
      locationLatitude: null,
      locationLongitude: null,
      description: `Serviço confirmado via booking ${booking.bookingId.substring(0, 8)}`,
      customerNotes: booking.notes || null,
      createdByActorId: confirmedByActorId,
      createdByUserId: confirmedByUserId || null,
      metadata: {
        origin: 'booking_confirmation',
        bookingId: booking.bookingId,
        decisionId: decision.decisionId,
        eventId: booking.metadata?.eventId || null,
        serviceId: bookingServiceId,
        providerActorId: owner.authorityActorId,
        requesterActorId: booking.requesterActorId,
      },
    });

    // 11. Confirmar ordem imediatamente (já que veio de decisão aceita)
    const confirmedOrder = await serviceOrderRepository.confirmOrder(
      tenantId,
      order.id,
      confirmedByActorId
    );

    // 11.5. 🔴 BLINDAGEM: Criar escrow account se houver agreement FINALIZED
    if (booking.metadata?.eventId) {
      try {
        const { agreementRepository } = await import('../agreements/agreement.repository');
        const agreements = await agreementRepository.findByContext(
          tenantId,
          'event',
          booking.metadata.eventId
        );
        const finalizedAgreement = agreements.find((a) => a.status === 'finalized');

        if (finalizedAgreement) {
          // Verificar se já existe escrow
          const { escrowRepository } = await import('../escrow/escrow.repository');
          let escrow = await escrowRepository.findByAgreement(tenantId, finalizedAgreement.agreementId);

          if (!escrow) {
            // Buscar evidence pack
            const { evidenceService } = await import('../evidence/evidence.service');
            const evidencePack = await evidenceService.getPackByContext(
              tenantId,
              'agreement',
              finalizedAgreement.agreementId
            );

            // Criar escrow com milestones padrão via repository
            escrow = await escrowRepository.createEscrowAccount(
              tenantId,
              {
                agreementId: finalizedAgreement.agreementId,
                serviceOrderId: confirmedOrder.id,
                milestones: [
                  { milestone: 'confirmed', percentage: 30 },
                  { milestone: 'started', percentage: 20 },
                  { milestone: 'completed', percentage: 50 },
                ],
              },
              evidencePack?.packId ?? null
            );
            for (const m of [
              { milestone: 'confirmed' as const, percentage: 30 },
              { milestone: 'started' as const, percentage: 20 },
              { milestone: 'completed' as const, percentage: 50 },
            ]) {
              await escrowRepository.createMilestone(
                tenantId,
                escrow.escrowId,
                m.milestone,
                0,
                m.percentage
              );
            }
          } else if (!escrow.serviceOrderId) {
            // Atualizar escrow com serviceOrderId
            await escrowRepository.updateServiceOrderId(tenantId, escrow.escrowId, confirmedOrder.id);
          }
        }
      } catch (escrowError) {
        // Não bloquear criação de service order se escrow falhar
        console.warn('[ServiceOrder] Erro ao criar escrow (não bloqueante):', escrowError);
      }
    }

    // 12. Criar evento de agenda automaticamente (bloquear agenda)
    // 🔴 CORREÇÃO FASE 1B: Removida criação de calendar event (agenda paralela proibida)
    // Service order não cria agenda própria, apenas referencia Unified Availability via booking

    // 12.5. 🔵 AUTO-EMIT INBOX (read-model) — F-SERVICE-ORDER-INBOX-AUTO-EMIT
    // A service_order JÁ nasceu (efeito canônico). O inbox é READ MODEL: organiza o que já aconteceu,
    // dando ao PROVIDER/worker o item de "atendimento mínimo" sem depender de seed/test-only.
    // Writer canônico = socialInboxProjector (módulo inbox), idempotente por ON CONFLICT. Money/CRM-free.
    // Não-bloqueante: falha de projeção não impede o nascimento da ordem (mesma postura do audit).
    try {
      const { socialInboxProjector } = await import('@modules/inbox/social-inbox.projector');
      await socialInboxProjector.projectServiceOrderConfirmed(tenantId, {
        serviceOrderId: confirmedOrder.id,
        providerActorId: owner.authorityActorId, // provider SOBERANO (dono da availability)
        bookingId: booking.bookingId,
        decisionId: decision.decisionId,
        serviceId: bookingServiceId,
      });
    } catch (inboxError) {
      console.warn('[ServiceOrder] Erro ao auto-emitir inbox (não bloqueante):', inboxError);
    }

    // 13. Registrar auditoria (sistema antigo)
    await this.recordAudit(tenantId, {
      eventType: 'SERVICE_ORDER_CREATED_FROM_BOOKING',
      orderId: confirmedOrder.id,
      status: confirmedOrder.status,
      createdByActorId: confirmedByActorId,
      createdByUserId: confirmedByUserId || null,
      bookingId: booking.bookingId,
      decisionId: decision.decisionId,
    });

    // 14. Registrar log de auditoria de negócio (não bloqueante)
    try {
      const { recordBusinessAuditSafely } = await import('../business-audit/business-audit.helpers');
      await recordBusinessAuditSafely(tenantId, {
        action: 'booking_confirmed',
        actorId: confirmedByActorId,
        userId: confirmedByUserId || null,
        contextType: 'service_order',
        contextId: confirmedOrder.id,
        metadata: {
          bookingId: booking.bookingId,
          decisionId: decision.decisionId,
          serviceId: bookingServiceId,
          status: confirmedOrder.status,
        },
      });
    } catch (auditError) {
      console.error('Erro ao registrar log de auditoria para booking confirmado:', auditError);
    }

    return confirmedOrder;
  }

  /**
   * Calcula termos financeiros de uma Service Order
   * 
   * REGRAS:
   * - NÃO cria split
   * - NÃO executa pagamento
   * - Apenas calcula e retorna valores para visualização
   */
  async getFinancialTerms(
    tenantId: string,
    orderId: string
  ): Promise<ServiceOrderFinancialTerms> {
    // 1. Buscar ordem
    const order = await serviceOrderRepository.getOrderById(tenantId, orderId);
    if (!order) {
      throw new Error(`Service Order não encontrada: ${orderId}`);
    }

    // 2. Buscar serviço para obter preço
    const service = await servicesRepository.findById(tenantId, order.serviceId);
    if (!service) {
      throw new Error(`Serviço não encontrado: ${order.serviceId}`);
    }

    // 3. Obter valor bruto (do serviço ou metadata)
    const grossAmountCents = service.priceCents || order.metadata?.amountCents || 0;
    if (grossAmountCents <= 0) {
      throw new Error('Valor do serviço não definido');
    }

    // 4. Calcular comissão (3% padrão para service_booking)
    const PLATFORM_FEE_BPS = 3; // 3%
    const platformFeeCents = Math.round((grossAmountCents * PLATFORM_FEE_BPS) / 100);
    const providerNetAmountCents = grossAmountCents - platformFeeCents;

    // 5. Obter conta da plataforma
    const currency: BankCurrency =
      service.currency === 'BRL' || service.currency === 'USD' || service.currency === 'EUR' || service.currency === 'TEST'
        ? service.currency
        : 'BRL';
    const platformAccount = await bankAccountService.getSystemAccount(tenantId, 'fee', currency);
    if (!platformAccount) {
      throw new Error('Conta da plataforma não encontrada');
    }

    return {
      serviceOrderId: order.id,
      grossAmountCents: grossAmountCents,
      platformFeeBps: PLATFORM_FEE_BPS,
      platformFeeCents: platformFeeCents,
      providerNetAmountCents: providerNetAmountCents,
      currency,
      providerActorId: order.workerActorId,
      platformActorId: platformAccount.accountId,
    };
  }

  /**
   * Confirma termos financeiros criando split
   * 
   * REGRAS:
   * - NÃO executa pagamento
   * - NÃO move dinheiro automaticamente
   * - Apenas cria entidade de split para rastreabilidade
   * - Confirmação humana obrigatória
   */
  async confirmFinancialTerms(
    tenantId: string,
    orderId: string,
    input: ConfirmFinancialTermsInput
  ): Promise<{ splits: any[] }> {
    // 0. Validar permissão via authority.service (§4.9)
    if (input.confirmedByUserId) {
      const { authorityService } = await import('@modules/authority/authority.service');
      const auth = await authorityService.canPerformAction(
        input.confirmedByActorId,
        'financial_terms:confirm',
        undefined,
        { tenantId, userId: input.confirmedByUserId }
      );
      if (!auth.allowed) {
        throw HttpError.forbidden(
          auth.reason || 'Você não tem permissão para confirmar termos financeiros'
        );
      }
    }

    // 1. Buscar ordem
    const order = await serviceOrderRepository.getOrderById(tenantId, orderId);
    if (!order) {
      throw new Error(`Service Order não encontrada: ${orderId}`);
    }

    if (order.status !== 'confirmed') {
      throw new Error(`Service Order deve estar confirmed (status atual: ${order.status})`);
    }

    // 2. Verificar se já existe split para esta ordem
    const existingSplits = await bankSplitRepository.getSplitsByServiceOrder(tenantId, orderId);
    if (existingSplits.length > 0) {
      throw new Error('Termos financeiros já foram confirmados para esta ordem');
    }

    // 3. Calcular termos financeiros
    const terms = await this.getFinancialTerms(tenantId, orderId);

    // 4. Obter conta do provider
    const service = await servicesRepository.findById(tenantId, order.serviceId);
    if (!service) {
      throw new Error(`Serviço não encontrado: ${order.serviceId}`);
    }

    // Obter conta do provider
    const currencyForAccount: BankCurrency =
      terms.currency === 'BRL' || terms.currency === 'USD' || terms.currency === 'EUR' || terms.currency === 'TEST'
        ? terms.currency
        : 'BRL';
    const providerAccountId = await this.resolveActorAccount(
      tenantId,
      order.workerActorId,
      currencyForAccount
    );

    // 5. Criar transação fictícia para referenciar os splits
    // NOTA: Esta transação NÃO move dinheiro, apenas serve como referência
    // O split será criado sem executar pagamento
    const transactionId = `so-${orderId}-${Date.now()}`;

    // Resolver actor para autoria (se confirmedByUserId fornecido)
    let authorship;
    if (input.confirmedByUserId && input.confirmedByActorId) {
      const { buildFinancialAuthorshipFromRequest } = await import('@modules/bank/financial-authorship.helper');
      // Snapshot da delegação (usuário confirmou termos em nome do provider)
      const permissionSnapshot = {
        permissionKey: 'delegation',
        allowed: true,
        reason: 'User confirmed financial terms for service order',
        actorId: input.confirmedByActorId,
        userId: input.confirmedByUserId,
        decidedAt: new Date().toISOString(),
      };
      authorship = buildFinancialAuthorshipFromRequest({
        performedByUserId: input.confirmedByUserId,
        actingForActorId: input.confirmedByActorId,
        actingForAccountId: providerAccountId, // Conta do provider (afetada)
        authoritySource: 'delegation', // Delegação via confirmação do usuário
        permissionSnapshot,
      });
    } else {
      // Fallback para sistema se não houver userId
      const { buildSystemAuthorship } = await import('@modules/bank/financial-authorship.helper');
      authorship = buildSystemAuthorship({
        actingForAccountId: providerAccountId,
      });
    }

    // 6. Criar splits (sem executar pagamento)
    const splits = [];

    // Split para plataforma (fee)
    const platformSplit = await bankSplitRepository.createSplit(tenantId, {
      transactionId,
      serviceOrderId: orderId,
      targetAccountId: terms.platformActorId,
      amountCents: terms.platformFeeCents,
      percentage: terms.platformFeeBps,
      splitType: 'fee',
      description: `Comissão da plataforma - Service Order #${orderId.substring(0, 8)}`,
      metadata: {
        serviceOrderId: orderId,
        origin: 'service_order_financial_terms',
        confirmedByActorId: input.confirmedByActorId,
        confirmedByUserId: input.confirmedByUserId,
      },
      authorship, // Passar autoria
    });
    splits.push(platformSplit);

    // Split para provider (revenue_share)
    const providerSplit = await bankSplitRepository.createSplit(tenantId, {
      transactionId,
      serviceOrderId: orderId,
      targetAccountId: providerAccountId,
      amountCents: terms.providerNetAmountCents,
      percentage: 100 - terms.platformFeeBps,
      splitType: 'revenue_share',
      description: `Valor líquido do prestador - Service Order #${orderId.substring(0, 8)}`,
      metadata: {
        serviceOrderId: orderId,
        origin: 'service_order_financial_terms',
        providerActorId: order.workerActorId,
        confirmedByActorId: input.confirmedByActorId,
        confirmedByUserId: input.confirmedByUserId,
      },
      authorship, // Passar autoria
    });
    splits.push(providerSplit);

    // 7. Registrar auditoria (sistema antigo)
    await this.recordAudit(tenantId, {
      eventType: 'SERVICE_ORDER_FINANCIAL_TERMS_CONFIRMED',
      orderId: order.id,
      status: order.status,
      createdByActorId: input.confirmedByActorId,
      createdByUserId: input.confirmedByUserId,
      grossAmountCents: terms.grossAmountCents,
      platformFee: terms.platformFeeCents,
      providerNetAmount: terms.providerNetAmountCents,
    });

    // 8. Registrar log de auditoria de negócio (não bloqueante)
    try {
      const { recordBusinessAuditSafely } = await import('../business-audit/business-audit.helpers');
      await recordBusinessAuditSafely(tenantId, {
        action: 'financial_terms_confirmed',
        actorId: input.confirmedByActorId,
        userId: input.confirmedByUserId || null,
        contextType: 'service_order',
        contextId: order.id,
        metadata: {
          grossAmount: terms.grossAmountCents,
          platformFeeBps: terms.platformFeeBps,
          platformFeeAmount: terms.platformFeeCents,
          providerNetAmount: terms.providerNetAmountCents,
          currency: terms.currency,
        },
      });
    } catch (auditError) {
      console.error('Erro ao registrar log de auditoria para termos financeiros:', auditError);
    }

    return { splits };
  }

  /**
   * Resolve conta bancária de um actor
   */
  private async resolveActorAccount(
    tenantId: string,
    actorId: string,
    currency: BankCurrency
  ): Promise<string> {
    const client = await getClientWithTenant(tenantId);

    try {
      // Buscar actor para determinar tipo
      const actorResult = await client.query<{
        actor_type: string;
        user_id: string | null;
        company_id: string | null;
      }>(
        `
        SELECT actor_type, user_id, company_id
        FROM actors
        WHERE tenant_id = $1 AND actor_id = $2
        LIMIT 1
        `,
        [tenantId, actorId]
      );

      if (actorResult.rows.length === 0) {
        throw new Error(`Actor não encontrado: ${actorId}`);
      }

      const actor = actorResult.rows[0];

      // Resolver conta baseado no tipo
      if (actor.actor_type === 'user' && actor.user_id) {
        const account = await bankAccountService.getOrCreateAccount(tenantId, {
          ownerId: actor.user_id,
          ownerType: 'user',
          currency,
        });
        return account.accountId;
      } else if (actor.actor_type === 'page' && actor.company_id) {
        const account = await bankAccountService.getOrCreateAccount(tenantId, {
          ownerId: actor.company_id,
          ownerType: 'company',
          currency,
        });
        return account.accountId;
      } else {
        throw new Error(`Tipo de actor não suportado: ${actor.actor_type}`);
      }
    } finally {
      client.release();
    }
  }
}

export const serviceOrderService = new ServiceOrderService();


