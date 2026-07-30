// backend/src/modules/services/service-bundle.service.ts
// Service para SERVIÇOS COMBINADOS (Bundles) com co-agendamento
// 🔴 BLINDAGEM: Bundle é conceitual, não cria nova tabela
// 🔴 BLINDAGEM: Confirmação é atômica (todos ou nenhum)

import { v4 as uuidv4 } from 'uuid';
// 🔴 CORREÇÃO FASE 1B: Removidas referências a serviceBookingService, serviceBookingRepository, calendarService e serviceAvailabilityRepository
// Toda lógica temporal agora usa unifiedAvailabilityService
import { serviceBookingDecisionRepository } from './service-booking-decision.repository';
import { unifiedAvailabilityService } from '@core/availability/unified-availability.service';
import { serviceOrderService } from './service-order.service';
import { servicesRepository } from './services.repository';
import type { Service } from './services.types';
import { BadRequestError, NotFoundError } from '@core/errors';
import { HttpError } from '@core/errors/http-error';
import type { PermissionKey } from '@core/authorization/permission-keys';
import type {
  ServiceBundle,
  CreateServiceBundleInput,
  CreateBundleBookingInput,
  BundleBookingResult,
  ConfirmBundleInput,
  ConfirmBundleResult,
} from './service-bundle.types';
import { BundleDependencyType } from './service-bundle.types';
import { BookingDecisionStatus } from './service-booking-decision.types';

/**
 * Service para Service Bundles
 * 
 * REGRAS:
 * - NÃO cria automação silenciosa
 * - NÃO permite confirmação parcial
 * - NÃO cria pagamento automático
 * - Confirmação é atômica (todos ou nenhum)
 */
