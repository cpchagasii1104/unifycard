// backend/src/modules/marketplace/marketplace-public.routes.ts
// Rotas públicas READ-ONLY e estáticas do Marketplace
// Sem tenant scoping, sem autenticação, sem banco de dados

import { FastifyPluginAsync } from 'fastify';
import { marketplaceService } from './marketplace.service';
import { marketplaceLogger } from './marketplace.logger';

const marketplacePublicRoutes: FastifyPluginAsync = async (fastify) => {
  marketplaceLogger.init('Rotas públicas do Marketplace registradas');
  
  // ============================================================
  // HEALTH CHECK
  // ============================================================
  
  // GET /marketplace/health
  fastify.get('/health', async (req, reply) => {
    marketplaceLogger.api('GET /marketplace/health');
    const health = marketplaceService.getHealth();
    return reply.status(200).send(health);
  });

  // ============================================================
  // VITRINE / HOME
  // ============================================================
  
  // GET /marketplace/home
  fastify.get('/home', async (req, reply) => {
    const home = marketplaceService.getHome();
    return reply.status(200).send(home);
  });

  // ============================================================
  // TEMPLATES DE LOJA
  // ============================================================
  
  // GET /marketplace/templates
  fastify.get('/templates', async (req, reply) => {
    const templates = marketplaceService.getTemplates();
    return reply.status(200).send(templates);
  });

  // ============================================================
  // CATEGORIAS DE PRODUTO (CANÔNICAS - ESTÁTICAS)
  // ============================================================
  
  // GET /marketplace/categories (versão canônica estática para navegação/descoberta)
  // NOTA: A rota dinâmica do catálogo está em marketplace.routes.ts (escopo protegido)
  fastify.get('/categories', async (req, reply) => {
    const categories = marketplaceService.getCategories();
    return reply.status(200).send(categories);
  });

  // ============================================================
  // CATEGORIAS ROOT DO MARKETPLACE (do banco de dados)
  // Rota PÚBLICA para navegação inicial do Marketplace
  // ============================================================

  // GET /marketplace/categories/root
  // Retorna as categorias raiz do marketplace (departments) do banco de dados
  // Query param: ?domain=market|services|events|real_estate|vehicles|jobs (default: market)
  fastify.get<{
    Querystring: {
      domain?: string;
    };
  }>('/categories/root', async (req, reply) => {
    try {
      // Import dinâmico para evitar dependência circular
      const { categoriesService } = await import('@core/categories/categories.service');
      const { CategoryRepository } = await import('@core/categories/categories.repository');
      const { CategoryModel } = await import('@core/categories/categories.model');

      // Buscar todas as categorias ativas usando o repository canônico
      const categoryRepository = new CategoryRepository();
      // TRAVA: BLOCKED_BY_SCHEMA - context obrigatório - usar 'professional' como fallback até definir context específico para marketplace
      // NÃO criar novos usos deste padrão - context deve ser explícito quando schema permitir
      const allRows = await categoryRepository.findAll(undefined, 'professional' as any);
      const allCategories = CategoryModel.fromRows(allRows);

      // 🔴 REGRA: Filtrar apenas SEGMENTS (category_type='segment') do domínio especificado
      // 🔴 REGRA: NUNCA retornar offer_categories aqui
      const targetDomain = req.query.domain || 'market';
      
      // Filtrar categorias do marketplace com validação segura de metadata
      let marketplaceRootCategories = allCategories.filter((c) => {
        // Garantir que metadata existe e é objeto
        if (!c.metadata || typeof c.metadata !== 'object') {
          return false;
        }
        
        // Validar propriedades obrigatórias
        const domain = c.metadata.domain;
        const taxonomy = c.metadata.taxonomy;
        const marketplaceDomain = c.metadata.marketplace_domain || 'market';
        const categoryType = c.metadata.category_type;
        
        return (
          domain === 'marketplace' 
          && taxonomy === 'department' 
          && !c.parentId
          && marketplaceDomain === targetDomain
          && categoryType === 'segment'
        );
      });

      // Log para debug
      marketplaceLogger.api(`GET /marketplace/categories/root?domain=${targetDomain} - Found ${marketplaceRootCategories.length} segments`);

      // Mapear para o formato esperado pelo frontend
      const categories = marketplaceRootCategories.map((c) => ({
        id: c.id,
        slug: c.slug,
        name: c.name,
        description: c.description,
        parentId: c.parentId,
        scope: c.scope,
        isActive: c.isActive,
        icon: c.icon,
        color: c.color,
        metadata: c.metadata,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
        type: c.metadata?.type || 'product',
        path: [c.slug],
        level: 0,
      }));

      return reply.status(200).send({ categories });
    } catch (error: any) {
      marketplaceLogger.error('Erro ao buscar categorias root do marketplace', error);
      return reply.status(500).send({ error: 'Erro ao buscar categorias', details: error.message });
    }
  });

  // ============================================================
  // LOJAS E FILIAIS (READ-ONLY)
  // ============================================================
  
  // GET /marketplace/stores?scope=city&value=São Paulo
  fastify.get('/stores', async (req, reply) => {
    const query = req.query as { scope?: string; valueCents: string };
    const scope = query.scope;
    const value = query.value;
    
    const stores = marketplaceService.getStores(scope, value);
    return reply.status(200).send(stores);
  });

  // GET /marketplace/stores/near
  fastify.get('/stores/near', async (req, reply) => {
    const query = req.query as {
      city?: string;
      neighborhood?: string;
      category_id?: string;
      template_id?: string;
    };
    
    const { city, neighborhood, category_id, template_id } = query;
    
    if (!city) {
      return reply.status(400).send({ error: 'city é obrigatório' });
    }
    
    const storesData = marketplaceService.getStoresNear({
      city,
      neighborhood,
      category_id,
      template_id,
    });
    
    return reply.status(200).send(storesData);
  });

  // ============================================================
  // REGIÕES DE DESCOBERTA
  // ============================================================
  
  // GET /marketplace/regions
  fastify.get('/regions', async (req, reply) => {
    const regions = marketplaceService.getRegions();
    return reply.status(200).send(regions);
  });

  // ============================================================
  // CATÁLOGO DA LOJA
  // ============================================================
  
  // GET /marketplace/store/:storeId/catalog
  fastify.get<{ Params: { storeId: string } }>('/store/:storeId/catalog', async (req, reply) => {
    const { storeId } = req.params;
    
    const catalog = marketplaceService.getStoreCatalog(storeId);
    
    if (!catalog) {
      return reply.status(404).send({ error: 'Loja não encontrada' });
    }
    
    return reply.status(200).send(catalog);
  });

  // ============================================================
  // CATÁLOGO CANÔNICO DE PRODUTOS
  // ============================================================
  
  // GET /marketplace/products/canonical
  fastify.get('/products/canonical', async (req, reply) => {
    const products = marketplaceService.getCanonicalProducts();
    return reply.status(200).send(products);
  });

  // ============================================================
  // PRODUTOS ATIVADOS POR LOJA
  // ============================================================
  
  // GET /marketplace/store/:storeId/products?category_id=xxx
  fastify.get<{ Params: { storeId: string }; Querystring: { category_id?: string } }>('/store/:storeId/products', async (req, reply) => {
    const { storeId } = req.params;
    const { category_id } = req.query;
    
    const storeProducts = marketplaceService.getStoreProducts(storeId, category_id);
    
    if (!storeProducts) {
      return reply.status(404).send({ error: 'Loja não encontrada' });
    }
    
    return reply.status(200).send(storeProducts);
  });

  // ============================================================
  // PEDIDOS (CARRINHO)
  // ============================================================
  
  // POST /marketplace/order
  fastify.post('/order', async (req, reply) => {
    const body = req.body as { store_id: string };
    
    if (!body.store_id) {
      return reply.status(400).send({ error: 'store_id é obrigatório' });
    }

    try {
      const order = marketplaceService.createOrder(body.store_id);
      return reply.status(201).send(order);
    } catch (error: any) {
      return reply.status(400).send({ error: error.message || 'Erro ao criar pedido' });
    }
  });

  // POST /marketplace/order/:orderId/items
  fastify.post<{ Params: { orderId: string } }>('/order/:orderId/items', async (req, reply) => {
    const { orderId } = req.params;
    const body = req.body as { product_id: string; quantity: number };
    
    if (!body.product_id) {
      return reply.status(400).send({ error: 'product_id é obrigatório' });
    }
    
    if (!body.quantity || body.quantity < 1) {
      return reply.status(400).send({ error: 'quantity deve ser maior que zero' });
    }

    try {
      const order = marketplaceService.addOrderItem(orderId, body.product_id, body.quantity);
      return reply.status(200).send(order);
    } catch (error: any) {
      return reply.status(400).send({ error: error.message || 'Erro ao adicionar item' });
    }
  });

  // GET /marketplace/order/:orderId
  fastify.get<{ Params: { orderId: string } }>('/order/:orderId', async (req, reply) => {
    const { orderId } = req.params;
    
    const order = marketplaceService.getOrder(orderId);
    
    if (!order) {
      return reply.status(404).send({ error: 'Pedido não encontrado' });
    }
    
    return reply.status(200).send(order);
  });

  // ============================================================
  // CHECKOUT INTENT
  // ============================================================
  
  // POST /marketplace/checkout/from-order/:orderId
  fastify.post<{ Params: { orderId: string } }>('/checkout/from-order/:orderId', async (req, reply) => {
    const { orderId } = req.params;
    
    try {
      const checkout = marketplaceService.createCheckoutFromOrder(orderId);
      return reply.status(201).send(checkout);
    } catch (error: any) {
      return reply.status(400).send({ error: error.message || 'Erro ao criar checkout' });
    }
  });

  // GET /marketplace/checkout/:checkoutId
  fastify.get<{ Params: { checkoutId: string } }>('/checkout/:checkoutId', async (req, reply) => {
    const { checkoutId } = req.params;
    
    const checkout = marketplaceService.getCheckout(checkoutId);
    
    if (!checkout) {
      return reply.status(404).send({ error: 'Checkout não encontrado' });
    }
    
    return reply.status(200).send(checkout);
  });

  // POST /marketplace/checkout/:checkoutId/confirm
  fastify.post<{ Params: { checkoutId: string } }>('/checkout/:checkoutId/confirm', async (req, reply) => {
    const { checkoutId } = req.params;
    
    try {
      const checkout = marketplaceService.confirmCheckout(checkoutId);
      return reply.status(200).send(checkout);
    } catch (error: any) {
      return reply.status(400).send({ error: error.message || 'Erro ao confirmar checkout' });
    }
  });

  // ============================================================
  // PAYMENT ORCHESTRATOR (PAYMENT PLAN)
  // ============================================================
  
  // POST /marketplace/payment-plan/from-checkout/:checkoutId
  fastify.post<{ Params: { checkoutId: string } }>('/payment-plan/from-checkout/:checkoutId', async (req, reply) => {
    const { checkoutId } = req.params;
    const body = req.body as { method: 'balance' | 'card' | 'invoice' };
    
    if (!body.method) {
      return reply.status(400).send({ error: 'method é obrigatório' });
    }

    if (!['balance', 'card', 'invoice'].includes(body.method)) {
      return reply.status(400).send({ error: 'method deve ser balance, card ou invoice' });
    }

    try {
      const paymentPlan = marketplaceService.createPaymentPlan(checkoutId, body.method);
      return reply.status(201).send(paymentPlan);
    } catch (error: any) {
      return reply.status(400).send({ error: error.message || 'Erro ao criar payment plan' });
    }
  });

  // GET /marketplace/payment-plan/:paymentPlanId
  fastify.get<{ Params: { paymentPlanId: string } }>('/payment-plan/:paymentPlanId', async (req, reply) => {
    const { paymentPlanId } = req.params;
    
    const paymentPlan = marketplaceService.getPaymentPlan(paymentPlanId);
    
    if (!paymentPlan) {
      return reply.status(404).send({ error: 'Payment plan não encontrado' });
    }
    
    return reply.status(200).send(paymentPlan);
  });

  // ============================================================
  // ATTRIBUTION & SHARING
  // ============================================================
  
  // POST /marketplace/share
  fastify.post('/share', async (req, reply) => {
    const body = req.body as {
      content_type: 'product' | 'service' | 'store';
      content_id: string;
      attribution_context: {
        source: {
          type: 'user' | 'group' | 'page' | 'store';
          id: string;
        };
        intent: 'business' | 'recommendation' | 'entertainment';
        visibility: {
          scope: 'public' | 'group' | 'direct' | 'relationship_category';
          group_id?: string;
          target_ids?: string[];
          relationship_category?: 'business' | 'friend' | 'family' | 'entertainment';
        };
        commission?: {
          type: 'percentage' | 'fixed';
          valueCents: number;
        };
      };
    };

    if (!body.content_type || !body.content_id || !body.attribution_context) {
      return reply.status(400).send({ error: 'content_type, content_id e attribution_context são obrigatórios' });
    }

    try {
      const result = marketplaceService.createShare({
        content_type: body.content_type,
        content_id: body.content_id,
        attribution_context: body.attribution_context,
      });
      return reply.status(201).send(result);
    } catch (error: any) {
      return reply.status(400).send({ error: error.message || 'Erro ao criar share' });
    }
  });

  // ============================================================
  // VOUCHERS LOCAIS & OFERTAS RELÂMPAGO (PROMPT 25)
  // ============================================================

  // GET /marketplace/vouchers/offers
  fastify.get('/vouchers/offers', async (req, reply) => {
    const query = req.query as {
      city?: string;
      neighborhood?: string;
      scope?: 'local_neighborhood' | 'city' | 'restricted_group';
      type?: 'product' | 'service' | 'bundle';
      active?: string;
    };

    try {
      const offers = marketplaceService.listVoucherOffers({
        city: query.city,
        neighborhood: query.neighborhood,
        scope: query.scope,
        type: query.type,
        active_only: query.active === 'true',
      });

      return reply.status(200).send({ offers });
    } catch (error: any) {
      marketplaceLogger.error('Erro ao listar ofertas de voucher', error);
      return reply.status(400).send({ error: error.message || 'Erro ao listar ofertas' });
    }
  });

  // GET /marketplace/vouchers/offers/:offerId
  fastify.get<{
    Params: { offerId: string };
  }>('/vouchers/offers/:offerId', async (req, reply) => {
    try {
      const { offerId } = req.params;
      const offer = marketplaceService.getVoucherOffer(offerId);
      if (!offer) {
        return reply.status(404).send({ error: 'Oferta não encontrada' });
      }
      return reply.status(200).send(offer);
    } catch (error: any) {
      marketplaceLogger.error('Erro ao buscar oferta de voucher', error);
      return reply.status(400).send({ error: error.message || 'Erro ao buscar oferta' });
    }
  });

  // POST /marketplace/vouchers/offers/:offerId/claim
  fastify.post<{
    Params: { offerId: string };
    Body: {
      user_id: string;
      audit?: {
        ip_hash?: string;
        device_hash?: string;
        neighborhood?: string;
        city?: string;
      };
    };
  }>('/vouchers/offers/:offerId/claim', async (req, reply) => {
    try {
      const { offerId } = req.params;
      const { user_id, audit } = req.body;

      if (!user_id) {
        return reply.status(400).send({ error: 'user_id é obrigatório' });
      }

      const claim = marketplaceService.claimVoucherOffer(offerId, user_id, audit);
      return reply.status(201).send(claim);
    } catch (error: any) {
      marketplaceLogger.error('Erro ao resgatar voucher', error);
      return reply.status(400).send({ error: error.message || 'Erro ao resgatar voucher' });
    }
  });

  // GET /marketplace/vouchers/claims/:claimId
  fastify.get<{
    Params: { claimId: string };
  }>('/vouchers/claims/:claimId', async (req, reply) => {
    try {
      const { claimId } = req.params;
      const claim = marketplaceService.getVoucherClaim(claimId);
      if (!claim) {
        return reply.status(404).send({ error: 'Claim não encontrado' });
      }
      return reply.status(200).send(claim);
    } catch (error: any) {
      marketplaceLogger.error('Erro ao buscar claim de voucher', error);
      return reply.status(400).send({ error: error.message || 'Erro ao buscar claim' });
    }
  });

  // POST /marketplace/vouchers/claims/expire-check
  fastify.post('/vouchers/claims/expire-check', async (req, reply) => {
    try {
      const result = marketplaceService.expireVoucherClaims();
      return reply.status(200).send(result);
    } catch (error: any) {
      marketplaceLogger.error('Erro ao expirar claims', error);
      return reply.status(400).send({ error: error.message || 'Erro ao expirar claims' });
    }
  });
};

export default marketplacePublicRoutes;


