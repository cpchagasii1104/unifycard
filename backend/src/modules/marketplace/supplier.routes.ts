// backend/src/modules/marketplace/supplier.routes.ts
// SPRINT 69: Rotas REST para Suppliers
// 🔒 F-SUPPLIERS-OWNER-ACTOR-SCHEMA-WIRING (materializa DECISION-0133): supplier é cadastro INSTITUCIONAL da
// empresa via owner_actor_id = actor operacional da empresa dona (page + company_id). Toda operação exige que
// req.user REPRESENTE o owner empresarial (canRepresentActor); created_by_actor_id = autoria, created_by_user_id
// = não-authority, tenant_id = escopo, supplier_id = contraparte — NUNCA autoridade. RLS não é prova de autoridade.

import type { FastifyInstance, FastifyReply } from 'fastify';
import { supplierService } from './supplier.service';
import type {
  CreateSupplierInput,
  SupplierFilters,
  Supplier,
} from './supplier.types';
import { BadRequestError } from '@core/errors';
import { ErrorCode } from '@core/errors/error-codes';
import { authorizationService } from '@core/authorization/authorization.service';
import { runQueriesWithTenant } from '@core/database/pool';

// owner empresarial OPERACIONAL = actor_type='page' AND company_id IS NOT NULL (§4.38; o company-actor da empresa).
// Rejeita actor humano (user/actor_human/person) e qualquer actor sem company_id. Read puro (sem write).
async function isOrgActor(tenantId: string, actorId: string): Promise<boolean> {
  const rows = await runQueriesWithTenant<{ actor_type: string; company_id: string | null }>(
    tenantId,
    `SELECT actor_type, company_id FROM actors WHERE tenant_id = $1 AND id = $2 LIMIT 1`,
    [tenantId, actorId]
  );
  const a = rows[0];
  return !!a && a.actor_type === 'page' && a.company_id != null;
}

// Carrega o supplier e exige que req.user represente o owner empresarial. 404 ausente · 403 sem autoridade.
// (tenant_id sozinho NÃO basta — co-tenant não vê fornecedor de outra empresa.)
async function loadAndAuthorizeSupplier(
  reply: FastifyReply,
  tenantId: string,
  userId: string,
  supplierId: string
): Promise<Supplier | null> {
  const supplier = await supplierService.getSupplierById(tenantId, supplierId);
  if (!supplier) {
    reply.status(404).send({ error: 'Fornecedor não encontrado' });
    return null;
  }
  const canRep = await authorizationService.canRepresentActor(tenantId, userId, supplier.ownerActorId);
  if (!canRep) {
    reply.status(403).send({
      error: 'SUPPLIER_OWNER_NOT_REPRESENTABLE: caller must represent the owning company (owner_actor_id) of this supplier.',
    });
    return null;
  }
  return supplier;
}

const supplierRoutes = async (fastify: FastifyInstance) => {
  /**
   * POST /suppliers
   * Cria fornecedor — exige owner empresarial (page+company_id) representável; owner resolvido server-side.
   */
  fastify.post<{ Body: CreateSupplierInput }>('/suppliers', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const userId = req.user?.userId;
    const actionContext = (req as any).actionContext;

    if (!userId) {
      return reply.status(401).send({ error: 'Authentication required' });
    }
    if (!actionContext?.actorId) {
      throw new BadRequestError('actorId é obrigatório', ErrorCode.MISSING_ACTOR);
    }

    // 🔒 owner empresarial: HINT (body.ownerActorId OU actionContext.actorId), RESOLVIDO e VALIDADO server-side.
    // O body NÃO é autoridade — só hint. created_by_actor_id = autoria (actionContext.actorId), nunca owner.
    const ownerHint = (req.body?.ownerActorId as string | undefined) || actionContext.actorId;
    if (!ownerHint) {
      return reply.status(400).send({ error: 'SUPPLIER_OWNER_REQUIRED: owner_actor_id (empresa dona) é obrigatório' });
    }
    if (!(await isOrgActor(tenantId, ownerHint))) {
      return reply.status(403).send({
        error: 'owner_actor_id deve ser um actor de EMPRESA (page + company_id). Actor humano/person/user, created_by, supplier ou tenant não podem ser owner de fornecedor.',
      });
    }
    if (!(await authorizationService.canRepresentActor(tenantId, userId, ownerHint))) {
      return reply.status(403).send({
        error: 'SUPPLIER_OWNER_NOT_REPRESENTABLE: caller must represent the owning company (owner_actor_id) to create a supplier.',
      });
    }

    const supplier = await supplierService.createSupplier(
      tenantId,
      { ...req.body, ownerActorId: ownerHint }, // owner DERIVADO server-side (body é só hint)
      actionContext.actorId,        // created_by_actor_id = autoria (não autoridade)
      actionContext.actingUserId
    );

    return reply.status(201).send(supplier);
  });

  /**
   * GET /suppliers
   * Lista fornecedores — SÓ os cujo owner empresarial o req.user representa (tenant_id NÃO basta).
   */
  fastify.get('/suppliers', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const userId = req.user?.userId;
    if (!userId) {
      return reply.status(401).send({ error: 'Authentication required' });
    }
    const query = req.query as any;

    const filters: SupplierFilters = {};
    if (query.status) filters.status = query.status as any;
    if (query.search) filters.search = query.search;
    if (query.limit) filters.limit = parseInt(query.limit);
    if (query.offset) filters.offset = parseInt(query.offset);

    const all = await supplierService.listSuppliers(tenantId, filters);
    // Filtra por representabilidade do owner empresarial (dedup por owner). Co-tenant não vaza B2B.
    const repCache = new Map<string, boolean>();
    const suppliers: Supplier[] = [];
    for (const s of all) {
      if (!repCache.has(s.ownerActorId)) {
        repCache.set(s.ownerActorId, await authorizationService.canRepresentActor(tenantId, userId, s.ownerActorId));
      }
      if (repCache.get(s.ownerActorId)) suppliers.push(s);
    }
    return { suppliers };
  });

  /**
   * GET /suppliers/:id
   * Busca fornecedor por ID — exige representar o owner empresarial (404 ausente · 403 sem autoridade).
   */
  fastify.get<{ Params: { id: string } }>('/suppliers/:id', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const userId = req.user?.userId;
    if (!userId) {
      return reply.status(401).send({ error: 'Authentication required' });
    }
    const supplier = await loadAndAuthorizeSupplier(reply, tenantId, userId, req.params.id);
    if (!supplier) return; // 404/403 já enviados
    return reply.send(supplier);
  });
};

export default supplierRoutes;
