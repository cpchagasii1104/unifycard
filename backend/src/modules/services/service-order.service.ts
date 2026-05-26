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

    const bookingServiceId = booking.metadata?.serviceId;
    if (!bookingServiceId) {
      throw new Error('Booking deve ter metadata.serviceId para criar service order');
    }

    // 6. Buscar service para pegar providerActorId (actorId do service)
    const service = await servicesRepository.findById(tenantId, bookingServiceId);
    if (!service) {
      throw new Error(`Serviço não encontrado: ${bookingServiceId}`);
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
      workerActorId: service.actorId, // providerActorId
      customerActorId: booking.requesterActorId,
      bookingId: booking.bookingId,
      decisionId: decision.decisionId,
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
        providerActorId: service.actorId,
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


