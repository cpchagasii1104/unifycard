// src/modules/work/applications/application.routes.ts
import { FastifyPluginAsync } from 'fastify';
import { NotFoundError } from '@core/errors';
import { applicationService } from './application.service';
import { workerService } from '../workers/worker.service';
import {
  createApplicationSchema,
  updateApplicationSchema,
  applicationIdParamsSchema,
  jobIdParamsSchema,
  listApplicationsQuerySchema,
} from './application.schemas';
import { z } from 'zod';

const applicationRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * POST /work/applications/job/:jobId
   * Aplicar para um job
   */
  fastify.post<{
    Params: z.infer<typeof jobIdParamsSchema>;
    Body: z.infer<typeof createApplicationSchema>;
  }>('/job/:jobId', {
    preHandler: fastify.requirePermission(['work:application:create']),
  }, async (req, reply) => {
    // Validação manual com Zod
    const params = jobIdParamsSchema.parse(req.params);
    const body = createApplicationSchema.parse(req.body);
    const tenantId = req.tenant!.id;
    const userId = req.user!.id;
    const { jobId } = params;

    // Buscar worker profile do usuário
    const worker = await workerService.getByUserId(tenantId, userId);

    if (!worker) {
      return reply.badRequest('Worker profile not found. Create a worker profile first.');
    }

    const application = await applicationService.createApplication(
      tenantId,
      worker.workerId,
      jobId,
      body,
    );

    return reply.status(201).send(application);
  });

  /**
   * GET /work/applications
   * Listar applications com filtros
   */
  fastify.get<{
    Querystring: z.infer<typeof listApplicationsQuerySchema>;
  }>('/', {
    preHandler: fastify.requirePermission(['work:application:read']),
  }, async (req) => {
    // Validação manual com Zod
    const query = listApplicationsQuerySchema.parse(req.query);
    const tenantId = req.tenant!.id;
    const result = await applicationService.listApplications(tenantId, query);
    return result;
  });

  /**
   * GET /work/applications/:applicationId
   * Buscar application por ID
   */
  fastify.get<{
    Params: z.infer<typeof applicationIdParamsSchema>;
  }>('/:applicationId', {
    preHandler: fastify.requirePermission(['work:application:read']),
  }, async (req) => {
    // Validação manual com Zod
    const params = applicationIdParamsSchema.parse(req.params);
    const tenantId = req.tenant!.id;
    const { applicationId } = params;

    const application = await applicationService.getById(tenantId, applicationId);

    if (!application) {
      throw new NotFoundError('Application not found');
    }

    return application;
  });

  /**
   * PATCH /work/applications/:applicationId
   * Atualizar application (aceitar/rejeitar)
   */
  fastify.patch<{
    Params: z.infer<typeof applicationIdParamsSchema>;
    Body: z.infer<typeof updateApplicationSchema>;
  }>('/:applicationId', {
    preHandler: fastify.requirePermission(['work:application:update']),
  }, async (req) => {
    // Validação manual com Zod
    const params = applicationIdParamsSchema.parse(req.params);
    const body = updateApplicationSchema.parse(req.body);
    const tenantId = req.tenant!.id;
    const { applicationId } = params;

    const application = await applicationService.updateApplication(
      tenantId,
      applicationId,
      body,
    );

    return application;
  });
};

export default applicationRoutes;