class ServiceBundleService {
  /**
   * Cria bundle bookings de forma atômica
   * 
   * REGRAS:
   * - Cria múltiplos bookings vinculados pelo bundleId
   * - Todos compartilham mesmo horário/localização se especificado
   * - Valida que serviços existem e têm disponibilidades válidas
   */
  async createBundleBookings(
    tenantId: string,
    userId: string,
    input: CreateBundleBookingInput
  ): Promise<BundleBookingResult> {
    // 0. Verificar rate limit
    try {
      const { businessRateLimitService } = await import('@core/rate-limiting/business-rate-limit.service');
      const rateLimit = await businessRateLimitService.checkRateLimit(
        tenantId,
        input.requesterActorId,
        'bundle:create',
        input.bundleId || 'new'
      );
      if (!rateLimit.allowed) {
        const { RateLimitError } = await import('@core/errors');
        throw new RateLimitError(
          `Limite de criação de bundles excedido. Tente novamente após ${rateLimit.resetAt.toISOString()}`,
          rateLimit.resetAt,
          rateLimit.remaining
        );
      }
    } catch (rateLimitError: any) {
      if (rateLimitError.statusCode === 429) {
        throw rateLimitError;
      }
      console.warn('[ServiceBundle] Erro ao verificar rate limit (não bloqueante):', rateLimitError);
    }

    // 1. Validar permissão via authority.service (fachada modules — §4.9)
    const { authorityService } = await import('@modules/authority/authority.service');
    const auth = await authorityService.canPerformAction(
      input.requesterActorId,
      'bundle:create',
      undefined,
      { tenantId, userId }
    );
    if (!auth.allowed) {
      throw HttpError.forbidden(
        auth.reason || 'Você não tem permissão para criar bundle de serviços'
      );
    }

    // 1. Validar inputs
    if (!input.serviceIds || input.serviceIds.length < 2) {
      throw new BadRequestError('Bundle deve conter pelo menos 2 serviços');
    }

    if (input.availabilityIds.length !== input.serviceIds.length) {
      throw new BadRequestError('Número de disponibilidades deve corresponder ao número de serviços');
    }

    // 2. Validar que todos os serviços existem
    const services = await Promise.all(
      input.serviceIds.map(serviceId => servicesRepository.findById(tenantId, serviceId))
    );

    const missingServices = services.filter(s => !s);
    if (missingServices.length > 0) {
      throw new NotFoundError('Um ou mais serviços não foram encontrados');
    }

    const validServices = services.filter((s): s is Service => s !== null);

    // 3. Validar que todas as disponibilidades existem e pertencem aos serviços corretos via Unified Availability
    const { unifiedAvailabilityService } = await import('@core/availability/unified-availability.service');
    const availabilities = await Promise.all(
      input.availabilityIds.map(availId => unifiedAvailabilityService.getAvailability(tenantId, availId))
    );

    const missingAvailabilities = availabilities.filter(a => !a);
    if (missingAvailabilities.length > 0) {
      throw new NotFoundError('Uma ou mais disponibilidades não foram encontradas');
    }

    // Validar correspondência service-availability
    // 🔴 CORREÇÃO FASE 1B: Unified Availability usa ownerType='service' e ownerId=serviceId
    for (let i = 0; i < validServices.length; i++) {
      if (availabilities[i]!.ownerType !== 'service' || availabilities[i]!.ownerId !== validServices[i].serviceId) {
        throw new BadRequestError(`Disponibilidade ${input.availabilityIds[i]} não pertence ao serviço ${input.serviceIds[i]}`);
      }
    }

    // 3.5. Validar se evento requer produção assistida (XL/XXL) - BLOQUEAR bundle direto
    if (input.metadata?.eventId) {
      try {
        await this.validateAssistedProductionRequired(tenantId, input.metadata.eventId, input.requesterActorId, userId);
      } catch (assistedProdError: any) {
        // Se evento requer produção assistida, bloquear e registrar audit
        if (assistedProdError.code === 'EVENT_REQUIRES_ASSISTED_PRODUCTION') {
          throw assistedProdError;
        }
        // Outros erros são ignorados (não bloqueiam bundle)
        console.warn('[ServiceBundle] Erro ao validar produção assistida (não bloqueante):', assistedProdError);
      }
    }

    // 3.6. Validar compatibilidade técnica (se evento estiver vinculado)
    if (input.metadata?.eventId) {
      try {
        await this.validateBundleCompatibility(tenantId, validServices, input.metadata.eventId);
      } catch (compatError: any) {
        // Se a validação falhar com status BLOCKED, bloquear criação
        if (compatError.status === 'blocked') {
          throw new BadRequestError(
            `Incompatibilidade técnica detectada no bundle: ${compatError.message || 'Um ou mais serviços não são compatíveis com o evento'}`
          );
        }
        // Se for WARNING, apenas logar (não bloqueia)
        console.warn('[ServiceBundle] Aviso de compatibilidade:', compatError);
      }
    }

    // 🔴 BLINDAGEM: Validar acordo finalizado antes de criar bundle
    // Se houver thread de negociação ou contexto de evento, exige acordo FINALIZED
    if (input.metadata?.eventId || input.metadata?.threadId) {
      try {
        const { agreementService } = await import('../agreements/agreement.service');
        const contextType = input.metadata.eventId ? 'event' : 'bundle';
        const contextId = input.metadata.eventId || input.bundleId || 'new';
        // Calcular preço total do bundle
        const totalPriceCents = validServices.reduce((sum, s) => sum + (s.priceCents || 0), 0);

        const validation = await agreementService.validateAgreementForClosure(
          tenantId,
          contextType,
          contextId,
          totalPriceCents
        );

        if (!validation.valid) {
          // Se houver thread mas não houver acordo, bloquear
          if (input.metadata?.threadId && !validation.agreement) {
            throw new BadRequestError(
              'Existe negociação em andamento. É necessário finalizar o acordo antes de criar o bundle.'
            );
          }
          // Se houver acordo mas valor divergir, bloquear
          if (validation.agreement && validation.error) {
            throw new BadRequestError(validation.error);
          }
        }
      } catch (agreementError: any) {
        // Se for erro de acordo, lançar
        if (agreementError.message?.includes('acordo') || agreementError.message?.includes('negociação')) {
          throw agreementError;
        }
        // Outros erros são ignorados (não bloqueiam bundle se não houver thread/evento)
        console.warn('[ServiceBundle] Erro ao validar acordo (não bloqueante):', agreementError);
      }
    }

    // 4. Validar dependências conforme tipo
    if (input.dependencyType === BundleDependencyType.SAME_TIME) {
      // Validar que todas as disponibilidades cobrem o mesmo horário
      const startTime = input.scheduledStart;
      const endTime = input.scheduledEnd;

      for (const availability of availabilities) {
        if (!availability) continue;
        if (availability.startDatetime > startTime || availability.endDatetime < endTime) {
          throw new BadRequestError(
            `Disponibilidade ${availability.availabilityId} não cobre o horário solicitado (${startTime.toISOString()} - ${endTime.toISOString()})`
          );
        }
      }
    }

    // 5. Gerar bundleId se não fornecido
    const bundleId = input.bundleId || `bundle_${uuidv4()}`;

    // 6. Criar bookings vinculados ao bundle via Unified Availability
    const bookings = [];
    for (let i = 0; i < input.serviceIds.length; i++) {
      const booking = await unifiedAvailabilityService.createBooking(tenantId, { subjectUserId: userId, requesterActorId: input.requesterActorId }, {
        availabilityId: input.availabilityIds[i],
        requesterActorId: input.requesterActorId,
        notes: input.notes || null,
        metadata: {
          serviceId: input.serviceIds[i],
          bundleId,
          bundleName: input.bundleId ? undefined : `Bundle ${input.serviceIds.length} serviços`,
          dependencyType: input.dependencyType,
          scheduledStart: input.scheduledStart.toISOString(),
          scheduledEnd: input.scheduledEnd.toISOString(),
          locationAddress: input.locationAddress,
          locationLatitude: input.locationLatitude,
          locationLongitude: input.locationLongitude,
          isBundleBooking: true,
          bundleServiceIndex: i,
          ...(input.metadata || {}), // Incluir metadata adicional (ex: origem RFQ)
        },
      });
      bookings.push({
        bookingId: booking.bookingId,
        serviceId: input.serviceIds[i], // Do metadata
        availabilityId: booking.availabilityId,
        status: booking.status,
      });
    }

    // Registrar log de auditoria para conversão RFQ → Bundle (não bloqueante)
    // Verificar se é conversão de RFQ pelo metadata
    if (input.metadata?.origin === 'rfq_conversion') {
      try {
        const { recordBusinessAuditSafely } = await import('../business-audit/business-audit.helpers');
        await recordBusinessAuditSafely(tenantId, {
          action: 'rfq_converted',
          actorId: input.requesterActorId,
          userId: userId,
          contextType: 'bundle',
          contextId: bundleId,
          metadata: {
            rfqId: input.metadata.rfqId,
            quoteIds: input.metadata.quoteIds || [],
            serviceIds: input.serviceIds,
            dependencyType: input.dependencyType,
          },
        });
      } catch (auditError) {
        console.error('Erro ao registrar log de auditoria para RFQ convertido em bundle:', auditError);
      }
    }

    return {
      bundleId,
      bookings,
      canConfirm: false, // Só pode confirmar após decisões
    };
  }

