// src/modules/events/organizers/organizers.routes.ts
import { FastifyPluginAsync } from 'fastify';
import { organizersService } from './organizers.service';
import { organizerPlansService } from './organizer-plans.service';
import { createOrganizerSchema, addMemberSchema, linkEventSchema } from './organizers.schemas';

// 🔴 R8K ORGANIZER BILLING/SUBSCRIPTION SCHEMA-GHOST CONTAINMENT (DECISION-0113 / Z2 · 2026-06-19):
// O substrato de billing do organizer é SCHEMA-GHOST: as colunas event_organizers.plan / plan_expires_at NÃO
// existem (migration archive 0217 nunca aplicada) e organizer_subscriptions tem schema canônico DIFERENTE do que
// organizer-billing.service escreve (current_period_*/payment_gateway*/canceled_at ausentes). Logo subscribe/
// cancel/subscribe-stripe/webhook escreviam em colunas inexistentes (42703/dead) e /:id/subscription/cancel NÃO
// tinha autoridade alguma (qualquer user do tenant cancelava qualquer organizer). CONTENÇÃO decision-neutral: as
// mutações de subscription/billing retornam 501 ORGANIZER_BILLING_SCHEMA_GHOST_CONTAINED antes de qualquer service/
// sink; o webhook Stripe vira no-op 200 (não escreve ghost e não dispara retry storm da Stripe). NÃO decide SaaS-vs-
// split (DECISION própria futura), NÃO toca Bank/ledger, NÃO toca event-settlement canônico (events.actor_id +
// canRepresentActor). Reabrir billing exige schema canônico + decisão de produto + binding de autoridade.
const ORGANIZER_BILLING_GHOST_BODY = {
  error: 'ORGANIZER_BILLING_SCHEMA_GHOST_CONTAINED',
  code: 'ORGANIZER_BILLING_SCHEMA_GHOST_CONTAINED',
  message:
    'Organizer subscription/billing is disabled: its schema is ghost (the organizer plan/expiry and billing ' +
    'columns do not exist in the canonical schema). Reopening requires a canonical schema + a product decision ' +
    '(SaaS vs event-split) + server-side authority binding. No money is moved.',
  decision: 'DECISION-0113',
} as const;

