// backend/src/modules/marketplace/marketplace-production.service.ts
// Módulo Production: lotes de produção e compromissos de compra

import type { MarketplaceService } from '../../marketplace.service';
import { marketplaceLogger } from '../../marketplace.logger';
import type { ProductionBatch, BatchCommitment, Order } from '@contracts/marketplace';

export class MarketplaceProductionModule {
  private readonly productionBatches: Map<string, ProductionBatch> = new Map();
  private readonly batchCommitments: BatchCommitment[] = [];

  constructor(private readonly facade: MarketplaceService) {}

  createProductionBatch(input: {
    industryId: string;
    productId: string;
    minQuantity: number;
    maxQuantity?: number;
    unitPrice: { amountCents: number; currency: string };
    commitDeadline: string;
    regionsAllowed: Array<{ country: string; state: string; city: string }>;
  }): ProductionBatch {
    const industry = this.facade.industry.getIndustryAccount(input.industryId);
    if (!industry) {
      throw new Error('Indústria não encontrada');
    }

    const canonicalProducts = this.facade.catalog.getCanonicalProducts();
    const product = canonicalProducts.products.find(p => p.id === input.productId);
    if (!product) {
      throw new Error('Produto canônico não encontrado');
    }

    if ((product as { product_type?: string }).product_type && (product as { product_type?: string }).product_type !== 'industrial') {
      throw new Error('Apenas produtos industriais podem ter lotes de produção');
    }

    const batchId = `batch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const batch: ProductionBatch = {
      batchId: batchId,
      industryId: input.industryId,
      productId: input.productId,
      minQuantity: input.minQuantity,
      maxQuantity: input.maxQuantity,
      unitPrice: input.unitPrice,
      commitDeadline: input.commitDeadline,
      regionsAllowed: input.regionsAllowed,
      status: 'open',
      totalCommittedQuantity: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.productionBatches.set(batchId, batch);

    marketplaceLogger.init('Lote de produção programado criado', {
      batchId: batchId,
      industryId: input.industryId,
      productId: input.productId,
      minQuantity: input.minQuantity,
    });

    return batch;
  }

  getOpenBatches(region: { country: string; state: string; city: string }): ProductionBatch[] {
    const now = new Date().toISOString();

    return Array.from(this.productionBatches.values())
      .filter(batch => {
        if (batch.status !== 'open') return false;
        if (batch.commitDeadline < now) return false;
        return batch.regionsAllowed.some(
          r =>
            r.country === region.country &&
            r.state === region.state &&
            r.city === region.city
        );
      })
      .sort((a, b) => a.commitDeadline.localeCompare(b.commitDeadline));
  }

  getProductionBatch(batchId: string): ProductionBatch | null {
    return this.productionBatches.get(batchId) || null;
  }

  commitToBatch(input: {
    batchId: string;
    actorId: string;
    actorType: 'user' | 'store' | 'hub';
    quantity: number;
  }): BatchCommitment {
    const batch = this.productionBatches.get(input.batchId);
    if (!batch) throw new Error('Lote não encontrado');
    if (batch.status !== 'open') throw new Error('Lote não está aberto para compromissos');

    const now = new Date().toISOString();
    if (batch.commitDeadline < now) throw new Error('Prazo para compromissos expirou');

    const currentTotal = batch.totalCommittedQuantity;
    if (batch.maxQuantity && currentTotal + input.quantity > batch.maxQuantity) {
      throw new Error(
        `Quantidade máxima do lote seria excedida. Disponível: ${batch.maxQuantity - currentTotal}`
      );
    }
    if (input.quantity <= 0) throw new Error('Quantidade deve ser maior que zero');

    const commitmentId = `commitment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const commitment: BatchCommitment = {
      commitmentId: commitmentId,
      batchId: input.batchId,
      actorId: input.actorId,
      actorType: input.actorType,
      quantity: input.quantity,
      createdAt: new Date().toISOString(),
      status: 'active',
    };

    this.batchCommitments.push(commitment);

    batch.totalCommittedQuantity += input.quantity;
    batch.updatedAt = new Date().toISOString();
    this.productionBatches.set(input.batchId, batch);

    marketplaceLogger.init('Compromisso de compra em lote criado', {
      commitmentId: commitmentId,
      batchId: input.batchId,
      actorId: input.actorId,
      quantity: input.quantity,
    });

    return commitment;
  }

