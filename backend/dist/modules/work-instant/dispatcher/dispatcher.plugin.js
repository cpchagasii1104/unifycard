"use strict";
// src/modules/work-instant/dispatcher/dispatcher.plugin.ts
//
// Plugin WebSocket para Work Instant Dispatcher
// Registra rota WebSocket e gerencia conexões
Object.defineProperty(exports, "__esModule", { value: true });
const dispatcher_gateway_1 = require("./dispatcher.gateway");
const auth_service_1 = require("@core/auth/auth.service");
const dispatcherPlugin = async (fastify) => {
    // Registrar @fastify/websocket (opcional - só funciona se o módulo estiver instalado)
    try {
        const websocket = require('@fastify/websocket');
        await fastify.register(websocket);
    }
    catch (error) {
        fastify.log.warn('@fastify/websocket não está instalado. WebSocket endpoints não estarão disponíveis.');
        fastify.log.warn('Para habilitar WebSocket, execute: npm install @fastify/websocket');
        // Retorna sem registrar as rotas WebSocket
        return;
    }
    /**
     * WebSocket endpoint para workers
     * GET /work/instant/ws
     */
    fastify.get('/work/instant/ws', { websocket: true }, (connection, req) => {
        const requestId = req.requestId || 'unknown';
        // Validar autenticação
        const authHeader = req.headers?.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            connection.socket.close(1008, 'Unauthorized');
            return;
        }
        const token = authHeader.substring(7).trim();
        // Verificar token de forma assíncrona
        auth_service_1.authService.verifyAccessToken(token)
            .then((payload) => {
            // Validar tenant
            const tenantId = req.tenant?.id || payload.tenantId;
            if (!tenantId) {
                connection.socket.close(1008, 'Tenant not found');
                return;
            }
            const userId = payload.userId ?? payload.sub;
            if (!userId) {
                connection.socket.close(1008, 'User ID not found');
                return;
            }
            // Registrar conexão
            dispatcher_gateway_1.dispatcherGateway.registerWorkerConnection(tenantId, userId, connection.socket);
            fastify.log.info({
                requestId,
                tenantId,
                userId,
                'work-instant.action': 'websocket-connected',
                source: 'instant_mode',
            }, 'Worker WebSocket connection established');
            // Enviar mensagem de boas-vindas
            connection.socket.send(JSON.stringify({
                type: 'CONNECTION_ESTABLISHED',
                message: 'WebSocket connection established',
                userId,
                tenantId,
            }));
            // Handler de desconexão
            connection.socket.on('close', () => {
                dispatcher_gateway_1.dispatcherGateway.unregisterWorkerConnection(tenantId, userId);
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
            connection.socket.close(1008, 'Invalid or expired token');
        });
    });
    /**
     * WebSocket endpoint para customers
     * GET /work/instant/ws-customer
     */
    fastify.get('/work/instant/ws-customer', { websocket: true }, (connection, req) => {
        const requestId = req.requestId || 'unknown';
        // Validar autenticação
        const authHeader = req.headers?.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            connection.socket.close(1008, 'Unauthorized');
            return;
        }
        const token = authHeader.substring(7).trim();
        // Verificar token de forma assíncrona
        auth_service_1.authService.verifyAccessToken(token)
            .then((payload) => {
            // Validar tenant
            const tenantId = req.tenant?.id || payload.tenantId;
            if (!tenantId) {
                connection.socket.close(1008, 'Tenant not found');
                return;
            }
            const userId = payload.userId ?? payload.sub;
            if (!userId) {
                connection.socket.close(1008, 'User ID not found');
                return;
            }
            // Registrar conexão
            dispatcher_gateway_1.dispatcherGateway.registerCustomerConnection(tenantId, userId, connection.socket);
            fastify.log.info({
                requestId,
                tenantId,
                userId,
                'work-instant.action': 'websocket-customer-connected',
                source: 'instant_mode',
            }, 'Customer WebSocket connection established');
            // Enviar mensagem de boas-vindas
            connection.socket.send(JSON.stringify({
                type: 'CONNECTION_ESTABLISHED',
                message: 'WebSocket connection established',
                userId,
                tenantId,
            }));
            // Handler de desconexão
            connection.socket.on('close', () => {
                dispatcher_gateway_1.dispatcherGateway.unregisterCustomerConnection(tenantId, userId);
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
            connection.socket.close(1008, 'Invalid or expired token');
        });
    });
};
exports.default = dispatcherPlugin;
//# sourceMappingURL=dispatcher.plugin.js.map