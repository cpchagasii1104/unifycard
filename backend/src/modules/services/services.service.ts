// src/modules/services/services.service.ts
// Service do Domínio de SERVIÇOS
// 🔴 BLINDAGEM: Serviço NÃO decide nada sozinho
// Serviço NÃO faz matching automático
// Serviço NÃO executa pagamento direto
// Serviço NÃO cria score

import { servicesRepository } from './services.repository';
import { actorRepository } from '@modules/social/actor.repository';
import { actorIntentsService } from '@modules/social/actor-intents.service';
import { actorEffectsService } from '@modules/social/actor-effects.service';
import { ActorIntent } from '@modules/social/actor-intents.types';
import { ActorEffect } from '@modules/social/actor-effects.types';
import { BadRequestError, ForbiddenError } from '@core/errors';
import { assertServiceCategoryAllowedForCompany } from './service-category-guard';
import { unifiedAvailabilityService } from '@core/availability/unified-availability.service';
import type {
  UnifiedAvailability,
  CreateUnifiedAvailabilityInput,
  UpdateUnifiedAvailabilityInput,
} from '@core/availability/unified-availability.types';
import { AvailabilityOwnerType, UnifiedAvailabilityStatus } from '@core/availability/unified-availability.types';
import type { Service, CreateServiceInput, UpdateServiceInput } from './services.types';
import { ServiceStatus } from './services.types';
// 🔴 CORREÇÃO FASE 1B: Removidas referências a serviceAvailabilityRepository e AvailabilityStatus
// Toda lógica temporal agora usa unifiedAvailabilityService

class ServicesService {
  /**
   * Cria um novo serviço
   * 🔴 BLINDAGEM: actorId é OBRIGATÓRIO
   * 🔴 BLINDAGEM: Serviço nasce de intents específicas (ex: OFFER_SERVICE)
   */
  async createService(
    tenantId: string,
    userId: string,
    input: CreateServiceInput,
    intent?: ActorIntent
  ): Promise<Service> {
    // 🔴 BLINDAGEM: Validar que actorId foi fornecido
    if (!input.actorId) {
      throw new BadRequestError('actorId é obrigatório para criar serviço');
    }

    // 🔴 BLINDAGEM: Validar que actor existe
    const actor = await actorRepository.findById(tenantId, input.actorId);
    if (!actor) {
      throw new BadRequestError('Actor não encontrado');
    }

    // 🔴 BLINDAGEM: Validar intent se fornecido
    // Serviço nasce de intents específicas (ex: OFFER_SERVICE)
    if (intent) {
      const intentValidation = await actorIntentsService.validateIntent(
        tenantId,
        input.actorId,
        intent,
        actor.actor_type
      );

      if (!intentValidation.valid) {
        throw new BadRequestError(intentValidation.reason || 'Intent inválido para criar serviço');
      }
    }

    // DECISION-0109 (D1/D3/D6): categoria de serviço deve ser domain='servicos' e, se a empresa do
    // page-actor estiver classificada, pertencer à ponte de ramos do company_type. Fail-closed; Bank-free.
    await assertServiceCategoryAllowedForCompany(
      tenantId,
      input.actorId,
      input.categoryId,
      input.serviceType
    );

    // Criar serviço
    const service = await servicesRepository.create(tenantId, {
      ...input,
      status: input.status || ServiceStatus.DRAFT, // Default: draft
    });

    // 🔴 BLINDAGEM: Emitir effects ao criar serviço
    // Effect é consequência sistêmica, não decisão humana
    if (intent || ActorIntent.OFFER_SERVICE) {
      try {
        await actorEffectsService.emitEffects(
          tenantId,
          input.actorId,
          intent || ActorIntent.OFFER_SERVICE,
          {
            sourceId: service.serviceId,
            sourceType: 'service',
            metadata: {
              serviceType: service.serviceType,
              status: service.status,
            },
          }
        );
      } catch (error) {
        // Não quebra criação se effect falhar
        console.error('Erro ao emitir effects ao criar serviço (não crítico):', error);
      }
    }

    return service;
  }

  /**
   * Busca serviço por ID
   */
  async getService(tenantId: string, serviceId: string): Promise<Service | null> {
    return await servicesRepository.findById(tenantId, serviceId);
  }

  /**
   * Lista serviços de um Actor
   * 🔴 BLINDAGEM: Nenhuma query deve usar serviço como filtro decisório
   */
  async getActorServices(
    tenantId: string,
    actorId: string,
    filters?: { status?: ServiceStatus }
  ): Promise<Service[]> {
    return await servicesRepository.findByActor(tenantId, actorId, filters);
  }

