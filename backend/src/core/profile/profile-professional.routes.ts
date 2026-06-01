// src/core/profile/profile-professional.routes.ts
// Rotas LEGADAS de perfil profissional — MIGRADAS para /profile/professional/c1.
//
// O substrato legado (user_skills_categories, predefined_services, combo_discount_rules,
// professional_profiles) está AUSENTE do schema vivo: estas rotas batiam em tabelas inexistentes
// e retornavam 500/400 opaco. A aba Profissional foi migrada e SELADA em C1
// (docs/02_decisions/SELO_A3_2_PROFISSIONAL_C1.md). Estas rotas agora respondem 501 EXPLÍCITO
// apontando para o substituto, SEM chamar o serviço legado morto (não há fallback 200 vazio).
// O serviço/arquivo legado permanecem por ora — remoção é frente futura
// (ver DT-DEAD-PROFESSIONAL-LEGACY-SUBSTRATE), após Agenda (DT-AGENDA-AVAILABILITY-VIA-DEAD-LEGACY-PUT)
// e Human MVP serem tratados.

import { FastifyPluginAsync } from 'fastify';

// Payload estável de "migrado, não implementado aqui" (501). C1 é o substituto.
const LEGACY_NOT_IMPLEMENTED_PAYLOAD = {
  ok: false as const,
  code: 'PROFESSIONAL_PROFILE_LEGACY_NOT_IMPLEMENTED' as const,
  message: 'Endpoint legado migrado para /profile/professional/c1.',
  replacement: '/profile/professional/c1' as const,
};

const profileProfessionalRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /profile/professional — LEGADO (501 Not Implemented)
   * Migrado para GET /profile/professional/c1. NÃO chama o serviço legado morto.
   */
  fastify.get('/professional', async (_req, reply) => {
    return reply.status(501).send(LEGACY_NOT_IMPLEMENTED_PAYLOAD);
  });

  /**
   * PUT /profile/professional — LEGADO (501 Not Implemented)
   * Migrado para o contrato granular /profile/professional/c1/* (POST/PATCH/DELETE + bio PUT).
   * NÃO chama o serviço legado morto.
   */
  fastify.put('/professional', async (_req, reply) => {
    return reply.status(501).send(LEGACY_NOT_IMPLEMENTED_PAYLOAD);
  });
};

export default profileProfessionalRoutes;