  cancelCommitment(commitmentId: string): BatchCommitment {
    const commitment = this.batchCommitments.find(c => c.commitmentId === commitmentId);
    if (!commitment) throw new Error('Compromisso não encontrado');
    if (commitment.status !== 'active') {
      throw new Error('Compromisso não pode ser cancelado (já foi cancelado ou convertido)');
    }

    const batch = this.productionBatches.get(commitment.batchId);
    if (!batch) throw new Error('Lote não encontrado');

    const now = new Date().toISOString();
    if (batch.commitDeadline < now) {
      throw new Error('Prazo para cancelamento expirou (lote já foi avaliado)');
    }

    commitment.status = 'cancelled';
    commitment.cancelledAt = new Date().toISOString();

    batch.totalCommittedQuantity -= commitment.quantity;
    batch.updatedAt = new Date().toISOString();
    this.productionBatches.set(commitment.batchId, batch);

    marketplaceLogger.init('Compromisso de compra em lote cancelado', {
      commitmentId: commitmentId,
      batchId: commitment.batchId,
    });

    return commitment;
  }

  getBatchCommitments(batchId: string): BatchCommitment[] {
    return this.batchCommitments.filter(c => c.batchId === batchId);
  }

  getActorCommitments(actorId: string): BatchCommitment[] {
    return this.batchCommitments.filter(c => c.actorId === actorId && c.status === 'active');
  }

  evaluateBatchAtDeadline(batchId: string): ProductionBatch {
    const batch = this.productionBatches.get(batchId);
    if (!batch) throw new Error('Lote não encontrado');
    if (batch.status !== 'open') throw new Error('Lote já foi avaliado ou não está aberto');

    const now = new Date().toISOString();
    if (batch.commitDeadline >= now) throw new Error('Deadline ainda não passou');

    if (batch.totalCommittedQuantity < batch.minQuantity) {
      batch.status = 'expired';
      batch.closedAt = new Date().toISOString();
      batch.updatedAt = new Date().toISOString();
      this.productionBatches.set(batchId, batch);

      marketplaceLogger.init('Lote de produção expirado (quantidade mínima não atingida)', {
        batchId: batchId,
        minQuantity: batch.minQuantity,
        committedQuantity: batch.totalCommittedQuantity,
      });
    } else {
      batch.status = 'closed';
      batch.closedAt = new Date().toISOString();
      batch.updatedAt = new Date().toISOString();
      this.productionBatches.set(batchId, batch);

      marketplaceLogger.init('Lote de produção fechado (quantidade mínima atingida)', {
        batchId: batchId,
        minQuantity: batch.minQuantity,
        committedQuantity: batch.totalCommittedQuantity,
      });
    }

    return batch;
  }

  async convertBatchToOrders(batchId: string): Promise<Order[]> {
    const batch = this.productionBatches.get(batchId);
    if (!batch) throw new Error('Lote não encontrado');
    if (batch.status !== 'closed') {
      throw new Error('Lote deve estar fechado para ser convertido em orders');
    }

    const activeCommitments = this.batchCommitments.filter(
      c => c.batchId === batchId && c.status === 'active'
    );

    if (activeCommitments.length === 0) {
      throw new Error('Nenhum compromisso ativo encontrado para o lote');
    }

    const orders: Order[] = [];

    for (const commitment of activeCommitments) {
      let storeId: string;
      if (commitment.actorType === 'store') {
        storeId = commitment.actorId;
      } else if (commitment.actorType === 'hub') {
        storeId = commitment.actorId;
      } else {
        const storesData = this.facade.catalog.getStores();
        const firstStore = storesData.stores[0];
        if (!firstStore) {
          throw new Error('Nenhuma loja disponível para processar pedido de usuário');
        }
        storeId = firstStore.storeId;
      }

      const order = this.facade.orders.createOrder(storeId);
      const orderUpdated = await this.facade.orders.addOrderItem(order.orderId, batch.productId, commitment.quantity);

      commitment.status = 'converted';
      commitment.orderId = orderUpdated.orderId;

      orders.push(orderUpdated);

      marketplaceLogger.init('Compromisso convertido em Order', {
        commitmentId: commitment.commitmentId,
        orderId: orderUpdated.orderId,
        batchId: batchId,
      });
    }

    batch.status = 'executed';
    batch.updatedAt = new Date().toISOString();
    this.productionBatches.set(batchId, batch);

    const totalAmount = orders.reduce((sum, o) => {
      return sum + (o.items?.reduce((itemSum: number, item: { subtotal?: number }) => itemSum + (item.subtotal ?? 0), 0) ?? 0);
    }, 0);

    marketplaceLogger.init('Lote de produção convertido em Orders', {
      batchId: batchId,
      orders_count: orders.length,
      total_amount: totalAmount,
    });

    return orders;
  }

  getAllProductionBatches(): ProductionBatch[] {
    return Array.from(this.productionBatches.values()).sort((a, b) => {
      return b.createdAt.localeCompare(a.createdAt);
    });
  }
}