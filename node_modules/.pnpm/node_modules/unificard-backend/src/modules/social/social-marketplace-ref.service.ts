// backend/src/modules/social/social-marketplace-ref.service.ts
// SPRINT 47: Service para referências do marketplace no social

import { socialMarketplaceRefRepository } from './social-marketplace-ref.repository';
import type {
  SocialMarketplaceRef,
  CreateSocialMarketplaceRefInput,
  SocialMarketplaceRefWithDetails,
} from './social-marketplace-ref.types';

/**
 * Service para referências do marketplace no social
 * 
 * ⚠️ REGRAS ARQUITETURAIS (NON-NEGOTIABLE):
 * - Social NÃO cria Order
 * - Social NÃO cria PaymentIntent
 * - Social NÃO toca Bank
 * - Social é apenas entrada/contexto
 * - Marketplace nunca depende do social
 * - Falha no social não quebra venda
 */
class SocialMarketplaceRefService {
  /**
   * Cria referência do marketplace no social
   * 
   * Valida:
   * - ref_id existe no marketplace
   * - tenant e actor corretos
   * 
   * NÃO executa transações
   */
  async createRef(
    tenantId: string,
    input: CreateSocialMarketplaceRefInput
  ): Promise<SocialMarketplaceRef> {
    // 1. Validar que ref_id existe no marketplace
    await this.validateRefExists(tenantId, input.refType, input.refId);

    // 2. Buscar detalhes para metadata
    const details = await this.getRefDetails(tenantId, input.refType, input.refId);

    // 3. Criar referência com metadata
    const metadata = {
      ...input.metadata,
      ...details,
    };

    return await socialMarketplaceRefRepository.createRef(tenantId, {
      ...input,
      metadata,
    });
  }

  /**
   * Busca referências por post
   */
  async getRefsByPost(
    tenantId: string,
    postId: string
  ): Promise<SocialMarketplaceRef[]> {
    return await socialMarketplaceRefRepository.getRefsByPost(tenantId, postId);
  }

  /**
   * Busca referência com detalhes do marketplace
   */
  async getRefWithDetails(
    tenantId: string,
    refId: string
  ): Promise<SocialMarketplaceRefWithDetails | null> {
    const ref = await socialMarketplaceRefRepository.getRefById(tenantId, refId);
    if (!ref) {
      return null;
    }

    const details = await this.getRefDetails(tenantId, ref.refType, ref.refId);

    return {
      ref,
      details: {
        type: ref.refType,
        id: ref.refId,
        name: details.name || 'Item do marketplace',
        status: details.status,
        link: details.link,
      },
    };
  }

  /**
   * Valida que ref_id existe no marketplace
   */
  private async validateRefExists(
    tenantId: string,
    refType: string,
    refId: string
  ): Promise<void> {
    if (refType === 'PRODUCT') {
      // Validar que product_variant existe
      const { productCatalogService } = await import('../marketplace/product-catalog.service');
      const variant = await productCatalogService.getVariantById(tenantId, refId);
      if (!variant) {
        throw new Error(`Variante não encontrada: ${refId}`);
      }
    } else if (refType === 'ORDER') {
      // Validar que order existe
      const { orderService } = await import('../marketplace/order.service');
      const order = await orderService.getOrderById(tenantId, refId);
      if (!order) {
        throw new Error(`Pedido não encontrado: ${refId}`);
      }
    } else if (refType === 'CAMPAIGN') {
      // Futuro: validar campanha
      // Por enquanto, apenas aceita
    } else {
      throw new Error(`Tipo de referência inválido: ${refType}`);
    }
  }

  /**
   * Busca detalhes da referência no marketplace
   */
  private async getRefDetails(
    tenantId: string,
    refType: string,
    refId: string
  ): Promise<{ name: string; status?: string; link: string }> {
    if (refType === 'PRODUCT') {
      // Buscar variante e produto
      const { productCatalogService } = await import('../marketplace/product-catalog.service');
      const variant = await productCatalogService.getVariantById(tenantId, refId);
      if (!variant) {
        throw new Error(`Variante não encontrada: ${refId}`);
      }
      const product = await productCatalogService.getProductById(tenantId, variant.productId);
      return {
        name: product?.name || variant.sku || 'Produto',
        status: variant.isActive ? 'active' : 'inactive',
        link: `/marketplace?tab=products&productId=${variant.productId}&variantId=${refId}`,
      };
    } else if (refType === 'ORDER') {
      // Buscar pedido
      const { orderService } = await import('../marketplace/order.service');
      const order = await orderService.getOrderById(tenantId, refId);
      if (!order) {
        throw new Error(`Pedido não encontrado: ${refId}`);
      }
      return {
        name: `Pedido #${refId.substring(0, 8)}`,
        status: order.status.toLowerCase(),
        link: `/marketplace?tab=orders&orderId=${refId}`,
      };
    } else if (refType === 'CAMPAIGN') {
      // Futuro: buscar campanha
      return {
        name: 'Campanha',
        link: `/marketplace?tab=campaigns&campaignId=${refId}`,
      };
    } else {
      throw new Error(`Tipo de referência inválido: ${refType}`);
    }
  }
}

export const socialMarketplaceRefService = new SocialMarketplaceRefService();







