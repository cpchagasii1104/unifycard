// src/core/profile/profile-physical.routes.ts
// Rotas para perfil físico/interesses

import { FastifyPluginAsync } from 'fastify';
import { HttpError } from '../errors/http-error';
import { profilePhysicalService } from './profile-physical.service';

const profilePhysicalRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /profile/physical
   * Busca perfil físico/interesses do usuário autenticado
   */
  fastify.get('/physical', async (req, reply) => {
    if (!req.user) {
      return reply.status(401).send({ ok: false, message: 'Não autenticado' });
    }

    if (!req.tenant) {
      return reply.status(400).send({ ok: false, message: 'Tenant não encontrado' });
    }

    try {
      const profile = await profilePhysicalService.getPhysicalProfile(
        req.tenant.id,
        req.user.id
      );
      const data = profile || {
        globalUserId: '',
        interests: [],
        lifestyle: {
          drinks: null,
          smokes: null,
          relationshipStatus: null,
          sexualOrientation: null,
        },
        preferences: {},
        metadata: {},
      };
      return reply.send({ ok: true, data });
    } catch (error) {
      if (error instanceof HttpError) {
        return reply.status(error.statusCode).send({ ok: false, message: error.message });
      }
      fastify.log.error({ err: error }, 'Erro ao buscar perfil físico');
      return reply.status(500).send({
        ok: false,
        message: 'Erro ao buscar perfil físico',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * PUT /profile/physical
   * Atualiza perfil físico/interesses do usuário autenticado
   */
  fastify.put<{
    Body: {
      interests?: string[];
      lifestyle?: {
        drinks?: 'never' | 'socially' | 'regularly' | 'prefer_not_to_say' | null;
        smokes?: 'never' | 'occasionally' | 'regularly' | 'prefer_not_to_say' | null;
        relationshipStatus?: 'single' | 'dating' | 'in_relationship' | 'married' | 'prefer_not_to_say' | null;
        sexualOrientation?: 'heterosexual' | 'homosexual' | 'bisexual' | 'pansexual' | 'asexual' | 'prefer_not_to_say' | null;
      };
      preferences?: {
        [categoryId: string]: {
          details?: string[];
          notes?: string;
        };
      };
      metadata?: Record<string, any>;
    };
  }>('/physical',     async (req, reply) => {
      if (!req.user) {
        return reply.status(401).send({ ok: false, message: 'Não autenticado' });
      }

      if (!req.tenant) {
        return reply.status(400).send({ ok: false, message: 'Tenant não encontrado' });
      }

      try {
      const updated = await profilePhysicalService.updatePhysicalProfile(
        req.tenant.id,
        req.user.id,
        req.body
      );
      return updated;
    } catch (error) {
      if (error instanceof HttpError) {
        return reply.status(error.statusCode).send({ ok: false, message: error.message });
      }
      fastify.log.error({ err: error }, 'Erro ao atualizar perfil físico');
      if (error instanceof Error) {
        return reply.status(400).send({ error: error.message });
      }
      return reply.status(500).send({
        ok: false,
        message: 'Erro ao atualizar perfil físico',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });
};

export default profilePhysicalRoutes;











