// marketplace-offerings.routes.ts
// DECISION-0117 A (CP4) — superfícies de ATIVAÇÃO de variante canônica e OFERTA
// empresarial (prefixo /marketplace). Autoridade server-side: canRepresentActor
// do merchant (DECISION-0113 — actorId do cliente é alvo, nunca autoridade).
// Zero Bank writer; preço pertence à oferta; estoque permanece actor-scoped.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { productOfferingService, ProductOfferingError } from './product-offering.service';

const activateSchema = z.object({
  storeActorId: z.string().uuid(),
  companyId: z.string().uuid().optional().nullable(),
  canonicalVariantId: z.string().uuid(),
  internalSku: z.string().min(1).max(120),
  saleUnit: z.string().min(1).max(50),
  priceCents: z.number().int().min(0),
  availableQuantity: z.number().int().min(0).optional().nullable(),
  minQuantity: z.number().int().positive().optional().nullable(),
  conditions: z.record(z.unknown()).optional().nullable(),
  fulfillment: z.record(z.unknown()).optional().nullable(),
  locationCityId: z.string().uuid().optional().nullable(),
  locationRegionId: z.string().uuid().optional().nullable(),
});

const updateOfferSchema = z.object({
  priceCents: z.number().int().min(0).optional().nullable(),
  availableQuantity: z.number().int().min(0).optional().nullable(),
  status: z.enum(['draft', 'active', 'inactive']).optional().nullable(),
});

const marketplaceOfferingsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/offerings/product', async (req, reply) => {
    const userId = (req as { user?: { userId?: string } }).user?.userId;
    if (!userId) return reply.status(401).send({ ok: false, code: 'UNAUTHENTICATED' });
    const parsed = activateSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ ok: false, code: 'OFFER_BAD_REQUEST', issues: parsed.error.issues });
    }
    const b = parsed.data as z.infer<typeof activateSchema> & {
      storeActorId: string; canonicalVariantId: string; internalSku: string; saleUnit: string; priceCents: number;
    };
    try {
      const { result, created } = await productOfferingService.activateVariantAndCreateOffer({
        tenantId: req.tenant!.id,
        userId,
        storeActorId: b.storeActorId,
        companyId: b.companyId ?? null,
        canonicalVariantId: b.canonicalVariantId,
        internalSku: b.internalSku,
        saleUnit: b.saleUnit,
        priceCents: b.priceCents,
        availableQuantity: b.availableQuantity ?? null,
        minQuantity: b.minQuantity ?? null,
        conditions: (b.conditions as Record<string, unknown> | null) ?? null,
        fulfillment: (b.fulfillment as Record<string, unknown> | null) ?? null,
        locationCityId: b.locationCityId ?? null,
        locationRegionId: b.locationRegionId ?? null,
      });
      return reply.status(created ? 201 : 200).send({ ok: true, data: result, created });
    } catch (err) {
      if (err instanceof ProductOfferingError) return reply.status(err.statusCode).send({ ok: false, code: err.code, message: err.message });
      throw err;
    }
  });

  fastify.put<{ Params: { offerId: string } }>('/offerings/product/:offerId', async (req, reply) => {
    const userId = (req as { user?: { userId?: string } }).user?.userId;
    if (!userId) return reply.status(401).send({ ok: false, code: 'UNAUTHENTICATED' });
    const parsed = updateOfferSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ ok: false, code: 'OFFER_BAD_REQUEST', issues: parsed.error.issues });
    }
    try {
      await productOfferingService.updateOwnOffer({
        tenantId: req.tenant!.id,
        userId,
        offerId: req.params.offerId,
        priceCents: (parsed.data.priceCents as number | undefined) ?? null,
        availableQuantity: (parsed.data.availableQuantity as number | undefined) ?? null,
        status: (parsed.data.status as 'draft' | 'active' | 'inactive' | undefined) ?? null,
      });
      return reply.send({ ok: true });
    } catch (err) {
      if (err instanceof ProductOfferingError) return reply.status(err.statusCode).send({ ok: false, code: err.code, message: err.message });
      throw err;
    }
  });
};

export default marketplaceOfferingsRoutes;
