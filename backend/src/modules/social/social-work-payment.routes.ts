// src/modules/social/social-work-payment.routes.ts
//
// Rotas para pagar serviços publicados em posts sociais
// Integra Social + Work + Schedule + Economy

import { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { socialWorkPaymentService } from './social-work-payment.service';
import { transactionService } from '@core/economy/transaction.service';
import { pool } from '@core/database/pool';
import { authorizationService } from '@core/authorization/authorization.service';
import { z } from 'zod';

const paymentFromPostSchema = z.object({
  amountCents: z.number().positive('Amount must be greater than zero'),
});

const socialWorkPaymentRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * POST /social/work/posts/:postId/pay
   * Cria um pagamento a partir de um post
   * Qualquer usuário autenticado pode pagar (se tiver schedule reservado)
   */
  fastify.post<{
    Params: { postId: string };
    Body: {
      amountCents: number;
    };
  }>(
    '/posts/:postId/pay',
    {
      preHandler: fastify.requirePermission(['economy:transaction:create', 'social:post:read']),
      schema: {
        params: {
          type: 'object',
          properties: {
            postId: { type: 'string', format: 'uuid' },
          },
        },
        body: {
          type: 'object',
          required: ['amountCents'],
          properties: {
            amountCents: { type: 'number', minimum: 1 },
          },
        },
      },
    },
    async (req, reply) => {
      const tenantId = req.tenant!.id;
      const userId = req.user!.id;
      const globalUserId = req.user!.globalUserId;
      const { postId } = req.params;
      const requestId = (req as any).requestId || req.id;

      if (!globalUserId) {
        return reply.status(401).send({ error: 'Global user ID required' });
      }

      // Validar body
      const validated = paymentFromPostSchema.parse(req.body);

      req.log.info({
        requestId,
        tenantId,
        userId,
        globalUserId,
        'social-work.action': 'payment-from-post',
        postId,
        amountCents: validated.amountCents,
        source: 'social_post',
      }, 'Creating payment from social post');

      try {
        // Resolver job e schedule para obter IDs
        const scheduledJob = await socialWorkPaymentService.resolveScheduledJobFromPost(
          postId,
          tenantId,
          userId
        );

        if (!scheduledJob) {
          return reply.status(400).send({
            error: 'No scheduled service found for this post. Schedule a service first.',
            postId,
          });
        }

        // Resolver job completo para obter providerUserId
        const { socialWorkService } = await import('./social-work.service');
        const jobFull = await socialWorkService.resolveJobFromPost(postId, tenantId);
        
        if (!jobFull) {
          return reply.status(400).send({
            error: 'Job not found',
            postId,
          });
        }

        // Criar pagamento
        const transaction = await socialWorkPaymentService.createPaymentFromPost(
          postId,
          tenantId,
          userId,
          validated.amountCents
        );

        req.log.info({
          requestId,
          tenantId,
          userId,
          globalUserId,
          'social-work.action': 'payment-created-from-post',
          postId,
          jobId: scheduledJob.jobId,
          scheduleId: scheduledJob.scheduleId,
          slotId: scheduledJob.slotId,
          amountCents: validated.amountCents,
          transactionId: transaction.transactionId,
          providerUserId: jobFull.clientUserId,
          source: 'social_post',
        }, 'Payment created from social post successfully');

        return reply.status(201).send({
          transactionId: transaction.transactionId,
          transaction,
          postId,
          jobId: scheduledJob.jobId,
          scheduleId: scheduledJob.scheduleId,
          slotId: scheduledJob.slotId,
          message: 'Payment processed successfully from social post',
        });
      } catch (error) {
        req.log.error({
          requestId,
          tenantId,
          userId,
          globalUserId,
          'social-work.action': 'payment-from-post-error',
          postId,
          error: error instanceof Error ? error.message : String(error),
        }, 'Error creating payment from post');

        if (error instanceof Error) {
          if (error.message.includes('not found')) {
            return reply.status(404).send({ error: error.message });
          }
          if (error.message.includes('No scheduled service')) {
            return reply.status(400).send({ error: error.message });
          }
          if (error.message.includes('insufficient')) {
            return reply.status(402).send({ error: 'Insufficient balance' });
          }
        }
        return reply.status(500).send({ error: 'Failed to process payment from post' });
      }
    }
  );

  /**
   * GET /social/work/posts/:postId/payments
   * Lista transações associadas ao job do post
   * Apenas OWNER ou ADMIN do tenant pode acessar
   */
  fastify.get<{ Params: { postId: string } }>(
    '/posts/:postId/payments',
    async (req, reply) => {
      const tenantId = req.tenant!.id;
      const userId = req.user!.id;
      const { postId } = req.params;
      const requestId = (req as any).requestId || req.id;

      // 🔒 BATCH 4 (F-RBAC-V2-PERMISSION-OWNERSHIP / Art.17): autoridade CANÔNICA por REPRESENTABILIDADE do
      // actor AUTOR do post, SEM role-fallback. Era DIVERGENT-MONEY (role-solo via requirePermission RBAC-V2 +
      // userHasAnyRole) — `user_roles`/role NÃO autoriza esta superfície money. `posts` é actor-based
      // (posts.actor_id = autor); só quem REPRESENTA esse actor (canRepresentActor — ownership/company/group/
      // delegação, server-side) vê os pagamentos do job; senão 403 fail-closed. (Admin cross-job audit =
      // autoridade material futura, não role.) NÃO uso socialService.getPost — seu SQL está defasado
      // (post_id/global_user_id inexistentes no schema atual); leio posts.actor_id direto (read-only).
      const postRow = await pool.query<{ actor_id: string }>(
        'SELECT actor_id FROM posts WHERE id = $1 AND tenant_id = $2 LIMIT 1',
        [postId, tenantId]
      );
      if (!postRow.rows[0]) {
        return reply.status(404).send({ error: 'Post not found' });
      }
      const postActorId = postRow.rows[0].actor_id;
      const canRepresent = await authorizationService.canRepresentActor(tenantId, userId, postActorId);
      if (!canRepresent) {
        return reply.status(403).send({
          error: 'Only the post owner (or its representative) can view payments for jobs created from this post',
        });
      }

      req.log.info({
        requestId,
        tenantId,
        userId,
        'social-work.action': 'list-post-payments',
        postId,
        source: 'social_post',
      }, 'Listing payments for job from social post');

      try {
        // Resolver job para obter jobId
        const { socialWorkService } = await import('./social-work.service');
        const job = await socialWorkService.resolveJobFromPost(postId, tenantId);
        
        if (!job) {
          return reply.status(400).send({
            error: 'Post does not have an associated job.',
            postId,
          });
        }

        // Buscar transações com metadata.postId ou metadata.jobId
        // Nota: transactionService não tem método de busca por metadata diretamente
        // Vou precisar criar uma query customizada ou usar o repository
        // Por enquanto, vamos retornar uma lista vazia com estrutura preparada
        // TODO: Implementar busca de transações por metadata quando disponível

        req.log.info({
          requestId,
          tenantId,
          userId,
          'social-work.action': 'payments-listed-from-post',
          postId,
          jobId: job.jobId,
          source: 'social_post',
        }, 'Payments listed successfully');

        return {
          postId,
          jobId: job.jobId,
          payments: [], // TODO: Implementar busca real
          totalCents: 0,
        };
      } catch (error) {
        req.log.error({
          requestId,
          tenantId,
          userId,
          'social-work.action': 'list-post-payments-error',
          postId,
          error: error instanceof Error ? error.message : String(error),
        }, 'Error listing payments from post');

        if (error instanceof Error) {
          return reply.status(400).send({ error: error.message });
        }
        return reply.status(500).send({ error: 'Failed to list payments' });
      }
    }
  );
};

export default socialWorkPaymentRoutes;


