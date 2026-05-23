// src/core/config/config.routes.ts
import { FastifyPluginAsync } from 'fastify';
import { configService } from './config.service';
import {
  configKeySchema,
  setConfigSchema,
  listConfigsQuerySchema,
  flagNameSchema,
  upsertFlagSchema,
  checkFlagQuerySchema,
  listFlagsQuerySchema,
} from './config.schemas';

const configRoutes: FastifyPluginAsync = async (fastify) => {
  // =====================
  // TENANT CONFIGS
  // =====================

  // GET /config/configs - Listar configs
  fastify.get('/configs', async (req, reply) => {
    const tenantId = req.tenant!.id;

    await fastify.requirePermission(['config:read'])(req, reply);

    const parsed = listConfigsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Invalid query parameters',
        details: parsed.error.errors,
      });
    }

    const { module, limit, offset } = parsed.data;
    const configs = await configService.listConfigs(tenantId, module, limit, offset);
    return { configs };
  });

  // GET /config/configs/:module/:key - Buscar config específica
  fastify.get<{ Params: { module: string; key: string } }>(
    '/configs/:module/:key',
    async (req, reply) => {
      const tenantId = req.tenant!.id;

      await fastify.requirePermission(['config:read'])(req, reply);

      const parsed = configKeySchema.safeParse(req.params);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Invalid parameters',
          details: parsed.error.errors,
        });
      }

      const config = await configService.getConfig(tenantId, parsed.data.module, parsed.data.key);

      if (!config) {
        return reply.status(404).send({ error: 'Config not found' });
      }

      return config;
    }
  );

  // POST /config/configs - Criar/atualizar config
  fastify.post('/configs', async (req, reply) => {
    const tenantId = req.tenant!.id;

    await fastify.requirePermission(['config:write'])(req, reply);

    const parsed = setConfigSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Invalid request body',
        details: parsed.error.errors,
      });
    }

    try {
      const config = await configService.setConfig(
        tenantId,
        parsed.data.module,
        parsed.data.key,
        parsed.data.valueCents,
        { isSystem: parsed.data.isSystem }
      );
      return reply.status(201).send(config);
    } catch (error) {
      const err = error as Error & { statusCode?: number };
      return reply.status(err.statusCode ?? 500).send({ error: err.message });
    }
  });

  // DELETE /config/configs/:module/:key - Deletar config
  fastify.delete<{ Params: { module: string; key: string } }>(
    '/configs/:module/:key',
    async (req, reply) => {
      const tenantId = req.tenant!.id;

      await fastify.requirePermission(['config:write'])(req, reply);

      const parsed = configKeySchema.safeParse(req.params);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Invalid parameters',
          details: parsed.error.errors,
        });
      }

      const deleted = await configService.deleteConfig(
        tenantId,
        parsed.data.module,
        parsed.data.key
      );

      if (!deleted) {
        return reply.status(404).send({ error: 'Config not found' });
      }

      return reply.status(204).send();
    }
  );

  // =====================
  // FEATURE FLAGS
  // =====================

  // GET /config/flags - Listar flags
  fastify.get('/flags', async (req, reply) => {
    const tenantId = req.tenant!.id;

    await fastify.requirePermission(['config:read'])(req, reply);

    const parsed = listFlagsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Invalid query parameters',
        details: parsed.error.errors,
      });
    }

    const { limit, offset } = parsed.data;
    const flags = await configService.listFeatureFlags(tenantId, limit, offset);
    return { flags };
  });

  // GET /config/flags/:flagName - Buscar flag
  fastify.get<{ Params: { flagName: string } }>('/flags/:flagName', async (req, reply) => {
    const tenantId = req.tenant!.id;

    await fastify.requirePermission(['config:read'])(req, reply);

    const parsed = flagNameSchema.safeParse(req.params);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Invalid flag name',
        details: parsed.error.errors,
      });
    }

    const flag = await configService.getFeatureFlag(tenantId, parsed.data.flagName);

    if (!flag) {
      return reply.status(404).send({ error: 'Feature flag not found' });
    }

    return flag;
  });

  // GET /config/flags/:flagName/check - Verificar se flag está ativa
  fastify.get<{ Params: { flagName: string } }>('/flags/:flagName/check', async (req, reply) => {
    const tenantId = req.tenant!.id;

    // Qualquer usuário autenticado pode verificar flags
    const parsedParams = flagNameSchema.safeParse(req.params);
    if (!parsedParams.success) {
      return reply.status(400).send({
        error: 'Invalid flag name',
        details: parsedParams.error.errors,
      });
    }

    const parsedQuery = checkFlagQuerySchema.safeParse(req.query);
    const userId = parsedQuery.success ? parsedQuery.data.userId : req.user?.id;

    const enabled = await configService.isFeatureEnabled(
      tenantId,
      parsedParams.data.flagName,
      userId
    );

    return { flagName: parsedParams.data.flagName, enabled };
  });

  // PUT /config/flags/:flagName - Criar/atualizar flag
  fastify.put<{ Params: { flagName: string } }>('/flags/:flagName', async (req, reply) => {
    const tenantId = req.tenant!.id;

    await fastify.requirePermission(['config:write'])(req, reply);

    const parsedParams = flagNameSchema.safeParse(req.params);
    if (!parsedParams.success) {
      return reply.status(400).send({
        error: 'Invalid flag name',
        details: parsedParams.error.errors,
      });
    }

    const parsedBody = upsertFlagSchema.safeParse(req.body);
    if (!parsedBody.success) {
      return reply.status(400).send({
        error: 'Invalid request body',
        details: parsedBody.error.errors,
      });
    }

    try {
      const flag = await configService.upsertFeatureFlag(
        tenantId,
        parsedParams.data.flagName,
        parsedBody.data
      );
      return flag;
    } catch (error) {
      const err = error as Error & { statusCode?: number };
      return reply.status(err.statusCode ?? 500).send({ error: err.message });
    }
  });

  // DELETE /config/flags/:flagName - Deletar flag
  fastify.delete<{ Params: { flagName: string } }>('/flags/:flagName', async (req, reply) => {
    const tenantId = req.tenant!.id;

    await fastify.requirePermission(['config:write'])(req, reply);

    const parsed = flagNameSchema.safeParse(req.params);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Invalid flag name',
        details: parsed.error.errors,
      });
    }

    const deleted = await configService.deleteFeatureFlag(tenantId, parsed.data.flagName);

    if (!deleted) {
      return reply.status(404).send({ error: 'Feature flag not found' });
    }

    return reply.status(204).send();
  });
};

export default configRoutes;
