// backend/src/modules/rides/safety/safety.controller.ts

import type { FastifyRequest, FastifyReply } from 'fastify';
import { safetyService } from './safety.service';

export class SafetyController {
  // Contatos de emergência
  async addEmergencyContact(req: FastifyRequest, reply: FastifyReply) {
    const tenantId = req.tenant?.id;
    const userId = req.user?.id;
    if (!tenantId || !userId) {
      return reply.status(401).send({ error: 'Authentication required' });
    }
    const body = req.body as any;

    const contact = await safetyService.addEmergencyContact(tenantId, userId, {
      name: body.name,
      phone: body.phone,
    });

    return reply.send({
      success: true,
      data: contact,
    });
  }

  async listEmergencyContacts(req: FastifyRequest, reply: FastifyReply) {
    const tenantId = req.tenant?.id;
    const userId = req.user?.id;
    if (!tenantId || !userId) {
      return reply.status(401).send({ error: 'Authentication required' });
    }

    const contacts = await safetyService.listEmergencyContacts(tenantId, userId);

    return reply.send({
      success: true,
      data: contacts,
    });
  }

  // Compartilhamento de corrida
  async shareRide(req: FastifyRequest, reply: FastifyReply) {
    const tenantId = req.tenant?.id;
    const userId = req.user?.id;
    if (!tenantId || !userId) {
      return reply.status(401).send({ error: 'Authentication required' });
    }
    const { rideId } = req.params as any;

    const share = await safetyService.shareRide(tenantId, String(rideId), userId);

    return reply.send({
      success: true,
      data: share,
    });
  }

  async listRideShares(req: FastifyRequest, reply: FastifyReply) {
    const tenantId = req.tenant?.id;
    if (!tenantId) {
      return reply.status(401).send({ error: 'Tenant not found' });
    }
    const { rideId } = req.params as any;

    const shares = await safetyService.listRideShares(
      tenantId,
      String(rideId)
    );

    return reply.send({
      success: true,
      data: shares,
    });
  }

  // Disputas
  async openDispute(req: FastifyRequest, reply: FastifyReply) {
    const tenantId = req.tenant?.id;
    const userId = req.user?.id;
    if (!tenantId || !userId) {
      return reply.status(401).send({ error: 'Authentication required' });
    }
    const { rideId } = req.params as any;
    const body = req.body as any;

    const dispute = await safetyService.openDispute(
      tenantId,
      String(rideId),
      userId,
      body.reason,
      body.details
    );

    return reply.send({
      success: true,
      data: dispute,
    });
  }

  async listDisputesForRide(req: FastifyRequest, reply: FastifyReply) {
    const tenantId = req.tenant?.id;
    if (!tenantId) {
      return reply.status(401).send({ error: 'Tenant not found' });
    }
    const { rideId } = req.params as any;

    const disputes = await safetyService.listRideDisputes(
      tenantId,
      String(rideId)
    );

    return reply.send({
      success: true,
      data: disputes,
    });
  }
}

export const safetyController = new SafetyController();
