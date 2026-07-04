// src/core/location/me-active-location.routes.ts
// DECISION-0030 — Localização contextual de actor (F4 do plano feed geo)
//
// Endpoints user-facing para gerenciar localização ativa do actor atual.
//
//   POST   /me/active-location  → set (substitui anterior; UNIQUE parcial garante 1 ativa)
//   DELETE /me/active-location  → clear (UPDATE is_active=false; preserva histórico)
//   GET    /me/active-location  → read (retorna localização ativa OU null)
//
// Princípios aplicados:
//   - LGPD: dado privado, escopo restrito ao actor do request (RLS server-side)
//   - "Frontend nunca cria verdade": validação Zod + service resolve
//   - DECISION-0030 anti-padrão #4: lat/lng só em tabelas geo-específicas;
//     este endpoint apenas escreve em actor_active_location

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { actorActiveLocationRepository } from './actor-active-location.repository';
import type { ActorActiveLocationSource, ActorActiveLocationScopeLevel } from './feed-proximity.types';

const SOURCES: ActorActiveLocationSource[] = [
  'USER_INPUT_CITY',
  'BROWSER_GEOLOCATION',
  'IP_ESTIMATE',
  'EXPLICIT_TRAVEL_MODE',
];

const SCOPE_LEVELS: ActorActiveLocationScopeLevel[] = [
  'NEIGHBORHOOD',
  'CITY',
  'STATE',
  'COUNTRY',
];

const setActiveLocationSchema = z
  .object({
    address_id: z.string().uuid().optional(),
    lat: z.number().min(-90).max(90).optional(),
    lng: z.number().min(-180).max(180).optional(),
    source: z.enum(SOURCES as [ActorActiveLocationSource, ...ActorActiveLocationSource[]]),
    scope_level: z
      .enum(SCOPE_LEVELS as [ActorActiveLocationScopeLevel, ...ActorActiveLocationScopeLevel[]])
      .optional(),
    expires_at: z.string().datetime().nullable().optional(),
    metadata: z.record(z.any()).optional(),
  })
  .refine(
    (data) =>
      !!data.address_id || (data.lat !== undefined && data.lng !== undefined),
    {
      message: 'address_id OU (lat AND lng) é obrigatório',
    }
  );

const meActiveLocationRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * POST /me/active-location
   *
   * Define localização ativa do actor atual.
   * Body: { address_id?, lat?, lng?, source, scope_level?, expires_at?, metadata? }
   * ≥1 entre address_id OU (lat, lng) obrigatório.
   *
   * Idempotência: desativa localização anterior + cria nova (append-only).
   */
  fastify.post<{
    Body: z.infer<typeof setActiveLocationSchema>;
  }>('/active-location', async (req, reply) => {
    if (!req.user) {
      return reply.status(401).send({ error: 'Não autenticado' });
    }
    if (!req.tenant) {
      return reply.status(400).send({ error: 'Tenant não encontrado' });
    }
    if (!req.actionContext || !req.actionContext.actorId) {
      return reply.status(400).send({ error: 'ActionContext obrigatório' });
    }

    const parsed = setActiveLocationSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Body inválido',
        details: parsed.error.flatten(),
      });
    }

    try {
      // 🔴 IMPERSONATION FIX (triagem YALA G1, 2026-07-04): actionContext.actorId é client-declared;
      // sem prova, qualquer autenticado definiria a localização ativa (contexto espacial) de OUTRO
      // actor. Provar representação (DECISION-0113), fail-closed.
      const { authorizationService: authzLoc } = await import('@core/authorization/authorization.service');
      if (!(await authzLoc.canRepresentActor(req.tenant.id, req.user.userId, req.actionContext.actorId))) {
        return reply.status(403).send({ error: 'Sem autoridade para representar o actor declarado' });
      }
      const location = await actorActiveLocationRepository.setActive(
        req.tenant.id,
        req.actionContext.actorId,
        {
          addressId: parsed.data.address_id ?? null,
          lat: parsed.data.lat ?? null,
          lng: parsed.data.lng ?? null,
          source: parsed.data.source,
          scopeLevel: parsed.data.scope_level,
          expiresAt: parsed.data.expires_at ?? null,
          metadata: parsed.data.metadata ?? {},
        }
      );
      return reply.status(201).send({ location });
    } catch (error) {
      fastify.log.error({ err: error }, 'Erro ao setar active-location');
      const msg = error instanceof Error ? error.message : 'Erro interno';
      return reply.status(500).send({ error: msg });
    }
  });

  /**
   * DELETE /me/active-location
   *
   * Desativa localização ativa do actor (UPDATE is_active=false).
   * Preserva histórico (não DELETA). Idempotente: ok chamar sem ter ativa.
   */
  fastify.delete('/active-location', async (req, reply) => {
    if (!req.user) {
      return reply.status(401).send({ error: 'Não autenticado' });
    }
    if (!req.tenant) {
      return reply.status(400).send({ error: 'Tenant não encontrado' });
    }
    if (!req.actionContext || !req.actionContext.actorId) {
      return reply.status(400).send({ error: 'ActionContext obrigatório' });
    }

    try {
      // 🔴 IMPERSONATION FIX (triagem YALA G1): provar representação antes de limpar a localização
      // ativa do actor declarado (senão qualquer autenticado apagaria o contexto espacial de outro).
      const { authorizationService: authzLocDel } = await import('@core/authorization/authorization.service');
      if (!(await authzLocDel.canRepresentActor(req.tenant.id, req.user.userId, req.actionContext.actorId))) {
        return reply.status(403).send({ error: 'Sem autoridade para representar o actor declarado' });
      }
      await actorActiveLocationRepository.clearActive(
        req.tenant.id,
        req.actionContext.actorId
      );
      return reply.status(204).send();
    } catch (error) {
      fastify.log.error({ err: error }, 'Erro ao limpar active-location');
      const msg = error instanceof Error ? error.message : 'Erro interno';
      return reply.status(500).send({ error: msg });
    }
  });

  /**
   * GET /me/active-location
   *
   * Retorna localização ativa do actor atual (ou null se não houver).
   */
  fastify.get('/active-location', async (req, reply) => {
    if (!req.user) {
      return reply.status(401).send({ error: 'Não autenticado' });
    }
    if (!req.tenant) {
      return reply.status(400).send({ error: 'Tenant não encontrado' });
    }
    if (!req.actionContext || !req.actionContext.actorId) {
      return reply.status(400).send({ error: 'ActionContext obrigatório' });
    }

    // 🔴 DECISION-0113 fatia 6.3 (leitura cross-user): representabilidade ANTES de ler a localização (geo
    // lat/lng) do actor declarado (spoofável) — fail-closed → 403 não-leak.
    let canReadActiveLocation = false;
    try {
      const { authorizationService } = await import('@core/authorization/authorization.service');
      canReadActiveLocation = await authorizationService.canRepresentActor(req.tenant.id, req.user.userId, req.actionContext.actorId);
    } catch { canReadActiveLocation = false; }
    if (!canReadActiveLocation) {
      return reply.status(403).send({ error: 'Actor não representável pelo usuário autenticado' });
    }

    try {
      const location = await actorActiveLocationRepository.getActive(
        req.tenant.id,
        req.actionContext.actorId
      );
      return reply.send({ location });
    } catch (error) {
      fastify.log.error({ err: error }, 'Erro ao buscar active-location');
      const msg = error instanceof Error ? error.message : 'Erro interno';
      return reply.status(500).send({ error: msg });
    }
  });
};

export default meActiveLocationRoutes;
