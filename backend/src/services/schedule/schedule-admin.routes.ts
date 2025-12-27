// src/services/schedule/schedule-admin.routes.ts
import { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { SlotGenerator } from './SlotGenerator';
import { CompanyScheduleService } from './CompanyScheduleService';
import { rbacService } from '@core/rbac/rbac.service';

const slotGenerator = new SlotGenerator();
const companyScheduleService = new CompanyScheduleService();

const scheduleAdminRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * Helper para validar se usuário é admin da empresa
   */
  async function requireCompanyAdmin(
    req: FastifyRequest,
    companyId: string
  ): Promise<void> {
    const tenantId = req.tenant!.id;
    const userId = req.user!.id;

    if (!userId) {
      throw fastify.httpErrors.unauthorized('Authentication required');
    }

    // Verificar se usuário tem permissão de gerenciar funcionários (admin)
    const hasPermission = await rbacService.userHasAllPermissions(tenantId, userId, [
      'companies:manage',
    ]);

    if (!hasPermission.hasPermission) {
      // Verificar se é funcionário com can_manage_schedule
      const { runQueryWithTenant } = await import('@core/db');
      const employee = await runQueryWithTenant(
        tenantId,
        {
          text: `
            SELECT can_manage_schedule
            FROM company_employees
            WHERE company_id = $1
              AND global_user_id = $2
              AND ended_at IS NULL
          `,
          values: [companyId, req.user!.globalUserId],
        }
      );

      if (!employee || !employee.can_manage_schedule) {
        throw fastify.httpErrors.forbidden('Requires company admin permission');
      }
    }
  }

  /**
   * POST /admin/schedules/generate-slots
   * Gera slots para uma agenda
   */
  fastify.post<{
    Body: {
      scheduleId: string;
      companyId: string;
      daysAhead?: number;
    };
  }>(
    '/generate-slots',
    async (req, reply) => {
      if (!req.user) {
        return reply.status(401).send({ error: 'Não autenticado' });
      }

      if (!req.tenant) {
        return reply.status(400).send({ error: 'Tenant não encontrado' });
      }

      try {
        await requireCompanyAdmin(req, req.body.companyId);

        const result = await slotGenerator.generateCompanySlots({
          scheduleId: req.body.scheduleId,
          companyId: req.body.companyId,
          tenantId: req.tenant.id,
          daysAhead: req.body.daysAhead,
        });

        return reply.status(200).send(result);
      } catch (error) {
        if (error instanceof Error) {
          return reply.status(400).send({ error: error.message });
        }
        fastify.log.error({ err: error }, 'Erro ao gerar slots');
        return reply.status(500).send({ error: 'Erro ao gerar slots' });
      }
    }
  );

  /**
   * POST /admin/companies/:id/schedule
   * Cria ou atualiza agenda da empresa
   */
  fastify.post<{
    Params: { id: string };
    Body: {
      timezone: string;
      businessHours: {
        monday?: { start: string; end: string };
        tuesday?: { start: string; end: string };
        wednesday?: { start: string; end: string };
        thursday?: { start: string; end: string };
        friday?: { start: string; end: string };
        saturday?: { start: string; end: string };
        sunday?: { start: string; end: string };
      };
    };
  }>(
    '/companies/:id/schedule',
    async (req, reply) => {
      if (!req.user) {
        return reply.status(401).send({ error: 'Não autenticado' });
      }

      if (!req.tenant) {
        return reply.status(400).send({ error: 'Tenant não encontrado' });
      }

      try {
        await requireCompanyAdmin(req, req.params.id);

        const scheduleId = await companyScheduleService.ensureCompanySchedule({
          companyId: req.params.id,
          tenantId: req.tenant.id,
          timezone: req.body.timezone,
          businessHours: req.body.businessHours,
        });

        return reply.status(200).send({ scheduleId });
      } catch (error) {
        if (error instanceof Error) {
          return reply.status(400).send({ error: error.message });
        }
        fastify.log.error({ err: error }, 'Erro ao criar/atualizar agenda');
        return reply.status(500).send({ error: 'Erro ao criar/atualizar agenda' });
      }
    }
  );

  /**
   * GET /admin/companies/:id/schedule
   * Lê agenda da empresa
   */
  fastify.get<{
    Params: { id: string };
  }>(
    '/companies/:id/schedule',
    async (req, reply) => {
      if (!req.user) {
        return reply.status(401).send({ error: 'Não autenticado' });
      }

      if (!req.tenant) {
        return reply.status(400).send({ error: 'Tenant não encontrado' });
      }

      try {
        await requireCompanyAdmin(req, req.params.id);

        const { runQueryWithTenant } = await import('@core/db');
        const schedule = await runQueryWithTenant(
          req.tenant.id,
          {
            text: `
              SELECT schedule_id, company_id, tenant_id, metadata, created_at, updated_at
              FROM schedules
              WHERE company_id = $1
            `,
            values: [req.params.id],
          }
        );

        if (!schedule) {
          return reply.status(404).send({ error: 'Schedule not found' });
        }

        return reply.status(200).send(schedule);
      } catch (error) {
        if (error instanceof Error) {
          return reply.status(400).send({ error: error.message });
        }
        fastify.log.error({ err: error }, 'Erro ao ler agenda');
        return reply.status(500).send({ error: 'Erro ao ler agenda' });
      }
    }
  );
};

export default scheduleAdminRoutes;















