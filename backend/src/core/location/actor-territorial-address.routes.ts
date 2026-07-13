// F-ADDRESS-ONBOARDING-CANONICAL-FLOW (RFC A1-D) — rotas do MVP PF/residência.
//
//   POST /actors/:actorId/territorial-address  → set/replace (compõe re-resolução + writer C)
//   GET  /actors/:actorId/territorial-address  → leitura do vigente (read-model actor-scoped)
//
// Rotas FINAS: auth (req.user/req.tenant) + action-context coerente com o actorId da ROTA +
// canRepresentActor → delegam ao application service / read-model. NENHUMA lógica SQL aqui.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { authorizationService } from '@core/authorization/authorization.service';
import {
  actorTerritorialAddressOnboardingService,
  TerritorialOnboardingError,
  type OnboardingAuthContext,
} from './actor-territorial-address-onboarding.service';
import { actorTerritorialAddressReadService } from './actor-territorial-address-read.service';
import type { TerritorialAddressErrorCode } from '@unificard/contracts';

const setBodySchema = z.object({
  purpose: z.literal('ACTOR_RESIDENCE'),
  countryCode: z.string().min(1).max(8),
  postalCode: z.string().min(1).max(16),
  street: z.string().max(160).nullable().optional().transform((v) => v ?? ''),
  number: z.string().min(1).max(24),
  complement: z.string().max(120).nullable().optional(),
  confirmedCityId: z.string().uuid(),
  confirmedNeighborhoodId: z.string().uuid().nullable().optional(),
  idempotencyKey: z.string().min(1).max(200),
});

/** Código público estável → HTTP. Sem vazar internals. */
function httpForCode(code: TerritorialAddressErrorCode): number {
  switch (code) {
    case 'authority_denied': return 403;
    case 'actor_not_eligible': return 422;
    case 'country_required':
    case 'country_not_supported':
    case 'postal_code_invalid':
    case 'invalid_address_payload': return 400;
    case 'provider_unavailable': return 503;
    case 'provider_not_found': return 404;
    case 'canonical_city_missing':
    case 'canonical_city_ambiguous':
    case 'provider_conflict':
    case 'official_identifier_missing':
    case 'official_identifier_conflict':
    case 'territorial_inconsistency':
    case 'territorial_confirmation_mismatch': return 422;
    case 'actor_territorial_in_progress':
    case 'idempotency_payload_mismatch': return 409;
    default: return 500;
  }
}

const actorTerritorialAddressRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Params: { actorId: string }; Body: unknown }>(
    '/:actorId/territorial-address',
    async (req, reply) => {
      if (!req.user) return reply.status(401).send({ error: 'authority_denied', message: 'Não autenticado' });
      if (!req.tenant) return reply.status(400).send({ error: 'invalid_address_payload', message: 'Tenant não encontrado' });
      if (!req.actionContext || !req.actionContext.actorId) {
        return reply.status(400).send({ error: 'invalid_address_payload', message: 'ActionContext obrigatório' });
      }

      const parsed = setBodySchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'invalid_address_payload', message: 'Body inválido' });
      }

      // Autoridade na ROTA (padrão da casa: me-active-location / DECISION-0113) — coerência actor
      // rota × action-context + canRepresentActor ANTES de delegar. O application service REVALIDA
      // (defesa em profundidade; infra-error propaga, nunca vira 403 silencioso).
      if (req.actionContext.actorId !== req.params.actorId) {
        return reply.status(403).send({ error: 'authority_denied' });
      }
      try {
        const representable = await authorizationService.canRepresentActor(
          req.tenant.id,
          req.user.userId,
          req.params.actorId,
        );
        if (!representable) return reply.status(403).send({ error: 'authority_denied' });
      } catch (err) {
        req.log.error({ err }, 'territorial-address set authority falhou');
        return reply.status(500).send({ error: 'unexpected_error' });
      }

      const auth: OnboardingAuthContext = {
        tenantId: req.tenant.id,
        operatorUserId: req.user.userId,
        routeActorId: req.params.actorId,
        actionContextActorId: req.actionContext.actorId,
      };

      try {
        const result = await actorTerritorialAddressOnboardingService.setResidenceAddress(auth, {
          purpose: 'ACTOR_RESIDENCE',
          countryCode: parsed.data.countryCode,
          postalCode: parsed.data.postalCode,
          street: parsed.data.street,
          number: parsed.data.number,
          complement: parsed.data.complement ?? null,
          confirmedCityId: parsed.data.confirmedCityId,
          confirmedNeighborhoodId: parsed.data.confirmedNeighborhoodId ?? null,
          idempotencyKey: parsed.data.idempotencyKey,
        });
        return reply.status(result.replayed ? 200 : 201).send(result);
      } catch (err) {
        if (err instanceof TerritorialOnboardingError) {
          return reply.status(httpForCode(err.code)).send({ error: err.code });
        }
        // Infra error: 500 sem vazar internals (não converter em 403).
        req.log.error({ err }, 'territorial-address set falhou');
        return reply.status(500).send({ error: 'unexpected_error' });
      }
    },
  );

  fastify.get<{ Params: { actorId: string }; Querystring: { purpose?: string } }>(
    '/:actorId/territorial-address',
    async (req, reply) => {
      if (!req.user) return reply.status(401).send({ error: 'authority_denied', message: 'Não autenticado' });
      if (!req.tenant) return reply.status(400).send({ error: 'invalid_address_payload', message: 'Tenant não encontrado' });
      if (!req.actionContext || !req.actionContext.actorId) {
        return reply.status(400).send({ error: 'invalid_address_payload', message: 'ActionContext obrigatório' });
      }
      // MVP: só ACTOR_RESIDENCE.
      const purpose = req.query.purpose ?? 'ACTOR_RESIDENCE';
      if (purpose !== 'ACTOR_RESIDENCE') {
        return reply.status(400).send({ error: 'invalid_address_payload', message: 'purpose fora do MVP' });
      }
      // Coerência actor rota × action-context.
      if (req.actionContext.actorId !== req.params.actorId) {
        return reply.status(403).send({ error: 'authority_denied' });
      }
      // Autoridade ANTES de ler (não vazar existência/endereço de Actor fora da representação).
      let representable = false;
      try {
        representable = await authorizationService.canRepresentActor(req.tenant.id, req.user.userId, req.params.actorId);
      } catch (err) {
        req.log.error({ err }, 'territorial-address read authority falhou');
        return reply.status(500).send({ error: 'unexpected_error' });
      }
      if (!representable) return reply.status(403).send({ error: 'authority_denied' });

      try {
        const current = await actorTerritorialAddressReadService.getCurrent(
          req.tenant.id,
          req.params.actorId,
          'ACTOR_RESIDENCE',
        );
        return reply.send(current);
      } catch (err) {
        req.log.error({ err }, 'territorial-address read falhou');
        return reply.status(500).send({ error: 'unexpected_error' });
      }
    },
  );
};

export default actorTerritorialAddressRoutes;
