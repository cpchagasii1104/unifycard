"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assignment_service_1 = require("./assignment.service");
const assignment_schemas_1 = require("./assignment.schemas");
const assignmentRoutes = async (fastify) => {
    /**
     * POST /work/assignments/job/:jobId
     * Criar assignment (contratação de worker para job)
     */
    fastify.post('/job/:jobId', {
        preHandler: fastify.requirePermission(['work:assignment:create']),
    }, async (req, reply) => {
        // Validação manual com Zod
        const params = assignment_schemas_1.jobIdParamsSchema.parse(req.params);
        const body = assignment_schemas_1.createAssignmentSchema.parse(req.body);
        const tenantId = req.tenant.id;
        const clientUserId = req.user.id;
        const { jobId } = params;
        const assignment = await assignment_service_1.assignmentService.createAssignment(tenantId, jobId, clientUserId, body);
        return reply.status(201).send(assignment);
    });
    /**
     * GET /work/assignments
     * Listar assignments com filtros
     */
    fastify.get('/', {
        preHandler: fastify.requirePermission(['work:assignment:read']),
    }, async (req) => {
        // Validação manual com Zod
        const query = assignment_schemas_1.listAssignmentsQuerySchema.parse(req.query);
        const tenantId = req.tenant.id;
        const result = await assignment_service_1.assignmentService.listAssignments(tenantId, query);
        return result;
    });
    /**
     * GET /work/assignments/:assignmentId
     * Buscar assignment por ID
     */
    fastify.get('/:assignmentId', {
        preHandler: fastify.requirePermission(['work:assignment:read']),
    }, async (req, reply) => {
        // Validação manual com Zod
        const params = assignment_schemas_1.assignmentIdParamsSchema.parse(req.params);
        const tenantId = req.tenant.id;
        const { assignmentId } = params;
        const assignment = await assignment_service_1.assignmentService.getById(tenantId, assignmentId);
        if (!assignment) {
            return reply.notFound('Assignment not found');
        }
        return assignment;
    });
    /**
     * PATCH /work/assignments/:assignmentId
     * Atualizar assignment
     */
    fastify.patch('/:assignmentId', {
        preHandler: fastify.requirePermission(['work:assignment:update']),
    }, async (req) => {
        // Validação manual com Zod
        const params = assignment_schemas_1.assignmentIdParamsSchema.parse(req.params);
        const body = assignment_schemas_1.updateAssignmentSchema.parse(req.body);
        const tenantId = req.tenant.id;
        const { assignmentId } = params;
        const assignment = await assignment_service_1.assignmentService.updateAssignment(tenantId, assignmentId, body);
        return assignment;
    });
    /**
     * POST /work/assignments/:assignmentId/complete
     * Finalizar assignment com:
     * - Status = completed
     * - Pagamento automático (via Economy)
     * - Review universal (via core/reviews)
     * - Atualização de reputação (via core/reputation)
     */
    fastify.post('/:assignmentId/complete', {
        preHandler: fastify.requirePermission(['work:assignment:update']),
    }, async (req) => {
        // Validação manual com Zod
        const params = assignment_schemas_1.assignmentIdParamsSchema.parse(req.params);
        const body = assignment_schemas_1.completeAssignmentBodySchema.parse(req.body);
        const tenantId = req.tenant.id;
        const reviewerUserId = req.user.id;
        const { assignmentId } = params;
        const result = await assignment_service_1.assignmentService.markAsCompleted(tenantId, assignmentId, reviewerUserId, body);
        return result;
    });
};
exports.default = assignmentRoutes;
