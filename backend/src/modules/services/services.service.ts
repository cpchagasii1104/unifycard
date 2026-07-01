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
import { authorizationService } from '@core/authorization/authorization.service';
import { actorCapabilityGrantService } from '@modules/authority/actor-capability-grant.service';
import { ensureUserActor } from '@modules/identity/actor-writer.service';
import { isActorEffectivelyBlocked } from '@modules/risk-identity/actor-effective-block';
import { assertServiceCategoryAllowedForCompany } from './service-category-guard';
import { unifiedAvailabilityService } from '@core/availability/unified-availability.service';
import type {
  UnifiedAvailability,
  CreateUnifiedAvailabilityInput,
  UpdateUnifiedAvailabilityInput,
} from '@core/availability/unified-availability.types';
import { AvailabilityOwnerType, UnifiedAvailabilityStatus } from '@core/availability/unified-availability.types';
import type { Service, CreateServiceInput, UpdateServiceInput } from './services.types';
import { ServiceStatus, ServiceType } from './services.types';
// 🔴 CORREÇÃO FASE 1B: Removidas referências a serviceAvailabilityRepository e AvailabilityStatus
// Toda lógica temporal agora usa unifiedAvailabilityService

class ServicesService {
  /**
   * 🔴 F-SERVICE-MUTATIONS-QUARANTINE-GATE (§4.8.4) — autoridade-ATIVA. capability/representação DECIDE permissão;
   * quarentena DECIDE se o actor está ATIVO para agir. Se o actor (ou sua âncora humana, via cascata de
   * isActorEffectivelyBlocked) está bloqueado, a mutação de serviço é congelada — grant antigo NÃO atravessa ATL.
   * Recebe um actorId JÁ RESOLVIDO server-side (scopeActor dono OU grantee/operador), NUNCA userId cru/referral.
   * Chamar ANTES de qualquer escrita (servicesRepository.create/update). NÃO toca canRepresentActor (que segue puro).
   */
  private async assertActorNotQuarantined(tenantId: string, actorId: string): Promise<void> {
    if (await isActorEffectivelyBlocked(tenantId, actorId)) {
      throw new ForbiddenError(
        'ACTOR_EFFECTIVELY_BLOCKED: actor em quarentena (ou âncora humana bloqueada) — mutação de serviço bloqueada (§4.8.4).'
      );
    }
  }

  /**
   * 🔴 F-OFFER-2B (DECISION-0144 §A.4/5/6) — ELEGIBILIDADE declaração→service.
   * Só permite criar um `service` descobrível se existir declaração/publicação ACTIVE do MESMO
   * `concept_id` (resolvido do canonical_service; match EXATO). Re-gateia na travessia: é SOMADO ao
   * gate de autoridade já provado (canRepresentActor) — declaração é INSUMO, NÃO substitui autoridade.
   * PF (actor humano, actor_type='user'): exige `actor_professional_concepts.is_active=true` (tenant, actor, concept).
   * PJ (page-actor de company, company_id setado): exige `company_concept_publications.status='active'` (tenant, company, concept).
   * G1: usa o campo ACTIVE vivo (is_active / status='active'). G2/G6: subject = actor já provado server-side
   * (sem actionContext.actorId). G3: PF×PJ indistinguível → erro controlado (não heurística). G5: concept EXATO.
   */
  private async assertDeclarationEligibility(
    tenantId: string,
    actor: { actor_id: string; actor_type: string; company_id: string | null },
    conceptId: string
  ): Promise<void> {
    const { runQueryWithTenant } = await import('@core/database/pool');

    // PJ: page-actor de company → publicação institucional ACTIVE do concept.
    if (actor.company_id) {
      const pub = await runQueryWithTenant<{ ok: number }>(
        tenantId,
        `SELECT 1 AS ok FROM company_concept_publications
          WHERE tenant_id = $1 AND company_id = $2 AND concept_id = $3 AND status = 'active' LIMIT 1`,
        [tenantId, actor.company_id, conceptId]
      );
      if (!pub) {
        throw new ForbiddenError(
          'SERVICE_ELIGIBILITY_PUBLICATION_REQUIRED: a empresa não tem publicação ATIVA deste concept (DECISION-0144); publique o concept antes de criar o serviço.'
        );
      }
      return;
    }

    // PF: actor humano → declaração de capacidade ACTIVE do concept.
    if (actor.actor_type === 'user') {
      const decl = await runQueryWithTenant<{ ok: number }>(
        tenantId,
        `SELECT 1 AS ok FROM actor_professional_concepts
          WHERE tenant_id = $1 AND actor_id = $2 AND concept_id = $3 AND is_active = true LIMIT 1`,
        [tenantId, actor.actor_id, conceptId]
      );
      if (!decl) {
        throw new ForbiddenError(
          'SERVICE_ELIGIBILITY_DECLARATION_REQUIRED: o actor não declarou capacidade ATIVA neste concept (DECISION-0144); declare em /profile/professional/c1/concepts antes de criar o serviço.'
        );
      }
      return;
    }

    // G3: PF×PJ indistinguível com segurança → não inventar heurística.
    throw new ForbiddenError(
      'SERVICE_ELIGIBILITY_SUBJECT_UNSUPPORTED: tipo de actor não suportado para criar serviço (esperado PF actor_type=user ou page-actor de company).'
    );
  }

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

