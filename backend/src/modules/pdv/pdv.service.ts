// backend/src/modules/pdv/pdv.service.ts
// SPRINT 42.1: PDV CORE - Service para PDV
// PDV é apenas um canal de entrada para o marketplace

import { pdvSessionRepository } from './pdv.repository';
import { assertPdvFinancialRuntimeEnabled } from './pdv-financial-firewall';
import { orderService } from '../marketplace/order.service';
import type { PaymentCurrency } from '../marketplace/payment-intent.types';
import type {
  CreatePdvSessionInput,
  ClosePdvSessionInput,
  CreateOrderFromPdvInput,
  AddItemByVariantInput,
  AddItemByWeightInput,
  PayOrderFromPdvInput,
  PdvSessionSummary,
} from './pdv.types';
import { integerCentsFromDbWire } from '@modules/bank/integer-cents-from-db';

function toPaymentCurrency(value: string): PaymentCurrency {
  if (value === 'BRL' || value === 'USD' || value === 'EUR' || value === 'TEST') {
    return value;
  }
  return 'BRL';
}

/**
 * Service para PDV
 * 
 * ⚠️ REGRAS ARQUITETURAIS:
 * - PDV SEMPRE cria Order no marketplace
 * - PDV não cria pagamento automaticamente
 * - PDV não reduz estoque automaticamente
 * - WEIGHT só aceita variantes WEIGHT
 * - Nenhuma lógica financeira aqui
 */
class PdvService {
  /**
   * Abre sessão PDV
   */
  async openSession(
    tenantId: string,
    input: CreatePdvSessionInput
  ) {
    // Verificar se já existe sessão aberta para este actor
    const existing = await pdvSessionRepository.getOpenSessionByActor(
      tenantId,
      input.actorId
    );

    if (existing) {
      throw new Error('Já existe uma sessão PDV aberta para este operador');
    }

    return await pdvSessionRepository.createSession(tenantId, input);
  }

  /**
   * Fecha sessão PDV
   */
  async closeSession(
    tenantId: string,
    sessionId: string,
    input: ClosePdvSessionInput = {}
  ) {
    return await pdvSessionRepository.closeSession(tenantId, sessionId, input);
  }

  /**
   * Busca sessão por ID
   */
  async getSessionById(tenantId: string, sessionId: string) {
    const session = await pdvSessionRepository.getSessionById(tenantId, sessionId);
    if (!session) {
      throw new Error(`Sessão PDV não encontrada: ${sessionId}`);
    }
    return session;
  }

  /**
   * Busca sessão por ID sem lançar (null se ausente).
   * PDV-F2B: usado pelas rotas para resolver o operador (session.actorId) e provar
   * representabilidade ANTES da ação, distinguindo 404 (ausente) de 403 (sem autoridade).
   */
  async findSessionById(tenantId: string, sessionId: string) {
    return await pdvSessionRepository.getSessionById(tenantId, sessionId);
  }

  /**
   * Busca sessão aberta por actor
   */
  async getOpenSessionByActor(tenantId: string, actorId: string) {
    return await pdvSessionRepository.getOpenSessionByActor(tenantId, actorId);
  }

  /**
   * Lista sessões por actor
   */
  async listSessionsByActor(tenantId: string, actorId: string, limit: number = 50) {
    return await pdvSessionRepository.listSessionsByActor(tenantId, actorId, limit);
  }

  /**
   * Cria Order a partir do PDV
   * 
   * PDV SEMPRE cria Order no marketplace (não cria sistema paralelo)
   */
  async createOrderFromPdv(
    tenantId: string,
    input: CreateOrderFromPdvInput
  ) {
    // 1. Validar sessão
    const session = await this.getSessionById(tenantId, input.sessionId);
    
    if (session.status !== 'open') {
      throw new Error('Sessão PDV não está aberta');
    }

    // 2. Criar Order no marketplace
    const order = await orderService.createOrder(tenantId, {
      buyerActorId: input.buyerActorId,
      sellerActorId: input.sellerActorId,
      metadata: {
        ...input.metadata,
        pdv_session_id: session.id,
        pdv_actor_id: session.actorId,
      },
    });

    return order;
  }

