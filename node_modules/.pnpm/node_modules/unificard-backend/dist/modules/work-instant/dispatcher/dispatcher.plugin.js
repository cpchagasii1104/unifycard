"use strict";
// src/modules/work-instant/dispatcher/dispatcher.plugin.ts
//
// Plugin WebSocket para Work Instant Dispatcher
// Registra rota WebSocket e gerencia conexões
Object.defineProperty(exports, "__esModule", { value: true });
const dispatcher_gateway_1 = require("./dispatcher.gateway");
const auth_service_1 = require("@core/auth/auth.service");
const dispatcherPlugin = async (fastify) => {
    // Controle explícito via flag ENABLE_WEBSOCKET
    const enableWebsocket = process.env.ENABLE_WEBSOCKET?.toLowerCase() === 'true';
    if (!enableWebsocket) {
        // WebSocket desabilitado explicitamente - não registrar e não gerar warning
        return;
    }
    // ENABLE_WEBSOCKET=true - tentar registrar @fastify/websocket
    // Se falhar, erro de boot (fail-fast) - dependência deve estar instalada
    try {
        const websocket = require('@fastify/websocket');
        await fastify.register(websocket);
    }
    catch (error) {
        const errorMsg = 'ERRO FATAL: ENABLE_WEBSOCKET=true mas @fastify/websocket não está disponível. Execute: pnpm add @fastify/websocket';
        fastify.log.error(errorMsg);
        throw new Error(errorMsg);
    }
    /**
     * WebSocket endpoint para workers
     * GET /work/instant/ws
     */
    fastify.get('/work/instant/ws', { websocket: true }, (connection, req) => {
        const requestId = req.requestId || 'unknown';
        // Extrair token usando helper centralizado do authService
        const token = auth_service_1.authService.extractTokenFromHeader(req.headers?.authorization);
        if (!token) {
            connection.socket.close(1008, 'Unauthorized');
            return;
        }
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
        // Extrair token usando helper centralizado do authService
        const token = auth_service_1.authService.extractTokenFromHeader(req.headers?.authorization);
        if (!token) {
            connection.socket.close(1008, 'Unauthorized');
            return;
        }
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
