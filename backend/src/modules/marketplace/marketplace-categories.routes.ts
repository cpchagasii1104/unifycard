// backend/src/modules/marketplace/marketplace-categories.routes.ts
// Rotas para Marketplace Categories
// 🔴 BLINDAGEM: Apenas read-only, importação controlada

import type { FastifyInstance } from 'fastify';
import { marketplaceCategoriesService } from './marketplace-categories.service';
import type { MarketplaceCategoryFilters, ImportCategoriesInput, MarketplaceDomain } from './marketplace-categories.types';
import { AppError, BadRequestError, NotFoundError, UnauthorizedError, ForbiddenError, InternalServerError, ConflictError } from '@core/errors';
import { ErrorCode } from '@core/errors/error-codes';
import { ensureUserActor } from '@modules/identity/actor-writer.service';

const marketplaceCategoriesRoutes = async (fastify: FastifyInstance) => {
  /**
   * GET /marketplace/categories/root-filtered
   * Lista categorias raiz do Marketplace COM FILTROS (requer autenticação)
   * 🔴 NOTA: Para navegação inicial SEM filtros, use a rota pública GET /marketplace/categories/root
   */
  fastify.get<{
    Querystring: {
      type?: string;
      actorId?: string;
      includeInactive?: boolean;
      domain?: string;
    };
  }>('/marketplace/categories/root-filtered', async (req, reply) => {
    const tenant = req.tenant!;
    const tenantId = tenant.id;

    const filters: MarketplaceCategoryFilters = {
      type: req.query.type as any,
      actorId: req.query.actorId,
      includeInactive: req.query.includeInactive === true,
      marketplaceDomain: req.query.domain as any,
    };

    const categories = await marketplaceCategoriesService.getRootCategories(tenantId, filters);

    return reply.send({ categories });
  });

  /**
   * GET /marketplace/segments/:domain
   * Lista segmentos por domínio
   * 🔴 REGRA: Retorna apenas category_type = 'segment'
   */
  fastify.get<{
    Params: { domain: MarketplaceDomain };
  }>('/marketplace/segments/:domain', async (req, reply) => {
    const tenant = req.tenant!;
    const tenantId = tenant.id;
    const { domain } = req.params;

    const segments = await marketplaceCategoriesService.getSegmentsByDomain(tenantId, domain);

    return reply.send({ segments });
  });

  /**
   * GET /marketplace/stores/:storeId/offer-categories
   * Lista categorias de oferta de uma store
   * 🔴 REGRA: Retorna apenas category_type = 'offer_category'
   */
  fastify.get<{
    Params: { storeId: string };
  }>('/marketplace/stores/:storeId/offer-categories', async (req, reply) => {
    const tenant = req.tenant!;
    const tenantId = tenant.id;
    const { storeId } = req.params;

    const categories = await marketplaceCategoriesService.getOfferCategoriesByStore(tenantId, storeId);

    return reply.send({ categories });
  });

  /**
   * GET /marketplace/categories/:categoryId
   * Busca categoria por ID
   */
  fastify.get<{
    Params: { categoryId: string };
  }>('/marketplace/categories/:categoryId', async (req, reply) => {
    const tenant = req.tenant!;
    const tenantId = tenant.id;
    const { categoryId } = req.params;

    const category = await marketplaceCategoriesService.getCategoryById(tenantId, categoryId);

    if (!category) {
      throw new NotFoundError('Categoria não encontrada');
    }

    return reply.send({ category });
  });

  /**
   * GET /marketplace/categories/:departmentId/branches
   * Lista branches (products/services) de um department
   */
  fastify.get<{
    Params: { departmentId: string };
  }>('/marketplace/categories/:departmentId/branches', async (req, reply) => {
    const tenant = req.tenant!;
    const tenantId = tenant.id;
    const { departmentId } = req.params;

    const branches = await marketplaceCategoriesService.getDepartmentBranches(tenantId, departmentId);

    return reply.send({ branches });
  });

  /**
   * GET /marketplace/categories/branch/:branchId/categories
   * Lista categories de uma branch específica
   */
  fastify.get<{
    Params: { branchId: string };
    Querystring: {
      type?: string;
      actorId?: string;
      includeInactive?: boolean;
    };
  }>('/marketplace/categories/branch/:branchId/categories', async (req, reply) => {
    const tenant = req.tenant!;
    const tenantId = tenant.id;
    const { branchId } = req.params;

    const filters: MarketplaceCategoryFilters = {
      type: req.query.type as any,
      actorId: req.query.actorId,
      includeInactive: req.query.includeInactive === true,
    };

    const categories = await marketplaceCategoriesService.getBranchCategories(
      tenantId,
      branchId,
      filters
    );

    return reply.send({ categories });
  });

  /**
   * GET /marketplace/categories/:categoryId/children
   * Lista subcategorias
   */
  fastify.get<{
    Params: { categoryId: string };
    Querystring: {
      type?: string;
      actorId?: string;
      includeInactive?: boolean;
      domain?: string;
    };
  }>('/marketplace/categories/:categoryId/children', async (req, reply) => {
    const tenant = req.tenant!;
    const tenantId = tenant.id;
    const { categoryId } = req.params;

    const filters: MarketplaceCategoryFilters = {
      type: req.query.type as any,
      actorId: req.query.actorId,
      includeInactive: req.query.includeInactive === true,
      marketplaceDomain: req.query.domain as any,
    };

    const categories = await marketplaceCategoriesService.getCategoryChildren(
      tenantId,
      categoryId,
      filters
    );

    return reply.send({ categories });
  });

  /**
   * GET /marketplace/categories/path/:path
   * Busca categoria por path (ex: /bebidas/refrigerantes)
   */
  fastify.get<{
    Params: { '*': string };
  }>('/marketplace/categories/path/*', async (req, reply) => {
    const tenant = req.tenant!;
    const tenantId = tenant.id;
    const pathStr = req.params['*'] || '';
    const path = pathStr.split('/').filter((p) => p);

    if (path.length === 0) {
      throw new BadRequestError('Path inválido', ErrorCode.VALIDATION_ERROR);
    }

    const category = await marketplaceCategoriesService.getCategoryByPath(tenantId, path);

    if (!category) {
      throw new NotFoundError('Categoria não encontrada');
    }

    return reply.send({ category });
  });

  /**
   * GET /marketplace/categories/:categoryId/breadcrumb
   * Busca breadcrumb de uma categoria
   */
  fastify.get<{
    Params: { categoryId: string };
  }>('/marketplace/categories/:categoryId/breadcrumb', async (req, reply) => {
    const tenant = req.tenant!;
    const tenantId = tenant.id;
    const { categoryId } = req.params;

    const breadcrumb = await marketplaceCategoriesService.getCategoryBreadcrumb(tenantId, categoryId);

    return reply.send({ breadcrumb });
  });

  /**
   * POST /marketplace/categories/import
   * Importa categorias para um Actor/Empresa
   */
  fastify.post<{
    Body: ImportCategoriesInput & { actorId: string };
  }>('/marketplace/categories/import', async (req, reply) => {
    const tenant = req.tenant!;
    const tenantId = tenant.id;
    const userId = req.user?.id;

    if (!userId) {
      throw new UnauthorizedError('Não autenticado');
    }

    // Buscar actor do usuário
    const actor = await ensureUserActor(tenantId, userId);
    if (!actor) {
      throw new ForbiddenError('Actor não encontrado');
    }

    const { actorId, categoryIds, metadata } = req.body;

    // Validar permissões (apenas o próprio actor ou admin)
    if (actor.actor_id !== actorId) {
      // TODO: Verificar permissão de admin
      throw new ForbiddenError('Sem permissão para importar categorias');
    }

    const importResult = await marketplaceCategoriesService.importCategories(
      tenantId,
      actorId,
      { categoryIds, metadata },
      actor.actor_id
    );

    return reply.send({ import: importResult });
  });

  /**
   * GET /marketplace/categories/imported/:actorId
   * Lista categorias importadas por um Actor
   */
  fastify.get<{
    Params: { actorId: string };
  }>('/marketplace/categories/imported/:actorId', async (req, reply) => {
    const tenant = req.tenant!;
    const tenantId = tenant.id;
    const { actorId } = req.params;

    const categories = await marketplaceCategoriesService.getImportedCategories(tenantId, actorId);

    return reply.send({ categories });
  });
};

export default marketplaceCategoriesRoutes;

