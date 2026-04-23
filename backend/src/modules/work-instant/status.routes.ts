// src/modules/work-instant/status.routes.ts
//
// Rotas para transições de status do Work Instant

import { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { instantRepository } from './instant.repository';
import { dispatcherGateway } from './dispatcher/dispatcher.gateway';
import { trackingService } from './tracking.service';
import { workerService } from '../work/workers/worker.service';
import { assignmentService } from '../work/assignments/assignment.service';
import { rbacService } from '@core/rbac/rbac.service';
import { InstantJobStatus } from './instant.types';
import { ensureUserActor } from '@modules/identity/actor-writer.service';
import { requireFinancialRiskClearance } from '@modules/risk-identity/risk-financial-gate';

interface StatusParams {
  requestId: string;
}

const statusRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * Valida se a transição de status é válida
   */
  const isValidTransition = (
    currentStatus: InstantJobStatus | undefined,
    newStatus: InstantJobStatus
  ): boolean => {
    // Se não tem status, só pode começar de ACCEPTED
    if (!currentStatus) {
      return newStatus === InstantJobStatus.ACCEPTED;
    }

    // Transições válidas
    const validTransitions: Record<InstantJobStatus, InstantJobStatus[]> = {
      [InstantJobStatus.ACCEPTED]: [InstantJobStatus.EN_ROUTE],
      [InstantJobStatus.EN_ROUTE]: [InstantJobStatus.ARRIVED],
      [InstantJobStatus.ARRIVED]: [InstantJobStatus.IN_SERVICE],
      [InstantJobStatus.IN_SERVICE]: [InstantJobStatus.COMPLETED],
      [InstantJobStatus.PENDING]: [InstantJobStatus.ACCEPTED],
      [InstantJobStatus.COMPLETED]: [],
      [InstantJobStatus.CANCELLED]: [],
      [InstantJobStatus.EXPIRED]: [],
    };

    return validTransitions[currentStatus]?.includes(newStatus) || false;
  };

  /**
   * POST /work/instant/:requestId/en-route
   * Worker indica que está a caminho
   */
  fastify.post<{ Params: StatusParams }>(
    '/:requestId/en-route',
    {
      preHandler: fastify.requirePermission(['work:instant:status']),
    },
    async (req, reply) => {
      const tenantId = req.tenant!.id;
      const workerUserId = req.user!.id;
      const requestId = req.params.requestId;
      const requestIdLog = req.requestId || 'unknown';

      try {
        // 1. Buscar request
        const request = instantRepository.findById(requestId);
        if (!request) {
          return reply.status(404).send({ error: 'Request not found' });
        }

        // 2. Validar tenant
        if (request.tenantId !== tenantId) {
          return reply.status(403).send({ error: 'Request does not belong to this tenant' });
        }

        // 3. Validar que worker é o responsável
        const worker = await workerService.getByUserId(tenantId, workerUserId);
        if (!worker || worker.workerId !== request.acceptedByWorkerId) {
          return reply.status(403).send({ error: 'Only the assigned worker can update status' });
        }

        // 4. Validar transição
        if (!isValidTransition(request.jobStatus, InstantJobStatus.EN_ROUTE)) {
          return reply.status(400).send({
            error: 'Invalid status transition',
            currentStatus: request.jobStatus,
            attemptedStatus: InstantJobStatus.EN_ROUTE,
          });
        }

        // 5. Atualizar status
        instantRepository.updateJobStatus(requestId, InstantJobStatus.EN_ROUTE, workerUserId);

        // 6. Notificar customer via WebSocket
        dispatcherGateway.broadcastToCustomer(tenantId, request.customerUserId, {
          type: 'STATUS_UPDATE',
          instantRequestId: requestId,
          status: InstantJobStatus.EN_ROUTE,
          timestamp: new Date().toISOString(),
          workerUserId,
        });

        req.log.info({
          requestId: requestIdLog,
          tenantId,
          workerUserId,
          instantRequestId: requestId,
          newStatus: InstantJobStatus.EN_ROUTE,
          'work-instant.action': 'status-update',
          source: 'instant_mode',
        }, 'Status updated to EN_ROUTE');

        return reply.status(200).send({
          requestId,
          status: InstantJobStatus.EN_ROUTE,
          message: 'Status updated to en_route',
        });
      } catch (error) {
        req.log.error({
          requestId: requestIdLog,
          tenantId,
          workerUserId,
          instantRequestId: requestId,
          err: error,
        }, 'Error updating status to en_route');
        return reply.status(500).send({ error: 'Failed to update status' });
      }
    }
  );

  /**
   * POST /work/instant/:requestId/arrived
   * Worker indica que chegou ao local
   */
  fastify.post<{ Params: StatusParams }>(
    '/:requestId/arrived',
    {
      preHandler: fastify.requirePermission(['work:instant:status']),
    },
    async (req, reply) => {
      const tenantId = req.tenant!.id;
      const workerUserId = req.user!.id;
      const requestId = req.params.requestId;
      const requestIdLog = req.requestId || 'unknown';

      try {
        const request = instantRepository.findById(requestId);
        if (!request) {
          return reply.status(404).send({ error: 'Request not found' });
        }

        if (request.tenantId !== tenantId) {
          return reply.status(403).send({ error: 'Request does not belong to this tenant' });
        }

        const worker = await workerService.getByUserId(tenantId, workerUserId);
        if (!worker || worker.workerId !== request.acceptedByWorkerId) {
          return reply.status(403).send({ error: 'Only the assigned worker can update status' });
        }

        if (!isValidTransition(request.jobStatus, InstantJobStatus.ARRIVED)) {
          return reply.status(400).send({
            error: 'Invalid status transition',
            currentStatus: request.jobStatus,
            attemptedStatus: InstantJobStatus.ARRIVED,
          });
        }

        instantRepository.updateJobStatus(requestId, InstantJobStatus.ARRIVED, workerUserId);

        dispatcherGateway.broadcastToCustomer(tenantId, request.customerUserId, {
          type: 'STATUS_UPDATE',
          instantRequestId: requestId,
          status: InstantJobStatus.ARRIVED,
          timestamp: new Date().toISOString(),
          workerUserId,
        });

        req.log.info({
          requestId: requestIdLog,
          tenantId,
          workerUserId,
          instantRequestId: requestId,
          newStatus: InstantJobStatus.ARRIVED,
          'work-instant.action': 'status-update',
          source: 'instant_mode',
        }, 'Status updated to ARRIVED');

        return reply.status(200).send({
          instantRequestId: requestId,
          status: InstantJobStatus.ARRIVED,
          message: 'Status updated to arrived',
        });
      } catch (error) {
        req.log.error({
          requestId: requestIdLog,
          tenantId,
          workerUserId,
          instantRequestId: requestId,
          err: error,
        }, 'Error updating status to arrived');
        return reply.status(500).send({ error: 'Failed to update status' });
      }
    }
  );

  /**
   * POST /work/instant/:requestId/start
   * Worker indica que iniciou o serviço
   */
  fastify.post<{ Params: StatusParams }>(
    '/:requestId/start',
    {
      preHandler: fastify.requirePermission(['work:instant:status']),
    },
    async (req, reply) => {
      const tenantId = req.tenant!.id;
      const workerUserId = req.user!.id;
      const requestId = req.params.requestId;
      const requestIdLog = req.requestId || 'unknown';

      try {
        const request = instantRepository.findById(requestId);
        if (!request) {
          return reply.status(404).send({ error: 'Request not found' });
        }

        if (request.tenantId !== tenantId) {
          return reply.status(403).send({ error: 'Request does not belong to this tenant' });
        }

        const worker = await workerService.getByUserId(tenantId, workerUserId);
        if (!worker || worker.workerId !== request.acceptedByWorkerId) {
          return reply.status(403).send({ error: 'Only the assigned worker can update status' });
        }

        if (!isValidTransition(request.jobStatus, InstantJobStatus.IN_SERVICE)) {
          return reply.status(400).send({
            error: 'Invalid status transition',
            currentStatus: request.jobStatus,
            attemptedStatus: InstantJobStatus.IN_SERVICE,
          });
        }

        instantRepository.updateJobStatus(requestId, InstantJobStatus.IN_SERVICE, workerUserId);

        dispatcherGateway.broadcastToCustomer(tenantId, request.customerUserId, {
          type: 'STATUS_UPDATE',
          instantRequestId: requestId,
          status: InstantJobStatus.IN_SERVICE,
          timestamp: new Date().toISOString(),
          workerUserId,
        });

        req.log.info({
          requestId: requestIdLog,
          tenantId,
          workerUserId,
          instantRequestId: requestId,
          newStatus: InstantJobStatus.IN_SERVICE,
          'work-instant.action': 'status-update',
          source: 'instant_mode',
        }, 'Status updated to IN_SERVICE');

        return reply.status(200).send({
          instantRequestId: requestId,
          status: InstantJobStatus.IN_SERVICE,
          message: 'Status updated to in_service',
        });
      } catch (error) {
        req.log.error({
          requestId: requestIdLog,
          tenantId,
          workerUserId,
          instantRequestId: requestId,
          err: error,
        }, 'Error updating status to in_service');
        return reply.status(500).send({ error: 'Failed to update status' });
      }
    }
  );

  /**
   * POST /work/instant/:requestId/finish
   * Worker indica que concluiu o serviço
   */
  fastify.post<{ Params: StatusParams }>(
    '/:requestId/finish',
    {
      preHandler: fastify.requirePermission(['work:instant:status']),
    },
    async (req, reply) => {
      const tenantId = req.tenant!.id;
      const workerUserId = req.user!.id;
      const requestId = req.params.requestId;
      const requestIdLog = req.requestId || 'unknown';

      try {
        const request = instantRepository.findById(requestId);
        if (!request) {
          return reply.status(404).send({ error: 'Request not found' });
        }

        if (request.tenantId !== tenantId) {
          return reply.status(403).send({ error: 'Request does not belong to this tenant' });
        }

        const worker = await workerService.getByUserId(tenantId, workerUserId);
        if (!worker || worker.workerId !== request.acceptedByWorkerId) {
          return reply.status(403).send({ error: 'Only the assigned worker can update status' });
        }

        if (!isValidTransition(request.jobStatus, InstantJobStatus.COMPLETED)) {
          return reply.status(400).send({
            error: 'Invalid status transition',
            currentStatus: request.jobStatus,
            attemptedStatus: InstantJobStatus.COMPLETED,
          });
        }

        // Atualizar status
        instantRepository.updateJobStatus(requestId, InstantJobStatus.COMPLETED, workerUserId);

        // Encerrar tracking GPS
        trackingService.clearTracking(requestId);

        // Integrar com fluxo de conclusão de assignment do Work
        if (!request.assignmentId) {
          req.log.error({
            requestId: requestIdLog,
            tenantId,
            workerUserId,
            instantRequestId: requestId,
            err: 'Assignment ID not found in InstantRequest',
          }, 'Cannot complete assignment: assignmentId missing');
          return reply.status(500).send({
            error: 'Internal error: assignment ID not found',
          });
        }

        // AUTORIDADE: gate financeiro antes de markAsCompleted (INV-FIN)
        // actorId = customer (quem paga), não o chamador HTTP da rota
        // LIMITAÇÃO documentada: amountCents calculado no domínio (split.service), não disponível aqui
        const customerActor = await ensureUserActor(tenantId, request.customerUserId);
        if (!customerActor?.id) {
          throw Object.assign(new Error('ACTOR_ID_NOT_RESOLVED'), { statusCode: 400 });
        }
        await requireFinancialRiskClearance(tenantId, {
          actorId: customerActor.id,
          action: 'financial_transfer',
          // amountCents ausente: valor real calculado pelo split.service downstream
        });

        // Chamar serviço padrão de conclusão de assignment do Work
        // Isso dispara automaticamente:
        // - Pagamento via Economy Engine (com SplitEngine)
        // - Review universal via core/reviews
        // - Atualização de reputação via core/reputation
        // - Eventos para Orchestrator/Memory/AI
        //
        // O SplitEngine será usado automaticamente pelo assignmentService.markAsCompleted()
        // e identificará source='work_instant' via metadata
        const completedAssignment = await assignmentService.markAsCompleted(
          tenantId,
          request.assignmentId,
          request.customerUserId, // reviewerUserId (customer avalia o worker)
          {
            rating: 5, // Rating padrão (pode ser atualizado depois pelo customer)
            comment: 'Serviço instantâneo concluído',
            // Ratings detalhados opcionais
          },
          {
            source: 'work_instant', // Identificar que veio do Work Instant
            metadata: {
              instantRequestId: requestId,
              source: 'work_instant',
            },
          }
        );

        // Notificar customer
        dispatcherGateway.broadcastToCustomer(tenantId, request.customerUserId, {
          type: 'STATUS_UPDATE',
          requestId,
          status: InstantJobStatus.COMPLETED,
          timestamp: new Date().toISOString(),
          workerUserId,
        });

        req.log.info({
          requestId: requestIdLog,
          tenantId,
          workerUserId,
          assignmentId: request.assignmentId,
          instantRequestId: requestId,
          newStatus: InstantJobStatus.COMPLETED,
          transactionId: completedAssignment.paymentTransactionId || null,
          'work-instant.action': 'finish-with-settlement',
          source: 'instant_mode',
        }, 'Instant job finished and routed through Work assignment completion');

        return reply.status(200).send({
          requestId,
          status: InstantJobStatus.COMPLETED,
          assignmentId: request.assignmentId,
          transactionId: completedAssignment.paymentTransactionId || null,
          message: 'Status updated to completed',
        });
      } catch (error) {
        req.log.error({
          requestId: requestIdLog,
          tenantId,
          workerUserId,
          instantRequestId: requestId,
          err: error,
        }, 'Error updating status to completed');
        return reply.status(500).send({ error: 'Failed to update status' });
      }
    }
  );
};

export default statusRoutes;

