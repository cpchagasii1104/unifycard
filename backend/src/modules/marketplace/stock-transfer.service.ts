// backend/src/modules/marketplace/stock-transfer.service.ts
// SPRINT 55: TRANSFERÊNCIA DE ESTOQUE ENTRE FILIAIS

import { getClientWithTenant } from '@core/database/pool';
import { stockTransferRepository } from './stock-transfer.repository';
import { inventoryMovementRepository } from './inventory-movement.repository';
import { assertInventoryUnitActorEligible } from './inventory-unit-actor';
import { inventoryService } from './inventory.service';
import { stockTransferReceiptService } from './stock-transfer-receipt.service';
import { marketplaceLogger } from './marketplace.logger';
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

    if (transfer.status !== 'draft') {
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
    _input: ShipStockTransferInput = {}
  ): Promise<StockTransfer> {
    const { productRepository } = await import('./product.repository');
    const { productVariantRepository } = await import('./product-variant.repository');

    const client = await getClientWithTenant(tenantId);

    try {
      await client.query('BEGIN');

      const transfer = await stockTransferRepository.getTransferByIdForUpdateWithClient(
        client,
        transferId
      );
      if (!transfer) {
        throw new Error(`Transferência não encontrada: ${transferId}`);
      }

      // Idempotente: mesmo pedido repetido após sucesso (alinhado a shipFulfillment).
      if (transfer.status === 'shipped') {
        await client.query('COMMIT');
        return transfer;
      }

      if (transfer.status !== 'draft') {
        throw new Error(
          `Transferência não está em DRAFT. Status atual: ${transfer.status}`
        );
      }

      const items = await stockTransferRepository.listTransferItemsWithClient(
        client,
        transferId
      );
      if (items.length === 0) {
        throw new Error('Transferência não tem itens');
      }

      await assertInventoryUnitActorEligible(tenantId, transfer.fromActorId);

      for (const item of items) {
        const variant = await productVariantRepository.getVariantById(
          tenantId,
          item.productVariantId
        );
        if (!variant) {
          throw new Error(`Variante não encontrada: ${item.productVariantId}`);
        }

        const product = await productRepository.getProductById(tenantId, variant.productId);
        if (!product) {
          throw new Error(`Produto não encontrado: ${variant.productId}`);
        }

        const unit = product.metadata?.unit || variant.metadata?.unit || 'un';

        await inventoryMovementRepository.createMovementWithClient(client, {
          actorId: transfer.fromActorId,
          productVariantId: item.productVariantId,
          movementType: 'out',
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
      }

      const shippedTransfer = await stockTransferRepository.updateTransferStatusWithClient(
        client,
        transferId,
        'shipped',
        new Date()
      );

      await client.query('COMMIT');

      const variantIds = [...new Set(items.map((i) => i.productVariantId))];
      for (const vid of variantIds) {
        try {
          await inventoryService.recalculateBalance(tenantId, vid);
        } catch (recalcErr) {
          console.warn(`[StockTransferService] recalculateBalance ${vid}:`, recalcErr);
        }
      }

      return shippedTransfer;
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * @deprecated Delega para {@link stockTransferReceiptService.startReceipt} (fluxo canónico).
   * Passo seguinte: receiveItem / finalizeReceipt no receipt service.
   *
   * Exige `receivedByUserId` (ou `metadata.receivedByUserId`) para criar o receipt.
   */
  async receiveTransfer(
    tenantId: string,
    transferId: string,
    input: ReceiveStockTransferInput = {}
  ): Promise<StockTransfer> {
    // Prioridade explícita: campo dedicado > metadata (evita ambiguidade silenciosa).
    const fromMetadata =
      typeof input.metadata?.receivedByUserId === 'string' ? input.metadata.receivedByUserId : undefined;
    if (
      input.receivedByUserId &&
      fromMetadata &&
      input.receivedByUserId !== fromMetadata
    ) {
      marketplaceLogger.warn('receiveTransfer: receivedByUserId duplicado e divergente — usa-se o campo dedicado', {
        transferId,
        used: 'receivedByUserId',
        ignoredMetadata: fromMetadata,
      });
    }
    const receivedByUserId = input.receivedByUserId ?? fromMetadata;

    if (!receivedByUserId) {
      throw new Error(
        'receiveTransfer: informe receivedByUserId (ou metadata.receivedByUserId). Fluxo canónico: stockTransferReceiptService.startReceipt → finalizeReceipt.'
      );
    }

    marketplaceLogger.warn('deprecated_api: use stockTransferReceiptService.startReceipt', {
      method: 'stockTransferService.receiveTransfer',
      replacement: 'stockTransferReceiptService.startReceipt',
      transferId,
    });

    await stockTransferReceiptService.startReceipt(tenantId, transferId, {
      receivedByUserId,
      notes: input.notes,
      metadata: input.metadata,
    });

    const updated = await stockTransferRepository.getTransferById(tenantId, transferId);
    if (!updated) {
      throw new Error(`Transferência não encontrada após iniciar conferência: ${transferId}`);
    }
    return updated;
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

    if (transfer.status === 'shipped' || transfer.status === 'received') {
      throw new Error(
        `Não é possível cancelar transferência com status ${transfer.status}.`
      );
    }

    if (transfer.status === 'cancelled') {
      return transfer;
    }

    // DRAFT ou PENDING (conferência não finalizada)
    const cancelledTransfer = await stockTransferRepository.updateTransferStatus(
      tenantId,
      transferId,
      'cancelled'
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

