"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const application_service_1 = require("./application.service");
const worker_service_1 = require("../workers/worker.service");
const application_schemas_1 = require("./application.schemas");
const applicationRoutes = async (fastify) => {
    /**
     * POST /work/applications/job/:jobId
     * Aplicar para um job
     */
    fastify.post('/job/:jobId', {
        preHandler: fastify.requirePermission(['work:application:create']),
    }, async (req, reply) => {
        // Validação manual com Zod
        const params = application_schemas_1.jobIdParamsSchema.parse(req.params);
        const body = application_schemas_1.createApplicationSchema.parse(req.body);
        const tenantId = req.tenant.id;
        const userId = req.user.id;
        const { jobId } = params;
        // Buscar worker profile do usuário
        const worker = await worker_service_1.workerService.getByUserId(tenantId, userId);
        if (!worker) {
            return reply.badRequest('Worker profile not found. Create a worker profile first.');
        }
        const application = await application_service_1.applicationService.createApplication(tenantId, worker.workerId, jobId, body);
        return reply.status(201).send(application);
    });
    /**
     * GET /work/applications
     * Listar applications com filtros
     */
    fastify.get('/', {
        preHandler: fastify.requirePermission(['work:application:read']),
    }, async (req) => {
        // Validação manual com Zod
        const query = application_schemas_1.listApplicationsQuerySchema.parse(req.query);
        const tenantId = req.tenant.id;
        const result = await application_service_1.applicationService.listApplications(tenantId, query);
        return result;
    });
    /**
     * GET /work/applications/:applicationId
     * Buscar application por ID
     */
    fastify.get('/:applicationId', {
        preHandler: fastify.requirePermission(['work:application:read']),
    }, async (req, reply) => {
        // Validação manual com Zod
        const params = application_schemas_1.applicationIdParamsSchema.parse(req.params);
        const tenantId = req.tenant.id;
        const { applicationId } = params;
        const application = await application_service_1.applicationService.getById(tenantId, applicationId);
        if (!application) {
            return reply.notFound('Application not found');
        }
        return application;
    });
    /**
     * PATCH /work/applications/:applicationId
     * Atualizar application (aceitar/rejeitar)
     */
    fastify.patch('/:applicationId', {
        preHandler: fastify.requirePermission(['work:application:update']),
    }, async (req) => {
        // Validação manual com Zod
        const params = application_schemas_1.applicationIdParamsSchema.parse(req.params);
        const body = application_schemas_1.updateApplicationSchema.parse(req.body);
        const tenantId = req.tenant.id;
        const { applicationId } = params;
        const application = await application_service_1.applicationService.updateApplication(tenantId, applicationId, body);
        return application;
    });
};
exports.default = applicationRoutes;
//# sourceMappingURL=application.routes.js.map