// backend/src/modules/contextual-messaging/contextual-thread.routes.ts
// Rotas para Mensageria Contextual
// 🔴 BLINDAGEM: NÃO toma decisões automáticas

import { FastifyPluginAsync } from 'fastify';

// 🔴 F-CONTEXTUAL-THREAD-SCHEMA-GHOST-FAIL-CLOSED-CONTAINMENT (DT-CONTEXTUAL-THREAD-SCHEMA-GHOST):
// O módulo `contextual-messaging` está MONTADO (app.builder.ts) e suas rotas batem no repository, que
// faz INSERT/SELECT/UPDATE em `contextual_threads`/`contextual_messages`. Mas essas tabelas **não são
// criadas por NENHUMA migration canônica** (verificado: zero ocorrência de `CREATE TABLE ... contextual_*`
// em backend/migrations; `to_regclass('public.contextual_threads')=NULL`). → schema ghost. Qualquer
// acesso ao DB emitiria `42P01 relation "contextual_threads" não existe` (500 cru), e os writes ainda
// carregavam riscos LATENTES de autoria (`sendMessage` gravava `actionContext.actorId` cru; `addParticipant`
// aceitava `body.actorId` cru). NÃO se faz binding sobre superfície morta.
//
// Decisão IA Diretora (2026-06-16): NÃO religar / NÃO materializar schema / NÃO ativar feature. Substituir
// o 500 cru por contenção fail-closed HONESTA: 501 nomeado, ZERO chamada ao service/repository, ZERO acesso
// ao DB, ZERO write. **Reads contidos na MESMA frente** (também batem nas tabelas ghost — decisão IA Diretora:
// não deixar GET emitindo 500 cru enquanto POST está honesto). Religação/binding/elegibilidade = frentes
// próprias (DT-CONTEXTUAL-THREAD-SCHEMA-GHOST / DT-CONTEXTUAL-THREAD-WRITE-AUTHORSHIP-BINDING-LATENT).
const CONTEXTUAL_THREAD_SCHEMA_GHOST_CONTAINED = {
  ok: false,
  code: 'CONTEXTUAL_THREAD_SCHEMA_GHOST_CONTAINED',
  message:
    'Contextual threads are not available because their canonical schema (contextual_threads / ' +
    'contextual_messages) has not been materialized. (DT-CONTEXTUAL-THREAD-SCHEMA-GHOST)',
};

const contextualThreadRoutes: FastifyPluginAsync = async (fastify) => {
  // Handler de contenção único — curto-circuito fail-closed (501) ANTES de qualquer service/repository/DB.
  const contained = async (_req: any, reply: any) =>
    reply.status(501).send(CONTEXTUAL_THREAD_SCHEMA_GHOST_CONTAINED);

  // ── WRITES (contidos: zero service, zero repository, zero DB, zero write, zero autoria) ──
  // POST /contextual-threads (createThread)
  fastify.post('/contextual-threads', contained);
  // POST /contextual-threads/:threadId/participants (addParticipant — body.actorId cru NÃO é lido)
  fastify.post('/contextual-threads/:threadId/participants', contained);
  // POST /contextual-threads/:threadId/messages (sendMessage — actionContext.actorId cru NÃO é lido)
  fastify.post('/contextual-threads/:threadId/messages', contained);

  // ── READS (contidos na mesma frente — batem nas MESMAS tabelas ghost; não emitir 500 cru) ──
  // GET /contextual-threads (listThreads)
  fastify.get('/contextual-threads', contained);
  // GET /contextual-threads/:threadId (getThreadById)
  fastify.get('/contextual-threads/:threadId', contained);
  // GET /contextual-threads/context/:contextType/:contextId (getThreadByContext)
  fastify.get('/contextual-threads/context/:contextType/:contextId', contained);
  // GET /contextual-threads/:threadId/messages (getMessages)
  fastify.get('/contextual-threads/:threadId/messages', contained);
};

export default contextualThreadRoutes;