    // 🔴 DECISION-0113 / DECISION-0131 §B7 / Z2-R6.1 — `userId` (principal autenticado server-side) DEVE
    // representar o actor dono declarado; existência do actor NÃO prova representação. Fail-closed (403).
    // Defesa em profundidade — a rota já vinculou; este check protege chamadas diretas ao service.
    //
    // 🔴 F-ACTOR-CAPABILITY-GRANTS-MVP Slice 1C (DECISION-0136/0138) — composição de autoridade FAIL-CLOSED:
    //   (A/B) owner/self via canRepresentActor(user, actor-alvo)  OU
    //   (C)   grant ADITIVO escopado: o chamador (grantee = seu PRÓPRIO actor) recebeu `services:create`
    //         no escopo do actor-alvo (`hasCapabilityGrant`). O grant é ADITIVO e ESCOPADO — autoriza só
    //         ESTA ação NESTE escopo; NÃO vira canRepresentActor global, NÃO substitui owner, e NÃO bypassa
    //         os gates semânticos abaixo (categoria/ramo, concept, declaração/publicação PJ, company operacional).
    //   Referral/código de indicação NUNCA participa (grantee/escopo são actor_id, resolvidos server-side).
    let authorized = await authorizationService.canRepresentActor(tenantId, userId, input.actorId);
    let granteeActorId: string | null = null;
    if (!authorized) {
      const grantee = await ensureUserActor(tenantId, userId); // grantee = actor do próprio chamador (server-side)
      granteeActorId = grantee.actor_id;
      authorized = await actorCapabilityGrantService.hasCapabilityGrant(tenantId, granteeActorId, 'services:create', input.actorId);
    }
    if (!authorized) {
      throw new ForbiddenError('SERVICE_ACTOR_NOT_REPRESENTABLE: apenas quem representa o actor (ou tem grant services:create no escopo) pode criar serviço em seu nome');
    }