  /**
   * Adiciona item por variante (UNIT ou LOT)
   */
  async addItemByVariant(
    tenantId: string,
    input: AddItemByVariantInput
  ) {
    // 1. Validar sessão
    const session = await this.getSessionById(tenantId, input.sessionId);
    
    if (session.status !== 'open') {
      throw new Error('Sessão PDV não está aberta');
    }

    // 2. Adicionar item ao Order (usa service do marketplace)
    // SPRINT 43: Passa source='pdv' para reservar estoque corretamente
    const item = await orderService.addItem(tenantId, input.orderId, {
      productVariantId: input.variantId,
      quantity: input.quantity,
      unit: input.unit || 'UN',
    }, 'pdv');

    return item;
  }

  /**
   * Adiciona item por peso (WEIGHT)
   * 
   * ⚠️ REGRA: Só aceita variantes WEIGHT
   */
  async addItemByWeight(
    tenantId: string,
    input: AddItemByWeightInput
  ) {
    // 1. Validar sessão
    const session = await this.getSessionById(tenantId, input.sessionId);
    
    if (session.status !== 'open') {
      throw new Error('Sessão PDV não está aberta');
    }

    // 2. Validar que variante é WEIGHT
    const { productCatalogService } = await import('../marketplace/product-catalog.service');
    const variant = await productCatalogService.getVariantById(tenantId, input.variantId);
    
    if (!variant) {
      throw new Error(`Variante não encontrada: ${input.variantId}`);
    }

    // Buscar produto para verificar product_type
    const product = await productCatalogService.getProductById(tenantId, variant.productId);
    
    if (!product) {
      throw new Error(`Produto não encontrado: ${variant.productId}`);
    }

    if (product.productType !== 'WEIGHT') {
      throw new Error(`Variante não é do tipo WEIGHT. Tipo atual: ${product.productType}`);
    }

    // 3. Adicionar item ao Order com peso
    // SPRINT 43: Passa source='pdv' para reservar estoque corretamente
    const item = await orderService.addItem(tenantId, input.orderId, {
      productVariantId: input.variantId,
      quantity: input.weight, // peso em kg
      unit: input.unit || 'KG',
    }, 'pdv');

    return item;
  }