  /**
   * Atualiza serviço
   */
  async updateService(
    tenantId: string,
    serviceId: string,
    userId: string,
    input: UpdateServiceInput
  ): Promise<Service> {
    // Buscar serviço atual
    const currentService = await servicesRepository.findById(tenantId, serviceId);
    if (!currentService) {
      throw new BadRequestError('Serviço não encontrado');
    }

    // Validar que usuário tem permissão (owner do actor)
    const actor = await actorRepository.findById(tenantId, currentService.actorId);
    if (!actor) {
      throw new BadRequestError('Actor não encontrado');
    }

    // 🔴 BLINDAGEM: Validar permissão (simplificado - pode ser expandido)
    // Por enquanto, apenas verificar se é owner do actor
    if (actor.user_id !== userId && actor.actor_type !== 'user') {
      // Para page/group, verificar se usuário tem permissão
      // Por enquanto, apenas owner pode atualizar
      throw new BadRequestError('Apenas o dono do actor pode atualizar o serviço');
    }

    // DECISION-0109: se o update troca a categoria, revalida domínio + ramo (service_type efetivo do
    // input ou do serviço atual). categoryId ausente → guard é no-op (não toca a categoria).
    await assertServiceCategoryAllowedForCompany(
      tenantId,
      currentService.actorId,
      input.categoryId,
      input.serviceType ?? currentService.serviceType
    );

    // Atualizar serviço
    const updatedService = await servicesRepository.update(tenantId, serviceId, input);

    // 🔴 BLINDAGEM: Emitir effects se status mudou para 'active'
    if (input.status === ServiceStatus.ACTIVE && currentService.status !== ServiceStatus.ACTIVE) {
      try {
        await actorEffectsService.emitEffects(
          tenantId,
          currentService.actorId,
          ActorIntent.OFFER_SERVICE,
          {
            sourceId: updatedService.serviceId,
            sourceType: 'service',
            metadata: {
              serviceType: updatedService.serviceType,
              status: updatedService.status,
              activated: true,
            },
          }
        );
      } catch (error) {
        // Não quebra atualização se effect falhar
        console.error('Erro ao emitir effects ao ativar serviço (não crítico):', error);
      }
    }

    return updatedService;
  }

