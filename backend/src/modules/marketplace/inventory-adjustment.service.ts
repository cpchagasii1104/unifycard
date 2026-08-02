// backend/src/modules/marketplace/inventory-adjustment.service.ts
// SPRINT 57: AJUSTES DE ESTOQUE (AVARIA, PERDA, SOBRA)

import { inventoryAdjustmentRepository } from './inventory-adjustment.repository';
import { inventoryService } from './inventory.service';
import { productVariantRepository } from './product-variant.repository';
import { productRepository } from './product.repository';
import type {
  InventoryAdjustment,
  CreateInventoryAdjustmentInput,
  ListInventoryAdjustmentsOptions,
} from './inventory-adjustment.types';

/**
 * Service para ajustes de estoque
 * 
 * ⚠️ REGRAS ARQUITETURAIS:
 * - Ajuste é explícito e humano
 * - Ajuste gera inventory_movement ADJUSTMENT
 * - Ajuste nunca apaga nem corrige movimento anterior
 * - NÃO automatiza após conferência
 * - NÃO compensa automaticamente
 * - Tudo auditável
 */
class InventoryAdjustmentService {
  /**
   * Cria ajuste de estoque
   * 
   * SPRINT 57: Gera inventory_movement ADJUSTMENT automaticamente
   */
  async createAdjustment(
    tenantId: string,
    input: CreateInventoryAdjustmentInput,
    createdByUserId: string
  ): Promise<InventoryAdjustment> {
    // 1. Validar variante existe
    const variant = await productVariantRepository.getVariantById(
      tenantId,
      input.productVariantId
    );
    if (!variant) {
      throw new Error(`Variante não encontrada: ${input.productVariantId}`);
    }

    // 2. Validar lote se informado
    if (input.inventoryLotId) {
      const { inventoryLotRepository } = await import('./inventory-lot.repository');
      const lot = await inventoryLotRepository.getLotById(tenantId, input.inventoryLotId);
      if (!lot) {
        throw new Error(`Lote não encontrado: ${input.inventoryLotId}`);
      }
      if (lot.productVariantId !== input.productVariantId) {
        throw new Error(
          `Lote pertence a outra variante. Lote: ${lot.productVariantId}, Ajuste: ${input.productVariantId}`
        );
      }
    }

    // 3. Validar quantidade baseado no tipo
    if (input.adjustmentType === 'LOSS' || input.adjustmentType === 'DAMAGE') {
      if (input.quantity >= 0) {
        throw new Error(
          `Ajuste do tipo ${input.adjustmentType} deve ter quantidade negativa`
        );
      }
    } else if (input.adjustmentType === 'SURPLUS') {
      if (input.quantity <= 0) {
        throw new Error('Ajuste do tipo SURPLUS deve ter quantidade positiva');
      }
    }

    // 4. Criar ajuste
    const adjustment = await inventoryAdjustmentRepository.createAdjustment(
      tenantId,
      input,
      createdByUserId
    );

    // 5. Gerar inventory_movement ADJUSTMENT
    // SPRINT 57: Movement é gerado automaticamente quando ajuste é criado
    const product = await productRepository.getProductById(tenantId, variant.productId);
    if (!product) {
      throw new Error(`Produto não encontrado: ${variant.productId}`);
    }

    // Unit vem do produto (ou metadata da variante)
    const unit = product.metadata?.unit || variant.metadata?.unit || 'un';

    await inventoryService.addMovement(tenantId, {
      actorId: input.actorId,
      productVariantId: input.productVariantId,
      movementType: 'adjustment',
      quantity: input.quantity, // Signed: negativo para LOSS/DAMAGE, positivo para SURPLUS
      unit,
      reason: `AJUSTE_${input.adjustmentType}: ${input.reason}`,
      referenceType: 'inventory_adjustment',
      referenceId: adjustment.id,
      inventoryLotId: input.inventoryLotId || null,
      metadata: {
        adjustment_id: adjustment.id,
        adjustment_type: input.adjustmentType,
        actor_id: input.actorId,
        reason: input.reason,
        reference_type: input.referenceType || null,
        reference_id: input.referenceId || null,
        inventory_lot_id: input.inventoryLotId || null,
      },
      createdByUserId,
    });

    return adjustment;
  }

  /**
   * Lista ajustes
   */
  async listAdjustments(
    tenantId: string,
    options: ListInventoryAdjustmentsOptions = {}
  ): Promise<InventoryAdjustment[]> {
    return await inventoryAdjustmentRepository.listAdjustments(tenantId, options);
  }

  /**
   * Busca ajuste por ID
   */
  async getAdjustmentById(
    tenantId: string,
    adjustmentId: string
  ): Promise<InventoryAdjustment | null> {
    return await inventoryAdjustmentRepository.getAdjustmentById(tenantId, adjustmentId);
  }

  /**
   * Lista ajustes por referência (ex: stock_transfer_receipt)
   */
  async listAdjustmentsByReference(
    tenantId: string,
    referenceType: 'RECEIPT' | 'MANUAL',
    referenceId: string
  ): Promise<InventoryAdjustment[]> {
    return await inventoryAdjustmentRepository.listAdjustments(tenantId, {
      referenceType,
      referenceId,
    });
  }
}

export const inventoryAdjustmentService = new InventoryAdjustmentService();







