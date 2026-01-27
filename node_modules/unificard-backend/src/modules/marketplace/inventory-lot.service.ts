// backend/src/modules/marketplace/inventory-lot.service.ts
// SPRINT 37.4: MARKETPLACE CORE - Lote & Validade (Opt-In)
// Service para lotes de estoque

import { inventoryLotRepository } from './inventory-lot.repository';
import { productVariantRepository } from './product-variant.repository';
import type {
  InventoryLot,
  CreateInventoryLotInput,
} from './inventory.types';

/**
 * Service para lotes de estoque
 * 
 * ⚠️ REGRAS ARQUITETURAIS:
 * - Lote é OPT-IN (não obrigatório)
 * - Estoque sem lote continua funcionando
 * - Validade é informativa, não executiva
 * - Nenhuma decisão automática por validade
 * - Sem FIFO, FEFO ou lógica automática
 */
class InventoryLotService {
  /**
   * Cria lote
   */
  async createLot(
    tenantId: string,
    input: CreateInventoryLotInput
  ): Promise<InventoryLot> {
    // Verificar se variante existe
    const variant = await productVariantRepository.getVariantById(
      tenantId,
      input.productVariantId
    );

    if (!variant) {
      throw new Error(`Variante não encontrada: ${input.productVariantId}`);
    }

    // Verificar se código de lote já existe para esta variante
    const existing = await inventoryLotRepository.getLotByCode(
      tenantId,
      input.productVariantId,
      input.lotCode
    );

    if (existing) {
      throw new Error(
        `Lote com código "${input.lotCode}" já existe para esta variante`
      );
    }

    return await inventoryLotRepository.createLot(tenantId, input);
  }

  /**
   * Lista lotes de uma variante
   */
  async listLotsByVariant(
    tenantId: string,
    productVariantId: string
  ): Promise<InventoryLot[]> {
    // Verificar se variante existe
    const variant = await productVariantRepository.getVariantById(
      tenantId,
      productVariantId
    );

    if (!variant) {
      throw new Error(`Variante não encontrada: ${productVariantId}`);
    }

    return await inventoryLotRepository.listLotsByVariant(
      tenantId,
      productVariantId
    );
  }

  /**
   * Busca lote por código
   */
  async getLotByCode(
    tenantId: string,
    productVariantId: string,
    lotCode: string
  ): Promise<InventoryLot | null> {
    return await inventoryLotRepository.getLotByCode(
      tenantId,
      productVariantId,
      lotCode
    );
  }

  /**
   * Busca lote por ID
   */
  async getLotById(
    tenantId: string,
    lotId: string
  ): Promise<InventoryLot | null> {
    return await inventoryLotRepository.getLotById(tenantId, lotId);
  }
}

export const inventoryLotService = new InventoryLotService();







