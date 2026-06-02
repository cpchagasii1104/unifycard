// src/core/profile/profile-health.routes.ts
// Rotas LEGADAS/RESERVADAS de Saúde — DESATIVADAS com 501 (F-SAUDE-501 / DECISION-0071).
//
// Saúde está FORA do MVP até nascer com SSOT actor-first + consentimento explícito + visibility (private
// default) + audit + política de retenção. As tabelas (user_health_facts/health_taxonomies/health_consents)
// NÃO existem no DB (migration 0382 arquivada, NÃO aplicada) — manter as rotas vivas batia em tabela ausente
// (500 fantasma) ou retornava leitura vazia enganosa. Estas rotas agora respondem 501 HONESTO e NÃO tocam o
// DB. Os services/repos legados (profile-health.*) permanecem no código (não deletados nesta fatia), mas NÃO
// são chamados por estas rotas.

import { FastifyPluginAsync, FastifyReply } from 'fastify';

const HEALTH_DISABLED_PAYLOAD = {
  ok: false,
  code: 'PROFILE_HEALTH_DISABLED',
  message: 'Saúde está fora do MVP até substrato governado nascer',
  replacement: null,
  decision: 'DECISION-0071',
} as const;

function sendDisabled(reply: FastifyReply): FastifyReply {
  return reply.status(501).send(HEALTH_DISABLED_PAYLOAD);
}

const profileHealthRoutes: FastifyPluginAsync = async (fastify) => {
  // Taxonomias / fatos de saúde — DESATIVADOS (501)
  fastify.get('/health/taxonomies', (_req, reply) => sendDisabled(reply));
  fastify.get('/health/facts', (_req, reply) => sendDisabled(reply));
  fastify.post('/health/facts', (_req, reply) => sendDisabled(reply));
  fastify.delete('/health/facts/:id', (_req, reply) => sendDisabled(reply));

  // Declarações de saúde — DESATIVADAS (501)
  fastify.get('/health/declarations', (_req, reply) => sendDisabled(reply));
  fastify.post('/health/declarations', (_req, reply) => sendDisabled(reply));
  fastify.delete('/health/declarations/:id', (_req, reply) => sendDisabled(reply));
};

export default profileHealthRoutes;
