// backend/src/modules/marketplace/supplier.routes.ts
// SPRINT 69: Rotas REST para Suppliers

import type { FastifyInstance } from 'fastify';
import { supplierService } from './supplier.service';
import type {
  CreateSupplierInput,
  SupplierFilters,
} from './supplier.types';

const supplierRoutes = async (fastify: FastifyInstance) => {
  /**
   * POST /suppliers
   * Cria fornecedor
   */
  fastify.post<{ Body: CreateSupplierInput }>('/suppliers', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const actionContext = (req as any).actionContext;

    if (!actionContext?.actorId) {
      return reply.status(400).send({ error: 'actorId é obrigatório' });
    }

    const supplier = await supplierService.createSupplier(
      tenantId,
      req.body,
      actionContext.actorId,
      actionContext.actingUserId
    );

    return reply.status(201).send(supplier);
  });

  /**
   * GET /suppliers
   * Lista fornecedores
   */
  fastify.get('/suppliers', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const query = req.query as any;

    const filters: SupplierFilters = {};
    if (query.status) filters.status = query.status as any;
    if (query.search) filters.search = query.search;
    if (query.limit) filters.limit = parseInt(query.limit);
    if (query.offset) filters.offset = parseInt(query.offset);

    const suppliers = await supplierService.listSuppliers(tenantId, filters);
    return { suppliers };
  });

  /**
   * GET /suppliers/:id
   * Busca fornecedor por ID
   */
  fastify.get<{ Params: { id: string } }>('/suppliers/:id', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const { id } = req.params;

    const supplier = await supplierService.getSupplierById(tenantId, id);
    if (!supplier) {
      return reply.status(404).send({ error: 'Fornecedor não encontrado' });
    }

    return supplier;
  });
};

export default supplierRoutes;






