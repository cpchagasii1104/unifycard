// src/core/profile/profile-professional.routes.ts
// Rotas para perfil profissional

import { FastifyPluginAsync } from 'fastify';
import { profileProfessionalService } from './profile-professional.service';

const profileProfessionalRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /profile/professional
   * Busca perfil profissional do usuário autenticado
   */
  fastify.get('/professional', async (req, reply) => {
    if (!req.user) {
      return reply.status(401).send({ error: 'Não autenticado' });
    }

    if (!req.tenant) {
      return reply.status(400).send({ error: 'Tenant não encontrado' });
    }

    try {
      const profile = await profileProfessionalService.getProfessionalProfile(
        req.tenant.id,
        req.user.id
      );
      return profile || { globalUserId: '', skills: [], education: [], bio: null, availability: null };
    } catch (error) {
      fastify.log.error({ err: error }, 'Erro ao buscar perfil profissional');
      return reply.status(500).send({ error: 'Erro ao buscar perfil profissional' });
    }
  });

  /**
   * PUT /profile/professional
   * Atualiza perfil profissional do usuário autenticado
   */
  fastify.put<{
    Body: {
      skills?: Array<{
        categoryId: string;
        skillLevel?: number;
        yearsExperience?: number;
        hourlyRate?: number | null;
      }>;
      education?: Array<{
        educationId?: string;
        level: 'elementary' | 'high_school' | 'technical' | 'bachelor' | 'master' | 'phd' | 'other';
        institution: string;
        course?: string;
        field?: string;
        startDate?: string;
        endDate?: string | null;
        isCompleted: boolean;
        description?: string;
      }>;
      bio?: string | null;
      availability?: Record<string, string[]> | null;
    };
  }>('/professional', async (req, reply) => {
    if (!req.user) {
      return reply.status(401).send({ error: 'Não autenticado' });
    }

    if (!req.tenant) {
      return reply.status(400).send({ error: 'Tenant não encontrado' });
    }

    try {
      const updated = await profileProfessionalService.updateProfessionalProfile(
        req.tenant.id,
        req.user.id,
        req.body
      );
      return updated;
    } catch (error) {
      fastify.log.error({ err: error }, 'Erro ao atualizar perfil profissional');
      if (error instanceof Error) {
        return reply.status(400).send({ error: error.message });
      }
        return reply.status(500).send({ 
          ok: false, 
          message: 'Erro ao atualizar perfil profissional',
          error: error instanceof Error ? error.message : String(error)
        });
    }
  });
};

export default profileProfessionalRoutes;

