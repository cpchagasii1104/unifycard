// backend/src/modules/actor-page/actor-page.routes.ts
// F-ACTOR-PAGE-SHELL-SLICE-3 — GET /actor-page/:actorId?mode=consuming|operating
// O contrato ÚNICO web+app (DESENHO §2.4): o backend descreve a página, o cliente renderiza.
//
// AUTORIDADE (DECISION-0113):
//   · consuming = leitura de membro do tenant (req.user obrigatório; actor da URL = recurso público
//     local, não autoridade);
//   · operating = superfície de GESTÃO → canRepresentActor(req.user, actorId) fail-closed 403.
// READ-ONLY: nenhum write neste módulo. Anti-PII por construção (ver repository).

import type { FastifyInstance } from 'fastify';
import { actorPageService } from './actor-page.service';
import { authorizationService } from '@core/authorization/authorization.service';
import type { ActorPageMode } from './actor-page.types';

const actorPageRoutes = async (fastify: FastifyInstance) => {
  fastify.get<{ Params: { actorId: string }; Querystring: { mode?: string } }>(
    '/actor-page/:actorId',
    async (req, reply) => {
      const tenantId = req.tenant!.id;
      const userId = (req as any).user?.userId ?? (req as any).user?.id;
      if (!userId) {
        return reply.status(401).send({ error: 'Autenticação obrigatória' });
      }

      const mode: ActorPageMode = req.query.mode === 'operating' ? 'operating' : 'consuming';

      // 🔴 modo Operando = gestão da própria página → prova de representação fail-closed
      if (mode === 'operating') {
        let ok = false;
        try {
          ok = await authorizationService.canRepresentActor(tenantId, userId, req.params.actorId);
        } catch {
          ok = false;
        }
        if (!ok) {
          return reply.status(403).send({ error: 'Sem autoridade para operar esta página' });
        }
      }

      // viewer actor (actionContext) é HINT de personalização (labels do Conectar), nunca autoridade
      const viewerActorId = (req as any).actionContext?.actorId ?? null;

      try {
        const contract = await actorPageService.getContract(tenantId, req.params.actorId, mode, viewerActorId);
        return reply.send({ ok: true, data: contract });
      } catch (err: any) {
        const status = err?.statusCode ?? 500;
        return reply.status(status).send({ ok: false, error: err?.message ?? 'Erro ao montar a página' });
      }
    }
  );
};

export default actorPageRoutes;
