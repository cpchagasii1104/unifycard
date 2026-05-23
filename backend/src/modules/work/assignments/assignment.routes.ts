// src/modules/work/assignments/assignment.routes.ts
import { FastifyPluginAsync } from 'fastify';
import { NotFoundError } from '@core/errors';
import { assignmentService } from './assignment.service';
import { ensureUserActor } from '@modules/identity/actor-writer.service';
import { requireFinancialRiskClearance } from '@modules/risk-identity/risk-financial-gate';
import {
  createAssignmentSchema,
  updateAssignmentSchema,
  assignmentIdParamsSchema,
  jobIdParamsSchema,
  listAssignmentsQuerySchema,
  completeAssignmentBodySchema,
} from './assignment.schemas';
import { z } from 'zod';

const assignmentRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * POST /work/assignments/job/:jobId
   * Criar assignment (contratação de worker para job)
   */
  fastify.post<{
    Params: z.infer<typeof jobIdParamsSchema>;
    Body: z.infer<typeof createAssignmentSchema>;
  }>('/job/:jobId', {
    preHandler: fastify.requirePermission(['work:assignment:create']),
  }, async (req, reply) => {
    // Validação manual com Zod
    const params = jobIdParamsSchema.parse(req.params);
    const body = createAssignmentSchema.parse(req.body);
    const tenantId = req.tenant!.id;
    const clientUserId = req.user!.id;
    const { jobId } = params;

    const assignment = await assignmentService.createAssignment(
      tenantId,
      jobId,
      clientUserId,
      body,
    );

    return reply.status(201).send(assignment);
  });

  /**
   * GET /work/assignments
   * Listar assignments com filtros
   */
  fastify.get<{
    Querystring: z.infer<typeof listAssignmentsQuerySchema>;
  }>('/', {
    preHandler: fastify.requirePermission(['work:assignment:read']),
  }, async (req) => {
    // Validação manual com Zod
    const query = listAssignmentsQuerySchema.parse(req.query);
    const tenantId = req.tenant!.id;
    const result = await assignmentService.listAssignments(tenantId, query);
    return result;
  });

  /**
   * GET /work/assignments/:assignmentId
   * Buscar assignment por ID
   */
  fastify.get<{
    Params: z.infer<typeof assignmentIdParamsSchema>;
  }>('/:assignmentId', {
    preHandler: fastify.requirePermission(['work:assignment:read']),
  }, async (req) => {
    // Validação manual com Zod
    const params = assignmentIdParamsSchema.parse(req.params);
    const tenantId = req.tenant!.id;
    const { assignmentId } = params;

    const assignment = await assignmentService.getById(tenantId, assignmentId);

    if (!assignment) {
      throw new NotFoundError('Assignment not found');
    }

    return assignment;
  });

  /**
   * PATCH /work/assignments/:assignmentId
   * Atualizar assignment
   */
  fastify.patch<{
    Params: z.infer<typeof assignmentIdParamsSchema>;
    Body: z.infer<typeof updateAssignmentSchema>;
  }>('/:assignmentId', {
    preHandler: fastify.requirePermission(['work:assignment:update']),
  }, async (req) => {
    // Validação manual com Zod
    const params = assignmentIdParamsSchema.parse(req.params);
    const body = updateAssignmentSchema.parse(req.body);
    const tenantId = req.tenant!.id;
    const { assignmentId } = params;

    const assignment = await assignmentService.updateAssignment(
      tenantId,
      assignmentId,
      body,
    );

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
  fastify.post<{
    Params: z.infer<typeof assignmentIdParamsSchema>;
    Body: z.infer<typeof completeAssignmentBodySchema>;
  }>('/:assignmentId/complete', {
    preHandler: fastify.requirePermission(['work:assignment:update']),
  }, async (req) => {
    // Validação manual com Zod
    const params = assignmentIdParamsSchema.parse(req.params);
    const body = completeAssignmentBodySchema.parse(req.body);
    const tenantId = req.tenant!.id;
    const reviewerUserId = req.user!.id;
    const { assignmentId } = params;

    // AUTORIDADE: gate financeiro antes de markAsCompleted (INV-FIN)
    // LIMITAÇÃO documentada: amountCents calculado no domínio (split.service), não disponível aqui
    const reviewerActor = await ensureUserActor(tenantId, reviewerUserId);
    if (!reviewerActor?.actor_id) {
      throw Object.assign(new Error('ACTOR_ID_NOT_RESOLVED'), { statusCode: 400 });
    }
    await requireFinancialRiskClearance(tenantId, {
      actorId: reviewerActor.actor_id,
      action: 'financial_transfer',
      // amountCents ausente: valor real calculado pelo split.service downstream
    });

    const result = await assignmentService.markAsCompleted(
      tenantId,
      assignmentId,
      reviewerUserId,
      body,
    );

    return result;
  });
};

export default assignmentRoutes;
