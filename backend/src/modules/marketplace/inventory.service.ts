// backend/src/modules/marketplace/inventory.service.ts
// SPRINT 37.3: MARKETPLACE CORE - Estoque (Movimentação)
// Service para movimentações e saldos de estoque

import { inventoryMovementRepository } from './inventory-movement.repository';
import { assertInventoryUnitActorEligible } from './inventory-unit-actor';
import { inventoryBalanceRepository } from './inventory-balance.repository';
import { inventoryLotRepository } from './inventory-lot.repository';
import { productVariantRepository } from './product-variant.repository';
import type {
  InventoryMovement,
  CreateInventoryMovementInput,
  ListInventoryMovementsOptions,
  InventoryBalance,
} from './inventory.types';

/**
 * Service para estoque
 * 
 * ⚠️ REGRAS ARQUITETURAIS:
 * - Movimentações são APPEND-ONLY (sem UPDATE/DELETE)
 * - Saldo é SEMPRE derivado de movimentações
 * - Read model (inventory_balances) é opcional e pode ser recalculado
 * - Nenhuma validação "inteligente" (não impede estoque negativo)
 * - Nenhuma integração com venda/pedido/pagamento
 */
class InventoryService {
  /**
   * Adiciona movimentação de estoque
   * 
   * Validações básicas (não inteligentes):
   * - Variante existe
   * - IN e OUT sempre positivos
   * - ADJUSTMENT pode ser negativo
   * - Se lotId informado, lote deve pertencer à mesma variante (SPRINT 37.4)
   */
  async addMovement(
    tenantId: string,
    input: CreateInventoryMovementInput,
    createdByUserId?: string
  ): Promise<InventoryMovement> {
    if (!input.actorId?.trim()) {
      throw new Error('actorId (unidade de estoque) é obrigatório');
    }
    await assertInventoryUnitActorEligible(tenantId, input.actorId);

    // Verificar se variante existe
    const variant = await productVariantRepository.getVariantById(
      tenantId,
      input.productVariantId
    );

    if (!variant) {
      throw new Error(`Variante não encontrada: ${input.productVariantId}`);
    }

    // SPRINT 37.4: Validar lote se informado
    if (input.inventoryLotId) {
      const lot = await inventoryLotRepository.getLotById(
        tenantId,
        input.inventoryLotId
      );

      if (!lot) {
        throw new Error(`Lote não encontrado: ${input.inventoryLotId}`);
      }

      // Lote deve pertencer à mesma variante
      if (lot.productVariantId !== input.productVariantId) {
        throw new Error(
          `Lote pertence a outra variante. Lote: ${lot.productVariantId}, Movimento: ${input.productVariantId}`
        );
      }
    }

    // Validações básicas de quantidade
    if (input.movementType === 'IN' || input.movementType === 'OUT') {
      if (input.quantity <= 0) {
        throw new Error(
          `Movimentação ${input.movementType} deve ter quantidade positiva`
        );
      }
    }
    // ADJUSTMENT pode ser negativo (não validamos)

    // Criar movimentação
    const movement = await inventoryMovementRepository.createMovement(
      tenantId,
      {
        ...input,
        createdByUserId: createdByUserId || input.createdByUserId,
      }
    );

    // Atualizar read model (opcional, para performance)
    // Se falhar, não bloqueia (saldo pode ser recalculado)
    try {
      const balance = await this.getCurrentBalance(
        tenantId,
        input.productVariantId
      );
      await inventoryBalanceRepository.upsertBalance(
        tenantId,
        input.productVariantId,
        balance.quantity,
        balance.unit
      );
    } catch (error) {
      // Não bloquear se atualização do read model falhar
      console.warn(
        '[Inventory] Erro ao atualizar read model (não bloqueante):',
        error
      );
    }

    return movement;
  }

  /**
   * Lista movimentações de uma variante
   */
  async getMovements(
    tenantId: string,
    productVariantId: string,
    options: ListInventoryMovementsOptions = {}
  ): Promise<InventoryMovement[]> {
    // Verificar se variante existe
    const variant = await productVariantRepository.getVariantById(
      tenantId,
      productVariantId
    );

    if (!variant) {
      throw new Error(`Variante não encontrada: ${productVariantId}`);
    }

    return await inventoryMovementRepository.getMovementsByVariant(
      tenantId,
      productVariantId,
      options
    );
  }

  /**
   * Obtém saldo atual de uma variante (DERIVADO de movimentações)
   * 
   * ⚠️ Fonte da verdade: inventory_movements
   * Read model (inventory_balances) é apenas cache opcional
   */
  async getCurrentBalance(
    tenantId: string,
    productVariantId: string
  ): Promise<{ quantity: number; unit: string }> {
    // Verificar se variante existe
    const variant = await productVariantRepository.getVariantById(
      tenantId,
      productVariantId
    );

    if (!variant) {
      throw new Error(`Variante não encontrada: ${productVariantId}`);
    }

    // Calcular saldo das movimentações (fonte da verdade)
    return await inventoryMovementRepository.calculateBalance(
      tenantId,
      productVariantId
    );
  }

  /**
   * Obtém saldo do read model (opcional, para performance)
   * Se não existir, calcula das movimentações
   */
  async getBalanceFromReadModel(
    tenantId: string,
    productVariantId: string
  ): Promise<InventoryBalance | null> {
    return await inventoryBalanceRepository.getBalance(
      tenantId,
      productVariantId
    );
  }

  /**
   * Recalcula e atualiza read model (opcional)
   * Útil para sincronizar read model com movimentações
   */
  async recalculateBalance(
    tenantId: string,
    productVariantId: string
  ): Promise<InventoryBalance> {
    // Calcular saldo das movimentações (fonte da verdade)
    const balance = await this.getCurrentBalance(tenantId, productVariantId);

    // Atualizar read model
    return await inventoryBalanceRepository.upsertBalance(
      tenantId,
      productVariantId,
      balance.quantity,
      balance.unit
    );
  }
}

export const inventoryService = new InventoryService();

