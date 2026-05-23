// src/modules/rides/safety/safety.routes.ts
//
// Rotas Fastify para segurança no módulo Rides

import type {
  FastifyInstance,
  FastifyPluginAsync,
  FastifyRequest,
  FastifyReply
} from 'fastify';

import { runQueryWithTenant, runQueriesWithTenant, runTenantTransactionWithClient } from '@core/db';
import { BadRequestError, NotFoundError } from '@core/errors';
import { publishRideEventOutbox } from '../shared/publish-ride-event';
import { notifyService } from '@core/notify/notify.service';

interface CreateContactBody {
  name: string;
  phone: string;
}

interface SOSBody {
  rideId: string;
  lat: number;
  lng: number;
  type: 'passenger' | 'driver';
  message?: string;
}

interface ShareRideBody {
  rideId: string;
  contactIds: string[];
}

interface ReportIncidentBody {
  rideId: string;
  type: string;
  description?: string;
}

const safetyRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {

  // =====================================================================
  // GET /contacts — lista contatos de emergência do usuário
  // =====================================================================
  fastify.get(
    '/contacts',
    {
      preHandler: [fastify.requirePermission(['rides:safety:read'])],
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const tenantId = req.tenant?.id;
      const userId = req.user?.id;
      if (!tenantId || !userId) throw new BadRequestError('Missing tenant or user context');

      const contacts = await runQueriesWithTenant<any>(tenantId, {
        text: `
          SELECT contact_id, user_id, name, phone, created_at
          FROM rides_emergency_contacts
          WHERE tenant_id = $1 AND user_id = $2;
        `,
        values: [tenantId, userId],
      });

      return contacts;
    }
  );

  // =====================================================================
  // POST /contacts — adicionar contato de emergência
  // =====================================================================
  fastify.post<{ Body: CreateContactBody }>(
    '/contacts',
    {
      preHandler: [fastify.requirePermission(['rides:safety:write'])],
    },
    async (req, reply) => {
      const tenantId = req.tenant?.id;
      const userId = req.user?.id;
      if (!tenantId || !userId) throw new BadRequestError('Missing tenant or user context');

      const { name, phone } = req.body;
      if (!name || !phone) throw new BadRequestError('name and phone required');

      const contact = await runTenantTransactionWithClient(tenantId, async (client) => {
        const { rows } = await client.query(
          `
            INSERT INTO rides_emergency_contacts (
              tenant_id,
              user_id,
              name,
              phone
            )
            VALUES ($1, $2, $3, $4)
            RETURNING *;
          `,
          [tenantId, userId, name, phone]
        );

        return rows[0];
      });

      reply.code(201);
      return contact;
    }
  );

  // =====================================================================
  // POST /sos — acionamento de emergência
  // =====================================================================
  fastify.post<{ Body: SOSBody }>(
    '/sos',
    {
      preHandler: [fastify.requirePermission(['rides:safety:write'])],
    },
    async (req, reply) => {
      const tenantId = req.tenant?.id;
      const userId = req.user?.id;
      if (!tenantId || !userId) throw new BadRequestError('Missing tenant or user context');

      const { rideId, lat, lng, type, message } = req.body;

      if (!rideId || !lat || !lng || !type) {
        throw new BadRequestError('Missing required fields');
      }

      const ride = await runQueryWithTenant<any>(tenantId, {
        text: `
          SELECT ride_id, passenger_user_id, driver_id
          FROM rides_rides
          WHERE tenant_id = $1 AND ride_id = $2;
        `,
        values: [tenantId, rideId],
      });

      if (!ride) throw new NotFoundError('Ride not found');

      await runTenantTransactionWithClient(tenantId, async (client) => {
        await client.query(
          `
          INSERT INTO rides_ride_events (ride_id, event_type, payload, occurredAt)
          VALUES ($1, 'sos_triggered', jsonb_build_object(
            'lat', $2,
            'lng', $3,
            'sender_type', $4,
            'sender_user_id', $5,
            'message', $6
          ), NOW());
        `,
          [rideId, lat, lng, type, userId, message ?? null]
        );

        await publishRideEventOutbox(client, {
          type: 'rides.safety.sos_triggered',
          tenantId,
          payload: {
            rideId,
            senderUserId: userId,
            senderType: type,
            lat,
            lng,
          },
        });
      });

      // notificar contatos de emergência
      const contacts = await runQueriesWithTenant<{ name: string; phone: string }>(tenantId, {
        text: `
          SELECT name, phone
          FROM rides_emergency_contacts
          WHERE tenant_id = $1 AND user_id = $2;
        `,
        values: [tenantId, userId],
      });

      for (const c of contacts) {
        await notifyService.send({
          tenantId,
          channel: 'sms',
          target: c.phone,
          payload: {
            title: 'Alerta SOS',
            message: `Alerta de emergência de ${c.name}`,
            lat,
            lng,
            rideId,
          },
        });
      }

      // notificar time de segurança via push
      await notifyService.send({
        tenantId,
        channel: 'push',
        target: 'security_team',
        payload: {
          title: 'Alerta de Segurança',
          message: `SOS acionado na corrida ${rideId}`,
          rideId,
          lat,
          lng,
          triggeredBy: userId,
        },
      });

      return { ok: true };
    }
  );

  // =====================================================================
  // POST /share — compartilhar corrida com contatos confiáveis
  // =====================================================================
  fastify.post<{ Body: ShareRideBody }>(
    '/share',
    {
      preHandler: [fastify.requirePermission(['rides:safety:write'])],
    },
    async (req, reply) => {
      const tenantId = req.tenant?.id;
      const userId = req.user?.id;
      if (!tenantId || !userId) throw new BadRequestError('Missing tenant or user context');

      const { rideId, contactIds } = req.body;

      if (!rideId || !Array.isArray(contactIds)) {
        throw new BadRequestError('rideId and contactIds required');
      }

      const result = await runTenantTransactionWithClient(tenantId, async (client) => {
        const { rows: rideRows } = await client.query(
          `
            SELECT ride_id
            FROM rides_rides
            WHERE tenant_id = $1 AND ride_id = $2;
          `,
          [tenantId, rideId]
        );

        const ride = rideRows[0];
        if (!ride) throw new NotFoundError('Ride not found');

        for (const contactId of contactIds) {
          await client.query(
            `
              INSERT INTO rides_ride_shares (
                tenant_id,
                ride_id,
                contact_id,
                sharedAt
              )
              VALUES ($1, $2, $3, NOW());
            `,
            [tenantId, rideId, contactId]
          );

          const { rows: contactRows } = await client.query(
            `
              SELECT phone
              FROM rides_emergency_contacts
              WHERE tenant_id = $1 AND contact_id = $2
            `,
            [tenantId, contactId]
          );

          const phone = contactRows[0]?.phone;
          if (phone) {
            await notifyService.send({
              tenantId,
              channel: 'sms',
              target: phone,
              payload: {
                title: 'Corrida compartilhada',
                message: `Você foi adicionado como contato de segurança para esta corrida`,
                rideId,
                sharedBy: userId,
              },
            });
          }
        }

        await publishRideEventOutbox(client, {
          type: 'rides.ride.shared',
          tenantId,
          payload: {
            rideId,
            userId,
            contactIds,
          },
        });

        return { rideId, sharedWith: contactIds.length };
      });

      return result;
    }
  );

  // =====================================================================
  // POST /incident — reportar incidente de segurança
  // =====================================================================
  fastify.post<{ Body: ReportIncidentBody }>(
    '/incident',
    {
      preHandler: [fastify.requirePermission(['rides:safety:write'])],
    },
    async (req, reply) => {
      const tenantId = req.tenant?.id;
      const userId = req.user?.id;
      if (!tenantId || !userId) throw new BadRequestError('Missing tenant or user context');

      const { rideId, type, description } = req.body;

      if (!rideId || !type) throw new BadRequestError('rideId and type required');

      const incident = await runTenantTransactionWithClient(tenantId, async (client) => {
        const { rows } = await client.query(
          `
            INSERT INTO rides_disputes (
              tenant_id,
              ride_id,
              reported_by_user_id,
              type,
              description,
              created_at
            )
            VALUES ($1, $2, $3, $4, $5, NOW())
            RETURNING *;
          `,
          [tenantId, rideId, userId, type, description ?? null]
        );

        const row = rows[0];
        await publishRideEventOutbox(client, {
          type: 'rides.safety.incident_reported',
          tenantId,
          payload: {
            rideId,
            incidentId: row.dispute_id,
            type,
          },
        });

        return row;
      });

      reply.code(201);
      return incident;
    }
  );
};

export default safetyRoutes;

