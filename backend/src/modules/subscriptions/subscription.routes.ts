// backend/src/modules/subscriptions/subscription.routes.ts
// SPRINT 87: ASSINATURAS (RECORRÊNCIA AUDITÁVEL)

import type { FastifyInstance } from 'fastify';
import { subscriptionService } from './subscription.service';
import { resolveActiveActorFromRequest } from '@modules/social/actor.utils';

// ╔═ ORIENTAÇÃO CANÔNICA ══════════════════════════════════════════
// ║ STATUS:  FORA DO MÍNIMO DE PRODUTO + INALCANÇÁVEL (F-OUT-OF-SCOPE-CONTAINMENT, 2026-08-01)
// ║ NORMA:   decisão de produto de Clayton, 2026-08-01 (cartório REMEDIATION_DT_LOG.md, topo)
// ║ NÃO:     montar este módulo. São 7 endpoints e subscription.routes.ts NUNCA é importado (a superfície viva de assinatura é outra: marketplace-subscriptions.routes.ts) —
// ║          logo NÃO há rota alcançável hoje. Por isso NÃO recebeu contenção 501: 501 em rota
// ║          inalcançável é decoração, e decoração envelhece pior que ausência. NÃO apagar
// ║          arquivo/módulo (ato de Clayton); NÃO materializar substrato.
// ║ EM VEZ:  o guard audit-product-scope-containment.mjs MORDE se este módulo voltar a ser
// ║          registrado sem GATE. Iniciar este escopo = decisão de Clayton + GATE, e aí sim
// ║          materializar substrato do archive.
// ╚════════════════════════════════════════════════════════════════

/**
 * Rotas REST para Subscriptions
 */
const subscriptionRoutes = async (fastify: FastifyInstance) => {
  /**
   * POST /subscriptions
   * Cria assinatura
   */
  fastify.post<{
    Body: {
      contactId: string;
      paymentLinkId: string;
      amountCents: number;
      currency?: string;
      interval: 'WEEKLY' | 'MONTHLY' | 'YEARLY';
      intervalCount?: number;
      dayOfMonth?: number | null;
      nextRunAt?: string;
      maxFailures?: number;
      metadata?: Record<string, any>;
    };
  }>('/', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const {
      contactId,
      paymentLinkId,
      amountCents,
      currency,
      interval,
      intervalCount,
      dayOfMonth,
      nextRunAt,
      maxFailures,
      metadata,
    } = req.body;

    const actor = await resolveActiveActorFromRequest(req, tenantId, {
      allowUserFallback: true,
      userId: req.user?.id,
    });

    const subscription = await subscriptionService.createSubscription(
      tenantId,
      actor.actor_id,
      req.user?.id || null,
      {
        contactId,
        paymentLinkId,
        amountCents,
        currency,
        interval,
        intervalCount,
        dayOfMonth,
        nextRunAt: nextRunAt ? new Date(nextRunAt) : undefined,
        maxFailures,
        metadata,
      }
    );

    return reply.status(201).send(subscription);
  });

  /**
   * GET /subscriptions
   * Lista assinaturas
   */
  fastify.get<{
    Querystring: {
      contactId?: string;
      paymentLinkId?: string;
      status?: 'ACTIVE' | 'PAUSED' | 'CANCELLED';
      limit?: number;
      offset?: number;
    };
  }>('/', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const query = req.query;

    const filters: any = {};
    if (query.contactId) filters.contactId = query.contactId;
    if (query.paymentLinkId) filters.paymentLinkId = query.paymentLinkId;
    if (query.status) filters.status = query.status;
    if (query.limit != null) filters.limit = Number(query.limit);
    if (query.offset != null) filters.offset = Number(query.offset);

    const subscriptions = await subscriptionService.listSubscriptions(tenantId, filters);

    return reply.send({ subscriptions });
  });

  /**
   * GET /subscriptions/:id
   * Busca assinatura por ID
   */
  fastify.get<{ Params: { id: string } }>('/:id', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const subscriptionId = req.params.id;

    const subscription = await subscriptionService.getSubscriptionById(tenantId, subscriptionId);

    if (!subscription) {
      return reply.status(404).send({ error: 'Assinatura não encontrada' });
    }

    return reply.send(subscription);
  });

  /**
   * POST /subscriptions/:id/pause
   * Pausa assinatura
   */
  fastify.post<{ Params: { id: string } }>('/:id/pause', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const subscriptionId = req.params.id;

    const actor = await resolveActiveActorFromRequest(req, tenantId, {
      allowUserFallback: true,
      userId: req.user?.id,
    });

    const subscription = await subscriptionService.pauseSubscription(
      tenantId,
      subscriptionId,
      actor.actor_id,
      req.user?.id || null
    );

    return reply.send(subscription);
  });

  /**
   * POST /subscriptions/:id/resume
   * Retoma assinatura
   */
  fastify.post<{ Params: { id: string } }>('/:id/resume', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const subscriptionId = req.params.id;

    const actor = await resolveActiveActorFromRequest(req, tenantId, {
      allowUserFallback: true,
      userId: req.user?.id,
    });

    const subscription = await subscriptionService.resumeSubscription(
      tenantId,
      subscriptionId,
      actor.actor_id,
      req.user?.id || null
    );

    return reply.send(subscription);
  });

  /**
   * POST /subscriptions/:id/cancel
   * Cancela assinatura
   */
  fastify.post<{ Params: { id: string } }>('/:id/cancel', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const subscriptionId = req.params.id;

    const actor = await resolveActiveActorFromRequest(req, tenantId, {
      allowUserFallback: true,
      userId: req.user?.id,
    });

    const subscription = await subscriptionService.cancelSubscription(
      tenantId,
      subscriptionId,
      actor.actor_id,
      req.user?.id || null
    );

    return reply.send(subscription);
  });

  /**
   * POST /subscriptions/run-due
   * Agenda execuções de assinaturas vencidas (admin/internal)
   *
   * 🔴 CONTENÇÃO (achado da verificação de V3 do parecer sobre a re-auditoria Yala, 2026-07-05):
   * o comentário "admin/internal" era um FALSO SENSO DE SEGURANÇA — o handler não tinha NENHUMA
   * checagem de autenticação/permissão. `runDueSubscriptions` → `executeSubscriptionAction` →
   * `paymentExecutionService.executePayment`, e como esta rota nunca seta `payment_method_snapshot`
   * no intent, o fluxo cai no branch REAL de movimentação (user_wallet → escrow_payments via
   * `bankAccountService`), não no simulado. Zero caller legítimo hoje (grep exaustivo). Mesmo
   * padrão JÁ aplicado em `automation/schedule/run-due` (`F-FINANCIAL-INTERNAL-SURFACES-P1-
   * CONTAINMENT`) para a MESMA classe de rota — replicado aqui. `runDueSubscriptions`/
   * `executeSubscriptionAction` permanecem intactos no service para um futuro worker/internal
   * caller; a contenção é só na BORDA.
   */
  fastify.post<{
    Body: {
      limit?: number;
    };
  }>('/run-due', async (_req, reply) => {
    return reply.status(403).send({
      ok: false,
      code: 'SUBSCRIPTIONS_RUN_DUE_HTTP_DISABLED',
      message: 'Scheduled due-subscription execution through this HTTP route is disabled; it must run via an internal/worker caller.',
    });
  });
};

export default subscriptionRoutes;


