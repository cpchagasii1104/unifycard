// src/modules/work-instant/instant.types.ts
//
// Tipos para o módulo Work Instant (matching em tempo real estilo Uber)

export type InstantRequestStatus = 'pending' | 'accepted' | 'expired' | 'cancelled';
export type WorkerOnlineStatus = 'online' | 'offline';

/**
 * Status do job instantâneo (fluxo completo da corrida)
 */
export enum InstantJobStatus {
  PENDING = 'pending',          // request criada, aguardando worker
  ACCEPTED = 'accepted',         // worker aceitou
  EN_ROUTE = 'en_route',         // worker indo até o cliente
  ARRIVED = 'arrived',           // worker chegou ao local
  IN_SERVICE = 'in_service',      // serviço iniciado
  COMPLETED = 'completed',       // serviço concluído
  CANCELLED = 'cancelled',       // cancelado pelo cliente
  EXPIRED = 'expired',           // expirado automaticamente
}

export interface InstantRequest {
  requestId: string;
  tenantId: string;
  customerUserId: string;
  categoryId: string;
  latitude: number;
  longitude: number;
  description?: string;
  status: InstantRequestStatus;
  jobStatus?: InstantJobStatus; // Status detalhado do job
  tempJobId?: string; // Job criado temporariamente para o assignment
  assignmentId?: string; // Assignment criado quando worker aceita
  acceptedByWorkerId?: string;
  createdAt: string;
  expiresAt: Date;
  statusHistory?: Array<{
    status: InstantJobStatus;
    timestamp: Date;
    updatedBy: string; // userId do worker ou customer
  }>;
  metadata?: Record<string, any>;
}

export interface CreateInstantRequestInput {
  categoryId?: string;
  latitude?: number;
  longitude?: number;
  description?: string;
}

export interface WorkerMatch {
  workerId: string;
  userId: string;
  distance: number; // em km
  rating?: number;
  estimatedTime?: number; // em minutos
}