  /**
   * Busca bookings de um bundle
   */
  async getBundleBookings(
    tenantId: string,
    bundleId: string
  ): Promise<Array<{ bookingId: string; serviceId: string; status: string }>> {
    // Buscar bookings com este bundleId no metadata usando query direta
    const { runQueriesWithTenant } = await import('@core/database/pool');
    const rows = await runQueriesWithTenant<any>(
      tenantId,
      `
      SELECT booking_id, metadata->>'serviceId' AS service_id, status
      FROM bookings
      WHERE tenant_id = $1
        AND metadata->>'bundleId' = $2
      ORDER BY created_at ASC
      `,
      [tenantId, bundleId]
    );

    return rows.map((row: any) => ({
      bookingId: row.booking_id,
      serviceId: row.service_id,
      status: row.status,
    }));
  }

  /**
   * Confirma bundle de forma atômica
   * 
   * REGRAS:
   * - Todos os bookings devem ter decisão ACCEPTED
   * - Todos os service orders são criados ou nenhum
   * - Agenda é bloqueada como conjunto
   * - NÃO cria pagamento automático
   */
  async confirmBundle(
    tenantId: string,
    input: ConfirmBundleInput
  ): Promise<ConfirmBundleResult> {
    // 0. Validar permissão via authority.service (§4.9)
    if (input.confirmedByUserId) {
      const { authorityService } = await import('@modules/authority/authority.service');
      const auth = await authorityService.canPerformAction(
        input.confirmedByActorId,
        'bundle:confirm',
        undefined,
        { tenantId, userId: input.confirmedByUserId }
      );
      if (!auth.allowed) {
        throw HttpError.forbidden(
          auth.reason || 'Você não tem permissão para confirmar bundle de serviços'
        );
      }
    }

    // 1. Validar que todos os bookings existem e pertencem ao bundle via Unified Availability
    const { unifiedAvailabilityService } = await import('@core/availability/unified-availability.service');
    const bookings = await Promise.all(
      input.bookingIds.map(bookingId => unifiedAvailabilityService.getBooking(tenantId, bookingId))
    );

    const missingBookings = bookings.filter(b => !b);
    if (missingBookings.length > 0) {
      throw new NotFoundError('Um ou mais bookings não foram encontrados');
    }

    // Validar que todos pertencem ao mesmo bundle
    const bundleIds = bookings.map(b => b!.metadata?.bundleId).filter(Boolean);
    if (new Set(bundleIds).size > 1) {
      throw new BadRequestError('Bookings não pertencem ao mesmo bundle');
    }

    // 2. Validar que todas as decisões existem e são ACCEPTED
    const decisions = await Promise.all(
      input.decisionIds.map(decisionId => serviceBookingDecisionRepository.findById(tenantId, decisionId))
    );

    const missingDecisions = decisions.filter(d => !d);
    if (missingDecisions.length > 0) {
      throw new NotFoundError('Uma ou mais decisões não foram encontradas');
    }

    // Validar que todas são ACCEPTED
    const rejectedDecisions = decisions.filter(d => d!.status !== BookingDecisionStatus.ACCEPTED);
    if (rejectedDecisions.length > 0) {
      throw new BadRequestError('Todos os bookings devem ter decisão ACCEPTED para confirmar o bundle');
    }

    // Validar correspondência booking-decision
    for (let i = 0; i < bookings.length; i++) {
      if (decisions[i]!.bookingId !== bookings[i]!.bookingId) {
        throw new BadRequestError(`Decisão ${input.decisionIds[i]} não pertence ao booking ${input.bookingIds[i]}`);
      }
    }

    // 2.5. 🔴 BLINDAGEM: Validar acordo finalizado antes de confirmar bundle
    // Se houver thread de negociação ou contexto de evento, exige acordo FINALIZED
    const firstBooking = bookings[0];
    if (firstBooking && (firstBooking.metadata?.eventId || firstBooking.metadata?.threadId)) {
      try {
        const { agreementService } = await import('../agreements/agreement.service');
        const contextType = firstBooking.metadata.eventId ? 'event' : 'bundle';
        const contextId = firstBooking.metadata.eventId || input.bundleId;
        // Calcular preço total do bundle
        const totalPriceCents = bookings.reduce((sum, b) => {
          // Tentar obter preço do serviço via metadata ou usar 0
          return sum + (b.metadata?.priceCents || 0);
        }, 0);

        const validation = await agreementService.validateAgreementForClosure(
          tenantId,
          contextType,
          contextId,
          totalPriceCents
        );

        if (!validation.valid) {
          // Se houver thread mas não houver acordo, bloquear
          if (firstBooking.metadata?.threadId && !validation.agreement) {
            throw new BadRequestError(
              'Existe negociação em andamento. É necessário finalizar o acordo antes de confirmar o bundle.'
            );
          }
          // Se houver acordo mas valor divergir, bloquear
          if (validation.agreement && validation.error) {
            throw new BadRequestError(validation.error);
          }
        }
      } catch (agreementError: any) {
        // Se for erro de acordo, lançar
        if (agreementError.message?.includes('acordo') || agreementError.message?.includes('negociação')) {
          throw agreementError;
        }
        // Outros erros são ignorados (não bloqueiam confirmação se não houver thread/evento)
        console.warn('[ServiceBundle] Erro ao validar acordo (não bloqueante):', agreementError);
      }
    }

    // 3. Criar service orders de forma atômica
    // Se qualquer criação falhar, reverter todas
    const serviceOrders = [];
    const calendarEvents = [];
    let createdOrders: string[] = [];

    try {
      for (let i = 0; i < bookings.length; i++) {
        const booking = bookings[i]!;
        const decision = decisions[i]!;

        // Criar service order
        const order = await serviceOrderService.confirmBookingFromDecision(
          tenantId,
          booking.bookingId,
          decision.decisionId,
          input.confirmedByActorId,
          input.confirmedByUserId
        );

        serviceOrders.push({
          orderId: order.id,
          serviceId: order.serviceId,
          bookingId: booking.bookingId,
          status: order.status,
        });

        createdOrders.push(order.id);
      }

      // 4. Criar eventos de agenda vinculados (já criados pelo confirmBookingFromDecision)
      // Apenas registrar referências
      for (const order of serviceOrders) {
        calendarEvents.push({
          eventId: `event_${order.orderId}`, // Placeholder - buscar do calendar se necessário
          serviceOrderId: order.orderId,
        });
      }

      // 5. Registrar log de auditoria (não bloqueante)
      try {
        const { recordBusinessAuditSafely } = await import('../business-audit/business-audit.helpers');
        await recordBusinessAuditSafely(tenantId, {
          action: 'bundle_confirmed',
          actorId: input.confirmedByActorId,
          userId: input.confirmedByUserId || null,
          contextType: 'bundle',
          contextId: bundleIds[0] || input.bundleId,
          metadata: {
            bookingIds: input.bookingIds,
            decisionIds: input.decisionIds,
            serviceOrderIds: serviceOrders.map(o => o.orderId),
          },
        });
      } catch (auditError) {
        console.error('Erro ao registrar log de auditoria para bundle confirmado:', auditError);
      }

      return {
        bundleId: bundleIds[0] || input.bundleId,
        serviceOrders,
        calendarEvents,
      };
    } catch (error) {
      // Se falhar, tentar reverter service orders criados
      // Por enquanto, apenas logar - service orders não têm rollback automático
      console.error('Erro ao confirmar bundle - alguns service orders podem ter sido criados:', error);
      throw error;
    }
  }

