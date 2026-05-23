// modules/events/event-lifecycle.routes.ts
import { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { NotFoundError } from '@core/errors';
import { CheckoutTicketService } from '../../modules/events/CheckoutTicketService';
import { CheckoutConsumptionService } from '../../modules/events/CheckoutConsumptionService';
import { rbacService } from '@core/rbac/rbac.service';
import { runQueryWithTenant } from '@core/db';

const ticketService = new CheckoutTicketService();
const consumptionService = new CheckoutConsumptionService();

const eventLifecycleRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * Helper para validar se usuário é owner do evento ou admin
   */
  async function requireEventOwnerOrAdmin(
    req: FastifyRequest,
    eventId: string
  ): Promise<void> {
    const tenantId = req.tenant!.id;
    const userId = req.user!.id;

    if (!userId) {
      throw fastify.httpErrors.unauthorized('Authentication required');
    }

    // Verificar se é owner do evento
    const event = await runQueryWithTenant(
      tenantId,
      {
        text: `
          SELECT created_by_global_user_id, created_by_company_id
          FROM events
          WHERE id = $1
        `,
        values: [eventId],
      }
    );

    if (!event) {
      throw new NotFoundError('Event not found');
    }

    // Se for o criador, permitir
    if (
      event.created_by_global_user_id === req.user!.globalUserId ||
      (event.created_by_company_id &&
        req.user!.globalUserId &&
        (await checkCompanyAdmin(tenantId, req.user!.globalUserId, event.created_by_company_id)))
    ) {
      return;
    }

    // Verificar se é admin
    const hasAdminRole = await rbacService.userHasAnyRole(tenantId, userId, [
      'admin',
      'owner',
    ]);

    if (!hasAdminRole) {
      throw fastify.httpErrors.forbidden(
        'Requires event owner or admin permission'
      );
    }
  }

  async function checkCompanyAdmin(
    tenantId: string,
    userId: string,
    companyId: string
  ): Promise<boolean> {
    const employee = await runQueryWithTenant(
      tenantId,
      {
        text: `
          SELECT role, can_manage_schedule
          FROM company_employees
          WHERE company_id = $1
            AND global_user_id = $2
            AND ended_at IS NULL
        `,
        values: [companyId, userId],
      }
    );

    return (
      employee &&
      (employee.role === 'owner' ||
        employee.role === 'admin' ||
        employee.can_manage_schedule)
    );
  }

  /**
   * POST /api/events/:id/publish — removido (duplicado). Ver `core/events/event.routes.ts`.
   */

  /**
   * POST /api/events/:id/tickets
   * Compra ingresso
   */
  fastify.post<{
    Params: { id: string };
  }>('/:id/tickets', async (req, reply) => {
    if (!req.user) {
      return reply.status(401).send({ error: 'Não autenticado' });
    }

    if (!req.tenant) {
      return reply.status(400).send({ error: 'Tenant não encontrado' });
    }

    if (!req.user.globalUserId) {
      return reply.status(400).send({ error: 'Global user ID required' });
    }

    try {
      const result = await ticketService.purchaseTicket({
        eventId: req.params.id,
        buyerUserId: req.user.globalUserId,
        tenantId: req.tenant.id,
      });

      return reply.status(201).send(result);
    } catch (error) {
      if (error instanceof Error) {
        return reply.status(400).send({ error: error.message });
      }
      fastify.log.error({ err: error }, 'Erro ao comprar ingresso');
      return reply.status(500).send({ error: 'Erro ao comprar ingresso' });
    }
  });

  /**
   * POST /api/events/checkin
   * Check-in com QR code
   */
  fastify.post<{
    Body: {
      qrCode: string;
    };
  }>('/checkin', async (req, reply) => {
    if (!req.user) {
      return reply.status(401).send({ error: 'Não autenticado' });
    }

    if (!req.tenant) {
      return reply.status(400).send({ error: 'Tenant não encontrado' });
    }

    try {
      const result = await ticketService.checkIn(
        req.body.qrCode,
        req.tenant.id
      );

      return reply.status(200).send(result);
    } catch (error) {
      if (error instanceof Error) {
        return reply.status(400).send({ error: error.message });
      }
      fastify.log.error({ err: error }, 'Erro ao fazer check-in');
      return reply.status(500).send({ error: 'Erro ao fazer check-in' });
    }
  });

  /**
   * POST /api/events/:id/consumption
   * Registra consumo
   */
  fastify.post<{
    Params: { id: string };
    Body: {
      items: Array<{ name: string; quantity: number; price: number }>;
    };
  }>('/:id/consumption', async (req, reply) => {
    if (!req.user) {
      return reply.status(401).send({ error: 'Não autenticado' });
    }

    if (!req.tenant) {
      return reply.status(400).send({ error: 'Tenant não encontrado' });
    }

    if (!req.user.globalUserId) {
      return reply.status(400).send({ error: 'Global user ID required' });
    }

    try {
      const result = await consumptionService.registerConsumption({
        eventId: req.params.id,
        userId: req.user.globalUserId,
        tenantId: req.tenant.id,
        items: req.body.items,
      });

      return reply.status(201).send(result);
    } catch (error) {
      if (error instanceof Error) {
        return reply.status(400).send({ error: error.message });
      }
      fastify.log.error({ err: error }, 'Erro ao registrar consumo');
      return reply.status(500).send({ error: 'Erro ao registrar consumo' });
    }
  });

  /**
   * POST /admin/events/:id/cancel — removido (duplicado). Ver `core/events/event.routes.ts`.
   */
};

export default eventLifecycleRoutes;
export { eventLifecycleRoutes };