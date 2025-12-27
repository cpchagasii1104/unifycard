// src/modules/work-instant/dispatcher/dispatcher.plugin.ts
//
// Plugin WebSocket para Work Instant Dispatcher
// Registra rota WebSocket e gerencia conexões

import { FastifyPluginAsync } from 'fastify';
import { dispatcherGateway } from './dispatcher.gateway';
import { authService } from '@core/auth/auth.service';

const dispatcherPlugin: FastifyPluginAsync = async (fastify) => {
  // Registrar @fastify/websocket (opcional - só funciona se o módulo estiver instalado)
  try {
    const websocket = require('@fastify/websocket');
    await fastify.register(websocket);
  } catch (error) {
    fastify.log.warn('@fastify/websocket não está instalado. WebSocket endpoints não estarão disponíveis.');
    fastify.log.warn('Para habilitar WebSocket, execute: npm install @fastify/websocket');
    // Retorna sem registrar as rotas WebSocket
    return;
  }

  /**
   * WebSocket endpoint para workers
   * GET /work/instant/ws
   */
  fastify.get(
    '/work/instant/ws',
    { websocket: true } as any,
    (connection: { socket: any }, req: any) => {
      const requestId = (req as any).requestId || 'unknown';

      // Extrair token usando helper centralizado do authService
      const token = authService.extractTokenFromHeader((req as any).headers?.authorization);
      if (!token) {
        (connection.socket as any).close(1008, 'Unauthorized');
        return;
      }
      
      // Verificar token de forma assíncrona
      authService.verifyAccessToken(token)
        .then((payload) => {
          // Validar tenant
          const tenantId = (req as any).tenant?.id || payload.tenantId;
          if (!tenantId) {
            (connection.socket as any).close(1008, 'Tenant not found');
            return;
          }

          const userId = payload.userId ?? payload.sub;
          if (!userId) {
            (connection.socket as any).close(1008, 'User ID not found');
            return;
          }

          // Registrar conexão
          dispatcherGateway.registerWorkerConnection(tenantId, userId, connection.socket);

          fastify.log.info({
            requestId,
            tenantId,
            userId,
            'work-instant.action': 'websocket-connected',
            source: 'instant_mode',
          }, 'Worker WebSocket connection established');

          // Enviar mensagem de boas-vindas
          (connection.socket as any).send(JSON.stringify({
            type: 'CONNECTION_ESTABLISHED',
            message: 'WebSocket connection established',
            userId,
            tenantId,
          }));

          // Handler de desconexão
          connection.socket.on('close', () => {
            dispatcherGateway.unregisterWorkerConnection(tenantId, userId);
            fastify.log.info({
              requestId,
              tenantId,
              userId,
              'work-instant.action': 'websocket-disconnected',
              source: 'instant_mode',
            }, 'Worker WebSocket connection closed');
          });
        })
        .catch(() => {
          (connection.socket as any).close(1008, 'Invalid or expired token');
        });
    }
  );

  /**
   * WebSocket endpoint para customers
   * GET /work/instant/ws-customer
   */
  fastify.get(
    '/work/instant/ws-customer',
    { websocket: true } as any,
    (connection: { socket: any }, req: any) => {
      const requestId = (req as any).requestId || 'unknown';

      // Extrair token usando helper centralizado do authService
      const token = authService.extractTokenFromHeader((req as any).headers?.authorization);
      if (!token) {
        (connection.socket as any).close(1008, 'Unauthorized');
        return;
      }
      
      // Verificar token de forma assíncrona
      authService.verifyAccessToken(token)
        .then((payload) => {
          // Validar tenant
          const tenantId = (req as any).tenant?.id || payload.tenantId;
          if (!tenantId) {
            (connection.socket as any).close(1008, 'Tenant not found');
            return;
          }

          const userId = payload.userId ?? payload.sub;
          if (!userId) {
            (connection.socket as any).close(1008, 'User ID not found');
            return;
          }

          // Registrar conexão
          dispatcherGateway.registerCustomerConnection(tenantId, userId, connection.socket);

          fastify.log.info({
            requestId,
            tenantId,
            userId,
            'work-instant.action': 'websocket-customer-connected',
            source: 'instant_mode',
          }, 'Customer WebSocket connection established');

          // Enviar mensagem de boas-vindas
          (connection.socket as any).send(JSON.stringify({
            type: 'CONNECTION_ESTABLISHED',
            message: 'WebSocket connection established',
            userId,
            tenantId,
          }));

          // Handler de desconexão
          connection.socket.on('close', () => {
            dispatcherGateway.unregisterCustomerConnection(tenantId, userId);
            fastify.log.info({
              requestId,
              tenantId,
              userId,
              'work-instant.action': 'websocket-customer-disconnected',
              source: 'instant_mode',
            }, 'Customer WebSocket connection closed');
          });
        })
        .catch(() => {
          (connection.socket as any).close(1008, 'Invalid or expired token');
        });
    }
  );
};

export default dispatcherPlugin;
