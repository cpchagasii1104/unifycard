// service-offerings.routes.ts
// DECISION-0117 D (CP4) — superfícies de OFERTA de serviço canônico (prefixo
// /services). Autoridade: canRepresentActor(provider) server-side. Disponibilidade
// via Unified Availability (owner service_offering) — sem calendário paralelo.
// Booking transacional e pagamento FORA. Zero Bank writer.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { serviceOfferingService, ServiceOfferingError } from './service-offering.service';
import { authorizationService } from '@core/authorization/authorization.service';

// 🔴 F-PERFORMER-CONTRACTING-POLICY — política de contratação (aceita-direto × negocia + gate de distância).
// Vocabulário GOVERNADO por CHECK (mode = 'manual'|'automatic'); condição = same_city OU radius_km. Preço FORA.
const contractingPolicyShape = {
  bookingApprovalMode: z.enum(['manual', 'automatic']).optional().nullable(),
  acceptDirectSameCity: z.boolean().optional().nullable(),
  acceptDirectRadiusKm: z.number().positive().optional().nullable(),
};

// 🔴 F-PERFORMER-AUDIENCE-RANGE — FAIXA DE PÚBLICO preferida (colunas REAIS, both-or-neither validado no service).
// PREFERÊNCIA que alimenta a descoberta; DISTINTA de conditions.audience_capacity (equipamento). Só shape aqui;
// a regra both-or-neither/min<=max é enforçada em assertAudienceRange (service). /discover querystring INALTERADO.
const audienceRangeShape = {
  audienceMin: z.number().int().positive().optional().nullable(),
  audienceMax: z.number().int().positive().optional().nullable(),
};

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
  ...contractingPolicyShape,
  ...audienceRangeShape,
});

const updateSchema = z.object({
  priceCents: z.number().int().min(0).optional().nullable(),
  durationMinutes: z.number().int().positive().optional().nullable(),
  status: z.enum(['draft', 'active', 'suspended']).optional().nullable(),
  ...contractingPolicyShape,
  ...audienceRangeShape,
});

const bookingSchema = z.object({
  availabilityId: z.string().uuid(),
  requesterActorId: z.string().uuid(),
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
        tenantId: req.tenant!.id,
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
        bookingApprovalMode: (b.bookingApprovalMode as 'manual' | 'automatic' | null | undefined) ?? null,
        acceptDirectSameCity: (b.acceptDirectSameCity as boolean | null | undefined) ?? null,
        acceptDirectRadiusKm: (b.acceptDirectRadiusKm as number | null | undefined) ?? null,
        audienceMin: (b.audienceMin as number | null | undefined) ?? null,
        audienceMax: (b.audienceMax as number | null | undefined) ?? null,
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
        tenantId: req.tenant!.id,
        userId,
        offeringId: req.params.offeringId,
        priceCents: (parsed.data.priceCents as number | undefined) ?? null,
        durationMinutes: (parsed.data.durationMinutes as number | undefined) ?? null,
        status: (parsed.data.status as 'draft' | 'active' | 'suspended' | undefined) ?? null,
        // undefined = campo AUSENTE do body (não mexe); null = presente-e-nulo. Preserva a semântica do radius.
        bookingApprovalMode: ('bookingApprovalMode' in (req.body as object ?? {})) ? ((parsed.data.bookingApprovalMode as 'manual' | 'automatic' | null | undefined) ?? null) : undefined,
        acceptDirectSameCity: ('acceptDirectSameCity' in (req.body as object ?? {})) ? ((parsed.data.acceptDirectSameCity as boolean | null | undefined) ?? null) : undefined,
        acceptDirectRadiusKm: ('acceptDirectRadiusKm' in (req.body as object ?? {})) ? ((parsed.data.acceptDirectRadiusKm as number | null | undefined) ?? null) : undefined,
        // undefined = campo AUSENTE do body (não mexe); null = presente-e-nulo (limpa). Preserva both-or-neither no service.
        audienceMin: ('audienceMin' in (req.body as object ?? {})) ? ((parsed.data.audienceMin as number | null | undefined) ?? null) : undefined,
        audienceMax: ('audienceMax' in (req.body as object ?? {})) ? ((parsed.data.audienceMax as number | null | undefined) ?? null) : undefined,
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
        tenantId: req.tenant!.id,
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

  /**
   * 🔴 F-PERFORMER-CONTRACTING-POLICY — POST /offerings/:offeringId/bookings — o CONTRATANTE solicita/reserva
   * uma janela. subject prova autoridade sobre o próprio actor (req.user + requesterActorId, revalidado no core).
   * O modo (aceita-direto/negocia) e a condição de distância são do DONO — decididos server-side, não na tela.
   * 'automatic' + dentro da distância confirma na hora (lock por provider); senão fica 'requested' (negocia).
   */
  fastify.post<{ Params: { offeringId: string } }>('/offerings/:offeringId/bookings', async (req, reply) => {
    const userId = (req as { user?: { userId?: string } }).user?.userId;
    if (!userId) return reply.status(401).send({ ok: false, code: 'UNAUTHENTICATED' });
    const parsed = bookingSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ ok: false, code: 'SERVICE_OFFERING_BAD_REQUEST', issues: parsed.error.issues });
    }
    const requesterActorId = parsed.data.requesterActorId as string;
    // DECISION-0113: o contratante só reserva REPRESENTANDO o actor declarado (fail-closed). O core (createBooking)
    // revalida — defesa em profundidade (DECISION-0148).
    let canRep = false;
    try { canRep = await authorizationService.canRepresentActor(req.tenant!.id, userId, requesterActorId); } catch { canRep = false; }
    if (!canRep) {
      return reply.status(403).send({ ok: false, code: 'SERVICE_OFFERING_BOOK_NOT_REPRESENTABLE', message: 'Sem autoridade sobre o actor declarado.' });
    }
    try {
      const result = await serviceOfferingService.requestBooking(
        req.tenant!.id, req.params.offeringId, parsed.data.availabilityId as string,
        { subjectUserId: userId, requesterActorId }
      );
      return reply.status(201).send({ ok: true, data: result });
    } catch (err: any) {
      if (err instanceof ServiceOfferingError) return reply.status(err.statusCode).send({ ok: false, code: err.code, message: err.message });
      // 409 do lock (BOOKING_PROVIDER_TIME_CONFLICT) e demais erros com statusCode propagam como hard-fail.
      return reply.status(err?.statusCode ?? 500).send({ ok: false, code: err?.code ?? 'SERVICE_OFFERING_BOOK_ERROR', message: err?.message ?? 'Erro ao reservar.' });
    }
  });

  /** Ofertas ativas agrupadas pela identidade canônica (discovery de serviço). */
  fastify.get<{ Params: { canonicalServiceId: string } }>(
    '/offerings/by-canonical/:canonicalServiceId',
    async (req, reply) => {
      const data = await serviceOfferingService.listActiveBycanonicalService(req.tenant!.id, req.params.canonicalServiceId);
      return reply.send({ ok: true, data });
    }
  );
};

export default serviceOfferingsRoutes;