  /**
   * Paga pedido via PDV
   * 
   * SPRINT 42.2: Fluxo completo de pagamento
   * 
   * Fluxo:
   * 1. Validar sessão OPEN
   * 2. Submeter pedido (se DRAFT)
   * 3. Criar PaymentIntent
   * 4. Autorizar PaymentIntent
   * 5. Executar pagamento
   * 
   * ⚠️ REGRAS:
   * - PDV não calcula preço (amount vem do operador)
   * - Usa fluxo existente do marketplace
   * - Nenhuma lógica duplicada
   */
  async payOrderFromPdv(
    tenantId: string,
    input: PayOrderFromPdvInput
  ) {
    // 🔴 F-PDV-PAY-MONEY-HOLD-CONTAINMENT — FAIL-CLOSED default-off ANTES de qualquer side-effect financeiro
    // (createPaymentIntent / authorizePaymentIntent / executePayment → payment_intents/bank_*). PDV segue vivo
    // como canal; só o PAGAMENTO está contido enquanto dinheiro está HOLD (PORTA-1). Reabrir = flag, não reescrever.
    assertPdvFinancialRuntimeEnabled('POST /pdv/orders/:orderId/pay');

    // 1. Validar sessão
    const session = await this.getSessionById(tenantId, input.sessionId);
    
    if (session.status !== 'open') {
      throw new Error('Sessão PDV não está aberta');
    }

    // 2. Buscar pedido
    const order = await orderService.getOrderById(tenantId, input.orderId);

    if (!order) {
      throw new Error(`Pedido não encontrado: ${input.orderId}`);
    }

    // 🔒 PDV-F2C: DEFESA PRÓPRIA DO SERVICE — o money NÃO confia em seller/buyer vindos do body.
    // As partes da transação são DERIVADAS da ORDEM persistida (autoritativa). Se o body divergir
    // da ordem, falha FAIL-CLOSED ANTES de qualquer side-effect (createPaymentIntent/executePayment).
    // Independe da validação da rota: outro caller futuro não consegue redirecionar dinheiro pelo body.
    if (input.sellerActorId !== order.sellerActorId || input.buyerActorId !== order.buyerActorId) {
      throw new Error('PDV payment parties must match the persisted order (seller/buyer).');
    }
    const sellerActorId = order.sellerActorId;
    const buyerActorId = order.buyerActorId;

    // 3. Submeter pedido se estiver em draft
    let finalOrder = order;
    if (order.status === 'draft') {
      finalOrder = await orderService.submitOrder(tenantId, input.orderId);
    }

    if (finalOrder.status !== 'submitted') {
      throw new Error(`Pedido deve estar SUBMITTED para pagamento. Status atual: ${finalOrder.status}`);
    }

    // 4. Criar PaymentIntent
    const { createPaymentIntent } = await import('@modules/payments/payment-intent-repository');
    const intent = await createPaymentIntent(tenantId, {
      referenceId: input.orderId,
      gateway: 'internal',
      actorId: buyerActorId,
      amountCents: input.amountCents,
      currency: input.currency ? toPaymentCurrency(input.currency) : 'BRL',
      source: 'pdv',
      metadata: {
        order_id: input.orderId,
        pdv_session_id: session.id,
      },
    });

    // 5. Autorizar PaymentIntent
    const { paymentIntentService } = await import('../marketplace/payment-intent.service');
    const authorizedIntent = await paymentIntentService.authorizePaymentIntent(tenantId, intent.id);

    // 6. Executar pagamento
    const { paymentExecutionService } = await import('../marketplace/payment-execution.service');
    const transaction = await paymentExecutionService.executePayment(tenantId, {
      paymentIntentId: authorizedIntent.id,
      buyerActorId,
      sellerActorId,
      actingUserId: session.actorId, // Operador do PDV
      idempotencyKey: input.idempotencyKey,
    });

    return {
      order: finalOrder,
      paymentIntent: authorizedIntent,
      transaction,
    };
  }

  /**
   * Fecha sessão com resumo consolidado
   * 
   * SPRINT 42.3: Fechamento de caixa
   * 
   * Fluxo:
   * 1. Validar sessão OPEN
   * 2. Buscar todos os orders criados na sessão (via metadata)
   * 3. Consolidar totais (pedidos, pagamentos, falhas)
   * 4. Fechar sessão
   * 5. Salvar resumo no metadata
   * 
   * ⚠️ REGRAS:
   * - Não recalcula pagamentos
   * - Não move dinheiro
   * - Apenas leitura e consolidação
   */
  async closeSessionWithSummary(
    tenantId: string,
    sessionId: string
  ): Promise<PdvSessionSummary> {
    // 1. Validar sessão
    const session = await this.getSessionById(tenantId, sessionId);
    
    if (session.status !== 'open') {
      throw new Error('Sessão PDV não está aberta');
    }

    // 2. Buscar todos os orders criados nesta sessão
    // Orders criados via PDV têm metadata.pdv_session_id
    const { orderRepository } = await import('../marketplace/order.repository');
    const { runQueriesWithTenant } = await import('@core/database/pool');
    
    interface OrderWithPaymentRow {
      id: string;
      status: string;
      created_at: Date;
      payment_amount: string | null;
      payment_status: string | null;
    }

    const orderRows = await runQueriesWithTenant<OrderWithPaymentRow>(
      tenantId,
      `
      SELECT 
        o.id,
        o.status,
        o.created_at,
        pi.amount_cents as payment_amount,
        pt.status as payment_status
      FROM orders o
      LEFT JOIN payment_intents pi ON pi.order_id = o.id
      LEFT JOIN payment_transactions pt ON pt.payment_intent_id = pi.id
      WHERE o.tenant_id = $1
        AND o.metadata->>'pdv_session_id' = $2
      ORDER BY o.created_at ASC
      `,
      [tenantId, sessionId]
    );

    // 3. Consolidar dados
    const orders = orderRows.map((row) => ({
      id: row.id,
      status: row.status,
      amountCents: row.payment_amount ? integerCentsFromDbWire(row.payment_amount, 'pdv.payment_amount') : null,
      paymentStatus: (row.payment_status || 'none') as 'success' | 'failed' | 'pending' | 'none',
      createdAt: row.created_at.toISOString(),
    }));

    const totalOrders = orders.length;
    const totalPaid = orders
      .filter((o) => o.paymentStatus === 'success')
      .reduce((sum, o) => sum + (o.amountCents ?? 0), 0);
    const totalFailed = orders
      .filter((o) => o.paymentStatus === 'failed')
      .reduce((sum, o) => sum + (o.amountCents ?? 0), 0);

    // 4. Fechar sessão e salvar resumo no metadata
    const summary = {
      totalOrders,
      totalPaid,
      totalFailed,
      orders,
      closedAt: new Date(),
    };

    const closedSession = await pdvSessionRepository.closeSession(tenantId, sessionId, {
      metadata: {
        summary,
      },
    });

    // 5. Retornar resumo completo
    return {
      session: closedSession,
      operator: {
        actorId: session.actorId,
      },
      openedAt: session.openedAt,
      closedAt: closedSession.closedAt,
      totalOrders,
      totalPaid,
      totalFailed,
      orders,
    };
  }

