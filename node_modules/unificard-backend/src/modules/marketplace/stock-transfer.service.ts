// backend/src/modules/marketplace/stock-transfer.service.ts
// SPRINT 55: TRANSFERÊNCIA DE ESTOQUE ENTRE FILIAIS

import { stockTransferRepository } from './stock-transfer.repository';
import { inventoryService } from './inventory.service';
import type {
  StockTransfer,
  StockTransferItem,
  CreateStockTransferInput,
  AddStockTransferItemInput,
  ShipStockTransferInput,
  ReceiveStockTransferInput,
} from './stock-transfer.types';

/**
 * Service para transferências de estoque entre filiais
 * 
 * ⚠️ REGRAS ARQUITETURAIS:
 * - NÃO usa Order, Payment ou Fiscal
 * - Inventory_movements são a única fonte da verdade
 * - Estoque sai no SHIP, entra no RECEIVE
 * - Tudo explícito, auditável, reversível
 */
class StockTransferService {
  /**
   * Cria transferência de estoque
   * 
   * Status inicial: DRAFT
   */
  async createTransfer(
    tenantId: string,
    input: CreateStockTransferInput
  ): Promise<StockTransfer> {
    // Validar que origem e destino são diferentes
    if (input.fromActorId === input.toActorId) {
      throw new Error('Origem e destino devem ser diferentes');
    }

    return await stockTransferRepository.createTransfer(tenantId, input);
  }

  /**
   * Adiciona item à transferência
   * 
   * Só pode adicionar se status = DRAFT
   */
  async addItem(
    tenantId: string,
    transferId: string,
    input: AddStockTransferItemInput
  ): Promise<StockTransferItem> {
    // 1. Buscar transferência
    const transfer = await stockTransferRepository.getTransferById(tenantId, transferId);
    if (!transfer) {
      throw new Error(`Transferência não encontrada: ${transferId}`);
    }

    if (transfer.status !== 'DRAFT') {
      throw new Error(`Não é possível adicionar itens a uma transferência com status ${transfer.status}`);
    }

    // 2. Criar item
    return await stockTransferRepository.createTransferItem(tenantId, transferId, input);
  }

  /**
   * Envia transferência (SHIP)
   * 
   * ⚠️ REGRA: Gera inventory_movements OUT no from_actor
   */
  async shipTransfer(
    tenantId: string,
    transferId: string,
    input: ShipStockTransferInput = {}
  ): Promise<StockTransfer> {
    // 1. Buscar transferência
    const transfer = await stockTransferRepository.getTransferById(tenantId, transferId);
    if (!transfer) {
      throw new Error(`Transferência não encontrada: ${transferId}`);
    }

    if (transfer.status !== 'DRAFT') {
      throw new Error(`Transferência não está em DRAFT. Status atual: ${transfer.status}`);
    }

    // 2. Buscar itens
    const items = await stockTransferRepository.listTransferItems(tenantId, transferId);
    if (items.length === 0) {
      throw new Error('Transferência não tem itens');
    }

    // 3. Gerar inventory_movements OUT para cada item (no from_actor)
    // SPRINT 55: Buscar unit do produto para o movement
    const { productRepository } = await import('./product.repository');
    const { productVariantRepository } = await import('./product-variant.repository');
    
    for (const item of items) {
      // Buscar variante e produto para obter unit
      const variant = await productVariantRepository.getVariantById(tenantId, item.productVariantId);
      if (!variant) {
        throw new Error(`Variante não encontrada: ${item.productVariantId}`);
      }

      const product = await productRepository.getProductById(tenantId, variant.productId);
      if (!product) {
        throw new Error(`Produto não encontrado: ${variant.productId}`);
      }

      // Unit vem do produto (ou metadata da variante)
      const unit = product.metadata?.unit || variant.metadata?.unit || 'un';

      await inventoryService.addMovement(tenantId, {
        productVariantId: item.productVariantId,
        movementType: 'OUT',
        quantity: item.quantity,
        unit,
        reason: 'STOCK_TRANSFER_SHIPPED',
        referenceType: 'stock_transfer',
        referenceId: transferId,
        inventoryLotId: item.inventoryLotId || null,
        metadata: {
          stock_transfer_id: transferId,
          stock_transfer_item_id: item.id,
          from_actor_id: transfer.fromActorId,
          to_actor_id: transfer.toActorId,
          inventory_lot_id: item.inventoryLotId || null,
        },
      });

      // Atualizar status do item para SHIPPED
      await stockTransferRepository.updateTransferItemStatus(
        tenantId,
        item.id,
        'SHIPPED'
      );
    }

    // 4. Atualizar status da transferência para SHIPPED
    const shippedTransfer = await stockTransferRepository.updateTransferStatus(
      tenantId,
      transferId,
      'SHIPPED',
      new Date()
    );

    return shippedTransfer;
  }

