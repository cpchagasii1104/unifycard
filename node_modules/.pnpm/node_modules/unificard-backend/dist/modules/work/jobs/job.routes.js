"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const job_service_1 = require("./job.service");
const job_schemas_1 = require("./job.schemas");
const jobRoutes = async (fastify) => {
    /**
     * POST /work/jobs
     * Criar novo job
     */
    fastify.post('/', {
        preHandler: fastify.requirePermission(['work:job:create']),
    }, async (req, reply) => {
        // Validação manual com Zod
        const body = job_schemas_1.createJobSchema.parse(req.body);
        const tenantId = req.tenant.id;
        const clientUserId = req.user.id;
        const job = await job_service_1.jobService.createJob(tenantId, clientUserId, body);
        return reply.status(201).send(job);
    });
    /**
     * GET /work/jobs
     * Listar jobs com filtros
     */
    fastify.get('/', {
        preHandler: fastify.requirePermission(['work:job:read']),
    }, async (req) => {
        // Validação manual com Zod
        const query = job_schemas_1.listJobsQuerySchema.parse(req.query);
        const tenantId = req.tenant.id;
        const result = await job_service_1.jobService.listJobs(tenantId, query);
        return result;
    });
    /**
     * GET /work/jobs/:jobId
     * Buscar job por ID
     */
    fastify.get('/:jobId', {
        preHandler: fastify.requirePermission(['work:job:read']),
    }, async (req, reply) => {
        // Validação manual com Zod
        const params = job_schemas_1.jobIdParamsSchema.parse(req.params);
        const tenantId = req.tenant.id;
        const { jobId } = params;
        const job = await job_service_1.jobService.getById(tenantId, jobId);
        if (!job) {
            return reply.notFound('Job not found');
        }
        return job;
    });
    /**
     * PATCH /work/jobs/:jobId
     * Atualizar job
     */
    fastify.patch('/:jobId', {
        preHandler: fastify.requirePermission(['work:job:update']),
    }, async (req) => {
        // Validação manual com Zod
        const params = job_schemas_1.jobIdParamsSchema.parse(req.params);
        const body = job_schemas_1.updateJobSchema.parse(req.body);
        const tenantId = req.tenant.id;
        const { jobId } = params;
        const job = await job_service_1.jobService.updateJob(tenantId, jobId, body);
        return job;
    });
};
exports.default = jobRoutes;
//# sourceMappingURL=job.routes.js.map