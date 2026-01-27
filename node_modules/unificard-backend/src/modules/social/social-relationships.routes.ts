// backend/src/modules/social/social-relationships.routes.ts
// Rotas para relacionamentos sociais unilaterais

import { FastifyPluginAsync } from 'fastify';
import { socialRelationshipsService } from './social-relationships.service';

const socialRelationshipsRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /social/relationships
  fastify.post('/relationships', async (req, reply) => {
    // TODO: Obter userId do contexto de autenticação
    const userId = (req as any).user?.id || 'user-123'; // Placeholder
    const body = req.body as {
      target_user_id: string;
      category: 'business' | 'friend' | 'family' | 'entertainment';
    };

    if (!body.target_user_id || !body.category) {
      return reply.status(400).send({ error: 'target_user_id e category são obrigatórios' });
    }

    try {
      const relationship = socialRelationshipsService.createRelationship(userId, body);
      return reply.status(201).send(relationship);
    } catch (error: any) {
      return reply.status(400).send({ error: error.message || 'Erro ao criar relacionamento' });
    }
  });

  // GET /social/relationships
  fastify.get('/relationships', async (req, reply) => {
    // TODO: Obter userId do contexto de autenticação
    const userId = (req as any).user?.id || 'user-123'; // Placeholder
    const query = req.query as { category?: 'business' | 'friend' | 'family' | 'entertainment' };

    const relationships = socialRelationshipsService.getRelationships(userId, query.category);
    return reply.status(200).send({ relationships });
  });

  // DELETE /social/relationships/:targetUserId
  fastify.delete<{ Params: { targetUserId: string } }>('/relationships/:targetUserId', async (req, reply) => {
    // TODO: Obter userId do contexto de autenticação
    const userId = (req as any).user?.id || 'user-123'; // Placeholder
    const { targetUserId } = req.params;

    const deleted = socialRelationshipsService.deleteRelationship(userId, targetUserId);
    if (deleted) {
      return reply.status(200).send({ message: 'Relacionamento removido' });
    } else {
      return reply.status(404).send({ error: 'Relacionamento não encontrado' });
    }
  });
};

export default socialRelationshipsRoutes;
export { socialRelationshipsRoutes };




