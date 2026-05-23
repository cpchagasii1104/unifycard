import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { runQueriesWithTenant } from '@core/database/pool';
import { orderService } from '@modules/marketplace/order.service';
import { productVariantRepository } from '@modules/marketplace/product-variant.repository';
import {
  resolveRefsFromVariant,
  type ConceptRefFailureReason,
} from '@modules/marketplace/adapters/concept-offer-refs.adapter';
import {
  claimIntentIdempotency,
  completeIntentIdempotency,
  failIntentIdempotency,
} from './intent-execute-idempotency';
import { inventoryReservationService } from '@modules/marketplace/inventory-reservation.service';
import { InsufficientStockError } from '@modules/marketplace/inventory-reservation.types';

const executeItemSchema = z.object({
  concept_ref: z.string().uuid(),
  offer_ref: z.string().uuid(),
  quantity: z.number().int().positive(),
  item: z.object({ options: z.record(z.unknown()).optional() }).optional(),
});

const REPEAT_INTENTS = new Set(['food.repeat_last_order', 'animal_retail.repeat_last_order']);

const SLOT_WINDOW_RE = /^slot_[a-zA-Z0-9_-]+$/;

function isScheduleIntentType(intentType: string): boolean {
  return intentType.endsWith('.order_schedule');
}

function isValidFulfillmentWindow(window: string): boolean {
  const w = window.trim();
  if (SLOT_WINDOW_RE.test(w)) return true;
  const withOffset = z.string().datetime({ offset: true }).safeParse(w);
  if (withOffset.success) return true;
  return z.string().datetime().safeParse(w).success;
}

const intentExecuteBodySchema = z
  .object({
    intent_type: z.string().trim().min(1).max(256),
    items: z.array(executeItemSchema).optional(),
    seller_actor_id: z.string().uuid().optional(),
    source_order_id: z.string().uuid().optional(),
    fulfillment: z
      .object({
        window: z.string(),
      })
      .optional(),
  })
  .superRefine((data, ctx) => {
    if (REPEAT_INTENTS.has(data.intent_type)) {
      if (!data.source_order_id) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'source_order_id obrigatório para repeat_last_order',
          path: ['source_order_id'],
        });
      }
    } else if (!data.items || data.items.length < 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'items deve conter pelo menos um item',
        path: ['items'],
      });
    }
  });

const ORDER_CREATE_INTENTS = new Set([
  'food.order_place',
  'food.order_schedule',
  'animal_retail.order_place',
  'animal_retail.order_schedule',
  'food.repeat_last_order',
  'animal_retail.repeat_last_order',
]);

function mapIntentToMutation(intentType: string): 'order.create' | null {
  if (ORDER_CREATE_INTENTS.has(intentType)) return 'order.create';
  return null;
}

async function listActiveStoreIdsForProduct(
  tenantId: string,
  productId: string
): Promise<string[]> {
  const rows = await runQueriesWithTenant<{ store_id: string }>(
    tenantId,
    `
    SELECT store_id
    FROM store_product_activations
    WHERE tenant_id = $1 AND product_id = $2 AND status = 'active'
    `,
    [tenantId, productId]
  );
  return rows.map((r) => r.store_id);
}

function intersectStoreSets(sets: Set<string>[]): Set<string> {
  if (sets.length === 0) {
    return new Set();
  }
  let acc = new Set(sets[0]);
  for (let i = 1; i < sets.length; i++) {
    const next = sets[i];
    acc = new Set([...acc].filter((id) => next.has(id)));
  }
  return acc;
}

type ResolveSellerStoreResult =
  | { ok: true; sellerActorId: string }
  | { ok: false; code: 'SELLER_MISMATCH' | 'SELLER_UNRESOLVED' | 'STORE_AMBIGUOUS' };

async function resolveSellerStore(
  tenantId: string,
  productIds: string[],
  explicitSellerId?: string
): Promise<ResolveSellerStoreResult> {
  const unique = [...new Set(productIds)];
  const storeSets: Set<string>[] = [];
  for (const pid of unique) {
    const ids = await listActiveStoreIdsForProduct(tenantId, pid);
    storeSets.push(new Set(ids));
  }

  if (explicitSellerId) {
    for (const s of storeSets) {
      if (!s.has(explicitSellerId)) {
        return { ok: false, code: 'SELLER_MISMATCH' };
      }
    }
    return { ok: true, sellerActorId: explicitSellerId };
  }

  const intersection = intersectStoreSets(storeSets);
  if (intersection.size === 0) {
    return { ok: false, code: 'SELLER_UNRESOLVED' };
  }
  if (intersection.size > 1) {
    return { ok: false, code: 'STORE_AMBIGUOUS' };
  }
  const [only] = [...intersection];
  return { ok: true, sellerActorId: only };
}

