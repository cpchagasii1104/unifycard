interface WebSocketConnection {
    socket: any;
    userId: string;
    tenantId: string;
    connectedAt: number;
    userType: 'worker' | 'customer';
}
interface DispatcherMessage {
    type: string;
    [key: string]: any;
}
declare class DispatcherGateway {
    private connections;
    /**
     * Registra uma conexão de worker
     */
    registerWorkerConnection(tenantId: string, userId: string, socket: any): void;
    /**
     * Remove registro de conexão de worker
     */
    unregisterWorkerConnection(tenantId: string, userId: string): void;
    /**
     * Envia mensagem para um worker específico
     */
    sendToWorker(tenantId: string, userId: string, payload: DispatcherMessage): boolean;
    /**
     * Faz broadcast para múltiplos workers
     */
    broadcastToWorkers(tenantId: string, workerUserIds: string[], payload: DispatcherMessage): number;
    /**
     * Registra uma conexão de customer
     */
    registerCustomerConnection(tenantId: string, userId: string, socket: any): void;
    /**
     * Remove registro de conexão de customer
     */
    unregisterCustomerConnection(tenantId: string, userId: string): void;
    /**
     * Envia mensagem para um customer específico
     */
    sendToCustomer(tenantId: string, userId: string, payload: DispatcherMessage): boolean;
    /**
     * Faz broadcast para um customer
     */
    broadcastToCustomer(tenantId: string, customerUserId: string, payload: DispatcherMessage): boolean;
    /**
     * Handler para mensagens recebidas dos workers
     */
    private handleWorkerMessage;
    /**
     * Handler para mensagens recebidas dos customers
     */
    private handleCustomerMessage;
    /**
     * Processa atualização de localização do worker e transmite para customer
     */
    handleWorkerLocationUpdate(tenantId: string, workerUserId: string, coords: {
        latitude: number;
        longitude: number;
    }): Promise<void>;
    /**
     * Lista todas as conexões ativas (para debug/admin)
     */
    getActiveConnections(tenantId?: string): WebSocketConnection[];
    /**
     * Verifica se um worker está conectado
     */
    isWorkerConnected(tenantId: string, userId: string): boolean;
}
export declare const dispatcherGateway: DispatcherGateway;
export {};
//# sourceMappingURL=dispatcher.gateway.d.ts.map