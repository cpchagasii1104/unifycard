// backend/src/modules/social/social-marketplace-ref.routes.ts
// SPRINT 47: Rotas para referências do marketplace no social

import type { FastifyInstance } from 'fastify';
import { socialMarketplaceRefService } from './social-marketplace-ref.service';
import type { CreateSocialMarketplaceRefInput } from './social-marketplace-ref.types';

const socialMarketplaceRefRoutes = async (fastify: FastifyInstance) => {
  /**
   * POST /social/marketplace-ref
   * Cria referência do marketplace no social
   * 
   * ⚠️ REGRAS:
   * - Social NÃO cria Order
   * - Social NÃO cria PaymentIntent
   * - Social NÃO toca Bank
   * - Social é apenas entrada/contexto
   */
  fastify.post<{ Body: CreateSocialMarketplaceRefInput }>(
    '/marketplace-ref',
    async (req, reply) => {
      const tenantId = req.tenant!.id;
      const actionContext = (req as any).actionContext;

      // Validar que post existe (leve validação)
      // Não bloqueia se post não existir (pode ser de módulo externo)

      // ActionContext é obrigatório (V2)
      if (!actionContext || !actionContext.actorId) {
        return reply.status(400).send({ error: 'ActionContext obrigatório' });
      }

      const ref = await socialMarketplaceRefService.createRef(tenantId, req.body);

      // Registrar auditoria (leve, não bloqueia)
      try {
        const { auditService } = await import('@core/audit/audit.service');
        await auditService.record(tenantId, {
          event_type: 'SOCIAL_MARKETPLACE_REF_CREATED',
          severity: 'LOW',
          actor_id: actionContext.actorId,
          actor_type: 'user',
          source: 'social',
          context: {
            post_id: req.body.postId,
            ref_type: req.body.refType,
            ref_id: req.body.refId,
          },
        });
      } catch (auditError) {
        // Log mas não bloqueia
        console.warn('[SocialMarketplaceRef] Erro ao registrar auditoria:', auditError);
      }

      return reply.status(201).send(ref);
    }
  );

  /**
   * GET /social/marketplace-ref/:postId
   * Busca referências do marketplace por post
   */
  fastify.get<{ Params: { postId: string } }>(
    '/marketplace-ref/:postId',
    async (req, reply) => {
      const tenantId = req.tenant!.id;
      const { postId } = req.params;

      const refs = await socialMarketplaceRefService.getRefsByPost(tenantId, postId);

      // Buscar detalhes de cada referência
      const refsWithDetails = await Promise.all(
        refs.map(async (ref) => {
          const withDetails = await socialMarketplaceRefService.getRefWithDetails(
            tenantId,
            ref.id
          );
          return withDetails || { ref, details: null };
        })
      );

      return reply.status(200).send({ refs: refsWithDetails });
    }
  );

  /**
   * GET /social/marketplace-ref/details/:refId
   * Busca detalhes de uma referência específica
   */
  fastify.get<{ Params: { refId: string } }>(
    '/marketplace-ref/details/:refId',
    async (req, reply) => {
      const tenantId = req.tenant!.id;
      const { refId } = req.params;

      const refWithDetails = await socialMarketplaceRefService.getRefWithDetails(
        tenantId,
        refId
      );

      if (!refWithDetails) {
        return reply.status(404).send({ error: 'Referência não encontrada' });
      }

      return reply.status(200).send(refWithDetails);
    }
  );
};

export default socialMarketplaceRefRoutes;