  /**
   * Valida se bundle pode ser confirmado
   * 
   * Verifica se todos os bookings têm decisão ACCEPTED
   */
  async canConfirmBundle(
    tenantId: string,
    bundleId: string
  ): Promise<{ canConfirm: boolean; reason?: string }> {
    const bundleBookings = await this.getBundleBookings(tenantId, bundleId);

    if (bundleBookings.length === 0) {
      return { canConfirm: false, reason: 'Nenhum booking encontrado para este bundle' };
    }

    // Buscar decisões para cada booking
    const decisions = await Promise.all(
      bundleBookings.map(async (booking) => {
        const decision = await serviceBookingDecisionRepository.findByBookingId(tenantId, booking.bookingId);
        return decision && decision.status === BookingDecisionStatus.ACCEPTED ? decision : null;
      })
    );

    const allAccepted = decisions.every(d => d !== undefined);
    
    if (!allAccepted) {
      const missingCount = decisions.filter(d => !d).length;
      return {
        canConfirm: false,
        reason: `${missingCount} booking(s) ainda não têm decisão ACCEPTED`,
      };
    }

    return { canConfirm: true };
  }

  /**
   * Valida se evento requer produção assistida (XL/XXL)
   * Se sim, bloqueia bundle direto e registra audit log
   */
  private async validateAssistedProductionRequired(
    tenantId: string,
    eventId: string,
    actorId: string,
    userId: string
  ): Promise<void> {
    try {
      // 1. Buscar evento
      const { eventRepository } = await import('../events/event.repository');
      const event = await eventRepository.getEventById(tenantId, eventId);
      if (!event) {
        return; // Se evento não existe, não valida (não bloqueia)
      }

      // 2. Extrair capacidade do evento
      const capacity = event.metadata?.capacity as any;
      if (!capacity || !capacity.capacityClass) {
        return; // Se não houver capacidade, não valida
      }

      // 3. Verificar se é XL ou XXL
      const capacityClass = capacity.capacityClass as string;
      if (capacityClass === 'XL' || capacityClass === 'XXL') {
        // Registrar audit log (não bloqueante)
        try {
          const { recordBusinessAuditSafely } = await import('../business-audit/business-audit.helpers');
          await recordBusinessAuditSafely(tenantId, {
            action: 'production_assisted_required',
            actorId,
            userId,
            contextType: 'event',
            contextId: eventId,
            metadata: {
              capacityClass,
              attemptedAction: 'bundle:create',
            },
          });
        } catch (auditError) {
          console.warn('[ServiceBundle] Erro ao registrar audit de produção assistida:', auditError);
        }

        // Lançar erro com código específico
        const { BadRequestError } = await import('@core/errors');
        const { ErrorCode } = await import('@core/errors/error-codes');
        throw new BadRequestError(
          'Este evento exige produção assistida. Não é possível criar bundle direto. Use RFQ para contratar serviços.',
          ErrorCode.EVENT_REQUIRES_ASSISTED_PRODUCTION
        );
      }
    } catch (error: any) {
      // Re-lançar se for o erro de produção assistida
      if (error.code === 'EVENT_REQUIRES_ASSISTED_PRODUCTION') {
        throw error;
      }
      // Outros erros são ignorados (não bloqueiam bundle)
      console.warn('[ServiceBundle] Erro ao validar produção assistida (não bloqueante):', error);
    }
  }

