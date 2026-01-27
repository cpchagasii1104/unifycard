// src/core/reporting/reporting.routes.ts
// Rotas do Reporting Core conforme REPORTING_CORE.md

import { FastifyPluginAsync } from 'fastify';
import { reportingService } from './reporting.service';
import { z } from 'zod';

const reportingRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * POST /reports
   * Criar nova denúncia
   * Requer autenticação
   */
  fastify.post<{
    Body: {
      target_type: string;
      target_id: string;
      module: string;
      reason_code: string;
      description?: string;
    };
  }>(
    '/',
    {
      preHandler: async (req, reply) => {
        if (!req.tenant?.id || !req.user?.id) {
          throw fastify.httpErrors.unauthorized('Authentication required');
        }
      },
    },
    async (req, reply) => {
      try {
        const tenantId = req.tenant!.id;
        const userId = req.user!.id || req.user!.userId;

        const schema = z.object({
          target_type: z.enum([
            'GROUP',
            'USER',
            'COMPANY',
            'PROVIDER',
            'DRIVER',
            'SERVICE',
            'POST',
            'COMMENT',
            'TRANSACTION',
          ]),
          target_id: z.string().min(1),
          module: z.string().min(1),
          reason_code: z.enum([
            'FRAUD',
            'SCAM',
            'ABUSE',
            'HARASSMENT',
            'INAPPROPRIATE_CONTENT',
            'SPAM',
            'IMPERSONATION',
            'OTHER',
          ]),
          description: z.string().optional(),
        });

        const validated = schema.parse(req.body);

        const report = await reportingService.createReport(tenantId, {
          reporter_user_id: userId,
          target_type: validated.target_type as any,
          target_id: validated.target_id,
          module: validated.module,
          reason_code: validated.reason_code as any,
          description: validated.description,
        });

        return reply.status(201).send({ report });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({
            error: 'Parâmetros inválidos',
            details: error.errors,
          });
        }

        req.log.error({ err: error }, 'Erro ao criar denúncia');
        return reply.status(500).send({
          error: 'Erro ao criar denúncia',
          message: error instanceof Error ? error.message : 'Erro desconhecido',
        });
      }
    }
  );

  /**
   * GET /reports/mine
   * Listar denúncias do usuário autenticado
   * Requer autenticação
   */
  fastify.get<{
    Querystring: {
      limit?: string;
      offset?: string;
    };
  }>(
    '/mine',
    {
      preHandler: async (req, reply) => {
        if (!req.tenant?.id || !req.user?.id) {
          throw fastify.httpErrors.unauthorized('Authentication required');
        }
      },
    },
    async (req, reply) => {
      try {
        const tenantId = req.tenant!.id;
        const userId = req.user!.id || req.user!.userId;

        const limit = parseInt(req.query.limit || '50', 10);
        const offset = parseInt(req.query.offset || '0', 10);

        const reports = await reportingService.getReportsByReporter(tenantId, userId, limit, offset);

        return reply.send({ reports });
      } catch (error) {
        req.log.error({ err: error }, 'Erro ao listar denúncias do usuário');
        return reply.status(500).send({
          error: 'Erro ao listar denúncias',
          message: error instanceof Error ? error.message : 'Erro desconhecido',
        });
      }
    }
  );

  /**
   * GET /reports
   * Listar denúncias (auditoria)
   * Requer autenticação
   * Nota: Verificação de permissões deve ser feita em nível de aplicação/middleware
   */
  fastify.get<{
    Querystring: {
      module?: string;
      status?: string;
      target_type?: string;
      severity?: string;
      limit?: string;
      offset?: string;
    };
  }>(
    '/',
    {
      preHandler: async (req, reply) => {
        if (!req.tenant?.id || !req.user?.id) {
          throw fastify.httpErrors.unauthorized('Authentication required');
        }
      },
    },
    async (req, reply) => {
      try {
        const tenantId = req.tenant!.id;

        const limit = parseInt(req.query.limit || '50', 10);
        const offset = parseInt(req.query.offset || '0', 10);

        const result = await reportingService.getReports(tenantId, {
          module: req.query.module,
          status: req.query.status,
          target_type: req.query.target_type,
          severity: req.query.severity,
          limit,
          offset,
        });

        return reply.send({
          reports: result.reports,
          total: result.total,
          limit,
          offset,
        });
      } catch (error) {
        req.log.error({ err: error }, 'Erro ao listar denúncias');
        return reply.status(500).send({
          error: 'Erro ao listar denúncias',
          message: error instanceof Error ? error.message : 'Erro desconhecido',
        });
      }
    }
  );

  /**
   * GET /reports/:id
   * Buscar denúncia por ID
   * Requer autenticação
   * Nota: Apenas o reporter pode ver sua própria denúncia. Verificação de permissões
   * para auditoria deve ser feita em nível de aplicação/middleware.
   */
  fastify.get<{
    Params: {
      id: string;
    };
  }>(
    '/:id',
    {
      preHandler: async (req, reply) => {
        if (!req.tenant?.id || !req.user?.id) {
          throw fastify.httpErrors.unauthorized('Authentication required');
        }
      },
    },
    async (req, reply) => {
      try {
        const tenantId = req.tenant!.id;
        const userId = req.user!.id || req.user!.userId;
        const reportId = req.params.id;

        const report = await reportingService.getReportById(tenantId, reportId);
        if (!report) {
          return reply.status(404).send({
            error: 'Denúncia não encontrada',
          });
        }

        // Apenas o reporter pode ver sua própria denúncia
        // Verificação de permissões para auditoria deve ser feita em nível superior
        if (report.reporter_user_id !== userId) {
          return reply.status(403).send({
            error: 'Acesso negado. Apenas o denunciante pode visualizar esta denúncia.',
          });
        }

        // Buscar eventos (audit trail)
        const events = await reportingService.getReportEvents(reportId);

        return reply.send({
          report,
          events,
        });
      } catch (error) {
        req.log.error({ err: error }, 'Erro ao buscar denúncia');
        return reply.status(500).send({
          error: 'Erro ao buscar denúncia',
          message: error instanceof Error ? error.message : 'Erro desconhecido',
        });
      }
    }
  );

  /**
   * PATCH /reports/:id/status
   * Atualizar status da denúncia
   * Requer autenticação
   * Nota: Verificação de permissões para auditoria deve ser feita em nível de aplicação/middleware
   */
  fastify.patch<{
    Params: {
      id: string;
    };
    Body: {
      status: string;
      comment: string;
    };
  }>(
    '/:id/status',
    {
      preHandler: async (req, reply) => {
        if (!req.tenant?.id || !req.user?.id) {
          throw fastify.httpErrors.unauthorized('Authentication required');
        }
      },
    },
    async (req, reply) => {
      try {
        const tenantId = req.tenant!.id;
        const userId = req.user!.id || req.user!.userId;
        const reportId = req.params.id;

        const schema = z.object({
          status: z.enum(['UNDER_REVIEW', 'RESOLVED', 'DISMISSED']),
          comment: z.string().min(1, 'Comentário é obrigatório'),
        });

        const validated = schema.parse(req.body);

        const report = await reportingService.updateReportStatus(tenantId, reportId, {
          status: validated.status as any,
          comment: validated.comment,
          actor_type: 'AUDITOR',
          actor_id: userId,
        });

        return reply.send({ report });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({
            error: 'Parâmetros inválidos',
            details: error.errors,
          });
        }

        req.log.error({ err: error }, 'Erro ao atualizar status da denúncia');
        return reply.status(500).send({
          error: 'Erro ao atualizar status',
          message: error instanceof Error ? error.message : 'Erro desconhecido',
        });
      }
    }
  );
};

export default reportingRoutes;

