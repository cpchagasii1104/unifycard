// src/modules/work-instant/instant.service.ts
//
// Serviço de matching em tempo real para Work Instant

import { v4 as uuidv4 } from 'uuid';
import { instantRepository } from './instant.repository';
import { jobService } from '../work/jobs/job.service';
import { assignmentService } from '../work/assignments/assignment.service';
import { workerService } from '../work/workers/worker.service';
import { workerStatusService } from './worker-status.service';
import { smartMatchingService } from './smart-matching.service';
import { dispatcherGateway } from './dispatcher/dispatcher.gateway';
import { trackingService } from './tracking.service';
import { runQueryWithTenant } from '@core/database/pool';
import type { InstantRequest, CreateInstantRequestInput, WorkerMatch, InstantRequestStatus } from './instant.types';
import { InstantJobStatus } from './instant.types';
import type { Job } from '../work/work.types';

class InstantService {
  /**
   * Busca workers online de uma categoria
   * Usa workerStatusService para buscar workers online com localização
   */
  private async findOnlineWorkersByCategory(
    tenantId: string,
    categoryId: string,
    latitude: number,
    longitude: number,
    radiusKm: number = 10
  ): Promise<WorkerMatch[]> {
    // Usar workerStatusService para buscar workers online
    const onlineWorkers = await workerStatusService.getOnlineWorkersByCategory(
      tenantId,
      categoryId,
      latitude,
      longitude,
      radiusKm
    );

    // Buscar informações adicionais dos workers (reputação, etc.)
    const matches: WorkerMatch[] = [];

    for (const onlineWorker of onlineWorkers) {
      // Buscar worker completo para obter reputação
      const worker = await workerService.getById(tenantId, onlineWorker.workerId);
      
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
    const smartMatchedWorkers = await smartMatchingService.smartSortWorkers(
      matches,
      {
        categoryId,
        latitude,
        longitude,
      },
      tenantId
    );

    return smartMatchedWorkers.slice(0, 10); // Retornar top 10 mais bem ranqueados
  }

  /**
   * Cria uma request de serviço instantâneo
   */
  async requestService(
    tenantId: string,
    customerUserId: string,
    input: CreateInstantRequestInput
  ): Promise<{ requestId: string; workersMatched: WorkerMatch[] }> {
    // 1. Validar categoria (placeholder - futuramente validar com categories service)
    if (!input.categoryId) {
      throw new Error('Category ID is required');
    }

    // 2. Buscar workers online dessa categoria
    const workersMatched = await this.findOnlineWorkersByCategory(
      tenantId,
      input.categoryId,
      input.latitude,
      input.longitude
    );

    if (workersMatched.length === 0) {
      throw new Error('No workers available for this category');
    }

    // 3. Gerar requestId
    const requestId = uuidv4();

    // 4. Criar job temporário
    const tempJob = await jobService.createJob(tenantId, customerUserId, {
      title: `Instant Service - ${input.categoryId}`,
      description: input.description || 'Instant service request',
      requiredSkills: [input.categoryId], // Usar categoryId como skill por enquanto
      location: {
        latitude: input.latitude,
        longitude: input.longitude,
      },
    });

    // 5. Criar request
    const request: InstantRequest = {
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
    instantRepository.save(request);

    // 7. Disparar notificações via WebSocket para workers matched
    const workerUserIds = workersMatched.map((w) => w.userId);
    
    // Salvar workerIds no metadata para notificações futuras
    request.metadata = {
      ...request.metadata,
      notifiedWorkerIds: workerUserIds,
    };
    instantRepository.update(request);

    dispatcherGateway.broadcastToWorkers(tenantId, workerUserIds, {
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
  async acceptRequest(
    tenantId: string,
    requestId: string,
    workerUserId: string
  ): Promise<{ assignment: any; request: InstantRequest }> {
    // 1. Buscar request
    const request = instantRepository.findById(requestId);
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
      instantRepository.update(request);
      throw new Error('Request has expired');
    }

    // 5. Lock: primeiro worker que aceitar leva o job
    // Verificar se já foi aceito (race condition)
    if (request.acceptedByWorkerId) {
      throw new Error('Request already accepted by another worker');
    }

    // 6. Buscar worker
    const worker = await workerService.getByUserId(tenantId, workerUserId);
    if (!worker) {
      throw new Error('Worker not found');
    }

    // 7. Criar assignment instantâneo
    const assignment = await assignmentService.createAssignment(
      tenantId,
      request.tempJobId!,
      request.customerUserId,
      {
        workerId: worker.workerId,
        agreedRate: 0, // Pode ser definido depois
        paymentType: 'fixed',
      }
    );

    // 8. Atualizar request com assignmentId
    request.status = 'accepted';
    request.acceptedByWorkerId = worker.workerId;
    request.jobStatus = InstantJobStatus.ACCEPTED;
    request.assignmentId = assignment.assignmentId; // Salvar assignmentId
    instantRepository.update(request);

    // 9. Registrar status inicial no histórico
    instantRepository.updateJobStatus(requestId, InstantJobStatus.ACCEPTED, workerUserId);

    // 10. Iniciar rastreamento GPS
    if (request.tempJobId) {
      trackingService.setActiveTracking(
        tenantId,
        requestId,
        workerUserId,
        request.customerUserId,
        request.tempJobId
      );
    }

    // 11. Notificar customer via WebSocket
    dispatcherGateway.broadcastToCustomer(tenantId, request.customerUserId, {
      type: 'STATUS_UPDATE',
      requestId,
      status: InstantJobStatus.ACCEPTED,
      timestamp: new Date().toISOString(),
      workerUserId,
    });

    // 12. Também enviar REQUEST_ACCEPTED para compatibilidade
    dispatcherGateway.sendToWorker(tenantId, request.customerUserId, {
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
  async cancelRequest(
    tenantId: string,
    requestId: string,
    customerUserId: string
  ): Promise<InstantRequest> {
    // 1. Buscar request
    const request = instantRepository.findById(requestId);
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
    instantRepository.update(request);

    // 6. Limpar rastreamento GPS
    trackingService.clearTracking(requestId);

    // 7. Notificar workers matched via WebSocket
    // Buscar workers que foram notificados originalmente
    // Por enquanto, vamos buscar do request (se tiver metadata com workerIds)
    const workerUserIds = request.metadata?.notifiedWorkerIds || [];
    if (workerUserIds.length > 0) {
      dispatcherGateway.broadcastToWorkers(tenantId, workerUserIds, {
        type: 'REQUEST_CANCELLED',
        requestId,
      });
    }

    return request;
  }

  /**
   * Expira uma request (chamado por cron job ou timeout)
   */
  async expireRequest(requestId: string): Promise<boolean> {
    const request = instantRepository.findById(requestId);
    if (!request) {
      return false;
    }

    if (request.status === 'pending' && request.expiresAt < new Date()) {
      request.status = 'expired';
      instantRepository.update(request);

      // Limpar rastreamento GPS (se existir)
      trackingService.clearTracking(requestId);

      // Notificar workers matched via WebSocket
      const workerUserIds = request.metadata?.notifiedWorkerIds || [];
      if (workerUserIds.length > 0) {
        dispatcherGateway.broadcastToWorkers(request.tenantId, workerUserIds, {
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
  async getRequest(requestId: string): Promise<InstantRequest | null> {
    return instantRepository.findById(requestId);
  }
}

export const instantService = new InstantService();

