// backend/src/modules/marketplace/stock-transfer-receipt.service.ts
// SPRINT 56: RECEBIMENTO COM CONFERÊNCIA E DIVERGÊNCIA

import { stockTransferReceiptRepository } from './stock-transfer-receipt.repository';
import { stockTransferRepository } from './stock-transfer.repository';
import { inventoryService } from './inventory.service';
import type {
  StockTransferReceipt,
  StockTransferReceiptItem,
  StartReceiptInput,
  ReceiveItemInput,
  FinalizeReceiptInput,
} from './stock-transfer-receipt.types';

/**
 * Service para conferência de recebimento de transferências
 * 
 * ⚠️ REGRAS ARQUITETURAIS:
 * - Divergência é informativa e auditável
 * - NÃO ajusta estoque automaticamente
 * - Decisão humana vem depois
 * - Inventory_movements IN só são gerados no finalize
 * - Apenas received_quantity entra em estoque
 */
class StockTransferReceiptService {
  /**
   * Inicia conferência de recebimento
   * 
   * Cria receipt e muda transferência para PENDING (conferência).
   */
  async startReceipt(
    tenantId: string,
    stockTransferId: string,
    input: StartReceiptInput
  ): Promise<StockTransferReceipt> {
    // 1. Buscar transferência
    const transfer = await stockTransferRepository.getTransferById(tenantId, stockTransferId);
    if (!transfer) {
      throw new Error(`Transferência não encontrada: ${stockTransferId}`);
    }

    if (transfer.status !== 'SHIPPED') {
      throw new Error(`Transferência não está em SHIPPED. Status atual: ${transfer.status}`);
    }

    // 2. Verificar se já existe receipt para esta transferência
    const existing = await stockTransferReceiptRepository.getReceiptByTransferId(
      tenantId,
      stockTransferId
    );

    if (existing && (existing.status === 'IN_PROGRESS' || existing.status === 'COMPLETED')) {
      return existing;
    }

    // 3. Criar receipt
    const receipt = await stockTransferReceiptRepository.createReceipt(
      tenantId,
      stockTransferId,
      input
    );

    // 4. Conferência em curso — PENDING no enum stock_transfer_status
    await stockTransferRepository.updateTransferStatus(tenantId, stockTransferId, 'PENDING');

    return receipt;
  }

  /**
   * Registra recebimento de um item (conferência)
   * 
   * SPRINT 56: Compara quantidade esperada vs recebida
   */
  async receiveItem(
    tenantId: string,
    receiptId: string,
    input: ReceiveItemInput
  ): Promise<StockTransferReceiptItem> {
    // 1. Buscar receipt
    const receipt = await stockTransferReceiptRepository.getReceiptById(tenantId, receiptId);
    if (!receipt) {
      throw new Error(`Receipt não encontrado: ${receiptId}`);
    }

    if (receipt.status !== 'IN_PROGRESS') {
      throw new Error(`Receipt não está em IN_PROGRESS. Status atual: ${receipt.status}`);
    }

    // 2. Buscar item da transferência para obter quantidade esperada
    const transferItems = await stockTransferRepository.listTransferItems(
      tenantId,
      receipt.stockTransferId
    );

    const transferItem = transferItems.find((item) => item.id === input.stockTransferItemId);
    if (!transferItem) {
      throw new Error(`Item de transferência não encontrado: ${input.stockTransferItemId}`);
    }

    // 3. Verificar se item já foi conferido
    const existing = await stockTransferReceiptRepository.getReceiptItemByTransferItemId(
      tenantId,
      receiptId,
      input.stockTransferItemId
    );

    if (existing) {
      throw new Error(`Item já foi conferido: ${input.stockTransferItemId}`);
    }

    // 4. Criar item de receipt (conferência)
    const receiptItem = await stockTransferReceiptRepository.createReceiptItem(
      tenantId,
      receiptId,
      input.stockTransferItemId,
      transferItem.quantity, // expected_quantity
      input
    );

    return receiptItem;
  }

