// src/modules/social/social-work.routes.ts
//
// Rotas de integração entre Social e Work
// Permite criar jobs a partir de posts da rede social

import { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { socialWorkService } from './social-work.service';
import { socialService } from './social.service';
import { rbacService } from '@core/rbac/rbac.service';

const socialWorkRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * Helper para validar se usuário é dono do post ou admin/owner
   */
  async function validatePostAccess(
    req: FastifyRequest,
    postId: string
  ): Promise<void> {
    const tenantId = req.tenant!.id;
    const currentGlobalUserId = req.user!.globalUserId;
    const currentUserId = req.user!.id;

    if (!currentGlobalUserId) {
      throw fastify.httpErrors.unauthorized('Global user ID required');
    }

    // Buscar post
    const post = await socialService.getPost(tenantId, postId);
    if (!post) {
      throw fastify.httpErrors.notFound('Post not found');
    }

    // Se for o dono do post, permitir
    if (post.globalUserId === currentGlobalUserId) {
      return;
    }

    // Verificar se é OWNER ou ADMIN usando RBAC
    const hasAdminRole = await rbacService.userHasAnyRole(tenantId, currentUserId, ['admin', 'owner']);
    
    if (!hasAdminRole) {
      throw fastify.httpErrors.forbidden('You can only create jobs from your own posts. Admin or Owner role required to create jobs from other users\' posts.');
    }
  }

  /**
   * POST /social/posts/:postId/create-job
   * Cria um job com base no post
   * Somente o dono do post pode fazer isso (ou admin/owner)
   */
  fastify.post<{ Params: { postId: string } }>(
    '/posts/:postId/create-job',
    {
      preHandler: fastify.requirePermission(['work:job:create', 'social:post:read']),
    },
    async (req, reply) => {
      const tenantId = req.tenant!.id;
      const globalUserId = req.user!.globalUserId;
      const { postId } = req.params;
      const requestId = (req as any).requestId || req.id;

      if (!globalUserId) {
        return reply.status(401).send({ error: 'Global user ID required' });
      }

      // Validar acesso ao post
      await validatePostAccess(req, postId);

      req.log.info({
        requestId,
        tenantId,
        globalUserId,
        'social-work.action': 'create-job-from-post',
        postId,
        source: 'social_post',
      }, 'Creating job from social post');

      try {
        const job = await socialWorkService.createJobFromPost(postId, globalUserId, tenantId);

        req.log.info({
          requestId,
          tenantId,
          globalUserId,
          'social-work.action': 'job-created-from-post',
          postId,
          jobId: job.jobId,
          source: 'social_post',
        }, 'Job created from social post successfully');

        return reply.status(201).send({
          job,
          postId,
          message: 'Job created from post successfully',
        });
      } catch (error) {
        req.log.error({
          requestId,
          tenantId,
          globalUserId,
          'social-work.action': 'create-job-from-post-error',
          postId,
          error: error instanceof Error ? error.message : String(error),
        }, 'Error creating job from post');

        if (error instanceof Error) {
          if (error.message.includes('not found')) {
            return reply.status(404).send({ error: error.message });
          }
          if (error.message.includes('already exists')) {
            return reply.status(409).send({ error: error.message });
          }
          if (error.message.includes('only create jobs')) {
            return reply.status(403).send({ error: error.message });
          }
        }
        return reply.status(500).send({ error: 'Failed to create job from post' });
      }
    }
  );

  /**
   * GET /social/posts/:postId/work-offer
   * Retorna o job vinculado ao post, caso exista
   */
  fastify.get<{ Params: { postId: string } }>(
    '/posts/:postId/work-offer',
    {
      preHandler: fastify.requirePermission(['work:job:read', 'social:post:read']),
    },
    async (req, reply) => {
      const tenantId = req.tenant!.id;
      const { postId } = req.params;

      const job = await socialWorkService.getWorkOfferForPost(postId, tenantId);

      if (!job) {
        return reply.status(404).send({
          error: 'No job found for this post',
          postId,
        });
      }

      return {
        postId,
        job,
      };
    }
  );
};

export default socialWorkRoutes;

