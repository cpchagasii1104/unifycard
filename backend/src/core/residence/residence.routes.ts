// src/core/residence/residence.routes.ts
//
// 🔴 F-RESIDENCE-SCHEMA-GHOST-FAIL-CLOSED-CONTAINMENT (DT-FANTASMA-ORPHAN-COLLECTIVE, item core/residence;
// Lote L5 item 7, 2026-07-06). O módulo `residence` está MONTADO (identity.routes.ts:1575, prefixo
// /identity/residence) e o service bate em `global_user_residence` — tabela que **não é criada por NENHUMA
// migration canônica** (`to_regclass('public.global_user_residence')=NULL`, verificado no unificard_dev).
// → schema ghost: qualquer acesso emitiria `42P01 relation does not exist` (500 cru). Além disso o conceito
// (endereço/região de residência) JÁ tem caminho vivo e provado em produção: DECISION-0074, rota
// `/profile/residence-address`, consumida por frontend/src/api/residenceAddress.ts → Profile.tsx. Este
// caminho está SUPERADO.
//
// Decisão (2026-07-06, GO de Clayton "siga o fluxo de correções respeitando leis e normas"): substituir o
// 500 cru por contenção fail-closed HONESTA (blanket): 501 nomeado, ZERO chamada ao service, ZERO acesso ao
// DB, em TODAS as rotas (o GET tem side effect de auto-criação — igualmente contido). Contenção ≠ remoção:
// service/schemas/types preservados; remover o diretório e migrar consumidores é decisão própria (o caminho
// canônico /profile/residence-address já cobre o caso). Mesmo padrão de organization/automation/saúde.
import { FastifyPluginAsync } from 'fastify';

const RESIDENCE_SCHEMA_GHOST_CONTAINED = {
  ok: false,
  code: 'RESIDENCE_SCHEMA_GHOST_CONTAINED',
  message:
    'Residence module is not available because its canonical schema (global_user_residence) has not been ' +
    'materialized. Use the live residence-address path (/profile/residence-address, DECISION-0074) instead. ' +
    '(DT-FANTASMA-ORPHAN-COLLECTIVE / core-residence)',
};

const residenceRoutes: FastifyPluginAsync = async (fastify) => {
  // Handler de contenção único — curto-circuito fail-closed (501) ANTES de qualquer service/DB.
  const contained = async (_req: any, reply: any) =>
    reply.status(501).send(RESIDENCE_SCHEMA_GHOST_CONTAINED);

  fastify.get('/', contained);
  fastify.post('/set', contained);
  fastify.post('/set-preferences', contained);
};

export default residenceRoutes;
