"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const worker_service_1 = require("./worker.service");
const worker_schemas_1 = require("./worker.schemas");
const workerRoutes = async (fastify) => {
    /**
     * POST /work/workers
     * Criar perfil de worker para o usuário autenticado
     */
    fastify.post('/', {
        preHandler: fastify.requirePermission(['work:worker:create']),
    }, async (req, reply) => {
        // Validação manual com Zod
        const body = worker_schemas_1.createWorkerSchema.parse(req.body);
        const tenantId = req.tenant.id;
        const userId = req.user.id;
        const worker = await worker_service_1.workerService.createWorker(tenantId, userId, body);
        return reply.status(201).send(worker);
    });
    /**
     * GET /work/workers/me
     * Buscar meu perfil de worker
     */
    fastify.get('/me', {
        preHandler: fastify.requirePermission(['work:worker:read']),
    }, async (req, reply) => {
        const tenantId = req.tenant.id;
        const userId = req.user.id;
        const worker = await worker_service_1.workerService.getByUserId(tenantId, userId);
        if (!worker) {
            return reply.notFound('Worker profile not found');
        }
        return worker;
    });
    /**
     * GET /work/workers
     * Listar workers com filtros
     */
    fastify.get('/', {
        preHandler: fastify.requirePermission(['work:worker:read']),
    }, async (req) => {
        // Validação manual com Zod
        const query = worker_schemas_1.listWorkersQuerySchema.parse(req.query);
        const tenantId = req.tenant.id;
        const result = await worker_service_1.workerService.listWorkers(tenantId, query);
        return result;
    });
    /**
     * GET /work/workers/:workerId
     * Buscar worker por ID
     */
    fastify.get('/:workerId', {
        preHandler: fastify.requirePermission(['work:worker:read']),
    }, async (req, reply) => {
        // Validação manual com Zod
        const params = worker_schemas_1.workerIdParamsSchema.parse(req.params);
        const tenantId = req.tenant.id;
        const { workerId } = params;
        const worker = await worker_service_1.workerService.getById(tenantId, workerId);
        if (!worker) {
            return reply.notFound('Worker not found');
        }
        return worker;
    });
    /**
     * PATCH /work/workers/:workerId
     * Atualizar worker
     */
    fastify.patch('/:workerId', {
        preHandler: fastify.requirePermission(['work:worker:update']),
    }, async (req) => {
        // Validação manual com Zod
        const params = worker_schemas_1.workerIdParamsSchema.parse(req.params);
        const body = worker_schemas_1.updateWorkerSchema.parse(req.body);
        const tenantId = req.tenant.id;
        const { workerId } = params;
        const worker = await worker_service_1.workerService.updateWorker(tenantId, workerId, body);
        return worker;
    });
};
exports.default = workerRoutes;
//# sourceMappingURL=worker.routes.js.map