    // 🔴 F-SERVICE-MUTATIONS-QUARANTINE-GATE: scopeActor (dono) bloqueado → não cria serviço em seu nome; e o
    // operador/grantee (caminho de grant) bloqueado → grant antigo NÃO atravessa ATL. ANTES de qualquer escrita.
    await this.assertActorNotQuarantined(tenantId, input.actorId);
    if (granteeActorId && granteeActorId !== input.actorId) {
      await this.assertActorNotQuarantined(tenantId, granteeActorId);
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

    // DECISION-0117 D: serviço empresarial REFERENCIA identidade canônica compartilhada —
    // não duplica significado por prestador. Obrigatório para service_type='service';
    // o canônico deve existir, estar ATIVO (curado) e visível no tenant (global∪scoped).
    // Redirect de merge é resolvido aqui (refs antigas seguem válidas).
    const effectiveServiceType = input.serviceType || ServiceType.SERVICE;
    let canonicalServiceId = input.canonicalServiceId ?? null;
    if (effectiveServiceType === ServiceType.SERVICE) {
      if (!canonicalServiceId) {
        throw new BadRequestError(
          'canonicalServiceId é obrigatório: serviço referencia o serviço canônico compartilhado (DECISION-0117 D).'
        );
      }
      const { canonicalServiceService } = await import('@core/catalog/canonical/canonical-service.service');
      const canonical = await canonicalServiceService.requireActiveForTenant(tenantId, canonicalServiceId);
      canonicalServiceId = canonical.id;

      // 🔴 F-OFFER-2B / DECISION-0144 §A.4/5/6: ELEGIBILIDADE declaração→service. Só cria service
      // descobrível se houver declaração (PF) / publicação (PJ) ACTIVE do MESMO concept_id — resolvido
      // do canonical (EXATO; sem domain/category/slug/grafo). Re-gateia na travessia (NÃO herda): é
      // SOMADO ao canRepresentActor já provado acima; declaração é INSUMO, não substitui autoridade.
      await this.assertDeclarationEligibility(tenantId, actor, canonical.conceptId);
    }

    // Criar serviço
    const service = await servicesRepository.create(tenantId, {
      ...input,
      canonicalServiceId,
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

    // 🔴 DECISION-0113 / DECISION-0131 §B7 / Z2-R6.1 — substitui o check fraco anterior
    // (`actor.user_id !== userId && actor.actor_type !== 'user'`, bypass para actor-type 'user' e sem
    // caminho de delegação). Autoridade = representação do actor DONO (currentService.actorId) pelo
    // principal autenticado (userId), via canRepresentActor. Fail-closed (403). Defesa em profundidade:
    // a rota já vinculou; este check protege chamadas diretas ao service.
    //
    // 🔴 F-ACTOR-CAPABILITY-GRANTS-SERVICES-EDIT-DISABLE — composição ADITIVA por capability REQUERIDA PELA
    // OPERAÇÃO (fail-closed; service layer). Owner/canRepresentActor faz tudo (preservado). Senão, o grantee
    // (=actor do próprio chamador) precisa de TODAS as capabilities que a operação exige, no MESMO escopo
    // (currentService.actorId):
    //   • disable  = transição status → 'paused' (currentService.status !== 'paused')           → 'services:disable'
    //   • edit     = qualquer campo editável (≠ status) OU mudança de status NÃO-disable
    //                (reativar 'paused'→'active', ou draft↔active)                                → 'services:edit'
    //   • misto (edita campos E pausa no mesmo PUT)                                               → EXIGE AS DUAS
    // Grant é ADITIVO/ESCOPADO: NÃO troca dono/provider/tenant/concept (UpdateServiceInput não expõe esses
    // campos — proteção ESTRUTURAL), NÃO vira representação global, NÃO bypassa os gates (categoria/ramo abaixo).
    // services:disable NUNCA autoriza editar campo; services:edit NUNCA autoriza pausar. Referral fora.
    const canRepresentOwner = await authorizationService.canRepresentActor(tenantId, userId, currentService.actorId);
    let granteeActorId: string | null = null;
    if (!canRepresentOwner) {
      const isDisableTransition = input.status === ServiceStatus.PAUSED && currentService.status !== ServiceStatus.PAUSED;
      const editableFieldKeys: (keyof UpdateServiceInput)[] = [
        'name', 'description', 'shortDescription', 'serviceType', 'categoryId', 'priceCents',
        'currency', 'pricingType', 'countryId', 'stateId', 'cityId', 'neighborhood', 'metadata',
      ];
      const hasFieldEdit = editableFieldKeys.some((k) => input[k] !== undefined);
      const hasNonDisableStatusChange = input.status !== undefined && input.status !== currentService.status && !isDisableTransition;
      const requiredCaps = new Set<string>();
      if (isDisableTransition) requiredCaps.add('services:disable');
      if (hasFieldEdit || hasNonDisableStatusChange) requiredCaps.add('services:edit');
      if (requiredCaps.size === 0) requiredCaps.add('services:edit'); // update sem mudança reconhecida → trata como edit (fail-closed)
      const grantee = await ensureUserActor(tenantId, userId);
      granteeActorId = grantee.actor_id;
      let allGranted = true;
      for (const cap of requiredCaps) {
        const ok = await actorCapabilityGrantService.hasCapabilityGrant(tenantId, granteeActorId, cap, currentService.actorId);
        if (!ok) { allGranted = false; break; }
      }
      if (!allGranted) {
        throw new ForbiddenError('SERVICE_ACTOR_NOT_REPRESENTABLE: sem autoridade para esta operação (canRepresentActor, ou grants services:edit/services:disable exigidos pela operação) no escopo do actor dono');
      }
    }

    // 🔴 F-SERVICE-MUTATIONS-QUARANTINE-GATE: scopeActor (dono) bloqueado → não edita/pausa em seu nome; e o
    // operador/grantee (caminho de grant) bloqueado → grant antigo NÃO atravessa ATL. ANTES de qualquer escrita.
    await this.assertActorNotQuarantined(tenantId, currentService.actorId);
    if (granteeActorId && granteeActorId !== currentService.actorId) {
      await this.assertActorNotQuarantined(tenantId, granteeActorId);
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

    // 🔴 F-OFFER-4 / DECISION-0142: matching por concept_id. category = entrada de navegação resolvida a
    // concept_id (hop de LEITURA efêmero; V1 exige categoria-folha; NUNCA persiste concept_ref).
    let conceptId: string | undefined;
    if (filters.categoryId) {
      const { resolveConceptFromCategory } = await import('@core/semantic/semantic.adapter');
      const resolved = await resolveConceptFromCategory(filters.categoryId);
      if (!resolved.conceptId) {
        throw new BadRequestError('CATEGORY_REQUIRES_LEAF_CONCEPT: a categoria precisa ser folha com concept_id (DECISION-0142); discovery casa por concept, não por category/domain.');
      }
      conceptId = resolved.conceptId;
    }

    // Buscar serviços com filtros básicos (matching por concept_id; category não é identidade material)
    const services = await servicesRepository.discoverServices(tenantId, {
      conceptId,
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
          // 🔴 F-SERVICE-AVAILABILITY-LEGACY-SERVICE-OWNER-READER-CONTAINMENT-SLICE-A2
          //    (DECISION-0156 / DT-SERVICE-AVAILABILITY-RUNTIME-DRIFT-FROM-SSOT): o SSOT temporal reservável de
          //    um serviço canônico-bound é a OFERTA (owner_type='service_offering'), NUNCA o escopo legado
          //    owner_type='service'. Por isso o summary legado (this-scope='service') NÃO é apresentado como
          //    agenda reservável verdadeira quando o serviço tem `canonicalServiceId` — espelho velho contido.
          //    Espelha a regra DECISION-0146 já vigente no detalhe (`ServiceDiscoveryDetailPage`), fechando a
          //    inconsistência da LISTA. Contenção de READ-MODEL apenas: a janela legada NÃO é apagada, o filtro
          //    de membership NÃO muda (calculado acima), e a agenda reservável real continua vindo da oferta.
          //    Serviço sem canonical (legado puro, inexistente sob F-OFFER-2A) preserva o comportamento anterior.
          availability_summary: service.canonicalServiceId
            ? undefined
            : {
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

