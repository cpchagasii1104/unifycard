// src/modules/events/organizers/organizers.routes.ts
import { FastifyPluginAsync } from 'fastify';
import { runQueryWithTenant, pool } from '@core/database/pool';
import { organizersService } from './organizers.service';
import { organizerPlansService } from './organizer-plans.service';
import { organizerBillingService } from './organizer-billing.service';
import { stripeService } from './stripe.service';
import { createOrganizerSchema, addMemberSchema, linkEventSchema } from './organizers.schemas';
import Stripe from 'stripe';

// Interface estendida para Stripe.Invoice com subscription (propriedade presente em runtime mas não tipada)
interface ExtendedStripeInvoice extends Stripe.Invoice {
  subscription: string | Stripe.Subscription | null;
}

const organizersRoutes: FastifyPluginAsync = async (fastify) => {
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
      if (!req.user) {
        return reply.status(401).send({ error: 'Não autenticado' });
      }

      // ActionContext é obrigatório (V2)
      if (!req.actionContext || !req.actionContext.actorId) {
        return reply.status(400).send({ error: 'ActionContext obrigatório' });
      }

      if (!req.tenant) {
        return reply.status(400).send({ error: 'Tenant não encontrado' });
      }

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
          req.tenant.id,
          validated,
          req.actionContext.actorId
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
      if (!req.user) {
        return reply.status(401).send({ error: 'Não autenticado' });
      }

      // ActionContext é obrigatório (V2)
      if (!req.actionContext || !req.actionContext.actorId) {
        return reply.status(400).send({ error: 'ActionContext obrigatório' });
      }

      if (!req.tenant) {
        return reply.status(400).send({ error: 'Tenant não encontrado' });
      }

      try {
        const validated = addMemberSchema.parse(req.body);
        const member = await organizersService.addMember(
          req.tenant.id,
          req.params.id,
          validated,
          req.actionContext.actorId
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
      if (!req.user) {
        return reply.status(401).send({ error: 'Não autenticado' });
      }

      // ActionContext é obrigatório (V2)
      if (!req.actionContext || !req.actionContext.actorId) {
        return reply.status(400).send({ error: 'ActionContext obrigatório' });
      }

      if (!req.tenant) {
        return reply.status(400).send({ error: 'Tenant não encontrado' });
      }

      try {
        const validated = linkEventSchema.parse(req.body);
        await organizersService.linkEvent(
          req.tenant.id,
          req.params.eventId,
          validated.organizerId,
          req.actionContext.actorId
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
    async (req, reply) => {
      if (!req.user) {
        return reply.status(401).send({ error: 'Não autenticado' });
      }

      if (!req.tenant) {
        return reply.status(400).send({ error: 'Tenant não encontrado' });
      }

      try {
        const organizer = await organizersService.getOrganizer(req.tenant.id, req.params.id);
        if (!organizer) {
          return reply.status(404).send({ error: 'Organizador não encontrado' });
        }

        // Buscar plano atual
        const organizerRow = await runQueryWithTenant<{
          plan: string;
          plan_expires_at: Date | null;
        }>(
          req.tenant.id,
          `
          SELECT plan, plan_expires_at
          FROM event_organizers
          WHERE id = $1
          `,
          [req.params.id]
        );

        const plan = (organizerRow?.plan || 'free') as 'free' | 'basic' | 'pro' | 'enterprise';
        const planInfo = organizerPlansService.getPlanInfo(plan);

        return {
          plan,
          planInfo,
          expiresAt: organizerRow?.plan_expires_at || null,
          isExpired: organizerRow?.plan_expires_at ? organizerRow.plan_expires_at < new Date() : false,
        };
      } catch (error) {
        fastify.log.error({ err: error }, 'Erro ao buscar plano do organizador');
        return reply.status(500).send({ error: 'Erro ao buscar plano' });
      }
    }
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
    async (req, reply) => {
      if (!req.user) {
        return reply.status(401).send({ error: 'Não autenticado' });
      }

      if (!req.tenant) {
        return reply.status(400).send({ error: 'Tenant não encontrado' });
      }

      try {
        // Verificar se usuário tem permissão no organizador
        const organizer = await organizersService.getOrganizer(req.tenant.id, req.params.id);
        if (!organizer) {
          return reply.status(404).send({ error: 'Organizador não encontrado' });
        }

        // Verificar se é owner ou admin
        // ActionContext é obrigatório (V2)
        if (!req.actionContext || !req.actionContext.actorId) {
          return reply.status(400).send({ error: 'ActionContext obrigatório' });
        }

        const hasPermission = await organizersService.hasPermission(
          req.tenant.id,
          req.params.id,
          req.actionContext.actorId,
          ['owner', 'admin']
        );

        if (!hasPermission) {
          return reply.status(403).send({ error: 'Sem permissão para gerenciar assinatura' });
        }

        const subscription = await organizerBillingService.createSubscription(req.tenant.id, {
          organizerId: req.params.id,
          plan: req.body.plan,
          paymentGateway: req.body.paymentGateway,
          paymentGatewayCustomerId: req.body.paymentGatewayCustomerId,
          paymentGatewaySubscriptionId: req.body.paymentGatewaySubscriptionId,
        });

        return reply.status(201).send(subscription);
      } catch (error) {
        fastify.log.error({ err: error }, 'Erro ao criar assinatura');
        return reply.status(500).send({ error: 'Erro ao criar assinatura' });
      }
    }
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
    async (req, reply) => {
      if (!req.user) {
        return reply.status(401).send({ error: 'Não autenticado' });
      }

      if (!req.tenant) {
        return reply.status(400).send({ error: 'Tenant não encontrado' });
      }

      try {
        await organizerBillingService.cancelSubscription(
          req.tenant.id,
          req.params.id,
          req.body.cancelAtPeriodEnd !== false
        );

        return reply.status(200).send({ success: true });
      } catch (error) {
        fastify.log.error({ err: error }, 'Erro ao cancelar assinatura');
        return reply.status(500).send({ error: 'Erro ao cancelar assinatura' });
      }
    }
  );

  /**
   * GET /events/organizers/:id/subscription
   * Busca assinatura ativa
   */
  fastify.get<{
    Params: { id: string };
  }>(
    '/:id/subscription',
    async (req, reply) => {
      if (!req.user) {
        return reply.status(401).send({ error: 'Não autenticado' });
      }

      if (!req.tenant) {
        return reply.status(400).send({ error: 'Tenant não encontrado' });
      }

      try {
        const subscription = await organizerBillingService.getActiveSubscription(
          req.tenant.id,
          req.params.id
        );

        if (!subscription) {
          return reply.status(404).send({ error: 'Assinatura ativa não encontrada' });
        }

        return subscription;
      } catch (error) {
        fastify.log.error({ err: error }, 'Erro ao buscar assinatura');
        return reply.status(500).send({ error: 'Erro ao buscar assinatura' });
      }
    }
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
    async (req, reply) => {
      if (!req.user) {
        return reply.status(401).send({ error: 'Não autenticado' });
      }

      if (!req.tenant) {
        return reply.status(400).send({ error: 'Tenant não encontrado' });
      }

      try {
        const organizer = await organizersService.getOrganizer(req.tenant.id, req.params.id);
        if (!organizer) {
          return reply.status(404).send({ error: 'Organizador não encontrado' });
        }

        // ActionContext é obrigatório (V2)
        if (!req.actionContext || !req.actionContext.actorId) {
          return reply.status(400).send({ error: 'ActionContext obrigatório' });
        }

        const hasPermission = await organizersService.hasPermission(
          req.tenant.id,
          req.params.id,
          req.actionContext.actorId,
          ['owner', 'admin']
        );

        if (!hasPermission) {
          return reply.status(403).send({ error: 'Sem permissão para gerenciar assinatura' });
        }

        // ActionContext é obrigatório (V2)
        if (!req.actionContext || !req.actionContext.actorId) {
          return reply.status(400).send({ error: 'ActionContext obrigatório' });
        }

        const customer = await stripeService.createCustomer({
          email: req.body.email,
          name: req.body.name,

          metadata: {
            organizerId: req.params.id,
            tenantId: req.tenant.id,
            globalUserId: req.actionContext.actorId, // TODO: Resolver globalUserId a partir do actorId se necessário
          },
        });

        const priceId = stripeService.getStripePriceId(req.body.plan);
        if (!priceId) {
          return reply.status(400).send({ error: 'Plano inválido ou não configurado' });
        }

        const stripeSubscription = await stripeService.createSubscription({
          customerId: customer.id,
          priceId,
          metadata: {
            organizerId: req.params.id,
            tenantId: req.tenant.id,
          },
        });

        const subscription = await organizerBillingService.createSubscription(req.tenant.id, {
          organizerId: req.params.id,
          plan: req.body.plan,
          paymentGateway: 'stripe',
          paymentGatewayCustomerId: customer.id,
          paymentGatewaySubscriptionId: stripeSubscription.id,
        });

        return reply.status(201).send({
          subscription,
          clientSecret: (stripeSubscription.latest_invoice as any)?.payment_intent?.client_secret,
        });
      } catch (error) {
        fastify.log.error({ err: error }, 'Erro ao criar assinatura Stripe');
        return reply.status(500).send({ error: 'Erro ao criar assinatura' });
      }
    }
  );

  /**
   * POST /events/organizers/webhooks/stripe
   * Webhook do Stripe para eventos de pagamento
   */
  fastify.post('/webhooks/stripe', async (req, reply) => {
    const signature = req.headers['stripe-signature'] as string;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
      fastify.log.warn('STRIPE_WEBHOOK_SECRET não configurado');
      return reply.status(400).send({ error: 'Webhook não configurado' });
    }

    try {
      const event = stripeService.verifyWebhookSignature(
        JSON.stringify(req.body),
        signature,
        webhookSecret
      );

      fastify.log.info({ eventType: event.type }, 'Webhook Stripe recebido');

      switch (event.type) {
        case 'invoice.payment_succeeded':
          await handleInvoicePaymentSucceeded(fastify, event);
          break;
        case 'invoice.payment_failed':
          await handleInvoicePaymentFailed(fastify, event);
          break;
        case 'customer.subscription.deleted':
          await handleSubscriptionDeleted(fastify, event);
          break;
        case 'customer.subscription.updated':
          await handleSubscriptionUpdated(fastify, event);
          break;
        default:
          fastify.log.debug({ eventType: event.type }, 'Evento Stripe ignorado');
      }

      return reply.status(200).send({ received: true });
    } catch (error) {
      fastify.log.error({ err: error }, 'Erro ao processar webhook Stripe');
      return reply.status(400).send({ error: 'Webhook inválido' });
    }
  });
};

async function handleInvoicePaymentSucceeded(fastify: any, event: Stripe.Event) {
  const invoice = event.data.object as ExtendedStripeInvoice;
  const subscriptionId = typeof invoice.subscription === 'string' 
    ? invoice.subscription 
    : (invoice.subscription && typeof invoice.subscription === 'object' && 'id' in invoice.subscription)
      ? (invoice.subscription as Stripe.Subscription).id
      : null;

  if (!subscriptionId) return;

  const result = await pool.query<{
    id: string;
    tenant_id: string;
    organizer_id: string;
  }>(
    `
    SELECT id, tenant_id, organizer_id
    FROM organizer_subscriptions
    WHERE payment_gateway_subscription_id = $1
    LIMIT 1
    `,
    [subscriptionId]
  );

  const subscription = result.rows[0];

  if (!subscription) {
    fastify.log.warn({ subscriptionId }, 'Assinatura não encontrada para invoice pago');
    return;
  }

  await organizerBillingService.renewSubscription(subscription.tenant_id, subscription.id);
  fastify.log.info({ subscriptionId: subscription.id }, 'Assinatura renovada via webhook');
}

async function handleInvoicePaymentFailed(fastify: any, event: Stripe.Event) {
  const invoice = event.data.object as ExtendedStripeInvoice;
  const subscriptionId = typeof invoice.subscription === 'string' 
    ? invoice.subscription 
    : (invoice.subscription && typeof invoice.subscription === 'object' && 'id' in invoice.subscription)
      ? (invoice.subscription as Stripe.Subscription).id
      : null;

  if (!subscriptionId) return;

  const result = await pool.query<{
    id: string;
    tenant_id: string;
  }>(
    `
    SELECT id, tenant_id
    FROM organizer_subscriptions
    WHERE payment_gateway_subscription_id = $1
    LIMIT 1
    `,
    [subscriptionId]
  );

  const subscription = result.rows[0];

  if (!subscription) return;

  await organizerBillingService.updateSubscriptionStatus(
    subscription.tenant_id,
    subscription.id,
    'past_due'
  );
  fastify.log.warn({ subscriptionId: subscription.id }, 'Assinatura marcada como past_due');
}

async function handleSubscriptionDeleted(fastify: any, event: Stripe.Event) {
  const stripeSubscription = event.data.object as Stripe.Subscription;

  const result = await pool.query<{
    id: string;
    tenant_id: string;
  }>(
    `
    SELECT id, tenant_id
    FROM organizer_subscriptions
    WHERE payment_gateway_subscription_id = $1
    LIMIT 1
    `,
    [stripeSubscription.id]
  );

  const subscription = result.rows[0];

  if (!subscription) return;

  await organizerBillingService.updateSubscriptionStatus(
    subscription.tenant_id,
    subscription.id,
    'canceled'
  );
  fastify.log.info({ subscriptionId: subscription.id }, 'Assinatura cancelada via webhook');
}

async function handleSubscriptionUpdated(fastify: any, event: Stripe.Event) {
  const stripeSubscription = event.data.object as Stripe.Subscription;

  const result = await pool.query<{
    id: string;
    tenant_id: string;
  }>(
    `
    SELECT id, tenant_id
    FROM organizer_subscriptions
    WHERE payment_gateway_subscription_id = $1
    LIMIT 1
    `,
    [stripeSubscription.id]
  );

  const subscription = result.rows[0];

  if (!subscription) return;

  const currentPeriodEnd = (stripeSubscription as any).current_period_end;
  if (currentPeriodEnd && typeof currentPeriodEnd === 'number') {
    await runQueryWithTenant(
      subscription.tenant_id,
      `
      UPDATE organizer_subscriptions
      SET current_period_end = $1, updated_at = now()
      WHERE id = $2
      `,
      [new Date(currentPeriodEnd * 1000), subscription.id]
    );
  }
}

export default organizersRoutes;



