// service-offerings.routes.ts
// DECISION-0117 D (CP4) — superfícies de OFERTA de serviço canônico (prefixo
// /services). Autoridade: canRepresentActor(provider) server-side. Disponibilidade
// via Unified Availability (owner service_offering) — sem calendário paralelo.
// Booking transacional e pagamento FORA. Zero Bank writer.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { serviceOfferingService, ServiceOfferingError } from './service-offering.service';

const createSchema = z.object({
  providerActorId: z.string().uuid(),
  canonicalServiceId: z.string().uuid(),
  companyId: z.string().uuid().optional().nullable(),
  priceCents: z.number().int().min(0),
  durationMinutes: z.number().int().positive(),
  professionalActorId: z.string().uuid().optional().nullable(),
  modality: z.enum(['in_person', 'remote', 'home']).optional(),
  location: z.record(z.unknown()).optional().nullable(),
  serviceArea: z.record(z.unknown()).optional().nullable(),
  conditions: z.record(z.unknown()).optional().nullable(),
});

const updateSchema = z.object({
  priceCents: z.number().int().min(0).optional().nullable(),
  durationMinutes: z.number().int().positive().optional().nullable(),
  status: z.enum(['draft', 'active', 'suspended']).optional().nullable(),
});

const availabilitySchema = z.object({
  startDatetime: z.string().min(1),
  endDatetime: z.string().min(1),
  capacity: z.number().int().positive().optional().nullable(),
});

const serviceOfferingsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/offerings', async (req, reply) => {
    const userId = (req as { user?: { userId?: string } }).user?.userId;
    if (!userId) return reply.status(401).send({ ok: false, code: 'UNAUTHENTICATED' });
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ ok: false, code: 'SERVICE_OFFERING_BAD_REQUEST', issues: parsed.error.issues });
    }
    const b = parsed.data as z.infer<typeof createSchema> & {
      providerActorId: string; canonicalServiceId: string; priceCents: number; durationMinutes: number;
    };
    try {
      const { offering, created } = await serviceOfferingService.createOffering({
        tenantId: req.tenant.id,
        userId,
        providerActorId: b.providerActorId,
        canonicalServiceId: b.canonicalServiceId,
        companyId: b.companyId ?? null,
        priceCents: b.priceCents,
        durationMinutes: b.durationMinutes,
        professionalActorId: b.professionalActorId ?? null,
        modality: (b.modality as 'in_person' | 'remote' | 'home' | undefined) ?? 'in_person',
        location: (b.location as Record<string, unknown> | null) ?? null,
        serviceArea: (b.serviceArea as Record<string, unknown> | null) ?? null,
        conditions: (b.conditions as Record<string, unknown> | null) ?? null,
      });
      return reply.status(created ? 201 : 200).send({ ok: true, data: offering, created });
    } catch (err) {
      if (err instanceof ServiceOfferingError) return reply.status(err.statusCode).send({ ok: false, code: err.code, message: err.message });
      throw err;
    }
  });

  fastify.put<{ Params: { offeringId: string } }>('/offerings/:offeringId', async (req, reply) => {
    const userId = (req as { user?: { userId?: string } }).user?.userId;
    if (!userId) return reply.status(401).send({ ok: false, code: 'UNAUTHENTICATED' });
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ ok: false, code: 'SERVICE_OFFERING_BAD_REQUEST', issues: parsed.error.issues });
    }
    try {
      await serviceOfferingService.updateOwnOffering({
        tenantId: req.tenant.id,
        userId,
        offeringId: req.params.offeringId,
        priceCents: (parsed.data.priceCents as number | undefined) ?? null,
        durationMinutes: (parsed.data.durationMinutes as number | undefined) ?? null,
        status: (parsed.data.status as 'draft' | 'active' | 'suspended' | undefined) ?? null,
      });
      return reply.send({ ok: true });
    } catch (err) {
      if (err instanceof ServiceOfferingError) return reply.status(err.statusCode).send({ ok: false, code: err.code, message: err.message });
      throw err;
    }
  });

  fastify.post<{ Params: { offeringId: string } }>('/offerings/:offeringId/availability', async (req, reply) => {
    const userId = (req as { user?: { userId?: string } }).user?.userId;
    if (!userId) return reply.status(401).send({ ok: false, code: 'UNAUTHENTICATED' });
    const parsed = availabilitySchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ ok: false, code: 'SERVICE_OFFERING_BAD_REQUEST', issues: parsed.error.issues });
    }
    try {
      const availability = await serviceOfferingService.declareAvailability({
        tenantId: req.tenant.id,
        userId,
        offeringId: req.params.offeringId,
        startDatetime: parsed.data.startDatetime as string,
        endDatetime: parsed.data.endDatetime as string,
        capacity: (parsed.data.capacity as number | undefined) ?? null,
      });
      return reply.status(201).send({ ok: true, data: availability });
    } catch (err) {
      if (err instanceof ServiceOfferingError) return reply.status(err.statusCode).send({ ok: false, code: err.code, message: err.message });
      throw err;
    }
  });

  /** Ofertas ativas agrupadas pela identidade canônica (discovery de serviço). */
  fastify.get<{ Params: { canonicalServiceId: string } }>(
    '/offerings/by-canonical/:canonicalServiceId',
    async (req, reply) => {
      const data = await serviceOfferingService.listActiveBycanonicalService(req.tenant.id, req.params.canonicalServiceId);
      return reply.send({ ok: true, data });
    }
  );
};

export default serviceOfferingsRoutes;