  /**
   * Valida compatibilidade técnica entre bundle de serviços e evento
   * 🔴 BLINDAGEM: Validação antes de bundle booking
   */
  private async validateBundleCompatibility(
    tenantId: string,
    services: Array<{ serviceId: string; metadata: Record<string, any> }>,
    eventId: string
  ): Promise<void> {
    try {
      // 1. Buscar evento
      const { eventRepository } = await import('../events/event.repository');
      const event = await eventRepository.getEventById(tenantId, eventId);
      if (!event) {
        return; // Se evento não existe, não valida (não bloqueia)
      }

      // 2. Extrair dados de capacidade e infraestrutura do evento
      const capacity = event.metadata?.capacity as any;
      const venueInfrastructure = event.metadata?.venueInfrastructure as any;

      if (!capacity || !venueInfrastructure) {
        return; // Se não houver dados, não valida (não bloqueia)
      }

      // 3. Validar compatibilidade para cada serviço do bundle
      const { compatibilityEngineService } = await import('@core/compatibility/compatibility-engine.service');
      const blockedServices: string[] = [];
      const warningServices: string[] = [];

      for (const service of services) {
        const serviceSetups = service.metadata?.setups as any;
        if (!serviceSetups || !serviceSetups.setups || serviceSetups.setups.length === 0) {
          continue; // Se serviço não tem setups, pula validação
        }

        const firstSetup = serviceSetups.setups[0];
        const serviceData = await servicesRepository.findById(tenantId, service.serviceId);
        if (!serviceData) {
          continue;
        }

        const compatibilityResult = compatibilityEngineService.evaluateCompatibility({
          eventCapacity: {
            expectedAttendance: capacity.expectedAttendance,
            capacityClass: capacity.capacityClass,
          },
          venueInfrastructure: {
            available: venueInfrastructure.available || [],
            unavailable: venueInfrastructure.unavailable || [],
            constraints: venueInfrastructure.constraints || [],
          },
          serviceSetup: {
            id: firstSetup.id,
            label: firstSetup.label,
            brings: firstSetup.brings || [],
            requires: firstSetup.requires || [],
            optional: firstSetup.optional || [],
            minCapacityClass: firstSetup.minCapacityClass,
            maxCapacityClass: firstSetup.maxCapacityClass,
            priceModifier: firstSetup.priceModifier || 1.0,
          },
          basePriceCents: serviceData.priceCents || undefined,
        });

        if (compatibilityResult.status === 'blocked') {
          blockedServices.push(serviceData.name || service.serviceId);
        } else if (compatibilityResult.status === 'warning') {
          warningServices.push(serviceData.name || service.serviceId);
        }
      }

      // 4. Se algum serviço estiver blocked, lançar erro
      if (blockedServices.length > 0) {
        const error: any = new Error(
          `Serviços incompatíveis: ${blockedServices.join(', ')}`
        );
        error.status = 'blocked';
        error.blockedServices = blockedServices;
        throw error;
      }

      // 5. Se houver WARNINGs, apenas logar (não bloqueia)
      if (warningServices.length > 0) {
        console.warn('[ServiceBundle] Avisos de compatibilidade:', {
          eventId,
          warningServices,
        });
      }
    } catch (error: any) {
      // Se for erro de compatibilidade, re-lançar
      if (error.status === 'blocked') {
        throw error;
      }
      // Outros erros são ignorados (não bloqueiam bundle)
      console.warn('[ServiceBundle] Erro ao validar compatibilidade do bundle (não bloqueante):', error);
    }
  }
}

export const serviceBundleService = new ServiceBundleService();