  /**
   * Busca resumo de sessão (leitura)
   * 
   * SPRINT 42.3: Relatório de turno
   * 
   * Retorna resumo consolidado da sessão (aberta ou fechada).
   * Se sessão estiver fechada, retorna resumo do metadata.
   * Se sessão estiver aberta, calcula resumo em tempo real.
   */
  async getSessionSummary(
    tenantId: string,
    sessionId: string
  ): Promise<PdvSessionSummary> {
    const session = await this.getSessionById(tenantId, sessionId);

    // Se sessão está fechada e tem resumo no metadata, retornar
    if (session.status === 'closed' && session.metadata?.summary) {
      return {
        session,
        operator: {
          actorId: session.actorId,
        },
        openedAt: session.openedAt,
        closedAt: session.closedAt,
        totalOrders: session.metadata.summary.totalOrders || 0,
        totalPaid: session.metadata.summary.totalPaid || 0,
        totalFailed: session.metadata.summary.totalFailed || 0,
        orders: session.metadata.summary.orders || [],
      };
    }

    // Se sessão está aberta, calcular em tempo real
    const { runQueriesWithTenant } = await import('@core/database/pool');
    
    interface OrderWithPaymentRow {
      id: string;
      status: string;
      created_at: Date;
      payment_amount: string | null;
      payment_status: string | null;
    }

    const orderRows = await runQueriesWithTenant<OrderWithPaymentRow>(
      tenantId,
      `
      SELECT 
        o.id,
        o.status,
        o.created_at,
        pi.amount_cents as payment_amount,
        pt.status as payment_status
      FROM orders o
      LEFT JOIN payment_intents pi ON pi.order_id = o.id
      LEFT JOIN payment_transactions pt ON pt.payment_intent_id = pi.id
      WHERE o.tenant_id = $1
        AND o.metadata->>'pdv_session_id' = $2
      ORDER BY o.created_at ASC
      `,
      [tenantId, sessionId]
    );

    const orders = orderRows.map((row) => ({
      id: row.id,
      status: row.status,
      amountCents: row.payment_amount ? integerCentsFromDbWire(row.payment_amount, 'pdv.payment_amount') : null,
      paymentStatus: (row.payment_status || 'none') as 'success' | 'failed' | 'pending' | 'none',
      createdAt: row.created_at.toISOString(),
    }));

    const totalOrders = orders.length;
    const totalPaid = orders
      .filter((o) => o.paymentStatus === 'success')
      .reduce((sum, o) => sum + (o.amountCents ?? 0), 0);
    const totalFailed = orders
      .filter((o) => o.paymentStatus === 'failed')
      .reduce((sum, o) => sum + (o.amountCents ?? 0), 0);

    return {
      session,
      operator: {
        actorId: session.actorId,
      },
      openedAt: session.openedAt,
      closedAt: session.closedAt,
      totalOrders,
      totalPaid,
      totalFailed,
      orders,
    };
  }
}

export const pdvService = new PdvService();




