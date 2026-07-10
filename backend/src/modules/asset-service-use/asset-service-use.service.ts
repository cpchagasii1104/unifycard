// backend/src/modules/asset-service-use/asset-service-use.service.ts
// F-ASSET-MULTI-OFFER-FOUNDATION Fatia 4B — regra do vínculo de uso operacional (adendo
// RFC_ASSET_SERVICE_USE_OPERATIONAL_ADENDO). Autoridade = canRepresentActor sobre o owner JÁ REGISTRADO do
// asset (mesmo padrão da venda). v1 = SOMENTE dono-operador (D-C/D-D): terceiro-operador exige
// asset:operate/release (Fatia 4C, NÃO implementada) — recusado fail-closed aqui. Habilitação do operador
// reusa o MESMO gate de service_offering (evaluateOfferingActivationEligibility) — sem trilho paralelo de
// KYC-lite/KYB (invariantes 10-12). Δbank=0.

import { authorizationService } from '@core/authorization/authorization.service';
import { HttpError } from '@core/errors/http-error';
import { evaluateOfferingActivationEligibility } from '@modules/services/services-offering-activation-gate';
import { assetServiceUseRepository } from './asset-service-use.repository';
import type { AssetServiceUsage, CreateAssetServiceUsageInput, AssetServiceUseStatus } from './asset-service-use.types';

class AssetServiceUseService {
  /**
   * Ativa uso operacional sobre um actor_asset JÁ EXISTENTE. v1: operador = SEMPRE o dono do asset
   * (dono-operador, D-C). NÃO aceita operador declarado pelo caller — terceiro-operador fica fora do
   * endpoint vivo até a Fatia 4C (release via actor_capability_grants + asset:operate).
   */
  async activateOnExisting(tenantId: string, assetId: string, requestingUserId: string, input: CreateAssetServiceUsageInput): Promise<AssetServiceUsage> {
    const asset = await assetServiceUseRepository.findAssetOwnerAndConcept(tenantId, assetId);
    if (!asset) throw HttpError.notFound('ASSET_SERVICE_USE_ASSET_NOT_FOUND: item não existe (ou fora do tenant).');

    // Autoridade sobre o owner JÁ REGISTRADO do item (fail-closed).
    if (!(await this.represents(tenantId, requestingUserId, asset.ownerActorId)))
      throw HttpError.forbidden('ASSET_SERVICE_USE_NOT_REPRESENTABLE: sem autoridade sobre o owner do item.');

    // D-B/invariante 8-9: concept do serviço deve ser offer_kind='service' (nunca category/texto-livre).
    const offerable = await assetServiceUseRepository.serviceConceptIsOfferable(tenantId, input.serviceConceptId);
    if (!offerable) throw HttpError.badRequest('ASSET_SERVICE_USE_CONCEPT_NOT_SERVICE: concept não tem offer_kind=service.');

    // D-C/D-D: v1 = SOMENTE dono-operador. Operador = owner do asset, sempre (nunca vem do body).
    const operatorActorId = asset.ownerActorId;

    // Invariantes 10-12: operador deve estar HABILITADO para o service_concept — reusa o gate de
    // service_offering (PF: actor_professional_concepts + civil mínimo; PJ: company_concept_publications + KYB).
    const companyId = await assetServiceUseRepository.findCompanyIdForActor(tenantId, operatorActorId);
    const eligibility = await evaluateOfferingActivationEligibility({
      tenantId, providerActorId: operatorActorId, companyId, conceptId: input.serviceConceptId,
    });
    if (!eligibility.ok) {
      throw HttpError.forbidden(`ASSET_SERVICE_USE_OPERATOR_NOT_ELIGIBLE: ${eligibility.reasons[0] ?? 'operador não habilitado para o service_concept.'}`);
    }

    return assetServiceUseRepository.activate(tenantId, assetId, operatorActorId, input);
  }

  async get(tenantId: string, id: string): Promise<AssetServiceUsage> {
    const usage = await assetServiceUseRepository.findById(tenantId, id);
    if (!usage) throw HttpError.notFound('ASSET_SERVICE_USE_NOT_FOUND.');
    return usage;
  }

  /** "Meus usos operacionais" — só o próprio dono, provado por canRepresentActor. */
  async listMine(tenantId: string, ownerActorId: string, requestingUserId: string): Promise<AssetServiceUsage[]> {
    if (!(await this.represents(tenantId, requestingUserId, ownerActorId)))
      throw HttpError.forbidden('ASSET_SERVICE_USE_LIST_NOT_REPRESENTABLE: sem autoridade sobre o owner.');
    return assetServiceUseRepository.listByOwner(tenantId, ownerActorId);
  }

  /** Muda status (active/paused) — owner-only via canRepresentActor contra o owner JÁ REGISTRADO. */
  async updateStatus(tenantId: string, id: string, requestingUserId: string, status: AssetServiceUseStatus): Promise<AssetServiceUsage> {
    const usage = await this.get(tenantId, id);
    if (!(await this.represents(tenantId, requestingUserId, usage.ownerActorId)))
      throw HttpError.forbidden('ASSET_SERVICE_USE_UPDATE_NOT_REPRESENTABLE: sem autoridade sobre o owner do item.');
    const updated = await assetServiceUseRepository.updateStatus(tenantId, id, status);
    if (!updated) throw HttpError.notFound('ASSET_SERVICE_USE_NOT_FOUND.');
    return updated;
  }

  private async represents(tenantId: string, userId: string, actorId: string): Promise<boolean> {
    try { return await authorizationService.canRepresentActor(tenantId, userId, actorId); }
    catch { return false; }
  }
}

export const assetServiceUseService = new AssetServiceUseService();