  /**
   * Finaliza conferência e gera inventory_movements IN
   * 
   * SPRINT 56: Apenas received_quantity entra em estoque
   */
  async finalizeReceipt(
    tenantId: string,
    receiptId: string,
    input: FinalizeReceiptInput = {}
  ): Promise<StockTransferReceipt> {
    // 1. Buscar receipt
    const receipt = await stockTransferReceiptRepository.getReceiptById(tenantId, receiptId);
    if (!receipt) {
      throw new Error(`Receipt não encontrado: ${receiptId}`);
    }

    if (receipt.status !== 'IN_PROGRESS') {
      throw new Error(`Receipt não está em IN_PROGRESS. Status atual: ${receipt.status}`);
    }

    // 2. Buscar transferência
    const transfer = await stockTransferRepository.getTransferById(
      tenantId,
      receipt.stockTransferId
    );
    if (!transfer) {
      throw new Error(`Transferência não encontrada: ${receipt.stockTransferId}`);
    }

    // 3. Buscar itens conferidos
    const receiptItems = await stockTransferReceiptRepository.listReceiptItems(tenantId, receiptId);
    if (receiptItems.length === 0) {
      throw new Error('Receipt não tem itens conferidos');
    }

    // 4. Buscar itens da transferência para obter unit
    const { productRepository } = await import('./product.repository');
    const { productVariantRepository } = await import('./product-variant.repository');

    // 5. Determinar resultado da conferência (lógica interna → mapear para receipt_status)
    type InternalReceiptOutcome = 'COMPLETE' | 'PARTIAL' | 'REJECTED';
    let finalOutcome: InternalReceiptOutcome = 'COMPLETE';

    for (const receiptItem of receiptItems) {
      if (receiptItem.receivedQuantity !== receiptItem.expectedQuantity) {
        if (receiptItem.receivedQuantity === 0) {
          // Se algum item foi totalmente rejeitado, status pode ser PARTIAL ou REJECTED
          // Por enquanto, marcamos como PARTIAL se pelo menos um item foi recebido
          const hasAnyReceived = receiptItems.some((item) => item.receivedQuantity > 0);
          if (!hasAnyReceived) {
            finalOutcome = 'REJECTED';
          } else {
            finalOutcome = 'PARTIAL';
          }
        } else {
          finalOutcome = 'PARTIAL';
        }
      }
    }

    // 6. Gerar inventory_movements IN apenas para received_quantity > 0
    for (const receiptItem of receiptItems) {
      if (receiptItem.receivedQuantity > 0) {
        // Buscar item da transferência
        const { stockTransferRepository } = await import('./stock-transfer.repository');
        const transferItem = await stockTransferRepository.getTransferItemById(
          tenantId,
          receiptItem.stockTransferItemId
        );
        if (!transferItem) {
          throw new Error(`Item de transferência não encontrado: ${receiptItem.stockTransferItemId}`);
        }

        const variant = await productVariantRepository.getVariantById(
          tenantId,
          transferItem.productVariantId
        );
        if (!variant) {
          throw new Error(`Variante não encontrada: ${transferItem.productVariantId}`);
        }

        const product = await productRepository.getProductById(tenantId, variant.productId);
        if (!product) {
          throw new Error(`Produto não encontrado: ${variant.productId}`);
        }

        // Unit vem do produto (ou metadata da variante)
        const unit = product.metadata?.unit || variant.metadata?.unit || 'un';

        // SPRINT 56: Gerar movement apenas com received_quantity
        await inventoryService.addMovement(tenantId, {
          actorId: transfer.toActorId,
          productVariantId: transferItem.productVariantId,
          movementType: 'IN',
          quantity: receiptItem.receivedQuantity, // Apenas quantidade recebida
          unit,
          reason: 'STOCK_TRANSFER_RECEIVED',
          referenceType: 'stock_transfer',
          referenceId: transfer.id,
          inventoryLotId: receiptItem.inventoryLotId || null,
          metadata: {
            stock_transfer_id: transfer.id,
            stock_transfer_item_id: transferItem.id,
            receipt_id: receiptId,
            receipt_item_id: receiptItem.id,
            from_actor_id: transfer.fromActorId,
            to_actor_id: transfer.toActorId,
            expected_quantity: receiptItem.expectedQuantity,
            received_quantity: receiptItem.receivedQuantity,
            discrepancy: receiptItem.receivedQuantity !== receiptItem.expectedQuantity,
            discrepancy_reason: receiptItem.discrepancyReason || null,
            inventory_lot_id: receiptItem.inventoryLotId || null,
          },
        });

      }
    }

    const receiptDbStatus: StockTransferReceipt['status'] =
      finalOutcome === 'REJECTED' ? 'CANCELLED' : 'COMPLETED';

    // 7. Atualizar status do receipt
    const finalizedReceipt = await stockTransferReceiptRepository.updateReceiptStatus(
      tenantId,
      receiptId,
      receiptDbStatus,
      input.notes
    );

    // 8. Transferência RECEIVED só quando houve recebimento aceite (não cancelado)
    if (finalOutcome === 'COMPLETE' || finalOutcome === 'PARTIAL') {
      await stockTransferRepository.updateTransferStatus(
        tenantId,
        transfer.id,
        'RECEIVED',
        undefined,
        new Date()
      );
    }

    return finalizedReceipt;
  }

  /**
   * Busca receipt por ID
   */
  async getReceiptById(
    tenantId: string,
    receiptId: string
  ): Promise<StockTransferReceipt | null> {
    return await stockTransferReceiptRepository.getReceiptById(tenantId, receiptId);
  }

  /**
   * Busca receipt por transferência
   */
  async getReceiptByTransferId(
    tenantId: string,
    stockTransferId: string
  ): Promise<StockTransferReceipt | null> {
    return await stockTransferReceiptRepository.getReceiptByTransferId(tenantId, stockTransferId);
  }

  /**
   * Lista itens de receipt
   */
  async listReceiptItems(
    tenantId: string,
    receiptId: string
  ): Promise<StockTransferReceiptItem[]> {
    return await stockTransferReceiptRepository.listReceiptItems(tenantId, receiptId);
  }
}

export const stockTransferReceiptService = new StockTransferReceiptService();

