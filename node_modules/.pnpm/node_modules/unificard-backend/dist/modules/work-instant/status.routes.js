"use strict";
// src/modules/work-instant/status.routes.ts
//
// Rotas para transições de status do Work Instant
Object.defineProperty(exports, "__esModule", { value: true });
const instant_repository_1 = require("./instant.repository");
const dispatcher_gateway_1 = require("./dispatcher/dispatcher.gateway");
const tracking_service_1 = require("./tracking.service");
const worker_service_1 = require("../work/workers/worker.service");
const assignment_service_1 = require("../work/assignments/assignment.service");
const instant_types_1 = require("./instant.types");
const statusRoutes = async (fastify) => {
    /**
     * Valida se a transição de status é válida
     */
    const isValidTransition = (currentStatus, newStatus) => {
        // Se não tem status, só pode começar de ACCEPTED
        if (!currentStatus) {
            return newStatus === instant_types_1.InstantJobStatus.ACCEPTED;
        }
        // Transições válidas
        const validTransitions = {
            [instant_types_1.InstantJobStatus.ACCEPTED]: [instant_types_1.InstantJobStatus.EN_ROUTE],
            [instant_types_1.InstantJobStatus.EN_ROUTE]: [instant_types_1.InstantJobStatus.ARRIVED],
            [instant_types_1.InstantJobStatus.ARRIVED]: [instant_types_1.InstantJobStatus.IN_SERVICE],
            [instant_types_1.InstantJobStatus.IN_SERVICE]: [instant_types_1.InstantJobStatus.COMPLETED],
            [instant_types_1.InstantJobStatus.PENDING]: [instant_types_1.InstantJobStatus.ACCEPTED],
            [instant_types_1.InstantJobStatus.COMPLETED]: [],
            [instant_types_1.InstantJobStatus.CANCELLED]: [],
            [instant_types_1.InstantJobStatus.EXPIRED]: [],
        };
        return validTransitions[currentStatus]?.includes(newStatus) || false;
    };
    /**
     * POST /work/instant/:requestId/en-route
     * Worker indica que está a caminho
     */
    fastify.post('/:requestId/en-route', {
        preHandler: fastify.requirePermission(['work:instant:status']),
    }, async (req, reply) => {
        const tenantId = req.tenant.id;
        const workerUserId = req.user.id;
        const requestId = req.params.requestId;
        const requestIdLog = req.requestId || 'unknown';
        try {
            // 1. Buscar request
            const request = instant_repository_1.instantRepository.findById(requestId);
            if (!request) {
                return reply.status(404).send({ error: 'Request not found' });
            }
            // 2. Validar tenant
            if (request.tenantId !== tenantId) {
                return reply.status(403).send({ error: 'Request does not belong to this tenant' });
            }
            // 3. Validar que worker é o responsável
            const worker = await worker_service_1.workerService.getByUserId(tenantId, workerUserId);
            if (!worker || worker.workerId !== request.acceptedByWorkerId) {
                return reply.status(403).send({ error: 'Only the assigned worker can update status' });
            }
            // 4. Validar transição
            if (!isValidTransition(request.jobStatus, instant_types_1.InstantJobStatus.EN_ROUTE)) {
                return reply.status(400).send({
                    error: 'Invalid status transition',
                    currentStatus: request.jobStatus,
                    attemptedStatus: instant_types_1.InstantJobStatus.EN_ROUTE,
                });
            }
            // 5. Atualizar status
            instant_repository_1.instantRepository.updateJobStatus(requestId, instant_types_1.InstantJobStatus.EN_ROUTE, workerUserId);
            // 6. Notificar customer via WebSocket
            dispatcher_gateway_1.dispatcherGateway.broadcastToCustomer(tenantId, request.customerUserId, {
                type: 'STATUS_UPDATE',
                instantRequestId: requestId,
                status: instant_types_1.InstantJobStatus.EN_ROUTE,
                timestamp: new Date().toISOString(),
                workerUserId,
            });
            req.log.info({
                requestId: requestIdLog,
                tenantId,
                workerUserId,
                instantRequestId: requestId,
                newStatus: instant_types_1.InstantJobStatus.EN_ROUTE,
                'work-instant.action': 'status-update',
                source: 'instant_mode',
            }, 'Status updated to EN_ROUTE');
            return reply.status(200).send({
                requestId,
                status: instant_types_1.InstantJobStatus.EN_ROUTE,
                message: 'Status updated to en_route',
            });
        }
        catch (error) {
            req.log.error({
                requestId: requestIdLog,
                tenantId,
                workerUserId,
                instantRequestId: requestId,
                err: error,
            }, 'Error updating status to en_route');
            return reply.status(500).send({ error: 'Failed to update status' });
        }
    });
    /**
     * POST /work/instant/:requestId/arrived
     * Worker indica que chegou ao local
     */
    fastify.post('/:requestId/arrived', {
        preHandler: fastify.requirePermission(['work:instant:status']),
    }, async (req, reply) => {
        const tenantId = req.tenant.id;
        const workerUserId = req.user.id;
        const requestId = req.params.requestId;
        const requestIdLog = req.requestId || 'unknown';
        try {
            const request = instant_repository_1.instantRepository.findById(requestId);
            if (!request) {
                return reply.status(404).send({ error: 'Request not found' });
            }
            if (request.tenantId !== tenantId) {
                return reply.status(403).send({ error: 'Request does not belong to this tenant' });
            }
            const worker = await worker_service_1.workerService.getByUserId(tenantId, workerUserId);
            if (!worker || worker.workerId !== request.acceptedByWorkerId) {
                return reply.status(403).send({ error: 'Only the assigned worker can update status' });
            }
            if (!isValidTransition(request.jobStatus, instant_types_1.InstantJobStatus.ARRIVED)) {
                return reply.status(400).send({
                    error: 'Invalid status transition',
                    currentStatus: request.jobStatus,
                    attemptedStatus: instant_types_1.InstantJobStatus.ARRIVED,
                });
            }
            instant_repository_1.instantRepository.updateJobStatus(requestId, instant_types_1.InstantJobStatus.ARRIVED, workerUserId);
            dispatcher_gateway_1.dispatcherGateway.broadcastToCustomer(tenantId, request.customerUserId, {
                type: 'STATUS_UPDATE',
                instantRequestId: requestId,
                status: instant_types_1.InstantJobStatus.ARRIVED,
                timestamp: new Date().toISOString(),
                workerUserId,
            });
            req.log.info({
                requestId: requestIdLog,
                tenantId,
                workerUserId,
                instantRequestId: requestId,
                newStatus: instant_types_1.InstantJobStatus.ARRIVED,
                'work-instant.action': 'status-update',
                source: 'instant_mode',
            }, 'Status updated to ARRIVED');
            return reply.status(200).send({
                instantRequestId: requestId,
                status: instant_types_1.InstantJobStatus.ARRIVED,
                message: 'Status updated to arrived',
            });
        }
        catch (error) {
            req.log.error({
                requestId: requestIdLog,
                tenantId,
                workerUserId,
                instantRequestId: requestId,
                err: error,
            }, 'Error updating status to arrived');
            return reply.status(500).send({ error: 'Failed to update status' });
        }
    });
    /**
     * POST /work/instant/:requestId/start
     * Worker indica que iniciou o serviço
     */
    fastify.post('/:requestId/start', {
        preHandler: fastify.requirePermission(['work:instant:status']),
    }, async (req, reply) => {
        const tenantId = req.tenant.id;
        const workerUserId = req.user.id;
        const requestId = req.params.requestId;
        const requestIdLog = req.requestId || 'unknown';
        try {
            const request = instant_repository_1.instantRepository.findById(requestId);
            if (!request) {
                return reply.status(404).send({ error: 'Request not found' });
            }
            if (request.tenantId !== tenantId) {
                return reply.status(403).send({ error: 'Request does not belong to this tenant' });
            }
            const worker = await worker_service_1.workerService.getByUserId(tenantId, workerUserId);
            if (!worker || worker.workerId !== request.acceptedByWorkerId) {
                return reply.status(403).send({ error: 'Only the assigned worker can update status' });
            }
            if (!isValidTransition(request.jobStatus, instant_types_1.InstantJobStatus.IN_SERVICE)) {
                return reply.status(400).send({
                    error: 'Invalid status transition',
                    currentStatus: request.jobStatus,
                    attemptedStatus: instant_types_1.InstantJobStatus.IN_SERVICE,
                });
            }
            instant_repository_1.instantRepository.updateJobStatus(requestId, instant_types_1.InstantJobStatus.IN_SERVICE, workerUserId);
            dispatcher_gateway_1.dispatcherGateway.broadcastToCustomer(tenantId, request.customerUserId, {
                type: 'STATUS_UPDATE',
                instantRequestId: requestId,
                status: instant_types_1.InstantJobStatus.IN_SERVICE,
                timestamp: new Date().toISOString(),
                workerUserId,
            });
            req.log.info({
                requestId: requestIdLog,
                tenantId,
                workerUserId,
                instantRequestId: requestId,
                newStatus: instant_types_1.InstantJobStatus.IN_SERVICE,
                'work-instant.action': 'status-update',
                source: 'instant_mode',
            }, 'Status updated to IN_SERVICE');
            return reply.status(200).send({
                instantRequestId: requestId,
                status: instant_types_1.InstantJobStatus.IN_SERVICE,
                message: 'Status updated to in_service',
            });
        }
        catch (error) {
            req.log.error({
                requestId: requestIdLog,
                tenantId,
                workerUserId,
                instantRequestId: requestId,
                err: error,
            }, 'Error updating status to in_service');
            return reply.status(500).send({ error: 'Failed to update status' });
        }
    });
    /**
     * POST /work/instant/:requestId/finish
     * Worker indica que concluiu o serviço
     */
    fastify.post('/:requestId/finish', {
        preHandler: fastify.requirePermission(['work:instant:status']),
    }, async (req, reply) => {
        const tenantId = req.tenant.id;
        const workerUserId = req.user.id;
        const requestId = req.params.requestId;
        const requestIdLog = req.requestId || 'unknown';
        try {
            const request = instant_repository_1.instantRepository.findById(requestId);
            if (!request) {
                return reply.status(404).send({ error: 'Request not found' });
            }
            if (request.tenantId !== tenantId) {
                return reply.status(403).send({ error: 'Request does not belong to this tenant' });
            }
            const worker = await worker_service_1.workerService.getByUserId(tenantId, workerUserId);
            if (!worker || worker.workerId !== request.acceptedByWorkerId) {
                return reply.status(403).send({ error: 'Only the assigned worker can update status' });
            }
            if (!isValidTransition(request.jobStatus, instant_types_1.InstantJobStatus.COMPLETED)) {
                return reply.status(400).send({
                    error: 'Invalid status transition',
                    currentStatus: request.jobStatus,
                    attemptedStatus: instant_types_1.InstantJobStatus.COMPLETED,
                });
            }
            // Atualizar status
            instant_repository_1.instantRepository.updateJobStatus(requestId, instant_types_1.InstantJobStatus.COMPLETED, workerUserId);
            // Encerrar tracking GPS
            tracking_service_1.trackingService.clearTracking(requestId);
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
            // Chamar serviço padrão de conclusão de assignment do Work
            // Isso dispara automaticamente:
            // - Pagamento via Economy Engine (com SplitEngine)
            // - Review universal via core/reviews
            // - Atualização de reputação via core/reputation
            // - Eventos para Orchestrator/Memory/AI
            // 
            // O SplitEngine será usado automaticamente pelo assignmentService.markAsCompleted()
            // e identificará source='work_instant' via metadata
            const completedAssignment = await assignment_service_1.assignmentService.markAsCompleted(tenantId, request.assignmentId, request.customerUserId, // reviewerUserId (customer avalia o worker)
            {
                rating: 5, // Rating padrão (pode ser atualizado depois pelo customer)
                comment: 'Serviço instantâneo concluído',
                // Ratings detalhados opcionais
            }, {
                source: 'work_instant', // Identificar que veio do Work Instant
                metadata: {
                    instantRequestId: requestId,
                    source: 'work_instant',
                },
            });
            // Notificar customer
            dispatcher_gateway_1.dispatcherGateway.broadcastToCustomer(tenantId, request.customerUserId, {
                type: 'STATUS_UPDATE',
                requestId,
                status: instant_types_1.InstantJobStatus.COMPLETED,
                timestamp: new Date().toISOString(),
                workerUserId,
            });
            req.log.info({
                requestId: requestIdLog,
                tenantId,
                workerUserId,
                assignmentId: request.assignmentId,
                instantRequestId: requestId,
                newStatus: instant_types_1.InstantJobStatus.COMPLETED,
                transactionId: completedAssignment.paymentTransactionId || null,
                'work-instant.action': 'finish-with-settlement',
                source: 'instant_mode',
            }, 'Instant job finished and routed through Work assignment completion');
            return reply.status(200).send({
                requestId,
                status: instant_types_1.InstantJobStatus.COMPLETED,
                assignmentId: request.assignmentId,
                transactionId: completedAssignment.paymentTransactionId || null,
                message: 'Status updated to completed',
            });
        }
        catch (error) {
            req.log.error({
                requestId: requestIdLog,
                tenantId,
                workerUserId,
                instantRequestId: requestId,
                err: error,
            }, 'Error updating status to completed');
            return reply.status(500).send({ error: 'Failed to update status' });
        }
    });
};
exports.default = statusRoutes;
//# sourceMappingURL=status.routes.js.map