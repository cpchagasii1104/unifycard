// src/modules/schedule/schedule.routes.ts
import { FastifyPluginAsync } from 'fastify';
import { scheduleService } from './schedule.service';
import { createScheduleSchema, addSlotSchema, reserveSlotSchema } from './schedule.schemas';

const scheduleRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * POST /schedule/create
   * Cria uma nova agenda
   */
  fastify.post<{
    Body: {
      globalUserId?: string | null;
      companyId?: string | null;
      serviceId?: string | null;
      metadata?: Record<string, any>;
    };
  }>(
    '/create',
    {
      schema: {
        body: {
          type: 'object',
          properties: {
            globalUserId: { type: ['string', 'null'] },
            companyId: { type: ['string', 'null'] },
            serviceId: { type: ['string', 'null'] },
            metadata: { type: 'object' },
          },
        },
      },
    },
    async (req, reply) => {
      if (!req.user) {
        return reply.status(401).send({ error: 'Não autenticado' });
      }

      if (!req.tenant) {
        return reply.status(400).send({ error: 'Tenant não encontrado' });
      }

      try {
        const validated = createScheduleSchema.parse(req.body);
        const schedule = await scheduleService.createSchedule(req.tenant.id, validated);
        return reply.status(201).send(schedule);
      } catch (error) {
        if (error instanceof Error) {
          return reply.status(400).send({ error: error.message });
        }
        fastify.log.error({ err: error }, 'Erro ao criar agenda');
        return reply.status(500).send({ error: 'Erro ao criar agenda' });
      }
    }
  );

  /**
   * POST /schedule/:scheduleId/add-slot
   * Adiciona um slot a uma agenda
   */
  fastify.post<{
    Params: { scheduleId: string };
    Body: {
      startTime: string;
      endTime: string;
      status?: 'available' | 'reserved' | 'blocked';
      metadata?: Record<string, any>;
    };
  }>(
    '/:scheduleId/add-slot',
    {
      schema: {
        params: {
          type: 'object',
          properties: {
            scheduleId: { type: 'string' },
          },
        },
        body: {
          type: 'object',
          required: ['startTime', 'endTime'],
          properties: {
            startTime: { type: 'string' },
            endTime: { type: 'string' },
            status: { type: 'string', enum: ['available', 'reserved', 'blocked'] },
            metadata: { type: 'object' },
          },
        },
      },
    },
    async (req, reply) => {
      if (!req.user) {
        return reply.status(401).send({ error: 'Não autenticado' });
      }

      if (!req.tenant) {
        return reply.status(400).send({ error: 'Tenant não encontrado' });
      }

      try {
        const validated = addSlotSchema.parse(req.body);
        const slot = await scheduleService.addSlot(
          req.tenant.id,
          req.params.scheduleId,
          validated
        );
        return reply.status(201).send(slot);
      } catch (error) {
        if (error instanceof Error) {
          return reply.status(400).send({ error: error.message });
        }
        fastify.log.error({ err: error }, 'Erro ao adicionar slot');
        return reply.status(500).send({ error: 'Erro ao adicionar slot' });
      }
    }
  );

  /**
   * POST /schedule/:scheduleId/reserve-slot
   * Reserva um slot
   */
  fastify.post<{
    Params: { scheduleId: string };
    Body: {
      slotId: string;
      actionId?: string;
      metadata?: Record<string, any>;
    };
  }>(
    '/:scheduleId/reserve-slot',
    {
      schema: {
        params: {
          type: 'object',
          properties: {
            scheduleId: { type: 'string' },
          },
        },
        body: {
          type: 'object',
          required: ['slotId'],
          properties: {
            slotId: { type: 'string' },
            actionId: { type: 'string' },
            metadata: { type: 'object' },
          },
        },
      },
    },
    async (req, reply) => {
      if (!req.user) {
        return reply.status(401).send({ error: 'Não autenticado' });
      }

      if (!req.user.globalUserId) {
        return reply.status(404).send({ error: 'Identidade global não encontrada' });
      }

      if (!req.tenant) {
        return reply.status(400).send({ error: 'Tenant não encontrado' });
      }

      try {
        const validated = reserveSlotSchema.parse(req.body);
        const slot = await scheduleService.reserveSlot(
          req.tenant.id,
          req.params.scheduleId,
          validated,
          req.user.globalUserId
        );
        return reply.status(200).send(slot);
      } catch (error) {
        if (error instanceof Error) {
          return reply.status(400).send({ error: error.message });
        }
        fastify.log.error({ err: error }, 'Erro ao reservar slot');
        return reply.status(500).send({ error: 'Erro ao reservar slot' });
      }
    }
  );

  /**
   * GET /schedule/:scheduleId
   * Busca agenda com slots
   */
  fastify.get<{
    Params: { scheduleId: string };
    Querystring: {
      startDate?: string;
      endDate?: string;
    };
  }>(
    '/:scheduleId',
    {
      schema: {
        params: {
          type: 'object',
          properties: {
            scheduleId: { type: 'string' },
          },
        },
        querystring: {
          type: 'object',
          properties: {
            startDate: { type: 'string' },
            endDate: { type: 'string' },
          },
        },
      },
    },
    async (req, reply) => {
      if (!req.user) {
        return reply.status(401).send({ error: 'Não autenticado' });
      }

      if (!req.tenant) {
        return reply.status(400).send({ error: 'Tenant não encontrado' });
      }

      try {
        const schedule = await scheduleService.getScheduleWithSlots(
          req.tenant.id,
          req.params.scheduleId,
          {
            startDate: req.query.startDate ? new Date(req.query.startDate) : undefined,
            endDate: req.query.endDate ? new Date(req.query.endDate) : undefined,
          }
        );

        if (!schedule) {
          return reply.status(404).send({ error: 'Agenda não encontrada' });
        }

        return schedule;
      } catch (error) {
        fastify.log.error({ err: error }, 'Erro ao buscar agenda');
        return reply.status(500).send({ error: 'Erro ao buscar agenda' });
      }
    }
  );

  /**
   * GET /schedule/of-user/:globalUserId
   * Busca agenda de um usuário
   */
  fastify.get<{
    Params: { globalUserId: string };
  }>(
    '/of-user/:globalUserId',
    {
      schema: {
        params: {
          type: 'object',
          properties: {
            globalUserId: { type: 'string' },
          },
        },
      },
    },
    async (req, reply) => {
      if (!req.user) {
        return reply.status(401).send({ error: 'Não autenticado' });
      }

      if (!req.tenant) {
        return reply.status(400).send({ error: 'Tenant não encontrado' });
      }

      try {
        const schedule = await scheduleService.getScheduleByUser(
          req.tenant.id,
          req.params.globalUserId
        );

        if (!schedule) {
          return reply.status(404).send({ error: 'Agenda não encontrada' });
        }

        return schedule;
      } catch (error) {
        fastify.log.error({ err: error }, 'Erro ao buscar agenda do usuário');
        return reply.status(500).send({ error: 'Erro ao buscar agenda do usuário' });
      }
    }
  );

  /**
   * GET /schedule/of-company/:companyId
   * Busca agenda de uma empresa
   */
  fastify.get<{
    Params: { companyId: string };
  }>(
    '/of-company/:companyId',
    {
      schema: {
        params: {
          type: 'object',
          properties: {
            companyId: { type: 'string' },
          },
        },
      },
    },
    async (req, reply) => {
      if (!req.user) {
        return reply.status(401).send({ error: 'Não autenticado' });
      }

      if (!req.tenant) {
        return reply.status(400).send({ error: 'Tenant não encontrado' });
      }

      try {
        const schedule = await scheduleService.getScheduleByCompany(
          req.tenant.id,
          req.params.companyId
        );

        if (!schedule) {
          return reply.status(404).send({ error: 'Agenda não encontrada' });
        }

        return schedule;
      } catch (error) {
        fastify.log.error({ err: error }, 'Erro ao buscar agenda da empresa');
        return reply.status(500).send({ error: 'Erro ao buscar agenda da empresa' });
      }
    }
  );
};

export default scheduleRoutes;