  /**
   * Recebe transferência (RECEIVE)
   * 
   * SPRINT 56: Agora exige conferência (receipt)
   * 
   * ⚠️ DEPRECATED: Use stockTransferReceiptService.startReceipt() e finalizeReceipt()
   * Mantido para compatibilidade, mas agora apenas inicia a conferência
   */
  async receiveTransfer(
    tenantId: string,
    transferId: string,
    input: ReceiveStockTransferInput = {}
  ): Promise<StockTransfer> {
    // SPRINT 56: Agora recebimento exige conferência
    // Este método apenas inicia a conferência (muda para RECEIVING)
    // O recebimento real só acontece após finalizar a conferência

    // 1. Buscar transferência
    const transfer = await stockTransferRepository.getTransferById(tenantId, transferId);
    if (!transfer) {
      throw new Error(`Transferência não encontrada: ${transferId}`);
    }

    if (transfer.status !== 'SHIPPED') {
      throw new Error(`Transferência não está em SHIPPED. Status atual: ${transfer.status}`);
    }

    // 2. Buscar itens
    const items = await stockTransferRepository.listTransferItems(tenantId, transferId);
    if (items.length === 0) {
      throw new Error('Transferência não tem itens');
    }

    // 3. Validar que todos os itens estão SHIPPED
    const notShipped = items.filter((item) => item.status !== 'SHIPPED');
    if (notShipped.length > 0) {
      throw new Error(
        `Não é possível receber transferência: ${notShipped.length} item(ns) ainda não foram enviados (SHIPPED)`
      );
    }

    // SPRINT 56: Mudar status para RECEIVING (conferência deve ser iniciada via receipt service)
    const receivingTransfer = await stockTransferRepository.updateTransferStatus(
      tenantId,
      transferId,
      'RECEIVING'
    );

    return receivingTransfer;
  }

  /**
   * Cancela transferência
   * 
   * Só pode cancelar se status = DRAFT
   */
  async cancelTransfer(
    tenantId: string,
    transferId: string
  ): Promise<StockTransfer> {
    // 1. Buscar transferência
    const transfer = await stockTransferRepository.getTransferById(tenantId, transferId);
    if (!transfer) {
      throw new Error(`Transferência não encontrada: ${transferId}`);
    }

    if (transfer.status === 'SHIPPED' || transfer.status === 'RECEIVED') {
      throw new Error(
        `Não é possível cancelar transferência com status ${transfer.status}. Apenas DRAFT pode ser cancelado.`
      );
    }

    if (transfer.status === 'CANCELLED') {
      // Já está cancelado, retornar
      return transfer;
    }

    // 2. Atualizar status para CANCELLED
    const cancelledTransfer = await stockTransferRepository.updateTransferStatus(
      tenantId,
      transferId,
      'CANCELLED'
    );

    return cancelledTransfer;
  }

  /**
   * Busca transferência por ID
   */
  async getTransferById(
    tenantId: string,
    transferId: string
  ): Promise<StockTransfer | null> {
    return await stockTransferRepository.getTransferById(tenantId, transferId);
  }

  /**
   * Lista transferências por origem
   */
  async listTransfersByFromActor(
    tenantId: string,
    fromActorId: string,
    limit: number = 50
  ): Promise<StockTransfer[]> {
    return await stockTransferRepository.listTransfersByFromActor(tenantId, fromActorId, limit);
  }

  /**
   * Lista transferências por destino
   */
  async listTransfersByToActor(
    tenantId: string,
    toActorId: string,
    limit: number = 50
  ): Promise<StockTransfer[]> {
    return await stockTransferRepository.listTransfersByToActor(tenantId, toActorId, limit);
  }

  /**
   * Lista itens de transferência
   */
  async listTransferItems(
    tenantId: string,
    transferId: string
  ): Promise<StockTransferItem[]> {
    return await stockTransferRepository.listTransferItems(tenantId, transferId);
  }
}

export const stockTransferService = new StockTransferService();

