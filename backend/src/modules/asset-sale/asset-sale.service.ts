// backend/src/modules/asset-sale/asset-sale.service.ts
// F-ASSET-MULTI-OFFER-FOUNDATION Fatia 3 — regra da VENDA asset-first. Autoridade = canRepresentActor sobre o
// owner_actor_id do item (D-α: PF E PJ, sem PRODUCT_PUBLISH_PJ_ONLY, sem merchant/loja). Gate de durabilidade
// = concept_asset_eligibilities (D: durável individual, NÃO SKU/perecível). Δbank=0 (preço = anúncio).

import { authorizationService } from '@core/authorization/authorization.service';
import { HttpError } from '@core/errors/http-error';
import { assetSaleRepository } from './asset-sale.repository';
import type { AssetSaleOffer, CreateAssetSaleInput, AssetSaleStatus, AssetCondition } from './asset-sale.types';

class AssetSaleService {
  /**
   * Coloca um bem durável INDIVIDUAL à venda. owner = actionContext.actorId (provado por canRepresentActor,
   * mesmo padrão da locação). D-α: PF e PJ permitidos. Gate: concept asset-elegível (durável). Δbank=0.
   */
  async create(tenantId: string, ownerActorId: string, requestingUserId: string, input: CreateAssetSaleInput): Promise<AssetSaleOffer> {
    // Autoridade: só declara venda REPRESENTANDO o actor dono (fail-closed). Sem merchant, sem PJ-only.
    if (!(await this.represents(tenantId, requestingUserId, ownerActorId)))
      throw HttpError.forbidden('ASSET_SALE_NOT_REPRESENTABLE: sem autoridade sobre o owner do item.');

    // Gate de durabilidade governado (concept_asset_eligibilities) — NÃO category, NÃO SKU/perecível.
    const eligible = await assetSaleRepository.conceptIsAssetEligible(tenantId, input.conceptId);
    if (!eligible) throw HttpError.badRequest('ASSET_SALE_CONCEPT_NOT_DURABLE: concept não é asset-elegível (bem durável). SKU/perecível segue em products.');

    const label = input.label?.trim();
    if (!label) throw HttpError.badRequest('ASSET_SALE_LABEL_REQUIRED.');

    return assetSaleRepository.create(tenantId, ownerActorId, { ...input, label });
  }

  async get(tenantId: string, assetId: string): Promise<AssetSaleOffer> {
    const offer = await assetSaleRepository.findById(tenantId, assetId);
    if (!offer) throw HttpError.notFound('ASSET_SALE_NOT_FOUND.');
    return offer;
  }

  /** "Minhas vendas" — só o próprio dono, provado por canRepresentActor. */
  async listMine(tenantId: string, ownerActorId: string, requestingUserId: string): Promise<AssetSaleOffer[]> {
    if (!(await this.represents(tenantId, requestingUserId, ownerActorId)))
      throw HttpError.forbidden('ASSET_SALE_LIST_NOT_REPRESENTABLE: sem autoridade sobre o owner.');
    return assetSaleRepository.listByOwner(tenantId, ownerActorId);
  }

  /** Muda status (active/paused) — owner-only via canRepresentActor contra o owner JÁ REGISTRADO. */
  async updateStatus(tenantId: string, assetId: string, requestingUserId: string, status: AssetSaleStatus): Promise<AssetSaleOffer> {
    const offer = await this.get(tenantId, assetId);
    await this.assertOwner(tenantId, requestingUserId, offer.ownerActorId);
    const updated = await assetSaleRepository.updateStatus(tenantId, assetId, status);
    if (!updated) throw HttpError.notFound('ASSET_SALE_NOT_FOUND.');
    return updated;
  }

  /** Edita a oferta de venda (owner-only). NÃO edita identidade (concept/label); condição do item editável. */
  async update(tenantId: string, assetId: string, requestingUserId: string, input: {
    priceCents?: number | null; visibility?: string; audienceRelationshipTypes?: string[] | null;
    negotiable?: boolean; saleNotes?: string | null; condition?: AssetCondition | null;
  }): Promise<AssetSaleOffer> {
    const offer = await this.get(tenantId, assetId);
    await this.assertOwner(tenantId, requestingUserId, offer.ownerActorId);
    await assetSaleRepository.updateOffer(tenantId, assetId, {
      priceCents: input.priceCents,
      visibility: input.visibility,
      audienceRelationshipTypes: input.audienceRelationshipTypes,
      negotiable: input.negotiable,
      saleNotes: input.saleNotes,
      conditionTouched: input.condition !== undefined,
      condition: input.condition ?? null,
    });
    return this.get(tenantId, assetId);
  }

  private async assertOwner(tenantId: string, requestingUserId: string, ownerActorId: string): Promise<void> {
    if (!(await this.represents(tenantId, requestingUserId, ownerActorId)))
      throw HttpError.forbidden('ASSET_SALE_UPDATE_NOT_REPRESENTABLE: sem autoridade sobre o owner do item.');
  }

  /** Binding canônico de autoridade (DECISION-0113): o caller (userId) representa o actor dono (actorId)?
   *  Assinatura canônica canRepresentActor(tenantId, userId, actorId) — fail-closed. Fonte única do módulo. */
  private async represents(tenantId: string, userId: string, actorId: string): Promise<boolean> {
    try { return await authorizationService.canRepresentActor(tenantId, userId, actorId); }
    catch { return false; }
  }
}

export const assetSaleService = new AssetSaleService();
