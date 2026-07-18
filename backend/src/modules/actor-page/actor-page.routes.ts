// backend/src/modules/actor-page/actor-page.routes.ts
// F-ACTOR-PAGE-SHELL-SLICE-3 — GET /actor-page/:actorId?mode=consuming|operating
// O contrato ÚNICO web+app (DESENHO §2.4): o backend descreve a página, o cliente renderiza.
//
// AUTORIDADE (DECISION-0113 — D1/D4/D5/D8/D9):
//   · `actionContext.actorId` é HINT não-soberano (declara quem age, não autoriza). Declarar ≠ autorizar.
//   · consuming = leitura de membro do tenant. O VIEWER efetivo (usado para status de conexão e
//     existência de fato de negócio — dados privados do PAR) NUNCA vem cru do actionContext: é
//     derivado server-side do principal autenticado (`req.user` → actor humano canônico, read-only).
//     Um `actionContext.actorId` declarado só é honrado se `canRepresentActor(req.user, actorId)`
//     provar representação; hint não-provado é IGNORADO (cai no actor canônico do principal), nunca
//     usado — assim um caller não enumera relação/fato de negócio de pares (X, alvo) arbitrários.
//   · operating = superfície de GESTÃO → canRepresentActor(req.user, actorId) fail-closed 403.
//   · Falha de infraestrutura (throw) NÃO vira false/403/página neutra: propaga como 5xx (invariante
//     "falha deve falhar"; DECISION-0113 D5). `canRepresentActor` retorna false só em deny legítimo
//     (actor inexistente / não representável) — apenas o throw é infra.
// READ-ONLY: nenhum write neste módulo. Não cria actor/estado no read path. Anti-PII (ver repository).

import type { FastifyInstance } from 'fastify';
import { actorPageService } from './actor-page.service';
import { authorizationService } from '@core/authorization/authorization.service';
import { socialPortsRegistry } from '@core/social/ports-registry';
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

      try {
        // 🔴 modo Operando = gestão da própria página → prova de representação fail-closed.
        // Sem catch→false: throw (infra) sobe para o handler de 500 abaixo; só o `false` (deny
        // legítimo de canRepresentActor) vira 403.
        if (mode === 'operating') {
          const ok = await authorizationService.canRepresentActor(tenantId, userId, req.params.actorId);
          if (!ok) {
            return reply.status(403).send({ error: 'Sem autoridade para operar esta página' });
          }
        }

        // VIEWER efetivo (server-side). Regra DECISION-0113 D4/D5/D9:
        // 1) hint declarado (actionContext.actorId) só vale se provado por canRepresentActor;
        // 2) hint ausente ou não-provado → actor humano canônico do principal (read-only, sem ensure/create).
        const declaredActorId: string | null = (req as any).actionContext?.actorId ?? null;
        let viewerActorId: string | null = null;
        if (declaredActorId) {
          const canRepresent = await authorizationService.canRepresentActor(tenantId, userId, declaredActorId);
          if (canRepresent) {
            viewerActorId = declaredActorId;
          }
        }
        if (!viewerActorId) {
          const canonicalActor = await socialPortsRegistry.getActorRepository().findByUserId(tenantId, userId);
          viewerActorId = canonicalActor?.actor_id ?? null;
        }

        const contract = await actorPageService.getContract(tenantId, req.params.actorId, mode, viewerActorId);
        return reply.send({ ok: true, data: contract });
      } catch (err: any) {
        // Erro esperado do serviço (com statusCode, ex.: 404 actor inexistente) preserva o status;
        // qualquer outra falha (incl. infraestrutura de Authority/relationships) é 5xx honesto.
        const status = err?.statusCode ?? 500;
        return reply.status(status).send({ ok: false, error: err?.message ?? 'Erro ao montar a página' });
      }
    }
  );
};

export default actorPageRoutes;
