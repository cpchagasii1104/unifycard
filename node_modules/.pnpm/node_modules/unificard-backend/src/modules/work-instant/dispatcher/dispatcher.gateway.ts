// src/modules/work-instant/dispatcher/dispatcher.gateway.ts
//
// Gateway WebSocket para comunicação real-time com workers
// Gerencia conexões e broadcasting de mensagens

import { workerStatusService } from '../worker-status.service';
import { trackingService } from '../tracking.service';

interface WebSocketConnection {
  socket: any; // WebSocket instance from @fastify/websocket
  userId: string;
  tenantId: string;
  connectedAt: number;
  userType: 'worker' | 'customer';
}

interface DispatcherMessage {
  type: string;
  [key: string]: any;
}

class DispatcherGateway {
  // Mapa de conexões ativas: userId -> WebSocketConnection
  private connections = new Map<string, WebSocketConnection>();

  /**
   * Registra uma conexão de worker
   */
  registerWorkerConnection(
    tenantId: string,
    userId: string,
    socket: any
  ): void {
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

    socket.on('error', (error: Error) => {
      console.error(`WebSocket error for worker ${userId}:`, error);
      this.unregisterWorkerConnection(tenantId, userId);
    });

    // Handler para mensagens do worker (heartbeat, etc.)
    socket.on('message', (message: Buffer) => {
      try {
        const data = JSON.parse(message.toString());
        this.handleWorkerMessage(tenantId, userId, data);
      } catch (error) {
        console.error(`Error parsing message from worker ${userId}:`, error);
      }
    });
  }

  /**
   * Remove registro de conexão de worker
   */
  unregisterWorkerConnection(tenantId: string, userId: string): void {
    const key = `${tenantId}:${userId}`;
    this.connections.delete(key);
  }

  /**
   * Envia mensagem para um worker específico
   */
  sendToWorker(
    tenantId: string,
    userId: string,
    payload: DispatcherMessage
  ): boolean {
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
    } catch (error) {
      console.error(`Error sending message to worker ${userId}:`, error);
      this.unregisterWorkerConnection(tenantId, userId);
      return false;
    }
  }

  /**
   * Faz broadcast para múltiplos workers
   */
  broadcastToWorkers(
    tenantId: string,
    workerUserIds: string[],
    payload: DispatcherMessage
  ): number {
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
  registerCustomerConnection(
    tenantId: string,
    userId: string,
    socket: any
  ): void {
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

    socket.on('error', (error: Error) => {
      console.error(`WebSocket error for customer ${userId}:`, error);
      this.unregisterCustomerConnection(tenantId, userId);
    });

    // Handler para mensagens do customer (heartbeat, etc.)
    socket.on('message', (message: Buffer) => {
      try {
        const data = JSON.parse(message.toString());
        this.handleCustomerMessage(tenantId, userId, data);
      } catch (error) {
        console.error(`Error parsing message from customer ${userId}:`, error);
      }
    });
  }

  /**
   * Remove registro de conexão de customer
   */
  unregisterCustomerConnection(tenantId: string, userId: string): void {
    const key = `${tenantId}:${userId}`;
    this.connections.delete(key);
  }

  /**
   * Envia mensagem para um customer específico
   */
  sendToCustomer(
    tenantId: string,
    userId: string,
    payload: DispatcherMessage
  ): boolean {
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
    } catch (error) {
      console.error(`Error sending message to customer ${userId}:`, error);
      this.unregisterCustomerConnection(tenantId, userId);
      return false;
    }
  }

  /**
   * Faz broadcast para um customer
   */
  broadcastToCustomer(
    tenantId: string,
    customerUserId: string,
    payload: DispatcherMessage
  ): boolean {
    return this.sendToCustomer(tenantId, customerUserId, payload);
  }

  /**
   * Handler para mensagens recebidas dos workers
   */
  private async handleWorkerMessage(
    tenantId: string,
    userId: string,
    data: any
  ): Promise<void> {
    if (data.type === 'WORKER_HEARTBEAT') {
      // Atualizar localização automaticamente via heartbeat
      if (data.latitude !== undefined && data.longitude !== undefined) {
        await workerStatusService.updateLocation(tenantId, userId, {
          latitude: data.latitude,
          longitude: data.longitude,
        });
      }
    } else if (data.type === 'WORKER_GPS') {
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
  private async handleCustomerMessage(
    tenantId: string,
    userId: string,
    data: any
  ): Promise<void> {
    if (data.type === 'CUSTOMER_HEARTBEAT') {
      // Manter sessão ativa (não precisa fazer nada)
      // A conexão já está registrada
    }
  }

  /**
   * Processa atualização de localização do worker e transmite para customer
   */
  async handleWorkerLocationUpdate(
    tenantId: string,
    workerUserId: string,
    coords: { latitude: number; longitude: number }
  ): Promise<void> {
    // 1. Atualizar localização do worker
    await workerStatusService.updateLocation(tenantId, workerUserId, coords);

    // 2. Verificar se worker está em job instantâneo ativo
    const activeTracking = trackingService.getActiveInstantJobForWorker(
      tenantId,
      workerUserId
    );

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
      console.warn(
        `Failed to send location update to customer ${activeTracking.customerUserId}`
      );
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
  getActiveConnections(tenantId?: string): WebSocketConnection[] {
    const connections: WebSocketConnection[] = [];
    
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
  isWorkerConnected(tenantId: string, userId: string): boolean {
    const key = `${tenantId}:${userId}`;
    const connection = this.connections.get(key);
    return connection !== undefined && connection.socket.readyState === 1; // OPEN
  }
}

export const dispatcherGateway = new DispatcherGateway();