const organizersRoutes: FastifyPluginAsync = async (fastify) => {
  // 🔴 R8O canal-1 BIND (DECISION-0113 / Z2 · 2026-06-19): a autoridade de event-organizer é keyed por
  // global_user_id (owner_global_user_id / event_organizer_members.role via hasPermission). O SUBJECT é o
  // utilizador AUTENTICADO (req.user), resolvido server-side para global_user_id — NUNCA o actionContext.actorId
  // client-declared (que era passado como requesterGlobalUserId, spoofável + semanticamente errado: actor id !=
  // global user id). Helper compartilhado por create/add-member/link-event. event_organizers.actor_id é órfão/não
  // usado pelo modelo; a autoridade real é o global_user_id. Guard: audit-organizers-actor-authority-bind.mjs.
  const resolveRequesterGlobalUserId = async (req: any, reply: any): Promise<string | null> => {
    if (!req.user?.id) {
      reply.status(401).send({ error: 'ORGANIZER_ACTOR_AUTHORITY_REQUIRED', message: 'Não autenticado: subject server-side obrigatório' });
      return null;
    }
    if (!req.tenant?.id) {
      reply.status(400).send({ error: 'Tenant não encontrado' });
      return null;
    }
    const { resolveGlobalUserId } = await import('@core/identity/identity.utils');
    return resolveGlobalUserId(req.user.id, req.tenant.id);
  };

  /**
   * POST /events/organizers/create
   * Cria um novo organizador
   */
  fastify.post<{
    Body: {
      name: string;
      description?: string | null;
      logoUrl?: string | null;
    };
  }>(
    '/create',
    {
      schema: {
        body: {
          type: 'object',
          required: ['name'],
          properties: {
            name: { type: 'string' },
            description: { type: 'string' },
            logoUrl: { type: 'string' },
          },
        },
      },
    },
    async (req, reply) => {
      // 🔴 R8O BIND: subject = req.user (server-side) → global_user_id; o organizer nasce owned pelo caller autenticado.
      const requesterGlobalUserId = await resolveRequesterGlobalUserId(req, reply);
      if (requesterGlobalUserId === null) return reply;

      try {
        const validated = createOrganizerSchema.parse(req.body);

        // Integração com AI Kernel
        let aiSuggestions: any = null;
        try {
          const ai = req.server.ai;
          const analysis = await ai.run('analyze organizer', {
            name: validated.name,
            description: validated.description,
          });

          if (analysis && analysis.result) {
            aiSuggestions = analysis.result;
          }
        } catch (error) {
          // Silenciosamente ignora erros do AI Kernel
          fastify.log.warn({ err: error }, 'Erro ao analisar organizador com AI Kernel');
        }

        const organizer = await organizersService.createOrganizer(
          req.tenant!.id,
          validated,
          requesterGlobalUserId
        );

        return reply.status(201).send({
          organizer,
          aiSuggestions,
        });
      } catch (error) {
        if (error instanceof Error) {
          return reply.status(400).send({ error: error.message });
        }
        return reply.status(500).send({ error: 'Erro ao criar organizador' });
      }
    }
  );

  /**
   * POST /events/organizers/:id/add-member
   * Adiciona membro a um organizador
   */
  fastify.post<{
    Params: { id: string };
    Body: {
      globalUserId: string;
      role: 'owner' | 'admin' | 'editor' | 'viewer';
    };
  }>(
    '/:id/add-member',
    {
      schema: {
        params: {
          type: 'object',
          properties: {
            id: { type: 'string' },
          },
        },
        body: {
          type: 'object',
          required: ['globalUserId', 'role'],
          properties: {
            globalUserId: { type: 'string' },
            role: { type: 'string', enum: ['owner', 'admin', 'editor', 'viewer'] },
          },
        },
      },
    },
    async (req, reply) => {
      // 🔴 R8O BIND: subject = req.user (server-side) → global_user_id; addMember gateia via hasPermission(owner/admin).
      const requesterGlobalUserId = await resolveRequesterGlobalUserId(req, reply);
      if (requesterGlobalUserId === null) return reply;

      try {
        const validated = addMemberSchema.parse(req.body);
        const member = await organizersService.addMember(
          req.tenant!.id,
          req.params.id,
          validated,
          requesterGlobalUserId
        );
        return reply.status(201).send(member);
      } catch (error) {
        if (error instanceof Error) {
          return reply.status(400).send({ error: error.message });
        }
        return reply.status(500).send({ error: 'Erro ao adicionar membro' });
      }
    }
  );

  /**
   * POST /events/organizers/link-event/:eventId
   * Vincula evento a um organizador
   * Rota: POST /events/organizers/link-event/:eventId
   */
  fastify.post<{
    Params: { eventId: string };
    Body: {
      organizerId: string;
    };
  }>(
    '/link-event/:eventId',
    {
      schema: {
        params: {
          type: 'object',
          properties: {
            eventId: { type: 'string' },
          },
        },
        body: {
          type: 'object',
          required: ['organizerId'],
          properties: {
            organizerId: { type: 'string' },
          },
        },
      },
    },
    async (req, reply) => {
      // 🔴 R8O BIND: subject = req.user (server-side) → global_user_id; linkEvent gateia via hasPermission(organizer)
      // + criador do evento. Só atualiza events.organizer_id — NÃO toca events.actor_id (event-settlement intocado).
      const requesterGlobalUserId = await resolveRequesterGlobalUserId(req, reply);
      if (requesterGlobalUserId === null) return reply;

      try {
        const validated = linkEventSchema.parse(req.body);
        await organizersService.linkEvent(
          req.tenant!.id,
          req.params.eventId,
          validated.organizerId,
          requesterGlobalUserId
        );
        return reply.status(200).send({ success: true, message: 'Evento vinculado ao organizador' });
      } catch (error) {
        if (error instanceof Error) {
          return reply.status(400).send({ error: error.message });
        }
        return reply.status(500).send({ error: 'Erro ao vincular evento' });
      }
    }
  );

  /**
   * GET /events/organizers
   * Lista organizadores
   */
  fastify.get<{
    Querystring: {
      limit?: number;
      offset?: number;
    };
  }>(
    '/',
    {
      schema: {
        querystring: {
          type: 'object',
          properties: {
            limit: { type: 'number' },
            offset: { type: 'number' },
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
        const organizers = await organizersService.listOrganizers(req.tenant.id, {
          limit: req.query.limit,
          offset: req.query.offset,
        });
        return { organizers, totalCents: organizers.length };
      } catch (error) {
        fastify.log.error({ err: error }, 'Erro ao listar organizadores');
        return reply.status(500).send({ error: 'Erro ao listar organizadores' });
      }
    }
  );

  /**
   * GET /events/organizers/:id
   * Busca organizador por ID com detalhes
   */
  fastify.get<{
    Params: { id: string };
  }>(
    '/:id',
    {
      schema: {
        params: {
          type: 'object',
          properties: {
            id: { type: 'string' },
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
        const organizer = await organizersService.getOrganizerWithDetails(
          req.tenant.id,
          req.params.id
        );

        if (!organizer) {
          return reply.status(404).send({ error: 'Organizador não encontrado' });
        }

        return organizer;
      } catch (error) {
        fastify.log.error({ err: error }, 'Erro ao buscar organizador');
        return reply.status(500).send({ error: 'Erro ao buscar organizador' });
      }
    }
  );

  /**
   * GET /events/organizers/plans
   * Lista planos disponíveis para organizadores
   */
  fastify.get('/plans', async (req, reply) => {
    if (!req.user) {
      return reply.status(401).send({ error: 'Não autenticado' });
    }

    const plans = organizerPlansService.getAvailablePlans();
    return { plans };
  });

  /**
   * GET /events/organizers/:id/plan
   * Retorna plano atual do organizador
   */
  fastify.get<{
    Params: { id: string };
  }>(
    '/:id/plan',
    // 🔴 R8K: lê event_organizers.plan/plan_expires_at — colunas SCHEMA-GHOST (não existem). Contida (501),
    // consistente com o cluster billing. GET /plans (catálogo estático) segue ativo. Reabrir exige schema + decisão.
    async (_req, reply) => reply.status(501).send(ORGANIZER_BILLING_GHOST_BODY)
  );

  /**
   * POST /events/organizers/:id/subscribe
   * Cria assinatura para organizador
   */
  fastify.post<{
    Params: { id: string };
    Body: {
      plan: 'free' | 'basic' | 'pro' | 'enterprise';
      paymentGateway?: string;
      paymentGatewayCustomerId?: string;
      paymentGatewaySubscriptionId?: string;
    };
  }>(
    '/:id/subscribe',
    // 🔴 R8K: billing schema-ghost → contido (501) antes de qualquer service/sink. Ver ORGANIZER_BILLING_GHOST_BODY.
    async (_req, reply) => reply.status(501).send(ORGANIZER_BILLING_GHOST_BODY)
  );

  /**
   * POST /events/organizers/:id/subscription/cancel
   * Cancela assinatura
   */
  fastify.post<{
    Params: { id: string };
    Body: {
      cancelAtPeriodEnd?: boolean;
    };
  }>(
    '/:id/subscription/cancel',
    // 🔴 R8K: billing schema-ghost + esta rota NÃO tinha autoridade (qualquer user do tenant cancelava qualquer
    // organizer). Contido (501) antes de qualquer service/sink. Reabrir exige schema + decisão + binding.
    async (_req, reply) => reply.status(501).send(ORGANIZER_BILLING_GHOST_BODY)
  );

  /**
   * GET /events/organizers/:id/subscription
   * Busca assinatura ativa
   */
  fastify.get<{
    Params: { id: string };
  }>(
    '/:id/subscription',
    // 🔴 R8K: leitura de assinatura também é schema-ghost (getActiveSubscription consulta colunas inexistentes de
    // organizer_subscriptions). Contida (501) — consistente com o cluster billing. Reabrir exige schema + decisão.
    async (_req, reply) => reply.status(501).send(ORGANIZER_BILLING_GHOST_BODY)
  );

  /**
   * POST /events/organizers/:id/subscribe/stripe
   * Cria assinatura via Stripe
   */
  fastify.post<{
    Params: { id: string };
    Body: {
      plan: 'basic' | 'pro' | 'enterprise';
      paymentMethodId: string;
      email: string;
      name: string;
    };
  }>(
    '/:id/subscribe/stripe',
    // 🔴 R8K: billing schema-ghost → contido (501) antes de Stripe/service/sink. Reabrir exige schema + decisão + binding.
    async (_req, reply) => reply.status(501).send(ORGANIZER_BILLING_GHOST_BODY)
  );

  /**
   * POST /events/organizers/webhooks/stripe
   * 🔴 R8K: o billing é schema-ghost; os handlers do webhook (renew/update subscription) escreviam em colunas
   * inexistentes (dead) e, retornando não-2xx, disparavam retry storm da Stripe (até 3 dias). CONTIDO como no-op
   * OBSERVÁVEL: ACK 200 (Stripe para de reenviar), NÃO verifica assinatura para mutar (nada muta), NÃO chama
   * nenhum handler de billing, ZERO escrita. Reabrir exige schema canônico + decisão de produto + binding.
   */
  fastify.post('/webhooks/stripe', async (req, reply) => {
    fastify.log.info(
      { event: 'organizer_stripe_webhook_contained', code: 'ORGANIZER_BILLING_SCHEMA_GHOST_CONTAINED' },
      'Webhook Stripe de organizer contido (billing schema-ghost): no-op, ACK 200, zero escrita'
    );
    return reply.status(200).send({ received: true, contained: 'ORGANIZER_BILLING_SCHEMA_GHOST_CONTAINED' });
  });
};

export default organizersRoutes;
