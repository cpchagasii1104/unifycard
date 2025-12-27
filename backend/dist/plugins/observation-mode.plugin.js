"use strict";
// src/plugins/observation-mode.plugin.ts
// Plugin que bloqueia registro de novas rotas quando modo observação está ativo
Object.defineProperty(exports, "__esModule", { value: true });
const observation_mode_service_1 = require("@core/config/observation-mode.service");
const observationModePlugin = async (fastify) => {
    if (!observation_mode_service_1.observationModeService.isEnabled()) {
        return; // Modo observação não está ativo, não fazer nada
    }
    // Interceptar método register para bloquear novos módulos
    const originalRegister = fastify.register.bind(fastify);
    fastify.register = function (plugin, opts) {
        // Permitir plugins internos conhecidos (auth, tenant, etc)
        const allowedPlugins = [
            'tenantPlugin',
            'authPlugin',
            'rbacPlugin',
            'errorHandlerPlugin',
            'instrumentationPlugin',
            'observationModePlugin',
        ];
        // Tentar detectar se é um novo módulo
        const pluginName = plugin?.name || plugin?.displayName || String(plugin) || 'unknown';
        const isAllowed = allowedPlugins.some((name) => pluginName.includes(name));
        if (!isAllowed) {
            observation_mode_service_1.observationModeService.logWarning(`registro de módulo: ${pluginName}`);
            observation_mode_service_1.observationModeService.throwIfEnabled(`registro de módulo: ${pluginName}`);
        }
        return originalRegister(plugin, opts);
    };
    // Interceptar métodos de rota (get, post, put, delete, etc)
    const routeMethods = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'];
    for (const method of routeMethods) {
        const originalMethod = fastify[method].bind(fastify);
        fastify[method] = function (path, ...args) {
            // Permitir rotas de sistema conhecidas
            const allowedPaths = [
                '/health',
                '/metrics',
                '/auth',
                '/protected/test',
            ];
            const isAllowed = allowedPaths.some((allowed) => path.startsWith(allowed));
            if (!isAllowed) {
                observation_mode_service_1.observationModeService.logWarning(`criação de rota ${method.toUpperCase()} ${path}`);
                observation_mode_service_1.observationModeService.throwIfEnabled(`criação de rota ${method.toUpperCase()} ${path}`);
            }
            return originalMethod(path, ...args);
        };
    }
};
exports.default = observationModePlugin;
//# sourceMappingURL=observation-mode.plugin.js.map