  /**
   * Descobrir serviços com filtros explícitos
   * 🔴 BLINDAGEM: NÃO cria ranking, score ou recomendação
   * 🔴 BLINDAGEM: Apenas consulta determinística e explícita
   */
  async discoverServices(
    tenantId: string,
    filters: {
      categoryId?: string;
      cityId?: string;
      stateId?: string;
      countryId?: string;
      startDate?: string; // ISO 8601 date string
      endDate?: string; // ISO 8601 date string
      hasAvailability?: boolean;
      actorType?: 'user' | 'page' | 'group' | 'channel';
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<Array<Service & {
    actor?: {
      actor_id: string;
      actor_type: string;
      display_name: string | null;
      city_id: string | null;
    };
    availability_summary?: {
      has_availability: boolean;
      next_available_date: string | null;
    };
  }>> {
    // Converter strings de data para Date se fornecidas
    const startDate = filters.startDate ? new Date(filters.startDate) : undefined;
    const endDate = filters.endDate ? new Date(filters.endDate) : undefined;

    // Buscar serviços com filtros básicos
    const services = await servicesRepository.discoverServices(tenantId, {
      categoryId: filters.categoryId,
      cityId: filters.cityId,
      stateId: filters.stateId,
      countryId: filters.countryId,
      startDate,
      endDate,
      actorType: filters.actorType,
      limit: filters.limit,
      offset: filters.offset,
    });

    // Enriquecer com informações de actor e disponibilidade
    const enriched = await Promise.all(
      services.map(async (service) => {
        // Buscar actor
        const actor = await actorRepository.findById(tenantId, service.actorId);

        // Buscar disponibilidades do serviço
        // 🔴 CORREÇÃO FASE 1B: Buscar disponibilidades via Unified Availability
        const { unifiedAvailabilityService } = await import('@core/availability/unified-availability.service');
        const availabilities = await unifiedAvailabilityService.listAvailabilities(tenantId, {
          ownerType: AvailabilityOwnerType.SERVICE,
          ownerId: service.serviceId,
          status: UnifiedAvailabilityStatus.ACTIVE,
        });

        // Calcular resumo de disponibilidade
        let hasAvailability = false;
        let nextAvailableDate: string | null = null;

        if (availabilities.length > 0) {
          // Verificar se há disponibilidade geral (sem data específica)
          const hasGeneralAvailability = availabilities.some(
            av => !av.endDatetime || new Date(av.endDatetime) > new Date()
          );

          if (hasGeneralAvailability) {
            hasAvailability = true;

            // Se há filtro de data, verificar disponibilidade naquela data
            if (startDate || endDate) {
              const hasDateAvailability = availabilities.some(av => {
                const avStart = new Date(av.startDatetime);
                const avEnd = av.endDatetime ? new Date(av.endDatetime) : null;

                if (startDate && endDate) {
                  // Verificar se há sobreposição entre o range do filtro e a disponibilidade
                  return (
                    (avEnd === null || avEnd >= startDate) &&
                    (avStart <= endDate)
                  );
                } else if (startDate) {
                  return avEnd === null || avEnd >= startDate;
                } else if (endDate) {
                  return avStart <= endDate;
                }
                return true;
              });

              hasAvailability = hasDateAvailability;
            }

            // Encontrar próxima data disponível
            const futureAvailabilities = availabilities
              .filter(av => {
                const avStart = new Date(av.startDatetime);
                return avStart > new Date();
              })
              .sort((a, b) => new Date(a.startDatetime).getTime() - new Date(b.startDatetime).getTime());

            if (futureAvailabilities.length > 0) {
              nextAvailableDate = futureAvailabilities[0].startDatetime.toISOString();
            }
          }
        }

        // Filtrar por has_availability se especificado
        if (filters.hasAvailability === true && !hasAvailability) {
          return null;
        }

        return {
          ...service,
          actor: actor
            ? {
                actor_id: actor.actor_id,
                actor_type: actor.actor_type,
                display_name: actor.display_name,
                city_id: actor.metadata?.city_id || null,
              }
            : undefined,
          availability_summary: {
            has_availability: hasAvailability,
            next_available_date: nextAvailableDate,
          },
        };
      })
    );

    // Remover nulls (serviços filtrados por has_availability)
    return enriched.filter((s): s is NonNullable<typeof s> => s !== null);
  }

  // ============================================================
  // AGENDA / AVAILABILITY DO SERVIÇO (DECISION-0109 — Bank-free)
  // Adapter FINO sobre o CORE real `availability` (owner_type='service', owner_id=service_id).
  // NÃO cria SSOT paralelo; NÃO cria booking; NÃO toca Bank. O core é a verdade temporal.
  // ============================================================

  /** Carrega o serviço e exige que o caller seja o actor dono (escrita de agenda = dono). */
  private async requireServiceOwnedByActor(
    tenantId: string,
    serviceId: string,
    callerActorId: string
  ): Promise<Service> {
    const service = await servicesRepository.findById(tenantId, serviceId);
    if (!service) {
      throw new BadRequestError('Serviço não encontrado');
    }
    if (service.actorId !== callerActorId) {
      throw new ForbiddenError('Apenas o actor dono do serviço pode gerir sua agenda');
    }
    return service;
  }

  /**
   * Cria disponibilidade para um serviço (delega ao core). Escrita = dono do serviço.
   * 🔴 Bank-free. NÃO cria booking. owner_type='service', owner_id=serviceId.
   */
  async createServiceAvailability(
    tenantId: string,
    callerActorId: string,
    serviceId: string,
    input: Omit<CreateUnifiedAvailabilityInput, 'ownerType' | 'ownerId'>
  ): Promise<UnifiedAvailability> {
    await this.requireServiceOwnedByActor(tenantId, serviceId, callerActorId);
    return unifiedAvailabilityService.createAvailability(tenantId, callerActorId, {
      ownerType: AvailabilityOwnerType.SERVICE,
      ownerId: serviceId,
      ...input,
    });
  }

  /**
   * Lista disponibilidades de um serviço (delega ao core). Leitura pública (descoberta).
   */
  async listServiceAvailabilities(
    tenantId: string,
    serviceId: string,
    filters?: { status?: UnifiedAvailabilityStatus }
  ): Promise<UnifiedAvailability[]> {
    return unifiedAvailabilityService.listAvailabilities(tenantId, {
      ownerType: AvailabilityOwnerType.SERVICE,
      ownerId: serviceId,
      status: filters?.status,
    });
  }

  /**
   * Atualiza uma disponibilidade do serviço (delega ao core). Escrita = dono; valida que a
   * availability pertence ao serviço (owner_type='service', owner_id=serviceId).
   */
  async updateServiceAvailability(
    tenantId: string,
    callerActorId: string,
    serviceId: string,
    availabilityId: string,
    input: UpdateUnifiedAvailabilityInput
  ): Promise<UnifiedAvailability> {
    await this.requireServiceOwnedByActor(tenantId, serviceId, callerActorId);
    const existing = await unifiedAvailabilityService.getAvailability(tenantId, availabilityId);
    if (existing.ownerType !== AvailabilityOwnerType.SERVICE || existing.ownerId !== serviceId) {
      throw new ForbiddenError('Disponibilidade não pertence a este serviço');
    }
    return unifiedAvailabilityService.updateAvailability(tenantId, availabilityId, callerActorId, input);
  }
}

export const servicesService = new ServicesService();

