// src/modules/work/jobs/job.routes.ts
import { FastifyPluginAsync } from 'fastify';
import { jobService } from './job.service';
import {
  createJobSchema,
  updateJobSchema,
  jobIdParamsSchema,
  listJobsQuerySchema,
} from './job.schemas';
import { z } from 'zod';

const jobRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * POST /work/jobs
   * Criar novo job
   */
  fastify.post<{
    Body: z.infer<typeof createJobSchema>;
  }>('/', {
    preHandler: fastify.requirePermission(['work:job:create']),
  }, async (req, reply) => {
    // Validação manual com Zod
    const body = createJobSchema.parse(req.body);
    const tenantId = req.tenant!.id;
    const clientUserId = req.user!.id;

    const job = await jobService.createJob(tenantId, clientUserId, body);

    return reply.status(201).send(job);
  });

  /**
   * GET /work/jobs
   * Listar jobs com filtros
   */
  fastify.get<{
    Querystring: z.infer<typeof listJobsQuerySchema>;
  }>('/', {
    preHandler: fastify.requirePermission(['work:job:read']),
  }, async (req) => {
    // Validação manual com Zod
    const query = listJobsQuerySchema.parse(req.query);
    const tenantId = req.tenant!.id;
    const result = await jobService.listJobs(tenantId, query);
    return result;
  });

  /**
   * GET /work/jobs/:jobId
   * Buscar job por ID
   */
  fastify.get<{
    Params: z.infer<typeof jobIdParamsSchema>;
  }>('/:jobId', {
    preHandler: fastify.requirePermission(['work:job:read']),
  }, async (req, reply) => {
    // Validação manual com Zod
    const params = jobIdParamsSchema.parse(req.params);
    const tenantId = req.tenant!.id;
    const { jobId } = params;

    const job = await jobService.getById(tenantId, jobId);

    if (!job) {
      return reply.notFound('Job not found');
    }

    return job;
  });

  /**
   * PATCH /work/jobs/:jobId
   * Atualizar job
   */
  fastify.patch<{
    Params: z.infer<typeof jobIdParamsSchema>;
    Body: z.infer<typeof updateJobSchema>;
  }>('/:jobId', {
    preHandler: fastify.requirePermission(['work:job:update']),
  }, async (req) => {
    // Validação manual com Zod
    const params = jobIdParamsSchema.parse(req.params);
    const body = updateJobSchema.parse(req.body);
    const tenantId = req.tenant!.id;
    const { jobId } = params;

    const job = await jobService.updateJob(tenantId, jobId, body);
    return job;
  });
};

export default jobRoutes;
