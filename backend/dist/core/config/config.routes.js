"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const config_service_1 = require("./config.service");
const config_schemas_1 = require("./config.schemas");
const configRoutes = async (fastify) => {
    // =====================
    // TENANT CONFIGS
    // =====================
    // GET /config/configs - Listar configs
    fastify.get('/configs', async (req, reply) => {
        const tenantId = req.tenant.id;
        await fastify.requirePermission(['config:read'])(req, reply);
        const parsed = config_schemas_1.listConfigsQuerySchema.safeParse(req.query);
        if (!parsed.success) {
            return reply.status(400).send({
                error: 'Invalid query parameters',
                details: parsed.error.errors,
            });
        }
        const { module, limit, offset } = parsed.data;
        const configs = await config_service_1.configService.listConfigs(tenantId, module, limit, offset);
        return { configs };
    });
    // GET /config/configs/:module/:key - Buscar config específica
    fastify.get('/configs/:module/:key', async (req, reply) => {
        const tenantId = req.tenant.id;
        await fastify.requirePermission(['config:read'])(req, reply);
        const parsed = config_schemas_1.configKeySchema.safeParse(req.params);
        if (!parsed.success) {
            return reply.status(400).send({
                error: 'Invalid parameters',
                details: parsed.error.errors,
            });
        }
        const config = await config_service_1.configService.getConfig(tenantId, parsed.data.module, parsed.data.key);
        if (!config) {
            return reply.status(404).send({ error: 'Config not found' });
        }
        return config;
    });
    // POST /config/configs - Criar/atualizar config
    fastify.post('/configs', async (req, reply) => {
        const tenantId = req.tenant.id;
        await fastify.requirePermission(['config:write'])(req, reply);
        const parsed = config_schemas_1.setConfigSchema.safeParse(req.body);
        if (!parsed.success) {
            return reply.status(400).send({
                error: 'Invalid request body',
                details: parsed.error.errors,
            });
        }
        try {
            const config = await config_service_1.configService.setConfig(tenantId, parsed.data.module, parsed.data.key, parsed.data.value, { isSystem: parsed.data.isSystem });
            return reply.status(201).send(config);
        }
        catch (error) {
            const err = error;
            return reply.status(err.statusCode ?? 500).send({ error: err.message });
        }
    });
    // DELETE /config/configs/:module/:key - Deletar config
    fastify.delete('/configs/:module/:key', async (req, reply) => {
        const tenantId = req.tenant.id;
        await fastify.requirePermission(['config:write'])(req, reply);
        const parsed = config_schemas_1.configKeySchema.safeParse(req.params);
        if (!parsed.success) {
            return reply.status(400).send({
                error: 'Invalid parameters',
                details: parsed.error.errors,
            });
        }
        const deleted = await config_service_1.configService.deleteConfig(tenantId, parsed.data.module, parsed.data.key);
        if (!deleted) {
            return reply.status(404).send({ error: 'Config not found' });
        }
        return reply.status(204).send();
    });
    // =====================
    // FEATURE FLAGS
    // =====================
    // GET /config/flags - Listar flags
    fastify.get('/flags', async (req, reply) => {
        const tenantId = req.tenant.id;
        await fastify.requirePermission(['config:read'])(req, reply);
        const parsed = config_schemas_1.listFlagsQuerySchema.safeParse(req.query);
        if (!parsed.success) {
            return reply.status(400).send({
                error: 'Invalid query parameters',
                details: parsed.error.errors,
            });
        }
        const { limit, offset } = parsed.data;
        const flags = await config_service_1.configService.listFeatureFlags(tenantId, limit, offset);
        return { flags };
    });
    // GET /config/flags/:flagName - Buscar flag
    fastify.get('/flags/:flagName', async (req, reply) => {
        const tenantId = req.tenant.id;
        await fastify.requirePermission(['config:read'])(req, reply);
        const parsed = config_schemas_1.flagNameSchema.safeParse(req.params);
        if (!parsed.success) {
            return reply.status(400).send({
                error: 'Invalid flag name',
                details: parsed.error.errors,
            });
        }
        const flag = await config_service_1.configService.getFeatureFlag(tenantId, parsed.data.flagName);
        if (!flag) {
            return reply.status(404).send({ error: 'Feature flag not found' });
        }
        return flag;
    });
    // GET /config/flags/:flagName/check - Verificar se flag está ativa
    fastify.get('/flags/:flagName/check', async (req, reply) => {
        const tenantId = req.tenant.id;
        // Qualquer usuário autenticado pode verificar flags
        const parsedParams = config_schemas_1.flagNameSchema.safeParse(req.params);
        if (!parsedParams.success) {
            return reply.status(400).send({
                error: 'Invalid flag name',
                details: parsedParams.error.errors,
            });
        }
        const parsedQuery = config_schemas_1.checkFlagQuerySchema.safeParse(req.query);
        const userId = parsedQuery.success ? parsedQuery.data.userId : req.user?.id;
        const enabled = await config_service_1.configService.isFeatureEnabled(tenantId, parsedParams.data.flagName, userId);
        return { flagName: parsedParams.data.flagName, enabled };
    });
    // PUT /config/flags/:flagName - Criar/atualizar flag
    fastify.put('/flags/:flagName', async (req, reply) => {
        const tenantId = req.tenant.id;
        await fastify.requirePermission(['config:write'])(req, reply);
        const parsedParams = config_schemas_1.flagNameSchema.safeParse(req.params);
        if (!parsedParams.success) {
            return reply.status(400).send({
                error: 'Invalid flag name',
                details: parsedParams.error.errors,
            });
        }
        const parsedBody = config_schemas_1.upsertFlagSchema.safeParse(req.body);
        if (!parsedBody.success) {
            return reply.status(400).send({
                error: 'Invalid request body',
                details: parsedBody.error.errors,
            });
        }
        try {
            const flag = await config_service_1.configService.upsertFeatureFlag(tenantId, parsedParams.data.flagName, parsedBody.data);
            return flag;
        }
        catch (error) {
            const err = error;
            return reply.status(err.statusCode ?? 500).send({ error: err.message });
        }
    });
    // DELETE /config/flags/:flagName - Deletar flag
    fastify.delete('/flags/:flagName', async (req, reply) => {
        const tenantId = req.tenant.id;
        await fastify.requirePermission(['config:write'])(req, reply);
        const parsed = config_schemas_1.flagNameSchema.safeParse(req.params);
        if (!parsed.success) {
            return reply.status(400).send({
                error: 'Invalid flag name',
                details: parsed.error.errors,
            });
        }
        const deleted = await config_service_1.configService.deleteFeatureFlag(tenantId, parsed.data.flagName);
        if (!deleted) {
            return reply.status(404).send({ error: 'Feature flag not found' });
        }
        return reply.status(204).send();
    });
};
exports.default = configRoutes;
