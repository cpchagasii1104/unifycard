// backend/src/modules/composer/composer.routes.ts
// F-COMPOSER-CONTRACT-C1 — GET /composer/contract?actorId=&mode=consuming|operating
// O contrato ÚNICO web+app do compositor: o backend enumera os atos criáveis, o cliente renderiza.
//
// AUTORIDADE (DECISION-0113): o compositor age COMO um actor (escreve atos em nome dele). Portanto o
// actor-em-que-se-compõe precisa ser REPRESENTADO pelo principal autenticado (req.user), fail-closed 403
// — em AMBOS os modos (diferente do actor-page, onde consuming é leitura pública). Enumerar o que EU
// posso criar como o actor X exige que eu possa representar X. READ-ONLY: nenhum write neste módulo.

import type { FastifyInstance } from 'fastify';
import { composerService } from './composer.service';
import { authorizationService } from '@core/authorization/authorization.service';
import type { ComposerMode } from './composer.types';

const composerRoutes = async (fastify: FastifyInstance) => {
  fastify.get<{ Querystring: { actorId?: string; mode?: string } }>(
    '/composer/contract',
    async (req, reply) => {
      const tenantId = req.tenant!.id;
      const userId = (req as any).user?.userId ?? (req as any).user?.id;
      if (!userId) {
        return reply.status(401).send({ error: 'Autenticação obrigatória' });
      }

      // O actor a compor: query actorId, senão o actionContext (o actor ativo). Nunca confiado como
      // autoridade — validado por canRepresentActor abaixo.
      const actingActorId = req.query.actorId ?? (req as any).actionContext?.actorId ?? null;
      if (!actingActorId) {
        return reply.status(400).send({ error: 'actorId (query ou actionContext) obrigatório' });
      }

      const mode: ComposerMode = req.query.mode === 'operating' ? 'operating' : 'consuming';

      // 🔴 gate de autoridade: só enumero o que POSSO criar como este actor se o represento (fail-closed).
      let ok = false;
      try {
        ok = await authorizationService.canRepresentActor(tenantId, userId, actingActorId);
      } catch {
        ok = false;
      }
      if (!ok) {
        return reply.status(403).send({ error: 'Sem autoridade para compor como este actor', code: 'COMPOSER_ACTOR_NOT_REPRESENTABLE' });
      }

      try {
        const contract = await composerService.getContract(tenantId, actingActorId, mode);
        return reply.send({ ok: true, data: contract });
      } catch (err: any) {
        const status = err?.statusCode ?? 500;
        return reply.status(status).send({ ok: false, error: err?.message ?? 'Erro ao montar o compositor' });
      }
    }
  );
};

export default composerRoutes;
