// backend/src/core/publication/publication-engine.routes.ts
// Rotas para o Motor Canônico de Publicação, Visibilidade e Convites

import { FastifyPluginAsync } from 'fastify';
import { publicationEngineService } from './publication-engine.service';
import type {
  UpsertPublicationMetadataInput,
  GenerateLinkInput,
  CreateReactionInput,
} from './publication-engine.types';

const publicationEngineRoutes: FastifyPluginAsync = async (fastify) => {
  // Middleware para obter tenant_id e actor do contexto
  fastify.addHook('onRequest', async (request, reply) => {
    // Assumir que tenant_id e actor vêm do contexto de autenticação
    // (ajustar conforme implementação de auth existente)
  });

  /**
   * GET /publication/:entityType/:entityId
   * Busca metadados de publicação
   */
  fastify.get<{
    Params: { entityType: string; entityId: string };
  }>('/:entityType/:entityId', async (request, reply) => {
    const { entityType, entityId } = request.params;
    
    // Validar entityType
    const validTypes = ['event', 'post', 'group', 'channel'];
    if (!validTypes.includes(entityType)) {
      return reply.code(400).send({ error: `entityType inválido. Deve ser um de: ${validTypes.join(', ')}` });
    }

    const tenantId = (request as any).tenant_id; // Ajustar conforme auth
    const actorId = (request as any).actor_id;
    const actorType = (request as any).actor_type;

    if (!tenantId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const metadata = await publicationEngineService.getPublicationMetadata(
      tenantId,
      entityType as any,
      entityId
    );

    if (!metadata) {
      return reply.code(404).send({ error: 'Publication metadata not found' });
    }

    return { metadata };
  });

  /**
   * PUT /publication/:entityType/:entityId
   * Cria ou atualiza metadados de publicação
   */
  fastify.put<{
    Params: { entityType: string; entityId: string };
    Body: UpsertPublicationMetadataInput;
  }>('/:entityType/:entityId', async (request, reply) => {
    const { entityType, entityId } = request.params;
    const body = request.body;
    
    // Validar entityType
    const validTypes = ['event', 'post', 'group', 'channel'];
    if (!validTypes.includes(entityType)) {
      return reply.code(400).send({ error: `entityType inválido. Deve ser um de: ${validTypes.join(', ')}` });
    }

    // Validar visibility se fornecido
    if (body.visibility) {
      const validVisibilities = ['public', 'private', 'unlisted', 'followers', 'group', 'friends'];
      if (!validVisibilities.includes(body.visibility)) {
        return reply.code(400).send({ error: `visibility inválido. Deve ser um de: ${validVisibilities.join(', ')}` });
      }
    }

    const tenantId = (request as any).tenant_id;
    const actorId = (request as any).actor_id;
    const actorType = (request as any).actor_type;

    if (!tenantId || !actorId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const metadata = await publicationEngineService.upsertPublicationMetadata(
      tenantId,
      actorId,
      actorType,
      {
        ...body,
        entity_type: entityType as any,
        entity_id: entityId,
      }
    );

    return { metadata };
  });

  /**
   * POST /publication/:entityType/:entityId/generate-link
   * Gera link compartilhável
   */
  fastify.post<{
    Params: { entityType: string; entityId: string };
    Body: { referral_code?: string; expiresAt?: string };
  }>('/:entityType/:entityId/generate-link', async (request, reply) => {
    const { entityType, entityId } = request.params;
    const { referral_code, expiresAt } = request.body;
    const tenantId = (request as any).tenant_id;
    const actorId = (request as any).actor_id;
    const actorType = (request as any).actor_type;

    if (!tenantId || !actorId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const link = await publicationEngineService.generateShareableLink(
      tenantId,
      actorId,
      actorType,
      {
        entity_type: entityType as any,
        entity_id: entityId,
        referral_code: referral_code || null,
        expiresAt: expiresAt || null,
      }
    );

    return { link };
  });

  /**
   * POST /publication/:entityType/:entityId/reactions
   * Cria ou atualiza reação
   */
  // 🔒 DECISION-0189C D4: rota GENÉRICA polimórfica de reação SEM autoridade promulgada —
  // DESATIVADA com 410 ANTES de ler actor_id, resolver entidade, chamar upsertReaction ou
  // escrever em `reactions`. Caminho canônico de posts = social-2.0.routes (interact_feed).
  // Não se implementa autoridade genérica improvisada; reabrir = decisão própria por entityType.
  fastify.post<{
    Params: { entityType: string; entityId: string };
    Body: { reaction_type: string; actor_id?: string };
  }>('/:entityType/:entityId/reactions', async (_request, reply) => {
    return reply.code(410).send({ code: 'GENERIC_REACTIONS_NOT_GOVERNED' });
  });

  /**
   * DELETE /publication/:entityType/:entityId/reactions
   * Remove reação
   */
  // 🔒 DECISION-0189C D4: writer-irmão de remoção de reação genérica — mesma contenção 410
  // ANTES de qualquer efeito (removeReaction nunca é chamado; `reactions` intocada).
  fastify.delete<{
    Params: { entityType: string; entityId: string };
  }>('/:entityType/:entityId/reactions', async (_request, reply) => {
    return reply.code(410).send({ code: 'GENERIC_REACTIONS_NOT_GOVERNED' });
  });

  /**
   * GET /publication/:entityType/:entityId/reactions
   * Busca contagens de reações
   */
  fastify.get<{
    Params: { entityType: string; entityId: string };
  }>('/:entityType/:entityId/reactions', async (request, reply) => {
    const { entityType, entityId } = request.params;
    const tenantId = (request as any).tenant_id;

    if (!tenantId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const counts = await publicationEngineService.getReactionCounts(
      tenantId,
      entityType as any,
      entityId
    );

    return { counts };
  });
};

export { publicationEngineRoutes };