type ExecuteLine = {
  concept_ref: string;
  offer_ref: string;
  quantity: number;
  item?: { options?: Record<string, unknown> };
};

async function materializeItemsFromSourceOrder(
  tenantId: string,
  sourceOrderId: string
): Promise<
  | { ok: true; lines: ExecuteLine[] }
  | {
      ok: false;
      code: 'REF_RESOLUTION_FAILED';
      offer_ref: string;
      reason: ConceptRefFailureReason | 'UNKNOWN';
    }
> {
  const lines = await orderService.listItems(tenantId, sourceOrderId);
  const out: ExecuteLine[] = [];
  for (const li of lines) {
    const refs = await resolveRefsFromVariant(li.productVariantId, tenantId);
    if (refs.resolution !== 'ok' || !refs.concept_ref) {
      return {
        ok: false,
        code: 'REF_RESOLUTION_FAILED',
        offer_ref: li.productVariantId,
        reason: refs.failureReason ?? 'UNKNOWN',
      };
    }
    const meta =
      li.metadata && typeof li.metadata === 'object' ? (li.metadata as Record<string, unknown>) : null;
    const nestedItem = meta?.item;
    out.push({
      concept_ref: refs.concept_ref,
      offer_ref: li.productVariantId,
      quantity: li.quantity,
      item:
        nestedItem && typeof nestedItem === 'object'
          ? (nestedItem as { options?: Record<string, unknown> })
          : undefined,
    });
  }
  return { ok: true, lines: out };
}

const intentExecuteRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post<{
    Body: z.infer<typeof intentExecuteBodySchema>;
  }>('/execute', async (req, reply) => {
    const tenantId = req.tenant?.id;
    if (!tenantId) {
      return reply.status(400).send({
        ok: false,
        error: 'tenant obrigatório',
        code: 'TENANT_REQUIRED',
      });
    }

    const rawIdem = req.headers['x-idempotency-key'];
    const rawIdemStr = Array.isArray(rawIdem) ? rawIdem[0] : rawIdem;
    if (rawIdemStr == null || String(rawIdemStr).trim() === '') {
      return reply.status(400).send({ ok: false, code: 'IDEMPOTENCY_KEY_REQUIRED' });
    }
    const idempotencyKey = String(rawIdemStr).trim();

    const idemClaim = await claimIntentIdempotency(tenantId, idempotencyKey);
    if (idemClaim.kind === 'replay') {
      return reply.status(200).send(idemClaim.payload);
    }
    if (idemClaim.kind === 'busy') {
      return reply.status(409).send({ ok: false, code: 'REQUEST_IN_PROGRESS' });
    }

    let succeeded = false;
    try {
    const actionContext = (req as { actionContext?: { actorId?: string } }).actionContext;
    const buyerActorId = actionContext?.actorId;
    if (!buyerActorId) {
      return reply.status(400).send({
        ok: false,
        error: 'ActionContext.actorId é obrigatório',
        code: 'ACTOR_REQUIRED',
      });
    }

    const parsed = intentExecuteBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({
        ok: false,
        error: 'validação estrutural falhou',
        code: 'VALIDATION_FAILED',
        details: parsed.error.flatten(),
      });
    }

    const { intent_type, seller_actor_id: sellerActorIdOpt } = parsed.data;
    const mutation = mapIntentToMutation(intent_type);
    if (!mutation) {
      return reply.status(400).send({
        ok: false,
        error: 'intent_type não suportado para execução',
        code: 'INTENT_UNSUPPORTED',
      });
    }

    if (isScheduleIntentType(intent_type)) {
      const win = parsed.data.fulfillment?.window;
      if (win == null || String(win).trim() === '') {
        return reply.status(400).send({
          ok: false,
          code: 'FULFILLMENT_WINDOW_REQUIRED',
        });
      }
      if (!isValidFulfillmentWindow(String(win))) {
        return reply.status(400).send({
          ok: false,
          code: 'INVALID_FULFILLMENT_WINDOW',
        });
      }
    }

    let items: ExecuteLine[];
    let sourceOrderIdForMeta: string | undefined;

    if (REPEAT_INTENTS.has(intent_type)) {
      const sourceOrderId = parsed.data.source_order_id as string;
      sourceOrderIdForMeta = sourceOrderId;
      const prevOrder = await orderService.getOrderById(tenantId, sourceOrderId);
      if (!prevOrder) {
        return reply.status(404).send({
          ok: false,
          code: 'ORDER_NOT_FOUND',
        });
      }
      if (prevOrder.buyerActorId !== buyerActorId) {
        return reply.status(403).send({
          ok: false,
          code: 'UNAUTHORIZED_ORDER_ACCESS',
        });
      }
      const mat = await materializeItemsFromSourceOrder(tenantId, sourceOrderId);
      if (mat.ok === false) {
        return reply.status(400).send({
          ok: false,
          code: mat.code,
          offer_ref: mat.offer_ref,
          reason: mat.reason,
        });
      }
      if (mat.lines.length === 0) {
        return reply.status(400).send({
          ok: false,
          code: 'EMPTY_SOURCE_ORDER',
        });
      }
      items = mat.lines;
    } else {
      items = parsed.data.items as ExecuteLine[];
    }

    const productIds: string[] = [];
    for (const line of items) {
      const refs = await resolveRefsFromVariant(line.offer_ref, tenantId);
      if (refs.resolution !== 'ok' || !refs.concept_ref) {
        return reply.status(400).send({
          ok: false,
          error: 'offer_ref / concept_ref incoerentes ou inválidos',
          code: 'REF_RESOLUTION_FAILED',
          offer_ref: line.offer_ref,
          reason: refs.failureReason ?? 'UNKNOWN',
        });
      }
      if (refs.concept_ref !== line.concept_ref) {
        return reply.status(400).send({
          ok: false,
          error: 'concept_ref não corresponde à oferta',
          code: 'CONCEPT_OFFER_MISMATCH',
        });
      }
      const variant = await productVariantRepository.getVariantById(tenantId, line.offer_ref);
      if (!variant) {
        return reply.status(400).send({
          ok: false,
          error: 'variante não encontrada',
          code: 'VARIANT_NOT_FOUND',
        });
      }
      productIds.push(variant.productId);
    }

    const sellerResult = await resolveSellerStore(tenantId, productIds, sellerActorIdOpt);
    if (sellerResult.ok === false) {
      return reply.status(400).send({
        ok: false,
        code: sellerResult.code,
      });
    }
    const sellerActorId = sellerResult.sellerActorId;

    const changedByUserId = (req as { user?: { id: string } }).user?.id;

    const fulfillmentWindowNormalized =
      isScheduleIntentType(intent_type) && parsed.data.fulfillment?.window != null
        ? String(parsed.data.fulfillment.window).trim()
        : undefined;

    let orderId: string | null = null;
    try {
      const { order } = await orderService.createOrderWithItemsAndReservations(
        tenantId,
        {
          buyerActorId,
          sellerActorId,
          metadata: {
            intent_type,
            mutation,
            source: 'intent.execute',
            ...(sourceOrderIdForMeta ? { source_order_id: sourceOrderIdForMeta } : {}),
            ...(fulfillmentWindowNormalized
              ? { fulfillment: { window: fulfillmentWindowNormalized } }
              : {}),
          },
        },
        items.map((line) => ({
          productVariantId: line.offer_ref,
          quantity: line.quantity,
          metadata: {
            concept_ref: line.concept_ref,
            item: line.item ?? null,
          },
        })),
        'MARKETPLACE',
        changedByUserId
      );
      orderId = order.id;

      const submitted = await orderService.submitOrder(
        tenantId,
        orderId,
        changedByUserId,
        'intent.execute submit'
      );

      const responsePayload = {
        ok: true,
        mutation,
        order: submitted,
      };
      await completeIntentIdempotency(tenantId, idempotencyKey, responsePayload);
      succeeded = true;
      return reply.status(201).send(responsePayload);
    } catch (err) {
      if (orderId) {
        try {
          await inventoryReservationService.releaseReservation(tenantId, orderId);
        } catch {
          /* ignore */
        }
        try {
          await orderService.cancelOrder(tenantId, orderId, changedByUserId, 'intent.execute rollback');
        } catch {
          /* ignore */
        }
      }
      if (err instanceof InsufficientStockError) {
        return reply.status(400).send({
          ok: false,
          code: err.code,
          product_variant_id: err.productVariantId,
          available: err.available,
          requested: err.requested,
        });
      }
      return reply.status(400).send({
        ok: false,
        error: err instanceof Error ? err.message : String(err),
        code: 'EXECUTION_FAILED',
      });
    }
    } finally {
      if (!succeeded) {
        await failIntentIdempotency(tenantId, idempotencyKey);
      }
    }
  });
};

export default intentExecuteRoutes;