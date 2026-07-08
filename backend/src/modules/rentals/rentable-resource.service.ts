// backend/src/modules/rentals/rentable-resource.service.ts
// F-RENTAL-RESOURCE-SURFACE-SLICE-A. Autoridade espelha EXATAMENTE o padrão de POST /availability
// (DECISION-0113 canal-1): owner_actor_id NUNCA vem do body — é o actionContext.actorId do caller,
// só depois de canRepresentActor provar que req.user o representa. Aceita actor 'user' OU 'page'
// (uma empresa pode ser dona de um recurso alugável; DECISION-0151 não restringe a pessoa física).

import { authorizationService } from '@core/authorization/authorization.service';
import { HttpError } from '@core/errors/http-error';
import { rentableResourceRepository } from './rentable-resource.repository';
import type {
  RentableResource,
  RentableResourceType,
  CreateRentableResourceInput,
  ListRentableResourcesFilters,
} from './rentable-resource.types';

class RentableResourceService {
  /**
   * Cria o recurso alugável. `ownerActorId` já deve ter sido PROVADO pelo caller (rota) via
   * canRepresentActor — este service não reprova, só persiste. `conceptId` deve referenciar um
   * concept EXISTENTE (Lei de Coerência: caller nunca inventa taxonomia).
   */
  async create(
    tenantId: string,
    ownerActorId: string,
    input: CreateRentableResourceInput
  ): Promise<RentableResource> {
    const conceptOk = await rentableResourceRepository.conceptExists(tenantId, input.conceptId);
    if (!conceptOk) {
      throw HttpError.badRequest('RENTABLE_RESOURCE_CONCEPT_NOT_FOUND: concept_id não existe (recurso não pode inventar taxonomia).');
    }
    if (!input.label || input.label.trim().length === 0) {
      throw HttpError.badRequest('RENTABLE_RESOURCE_LABEL_REQUIRED');
    }

    // F-VEHICLE-MODEL-YEAR: quando o recurso é VEÍCULO, a combinação marca→modelo→concept→ano é
    // GOVERNADA e validada no backend (não confia no front). concept deve ser 'rentable' (o
    // catálogo de veículo já é rentable, mas provamos aqui também — defesa em profundidade).
    if (input.resourceType === 'vehicle') {
      const { vehicleCatalogService } = await import('@core/catalog/vehicle-catalog.service');
      const meta = (input.metadata ?? {}) as { vehicleMakeId?: string; vehicleModelId?: string };
      const conceptRentable = await rentableResourceRepository.conceptHasOfferKind(tenantId, input.conceptId, 'rentable');
      if (!conceptRentable) {
        throw HttpError.badRequest('RENTABLE_RESOURCE_CONCEPT_NOT_RENTABLE: concept sem offer_kind=rentable.');
      }
      const v = await vehicleCatalogService.validateVehicleCombo({
        makeId: meta.vehicleMakeId ?? null,
        modelId: meta.vehicleModelId ?? null,
        conceptId: input.conceptId,
        year: input.resourceYear ?? null,
      });
      if (!v.ok) throw HttpError.badRequest(`RENTABLE_RESOURCE_VEHICLE_INVALID: ${v.code}`);
    }

    // Localização governada (F-RENTABLE-RESOURCE-LOCATION-MVP): cidade da SSOT `cities`, validada no
    // backend — nunca city_name livre. O front manda cityId JÁ resolvido; aqui provamos que existe.
    if (input.cityId) {
      const cityOk = await rentableResourceRepository.cityExists(input.cityId);
      if (!cityOk) throw HttpError.badRequest('RENTABLE_RESOURCE_CITY_NOT_FOUND: cidade não existe na base canônica.');
    }

    // Fase 3 — QUANTIDADE: único (identidade própria) vs fungível. Veículo/imóvel/espaço travados em 1;
    // só equipamento pode ter >1. Backend é a autoridade (front não decide).
    const SINGLE_ONLY: RentableResourceType[] = ['vehicle', 'property', 'space'];
    let quantity = Math.max(1, Math.floor(input.quantity ?? 1));
    if (SINGLE_ONLY.includes(input.resourceType) && quantity !== 1) {
      throw HttpError.badRequest(`RENTABLE_RESOURCE_QUANTITY_MUST_BE_1: ${input.resourceType} é único (identidade própria), quantidade não pode ser ${quantity}.`);
    }

    const created = await rentableResourceRepository.create(tenantId, ownerActorId, {
      ...input,
      label: input.label.trim(),
      quantity,
    });

    // Fase 1 — faixas de preço (SSOT rental_resource_pricing). Dinheiro em cents; validado no schema.
    if (input.pricingTiers && input.pricingTiers.length > 0) {
      await rentableResourceRepository.setPricingTiers(tenantId, created.id, input.pricingTiers);
    }

    // vínculo de localização pelo padrão canônico address_assignments → addresses → cities
    if (input.cityId) {
      await rentableResourceRepository.assignCityToResource(tenantId, created.id, input.cityId);
    }
    return created;
  }

  async get(tenantId: string, id: string): Promise<RentableResource> {
    const resource = await rentableResourceRepository.findById(tenantId, id);
    if (!resource) {
      throw HttpError.notFound('RENTABLE_RESOURCE_NOT_FOUND');
    }
    return resource;
  }

  async list(tenantId: string, filters: ListRentableResourcesFilters): Promise<RentableResource[]> {
    return rentableResourceRepository.list(tenantId, filters);
  }

  /** DESCOBERTA (consumir): filtrada pela plateia do dono — enforcement no BANCO, viewer server-side. */
  async listDiscoverable(tenantId: string, viewerActorId: string, limit?: number): Promise<RentableResource[]> {
    return rentableResourceRepository.listDiscoverable(tenantId, viewerActorId, limit);
  }

  /**
   * Muda status (active/paused/retired). Owner-only — prova via canRepresentActor contra o
   * owner_actor_id JÁ REGISTRADO do recurso (não o declarado pelo caller).
   */
  async updateStatus(
    tenantId: string,
    resourceId: string,
    requestingUserId: string,
    status: 'active' | 'paused' | 'retired'
  ): Promise<RentableResource> {
    const resource = await this.get(tenantId, resourceId);
    let canRep = false;
    try {
      canRep = await authorizationService.canRepresentActor(tenantId, requestingUserId, resource.ownerActorId);
    } catch {
      canRep = false;
    }
    if (!canRep) {
      throw HttpError.forbidden('RENTABLE_RESOURCE_STATUS_NOT_REPRESENTABLE: sem autoridade sobre o owner do recurso.');
    }
    const updated = await rentableResourceRepository.updateStatus(tenantId, resourceId, status);
    if (!updated) {
      throw HttpError.notFound('RENTABLE_RESOURCE_NOT_FOUND');
    }
    return updated;
  }
}

export const rentableResourceService = new RentableResourceService();
