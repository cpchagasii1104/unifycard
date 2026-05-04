import type { FastifyInstance } from 'fastify';
import { requirePermission } from '@core/authorization/require-permission.guard';
import { marketplaceService } from '../marketplace.service';
import { marketplaceLogger } from '../marketplace.logger';
import { AppError, BadRequestError, NotFoundError, UnauthorizedError, ForbiddenError, InternalServerError, ConflictError } from '@core/errors';
import { ErrorCode } from '@core/errors/error-codes';

export async function registerB2BContractsRoutes(fastify: FastifyInstance) {
  // ============================================================
  // SISTEMA DE CONTRATOS COMERCIAIS B2B ENTRE ATORES
  // ============================================================

  // POST /marketplace/b2b-contracts
  fastify.post<{
    Body: {
      supplier_id: string;
      supplier_type: 'store' | 'hub' | 'industry';
      buyer_id: string;
      buyer_type: 'store' | 'hub';
      region: { country: string; state: string; city: string };
      products: Array<{
        product_id: string;
        name: string;
        unit_price: number;
        currency: string;
        minimum_quantity: number;
        maximum_quantity?: number;
      }>;
      terms: {
        volume_commitment: number;
        delivery_schedule: 'weekly' | 'monthly' | 'quarterly';
        payment_terms: 'net_15' | 'net_30' | 'net_60' | 'prepaid';
        penalty_rate?: number;
      };
      starts_at: string;
      ends_at: string;
    };
  }>('/b2b-contracts', {
    preHandler: requirePermission('marketplace_manage_catalog'),
  }, async (req, reply) => {
    try {
      if (!req.tenant) {
        throw new UnauthorizedError('Tenant required');
      }
      const tenantId = req.tenant.id;
      const body = req.body;
      const contract = await marketplaceService.b2b.createB2BContract(tenantId, {
        supplierId: body.supplier_id,
        supplierType: body.supplier_type,
        buyerId: body.buyer_id,
        buyerType: body.buyer_type,
        region: body.region,
        products: body.products.map((p: { product_id: string; name: string; unit_price: number; currency: string; minimum_quantity: number; maximum_quantity?: number }) => ({
          productId: p.product_id,
          name: p.name,
          unitPrice: p.unit_price,
          currency: p.currency,
          minimumQuantity: p.minimum_quantity,
          maximumQuantity: p.maximum_quantity,
        })),
        terms: {
          volumeCommitment: body.terms.volume_commitment,
          deliverySchedule: body.terms.delivery_schedule,
          paymentTerms: body.terms.payment_terms,
          penaltyRate: body.terms.penalty_rate,
        },
        startDate: body.starts_at,
        endDate: body.ends_at,
      });
      marketplaceLogger.api('Contrato B2B criado', { contractId: contract.contractId });
      return reply.status(201).send(contract);
    } catch (error: unknown) {
      marketplaceLogger.error('Erro ao criar contrato B2B', error as Error);
      if (error instanceof AppError) throw error;
      throw new BadRequestError(
        error instanceof Error ? error.message : 'Erro ao criar contrato',
        ErrorCode.BAD_REQUEST
      );
    }
  });

  // POST /marketplace/b2b-contracts/:contractId/sign
  fastify.post<{ Params: { contractId: string } }>('/b2b-contracts/:contractId/sign', {
    preHandler: requirePermission('marketplace_manage_catalog'),
  }, async (req, reply) => {
    try {
      const { contractId } = req.params;
      const contract = marketplaceService.b2b.signB2BContract(contractId);
      marketplaceLogger.api('Contrato B2B assinado', { contractId });
      return reply.status(200).send(contract);
    } catch (error: unknown) {
      marketplaceLogger.error('Erro ao assinar contrato B2B', error as Error);
      if (error instanceof AppError) throw error;
      throw new BadRequestError(
        error instanceof Error ? error.message : 'Erro ao assinar contrato',
        ErrorCode.BAD_REQUEST
      );
    }
  });

  // POST /marketplace/b2b-contracts/:contractId/execute
  fastify.post<{
    Params: { contractId: string };
    Body: {
      products: Array<{
        product_id: string;
        quantity: number;
      }>;
      delivered_at: string;
    };
  }>('/b2b-contracts/:contractId/execute', {
    preHandler: requirePermission('marketplace_manage_catalog'),
  }, async (req, reply) => {
    try {
      const { contractId } = req.params;
      const body = req.body;
      const execution = await marketplaceService.b2b.executeB2BContract({
        contractId,
        products: body.products.map((p: { product_id: string; quantity: number }) => ({
          productId: p.product_id,
          quantity: p.quantity,
        })),
        deliveredAt: body.delivered_at,
      });
      marketplaceLogger.api('Contrato B2B executado', {
        executionId: execution.executionId,
        contractId,
      });
      return reply.status(201).send(execution);
    } catch (error: unknown) {
      marketplaceLogger.error('Erro ao executar contrato B2B', error as Error);
      if (error instanceof AppError) throw error;
      throw new BadRequestError(
        error instanceof Error ? error.message : 'Erro ao executar contrato',
        ErrorCode.BAD_REQUEST
      );
    }
  });

  // GET /marketplace/b2b-contracts/actor/:actorId
  fastify.get<{
    Params: { actorId: string };
    Querystring: { role: 'supplier' | 'buyer' };
  }>('/b2b-contracts/actor/:actorId', {
    preHandler: requirePermission('marketplace_manage_catalog'),
  }, async (req, reply) => {
    try {
      const { actorId } = req.params;
      const { role } = req.query;
      if (!role || (role !== 'supplier' && role !== 'buyer')) {
        throw new BadRequestError('Role deve ser "supplier" ou "buyer"', ErrorCode.VALIDATION_ERROR);
      }
      const contracts = marketplaceService.b2b.getB2BContractsByActor(actorId, role);
      return reply.status(200).send({ contracts });
    } catch (error: unknown) {
      marketplaceLogger.error('Erro ao buscar contratos B2B', error as Error);
      if (error instanceof AppError) throw error;
      throw new BadRequestError(
        error instanceof Error ? error.message : 'Erro ao buscar contratos',
        ErrorCode.BAD_REQUEST
      );
    }
  });

  // GET /marketplace/b2b-contracts/:contractId/executions
  fastify.get<{ Params: { contractId: string } }>('/b2b-contracts/:contractId/executions', {
    preHandler: requirePermission('marketplace_manage_catalog'),
  }, async (req, reply) => {
    try {
      const { contractId } = req.params;
      const executions = marketplaceService.b2b.getB2BContractExecutions(contractId);
      return reply.status(200).send({ executions });
    } catch (error: unknown) {
      marketplaceLogger.error('Erro ao buscar execuções de contrato B2B', error as Error);
      if (error instanceof AppError) throw error;
      throw new BadRequestError(
        error instanceof Error ? error.message : 'Erro ao buscar execuções',
        ErrorCode.BAD_REQUEST
      );
    }
  });
}