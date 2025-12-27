// src/plugins/observation-mode.plugin.ts
// Plugin que bloqueia registro de novas rotas quando modo observação está ativo

import { FastifyPluginAsync, FastifyInstance } from 'fastify';
import { observationModeService } from '@core/config/observation-mode.service';

const observationModePlugin: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  if (!observationModeService.isEnabled()) {
    return; // Modo observação não está ativo, não fazer nada
  }

  // Interceptar método register para bloquear novos módulos
  const originalRegister = fastify.register.bind(fastify);

  (fastify as any).register = function (plugin: any, opts?: any) {
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
      observationModeService.logWarning(`registro de módulo: ${pluginName}`);
      observationModeService.throwIfEnabled(`registro de módulo: ${pluginName}`);
    }

    return originalRegister(plugin, opts);
  };

  // Interceptar métodos de rota (get, post, put, delete, etc)
  const routeMethods = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'] as const;

  for (const method of routeMethods) {
    const originalMethod = (fastify as any)[method].bind(fastify);

    (fastify as any)[method] = function (path: string, ...args: any[]) {
      // Permitir rotas de sistema conhecidas
      const allowedPaths = [
        '/health',
        '/metrics',
        '/auth',
        '/protected/test',
      ];

      const isAllowed = allowedPaths.some((allowed) => path.startsWith(allowed));

      if (!isAllowed) {
        observationModeService.logWarning(`criação de rota ${method.toUpperCase()} ${path}`);
        observationModeService.throwIfEnabled(`criação de rota ${method.toUpperCase()} ${path}`);
      }

      return originalMethod(path, ...args);
    };
  }
};

export default observationModePlugin;

