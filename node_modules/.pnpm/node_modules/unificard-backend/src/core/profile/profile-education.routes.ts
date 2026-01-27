// src/core/profile/profile-education.routes.ts
// Rotas para perfil educacional - MODELO 100% EVENT-BASED
// DOMÍNIO SEPARADO DO PROFISSIONAL

import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { profileEducationService } from './profile-education.service';
import type { CreateEducationEventInput } from './profile-education.types';

// Schema de validação para criar evento
const educationEventPayloadSchema = z.object({
  educationId: z.string().optional(),
  type: z.enum(['formal', 'informal', 'autodidata']),
  institution: z.string().optional(),
  course: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().nullable().optional(),
  description: z.string().optional(),
  reason: z.string().optional(),
  validator: z.string().optional(),
  evidence: z.string().optional(),
});

const createEducationEventSchema = z.object({
  eventType: z.enum([
    'educacao.declarada',
    'educacao.iniciada',
    'educacao.concluida',
    'educacao.abandonada',
    'educacao.contestada',
    'educacao.confirmada',
    'educacao.validada_institucionalmente',
  ]),
  payload: educationEventPayloadSchema,
});

const profileEducationRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * POST /education/events
   * Cria um evento educacional (APPEND-ONLY)
   * 
   * Autenticação: OBRIGATÓRIA (JWT)
   * 
   * Eventos são imutáveis e não podem ser alterados ou deletados.
   * Cada evento representa um fato ocorrido na formação educacional.
   * 
   * Payload:
   * {
   *   "eventType": "educacao.declarada",
   *   "payload": {
   *     "educationId": "edu-123", // Opcional, gerado se não fornecido
   *     "type": "formal",
   *     "institution": "Universidade X",
   *     "course": "Engenharia de Software",
   *     "startDate": "2020-01",
   *     "endDate": "2024-12",
   *     "description": "Graduação completa"
   *   }
   * }
   * 
   * Respostas:
   * - 200: Evento criado com sucesso
   * - 400: Validação falhou
   * - 401: Não autenticado
   * - 500: Erro inesperado
   */
  fastify.post<{ Body: { eventType: string; payload: any } }>('/education/events', async (req, reply) => {
    if (!req.user || !req.user.userId) {
      return reply.status(401).send({ error: 'Authentication required' });
    }

    if (!req.tenant || !req.tenant.id) {
      return reply.status(400).send({ error: 'Tenant not found' });
    }

    // Validar payload
    const parsed = createEducationEventSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Invalid request body',
        details: parsed.error.errors,
      });
    }

    try {
      // 🔴 VALIDAÇÃO: parsed.data já foi validado pelo schema, garantindo eventType e payload
      const event = await profileEducationService.createEducationEvent(
        req.tenant.id,
        req.user.userId,
        parsed.data as CreateEducationEventInput
      );

      return reply.status(200).send({
        ok: true,
        data: event,
      });
    } catch (error) {
      fastify.log.error({ err: error }, 'Error creating education event');
      return reply.status(500).send({ 
        error: 'Failed to create education event',
        message: error instanceof Error ? error.message : String(error)
      });
    }
  });

  /**
   * GET /education/events
   * Lista eventos educacionais do usuário autenticado
   * 
   * Autenticação: OBRIGATÓRIA (JWT)
   * 
   * Retorna todos os eventos educacionais do actor em ordem cronológica (mais recente primeiro).
   * 
   * Respostas:
   * - 200: Lista de eventos
   * - 401: Não autenticado
   * - 500: Erro inesperado
   */
  fastify.get('/education/events', async (req, reply) => {
    if (!req.user || !req.user.userId) {
      return reply.status(401).send({ error: 'Authentication required' });
    }

    if (!req.tenant || !req.tenant.id) {
      return reply.status(400).send({ error: 'Tenant not found' });
    }

    try {
      const events = await profileEducationService.listEducationEvents(
        req.tenant.id,
        req.user.userId
      );

      return reply.status(200).send({
        ok: true,
        data: events,
      });
    } catch (error) {
      fastify.log.error({ err: error }, 'Error listing education events');
      return reply.status(500).send({ 
        error: 'Failed to list education events',
        message: error instanceof Error ? error.message : String(error)
      });
    }
  });

  /**
   * GET /education
   * Busca perfil educacional (READ-MODEL derivado dos eventos)
   *
   * Autenticação: OBRIGATÓRIA (JWT)
   *
   * Retorna projeção reconstruída a partir dos eventos educacionais.
   * Este é um read-model puro - não altera estado, apenas exibe.
   *
   * NOTA: Módulo registrado com prefixo /profile, então rota final é /profile/education
   *
   * PADRÃO ENTERPRISE: Retorna perfil vazio (education: []) se não houver eventos,
   * permitindo que a UI funcione para usuários novos.
   *
   * Respostas:
   * - 200: Perfil educacional (pode ser vazio se usuário novo)
   * - 401: Não autenticado
   * - 500: Erro inesperado
   */
  fastify.get('/education', async (req, reply) => {
    if (!req.user || !req.user.userId) {
      return reply.status(401).send({ error: 'Authentication required' });
    }

    if (!req.tenant || !req.tenant.id) {
      return reply.status(400).send({ error: 'Tenant not found' });
    }

    try {
      const profile = await profileEducationService.getEducationProfile(
        req.tenant.id,
        req.user.userId
      );

      // PADRÃO ENTERPRISE: Retornar perfil vazio em vez de 404
      // Isso permite que a UI funcione mesmo para usuários sem eventos educacionais
      if (!profile) {
        return reply.status(200).send({
          ok: true,
          data: {
            globalUserId: req.user.userId,
            education: [],
          },
        });
      }

      return reply.status(200).send({
        ok: true,
        data: profile,
      });
    } catch (error) {
      fastify.log.error({ err: error }, 'Error getting education profile');
      return reply.status(500).send({
        error: 'Failed to get education profile',
        message: error instanceof Error ? error.message : String(error)
      });
    }
  });
};

export default profileEducationRoutes;
