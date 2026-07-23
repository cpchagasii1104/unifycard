// service-offerings.routes.ts
// DECISION-0117 D (CP4) — superfícies de OFERTA de serviço canônico (prefixo
// /services). Autoridade: canRepresentActor(provider) server-side. Disponibilidade
// via Unified Availability (owner service_offering) — sem calendário paralelo.
// Booking transacional e pagamento FORA. Zero Bank writer.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { serviceOfferingService, ServiceOfferingError } from './service-offering.service';
import { serviceOfferingConfigService } from './service-offering-config.service';
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
  // 🔴 C3 EDGE C-1 — CONTEXTO de contratação orquestrada (opcional). eventId amarra a reserva a um evento do
  // contratante (autoridade manage_attendees revalidada no service, server-side); configId é metadata SOFT.
  eventId: z.string().uuid().optional(),
  configId: z.string().uuid().optional(),
});

// 🔴 FATIA 3 — CARDÁPIO DE CONFIGS com line-up opcional. Rótulo AUTORAL livre (não-governado);
// team_size DECLARADO (piso = count(line-up), validado no service §4.9.5); situação pt-BR por CHECK
// ('disponivel'|'sob_consulta' — 'sob_consulta' TAMBÉM aparece na listagem). PREÇO FORA desta fatia.
const configCreateSchema = z.object({
  label: z.string().min(1),
  teamSize: z.number().int().positive(),
  requiresSetupCrew: z.boolean().optional().nullable(),
  status: z.enum(['disponivel', 'sob_consulta']).optional().nullable(),
});

const configUpdateSchema = z.object({
  label: z.string().min(1).optional(),
  teamSize: z.number().int().positive().optional(),
  requiresSetupCrew: z.boolean().optional(),
  status: z.enum(['disponivel', 'sob_consulta']).optional(),
  // 🔴 FATIA PREÇO — base "a partir de" POR CONFIG (nível 2 da cascata §2). null = limpa (cai no nível 3).
  defaultPriceCents: z.number().int().min(0).optional().nullable(),
});

const configMemberSchema = z.object({
  memberActorId: z.string().uuid(),
});

// 🔴 FATIA PREÇO — grade de preço por CONFIG (dia-da-semana canônico §4.25 0=Dom..6=Sáb × período do dia pt-BR
// governado). Preço = valor DECLARADO de catálogo ("a partir de"), NUNCA cobrança/movimento de dinheiro
// (Δbank=0; porta-01 FORA; BRL implícito).
const configPriceSetSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  periodOfDay: z.enum(['manha', 'tarde', 'noite']),
  priceCents: z.number().int().min(0),
});

const configPriceRemoveSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  periodOfDay: z.enum(['manha', 'tarde', 'noite']),
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
        { subjectUserId: userId, requesterActorId },
        // 🔴 C3 EDGE C-1 — repassa o contexto (validado server-side no service). Ausente = comportamento antigo.
        { eventId: parsed.data.eventId, configId: parsed.data.configId }
      );
      return reply.status(201).send({ ok: true, data: result });
    } catch (err: any) {
      if (err instanceof ServiceOfferingError) return reply.status(err.statusCode).send({ ok: false, code: err.code, message: err.message });
      // 409 do lock (BOOKING_PROVIDER_TIME_CONFLICT) e demais erros com statusCode propagam como hard-fail.
      return reply.status(err?.statusCode ?? 500).send({ ok: false, code: err?.code ?? 'SERVICE_OFFERING_BOOK_ERROR', message: err?.message ?? 'Erro ao reservar.' });
    }
  });

  // ── FATIA 3 — CARDÁPIO DE CONFIGS (CRUD owner-gated) + LINE-UP opcional (só provider grupo-actor).
  // Autoridade: canRepresentActor(provider) fail-closed NO SERVICE (molde das demais superfícies de offering).
  // Read model devolve TODAS as configs ('sob_consulta' inclusa) com isActiveMember/lineupComplete DERIVADOS.

  fastify.get<{ Params: { offeringId: string } }>('/offerings/:offeringId/configs', async (req, reply) => {
    try {
      const data = await serviceOfferingConfigService.listConfigs(req.tenant!.id, req.params.offeringId);
      return reply.send({ ok: true, data });
    } catch (err) {
      if (err instanceof ServiceOfferingError) return reply.status(err.statusCode).send({ ok: false, code: err.code, message: err.message });
      throw err;
    }
  });

  fastify.post<{ Params: { offeringId: string } }>('/offerings/:offeringId/configs', async (req, reply) => {
    const userId = (req as { user?: { userId?: string } }).user?.userId;
    if (!userId) return reply.status(401).send({ ok: false, code: 'UNAUTHENTICATED' });
    const parsed = configCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ ok: false, code: 'SERVICE_OFFERING_BAD_REQUEST', issues: parsed.error.issues });
    }
    try {
      const config = await serviceOfferingConfigService.createConfig({
        tenantId: req.tenant!.id,
        userId,
        offeringId: req.params.offeringId,
        label: parsed.data.label as string,
        teamSize: parsed.data.teamSize as number,
        requiresSetupCrew: (parsed.data.requiresSetupCrew as boolean | null | undefined) ?? null,
        status: (parsed.data.status as 'disponivel' | 'sob_consulta' | null | undefined) ?? null,
      });
      return reply.status(201).send({ ok: true, data: config });
    } catch (err) {
      if (err instanceof ServiceOfferingError) return reply.status(err.statusCode).send({ ok: false, code: err.code, message: err.message });
      throw err;
    }
  });

  fastify.put<{ Params: { offeringId: string; configId: string } }>('/offerings/:offeringId/configs/:configId', async (req, reply) => {
    const userId = (req as { user?: { userId?: string } }).user?.userId;
    if (!userId) return reply.status(401).send({ ok: false, code: 'UNAUTHENTICATED' });
    const parsed = configUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ ok: false, code: 'SERVICE_OFFERING_BAD_REQUEST', issues: parsed.error.issues });
    }
    try {
      await serviceOfferingConfigService.updateConfig({
        tenantId: req.tenant!.id,
        userId,
        offeringId: req.params.offeringId,
        configId: req.params.configId,
        label: parsed.data.label as string | undefined,
        teamSize: parsed.data.teamSize as number | undefined,
        requiresSetupCrew: parsed.data.requiresSetupCrew as boolean | undefined,
        status: parsed.data.status as 'disponivel' | 'sob_consulta' | undefined,
        // undefined = campo AUSENTE do body (não mexe); null = presente-e-nulo (limpa, cai no nível 3).
        defaultPriceCents: ('defaultPriceCents' in ((req.body as object) ?? {}))
          ? ((parsed.data.defaultPriceCents as number | null | undefined) ?? null) : undefined,
      });
      return reply.send({ ok: true });
    } catch (err) {
      if (err instanceof ServiceOfferingError) return reply.status(err.statusCode).send({ ok: false, code: err.code, message: err.message });
      throw err;
    }
  });

  fastify.delete<{ Params: { offeringId: string; configId: string } }>('/offerings/:offeringId/configs/:configId', async (req, reply) => {
    const userId = (req as { user?: { userId?: string } }).user?.userId;
    if (!userId) return reply.status(401).send({ ok: false, code: 'UNAUTHENTICATED' });
    try {
      await serviceOfferingConfigService.deleteConfig({
        tenantId: req.tenant!.id, userId, offeringId: req.params.offeringId, configId: req.params.configId,
      });
      return reply.send({ ok: true });
    } catch (err) {
      if (err instanceof ServiceOfferingError) return reply.status(err.statusCode).send({ ok: false, code: err.code, message: err.message });
      throw err;
    }
  });

  fastify.post<{ Params: { offeringId: string; configId: string } }>(
    '/offerings/:offeringId/configs/:configId/members',
    async (req, reply) => {
      const userId = (req as { user?: { userId?: string } }).user?.userId;
      if (!userId) return reply.status(401).send({ ok: false, code: 'UNAUTHENTICATED' });
      const parsed = configMemberSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({ ok: false, code: 'SERVICE_OFFERING_BAD_REQUEST', issues: parsed.error.issues });
      }
      try {
        await serviceOfferingConfigService.addConfigMember({
          tenantId: req.tenant!.id,
          userId,
          offeringId: req.params.offeringId,
          configId: req.params.configId,
          memberActorId: parsed.data.memberActorId as string,
        });
        return reply.status(201).send({ ok: true });
      } catch (err) {
        if (err instanceof ServiceOfferingError) return reply.status(err.statusCode).send({ ok: false, code: err.code, message: err.message });
        throw err;
      }
    }
  );

  fastify.delete<{ Params: { offeringId: string; configId: string; memberActorId: string } }>(
    '/offerings/:offeringId/configs/:configId/members/:memberActorId',
    async (req, reply) => {
      const userId = (req as { user?: { userId?: string } }).user?.userId;
      if (!userId) return reply.status(401).send({ ok: false, code: 'UNAUTHENTICATED' });
      try {
        await serviceOfferingConfigService.removeConfigMember({
          tenantId: req.tenant!.id,
          userId,
          offeringId: req.params.offeringId,
          configId: req.params.configId,
          memberActorId: req.params.memberActorId,
        });
        return reply.send({ ok: true });
      } catch (err) {
        if (err instanceof ServiceOfferingError) return reply.status(err.statusCode).send({ ok: false, code: err.code, message: err.message });
        throw err;
      }
    }
  );

  // ── FATIA PREÇO — GRADE DE PREÇO por CONFIG (dia-da-semana × período), owner-gated no service.
  // GET lê base "a partir de" + células ESPARSAS; PUT faz UPSERT de uma célula; DELETE remove uma célula
  // (volta a resolver pelo nível 2/3). Preço = catálogo DECLARADO (Δbank=0; porta-01 FORA; BRL implícito).

  fastify.get<{ Params: { offeringId: string; configId: string } }>(
    '/offerings/:offeringId/configs/:configId/prices',
    async (req, reply) => {
      const userId = (req as { user?: { userId?: string } }).user?.userId;
      if (!userId) return reply.status(401).send({ ok: false, code: 'UNAUTHENTICATED' });
      try {
        const data = await serviceOfferingConfigService.listConfigPrices({
          tenantId: req.tenant!.id, userId, offeringId: req.params.offeringId, configId: req.params.configId,
        });
        return reply.send({ ok: true, data });
      } catch (err) {
        if (err instanceof ServiceOfferingError) return reply.status(err.statusCode).send({ ok: false, code: err.code, message: err.message });
        throw err;
      }
    }
  );

  fastify.put<{ Params: { offeringId: string; configId: string } }>(
    '/offerings/:offeringId/configs/:configId/prices',
    async (req, reply) => {
      const userId = (req as { user?: { userId?: string } }).user?.userId;
      if (!userId) return reply.status(401).send({ ok: false, code: 'UNAUTHENTICATED' });
      const parsed = configPriceSetSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({ ok: false, code: 'SERVICE_OFFERING_BAD_REQUEST', issues: parsed.error.issues });
      }
      try {
        await serviceOfferingConfigService.setConfigPrice({
          tenantId: req.tenant!.id, userId, offeringId: req.params.offeringId, configId: req.params.configId,
          dayOfWeek: parsed.data.dayOfWeek as number,
          periodOfDay: parsed.data.periodOfDay as 'manha' | 'tarde' | 'noite',
          priceCents: parsed.data.priceCents as number,
        });
        return reply.send({ ok: true });
      } catch (err) {
        if (err instanceof ServiceOfferingError) return reply.status(err.statusCode).send({ ok: false, code: err.code, message: err.message });
        throw err;
      }
    }
  );

  fastify.delete<{ Params: { offeringId: string; configId: string } }>(
    '/offerings/:offeringId/configs/:configId/prices',
    async (req, reply) => {
      const userId = (req as { user?: { userId?: string } }).user?.userId;
      if (!userId) return reply.status(401).send({ ok: false, code: 'UNAUTHENTICATED' });
      const parsed = configPriceRemoveSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({ ok: false, code: 'SERVICE_OFFERING_BAD_REQUEST', issues: parsed.error.issues });
      }
      try {
        await serviceOfferingConfigService.removeConfigPrice({
          tenantId: req.tenant!.id, userId, offeringId: req.params.offeringId, configId: req.params.configId,
          dayOfWeek: parsed.data.dayOfWeek as number,
          periodOfDay: parsed.data.periodOfDay as 'manha' | 'tarde' | 'noite',
        });
        return reply.send({ ok: true });
      } catch (err) {
        if (err instanceof ServiceOfferingError) return reply.status(err.statusCode).send({ ok: false, code: err.code, message: err.message });
        throw err;
      }
    }
  );

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
