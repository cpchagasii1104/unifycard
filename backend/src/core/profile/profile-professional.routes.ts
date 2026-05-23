// src/core/profile/profile-professional.routes.ts
// Rotas para perfil profissional

import { FastifyPluginAsync } from 'fastify';
import { HttpError } from '../errors/http-error';
import { profileProfessionalService } from './profile-professional.service';
import type { UpdateProfessionalProfileInput } from './profile-professional.types';

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
        req.user.id,
      );

      return reply.status(200).send(
        profile || {
          globalUserId: '',
          skills: [],
          bio: null,
          availability: null,
        },
      );
    } catch (error) {
      if (error instanceof HttpError) {
        return reply.status(error.statusCode).send({ ok: false, message: error.message });
      }
      fastify.log.error({ err: error }, 'Erro ao buscar perfil profissional');
      return reply.status(500).send({
        ok: false,
        message: 'Erro ao buscar perfil profissional',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * PUT /profile/professional
   * Atualiza perfil profissional do usuário autenticado
   */
  fastify.put<{
    Body: UpdateProfessionalProfileInput;
  }>('/professional', async (req, reply) => {
    if (!req.user) {
      return reply.status(401).send({ error: 'Não autenticado' });
    }

    if (!req.tenant) {
      return reply.status(400).send({ error: 'Tenant não encontrado' });
    }

    try {
      // 🔴 DIAGNÓSTICO DETALHADO: Log completo do body recebido
      // Verificar também o raw body se disponível
      const rawBodyString = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
      const parsedBody = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      
      // 🔴 VALIDAÇÃO DEFENSIVA: Validar availability antes de processar
      // Garantir que se availability for fornecido, seja um objeto válido (não array primitivo, não string, etc.)
      if (parsedBody?.availability !== null && parsedBody?.availability !== undefined) {
        if (typeof parsedBody.availability !== 'object' || Array.isArray(parsedBody.availability)) {
          fastify.log.warn({
            availabilityType: typeof parsedBody.availability,
            isArray: Array.isArray(parsedBody.availability),
            availabilityValue: parsedBody.availability,
          }, 'Invalid availability format received');
          return reply.status(400).send({
            error: 'Invalid availability format',
            message: 'availability must be an object (e.g., { "monday": ["09:00-18:00"] })',
          });
        }
      }
      
      fastify.log.info({
        method: req.method,
        url: req.url,
        bodyType: typeof req.body,
        isString: typeof req.body === 'string',
        bodyKeys: parsedBody ? Object.keys(parsedBody) : [],
        hasSkills: !!parsedBody?.skills,
        skillsCount: parsedBody?.skills?.length || 0,
        hasAvailability: !!parsedBody?.availability,
        availabilityType: typeof parsedBody?.availability,
        rawBodyString: rawBodyString.substring(0, 1000), // Limitar tamanho do log
        rawBodyLength: rawBodyString.length,
        servicesInfo: parsedBody?.skills?.flatMap((s: any) => 
          (s.predefinedServices || []).map((ps: any) => ({
            name: ps.name,
            nameType: typeof ps.name,
            nameLength: ps.name?.length,
            hasSpaces: ps.name?.includes(' '),
            nameCharCodes: ps.name ? Array.from(ps.name).map((c: unknown) => (c as string).charCodeAt(0)) : [],
            nameBytes: ps.name ? Buffer.from(ps.name, 'utf8').toString('hex') : null
          }))
        ) || []
      }, '🔍 DIAGNÓSTICO COMPLETO: Body recebido na rota PUT /profile/professional');
      
      // Usar o body parseado se necessário
      const bodyToProcess = parsedBody || req.body;
      
      const updated = await profileProfessionalService.updateProfessionalProfile(
        req.tenant.id,
        req.user.id,
        bodyToProcess
      );
      
      // 🔴 DIAGNÓSTICO: Log do que foi retornado
      fastify.log.info({
        servicesReturned: updated.skills?.flatMap(s => 
          (s.predefinedServices || []).map(ps => ({
            name: ps.name,
            hasSpaces: ps.name?.includes(' ')
          }))
        ) || []
      }, '🔍 DIAGNÓSTICO: Serviços retornados após atualização');
      
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

