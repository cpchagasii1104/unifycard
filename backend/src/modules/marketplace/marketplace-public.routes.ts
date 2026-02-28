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
      if (!(req as { tenant?: { id: string } }).tenant) {
        return reply.status(401).send({ error: 'Tenant required' });
      }
      const { marketplaceCategoriesService } = await import('./marketplace-categories.service');
      const tenantId = (req as { tenant: { id: string } }).tenant.id;
      const targetDomain = (req.query as { domain?: string }).domain || 'market';
      const marketplaceRootCategories = await marketplaceCategoriesService.getRootCategories(tenantId, {
        marketplaceDomain: targetDomain as 'market' | 'services' | 'events' | 'real_estate' | 'vehicles' | 'jobs',
      });

      marketplaceLogger.api(`GET /marketplace/categories/root?domain=${targetDomain} - Found ${marketplaceRootCategories.length} segments`);

      // Mapear para o formato esperado pelo frontend
      const categories = marketplaceRootCategories.map((c) => ({
        id: c.id ?? c.categoryId,
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
        type: c.type ?? c.metadata?.type ?? 'product',
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
    const query = req.query as { scope?: string; valueCents?: string };
    const scope = query.scope;
    const valueCents = query.valueCents;
    
    const stores = marketplaceService.getStores(scope, valueCents);
    return reply.status(200).send(stores);
  });

  // GET /marketplace/stores/near (aceita category_id ou categoryId, template_id ou templateId; resposta camelCase)
  fastify.get('/stores/near', async (req, reply) => {
    const q = req.query as Record<string, unknown>;
    const city = (q.city as string | undefined) ?? undefined;
    const neighborhood = (q.neighborhood as string | undefined) ?? undefined;
    const categoryId = (q.category_id as string | undefined) ?? (q.categoryId as string | undefined);
    const templateId = (q.template_id as string | undefined) ?? (q.templateId as string | undefined);

    if (!city) {
      return reply.status(400).send({ error: 'city é obrigatório' });
    }

    const storesData = marketplaceService.getStoresNear({
      city,
      neighborhood,
      category_id: categoryId,
      template_id: templateId,
    });

    return reply.status(200).send(toCamelCaseKeys(storesData));
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
  
  // GET /marketplace/store/:storeId/products (aceita category_id ou categoryId; resposta camelCase)
  fastify.get<{ Params: { storeId: string }; Querystring: { category_id?: string; categoryId?: string } }>('/store/:storeId/products', async (req, reply) => {
    const { storeId } = req.params;
    const q = req.query as Record<string, unknown>;
    const categoryId = (q.category_id as string | undefined) ?? (q.categoryId as string | undefined);
    const tenantId = (req as { tenant?: { id: string } }).tenant?.id ?? '';

    const storeProducts = marketplaceService.getStoreProducts(tenantId, storeId, categoryId ?? undefined);

    if (!storeProducts) {
      return reply.status(404).send({ error: 'Loja não encontrada' });
    }

    return reply.status(200).send(toCamelCaseKeys(storeProducts));
  });

  // ============================================================
  // PEDIDOS (CARRINHO)
  // ============================================================
  
  // POST /marketplace/order (aceita store_id ou storeId; resposta camelCase)
  fastify.post('/order', async (req, reply) => {
    const body = req.body as Record<string, unknown>;
    const storeId = (body.store_id as string | undefined) ?? (body.storeId as string | undefined);

    if (!storeId) {
      return reply.status(400).send({ error: 'storeId é obrigatório' });
    }

    try {
      const order = marketplaceService.createOrder(storeId);
      return reply.status(201).send(toCamelCaseKeys(order));
    } catch (error: any) {
      return reply.status(400).send({ error: error.message || 'Erro ao criar pedido' });
    }
  });

  // POST /marketplace/order/:orderId/items (aceita product_id ou productId; resposta camelCase)
  fastify.post<{ Params: { orderId: string } }>('/order/:orderId/items', async (req, reply) => {
    const { orderId } = req.params;
    const body = req.body as Record<string, unknown>;
    const productId = (body.product_id as string | undefined) ?? (body.productId as string | undefined);
    const quantity = (body.quantity as number | undefined) ?? undefined;

    if (!productId) {
      return reply.status(400).send({ error: 'productId é obrigatório' });
    }
    if (quantity == null || quantity < 1) {
      return reply.status(400).send({ error: 'quantity deve ser maior que zero' });
    }

    try {
      const order = await marketplaceService.addOrderItem(orderId, productId, quantity);
      return reply.status(200).send(toCamelCaseKeys(order));
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
  
  // POST /marketplace/share (aceita snake_case ou camelCase; resposta camelCase)
  fastify.post('/share', async (req, reply) => {
    const body = req.body as Record<string, unknown>;
    const contentType = (body.content_type ?? body.contentType) as 'product' | 'service' | 'store' | undefined;
    const contentId = (body.content_id ?? body.contentId) as string | undefined;
    const rawContext = body.attribution_context ?? body.attributionContext as Record<string, unknown> | undefined;

    if (!contentType || !contentId || !rawContext) {
      return reply.status(400).send({ error: 'contentType, contentId e attributionContext são obrigatórios' });
    }

    const src = (rawContext.source ?? (rawContext as Record<string, unknown>).source) as Record<string, unknown> | undefined;
    const visibility = (rawContext.visibility ?? (rawContext as Record<string, unknown>).visibility) as Record<string, unknown> | undefined;
    const source = src && typeof src === 'object' && 'type' in src && 'id' in src
      ? { type: (src.type as 'user' | 'group' | 'page' | 'store') ?? 'store', id: String(src.id) }
      : { type: 'store' as const, id: '' };
    const intent = (rawContext.intent === 'business' || rawContext.intent === 'recommendation' || rawContext.intent === 'entertainment')
      ? rawContext.intent
      : 'business';
    type VisScope = 'public' | 'group' | 'direct' | 'relationship_category';
    const vis: { scope: VisScope; group_id?: string; target_ids?: string[]; relationship_category?: 'business' | 'friend' | 'family' | 'entertainment' } = visibility && typeof visibility === 'object'
      ? {
          scope: (visibility.scope === 'public' || visibility.scope === 'group' || visibility.scope === 'direct' || visibility.scope === 'relationship_category') ? visibility.scope as VisScope : 'public',
          group_id: (visibility.group_id ?? visibility.groupId) as string | undefined,
          target_ids: (visibility.target_ids ?? visibility.targetIds) as string[] | undefined,
          relationship_category: (visibility.relationship_category ?? visibility.relationshipCategory) as 'business' | 'friend' | 'family' | 'entertainment' | undefined,
        }
      : { scope: 'public' as VisScope };
    const commission = rawContext.commission && typeof rawContext.commission === 'object' && 'type' in rawContext.commission && 'valueCents' in rawContext.commission
      ? { type: (rawContext.commission as { type: string }).type as 'percentage' | 'fixed', valueCents: Number((rawContext.commission as { valueCents: unknown }).valueCents) }
      : undefined;

    try {
      const result = marketplaceService.createShare({
        content_type: contentType,
        content_id: contentId,
        attribution_context: { source, intent, visibility: vis, commission },
      });
      return reply.status(201).send(toCamelCaseKeys(result));
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

  // POST /marketplace/vouchers/offers/:offerId/claim (aceita user_id ou userId, audit com ip_hash/ipHash etc.; resposta camelCase)
  fastify.post<{ Params: { offerId: string } }>('/vouchers/offers/:offerId/claim', async (req, reply) => {
    try {
      const { offerId } = req.params;
      const body = req.body as Record<string, unknown>;
      const userId = (body.user_id as string | undefined) ?? (body.userId as string | undefined);
      const rawAudit = body.audit as Record<string, unknown> | undefined;
      const audit = rawAudit
        ? {
            ip_hash: (rawAudit.ip_hash ?? rawAudit.ipHash) as string | undefined,
            device_hash: (rawAudit.device_hash ?? rawAudit.deviceHash) as string | undefined,
            neighborhood: rawAudit.neighborhood as string | undefined,
            city: rawAudit.city as string | undefined,
          }
        : undefined;

      if (!userId) {
        return reply.status(400).send({ error: 'userId é obrigatório' });
      }
      if (!(req as { tenant?: { id: string } }).tenant) {
        return reply.status(401).send({ error: 'Tenant required' });
      }
      const tenantId = (req as { tenant: { id: string } }).tenant.id;
      const claim = await marketplaceService.claimVoucherOffer(tenantId, offerId, userId, audit);
      return reply.status(201).send(toCamelCaseKeys(claim));
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


