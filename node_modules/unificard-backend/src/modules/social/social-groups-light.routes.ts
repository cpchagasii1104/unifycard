// backend/src/modules/social/social-groups-light.routes.ts
// Rotas para grupos sociais leves

import { FastifyPluginAsync } from 'fastify';
import { socialGroupsLightService } from './social-groups-light.service';

const socialGroupsLightRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /social/groups-light
  fastify.post('/', async (req, reply) => {
    // TODO: Obter userId do contexto de autenticação
    const ownerId = (req as any).user?.id || 'user-123'; // Placeholder
    const body = req.body as {
      name: string;
      member_ids?: string[];
      purpose: 'business' | 'friends' | 'mixed';
    };

    if (!body.name || !body.purpose) {
      return reply.status(400).send({ error: 'name e purpose são obrigatórios' });
    }

    try {
      const group = socialGroupsLightService.createGroup(ownerId, body);
      return reply.status(201).send(group);
    } catch (error: any) {
      return reply.status(400).send({ error: error.message || 'Erro ao criar grupo' });
    }
  });

  // GET /social/groups-light
  fastify.get('/', async (req, reply) => {
    // TODO: Obter userId do contexto de autenticação
    const userId = (req as any).user?.id || 'user-123'; // Placeholder
    const query = req.query as { purpose?: 'business' | 'friends' | 'mixed' };

    const groups = socialGroupsLightService.getGroups(userId, query.purpose);
    return reply.status(200).send({ groups });
  });

  // GET /social/groups-light/:groupId
  fastify.get<{ Params: { groupId: string } }>('/:groupId', async (req, reply) => {
    const { groupId } = req.params;

    const group = socialGroupsLightService.getGroup(groupId);
    if (!group) {
      return reply.status(404).send({ error: 'Grupo não encontrado' });
    }

    return reply.status(200).send(group);
  });

  // POST /social/groups-light/:groupId/members
  fastify.post<{ Params: { groupId: string } }>('/:groupId/members', async (req, reply) => {
    const { groupId } = req.params;
    const body = req.body as { user_id: string };

    if (!body.user_id) {
      return reply.status(400).send({ error: 'user_id é obrigatório' });
    }

    const added = socialGroupsLightService.addMember(groupId, body.user_id);
    if (added) {
      return reply.status(200).send({ message: 'Membro adicionado' });
    } else {
      return reply.status(404).send({ error: 'Grupo não encontrado' });
    }
  });

  // DELETE /social/groups-light/:groupId/members/:userId
  fastify.delete<{ Params: { groupId: string; userId: string } }>('/:groupId/members/:userId', async (req, reply) => {
    const { groupId, userId } = req.params;

    const removed = socialGroupsLightService.removeMember(groupId, userId);
    if (removed) {
      return reply.status(200).send({ message: 'Membro removido' });
    } else {
      return reply.status(404).send({ error: 'Grupo não encontrado' });
    }
  });
};

export default socialGroupsLightRoutes;
export { socialGroupsLightRoutes };

