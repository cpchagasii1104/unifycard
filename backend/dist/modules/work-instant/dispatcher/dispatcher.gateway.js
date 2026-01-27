"use strict";
// src/modules/work-instant/dispatcher/dispatcher.gateway.ts
//
// Gateway WebSocket para comunicação real-time com workers
// Gerencia conexões e broadcasting de mensagens
Object.defineProperty(exports, "__esModule", { value: true });
exports.dispatcherGateway = void 0;
const worker_status_service_1 = require("../worker-status.service");
const tracking_service_1 = require("../tracking.service");
class DispatcherGateway {
    // Mapa de conexões ativas: userId -> WebSocketConnection
    connections = new Map();
    /**
     * Registra uma conexão de worker
     */
    registerWorkerConnection(tenantId, userId, socket) {
        const key = `${tenantId}:${userId}`;
        // Fechar conexão anterior se existir
        const existing = this.connections.get(key);
        if (existing && existing.socket.readyState === 1) { // OPEN
            existing.socket.close();
        }
        // Registrar nova conexão
        this.connections.set(key, {
            socket,
            userId,
            tenantId,
            connectedAt: Date.now(),
            userType: 'worker',
        });
        // Configurar handlers de eventos
        socket.on('close', () => {
            this.unregisterWorkerConnection(tenantId, userId);
        });
        socket.on('error', (error) => {
            console.error(`WebSocket error for worker ${userId}:`, error);
            this.unregisterWorkerConnection(tenantId, userId);
        });
        // Handler para mensagens do worker (heartbeat, etc.)
        socket.on('message', (message) => {
            try {
                const data = JSON.parse(message.toString());
                this.handleWorkerMessage(tenantId, userId, data);
            }
            catch (error) {
                console.error(`Error parsing message from worker ${userId}:`, error);
            }
        });
    }
    /**
     * Remove registro de conexão de worker
     */
    unregisterWorkerConnection(tenantId, userId) {
        const key = `${tenantId}:${userId}`;
        this.connections.delete(key);
    }
    /**
     * Envia mensagem para um worker específico
     */
    sendToWorker(tenantId, userId, payload) {
        const key = `${tenantId}:${userId}`;
        const connection = this.connections.get(key);
        if (!connection) {
            return false;
        }
        if (connection.socket.readyState !== 1) { // OPEN
            this.unregisterWorkerConnection(tenantId, userId);
            return false;
        }
        try {
            connection.socket.send(JSON.stringify(payload));
            return true;
        }
        catch (error) {
            console.error(`Error sending message to worker ${userId}:`, error);
            this.unregisterWorkerConnection(tenantId, userId);
            return false;
        }
    }
    /**
     * Faz broadcast para múltiplos workers
     */
    broadcastToWorkers(tenantId, workerUserIds, payload) {
        let sentCount = 0;
        for (const userId of workerUserIds) {
            if (this.sendToWorker(tenantId, userId, payload)) {
                sentCount++;
            }
        }
        return sentCount;
    }
    /**
     * Registra uma conexão de customer
     */
    registerCustomerConnection(tenantId, userId, socket) {
        const key = `${tenantId}:${userId}`;
        // Fechar conexão anterior se existir
        const existing = this.connections.get(key);
        if (existing && existing.socket.readyState === 1) { // OPEN
            existing.socket.close();
        }
        // Registrar nova conexão
        this.connections.set(key, {
            socket,
            userId,
            tenantId,
            connectedAt: Date.now(),
            userType: 'customer',
        });
        // Configurar handlers de eventos
        socket.on('close', () => {
            this.unregisterCustomerConnection(tenantId, userId);
        });
        socket.on('error', (error) => {
            console.error(`WebSocket error for customer ${userId}:`, error);
            this.unregisterCustomerConnection(tenantId, userId);
        });
        // Handler para mensagens do customer (heartbeat, etc.)
        socket.on('message', (message) => {
            try {
                const data = JSON.parse(message.toString());
                this.handleCustomerMessage(tenantId, userId, data);
            }
            catch (error) {
                console.error(`Error parsing message from customer ${userId}:`, error);
            }
        });
    }
    /**
     * Remove registro de conexão de customer
     */
    unregisterCustomerConnection(tenantId, userId) {
        const key = `${tenantId}:${userId}`;
        this.connections.delete(key);
    }
    /**
     * Envia mensagem para um customer específico
     */
    sendToCustomer(tenantId, userId, payload) {
        const key = `${tenantId}:${userId}`;
        const connection = this.connections.get(key);
        if (!connection) {
            return false;
        }
        if (connection.socket.readyState !== 1) { // OPEN
            this.unregisterCustomerConnection(tenantId, userId);
            return false;
        }
        try {
            connection.socket.send(JSON.stringify(payload));
            return true;
        }
        catch (error) {
            console.error(`Error sending message to customer ${userId}:`, error);
            this.unregisterCustomerConnection(tenantId, userId);
            return false;
        }
    }
    /**
     * Faz broadcast para um customer
     */
    broadcastToCustomer(tenantId, customerUserId, payload) {
        return this.sendToCustomer(tenantId, customerUserId, payload);
    }
    /**
     * Handler para mensagens recebidas dos workers
     */
    async handleWorkerMessage(tenantId, userId, data) {
        if (data.type === 'WORKER_HEARTBEAT') {
            // Atualizar localização automaticamente via heartbeat
            if (data.latitude !== undefined && data.longitude !== undefined) {
                await worker_status_service_1.workerStatusService.updateLocation(tenantId, userId, {
                    latitude: data.latitude,
                    longitude: data.longitude,
                });
            }
        }
        else if (data.type === 'WORKER_GPS') {
            // Processar atualização GPS e transmitir para customer
            await this.handleWorkerLocationUpdate(tenantId, userId, {
                latitude: data.latitude,
                longitude: data.longitude,
            });
        }
    }
    /**
     * Handler para mensagens recebidas dos customers
     */
    async handleCustomerMessage(tenantId, userId, data) {
        if (data.type === 'CUSTOMER_HEARTBEAT') {
            // Manter sessão ativa (não precisa fazer nada)
            // A conexão já está registrada
        }
    }
    /**
     * Processa atualização de localização do worker e transmite para customer
     */
    async handleWorkerLocationUpdate(tenantId, workerUserId, coords) {
        // 1. Atualizar localização do worker
        await worker_status_service_1.workerStatusService.updateLocation(tenantId, workerUserId, coords);
        // 2. Verificar se worker está em job instantâneo ativo
        const activeTracking = tracking_service_1.trackingService.getActiveInstantJobForWorker(tenantId, workerUserId);
        if (!activeTracking) {
            // Worker não está em job ativo, apenas atualizar localização
            return;
        }
        // 3. Enviar localização ao customer via WebSocket
        const sent = this.broadcastToCustomer(tenantId, activeTracking.customerUserId, {
            type: 'WORKER_LOCATION_UPDATE',
            workerUserId,
            requestId: activeTracking.requestId,
            latitude: coords.latitude,
            longitude: coords.longitude,
            updatedAt: new Date().toISOString(),
        });
        if (!sent) {
            console.warn(`Failed to send location update to customer ${activeTracking.customerUserId}`);
        }
        // 4. Log estruturado
        console.log({
            requestId: activeTracking.requestId,
            tenantId,
            workerUserId,
            customerUserId: activeTracking.customerUserId,
            'work-instant.action': 'gps-tracking',
            source: 'instant_mode',
            latitude: coords.latitude,
            longitude: coords.longitude,
        });
    }
    /**
     * Lista todas as conexões ativas (para debug/admin)
     */
    getActiveConnections(tenantId) {
        const connections = [];
        for (const connection of this.connections.values()) {
            if (!tenantId || connection.tenantId === tenantId) {
                connections.push(connection);
            }
        }
        return connections;
    }
    /**
     * Verifica se um worker está conectado
     */
    isWorkerConnected(tenantId, userId) {
        const key = `${tenantId}:${userId}`;
        const connection = this.connections.get(key);
        return connection !== undefined && connection.socket.readyState === 1; // OPEN
    }
}
exports.dispatcherGateway = new DispatcherGateway();
