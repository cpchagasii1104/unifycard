import type { Worker, CreateWorkerInput, UpdateWorkerInput } from '../work.types';
export interface ListWorkersOptions {
    skillId?: string;
    isActive?: boolean;
    minReputation?: number;
    lat?: number;
    lng?: number;
    radiusKm?: number;
    limit?: number;
    offset?: number;
}
export interface WorkersSearchResult {
    workers: Worker[];
    total: number;
}
declare class WorkerService {
    private toWorker;
    getById(tenantId: string, workerId: string): Promise<Worker | null>;
    getByUserId(tenantId: string, userId: string): Promise<Worker | null>;
    createWorker(tenantId: string, userId: string, input: CreateWorkerInput): Promise<Worker>;
    updateWorker(tenantId: string, workerId: string, input: UpdateWorkerInput): Promise<Worker>;
    listWorkers(tenantId: string, options?: ListWorkersOptions): Promise<WorkersSearchResult>;
}
export declare const workerService: WorkerService;
export {};
//# sourceMappingURL=worker.service.d.ts.map