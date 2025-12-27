"use strict";
// src/modules/work-instant/instant.service.ts
//
// Serviço de matching em tempo real para Work Instant
Object.defineProperty(exports, "__esModule", { value: true });
exports.instantService = void 0;
const uuid_1 = require("uuid");
const instant_repository_1 = require("./instant.repository");
const job_service_1 = require("../work/jobs/job.service");
const assignment_service_1 = require("../work/assignments/assignment.service");
const worker_service_1 = require("../work/workers/worker.service");
const worker_status_service_1 = require("./worker-status.service");
const smart_matching_service_1 = require("./smart-matching.service");
const dispatcher_gateway_1 = require("./dispatcher/dispatcher.gateway");
const tracking_service_1 = require("./tracking.service");
const instant_types_1 = require("./instant.types");
class InstantService {
    /**
     * Busca workers online de uma categoria
     * Usa workerStatusService para buscar workers online com localização
     */
    async findOnlineWorkersByCategory(tenantId, categoryId, latitude, longitude, radiusKm = 10) {
        // Usar workerStatusService para buscar workers online
        const onlineWorkers = await worker_status_service_1.workerStatusService.getOnlineWorkersByCategory(tenantId, categoryId, latitude, longitude, radiusKm);
        // Buscar informações adicionais dos workers (reputação, etc.)
        const matches = [];
        for (const onlineWorker of onlineWorkers) {
            // Buscar worker completo para obter reputação
            const worker = await worker_service_1.workerService.getById(tenantId, onlineWorker.workerId);
            if (worker) {
                matches.push({
                    workerId: onlineWorker.workerId,
                    userId: onlineWorker.userId,
                    distance: onlineWorker.distance,
                    rating: worker.reputationScore,
                    estimatedTime: onlineWorker.distance * 2, // Estimativa simples: 2 min/km
                });
            }
        }
        // Usar smart matching para ordenar workers
        const smartMatchedWorkers = await smart_matching_service_1.smartMatchingService.smartSortWorkers(matches, {
            categoryId,
            latitude,
            longitude,
        }, tenantId);
        return smartMatchedWorkers.slice(0, 10); // Retornar top 10 mais bem ranqueados
    }
    /**
     * Cria uma request de serviço instantâneo
     */
    async requestService(tenantId, customerUserId, input) {
        // 1. Validar categoria (placeholder - futuramente validar com categories service)
        if (!input.categoryId) {
            throw new Error('Category ID is required');
        }
        // 2. Buscar workers online dessa categoria
        const workersMatched = await this.findOnlineWorkersByCategory(tenantId, input.categoryId, input.latitude, input.longitude);
        if (workersMatched.length === 0) {
            throw new Error('No workers available for this category');
        }
        // 3. Gerar requestId
        const requestId = (0, uuid_1.v4)();
        // 4. Criar job temporário
        const tempJob = await job_service_1.jobService.createJob(tenantId, customerUserId, {
            title: `Instant Service - ${input.categoryId}`,
            description: input.description || 'Instant service request',
            requiredSkills: [input.categoryId], // Usar categoryId como skill por enquanto
            location: {
                latitude: input.latitude,
                longitude: input.longitude,
            },
        });
        // 5. Criar request
        const request = {
            requestId,
            tenantId,
            customerUserId,
            categoryId: input.categoryId,
            latitude: input.latitude,
            longitude: input.longitude,
            description: input.description,
            status: 'pending',
            tempJobId: tempJob.jobId,
            createdAt: new Date(),
            expiresAt: new Date(Date.now() + 5 * 60 * 1000), // Expira em 5 minutos
            metadata: {
                source: 'instant_mode',
            },
        };
        // 6. Salvar request
        instant_repository_1.instantRepository.save(request);
        // 7. Disparar notificações via WebSocket para workers matched
        const workerUserIds = workersMatched.map((w) => w.userId);
        // Salvar workerIds no metadata para notificações futuras
        request.metadata = {
            ...request.metadata,
            notifiedWorkerIds: workerUserIds,
        };
        instant_repository_1.instantRepository.update(request);
        dispatcher_gateway_1.dispatcherGateway.broadcastToWorkers(tenantId, workerUserIds, {
            type: 'INSTANT_REQUEST',
            requestId,
            categoryId: input.categoryId,
            coords: {
                latitude: input.latitude,
                longitude: input.longitude,
            },
            description: input.description,
            expiresAt: request.expiresAt.toISOString(),
        });
        return {
            requestId,
            workersMatched,
        };
    }
    /**
     * Worker aceita uma request
     */
    async acceptRequest(tenantId, requestId, workerUserId) {
        // 1. Buscar request
        const request = instant_repository_1.instantRepository.findById(requestId);
        if (!request) {
            throw new Error('Request not found');
        }
        // 2. Validar tenant
        if (request.tenantId !== tenantId) {
            throw new Error('Request does not belong to this tenant');
        }
        // 3. Validar status
        if (request.status !== 'pending') {
            throw new Error(`Request is not pending (status: ${request.status})`);
        }
        // 4. Validar se não expirou
        if (request.expiresAt < new Date()) {
            request.status = 'expired';
            instant_repository_1.instantRepository.update(request);
            throw new Error('Request has expired');
        }
        // 5. Lock: primeiro worker que aceitar leva o job
        // Verificar se já foi aceito (race condition)
        if (request.acceptedByWorkerId) {
            throw new Error('Request already accepted by another worker');
        }
        // 6. Buscar worker
        const worker = await worker_service_1.workerService.getByUserId(tenantId, workerUserId);
        if (!worker) {
            throw new Error('Worker not found');
        }
        // 7. Criar assignment instantâneo
        const assignment = await assignment_service_1.assignmentService.createAssignment(tenantId, request.tempJobId, request.customerUserId, {
            workerId: worker.workerId,
            agreedRate: 0, // Pode ser definido depois
            paymentType: 'fixed',
        });
        // 8. Atualizar request com assignmentId
        request.status = 'accepted';
        request.acceptedByWorkerId = worker.workerId;
        request.jobStatus = instant_types_1.InstantJobStatus.ACCEPTED;
        request.assignmentId = assignment.assignmentId; // Salvar assignmentId
        instant_repository_1.instantRepository.update(request);
        // 9. Registrar status inicial no histórico
        instant_repository_1.instantRepository.updateJobStatus(requestId, instant_types_1.InstantJobStatus.ACCEPTED, workerUserId);
        // 10. Iniciar rastreamento GPS
        if (request.tempJobId) {
            tracking_service_1.trackingService.setActiveTracking(tenantId, requestId, workerUserId, request.customerUserId, request.tempJobId);
        }
        // 11. Notificar customer via WebSocket
        dispatcher_gateway_1.dispatcherGateway.broadcastToCustomer(tenantId, request.customerUserId, {
            type: 'STATUS_UPDATE',
            requestId,
            status: instant_types_1.InstantJobStatus.ACCEPTED,
            timestamp: new Date().toISOString(),
            workerUserId,
        });
        // 12. Também enviar REQUEST_ACCEPTED para compatibilidade
        dispatcher_gateway_1.dispatcherGateway.sendToWorker(tenantId, request.customerUserId, {
            type: 'REQUEST_ACCEPTED',
            workerUserId,
            requestId,
            assignmentId: assignment.assignmentId,
            jobId: request.tempJobId,
        });
        return {
            assignment,
            request,
        };
    }
    /**
     * Customer cancela uma request
     */
    async cancelRequest(tenantId, requestId, customerUserId) {
        // 1. Buscar request
        const request = instant_repository_1.instantRepository.findById(requestId);
        if (!request) {
            throw new Error('Request not found');
        }
        // 2. Validar tenant
        if (request.tenantId !== tenantId) {
            throw new Error('Request does not belong to this tenant');
        }
        // 3. Validar customer
        if (request.customerUserId !== customerUserId) {
            throw new Error('Only the customer can cancel this request');
        }
        // 4. Validar status
        if (request.status !== 'pending') {
            throw new Error(`Cannot cancel request with status: ${request.status}`);
        }
        // 5. Atualizar status
        request.status = 'cancelled';
        instant_repository_1.instantRepository.update(request);
        // 6. Limpar rastreamento GPS
        tracking_service_1.trackingService.clearTracking(requestId);
        // 7. Notificar workers matched via WebSocket
        // Buscar workers que foram notificados originalmente
        // Por enquanto, vamos buscar do request (se tiver metadata com workerIds)
        const workerUserIds = request.metadata?.notifiedWorkerIds || [];
        if (workerUserIds.length > 0) {
            dispatcher_gateway_1.dispatcherGateway.broadcastToWorkers(tenantId, workerUserIds, {
                type: 'REQUEST_CANCELLED',
                requestId,
            });
        }
        return request;
    }
    /**
     * Expira uma request (chamado por cron job ou timeout)
     */
    async expireRequest(requestId) {
        const request = instant_repository_1.instantRepository.findById(requestId);
        if (!request) {
            return false;
        }
        if (request.status === 'pending' && request.expiresAt < new Date()) {
            request.status = 'expired';
            instant_repository_1.instantRepository.update(request);
            // Limpar rastreamento GPS (se existir)
            tracking_service_1.trackingService.clearTracking(requestId);
            // Notificar workers matched via WebSocket
            const workerUserIds = request.metadata?.notifiedWorkerIds || [];
            if (workerUserIds.length > 0) {
                dispatcher_gateway_1.dispatcherGateway.broadcastToWorkers(request.tenantId, workerUserIds, {
                    type: 'REQUEST_EXPIRED',
                    requestId,
                });
            }
            return true;
        }
        return false;
    }
    /**
     * Busca request por ID
     */
    async getRequest(requestId) {
        return instant_repository_1.instantRepository.findById(requestId);
    }
}
exports.instantService = new InstantService();
//# sourceMappingURL=instant.service.js.map