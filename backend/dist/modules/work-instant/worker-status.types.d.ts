export type WorkerStatus = 'online' | 'offline';
export interface WorkerLocation {
    latitude: number;
    longitude: number;
    updatedAt: number;
}
export interface WorkerPresence {
    userId: string;
    tenantId: string;
    status: WorkerStatus;
    location?: WorkerLocation;
    lastSeen: number;
}
export interface UpdateLocationInput {
    latitude: number;
    longitude: number;
}
//# sourceMappingURL=worker-status.types.d.ts.map