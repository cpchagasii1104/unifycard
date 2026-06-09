import type { FastifyInstance } from 'fastify';
import { requirePermission } from '@core/authorization/require-permission.guard';
import { authorizationService } from '@core/authorization/authorization.service';
import { marketplaceService } from '../marketplace.service';
import { marketplaceLogger } from '../marketplace.logger';
import { AppError, BadRequestError, NotFoundError, UnauthorizedError } from '@core/errors';
import { ErrorCode } from '@core/errors/error-codes';

export async function registerSlaRoutes(fastify: FastifyInstance) {
  // ============================================================
  // GOVERNANÇA, SLA, REPUTAÇÃO E RISCO
  // ============================================================

  // POST /marketplace/sla-contracts
  fastify.post<{
    Body: {
      actor_type: 'store' | 'hub' | 'industry' | 'service_provider';
      actor_id: string;
      metrics: {
        fulfilled_at: { target_hours: number; max_hours: number };
        cancellation_rate: { target_percentage: number; max_percentage: number };
        dispute_rate: { target_percentage: number; max_percentage: number };
      };
      thresholds: {
        warning: {
          fulfillment_time_hours: number;
          cancellation_rate_percentage: number;
          dispute_rate_percentage: number;
        };
        violation: {
          fulfillment_time_hours: number;
          cancellation_rate_percentage: number;
          dispute_rate_percentage: number;
        };
      };
      penalties: {
        fulfillment_time_violation: { type: 'percentage' | 'fixed'; valueCents: number; redirect_to: 'regional_fund' | 'customer' | 'platform' };
        cancellation_rate_violation: { type: 'percentage' | 'fixed'; valueCents: number; redirect_to: 'regional_fund' | 'customer' | 'platform' };
        dispute_rate_violation: { type: 'percentage' | 'fixed'; valueCents: number; redirect_to: 'regional_fund' | 'customer' | 'platform' };
      };
    };
  }>('/sla-contracts', {
    preHandler: requirePermission('marketplace_manage_catalog'),
  }, async (req, reply) => {
    try {
      const body = req.body;
      const input = {
        actorType: body.actor_type,
        actorId: body.actor_id,
        metrics: {
          fulfillmentTime: {
            targetHours: body.metrics.fulfilled_at.target_hours,
            maxHours: body.metrics.fulfilled_at.max_hours,
          },
          cancellationRate: {
            targetPercentage: body.metrics.cancellation_rate.target_percentage,
            maxPercentage: body.metrics.cancellation_rate.max_percentage,
          },
          disputeRate: {
            targetPercentage: body.metrics.dispute_rate.target_percentage,
            maxPercentage: body.metrics.dispute_rate.max_percentage,
          },
        },
        thresholds: {
          warning: {
            fulfillmentTimeHours: body.thresholds.warning.fulfillment_time_hours,
            cancellationRatePercentage: body.thresholds.warning.cancellation_rate_percentage,
            disputeRatePercentage: body.thresholds.warning.dispute_rate_percentage,
          },
          violation: {
            fulfillmentTimeHours: body.thresholds.violation.fulfillment_time_hours,
            cancellationRatePercentage: body.thresholds.violation.cancellation_rate_percentage,
            disputeRatePercentage: body.thresholds.violation.dispute_rate_percentage,
          },
        },
        penalties: {
          fulfillmentTimeViolation: {
            type: body.penalties.fulfillment_time_violation.type,
            valueCents: body.penalties.fulfillment_time_violation.valueCents,
            redirectTo: body.penalties.fulfillment_time_violation.redirect_to,
          },
          cancellationRateViolation: {
            type: body.penalties.cancellation_rate_violation.type,
            valueCents: body.penalties.cancellation_rate_violation.valueCents,
            redirectTo: body.penalties.cancellation_rate_violation.redirect_to,
          },
          disputeRateViolation: {
            type: body.penalties.dispute_rate_violation.type,
            valueCents: body.penalties.dispute_rate_violation.valueCents,
            redirectTo: body.penalties.dispute_rate_violation.redirect_to,
          },
        },
      };
      const sla = marketplaceService.governance.createSLAContract(input);
      marketplaceLogger.api('SLA contract criado', { slaId: sla.slaId });
      return reply.status(201).send(sla);
    } catch (error: unknown) {
      marketplaceLogger.error('Erro ao criar SLA contract', error as Error);
      if (error instanceof AppError) throw error;
      throw new BadRequestError(
        error instanceof Error ? error.message : 'Erro ao criar contrato de SLA',
        ErrorCode.BAD_REQUEST
      );
    }
  });

  // GET /marketplace/sla-contracts/:slaId
  fastify.get<{ Params: { slaId: string } }>('/sla-contracts/:slaId', {
    preHandler: requirePermission('marketplace_manage_catalog'),
  }, async (req, reply) => {
    try {
      const { slaId } = req.params;
      const sla = marketplaceService.governance.getSLAContract(slaId);

      if (!sla) {
        throw new NotFoundError('SLA contract não encontrado');
      }

      return reply.status(200).send(sla);
    } catch (error: unknown) {
      marketplaceLogger.error('Erro ao buscar SLA contract', error as Error);
      if (error instanceof AppError) throw error;
      throw new BadRequestError(
        error instanceof Error ? error.message : 'Erro ao buscar contrato de SLA',
        ErrorCode.BAD_REQUEST
      );
    }
  });

  // POST /marketplace/reputation-snapshots/generate
  fastify.post<{
    Body: {
      actor_id: string;
      actor_type: 'store' | 'hub' | 'industry' | 'service_provider';
      year: number;
      month: number;
    };
  }>('/reputation-snapshots/generate', {
    preHandler: requirePermission('marketplace_manage_catalog'),
  }, async (req, reply) => {
    try {
      const snapshot = marketplaceService.governance.generateReputationSnapshot(
        req.body.actor_id,
        req.body.actor_type,
        req.body.year,
        req.body.month
      );
      marketplaceLogger.api('Reputation snapshot gerado', { snapshot_id: snapshot.snapshotId });
      return reply.status(201).send(snapshot);
    } catch (error: unknown) {
      marketplaceLogger.error('Erro ao gerar reputation snapshot', error as Error);
      if (error instanceof AppError) throw error;
      throw new BadRequestError(
        error instanceof Error ? error.message : 'Erro ao gerar snapshot de reputação',
        ErrorCode.BAD_REQUEST
      );
    }
  });

  // GET /marketplace/reputation-snapshots/:actorId
  fastify.get<{ Params: { actorId: string } }>('/reputation-snapshots/:actorId', {
    preHandler: requirePermission('marketplace_manage_catalog'),
  }, async (req, reply) => {
    try {
      if (!req.tenant) {
        throw new UnauthorizedError('Tenant required');
      }
      const tenantId = req.tenant.id;
      const { actorId } = req.params;

      // 🔴 DECISION-0113: reputation snapshot é actor-target. Hoje Map in-memory, mas pode vazar o snapshot
      // efêmero de B se gerado no mesmo processo. `can_manage_marketplace` (default de company) não autoriza
      // ler reputation de actor alheio. `:actorId` é HINT → exigir representá-lo ANTES de `getReputationSnapshots`.
      const userId = (req as { user?: { userId?: string } }).user?.userId;
      if (!userId) {
        return reply.status(401).send({ error: 'Autenticação obrigatória (req.user.userId)' });
      }
      let canRep = false;
      try {
        canRep = await authorizationService.canRepresentActor(tenantId, userId, actorId);
      } catch {
        canRep = false;
      }
      if (!canRep) {
        return reply.status(403).send({ error: 'Sem autoridade sobre o actor (canRepresentActor)', code: 'MARKETPLACE_ACTOR_NOT_REPRESENTABLE' });
      }

      const snapshots = marketplaceService.governance.getReputationSnapshots(actorId);
      return reply.status(200).send({ snapshots });
    } catch (error: unknown) {
      marketplaceLogger.error('Erro ao buscar reputation snapshots', error as Error);
      if (error instanceof AppError) throw error;
      throw new BadRequestError(
        error instanceof Error ? error.message : 'Erro ao buscar snapshots',
        ErrorCode.BAD_REQUEST
      );
    }
  });

  // POST /marketplace/payment-plan/:paymentPlanId/apply-sla-penalties
  fastify.post<{ Params: { paymentPlanId: string } }>('/payment-plan/:paymentPlanId/apply-sla-penalties', {
    preHandler: requirePermission('marketplace_execute_payments'),
  }, async (req, reply) => {
    try {
      const { paymentPlanId } = req.params;
      const paymentPlan = marketplaceService.governance.applySLAPenaltiesToPaymentPlan(paymentPlanId);
      marketplaceLogger.api('SLA penalties aplicadas', { payment_plan_id: paymentPlanId });
      return reply.status(200).send(paymentPlan);
    } catch (error: unknown) {
      marketplaceLogger.error('Erro ao aplicar SLA penalties', error as Error);
      if (error instanceof AppError) throw error;
      throw new BadRequestError(
        error instanceof Error ? error.message : 'Erro ao aplicar penalidades de SLA',
        ErrorCode.BAD_REQUEST
      );
    }
  });

  // POST /marketplace/disputes
  fastify.post<{
    Body: {
      order_id: string;
      checkout_id?: string;
      actor_involved: {
        actor_id: string;
        actor_type: 'store' | 'hub' | 'industry' | 'service_provider' | 'customer';
        role: 'seller' | 'fulfillment' | 'buyer' | 'platform';
      };
      type: 'delivery' | 'quality' | 'payment' | 'cancellation' | 'other';
      description: string;
    };
  }>('/disputes', {
    preHandler: requirePermission('marketplace_manage_orders'),
  }, async (req, reply) => {
    try {
      const body = req.body;
      const input = {
        orderId: body.order_id,
        checkoutId: body.checkout_id,
        actorInvolved: {
          actorId: body.actor_involved.actor_id,
          actorType: body.actor_involved.actor_type,
          role: body.actor_involved.role,
        },
        type: body.type,
        description: body.description,
      };
      const dispute = marketplaceService.governance.createDisputeCase(input);
      marketplaceLogger.api('Dispute case criado', { dispute_id: dispute.disputeId });
      return reply.status(201).send(dispute);
    } catch (error: unknown) {
      marketplaceLogger.error('Erro ao criar dispute case', error as Error);
      if (error instanceof AppError) throw error;
      throw new BadRequestError(
        error instanceof Error ? error.message : 'Erro ao criar caso de disputa',
        ErrorCode.BAD_REQUEST
      );
    }
  });

  // POST /marketplace/disputes/:disputeId/resolve
  fastify.post<{
    Params: { disputeId: string };
    Body: {
      resolution_type: 'refund' | 'partial_refund' | 'replacement' | 'credit' | 'dismissed';
      amountCents: number;
      currency?: string;
      resolved_by: string;
      notes?: string;
    };
  }>('/disputes/:disputeId/resolve', {
    preHandler: requirePermission('marketplace_manage_orders'),
  }, async (req, reply) => {
    try {
      if (!req.tenant) {
        throw new UnauthorizedError('Tenant required');
      }
      const tenantId = req.tenant.id;
      const { disputeId } = req.params;
      const body = req.body as { resolution_type?: string; resolutionType?: string; resolved_by?: string; resolvedBy?: string; amountCents: number; currency?: string; notes?: string };
      const dispute = await marketplaceService.governance.resolveDisputeCase(tenantId, disputeId, {
        resolutionType: (body.resolutionType ?? body.resolution_type ?? 'dismissed') as 'refund' | 'partial_refund' | 'replacement' | 'credit' | 'dismissed',
        amountCents: body.amountCents,
        currency: body.currency,
        resolvedBy: body.resolvedBy ?? body.resolved_by ?? '',
        notes: body.notes,
      });
      marketplaceLogger.api('Dispute case resolvido', { dispute_id: disputeId });
      return reply.status(200).send(dispute);
    } catch (error: unknown) {
      marketplaceLogger.error('Erro ao resolver dispute case', error as Error);
      if (error instanceof AppError) throw error;
      throw new BadRequestError(
        error instanceof Error ? error.message : 'Erro ao resolver caso de disputa',
        ErrorCode.BAD_REQUEST
      );
    }
  });

  // GET /marketplace/disputes/:disputeId
  fastify.get<{ Params: { disputeId: string } }>('/disputes/:disputeId', {
    preHandler: requirePermission('marketplace_manage_orders'),
  }, async (req, reply) => {
    try {
      const { disputeId } = req.params;
      const dispute = marketplaceService.governance.getDisputeCase(disputeId);

      if (!dispute) {
        throw new NotFoundError('Dispute case não encontrado');
      }

      return reply.status(200).send(dispute);
    } catch (error: unknown) {
      marketplaceLogger.error('Erro ao buscar dispute case', error as Error);
      if (error instanceof AppError) throw error;
      throw new BadRequestError(
        error instanceof Error ? error.message : 'Erro ao buscar caso de disputa',
        ErrorCode.BAD_REQUEST
      );
    }
  });

  // GET /marketplace/disputes/order/:orderId
  fastify.get<{ Params: { orderId: string } }>('/disputes/order/:orderId', {
    preHandler: requirePermission('marketplace_manage_orders'),
  }, async (req, reply) => {
    try {
      const { orderId } = req.params;
      const disputes = marketplaceService.governance.getDisputesByOrder(orderId);
      return reply.status(200).send({ disputes });
    } catch (error: unknown) {
      marketplaceLogger.error('Erro ao buscar disputes do pedido', error as Error);
      if (error instanceof AppError) throw error;
      throw new BadRequestError(
        error instanceof Error ? error.message : 'Erro ao buscar disputas',
        ErrorCode.BAD_REQUEST
      );
    }
  });
}